/* Outfits (Bereich "Outfits"), Teil 4: Collage. Ein Outfit ist eine Liste von Teilen mit Lage auf einer Flaeche im Format 4:5 (x/y = Mitte, w = Breite in Prozent
   der Flaeche, r = Drehung in Grad, z = Reihenfolge, fx = -1 gespiegelt). Alles in Prozent, damit Editor, Karten in der Liste und der Bild-Export gleich aussehen.
   O.collage(deps) liefert { edit(id, entwurf), paint(flaeche, outfit, opts), arrange(liste), share(outfit) }; deps: store, toast, ic, itemTitle, layerOf. */
(function () {
  "use strict";
  const O = window.Outfit;
  if (!O || !O.util || !O.data || !O.createStore) return;
  const { esc, uid, clamp } = O.util, D = O.data;
  const RATIO = 1.25; /* Hoehe der Flaeche geteilt durch ihre Breite (4:5) */
  const BG_HEX = { paper: "#efe6d2", white: "#fbfaf6", stone: "#c9c4b8", night: "#1e1a15", orange: "#e8a76a", green: "#9db58a" };
  const SLOT_PL = { top: "OBERTEILE", mid: "PULLOVER", outer: "JACKEN", dress: "KLEIDER", bottom: "HOSEN", shoes: "SCHUHE", acc: "ACCESSOIRES" };
  const SLOT_IDX = Object.keys(SLOT_PL);
  const norm = (v) => Math.round(((((v + 180) % 360) + 360) % 360 - 180) * 10) / 10;
  const snap = (v) => { const m = Math.round(v / 90) * 90; return norm(Math.abs(v - m) < 2.5 ? m : v); };
  const loadImg = (u) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("Bild nicht ladbar")); i.src = u; });

  /* ==========================================================================
     Automatisch ordnen: Oberteile oben (Schichten nebeneinander, Base hinten bis Outer vorn), Hose in der Mitte, Schuhe unten, Kleinteile in die Ecken.
     list: [{ slot, layer, ratio }] (ratio = Breite / Hoehe des Fotos); gibt pro Eintrag { x, y, w, r, z } zurueck.
     ========================================================================== */
  function arrange(list) {
    const out = list.map(() => null);
    const pick = (f) => list.map((e, i) => (f(e) ? i : -1)).filter((i) => i >= 0);
    const rank = (e) => (e.slot === "dress" ? 0 : { base: 1, mid: 2, outer: 3 }[e.layer] || (e.slot === "top" ? 1 : e.slot === "mid" ? 2 : 3));
    const up = pick((e) => e.slot === "top" || e.slot === "mid" || e.slot === "outer" || e.slot === "dress").sort((a, b) => rank(list[a]) - rank(list[b]));
    const low = pick((e) => e.slot === "bottom"), sh = pick((e) => e.slot === "shoes"), acc = pick((e) => e.slot === "acc");
    const rows = [];
    if (up.length) rows.push({ k: "up", w: up.some((i) => list[i].slot === "dress") && up.length === 1 ? 70 : 40 });
    if (low.length) rows.push({ k: "low", w: 40 });
    if (sh.length) rows.push({ k: "sh", w: 15 });
    const gap = 1.5, avail = 92 - gap * Math.max(0, rows.length - 1), total = rows.reduce((s, r) => s + r.w, 0) || 1, f = Math.min(1.6, avail / total);
    let y = 4; rows.forEach((r) => { r.h = r.w * f; r.c = y + r.h / 2; y += r.h + gap; });
    const row = (k) => rows.find((r) => r.k === k);
    const fitW = (i, bw, bh) => clamp(Math.min(bw, bh * RATIO * (list[i].ratio || 1)), 8, 90);
    const n = up.length;
    if (n) {
      const r = row("up"), P = n === 1 ? [[50, 0, 0]] : n === 2 ? [[34, -7, 0], [63, 4, 0]] : n === 3 ? [[28, -8, 1], [50, 0, -1], [72, 6, 2]] : null;
      up.forEach((i, k) => {
        if (P) { const q = P[k]; out[i] = { x: q[0], y: r.c + q[2], w: fitW(i, n === 1 ? 66 : n === 2 ? 50 : 42, r.h), r: q[1], z: k + 1 }; }
        else { const cols = 2, rr = Math.ceil(n / cols), cw = 48, ch = r.h / rr; out[i] = { x: 27 + (k % cols) * 46, y: r.c - r.h / 2 + ch * (Math.floor(k / cols) + 0.5), w: fitW(i, cw, ch), r: k % 2 ? 3 : -3, z: k + 1 }; }
      });
    }
    const spread = (idx, r, bw) => idx.forEach((i, k) => { const m = idx.length; out[i] = { x: m === 1 ? 50 : 50 + (k - (m - 1) / 2) * (m === 2 ? 32 : 26), y: r.c, w: fitW(i, m === 1 ? bw : bw * 0.62, r.h), r: 0, z: k + 1 }; });
    if (low.length) spread(low, row("low"), 38);
    if (sh.length) { spread(sh, row("sh"), 52); sh.forEach((i) => { out[i].z = 2; }); }
    const SPOTS = [[85, 11], [15, 11], [87, 48], [13, 48], [85, 78], [15, 78]];
    acc.forEach((i, k) => { const s = SPOTS[k % SPOTS.length]; out[i] = { x: s[0], y: s[1], w: fitW(i, 20, 15), r: k % 2 ? -8 : 10, z: 5 + k }; });
    return out;
  }

  O.collage = function (deps) {
    const { store, toast, ic, itemTitle, layerOf } = deps;
    const catLabel = (id) => { const c = store.cats().find((x) => x.id === id); return c ? c.label : "Sonstiges"; };

    /* ---------- ein Teil auf der Flaeche ---------- */
    function place(el, p) {
      el.style.setProperty("--x", p.x); el.style.setProperty("--y", p.y); el.style.setProperty("--w", p.w); el.style.setProperty("--z", p.z);
      const rot = el.firstChild; rot.style.setProperty("--r", p.r); rot.style.setProperty("--fx", p.fx || 1);
    }
    function pieceEl(p, label) {
      const el = document.createElement("div"); el.className = "of-co-it" + (p.ghost ? " ghost" : ""); el._p = p;
      el.innerHTML = '<div class="of-co-rot">' + (p.ghost ? '<div class="of-co-ghost"><small>' + esc(p.ghost) + "</small>?</div>" : '<img alt="' + esc(label || "") + '" draggable="false">') + "</div>";
      place(el, p); return el;
    }
    /* Flaeche einmal zeichnen (Liste, Ergebnisse); big = scharfes Foto statt Vorschaubild */
    function paint(cv, o, opts) {
      opts = opts || {}; cv.dataset.bg = o.bg || "paper"; cv.textContent = "";
      (o.items || []).slice().sort((a, b) => a.z - b.z).forEach((p) => {
        if (p.id && !store.byId(p.id)) return;
        const el = pieceEl(p); cv.appendChild(el);
        if (p.id) { const img = el.querySelector("img"); (opts.big ? store.photoURL(p.id) : store.thumbURL(p.id)).then((u) => { if (u && el.isConnected) img.src = u; }).catch(() => {}); }
      });
    }

    /* ---------- Bild erzeugen und teilen ---------- */
    async function toBlob(o) {
      const W = 1080, H = 1350, cvs = document.createElement("canvas"); cvs.width = W; cvs.height = H; const c = cvs.getContext("2d");
      c.fillStyle = BG_HEX[o.bg] || BG_HEX.paper; c.fillRect(0, 0, W, H);
      const list = (o.items || []).filter((p) => p.id && store.byId(p.id)).sort((a, b) => a.z - b.z);
      for (const p of list) {
        const u = (await store.photoURL(p.id).catch(() => null)) || (await store.thumbURL(p.id).catch(() => null)); if (!u) continue;
        const img = await loadImg(u), w = (W * p.w) / 100, h = (w * img.naturalHeight) / img.naturalWidth;
        c.save(); c.shadowColor = "rgba(0,0,0,.28)"; c.shadowOffsetX = W * 0.0055; c.shadowOffsetY = W * 0.008; c.shadowBlur = 0;
        c.translate((W * p.x) / 100, (H * p.y) / 100); c.rotate((p.r * Math.PI) / 180); c.scale(p.fx === -1 ? -1 : 1, 1); c.drawImage(img, -w / 2, -h / 2, w, h); c.restore();
      }
      return new Promise((res) => cvs.toBlob(res, "image/png"));
    }
    async function share(o) {
      let blob = null; try { blob = await toBlob(o); } catch (e) { console.warn(e); }
      if (!blob) return toast("Bild konnte nicht erstellt werden", "warn");
      const base = String(o.name || "outfit").replace(/[^\wäöüÄÖÜß -]+/g, "").trim().replace(/\s+/g, "-") || "outfit", file = new File([blob], base + ".png", { type: "image/png" });
      try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: o.name || "Outfit" }); return; } } catch (e) { if (e && e.name === "AbortError") return; }
      const u = URL.createObjectURL(blob), a = document.createElement("a"); a.href = u; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    }

    /* ==========================================================================
       Editor (Vollbild)
       ========================================================================== */
    function edit(id, preset) {
      const base = id ? store.outfitById(id) : null;
      const o = JSON.parse(JSON.stringify(base || preset || {}));
      o.id = o.id || uid(); o.name = o.name || ""; o.bg = BG_HEX[o.bg] ? o.bg : "paper"; o.items = Array.isArray(o.items) ? o.items : []; o.occ = Array.isArray(o.occ) ? o.occ : []; o.fav = !!o.fav;
      o.items = o.items.filter((p) => !p.id || store.byId(p.id)); /* Teile, die es nicht mehr gibt, fallen weg */
      const isNew = !base; let dirty = isNew && o.items.length > 0, sel = null, armed = 0, pop = null, trayCat = "all";
      const els = new Map(); /* Teil -> Element */
      const ov = document.createElement("div"); ov.className = "of-co"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Outfit");
      ov.innerHTML =
        '<div class="of-co-h"><button type="button" class="of-x" data-a="close" aria-label="Schließen">×</button><input class="of-co-name" maxlength="60" placeholder="Name" aria-label="Name des Outfits">' +
        '<button type="button" class="of-btn of-sm" data-a="more" aria-label="Mehr">' + ic("more", 16) + '</button><button type="button" class="of-btn of-go of-sm" data-a="save">SPEICHERN</button></div>' +
        '<div class="of-co-stage"><div class="of-co-fr"><div class="of-co-cv" data-bg="' + o.bg + '"></div></div></div><div class="of-co-bar" id="coBar"></div>' +
        '<div class="of-co-tray"><div class="of-chips" id="coChips" role="group" aria-label="Filter"></div><div class="of-strip" id="coStrip"></div></div>';
      document.body.appendChild(ov); document.body.classList.add("of-lock");
      const $ = (s) => ov.querySelector(s), cv = $(".of-co-cv"), nameInp = $(".of-co-name"), bar = $("#coBar"), strip = $("#coStrip");
      nameInp.value = o.name;
      nameInp.addEventListener("input", () => { dirty = true; });

      const pieceItem = (p) => (p.id ? store.byId(p.id) : null);
      const slotOfPiece = (p) => (p.id ? store.slotOf((pieceItem(p) || {}).cat) : p.cat ? store.slotOf(p.cat) : "acc");
      const apply = (p) => { const el = els.get(p); if (el) place(el, p); };
      const normZ = () => { o.items.slice().sort((a, b) => a.z - b.z).forEach((p, k) => { p.z = k + 1; apply(p); }); };

      /* Foto in ein Teil laden; fitNew = Breite nach dem Seitenverhaeltnis des Fotos einpassen */
      function addEl(p, fitNew) {
        const it = pieceItem(p); if (p.id && !it) return null;
        const el = pieceEl(p, it ? itemTitle(it) : ""); els.set(p, el); cv.appendChild(el);
        if (p.id) {
          const img = el.querySelector("img");
          img.addEventListener("load", () => { if (fitNew && img.naturalWidth) { const bx = boxOf(slotOfPiece(p)); p.w = clamp(Math.min(bx[0], bx[1] * RATIO * (img.naturalWidth / img.naturalHeight)) * (fitNew === true ? 1 : fitNew), 8, 90); apply(p); } });
          store.photoURL(p.id).then((u) => u || store.thumbURL(p.id)).then((u) => { if (u && el.isConnected) img.src = u; }).catch(() => {});
        }
        return el;
      }
      const boxOf = (slot) => ({ top: [64, 40], mid: [64, 40], outer: [64, 40], dress: [50, 70], bottom: [38, 42], shoes: [52, 15], acc: [20, 15] }[slot] || [40, 30]);
      o.items.forEach((p) => addEl(p, false));
      normZ();

      /* ---------- Auswahl ---------- */
      function setSel(p) {
        if (sel) { const e = els.get(sel); if (e) { e.classList.remove("sel"); e.querySelectorAll(".of-co-hd").forEach((h) => h.remove()); } }
        sel = p || null;
        if (sel) { const e = els.get(sel); if (e) { e.classList.add("sel"); e.firstChild.insertAdjacentHTML("beforeend", '<i class="of-co-hd rt" data-h="rot"></i><i class="of-co-hd sz" data-h="size"></i>'); } }
        renderBar(); renderStrip(true);
      }
      function renderBar() {
        if (!sel) {
          bar.innerHTML = '<span class="of-co-sws" role="group" aria-label="Hintergrund">' + D.BGS.map((k) => '<button type="button" class="of-co-sw' + (o.bg === k ? " on" : "") + '" data-bg="' + k + '" style="--c:' + BG_HEX[k] + '" aria-label="Hintergrund ' + k + '"></button>').join("") + "</span>" +
            '<button type="button" class="of-btn of-sm" data-a="arrange"' + (o.items.length > 1 ? "" : " disabled") + ">ORDNEN</button>";
        } else {
          bar.innerHTML = [["zup", "▲", "Nach vorn"], ["zdn", "▼", "Nach hinten"], ["rot", "↻", "Drehen"], ["flip", "⇄", "Spiegeln"], ["small", "−", "Kleiner"], ["big", "+", "Größer"]].map((b) => '<button type="button" class="of-btn of-sm of-g" data-a="' + b[0] + '" title="' + b[2] + '" aria-label="' + b[2] + '">' + b[1] + "</button>").join("") +
            '<button type="button" class="of-btn of-sm of-bad" data-a="rm" title="Aus dem Outfit nehmen" aria-label="Aus dem Outfit nehmen">' + ic("trash", 14) + "</button>";
        }
      }

      /* ---------- Schrank-Streifen unten ---------- */
      const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); loadTile(e.target); } }), { root: strip, rootMargin: "0px 160px" }) : null;
      function loadTile(img) { store.thumbURL(img.dataset.id).then((u) => { if (u && img.isConnected) { img.src = u; img.classList.add("on"); } }).catch(() => {}); }
      function renderStrip(onlyMarks) {
        const used = new Set(o.items.map((p) => p.id).filter(Boolean));
        if (onlyMarks) { strip.querySelectorAll(".of-st").forEach((b) => { const on = used.has(b.dataset.id); b.classList.toggle("in", on); const m = b.querySelector(".of-b"); if (m) m.hidden = !on; b.classList.toggle("sel", !!(sel && sel.id === b.dataset.id)); }); return; }
        const all = store.items().slice().sort((a, b) => SLOT_IDX.indexOf(store.slotOf(a.cat)) - SLOT_IDX.indexOf(store.slotOf(b.cat)) || b.added - a.added);
        const counts = {}; all.forEach((it) => { const s = store.slotOf(it.cat); counts[s] = (counts[s] || 0) + 1; });
        const slots = SLOT_IDX.filter((s) => counts[s]);
        $("#coChips").innerHTML = slots.length > 1 ? '<button type="button" class="of-chip' + (trayCat === "all" ? " on" : "") + '" data-slot="all">ALLE <i>' + all.length + "</i></button>" + slots.map((s) => '<button type="button" class="of-chip' + (trayCat === s ? " on" : "") + '" data-slot="' + s + '">' + SLOT_PL[s] + " <i>" + counts[s] + "</i></button>").join("") : "";
        const list = trayCat === "all" ? all : all.filter((it) => store.slotOf(it.cat) === trayCat);
        strip.innerHTML = list.length ? list.map((it) => '<button type="button" class="of-st' + (used.has(it.id) ? " in" : "") + '" data-id="' + esc(it.id) + '" title="' + esc(itemTitle(it)) + '" aria-label="' + esc(itemTitle(it)) + '"><span class="of-img"><img alt="" data-id="' + esc(it.id) + '"></span><i class="of-b"' + (used.has(it.id) ? "" : " hidden") + ">" + ic("check", 10) + "</i></button>").join("") : '<span class="of-p of-dim">Noch keine Teile im Schrank.</span>';
        strip.querySelectorAll("img").forEach((im, i) => { if (i < 10 || !io) loadTile(im); else io.observe(im); });
      }

      /* ---------- Teile hinzufuegen und entfernen ---------- */
      function addPiece(it) {
        const slot = store.slotOf(it.cat), ghost = sel && sel.ghost ? sel : null, z = o.items.reduce((m, p) => Math.max(m, p.z), 0) + 1;
        let p;
        if (ghost) { p = { id: it.id, x: ghost.x, y: ghost.y, w: ghost.w, r: ghost.r, z: ghost.z, fx: 1 }; removePiece(ghost, true); }
        else {
          const up = o.items.filter((q) => ["top", "mid", "outer", "dress"].indexOf(slotOfPiece(q)) >= 0).length, accN = o.items.filter((q) => slotOfPiece(q) === "acc").length;
          const SPOTS = [[85, 11], [15, 11], [87, 48], [13, 48], [85, 78], [15, 78]], U = [[50, 28], [38, 30], [62, 30], [30, 34], [70, 34]];
          const pos = slot === "bottom" ? [50, 66] : slot === "shoes" ? [50, 90] : slot === "dress" ? [50, 42] : slot === "acc" ? SPOTS[accN % SPOTS.length] : U[up % U.length];
          p = { id: it.id, x: pos[0], y: pos[1], w: boxOf(slot)[0] * (slot === "acc" ? 1 : 0.8), r: slot === "acc" ? (accN % 2 ? -8 : 10) : up && ["top", "mid", "outer", "dress"].indexOf(slot) >= 0 ? [-6, 5, -3, 4][up % 4] : 0, z, fx: 1 };
        }
        const second = !ghost && ["top", "mid", "outer", "dress"].indexOf(slot) >= 0 && o.items.some((q) => ["top", "mid", "outer", "dress"].indexOf(slotOfPiece(q)) >= 0);
        o.items.push(p); addEl(p, second ? 0.8 : true); normZ(); dirty = true; setSel(p);
      }
      function removePiece(p, silent) {
        const e = els.get(p); if (e) e.remove(); els.delete(p); o.items.splice(o.items.indexOf(p), 1);
        if (sel === p) { sel = null; if (!silent) { renderBar(); renderStrip(true); } }
        dirty = true;
      }

      /* ---------- Ordnen ---------- */
      async function doArrange() {
        const rows = await Promise.all(o.items.map(async (p) => {
          const e = els.get(p), img = e && e.querySelector("img");
          if (img && img.src && !img.complete) await new Promise((res) => { img.addEventListener("load", res, { once: true }); img.addEventListener("error", res, { once: true }); setTimeout(res, 4000); });
          const it = pieceItem(p); return { p, slot: slotOfPiece(p), layer: it ? layerOf(it) : "", ratio: img && img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1 };
        }));
        const res = arrange(rows); cv.classList.add("anim");
        rows.forEach((r, i) => { if (res[i]) Object.assign(r.p, res[i], { fx: 1 }); apply(r.p); });
        setTimeout(() => cv.classList.remove("anim"), 450); dirty = true;
      }

      /* ---------- Zeigen, Ziehen, Zoomen ---------- */
      const pts = new Map(); let g = null;
      const rectOf = () => cv.getBoundingClientRect();
      cv.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button > 0) return;
        const hd = e.target.closest(".of-co-hd"), itEl = e.target.closest(".of-co-it");
        try { cv.setPointerCapture(e.pointerId); } catch (x) { /* egal */ }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); e.preventDefault();
        if (pts.size >= 2 && sel) { const a = Array.from(pts.values()), r = rectOf(); g = { t: "pinch", d0: Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y) || 1, a0: Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x), w0: sel.w, r0: sel.r, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, x0: sel.x, y0: sel.y, rw: r.width, rh: r.height }; return; }
        if (hd && sel) { const b = els.get(sel).getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2; g = { t: hd.dataset.h, id: e.pointerId, cx, cy, a0: Math.atan2(e.clientY - cy, e.clientX - cx), l0: Math.hypot(e.clientX - cx, e.clientY - cy) || 1, w0: sel.w, r0: sel.r }; return; }
        const p = itEl ? itEl._p : null;
        if (p) { if (sel !== p) setSel(p); const r = rectOf(); g = { t: "drag", id: e.pointerId, sx: e.clientX, sy: e.clientY, x0: p.x, y0: p.y, rw: r.width, rh: r.height }; }
        else { if (sel) setSel(null); g = null; }
      });
      cv.addEventListener("pointermove", (e) => {
        if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!g || !sel) return;
        if (g.t === "drag" && e.pointerId === g.id) {
          if (!g.moved && Math.abs(e.clientX - g.sx) + Math.abs(e.clientY - g.sy) < 3) return; g.moved = true; /* ein einfaches Antippen verschiebt nichts */
          sel.x = clamp(g.x0 + ((e.clientX - g.sx) / g.rw) * 100, -10, 110); sel.y = clamp(g.y0 + ((e.clientY - g.sy) / g.rh) * 100, -10, 110);
        }
        else if (g.t === "size" && e.pointerId === g.id) sel.w = clamp((g.w0 * Math.hypot(e.clientX - g.cx, e.clientY - g.cy)) / g.l0, 6, 150);
        else if (g.t === "rot" && e.pointerId === g.id) sel.r = snap(g.r0 + ((Math.atan2(e.clientY - g.cy, e.clientX - g.cx) - g.a0) * 180) / Math.PI);
        else if (g.t === "pinch" && pts.size >= 2) {
          const a = Array.from(pts.values()), d = Math.hypot(a[1].x - a[0].x, a[1].y - a[0].y) || 1;
          sel.w = clamp((g.w0 * d) / g.d0, 6, 150); sel.r = norm(g.r0 + ((Math.atan2(a[1].y - a[0].y, a[1].x - a[0].x) - g.a0) * 180) / Math.PI);
          sel.x = clamp(g.x0 + (((a[0].x + a[1].x) / 2 - g.mx) / g.rw) * 100, -10, 110); sel.y = clamp(g.y0 + (((a[0].y + a[1].y) / 2 - g.my) / g.rh) * 100, -10, 110);
        } else return;
        apply(sel); dirty = true;
      });
      const end = (e) => { pts.delete(e.pointerId); if (g && ((g.t === "pinch" && pts.size < 2) || e.pointerId === g.id)) g = null; };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
      cv.addEventListener("wheel", (e) => { if (!sel) return; e.preventDefault(); if (e.shiftKey) sel.r = norm(sel.r - e.deltaY * 0.15); else sel.w = clamp(sel.w * (e.deltaY < 0 ? 1.06 : 0.94), 6, 150); apply(sel); dirty = true; }, { passive: false });
      cv.addEventListener("contextmenu", (e) => e.preventDefault());

      /* ---------- Leiste, Streifen, Kopf ---------- */
      bar.addEventListener("click", (e) => {
        const sw = e.target.closest("[data-bg]"); if (sw) { o.bg = sw.dataset.bg; cv.dataset.bg = o.bg; dirty = true; return renderBar(); }
        const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
        if (a === "arrange") return doArrange();
        if (!sel) return;
        if (a === "zup" || a === "zdn") { const arr = o.items.slice().sort((x, y) => x.z - y.z), i = arr.indexOf(sel), j = i + (a === "zup" ? 1 : -1); if (j < 0 || j >= arr.length) return; arr[i] = arr[j]; arr[j] = sel; arr.forEach((p, k) => { p.z = k + 1; apply(p); }); }
        else if (a === "rot") sel.r = norm(sel.r + 15);
        else if (a === "flip") sel.fx = sel.fx === -1 ? 1 : -1;
        else if (a === "small") sel.w = clamp(sel.w * 0.9, 6, 150);
        else if (a === "big") sel.w = clamp(sel.w * 1.1, 6, 150);
        else if (a === "rm") { removePiece(sel); return; }
        apply(sel); dirty = true;
      });
      $("#coChips").addEventListener("click", (e) => { const c = e.target.closest("[data-slot]"); if (!c) return; trayCat = c.dataset.slot; renderStrip(); });
      strip.addEventListener("click", (e) => {
        const t = e.target.closest(".of-st"); if (!t) return; const it = store.byId(t.dataset.id); if (!it) return;
        const ex = o.items.find((p) => p.id === it.id); if (ex) setSel(ex); else addPiece(it);
      });

      /* ---------- Speichern, Schliessen, Mehr ---------- */
      let histOn = false; /* die Zurueck-Taste des Handys schliesst den Editor (mit Rueckfrage), statt die App zu verlassen */
      const onPop = () => {
        if (!ov.isConnected) return; histOn = false;
        if (!dirty || Date.now() < armed) return close();
        armed = Date.now() + 3500; toast("Nicht gespeichert. Nochmal zurück zum Verwerfen.", "warn", 3500);
        try { history.pushState({ ofco: 1 }, ""); histOn = true; } catch (e) { /* egal */ }
      };
      function close() {
        window.removeEventListener("popstate", onPop); document.removeEventListener("keydown", onKey); if (io) io.disconnect(); ov.remove(); if (pop) pop.remove();
        if (!document.querySelector(".of-ov, .of-ed")) document.body.classList.remove("of-lock");
        if (histOn) { histOn = false; try { history.back(); } catch (e) { /* egal */ } }
      }
      function tryClose() { if (!dirty || Date.now() < armed) return close(); armed = Date.now() + 3500; toast("Nicht gespeichert. Nochmal tippen zum Verwerfen.", "warn", 3500); }
      async function save() {
        if (!o.items.length) return toast("Leg erst ein Teil auf die Fläche", "warn");
        o.name = nameInp.value.trim() || "Outfit " + (store.outfits().length + (isNew ? 1 : 0));
        await store.putOutfit(Object.assign({}, o, { added: o.added || Date.now() })); dirty = false; toast("Outfit gespeichert", "ok", 2200); close();
      }
      function openMore() {
        if (pop) return; let confirmDel = false;
        pop = document.createElement("div"); pop.className = "of-ov of-top";
        const draw = () => {
          pop.innerHTML = '<div class="of-sheet" role="dialog" aria-modal="true" aria-label="Outfit"><div class="of-sh"><b class="of-px">OUTFIT</b><button type="button" class="of-x" data-a="x" aria-label="Schließen">×</button></div><div class="of-sb">' +
            '<div class="of-fld"><div class="of-lbl">ANLÄSSE</div><div class="of-chips tight">' + store.occs().map((x) => '<button type="button" class="of-chip' + (o.occ.indexOf(x) >= 0 ? " on" : "") + '" data-o="' + esc(x) + '">' + esc(x) + "</button>").join("") + "</div></div>" +
            '<div class="of-flags"><button type="button" class="of-flag' + (o.fav ? " on" : "") + '" data-a="fav">' + ic("heart", 14) + " LIEBLINGSOUTFIT</button></div>" +
            '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="img">' + ic("image", 14) + " ALS BILD</button>" + (isNew ? "" : '<span class="of-sp"></span><button type="button" class="of-btn of-sm of-bad' + (confirmDel ? " armed" : "") + '" data-a="del">' + ic("trash", 14) + (confirmDel ? " WIRKLICH LÖSCHEN?" : " LÖSCHEN") + "</button>") + "</div></div></div>";
        };
        draw(); document.body.appendChild(pop);
        pop.addEventListener("click", async (e) => {
          if (e.target === pop) { pop.remove(); pop = null; return; }
          const x = e.target.closest("[data-a]"), oc = e.target.closest("[data-o]");
          if (oc) { const v = oc.dataset.o, i = o.occ.indexOf(v); if (i >= 0) o.occ.splice(i, 1); else o.occ.push(v); oc.classList.toggle("on"); dirty = true; return; }
          if (!x) return; const a = x.dataset.a;
          if (a === "x") { pop.remove(); pop = null; }
          else if (a === "fav") { o.fav = !o.fav; x.classList.toggle("on", o.fav); dirty = true; }
          else if (a === "img") { x.disabled = true; await share(Object.assign({}, o, { name: nameInp.value.trim() || o.name })); x.disabled = false; }
          else if (a === "del") { if (!confirmDel) { confirmDel = true; draw(); setTimeout(() => { if (pop && confirmDel) { confirmDel = false; draw(); } }, 4000); } else { await store.removeOutfit(o.id); toast("Outfit gelöscht", "ok", 2200); dirty = false; close(); } }
        });
      }
      ov.addEventListener("click", (e) => {
        const b = e.target.closest("[data-a]"); if (!b || b.closest("#coBar")) return; const a = b.dataset.a;
        if (a === "close") tryClose(); else if (a === "save") save(); else if (a === "more") openMore();
      });
      function onKey(e) {
        if (!ov.isConnected) return;
        if (e.key === "Escape") { if (pop) { pop.remove(); pop = null; } else if (sel) setSel(null); else tryClose(); return; }
        if (pop || !sel || /^(INPUT|TEXTAREA|SELECT)$/.test((e.target && e.target.tagName) || "")) return;
        if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removePiece(sel); }
        else if (/^Arrow/.test(e.key)) { e.preventDefault(); const d = e.shiftKey ? 5 : 1; sel.x = clamp(sel.x + (e.key === "ArrowRight" ? d : e.key === "ArrowLeft" ? -d : 0), -10, 110); sel.y = clamp(sel.y + (e.key === "ArrowDown" ? d : e.key === "ArrowUp" ? -d : 0), -10, 110); apply(sel); dirty = true; }
      }
      document.addEventListener("keydown", onKey);
      try { history.pushState({ ofco: 1 }, ""); histOn = true; window.addEventListener("popstate", onPop); } catch (e) { /* egal */ }
      renderBar(); renderStrip();
      return { close, outfit: o, select: (p) => setSel(p), get selected() { return sel; } };
    }

    return { edit, paint, arrange, share, toBlob };
  };
  O.collage.arrange = arrange;
})();
