// Holt öffentliche Kanal-Statistiken (Abonnenten, Video-Anzahl, letztes Longform-Upload-Datum)
// über die YouTube Data API v3. Benötigt: YOUTUBE_API_KEY (kostenloser Google Cloud API-Key,
// keine OAuth-Anmeldung nötig, da nur öffentliche Statistiken abgefragt werden).
//
// Neue Videos: Zusätzlich zu lastUploadAt steht in business.<Kanal>.recentUploads die Liste der letzten Longform-Videos
// (id, title, at, detectedAt). detectedAt setzt dieser Abruf, sobald ein Video neu dazugekommen ist (scripts/lib/uploads.mjs);
// das Dashboard zeigt dann automatisch die After-Upload-Checkliste. Mit { uploadsOnly: true } fragt der stündliche
// Schnellcheck (.github/workflows/check-uploads.yml) nur danach und fasst Abos und Ziele nicht an.
//
// Dauerhafte Liste: business.<Kanal>.uploadHistory (id, title, at) behält jedes Longform-Video, auch wenn es nicht mehr unter den letzten
// fünf steht. Der Upload-Kalender liest sie, damit veröffentlichte Videos dort von allein stehen bleiben. Der Stundencheck ergänzt sie um neue
// Videos; der volle Sync holt dazu alle Longform-Videos seit dem 1. Januar des Vorjahres (dieselben Abfragen wie für das Jahresziel) und gleicht
// die Liste damit ab (gelöschte oder private Videos verschwinden wieder).
//
// Wichtig: Views/Wiedergabezeit/Umsatz der letzten 28 Tage stehen NICHT über diese API zur
// Verfügung (das sind private Studio-Analytics-Daten, die einen OAuth-Login des Kanalinhabers
// erfordern) und bleiben deshalb weiterhin manuell in data.js gepflegt.

import { markNewUploads, mergeUploadHistory } from "../lib/uploads.mjs";

const CHANNELS = [
  { handle: "bricksonthefloor610", key: "bricksOnTheFloor", goalId: "bricks-abos", longformGoalId: "bricks-longform-2026" },
  { handle: "thebrainwalkers", key: "brainwalkers", goalId: "brainwalkers-abos", longformGoalId: "brainwalkers-longform-2026" }
];
export const UPLOAD_CHANNEL_KEYS = CHANNELS.map((c) => c.key);

// YouTube erlaubt Shorts inzwischen bis zu 3 Minuten. Die Data API kennzeichnet Videos nicht
// explizit als "Short" — als Näherung gilt hier alles bis einschließlich 180s als Short und
// wird beim Upload-Rhythmus ignoriert, nur echte Longform-Videos zählen.
const SHORTS_MAX_SECONDS = 180;
const PLAYLIST_SAMPLE_SIZE = 50;

const newestFirst = (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0);

function parseIsoDuration(iso) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!match) return 0;
  const [, h, m, s] = match;
  return Number(h || 0) * 3600 + Number(m || 0) * 60 + Number(s || 0);
}

async function fetchChannelStats(handle, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&forHandle=${encodeURIComponent(handle)}&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API Fehler ${res.status} für @${handle}: ${await res.text()}`);
  const json = await res.json();
  const item = json.items?.[0];
  if (!item) throw new Error(`Kein YouTube-Kanal gefunden für Handle @${handle}`);
  return {
    subscriberCount: Number(item.statistics.subscriberCount),
    videoCount: Number(item.statistics.videoCount),
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads
  };
}

// Welche Einträge einer Playlist-Seite sind Longform-Videos? Fragt dafür die Dauer ab (max. 50 IDs je Aufruf, eine Seite passt immer)
// und liefert { id, title, at } der Videos über SHORTS_MAX_SECONDS. Einträge ohne Veröffentlichungsdatum (privat, gelöscht) fallen weg.
async function longformOf(items, apiKey) {
  const dated = items.filter((i) => i.contentDetails?.videoId && i.contentDetails.videoPublishedAt);
  if (dated.length === 0) return [];
  const videoIds = dated.map((i) => i.contentDetails.videoId).join(",");
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) throw new Error(`YouTube API Fehler ${videosRes.status} bei Video-Details: ${await videosRes.text()}`);
  const videosJson = await videosRes.json();

  const durationById = {};
  (videosJson.items || []).forEach((v) => {
    durationById[v.id] = parseIsoDuration(v.contentDetails.duration);
  });

  return dated
    .filter((i) => (durationById[i.contentDetails.videoId] || 0) > SHORTS_MAX_SECONDS)
    .map((i) => ({ id: i.contentDetails.videoId, title: String(i.snippet?.title || "").slice(0, 120), at: i.contentDetails.videoPublishedAt }));
}

// Die letzten Longform-Videos (neueste zuerst) aus den jüngsten Uploads des Kanals: { id, title, at }.
async function fetchRecentLongform(playlistId, apiKey) {
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=${PLAYLIST_SAMPLE_SIZE}&key=${apiKey}`;
  const playlistRes = await fetch(playlistUrl);
  if (!playlistRes.ok) throw new Error(`YouTube API Fehler ${playlistRes.status} bei Uploads-Playlist ${playlistId}: ${await playlistRes.text()}`);
  const playlistJson = await playlistRes.json();
  const items = playlistJson.items || [];
  if (items.length === 0) return [];

  const longform = (await longformOf(items, apiKey)).sort(newestFirst);

  if (longform.length === 0) {
    console.warn(`[youtube] Kein Longform-Video unter den letzten ${PLAYLIST_SAMPLE_SIZE} Uploads gefunden.`);
  }
  return longform;
}

