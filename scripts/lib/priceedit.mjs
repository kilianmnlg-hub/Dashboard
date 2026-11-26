// Preise bei Bricklink aendern (Shop-Radar, Preis-Check): Pruefung der Auftraege und das Aendern selbst. Reine Funktionen ohne Node-Abhaengigkeiten: die Aufrufe der API
// kommen von aussen (call), damit sich alles im Browser pruefen laesst (wie lib/uploads.mjs). Aufgerufen von scripts/bricklink-price.mjs (Workflow bricklink-price.yml,
// vom Dashboard gestartet).
//
// Ein Auftrag ist eine Liste { id, expect, target }: id = Lot-Nummer (inventory_id), expect = der Preis, den das Dashboard fuer das Lot kennt (der Preis NACH einem eigenen
// Rabatt, wie im Preis-Check), target = der gewuenschte neue Preis (ebenfalls nach Rabatt). Geaendert wird NUR das Feld unit_price (der Listenpreis), und nur dann, wenn das Lot
// noch genau den erwarteten Preis hat; sonst wurde es zwischenzeitlich geaendert und bleibt unberuehrt. Hat das Lot einen eigenen Rabatt (sale_rate), bleibt der Prozentsatz
// stehen und der Listenpreis wird so gesetzt, dass der Preis nach Rabatt der Zielpreis ist. Nach dem Schreiben wird das Lot erneut gelesen und der Preis geprueft.
//
// Zweite Art (kind "sale", Rabattvorschlag im Shop-Radar): { id, kind: "sale", expect, expectSale, target } setzt den eigenen Rabatt des Lots (sale_rate, ganze Prozent, 0 bis MAX_SALE)
// und laesst den Listenpreis stehen. expect = Listenpreis (unit_price), expectSale = Rabatt, die das Dashboard kennt; stimmt eines davon nicht mehr, bleibt das Lot unberuehrt.
// Geschrieben wird dann NUR das Feld sale_rate (am 26.11.2026 mit einem Test ohne Aenderung geprueft: Bricklink nimmt es an, sonst aendert sich nichts).

export const MAX_CHANGES = 25;
// Schutz vor absurden Eingaben: mehr als das 2000-fache oder weniger als der 2000. Teil des bisherigen Preises wird nicht geaendert
// (Kommafehler um den Faktor 10 oder 100 faengt das nicht ab, dafuer zeigt das Dashboard vor dem Aendern Preis und Abweichung)
export const MAX_RATIO = 2000;
export const MIN_PRICE = 0.001;
export const MAX_PRICE = 10000;
// Hoechster Rabatt in Prozent, der ueber das Dashboard gesetzt werden darf (der Rabattvorschlag empfiehlt 10 bis 20)
export const MAX_SALE = 50;

const num = (v) => {
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : null;
};
const round4 = (n) => Math.round(n * 10000) / 10000;
// Anteil, der nach einem eigenen Rabatt (sale_rate in Prozent) vom Listenpreis bleibt
export const keepFactor = (sale) => (sale !== null && sale !== undefined && sale > 0 && sale < 100 ? 1 - sale / 100 : 1);

// Auftrag pruefen (JSON-Text oder schon eine Liste): gueltige Lot-Nummern, Preise, keine Doppelten, hoechstens MAX_CHANGES. Wirft bei Fehlern.
export function parseChanges(raw) {
  let list = raw;
  if (typeof raw === "string") {
    try { list = JSON.parse(raw); } catch (e) { throw new Error("Auftrag ist kein gueltiges JSON"); }
  }
  if (!Array.isArray(list) || !list.length) throw new Error("Keine Aenderungen im Auftrag");
  if (list.length > MAX_CHANGES) throw new Error(`Hoechstens ${MAX_CHANGES} Aenderungen je Auftrag`);
  const seen = new Set();
  return list.map((c) => {
    const id = String(c && c.id), expect = num(c && c.expect), target = num(c && c.target);
    if (!/^\d{4,12}$/.test(id) || seen.has(id)) throw new Error("Ungueltige oder doppelte Lot-Nummer im Auftrag");
    seen.add(id);
    if (c.kind === "sale") {
      const expectSale = num(c.expectSale);
      if (!(expect > 0)) throw new Error("Ungueltiger Preis im Auftrag");
      if (!Number.isInteger(target) || target < 0 || target > MAX_SALE || !Number.isInteger(expectSale) || expectSale < 0 || expectSale > 99) throw new Error("Ungueltiger Rabatt im Auftrag");
      return { id, kind: "sale", expect: round4(expect), expectSale, target };
    }
    if (!(expect > 0) || !(target >= MIN_PRICE) || target > MAX_PRICE) throw new Error("Ungueltiger Preis im Auftrag");
    return { id, expect: round4(expect), target: round4(target) };
  });
}

