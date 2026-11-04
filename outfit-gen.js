/* Outfits (Bereich "Outfits"), Teil 6: Generator. Baut aus den Teilen im Schrank Outfits, die zusammenpassen: Farben nach drei Farbfuehrern
   (Michael 84 "Matching clothing with colours", A Pair & A Spare "Neutral outfit colour guide", "Best color combinations for men's outfits"),
   dazu Stil (Formalitaet), Anlass, Wetter (Schichten und Waerme), Muster und Rotation. Kein Zufall im Kern: gewuerfelt wird nur unter den besten Kombinationen.
   O.gen = { build(opts), famOf(hex), pair(famA, famB), FAM_LABEL, TEMPS, targetFormal(occ, items) }. Reine Rechnung, keine Oberflaeche. */
(function () {
  "use strict";
  const O = window.Outfit;
  if (!O || !O.color || !O.data || !O.util) return;
  const Co = O.color, clamp = O.util.clamp;

  /* ==========================================================================
     Farben: Name aus O.color.NAMED -> Farbfamilie des Farbfuehrers
     ========================================================================== */
  const FAM_OF_NAME = { "Schwarz": "black", "Anthrazit": "charcoal", "Grau": "grey", "Hellgrau": "lightgrey", "Weiß": "white", "Creme": "cream", "Beige": "beige", "Sand": "beige", "Camel": "tan", "Braun": "brown", "Dunkelbraun": "brown", "Khaki": "khaki", "Oliv": "olive", "Dunkelgrün": "green", "Grün": "green", "Mint": "green", "Türkis": "teal", "Petrol": "teal", "Hellblau": "lightblue", "Blau": "blue", "Royalblau": "blue", "Navy": "navy", "Denim": "denim", "Lila": "purple", "Flieder": "purple", "Rosa": "pink", "Pink": "pink", "Rot": "red", "Bordeaux": "burgundy", "Orange": "orange", "Rost": "brown", "Senf": "yellow", "Gelb": "yellow" };
  const FAM_LABEL = { black: "Schwarz", charcoal: "Anthrazit", grey: "Grau", lightgrey: "Hellgrau", white: "Weiß", cream: "Creme", beige: "Beige", tan: "Camel", brown: "Braun", khaki: "Khaki", olive: "Oliv", green: "Grün", teal: "Petrol", navy: "Navy", denim: "Denim", blue: "Blau", lightblue: "Hellblau", purple: "Lila", pink: "Rosa", red: "Rot", burgundy: "Bordeaux", orange: "Orange", yellow: "Gelb" };
  const NEUTRAL = new Set(["black", "charcoal", "grey", "lightgrey", "white", "cream", "beige", "tan", "brown", "khaki", "olive", "navy", "denim"]);
  const ACCENT = new Set(["red", "burgundy", "orange", "yellow", "green", "teal", "blue", "pink", "purple"]);
  /* Familien, die in einem Farbfuehrer unter anderem Namen stehen */
  const ALIAS = { red: [["burgundy", 1]], burgundy: [["red", 1]], cream: [["beige", 0.95], ["white", 0.6]], lightgrey: [["grey", 0.95], ["white", 0.7]], charcoal: [["grey", 0.9], ["black", 0.85]], tan: [["beige", 0.9]], khaki: [["olive", 0.95], ["beige", 0.7]], denim: [["navy", 0.9], ["blue", 0.85]], teal: [["green", 0.7], ["blue", 0.7]] };

  /* Farbfuehrer 1 (Michael 84): Hauptfarbe -> passende Farben, und "muted/tonal" */
  const G1 = {
    black: ["burgundy", "navy", "grey", "white", "lightblue"], navy: ["black", "beige", "grey", "white"], grey: ["black", "navy", "pink", "white", "burgundy"],
    beige: ["black", "navy", "green", "brown", "burgundy"], white: ["black", "navy", "grey", "green"], green: ["black", "lightblue", "grey", "yellow"],
    blue: ["black", "beige", "yellow", "white", "lightblue"], lightblue: ["black", "navy", "grey", "yellow", "beige"], purple: ["black", "beige", "grey", "white", "lightblue"],
    burgundy: ["black", "navy", "grey", "white", "beige"], orange: ["black", "yellow", "grey", "white", "beige"], yellow: ["black", "green", "grey", "white", "pink"],
    brown: ["black", "navy", "grey", "white", "lightblue"], pink: ["black", "navy", "grey", "white", "lightblue"]
  };
  const G1T = { black: ["grey", "lightgrey"], navy: ["blue", "lightblue"], grey: ["lightgrey", "charcoal"], beige: ["tan", "brown"], white: ["lightgrey", "grey"], blue: ["lightblue", "navy"], lightblue: ["blue", "navy"], burgundy: ["red", "orange"], orange: ["yellow"], yellow: ["orange"], brown: ["tan", "beige"], pink: ["red"] };
  /* Farbfuehrer 2 (A Pair & A Spare, Neutrals): tonal und kontrastierend */
  const G2T = { white: ["cream", "lightgrey"], cream: ["white", "beige", "tan"], beige: ["cream", "tan", "white"], tan: ["beige", "cream"], khaki: ["olive"], olive: ["khaki"], grey: ["white", "charcoal", "black"], charcoal: ["white", "grey", "black"], black: ["grey", "charcoal"] };
  const G2C = { white: ["cream", "beige", "tan", "khaki", "black", "charcoal"], cream: ["beige", "olive", "khaki", "charcoal", "black", "white"], beige: ["white", "olive", "grey", "charcoal", "black"], tan: ["white", "cream", "black"], khaki: ["white", "cream", "beige", "brown", "black"], olive: ["white", "cream", "beige", "black", "charcoal"], grey: ["beige", "olive"], charcoal: ["cream", "beige", "tan"], black: ["cream", "beige", "tan", "olive", "white"] };
  /* Farbfuehrer 3 (Best color combinations for men's outfits) */
  const G3 = {
    white: ["navy", "beige", "black", "olive", "grey"], black: ["white", "grey", "beige", "olive", "navy"], navy: ["white", "beige", "lightblue", "grey", "olive"], grey: ["white", "black", "navy", "beige", "burgundy"],
    beige: ["white", "navy", "olive", "brown", "lightblue"], khaki: ["white", "navy", "olive", "brown", "lightblue"], olive: ["white", "beige", "navy", "brown", "black"], lightblue: ["white", "navy", "beige", "grey", "brown"], brown: ["beige", "cream", "navy", "olive", "grey"]
  };

  /* LINK["a|b"] = { n: in wie vielen der drei Farbfuehrer das Paar steht, tonal: steht als "tonal" } (ungeordnet) */
  const LINK = Object.create(null);
  const key = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  function add(src, a, b, tonal) {
    const k = key(a, b), l = LINK[k] || (LINK[k] = { n: 0, tonal: false, src: {} });
    if (!l.src[src]) { l.src[src] = 1; l.n++; }
    if (tonal) l.tonal = true;
  }
  const addAll = (src, tbl, tonal) => Object.keys(tbl).forEach((a) => tbl[a].forEach((b) => { if (a !== b) add(src, a, b, tonal); }));
  addAll("g1", G1, false); addAll("g1", G1T, true); addAll("g2", G2T, true); addAll("g2", G2C, false); addAll("g3", G3, false);

  const famOf = (hex) => FAM_OF_NAME[Co.nameOf(hex)] || "grey";
  /* Wert 0..1, wie gut zwei Familien laut Farbfuehrer zusammenpassen (Alias-Familien zaehlen leicht abgeschwaechelt) */
  function pairBase(a, b) {
    if (a === b) return NEUTRAL.has(a) ? 0.72 : 0.5; /* ein Ton in Ton */
    const l = LINK[key(a, b)];
    if (l) return Math.min(1, 0.55 + 0.15 * l.n + (l.tonal ? 0.04 : 0));
    return NEUTRAL.has(a) && NEUTRAL.has(b) ? 0.5 : 0.15;
  }
  const memo = Object.create(null);
  function pair(a, b) {
    const k = key(a, b); if (k in memo) return memo[k];
    let best = pairBase(a, b);
    const A = [[a, 1]].concat(ALIAS[a] || []), B = [[b, 1]].concat(ALIAS[b] || []);
    A.forEach(([x, wx]) => B.forEach(([y, wy]) => { if (x === a && y === b) return; const v = pairBase(x, y) * wx * wy; if (v > best) best = v; }));
    return (memo[k] = best);
  }
  /* Wodurch ein Paar gut ist (fuer die Begruendung): "tonal", "kontrast" oder "" */
  const relation = (a, b) => { if (a === b) return "tonal"; const l = LINK[key(a, b)]; if (l) return l.tonal && l.n === 1 ? "tonal" : "kontrast"; return ""; };

  /* ==========================================================================
     Anlass, Wetter
     ========================================================================== */
  const TEMPS = { kalt: { label: "KALT", hint: "bis 5°", band: [5.8, 10], bottom: [3, 5] }, kuehl: { label: "KÜHL", hint: "6–12°", band: [4.2, 7], bottom: [2, 5] }, mild: { label: "MILD", hint: "13–19°", band: [2.6, 4.8], bottom: [1, 4] }, warm: { label: "WARM", hint: "20–26°", band: [1.3, 2.6], bottom: [1, 3] }, heiss: { label: "HEISS", hint: "ab 27°", band: [0.8, 2], bottom: [1, 2] } };
  /* wie wichtig Anlass und Stil sind: bei Anlaessen mit Kleiderordnung zaehlt die Formalitaet mehr */
  const STRICT = { formell: 1, arbeit: 1, date: 1 };
  /* Ziel-Formalitaet je Anlass (Name, ohne Gross/Klein); fuer eigene Anlaesse: Mittel der damit markierten Teile */
  const OCC_FORMAL = { alltag: [2, 1, 3], arbeit: [3, 2, 4], sport: [1, 1, 2], date: [3.5, 3, 4.5], party: [3, 2, 4], formell: [4.5, 4, 5], reisen: [2, 1, 3] };
  function targetFormal(occ, items) {
    const k = String(occ || "").toLowerCase();
    if (OCC_FORMAL[k]) return { t: OCC_FORMAL[k][0], lo: OCC_FORMAL[k][1], hi: OCC_FORMAL[k][2] };
    const tagged = (items || []).filter((i) => (i.occ || []).indexOf(occ) >= 0);
    if (tagged.length >= 3) { const m = tagged.reduce((s, i) => s + i.formal, 0) / tagged.length; return { t: m, lo: m - 1, hi: m + 1 }; }
    return { t: 2.5, lo: 1, hi: 4 };
  }
  /* Teile, die zum Wetter keinen Sinn machen, kommen gar nicht erst in Frage (ein vom Nutzer gewaehltes Startteil bleibt immer erlaubt) */
  const COLD_ONLY = new Set(["scarf", "gloves"]), HEAT_ONLY = new Set(["shorts", "sandals"]);
  function okFor(m, temp) {
    const c = m.it.cat, hot = temp === "warm" || temp === "heiss", cold = temp === "kalt" || temp === "kuehl";
    if (COLD_ONLY.has(c)) return cold;
    if (HEAT_ONLY.has(c)) return hot;
    if (c === "coat") return !hot;
    if (c === "boots" && temp === "heiss") return false;
    if (m.slot === "outer" && temp === "heiss" && c !== "rain") return false;
    return true;
  }
  const PATTERN_RE = /kariert|karo|streif|muster|gemustert|print|plaid|check|geblümt|punkte|camo/i;
  const ALONE_OK = new Set(["tshirt", "longsleeve", "shirt", "polo", "knit", "hoodie"]);
  const WEIGHT = { inner: 1, mid: 0.8, outer: 0.7 };

  /* ==========================================================================
     Aufbereiten der Teile
     ========================================================================== */
  function prep(items, ctx) {
    const meta = new Map();
    items.forEach((it) => {
      const slot = ctx.slotOf(it.cat), layer = ctx.layerOf(it);
      const cols = (it.colors || []).slice(0, 3), W = [0.6, 0.28, 0.12];
      const acc = Object.create(null);
      cols.forEach((c, i) => { const f = famOf(c); acc[f] = (acc[f] || 0) + W[i]; });
      let fams = Object.keys(acc).map((f) => [f, acc[f]]).sort((a, b) => b[1] - a[1]);
      if (!fams.length) fams = [["grey", 1]];
      const tot = fams.reduce((s, x) => s + x[1], 0); fams = fams.map((x) => [x[0], x[1] / tot]);
      meta.set(it.id, { it, slot, layer, fams, main: fams[0][0], pattern: PATTERN_RE.test(it.name || ""), formal: it.formal || 2, warmth: it.warmth || 2, occ: new Set(it.occ || []) });
    });
    return meta;
  }
  /* Farbwert zwischen zwei Teilen: gewichtetes Mittel ueber ihre Farbfamilien */
  function itemPair(a, b) {
    let s = 0;
    a.fams.forEach(([fa, wa]) => b.fams.forEach(([fb, wb]) => { s += wa * wb * pair(fa, fb); }));
    return s;
  }

  /* ==========================================================================
     Bewertung eines kompletten Outfits
     parts: { inner, mid, outer, bottom, shoes, acc, dress } (Meta-Eintraege oder null)
     ========================================================================== */
  function score(parts, p) {
    const upper = [parts.inner, parts.mid, parts.outer].filter(Boolean), low = parts.dress ? [parts.dress] : [parts.bottom].filter(Boolean);
    const main = upper.concat(low).concat(parts.shoes ? [parts.shoes] : []);
    const all = main.concat(parts.acc ? [parts.acc] : []);
    /* Farbe: gewichtete Paare (sichtbares Oberteil x Unterteil am wichtigsten) */
    const vis = parts.outer && p.temp !== "heiss" && p.temp !== "warm" ? parts.outer : null; /* eine Jacke ueberdeckt das Oberteil nur zum Teil */
    const pairs = []; /* [a, b, Gewicht] */
    const top = parts.mid || parts.inner || parts.dress, bot = parts.bottom || parts.dress;
    if (top && parts.bottom) pairs.push([top, parts.bottom, 3]);
    if (parts.inner && parts.mid) pairs.push([parts.inner, parts.mid, 1.6]);
    if (parts.outer && parts.bottom) pairs.push([parts.outer, parts.bottom, 2]);
    if (parts.outer && top && top !== parts.outer) pairs.push([parts.outer, top, 1.6]);
    if (parts.shoes && bot) pairs.push([parts.shoes, bot, 1.4]);
    if (parts.shoes && top && parts.shoes !== bot) pairs.push([parts.shoes, top, 0.5]);
    if (parts.acc) { const t0 = parts.outer || top; if (t0) pairs.push([parts.acc, t0, 0.8]); if (bot && bot !== t0) pairs.push([parts.acc, bot, 0.4]); }
    let cw = 0, cs = 0; const rels = [];
    pairs.forEach(([a, b, w]) => { const v = itemPair(a, b); cs += v * w; cw += w; rels.push({ a, b, v, w }); });
    let colour = cw ? cs / cw : 0.7;
    /* mehr als ein Farbtupfer ohne Fuehrer-Eintrag: Abzug; ein Tupfer ist in Ordnung */
    const accents = []; all.forEach((m) => m.fams.forEach(([f, w]) => { if (ACCENT.has(f) && w >= 0.25 && accents.indexOf(f) < 0) accents.push(f); }));
    if (accents.length > 1) { let ok = true; for (let i = 1; i < accents.length; i++) if (pair(accents[0], accents[i]) < 0.7) ok = false; if (!ok) colour -= 0.12 * (accents.length - 1); }
    const patterns = all.filter((m) => m.pattern).length; if (patterns > 1) colour -= 0.18 * (patterns - 1);
    colour = clamp(colour, 0, 1);
    /* Stil: Formalitaet stimmig (Abstand zwischen hoechstem und niedrigstem Teil) */
    const shown = parts.mid && parts.inner ? main.filter((m) => m !== parts.inner) : main; /* ein Basisteil unter einem Mid-Teil sieht man kaum */
    const fo = shown.map((m) => m.formal), spread = fo.length ? Math.max.apply(null, fo) - Math.min.apply(null, fo) : 0;
    const style = [1, 1, 0.62, 0.28, 0, 0][Math.min(5, Math.round(spread))];
    const avgF = fo.length ? fo.reduce((s, v) => s + v, 0) / fo.length : 2;
    /* Anlass: Teile mit dem Anlass markiert + Naehe zur Ziel-Formalitaet */
    const tf = p.tf, tag = p.occ ? main.filter((m) => m.occ.has(p.occ)).length / Math.max(1, main.length) : 1;
    const strict = !!STRICT[String(p.occ || "").toLowerCase()];
    let fit = 1 - Math.abs(avgF - tf.t) / 3;
    shown.forEach((m) => { if (m.formal < tf.lo - 1 || m.formal > tf.hi + 1) fit -= 0.2; else if (m.formal < tf.lo || m.formal > tf.hi) fit -= strict ? 0.2 : 0.08; });
    const occ = clamp(0.25 * tag + 0.75 * clamp(fit, 0, 1), 0, 1);
    /* Wetter: Waerme der Schichten und des Unterteils */
    const T = TEMPS[p.temp] || TEMPS.mild;
    let sw = 0; if (parts.dress) sw = parts.dress.warmth * WEIGHT.inner; else { if (parts.inner) sw += parts.inner.warmth * WEIGHT.inner; if (parts.mid) sw += parts.mid.warmth * WEIGHT.mid; }
    if (parts.outer) sw += parts.outer.warmth * WEIGHT.outer;
    const out = sw < T.band[0] ? T.band[0] - sw : sw > T.band[1] ? sw - T.band[1] : 0;
    let weather = clamp(1 - 0.28 * out, 0, 1);
    if (parts.bottom) { const bw = parts.bottom.warmth; if (bw < T.bottom[0] || bw > T.bottom[1]) weather *= 0.8; }
    if (p.rain) { if (parts.outer) weather = Math.min(1, weather + (parts.outer.it.cat === "rain" ? 0.1 : 0.02)); else weather *= 0.94; }
    /* Rotation und Lieblinge */
    let rot = 1; all.forEach((m) => { if (p.recent && p.recent.has(m.it.id)) rot -= 0.25; rot -= Math.min(0.2, (m.it.wears || 0) * 0.02); if (m.it.fav) rot += 0.08; }); rot = clamp(rot, 0, 1.2);
    const W = STRICT[String(p.occ || "").toLowerCase()] ? [0.28, 0.14, 0.30, 0.20, 0.08] : [0.33, 0.17, 0.18, 0.22, 0.10];
    const total = W[0] * colour + W[1] * style + W[2] * occ + W[3] * weather + W[4] * Math.min(1, rot) + (rot > 1 ? 0.02 : 0);
    return { total, colour, style, occ, weather, rot, avgF, sw, spread, rels, accents, patterns };
  }

  /* ==========================================================================
     Suche: Schichten -> mit Unterteil -> mit Schuhen -> Kleinteil, jeweils nur die besten behalten
     opts: { items, slotOf, layerOf, occ, temp, anchor (Teil-ID), count, rng (Funktion 0..1), recent (Set), avoid (Set von Schluesseln), allowDirty }
     ========================================================================== */
  function build(opts) {
    const items = (opts.items || []).filter((i) => !i.del && (opts.allowDirty || !i.dirty));
    const ctx = { slotOf: opts.slotOf, layerOf: opts.layerOf };
    const meta = prep(items, ctx);
    const p = { occ: opts.occ || "", temp: TEMPS[opts.temp] ? opts.temp : "mild", tf: targetFormal(opts.occ, items), recent: opts.recent || null, rain: !!opts.rain };
    const M = Array.from(meta.values()).filter((m) => okFor(m, p.temp) || m.it.id === opts.anchor);
    const rng = opts.rng || (() => 0), noise = () => (rng() - 0.5) * 0.08;
    const bySlot = (f) => M.filter(f);
    const inner = bySlot((m) => (m.layer === "base" && m.slot === "top") || (m.layer === "base" && m.slot === "mid") || ((m.layer === "mid" || m.layer === "") && ALONE_OK.has(m.it.cat) && (m.slot === "top" || m.slot === "mid")));
    const mids = bySlot((m) => m.layer === "mid");
    const outers = bySlot((m) => m.layer === "outer");
    const dresses = bySlot((m) => m.slot === "dress");
    const bottoms = bySlot((m) => m.slot === "bottom");
    const shoes = bySlot((m) => m.slot === "shoes");
    const accs = bySlot((m) => m.slot === "acc" && m.it.cat !== "other");
    if (!(inner.length || dresses.length) || !(bottoms.length || dresses.length)) return { results: [], reason: !(inner.length || dresses.length) ? "Es fehlt ein Oberteil im Schrank." : "Es fehlt ein Unterteil (Hose, Rock) im Schrank." };
    const anchor = opts.anchor ? meta.get(opts.anchor) : null;
    const solo = (m) => { const tf = p.tf; let s = 1 - Math.abs(m.formal - tf.t) / 3; if (p.occ && m.occ.has(p.occ)) s += 0.25; if (m.it.fav) s += 0.1; if (p.recent && p.recent.has(m.it.id)) s -= 0.2; return s + noise(); };
    const top = (arr, n) => arr.map((m) => [m, solo(m)]).sort((a, b) => b[1] - a[1]).slice(0, n).map((x) => x[0]);
    const withAnchor = (arr, n) => { const t = top(arr, n); if (anchor && arr.indexOf(anchor) >= 0 && t.indexOf(anchor) < 0) t.push(anchor); return t; };
    const needs = { inner: !dresses.length || inner.length > 0 };
    const T = TEMPS[p.temp];

    /* 1) Schichten (oben) */
    const stacks = [];
    const pushStack = (st) => {
      const lays = [st.inner, st.mid, st.outer].filter(Boolean).map((m) => m.layer);
      if (new Set(lays).size !== lays.length) return; /* zwei Teile aus derselben Schicht: nein */
      if (anchor && [st.inner, st.mid, st.outer, st.dress].indexOf(anchor) < 0 && ["top", "mid", "outer", "dress"].indexOf(anchor.slot) >= 0) return;
      const part = Object.assign({ bottom: null, shoes: null, acc: null }, st);
      const s = score(Object.assign({}, part, { bottom: part.dress ? null : bottoms[0] || null }), p); /* grobe Vorbewertung nur ueber Waerme und Stil der Schichten */
      stacks.push({ st, pre: s.weather * 0.6 + s.style * 0.2 + Math.max(0, 1 - Math.abs((st.inner || st.dress || st.mid).formal - p.tf.t) / 3) * 0.2 + noise() });
    };
    const mid0 = [null].concat(withAnchor(mids, 12)), out0 = [null].concat(withAnchor(outers, 8));
    const BULKY = new Set(["knit", "hoodie", "cardigan"]);
    withAnchor(inner, 14).forEach((i) => mid0.forEach((m) => { if (m && (m === i || (BULKY.has(i.it.cat) && BULKY.has(m.it.cat)))) return; out0.forEach((o) => { if (o && (o === i || o === m)) return; pushStack({ inner: i, mid: m, outer: o }); }); }));
    withAnchor(dresses, 6).forEach((d) => out0.forEach((o) => pushStack({ dress: d, outer: o })));
    stacks.sort((a, b) => b.pre - a.pre);
    const topStacks = stacks.slice(0, 40).map((x) => x.st);

    /* 2) Unterteile, 3) Schuhe, 4) Kleinteil */
    const bots = withAnchor(bottoms, 14), shs = shoes.length ? withAnchor(shoes, 10) : [null];
    const full = [];
    topStacks.forEach((st) => (st.dress ? [null] : bots).forEach((b) => {
      if (anchor && ["bottom"].indexOf(anchor.slot) >= 0 && b !== anchor) return;
      shs.forEach((s) => {
        if (anchor && anchor.slot === "shoes" && s !== anchor) return;
        const parts = { inner: st.inner || null, mid: st.mid || null, outer: st.outer || null, dress: st.dress || null, bottom: b, shoes: s, acc: null };
        const sc = score(parts, p); full.push({ parts, sc, total: sc.total + noise() });
      });
    }));
    full.sort((a, b) => b.total - a.total);
    const cand = full.slice(0, 80);
    if (anchor && anchor.slot === "acc") {
      /* ein gewaehltes Kleinteil traegt jeder Vorschlag */
      cand.forEach((c) => { const parts = Object.assign({}, c.parts, { acc: anchor }), sc = score(parts, p); c.parts = parts; c.sc = sc; c.total = sc.total + noise(); });
      cand.sort((a, b) => b.total - a.total);
    } else if (accs.length) {
      const wantWarm = p.temp === "kalt" || p.temp === "kuehl";
      cand.forEach((c) => {
        if (rng() > 0.65) return; /* nicht jedes Outfit braucht ein Kleinteil */
        let best = null, bestT = c.total;
        top(accs, 8).forEach((a) => {
          if (wantWarm ? a.warmth < 3 : a.warmth > 3) return;
          if (a.formal > p.tf.hi + 1 || a.formal < p.tf.lo - 0.5) return; /* eine Cap passt nicht zum Anzug */
          const parts = Object.assign({}, c.parts, { acc: a }), sc = score(parts, p), t = sc.total + 0.012 + noise();
          if (t > bestT) { best = { parts, sc }; bestT = t; }
        });
        if (best) { c.parts = best.parts; c.sc = best.sc; c.total = bestT; }
      });
      cand.sort((a, b) => b.total - a.total);
    }

    /* 5) Auswahl mit Abstand: zwei Vorschlaege teilen hoechstens ein Kernteil */
    const idsOf = (c) => ["inner", "mid", "outer", "dress", "bottom", "shoes"].map((k) => c.parts[k] && c.parts[k].it.id).filter(Boolean);
    const keyOf = (c) => idsOf(c).sort().join("+") + (c.parts.acc ? "+" + c.parts.acc.it.id : "");
    const picked = [], want = opts.count || 3, floor = STRICT[String(p.occ || "").toLowerCase()] ? 0.7 : 0.4;
    for (const c of cand) {
      if (opts.avoid && opts.avoid.has(keyOf(c))) continue;
      if (c.sc.occ < floor && (opts.avoid || picked.length)) continue; /* passt nicht zum Anlass: nur als allererster Vorschlag, damit etwas zu sehen ist */
      if (picked.some((q) => idsOf(q).filter((id) => idsOf(c).indexOf(id) >= 0).length > Math.max(1, Math.floor(idsOf(c).length / 2)))) continue;
      picked.push(c); if (picked.length >= want) break;
    }
    return { results: picked.map((c) => finish(c, p)), temp: p.temp, occ: p.occ, weak: !!(picked.length && picked[0].sc.occ < floor) };
  }

  /* Ergebnis fuer die Oberflaeche: Teile (Reihenfolge Base, Mid, Outer, Unterteil, Schuhe, Kleinteil), Farben, Begruendung */
  function finish(c, p) {
    const order = ["inner", "mid", "outer", "dress", "bottom", "shoes", "acc"];
    const pieces = order.map((k) => (c.parts[k] ? { id: c.parts[k].it.id, role: k, slot: c.parts[k].slot, layer: c.parts[k].layer, fam: c.parts[k].main } : null)).filter(Boolean);
    const fams = []; pieces.forEach((q) => { if (fams.indexOf(q.fam) < 0) fams.push(q.fam); });
    /* staerkste Farbbeziehungen (sichtbares Oberteil x Unterteil zuerst) */
    const why = [];
    c.sc.rels.slice().sort((a, b) => b.w * b.v - a.w * a.v).forEach((r) => {
      const fa = r.a.main, fb = r.b.main; if (why.some((w) => (w.a === fa && w.b === fb) || (w.a === fb && w.b === fa))) return;
      const rel = relation(fa, fb), l = LINK[key(fa, fb)];
      if (r.v >= 0.7) why.push({ a: fa, b: fb, kind: rel || (NEUTRAL.has(fa) && NEUTRAL.has(fb) ? "neutral" : ""), n: l ? l.n : 0 });
    });
    return { pieces, fams, why: why.slice(0, 2), score: Math.round(c.sc.total * 100), parts: { colour: c.sc.colour, style: c.sc.style, occ: c.sc.occ, weather: c.sc.weather }, formal: Math.round(c.sc.avgF * 10) / 10, warmth: Math.round(c.sc.sw * 10) / 10, patterns: c.sc.patterns, key: pieces.filter((q) => q.role !== "acc").map((q) => q.id).sort().join("+") + (c.parts.acc ? "+" + c.parts.acc.it.id : "") };
  }

  O.gen = { build, famOf, pair, relation, FAM_LABEL, FAM_OF_NAME, NEUTRAL, ACCENT, TEMPS, targetFormal, LINK };
})();
