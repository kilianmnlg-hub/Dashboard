/* Einklappbare Fenster: jede Sektion (und die Brain-Karte oben) bekommt einen Pfeil-Knopf, der den Inhalt zuklappt und nur die
   Titelzeile stehen laesst. Standard ist immer ausgeklappt; nur was du einklappst, steht in der Liste "collapsed". Die Liste liegt
   wie alles andere in der Cloud (Feld "fold" in sync-data.json, neuerer Zeitstempel gewinnt), nicht im Browser.
   script.js uebergibt dataStore und Auto-Sync und ruft applyRemote()/payload() auf. */
(function () {
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const CHEVRON = '<svg viewBox="0 0 8 4" width="16" height="8" shape-rendering="crispEdges" aria-hidden="true"><path fill="currentColor" d="M0 0h2v1H0zM6 0h2v1H6zM1 1h2v1H1zM5 1h2v1H5zM2 2h4v1H2zM3 3h2v1H3z"/></svg>';

  function sanitize(raw) {
    const out = { collapsed: [], updatedAt: 0 };
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    (Array.isArray(raw.collapsed) ? raw.collapsed : []).forEach((id) => { if (typeof id === "string" && id && !out.collapsed.includes(id)) out.collapsed.push(id); });
    return out;
  }

  window.createFold = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    const KEY = "dashboard-fold-v1";
    let state = { collapsed: [], updatedAt: 0 };
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: alles ausgeklappt */ }

    // Fenster: alle Sektionen mit Titelzeile plus die Brain-Karte oben (sie hat keine, der Knopf sitzt in der Ecke)
    const targets = [];
    const brain = document.querySelector(".brain-card");
    if (brain) targets.push({ id: "brain", box: brain, host: brain, name: "Brain" });
    document.querySelectorAll("main > section.section[id]").forEach((sec) => {
      // Der Knopf sitzt vorn in der Ueberschrift, damit sie linksbuendig bleibt
      const h2 = sec.querySelector(":scope > .section-head h2");
      if (h2) targets.push({ id: sec.id, box: sec, host: h2, name: h2.textContent.trim() });
    });

    targets.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = t.id === "brain" ? "fold-btn fold-corner" : "fold-btn";
      btn.innerHTML = CHEVRON;
      btn.addEventListener("click", () => toggle(t.id));
      t.btn = btn;
      t.host.prepend(btn);
    });

    function render() {
      targets.forEach((t) => {
        const closed = state.collapsed.includes(t.id);
        t.box.classList.toggle("is-folded", closed);
        t.btn.setAttribute("aria-expanded", String(!closed));
        t.btn.setAttribute("aria-label", t.name + (closed ? " ausklappen" : " einklappen"));
        t.btn.title = closed ? "Ausklappen" : "Einklappen";
      });
    }
    function toggle(id) {
      state.collapsed = state.collapsed.includes(id) ? state.collapsed.filter((x) => x !== id) : [...state.collapsed, id];
      state.updatedAt = Date.now();
      dataStore.setItem(KEY, JSON.stringify(state));
      render();
      scheduleAutoSync("syncdata");
    }

    render();
    return {
      render,
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote);
        if (r.updatedAt <= state.updatedAt) return;
        state = r;
        dataStore.setItem(KEY, JSON.stringify(state));
        render();
      },
      payload() { return { collapsed: state.collapsed.slice(), updatedAt: Math.max(0, state.updatedAt) }; }
    };
  };
})();
