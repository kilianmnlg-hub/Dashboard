/* Outfits (Bereich "Outfits"), Teil 1: Daten. Farben, Kategorien, lokaler Speicher im Browser (IndexedDB) und Abgleich mit einem PRIVATEN GitHub-Repo.
   Warum ein zweites Repo: dieses Dashboard-Repo ist oeffentlich, Kleiderfotos duerfen dort nicht liegen. Standardname "outfit-daten" (gleicher Besitzer),
   geaendert werden kann er in den Einstellungen des Bereichs. Gleicher Token wie der Rest des Dashboards (dashboard-gh-token), er braucht Zugriff auf das Repo.
   Aufbau im Daten-Repo:  items.json (alle Teile, Kategorien, Anlaesse)  /  photos/<id>.webp (freigestelltes Foto)  /  thumbs/<id>.webp (Vorschaubild)
   Abgleich: pro Teil gewinnt der neuere Zeitstempel (upd), Loeschungen bleiben als Marke "del" stehen, mehrere Geraete werden vereinigt.
   Lokal liegt immer eine Kopie (schnell, offline); was noch nicht hochgeladen ist, steht in "pending" und wird beim naechsten Abgleich nachgeholt. */
(function () {
  "use strict";
  const O = (window.Outfit = window.Outfit || {});
  const pad = (n) => String(n).padStart(2, "0");
  const dayKey = (d) => { d = d || new Date(); return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const uid = () => { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* alter Browser */ } return Date.now().toString(36) + Math.random().toString(36).slice(2, 12); };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  O.util = { pad, dayKey, clamp, isNum, uid, esc };

  /* ==========================================================================
     Farben (Lab-Abstand, Namen, neutral oder bunt)
     ========================================================================== */
  const hex2rgb = (h) => { h = String(h || "#000").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgb2hex = (r, g, b) => "#" + [r, g, b].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, "0")).join("");
  function rgb2lab(r, g, b) {
    const f = (c) => { c /= 255; return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92; };
    const R = f(r), G = f(g), B = f(b);
    const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047, y = R * 0.2126 + G * 0.7152 + B * 0.0722, z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
    return [116 * t(y) - 16, 500 * (t(x) - t(y)), 200 * (t(y) - t(z))];
  }
  const hex2lab = (h) => rgb2lab.apply(null, hex2rgb(h));
  const dE = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const NAMED = [["Schwarz", "#16161a"], ["Anthrazit", "#3a3d44"], ["Grau", "#8a8d93"], ["Hellgrau", "#c9ccd1"], ["Weiß", "#f4f4f1"], ["Creme", "#efe6d2"], ["Beige", "#cdb58f"], ["Sand", "#d8c39b"], ["Camel", "#b98a52"],
    ["Braun", "#6a4a2f"], ["Dunkelbraun", "#3d2b1d"], ["Khaki", "#8a8458"], ["Oliv", "#5d6137"], ["Dunkelgrün", "#1f4a34"], ["Grün", "#3f8a4a"], ["Mint", "#9ad6b8"], ["Türkis", "#2aa6a6"], ["Petrol", "#1d5a68"],
    ["Hellblau", "#8ec1e8"], ["Blau", "#2f6fd0"], ["Royalblau", "#2744b8"], ["Navy", "#1c2a52"], ["Denim", "#4a6f9a"], ["Lila", "#7a4ab0"], ["Flieder", "#b8a0d8"], ["Rosa", "#eea0bd"], ["Pink", "#e0408a"],
    ["Rot", "#c8282e"], ["Bordeaux", "#6e1428"], ["Orange", "#e8762a"], ["Rost", "#a8502a"], ["Senf", "#d8a52a"], ["Gelb", "#efd23a"]];
  const NAMED_LAB = NAMED.map((n) => hex2lab(n[1]));
  function nameOf(hex) {
    const l = hex2lab(hex); let best = 0, bd = 1e9;
    NAMED_LAB.forEach((n, i) => { const d = dE(l, n); if (d < bd) { bd = d; best = i; } });
    return NAMED[best][0];
  }
  const chroma = (hex) => { const l = hex2lab(hex); return Math.hypot(l[1], l[2]); };
  const isNeutral = (hex) => { const l = hex2lab(hex); return Math.hypot(l[1], l[2]) < 14 || l[0] < 14 || l[0] > 92; };
  const hue = (hex) => { const l = hex2lab(hex); return ((Math.atan2(l[2], l[1]) * 180) / Math.PI + 360) % 360; };
  O.color = { hex2rgb, rgb2hex, rgb2lab, hex2lab, dE, nameOf, chroma, isNeutral, hue, NAMED };

  /* ==========================================================================
     Kategorien (jede gehoert zu einem Platz am Koerper, das braucht der Generator spaeter) und Anlaesse
     ========================================================================== */
  const SLOTS = { top: "Oberteil", mid: "Pullover / Layer", outer: "Jacke / Mantel", bottom: "Hose / Rock", shoes: "Schuhe", acc: "Accessoire", dress: "Kleid / Overall" };
  const DEFAULT_CATS = [
    { id: "tshirt", label: "T-Shirt", slot: "top", warm: 1, formal: 1 }, { id: "longsleeve", label: "Langarmshirt", slot: "top", warm: 2, formal: 1 }, { id: "shirt", label: "Hemd", slot: "top", warm: 2, formal: 3 },
    { id: "polo", label: "Polo", slot: "top", warm: 1, formal: 2 }, { id: "knit", label: "Pullover", slot: "mid", warm: 4, formal: 2 }, { id: "hoodie", label: "Hoodie / Sweatshirt", slot: "mid", warm: 3, formal: 1 },
    { id: "cardigan", label: "Strickjacke", slot: "mid", warm: 3, formal: 2 }, { id: "jacket", label: "Jacke", slot: "outer", warm: 3, formal: 2 }, { id: "coat", label: "Mantel", slot: "outer", warm: 5, formal: 3 },
    { id: "rain", label: "Regenjacke", slot: "outer", warm: 2, formal: 1 }, { id: "blazer", label: "Sakko / Blazer", slot: "outer", warm: 2, formal: 4 }, { id: "jeans", label: "Jeans", slot: "bottom", warm: 3, formal: 2 },
    { id: "pants", label: "Stoff- / Chinohose", slot: "bottom", warm: 3, formal: 3 }, { id: "jogger", label: "Jogginghose", slot: "bottom", warm: 2, formal: 1 }, { id: "shorts", label: "Shorts", slot: "bottom", warm: 1, formal: 1 },
    { id: "sneaker", label: "Sneaker", slot: "shoes", warm: 2, formal: 1 }, { id: "boots", label: "Stiefel / Boots", slot: "shoes", warm: 4, formal: 2 }, { id: "dressshoe", label: "Business-Schuhe", slot: "shoes", warm: 2, formal: 4 },
    { id: "sandals", label: "Sandalen", slot: "shoes", warm: 1, formal: 1 }, { id: "cap", label: "Mütze / Cap", slot: "acc", warm: 2, formal: 1 }, { id: "scarf", label: "Schal", slot: "acc", warm: 3, formal: 2 },
    { id: "belt", label: "Gürtel", slot: "acc", warm: 1, formal: 2 }, { id: "watch", label: "Uhr", slot: "acc", warm: 1, formal: 2 }, { id: "bag", label: "Tasche / Rucksack", slot: "acc", warm: 1, formal: 2 },
    { id: "glasses", label: "Brille / Sonnenbrille", slot: "acc", warm: 1, formal: 2 }, { id: "gloves", label: "Handschuhe", slot: "acc", warm: 3, formal: 1 }, { id: "other", label: "Sonstiges", slot: "acc", warm: 2, formal: 2 }
  ];
  const DEFAULT_OCC = ["Alltag", "Arbeit", "Sport", "Date", "Party", "Formell", "Reisen"];
  /* Schichten (Layering) fuer den Oberkoerper: Base direkt am Koerper, Mid darueber zum Waermen, Outer als Wetterschutz. Jedes Teil traegt seine Schicht
     (Standard aus dem Platz der Kategorie, pro Teil aenderbar: ein Hoodie kann Mid oder Outer sein, ein Hemd Base oder Mid). Dressing Room und Generator nutzen sie. */
  const LAYERS = {
    base: { label: "BASE", name: "Base-Layer", hint: "direkt am Körper: T-Shirt, Hemd, Top" },
    mid: { label: "MID", name: "Mid-Layer", hint: "wärmende Schicht darüber: Pullover, Hoodie, Strickjacke, Weste" },
    outer: { label: "OUTER", name: "Outer-Layer", hint: "Wetterschutz außen: Jacke, Mantel, Regenjacke" }
  };
  const LAYER_OF_SLOT = { top: "base", mid: "mid", outer: "outer" };
  O.data = { SLOTS, DEFAULT_CATS, DEFAULT_OCC, LAYERS, LAYER_OF_SLOT };

  /* ein Teil auf sichere Typen und Laengen bringen (kommt aus dem Browser oder aus der Cloud) */
  const str = (v, n) => String(v == null ? "" : v).slice(0, n || 80);
  function cleanItem(r) {
    r = r || {};
    const it = { id: str(r.id, 60) || uid(), upd: isNum(r.upd) ? r.upd : 0 };
    if (r.del) { it.del = true; return it; }
    it.cat = str(r.cat, 40) || "other"; it.name = str(r.name, 80); it.layer = LAYERS[r.layer] ? r.layer : "";
    it.colors = (Array.isArray(r.colors) ? r.colors : []).filter((c) => /^#[0-9a-f]{6}$/i.test(c)).slice(0, 3).map((c) => c.toLowerCase());
    it.brand = str(r.brand, 40); it.size = str(r.size, 20); it.material = str(r.material, 60);
    it.price = isNum(r.price) && r.price >= 0 ? Math.round(r.price * 100) / 100 : null;
    it.bought = /^\d{4}-\d{2}-\d{2}$/.test(r.bought || "") ? r.bought : "";
    it.warmth = clamp(Math.round(+r.warmth || 2), 1, 5); it.formal = clamp(Math.round(+r.formal || 2), 1, 5);
    it.occ = (Array.isArray(r.occ) ? r.occ : []).map((o) => str(o, 24)).filter(Boolean).slice(0, 12);
    it.note = str(r.note, 300); it.fav = !!r.fav; it.dirty = !!r.dirty; it.review = !!r.review;
    it.wears = Math.max(0, Math.round(+r.wears || 0)); it.last = /^\d{4}-\d{2}-\d{2}$/.test(r.last || "") ? r.last : "";
    it.added = isNum(r.added) ? r.added : it.upd || Date.now(); it.ver = Math.max(0, Math.round(+r.ver || 0));
    if (r.ai && typeof r.ai === "object") it.ai = { conf: clamp(+r.ai.conf || 0, 0, 1), fields: (Array.isArray(r.ai.fields) ? r.ai.fields : []).map((f) => str(f, 20)).slice(0, 12) };
    return it;
  }
  const cleanCat = (r) => {
    const c = { id: str(r && r.id, 40), upd: isNum(r && r.upd) ? r.upd : 0 };
    if (!c.id) return null;
    if (r.del) { c.del = true; return c; }
    c.label = str(r.label, 40) || c.id; c.slot = SLOTS[r.slot] ? r.slot : "acc"; c.warm = clamp(Math.round(+r.warm || 2), 1, 5); c.formal = clamp(Math.round(+r.formal || 2), 1, 5);
    return c;
  };
  O.cleanItem = cleanItem;

  /* Outfits (Collagen): Teile mit Lage auf einer Flaeche im Format 4:5. x/y = Mitte, w = Breite (alles in Prozent der Flaeche), r = Drehung in Grad, z = Reihenfolge,
     fx = -1 gespiegelt. Ein Eintrag ohne "id" aber mit "ghost" ist ein Platzhalter fuer ein Teil, das im Schrank fehlt (entsteht bei "Nach Foto"). */
  const BGS = ["paper", "white", "stone", "night", "orange", "green"];
  O.data.BGS = BGS;
  const normDeg = (v) => Math.round(((((v + 180) % 360) + 360) % 360 - 180) * 10) / 10;
  function cleanPiece(p) {
    if (!p || typeof p !== "object") return null;
    const o = { x: clamp(isNum(+p.x) ? +p.x : 50, -20, 120), y: clamp(isNum(+p.y) ? +p.y : 50, -20, 120), w: clamp(isNum(+p.w) && +p.w > 0 ? +p.w : 30, 4, 160), r: normDeg(+p.r || 0), z: Math.round(+p.z || 1), fx: +p.fx === -1 ? -1 : 1 };
    o.x = Math.round(o.x * 10) / 10; o.y = Math.round(o.y * 10) / 10; o.w = Math.round(o.w * 10) / 10;
    if (p.id) o.id = str(p.id, 60); else if (p.ghost) { o.ghost = str(p.ghost, 60); if (p.cat) o.cat = str(p.cat, 40); } else return null;
    return o;
  }
  function cleanOutfit(r) {
    r = r || {};
    const o = { id: str(r.id, 60) || uid(), upd: isNum(r.upd) ? r.upd : 0 };
    if (r.del) { o.del = true; return o; }
    o.name = str(r.name, 60); o.bg = BGS.indexOf(r.bg) >= 0 ? r.bg : "paper";
    o.items = (Array.isArray(r.items) ? r.items : []).map(cleanPiece).filter(Boolean).slice(0, 40);
    o.occ = (Array.isArray(r.occ) ? r.occ : []).map((x) => str(x, 24)).filter(Boolean).slice(0, 12);
    o.fav = !!r.fav; o.note = str(r.note, 300); o.added = isNum(r.added) ? r.added : o.upd || Date.now();
    if (r.inspo && typeof r.inspo === "object") {
      o.inspo = { at: isNum(r.inspo.at) ? r.inspo.at : 0, pieces: (Array.isArray(r.inspo.pieces) ? r.inspo.pieces : []).slice(0, 12).map((q) => ({ desc: str(q && q.desc, 100), slot: SLOTS[q && q.slot] ? q.slot : "", cat: str(q && q.cat, 40), id: q && q.id ? str(q.id, 60) : "", q: q && (q.q === "exact" || q.q === "similar") ? q.q : "" })) };
    }
    return o;
  }
  O.cleanOutfit = cleanOutfit;

  /* Vergleich unabhaengig von Reihenfolge der Eintraege und Schluessel (sonst schreiben zwei Geraete sich gegenseitig immer wieder dasselbe) */
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {}) : v);
  const canon = (list) => JSON.stringify(sortKeys((list || []).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))));

  /* Zwei Staende vereinigen: pro Eintrag gewinnt der neuere Zeitstempel (bei Gleichstand der lokale) */
  function mergeList(local, remote) {
    const m = new Map();
    (remote || []).forEach((x) => { if (x && x.id) m.set(x.id, x); });
    (local || []).forEach((x) => { if (!x || !x.id) return; const o = m.get(x.id); if (!o || (x.upd || 0) >= (o.upd || 0)) m.set(x.id, x); });
    return Array.from(m.values());
  }

  /* ==========================================================================
     Lokaler Speicher: IndexedDB mit den Speichern kv (Stand), blobs (Fotos), queue (Fotos, die noch freigestellt werden muessen)
     ========================================================================== */
  function openDb() {
    return new Promise((res, rej) => {
      if (!window.indexedDB) return rej(new Error("IndexedDB fehlt"));
      const rq = indexedDB.open("dashboard-outfit", 1);
      rq.onupgradeneeded = () => { const d = rq.result; ["kv", "blobs", "queue"].forEach((n) => { if (!d.objectStoreNames.contains(n)) d.createObjectStore(n); }); };
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => rej(rq.error || new Error("IndexedDB-Fehler"));
      rq.onblocked = () => rej(new Error("IndexedDB blockiert"));
    });
  }

  /* ==========================================================================
     Der Speicher selbst (lokal + privates Repo)
     deps: owner (Standard-Besitzer), serial (Warteschlange fuer GitHub-Schreibzugriffe), wrote (meldet einen Schreibzugriff), onStatus(Status)
     ========================================================================== */
  O.createStore = function (deps) {
    deps = deps || {};
    const SKEY = "dashboard-outfit-settings", TOKEN_KEY = "dashboard-gh-token";
    const listeners = {};
    const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
    const emit = (ev, a) => { (listeners[ev] || []).forEach((fn) => { try { fn(a); } catch (e) { console.error(e); } }); };

    /* Einstellungen dieses Geraets (nicht in der Cloud: Repo-Name, KI-Adresse, Freistell-Qualitaet ...) */
    let settings = {};
    try { settings = JSON.parse(localStorage.getItem(SKEY) || "{}") || {}; } catch (e) { settings = {}; }
    const set = (patch) => { settings = Object.assign({}, settings, patch); try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) { /* egal */ } emit("settings", settings); };

    /* Speicher mit Rueckfall in den Arbeitsspeicher (z. B. privates Fenster ohne IndexedDB) */
    let db = null, memOnly = false;
    const mem = { kv: new Map(), blobs: new Map(), queue: new Map() };
    function dbx(store, mode, fn) {
      if (!db) return Promise.resolve().then(() => fn(null, mem[store]));
      return new Promise((res, rej) => {
        const t = db.transaction(store, mode), s = t.objectStore(store); let out;
        try { out = fn(s, null); } catch (e) { return rej(e); }
        t.oncomplete = () => res(out && "result" in out ? out.result : out);
        t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
      });
    }
    const dbGet = (store, key) => dbx(store, "readonly", (s, m) => (m ? m.get(key) : s.get(key)));
    const dbPut = (store, key, val) => dbx(store, "readwrite", (s, m) => { if (m) m.set(key, val); else s.put(val, key); });
    const dbDel = (store, key) => dbx(store, "readwrite", (s, m) => { if (m) m.delete(key); else s.delete(key); });
    const dbAll = (store) => dbx(store, "readonly", (s, m) => (m ? Array.from(m.entries()) : s.getAll()));

    /* Stand */
    let state = { v: 1, items: [], cats: DEFAULT_CATS.map((c) => cleanCat(Object.assign({ upd: 0 }, c))), occ: DEFAULT_OCC.slice(), outfits: [], upd: 0 };
    let pending = {}; /* id -> { photo, thumb, del, meta }: was noch hochgeladen werden muss */
    let changeSeq = 0; /* zaehlt jede Aenderung, damit ein laufender Abgleich keine neueren Aenderungen als erledigt markiert */
    let status = { s: "load", pending: 0, msg: "" };
    const setStatus = (s, msg) => { status = { s, pending: Object.keys(pending).length, msg: msg || "" }; emit("status", status); if (deps.onStatus) deps.onStatus(status); };
    let saveTimer = 0;
    const persist = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => { dbPut("kv", "state", state).catch(() => {}); dbPut("kv", "pending", pending).catch(() => {}); }, 150); };
    const byId = (id) => state.items.find((i) => i.id === id && !i.del);
    const liveItems = () => state.items.filter((i) => !i.del);
    const liveCats = () => state.cats.filter((c) => !c.del);

    const ready = (async function init() {
      try { db = await openDb(); } catch (e) { memOnly = true; console.warn("Outfits: nur Arbeitsspeicher,", e.message); }
      try {
        const st = await dbGet("kv", "state"), pe = await dbGet("kv", "pending");
        if (st && Array.isArray(st.items)) {
          state.items = st.items.map(cleanItem); state.occ = Array.isArray(st.occ) && st.occ.length ? st.occ.map((o) => str(o, 24)) : state.occ; state.upd = isNum(st.upd) ? st.upd : 0;
          if (Array.isArray(st.cats) && st.cats.length) state.cats = st.cats.map(cleanCat).filter(Boolean);
          if (Array.isArray(st.outfits)) state.outfits = st.outfits.map(cleanOutfit);
        }
        if (pe && typeof pe === "object") pending = pe;
      } catch (e) { console.warn("Outfits: lokaler Stand nicht lesbar", e); }
      setStatus(cfg() ? "idle" : "local");
    })();

    /* ---------- Teile und Kategorien aendern ---------- */
    const urls = new Map();
    function dropUrls(id) { Array.from(urls.keys()).forEach((k) => { if (k.split(":")[1] === id) { URL.revokeObjectURL(urls.get(k)); urls.delete(k); } }); }
    async function putItem(raw, blobs) {
      await ready;
      const it = cleanItem(Object.assign({}, raw, { upd: Date.now() }));
      if (blobs && blobs.photo) { it.ver = (byId(it.id) ? byId(it.id).ver : 0) + 1; dropUrls(it.id); await dbPut("blobs", "photo:" + it.id, { ver: it.ver, blob: blobs.photo }); await dbPut("blobs", "thumb:" + it.id, { ver: it.ver, blob: blobs.thumb }); pending[it.id] = Object.assign({}, pending[it.id], { photo: true, thumb: true }); }
      else if (byId(it.id)) it.ver = byId(it.id).ver;
      const i = state.items.findIndex((x) => x.id === it.id);
      if (i >= 0) state.items[i] = it; else state.items.push(it);
      pending[it.id] = Object.assign({}, pending[it.id], { meta: true });
      state.upd = Date.now(); changeSeq++; persist(); emit("change"); syncSoon(); return it;
    }
    async function removeItem(id) {
      await ready; dropUrls(id);
      const i = state.items.findIndex((x) => x.id === id); if (i < 0) return;
      state.items[i] = { id, del: true, upd: Date.now() };
      await dbDel("blobs", "photo:" + id).catch(() => {}); await dbDel("blobs", "thumb:" + id).catch(() => {});
      await dbDel("blobs", "aux:orig:" + id).catch(() => {}); await dbDel("blobs", "aux:cut:" + id).catch(() => {});
      pending[id] = { del: true, meta: true }; changeSeq++; persist(); emit("change"); syncSoon();
    }
    async function saveCats(cats, occ) {
      await ready; const now = Date.now();
      const incoming = (cats || []).map(cleanCat).filter(Boolean);
      const ids = new Set(incoming.map((c) => c.id));
      state.cats.forEach((c) => { if (!ids.has(c.id) && !c.del) incoming.push({ id: c.id, del: true, upd: now }); });
      state.cats = incoming.map((c) => { const old = state.cats.find((x) => x.id === c.id); return old && JSON.stringify(Object.assign({}, old, { upd: 0 })) === JSON.stringify(Object.assign({}, c, { upd: 0 })) ? old : Object.assign({}, c, { upd: now }); });
      if (occ) state.occ = occ.map((o) => str(o, 24)).filter(Boolean).slice(0, 24);
      state.upd = now; pending._meta = { meta: true }; changeSeq++; persist(); emit("change"); syncSoon();
    }

    /* ---------- Outfits (Collagen) ---------- */
    const liveOutfits = () => state.outfits.filter((o) => !o.del);
    const outfitById = (id) => state.outfits.find((o) => o.id === id && !o.del);
    async function putOutfit(raw) {
      await ready;
      const o = cleanOutfit(Object.assign({}, raw, { upd: Date.now() }));
      const i = state.outfits.findIndex((x) => x.id === o.id);
      if (i >= 0) state.outfits[i] = o; else state.outfits.push(o);
      pending._outfits = { meta: true }; changeSeq++; persist(); emit("change"); syncSoon(); return o;
    }
    async function removeOutfit(id) {
      await ready; const i = state.outfits.findIndex((x) => x.id === id); if (i < 0) return;
      state.outfits[i] = { id, del: true, upd: Date.now() };
      pending._outfits = { meta: true }; changeSeq++; persist(); emit("change"); syncSoon();
    }

    /* ---------- Fotos als Blob-Adressen ---------- */
    const blobCfgPath = (kind, id) => (kind === "thumb" ? "thumbs/" : "photos/") + id + ".webp";
    let activeGets = 0; const waiters = [];
    const limit = async (fn) => { if (activeGets >= 4) await new Promise((r) => waiters.push(r)); activeGets++; try { return await fn(); } finally { activeGets--; const w = waiters.shift(); if (w) w(); } };
    async function blobURL(kind, id) {
      await ready; const it = byId(id); if (!it || !it.ver) return null;
      const ck = kind + ":" + id + ":" + it.ver; if (urls.has(ck)) return urls.get(ck);
      let rec = await dbGet("blobs", kind + ":" + id).catch(() => null);
      if (!rec || rec.ver !== it.ver) {
        const c = cfg(); if (!c) return null;
        const blob = await limit(() => ghRaw(c, blobCfgPath(kind, id))).catch(() => null);
        if (!blob) return null;
        rec = { ver: it.ver, blob }; await dbPut("blobs", kind + ":" + id, rec).catch(() => {});
      }
      const u = URL.createObjectURL(rec.blob); urls.set(ck, u); return u;
    }
    async function blobOf(kind, id) { await ready; const rec = await dbGet("blobs", kind + ":" + id).catch(() => null); const it = byId(id); return rec && it && rec.ver === it.ver ? rec.blob : null; }

    /* Hilfsdateien nur fuer dieses Geraet (Original und Freistellung in 1024 px, damit Nachbessern mit "Zurueckholen" geht); werden nicht hochgeladen */
    const putAux = async (kind, id, blob) => { await ready; await dbPut("blobs", "aux:" + kind + ":" + id, { blob }); };
    const getAux = async (kind, id) => { await ready; const r = await dbGet("blobs", "aux:" + kind + ":" + id).catch(() => null); return r ? r.blob : null; };

    /* ---------- Warteschlange fuer neue Fotos (werden nacheinander freigestellt, auch wenn die Seite zwischendurch zugeht) ---------- */
    const queue = {
      async add(file, extra) { await ready; const id = uid(); await dbPut("queue", id, Object.assign({ id, blob: file, at: Date.now() }, extra || {})); emit("queue"); return id; },
      async list() { await ready; return (await dbAll("queue")).map((e) => (Array.isArray(e) ? e[1] : e)).filter(Boolean).sort((a, b) => a.at - b.at); },
      async done(id) { await ready; await dbDel("queue", id); emit("queue"); }
    };

    /* ==========================================================================
       Privates Repo (GitHub Contents API)
       ========================================================================== */
    function cfg() {
      if (settings.remote === false) return null;
      let token = ""; try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { token = ""; }
      const owner = settings.owner || deps.owner || "", repo = settings.repo || "outfit-daten";
      return token && owner && repo ? { owner, repo, token } : null;
    }
    const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
    const unb64 = (s) => decodeURIComponent(escape(atob(String(s || "").replace(/\n/g, ""))));
    const blob2b64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });
    const apiBase = () => String(settings.apiBase || "https://api.github.com").replace(/\/+$/, ""); /* nur fuer Tests gegen einen Nachbau der GitHub-Schnittstelle */
    const api = (c, path) => apiBase() + "/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo) + "/contents/" + path.split("/").map(encodeURIComponent).join("/");
    const hdr = (c, extra) => Object.assign({ Authorization: "Bearer " + c.token, Accept: "application/vnd.github+json" }, extra || {});
    async function rateLimited(res) {
      if (res.status === 429) return true; if (res.status !== 403) return false;
      if (res.headers.get("retry-after") || res.headers.get("x-ratelimit-remaining") === "0") return true;
      try { return /rate limit|abuse|secondary/i.test(String((await res.clone().json()).message || "")); } catch (e) { return false; }
    }
    function fail(res, what) { const e = new Error(what + ": " + (res.status === 404 ? "nicht gefunden (Repo und Tokenrechte pruefen)" : res.status === 401 ? "Token ungueltig" : res.status === 403 ? "Zugriff verweigert oder Schreibbremse (403)" : "Status " + res.status)); e.status = res.status; return e; }
    async function ghGetJson(c, path) {
      const res = await fetch(api(c, path), { headers: hdr(c), cache: "no-store" });
      if (res.status === 404) return null; if (await rateLimited(res)) { const e = new Error("GitHub-Schreibbremse, bitte kurz warten"); e.rate = true; throw e; }
      if (!res.ok) throw fail(res, path);
      const meta = await res.json(); return meta;
    }
    async function ghRaw(c, path) {
      const res = await fetch(api(c, path), { headers: hdr(c, { Accept: "application/vnd.github.raw+json" }), cache: "no-store" });
      if (!res.ok) return null; return res.blob();
    }
    async function ghPut(c, path, content64, message, sha) {
      const body = { message, content: content64 }; if (sha) body.sha = sha;
      const res = await fetch(api(c, path), { method: "PUT", headers: hdr(c, { "Content-Type": "application/json" }), body: JSON.stringify(body) });
      if (deps.wrote) deps.wrote();
      if (res.status === 409 || res.status === 422) { const e = new Error("Konflikt"); e.conflict = true; throw e; }
      if (await rateLimited(res)) { const e = new Error("GitHub-Schreibbremse, bitte kurz warten"); e.rate = true; throw e; }
      if (!res.ok) throw fail(res, path);
      return (await res.json()).content.sha;
    }
    async function ghDelete(c, path, sha, message) {
      const res = await fetch(api(c, path), { method: "DELETE", headers: hdr(c, { "Content-Type": "application/json" }), body: JSON.stringify({ message, sha }) });
      if (deps.wrote) deps.wrote(); if (!res.ok && res.status !== 404) throw fail(res, path);
    }
    const serial = (fn) => (deps.serial ? deps.serial(fn) : fn());

    /* Outfits liegen in einer eigenen Datei (outfits.json), damit sie unabhaengig von den Teilen vereinigt und geschrieben werden */
    async function syncOutfits(c) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await ghGetJson(c, "outfits.json"); let rj = null;
        if (remote && remote.content) { try { rj = JSON.parse(unb64(remote.content)); } catch (e) { rj = null; } }
        if (remote && !remote.content && remote.sha) { const bl = await ghRaw(c, "outfits.json"); try { rj = JSON.parse(await bl.text()); } catch (e) { rj = null; } }
        const before = canon(state.outfits), cutoff = Date.now() - 120 * 86400000;
        const remoteList = rj && Array.isArray(rj.outfits) ? rj.outfits.map(cleanOutfit) : [];
        state.outfits = mergeList(state.outfits, remoteList).filter((o) => !(o.del && o.upd < cutoff));
        if (canon(state.outfits) !== before) { persist(); emit("change"); }
        if (remote && rj && canon(remoteList) === canon(state.outfits)) return;
        if (!remote && !state.outfits.length) return;
        try { await serial(() => ghPut(c, "outfits.json", b64(JSON.stringify({ v: 1, outfits: state.outfits })), "Outfits: Collagen", remote && remote.sha)); return; }
        catch (e) { if (e.conflict) continue; throw e; }
      }
      throw new Error("Konflikt beim Speichern der Outfits, wird nochmal versucht");
    }

    /* Abgleich: erst die Liste, dann Fotos hoch, dann (falls noetig) die Liste neu. Gibt true zurueck, wenn alles gesichert ist. */
    let syncing = null, syncAgain = false, syncTimer = 0, backoffUntil = 0;
    function syncSoon(ms) { clearTimeout(syncTimer); syncTimer = setTimeout(() => { sync().catch(() => {}); }, ms || 2500); }
    function sync() {
      if (syncing) { syncAgain = true; return syncing; }
      syncing = (async () => {
        await ready; const c = cfg();
        if (!c) { setStatus("local"); return false; }
        if (Date.now() < backoffUntil) { setStatus("error", "GitHub-Schreibbremse, spaeter automatisch"); return false; }
        setStatus("sync");
        const seq0 = changeSeq;
        try {
          let ok = false;
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            const remote = await ghGetJson(c, "items.json"); let rj = null;
            if (remote && remote.content) { try { rj = JSON.parse(unb64(remote.content)); } catch (e) { rj = null; } }
            if (remote && !remote.content && remote.sha) { const bl = await ghRaw(c, "items.json"); try { rj = JSON.parse(await bl.text()); } catch (e) { rj = null; } }
            /* vereinigen */
            const beforeLocal = canon(state.items) + canon(state.cats) + JSON.stringify(state.occ);
            const remoteItems = rj && Array.isArray(rj.items) ? rj.items.map(cleanItem) : [], remoteCats = rj && Array.isArray(rj.cats) ? rj.cats.map(cleanCat).filter(Boolean) : [];
            const cutoff = Date.now() - 120 * 86400000;
            state.items = mergeList(state.items, remoteItems).filter((i) => !(i.del && i.upd < cutoff));
            state.cats = mergeList(state.cats, remoteCats).filter((x) => !(x.del && x.upd < cutoff));
            if (rj && Array.isArray(rj.occ) && rj.occ.length && (rj.upd || 0) > state.upd) { state.occ = rj.occ.map((o) => str(o, 24)); state.upd = rj.upd; }
            if (canon(state.items) + canon(state.cats) + JSON.stringify(state.occ) !== beforeLocal) { persist(); emit("change"); }
            /* Fotos hochladen: erst Dateien, dann die Liste (so zeigt die Liste nie auf Fotos, die es noch nicht gibt) */
            const ids = Object.keys(pending).filter((k) => k !== "_meta" && k !== "_outfits");
            for (const id of ids) {
              const p = pending[id], it = byId(id); if (!p) continue;
              if (p.del) { for (const kind of ["photo", "thumb"]) { const m = await ghGetJson(c, blobCfgPath(kind, id)).catch(() => null); if (m && m.sha) await serial(() => ghDelete(c, blobCfgPath(kind, id), m.sha, "Teil entfernt")); } delete p.del; }
              if (it && (p.photo || p.thumb)) {
                for (const kind of ["thumb", "photo"]) {
                  if (!p[kind]) continue; const rec = await dbGet("blobs", kind + ":" + id).catch(() => null);
                  if (!rec || rec.ver !== it.ver) { delete p[kind]; continue; }
                  const path = blobCfgPath(kind, id), ex = await ghGetJson(c, path).catch(() => null), c64 = await blob2b64(rec.blob);
                  await serial(() => ghPut(c, path, c64, "Foto " + id.slice(0, 8), ex && ex.sha)); delete p[kind];
                }
              }
              persist();
            }
            const needList = Object.keys(pending).length > 0 || !remote || !rj || canon(remoteItems) !== canon(state.items) || canon(remoteCats) !== canon(state.cats) || JSON.stringify(rj.occ) !== JSON.stringify(state.occ);
            if (needList) {
              const payload = JSON.stringify({ v: 1, upd: state.upd, items: state.items, cats: state.cats, occ: state.occ });
              try { await serial(() => ghPut(c, "items.json", b64(payload), "Outfits: Stand", remote && remote.sha)); } catch (e) { if (e.conflict) continue; throw e; }
            }
            await syncOutfits(c);
            if (changeSeq === seq0) pending = {};
            persist(); ok = true;
          }
          if (!ok) throw new Error("Konflikt beim Speichern, wird nochmal versucht");
          setStatus("idle"); return true;
        } catch (e) {
          if (e.rate) backoffUntil = Date.now() + 90000;
          console.warn("Outfits: Abgleich fehlgeschlagen:", e.message);
          setStatus("error", e.message || "Abgleich fehlgeschlagen"); return false;
        }
      })().finally(() => { syncing = null; if (syncAgain) { syncAgain = false; syncSoon(4000); } });
      return syncing;
    }

    /* Verbindung pruefen (Einstellungen): gibt { ok, msg } zurueck */
    async function test() {
      let token = ""; try { token = localStorage.getItem(TOKEN_KEY) || ""; } catch (e) { token = ""; }
      if (!token) return { ok: false, msg: "Auf diesem Gerät ist noch kein Token gespeichert. Tippe oben in der Leiste einmal auf Sync, dann fragt das Dashboard danach (es ist derselbe Token wie sonst)." };
      const c = cfg(); if (!c) return { ok: false, msg: "Der Abgleich ist ausgeschaltet (Haken oben) oder Besitzer und Repo fehlen." };
      try {
        const res = await fetch(apiBase() + "/repos/" + encodeURIComponent(c.owner) + "/" + encodeURIComponent(c.repo), { headers: hdr(c), cache: "no-store" });
        if (res.status === 404) return { ok: false, msg: "Repo " + c.owner + "/" + c.repo + " nicht gefunden. Angelegt? Hat der Token Zugriff darauf?" };
        if (!res.ok) return { ok: false, msg: "GitHub antwortet mit Status " + res.status };
        const j = await res.json();
        if (!j.private) return { ok: false, msg: "Das Repo ist OEFFENTLICH. Bitte auf privat stellen, sonst waeren deine Fotos fuer alle sichtbar." };
        if (j.permissions && j.permissions.push === false) return { ok: false, msg: "Der Token darf in diesem Repo nicht schreiben (Contents: Read and write noetig)." };
        return { ok: true, msg: "Privates Repo " + c.owner + "/" + c.repo + " erreichbar." };
      } catch (e) { return { ok: false, msg: "Keine Verbindung: " + e.message }; }
    }

    /* Sicherung als Datei (nur die Liste, ohne Fotos) */
    const exportJson = () => JSON.stringify({ v: 1, upd: state.upd, items: liveItems(), cats: liveCats(), occ: state.occ, outfits: liveOutfits() }, null, 1);

    return {
      ready, on, settings: { get: (k) => settings[k], all: () => Object.assign({}, settings), set },
      items: liveItems, byId, cats: liveCats, occs: () => state.occ.slice(), slotOf: (catId) => { const c = state.cats.find((x) => x.id === catId); return c ? c.slot : "acc"; },
      outfits: liveOutfits, outfitById, putOutfit, removeOutfit,
      putItem, removeItem, saveCats, putAux, getAux, thumbURL: (id) => blobURL("thumb", id), photoURL: (id) => blobURL("photo", id), blobOf,
      queue, sync, syncSoon, test, status: () => status, remoteOn: () => !!cfg(), exportJson, memOnly: () => memOnly,
      pendingCount: () => Object.keys(pending).length
    };
  };
})();
