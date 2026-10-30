/* Outfits (Bereich "Outfits"), Teil 3: Oberflaeche. Etappe 1: Schrank (Raster, Suche, Filter, Teil bearbeiten), Hinzufuegen per Kamera oder Galerie mit
   automatischem Freistellen und KI-Vorausfuellen, Einstellungen (privates Repo, KI, Freistellen, Kategorien, Anlaesse).
   script.js uebergibt: main (Container), syncEl (Statusanzeige), owner (GitHub-Besitzer), serial/wrote (Warteschlange fuer GitHub-Schreibzugriffe), toast.
   Spaetere Etappen haengen weitere Reiter an (Outfits bauen, Generator, Kalender, Statistik). */
(function () {
  "use strict";
  const O = window.Outfit;
  if (!O || !O.createStore || !O.photo) return;
  const { esc, uid, clamp } = O.util, P = O.photo, Co = O.color, D = O.data;

  /* ---------- kleine Pixel-Symbole (8x8, einfarbig, nehmen die Textfarbe) ---------- */
  const ICONS = {
    gear: ["...gg...", ".g.gg.g.", "..gggg..", "ggg..ggg", "ggg..ggg", "..gggg..", ".g.gg.g.", "...gg..."],
    plus: ["...gg...", "...gg...", "...gg...", "gggggggg", "gggggggg", "...gg...", "...gg...", "...gg..."],
    heart: [".gg..gg.", "gggggggg", "gggggggg", "gggggggg", ".gggggg.", "..gggg..", "...gg...", "........"],
    drop: ["...g....", "...g....", "..ggg...", ".ggggg..", "ggggggg.", "ggggggg.", ".ggggg..", "..ggg..."],
    camera: ["..ggg...", "gggggggg", "gg....gg", "g..gg..g", "g..gg..g", "gg....gg", "gggggggg", "........"],
    image: ["gggggggg", "g......g", "g..g...g", "g.ggg..g", "gggggg.g", "g.gggg.g", "g......g", "gggggggg"],
    trash: ["..gggg..", "gggggggg", ".g.gg.g.", ".g.gg.g.", ".g.gg.g.", ".g.gg.g.", ".gggggg.", "........"],
    check: ["........", ".......g", "......gg", "g....gg.", "gg..gg..", ".gggg...", "..gg....", "........"],
    brush: ["......gg", ".....ggg", "....ggg.", "...ggg..", ".ggg....", "ggg.....", "gg......", "........"],
    more: ["........", "........", "........", "gg.gg.gg", "gg.gg.gg", "........", "........", "........"],
    grid: ["gggg.ggg", "gggg.ggg", "gggg.ggg", "........", "ggg.gggg", "ggg.gggg", "ggg.gggg", "........"]
  };
  const ic = (name, size) => {
    const rows = ICONS[name] || ICONS.plus; let r = "";
    rows.forEach((row, y) => { for (let x = 0; x < 8; x++) if (row[x] === "g") r += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>'; });
    return '<svg class="of-ic" width="' + (size || 16) + '" height="' + (size || 16) + '" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">' + r + "</svg>";
  };
  /* Symbol fuer die Ueberschrift des Bereichs (script.js nimmt es ueber SECTION_SPRITES) */
  if (window.PixelSprites && window.PixelSprites.SPR && !window.PixelSprites.SPR.shirt) {
    window.PixelSprites.SPR.shirt = { p: { g: "#2f5fb8", b: "#6aa8ff" }, r: [".gg..gg.", "gbbggbbg", "gbbbbbbg", "ggbbbbgg", ".gbbbbg.", ".gbbbbg.", ".gbbbbg.", ".gggggg."] };
  }

  window.createOutfit = function (deps) {
    deps = deps || {};
    const root = deps.main;
    if (!root) return null;
    const toast = deps.toast || function () {};
    const syncEl = deps.syncEl || null;
    const SORTS = { new: "Neueste zuerst", cat: "Nach Kategorie", layer: "Nach Schicht (Base, Mid, Outer)", color: "Nach Farbe", wears: "Am meisten getragen", least: "Am wenigsten getragen", price: "Teuerste zuerst" };
    const ui = { tab: "wardrobe", q: "", cat: "all", layer: "", sort: "new", fav: false, dirty: false, review: false };
    const qInfo = { on: false, total: 0, done: 0, step: "", pct: 0, errors: 0, aiErr: "" };
    let working = false;

    const store = O.createStore({ owner: deps.owner, serial: deps.serial, wrote: deps.wrote, onStatus: renderSync });
    const catById = (id) => store.cats().find((c) => c.id === id);
    const catLabel = (id) => (catById(id) ? catById(id).label : "Sonstiges");
    const itemTitle = (it) => it.name || (catLabel(it.cat) + (it.colors[0] ? " · " + Co.nameOf(it.colors[0]) : ""));
    const defaultLayer = (catId) => D.LAYER_OF_SLOT[store.slotOf(catId)] || "";
    const layerOf = (it) => (D.LAYER_OF_SLOT[store.slotOf(it.cat)] ? it.layer || defaultLayer(it.cat) : "");
    const money = (v) => (v == null ? "" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v));
    const CO = O.collage ? O.collage({ store, toast, ic, itemTitle, layerOf }) : null; /* Collage-Editor (outfit-collage.js) */
    let INSPO = null; /* "Nach Foto nachbauen" (outfit-inspo.js), wird nach sheet() angelegt */
    ui.tab = store.settings.get("tab") === "outfits" && CO ? "outfits" : "wardrobe";

    /* ==========================================================================
       Grundgeruest
       ========================================================================== */
    root.innerHTML =
      '<div class="of-notice" id="ofNotice" hidden></div>' +
      '<div class="of-bar"><div class="of-tabs" id="ofTabs" role="tablist" aria-label="Bereich"></div><div class="of-bar-r">' +
      '<button type="button" class="of-btn of-go" id="ofAdd">' + ic("plus", 14) + '<span>TEIL</span></button>' +
      '<button type="button" class="of-btn" id="ofSet" aria-label="Einstellungen">' + ic("gear", 16) + "</button></div></div>" +
      '<div class="of-view" id="ofView"></div>';
    const $ = (sel, el) => (el || root).querySelector(sel);
    const view = $("#ofView"), notice = $("#ofNotice");

    /* Statusanzeige in der Ueberschrift */
    function renderSync(s) {
      if (!syncEl) return; s = s || store.status();
      const n = store.items().length, t = $(".of-sync-t", syncEl) || syncEl.querySelector("span");
      const map = { local: ["local", "NUR AUF DIESEM GERÄT"], load: ["load", "LADE …"], sync: ["saving", "GLEICHE AB …"], idle: ["ok", n + " TEILE · GESICHERT"], error: ["error", "NICHT GESICHERT"] };
      let m = map[s.s] || map.load; if (s.s === "idle" && s.pending) m = ["pending", "NOCH " + s.pending + " ZU SICHERN"];
      syncEl.dataset.s = m[0]; if (t) t.textContent = m[1]; syncEl.title = s.msg || "";
    }

    /* ==========================================================================
       Sheets (Fenster von unten, am PC mittig)
       ========================================================================== */
    function sheet(title, html, opts) {
      opts = opts || {};
      const ov = document.createElement("div"); ov.className = "of-ov";
      ov.innerHTML = '<div class="of-sheet' + (opts.wide ? " wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + esc(title) + '"><div class="of-sh"><b class="of-px">' + esc(title) + '</b><button type="button" class="of-x" aria-label="Schließen">×</button></div><div class="of-sb">' + html + "</div></div>";
      document.body.appendChild(ov); document.body.classList.add("of-lock");
      const close = () => { document.removeEventListener("keydown", onKey); ov.remove(); if (!document.querySelector(".of-ov")) document.body.classList.remove("of-lock"); if (opts.onClose) opts.onClose(); };
      const onKey = (e) => { if (e.key === "Escape" && !document.querySelector(".of-ed, .of-co") && ov === Array.from(document.querySelectorAll(".of-ov")).pop()) close(); };
      ov.addEventListener("mousedown", (e) => { ov._down = e.target === ov; });
      ov.addEventListener("click", (e) => { if ((e.target === ov && ov._down) || e.target.closest(".of-x")) close(); });
      document.addEventListener("keydown", onKey);
      return { el: ov, body: ov.querySelector(".of-sb"), close };
    }

    /* ==========================================================================
       Schrank
       ========================================================================== */
    function hueKey(it) { const c = it.colors[0]; if (!c) return 999; return Co.isNeutral(c) ? 400 + Co.hex2lab(c)[0] : Co.hue(c); }
    function filtered() {
      let l = store.items(); const q = ui.q.trim().toLowerCase();
      if (q) l = l.filter((it) => [it.name, it.brand, it.material, it.size, catLabel(it.cat), it.colors.map(Co.nameOf).join(" "), it.note, it.occ.join(" ")].join(" ").toLowerCase().indexOf(q) >= 0);
      if (ui.cat !== "all") l = l.filter((it) => it.cat === ui.cat);
      if (ui.layer) l = l.filter((it) => layerOf(it) === ui.layer);
      if (ui.fav) l = l.filter((it) => it.fav);
      if (ui.dirty) l = l.filter((it) => it.dirty);
      if (ui.review) l = l.filter((it) => it.review);
      const slotIdx = Object.keys(D.SLOTS), layIdx = ["base", "mid", "outer"];
      const cmp = { layer: (a, b) => (layIdx.indexOf(layerOf(a)) + 1 || 9) - (layIdx.indexOf(layerOf(b)) + 1 || 9) || slotIdx.indexOf(store.slotOf(a.cat)) - slotIdx.indexOf(store.slotOf(b.cat)) || b.added - a.added, new: (a, b) => b.added - a.added, cat: (a, b) => slotIdx.indexOf(store.slotOf(a.cat)) - slotIdx.indexOf(store.slotOf(b.cat)) || catLabel(a.cat).localeCompare(catLabel(b.cat), "de") || b.added - a.added, color: (a, b) => hueKey(a) - hueKey(b), wears: (a, b) => b.wears - a.wears, least: (a, b) => a.wears - b.wears || (a.last || "").localeCompare(b.last || ""), price: (a, b) => (b.price || 0) - (a.price || 0) };
      return l.sort(cmp[ui.sort] || cmp.new);
    }
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); loadThumb(e.target); } }), { rootMargin: "240px" }) : null;
    async function loadThumb(img) {
      const u = await store.thumbURL(img.dataset.id).catch(() => null);
      if (u && img.isConnected) { img.src = u; img.classList.add("on"); } else if (img.isConnected) img.closest(".of-img").classList.add("none");
    }
    function renderWardrobe() {
      const all = store.items(), list = filtered();
      const counts = {}; all.forEach((it) => { counts[it.cat] = (counts[it.cat] || 0) + 1; });
      const slotIdx = Object.keys(D.SLOTS), cats = store.cats().filter((c) => counts[c.id]).sort((a, b) => slotIdx.indexOf(a.slot) - slotIdx.indexOf(b.slot) || a.label.localeCompare(b.label, "de"));
      const lcount = { base: 0, mid: 0, outer: 0 }; all.forEach((it) => { const l = layerOf(it); if (l) lcount[l]++; });
      const nFav = all.filter((i) => i.fav).length, nDirty = all.filter((i) => i.dirty).length, nRev = all.filter((i) => i.review).length;
      const chip = (cls, on, attr, label, n) => '<button type="button" class="of-chip' + (on ? " on" : "") + (cls ? " " + cls : "") + '" ' + attr + ">" + label + (n != null ? " <i>" + n + "</i>" : "") + "</button>";
      let h = '<div class="of-tools"><input class="of-search" id="ofQ" type="search" placeholder="Suchen (Marke, Farbe, Notiz …)" value="' + esc(ui.q) + '" aria-label="Suchen"><select class="of-sort" id="ofSort" aria-label="Sortieren">' + Object.keys(SORTS).map((k) => '<option value="' + k + '"' + (ui.sort === k ? " selected" : "") + ">" + SORTS[k] + "</option>").join("") + "</select></div>";
      h += '<div class="of-chips" role="group" aria-label="Filter">' + chip("", ui.cat === "all" && !ui.layer && !ui.fav && !ui.dirty && !ui.review, 'data-f="all"', "ALLE", all.length) + cats.map((c) => chip("", ui.cat === c.id, 'data-cat="' + esc(c.id) + '"', esc(c.label), counts[c.id])).join("") +
        (lcount.base + lcount.mid + lcount.outer ? ["base", "mid", "outer"].map((k) => chip("of-ly-c ly-" + k, ui.layer === k, 'data-ly="' + k + '" title="' + esc(D.LAYERS[k].name + ": " + D.LAYERS[k].hint) + '"', D.LAYERS[k].label, lcount[k])).join("") : "") +
        (nFav ? chip("of-fav", ui.fav, 'data-f="fav"', ic("heart", 10) + " FAVORITEN", nFav) : "") + (nDirty ? chip("of-dirty", ui.dirty, 'data-f="dirty"', ic("drop", 10) + " SCHMUTZIG", nDirty) : "") + (nRev ? chip("of-rev", ui.review, 'data-f="review"', "PRÜFEN", nRev) : "") + "</div>";
      if (!all.length) h = '<div class="of-empty"><div class="of-empty-i">' + ic("camera", 40) + '</div><p><b>Noch keine Teile.</b> Tippe auf <b>+ TEIL</b>.</p></div>';
      else if (!list.length) h += '<div class="of-empty"><p>Nichts gefunden. Filter oder Suche zurücksetzen?</p><button type="button" class="of-btn of-sm" data-f="all">FILTER ZURÜCKSETZEN</button></div>';
      else {
        h += '<div class="of-grid" id="ofGrid">' + list.map((it) =>
          '<button type="button" class="of-tile' + (it.review ? " rev" : "") + '" data-id="' + esc(it.id) + '"><span class="of-img"><img alt="' + esc(itemTitle(it)) + '" data-id="' + esc(it.id) + '"></span><span class="of-tn">' + esc(itemTitle(it)) + "</span>" +
          '<span class="of-bd">' + (it.fav ? '<i class="of-b fav">' + ic("heart", 12) + "</i>" : "") + (it.dirty ? '<i class="of-b dirty">' + ic("drop", 12) + "</i>" : "") + (it.review ? '<i class="of-b rev">PRÜFEN</i>' : "") + "</span>" + (layerOf(it) ? '<i class="of-ly ly-' + layerOf(it) + '" title="' + esc(D.LAYERS[layerOf(it)].name) + '">' + D.LAYERS[layerOf(it)].label[0] + "</i>" : "") + "</button>").join("") + "</div>";
      }
      const keepFocus = document.activeElement && document.activeElement.id === "ofQ";
      view.innerHTML = h;
      if (keepFocus) { const q = $("#ofQ"); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
      view.querySelectorAll(".of-img img").forEach((im, i) => { if (i < 24 || !io) loadThumb(im); else io.observe(im); }); /* die ersten sofort, der Rest beim Hinscrollen */
      renderSync();
    }
    /* ==========================================================================
       Reiter SCHRANK / OUTFITS und die Liste der Outfits (kleine Collagen)
       ========================================================================== */
    function renderTabs() {
      const tabs = $("#ofTabs"); if (!tabs) return;
      tabs.innerHTML = CO ? [["wardrobe", "SCHRANK"], ["outfits", "OUTFITS"]].map((t) => '<button type="button" role="tab" class="of-tab' + (ui.tab === t[0] ? " on" : "") + '" data-tab="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] + "</button>").join("") : "";
      const lab = $("#ofAdd span"); if (lab) lab.textContent = ui.tab === "outfits" ? "OUTFIT" : "TEIL";
    }
    INSPO = O.inspo && CO ? O.inspo({ store, toast, ic, sheet, CO, itemTitle, layerOf }) : null;
    const ioO = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { ioO.unobserve(e.target); paintCard(e.target); } }), { rootMargin: "240px" }) : null;
    function paintCard(cv) { const o = store.outfitById(cv.closest(".of-ocard").dataset.oid); if (o) CO.paint(cv, o); }
    function renderOutfits() {
      const list = store.outfits().slice().sort((a, b) => b.upd - a.upd); let h;
      if (!list.length) h = '<div class="of-empty"><div class="of-empty-i">' + ic("image", 40) + '</div><p><b>Noch keine Outfits.</b> Tippe auf <b>+ OUTFIT</b>.</p></div>';
      else h = '<div class="of-ogrid">' + list.map((o) => {
        const n = o.items.filter((p) => p.id && store.byId(p.id)).length, miss = o.items.filter((p) => p.ghost).length;
        const meta = [o.occ[0] ? esc(o.occ[0].toUpperCase()) : "", n + (n === 1 ? " TEIL" : " TEILE")].filter(Boolean).join(" · ") + (miss ? " · <b>" + miss + " FEHLT</b>" : "");
        return '<button type="button" class="of-ocard" data-oid="' + esc(o.id) + '"><span class="of-co-cv"></span><span class="of-on"><span>' + esc(o.name || "Outfit") + "</span>" + (o.fav ? ic("heart", 10) : "") + '</span><span class="of-om">' + meta + "</span></button>";
      }).join("") + "</div>";
      view.innerHTML = h;
      view.querySelectorAll(".of-ocard .of-co-cv").forEach((cv, i) => { if (i < 12 || !ioO) paintCard(cv); else ioO.observe(cv); });
      renderSync();
    }
    function renderCurrent() { renderTabs(); if (ui.tab === "outfits" && CO) renderOutfits(); else renderWardrobe(); }
    function setTab(t) { ui.tab = t === "outfits" && CO ? "outfits" : "wardrobe"; store.settings.set({ tab: ui.tab }); renderCurrent(); }
    function newOutfit() {
      if (!store.items().length) { toast("Lege zuerst Teile im Schrank an", "warn", 3500); return setTab("wardrobe"); }
      if (!INSPO) return CO.edit(null);
      const on = O.ai.configured(store);
      const s = sheet("OUTFIT ERSTELLEN", '<div class="of-big of-big2"><button type="button" class="of-bigb" data-n="collage">' + ic("grid", 32) + "<b>COLLAGE</b><small>Teile selbst legen</small></button>" +
        '<button type="button" class="of-bigb" data-n="foto">' + ic("camera", 32) + "<b>NACH FOTO</b><small>" + (on ? "Outfit-Foto nachbauen" : "braucht die KI-Erkennung") + "</small></button></div>");
      s.body.addEventListener("click", (e) => {
        const b = e.target.closest("[data-n]"); if (!b) return; s.close();
        if (b.dataset.n === "collage") CO.edit(null);
        else if (!on) { toast("Richte erst die KI-Erkennung ein", "warn", 3500); openSettings(); }
        else INSPO.chooseFile();
      });
    }
    let rwTimer = 0; const scheduleRender = () => { clearTimeout(rwTimer); rwTimer = setTimeout(renderCurrent, 40); };
    $("#ofTabs").addEventListener("click", (e) => { const t = e.target.closest("[data-tab]"); if (t && t.dataset.tab !== ui.tab) setTab(t.dataset.tab); });

    view.addEventListener("click", (e) => {
      const oc = e.target.closest(".of-ocard"); if (oc) return CO.edit(oc.dataset.oid);
      const t = e.target.closest(".of-tile"); if (t) return openItem(t.dataset.id);
      const ly = e.target.closest("[data-ly]"); if (ly) { ui.layer = ui.layer === ly.dataset.ly ? "" : ly.dataset.ly; return renderWardrobe(); }
      const c = e.target.closest("[data-cat]"); if (c) { ui.cat = ui.cat === c.dataset.cat ? "all" : c.dataset.cat; return renderWardrobe(); }
      const f = e.target.closest("[data-f]");
      if (f) { const k = f.dataset.f; if (k === "all") { ui.cat = "all"; ui.layer = ""; ui.fav = ui.dirty = ui.review = false; ui.q = ""; } else ui[k] = !ui[k]; renderWardrobe(); }
    });
    let qTimer = 0;
    view.addEventListener("input", (e) => { if (e.target.id === "ofQ") { clearTimeout(qTimer); ui.q = e.target.value; qTimer = setTimeout(renderWardrobe, 180); } });
    view.addEventListener("change", (e) => { if (e.target.id === "ofSort") { ui.sort = e.target.value; renderWardrobe(); } });

    /* ==========================================================================
       Hinweiszeile oben: Warteschlange, Einrichtungs-Hinweis
       ========================================================================== */
    function renderNotice() {
      const st = store.status(); let h = "";
      if (qInfo.on) h += '<div class="of-nt busy"><span class="of-nt-t"><b>FREISTELLEN ' + Math.min(qInfo.done + 1, qInfo.total) + "/" + qInfo.total + "</b> · " + esc(qInfo.step) + '</span><span class="of-bar-p"><i style="width:' + Math.round(qInfo.pct * 100) + '%"></i></span><button type="button" class="of-btn of-sm" data-act="qcancel">ABBRECHEN</button></div>';
      else if (qInfo.total && qInfo.done) h += '<div class="of-nt ok"><span class="of-nt-t"><b>FERTIG:</b> ' + qInfo.done + (qInfo.done === 1 ? " Teil" : " Teile") + " hinzugefügt" + (qInfo.errors ? ", " + qInfo.errors + " ohne Freistellen" : "") + ". " + (qInfo.aiErr ? "<b>KI hat nichts ausgefüllt:</b> " + esc(qInfo.aiErr) : "Gelb markierte bitte kurz prüfen.") + "</span>" + '<button type="button" class="of-btn of-sm" data-act="qreview">PRÜFEN</button><button type="button" class="of-x" data-act="qclose" aria-label="Ausblenden">×</button></div>';
      if (st.s === "local" && !qInfo.on) h += '<div class="of-nt warn"><span class="of-nt-t"><b>Nur auf diesem Gerät gespeichert.</b> Für Handy und PC verbindest du ein privates GitHub-Repo.</span><button type="button" class="of-btn of-sm" data-act="settings">VERBINDEN</button></div>';
      else if (st.s === "error") h += '<div class="of-nt bad"><span class="of-nt-t"><b>Nicht gesichert:</b> ' + esc(st.msg || "unbekannter Fehler") + '</span><button type="button" class="of-btn of-sm" data-act="retry">NOCHMAL</button><button type="button" class="of-btn of-sm" data-act="settings">EINSTELLUNGEN</button></div>';
      notice.hidden = !h; notice.innerHTML = h;
    }
    notice.addEventListener("click", (e) => {
      const a = e.target.closest("[data-act]"); if (!a) return;
      if (a.dataset.act === "settings") openSettings();
      else if (a.dataset.act === "retry") store.sync();
      else if (a.dataset.act === "qreview") { qInfo.total = qInfo.done = 0; ui.review = true; ui.cat = "all"; ui.tab = "wardrobe"; renderNotice(); renderCurrent(); }
      else if (a.dataset.act === "qclose") { qInfo.total = qInfo.done = qInfo.errors = 0; qInfo.aiErr = ""; renderNotice(); }
      else if (a.dataset.act === "qcancel") { cancelQueue = true; a.disabled = true; }
    });

    /* ==========================================================================
       Hinzufuegen: Kamera / Galerie -> Warteschlange -> freistellen -> Entwurf zum Pruefen
       ========================================================================== */
    let cancelQueue = false;
    function openAdd() {
      const s = sheet("TEIL HINZUFÜGEN", '<p class="of-p">Lege das Teil auf eine ruhige, helle Fläche (Bett, Boden) und fotografiere es von oben. Aus der Galerie kannst du <b>mehrere Fotos auf einmal</b> wählen, sie werden nacheinander freigestellt.</p>' +
        '<div class="of-big"><label class="of-bigb">' + ic("camera", 32) + '<b>KAMERA</b><small>ein Foto aufnehmen</small><input type="file" accept="image/*" capture="environment" data-src="cam" hidden></label>' +
        '<label class="of-bigb">' + ic("image", 32) + '<b>GALERIE</b><small>ein oder mehrere Fotos</small><input type="file" accept="image/*" multiple data-src="gal" hidden></label></div>' +
        '<p class="of-p of-dim">Beim ersten Freistellen lädt der Browser einmalig das Modell (ca. 45 MB, Internet nötig). Danach geht es schneller.</p>');
      s.body.addEventListener("change", (e) => {
        const inp = e.target.closest("input[type=file]"); if (!inp || !inp.files.length) return;
        const files = Array.from(inp.files); s.close(); enqueue(files);
      });
    }
    async function enqueue(files, target) {
      files = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif)$/i.test(f.name || ""));
      if (!files.length) return toast("Keine Bilddatei erkannt", "warn");
      for (const f of files) await store.queue.add(f, target ? { target } : {});
      if (!qInfo.on) { qInfo.total = 0; qInfo.done = 0; qInfo.errors = 0; qInfo.aiErr = ""; }
      qInfo.total += files.length; toast(files.length === 1 ? "Foto wird verarbeitet …" : files.length + " Fotos werden verarbeitet …", "info", 3500);
      runQueue();
    }
    async function runQueue() {
      if (working) return; working = true; cancelQueue = false; qInfo.on = true; renderNotice();
      try {
        for (;;) {
          const list = await store.queue.list(); if (!list.length || cancelQueue) break;
          const job = list[0]; if (!qInfo.total) qInfo.total = list.length;
          qInfo.pct = 0; qInfo.step = "LADE FOTO"; renderNotice();
          try { const r = await processOne(job); if (r && r.uncut) qInfo.errors++; qInfo.done++; }
          catch (err) { console.warn("Outfits: Foto uebersprungen", err); toast("Foto nicht verarbeitet: " + (err && err.message ? err.message : "Fehler"), "warn", 6000); qInfo.done++; qInfo.errors++; }
          await store.queue.done(job.id);
        }
        if (cancelQueue) { const rest = await store.queue.list(); for (const j of rest) await store.queue.done(j.id); qInfo.total = qInfo.done; }
      } finally { working = false; qInfo.on = false; renderNotice(); scheduleRender(); }
    }
    /* Fortschritt hoechstens ca. 8 mal pro Sekunde zeichnen (jedes Zeichnen baut die Meldung neu), die letzte Anzeige kommt immer nach */
    let stepAt = 0, stepT = 0;
    function step(txt, pct) {
      qInfo.step = txt; if (pct != null) qInfo.pct = pct;
      const now = Date.now(); clearTimeout(stepT);
      if (now - stepAt >= 120) { stepAt = now; renderNotice(); } else stepT = setTimeout(() => { stepAt = Date.now(); renderNotice(); }, 120);
    }
    async function processOne(job) {
      const set = store.settings, bmp = await P.decode(job.blob), work = P.fit(bmp, 1024);
      let cut = null, uncut = false;
      if (set.get("cutMode") !== "off") {
        step("STELLE FREI", 0.05);
        try {
          cut = await P.cutout(work, { model: set.get("cutModel") === "better" ? "isnet_fp16" : "isnet_quint8", gpu: !!set.get("cutGpu"), onProgress: (p, tot) => { if (tot > 100000) step(p < 0.999 ? "LADE FREISTELLER " + Math.round(p * 100) + " %" : "STELLE FREI", p * 0.8); } });
        } catch (e) { console.warn("Freistellen fehlgeschlagen", e); uncut = true; toast(e.message || "Freistellen nicht möglich, Foto bleibt unverändert", "warn", 6000); }
      }
      let fin = cut ? P.trim(cut, 24, 0.04) : null;
      if (fin && (fin.empty || fin.coverage < 0.02)) { fin = null; uncut = true; toast("Freistellen hat kein Teil gefunden, Foto bleibt unverändert", "warn", 6000); }
      const base = fin ? fin.canvas : work;
      step("ERKENNE FARBEN", 0.88); const cols = P.colors(base, 3);
      let ai = null, aiErr = "";
      if (O.ai.configured(store)) { step("KI SCHAUT HIN", 0.92); try { ai = await O.ai.analyze(store, base, { cats: store.cats(), occ: store.occs() }); } catch (e) { aiErr = e.message; qInfo.aiErr = aiErr; console.warn("KI-Erkennung:", e); } }
      step("SPEICHERE", 0.97);
      const blobs = await P.makeBlobs(base);
      const cat0 = ai && catById(ai.cat) ? ai.cat : "other", cd = catById(cat0) || { warm: 2, formal: 2 };
      const lay0 = D.LAYER_OF_SLOT[store.slotOf(cat0)] ? (ai && D.LAYERS[ai.layer] ? ai.layer : defaultLayer(cat0)) : "";
      const item = { id: job.target || uid(), cat: cat0, layer: lay0, name: ai && ai.name ? ai.name : "", colors: cols.length ? cols.map((c) => c.hex) : ai && Array.isArray(ai.colors) ? ai.colors : [], brand: ai && ai.brand || "", material: ai && ai.material || "", size: "",
        warmth: ai && ai.warmth || cd.warm, formal: ai && ai.formal || cd.formal, occ: ai && Array.isArray(ai.occ) ? ai.occ.filter((o) => store.occs().indexOf(o) >= 0) : [], review: true, added: Date.now(),
        ai: ai ? { conf: ai.conf || 0.6, fields: ["cat", "layer", "brand", "material", "warmth", "formal", "occ", "name"].filter((k) => ai[k] != null && ai[k] !== "") } : null };
      if (job.target && store.byId(job.target)) { const old = store.byId(job.target); Object.assign(item, { cat: old.cat, layer: old.layer, name: old.name, brand: old.brand, material: old.material, size: old.size, price: old.price, bought: old.bought, warmth: old.warmth, formal: old.formal, occ: old.occ, note: old.note, fav: old.fav, dirty: old.dirty, wears: old.wears, last: old.last, added: old.added, review: old.review, colors: old.colors }); }
      await store.putItem(item, blobs);
      /* Original und Freistellung bleiben auf diesem Geraet, damit Nachbessern (Zurueckholen) spaeter geht */
      try { await store.putAux("orig", item.id, await P.toBlob(work, "image/jpeg", 0.88)); if (cut) await store.putAux("cut", item.id, await P.toBlob(cut, "image/webp", 0.92)); } catch (e) { /* egal */ }
      if (aiErr) toast("KI-Erkennung nicht möglich: " + aiErr, "warn", 6000);
      return { uncut };
    }

    /* ==========================================================================
       Teil ansehen und bearbeiten
       ========================================================================== */
    function catOptions(sel) {
      const cats = store.cats();
      return Object.keys(D.SLOTS).map((slot) => { const l = cats.filter((c) => c.slot === slot); return l.length ? '<optgroup label="' + esc(D.SLOTS[slot]) + '">' + l.map((c) => '<option value="' + esc(c.id) + '"' + (c.id === sel ? " selected" : "") + ">" + esc(c.label) + "</option>").join("") + "</optgroup>" : ""; }).join("");
    }
    const scaleHtml = (key, v, a, b) => '<div class="of-fld"><div class="of-lbl">' + (key === "warmth" ? "WÄRME" : "FORMALITÄT") + '</div><div class="of-scale" data-scale="' + key + '">' + [1, 2, 3, 4, 5].map((n) => '<button type="button" class="of-sc' + (n === v ? " on" : "") + '" data-v="' + n + '">' + n + '</button>').join("") + '</div><div class="of-scale-l"><span>' + a + "</span><span>" + b + "</span></div></div>";
    function openItem(id) {
      const it0 = store.byId(id); if (!it0) return;
      const it = JSON.parse(JSON.stringify(it0)); /* Arbeitskopie: erst "Speichern" aendert den Stand */
      let layer = it.layer || defaultLayer(it.cat), layerTouched = !!it.layer;
      let cols = it.colors.slice(), occ = it.occ.slice(), fav = it.fav, dirty = it.dirty, ai = (it.ai && it.ai.fields) || [], confirmDel = false;
      const aiMark = (k) => (ai.indexOf(k) >= 0 ? ' <i class="of-ai" title="Von der KI vorausgefüllt, bitte prüfen">KI</i>' : "");
      const s = sheet(it.review ? "TEIL PRÜFEN" : "TEIL", "", { wide: true });
      const render = () => {
        s.body.innerHTML =
          '<div class="of-item"><div class="of-pic"><span class="of-img big"><img alt="" id="ofBig"></span>' +
          '<div class="of-pic-b"><button type="button" class="of-btn of-sm" data-a="retouch">' + ic("brush", 12) + ' NACHBESSERN</button><button type="button" class="of-btn of-sm" data-a="retake">' + ic("camera", 12) + " NEUES FOTO</button></div>" +
          '<div class="of-flags"><button type="button" class="of-flag' + (fav ? " on" : "") + '" data-a="fav">' + ic("heart", 14) + ' LIEBLINGSTEIL</button><button type="button" class="of-flag' + (dirty ? " on" : "") + '" data-a="dirty">' + ic("drop", 14) + " SCHMUTZIG</button></div></div>" +
          '<div class="of-form">' +
          '<label class="of-fld"><span class="of-lbl">BEZEICHNUNG' + aiMark("name") + '</span><input name="name" maxlength="80" placeholder="z. B. Navy-Hoodie mit Logo" value="' + esc(it.name) + '"></label>' +
          '<label class="of-fld"><span class="of-lbl">KATEGORIE' + aiMark("cat") + '</span><select name="cat">' + catOptions(catById(it.cat) ? it.cat : "other") + "</select></label>" +
          (D.LAYER_OF_SLOT[store.slotOf(it.cat)] ? '<div class="of-fld"><div class="of-lbl">SCHICHT (LAYER)' + aiMark("layer") + '</div><div class="of-lay">' + ["base", "mid", "outer"].map((k) => '<button type="button" class="of-ly-b' + (layer === k ? " on" : "") + '" data-a="layer" data-l="' + k + '">' + D.LAYERS[k].label + "</button>").join("") + '</div><div class="of-scale-l"><span>' + esc(D.LAYERS[layer] ? D.LAYERS[layer].name + ": " + D.LAYERS[layer].hint : "") + "</span></div></div>" : "") +
          '<div class="of-fld"><div class="of-lbl">FARBEN' + aiMark("colors") + '</div><div class="of-cols">' + cols.map((c, i) => '<span class="of-col"><i style="background:' + c + '"></i>' + esc(Co.nameOf(c)) + '<button type="button" data-a="delcol" data-i="' + i + '" aria-label="Farbe entfernen">×</button></span>').join("") + (cols.length < 3 ? '<label class="of-col add" title="Farbe hinzufügen">+ FARBE<input type="color" data-a="addcol" value="#808080"></label>' : "") + "</div></div>" +
          '<div class="of-row2"><label class="of-fld"><span class="of-lbl">MARKE' + aiMark("brand") + '</span><input name="brand" maxlength="40" value="' + esc(it.brand) + '"></label><label class="of-fld"><span class="of-lbl">GRÖSSE</span><input name="size" maxlength="20" placeholder="M, 32/34, 43 …" value="' + esc(it.size) + '"></label></div>' +
          '<label class="of-fld"><span class="of-lbl">MATERIAL' + aiMark("material") + '</span><input name="material" maxlength="60" placeholder="z. B. 80 % Baumwolle, 20 % Polyester" value="' + esc(it.material) + '"></label>' +
          '<div class="of-row2"><label class="of-fld"><span class="of-lbl">PREIS (€)</span><input name="price" inputmode="decimal" placeholder="0,00" value="' + (it.price == null ? "" : String(it.price).replace(".", ",")) + '"></label><label class="of-fld"><span class="of-lbl">GEKAUFT AM</span><input name="bought" type="date" value="' + esc(it.bought) + '"></label></div>' +
          '<div class="of-row2">' + scaleHtml("warmth", it.warmth, "kühl", "sehr warm") + scaleHtml("formal", it.formal, "leger", "elegant") + "</div>" +
          '<div class="of-fld"><div class="of-lbl">ANLÄSSE' + aiMark("occ") + '</div><div class="of-chips tight">' + store.occs().map((o) => '<button type="button" class="of-chip' + (occ.indexOf(o) >= 0 ? " on" : "") + '" data-a="occ" data-o="' + esc(o) + '">' + esc(o) + "</button>").join("") + "</div></div>" +
          '<label class="of-fld"><span class="of-lbl">NOTIZ</span><textarea name="note" rows="2" maxlength="300">' + esc(it.note) + "</textarea></label>" +
          "</div></div>" +
          '<div class="of-actions"><button type="button" class="of-btn of-bad" data-a="del">' + ic("trash", 14) + (confirmDel ? " WIRKLICH LÖSCHEN?" : " LÖSCHEN") + '</button><span class="of-sp"></span><button type="button" class="of-btn" data-a="cancel">ABBRECHEN</button><button type="button" class="of-btn of-go" data-a="save">' + (it.review ? ic("check", 14) + " PASST SO" : "SPEICHERN") + "</button></div>";
        store.photoURL(id).then((u) => store.thumbURL(id).then((t) => { const im = $("#ofBig", s.body); if (im && (u || t)) { im.src = u || t; im.classList.add("on"); } }));
      };
      const read = () => {
        const f = (n) => s.body.querySelector('[name="' + n + '"]'), val = (n) => (f(n) ? f(n).value : "");
        const pr = val("price").trim().replace(",", "."); const price = pr === "" ? null : parseFloat(pr);
        const sc = (k) => { const b = s.body.querySelector('[data-scale="' + k + '"] .on'); return b ? +b.dataset.v : it[k === "formal" ? "formal" : "warmth"]; };
        return Object.assign({}, it, { name: val("name").trim(), cat: val("cat"), layer: D.LAYER_OF_SLOT[store.slotOf(val("cat"))] ? layer : "", colors: cols, brand: val("brand").trim(), size: val("size").trim(), material: val("material").trim(), price: isFinite(price) ? price : null, bought: val("bought"), warmth: sc("warmth"), formal: sc("formal"), occ, note: val("note").trim(), fav, dirty });
      };
      render();
      s.body.addEventListener("click", async (e) => {
        const sc = e.target.closest(".of-sc"); if (sc) { sc.parentNode.querySelectorAll(".of-sc").forEach((b) => b.classList.toggle("on", b === sc)); return; }
        const a = e.target.closest("[data-a]"); if (!a) return; const act = a.dataset.a;
        if (act === "layer") { const cur = read(); Object.assign(it, cur); layer = a.dataset.l; layerTouched = true; it.layer = layer; render(); }
        else if (act === "occ") { const o = a.dataset.o, i = occ.indexOf(o); if (i >= 0) occ.splice(i, 1); else occ.push(o); a.classList.toggle("on"); }
        else if (act === "delcol") { const cur = read(); it.name = cur.name; Object.assign(it, cur); cols.splice(+a.dataset.i, 1); it.colors = cols; render(); }
        else if (act === "fav") { fav = !fav; a.classList.toggle("on", fav); }
        else if (act === "dirty") { dirty = !dirty; a.classList.toggle("on", dirty); }
        else if (act === "cancel") s.close();
        else if (act === "save") { const next = read(); next.review = false; await store.putItem(next); toast("Gespeichert", "ok", 2200); s.close(); }
        else if (act === "del") { if (!confirmDel) { confirmDel = true; a.lastChild.textContent = " WIRKLICH LÖSCHEN?"; a.classList.add("armed"); setTimeout(() => { confirmDel = false; if (a.isConnected) { a.lastChild.textContent = " LÖSCHEN"; a.classList.remove("armed"); } }, 4000); } else { await store.removeItem(id); toast("Teil gelöscht", "ok", 2200); s.close(); } }
        else if (act === "retouch") { const cur = read(); Object.assign(it, cur); await retouch(id, s); }
        else if (act === "retake") { const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.onchange = () => { if (inp.files[0]) { Object.assign(it, read()); store.putItem(it).then(() => { s.close(); enqueue([inp.files[0]], id); }); } }; inp.click(); }
      });
      s.body.addEventListener("input", (e) => {
        const a = e.target.closest('[data-a="addcol"]'); if (!a) return;
      });
      s.body.addEventListener("change", (e) => {
        if (e.target.name === "cat") { const cur = read(); Object.assign(it, cur); it.cat = e.target.value; if (!layerTouched || !layer) layer = defaultLayer(it.cat); it.layer = layer; render(); return; }
        const a = e.target.closest('[data-a="addcol"]'); if (!a) return;
        const cur = read(); Object.assign(it, cur); cols.push(a.value.toLowerCase()); it.colors = cols; render();
      });
    }
    async function retouch(id, s) {
      try {
        const cutAux = await store.getAux("cut", id), origAux = await store.getAux("orig", id);
        const src = cutAux || (await store.blobOf("photo", id)) || (await store.blobOf("thumb", id));
        if (!src) return toast("Foto noch nicht auf diesem Gerät geladen", "warn");
        const cutC = P.fit(await P.decode(src), cutAux ? 1024 : 720);
        let origC = cutC;
        if (origAux) { origC = document.createElement("canvas"); origC.width = cutC.width; origC.height = cutC.height; origC.getContext("2d").drawImage(await P.decode(origAux), 0, 0, origC.width, origC.height); }
        const out = await P.editor(origC, cutC);
        if (!out) return;
        const fin = P.trim(out, 24, 0.04); if (fin.empty) return toast("Es ist nichts mehr übrig", "warn");
        await store.putItem(Object.assign({}, store.byId(id)), await P.makeBlobs(fin.canvas));
        await store.putAux("cut", id, await P.toBlob(out, "image/webp", 0.92));
        toast("Foto aktualisiert", "ok", 2200); s.close(); openItem(id);
      } catch (e) { console.warn(e); toast("Nachbessern nicht möglich: " + e.message, "warn", 6000); }
    }

    /* ==========================================================================
       Einstellungen
       ========================================================================== */
    function openSettings() {
      const set = store.settings, st = store.status(), owner = set.get("owner") || deps.owner || "";
      const s = sheet("EINSTELLUNGEN", "", { wide: true });
      let cats = store.cats().map((c) => Object.assign({}, c)), occs = store.occs();
      const used = (id) => store.items().filter((i) => i.cat === id).length;
      const open = {};   /* welche Bereiche aufgeklappt sind, bleibt beim Neuzeichnen erhalten */
      const det = (key, title, body) => '<details class="of-det" data-sec="' + key + '"' + (open[key] ? " open" : "") + "><summary>" + title + '</summary><div class="of-in">' + body + "</div></details>";
      const render = () => {
        const repo = set.get("repo") || "outfit-daten", aiOn = O.ai.configured(store);
        s.body.innerHTML =
          '<section class="of-sec"><h3 class="of-px">SPEICHER</h3>' +
          '<p class="of-p" id="ofRepoMsg" aria-live="polite">' + esc(store.remoteOn() ? owner + "/" + repo + " · " + statusText(st) : "Nur auf diesem Gerät. " + statusText(st)) + "</p>" +
          '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="syncnow">JETZT ABGLEICHEN</button><button type="button" class="of-btn of-sm" data-a="edit" data-t="ofRepoEdit">ÄNDERN</button></div>' +
          '<div class="of-in" id="ofRepoEdit" hidden><div class="of-row2"><label class="of-fld"><span class="of-lbl">BESITZER</span><input name="owner" value="' + esc(owner) + '" placeholder="dein GitHub-Name"></label><label class="of-fld"><span class="of-lbl">PRIVATES REPO</span><input name="repo" value="' + esc(repo) + '" placeholder="outfit-daten"></label></div>' +
          '<label class="of-chk"><input type="checkbox" name="remote"' + (set.get("remote") === false ? "" : " checked") + '> Mit dem privaten Repo abgleichen (sonst nur auf diesem Gerät)</label>' +
          '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="saverepo">SPEICHERN</button><button type="button" class="of-btn of-sm" data-a="testrepo">VERBINDUNG PRÜFEN</button></div></div></section>' +
          '<section class="of-sec"><h3 class="of-px">KI-ERKENNUNG</h3>' +
          '<p class="of-p" id="ofAiMsg" aria-live="polite">' + (aiOn ? "Eingetragen. TESTEN prüft die Verbindung." : "Nicht eingerichtet. Neue Teile musst du dann von Hand ausfüllen.") + "</p>" +
          '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="testai">TESTEN</button><button type="button" class="of-btn of-sm" data-a="edit" data-t="ofAiEdit">ÄNDERN</button></div>' +
          '<div class="of-in" id="ofAiEdit" hidden><div class="of-row2"><label class="of-fld"><span class="of-lbl">WORKER-ADRESSE</span><input name="aiUrl" value="' + esc(set.get("aiUrl") || "") + '" placeholder="https://outfit-ai.DEIN-NAME.workers.dev" autocapitalize="off" autocomplete="off"></label><label class="of-fld"><span class="of-lbl">GEHEIMES WORT</span><input name="aiKey" type="password" value="' + esc(set.get("aiKey") || "") + '" placeholder="wie im Worker hinterlegt" autocomplete="off"></label></div>' +
          '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="saveai">SPEICHERN</button></div></div></section>' +
          det("cut", "FREISTELLEN",
            '<div class="of-row2"><label class="of-fld"><span class="of-lbl">MODUS</span><select name="cutMode"><option value="auto"' + (set.get("cutMode") !== "off" ? " selected" : "") + '>Automatisch</option><option value="off"' + (set.get("cutMode") === "off" ? " selected" : "") + '>Aus</option></select></label>' +
            '<label class="of-fld"><span class="of-lbl">QUALITÄT</span><select name="cutModel"><option value="fast"' + (set.get("cutModel") !== "better" ? " selected" : "") + '>Schnell</option><option value="better"' + (set.get("cutModel") === "better" ? " selected" : "") + ">Besser (langsamer)</option></select></label></div>" +
            '<label class="of-chk"><input type="checkbox" name="cutGpu"' + (set.get("cutGpu") ? " checked" : "") + "> Grafikchip nutzen (experimentell)</label>") +
          det("cats", "KATEGORIEN · " + cats.length,
            '<div class="of-catl">' +
            cats.map((c, i) => '<div class="of-cat"><input data-ci="' + i + '" data-k="label" value="' + esc(c.label) + '" maxlength="40" aria-label="Name"><select data-ci="' + i + '" data-k="slot" aria-label="Platz">' + Object.keys(D.SLOTS).map((k) => '<option value="' + k + '"' + (c.slot === k ? " selected" : "") + ">" + D.SLOTS[k] + "</option>").join("") + '</select><span class="of-cnt">' + used(c.id) + '</span><button type="button" class="of-btn of-sm of-bad" data-a="delcat" data-ci="' + i + '"' + (used(c.id) ? " disabled title=\"Erst die Teile in eine andere Kategorie legen\"" : "") + ' aria-label="Löschen">×</button></div>').join("") + "</div>" +
            '<div class="of-cat add"><input id="ofNewCat" placeholder="Neue Kategorie, z. B. Trikots" maxlength="40"><select id="ofNewSlot">' + Object.keys(D.SLOTS).map((k) => '<option value="' + k + '">' + D.SLOTS[k] + "</option>").join("") + '</select><button type="button" class="of-btn of-sm" data-a="addcat">HINZUFÜGEN</button></div>' +
            '<div class="of-actions left"><button type="button" class="of-btn of-sm of-go" data-a="savecats">KATEGORIEN SPEICHERN</button></div>') +
          det("occ", "ANLÄSSE · " + occs.length,
            '<div class="of-chips tight">' + occs.map((o, i) => '<span class="of-chip on">' + esc(o) + '<button type="button" data-a="delocc" data-oi="' + i + '" aria-label="Entfernen">×</button></span>').join("") + '</div><div class="of-cat add"><input id="ofNewOcc" placeholder="Neuer Anlass, z. B. Festival" maxlength="24"><button type="button" class="of-btn of-sm" data-a="addocc">HINZUFÜGEN</button><button type="button" class="of-btn of-sm of-go" data-a="saveocc">SPEICHERN</button></div>') +
          '<div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="export">LISTE ALS DATEI SICHERN</button></div>';
      };
      render();
      const val = (n) => { const el = s.body.querySelector('[name="' + n + '"]'); return el ? (el.type === "checkbox" ? el.checked : el.value.trim()) : ""; };
      const msg = (id, t, kind) => { const el = s.body.querySelector("#" + id); if (el) { el.textContent = t; el.dataset.k = kind || ""; } };
      s.body.addEventListener("input", (e) => { const i = e.target.dataset.ci; if (i != null && e.target.dataset.k === "label") cats[+i].label = e.target.value; });
      s.body.addEventListener("change", (e) => { const i = e.target.dataset.ci; if (i != null && e.target.dataset.k === "slot") cats[+i].slot = e.target.value; });
      s.body.addEventListener("toggle", (e) => { const k = e.target.dataset && e.target.dataset.sec; if (k) open[k] = e.target.open; }, true);
      s.body.addEventListener("change", (e) => { if (/^cut(Mode|Model|Gpu)$/.test(e.target.name || "")) { set.set({ cutMode: val("cutMode"), cutModel: val("cutModel"), cutGpu: !!val("cutGpu") }); toast("Gespeichert", "ok", 1500); } });
      s.body.addEventListener("click", async (e) => {
        const a = e.target.closest("[data-a]"); if (!a) return; const act = a.dataset.a;
        if (act === "edit") { const box = s.body.querySelector("#" + a.dataset.t); if (box) box.hidden = !box.hidden; return; }
        if (act === "saverepo") { set.set({ owner: val("owner"), repo: val("repo") || "outfit-daten", remote: !!val("remote") }); msg("ofRepoMsg", "Gespeichert.", "ok"); store.sync(); }
        else if (act === "testrepo") { set.set({ owner: val("owner"), repo: val("repo") || "outfit-daten", remote: !!val("remote") }); msg("ofRepoMsg", "Prüfe …"); const r = await store.test(); msg("ofRepoMsg", r.msg, r.ok ? "ok" : "bad"); if (r.ok) store.sync(); }
        else if (act === "syncnow") { msg("ofRepoMsg", "Gleiche ab …"); const ok = await store.sync(); msg("ofRepoMsg", ok ? "Alles gesichert." : statusText(store.status()), ok ? "ok" : "bad"); }
        else if (act === "saveai") { set.set({ aiUrl: val("aiUrl"), aiKey: val("aiKey") }); msg("ofAiMsg", "Gespeichert.", "ok"); }
        else if (act === "testai") { set.set({ aiUrl: val("aiUrl"), aiKey: val("aiKey") }); msg("ofAiMsg", "Teste …"); try { const r = await O.ai.ping(store); msg("ofAiMsg", "Verbunden" + (r.model ? " (Modell " + String(r.model).replace(/^@cf\/[^/]+\//, "") + ")" : "") + "." + (r.inspo ? "" : " „Nach Foto“ geht erst nach einem Worker-Update."), r.inspo ? "ok" : "bad"); } catch (err) { msg("ofAiMsg", "Nicht erreichbar: " + err.message, "bad"); } }
        else if (act === "addcat") { const n = s.body.querySelector("#ofNewCat").value.trim(); if (!n) return; const id = "c" + uid().slice(0, 8); cats.push({ id, label: n, slot: s.body.querySelector("#ofNewSlot").value, warm: 2, formal: 2, upd: 0 }); render(); }
        else if (act === "delcat") { const i = +a.dataset.ci; if (!used(cats[i].id)) { cats.splice(i, 1); render(); } }
        else if (act === "savecats") { if (cats.some((c) => !c.label.trim())) return toast("Eine Kategorie hat keinen Namen", "warn"); if (!cats.some((c) => c.id === "other")) cats.push({ id: "other", label: "Sonstiges", slot: "acc", warm: 2, formal: 2, upd: 0 }); await store.saveCats(cats); toast("Kategorien gespeichert", "ok", 2200); }
        else if (act === "addocc") { const n = s.body.querySelector("#ofNewOcc").value.trim(); if (n && occs.indexOf(n) < 0) { occs.push(n); render(); } }
        else if (act === "delocc") { occs.splice(+a.dataset.oi, 1); render(); }
        else if (act === "saveocc") { await store.saveCats(store.cats(), occs); toast("Anlässe gespeichert", "ok", 2200); }
        else if (act === "export") { const b = new Blob([store.exportJson()], { type: "application/json" }), u = URL.createObjectURL(b), l = document.createElement("a"); l.href = u; l.download = "outfits-" + O.util.dayKey() + ".json"; l.click(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
      });
    }
    function statusText(st) {
      return { local: "Aktuell nur auf diesem Gerät. Repo und Token einrichten, dann wird abgeglichen.", load: "Lade …", sync: "Gleiche ab …", idle: st.pending ? "Noch " + st.pending + " Änderung(en) zu sichern." : "Alles gesichert.", error: "Fehler: " + (st.msg || "unbekannt") }[st.s] || "";
    }

    /* ==========================================================================
       Verdrahtung
       ========================================================================== */
    $("#ofAdd").addEventListener("click", () => (ui.tab === "outfits" ? newOutfit() : openAdd()));
    $("#ofSet").addEventListener("click", openSettings);
    store.on("change", scheduleRender);
    store.on("status", () => { renderNotice(); renderSync(); });
    store.settings.set({}); /* Einstellungen einmal lesen/ausloesen */
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && store.remoteOn()) store.syncSoon(800); });
    (async function start() {
      await store.ready; renderCurrent(); renderNotice(); renderSync();
      if (store.remoteOn()) store.sync();
      const left = await store.queue.list(); if (left.length) { qInfo.total = left.length; runQueue(); }
    })();

    const api = { store, collage: CO, inspo: INSPO, refresh: () => { scheduleRender(); }, sync: () => store.sync(), metric: () => store.items().length + " TEILE" + (store.outfits().length ? " · " + store.outfits().length + (store.outfits().length === 1 ? " OUTFIT" : " OUTFITS") : "") };
    O.board = api; /* fuer die Fehlersuche in der Browser-Konsole: Outfit.board.store */
    return api;
  };
})();
