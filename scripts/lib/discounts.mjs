// Rabatt-Wache (Shop-Radar): Welche Lots haben einen eigenen Rabatt (sale_rate, "Sale" in Prozent) und seit wann? Bricklink nennt kein Startdatum fuer einen Rabatt. Darum merkt sich
// das Dashboard, seit wann es den Rabatt sieht (data.bricklinkDiscounts, gepflegt von der regelmaessigen Kontrolle des Preis-Checks und vom Tages-Sync). Wurde der Rabatt ueber das
// Dashboard gesetzt (RABATT SETZEN), steht das genaue Datum im Protokoll der Aenderungen (bricklink-price-changes.json im privaten Repo) und wird uebernommen ("known").
// Ist ein Lot laenger als ALERT_DAYS im Rabatt, meldet das der Push-Worker einmal aufs Handy und das Dashboard zeigt oben einen Hinweis (bis er als gesehen markiert ist).
// Reine Funktionen ohne Node-Abhaengigkeiten, damit sie sich im Browser pruefen lassen (wie lib/pricecheck.mjs).

export const ALERT_DAYS = 14;
export const MAX_ITEMS = 300;
// Ein Eintrag im Protokoll der Aenderungen zaehlt als Startdatum nur, wenn er nicht aelter als so viele Tage ist (sonst koennte der Rabatt inzwischen weg und neu gesetzt sein)
const HISTORY_DAYS = 90;

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round4 = (n) => Math.round(n * 10000) / 10000;
const dayMinus = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

// Wann wurde der Rabatt eines Lots zuletzt ueber das Dashboard begonnen (von 0 auf mehr als 0 %)? Map Lot-Nummer -> { day, qty }
export function startsFromHistory(history, today) {
  const out = new Map();
  const cut = today ? dayMinus(today, HISTORY_DAYS) : "";
  for (const c of Array.isArray(history) ? history : []) {
    if (!c || c.kind !== "sale" || c.result !== "ok") continue;
    const id = num(c.id), after = num(c.saleAfter), before = num(c.saleBefore), day = String(c.at || "").slice(0, 10);
    if (id === null || !/^\d{4}-\d{2}-\d{2}$/.test(day) || day < cut) continue;
    if (after > 0 && !(before > 0)) out.set(id, { day, qty: num(c.qty) });
    else if (!(after > 0)) out.delete(id); // Rabatt ueber das Dashboard wieder entfernt
  }
  return out;
}

// Die aktuelle Liste: alle Lots im Shop (nicht Stockroom, Menge ueber 0) mit Rabatt, aelteste zuerst. previous = bisheriger Stand (data.bricklinkDiscounts), history = Protokoll
// der Aenderungen, today = "JJJJ-MM-TT". Jeder Eintrag: { id, t, no, name, color, cond, sale, price (Listenpreis), qty, qty0 (Menge zu Beginn), since, known }.
export function trackDiscounts({ lots, previous, history, today, max = MAX_ITEMS } = {}) {
  const prev = new Map();
  for (const i of previous && Array.isArray(previous.items) ? previous.items : []) if (i && num(i.id) !== null) prev.set(num(i.id), i);
  const starts = startsFromHistory(history, today);
  const items = [];
  for (const lot of Array.isArray(lots) ? lots : []) {
    const id = num(lot && lot.inventory_id), sale = num(lot && lot.sale_rate), qty = num(lot && lot.quantity), price = num(lot && lot.unit_price);
    if (id === null || !(sale > 0) || sale >= 100 || !(qty > 0) || !(price > 0)) continue;
    if (lot.is_stock_room === true || lot.is_stock_room === "true") continue;
    const item = lot.item || {}, t = String(item.type || "").toUpperCase();
    const p = prev.get(id), h = starts.get(id);
    let since = today, known = false, qty0 = qty;
    if (p && typeof p.since === "string") { since = p.since; known = p.known === true; qty0 = num(p.qty0) !== null ? num(p.qty0) : qty; }
    // Das Protokoll kennt den genauen Beginn: gilt, wenn das Lot neu in der Liste ist oder der bisherige Beginn nur geschaetzt war
    if (h && (!p || !known || h.day < since)) { since = h.day; known = true; if (h.qty !== null && h.qty >= qty) qty0 = h.qty; }
    // colorName steht immer an derselben Stelle (leer, bis der Name bekannt ist): so bleibt der Vergleich mit dem letzten Stand stabil
    const color = t === "PART" ? num(lot.color_id) || 0 : 0;
    items.push({
      id, t, no: String(item.no || ""), name: String(item.name || "").slice(0, 120), color, colorName: p && p.colorName && p.color === color ? p.colorName : "",
      cond: String(lot.new_or_used || "").toUpperCase(), sale, price: round4(price), qty, qty0: Math.max(qty0, qty), since, known
    });
  }
  items.sort((a, b) => (a.since < b.since ? -1 : a.since > b.since ? 1 : a.id - b.id));
  return { alertDays: ALERT_DAYS, items: items.slice(0, max) };
}

// Die Lots, die heute laenger als alertDays im Rabatt sind
export function dueDiscounts(items, today, alertDays = ALERT_DAYS) {
  const cut = dayMinus(today, alertDays);
  return (Array.isArray(items) ? items : []).filter((i) => i && typeof i.since === "string" && i.since <= cut);
}
