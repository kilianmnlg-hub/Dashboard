// Reine Rechen- und Aufbereitungsfunktionen fuer die LEGO-Sammlung (scripts/lego-prices.mjs). Bewusst ohne Node-Abhaengigkeiten,
// damit sie sich auch im Browser pruefen lassen.
//
// Wert eines Sets = Durchschnitt der Bricklink-Verkaeufe der letzten 6 Monate (neu, Europa, mit MwSt.). Gibt es weniger als MIN_SALES
// Verkaeufe, zaehlen stattdessen die aktuellen Angebote (Mittel der guenstigsten 5), dann steht im Dashboard ein Warnzeichen dabei.

export const DAY_MS = 86400000;
export const MIN_SALES = 3;
export const CHEAPEST_OFFERS = 5;

const num = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
export const round2 = (n) => Math.round(n * 100) / 100;
export const dayKey = (ms) => new Date(ms).toISOString().slice(0, 10);
const dayMs = (key) => Date.parse(key + "T00:00:00Z");

// "75331" -> "75331-1", "75192-1" bleibt, alles andere -> null. Bricklink fuehrt Sets immer mit Variante (-1, -2 ...).
export function normSetNo(input) {
  const s = String(input == null ? "" : input).trim().replace(/^#/, "").replace(/\s+/g, "");
  const m = /^([A-Za-z0-9]{2,14})(?:-(\d{1,2}))?$/.exec(s);
  if (!m || !/\d/.test(m[1])) return null;
  return m[1] + "-" + (m[2] || "1");
}

// Antwort von GET /items/SET/{no}/price auswerten. Preise kommen als Text ("812.5000"), Verkaeufe haben ein Datum (date_ordered).
// value = nach Stueckzahl gewichteter Durchschnitt (qty_avg_price), sonst Durchschnitt, sonst aus den Einzelposten gerechnet.
export function parseGuide(data) {
  const d = data && typeof data === "object" ? data : {};
  const details = (Array.isArray(d.price_detail) ? d.price_detail : [])
    .map((x) => ({
      p: num(x && x.unit_price),
      q: Math.max(1, parseInt(x && x.quantity, 10) || 1),
      d: x && typeof x.date_ordered === "string" ? x.date_ordered.slice(0, 10) : ""
    }))
    .filter((x) => x.p !== null && x.p > 0);
  const lotsReported = num(d.unit_quantity);
  const lots = lotsReported !== null && lotsReported > 0 ? Math.round(lotsReported) : details.length;
  let value = num(d.qty_avg_price);
  if (!(value > 0)) value = num(d.avg_price);
  if (!(value > 0) && details.length) value = weightedMean(details);
  let min = num(d.min_price);
  let max = num(d.max_price);
  if (!(min > 0) && details.length) min = Math.min(...details.map((x) => x.p));
  if (!(max > 0) && details.length) max = Math.max(...details.map((x) => x.p));
  return { lots, value: value > 0 ? value : null, min: min > 0 ? min : null, max: max > 0 ? max : null, details };
}

function weightedMean(list) {
  let sum = 0;
  let qty = 0;
  list.forEach((x) => {
    sum += x.p * x.q;
    qty += x.q;
  });
  return qty ? sum / qty : null;
}

// Mittel der guenstigsten Angebote (ein paar teure Ausreisser sollen den Wert nicht hochziehen)
export function cheapestMean(details, n = CHEAPEST_OFFERS) {
  const prices = (details || []).map((x) => x.p).sort((a, b) => a - b).slice(0, n);
  return prices.length ? prices.reduce((s, p) => s + p, 0) / prices.length : null;
}

// Aus Verkaufs- und Angebotsstatistik den Wert fuer das Dashboard waehlen.
// Ergebnis: { val, src: "sold" | "stock", sales, min, max, offers, from } oder null, wenn es gar keinen Preis gibt.
export function chooseValue(sold, stock) {
  const s = sold && sold.value ? sold : null;
  const o = stock && (stock.value || stock.details.length) ? stock : null;
  const base = {
    sales: sold ? sold.lots : 0,
    min: s && s.min ? round2(s.min) : null,
    max: s && s.max ? round2(s.max) : null,
    offers: o ? o.lots : 0,
    from: o && o.min ? round2(o.min) : null
  };
  if (s && s.lots >= MIN_SALES) return { val: round2(s.value), src: "sold", ...base };
  const offerValue = o ? cheapestMean(o.details) || o.value : null;
  if (offerValue) return { val: round2(offerValue), src: "stock", ...base };
  if (s) return { val: round2(s.value), src: "sold", ...base };
  return null;
}

// Verlauf = Liste [Tag, Wert], aufsteigend, ein Eintrag je Tag
export function addPoint(history, day, value) {
  const h = (Array.isArray(history) ? history : []).filter((p) => p && p[0] !== day);
  h.push([day, round2(value)]);
  h.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return h;
}

// Erster Lauf eines Sets: aus den Einzelverkaeufen der letzten Monate Werte im 30-Tage-Raster zurueckrechnen (Mittel der Verkaeufe
// im Fenster +-45 Tage um den Stichtag, mindestens 2 Verkaeufe). So hat der Verlauf gleich eine Vorgeschichte.
export function backfill(details, today) {
  const t0 = dayMs(today);
  const lots = (details || []).filter((x) => x.d);
  const out = [];
  for (let k = 6; k >= 1; k--) {
    const t = t0 - k * 30 * DAY_MS;
    const near = lots.filter((x) => Math.abs(dayMs(x.d) - t) <= 45 * DAY_MS);
    if (near.length < 2) continue;
    out.push([dayKey(t), round2(weightedMean(near))]);
  }
  return out;
}

// Ab 150 Tagen Alter reicht ein Punkt je Woche (der letzte der Woche); haelt die Datei klein.
export function compactHistory(history, today, keepDays = 150, maxPoints = 1500) {
  const limit = dayMs(today) - keepDays * DAY_MS;
  const recent = [];
  const weeks = new Map();
  (Array.isArray(history) ? history : []).forEach((p) => {
    if (!p || typeof p[0] !== "string") return;
    const t = dayMs(p[0]);
    if (!(t < limit)) {
      recent.push(p);
      return;
    }
    const wd = new Date(t).getUTCDay() || 7;
    const key = dayKey(t - (wd - 1) * DAY_MS);
    const cur = weeks.get(key);
    if (!cur || cur[0] < p[0]) weeks.set(key, p);
  });
  const all = [...weeks.values(), ...recent].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return all.length > maxPoints ? all.slice(all.length - maxPoints) : all;
}

// Wie viele Stueck eines Sets besitzt du noch? (gekauft minus verkauft)
export function ownedQty(set) {
  const sum = (list) => (Array.isArray(list) ? list : []).reduce((s, x) => s + (Math.max(0, Math.floor(+x.q || 0)) || 0), 0);
  return Math.max(0, sum(set && set.buys) - sum(set && set.sold));
}
