/* Pixel-Gaeste (Version 3): Figuren und Dinge aus Filmen, Serien und Spielen stehen als Easter Eggs im Dashboard und kommen mit hoeheren Levels dazu.
   - Daten: guests-data.js (window.GUESTS_DATA: Sprites, Freischalt-Level, Level-Themen; erzeugt von build_guests.py)
   - Level-Themen: jedes Level schaltet ein Thema frei (Welt fuer Welt: Figuren, dann Symbole und Dinge), siehe THEMES in build_guests.py.
   - Plaetze: das Layout wird gemessen (Text, Knoepfe, Bilder = belegt, alles andere frei). Auf den freien Stellen entstehen so viele Plaetze wie moeglich: stehend auf den
     Oberkanten der Karten, in ihren unteren Ecken, in Luecken zwischen Karten und am Seitenrand. Kein Platz verdeckt etwas; jeder Platz kann leer bleiben.
   - Skilltree: Klick auf die Level-Anzeige oben zeigt alle Level mit ihren Themen, freigeschaltete und gesperrte Gaeste und die Easter Eggs des Bildes.
   - Tauschen: Klick auf einen Gast oeffnet die Auswahl aller freigeschalteten Gaeste (oder "leer lassen"); im Bearbeiten-Modus zeigen leere Plaetze ein Plus.
   - Gespeichert wird nichts in der Cloud, nur im Browser (pro Geraet, weil das Layout je Geraet anders ist): dashboard-guests-seen, dashboard-guests-off, dashboard-guests-v2.
   - Bewegung nur fuer Gaeste im sichtbaren Bereich, ca. 12 Bilder pro Sekunde; prefers-reduced-motion: ruhige Standbilder. */
