/* Kooperationsanfragen aus dem Postfach. Eine Cloud-Routine (Claude mit reinem Lesezugriff auf Gmail, morgens und abends) sucht neue Anfragen von Marken,
   Agenturen und Plattformen und legt je Anfrage nur eine Kurzfassung in die Datei coop-inbox.json im privaten Daten-Repo (Branch claude/coop-inbox; keine
   Mailtexte, keine Personennamen). Das Dashboard liest sie, zeigt jede neue Anfrage ganz oben wie die anderen Hinweise mit ANTWORTEN (legt direkt eine
   Aufgabe an) und IGNORIEREN und merkt sich die Wahl wie alles andere in der Cloud (Feld "coop" in sync-data.json): done = { <Thread-ID>: { s, t } } mit
   s = reply | ignore | open (open = wieder geoeffnet) und t = Zeitstempel. Zwischen Geraeten wird je Eintrag vereinigt, der neuere Zeitstempel gewinnt, damit
   nichts verloren geht. Der Cloudflare-Worker liest dieselben Dateien und schickt die Handy-Meldung.
   script.js uebergibt dataStore, Auto-Sync, das Lesen der Inbox-Datei, die Aufgabenliste und die Hilfen (Hinweis, Symbole) und ruft applyRemote()/payload() auf. */
