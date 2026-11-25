// Preis-Check (Shop-Radar): vergleicht die Preise deiner Teile und Minifiguren mit dem Durchschnitt der Bricklink-Verkaeufe der letzten 6 Monate
// (Price Guide "sold", wie beim Wert der LEGO-Sammlung: nach Stueckzahl gewichtet, siehe lib/lego.mjs parseGuide). Gespeichert wird spaeter data.bricklinkPrices:
// nur die Lots mit starker Abweichung (Artikeldaten, keine Kundendaten). Im Protokoll (oeffentliches Repo) steht nichts davon.
// Reine Funktionen ohne Node-Abhaengigkeiten, damit sie sich auch im Browser testen lassen (wie lib/uploads.mjs); die Abfragen selbst stehen in scripts/fetchers/bricklink.mjs.
//
// Bricklink erlaubt nur begrenzt viele Abfragen am Tag (5.000) und fuer den Vergleich ist je Lot eine noetig. Darum wird in Etappen geprueft: Es zaehlen nur Teile und
// Minifiguren im Shop (nicht Stockroom) mit mindestens minValue Warenwert; ein voller Durchlauf braucht ceil(Lots / cap) Tage, und heute kommt der Teil an die Reihe, dessen
// Lot-Nummer (inventory_id) zum Tag passt. So ist der Plan ohne gespeicherten Stand eindeutig. Ergebnisse vorheriger Tage bleiben stehen, solange das Lot noch da ist und
// seinen Preis nicht geaendert hat (mergeRows).
//
// Dazu kommt die regelmaessige Kontrolle OHNE Abfragen (refreshRows): Die gespeicherten Zeilen werden gegen den aktuellen Bestand gehalten (ein Aufruf des Inventars reicht).
// Hat sich der Preis eines Lots in der Liste geaendert, wird die Abweichung mit dem gespeicherten Durchschnitt neu berechnet: passt der Preis jetzt, wandert das Lot in die Liste
// "Erledigt" (done), sonst bleibt es mit dem neuen Preis stehen. Ist das Lot weg (verkauft, geloescht, im Stockroom), steht es ebenfalls in "Erledigt". Neue Zeilen tragen den Tag,
// an dem sie zum ersten Mal auffielen (since), damit das Dashboard sie als NEU kennzeichnen kann.

// Zeilen je Richtung, die gespeichert werden (das Dashboard zeigt zehn, auf Wunsch alle): grosszuegig, damit nach dem Abarbeiten der obersten Zeilen die naechsten schon da sind
export const MAX_ROWS = 200;
export const DEFAULTS = { minValue: 1, cap: 1500, minDev: 30, minSales: 3, minDiff: 0.5 };
// Liste "Erledigt": hoechstens so viele Eintraege, hoechstens so viele Tage alt
export const DONE_MAX = 100;
export const DONE_DAYS = 7;

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round2 = (n) => Math.round(n * 100) / 100;
const round4 = (n) => Math.round(n * 10000) / 10000;
// Preis eines Lots nach Abzug eines eigenen Rabatts (sale_rate in Prozent), null ohne gueltigen Preis
const effectivePrice = (lot) => {
  const list = num(lot && lot.unit_price), sale = num(lot && lot.sale_rate);
  return list > 0 ? list * (sale !== null && sale > 0 && sale < 100 ? 1 - sale / 100 : 1) : null;
};

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
    const price = effectivePrice(lot), id = num(lot.inventory_id);
    if (!(price > 0) || id === null) continue;
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
  // Die größte Abweichung in Prozent zuerst (bei gleichem Prozentsatz der größere Unterschied für das Lot); so wird auch ausgewählt, was bei max Zeilen übrig bleibt
  const byPercent = (a, b) => Math.abs(b.dev) - Math.abs(a.dev) || Math.abs(b.diff) - Math.abs(a.diff);
  return { over: all.filter((r) => r.dev > 0).sort(byPercent).slice(0, max), under: all.filter((r) => r.dev < 0).sort(byPercent).slice(0, max) };
}

