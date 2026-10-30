// Zieht alle automatisierbaren Daten (Notion-Zeittracker, YouTube-Abos, TikTok-Follower,
// Bricklink-Bestellungen) und schreibt sie in ../data.js. Läuft täglich per GitHub Actions
// (.github/workflows/sync-all.yml)
// und lässt sich manuell auslösen:
//   - über den "Jetzt synchronisieren"-Button im Dashboard (löst denselben Workflow aus)
//   - über den GitHub "Actions"-Tab -> "Run workflow"
//   - lokal: node scripts/sync-all.mjs (Umgebungsvariablen vorher setzen, siehe README)
//   - SYNC_ONLY=uploads: stündlicher Schnellcheck (.github/workflows/check-uploads.yml). Fragt nur YouTube nach neuen
//     Longform-Videos und schreibt data.js nur, wenn eines dazugekommen ist (sonst gäbe es stündlich einen Commit).
//
// Jeder Fetcher überspringt sich selbst (mit Warnung), wenn seine Zugangsdaten fehlen,
// statt den gesamten Sync abzubrechen — so funktioniert z.B. der Notion-Sync auch,
// solange Bricklink/YouTube noch nicht eingerichtet sind.

import { createRequire } from "module";
import { writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { fetchTimeTracker } from "./fetchers/time-tracker.mjs";
import { fetchYouTube, UPLOAD_CHANNEL_KEYS } from "./fetchers/youtube.mjs";
import { uploadsKey } from "./lib/uploads.mjs";
import { fetchTikTok } from "./fetchers/tiktok.mjs";
import { fetchBricklink } from "./fetchers/bricklink.mjs";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Die Daten liegen im PRIVATEN Repo; der Workflow checkt es nach ./private aus und setzt DATA_DIR. Ohne DATA_DIR (lokaler Lauf) gilt der Ordner dieses Repos.
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, "..");
const DATA_FILE = path.join(DATA_DIR, "data.js");
const ONLY_UPLOADS = process.env.SYNC_ONLY === "uploads";

