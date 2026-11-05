// Shop-Radar (Lager): macht aus der Inventar-Antwort der Bricklink-API (GET /inventories, ein Eintrag je Lot) Zahlen und eine kurze Rabattliste.
// Gespeichert wird später data.bricklinkInventory. Von den Lots bleiben nur Summen und die ZEHN Ladenhüter für den Rabattvorschlag (Typ, Nummer, Name, Farbe,
// Menge, Preis, Alter): Artikeldaten, keine Kundendaten. Im Protokoll (öffentliches Repo) steht nichts davon.
// Reine Funktionen ohne Node-Abhängigkeiten, damit sie sich auch im Browser testen lassen (wie lib/uploads.mjs).
//
// Gezählt werden Lots mit Stückzahl > 0. Ein Lot im Stockroom (is_stock_room) ist für Käufer unsichtbar und steht getrennt (stockroomLots/-Parts).
// Der Wert ist der VERKAUFSwert: Stückzahl mal Preis je Stück (unit_price), bei einem Rabatt (sale_rate in %) abzüglich. Alter und "neu eingestellt"
// kommen aus date_created, dem Erstelldatum des Lots; wer Lots ersetzt statt aktualisiert, setzt es zurück. Fehlt ein Feld in der Antwort, bleibt die
// Zahl weg (null) statt erfunden zu werden.
//
// Ladenhüter: Bricklink verrät nicht, wie oft ein einzelnes Lot verkauft wurde. "Schlecht verkauft" heißt hier: lange im Shop (ab 1 Jahr) und noch viel Geld
// gebunden. Sortiert wird nach Warenwert mal Alter in Tagen; der Rabattvorschlag richtet sich nach dem Alter (DISCOUNT_TIERS). Lots, die schon so stark
// oder stärker rabattiert sind, fehlen in der Liste. Es gibt zwei Listen zu je zehn: slow (alles außer Minifiguren) und slowMini (Minifiguren).

const DAY_MS = 86400000;
export const INVENTORY_WEEKS = 12;
export const SLOW_COUNT = 10;
// Rabattvorschlag nach Alter: [Mindestalter in Tagen, Prozent]; es gilt der erste passende Eintrag
export const DISCOUNT_TIERS = [[1095, 20], [730, 15], [365, 10]];
const discountFor = (days) => { const t = DISCOUNT_TIERS.find(([d]) => days >= d); return t ? t[1] : 0; };

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
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;

