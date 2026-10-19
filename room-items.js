/* Katalog fuer das Raum-Minigame (room.js): Teile mit Preis in Stunden, Boeden, Wandfarben und die Raum-Erweiterungen. Jedes Teil ist eine Liste aus
   Quadern und Zylindern (siehe room-iso.js; Einheiten: 1 Feld = 8 u, Hoehen in Pixeln), die der Renderer zu einem Pixelbild macht. Die Vorderseite eines Teils
   zeigt nach +Y (links unten); beim Drehen wird gespiegelt. Alle Koordinaten sind ganze Zahlen (sonst wuerden Kanten zwischen zwei Pixeln liegen). */
(function () {
  "use strict";
  const I = window.RoomIso;
  const { B, C, P, shade, hash } = I;

  /* ---------- Muster-Helfer ---------- */
  const pick = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
  const SPINES = ["#c0443c", "#3f6fb5", "#d9a23a", "#4a9a6a", "#8a5ab0", "#e0e0e8", "#d9703a", "#2f3a52"];
  // Buecher im Regal: Reihen von je 14 Pixeln, unten ein Brett, dazwischen Buchruecken verschiedener Breite und Hoehe
  const shelfTex = (seed, rowH) => (pu, pv) => {
    const row = Math.floor(pv / rowH), v = pv - row * rowH;
    if (v < 2) return "#7a4e28";
    let x = 0, i = 0, w = 2;
    for (; i < 40; i++) { w = 2 + Math.floor(hash(seed, row, i) * 2); if (pu < x + w) break; x += w; }
    const gap = hash(seed + 5, row, i) < 0.12;
    const h = 7 + Math.floor(hash(seed + 7, row, i) * (rowH - 9));
    if (gap || v - 2 >= h) return "#5a3a20";
    return pick(SPINES, hash(seed + 3, row, i));
  };
  const stripeTex = (a, b, n) => (pu) => (Math.floor(pu / n) % 2 ? a : b);

  /* ---------- Boeden (Farbe zu Welt-Koordinaten X,Y in Einheiten) ---------- */
  const planks = (cols, seam) => (X, Y) => {
    const row = Math.floor(Y / 4), sh = Math.floor((X + hash(row, 1) * 24) / 24);
    const c = pick(cols, hash(row, sh, 2));
    return (Y - row * 4 < 0.6 || (X + hash(row, 1) * 24) % 24 < 0.6) ? shade(c, seam || -0.22) : c;
  };
  const FLOORS = [
    { id: "holz", name: "Holzdielen", price: 0, sw: "#c49a62", fn: planks(["#c9a06a", "#c49a62", "#bd9159", "#cca673"]) },
    { id: "dunkel", name: "Dunkles Holz", price: 60, sw: "#6e4a32", fn: planks(["#6e4a32", "#654329", "#7a5238", "#5f3f28"], -0.3) },
    { id: "schach", name: "Schachbrett", price: 90, sw: "#e8e0d0", fn: (X, Y) => ((Math.floor(X / 8) + Math.floor(Y / 8)) % 2 ? "#4a4658" : "#e8e0d0") },
    { id: "fliese", name: "Fliesen", price: 110, sw: "#cfd8dc", fn: (X, Y) => ((X % 8 < 0.7 || Y % 8 < 0.7) ? "#a9b4ba" : ((Math.floor(X / 8) + Math.floor(Y / 8)) % 2 ? "#d6dee2" : "#cfd8dc")) },
    { id: "teppich", name: "Teppichboden", price: 140, sw: "#6f6a86", fn: (X, Y) => (hash(Math.floor(X * 2), Math.floor(Y * 2), 9) < 0.18 ? "#7a7592" : "#6f6a86") },
    { id: "fisch", name: "Fischgrät", price: 220, sw: "#b98a52", fn: (X, Y) => { const a = Math.floor(X / 8), b = Math.floor(Y / 4); const horiz = (a + Math.floor(b / 2)) % 2 === 0; const lx = X % 8, ly = Y % 4; const seam = horiz ? (lx < 0.6 || ly < 0.6) : (ly < 0.6 || lx < 0.6); const c = pick(["#c49a62", "#b98a52", "#cca673", "#b58750"], hash(a, b, 3)); return seam ? shade(c, -0.24) : c; } },
    { id: "marmor", name: "Marmor", price: 360, sw: "#e6e2ea", fn: (X, Y) => { const v = Math.sin(X * 0.55 + Math.sin(Y * 0.7) * 1.8) + Math.sin(Y * 0.43 - X * 0.2); const edge = (X % 16 < 0.6 || Y % 16 < 0.6); return edge ? "#b9b4c4" : (v > 1.25 ? "#c9c3d6" : "#e6e2ea"); } }
  ];

  /* ---------- Waende: Farbe zu (pu = Pixel entlang der Wand, pv = Pixel ueber dem Boden) ---------- */
  const baseboard = (base, trim) => (pu, pv, fu, fv, side) => {
    if (pv < 5) return shade(trim, -0.05);
    if (pv === 5) return shade(trim, 0.3);
    if (pv >= 85) return shade(trim, 0.2);
    return base;
  };
  const WALLS = [
    { id: "creme", name: "Creme", price: 0, color: "#e9dcc2", fn: baseboard("#e9dcc2", "#f4ecd8") },
    { id: "mint", name: "Mintgrün", price: 40, color: "#a8d8c0", fn: baseboard("#a8d8c0", "#e4f2ea") },
    { id: "gelb", name: "Sonnengelb", price: 40, color: "#f0cf72", fn: baseboard("#f0cf72", "#f8eab8") },
    { id: "rose", name: "Altrosa", price: 55, color: "#d99aa4", fn: baseboard("#d99aa4", "#f0d4d8") },
    { id: "blau", name: "Dunkelblau", price: 70, color: "#3d5a8a", fn: baseboard("#3d5a8a", "#6c88b4") },
    { id: "pflaume", name: "Pflaume", price: 70, color: "#6a4a7e", fn: baseboard("#6a4a7e", "#9a7ab0") },
    { id: "graphit", name: "Graphit", price: 90, color: "#4a4e5a", fn: baseboard("#4a4e5a", "#7a7e8c") },
    { id: "ziegel", name: "Backstein", price: 150, color: "#b5593c", fn: (pu, pv) => {
      if (pv < 5) return "#7a4a30"; if (pv === 5) return "#d6a07c"; if (pv >= 85) return "#c9794e";
      const row = Math.floor((pv - 6) / 5), off = (row % 2) * 6, x = (pu + off) % 12, y = (pv - 6) % 5;
      if (y === 4 || x === 11) return "#d9b9a0";
      return pick(["#b5593c", "#a94d33", "#bf6444", "#b0553a"], hash(Math.floor((pu + off) / 12), row, 4));
    } },
    { id: "holzwand", name: "Holzpaneele", price: 190, color: "#9a6a3e", fn: (pu, pv) => {
      if (pv < 5) return "#6e4526"; if (pv === 5) return "#c9955e"; if (pv >= 85) return "#b07d4a";
      return (pu % 8 === 7) ? "#7a4f2a" : pick(["#9a6a3e", "#a3723f", "#946238"], hash(Math.floor(pu / 8), 6, 1));
    } }
  ];

  /* ---------- Teile ---------- */
  const W = { l: "#c9a06a", m: "#a8723d", d: "#7a4e28", dd: "#5a3a20" };
  const METAL = "#9aa3b2", DARK = "#2e2e3a";
  const FAB = { rot: "#c0505a", blau: "#4a72b8", gruen: "#4f9a6a", grau: "#8a8f9c", lila: "#7e5cae", senf: "#d9a23a" };
  const FAB_NAME = { rot: "Rot", blau: "Blau", gruen: "Grün", grau: "Grau", lila: "Lila", senf: "Senfgelb" };

  const ITEMS = [];
  const add = (it) => { ITEMS.push(it); return it; };

  /* ----- Wohnen ----- */
  Object.keys(FAB).slice(0, 4).forEach((k, n) => add({
    id: "sofa_" + k, name: "Sofa " + FAB_NAME[k], cat: "wohnen", w: 3, d: 1, price: 90 + n * 5,
    model: () => { const c = FAB[k]; return [
      B(0, 0, 0, 24, 8, 4, shade(c, -0.32)),
      B(0, 0, 4, 24, 3, 17, c),
      B(0, 0, 4, 3, 8, 10, shade(c, -0.08)),
      B(3, 3, 4, 8, 5, 5, shade(c, 0.2)), B(13, 3, 4, 8, 5, 5, shade(c, 0.2)),
      B(3, 3, 9, 8, 2, 8, shade(c, 0.1)), B(13, 3, 9, 8, 2, 8, shade(c, 0.1)),
      B(21, 0, 4, 3, 8, 10, shade(c, -0.08))
    ]; }
  }));
  Object.keys(FAB).slice(0, 4).forEach((k, n) => add({
    id: "sessel_" + k, name: "Sessel " + FAB_NAME[k], cat: "wohnen", w: 1, d: 1, price: 45 + n * 3,
    model: () => { const c = FAB[k]; return [
      B(0, 0, 0, 8, 8, 3, shade(c, -0.32)),
      B(0, 0, 3, 8, 3, 15, c),
      B(0, 0, 3, 2, 8, 8, shade(c, -0.08)),
      B(2, 3, 3, 4, 5, 5, shade(c, 0.2)), B(2, 3, 8, 4, 2, 7, shade(c, 0.1)),
      B(6, 0, 3, 2, 8, 8, shade(c, -0.08))
    ]; }
  }));
  add({ id: "couchtisch", name: "Couchtisch", cat: "wohnen", w: 2, d: 1, price: 38,
    model: () => [B(1, 1, 0, 2, 2, 7, W.d), B(13, 1, 0, 2, 2, 7, W.d), B(1, 5, 0, 2, 2, 7, W.d), B(13, 5, 0, 2, 2, 7, W.d), B(0, 0, 7, 16, 8, 2, W.l)] });
  add({ id: "regal", name: "Bücherregal", cat: "wohnen", w: 1, d: 1, price: 70,
    model: () => [B(0, 0, 0, 8, 8, 44, W.m, { tl: shelfTex(3, 14), tr: shelfTex(5, 14), ct: W.l })] });
  add({ id: "stehlampe", name: "Stehlampe", cat: "wohnen", w: 1, d: 1, price: 30,
    model: () => [C(4, 4, 0, 2, 2, "#3a3a46"), B(3, 3, 2, 2, 2, 32, "#6a6a7a"), C(4, 4, 34, 3, 9, "#f2d98c", { ct: "#fff3bf" })] });
  const plant = (id, name, price, leaf) => add({ id, name, cat: "deko", w: 1, d: 1, price,
    model: () => [C(4, 4, 0, 3, 7, "#c4673a", { ct: "#5a3a28" }), C(4, 4, 7, 2, 10, leaf[0]), C(2, 5, 9, 2, 9, leaf[1]), C(6, 3, 11, 2, 8, leaf[2]), C(4, 3, 15, 2, 7, leaf[0])] });
  plant("pflanze", "Zimmerpflanze", 22, ["#3f9a56", "#4caf63", "#2f7d4a"]);
  plant("farn", "Farn", 26, ["#4f8a3a", "#62a047", "#3d7030"]);
  Object.keys(FAB).slice(0, 3).forEach((k) => add({
    id: "teppich_" + k, name: "Teppich " + FAB_NAME[k], cat: "wohnen", w: 2, d: 2, price: 28, flat: true,
    model: () => { const c = FAB[k]; return [B(0, 0, 0, 16, 16, 1, c, { tt: (pu, pv, fu, fv) => ((fu < 2 || fv < 2 || fu >= 14 || fv >= 14) ? shade(c, -0.18) : ((fu < 3 || fv < 3 || fu >= 13 || fv >= 13) ? shade(c, 0.22) : undefined)), outlineColor: shade(c, -0.4) })]; }
  }));

  /* ----- Schlafen ----- */
  add({ id: "bett_blau", name: "Bett Blau", cat: "schlafen", w: 2, d: 3, price: 160,
    model: () => [
      B(0, 0, 0, 16, 24, 5, W.m), B(0, 0, 5, 16, 2, 14, W.d),
      B(1, 2, 5, 14, 21, 4, "#ece8f4"),
      B(2, 3, 9, 5, 5, 2, "#ffffff"), B(9, 3, 9, 5, 5, 2, "#ffffff"),
      B(1, 11, 9, 14, 12, 1, "#4a72b8", { tt: (pu, pv, fu, fv) => (fv % 4 < 1 ? "#5a82c8" : undefined) })
    ] });

  /* ----- Arbeiten ----- */
  const screen = (n) => (pu, pv) => {
    if (pu < 1 || pu > 22 || pv < 1 || pv > 7) return "#16161e";
    const row = Math.floor(pv / 2);
    if (n === 0) return (row % 2 === 0 && pu < 4 + Math.floor(hash(row, 1) * 14)) ? "#6fd3ff" : "#1d2b3a";
    return pick(["#e66767", "#6fd3ff", "#f4c542", "#1d2b3a"], hash(Math.floor(pu / 4), row, 8));
  };
  add({ id: "schreibtisch_pc", name: "Schreibtisch mit PC", cat: "arbeiten", w: 3, d: 1, price: 220,
    model: () => [
      B(0, 0, 0, 2, 8, 14, W.m), B(22, 0, 0, 2, 8, 14, W.m), B(2, 6, 2, 20, 2, 12, W.d),
      B(0, 0, 14, 24, 8, 2, W.l),
      B(19, 1, 16, 3, 6, 9, DARK, { tl: (pu, pv) => (pu === 2 && pv === 6 ? "#6fe38a" : undefined) }),
      B(10, 3, 16, 4, 3, 2, "#3a3a46"), B(11, 4, 18, 2, 1, 3, "#3a3a46"),
      B(5, 3, 21, 14, 2, 9, "#23232d", { tl: screen(0) }),
      B(7, 5, 16, 9, 2, 1, "#d7d7e2")
    ] });
  add({ id: "buerostuhl", name: "Bürostuhl", cat: "arbeiten", w: 1, d: 1, price: 55,
    model: () => [C(4, 4, 0, 3, 2, "#2a2a33"), B(3, 3, 2, 2, 2, 7, "#6a6a7a"), B(1, 1, 9, 6, 6, 3, "#5a7ab8"), B(1, 1, 12, 6, 2, 12, "#4a6aa8")] });
  /* ===== Teil 2: restlicher Katalog ===== */
  // ---- Textur-Helfer ----
  const brickTex = (a, mortar, row, len) => (pu, pv) => {
    row = row || 5; len = len || 12;
    const r = Math.floor(pv / row), off = (r % 2) * (len / 2), x = (pu + off) % len, y = pv % row;
    if (y === row - 1 || x === len - 1) return mortar;
    return pick(a, hash(Math.floor((pu + off) / len), r, 4));
  };
  const circ = (cx, cy, r) => (pu, pv) => { const dx = pu - cx, dy = pv - cy; return dx * dx + dy * dy; };
  const clockTex = (cx, cy, r, face, rim, hand) => (pu, pv) => {
    const d2 = circ(cx, cy, r)(pu, pv);
    if (d2 > r * r) return undefined;
    if (d2 > (r - 1) * (r - 1)) return rim;
    const dx = pu - cx, dy = pv - cy;
    if ((dx === 0 && dy >= 0 && dy <= r - 2) || (dy === 0 && dx >= 0 && dx <= r - 3)) return hand;
    return face;
  };
  const drawers = (n, h, base, line, knob) => (pu, pv) => {
    const k = Math.floor(pv / h), v = pv - k * h;
    if (k >= n) return undefined;
    if (v === 0 || v === h - 1) return line;
    if (pu === 0 || pu === 31) return line;
    if (v === Math.floor(h / 2) && pu >= 14 && pu <= 17) return knob;
    return undefined;
  };
  const doors = (split, line, knob) => (pu, pv, fu) => {
    if (pu === split) return line;
    if ((pu === split - 3 || pu === split + 2) && pv >= 22 && pv <= 30) return knob;
    return undefined;
  };

  // ---- Wohnen ----
  const tvTex = (f) => (pu, pv) => {
    if (pu < 1 || pu > 30 || pv < 1 || pv > 9) return "#14141c";
    const c = Math.floor(pu / 4), r = Math.floor(pv / 3);
    return pick(f === 0 ? ["#2f6fb5", "#5ab0e8", "#1d2b3a", "#8ad0f0"] : f === 1 ? ["#e0884a", "#f4c542", "#b5433c", "#2a1d2b"] : ["#3fa860", "#1d3a2b", "#8ad89a", "#14221b"], hash(c, r, f + 11));
  };
  add({ id: "tv", name: "TV-Board mit Fernseher", cat: "wohnen", w: 3, d: 1, price: 180, frames: 3, fps: 1.4,
    model: (f) => [
      B(0, 0, 0, 24, 8, 9, W.m, { tl: drawers(1, 9, W.m, W.dd, "#d9a23a") }), B(0, 0, 9, 24, 8, 1, W.l),
      B(10, 3, 10, 4, 3, 1, "#2a2a33"),
      B(4, 3, 11, 16, 2, 12, "#1b1b24", { tl: tvTex(f || 0) })
    ] });
  const flame = (f) => [B(5, 8, 1, 2, 1, 4 + (f % 3), "#e8681c"), B(8, 8, 1, 3, 1, 7 - (f % 2) * 2, "#f4c542"), B(11, 8, 1, 2, 1, 5 - (f % 3), "#e8681c")];
  add({ id: "kamin", name: "Kamin", cat: "wohnen", w: 2, d: 1, price: 420, frames: 3, fps: 4,
    model: (f) => [
      B(0, 0, 0, 16, 8, 30, "#a94d33", { tl: brickTex(["#b5593c", "#a94d33", "#bf6444"], "#d9b9a0"), tr: brickTex(["#b5593c", "#a94d33", "#bf6444"], "#d9b9a0"), ct: "#8a3a28" }),
      B(3, 8, 0, 10, 1, 14, "#1c1218"),
      B(4, 8, 0, 8, 1, 2, "#5a3a20")
    ].concat(flame(f || 0), [B(-1, -1, 30, 18, 10, 3, W.m)]) });
  add({ id: "standuhr", name: "Standuhr", cat: "wohnen", w: 1, d: 1, price: 190,
    model: () => [
      B(0, 0, 0, 8, 8, 3, W.d), B(1, 1, 3, 6, 6, 47, W.m, { tl: (pu, pv) => (pv >= 8 && pv <= 26 ? ((pu >= 3 && pu <= 8) ? "#3a2a20" : undefined) : undefined) || clockTex(6, 38, 5, "#f4ecd8", "#d9a23a", "#2a2a33")(pu, pv), tr: (pu, pv) => (pv >= 8 && pv <= 26 && pu >= 3 && pu <= 8 ? "#3a2a20" : clockTex(6, 38, 5, "#f4ecd8", "#d9a23a", "#2a2a33")(pu, pv)) }),
      B(0, 0, 50, 8, 8, 3, W.d)
    ] });
  add({ id: "beistelltisch", name: "Beistelltisch", cat: "wohnen", w: 1, d: 1, price: 36,
    model: () => [C(4, 4, 0, 3, 1, W.d), B(3, 3, 1, 2, 2, 9, W.d), C(4, 4, 10, 3, 1, W.l)] });
  [["rot", "#c0505a"], ["blau", "#4a72b8"]].forEach(([k, c]) => add({ id: "pouf_" + k, name: "Pouf " + FAB_NAME[k], cat: "wohnen", w: 1, d: 1, price: 30,
    model: () => [C(4, 4, 0, 3, 7, c)] }));

  // ---- Schlafen ----
  [["rot", "#c0505a"], ["gruen", "#4f9a6a"]].forEach(([k, c]) => add({ id: "bett_" + k, name: "Bett " + FAB_NAME[k], cat: "schlafen", w: 2, d: 3, price: 160,
    model: () => [
      B(0, 0, 0, 16, 24, 5, W.m), B(0, 0, 5, 16, 2, 14, W.d),
      B(1, 2, 5, 14, 21, 4, "#ece8f4"),
      B(2, 3, 9, 5, 5, 2, "#ffffff"), B(9, 3, 9, 5, 5, 2, "#ffffff"),
      B(1, 11, 9, 14, 12, 1, c, { tt: (pu, pv, fu, fv) => (fv % 4 < 1 ? shade(c, 0.16) : undefined) })
    ] }));
  add({ id: "nachttisch", name: "Nachttisch", cat: "schlafen", w: 1, d: 1, price: 50,
    model: () => [B(1, 1, 0, 6, 6, 12, W.m, { tl: drawers(1, 12, W.m, W.dd, "#d9a23a") }), B(0, 0, 12, 8, 8, 1, W.l), C(4, 4, 13, 1, 3, "#e8e8f0"), C(4, 4, 16, 2, 4, "#f2d98c", { ct: "#fff3bf" })] });
  add({ id: "kommode", name: "Kommode", cat: "schlafen", w: 2, d: 1, price: 110,
    model: () => [B(0, 0, 0, 16, 8, 15, W.m, { tl: drawers(3, 5, W.m, W.dd, "#d9a23a") }), B(0, 0, 15, 16, 8, 1, W.l)] });
  add({ id: "schrank", name: "Kleiderschrank", cat: "schlafen", w: 2, d: 1, price: 210,
    model: () => [B(0, 0, 0, 16, 8, 52, W.m, { tl: doors(16, W.dd, "#d9a23a") }), B(0, 0, 52, 16, 8, 2, W.d)] });

  // ---- Arbeiten ----
  add({ id: "schreibtisch", name: "Schreibtisch", cat: "arbeiten", w: 2, d: 1, price: 95,
    model: () => [B(0, 0, 0, 2, 8, 12, W.m), B(14, 0, 0, 2, 8, 12, W.m), B(2, 6, 2, 12, 2, 10, W.d), B(0, 0, 12, 16, 8, 2, W.l)] });
  const legoTex = (pu, pv) => {
    const row = Math.floor(pv / 11), v = pv - row * 11;
    if (pu < 1 || pu > 30 || row > 3) return "#cfd8e4";
    if (v < 1) return "#8a97a8";
    const col = Math.floor((pu - 1) / 4), x = (pu - 1) % 4;
    const h = 2 + Math.floor(hash(col, row, 21) * 7);
    if (v - 1 >= h || x === 3) return "#e6eef8";
    return pick(["#e0422f", "#f4c542", "#2f73c9", "#3fa860", "#e8e8e8", "#e8862a"], hash(col, row, 22));
  };
  add({ id: "lego_vitrine", name: "LEGO-Vitrine", cat: "arbeiten", w: 2, d: 1, price: 320,
    model: () => [B(0, 0, 0, 16, 8, 48, "#7a8aa0", { tl: legoTex, tr: (pu, pv) => (pu < 1 || pu > 14 ? "#6a7a90" : (pv % 11 < 1 ? "#8a97a8" : "#cfd8e4")), ct: "#aab6c6" }), B(0, 0, 48, 16, 8, 2, "#e0422f")] });
  const ringTex = (pu, pv) => { const d2 = (pu - 8) * (pu - 8) + (pv - 6) * (pv - 6); if (d2 > 36) return null; if (d2 > 16) return "#ffffff"; return "#2a2a33"; };
  const lensTex = (pu, pv) => { const d2 = (pu - 4) * (pu - 4) + (pv - 2) * (pv - 2); return d2 <= 2 ? "#6fd3ff" : (d2 <= 5 ? "#14141c" : undefined); };
  add({ id: "aufnahme", name: "Aufnahme-Ecke", cat: "arbeiten", w: 1, d: 1, price: 260,
    model: () => [
      B(3, 3, 0, 2, 2, 16, "#2a2a33"),
      B(0, 3, 16, 8, 1, 12, "#2a2a33", { tl: ringTex, skipTop: true, skipR: true }),
      B(2, 4, 19, 4, 3, 5, "#3a4050", { tl: lensTex }),
      B(6, 5, 0, 1, 1, 10, METAL), B(5, 5, 10, 3, 1, 3, "#2a2a33")
    ] });
  const matTex = (pu, pv, fu, fv) => { if (fu < 1 || fv < 1 || fu >= 15 || fv >= 15) return "#2a2433"; if (Math.abs(fu - 8) < 0.6 || Math.abs(fv - 8) < 0.6) return "#5a4a7a"; return "#3f2f60"; };
  add({ id: "mtg_tisch", name: "Magic-Tisch", cat: "arbeiten", w: 2, d: 2, price: 240,
    model: () => [
      B(1, 1, 0, 2, 2, 10, "#2a2433"), B(13, 1, 0, 2, 2, 10, "#2a2433"), B(1, 13, 0, 2, 2, 10, "#2a2433"),
      B(0, 0, 10, 16, 16, 2, "#3f2f60", { tt: matTex }),
      B(3, 3, 12, 3, 4, 1, "#f4f0e8"), B(4, 4, 13, 3, 4, 1, "#3f6fb5"), B(9, 9, 12, 3, 4, 1, "#c0443c"), B(10, 10, 13, 3, 4, 1, "#14141c"),
      B(7, 5, 12, 1, 1, 1, "#f4c542"), B(5, 10, 12, 1, 1, 1, "#e66767"),
      B(13, 13, 0, 2, 2, 10, "#2a2433")
    ] });
  add({ id: "pakete", name: "Bricklink-Pakete", cat: "arbeiten", w: 1, d: 1, price: 45,
    model: () => [
      B(0, 0, 0, 8, 8, 6, "#c9a06a", { tt: (pu, pv, fu) => (Math.abs(fu - 4) < 0.6 ? "#b8864a" : undefined), tl: (pu, pv) => ((pu === 7 || pu === 8) ? "#b8864a" : undefined) }),
      B(1, 1, 6, 6, 6, 5, "#d4ad78", { tl: (pu, pv) => ((pu >= 3 && pu <= 8 && pv >= 1 && pv <= 3) ? "#f4f0e8" : undefined) })
    ] });

  // ---- Training ----
  add({ id: "flachbank", name: "Flachbank", cat: "training", w: 2, d: 1, price: 80,
    model: () => [B(1, 2, 0, 2, 4, 8, METAL), B(13, 2, 0, 2, 4, 8, METAL), B(1, 3, 0, 14, 2, 2, "#4a4f5c"), B(0, 2, 8, 16, 4, 3, "#b5433c", { tt: (pu, pv, fu) => (fu < 1 || fu > 15 ? "#7a2f2a" : undefined) })] });
  add({ id: "kurzhanteln", name: "Kurzhantel-Ablage", cat: "training", w: 2, d: 1, price: 120,
    model: () => {
      const m = [B(0, 1, 0, 1, 6, 14, "#2a2a33"), B(15, 1, 0, 1, 6, 14, "#2a2a33"), B(0, 1, 4, 16, 6, 1, "#3a3a46"), B(0, 1, 9, 16, 6, 1, "#3a3a46")];
      for (let k = 0; k < 5; k++) { m.push(B(2 + 3 * k, 3, 5, 2, 3, 3 + (k % 3), "#2a2a33", { ct: "#5a5a6a" })); m.push(B(2 + 3 * k, 3, 10, 2, 3, 2 + (k % 3), "#c0443c", { ct: "#e0655c" })); }
      return m;
    } });
  add({ id: "squatrack", name: "Squat Rack", cat: "training", w: 2, d: 2, price: 360,
    model: () => [
      B(0, 0, 0, 2, 2, 56, "#2a2a33"), B(14, 0, 0, 2, 2, 56, "#2a2a33"), B(0, 14, 0, 2, 2, 56, "#2a2a33"),
      B(0, 0, 52, 16, 2, 2, "#c0443c"), B(0, 0, 52, 2, 16, 2, "#c0443c"), B(14, 0, 52, 2, 16, 2, "#c0443c"),
      B(-2, 7, 34, 20, 2, 2, METAL), B(-2, 5, 31, 2, 6, 8, "#2a2a33"), B(16, 5, 31, 2, 6, 8, "#2a2a33"),
      B(14, 14, 0, 2, 2, 56, "#2a2a33"), B(0, 14, 52, 16, 2, 2, "#c0443c")
    ] });
  add({ id: "laufband", name: "Laufband", cat: "training", w: 1, d: 3, price: 420,
    model: () => [
      B(0, 0, 0, 8, 24, 5, "#3a3a46"), B(0, 0, 5, 8, 2, 22, "#3a3a46"), B(1, 2, 20, 6, 1, 6, "#14141c", { tl: (pu, pv) => (pu >= 2 && pu <= 9 && pv >= 1 && pv <= 4 ? "#6fd3ff" : undefined) }),
      B(1, 4, 5, 6, 19, 2, "#22222c", { tt: (pu, pv) => (pv % 6 === 0 ? "#3a3a46" : undefined) }),
      B(0, 4, 5, 1, 19, 2, METAL), B(7, 4, 5, 1, 19, 2, METAL)
    ] });
  add({ id: "boxsack", name: "Boxsack", cat: "training", w: 1, d: 1, price: 180,
    model: () => [B(0, 0, 0, 8, 8, 2, "#2a2a33"), B(0, 0, 2, 2, 2, 52, "#2a2a33"), B(0, 0, 52, 9, 2, 2, "#2a2a33"), B(7, 0, 38, 1, 1, 14, METAL), C(7, 1, 8, 3, 30, "#c0443c", { ct: "#d9655a" })] });
  add({ id: "yogamatte", name: "Yogamatte", cat: "training", w: 1, d: 2, price: 28, flat: true,
    model: () => [B(0, 0, 0, 8, 16, 1, "#7e5cae", { tt: (pu, pv, fu, fv) => (fu < 1 || fu >= 7 ? "#5e3c8e" : ((Math.floor(fv) % 4 === 0) ? "#9272c4" : undefined)), outlineColor: "#3f2a66" })] });
  add({ id: "kettlebells", name: "Kettlebells", cat: "training", w: 1, d: 1, price: 55,
    model: () => [C(2, 2, 0, 2, 3, "#2a2a33", { ct: "#4a4a5a" }), C(2, 2, 3, 1, 2, "#3a3a46"), C(6, 3, 0, 2, 3, "#2a2a33", { ct: "#4a4a5a" }), C(6, 3, 3, 1, 2, "#3a3a46"), C(4, 6, 0, 2, 3, "#c0443c", { ct: "#e0655c" }), C(4, 6, 3, 1, 2, "#8a2f2a")] });

  // ---- Kueche ----
  add({ id: "esstisch", name: "Esstisch", cat: "kueche", w: 2, d: 2, price: 140,
    model: () => [B(1, 1, 0, 2, 2, 12, W.d), B(13, 1, 0, 2, 2, 12, W.d), B(1, 13, 0, 2, 2, 12, W.d), B(0, 0, 12, 16, 16, 2, W.l), B(13, 13, 0, 2, 2, 12, W.d)].slice(0, 3).concat([B(0, 0, 12, 16, 16, 2, W.l)]) });
  add({ id: "stuhl", name: "Stuhl", cat: "kueche", w: 1, d: 1, price: 36,
    model: () => [B(1, 1, 0, 1, 1, 8, W.d), B(6, 1, 0, 1, 1, 8, W.d), B(1, 1, 8, 6, 1, 11, W.m), B(1, 6, 0, 1, 1, 8, W.d), B(6, 6, 0, 1, 1, 8, W.d), B(1, 2, 8, 6, 5, 2, W.l)] });
  add({ id: "kuehlschrank", name: "Kühlschrank", cat: "kueche", w: 1, d: 1, price: 170,
    model: () => [B(0, 0, 0, 8, 8, 46, "#e2e8ee", { tl: (pu, pv) => (pv === 30 ? "#a9b4ba" : (pu >= 13 && pu <= 14 && ((pv >= 33 && pv <= 42) || (pv >= 14 && pv <= 24)) ? "#8a97a8" : undefined)), tr: (pu, pv) => (pv === 30 ? "#a9b4ba" : undefined), ct: "#f2f6fa" })] });
  add({ id: "kuechenzeile", name: "Küchenzeile", cat: "kueche", w: 3, d: 1, price: 280,
    model: () => [
      B(0, 0, 0, 24, 8, 14, "#d9d4c8", { tl: (pu, pv) => ((pu % 16 === 0 || (pv === 13)) ? "#a9a498" : ((pu % 16 === 7 || pu % 16 === 9) && pv >= 6 && pv <= 9 ? "#8a97a8" : undefined)) }),
      B(0, 0, 14, 24, 8, 2, "#3a3a46"), B(3, 2, 16, 7, 4, 1, METAL), B(5, 2, 17, 1, 1, 5, METAL),
      C(15, 3, 16, 1, 1, "#14141c"), C(19, 3, 16, 1, 1, "#14141c"), C(15, 6, 16, 1, 1, "#14141c"), C(19, 6, 16, 1, 1, "#14141c")
    ] });

  // ---- Deko ----
  add({ id: "kaktus", name: "Kaktus", cat: "deko", w: 1, d: 1, price: 18,
    model: () => [C(4, 4, 0, 3, 6, "#c4673a", { ct: "#5a3a28" }), C(4, 4, 6, 2, 16, "#4a9a5a"), C(7, 4, 11, 1, 6, "#4a9a5a"), C(1, 4, 13, 1, 5, "#4a9a5a")] });
  add({ id: "vase", name: "Vase mit Blumen", cat: "deko", w: 1, d: 1, price: 20,
    model: () => [C(4, 4, 0, 2, 10, "#4a72b8"), B(3, 3, 10, 1, 1, 5, "#3f9a56"), B(5, 4, 10, 1, 1, 7, "#3f9a56"), B(2, 2, 14, 3, 3, 3, "#e66767"), B(5, 3, 17, 3, 3, 3, "#f4c542"), B(3, 5, 15, 3, 3, 3, "#e8e0f0")] });
  add({ id: "buecher", name: "Bücherstapel", cat: "deko", w: 1, d: 1, price: 10,
    model: () => [B(1, 1, 0, 6, 5, 2, "#c0443c"), B(1, 2, 2, 6, 5, 2, "#3f6fb5"), B(2, 1, 4, 5, 5, 2, "#d9a23a")] });
  add({ id: "globus", name: "Globus", cat: "deko", w: 1, d: 1, price: 45,
    model: () => [C(4, 4, 0, 2, 1, W.d), B(3, 3, 1, 2, 2, 6, W.d), C(4, 4, 7, 3, 7, "#3f86c9", { tc: (dx, dy) => (Math.sin(dx * 5 + dy * 2) > 0.2 ? "#5fbf63" : "#7fc4f0") })] });
  add({ id: "pokal", name: "Pokal", cat: "deko", w: 1, d: 1, price: 60,
    model: () => [B(2, 2, 0, 4, 4, 3, W.d), C(4, 4, 3, 1, 4, "#d9a23a"), C(4, 4, 7, 2, 6, "#f4c542", { ct: "#fff1a8" })] });
  const invader = (f) => (pu, pv) => {
    if (pu < 1 || pu > 10 || pv < 1 || pv > 12) return "#14141c";
    const x = pu - 3, y = pv - 3, rows = ["..#...#..", "...#.#...", "..#####..", ".##.#.##.", "#########", "#.#####.#", "#.#...#.#", "...##.##."];
    const r = rows[7 - y]; if (r && x >= 0 && x < 9 && r[x] === "#") return f ? "#6fe38a" : "#f4c542";
    return "#14141c";
  };
  add({ id: "arcade", name: "Arcade-Automat", cat: "deko", w: 1, d: 1, price: 300, frames: 2, fps: 1.2,
    model: (f) => [
      B(0, 0, 0, 8, 8, 18, "#5a4aa8"), B(0, 0, 18, 8, 6, 26, "#5a4aa8", { tl: invader(f || 0) }), B(0, 5, 18, 8, 3, 2, "#2a2a33"), C(3, 6, 20, 1, 3, "#c0443c"), B(0, 0, 44, 8, 6, 4, "#f4c542")
    ].map((p, i) => (i === 1 ? Object.assign({}, p, { tl: (pu, pv) => (pu >= 3 && pu <= 12 && pv >= 8 && pv <= 22 ? invader(f || 0)(pu - 2, pv - 6) : undefined) }) : p)) });
  const fishTex = (f) => (pu, pv) => {
    if (pu < 1 || pu > 30 || pv < 1) return "#2a2a33";
    const g = pv > 7 ? "#4aa8e0" : "#6fc4f0";
    const fx = (4 + f * 6) % 24, fx2 = 22 - ((f * 5) % 20);
    if ((pv === 6 && pu >= fx && pu <= fx + 2) || (pv === 6 && pu === fx - 1) || (pv === 7 && pu === fx - 1) || (pv === 5 && pu === fx - 1)) return "#e8862a";
    if ((pv === 4 && pu >= fx2 && pu <= fx2 + 2) || (pv === 4 && pu === fx2 + 3)) return "#f4c542";
    if (pu === 4 && pv < 6) return "#3f9a56"; if (pu === 5 && pv < 4) return "#4caf63";
    return g;
  };
  add({ id: "aquarium", name: "Aquarium", cat: "deko", w: 2, d: 1, price: 380, frames: 3, fps: 1,
    model: (f) => [B(0, 0, 0, 16, 8, 10, W.d), B(0, 0, 10, 16, 8, 12, "#4aa8e0", { tl: fishTex(f || 0), tr: (pu, pv) => ((pv === 11 || pu === 0 || pu === 15) ? "#2a2a33" : "#4aa8e0"), tt: (pu, pv, fu, fv) => ((fu < 1 || fu >= 15 || fv < 1 || fv >= 7) ? "#2a2a33" : "#8ad0f0") })] });

  // ---- Wand (rechte Wand, Tiefe nach vorn; die linke Wand entsteht durch Spiegeln) ----
  const windowTex = (w, h, bars) => (pu, pv) => {
    if (pu < 2 || pu >= w - 2 || pv < 2 || pv >= h - 2) return "#f4f0e8";
    for (let i = 0; i < bars.length; i++) if (Math.abs(pu - bars[i]) < 1) return "#f4f0e8";
    if (Math.abs(pv - Math.floor(h / 2)) < 1) return "#f4f0e8";
    const t = (pv - 2) / (h - 4);
    const sky = t > 0.66 ? "#cde9f8" : t > 0.33 ? "#a9d6f2" : "#8ec9f0";
    return ((pu - pv) % 11 === 0 && pv > 6) ? "#e6f4fc" : sky;
  };
  add({ id: "fenster", name: "Fenster", cat: "wand", w: 2, d: 1, price: 90, wall: true,
    model: () => [B(-1, 0, 24, 18, 3, 2, "#e8e0d0"), B(0, 0, 26, 16, 1, 32, "#f4f0e8", { tl: windowTex(32, 32, [16]) })] });
  add({ id: "fenster_gross", name: "Großes Fenster", cat: "wand", w: 3, d: 1, price: 150, wall: true,
    model: () => [B(-1, 0, 24, 26, 3, 2, "#e8e0d0"), B(0, 0, 26, 24, 1, 36, "#f4f0e8", { tl: windowTex(48, 36, [16, 32]) })] });
  const frameTex = (inner) => (pu, pv) => ((pu < 2 || pu >= 14 || pv < 2 || pv >= 18) ? "#7a4e28" : inner(pu - 2, pv - 2));
  const landscape = (x, y) => (y < 4 ? ((x + y) % 4 < 2 ? "#5a9a45" : "#6aa84f") : (y < 8 ? (Math.abs(x - 3) + (y - 4) * 1.2 < 5 ? "#6aa84f" : "#8ac06a") : ((x - 8) * (x - 8) + (y - 12) * (y - 12) <= 5 ? "#f4c542" : "#9ad0f0")));
  const abstract = (x, y) => pick(["#e66767", "#f4c542", "#3f6fb5", "#e8e0f0", "#3fa860"], hash(Math.floor(x / 3), Math.floor(y / 3), 31));
  const legoPoster = (x, y) => ((y >= 3 && y <= 9 && x >= 2 && x <= 9) ? "#e0422f" : ((y === 10 || y === 11) && (x === 3 || x === 4 || x === 7 || x === 8) ? "#e0422f" : "#f4c542"));
  const mtgPoster = (x, y) => { const d = (x - 6) * (x - 6) + (y - 8) * (y - 8); if (d < 6) return "#e8e0f0"; if (d < 22) return ["#f4e6a8", "#3f6fb5", "#14141c", "#c0443c", "#3fa860"][(x + y) % 5]; return "#3f2f60"; };
  const gymPoster = (x, y) => ((y === 8 && x >= 1 && x <= 10) || (y >= 6 && y <= 10 && (x === 1 || x === 2 || x === 9 || x === 10)) ? "#14141c" : "#e8862a");
  [["bild_landschaft", "Bild Landschaft", 18, landscape], ["bild_abstrakt", "Bild Abstrakt", 18, abstract], ["poster_lego", "LEGO-Poster", 22, legoPoster], ["poster_mtg", "Magic-Poster", 22, mtgPoster], ["poster_gym", "Gym-Poster", 22, gymPoster]].forEach(([id, name, price, inner]) => add({
    id, name, cat: "wand", w: 1, d: 1, price, wall: true, model: () => [B(0, 0, 34, 8, 1, 20, "#7a4e28", { tl: frameTex(inner), skipTop: true, skipR: true })] }));
  add({ id: "wanduhr", name: "Wanduhr", cat: "wand", w: 1, d: 1, price: 30, wall: true,
    model: () => [B(0, 0, 40, 8, 1, 14, "#f4ecd8", { skipTop: true, skipR: true, tl: (pu, pv) => { const r = clockTex(8, 7, 7, "#f4ecd8", "#7a4e28", "#2a2a33")(pu, pv); return r === undefined ? null : r; } })] });
  add({ id: "wandregal", name: "Wandregal", cat: "wand", w: 2, d: 1, price: 55, wall: true,
    model: () => [B(0, 0, 34, 16, 4, 2, W.m), B(1, 0, 30, 1, 3, 4, W.d), B(14, 0, 30, 1, 3, 4, W.d), B(2, 1, 36, 3, 2, 6, "#c0443c"), B(5, 1, 36, 2, 2, 5, "#3f6fb5"), B(7, 1, 36, 3, 2, 7, "#d9a23a"), C(13, 2, 36, 2, 4, "#c4673a"), C(13, 2, 40, 2, 5, "#4caf63")] });
  add({ id: "lichterkette", name: "Lichterkette", cat: "wand", w: 3, d: 1, price: 65, wall: true, frames: 2, fps: 1.5,
    model: (f) => { const m = [B(0, 0, 70, 24, 1, 1, "#3a3a46")]; for (let k = 0; k < 6; k++) m.push(B(2 + 4 * k, 0, 67, 1, 1, 3, (k + (f || 0)) % 2 ? "#ffe9a0" : "#f4a742")); return m; } });
  add({ id: "baseplate", name: "LEGO-Wandplatte", cat: "wand", w: 2, d: 1, price: 90, wall: true,
    model: () => [B(0, 0, 30, 16, 1, 22, "#2f73c9", { tl: (pu, pv) => {
      if (pu < 1 || pu > 30 || pv < 1 || pv > 20) return "#245a9e";
      if (pv >= 2 && pv <= 9 && pu >= 4 && pu <= 11) return "#e0422f"; if (pv >= 10 && pv <= 14 && pu >= 7 && pu <= 11) return "#f4c542";
      if (pv >= 2 && pv <= 6 && pu >= 18 && pu <= 25) return "#3fa860"; if (pv >= 7 && pv <= 8 && pu >= 20 && pu <= 23) return "#e8e8e8";
      return ((pu % 4 === 2 && pv % 4 === 2) ? "#5a96e0" : undefined);
    } })] });
  add({ id: "neon", name: "Neon-Schild", cat: "wand", w: 2, d: 1, price: 140, wall: true, frames: 2, fps: 1.2,
    model: (f) => [B(1, 0, 34, 14, 1, 14, "#14141c", { tl: (pu, pv) => {
      const heart = ["..##.##..", ".#######.", ".#######.", "..#####..", "...###...", "....#...."];
      const x = pu - 10, y = pv - 5; if (y >= 0 && y < 6 && x >= 0 && x < 9 && heart[5 - y][x] === "#") return (f || 0) ? "#ff9ad0" : "#ff5ab0";
      return (pu < 1 || pu > 26 || pv < 1 || pv > 12) ? "#2a2a33" : undefined;
    } })] });

  /* ---------- Katalog nach Kategorien ---------- */
  const CATS = [
    { id: "wohnen", name: "Wohnen" }, { id: "schlafen", name: "Schlafen" }, { id: "arbeiten", name: "Arbeiten" },
    { id: "training", name: "Training" }, { id: "kueche", name: "Küche" }, { id: "deko", name: "Deko" }, { id: "wand", name: "Wand" }
  ];
  const byId = {};
  ITEMS.forEach((it) => { byId[it.id] = it; });

  // Preise: die Zahlen oben sind Listenpreise; K gleicht sie an die Stunden an, die du pro Woche sammelst (zusammen etwa 25 bis 30)
  const K = 0.55, sc = (n) => (n > 0 ? Math.max(1, Math.round(n * K)) : 0);
  ITEMS.forEach((it) => { it.price = sc(it.price); });
  FLOORS.forEach((f) => { f.price = sc(f.price); });
  WALLS.forEach((w) => { w.price = sc(w.price); });
  const GROW = [60, 140, 260, 420].map(sc);

  window.RoomItems = { ITEMS, byId, CATS, FLOORS, WALLS, add, W, FAB, FAB_NAME, shelfTex, stripeTex, pick, GROW, ROOM: { cols0: 6, rows0: 6, max: 10, wallH: 88, slab: 6 } };
})();
