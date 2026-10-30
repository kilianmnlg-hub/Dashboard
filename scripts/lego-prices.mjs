// Holt fuer die Sets der LEGO-Sammlung den aktuellen Wert von Bricklink und schreibt ihn samt Verlauf in lego-prices.json.
// Welche Sets es gibt, steht in lego-data.json (wird im Dashboard gepflegt); beide Dateien liegen im PRIVATEN Repo dashboard-privat
// (Ordner DATA_DIR, der Workflow checkt es nach ./private aus). Benoetigt dieselben Zugangsdaten wie der Bricklink-Sync:
// BRICKLINK_CONSUMER_KEY, BRICKLINK_CONSUMER_SECRET, BRICKLINK_TOKEN_VALUE, BRICKLINK_TOKEN_SECRET.
//
// Wert = Durchschnitt der Verkaeufe der letzten 6 Monate, neu, Europa, mit MwSt. (gebaute und gebrauchte Sets: dieselbe Auswertung
// fuer "gebraucht"). Bei weniger als 3 Verkaeufen zaehlen die Angebote. Rechenregeln: scripts/lib/lego.mjs.
// Pro Set 2 bis 4 Abfragen (Verkaeufe, Angebote, einmalig Name und Thema), das Tageslimit der API liegt bei 5.000.
//
// Das Protokoll dieses Skripts (GitHub Actions im OEFFENTLICHEN Repo) nennt bewusst keine Set-Nummern, Namen, Preise oder Stueckzahlen:
// sonst waere dein Bestand dort lesbar. Fehler stehen stattdessen im Eintrag des Sets in lego-prices.json (privates Repo, Feld err).
//
// Aufruf: node scripts/lego-prices.mjs   (lokal: DATA_DIR=<Ordner mit lego-data.json> setzen)

