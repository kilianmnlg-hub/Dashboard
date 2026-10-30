/* After-Upload-Checkliste: Sobald der Sync auf einem der Kanaele ein neues Longform-Video erkennt (data.business.<Kanal>.recentUploads mit detectedAt, siehe
   scripts/lib/uploads.mjs), erscheint ganz oben eine Checkliste fuer genau dieses Video: auf YouTube (Titel, Beschreibung, End Screen, angehefteter
   Kommentar, Community-Post), Verbreiten (Short, Instagram, Facebook, TikTok) und Danach (Kommentare, Zahlen nach 24 Stunden, naechste Idee). Jeder Punkt ist
   abhakbar, viele haben einen Link direkt in YouTube Studio. Die Liste (Vorlage) laesst sich anpassen.
   Gespeichert wird wie alles andere in der Cloud (Feld "afterUpload" in sync-data.json): je Video die Haken mit einem Zeitstempel, der neuere gewinnt, dazu
   die Vorlage. Abhaken gibt XP (3 je Punkt, 15 fuer die ganze Liste, jedes nur einmal). Eine erledigte oder geschlossene Liste kommt nicht wieder; ueber die
   Kanal-Karte oder Strg+K laesst sich die Liste des letzten Videos jederzeit oeffnen. Ungeoeffnet verschwindet sie nach 7 Tagen von selbst.
   script.js uebergibt dataStore, Auto-Sync, die Kanaldaten, XP und Hinweise und ruft applyRemote()/payload() auf. */
