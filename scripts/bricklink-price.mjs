// Aendert Preise bei Bricklink (Auftrag aus dem Shop-Radar des Dashboards, Knopf "PREIS ANPASSEN" im Preis-Check). Pruefungen und Ablauf stehen in lib/priceedit.mjs: geaendert wird
// nur der Listenpreis (unit_price) einzelner Teile und Minifiguren, und nur, wenn das Lot noch den Preis hat, den das Dashboard kennt.
// Aufruf (Workflow bricklink-price.yml): BATCH=<Kennung> DATA_DIR=<privates Repo> [DRY=1] node scripts/bricklink-price.mjs
// Der Auftrag steht im PRIVATEN Repo (bricklink-price-order.json, vom Dashboard dort abgelegt: { batch, at, changes: [{ id, expect, target }] }), damit keine Lot-Nummern und Preise im
// oeffentlichen Repo auftauchen. Das Ergebnis je Lot (mit Artikeldaten, altem und neuem Preis) kommt in bricklink-price-changes.json im privaten Repo (das Dashboard liest es und bietet
// damit das Rueckgaengigmachen an); danach wird der Auftrag geleert. DRY=1 prueft alles, schreibt aber nichts bei Bricklink.
// Das Protokoll dieses oeffentlichen Repos zeigt nur Zaehler und allgemeine Gruende, nie Artikel oder Preise.
import fs from "fs";
import path from "path";
import { buildAuthHeader } from "./lib/oauth1.mjs";
import { parseOrder, applyChanges } from "./lib/priceedit.mjs";

const BASE = "https://api.bricklink.com/api/store/v1";
const creds = {
  consumerKey: process.env.BRICKLINK_CONSUMER_KEY,
  consumerSecret: process.env.BRICKLINK_CONSUMER_SECRET,
  tokenValue: process.env.BRICKLINK_TOKEN_VALUE,
  tokenSecret: process.env.BRICKLINK_TOKEN_SECRET
};
const say = (s) => console.log(`[bl-preis] ${s}`);
const batch = String(process.env.BATCH || "").trim();
const dry = /^(1|true|yes)$/i.test(String(process.env.DRY || "").trim());
if (!/^[\w-]{4,40}$/.test(batch)) { say("BATCH fehlt oder ist ungueltig"); process.exit(2); }
if (!creds.consumerKey || !creds.consumerSecret || !creds.tokenValue || !creds.tokenSecret) { say("Bricklink-Zugangsdaten fehlen (Secrets)"); process.exit(2); }
if (!process.env.DATA_DIR) { say("DATA_DIR fehlt (privates Repo mit der Auftragsdatei)"); process.exit(2); }
const dir = path.resolve(process.env.DATA_DIR);
const orderFile = path.join(dir, "bricklink-price-order.json");
const resultFile = path.join(dir, "bricklink-price-changes.json");
let changes;
try { changes = parseOrder(fs.readFileSync(orderFile, "utf8"), batch); } catch (e) { say(`Auftrag abgelehnt: ${e.code === "ENOENT" ? "Auftragsdatei fehlt" : e.message}`); process.exit(2); }

// Ein Aufruf ohne Wiederholung (ein Schreibzugriff soll nie unbemerkt doppelt laufen)
async function call(method, route, body) {
  const url = `${BASE}${route}`;
  const headers = { Authorization: buildAuthHeader({ method, url, queryParams: {}, ...creds }) };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(25000), redirect: "manual" });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* Webseite oder leere Antwort */ }
  return { status: res.status, code: json && json.meta ? json.meta.code : null, message: json && json.meta ? String(json.meta.message || "").slice(0, 80) : "", data: json ? json.data : null };
}

const results = await applyChanges(changes, { call, sleep: (ms) => new Promise((r) => setTimeout(r, ms)), batch, dry });

let prev = {};
try { prev = JSON.parse(fs.readFileSync(resultFile, "utf8")); } catch (e) { /* noch keine Datei */ }
const all = (Array.isArray(prev.changes) ? prev.changes : []).concat(results).slice(-300);
fs.writeFileSync(resultFile, JSON.stringify({ changes: all }, null, 1) + "\n", "utf8");
fs.writeFileSync(orderFile, JSON.stringify({ batch: "", at: "", changes: [] }, null, 1) + "\n", "utf8");

const n = (k) => results.filter((x) => x.result === k).length;
say(`Auftrag ${batch}${dry ? " (nur Pruefung, nichts geschrieben)" : ""}: ${results.length} Lots, ${n("ok")} geaendert, ${n("dry")} wuerden geaendert, ${n("skipped")} uebersprungen, ${n("failed")} fehlgeschlagen`);
results.filter((x) => x.result === "skipped" || x.result === "failed").forEach((x) => say(`  ${x.result === "skipped" ? "uebersprungen" : "fehlgeschlagen"}: ${x.why}`));
process.exit(0);