function deepMerge(target, patch) {
  Object.keys(patch).forEach((key) => {
    if (
      patch[key] &&
      typeof patch[key] === "object" &&
      !Array.isArray(patch[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      deepMerge(target[key], patch[key]);
    } else {
      target[key] = patch[key];
    }
  });
  return target;
}

// Hängt einen Tages-Snapshot an den Verlauf einer Kennzahl an (für die Wochenvergleich-
// Trendpfeile bei Ziele-Karten). Ersetzt einen evtl. schon vorhandenen Eintrag vom selben
// Tag (z.B. bei mehrfachem manuellem Sync am selben Tag), hält nur die letzten 60 Tage.
function pushMetricHistory(history, key, value, todayKey) {
  if (value === undefined || value === null || Number.isNaN(value)) return;
  const arr = (history[key] || []).filter((h) => h.date !== todayKey);
  arr.push({ date: todayKey, value });
  arr.sort((a, b) => a.date.localeCompare(b.date));
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 60);
  history[key] = arr.filter((h) => new Date(h.date) >= cutoff);
}

async function main() {
  const DASHBOARD_DATA = require(DATA_FILE);
  const uploadsBefore = uploadsKey(DASHBOARD_DATA.business, UPLOAD_CHANNEL_KEYS);
  let changed = false;
  const succeeded = {};

  // Nacheinander statt parallel, und jeder Patch wird sofort in DASHBOARD_DATA gemergt,
  // bevor der nächste Fetcher startet. Wichtig, weil sowohl youtube.mjs als auch
  // tiktok.mjs das goals-Array lesen und schreiben — liefen sie parallel gegen denselben
  // Ausgangsstand, würde der zuletzt gemergte Patch die Änderungen des anderen überschreiben.
  const fetchers = ONLY_UPLOADS
    ? [["youtube", () => fetchYouTube(DASHBOARD_DATA, { uploadsOnly: true })]]
    : [
        ["time-tracker", () => fetchTimeTracker()],
        ["youtube", () => fetchYouTube(DASHBOARD_DATA)],
        ["tiktok", () => fetchTikTok(DASHBOARD_DATA)],
        ["bricklink", () => fetchBricklink(DASHBOARD_DATA)]
      ];

  for (const [label, run] of fetchers) {
    try {
      const patch = await run();
      if (patch) {
        deepMerge(DASHBOARD_DATA, patch);
        changed = true;
        succeeded[label] = true;
      }
    } catch (err) {
      console.error(`[${label}] fehlgeschlagen:`, err.message || err);
    }
  }

  if (!changed) {
    console.warn("Keine einzige Datenquelle war erreichbar/konfiguriert — data.js bleibt unverändert.");
    return;
  }

  // Schnellcheck: nur schreiben, wenn ein neues Video dazugekommen ist (die Liste der Video-IDs hat sich geändert)
  if (ONLY_UPLOADS && uploadsKey(DASHBOARD_DATA.business, UPLOAD_CHANNEL_KEYS) === uploadsBefore) {
    console.log("Keine neuen Videos — data.js bleibt unverändert.");
    return;
  }

  // Verlauf für die Wochenvergleich-Trendpfeile fortschreiben — nur mit Werten aus
  // Fetchern, die heute tatsächlich erfolgreich waren.
  DASHBOARD_DATA.metricsHistory = DASHBOARD_DATA.metricsHistory || {};
  const todayKey = new Date().toISOString().slice(0, 10);
  if (succeeded.youtube && !ONLY_UPLOADS) {
    const bricksAbos = DASHBOARD_DATA.goals.find((g) => g.id === "bricks-abos")?.current;
    const bwAbos = DASHBOARD_DATA.goals.find((g) => g.id === "brainwalkers-abos")?.current;
    pushMetricHistory(DASHBOARD_DATA.metricsHistory, "bricksOnTheFloorAbos", bricksAbos, todayKey);
    pushMetricHistory(DASHBOARD_DATA.metricsHistory, "brainwalkersAbos", bwAbos, todayKey);
  }
  if (succeeded.tiktok) {
    const tiktokFollower = DASHBOARD_DATA.goals.find((g) => g.id === "tiktok-follower")?.current;
    pushMetricHistory(DASHBOARD_DATA.metricsHistory, "tiktokFollower", tiktokFollower, todayKey);
  }

  // Der Schnellcheck ist kein Sync: "Stand" im Fuß der Seite bleibt beim letzten richtigen Lauf
  if (!ONLY_UPLOADS) {
    DASHBOARD_DATA.meta.lastUpdated = new Date().toISOString().slice(0, 10);
    DASHBOARD_DATA.meta.lastSyncedAt = new Date().toISOString();
  }

  const output = `// Datenquelle für das Dashboard.
// timeTracker, business.bricksOnTheFloor/brainwalkers (Abos/Videos/lastUploadAt/recentUploads),
// goals[tiktok-follower].current, bricklinkOrders, bricklinkRevenue, bricklinkMessages und metricsHistory
// (für die Wochenvergleich-Trendpfeile) werden automatisch von scripts/sync-all.mjs
// überschrieben (täglich per GitHub Actions oder manuell über den Sync-Button im
// Dashboard bzw. "node scripts/sync-all.mjs").
// Alles andere (goals-Zieltexte, restliche business-Felder, uploadRhythmDays) von
// Hand pflegen. Siehe README.md für Details.

const DASHBOARD_DATA = ${JSON.stringify(DASHBOARD_DATA, null, 2)};

if (typeof window !== "undefined") {
  window.DASHBOARD_DATA = DASHBOARD_DATA;
}
if (typeof module !== "undefined") {
  module.exports = DASHBOARD_DATA;
}
`;

  writeFileSync(DATA_FILE, output, "utf8");
  console.log("data.js aktualisiert.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