(function () {
  const DAY = 86400000, HOUR = 3600000;
  const ACTIVE_DAYS = 7, PRUNE_DAYS = 90, MAX_ITEMS = 40, XP_ITEM = 3, XP_ALL = 15;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const clip = (v, n) => String(v == null ? "" : v).slice(0, n);
  const VIDEO_ID = /^[\w-]{5,20}$/;

  // Links direkt zum Video in YouTube Studio bzw. auf die Zuschauerseite
  const LINKS = {
    edit: (id) => "https://studio.youtube.com/video/" + id + "/edit",
    editor: (id) => "https://studio.youtube.com/video/" + id + "/editor",
    watch: (id) => "https://www.youtube.com/watch?v=" + id,
    comments: (id) => "https://studio.youtube.com/video/" + id + "/comments",
    analytics: (id) => "https://studio.youtube.com/video/" + id + "/analytics"
  };
  const KINDS = Object.keys(LINKS).concat(["idea"]);
  // Pixel-Pfeile (wie der Pfeil in fold.js): schraeg nach oben rechts = oeffnet in neuem Tab, nach unten = springt zur Video-Idee
  const ARROW_OUT = '<svg viewBox="0 0 7 7" width="14" height="14" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M2 0h5v1H2zM6 1h1v4H6zM5 1h1v1H5zM4 2h1v1H4zM3 3h1v1H3zM2 4h1v1H2zM1 5h1v1H1z"/></svg>';
  const ARROW_DOWN = '<svg viewBox="0 0 7 7" width="14" height="14" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M3 0h1v6H3zM1 4h1v1H1zM2 5h1v1H2zM5 4h1v1H5zM4 5h1v1H4z"/></svg>';

  // Standardliste. k = Link-Art (siehe LINKS; "idea" springt zur Video-Idee des Kanals), g = Zwischenueberschrift
  const DEFAULT_ITEMS = [
    { id: "title", t: "Titel und Thumbnail prüfen", g: "Auf YouTube", k: "edit" },
    { id: "desc", t: "Beschreibung: Kapitel, Links, Hashtags", g: "Auf YouTube", k: "edit" },
    { id: "playlist", t: "Playlist zuordnen, Untertitel prüfen", g: "Auf YouTube", k: "edit" },
    { id: "endscreen", t: "End Screen und Karten setzen", g: "Auf YouTube", k: "editor" },
    { id: "comment", t: "Kommentar schreiben und anheften", g: "Auf YouTube", k: "watch" },
    { id: "post", t: "Post im Community-Tab veröffentlichen", g: "Auf YouTube" },
    { id: "short", t: "Short schneiden und hochladen", g: "Verbreiten" },
    { id: "insta", t: "Instagram: Reel oder Story, Link in Bio", g: "Verbreiten" },
    { id: "facebook", t: "Facebook: Seite und Gruppen", g: "Verbreiten" },
    { id: "tiktok", t: "TikTok", g: "Verbreiten" },
    { id: "reply", t: "Kommentare beantworten (erste Stunden)", g: "Danach", k: "comments" },
    { id: "stats", t: "Nach 24 Stunden: Klickrate und Zuschauerbindung ansehen", g: "Danach", k: "analytics" },
    { id: "idea", t: "Nächste Video-Idee festlegen", g: "Danach", k: "idea" }
  ];

  const emptyState = () => ({ items: null, tAt: 0, lists: {}, updatedAt: 0 });

  function sanitizeItems(raw) {
    const seen = new Set(), out = [];
    raw.slice(0, MAX_ITEMS).forEach((i) => {
      if (!i || typeof i !== "object") return;
      const id = clip(i.id, 30), t = clip(i.t, 80).trim();
      if (!id || !t || seen.has(id)) return;
      seen.add(id);
      const item = { id, t };
      if (i.g) item.g = clip(i.g, 30);
      if (KINDS.indexOf(i.k) >= 0) item.k = i.k;
      out.push(item);
    });
    return out;
  }

  function sanitize(raw) {
    const out = emptyState();
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    if (isNum(raw.tAt)) out.tAt = raw.tAt;
    if (Array.isArray(raw.items)) out.items = sanitizeItems(raw.items);
    if (raw.lists && typeof raw.lists === "object") {
      Object.keys(raw.lists).forEach((vid) => {
        const l = raw.lists[vid];
        if (!VIDEO_ID.test(vid) || !l || typeof l !== "object") return;
        const list = { d: {}, x: isNum(l.x) ? l.x : 0, c: isNum(l.c) ? l.c : 0, u: isNum(l.u) ? l.u : 0 };
        if (l.d && typeof l.d === "object") Object.keys(l.d).forEach((k) => { if (isNum(l.d[k]) && k.length <= 30) list.d[k] = l.d[k]; });
        out.lists[vid] = list;
      });
    }
    return out;
  }

  window.createAfterUpload = function (deps) {
    const { dataStore, scheduleAutoSync, business, escapeHtml, toast } = deps;
    const section = document.getElementById("afterupload");
    const host = document.getElementById("auHost");
    if (!section || !host) return null;
    const esc = escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const xp = () => (deps.getXp ? deps.getXp() : null);
    const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const KEY = "dashboard-afterupload-v1";
    const q = (v) => (window.CSS && CSS.escape ? CSS.escape(v) : String(v).replace(/["\\]/g, "\\$&"));
    const CHANNELS = ["bricksOnTheFloor", "brainwalkers"];

    let state = emptyState();
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: leer starten */ }

    const forced = new Set();     // von Hand geoeffnet: bleibt in dieser Sitzung sichtbar, auch wenn erledigt oder geschlossen
    const lingering = new Set();  // gerade fertig abgehakt: noch kurz mit "Alles erledigt" zeigen
    const opened = new Set();     // Checkliste aufgeklappt (sonst nur Titel, Balken und ein Knopf zum Aufklappen); gilt nur fuer diese Sitzung
    let editingVid = null;        // Video, an dessen Karte gerade die Vorlage bearbeitet wird
    let ready = false;            // erst nach dem Laden der Cloud zeigen, sonst blitzen Karten ohne Haken auf
    let expandedOnce = false;     // beim ersten Erscheinen in dieser Sitzung aufklappen, falls das Fenster eingeklappt war

    const items = () => state.items || DEFAULT_ITEMS;
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const save = () => { prune(); persist(); scheduleAutoSync("syncdata"); };
    const touch = (list) => { list.u = Date.now(); state.updatedAt = Math.max(state.updatedAt, list.u); };
    function ensureList(vid) { return state.lists[vid] || (state.lists[vid] = { d: {}, x: 0, c: 0, u: 0 }); }
    function prune() {
      const cutoff = Date.now() - PRUNE_DAYS * DAY;
      Object.keys(state.lists).forEach((id) => { if (state.lists[id].u < cutoff) delete state.lists[id]; });
    }

    // Alle bekannten Longform-Videos beider Kanaele, neueste zuerst
    function videos() {
      const out = [];
      CHANNELS.forEach((key) => {
        const biz = business && business[key];
        (biz && Array.isArray(biz.recentUploads) ? biz.recentUploads : []).forEach((v) => {
          if (!v || !VIDEO_ID.test(String(v.id))) return;
          out.push({ id: String(v.id), title: clip(v.title, 120), at: v.at || "", detectedAt: v.detectedAt || null, key, name: biz.title || key, accent: biz.accent || "" });
        });
      });
      return out.sort((a, b) => (b.at > a.at ? 1 : b.at < a.at ? -1 : 0));
    }
    function isActive(v) {
      if (forced.has(v.id) || lingering.has(v.id)) return true;
      if (!v.detectedAt) return false;
      const l = state.lists[v.id];
      if (l && (l.x || l.c)) return false;
      const t = Date.parse(v.detectedAt);
      return isNum(t) && Date.now() - t < ACTIVE_DAYS * DAY;
    }

    function ago(iso) {
      const t = Date.parse(iso);
      if (!isNum(t)) return "";
      const h = Math.floor((Date.now() - t) / HOUR);
      if (h < 1) return "gerade eben";
      if (h < 24) return "vor " + h + " Std.";
      const d = Math.floor(h / 24);
      return d === 1 ? "vor 1 Tag" : "vor " + d + " Tagen";
    }

    function groupsOf(list) {
      const out = [];
      list.forEach((i) => {
        const g = i.g || "", last = out[out.length - 1];
        if (!last || last.g !== g) out.push({ g, items: [i] });
        else last.items.push(i);
      });
      return out;
    }

    function itemHtml(v, i, l) {
      const on = !!(l && l.d[i.id]);
      let go = "";
      if (i.k === "idea") go = '<button type="button" class="au-go" data-act="idea" data-key="' + esc(v.key) + '" aria-label="Zur Video-Idee springen" title="Zur Video-Idee">' + ARROW_DOWN + "</button>";
      else if (i.k && LINKS[i.k]) go = '<a class="au-go" href="' + LINKS[i.k](v.id) + '" target="_blank" rel="noopener" aria-label="' + esc(i.t) + ' (öffnet in neuem Tab)" title="Öffnen">' + ARROW_OUT + "</a>";
      return '<li class="au-item' + (on ? " on" : "") + '"><label class="au-lab"><input type="checkbox" data-vid="' + v.id + '" data-item="' + esc(i.id) + '"' + (on ? " checked" : "") + '><span class="au-txt">' + esc(i.t) + "</span></label>" + go + "</li>";
    }

    function editHtml(v) {
      const its = items();
      return '<ul class="au-edit">' + its.map((i, n) =>
        '<li class="au-erow"><input class="au-in" data-eid="' + esc(i.id) + '" value="' + esc(i.t) + '" maxlength="80" aria-label="Text des Punkts">' +
        '<button type="button" class="au-sq" data-act="up" data-eid="' + esc(i.id) + '" aria-label="Nach oben"' + (n === 0 ? " disabled" : "") + ">▲</button>" +
        '<button type="button" class="au-sq" data-act="down" data-eid="' + esc(i.id) + '" aria-label="Nach unten"' + (n === its.length - 1 ? " disabled" : "") + ">▼</button>" +
        '<button type="button" class="au-sq" data-act="del" data-eid="' + esc(i.id) + '" aria-label="Punkt löschen">×</button></li>'
      ).join("") + '</ul><div class="au-add"><input class="au-in" id="auNew" placeholder="Neuer Punkt …" maxlength="80" aria-label="Neuen Punkt hinzufügen"><button type="button" class="au-btn" data-act="add">+ HINZUFÜGEN</button></div>';
    }

    function cardHtml(v) {
      const l = state.lists[v.id] || { d: {} };
      const its = items();
      const done = its.filter((i) => l.d[i.id]).length;
      const all = its.length > 0 && done === its.length;
      const pct = its.length ? Math.round((done / its.length) * 100) : 0;
      const accent = v.accent ? "var(--accent-" + v.accent + ")" : "var(--accent)";
      const editing = editingVid === v.id;
      const body = editing
        ? editHtml(v)
        : '<div class="au-groups">' + groupsOf(its).map((g) =>
            '<div class="au-group">' + (g.g ? '<p class="au-gh">' + esc(g.g) + "</p>" : "") + '<ul class="au-list">' + g.items.map((i) => itemHtml(v, i, l)).join("") + "</ul></div>"
          ).join("") + "</div>";
      const foot = editing
        ? '<button type="button" class="au-btn" data-act="reset">STANDARD WIEDERHERSTELLEN</button><button type="button" class="au-btn au-main" data-act="edit-done">FERTIG</button>'
        : '<button type="button" class="au-btn" data-act="collapse" data-vid="' + v.id + '">ZUKLAPPEN</button><button type="button" class="au-btn" data-act="edit" data-vid="' + v.id + '">LISTE ANPASSEN</button><button type="button" class="au-btn" data-act="close" data-vid="' + v.id + '">SCHLIESSEN</button>';
      const expanded = opened.has(v.id) || editing;
      const rest = expanded
        ? '<div class="au-tools"><button type="button" class="au-btn" data-act="copy" data-vid="' + v.id + '">LINK KOPIEREN</button><a class="au-btn" href="' + LINKS.edit(v.id) + '" target="_blank" rel="noopener">IM STUDIO ÖFFNEN</a></div>' + body + '<div class="au-foot">' + foot + "</div>"
        : '<button type="button" class="au-btn au-wide" data-act="expand" data-vid="' + v.id + '">' + (all ? "CHECKLISTE ANSEHEN" : "CHECKLISTE ÖFFNEN · " + (its.length - done) + " OFFEN") + "</button>";
      return '<article class="card au-card' + (all ? " all" : "") + '" data-card="' + v.id + '" style="--au-accent:' + accent + '">' +
        '<div class="au-head"><span class="au-chip">' + esc(v.name) + '</span><span class="au-meta">' + (v.at ? esc(ago(v.at)) + " · " : "") + '<b class="au-prog">' + (all ? "ALLES ERLEDIGT ✓" : done + " / " + its.length) + "</b></span></div>" +
        '<a class="au-title" href="' + LINKS.watch(v.id) + '" target="_blank" rel="noopener">' + esc(v.title || "Neues Video") + "</a>" +
        '<div class="au-bar" role="progressbar" aria-valuemin="0" aria-valuemax="' + its.length + '" aria-valuenow="' + done + '" aria-label="Fortschritt"><i style="width:' + pct + '%"></i></div>' +
        rest + "</article>";
    }

    function render() {
      if (!ready) return;
      const act = videos().filter(isActive);
      section.hidden = act.length === 0;
      host.innerHTML = act.map(cardHtml).join("");
      if (act.length && !expandedOnce) { expandedOnce = true; if (deps.expand) deps.expand("afterupload"); }
    }
    // Nur eine Karte neu zeichnen (beim Abhaken), der Fokus bleibt auf dem Kontrollkaesten
    function rerenderCard(vid, focusSel) {
      const el = host.querySelector('[data-card="' + q(vid) + '"]');
      const v = videos().find((x) => x.id === vid);
      if (!el || !v) return render();
      el.outerHTML = cardHtml(v);
      if (focusSel) { const f = host.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
    }
    // Waehrend im Textfeld getippt wird, nicht neu zeichnen (sonst ginge der Cursor verloren)
    function renderSoon() {
      const a = document.activeElement;
      if (host.contains(a) && a.tagName === "INPUT" && a.type !== "checkbox") { host.addEventListener("focusout", () => setTimeout(render, 0), { once: true }); return; }
      render();
    }

    // ---------- Aktionen ----------
    function toggle(vid, itemId, on, anchor) {
      const l = ensureList(vid);
      if (on) l.d[itemId] = Date.now(); else delete l.d[itemId];
      touch(l);
      const board = xp();
      if (on && board) board.award("upload:" + vid + ":" + itemId, XP_ITEM, anchor);
      const its = items();
      if (its.length && its.every((i) => l.d[i.id]) && !l.c) {
        l.c = Date.now();
        if (board) board.award("upload:" + vid + ":all", XP_ALL, anchor);
        if (toast) toast("After Upload erledigt ✓", "ok");
        lingering.add(vid);
        setTimeout(() => { lingering.delete(vid); render(); }, 2600);
      }
      save();
      rerenderCard(vid, 'input[data-vid="' + q(vid) + '"][data-item="' + q(itemId) + '"]');
    }

    function closeCard(vid) {
      const l = ensureList(vid);
      l.x = Date.now();
      touch(l);
      forced.delete(vid);
      lingering.delete(vid);
      if (editingVid === vid) editingVid = null;
      save();
      render();
      if (toast) toast("Checkliste geschlossen. Über die Kanal-Karte oder Strg+K lässt sie sich wieder öffnen.", "ok", 5200);
    }

    async function copyLink(vid) {
      const url = "https://youtu.be/" + vid;
      try {
        await navigator.clipboard.writeText(url);
      } catch (e) {
        const ta = document.createElement("textarea");
        ta.value = url; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch (err) { ok = false; }
        ta.remove();
        if (!ok) { if (toast) toast("Kopieren nicht möglich. Link: " + url, "warn", 9000); return; }
      }
      if (toast) toast("Video-Link kopiert: " + url, "ok", 3200);
    }

    function jumpToIdea(key) {
      const input = document.getElementById("idea-input-" + key), next = document.getElementById("idea-next-" + key);
      const target = (next && next.closest(".card")) || input;
      if (!target) return;
      target.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
      if (input) setTimeout(() => input.focus({ preventScroll: true }), reduced() ? 0 : 450);
    }

    // Vorlage bearbeiten: gilt fuer alle Videos, bereits gesetzte Haken bleiben (sie haengen an der Punkt-ID)
    function ensureTemplate() { return state.items || (state.items = DEFAULT_ITEMS.map((i) => Object.assign({}, i))); }
    function templateChanged() { state.tAt = Date.now(); state.updatedAt = Math.max(state.updatedAt, state.tAt); save(); }
    function moveItem(id, dir) {
      const list = ensureTemplate(), n = list.findIndex((i) => i.id === id), m = n + dir;
      if (n < 0 || m < 0 || m >= list.length) return;
      const tmp = list[n]; list[n] = list[m]; list[m] = tmp;
      templateChanged(); render();
      const f = host.querySelector('[data-act="' + (dir < 0 ? "up" : "down") + '"][data-eid="' + q(id) + '"]');
      if (f && !f.disabled) f.focus({ preventScroll: true });
    }
    function removeItem(id) {
      const list = ensureTemplate(), n = list.findIndex((i) => i.id === id);
      if (n < 0) return;
      list.splice(n, 1);
      templateChanged(); render();
    }
    function renameItem(id, text) {
      const t = clip(text, 80).trim(), it = ensureTemplate().find((i) => i.id === id);
      if (!it) return;
      if (!t) { render(); return; }
      if (t !== it.t) { it.t = t; templateChanged(); }
    }
    function addItem() {
      const input = document.getElementById("auNew");
      const t = input ? clip(input.value, 80).trim() : "";
      if (!t) { if (input) input.focus(); return; }
      const list = ensureTemplate();
      if (list.length >= MAX_ITEMS) { if (toast) toast("Mehr als " + MAX_ITEMS + " Punkte sind zu viel.", "warn"); return; }
      const last = list[list.length - 1];
      list.push(Object.assign({ id: "u" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), t }, last && last.g ? { g: last.g } : {}));
      templateChanged(); render();
      const f = document.getElementById("auNew");
      if (f) f.focus({ preventScroll: true });
    }

    // ---------- Ereignisse ----------
    host.addEventListener("change", (e) => {
      const cb = e.target.closest('input[type="checkbox"][data-item]');
      if (cb) { toggle(cb.dataset.vid, cb.dataset.item, cb.checked, cb); return; }
      const inp = e.target.closest("input[data-eid]");
      if (inp) renameItem(inp.dataset.eid, inp.value);
    });
    host.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.id === "auNew") { e.preventDefault(); addItem(); }
    });
    host.addEventListener("click", (e) => {
      const b = e.target.closest("[data-act]");
      if (!b) return;
      const act = b.dataset.act, vid = b.dataset.vid;
      if (act === "copy") copyLink(vid);
      else if (act === "expand") { opened.add(vid); rerenderCard(vid); }
      else if (act === "collapse") { opened.delete(vid); rerenderCard(vid); }
      else if (act === "close") closeCard(vid);
      else if (act === "idea") jumpToIdea(b.dataset.key);
      else if (act === "edit") { editingVid = vid; render(); const f = host.querySelector(".au-in"); if (f) f.focus({ preventScroll: true }); }
      else if (act === "edit-done") { editingVid = null; render(); }
      else if (act === "reset") { state.items = null; templateChanged(); render(); if (toast) toast("Standardliste wiederhergestellt.", "ok", 3200); }
      else if (act === "up") moveItem(b.dataset.eid, -1);
      else if (act === "down") moveItem(b.dataset.eid, 1);
      else if (act === "del") removeItem(b.dataset.eid);
      else if (act === "add") addItem();
    });

    // Erst nach dem Laden der Cloud zeigen (kommt von script.js ueber start())
    return {
      start() { ready = true; render(); },
      render,
      // Liste des letzten Videos (eines Kanals oder insgesamt) von Hand oeffnen; true = es gibt eines
      open(key) {
        const v = videos().find((x) => !key || x.key === key);
        if (!v) { if (toast) toast("Noch kein Video bekannt. Einmal Sync drücken, dann steht es hier.", "warn", 6000); return false; }
        forced.add(v.id);
        opened.add(v.id);
        expandedOnce = true;
        const l = state.lists[v.id];
        if (l && l.x) { l.x = 0; touch(l); save(); }
        ready = true;
        if (deps.expand) deps.expand("afterupload");
        render();
        section.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" });
        return true;
      },
      // Aktive Listen (fuer Anzeige und Tests)
      active() { return videos().filter(isActive).map((v) => v.id); },
      // Kennzahl fuer die Titelzeile des Fensters (auch sichtbar, wenn es eingeklappt ist)
      metric() {
        const act = videos().filter(isActive);
        if (!act.length) return "";
        if (act.length > 1) return act.length + " LISTEN OFFEN";
        const l = state.lists[act[0].id], its = items();
        return its.filter((i) => l && l.d[i.id]).length + " / " + its.length + " ERLEDIGT";
      },
      // Haken je Video per Zeitstempel vereinigen (neuerer gewinnt), die Vorlage nach ihrem eigenen Zeitstempel
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote);
        let changed = false;
        if (r.tAt > state.tAt) { state.items = r.items; state.tAt = r.tAt; changed = true; }
        Object.keys(r.lists).forEach((id) => {
          const mine = state.lists[id];
          if (!mine || r.lists[id].u > mine.u) { state.lists[id] = r.lists[id]; changed = true; }
        });
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        const localOnly = state.tAt > r.tAt || Object.keys(state.lists).some((id) => !r.lists[id] || state.lists[id].u > r.lists[id].u);
        prune();
        persist();
        if (changed) renderSoon();
        if (localOnly) scheduleAutoSync("syncdata");
      },
      // Solange es nichts zu speichern gibt, bleibt das Feld ganz weg
      payload() {
        const has = state.items !== null || state.tAt > 0 || Object.keys(state.lists).length > 0;
        if (!has) return null;
        const out = { lists: state.lists, tAt: Math.max(0, state.tAt), updatedAt: Math.max(0, state.updatedAt) };
        if (state.items !== null) out.items = state.items;
        return out;
      }
    };
  };
})();