// Die Auftragsdatei des Dashboards ({ batch, at, changes }): gehoert sie zu diesem Lauf? Liefert die geprueften Aenderungen oder wirft einen Fehler.
export function parseOrder(raw, batch) {
  let order = raw;
  if (typeof raw === "string") {
    try { order = JSON.parse(raw); } catch (e) { throw new Error("Auftragsdatei ist kein gueltiges JSON"); }
  }
  if (!order || typeof order !== "object" || !batch || order.batch !== batch) throw new Error("Kein Auftrag mit dieser Kennung in der Auftragsdatei");
  return parseChanges(order.changes);
}

// Darf dieses Lot (Antwort von GET /inventories/{id}) auf den Zielpreis gesetzt werden? Liefert { ok, why, list, sale, effective, newList }
export function judge(lot, change) {
  const type = String((lot && lot.item && lot.item.type) || "").toUpperCase();
  if (type !== "PART" && type !== "MINIFIG") return { ok: false, why: "kein Teil und keine Minifigur" };
  if (!(num(lot.quantity) > 0)) return { ok: false, why: "Menge ist 0" };
  const list = num(lot.unit_price), sale = num(lot.sale_rate);
  if (!(list > 0)) return { ok: false, why: "Preis des Lots nicht lesbar" };
  const f = keepFactor(sale), effective = list * f;
  const base = { list, sale: sale || 0, effective };
  if (change.kind === "sale") {
    // Rabatt setzen: Listenpreis und bisheriger Rabatt muessen noch so sein, wie das Dashboard sie kennt
    if (Math.abs(list - change.expect) > Math.max(0.0006, change.expect * 0.005) || (sale || 0) !== change.expectSale) return { ok: false, why: "Preis oder Rabatt hat sich inzwischen geändert", ...base };
    if ((sale || 0) === change.target) return { ok: false, why: "Rabatt ist schon so", ...base };
    return { ok: true, ...base, newSale: change.target };
  }
  if (Math.abs(effective - change.expect) > Math.max(0.0006, change.expect * 0.005)) return { ok: false, why: "Preis hat sich inzwischen geändert", ...base };
  const ratio = change.target / effective;
  if (ratio > MAX_RATIO || ratio < 1 / MAX_RATIO) return { ok: false, why: "Änderung unplausibel (mehr als das 2000-Fache)", ...base };
  const newList = round4(change.target / f);
  if (!(newList >= MIN_PRICE)) return { ok: false, why: "neuer Listenpreis unter 0,001", ...base };
  if (Math.abs(newList - list) < 0.00005) return { ok: false, why: "Preis ist schon so", ...base, newList };
  return { ok: true, ...base, newList };
}