import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { buildAuthHeader } from "./lib/oauth1.mjs";
import { addPoint, backfill, chooseValue, compactHistory, dayKey, normSetNo, ownedQty, parseGuide } from "./lib/lego.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..");
const SETS_FILE = path.join(DATA_DIR, "lego-data.json");
const PRICES_FILE = path.join(DATA_DIR, "lego-prices.json");
const BASE_URL = "https://api.bricklink.com/api/store/v1";
const REGION = process.env.LEGO_REGION || "europe";
const CURRENCY = process.env.LEGO_CURRENCY || "EUR";
const PAUSE_MS = Number(process.env.LEGO_PAUSE_MS || 200);
const RETRY_MS = Number(process.env.LEGO_RETRY_MS || 1500);
// Preise mit MwSt. ("Y"). Die offizielle Anleitung der API kennt den Parameter vat nicht (dort steht, die Preise enthalten keine MwSt.):
// lehnt Bricklink ihn ab oder wirkt er nicht (siehe Pruefung in main), wird ohne gerechnet und das in der Datei vermerkt (vat: false).
let sendVat = String(process.env.LEGO_VAT || "Y").toUpperCase() === "Y";
let vatChecked = false;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function bricklinkGet(apiPath, queryParams, creds) {
  const url = `${BASE_URL}${apiPath}`;
  const qs = new URLSearchParams(queryParams).toString();
  const fullUrl = qs ? `${url}?${qs}` : url;
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const authHeader = buildAuthHeader({ method: "GET", url, queryParams, ...creds });
      const res = await fetch(fullUrl, { headers: { Authorization: authHeader }, signal: AbortSignal.timeout(25000) });
      if (res.status >= 500 || res.status === 429) throw Object.assign(new Error(`Bricklink API Fehler ${res.status}`), { retry: true });
      if (!res.ok) throw new Error(`Bricklink API Fehler ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      if (json.meta?.code >= 300) throw new Error(`Bricklink API Fehler ${json.meta.code}: ${json.meta.message || json.meta.description || ""}`);
      return json.data;
    } catch (err) {
      lastErr = err;
      if (!(err.retry || err.name === "TimeoutError" || err.name === "TypeError")) break;
      await sleep(RETRY_MS * (attempt + 1));
    }
  }
  throw lastErr;
}

// Statistik zu einem Set: guide = "sold" (Verkaeufe der letzten 6 Monate) oder "stock" (aktuelle Angebote), cond = "N" (neu) oder "U" (gebraucht)
async function priceGuide(no, guide, cond, creds, withoutVat = false) {
  const params = { guide_type: guide, new_or_used: cond, region: REGION, currency_code: CURRENCY };
  try {
    return parseGuide(await bricklinkGet(`/items/SET/${no}/price`, sendVat && !withoutVat ? { ...params, vat: "Y" } : params, creds));
  } catch (err) {
    if (sendVat && /Fehler 400/.test(err.message)) {
      console.warn("[lego] MwSt.-Parameter von Bricklink abgelehnt, rechne ohne MwSt.");
      sendVat = false;
      return parseGuide(await bricklinkGet(`/items/SET/${no}/price`, params, creds));
    }
    throw err;
  }
}

// Bricklink liefert Namen mit HTML-Zeichen ("Barad-d&#251;r", "&amp;")
const decodeEntities = (s) =>
  String(s || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

// Name, Erscheinungsjahr und Thema (Kategorie) eines Sets; ein Fehler hier stoppt den Preis nicht
async function setInfo(no, creds) {
  const item = await bricklinkGet(`/items/SET/${no}`, {}, creds);
  const info = { name: decodeEntities(item.name), year: Number(item.year_released) || null };
  if (item.category_id) {
    try {
      const cat = await bricklinkGet(`/categories/${item.category_id}`, {}, creds);
      if (cat?.category_name) info.theme = decodeEntities(cat.category_name);
    } catch (err) {
      console.warn("[lego] Thema eines Sets nicht abgerufen.");
    }
  }
  return info;
}

const readJson = (file) => {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, "utf8"));
  } catch (err) {
    throw new Error(`${path.basename(file)} ist kein gueltiges JSON: ${err.message}`);
  }
};

async function main() {
  const creds = {
    consumerKey: process.env.BRICKLINK_CONSUMER_KEY,
    consumerSecret: process.env.BRICKLINK_CONSUMER_SECRET,
    tokenValue: process.env.BRICKLINK_TOKEN_VALUE,
    tokenSecret: process.env.BRICKLINK_TOKEN_SECRET
  };
  if (Object.values(creds).some((v) => !v)) {
    console.warn("[lego] Bricklink-Zugangsdaten fehlen, uebersprungen.");
    return;
  }
  const data = readJson(SETS_FILE);
  const sets = (data?.sets || []).filter((s) => s && !s.del && normSetNo(s.no));
  if (!sets.length) {
    console.log("[lego] Keine Sets in lego-data.json, nichts zu tun.");
    return;
  }

  const old = readJson(PRICES_FILE) || {};
  const items = { ...(old.items || {}) };
  // Eintraege geloeschter Sets verschwinden; verkaufte Sets (0 Stueck) bleiben samt Verlauf stehen, werden aber nicht mehr abgefragt
  const known = new Set(sets.map((s) => s.no));
  Object.keys(items).forEach((no) => {
    if (!known.has(no)) delete items[no];
  });

  const today = dayKey(Date.now());
  const todo = sets.filter((s) => ownedQty(s) > 0 || !items[s.no]);
  let ok = 0;
  let failed = 0;
  let outage = 0; // Fehler in Folge, die nicht "Set unbekannt" (404) sind: dann ist eher der Zugang oder Bricklink gestoert
  for (const set of todo) {
    const no = set.no;
    const cond = set.cond && set.cond !== "NEU" ? "U" : "N";
    try {
      const prev = items[no] || {};
      const entry = { ...prev, cond: cond === "N" ? "NEU" : "GEBRAUCHT" };
      if (!prev.name) Object.assign(entry, await setInfo(no, creds).catch(() => (console.warn("[lego] Name eines Sets nicht abgerufen."), {})));
      const sold = await priceGuide(no, "sold", cond, creds);
      // Einmal je Lauf pruefen, ob vat=Y ueberhaupt etwas aendert (ein unbekannter Parameter koennte stillschweigend ignoriert werden):
      // dasselbe mit und ohne den Parameter abfragen; sind die Werte gleich, gelten sie ohne MwSt.
      if (sendVat && !vatChecked && sold.value) {
        vatChecked = true;
        const plain = await priceGuide(no, "sold", cond, creds, true).catch(() => null);
        if (plain?.value && Math.abs(plain.value - sold.value) < 0.005) {
          console.warn("[lego] Mit und ohne vat=Y kommen dieselben Preise: der Parameter wirkt nicht, die Werte gelten ohne MwSt.");
          sendVat = false;
        }
        await sleep(PAUSE_MS);
      }
      await sleep(PAUSE_MS);
      const stock = await priceGuide(no, "stock", cond, creds);
      const choice = chooseValue(sold, stock);
      let h = Array.isArray(prev.h) ? prev.h : [];
      if (choice) {
        if (!h.length && choice.src === "sold") h = backfill(sold.details, today);
        h = addPoint(h, today, choice.val);
        Object.assign(entry, choice, { day: today });
        delete entry.none;
      } else {
        entry.none = today;
      }
      entry.h = compactHistory(h, today);
      delete entry.err;
      delete entry.errDay;
      items[no] = entry;
      ok++;
      outage = 0;
    } catch (err) {
      failed++;
      console.error("[lego] Ein Set konnte nicht abgerufen werden (Grund: lego-prices.json im privaten Repo, Feld err).");
      items[no] = { ...(items[no] || {}), err: String(err.message || err).slice(0, 160), errDay: today };
      outage = /Fehler 404/.test(err.message) ? 0 : outage + 1;
      if (outage >= 3) {
        console.error("[lego] Drei Abfragen in Folge fehlgeschlagen, Abbruch (Zugangsdaten oder Bricklink gestoert?).");
        break;
      }
    }
    await sleep(PAUSE_MS);
  }

  const body = JSON.stringify(items);
  if (body === JSON.stringify(old.items || {}) && (old.vat === undefined || old.vat === sendVat)) {
    console.log("[lego] Keine Aenderungen an lego-prices.json.");
  } else {
    const lines = Object.keys(items)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${JSON.stringify(items[k])}`);
    const text = `{"v":1,"updatedAt":${JSON.stringify(new Date().toISOString())},"currency":${JSON.stringify(CURRENCY)},"vat":${sendVat},"items":{\n${lines.join(",\n")}\n}}\n`;
    writeFileSync(PRICES_FILE, text);
    console.log("[lego] lego-prices.json geschrieben.");
  }
  if (failed && !ok) process.exit(1);
}

main().catch((err) => {
  console.error("[lego] Fehler:", err.message);
  process.exit(1);
});
