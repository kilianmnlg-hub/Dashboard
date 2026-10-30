// Holt die Follower-Zahl von TikTok durch Auslesen der öffentlichen Profilseite.
// TikTok bietet (anders als YouTube) keine öffentliche Statistik-API mit einfachem API-Key —
// die offizielle API erfordert eine geprüfte Developer-App plus OAuth-Login des Kontoinhabers.
// Deshalb hier bewusst ein Seiten-Scrape: kein Login nötig, läuft sofort, ist aber nicht von
// TikTok unterstützt und kann brechen, wenn TikTok das Seitenformat ändert — bricht in dem
// Fall nur diesen einen Fetcher ab (mit Warnung im Log), der Rest des Syncs läuft normal weiter.

const TIKTOK_HANDLE = "bricksonthefloor";
const GOAL_ID = "tiktok-follower";

async function fetchFollowerCount(handle) {
  const res = await fetch(`https://www.tiktok.com/@${handle}`, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
      "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
    }
  });
  if (!res.ok) throw new Error(`TikTok Fehler ${res.status}`);
  const html = await res.text();
  const match = html.match(/"followerCount":(\d+)/);
  if (!match) throw new Error("followerCount nicht im HTML gefunden — TikTok hat evtl. das Seitenformat geändert");
  return Number(match[1]);
}

export async function fetchTikTok(currentData) {
  try {
    const followerCount = await fetchFollowerCount(TIKTOK_HANDLE);
    console.log(`[tiktok] @${TIKTOK_HANDLE}: ${followerCount} Follower`);

    const goals = currentData.goals.map((g) => (g.id === GOAL_ID ? { ...g, current: followerCount } : g));
    return { goals };
  } catch (err) {
    console.warn(`[tiktok] Übersprungen: ${err.message}`);
    return null;
  }
}
