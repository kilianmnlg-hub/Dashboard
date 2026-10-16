/* Schnellsuche und Befehle: Strg+K (Mac: Cmd+K), "/" oder die Lupe in der Kopfzeile. Springt zu Bereichen und Eintraegen, legt Einkauf, Aufgaben,
   To-Dos und Notizen an, startet Timer und Training, wechselt das Design und synchronisiert.
   Gesucht wird im sichtbaren Text des Dashboards (keine eigene Datenhaltung); angelegt wird ueber die vorhandenen Eingaben und Knoepfe, damit
   Cloud-Sync, XP und Pixel-Gaeste sich genau wie bei einer Eingabe von Hand verhalten. Die Suche selbst speichert nichts.
   script.js uebergibt expand(), toast(), die To-Do-Kategorien und die Anlege-Funktionen (deps). */
(function () {
  "use strict";
  const SECTIONS = [
    ["kalender", "Kalender", "calendar"], ["todo", "Tages-To-Do", "scroll"], ["aufgaben", "Aufgaben", "sword"], ["remote-tasks", "Remote Tasks", "globe"],
    ["habits", "Habit-Tracker", "flame"], ["ziele", "Ziele", "trophy"], ["business", "Business-KPIs", "chest"], ["zeit", "Zeittracker", "hourglass"],
    ["einkauf", "Einkaufsliste", "cart"], ["training", "Training", "dumbbell"], ["notizen", "Notizen", "book"]
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  /* klein schreiben und Akzente weg, Zeichen fuer Zeichen (gleiche Laenge wie der Text, damit Treffer genau markiert werden koennen) */
  const fold = (s) => {
    s = String(s);
    let o = "";
    for (let i = 0; i < s.length; i++) {
      const b = s[i].normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
      o += b.length === 1 ? b : s[i].toLowerCase().slice(0, 1);
    }
    return o;
  };
  const words = (q) => fold(q).split(/\s+/).filter(Boolean);
  function hl(text, tokens) {
    const f = fold(text), mask = new Array(text.length).fill(false);
    tokens.forEach((t) => { let p = f.indexOf(t); while (t && p >= 0) { for (let k = p; k < p + t.length; k++) mask[k] = true; p = f.indexOf(t, p + t.length); } });
    let o = "", on = false;
    for (let i = 0; i < text.length; i++) {
      if (mask[i] && !on) { o += "<mark>"; on = true; } else if (!mask[i] && on) { o += "</mark>"; on = false; }
      o += esc(text[i]);
    }
    return on ? o + "</mark>" : o;
  }
  const isTyping = (t) => !!(t && t.closest && t.closest("input, textarea, select, [contenteditable=''], [contenteditable='true']"));
  const MAC = /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent || "");

  window.createPalette = function (deps) {
    deps = deps || {};
    const doc = document, $ = (id) => doc.getElementById(id);
    const spr = (name, size) => { try { const P = window.PixelSprites; return P && P.spr ? P.spr(name, size || 20) : ""; } catch (e) { return ""; } };
    const sections = SECTIONS.filter((s) => $(s[0]));
    const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
    const btn = $("paletteBtn");
    /* solange die Cloud-Daten laden (oder nicht erreichbar sind), ist alles gesperrt, was Daten schreibt (siehe setCloudState in script.js) */
    const locked = () => { const c = doc.body.dataset.cloud; return c === "loading" || c === "failed"; };
    let ov = null, input = null, list = null, live = null, closeBtn = null;
    let isOpen = false, items = [], sel = -1, lastFocus = null, step = null, index = [];

    /* ---------- Befehle (ohne Eingabetext) ---------- */
    const timerBtn = (cat) => $("ttBtn-" + cat);
    const timerRunning = (cat) => { const b = timerBtn(cat); return !!(b && b.closest(".tt-timer.tt-running")); };
    function toggleTimer(cat) {
      const b = timerBtn(cat);
      if (!b) return false;
      if (deps.expand) deps.expand("zeit");
      b.click();
      const s = $("zeit"); if (s) s.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      return true;
    }
    const startBtn = () => doc.querySelector('#trMain [data-a="start"].tr-go');
    const trainingRunning = () => !!(deps.training && deps.training.running && deps.training.running());
    const nextTraining = () => { const b = doc.querySelector("#trMain .tr-nx-t b"); return b ? b.textContent.trim() : ""; };
    const CMDS = [
      { id: "timer-youtube", icon: "hourglass", keys: "timer youtube yt zeit stoppen starten", title: () => (timerRunning("youtube") ? "Timer YouTube stoppen" : "Timer YouTube starten"), sub: () => "Zeittracker", when: () => !locked() && !!timerBtn("youtube"), run: () => toggleTimer("youtube") },
      { id: "timer-bricklink", icon: "hourglass", keys: "timer bricklink bl zeit stoppen starten", title: () => (timerRunning("bricklink") ? "Timer Bricklink stoppen" : "Timer Bricklink starten"), sub: () => "Zeittracker", when: () => !locked() && !!timerBtn("bricklink"), run: () => toggleTimer("bricklink") },
      { id: "training", icon: "dumbbell", keys: "training workout gym start trainieren", title: () => (trainingRunning() ? "Workout fortsetzen" : "Training starten" + (nextTraining() ? ": " + nextTraining() : "")), sub: () => "Training", when: () => trainingRunning() || !!startBtn(),
        run: () => { if (deps.expand) deps.expand("training"); if (trainingRunning()) deps.training.open(); else { const b = startBtn(); if (!b) return false; b.click(); } const s = $("training"); if (s) s.scrollIntoView({ block: "start" }); return true; } },
      { id: "afterupload", icon: "film", keys: "after upload checkliste video youtube nachbereitung kommentar end screen short", title: () => "After-Upload-Checkliste öffnen", sub: () => "Letztes Video", when: () => !locked() && !!deps.openAfterUpload, run: () => deps.openAfterUpload() },
      { id: "note", icon: "book", keys: "notiz note idee handy inbox schreiben", title: () => "Neue Notiz schreiben", sub: () => "Handy-Notiz", when: () => !locked() && !!deps.openNote, run: () => { deps.openNote(); return true; } },
      { id: "theme", icon: "bulb", keys: "design theme hell dunkel dark light modus", title: () => "Design wechseln (hell oder dunkel)", sub: () => "Ansicht", when: () => !!$("themeToggle"), run: () => { $("themeToggle").click(); return true; } },
      { id: "sync", icon: "floppy", keys: "sync synchronisieren speichern cloud abgleichen", title: () => "Jetzt synchronisieren", sub: () => "Cloud", when: () => !!$("syncButton"), run: () => { $("syncButton").click(); return true; } },
      { id: "guests", icon: "star", keys: "gaeste pixel skilltree easter eggs level figuren", title: () => "Pixel-Gäste und Skilltree öffnen", sub: () => "Easter Eggs", when: () => !!(window.Guests && window.Guests.open), run: () => { window.Guests.open(); return true; } }
    ];

    /* ---------- Anlegen (mit Eingabetext) ---------- */
    /* Eingabefelder behalten einen angefangenen Text: er wird nur kurz ersetzt und danach wieder eingesetzt */
    const viaInput = (inputId, btnId, text) => {
      const inp = $(inputId), b = $(btnId);
      if (!inp || !b) return false;
      const prev = inp.value;
      inp.value = text; b.click(); inp.value = prev;
      return true;
    };
    const MAKERS = [
      { id: "shop", icon: "cart", prefix: /^(einkauf|kaufen)$/, title: (t) => "Zum Einkauf hinzufügen: „" + t + "“", sub: "Menge und Preis werden erkannt, z. B. 2x Milch 1,15", ok: "Zum Einkauf hinzugefügt", when: () => !locked() && !!$("shopInp"), run: (t) => viaInput("shopInp", "shopAddBtn", t) },
      { id: "task", icon: "sword", prefix: /^(aufgabe|task)$/, title: (t) => "Aufgabe anlegen: „" + t + "“", sub: "Landet unter Aufgaben", ok: "Aufgabe angelegt", when: () => !locked() && !!$("taskInput"), run: (t) => viaInput("taskInput", "taskAddBtn", t) },
      { id: "todo", icon: "scroll", prefix: /^(todo|to-do|heute)$/, title: (t) => "To-Do für heute anlegen: „" + t + "“", sub: "Die Kategorie wählst du im nächsten Schritt", step: true, when: () => !locked() && !!(deps.addTodo && deps.todoCats && deps.todoCats.length) },
      { id: "note", icon: "book", prefix: /^(notiz|note)$/, title: (t) => "Notiz speichern: „" + t + "“", sub: "Landet in der Handy-Inbox", ok: "Notiz gespeichert", when: () => !locked() && !!deps.addNote, run: (t) => deps.addNote(t) }
    ];

    /* ---------- Inhalte des Dashboards einsammeln ---------- */
    function collect() {
      const out = [];
      const add = (sec, icon, selector, label) => {
        doc.querySelectorAll(selector).forEach((el) => {
          let t = el.matches(".ib-t") ? (el.firstChild ? el.firstChild.textContent : "") : el.textContent || "";
          t = t.replace(/\s+/g, " ").trim();
          if (!t || t.length > 160) return;
          let lb = label;
          if (sec === "todo") { const c = el.closest(".card"), ct = c && c.querySelector(".card-title"); if (ct) lb = "Tages-To-Do · " + ct.textContent.trim(); }
          if (el.closest(".done")) lb += " · erledigt";
          out.push({ sec, icon, text: t, f: fold(t), el, label: lb });
        });
      };
      add("todo", "scroll", "#todoGrid .todo-item > span", "Tages-To-Do");
      add("aufgaben", "sword", "#taskList .todo-item > span", "Aufgabe");
      add("remote-tasks", "globe", "#remoteTaskList .todo-item > span", "Remote Task");
      add("kalender", "calendar", "#kalender .todo-item > span", "Kalender");
      add("einkauf", "cart", "#shopPaneList .shop-row .t", "Einkauf");
      add("einkauf", "cart", "#shopRoot .slot .nm", "Einkauf · Vorrat");
      add("einkauf", "pot", "#shopRoot .dish .name", "Einkauf · Rezept");
      add("habits", "flame", "#habits .habit-name", "Habit");
      add("ziele", "trophy", "#ziele .card-title", "Ziel");
      add("business", "bulb", ".idea-next-text, .idea-row-text", "Video-Idee");
      add("training", "dumbbell", "#trMain .tr-nx-t b, #trMain .tr-dh h3, #trMain .tr-dl .tr-nm", "Training");
      add("notizen", "book", "#notizen .note-text", "Notiz");
      add("notizen", "book", "#notizen .ib-t", "Handy-Notiz");
      return out;
    }

    /* Zum Eintrag springen: Bereich aufklappen, aufgeklappte Listen oeffnen, hinscrollen und kurz hervorheben */
    function go(hit) {
      if (deps.expand) deps.expand(hit.sec);
      const el = hit.el;
      for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) if (p.tagName === "DETAILS" && !p.open) p.open = true;
      const pane = el.closest(".pane[hidden]");
      if (pane) { const t = doc.querySelector('#shopTabs [aria-controls="' + pane.id + '"]'); if (t) t.click(); }
      const target = el.closest(".todo-item, .shop-row, .slot, .dish, .habit-row, .note-row, .ib-row, .idea-row, .idea-next, .tr-day, .tr-next, .card") || el;
      const visible = target.getBoundingClientRect().height > 0;
      if (visible) {
        target.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
        target.classList.remove("pal-hit"); void target.offsetWidth; target.classList.add("pal-hit");
        setTimeout(() => target.classList.remove("pal-hit"), 2600);
      } else {
        const s = $(hit.sec); if (s) s.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
      }
      return true;
    }

    /* ---------- Fenster ---------- */
    function build() {
      if (ov) return;
      ov = doc.createElement("div");
      ov.className = "pal-ov";
      ov.hidden = true;
      ov.innerHTML =
        '<div class="pal" role="dialog" aria-modal="true" aria-label="Suche und Befehle">' +
          '<div class="pal-in">' +
            '<span class="pal-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16 16l5 5"/></svg></span>' +
            '<input class="pal-q" type="text" role="combobox" aria-expanded="true" aria-controls="palList" aria-autocomplete="list" aria-label="Suchen oder Befehl eingeben" placeholder="Suchen oder Befehl eingeben …" autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" maxlength="120">' +
            '<button type="button" class="pal-x" aria-label="Schließen"><span class="pal-k1">ESC</span><span class="pal-k2">ZURÜCK</span></button>' +
          '</div>' +
          '<ul class="pal-list" id="palList" role="listbox" aria-label="Ergebnisse"></ul>' +
          '<div class="pal-ft" aria-hidden="true"><span><kbd>↑ ↓</kbd> Auswählen</span><span><kbd>Enter</kbd> Ausführen</span><span class="pal-hint">' + (MAC ? "CMD K" : "STRG K") + ' ODER /</span></div>' +
          '<div class="pal-live" role="status" aria-live="polite"></div>' +
        '</div>';
      doc.body.appendChild(ov);
      input = ov.querySelector(".pal-q"); list = ov.querySelector(".pal-list"); live = ov.querySelector(".pal-live"); closeBtn = ov.querySelector(".pal-x");
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) { e.preventDefault(); close(); } });
      closeBtn.addEventListener("click", close);
      input.addEventListener("input", () => { step = null; render(); });
      input.addEventListener("keydown", (e) => {
        if (e.isComposing) return;
        if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
        else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
        else if (e.key === "Enter") { e.preventDefault(); run(); }
      });
      list.addEventListener("mousemove", (e) => { const li = e.target.closest("[data-i]"); if (li && +li.dataset.i !== sel) setSel(+li.dataset.i, false); });
      list.addEventListener("click", (e) => { const li = e.target.closest("[data-i]"); if (li) { setSel(+li.dataset.i, false); run(); } });
      ov.addEventListener("keydown", (e) => {   /* Tab bleibt im Fenster */
        if (e.key !== "Tab") return;
        const order = [input, closeBtn], i = order.indexOf(doc.activeElement);
        e.preventDefault();
        order[(i + (e.shiftKey ? order.length - 1 : 1)) % order.length].focus();
      });
    }
    function open(prefill) {
      build();
      if (isOpen) return;
      lastFocus = doc.activeElement;
      isOpen = true; ov.hidden = false; doc.body.classList.add("pal-lock");
      if (btn) btn.setAttribute("aria-expanded", "true");
      input.value = prefill || ""; step = null; index = collect();
      render();
      input.focus();
    }
    function close() {
      if (!isOpen) return;
      isOpen = false; ov.hidden = true; doc.body.classList.remove("pal-lock");
      if (btn) btn.setAttribute("aria-expanded", "false");
      if (lastFocus && lastFocus.focus && doc.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    }
    const done = (msg) => { close(); if (msg && deps.toast) deps.toast(msg, "ok"); };

    /* ---------- Ergebnisse berechnen und zeichnen ---------- */
    function matches(hay, tokens) { return tokens.every((t) => hay.indexOf(t) >= 0); }
    function buildRows(q) {
      const rows = [], push = (it) => { it.i = items.length; items.push(it); rows.push({ it }); }, group = (g) => rows.push({ g });
      const cmdItem = (c) => ({ icon: c.icon, title: esc(c.title()), sub: esc(c.sub()), chip: "", run: () => { const ok = c.run(); if (ok !== false) close(); } });
      const secItem = (s, tokens) => ({ icon: s[2], title: hl(s[1], tokens || []), sub: "Bereich öffnen", chip: "", run: () => { close(); if (deps.expand) deps.expand(s[0]); const el = $(s[0]); if (el) el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" }); } });
      const makerItem = (m, text) => ({ icon: m.icon, title: esc(m.title(text)), sub: esc(m.sub), chip: "ENTER", maker: true,
        run: () => {
          if (m.step) { step = { title: "To-Do für heute: „" + text + "“ · Kategorie wählen", text }; render(); return; }
          if (m.run(text) === false) { if (deps.toast) deps.toast("Das ging gerade nicht", "warn"); return; }
          done(m.ok);
        } });
      if (step) {
        group(step.title);
        (deps.todoCats || []).forEach((c) => push({ icon: "scroll", title: esc(c.label), sub: "Tages-To-Do", chip: "", run: () => { if (deps.addTodo(c.id, step.text) === false) { if (deps.toast) deps.toast("Das ging gerade nicht", "warn"); return; } done("To-Do angelegt: " + c.label); } }));
        return { rows, first: 0 };
      }
      if (locked()) rows.push({ empty: "Die Cloud-Daten laden noch. Anlegen und Timer sind so lange gesperrt." });
      if (!q) {
        group("Befehle");
        CMDS.filter((c) => c.when()).forEach((c) => push(cmdItem(c)));
        group("Springen zu");
        sections.forEach((s) => push(secItem(s)));
        return { rows, first: 0 };
      }
      const pre = q.match(/^(\S+)\s+(\S.*)$/);
      const forced = pre ? MAKERS.find((m) => m.prefix.test(fold(pre[1])) && m.when()) : null;
      const makerText = forced ? pre[2].trim() : q;
      const tokens = words(forced ? pre[2] : q);
      const makers = q.length >= 2 || forced ? MAKERS.filter((m) => m.when()) : [];
      const hits = index.map((it) => { if (!matches(it.f, tokens)) return null; let s = 0; tokens.forEach((t) => { const p = it.f.indexOf(t); s += p === 0 ? 3 : /\s/.test(it.f[p - 1] || "") ? 2 : 1; }); return { it, s }; }).filter(Boolean).sort((a, b) => b.s - a.s).slice(0, 8);
      const cmds = CMDS.filter((c) => c.when() && matches(fold(c.title() + " " + c.keys), tokens)).slice(0, 5);
      const secs = sections.filter((s) => matches(fold(s[1] + " " + s[0]), tokens));
      const secFirst = secs.filter((s) => fold(s[1]).indexOf(tokens[0]) === 0), secRest = secs.filter((s) => secFirst.indexOf(s) < 0);
      let first = -1;
      if (forced) {
        group("Anlegen");
        const fm = makerItem(forced, makerText); push(fm); first = 0;
      }
      if (secFirst.length) { group("Springen zu"); secFirst.forEach((s) => push(secItem(s, tokens))); }
      if (hits.length) {
        group("Treffer");
        hits.forEach((h) => push({ icon: h.it.icon, title: hl(h.it.text, tokens), sub: esc(h.it.label), chip: "", run: () => { close(); go(h.it); } }));
      }
      if (cmds.length) { group("Befehle"); cmds.forEach((c) => push(cmdItem(c))); }
      if (secRest.length) { group("Springen zu"); secRest.forEach((s) => push(secItem(s, tokens))); }
      const real = items.length;
      if (first < 0 && real) first = 0;
      if (!real) rows.push({ empty: "Keine Treffer. Mit ↓ eine Aktion wählen, zum Beispiel zum Einkauf hinzufügen." });
      if (!forced && makers.length) {
        group("Anlegen");
        makers.forEach((m) => push(makerItem(m, makerText)));
      }
      return { rows, first };
    }
    function render() {
      const q = input.value.trim();
      items = [];
      const r = buildRows(q);
      list.innerHTML = r.rows.map((row) => {
        if (row.g) return '<li class="pal-g" role="presentation">' + esc(row.g) + "</li>";
        if (row.empty) return '<li class="pal-empty" role="presentation">' + esc(row.empty) + "</li>";
        const it = row.it;
        return '<li class="pal-o" role="option" id="pal-o-' + it.i + '" data-i="' + it.i + '" aria-selected="false"><span class="pal-oi" aria-hidden="true">' + spr(it.icon, 20) + '</span><span class="pal-ot"><b>' + it.title + "</b><small>" + it.sub + '</small></span><span class="pal-oc" aria-hidden="true">ENTER</span></li>';
      }).join("");
      sel = -1;
      setSel(r.first, true);
      const n = items.length;
      live.textContent = n ? n + (n === 1 ? " Ergebnis" : " Ergebnisse") : "Keine Treffer";
    }
    function setSel(i, scroll) {
      const rows = list.querySelectorAll("[data-i]");
      sel = i >= 0 && i < rows.length ? i : -1;
      rows.forEach((li, k) => li.setAttribute("aria-selected", k === sel ? "true" : "false"));
      if (sel >= 0) { input.setAttribute("aria-activedescendant", "pal-o-" + sel); if (scroll !== false) rows[sel].scrollIntoView({ block: "nearest" }); }
      else input.removeAttribute("aria-activedescendant");
    }
    function move(d) { const n = items.length; if (!n) return; setSel(sel < 0 ? (d > 0 ? 0 : n - 1) : (sel + d + n) % n, true); }
    function run() {
      const it = items[sel];
      if (!it) return;
      try { it.run(); } catch (e) { if (window.console) console.warn("Suche:", e); if (deps.toast) deps.toast("Das ging gerade nicht", "warn"); }
    }

    /* ---------- Tasten und Knopf ---------- */
    doc.addEventListener("keydown", (e) => {
      if (e.isComposing) return;
      if (e.key === "Escape" && isOpen) { e.preventDefault(); e.stopPropagation(); if (step) { step = null; render(); } else close(); return; }
      const k = (e.key || "").toLowerCase();
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && k === "k") { e.preventDefault(); if (isOpen) close(); else open(); return; }
      if (!isOpen && e.key === "/" && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping(e.target)) { e.preventDefault(); open(); }
    }, true);
    if (btn) { btn.addEventListener("click", () => { if (isOpen) close(); else open(); }); btn.setAttribute("aria-haspopup", "dialog"); btn.setAttribute("aria-expanded", "false"); btn.title = "Suche (" + (MAC ? "Cmd" : "Strg") + "+K)"; }

    return { open, close, isOpen: () => isOpen };
  };
})();
