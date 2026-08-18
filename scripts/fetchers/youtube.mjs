// Holt öffentliche Kanal-Statistiken (Abonnenten, Video-Anzahl, letztes Longform-Upload-Datum)
// über die YouTube Data API v3. Benötigt: YOUTUBE_API_KEY (kostenloser Google Cloud API-Key,
// keine OAuth-Anmeldung nötig, da nur öffentliche Statistiken abgefragt werden).
//
// Wichtig: Views/Wiedergabezeit/Umsatz der letzten 28 Tage stehen NICHT über diese API zur
// Verfügung (das sind private Studio-Analytics-Daten, die einen OAuth-Login des Kanalinhabers
// erfordern) und bleiben deshalb weiterhin manuell in data.js gepflegt.

const CHANNELS = [
  { handle: "bricksonthefloor610", key: "bricksOnTheFloor", goalId: "bricks-abos", longformGoalId: "bricks-longform-2026" },
  { handle: "thebrainwalkers", key: "brainwalkers", goalId: "brainwalkers-abos", longformGoalId: "brainwalkers-longform-2026" }
];

// YouTube erlaubt Shorts inzwischen bis zu 3 Minuten. Die Data API kennzeichnet Videos nicht
// explizit als "Short" — als Näherung gilt hier alles bis einschließlich 180s als Short und
// wird beim Upload-Rhythmus ignoriert, nur echte Longform-Videos zählen.
const SHORTS_MAX_SECONDS = 180;
const PLAYLIST_SAMPLE_SIZE = 50;

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

async function fetchLastLongformUploadDate(playlistId, apiKey) {
  const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=${PLAYLIST_SAMPLE_SIZE}&key=${apiKey}`;
  const playlistRes = await fetch(playlistUrl);
  if (!playlistRes.ok) throw new Error(`YouTube API Fehler ${playlistRes.status} bei Uploads-Playlist ${playlistId}: ${await playlistRes.text()}`);
  const playlistJson = await playlistRes.json();
  const items = playlistJson.items || [];
  if (items.length === 0) return null;

  const videoIds = items.map((i) => i.contentDetails.videoId).join(",");
  const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoIds}&key=${apiKey}`;
  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) throw new Error(`YouTube API Fehler ${videosRes.status} bei Video-Details: ${await videosRes.text()}`);
  const videosJson = await videosRes.json();

  const durationById = {};
  (videosJson.items || []).forEach((v) => {
    durationById[v.id] = parseIsoDuration(v.contentDetails.duration);
  });

  const longformDates = items
    .filter((i) => (durationById[i.contentDetails.videoId] || 0) > SHORTS_MAX_SECONDS)
    .map((i) => i.contentDetails.videoPublishedAt)
    .filter(Boolean)
    .sort()
    .reverse();

  if (longformDates.length === 0) {
    console.warn(`[youtube] Kein Longform-Video unter den letzten ${PLAYLIST_SAMPLE_SIZE} Uploads gefunden.`);
    return null;
  }
  return longformDates[0];
}

// Zählt Longform-Uploads seit dem 1. Januar des laufenden Jahres — für das "X Longform-
// Videos in [Jahr]"-Ziel. Blättert die Uploads-Playlist (neueste zuerst) seitenweise durch
// und bricht ab, sobald ein Video vor dem Jahresanfang liegt, statt den ganzen Kanal-
// Verlauf zu laden.
async function fetchLongformCountThisYear(playlistId, apiKey) {
  const yearStart = new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  let count = 0;
  let pageToken = "";
  let reachedLastYear = false;

  while (!reachedLastYear) {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=50&key=${apiKey}${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`YouTube API Fehler ${res.status} bei Uploads-Playlist ${playlistId}: ${await res.text()}`);
    const json = await res.json();
    const items = json.items || [];
    if (items.length === 0) break;

    const inYear = [];
    for (const item of items) {
      const publishedAt = item.contentDetails.videoPublishedAt;
      if (publishedAt && new Date(publishedAt) < yearStart) {
        reachedLastYear = true;
        break;
      }
      inYear.push(item.contentDetails.videoId);
    }

    // Dauer der Videos dieser Seite abfragen (max. 50 IDs pro Aufruf erlaubt, passt hier immer).
    if (inYear.length > 0) {
      const videosUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${inYear.join(",")}&key=${apiKey}`;
      const videosRes = await fetch(videosUrl);
      if (!videosRes.ok) throw new Error(`YouTube API Fehler ${videosRes.status} bei Video-Details: ${await videosRes.text()}`);
      const videosJson = await videosRes.json();
      (videosJson.items || []).forEach((v) => {
        if (parseIsoDuration(v.contentDetails.duration) > SHORTS_MAX_SECONDS) count += 1;
      });
    }

    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }

  return count;
}

export async function fetchYouTube(currentData) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[youtube] YOUTUBE_API_KEY fehlt — übersprungen.");
    return null;
  }

  const patch = { business: {}, goals: [...currentData.goals] };

  for (const { handle, key, goalId, longformGoalId } of CHANNELS) {
    try {
      const stats = await fetchChannelStats(handle, apiKey);
      const lastUploadAt = await fetchLastLongformUploadDate(stats.uploadsPlaylistId, apiKey);
      console.log(`[youtube] @${handle}: ${stats.subscriberCount} Abos, ${stats.videoCount} Videos, letztes Longform-Upload ${lastUploadAt}`);

      const biz = { ...currentData.business[key] };
      biz.stats = biz.stats.map((s) =>
        s.label === "Abonnenten" ? { ...s, value: stats.subscriberCount.toLocaleString("de-DE") } : s
      );
      if (key === "brainwalkers") {
        biz.stats = biz.stats.map((s) => (s.label === "Videos" ? { ...s, value: String(stats.videoCount) } : s));
      }
      biz.lastUploadAt = lastUploadAt;
      patch.business[key] = biz;

      if (longformGoalId && patch.goals.some((g) => g.id === longformGoalId)) {
        const longformCount = await fetchLongformCountThisYear(stats.uploadsPlaylistId, apiKey);
        console.log(`[youtube] @${handle}: ${longformCount} Longform-Videos seit Jahresanfang.`);
        patch.goals = patch.goals.map((g) => (g.id === longformGoalId ? { ...g, current: longformCount } : g));
      }

      patch.goals = patch.goals.map((g) => (g.id === goalId ? { ...g, current: stats.subscriberCount } : g));
    } catch (err) {
      console.error(`[youtube] Fehler bei @${handle}:`, err.message);
    }
  }

  return patch;
}
