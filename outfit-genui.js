/* Outfits (Bereich "Outfits"), Teil 6: Generator. Anlass waehlen, das Wetter holt er selbst (Berlin, Open-Meteo, ohne Schluessel; von Hand waehlen geht auch),
   optional ein Startteil: der Generator baut daraus Vorschlaege aus dem Schrank (Rechnung in outfit-gen.js: Farbtafeln, Stil, Anlass, Wetter, hoechstens ein Teil
   je Layer). Ein Tipp auf einen Vorschlag oeffnet ihn im Collage-Editor, SPEICHERN legt ihn unter OUTFITS ab.
   O.genui(deps) liefert { render(el), refresh() }; deps: store, toast, ic, sheet, CO, itemTitle, layerOf. */
(function () {
  "use strict";
  const O = window.Outfit;
  if (!O || !O.gen || !O.util || !O.collage || !O.data) return;
  const { esc, uid } = O.util, G = O.gen;
  const TEMPS = ["kalt", "kuehl", "mild", "warm", "heiss"], COUNT = 4;
  const KIND = { tonal: "Ton in Ton", kontrast: "Kontrast", neutral: "Basisfarben" };

  /* ==========================================================================
     Wetter: Open-Meteo (frei, ohne Schluessel), Ort fest Berlin. Gerechnet wird mit der gefuehlten Temperatur tagsueber (8 bis 20 Uhr, ab dem Abend fuer morgen).
     ========================================================================== */
  const CITY = { name: "Berlin", lat: 52.52, lon: 13.41 }, WX_KEY = "dashboard-outfit-weather", WX_TTL = 30 * 60000, WX_OLD = 12 * 3600000;
  const bandOf = (t) => (t < 6 ? "kalt" : t < 13 ? "kuehl" : t < 20 ? "mild" : t < 27 ? "warm" : "heiss");
  const hhmm = (ms) => new Date(ms).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  function berlinNow() {
    const s = new Date().toLocaleString("sv-SE", { timeZone: "Europe/Berlin" }); /* "2026-11-04 08:31:12" */
    return { day: s.slice(0, 10), hour: +s.slice(11, 13) + +s.slice(14, 16) / 60 };
  }
  function plan(raw) {
    const H = raw.hourly, now = berlinNow(), days = Array.from(new Set(H.time.map((t) => t.slice(0, 10)))).sort();
    let day = now.day, from = Math.max(8, Math.floor(now.hour)), label = "heute";
    if (now.hour >= 20) { day = days.filter((d) => d > now.day)[0]; from = 8; label = "morgen"; }
    if (!day || days.indexOf(day) < 0) throw new Error("keine passenden Wetterdaten");
    const idx = []; H.time.forEach((t, i) => { const h = +t.slice(11, 13); if (t.slice(0, 10) === day && h >= from && h <= 20) idx.push(i); });
    if (!idx.length) H.time.forEach((t, i) => { if (t.slice(0, 10) === day) idx.push(i); });
    const avg = (a) => idx.reduce((s, i) => s + a[i], 0) / idx.length, feel = avg(H.apparent_temperature);
    const temps = idx.map((i) => H.temperature_2m[i]), rainP = Math.max.apply(null, idx.map((i) => H.precipitation_probability[i] || 0)), rainMm = idx.reduce((s, i) => s + (H.precipitation[i] || 0), 0);
    return { label, feel: Math.round(feel), min: Math.round(Math.min.apply(null, temps)), max: Math.round(Math.max.apply(null, temps)), rain: rainP >= 50 || rainMm >= 1, band: bandOf(feel) };
  }
  async function fetchWx() {
    const url = "https://api.open-meteo.com/v1/forecast?latitude=" + CITY.lat + "&longitude=" + CITY.lon + "&hourly=temperature_2m,apparent_temperature,precipitation_probability,precipitation&timezone=Europe%2FBerlin&forecast_days=2";
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null, to = ctl ? setTimeout(() => ctl.abort(), 8000) : 0;
    try {
      const r = await fetch(url, ctl ? { signal: ctl.signal } : {});
      if (!r.ok) throw new Error("HTTP " + r.status);
      const j = await r.json(); if (!j || !j.hourly || !j.hourly.time) throw new Error("leere Antwort"); return j;
    } finally { if (to) clearTimeout(to); }
  }
  /* liefert die Wetter-Rechnung oder null; ein aelterer Stand (bis 12 Stunden) darf einspringen, wenn das Netz fehlt */
  async function getWx(force) {
    let cache = null; try { cache = JSON.parse(localStorage.getItem(WX_KEY) || "null"); } catch (e) { cache = null; }
    let stale = false;
    if (force || !cache || Date.now() - cache.at >= WX_TTL) {
      try { const j = await fetchWx(); cache = { at: Date.now(), raw: { hourly: j.hourly } }; try { localStorage.setItem(WX_KEY, JSON.stringify(cache)); } catch (e) { /* egal */ } }
      catch (e) { if (!cache || Date.now() - cache.at > WX_OLD) return null; stale = true; }
    }
    try { return Object.assign(plan(cache.raw), { at: cache.at, stale }); } catch (e) { return null; }
  }

  O.genui = function (deps) {
    const { store, toast, ic, sheet, CO, itemTitle, layerOf } = deps, set = store.settings;
    const st = { occ: "", man: "", temp: "", wmode: "auto", wx: null, wxAt: 0, wxLoad: false, anchor: "", res: [], note: "", weak: false, seen: new Set(), last: new Set(), sig: "", run: 0, builtTemp: "", builtRain: false };
    let host = null;
    const famName = (f) => G.FAM_LABEL[f] || f;
    const tLabel = (k) => (G.TEMPS[k] ? G.TEMPS[k].label : "");
    const sigOf = () => { const l = store.items(); return l.length + ":" + l.reduce((m, i) => Math.max(m, i.upd || 0), 0); };
    const syncTemp = () => { st.temp = st.wmode === "auto" && st.wx ? st.wx.band : st.man; };
    const rainNow = () => st.wmode === "auto" && !!(st.wx && st.wx.rain);

    /* Helle Teile (weiss, creme) verschwinden auf dem Papier-Hintergrund: dann den grauen nehmen */
    function bgFor(x) {
      const L = x.pieces.map((q) => { const it = store.byId(q.id), c = it && it.colors && it.colors[0]; return c ? O.color.hex2lab(c)[0] : 50; });
      return Math.max.apply(null, L) > 86 ? "stone" : "paper";
    }
    function freeName(taken) {
      const base = (st.occ || "Outfit") + " · " + tLabel(st.temp).toLowerCase(); let k = 1;
      const name = () => (k === 1 ? base : base + " " + k);
      while (taken.has(name())) k++;
      taken.add(name()); return name();
    }

    /* ---------- Lage der Teile auf der Flaeche (dieselbe Ordnung wie "ORDNEN" im Editor) ---------- */
    const ratios = new Map();
    const ratioOf = (id) => {
      if (ratios.has(id)) return Promise.resolve(ratios.get(id));
      return store.thumbURL(id).then((u) => new Promise((res) => {
        if (!u) return res(1);
        const im = new Image();
        im.onload = () => { const r = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1; ratios.set(id, r); res(r); };
        im.onerror = () => res(1); im.src = u;
      })).catch(() => 1);
    };
    async function layoutOf(x) {
      const rows = await Promise.all(x.pieces.map(async (q) => ({ slot: q.slot, layer: q.layer, ratio: await ratioOf(q.id) })));
      const lay = O.collage.arrange(rows);
      return x.pieces.map((q, i) => Object.assign({ id: q.id, fx: 1 }, lay[i]));
    }

    /* ---------- Vorschlaege bauen ---------- */
    async function run(more) {
      const my = ++st.run; syncTemp(); st.builtTemp = st.temp; st.builtRain = rainNow();
      if (!store.items().length) { st.res = []; st.note = "Der Schrank ist noch leer."; st.sig = sigOf(); return paintRes(); }
      const opts = { items: store.items(), slotOf: store.slotOf, layerOf, occ: st.occ, temp: st.temp, rain: rainNow(), count: COUNT, rng: Math.random, anchor: st.anchor || null, recent: st.last, avoid: more ? st.seen : null };
      let r = G.build(opts), note = "";
      if (more && !r.reason && !r.results.length) { st.seen = new Set(); opts.avoid = null; r = G.build(opts); note = "Das waren alle Vorschläge, es geht von vorn los."; }
      await Promise.all(r.results.map(async (x) => { x.layout = await layoutOf(x); x.id = uid(); x.bg = bgFor(x); }));
      if (my !== st.run) return;
      const taken = new Set(store.outfits().map((o) => o.name)); r.results.forEach((x) => { x.name = freeName(taken); });
      st.sig = sigOf(); st.res = r.results; st.weak = !!r.weak;
      st.note = r.reason || (r.results.length ? "" : "Dafür gibt es im Schrank gerade nichts Passendes.");
      st.last = new Set(); r.results.forEach((x) => { st.seen.add(x.key); x.pieces.forEach((q) => st.last.add(q.id)); });
      paintRes(); if (note) toast(note, "info", 2600);
    }

    /* ---------- Wetter holen (automatisch) ---------- */
    async function loadWx(force) {
      if (st.wxLoad) return;
      st.wxLoad = true; paintWx();
      let w = null; try { w = await getWx(force); } catch (e) { w = null; }
      st.wxLoad = false;
      if (w) { st.wx = w; st.wxAt = Date.now(); }
      else if (st.wx) st.wx.stale = true; /* Neuholen ging schief: das Alte bleibt, mit Zeitangabe */
      syncTemp(); paintWx();
    }
    const wxFresh = () => !!st.wx && Date.now() - st.wxAt < WX_TTL;
    /* neues Wetter -> nur neu bauen, wenn sich Temperaturstufe, Regen oder Schrank geaendert haben */
    function afterWx() {
      if (!host || !host.isConnected) return;
      if (st.temp !== st.builtTemp || st.builtRain !== rainNow() || !st.res.length || sigOf() !== st.sig) run(false);
    }

    /* ---------- Oberflaeche ---------- */
    function formHtml() {
      const chip = (on, g, v, label) => '<button type="button" class="of-chip' + (on ? " on" : "") + '" data-g="' + g + '" data-v="' + esc(v) + '">' + label + "</button>";
      return '<div class="of-gen"><div class="of-gp">' +
        '<div class="of-fld"><div class="of-lbl">ANLASS</div><div class="of-chips tight" role="group" aria-label="Anlass">' + store.occs().map((o) => chip(st.occ === o, "occ", o, esc(o))).join("") + "</div></div>" +
        '<div class="of-fld"><div class="of-lbl of-lblr"><span>WETTER</span><button type="button" class="of-chip of-auto" data-g="wauto" id="gAuto" aria-pressed="false" title="Wetter automatisch holen">AUTO</button></div>' +
        '<div class="of-chips tight" role="group" aria-label="Wetter">' + TEMPS.map((k) => chip(st.temp === k, "temp", k, G.TEMPS[k].label)).join("") + '</div><p class="of-wx" id="gWx" aria-live="polite"></p></div>' +
        '<div class="of-fld"><div class="of-lbl">STARTTEIL <i class="of-th">OPTIONAL</i></div><div class="of-anr" id="gAnc"></div></div></div>' +
        '<div class="of-gh"><b class="of-px" id="gHT"></b><button type="button" class="of-btn of-sm" data-a="more" id="gMore" hidden>NEU MISCHEN</button></div>' +
        '<div class="of-gres" id="gRes" aria-live="polite"></div><p class="of-p of-dim" id="gHint" hidden></p></div>';
    }
    function wxText() {
      if (st.wmode !== "auto") return G.TEMPS[st.temp] ? G.TEMPS[st.temp].hint : "";
      if (!st.wx) return st.wxLoad ? "Wetter wird geladen …" : "Wetter gerade nicht abrufbar, ich nehme " + tLabel(st.temp) + ". Du kannst von Hand wählen.";
      const w = st.wx;
      return CITY.name + " " + w.label + ": " + w.min + "–" + w.max + "°, gefühlt Ø " + w.feel + "°" + (w.rain ? " · Regen möglich" : "") + (w.stale ? " (Stand " + hhmm(w.at) + ")" : "");
    }
    function paintWx() {
      if (!host || !host.isConnected) return;
      const a = host.querySelector("#gAuto"), t = host.querySelector("#gWx"); if (!a || !t) return;
      a.classList.toggle("on", st.wmode === "auto"); a.setAttribute("aria-pressed", String(st.wmode === "auto"));
      host.querySelectorAll('[data-g="temp"]').forEach((b) => b.classList.toggle("on", b.dataset.v === st.temp));
      t.textContent = wxText();
    }
    function paintAnchor() {
      const box = host && host.querySelector("#gAnc"); if (!box) return;
      const it = st.anchor ? store.byId(st.anchor) : null;
      if (!it) { st.anchor = ""; box.innerHTML = '<button type="button" class="of-btn of-sm" data-a="anchor">' + ic("plus", 12) + " TEIL WÄHLEN</button>"; return; }
      box.innerHTML = '<span class="of-chip on of-anc"><button type="button" class="of-anc-b" data-a="anchor" title="Anderes Teil wählen"><span class="of-img"><img alt="" data-id="' + esc(it.id) + '"></span><span class="of-anc-t">' + esc(itemTitle(it)) + '</span></button><button type="button" data-a="noanchor" aria-label="Startteil entfernen">×</button></span>';
      const im = box.querySelector("img"); store.thumbURL(it.id).then((u) => { if (u && im.isConnected) { im.src = u; im.classList.add("on"); } }).catch(() => {});
    }
    function cardHtml(x, i) {
      const dots = x.pieces.map((q) => { const it = store.byId(q.id), c = it && it.colors && it.colors[0]; return c ? '<i style="background:' + esc(c) + '" title="' + esc(itemTitle(it)) + '"></i>' : ""; }).join("");
      const w = x.why[0], saved = !!store.outfitById(x.id);
      let head, sub = "";
      if (w) { head = famName(w.a) + " + " + famName(w.b); sub = [KIND[w.kind], w.n ? w.n + " von 3 Vorlagen" : ""].filter(Boolean).join(" · "); }
      else head = x.fams.slice(0, 3).map(famName).join(" · ");
      return '<div class="of-gcard" data-i="' + i + '"><button type="button" class="of-gcv" data-a="open" aria-label="Im Editor öffnen"><span class="of-co-cv"></span></button>' +
        '<div class="of-gdots">' + dots + '</div><div class="of-gwhy"><b>' + esc(head) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>" +
        '<button type="button" class="of-btn of-sm' + (saved ? "" : " of-go") + '" data-a="save"' + (saved ? " disabled" : "") + ">" + (saved ? ic("check", 12) + " GESPEICHERT" : "SPEICHERN") + "</button></div>";
    }
    function paintRes() {
      if (!host || !host.isConnected) return;
      const box = host.querySelector("#gRes"), ht = host.querySelector("#gHT"), more = host.querySelector("#gMore"); if (!box) return;
      const hint = host.querySelector("#gHint");
      if (!st.res.length) { box.innerHTML = st.note ? '<div class="of-empty of-wide"><p>' + esc(st.note) + "</p></div>" : ""; ht.textContent = ""; more.hidden = true; if (hint) hint.hidden = true; return; }
      ht.textContent = "VORSCHLÄGE"; more.hidden = false;
      box.innerHTML = st.res.map(cardHtml).join("");
      box.querySelectorAll(".of-gcard").forEach((card, i) => CO.paint(card.querySelector(".of-co-cv"), { bg: st.res[i].bg, items: st.res[i].layout }));
      if (hint) { hint.hidden = !(st.weak || st.res.length < COUNT); hint.textContent = st.weak ? "Für " + st.occ + " hat dein Schrank kaum passende Teile." : "Mehr passende Kombinationen gibt es für " + st.occ + " mit deinem Schrank nicht."; }
    }
    function markSaved() {
      if (!host || !host.isConnected) return;
      host.querySelectorAll(".of-gcard").forEach((card) => {
        const x = st.res[+card.dataset.i], b = card.querySelector('[data-a="save"]'), saved = !!(x && store.outfitById(x.id)); if (!b) return;
        b.disabled = saved; b.classList.toggle("of-go", !saved); b.innerHTML = saved ? ic("check", 12) + " GESPEICHERT" : "SPEICHERN";
      });
    }

    /* ---------- Vorschlag oeffnen, speichern ---------- */
    function draftOf(x) { return { id: x.id, name: x.name, bg: x.bg, items: JSON.parse(JSON.stringify(x.layout)), occ: st.occ ? [st.occ] : [] }; }
    async function save(x, btn) {
      btn.disabled = true;
      try { await store.putOutfit(Object.assign(draftOf(x), { added: Date.now() })); toast("Outfit gespeichert", "ok", 2200); }
      catch (e) { btn.disabled = false; toast("Konnte nicht gespeichert werden", "warn", 4000); }
      markSaved();
    }
    function pickAnchor() {
      const idx = Object.keys(O.data.SLOTS);
      const list = store.items().filter((i) => !i.dirty).sort((a, b) => idx.indexOf(store.slotOf(a.cat)) - idx.indexOf(store.slotOf(b.cat)) || b.added - a.added);
      if (!list.length) return toast("Noch keine Teile im Schrank", "warn");
      const s = sheet("STARTTEIL WÄHLEN", '<div class="of-grid">' + list.map((it) =>
        '<button type="button" class="of-tile" data-id="' + esc(it.id) + '"><span class="of-img"><img alt="" data-id="' + esc(it.id) + '"></span><span class="of-tn">' + esc(itemTitle(it)) + "</span></button>").join("") + "</div>");
      s.body.querySelectorAll("img").forEach((im) => store.thumbURL(im.dataset.id).then((u) => { if (u && im.isConnected) { im.src = u; im.classList.add("on"); } }).catch(() => {}));
      s.body.addEventListener("click", (e) => {
        const t = e.target.closest(".of-tile"); if (!t) return;
        st.anchor = t.dataset.id; st.seen = new Set(); s.close(); paintAnchor(); run(false);
      });
    }

    function bind(el) {
      el.addEventListener("click", (e) => {
        const g = e.target.closest("[data-g]");
        if (g) {
          const k = g.dataset.g, v = g.dataset.v;
          if (k === "wauto") { /* Wetter wieder automatisch (ein zweiter Tipp holt es neu) */
            const again = st.wmode === "auto"; st.wmode = "auto"; set.set({ genWMode: "auto" }); st.seen = new Set(); syncTemp(); paintWx();
            loadWx(again).then(afterWx); return;
          }
          if (k === "temp") { st.wmode = "manual"; st.man = v; set.set({ genWMode: "manual", genTemp: v }); syncTemp(); }
          else { if (st.occ === v) return; st.occ = v; set.set({ genOcc: v }); }
          st.seen = new Set();
          el.querySelectorAll('[data-g="occ"]').forEach((b) => b.classList.toggle("on", b.dataset.v === st.occ)); paintWx(); return run(false);
        }
        const a = e.target.closest("[data-a]"); if (!a) return;
        const act = a.dataset.a, card = a.closest(".of-gcard"), x = card ? st.res[+card.dataset.i] : null;
        if (act === "more") run(true);
        else if (act === "anchor") pickAnchor();
        else if (act === "noanchor") { st.anchor = ""; st.seen = new Set(); paintAnchor(); run(false); }
        else if (act === "open" && x) CO.edit(null, draftOf(x));
        else if (act === "save" && x) save(x, a);
      });
    }

    /* Reiter zeigen. Ergebnisse bleiben stehen, solange sich Schrank und Wetter nicht aendern */
    function render(el) {
      host = el;
      const occs = store.occs();
      if (occs.indexOf(st.occ) < 0) st.occ = occs.indexOf(set.get("genOcc")) >= 0 ? set.get("genOcc") : occs[0] || "";
      if (TEMPS.indexOf(st.man) < 0) st.man = TEMPS.indexOf(set.get("genTemp")) >= 0 ? set.get("genTemp") : "mild";
      st.wmode = set.get("genWMode") === "manual" ? "manual" : "auto";
      syncTemp();
      el.innerHTML = formHtml(); bind(el.firstElementChild); paintAnchor(); paintWx();
      if (st.wmode === "auto" && !wxFresh()) {
        if (st.res.length && sigOf() === st.sig) paintRes();
        loadWx().then(afterWx);
      } else if (sigOf() !== st.sig) run(false);
      else paintRes();
    }
    function refresh() {
      if (!host || !host.isConnected) return;
      if (st.wmode === "auto" && !wxFresh()) { loadWx().then(afterWx); return; }
      if (sigOf() !== st.sig) run(false); else markSaved();
    }
    return { render, refresh };
  };
})();