(function () {
  "use strict";

  /* ---------- Sprite-Spieler (wie in der Galerie): Bild zum Zeitpunkt t (ms) ---------- */
  function spriteKey(s, t, off) {
    var an = s.an; if (!an) return "";
    var key = "";
    for (var i = 0; i < an.length; i++) {
      var tr = an[i], tt = (((t + (off || 0) + (tr.o || 0)) % tr.p) + tr.p) % tr.p, L, j, e;
      if ((L = tr.set)) for (j = 0; j < L.length; j++) { e = L[j]; if (tt >= e[0] && tt < e[1]) key += i + "s" + j + ","; }
      if ((L = tr.col)) for (j = 0; j < L.length; j++) { e = L[j]; if (tt >= e[0] && tt < e[1]) key += i + "c" + j + ","; }
      if ((L = tr.mv)) for (j = 0; j < L.length; j++) { e = L[j]; if (tt >= e[0] && tt < e[1] && (e[4] || e[5])) key += i + "m" + j + ","; }
    }
    return key;
  }
  function spriteFrame(s, t, off) {
    var rows = s.rows, h = rows.length, w = rows[0].length, g = null, pal = s.pal, cp = null, an = s.an || [], i, j, e, L, tr, tt;
    function grid() { return g || (g = rows.map(function (r) { return r.split(""); })); }
    for (i = 0; i < an.length; i++) {
      tr = an[i]; tt = (((t + (off || 0) + (tr.o || 0)) % tr.p) + tr.p) % tr.p;
      if ((L = tr.set)) for (j = 0; j < L.length; j++) { e = L[j]; if (tt >= e[0] && tt < e[1]) { grid(); e[2].forEach(function (c) { g[c[1]][c[0]] = c[2]; }); } }
      if ((L = tr.col)) for (j = 0; j < L.length; j++) { e = L[j]; if (tt >= e[0] && tt < e[1]) { cp = cp || Object.assign({}, pal); for (var k in e[2]) cp[k] = e[2][k]; } }
    }
    for (i = 0; i < an.length; i++) {
      tr = an[i]; tt = (((t + (off || 0) + (tr.o || 0)) % tr.p) + tr.p) % tr.p;
      if ((L = tr.mv)) for (j = 0; j < L.length; j++) {
        e = L[j];
        if (tt >= e[0] && tt < e[1] && (e[4] || e[5])) {
          grid();
          var band = [], y, x;
          for (y = e[2]; y <= e[3] && y < h; y++) { band.push(g[y]); g[y] = new Array(w).fill("."); }
          for (y = 0; y < band.length; y++) {
            var ty = e[2] + y + e[5]; if (ty < 0 || ty >= h) continue;
            for (x = 0; x < w; x++) { var tx = x + e[4]; if (tx < 0 || tx >= w) continue; if (band[y][x] !== ".") g[ty][tx] = band[y][x]; }
          }
        }
      }
    }
    return { g: grid(), pal: cp || pal };
  }
  /* k = Geraetepixel pro Bildpunkt (ganze Zahl, damit alle Pixel gleich gross sind), dpr = Geraetepixel pro CSS-Pixel */
  function drawSprite(cv, s, k, dpr, t, off, sil) {
    var f = spriteFrame(s, t || 0, off), w = s.w, h = s.h;
    if (cv.width !== w * k || cv.height !== h * k) { cv.width = w * k; cv.height = h * k; cv.style.width = (w * k / dpr) + "px"; cv.style.height = (h * k / dpr) + "px"; }
    var c = cv.getContext("2d"); c.clearRect(0, 0, cv.width, cv.height);
    for (var y = 0; y < h; y++) {
      var r = f.g[y];
      for (var x = 0; x < w; x++) { var ch = r[x]; if (ch === "." || !f.pal[ch]) continue; c.fillStyle = sil ? "rgba(120,110,95,.38)" : f.pal[ch]; c.fillRect(x * k, y * k, k, k); }
    }
  }

  var STORE_SEEN = "dashboard-guests-seen", STORE_OFF = "dashboard-guests-off", STORE_STATE = "dashboard-guests-v2";
  var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; };
  function h32(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(s) { return h32(String(s)) / 4294967296; }

  var RANKS = [[0, "Anfänger"], [5, "Lehrling"], [10, "Geselle"], [15, "Experte"], [20, "Meister"], [25, "Großmeister"], [30, "Veteran"], [35, "Champion"], [40, "Legende"], [50, "Mythos"]];
  var rankOf = function (L) { var r = RANKS[0][1]; RANKS.forEach(function (x) { if (L >= x[0]) r = x[1]; }); return r; };
  var SEC = { kalender: "kalender", todo: "todo", aufgaben: "aufgaben", "remote-tasks": "remote", habits: "habits", ziele: "ziele", business: "business", zeit: "zeit", einkauf: "einkauf", notizen: "notizen" };
  var WHERE = { brain: "Brain-Karte", kalender: "Kalender", todo: "To-Do", aufgaben: "Aufgaben", remote: "Remote Tasks", habits: "Habits", ziele: "Ziele", business: "Business", zeit: "Zeittracker", einkauf: "Einkauf", notizen: "Notizen", bar: "Kopfzeile", foot: "Seitenende" };
  var HOST_SEL = ".card, .panel, .tt-card, .shop-card, .brain-card, .scn-strip, footer.footer";
  var SKIP_SEL = "#guestLayer, .g-tip, .g-toast, .g-bar, .gp, .gp-back, .overlay, .cloud-load, .px-fx, script, style, noscript, template";
  var INK_TAGS = { IMG: 1, CANVAS: 1, SVG: 1, VIDEO: 1, INPUT: 1, SELECT: 1, TEXTAREA: 1, BUTTON: 1, PROGRESS: 1, METER: 1, IFRAME: 1, HR: 1 };
  /* Groessenklassen in Bildpunkten: 1 = Standardfigur (bis 20 x 28), 2 = mittel (bis 38 x 38), 3 = gross (bis 66 x 43) */
  var CLS = [null, { w: 20, h: 28 }, { w: 38, h: 38 }, { w: 66, h: 43 }];
  var CELL = 4, PAD = 3, INSET = 8, PEEK = 0.3, MAXREPL = 16, MARK = 26;

  window.createGuests = function (opts) {
    opts = opts || {};
    var D = window.GUESTS_DATA;
    var noop = function () {};
    if (!D || !D.list) { return window.Guests = { setLevel: noop, open: noop, close: noop, setEnabled: noop, mark: noop, shuffle: noop, debug: noop, relayout: noop, edit: noop, reset: noop, clear: noop, info: function () { return {}; } }; }
    var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* egal */ }
    var SP = D.sprites, level = 0, built = false, enabled = lsGet(STORE_OFF) !== "1", markNow = false, cloudReady = document.body.dataset.cloud === "ready" || document.body.dataset.cloud === undefined, pendingLevel = null;
    var clsOf = function (s) { return s.w <= CLS[1].w && s.h <= CLS[1].h ? 1 : s.w <= CLS[2].w && s.h <= CLS[2].h ? 2 : 3; };
    var gs = D.list.map(function (e) { var s = SP[e.k]; return { e: e, k: e.k, s: s, n: e.n, lv: e.lv, z: e.z, grp: e.g, prop: !!e.p, off: h32(e.k) % 6000, cls: clsOf(s), el: null, cv: null, key: "", kk: 0, vis: true, fresh: 0, spot: "" }; });
    var byKey = {}; gs.forEach(function (g) { byKey[g.k] = g; });
    var THEME = {}; (D.themes || []).forEach(function (t) { THEME[t.lv] = t; });
    var KIND = { f: "FIGUREN", s: "SYMBOLE", m: "FIGUREN & SYMBOLE" };
    var layer = null, tip = null, toastEl = null, party = null, io = null, ro = null, k = 2, dpr = 1, cssS = 2, kmin = 1, laidOut = false;
    var spotsAct = [], spotById = {}, lastScan = null, dbgOn = false, dbgEl = null, editMode = false, bar = null, markers = {};

    /* ---------- Zustand: Zufallszahl, Besetzung der Plaetze, was du selbst gesetzt oder leer gelassen hast ---------- */
    /* slots[platzId] = Gast-Schluessel (steht dort) oder "" (von dir leer gelassen); fehlt der Eintrag, darf die Automatik den Platz fuellen.
       pins[platzId] = 1: von dir gesetzt (Gast oder leer), die Automatik fasst es nie an. auto = false: die Automatik ist aus, es steht nur, was du gesetzt hast. */
    function loadState() {
      var o = null; try { o = JSON.parse(lsGet(STORE_STATE) || "null"); } catch (e) { o = null; }
      if (!o || typeof o !== "object") o = {};
      var s = { seed: (o.seed | 0) > 0 ? o.seed | 0 : ((Math.random() * 1e9) | 0) + 1, auto: o.auto !== false, slots: {}, pins: {} };
      if (o.slots && typeof o.slots === "object") Object.keys(o.slots).forEach(function (id) { var v = o.slots[id]; if (v === "" || (typeof v === "string" && byKey[v])) s.slots[id] = v; });
      if (o.pins && typeof o.pins === "object") Object.keys(o.pins).forEach(function (id) { if (o.pins[id] && Object.prototype.hasOwnProperty.call(s.slots, id)) s.pins[id] = 1; });
      return s;
    }
    var st = loadState(), stJson = "";
    var has = function (id) { return Object.prototype.hasOwnProperty.call(st.slots, id); };
    var gOf = function (id) { var v = st.slots[id]; return v ? byKey[v] : null; };
    function saveState() {
      var j = JSON.stringify(st); if (j === stJson) return; stJson = j; lsSet(STORE_STATE, j);
      try { document.dispatchEvent(new CustomEvent("guests-state", { detail: j })); } catch (e) { /* egal */ }
    }

    /* ---------- Masstab: ganze Geraetepixel pro Bildpunkt; auf kleinen Bildschirmen etwas kleiner ---------- */
    function scale() {
      dpr = window.devicePixelRatio || 1;
      var vw = window.innerWidth || 1200, target = vw >= 900 ? 2 : 1.5;
      k = Math.max(1, Math.round(target * dpr)); cssS = k / dpr; kmin = Math.max(1, Math.round(dpr));
    }
    var unlocked = function (g) { return g.lv <= level; };
    var count = function () { var n = 0; gs.forEach(function (g) { if (unlocked(g)) n++; }); return n; };
    var shownCount = function () { var n = 0; gs.forEach(function (g) { if (g.el) n++; }); return n; };
    /* ragt der Gast in einer Luecke oder am Rand teilweise hinter eine Karte? Die Automatik setzt nur voll sichtbare Gaeste dorthin */
    var clipped = function (g, s) { return s.type === "gap" && g.s.w * k / dpr > s.gapW - 3 + 0.5; };
    /* groesster ganzzahliger Massstab (kmin..k), bei dem der Gast in den Platz passt; 0 = passt nicht */
    function fitK(g, s) {
      var capH = s.peek && g.prop ? s.capH * (1 - PEEK) : s.capH;
      for (var kk = k; kk >= kmin; kk--) { if (g.s.w * kk / dpr <= s.capW + 0.5 && g.s.h * kk / dpr <= capH + 0.5) return kk; }
      return 0;
    }

    /* ---------- Elemente ---------- */
    function ensureLayer() {
      if (layer) return layer;
      layer = document.createElement("div"); layer.id = "guestLayer"; layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
      tip = document.createElement("div"); tip.className = "g-tip"; tip.hidden = true; document.body.appendChild(tip);
      document.addEventListener("mouseover", function (e) { var g = e.target.closest && e.target.closest(".g, .gs"); if (g && !pickerOpen()) showTip(g); });
      document.addEventListener("mouseout", function (e) { var g = e.target.closest && e.target.closest(".g, .gs"); if (g) tip.hidden = true; });
      document.addEventListener("click", function (e) {
        var t = e.target, fig = t.closest && t.closest(".g, .gs");
        if (fig) {
          var sid = fig.classList.contains("gs") ? fig.dataset.sid : (byKey[fig.dataset.k] || {}).spot;
          if (sid) { tip.hidden = true; hop(fig); openPicker(sid, fig); }
          return;
        }
        if (pickerOpen() && !(t.closest && (t.closest(".gp") || t.closest(".g-toast")))) closePicker();
      });
      window.addEventListener("scroll", function () { tip.hidden = true; if (pickerOpen()) followPicker(); }, { passive: true });
      return layer;
    }
    function makeEl(g, s, kk) {
      var el = document.createElement("div"); el.className = "g"; el.dataset.k = g.k;
      var cv = document.createElement("canvas"); el.appendChild(cv); g.el = el; g.cv = cv; g.key = ""; g.kk = kk;
      drawSprite(cv, g.s, kk, dpr, 0, g.off);
      if (g.s.an && io) io.observe(el);
      return el;
    }
    function dropEl(g) { if (!g.el) return; if (io) io.unobserve(g.el); g.el.remove(); g.el = null; g.cv = null; g.spot = ""; g.kk = 0; }
    function showTip(el) {
      var html;
      if (el.classList.contains("gs")) html = '<b>Freier Platz</b><span>Hier kann ein Easter Egg stehen.</span><span class="h">KLICK: GAST SETZEN</span>';
      else { var g = byKey[el.dataset.k]; if (!g) return; html = '<b>#' + g.n + ' ' + esc(g.s.name) + '</b><span>' + esc(D.groups[g.grp] || "") + ' · ab Level ' + g.lv + '</span><span class="h">KLICK: TAUSCHEN ODER LEER LASSEN</span>'; }
      tip.innerHTML = html; tip.hidden = false;
      var r = el.getBoundingClientRect(), tw = tip.offsetWidth, x = Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2)), y = r.top - tip.offsetHeight - 8;
      if (y < 8) y = r.bottom + 8;
      tip.style.left = x + "px"; tip.style.top = y + "px";
    }
    function hop(el) { if (reduce || el.classList.contains("peek") || el.classList.contains("gs")) return; el.classList.remove("hop"); void el.offsetWidth; el.classList.add("hop"); setTimeout(function () { el.classList.remove("hop"); }, 560); }

    /* ---------- Freie Stellen messen ---------- */
    var sx = function () { return window.pageXOffset || 0; }, sy = function () { return window.pageYOffset || 0; };
    function visibleBox(el) { var r = el.getBoundingClientRect(); return r.width >= 90 && r.height >= 36 && el.offsetParent !== null; }
    /* Karten in waagerecht oder senkrecht scrollbaren Behaeltern (z. B. die Karussells auf dem Handy) wandern beim Scrollen: dort bleibt kein Gast stehen */
    function inScroller(el) {
      for (var a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
        var cs = getComputedStyle(a), ox = cs.overflowX, oy = cs.overflowY;
        if ((ox === "auto" || ox === "scroll") && a.scrollWidth > a.clientWidth + 4) return true;
        if ((oy === "auto" || oy === "scroll") && a.scrollHeight > a.clientHeight + 4) return true;
      }
      return false;
    }
    function hostPath(el) {
      var parts = [], n = el;
      while (n && n !== document.body && n.nodeType === 1) {
        if (n.id) { parts.unshift("#" + n.id); break; }
        var i = 0, c = n; while ((c = c.previousElementSibling)) i++;
        parts.unshift(n.tagName.toLowerCase() + (n.classList && n.classList[0] ? "." + n.classList[0] : "") + ":" + i);
        n = n.parentNode;
      }
      return parts.join(">");
    }
    function secOf(h) {
      if (h.classList.contains("brain-card")) return "brain";
      if (h.tagName === "FOOTER") return "foot";
      var s = h.closest("section[id]"); if (s && SEC[s.id]) return SEC[s.id];
      if (h.classList.contains("scn-strip")) { var nx = h.nextElementSibling; if (nx && nx.id && SEC[nx.id]) return SEC[nx.id]; }
      return "";
    }
    function hasDeco(cs) {
      var bg = cs.backgroundColor;
      if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)") return true;
      if (cs.backgroundImage && cs.backgroundImage !== "none") return true;
      return (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== "none") || (parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none") || (parseFloat(cs.borderLeftWidth) > 0 && cs.borderLeftStyle !== "none");
    }
    function scan() {
      scale();
      var de = document.documentElement, body = document.body, tb = document.querySelector(".topbar"), tbPos = tb ? tb.style.position : "", locked = body.classList.contains("g-lock");
      if (tb) tb.style.position = "relative";   /* die mitlaufende Kopfzeile misst sich so an ihrem festen Platz */
      if (locked) body.classList.remove("g-lock");   /* Scrollsperre des Skilltrees aendert die Seitenbreite: fuer die Messung kurz aufheben */
      var out;
      try { out = scanInner(de, body, tb); }
      catch (err) { out = { slots: [], all: 0, W: 0, H: 0 }; if (window.console) console.warn("Pixel-Gäste: Messung fehlgeschlagen", err); }
      finally { if (tb) tb.style.position = tbPos; if (locked) body.classList.add("g-lock"); }
      return out;
    }
    function scanInner(de, body, tb) {
      var W = de.clientWidth || window.innerWidth, H = Math.max(de.scrollHeight, body.scrollHeight), ox = sx(), oy = sy();
      var gw = Math.ceil(W / CELL) + 1, gh = Math.ceil(H / CELL) + 1, mark = new Uint8Array(gw * gh);
      function fillAbs(l, t, r, b) {
        var x0 = Math.max(0, Math.floor(l / CELL)), x1 = Math.min(gw - 1, Math.floor((r - 0.01) / CELL)), y0 = Math.max(0, Math.floor(t / CELL)), y1 = Math.min(gh - 1, Math.floor((b - 0.01) / CELL));
        for (var y = y0; y <= y1; y++) { var o = y * gw; for (var x = x0; x <= x1; x++) mark[o + x] = 1; }
      }
      function fillRect(r, pad) { if (r.width < 0.5 || r.height < 0.5) return; fillAbs(r.left + ox - pad, r.top + oy - pad, r.right + ox + pad, r.bottom + oy + pad); }
      /* belegt: Text (Zeile fuer Zeile), Bilder, Knoepfe, Eingaben, kleine Elemente mit Hintergrund oder Rahmen; auch alles, was nur beim Daruberfahren erscheint (durchsichtig zaehlt mit) */
      var range = document.createRange();
      function walk(el) {
        var cs = getComputedStyle(el);
        if (cs.display === "none" || cs.position === "fixed") return;
        if (cs.visibility !== "hidden") {
          var r = el.getBoundingClientRect();
          if (INK_TAGS[el.tagName.toUpperCase()]) { fillRect(r, 2); return; }
          if (r.width <= 460 && r.height <= 140 && r.width * r.height <= 36000 && !el.matches(HOST_SEL) && hasDeco(cs)) fillRect(r, 1);
          for (var c = el.firstChild; c; c = c.nextSibling) {
            if (c.nodeType === 3 && /\S/.test(c.nodeValue)) { range.selectNodeContents(c); var rs = range.getClientRects(); for (var i = 0; i < rs.length; i++) fillRect(rs[i], PAD - 1); }
          }
        }
        for (var ch = el.firstElementChild; ch; ch = ch.nextElementSibling) { if (!ch.matches(SKIP_SEL)) walk(ch); }
      }
      Array.prototype.forEach.call(body.children, function (c) { if (!c.matches(SKIP_SEL)) walk(c); });
      if (tb) fillRect(tb.getBoundingClientRect(), 0);
      var w1 = gw + 1, I = new Int32Array(w1 * (gh + 1));
      for (var y = 0; y < gh; y++) { var rs2 = 0; for (var x = 0; x < gw; x++) { rs2 += mark[y * gw + x]; I[(y + 1) * w1 + x + 1] = I[y * w1 + x + 1] + rs2; } }
      function isFree(l, t, r, b) {
        if (l < 0 || t < 0 || r > W || b > H) return false;
        var x0 = Math.floor(l / CELL), x1 = Math.min(gw, Math.ceil(r / CELL)), y0 = Math.floor(t / CELL), y1 = Math.min(gh, Math.ceil(b / CELL));
        return I[y1 * w1 + x1] - I[y0 * w1 + x1] - I[y1 * w1 + x0] + I[y0 * w1 + x0] === 0;
      }
      /* Kasten (Dokumentkoordinaten), den ein Gast der Klasse cl an diesem Platz belegt */
      function boxOf(c, cl) {
        if (c.type === "gap") { var hh = CLS[cl].h * cssS; return { l: c.hide === "r" ? c.ax - c.gapW : c.ax, r: c.hide === "r" ? c.ax : c.ax + c.gapW, t: c.foot - hh, b: c.foot }; }
        var w = CLS[cl].w * cssS, h = CLS[cl].h * cssS * (c.peek ? 1 - PEEK : 1), b = c.foot + c.ft;
        return { l: c.ax, r: c.ax + w, t: b - h, b: b };
      }
      function probe(c) {   /* groesste Klasse, deren Kasten frei ist (0 = keine) */
        for (var cl = 3; cl >= 1; cl--) {
          var bx = boxOf(c, cl), p = c.type === "gap" ? 0 : PAD;
          if (isFree(bx.l - p, bx.t - p, bx.r + p, bx.b)) return cl;
        }
        return 0;
      }
      var seed = st.seed, cands = [], fw1 = CLS[1].w * cssS, step = Math.max(14, Math.round(22 * cssS / 2));
      function add(c, bias) { c.cls = probe(c); if (!c.cls) return; c.pr = has(c.id) ? -1 : bias + rnd(seed + ":" + c.id); cands.push(c); }
      var hosts = Array.prototype.slice.call(document.querySelectorAll(HOST_SEL)).filter(function (h) { return visibleBox(h) && !inScroller(h); });
      var rows = [];
      hosts.forEach(function (h) {
        var r = h.getBoundingClientRect(), L = r.left + ox, T = r.top + oy, R = r.right + ox, B = r.bottom + oy, cs = getComputedStyle(h);
        var bw = parseFloat(cs.borderLeftWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
        var host = "s" + h32(hostPath(h)).toString(36), sec = secOf(h);
        var strip = h.classList.contains("scn-strip"), foot = h.tagName === "FOOTER", brain = h.classList.contains("brain-card");
        if (!strip && !brain && !foot) rows.push({ L: L, T: T, R: R, B: B, host: host, sec: sec });
        if (R - L < fw1 + 2 * INSET) return;
        /* Oberkante: stehend (oder halb hinter der Kante hervorlugend) in kleinen Schritten von links nach rechts */
        var x0 = L + INSET, x1 = R - INSET - fw1, i = 0, x;
        for (x = x0; x <= x1 + 0.5; x += step, i++) { var id = host + "t" + i; add({ id: id, host: host, sec: sec, kind: "doc", type: "top", ax: x, foot: T, ft: 2, peek: rnd(seed + ":" + id + ":p") < 0.25 }, 0); }
        if (x1 - (x - step) > 6) { var idr = host + "tR"; add({ id: idr, host: host, sec: sec, kind: "doc", type: "top", ax: x1, foot: T, ft: 2, peek: rnd(seed + ":" + idr + ":p") < 0.25 }, 0); }
        /* innen unten: auf dem Boden der Karte */
        if (!strip && !foot && !brain && B - T >= 96) {
          var y0 = B - bb - 1, ix0 = L + bw + INSET, ix1 = R - bw - INSET - fw1;
          for (x = ix0, i = 0; x <= ix1 + 0.5; x += step, i++) add({ id: host + "b" + i, host: host, sec: sec, kind: "doc", type: "in", ax: x, foot: y0, ft: 0, peek: false }, 0);
          if (ix1 - (x - step) > 6) add({ id: host + "bR", host: host, sec: sec, kind: "doc", type: "in", ax: ix1, foot: y0, ft: 0, peek: false }, 0);
        }
      });
      /* Luecken zwischen zwei nebeneinanderstehenden Karten: halb hinter einer der beiden Karten */
      rows.forEach(function (A) {
        var Bn = null;
        rows.forEach(function (B) { var gp = B.L - A.R; if (Math.abs(B.T - A.T) < 8 && gp >= 8 && gp <= 56 && (!Bn || B.L < Bn.L)) Bn = B; });
        if (!Bn) return;
        var gap = Bn.L - A.R, top = Math.max(A.T, Bn.T), bot = Math.min(A.B, Bn.B) - 3, hh1 = CLS[1].h * cssS;
        [["gr", "r"], ["gl", "l"]].forEach(function (t) {
          for (var foot = bot, i = 0; foot - hh1 - 6 >= top; foot -= 96, i++) add({ id: A.host + Bn.host + t[0] + i, host: A.host + "g", sec: A.sec, kind: "doc", type: "gap", hide: t[1], ax: t[1] === "r" ? Bn.L : A.R, gapW: gap, foot: foot, ft: 0, peek: false }, 0.15);
        });
      });
      /* Seitenraender: zwischen Bildschirmrand und Karte (so gibt es auch auf dem Handy Plaetze) */
      rows.forEach(function (B) {
        [["l", B.L], ["r", W - B.R]].forEach(function (sd) {
          var left = sd[0] === "l", edge = sd[1]; if (edge < 8) return;
          var neighbour = rows.some(function (A) { return A !== B && (left ? A.R <= B.L + 1 : A.L >= B.R - 1) && A.B > B.T + 8 && A.T < B.B - 8; });
          if (neighbour) return;
          var gwid = Math.min(edge, 60), hh1 = CLS[1].h * cssS;
          for (var foot = B.B - 3, i = 0; foot - hh1 >= B.T + 2; foot -= 96, i++) add({ id: B.host + "e" + sd[0] + i, host: B.host + "e", sec: B.sec, kind: "doc", type: "gap", hide: left ? "r" : "l", ax: left ? B.L : B.R, gapW: gwid, foot: foot, ft: 0, peek: false }, 0.15);
        });
      });
      /* Packen: erst die besetzten Plaetze (mit der Klasse, die ihr Gast braucht), dann einige grosse Plaetze, dann so viele Standardplaetze wie nebeneinander passen */
      cands.sort(function (a, b) { return a.pr - b.pr; });
      var boxes = [], slots = [], M = 3;
      function hit(b) { for (var i = 0; i < boxes.length; i++) { var a = boxes[i]; if (b.l < a.r + M && b.r > a.l - M && b.t < a.b + M && b.b > a.t - M) return true; } return false; }
      function accept(c, cl) {
        var bx = boxOf(c, cl), cw = CLS[cl].w * cssS;
        c.cls = cl; c.capW = c.type === "gap" ? Math.min(cw, Math.max(fw1, c.gapW * 2.4)) : cw; c.capH = CLS[cl].h * cssS; c.acc = true;
        c.cx = (bx.l + bx.r) / 2; c.cy = (bx.t + bx.b) / 2; c.box = bx; boxes.push(bx); slots.push(c);
      }
      var big = 0, bigMax = cssS >= 2 ? 40 : 16;
      cands.forEach(function (c) {
        if (c.pr >= 0) return;
        var g = gOf(c.id), need = g ? g.cls : 1;
        for (var cl = c.cls; cl >= need; cl--) { if (!hit(boxOf(c, cl))) { accept(c, cl); if (cl >= 2) big++; return; } }
      });
      cands.forEach(function (c) {
        if (c.acc || c.cls < 2 || big >= bigMax) return;
        var cl = c.cls === 3 && rnd(seed + ":bc:" + c.id) < 0.6 ? 2 : c.cls;   /* viele mittlere, weniger grosse */
        if (!hit(boxOf(c, cl))) { accept(c, cl); big++; }
      });
      cands.forEach(function (c) { if (c.acc) return; if (!hit(boxOf(c, 1))) accept(c, 1); });
      if (slots.length > 900) slots.length = 900;
      /* Kopfzeile: bis zu vier Plaetze in der groessten Luecke der ersten Zeile (liegen im Kopf und laufen mit der Leiste mit) */
      if (tb && window.innerWidth > 720) {
        var tbr = tb.getBoundingClientRect(), inner = tb.querySelector(".topbar-inner"), brand = inner && inner.querySelector(".brand");
        if (inner && brand) {
          var row = brand.getBoundingClientRect(), items = [];
          Array.prototype.forEach.call(inner.children, function (c) {
            var r = c.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return;
            if (c.classList && c.classList.contains("nav")) { var links = c.querySelectorAll("a"); if (!links.length) return; var l0 = links[0].getBoundingClientRect(), l1 = links[links.length - 1].getBoundingClientRect(); r = { left: l0.left, right: Math.max(l1.right, l0.left), top: l0.top, bottom: l0.bottom }; }
            if (r.top < row.bottom - 6 && r.bottom > row.top + 6) items.push({ l: r.left, r: r.right });
          });
          items.sort(function (a, b) { return a.l - b.l; });
          var best = null;
          for (var q = 0; q < items.length - 1; q++) { var gap2 = items[q + 1].l - items[q].r; if (!best || gap2 > best.w) best = { x: items[q].r + 14, w: gap2 - 28 }; }
          var sw = fw1 + 6;
          if (best && best.w >= sw) {
            var nb = Math.min(4, Math.floor(best.w / sw));
            for (var b = 0; b < nb; b++) slots.push({ id: "bar" + b, host: "bar", sec: "bar", kind: "bar", type: "bar", ax: best.x - tbr.left + b * sw, foot: row.bottom - tbr.top + 1, ft: 0, peek: false, cls: 1, capW: fw1, capH: Math.min(CLS[1].h * cssS, row.height + 8), cx: -9999, cy: -9999 });
          }
        }
      }
      var candIds = {}; cands.forEach(function (c) { candIds[c.id] = 1; });
      return { slots: slots, all: cands.length, cand: candIds, W: W, H: H };
    }

    /* ---------- Besetzung: wer steht wo ---------- */
    function plan(o) {
      o = o || {};
      var sc = scan(); lastScan = sc;
      spotsAct = sc.slots; spotById = {}; spotsAct.forEach(function (s) { spotById[s.id] = s; });
      var shown = {}, changed = false, taken = {};
      var occ = function (s) { return has(s.id) && st.slots[s.id] !== ""; };
      /* 1) Bestand pruefen: ein Gast, der nicht mehr freigeschaltet ist oder nicht mehr passt, geht; leer Gelassenes bleibt */
      spotsAct.forEach(function (s) {
        if (!has(s.id)) return;
        var key = st.slots[s.id]; if (key === "") return;
        var g = byKey[key], kk = g ? fitK(g, s) : 0;
        if (!g || !unlocked(g) || shown[key] || !(st.pins[s.id] ? kk > 0 : kk === k)) { delete st.slots[s.id]; delete st.pins[s.id]; changed = true; return; }
        shown[key] = s.id;
      });
      /* 2) Eintraege fuer Plaetze, die es gar nicht mehr gibt (Karte verschwunden), entfernen */
      if (sc.slots.length) {
        var known = {}; sc.slots.forEach(function (c) { known[c.id] = 1; });
        Object.keys(st.slots).forEach(function (id) { if (!known[id] && !(sc.cand && sc.cand[id])) { delete st.slots[id]; delete st.pins[id]; changed = true; } });
      }
      var take = function (g, s, pin) { st.slots[s.id] = g.k; if (pin) st.pins[s.id] = 1; else delete st.pins[s.id]; shown[g.k] = s.id; taken[s.id] = 1; changed = true; };
      var minD = (cssS >= 2 ? 75 : 58) * cssS, capSec = cssS >= 2 ? 6 : 4;
      var autoN = Math.max(6, Math.min(70, Math.round(sc.H / (cssS >= 2 ? 200 : 255))));
      var autoOcc = 0, secCount = {}, centers = [];
      spotsAct.forEach(function (s) { if (occ(s)) { centers.push(s); if (!st.pins[s.id]) { autoOcc++; secCount[s.sec] = (secCount[s.sec] || 0) + 1; } } });
      var far = function (s, d) { for (var i = 0; i < centers.length; i++) { var dx = s.cx - centers[i].cx, dy = s.cy - centers[i].cy; if (dx * dx + dy * dy < d * d) return false; } return true; };
      /* 3) vorgemerkte Gaeste (beim Neu-Mischen) zuerst */
      (o.prefer || []).forEach(function (key) {
        var g = byKey[key]; if (!g || !unlocked(g) || shown[key]) return;
        var best = null, bs = -1e9;
        spotsAct.forEach(function (s) {
          if (has(s.id) || !fitK(g, s)) return;
          var sc2 = (g.z === s.sec ? 20 : 0) + rnd(st.seed + ":pf:" + g.k + s.id) * 30 + (s.type === "gap" ? -25 : 0) + (far(s, minD) ? 15 : 0);
          if (sc2 > bs) { bs = sc2; best = s; }
        });
        var pin = !!(o.pinned && o.pinned[key]);
        if (best) { take(g, best, pin); centers.push(best); if (!pin) { autoOcc++; secCount[best.sec] = (secCount[best.sec] || 0) + 1; } }
      });
      if (st.auto !== false) {
        /* 4) neue Gaeste ziehen ein: grosse zuerst; erst in einen freien Platz (solange der Rahmen der Automatik nicht voll ist), sonst anstelle eines nicht gesetzten Gastes (hoechstens MAXREPL) */
        var repl = 0;
        (o.fresh || []).slice().sort(function (x, y) { return y.cls - x.cls || rnd(st.seed + ":fo:" + x.k) - rnd(st.seed + ":fo:" + y.k); }).forEach(function (g) {
          if (!unlocked(g) || shown[g.k]) return;
          var pick = function (wantFree) {
            var best = null, bs = -1e9;
            spotsAct.forEach(function (s) {
              if (taken[s.id] || fitK(g, s) !== k || clipped(g, s)) return;
              var isFree = !has(s.id), cur = isFree ? "" : st.slots[s.id];
              if (wantFree ? !isFree : (isFree || cur === "" || st.pins[s.id])) return;
              var sc2 = (g.z === s.sec ? 25 : 0) + rnd(st.seed + ":fr:" + g.k + s.id) * 20 - (s.cls - g.cls) * 40 + (s.kind === "bar" ? (g.z === "party" ? 60 : -30) : 0) + (wantFree && far(s, minD) ? 30 : 0) + (wantFree && (secCount[s.sec] || 0) >= capSec ? -25 : 0);
              if (sc2 > bs) { bs = sc2; best = s; }
            });
            return best;
          };
          var best = autoOcc < autoN ? pick(true) : null, replacing = false;
          if (!best && repl < MAXREPL) { best = pick(false); replacing = !!best; }
          if (!best) return;
          if (replacing) { delete shown[st.slots[best.id]]; repl++; } else { autoOcc++; secCount[best.sec] = (secCount[best.sec] || 0) + 1; }
          take(g, best, false); centers.push(best);
        });
        /* 5) Rest der Automatik: freie Plaetze mit Abstand zueinander fuellen, bis der Rahmen voll ist */
        if (autoOcc < autoN) {
          var pool = gs.filter(function (g) { return unlocked(g) && !shown[g.k]; });
          var empties = spotsAct.filter(function (s) { return !has(s.id) && !taken[s.id]; });
          empties.sort(function (a, b) { return (b.kind === "bar") - (a.kind === "bar") || b.cls - a.cls || rnd(st.seed + a.id) - rnd(st.seed + b.id); });
          for (var pass = 0; pass < 2 && autoOcc < autoN && pool.length; pass++) {
            var dd = pass === 0 ? minD : minD / 2;
            for (var ei = 0; ei < empties.length && autoOcc < autoN && pool.length; ei++) {
              var s = empties[ei]; if (taken[s.id] || !far(s, dd) || (pass === 0 && (secCount[s.sec] || 0) >= capSec)) continue;
              var bg = null, bs2 = -1e9;
              pool.forEach(function (g) {
                if (fitK(g, s) !== k || clipped(g, s)) return;
                var sc2 = (g.z === s.sec ? 38 : 0) + (g.lv === level ? 50 : g.lv > level - 3 ? 14 : 0) + rnd(st.seed + ":" + g.k + ":" + s.id) * 45 - (s.cls - g.cls) * 40 + (s.kind === "bar" ? (g.z === "party" ? 90 : -25) : (g.z === "party" ? -20 : 0));
                if (sc2 > bs2) { bs2 = sc2; bg = g; }
              });
              if (bg) { take(bg, s, false); pool.splice(pool.indexOf(bg), 1); centers.push(s); autoOcc++; secCount[s.sec] = (secCount[s.sec] || 0) + 1; }
            }
          }
        }
      }
      if (changed) saveState();
    }

    /* ---------- Anzeige ---------- */
    function geom(g, s, kk) {
      var w = g.s.w * kk / dpr, h = g.s.h * kk / dpr, x, y, clip = "";
      if (s.type === "gap") {
        var vis = Math.min(s.gapW - 3, w);
        if (vis >= w - 0.5) { x = s.hide === "r" ? s.ax - s.gapW / 2 - w / 2 : s.ax + s.gapW / 2 - w / 2; }
        else if (s.hide === "r") { x = s.ax - vis; clip = "inset(0 " + Math.round(w - vis) + "px 0 0)"; }
        else { x = s.ax + vis - w; clip = "inset(0 0 0 " + Math.round(w - vis) + "px)"; }
        y = s.foot - h;
      } else {
        var hid = s.peek && !g.prop && s.kind === "doc" ? Math.round(h * PEEK) : 0;
        x = s.ax + (s.capW - w) / 2; y = s.foot + s.ft - h + hid; if (hid) clip = "inset(0 0 " + hid + "px 0)";
      }
      return { x: Math.round(x), y: Math.round(y), clip: clip };
    }
    function mgeom(s) {   /* Plus-Feld eines leeren Platzes (nur im Bearbeiten-Modus) */
      var w = MARK, x, y = s.foot + s.ft - MARK;
      if (s.type === "gap") { w = Math.max(14, Math.min(MARK, s.gapW - 2)); x = (s.hide === "r" ? s.ax - s.gapW / 2 : s.ax + s.gapW / 2) - w / 2; }
      else x = s.ax + (s.capW - MARK) / 2;
      return { x: Math.round(x), y: Math.round(y), w: Math.round(w) };
    }
    function ensureParty() {
      if (party) return party;
      var tb = document.querySelector(".topbar"); if (!tb) return null;
      party = document.createElement("div"); party.className = "g-party"; party.setAttribute("aria-hidden", "true"); tb.appendChild(party);
      return party;
    }
    function sync() {
      if (!layer) return;
      document.documentElement.classList.toggle("g-off", !enabled);
      var want = {};
      if (enabled) spotsAct.forEach(function (s) { var key = st.slots[s.id]; if (key && byKey[key] && unlocked(byKey[key])) want[key] = s; });
      var now = Date.now(), filled = {};
      gs.forEach(function (g) {
        var s = want[g.k];
        if (!s) { if (g.el) dropEl(g); return; }
        var kk = fitK(g, s) || kmin, gm = geom(g, s, kk), host = s.kind === "bar" ? ensureParty() : layer;
        if (!host) { if (g.el) dropEl(g); return; }
        if (g.el && (g.el.parentNode !== host)) dropEl(g);
        var isNew = (markNow && g.lv === level) || g.fresh > now;
        if (!g.el) { makeEl(g, s, kk); host.appendChild(g.el); if (laidOut && built && !reduce) g.el.classList.add("in"); }
        else if (g.kk !== kk) { g.kk = kk; g.key = ""; g.cv.width = 0; drawSprite(g.cv, g.s, kk, dpr, performance.now(), g.off); }
        g.spot = s.id; filled[s.id] = 1;
        var el = g.el; el.style.left = gm.x + "px"; el.style.top = gm.y + "px";
        el.style.clipPath = gm.clip; el.classList.toggle("peek", !!gm.clip);
        el.classList.toggle("new", isNew);
        var badge = el.querySelector(".g-newb");
        if (isNew && !badge) { badge = document.createElement("b"); badge.className = "g-newb"; badge.textContent = "NEU"; el.appendChild(badge); }
        else if (!isNew && badge) badge.remove();
      });
      syncMarkers(filled);
      if (dbgOn) drawDebug();
    }
    /* Bearbeiten-Modus: jeder freie Platz zeigt ein Plus */
    function syncMarkers(filled) {
      var want = {};
      if (editMode && enabled) spotsAct.forEach(function (s) { if (!filled[s.id]) want[s.id] = s; });
      Object.keys(markers).forEach(function (id) { if (!want[id]) { markers[id].remove(); delete markers[id]; } });
      Object.keys(want).forEach(function (id) {
        var s = want[id], host = s.kind === "bar" ? ensureParty() : layer; if (!host) return;
        var m = markers[id];
        if (!m) { m = document.createElement("div"); m.className = "gs"; m.dataset.sid = id; m.setAttribute("role", "button"); markers[id] = m; host.appendChild(m); }
        else if (m.parentNode !== host) host.appendChild(m);
        var mg = mgeom(s); m.style.left = mg.x + "px"; m.style.top = mg.y + "px"; m.style.width = mg.w + "px";
        m.classList.toggle("empty", has(id) && st.slots[id] === "");
      });
      if (bar) updateBar();
    }
    function render(o) {
      if (!layer) return;
      document.documentElement.classList.toggle("g-off", !enabled);
      if (!enabled) { gs.forEach(dropEl); syncMarkers({}); return; }
      plan(o); sync(); laidOut = true;
    }
    function redrawAll() {
      scale();
      gs.forEach(function (g) { if (g.el) { g.cv.width = 0; g.kk = 0; g.key = ""; } });
    }
    function drawDebug() {
      if (!dbgEl) { dbgEl = document.createElement("div"); dbgEl.className = "g-dbg"; layer.appendChild(dbgEl); }
      var html = "";
      spotsAct.forEach(function (s) {
        if (!s.box) return;
        var b = s.box;
        html += '<i style="left:' + b.l + 'px;top:' + b.t + 'px;width:' + (b.r - b.l) + 'px;height:' + (b.b - b.t) + 'px" class="c' + s.cls + (st.slots[s.id] ? " on" : "") + (s.peek ? " pk" : "") + (s.type === "gap" ? " gp" : "") + '"></i>';
      });
      dbgEl.innerHTML = html;
    }

    /* ---------- Bewegung: nur was im sichtbaren Bereich steht ---------- */
    function tick() {
      if (document.hidden || reduce || !enabled) return;
      var t = performance.now();
      for (var i = 0; i < gs.length; i++) {
        var g = gs[i]; if (!g.el || !g.s.an || !g.vis || !g.kk) continue;
        var key = spriteKey(g.s, t, g.off);
        if (key !== g.key) { g.key = key; drawSprite(g.cv, g.s, g.kk, dpr, t, g.off); }
      }
    }
    function setupObserver() {
      if (!window.IntersectionObserver) return;
      io = new IntersectionObserver(function (es) { es.forEach(function (en) { var g = byKey[en.target.dataset.k]; if (g) g.vis = en.isIntersecting; }); }, { rootMargin: "120px" });
    }
    function flash(g, ms) { g.fresh = Date.now() + ms; sync(); setTimeout(function () { if (g.fresh <= Date.now()) { g.fresh = 0; sync(); } }, ms + 100); }
    function goTo(key) {
      var g = byKey[key]; if (!g || !g.el) return false;
      var r = g.el.getBoundingClientRect(), y = r.top + sy() - Math.max(160, window.innerHeight * 0.38);
      window.scrollTo({ top: Math.max(0, y), behavior: reduce ? "auto" : "smooth" });
      flash(g, 4200); return true;
    }

    /* ---------- Setzen, tauschen, leer lassen ---------- */
    function shownAt(key) { for (var i = 0; i < spotsAct.length; i++) if (st.slots[spotsAct[i].id] === key) return spotsAct[i]; return null; }
    function note(a, b) {
      var n = document.createElement("div"); n.className = "g-toast g-note"; n.innerHTML = '<span class="k">' + esc(a) + '</span><span class="v">' + esc(b) + "</span>";
      var old = document.querySelector(".g-note"); if (old) old.remove();
      document.body.appendChild(n);
      setTimeout(function () { n.classList.add("out"); setTimeout(function () { n.remove(); }, 400); }, 2600);
    }
    /* Gast key an Platz sid setzen; steht er schon woanders, tauschen beide die Plaetze (war der Platz leer, wird der andere leer). */
    function swapIn(sid, key) {
      var s = spotById[sid], g = byKey[key], oldKey = st.slots[sid] || ""; if (!s || !g || !unlocked(g) || key === oldKey || !fitK(g, s)) return false;
      var other = shownAt(key);
      if (other) { var og = oldKey ? byKey[oldKey] : null; if (og && !fitK(og, other)) return false; st.slots[other.id] = oldKey; st.pins[other.id] = 1; }
      st.slots[sid] = key; st.pins[sid] = 1;
      saveState(); sync();
      [g, oldKey ? byKey[oldKey] : null].forEach(function (x) { if (x && x.el) hop(x.el); });
      note(oldKey ? "GETAUSCHT" : "GESETZT", (oldKey ? "#" + byKey[oldKey].n + " " + byKey[oldKey].s.name + " ↔ " : "") + "#" + g.n + " " + g.s.name);
      return true;
    }
    function emptySlot(sid) {
      var s = spotById[sid]; if (!s) return false;
      var old = gOf(sid); st.slots[sid] = ""; st.pins[sid] = 1; saveState(); sync();
      note("LEER GELASSEN", old ? "#" + old.n + " " + old.s.name + " wartet im Skilltree." : "Dieser Platz bleibt leer.");
      return true;
    }
    /* Gast aus dem Skilltree irgendwo einsetzen: ein freier Platz, sonst ein nicht gesetzter */
    function equip(key) {
      var g = byKey[key]; if (!g || !unlocked(g)) return "";
      if (shownAt(key)) return "da";
      var best = null, bs = -1e9;
      spotsAct.forEach(function (s) {
        var kk = fitK(g, s); if (!kk || (has(s.id) && (st.slots[s.id] === "" ? false : st.pins[s.id]))) return;
        var emptyByUser = has(s.id) && st.slots[s.id] === "";
        var sc2 = (!has(s.id) ? 30 : emptyByUser ? 10 : 0) + (s.type === "gap" ? -25 : 0) + (g.z === s.sec ? 25 : 0) + (kk === k ? 15 : 0) + rnd(st.seed + ":eq:" + key + s.id) * 20;
        if (sc2 > bs) { bs = sc2; best = s; }
      });
      if (!best) return "";
      st.slots[best.id] = key; st.pins[best.id] = 1; saveState(); sync();
      return "neu";
    }
    function shuffle() {
      /* dieselben Gaeste suchen sich neue Plaetze; was du gesetzt hast, bleibt gesetzt */
      var keep = [], pinned = {};
      spotsAct.forEach(function (s) { var key = st.slots[s.id]; if (!key) return; if (st.pins[s.id]) { pinned[key] = 1; keep.unshift(key); } else keep.push(key); });
      st.seed = ((Math.random() * 1e9) | 0) + 1; st.slots = {}; st.pins = {};
      gs.forEach(function (g) { dropEl(g); });
      render({ prefer: keep, pinned: pinned }); saveState();
      note("NEU GEMISCHT", "Die Gäste haben sich neue Plätze gesucht.");
    }
    function reset() { st.slots = {}; st.pins = {}; st.auto = true; gs.forEach(dropEl); render(); saveState(); note("ZURÜCKGESETZT", "Die Automatik füllt die Plätze wieder selbst."); }
    function clearAll() { st.slots = {}; st.pins = {}; st.auto = false; gs.forEach(dropEl); render(); saveState(); note("ALLES LEER", "Die Automatik ist aus. Setze Gäste selbst, im Bearbeiten-Modus siehst du alle Plätze."); }
    function setAuto(on) { st.auto = !!on; saveState(); render(); }

    /* ---------- Auswahl (Klick auf einen Gast oder einen leeren Platz) ---------- */
    var pk = { el: null, back: null, sid: "", anchor: null, f: "alle", q: "", grp: "" };
    var pickerOpen = function () { return !!(pk.el && !pk.el.hidden); };
    function drawFit(cv, s, bw, bh, sil) {
      var kk = Math.max(1, Math.min(Math.floor(bw * dpr / s.w), Math.floor(bh * dpr / s.h), Math.round(2 * dpr)));
      drawSprite(cv, s, kk, dpr, 0, 0, sil);
    }
    function ensurePicker() {
      if (pk.el) return pk.el;
      pk.back = document.createElement("div"); pk.back.className = "gp-back"; pk.back.hidden = true; document.body.appendChild(pk.back);
      var el = document.createElement("div"); el.className = "gp"; el.hidden = true; el.setAttribute("role", "dialog"); el.setAttribute("aria-label", "Gast setzen oder tauschen");
      el.innerHTML = '<div class="gp-head"><canvas class="gp-cur"></canvas><div class="gp-who"><b class="gp-name"></b><span class="gp-meta"></span></div><button type="button" class="gp-x" aria-label="Schließen">×</button></div>' +
        '<p class="gp-hint"></p>' +
        '<div class="gp-tools"><input type="search" class="gp-q" placeholder="Nr. oder Name" aria-label="Suchen"><select class="gp-sel" aria-label="Thema"></select></div>' +
        '<div class="gp-chips" role="group" aria-label="Filter"><button type="button" class="gp-chip" data-f="alle" aria-pressed="true">ALLE</button><button type="button" class="gp-chip" data-f="frei" aria-pressed="false">NICHT IM BILD</button><button type="button" class="gp-chip" data-f="neu" aria-pressed="false">NEU</button></div>' +
        '<div class="gp-grid"></div><div class="gp-foot"><button type="button" class="gp-btn gp-clear">LEER LASSEN</button><button type="button" class="gp-btn gp-rand">ZUFÄLLIG</button><button type="button" class="gp-btn gp-places">ALLE PLÄTZE</button><button type="button" class="gp-btn gp-tree">SKILLTREE ▸</button></div>';
      document.body.appendChild(el); pk.el = el;
      var sel = el.querySelector(".gp-sel");
      sel.innerHTML = '<option value="">Alle Welten</option>' + Object.keys(D.groups).map(function (g) { return '<option value="' + g + '">' + esc(D.groups[g]) + "</option>"; }).join("");
      el.querySelector(".gp-x").addEventListener("click", closePicker);
      pk.back.addEventListener("click", closePicker);
      el.querySelector(".gp-q").addEventListener("input", function () { pk.q = this.value; fillPicker(); });
      sel.addEventListener("change", function () { pk.grp = this.value; fillPicker(); });
      el.querySelector(".gp-chips").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; pk.f = b.dataset.f; fillPicker(); });
      el.querySelector(".gp-grid").addEventListener("click", function (e) {
        var it = e.target.closest(".gp-it"); if (!it) return;
        if (it.classList.contains("dis")) { it.classList.remove("shake"); void it.offsetWidth; it.classList.add("shake"); return; }
        if (swapIn(pk.sid, it.dataset.k)) closePicker(); else { it.classList.remove("shake"); void it.offsetWidth; it.classList.add("shake"); }
      });
      el.querySelector(".gp-clear").addEventListener("click", function () { var sid = pk.sid; closePicker(); emptySlot(sid); });
      el.querySelector(".gp-rand").addEventListener("click", function () {
        var s = spotById[pk.sid]; if (!s) return;
        var opts2 = gs.filter(function (g) { return unlocked(g) && g.k !== st.slots[pk.sid] && !shownAt(g.k) && fitK(g, s); });
        if (!opts2.length) { note("KEINE ANDEREN", "Alle passenden Gäste sind schon im Bild."); return; }
        var g = opts2[Math.floor(Math.random() * opts2.length)]; if (swapIn(pk.sid, g.k)) closePicker();
      });
      el.querySelector(".gp-tree").addEventListener("click", function () { closePicker(); openTree(); });
      el.querySelector(".gp-places").addEventListener("click", function () { closePicker(); setEdit(true); });
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && pickerOpen()) closePicker(); });
      return el;
    }
    function openPicker(sid, anchor) {
      if (!sid || !spotById[sid]) return;
      ensurePicker(); pk.sid = sid; pk.anchor = anchor; pk.f = "alle"; pk.q = ""; pk.grp = "";
      pk.el.querySelector(".gp-q").value = ""; pk.el.querySelector(".gp-sel").value = "";
      pk.el.hidden = false; fillPicker(); placePicker();
    }
    function closePicker() { if (!pk.el) return; pk.el.hidden = true; pk.back.hidden = true; pk.anchor = null; }
    function placePicker() {
      var el = pk.el, vw = window.innerWidth, vh = window.innerHeight;
      if (vw <= 640) { el.classList.add("sheet"); pk.back.hidden = false; el.style.left = el.style.top = ""; return; }
      el.classList.remove("sheet"); pk.back.hidden = true;
      var r = pk.anchor.getBoundingClientRect(), pw = el.offsetWidth, ph = el.offsetHeight;
      var x = Math.max(10, Math.min(vw - pw - 10, r.left + r.width / 2 - pw / 2)), y = r.bottom + 12;
      if (y + ph > vh - 10) y = r.top - ph - 12;
      if (y < 10) y = Math.max(10, vh - ph - 10);
      el.style.left = x + "px"; el.style.top = y + "px";
    }
    function followPicker() {
      if (window.innerWidth <= 640) return;   /* auf dem Handy ist die Auswahl ein Blatt am unteren Rand und bleibt, wo sie ist */
      if (!pk.anchor || !pk.anchor.isConnected) { closePicker(); return; }
      var r = pk.anchor.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) { closePicker(); return; }
      placePicker();
    }
    function fillPicker() {
      var el = pk.el, s = spotById[pk.sid], cur = gOf(pk.sid);
      if (!s) { closePicker(); return; }
      var cv = el.querySelector(".gp-cur");
      if (cur) { cv.style.visibility = ""; drawFit(cv, cur.s, 54, 72); el.querySelector(".gp-name").textContent = "#" + cur.n + " " + cur.s.name; el.querySelector(".gp-meta").textContent = (D.groups[cur.grp] || "") + " · ab Level " + cur.lv; }
      else { cv.style.visibility = "hidden"; cv.width = 1; cv.height = 1; cv.style.width = "54px"; cv.style.height = "40px"; el.querySelector(".gp-name").textContent = has(pk.sid) ? "Leer gelassen" : "Freier Platz"; el.querySelector(".gp-meta").textContent = (WHERE[s.sec] ? WHERE[s.sec] + " · " : "") + (s.type === "gap" ? "Platz in einer Lücke: der Gast lugt zum Teil hervor" : "Platz für " + (s.cls === 1 ? "kleine" : s.cls === 2 ? "mittelgroße" : "große") + " Gäste"); }
      el.querySelector(".gp-hint").textContent = cur ? "Tausche diesen Gast gegen einen, den du schon freigeschaltet hast, oder lass den Platz leer." : "Wähle einen freigeschalteten Gast, der hier stehen soll.";
      el.querySelector(".gp-clear").hidden = !cur;
      Array.prototype.forEach.call(el.querySelectorAll(".gp-chip"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.f === pk.f)); });
      var q = pk.q.trim().toLowerCase().replace(/^#/, ""), list = gs.filter(function (g) {
        if (!unlocked(g)) return false;
        if (pk.grp && g.grp !== pk.grp) return false;
        if (pk.f === "frei" && shownAt(g.k) && g.k !== st.slots[pk.sid]) return false;
        if (pk.f === "neu" && g.lv !== level && g.fresh <= Date.now()) return false;
        if (q && String(g.n) !== q && g.s.name.toLowerCase().indexOf(q) < 0) return false;
        return true;
      });
      list.sort(function (a, b) { return (!!shownAt(a.k) - !!shownAt(b.k)) || b.lv - a.lv || a.n - b.n; });
      var grid = el.querySelector(".gp-grid"), frag = document.createDocumentFragment();
      list.forEach(function (g) {
        var b = document.createElement("button"), at = shownAt(g.k), isCur = g.k === st.slots[pk.sid], ok = !!fitK(g, s) && (isCur || !at || !cur || !!fitK(cur, at));
        b.type = "button"; b.className = "gp-it" + (isCur ? " cur" : "") + (at && !isCur ? " shown" : "") + (!ok && !isCur ? " dis" : ""); b.dataset.k = g.k;
        b.title = "#" + g.n + " " + g.s.name + (isCur ? " (steht hier)" : at ? " (steht schon woanders, tauscht die Plätze)" : "") + (!ok && !isCur ? " · passt hier nicht rein" : "");
        var c2 = document.createElement("canvas"); b.appendChild(c2); var nb = document.createElement("i"); nb.textContent = "#" + g.n; b.appendChild(nb);
        drawFit(c2, g.s, 40, 48); frag.appendChild(b);
      });
      grid.innerHTML = ""; grid.appendChild(frag);
      if (!list.length) grid.innerHTML = '<p class="gp-empty">Nichts gefunden.</p>';
    }

    /* ---------- Bearbeiten-Modus: alle Plaetze sichtbar, leere mit Plus ---------- */
    function armBtn(btn, text, fn) {
      var armed = 0, label = btn.textContent;
      btn.addEventListener("click", function () {
        if (armed) { clearTimeout(armed); armed = 0; btn.textContent = label; btn.classList.remove("armed"); fn(); return; }
        btn.textContent = "SICHER? NOCHMAL"; btn.classList.add("armed");
        armed = setTimeout(function () { armed = 0; btn.textContent = label; btn.classList.remove("armed"); }, 3200);
      });
    }
    function ensureBar() {
      if (bar) return bar;
      bar = document.createElement("div"); bar.className = "g-bar"; bar.hidden = true; bar.setAttribute("role", "toolbar"); bar.setAttribute("aria-label", "Easter-Egg-Plätze bearbeiten");
      bar.innerHTML = '<span class="t" id="gbInfo"></span><button type="button" class="gt-btn go" id="gbDone">FERTIG</button><button type="button" class="gt-btn" id="gbAuto"></button><button type="button" class="gt-btn" id="gbReset">ZURÜCKSETZEN</button><button type="button" class="gt-btn" id="gbClear">ALLE LEEREN</button>';
      document.body.appendChild(bar);
      $("gbDone").addEventListener("click", function () { setEdit(false); });
      $("gbAuto").addEventListener("click", function () { setAuto(st.auto === false); });
      armBtn($("gbReset"), "", reset); armBtn($("gbClear"), "", clearAll);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && editMode && !pickerOpen() && !tr.open) setEdit(false); });
      return bar;
    }
    function updateBar() {
      if (!bar) return;
      var filled = shownCount(), total = spotsAct.length;
      $("gbInfo").innerHTML = "EASTER-EGG-PLÄTZE · <b>" + filled + "</b> belegt · <b>" + Math.max(0, total - filled) + "</b> frei";
      $("gbAuto").textContent = st.auto === false ? "AUTOMATIK: AUS" : "AUTOMATIK: AN";
      $("gbAuto").setAttribute("aria-pressed", String(st.auto !== false));
    }
    function setEdit(on) {
      editMode = !!on; ensureBar(); bar.hidden = !editMode; document.documentElement.classList.toggle("g-edit", editMode);
      if (editMode) { closePicker(); closeTree(); if (!enabled) api.setEnabled(true); }
      sync(); updateBar();
    }

    /* ---------- Skilltree (Klick auf die Level-Anzeige) ---------- */
    var tr = { el: null, f: "alle", q: "", sel: "", open: false };
    var TIERS = [0, 5, 10, 15, 20, 25, 30];
    function ensureTree() {
      if (tr.el) return tr.el;
      var ov = document.createElement("div"); ov.className = "overlay g-tree"; ov.id = "guestTree";
      ov.innerHTML = '<div class="modal modal-wide gt-modal" role="dialog" aria-modal="true" aria-labelledby="gtTitle">' +
        '<div class="modal-head"><h2 id="gtTitle">Skilltree</h2><button class="modal-close" id="gtClose" type="button" aria-label="Schließen">×</button></div>' +
        '<div class="gt-top"><div class="gt-lv"><b class="gt-ln"></b><span class="gt-rk"></span><span class="gt-xp xp"></span><span class="gt-xn"></span></div><div class="gt-stats"></div></div>' +
        '<div class="gt-tools"><div class="gt-chips" id="gtChips" role="group" aria-label="Filter"></div><input type="search" class="gt-q" id="gtQ" placeholder="Nr. oder Name" aria-label="Suchen">' +
        '<div class="gt-acts"><button type="button" class="gt-btn go" id="gtEdit">PLÄTZE BEARBEITEN</button><button type="button" class="gt-btn" id="gtNow">ZUM AKTUELLEN LEVEL</button><button type="button" class="gt-btn" id="gtShuf">NEU MISCHEN</button><button type="button" class="gt-btn" id="gtSw"></button></div></div>' +
        '<div class="gt-body" id="gtBody"></div><div class="gt-det" id="gtDet"></div></div>';
      document.body.appendChild(ov); tr.el = ov;
      ov.addEventListener("click", function (e) { if (e.target === ov) closeTree(); });
      $("gtClose").addEventListener("click", closeTree);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && tr.open && !pickerOpen()) closeTree(); });
      $("gtChips").addEventListener("click", function (e) { var b = e.target.closest("button"); if (!b) return; tr.f = b.dataset.f; treeFilter(); });
      $("gtQ").addEventListener("input", function () { tr.q = this.value; treeFilter(); });
      $("gtEdit").addEventListener("click", function () { closeTree(); setEdit(true); });
      $("gtNow").addEventListener("click", function () { scrollTreeTo(level); });
      $("gtShuf").addEventListener("click", function () { shuffle(); buildTree(); });
      $("gtSw").addEventListener("click", function () { api.setEnabled(!enabled); buildTree(); });
      $("gtBody").addEventListener("click", function (e) {
        var c = e.target.closest(".gt-cell"); if (c) { tr.sel = c.dataset.k; treeSelect(); return; }
        var eg = e.target.closest(".gt-egg.on"); if (eg && window.Scenery && window.Scenery.open) { closeTree(); window.Scenery.open(); }
      });
      $("gtDet").addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return; var key = tr.sel, g = byKey[key]; if (!g) return;
        if (b.dataset.a === "go") { closeTree(); setTimeout(function () { goTo(key); }, 60); }
        else if (b.dataset.a === "rm") { var at = shownAt(key); if (at) { st.slots[at.id] = ""; st.pins[at.id] = 1; saveState(); sync(); buildTree(); } }
        else if (b.dataset.a === "eq") {
          var r = equip(key);
          if (r === "neu") { buildTree(); closeTree(); setTimeout(function () { goTo(key); }, 80); }
          else note("KEIN PLATZ", "Für diesen Gast ist gerade kein Platz frei, der groß genug ist.");
        }
      });
      return ov;
    }
    function treeStats() {
      var eggs = window.Scenery && window.Scenery.eggs ? window.Scenery.eggs() : [], eu = eggs.filter(function (e) { return e.lv <= level; }).length;
      return '<span>GÄSTE <b>' + count() + '/' + gs.length + '</b></span>' + (eggs.length ? '<span>BILD-EGGS <b>' + eu + '/' + eggs.length + '</b></span>' : "") + '<span>IM DASHBOARD <b>' + shownCount() + '</b></span><span>PLÄTZE <b>' + spotsAct.length + '</b></span>';
    }
    function buildTree() {
      ensureTree();
      var box = $("lvlBox"), ov = tr.el;
      ov.querySelector(".gt-ln").textContent = "LVL " + level;
      ov.querySelector(".gt-rk").textContent = rankOf(level).toUpperCase();
      var xp = box && box.querySelector(".xp"), xn = box && box.querySelector(".lvl-avg");
      ov.querySelector(".gt-xp").innerHTML = xp ? xp.innerHTML : ""; ov.querySelector(".gt-xn").textContent = xn ? xn.textContent : "";
      ov.querySelector(".gt-stats").innerHTML = treeStats();
      $("gtChips").innerHTML = [["alle", "ALLE"], ["frei", "FREIGESCHALTET"], ["zu", "GESPERRT"], ["bild", "IM DASHBOARD"]].map(function (f) { return '<button type="button" class="gt-chip" data-f="' + f[0] + '" aria-pressed="' + (f[0] === tr.f) + '">' + f[1] + "</button>"; }).join("");
      $("gtSw").textContent = enabled ? "GÄSTE AUSBLENDEN" : "GÄSTE EINBLENDEN";
      var eggs = window.Scenery && window.Scenery.eggs ? window.Scenery.eggs() : [], eggAt = {}; eggs.forEach(function (e) { eggAt[e.lv] = e; });
      var byLv = {}; gs.forEach(function (g) { (byLv[g.lv] = byLv[g.lv] || []).push(g); });
      Object.keys(byLv).forEach(function (l) { byLv[l].sort(function (a, b) { return a.n - b.n; }); });
      var html = "";
      for (var L = 1; L <= 30; L++) {
        if (L === 1 || TIERS.indexOf(L) >= 0) {
          var t0 = L === 1 ? 0 : L, t1 = L === 1 ? 4 : (L === 30 ? 30 : L + 4);
          html += '<h3 class="gt-tier' + (level >= t0 ? " on" : "") + '"><span>' + esc(rankOf(t0).toUpperCase()) + "</span><i>" + (t0 === 30 ? "AB LVL 30" : "LVL " + t0 + "–" + t1) + "</i>" + (L !== 1 && level >= t0 ? '<em>RANG ERREICHT</em>' : "") + "</h3>";
        }
        var list = byLv[L] || [], eg = eggAt[L], st2 = level > L ? "reached" : level === L ? "current" : "locked", th = THEME[L];
        html += '<div class="gt-row ' + st2 + '" data-lv="' + L + '"><div class="gt-rail"><span class="gt-node">' + L + '</span></div><div class="gt-box"><div class="gt-lh"><b>LEVEL ' + L + "</b>" + (th ? '<strong class="gt-th">' + esc(th.t) + "</strong>" : "") + "<span>" + list.length + (list.length === 1 ? " Gast" : " Gäste") + (th ? " · " + KIND[th.k] : "") + "</span>" +
          (st2 === "current" ? '<em>DU BIST HIER</em>' : st2 === "locked" ? '<em class="lk">NOCH ' + (L - level) + " LEVEL</em>" : "") + "</div>";
        if (eg) html += '<div class="gt-egg ' + (eg.lv <= level ? "on" : "off") + '"><i>◆</i> BILD-EGG · ' + (eg.lv <= level ? esc(eg.name) : "???") + "</div>";
        html += '<div class="gt-cells">';
        list.forEach(function (g) {
          var on = unlocked(g), at = shownAt(g.k);
          html += '<button type="button" class="gt-cell ' + (on ? "on" : "off") + (at ? " im" : "") + (g.lv === level ? " nw" : "") + (tr.sel === g.k ? " sel" : "") + '" data-k="' + g.k + '" title="' + (on ? "#" + g.n + " " + esc(g.s.name) : "#" + g.n + " · noch gesperrt") + '"><canvas></canvas><b>#' + g.n + "</b></button>";
        });
        html += "</div></div></div>";
      }
      html += '<p class="gt-end">Ab Level 35 folgen die Ränge Champion, Legende (40) und Mythos (50). Neue Gäste gibt es bis Level 30.</p>';
      $("gtBody").innerHTML = html;
      Array.prototype.forEach.call($("gtBody").querySelectorAll(".gt-cell"), function (c) { var g = byKey[c.dataset.k]; drawFit(c.querySelector("canvas"), g.s, 40, 46, !unlocked(g)); });
      treeFilter(); treeSelect();
    }
    function treeFilter() {
      var body = $("gtBody"), q = tr.q.trim().toLowerCase().replace(/^#/, "");
      Array.prototype.forEach.call($("gtChips").querySelectorAll(".gt-chip"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.f === tr.f)); });
      Array.prototype.forEach.call(body.querySelectorAll(".gt-row"), function (row) {
        var vis = 0, th = THEME[+row.dataset.lv], themeHit = !!(q && th && th.t.toLowerCase().indexOf(q) >= 0);
        Array.prototype.forEach.call(row.querySelectorAll(".gt-cell"), function (c) {
          var g = byKey[c.dataset.k], on = unlocked(g), m = true;
          if (tr.f === "frei") m = on; else if (tr.f === "zu") m = !on; else if (tr.f === "bild") m = !!shownAt(g.k);
          if (m && q) m = themeHit || String(g.n) === q || (on && g.s.name.toLowerCase().indexOf(q) >= 0);
          c.hidden = !m; if (m) vis++;
        });
        var egg = row.querySelector(".gt-egg"), filtering = tr.f !== "alle" || !!q;
        row.hidden = filtering && vis === 0;
        if (egg) egg.hidden = filtering;
      });
      Array.prototype.forEach.call(body.querySelectorAll(".gt-tier"), function (h) {
        var n = h.nextElementSibling, any = false; while (n && !n.classList.contains("gt-tier")) { if (n.classList.contains("gt-row") && !n.hidden) any = true; n = n.nextElementSibling; }
        h.hidden = !any;
      });
    }
    function treeSelect() {
      var det = $("gtDet"), g = byKey[tr.sel];
      Array.prototype.forEach.call($("gtBody").querySelectorAll(".gt-cell"), function (c) { c.classList.toggle("sel", c.dataset.k === tr.sel); });
      if (!g) { det.innerHTML = '<span class="gt-hint">Tippe auf einen Gast: Name, Level und wo er steht. Freigeschaltete kannst du direkt ins Dashboard setzen.</span>'; return; }
      var on = unlocked(g), at = shownAt(g.k), where = at && WHERE[at.sec] ? WHERE[at.sec] : "", th = THEME[g.lv];
      det.innerHTML = '<canvas class="gt-dc"></canvas><div class="gt-di"><b>#' + g.n + " " + (on ? esc(g.s.name) : "???") + "</b><span>" + esc(D.groups[g.grp] || "") + " · Level " + g.lv + (th ? " · " + esc(th.t) : "") + "</span><span>" +
        (on ? (at ? "Steht gerade im Dashboard" + (where ? " (" + esc(where) + ")" : "") + "." : "Wartet im Skilltree – setz ihn ins Dashboard.") : "Noch gesperrt: kommt bei Level " + g.lv + " (noch " + (g.lv - level) + " Level).") + "</span></div>" +
        (on ? '<div class="gt-da">' + (at ? '<button type="button" class="gt-btn go" data-a="go">ZEIG MIR, WO</button><button type="button" class="gt-btn" data-a="rm">AUS DEM DASHBOARD NEHMEN</button>' : '<button type="button" class="gt-btn go" data-a="eq">INS DASHBOARD SETZEN</button>') + "</div>" : "");
      drawFit(det.querySelector(".gt-dc"), g.s, 64, 76, !on);
    }
    function scrollTreeTo(L) {
      var b = $("gtBody"), row = b && b.querySelector('.gt-row[data-lv="' + Math.max(1, Math.min(30, L)) + '"]'); if (!row) return;
      var sc = window.innerWidth <= 700 ? tr.el.querySelector(".gt-modal") : b;   /* auf dem Handy scrollt das ganze Blatt */
      var y = row.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - (sc === b ? 8 : 64);
      sc.scrollTo({ top: Math.max(0, y), behavior: "auto" });
    }
    function openTree() {
      ensureTree(); closePicker(); if (tip) tip.hidden = true; if (editMode) setEdit(false); buildTree();
      tr.open = true; tr.el.classList.add("open"); document.body.classList.add("g-lock");
      scrollTreeTo(Math.max(1, level)); var x = $("gtClose"); if (x) x.focus({ preventScroll: true });
    }
    function closeTree() { if (!tr.el) return; tr.open = false; tr.el.classList.remove("open"); document.body.classList.remove("g-lock"); }
    function bindLevelBox() {
      var box = $("lvlBox"); if (!box || box.dataset.gt) return; box.dataset.gt = "1";
      box.classList.add("g-lvlbtn"); box.setAttribute("role", "button"); box.setAttribute("tabindex", "0");
      box.addEventListener("click", function () { openTree(); });
      box.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openTree(); } });
      var tt = function () { if (box.title && box.title.indexOf("Skilltree") < 0) box.title += " · Klick: Skilltree"; };
      box.addEventListener("mouseenter", tt); box.addEventListener("focus", tt);
    }

    /* ---------- Hinweis bei neuen Gaesten ---------- */
    function announce(list) {
      var until = Date.now() + 15000, hid = list.filter(function (g) { return !!shownAt(g.k); }).length;
      list.forEach(function (g) { g.fresh = until; });
      sync(); setTimeout(function () { sync(); }, 15200);
      if (toastEl) toastEl.remove();
      var lvls = {}; list.forEach(function (g) { lvls[g.lv] = 1; });
      var ths = Object.keys(lvls).map(function (l) { return THEME[+l]; }).filter(Boolean);
      var title = ths.length === 1 ? "NEUES THEMA" : (list.length > 1 ? list.length + " NEUE GÄSTE" : "NEUER GAST");
      var b = document.createElement("button"); b.type = "button"; b.className = "g-toast"; toastEl = b;
      var shown = list.slice(0, 6);
      b.innerHTML = '<span class="k">' + title + '</span><span class="th"></span><span class="v">' + esc(ths.length === 1 ? ths[0].t : shown.slice(0, 3).map(function (g) { return g.s.name; }).join(", ") + (list.length > 3 ? " …" : "")) + '</span><span class="sub">' + list.length + (list.length === 1 ? " neuer Gast" : " neue Gäste") + ": " +
        (hid ? (hid === 1 ? "1 steht jetzt im Dashboard" : hid + " stehen jetzt im Dashboard") : "") + (hid && list.length > hid ? ", " : "") + (list.length > hid ? (list.length - hid === 1 ? "1 wartet im Skilltree" : (list.length - hid) + " warten im Skilltree") : "") + '</span><span class="h">SKILLTREE ▸</span>';
      var row = b.querySelector(".th");
      shown.forEach(function (g) { var c = document.createElement("canvas"); c.className = "tc"; drawFit(c, g.s, 40, 40); row.appendChild(c); });
      b.addEventListener("click", function () { b.remove(); toastEl = null; openTree(); });
      var sb = document.querySelector(".scn-toast"); if (sb) b.style.bottom = (22 + sb.offsetHeight + 12) + "px";   /* nicht ueber dem Hinweis "Neues Easter Egg" der Landschaft */
      document.body.appendChild(b);
      setTimeout(function () { if (toastEl === b) { b.classList.add("out"); setTimeout(function () { b.remove(); if (toastEl === b) toastEl = null; }, 400); } }, 9500);
    }

    /* ---------- Level ---------- */
    function applyLevel(n) {
      n = Math.max(0, n | 0);
      var seenRaw = lsGet(STORE_SEEN), seen = seenRaw === null ? null : +seenRaw, before = level;
      level = n;
      var fresh = [];
      if (seen !== null && n > seen) fresh = gs.filter(function (g) { return g.lv > seen && g.lv <= n; });
      if (seen === null || n !== seen) lsSet(STORE_SEEN, String(n));
      render({ fresh: built ? fresh : [] });
      if (tr.open) buildTree();
      if (fresh.length && built && enabled) announce(fresh);
      return before;
    }
    function setLevel(n) { if (!cloudReady) { pendingLevel = n; return; } applyLevel(n); }
    document.addEventListener("cloud-ready", function () { cloudReady = true; if (pendingLevel !== null) { var n = pendingLevel; pendingLevel = null; applyLevel(n); } });

    /* ---------- Start ---------- */
    var relayoutT = 0;
    function relayout() { clearTimeout(relayoutT); relayoutT = setTimeout(function () { var kb = k; scale(); if (k !== kb) redrawAll(); render(); if (pickerOpen()) followPicker(); }, 130); }
    function build() {
      if (built) return;
      scale(); ensureLayer(); setupObserver(); bindLevelBox(); built = true;
      render();
      window.addEventListener("resize", relayout);
      if (window.ResizeObserver) {
        ro = new ResizeObserver(relayout);
        var main = document.querySelector("main"); if (main) ro.observe(main);
        ro.observe(document.body);
        var ti = document.querySelector(".topbar-inner"); if (ti) { ro.observe(ti); Array.prototype.forEach.call(ti.children, function (c) { ro.observe(c); }); }
      }
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
      window.addEventListener("load", relayout);
      document.addEventListener("scenery-ready", relayout);
      setInterval(tick, 80);
      try { document.dispatchEvent(new CustomEvent("guests-ready")); } catch (e) { /* egal */ }
    }
    function start() { var go = function () { if (!built) build(); }; if (window.requestAnimationFrame) requestAnimationFrame(function () { setTimeout(go, 40); }); setTimeout(go, 700); }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

    var api = {
      setLevel: setLevel, open: openTree, close: closeTree, level: function () { return level; }, ready: function () { return built; },
      setEnabled: function (on) { enabled = !!on; lsSet(STORE_OFF, enabled ? "0" : "1"); render(); if (tr.open) buildTree(); },
      mark: function (on) { markNow = !!on; sync(); },
      shuffle: shuffle, edit: function (on) { setEdit(on !== false); }, reset: reset, clear: clearAll, auto: setAuto,
      debug: function (on) { dbgOn = on !== false; if (!dbgOn && dbgEl) { dbgEl.remove(); dbgEl = null; } else if (dbgOn && layer) drawDebug(); },
      info: function () { return { level: level, unlocked: count(), total: gs.length, atLevel: gs.filter(function (g) { return g.lv === level; }).length, shown: shownCount(), spots: spotsAct.length, candidates: lastScan ? lastScan.all : 0, auto: st.auto !== false }; },
      list: function () { return D.list; }, relayout: relayout
    };
    window.Guests = api;
    return api;
  };
})();
