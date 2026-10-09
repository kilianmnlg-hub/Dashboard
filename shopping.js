/* Einkaufsliste: Pixel-Symbole, Gänge und Oberfläche. Die Daten liegen wie alle Nutzdaten nur in der Cloud
   (sync-data.json, Feld "shopping"); script.js übergibt dataStore, Auto-Sync und die Merge-Regeln und ruft
   applyRemote()/payload() auf. */
(function () {
  /* ---------- Pixel-Sprites (8x8) ---------- */
  const SPR = {
    film:    { p: { b: "#3f3f4a", w: "#f4f4f4", r: "#e66767" }, r: ["bbbbbbbb", "bwbrrbwb", "bbbrrbbb", "bwbrrbwb", "bbbrrbbb", "bwbrrbwb", "bbbrrbbb", "bbbbbbbb"] },
    bell:    { p: { y: "#f4c542", d: "#b8892a" }, r: ["...yy...", "..yyyy..", ".yyyyyy.", ".yyyyyy.", ".yyyyyy.", "yyyyyyyy", "dddddddd", "...dd..."] },
    calendar:{ p: { b: "#8d8d99", r: "#e0524b", w: "#f4f4f4", k: "#3f3f4a" }, r: ["rrrrrrrr", "rrrrrrrr", "bwwwwwwb", "bwkwkwkb", "bwwwwwwb", "bwkwkwwb", "bwwwwwwb", "bbbbbbbb"] },
    sword:   { p: { b: "#d8e0ea", c: "#8a97a8", d: "#b5772f" }, r: ["......bb", ".....bbc", "....bbc.", "...bbc..", "..bbc...", ".dbc....", "ddd.....", "dd......"] },
    globe:   { p: { b: "#1f4a7a", g: "#3f86c9", l: "#5fbf63" }, r: ["..bbbb..", ".bggllb.", "bgglgggb", "bgggglgb", "bgllgggb", "bggglggb", ".bgggbb.", "..bbbb.."] },
    flame:   { p: { f: "#e8681c", o: "#f4c542" }, r: ["...f....", "..ff.f..", "..fff.f.", ".fffoff.", ".ffooff.", ".ffooff.", "..fooff.", "...ff..."] },
    trophy:  { p: { g: "#b8892a", y: "#f4c542" }, r: ["gggggggg", ".gyyyyg.", "ggyyyygg", "g.gyyg.g", "..gyyg..", "...gg...", "..gggg..", ".gggggg."] },
    hourglass:{ p: { b: "#b5772f", s: "#f4c542" }, r: ["bbbbbbbb", ".bssssb.", "..bssb..", "...bb...", "...bb...", "..bssb..", ".bssssb.", "bbbbbbbb"] },
    book:    { p: { b: "#8a6a3a", w: "#f2e3b8" }, r: ["..bbbbbb", ".bwwwwwb", "bwwbbwwb", "bwwwwwwb", "bwbbbbwb", "bwwwwwwb", "bbbbbbbb", "........"] },
    brain:   { p: { p: "#e89ab8", l: "#c0587e" }, r: ["..pppp..", ".pplppp.", "pplpplpp", "plppplpp", "pplpplpp", "pppplppp", ".pppppp.", "..pppp.."] },
    brick:   { p: { b: "#d95926", h: "#f0a37a", d: "#9a3a14" }, r: [".bb..bb.", ".bbbbbb.", "bbbbbbbb", "bhbbbbbb", "bbbbbbbb", "bbbbbbbb", "dddddddd", "........"] },
    brickblue:{ p: { b: "#2b5f8a", h: "#9cc4e4", d: "#1a3a58" }, r: [".bb..bb.", ".bbbbbb.", "bbbbbbbb", "bhbbbbbb", "bbbbbbbb", "bbbbbbbb", "dddddddd", "........"] },
    play:    { p: { b: "#8a2f2f", r: "#e66767", w: "#ffffff" }, r: ["bbbbbbbb", "brrrrrrb", "brwrrrrb", "brwwrrrb", "brwwwrrb", "brwwrrrb", "brwrrrrb", "bbbbbbbb"] },
    spark:   { p: { p: "#9085e9" }, r: ["...pp...", "...pp...", "..pppp..", "pppppppp", "pppppppp", "..pppp..", "...pp...", "...pp..."] },
    bulb:    { p: { y: "#f4c542", h: "#fff1a8", g: "#9aa3ad" }, r: ["..yyyy..", ".yhyyyy.", ".yyyyyy.", ".yyyyyy.", "..yyyy..", "...gg...", "...gg...", "..gggg.."] },
    shop:    { p: { r: "#e0524b", w: "#f4f4f4", b: "#8a6a3a", d: "#5c3b1e" }, r: ["rwrwrwrw", "rwrwrwrw", "bbbbbbbb", "bwwddwwb", "bwwddwwb", "bwwddwwb", "bwwddwwb", "bbbbbbbb"] },
    home:    { p: { r: "#c8553d", b: "#d9c8a0", w: "#8ab8e6", d: "#5c3b1e" }, r: ["...rr...", "..rrrr..", ".rrrrrr.", "rrrrrrrr", ".bbbbbb.", ".bwwddb.", ".bwwddb.", ".bbbbbb."] },
    floppy:  { p: { b: "#2f5a96", w: "#dfe9f5", s: "#8ab8e6" }, r: ["bbbbbbbb", "bwwwwbbb", "bwwwwbbb", "bwwwwwwb", "bbbbbbbb", "bssssssb", "bssssssb", "bbbbbbbb"] },
    cart:  { p: { b: "currentColor", c: "#e8681c" }, r: ["b.......", "bb......", ".bcccccc", ".bcccccc", "..bcccc.", "..bbbbb.", "..b...b.", "..b...b."] },
    coin:  { p: { a: "#f4c542", b: "#9a6b10", c: "#fff1a8" }, r: ["..bbbb..", ".baaaab.", "baacaaab", "baacaaab", "baacaaab", "baaaaaab", ".baaaab.", "..bbbb.."] },
    heart: { p: { r: "#e0524b", h: "#ffb3ad" }, r: [".rr..rr.", "rhrrrrrr", "rrrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr..", "...rr...", "........"] },
    star:  { p: { a: "#f4c542" }, r: ["...aa...", "...aa...", "aaaaaaaa", ".aaaaaa.", "..aaaa..", ".aa..aa.", ".a....a.", "........"] },
    chest: { p: { b: "#5c3b1e", a: "#b5772f", d: "#f4c542" }, r: [".bbbbbb.", "baaaaaab", "baaaaaab", "bbbbbbbb", "baaddaab", "baaaaaab", "bbbbbbbb", "........"] },
    pot:   { p: { b: "#6b6b78", c: "#9a9aa8", s: "#e8e8e8" }, r: [".s..s...", "..s..s..", "bbbbbbbb", ".bccccb.", ".bccccb.", ".bccccb.", "..bbbb..", "........"] },
    scroll:{ p: { b: "#8a6a3a", w: "#f2e3b8" }, r: ["bbbbbbbb", "bwwwwwwb", "bwbbbbwb", "bwwwwwwb", "bwbbbbwb", "bwwwwwwb", "bwbbbwwb", "bbbbbbbb"] },
    obst:  { p: { r: "#e04b4b", g: "#5fbf5a", h: "#ffd0c8" }, r: ["....g...", "...g....", ".rrrrrr.", "rhrrrrrr", "rhrrrrrr", "rrrrrrrr", ".rrrrrr.", "..r..r.."] },
    brot:  { p: { a: "#e0a24f", b: "#8a5a1f", c: "#f5d18a" }, r: ["........", "..bbbb..", ".bccccb.", "baccccab", "baaaaaab", "baaaaaab", ".bbbbbb.", "........"] },
    kuehl: { p: { b: "#3f6ea8", w: "#f4f4f4", c: "#6fa8dc" }, r: ["..bbbb..", ".bwwwwb.", "bwwwwwwb", "bccccccb", "bccccccb", "bwwwwwwb", "bwwwwwwb", ".bbbbbb."] },
    fleisch:{ p: { r: "#c8553d", h: "#f0a38a", b: "#f2e6c9" }, r: ["..rrrr..", ".rhhrrr.", ".rhrrrr.", ".rrrrrr.", "..rrrr..", "...bb...", "...bb...", "..b..b.."] },
    vorrat:{ p: { b: "#8d8d99", c: "#8e63c9", d: "#e6d6ff" }, r: [".bbbbbb.", ".cccccc.", ".cddddc.", ".cddddc.", ".cccccc.", ".cddddc.", ".cccccc.", ".bbbbbb."] },
    tk:    { p: { c: "#7fd1d9" }, r: ["...c....", ".c.c.c..", "..ccc...", "cccccccc", "..ccc...", ".c.c.c..", "...c....", "........"] },
    getr:  { p: { s: "#e04b4b", c: "#e9b44c", w: "#fbe7a6" }, r: ["....s...", "....s...", ".cccccc.", ".cwwwwc.", ".cwwwwc.", "..cwwc..", "..cwwc..", "...cc..."] },
    haus:  { p: { b: "#9aa3ad", c: "#6fb7c9", a: "#bfe6ef", d: "#ffffff" }, r: ["...bb...", "...bb...", "..cccc..", ".caaaac.", ".caddac.", ".caaaac.", ".caaaac.", "..cccc.."] },
    misc:  { p: { b: "#5c4a35", c: "#c9a36b", a: "#a98650", d: "#e9d3a0" }, r: [".bbbbbb.", "bcccccab", "bcccccab", "bbbbbbbb", "baaaaaab", "baaddaab", "baaaaaab", "bbbbbbbb"] }
  };
  /* ---------- Artikel-Sprites: je ein eigenes Symbol für die häufigsten Einkäufe ---------- */
  Object.assign(SPR, {
    banane:  { p: { y: "#f4d03f", d: "#b8860b", g: "#6b8e23" }, r: ["......g.", ".....yy.", "....yyd.", "...yyy..", "..yyyy..", ".yyyy...", "yyyyd...", ".dd....."] },
    tomate:  { p: { r: "#e04b4b", g: "#4caf50", h: "#ffb3ad" }, r: ["...gg...", ".g.gg.g.", ".rrrrrr.", "rhrrrrrr", "rhrrrrrr", "rrrrrrrr", ".rrrrrr.", "..rrrr.."] },
    gurke:   { p: { g: "#4caf50", d: "#2e7d32", l: "#a5d6a7" }, r: ["......dd", ".....gld", "....glgd", "...glggd", "..glggd.", ".glggd..", ".gggd...", "..dd...."] },
    salat:   { p: { g: "#6bbf59", d: "#3e8e41", l: "#b7e4a8" }, r: ["..gggg..", ".glgllg.", "gglgggdg", "glgglgdg", "gggldggg", ".gggdgg.", "..dddd..", "...dd..."] },
    zwiebel: { p: { p: "#b36ab4", l: "#e0a8e2", g: "#6b8e23" }, r: ["...g....", "...g....", "..pppp..", ".pllppp.", "pplppppp", "pppppppp", ".pppppp.", "..pppp.."] },
    kartoffel:{ p: { b: "#8b5a2b", a: "#c8935a", d: "#6b4220" }, r: ["........", "..bbbb..", ".baaaab.", "baaadaab", "baaaaaab", "baadaaab", ".baaaab.", "..bbbb.."] },
    paprika: { p: { r: "#e04b4b", g: "#4caf50", h: "#ffb3ad" }, r: ["...gg...", "..rrrr..", ".rhrrrr.", "rhrrrrrr", "rrrrrrrr", "rrrrrrrr", ".rr..rr.", "..r..r.."] },
    zitrone: { p: { y: "#f4e04d", d: "#c9ae1e", g: "#6b8e23", h: "#fffbd0" }, r: [".....g..", "..yyyy..", ".yhyyyy.", "yyyyyyyd", "yyyyyyyd", ".yyyyyd.", "..yddd..", "........"] },
    karotte: { p: { o: "#f08a24", d: "#c25e0a", g: "#4caf50" }, r: ["..g.g...", "..ggg...", ".ooooo..", ".oodoo..", "..ooo...", "..odo...", "...o....", "...o...."] },
    avocado: { p: { g: "#3e7d3a", l: "#b7d96b", b: "#7a4b2a" }, r: ["...gg...", "..gggg..", ".gglllg.", ".glllllg", "ggllbllg", "gglllllg", ".gglllg.", "..gggg.."] },
    knoblauch:{ p: { w: "#f2ead8", d: "#c9bfa5", g: "#8a9a5b" }, r: ["...g....", "...g....", "..www...", ".wwwwww.", "wwdwwdww", "wwdwwdww", ".wwwwww.", "..dddd.."] },
    erdbeere:{ p: { r: "#e0314b", g: "#4caf50", y: "#f4e04d" }, r: [".g.gg.g.", "..gggg..", ".rrrrrr.", "ryrrryrr", "rrrrrrrr", ".rryrrr.", "..rrrr..", "...rr..."] },
    pilz:    { p: { w: "#f2ead8", r: "#c8553d", d: "#9a3a2a" }, r: ["..rrrr..", ".rrwrrr.", "rrrrrwrr", "rwrrrrrr", "dddddddd", "...ww...", "...ww...", "..wwww.."] },
    brokkoli:{ p: { g: "#3e8e41", l: "#6bbf59", s: "#a8c070" }, r: [".ggg.gg.", "gllgglgg", "glgglllg", ".gglggg.", "..gsg...", "...s....", "...s....", "..sss..."] },
    orange:  { p: { o: "#f08a24", d: "#c25e0a", h: "#ffd29a", g: "#4caf50" }, r: ["....g...", "...gg...", ".oooooo.", "ohoooooo", "ohoooooo", "oooooooo", ".oooood.", "..dddd.."] },
    birne:   { p: { g: "#a8c93a", d: "#6b8e23", h: "#d8ec8a", b: "#7a4b2a" }, r: ["...b....", "...gg...", "..gggg..", "..ghgg..", ".gghggg.", "gggggggg", ".gggggd.", "..dddd.."] },
    traube:  { p: { p: "#8e44ad", l: "#c39bd3", g: "#4caf50", b: "#7a4b2a" }, r: ["...b.g..", "..plpl..", ".plplpl.", "..plpl..", "...plp..", "....p...", "........", "........"] },
    broetchen:{ p: { a: "#e0a24f", b: "#8a5a1f", c: "#f5d18a" }, r: ["........", "...bbb..", "..bcccb.", ".bacacab", ".baaaaab", "..bbbbb.", "........", "........"] },
    toast:   { p: { b: "#8a5a1f", w: "#f5e0b0" }, r: [".bb..bb.", "bwwbbwwb", "bwwwwwwb", "bwwwwwwb", "bwwwwwwb", "bwwwwwwb", "bwwwwwwb", "bbbbbbbb"] },
    croissant:{ p: { a: "#e0a24f", b: "#8a5a1f", c: "#f5d18a" }, r: ["........", "..bbbb..", ".bacacb.", "bacaacab", "bab..bab", "bb....bb", "........", "........"] },
    joghurt: { p: { b: "#3f6ea8", w: "#f4f4f4", l: "#8ab8e6" }, r: ["bbbbbbbb", "bwwwwwwb", ".bllllb.", ".blwwlb.", ".bllllb.", ".bllllb.", "..bbbb..", "........"] },
    kaese:   { p: { y: "#f4c542", d: "#c9971a", h: "#fff1a8" }, r: ["......dd", "....yyyd", "..yyyyyd", "yyyhyyyd", "yyyyydyd", "ddddddd.", "........", "........"] },
    butter:  { p: { y: "#f4e27a", d: "#c9b24a", w: "#f2f2f2" }, r: ["........", "..yyyyyy", ".yyyyyyd", "yyyyyyyd", "yyyyyyyd", "wwwwwwwd", "wwwwwww.", "........"] },
    ei:      { p: { w: "#f1e3c4", h: "#ffffff", d: "#c9b48a" }, r: ["...ww...", "..wwww..", ".wwwwww.", "whwwwwwd", "wwwwwwwd", "wwwwwwwd", ".wwwwwd.", "..dddd.."] },
    wurst:   { p: { r: "#c8553d", d: "#8a2f1f", h: "#f0a38a" }, r: ["......dd", ".....rrd", "....rhrd", "...rrrd.", "..rhrd..", ".rrrd...", "drrd....", "dd......"] },
    fisch:   { p: { b: "#6fa8dc", d: "#3f6ea8", e: "#1a1a1a" }, r: ["........", "..dbbd.b", ".bbbbbbb", "bbebbbb.", ".bbbbbbb", "..dbbd.b", "........", "........"] },
    steak:   { p: { r: "#c8553d", h: "#f0a38a", w: "#f2e6c9", d: "#8a2f1f" }, r: ["........", ".ddddd..", "drrrrrd.", "drhwrrrd", "drrrwrrd", "drrrrrrd", ".drrrrd.", "..dddd.."] },
    nudeln:  { p: { y: "#f0d68a", r: "#e0524b", d: "#b8892a" }, r: ["dddddddd", "dyyyyyyd", "dyrrrryd", "dyyyyyyd", "dyyyyyyd", "dyyyyyyd", "dyyyyyyd", "dddddddd"] },
    reis:    { p: { w: "#f4f4f4", b: "#8a6a3a", d: "#cfc7b0" }, r: [".dwwwwd.", "..wwww..", ".wwwwww.", "wwbbbbww", "wwbwwbww", "wwbbbbww", "wwwwwwww", ".dddddd."] },
    mehl:    { like: "reis", p: { w: "#f4f1ea", b: "#c9a36b", d: "#cfc7b0" } },
    streuer: { p: { g: "#9aa3ad", w: "#f4f4f4", b: "#6fa8dc" }, r: ["..gggg..", "..gwgg..", "..gggg..", ".wwwwww.", ".wbbbbw.", ".wbwwbw.", ".wbbbbw.", ".wwwwww."] },
    oel:     { p: { g: "#6b8e23", l: "#b5d46a", b: "#3e5a14", c: "#8a6a3a" }, r: ["...cc...", "...bb...", "..gggg..", ".gglllg.", ".gglllg.", ".gggggg.", ".gggggg.", "..bbbb.."] },
    kaffee:  { p: { c: "#8a5a3a", d: "#5a3a22", s: "#e8e8e8" }, r: ["..s..s..", "...s..s.", "cccccc..", "cddddcc.", "cddddc.c", "cddddcc.", ".cddc...", "..cc...."] },
    tee:     { like: "kaffee", p: { c: "#6aa87a", d: "#b7e0a0", s: "#e8e8e8" } },
    muesli:  { p: { b: "#7a4b1f", y: "#f4c542", r: "#e0524b", w: "#ffffff" }, r: ["bbbbbbbb", "byyyyyyb", "byrrrryb", "byrwwryb", "byrrrryb", "byyyyyyb", "byyyyyyb", "bbbbbbbb"] },
    honig:   { p: { y: "#f4a81d", d: "#b87a0c", c: "#8a6a3a" }, r: ["..cccc..", ".dyyyyd.", ".dyyyyd.", ".dyyyyd.", ".dyyyyd.", ".dyyyyd.", ".dyyyyd.", "..dddd.."] },
    marmelade:{ like: "honig", p: { y: "#c0392b", d: "#7a1f14", c: "#f2f2f2" } },
    nutella: { like: "honig", p: { y: "#6b3e1d", d: "#3e2310", c: "#c0392b" } },
    schoko:  { p: { b: "#5a3520", c: "#8a5a3a", w: "#f4c542" }, r: ["bbbbbbbb", "bcccbccb", "bcccbccb", "bbbbbbbb", "bcccbccb", "bcccbccb", "bbbbbbbb", "wwwwwwww"] },
    chips:   { p: { r: "#e0524b", y: "#f4c542", w: "#ffffff" }, r: ["rrrrrrrr", "ryyyyyyr", "ryywwyyr", "ryyyyyyr", "ryyyyyyr", "ryyyyyyr", "ryyyyyyr", "rrrrrrrr"] },
    kekse:   { p: { b: "#8a5a1f", c: "#d9a05b", d: "#5a3520" }, r: ["..bbbb..", ".bccccb.", "bcdccccb", "bccccdcb", "bccdcccb", ".bcccdb.", "..bbbb..", "........"] },
    ketchup: { p: { r: "#e0524b", d: "#9a2a24", w: "#ffffff", g: "#2e7d32" }, r: ["...gg...", "...gg...", "..rrrr..", ".rwwwwr.", ".rrrrrr.", ".rrrrrr.", ".rrrrrr.", "..dddd.."] },
    wasser:  { p: { b: "#6fa8dc", w: "#e8f4ff", d: "#3f6ea8" }, r: ["...dd...", "...dd...", "..bbbb..", ".bwwwwb.", ".bwwwwb.", ".bbbbbb.", ".bwwwwb.", "..bbbb.."] },
    saft:    { p: { o: "#f08a24", w: "#f4f4f4", d: "#c25e0a", g: "#4caf50" }, r: ["..dddd..", ".dwwwwd.", "dooooood", "dooggood", "dooooood", "dooooood", "dwwwwwwd", ".dddddd."] },
    cola:    { p: { r: "#e0524b", w: "#ffffff", g: "#9aa3ad", d: "#9a2a24" }, r: [".gggggg.", ".rrrrrr.", ".rrwwrr.", ".rwwwwr.", ".rrwwrr.", ".rrrrrr.", ".dddddd.", ".gggggg."] },
    bier:    { p: { y: "#f4c542", w: "#ffffff", g: "#9aa3ad" }, r: [".wwww...", "wwwwww..", "gyyyyggg", "gyyyyg.g", "gyyyyg.g", "gyyyyggg", "gyyyyg..", "gggggg.."] },
    wein:    { p: { g: "#2e6a45", w: "#f2e6c9" }, r: ["...gg...", "...gg...", "..gggg..", "..gggg..", ".gwwwwg.", ".gwwwwg.", ".gggggg.", ".gggggg."] },
    pizza:   { p: { y: "#f4c542", c: "#e0a24f", r: "#e0524b" }, r: ["cccccccc", "cyyryyyc", ".yryyyc.", ".yyyyry.", "..yryy..", "..yyyy..", "...yy...", "...y...."] },
    eis:     { p: { p: "#f4a6c0", w: "#f8e8d0", c: "#d9a05b", d: "#b8761f" }, r: ["..pppp..", ".pppppp.", ".pwpppp.", "wwwwwwww", "..dcdc..", "...cdc..", "...cd...", "....c..."] },
    klopapier:{ p: { w: "#f4f4f4", d: "#cfcfcf", c: "#b8a37a" }, r: [".wwwwww.", "wwwddwww", "wwdccdww", "wwdccdww", "wwwddwww", ".wwwwww.", "..dddd..", "........"] },
    zahnpasta:{ p: { w: "#f4f4f4", r: "#e0524b", b: "#3f6ea8" }, r: ["wwwwwwww", ".wrrrrw.", ".wwwwww.", ".wwrrww.", "..wwww..", "..wwww..", "...bb...", "..bbbb.."] },
    shampoo: { p: { p: "#e0524b", d: "#3f8aa0", b: "#6fb7c9", w: "#ffffff" }, r: ["...pp...", "..dddd..", ".bbbbbb.", ".bwwwwb.", ".bwwwwb.", ".bbbbbb.", ".bbbbbb.", "..dddd.."] },
    waschmittel:{ p: { b: "#3f6ea8", c: "#6fa8dc", w: "#ffffff", y: "#f4c542" }, r: ["bbbbbbbb", "bccccccb", "bcwwwwcb", "bcwyywcb", "bcwwwwcb", "bccccccb", "bbbbbbbb", "........"] },
    proteinpulver:{ p: { b: "#3f3f4a", w: "#f4f4f4", r: "#e0524b", d: "#bdbdbd" }, r: ["..bbbb..", ".bbbbbb.", ".wwwwww.", ".wrrrrw.", ".wrwwrw.", ".wrrrrw.", ".wwwwww.", ".dddddd."] },
    proteinriegel:{ p: { b: "#5a3520", r: "#c0392b", w: "#f4c542" }, r: ["........", "b.bbbb.b", "bbrrrrbb", "brwwwwrb", "brrwwrrb", "bbrrrrbb", "b.bbbb.b", "........"] },
    nuss:    { p: { b: "#7a4b2a", c: "#d9a05b", d: "#f0c88a" }, r: ["...bb...", "..bccb..", ".bccccb.", ".bcdccb.", ".bccccb.", "..bccb..", "...bb...", "........"] },
    erdnussbutter:{ like: "honig", p: { y: "#c8934a", d: "#8a5a1f", c: "#d33a2a" } },
    suesskartoffel:{ p: { b: "#8a3a5a", a: "#e0885a", d: "#b85a30" }, r: ["........", "....bbb.", "..bbaaab", ".baaaaab", "baaadaab", "baaaaab.", ".bbbbb..", "........"] },
    pflanzendrink:{ like: "kuehl", p: { b: "#3e7d3a", w: "#f4f4f4", c: "#8bc57a" } },
    getreide:{ like: "reis", p: { w: "#e8d6a0", b: "#8a6a3a", d: "#b8a070" } },
    hummus:  { like: "honig", p: { y: "#e0c58a", d: "#a88a4a", c: "#6b8e23" } },
    tofu:    { p: { w: "#f4ecd8", d: "#cdbf9a" }, r: ["........", "..wwwwww", ".wwwwwwd", "wwwwwwdd", "wwwwwwdd", "wwwwwwd.", "dddddd..", "........"] },
    wrap:    { p: { b: "#b8863f", c: "#e8c98a", d: "#f4e3b8" }, r: ["........", "..bbbb..", ".bccccb.", "bcddddcb", "bcddddcb", ".bccccb.", "..bbbb..", "........"] },
    reiswaffel:{ p: { b: "#a98650", w: "#f0dfb0", d: "#d9c185" }, r: ["..bbbb..", ".bwwwwb.", "bwdwdwwb", "bwwdwdwb", "bwdwdwwb", "bwwdwdwb", ".bwwwwb.", "..bbbb.."] },
    trockenobst:{ like: "chips", p: { r: "#7a3e2a", y: "#a8603a", w: "#e8c8a0" } },
    bruehe:  { like: "tofu", p: { w: "#f4c542", d: "#b8892a" } },
    tomatenmark:{ like: "zahnpasta", p: { w: "#e0524b", r: "#f4a6a0", b: "#2e7d32" } },
    mayo:    { like: "ketchup", p: { r: "#f2e8c0", d: "#c9b46a", w: "#ffffff", g: "#e0524b" } },
    senf:    { like: "ketchup", p: { r: "#e0b020", d: "#9a7a10", w: "#ffffff", g: "#6b8e23" } },
    shaker:  { p: { b: "#3f3f4a", w: "#d8e6f0", c: "#e0c8a0" }, r: ["...bb...", "..bbbb..", ".wwwwww.", ".wccccw.", ".wccccw.", ".wccccw.", ".wccccw.", ".bbbbbb."] },
    energy:  { like: "cola", p: { r: "#2a6fd1", w: "#f4e04d", g: "#9aa3ad", d: "#1a3f80" } },
    sportdrink:{ like: "wasser", p: { b: "#5fbf63", w: "#e8ffe8", d: "#2e7d32" } },
    vitamine:{ p: { b: "#f4f4f4", c: "#e08a1e", d: "#a85f0a", w: "#ffffff", r: "#e0524b" }, r: ["..bbbb..", ".bbbbbb.", ".cccccc.", ".cwwwwc.", ".cwrrwc.", ".cwwwwc.", ".cccccc.", ".dddddd."] },
    kiwi:    { p: { b: "#7a5a2a", g: "#7cc24a", l: "#b7e07a", w: "#f2f7d0", d: "#2a2a1a" }, r: ["..bbbb..", ".bggggb.", "bglwwlgb", "glwdwwlg", "glwwdwlg", "bglwwlgb", ".bggggb.", "..bbbb.."] },
    ananas:  { p: { g: "#4caf50", y: "#f4c542", x: "#c9971a" }, r: ["..g.g...", "...gg...", "..yyyy..", ".yxyxyy.", ".yyxyxy.", ".yxyxyy.", ".yyxyxy.", "..yyyy.."] },
    melone:  { p: { g: "#3e8e41", w: "#cfe8b0", r: "#e0524b", k: "#2a1a1a" }, r: ["........", "gggggggg", "gwwwwwwg", ".rrrrrr.", ".rkrrkr.", "..rrrr..", "...rr...", "........"] },
    kirsche: { p: { r: "#c0192b", g: "#4caf50", h: "#ffb3ad" }, r: ["...g.g..", "..g...g.", ".g.....g", ".rr...rr", "rhrr.rhr", "rrrr.rrr", ".rr...rr", "........"] },
    mais:    { p: { g: "#6b8e23", y: "#f4d03f", x: "#c9a41e" }, r: ["...gg...", "..gyyg..", ".gyxyyg.", ".gyyxyg.", ".gyxyyg.", ".gyyxyg.", "..gyyg..", "...gg..."] },
    erbse:   { p: { g: "#4a9c3a", p: "#9ed36a" }, r: ["........", ".gggggg.", "gpgpgpgg", "gppppppg", ".gggggg.", "........", "........", "........"] },
    radieschen:{ p: { g: "#4caf50", r: "#d02a5a", w: "#f4f4f4" }, r: ["..g.g...", "...gg...", "..rrrr..", ".rrrrrr.", ".rrrrrr.", "..rrrr..", "...ww...", "....w..."] },
    ingwer:  { p: { b: "#b8863f", a: "#e0b86a" }, r: ["........", "..bb..b.", "..bbbbbb", ".baaabab", "baaaaaab", ".baaaab.", "..bbbb..", "........"] },
    chili:   { p: { g: "#4caf50", r: "#d9342b" }, r: ["......g.", ".....gg.", "....rrr.", "...rrrr.", "..rrrr..", ".rrrr...", "rrrr....", "rr......"] },
    kraeuter:{ p: { g: "#4caf50", l: "#9ed36a", d: "#6b4a2a" }, r: ["..g.g...", ".ggggg..", "gglgggg.", ".gggggg.", "..ggg...", "...d....", "...d....", "...d...."] },
    garnele: { p: { r: "#f08a6a", h: "#ffd0c0" }, r: ["..rrrr..", ".rrhrrr.", "rrrr.rrr", "rrr..rrr", "rrr..rr.", ".rrr.r..", "..rrrr..", "...rr..."] },
    thunfisch:{ p: { g: "#9aa3ad", b: "#3f6ea8", w: "#cfe3f4", e: "#1a1a1a" }, r: [".gggggg.", ".bbbbbb.", ".bwwwwb.", ".bwebwb.", ".bwwwwb.", ".bbbbbb.", ".gggggg.", "........"] },
    pommes:  { p: { y: "#f4c542", r: "#e0524b", w: "#ffffff" }, r: ["..y.y.y.", "..yyyyy.", ".yyyyyyy", "rrrrrrrr", "rwwwwwwr", ".rwwwwr.", ".rwwwwr.", "..rrrr.."] },
    brezel:  { p: { b: "#a8662a" }, r: [".bb..bb.", "b..bb..b", "b.b..b.b", ".bbbbbb.", "b.b..b.b", "b..bb..b", ".bb..bb.", "........"] },
    muellbeutel:{ p: { b: "#4a4a58", h: "#7a7a8c", c: "#9aa3ad" }, r: ["...cc...", "..bbbb..", ".bbbbbb.", "bbbhbbbb", "bbhbbbbb", "bbbbbbbb", ".bbbbbb.", "..bbbb.."] },
    schwamm: { p: { g: "#4caf50", y: "#f4d03f", o: "#c9a41e" }, r: ["........", "gggggggg", "gggggggg", "yyyyyyyy", "yoyyyoyy", "yyyyyyyy", "yyyyyyyy", "........"] },
    batterie:{ p: { b: "#cfcfcf", g: "#2a2a32", y: "#f4c542" }, r: ["...bb...", "..gggg..", "..gggg..", "..yyyy..", "..gggg..", "..gggg..", "..gggg..", "..bbbb.."] },
    seife:   { p: { b: "#6fb7c9", w: "#cfeaf2", c: "#ffffff" }, r: ["........", ".bbbbbb.", "bwwwwwwb", "bwcccwwb", "bwwwwwwb", ".bbbbbb.", "........", "........"] },
    deo:     { p: { b: "#cfcfcf", g: "#6fa8dc", c: "#9ec7ec", w: "#ffffff" }, r: ["...bb...", "..gggg..", ".gccccg.", ".gcwwcg.", ".gccccg.", ".gccccg.", ".gggggg.", "........"] },
    zahnbuerste:{ p: { r: "#e0524b", w: "#f4f4f4", b: "#6fb7c9", c: "#3f8aa0" }, r: ["..rrrr..", "..wwww..", "...bb...", "...bb...", "...bb...", "...bb...", "...bb...", "...cc..."] },
    tissue:  { p: { w: "#ffffff", b: "#3f6ea8", c: "#8ab8e6" }, r: ["..www...", ".wwwww..", "bbbbbbbb", "bccccccb", "bcwwwwcb", "bccccccb", "bccccccb", "bbbbbbbb"] },
  });
  /* [Sprite, Anzeigename, Stichwörter]: die erste passende Zeile gewinnt; Stichwörter bis 3 Buchstaben müssen exakt dem Wort entsprechen, längere genügen als Wortteil */
  const ITEM_SPRITES = [
    ["pflanzendrink", "Pflanzendrink", ["hafermilch", "haferdrink", "mandelmilch", "mandeldrink", "sojadrink", "sojamilch", "reismilch", "kokosmilch", "pflanzendrink"]],
    ["reiswaffel", "Reiswaffeln", ["reiswaffel", "waffel", "knäckebrot", "cracker"]],
    ["erdnussbutter", "Erdnussbutter", ["erdnussbutter", "erdnussmus", "mandelmus", "nussmus"]],
    ["proteinriegel", "Proteinriegel", ["proteinriegel", "eiweißriegel", "müsliriegel", "riegel"]],
    ["shaker", "Protein-Shake", ["shake", "shaker"]],
    ["proteinpulver", "Proteinpulver", ["proteinpulver", "eiweißpulver", "whey", "casein", "protein", "eiweiß"]],
    ["vitamine", "Vitamine", ["vitamin", "kreatin", "magnesium", "omega", "nahrungsergänzung", "zink", "tabletten"]],
    ["tomatenmark", "Tomatenmark", ["tomatenmark"]],
    ["suesskartoffel", "Süßkartoffel", ["süßkartoffel", "süsskartoffel", "batate"]],
    ["thunfisch", "Thunfisch", ["thunfisch"]],
    ["garnele", "Garnelen", ["garnele", "shrimp", "scampi", "krabbe"]],
    ["klopapier", "Klopapier", ["klopapier", "toilettenpapier", "küchenrolle"]],
    ["tissue", "Taschentücher", ["taschentücher", "kosmetiktücher", "tempo"]],
    ["zahnbuerste", "Zahnbürste", ["zahnbürste", "zahnseide"]],
    ["zahnpasta", "Zahnpasta", ["zahnpasta", "mundspülung"]],
    ["seife", "Seife", ["seife", "handseife"]],
    ["deo", "Deo", ["deo", "deodorant"]],
    ["shampoo", "Shampoo & Duschgel", ["shampoo", "duschgel", "spülung"]],
    ["waschmittel", "Waschmittel", ["waschmittel", "weichspüler", "tabs"]],
    ["haus", "Spülmittel", ["spülmittel", "spüli", "reiniger"]],
    ["muellbeutel", "Müllbeutel", ["müllbeutel", "müllsack", "mülltüte"]],
    ["schwamm", "Schwamm", ["schwamm", "putzlappen"]],
    ["batterie", "Batterien", ["batterie", "akku"]],
    ["reis", "Reis", ["reis"]],
    ["broetchen", "Brötchen", ["brötchen", "semmel", "weckle"]], ["toast", "Toast", ["toast"]], ["croissant", "Croissant", ["croissant", "hörnchen"]],
    ["brezel", "Brezel", ["brezel", "brezn", "laugen"]], ["wrap", "Wrap", ["wrap", "tortilla", "fladenbrot", "pita"]], ["brot", "Brot", ["brot", "baguette"]],
    ["banane", "Banane", ["banane"]], ["tomate", "Tomate", ["tomate"]], ["gurke", "Gurke", ["gurke", "zucchini"]], ["salat", "Salat", ["salat", "spinat", "rucola"]],
    ["zwiebel", "Zwiebel", ["zwiebel", "lauch"]], ["kartoffel", "Kartoffel", ["kartoffel"]], ["paprika", "Paprika", ["paprika"]], ["zitrone", "Zitrone", ["zitrone", "limette"]],
    ["karotte", "Karotte", ["karotte", "möhre", "mohrrübe"]], ["avocado", "Avocado", ["avocado"]], ["knoblauch", "Knoblauch", ["knoblauch"]],
    ["erdbeere", "Beeren", ["erdbeere", "beere", "himbeer", "heidelbeer"]], ["pilz", "Pilze", ["pilz", "champignon"]], ["brokkoli", "Brokkoli", ["brokkoli", "blumenkohl"]],
    ["orange", "Orange", ["orange", "mandarine", "clementine"]], ["birne", "Birne", ["birne"]], ["traube", "Trauben", ["traube"]],
    ["kiwi", "Kiwi", ["kiwi"]], ["ananas", "Ananas", ["ananas"]], ["melone", "Melone", ["melone"]], ["kirsche", "Kirschen", ["kirsche"]],
    ["radieschen", "Radieschen", ["radieschen", "rettich", "bete"]], ["ingwer", "Ingwer", ["ingwer"]], ["chili", "Chili", ["chili", "peperoni"]],
    ["kraeuter", "Kräuter", ["kräuter", "petersilie", "schnittlauch", "koriander", "minze", "dill", "rosmarin", "thymian", "basilikum"]],
    ["obst", "Apfel", ["apfel", "äpfel"]],
    ["vorrat", "Konserven", ["dose", "passata", "bohnen", "linsen", "kichererbse", "konserve"]], ["erbse", "Erbsen", ["erbse", "erbsen"]], ["mais", "Mais", ["mais"]],
    ["joghurt", "Joghurt", ["joghurt", "quark", "skyr", "pudding", "sahne", "schmand"]], ["kaese", "Käse", ["käse", "gouda", "emmentaler", "parmesan", "mozzarella", "feta", "camembert"]],
    ["butter", "Butter", ["butter", "margarine"]], ["ei", "Eier", ["ei", "eier"]], ["kuehl", "Milch", ["milch"]],
    ["wurst", "Wurst", ["wurst", "salami", "schinken", "speck", "bacon", "würstchen", "aufschnitt"]], ["fisch", "Fisch", ["fisch", "lachs"]],
    ["steak", "Hack & Steak", ["hack", "steak", "schnitzel", "rind", "schwein", "gulasch"]], ["fleisch", "Hähnchen & Pute", ["hähnchen", "huhn", "pute", "keule"]],
    ["nudeln", "Nudeln", ["nudel", "spaghetti", "pasta", "penne", "fusilli"]], ["mehl", "Mehl", ["mehl", "backpulver", "hefe", "stärke"]],
    ["streuer", "Zucker & Salz", ["zucker", "salz", "pfeffer", "gewürz"]], ["oel", "Öl & Essig", ["olivenöl", "rapsöl", "sonnenblumenöl", "öl", "essig"]],
    ["kaffee", "Kaffee", ["kaffee", "espresso"]], ["tee", "Tee", ["tee", "teebeutel"]], ["muesli", "Müsli & Haferflocken", ["müsli", "haferflocken", "cornflakes", "cerealien", "granola"]],
    ["honig", "Honig", ["honig"]], ["nutella", "Nuss-Nougat", ["nutella", "nussnugat", "schokocreme"]], ["marmelade", "Marmelade", ["marmelade", "konfitüre", "gelee"]],
    ["schoko", "Schokolade", ["schoko", "schokolade"]], ["chips", "Chips & Snacks", ["chips", "flips", "popcorn"]], ["kekse", "Kekse", ["keks", "kekse", "gebäck", "kuchen"]],
    ["ketchup", "Soßen", ["ketchup", "soße", "sauce", "dressing", "pesto"]], ["mayo", "Mayo", ["mayo", "majo", "remoulade"]], ["senf", "Senf", ["senf"]],
    ["bruehe", "Brühe", ["brühe", "bouillon", "fond"]], ["trockenobst", "Trockenobst", ["datteln", "rosinen", "trockenfrüchte", "trockenobst", "feigen", "cranberr"]],
    ["getreide", "Quinoa & Couscous", ["quinoa", "couscous", "bulgur", "hirse", "amaranth"]], ["tofu", "Tofu", ["tofu", "tempeh", "seitan"]], ["hummus", "Hummus", ["hummus"]],
    ["nuss", "Nüsse & Mandeln", ["nüsse", "nuss", "mandel", "walnuss", "cashew", "erdnuss", "haselnuss", "pistazie"]],
    ["wasser", "Wasser", ["wasser", "sprudel"]], ["cola", "Cola", ["cola"]], ["energy", "Energy Drink", ["energy", "redbull", "monster"]],
    ["sportdrink", "Sportdrink", ["isodrink", "isotonisch", "sportdrink", "elektrolyt", "bcaa"]],
    ["saft", "Saft & Limo", ["saft", "schorle", "limo", "fanta", "sprite"]], ["bier", "Bier", ["bier", "radler"]], ["wein", "Wein", ["wein", "sekt", "prosecco"]],
    ["pizza", "Pizza", ["pizza", "tiefkühl"]], ["pommes", "Pommes", ["pommes", "kroketten", "rösti"]], ["eis", "Eis", ["eis", "eiscreme"]]
  ];
  function itemSprite(name) {
    const words = name.toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
    const hit = ITEM_SPRITES.find(([, , kws]) => kws.some(k => words.some(w => k.length <= 3 ? w === k : w.includes(k))));
    return hit ? hit[0] : null;
  }
  const sprCache = {};
  function spr(name, size = 16, cls = "") {
    const key = name + "|" + size + "|" + cls;
    if (sprCache[key]) return sprCache[key];
    const s0 = SPR[name] || SPR.misc, s = { p: s0.p, r: s0.r || SPR[s0.like].r }; let rects = "";
    s.r.forEach((row, y) => { let x = 0; while (x < 8) { const ch = row[x]; if (ch === ".") { x++; continue; } let w = 1; while (x + w < 8 && row[x + w] === ch) w++; rects += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${s.p[ch]}"/>`; x += w; } });
    return (sprCache[key] = `<svg class="spr ${cls}" width="${size}" height="${size}" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`);
  }


  /* ---------- Wisch-Helfer (Handy) ---------- */
  // true, wenn zwischen Ziel und Wurzel ein waagerecht scrollbares Element liegt: dort gehört die Geste dem Scrollen
  const isScrollableX = (node, root) => {
    for (let n = node; n && n !== root && n.nodeType === 1; n = n.parentElement) {
      if (n.scrollWidth > n.clientWidth + 2) {
        const ox = getComputedStyle(n).overflowX;
        if (ox === "auto" || ox === "scroll") return true;
      }
    }
    return false;
  };
  // Seitwärts-Wischen auf einer Fläche (z.B. zwischen Reitern wechseln)
  function attachSwipe(el, { onLeft, onRight, ignore, rightIgnore }) {
    if (!el) return;
    let sx = 0, sy = 0, st = 0, ok = false, noRight = false;
    el.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      ok = e.touches.length === 1 && !(ignore && e.target.closest && e.target.closest(ignore)) && !isScrollableX(e.target, el);
      noRight = !!(rightIgnore && e.target.closest && e.target.closest(rightIgnore));
      sx = t.clientX; sy = t.clientY; st = Date.now();
    }, { passive: true });
    el.addEventListener("touchend", (e) => {
      if (!ok) return;
      ok = false;
      const t = e.changedTouches[0], dx = t.clientX - sx, dy = t.clientY - sy;
      if (dx > 0 && noRight) return; // Rechts-Wischen auf einer Zeile gehört dem Abhaken
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.6 && Date.now() - st < 700) (dx < 0 ? onLeft : onRight)();
    }, { passive: true });
  }
  // Zeile nach rechts wischen = erledigt (Ziehen zeigt die Zeile mit; ab ca. 90px löst es aus)
  function attachRowSwipe(container, rowSel, onDone) {
    if (!container) return;
    let row = null, sx = 0, sy = 0, dx = 0, active = false, locked = false;
    container.addEventListener("touchstart", (e) => {
      row = e.touches.length === 1 && e.target.closest ? e.target.closest(rowSel) : null;
      if (row && e.target.closest("input, button, .shop-menu")) row = null;
      if (!row) return;
      sx = e.touches[0].clientX; sy = e.touches[0].clientY; dx = 0; active = false; locked = false;
    }, { passive: true });
    container.addEventListener("touchmove", (e) => {
      if (!row || locked) return;
      const mx = e.touches[0].clientX - sx, my = e.touches[0].clientY - sy;
      if (!active) {
        if (Math.abs(my) > 10 && Math.abs(my) > Math.abs(mx)) { locked = true; return; }
        if (mx > 12 && mx > Math.abs(my) * 1.5) active = true; else return;
      }
      dx = Math.max(0, Math.min(mx, 140));
      row.style.transform = `translateX(${dx}px)`;
      row.classList.toggle("swipe-ready", dx > 90);
    }, { passive: true });
    const end = () => {
      if (!row) return;
      const r = row; row = null;
      r.style.transform = "";
      r.classList.remove("swipe-ready");
      if (active && dx > 90) onDone(r);
      active = false;
    };
    container.addEventListener("touchend", end, { passive: true });
    container.addEventListener("touchcancel", end, { passive: true });
  }
  window.PixelSprites = { spr, SPR, attachSwipe, attachRowSwipe };

  /* ---------- Einkaufsliste: Gänge, Daten, Oberfläche ---------- */
  const DAY = 86400000;
  const AISLES = [
    { id: "obst", label: "Obst & Gemüse", kw: ["apfel", "äpfel", "banane", "tomate", "gurke", "salat", "zwiebel", "kartoffel", "paprika", "zitrone", "karotte", "möhre", "avocado", "beere", "knoblauch", "pilz", "brokkoli", "ingwer", "basilikum", "orange", "birne", "traube", "zucchini", "limette", "kiwi", "ananas", "melone", "kirsche", "radieschen", "rettich", "chili", "peperoni", "kräuter", "petersilie", "schnittlauch", "koriander", "minze", "dill", "rosmarin", "thymian", "champignon", "blumenkohl", "spinat", "rucola", "lauch", "süßkartoffel"] },
    { id: "brot", label: "Brot & Backwaren", kw: ["brot", "brötchen", "toast", "mehl", "hefe", "croissant", "backpulver", "pizzateig", "wrap", "tortilla", "reiswaffel", "brezel", "laugen", "baguette", "knäckebrot", "fladenbrot", "pita"] },
    { id: "kuehl", label: "Milch & Kühlregal", kw: ["milch", "joghurt", "käse", "butter", "quark", "sahne", "ei", "eier", "skyr", "mozzarella", "parmesan", "schmand", "margarine", "tofu", "hummus", "frischkäse", "haferdrink", "hafermilch", "mandelmilch", "sojadrink", "tempeh"] },
    { id: "fleisch", label: "Fleisch & Fisch", kw: ["hähnchen", "hack", "lachs", "wurst", "schinken", "fleisch", "speck", "steak", "salami", "garnele", "shrimp", "scampi", "pute", "aufschnitt", "bacon", "hähnchenbrust", "=fisch"] },
    { id: "vorrat", label: "Vorrat", kw: ["nudel", "spaghetti", "pasta", "reis", "öl", "olivenöl", "rapsöl", "zucker", "salz", "müsli", "haferflocken", "dose", "passata", "bohnen", "linsen", "kaffee", "tee", "soße", "sauce", "gewürz", "pesto", "honig", "ketchup", "senf", "chips", "schokolade", "kekse", "quinoa", "couscous", "bulgur", "kichererbse", "erbsen", "mais", "protein", "eiweiß", "whey", "riegel", "nüsse", "mandeln", "erdnussbutter", "datteln", "rosinen", "brühe", "bouillon", "tomatenmark", "mayo", "nutella", "marmelade", "thunfisch", "popcorn", "cracker", "essig", "pfeffer"] },
    { id: "tk", label: "Tiefkühl", kw: ["pizza", "tiefkühl", "eis", "pommes", "kroketten", "tiefkühlpizza", "rösti", "eiscreme"] },
    { id: "getr", label: "Getränke", kw: ["wasser", "saft", "cola", "bier", "wein", "limo", "sprudel", "sportdrink", "energy", "isodrink", "shake", "schorle", "fanta", "sprite", "sekt", "prosecco", "radler", "redbull"] },
    { id: "haus", label: "Drogerie & Haushalt", kw: ["zahnpasta", "shampoo", "duschgel", "spüli", "spülmittel", "klopapier", "toilettenpapier", "waschmittel", "müllbeutel", "küchenrolle", "zahnbürste", "zahnseide", "seife", "handseife", "deo", "taschentücher", "tempo", "müllsack", "schwamm", "batterie", "akku", "vitamin", "kreatin", "magnesium", "omega", "weichspüler", "reiniger", "mundspülung", "spülung"] },
    { id: "misc", label: "Sonstiges", kw: [] }
  ];
  const AISLE_IDS = new Set(AISLES.map((a) => a.id));
  // Stichwort-Treffer wie bei den Symbolen: bis 3 Buchstaben nur als ganzes Wort ("ei" soll nicht in "Reis" treffen)
  const kwHit = (words, k) => (k[0] === "=" ? words.includes(k.slice(1)) : words.some((w) => (k.length <= 3 ? w === k : w.includes(k)))); // "=wort" = nur als ganzes Wort
  const wordsOf = (name) => name.toLowerCase().split(/[^a-zäöüß]+/).filter(Boolean);
  const guessAisle = (name, learned) => {
    const l = name.toLowerCase();
    if (learned && AISLE_IDS.has(learned[l])) return learned[l];
    const words = wordsOf(name);
    return (AISLES.find((a) => a.kw.some((k) => kwHit(words, k))) || AISLES[AISLES.length - 1]).id;
  };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const norm = (s) => s.trim().replace(/\s+/g, " ");
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  // "2x Milch", "500g Mehl": führende Menge abtrennen
  const parseQty = (raw) => {
    const m = norm(raw).match(/^(\d+(?:[.,]\d+)?\s?(?:x|×|g|kg|l|ml|stk|pck)?)\s+(.+)$/i);
    return m ? { qty: m[1].replace(/\s/g, ""), name: m[2] } : { qty: "", name: norm(raw) };
  };
  // Beträge immer auf den nächsten vollen Euro aufgerundet angezeigt
  const fmt = (n) => Math.ceil(n - 1e-9) + " €";
  const unitCount = (qty) => {
    const m = (qty || "").match(/^(\d+(?:[.,]\d+)?)(?:x|×|stk)?$/i);
    return m ? parseFloat(m[1].replace(",", ".")) : 1; // 500g / 2l zählen als eine Packung
  };

  const emptyState = () => ({ items: [], history: {}, prices: {}, learned: {}, dishes: [], updatedAt: -1 });
  // Alles, was aus Cloud/Speicher kommt, wird geprüft und bereinigt, damit kaputte Daten nie die Oberfläche zerlegen
  const sanitize = (raw, newId) => {
    const out = emptyState();
    out.updatedAt = 0;
    if (!raw || typeof raw !== "object") return out;
    if (typeof raw.updatedAt === "number" && isFinite(raw.updatedAt)) out.updatedAt = raw.updatedAt;
    const learned = {};
    Object.entries(raw.learned || {}).forEach(([k, v]) => { if (typeof k === "string" && AISLE_IDS.has(v)) learned[k.toLowerCase()] = v; });
    out.learned = learned;
    if (Array.isArray(raw.items)) {
      raw.items.forEach((i) => {
        if (!i || typeof i.name !== "string" || !i.name.trim()) return;
        out.items.push({
          id: i.id ? String(i.id) : newId(),
          name: i.name,
          qty: typeof i.qty === "string" ? i.qty : "",
          aisle: AISLE_IDS.has(i.aisle) ? i.aisle : guessAisle(i.name, learned)
        });
      });
    }
    Object.entries(raw.history || {}).forEach(([k, v]) => {
      if (!Array.isArray(v)) return;
      const ts = v.filter((t) => typeof t === "number" && isFinite(t)).slice(-12);
      if (ts.length) out.history[k] = ts;
    });
    Object.entries(raw.prices || {}).forEach(([k, v]) => { if (typeof v === "number" && isFinite(v) && v >= 0) out.prices[k] = v; });
    if (Array.isArray(raw.dishes)) {
      raw.dishes.forEach((d) => {
        if (!d || typeof d.name !== "string" || !Array.isArray(d.items)) return;
        const items = d.items.filter((x) => typeof x === "string" && x.trim());
        if (items.length) out.dishes.push({ name: d.name, items });
      });
    }
    return out;
  };
  const hasContent = (s) => s.items.length > 0 || s.dishes.length > 0 || Object.keys(s.history).length > 0 || Object.keys(s.prices).length > 0;

  window.createShoppingBoard = function (deps) {
    const { dataStore, scheduleAutoSync, remoteWins, newId, xp } = deps;
    const root = document.getElementById("shopRoot");
    if (!root) return null;
    const $ = (id) => document.getElementById(id);
    const KEY = "dashboard-shopping-v1";

    let state = emptyState();
    try {
      const raw = dataStore.getItem(KEY);
      if (raw) state = sanitize(JSON.parse(raw), newId);
    } catch (e) { /* kaputter Speicher: leer starten */ }

    // Nur Oberfläche, nie gespeichert
    let storeMode = false, tab = "list", openMenu = null;
    const closed = new Set(), openDishes = new Set(), doneIds = new Set(), freshIds = new Set(), timers = new Map();

    const persist = () => dataStore.setItem(KEY, JSON.stringify(state));
    const save = () => { state.updatedAt = Date.now(); persist(); scheduleAutoSync("syncdata"); };

    const findKey = (obj, name) => { const l = name.toLowerCase(); return Object.keys(obj).find((k) => k.toLowerCase() === l) || null; };
    const priceOf = (name) => { const k = findKey(state.prices, name); return k == null ? null : state.prices[k]; };
    const setPrice = (name, v) => { state.prices[findKey(state.prices, name) || name] = v; };
    const costOf = (i) => { const p = priceOf(i.name); return p == null ? null : p * unitCount(i.qty); };
    const listTotal = () => {
      let sum = 0, unk = 0;
      state.items.filter((i) => !doneIds.has(i.id)).forEach((i) => { const c = costOf(i); c == null ? unk++ : (sum += c); });
      return { sum, unk };
    };
    const onList = (name) => state.items.some((i) => i.name.toLowerCase() === name.toLowerCase());
    const cntOf = (n) => (state.history[n] || []).length;
    const avgInterval = (n) => {
      const t = [...(state.history[n] || [])].sort((a, b) => a - b);
      if (t.length < 2) return null;
      let s = 0;
      for (let i = 1; i < t.length; i++) s += t[i] - t[i - 1];
      return s / (t.length - 1) / DAY;
    };
    const daysSince = (n) => (Date.now() - Math.max(...(state.history[n] || [0]))) / DAY;
    const stockList = () => Object.keys(state.history).filter((n) => !onList(n)).map((n) => {
      const iv = avgInterval(n);
      if (!iv || iv < 0.5) return null;
      const ds = daysSince(n);
      return { n, iv, ds, stock: Math.max(0, Math.min(1, 1 - ds / iv)) };
    }).filter(Boolean).sort((a, b) => a.stock - b.stock);
    const dueCount = () => stockList().filter((x) => x.stock <= 0.15).length;
    const histList = () => Object.keys(state.history).filter((n) => !onList(n)).sort((a, b) => cntOf(b) - cntOf(a));
    const sprFor = (name) => itemSprite(name) || guessAisle(name, state.learned);

    /* ---------- Aktionen ---------- */
    // Fügt einen Artikel hinzu (ohne zu speichern/rendern). true, wenn neu.
    function addItem(name, qty, price) {
      name = cap(norm(name));
      if (!name) return false;
      if (price != null) setPrice(name, price);
      if (onList(name)) return false;
      const id = newId();
      state.items.push({ id, name, qty: qty || "", aisle: guessAisle(name, state.learned) });
      freshIds.add(id);
      return true;
    }
    function addRaw(raw) {
      let price = null;
      const pm = raw.trim().match(/^(.*\S)\s+(\d+[.,]\d{2})\s?€?$/); // "Butter 2,39" lernt den Preis gleich mit
      if (pm) { raw = pm[1]; price = parseFloat(pm[2].replace(",", ".")); }
      const { qty, name } = parseQty(raw);
      if (!name) return;
      addItem(name, qty, price);
      save();
      render();
    }
    function toggleCheck(id) {
      const it = state.items.find((i) => i.id === id);
      if (!it) return;
      if (doneIds.has(id)) { // nochmal angetippt: Abhaken zurücknehmen
        clearTimeout(timers.get(id)); timers.delete(id); doneIds.delete(id);
        return render();
      }
      doneIds.add(id);
      const row = root.querySelector(`[data-row="${CSS.escape(id)}"]`);
      if (xp) xp.award("shop:" + id, 2, row && row.querySelector("input[type=checkbox]")); // Level-System: Einkaufsartikel = 2 XP
      if (row) {
        row.classList.add("done");
        const c = costOf(it), fx = document.createElement("div");
        fx.className = "shop-coinfx";
        fx.innerHTML = spr("coin", 14) + (c == null ? "✓" : "−" + fmt(c));
        row.appendChild(fx);
        setTimeout(() => fx.remove(), 850);
      }
      renderCoins();
      timers.set(id, setTimeout(() => {
        timers.delete(id); doneIds.delete(id);
        const cur = state.items.find((i) => i.id === id);
        if (!cur) return render();
        const k = findKey(state.history, cur.name) || cur.name;
        (state.history[k] = state.history[k] || []).push(Date.now());
        state.history[k] = state.history[k].slice(-12);
        const keys = Object.keys(state.history);
        if (keys.length > 400) { // Verlauf begrenzen: am längsten nicht gekaufte Artikel zuerst weg
          keys.sort((a, b) => Math.max(...state.history[a]) - Math.max(...state.history[b])).slice(0, keys.length - 400).forEach((x) => delete state.history[x]);
        }
        state.items = state.items.filter((i) => i.id !== id);
        save();
        render();
      }, 600));
    }

    /* ---------- Darstellung ---------- */
    function renderCoins() {
      const t = listTotal();
      $("shopCoinN").textContent = fmt(t.sum) + (t.unk ? ` +${t.unk}?` : "");
      $("shopCoinN").title = t.unk ? `${t.unk} Artikel ohne Preis, Preis-Button in der Zeile antippen` : "Alle Preise bekannt";
    }
    function renderList() {
      const row = (i) => {
        const c = costOf(i), done = doneIds.has(i.id);
        return `<div class="shop-row ${done ? "done" : ""} ${freshIds.has(i.id) ? "pop" : ""}" data-row="${esc(i.id)}"><input type="checkbox" data-c="${esc(i.id)}" ${done ? "checked" : ""} aria-label="${esc(i.name)} abhaken">${spr(itemSprite(i.name) || i.aisle, 20)}<span class="t">${esc(i.name)}</span>${i.qty ? `<span class="q">${esc(i.qty)}</span>` : ""}<button class="pr ${c == null ? "unk" : ""}" data-p="${esc(i.id)}" title="Preis ändern" type="button">${c == null ? "? €" : fmt(c)}</button><button class="catbtn" data-m="${esc(i.id)}" aria-label="Gang ändern" title="Gang ändern" type="button">${spr("scroll", 14)}</button><button class="ghost" data-r="${esc(i.id)}" aria-label="Entfernen" type="button">×</button><div class="shop-menu" data-menu="${esc(i.id)}" hidden>${AISLES.map((a) => `<button type="button" data-set="${esc(i.id)}|${a.id}">${spr(a.id, 18)}${a.label}</button>`).join("")}</div></div>`;
      };
      $("shopPaneList").innerHTML = state.items.length
        ? AISLES.map((a) => {
            const g = state.items.filter((i) => i.aisle === a.id);
            return g.length ? `<details class="aisle" data-a="${a.id}" ${closed.has(a.id) ? "" : "open"}><summary>${spr(a.id, 18)}${a.label.toUpperCase()}<em>${g.length}</em></summary>${g.map(row).join("")}</details>` : "";
          }).join("")
        : `<p class="empty">Die Liste ist leer. Tippe oben einen Artikel ein, oder nimm etwas aus „Inventar“ oder „Rezepte“.</p>`;
      freshIds.clear();
      if (openMenu) { const m = root.querySelector(`[data-menu="${CSS.escape(openMenu)}"]`); if (m) m.hidden = false; }
    }
    function renderTabs() {
      const d = dueCount();
      const defs = [["list", "scroll", "LISTE", state.items.length], ["hist", "chest", "INVENTAR", histList().length], ["due", "heart", "VORRAT", d], ["tpl", "pot", "REZEPTE", state.dishes.length]];
      $("shopTabs").innerHTML = defs.map(([id, ic, l, n]) => `<button class="tab px ${id === "due" && d ? "alert" : ""}" role="tab" data-tab="${id}" aria-selected="${tab === id}" type="button">${spr(ic, 16)}${l}<b>${n}</b></button>`).join("");
      ["List", "Hist", "Due", "Tpl"].forEach((id) => { $("shopPane" + id).hidden = tab !== id.toLowerCase(); });
    }
    function renderOthers() {
      const h = histList();
      $("shopHist").innerHTML = h.length
        ? h.map((n) => `<div class="slot" data-h="${esc(n)}" tabindex="0" role="button" aria-label="${esc(n)} hinzufügen"><span class="cnt">${cntOf(n)}×</span><button class="fx" data-f="${esc(n)}" title="Vergessen" aria-label="${esc(n)} vergessen" type="button">×</button>${spr(sprFor(n), 30)}<span class="nm">${esc(n)}</span><span class="pp">${priceOf(n) != null ? fmt(priceOf(n)) : "–"}</span></div>`).join("")
        : `<p class="empty">Das Inventar ist noch leer. Alles, was du abhakst, landet hier und lässt sich mit einem Tipp wieder hinzufügen.</p>`;
      const sl = stockList().slice(0, 8);
      $("shopDue").innerHTML = sl.length
        ? sl.map((x) => {
            const low = x.stock <= 0.15, filled = Math.ceil(x.stock * 10), col = x.stock > 0.5 ? "var(--s-ok)" : x.stock > 0.25 ? "var(--s-warn)" : "var(--s-bad)";
            const left = Math.max(0, Math.round(x.iv - x.ds));
            return `<div class="stock ${low ? "low" : ""}"><span class="hrt">${spr("heart", 16)}</span><span class="nm">${esc(x.n)}</span><div class="segs" style="--c:${col}">${Array.from({ length: 10 }, (_, k) => `<span class="seg ${k < filled ? "on" : ""}"></span>`).join("")}</div><span class="lbl">${low ? "LEER!" : "~" + left + " T"}</span><button class="pbtn px small" data-h="${esc(x.n)}" type="button" aria-label="${esc(x.n)} hinzufügen">+</button></div>`;
          }).join("")
        : `<p class="empty">Noch zu wenig Kaufdaten. Sobald du etwas mindestens zweimal gekauft hast, erscheint hier eine Vorrats-Leiste.</p>`;
      $("shopTpl").innerHTML = state.dishes.length
        ? state.dishes.map((x, i) => {
            let s = 0, u = 0;
            x.items.forEach((n) => { const p = priceOf(n); p == null ? u++ : (s += p); });
            return `<div class="dish"><div class="dish-top"><button class="name" data-dt="${i}" type="button">${spr("pot", 20)}${esc(x.name)}</button><span class="dish-price ${u ? "unk" : ""}" title="Geschätzter Preis aller Zutaten">≈ ${fmt(s)}${u ? ` +${u}?` : ""}</span><button class="pbtn px small craft" data-t="${i}" type="button">${spr("star", 12)}CRAFT</button><button class="ghost" data-dd="${i}" aria-label="Rezept löschen" type="button">×</button></div><div class="ing">${x.items.map((n) => `<span title="${esc(n)}">${spr(sprFor(n), 16)}</span>`).join("")}</div><p class="ing-names" ${openDishes.has(i) ? "" : "hidden"}>${x.items.map(esc).join(" · ")}</p></div>`;
          }).join("")
        : `<p class="empty">Noch kein Rezept. Lege unten eins an oder speichere die aktuelle Liste als Rezept.</p>`;
    }
    function render() {
      renderList(); renderTabs(); renderOthers(); renderCoins();
      $("shopCard").classList.toggle("store", storeMode);
      $("shopStoreBtn").classList.toggle("on", storeMode);
      if (storeMode && tab !== "list") { tab = "list"; renderTabs(); }
    }

    /* ---------- Ereignisse ---------- */
    root.addEventListener("click", (e) => {
      const t = e.target, ds = t.dataset;
      if (openMenu && !t.closest(".shop-menu") && !t.closest("[data-m]")) { openMenu = null; root.querySelectorAll(".shop-menu").forEach((m) => (m.hidden = true)); }
      if (ds.f) { e.stopPropagation(); delete state.history[ds.f]; save(); return render(); }
      const tb = t.closest("[data-tab]"); if (tb) { tab = tb.dataset.tab; return render(); }
      const h = t.closest("[data-h]"); if (h) return addRaw(h.dataset.h); // bleibt im aktuellen Reiter, damit mehrere Artikel nacheinander antippbar sind
      const tp = t.closest("[data-t]");
      if (tp) {
        const d = state.dishes[+tp.dataset.t];
        if (d) { d.items.forEach((n) => addItem(n, "", null)); save(); tab = "list"; render(); }
        return;
      }
      const dt = t.closest("[data-dt]"); if (dt) { const i = +dt.dataset.dt; openDishes.has(i) ? openDishes.delete(i) : openDishes.add(i); return render(); }
      const dd = t.closest("[data-dd]"); if (dd) { state.dishes.splice(+dd.dataset.dd, 1); openDishes.clear(); save(); return render(); }
      const pb = t.closest("[data-p]");
      if (pb) {
        const it = state.items.find((i) => i.id === pb.dataset.p);
        if (!it) return;
        const inp = document.createElement("input");
        inp.className = "prin"; inp.inputMode = "decimal"; inp.placeholder = "z.B. 1,29";
        inp.setAttribute("aria-label", `Preis pro Stück für ${it.name}`);
        pb.replaceWith(inp); inp.focus();
        let finished = false;
        const finish = (commit) => {
          if (finished) return;
          finished = true;
          const v = parseFloat(inp.value.replace(",", ".").replace("€", ""));
          if (commit && !isNaN(v) && v >= 0) { setPrice(it.name, v); save(); }
          render();
        };
        inp.addEventListener("keydown", (ev) => { if (ev.key === "Enter") finish(true); if (ev.key === "Escape") finish(false); });
        inp.addEventListener("blur", () => finish(true));
        return;
      }
      const r = t.closest("[data-r]"); if (r) { state.items = state.items.filter((i) => i.id !== r.dataset.r); save(); return render(); }
      const m = t.closest("[data-m]"); if (m) { openMenu = openMenu === m.dataset.m ? null : m.dataset.m; return renderList(); }
      const st = t.closest("[data-set]");
      if (st) {
        const [id, a] = st.dataset.set.split("|");
        const it = state.items.find((i) => i.id === id);
        if (it && AISLE_IDS.has(a)) { it.aisle = a; state.learned[it.name.toLowerCase()] = a; save(); } // Gang wird für diesen Artikel gemerkt
        openMenu = null;
        return render();
      }
    });
    root.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("slot")) { e.preventDefault(); addRaw(e.target.dataset.h); }
    });
    root.addEventListener("toggle", (e) => { const a = e.target.dataset && e.target.dataset.a; if (a) e.target.open ? closed.delete(a) : closed.add(a); }, true);
    root.addEventListener("change", (e) => { if (e.target.dataset.c) toggleCheck(e.target.dataset.c); });

    const inp = $("shopInp");
    $("shopAddBtn").addEventListener("click", () => { addRaw(inp.value); inp.value = ""; $("shopAc").innerHTML = ""; tab = "list"; render(); });
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter") $("shopAddBtn").click(); });
    inp.addEventListener("input", () => {
      const q = parseQty(inp.value.replace(/\s+\d+[.,]\d{2}\s?€?$/, "")).name.toLowerCase();
      const hits = !q ? [] : Object.keys(state.history).filter((n) => n.toLowerCase().startsWith(q) && !onList(n)).sort((a, b) => cntOf(b) - cntOf(a)).slice(0, 5);
      $("shopAc").innerHTML = hits.map((n) => `<button class="s-chip" data-h="${esc(n)}" type="button">${spr(sprFor(n), 14)}${esc(n)}<small>${cntOf(n)}×</small></button>`).join("");
    });
    $("shopReadd").addEventListener("click", () => { histList().filter((n) => cntOf(n) >= 3).forEach((n) => addItem(n, "", null)); save(); tab = "list"; render(); });
    $("shopStoreBtn").addEventListener("click", () => { storeMode = !storeMode; render(); });
    $("shopDAdd").addEventListener("click", () => {
      const name = norm($("shopDName").value), ing = $("shopDIng").value.split(",").map((s) => cap(norm(s))).filter(Boolean);
      if (!name || !ing.length || state.dishes.length >= 60) return;
      state.dishes.push({ name, items: ing }); $("shopDName").value = $("shopDIng").value = ""; save(); render();
    });
    $("shopDFromList").addEventListener("click", () => {
      if (!state.items.length || state.dishes.length >= 60) return;
      const name = norm($("shopDName").value) || "Mein Rezept";
      state.dishes.push({ name, items: state.items.map((i) => i.name) }); $("shopDName").value = ""; save(); render();
    });

    // Handy: zwischen den vier Reitern wischen, in der Liste eine Zeile nach rechts wischen = abhaken
    const TAB_ORDER = ["list", "hist", "due", "tpl"];
    const stepTab = (d) => {
      if (storeMode) return;
      const i = TAB_ORDER.indexOf(tab) + d;
      if (i < 0 || i >= TAB_ORDER.length) return;
      tab = TAB_ORDER[i];
      render();
    };
    attachSwipe($("shopCard"), { onLeft: () => stepTab(1), onRight: () => stepTab(-1), ignore: ".tabs, .shop-menu, input", rightIgnore: ".shop-row" });
    attachRowSwipe($("shopPaneList"), ".shop-row", (r) => toggleCheck(r.dataset.row));

    $("shopCartSpr").innerHTML = spr("cart", 30);
    $("shopCoinSpr").innerHTML = spr("coin", 16);
    $("shopCatGrid").innerHTML = ITEM_SPRITES.map(([k, label]) => `<div class="cat-cell">${spr(k, 28)}<span>${label}</span></div>`).join("");
    $("shopCatN").textContent = ITEM_SPRITES.length;
    render();

    return {
      render,
      // Cloud-Stand übernehmen (gleiche Regeln wie bei den anderen Feldern, siehe remoteWins);
      // wird mit dem Cloud-Zeitstempel abgelegt, ohne Rück-Push
      applyRemote(remote) {
        if (!remote) return;
        const r = sanitize(remote, newId);
        // Einmal eingegebene Preise (und gemerkte Gänge) sind dauerhaft: egal welche Seite gewinnt, es wird
        // immer vereinigt. Es gibt keine Funktion, die einen Preis löscht, also kann nichts versehentlich
        // verloren gehen, auch nicht bei gleichzeitigen Änderungen auf zwei Geräten. Bei gleichem Artikel
        // gilt der Wert der gewinnenden Seite.
        const union = (into, from, lower) => {
          Object.entries(from).forEach(([k, v]) => {
            const lk = k.toLowerCase();
            if (!Object.keys(into).some((x) => x.toLowerCase() === lk)) into[lower ? lk : k] = v;
          });
        };
        if (!remoteWins(r.updatedAt, state.updatedAt, hasContent(r), hasContent(state))) {
          const before = Object.keys(state.prices).length + Object.keys(state.learned).length;
          union(state.prices, r.prices, false);
          union(state.learned, r.learned, true);
          if (Object.keys(state.prices).length + Object.keys(state.learned).length !== before) { persist(); scheduleAutoSync("syncdata"); }
          return;
        }
        const old = state;
        state = r;
        const missing = Object.keys(old.prices).length + Object.keys(old.learned).length;
        union(state.prices, old.prices, false);
        union(state.learned, old.learned, true);
        persist();
        if (missing && (Object.keys(state.prices).length > Object.keys(r.prices).length || Object.keys(state.learned).length > Object.keys(r.learned).length)) scheduleAutoSync("syncdata");
        const ids = new Set(state.items.map((i) => i.id));
        [...doneIds].forEach((id) => { if (!ids.has(id)) doneIds.delete(id); });
        render();
      },
      // Für den Push nach sync-data.json; -1 ("nie gespeichert") auf 0 normalisieren
      payload() {
        return { items: state.items, history: state.history, prices: state.prices, learned: state.learned, dishes: state.dishes, updatedAt: Math.max(0, state.updatedAt) };
      }
    };
  };
})();
