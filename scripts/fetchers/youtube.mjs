// Holt öffentliche Kanal-Statistiken (Abonnenten, Video-Anzahl, letztes Upload-Datum) über
// die YouTube Data API v3. Benötigt: YOUTUBE_API_KEY (kostenloser Google Cloud API-Key,
// keine OAuth-Anmeldung nötig, da nur öffentliche Statistiken abgefragt werden).
//
// Wichtig: Views/Wiedergabezeit/Umsatz der letzten 28 Tage stehen NICHT über diese API zur
// Verfügung (das sind private Studio-Analytics-Daten, die einen OAuth-Login des Kanalinhabers
// erfordern) und bleiben deshalb weiterhin manuell in data.js gepflegt.

const CHANNELS = [
  { handle: "bricksonthefloor610", key: "bricksOnTheFloor", goalId: "bricks-abos" },
  { handle: "thebrainwalkers", key: "brainwalkers", goalId: "brainwalkers-abos" }
];

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

async function fetchLastUploadDate(playlistId, apiKey) {
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${playlistId}&maxResults=1&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`YouTube API Fehler ${res.status} bei Uploads-Playlist ${playlistId}: ${await res.text()}`);
  const json = await res.json();
  return json.items?.[0]?.contentDetails?.videoPublishedAt || null;
}

export async function fetchYouTube(currentData) {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn("[youtube] YOUTUBE_API_KEY fehlt — übersprungen.");
    return null;
  }

  const patch = { business: {}, goals: [...currentData.goals] };

  for (const { handle, key, goalId } of CHANNELS) {
    try {
      const stats = await fetchChannelStats(handle, apiKey);
      const lastUploadAt = await fetchLastUploadDate(stats.uploadsPlaylistId, apiKey);
      console.log(`[youtube] @${handle}: ${stats.subscriberCount} Abos, ${stats.videoCount} Videos, letztes Upload ${lastUploadAt}`);

      const biz = { ...currentData.business[key] };
      biz.stats = biz.stats.map((s) =>
        s.label === "Abonnenten" ? { ...s, value: stats.subscriberCount.toLocaleString("de-DE") } : s
      );
      if (key === "brainwalkers") {
        biz.stats = biz.stats.map((s) => (s.label === "Videos" ? { ...s, value: String(stats.videoCount) } : s));
      }
      biz.lastUploadAt = lastUploadAt;
      patch.business[key] = biz;

      patch.goals = patch.goals.map((g) => (g.id === goalId ? { ...g, current: stats.subscriberCount } : g));
    } catch (err) {
      console.error(`[youtube] Fehler bei @${handle}:`, err.message);
    }
  }

  return patch;
}
