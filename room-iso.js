/* Isometrischer Pixel-Renderer fuer das Raum-Minigame (room.js, Teile in room-items.js). Zeichnet Quader und Zylinder Pixel fuer Pixel in einen
   Puffer (ohne Kantenglaettung, also gestochen scharf) und macht daraus kleine Bilder, die room.js zu einem Raum zusammensetzt.
   Raster: 1 Feld = 8 x 8 Einheiten (u) = 32 x 16 Pixel am Boden. Projektion (2:1): Bildschirm-x = (X - Y) * 2, Bildschirm-y = X + Y - Z.
   X laeuft nach rechts unten, Y nach links unten, Z ist die Hoehe in Pixeln. Sichtbar sind die Oberseite, die Seite mit Normale +Y (links unten,
   hell) und die Seite mit Normale +X (rechts unten, dunkel). Die "Vorderseite" eines Teils zeigt also nach +Y; gespiegelt (Drehen) nach +X. */
(function () {
  "use strict";
  const U = 8;
  const PX = (X, Y) => (X - Y) * 2;
  const PY = (X, Y, Z) => X + Y - Z;

  /* ---------- Farben ---------- */
  const hexCache = {};
  function rgb(c) {
    if (Array.isArray(c)) return c;
    let v = hexCache[c];
    if (!v) { const n = parseInt(String(c).slice(1), 16); v = hexCache[c] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
    return v;
  }
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  // Aufhellen (f > 0, Richtung warmes Weiss) und Abdunkeln (f < 0, Richtung kuehles Violett): Schatten bleiben farbig statt grau
  function shade(c, f) {
    const [r, g, b] = rgb(c);
    if (f >= 0) return [clamp(r + (255 - r) * f), clamp(g + (244 - g) * f), clamp(b + (222 - b) * f)];
    const k = -f;
    return [clamp(r * (1 - k) + 36 * k), clamp(g * (1 - k) + 24 * k), clamp(b * (1 - k) + 62 * k)];
  }
  const F_TOP = 0.2, F_LEFT = 0, F_RIGHT = -0.24;

  /* ---------- Puffer ---------- */
  function Raster(minX, minY, w, h) {
    this.minX = minX; this.minY = minY; this.w = w; this.h = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
  Raster.prototype.set = function (x, y, c) {
    const ix = x - this.minX, iy = y - this.minY;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return;
    const i = (iy * this.w + ix) * 4, d = this.data;
    d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  };
  Raster.prototype.alphaAt = function (x, y) {
    const ix = x - this.minX, iy = y - this.minY;
    if (ix < 0 || iy < 0 || ix >= this.w || iy >= this.h) return 0;
    return this.data[(iy * this.w + ix) * 4 + 3];
  };

  // Gefuelltes konvexes Vieleck: ein Pixel gehoert dazu, wenn seine Mitte innen liegt (bei ganzzahligen Ecken und den 2:1-Kanten nie genau auf einer Kante,
  // daher keine Luecken und keine Doppelungen zwischen benachbarten Flaechen). colorAt(x, y, cx, cy) liefert die Farbe oder null.
  function fillPoly(R, pts, colorAt) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach((p) => { if (p[0] < x0) x0 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[0] > x1) x1 = p[0]; if (p[1] > y1) y1 = p[1]; });
    const n = pts.length;
    for (let y = Math.floor(y0); y < Math.ceil(y1); y++) {
      for (let x = Math.floor(x0); x < Math.ceil(x1); x++) {
        const cx = x + 0.5, cy = y + 0.5;
        let sign = 0, inside = true;
        for (let i = 0; i < n; i++) {
          const a = pts[i], b = pts[(i + 1) % n];
          const cr = (b[0] - a[0]) * (cy - a[1]) - (b[1] - a[1]) * (cx - a[0]);
          if (cr === 0) continue;
          const s = cr > 0 ? 1 : -1;
          if (sign === 0) sign = s; else if (s !== sign) { inside = false; break; }
        }
        if (inside) { const col = colorAt(x, y, cx, cy); if (col) R.set(x, y, col); }
      }
    }
  }

  /* ---------- Quader ---------- */
  const scr = (P) => [PX(P[0], P[1]), PY(P[0], P[1], P[2])];
  function boxFaces(b) {
    const { x, y, z, w, d, h } = b;
    return {
      top: [[x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]],
      L: [[x, y + d, z], [x + w, y + d, z], [x + w, y + d, z + h], [x, y + d, z + h]],
      R: [[x + w, y, z], [x + w, y + d, z], [x + w, y + d, z + h], [x + w, y, z + h]]
    };
  }
  // Textur: Funktion (pu, pv, fu, fv) -> Farbe | null (durchsichtig) | undefined (Grundfarbe). pu/pv = ganzzahlige Pixel auf der Flaeche (pu waagerecht
  // in halben Einheiten, pv senkrecht in Pixeln; auf der Oberseite pu entlang X, pv entlang Y), fu/fv dieselben Werte als Kommazahl in Einheiten.
  function drawBox(R, b) {
    const f = boxFaces(b);
    const base = b.c;
    const colT = b.ct ? rgb(b.ct) : shade(base, F_TOP), colL = b.cl ? rgb(b.cl) : shade(base, F_LEFT), colR = b.cr ? rgb(b.cr) : shade(base, F_RIGHT);
    const pick = (tex, du, dv, fl, fallback, cx, cy, face) => {
      if (!tex) return fallback;
      const t = tex(Math.floor(du * 2), Math.floor(dv), du, dv, cx, cy);
      if (t === undefined) return fallback;
      return t === null ? null : shade(t, fl);
    };
    if (!b.skipTop) {
      const Zt = b.z + b.h;
      fillPoly(R, f.top.map(scr), (px, py, cx, cy) => {
        if (!b.tt) return colT;
        const X = ((cy + Zt) + cx / 2) / 2, Y = ((cy + Zt) - cx / 2) / 2;
        return pick(b.tt, X - b.x, Y - b.y, F_TOP, colT);
      });
    }
    if (!b.skipL) {
      const Y0 = b.y + b.d;
      fillPoly(R, f.L.map(scr), (px, py, cx, cy) => {
        if (!b.tl) return colL;
        const X = cx / 2 + Y0, Z = X + Y0 - cy;
        return pick(b.tl, X - b.x, Z - b.z, F_LEFT, colL);
      });
    }
    if (!b.skipR) {
      const X0 = b.x + b.w;
      fillPoly(R, f.R.map(scr), (px, py, cx, cy) => {
        if (!b.tr) return colR;
        const Y = X0 - cx / 2, Z = X0 + Y - cy;
        return pick(b.tr, Y - b.y, Z - b.z, F_RIGHT, colR);
      });
    }
  }

  /* ---------- Zylinder (Mittelpunkt x,y in Einheiten, Radius r in Einheiten) ---------- */
  function drawCyl(R, b) {
    const cxs = PX(b.x, b.y), a = 2 * Math.SQRT2 * b.r, bb = Math.SQRT2 * b.r, baseY = PY(b.x, b.y, b.z);
    const c = b.c;
    const bands = [shade(c, 0.14), shade(c, 0), shade(c, -0.2), shade(c, -0.36)];
    const colT = b.ct ? rgb(b.ct) : shade(c, F_TOP);
    for (let x = Math.floor(cxs - a); x < Math.ceil(cxs + a); x++) {
      const dx = (x + 0.5 - cxs) / a;
      if (Math.abs(dx) >= 1) continue;
      const wv = bb * Math.sqrt(1 - dx * dx);
      const yTop = baseY - b.h - wv, yBot = baseY + wv;
      const side = dx < -0.45 ? bands[0] : dx < 0.15 ? bands[1] : dx < 0.6 ? bands[2] : bands[3];
      for (let y = Math.floor(yTop); y < Math.ceil(yBot); y++) {
        const cy = y + 0.5;
        if (cy < yTop || cy > yBot) continue;
        const isTop = !b.noTop && cy <= baseY - b.h + wv;
        if (isTop && b.ring && Math.abs(dx) < b.ring && cy > baseY - b.h - wv * b.ring && cy < baseY - b.h + wv * b.ring) continue; // hohle Oeffnung
        R.set(x, y, isTop ? (b.tc ? rgb(b.tc(dx, (cy - (baseY - b.h)) / bb) || colT) : colT) : side);
      }
    }
  }

  /* ---------- Vielecke (frei im Raum, z.B. Wandbilder mit schraegen Kanten) ---------- */
  function drawPoly(R, p) {
    const pts = p.pts.map(scr);
    const col = rgb(p.c);
    fillPoly(R, pts, () => col);
  }

  /* ---------- Spiegeln (Drehen): X und Y vertauschen, die Texturen wandern mit ihren Flaechen ---------- */
  function mirrorPrim(p) {
    if (p.k === "b") {
      const m = Object.assign({}, p, { x: p.y, y: p.x, w: p.d, d: p.w });
      m.cl = p.cr; m.cr = p.cl; m.tl = p.tr; m.tr = p.tl; m.skipL = p.skipR; m.skipR = p.skipL;
      if (p.tt) m.tt = (pu, pv, fu, fv, cx, cy) => p.tt(pv, pu, fv, fu, cx, cy);
      return m;
    }
    if (p.k === "c") return Object.assign({}, p, { x: p.y, y: p.x });
    if (p.k === "p") return Object.assign({}, p, { pts: p.pts.map((q) => [q[1], q[0], q[2]]) });
    return p;
  }
  const mirror = (prims) => prims.map(mirrorPrim);

  /* ---------- Begrenzung und Rendern ---------- */
  function bounds(prims) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const add = (sx, sy) => { if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy; };
    prims.forEach((p) => {
      if (p.k === "b") {
        [p.x, p.x + p.w].forEach((X) => [p.y, p.y + p.d].forEach((Y) => [p.z, p.z + p.h].forEach((Z) => add(PX(X, Y), PY(X, Y, Z)))));
      } else if (p.k === "c") {
        const cx = PX(p.x, p.y), a = 2 * Math.SQRT2 * p.r, bb = Math.SQRT2 * p.r, by = PY(p.x, p.y, p.z);
        add(cx - a, by - p.h - bb); add(cx + a, by + bb);
      } else if (p.k === "p") {
        p.pts.forEach((q) => add(PX(q[0], q[1]), PY(q[0], q[1], q[2])));
      }
    });
    return { x0: Math.floor(x0), y0: Math.floor(y0), x1: Math.ceil(x1), y1: Math.ceil(y1) };
  }

  const OUTLINE = [28, 20, 38];
  function addOutline(R, col) {
    const { w, h, data } = R, src = new Uint8ClampedArray(data);
    const a = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : src[(y * w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[(y * w + x) * 4 + 3]) continue;
        if (a(x - 1, y) || a(x + 1, y) || a(x, y - 1) || a(x, y + 1)) {
          const i = (y * w + x) * 4;
          data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
        }
      }
    }
  }

  // prims: Liste aus { k: "b" | "c" | "p", ... } in Zeichenreihenfolge (hinten und unten zuerst).
  // Ergebnis: { canvas, data, w, h, ox, oy } mit (ox, oy) = Lage des Welt-Nullpunkts im Bild.
  function render(prims, opts) {
    opts = opts || {};
    const pad = opts.outline === false ? 1 : 2;
    const bb = bounds(prims);
    const R = new Raster(bb.x0 - pad, bb.y0 - pad, bb.x1 - bb.x0 + 2 * pad, bb.y1 - bb.y0 + 2 * pad);
    prims.forEach((p) => { if (p.k === "b") drawBox(R, p); else if (p.k === "c") drawCyl(R, p); else if (p.k === "p") drawPoly(R, p); });
    if (opts.outline !== false) addOutline(R, opts.outlineColor ? rgb(opts.outlineColor) : OUTLINE);
    const canvas = document.createElement("canvas");
    canvas.width = R.w; canvas.height = R.h;
    canvas.getContext("2d").putImageData(new ImageData(R.data, R.w, R.h), 0, 0);
    return { canvas, data: R.data, w: R.w, h: R.h, ox: -R.minX, oy: -R.minY };
  }

  // Umriss in einer Farbe (zum Hervorheben): das Bild eine Stufe dicker, nur die Silhouette
  function silhouette(sprite, color) {
    const w = sprite.w + 2, h = sprite.h + 2, d = new Uint8ClampedArray(w * h * 4), col = rgb(color);
    const a = (x, y) => (x < 0 || y < 0 || x >= sprite.w || y >= sprite.h ? 0 : sprite.data[(y * sprite.w + x) * 4 + 3]);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = x - 1, sy = y - 1;
        if (a(sx, sy) || a(sx - 1, sy) || a(sx + 1, sy) || a(sx, sy - 1) || a(sx, sy + 1)) {
          const i = (y * w + x) * 4;
          d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
        }
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    canvas.getContext("2d").putImageData(new ImageData(d, w, h), 0, 0);
    return { canvas, w, h, ox: sprite.ox + 1, oy: sprite.oy + 1 };
  }

  /* ---------- Schreibhilfen fuer Teile (room-items.js) ---------- */
  const B = (x, y, z, w, d, h, c, o) => Object.assign({ k: "b", x, y, z, w, d, h, c }, o);
  const C = (x, y, z, r, h, c, o) => Object.assign({ k: "c", x, y, z, r, h, c }, o);
  const P = (pts, c) => ({ k: "p", pts, c });

  // Kleine Zufallszahl aus ganzen Zahlen (fuer Muster, die "zufaellig" aussehen, aber immer gleich sind)
  function hash(a, b, c) {
    let h = (a * 374761393 + (b || 0) * 668265263 + (c || 0) * 2147483647) | 0;
    h = (h ^ (h >> 13)) * 1274126177 | 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  /* ---------- Raum-Huelle: Boden, Bodenkante und zwei Waende ---------- */
  // floorFn(X, Y) -> Farbe (Boden-Muster in Einheiten), wallFn(pu, pv, fu, fv, side) -> Farbe (Wand-Muster; side "R" = rechte Wand, "L" = linke)
  function renderShell(o) {
    const cols = o.cols, rows = o.rows, WH = o.wallH, SL = o.slab, T = 2;
    const prims = [];
    // linke Wand (Ebene X = 0), rechte Wand (Ebene Y = 0), dann der Boden mit Kante
    prims.push(B(-T, 0, 0, T, rows * U, WH, o.wallColor, { tr: (pu, pv, fu, fv, cx, cy) => o.wallFn(pu, pv, fu, fv, "L"), ct: shade(o.wallColor, 0.25), cl: shade(o.wallColor, -0.1) }));
    prims.push(B(0, -T, 0, cols * U, T, WH, o.wallColor, { tl: (pu, pv, fu, fv, cx, cy) => o.wallFn(pu, pv, fu, fv, "R"), ct: shade(o.wallColor, 0.25), cr: shade(o.wallColor, -0.3) }));
    prims.push(B(-T, -T, 0, T, T, WH, o.wallColor, { ct: shade(o.wallColor, 0.25), cl: shade(o.wallColor, -0.1), cr: shade(o.wallColor, -0.3) }));
    prims.push(B(0, 0, -SL, cols * U, rows * U, SL, o.slabColor, {
      tt: (pu, pv, fu, fv, cx, cy) => o.floorFn(fu, fv),
      tl: (pu, pv) => (pv === SL - 1 ? shade(o.slabColor, 0.15) : undefined),
      tr: (pu, pv) => (pv === SL - 1 ? shade(o.slabColor, 0.15) : undefined)
    }));
    return render(prims, { outline: true });
  }

  window.RoomIso = { U, PX, PY, rgb, shade, render, silhouette, mirror, B, C, P, hash, renderShell, fillPoly, Raster };
})();
