// Schreibt im Dashboard erfasste Zeiteintraege (Zeittracker, Feld "timetracker" in sync-data.json) nach Notion
// und verschiebt dort in den Papierkorb, was im Dashboard geloescht wurde.
//
// Laeuft im selben GitHub-Actions-Workflow VOR dem Daten-Sync (sync-all.mjs), damit die neuen Eintraege direkt
// wieder in data.js landen. Ein Eintrag gilt als "schon in Notion", wenn dort ein Eintrag mit derselben Kategorie
// und derselben Start-Minute existiert (Notion speichert Zeiten nur minutengenau) - so entstehen keine Dubletten,
// auch wenn derselbe Eintrag mehrfach gesehen wird oder aus dem alten Notion-Tracker stammt.
//
// Benoetigt: NOTION_TOKEN mit Schreibrechten ("Insert content" / "Update content") auf die Zeittracker-Datenbank.
// Fehlt das Token oder die Berechtigung, wird nur gewarnt; der Workflow laeuft weiter (exit 0).

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";
import { DB_ID, queryAllPages } from "./fetchers/time-tracker.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SYNC_FILE = path.join(__dirname, "..", "sync-data.json");
const LABEL = { youtube: "YouTube", bricklink: "Bricklink" };
const CAT_BY_LABEL = { YouTube: "youtube", Bricklink: "bricklink" };
const MAX_CREATES = 60;
const NOTION_HEADERS = (token) => ({ Authorization: `Bearer ${token}`, "Notion-Version": "2022-06-28", "Content-Type": "application/json" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyOf = (cat, startMs) => `${cat}|${Math.floor(startMs / 60000)}`;

function titleFor(cat, startMs) {
  const f = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const p = Object.fromEntries(f.formatToParts(new Date(startMs)).map((x) => [x.type, x.value]));
  return `${LABEL[cat]} – ${p.day}.${p.month}.${p.year} ${p.hour}:${p.minute}`;
}

async function notion(token, method, url, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(url, { method, headers: NOTION_HEADERS(token), body: body ? JSON.stringify(body) : undefined });
    if (res.status === 429 && attempt === 0) {
      await sleep((Number(res.headers.get("retry-after")) || 2) * 1000);
      continue;
    }
    if (!res.ok) {
      const err = new Error(`Notion ${res.status}: ${(await res.text()).slice(0, 200)}`);
      err.status = res.status;
      throw err;
    }
    return res.json();
  }
}

async function main() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[push-timetracker] NOTION_TOKEN fehlt - uebersprungen.");
    return;
  }
  let tt;
  try {
    tt = JSON.parse(readFileSync(SYNC_FILE, "utf8")).timetracker;
  } catch (err) {
    console.warn("[push-timetracker] sync-data.json nicht lesbar - uebersprungen:", err.message);
    return;
  }
  const entries = Array.isArray(tt?.entries) ? tt.entries : [];
  const removed = new Set(Array.isArray(tt?.removed) ? tt.removed : []);
  if (!entries.length && !removed.size) {
    console.log("[push-timetracker] Nichts zu tun.");
    return;
  }

  // Aktueller Notion-Stand: Schluessel -> Seiten-IDs
  const pages = await queryAllPages(token);
  const byKey = new Map();
  pages.forEach((page) => {
    const cat = CAT_BY_LABEL[page.properties?.["Kategorie"]?.select?.name];
    const start = Date.parse(page.properties?.["Start"]?.date?.start);
    if (!cat || !Number.isFinite(start)) return;
    const k = keyOf(cat, start);
    byKey.set(k, [...(byKey.get(k) || []), page.id]);
  });

  let created = 0, archived = 0, failed = 0;
  const toCreate = entries.filter((e) => {
    if (!e || !LABEL[e.cat] || !Number.isFinite(e.start) || !Number.isFinite(e.end) || e.end < e.start) return false;
    const k = keyOf(e.cat, e.start);
    return !byKey.has(k) && !removed.has(k);
  });

  for (const e of toCreate.slice(0, MAX_CREATES)) {
    try {
      await notion(token, "POST", "https://api.notion.com/v1/pages", {
        parent: { database_id: DB_ID },
        properties: {
          Name: { title: [{ text: { content: titleFor(e.cat, e.start) } }] },
          Kategorie: { select: { name: LABEL[e.cat] } },
          Start: { date: { start: new Date(e.start).toISOString() } },
          Ende: { date: { start: new Date(e.end).toISOString() } },
          "Dauer (Min)": { number: Math.round(((e.end - e.start) / 60000) * 100) / 100 }
        }
      });
      created++;
    } catch (err) {
      failed++;
      console.error("[push-timetracker] Eintrag nicht angelegt:", err.message);
      if (err.status === 401 || err.status === 403) {
        console.error("[push-timetracker] Die Notion-Integration braucht Schreibrechte auf die Zeittracker-Datenbank (Insert/Update content). Abbruch.");
        return;
      }
    }
    await sleep(350);
  }
  if (toCreate.length > MAX_CREATES) console.warn(`[push-timetracker] ${toCreate.length - MAX_CREATES} weitere Eintraege beim naechsten Lauf.`);

  for (const k of removed) {
    for (const id of byKey.get(k) || []) {
      try {
        await notion(token, "PATCH", `https://api.notion.com/v1/pages/${id}`, { archived: true });
        archived++;
      } catch (err) {
        failed++;
        console.error("[push-timetracker] Eintrag nicht geloescht:", err.message);
        if (err.status === 401 || err.status === 403) return;
      }
      await sleep(350);
    }
  }
  console.log(`[push-timetracker] ${created} angelegt, ${archived} in den Papierkorb verschoben, ${failed} fehlgeschlagen.`);
}

main().catch((err) => {
  // Nie den Workflow kippen: der Daten-Sync danach soll auf jeden Fall laufen.
  console.error("[push-timetracker] fehlgeschlagen:", err.message || err);
});
