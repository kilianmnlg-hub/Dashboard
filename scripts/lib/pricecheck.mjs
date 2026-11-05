// Preis-Check (Shop-Radar): vergleicht die Preise deiner Teile und Minifiguren mit dem Durchschnitt der Bricklink-Verkaeufe der letzten 6 Monate
// (Price Guide "sold", wie beim Wert der LEGO-Sammlung: nach Stueckzahl gewichtet, siehe lib/lego.mjs parseGuide). Gespeichert wird spaeter data.bricklinkPrices:
// nur die Lots mit starker Abweichung (Artikeldaten, keine Kundendaten). Im Protokoll (oeffentliches Repo) steht nichts davon.
// Reine Funktionen ohne Node-Abhaengigkeiten, damit sie sich auch im Browser testen lassen (wie lib/uploads.mjs); die Abfragen selbst stehen in scripts/fetchers/bricklink.mjs.
//
// Bricklink erlaubt nur begrenzt viele Abfragen am Tag (5.000) und fuer den Vergleich ist je Lot eine noetig. Darum wird in Etappen geprueft: Es zaehlen nur Teile und
// Minifiguren im Shop (nicht Stockroom) mit mindestens minValue Warenwert; ein voller Durchlauf braucht ceil(Lots / cap) Tage, und heute kommt der Teil an die Reihe, dessen
// Lot-Nummer (inventory_id) zum Tag passt. So ist der Plan ohne gespeicherten Stand eindeutig. Ergebnisse vorheriger Tage bleiben stehen, solange das Lot noch da ist und
// seinen Preis nicht geaendert hat (mergeRows).

export const MAX_ROWS = 30;
export const DEFAULTS = { minValue: 1, cap: 1500, minDev: 30, minSales: 3, minDiff: 0.5 };

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

// Teile und Minifiguren im Shop mit Preis und Zustand und mindestens minValue Warenwert (Preis nach Abzug eines eigenen Rabatts)
export function pickEligible(lots, { minValue = DEFAULTS.minValue } = {}) {
  const out = [];
  for (const lot of Array.isArray(lots) ? lots : []) {
    const item = lot && lot.item;
    const qty = num(lot && lot.quantity);
    const t = String((item && item.type) || "").toUpperCase();
    if (!(qty > 0) || (t !== "PART" && t !== "MINIFIG") || !item.no) continue;
    if (lot.is_stock_room === true || lot.is_stock_room === "true") continue;
    const cond = String(lot.new_or_used || "").toUpperCase();
    if (cond !== "N" && cond !== "U") continue;
    const list = num(lot.unit_price), sale = num(lot.sale_rate), id = num(lot.inventory_id);
    if (!(list > 0) || id === null) continue;
    const price = list * (sale !== null && sale > 0 && sale < 100 ? 1 - sale / 100 : 1);
    if (qty * price < minValue) continue;
    out.push({ id, t, no: String(item.no), name: String(item.name || "").slice(0, 120), color: t === "PART" ? num(lot.color_id) || 0 : 0, cond, qty, price });
  }
  return out;
}

// Heute zu pruefender Teil: ein voller Durchlauf dauert cycleDays Tage; dayNumber = Tage seit 1970 (UTC)
export function pickSlice(eligible, { cap = DEFAULTS.cap, dayNumber = 0 } = {}) {
  const cycleDays = Math.max(1, Math.ceil(eligible.length / Math.max(1, cap)));
  return { cycleDays, slice: eligible.filter((c) => c.id % cycleDays === dayNumber % cycleDays) };
}

// Eine Zeile oder null: guide = parseGuide(...) mit value (Durchschnitt) und lots (Zahl der Verkaeufe). Abweichung dev in Prozent (+ = dein Preis liegt darueber),
// diff = Unterschied fuer das ganze Lot in der Waehrung des Shops. Zu wenige Verkaeufe, zu kleine Abweichung oder ein zu kleiner Unterschied: keine Zeile.
export function evaluate(c, guide, { minDev = DEFAULTS.minDev, minSales = DEFAULTS.minSales, minDiff = DEFAULTS.minDiff, day = "" } = {}) {
  if (!guide || !(guide.value > 0) || !(guide.lots >= minSales)) return null;
  const dev = (c.price / guide.value - 1) * 100;
  if (Math.abs(dev) < minDev) return null;
  const diff = c.qty * (c.price - guide.value);
  if (Math.abs(diff) < minDiff) return null;
  return { id: c.id, t: c.t, no: c.no, name: c.name, color: c.color, cond: c.cond, qty: c.qty, price: round4(c.price), avg: round4(guide.value), n: guide.lots, dev: Math.round(dev), diff: round2(diff), day };
}

// Fuehrt die neuen Zeilen (heute geprueft) mit den noch gueltigen vom letzten Mal zusammen: previous = bisherige over + under, eligible = ALLE heute infrage kommenden Lots
// (zur Pruefung, ob ein Lot noch da ist und denselben Preis hat), checkedIds = heute geprueft (deren alte Zeile ersetzt das neue Ergebnis oder entfaellt).
export function mergeRows({ previous = [], fresh = [], eligible = [], checkedIds = new Set(), max = MAX_ROWS } = {}) {
  const byId = new Map(eligible.map((c) => [c.id, c]));
  const kept = [];
  for (const r of previous) {
    if (!r || checkedIds.has(r.id)) continue;
    const c = byId.get(r.id);
    if (!c || Math.abs(c.price - r.price) > 0.00005) continue;
    kept.push({ ...r, qty: c.qty, diff: round2(c.qty * (c.price - r.avg)) });
  }
  const all = fresh.concat(kept);
  const byImpact = (a, b) => Math.abs(b.diff) - Math.abs(a.diff);
  return { over: all.filter((r) => r.dev > 0).sort(byImpact).slice(0, max), under: all.filter((r) => r.dev < 0).sort(byImpact).slice(0, max) };
}
