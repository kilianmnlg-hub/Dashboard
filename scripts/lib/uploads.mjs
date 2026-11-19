// Erkennt neue Videos: vergleicht die abgerufenen Longform-Videos eines Kanals mit dem Stand des letzten Laufs
// (data.business.<Kanal>.recentUploads). Reine Funktionen ohne Node-Abhängigkeiten, damit sie sich auch im Browser testen lassen.
// Das Dashboard zeigt für jedes Video mit detectedAt automatisch die After-Upload-Checkliste (afterupload.js).
// Dazu die dauerhafte Liste aller Videos (uploadHistory) für den Upload-Kalender.

export const MAX_RECENT_UPLOADS = 5;

// fetched: [{ id, title, at }], neueste zuerst. previous: das bisherige recentUploads (Array), oder undefined, wenn es noch keinen Stand gibt.
// Ein Video gilt als NEU (detectedAt = jetzt), wenn es im letzten Stand noch nicht stand UND neuer ist als alles, was dort stand. Gibt es noch keinen
// Stand (erster Abruf nach dem Einführen, oder ein leerer), wird nur gemerkt: so gelten beim Einführen keine alten Videos als neu.
// Ergebnis: höchstens MAX_RECENT_UPLOADS Einträge { id, title, at, detectedAt }, detectedAt ist null oder ein ISO-Zeitpunkt.
export function markNewUploads(fetched, previous, nowIso) {
  const known = Array.isArray(previous) && previous.length ? previous : null;
  const byId = new Map((known || []).map((v) => [v.id, v]));
  const latestKnown = (known || []).reduce((max, v) => Math.max(max, Date.parse(v.at) || 0), 0);
  return (fetched || []).slice(0, MAX_RECENT_UPLOADS).map((v) => {
    const old = byId.get(v.id);
    let detectedAt = null;
    if (old) detectedAt = old.detectedAt || null;
    else if (known && (Date.parse(v.at) || 0) > latestKnown) detectedAt = nowIso;
    return { id: v.id, title: v.title, at: v.at, detectedAt };
  });
}

// Dauerhafte Liste ALLER bekannten Longform-Videos eines Kanals (data.business.<Kanal>.uploadHistory): { id, title, at }, neueste zuerst.
// Der Upload-Kalender liest sie, damit ein einmal veröffentlichtes Video dort bleibt, auch wenn es längst nicht mehr unter den letzten fünf steht (recentUploads).
// previous: die bisherige Liste (oder undefined). fetched: Videos aus diesem Abruf { id, title, at }, beliebige Reihenfolge; ihr Titel gilt (YouTube-Titel lassen sich ändern).
// since: optional, ISO-Zeitpunkt. Deckt der Abruf ALLE Videos seit diesem Zeitpunkt ab (voller Sync), fliegen bekannte Videos aus diesem Zeitraum raus, die
// YouTube nicht mehr nennt (gelöscht oder auf privat gestellt). Ohne since (Stundencheck) wird nur ergänzt, nie etwas entfernt.
export const MAX_UPLOAD_HISTORY = 400;

export function mergeUploadHistory(previous, fetched, since) {
  const sinceMs = since ? Date.parse(since) : NaN;
  const valid = (v) => v && v.id && isFinite(Date.parse(v.at));
  const fresh = (fetched || []).filter(valid);
  const seen = new Set(fresh.map((v) => v.id));
  const byId = new Map();
  (Array.isArray(previous) ? previous : []).forEach((v) => {
    if (!valid(v)) return;
    if (isFinite(sinceMs) && Date.parse(v.at) >= sinceMs && !seen.has(v.id)) return;
    byId.set(v.id, { id: v.id, title: String(v.title || ""), at: v.at });
  });
  fresh.forEach((v) => byId.set(v.id, { id: v.id, title: String(v.title || ""), at: v.at }));
  return [...byId.values()].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, MAX_UPLOAD_HISTORY);
}

// Kurzform der Video-IDs aller Kanäle: ändert sie sich, wurde ein neues Video erkannt (oder der Stand zum ersten Mal gespeichert)
export function uploadsKey(business, channelKeys) {
  return channelKeys.map((k) => ((business && business[k] && business[k].recentUploads) || []).map((v) => v.id).join(",")).join("|");
}
