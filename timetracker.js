/* Zeittracker: zwei Timer (YouTube, Bricklink), Kacheln, Diagramm (Woche/Monat/Jahr), Tages-Detail und Verlauf.
   Speicherung nur in der Cloud: Feld "timetracker" in sync-data.json (laufende Timer + im Dashboard erfasste Eintraege +
   geloeschte Eintraege). Die Historie aus Notion kommt per Sync als data.timeTracker.entries; der taegliche Sync
   (scripts/push-timetracker.mjs) schreibt neue Dashboard-Eintraege nach Notion und verschiebt geloeschte in den Papierkorb.
   script.js uebergibt dataStore, Auto-Sync und die Merge-Regeln und ruft applyRemote()/payload() auf. */
(function () {
  const MIN = 60000, DAY = 86400000, MAX_TIMER = 2 * 3600000; // Ein Timer stoppt automatisch nach 2 Stunden
  const CATS = ["youtube", "bricklink"];
  const LABEL = { youtube: "YouTube", bricklink: "Bricklink" };
  const SPRITE = { youtube: "play", bricklink: "brickblue" };
  const DAY_LABELS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const MONTH_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const sameDay = (a, b) => dateKey(a) === dateKey(b);
  const fmtHM = (ms) => { const m = Math.round(ms / MIN); return Math.floor(m / 60) + "h " + (m % 60) + "m"; };
  const fmtClock = (ms) => { const s = Math.floor(ms / 1000); return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60].map((v) => pad(v)).join(":"); };
  const fmtClockTime = (ms) => { const d = new Date(ms); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
  const fmtDateTime = (ms) => { const d = new Date(ms); return pad(d.getDate()) + "." + pad(d.getMonth() + 1) + "." + d.getFullYear() + ", " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + " Uhr"; };
  // Eintraege werden ueber Kategorie + Start-Minute erkannt (Notion speichert Zeiten nur auf die Minute genau)
  const keyOf = (cat, start) => cat + "|" + Math.floor(start / MIN);
  const monday = (d) => { const c = new Date(d.getFullYear(), d.getMonth(), d.getDate()); c.setDate(c.getDate() + (c.getDay() === 0 ? -6 : 1 - c.getDay())); return c; };
  const weekDays = (o) => { const m = monday(new Date()); m.setDate(m.getDate() + o * 7); return Array.from({ length: 7 }, (_, i) => { const d = new Date(m); d.setDate(m.getDate() + i); return d; }); };
  const monthDays = (o) => { const n = new Date(); const b = new Date(n.getFullYear(), n.getMonth() + o, 1); const c = new Date(b.getFullYear(), b.getMonth() + 1, 0).getDate(); return Array.from({ length: c }, (_, i) => new Date(b.getFullYear(), b.getMonth(), i + 1)); };

  const DEFAULT_TARGETS = { youtube: 20, bricklink: 8 }; // Wochen-Soll in Stunden (aenderbar im Wochenziel-Fenster)
  const emptyState = () => ({ entries: [], removed: [], active: { youtube: null, bricklink: null }, targets: { ...DEFAULT_TARGETS }, updatedAt: -1 });
  const isNum = (v) => typeof v === "number" && isFinite(v);
  // Alles aus Cloud/Speicher wird geprueft, damit kaputte Daten nie die Oberflaeche zerlegen
  function sanitize(raw, newId) {
    const out = emptyState();
    out.updatedAt = 0;
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    const seen = new Set();
    (Array.isArray(raw.entries) ? raw.entries : []).forEach((e) => {
      if (!e || !CATS.includes(e.cat) || !isNum(e.start) || !isNum(e.end) || e.end < e.start) return;
      const k = keyOf(e.cat, e.start);
      if (seen.has(k)) return;
      seen.add(k);
      out.entries.push({ id: e.id ? String(e.id) : newId(), cat: e.cat, start: e.start, end: e.end, k });
    });
    (Array.isArray(raw.removed) ? raw.removed : []).forEach((k) => { if (typeof k === "string" && /^(youtube|bricklink)\|\d+$/.test(k) && !out.removed.includes(k)) out.removed.push(k); });
    CATS.forEach((c) => { const v = raw.active && raw.active[c]; out.active[c] = isNum(v) && v > 0 && v <= Date.now() + 5 * MIN ? v : null; });
    CATS.forEach((c) => { const v = raw.targets && raw.targets[c]; out.targets[c] = isNum(v) && v >= 0 && v <= 80 ? v : DEFAULT_TARGETS[c]; });
    return out;
  }

  window.createTimeTracker = function (deps) {
    const { dataStore, scheduleAutoSync, newId, notionEntries, notionAt, refresh } = deps;
    const root = document.getElementById("zeit");
    if (!root || !window.PixelSprites) return null;
    const { spr, attachSwipe } = window.PixelSprites;
    const $ = (id) => document.getElementById(id);
    const KEY = "dashboard-timetracker-v1";

    // Historie aus Notion (read-only, kommt mit data.js). Wird beim Laden zusaetzlich frisch nachgeladen, damit eine
    // veraltete Kopie von data.js im Browser-Zwischenspeicher nie einen leeren Verlauf zeigt.
    let notion = [], notionKeys = new Set(), notionStamp = notionAt;
    function setNotion(list) {
      notion = [];
      (Array.isArray(list) ? list : []).forEach((e) => {
        const cat = e && typeof e.cat === "string" ? e.cat.toLowerCase() : "";
        if (!CATS.includes(cat) || !isNum(e.start)) return;
        const end = isNum(e.end) ? e.end : e.start + (isNum(e.min) ? e.min * MIN : 0);
        const dur = isNum(e.min) ? e.min * MIN : Math.max(0, end - e.start);
        notion.push({ id: e.id, cat, start: e.start, end, dur, k: keyOf(cat, e.start), notion: true });
      });
      notionKeys = new Set(notion.map((e) => e.k));
    }
    setNotion(notionEntries);

    let state = emptyState();
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw), newId);
    } catch (e) { /* kaputter Speicher: leer starten */ }

    // Nur Oberflaeche
    let mode = "week", offset = 0, animNext = true, index = null;
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    function prune() {
      const cutoff = Date.now() - 14 * DAY, now = Date.now();
      // Was schon sicher in Notion steht und aelter als 14 Tage ist, muss nicht doppelt in der Cloud-Datei liegen
      state.entries = state.entries.filter((e) => !(notionKeys.has(e.k) && e.start < cutoff));
      state.removed = state.removed.filter((k) => notionKeys.has(k) || now - Number(k.split("|")[1]) * MIN < 3 * DAY);
    }
    const save = () => { prune(); state.updatedAt = Date.now(); index = null; persist(); scheduleAutoSync("syncdata"); };

    /* ---------- Daten ---------- */
    function all() {
      const removed = new Set(state.removed), seen = new Set(), out = [];
      notion.forEach((e) => { if (!removed.has(e.k)) { out.push(e); seen.add(e.k); } });
      state.entries.forEach((e) => { if (!removed.has(e.k) && !seen.has(e.k)) { out.push({ id: e.id, cat: e.cat, start: e.start, end: e.end, dur: e.end - e.start, k: e.k, mine: true }); seen.add(e.k); } });
      return out;
    }
    function buildIndex() {
      if (index) return index;
      index = { byDay: new Map(), list: all() };
      index.list.forEach((e) => {
        const k = dateKey(new Date(e.start));
        let row = index.byDay.get(k);
        if (!row) index.byDay.set(k, (row = { youtube: 0, bricklink: 0, entries: [] }));
        row[e.cat] += e.dur; row.entries.push(e);
      });
      return index;
    }
    const live = (c) => (state.active[c] ? Math.min(MAX_TIMER, Math.max(0, Date.now() - state.active[c])) : 0);
    function dayTotals(d) {
      const row = buildIndex().byDay.get(dateKey(d)), t = { youtube: row ? row.youtube : 0, bricklink: row ? row.bricklink : 0 };
      if (sameDay(d, new Date())) CATS.forEach((c) => (t[c] += live(c)));
      return t;
    }
    const dayEntries = (k) => { const row = buildIndex().byDay.get(k); return row ? row.entries.slice().sort((a, b) => a.start - b.start) : []; };

    /* ---------- Timer ---------- */
    $("ttTimers").innerHTML = CATS.map((c) => `<div class="tt-card tt-timer" data-c="${c}"><div class="tt-head">${spr(SPRITE[c], 26)}<h3>${LABEL[c]}</h3><span class="tt-tag"><i></i>LÄUFT</span></div><div class="tt-clock tt-px" id="ttClk-${c}">00:00:00</div><div class="tt-sub" id="ttSub-${c}"></div><button class="tt-tbtn tt-px" id="ttBtn-${c}" type="button">START</button></div>`).join("");
    function renderTimers() {
      const t = dayTotals(new Date());
      CATS.forEach((c) => {
        const run = !!state.active[c];
        root.querySelector(`.tt-timer[data-c="${c}"]`).classList.toggle("tt-running", run);
        $("ttClk-" + c).textContent = fmtClock(run ? live(c) : 0);
        $("ttBtn-" + c).textContent = run ? "STOP" : "START";
        $("ttSub-" + c).textContent = "Heute: " + fmtHM(t[c]) + (run ? " · Auto-Stopp " + fmtClockTime(state.active[c] + MAX_TIMER) : "");
      });
    }
    function commit(cat, start, end) {
      const k = keyOf(cat, start);
      state.removed = state.removed.filter((x) => x !== k);
      if (!state.entries.some((e) => e.k === k) && !notionKeys.has(k)) state.entries.push({ id: newId(), cat, start, end, k });
      state.active[cat] = null;
      freshKey = k;
      save(); renderAll();
    }
    function toggle(cat) {
      if (!state.active[cat]) { state.active[cat] = Date.now(); save(); renderAll(); return; }
      const start = state.active[cat];
      commit(cat, start, Math.min(Date.now(), start + MAX_TIMER));
    }
    // Laeuft ein Timer seit 2 Stunden, wird er mit genau dieser Dauer gespeichert (auch wenn das Dashboard zu war: der Start
    // steht in der Cloud, beim naechsten Oeffnen wird nachgeholt).
    function autoStop() {
      const now = Date.now();
      CATS.forEach((c) => { const s = state.active[c]; if (s && now - s >= MAX_TIMER) commit(c, s, s + MAX_TIMER); });
    }
    CATS.forEach((c) => $("ttBtn-" + c).addEventListener("click", () => toggle(c)));

    /* ---------- Kacheln ---------- */
    const splitBar = (yt, bl) => { const n = 20, tot = yt + bl, y = tot ? Math.round((yt / tot) * n) : 0; return Array.from({ length: n }, (_, i) => `<i class="${!tot ? "" : i < y ? "y" : "b"}"></i>`).join(""); };
    function renderStats() {
      const sum = (days) => days.reduce((a, d) => { const t = dayTotals(d); a[0] += t.youtube; a[1] += t.bricklink; return a; }, [0, 0]);
      const td = dayTotals(new Date()), w = sum(weekDays(0)), m = sum(monthDays(0));
      $("ttStats").innerHTML = [["HEUTE", "HEUTE", td.youtube, td.bricklink], ["DIESE WOCHE", "WOCHE", w[0], w[1]], ["DIESER MONAT", "MONAT", m[0], m[1]]]
        .map(([l, ls, y, b]) => `<div class="tt-card tt-stat"><div class="tt-lb tt-px"><span class="tt-lf">${l}</span><span class="tt-ls">${ls}</span></div><div class="tt-val">${fmtHM(y + b)}</div><div class="tt-split">${splitBar(y, b)}</div></div>`).join("");
    }

    /* ---------- Diagramm ---------- */
    $("ttSeg").innerHTML = [["week", "WOCHE"], ["month", "MONAT"], ["year", "JAHR"]].map(([m, l]) => `<button class="tt-tab tt-px" data-m="${m}" aria-selected="${m === mode}" type="button">${l}</button>`).join("");
    function renderBars(days, anim) {
      const max = Math.max(3600000, ...days.map((d) => { const t = dayTotals(d); return t.youtube + t.bricklink; })), today = new Date();
      $("ttBars").innerHTML = days.map((d) => {
        const t = dayTotals(d);
        let yb = t.youtube ? Math.max(1, Math.round((t.youtube / max) * 14)) : 0, bb = t.bricklink ? Math.max(1, Math.round((t.bricklink / max) * 14)) : 0;
        if (yb + bb > 14) bb = Math.max(0, 14 - yb);
        const label = mode === "week" ? DAY_LABELS[d.getDay()] + "\n" + d.getDate() : String(d.getDate());
        return `<div class="tt-bg ${sameDay(d, today) ? "tt-today" : ""} ${anim ? "tt-grow" : ""}" tabindex="0" role="button" data-d="${dateKey(d)}" aria-label="${d.toLocaleDateString("de-DE")}, ${fmtHM(t.youtube + t.bricklink)} erfasst"><div class="tt-tip">${fmtHM(t.youtube)} YT · ${fmtHM(t.bricklink)} BL</div><div class="tt-stack"><b class="y" style="height:${yb * 10}px"></b><b class="b" style="height:${bb * 10}px"></b></div><div class="tt-dl tt-px">${label}</div></div>`;
      }).join("");
      $("ttRange").textContent = mode === "week" ? `${days[0].getDate()}.${days[0].getMonth() + 1}. – ${days[6].getDate()}.${days[6].getMonth() + 1}.` : MONTH_LABELS[days[0].getMonth()].toUpperCase() + " " + days[0].getFullYear();
    }
    function renderYear(y) {
      const today = new Date();
      $("ttYear").innerHTML = Array.from({ length: 12 }, (_, m) => {
        const first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, n = new Date(y, m + 1, 0).getDate();
        const cells = Array.from({ length: lead }, () => `<span class="tt-yd tt-e"></span>`).concat(Array.from({ length: n }, (_, i) => {
          const d = new Date(y, m, i + 1), t = dayTotals(d), tot = t.youtube + t.bricklink, td = sameDay(d, today) ? " tt-today" : "";
          if (!tot) return `<button class="tt-yd${td}" data-d="${dateKey(d)}" aria-label="${d.toLocaleDateString("de-DE")}, nichts erfasst" type="button"></button>`;
          const p = Math.round((t.youtube / tot) * 100), a = 0.25 + Math.min(1, tot / (6 * 3600000)) * 0.75;
          return `<button class="tt-yd${td}" data-d="${dateKey(d)}" style="background:linear-gradient(to right,var(--tt-yt) ${p}%,var(--tt-bl) ${p}%);opacity:${a.toFixed(2)}" title="${d.toLocaleDateString("de-DE")}: ${fmtHM(tot)}" aria-label="${d.toLocaleDateString("de-DE")}, ${fmtHM(tot)}" type="button"></button>`;
        }));
        return `<div><div class="tt-ym tt-px">${MONTH_LABELS[m].toUpperCase()}</div><div class="tt-yg">${cells.join("")}</div></div>`;
      }).join("");
      $("ttRange").textContent = String(y);
    }
    function renderChart() {
      const yr = mode === "year";
      $("ttCscroll").style.display = yr ? "none" : "";
      $("ttYear").style.display = yr ? "grid" : "none";
      if (yr) renderYear(new Date().getFullYear() + offset); else { renderBars(mode === "week" ? weekDays(offset) : monthDays(offset), animNext); animNext = false; }
      root.querySelectorAll("#ttSeg .tt-tab").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.m === mode)));
      renderChartSum();
    }
    // Titelzeile der Uebersicht (auch zugeklappt sichtbar): Zeitraum + Summe
    function renderChartSum() {
      let total = 0, label;
      if (mode === "year") {
        const y = new Date().getFullYear() + offset;
        buildIndex().byDay.forEach((row, k) => { if (k.startsWith(y + "-")) total += row.youtube + row.bricklink; });
        if (y === new Date().getFullYear()) CATS.forEach((c) => (total += live(c)));
        label = "JAHR " + y;
      } else {
        const days = mode === "week" ? weekDays(offset) : monthDays(offset);
        days.forEach((d) => { const t = dayTotals(d); total += t.youtube + t.bricklink; });
        label = mode === "week" ? "WOCHE " + days[0].getDate() + "." + (days[0].getMonth() + 1) + ". – " + days[6].getDate() + "." + (days[6].getMonth() + 1) + "." : MONTH_LABELS[days[0].getMonth()].toUpperCase() + " " + days[0].getFullYear();
      }
      $("ttChartSum").textContent = label + " · " + fmtHM(total);
    }
    // Beim Aufklappen laufen die Balken neu hoch
    $("ttChartCard").addEventListener("toggle", () => { if ($("ttChartCard").open) { animNext = true; renderChart(); } });
    $("ttSeg").addEventListener("click", (e) => { const b = e.target.closest("[data-m]"); if (b) { mode = b.dataset.m; offset = 0; animNext = true; renderChart(); } });
    $("ttPrev").addEventListener("click", () => { offset--; animNext = true; renderChart(); });
    $("ttNext").addEventListener("click", () => { offset++; animNext = true; renderChart(); });
    const stepMode = (d) => { const o = ["week", "month", "year"], i = o.indexOf(mode) + d; if (i >= 0 && i < 3) { mode = o[i]; offset = 0; animNext = true; renderChart(); } };
    attachSwipe($("ttChartCard"), { onLeft: () => stepMode(1), onRight: () => stepMode(-1), ignore: "#ttCscroll, input" });

    /* ---------- Tages-Detail ---------- */
    function openDay(k) {
      const [y, m, dd] = k.split("-").map(Number), d = new Date(y, m - 1, dd), t = dayTotals(d), list = dayEntries(k);
      $("ttDayTitle").textContent = d.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
      $("ttDayStats").innerHTML = `<div class="tt-mr tt-t"><span>Gesamt</span><span>${fmtHM(t.youtube + t.bricklink)}</span></div>` + CATS.map((c) => `<div class="tt-mr"><span><i style="background:var(--tt-${c === "youtube" ? "yt" : "bl"})"></i>${LABEL[c]}</span><span>${fmtHM(t[c])}</span></div>`).join("");
      $("ttDayEntries").innerHTML = list.length
        ? list.map((e) => `<div class="tt-er" style="--c:var(--tt-${e.cat === "youtube" ? "yt" : "bl"})"><i></i><span class="tt-nm">${LABEL[e.cat]}</span><span class="tt-wh">${fmtClockTime(e.start)}–${fmtClockTime(e.end)} Uhr</span><span class="tt-du">${fmtHM(e.dur)}</span></div>`).join("")
        : `<div class="tt-empty">Keine abgeschlossenen Einträge an diesem Tag.</div>`;
      $("ttDayOv").classList.add("tt-open");
      $("ttDayClose").focus();
    }
    const closeDay = () => $("ttDayOv").classList.remove("tt-open");
    $("ttDayClose").addEventListener("click", closeDay);
    $("ttDayOv").addEventListener("click", (e) => { if (e.target === $("ttDayOv")) closeDay(); });
    root.addEventListener("click", (e) => { const b = e.target.closest("#ttBars .tt-bg, #ttYear .tt-yd"); if (b && b.dataset.d) openDay(b.dataset.d); });
    root.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("tt-bg")) { e.preventDefault(); openDay(e.target.dataset.d); } });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeDay(); });

    /* ---------- Verlauf ---------- */
    let freshKey = null;
    function renderEntries() {
      const list = buildIndex().list.slice().sort((a, b) => b.start - a.start).slice(0, 100);
      $("ttEntries").innerHTML = list.length
        ? list.map((e) => `<div class="tt-er ${e.k === freshKey ? "tt-fresh" : ""}" style="--c:var(--tt-${e.cat === "youtube" ? "yt" : "bl"})"><i></i><span class="tt-nm">${LABEL[e.cat]}</span><span class="tt-wh">${fmtDateTime(e.start)}</span><span class="tt-du">${fmtHM(e.dur)}</span><button class="tt-del" data-k="${esc(e.k)}" type="button" aria-label="Eintrag löschen">×</button></div>`).join("")
        : `<div class="tt-empty">${notion.length ? "Noch keine Einträge." : "Der Notion-Verlauf ist noch nicht geladen (der nächste Sync um 08:00 Uhr oder der Sync-Knopf oben holt ihn)."} Starte oben einen Timer oder füge manuell einen Eintrag hinzu.</div>`;
      freshKey = null;
      const all = buildIndex().list;
      const newest = all.reduce((m, e) => Math.max(m, e.start), 0);
      $("ttLogSum").textContent = all.length + " EINTRÄGE" + (newest ? " · ZULETZT " + pad(new Date(newest).getDate()) + "." + pad(new Date(newest).getMonth() + 1) + "." : "");
    }
    $("ttEntries").addEventListener("click", (e) => {
      const b = e.target.closest(".tt-del");
      if (!b) return;
      const k = b.dataset.k;
      state.entries = state.entries.filter((x) => x.k !== k);
      if (!state.removed.includes(k)) state.removed.push(k);
      save(); renderAll();
    });
    $("ttToggleForm").addEventListener("click", () => { $("ttForm").classList.toggle("tt-open"); if ($("ttForm").classList.contains("tt-open")) $("ttMDate").value = dateKey(new Date()); });
    $("ttMCancel").addEventListener("click", () => $("ttForm").classList.remove("tt-open"));
    $("ttMSave").addEventListener("click", () => {
      const [y, m, d] = ($("ttMDate").value || dateKey(new Date())).split("-").map(Number), mins = (+$("ttMH").value || 0) * 60 + (+$("ttMM").value || 0);
      if (!y || mins <= 0 || mins > 24 * 60) return;
      const s = new Date(y, m - 1, d, 12, 0).getTime();
      $("ttForm").classList.remove("tt-open");
      commitManual($("ttMCat").value, s, s + mins * MIN);
    });
    function commitManual(cat, start, end) {
      const k = keyOf(cat, start);
      state.removed = state.removed.filter((x) => x !== k);
      if (!state.entries.some((e) => e.k === k) && !notionKeys.has(k)) state.entries.push({ id: newId(), cat, start, end, k });
      freshKey = k;
      $("ttLogCard").open = true;
      save(); renderAll();
    }

    /* ---------- Kopf: Sync-Anzeige ---------- */
    function renderSync(msg) {
      const pending = state.entries.filter((e) => !notionKeys.has(e.k)).length;
      const at = notionStamp ? new Date(notionStamp) : null;
      const atTxt = at && !isNaN(at) ? pad(at.getDate()) + "." + pad(at.getMonth() + 1) + ". " + pad(at.getHours()) + ":" + pad(at.getMinutes()) : "?";
      $("ttSyncT").textContent = msg || (notion.length ? "NOTION " + atTxt : "KEINE NOTION-DATEN") + (pending ? " · " + pending + " OFFEN" : "");
      $("ttSync").classList.toggle("tt-busy", pending > 0 || !!msg);
      $("ttSync").title = pending ? pending + " Eintrag/Einträge warten auf den nächsten Notion-Abgleich (täglich 08:00 oder per Sync-Knopf oben)" : "Alle Einträge sind in Notion";
    }
    $("ttRefresh").addEventListener("click", async () => {
      renderSync("LADE…");
      try { if (typeof refresh === "function") await refresh(); } catch (e) { /* Status zeigt der Seitenkopf */ }
      renderAll();
    });

    /* ---------- Wochenziel ---------- */
    const HOUR = 3600000, fmtH = (h) => String(Math.round(h * 10) / 10).replace(".", ",");
    function weekSums(o) { const s = { youtube: 0, bricklink: 0 }; weekDays(o).forEach((d) => { const t = dayTotals(d); CATS.forEach((c) => (s[c] += t[c])); }); return s; }
    function renderGoalFold() {
      const days = weekDays(0), today = new Date(), di = days.findIndex((d) => sameDay(d, today)), dayNo = di < 0 ? 7 : di + 1;
      const cur = weekSums(0), sollTotal = CATS.reduce((a, c) => a + state.targets[c], 0), istTotal = (cur.youtube + cur.bricklink) / HOUR;
      $("ttGoalSum").textContent = "WOCHE " + fmtH(istTotal) + " / " + fmtH(sollTotal) + " H";
      $("ttGoalRows").innerHTML = CATS.map((c) => {
        const soll = state.targets[c], ist = cur[c] / HOUR, N = 20, lit = soll > 0 ? Math.min(N, Math.round((ist / soll) * N)) : 0, mark = Math.round((dayNo / 7) * N);
        const planH = soll * (dayNo / 7), diff = ist - planH, ok = soll === 0 || ist >= planH;
        const note = soll === 0 ? "Kein Soll gesetzt" : ok ? "im Plan (" + fmtH(diff) + " h voraus)" : fmtH(-diff) + " h unter Plan";
        return `<div class="tt-wrow" style="--c:var(--tt-${c === "youtube" ? "yt" : "bl"})"><div class="tt-wn"><i></i>${LABEL[c]}</div><div><div class="tt-wb"><span class="tt-mk" style="left:${(mark / N) * 100}%"></span><div class="tt-blk" style="--cc:${ok ? "var(--status-good)" : "var(--status-warning)"}">${Array.from({ length: N }, (_, j) => `<i class="${j < lit ? "on" : ""}"></i>`).join("")}</div></div><div class="tt-wnote ${ok ? "ok" : "bad"}">${note}</div></div><div class="tt-wst"><b>${fmtH(ist)} / ${fmtH(soll)} h</b><span class="tt-step"><button data-g="${c}" data-d="-1" type="button" aria-label="${LABEL[c]}-Soll verringern">−</button><button data-g="${c}" data-d="1" type="button" aria-label="${LABEL[c]}-Soll erhöhen">+</button></span></div></div>`;
      }).join("");
      const wk = Array.from({ length: 9 }, (_, i) => { const o = i - 8, s = weekSums(o), d0 = weekDays(o)[0]; return { y: s.youtube / HOUR, b: s.bricklink / HOUR, l: d0.getDate() + "." + (d0.getMonth() + 1) + "." }; });
      const maxH = Math.max(sollTotal * 1.15, ...wk.map((w) => w.y + w.b), 8), per = 120 / maxH;
      $("ttHist").innerHTML = wk.map((w) => `<div class="tt-hb"><div class="tt-hs" title="${fmtH(w.y)} h YouTube, ${fmtH(w.b)} h Bricklink"><b class="y" style="height:${Math.round(w.y * per / 8) * 8}px"></b><b class="b" style="height:${Math.round(w.b * per / 8) * 8}px"></b></div><span class="tt-px">${w.l}</span></div>`).join("") + `<div class="tt-soll" style="bottom:${Math.round(sollTotal * per) + 22}px"><em class="tt-px">SOLL ${fmtH(sollTotal)} H</em></div>`;
    }
    $("ttGoalRows").addEventListener("click", (e) => {
      const b = e.target.closest("[data-g]");
      if (!b) return;
      const c = b.dataset.g;
      state.targets[c] = Math.max(0, Math.min(80, state.targets[c] + Number(b.dataset.d)));
      save(); renderGoalFold();
    });
    $("ttGoalCard").addEventListener("toggle", () => { if ($("ttGoalCard").open) renderGoalFold(); });

    function renderAll() { index = null; renderTimers(); renderStats(); renderChart(); renderEntries(); renderSync(); renderGoalFold(); }
    renderAll();
    async function loadFreshNotion() {
      try {
        const res = await fetch("data.js?fresh=" + Date.now(), { cache: "no-store" });
        if (!res.ok) return;
        const txt = await res.text();
        const d = JSON.parse(txt.slice(txt.indexOf("{"), txt.lastIndexOf("};") + 1));
        const list = d && d.timeTracker && d.timeTracker.entries;
        if (!Array.isArray(list)) return;
        if (list.length !== notion.length || (d.meta && d.meta.lastSyncedAt !== notionStamp)) {
          notionStamp = d.meta && d.meta.lastSyncedAt;
          setNotion(list);
          renderAll();
        }
      } catch (e) { /* offline o.ae.: die mitgelieferten Daten bleiben */ }
    }
    loadFreshNotion();
    autoStop();
    setInterval(() => { autoStop(); if (state.active.youtube || state.active.bricklink) { renderTimers(); renderStats(); } }, 1000);

    return {
      render: renderAll,
      // Fuer die Kennzahl in der Titelzeile: Stunden dieser Woche und Wochen-Soll
      weekSummary() { const c = weekSums(0); return { ist: (c.youtube + c.bricklink) / HOUR, soll: state.targets.youtube + state.targets.bricklink }; },
      // Cloud-Stand uebernehmen. Eintraege und Loeschmarken werden immer vereinigt (kein Eintrag geht bei gleichzeitigen
      // Aenderungen auf zwei Geraeten verloren); nur die laufenden Timer entscheidet der neuere Zeitstempel.
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote, newId);
        let changedLocal = false;
        const have = new Set(state.entries.map((e) => e.k));
        r.entries.forEach((e) => { if (!have.has(e.k)) { state.entries.push(e); have.add(e.k); } });
        r.removed.forEach((k) => { if (!state.removed.includes(k)) state.removed.push(k); });
        state.entries = state.entries.filter((e) => !state.removed.includes(e.k));
        // Lokal vorhandenes, das die Cloud noch nicht kennt: beim naechsten Speichern mitschicken
        const remoteKeys = new Set(r.entries.map((e) => e.k));
        changedLocal = state.entries.some((e) => !remoteKeys.has(e.k)) || state.removed.some((k) => !r.removed.includes(k));
        if (r.updatedAt > state.updatedAt) { state.active = r.active; state.targets = r.targets; }
        autoStop();
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        index = null;
        persist();
        renderAll();
        if (changedLocal) scheduleAutoSync("syncdata");
      },
      payload() {
        return {
          entries: state.entries.map((e) => ({ id: e.id, cat: e.cat, start: e.start, end: e.end })),
          removed: state.removed.slice(),
          active: { youtube: state.active.youtube, bricklink: state.active.bricklink },
          targets: { youtube: state.targets.youtube, bricklink: state.targets.bricklink },
          updatedAt: Math.max(0, state.updatedAt)
        };
      }
    };
  };
})();
