// EINMALIGE Pruefung, ob der Bricklink-Zugang (BRICKLINK_*-Secrets) Lot-Preise aendern darf, ohne dass sich etwas aendert: liest ein Lot, schreibt DENSELBEN Preis
// zurueck (PUT /inventories/{id} mit unit_price, nur dieses eine Feld) und liest das Lot erneut. Danach wird verglichen, ob sich irgendein Feld geaendert hat.
// Das Protokoll dieses oeffentlichen Repos zeigt nur Statuscodes, Meldungen der API und Feldnamen, nie Preise, Mengen oder Artikel.
// Aufruf (Workflow bricklink-write-test.yml): LOT_ID=<inventory_id> node scripts/bricklink-write-test.mjs
import { buildAuthHeader } from "./lib/oauth1.mjs";

const BASE = "https://api.bricklink.com/api/store/v1";
const creds = {
  consumerKey: process.env.BRICKLINK_CONSUMER_KEY,
  consumerSecret: process.env.BRICKLINK_CONSUMER_SECRET,
  tokenValue: process.env.BRICKLINK_TOKEN_VALUE,
  tokenSecret: process.env.BRICKLINK_TOKEN_SECRET
};
const say = (s) => console.log(`[bl-test] ${s}`);
const id = String(process.env.LOT_ID || "").trim();
if (!/^\d{4,12}$/.test(id)) { say("LOT_ID fehlt oder ist keine Zahl"); process.exit(2); }
if (!creds.consumerKey || !creds.consumerSecret || !creds.tokenValue || !creds.tokenSecret) { say("Bricklink-Zugangsdaten fehlen (Secrets)"); process.exit(2); }

// Ein Aufruf ohne Wiederholung (ein Schreibzugriff soll nie unbemerkt doppelt laufen); liefert Status, meta der API und data
async function call(method, path, body) {
  const url = `${BASE}${path}`;
  const headers = { Authorization: buildAuthHeader({ method, url, queryParams: {}, ...creds }) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000), redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* Webseite oder leere Antwort */ }
  return {
    status: res.status,
    code: json && json.meta ? json.meta.code : null,
    message: json && json.meta ? String(json.meta.message || "").slice(0, 80) : "",
    detail: json && json.meta ? String(json.meta.description || "").slice(0, 120) : "",
    data: json ? json.data : null,
    page: json === null ? text.replace(/\s+/g, " ").slice(0, 60) : ""
  };
}
const brief = (r) => `HTTP ${r.status}, API-Code ${r.code}${r.message ? `, ${r.message}` : ""}${r.detail ? ` (${r.detail})` : ""}${r.page ? `, keine JSON-Antwort: ${r.page}` : ""}`;

const before = await call("GET", `/inventories/${id}`);
say(`1. Lot lesen: ${brief(before)}`);
if (before.status !== 200 || !before.data || before.data.unit_price === undefined) { say("ABBRUCH: Lot nicht lesbar"); process.exit(1); }
const lot = before.data;

const put = await call("PUT", `/inventories/${id}`, { unit_price: String(lot.unit_price) });
say(`2. Schreiben (derselbe Preis, nur das Feld unit_price): ${brief(put)}`);
const written = put.status === 200 && (put.code === 200 || put.code === null);

const after = await call("GET", `/inventories/${id}`);
say(`3. Lot erneut lesen: ${brief(after)}`);
let changed = [];
if (after.status === 200 && after.data) {
  changed = Object.keys({ ...lot, ...after.data }).filter((k) => JSON.stringify(lot[k]) !== JSON.stringify(after.data[k]));
  say(`4. Felder nach dem Schreiben anders als vorher: ${changed.length ? changed.join(", ") : "keine"}`);
  say(`   Erstelldatum (date_created) unveraendert: ${JSON.stringify(lot.date_created) === JSON.stringify(after.data.date_created) ? "ja" : "NEIN"}`);
}
say(written ? (changed.length ? "ERGEBNIS: Schreiben erlaubt, aber es haben sich Felder veraendert (siehe oben)" : "ERGEBNIS: Schreiben erlaubt, nichts hat sich veraendert") : "ERGEBNIS: Schreiben NICHT moeglich (siehe Meldung bei 2.)");
process.exit(written ? (changed.length ? 4 : 0) : 3);
