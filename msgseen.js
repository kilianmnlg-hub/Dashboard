/* Bricklink-Nachrichten: was ist "ungelesen"? Die Bricklink-API verraet nicht, was du dort schon geoeffnet hast. Darum merkt sich das Dashboard selbst,
   welche Kaeufer-Nachrichten (data.bricklinkMessages.items, vom Sync geholt: Bestellnummer, Nachrichten-ID, Zeitpunkt) du von hier aus geoeffnet oder mit
   "Alle gelesen" abgehakt hast. Ungelesen = Kaeufer-Nachricht ohne Antwort des Shops, die noch nicht abgehakt ist; antwortest du in Bricklink, verschwindet
   sie beim naechsten Sync von selbst. Die abgehakten IDs liegen wie alles andere in der Cloud (Feld "msgSeen" in sync-data.json), damit Handy und PC
   dasselbe wissen; sie werden nur vereinigt, nie zurueckgenommen.
   script.js uebergibt dataStore, Auto-Sync und die Nachrichtenliste und ruft applyRemote()/payload() auf. */
(function () {
  const MAX_IDS = 300;
  const isNum = (v) => typeof v === "number" && isFinite(v);

  function sanitize(raw) {
    const out = { ids: [], updatedAt: 0 };
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    (Array.isArray(raw.ids) ? raw.ids : []).forEach((id) => {
      const s = String(id);
      if (s && !out.ids.includes(s)) out.ids.push(s);
    });
    out.ids = out.ids.slice(-MAX_IDS);
    return out;
  }

  // null = der Datenstand kennt noch keine Einzelnachrichten (der erste Sync damit steht aus)
  function cleanItems(items) {
    if (!Array.isArray(items)) return null;
    return items
      .filter((i) => i && i.order && i.id)
      .map((i) => ({ order: String(i.order), id: String(i.id), at: typeof i.at === "string" ? i.at : null }));
  }

  window.createMsgSeen = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    const items = cleanItems(deps.items);
    const KEY = "dashboard-msgseen-v1";
    let state = sanitize(null);
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: alles gilt als ungelesen */ }

    const listeners = [];
    const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ein Anzeigefehler darf das Abhaken nicht stoppen */ } });
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const unseen = () => (items ? items.filter((i) => !state.ids.includes(i.id)) : null);

    function mark(ids) {
      const add = ids.filter((id) => !state.ids.includes(id));
      if (!add.length) return 0;
      state.ids = state.ids.concat(add).slice(-MAX_IDS);
      state.updatedAt = Date.now();
      persist();
      scheduleAutoSync("syncdata");
      emit();
      return add.length;
    }

    return {
      // Ungelesene Einzelnachrichten, neueste zuerst (null, solange der Datenstand keine Liste hat)
      list: unseen,
      count() { const u = unseen(); return u ? u.length : null; },
      markOrder(order) { const u = unseen(); return u ? mark(u.filter((i) => i.order === String(order)).map((i) => i.id)) : 0; },
      markAll() { const u = unseen(); return u ? mark(u.map((i) => i.id)) : 0; },
      onChange(f) { listeners.push(f); },
      // Abgehakte IDs aus der Cloud vereinigen; was nur hier abgehakt ist, geht beim naechsten Auto-Sync hoch
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote);
        const have = new Set(state.ids);
        let added = false;
        r.ids.forEach((id) => { if (!have.has(id)) { state.ids.push(id); have.add(id); added = true; } });
        const remoteSet = new Set(r.ids);
        const localOnly = state.ids.some((id) => !remoteSet.has(id));
        state.ids = state.ids.slice(-MAX_IDS);
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        persist();
        if (added) emit();
        if (localOnly) scheduleAutoSync("syncdata");
      },
      // Solange nichts abgehakt wurde, bleibt das Feld ganz weg (kein leerer Eintrag in sync-data.json)
      payload() { return state.ids.length ? { ids: state.ids.slice(), updatedAt: Math.max(0, state.updatedAt) } : null; }
    };
  };
})();