// Alle Lots des Inventars nach Lot-Nummer, auch Stockroom, Menge 0 und kleine Lots (die pickEligible auslaesst): { price nach Rabatt oder null, qty, shop (nicht Stockroom), created (ms oder null) }.
// Damit laesst sich fuer jede Zeile der Liste sagen, was aus dem Lot geworden ist.
export function indexLots(lots) {
  const index = new Map();
  for (const lot of Array.isArray(lots) ? lots : []) {
    const id = num(lot && lot.inventory_id);
    if (id === null) continue;
    const created = Date.parse(String((lot && lot.date_created) || ""));
    index.set(id, {
      price: effectivePrice(lot),
      qty: num(lot.quantity) || 0,
      shop: !(lot.is_stock_room === true || lot.is_stock_room === "true"),
      created: Number.isFinite(created) ? created : null
    });
  }
  return index;
}

// Der laufende Durchlauf (zusaetzlich zu den Etappen): die naechsten Lots der Reihe nach Lot-Nummer ab dem Zeiger after (am Ende geht es vorn weiter), ohne die Nummern in skip.
// Der Zeiger ist die Nummer des zuletzt geprueften Lots und bleibt auch dann stimmig, wenn Lots dazukommen oder wegfallen.
export function pickSweep(eligible, { after = 0, take = 0, skip = new Set() } = {}) {
  const sorted = (Array.isArray(eligible) ? eligible : []).filter((c) => !skip.has(c.id)).sort((a, b) => a.id - b.id);
  if (!sorted.length || !(take > 0)) return [];
  let start = sorted.findIndex((c) => c.id > after);
  if (start < 0) start = 0;
  return Array.from({ length: Math.min(take, sorted.length) }, (_, k) => sorted[(start + k) % sorted.length]);
}

// Neuer Zeiger nach einer Pruefung: die Nummer des letzten Lots der lueckenlos geprueften Strecke (ein Lot ohne Antwort haelt den Zeiger davor an, damit es beim naechsten Mal wieder drankommt)
export function advanceCursor(sweep, checkedIds, after = 0) {
  let k = 0;
  while (k < sweep.length && checkedIds.has(sweep[k].id)) k += 1;
  return k > 0 ? sweep[k - 1].id : after;
}

const devOf = (price, avg) => Math.round((price / avg - 1) * 100);
const dayMinus = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);

