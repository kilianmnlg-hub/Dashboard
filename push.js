/* Benachrichtigungen (Web-Push) und Status: ein kleines Menue am Sync-Knopf (Pfeil daneben).
   Gegenstelle ist der Cloudflare-Worker worker/push-worker.js (Einrichtung steht in dessen Kopfzeile und in der README). Hier liegen nur Adresse und
   "Geheimes Wort" im Browser (localStorage "dashboard-push-settings", wie beim Outfit-Bereich); die Einstellungen (welche Meldungen, Zeiten, Ruhezeit)
   liegen im Worker. Die Meldungen selbst zeigt der Service Worker (sw.js, Ereignis "push").
   script.js uebergibt toast(), escapeHtml(), expand(id) und syncNow() (deps). */
(function () {
  "use strict";
  const KEY = "dashboard-push-settings";
  const DAY = 86400000;
  const b64u = (buf) => { let s = ""; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
  const unb64u = (s) => { s = String(s).replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; const bin = atob(s), out = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i); return out; };
  const ago = (ms) => {
    const d = Date.now() - ms;
    if (d < 90 * 1000) return "gerade eben";
    if (d < 3600000) return "vor " + Math.round(d / 60000) + " Min.";
    if (d < DAY) return "vor " + Math.round(d / 3600000) + " Std.";
    const n = Math.round(d / DAY);
    return "vor " + n + (n === 1 ? " Tag" : " Tagen");
  };

  /* Die Anlaesse, in der Reihenfolge der Liste. sel = Auswahl, time = Uhrzeit, jeweils Feld in den Einstellungen des Workers */
  const EVENTS = [
    { id: "newOrder", t: "Neue Bricklink-Bestellung", s: "sofort, mit Betrag" },
    { id: "unshipped", t: "Bestellung unversendet nach", s: "einmal pro Tag erinnern", sel: { k: "hours", opts: [12, 24, 36, 48], fmt: (v) => v + " Std." } },
    { id: "message", t: "Neue Käufer-Nachricht", s: "gebündelt, höchstens alle 30 Min." },
    { id: "rhythm", t: "Upload-Rhythmus überfällig", s: "einmal pro Tag um", time: true },
    { id: "afterUpload", t: "After-Upload-Checkliste offen", s: "nach dem neuen Video", sel: { k: "delayMin", opts: [30, 60, 120, 240], fmt: (v) => (v >= 60 ? v / 60 + " Std." : v + " Min.") } },
    { id: "habits", t: "Habits abends offen", s: "nur bei Wochenziel in Gefahr, um", time: true },
    { id: "training", t: "Trainingstag", s: "wenn heute Training geplant ist, um", time: true },
    { id: "timer", t: "Timer läuft länger als", s: "(vergessen?)", sel: { k: "hours", opts: [2, 3, 4, 5], fmt: (v) => v + " Std." } },
    { id: "summary", t: "Morgen-Zusammenfassung", s: "eine Meldung statt vieler, um", time: true }
  ];

  window.createPush = function (deps) {
    deps = deps || {};
    const toast = deps.toast || (() => {});
    const esc = deps.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    let cfg = { base: "", secret: "" };
    try { const v = JSON.parse(localStorage.getItem(KEY) || "{}"); cfg = { base: String(v.base || "").replace(/\/+$/, ""), secret: String(v.secret || "") }; } catch (e) { /* ohne Eintrag */ }
    const saveCfg = () => { try { localStorage.setItem(KEY, JSON.stringify(cfg)); } catch (e) { /* ohne Speicher */ } };
    const configured = () => !!(cfg.base && cfg.secret);
    let ov = null, menu = null, settings = null, saveTimer = 0, saveNote = "", sampling = false;

    /* ---------- Worker ---------- */
    async function api(path, method, body) {
      const res = await fetch(cfg.base + path, { method: method || "GET", headers: Object.assign({ Authorization: "Bearer " + cfg.secret }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined });
      let j = null;
      try { j = await res.json(); } catch (e) { /* kein JSON */ }
      if (!res.ok) throw new Error((j && j.error) || "Fehler " + res.status);
      return j;
    }
    const ready = (ms) => Promise.race([navigator.serviceWorker.ready, new Promise((_, rej) => setTimeout(() => rej(new Error("Der Service Worker ist nicht bereit (nur in der installierten App oder unter https).")), ms || 6000))]);
    async function currentSub() { try { return await (await ready(2500)).pushManager.getSubscription(); } catch (e) { return null; } }
    const deviceLabel = () => (/Android/i.test(navigator.userAgent) ? "Android" : /iPhone|iPad/i.test(navigator.userAgent) ? "iOS" : "Computer");

    /* Auf diesem Geraet anmelden: Erlaubnis holen, beim Push-Dienst anmelden, dem Worker melden */
    async function enable() {
      if (!supported) throw new Error("Dieser Browser kann keine Push-Meldungen.");
      const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Erlaubnis fehlt: in den Browser-Einstellungen Benachrichtigungen für diese Seite erlauben.");
      const key = (await (await fetch(cfg.base + "/vapid")).json()).publicKey;
      const reg = await ready();
      let sub = await reg.pushManager.getSubscription();
      if (sub && sub.options && sub.options.applicationServerKey && b64u(sub.options.applicationServerKey) !== key) { await sub.unsubscribe(); sub = null; }
      if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: unb64u(key) });
      await api("/subscribe", "POST", { subscription: sub.toJSON(), label: deviceLabel() });
      return sub;
    }
    async function disable() {
      const sub = await currentSub();
      if (!sub) return;
      try { await api("/unsubscribe", "POST", { endpoint: sub.endpoint }); } catch (e) { /* Worker nicht erreichbar: lokal trotzdem abmelden */ }
      await sub.unsubscribe();
    }

    /* ---------- Fenster ---------- */
    function closeSheet() { if (ov) { ov.remove(); ov = null; } document.removeEventListener("keydown", onKey, true); }
    function onKey(e) { if (e.key === "Escape") { e.stopPropagation(); closeSheet(); } }
    function sheet(title, html) {
      closeSheet();
      ov = document.createElement("div");
      ov.className = "pn-ov open";
      ov.innerHTML = '<div class="pn-sheet" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="pn-head"><h2>' + esc(title) + '</h2><button type="button" class="pn-x" data-x aria-label="Schließen">×</button></div><div class="pn-body">' + html + "</div></div>";
      document.body.appendChild(ov);
      ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-x]")) closeSheet(); });
      document.addEventListener("keydown", onKey, true);
      return ov.querySelector(".pn-body");
    }

    /* ---------- Benachrichtigungen ---------- */
    async function openNotify() {
      const body = sheet("Benachrichtigungen", '<p class="pn-note">Lade …</p>');
      let err = "", ping = null;
      if (configured()) {
        try { ping = await api("/ping"); settings = (await api("/settings")).settings; } catch (e) { err = e.message || "Nicht erreichbar"; }
      }
      if (!ov) return;
      const st = { sub: undefined, err, ping };   /* undefined = Anmeldung dieses Geraets noch nicht geprueft */
      drawNotify(body, st);
      if (configured() && !err) {
        st.sub = await currentSub();
        if (st.sub) { try { await api("/subscribe", "POST", { subscription: st.sub.toJSON(), label: deviceLabel() }); } catch (e) { /* egal */ } }
        if (ov) drawNotify(body, st);
      }
    }
    function drawNotify(body, st) {
      const conf = configured(), ok = conf && !st.err;
      let h = "";
      if (!conf || st.err || body.dataset.edit) {
        h += '<div class="pn-box">' +
          '<label class="pn-f"><span>ADRESSE DES WORKERS</span><input type="url" id="pnBase" placeholder="https://dashboard-push.NAME.workers.dev" value="' + esc(cfg.base) + '" autocomplete="off"></label>' +
          '<label class="pn-f"><span>GEHEIMES WORT</span><input type="password" id="pnSecret" placeholder="dasselbe wie im Worker (APP_SECRET)" value="' + esc(cfg.secret) + '" autocomplete="off"></label>' +
          (st.err ? '<p class="pn-bad">' + esc(st.err) + "</p>" : "") +
          '<button type="button" class="pn-btn go" data-a="connect">SPEICHERN UND PRÜFEN</button>' +
          '<details class="pn-how"><summary>Einrichtung in 6 Schritten</summary><ol><li>Cloudflare: KV-Speicher „dashboard-push“ anlegen.</li><li>Worker „dashboard-push“ anlegen und den Code aus <code>worker/push-worker.js</code> einfügen.</li><li>Im Worker den KV-Speicher unter dem Namen <code>KV</code> verbinden.</li><li>Secrets setzen: APP_SECRET (ein langes Wort) und die vier BRICKLINK-Werte.</li><li>Zeitplan (Cron) alle 10 Minuten eintragen.</li><li>Hier Adresse und Wort eintragen, dann „Auf diesem Handy aktivieren“.</li></ol></details>' +
          "</div>";
        if (!ok) { body.innerHTML = h; bindNotify(body, st); return; }
        delete body.dataset.edit;
      }
      const bl = st.ping && st.ping.bricklink;
      h += '<div class="pn-status"><i class="pn-led ' + (ok ? "ok" : "bad") + '"></i><span>' + (ok ? "VERBUNDEN" + (bl ? "" : " · BRICKLINK-ZUGANG FEHLT") : "NICHT VERBUNDEN") + '</span><button type="button" class="pn-link" data-a="edit">ÄNDERN</button></div>';
      /* dieses Geraet */
      const perm = supported ? Notification.permission : "unsupported";
      let devTxt, devBtn = "";
      if (!supported) devTxt = "Dieser Browser kann keine Push-Meldungen.";
      else if (perm === "denied") devTxt = "Blockiert: in den Browser-Einstellungen für diese Seite erlauben.";
      else if (st.sub === undefined) devTxt = "Prüfe dieses Gerät …";
      else if (st.sub) { devTxt = "AKTIV AUF DIESEM GERÄT"; devBtn = '<button type="button" class="pn-btn" data-a="off">AUSSCHALTEN</button>'; }
      else { devTxt = "Auf diesem Gerät noch nicht angemeldet."; devBtn = '<button type="button" class="pn-btn go" data-a="on">AUF DIESEM HANDY AKTIVIEREN</button>'; }
      h += '<div class="pn-dev"><span class="pn-dt">' + esc(devTxt) + "</span>" + devBtn + "</div>";
      /* Anlaesse */
      const s = settings;
      h += '<div class="pn-list">';
      EVENTS.forEach((e) => {
        const v = s.events[e.id] || {};
        let ctl = "";
        if (e.sel) ctl = ' <select class="pn-in" data-ev="' + e.id + '" data-k="' + e.sel.k + '">' + e.sel.opts.map((o) => '<option value="' + o + '"' + (+v[e.sel.k] === o ? " selected" : "") + ">" + e.sel.fmt(o) + "</option>").join("") + "</select>";
        if (e.time) ctl = ' <input class="pn-in" type="time" data-ev="' + e.id + '" data-k="time" value="' + esc(v.time || "") + '">';
        h += '<div class="pn-row"><div class="pn-rt"><b>' + esc(e.t) + "</b><small>" + esc(e.s) + ctl + '</small></div><button type="button" class="pn-tg' + (v.on ? " on" : "") + '" role="switch" aria-checked="' + !!v.on + '" aria-label="' + esc(e.t) + '" data-ev="' + e.id + '"></button></div>';
      });
      h += "</div>";
      const q = s.quiet || {};
      h += '<div class="pn-quiet"><div class="pn-rt"><b>Ruhezeit</b><small>keine Meldungen, danach eine Sammelmeldung <input class="pn-in" type="time" data-q="from" value="' + esc(q.from || "") + '"> bis <input class="pn-in" type="time" data-q="to" value="' + esc(q.to || "") + '"></small></div><button type="button" class="pn-tg' + (q.on ? " on" : "") + '" role="switch" aria-checked="' + !!q.on + '" aria-label="Ruhezeit" data-q="on"></button></div>';
      h += '<div class="pn-foot"><button type="button" class="pn-btn go" data-a="test">TESTMELDUNG SENDEN</button><button type="button" class="pn-btn" data-a="samples">ALLE BEISPIELE SENDEN</button><span class="pn-saved" id="pnSaved">' + esc(saveNote) + "</span></div>";
      body.innerHTML = h;
      bindNotify(body, st);
    }
    function bindNotify(body, st) {
      body.onclick = async (e) => {
        const t = e.target.closest("button");
        if (!t) return;
        if (t.dataset.a === "edit") { body.dataset.edit = "1"; drawNotify(body, st); return; }
        if (t.dataset.a === "connect") {
          cfg = { base: body.querySelector("#pnBase").value.trim().replace(/\/+$/, ""), secret: body.querySelector("#pnSecret").value.trim() };
          saveCfg();
          openNotify();
          return;
        }
        if (t.dataset.a === "on") {
          t.disabled = true;
          try { await enable(); toast("Meldungen sind auf diesem Gerät aktiv.", "ok"); } catch (er) { toast(er.message || "Anmelden fehlgeschlagen", "warn", 8000); }
          st.sub = await currentSub();
          if (ov) drawNotify(body, st);
          return;
        }
        if (t.dataset.a === "off") { t.disabled = true; try { await disable(); toast("Auf diesem Gerät ausgeschaltet.", "ok"); } catch (er) { toast(er.message || "Ausschalten fehlgeschlagen", "warn"); } st.sub = await currentSub(); if (ov) drawNotify(body, st); return; }
        if (t.dataset.a === "test") {
          t.disabled = true;
          try { const r = await api("/test", "POST", {}); toast(r.ok ? "Testmeldung gesendet." : (r.error || "Konnte nicht gesendet werden (Status " + (r.status || []).join(", ") + ")."), r.ok ? "ok" : "warn", 7000); } catch (er) { toast(er.message || "Fehler", "warn"); }
          t.disabled = false;
          return;
        }
        if (t.dataset.a === "samples") {
          if (sampling) return;
          sampling = true;
          const label = (txt, off) => { const b = body.querySelector('[data-a="samples"]'); if (b) { b.textContent = txt; b.disabled = off; } };
          let n = 0, count = 1;
          try {
            for (let i = 0; i < count && ov; i++) {
              label("SENDE " + (i + 1) + "/" + (i ? count : "…"), true);
              const r = await api("/test", "POST", { kind: "sample", index: i });
              if (!r.ok) { toast(r.error || "Konnte nicht gesendet werden (Status " + (r.status || []).join(", ") + ").", "warn", 7000); break; }
              count = r.count || count; n++;
              if (i + 1 < count) await new Promise((done) => setTimeout(done, 700));
            }
            if (n && n === count) toast(n + " Beispielmeldungen gesendet. Schau auf dein Handy.", "ok", 7000);
          } catch (er) { toast(er.message || "Fehler", "warn", 7000); }
          sampling = false;
          label("ALLE BEISPIELE SENDEN", false);
          return;
        }
        if (t.classList.contains("pn-tg")) {
          const on = !t.classList.contains("on");
          t.classList.toggle("on", on); t.setAttribute("aria-checked", String(on));
          if (t.dataset.q) settings.quiet[t.dataset.q] = on; else settings.events[t.dataset.ev].on = on;
          queueSave();
        }
      };
      body.onchange = (e) => {
        const el = e.target.closest(".pn-in");
        if (!el) return;
        if (el.dataset.q) settings.quiet[el.dataset.q] = el.value;
        else settings.events[el.dataset.ev][el.dataset.k] = el.type === "time" ? el.value : +el.value;
        queueSave();
      };
    }
    function queueSave() {
      clearTimeout(saveTimer);
      saveNote = "…";
      const el = ov && ov.querySelector("#pnSaved"); if (el) el.textContent = saveNote;
      saveTimer = setTimeout(async () => {
        try { settings = (await api("/settings", "POST", settings)).settings; saveNote = "GESPEICHERT"; } catch (er) { saveNote = "FEHLER: " + (er.message || "nicht gespeichert"); }
        const el2 = ov && ov.querySelector("#pnSaved"); if (el2) el2.textContent = saveNote;
      }, 600);
    }

    /* ---------- Status ---------- */
    const row = (lvl, title, detail, tag) => '<div class="pn-sr"><i class="pn-led ' + lvl + '"></i><div class="pn-rt"><b>' + esc(title) + "</b><small>" + esc(detail) + '</small></div><span class="pn-tag ' + lvl + '">' + esc(tag) + "</span></div>";
    async function ghRun(file) {
      const gh = (window.DASHBOARD_DATA && window.DASHBOARD_DATA.github) || {};
      const owner = gh.owner || localStorage.getItem("dashboard-gh-owner"), repo = gh.repo || localStorage.getItem("dashboard-gh-repo");
      if (!owner || !repo) return null;
      const tok = localStorage.getItem("dashboard-gh-token");
      const res = await fetch("https://api.github.com/repos/" + owner + "/" + repo + "/actions/workflows/" + file + "/runs?per_page=1", { headers: tok ? { Authorization: "Bearer " + tok } : {} });
      if (!res.ok) throw new Error("GitHub " + res.status);
      return ((await res.json()).workflow_runs || [])[0] || null;
    }
    async function openStatus() {
      const body = sheet("Status", '<p class="pn-note">Prüfe …</p>');
      const rows = [];
      const rank = { ok: 0, off: 0, warn: 1, bad: 2 };
      const add = (lvl, title, detail, tag) => rows.push({ lvl, html: row(lvl, title, detail, tag) });
      const data = window.DASHBOARD_DATA || {}, last = data.meta && data.meta.lastSyncedAt ? Date.parse(data.meta.lastSyncedAt) : 0;
      add(!last ? "off" : Date.now() - last < 30 * 3600000 ? "ok" : "warn", "Daten (Notion, YouTube, Bricklink)", last ? "Stand " + ago(last) : "Stand unbekannt", !last ? "–" : Date.now() - last < 30 * 3600000 ? "OK" : "ALT");
      /* GitHub startet geplante Laeufe oft Stunden zu spaet; ab der Grenze (Stunden) gibt es einen Hinweis */
      const wf = [["sync-all.yml", "Tägliche Abfrage (GitHub)", 30, "täglich"], ["check-uploads.yml", "Upload-Check (GitHub)", 3, "stündlich geplant"]];
      const runs = await Promise.all(wf.map((w) => ghRun(w[0]).catch((e) => ({ error: e.message }))));
      runs.forEach((r, i) => {
        const w = wf[i];
        if (!r) add("off", w[1], "nicht abfragbar", "–");
        else if (r.error) add("warn", w[1], r.error, "?");
        else if (r.conclusion && r.conclusion !== "success") add("bad", w[1], "zuletzt " + ago(Date.parse(r.created_at)) + ": " + r.conclusion, "FEHLER");
        else if (Date.now() - Date.parse(r.created_at) > w[2] * 3600000) add("warn", w[1], "zuletzt " + ago(Date.parse(r.created_at)) + " (" + w[3] + ")", "SPÄT");
        else add("ok", w[1], "zuletzt " + ago(Date.parse(r.created_at)), "OK");
      });
      if (configured()) {
        try {
          const s = await api("/status");
          add(!s.lastRun ? "warn" : Date.now() - s.lastRun < 25 * 60000 ? "ok" : "bad", "Worker (Zeitplan alle 10 Min.)", s.lastRun ? "zuletzt " + ago(s.lastRun) : "läuft noch nicht (Cron eintragen?)", !s.lastRun ? "–" : Date.now() - s.lastRun < 25 * 60000 ? "OK" : "STEHT");
          if (!s.bricklink) add("off", "Bricklink-Abfrage (Worker)", "noch kein Lauf", "–");
          else add(s.bricklink.ok ? "ok" : "bad", "Bricklink-Abfrage (Worker)", s.bricklink.ok ? s.bricklink.open + " offene Bestellungen, " + ago(s.bricklink.at) : (s.bricklink.error || "Fehler"), s.bricklink.ok ? "OK" : "FEHLER");
          if (s.data && !s.data.ok) add("warn", "Daten lesen (Worker)", s.data.error || "Fehler", "HINWEIS");
          add(s.subs ? "ok" : "warn", "Benachrichtigungen", s.subs ? s.subs + (s.subs === 1 ? " Gerät" : " Geräte") + " · " + s.sent24h + " Meldungen in 24 Std." + (s.quiet ? " · Ruhezeit" : "") : "noch kein Handy angemeldet", s.subs ? "OK" : "AUS");
        } catch (e) { add("bad", "Worker", e.message || "nicht erreichbar", "FEHLER"); }
      } else add("off", "Benachrichtigungen", "noch nicht eingerichtet (Sync-Pfeil → Benachrichtigungen)", "AUS");
      const hs = document.getElementById("habitSyncStatus"), tok = localStorage.getItem("dashboard-gh-token");
      const hsv = hs ? hs.dataset.s : "";
      if (!tok) add("warn", "Cloud-Speicher", "GitHub-Token fehlt: Änderungen werden nicht gesichert", "TOKEN");
      else if (hsv === "error") add("bad", "Cloud-Speicher", (hs && hs.textContent) || "Fehler beim Speichern", "FEHLER");
      else add("ok", "Cloud-Speicher", hsv === "saving" ? "speichert gerade …" : "Änderungen werden gesichert", "OK");
      if (!ov) return;
      const worst = rows.reduce((m, r) => Math.max(m, rank[r.lvl] || 0), 0);
      const banner = worst === 0 ? '<div class="pn-banner ok"><i class="pn-led ok"></i>Alles in Ordnung</div>' : '<div class="pn-banner ' + (worst === 2 ? "bad" : "warn") + '"><i class="pn-led ' + (worst === 2 ? "bad" : "warn") + '"></i>' + rows.filter((r) => rank[r.lvl] > 0).length + " Hinweis(e)</div>";
      body.innerHTML = banner + '<div class="pn-list">' + rows.map((r) => r.html).join("") + '</div><div class="pn-foot"><button type="button" class="pn-btn" data-a="again">NEU PRÜFEN</button></div>';
      body.onclick = (e) => { if (e.target.closest('[data-a="again"]')) openStatus(); };
    }

    /* ---------- Menue am Sync-Knopf ---------- */
    function closeMenu() { if (menu) menu.classList.remove("open"); const b = document.getElementById("syncMenuBtn"); if (b) b.setAttribute("aria-expanded", "false"); }
    function openMenu() {
      const btn = document.getElementById("syncMenuBtn");
      if (!btn) return;
      if (!menu) {
        menu = document.createElement("div");
        menu.className = "pn-menu";
        menu.setAttribute("role", "menu");
        menu.innerHTML = '<button type="button" role="menuitem" data-m="status">STATUS</button><button type="button" role="menuitem" data-m="notify">BENACHRICHTIGUNGEN <small id="pnMenuState"></small></button><button type="button" role="menuitem" data-m="sync">JETZT SYNCHRONISIEREN</button>';
        document.body.appendChild(menu);
        menu.addEventListener("click", (e) => {
          const b = e.target.closest("button[data-m]");
          if (!b) return;
          closeMenu();
          if (b.dataset.m === "status") openStatus();
          else if (b.dataset.m === "notify") openNotify();
          else if (deps.syncNow) deps.syncNow();
        });
        document.addEventListener("click", (e) => { if (menu.classList.contains("open") && !e.target.closest(".pn-menu, #syncMenuBtn")) closeMenu(); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
      }
      const open = !menu.classList.contains("open");
      closeMenu();
      if (!open) return;
      const r = btn.getBoundingClientRect();
      menu.style.top = Math.round(r.bottom + 8) + "px";
      menu.style.right = Math.max(8, Math.round(window.innerWidth - r.right)) + "px";
      menu.classList.add("open");
      btn.setAttribute("aria-expanded", "true");
      const st = menu.querySelector("#pnMenuState");
      if (st) st.textContent = !configured() ? "" : "· AN";
    }
    const caret = document.getElementById("syncMenuBtn");
    if (caret) caret.addEventListener("click", openMenu);

    /* ---------- Antippen einer Meldung: zum Bereich springen ---------- */
    function goTo(url) {
      let id = "";
      try { id = new URL(url, location.href).hash.slice(1); } catch (e) { return; }
      const el = id && document.getElementById(id);
      if (!el) return;
      if (deps.expand) deps.expand(id);
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }
    if ("serviceWorker" in navigator) navigator.serviceWorker.addEventListener("message", (e) => { if (e.data && e.data.type === "push-open") goTo(e.data.url); });
    const onLoaded = () => { if (location.hash.length > 1) setTimeout(() => goTo(location.href), 200); };
    if (document.body.dataset.cloud === "ready") onLoaded(); else document.addEventListener("cloud-ready", onLoaded, { once: true });

    return { openNotify, openStatus, configured, supported };
  };
})();
