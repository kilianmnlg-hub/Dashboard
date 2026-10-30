/* Outfits (Bereich "Outfits"), Teil 5: "Nach Foto nachbauen". Du waehlst das Foto eines Outfits, die KI (Worker /inspo) beschreibt die einzelnen Teile, die App sucht
   fuer jedes Teil das passendste aus deinem Schrank (Kategorie, Farbe, Woerter der Beschreibung, Schicht, Formalitaet) und legt daraus eine Collage. Was im Schrank fehlt,
   bleibt als gestrichelter Platzhalter. Das Foto selbst wird nur kurz an die KI geschickt und nicht gespeichert.
   O.inspo(deps) liefert { start(datei) }; deps: store, toast, ic, sheet, CO (Collage-Modul), itemTitle, layerOf. */
(function () {
  "use strict";
  const O = window.Outfit;
  if (!O || !O.util || !O.photo || !O.ai || !O.collage || !O.color) return;
  const { esc, clamp } = O.util, Co = O.color, P = O.photo;
  /* Ein Teil auf dem Foto kann nur durch ein Teil aus derselben Gruppe ersetzt werden (T-Shirt und Pullover duerfen sich vertreten, eine Muetze keinen Guertel) */
  const GROUP = { top: "up", mid: "up", outer: "outer", dress: "dress", bottom: "bottom", shoes: "shoes", acc: "acc" };
  const words = (s) => String(s || "").toLowerCase().replace(/[^a-zäöüß0-9]+/g, " ").split(" ").filter((w) => w.length >= 4);
  const sameWord = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

  O.inspo = function (deps) {
    const { store, toast, ic, sheet, CO, itemTitle, layerOf } = deps;
    const slotOf = (cat) => store.slotOf(cat), groupOf = (cat) => GROUP[slotOf(cat)] || "acc";
    const catLabel = (id) => { const c = store.cats().find((x) => x.id === id); return c ? c.label : "Teil"; };

    /* Wie gut passt ein Teil aus dem Schrank zu einem Teil auf dem Foto? 0 = gar nicht, 1 = genau */
    function score(piece, it) {
      if (groupOf(piece.cat) !== groupOf(it.cat)) return 0;
      let c;
      if (piece.cat === it.cat) c = 1;
      else if (groupOf(it.cat) === "acc") c = piece.cat === "other" || it.cat === "other" ? 0.3 : 0;
      else c = slotOf(piece.cat) === slotOf(it.cat) ? 0.6 : 0.35;
      if (!c) return 0;
      let cs = 0.5;
      if (piece.colors && piece.colors.length && it.colors && it.colors.length) {
        let best = 99; piece.colors.forEach((a) => it.colors.forEach((b) => { best = Math.min(best, Co.dE(Co.hex2lab(a), Co.hex2lab(b))); }));
        cs = clamp(1 - best / 50, 0, 1);
      }
      const pw = words(piece.desc), iw = words([it.name, it.material, it.note, (it.colors || []).map(Co.nameOf).join(" ")].join(" "));
      let tb = 0; pw.forEach((w) => { if (iw.some((x) => sameWord(w, x))) tb += 0.06; }); tb = Math.min(tb, 0.15);
      const lay = piece.layer && layerOf(it) === piece.layer ? 0.05 : 0, fm = piece.formal ? 0.05 * (1 - Math.abs(piece.formal - it.formal) / 4) : 0;
      return clamp(0.5 * c + 0.35 * cs + tb + lay + fm - (it.dirty ? 0.08 : 0) + (it.fav ? 0.02 : 0), 0, 1);
    }
    const quality = (s) => (s >= 0.78 ? "exact" : s >= 0.5 ? "similar" : "manual");
    /* Jedem Teil auf dem Foto das beste noch freie Teil aus dem Schrank zuordnen (hoechster Wert zuerst, ein Teil nur einmal) */
    function assign(pieces) {
      const pairs = []; pieces.forEach((p, i) => store.items().forEach((it) => { const s = score(p, it); if (s >= 0.5) pairs.push({ i, id: it.id, s }); }));
      pairs.sort((a, b) => b.s - a.s);
      const used = new Set(), got = {};
      pairs.forEach((q) => { if (got[q.i] == null && !used.has(q.id)) { got[q.i] = q.id; used.add(q.id); } });
      return pieces.map((p, i) => got[i] || null);
    }

    const ratios = new Map();
    function ratioOf(id) {
      if (ratios.has(id)) return Promise.resolve(ratios.get(id));
      return store.thumbURL(id).then((u) => new Promise((res) => { if (!u) return res(1); const im = new Image(); im.onload = () => { const r = im.naturalWidth && im.naturalHeight ? im.naturalWidth / im.naturalHeight : 1; ratios.set(id, r); res(r); }; im.onerror = () => res(1); im.src = u; })).catch(() => 1);
    }
    function loadThumb(img) { store.thumbURL(img.dataset.id).then((u) => { if (u && img.isConnected) { img.src = u; img.classList.add("on"); } }).catch(() => {}); }

    /* ---------- Ablauf ---------- */
    async function start(file) {
      if (!store.items().length) return toast("Lege zuerst Teile im Schrank an", "warn", 3500);
      let canvas = null, photoUrl = "", pieces = null, pick = [], closed = false;
      const s = sheet("NACH FOTO", '<p class="of-p">KI schaut hin …</p>', { onClose: () => { closed = true; if (photoUrl) URL.revokeObjectURL(photoUrl); } });
      const body = s.body;
      const fail = (msg) => { if (closed) return; body.innerHTML = '<p class="of-p" data-k="bad">' + esc(msg) + '</p><div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="retry">NOCHMAL</button><button type="button" class="of-btn of-sm" data-a="again">ANDERES FOTO</button></div>'; };

      async function ask() {
        body.innerHTML = '<p class="of-p">KI schaut hin …</p><div class="of-bar-p"><i style="width:35%"></i></div>';
        try {
          const list = await O.ai.inspo(store, canvas, { cats: store.cats() });
          if (closed) return;
          if (!list.length) return fail("Auf dem Foto habe ich keine Kleidung erkannt. Probier ein Foto, auf dem das ganze Outfit gut zu sehen ist.");
          pieces = list; pick = assign(pieces); await render();
        } catch (e) { fail(/Unbekannter Pfad|Status 404/i.test(e.message) ? "Der KI-Worker kennt „Nach Foto“ noch nicht. Er muss einmal aktualisiert werden." : "Die KI antwortet nicht: " + e.message); }
      }

      /* Entwurf der Collage aus der aktuellen Auswahl */
      async function draft() {
        const rows = await Promise.all(pieces.map(async (p, i) => { const it = pick[i] ? store.byId(pick[i]) : null; return { p, it, slot: it ? slotOf(it.cat) : slotOf(p.cat), layer: it ? layerOf(it) : p.layer || "", ratio: it ? await ratioOf(it.id) : 1 }; }));
        const lay = O.collage.arrange(rows.map((r) => ({ slot: r.slot, layer: r.layer, ratio: r.ratio })));
        const d = new Date(), pad = (n) => String(n).padStart(2, "0");
        return {
          name: "Nach Foto " + pad(d.getDate()) + "." + pad(d.getMonth() + 1) + ".", bg: "paper", occ: [], fav: false,
          items: rows.map((r, i) => Object.assign(r.it ? { id: r.it.id } : { ghost: String(r.p.desc || catLabel(r.p.cat)).slice(0, 60), cat: r.p.cat }, { fx: 1 }, lay[i])),
          inspo: { at: Date.now(), pieces: pieces.map((p, i) => ({ desc: p.desc, slot: slotOf(p.cat), cat: p.cat, id: pick[i] || "", q: pick[i] ? (quality(score(p, store.byId(pick[i]) || {})) === "exact" ? "exact" : "similar") : "" })) }
        };
      }
      async function render() {
        const d = await draft(); if (closed) return;
        const n = pieces.length, found = pick.filter(Boolean).length;
        const sum = found === n ? "Alle habe ich in deinem Schrank gefunden." : found ? found + " habe ich in deinem Schrank gefunden, " + (n - found) + (n - found === 1 ? " fehlt." : " fehlen.") : "Nichts davon habe ich in deinem Schrank gefunden.";
        body.innerHTML =
          '<div class="of-ph"><div class="of-ph-img"><img alt="" src="' + photoUrl + '"></div><div class="of-ph-t"><p class="of-p"><b>Ich sehe ' + n + (n === 1 ? " Teil." : " Teile.") + "</b> " + sum + '</p><div class="of-actions left"><button type="button" class="of-btn of-sm" data-a="again">ANDERES FOTO</button></div></div></div>' +
          '<div class="of-pl">' + pieces.map((p, i) => {
            const it = pick[i] ? store.byId(pick[i]) : null;
            if (!it) return '<div class="of-pr miss"><span class="of-co-ghost">?</span><div class="of-pr-t"><span>Nichts Passendes im Schrank</span><em>Foto: ' + esc(p.desc || catLabel(p.cat)) + '</em></div><button type="button" class="of-btn of-sm" data-a="pick" data-i="' + i + '">WÄHLEN</button></div>';
            const q = quality(score(p, it));
            return '<div class="of-pr"><span class="of-img"><img alt="" data-id="' + esc(it.id) + '"></span><div class="of-pr-t"><span>' + esc(itemTitle(it)) + (q === "exact" ? ' <i class="of-q ok">GENAU</i>' : q === "similar" ? ' <i class="of-q mid">ÄHNLICH</i>' : "") + '</span><em>Foto: ' + esc(p.desc || catLabel(p.cat)) + '</em></div><button type="button" class="of-btn of-sm" data-a="pick" data-i="' + i + '">TAUSCHEN</button></div>';
          }).join("") + "</div>" +
          '<div class="of-inspo-cv"><div class="of-co-cv"></div></div>' +
          '<div class="of-actions"><button type="button" class="of-btn of-go" data-a="open">ALS COLLAGE ÖFFNEN</button><button type="button" class="of-btn" data-a="save">SPEICHERN</button></div>';
        CO.paint(body.querySelector(".of-co-cv"), d, { big: true });
        body.querySelectorAll(".of-pr img[data-id]").forEach(loadThumb);
        st.draft = d;
      }
      const st = { draft: null };

      /* Teil fuer ein Teil des Fotos waehlen */
      function openPick(i) {
        const p = pieces[i], g = groupOf(p.cat);
        const list = store.items().filter((it) => groupOf(it.cat) === g).map((it) => ({ it, s: score(p, it) })).sort((a, b) => b.s - a.s || b.it.added - a.it.added);
        const ps = sheet("TEIL WÄHLEN", "", { wide: true });
        ps.body.innerHTML = '<p class="of-p of-dim">Foto: ' + esc(p.desc || catLabel(p.cat)) + "</p>" +
          (list.length ? '<div class="of-grid">' + list.map((x) => '<button type="button" class="of-tile" data-id="' + esc(x.it.id) + '"><span class="of-img"><img alt="" data-id="' + esc(x.it.id) + '"></span><span class="of-tn">' + esc(itemTitle(x.it)) + "</span>" + (pick[i] === x.it.id ? '<i class="of-b rev">GEWÄHLT</i>' : "") + "</button>").join("") + "</div>" : '<p class="of-p">Dafür hast du noch nichts im Schrank.</p>') +
          '<div class="of-actions left">' + (pick[i] ? '<button type="button" class="of-btn of-sm" data-a="none">KEIN TEIL (FEHLT)</button>' : "") + "</div>";
        ps.body.querySelectorAll(".of-grid img").forEach(loadThumb);
        ps.body.addEventListener("click", async (e) => {
          const t = e.target.closest(".of-tile"), none = e.target.closest('[data-a="none"]');
          if (!t && !none) return;
          const id = t ? t.dataset.id : null, old = pick[i];
          if (id) { const j = pick.indexOf(id); if (j >= 0 && j !== i) pick[j] = old || null; }
          pick[i] = id; ps.close(); await render();
        });
      }

      body.addEventListener("click", async (e) => {
        const b = e.target.closest("[data-a]"); if (!b) return; const a = b.dataset.a;
        if (a === "pick") openPick(+b.dataset.i);
        else if (a === "retry") ask();
        else if (a === "again") { s.close(); chooseFile(); }
        else if (a === "open") { const d = st.draft; s.close(); CO.edit(null, d); }
        else if (a === "save") { b.disabled = true; await store.putOutfit(st.draft); toast("Outfit gespeichert", "ok", 2200); s.close(); }
      });

      /* Foto einlesen (Haupt-Thread bleibt frei: createImageBitmap) und an die KI schicken */
      try {
        canvas = P.fit(await P.decode(file), 1024);
        photoUrl = URL.createObjectURL(await P.toBlob(P.fit(canvas, 360), "image/jpeg", 0.8));
      } catch (e) { return fail("Das Foto konnte nicht gelesen werden."); }
      ask();
    }
    function chooseFile() {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*";
      inp.onchange = () => { if (inp.files && inp.files[0]) start(inp.files[0]); };
      inp.click();
    }
    return { start, chooseFile, score, assign };
  };
})();