// Die regelmaessige Kontrolle: gespeicherte Zeilen (previous = bisherige over + under) gegen den aktuellen Bestand (index = indexLots) halten und, wenn vorhanden, die heute
// neu geprueften Zeilen (fresh, mit checkedIds) einarbeiten. Liefert { over, under, done }:
//  - Lot weg (nicht mehr im Shop, Menge 0, Stockroom):        Eintrag in done (why "gone")
//  - Preis geaendert, Abweichung jetzt unter minDev oder Unterschied unter minDiff: Eintrag in done (why "price", from, to, dev); sonst bleibt die Zeile mit dem neuen Preis
//    (was = Preis davor, wasAt = Tag)
//  - Preis gleich, aber der Unterschied fuer das Lot ist (durch weniger Stueck) unter minDiff gefallen: done (why "small")
//  - Zeilen, die heute neu geprueft wurden, ersetzen die alten (ein Lot, dessen Preis sich geaendert hat und das jetzt passt, kommt ebenfalls in done)
// Neue Zeilen tragen since (Tag, an dem sie zum ersten Mal auffielen), geprueft wird dabei, ob es das Lot in previous schon gab. previousDone = bisherige Liste "Erledigt".
export function refreshRows({ previous = [], fresh = [], index = new Map(), checkedIds = new Set(), today, previousDone = [], minDev = DEFAULTS.minDev, minDiff = DEFAULTS.minDiff, max = MAX_ROWS, doneMax = DONE_MAX, doneDays = DONE_DAYS } = {}) {
  const prevById = new Map();
  for (const r of previous) if (r && r.id !== undefined && r.id !== null) prevById.set(r.id, r);
  const freshIds = new Set(fresh.map((r) => r.id));
  const kept = [];
  const done = [];
  const entry = (r, why, to, dev) => ({ id: r.id, t: r.t, no: r.no, name: r.name, color: r.color, ...(r.colorName ? { colorName: r.colorName } : {}), cond: r.cond, qty: r.qty, from: r.price, to: to === null ? null : round4(to), avg: r.avg, dev, why, day: today });

  for (const r of prevById.values()) {
    const c = index.get(r.id);
    const gone = !c || !c.shop || !(c.qty > 0) || !(c.price > 0);
    if (checkedIds.has(r.id)) {
      // heute neu geprueft: das neue Ergebnis (fresh) ersetzt die Zeile; wurde sie dadurch hinfaellig, steht hier warum
      if (gone) done.push(entry(r, "gone", null, null));
      else if (!freshIds.has(r.id) && Math.abs(c.price - r.price) > 0.00005) done.push(entry(r, "price", c.price, devOf(c.price, r.avg)));
      continue;
    }
    if (gone) { done.push(entry(r, "gone", null, null)); continue; }
    const diff = round2(c.qty * (c.price - r.avg));
    if (Math.abs(c.price - r.price) <= 0.00005) {
      // Preis gleich geblieben: die Abweichung bleibt wie gespeichert (neu gerechnet wuerde die Rundung des Durchschnitts Zeilen knapp ueber der Schwelle kippen), nur die Menge kann sich geaendert haben
      if (Math.abs(diff) < minDiff) done.push(entry(r, "small", c.price, r.dev));
      else kept.push({ ...r, qty: c.qty, diff });
      continue;
    }
    // Preis geaendert: Abweichung mit dem gespeicherten Durchschnitt neu rechnen
    const dev = devOf(c.price, r.avg);
    if (Math.abs(dev) < minDev || Math.abs(diff) < minDiff) done.push(entry(r, "price", c.price, dev));
    else kept.push({ ...r, price: round4(c.price), qty: c.qty, dev, diff, was: r.price, wasAt: today });
  }

  const rows = fresh.map((f) => {
    const p = prevById.get(f.id);
    if (!p) return { ...f, since: today };
    const out = { ...f, since: p.since || p.day || today };
    if (Math.abs(p.price - f.price) > 0.00005) { out.was = p.price; out.wasAt = today; }
    return out;
  }).concat(kept);

  // Die größte Abweichung in Prozent zuerst (bei gleichem Prozentsatz der größere Unterschied für das Lot)
  const byPercent = (a, b) => Math.abs(b.dev) - Math.abs(a.dev) || Math.abs(b.diff) - Math.abs(a.diff);
  const over = rows.filter((r) => r.dev > 0).sort(byPercent).slice(0, max);
  const under = rows.filter((r) => r.dev < 0).sort(byPercent).slice(0, max);

  // Liste "Erledigt": neue Eintraege zuerst, dann die alten (ohne Lots, die jetzt wieder in der Liste stehen oder neu eingetragen wurden), nicht aelter als doneDays, hoechstens doneMax
  const inRows = new Set(rows.map((r) => r.id));
  const newIds = new Set(done.map((d) => d.id));
  const cutoff = today ? dayMinus(today, doneDays) : "";
  const olderDone = (Array.isArray(previousDone) ? previousDone : []).filter((d) => d && !inRows.has(d.id) && !newIds.has(d.id) && String(d.day || "") >= cutoff);
  const byDayDesc = (a, b) => (String(b.day) > String(a.day) ? 1 : String(b.day) < String(a.day) ? -1 : 0);
  return { over, under, done: done.sort(byDayDesc).concat(olderDone.sort(byDayDesc)).slice(0, doneMax) };
}
