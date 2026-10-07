// Holt Zeiteinträge aus der Notion-"Zeittracker"-Datenbank.
// Benötigt: NOTION_TOKEN. Optional: NOTION_TIME_DB_ID, DAYS (Default 400 — genug für die
// Jahresansicht im Dashboard; queryAllPages holt ohnehin die komplette Notion-Historie,
// DAYS filtert nur, wie viel davon im Dashboard-JSON landet).
export const DB_ID = process.env.NOTION_TIME_DB_ID || "c5d2b5d1-7bb8-41a8-b08c-b51cfea9c34e";
const DAYS = Number(process.env.DAYS || 400);

export async function queryAllPages(token) {
  const results = [];
  let cursor;
  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(cursor ? { start_cursor: cursor } : {})
    });
    if (!res.ok) throw new Error(`Notion API Fehler ${res.status}: ${await res.text()}`);
    const json = await res.json();
    results.push(...json.results);
    cursor = json.has_more ? json.next_cursor : undefined;
  } while (cursor);
  return results;
}

function extractEntry(page) {
  const props = page.properties;
  const kategorie = props["Kategorie"]?.select?.name || "Sonstiges";
  const start = props["Start"]?.date?.start;
  const dauer = props["Dauer (Min)"]?.number;
  if (!start || typeof dauer !== "number") return null;
  return { id: page.id, kategorie, date: start.slice(0, 10), minutes: dauer, start, end: props["Ende"]?.date?.start || null };
}

// Einzelne Eintraege fuer den Zeittracker im Dashboard (Start/Ende als Zeitstempel in ms, damit Tages-Detail und
// Verlauf moeglich sind). Nur YouTube/Bricklink; "min" ist die in Notion erfasste Dauer (auf Sekunden genau).
const CAT_BY_LABEL = { YouTube: "youtube", Bricklink: "bricklink" };
function buildEntries(list) {
  const cutoff = Date.now() - DAYS * 86400000;
  return list
    .map((e) => {
      const cat = CAT_BY_LABEL[e.kategorie];
      const start = Date.parse(e.start);
      if (!cat || !Number.isFinite(start) || start < cutoff) return null;
      let end = e.end ? Date.parse(e.end) : NaN;
      if (!Number.isFinite(end) || end < start) end = start + e.minutes * 60000;
      return { id: e.id, cat, start, end, min: Math.round(e.minutes * 100) / 100 };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

function aggregate(entries) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  const cutoffKey = cutoff.toISOString().slice(0, 10);

  const recent = entries.filter((e) => e.date >= cutoffKey);
  const totalsByCategory = {};
  const byDate = {};

  recent.forEach(({ kategorie, date, minutes }) => {
    totalsByCategory[kategorie] = (totalsByCategory[kategorie] || 0) + minutes;
    byDate[date] = byDate[date] || {};
    byDate[date][kategorie] = (byDate[date][kategorie] || 0) + minutes;
  });

  const categories = Object.keys(totalsByCategory);
  const dates = Object.keys(byDate).sort();
  const daily = dates.map((date) => {
    const row = { date };
    categories.forEach((c) => (row[c] = Math.round((byDate[date][c] || 0) * 100) / 100));
    return row;
  });

  Object.keys(totalsByCategory).forEach((c) => {
    totalsByCategory[c] = Math.round(totalsByCategory[c] * 100) / 100;
  });

  return {
    source: "Notion – Zeittracker",
    range: { from: dates[0] || null, to: dates[dates.length - 1] || null },
    totalsByCategory,
    daily
  };
}

export async function fetchTimeTracker() {
  const token = process.env.NOTION_TOKEN;
  if (!token) {
    console.warn("[time-tracker] NOTION_TOKEN fehlt — übersprungen.");
    return null;
  }
  const pages = await queryAllPages(token);
  const entries = pages.map(extractEntry).filter(Boolean);
  const timeTracker = aggregate(entries);
  try {
    timeTracker.entries = buildEntries(entries);
  } catch (err) {
    // Die Einzel-Eintraege sind ein Zusatz: scheitern sie, bleibt der bisherige Tagessummen-Sync unberuehrt.
    console.warn("[time-tracker] Einzel-Eintraege nicht erzeugt:", err.message || err);
  }
  console.log(`[time-tracker] ${entries.length} Einträge, Zeitraum ${timeTracker.range.from} – ${timeTracker.range.to}, ${timeTracker.entries?.length ?? 0} Einzel-Einträge`);
  return { timeTracker };
}
