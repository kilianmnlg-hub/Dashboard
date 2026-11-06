// Holt Bestelldaten aus der Bricklink API: offene Bestellungen (für den "noch zu
// verschicken"-Alarm), Umsatz-Trends (wöchentlich und monatlich) sowie den aktuellen
// Inventar-Bestand ("Total Items" für das 100.000-Teile-Ziel) und daraus die Lager-Zahlen
// fürs Shop-Radar (Lots, Wert, Alter, neu eingestellt; nur Zahlen, siehe lib/inventory.mjs).
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
// geöffnet wurden, merkt sich das Dashboard selbst (msgseen.js). Von Käufern werden nur Zahlen,
// Nummern und Zeitpunkte gespeichert, nie Inhalte, Namen oder Adressen (auch nicht im privaten Repo).
// Artikeldaten (keine Kundendaten) stehen nur in drei kurzen Listen fürs Shop-Radar: die zehn Ladenhüter (data.bricklinkInventory.slow), die
// meistverkauften Artikel je Monat (data.bricklinkSales) und die Lots mit starker Preisabweichung (data.bricklinkPrices). Das Protokoll (öffentliches Repo) bleibt frei davon.

import { buildAuthHeader } from "../lib/oauth1.mjs";
import { summarizeInventory } from "../lib/inventory.mjs";
import { summarizeSales } from "../lib/sales.mjs";
import { DEFAULTS as PRICE_DEFAULTS, evaluate, mergeRows, pickEligible, pickSlice } from "../lib/pricecheck.mjs";
import { parseGuide } from "../lib/lego.mjs";

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

// Bestseller pro Monat (Shop-Radar): je Bestellung seit Beginn der Monatsliste ein Aufruf GET /orders/{id}/items (rund 100 pro Lauf, das Tageslimit liegt bei 5.000).
// BRICKLINK_SALES=off schaltet das ab.
const SALES_ENABLED = String(process.env.BRICKLINK_SALES || "on").toLowerCase() !== "off";

// Preis-Check (Shop-Radar, siehe lib/pricecheck.mjs): je Lot eine Abfrage des Price Guide (Verkaeufe der letzten 6 Monate), in Etappen von hoechstens BRICKLINK_PRICE_CAP Abfragen
// am Tag (ein voller Durchlauf dauert so mehrere Tage) und nur einmal am Tag, auch wenn der Sync oefter laeuft. Nur Lots ab BRICKLINK_PRICE_MIN_VALUE Euro Warenwert,
// Abweichung ab BRICKLINK_PRICE_DEV Prozent, Region BRICKLINK_PRICE_REGION; hoechstens BRICKLINK_PRICE_MINUTES Minuten. BRICKLINK_PRICECHECK=off schaltet das ab.
const PRICE_ENABLED = String(process.env.BRICKLINK_PRICECHECK || "on").toLowerCase() !== "off";
const PRICE_REGION = process.env.BRICKLINK_PRICE_REGION || "europe";
const PRICE_CAP = Number(process.env.BRICKLINK_PRICE_CAP || PRICE_DEFAULTS.cap);
const PRICE_MIN_VALUE = Number(process.env.BRICKLINK_PRICE_MIN_VALUE || PRICE_DEFAULTS.minValue);
const PRICE_DEV = Number(process.env.BRICKLINK_PRICE_DEV || PRICE_DEFAULTS.minDev);
const PRICE_MINUTES = Number(process.env.BRICKLINK_PRICE_MINUTES || 10);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Alle Abrufe: Zeitlimit (25 s) und bis zu drei Versuche mit Wartezeit bei 429, 5xx, Zeitüberschreitung, Netzfehler und einer Webseite statt Daten (kurze Störung bei Bricklink).
// Fachliche Fehler (z.B. 404 "gibt es nicht") werden nicht wiederholt, err.status nennt den Code. Nach 5 solchen Fehlschlägen in Folge gibt es keine Wiederholungen mehr:
// Bricklink ist dann wohl länger gestört, und nicht jede weitere Abfrage soll minutenlang warten. Die Wartezeiten lassen sich für Prüfungen mit BRICKLINK_RETRY_WAITS ändern.
const WAITS = (process.env.BRICKLINK_RETRY_WAITS || "4000,15000").split(",").map(Number);
const PRICE_WAITS = [1500, 3000]; // die vielen Abfragen des Preis-Checks warten kürzer
let failedInRow = 0;
async function bricklinkRequest(path, queryParams, creds, waits) {
  const tries = failedInRow >= 5 ? 1 : waits.length + 1;
  let last;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const url = `${BASE_URL}${path}`;
      const qs = new URLSearchParams(queryParams).toString();
      const authHeader = buildAuthHeader({ method: "GET", url, queryParams, ...creds });
      const res = await fetch(qs ? `${url}?${qs}` : url, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(25000) });
      const body = await res.text();
      if (res.status >= 500 || res.status === 429) throw Object.assign(new Error(`Bricklink API Fehler ${res.status}`), { retry: true, status: res.status });
      let json;
      try {
        json = JSON.parse(body);
      } catch (e) {
        // Damit im Protokoll steht, was für eine Seite das war (Wartung, Sperre, Anmeldung): HTTP-Code und Titel, sonst nichts aus der Antwort
        const title = (/<title[^>]*>([^<]{0,80})/i.exec(body) || [])[1];
        throw Object.assign(new Error(`${res.ok ? "Bricklink antwortet mit einer Webseite statt Daten" : "Bricklink API Fehler"} (HTTP ${res.status}${title ? `, Titel „${title.trim()}“` : ""})`), { retry: true, status: res.status });
      }
      if (!res.ok) throw Object.assign(new Error(`Bricklink API Fehler ${res.status}: ${body.slice(0, 160)}`), { status: res.status });
      if (json.meta?.code >= 300) throw Object.assign(new Error(`Bricklink API Fehler ${json.meta.code}: ${json.meta.message || ""}`), { status: json.meta.code });
      failedInRow = 0;
      return json.data;
    } catch (err) {
      last = err;
      if (!(err.retry || err.name === "TimeoutError" || err.name === "TypeError")) {
        failedInRow = 0; // Bricklink hat sauber geantwortet (nur eben mit einem Fehler): erreichbar
        throw err;
      }
      if (attempt < tries - 1) await sleep(waits[attempt] || 1000);
    }
  }
  failedInRow += 1;
  throw last;
}
const bricklinkGet = (path, queryParams, creds) => bricklinkRequest(path, queryParams, creds, WAITS);
const bricklinkGetRetry = (path, queryParams, creds) => bricklinkRequest(path, queryParams, creds, PRICE_WAITS);

