/* Pixel-Dschungel: ein animiertes Pixelbild ("Kaskaden-Tal"), komplett per Code gezeichnet - es gibt keine Bilddatei.
   - Bild oben in der Brain-Karte, duenne Streifen ueber einigen Bereichen, Klick darauf zeigt das ganze Bild mit der Liste der Easter Eggs
   - Tageszeit nach Uhrzeit (Morgen / Tag / Abend / Nacht): das Bild aendert Licht und Stimmung
   - Easter Eggs nach Level (xp.js): Level 0 ist ein fertiges Bild, mit jedem Meilenstein kommt eine Kleinigkeit dazu
   - Aufbau: 1 Zeichenwerkzeuge, 2 Szene, 3 Sprites, 4 Easter Eggs, 5 Laufzeit, 6 Oberflaeche (createScenery)
   - Der erste Aufbau dauert gut 100 ms und passiert erst nach dem ersten Anzeigen der Seite; danach ca. 6 Bilder pro Sekunde, nur solange das Bild
     im sichtbaren Bereich ist und der Tab offen ist (prefers-reduced-motion: ein ruhiges Standbild).
   - Gespeichert wird nichts ausser einem Merker im Browser (dashboard-scn-seen = bis zu welchem Level die Eier schon angezeigt wurden, nur Optik). */