(function () {
  const DAY = 86400000, HOUR = 3600000, MAX_ITEMS = 80, MAX_DONE = 400, KEEP_DONE_DAYS = 200, STALE_HOURS = 30;
  const STATES = ["reply", "ignore", "open"];
  const ARTS = { bezahlt: "BEZAHLT", produkt: "PRODUKT", provision: "PROVISION", sonstiges: "ANFRAGE" };
  const TYPEN = { marke: "Marke", agentur: "Agentur", plattform: "Plattform" };
  const SPRACHEN = { de: "Deutsch", en: "Englisch", fr: "Französisch", es: "Spanisch", it: "Italienisch", nl: "Niederländisch", pt: "Portugiesisch", pl: "Polnisch", zh: "Chinesisch", ja: "Japanisch", ko: "Koreanisch", tr: "Türkisch" };
  const ID = /^[\w-]{6,40}$/;
  // Nur Gmail-Adressen aus erlaubten Zeichen (keine Anfuehrungszeichen, Leerzeichen oder Klammern, die aus einem Attribut ausbrechen koennten)
  const GMAIL = /^https:\/\/mail\.google\.com\/[\w\-.~:/?#@!$&()*+,;=%|[\]]*$/;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const clip = (v, n) => String(v == null ? "" : v).replace(/\s+/g, " ").trim().slice(0, n);

  /* Die Inbox-Datei stammt von einem KI-Lauf: alles streng pruefen, nichts ungeprueft anzeigen */
  function cleanItem(i) {
    if (!i || typeof i !== "object") return null;
    const id = clip(i.id, 40), at = Date.parse(i.at), firma = clip(i.firma, 40);
    if (!ID.test(id) || !isFinite(at) || !firma) return null;
    return {
      id, at, firma,
      fuer: clip(i.fuer, 40),
      art: ARTS[i.art] ? i.art : "sonstiges",
      kurz: clip(i.kurz, 200),
      typ: TYPEN[i.typ] ? i.typ : "",
      sprache: clip(i.sprache, 5).toLowerCase(),
      frist: clip(i.frist, 40),
      postfach: clip(i.postfach, 40),
      url: GMAIL.test(String(i.url || "")) ? String(i.url).slice(0, 400) : ""
    };
  }

  function prune(st) {
    const cut = Date.now() - KEEP_DONE_DAYS * DAY;
    let ids = Object.keys(st.done);
    ids.forEach((id) => { if (st.done[id].t < cut) delete st.done[id]; });
    ids = Object.keys(st.done);
    if (ids.length > MAX_DONE) ids.sort((a, b) => st.done[a].t - st.done[b].t).slice(0, ids.length - MAX_DONE).forEach((id) => delete st.done[id]);
    return st;
  }

  function sanitize(raw) {
    const out = { done: {}, updatedAt: 0 };
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    const d = raw.done && typeof raw.done === "object" ? raw.done : {};
    Object.keys(d).forEach((id) => {
      const v = d[id];
      if (ID.test(id) && v && typeof v === "object" && STATES.includes(v.s) && isNum(v.t)) out.done[id] = { s: v.s, t: v.t };
    });
    return prune(out);
  }

  /* "heute 17:36", "gestern 08:05", sonst "10.11. 17:36" */
  function when(ts) {
    const d = new Date(ts), now = new Date(), hm = d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / DAY);
    if (diff <= 0) return "heute " + hm;
    if (diff === 1) return "gestern " + hm;
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + ". " + hm;
  }

  window.createCoop = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    // Eigene Maskierung (mit Anfuehrungszeichen), weil die Texte auch in Attributen landen
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const toast = deps.toast || (() => {});
    const spr = deps.pxSpr || (() => "");
    const KEY = "dashboard-coop-v1";
    let state = sanitize(null), items = [], checkedAt = null, loaded = false, started = false, lastLoad = 0;
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: alles gilt als noch nicht entschieden */ }

    const listeners = [];
    const emit = () => listeners.forEach((f) => { try { f(); } catch (e) { /* ein Anzeigefehler darf die Wahl nicht stoppen */ } });
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const status = (id) => { const d = state.done[id]; return !d || d.s === "open" ? "new" : d.s; };
    const get = (id) => items.find((i) => i.id === id) || null;
    const pending = () => items.filter((i) => status(i.id) === "new");

    function decide(id, s) {
      if (!ID.test(id) || !STATES.includes(s)) return false;
      const prev = state.done[id];
      state.done[id] = { s, t: Math.max(Date.now(), prev ? prev.t + 1 : 0) };
      state.updatedAt = Math.max(Date.now(), state.updatedAt + 1);
      prune(state);
      persist();
      scheduleAutoSync("syncdata");
      emit();
      return true;
    }

    /* ---------- Anzeige: Hinweise ganz oben ---------- */
    const label = (it) => it.firma + (it.fuer ? " · " + it.fuer : "");
    const meta = (it) => [it.postfach ? "an " + it.postfach : "", "Mail von " + when(it.at), SPRACHEN[it.sprache] || "", TYPEN[it.typ] || ""].filter(Boolean).join(" · ");
    function alertHtml(it) {
      const mail = it.url ? `<a class="ta-chip" href="${esc(it.url)}" target="_blank" rel="noopener">MAIL ÖFFNEN</a>` : "";
      return `<div class="ship-alert top-alert info ta-coop" data-alert="coop-${esc(it.id)}"><div class="ship-alert-inner">${spr("mail", 22)}` +
        `<span class="ship-alert-text"><b><span class="ta-tag ${esc(it.art)}">${ARTS[it.art]}</span>Neue Kooperationsanfrage: ${esc(label(it))}</b>` +
        (it.kurz ? `<span class="ta-sub">${esc(it.kurz)}${it.frist ? " (Frist: " + esc(it.frist) + ")" : ""}</span>` : "") +
        `<span class="ta-chips">${mail}<span class="ta-more">${esc(meta(it))}</span></span></span>` +
        `<span class="ta-btns"><button type="button" class="ta-action" data-coop-act="reply" data-coop-id="${esc(it.id)}">ANTWORTEN</button>` +
        `<button type="button" class="ta-action ta-ghost" data-coop-act="ignore" data-coop-id="${esc(it.id)}">IGNORIEREN</button></span>` +
        `<button type="button" class="ship-alert-dismiss" aria-label="Später entscheiden">×</button></div></div>`;
    }
    const MAX_ALERTS = 3;
    function renderAlerts() {
      const host = document.getElementById("topAlerts");
      if (!host) return;
      host.querySelectorAll('[data-alert^="coop-"]').forEach((e) => e.remove());
      if (document.body.dataset.cloud !== "ready") return;
      const dismissed = (id) => { try { return !!sessionStorage.getItem("dashboard-alert-dismissed-" + id); } catch (e) { return false; } };
      const open = pending().filter((i) => !dismissed("coop-" + i.id));
      if (!open.length) return;
      let html = open.slice(0, MAX_ALERTS).map(alertHtml).join("");
      if (open.length > MAX_ALERTS) {
        html += `<div class="ship-alert top-alert info ta-coop" data-alert="coop-more-${open.length}"><div class="ship-alert-inner">${spr("mail", 22)}<span class="ship-alert-text"><b>${open.length - MAX_ALERTS} weitere ${open.length - MAX_ALERTS === 1 ? "Kooperationsanfrage" : "Kooperationsanfragen"} warten</b></span>` +
          `<span class="ta-btns"><button type="button" class="ta-action" data-coop-act="list">ALLE ANZEIGEN</button></span><button type="button" class="ship-alert-dismiss" aria-label="Ausblenden">×</button></div></div>`;
      }
      host.insertAdjacentHTML("beforeend", html);
    }

    /* ---------- Anzeige: Zeile in der Karte Bricks On The Floor ---------- */
    function blockHtml() {
      if (!loaded || !checkedAt) return "";
      const n = pending().length, hrs = (Date.now() - checkedAt) / HOUR, stale = hrs > STALE_HOURS;
      const cls = stale ? "red" : n ? "yellow" : "green";
      const txt = stale ? `Kooperationen: Postfach-Check seit ${Math.floor(hrs)} Std. nicht gelaufen` : `Kooperationsanfragen: ${n ? n + " offen" : "nichts offen"}`;
      return `<div class="cm-row"><p class="rhythm-badge ${cls}">${spr("mail", 14)} ${esc(txt)}<span class="rb-goal"> · Postfach geprüft ${esc(when(checkedAt))}</span></p>` +
        `<button type="button" class="cm-done" data-coop-act="list">ALLE ANZEIGEN</button></div>`;
    }
    function renderBlocks() { document.querySelectorAll("[data-coop]").forEach((el) => { el.innerHTML = blockHtml(); }); }

    /* ---------- Anzeige: Liste mit allen Anfragen ---------- */
    let modal = null;
    function rowHtml(it) {
      const s = status(it.id), btns = s === "new"
        ? `<button type="button" class="cm-done" data-coop-act="reply" data-coop-id="${esc(it.id)}">ANTWORTEN</button><button type="button" class="cm-done cm-alt" data-coop-act="ignore" data-coop-id="${esc(it.id)}">IGNORIEREN</button>`
        : `<span class="coop-state">${s === "reply" ? "ANTWORT ALS AUFGABE" : "IGNORIERT"}</span><button type="button" class="cm-done cm-alt" data-coop-act="open" data-coop-id="${esc(it.id)}">WIEDER ÖFFNEN</button>`;
      return `<li class="coop-item ${s}"><div class="coop-head"><span class="ta-tag ${esc(it.art)}">${ARTS[it.art]}</span><b>${esc(label(it))}</b></div>` +
        (it.kurz ? `<p class="coop-kurz">${esc(it.kurz)}${it.frist ? " (Frist: " + esc(it.frist) + ")" : ""}</p>` : "") +
        `<p class="coop-meta">${esc(meta(it))}${it.url ? ` · <a href="${esc(it.url)}" target="_blank" rel="noopener">Mail öffnen</a>` : ""}</p><div class="coop-btns">${btns}</div></li>`;
    }
    function renderModal() {
      if (!modal || !modal.classList.contains("open")) return;
      const open = items.filter((i) => status(i.id) === "new"), rest = items.filter((i) => status(i.id) !== "new");
      const hrs = checkedAt ? (Date.now() - checkedAt) / HOUR : null;
      modal.querySelector(".coop-sub").textContent = checkedAt ? `Postfach zuletzt geprüft: ${when(checkedAt)}${hrs > STALE_HOURS ? " (der Check läuft offenbar nicht mehr)" : ""}. Gelesen werden nur neue Erstanfragen, keine Newsletter.` : "Noch kein Postfach-Check gelaufen.";
      modal.querySelector(".coop-body").innerHTML =
        (open.length ? `<h3 class="coop-h">Offen (${open.length})</h3><ul class="coop-list">${open.map(rowHtml).join("")}</ul>` : `<p class="coop-empty">Nichts offen.</p>`) +
        (rest.length ? `<h3 class="coop-h">Erledigt (${rest.length})</h3><ul class="coop-list">${rest.map(rowHtml).join("")}</ul>` : "");
    }
    function openList() {
      if (!modal) {
        modal = document.createElement("div");
        modal.className = "overlay coop-ov";
        modal.innerHTML = '<div class="modal modal-wide coop-modal" role="dialog" aria-modal="true" aria-labelledby="coopTitle"><div class="modal-head"><h2 id="coopTitle">Kooperationsanfragen</h2><button class="modal-close" type="button" aria-label="Schließen">×</button></div><p class="modal-sub coop-sub"></p><div class="coop-body"></div></div>';
        document.body.appendChild(modal);
        modal.addEventListener("click", (e) => { if (e.target === modal || e.target.closest(".modal-close")) modal.classList.remove("open"); });
        document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) modal.classList.remove("open"); });
      }
      modal.classList.add("open");
      renderModal();
    }

    /* ---------- Wahl treffen ---------- */
    function undoToast(text, kind, onUndo) {
      const host = document.getElementById("toastHost");
      if (!host) { toast(text, kind); return; }
      const el = document.createElement("div");
      el.className = "dash-toast " + (kind || "info");
      const t = document.createElement("span"); t.textContent = text;
      const b = document.createElement("button"); b.type = "button"; b.className = "dt-undo"; b.textContent = "RÜCKGÄNGIG";
      b.addEventListener("click", (e) => { e.stopPropagation(); el.remove(); onUndo(); });
      el.addEventListener("click", () => el.remove());
      el.appendChild(t); el.appendChild(b); host.appendChild(el);
      while (host.children.length > 3) host.firstChild.remove();
      setTimeout(() => el.remove(), 9000);
    }
    function reply(id) {
      const it = get(id);
      if (!it) return;
      if (document.body.dataset.cloud !== "ready") { toast("Die Cloud ist noch nicht geladen, gleich nochmal tippen."); return; }
      if (status(id) === "reply") return; // schon beantwortet (z.B. Doppelklick): keine zweite Aufgabe
      const text = clip("Kooperation beantworten: " + label(it) + " (" + ARTS[it.art].toLowerCase() + ")", 120);
      const taskId = deps.addTask ? deps.addTask(text, it.url) : null;
      decide(id, "reply");
      if (deps.expand) deps.expand("aufgaben");
      undoToast("Als Aufgabe angelegt: " + label(it), "ok", () => { if (taskId && deps.removeTask) deps.removeTask(taskId); decide(id, "open"); });
    }
    function ignore(id) {
      const it = get(id);
      if (!it) return;
      if (document.body.dataset.cloud !== "ready") { toast("Die Cloud ist noch nicht geladen, gleich nochmal tippen."); return; }
      decide(id, "ignore");
      undoToast("Ignoriert: " + label(it), "warn", () => decide(id, "open"));
    }
    function onClick(e) {
      const b = e.target.closest("[data-coop-act]");
      if (!b) return;
      const act = b.dataset.coopAct, id = b.dataset.coopId;
      if (act === "reply") reply(id);
      else if (act === "ignore") ignore(id);
      else if (act === "open") decide(id, "open");
      else if (act === "list") openList();
    }

    /* ---------- Inbox-Datei laden ---------- */
    function setInbox(json) {
      loaded = true;
      const list = Array.isArray(json && json.items) ? json.items : [];
      const next = list.map(cleanItem).filter(Boolean).sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
      const t = Date.parse(json && json.checkedAt);
      const nextChecked = isFinite(t) ? t : null;
      const same = JSON.stringify(next) === JSON.stringify(items) && nextChecked === checkedAt;
      items = next;
      checkedAt = nextChecked;
      if (!same) emit();
    }
    async function load() {
      if (!deps.readInbox) return;
      lastLoad = Date.now();
      try {
        const { json } = await deps.readInbox();
        setInbox(json);
      } catch (e) { /* kein Netz, kein Token oder Datei noch nicht angelegt: dann bleibt es, wie es ist */ }
    }

    listeners.push(() => { renderAlerts(); renderBlocks(); renderModal(); });

    return {
      items: () => items.slice(),
      pending,
      get,
      status,
      count: () => pending().length,
      checkedAt: () => checkedAt,
      decide,
      open: openList,
      onChange(f) { listeners.push(f); },
      // Nach dem Laden der Cloud starten: erst jetzt sind die gemerkten Entscheidungen da (sonst blitzen schon entschiedene Anfragen kurz auf)
      start() {
        if (started) return;
        started = true;
        // Ein einziger Klick-Handler fuer Hinweise, Zeile in der Karte und Liste (die Hinweise werden beim Klick neu gezeichnet, ein zweiter Handler wuerde doppelt zuschlagen)
        document.addEventListener("click", onClick);
        load().then(() => { renderAlerts(); renderBlocks(); });
        setInterval(() => { if (document.visibilityState === "visible" && Date.now() - lastLoad > 9 * 60000) load(); }, 60000);
      },
      // Beim Zurueckkehren in den Tab (hoechstens alle 2 Minuten)
      refresh() { if (started && Date.now() - lastLoad > 120000) load(); },
      // Die Blocks in den Karten werden erst spaeter gebaut: nach dem Bauen nachziehen
      redraw() { renderBlocks(); },
      // Wahl aus der Cloud vereinigen: je Eintrag gewinnt der neuere Zeitstempel; was nur hier neuer ist, geht beim naechsten Auto-Sync hoch
      applyRemote(remote) {
        if (!remote || typeof remote !== "object") return;
        const r = sanitize(remote);
        let changed = false, localNewer = false;
        Object.keys(r.done).forEach((id) => {
          const mine = state.done[id];
          if (!mine || r.done[id].t > mine.t) { state.done[id] = r.done[id]; changed = true; }
        });
        Object.keys(state.done).forEach((id) => { const theirs = r.done[id]; if (!theirs || state.done[id].t > theirs.t) localNewer = true; });
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        prune(state);
        persist();
        if (changed) emit();
        if (localNewer) scheduleAutoSync("syncdata");
      },
      // Solange nie etwas entschieden wurde, bleibt das Feld ganz weg (kein leerer Eintrag in sync-data.json)
      payload() { return Object.keys(state.done).length ? { done: state.done, updatedAt: Math.max(0, state.updatedAt) } : null; }
    };
  };
})();
