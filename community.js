/* Community-Posts auf Bricks On The Floor: Rhythmus-Erinnerung. YouTube verraet ueber die API nichts ueber Community-Posts, darum tippst du in der Karte
   "Bricks On The Floor" auf GEPOSTET (oder GESTERN / anderer Tag). Das Dashboard merkt sich die Tage und rechnet daraus "vor X Tagen" und die Ampel
   (Ziel: alle 3 Tage: gruen bis zum 2. Tag, gelb am 3. Tag = heute faellig, rot danach). Die Tage liegen wie alles andere in der Cloud (Feld "community"
   in sync-data.json: posts = Liste von Tagen JJJJ-MM-TT, days = Ziel-Rhythmus, updatedAt), damit Handy und PC dasselbe wissen; der Cloudflare-Worker liest
   dasselbe Feld und schickt die Handy-Erinnerung. Zeitstempel-Prinzip wie beim Habit-Tracker: der neuere Stand gewinnt.
   script.js uebergibt dataStore und Auto-Sync und ruft applyRemote()/payload() auf. */
(function () {
  const MAX_POSTS = 120, DEFAULT_DAYS = 3, DAY = 86400000;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const addDays = (day, n) => new Date(utc(day) + n * DAY).toISOString().slice(0, 10);

  function sanitize(raw) {
    const out = { posts: [], days: DEFAULT_DAYS, updatedAt: 0 };
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    if (Number.isInteger(raw.days) && raw.days >= 1 && raw.days <= 30) out.days = raw.days;
    out.posts = Array.from(new Set((Array.isArray(raw.posts) ? raw.posts : []).filter(isDay))).sort().slice(-MAX_POSTS);
    return out;
  }

  window.createCommunity = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    const KEY = "dashboard-community-v1";
    let state = sanitize(null);
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: es gilt als noch kein Post eingetragen */ }

    const listeners = [];
    const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ein Anzeigefehler darf das Eintragen nicht stoppen */ } });
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const today = () => keyOf(new Date());
    const last = () => state.posts[state.posts.length - 1] || null;
    function touch() {
      state.updatedAt = Math.max(Date.now(), state.updatedAt + 1);
      persist();
      scheduleAutoSync("syncdata");
      emit();
    }
    function daysSince(now) {
      const l = last();
      return l ? Math.max(0, Math.round((utc(now || today()) - utc(l)) / DAY)) : null;
    }

    return {
      today,
      addDays,
      last,
      days: () => state.days,
      // Tage seit dem letzten Post (heute = 0), null solange noch kein Post eingetragen ist
      daysSince,
      // gruen = noch im Rhythmus, gelb = heute faellig (genau am Zieltag), rot = ueberfaellig, null = noch kein Post
      status(now) {
        const d = daysSince(now);
        if (d === null) return null;
        return d < state.days ? "green" : d === state.days ? "yellow" : "red";
      },
      // Anzahl Posts in den letzten span Tagen (heute mitgezaehlt)
      count(span, now) {
        const t = now || today(), from = addDays(t, -(span - 1));
        return state.posts.filter((p) => p >= from && p <= t).length;
      },
      // false, wenn der Tag ungueltig ist, in der Zukunft liegt oder schon eingetragen ist
      mark(day) {
        if (!isDay(day) || day > today() || state.posts.includes(day)) return false;
        state.posts = state.posts.concat(day).sort().slice(-MAX_POSTS);
        touch();
        return true;
      },
      // den neuesten Eintrag zuruecknehmen (zum Korrigieren eines Fehltipps); liefert den entfernten Tag, sonst null
      undo() {
        if (!state.posts.length) return null;
        const gone = state.posts[state.posts.length - 1];
        state.posts = state.posts.slice(0, -1);
        touch();
        return gone;
      },
      onChange(f) { listeners.push(f); },
      // Stand aus der Cloud: der neuere Zeitstempel gewinnt; ist der lokale neuer, geht er beim naechsten Auto-Sync hoch
      applyRemote(remote) {
        if (!remote || typeof remote !== "object") return;
        const r = sanitize(remote);
        if (r.updatedAt > state.updatedAt) {
          state = r;
          persist();
          emit();
        } else if (state.updatedAt > r.updatedAt) scheduleAutoSync("syncdata");
      },
      // Solange nie etwas eingetragen wurde, bleibt das Feld ganz weg (kein leerer Eintrag in sync-data.json)
      payload() {
        if (!state.posts.length && state.updatedAt <= 0) return null;
        return { posts: state.posts.slice(), days: state.days, updatedAt: Math.max(0, state.updatedAt) };
      }
    };
  };
})();
