/* Mein Raum: Minigame. Die Stunden, die du im Zeittracker (Arbeit) und beim Training sammelst, sind das Geld: damit kaufst du Moebel, Deko, Boden, Wandfarbe
   und mehr Platz und richtest einen eigenen isometrischen Pixelraum ein. Guthaben = verdiente Stunden minus alles, was du ausgegeben hast; Verkaufen gibt den vollen
   Preis zurueck, also kannst du frei umbauen. Die Teile (room-items.js) werden von room-iso.js Pixel fuer Pixel gezeichnet.
   Gespeichert wird in der Cloud (Feld "room" in sync-data.json): Raumgroesse, Boden, Wand, alle gekauften Teile mit ihrem Preis und ihrer Position.
   script.js uebergibt dataStore, Auto-Sync, die Stunden (getHours) und Hinweise und ruft applyRemote()/payload() auf. */
(function () {
  "use strict";
  const I = window.RoomIso, R = window.RoomItems;
  if (!I || !R) return;
  const U = I.U;
  const MARGIN = 8, MAX_OWN = 300;
  const GRID_COL = [255, 255, 255, 70];

  const fmt1 = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(".", ",");
  const fmtH = (n) => { const r = Math.round(n * 10) / 10; return (r === Math.round(r) ? String(Math.round(r)) : fmt1(r)); };
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const uid = () => "r" + Date.now().toString(36) + Math.floor(Math.random() * 46656).toString(36);

  /* ---------- Zustand ---------- */
  const emptyState = () => ({ w: R.ROOM.cols0, d: R.ROOM.rows0, floor: "holz", wall: "creme", own: [], sty: {}, grow: [], updatedAt: -1 });
  function sanitize(raw) {
    const out = emptyState();
    out.updatedAt = 0;
    if (!raw || typeof raw !== "object") return out;
    if (isNum(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    if (Array.isArray(raw.grow)) out.grow = raw.grow.filter((p) => isNum(p) && p >= 0).slice(0, R.ROOM.max - R.ROOM.cols0);
    out.w = R.ROOM.cols0 + out.grow.length; out.d = R.ROOM.rows0 + out.grow.length;
    if (raw.sty && typeof raw.sty === "object") Object.keys(raw.sty).forEach((k) => { if (/^(floor|wall):[\w-]+$/.test(k) && isNum(raw.sty[k]) && raw.sty[k] >= 0) out.sty[k] = raw.sty[k]; });
    if (R.FLOORS.some((f) => f.id === raw.floor)) out.floor = raw.floor;
    if (R.WALLS.some((w) => w.id === raw.wall)) out.wall = raw.wall;
    const seen = new Set();
    (Array.isArray(raw.own) ? raw.own : []).slice(0, MAX_OWN).forEach((o) => {
      if (!o || typeof o !== "object" || !R.byId[o.t] || !isNum(o.p) || o.p < 0) return;
      const id = o.i ? String(o.i).slice(0, 24) : uid();
      if (seen.has(id)) return;
      seen.add(id);
      const it = R.byId[o.t], item = { i: id, t: o.t, p: o.p, pl: o.pl ? 1 : 0, f: o.f ? 1 : 0 };
      if (item.pl) {
        if (it.wall) { item.s = Math.max(0, Math.round(isNum(o.s) ? o.s : 0)); } else { item.x = Math.max(0, Math.round(isNum(o.x) ? o.x : 0)); item.y = Math.max(0, Math.round(isNum(o.y) ? o.y : 0)); }
      }
      out.own.push(item);
    });
    return out;
  }

  window.createRoom = function (deps) {
    const { dataStore, scheduleAutoSync, toast } = deps;
    const host = document.getElementById("rmHost");
    if (!host) return null;
    const esc = deps.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const KEY = "dashboard-room-v1";
    const reduced = () => !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches);
    const say = (msg, kind, ms) => { if (toast) toast(msg, kind || "info", ms); };

    let state = emptyState();
    try { const raw = dataStore.getItem(KEY); if (raw) state = sanitize(JSON.parse(raw)); } catch (e) { /* leer starten */ }

    let ready = false, editing = false, sel = null, drag = null, tab = "wohnen";
    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const save = () => { state.updatedAt = Date.now(); persist(); scheduleAutoSync("syncdata"); };

    /* ---------- Stunden ---------- */
    let hoursAt = 0, hoursCache = { work: 0, training: 0 };
    function hours() {
      const now = Date.now();
      if (now - hoursAt > 1500) {
        hoursAt = now;
        try { const h = deps.getHours ? deps.getHours() : null; hoursCache = { work: Math.max(0, (h && h.work) || 0), training: Math.max(0, (h && h.training) || 0) }; } catch (e) { /* Quelle noch nicht bereit */ }
      }
      return hoursCache;
    }
    const spent = () => state.own.reduce((s, o) => s + o.p, 0) + Object.keys(state.sty).reduce((s, k) => s + state.sty[k], 0) + state.grow.reduce((s, p) => s + p, 0);
    const earned = () => { const h = hours(); return h.work + h.training; };
    const balance = () => earned() - spent();

    /* ---------- Teile und Platz ---------- */
    const zr = (it) => {
      if (!it._zr) { let a = Infinity, b = -Infinity; it.model(0).forEach((p) => { if (p.k === "b") { a = Math.min(a, p.z); b = Math.max(b, p.z + p.h); } }); it._zr = [a, b]; }
      return it._zr;
    };
    const fp = (o) => { const it = R.byId[o.t]; return o.f ? { w: it.d, d: it.w } : { w: it.w, d: it.d }; };
    const floorItems = () => state.own.filter((o) => o.pl && !R.byId[o.t].wall);
    const wallItems = () => state.own.filter((o) => o.pl && R.byId[o.t].wall);
    function floorValid(it, x, y, f, ignore) {
      const w = f ? it.d : it.w, d = f ? it.w : it.d;
      if (x < 0 || y < 0 || x + w > state.w || y + d > state.d) return false;
      return !floorItems().some((o) => {
        if (o.i === ignore) return false;
        const jt = R.byId[o.t];
        if (!!jt.flat !== !!it.flat) return false;
        const g = fp(o);
        return x < o.x + g.w && o.x < x + w && y < o.y + g.d && o.y < y + d;
      });
    }
    function wallValid(it, s, f, ignore) {
      const len = f ? state.d : state.w;
      if (s < 0 || s + it.w > len) return false;
      const a = zr(it);
      return !wallItems().some((o) => {
        if (o.i === ignore || o.f !== f) return false;
        const jt = R.byId[o.t], b = zr(jt);
        return s < o.s + jt.w && o.s < s + it.w && a[0] < b[1] && b[0] < a[1];
      });
    }
    function findSpot(it) {
      if (it.wall) {
        for (let f = 0; f < 2; f++) { const len = f ? state.d : state.w; for (let s = 0; s + it.w <= len; s++) if (wallValid(it, s, f, null)) return { s, f }; }
        return null;
      }
      // Teppiche und Matten in die Mitte, alles andere mit dem Ruecken an eine Wand (Vorderseite nach vorn): hinten rechts (f = 0) oder hinten links (f = 1)
      const cand = [];
      for (let f = 0; f < 2; f++) {
        const w = f ? it.d : it.w, d = f ? it.w : it.d;
        for (let y = 0; y + d <= state.d; y++) for (let x = 0; x + w <= state.w; x++) {
          const k = it.flat ? Math.abs(x + w / 2 - state.w / 2) + Math.abs(y + d / 2 - state.d / 2) + f * 0.3 : (f ? x * 3 + y : y * 3 + x) + f * 0.4;
          cand.push({ x, y, f, k });
        }
      }
      cand.sort((a, b) => a.k - b.k);
      for (const c of cand) if (floorValid(it, c.x, c.y, c.f, null)) return { x: c.x, y: c.y, f: c.f };
      return null;
    }

    /* ---------- Bilder ---------- */
    const sprites = new Map();
    function spriteFor(t, f, frame) {
      const key = t + "|" + f + "|" + frame;
      let sp = sprites.get(key);
      if (!sp) {
        const it = R.byId[t];
        let prims = it.model(frame);
        if (f) prims = I.mirror(prims);
        sp = I.render(prims, it.flat ? { outline: true, outlineColor: prims[0].outlineColor } : {});
        sprites.set(key, sp);
      }
      return sp;
    }
    const thumbs = new Map();
    function thumb(it) {
      let url = thumbs.get(it.id);
      if (!url) {
        const sp = spriteFor(it.id, 0, 0), k = sp.w > 110 ? 3 : sp.w > 56 ? 2 : 1;
        const c = document.createElement("canvas");
        c.width = Math.ceil(sp.w / k); c.height = Math.ceil(sp.h / k);
        const x = c.getContext("2d"); x.imageSmoothingEnabled = false; x.drawImage(sp.canvas, 0, 0, c.width, c.height);
        url = c.toDataURL(); thumbs.set(it.id, url);
      }
      return url;
    }
    const swatches = new Map();
    function swatch(kind, st) {
      const key = kind + st.id;
      let url = swatches.get(key);
      if (!url) {
        const c = document.createElement("canvas"); c.width = 44; c.height = 28;
        const x = c.getContext("2d"), im = x.createImageData(44, 28);
        for (let py = 0; py < 28; py++) for (let px = 0; px < 44; px++) {
          const col = kind === "floor" ? (() => { const sx = px - 22, sy = py - 2; const X = (sy + sx / 2) / 2 * 1.6, Y = (sy - sx / 2) / 2 * 1.6; return (X >= 0 && Y >= 0 && X < 40 && Y < 40) ? st.fn(X, Y) : null; })()
            : (() => { if (px < 22) { const r = st.fn(px, 24 - py + 2, px / 2, 24 - py + 2, "L"); return py >= 3 && py < 27 ? r : null; } const r = st.fn(px - 22, 24 - py + 2, (px - 22) / 2, 24 - py + 2, "R"); return py >= 3 && py < 27 ? r : null; })();
          if (!col) continue;
          const rgb = I.rgb(col), shd = kind === "wall" && px < 22 ? I.shade(rgb, -0.3) : rgb, i = (py * 44 + px) * 4;
          im.data[i] = shd[0]; im.data[i + 1] = shd[1]; im.data[i + 2] = shd[2]; im.data[i + 3] = 255;
        }
        x.putImageData(im, 0, 0);
        url = c.toDataURL(); swatches.set(key, url);
      }
      return url;
    }

    /* ---------- Huelle (Boden und Waende) ---------- */
    let shellKey = "", shellSp = null;
    function shell() {
      const key = state.w + "x" + state.d + ":" + state.floor + ":" + state.wall;
      if (key !== shellKey) {
        const F = R.FLOORS.find((f) => f.id === state.floor), Wl = R.WALLS.find((w) => w.id === state.wall);
        shellSp = I.renderShell({ cols: state.w, rows: state.d, wallH: R.ROOM.wallH, slab: R.ROOM.slab, wallColor: Wl.color, slabColor: "#5a4a58", floorFn: F.fn, wallFn: Wl.fn });
        shellKey = key; gridSp = null;
      }
      return shellSp;
    }
    // Pixelbilder fuer Raster und Markierungen auf dem Boden (Rechteck in Einheiten, Farbe RGBA)
    const quadCache = new Map();
    function quadImage(Wu, Du, rgba, edge) {
      const key = Wu + "x" + Du + ":" + rgba.join(",") + ":" + (edge || 0);
      let im = quadCache.get(key);
      if (!im) {
        const pts = [[0, 0], [Wu, 0], [Wu, Du], [0, Du]].map((p) => [I.PX(p[0], p[1]), I.PY(p[0], p[1], 0)]);
        const x0 = Math.floor(Math.min(...pts.map((p) => p[0]))), y0 = Math.floor(Math.min(...pts.map((p) => p[1])));
        const x1 = Math.ceil(Math.max(...pts.map((p) => p[0]))), y1 = Math.ceil(Math.max(...pts.map((p) => p[1])));
        const Rr = new I.Raster(x0, y0, x1 - x0, y1 - y0);
        I.fillPoly(Rr, pts, (px, py, cx, cy) => {
          if (edge) { const X = (cy + cx / 2) / 2, Y = (cy - cx / 2) / 2; if (!(X < edge || Y < edge || X > Wu - edge || Y > Du - edge)) return null; }
          return [rgba[0], rgba[1], rgba[2]];
        });
        for (let i = 3; i < Rr.data.length; i += 4) if (Rr.data[i]) Rr.data[i] = rgba[3];
        const c = document.createElement("canvas"); c.width = Rr.w; c.height = Rr.h;
        c.getContext("2d").putImageData(new ImageData(Rr.data, Rr.w, Rr.h), 0, 0);
        im = { canvas: c, ox: -x0, oy: -y0 }; quadCache.set(key, im);
      }
      return im;
    }
    let gridSp = null;
    function grid() {
      if (!gridSp) {
        const cols = state.w, rows = state.d;
        const x0 = -rows * 16, y0 = 0, w = (cols + rows) * 16, h = (cols + rows) * 8;
        const Rr = new I.Raster(x0, y0, w, h);
        for (let py = y0; py < y0 + h; py++) for (let px = x0; px < x0 + w; px++) {
          const cx = px + 0.5, cy = py + 0.5, X = (cy + cx / 2) / 2, Y = (cy - cx / 2) / 2;
          if (X < 0 || Y < 0 || X >= cols * U || Y >= rows * U) continue;
          if ((X % U) < 0.5 || (Y % U) < 0.5) Rr.set(px, py, GRID_COL);
        }
        for (let i = 3; i < Rr.data.length; i += 4) if (Rr.data[i]) Rr.data[i] = GRID_COL[3];
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        c.getContext("2d").putImageData(new ImageData(Rr.data, w, h), 0, 0);
        gridSp = { canvas: c, ox: -x0, oy: -y0 };
      }
      return gridSp;
    }

    /* ---------- Oberflaeche ---------- */
    host.innerHTML = '<div class="rm">' +
      '<div class="rm-top"><div class="rm-bal" id="rmBal"></div><button type="button" class="rm-edit" id="rmEdit" aria-pressed="false">EINRICHTEN</button></div>' +
      '<div class="rm-main">' +
      '<div class="rm-stage" id="rmStage"><canvas id="rmCv" class="rm-cv" tabindex="0" role="img" aria-label="Dein Raum"></canvas>' +
      '<div class="rm-hint" id="rmHint"></div><div class="rm-sel" id="rmSel" hidden></div></div>' +
      '<div class="rm-shop"><div class="rm-tabs" id="rmTabs" role="tablist" aria-label="Katalog"></div><ul class="rm-list" id="rmList"></ul></div>' +
      '</div>' +
      '<details class="rm-how"><summary>So funktioniert es</summary><p>Jede Stunde, die du im Zeittracker erfasst (Arbeit) oder beim Training sammelst, ist eine Stunde zum Ausgeben. Damit kaufst du Teile und stellst sie in deinen Raum. ' +
      'Unter <b>Einrichten</b> ziehst du Teile an einen neuen Platz, drehst sie oder legst sie ins Lager. <b>Verkaufen</b> gibt den vollen Preis zurück, du kannst also jederzeit umbauen. Das Guthaben wächst mit jeder weiteren Stunde.</p></details></div>';
    const $ = (id) => host.querySelector("#" + id);
    const cv = $("rmCv"), ctx = cv.getContext("2d"), stage = $("rmStage"), listEl = $("rmList"), tabsEl = $("rmTabs"), balEl = $("rmBal"), selEl = $("rmSel"), editBtn = $("rmEdit"), hintEl = $("rmHint");
    ctx.imageSmoothingEnabled = false;
    let ORG = { x: 0, y: 0 }, drawList = [], viewScale = 1, lastFrameKey = "";

    const project = (X, Y, Z) => ({ x: ORG.x + I.PX(X, Y), y: ORG.y + I.PY(X, Y, Z || 0) });
    function layout() {
      const sh = shell(), W = sh.w + 2 * MARGIN, H = sh.h + 2 * MARGIN;
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; ctx.imageSmoothingEnabled = false; }
      ORG = { x: MARGIN + sh.ox, y: MARGIN + sh.oy };
      const avail = Math.max(240, stage.clientWidth || 600), k = avail / W;
      viewScale = Math.min(4, k >= 2 ? Math.floor(k) : k);
      cv.style.width = Math.round(W * viewScale) + "px";
    }

    function frameOf(o, it) {
      if (!(it.frames > 1) || reduced()) return 0;
      let ph = 0; for (let c = 0; c < o.i.length; c++) ph = (ph * 31 + o.i.charCodeAt(c)) % 97;
      return Math.floor(performance.now() / 1000 * it.fps + ph) % it.frames;
    }
    function origin(o, it) { return it.wall ? { X: o.f ? 0 : o.s * U, Y: o.f ? o.s * U : 0 } : { X: o.x * U, Y: o.y * U }; }
    function drawSprite(o, alpha, outline) {
      const it = R.byId[o.t], sp = spriteFor(o.t, o.f, frameOf(o, it)), p = origin(o, it);
      const dx = ORG.x + I.PX(p.X, p.Y) - sp.ox, dy = ORG.y + I.PY(p.X, p.Y, 0) - sp.oy;
      if (outline) { if (!sp.hi || sp.hiColor !== outline) { sp.hi = I.silhouette(sp, outline); sp.hiColor = outline; } ctx.drawImage(sp.hi.canvas, dx - 1, dy - 1); }
      if (alpha != null) ctx.globalAlpha = alpha;
      ctx.drawImage(sp.canvas, dx, dy);
      ctx.globalAlpha = 1;
      return { o, sp, dx, dy };
    }
    function sortSolid(list) {
      const info = list.map((o) => { const g = fp(o); return { o, x0: o.x, y0: o.y, x1: o.x + g.w, y1: o.y + g.d }; });
      info.sort((a, b) => (a.x0 + a.y0) - (b.x0 + b.y0) || a.x0 - b.x0);
      const behind = (a, b) => (a.x1 <= b.x0 && a.y0 < b.y1 && b.y0 < a.y1) || (a.y1 <= b.y0 && a.x0 < b.x1 && b.x0 < a.x1);
      const out = [], mark = new Map();
      const visit = (n) => {
        if (mark.get(n)) return;
        mark.set(n, 1);
        info.forEach((m) => { if (m !== n && behind(m, n)) visit(m); });
        out.push(n);
      };
      info.forEach(visit);
      return out.map((n) => n.o);
    }

    function draw() {
      if (!ready) return;
      layout();
      ctx.clearRect(0, 0, cv.width, cv.height);
      ctx.imageSmoothingEnabled = false;
      const sh = shell();
      ctx.drawImage(sh.canvas, ORG.x - sh.ox, ORG.y - sh.oy);
      drawList = [];
      const dragging = drag && drag.moved ? drag : null;
      const ghostId = dragging ? dragging.id : null;
      wallItems().forEach((o) => { if (o.i !== ghostId) drawList.push(drawSprite(o, null, sel === o.i && editing ? "#f4c542" : null)); });
      if (editing) { const g = grid(); ctx.drawImage(g.canvas, ORG.x - g.ox, ORG.y - g.oy); }
      if (dragging && dragging.kind === "floor") {
        const it = R.byId[dragging.o.t], g = dragging.f ? { w: it.d, d: it.w } : { w: it.w, d: it.d };
        const q = quadImage(g.w * U, g.d * U, dragging.valid ? [80, 210, 120, 120] : [235, 80, 80, 130]);
        const P = project(dragging.x * U, dragging.y * U, 0);
        ctx.drawImage(q.canvas, P.x - q.ox, P.y - q.oy);
      }
      const solid = floorItems().filter((o) => o.i !== ghostId);
      solid.filter((o) => R.byId[o.t].flat).sort((a, b) => (a.x + a.y) - (b.x + b.y)).forEach((o) => { drawList.push(drawSprite(o, null, sel === o.i && editing ? "#f4c542" : null)); });
      sortSolid(solid.filter((o) => !R.byId[o.t].flat)).forEach((o) => {
        const g = fp(o), q = quadImage(g.w * U + 2, g.d * U + 2, [10, 6, 24, 70]), P = project(o.x * U + 2, o.y * U + 2, 0);
        ctx.drawImage(q.canvas, P.x - q.ox, P.y - q.oy);
        drawList.push(drawSprite(o, null, sel === o.i && editing ? "#f4c542" : null));
      });
      if (dragging) {
        const o = Object.assign({}, dragging.o, dragging.kind === "wall" ? { s: dragging.s, f: dragging.f } : { x: dragging.x, y: dragging.y, f: dragging.f });
        drawSprite(o, 0.8, dragging.valid ? "#6fe38a" : "#ff6a6a");
      }
      const cnt = state.own.filter((o) => o.pl).length;
      cv.setAttribute("aria-label", "Dein Raum, " + state.w + " mal " + state.d + " Felder, " + cnt + " Teile" + (editing ? ". Einrichten ist an: Teile antippen und ziehen, mit den Pfeiltasten verschieben, R dreht, Entf legt ins Lager." : ""));
    }
    let raf = 0;
    const redraw = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; draw(); }); };

    /* ---------- Kopfzeile, Auswahl, Katalog ---------- */
    function renderBal() {
      const h = hours(), bal = balance();
      balEl.innerHTML = '<span class="rm-bn' + (bal < -0.05 ? " neg" : "") + '">' + fmt1(bal) + ' h</span><span class="rm-bl">zum Ausgeben</span><span class="rm-bs">· ' + fmtH(spent()) + ' h verbaut</span>';
      balEl.title = "Verdient: Arbeit " + fmt1(h.work) + " h + Training " + fmt1(h.training) + " h = " + fmt1(h.work + h.training) + " h. Ausgegeben: " + fmt1(spent()) + " h.";
    }
    function renderHint() {
      const placed = state.own.filter((o) => o.pl).length;
      hintEl.hidden = !(placed === 0 && !editing);
      hintEl.textContent = state.own.length === 0 ? "Dein Raum ist noch leer. Such dir unten etwas aus, dann kannst du es unter „Einrichten“ an seinen Platz ziehen." : "";
      if (state.own.length) hintEl.hidden = true;
    }
    function renderSel() {
      const o = editing && sel ? state.own.find((x) => x.i === sel) : null;
      selEl.hidden = !o;
      if (!o) return;
      const it = R.byId[o.t];
      selEl.innerHTML = '<b>' + esc(it.name) + '</b><small>' + (it.wall ? it.w + " breit, Wand" : it.w + "×" + it.d + " Felder") + ' · bezahlt ' + fmtH(o.p) + ' h</small>' +
        '<span class="rm-sbtns"><button type="button" class="rm-b" data-act="rot">DREHEN</button><button type="button" class="rm-b" data-act="store">INS LAGER</button><button type="button" class="rm-b rm-sell" data-act="sell">VERKAUFEN +' + fmtH(o.p) + ' h</button></span>';
    }
    const TABS = R.CATS.map((c) => ({ id: c.id, name: c.name })).concat([{ id: "raum", name: "Raum" }, { id: "lager", name: "Lager" }]);
    function renderTabs() {
      const stock = state.own.filter((o) => !o.pl).length;
      tabsEl.innerHTML = TABS.map((t) => '<button type="button" role="tab" class="rm-tab" data-tab="' + t.id + '" aria-selected="' + (t.id === tab) + '">' + esc(t.name) + (t.id === "lager" && stock ? " (" + stock + ")" : "") + "</button>").join("");
    }
    function pill(price, id, kind) {
      const need = price - balance();
      return need <= 1e-9 ? '<button type="button" class="rm-pill buy" data-' + kind + '="' + id + '">' + fmtH(price) + " h</button>" : '<span class="rm-pill need">noch ' + fmt1(need) + " h</span>";
    }
    function renderList() {
      let html = "";
      if (tab === "lager") {
        const st = state.own.filter((o) => !o.pl);
        html = st.length ? st.map((o) => { const it = R.byId[o.t]; return '<li class="rm-row"><img class="rm-th" src="' + thumb(it) + '" alt=""><div class="rm-info"><b>' + esc(it.name) + '</b><small>im Lager · bezahlt ' + fmtH(o.p) + ' h</small></div><span class="rm-acts"><button type="button" class="rm-b" data-place="' + o.i + '">AUFSTELLEN</button><button type="button" class="rm-b rm-sell" data-sell="' + o.i + '">+' + fmtH(o.p) + ' h</button></span></li>'; }).join("") : '<li class="rm-empty">Das Lager ist leer. Teile, die du „ins Lager“ legst, landen hier.</li>';
      } else if (tab === "raum") {
        const next = state.grow.length, maxed = state.w >= R.ROOM.max, gp = R.GROW[next];
        html = '<li class="rm-hd">Fläche</li><li class="rm-row"><div class="rm-sw rm-sw-grow"></div><div class="rm-info"><b>Raum vergrößern</b><small>' + (maxed ? "größer geht es nicht" : state.w + "×" + state.d + " → " + (state.w + 1) + "×" + (state.d + 1) + " Felder") + "</small></div>" + (maxed ? '<span class="rm-pill need">fertig</span>' : pill(gp, "grow", "grow")) + "</li>";
        [["floor", "Boden", R.FLOORS], ["wall", "Wandfarbe", R.WALLS]].forEach(([kind, label, list]) => {
          html += '<li class="rm-hd">' + label + "</li>";
          html += list.map((st) => {
            const owned = st.price === 0 || (kind + ":" + st.id) in state.sty, on = state[kind] === st.id;
            return '<li class="rm-row"><img class="rm-sw" src="' + swatch(kind, st) + '" alt=""><div class="rm-info"><b>' + esc(st.name) + "</b><small>" + (on ? "aktiv" : owned ? "im Besitz" : "") + "</small></div>" +
              (on ? '<span class="rm-pill on">aktiv</span>' : owned ? '<button type="button" class="rm-pill buy" data-style="' + kind + ":" + st.id + '">wählen</button>' : pill(st.price, kind + ":" + st.id, "style")) + "</li>";
          }).join("");
        });
      } else {
        const list = R.ITEMS.filter((it) => it.cat === tab).sort((a, b) => a.price - b.price);
        html = list.map((it) => {
          const have = state.own.filter((o) => o.t === it.id).length;
          return '<li class="rm-row"><img class="rm-th" src="' + thumb(it) + '" alt=""><div class="rm-info"><b>' + esc(it.name) + "</b><small>" + (it.wall ? it.w + " breit, Wand" : it.w + "×" + it.d + " Felder") + (have ? " · " + have + "× im Besitz" : "") + "</small></div>" + pill(it.price, it.id, "buy") + "</li>";
        }).join("");
      }
      listEl.innerHTML = html;
    }
    function renderAll() {
      if (!ready) return;
      renderBal(); renderHint(); renderSel(); renderTabs(); renderList();
      editBtn.textContent = editing ? "FERTIG" : "EINRICHTEN";
      editBtn.setAttribute("aria-pressed", String(editing));
      stage.classList.toggle("editing", editing);
      draw();
      updateAnim();
    }

    /* ---------- Aktionen ---------- */
    function startEditing() { editing = true; renderAll(); }
    function buy(id) {
      const it = R.byId[id];
      if (!it) return;
      if (balance() < it.price - 1e-9) { say("Dafür fehlen noch " + fmt1(it.price - balance()) + " h.", "warn"); return; }
      if (state.own.length >= MAX_OWN) { say("Mehr als " + MAX_OWN + " Teile sind zu viel.", "warn"); return; }
      const o = { i: uid(), t: id, p: it.price, pl: 0, f: 0 };
      state.own.push(o);
      const spot = findSpot(it);
      if (spot) { Object.assign(o, spot, { pl: 1 }); sel = o.i; }
      save();
      say(it.name + (spot ? " gekauft" : " liegt im Lager, kein Platz frei") + " (−" + fmtH(it.price) + " h)", spot ? "ok" : "warn", 2600);
      if (spot) { editing = true; }
      renderAll();
    }
    function sell(oid) {
      const k = state.own.findIndex((o) => o.i === oid);
      if (k < 0) return;
      const o = state.own[k], it = R.byId[o.t];
      state.own.splice(k, 1);
      if (sel === oid) sel = null;
      save(); renderAll();
      say(it.name + " verkauft (+" + fmtH(o.p) + " h)", "ok", 2600);
    }
    function store(oid) {
      const o = state.own.find((x) => x.i === oid);
      if (!o || !o.pl) return;
      o.pl = 0; delete o.x; delete o.y; delete o.s;
      if (sel === oid) sel = null;
      save(); renderAll();
    }
    function place(oid) {
      const o = state.own.find((x) => x.i === oid);
      if (!o || o.pl) return;
      const spot = findSpot(R.byId[o.t]);
      if (!spot) { say("Im Raum ist kein Platz frei.", "warn"); return; }
      Object.assign(o, spot, { pl: 1 });
      sel = o.i; editing = true;
      save(); renderAll();
    }
    function rotate(oid) {
      const o = state.own.find((x) => x.i === oid);
      if (!o || !o.pl) return;
      const it = R.byId[o.t], nf = o.f ? 0 : 1;
      if (it.wall) {
        const len = nf ? state.d : state.w;
        const order = [Math.min(o.s, len - it.w)]; for (let d = 1; d < len; d++) { order.push(o.s - d, o.s + d); }
        const s = order.find((v) => v >= 0 && wallValid(it, v, nf, o.i));
        if (s === undefined) { say("Auf der anderen Wand ist kein Platz.", "warn"); return; }
        o.f = nf; o.s = s;
      } else {
        const tries = [[0, 0], [-1, 0], [0, -1], [1, 0], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1], [-2, 0], [0, -2], [2, 0], [0, 2]];
        const t = tries.find((d) => floorValid(it, o.x + d[0], o.y + d[1], nf, o.i));
        if (!t) { say("Zum Drehen ist hier kein Platz.", "warn"); return; }
        o.f = nf; o.x += t[0]; o.y += t[1];
      }
      save(); renderAll();
    }
    function growRoom() {
      if (state.w >= R.ROOM.max) return;
      const price = R.GROW[state.grow.length];
      if (balance() < price - 1e-9) { say("Dafür fehlen noch " + fmt1(price - balance()) + " h.", "warn"); return; }
      state.grow.push(price); state.w = R.ROOM.cols0 + state.grow.length; state.d = R.ROOM.rows0 + state.grow.length;
      save(); renderAll();
      say("Dein Raum ist jetzt " + state.w + "×" + state.d + " Felder groß (−" + fmtH(price) + " h)", "ok");
    }
    function buyStyle(key) {
      const [kind, id] = key.split(":"), list = kind === "floor" ? R.FLOORS : R.WALLS, st = list.find((s) => s.id === id);
      if (!st) return;
      if (st.price > 0 && !(key in state.sty)) {
        if (balance() < st.price - 1e-9) { say("Dafür fehlen noch " + fmt1(st.price - balance()) + " h.", "warn"); return; }
        state.sty[key] = st.price;
        say(st.name + " gekauft (−" + fmtH(st.price) + " h)", "ok");
      }
      state[kind] = id;
      save(); renderAll();
    }

    /* ---------- Zeigen und Ziehen ---------- */
    function pointerPos(e) {
      const r = cv.getBoundingClientRect();
      return { x: (e.clientX - r.left) * cv.width / r.width, y: (e.clientY - r.top) * cv.height / r.height };
    }
    function hit(p) {
      for (let k = drawList.length - 1; k >= 0; k--) {
        const d = drawList[k], lx = Math.floor(p.x - d.dx), ly = Math.floor(p.y - d.dy);
        if (lx < 0 || ly < 0 || lx >= d.sp.w || ly >= d.sp.h) continue;
        if (d.sp.data[(ly * d.sp.w + lx) * 4 + 3] > 20) return d.o;
      }
      return null;
    }
    function wallPos(p) {
      const sx = p.x - ORG.x, side = sx >= 0 ? 0 : 1, t = (side === 0 ? sx / 2 : -sx / 2) / U;
      return { side, t };
    }
    function onDown(e) {
      if (!editing || e.button > 0) return;
      cv.focus({ preventScroll: true });
      const p = pointerPos(e), o = hit(p);
      if (!o) { sel = null; renderSel(); redraw(); return; }
      sel = o.i;
      const it = R.byId[o.t];
      drag = { id: o.i, o, kind: it.wall ? "wall" : "floor", sx: p.x, sy: p.y, moved: false, start: { x: o.x, y: o.y, f: o.f, s: o.s }, x: o.x, y: o.y, f: o.f, s: o.s, valid: true, pid: e.pointerId };
      if (it.wall) { const w = wallPos(p); drag.off = (o.f === w.side ? o.s + it.w / 2 - w.t : 0); }
      else { const g = fp(o), c = project((o.x + g.w / 2) * U, (o.y + g.d / 2) * U, 0); drag.offX = c.x - p.x; drag.offY = c.y - p.y; }
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      renderSel(); redraw();
      e.preventDefault();
    }
    function onMove(e) {
      const p = pointerPos(e);
      if (!drag) {
        if (editing) cv.style.cursor = hit(p) ? "grab" : "default";
        return;
      }
      if (!drag.moved && Math.hypot(p.x - drag.sx, p.y - drag.sy) < 3) return;
      drag.moved = true;
      cv.style.cursor = "grabbing";
      const it = R.byId[drag.o.t];
      if (drag.kind === "wall") {
        const w = wallPos(p), len = w.side ? state.d : state.w;
        let s = Math.round(w.t + drag.off - it.w / 2);
        s = Math.max(0, Math.min(len - it.w, s));
        drag.f = w.side; drag.s = s; drag.valid = wallValid(it, s, w.side, drag.id);
      } else {
        const tx = p.x + drag.offX - ORG.x, ty = p.y + drag.offY - ORG.y, X = (ty + tx / 2) / 2, Y = (ty - tx / 2) / 2;
        const w = drag.f ? it.d : it.w, d = drag.f ? it.w : it.d;
        let x = Math.round(X / U - w / 2), y = Math.round(Y / U - d / 2);
        x = Math.max(0, Math.min(state.w - w, x)); y = Math.max(0, Math.min(state.d - d, y));
        drag.x = x; drag.y = y; drag.valid = floorValid(it, x, y, drag.f, drag.id);
      }
      redraw();
    }
    function onUp(e) {
      if (!drag) return;
      const d = drag; drag = null;
      try { cv.releasePointerCapture(d.pid); } catch (err) { /* egal */ }
      cv.style.cursor = "default";
      if (d.moved && d.valid) {
        if (d.kind === "wall") { d.o.s = d.s; d.o.f = d.f; } else { d.o.x = d.x; d.o.y = d.y; }
        save();
      }
      renderSel(); redraw();
    }
    cv.addEventListener("pointerdown", onDown);
    cv.addEventListener("pointermove", onMove);
    cv.addEventListener("pointerup", onUp);
    cv.addEventListener("pointercancel", () => { drag = null; redraw(); });
    cv.addEventListener("keydown", (e) => {
      if (!editing) return;
      const o = sel ? state.own.find((x) => x.i === sel) : null;
      const placed = state.own.filter((x) => x.pl);
      if (e.key === "Escape") { sel = null; renderSel(); redraw(); return; }
      if ((e.key === "[" || e.key === "]") && placed.length) {
        const k = placed.findIndex((x) => x.i === sel), n = (k + (e.key === "]" ? 1 : -1) + placed.length) % placed.length;
        sel = placed[n].i; renderSel(); redraw(); e.preventDefault(); return;
      }
      if (!o || !o.pl) return;
      const it = R.byId[o.t];
      if (e.key === "r" || e.key === "R") { rotate(o.i); e.preventDefault(); return; }
      if (e.key === "Delete" || e.key === "Backspace") { store(o.i); e.preventDefault(); return; }
      const mv = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowDown: [0, 1], ArrowUp: [0, -1] }[e.key];
      if (!mv) return;
      e.preventDefault();
      if (it.wall) { const s = o.s + mv[0] + mv[1]; if (wallValid(it, s, o.f, o.i)) { o.s = s; save(); redraw(); } }
      else if (floorValid(it, o.x + mv[0], o.y + mv[1], o.f, o.i)) { o.x += mv[0]; o.y += mv[1]; save(); redraw(); }
    });

    host.addEventListener("click", (e) => {
      const t = e.target.closest("button, [data-tab]");
      if (!t) return;
      if (t === editBtn) { editing = !editing; if (!editing) sel = null; renderAll(); return; }
      if (t.dataset.tab) { tab = t.dataset.tab; renderTabs(); renderList(); return; }
      if (t.dataset.buy) { buy(t.dataset.buy); return; }
      if (t.dataset.grow !== undefined) { growRoom(); return; }
      if (t.dataset.style) { buyStyle(t.dataset.style); return; }
      if (t.dataset.place) { place(t.dataset.place); return; }
      if (t.dataset.sell) { sell(t.dataset.sell); return; }
      const act = t.dataset.act;
      if (act === "rot" && sel) rotate(sel);
      else if (act === "store" && sel) store(sel);
      else if (act === "sell" && sel) sell(sel);
    });

    /* ---------- Bewegung (Fernseher, Kamin, Fische ...), nur solange sichtbar ---------- */
    let timer = 0, visible = true;
    function animated() { return state.own.some((o) => o.pl && R.byId[o.t].frames > 1); }
    function updateAnim() {
      const want = animated() && visible && !document.hidden && !reduced();
      if (want && !timer) timer = setInterval(() => { if (!drag) draw(); }, 200);
      else if (!want && timer) { clearInterval(timer); timer = 0; }
    }
    if ("IntersectionObserver" in window) new IntersectionObserver((es) => { visible = es[0].isIntersecting; updateAnim(); }).observe(cv);
    document.addEventListener("visibilitychange", updateAnim);
    if ("ResizeObserver" in window) new ResizeObserver(() => { if (ready) redraw(); }).observe(stage);
    setInterval(() => { if (ready && visible && !document.hidden) { renderBal(); const k = balance().toFixed(1); if (k !== lastFrameKey) { lastFrameKey = k; renderList(); } } }, 5000);

    // Nur fuer Tests im Browser (Adresse mit ?roomdebug=1 oeffnen): Zugriff auf Zustand und Hilfsfunktionen
    if (window.__roomDebug || /[?&]roomdebug/.test(location.search)) window.__room = { get state() { return state; }, project, hit, floorValid, wallValid, buy, sell, store, place, rotate, redraw, get ORG() { return ORG; }, save, renderAll };

    return {
      start() { ready = true; renderAll(); },
      render: renderAll,
      open() { ready = true; if (deps.expand) deps.expand("raum"); renderAll(); const s = document.getElementById("raum"); if (s) s.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }); },
      metric() { return ready ? fmtH(balance()) + " H ZUM AUSGEBEN" : ""; },
      balance, spent, earned,
      // Cloud-Stand uebernehmen: der neuere Zeitstempel gewinnt (ganzer Raum)
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote);
        if (r.updatedAt > state.updatedAt) { state = r; shellKey = ""; if (sel && !state.own.some((o) => o.i === sel)) sel = null; persist(); renderAll(); }
        else if (state.updatedAt > r.updatedAt) scheduleAutoSync("syncdata");
      },
      // Solange nie etwas gekauft wurde, bleibt das Feld ganz weg
      payload() {
        if (!state.own.length && !state.grow.length && !Object.keys(state.sty).length && state.floor === "holz" && state.wall === "creme") return null;
        return { w: state.w, d: state.d, floor: state.floor, wall: state.wall, own: state.own, sty: state.sty, grow: state.grow, updatedAt: Math.max(0, state.updatedAt) };
      }
    };
  };
})();
