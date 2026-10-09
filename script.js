(function () {
  const data = window.DASHBOARD_DATA;
  const fmtDE = new Intl.NumberFormat("de-DE");
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  // Früh deklariert (nicht erst beim Tages-To-Do weiter unten), weil auch die
  // Studium-Countdown-Karte in der Goals-Sektion sie schon braucht.
  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  // Pixel-Symbole und Wisch-Helfer kommen aus shopping.js (laedt vor diesem Skript). Fehlt die Datei,
  // laeuft alles ohne Symbole weiter.
  const PX = window.PixelSprites || null;
  const pxSpr = (name, size) => (PX ? PX.spr(name, size) : "");

  // ---------- Kleine Belebungs-Helfer (Mikro-Animationen) ----------
  const prefersReducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Level-up: die Level-Anzeige oben blinkt kurz mit "LEVEL UP!" (nur Optik)
  function celebrateLevelUp(level, rank, rankUp) {
    const box = document.getElementById("lvlBox");
    if (!box) return;
    box.classList.remove("lvl-up");
    void box.offsetWidth;
    box.classList.add("lvl-up");
    const txt = document.createElement("span");
    txt.className = "lvl-up-txt";
    txt.textContent = rankUp ? `NEUER RANG: ${String(rank).toUpperCase()}!` : "LEVEL UP!";
    box.appendChild(txt);
    pixelBurst(box, "");
    setTimeout(() => { box.classList.remove("lvl-up"); txt.remove(); }, 3200);
  }

  // Kleine Pixel-Belohnung beim Abhaken: Funken und ein Schriftzug an der Stelle des Elements (nur Optik, nichts wird gespeichert)
  let pixelFx = null;
  function pixelBurst(el, label) {
    if (!el || prefersReducedMotion()) return;
    const r = el.getBoundingClientRect();
    if (!r.width) return;
    if (!pixelFx) { pixelFx = document.createElement("div"); pixelFx.className = "px-fx"; pixelFx.setAttribute("aria-hidden", "true"); document.body.appendChild(pixelFx); }
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    for (let i = 0; i < 10; i++) {
      const sp = document.createElement("span"), a = (Math.PI * 2 * i) / 10, d = 22 + (i % 3) * 8;
      sp.className = "px-spark";
      sp.style.cssText = `left:${x}px;top:${y}px;--dx:${Math.round(Math.cos(a) * d)}px;--dy:${Math.round(Math.sin(a) * d)}px`;
      pixelFx.appendChild(sp);
      setTimeout(() => sp.remove(), 650);
    }
    if (label) {
      const g = document.createElement("span");
      g.className = "px-gain";
      g.textContent = label;
      g.style.cssText = `left:${x + 10}px;top:${y - 10}px`;
      pixelFx.appendChild(g);
      setTimeout(() => g.remove(), 900);
    }
  }

  // Zaehlt eine Statistik-Zahl beim ersten Rendern kurz hoch statt sie sofort dazustehen zu
  // lassen. Erkennt automatisch die (ggf. deutsch formatierte, z.B. "8.227,1") Zahl im Text
  // und laesst Praefix/Suffix (Waehrungszeichen, Einheiten, umgebender Text) unangetastet.
  function animateStatValue(el) {
    const finalText = el.getAttribute("data-final") ?? el.textContent;
    // Sicherer Ausgangswert zuerst: falls requestAnimationFrame aus irgendeinem Grund nie
    // feuert (z.B. Tab im Hintergrund geoeffnet/noch nicht sichtbar), steht wenigstens sofort
    // die richtige Zahl da, statt dauerhaft leer zu bleiben - die Animation ist nur "on top".
    el.textContent = finalText;
    if (prefersReducedMotion()) return;
    const match = finalText.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?|\d+(?:,\d+)?/);
    if (!match) return;
    const numStr = match[0];
    const prefix = finalText.slice(0, match.index);
    const suffix = finalText.slice(match.index + numStr.length);
    const decimals = numStr.includes(",") ? numStr.split(",")[1].length : 0;
    const target = parseFloat(numStr.replace(/\./g, "").replace(",", "."));
    if (!isFinite(target) || target === 0) return;
    const duration = 900;
    let start = null;
    function step(ts) {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent =
        prefix + (eased * target).toLocaleString("de-DE", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = finalText;
    }
    requestAnimationFrame(step);
  }

  // Laesst die Kinder einer frisch gerenderten Liste gestaffelt (leicht versetzt)
  // einfliegen statt alle auf einmal dazustehen.
  function staggerListItems(listEl) {
    if (!listEl || prefersReducedMotion()) return;
    Array.from(listEl.children).forEach((li, i) => {
      li.classList.add("li-enter");
      li.style.animationDelay = `${Math.min(i, 8) * 45}ms`;
      li.addEventListener("animationend", () => { li.classList.remove("li-enter"); li.style.animationDelay = ""; }, { once: true });
    });
  }
  // Wie staggerListItems, aber merkt sich per data-Attribut auf dem Listenelement selbst,
  // dass schon einmal gestaffelt wurde - fuer Listen, deren <ul> ueber mehrere Renders hinweg
  // dieselbe DOM-Node bleibt (nur der Inhalt wird ersetzt). Sonst wuerde JEDE Kleinigkeit
  // (ein Haekchen, ein geloeschter Eintrag) die KOMPLETTE Liste erneut einfliegen lassen -
  // das soll nur beim allerersten Anzeigen passieren.
  function staggerListOnce(listEl) {
    if (!listEl || listEl.dataset.staggered) return;
    listEl.dataset.staggered = "1";
    staggerListItems(listEl);
  }
  // Hebt einen einzelnen, gerade neu hinzugefuegten Eintrag kurz hervor - das Gegenstueck zu
  // staggerList* fuer alles, was NACH dem allerersten Rendern dazukommt.
  function flashNewItem(container, id) {
    if (prefersReducedMotion()) return;
    const el = container?.querySelector(`[data-id="${id}"]`);
    if (!el) return;
    el.classList.add("li-enter");
    el.addEventListener("animationend", () => el.classList.remove("li-enter"), { once: true });
  }

  // Laesst die Balken eines .iso-chart-Containers (Umsatz-Charts, Zeit-Balance-Balken) beim
  // Rendern von 0 auf ihre Zielhoehe hochwachsen, statt sofort auf voller Hoehe zu stehen -
  // siehe .iso-chart.grown-Regeln in styles.css. Ohne Animation (reduced motion) einfach
  // direkt den Endzustand setzen.
  function growBarsIn(containerEl) {
    if (!containerEl) return;
    if (prefersReducedMotion()) {
      containerEl.classList.add("grown");
      return;
    }
    containerEl.classList.remove("grown");
    // Erzwungener Reflow: liest eine Layout-Eigenschaft, damit der Browser den Stand OHNE
    // "grown" (Balken bei Hoehe 0) tatsaechlich rendert, bevor die Klasse gleich wieder
    // hinzugefuegt wird - sonst wuerden beide Aenderungen zu einer einzigen Layout-Berechnung
    // zusammengefasst und die Hoehen-Transition faende nie sichtbar statt. Bewusst OHNE
    // requestAnimationFrame-Verzoegerung: die haengt vom naechsten Frame ab, der in einem
    // (noch) nicht sichtbaren/aktiven Tab u.U. nie kommt - dann bliebe "grown" fuer immer
    // fehlen und die Balken blieben unsichtbar bei Hoehe 0.
    void containerEl.offsetWidth;
    containerEl.classList.add("grown");
  }

  // Ziel-Gauge als Ring aus 24 Pixel-Bloecken (Spiel-Lebensring): die ersten "litCount" leuchten in der
  // Zielfarbe, der Rest bleibt in der Ruhefarbe. Das Aufleuchten nacheinander macht CSS (Verzoegerung je
  // Block) - der Endzustand steht also so oder so sofort korrekt da, auch ohne Animation.
  const GAUGE_SEGMENTS = 24;
  function animateGauge(el, pct, accentVar) {
    if (!el) return;
    el.style.removeProperty("background");
    const span = el.querySelector("span");
    const finalLit = Math.round((pct / 100) * GAUGE_SEGMENTS);
    el.querySelectorAll(":scope > i").forEach((i) => i.remove());
    el.insertAdjacentHTML(
      "afterbegin",
      Array.from({ length: GAUGE_SEGMENTS }, (_, i) => `<i class="${i < finalLit ? "on" : ""}" style="--i:${i}"></i>`).join("")
    );
    el.style.setProperty("--gc", accentVar);
    if (span) span.textContent = `${pct.toFixed(0)}%`;
  }

  // ---------- Ziel-Meilenstein-Toasts ("Level Up") ----------
  // Merkt sich pro Ziel die zuletzt gezeigte 10%-Marke, damit der Toast bei jedem Laden nicht
  // erneut fuer laengst erreichte Marken aufploppt - nur ein NEU ueberschrittener 10er-Schritt
  // (60, 70, 80, ...) loest ihn aus. Bewusst NICHT Teil des Cloud-Sync: rein geraetelokale
  // "hab ich das schon gesehen"-Notiz, kein echter Nutzdaten-Zustand.
  const GOAL_MILESTONE_KEY = "dashboard-goal-milestones-seen";
  const loadGoalMilestonesSeen = () => {
    try {
      return JSON.parse(localStorage.getItem(GOAL_MILESTONE_KEY)) || {};
    } catch (e) {
      return {};
    }
  };
  const saveGoalMilestonesSeen = (state) => localStorage.setItem(GOAL_MILESTONE_KEY, JSON.stringify(state));

  let milestoneToastQueue = [];
  let milestoneToastBusy = false;
  function showMilestoneToast(title, sub) {
    let toastEl = document.getElementById("milestoneToast");
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.id = "milestoneToast";
      toastEl.className = "milestone-toast hidden-state";
      toastEl.innerHTML = `
        <svg class="pixel-icon" width="22" height="22" viewBox="0 0 8 8" aria-hidden="true">
          <g fill="var(--status-good)"><rect x="3" y="0" width="2" height="3"/><rect x="0" y="3" width="8" height="2"/><rect x="3" y="5" width="2" height="3"/></g>
        </svg>
        <span><span class="milestone-toast-title"></span><br><span class="milestone-toast-sub"></span></span>
      `;
      document.body.appendChild(toastEl);
    }
    toastEl.querySelector(".milestone-toast-title").textContent = title;
    toastEl.querySelector(".milestone-toast-sub").textContent = sub;
    toastEl.classList.remove("hidden-state");
  }
  function processMilestoneQueue() {
    const next = milestoneToastQueue.shift();
    if (!next) {
      milestoneToastBusy = false;
      const toastEl = document.getElementById("milestoneToast");
      if (toastEl) toastEl.classList.add("hidden-state");
      return;
    }
    milestoneToastBusy = true;
    showMilestoneToast(next.title, next.sub);
    setTimeout(processMilestoneQueue, 3200);
  }
  function queueMilestoneToast(title, sub) {
    milestoneToastQueue.push({ title, sub });
    if (!milestoneToastBusy) processMilestoneQueue();
  }

  // Sicherheitsnetz fuer alle Cloud-Sync-Felder (Habit-Tracker, Video-Ideen, Studium-Termin,
  // Tages-To-Do, Aufgaben): ein Cloud-Stand darf einen nicht-leeren lokalen Stand NIE durch
  // einen leeren ersetzen, selbst wenn er laut Zeitstempel neuer ist. Sonst kann ein Geraet,
  // das ein Feld einfach nie befuellt hat (z.B. noch nie eine Aufgabe eingetragen), beim
  // blossen Sync-Klick echte Daten auf einem anderen Geraet loeschen — genau das ist einmal
  // passiert (leere Todos/Aufgaben von einem ungenutzten Geraet haben echte Eintraege auf
  // einem anderen Geraet ueberschrieben).
  const remoteWins = (remoteUpdatedAt, localUpdatedAt, remoteHasContent, localHasContent) => {
    if (remoteUpdatedAt <= localUpdatedAt) return false;
    if (localHasContent && !remoteHasContent) return false;
    return true;
  };

  // ---------- Cloud-only-Datenhaltung ----------
  // Habits, Aufgaben, To-Dos, Video-Ideen und Studium-Termin liegen NUR in der Cloud
  // (habits-data.json / sync-data.json im Repo). Im Browser steht davon nichts mehr in
  // localStorage: dataStore ist ein reiner Arbeitsspeicher mit derselben getItem/setItem-
  // Schnittstelle und ist nach dem Neuladen leer, bis die Cloud-Daten geladen sind.
  // Im Browser (localStorage) bleiben nur Dinge, die nicht in ein oeffentliches Repo
  // koennen oder rein geraetebezogen sind: GitHub-Token, Kalender-Zugang, Theme,
  // "Meilenstein schon gesehen".
  const cloudMem = new Map();
  const dataStore = {
    getItem: (k) => (cloudMem.has(k) ? cloudMem.get(k) : null),
    setItem: (k, v) => cloudMem.set(k, String(v)),
    removeItem: (k) => cloudMem.delete(k)
  };

  // Einmalige Uebernahme alter lokaler Staende (aus der Zeit vor Cloud-only): sie werden in
  // den Arbeitsspeicher kopiert und nach dem Laden der Cloud ganz normal per Zeitstempel
  // abgeglichen (neuerer Stand gewinnt) und hochgeladen. Erst NACH einem erfolgreichen Push
  // werden die alten localStorage-Eintraege geloescht - so geht nichts verloren, was bisher
  // nur lokal lag (z.B. Aufgaben, die nie hochgeladen wurden).
  const legacyKeysByKind = { habits: [], syncdata: [] };
  (function importLegacyLocalData() {
    try {
      const re = /^dashboard-(habits-v1|tasks-v1|studium-deadline|idea-.+|todo-\d{4}-\d{2}-\d{2})$/;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !re.test(k)) continue;
        cloudMem.set(k, localStorage.getItem(k));
        (k === "dashboard-habits-v1" ? legacyKeysByKind.habits : legacyKeysByKind.syncdata).push(k);
      }
    } catch (e) {
      /* localStorage nicht verfuegbar - dann gibt es auch nichts zu uebernehmen */
    }
  })();
  function clearLegacyKeys(kind) {
    legacyKeysByKind[kind].forEach((k) => {
      try {
        localStorage.removeItem(k);
      } catch (e) {
        /* egal */
      }
    });
    legacyKeysByKind[kind] = [];
  }

  // Zustand des Cloud-Ladens: "loading" (Seite gesperrt, damit nicht in einen noch leeren
  // Arbeitsspeicher geschrieben und damit die Cloud ueberschrieben wird), "ready" oder
  // "failed" (Cloud nicht erreichbar - weiter gesperrt und automatischer Neuversuch).
  const cloudLoaded = { habits: false, syncdata: false };
  const setCloudState = (state) => {
    document.body.dataset.cloud = state;
    const clTxt = document.getElementById("cloudLoadTxt");
    if (clTxt) clTxt.textContent = state === "failed" ? "CLOUD NICHT ERREICHBAR, NEUER VERSUCH …" : "LADE DEINE DATEN …";
    if (state === "ready") document.dispatchEvent(new CustomEvent("cloud-ready"));
  };
  setCloudState("loading");

  const decodeGithubBase64 = (b64) => decodeURIComponent(escape(atob(String(b64 || "").replace(/\n/g, ""))));

  // Liest eine Daten-Datei immer frisch ueber die GitHub-API (nicht ueber GitHub Pages: dessen
  // CDN liefert bis zu 10 Minuten alte Stände, und auf einem alten Stand weiterzuarbeiten
  // wuerde neuere Aenderungen ueberschreiben). Ohne Token geht das Lesen trotzdem (oeffentliches
  // Repo, 60 Anfragen/Std.); ist ein gespeicherter Token abgelaufen, wird ohne ihn nochmal gelesen.
  // 404 = Datei existiert noch nicht -> json: null. Alles andere Unerwartete wirft, damit ein
  // Ladefehler NIE als "leerer Stand" missverstanden wird.
  async function readCloudJson(file) {
    const owner = data.github?.owner || localStorage.getItem("dashboard-gh-owner");
    const repo = data.github?.repo || localStorage.getItem("dashboard-gh-repo");
    const token = localStorage.getItem("dashboard-gh-token");
    if (!owner || !repo) throw new Error("Repo nicht konfiguriert");
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${file}`;
    const get = (withToken) =>
      fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/vnd.github+json", ...(withToken && token ? { Authorization: `Bearer ${token}` } : {}) }
      });
    let res = await get(true);
    if ((res.status === 401 || res.status === 403) && token) res = await get(false);
    if (res.status === 404) return { json: null, sha: null };
    if (!res.ok) throw new Error(res.status === 403 ? "GitHub-Limit erreicht oder Zugriff verweigert (403)" : `Status ${res.status}`);
    const meta = await res.json();
    let json = null;
    try {
      json = JSON.parse(decodeGithubBase64(meta.content));
    } catch (e) {
      /* Datei leer oder kein valides JSON - als "noch kein Stand" behandeln */
    }
    return { json, sha: meta.sha };
  }

  // ---------- Auto-Sync ----------
  // Statt jedes Mal auf "Sync" klicken zu muessen: jede Aenderung an Habit-Tracker,
  // Video-Ideen, Studium-Termin, Tages-To-Do oder Aufgaben stoesst nach kurzer Pause
  // (debounced, damit z.B. mehrere Habit-Klicks hintereinander nur EINEN Push ausloesen)
  // automatisch einen Push an - aber NUR fuer die eine Datei, die den geaenderten Bereich
  // enthaelt (habits-data.json ODER sync-data.json), nicht beide zusammen. Eigener Timer
  // pro "kind", damit z.B. ein Habit-Klick kurz nach einer Todo-Aenderung deren noch
  // ausstehenden Push nicht versehentlich verwirft (ein gemeinsamer Timer wuerde das tun).
  // Bewusst NUR, wenn schon ein GitHub-Token hinterlegt ist - sonst wuerde die allererste
  // Kleinigkeit (ein Haekchen, ein Todo) einen ueberraschenden Token-Prompt ausloesen,
  // obwohl der Nutzer nur etwas eintragen wollte. Ohne Token bleibt es beim bisherigen
  // Verhalten: alles landet trotzdem sofort in localStorage, die Cloud wird erst beim
  // naechsten manuellen Sync-Klick aktuell. Die "Sync"-Button-Aktion selbst (Business-
  // Daten-Workflow) bleibt bewusst manuell/taeglich - eine Habit-Aenderung soll nicht
  // nebenbei einen 15-30s-GitHub-Actions-Lauf samt YouTube-/Bricklink-API-Aufrufen anstossen.
  const autoSyncStatusEl = document.getElementById("autoSyncStatus");
  function setAutoSyncStatus(state, detail) {
    if (!autoSyncStatusEl) return;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const map = {
      saving: "☁️ Speichere…",
      saved: `☁️ Automatisch gesichert · ${time}`,
      error: `⚠️ Auto-Sync fehlgeschlagen${detail ? " — " + detail : ""}`,
      "no-token": "⚠️ Nicht gespeichert — GitHub-Token fehlt (Änderungen gehen beim Schließen verloren)",
      "cloud-failed": "⚠️ Cloud nicht erreichbar — Änderungen gesperrt, neuer Versuch läuft"
    };
    autoSyncStatusEl.hidden = false;
    // Auf schmaleren Bildschirmen blendet das CSS den Wortlaut aus (nur Wolke und Uhrzeit); lange Meldungen werden gekuerzt, der
    // volle Text steht im Tooltip.
    const text = map[state] || "";
    if (state === "saved") autoSyncStatusEl.innerHTML = `☁️ <span class="as-w">Automatisch gesichert · </span>${time}`;
    else autoSyncStatusEl.textContent = text;
    autoSyncStatusEl.title = text;
  }

  // Seit Cloud-only ist der Auto-Sync der EINZIGE Weg, auf dem Aenderungen gespeichert werden
  // (es gibt keine lokale Kopie mehr). Deshalb: kurze Pause (700 ms, nur um schnelle Klicks
  // zu einem Push zu buendeln), pro Datei hoechstens ein Push gleichzeitig (weitere Aenderungen
  // waehrend eines laufenden Pushs loesen direkt danach einen weiteren aus), bei einem
  // Konflikt (409, anderes Geraet hat parallel geschrieben) zwei automatische Neuversuche,
  // und eine Warnung beim Schliessen des Tabs, solange noch etwas nicht gespeichert ist.
  // Fehlt der Token, wird einmal pro Sitzung danach gefragt - ohne ihn kann nichts
  // gespeichert werden.
  const autoSyncTimers = {};
  const autoSyncInFlight = {};
  const autoSyncPending = {};
  const unsavedKinds = new Set();
  // Letzte Push-Fehlerursache pro Datei ({message, conflict}) - wird vom jeweiligen Pusher
  // gesetzt und im Status-Badge angezeigt, damit man nicht in die Konsole schauen muss.
  const lastPushError = { habits: null, syncdata: null };
  let tokenPromptDeclined = false;
  const AUTO_SYNC_PUSHERS = { habits: () => pushHabitsToCloud(), syncdata: () => pushSyncDataToCloud() };

  async function runAutoSync(kind, attempt) {
    if (autoSyncInFlight[kind]) {
      autoSyncPending[kind] = true;
      return;
    }
    if (!localStorage.getItem("dashboard-gh-token")) {
      if (!tokenPromptDeclined && !getGithubConfig()) tokenPromptDeclined = true;
      if (!localStorage.getItem("dashboard-gh-token")) {
        setAutoSyncStatus("no-token");
        return;
      }
    }
    autoSyncInFlight[kind] = true;
    setAutoSyncStatus("saving");
    let ok = false;
    try {
      // Die Pusher fangen ihre Fehler selbst ab und werfen nie - ihr Rueckgabewert (true/false)
      // ist die einzige Quelle fuer einen ehrlichen Indikator.
      ok = await AUTO_SYNC_PUSHERS[kind]();
    } catch (err) {
      lastPushError[kind] = { message: err.message };
    }
    autoSyncInFlight[kind] = false;
    if (ok) {
      unsavedKinds.delete(kind);
      if (legacyKeysByKind[kind].length) clearLegacyKeys(kind);
    } else if (lastPushError[kind]?.conflict && attempt < 2) {
      setTimeout(() => runAutoSync(kind, attempt + 1), 600);
      return;
    }
    if (autoSyncPending[kind]) {
      autoSyncPending[kind] = false;
      runAutoSync(kind, 0);
      return;
    }
    setAutoSyncStatus(ok ? "saved" : "error", ok ? undefined : lastPushError[kind]?.message);
  }

  function scheduleAutoSync(kind) {
    unsavedKinds.add(kind);
    clearTimeout(autoSyncTimers[kind]);
    autoSyncTimers[kind] = setTimeout(() => runAutoSync(kind, 0), 700);
  }

  window.addEventListener("beforeunload", (e) => {
    if (unsavedKinds.size) {
      e.preventDefault();
      e.returnValue = "";
    }
  });

  // ---------- Theme ----------
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("dashboard-theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);

  themeToggle.addEventListener("click", () => {
    const prefersLight = matchMedia("(prefers-color-scheme: light)").matches;
    const current = root.getAttribute("data-theme") || (prefersLight ? "light" : "dark");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("dashboard-theme", next);
  });

  // ---------- Header ----------
  const now = new Date();
  document.getElementById("todayLabel").textContent = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
  const syncedLabel = data.meta.lastSyncedAt
    ? new Date(data.meta.lastSyncedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : fmtDate(data.meta.lastUpdated);
  document.getElementById("footerUpdated").textContent = syncedLabel;

  const hour = now.getHours();
  const greetingWord = hour < 11 ? "Guten Morgen" : hour < 18 ? "Schönen Tag" : "Guten Abend";
  document.getElementById("greeting").textContent = `${greetingWord}, ${data.meta.owner || ""}`.trim();

  // Spruch des Tages (quotes.js): ein neuer Satz pro Datum; bei einem ueber Mitternacht offenen Tab wechselt er mit
  const quoteEl = document.getElementById("dailyQuote");
  const showQuote = () => { if (quoteEl && window.dailyQuote) quoteEl.textContent = window.dailyQuote(new Date()); };
  showQuote();
  setInterval(showQuote, 60000);

  // ---------- Versand-Alarm ----------
  const shipAlert = document.getElementById("shipAlert");
  const pending = data.bricklinkOrders?.pendingShipments || [];
  const dismissKey = `dashboard-ship-alert-dismissed-${data.bricklinkOrders?.checkedAt || ""}`;

  if (pending.length > 0 && !sessionStorage.getItem(dismissKey)) {
    const text =
      pending.length === 1
        ? `1 Bricklink-Bestellung wartet auf Versand — #${pending[0].orderId} (${pending[0].buyer}, bestellt am ${fmtDate(pending[0].orderedDate.slice(0, 10))})`
        : `${pending.length} Bricklink-Bestellungen warten auf Versand — älteste: #${pending[0].orderId} (${pending[0].buyer}, bestellt am ${fmtDate(pending[0].orderedDate.slice(0, 10))})`;
    document.getElementById("shipAlertText").textContent = text;
    shipAlert.hidden = false;
  }

  document.getElementById("shipAlertDismiss").addEventListener("click", () => {
    sessionStorage.setItem(dismissKey, "1");
    shipAlert.hidden = true;
  });

  // ---------- Achtung-Banner ganz oben ----------
  // Weitere Hinweise im Stil des Versand-Alarms: ueberfaellige Uploads (Rhythmus aus data.business, Shorts zaehlen
  // nicht) und offene Bricklink-Nachrichten. Pro Sitzung wegklickbar (sessionStorage, wie beim Versand-Alarm).
  (function renderTopAlerts() {
    const host = document.getElementById("topAlerts");
    if (!host) return;
    const items = [];
    [["bricksOnTheFloor", "Bricks On The Floor"], ["brainwalkers", "The Brainwalkers"]].forEach(([key, name]) => {
      const biz = data.business?.[key];
      if (!biz?.uploadRhythmDays || !biz.lastUploadAt) return;
      const days = daysSince(biz.lastUploadAt);
      const status = rhythmStatus(days, biz.uploadRhythmDays);
      if (!status || status === "green") return;
      items.push({
        id: `upload-${key}-${biz.lastUploadAt}`,
        level: status,
        icon: "film",
        title: `${name}: seit ${days} Tagen kein Longform-Video`,
        sub: `Dein Rhythmus: alle ${biz.uploadRhythmDays} Tage · letzter Upload ${fmtDate(biz.lastUploadAt.slice(0, 10))}`
      });
    });
    const stat = (label) => parseInt(String((data.business?.bricklink?.stats || []).find((s) => s.label === label)?.value ?? "").replace(/\./g, ""), 10) || 0;
    const mails = stat("Drive-Thru-Mail offen"), noFeedback = stat("Ohne Feedback");
    if (mails > 0 || noFeedback > 0) {
      items.push({
        id: `bricklink-mails-${mails}-${noFeedback}`,
        level: "info",
        icon: "bell",
        title: `Bricklink: ${mails} Drive-Thru-Mails offen, ${noFeedback} Bestellungen ohne Feedback`,
        sub: "Ein paar davon heute abarbeiten?"
      });
    }
    const visible = items.filter((it) => {
      try { return !sessionStorage.getItem(`dashboard-alert-dismissed-${it.id}`); } catch (e) { return true; }
    });
    host.innerHTML = visible
      .map(
        (it) => `<div class="ship-alert top-alert ${it.level}" data-alert="${escapeHtml(it.id)}"><div class="ship-alert-inner">${pxSpr(it.icon, 22)}<span class="ship-alert-text"><b>${escapeHtml(it.title)}</b><span class="ta-sub">${escapeHtml(it.sub)}</span></span><button type="button" class="ship-alert-dismiss" aria-label="Ausblenden">×</button></div></div>`
      )
      .join("");
    host.addEventListener("click", (e) => {
      const btn = e.target.closest(".ship-alert-dismiss");
      const row = btn && btn.closest(".top-alert");
      if (!row) return;
      try { sessionStorage.setItem(`dashboard-alert-dismissed-${row.dataset.alert}`, "1"); } catch (err) { /* egal */ }
      row.remove();
    });
  })();

  // ---------- Hinweis "Neue Version verfuegbar" ----------
  // Gleiche Optik wie die anderen Hinweise ganz oben. Verglichen wird die Versionsnummer an den Skripten in index.html: ist die
  // auf dem Server neuer als die geladene, laeuft dieser Tab oder diese App mit altem Code. Ein Klick laedt neu.
  (function versionWatch() {
    const host = document.getElementById("topAlerts");
    const mine = (document.querySelector('script[src^="script.js"]')?.getAttribute("src") || "").match(/[?&]v=([\w.-]+)/)?.[1];
    if (!host || !mine) return;
    let shownFor = null;
    async function check() {
      try {
        const res = await fetch(`index.html?vcheck=${Date.now()}`, { cache: "no-store" });
        if (!res.ok) return;
        const latest = (await res.text()).match(/script\.js\?v=([\w.-]+)/)?.[1];
        if (!latest || latest === mine || shownFor === latest) return;
        try { if (sessionStorage.getItem(`dashboard-alert-dismissed-update-${latest}`)) return; } catch (e) { /* egal */ }
        shownFor = latest;
        host.insertAdjacentHTML("afterbegin", `<div class="ship-alert top-alert yellow" data-alert="update-${escapeHtml(latest)}"><div class="ship-alert-inner">${pxSpr("bell", 22)}<span class="ship-alert-text"><b>Neue Version verfügbar</b><span class="ta-sub">Lade neu, damit alles wieder zusammenpasst.</span></span><button type="button" class="ta-action">NEU LADEN</button><button type="button" class="ship-alert-dismiss" aria-label="Ausblenden">×</button></div></div>`);
      } catch (e) { /* offline: spaeter nochmal */ }
    }
    host.addEventListener("click", async (e) => {
      if (!e.target.closest(".ta-action")) return;
      try { const reg = await navigator.serviceWorker?.getRegistration(); if (reg) await reg.update(); } catch (err) { /* egal */ }
      location.reload();
    });
    setTimeout(check, 4000);
    setInterval(check, 10 * 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  })();

  // ---------- Kurzbefehle vom Handy-Icon (?action=...) ----------
  // Lange auf das App-Icon druecken: Schnelle Notiz, YouTube-Timer starten, Einkaufsliste (siehe "shortcuts" im Manifest).
  // Ausgefuehrt wird erst, wenn die Cloud geladen ist, sonst wuerde der Start vom noch leeren Stand ueberschrieben.
  (function appShortcuts() {
    const action = new URLSearchParams(location.search).get("action");
    if (!action) return;
    try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) { /* egal */ }
    const run = () => {
      if (action === "note") inboxBoard && inboxBoard.open();
      else if (action === "timer-youtube") { timeTrackerBoard && timeTrackerBoard.startIfIdle("youtube"); document.getElementById("zeit")?.scrollIntoView({ block: "start" }); }
      else if (action === "shopping") { foldBoard && foldBoard.expand("einkauf"); document.getElementById("einkauf")?.scrollIntoView({ block: "start" }); }
    };
    if (document.body.dataset.cloud === "ready") run();
    else document.addEventListener("cloud-ready", run, { once: true });
  })();

  // ---------- Sync-Button ----------
  const syncButton = document.getElementById("syncButton");
  const syncLabel = document.getElementById("syncButtonLabel");

  function getGithubConfig() {
    let owner = data.github?.owner || localStorage.getItem("dashboard-gh-owner") || "";
    let repo = data.github?.repo || localStorage.getItem("dashboard-gh-repo") || "";
    if (!owner || !repo) {
      const input = prompt('GitHub-Repo für den Sync (Format "benutzername/repo-name"):', `${owner}/${repo}`.replace(/^\/$/, ""));
      if (!input || !input.includes("/")) return null;
      [owner, repo] = input.split("/").map((s) => s.trim());
      localStorage.setItem("dashboard-gh-owner", owner);
      localStorage.setItem("dashboard-gh-repo", repo);
    }
    let token = localStorage.getItem("dashboard-gh-token");
    if (!token) {
      token = prompt(
        "GitHub Personal Access Token (fine-grained, mit 'Actions: Read and write' + 'Contents: Read and write' für dieses Repo, für Sync-Button und Habit-Tracker-Cloud-Sync). " +
          "Wird nur in deinem Browser gespeichert, nie im Code:"
      );
      if (!token) return null;
      localStorage.setItem("dashboard-gh-token", token.trim());
      token = token.trim();
    }
    return { owner, repo, token, workflowFile: data.github?.workflowFile || "sync-all.yml" };
  }

  syncButton.addEventListener("click", async () => {
    const config = getGithubConfig();
    if (!config) return;

    syncButton.disabled = true;
    syncButton.classList.add("spinning");
    syncLabel.textContent = "Synchronisiere…";

    // Habit-Tracker- und Video-Ideen/Studium/To-Do/Aufgaben-Stand laufen am selben Klick
    // mit hoch (Contents API, kein Workflow nötig — sofort fertig, nicht Teil des
    // "läuft 15-30s"-Hinweises unten).
    setAutoSyncStatus("saving");
    Promise.all([pushHabitsToCloud(config), pushSyncDataToCloud(config)])
      .then(([habitsOk, syncDataOk]) => setAutoSyncStatus(habitsOk && syncDataOk ? "saved" : "error"))
      .catch((err) => setAutoSyncStatus("error", err.message));

    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflowFile}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ref: "main" })
        }
      );

      if (res.status === 204) {
        // Spinner morpht sofort in einen Haken, statt noch 4s weiterzudrehen waehrend der
        // Text schon "Gestartet" sagt (wirkte vorher inkonsistent).
        syncButton.classList.remove("spinning");
        syncButton.classList.add("done");
        syncLabel.textContent = "Gestartet ✓";
        setTimeout(() => {
          syncButton.classList.remove("done");
          syncLabel.textContent = "Sync";
          syncButton.disabled = false;
        }, 4000);
        alert("Sync gestartet. Läuft ca. 15–30 Sekunden — lade die Seite danach neu.");
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("dashboard-gh-token");
        throw new Error("Token ungültig/abgelaufen (entfernt) — bitte beim nächsten Klick neu eingeben.");
      } else if (res.status === 404) {
        throw new Error("Repo oder Workflow nicht gefunden. Bitte Repo-Angabe prüfen (localStorage 'dashboard-gh-owner/-repo' löschen zum Neueingeben).");
      } else {
        throw new Error(`GitHub API antwortete mit Status ${res.status}`);
      }
    } catch (err) {
      syncLabel.textContent = "Sync";
      syncButton.disabled = false;
      syncButton.classList.remove("spinning");
      alert(`Sync fehlgeschlagen: ${err.message}`);
    }
  });

  // ---------- Scrollspy nav ----------
  const navLinks = Array.from(document.querySelectorAll("#mainNav a"));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const setActive = (id) => {
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
    // Handy: die Menueleiste scrollt waagerecht, der aktive Eintrag soll mittig sichtbar bleiben
    const nav = document.getElementById("mainNav");
    const act = navLinks.find((a) => a.classList.contains("active"));
    if (nav && act && nav.scrollWidth > nav.clientWidth + 2) {
      const left = act.getBoundingClientRect().left - nav.getBoundingClientRect().left + nav.scrollLeft;
      nav.scrollTo({ left: left - (nav.clientWidth - act.clientWidth) / 2, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ---------- Brain-Map: Vault-Struktur (aus data.brainMap, per lokalem Sync-Skript aktuell
  // gehalten), Hover/Klick-Interaktion, Notiz-Erfassung über die File System Access API ----------

  function layoutBrainNodes(areas) {
    const core = { id: "core", label: "Brain", x: 50, y: 50, z: 60, r: 15, color: "var(--accent)" };
    const nodes = [core];
    const links = [];
    const n = areas.length;
    areas.forEach((a, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(angle) * 36;
      const y = 50 + Math.sin(angle) * 34 * 0.9;
      const z = (i % 2 === 0 ? 1 : -1) * (10 + ((i * 6) % 24));
      const noteLabel = a.noteCount === 1 ? "1 Notiz" : `${a.noteCount} Notizen`;
      nodes.push({ id: a.id, label: a.folder, x, y, z, r: 8 + Math.min(4, a.noteCount * 0.4), color: a.color || "var(--accent)", stat: noteLabel });
      links.push(["core", a.id]);
    });
    return { nodes, links };
  }

  const brainAreas = data.brainMap?.areas || [];
  const { nodes: brainNodesData, links: brainLinksData } = layoutBrainNodes(brainAreas);
  const brainInteractiveIds = new Set(brainAreas.map((a) => a.id));

  const BRAIN_SPRITES = { core: "brain", bricklink: "brick", botf: "play", ideen: "bulb", laden: "shop", privat: "home", brainwalkers: "spark" };
  const brainNodesEl = document.getElementById("brainNodes");
  const brainLinksSvg = document.getElementById("brainLinks");
  const brainSceneWrap = document.getElementById("brainSceneWrap");

  brainNodesEl.innerHTML = brainNodesData
    .map(
      (t) => `
    <div class="node ${t.id === "core" ? "core" : ""}" data-topic="${t.id}" style="left:${t.x}%; top:${t.y}%; --z:${t.z}px; width:${t.r * 2}px; height:${t.r * 2}px;">
      <div class="dotcore" style="--nc:${t.color}">${pxSpr(BRAIN_SPRITES[t.id] || "star", t.id === "core" ? 40 : 28)}</div>
      ${t.label ? `<div class="node-label">${escapeHtml(t.label)}</div>` : ""}
    </div>`
    )
    .join("");

  // Flache, nicht 3D-transformierte Klick-/Hover-Flaechen — bewusst getrennt von .node
  // (siehe CSS-Kommentar): eine 3D-Kipp-Rotation macht Hit-Testing auf den echten Knoten
  // unzuverlaessig, sobald ihre Tiefe (--z) sie hinter ihren eigenen Container dreht.
  const brainHitsEl = document.getElementById("brainHits");
  brainHitsEl.innerHTML = brainNodesData
    .map((t) => {
      const isInteractive = brainInteractiveIds.has(t.id) || t.id === "core";
      const size = Math.max(28, t.r * 2 + 10);
      return `<div class="hit-target" data-topic="${t.id}" ${isInteractive ? "data-interactive" : ""} style="left:${t.x}%; top:${t.y}%; width:${size}px; height:${size}px;"></div>`;
    })
    .join("");

  function drawBrainLinks() {
    const wrap = brainSceneWrap.getBoundingClientRect();
    brainLinksSvg.setAttribute("viewBox", `0 0 ${wrap.width} ${wrap.height}`);
    brainLinksSvg.innerHTML = brainLinksData
      .map(([a, b]) => {
        const ta = brainNodesData.find((t) => t.id === a);
        const tb = brainNodesData.find((t) => t.id === b);
        return `<line data-a="${a}" data-b="${b}" class="hot" x1="${(ta.x / 100) * wrap.width}" y1="${(ta.y / 100) * wrap.height}" x2="${(tb.x / 100) * wrap.width}" y2="${(tb.y / 100) * wrap.height}" />`;
      })
      .join("");
  }
  if (brainNodesData.length > 1) {
    drawBrainLinks();
    window.addEventListener("resize", drawBrainLinks);
  }

  function setBrainHover(id) {
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.toggle("hovered", n.dataset.topic === id));
    brainLinksSvg.querySelectorAll("line").forEach((l) => l.classList.toggle("lit", id !== null && (l.dataset.a === id || l.dataset.b === id)));
  }
  brainHitsEl.querySelectorAll(".hit-target[data-interactive]").forEach((h) => {
    h.addEventListener("mouseenter", () => setBrainHover(h.dataset.topic));
    h.addEventListener("mouseleave", () => setBrainHover(null));
  });

  // Tilt-Parallax: EIN Transform fuer die ganze Szene (nicht pro Knoten) — Knoten und
  // Verbindungslinien laufen dadurch nie auseinander, unabhaengig von der Mausposition.
  const brainTilt = document.getElementById("brainTilt");
  let brainTargetX = 8,
    brainTargetY = -10,
    brainCurX = 8,
    brainCurY = -10;
  brainSceneWrap.addEventListener("mousemove", (e) => {
    const r = brainSceneWrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    brainTargetY = -10 + px * 16;
    brainTargetX = 8 - py * 12;
  });
  brainSceneWrap.addEventListener("mouseleave", () => {
    brainTargetX = 8;
    brainTargetY = -10;
  });
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    (function animateBrainTilt() {
      brainCurX += (brainTargetX - brainCurX) * 0.08;
      brainCurY += (brainTargetY - brainCurY) * 0.08;
      brainTilt.style.transform = `rotateX(${brainCurX}deg) rotateY(${brainCurY}deg)`;
      requestAnimationFrame(animateBrainTilt);
    })();
  }

  // ---------- Bereichs-Popover ----------
  const brainAreaPop = document.getElementById("brainAreaPop");
  let brainActiveId = null;

  function closeBrainPop() {
    brainActiveId = null;
    brainAreaPop.classList.remove("open");
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.remove("active"));
  }

  function openBrainPop(topic, anchorEl) {
    brainActiveId = topic.id;
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.toggle("active", n.dataset.topic === topic.id));
    brainAreaPop.innerHTML = `
      <p class="ap-title"><span class="ap-dot" style="background:${topic.color}"></span>${escapeHtml(topic.label)}</p>
      <p class="ap-stat">${topic.stat}</p>
      <div class="ap-actions">
        <button type="button" class="ap-btn" id="apClose">Schließen</button>
        <button type="button" class="ap-btn primary" id="apNote" style="--chip-c:${topic.color}">Notiz erfassen</button>
      </div>
    `;
    brainAreaPop.classList.add("open");

    const cardRect = document.querySelector(".brain-card").getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const popRect = brainAreaPop.getBoundingClientRect();
    const margin = 14;
    let left = anchorRect.left - cardRect.left + anchorRect.width / 2 - popRect.width / 2;
    left = Math.max(margin, Math.min(left, cardRect.width - popRect.width - margin));
    let top = anchorRect.bottom - cardRect.top + 14;
    if (top + popRect.height > cardRect.height - margin) {
      top = anchorRect.top - cardRect.top - popRect.height - 14;
    }
    top = Math.max(margin, top);
    brainAreaPop.style.left = `${left}px`;
    brainAreaPop.style.top = `${top}px`;

    document.getElementById("apNote").addEventListener("click", () => {
      closeBrainPop();
      openNoteModal(topic.id);
    });
    document.getElementById("apClose").addEventListener("click", closeBrainPop);
  }

  brainHitsEl.querySelectorAll(".hit-target[data-interactive]").forEach((h) => {
    h.addEventListener("click", (e) => {
      e.stopPropagation();
      const topic = brainNodesData.find((t) => t.id === h.dataset.topic);
      if (topic.id === "core") {
        closeBrainPop();
        openNoteModal();
        return;
      }
      if (brainActiveId === topic.id) closeBrainPop();
      else openBrainPop(topic, h);
    });
  });
  brainAreaPop.addEventListener("click", (e) => e.stopPropagation());
  // Klick auf leere Flaeche schliesst nur ein offenes Popover — das Notiz-Modal geht
  // bewusst ausschliesslich ueber den "Brain"-Kern-Knoten auf, kein zusaetzlicher Button.
  brainSceneWrap.addEventListener("click", () => {
    if (brainActiveId) closeBrainPop();
  });

  // ---------- Notiz-Erfassung: File System Access API (nur Chrome/Edge) ----------
  // Kein Cloud-Umweg: der Vault liegt lokal auf diesem Rechner, also reicht einmalige
  // Dateisystem-Berechtigung fuer den Vault-Ordner. Jede Notiz landet in "Notizen.md" im
  // jeweils richtigen Themen-Ordner (z.B. Bricklink/Notizen.md) statt in einer Sammeldatei -
  // "Ideen" ist dabei einfach der Auffang-Ordner fuer alles ohne spezifischere Kategorie.
  // Das Handle wird in IndexedDB gemerkt (localStorage kann keine FileSystemHandles speichern).
  const IDB_NAME = "dashboard-brain";
  const IDB_STORE = "handles";
  const IDB_KEY = "vaultDirHandle";
  const fsAccessSupported = "showDirectoryPicker" in window;
  let vaultDirHandle = null;

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getStoredVaultHandle() {
    if (vaultDirHandle) return vaultDirHandle;
    const stored = await idbGet(IDB_KEY).catch(() => null);
    if (stored) vaultDirHandle = stored;
    return vaultDirHandle;
  }
  async function connectVault() {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    vaultDirHandle = handle;
    await idbSet(IDB_KEY, handle);
    return handle;
  }
  async function appendNoteToFolder(dirHandle, folderName, text) {
    const folderHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });
    const fileHandle = await folderHandle.getFileHandle("Notizen.md", { create: true });
    let existing = "";
    try {
      existing = await (await fileHandle.getFile()).text();
    } catch (e) {
      /* neue/leere Datei, mit leerem Inhalt starten */
    }
    const stamp = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const entry = `## ${stamp}\n${text.trim()}\n\n`;
    const body = existing.trim() ? existing.replace(/\n*$/, "\n\n") : "# Notizen\n\n";
    const writable = await fileHandle.createWritable();
    await writable.write(body + entry);
    await writable.close();
    return `${folderName}/Notizen.md`;
  }

  // ---------- Notiz-Modal ----------
  const noteOverlay = document.getElementById("noteOverlay");
  const noteFormState = document.getElementById("noteFormState");
  const noteSavedState = document.getElementById("noteSavedState");
  const noteTextEl = document.getElementById("noteText");
  const noteChipRow = document.getElementById("noteChipRow");
  const noteGuessLabel = document.getElementById("noteGuessLabel");
  const noteSaveBtn = document.getElementById("noteSaveBtn");
  const noteModalSub = document.getElementById("noteModalSub");

  const noteChips = brainAreas.map((a) => ({ id: a.id, label: a.folder, color: a.color || "var(--accent)" }));
  const DEFAULT_NOTE_CHIP_ID = noteChips.find((c) => c.label.toLowerCase() === "ideen")?.id || noteChips[0]?.id || null;
  let noteSelectedChip = null;

  noteChipRow.innerHTML = noteChips
    .map((c) => `<button type="button" class="chip" data-id="${c.id}" style="--chip-c:${c.color}"><span class="cdot" style="background:${c.color}"></span>${escapeHtml(c.label)}</button>`)
    .join("");

  function setNoteChip(id, fromGuess) {
    noteSelectedChip = id;
    noteChipRow.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
    if (fromGuess) {
      const c = noteChips.find((x) => x.id === id);
      if (c) noteGuessLabel.textContent = `Erkannt: ${c.label} — du kannst das ändern.`;
    }
  }
  noteChipRow.querySelectorAll(".chip").forEach((btn) => btn.addEventListener("click", () => setNoteChip(btn.dataset.id, false)));

  noteTextEl.addEventListener("input", () => {
    const val = noteTextEl.value.toLowerCase();
    if (!val) {
      setNoteChip(DEFAULT_NOTE_CHIP_ID, false);
      noteGuessLabel.textContent = "Landet in „Ideen“, wenn keine andere Kategorie passt.";
      return;
    }
    const match = noteChips.find((c) => c.id !== DEFAULT_NOTE_CHIP_ID && (val.includes(c.label.toLowerCase()) || val.includes(c.id)));
    setNoteChip(match ? match.id : DEFAULT_NOTE_CHIP_ID, true);
  });

  const noteConnectionStatus = document.getElementById("noteConnectionStatus");

  // Prueft den Verbindungsstatus OHNE zu prompten (queryPermission fragt nie nach, nur
  // requestPermission tut das) und macht den Button-Text ehrlich: er sagt "Verbinden", wenn
  // ein Klick tatsaechlich einen Ordner-Dialog oeffnen wird, und nur "Speichern", wenn der
  // Klick wirklich sofort speichert — kein ueberraschender Dialog mehr bei "Speichern".
  async function refreshNoteModalState() {
    if (!fsAccessSupported) {
      noteModalSub.textContent = "Direktes Speichern braucht Chrome oder Edge.";
      noteConnectionStatus.textContent = "";
      noteSaveBtn.disabled = true;
      return;
    }
    const handle = await getStoredVaultHandle();
    let permitted = false;
    if (handle) {
      try {
        permitted = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
      } catch (e) {
        permitted = false;
      }
    }
    if (permitted) {
      noteModalSub.textContent = "Landet als Notizen.md im gewählten Themen-Ordner deines Vaults.";
      noteConnectionStatus.className = "modal-status ok";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Vault verbunden (${escapeHtml(handle.name)})`;
      noteSaveBtn.textContent = "Speichern";
    } else if (handle) {
      noteModalSub.textContent = "Zugriff auf deinen Vault-Ordner wurde zurückgesetzt (z.B. nach Browser-Neustart).";
      noteConnectionStatus.className = "modal-status pending";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Zugriff erneut bestätigen nötig — kein neuer Ordner-Dialog, nur eine kurze Bestätigung.`;
      noteSaveBtn.textContent = "Zugriff bestätigen & speichern";
    } else {
      noteModalSub.textContent = "Einmalig deinen Vault-Ordner auswählen — danach speichert „Speichern“ immer direkt.";
      noteConnectionStatus.className = "modal-status pending";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Noch nicht verbunden`;
      noteSaveBtn.textContent = "Vault verbinden & speichern";
    }
    noteSaveBtn.disabled = false;
  }

  function openNoteModal(presetId) {
    noteOverlay.classList.add("open");
    noteFormState.style.display = "";
    noteSavedState.classList.remove("show");
    noteTextEl.value = "";
    setNoteChip(presetId || DEFAULT_NOTE_CHIP_ID, false);
    noteGuessLabel.textContent = "Landet in „Ideen“, wenn keine andere Kategorie passt.";
    refreshNoteModalState();
    setTimeout(() => noteTextEl.focus(), 50);
  }
  function closeNoteModal() {
    noteOverlay.classList.remove("open");
  }

  document.getElementById("noteCloseBtn").addEventListener("click", closeNoteModal);
  document.getElementById("noteCancelBtn").addEventListener("click", closeNoteModal);
  noteOverlay.addEventListener("click", (e) => {
    if (e.target === noteOverlay) closeNoteModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && noteOverlay.classList.contains("open")) closeNoteModal();
  });

  noteSaveBtn.addEventListener("click", async () => {
    if (!fsAccessSupported) return;
    const text = noteTextEl.value.trim();
    if (!text) {
      noteTextEl.focus();
      return;
    }
    try {
      let handle = await getStoredVaultHandle();
      if (!handle) handle = await connectVault();
      const granted =
        (await handle.queryPermission({ mode: "readwrite" })) === "granted" ||
        (await handle.requestPermission({ mode: "readwrite" })) === "granted";
      if (!granted) {
        await refreshNoteModalState();
        return;
      }
      const folder = noteChips.find((c) => c.id === noteSelectedChip)?.label || "Ideen";
      const savedPath = await appendNoteToFolder(handle, folder, text);
      noteFormState.style.display = "none";
      noteSavedState.classList.add("show");
      document.getElementById("noteSavedFile").textContent = savedPath;
      setTimeout(closeNoteModal, 1400);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Brain-Notiz speichern fehlgeschlagen:", err);
        alert(`Speichern fehlgeschlagen: ${err.message}`);
      }
    }
  });

  // ---------- Notizen-Liste (unten im Dashboard, alle Themen-Ordner zusammengefasst) ----------
  // Quelle: data.notes, vom lokalen Sync-Skript aus jeder Notizen.md im Vault zusammengetragen.
  const notesListEl = document.getElementById("notesList");
  const notesData = data.notes || [];
  const colorByFolder = new Map(brainAreas.map((a) => [a.folder, a.color || "var(--accent)"]));

  notesListEl.innerHTML = notesData.length
    ? notesData
        .map((n) => {
          const color = colorByFolder.get(n.category) || "var(--accent)";
          const dateLabel = new Date(n.date).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
          return `<li class="note-row">
          <span class="note-tag"><span class="cdot" style="background:${color}"></span>${escapeHtml(n.category)}</span>
          <span class="note-date">${dateLabel}</span>
          <span class="note-text">${escapeHtml(n.text)}</span>
        </li>`;
        })
        .join("")
    : `<li class="notes-empty">Noch keine Notizen erfasst — klick auf „Brain“ in der Grafik oben.</li>`;

  // ---------- Goals ----------
  const accentByProject = {
    bricksOnTheFloor: "var(--accent-bricks)",
    brainwalkers: "var(--accent-brainwalkers)",
    bricklink: "var(--accent-bricklink)",
    tiktok: "var(--accent-tiktok)"
  };

  const daysUntil = (iso) => {
    const due = new Date(iso + "T00:00:00");
    const diff = Math.ceil((due - now) / 86400000);
    return diff;
  };

  // ---------- Wochenvergleich-Trendpfeile ----------
  // Vergleicht den aktuellsten Verlaufswert mit dem Wert von vor ~7 Tagen. Braucht dafür
  // metricsHistory (befüllt von scripts/sync-all.mjs) — in den ersten Tagen nach Einführung
  // ist noch keine Woche Verlauf da, dann bleibt die Badge einfach leer statt zu raten.
  const HISTORY_KEY_BY_GOAL = {
    "bricks-abos": "bricksOnTheFloorAbos",
    "brainwalkers-abos": "brainwalkersAbos",
    "tiktok-follower": "tiktokFollower"
  };

  function computeTrend(history, days = 7) {
    if (!history || history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const cutoff = new Date(latest.date + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - days);
    const past = [...sorted].reverse().find((h) => new Date(h.date + "T00:00:00") <= cutoff);
    if (!past) return null;
    return latest.value - past.value;
  }

  function renderTrendBadge(delta, unit, periodLabel = "7 Tage") {
    if (delta === null || delta === undefined) return "";
    if (delta === 0) return `<span class="trend-badge flat">→ ±0 (${periodLabel})</span>`;
    const dir = delta > 0 ? "up" : "down";
    const arrow = delta > 0 ? "↑" : "↓";
    const sign = delta > 0 ? "+" : "";
    return `<span class="trend-badge ${dir}">${arrow} ${sign}${fmtDE.format(delta)} ${unit || ""} (${periodLabel})</span>`;
  }

  // ---------- Ziel-Realitaets-Check ----------
  // Zeigt pro Ziel, welches Tempo bis zur Frist noetig ist, wie schnell du gerade bist und wo du bei
  // gleichbleibendem Tempo landest. Tempo: Follower/Abos aus metricsHistory (letzte 28 Tage, mind. 7 Tage Verlauf),
  // Longform-Videos aus dem Upload-Rhythmus des Kanals. Ohne Messwerte gibt es nur die Zeile "noetig".
  const PACE_WINDOW_DAYS = 28;
  const BIZ_BY_VIDEO_GOAL = { "bricks-longform-2026": "bricksOnTheFloor", "brainwalkers-longform-2026": "brainwalkers" };
  function goalPacePerDay(goal) {
    const key = HISTORY_KEY_BY_GOAL[goal.id];
    const hist = key ? data.metricsHistory?.[key] : null;
    if (hist && hist.length >= 2) {
      const sorted = [...hist].sort((a, b) => a.date.localeCompare(b.date));
      const latest = sorted[sorted.length - 1];
      const cutoff = new Date(latest.date + "T00:00:00");
      cutoff.setDate(cutoff.getDate() - PACE_WINDOW_DAYS);
      const past = sorted.find((h) => new Date(h.date + "T00:00:00") >= cutoff) || sorted[0];
      const days = (new Date(latest.date + "T00:00:00") - new Date(past.date + "T00:00:00")) / 86400000;
      if (days >= 7) return (latest.value - past.value) / days;
    }
    const biz = data.business?.[BIZ_BY_VIDEO_GOAL[goal.id]];
    if (biz?.uploadRhythmDays) return 1 / biz.uploadRhythmDays;
    return null;
  }
  function goalRealityHtml(goal, remaining) {
    if (goal.current >= goal.target) return `<div class="goal-reality"><span class="gr-tag good">ERREICHT</span></div>`;
    if (remaining <= 0) return `<div class="goal-reality"><span class="gr-tag bad">FRIST ABGELAUFEN</span></div>`;
    const weekly = goal.unit === "Videos";
    const k = weekly ? 7 : 1, unit = weekly ? "/Woche" : "/Tag";
    const fmtRate = (v) => (v < 20 ? fmtDE.format(Math.round(v * 10) / 10) : fmtDE.format(Math.round(v)));
    const need = (goal.target - goal.current) / remaining;
    const pace = goalPacePerDay(goal);
    const needRow = `<div class="gr-row"><span class="gr-l">NÖTIG</span><div class="gr-blk gr-need">${"<i></i>".repeat(20)}</div><b>${fmtRate(need * k)}${unit}</b></div>`;
    if (pace === null) return `<div class="goal-reality">${needRow}<p class="gr-note">Tempo noch nicht messbar.</p></div>`;
    const proj = goal.current + Math.max(0, pace) * remaining, ratio = proj / goal.target;
    const [label, cls] = ratio >= 0.97 ? ["AUF KURS", "good"] : ratio >= 0.9 ? ["KNAPP DAHINTER", "warn"] : ratio >= 0.7 ? ["DAHINTER", "warn"] : ["ZU WEIT WEG", "bad"];
    const lit = Math.max(pace > 0 ? 1 : 0, Math.min(20, Math.round((Math.max(0, pace) / need) * 20)));
    return `<div class="goal-reality">${needRow}
      <div class="gr-row gr-${cls}"><span class="gr-l">AKTUELL</span><div class="gr-blk">${Array.from({ length: 20 }, (_, i) => `<i class="${i < lit ? "on" : ""}"></i>`).join("")}</div><b>${fmtRate(Math.max(0, pace) * k)}${unit}</b></div>
      <div class="gr-row gr-${cls}"><span class="gr-l" title="Prognose zum ${fmtDate(goal.due)}">PROGNOSE</span><span class="gr-tag ${cls}">${label}</span><b title="Stand zum ${fmtDate(goal.due)}">${fmtDE.format(Math.round(proj))}</b></div></div>`;
  }

  const goalsGrid = document.getElementById("goalsGrid");
  // Beim allerersten Laden (Feature gerade erst ausgerollt, noch kein gespeicherter Stand)
  // gaebe es sonst fuer JEDES Ziel sofort einen "Level Up"-Toast, obwohl der aktuelle
  // Fortschritt ja gar nicht neu ist - stattdessen den heutigen Stand still als Basislinie
  // uebernehmen und erst ab der naechsten wirklich neuen 10%-Marke einen Toast zeigen.
  const isFirstMilestoneRun = localStorage.getItem(GOAL_MILESTONE_KEY) === null;
  const goalMilestonesSeen = loadGoalMilestonesSeen();
  let goalMilestonesChanged = false;
  data.goals.forEach((goal) => {
    const accent = accentByProject[goal.project] || "var(--accent-goal)";
    const pct = Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
    const remaining = daysUntil(goal.due);
    const dueLabel =
      remaining > 0 ? `noch ${fmtDE.format(remaining)} Tage` : remaining === 0 ? "heute fällig" : "überfällig";

    const card = document.createElement("div");
    card.className = "card goal-card";
    card.style.setProperty("--card-accent", accent);

    if (goal.isMilestone) {
      const reached = goal.current >= goal.target;
      card.innerHTML = `
        <p class="card-title">${goal.label}</p>
        <p class="card-subtitle">Ziel bis ${fmtDate(goal.due)} · ${dueLabel}</p>
        <span class="milestone-badge ${reached ? "done" : ""}">${reached ? "✓ erreicht" : "○ noch offen"}</span>
      `;
    } else {
      const historyKey = HISTORY_KEY_BY_GOAL[goal.id];
      const trend = historyKey ? computeTrend(data.metricsHistory?.[historyKey]) : null;
      card.innerHTML = `
        <p class="card-title">${goal.label}</p>
        <div class="gauge-row">
          <div class="gauge" style="--gc:${accent}"><span></span></div>
          <div class="gauge-meta">
            <span class="num">${fmtDE.format(goal.current)} <span class="num-u">${goal.unit}</span></span>
            <span class="lbl">Ziel ${fmtDE.format(goal.target)} ${goal.unit}</span>
            <span class="due">${dueLabel}</span>
          </div>
        </div>
        ${goalRealityHtml(goal, remaining)}
        ${trend !== null ? `<div class="goal-trend">${renderTrendBadge(trend, goal.unit)}</div>` : ""}
      `;

      // Bei jeder NEU ueberschrittenen 10%-Marke (60, 70, 80, ...) einen "Level Up"-Toast
      // anstossen - nicht erst beim finalen Erreichen. Marken unter 10% werden bewusst
      // ignoriert (sonst wuerde quasi jedes frisch angelegte Ziel sofort einen Toast ausloesen).
      const decile = Math.floor(pct / 10) * 10;
      if (decile >= 10 && decile > (goalMilestonesSeen[goal.id] || 0)) {
        goalMilestonesSeen[goal.id] = decile;
        goalMilestonesChanged = true;
        if (!isFirstMilestoneRun) queueMilestoneToast(`${decile}% ERREICHT!`, goal.label);
      }
    }
    goalsGrid.appendChild(card);
    if (!goal.isMilestone) animateGauge(card.querySelector(".gauge"), pct, accent);
  });
  if (goalMilestonesChanged) saveGoalMilestonesSeen(goalMilestonesSeen);

  // ---------- Studium-Countdown (nächste Prüfung/Abgabe) ----------
  // Bewusst klein — kein neuer "Privat"-Bereich, nur ein einzelner editierbarer Termin
  // als kompakte Karte in der Ziele-Sektion. Cloud-Sync ueber sync-data.json (siehe
  // Abschnitt "Cloud-Sync: Video-Ideen / Studium-Termin / To-Do / Aufgaben" unten),
  // gleiches Zeitstempel-Prinzip wie beim Habit-Tracker.
  const STUDIUM_STORAGE_KEY = "dashboard-studium-deadline";
  const loadStudiumDeadline = () => {
    try {
      const raw = dataStore.getItem(STUDIUM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        return parsed;
      }
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    return { label: "", date: "", updatedAt: -1 };
  };
  const saveStudiumDeadline = (d) => {
    const state = { label: d.label || "", date: d.date || "", updatedAt: Date.now() };
    dataStore.setItem(STUDIUM_STORAGE_KEY, JSON.stringify(state));
    scheduleAutoSync("syncdata");
    return state;
  };

  function buildStudiumCard() {
    const deadline = loadStudiumDeadline();
    const card = document.createElement("div");
    card.className = "card goal-card studium-card";
    card.style.setProperty("--card-accent", "var(--accent-privat)");

    if (deadline.date) {
      const remaining = daysUntil(deadline.date);
      const dueLabel =
        remaining > 0 ? `noch ${fmtDE.format(remaining)} Tage` : remaining === 0 ? "heute" : "vorbei";
      card.innerHTML = `
        <p class="card-title">🎓 ${escapeHtml(deadline.label || "Prüfung/Abgabe")}</p>
        <p class="card-subtitle">${fmtDate(deadline.date)} · ${dueLabel}</p>
        <button type="button" class="link-button-inline" id="studiumEditBtn">Ändern</button>
      `;
    } else {
      card.innerHTML = `
        <p class="card-title">🎓 Studium</p>
        <p class="card-subtitle">Noch keine nächste Prüfung/Abgabe eingetragen</p>
        <button type="button" class="link-button-inline" id="studiumEditBtn">Termin eintragen</button>
      `;
    }

    card.querySelector("#studiumEditBtn").addEventListener("click", () => {
      const label = prompt("Bezeichnung (z.B. \"Klausur Marketing\"):", deadline.label || "");
      if (label === null) return;
      const dateInput = prompt("Datum (JJJJ-MM-TT):", deadline.date || "");
      if (dateInput === null) return;
      saveStudiumDeadline({ label: label.trim(), date: dateInput.trim() });
      refreshStudiumCard();
    });

    return card;
  }
  // Eigene Funktion statt direkt in buildStudiumCard, da diese Karte auch nach einem
  // Remote-Fetch (neuerer Cloud-Stand) neu gebaut wird, ohne die Position der anderen
  // Ziel-Karten in goalsGrid zu verschieben (replaceChild statt remove+append).
  let studiumCardEl = null;
  function refreshStudiumCard() {
    const newCard = buildStudiumCard();
    if (studiumCardEl && studiumCardEl.parentNode) {
      studiumCardEl.parentNode.replaceChild(newCard, studiumCardEl);
    } else {
      goalsGrid.appendChild(newCard);
    }
    studiumCardEl = newCard;
  }
  refreshStudiumCard();

  // ---------- Business ----------
  const businessGrid = document.getElementById("businessGrid");
  const accentVarByKey = {
    bricklink: "var(--accent-bricklink)",
    bricksOnTheFloor: "var(--accent-bricks)",
    brainwalkers: "var(--accent-brainwalkers)"
  };

  const RHYTHM_META = {
    green: { dot: "🟢", label: "im Rhythmus" },
    yellow: { dot: "🟡", label: "wird knapp" },
    red: { dot: "🔴", label: "überfällig" }
  };

  function daysSince(iso) {
    if (!iso) return null;
    return Math.floor((now - new Date(iso)) / 86400000);
  }

  function rhythmStatus(days, targetDays) {
    if (days === null) return null;
    if (days <= targetDays) return "green";
    if (days <= targetDays * 1.5) return "yellow";
    return "red";
  }

  function renderRhythmBadge(biz) {
    if (!biz.uploadRhythmDays) return "";
    const days = daysSince(biz.lastUploadAt);
    if (days === null) {
      return `<p class="rhythm-badge neutral">⏳ Longform-Rhythmus: noch nicht synchronisiert</p>`;
    }
    const status = rhythmStatus(days, biz.uploadRhythmDays);
    const meta = RHYTHM_META[status];
    const dayLabel = days === 0 ? "heute" : days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
    return `<p class="rhythm-badge ${status}">${meta.dot} Letztes Longform-Video ${dayLabel} · ${meta.label} (Ziel: alle ${biz.uploadRhythmDays} Tage, Shorts zählen nicht)</p>`;
  }

  // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker
  // (siehe Abschnitt weiter unten). "Naechste Video-Idee" wird ueber ein explizites
  // nextId bestimmt statt ueber die Listenposition: wird die aktuelle naechste Idee
  // abgehakt/entfernt, bleibt der Platz bewusst LEER, statt automatisch die naechste aus
  // "Weitere Ideen" nachrutschen zu lassen - befoerdert wird ausschliesslich per Klick.
  // Migriert drei Altformate transparent: {items, updatedAt} ohne nextId (Zwischenversion,
  // wo Position 0 implizit "naechste Idee" war), {text, updatedAt} (Einzelidee vor jeglicher
  // Liste) und ein purer String (vor jeglichem Wrapper).
  const loadIdeaState = (key) => {
    const raw = dataStore.getItem(`dashboard-idea-${key}`);
    if (raw === null) return { nextId: null, items: [], updatedAt: -1 };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && Array.isArray(parsed.items)) {
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        if (!("nextId" in parsed)) parsed.nextId = parsed.items[0]?.id ?? null;
        return parsed;
      }
      if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
        const item = parsed.text.trim() ? { id: newId(), text: parsed.text } : null;
        return {
          nextId: item ? item.id : null,
          items: item ? [item] : [],
          updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : 0
        };
      }
    } catch (e) {
      /* Alt-Alt-Format: purer String vor jeglichem Wrapper */
      if (raw.trim()) {
        const item = { id: newId(), text: raw };
        return { nextId: item.id, items: [item], updatedAt: 0 };
      }
      return { nextId: null, items: [], updatedAt: 0 };
    }
    return { nextId: null, items: [], updatedAt: -1 };
  };
  const saveIdeaState = (key, nextId, items) => {
    const state = { nextId, items, updatedAt: Date.now() };
    dataStore.setItem(`dashboard-idea-${key}`, JSON.stringify(state));
    scheduleAutoSync("syncdata");
    return state;
  };
  const ideaWidgets = {};

  function renderIdeaWidget(key) {
    const widget = ideaWidgets[key];
    if (!widget) return;
    const state = loadIdeaState(key);
    const nextItem = state.items.find((i) => i.id === state.nextId) || null;
    const backlogItems = state.items.filter((i) => i.id !== state.nextId);

    widget.nextEl.classList.remove("done");
    widget.nextEl.classList.toggle("empty", !nextItem);
    widget.nextEl.innerHTML = nextItem
      ? `<input type="checkbox" aria-label="Video ist fertig — Idee entfernen" />
         <span class="idea-next-text">${escapeHtml(nextItem.text)}</span>`
      : `<span class="idea-next-empty">Noch keine Idee ausgewählt — eine aus „Weitere Ideen“ wählen.</span>`;
    if (nextItem) {
      widget.nextEl.querySelector("input[type=checkbox]").addEventListener("change", () => {
        removeIdeaItem(key, nextItem.id, widget.nextEl);
      });
    }

    widget.backlogEl.innerHTML = backlogItems
      .map(
        (item) => `
        <li class="idea-row" data-id="${item.id}">
          <input type="checkbox" aria-label="Video ist fertig — Idee entfernen" />
          <span class="idea-row-text">${escapeHtml(item.text)}</span>
          <button type="button" class="idea-promote" aria-label="Als nächste Idee auswählen">↑</button>
        </li>`
      )
      .join("");
    widget.backlogEl.querySelectorAll(".idea-row").forEach((row) => {
      const id = row.dataset.id;
      row.querySelector("input[type=checkbox]").addEventListener("change", () => removeIdeaItem(key, id, row));
      row.querySelector(".idea-row-text").addEventListener("click", () => promoteIdea(key, id));
      row.querySelector(".idea-promote").addEventListener("click", () => promoteIdea(key, id));
    });
    staggerListOnce(widget.backlogEl);
  }

  function promoteIdea(key, id) {
    const state = loadIdeaState(key);
    if (!state.items.some((i) => i.id === id)) return;
    saveIdeaState(key, id, state.items);
    renderIdeaWidget(key);
  }

  function removeIdeaItem(key, id, rowEl) {
    // Kurz sichtbar durchgestrichen wie bei Aufgaben, dann erst entfernen.
    rowEl.classList.add("done");
    setTimeout(() => {
      const state = loadIdeaState(key);
      const items = state.items.filter((i) => i.id !== id);
      // War die entfernte Idee gerade "naechste Idee": Platz bewusst leer lassen statt
      // automatisch eine andere nachrutschen zu lassen (siehe Kommentar oben).
      const nextId = state.nextId === id ? null : state.nextId;
      saveIdeaState(key, nextId, items);
      renderIdeaWidget(key);
    }, 400);
  }

  Object.entries(data.business).forEach(([key, biz]) => {
    const card = document.createElement("div");
    card.className = "card business-card";
    card.style.setProperty("--card-accent", accentVarByKey[key] || "var(--accent-goal)");

    if (key === "bricklink" && data.bricklinkOrders?.checkedAt) {
      biz = {
        ...biz,
        stats: biz.stats.map((s) =>
          s.label === "Sendung ausstehend"
            ? { ...s, value: String(data.bricklinkOrders.pendingShipments.length), hint: "live via Bricklink-API" }
            : s
        )
      };
    }

    const stats = biz.stats
      .map(
        (s) => `
        <div class="stat-row">
          <span class="stat-label">${s.label}</span>
          <span class="stat-value"><span class="stat-value-num" data-final="${escapeHtml(s.value)}"></span>${s.hint ? `<span class="stat-hint">${s.hint}</span>` : ""}</span>
        </div>`
      )
      .join("");

    const isYoutubeChannel = key === "bricksOnTheFloor" || key === "brainwalkers";

    card.innerHTML = `
      <p class="card-title">${biz.title}</p>
      <p class="card-subtitle">${biz.subtitle}</p>
      <div class="stat-list">${stats}</div>
      ${biz.note ? `<p class="card-note">${biz.note}</p>` : ""}
      ${renderRhythmBadge(biz)}
      ${
        isYoutubeChannel
          ? `<div class="idea-note">
              <p class="idea-note-label">Nächste Video-Idee</p>
              <div class="idea-next" id="idea-next-${key}"></div>
              <ul class="idea-backlog" id="idea-backlog-${key}"></ul>
              <div class="idea-add">
                <textarea id="idea-input-${key}" rows="3" placeholder="Neue Video-Idee… (Enter zum Hinzufügen, Shift+Enter für Zeilenumbruch)" maxlength="300"></textarea>
                <button type="button" id="idea-add-btn-${key}" aria-label="Idee hinzufügen">+</button>
              </div>
            </div>`
          : ""
      }
    `;
    businessGrid.appendChild(card);
    card.querySelectorAll(".stat-value-num").forEach((el) => animateStatValue(el));

    if (isYoutubeChannel) {
      const nextEl = card.querySelector(`#idea-next-${key}`);
      const backlogEl = card.querySelector(`#idea-backlog-${key}`);
      const addInput = card.querySelector(`#idea-input-${key}`);
      const addBtn = card.querySelector(`#idea-add-btn-${key}`);
      ideaWidgets[key] = { nextEl, backlogEl };
      renderIdeaWidget(key);

      const addIdea = () => {
        const text = addInput.value.trim();
        if (!text) return;
        const state = loadIdeaState(key);
        // Neue Ideen landen immer in "Weitere Ideen" - auch wenn der "naechste Idee"-Platz
        // gerade leer ist, wird er nicht automatisch befuellt (nur per Klick, siehe oben).
        const newItem = { id: newId(), text };
        const items = [...state.items, newItem];
        saveIdeaState(key, state.nextId, items);
        addInput.value = "";
        renderIdeaWidget(key);
        flashNewItem(backlogEl, newItem.id);
      };
      addBtn.addEventListener("click", addIdea);
      addInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          addIdea();
        }
      });
    }
  });

  // ---------- Umsatz-Trend (Bricklink) ----------
  const revenue = data.bricklinkRevenue;
  const hasWeekly = revenue?.weekly?.length > 0;
  const hasMonthly = revenue?.monthly?.length > 0;

  if (hasWeekly || hasMonthly) {
    document.getElementById("revenuePanel").hidden = false;
  }

  if (hasWeekly) {
    document.getElementById("revenueWeeklyBlock").hidden = false;
    const first = fmtDate(revenue.weekly[0].weekStart);
    const last = fmtDate(revenue.weekly[revenue.weekly.length - 1].weekStart);
    const weekCount = revenue.weekly.length;
    const revenueTrend =
      weekCount >= 2 ? revenue.weekly[weekCount - 1].total - revenue.weekly[weekCount - 2].total : null;
    document.getElementById("revenueWeeklyRangeLabel").innerHTML =
      `${first} – ${last} · pro Kalenderwoche` +
      (revenueTrend !== null ? ` · ${renderTrendBadge(Math.round(revenueTrend * 100) / 100, "€", "ggü. Vorwoche")}` : "");
    renderRevenueChart({
      svgId: "revenueChartWeekly",
      entries: revenue.weekly,
      currency: revenue.currency,
      keyField: "weekStart",
      formatLabel: (key) => new Date(key + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      formatTooltip: (key) => `KW ab ${fmtDate(key)}`
    });
  }

  if (hasMonthly) {
    document.getElementById("revenueMonthlyBlock").hidden = false;
    const fmtMonth = (key) => new Date(key + "-01T00:00:00").toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    document.getElementById("revenueMonthlyRangeLabel").textContent = `${fmtMonth(revenue.monthly[0].month)} – ${fmtMonth(revenue.monthly[revenue.monthly.length - 1].month)} · pro Kalendermonat`;
    renderRevenueChart({
      svgId: "revenueChartMonthly",
      entries: revenue.monthly,
      currency: revenue.currency,
      keyField: "month",
      formatLabel: fmtMonth,
      formatTooltip: fmtMonth
    });
  }

  function renderRevenueChart({ svgId, entries, currency, keyField, formatLabel, formatTooltip }) {
    const container = document.getElementById(svgId);
    const maxTotal = Math.max(1, ...entries.map((e) => e.total));
    const currencySign = currency === "EUR" ? "€" : "";

    container.innerHTML = entries
      .map((e) => {
        const key = e[keyField];
        const h = Math.round((e.total / maxTotal) * 150) + 24;
        return `<div class="iso-bar-col" title="${formatTooltip(key)}: ${e.total.toFixed(2)} ${currency} (${e.orderCount} Bestellungen)">
          <div class="iso-bar-value">${Math.round(e.total)}${currencySign}</div>
          <div class="iso-bar" style="--h:${h}px"></div>
          <div class="iso-bar-label">${formatLabel(key)}</div>
        </div>`;
      })
      .join("");
    growBarsIn(container);
  }

  // ---------- Tages-To-Do ----------
  const TODO_CATEGORIES = [
    { id: "business", label: "Business (Bricklink & YouTube)", accent: "var(--accent-bricks)" },
    { id: "studium", label: "Studium & Job", accent: "var(--accent-privat)" },
    { id: "privat", label: "Privates", accent: "var(--accent-laden)" }
  ];

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const TODO_STORAGE_KEY = `dashboard-todo-${todayKey()}`;

  // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker
  // (siehe Abschnitt weiter unten). loadTodosState() liefert den Wrapper mit Zeitstempel
  // (fuer den Abgleich mit der Cloud), loadTodos() nur die Kategorien-Items (fuer die UI).
  // parseTodosPayload() ist von migrateStaleTodosToTasks() weiter unten mitbenutzt, um auch
  // die Tages-To-Do-Eintraege VERGANGENER Tage (eigener Storage-Key pro Tag) einlesen zu
  // koennen, nicht nur den heutigen TODO_STORAGE_KEY.
  const parseTodosPayload = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.items) {
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        return parsed;
      }
      // Altformat: Kategorien-Objekt direkt ohne Wrapper (vor Einfuehrung des Cloud-Sync)
      return { items: parsed, updatedAt: 0 };
    } catch (e) {
      return null;
    }
  };
  const loadTodosState = () => {
    const raw = dataStore.getItem(TODO_STORAGE_KEY);
    if (raw) {
      const parsed = parseTodosPayload(raw);
      if (parsed) return parsed;
    }
    const empty = {};
    TODO_CATEGORIES.forEach((c) => (empty[c.id] = []));
    return { items: empty, updatedAt: -1 };
  };
  const loadTodos = () => loadTodosState().items;
  const saveTodos = (items) => {
    dataStore.setItem(TODO_STORAGE_KEY, JSON.stringify({ items, updatedAt: Date.now() }));
    scheduleAutoSync("syncdata");
  };

  let todos = loadTodos();
  const todoGrid = document.getElementById("todoGrid");
  document.getElementById("todoDateLabel").textContent = `Setzt sich täglich automatisch zurück, offene Punkte wandern in „Aufgaben“ · ${now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}`;

  // todoGrid wird bei JEDEM Render komplett neu aufgebaut (alle drei Spalten-Karten inkl.
  // ihrer <ul>s sind also bei jedem Aufruf brandneue DOM-Knoten) - ein data-Attribut-Flag
  // wie bei staggerListOnce() wuerde hier also nichts nuetzen. Stattdessen dieses Modul-
  // weite Flag: true nach dem allerersten Render, damit nur der initiale Seitenaufbau
  // gestaffelt einfliegt und nicht jede Kleinigkeit (Haekchen, geloeschter Eintrag) die
  // komplette Spalte neu einfliegen laesst.
  let todoGridStaggeredOnce = false;

  function renderTodos() {
    todoGrid.innerHTML = "";
    TODO_CATEGORIES.forEach((cat) => {
      const items = todos[cat.id] || [];
      const doneCount = items.filter((i) => i.done).length;

      const listHtml = items.length
        ? items
            .map(
              (item) => `
        <li class="todo-item ${item.done ? "done" : ""}" data-id="${item.id}">
          <input type="checkbox" ${item.done ? "checked" : ""} />
          <span>${escapeHtml(item.text)}</span>
          <button type="button" class="todo-remove" aria-label="Entfernen">×</button>
        </li>`
            )
            .join("")
        : `<li class="todo-empty">Noch nichts eingetragen.</li>`;

      const card = document.createElement("div");
      card.className = "card todo-card";
      card.style.setProperty("--card-accent", cat.accent);
      card.innerHTML = `
        <p class="card-title">${cat.label}</p>
        <p class="todo-progress">${items.length ? `${doneCount}/${items.length} erledigt` : "&nbsp;"}</p>
        <div class="todo-add">
          <input type="text" placeholder="Aufgabe hinzufügen…" maxlength="120" />
          <button type="button" aria-label="Hinzufügen">+</button>
        </div>
        <ul class="todo-list">${listHtml}</ul>
      `;

      const input = card.querySelector(".todo-add input");
      const addItem = () => {
        const text = input.value.trim();
        if (!text) return;
        todos[cat.id] = todos[cat.id] || [];
        const newItem = { id: newId(), text, done: false };
        todos[cat.id].push(newItem);
        saveTodos(todos);
        renderTodos();
        flashNewItem(todoGrid, newItem.id);
      };
      card.querySelector(".todo-add button").addEventListener("click", addItem);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addItem();
      });

      card.querySelectorAll(".todo-item").forEach((row) => {
        const id = row.getAttribute("data-id");
        row.querySelector("input[type=checkbox]").addEventListener("change", (e) => {
          const item = todos[cat.id].find((i) => i.id === id);
          if (item) item.done = e.target.checked;
          if (e.target.checked && xpBoard) xpBoard.award(`todo:${id}`, 10, e.target); // Tages-To-Do = 10 XP
          saveTodos(todos);
          renderTodos();
        });
        row.querySelector(".todo-remove").addEventListener("click", () => {
          todos[cat.id] = todos[cat.id].filter((i) => i.id !== id);
          saveTodos(todos);
          renderTodos();
        });
      });

      todoGrid.appendChild(card);
      if (!todoGridStaggeredOnce) staggerListItems(card.querySelector(".todo-list"));
    });
    todoGridStaggeredOnce = true;
  }

  renderTodos();

  // ---------- Aufgaben + Remote Tasks (persistent, kein täglicher Reset) ----------
  // Beide Listen funktionieren identisch und unterscheiden sich nur in Storage-Key, Feld in
  // sync-data.json und den DOM-Elementen - daher eine gemeinsame Fabrik.
  function createTaskBoard({ storageKey, listId, inputId, addBtnId, xpKey }) {
    // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker.
    const loadState = () => {
      try {
        const raw = dataStore.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return { items: parsed, updatedAt: 0 }; // Altformat: reines Array
          if (parsed && Array.isArray(parsed.items)) {
            if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
            return parsed;
          }
        }
      } catch (e) {
        /* corrupted storage, fall back to empty */
      }
      return { items: [], updatedAt: -1 };
    };
    const board = { items: loadState().items, loadState };
    const listEl = document.getElementById(listId);
    const inputEl = document.getElementById(inputId);
    board.listEl = listEl;

    board.save = () => {
      dataStore.setItem(storageKey, JSON.stringify({ items: board.items, updatedAt: Date.now() }));
      scheduleAutoSync("syncdata");
    };

    // Verschiebt eine Aufgabe zurueck ins heutige Tages-To-Do (in die gewaehlte Spalte) - das
    // Gegenstueck zu migrateStaleTodosToTasks() weiter unten, das den umgekehrten Weg geht.
    function moveToTodo(id, categoryId) {
      const item = board.items.find((t) => t.id === id);
      if (!item) return;
      board.items = board.items.filter((t) => t.id !== id);
      todos[categoryId] = todos[categoryId] || [];
      const newItem = { id: newId(), text: item.text, done: false };
      todos[categoryId].push(newItem);
      board.save();
      saveTodos(todos);
      board.render();
      renderTodos();
      flashNewItem(todoGrid, newItem.id);
    }

    board.render = () => {
      listEl.innerHTML = board.items.length
        ? board.items
            .map(
              (item) => `
      <li class="todo-item ${item.done ? "done" : ""}" data-id="${item.id}">
        <input type="checkbox" ${item.done ? "checked" : ""} />
        <span>${escapeHtml(item.text)}</span>
        <div class="todo-move-wrap">
          <button type="button" class="todo-move" aria-label="Ins Tages-To-Do verschieben" title="Ins Tages-To-Do verschieben">↩</button>
          <div class="todo-move-menu" hidden>
            ${TODO_CATEGORIES.map((cat) => `<button type="button" data-cat="${cat.id}">${cat.label}</button>`).join("")}
          </div>
        </div>
        <button type="button" class="todo-remove" aria-label="Entfernen">×</button>
      </li>`
            )
            .join("")
        : `<li class="todo-empty">Noch nichts eingetragen.</li>`;

      const closeAllMoveMenus = () => listEl.querySelectorAll(".todo-move-menu").forEach((m) => (m.hidden = true));

      listEl.querySelectorAll(".todo-item").forEach((row) => {
        const id = row.getAttribute("data-id");
        row.querySelector("input[type=checkbox]").addEventListener("change", () => {
          // Abhaken = erledigt: kurz sichtbar durchgestrichen, dann automatisch aus der Liste
          // entfernt (im Gegensatz zum Tages-To-Do, das bleibt hier nichts dauerhaft "erledigt"
          // liegen — das ist ja gerade der Sinn dieser Liste, anders als beim täglichen Reset).
          row.classList.add("done");
          if (xpBoard) xpBoard.award(`${xpKey}:${id}`, 12, row.querySelector("input[type=checkbox]")); // Aufgabe = 12 XP
          setTimeout(() => {
            board.items = board.items.filter((t) => t.id !== id);
            board.save();
            board.render();
          }, 400);
        });
        row.querySelector(".todo-remove").addEventListener("click", () => {
          board.items = board.items.filter((t) => t.id !== id);
          board.save();
          board.render();
        });
        const menu = row.querySelector(".todo-move-menu");
        row.querySelector(".todo-move").addEventListener("click", (e) => {
          e.stopPropagation();
          const wasHidden = menu.hidden;
          closeAllMoveMenus();
          menu.hidden = !wasHidden;
        });
        menu.querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", (e) => {
            e.stopPropagation();
            moveToTodo(id, btn.getAttribute("data-cat"));
          });
        });
      });

      if (!listEl.dataset.moveMenuOutsideClickBound) {
        listEl.dataset.moveMenuOutsideClickBound = "1";
        document.addEventListener("click", closeAllMoveMenus);
      }
      staggerListOnce(listEl);
    };

    function add() {
      const text = inputEl.value.trim();
      if (!text) return;
      const newItem = { id: newId(), text, done: false };
      board.items.push(newItem);
      board.save();
      inputEl.value = "";
      board.render();
      flashNewItem(listEl, newItem.id);
    }
    document.getElementById(addBtnId).addEventListener("click", add);
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") add();
    });

    // Cloud-Stand uebernehmen (Regeln siehe remoteWins). Direkt in den Speicher mit dem
    // Cloud-Zeitstempel, ohne save(): kein unnoetiger Rueck-Push.
    board.applyRemote = (remote) => {
      if (!remote) return;
      const localState = loadState();
      const remoteUpdatedAt = typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
      const remoteItems = remote.items || [];
      if (remoteWins(remoteUpdatedAt, localState.updatedAt, remoteItems.length > 0, localState.items.length > 0)) {
        board.items = remoteItems;
        dataStore.setItem(storageKey, JSON.stringify({ items: board.items, updatedAt: remoteUpdatedAt }));
        board.render();
      }
    };

    // Fuer den Push nach sync-data.json; -1 ("nie gespeichert") auf 0 normalisieren.
    board.payload = () => {
      const st = loadState();
      return { items: st.items, updatedAt: Math.max(0, st.updatedAt) };
    };

    board.render();
    return board;
  }

  // Level-System (xp.js): jedes Abhaken gibt Punkte, die automatisch gezaehlt werden; Stand in der Cloud (Feld "xp" in sync-data.json)
  const xpBoard = window.createXp
    ? window.createXp({
        dataStore,
        scheduleAutoSync,
        onGain: (pts, el) => pixelBurst(el || document.getElementById("lvlBox"), `+${pts} XP`),
        onLevelUp: (level, rank, rankUp) => celebrateLevelUp(level, rank, rankUp)
      })
    : null;
  let remoteXpRaw = null;

  const taskBoard = createTaskBoard({
    xpKey: "task",
    storageKey: "dashboard-tasks-v1",
    listId: "taskList",
    inputId: "taskInput",
    addBtnId: "taskAddBtn"
  });
  const remoteTaskBoard = createTaskBoard({
    xpKey: "rtask",
    storageKey: "dashboard-remote-tasks-v1",
    listId: "remoteTaskList",
    inputId: "remoteTaskInput",
    addBtnId: "remoteTaskAddBtn"
  });
  const taskList = taskBoard.listEl;
  const remoteTaskList = remoteTaskBoard.listEl;

  // Einkaufsliste (Logik, Symbole und Oberfläche in shopping.js). Liegt wie alles andere nur in der
  // Cloud: Feld "shopping" in sync-data.json, gleiche Zeitstempel-/Merge-Regeln wie die Aufgaben.
  const shoppingBoard = window.createShoppingBoard
    ? window.createShoppingBoard({ dataStore, scheduleAutoSync, remoteWins, newId, xp: xpBoard })
    : null;
  // Rohstand aus der Cloud: falls shopping.js mal nicht geladen ist, wird er beim Push unveraendert
  // zurueckgeschrieben statt versehentlich geloescht.
  let remoteShoppingRaw = null;

  // Zeittracker (timetracker.js): ersetzt die frühere Zeit-Balance. Laufende Timer und im Dashboard erfasste Einträge
  // liegen nur in der Cloud (Feld "timetracker" in sync-data.json), die Historie kommt aus Notion (data.timeTracker.entries).
  const timeTrackerBoard = window.createTimeTracker
    ? window.createTimeTracker({
        dataStore,
        scheduleAutoSync,
        newId,
        notionEntries: data.timeTracker?.entries,
        notionAt: data.meta?.lastSyncedAt,
        refresh: () => fetchRemoteSyncData()
      })
    : null;
  let remoteTimeTrackerRaw = null;

  // Handy-Notiz (inbox.js): Notizen von jedem Geraet in eine Cloud-Inbox; das lokale Skript sync-brainmap.ps1 uebernimmt
  // sie am PC nach Obsidian, danach tauchen sie in data.notes auf und die Liste zeigt ein Haekchen.
  const inboxBoard = window.createInbox
    ? window.createInbox({ dataStore, scheduleAutoSync, newId, areas: data.brainMap?.areas, notes: data.notes, xp: xpBoard })
    : null;
  let remoteInboxRaw = null;

  // Einklappbare Fenster (fold.js): welche Sektionen zugeklappt sind, steht als Liste in der Cloud (Standard: alles offen).
  const foldBoard = window.createFold ? window.createFold({ dataStore, scheduleAutoSync }) : null;
  let remoteFoldRaw = null;

  // Nicht abgehakte Tages-To-Dos VERGANGENER Tage nach "Aufgaben" uebernehmen, bevor der
  // alte Tages-Eintrag verworfen wird. Jeder Tag hat einen eigenen Storage-Key
  // (dashboard-todo-JJJJ-MM-TT) - ein neuer Tag bedeutet bisher einfach einen neuen, leeren
  // Key (TODO_STORAGE_KEY oben), der alte blieb bislang ungenutzt liegen. Jetzt: offene
  // Punkte wandern automatisch rueber, erledigte verfallen wie gehabt, und der alte
  // Tages-Key wird danach geloescht (idempotent - beim naechsten Laden ist nichts mehr da,
  // was nochmal migriert werden koennte).
  function migrateStaleTodosToTasks() {
    const todayK = todayKey();
    let moved = false;
    [...cloudMem.keys()]
      .filter((k) => /^dashboard-todo-\d{4}-\d{2}-\d{2}$/.test(k) && k !== TODO_STORAGE_KEY)
      .forEach((key) => {
        const dateStr = key.slice("dashboard-todo-".length);
        if (dateStr >= todayK) return; // heute oder in der Zukunft (Zeitzonen-Kuriosum): unberuehrt lassen
        const raw = dataStore.getItem(key);
        const state = raw ? parseTodosPayload(raw) : null;
        if (state) {
          TODO_CATEGORIES.forEach((cat) => {
            (state.items[cat.id] || []).forEach((item) => {
              if (!item.done) {
                taskBoard.items.push({ id: newId(), text: item.text, done: false });
                moved = true;
              }
            });
          });
        }
        dataStore.removeItem(key);
      });
    if (moved) {
      taskBoard.save();
      taskBoard.render();
    }
  }
  // Wird erst nach dem Laden der Cloud-Daten ausgefuehrt (siehe loadAllFromCloud) - nur dann
  // sind importierte Alt-Staende und der Cloud-Stand schon zusammengefuehrt.

  // ---------- Habit-Tracker ----------
  const HABIT_STORAGE_KEY = "dashboard-habits-v1";
  const HABIT_COLORS = [
    "var(--accent-bricks)",
    "var(--accent-privat)",
    "var(--accent-laden)",
    "var(--accent-brainwalkers)",
    "var(--accent-bricklink)",
    "var(--accent-goal)"
  ];
  const HABIT_DEFAULTS = [
    { id: "gym", label: "Gym", targetPerWeek: 7 },
    { id: "rauchfrei", label: "Rauchfreier Tag", targetPerWeek: 7 },
    { id: "koffein", label: "<2x Koffein", targetPerWeek: 7 }
  ];
  // Faellt jede Gewohnheit standardmaessig auf "taeglich" (7/7) zurueck - fuer Alt-Eintraege
  // (lokal oder aus der Cloud) ohne targetPerWeek, und schuetzt vor kaputten/leeren Werten.
  const normalizeHabit = (h) => ({
    id: h.id,
    label: h.label,
    targetPerWeek: Number.isInteger(h.targetPerWeek) && h.targetPerWeek >= 1 && h.targetPerWeek <= 7 ? h.targetPerWeek : 7
  });

  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mondayOf = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    if (day !== 1) d.setDate(d.getDate() - (day - 1));
    return d;
  };

  function loadHabitState() {
    try {
      const raw = dataStore.getItem(HABIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Stand existiert schon lokal (ggf. aus der Zeit vor Einfuehrung von
        // "updatedAt") - auf 0 statt -1 defaulten, damit ein reiner Zeitstempel-
        // Gleichstand mit der Cloud NICHT automatisch die Cloud gewinnen laesst
        // und so echte, noch nicht gepushte lokale Aenderungen ueberschreibt.
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        parsed.habits = (parsed.habits || []).map(normalizeHabit);
        return parsed;
      }
    } catch (e) {
      /* corrupted storage, fall back to defaults */
    }
    // Kein lokaler Stand vorhanden (frisches Geraet/Browser): -1 statt 0, damit der
    // erste fetchRemoteHabits()-Aufruf beim Laden IMMER den Cloud-Stand uebernimmt,
    // auch wenn habits-data.json selbst noch kein "updatedAt" hat (dann 0, siehe unten).
    return { habits: HABIT_DEFAULTS.map((h) => ({ ...h })), log: {}, updatedAt: -1 };
  }

  // ---------- Habit-Tracker: Cloud-Sync über GitHub Contents API ----------
  // Kein neuer Dienst nötig: läuft am globalen "Sync"-Button oben rechts mit (derselbe
  // GitHub-Token/Repo wie für den Daten-Sync) und schreibt den Habit-Stand zusätzlich in
  // habits-data.json im Repo. Notion fiel raus: dessen API blockt direkte Browser-Aufrufe
  // (kein CORS), GitHub erlaubt das — genau wie beim Sync-Button oben schon genutzt.
  // Lesen beim Laden geht ohne Token (öffentliche Datei über GitHub Pages), Schreiben
  // braucht den Token mit Berechtigung "Contents: Read and write".
  const HABIT_REMOTE_FILE = "habits-data.json";
  const habitSyncStatusEl = document.getElementById("habitSyncStatus");
  let habitCloudSha = null;

  function setHabitSyncStatus(state, detail) {
    if (!habitSyncStatusEl) return;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const map = {
      idle: "☁️ Änderungen werden automatisch in der Cloud gespeichert",
      synced: `☁️ In der Cloud gespeichert · ${time}`,
      "local-only": "⚠️ Nicht gespeichert — GitHub-Token fehlt",
      error: `⚠️ Cloud-Sync fehlgeschlagen${detail ? " — " + detail : ""}`
    };
    habitSyncStatusEl.textContent = map[state] || map.idle;
  }

  // Frueher wurde hier pro Tag/Gewohnheit additiv gemergt ("erledigt, sobald lokal ODER
  // Cloud erledigt") - das konnte ein Häkchen nie wieder entfernen: sobald ein Zustand
  // einmal in die Cloud gepusht war, kam er bei jedem Laden auf jedem Geraet automatisch
  // zurueck, auch nach bewusstem Entfernen. Jetzt gewinnt schlicht der neuere Zeitstempel
  // (ganzer Zustand, nicht pro Eintrag) - kein Zombie-Haekchen mehr, dafuer im seltenen
  // Fall zeitgleicher Aenderungen auf zwei Geraeten verliert die aeltere. habitHasContent()
  // + remoteWins() (oben) verhindern zusaetzlich, dass ein leerer/frischer Stand einen
  // bereits befuellten grundlos ersetzt.
  const habitHasContent = (state) => (state?.habits?.length || 0) > 0 || Object.keys(state?.log || {}).length > 0;

  // Laedt den Habit-Stand aus der Cloud. Gibt true zurueck, wenn der Cloud-Stand sicher
  // bekannt ist (auch "Datei existiert noch nicht"), false bei einem Ladefehler - dann darf
  // NICHT geschrieben werden (siehe pushHabitsToCloud), sonst wuerde ein leerer Arbeits-
  // speicher die Cloud ueberschreiben.
  let lastRemoteHabitJson = null; // wie bei sync-data.json: unbekannte Felder der Cloud-Datei beim Speichern behalten
  async function fetchRemoteHabits() {
    try {
      const { json: remote, sha } = await readCloudJson(HABIT_REMOTE_FILE);
      if (sha) habitCloudSha = sha;
      if (remote) {
        lastRemoteHabitJson = remote;
        const remoteUpdatedAt = typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
        if (remoteWins(remoteUpdatedAt, habitState.updatedAt, habitHasContent(remote), habitHasContent(habitState))) {
          habitState = { habits: (remote.habits || []).map(normalizeHabit), log: remote.log || {}, updatedAt: remoteUpdatedAt };
          dataStore.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
          renderHabits();
        }
      }
      cloudLoaded.habits = true;
      return true;
    } catch (err) {
      lastPushError.habits = { message: `Laden fehlgeschlagen: ${err.message}` };
      return false;
    }
  }

  // config optional: wird vom Sync-Button-Klick mitgegeben (ein Prompt statt zwei),
  // sonst holt sich die Funktion die Zugangsdaten selbst.
  // Gibt true/false zurueck (nicht nur Statustext), damit scheduleAutoSync() den
  // uebergeordneten Auto-Sync-Indikator in der Topbar ehrlich halten kann - die Funktion
  // faengt ihre Fehler intern ab (siehe setHabitSyncStatus-Aufrufe) und wuerde sonst nie
  // reject()en, wodurch ein await/.catch() aussen den Fehlschlag nie mitbekommen wuerde.
  async function pushHabitsToCloud(config) {
    config = config || getGithubConfig();
    if (!config) {
      setHabitSyncStatus("local-only");
      return false;
    }
    lastPushError.habits = null;
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${HABIT_REMOTE_FILE}`;
    const headers = { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" };
    const rejectToken = (msg) => {
      localStorage.removeItem("dashboard-gh-token");
      lastPushError.habits = { message: msg };
      setHabitSyncStatus("error", msg);
      return false;
    };
    try {
      // Ohne bekannten Cloud-Stand nie schreiben: der Arbeitsspeicher kann noch leer/default
      // sein, ein Push wuerde dann echte Daten in der Cloud ueberschreiben.
      if (!cloudLoaded.habits && !(await fetchRemoteHabits())) {
        setHabitSyncStatus("error", lastPushError.habits?.message);
        return false;
      }
      // Immer frisch abrufen (nicht nur beim allerersten Push cachen) und, falls die Cloud
      // inzwischen einen ECHT neueren UND inhaltlich mindestens gleichwertigen Stand hat
      // (anderes, fast zeitgleich synchronisierendes Geraet), diesen zuerst uebernehmen.
      // Sonst kann ein Push blind einen neueren Cloud-Stand mit einem aelteren lokalen
      // ueberschreiben — beobachtet bei mehreren Sync-Klicks kurz hintereinander.
      const getRes = await fetch(apiUrl, { headers, cache: "no-store" });
      if (getRes.status === 401 || getRes.status === 403) {
        return rejectToken("Token ungültig oder ohne 'Contents'-Berechtigung (entfernt, beim nächsten Mal neu eingeben)");
      }
      if (!getRes.ok && getRes.status !== 404) {
        lastPushError.habits = { message: `Status ${getRes.status} beim Lesen` };
        setHabitSyncStatus("error", lastPushError.habits.message);
        return false;
      }
      if (getRes.ok) {
        const meta = await getRes.json();
        habitCloudSha = meta.sha;
        try {
          const remote = JSON.parse(decodeGithubBase64(meta.content));
          const remoteUpdatedAt = typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
          if (remoteWins(remoteUpdatedAt, habitState.updatedAt, habitHasContent(remote), habitHasContent(habitState))) {
            habitState = { habits: (remote.habits || []).map(normalizeHabit), log: remote.log || {}, updatedAt: remoteUpdatedAt };
            dataStore.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
            renderHabits();
          }
        } catch (e) {
          /* Datei leer/kein valides JSON — mit dem aktuellen Stand weitermachen */
        }
      } else {
        habitCloudSha = null; // Datei existiert noch nicht: wird beim Schreiben neu angelegt
      }
      // -1 ist nur ein interner Marker fuer "noch nie lokal gespeichert" (siehe loadHabitState())
      // und wuerde extern nur verwirren - beim Export auf 0 normalisieren.
      const exportState = { ...(lastRemoteHabitJson || {}), ...habitState, updatedAt: Math.max(0, habitState.updatedAt) };
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportState, null, 2))));
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Habit-Tracker Update", content, ...(habitCloudSha ? { sha: habitCloudSha } : {}) })
      });
      if (putRes.ok) {
        habitCloudSha = (await putRes.json()).content?.sha || habitCloudSha;
        setHabitSyncStatus("synced");
        return true;
      } else if (putRes.status === 401 || putRes.status === 403) {
        return rejectToken("Token ungültig oder ohne 'Contents'-Berechtigung (entfernt, beim nächsten Mal neu eingeben)");
      } else if (putRes.status === 409) {
        habitCloudSha = null; // jemand anders hat parallel geschrieben — sha neu holen beim nächsten Versuch
        lastPushError.habits = { message: "Konflikt, bitte erneut versuchen", conflict: true };
        setHabitSyncStatus("error", lastPushError.habits.message);
        return false;
      } else {
        const msg = putRes.status === 404 ? "Kein Zugriff aufs Repo (404) — Token prüfen: richtiges Repo ausgewählt?" : `Status ${putRes.status}`;
        lastPushError.habits = { message: msg };
        setHabitSyncStatus("error", msg);
        return false;
      }
    } catch (err) {
      lastPushError.habits = { message: err.message };
      setHabitSyncStatus("error", err.message);
      return false;
    }
  }

  const saveHabitState = () => {
    habitState.updatedAt = Date.now();
    dataStore.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
    scheduleAutoSync("habits");
  };

  let habitState = loadHabitState();
  let habitView = "week";
  let habitMonthRef = new Date();
  let habitYearRef = new Date().getFullYear();

  const habitNewInput = document.getElementById("habitNewInput");
  const habitAddBtn = document.getElementById("habitAddBtn");
  const habitViews = {
    week: document.getElementById("habitViewWeek"),
    month: document.getElementById("habitViewMonth"),
    year: document.getElementById("habitViewYear")
  };

  function toggleHabitDay(habitId, key) {
    habitState.log[key] = habitState.log[key] || {};
    const turningOn = !habitState.log[key][habitId];
    habitState.log[key][habitId] = turningOn;
    if (!habitState.log[key][habitId]) delete habitState.log[key][habitId];
    saveHabitState();
    renderHabits();
    if (turningOn && !prefersReducedMotion()) {
      // renderHabits() baut die Zellen komplett neu auf (synchron per innerHTML, also sofort
      // im DOM) - die "done"-Klasse selbst darf den Ripple deshalb NICHT ausloesen (sonst
      // wuerden bei jedem Klick irgendwo ALLE bereits abgehakten Zellen erneut den Ripple
      // abspielen). Stattdessen nur die eine, gerade umgeschaltete Zelle kurz markieren.
      document.querySelectorAll(`.habit-daycell[data-habit="${habitId}"][data-date="${key}"]`).forEach((cell) => {
        cell.classList.add("just-toggled");
        cell.addEventListener("animationend", () => cell.classList.remove("just-toggled"), { once: true });
      });
    }
    // Level-System: Habit = 6 XP (nur fuer heute, pro Habit und Tag einmal), alle Habits des Tages erledigt = 10 Bonus
    if (turningOn && xpBoard && key === todayKey()) {
      const anchor = [...document.querySelectorAll(`.habit-daycell[data-habit="${habitId}"][data-date="${key}"]`)].find((c) => c.offsetParent) || null;
      const items = [[`habit:${habitId}@${key}`, 6]];
      const log = habitState.log[key] || {};
      if (habitState.habits.length && habitState.habits.every((h) => log[h.id])) items.push([`habitbonus@${key}`, 10]);
      // Wochenbonus: erreicht dieses Habit sein Wochenziel (Montag bis Sonntag), gibt es 15 XP, pro Habit und Woche einmal
      const hb = habitState.habits.find((h) => h.id === habitId);
      if (hb) {
        const d0 = new Date(key + "T12:00:00"), mon = new Date(d0.getTime() - ((d0.getDay() + 6) % 7) * 86400000);
        let n = 0;
        for (let i = 0; i < 7; i++) if (habitState.log[dateKey(new Date(mon.getTime() + i * 86400000))]?.[habitId]) n++;
        if (n >= (hb.targetPerWeek || 7)) items.push([`habitweek:${habitId}@${dateKey(mon)}`, 15]);
      }
      xpBoard.awardMany(items, anchor);
    }
  }

  function removeHabit(habitId) {
    habitState.habits = habitState.habits.filter((h) => h.id !== habitId);
    Object.values(habitState.log).forEach((day) => delete day[habitId]);
    saveHabitState();
    renderHabits();
  }

  function addHabit() {
    const label = habitNewInput.value.trim();
    if (!label) return;
    habitState.habits.push({ id: newId(), label, targetPerWeek: 7 });
    saveHabitState();
    habitNewInput.value = "";
    renderHabits();
  }

  function editHabitTarget(habitId) {
    const habit = habitState.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const input = prompt(`Wie oft pro Woche soll "${habit.label}" erfuellt sein, damit die Woche zaehlt? (1-7)`, String(habit.targetPerWeek));
    if (input === null) return;
    const n = parseInt(input.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 7) return;
    habit.targetPerWeek = n;
    saveHabitState();
    renderHabits();
  }
  habitAddBtn.addEventListener("click", addHabit);
  habitNewInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
  });

  document.querySelectorAll("#habitViewToggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      habitView = btn.dataset.view;
      document.querySelectorAll("#habitViewToggle button").forEach((b) => b.classList.toggle("active", b === btn));
      Object.entries(habitViews).forEach(([key, el]) => (el.hidden = key !== habitView));
      renderHabits();
    });
  });

  function daycellHtml({ habitId, key, done, today, extraClass, colorIdx }) {
    const color = HABIT_COLORS[colorIdx % HABIT_COLORS.length];
    const classes = ["habit-daycell", extraClass || "", done ? "done" : "", today ? "today" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" style="--habit-color:${color}" data-habit="${habitId}" data-date="${key}"></button>`;
  }

  function wireDaycellClicks(container) {
    container.querySelectorAll(".habit-daycell[data-habit]").forEach((cell) => {
      cell.addEventListener("click", () => toggleHabitDay(cell.dataset.habit, cell.dataset.date));
    });
  }

  function renderHabitEmptyOr(container, bodyHtml) {
    container.innerHTML = habitState.habits.length ? bodyHtml : `<p class="habit-empty">Noch keine Gewohnheiten — oben hinzufügen.</p>`;
  }

  // Zaehlt aufeinanderfolgende abgehakte Tage rueckwaerts ab heute. Ist "heute" noch nicht
  // abgehakt, faengt die Zaehlung stattdessen bei "gestern" an, statt die Serie sofort auf 0
  // zu setzen - man hat ja bis zum Tagesende noch Zeit, den heutigen Tag nachzuholen.
  function computeStreak(habitId) {
    let streak = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    if (!habitState.log[dateKey(cursor)]?.[habitId]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (habitState.log[dateKey(cursor)]?.[habitId]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // Kleines Arcade-Badge (Flammen-Sprite + Zahl), das erst ab einer Serie von 7+ Tagen
  // ueberhaupt auftaucht - darunter bleibt es beim normalen Wochenzaehler.
  function streakBadgeHtml(habitId) {
    const streak = computeStreak(habitId);
    if (streak < 7) return "";
    return `<span class="streak-badge" title="${streak} Tage in Folge">${pxSpr("flame", 14)}<span class="n">${streak}</span></span>`;
  }

  function renderHabitWeek() {
    const weekStart = mondayOf(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    const todayK = dateKey(new Date());

    const headerCells = days
      .map((d) => `<div class="habit-daycell habit-dayhead">${d.toLocaleDateString("de-DE", { weekday: "short" })}<br>${d.getDate()}.</div>`)
      .join("");

    const rows = habitState.habits
      .map((h, idx) => {
        const cells = days
          .map((d) => {
            const key = dateKey(d);
            const done = !!habitState.log[key]?.[h.id];
            return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
          })
          .join("");
        const doneCount = days.filter((d) => habitState.log[dateKey(d)]?.[h.id]).length;
        const target = h.targetPerWeek;
        const weekDone = doneCount >= target;
        return `<div class="habit-row">
          <div class="habit-label">${escapeHtml(h.label)}${streakBadgeHtml(h.id)}<button type="button" class="habit-count${weekDone ? " done" : ""}" data-target="${h.id}" title="Wochenziel aendern">${weekDone ? "✓ " : ""}${doneCount}/${target}</button></div>
          <div class="habit-days">${cells}</div>
          <button type="button" class="habit-remove" data-remove="${h.id}" aria-label="Entfernen">×</button>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(
      habitViews.week,
      `<div class="habit-row habit-header-row"><div class="habit-label"></div><div class="habit-days">${headerCells}</div><span></span></div>${rows}`
    );

    wireDaycellClicks(habitViews.week);
    habitViews.week.querySelectorAll(".habit-remove").forEach((btn) => {
      btn.addEventListener("click", () => removeHabit(btn.dataset.remove));
    });
    habitViews.week.querySelectorAll(".habit-count[data-target]").forEach((btn) => {
      btn.addEventListener("click", () => editHabitTarget(btn.dataset.target));
    });
  }

  function renderHabitMonth() {
    const year = habitMonthRef.getFullYear();
    const month = habitMonthRef.getMonth();
    const monthLabel = habitMonthRef.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1);
    const leadingBlanks = (firstDay.getDay() || 7) - 1;
    const todayK = dateKey(new Date());

    const nav = `<div class="habit-month-nav">
      <button type="button" id="habitMonthPrev">‹</button>
      <span>${monthLabel}</span>
      <button type="button" id="habitMonthNext">›</button>
    </div>`;

    const rows = habitState.habits
      .map((h, idx) => {
        const blanks = Array.from({ length: leadingBlanks }, () => `<span class="habit-daycell blank"></span>`).join("");
        const cells = Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month, i + 1);
          const key = dateKey(d);
          const done = !!habitState.log[key]?.[h.id];
          return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
        }).join("");
        return `<div class="habit-month-row">
          <div class="habit-month-title">${escapeHtml(h.label)}${streakBadgeHtml(h.id)}</div>
          <div class="habit-month-grid">${blanks}${cells}</div>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(habitViews.month, `${nav}${rows}`);

    const monthEl = habitViews.month;
    monthEl.querySelector("#habitMonthPrev")?.addEventListener("click", () => {
      habitMonthRef.setMonth(habitMonthRef.getMonth() - 1);
      renderHabits();
    });
    monthEl.querySelector("#habitMonthNext")?.addEventListener("click", () => {
      habitMonthRef.setMonth(habitMonthRef.getMonth() + 1);
      renderHabits();
    });
    wireDaycellClicks(monthEl);
  }

  function buildYearWeeks(year) {
    const start = mondayOf(new Date(year, 0, 1));
    const end = new Date(year, 11, 31);
    const weeks = [];
    let cur = new Date(start);
    while (cur <= end) {
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(cur);
        d.setDate(d.getDate() + i);
        return d.getFullYear() === year ? d : null;
      });
      weeks.push(week);
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  }

  function renderHabitYear() {
    const weeks = buildYearWeeks(habitYearRef);
    const todayK = dateKey(new Date());

    const nav = `<div class="habit-year-nav">
      <button type="button" id="habitYearPrev">‹</button>
      <span>${habitYearRef}</span>
      <button type="button" id="habitYearNext">›</button>
    </div>`;

    let lastMonth = -1;
    const monthLabels = weeks
      .map((week) => {
        const firstReal = week.find(Boolean);
        const m = firstReal ? firstReal.getMonth() : lastMonth;
        const label = firstReal && m !== lastMonth ? firstReal.toLocaleDateString("de-DE", { month: "short" }) : "";
        lastMonth = m;
        return `<span>${label}</span>`;
      })
      .join("");

    const rows = habitState.habits
      .map((h, idx) => {
        const cells = weeks
          .map((week) =>
            week
              .map((d) => {
                if (!d) return `<span class="habit-daycell blank"></span>`;
                const key = dateKey(d);
                const done = !!habitState.log[key]?.[h.id];
                return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
              })
              .join("")
          )
          .join("");
        return `<div class="habit-year-row">
          <div class="habit-year-title">${escapeHtml(h.label)}${streakBadgeHtml(h.id)}</div>
          <div class="habit-year-scroll">
            <div class="habit-year-months">${monthLabels}</div>
            <div class="habit-year-grid">${cells}</div>
          </div>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(habitViews.year, `${nav}${rows}`);

    const yearEl = habitViews.year;
    yearEl.querySelector("#habitYearPrev")?.addEventListener("click", () => {
      habitYearRef -= 1;
      renderHabits();
    });
    yearEl.querySelector("#habitYearNext")?.addEventListener("click", () => {
      habitYearRef += 1;
      renderHabits();
    });
    wireDaycellClicks(yearEl);
  }

  function renderHabits() {
    if (habitView === "week") renderHabitWeek();
    else if (habitView === "month") renderHabitMonth();
    else renderHabitYear();
  }

  renderHabits();
  setHabitSyncStatus(localStorage.getItem("dashboard-gh-token") ? "idle" : "local-only");
  // Das Laden aus der Cloud startet gesammelt in loadAllFromCloud() weiter unten.

  // ---------- Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben ----------
  // Gleiches Prinzip wie beim Habit-Tracker weiter oben (GitHub Contents API, Zeitstempel-
  // basiertes "neuerer Stand gewinnt komplett" statt additivem Merge), nur in einer eigenen
  // Datei gebuendelt, da es vier kleine, unabhaengige Felder statt eines einzelnen Zustands
  // sind. Lesen beim Laden geht ohne Token (oeffentliche Datei ueber GitHub Pages), Schreiben
  // laeuft am selben "Sync"-Klick mit wie Habit-Tracker und Business-Daten.
  const SYNC_DATA_REMOTE_FILE = "sync-data.json";
  let syncDataCloudSha = null;
  // Letzter gelesener Cloud-Stand: Bereiche darin, die dieser Code nicht kennt (z.B. von einer neueren Version), werden beim
  // Speichern mitgeschrieben statt geloescht. So kann ein Geraet mit aelterem Code neuere Bereiche nicht mehr wegwischen.
  let lastRemoteSyncJson = null;

  // Gibt true/false zurueck (nicht nur console.warn), damit scheduleAutoSync() den
  // uebergeordneten Auto-Sync-Indikator in der Topbar ehrlich halten kann.
  async function pushSyncDataToCloud(config) {
    config = config || getGithubConfig();
    if (!config) {
      lastPushError.syncdata = { message: "GitHub-Token fehlt" };
      return false;
    }
    lastPushError.syncdata = null;
    // Vor dem Push erst den aktuellen Cloud-Stand ziehen (mit denselben Sicherheitsregeln
    // wie beim Laden, siehe applyRemote* unten): falls ein anderes Geraet zwischenzeitlich
    // einen echt neueren UND inhaltlich nicht-leeren Stand gepusht hat, den zuerst
    // uebernehmen. Sonst kann ein Push blind einen neueren Cloud-Stand ueberschreiben.
    // Gelingt das Lesen nicht, wird NICHT geschrieben (ohne bekannten Cloud-Stand koennte ein
    // noch leerer Arbeitsspeicher echte Daten ueberschreiben). Der gelesene sha stammt aus
    // demselben Abruf wie der Inhalt - so bekommt ein zwischenzeitlicher fremder Schreibzugriff
    // einen echten 409-Konflikt statt still ueberschrieben zu werden.
    if (!(await fetchRemoteSyncData())) return false;
    // -1 ist nur ein interner Marker fuer "noch nie lokal gespeichert" (siehe load*State()-
    // Funktionen) und wuerde extern nur verwirren - beim Export auf 0 normalisieren.
    const clampedAt = (v) => Math.max(0, v);
    const ideas = {};
    Object.keys(ideaWidgets).forEach((key) => {
      const state = loadIdeaState(key);
      ideas[key] = { nextId: state.nextId, items: state.items, updatedAt: clampedAt(state.updatedAt) };
    });
    const studium = loadStudiumDeadline();
    const studiumDeadline = { label: studium.label, date: studium.date, updatedAt: clampedAt(studium.updatedAt) };
    const todosState = loadTodosState();
    const payload = {
      ideas,
      studiumDeadline,
      todos: { date: todayKey(), items: todosState.items, updatedAt: clampedAt(todosState.updatedAt) },
      tasks: taskBoard.payload(),
      remoteTasks: remoteTaskBoard.payload(),
      shopping: shoppingBoard ? shoppingBoard.payload() : remoteShoppingRaw,
      timetracker: timeTrackerBoard ? timeTrackerBoard.payload() : remoteTimeTrackerRaw,
      inbox: inboxBoard ? inboxBoard.payload() : remoteInboxRaw,
      fold: foldBoard ? foldBoard.payload() : remoteFoldRaw,
      xp: xpBoard ? xpBoard.payload() : remoteXpRaw
    };
    if (payload.xp == null) delete payload.xp;
    if (payload.inbox == null) delete payload.inbox;
    if (payload.fold == null) delete payload.fold;
    if (payload.shopping == null) delete payload.shopping;
    if (payload.timetracker == null) delete payload.timetracker;
    if (lastRemoteSyncJson) Object.keys(lastRemoteSyncJson).forEach((k) => { if (!(k in payload)) payload[k] = lastRemoteSyncJson[k]; });
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${SYNC_DATA_REMOTE_FILE}`;
    const headers = { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" };
    const fail = (msg, extra) => {
      lastPushError.syncdata = { message: msg, ...extra };
      console.warn(`Cloud-Sync (Video-Ideen/Studium/To-Do/Aufgaben) fehlgeschlagen: ${msg}`);
      return false;
    };
    try {
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Sync-Daten Update", content, ...(syncDataCloudSha ? { sha: syncDataCloudSha } : {}) })
      });
      if (putRes.ok) {
        syncDataCloudSha = (await putRes.json()).content?.sha || syncDataCloudSha;
        return true;
      }
      if (putRes.status === 401 || putRes.status === 403) {
        localStorage.removeItem("dashboard-gh-token");
        return fail("Token ungültig oder ohne 'Contents'-Berechtigung (entfernt, beim nächsten Mal neu eingeben)");
      }
      if (putRes.status === 409) {
        syncDataCloudSha = null; // jemand anders hat parallel geschrieben — beim naechsten Versuch frisch lesen
        return fail("Konflikt, bitte erneut versuchen", { conflict: true });
      }
      if (putRes.status === 404) return fail("Kein Zugriff aufs Repo (404) — Token prüfen: richtiges Repo ausgewählt?");
      return fail(`Status ${putRes.status}`);
    } catch (err) {
      return fail(err.message);
    }
  }

  function applyRemoteIdeas(remoteIdeas) {
    if (!remoteIdeas) return;
    Object.entries(remoteIdeas).forEach(([key, remoteIdea]) => {
      if (!ideaWidgets[key]) return;
      const local = loadIdeaState(key);
      const remoteUpdatedAt = typeof remoteIdea?.updatedAt === "number" ? remoteIdea.updatedAt : 0;
      // Altformat-Kompatibilitaet: sowohl die Zwischenversion (items[], Position 0 = naechste
      // Idee, kein nextId) als auch die urspruengliche Einzelidee ({text, updatedAt}) koennen
      // in einer noch nicht neu gepushten Cloud-Datei stecken.
      let remoteItems;
      let remoteNextId;
      if (Array.isArray(remoteIdea?.items)) {
        remoteItems = remoteIdea.items;
        remoteNextId = "nextId" in remoteIdea ? remoteIdea.nextId : remoteItems[0]?.id ?? null;
      } else if (typeof remoteIdea?.text === "string" && remoteIdea.text.trim()) {
        const item = { id: newId(), text: remoteIdea.text };
        remoteItems = [item];
        remoteNextId = item.id;
      } else {
        remoteItems = [];
        remoteNextId = null;
      }
      if (remoteWins(remoteUpdatedAt, local.updatedAt, remoteItems.length > 0, local.items.length > 0)) {
        const merged = { nextId: remoteNextId, items: remoteItems, updatedAt: remoteUpdatedAt };
        dataStore.setItem(`dashboard-idea-${key}`, JSON.stringify(merged));
        renderIdeaWidget(key);
      }
    });
  }

  function applyRemoteStudium(remoteStudium) {
    if (!remoteStudium) return;
    const local = loadStudiumDeadline();
    const remoteUpdatedAt = typeof remoteStudium.updatedAt === "number" ? remoteStudium.updatedAt : 0;
    if (remoteWins(remoteUpdatedAt, local.updatedAt, !!remoteStudium.date, !!local.date)) {
      const merged = { label: remoteStudium.label || "", date: remoteStudium.date || "", updatedAt: remoteUpdatedAt };
      dataStore.setItem(STUDIUM_STORAGE_KEY, JSON.stringify(merged));
      refreshStudiumCard();
    }
  }

  const todosHaveContent = (items) => TODO_CATEGORIES.some((c) => (items?.[c.id]?.length || 0) > 0);

  // Der Tages-To-Do-Stand in der Cloud gehoert immer zu EINEM Datum. Ist es ein frueherer Tag,
  // wandern dessen noch offene Punkte (einmalig pro Seitenaufruf, sonst gaebe es Duplikate bei
  // jedem Merge) nach "Aufgaben" - der heutige Tag beginnt leer, und der naechste Push ersetzt
  // den alten Tagesstand in der Cloud. Muss NACH applyRemoteTasks laufen, sonst wuerde der
  // Cloud-Aufgabenstand die gerade uebernommenen Punkte wieder ueberschreiben.
  let staleCloudTodosMigrated = false;
  function applyRemoteTodos(remoteTodos) {
    if (!remoteTodos) return;
    if (remoteTodos.date !== todayKey()) {
      if (remoteTodos.date && remoteTodos.date < todayKey() && !staleCloudTodosMigrated) {
        staleCloudTodosMigrated = true;
        let moved = false;
        TODO_CATEGORIES.forEach((cat) => {
          (remoteTodos.items?.[cat.id] || []).forEach((item) => {
            if (!item.done) {
              taskBoard.items.push({ id: newId(), text: item.text, done: false });
              moved = true;
            }
          });
        });
        if (moved) {
          taskBoard.save();
          taskBoard.render();
        }
      }
      return;
    }
    const localState = loadTodosState();
    const remoteUpdatedAt = typeof remoteTodos.updatedAt === "number" ? remoteTodos.updatedAt : 0;
    if (remoteWins(remoteUpdatedAt, localState.updatedAt, todosHaveContent(remoteTodos.items), todosHaveContent(localState.items))) {
      // Direkt in den Arbeitsspeicher, OHNE saveTodos(): ein aus der Cloud uebernommener Stand
      // behaelt seinen Zeitstempel und soll keinen unnoetigen Rueck-Push ausloesen.
      todos = remoteTodos.items || {};
      dataStore.setItem(TODO_STORAGE_KEY, JSON.stringify({ items: todos, updatedAt: remoteUpdatedAt }));
      renderTodos();
    }
  }

  // Gibt true zurueck, wenn der Cloud-Stand sicher bekannt ist (auch "Datei existiert noch nicht"),
  // false bei einem Ladefehler - dann bleibt cloudLoaded.syncdata false und nichts wird geschrieben.
  async function fetchRemoteSyncData() {
    try {
      const { json: remote, sha } = await readCloudJson(SYNC_DATA_REMOTE_FILE);
      syncDataCloudSha = sha;
      if (remote) {
        lastRemoteSyncJson = remote;
        applyRemoteIdeas(remote.ideas);
        applyRemoteStudium(remote.studiumDeadline);
        taskBoard.applyRemote(remote.tasks);
        remoteTaskBoard.applyRemote(remote.remoteTasks);
        remoteShoppingRaw = remote.shopping ?? null;
        if (shoppingBoard) shoppingBoard.applyRemote(remote.shopping);
        remoteTimeTrackerRaw = remote.timetracker ?? null;
        if (timeTrackerBoard) timeTrackerBoard.applyRemote(remote.timetracker);
        remoteInboxRaw = remote.inbox ?? null;
        if (inboxBoard) inboxBoard.applyRemote(remote.inbox);
        remoteFoldRaw = remote.fold ?? null;
        if (foldBoard) foldBoard.applyRemote(remote.fold);
        remoteXpRaw = remote.xp ?? null;
        if (xpBoard) xpBoard.applyRemote(remote.xp);
        applyRemoteTodos(remote.todos);
      }
      cloudLoaded.syncdata = true;
      return true;
    } catch (err) {
      lastPushError.syncdata = { message: `Laden fehlgeschlagen: ${err.message}` };
      return false;
    }
  }

  // Erstladen beim Start: die Seite bleibt gesperrt (body[data-cloud]), bis BEIDE Dateien sicher
  // geladen sind. Schlaegt das fehl (Netz, GitHub-Limit), bleibt sie gesperrt und es wird alle
  // 10 Sekunden neu versucht - bearbeiten waere sonst auf einem leeren Arbeitsspeicher moeglich
  // und koennte spaeter echte Cloud-Daten ueberschreiben.
  async function loadAllFromCloud() {
    // Beim ersten echten Rendern der Cloud-Daten sollen Listen wieder gestaffelt einfliegen
    // (das Rendern des noch leeren Arbeitsspeichers hat die Einmal-Flags sonst schon verbraucht).
    delete taskList.dataset.staggered;
    delete remoteTaskList.dataset.staggered;
    todoGridStaggeredOnce = false;
    Object.values(ideaWidgets).forEach((w) => delete w.backlogEl.dataset.staggered);

    const [habitsOk, syncOk] = await Promise.all([fetchRemoteHabits(), fetchRemoteSyncData()]);
    if (habitsOk && syncOk) {
      setCloudState("ready");
      if (autoSyncStatusEl && autoSyncStatusEl.textContent.includes("Cloud nicht erreichbar")) autoSyncStatusEl.hidden = true;
      // Alt-Aufgaben vergangener Tage aus uebernommenen lokalen Staenden (siehe importLegacyLocalData)
      migrateStaleTodosToTasks();
      // Hat dieses Geraet noch alte lokale Staende, jetzt hochladen und danach lokal loeschen.
      ["habits", "syncdata"].forEach((kind) => {
        if (legacyKeysByKind[kind].length) scheduleAutoSync(kind);
      });
      return;
    }
    setCloudState("failed");
    setAutoSyncStatus("cloud-failed");
    setTimeout(loadAllFromCloud, 10000);
  }
  loadAllFromCloud();

  // ---------- Google Kalender ----------
  // Google Identity Services (GIS) fuer den OAuth2-Authorization-Code-Flow, Google Calendar
  // API direkt per fetch() mit dem Access-Token. Der Access-Token lebt nur ~1 Std. - fuer
  // eine dauerhafte Verbindung ohne wiederholte Popups wird beim ersten Verbinden zusaetzlich
  // ein langlebiger refresh_token geholt (Authorization-Code-Flow statt des reinen
  // Implicit-Flows). Der Tausch code -> {access_token, refresh_token} bzw. spaeter
  // refresh_token -> neuer access_token laeuft ueber einen kleinen Cloudflare-Worker-Proxy
  // (worker/gcal-proxy.js, URL in data.googleCalendar.workerUrl), da der Google-Client-Secret
  // dafuer noetig ist und niemals im Browser-Code stehen darf. Der refresh_token bleibt daher
  // NUR lokal in diesem Browser (localStorage) - er wird nie ueber den Cloud-Sync geteilt,
  // da das Dashboard-Repo oeffentlich ist und der Token dauerhaften Kalender-Zugriff gewaehrt.
  // Erneuerungen ueber den refresh_token laufen als ganz normaler fetch() im Hintergrund -
  // kein Popup, daher auch nicht vom Browser blockierbar (anders als GIS' eigener "stiller"
  // Modus, der intern trotzdem ein Popup-Fenster oeffnet und von Browsern geblockt wird).
  // Einrichtung siehe README, Abschnitt "Google Kalender".
  // calendar.events allein deckt Termine lesen/schreiben ab, aber NICHT den
  // calendars.get-Aufruf (Kalender-Metadaten inkl. echter Kalender-ID fuers Embed) - dafuer
  // ist ein breiterer Scope noetig. calendar.readonly deckt beides ab (Kalenderliste +
  // Termine lesen), calendar.events bleibt fuers Schreiben (quickAdd) zusaetzlich noetig.
  const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly";
  const GCAL_TOKEN_KEY = "dashboard-gcal-token";
  const GCAL_CLIENT_ID_KEY = "dashboard-gcal-clientid";
  const GCAL_CALENDAR_ID_KEY = "dashboard-gcal-calendarid";
  const GCAL_WORKER_URL_KEY = "dashboard-gcal-workerurl";
  // Bewusst NIE Teil von sync-data.json / GitHub - geraetelokales Geheimnis, siehe Kommentar oben.
  const GCAL_REFRESH_TOKEN_KEY = "dashboard-gcal-refresh-token";

  let gcalCodeClient = null;
  let gcalAccessToken = null;
  let gcalCalendarId = data.googleCalendar?.calendarId || localStorage.getItem(GCAL_CALENDAR_ID_KEY) || null;
  let gcalRefreshTimer = null;

  const calendarConnectState = document.getElementById("calendarConnectState");
  const calendarConnectHint = document.getElementById("calendarConnectHint");
  const calendarConnectedState = document.getElementById("calendarConnectedState");
  const calendarConnectBtn = document.getElementById("calendarConnectBtn");
  const calendarEventList = document.getElementById("calendarEventList");
  const calendarQuickAddInput = document.getElementById("calendarQuickAddInput");
  const calendarQuickAddBtn = document.getElementById("calendarQuickAddBtn");
  const calendarSyncStatusEl = document.getElementById("calendarSyncStatus");
  const calendarDateLabelEl = document.getElementById("calendarDateLabel");
  const calendarOpenFullBtn = document.getElementById("calendarOpenFullBtn");
  const calendarOverlay = document.getElementById("calendarOverlay");
  const calendarEmbedFrame = document.getElementById("calendarEmbedFrame");
  const calendarModalCloseBtn = document.getElementById("calendarModalCloseBtn");

  if (calendarDateLabelEl) {
    calendarDateLabelEl.textContent = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
  }

  function setCalendarStatus(state, detail) {
    if (!calendarSyncStatusEl) return;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const map = {
      loading: "⏳ Lade Termine…",
      ok: `☁️ Aktualisiert · ${time}`,
      error: `⚠️ Fehler${detail ? " — " + detail : ""}`
    };
    calendarSyncStatusEl.textContent = map[state] || "";
  }

  function showCalendarConnected(show) {
    if (calendarConnectState) calendarConnectState.hidden = show;
    if (calendarConnectedState) calendarConnectedState.hidden = !show;
  }

  function loadCachedGcalToken() {
    try {
      const raw = localStorage.getItem(GCAL_TOKEN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // 30s Sicherheitsmarge, damit ein Request nicht mitten in der Ausfuehrung abläuft
      if (typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() + 30000) return parsed;
    } catch (e) {
      /* corrupted storage, fall back to null */
    }
    return null;
  }
  function saveGcalToken(accessToken, expiresInSeconds) {
    const state = { access_token: accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
    localStorage.setItem(GCAL_TOKEN_KEY, JSON.stringify(state));
    return state;
  }

  function getGcalClientId() {
    let clientId = data.googleCalendar?.clientId || localStorage.getItem(GCAL_CLIENT_ID_KEY) || "";
    if (!clientId) {
      const input = prompt(
        "Google OAuth Client-ID für den Kalender (siehe README, Abschnitt \"Google Kalender\" für die Einrichtung):"
      );
      if (!input) return null;
      clientId = input.trim();
      localStorage.setItem(GCAL_CLIENT_ID_KEY, clientId);
    }
    return clientId;
  }

  function getGcalWorkerUrl() {
    let workerUrl = data.googleCalendar?.workerUrl || localStorage.getItem(GCAL_WORKER_URL_KEY) || "";
    if (!workerUrl) {
      const input = prompt(
        "URL des Cloudflare-Worker-Proxys für den Kalender (siehe README, Abschnitt \"Google Kalender\" für die Einrichtung):"
      );
      if (!input) return null;
      workerUrl = input.trim().replace(/\/$/, "");
      localStorage.setItem(GCAL_WORKER_URL_KEY, workerUrl);
    }
    return workerUrl.replace(/\/$/, "");
  }

  // Tauscht den refresh_token (falls vorhanden) im Hintergrund gegen einen frischen
  // access_token - ein ganz normaler fetch() ohne Popup, daher nie vom Browser blockierbar.
  // Wird beim Laden (falls kein gueltiger Access-Token gecacht ist), kurz vor Ablauf des
  // aktuellen Tokens sowie als Fallback nach einem 401 aufgerufen.
  async function refreshGcalAccessToken() {
    const refreshToken = localStorage.getItem(GCAL_REFRESH_TOKEN_KEY);
    const workerUrl = data.googleCalendar?.workerUrl || localStorage.getItem(GCAL_WORKER_URL_KEY);
    if (!refreshToken || !workerUrl) return false;
    try {
      const res = await fetch(`${workerUrl.replace(/\/$/, "")}/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken })
      });
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const payload = await res.json();
      if (!payload.access_token) throw new Error("Keine access_token in Antwort");
      gcalAccessToken = payload.access_token;
      const saved = saveGcalToken(payload.access_token, payload.expires_in);
      showCalendarConnected(true);
      // War hier bisher vergessen: ohne diesen Aufruf blieb die Terminliste nach einer rein
      // automatischen Erneuerung (z.B. beim Laden mit abgelaufenem Access-Token) auf dem alten
      // Stand haengen, obwohl die Verbindung selbst laengst wieder da war.
      await resolveCalendarId();
      await fetchTodayEvents();
      scheduleGcalRefresh(saved.expiresAt);
      return true;
    } catch (e) {
      return false;
    }
  }

  async function gcalFetch(path, options) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
      ...options,
      headers: { ...((options && options.headers) || {}), Authorization: `Bearer ${gcalAccessToken}` }
    });
    if (res.status === 401) {
      // Token abgelaufen/ungueltig — lokal verwerfen, UI faellt zurueck auf "Verbinden",
      // aber sofort per refresh_token einen neuen Access-Token holen (kein Popup) - damit ist
      // im Idealfall schon wieder verbunden, bevor der Nutzer ueberhaupt reagiert.
      localStorage.removeItem(GCAL_TOKEN_KEY);
      gcalAccessToken = null;
      showCalendarConnected(false);
      refreshGcalAccessToken();
    }
    return res;
  }

  async function resolveCalendarId() {
    if (gcalCalendarId) return gcalCalendarId;
    try {
      const res = await gcalFetch("calendars/primary");
      if (res.ok) {
        const cal = await res.json();
        gcalCalendarId = cal.id;
        localStorage.setItem(GCAL_CALENDAR_ID_KEY, gcalCalendarId);
      }
    } catch (e) {
      /* Embed-Link bleibt dann leer, bis data.googleCalendar.calendarId gesetzt wird */
    }
    return gcalCalendarId;
  }

  function renderCalendarEvents(events) {
    if (!calendarEventList) return;
    calendarEventList.innerHTML = events.length
      ? events
          .map((ev) => {
            const title = escapeHtml(ev.summary || "(ohne Titel)");
            const timeLabel = ev.start?.dateTime
              ? new Date(ev.start.dateTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
              : "Ganztägig";
            return `<li class="todo-item">
              <span class="calendar-event-time">${timeLabel}</span>
              <span>${title}</span>
              ${ev.htmlLink ? `<a class="link-button-inline" href="${ev.htmlLink}" target="_blank" rel="noopener">Öffnen</a>` : ""}
            </li>`;
          })
          .join("")
      : `<li class="todo-empty">Keine Termine heute.</li>`;
  }

  async function fetchTodayEvents() {
    if (!gcalAccessToken) return;
    setCalendarStatus("loading");
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "20"
      });
      const res = await gcalFetch(`calendars/${encodeURIComponent(gcalCalendarId || "primary")}/events?${params}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const payload = await res.json();
      renderCalendarEvents(payload.items || []);
      setCalendarStatus("ok");
    } catch (err) {
      setCalendarStatus("error", err.message);
    }
  }

  async function quickAddEvent(text) {
    if (!gcalAccessToken || !text.trim()) return;
    try {
      const res = await gcalFetch(
        `calendars/${encodeURIComponent(gcalCalendarId || "primary")}/events/quickAdd?text=${encodeURIComponent(text.trim())}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      calendarQuickAddInput.value = "";
      await fetchTodayEvents();
    } catch (err) {
      setCalendarStatus("error", err.message);
    }
  }
  calendarQuickAddBtn?.addEventListener("click", () => quickAddEvent(calendarQuickAddInput.value));
  calendarQuickAddInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") quickAddEvent(calendarQuickAddInput.value);
  });

  // ~5 Minuten vor Ablauf des aktuellen Tokens automatisch per refresh_token erneuern
  // (siehe refreshGcalAccessToken), damit ein laenger offen bleibender Tab nie ein 401 durch
  // schlicht abgelaufenes Token erlebt.
  function scheduleGcalRefresh(expiresAt) {
    clearTimeout(gcalRefreshTimer);
    if (typeof expiresAt !== "number") return;
    const delay = Math.max(5000, expiresAt - Date.now() - 5 * 60 * 1000);
    gcalRefreshTimer = setTimeout(refreshGcalAccessToken, delay);
  }

  function ensureGcalCodeClient(clientId) {
    if (gcalCodeClient) return gcalCodeClient;
    if (!window.google?.accounts?.oauth2) return null;
    gcalCodeClient = google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: GCAL_SCOPE,
      ux_mode: "popup",
      access_type: "offline",
      prompt: "consent",
      callback: async (resp) => {
        if (resp.error || !resp.code) {
          setCalendarStatus("error", resp.error || "kein Code erhalten");
          return;
        }
        const workerUrl = getGcalWorkerUrl();
        if (!workerUrl) return;
        try {
          const res = await fetch(`${workerUrl}/exchange`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: resp.code })
          });
          if (!res.ok) throw new Error(`Status ${res.status}`);
          const payload = await res.json();
          if (!payload.access_token) throw new Error("Keine access_token in Antwort");
          gcalAccessToken = payload.access_token;
          const saved = saveGcalToken(payload.access_token, payload.expires_in);
          if (payload.refresh_token) {
            // Google liefert den refresh_token nur bei der allerersten Zustimmung (bzw. bei
            // erzwungenem prompt=consent) - falls doch mal keiner mitkommt, bleibt ein
            // eventuell schon gespeicherter frueherer Token einfach erhalten.
            localStorage.setItem(GCAL_REFRESH_TOKEN_KEY, payload.refresh_token);
          } else if (!localStorage.getItem(GCAL_REFRESH_TOKEN_KEY)) {
            // Kein refresh_token in der Antwort UND auch keiner von frueher gespeichert -
            // die Verbindung faellt nach Ablauf des Access-Tokens (~1 Std.) wieder auf
            // "Kalender verbinden" zurueck. Statt dass das spaeter unbemerkt/unerklaerlich
            // passiert, das gleich sichtbar machen.
            setCalendarStatus("error", "kein dauerhafter Zugriff erhalten, bitte erneut verbinden");
          }
          showCalendarConnected(true);
          await resolveCalendarId();
          await fetchTodayEvents();
          scheduleGcalRefresh(saved.expiresAt);
        } catch (err) {
          setCalendarStatus("error", err.message);
        }
      }
    });
    return gcalCodeClient;
  }

  calendarConnectBtn?.addEventListener("click", () => {
    const clientId = getGcalClientId();
    if (!clientId) return;
    if (!getGcalWorkerUrl()) return;
    const client = ensureGcalCodeClient(clientId);
    if (!client) {
      alert("Google-Anmeldedienst ist noch nicht geladen — bitte kurz warten und nochmal klicken.");
      return;
    }
    client.requestCode();
  });

  calendarOpenFullBtn?.addEventListener("click", async () => {
    const calId = await resolveCalendarId();
    if (!calId) {
      alert('Kalender-ID noch nicht bekannt — erst auf "Kalender verbinden" klicken, oder googleCalendar.calendarId in data.js eintragen.');
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    calendarEmbedFrame.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=${encodeURIComponent(tz)}`;
    calendarOverlay.classList.add("open");
  });
  calendarModalCloseBtn?.addEventListener("click", () => calendarOverlay.classList.remove("open"));
  calendarOverlay?.addEventListener("click", (e) => {
    if (e.target === calendarOverlay) calendarOverlay.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && calendarOverlay?.classList.contains("open")) calendarOverlay.classList.remove("open");
  });

  // Beim Laden: mit gueltigem gecachtem Access-Token direkt einsteigen (und die naechste
  // Erneuerung vorplanen). Ohne gueltigen Access-Token, aber mit einem gespeicherten
  // refresh_token, per plain fetch() (kein Popup, siehe refreshGcalAccessToken) automatisch
  // einen neuen Access-Token holen - das ersetzt den frueheren Klick auf "Kalender
  // verbinden" bei jedem Neuladen komplett.
  (function initGoogleCalendarOnLoad() {
    const cached = loadCachedGcalToken();
    if (cached) {
      gcalAccessToken = cached.access_token;
      showCalendarConnected(true);
      resolveCalendarId().then(fetchTodayEvents);
      scheduleGcalRefresh(cached.expiresAt);
      return;
    }
    if (!data.googleCalendar?.clientId && !localStorage.getItem(GCAL_CLIENT_ID_KEY) && calendarConnectHint) {
      calendarConnectHint.textContent = 'Noch nicht eingerichtet — siehe README, Abschnitt "Google Kalender".';
      return;
    }
    refreshGcalAccessToken();
  })();

  // ---------- PWA: Service Worker registrieren ----------
  // Ermöglicht "Zum Homescreen hinzufügen" auf dem Handy. Schlägt lautlos fehl bei
  // lokalem file://-Öffnen (Service Worker brauchen http/https) — kein Problem, der
  // Rest des Dashboards funktioniert davon unabhängig.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker nicht registriert:", err.message));
  }
  // ---------- Pixel-Look: Symbole, Level-Anzeige, Wischen (Handy) ----------
  // Rein visuell und nur im Arbeitsspeicher: nichts davon wird gespeichert oder synchronisiert.
  (function pixelLook() {
    if (!PX) return;
    const SECTION_SPRITES = { kalender: "calendar", todo: "scroll", aufgaben: "sword", "remote-tasks": "globe", habits: "flame", ziele: "trophy", business: "chest", zeit: "hourglass", einkauf: "cart", notizen: "book" };
    Object.entries(SECTION_SPRITES).forEach(([id, name]) => {
      const marker = document.querySelector(`#${id} .section-head .section-marker`);
      if (marker) marker.outerHTML = `<span class="sec-sprite">${PX.spr(name, 28)}</span>`;
    });
    const syncIcon = document.getElementById("syncButtonIcon");
    if (syncIcon) syncIcon.innerHTML = PX.spr("floppy", 16);

    // Durchschnitt aller Ziele: nur noch fuer die Kennzahl der Ziele-Sektion (der Level kommt aus dem XP-System, siehe xp.js)
    const lvlGoals = (data.goals || []).filter((g) => !g.isMilestone && g.target > 0);
    const goalsAvg = lvlGoals.length ? lvlGoals.reduce((sum, g) => sum + Math.max(0, Math.min(100, (g.current / g.target) * 100)), 0) / lvlGoals.length : null;

    // Ziele: ein neu erreichtes Ziel gibt so viel wie ein ganzer Levelaufstieg (Meilenstein die Haelfte), jedes nur einmal. Beim allerersten
    // Start des Systems (noch kein Stand in der Cloud) gelten schon erreichte Ziele als erledigt und geben nichts. Erst nach dem Laden der Cloud.
    document.addEventListener("cloud-ready", () => {
      if (!xpBoard) return;
      const reached = (data.goals || []).filter((g) => g.target > 0 && g.current >= g.target);
      if (!xpBoard.cloudHad()) {
        xpBoard.markGoalsSeen(reached.map((g) => g.id));
        return;
      }
      reached.forEach((g) => {
        if (xpBoard.hasGoal(g.id)) return;
        if (xpBoard.claimGoal(g.id, !!g.isMilestone)) pixelBurst(document.getElementById("lvlBox"), "ZIEL ERREICHT!");
      });
    });

    // Kennzahl in der Titelzeile jedes Fensters, auch sichtbar wenn es eingeklappt ist (aktualisiert sich selbst)
    const fmtH1 = (h) => String(Math.round(h * 10) / 10).replace(".", ",");
    const openCount = (items) => (Array.isArray(items) ? items.filter((i) => !i.done).length : 0);
    const bizStat = (label) => parseInt(String((data.business?.bricklink?.stats || []).find((st) => st.label === label)?.value ?? "").replace(/\./g, ""), 10) || 0;
    const metricFns = {
      kalender: () => {
        const n = calendarEventList ? calendarEventList.querySelectorAll(".todo-item").length : 0;
        if (n) return `${n} ${n === 1 ? "TERMIN" : "TERMINE"} HEUTE`;
        return calendarEventList && calendarEventList.querySelector(".todo-empty")?.textContent.startsWith("Keine") ? "KEINE TERMINE" : "";
      },
      todo: () => {
        let open = 0, total = 0;
        Object.values(todos || {}).forEach((list) => { if (Array.isArray(list)) { total += list.length; open += openCount(list); } });
        return !total ? "" : open ? `${open} OFFEN` : "ALLES ERLEDIGT";
      },
      aufgaben: () => { const n = openCount(taskBoard.items); return n ? `${n} OFFEN` : "ALLES ERLEDIGT"; },
      "remote-tasks": () => { const n = openCount(remoteTaskBoard.items); return n ? `${n} OFFEN` : "ALLES ERLEDIGT"; },
      habits: () => {
        const hs = habitState.habits || [], log = habitState.log?.[dateKey(new Date())] || {};
        return hs.length ? `${hs.filter((h) => log[h.id]).length} / ${hs.length} HEUTE` : "";
      },
      ziele: () => (goalsAvg === null ? "" : `Ø ${Math.round(goalsAvg)} %`),
      business: () => { const m = bizStat("Drive-Thru-Mail offen"); return m ? `${m} MAILS OFFEN` : ""; },
      zeit: () => { const w = timeTrackerBoard && timeTrackerBoard.weekSummary(); return w ? `WOCHE ${fmtH1(w.ist)} / ${fmtH1(w.soll)} H` : ""; },
      einkauf: () => { const t = (document.getElementById("shopCoinN")?.textContent || "").trim(); return t && !/^0\s?€/.test(t) ? `≈ ${t}` : ""; },
      notizen: () => { const p = inboxBoard ? inboxBoard.pending() : 0; return p ? `${p} VOM HANDY` : (data.notes || []).length ? `${data.notes.length} NOTIZEN` : ""; }
    };
    const metricEls = Object.keys(metricFns).map((id) => {
      const h2 = document.querySelector(`#${id} > .section-head h2`);
      if (!h2) return null;
      const el = document.createElement("span");
      el.className = "sec-metric";
      h2.appendChild(el);
      return { id, el };
    }).filter(Boolean);
    const updateMetrics = () => metricEls.forEach(({ id, el }) => {
      let t = "";
      try { t = metricFns[id](); } catch (e) { /* Quelle noch nicht bereit: Kennzahl bleibt leer */ }
      if (el.textContent !== t) el.textContent = t;
    });
    updateMetrics();
    setInterval(updateMetrics, 1000);

    // Handy-Menue: statt der kleinen wischbaren Zeile oben oeffnet ein Knopf unten rechts (mit dem Daumen erreichbar) ein Raster mit
    // allen Bereichen. Jede Kachel zeigt die Kennzahl, der aktuelle Bereich ist markiert; ein Tipp springt hin (klappt den Bereich
    // bei Bedarf auf) und schliesst das Menue. Rein lokal, ohne gespeicherten Zustand. Die Leiste oben bleibt auf PC und Tablet.
    (function mobileMenu() {
      const navAs = Array.from(document.querySelectorAll("#mainNav a"));
      if (!navAs.length) return;
      const GRID_ICON = '<svg width="22" height="22" viewBox="0 0 6 6" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true"><path d="M0 0h2v2H0zM4 0h2v2H4zM0 4h2v2H0zM4 4h2v2H4zM2 2h2v2H2z"/></svg>';
      const fab = document.createElement("button");
      fab.type = "button";
      fab.className = "mm-fab";
      fab.setAttribute("aria-label", "Menü: zu einem Bereich springen");
      fab.setAttribute("aria-haspopup", "dialog");
      fab.setAttribute("aria-expanded", "false");
      fab.innerHTML = GRID_ICON;
      const ov = document.createElement("div");
      ov.className = "mm-ov";
      ov.hidden = true;
      ov.innerHTML = `<div class="mm-panel" role="dialog" aria-modal="true" aria-labelledby="mmTtl"><header><span id="mmTtl">SPRINGEN ZU</span><button type="button" class="mm-x" aria-label="Menü schließen">×</button></header><div class="mm-grid"></div></div>`;
      document.body.append(fab, ov);
      const grid = ov.querySelector(".mm-grid"), closeBtn = ov.querySelector(".mm-x");

      // Aktueller Bereich = der letzte, dessen Oberkante schon im oberen Drittel des Bildschirms angekommen ist
      const currentId = () => {
        let cur = "";
        navAs.forEach((a) => {
          const sec = document.getElementById(a.getAttribute("href").slice(1));
          if (sec && sec.getBoundingClientRect().top <= window.innerHeight * 0.35) cur = sec.id;
        });
        // ganz unten auf der Seite ist der letzte Bereich gemeint, auch wenn seine Oberkante nie bis nach oben kommt
        if (window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4) cur = (navAs[navAs.length - 1].getAttribute("href") || "").slice(1);
        return cur || (navAs[0].getAttribute("href") || "").slice(1);
      };
      function fill() {
        const cur = currentId();
        grid.innerHTML = navAs.map((a) => {
          const id = a.getAttribute("href").slice(1), sec = document.getElementById(id);
          const metric = sec?.querySelector(".sec-metric")?.textContent || "";
          const color = sec ? getComputedStyle(sec).getPropertyValue("--sc").trim() : "";
          return `<button type="button" class="mm-tile${id === cur ? " on" : ""}" data-id="${escapeHtml(id)}" style="${color ? `--c:${color}` : ""}"${id === cur ? ' aria-current="true"' : ""}>${SECTION_SPRITES[id] && PX ? PX.spr(SECTION_SPRITES[id], 26) : ""}<span>${escapeHtml(a.textContent.trim().toUpperCase())}</span><small>${escapeHtml(metric)}</small></button>`;
        }).join("");
      }
      function openMenu() {
        fill();
        ov.hidden = false;
        document.body.classList.add("mm-open");
        fab.setAttribute("aria-expanded", "true");
        closeBtn.focus();
      }
      function closeMenu(refocus = true) {
        if (ov.hidden) return;
        ov.hidden = true;
        document.body.classList.remove("mm-open");
        fab.setAttribute("aria-expanded", "false");
        if (refocus) fab.focus();
      }
      fab.addEventListener("click", openMenu);
      closeBtn.addEventListener("click", () => closeMenu());
      ov.addEventListener("click", (e) => { if (e.target === ov) closeMenu(); });
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
      window.addEventListener("resize", () => { if (window.innerWidth > 720) closeMenu(false); });
      grid.addEventListener("click", (e) => {
        const tile = e.target.closest(".mm-tile");
        if (!tile) return;
        const id = tile.dataset.id;
        closeMenu(false);
        if (foldBoard) foldBoard.expand(id);
        // erst nach dem Schliessen (Scroll-Sperre weg) und nach dem Aufklappen springen
        setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" }), 60);
      });
    })();

    // Handy: Karten-Reihen (Ziele, Business, Tages-To-Do) sind seitlich wischbar, Punkte zeigen die Position
    const mqMobile = matchMedia("(max-width: 720px)");
    ["goalsGrid", "businessGrid", "todoGrid"].forEach((id) => {
      const grid = document.getElementById(id);
      if (!grid) return;
      const dots = document.createElement("div");
      dots.className = "swipe-dots";
      dots.setAttribute("aria-hidden", "true");
      grid.after(dots);
      const refresh = () => {
        const cards = [...grid.children];
        if (dots.children.length !== cards.length) dots.innerHTML = cards.map(() => "<i></i>").join("");
        if (!mqMobile.matches) return;
        const gr = grid.getBoundingClientRect();
        const center = gr.left + grid.clientWidth / 2;
        let best = 0, bestD = Infinity;
        cards.forEach((c, i) => {
          const r = c.getBoundingClientRect();
          const d = Math.abs(r.left + r.width / 2 - center);
          if (d < bestD) { bestD = d; best = i; }
        });
        [...dots.children].forEach((d, i) => d.classList.toggle("on", i === best));
      };
      grid.addEventListener("scroll", refresh, { passive: true });
      new MutationObserver(refresh).observe(grid, { childList: true });
      window.addEventListener("resize", refresh);
      refresh();
    });

    // Handy: Woche/Monat/Jahr per Wischen wechseln (Habits; der Zeittracker bringt sein eigenes Wischen mit)
    const swipeViews = (panelSel, toggleSel) => {
      const panel = document.querySelector(panelSel);
      const btns = [...document.querySelectorAll(`${toggleSel} button`)];
      if (!panel || !btns.length) return;
      const step = (d) => {
        const i = btns.findIndex((b) => b.classList.contains("active")) + d;
        if (i >= 0 && i < btns.length) btns[i].click();
      };
      PX.attachSwipe(panel, { onLeft: () => step(1), onRight: () => step(-1), ignore: "input, textarea" });
    };
    swipeViews(".habit-panel", "#habitViewToggle");

    // Handy: Aufgaben und Remote Tasks nach rechts wischen = abhaken (wie ein Klick auf das Kaestchen)
    [taskList, remoteTaskList].forEach((list) =>
      PX.attachRowSwipe(list, ".todo-item", (row) => {
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) cb.click();
      })
    );
  })();

})();
