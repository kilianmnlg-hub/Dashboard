// Holt Bestelldaten aus der Bricklink API: offene Bestellungen (für den "noch zu
// verschicken"-Alarm), Umsatz-Trends (wöchentlich und monatlich) sowie den aktuellen
// Inventar-Bestand ("Total Items" für das 100.000-Teile-Ziel).
// Benötigt: BRICKLINK_CONSUMER_KEY, BRICKLINK_CONSUMER_SECRET, BRICKLINK_TOKEN_VALUE,
// BRICKLINK_TOKEN_SECRET (siehe README für Einrichtung).
//
// Wichtig: Bricklink bietet über die API keine "Store-Besuche", kein aggregiertes
// "Feedback gesamt" und keine "Drive-Thru-Mail"-Zähler an — diese Werte bleiben
// weiterhin manuell in data.js gepflegt. Automatisiert wird hier gezielt das, was die
// Order- und Inventory-API tatsächlich hergeben: offene Bestellungen, deren
// Versandstatus und Beträge, sowie die Gesamtstückzahl im Store-Inventar.
//
// Nachrichten: Die API kennt nur die Nachrichten zu einzelnen Bestellungen
// (GET /orders/{id}/messages), keinen allgemeinen Posteingang. Ob du eine Nachricht in Bricklink
// schon gelesen hast, verrät sie nicht (die Nachrichten haben nur body, dateSent, from, messageID,
// subject und to, die Bestellungen gar kein Lese-Feld). Deshalb liefert dieser Abruf die OFFENEN
// Käufer-Nachrichten einzeln: alle Nachrichten des Käufers nach der letzten Nachricht des Shops
// (data.bricklinkMessages.items: Bestellnummer, Nachrichten-ID, Zeitpunkt). Welche davon schon
// geöffnet wurden, merkt sich das Dashboard selbst (msgseen.js). In data.js stehen nur Zahlen,
// IDs und Zeitpunkte, nie Inhalte oder Namen, das Repo ist öffentlich.

import { buildAuthHeader } from "../lib/oauth1.mjs";

const BASE_URL = "https://api.bricklink.com/api/store/v1";
const REVENUE_WEEKS = Number(process.env.BRICKLINK_REVENUE_WEEKS || 8);
const REVENUE_MONTHS = Number(process.env.BRICKLINK_REVENUE_MONTHS || 6);

// Welche Bestellungen auf Nachrichten geprüft werden: alle noch nicht abgeschlossenen und alle der letzten
// MESSAGE_DAYS Tage, neueste zuerst, höchstens MAX_MESSAGE_ORDERS Abfragen pro Lauf (das Tageslimit der API liegt bei 5.000 Aufrufen).
// BRICKLINK_MESSAGES=off schaltet die Prüfung ab.
const MESSAGES_ENABLED = String(process.env.BRICKLINK_MESSAGES || "on").toLowerCase() !== "off";
const MESSAGE_DAYS = Number(process.env.BRICKLINK_MESSAGE_DAYS || 120);
const MAX_MESSAGE_ORDERS = Number(process.env.BRICKLINK_MESSAGE_MAX_ORDERS || 150);
// Pro Bestellung höchstens so viele offene Käufer-Nachrichten einzeln aufführen, insgesamt höchstens MAX_OPEN_ITEMS (hält data.js klein)
const MAX_OPEN_PER_ORDER = 10;
const MAX_OPEN_ITEMS = 120;
const CLOSED_STATUSES = ["COMPLETED", "CANCELLED", "NPB", "NPX", "NRS", "NSS"];

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

// Kalendermonate zurückrechnen (nicht nur Tage), damit "6 Monate" wirklich 6 Kalendermonate sind.
function monthsAgo(n) {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d;
}

function aggregateBy(orders, keyFn) {
  const totals = {};
  orders.forEach(({ key, amount }) => {
    if (!totals[key]) totals[key] = { total: 0, orderCount: 0 };
    totals[key].total += amount;
    totals[key].orderCount += 1;
  });
  return Object.keys(totals)
    .sort()
    .map((k) => ({
      [keyFn]: k,
      total: Math.round(totals[k].total * 100) / 100,
      orderCount: totals[k].orderCount
    }));
}

