// Shop-Radar (Lager): macht aus der Inventar-Antwort der Bricklink-API (GET /inventories, ein Eintrag je Lot) NUR Zahlen. Gespeichert wird später
// data.bricklinkInventory; Artikelnummern, Namen und Einzelpreise der Lots verlassen diese Funktion nicht, im Protokoll (öffentliches Repo) steht keine Zahl.
// Reine Funktionen ohne Node-Abhängigkeiten, damit sie sich auch im Browser testen lassen (wie lib/uploads.mjs).
//
// Gezählt werden Lots mit Stückzahl > 0. Ein Lot im Stockroom (is_stock_room) ist für Käufer unsichtbar und steht getrennt (stockroomLots/-Parts).
// Der Wert ist der VERKAUFSwert: Stückzahl mal Preis je Stück (unit_price), bei einem Rabatt (sale_rate in %) abzüglich. Alter und "neu eingestellt"
// kommen aus date_created, dem Erstelldatum des Lots; wer Lots ersetzt statt aktualisiert, setzt es zurück. Fehlt ein Feld in der Antwort, bleibt die
// Zahl weg (null) statt erfunden zu werden.

const DAY_MS = 86400000;
export const INVENTORY_WEEKS = 12;

// Montag der ISO-Woche, in der `date` liegt (UTC), als "YYYY-MM-DD".
function weekStart(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  if (day !== 1) d.setUTCDate(d.getUTCDate() - (day - 1));
  return d.toISOString().slice(0, 10);
}

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};

// lots: Array aus der API. previousWeekly: das bisherige bricklinkInventory.weekly (für "höchster je gesehener Wert", siehe unten).
export function summarizeInventory(lots, { now = new Date(), currency = "EUR", previousWeekly = [] } = {}) {
  const nowMs = now.getTime();
  const weekKeys = [];
  for (let i = INVENTORY_WEEKS - 1; i >= 0; i--) weekKeys.push(weekStart(new Date(nowMs - i * 7 * DAY_MS)));
  const listedByWeek = Object.fromEntries(weekKeys.map((k) => [k, 0]));

  const out = {
    checkedAt: now.toISOString(),
    currency: currency || "EUR",
    lots: 0, parts: 0, value: 0,
    newLots: 0, usedLots: 0,
    stockroomLots: 0, stockroomParts: 0,
    newLots30: 0,
    lastListed: null,
    age: { d30: 0, d90: 0, d365: 0, older: 0, unknown: 0 },
    weekly: []
  };
  let sawPrice = false, sawDate = false, latest = 0;

  for (const lot of Array.isArray(lots) ? lots : []) {
    const qty = num(lot && lot.quantity);
    if (!(qty > 0)) continue;
    if (lot.is_stock_room === true || lot.is_stock_room === "true") {
      out.stockroomLots += 1;
      out.stockroomParts += qty;
      continue;
    }
    out.lots += 1;
    out.parts += qty;
    const cond = String(lot.new_or_used || "").toUpperCase();
    if (cond === "N") out.newLots += 1;
    else if (cond === "U") out.usedLots += 1;

    const price = num(lot.unit_price);
    if (price !== null) {
      sawPrice = true;
      const sale = num(lot.sale_rate);
      out.value += qty * price * (sale !== null && sale > 0 && sale < 100 ? 1 - sale / 100 : 1);
    }

    const created = Date.parse(lot.date_created || "");
    if (Number.isFinite(created)) {
      sawDate = true;
      const days = (nowMs - created) / DAY_MS;
      if (days < 30) { out.age.d30 += 1; out.newLots30 += 1; }
      else if (days < 90) out.age.d90 += 1;
      else if (days < 365) out.age.d365 += 1;
      else out.age.older += 1;
      if (created > latest) latest = created;
      const wk = weekStart(new Date(created));
      if (wk in listedByWeek) listedByWeek[wk] += 1;
    } else {
      out.age.unknown += 1;
    }
  }

  out.value = sawPrice ? Math.round(out.value * 100) / 100 : null;
  if (!sawDate) {
    // ohne Erstelldatum gibt es kein Alter und keine Neueinstellungen
    out.age = null;
    out.newLots30 = null;
  } else {
    out.lastListed = new Date(latest).toISOString().slice(0, 10);
    // "Neu eingestellt" zählt nur Lots, die noch im Bestand sind; was sofort wieder verkauft wurde, fehlt später. Eine Woche kann deshalb nur
    // schrumpfen: der höchste je gesehene Wert bleibt stehen.
    const prev = Object.fromEntries((Array.isArray(previousWeekly) ? previousWeekly : []).map((w) => [w && w.weekStart, Number(w && w.listed) || 0]));
    out.weekly = weekKeys.map((k) => ({ weekStart: k, listed: Math.max(listedByWeek[k], prev[k] || 0) }));
  }
  return out;
}