// Preis-Check: die heutige Etappe der Lots (Teile und Minifiguren) gegen den 6-Monats-Schnitt pruefen und mit den noch gueltigen Zeilen der letzten Tage zusammenfuehren.
// Liefert null, wenn es heute schon lief. Fehlt ein Preis (404/400) zaehlt das Lot als geprueft ohne Ergebnis; bei vielen echten Fehlern (429, 5xx, Zeit) bricht die Etappe ab
// (aborted), behaelt aber, was bis dahin da ist, und darf am selben Tag noch einmal laufen.
async function fetchPriceCheck(lots, previous, currency, creds, now) {
  const today = now.toISOString().slice(0, 10);
  if (previous && previous.day === today && !previous.aborted) return null;
  const eligible = pickEligible(lots, { minValue: PRICE_MIN_VALUE });
  const { cycleDays, slice } = pickSlice(eligible, { cap: PRICE_CAP, dayNumber: Math.floor(now.getTime() / 86400000) });
  const fresh = [];
  const checkedIds = new Set();
  let withData = 0, failed = 0, aborted = false;
  const deadline = Date.now() + PRICE_MINUTES * 60000;
  const BATCH = 4;
  for (let i = 0; i < slice.length; i += BATCH) {
    if (Date.now() > deadline) { aborted = true; break; }
    const results = await Promise.all(
      slice.slice(i, i + BATCH).map(async (c) => {
        const params = { guide_type: "sold", new_or_used: c.cond, region: PRICE_REGION, currency_code: currency };
        if (c.t === "PART") params.color_id = String(c.color);
        try {
          return { c, g: parseGuide(await bricklinkGetRetry(`/items/${c.t}/${encodeURIComponent(c.no)}/price`, params, creds)) };
        } catch (err) {
          if (err.status === 404 || err.status === 400) return { c, g: null };
          failed += 1;
          return { c, bad: true };
        }
      })
    );
    results.forEach(({ c, g, bad }) => {
      if (bad) return;
      checkedIds.add(c.id);
      if (g && g.value) withData += 1;
      const row = evaluate(c, g, { minDev: PRICE_DEV, day: today });
      if (row) fresh.push(row);
    });
    if (failed >= 8 && failed > checkedIds.size * 0.1) { aborted = true; break; }
    await sleep(150);
  }
  // Blieb mehr als jedes zehnte Lot ohne Antwort (Fehler, Zeit), gilt die Etappe als unvollständig und darf heute noch einmal laufen
  if (slice.length && checkedIds.size < slice.length * 0.9) aborted = true;
  const merged = mergeRows({ previous: [...(previous?.over || []), ...(previous?.under || [])], fresh, eligible, checkedIds });
  return {
    day: today, aborted, checkedAt: now.toISOString(), region: PRICE_REGION, currency,
    eligible: eligible.length, cycleDays, checked: checkedIds.size, withData, minDev: PRICE_DEV, minSales: PRICE_DEFAULTS.minSales, minValue: PRICE_MIN_VALUE,
    over: merged.over, under: merged.under
  };
}