// "Total Items" = aktueller Lagerbestand im Store (Summe der Stückzahl über alle Lots in
// deinem Inventar), NICHT die Stückzahl verkaufter Teile — entspricht der "Total Items"-
// Kennzahl, die Bricklink dir selbst in den Store-Statistiken zeigt. Eigener, von den
// Bestellungen unabhängiger API-Aufruf.
async function fetchTotalInventoryItems(creds) {
  const inventory = await bricklinkGet("/inventories", {}, creds);
  return (inventory || []).reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
}

const lower = (v) => String(v ?? "").trim().toLowerCase();
// Feldnamen der Nachrichten sind in der Doku nicht beschrieben: dateSent/from sind die bekannten, die anderen Schreibweisen nur Absicherung.
const messageTime = (m) => Date.parse(m?.dateSent ?? m?.date_sent ?? m?.date ?? "") || 0;
const messageFrom = (m) => lower(m?.from ?? m?.from_user ?? m?.sender);
const messageId = (m) => String(m?.messageID ?? m?.message_id ?? m?.id ?? "").trim();

// Sammelt die offenen Käufer-Nachrichten: pro Bestellung alle Nachrichten des Käufers nach der letzten Nachricht des Shops (also noch ohne Antwort).
// "unanswered" zählt die Bestellungen, "items" die einzelnen Nachrichten (neueste zuerst).
// Prüft nacheinander in kleinen Gruppen; nach mehreren Fehlern in Folge wird abgebrochen (z.B. fehlende Berechtigung).
async function fetchUnansweredMessages(orders, creds) {
  const cutoff = Date.now() - MESSAGE_DAYS * 86400000;
  const candidates = orders
    .filter((o) => {
      const t = Date.parse(o.date_ordered);
      return !CLOSED_STATUSES.includes(String(o.status).toUpperCase()) || (Number.isFinite(t) && t >= cutoff);
    })
    .sort((a, b) => (Date.parse(b.date_ordered) || 0) - (Date.parse(a.date_ordered) || 0))
    .slice(0, MAX_MESSAGE_ORDERS);

  let unanswered = 0;
  let withMessages = 0;
  let failed = 0;
  let lastError = "";
  let fields = [];
  const items = [];
  const BATCH = 4;
  for (let i = 0; i < candidates.length && failed < 5; i += BATCH) {
    const results = await Promise.all(
      candidates.slice(i, i + BATCH).map(async (o) => {
        try {
          return { o, msgs: await bricklinkGet(`/orders/${o.order_id}/messages`, {}, creds) };
        } catch (err) {
          failed += 1;
          lastError = String(err.message || err).slice(0, 160);
          return null;
        }
      })
    );
    results.forEach((r) => {
      if (!r || !Array.isArray(r.msgs) || !r.msgs.length) return;
      withMessages += 1;
      if (!fields.length && r.msgs[0] && typeof r.msgs[0] === "object") fields = Object.keys(r.msgs[0]).sort();
      const buyer = lower(r.o.buyer_name);
      const sorted = [...r.msgs].sort((a, b) => messageTime(a) - messageTime(b));
      // Rückwärts, solange der Käufer geschrieben hat: das sind die Nachrichten seit der letzten Antwort des Shops
      let start = sorted.length;
      while (start > 0 && buyer && messageFrom(sorted[start - 1]) === buyer) start -= 1;
      if (start === sorted.length) return;
      unanswered += 1;
      sorted.slice(Math.max(start, sorted.length - MAX_OPEN_PER_ORDER)).forEach((m) => {
        const t = messageTime(m);
        items.push({ order: String(r.o.order_id), id: messageId(m) || `${r.o.order_id}-${t}`, at: t ? new Date(t).toISOString() : null });
      });
    });
  }
  if (failed >= 5 && !withMessages) throw new Error(lastError || "Nachrichten-Abfrage fehlgeschlagen");
  items.sort((a, b) => ((b.at || "") > (a.at || "") ? 1 : (b.at || "") < (a.at || "") ? -1 : 0));
  return { unanswered, items: items.slice(0, MAX_OPEN_ITEMS), checkedOrders: candidates.length, ordersWithMessages: withMessages, failed, fields };
}

