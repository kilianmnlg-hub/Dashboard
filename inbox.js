/* Handy-Notiz: schnelle Notizen von jedem Geraet in eine Cloud-Inbox (Feld "inbox" in sync-data.json). Das lokale Skript
   scripts/sync-brainmap.ps1 uebernimmt sie am PC in die richtige Notizen.md im Obsidian-Vault; sobald sie dort stehen
   (taucht in data.notes auf), zeigt die Liste ein Haekchen und raeumt sich nach ein paar Tagen selbst auf.
   script.js uebergibt dataStore, Auto-Sync und die Notizen aus data.js und ruft applyRemote()/payload() auf. */
(function () {
  const DAY = 86400000, KEEP_DONE_DAYS = 3, MAX_ITEMS = 60, MAX_REMOVED = 120;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const emptyState = () => ({ items: [], removed: [], updatedAt: -1 });

  function sanitize(raw, newId) {
    const out = emptyState();
    out.updatedAt = 0;
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    const seen = new Set();
    (Array.isArray(raw.items) ? raw.items : []).forEach((i) => {
      if (!i || typeof i.text !== "string" || !i.text.trim() || !isNum(i.at)) return;
      const id = i.id ? String(i.id) : newId();
      if (seen.has(id)) return;
      seen.add(id);
      out.items.push({ id, text: i.text.slice(0, 2000), cat: typeof i.cat === "string" && i.cat ? i.cat.slice(0, 60) : "Ideen", at: i.at });
    });
    (Array.isArray(raw.removed) ? raw.removed : []).forEach((id) => { if (typeof id === "string" && !out.removed.includes(id)) out.removed.push(id); });
    return out;
  }

  window.createInbox = function (deps) {
    const { dataStore, scheduleAutoSync, newId, areas, notes, xp } = deps;
    const $ = (id) => document.getElementById(id);
    const fab = $("inboxFab");
    if (!fab) return null;
    const KEY = "dashboard-inbox-v1";
    const cats = (areas || []).map((a) => ({ name: a.folder, color: a.color || "var(--accent)" }));
    if (!cats.length) cats.push({ name: "Ideen", color: "var(--accent)" });
    let cat = (cats.find((c) => c.name.toLowerCase() === "ideen") || cats[0]).name;

    let state = emptyState();
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw), newId);
    } catch (e) { /* kaputter Speicher: leer starten */ }

    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const inVault = (item) => (notes || []).some((n) => n && n.category === item.cat && String(n.text || "").trim() === item.text.trim());
    function prune() {
      const cutoff = Date.now() - KEEP_DONE_DAYS * DAY;
      state.items = state.items.filter((i) => !(inVault(i) && i.at < cutoff)).filter((i) => !state.removed.includes(i.id)).sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
      state.removed = state.removed.slice(-MAX_REMOVED);
    }
    const save = () => { prune(); state.updatedAt = Date.now(); persist(); scheduleAutoSync("syncdata"); };

    function render() {
      const box = $("inboxBox");
      if (!box) return;
      const list = state.items.filter((i) => !state.removed.includes(i.id));
      box.hidden = !list.length;
      if (!list.length) return;
      const open = list.filter((i) => !inVault(i)).length;
      $("inboxCount").textContent = open ? open + " WARTEN AUF OBSIDIAN" : "ALLES IN OBSIDIAN";
      $("inboxList").innerHTML = list.map((i) => {
        const c = cats.find((x) => x.name === i.cat), done = inVault(i), d = new Date(i.at);
        const when = String(d.getDate()).padStart(2, "0") + "." + String(d.getMonth() + 1).padStart(2, "0") + ". " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
        return `<li class="ib-row"><i style="background:${c ? c.color : "var(--accent)"}"></i><span class="ib-t">${esc(i.text)}<small>${esc(i.cat)} · ${when}</small></span><span class="ib-st ${done ? "ok" : ""}">${done ? "✓ IN OBSIDIAN" : "WARTET"}</span><button type="button" class="ib-del" data-id="${esc(i.id)}" aria-label="Notiz entfernen">×</button></li>`;
      }).join("");
    }
    $("inboxList").addEventListener("click", (e) => {
      const b = e.target.closest(".ib-del");
      if (!b) return;
      state.removed.push(b.dataset.id);
      state.items = state.items.filter((i) => i.id !== b.dataset.id);
      save(); render();
    });

    /* ---------- Eingabe-Fenster ---------- */
    const ov = $("inboxOv"), txt = $("inboxTxt"), msg = $("inboxMsg");
    $("inboxChips").innerHTML = cats.map((c) => `<button type="button" class="ib-chip" data-c="${esc(c.name)}" style="--c:${c.color}" aria-pressed="${c.name === cat}">${esc(c.name)}</button>`).join("");
    $("inboxChips").addEventListener("click", (e) => {
      const b = e.target.closest("[data-c]");
      if (!b) return;
      cat = b.dataset.c;
      $("inboxChips").querySelectorAll(".ib-chip").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.c === cat)));
    });
    const open = () => { msg.textContent = ""; ov.classList.add("open"); setTimeout(() => txt.focus(), 50); };
    const close = () => ov.classList.remove("open");
    fab.addEventListener("click", open);
    $("inboxCancel").addEventListener("click", close);
    ov.addEventListener("click", (e) => { if (e.target === ov) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ov.classList.contains("open")) close(); });
    function add() {
      const text = txt.value.trim();
      if (!text) return;
      const noteId = newId();
      state.items.unshift({ id: noteId, text: text.slice(0, 2000), cat, at: Date.now() });
      if (xp) xp.award("note:" + noteId, 3, $("inboxSave")); // Level-System: Notiz = 3 XP
      txt.value = "";
      save(); render();
      msg.textContent = "Gespeichert. Beim nächsten Abgleich am PC landet sie bei „" + cat + "“ in Obsidian.";
      setTimeout(close, 1400);
    }
    $("inboxSave").addEventListener("click", add);
    txt.addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); add(); } });

    render();
    return {
      render,
      open,
      pending() { return state.items.filter((i) => !state.removed.includes(i.id) && !inVault(i)).length; },
      // Eintraege und Loeschmarken werden immer vereinigt, damit keine Notiz bei gleichzeitigen Aenderungen verloren geht
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote, newId);
        const have = new Set(state.items.map((i) => i.id));
        r.items.forEach((i) => { if (!have.has(i.id)) { state.items.push(i); have.add(i.id); } });
        r.removed.forEach((id) => { if (!state.removed.includes(id)) state.removed.push(id); });
        state.items = state.items.filter((i) => !state.removed.includes(i.id)).sort((a, b) => b.at - a.at).slice(0, MAX_ITEMS);
        const remoteIds = new Set(r.items.map((i) => i.id));
        const localOnly = state.items.some((i) => !remoteIds.has(i.id)) || state.removed.some((id) => !r.removed.includes(id));
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        persist(); render();
        if (localOnly) scheduleAutoSync("syncdata");
      },
      payload() { return { items: state.items.slice(), removed: state.removed.slice(), updatedAt: Math.max(0, state.updatedAt) }; }
    };
  };
})();