// Montag der ISO-Woche, in der `date` liegt, als "YYYY-MM-DD".
function isoWeekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

// Kalendermonate zurückrechnen (nicht nur Tage), damit "6 Monate" wirklich 6 Kalendermonate sind. Beginn ist der 1. des Monats,
// sonst wäre der älteste Monat nur zum Teil gezählt (und sein Ø Warenkorb im Shop-Radar zu klein).
function monthsAgo(n) {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1));
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
async function fetchInventory(creds) {
  const inventory = await bricklinkGet("/inventories", {}, creds);
  return Array.isArray(inventory) ? inventory : [];
}

// Positionen der Bestellungen: orderList = [{ id, month }]. Die API liefert je Bestellung Gruppen von Positionen (Array von Arrays); hier flach.
// Kleine Gruppen nacheinander; wenn mehr als jede zehnte Abfrage (mindestens 3) fehlschlägt, gilt der Lauf als misslungen und der letzte Stand bleibt stehen.
async function fetchOrderItems(orderList, creds) {
  const out = [];
  let failed = 0, lastError = "";
  const BATCH = 4;
  for (let i = 0; i < orderList.length; i += BATCH) {
    const results = await Promise.all(
      orderList.slice(i, i + BATCH).map(async (o) => {
        try {
          const data = await bricklinkGet(`/orders/${o.id}/items`, {}, creds);
          return { month: o.month, items: (Array.isArray(data) ? data : []).flatMap((g) => (Array.isArray(g) ? g : [g])) };
        } catch (err) {
          failed += 1;
          lastError = String(err.message || err).slice(0, 160);
          return null;
        }
      })
    );
    results.forEach((r) => { if (r) out.push(r); });
    if (failed > Math.max(3, Math.floor(orderList.length * 0.1))) break;
  }
  if (failed > Math.max(3, Math.floor(orderList.length * 0.1))) throw new Error(`${failed} von ${orderList.length} Abfragen fehlgeschlagen: ${lastError}`);
  return out;
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
  // Die Ausgabe landet im Protokoll eines OEFFENTLICHEN Repos (Actions): hier und unten bewusst keine Zahlen aus dem Shop, nur "abgerufen".
  console.log("[bricklink] Offene (unfiled) Bestellungen abgerufen.");

  const pendingShipments = unfiledOrders
    .filter((o) => shipStatuses.includes(String(o.status).toUpperCase()))
    // Bewusst KEINE Kundendaten (kein Name, keine Adresse, kein Betrag, hier auch keine Bestellnummer): das Dashboard braucht nur die Anzahl und den Bestelltag.
    .map((o) => ({
      status: o.status,
      orderedDate: String(o.date_ordered || "").slice(0, 10)
    }))
    .sort((a, b) => String(a.orderedDate).localeCompare(String(b.orderedDate)));

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
      console.log(`[bricklink] Nachrichten abgerufen${res.failed ? ` (${res.failed} Abfragen fehlgeschlagen)` : ""}.`);
      patch.bricklinkMessages = { checkedAt: new Date().toISOString(), ...res, lastError: null };
    } catch (err) {
      console.error("[bricklink] Nachrichten übersprungen:", err.message);
      patch.bricklinkMessages = { lastError: String(err.message || err).slice(0, 160), lastErrorAt: new Date().toISOString() };
    }
  }

  // Bestellungen, deren Positionen für die Bestseller gebraucht werden (gleiche Auswahl wie die Monatsliste: nicht storniert, seit Beginn der Monatsliste)
  const salesOrders = [];

  // Filed = archivierte/abgeschlossene Bestellungen. Für die Umsatz-Trends brauchen wir
  // auch die, sonst würden abgeschlossene Wochen/Monate als 0€ erscheinen. Eigener
  // try/catch, falls "filed" als Filter in deinem API-Zugang anders/nicht unterstützt wird —
  // dann läuft der Rest (Versand-Alarm) trotzdem weiter, nur die Umsatzcharts bleiben leer.
  try {
    const filedOrders = await bricklinkGet("/orders", { direction: "in", filed: "true" }, creds);
    console.log("[bricklink] Archivierte (filed) Bestellungen abgerufen.");

    const allOrders = [...unfiledOrders, ...filedOrders];
    const seen = new Set();
    // Beginn jeweils am Montag der ältesten Woche (nicht mitten in der Woche), damit auch die älteste Woche vollständig ist
    const weeksCutoff = new Date(`${isoWeekStart(new Date(Date.now() - REVENUE_WEEKS * 7 * 86400000))}T00:00:00Z`);
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
      if (orderedAt >= monthsCutoff) {
        monthlyOrders.push({ key: o.date_ordered.slice(0, 7), amount });
        salesOrders.push({ id: o.order_id, month: o.date_ordered.slice(0, 7) });
      }
    });

    const weekly = aggregateBy(weeklyOrders, "weekStart");
    const monthly = aggregateBy(monthlyOrders, "month");
    const currency = allOrders.find((o) => o.cost?.currency_code)?.cost?.currency_code || "EUR";

    // weeklyFrom/monthlyFrom: ab wann die Listen vollständig sind (Wochen und Monate ohne Bestellung fehlen in weekly/monthly, sind aber keine Lücke)
    patch.bricklinkRevenue = {
      checkedAt: new Date().toISOString(), currency, weekly, monthly,
      weeklyFrom: weeksCutoff.toISOString().slice(0, 10), monthlyFrom: monthsCutoff.toISOString().slice(0, 7)
    };
  } catch (err) {
    console.error("[bricklink] Umsatz-Trend übersprungen (filed-Abfrage fehlgeschlagen):", err.message);
  }

  // Inventar (EIN Aufruf für beides): die Teile-Summe fürs "100.000 Teile"-Ziel und die Lager-Zahlen fürs Shop-Radar (data.bricklinkInventory: Lots,
  // Wert, Alter, neu eingestellt, siehe lib/inventory.mjs). Unabhängig von den Bestellungen oben und mit eigenem try/catch, damit ein Fehler hier weder
  // den Versand-Alarm noch die Umsatzcharts mitreißt (und umgekehrt) - Ziel und Lager bleiben dann einfach beim letzten bekannten Stand.
  try {
    const lots = await fetchInventory(creds);
    // Eine leere Antwort ist bei einem laufenden Shop eher ein Aussetzer der API als Wirklichkeit: nichts überschreiben
    if (!lots.length) throw new Error("Inventar-Antwort war leer");
    console.log("[bricklink] Inventar abgerufen.");
    if (currentData?.goals?.some((g) => g.id === "bricklink-parts")) {
      const totalItems = lots.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
      patch.goals = (patch.goals || currentData.goals).map((g) =>
        g.id === "bricklink-parts" ? { ...g, current: totalItems } : g
      );
    }
    patch.bricklinkInventory = summarizeInventory(lots, {
      currency: patch.bricklinkRevenue?.currency,
      previousWeekly: currentData?.bricklinkInventory?.weekly
    });
    // Preis-Check (eigener try/catch: ein Fehler hier lässt das Lager stehen)
    if (PRICE_ENABLED) {
      try {
        const res = await fetchPriceCheck(lots, currentData?.bricklinkPrices, patch.bricklinkRevenue?.currency || "EUR", creds, new Date());
        console.log(res ? "[bricklink] Preis-Check abgerufen." : "[bricklink] Preis-Check lief heute schon.");
        if (res) patch.bricklinkPrices = res;
      } catch (err) {
        console.error("[bricklink] Preis-Check übersprungen:", err.message);
      }
    }
  } catch (err) {
    console.error("[bricklink] Inventar übersprungen:", err.message);
  }

  // Farbnamen für die Listen (die Inventar-Antwort kennt nur die Farbnummer): ein Aufruf, bei einem Fehler zeigt das Radar die Nummer
  const needColors = [patch.bricklinkInventory?.slow, patch.bricklinkPrices?.over, patch.bricklinkPrices?.under].filter((l) => Array.isArray(l) && l.length);
  if (needColors.length) {
    try {
      const colors = await bricklinkGet("/colors", {}, creds);
      const byId = new Map((Array.isArray(colors) ? colors : []).map((c) => [Number(c.color_id), String(c.color_name || "").slice(0, 40)]));
      needColors.forEach((list) => list.forEach((s) => { s.colorName = byId.get(s.color) || ""; }));
      console.log("[bricklink] Farbnamen abgerufen.");
    } catch (err) {
      console.error("[bricklink] Farbnamen übersprungen:", err.message);
    }
  }

  // Bestseller pro Monat (data.bricklinkSales, siehe lib/sales.mjs): eigener try/catch, bei einem Fehler bleibt der letzte Stand stehen
  if (SALES_ENABLED && salesOrders.length) {
    try {
      const withItems = await fetchOrderItems(salesOrders, creds);
      console.log("[bricklink] Positionen der Bestellungen abgerufen.");
      patch.bricklinkSales = summarizeSales(withItems, { currency: patch.bricklinkRevenue?.currency });
    } catch (err) {
      console.error("[bricklink] Bestseller übersprungen:", err.message);
    }
  }

  return patch;
}
