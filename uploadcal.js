/* Upload-Kalender: beide Kanaele in einem Plan. Videoideen (aus den Ideen-Listen der Kanal-Karten) werden per Ziehen oder Antippen auf einen Tag gelegt,
   dazu Community-Posts (Rhythmus aus community.js), Kooperationen, Fristen sowie LEGO- und MTG-Termine. Gezeigt werden Monat und Woche; geplante Eintraege,
   Termine und der Stand "geplant" liegen wie alles andere in der Cloud (Feld "uploadPlan" in sync-data.json). Bereits hochgeladene Videos kommen aus den
   YouTube-Daten (business.*.recentUploads), Ziele und Rhythmus aus data.js, gepostete Community-Posts aus community.js. Nichts davon wird hier doppelt gespeichert.
   Zeitstempel-Prinzip wie bei coop.js: je Eintrag gewinnt der neuere Zeitstempel "t", Loeschen = Grabstein (del), beim Zusammenfuehren zweier Geraete geht nichts verloren.
   script.js uebergibt die Anbindungen (deps) und ruft start() nach dem Laden der Cloud sowie applyRemote()/payload() auf. */
(function () {
  const DAY = 86400000;
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const isDay = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + "T00:00:00Z"));
  const isTime = (s) => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
  const ID = /^[\w-]{1,48}$/;
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const addDays = (day, n) => new Date(utc(day) + n * DAY).toISOString().slice(0, 10);
  const diff = (a, b) => Math.round((utc(b) - utc(a)) / DAY);
  const WD = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const wdOf = (day) => new Date(utc(day)).getUTCDay();
  const nice = (day) => `${WD[wdOf(day)]} ${+day.slice(8)}.${+day.slice(5, 7)}.`;
  const niceY = (day) => nice(day) + day.slice(0, 4);
  const clip = (s, n) => String(s == null ? "" : s).slice(0, n);
  const MONTHS = ["JANUAR", "FEBRUAR", "MÄRZ", "APRIL", "MAI", "JUNI", "JULI", "AUGUST", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DEZEMBER"];
  const STEPS = ["IDEE", "SKRIPT", "DREH", "SCHNITT", "FERTIG"];
  const CH = {
    botf: { tag: "BOTF", name: "Bricks On The Floor", key: "bricksOnTheFloor", color: "var(--accent-bricks)", dim: "color-mix(in srgb, var(--accent-bricks) 38%, var(--surface))", time: "16:00" },
    bw: { tag: "BW", name: "The Brainwalkers", key: "brainwalkers", color: "var(--accent-brainwalkers)", dim: "color-mix(in srgb, var(--accent-brainwalkers) 38%, var(--surface))", time: "18:00" }
  };
  const KIND = {
    koop: { t: "KOOP", l: "Kooperation", color: "var(--status-warning)", f: "koop" },
    frist: { t: "FRIST", l: "Frist", color: "var(--status-warning)", f: "koop" },
    lego: { t: "LEGO", l: "LEGO-Termin", color: "var(--accent-privat)", f: "lego" },
    mtg: { t: "MTG", l: "MTG-Termin", color: "var(--accent-brainwalkers)", f: "mtg" }
  };
  const MAX_ENTRIES = 500, KEEP_TOMB = 60, KEEP_PAST = 120;

  /* ---------- Speicherformat pruefen (kommt aus der Cloud, also nie blind vertrauen) ---------- */
  function cleanPlan(id, r) {
    if (!ID.test(id) || !r || typeof r !== "object" || !isNum(r.t)) return null;
    if (r.del) return { del: 1, t: r.t };
    const kind = r.kind === "post" ? "post" : "video";
    const ch = kind === "post" ? "botf" : (CH[r.ch] ? r.ch : null);
    if (!ch || !isDay(r.date)) return null;
    return {
      kind, ch, date: r.date, t: r.t,
      idea: kind === "video" && typeof r.idea === "string" && ID.test(r.idea) ? r.idea : "",
      title: clip(r.title, 160), time: isTime(r.time) ? r.time : "",
      st: kind === "video" && Number.isInteger(r.st) && r.st >= 0 && r.st < STEPS.length ? r.st : 0,
      note: clip(r.note, 600)
    };
  }
  function cleanEvent(id, r) {
    if (!ID.test(id) || !r || typeof r !== "object" || !isNum(r.t)) return null;
    if (r.del) return { del: 1, t: r.t };
    if (!KIND[r.kind] || !isDay(r.date)) return null;
    const title = clip(r.title, 120).trim();
    if (!title) return null;
    return { kind: r.kind, title, date: r.date, time: isTime(r.time) ? r.time : "", note: clip(r.note, 600), t: r.t };
  }
  function sanitize(raw) {
    const out = { items: {}, events: {}, updatedAt: 0 };
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    [["items", cleanPlan], ["events", cleanEvent]].forEach(([k, fn]) => {
      const src = raw[k];
      if (!src || typeof src !== "object" || Array.isArray(src)) return;
      Object.keys(src).forEach((id) => { const c = fn(id, src[id]); if (c) out[k][id] = c; });
    });
    return prune(out);
  }
  /* Grabsteine nach 60 Tagen und sehr alte Eintraege vergessen, hoechstens 500 behalten (neueste zuerst) */
  function prune(st) {
    const now = Date.now(), today = keyOf(new Date()), oldDay = addDays(today, -KEEP_PAST);
    ["items", "events"].forEach((k) => {
      Object.keys(st[k]).forEach((id) => {
        const e = st[k][id];
        if (e.del ? now - e.t > KEEP_TOMB * DAY : e.date < oldDay) delete st[k][id];
      });
    });
    const all = [];
    ["items", "events"].forEach((k) => Object.keys(st[k]).forEach((id) => all.push([k, id, st[k][id].t])));
    if (all.length > MAX_ENTRIES) all.sort((a, b) => b[2] - a[2]).slice(MAX_ENTRIES).forEach(([k, id]) => { delete st[k][id]; });
    return st;
  }

  window.createUploadCal = function (deps) {
    const { dataStore, scheduleAutoSync } = deps;
    // Eigene Maskierung (mit Anfuehrungszeichen), weil Texte auch in Attributen landen
    const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
    const toast = deps.toast || (() => {});
    const KEY = "dashboard-uploadplan-v1";
    let state = sanitize(null), started = false, host = null, dlg = null, drag = null, redrawTimer = 0;
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw));
    } catch (e) { /* kaputter Speicher: es gilt als noch nichts geplant */ }

    const today0 = keyOf(new Date());
    const view = { mode: "month", y: +today0.slice(0, 4), m: +today0.slice(5, 7) - 1, wk: addDays(today0, -((wdOf(today0) + 6) % 7)), pick: null, sel: today0, on: { botf: true, bw: true, post: true, koop: true, lego: true, mtg: true } };

    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const newId = () => "k" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    function touch() {
      state.updatedAt = Math.max(Date.now(), state.updatedAt + 1);
      persist();
      scheduleAutoSync("syncdata");
    }
    function put(map, id, entry) {
      const prev = state[map][id];
      state[map][id] = Object.assign({}, entry, { t: Math.max(Date.now(), prev ? prev.t + 1 : 0) });
      touch();
    }
    function drop(map, id) {
      const prev = state[map][id];
      state[map][id] = { del: 1, t: Math.max(Date.now(), prev ? prev.t + 1 : 0) };
      touch();
    }
    const live = (map) => Object.keys(state[map]).filter((id) => !state[map][id].del).map((id) => Object.assign({ id }, state[map][id]));

    /* ---------- Daten aus dem Dashboard lesen ---------- */
    const data = () => (deps.getData && deps.getData()) || {};
    const ideasNow = () => { try { return (deps.getIdeas && deps.getIdeas()) || {}; } catch (e) { return {}; } };
    const comm = () => deps.community || null;

    function uploads() {
      const out = [], biz = data().business || {};
      Object.keys(CH).forEach((ch) => {
        ((biz[CH[ch].key] || {}).recentUploads || []).forEach((u) => {
          const ts = Date.parse(u && u.at);
          if (!isFinite(ts)) return;
          const d = new Date(ts);
          out.push({ ch, id: String((u && u.id) || ""), title: String((u && u.title) || ""), day: keyOf(d), time: pad(d.getHours()) + ":" + pad(d.getMinutes()) });
        });
      });
      return out;
    }
    /* Standard-Uhrzeit je Kanal: Mittelwert der letzten Uploads, auf 15 Minuten gerundet (sonst feste Zeit) */
    function defaultTime(ch, ups) {
      const mins = ups.filter((u) => u.ch === ch).map((u) => +u.time.slice(0, 2) * 60 + +u.time.slice(3)).sort((a, b) => a - b);
      if (!mins.length) return CH[ch].time;
      const m = Math.round(mins[Math.floor(mins.length / 2)] / 15) * 15;
      return pad(Math.floor(m / 60) % 24) + ":" + pad(m % 60);
    }

    /* Alles, was zum Zeichnen noetig ist, einmal je Durchgang berechnen */
    function context() {
      const today = keyOf(new Date());
      const ups = uploads();
      const c = comm();
      const posts = c && c.list ? c.list() : [];
      const items = live("items");
      const upKey = new Set(ups.map((u) => u.ch + "|" + u.day));
      // Ein geplanter Eintrag, dessen Upload oder Post schon passiert ist, wird nicht doppelt gezeigt
      items.forEach((it) => { it.matched = it.kind === "post" ? posts.includes(it.date) : upKey.has(it.ch + "|" + it.date); });
      const events = live("events");
      // Stichtag der Jahresziele automatisch als Frist
      const goalDays = [];
      (data().goals || []).forEach((g) => { if (g && g.target > 0 && isDay(g.due) && !goalDays.includes(g.due)) goalDays.push(g.due); });
      goalDays.forEach((d) => events.push({ id: "auto" + d, kind: "frist", title: "Ziele: Stichtag", date: d, time: "", note: "", auto: true }));
      const due = {};
      const biz = data().business || {};
      Object.keys(CH).forEach((ch) => {
        const b = biz[CH[ch].key] || {};
        const t = Date.parse(b.lastUploadAt);
        const last = ups.filter((u) => u.ch === ch).map((u) => u.day).sort().pop() || (isFinite(t) ? keyOf(new Date(t)) : null);
        if (last && b.uploadRhythmDays > 0) due[ch] = addDays(last, b.uploadRhythmDays);
      });
      const lastPost = c && c.last ? c.last() : null;
      const dueP = lastPost && c.days ? addDays(lastPost, c.days()) : null;
      return { today, ups, posts, items, events, due, dueP, lastPost, ideas: ideasNow(), times: { botf: defaultTime("botf", ups), bw: defaultTime("bw", ups) } };
    }

    /* ---------- Eintraege eines Tages (alles, was im Kalender erscheinen kann) ---------- */
    const lateCls = (day, ctx) => (day < ctx.today ? " uk-late" : "");
    function upEntry(u) {
      return { key: "u:" + u.ch + ":" + u.id, type: "up", lane: u.ch, ch: u.ch, day: u.day, sort: u.time, color: CH[u.ch].color, cls: "uk-done", label: u.time + " " + u.title, prog: "ONLINE",
        tipTitle: u.title, tipMeta: "Online " + nice(u.day) + ", " + u.time + " Uhr", open: !!u.id, drag: "" };
    }
    function planEntry(it, ctx) {
      const post = it.kind === "post", late = it.date < ctx.today;
      const label = post ? "POST " + (it.time ? it.time + " " : "") + (it.title || "") : (it.time ? it.time + " " : "") + it.title;
      const prog = post ? "" : "■".repeat(it.st + 1) + "□".repeat(STEPS.length - 1 - it.st);
      return { key: "p:" + it.id, type: "plan", lane: post ? "post" : it.ch, ch: it.ch, day: it.date, sort: it.time || "00:00", color: late ? "var(--bad)" : CH[it.ch].color,
        cls: (post ? "uk-post" : "uk-plan") + (late ? " uk-late" : ""), label: label.trim(), prog,
        tipTitle: post ? (it.title || "Community-Post") : it.title,
        tipMeta: (post ? "Community-Post, " : "") + nice(it.date) + (it.time ? ", " + it.time + " Uhr" : "") + (post ? "" : ", " + STEPS[it.st]) + (late ? ", überfällig" : ""),
        open: true, drag: "p:" + it.id };
    }
    function cpostEntry(day) {
      return { key: "c:" + day, type: "cpost", lane: "post", ch: "botf", day, sort: "00:00", color: CH.botf.color, cls: "uk-done uk-post", label: "POST gepostet", prog: "",
        tipTitle: "Community-Post", tipMeta: "Gepostet " + nice(day), open: false, drag: "" };
    }
    function evEntry(ev) {
      const k = KIND[ev.kind];
      return { key: "e:" + ev.id, type: "ev", lane: "evt", ch: "", kind: ev.kind, day: ev.date, sort: ev.time || "98:00", color: k.color, cls: "uk-ev", label: (ev.time ? ev.time + " " : "") + ev.title, prog: "",
        tipTitle: ev.title, tipMeta: k.l + ", " + nice(ev.date) + (ev.time ? ", " + ev.time + " Uhr" : ""), open: true, drag: "" };
    }
    function ghostEntry(which, overdue) {
      const post = which === "post", c = CH[post ? "botf" : which];
      return { key: "g:" + which, type: "ghost", lane: which, ch: post ? "botf" : which, sort: post ? "96:00" : "97:00", color: overdue ? "var(--bad)" : c.color, cls: "uk-ghost" + (post ? " uk-post" : "") + (overdue ? " uk-late" : ""),
        label: (post ? "POST" : c.tag) + (overdue ? " überfällig" : " fällig"), prog: "", tipTitle: (post ? "Community-Post" : c.tag) + (overdue ? " überfällig" : " fällig"),
        tipMeta: post ? "Nächster Post nach deinem Rhythmus" : "Nächster Upload nach deinem Rhythmus", open: false, drag: "" };
    }
    function visible(e) {
      if (e.type === "ev") return view.on[KIND[e.kind].f];
      if (e.lane === "post") return view.on.post;
      return view.on[e.ch];
    }
    function entriesOn(day, ctx) {
      const out = [];
      ctx.ups.forEach((u) => { if (u.day === day) out.push(upEntry(u)); });
      ctx.items.forEach((it) => { if (it.date === day && !it.matched) out.push(planEntry(it, ctx)); });
      if (ctx.posts.includes(day)) out.push(cpostEntry(day));
      ctx.events.forEach((ev) => { if (ev.date === day) out.push(evEntry(ev)); });
      Object.keys(CH).forEach((ch) => {
        const d = ctx.due[ch];
        if (!d) return;
        const at = d < ctx.today ? ctx.today : d;
        if (at === day && !ctx.items.some((i) => !i.matched && i.kind === "video" && i.ch === ch && i.date >= ctx.today && i.date <= at)) out.push(ghostEntry(ch, d < ctx.today));
      });
      if (ctx.dueP) {
        const at = ctx.dueP < ctx.today ? ctx.today : ctx.dueP;
        if (at === day && !ctx.items.some((i) => !i.matched && i.kind === "post" && i.date >= ctx.today && i.date <= at)) out.push(ghostEntry("post", ctx.dueP < ctx.today));
      }
      return out.filter(visible).sort((a, b) => (a.sort < b.sort ? -1 : a.sort > b.sort ? 1 : 0));
    }

    /* ---------- Anzeige ---------- */
    function pillHtml(e, col) {
      const style = `--c:${e.color}`, side = col >= 4 ? "uk-tip-r" : "";
      const tip = `<span class="uk-tip ${side}"><b>${esc(e.tipTitle)}</b><span>${esc(e.tipMeta)}</span></span>`;
      const inner = `<span class="uk-pl-t">${esc(e.label)}</span>${e.prog ? `<span class="uk-pl-p">${esc(e.prog)}</span>` : ""}${tip}`;
      if (!e.open) return `<span class="uk-pl ${e.cls}" style="${style}" tabindex="0">${inner}</span>`;
      return `<button type="button" class="uk-pl ${e.cls}" style="${style}" data-uk-open="${esc(e.key)}"${e.drag ? ` draggable="true" data-uk-drag="${esc(e.drag)}"` : ""}>${inner}</button>`;
    }
    function dotsHtml(list) {
      return `<span class="uk-dots" aria-hidden="true">${list.slice(0, 3).map((e) => `<i class="uk-dot ${e.cls}" style="--c:${e.color}"></i>`).join("")}</span>`;
    }

    function goalsHtml(ctx) {
      const D = data(), cards = [], weeksTo = (end) => Math.max(1, diff(ctx.today, end)) / 7;
      [["botf", "bricks-longform-2026"], ["bw", "brainwalkers-longform-2026"]].forEach(([ch, gid]) => {
        const g = (D.goals || []).find((x) => x && x.id === gid);
        if (!g || !(g.target > 0)) return;
        const end = isDay(g.due) ? g.due : ctx.today.slice(0, 4) + "-12-31";
        const need = Math.max(0, g.target - g.current);
        const plan = ctx.items.filter((i) => !i.matched && i.kind === "video" && i.ch === ch && i.date >= ctx.today).length;
        const per = (need / weeksTo(end)).toFixed(1).replace(".", ",");
        cards.push({ tag: CH[ch].tag, color: CH[ch].color, dim: CH[ch].dim, big: String(g.current), unit: `/ ${g.target} Videos`, bar: true,
          done: Math.min(100, (g.current / g.target) * 100), plan: Math.min(100 - Math.min(100, (g.current / g.target) * 100), (plan / g.target) * 100),
          left: need ? `noch ${need}, ${per} pro Woche` : "Ziel erreicht", right: ctx.due[ch] ? "fällig " + nice(ctx.due[ch] < ctx.today ? ctx.today : ctx.due[ch]) : "",
          aria: `${g.current} von ${g.target} Videos online, ${plan} eingeplant` });
      });
      const c = comm();
      if (c && c.last && c.days) {
        const n7 = c.count ? c.count(7, ctx.today) : 0;
        cards.push({ tag: "POST", color: CH.botf.color, dim: CH.botf.dim, big: String(n7), unit: "in 7 Tagen", bar: false, left: `alle ${c.days()} Tage`, right: ctx.dueP ? "fällig " + nice(ctx.dueP < ctx.today ? ctx.today : ctx.dueP) : "" });
      }
      if (!cards.length) return "";
      return `<div class="uk-goals">${cards.map((g) => `<div class="uk-goal" style="--c:${g.color}"><div class="uk-gtop"><span class="uk-tag" style="--c:${g.color}">${g.tag}</span><span class="uk-big">${esc(g.big)} <small>${esc(g.unit)}</small></span></div>` +
        (g.bar ? `<div class="uk-prog" role="img" aria-label="${esc(g.aria)}"><i style="width:${g.done}%;background:${g.color}"></i><i style="width:${g.plan}%;background:${g.dim}"></i></div>` : "") +
        `<div class="uk-gline"><span>${esc(g.left)}</span><b>${esc(g.right)}</b></div></div>`).join("")}</div>`;
    }

    function poolHtml(ctx) {
      const byIdea = {}, online = {};
      ctx.items.forEach((it) => { if (it.kind === "video" && it.idea) { if (it.matched) online[it.idea] = true; else byIdea[it.idea] = it; } });
      let free = 0;
      const groups = Object.keys(CH).map((ch) => {
        const list = ((ctx.ideas[ch] || {}).items || []).filter((i) => i && ID.test(String(i.id)) && typeof i.text === "string");
        const next = (ctx.ideas[ch] || {}).nextId;
        const rank = (i) => (online[i.id] ? 2 : byIdea[i.id] ? 1 : 0);
        const rows = list.slice().sort((a, b) => rank(a) - rank(b) || (a.id === next ? -1 : b.id === next ? 1 : 0));
        return `<div class="uk-grp"><span class="uk-tag" style="--c:${CH[ch].color}">${CH[ch].tag}</span>` + rows.map((i) => {
          const pl = byIdea[i.id];
          if (online[i.id]) return `<span class="uk-idea uk-planned"><span class="uk-idea-t">${esc(i.text)}</span><span class="uk-idea-m">online</span></span>`;
          if (pl) return `<button type="button" class="uk-idea uk-planned" draggable="true" data-uk-drag="p:${esc(pl.id)}" data-uk-open="p:${esc(pl.id)}"><span class="uk-idea-t">${esc(i.text)}</span><span class="uk-idea-m">${nice(pl.date)}</span></button>`;
          free++;
          const k = `i:${ch}:${i.id}`;
          return `<button type="button" class="uk-idea${view.pick === k ? " uk-picked" : ""}" draggable="true" data-uk-drag="${esc(k)}" data-uk-idea="${esc(k)}" aria-pressed="${view.pick === k}"><span class="uk-idea-t">${esc(i.text)}</span></button>`;
        }).join("") + `</div>`;
      });
      const pk = "tmpl-post";
      groups.push(`<div class="uk-grp"><span class="uk-tag" style="--c:${CH.botf.color}">POST</span><button type="button" class="uk-idea${view.pick === pk ? " uk-picked" : ""}" draggable="true" data-uk-drag="${pk}" data-uk-idea="${pk}" aria-pressed="${view.pick === pk}"><span class="uk-idea-t">+ Community-Post</span></button></div>`);
      return `<aside class="uk-pool" data-uk-pool><div class="uk-pool-head"><h3 class="uk-h">IDEEN</h3><span class="uk-n">${free}</span></div>${groups.join("")}</aside>`;
    }

    const icon = (d) => `<svg viewBox="0 0 8 8" width="12" height="12" aria-hidden="true"><path d="${d}" fill="currentColor"/></svg>`;
    function barHtml() {
      const chip = (k, label, color) => `<button type="button" class="uk-chip" style="--c:${color}" aria-pressed="${!!view.on[k]}" data-uk-act="chip" data-uk-k="${k}"><i></i>${label}</button>`;
      const tab = (m, label) => `<button type="button" class="uk-tab" aria-pressed="${view.mode === m}" data-uk-act="mode" data-uk-k="${m}">${label}</button>`;
      const range = view.mode === "month" ? `${MONTHS[view.m]} ${view.y}` : weekLabel();
      return `<div class="uk-bar"><div class="uk-nav"><button type="button" class="uk-ib" aria-label="Zurück" data-uk-act="prev">${icon("M6 0v8L1 4z")}</button><h3 class="uk-range">${range}</h3>` +
        `<button type="button" class="uk-ib" aria-label="Weiter" data-uk-act="next">${icon("M2 0v8l5-4z")}</button><button type="button" class="cm-done uk-today-b" data-uk-act="today">HEUTE</button></div>` +
        `<div class="uk-tabs" role="group" aria-label="Ansicht">${tab("month", "MONAT")}${tab("week", "WOCHE")}</div>` +
        `<div class="uk-chips">${chip("botf", "BOTF", CH.botf.color)}${chip("bw", "BW", CH.bw.color)}${chip("post", "Posts", CH.botf.color)}${chip("koop", "Koop, Fristen", KIND.koop.color)}${chip("lego", "LEGO", KIND.lego.color)}${chip("mtg", "MTG", KIND.mtg.color)}</div>` +
        `<button type="button" class="cm-done uk-add" data-uk-act="newEvent">+ TERMIN</button></div>`;
    }
    function weekLabel() {
      const a = view.wk, b = addDays(a, 6), d = (s) => `${+s.slice(8)}.${+s.slice(5, 7)}.`;
      const t = new Date(utc(addDays(a, 3)));
      const w1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
      const kw = 1 + Math.round(((t - w1) / DAY - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
      return `KW ${kw}, ${d(a)} BIS ${d(b)}`;
    }

    function cellHtml(day, ctx, col, lane) {
      const list = entriesOn(day, ctx).filter((e) => !lane || e.lane === lane);
      const past = day < ctx.today, cls = ["uk-cell"];
      if (past) cls.push("uk-past");
      if (day === ctx.today) cls.push("uk-today");
      if (!lane && day === view.sel) cls.push("uk-sel");
      if (!lane && +day.slice(5, 7) - 1 !== view.m) cls.push("uk-out");
      const here = view.pick && !past && (!lane || lane === pickLane(view.pick)) ? `<button type="button" class="uk-here" data-uk-here="${day}">HIER</button>` : "";
      const head = lane ? "" : `<div class="uk-cellhead"><button type="button" class="uk-dnum" data-uk-sel="${day}" aria-label="${niceY(day)}">${+day.slice(8)}</button>${day === ctx.today ? '<span class="uk-todaytag">HEUTE</span>' : ""}</div>`;
      const shown = lane ? list : list.slice(0, 3);
      return `<div class="${cls.join(" ")}" data-uk-day="${day}" data-uk-lane="${lane || ""}">${head}<div class="uk-ents">${shown.map((e) => pillHtml(e, col)).join("")}${!lane && list.length > 3 ? `<span class="uk-more">+${list.length - 3}</span>` : ""}</div>${here}${lane ? "" : dotsHtml(list)}</div>`;
    }
    function monthHtml(ctx) {
      const first = `${view.y}-${pad(view.m + 1)}-01`, start = addDays(first, -((wdOf(first) + 6) % 7));
      let cells = "";
      for (let i = 0; i < 42; i++) cells += cellHtml(addDays(start, i), ctx, i % 7, "");
      return `<div class="uk-month"><div class="uk-wd"><span>MO</span><span>DI</span><span>MI</span><span>DO</span><span>FR</span><span>SA</span><span>SO</span></div><div class="uk-grid">${cells}</div></div>`;
    }
    function weekHtml(ctx) {
      const days = Array.from({ length: 7 }, (_, i) => addDays(view.wk, i));
      const head = days.map((d, i) => `<span class="uk-wh${d === ctx.today ? " uk-today" : d < ctx.today ? " uk-past" : ""}">${["MO", "DI", "MI", "DO", "FR", "SA", "SO"][i]} ${+d.slice(8)}</span>`).join("");
      const lanes = [["botf", CH.botf.tag, CH.botf.color], ["bw", CH.bw.tag, CH.bw.color], ["post", "POST", CH.botf.color], ["evt", "TERMIN", "var(--accent-privat)"]];
      const rows = lanes.map(([id, tag, color]) => `<div class="uk-lane"><div class="uk-lane-l"><span class="uk-tag" style="--c:${color}">${tag}</span></div>${days.map((d, i) => cellHtml(d, ctx, i, id)).join("")}</div>`).join("");
      return `<div class="uk-week"><div class="uk-lane uk-whead"><span></span>${head}</div>${rows}</div>`;
    }

    /* Tagesliste fuer das Handy (am Rechner ausgeblendet): die Eintraege des gewaehlten Tages zum Antippen, darunter IDEE PLANEN */
    function dayHtml(ctx) {
      const list = entriesOn(view.sel, ctx);
      const rows = list.map((e) => {
        const inner = `<span class="uk-tag" style="--c:${e.color}">${esc(e.type === "ev" ? KIND[e.kind].t : e.lane === "post" ? "POST" : CH[e.ch] ? CH[e.ch].tag : "")}</span><span class="uk-row-b"><b>${esc(e.tipTitle)}</b><small>${esc(e.tipMeta)}</small></span>`;
        return e.open ? `<button type="button" class="uk-row ${e.cls}" style="--c:${e.color}" data-uk-open="${esc(e.key)}">${inner}</button>` : `<div class="uk-row ${e.cls}" style="--c:${e.color}">${inner}</div>`;
      }).join("");
      return `<div class="uk-day"><h3 class="uk-h">${nice(view.sel).toUpperCase()}</h3>${rows || '<p class="uk-none">Nichts geplant</p>'}` +
        (view.sel >= ctx.today ? `<button type="button" class="cm-done uk-plan-b" data-uk-act="sheet">IDEE PLANEN</button>` : "") + `</div>`;
    }

    function render() {
      host = host || document.getElementById("ukHost");
      if (!host || !started) return;
      const ctx = context();
      host.innerHTML = `<div class="uk">${goalsHtml(ctx)}<div class="uk-main">${poolHtml(ctx)}<div class="uk-cal">${barHtml()}${view.mode === "month" ? monthHtml(ctx) : weekHtml(ctx)}${dayHtml(ctx)}</div></div></div>`;
    }
    function redraw() {
      clearTimeout(redrawTimer);
      redrawTimer = setTimeout(() => { if (!drag) render(); if (dlg && dlg.classList.contains("open")) refreshDialog(); }, 40);
    }

    /* ---------- Planen, verschieben, zurueckgeben ---------- */
    function laneOfKey(k) {
      if (k === "tmpl-post") return "post";
      if (k.startsWith("i:")) return k.split(":")[1];
      if (k.startsWith("p:")) { const it = state.items[k.slice(2)]; return it && !it.del ? (it.kind === "post" ? "post" : it.ch) : null; }
      return null;
    }
    const pickLane = laneOfKey;
    function plan(k, day) {
      if (!k || !isDay(day) || day < keyOf(new Date())) return false;
      if (document.body.dataset.cloud !== "ready") { toast("Die Cloud ist noch nicht geladen, gleich nochmal tippen."); return false; }
      const ctx = context();
      let msg = "";
      if (k === "tmpl-post") {
        put("items", newId(), { kind: "post", ch: "botf", date: day, time: "12:00", title: "", st: 0, note: "", idea: "" });
        msg = "Post geplant";
      } else if (k.startsWith("i:")) {
        const [, ch, ...rest] = k.split(":"), ideaId = rest.join(":");
        const idea = (((ctx.ideas[ch] || {}).items) || []).find((i) => i && String(i.id) === ideaId);
        if (!CH[ch] || !idea) return false;
        put("items", newId(), { kind: "video", ch, idea: ideaId, title: clip(idea.text, 160), date: day, time: ctx.times[ch], st: 0, note: "" });
        msg = "Geplant";
      } else if (k.startsWith("p:")) {
        const it = state.items[k.slice(2)];
        if (!it || it.del) return false;
        put("items", k.slice(2), Object.assign({}, it, { date: day }));
        msg = "Verschoben";
      } else return false;
      view.pick = null;
      toast(`${msg}: ${nice(day)}`, "ok", 2600);
      render();
      return true;
    }
    function unplan(planId) {
      const it = state.items[planId];
      if (!it || it.del) return;
      drop("items", planId);
      toast(it.kind === "post" ? "Post gelöscht" : "Zurück in den Ideen", "ok", 2600);
      render();
    }

    /* ---------- Fenster mit allen Angaben ---------- */
    function ensureDialog() {
      if (dlg) return dlg;
      dlg = document.createElement("div");
      dlg.className = "overlay uk-ov";
      document.body.appendChild(dlg);
      dlg.addEventListener("click", onDialogClick);
      dlg.addEventListener("change", onDialogChange);
      document.addEventListener("keydown", (e) => { if (e.key === "Escape" && dlg.classList.contains("open")) closeDialog(); });
      return dlg;
    }
    let dlgKey = null;
    const row = (l, v) => `<div class="uk-r"><span>${esc(l)}</span><b>${v}</b></div>`;
    const field = (l, input) => `<label class="uk-f"><span>${esc(l)}</span>${input}</label>`;
    function dialogBody(ctx) {
      const k = dlgKey;
      if (k === "new") return eventForm(null, ctx);
      if (k.startsWith("e:")) {
        const ev = ctx.events.find((x) => x.id === k.slice(2));
        if (!ev) return null;
        return ev.auto ? { accent: KIND.frist.color, tag: "FRIST", title: ev.title, html: row("Art", "Frist") + row("Datum", niceY(ev.date)) + row("Quelle", "Ziele im Dashboard") } : eventForm(ev, ctx);
      }
      if (k.startsWith("u:")) {
        const [, ch, id] = k.split(":"), u = ctx.ups.find((x) => x.ch === ch && x.id === id);
        if (!u) return null;
        const prev = ctx.ups.filter((x) => x.ch === ch && x.day < u.day).map((x) => x.day).sort().pop();
        return { accent: CH[ch].color, tag: CH[ch].tag, title: u.title, html: row("Kanal", esc(CH[ch].name)) + row("Art", "Longform-Video") + row("Online seit", niceY(u.day) + ", " + u.time + " Uhr") +
          (prev ? row("Abstand", diff(prev, u.day) + (diff(prev, u.day) === 1 ? " Tag" : " Tage") + " nach dem vorigen Upload") : "") +
          (u.id ? `<div class="uk-acts"><a class="cm-done" href="https://youtu.be/${esc(u.id)}" target="_blank" rel="noopener">AUF YOUTUBE ANSEHEN</a></div>` : "") };
      }
      if (k.startsWith("p:")) {
        const it = ctx.items.find((x) => x.id === k.slice(2));
        if (!it) return null;
        const post = it.kind === "post", c = CH[it.ch];
        const sameKind = ctx.items.filter((x) => x.id !== it.id && !x.matched && x.kind === it.kind && x.ch === it.ch && x.date < it.date).map((x) => x.date);
        const prevDay = (post ? ctx.posts.filter((d) => d < it.date) : ctx.ups.filter((x) => x.ch === it.ch && x.day < it.date).map((x) => x.day)).concat(sameKind).sort().pop();
        const steps = post ? "" : `<div class="uk-steps" role="group" aria-label="Status">${STEPS.map((s, i) => `<button type="button" class="uk-step${i === it.st ? " on" : i < it.st ? " pre" : ""}" style="--c:${c.color}" aria-pressed="${i === it.st}" data-uk-step="${i}">${s}</button>`).join("")}</div>`;
        const fields = `<div class="uk-fields">${field("Datum", `<input type="date" data-uk-f="date" value="${esc(it.date)}" />`)}${field("Uhrzeit", `<input type="time" data-uk-f="time" value="${esc(it.time)}" />`)}</div>` +
          (post ? field("Stichwort", `<input type="text" data-uk-f="title" maxlength="160" value="${esc(it.title)}" />`) : "") +
          field("Notiz", `<textarea data-uk-f="note" rows="3" maxlength="600">${esc(it.note)}</textarea>`);
        const markable = post && it.date <= ctx.today && deps.community && deps.community.mark;
        const acts = `<div class="uk-acts">${markable ? `<button type="button" class="cm-done" data-uk-act="posted">ALS GEPOSTET EINTRAGEN</button>` : ""}<button type="button" class="cm-done cm-alt" data-uk-act="unplan">${post ? "LÖSCHEN" : "ZURÜCK IN DIE IDEEN"}</button></div>`;
        return { accent: c.color, tag: post ? "POST" : c.tag, title: post ? (it.title || "Community-Post") : it.title,
          html: row("Kanal", esc(c.name)) + row("Art", post ? "Community-Post" : "Longform-Video") + (prevDay ? row("Abstand", diff(prevDay, it.date) + (diff(prevDay, it.date) === 1 ? " Tag" : " Tage") + (post ? " nach dem vorigen Post" : " nach dem vorigen Upload")) : "") + steps + fields + acts };
      }
      return null;
    }
    function eventForm(ev, ctx) {
      const day = ev ? ev.date : (view.sel >= ctx.today ? view.sel : ctx.today);
      const opts = Object.keys(KIND).map((k) => `<option value="${k}"${(ev ? ev.kind : "koop") === k ? " selected" : ""}>${KIND[k].l}</option>`).join("");
      const inner = field("Art", `<select data-uk-f="kind">${opts}</select>`) + field("Titel", `<input type="text" data-uk-f="title" maxlength="120" value="${esc(ev ? ev.title : "")}" />`) +
        `<div class="uk-fields">${field("Datum", `<input type="date" data-uk-f="date" value="${esc(day)}" />`)}${field("Uhrzeit", `<input type="time" data-uk-f="time" value="${esc(ev ? ev.time : "")}" />`)}</div>` +
        field("Notiz", `<textarea data-uk-f="note" rows="3" maxlength="600">${esc(ev ? ev.note : "")}</textarea>`) +
        `<div class="uk-acts">${ev ? `<button type="button" class="cm-done cm-alt" data-uk-act="delEvent">LÖSCHEN</button>` : `<button type="button" class="cm-done" data-uk-act="saveEvent">SPEICHERN</button><button type="button" class="cm-done cm-alt" data-uk-act="closeDlg">ABBRECHEN</button>`}</div>`;
      return { accent: ev ? KIND[ev.kind].color : "var(--accent-privat)", tag: ev ? KIND[ev.kind].t : "NEU", title: ev ? ev.title : "Neuer Termin", html: inner };
    }
    function refreshDialog() {
      if (!dlg || !dlgKey) return;
      const b = dialogBody(context());
      if (!b) { closeDialog(); return; }
      dlg.innerHTML = `<div class="modal uk-modal" role="dialog" aria-modal="true" aria-label="${esc(b.title)}" style="--c:${b.accent}"><div class="uk-mh"><div><span class="uk-tag" style="--c:${b.accent}">${esc(b.tag)}</span><h2>${esc(b.title)}</h2></div><button type="button" class="modal-close" aria-label="Schließen" data-uk-act="closeDlg">×</button></div><div class="uk-mb">${b.html}</div></div>`;
    }
    function openDialog(key) {
      ensureDialog();
      dlgKey = key;
      const b = dialogBody(context());
      if (!b) { dlgKey = null; return; }
      dlg.classList.add("open");
      refreshDialog();
    }
    function closeDialog() { if (dlg) dlg.classList.remove("open"); dlgKey = null; render(); }
    function onDialogClick(e) {
      if (e.target === dlg) { closeDialog(); return; }
      const st = e.target.closest("[data-uk-step]");
      if (st && dlgKey && dlgKey.startsWith("p:")) {
        const id = dlgKey.slice(2), it = state.items[id];
        if (it && !it.del) { put("items", id, Object.assign({}, it, { st: +st.dataset.ukStep })); refreshDialog(); render(); }
        return;
      }
      const b = e.target.closest("[data-uk-act]");
      if (!b) return;
      const a = b.dataset.ukAct;
      if (a === "closeDlg") closeDialog();
      else if (a === "unplan" && dlgKey.startsWith("p:")) { const id = dlgKey.slice(2); closeDialog(); unplan(id); }
      else if (a === "posted" && dlgKey.startsWith("p:")) {
        const id = dlgKey.slice(2), it = state.items[id];
        if (!it || it.del || !deps.community) return;
        if (deps.community.mark(it.date)) toast(`Post vom ${nice(it.date)} eingetragen`, "ok");
        else toast("Dieser Tag ist schon als gepostet eingetragen.");
        drop("items", id);
        closeDialog();
      } else if (a === "delEvent" && dlgKey.startsWith("e:")) { const id = dlgKey.slice(2); drop("events", id); toast("Termin gelöscht", "ok", 2600); closeDialog(); }
      else if (a === "saveEvent") {
        const f = (n) => dlg.querySelector(`[data-uk-f="${n}"]`).value;
        const title = f("title").trim();
        if (!title) { toast("Bitte einen Titel eintragen."); return; }
        if (!isDay(f("date"))) { toast("Bitte ein Datum wählen."); return; }
        if (document.body.dataset.cloud !== "ready") { toast("Die Cloud ist noch nicht geladen, gleich nochmal tippen."); return; }
        const day = f("date");
        put("events", newId(), { kind: KIND[f("kind")] ? f("kind") : "koop", title: clip(title, 120), date: day, time: isTime(f("time")) ? f("time") : "", note: clip(f("note"), 600) });
        view.sel = day;
        toast("Termin eingetragen", "ok", 2600);
        closeDialog();
      }
    }
    /* Geaenderte Felder sofort speichern (bei neuem Termin erst mit SPEICHERN) */
    function onDialogChange(e) {
      const el = e.target.closest("[data-uk-f]");
      if (!el || !dlgKey) return;
      const f = el.dataset.ukF, v = el.value;
      if (dlgKey.startsWith("p:")) {
        const id = dlgKey.slice(2), it = state.items[id];
        if (!it || it.del) return;
        const next = Object.assign({}, it);
        if (f === "date") { if (!isDay(v)) return; next.date = v; }
        else if (f === "time") next.time = isTime(v) ? v : "";
        else if (f === "title") next.title = clip(v, 160);
        else if (f === "note") next.note = clip(v, 600);
        else return;
        put("items", id, next);
        render();
      } else if (dlgKey.startsWith("e:")) {
        const id = dlgKey.slice(2), ev = state.events[id];
        if (!ev || ev.del) return;
        const next = Object.assign({}, ev);
        if (f === "date") { if (!isDay(v)) return; next.date = v; }
        else if (f === "time") next.time = isTime(v) ? v : "";
        else if (f === "title") { if (!v.trim()) return; next.title = clip(v.trim(), 120); }
        else if (f === "note") next.note = clip(v, 600);
        else if (f === "kind") { if (!KIND[v]) return; next.kind = v; }
        else return;
        put("events", id, next);
        render();
        refreshDialog();
      }
    }

    /* Ideen fuer das Handy (Blatt von unten): antippen legt die Idee auf den gewaehlten Tag */
    function openSheet() {
      ensureDialog();
      const ctx = context(), taken = new Set(ctx.items.filter((i) => i.kind === "video" && i.idea && !i.matched).map((i) => i.idea));
      const btn = (k, tag, color, text) => `<button type="button" class="uk-sheet-b" data-uk-sheet="${esc(k)}"><span class="uk-tag" style="--c:${color}">${tag}</span><span>${esc(text)}</span></button>`;
      let list = btn("tmpl-post", "POST", CH.botf.color, "+ Community-Post");
      Object.keys(CH).forEach((ch) => (((ctx.ideas[ch] || {}).items) || []).forEach((i) => { if (i && ID.test(String(i.id)) && typeof i.text === "string" && !taken.has(i.id)) list += btn(`i:${ch}:${i.id}`, CH[ch].tag, CH[ch].color, i.text); }));
      dlgKey = "sheet";
      dlg.classList.add("open");
      dlg.innerHTML = `<div class="modal uk-modal uk-sheet" role="dialog" aria-modal="true" aria-label="Idee planen" style="--c:var(--accent)"><div class="uk-mh"><div><h2>${nice(view.sel).toUpperCase()}</h2></div><button type="button" class="modal-close" aria-label="Schließen" data-uk-act="closeDlg">×</button></div><div class="uk-mb">${list}</div></div>`;
    }

    /* ---------- Bedienung ---------- */
    function shift(dir) {
      if (view.mode === "month") { const d = new Date(view.y, view.m + dir, 1); view.y = d.getFullYear(); view.m = d.getMonth(); }
      else view.wk = addDays(view.wk, 7 * dir);
    }
    function onClick(e) {
      const t = e.target;
      let b = t.closest("[data-uk-act]");
      if (b) {
        const a = b.dataset.ukAct;
        if (a === "prev") shift(-1);
        else if (a === "next") shift(1);
        else if (a === "today") { const d = keyOf(new Date()); view.y = +d.slice(0, 4); view.m = +d.slice(5, 7) - 1; view.wk = addDays(d, -((wdOf(d) + 6) % 7)); view.sel = d; }
        else if (a === "mode") { view.mode = b.dataset.ukK; const d = view.sel; if (view.mode === "week") view.wk = addDays(d, -((wdOf(d) + 6) % 7)); else { view.y = +d.slice(0, 4); view.m = +d.slice(5, 7) - 1; } }
        else if (a === "chip") view.on[b.dataset.ukK] = !view.on[b.dataset.ukK];
        else if (a === "newEvent") { openDialog("new"); return; }
        else if (a === "sheet") { openSheet(); return; }
        else return;
        render();
        return;
      }
      b = t.closest("[data-uk-idea]");
      if (b) { view.pick = view.pick === b.dataset.ukIdea ? null : b.dataset.ukIdea; render(); return; }
      b = t.closest("[data-uk-here]");
      if (b) { plan(view.pick, b.dataset.ukHere); return; }
      b = t.closest("[data-uk-open]");
      if (b) { openDialog(b.dataset.ukOpen); return; }
      b = t.closest("[data-uk-sel]");
      if (b) { view.sel = b.dataset.ukSel; render(); }
    }
    /* Ziehen: Klassen direkt setzen statt neu zu zeichnen, damit das gezogene Element stehen bleibt */
    const clearOver = () => { if (host) host.querySelectorAll(".uk-over").forEach((el) => el.classList.remove("uk-over")); };
    function onDragStart(e) {
      const el = e.target.closest && e.target.closest("[data-uk-drag]");
      if (!el) return;
      drag = el.dataset.ukDrag;
      try { e.dataTransfer.setData("text/plain", drag); e.dataTransfer.effectAllowed = "move"; } catch (x) { /* egal */ }
      host.classList.add("uk-dragging");
    }
    function target(e) {
      const cell = e.target.closest && e.target.closest("[data-uk-day]");
      if (cell) {
        const lane = cell.dataset.ukLane, ok = cell.dataset.ukDay >= keyOf(new Date()) && (!lane || lane === laneOfKey(drag));
        return ok ? cell : null;
      }
      // Auf den Ideenspeicher darf nur ein schon geplanter Eintrag (Video: wird wieder frei, Post: wird geloescht)
      const pool = e.target.closest && e.target.closest("[data-uk-pool]");
      const it = drag && drag.startsWith("p:") ? state.items[drag.slice(2)] : null;
      return pool && it && !it.del ? pool : null;
    }
    function onDragOver(e) {
      if (!drag) return;
      const t = target(e);
      if (!t) return;
      e.preventDefault();
      if (!t.classList.contains("uk-over")) { clearOver(); t.classList.add("uk-over"); }
    }
    function onDrop(e) {
      if (!drag) return;
      const t = target(e);
      if (!t) return;
      e.preventDefault();
      const k = drag;
      drag = null;
      clearOver();
      host.classList.remove("uk-dragging");
      if (t.dataset.ukPool !== undefined) unplan(k.slice(2));
      else plan(k, t.dataset.ukDay);
    }
    function onDragEnd() { drag = null; clearOver(); if (host) host.classList.remove("uk-dragging"); redraw(); }

    // Handy-Blatt: Idee antippen
    function onSheetClick(e) {
      const b = e.target.closest("[data-uk-sheet]");
      if (!b) return false;
      if (plan(b.dataset.ukSheet, view.sel)) closeDialog();
      return true;
    }

    return {
      // Kennzahl in der Titelzeile: der naechste geplante Upload oder Post
      metric() {
        if (!started) return "";
        const today = keyOf(new Date()), ctx = context();
        const next = ctx.items.filter((i) => !i.matched && i.date >= today).map((i) => i.date).sort()[0];
        return next ? "NÄCHSTER: " + nice(next).toUpperCase() : "";
      },
      open() { if (deps.expand) deps.expand("uploadkal"); const s = document.getElementById("uploadkal"); if (s) s.scrollIntoView({ behavior: "smooth", block: "start" }); },
      redraw,
      onChange() {},
      start() {
        if (started) return;
        started = true;
        host = document.getElementById("ukHost");
        if (!host) return;
        host.addEventListener("click", onClick);
        host.addEventListener("dragstart", onDragStart);
        host.addEventListener("dragover", onDragOver);
        host.addEventListener("drop", onDrop);
        host.addEventListener("dragend", onDragEnd);
        ensureDialog();
        dlg.addEventListener("click", (e) => { onSheetClick(e); });
        render();
      },
      // Beim Zurueckkehren in den Tab: Tageswechsel und neue Daten uebernehmen
      refresh() { if (started) redraw(); },
      // Stand aus der Cloud vereinigen: je Eintrag gewinnt der neuere Zeitstempel; was nur hier neuer ist, geht beim naechsten Auto-Sync hoch
      applyRemote(remote) {
        if (!remote || typeof remote !== "object") return;
        const r = sanitize(remote);
        let changed = false, localNewer = false;
        ["items", "events"].forEach((k) => {
          Object.keys(r[k]).forEach((id) => {
            const mine = state[k][id];
            if (!mine || r[k][id].t > mine.t) { state[k][id] = r[k][id]; changed = true; }
          });
          Object.keys(state[k]).forEach((id) => { const theirs = r[k][id]; if (!theirs || state[k][id].t > theirs.t) localNewer = true; });
        });
        state.updatedAt = Math.max(state.updatedAt, r.updatedAt);
        prune(state);
        persist();
        if (changed) redraw();
        if (localNewer) scheduleAutoSync("syncdata");
      },
      // Solange nie etwas geplant wurde, bleibt das Feld ganz weg (kein leerer Eintrag in sync-data.json)
      payload() { return Object.keys(state.items).length || Object.keys(state.events).length ? { items: state.items, events: state.events, updatedAt: Math.max(0, state.updatedAt) } : null; }
    };
  };
})();