// Alle Longform-Videos seit sinceDate (neueste zuerst): { id, title, at }. Blättert die Uploads-Playlist (neueste zuerst) seitenweise durch und
// bricht ab, sobald ein Video vor sinceDate liegt, statt den ganzen Kanal-Verlauf zu laden. Daraus kommen das "X Longform-Videos in [Jahr]"-Ziel
// (gezählt wird ab dem 1. Januar des laufenden Jahres) und die dauerhafte Liste uploadHistory für den Upload-Kalender.
async function fetchLongformSince(playlistId, apiKey, sinceDate) {
  const found = [];
  let pageToken = "";
  let reachedStart = false;

  while (!reachedStart) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails,snippet&playlistId=${playlistId}&maxResults=50&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API Fehler ${res.status} bei Uploads-Playlist ${playlistId}: ${await res.text()}`);
    const json = await res.json();
    // Eine Seite kann kürzer oder (wenn alle Einträge privat/gelöscht sind) leer sein, ohne dass die Liste zu Ende ist: erst ohne nächsten Seiten-Token ist Schluss
    const inRange = [];
    for (const item of json.items || []) {
      const publishedAt = item.contentDetails?.videoPublishedAt;
      if (publishedAt && new Date(publishedAt) < sinceDate) {
        reachedStart = true;
        break;
      }
      inRange.push(item);
    }
    found.push(...(await longformOf(inRange, apiKey)));

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return found.sort(newestFirst);
}

export async function fetchYouTube(currentData, { uploadsOnly = false } = {}) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[youtube] YOUTUBE_API_KEY fehlt — übersprungen.");
    return null;
  }

  const patch = uploadsOnly ? { business: {} } : { business: {}, goals: [...currentData.goals] };
  const thisYear = new Date().getUTCFullYear();
  const yearStartMs = Date.UTC(thisYear, 0, 1);
  const historySince = new Date(Date.UTC(thisYear - 1, 0, 1));

  for (const { handle, key, goalId, longformGoalId } of CHANNELS) {
    try {
      const stats = await fetchChannelStats(handle, apiKey);
      const recent = await fetchRecentLongform(stats.uploadsPlaylistId, apiKey);
      const lastUploadAt = recent[0]?.at ?? null;
      // Ohne Treffer (z.B. leere Antwort) den bisherigen Stand behalten, sonst ginge die Vergleichsbasis verloren
      const previous = currentData.business[key]?.recentUploads;
      const recentUploads = recent.length ? markNewUploads(recent, previous, new Date().toISOString()) : previous;
      const fresh = (recentUploads || []).filter((v) => v.detectedAt && !(previous || []).some((p) => p.id === v.id));
      if (fresh.length) console.log(`[youtube] @${handle}: NEUES VIDEO erkannt: ${fresh.map((v) => `${v.id} "${v.title}"`).join(", ")}`);
      // Dauerhafte Liste aller Videos: hier nur um die jüngsten ergänzt, der volle Sync gleicht sie weiter unten mit dem ganzen Zeitraum ab
      const previousHistory = currentData.business[key]?.uploadHistory;
      const uploadHistory = mergeUploadHistory(previousHistory, recent);

      if (uploadsOnly) {
        console.log(`[youtube] @${handle}: letztes Longform-Upload ${lastUploadAt}`);
        patch.business[key] = {
          ...(lastUploadAt ? { lastUploadAt } : {}),
          ...(recentUploads ? { recentUploads } : {}),
          ...(uploadHistory.length ? { uploadHistory } : {})
        };
        continue;
      }
      console.log(`[youtube] @${handle}: ${stats.subscriberCount} Abos, ${stats.videoCount} Videos, letztes Longform-Upload ${lastUploadAt}`);

      const biz = { ...currentData.business[key] };
      biz.stats = biz.stats.map((s) =>
        s.label === "Abonnenten" ? { ...s, value: stats.subscriberCount.toLocaleString("de-DE") } : s
      );
      if (key === "brainwalkers") {
        biz.stats = biz.stats.map((s) => (s.label === "Videos" ? { ...s, value: String(stats.videoCount) } : s));
      }
      biz.lastUploadAt = lastUploadAt;
      if (recentUploads) biz.recentUploads = recentUploads;
      if (uploadHistory.length) biz.uploadHistory = uploadHistory;
      patch.business[key] = biz;

      patch.goals = patch.goals.map((g) => (g.id === goalId ? { ...g, current: stats.subscriberCount } : g));

      // Alle Longform-Videos seit Jahresanfang des Vorjahres: ergibt das Jahresziel (ab 1. Januar) und die vollständige Liste für den Upload-Kalender.
      // Scheitert diese Abfrage, bleiben Abos und die um die jüngsten Videos ergänzte Liste trotzdem im Patch.
      const longform = await fetchLongformSince(stats.uploadsPlaylistId, apiKey, historySince);
      biz.uploadHistory = mergeUploadHistory(previousHistory, [...recent, ...longform], historySince.toISOString());
      console.log(`[youtube] @${handle}: ${biz.uploadHistory.length} Longform-Videos in der Upload-Liste (seit ${historySince.toISOString().slice(0, 10)}).`);

      if (longformGoalId && patch.goals.some((g) => g.id === longformGoalId)) {
        const longformCount = longform.filter((v) => Date.parse(v.at) >= yearStartMs).length;
        console.log(`[youtube] @${handle}: ${longformCount} Longform-Videos seit Jahresanfang.`);
        patch.goals = patch.goals.map((g) => (g.id === longformGoalId ? { ...g, current: longformCount } : g));
      }
    } catch (err) {
      console.error(`[youtube] Fehler bei @${handle}:`, err.message);
    }
  }

  return patch;
}
