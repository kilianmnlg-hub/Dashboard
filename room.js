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
  const GAME_VER = "20261022j";
  const KEY = "dashboard-room-v2", THUMB_KEY = "dashboard-room-thumb", NEXT_KEY = "dashboard-room-next";
  const MAX_STATE = 200000; // Zeichen; schuetzt die Cloud-Datei vor Ausreissern
  const SYNC_DELAY = 4000; // Aenderungen im Spiel werden gebuendelt in die Cloud geschickt
  const THUMB_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const fmtH = (h) => (Math.round(h * 10) / 10).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ERAS = { stone: "Steinzeit" }; // Zeitalter des Kampfspiels "Verteidigung" (weitere kommen mit dem Spiel)
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
      // Kampfspiel: Zeitalter und Held-Level aus dem Spielstand (erst da, wenn "Verteidigen" einmal geoeffnet wurde)
      const wd = state.w && state.w.world && state.w.world.def, df = wd && isNum(wd.lv) ? `Verteidigung · ${ERAS[wd.era] || ERAS.stone} · Held Lv ${Math.max(1, Math.round(wd.lv))}` : "";
      const s2 = [e.earned, e.level, e.rank, state.spent, next ? next.lv + ":" + next.n : "", thumb.length, df].join("|");
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
        (df ? `<div class="rm-def">${esc(df)}</div>` : "") +
        (nx ? `<p class="rm-next">${nx}</p>` : "") +
        `<button type="button" class="rm-go" data-rm="open">RAUM ÖFFNEN</button>` +
        `<div class="rm-ver">Spiel-Version ${GAME_VER}</div>` +
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
    // Aktualisieren auf Wunsch des Spiels (Version antippen): Stand sichern lassen, Service Worker nach neuer Version fragen, Seite neu laden
    function reloadApp() {
      send({ type: "flush" });
      setTimeout(async () => { try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch (e) { /* egal */ } location.reload(); }, 900);
    }
    function onMessage(e) {
      const d = e.data;
      if (!frame || e.origin !== location.origin || e.source !== frame.contentWindow || !d || d.src !== "raumspiel") return;
      if (d.type === "hello") { send({ type: "init", economy: economy(), state: state.w }); return; }
      if (d.type === "orient") { setPref(d.mode); return; }
      if (d.type === "reload") { reloadApp(); return; }
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

    /* ---------- Querformat (Handy) ----------
       Auf dem Handy oeffnet sich der Raum sofort quer (Standard; der Knopf im Spiel wechselt zurueck auf hochkant und merkt sich die Wahl).
       Die installierte Verknuepfung ist per Manifest auf Hochformat festgelegt: ihr wird per Bildschirmsperre (screen.orientation.lock) Querformat
       abgenommen, im Browser-Tab zusammen mit Vollbild. Klappt das nicht (z. B. iPhone), dreht dieser Teil das Bild des Spiels selbst (CSS auf dem iframe),
       die Seite (Oberseite des Handys links/rechts) waehlt der Spieler einmal und sie wird gemerkt. */
    const ORIENT_KEY = "dashboard-room-orient", ROT_KEY = "dashboard-room-rot";
    let pref = "landscape", rotDir = 0, oState = "none", oAt = 0, oTok = 0, oTimer = null, fsByUs = false, chooser = null;
    try {
      if (localStorage.getItem(ORIENT_KEY) === "portrait") pref = "portrait";
      const r = Number(localStorage.getItem(ROT_KEY)); if (r === 1 || r === -1) rotDir = r;
    } catch (e) { /* ohne Browser-Speicher: Standard */ }
    const savePref = () => { try { localStorage.setItem(ORIENT_KEY, pref); localStorage.setItem(ROT_KEY, String(rotDir)); } catch (e) { /* egal */ } };
    const isPortrait = () => window.innerHeight > window.innerWidth * 1.05;
    const isTouch = () => !!(window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
    function requestLandscape() {
      clearTimeout(oTimer);
      const so = screen.orientation, tok = ++oTok;
      if (!isPortrait()) { oState = "none"; applyRot(); return; }   // schon quer (PC, oder das Handy liegt quer und dreht selbst)
      if (!so || typeof so.lock !== "function") { oState = "fail"; applyRot(); return; }
      oState = "pending"; oAt = Date.now();
      const lock = () => { try { return so.lock("landscape").then(() => true, () => false); } catch (e) { return Promise.resolve(false); } };
      lock().then((ok) => {
        if (ok || !isTouch()) return ok;
        if (!overlay || !overlay.requestFullscreen || document.fullscreenElement) return false;
        return overlay.requestFullscreen().then(() => { fsByUs = true; return lock(); }, () => false);
      }).then((ok) => {
        if (tok !== oTok) { if (!overlay || pref !== "landscape") { try { so.unlock(); } catch (e) { /* egal */ } } return; }   // inzwischen geschlossen oder umgestellt
        oState = ok ? "ok" : "fail"; oAt = Date.now();
        clearTimeout(oTimer); oTimer = setTimeout(applyRot, ok ? 1300 : 0);   // bei Erfolg kurz warten, bis das System gedreht hat
        applyRot();
      });
    }
    function releaseOrientation() {
      clearTimeout(oTimer); oTok++; oState = "none";
      try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch (e) { /* keine Sperre oder nicht unterstuetzt */ }
      try { if (fsByUs && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); } catch (e) { /* egal */ }
      fsByUs = false;
    }
    // Bild soll quer sein, ist aber hochkant (Sperre ging nicht oder greift nicht): iframe selbst drehen. rotDir 1 = Oberseite des Handys links, -1 = rechts, 0 = noch nicht gewaehlt
    function applyRot() {
      if (!overlay || !frame) return;
      const iw = window.innerWidth, ih = window.innerHeight, p = isPortrait();
      if (oState === "ok" && p && Date.now() - oAt > 1200) oState = "fail";
      const waiting = oState === "pending" || (oState === "ok" && Date.now() - oAt <= 1200);
      const want = pref === "landscape" && p && !waiting;
      const st = frame.style;
      if (want && rotDir !== 0) {
        st.position = "absolute"; st.left = "0"; st.top = "0"; st.width = ih + "px"; st.height = iw + "px"; st.transformOrigin = "0 0";
        st.transform = rotDir > 0 ? `translateX(${iw}px) rotate(90deg)` : `translateY(${ih}px) rotate(-90deg)`;
      } else { st.position = st.left = st.top = st.width = st.height = st.transformOrigin = st.transform = ""; }
      showChooser(want && rotDir === 0);
    }
    function showChooser(on) {
      if (!on) { if (chooser) { chooser.remove(); chooser = null; } return; }
      if (chooser || !overlay) return;
      chooser = document.createElement("div");
      chooser.className = "rm-turn";
      chooser.innerHTML = `<div class="rm-turn-box"><b>Bitte das Handy quer halten</b><span>Dreht sich das Bild nicht mit? Halte das Handy quer und tippe, wo oben (Kamera) ist:</span>` +
        `<div class="rm-turn-btns"><button type="button" data-rot="1">Oben links</button><button type="button" data-rot="-1">Oben rechts</button></div>` +
        `<button type="button" class="rm-turn-x" data-rot="0">Hochkant bleiben</button></div>`;
      chooser.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-rot]"); if (!b) return;
        const v = Number(b.dataset.rot);
        if (v === 0) { setPref("portrait"); return; }
        rotDir = v; savePref(); applyRot();
      });
      overlay.appendChild(chooser);
    }
    function setPref(mode) {
      pref = mode === "portrait" ? "portrait" : "landscape"; savePref();
      if (pref === "portrait") releaseOrientation(); else requestLandscape();
      applyRot();
    }
    const onResize = () => applyRot();
    const onFs = () => { if (!document.fullscreenElement) fsByUs = false; setTimeout(applyRot, 300); };

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
      window.addEventListener("resize", onResize);
      window.addEventListener("orientationchange", onResize);
      document.addEventListener("fullscreenchange", onFs);
      if (pref === "landscape") requestLandscape();   // innerhalb des Antippens: nur so erlauben Browser Sperre und Vollbild
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
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("fullscreenchange", onFs);
      overlay.remove(); overlay = null; frame = null; chooser = null;
      document.body.classList.remove("rm-open");
      releaseOrientation();   // Sperre und Vollbild loesen, das Dashboard selbst bleibt hochkant
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
