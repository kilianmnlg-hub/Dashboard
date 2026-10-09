/* Level-System: Jedes Abhaken gibt Punkte (XP), die automatisch gezaehlt werden und den Level nach und nach erhoehen. Jedes Level kostet
   20 % mehr als das vorige (Level 1 = 50 XP). Erreichte Ziele geben so viel wie ein ganzer Levelaufstieg.
   Gespeichert wird in der Cloud (Feld "xp" in sync-data.json), nicht im Browser:
     days:    pro Tag alle Buchungen als { Schluessel: Punkte }. Jeder Schluessel (z.B. "habit:<id>@2026-10-09") zaehlt genau einmal, egal auf
              welchem Geraet er entsteht. Geraete vereinigen die Buchungen, dadurch geht nichts verloren und nichts wird doppelt gezaehlt.
     archive: Tage aelter als KEEP_DAYS werden zu einer Summe verdichtet, damit die Datei klein bleibt.
     goals:   Ziele, die schon belohnt wurden (oder beim Neustart schon erreicht waren).
   script.js uebergibt dataStore, Auto-Sync und die Effekte und ruft applyRemote()/payload() auf. */
(function () {
  const DAY = 86400000, KEEP_DAYS = 60, BASE = 50, GROW = 1.2;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const need = (n) => Math.round(BASE * Math.pow(GROW, n)); // Kosten fuer den Aufstieg von Level n auf n+1
  // Rang-Namen: alle fuenf Level ein neuer Titel
  const RANKS = [[0, "Anfänger"], [5, "Lehrling"], [10, "Geselle"], [15, "Experte"], [20, "Meister"], [25, "Großmeister"], [30, "Veteran"], [35, "Champion"], [40, "Legende"], [50, "Mythos"]];
  const rankFor = (level) => RANKS.filter((r) => level >= r[0]).pop()[1];
  const empty = () => ({ days: {}, archive: { upTo: "", sum: 0 }, goals: {}, updatedAt: 0 });

  function sanitize(raw) {
    const out = empty();
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    if (raw.archive && typeof raw.archive.upTo === "string" && isNum(raw.archive.sum) && raw.archive.sum >= 0) out.archive = { upTo: raw.archive.upTo, sum: raw.archive.sum };
    if (raw.days && typeof raw.days === "object") {
      Object.entries(raw.days).forEach(([d, evs]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || !evs || typeof evs !== "object") return;
        const day = {};
        Object.entries(evs).forEach(([k, p]) => { if (isNum(p) && p > 0) day[String(k).slice(0, 120)] = p; });
        if (Object.keys(day).length) out.days[d] = day;
      });
    }
    if (raw.goals && typeof raw.goals === "object") Object.entries(raw.goals).forEach(([k, v]) => { if (isNum(v)) out.goals[String(k).slice(0, 80)] = v; });
    return out;
  }

  window.createXp = function (deps) {
    const { dataStore, scheduleAutoSync, onGain, onLevelUp } = deps;
    const KEY = "dashboard-xp-v1";
    let state = empty(), cloudHad = false;
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: bei 0 anfangen */ }

    const total = () => {
      let t = state.archive.sum;
      Object.values(state.days).forEach((evs) => Object.values(evs).forEach((p) => (t += p)));
      return t;
    };
    function info(t = total()) {
      let level = 0, spent = 0;
      while (spent + need(level) <= t) { spent += need(level); level++; if (level > 500) break; }
      return { level, into: t - spent, need: need(level), total: t, rank: rankFor(level) };
    }
    const hasKey = (k) => Object.values(state.days).some((evs) => k in evs);
    function compact() {
      const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * DAY));
      Object.keys(state.days).sort().forEach((d) => {
        if (d > cutoff) return;
        state.archive.sum += Object.values(state.days[d]).reduce((a, p) => a + p, 0);
        if (d > state.archive.upTo) state.archive.upTo = d;
        delete state.days[d];
      });
    }
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    function save() { compact(); state.updatedAt = Date.now(); persist(); scheduleAutoSync("syncdata"); }

    /* ---------- Anzeige: gleiche Level-Leiste wie bisher (LVL n, 10 Bloecke), daneben jetzt die XP ---------- */
    function render() {
      const box = document.getElementById("lvlBox");
      if (!box) return;
      const i = info();
      box.querySelector(".lvl-n").textContent = "LVL " + i.level;
      box.querySelector(".xp").innerHTML = Array.from({ length: 10 }, (_, n) => `<i class="${n < Math.floor((10 * i.into) / i.need) ? "on" : ""}"></i>`).join("");
      box.querySelector(".lvl-avg").textContent = i.into + " / " + i.need + " XP";
      const rk = box.querySelector(".lvl-rank");
      if (rk) rk.textContent = i.rank.toUpperCase();
      box.title = "Level " + i.level + " · Rang " + i.rank + " · noch " + (i.need - i.into) + " XP bis Level " + (i.level + 1) + " · insgesamt " + i.total + " XP";
      box.hidden = false;
    }

    /* Buchungen: items = [[schluessel, punkte], ...]; zaehlt nur, was noch nicht gebucht ist. Gibt die neuen Punkte zurueck. */
    function award(items, el) {
      const day = dayKey(new Date());
      const before = info();
      let gained = 0;
      items.forEach(([k, p]) => {
        if (!(p > 0) || hasKey(k)) return;
        (state.days[day] = state.days[day] || {})[k] = p;
        gained += p;
      });
      if (!gained) return 0;
      save(); render();
      if (onGain) onGain(gained, el || null);
      const after = info();
      if (after.level > before.level && onLevelUp) onLevelUp(after.level, after.rank, after.rank !== before.rank);
      return gained;
    }

    /* Ziele: ein erreichtes Ziel gibt so viel wie ein ganzer Levelaufstieg (Meilenstein die Haelfte), jedes nur einmal */
    function claimGoal(id, half) {
      if (id in state.goals) return 0;
      state.goals[id] = Date.now();
      const n = need(info().level), pts = half ? Math.round(n / 2) : n;
      const got = award([["goal:" + id, pts]], null);
      if (!got) save();
      return got;
    }
    function markGoalsSeen(ids) {
      let changed = false;
      ids.forEach((id) => { if (!(id in state.goals)) { state.goals[id] = Date.now(); changed = true; } });
      if (changed) save();
    }

    render();
    return {
      render,
      award: (key, pts, el) => award([[key, pts]], el),
      awardMany: award,
      claimGoal,
      markGoalsSeen,
      hasGoal: (id) => id in state.goals,
      cloudHad: () => cloudHad,
      info,
      // Bestaende werden immer vereinigt (gleicher Schluessel = gleiche Buchung), nur das Archiv entscheidet der spaetere Stichtag
      applyRemote(remote) {
        if (!remote) return;
        cloudHad = true;
        const r = sanitize(remote);
        if (r.archive.upTo > state.archive.upTo || (r.archive.upTo === state.archive.upTo && r.archive.sum > state.archive.sum)) state.archive = r.archive;
        Object.entries(r.days).forEach(([d, evs]) => {
          if (d <= state.archive.upTo) return;
          const mine = (state.days[d] = state.days[d] || {});
          Object.entries(evs).forEach(([k, p]) => { if (!(k in mine) || p > mine[k]) mine[k] = p; });
        });
        Object.keys(state.days).forEach((d) => { if (d <= state.archive.upTo) delete state.days[d]; });
        Object.entries(r.goals).forEach(([k, v]) => { if (!(k in state.goals)) state.goals[k] = v; });
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        const localOnly = Object.entries(state.days).some(([d, evs]) => Object.keys(evs).some((k) => !(r.days[d] && k in r.days[d]))) || Object.keys(state.goals).some((k) => !(k in r.goals)) || state.archive.upTo > r.archive.upTo;
        persist(); render();
        if (localOnly) scheduleAutoSync("syncdata");
      },
      payload() { return { days: state.days, archive: state.archive, goals: state.goals, updatedAt: Math.max(0, state.updatedAt) }; }
    };
  };
})();