(function () {
  /* ===== 1 Zeichenwerkzeuge ===== */
  /* Pixel-Dschungel-Engine: zeichnet Szenen Pixel fuer Pixel in einen Puffer (kein Bild noetig).
     Grundregeln fuer stimmige Bilder: eine Lichtquelle (oben links), Tiefenstaffelung mit Dunst, alles hat einen Ursprung
     (Wasserfall aus der Klippe, Stamm unter jeder Krone, Ranken haengen an Aesten) und jede Flaeche ist gefuellt. */
  var W = 400, H = 225;

  /* ---------- Farben ---------- */
  function pack(r, g, b) { return ((255 << 24) | ((b & 255) << 16) | ((g & 255) << 8) | (r & 255)) >>> 0; }
  function hx(h) { return pack(parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)); }
  function R(c) { return c & 255; } function G(c) { return (c >> 8) & 255; } function B(c) { return (c >> 16) & 255; }
  function mix(a, b, t) { return pack(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t); }
  function pal(arr) { return arr.map(hx); }
  var BLACK = pack(0, 0, 0), WHITE = pack(255, 255, 255);

  /* ---------- Zufall und Rauschen ---------- */
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function hash2(x, y, s) { var h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1013904223)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function vn(x, y, s) { var ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy); var a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s); return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy; }
  function fbm(x, y, s) { return vn(x, y, s) * .55 + vn(x * 2.1, y * 2.1, s + 11) * .3 + vn(x * 4.3, y * 4.3, s + 23) * .15; }
  var BAY = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]].map(function (r) { return r.map(function (v) { return (v + .5) / 16; }); });
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  /* ---------- Pixelpuffer ---------- */
  function Buf() { this.d = new Uint32Array(W * H); }
  Buf.prototype.set = function (x, y, c) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; this.d[y * W + x] = c; };
  Buf.prototype.get = function (x, y) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return 0; return this.d[y * W + x]; };
  Buf.prototype.dmix = function (x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; if (a > BAY[y & 3][x & 3]) this.d[y * W + x] = mix(this.d[y * W + x], c, Math.min(1, a * 1.5)); };
  Buf.prototype.mixpx = function (x, y, c, a) { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= W || y >= H) return; this.d[y * W + x] = mix(this.d[y * W + x], c, a); };
  Buf.prototype.rect = function (x, y, w, h, c) { for (var j = 0; j < h; j++) for (var i = 0; i < w; i++) this.set(x + i, y + j, c); };
  Buf.prototype.vgrad = function (cols, y0, y1) { var n = cols.length - 1; for (var y = y0; y < y1; y++) for (var x = 0; x < W; x++) { var v = (y - y0) / Math.max(1, y1 - y0 - 1) * n, k = Math.min(n - 1, Math.floor(v)), f = v - k; this.d[y * W + x] = f > BAY[y & 3][x & 3] ? cols[k + 1] : cols[k]; } };
  function spr(P, x, y, rows, map) { rows.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var ch = row[i]; if (ch !== "." && map[ch] !== undefined) P.set(x + i, y + j, map[ch]); } }); }
  /* weicher Lichtfleck (gedithert) */
  function glow(P, cx, cy, rx, ry, col, amt) { for (var y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (var x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) { var d = Math.hypot((x - cx) / rx, (y - cy) / ry); if (d < 1) P.dmix(x, y, col, (1 - d) * (1 - d) * amt + (1 - d) * amt * .35); } }

  /* ---------- Laubmasse: Kuppel aus Blaettern, oben hell, unten dunkel, mit hängenden Ranken ---------- */
  function clump(P, r, cx, cy, rx, ry, pl, o) {
    o = o || {};
    var haze = o.haze || 0, hz = o.hazeCol || 0, i, x, y, nb = 6 + (r() * 4 | 0), bl = [];
    for (i = 0; i < nb; i++) bl.push([cx + (r() - .5) * rx * 1.3, cy - ry * .12 + (r() - .5) * ry * .75, rx * (.32 + r() * .3), ry * (.4 + r() * .34)]);
    var x0 = Math.floor(cx - rx * 1.25) - 2, y0 = Math.floor(cy - ry * 1.15) - 2, x1 = Math.ceil(cx + rx * 1.25) + 2, y1 = Math.ceil(cy + ry * .95) + 2, w = x1 - x0 + 1, h = y1 - y0 + 1;
    var m = new Uint8Array(w * h), dp = new Uint8Array(w * h), tn = new Int8Array(w * h);
    bl.forEach(function (b) { for (var yy = Math.floor(b[1] - b[3]); yy <= Math.ceil(b[1] + b[3]); yy++) for (var xx = Math.floor(b[0] - b[2]); xx <= Math.ceil(b[0] + b[2]); xx++) { var dx = (xx - b[0]) / b[2], dy = (yy - b[1]) / b[3]; if (dx * dx + dy * dy < 1) { var ix = xx - x0, iy = yy - y0; if (ix >= 0 && iy >= 0 && ix < w && iy < h) m[iy * w + ix] = 1; } } });
    if (o.flat) for (x = 0; x < w; x++) { var lim = Math.round(cy - y0 + ry * o.flat * .3 + Math.sin((x0 + x) * .8) * 1.1 + (r() - .5) * 1.4); for (y = lim; y < h; y++) m[y * w + x] = 0; }
    for (x = 0; x < w; x++) { var d = 0; for (y = 0; y < h; y++) { if (m[y * w + x]) d++; else d = 0; dp[y * w + x] = d > 250 ? 250 : d; } }
    var ns = o.ns || 7, light = o.light === undefined ? -1 : o.light;
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (m[y * w + x]) {
      var dd = dp[y * w + x], side = ((x0 + x) - cx) / rx * light, nz = fbm((x0 + x) * .19, (y0 + y) * .19, ns), t = dd <= 1 ? 4 : dd <= 3 ? 3 : dd <= 7 ? 2 : dd <= 13 ? 1 : 0;
      if (side < -.3) t++; else if (side > .4) t--; if (nz > .63) t++; else if (nz < .33) t--;
      tn[y * w + x] = clamp(t, 0, 4);
    }
    var step = o.leaf || 4;
    for (y = 1; y < h - 3; y += 3) for (x = 1 + ((y / 3 | 0) % 2) * 2; x < w - 3; x += step) {
      var lx = x + (r() * 2 | 0), ly = y + (r() * 2 | 0); if (ly < 1 || lx < 1 || lx > w - 4 || ly > h - 4) continue;
      if (!m[ly * w + lx] || !m[(ly + 1) * w + lx + 2]) continue;
      var tb = tn[ly * w + lx], up = dp[ly * w + lx] < 10 ? 1 : 0;
      function put(px, py, tv) { if (m[py * w + px]) tn[py * w + px] = clamp(tv, 0, 4); }
      put(lx + 1, ly, tb + 1 + up); put(lx, ly + 1, tb + up); put(lx + 1, ly + 1, tb); put(lx + 2, ly + 1, tb - 1); put(lx + 1, ly + 2, tb - 2);
    }
    for (y = 0; y < h; y++) for (x = 0; x < w; x++) if (m[y * w + x]) {
      if (y > 0 && !m[(y - 1) * w + x] && r() < .85) tn[y * w + x] = 4;
      if (y < h - 1 && !m[(y + 1) * w + x]) tn[y * w + x] = Math.min(tn[y * w + x], 1);
      var c = pl[tn[y * w + x]]; if (haze) c = mix(c, hz, haze); P.set(x0 + x, y0 + y, c);
    }
    var hang = o.hang === undefined ? .4 : o.hang;
    for (x = 0; x < w; x++) for (y = h - 2; y > 0; y--) if (m[y * w + x]) { if (!m[(y + 1) * w + x] && r() < hang) { var len = 2 + (r() * (o.hangLen || 11) | 0), base = pl[0]; if (haze) base = mix(base, hz, haze); for (var k = 1; k <= len; k++) P.set(x0 + x + Math.sin(k * .5 + x) * .6, y0 + y + k, k > len - 2 ? mix(base, pl[2], haze ? .25 : .5) : base); } break; }
  }
  /* Flaeche mit Laubmassen auf versetztem Raster fuellen, hinten zuerst (kein Loch bleibt) */
  function clumpField(P, r, x0, y0, x1, y1, pl, o) {
    o = o || {}; var sx = o.sx || 22, sy = o.sy || 14, rows = [], y, x;
    for (y = y0; y <= y1; y += sy) rows.push(y);
    rows.forEach(function (yy, ri) { for (x = x0 - sx * .5 + (ri % 2) * sx * .5; x <= x1 + sx; x += sx) { var jx = x + (r() - .5) * sx * .5, jy = yy + (r() - .5) * sy * .6, t = (yy - y0) / Math.max(1, y1 - y0), haze = o.hazeFn ? o.hazeFn(t) : 0; clump(P, r, jx, jy, sx * (.62 + r() * .3), sy * (.95 + r() * .5), o.palFn ? o.palFn(t, jx) : pl, { haze: haze, hazeCol: o.hazeCol, ns: 5 + ((jx * 3 + jy) | 0) % 17, hang: o.hang, hangLen: o.hangLen, flat: o.flat }); } });
  }

  /* ---------- Stamm mit Rinde, Rim-Licht, Wurzelanlauf ---------- */
  function trunk(P, r, xt, yt, xb, yb, wt, wb, pl, o) {
    o = o || {}; var y, x, rim = o.rim || pl[3], seed = (xt * 7 + yb) | 0, spans = [];
    for (y = yt; y <= yb; y++) {
      var t = (y - yt) / Math.max(1, yb - yt), cx = xt + (xb - xt) * t + Math.sin(t * 7 + seed) * (o.wobble === undefined ? 1.3 : o.wobble), w = wt + (wb - wt) * t, flare = t > .84 ? Math.pow((t - .84) / .16, 2) * wb * .7 : 0, hw = w * .5 + flare;
      spans.push([cx, hw]);
      for (x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        var u0 = (x - (cx - hw)) / (hw * 2 + 1), u = u0 + (fbm(x * .35, y * .04, seed) - .5) * .3, c = u < .3 ? pl[2] : u < .62 ? pl[1] : pl[0];
        if (hash2(x, (y / 9) | 0, seed) < .16) c = u < .5 ? pl[1] : pl[0];
        if (hash2(x, (y / 5) | 0, seed + 5) > .93) c = pl[Math.min(3, (u < .5 ? 2 : 1) + 1)];
        if (hash2((x / 2) | 0, (y / 7) | 0, seed + 9) > .9) c = pl[0];
        if (hash2(x, (y / 23) | 0, seed + 3) > .9 && (y % 23) < 9) c = pl[Math.max(0, (u < .5 ? 1 : 0))];
        if (hash2(x, y, seed + 13) > .93) c = u0 < .5 ? pl[2] : pl[1];
        u = u0;
        if (u < .1 && o.rimOn !== false) c = rim; else if (u < .16 && o.rimOn !== false && r() < .5) c = rim;
        if (o.moss && u < .55 && fbm(x * .12, y * .1, seed) > .62 && t > .3) c = r() < .5 ? o.moss[1] : o.moss[2];
        P.set(x, y, c);
      }
    }
    return spans;
  }
  /* Ast: verjuengt sich, oben hell */
  function limb(P, r, x0, y0, xm, ym, x1, y1, r0, r1, pl, rim) {
    var n = 80, i, k, a, b;
    for (i = 0; i <= n; i++) {
      var t = i / n, x = (1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * xm + t * t * x1, y = (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * ym + t * t * y1, rad = r0 + (r1 - r0) * t;
      for (a = -Math.ceil(rad); a <= Math.ceil(rad); a++) for (b = -Math.ceil(rad); b <= Math.ceil(rad); b++) { var d = Math.hypot(a, b); if (d > rad) continue; var v = b / Math.max(1, rad), c = v < -.55 ? rim : v < -.1 ? pl[2] : v < .4 ? pl[1] : pl[0]; if (hash2(Math.round(x + a), Math.round(y + b) >> 2, 3) < .12) c = pl[Math.max(0, (v < .1 ? 1 : 0))]; P.set(x + a, y + b, c); }
    }
  }
  function vine(P, r, x, y0, len, thick, dark, mid, hi, leafCols) {
    var ph = r() * 6, y, k;
    for (y = 0; y < len; y++) {
      var xo = Math.sin(y * .15 + ph) * 1.7; P.set(x + xo, y0 + y, dark); if (thick) { P.set(x + xo + 1, y0 + y, mid); if (y % 3 === 0) P.set(x + xo + 2, y0 + y, hi); }
      if (leafCols && y % 6 === 2 && r() > .3) { var lc = leafCols[(r() * leafCols.length) | 0]; P.set(x + xo - 1, y0 + y, lc); P.set(x + xo + (thick ? 3 : 1), y0 + y + 1, lc); P.set(x + xo + (thick ? 4 : 2), y0 + y + 1, mix(lc, BLACK, .3)); }
    }
  }

  /* Grasbueschel: drei bis fuenf Halme, Spitzen heller */
  function tuft(P, r, x, y, h, pl) {
    for (var b = -2; b <= 2; b++) { if (Math.abs(b) === 2 && r() < .5) continue; var len = h * (.55 + r() * .6) * (b === 0 ? 1 : .8), lean = b * .45 + (r() - .5) * .4; for (var k = 0; k < len; k++) P.set(x + b * .7 + lean * k * .35, y - k, k > len - 2 ? pl[4] : k > len * .5 ? pl[3] : pl[2]); }
  }

  /* ---------- Stein mit Lichtverlauf, Moos und Rissen ---------- */
  function rock(P, r, cx, cy, rw, rh, pl, o) {
    o = o || {}; var seed = (cx * 13 + cy * 7) | 0, mossPl = o.moss, x, y;
    for (y = -rh; y <= rh * .3; y++) for (x = -rw; x <= rw; x++) {
      var nx = x / rw, ny = y / rh, wob = (fbm((cx + x) * .13, (cy + y) * .13, seed) - .5) * .42, e = nx * nx + ny * ny + wob; if (e > 1) continue;
      var z = Math.sqrt(Math.max(0, 1 - e)), l = -ny * .6 - nx * .4 + z * .5 + (fbm((cx + x) * .4, (cy + y) * .4, seed + 9) - .5) * .25, t = l > .88 ? 4 : l > .62 ? 3 : l > .38 ? 2 : l > .16 ? 1 : 0;
      if (e > .86) t = Math.max(0, t - 1); if (y > rh * .12) t = Math.max(0, t - 1);
      var c = pl[t];
      if (mossPl && ny < -.05 + (fbm((cx + x) * .2, (cy + y) * .2, seed + 4) - .5) * .9 && fbm((cx + x) * .27, (cy + y) * .27, seed + 2) > .4) c = mossPl[clamp(t + (o.mossLift || 0), 0, mossPl.length - 1)];
      if (hash2(Math.round(cx + x), Math.round(cy + y) >> 1, seed) > .965 && t < 3) c = pl[0];
      P.set(cx + x, cy + y, c);
    }
  }

  /* ---------- Blaetter: Palmwedel, breite Blaetter, Monstera ---------- */
  function palm(P, r, x0, y0, ang, len, droop, ll, pl) {
    var u, s, k, px, py, a, rib = [];
    for (u = 0; u <= len; u += .7) { a = ang; px = x0 + Math.cos(a) * u; py = y0 + Math.sin(a) * u + droop * (u * u) / len; rib.push([px, py, u]); }
    rib.forEach(function (q, i) {
      var u2 = q[2], tt = u2 / len, L = ll * Math.pow(Math.sin(Math.PI * clamp(tt * .96 + .04, 0, 1)), .65), nxt = rib[Math.min(rib.length - 1, i + 1)], prv = rib[Math.max(0, i - 1)], ta = Math.atan2(nxt[1] - prv[1], nxt[0] - prv[0]);
      P.set(q[0], q[1], pl[0]);
      if (i % 2 === 0 && tt > .06) for (s = -1; s <= 1; s += 2) { var la = ta + s * (1.15 - tt * .25); for (k = 1; k <= L; k++) { var ex = q[0] + Math.cos(la) * k, ey = q[1] + Math.sin(la) * k + k * .22 * (k / L); P.set(ex, ey, s < 0 ? (k > L - 2 ? pl[4] : pl[3]) : (k > L - 2 ? pl[2] : pl[1])); } }
    });
  }
  function blade(P, r, cx, cy, len, wid, ang, curve, pl, o) {
    o = o || {}; var u, v, px = cx, py = cy, a = ang, pts = [];
    for (u = 0; u <= len; u += .5) { a = ang + curve * (u / len); px += Math.cos(a) * .5; py += Math.sin(a) * .5; pts.push([px, py, a, u]); }
    var notches = o.notches ? [] : null; if (notches) for (var q = 0; q < o.notches; q++) notches.push([len * (.2 + .65 * (q + r()) / o.notches), r() > .5 ? 1 : -1, wid * (.45 + r() * .3)]);
    pts.forEach(function (p) {
      var w = wid * Math.pow(Math.sin(Math.PI * (p[3] / len)), o.shape || .8), ca = Math.cos(p[2]), sa = Math.sin(p[2]);
      for (v = -w; v <= w; v += .5) {
        var av = Math.abs(v), skip = false;
        if (notches) notches.forEach(function (n) { if (Math.abs(p[3] - n[0]) < 1.4 && v * n[1] > 0 && av > w - n[2]) skip = true; });
        if (skip) continue;
        var c; if (av < .6) c = pl[4]; else if (av > w - 1.1) c = pl[0]; else if (((p[3] * (o.vein || .9) + av * 1.7) % 6) < .9) c = pl[1]; else c = v < 0 ? pl[3] : pl[2];
        P.set(p[0] - sa * v, p[1] + ca * v, c);
      }
    });
  }

  /* ---------- Himmel: Wolken aus Rauschen, oben hell, unten blaulich ---------- */
  function clouds(P, s, y0, y1, thr, cols) {
    for (var y = y0; y < y1; y++) for (var x = 0; x < W; x++) {
      var n = fbm(x * .017, y * .055, s), tt = thr + (y - y0) / (y1 - y0) * .1; if (n < tt) continue;
      var up = fbm((x + 2) * .017, (y - 3) * .055, s) < tt, dn = fbm(x * .017, (y + 3) * .055, s) < tt, c = up ? cols[0] : dn ? cols[2] : cols[1];
      if (n - tt < .025 && BAY[y & 3][x & 3] > .5) continue; P.set(x, y, c);
    }
  }

  /* ---------- Tageszeit ---------- */
  var PH = {
    morgen: { name: "MORGEN", mul: [1.04, .96, .92], add: [14, 5, 0], top: ["#ffb8a0", .16], fly: 5, night: 0 },
    tag: { name: "TAG", mul: [1, 1, 1], add: [0, 0, 0], top: ["#ffffff", 0], fly: 3, night: 0 },
    abend: { name: "ABEND", mul: [1.12, .82, .66], add: [20, 4, -6], top: ["#ff8a4a", .22], fly: 9, night: 0 },
    nacht: { name: "NACHT", mul: [.27, .38, .62], add: [3, 8, 22], top: ["#1b2f7a", .18], fly: 26, night: 1 }
  };
  Object.keys(PH).forEach(function (k) { PH[k].tc = hx(PH[k].top[0]); });
  function gradePx(c, ph, y) { var m = ph.mul, a = ph.add, rr = R(c) * m[0] + a[0], gg = G(c) * m[1] + a[1], bb = B(c) * m[2] + a[2], tc = ph.tc, f = ph.top[1] * (1 - Math.min(1, y / (H * .85))); rr += (R(tc) - rr) * f; gg += (G(tc) - gg) * f; bb += (B(tc) - bb) * f; return pack(clamp(rr, 0, 255), clamp(gg, 0, 255), clamp(bb, 0, 255)); }
  function grade(P, ph) { var o = new Buf(), x, y; for (y = 0; y < H; y++) for (x = 0; x < W; x++) o.d[y * W + x] = gradePx(P.d[y * W + x], ph, y); return o; }

  /* ---------- Pruefung auf leere Flaechen ("Luecken") ---------- */
  function gaps(P, bs) {
    bs = bs || 12; var out = [], bx, by, x, y;
    for (by = 0; by + bs <= H; by += bs) for (bx = 0; bx + bs <= W; bx += bs) { var seen = {}, n = 0; for (y = 0; y < bs; y++) for (x = 0; x < bs; x++) { var c = P.d[(by + y) * W + bx + x]; if (!seen[c]) { seen[c] = 1; n++; } } if (n <= 2) out.push([bx, by, n]); }
    return out;
  }

  /* ===== 2 Szene ===== */
  /* Endgueltige Szene "Kaskaden-Tal": Schlucht mit vierstufiger Kaskade, leuchtendem Becken, Holzbruecke mit Wanderer, hohe Staemme mit warmem
     Randlicht, Bach, der nach vorne links fliesst; rechts eine ruhige Uferlichtung (Platz fuer Zelt, Feuer, Fuchs, Blumen), links ein kleiner
     Landeplatz der Bruecke. Alles Weitere (Easter Eggs) haengt an festen Ankern S.A. */
  function fallSheet(S, y0, y1, xl, xr, jit) {
    var P = S.P, F = S.F, y, x;
    for (y = y0; y <= y1; y++) {
      var l = Math.round(xl(y) + (fbm(0, y * .2, S.seed) - .5) * jit), rr = Math.round(xr(y) + (fbm(5, y * .2, S.seed + 3) - .5) * jit);
      for (x = l; x <= rr; x++) {
        var u = (x - l) / Math.max(1, rr - l), k = (u < .1 || u > .9) ? 0 : (u < .22 || u > .78) ? 1 : 2, tone = k === 0 ? 0 : k === 1 ? 1 : ((((y * 2 + x * 5) % 13) < 4) ? 3 : 2);
        if (((x * 7 + (y >> 3) * 3) % 11) < 2 && k > 0) tone = Math.min(3, tone + 1);
        if (y < y0 + 3 && BAY[y & 3][x & 3] > (y - y0 + 1) / 4) continue;
        P.set(x, y, F[tone]); S.fall.push([y * W + x, k]);
      }
    }
  }
  function cliffFace(P, r, x0, x1, topFn, botFn, pl, seed, o) {
    o = o || {};
    var bump = function (x) { return fbm(x * .07, 1.5, seed) * 9 + fbm(x * .21, 4, seed + 3) * 2.5; };
    for (var x = x0; x <= x1; x++) {
      var top = Math.round(topFn(x)), bot = Math.round(botFn(x)), slope = bump(x) - bump(x - 1), g = Math.floor(x / 4 + hash2(Math.floor(x / 9), 0, seed) * 3);
      for (var y = top; y <= bot; y++) {
        var d = y - top, t = 2 + (slope < -.3 ? 1 : slope > .3 ? -1 : 0) + (hash2(g, 0, seed) > .72 ? 1 : hash2(g, 1, seed) < .25 ? -1 : 0);
        if (d < 3) t -= 2; else if (d < 7) t -= 1;
        if (((y + Math.floor(hash2(g, 2, seed) * 9)) % 12) === 0) t -= 1;
        if (hash2(x, (y / 17) | 0, seed + 7) > .955) t = 0;
        var nz = fbm(x * .15, y * .12, seed + 9); if (nz > .68) t++; else if (nz < .3) t--;
        if (bot - y < 10) t -= 1;
        if (o.moss && fbm(x * .1, y * .09, seed + 14) > .63 && d > 4) { P.set(x, y, o.moss[clamp(t, 0, o.moss.length - 1)]); continue; }
        P.set(x, y, pl[clamp(t, 0, 4)]);
      }
    }
    for (var i = 0; i < (o.cracks || 26); i++) { var cx = x0 + r() * (x1 - x0), cy = topFn(cx) + 6 + r() * 20, len = 10 + r() * 30; for (var k = 0; k < len; k++) { var yy = cy + k; if (yy < botFn(cx)) P.set(cx + Math.sin(k * .3 + i) * .8, yy, pl[0]); } }
  }
  function sceneKaskade(seed) {
    var P = new Buf(), r = rng(seed), S = { P: P, seed: seed, fall: [], glints: [], A: {}, F: pal(["#12909a", "#30d0c0", "#8ff0e0", "#e8fffa"]) }, x, y, i, k;
    var BGT = pal(["#06242c", "#0a3a44", "#0f5560", "#1a7a80", "#2f9fa0"]);
    var FA = pal(["#06303a", "#0c5a4a", "#1f9a46", "#6fd830", "#c8f84a"]), FT = pal(["#021a22", "#04323a", "#08504c", "#0e7a62", "#1fb084"]);
    var TA = pal(["#041418", "#082a32", "#0f4a52", "#1a7078"]), RA = pal(["#04141a", "#082a32", "#0f4448", "#1b6a66", "#2e9a8a"]);
    var RR = pal(["#2a0e12", "#5a1a1a", "#a8432a", "#e07a3a", "#ffb860"]), MA = pal(["#0f5a3a", "#1f9a46", "#4ed03a", "#9ef04a", "#d8ff7a"]);
    var WA = pal(["#0a5a70", "#12909a", "#30d0c0", "#8ff0e0", "#e0fff8"]), HZ = hx("#0f5560"), ORG = hx("#f08a3a"), ORG2 = hx("#ffc060");
    var FX = 160, skyP = new Uint8Array(W * H), skySnap, CLOUDC = hx("#ffd8b0");

    /* 1 Hintergrund: dunstiges Tuerkis, oben ein warm leuchtendes Himmelsfenster zwischen den Felswaenden */
    P.vgrad(BGT, 0, H);
    for (y = 0; y < 52; y++) for (x = 84; x < 250; x++) { var d = Math.hypot((x - 166) / 78, (y - 6) / 46); if (d >= 1) continue; var v = y / 46 * 3, kk = Math.min(2, Math.floor(v)), f = v - kk, cols = pal(["#3a2060", "#a8486a", "#f08a70", "#ffc08a"]); var c = f > BAY[y & 3][x & 3] ? cols[kk + 1] : cols[kk]; if (d > .82 && BAY[y & 3][x & 3] < (d - .82) * 5) continue; P.set(x, y, c); skyP[y * W + x] = 1; }
    for (i = 0; i < 6; i++) { var cy = 8 + r() * 30, cx = 110 + r() * 110; for (x = -18; x < 18; x++) if (BAY[cy & 3][x & 3] < .7) P.set(cx + x, cy + Math.sin(x * .3) * 1.2, CLOUDC); }
    skySnap = P.d.slice();
    for (x = 0; x < W; x++) { var ft = 70 + Math.sin(x * .03) * 10 + fbm(x * .04, 1, seed) * 14; if (x > 90 && x < 240) ft += 20 - Math.abs(x - 166) * .1; for (y = Math.round(ft); y < 150; y++) P.set(x, y, mix(BGT[1], BGT[3], clamp((y - ft) / 70, 0, 1) * .5)); }
    for (x = -10; x < W + 20; x += 16) clump(P, r, x + (r() - .5) * 6, 76 + (r() - .5) * 10 + Math.sin(x * .03) * 8, 24, 13, [mix(FT[1], HZ, .4), mix(FT[2], HZ, .35), mix(FA[2], HZ, .45), mix(FA[3], HZ, .45), mix(FA[4], HZ, .4)], { ns: (x | 0) % 17, hang: 0 });

    /* 2 durchgehende Rueckwand mit Kerbe in der Mitte */
    var topBack = function (xx) { var d = Math.abs(xx - 160); return 22 + 12 * Math.exp(-Math.pow(d / 20, 2)) + Math.max(0, d - 60) * .3 + (fbm(xx * .06, 2, seed) - .5) * 5; };
    cliffFace(P, r, 14, 310, topBack, function () { return 168; }, RA, seed + 10, { moss: MA, cracks: 36 });
    for (x = 14; x < 312; x += 15 + (r() * 6 | 0)) { if (Math.abs(x - 160) < 16) continue; clump(P, r, x, topBack(x) - 2, 15 + r() * 6, 8 + r() * 4, r() > .5 ? FT : FA, { ns: (x | 0) % 27, hang: .5, hangLen: 12 }); }
    for (i = 0; i < 26; i++) { var vx = 20 + r() * 290; if (Math.abs(vx - 160) < 22) continue; vine(P, r, vx, topBack(vx) + 2, 12 + r() * 40, r() > .6, RA[0], RA[2], MA[3], [MA[2], MA[3]]); }
    for (i = 0; i < 16; i++) { var qx = 24 + r() * 280; if (Math.abs(qx - 160) < 26) continue; clump(P, r, qx, topBack(qx) + 16 + r() * 60, 7 + r() * 5, 4 + r() * 3, r() > .5 ? MA : FA, { ns: i + 3, hang: .5, hangLen: 8, leaf: 3 }); }

    /* 3 Kaskade in vier Stufen */
    var tiers = [[34, 58, 151, 169], [58, 86, 141, 179], [86, 116, 129, 191], [116, 147, 114, 206]];
    tiers.forEach(function (t, ti) {
      fallSheet(S, t[0], t[1], function (yy) { return t[2] + (yy - t[0]) / (t[1] - t[0]) * 3 * (ti < 3 ? 1 : 0); }, function (yy) { return t[3] - (yy - t[0]) / (t[1] - t[0]) * 3 * (ti < 3 ? 1 : 0); }, 3);
      for (i = 0; i < 2 + ti; i++) { var px = t[2] + 6 + r() * (t[3] - t[2] - 12), py = t[0] + 8 + r() * (t[1] - t[0] - 14); rock(P, r, px, py + 5, 2 + (r() * 3 | 0), 5 + (r() * 5 | 0), RA, { moss: MA }); }
      for (x = t[2] - 2; x <= t[3] + 2; x++) { P.set(x, t[1], WA[3]); if (r() > .4) P.set(x, t[1] + 1, WA[4]); }
    });
    for (i = 0; i < 16; i++) rock(P, r, 112 + r() * 96, 128 + r() * 20, 3 + r() * 3, 5 + r() * 5, RA, { moss: MA });
    for (i = 0; i < 18; i++) { var sd = i % 2 ? 1 : -1, yy = 40 + r() * 100, edge = tiers.filter(function (t) { return yy >= t[0] && yy <= t[1]; })[0]; if (!edge) continue; var ex = sd < 0 ? edge[2] - 5 : edge[3] + 5; rock(P, r, ex, yy, 6 + r() * 4, 7 + r() * 5, RA, { moss: MA }); clump(P, r, ex, yy - 7, 8 + r() * 4, 4 + r() * 2, MA, { ns: i, hang: .3, hangLen: 6, leaf: 3 }); }

    /* 4 Ufer, Becken und Bach (fliesst nach vorne links, rechts bleibt Platz fuer die Lichtung) */
    var cxs = function (yy) { return 150 - (yy - 150) * .35 + Math.sin((yy - 150) * .05) * 10; }, hws = function (yy) { return 62 + (yy - 150) * .5; };
    var wedge = function (xx, yy) { return (fbm(xx * .035, yy * .08, seed + 55) - .5) * .42; };
    var inWater = function (xx, yy, m) { if (yy < 148) return false; return Math.abs(xx - cxs(yy)) / (hws(yy) * (1 + wedge(xx, yy))) <= 1 + (m || 0); };
    var clearing = function (xx, yy, m) { return Math.pow((xx - 262) / (44 + (m || 0)), 2) + Math.pow((yy - 182) / (17 + (m || 0)), 2) < 1; };
    for (y = 148; y < H; y++) for (x = 0; x < W; x++) { var gt2 = 150 + (fbm(x * .05, 2, seed + 70) - .5) * 6; if (y < gt2 - 1) continue; var mt = fbm(x * .09, y * .11, seed + 31); P.set(x, y, y < gt2 + 1 ? MA[2] : mt > .64 ? MA[0] : mt > .46 ? FT[3] : FT[2]); }
    /* Uferlichtung rechts: weiche Moosflaeche mit hellerer Mitte, damit die Szenen darauf ruhig wirken */
    for (y = 160; y < 205; y++) for (x = 214; x < 320; x++) { var dd = Math.pow((x - 262) / 50, 2) + Math.pow((y - 182) / 19, 2); if (dd < 1) { var nn = fbm(x * .12, y * .16, seed + 81), tn = dd < .35 ? 3 : dd < .7 ? 2 : 1; if (nn > .6) tn++; else if (nn < .35) tn--; P.set(x, y, [FT[2], FT[3], MA[0], MA[1], MA[1]][clamp(tn, 0, 4)]); } }
    for (y = 147; y < H; y++) for (x = 0; x < W; x++) {
      var c = cxs(y), hw = hws(y) * (1 + wedge(x, y)), e = Math.abs(x - c) / hw; if (e > 1) continue;
      var tone = e > .9 ? 0 : e > .7 ? 1 : 2, nz = fbm(x * .06, y * .14, seed + 61), near = Math.exp(-Math.pow((x - FX) / (44 + (y - 148) * .6), 2) - Math.pow((y - 150) / 22, 2));
      if (near > BAY[y & 3][x & 3] * .9) tone += 2; else if (near > .12) tone += 1;
      if (nz > .62) tone++; else if (nz < .34 && tone > 0) tone--;
      if (y > 180 && tone > 1) tone -= (BAY[y & 3][x & 3] < (y - 180) / 60 ? 1 : 0);
      var col = WA[clamp(tone, 0, 4)]; if (e > .72 && tone < 3) col = mix(col, FT[1], .4 * ((e - .72) / .28) + .1); P.set(x, y, col);
    }
    for (y = 150; y < H; y += 2) for (i = 0; i < 6; i++) { var rx = cxs(y) + (r() - .5) * hws(y) * 1.7, sl = 3 + r() * 11; for (k = 0; k < sl; k++) { var cc = P.get(rx + k, y); if (cc === WA[2] || cc === WA[1]) P.set(rx + k, y, cc === WA[2] ? WA[3] : WA[2]); } }
    for (x = 100; x < 222; x++) for (y = 140; y < 160; y++) { var ed = Math.hypot((x - FX) / 62, (y - 148) / 11); if (ed < 1 && BAY[y & 3][x & 3] < (1 - ed) * 1.3) P.set(x, y, r() > .35 ? WA[4] : hx("#c8fff4")); }
    glow(P, FX, 142, 78, 38, hx("#6af4e4"), .85); glow(P, FX, 140, 40, 22, hx("#e8fffa"), .6);

    /* 5 Steine: Uferkante (links dunkel, rechts rot-orange vom Abendlicht) und feste Trittsteine im Bach */
    var rks = [];
    [162, 176, 190, 204, 218].forEach(function (yy, idx) { var c = cxs(yy), hw = hws(yy); rks.push([c - hw * .98, yy, 10 + idx * 3, 6 + idx, 0]); rks.push([c + hw * .98, yy + 2, 10 + idx * 3, 6 + idx, 1]); });
    var STEP = [[176, 182, 12, 6, 0], [128, 191, 15, 8, 1], [158, 207, 18, 9, 0], [198, 199, 12, 6, 1], [104, 178, 10, 5, 0], [112, 216, 14, 7, 0]];
    rks = rks.filter(function (q) { return !(q[4] === 1 && clearing(q[0], q[1], 8)); }).concat(STEP);
    rks.sort(function (a, b) { return a[1] - b[1]; }).forEach(function (q) { rock(P, r, q[0], q[1], q[2], q[3], q[4] ? RR : RA, { moss: MA, mossLift: q[4] ? 1 : 0 }); for (var xx = -q[2]; xx < q[2]; xx++) if (r() > .55) P.dmix(q[0] + xx, q[1] + 2, WA[4], .55); });
    /* Landeplaetze der Bruecke: breite flache Steinplatten, links und rechts */
    rock(P, r, 92, 168, 17, 6, RA, { moss: MA }); rock(P, r, 220, 162, 15, 6, RR, { moss: MA, mossLift: 1 });

    /* 6 Holzbruecke ueber den ganzen Bach, darauf der Wanderer */
    var WD = pal(["#1a0e06", "#3a2210", "#6a4020", "#a06a34", "#d09a58"]), BX0 = 86, BX1 = 218;
    for (x = BX0; x <= BX1; x++) { for (y = 160; y < 166; y++) P.set(x, y, y < 162 ? WD[3] : y < 164 ? WD[2] : WD[1]); if ((x - BX0) % 7 === 0) for (y = 160; y < 166; y++) P.set(x, y, WD[0]); P.set(x, 166, WD[0]); }
    for (x = BX0; x <= BX1; x += 12) { for (y = 150; y < 160; y++) P.set(x, y, y < 152 ? WD[4] : WD[2]); P.set(x + 1, 151, WD[0]); }
    for (x = BX0; x <= BX1; x++) { P.set(x, 151, WD[4]); P.set(x, 152, WD[3]); P.set(x, 156, WD[2]); }
    [92, 152, 214].forEach(function (px) { for (y = 166; y < 178; y++) { P.set(px, y, WD[1]); P.set(px + 1, y, WD[0]); } for (var xx = -3; xx <= 4; xx++) P.dmix(px + xx, 178, WA[4], .7); });
    for (y = 167; y < 173; y++) for (x = BX0; x <= BX1; x++) if (inWater(x, y, -.05) && BAY[y & 3][x & 3] < .5 - (y - 167) * .07) P.mixpx(x, y, WA[0], .55);
    spr(P, 150, 148, ["..hh..", ".hhhh.", "hhhhhh", "..ff..", ".bbbb.", "bbbbbb", "bbbbbb", ".bbbb.", ".b..b.", ".k..k."], { h: hx("#10202a"), f: hx("#d8a080"), b: hx("#0c1a24"), k: hx("#050a10") });
    for (i = 0; i < 10; i++) P.dmix(150 + (i % 2) * 5, 148 + i, hx("#8ff0e0"), .35);

    /* 7 Rechts: hohe Staemme mit warmem Rim-Licht, Kronen aus Limette, Ranken */
    clumpField(P, r, 244, 44, 410, 150, FA, { sx: 28, sy: 17, palFn: function (t) { return t < .5 ? FT : FA; }, hazeFn: function (t) { return .55 - t * .5; }, hazeCol: HZ, hang: .3 });
    [[336, 332, 8, 12, .4], [388, 384, 8, 12, .3]].forEach(function (q) { trunk(P, r, q[0], -4, q[1], 230, q[2], q[3], TA, { rim: ORG, wobble: 1 }); });
    trunk(P, r, 306, -4, 296, 232, 24, 34, TA, { rim: ORG, wobble: 1.4, moss: [0, MA[1], MA[2]] });
    trunk(P, r, 356, -4, 350, 232, 12, 17, TA, { rim: ORG, wobble: 1 });
    for (y = 0; y < 232; y++) { var tx1 = 306 + (296 - 306) * y / 232 - 11 - y * .02; if (y % 3 === 0) P.set(tx1 + 1, y, ORG2); }
    limb(P, r, 296, 70, 270, 52, 246, 56, 6, 3, TA, ORG);
    clump(P, r, 330, 14, 58, 26, FA, { ns: 3, hang: .5, hangLen: 18 }); clump(P, r, 284, 10, 40, 18, FA, { ns: 8, hang: .5, hangLen: 14 }); clump(P, r, 378, 34, 44, 22, FA, { ns: 12, hang: .5, hangLen: 16 }); clump(P, r, 244, 22, 30, 14, FT, { ns: 14, hang: .4 });
    clump(P, r, 296, 74, 36, 18, FA, { ns: 18, hang: .4 }); clump(P, r, 354, 96, 38, 18, FA, { ns: 21, hang: .4 }); clump(P, r, 262, 100, 30, 15, FT, { ns: 5, hang: .4 });
    for (i = 0; i < 12; i++) vine(P, r, 242 + r() * 150, 20 + r() * 20, 18 + r() * 50, r() > .5, TA[0], TA[1], ORG, [FA[2], FA[3]]);

    /* 8 Links: oben dunkles Blattwerk, unten helle Palmwedel */
    clump(P, r, 30, 20, 62, 28, FA, { ns: 2, hang: .5, hangLen: 18 }); clump(P, r, 92, 10, 40, 16, FT, { ns: 31, hang: .4 }); clump(P, r, 10, 76, 36, 20, FT, { ns: 6, hang: .3 }); clump(P, r, 60, 88, 30, 16, FT, { ns: 9, hang: .3 });
    for (i = 0; i < 8; i++) vine(P, r, 6 + r() * 100, 28 + r() * 20, 18 + r() * 50, r() > .5, TA[0], TA[1], TA[3], [FA[2], FA[3]]);
    var PLB = pal(["#0c4a3a", "#1f8a62", "#4ed098", "#9af0c4", "#e0fff0"]);
    for (i = 0; i < 7; i++) palm(P, r, 6 + r() * 30, 186 - r() * 14, -1.1 - r() * 1.1, 54 + r() * 24, 24 + r() * 14, 13, PLB);

    /* 9 Bodendecke: Gras, Farne, Blumen, kleine Steine; die Lichtung bleibt ruhig (nur Gras und Blumen) */
    var cover = [];
    for (i = 0; i < 520; i++) { var gx = r() * W, gy = 150 + r() * (H - 150); if (inWater(gx, gy, .06)) continue; cover.push([gx, gy, r()]); }
    var FLW = [hx("#ff7aa8"), hx("#ffb04a"), hx("#fff0a8"), hx("#7fe0ff"), hx("#c8a0ff")];
    cover.sort(function (a, b) { return a[1] - b[1]; }).forEach(function (q) {
      var cx2 = q[0], cy2 = q[1], sc = .55 + (cy2 - 150) / 75 * 1.1, t = q[2], calm = clearing(cx2, cy2, 2);
      if (calm && t > .5) t = t * .5;
      if (t < .44) tuft(P, r, cx2, cy2, 3 + sc * (calm ? 2.4 : 4), calm ? [0, 0, MA[0], MA[1], MA[2]] : MA);
      else if (t < .62) palm(P, r, cx2, cy2, -1.57 + (r() - .5) * 1.5, 9 * sc + 7, 3, 3 + sc * 2.4, r() > .5 ? FA : MA);
      else if (t < .76) { tuft(P, r, cx2, cy2, 4 + sc * 3, MA); var fc = FLW[(r() * 5) | 0]; for (k = 0; k < 3; k++) { P.set(cx2 + (k - 1) * 2, cy2 - 5 - sc * 3 - (k % 2), fc); P.set(cx2 + (k - 1) * 2, cy2 - 6 - sc * 3 - (k % 2), hx("#fff4cc")); } }
      else if (t < .88) rock(P, r, cx2, cy2, 3 + sc * 3.4, 2 + sc * 2, cx2 > 200 ? RR : RA, { moss: MA });
      else clump(P, r, cx2, cy2 - 2, 7 + sc * 7, 4 + sc * 3.4, r() > .5 ? MA : FA, { ns: (cx2 | 0) % 29, hang: 0, leaf: 3 });
    });
    /* Blumenbeet zwischen den beiden Staemmen (Schmetterling und Kolibri) */
    var heads = [];
    for (i = 0; i < 34; i++) { var bx = 308 + r() * 36, by = 164 + r() * 16; tuft(P, r, bx, by, 4 + r() * 3, MA); var bc = [hx("#ff5a8a"), hx("#ff9a3a"), hx("#fff0a8"), hx("#ff7aa8")][(r() * 4) | 0]; P.set(bx, by - 7, bc); P.set(bx + 1, by - 7, bc); P.set(bx, by - 8, hx("#fff4cc")); heads.push([Math.round(bx), Math.round(by - 8)]); }

    /* 10 Vordergrund: dunkle Blaetter am unteren Rand, Wurzeln des grossen Stamms */
    var DK = pal(["#01121a", "#032430", "#06424a", "#0a6a62", "#14a07a"]);
    for (i = 0; i < 5; i++) blade(P, r, 4 + r() * 40, H + 6, 46 + r() * 20, 10 + r() * 4, -1.4 - r() * .7, .5, DK, { shape: .8, vein: 1.4 });
    for (i = 0; i < 5; i++) blade(P, r, W - 6 - r() * 46, H + 6, 46 + r() * 26, 10 + r() * 4, -2.0 + r() * .6, -.6, DK, { shape: .8, vein: 1.4 });
    for (i = 0; i < 8; i++) palm(P, r, 60 + r() * 110, 234, -1.57 + (r() - .5) * 1.5, 22 + r() * 14, 9 + r() * 8, 7, DK);
    limb(P, r, 276, 208, 290, 218, 312, 228, 8, 3, TA, ORG); limb(P, r, 284, 222, 300, 230, 322, 232, 5, 2, TA, ORG);

    /* 11 Lichtfaeden, Glanz, Randabdunklung */
    for (i = 0; i < 18; i++) { var lx = 214 + r() * 180, ly = 20 + r() * 110, ll = 10 + r() * 32; for (k = 0; k < ll; k++) P.dmix(lx, ly + k, hx("#8ff0e0"), .75 - k / ll * .5); }
    for (y = 0; y < H; y++) for (x = 0; x < W; x++) { var d2 = Math.hypot((x - W / 2) / (W * .66), (y - H * .5) / (H * .78)); if (d2 > .76) P.dmix(x, y, hx("#01080c"), Math.min(.78, (d2 - .76) * 1.5)); }

    /* Anker (feste Plaetze fuer die Easter Eggs) */
    var near = function (px, py) { var best = heads[0], bd = 1e9; heads.forEach(function (h) { var d = Math.hypot(h[0] - px, h[1] - py); if (d < bd) { bd = d; best = h; } }); return { x: best[0], y: best[1] }; };
    S.A = {
      rocks: [{ x: 176, y: 176 }, { x: 128, y: 183 }, { x: 158, y: 198 }, { x: 198, y: 193 }],
      flowers: [near(322, 166), near(336, 160), near(312, 162)],
      bank: { x: 262, y: 182 }, landL: { x: 92, y: 164 }, landR: { x: 220, y: 158 },
      perch: { x: 254, y: 54 }, hole: { x: 299, y: 114 }, roots: { x: 280, y: 208 },
      mist: { x: FX, y: 142, r: 40 }, sky: { x: 120, y: 0, w: 118, h: 30 }, pool: { x: 104, y: 170, w: 112, h: 30 },
      wall: { x: 46, y: 152 }, ledge: { x: 112, y: 209 }, water: { x: 199, y: 186 }, bridge: { x: BX0, y: 160, w: BX1 - BX0 }
    };
    S.cxs = cxs; S.hws = hws;
    S.skyMask = new Uint8Array(W * H); for (y = 0; y < 52; y++) for (x = 84; x < 250; x++) { var si = y * W + x; if ((skyP[si] || skySnap[si] === CLOUDC) && P.d[si] === skySnap[si]) S.skyMask[si] = 1; }
    S.A.skyMask = S.skyMask;
    var fs = {}; S.F.forEach(function (c) { fs[c] = 1; }); S.fall = S.fall.filter(function (q) { return fs[P.d[q[0]]]; });
    for (i = 0; i < 190; i++) { var gy3 = 152 + r() * (H - 154), gx3 = cxs(gy3) + (r() - .5) * hws(gy3) * 1.6, cc3 = P.get(gx3, gy3); if (cc3 === WA[2] || cc3 === WA[3] || cc3 === WA[1]) S.glints.push([Math.round(gx3), Math.round(gy3), r() * 6]); }
    S.birds = [];
    return S;
  }

  /* ===== 3 Sprites ===== */
  /* Sprites der Easter Eggs: jede Zeile ein Pixelstreifen, "." = durchsichtig. Legenden (M_*) pro Tier. Wird auch vom Sprite-Labor gerendert. */

  /* --- Blauer Morpho-Schmetterling (Oberseite blau, Unterseite braun mit Augenfleck) --- */
  var M_BF = { k: hx("#0a0e1c"), d: hx("#0b2a78"), b: hx("#1f66e0"), B: hx("#3f9bff"), c: hx("#9fe6ff"), w: hx("#ffffff"), n: hx("#3a2410"), N: hx("#8a5a2c"), o: hx("#d8b070"), e: hx("#f4e6c0") };
  var BF_OPEN = [".k...k.k...k.", "kwkk.kkk.kkwk", "kdddk.k.kdddk", "wdddBkkkBdddw", ".kddBckcBddk.", "..kdBckcBdk..", "..kdBckcBdk..", ".kddBckcBddk.", "..wdBkkkBdw..", "..kkk.k.kkk.."];
  var BF_HALF = ["k..k.k..k", "wkk.k.kkw", "kddkkkddk", "kddckcddk", "kddckcddk", ".kdckcdk.", "..kkkkk..", "....k...."];
  var BF_SHUT = [".k...k.", "..k.k..", "...k...", "..kNk..", ".kNeNk.", ".kNnNk.", ".kNNNk.", ".kNoNk.", "..kNk..", "...k..."];

  /* --- Rotaugenlaubfrosch im Profil, schaut nach rechts --- */
  var M_FR = { g: hx("#2c8c3a"), G: hx("#58cc48"), L: hx("#a4f070"), d: hx("#15501f"), e: hx("#e8281c"), E: hx("#ffb89a"), k: hx("#0c0c0c"), b: hx("#3b72e6"), y: hx("#ffd83a"), o: hx("#ff8a1c"), c: hx("#f4f0c8"), m: hx("#1a3a14"), r: hx("#ff7a8a") };
  var FROG = [
    "......eee....",
    ".....eEkee...",
    "....gGeeeGg..",
    "...gGGGGGGGgd",
    "..gGLGGGGGGGm",
    ".gGGGGGGGGGcc",
    "gGbbGGGGGGGcc",
    "dgyyGGGGGGcc.",
    ".doogGGGGGdoo",
    "..ooodd..dooo"
  ];

  /* --- Kolibri, schwebend, schaut nach rechts, zwei Fluegelstellungen --- */
  var M_HB = { G: hx("#2fd0a0"), g: hx("#14886e"), t: hx("#0e5a4a"), p: hx("#e8f6f0"), R: hx("#ff3a5a"), k: hx("#262626"), w: hx("#d9f5ee"), W: hx("#ffffff") };
  var HB0 = [
    "...w.........",
    "..wWw.....gG.",
    ".wWWw....gGkkkkk",
    "..wWWw..gGGG....",
    "...wGGGGGGGR....",
    "....GGGGGpRR....",
    "..ttGGGGppR.....",
    ".tttgGGpp.......",
    "tt..gpp........."
  ].map(function (r) { return r.slice(0, 15); });
  var HB1 = [
    ".............",
    "..............",
    "..........gG.",
    ".........gGkkkkk",
    "....gGGGGGGGR....",
    "...GGGGGGpRR....",
    "..ttGGGGGppR....",
    ".tttgGGWWpp.....",
    "tt..gwWWWw......"
  ].map(function (r) { return r.slice(0, 15); });

  /* --- Schatztruhe, geoeffnet, voller Gold --- */
  var M_CH = { k: hx("#1a0e06"), b: hx("#5a3418"), B: hx("#8a5a2a"), h: hx("#b98a4a"), g: hx("#c99a3a"), G: hx("#ffd36a"), y: hx("#ffe9a0"), Y: hx("#e8b030"), s: hx("#7a5a22") };
  var CHEST = [
    "..kkkkkkkkkkkk..",
    ".kbbbbbbbbbbbbk.",
    ".kbBbbbbbbbbBbk.",
    "kkkkkkkkkkkkkkkk",
    "kYyYGyYyGYyYGYyk",
    "kGYyGYyGYyGYyYGk",
    "kBBBBBBBBBBBBBBk",
    "kBhBBBBkkBBBBhBk",
    "kgggggggkkgggggk",
    "kBBBBBBBGBBBBBBk",
    "kbbbbbbbbbbbbbbk",
    ".kkkkkkkkkkkkkk."
  ];

  /* --- Tukan auf dem Ast --- */
  var M_TC = { k: hx("#0c0e12"), K: hx("#262a32"), w: hx("#fff2c8"), y: hx("#ffd13a"), o: hx("#f2891a"), r: hx("#d9341a"), e: hx("#3fc8e8"), R: hx("#e8402a"), b: hx("#5a7a92"), j: hx("#ffb020") };
  var TOUCAN = ["...............kkkk..", "..........kkkkkkkkkk.", "..rooyyyyykkkkKkkkkk.", ".roooyyyyyyekkkkkKkk.", ".royyyyyyyyKeKkkkkk..", "..roooyyyyyKkkkkkkk..", "...oooooookwwwKkkk...", "........ookwwwwkkkk..", ".........kwwwwwKkkkk.", "..........wwwwwkkkkk.", "..........jwwwkkkkkk.", "...........kkkkkkkkk.", "............kkkkkkkRR", "............kkkkkkRRR", ".............bb.b.bR.."];

  /* --- Laterne --- */
  var M_LN = { k: hx("#1a1a14"), m: hx("#6a5a2a"), M: hx("#a8923a"), y: hx("#ffd36a"), Y: hx("#fff3a8"), o: hx("#ffa030"), g: hx("#fff8c0") };
  var LANTERN = ["..kk..", ".mMMm.", ".MyYM.", "mMyYgM", "mMoYgM", "mMyYyM", ".MyyyM", ".mMMMm", "..mkm."];

  /* --- Fuchs --- */
  var M_FX = { o: hx("#e8761e"), O: hx("#ff9a3a"), r: hx("#b4501a"), D: hx("#4a1e0a"), w: hx("#f6efe0"), c: hx("#d8c8aa"), q: hx("#e8b8a0"), k: hx("#181208") };
  var FOX = [
    ".DkD........DkD.......",
    "DkkkD......DkkkD......",
    "DoqoD......DoqoD......",
    "DoqoD......DoqoDDD....",
    "DoqqoDDDDDDoqqoDwwD...",
    "DooooooooooooooDwwwD..",
    ".DokooOOOOookoDDwwwwD.",
    "DoookkooookkoooDwwwwD.",
    "DooooooooooooooDDwwwoD",
    "ooowwwwwwwwwwoooDooooD",
    "DDwwwwwwwwwwwwDDDooooD",
    "..DwwwwkkwwwwD..Dooooo",
    "...DDwwDDwwDD...Dooooo",
    "..DooowwwwoooD..DooooD",
    ".DoooowwwwooooDDoooooD",
    ".DooowwwwwwoooDooooooD",
    "DoooowwwwwwoooooooooD.",
    "DoookkwwwwkkoooooooD..",
    "DoookkwwwwkkooooooD...",
    "DoookkwwwwkkoooDDD...."
  ];

  /* --- Eule im Baumloch (nur der Oberkoerper schaut heraus) --- */
  var M_OW = { k: hx("#1a1008"), b: hx("#4a3220"), B: hx("#7a5a3c"), w: hx("#c8a468"), W: hx("#fff0b0"), o: hx("#f0a030") };
  var OWL = ["kk........kk", "kbkkkkkkkkbk", "kbbbBBBBbbbk", "kBwwBBBBwwBk", "kBwWwBBwWwBk", "kBwwwooBwwwk", "kBBBBooBBBBk", ".kBBBBBBBBk.", "..kbbBBbbk.."];

  /* --- Bricklink-Stein: roter 2x4-Stein mit vier Noppen --- */
  var M_BR = { r: hx("#d62828"), R: hx("#ee3a3a"), h: hx("#ff8a7a"), d: hx("#8c1515"), D: hx("#5a0c0c"), w: hx("#ffd8d0") };
  var BRICK = [
    ".hhh..hhh..hhh..",
    ".hRr..hRr..hRr..",
    "hhhhhhhhhhhhhhhh",
    "RRRRRRRRRRRRRRrr",
    "RRRRRRRRRRRRRRrr",
    "rrrrrrrrrrrrrrrr",
    "dddddddddddddddd"
  ];

  /* --- Wegweiser --- */
  var M_SG = { p: hx("#3a2410"), P: hx("#5a3a1a"), w: hx("#e8dcb8"), W: hx("#c8b88c"), r: hx("#e0312a"), R: hx("#ff6a5a"), k: hx("#2a1c0e") };

  /* --- Zelt --- */
  var M_TN = { r: hx("#d8442a"), R: hx("#f26a3a"), O: hx("#ff9a5a"), s: hx("#9a2a1a"), S: hx("#6a1a12"), d: hx("#1a0c08"), D: hx("#0a0504"), w: hx("#f2e6c8"), W: hx("#d8c8a0"), k: hx("#3a2410"), y: hx("#ffd83a"), p: hx("#7a4a22") };
  var TENT = [
    "..........y...........",
    "..........pyy.........",
    "..........p...........",
    ".........rRr..........",
    "........rROOr.........",
    ".......rROOOrs........",
    "......rRROOOrrs.......",
    ".....rRRROdddrrs......",
    "....rRRROOdDDdrrs.....",
    "...rRRRROdDDDDdrrs....",
    "..rRRRRROdDDDDDdrrs...",
    ".ssssssssdDDDDDdsssss."
  ];

  /* --- Drache im Profil, schaut nach rechts: Fluegel oben / mitte / unten --- */
  var M_DG = { p: hx("#4a2a8a"), P: hx("#7a4ac8"), q: hx("#a888f0"), g: hx("#22a888"), G: hx("#6fe8c0"), w: hx("#c8b8ff"), W: hx("#ece4ff"), r: hx("#ff4a3a"), y: hx("#ffe84a"), h: hx("#e8e0ff"), k: hx("#150a22") };
  var DRAGON_UP = [
    "...p...........p......",
    "...pw.........pwp.....",
    "...pwW.......pwWwp....",
    "....pwW.....pwWWp.....",
    "....pwWw...pwWWwp.....",
    ".....pwWwppwWWwp....h.",
    "......pwWPPPWwp....hPh",
    ".......pPPPPPPpp.ppPPy",
    ".pp.pPPPPPqPPPPPPPPPPP",
    "..pppPPggggPPPPPPPPrr.",
    "....pppgGGggpp.pPPP...",
    "......ppp..pp..pp.p..."
  ];
  var DRAGON_MID = [
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    ".....pp.pp.........h..",
    "....pwWppWwp.......hPh",
    "...pwWWPPPWWp....ppPPy",
    "pp.pwWPPPPPWpp.pppPPPP",
    ".pppPPPPPqPPPPPPPPPrr.",
    "...pppggggPPPPPPPP....",
    ".....ppgGgpp..pPPP.p..",
  ];
  var DRAGON_DN = [
    "......................",
    "......................",
    "......................",
    "......................",
    "......................",
    "..................h...",
    "..................hPh.",
    ".........pppp...ppPPPy",
    "pp.pPPPPPPPPPPpPPPPPPP",
    ".pppPPggggPPPPPPPPPrr.",
    "..pwpppgGgppp..pPPP...",
    ".pwWWwpppppwWp..pp.p..",
    ".pwWWWwp..pwWWp.......",
    "..pwWWWwp.pwWWWp......",
    "...pwWWwp..pwWWwp.....",
    "....pwwp....pwwp......",
  ];

  /* --- Goldener Waechter: Kopf-Totem mit leuchtenden Augen auf einem Steinsockel --- */
  var M_ID = { y: hx("#c8921e"), Y: hx("#ffe27a"), o: hx("#8a5a14"), O: hx("#e8b230"), d: hx("#3a2a0c"), e: hx("#fffbd0"), k: hx("#3a2208"), r: hx("#d8304a"), R: hx("#ff9aa8"), s: hx("#2a2a24"), S: hx("#4a4a40") };
  var IDOL = [
    "..y......y..",
    ".yYy....yOy.",
    ".yYYy..yOOy.",
    ".yYYYyyYYOOy",
    "yYYYYrrYYYOy",
    "yYYkYYYYkYOy",
    "yYeekYYkeeOy",
    "yYYYYYYYYYOy",
    "yYYYYddYYYOy",
    ".yYoYYYYoYOy",
    ".yyYYYYYYOyy",
    "..yooooooOy.",
    ".yYYYrRYYOy.",
    ".yYYYrrYYOy.",
    ".yYYYYYYYOy.",
    ".yyyyyyyyyy.",
    "SSSSSSSSSSSS",
    "ssssssssssss"
  ];

  /* --- Libelle (Draufsicht, schaut nach rechts): zwei Fluegelstellungen --- */
  var M_DF = { o: hx("#a82a1a"), O: hx("#e03a2a"), R: hx("#ff6a3a"), r: hx("#ffa070"), e: hx("#2fd0c0"), k: hx("#143a58"), w: hx("#f6fdff"), c: hx("#bfe8f4") };
  var DF_A = [
    "....kw.kw....",
    "...kww.kww...",
    "....cw..cw...",
    "ooOOOOORRRrek",
    "....cw..cw...",
    "...kww.kww...",
    "....kw.kw...."
  ];
  var DF_B = [
    "......kw.kw..",
    ".....kww.kww.",
    "....kcw..cw..",
    "ooOOOOORRRrek",
    "....kcw..cw..",
    ".....kww.kww.",
    "......kw.kw.."
  ];

  /* --- Kleiner Drache fuer das schmale Himmelsband (15x8, schaut nach rechts) --- */
  var M_DS = { p: hx("#5a34a8"), P: hx("#9a6ae8"), q: hx("#b898f8"), g: hx("#40e0b8"), w: hx("#d8ccff"), W: hx("#f4efff"), r: hx("#ff5a3a"), y: hx("#ffe84a"), h: hx("#efe8ff") };
  var DS_UP = [
    "..p.....p......",
    "..pw...pwp.....",
    "...pw.pwwp.....",
    "....pPpwp...h..",
    "pp..pPPPPPp.hPy",
    ".ppPPPPPPPPPPPP",
    "..ppgggPPPPPrr.",
    "....pp.pp.pp..."
  ];
  var DS_MID = [
    "...............",
    "...............",
    "...............",
    "......pp.....h.",
    "pp..pwwwpp..hPy",
    ".ppPPPPPPPPPPPP",
    "..ppgggPPPPPrr.",
    "....pp.pp.pp..."
  ];
  var DS_DN = [
    "...............",
    "...............",
    "...............",
    "...............",
    "pp..pPPPPPp.hPy",
    ".ppPPPPPPPPPPPP",
    "..ppgggPPPPPrr.",
    "...pwpwpppwp...",
    "..pwWpwWpwWp...",
    "...pwp.pwp.p..."
  ];

  /* --- Leuchtlotus: weisse Bluete mit rosa Spitzen auf dem Seerosenblatt --- */
  var M_LT = { w: hx("#eefcff"), W: hx("#ffffff"), c: hx("#9fe0f0"), C: hx("#6cc4e0"), p: hx("#ff9ad0"), y: hx("#ffe45a"), Y: hx("#fff6b0"), g: hx("#1f9a4a"), G: hx("#4ed03a"), d: hx("#0f5a2c"), k: hx("#0a3a1c") };
  var LOTUS = [
    "......p......",
    ".....pWp.....",
    "..p..wWw..p..",
    ".pWp.wYw.pWp.",
    ".wWwwwYwwwWw.",
    "..cWWWWWWWc..",
    "...ccWWWcc...",
    "....CCccC....",
  ];

  /* ===== 4 Easter Eggs ===== */
  /* Easter Eggs fuer das Kaskaden-Tal (Sprites siehe scenery-sprites.js).
     Jedes Ei: lv (ab diesem Level sichtbar), name, hint, box(A) (Fundort), stat(E, A) (fester Teil, wird mit der Szene getoent) und
     dyn(D, A, ph, t, fr, gp) (bewegter Teil; gp = Tageszeit-Toenung pro Pixel). Alles haengt an den festen Ankern A der Szene. */
  function sprS(E, x, y, rows, map, mirror) { rows.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var ch = row[mirror ? row.length - 1 - i : i]; if (ch !== "." && map[ch] !== undefined) E.set(x + i, y + j, map[ch]); } }); }
  function sprD(D, x, y, rows, map, gp, mirror, mask) { rows.forEach(function (row, j) { for (var i = 0; i < row.length; i++) { var ch = row[mirror ? row.length - 1 - i : i]; if (ch !== "." && map[ch] !== undefined) { var px = x + i, py = y + j; if (mask && !mask[py * W + px]) continue; D.set(px, py, gp(map[ch], py)); } } }); }
  /* Lichtschein: feste Stufen (kraeftiger Kern, weicher Rand), am Rand leicht gerastert */
  function halo(D, cx, cy, rad, col, amt, sx) {
    sx = sx || 1;
    for (var y = -rad; y <= rad; y++) for (var x = -Math.ceil(rad * sx); x <= Math.ceil(rad * sx); x++) {
      var d = Math.hypot(x / sx, y) / rad; if (d >= 1) continue;
      var a = amt * (1 - d) * (1 - d) * 1.5; a = Math.min(a, amt);
      var q = a > amt * .72 ? amt * .85 : a > amt * .45 ? amt * .55 : a > amt * .22 ? amt * .3 : 0;
      if (q) D.mixpx(cx + x, cy + y, col, q); else if (a > amt * .06) D.dmix(cx + x, cy + y, col, a * 1.4);
    }
  }
  function spark(D, x, y, c1, c2) { D.set(x, y, c1); D.set(x - 1, y, c2); D.set(x + 1, y, c2); D.set(x, y - 1, c2); D.set(x, y + 1, c2); }
  function has(lv, n) { return lv >= n; }
  function ease(u) { u = u < 0 ? 0 : u > 1 ? 1 : u; return u * u * (3 - 2 * u); }
  function ellipseFill(E, cx, cy, rx, ry, fn) { for (var y = -ry; y <= ry; y++) for (var x = -rx; x <= rx; x++) { var d = (x * x) / (rx * rx) + (y * y) / (ry * ry); if (d <= 1) { var c = fn(x, y, d); if (c) E.set(cx + x, cy + y, c); } } }
  function mushroom(E, x, y, cw, ch, sh) {
    var R = hx("#e02a2a"), r = hx("#a81818"), H = hx("#ff7a6a"), W2 = hx("#fff4e0"), g = hx("#d8c8a0"), s = hx("#f2e6c8"), S = hx("#c8b48a"), i;
    for (i = 0; i < sh; i++) { E.set(x - 1, y + i, s); E.set(x, y + i, s); E.set(x + 1, y + i, S); if (cw > 7) { E.set(x - 2, y + i, s); E.set(x + 2, y + i, S); } }
    ellipseFill(E, x, y - 1, (cw >> 1), ch, function (px, py, d) { if (py > 0) return null; var c = d > .82 ? r : (px < -cw * .15 && py < -ch * .35) ? H : R; if (((px * 5 + py * 3 + 99) % 7) === 0 && d < .7) c = W2; return c; });
    for (i = -(cw >> 1) + 1; i < (cw >> 1); i++) E.set(x + i, y, g);
    E.set(x + (cw >> 2), y - ch + 1, W2); E.set(x - (cw >> 2), y - ch + 2, W2);
  }
  /* Fuchs: die Ohren (Zeilen 0-3, je 5 Spalten) werden bewegt gezeichnet, der Rest steht fest */
  var FOX_EAR = FOX.slice(0, 4).map(function (r) { return r.slice(0, 5); });
  var FOX_BODY = FOX.map(function (r, j) { return j > 3 ? r : "....." + r.slice(5, 11) + "....." + r.slice(16); });
  /* Steinfarben fuer das Tor */
  var ST = pal(["#17302f", "#2c4f4c", "#477570", "#6c9e96", "#a0ccbe"]);

  /* ---------- Die Eier ---------- */
  var EGGS = [
    { lv: 1, name: "Blauer Morpho-Schmetterling", hint: "flattert über dem Blumenbeet und landet ab und zu auf einer Blüte",
      box: function (A) { var f = A.flowers[0]; return [f.x - 28, f.y - 30, 56, 36]; },
      dyn: function (D, A, ph, t, fr, gp) {
        var f = A.flowers[0], cyc = t % 20, F = function (tt) { return [f.x + Math.sin(tt * .62) * 22 + Math.sin(tt * 1.7) * 3, f.y - 14 + Math.sin(tt * 1.05) * 8 + Math.sin(tt * .4) * 3]; }, Pp = [f.x, f.y - 4], pos, mode = 0, u, fp = F(t), frame;
        if (ph.night) { frame = Math.sin(t * .9) > .55 ? BF_OPEN : BF_HALF; sprD(D, Pp[0] - (frame[0].length >> 1), Pp[1] - (frame.length >> 1), frame, M_BF, gp); if (Math.sin(t * 1.3) > .5) halo(D, Pp[0], Pp[1] - 2, 6, hx("#7fd0ff"), .22); return; }
        if (cyc < 13) pos = fp; else if (cyc < 14) { u = ease(cyc - 13); pos = [fp[0] + (Pp[0] - fp[0]) * u, fp[1] + (Pp[1] - fp[1]) * u]; } else if (cyc < 18) { pos = Pp; mode = 1; } else if (cyc < 19) { u = ease(cyc - 18); pos = [Pp[0] + (fp[0] - Pp[0]) * u, Pp[1] + (fp[1] - Pp[1]) * u]; } else pos = fp;
        if (mode) { var s8 = (fr >> 1) % 8; frame = s8 === 5 ? BF_SHUT : (s8 === 4 || s8 === 6) ? BF_HALF : BF_OPEN; } else { frame = ((fr >> 1) & 1) ? BF_HALF : BF_OPEN; }
        sprD(D, Math.round(pos[0] - (frame[0].length >> 1)), Math.round(pos[1] - (frame.length >> 1)), frame, M_BF, gp);
      } },
    { lv: 2, name: "Fliegenpilze", hint: "wachsen neben dem Wegweiser am Anfang der Brücke",
      box: function (A) { var l = A.landL; return [l.x - 24, l.y - 12, 36, 14]; },
      stat: function (E, A) { var l = A.landL; mushroom(E, l.x - 14, l.y + 5, 5, 3, 3); mushroom(E, l.x - 4, l.y + 6, 11, 5, 5); mushroom(E, l.x + 6, l.y + 5, 7, 4, 4); } },
    { lv: 3, name: "Rotaugenlaubfrosch", hint: "sitzt auf dem Trittstein im Bach und quakt manchmal",
      box: function (A) { var q = A.rocks[0]; return [q.x - 9, q.y - 13, 24, 16]; },
      stat: function (E, A) { var q = A.rocks[0]; sprS(E, q.x - 6, q.y - 8, FROG, M_FR); },
      dyn: function (D, A, ph, t, fr, gp) {
        var q = A.rocks[0], x = q.x - 6, y = q.y - 8, bl = Math.sin(t * .8) > .9 || ph.night, croak = !ph.night && Math.sin(t * .37) > .93;
        if (bl) { D.set(x + 6, y + 1, gp(M_FR.g, y)); D.set(x + 7, y + 1, gp(M_FR.d, y)); D.set(x + 8, y + 1, gp(M_FR.g, y)); D.set(x + 9, y + 1, gp(M_FR.g, y)); }
        if (croak) { var c = gp(M_FR.c, y + 6), c2 = gp(M_FR.r, y + 6); D.set(x + 11, y + 5, c); D.set(x + 12, y + 5, c); D.set(x + 13, y + 6, c2); D.set(x + 12, y + 6, c); D.set(x + 12, y + 7, c2); }
      } },
    { lv: 4, name: "Kolibri", hint: "schwebt vor den Blüten und wechselt von Blume zu Blume",
      box: function (A) { var f = A.flowers[1]; return [f.x - 24, f.y - 24, 48, 28]; },
      dyn: function (D, A, ph, t, fr, gp) {
        if (ph.night) return;
        var f = A.flowers, k = Math.floor(t / 3.4) % 3, nx = (k + 1) % 3, u = ease((t % 3.4) / .6), p0 = f[k], p1 = f[nx], up = (fr & 1) === 0;
        var hx2 = (p0.x + (p1.x - p0.x) * u) - 15 + Math.sin(t * 4) * .6, hy2 = (p0.y + (p1.y - p0.y) * u) - (up ? 2 : 3) + Math.cos(t * 5) * .6;
        sprD(D, Math.round(hx2), Math.round(hy2), up ? HB0 : HB1, M_HB, gp);
      } },
    { lv: 5, name: "Schatztruhe zwischen den Wurzeln", hint: "liegt halb im Moos am Fuß des großen Stamms und glitzert",
      box: function (A) { var r = A.roots; return [r.x - 12, r.y - 14, 30, 24]; },
      stat: function (E, A) { var r = A.roots; sprS(E, r.x - 8, r.y - 8, CHEST, M_CH); [[10, 2], [12, 3], [9, 3]].forEach(function (p, i) { E.set(r.x + p[0], r.y + p[1], i ? M_CH.G : M_CH.y); E.set(r.x + p[0] + 1, r.y + p[1], M_CH.Y); }); },
      dyn: function (D, A, ph, t, fr, gp) {
        var r = A.roots; if (ph.night) halo(D, r.x, r.y - 6, 12, hx("#ffc860"), .3);
        var s = Math.floor(t * 1.3) % 3, px = [[-4, -4], [2, -3], [-1, -5]][s]; if (((t * 1.3) % 1) < .55) spark(D, r.x + px[0], r.y + px[1], hx("#ffffff"), hx("#ffe27a"));
      } },
    { lv: 6, name: "Tukan", hint: "sitzt auf dem Ast und klappert gelegentlich mit dem Schnabel",
      box: function (A) { var p = A.perch; return [p.x - 14, p.y - 16, 30, 18]; },
      stat: function (E, A) { var p = A.perch; sprS(E, p.x - 12, p.y - 15, TOUCAN, M_TC); },
      dyn: function (D, A, ph, t, fr, gp) {
        var p = A.perch, x = p.x - 12, y = p.y - 15, clack = Math.sin(t * .5) > .94;
        if (ph.night) { D.set(x + 11, y + 3, gp(M_TC.k, y)); D.set(x + 12, y + 3, gp(M_TC.k, y)); }
        if (clack) { for (var i = 0; i < 6; i++) D.set(x + 2 + i, y + 5, gp(M_TC.o, y)); }
      } },
    { lv: 7, name: "Regenbogen im Nebel", hint: "spannt sich über das Becken am Fuß der Kaskade",
      box: function (A) { var m = A.mist; return [m.x - 46, m.y - 40, 92, 44]; },
      dyn: function (D, A, ph, t, fr, gp) {
        var m = A.mist, rc = [hx("#ff7a7a"), hx("#ffae72"), hx("#fff09a"), hx("#86e89c"), hx("#72c4ff"), hx("#8f86ff"), hx("#c690ff")], cx = m.x, cy = m.y + 12, R0 = 41, al = ph.night ? .16 : .56, x, y, d, k;
        for (y = cy - R0 - 2; y <= 149; y++) for (x = cx - R0 - 2; x <= cx + R0 + 2; x++) { d = Math.hypot(x - cx, y - cy); k = Math.floor(R0 - d); if (k < 0 || k > 6) continue; D.mixpx(x, y, ph.night ? mix(rc[k], WHITE, .5) : rc[k], al * (.88 + .12 * Math.sin(t * .7 + x * .15))); }
      } },
    { lv: 8, name: "Laterne an der Brücke", hint: "hängt am Brückenpfosten und leuchtet, wenn es dunkel wird",
      box: function (A) { var b = A.bridge; return [b.x + b.w - 8, b.y - 22, 20, 36]; },
      stat: function (E, A) { var b = A.bridge, px = b.x + b.w, i; for (var y = -15; y < 0; y++) E.set(px + 1, b.y + y, hx("#4a2c14")); for (i = 0; i < 6; i++) E.set(px + 1 + i, b.y - 15 + (i > 3 ? 1 : 0), hx("#4a2c14")); E.set(px + 7, b.y - 14, hx("#1a1a14")); sprS(E, px + 4, b.y - 13, LANTERN, M_LN); },
      dyn: function (D, A, ph, t, fr, gp) {
        var b = A.bridge, px = b.x + b.w, lf = .65 + .35 * Math.sin(t * 5.3) * Math.sin(t * 2.1), cx = px + 7, cy = b.y - 8, x, y;
        halo(D, cx, cy, 12, hx("#ffd36a"), (ph.night ? .6 : ph.name === "ABEND" ? .34 : .1) * lf);
        if (ph.night || ph.name === "ABEND") for (y = 0; y < 14; y++) for (x = -4; x <= 3; x++) { var d = Math.abs(x) / 4 + y / 14; if (d < 1) D.dmix(px + 7 + x, b.y + 8 + y, hx("#ffd36a"), (1 - d) * .4 * lf); }
        D.set(cx, cy, hx("#fff8c0")); D.set(cx, cy + 1, hx("#ffcf5a"));
      } },
    { lv: 9, name: "Fuchs im Farn", hint: "sitzt im Schatten zwischen den Stämmen, blinzelt und zuckt mit den Ohren",
      box: function (A) { var b = A.bank; return [b.x + 25, b.y - 20, 26, 28]; },
      stat: function (E, A) {
        var b = A.bank, x = b.x + 27, y = b.y - 18, fr = pal(["#06303a", "#0c5a4a", "#1f9a46", "#4ed03a", "#9ef04a"]);
        sprS(E, x, y, FOX_BODY, M_FX);
        palm(E, rng(5), x + 1, y + 21, -1.0, 12, .5, 4, fr); palm(E, rng(7), x + 15, y + 21, -2.15, 12, .5, 4, fr); palm(E, rng(9), x + 8, y + 22, -1.57, 6, 0, 3, fr);
        tuft(E, rng(11), x + 5, y + 21, 5, fr); tuft(E, rng(13), x + 11, y + 21, 5, fr);
      },
      dyn: function (D, A, ph, t, fr, gp) {
        var b = A.bank, x = b.x + 27, y = b.y - 18, fl = Math.sin(t * .8) > .93 ? 1 : 0, fr2 = Math.sin(t * .55 + 1.7) > .94 ? 1 : 0, blink = Math.sin(t * .6) > .94, lit = ph.night || ph.name === "ABEND", i;
        sprD(D, x, y + fl, FOX_EAR, M_FX, gp); sprD(D, x + 11, y + fr2, FOX_EAR, M_FX, gp);
        if (blink) { [[4, 7], [5, 7], [10, 7], [11, 7], [3, 6], [12, 6]].forEach(function (p) { D.set(x + p[0], y + p[1], gp(M_FX.o, y + p[1])); }); }
        else if (lit) { var ec = hx("#ffd34a"); [[4, 7], [11, 7]].forEach(function (p) { D.set(x + p[0], y + p[1], ec); }); if (ph.night) { halo(D, x + 4, y + 7, 3, ec, .3); halo(D, x + 11, y + 7, 3, ec, .3); } }
      } },
    { lv: 10, name: "Eule im Baumloch", hint: "wohnt im großen Stamm; nachts leuchten ihre Augen",
      box: function (A) { var h = A.hole; return [h.x - 10, h.y - 13, 20, 28]; },
      stat: function (E, A) {
        var h = A.hole, x, y;
        ellipseFill(E, h.x, h.y, 7, 11, function (px, py, dd) { return dd > .82 ? hx("#0c2428") : hx("#02080a"); });
        for (y = -11; y <= 11; y++) { var ww = Math.round(7 * Math.sqrt(Math.max(0, 1 - (y * y) / 121))); if (ww > 0) { E.set(h.x - ww - 1, h.y + y, y < 3 ? hx("#ffa04a") : hx("#1a6a6a")); E.set(h.x + ww + 1, h.y + y, hx("#041418")); } }
        for (x = -3; x <= 3; x++) E.set(h.x + x, h.y - 12, hx("#04100f"));
        sprS(E, h.x - 6, h.y + 3, OWL, M_OW);
        for (x = -5; x <= 5; x++) { E.set(h.x + x, h.y + 12, hx("#2a9a8a")); E.set(h.x + x, h.y + 13, x % 2 ? hx("#4ed03a") : hx("#2f8a3a")); }
      },
      dyn: function (D, A, ph, t, fr, gp) {
        var h = A.hole, blink = Math.sin(t * .6) > .93, look = Math.sin(t * .3) > .5 ? 1 : 0, ec = ph.night ? hx("#ffe14a") : hx("#f2c845"), ox = h.x - 6, oy = h.y + 3;
        if (blink) { for (var i = 0; i < 3; i++) { D.set(ox + 2 + i, oy + 3, gp(M_OW.B, oy + 3)); D.set(ox + 7 + i, oy + 3, gp(M_OW.B, oy + 3)); D.set(ox + 2 + i, oy + 4, gp(M_OW.k, oy + 4)); D.set(ox + 7 + i, oy + 4, gp(M_OW.k, oy + 4)); } }
        else { D.set(ox + 3 + look, oy + 4, gp(hx("#101010"), oy + 4)); D.set(ox + 8 + look, oy + 4, gp(hx("#101010"), oy + 4)); }
        if (ph.night && !blink) { halo(D, ox + 3, oy + 4, 4, ec, .5); halo(D, ox + 8, oy + 4, 4, ec, .5); D.set(ox + 3, oy + 4, ec); D.set(ox + 8, oy + 4, ec); }
      } },
    { lv: 11, name: "Bricklink-Stein", hint: "ein roter Stein mit Noppen liegt auf dem Trittstein",
      box: function (A) { var q = A.rocks[1]; return [q.x - 6, q.y - 13, 22, 15]; },
      stat: function (E, A) { var q = A.rocks[1]; sprS(E, q.x - 4, q.y - 6, BRICK, M_BR); },
      dyn: function (D, A, ph, t, fr, gp) { if (Math.sin(t * 1.7) > .86) { var q = A.rocks[1]; D.set(q.x - 1, q.y - 5, hx("#ffffff")); D.set(q.x - 2, q.y - 5, hx("#ffc8c0")); } } },
    { lv: 12, name: "Wegweiser mit Play-Knopf", hint: "zeigt vom Beginn der Brücke zum Kanal",
      box: function (A) { var l = A.landL; return [l.x - 30, l.y - 26, 22, 34]; },
      stat: function (E, A) {
        var l = A.landL, x = l.x - 26, y = l.y - 20, i; E.rect(x + 8, y + 6, 3, 26, M_SG.p); E.rect(x + 8, y + 6, 1, 26, M_SG.P);
        E.rect(x, y, 19, 9, M_SG.w); E.rect(x, y, 19, 1, M_SG.W); E.rect(x, y + 8, 19, 1, M_SG.W); E.rect(x, y, 1, 9, M_SG.k); E.rect(x + 18, y, 1, 9, M_SG.k);
        E.rect(x + 4, y + 1, 11, 7, M_SG.r); E.rect(x + 4, y + 1, 11, 1, M_SG.R);
        for (i = 0; i < 5; i++) { var wd = i < 3 ? i + 1 : 5 - i; E.rect(x + 8, y + 2 + i, wd, 1, M_SG.w); }
        E.rect(x + 3, y + 12, 15, 5, M_SG.w); E.rect(x + 3, y + 12, 15, 1, M_SG.W); for (i = 0; i < 4; i++) E.set(x + 16 + i, y + 14 - (i > 1 ? 1 : 0) + (i > 2 ? 1 : 0), M_SG.W); E.set(x + 19, y + 14, M_SG.w); E.rect(x + 5, y + 14, 8, 1, M_SG.k);
      } },
    { lv: 13, name: "Libelle", hint: "patrouilliert über dem Becken und spiegelt sich im Wasser",
      box: function (A) { var p = A.pool; return [p.x, p.y - 12, p.w, 28]; },
      dyn: function (D, A, ph, t, fr, gp) {
        if (ph.night) return; var p = A.pool, sx = .5 + .5 * Math.sin(t * .22), dx = Math.round(p.x + 8 + (p.w - 30) * sx), dir = Math.cos(t * .22) >= 0 ? 1 : -1, dy = Math.round(p.y + 6 + Math.sin(t * .6) * 5 + Math.sin(t * 3.1) * .8), wf = (fr & 1) === 0;
        sprD(D, dx, dy, wf ? DF_A : DF_B, M_DF, gp, dir < 0);
        for (var i = 0; i < 6; i++) D.dmix(dx + 3 + i, dy + 10, M_DF.O, .22);
      } },
    { lv: 14, name: "Zeltlager mit Lagerfeuer", hint: "steht auf der Lichtung; abends brennt das Feuer",
      box: function (A) { var b = A.bank; return [b.x - 44, b.y - 18, 78, 30]; },
      stat: function (E, A) {
        var b = A.bank, x = b.x - 40, y = b.y - 12, i; sprS(E, x, y, TENT, M_TN);
        for (i = 0; i < 4; i++) E.set(x + 4 + i * 4, y + 12, hx("#6a8a4a"));
        E.set(x - 1, y + 11, M_TN.p); E.set(x + 22, y + 11, M_TN.p); E.set(x - 2, y + 10, M_TN.W); E.set(x + 23, y + 10, M_TN.W);
        var fx = b.x + 4, fy = b.y + 6, st = [hx("#4a4a44"), hx("#6a6a60"), hx("#8a8a7e")], k;
        for (k = 0; k < 7; k++) { var a = k / 7 * Math.PI * 2; E.set(fx + Math.cos(a) * 6, fy + Math.sin(a) * 2.6, st[k % 3]); E.set(fx + Math.cos(a) * 6, fy + Math.sin(a) * 2.6 + 1, hx("#2a2a26")); }
        E.rect(fx - 4, fy, 9, 2, hx("#3a2410")); E.rect(fx - 4, fy, 9, 1, hx("#6a4420")); E.rect(fx - 2, fy - 1, 5, 1, hx("#4a2c14"));
        E.rect(fx - 12, fy + 2, 7, 3, hx("#6a4420")); E.rect(fx - 12, fy + 2, 7, 1, hx("#8a5a2a")); E.rect(fx - 12, fy + 4, 7, 1, hx("#3a2410"));
      },
      dyn: function (D, A, ph, t, fr, gp) {
        var b = A.bank, fx = b.x + 4, fy = b.y + 6, r2 = rng(fr * 7 + 3), i, fl = .75 + .25 * Math.sin(t * 9);
        halo(D, fx, fy - 4, 18, hx("#ff9a4a"), (ph.night ? .55 : ph.name === "ABEND" ? .3 : .08) * fl);
        var fc = [hx("#ffe9a0"), hx("#ffc050"), hx("#ff8a2a"), hx("#e8501a")];
        for (i = 0; i < 12; i++) { var h = 6 - Math.abs(i - 5.5) * .7 + r2() * 3, xx = fx - 3 + i * .55; for (var k = 0; k < h; k++) D.set(xx + Math.sin(t * 8 + k) * .5, fy - k, fc[Math.min(3, (k / h * 4) | 0)]); }
        for (i = 0; i < 3; i++) { var sy = fy - 9 - ((t * 9 + i * 7) % 18), sx = fx + Math.sin(t * 1.3 + i * 2) * 3 + (sy - fy) * -.2; D.dmix(sx, sy, hx("#d8d4c8"), .5 - (fy - 9 - sy) * -.02); }
        if (r2() > .6) D.set(fx + (r2() * 8 - 4), fy - 7 - (r2() * 6 | 0), hx("#ffd36a"));
      } },
    { lv: 15, name: "Kleiner Drache", hint: "fliegt ab und zu durch das Himmelsband und taucht in die Schlucht über der Kaskade ein",
      box: function (A) { var s = A.sky; return [s.x, s.y, s.w, s.h]; },
      dyn: function (D, A, ph, t, fr, gp) {
        var u = (t % 36) / 16; if (u > 1) return;
        var gx = Math.round(104 + u * 146), cx = gx + 8, dip = 8 * Math.exp(-Math.pow((cx - 158) / 13, 2)), gy = Math.round(1 + Math.sin(t * 1.1) * 1.2 + dip), k = (fr >> 1) % 4, fm = k === 0 ? DS_UP : k === 2 ? DS_DN : DS_MID;
        sprD(D, gx, gy, fm, M_DS, gp, false, A.skyMask);
        if (ph.night && A.skyMask[(gy + 6) * W + gx + 14]) halo(D, gx + 14, gy + 6, 3, hx("#ff5a3a"), .4);
      } },
    { lv: 16, name: "Leuchtlotus", hint: "blüht im Becken und leuchtet nachts",
      box: function (A) { var w = A.water; return [w.x - 14, w.y - 12, 28, 20]; },
      stat: function (E, A) {
        var w = A.water, pad = [hx("#0f6a34"), hx("#1f9a4a"), hx("#4ed03a")];
        ellipseFill(E, w.x, w.y + 3, 10, 3, function (px, py, d) { return d > .8 ? pad[0] : (py < 0 && px < 3) ? pad[2] : pad[1]; });
        E.set(w.x + 6, w.y + 2, hx("#30d0c0")); E.set(w.x + 7, w.y + 2, hx("#30d0c0")); E.set(w.x + 8, w.y + 3, hx("#30d0c0"));
        sprS(E, w.x - 6, w.y - 5, LOTUS, M_LT);
      },
      dyn: function (D, A, ph, t, fr, gp) { var w = A.water, pu = .5 + .5 * Math.sin(t * 1.6); halo(D, w.x, w.y - 2, 12, hx("#9fe8ff"), (ph.night ? .75 : .16) * (.6 + .4 * pu)); if (ph.night) { for (var k = 0; k < 4; k++) D.dmix(w.x - 5 + k * 3, w.y + 8, hx("#9fe8ff"), .35 * pu); spark(D, w.x - 9 + ((t * 3) % 18), w.y - 8 - ((t * 5) % 7), hx("#ffffff"), hx("#9fe8ff")); } } },
    { lv: 18, name: "Verborgenes Tempeltor", hint: "ein alter Eingang am Fuß der Felswand, dessen Zeichen leuchten",
      box: function (A) { var w = A.wall; return [w.x - 17, w.y - 44, 34, 50]; },
      stat: function (E, A) {
        var w = A.wall, x0 = w.x, yb = w.y, yt = yb - 40, i, j, c, r = rng(77);
        /* Treppe */
        for (i = 0; i < 3; i++) for (j = 0; j < 2; j++) { var sx = x0 - 15 + i * 2, sw = 31 - i * 4, sy = yb + i * 2 + j; for (var q = 0; q < sw; q++) E.set(sx + q, sy, j === 0 ? ST[i === 0 ? 3 : 2] : ST[1]); }
        /* Saeulen links hell, rechts dunkel, mit Steinfugen */
        for (j = yt + 8; j < yb; j++) for (i = 0; i < 5; i++) { c = i < 1 ? ST[4] : i < 3 ? ST[3] : ST[2]; if ((j - yt) % 6 === 0) c = ST[1]; E.set(x0 - 13 + i, j, c); }
        for (j = yt + 8; j < yb; j++) for (i = 0; i < 5; i++) { c = i < 2 ? ST[2] : i < 4 ? ST[1] : ST[0]; if ((j - yt) % 6 === 0) c = ST[0]; E.set(x0 + 9 + i, j, c); }
        /* Sturz mit Zahnfries */
        E.rect(x0 - 14, yt, 28, 3, ST[4]); E.rect(x0 - 14, yt + 3, 28, 3, ST[3]); E.rect(x0 - 14, yt + 6, 28, 2, ST[2]);
        for (i = 0; i < 7; i++) E.rect(x0 - 12 + i * 4, yt + 4, 2, 2, ST[1]);
        for (i = 0; i < 28; i++) E.set(x0 - 14 + i, yt + 8, ST[0]);
        /* Dunkler Durchgang mit Tiefe */
        E.rect(x0 - 8, yt + 9, 16, yb - yt - 9, hx("#041214")); E.rect(x0 - 8, yt + 9, 1, yb - yt - 9, hx("#0a2a2a")); E.rect(x0 + 7, yt + 9, 1, yb - yt - 9, hx("#0a2a2a"));
        for (i = -7; i <= 7; i++) E.set(x0 + i, yt + 9, hx("#020a0c"));
        /* Rinnen der Zeichen links und rechts auf den Saeulen */
        for (j = 0; j < 4; j++) { E.set(x0 - 11, yt + 13 + j * 6, ST[1]); E.set(x0 - 10, yt + 13 + j * 6, ST[1]); E.set(x0 + 11, yt + 13 + j * 6, ST[0]); E.set(x0 + 12, yt + 13 + j * 6, ST[0]); }
        /* Moos oben, Ranken, Risse */
        clump(E, rng(21), x0, yt - 1, 14, 4, pal(["#0f5a3a", "#1f9a46", "#4ed03a", "#9ef04a", "#d8ff7a"]), { ns: 4, hang: .6, hangLen: 7, leaf: 3 });
        for (i = 0; i < 4; i++) vine(E, r, x0 - 12 + i * 8 + (r() * 3 | 0), yt + 4, 10 + (r() * 14 | 0), false, hx("#0f5a3a"), hx("#1f9a46"), hx("#4ed03a"), [hx("#4ed03a"), hx("#9ef04a")]);
        for (i = 0; i < 5; i++) { E.set(x0 - 14 + (r() * 28 | 0), yb - 1 + (r() * 3 | 0), hx("#4ed03a")); E.set(x0 - 13 + (r() * 26 | 0), yb + 4 + (r() * 3 | 0), hx("#2f8a3a")); }
      },
      dyn: function (D, A, ph, t, fr, gp) {
        var w = A.wall, gl = hx("#7fe6c0"), yt = w.y - 40, pu = .55 + .45 * Math.sin(t * 1.4), wave = function (k) { return Math.sin(t * 1.6 - k * .7) > -.25; };
        for (var j = 0; j < 4; j++) if (wave(j)) { D.set(w.x - 11, yt + 13 + j * 6, gl); D.set(w.x - 10, yt + 13 + j * 6, mix(gl, WHITE, .5)); D.set(w.x + 11, yt + 13 + j * 6, gl); D.set(w.x + 12, yt + 13 + j * 6, mix(gl, WHITE, .5)); }
        var cy = yt + 24; [[-2, -4], [2, -4], [0, 0], [-3, 5], [3, 5], [0, 9]].forEach(function (p, k) { if (wave(k)) { D.set(w.x + p[0], cy + p[1], gl); D.set(w.x + p[0] + 1, cy + p[1], mix(gl, WHITE, .5)); } });
        halo(D, w.x, cy + 2, 12, gl, (ph.night ? .5 : .18) * pu, .8);
      } },
    { lv: 22, name: "Polarlicht", hint: "tanzt über der Kaskade, am hellsten bei Nacht",
      box: function (A) { var s = A.sky; return [s.x, s.y, s.w, s.h]; },
      dyn: function (D, A, ph, t, fr, gp) {
        var amt = ph.night ? 1 : ph.name === "ABEND" ? .6 : ph.name === "MORGEN" ? .5 : 0; if (!amt) return;
        var m = A.skyMask, cols = [hx("#c8ffe6"), hx("#34e8a4"), hx("#2fb4e0"), hx("#9a6aff")], x, k, yy;
        for (k = 0; k < 3; k++) for (x = 84; x < 250; x++) {
          var top = k * 3 + Math.sin(x * .045 + t * .3 + k * 2) * 2.5 + Math.sin(x * .017 - t * .2 + k) * 1.5, y0 = Math.round(top),
            hh = (8 + 24 * vn(x * .1 + t * .3, k * 5.1, 3)) * (.6 + .4 * Math.sin(x * .03 + t * .2 + k)) * (1 - .12 * k),
            ray = .45 + .55 * vn(x * .42 + t * .35, k * 3.3, 9);
          for (yy = y0; yy < y0 + hh; yy++) {
            if (yy < 0 || !m[yy * W + x]) continue;
            var u = (yy - y0) / hh, a = amt * Math.pow(1 - u, 1.05) * ray * (k === 0 ? 1 : k === 1 ? .8 : .6);
            if (u < .1) D.mixpx(x, yy, cols[0], Math.min(.9, a * 1.2)); else D.dmix(x, yy, u < .38 ? cols[1] : u < .72 ? cols[2] : cols[3], a);
          }
        }
      } },
    { lv: 26, name: "Leuchtbaum", hint: "ein kleiner Geisterbaum auf der Felsinsel im Becken, umgeben von Lichtern",
      box: function (A) { var l = A.ledge; return [l.x - 18, l.y - 34, 30, 42]; },
      stat: function (E, A) {
        var l = A.ledge, tx = l.x - 3, TP = pal(["#3a1a5a", "#6a34a0", "#a05ad8", "#e888e8", "#ffd8f4"]), TK = pal(["#0c1a22", "#16323a", "#285a5a", "#3a8a82"]);
        trunk(E, rng(9), tx, l.y - 15, tx, l.y + 1, 3, 6, TK, { rim: hx("#c070e8"), wobble: 1.1 });
        limb(E, rng(3), tx, l.y - 10, tx - 5, l.y - 14, tx - 8, l.y - 18, 1.6, 1, TK, hx("#c070e8")); limb(E, rng(4), tx, l.y - 11, tx + 5, l.y - 15, tx + 8, l.y - 19, 1.6, 1, TK, hx("#c070e8"));
        clump(E, rng(31), tx, l.y - 22, 11, 7, TP, { ns: 6, hang: .5, hangLen: 7, leaf: 3 }); clump(E, rng(32), tx - 8, l.y - 17, 7, 4, TP, { ns: 9, hang: .4, hangLen: 5, leaf: 3 }); clump(E, rng(33), tx + 8, l.y - 18, 7, 4, TP, { ns: 12, hang: .4, hangLen: 5, leaf: 3 });
        [[-4, -24], [3, -26], [7, -21], [-8, -19], [0, -20], [4, -17], [-10, -15]].forEach(function (p, i) { E.set(tx + p[0], l.y + p[1], i % 2 ? hx("#ffffff") : hx("#ffe8f8")); });
      },
      dyn: function (D, A, ph, t, fr, gp) {
        var l = A.ledge, tx = l.x - 3, i; halo(D, tx, l.y - 19, 15, hx("#d890ff"), (ph.night ? .55 : .2), 1.15);
        for (i = 0; i < 7; i++) { var ph0 = (t * .35 + i * .143) % 1, ox = tx - 10 + i * 3.4 + Math.sin(t * 1.3 + i) * 2 + ph0 * 3, oy = l.y - 18 + ph0 * 22; if (oy < l.y + 6) { D.set(ox, oy, ph0 < .8 ? hx("#ffe8f8") : hx("#d890ff")); if (i % 3 === 0 && ph.night) D.set(ox + 1, oy, hx("#ff9ad8")); } }
        if (ph.night) for (i = 0; i < 5; i++) { var oo = (t * .5 + i * .21) % 1; spark(D, tx - 10 + i * 5 + Math.sin(t + i) * 3, l.y - 8 - oo * 20, hx("#ffffff"), hx("#e8a0ff")); }
      } },
    { lv: 30, name: "Goldener Wächter", hint: "eine kleine Katzenstatue auf dem Stein vor der Kaskade; nachts glühen ihre Augen",
      box: function (A) { var q = A.rocks[2]; return [q.x - 10, q.y - 22, 20, 26]; },
      stat: function (E, A) { var q = A.rocks[2]; sprS(E, q.x - 6, q.y - 16, IDOL, M_ID); },
      dyn: function (D, A, ph, t, fr, gp) {
        var q = A.rocks[2], x = q.x - 6, y = q.y - 16;
        if (ph.night) { var em = function (c, yy) { return mix(gp(c, yy), c, .5); }; sprD(D, x, y, IDOL.slice(0, 15), M_ID, em); }
        halo(D, q.x, q.y - 9, 11, hx("#ffd36a"), (ph.night ? .38 : .14) * (.7 + .3 * Math.sin(t * 1.2)));
        if (ph.night) { var ey = hx("#fffbd0"); [2, 3, 8, 9].forEach(function (c) { D.set(x + c, y + 6, ey); }); halo(D, x + 3, y + 6, 3, ey, .45); halo(D, x + 8, y + 6, 3, ey, .45); }
        if (Math.sin(t * 1.3) > .83) { var sx = x + (Math.sin(t * 3) > 0 ? 2 : 9), sy = y + 2; spark(D, sx, sy, hx("#ffffff"), hx("#fff3a0")); }
      } }
  ];

  /* ===== 5 Laufzeit ===== */
  /* Laufzeit der Szene: zusammengesetztes Bild (Szene + feste Eier, getoent) und bewegte Ebene (Wasserfall, Glanz, Nebel, Staub, Blaetter, Gluehwuermchen, Eier) */
  function sceneDyn(D, S, ph, t, fr) {
    var gp = function (c, yy) { return gradePx(c, ph, yy); }, i, x, y, r = rng(fr * 13 + 5), F = S.F, A = S.A;
    S.fall.forEach(function (q) {
      var idx = q[0], k = q[1]; x = idx % W; y = (idx / W) | 0;
      var base = (((y * 2 + x * 5 - fr * 3) % 13) + 13) % 13, tone = k === 0 ? (base < 4 ? 1 : 0) : k === 1 ? (base < 5 ? 2 : 1) : (base < 4 ? 3 : base < 8 ? 2 : base < 10 ? 3 : 2);
      if (((x * 7 + (y >> 3) * 3 - (fr >> 1)) % 11) < 2 && k > 0) tone = Math.min(3, tone + 1);
      D.d[idx] = gp(F[tone], y);
    });
    var gc = S.glintC || hx("#e8fffa");
    S.glints.forEach(function (g) { if (Math.sin(t * 2 + g[2] * 3) > .25) { D.set(g[0], g[1], gp(gc, g[1])); D.set(g[0] + 1, g[1], gp(mix(gc, hx("#7fd0d8"), .4), g[1])); } });
    for (i = 0; i < 64; i++) { var mx = A.mist.x + (r() - .5) * A.mist.r * 2.2, my = A.mist.y - r() * A.mist.r * .8; D.dmix(mx, my, WHITE, .5); }
    for (i = 0; i < 34; i++) { var sx = ((i * 47 + t * 2.2) % W), sy = (i * 29 + t * 1.4 + Math.sin(t * .4 + i) * 6) % 150; D.set(sx, sy, mix(D.get(sx, sy), hx("#fff4cc"), .4 * (ph.night ? .5 : 1))); }
    for (i = 0; i < 8; i++) { var lx = (i * 53 + t * 5 + Math.sin(t * .7 + i) * 10) % W, ly = (i * 37 + t * 9) % (H - 50); D.set(lx, ly, gp(i % 2 ? hx("#8fd35a") : hx("#e0902a"), ly)); D.set(lx + 1, ly, gp(i % 2 ? hx("#4a9a3a") : hx("#a85a1a"), ly)); }
    for (i = 0; i < ph.fly; i++) { var fx = (i * 83 + Math.sin(t * .5 + i * 2) * 14 + 20) % W, fy = 70 + ((i * 41) % 120) + Math.cos(t * .7 + i) * 8, bl = Math.sin(t * 1.8 + i * 3.1) > -.2, cc = hx("#eaff8a"); if (bl) { D.set(fx, fy, cc); if (ph.night) { var dm = mix(cc, BLACK, .6); D.set(fx - 1, fy, dm); D.set(fx + 1, fy, dm); D.set(fx, fy - 1, dm); D.set(fx, fy + 1, dm); } } }
  }
  function eggsDyn(D, S, ph, t, fr, lv) {
    var gp = function (c, yy) { return gradePx(c, ph, yy); };
    EGGS.forEach(function (e) { if (has(lv, e.lv) && e.dyn) e.dyn(D, S.A, ph, t, fr, gp); });
  }
  var RT = { scenes: {}, bases: {}, merged: {} };
  function rtScene(seed) { seed = seed || 11; if (!RT.scenes[seed]) RT.scenes[seed] = sceneKaskade(seed); return RT.scenes[seed]; }
  function rtBase(seed, pk) { var k = seed + pk; if (!RT.bases[k]) RT.bases[k] = grade(rtScene(seed).P, PH[pk]); return RT.bases[k]; }
  function rtMerged(seed, pk, lv) {
    var k = seed + pk + "L" + lv;
    if (!RT.merged[k]) {
      var S = rtScene(seed), ph = PH[pk], E = new Buf(), M = new Buf(), idx;
      EGGS.forEach(function (e) { if (has(lv, e.lv) && e.stat) e.stat(E, S.A, ph); });
      M.d.set(rtBase(seed, pk).d);
      for (idx = 0; idx < W * H; idx++) if (E.d[idx]) M.d[idx] = gradePx(E.d[idx], ph, (idx / W) | 0);
      RT.merged[k] = M;
    }
    return RT.merged[k];
  }
  function rtFrame(FB, seed, pk, lv, t, fr) { var S = rtScene(seed), ph = PH[pk]; FB.d.set(rtMerged(seed, pk, lv).d); sceneDyn(FB, S, ph, t, fr); eggsDyn(FB, S, ph, t, fr, lv); }

  /* ===== 6 Oberflaeche: Banner in der Brain-Karte, Streifen ueber den Bereichen, Easter-Egg-Liste, Hinweis ===== */
  var PHASE_NAME = { morgen: "MORGEN", tag: "TAG", abend: "ABEND", nacht: "NACHT" };
  function phaseNow(d) { var h = (d || new Date()).getHours(); return h < 5 ? "nacht" : h < 10 ? "morgen" : h < 17 ? "tag" : h < 20 ? "abend" : "nacht"; }
  /* Streifen: [ID des Bereichs, Mittelzeile des gezeigten Bildausschnitts] - so ist das ganze Bild ueber die Seite verteilt */
  var STRIPS = [["todo", 12], ["habits", 46], ["zeit", 192], ["notizen", 211]];
  var BANNER_FOCUS = 128, MIN_CSS = 2.4, SEEN_KEY = "dashboard-scn-seen";

  window.createScenery = function (opts) {
    opts = opts || {};
    var seed = 11, level = 0, phaseSel = "auto", phase = phaseNow(), S = null, built = false, modalOpen = false, selected = -1, fresh = null;
    var reduce = false; try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { /* egal */ }
    var master = document.createElement("canvas"); master.width = W; master.height = H;
    var mctx = master.getContext("2d"), img = mctx.createImageData(W, H), img32 = new Uint32Array(img.data.buffer), FB = new Buf();
    var targets = [], t0 = performance.now(), lastTt = 3.1, cloudReady = document.body.dataset.cloud === "ready" || document.body.dataset.cloud === undefined, pendingLevel = null, started = false;
    var $ = function (id) { return document.getElementById(id); };
    var lsGet = function (k) { try { return localStorage.getItem(k); } catch (e) { return null; } };
    var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };
    var unlocked = function () { return EGGS.filter(function (e) { return has(level, e.lv); }); };

    /* ---------- Darstellung: ganze Geraetepixel pro Bildpunkt, damit alle Pixel gleich gross sind ---------- */
    function fit(tg) {
      var box = tg.cv.parentNode.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
      var wd = Math.max(1, Math.round(box.width * dpr)), hd = Math.max(1, Math.round(box.height * dpr));
      if (tg.cv.width !== wd || tg.cv.height !== hd) { tg.cv.width = wd; tg.cv.height = hd; }
      /* auch hohe Flaechen (Bild als Kartenhintergrund) sollen komplett gefuellt sein: das Bild ist nur H Zeilen hoch */
      tg.k = Math.max(Math.ceil(wd / W), Math.ceil(hd / H), Math.round(MIN_CSS * dpr), 1);
      tg.cols = Math.ceil(wd / tg.k); tg.rows = Math.ceil(hd / tg.k);
      tg.ox = -Math.round((tg.cols * tg.k - wd) / 2); tg.oy = -Math.round((tg.rows * tg.k - hd) / 2);
    }
    function blit(tg, tt) {
      var range = Math.max(0, W - tg.cols), c = tg.ctx;
      /* schmale Anzeige (Handy): ganz langsamer Kameraschwenk ueber das Bild */
      tg.sx = Math.round(range / 2 + (range > 6 && !reduce ? Math.sin(tt * .045 + tg.seedPhase) * range / 2 : 0));
      tg.sy = Math.max(0, Math.min(Math.max(0, H - tg.rows), Math.round(tg.focus - tg.rows / 2)));
      c.imageSmoothingEnabled = false;
      c.drawImage(master, tg.sx, tg.sy, Math.min(tg.cols, W), Math.min(tg.rows, H), tg.ox, tg.oy, Math.min(tg.cols, W) * tg.k, Math.min(tg.rows, H) * tg.k);
      drawMarks(c, tg.k, function (b) { return [(b[0] - tg.sx) * tg.k + tg.ox, (b[1] - tg.sy) * tg.k + tg.oy]; }, tg.cv.width, tg.cv.height, tt);
    }
    /* Markierungen: leuchtende Ecken um neu gefundene Eier (und um das in der Liste gewaehlte) */
    function drawMarks(c, k, toDev, cw, ch, tt) {
      var list = [], now = Date.now();
      if (fresh && now < fresh.until) fresh.ids.forEach(function (i) { list.push(i); });
      if (modalOpen && selected >= 0) list.push(selected);
      if (!list.length || !S) return;
      var on = Math.floor(tt * 3) % 2 === 0;
      list.forEach(function (i) {
        var b = EGGS[i].box(S.A), p = toDev(b), x = Math.round(p[0]), y = Math.round(p[1]), w = b[2] * k, h = b[3] * k, a = Math.max(3 * k, 6), t = Math.max(2, k);
        if (x > cw || y > ch || x + w < 0 || y + h < 0) return;
        c.fillStyle = on ? "#ffffff" : "#f4c542";
        c.fillRect(x, y, a, t); c.fillRect(x, y, t, a); c.fillRect(x + w - a, y, a, t); c.fillRect(x + w - t, y, t, a);
        c.fillRect(x, y + h - t, a, t); c.fillRect(x, y + h - a, t, a); c.fillRect(x + w - a, y + h - t, a, t); c.fillRect(x + w - t, y + h - a, t, a);
      });
    }
    function render(tt) {
      if (!S) return;
      lastTt = tt;
      rtFrame(FB, seed, phase, level, tt, Math.floor(tt * 6.25));
      img32.set(FB.d); mctx.putImageData(img, 0, 0);
      targets.forEach(function (tg) { if (tg.vis) blit(tg, tt); });
      if (modalOpen) blitModal(tt);
    }
    function redraw() { render(reduce ? 3.1 : (performance.now() - t0) / 1000); }
    function tick() {
      if (document.hidden || !S || reduce) return;
      if (!modalOpen && !targets.some(function (tg) { return tg.vis; })) return;
      render((performance.now() - t0) / 1000);
    }

    /* ---------- Banner und Streifen ---------- */
    function addTarget(cv, focus, extra) {
      var tg = { cv: cv, ctx: cv.getContext("2d"), focus: focus, vis: true, seedPhase: Math.random() * 6, k: 3, cols: W, rows: 60, sx: 0, sy: 0, ox: 0, oy: 0 };
      if (extra) for (var key in extra) tg[key] = extra[key];
      targets.push(tg);
      if (window.IntersectionObserver) { tg.vis = false; new IntersectionObserver(function (es) { tg.vis = es[es.length - 1].isIntersecting; if (tg.vis && S) { fit(tg); if (reduce) redraw(); } }, { rootMargin: "80px" }).observe(cv.parentNode); }
      fit(tg); return tg;
    }
    function fitAll() { targets.forEach(fit); if (modalOpen) layoutModal(); if (S) redraw(); }
    function chips() {
      var n = unlocked().length, c1 = $("scnEggChip"), c2 = $("scnPhaseChip");
      if (c1) { c1.textContent = "EASTER EGGS " + n + "/" + EGGS.length; c1.classList.toggle("scn-new", !!(fresh && Date.now() < fresh.until)); }
      if (c2) c2.textContent = PHASE_NAME[phase];
    }
    function setupBanner() {
      var b = $("scnBanner"); if (!b) return;
      var cv = b.querySelector("canvas"); addTarget(cv, BANNER_FOCUS, { banner: true });
      b.addEventListener("click", function () { openList(); });
      b.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openList(); } });
    }
    function setupStrips() {
      STRIPS.forEach(function (s) {
        var sec = $(s[0]); if (!sec || sec.querySelector(":scope > .scn-strip")) return;
        var d = document.createElement("div"); d.className = "scn-strip"; d.setAttribute("aria-hidden", "true");
        var cv = document.createElement("canvas"); d.appendChild(cv); sec.insertBefore(d, sec.firstChild);
        d.addEventListener("click", function () { openList(); });
        addTarget(cv, s[1], { strip: true });
      });
    }

    /* ---------- Liste und grosses Bild ---------- */
    var mtg = null;
    function layoutModal() {
      var cv = $("eggCanvas"), wrap = cv && cv.parentNode; if (!cv) return;
      var dpr = window.devicePixelRatio || 1, avail = wrap.clientWidth || 600, K = avail < 600 ? Math.max(1, Math.ceil(avail * dpr / W)) : Math.max(1, Math.floor(avail * dpr / W));
      cv.width = W * K; cv.height = H * K; cv.style.width = avail < 600 ? "100%" : (W * K / dpr) + "px";
      mtg = { cv: cv, ctx: cv.getContext("2d"), k: K };
    }
    function blitModal(tt) {
      if (!mtg) layoutModal(); if (!mtg) return;
      var c = mtg.ctx; c.imageSmoothingEnabled = false; c.drawImage(master, 0, 0, W, H, 0, 0, W * mtg.k, H * mtg.k);
      drawMarks(c, mtg.k, function (b) { return [b[0] * mtg.k, b[1] * mtg.k]; }, W * mtg.k, H * mtg.k, tt);
    }
    function buildList() {
      var ol = $("eggList"); if (!ol) return;
      var html = "";
      EGGS.forEach(function (e, i) {
        var on = has(level, e.lv), isNew = fresh && Date.now() < fresh.until && fresh.ids.indexOf(i) >= 0;
        html += '<li class="' + (on ? "on" : "off") + (i === selected ? " sel" : "") + '" data-i="' + i + '"><span class="lv">LVL ' + e.lv + '</span><span class="nm">' + (on ? e.name : "???") + (isNew ? ' <b class="nw">NEU</b>' : "") + '</span><span class="ht">' + (on ? e.hint : "Wird bei Level " + e.lv + " freigeschaltet") + "</span></li>";
      });
      ol.innerHTML = html;
      var sub = $("eggSub"), n = unlocked().length, next = EGGS.filter(function (e) { return e.lv > level; })[0];
      if (sub) sub.textContent = n + " von " + EGGS.length + " Easter Eggs entdeckt" + (next ? " · das nächste wartet bei Level " + next.lv : " · du hast alle gefunden!");
    }
    function select(i) {
      selected = i; buildList(); redraw();
      var cv = $("eggCanvas"); if (cv && cv.scrollIntoView && window.innerWidth < 760) cv.scrollIntoView({ block: "nearest", behavior: "smooth" });
      clearTimeout(select.t); select.t = setTimeout(function () { selected = -1; buildList(); redraw(); }, 5000);
    }
    function openList() {
      var ov = $("eggOverlay"); if (!ov || !S) return;
      modalOpen = true; ov.classList.add("open"); document.body.classList.add("scn-lock"); layoutModal(); buildList(); redraw();
      var x = $("eggClose"); if (x) x.focus({ preventScroll: true });
    }
    function closeList() { var ov = $("eggOverlay"); if (!ov) return; modalOpen = false; selected = -1; ov.classList.remove("open"); document.body.classList.remove("scn-lock"); var b = $("scnBanner"); if (b && b.focus) try { b.focus({ preventScroll: true }); } catch (e) { /* egal */ } }
    function setupModal() {
      var ov = $("eggOverlay"); if (!ov) return;
      ov.addEventListener("click", function (e) { if (e.target === ov) closeList(); });
      var x = $("eggClose"); if (x) x.addEventListener("click", closeList);
      document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modalOpen) closeList(); });
      var ol = $("eggList");
      if (ol) ol.addEventListener("click", function (e) { var li = e.target.closest("li"); if (!li || !li.classList.contains("on")) return; select(+li.dataset.i); });
      var cv = $("eggCanvas");
      if (cv) cv.addEventListener("click", function (e) {
        var r = cv.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W, py = (e.clientY - r.top) / r.height * H, hit = -1, best = 1e9;
        EGGS.forEach(function (g, i) { if (!has(level, g.lv)) return; var b = g.box(S.A); if (px >= b[0] && px <= b[0] + b[2] && py >= b[1] && py <= b[1] + b[3] && b[2] * b[3] < best) { best = b[2] * b[3]; hit = i; } });
        if (hit >= 0) { select(hit); var li = ol && ol.querySelector('[data-i="' + hit + '"]'); if (li && li.scrollIntoView) li.scrollIntoView({ block: "nearest" }); }
      });
    }

    /* ---------- Hinweis bei neuen Easter Eggs ---------- */
    var toastEl = null;
    function toast(eggs) {
      if (toastEl) toastEl.remove();
      var b = document.createElement("button"); b.type = "button"; b.className = "scn-toast"; toastEl = b;
      var names = eggs.map(function (i) { return EGGS[i].name; });
      b.innerHTML = '<span class="k">' + (eggs.length > 1 ? eggs.length + " NEUE EASTER EGGS" : "NEUES EASTER EGG") + '</span><span class="v">' + (eggs.length > 1 ? names.slice(0, 2).join(", ") + (names.length > 2 ? " …" : "") : names[0]) + '</span><span class="h">ANSEHEN ▸</span>';
      b.addEventListener("click", function () { b.remove(); toastEl = null; openList(); if (eggs.length) select(eggs[0]); });
      document.body.appendChild(b);
      setTimeout(function () { if (toastEl === b) { b.classList.add("out"); setTimeout(function () { b.remove(); if (toastEl === b) toastEl = null; }, 400); } }, 9000);
    }

    /* ---------- Level und Tageszeit ---------- */
    function applyLevel(n) {
      n = Math.max(0, n | 0);
      var seenRaw = lsGet(SEEN_KEY), seen = seenRaw === null ? null : +seenRaw, before = level;
      level = n;
      if (seen !== null && n > seen) {
        var ids = []; EGGS.forEach(function (e, i) { if (e.lv > seen && e.lv <= n) ids.push(i); });
        if (ids.length && built) { fresh = { ids: ids, until: Date.now() + 14000 }; toast(ids); setTimeout(function () { chips(); buildList(); }, 14200); }
      }
      if (seen === null || n !== seen) lsSet(SEEN_KEY, String(n));
      chips(); if (modalOpen) buildList(); if (S) redraw();
      return before;
    }
    function setLevel(n) { if (!cloudReady) { pendingLevel = n; return; } applyLevel(n); }
    /* Der Level aus der Cloud gilt erst, wenn die Cloud geladen ist; der Hinweis wird gleich bei der Erstellung angemeldet (nicht erst beim Start der Seite), damit er nie verpasst wird */
    document.addEventListener("cloud-ready", function () { cloudReady = true; if (pendingLevel !== null) { var n = pendingLevel; pendingLevel = null; applyLevel(n); } });
    function setPhase(p) { phaseSel = p || "auto"; var np = phaseSel === "auto" ? phaseNow() : phaseSel; if (np !== phase) { phase = np; chips(); if (S) redraw(); } }

    /* ---------- Start ---------- */
    function build() {
      if (built) return;
      try { S = rtScene(seed); } catch (err) { console.warn("Pixel-Dschungel konnte nicht gebaut werden:", err); return; }
      built = true; fitAll(); chips();
      var b = $("scnBanner"); if (b) b.classList.add("ready");
      targets.forEach(function (tg) { if (tg.strip) tg.cv.parentNode.classList.add("ready"); });
      try { document.dispatchEvent(new CustomEvent("scenery-ready")); } catch (e) { /* egal */ }
    }
    function start() {
      if (started) return; started = true;
      setupBanner(); setupStrips(); setupModal(); chips();
      window.addEventListener("resize", function () { clearTimeout(start.rt); start.rt = setTimeout(fitAll, 120); });
      if (window.ResizeObserver) { var ro = new ResizeObserver(function () { clearTimeout(start.rt); start.rt = setTimeout(fitAll, 80); }); targets.forEach(function (tg) { ro.observe(tg.cv.parentNode); }); }
      setInterval(tick, 160);
      setInterval(function () { if (phaseSel === "auto") setPhase("auto"); }, 60000);
      /* Das Bild entsteht erst nach dem ersten Anzeigen der Seite, damit der Start nicht ausgebremst wird */
      (window.requestAnimationFrame || setTimeout)(function () { setTimeout(build, 30); });
    }
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();

    var api = { setLevel: setLevel, setPhase: setPhase, open: openList, close: closeList, level: function () { return level; }, phase: function () { return phase; }, eggs: function () { return EGGS; }, ready: function () { return built; } };
    window.Scenery = api;
    return api;
  };
})();