// Rabatt setzen (kind "sale"): nur das Feld sale_rate schreiben, danach erneut lesen und pruefen
async function applySale(row, j, ch, call, dry) {
  if (dry) return { ...row, result: "dry", saleBefore: j.sale, saleAfter: j.newSale, effectiveAfter: round4(j.list * keepFactor(j.newSale)) };
  const put = await call("PUT", `/inventories/${ch.id}`, { sale_rate: j.newSale });
  if (!(put.status === 200 && (put.code === 200 || put.code === null || put.code === undefined))) return { ...row, result: "failed", why: `Bricklink lehnt die Änderung ab (${note(put)})` };
  const chk = await call("GET", `/inventories/${ch.id}`);
  const afterSale = chk.status === 200 && chk.data ? num(chk.data.sale_rate) : null, afterList = chk.status === 200 && chk.data ? num(chk.data.unit_price) : null;
  if (afterSale === null || afterSale !== j.newSale) return { ...row, result: "failed", why: "Nach dem Schreiben steht ein anderer Rabatt im Lot (bitte in Bricklink prüfen)", saleAfter: afterSale };
  return { ...row, result: "ok", saleBefore: j.sale, saleAfter: afterSale, listAfter: afterList, effectiveAfter: afterList === null ? null : round4(afterList * keepFactor(afterSale)) };
}

const note = (r) => `HTTP ${r.status}${r.code !== null && r.code !== undefined ? `, API-Code ${r.code}` : ""}${r.message ? `, ${r.message}` : ""}`;

// Fuehrt den Auftrag aus. call(method, path, body) liefert { status, code, message, data }; sleep(ms) pausiert (in Pruefungen weglassen).
// dry = true: alles pruefen, aber nichts schreiben (Ergebnis "dry" mit dem Preis, der gesetzt worden waere).
// Ergebnis je Lot: { batch, at, id, expect, target, t, no, color, cond, qty, listBefore, sale, effectiveBefore, result: "ok" | "skipped" | "failed" | "dry", why, listAfter, effectiveAfter }
export async function applyChanges(changes, { call, sleep = () => Promise.resolve(), batch = "", dry = false, now = () => new Date().toISOString() } = {}) {
  const out = [];
  for (const ch of changes) {
    const row = { batch, at: now(), id: ch.id, expect: ch.expect, target: ch.target };
    try {
      const got = await call("GET", `/inventories/${ch.id}`);
      if (got.status !== 200 || !got.data) { out.push({ ...row, result: "failed", why: `Lot nicht lesbar (${note(got)})` }); continue; }
      const lot = got.data, item = lot.item || {};
      Object.assign(row, { t: String(item.type || ""), no: String(item.no || ""), color: num(lot.color_id) || 0, cond: String(lot.new_or_used || ""), qty: num(lot.quantity), listBefore: num(lot.unit_price), sale: num(lot.sale_rate) || 0 });
      const j = judge(lot, ch);
      if (j.effective !== undefined) row.effectiveBefore = round4(j.effective);
      if (ch.kind === "sale") { row.kind = "sale"; row.expectSale = ch.expectSale; }
      if (!j.ok) { out.push({ ...row, result: "skipped", why: j.why }); continue; }
      if (ch.kind === "sale") { out.push(await applySale(row, j, ch, call, dry)); await sleep(300); continue; }
      if (dry) { out.push({ ...row, result: "dry", listAfter: j.newList, effectiveAfter: round4(j.newList * keepFactor(row.sale)) }); continue; }
      const put = await call("PUT", `/inventories/${ch.id}`, { unit_price: j.newList.toFixed(4) });
      if (!(put.status === 200 && (put.code === 200 || put.code === null || put.code === undefined))) { out.push({ ...row, result: "failed", why: `Bricklink lehnt die Änderung ab (${note(put)})` }); continue; }
      const chk = await call("GET", `/inventories/${ch.id}`);
      const after = chk.status === 200 && chk.data ? num(chk.data.unit_price) : null;
      // Bricklink darf auf drei Stellen runden: bis 0,0006 Abweichung gilt als geschrieben
      if (after === null || Math.abs(after - j.newList) > 0.0006) { out.push({ ...row, result: "failed", why: "Nach dem Schreiben steht ein anderer Preis im Lot (bitte in Bricklink prüfen)", listAfter: after }); continue; }
      out.push({ ...row, result: "ok", listAfter: after, effectiveAfter: round4(after * keepFactor(row.sale)) });
    } catch (e) {
      out.push({ ...row, result: "failed", why: String((e && e.message) || e).slice(0, 120) });
    }
    await sleep(300);
  }
  return out;
}
