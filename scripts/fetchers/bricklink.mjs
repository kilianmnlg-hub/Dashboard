// Holt Bestelldaten aus der Bricklink API: offene Bestellungen (für den "noch zu
// verschicken"-Alarm) und einen Umsatz-Wochenchart der letzten Wochen.
// Benötigt: BRICKLINK_CONSUMER_KEY, BRICKLINK_CONSUMER_SECRET, BRICKLINK_TOKEN_VALUE,
// BRICKLINK_TOKEN_SECRET (siehe README für Einrichtung).
//
// Wichtig: Bricklink bietet über die API keine "Store-Besuche", kein aggregiertes
// "Feedback gesamt" und keine "Drive-Thru-Mail"-Zähler an — diese Werte bleiben
// weiterhin manuell in data.js gepflegt. Automatisiert wird hier gezielt das, was die
// Order-API tatsächlich hergibt: offene Bestellungen, deren Versandstatus und Beträge.

import { buildAuthHeader } from "../lib/oauth1.mjs";

const BASE_URL = "https://api.bricklink.com/api/store/v1";
const REVENUE_WEEKS = Number(process.env.BRICKLINK_REVENUE_WEEKS || 8);

// Status-Codes, die für dich "bezahlt, aber noch nicht verschickt" bedeuten.
// Bricklink-Statusfluss (grob): PENDING -> PROCESSING -> PAID -> PACKED -> SHIPPED -> COMPLETED.
// Falls dein Workflow andere Stati nutzt, per Env-Variable BRICKLINK_SHIP_STATUSES anpassen
// (kommagetrennt, z.B. "PAID,PACKED,READY").
const DEFAULT_SHIP_STATUSES = ["PAID", "PACKED", "READY"];

// Storniert/nicht bezahlt — zählt nicht als echter Umsatz.
const NON_REVENUE_STATUSES = ["CANCELLED", "NPB", "NPX", "NRS", "NSS"];

async function bricklinkGet(path, queryParams, creds) {
  const url = `${BASE_URL}${path}`;
  const qs = new URLSearchParams(queryParams).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;

  const authHeader = buildAuthHeader({ method: "GET", url, queryParams, ...creds });
  const res = await fetch(fullUrl, { headers: { Authorization: authHeader } });
  if (!res.ok) throw new Error(`Bricklink API Fehler ${res.status}: ${await res.text()}`);
  const json = await res.json();
  if (json.meta?.code >= 300) throw new Error(`Bricklink API Fehler: ${json.meta?.message}`);
  return json.data;
}

// Montag der ISO-Woche, in der `date` liegt, als "YYYY-MM-DD".
function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

export async function fetchBricklink() {
  const creds = {
    consumerKey: process.env.BRICKLINK_CONSUMER_KEY,
    consumerSecret: process.env.BRICKLINK_CONSUMER_SECRET,
    tokenValue: process.env.BRICKLINK_TOKEN_VALUE,
    tokenSecret: process.env.BRICKLINK_TOKEN_SECRET
  };
  if (Object.values(creds).some((v) => !v)) {
    console.warn("[bricklink] API-Zugangsdaten unvollständig — übersprungen.");
    return null;
  }

  const shipStatuses = (process.env.BRICKLINK_SHIP_STATUSES || DEFAULT_SHIP_STATUSES.join(","))
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean);

  // Unfiled = aktive/offene Bestellungen (Bricklink-Standardsicht).
  const unfiledOrders = await bricklinkGet("/orders", { direction: "in", filed: "false" }, creds);
  console.log(`[bricklink] ${unfiledOrders.length} offene (unfiled) Bestellungen abgerufen.`);

  const pendingShipments = unfiledOrders
    .filter((o) => shipStatuses.includes(String(o.status).toUpperCase()))
    .map((o) => ({
      orderId: o.order_id,
      buyer: o.buyer_name,
      status: o.status,
      orderedDate: o.date_ordered,
      total: o.cost?.grand_total ?? null,
      currency: o.cost?.currency_code ?? null
    }))
    .sort((a, b) => new Date(a.orderedDate) - new Date(b.orderedDate));

  const patch = {
    bricklinkOrders: {
      checkedAt: new Date().toISOString(),
      openOrdersCount: unfiledOrders.length,
      pendingShipments
    }
  };

  // Filed = archivierte/abgeschlossene Bestellungen. Für den Umsatz-Trend brauchen wir
  // auch die, sonst würden abgeschlossene Wochen als 0€ erscheinen. Eigener try/catch,
  // falls "filed" als Filter in deinem API-Zugang anders/nicht unterstützt wird — dann
  // läuft der Rest (Versand-Alarm) trotzdem weiter, nur der Umsatzchart bleibt kürzer.
  try {
    const filedOrders = await bricklinkGet("/orders", { direction: "in", filed: "true" }, creds);
    console.log(`[bricklink] ${filedOrders.length} archivierte (filed) Bestellungen abgerufen.`);

    const allOrders = [...unfiledOrders, ...filedOrders];
    const seen = new Set();
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - REVENUE_WEEKS * 7);

    const weeklyTotals = {};
    allOrders.forEach((o) => {
      if (seen.has(o.order_id)) return;
      seen.add(o.order_id);
      if (NON_REVENUE_STATUSES.includes(String(o.status).toUpperCase())) return;
      const orderedAt = new Date(o.date_ordered);
      if (Number.isNaN(orderedAt.getTime()) || orderedAt < cutoff) return;

      const weekKey = isoWeekStart(orderedAt);
      const amount = Number(o.cost?.grand_total ?? 0);
      if (!weeklyTotals[weekKey]) weeklyTotals[weekKey] = { total: 0, orderCount: 0 };
      weeklyTotals[weekKey].total += amount;
      weeklyTotals[weekKey].orderCount += 1;
    });

    const weekly = Object.keys(weeklyTotals)
      .sort()
      .map((weekStart) => ({
        weekStart,
        total: Math.round(weeklyTotals[weekStart].total * 100) / 100,
        orderCount: weeklyTotals[weekStart].orderCount
      }));

    const currency = allOrders.find((o) => o.cost?.currency_code)?.cost?.currency_code || "EUR";

    patch.bricklinkRevenue = { checkedAt: new Date().toISOString(), currency, weekly };
  } catch (err) {
    console.error("[bricklink] Umsatz-Trend übersprungen (filed-Abfrage fehlgeschlagen):", err.message);
  }

  return patch;
}