// lots: Array aus der API. previousWeekly: das bisherige bricklinkInventory.weekly (für "höchster je gesehener Wert", siehe unten).
export function summarizeInventory(lots, { now = new Date(), currency = "EUR", previousWeekly = [] } = {}) {
  const nowMs = now.getTime();
  const weekKeys = [];
  for (let i = INVENTORY_WEEKS - 1; i >= 0; i--) weekKeys.push(weekStart(new Date(nowMs - i * 7 * DAY_MS)));
  const listedByWeek = Object.fromEntries(weekKeys.map((k) => [k, 0]));
  const partsByWeek = Object.fromEntries(weekKeys.map((k) => [k, 0]));

  const out = {
    checkedAt: now.toISOString(),
    currency: currency || "EUR",
    lots: 0, parts: 0, value: 0,
    newLots: 0, usedLots: 0,
    stockroomLots: 0, stockroomParts: 0,
    newLots30: 0,
    lastListed: null,
    age: { d30: 0, d90: 0, d365: 0, older: 0, unknown: 0 },
    oldValue: 0,
    slow: [],
    slowMini: [],
    weekly: []
  };
  let sawPrice = false, sawDate = false, latest = 0;
  const candidates = [];

  for (const lot of Array.isArray(lots) ? lots : []) {
    const qty = num(lot && lot.quantity);
    if (!(qty > 0)) continue;
    const created = Date.parse(lot.date_created || "");
    const hasDate = Number.isFinite(created);
    const wk = hasDate ? weekStart(new Date(created)) : null;
    // Die Teile je Woche zählen alle Lots (auch Stockroom): so passen sie zur Gesamtzahl der Teile, die das Jahresziel misst
    if (wk !== null && wk in partsByWeek) partsByWeek[wk] += qty;
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
    const sale = num(lot.sale_rate);
    let value = null;
    if (price !== null) {
      sawPrice = true;
      value = qty * price * (sale !== null && sale > 0 && sale < 100 ? 1 - sale / 100 : 1);
      out.value += value;
    }

    if (hasDate) {
      sawDate = true;
      const days = (nowMs - created) / DAY_MS;
      if (days < 30) { out.age.d30 += 1; out.newLots30 += 1; }
      else if (days < 90) out.age.d90 += 1;
      else if (days < 365) out.age.d365 += 1;
      else { out.age.older += 1; if (value !== null) out.oldValue += value; }
      if (created > latest) latest = created;
      if (wk in listedByWeek) listedByWeek[wk] += 1;
      // Kandidat für den Rabattvorschlag: alt genug, hat einen Wert und ist nicht schon mindestens so stark rabattiert
      const age = Math.floor(days), pct = discountFor(age);
      if (pct > 0 && value !== null && value > 0 && !(sale !== null && sale >= pct)) candidates.push({ lot, qty, price, sale: sale !== null && sale > 0 ? sale : 0, created, age, value, pct, score: value * age });
    } else {
      out.age.unknown += 1;
    }
  }

  out.value = sawPrice ? round2(out.value) : null;
  if (!sawDate) {
    // ohne Erstelldatum gibt es kein Alter, keine Neueinstellungen und keine Ladenhüter
    out.age = null;
    out.oldValue = null;
    out.newLots30 = null;
    out.slow = null;
    out.slowMini = null;
  } else {
    out.oldValue = sawPrice ? round2(out.oldValue) : null;
    out.lastListed = new Date(latest).toISOString().slice(0, 10);
    const rowOf = (c) => {
      const cond = String(c.lot.new_or_used || "").toUpperCase();
      return {
        t: String((c.lot.item && c.lot.item.type) || "").toUpperCase(),
        no: String((c.lot.item && c.lot.item.no) || ""),
        name: String((c.lot.item && c.lot.item.name) || "").slice(0, 120),
        color: num(c.lot.color_id),
        cond: cond === "N" || cond === "U" ? cond : "",
        qty: c.qty, price: round4(c.price), sale: c.sale,
        created: new Date(c.created).toISOString().slice(0, 10), age: c.age,
        value: round2(c.value), pct: c.pct, newPrice: round4(c.price * (1 - c.pct / 100))
      };
    };
    // Zwei Listen, damit man im Radar zwischen Teilen und Minifiguren wählen kann: slow = alles außer Minifiguren (Teile, Sets ...), slowMini = Minifiguren
    const sorted = candidates.sort((a, b) => b.score - a.score);
    const isMini = (c) => String((c.lot.item && c.lot.item.type) || "").toUpperCase() === "MINIFIG";
    out.slow = sorted.filter((c) => !isMini(c)).slice(0, SLOW_COUNT).map(rowOf);
    out.slowMini = sorted.filter(isMini).slice(0, SLOW_COUNT).map(rowOf);
    // "Neu eingestellt" zählt nur Lots, die noch im Bestand sind; was sofort wieder verkauft wurde, fehlt später. Eine Woche kann deshalb nur
    // schrumpfen: der höchste je gesehene Wert bleibt stehen (Lots wie Teile).
    const prev = Object.fromEntries((Array.isArray(previousWeekly) ? previousWeekly : []).map((w) => [w && w.weekStart, w || {}]));
    out.weekly = weekKeys.map((k) => ({
      weekStart: k,
      listed: Math.max(listedByWeek[k], Number(prev[k] && prev[k].listed) || 0),
      parts: Math.max(partsByWeek[k], Number(prev[k] && prev[k].parts) || 0)
    }));
  }
  return out;
}
