/* Mein Raum: Das Minigame (Ordner raumspiel/) ist ein eigenstaendiges Pixelspiel, hier sitzt nur die Anbindung.
   - Kachel im Bereich "Mein Raum": Stunden zum Ausgeben, Level, naechste Freischaltung, Vorschaubild und der Knopf "Raum oeffnen".
   - Das Spiel laeuft als Vollbild-Overlay (iframe, gleiche Herkunft) und spricht ueber postMessage mit dieser Datei:
       Spiel -> hier:  hello | save { state, spent, next, thumb } | close | flushed
       hier -> Spiel:  init { economy, state } | economy { economy } | flush
   - Stunden: nur Zeit seit dem 1. Oktober 2026 (Zeittracker inkl. Notion-Verlauf, dazu Training; eine Einheit zaehlt hoechstens 3 Stunden).
     Level: aus dem Level-System (xp.js). Ausgegeben wird im Spiel; Guthaben = verdient - ausgegeben.
   - Speicherung: Spielstand in der Cloud (Feld room in sync-data.json, neuerer Stand gewinnt). Das Vorschaubild liegt nur im Browser (geraetebezogen).
   script.js uebergibt dataStore, Auto-Sync, getHours(since), getLevel() und ruft applyRemote()/payload() auf. */
(function () {
  const SINCE = new Date(2026, 9, 1).getTime(); // 1. Oktober 2026, 0 Uhr (Ortszeit)
  const SINCE_TXT = "1. Oktober";
  const GAME_URL = "raumspiel/index.html";
  const GAME_VER = "20261022b";
  const KEY = "dashboard-room-v2", THUMB_KEY = "dashboard-room-thumb", NEXT_KEY = "dashboard-room-next";
  const MAX_STATE = 200000; // Zeichen; schuetzt die Cloud-Datei vor Ausreissern
  const SYNC_DELAY = 4000; // Aenderungen im Spiel werden gebuendelt in die Cloud geschickt
  const THUMB_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const empty = () => ({ w: null, spent: 0, updatedAt: -1 });
  const sizeOk = (o) => { try { return JSON.stringify(o).length <= MAX_STATE; } catch (e) { return false; } };

  function sanitize(raw) {
    const out = empty();
    if (!raw || typeof raw !== "object") return out;
    out.updatedAt = isNum(raw.updatedAt) ? raw.updatedAt : 0;
    if (isNum(raw.spent) && raw.spent >= 0) out.spent = Math.round(raw.spent * 100) / 100;
    if (raw.w && typeof raw.w === "object" && sizeOk(raw.w)) out.w = raw.w;
    return out;
  }

  window.createRoom = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    const esc = deps.escapeHtml || ((s) => String(s));
    const host = document.getElementById("rmHost");
    let state = empty(), ready = false, frame = null, overlay = null, tick = null, closing = null, syncT = null, hasPush = false;
    let thumb = "", next = null;
    try { const raw = dataStore.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); } catch (e) { /* leer starten */ }
    try {
      const t = localStorage.getItem(THUMB_KEY); if (t && THUMB_RE.test(t)) thumb = t;
      const n = JSON.parse(localStorage.getItem(NEXT_KEY) || "null"); if (n && isNum(n.lv)) next = { lv: n.lv, n: n.n | 0 };
    } catch (e) { /* kein Browser-Speicher: dann ohne Vorschaubild */ }
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* ---------- Stunden und Level (Quelle: Dashboard) ---------- */
    function economy() {
      let h = null, x = null;
      try { h = deps.getHours ? deps.getHours(SINCE) : null; } catch (e) { /* Quelle noch nicht bereit */ }
      try { x = deps.getLevel ? deps.getLevel() : null; } catch (e) { /* Level noch nicht bereit */ }
      const earned = h ? Math.max(0, h.work || 0) + Math.max(0, h.training || 0) : 0;
      return { earned: Math.round(earned * 100) / 100, level: x ? x.level : 0, xp: x ? x.total : 0, rank: x ? x.rank : "", since: SINCE_TXT };
    }

    /* ---------- Kachel ---------- */
    let sig = "";
    function renderTile(force) {
      if (!host || !ready || overlay) return;
      const e = economy(), bal = e.earned - state.spent;
      // nur neu zeichnen, wenn sich etwas geaendert hat (Stunden/Training laden zum Teil erst nach dem Start nach)
      const s2 = [e.earned, e.level, e.rank, state.spent, next ? next.lv + ":" + next.n : "", thumb.length].join("|");
      if (!force && s2 === sig && host.firstChild) return;
      sig = s2;
      const lv = e.level || e.rank ? `LEVEL ${e.level}${e.rank ? " · " + esc(e.rank).toUpperCase() : ""}` : "";
      const nx = next ? `Nächste Freischaltung bei Level ${next.lv}: ${next.n === 1 ? "1 neues Teil" : next.n + " neue Teile"}` : "";
      host.innerHTML =
        `<div class="rm">` +
        `<button type="button" class="rm-pic" data-rm="open" aria-label="Mein Raum öffnen"><img alt="" width="192" height="120" src="${thumb || GAME_URL.replace("index.html", "vorschau.png")}"></button>` +
        `<div class="rm-info">` +
        `<div class="rm-bal" title="Seit dem ${SINCE_TXT} verdient: ${fmtH(e.earned)} h · im Raum ausgegeben: ${fmtH(state.spent)} h"><span class="rm-bn${bal < 0 ? " neg" : ""}">${fmtH(bal)} h</span><span class="rm-bl">zum Ausgeben</span><span class="rm-bs">seit dem ${SINCE_TXT} verdient: ${fmtH(e.earned)} h · ausgegeben: ${fmtH(state.spent)} h</span></div>` +
        (lv ? `<div class="rm-lv">${lv}</div>` : "") +
        (nx ? `<p class="rm-next">${nx}</p>` : "") +
        `<button type="button" class="rm-go" data-rm="open">RAUM ÖFFNEN</button>` +
        `<details class="rm-how"><summary>So funktioniert's</summary><p>Die Stunden aus Zeittracker (YouTube und Bricklink) und Training, die du seit dem ${SINCE_TXT} gesammelt hast, sind dein Geld. Damit richtest du deinen Raum ein: Möbel, Boden, Wände, weitere Räume, Haustiere und eine Figur zum Anziehen. Mit höheren Levels (Level-Anzeige oben) werden immer mehr Teile freigeschaltet. Wenn du etwas verkaufst, bekommst du die Stunden voll zurück.</p></details>` +
        `</div></div>`;
    }
    if (host) host.addEventListener("click", (ev) => { if (ev.target.closest("[data-rm=open]")) launch(); });

    /* ---------- Spiel als Overlay ---------- */
    function send(msg) {
      try { if (frame && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ src: "dashboard" }, msg), location.origin); } catch (e) { /* Fenster schon weg */ }
    }
    function schedulePush(now) {
      hasPush = true;
      clearTimeout(syncT);
      syncT = setTimeout(() => { hasPush = false; scheduleAutoSync("syncdata"); }, now ? 0 : SYNC_DELAY);
    }
    function onMessage(e) {
      const d = e.data;
      if (!frame || e.origin !== location.origin || e.source !== frame.contentWindow || !d || d.src !== "raumspiel") return;
      if (d.type === "hello") { send({ type: "init", economy: economy(), state: state.w }); return; }
      if (d.type === "save") {
        if (d.state === null) { state.w = null; state.spent = 0; }
        else if (d.state && typeof d.state === "object" && sizeOk(d.state)) { state.w = d.state; if (isNum(d.spent) && d.spent >= 0) state.spent = Math.round(d.spent * 100) / 100; }
        else return;
        state.updatedAt = Date.now();
        persist();
        schedulePush(false);
        next = d.next && isNum(d.next.lv) ? { lv: d.next.lv, n: d.next.n | 0 } : null;
        try {
          if (typeof d.thumb === "string" && d.thumb.length < 40000 && THUMB_RE.test(d.thumb)) { thumb = d.thumb; localStorage.setItem(THUMB_KEY, thumb); }
          localStorage.setItem(NEXT_KEY, JSON.stringify(next));
        } catch (err) { /* Browser-Speicher voll oder gesperrt: egal */ }
        return;
      }
      if (d.type === "flushed") { finish(); return; }
      if (d.type === "close") finish();
    }
    function onPop() { if (overlay) close(); }
    function launch() {
      if (overlay) return;
      overlay = document.createElement("div");
      overlay.className = "rm-ov";
      frame = document.createElement("iframe");
      frame.title = "Mein Raum";
      frame.setAttribute("allow", "autoplay; fullscreen");   // Vollbild: das Kampfspiel braucht es, um auf dem Handy das Querformat zu erzwingen
      frame.setAttribute("allowfullscreen", "");
      frame.src = `${GAME_URL}?embed=1&v=${GAME_VER}`;
      frame.addEventListener("load", () => { try { frame.focus(); } catch (e) { /* egal */ } });
      overlay.appendChild(frame);
      document.body.appendChild(overlay);
      document.body.classList.add("rm-open");
      window.addEventListener("message", onMessage);
      window.addEventListener("popstate", onPop);
      try { history.pushState({ rm: 1 }, "", location.href); } catch (e) { /* ohne Verlauf */ }
      tick = setInterval(() => send({ type: "economy", economy: economy() }), 20000);
    }
    // Schliessen von hier aus (z.B. Zurueck-Taste): erst das Spiel speichern lassen
    function close() {
      if (!overlay || closing) return;
      send({ type: "flush" });
      closing = setTimeout(finish, 800);
    }
    function finish() {
      if (!overlay) return;
      clearTimeout(closing); closing = null; clearInterval(tick);
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", onPop);
      overlay.remove(); overlay = null; frame = null;
      document.body.classList.remove("rm-open");
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* keine Sperre oder nicht unterstuetzt */ }
      if (hasPush) schedulePush(true);
      try { if (history.state && history.state.rm) history.back(); } catch (e) { /* egal */ }
      renderTile(true);
    }

    setInterval(() => { if (!overlay && !document.hidden) renderTile(); }, 2000);

    return {
      start() { ready = true; renderTile(true); },
      open() { ready = true; if (deps.expand) deps.expand("raum"); renderTile(true); const s = document.getElementById("raum"); if (s) s.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); },
      launch,
      metric() { return ready ? fmtH(economy().earned - state.spent) + " H ZUM AUSGEBEN" : ""; },
      // Neuerer Stand gewinnt (ganzer Raum); ist der eigene neuer, geht er mit dem naechsten Sync in die Cloud
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote);
        if (r.updatedAt > state.updatedAt) { state = r; persist(); renderTile(true); }
        else if (state.updatedAt > r.updatedAt) scheduleAutoSync("syncdata");
      },
      payload() { return state.w ? { w: state.w, spent: state.spent, updatedAt: Math.max(0, state.updatedAt) } : null; }
    };
  };
})();