export async function fetchBricklink(currentData) {
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

  // Offene Käufer-Nachrichten (zu Bestellungen). Eigener try/catch: ein Fehler hier darf Versand-Alarm und Umsatzcharts nicht mitreißen.
  // Bei einem Fehler bleibt der letzte gute Stand in data.bricklinkMessages stehen, nur lastError wird gesetzt (deepMerge in sync-all.mjs).
  if (MESSAGES_ENABLED) {
    try {
      const res = await fetchUnansweredMessages(unfiledOrders, creds);
      console.log(`[bricklink] Nachrichten: ${res.items.length} Käufer-Nachrichten ohne Antwort in ${res.unanswered} Bestellungen (${res.ordersWithMessages} von ${res.checkedOrders} geprüften Bestellungen haben Nachrichten, ${res.failed} Abfragen fehlgeschlagen).`);
      patch.bricklinkMessages = { checkedAt: new Date().toISOString(), ...res, lastError: null };
    } catch (err) {
      console.error("[bricklink] Nachrichten übersprungen:", err.message);
      patch.bricklinkMessages = { lastError: String(err.message || err).slice(0, 160), lastErrorAt: new Date().toISOString() };
    }
  }

  // Filed = archivierte/abgeschlossene Bestellungen. Für die Umsatz-Trends brauchen wir
  // auch die, sonst würden abgeschlossene Wochen/Monate als 0€ erscheinen. Eigener
  // try/catch, falls "filed" als Filter in deinem API-Zugang anders/nicht unterstützt wird —
  // dann läuft der Rest (Versand-Alarm) trotzdem weiter, nur die Umsatzcharts bleiben leer.
  try {
    const filedOrders = await bricklinkGet("/orders", { direction: "in", filed: "true" }, creds);
    console.log(`[bricklink] ${filedOrders.length} archivierte (filed) Bestellungen abgerufen.`);

    const allOrders = [...unfiledOrders, ...filedOrders];
    const seen = new Set();
    const weeksCutoff = new Date();
    weeksCutoff.setUTCDate(weeksCutoff.getUTCDate() - REVENUE_WEEKS * 7);
    const monthsCutoff = monthsAgo(REVENUE_MONTHS);
    const fetchCutoff = weeksCutoff < monthsCutoff ? weeksCutoff : monthsCutoff;

    const weeklyOrders = [];
    const monthlyOrders = [];

    allOrders.forEach((o) => {
      if (seen.has(o.order_id)) return;
      seen.add(o.order_id);
      if (NON_REVENUE_STATUSES.includes(String(o.status).toUpperCase())) return;
      const orderedAt = new Date(o.date_ordered);
      if (Number.isNaN(orderedAt.getTime()) || orderedAt < fetchCutoff) return;

      const amount = Number(o.cost?.grand_total ?? 0);
      if (orderedAt >= weeksCutoff) weeklyOrders.push({ key: isoWeekStart(orderedAt), amount });
      if (orderedAt >= monthsCutoff) monthlyOrders.push({ key: o.date_ordered.slice(0, 7), amount });
    });

    const weekly = aggregateBy(weeklyOrders, "weekStart");
    const monthly = aggregateBy(monthlyOrders, "month");
    const currency = allOrders.find((o) => o.cost?.currency_code)?.cost?.currency_code || "EUR";

    patch.bricklinkRevenue = { checkedAt: new Date().toISOString(), currency, weekly, monthly };
  } catch (err) {
    console.error("[bricklink] Umsatz-Trend übersprungen (filed-Abfrage fehlgeschlagen):", err.message);
  }

  // "100.000 Teile"-Ziel = aktueller Inventar-Bestand, unabhängig von den Bestellungen oben.
  // Eigener try/catch, damit ein Fehler hier weder den Versand-Alarm noch die Umsatzcharts
  // mitreißt (und umgekehrt) - das Ziel bleibt dann einfach beim letzten bekannten Stand.
  if (currentData?.goals?.some((g) => g.id === "bricklink-parts")) {
    try {
      const totalItems = await fetchTotalInventoryItems(creds);
      console.log(`[bricklink] ${totalItems} Teile im Inventar (Total Items).`);
      patch.goals = (patch.goals || currentData.goals).map((g) =>
        g.id === "bricklink-parts" ? { ...g, current: totalItems } : g
      );
    } catch (err) {
      console.error("[bricklink] Inventar-Teile-Summe übersprungen:", err.message);
    }
  }

  return patch;
}
