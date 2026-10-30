/* Outfits (Bereich "Outfits"), Teil 2: Fotos. Bild lesen und verkleinern, Hintergrund entfernen (Modell laeuft im Browser, beim ersten Mal Download von der CDN),
   zuschneiden, Hauptfarben bestimmen, Vorschaubilder erzeugen, Nachbessern (Radieren / Zurueckholen) und der Aufruf der KI-Erkennung ueber den Cloudflare-Worker.
   Nichts hiervon speichert selbst etwas; outfit-ui.js gibt die Ergebnisse an den Speicher aus outfit-core.js. */
(function () {
  "use strict";
  const O = (window.Outfit = window.Outfit || {});
  const { clamp } = O.util || { clamp: (v, a, b) => Math.max(a, Math.min(b, v)) };
  const C = () => O.color;

  /* ---------- Bild lesen und verkleinern ---------- */
  async function decode(file) {
    try { return await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { /* Rueckfall ueber <img> (beachtet die Drehung ebenfalls) */ }
    return new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("Bild nicht lesbar")); im.src = u; });
  }
  function fit(src, maxSide) {
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight, k = Math.min(1, maxSide / Math.max(w0, h0));
    const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
    const g = c.getContext("2d"); g.imageSmoothingQuality = "high"; g.drawImage(src, 0, 0, c.width, c.height); return c;
  }
  const toBlob = (c, type, q) => new Promise((res) => c.toBlob(res, type, q));
  function copyCanvas(c) { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; o.getContext("2d").drawImage(c, 0, 0); return o; }
  function flatten(c, bg) { const o = document.createElement("canvas"); o.width = c.width; o.height = c.height; const g = o.getContext("2d"); g.fillStyle = bg || "#ffffff"; g.fillRect(0, 0, o.width, o.height); g.drawImage(c, 0, 0); return o; }
  const blob2b64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(fr.error); fr.readAsDataURL(blob); });

  /* ---------- Hintergrund entfernen (@imgly/background-removal, feste Version, laeuft im Browser) ---------- */
  const IMGLY = "https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm";
  let imglyP = null;
  const loadImgly = () => imglyP || (imglyP = import(IMGLY).catch((e) => { imglyP = null; throw new Error("Freisteller nicht ladbar (Internet?)"); }));
  /* Das Modell rechnet je Foto einige Sekunden. Im Haupt-Thread friert dabei die ganze Seite ein (die Seite ist nicht "cross-origin isolated", also gibt es nur
     einen Rechenfaden). Darum laeuft es in einem eigenen Web Worker; nur wenn der nicht startet, wie frueher im Haupt-Thread (cutoutMain). Der Worker bleibt 2 Minuten
     nach dem letzten Foto offen (das Modell bleibt im Speicher) und wird dann beendet. Er laedt dieselbe Bibliothek von der CDN. */
  const CUT_WORKER = [
    "let mod = null;",
    "self.onmessage = async (e) => {",
    "  const d = e.data;",
    "  try {",
    "    if (!mod) mod = await import(d.url);",
    "    let last = 0;",
    "    const cfg = { model: d.model, progress: (k, cur, tot) => { const now = Date.now(); if (now - last < 150 && cur < tot) return; last = now; self.postMessage({ t: 'p', k, cur, tot }); } };",
    "    if (d.gpu) cfg.device = 'gpu';",
    "    let out;",
    "    try { out = await mod.removeBackground(d.blob, cfg); } catch (err) { if (!cfg.device) throw err; delete cfg.device; out = await mod.removeBackground(d.blob, cfg); }",
    "    self.postMessage({ t: 'd', blob: out });",
    "  } catch (err) { self.postMessage({ t: 'e', m: String((err && err.message) || err) }); }",
    "};"
  ].join("\n");
  let cutWorker = null, cutWorkerUrl = "", cutIdle = 0;
  function stopCutWorker() { clearTimeout(cutIdle); if (cutWorker) { try { cutWorker.terminate(); } catch (e) { /* egal */ } } cutWorker = null; if (cutWorkerUrl) { URL.revokeObjectURL(cutWorkerUrl); cutWorkerUrl = ""; } }
  function cutoutInWorker(input, cfg, onProgress) {
    return new Promise((resolve, reject) => {
      if (typeof Worker === "undefined") return reject(new Error("kein Worker"));
      try {
        if (!cutWorker) { cutWorkerUrl = URL.createObjectURL(new Blob([CUT_WORKER], { type: "text/javascript" })); cutWorker = new Worker(cutWorkerUrl, { type: "module" }); }
      } catch (e) { stopCutWorker(); return reject(e); }
      const w = cutWorker, end = () => { w.onmessage = null; w.onerror = null; clearTimeout(cutIdle); cutIdle = setTimeout(stopCutWorker, 120000); };
      w.onmessage = (e) => {
        const d = e.data || {};
        if (d.t === "p") onProgress(d.k, d.cur, d.tot);
        else if (d.t === "d") { end(); resolve(d.blob); }
        else if (d.t === "e") { end(); reject(new Error(d.m)); }
      };
      w.onerror = (e) => { stopCutWorker(); reject(new Error((e && e.message) || "Hintergrund-Thread nicht verfügbar")); };
      clearTimeout(cutIdle);
      w.postMessage({ url: IMGLY, blob: input, model: cfg.model, gpu: !!cfg.device });
    });
  }
  async function cutoutMain(input, cfg) {
    const mod = await loadImgly();
    try { return await mod.removeBackground(input, cfg); } catch (e) { if (!cfg.device) throw e; delete cfg.device; return mod.removeBackground(input, cfg); }
  }
  async function cutout(canvas, opts) {
    opts = opts || {};
    const input = await toBlob(canvas, "image/jpeg", 0.92), seen = {};
    const onProgress = (k, cur, tot) => {
      if (!opts.onProgress || String(k).indexOf("compute") === 0) return;
      seen[k] = [cur, tot]; let c = 0, t = 0; Object.keys(seen).forEach((x) => { c += seen[x][0]; t += seen[x][1]; });
      opts.onProgress(t ? c / t : 0, t);
    };
    const cfg = { model: opts.model || "isnet_quint8", progress: onProgress };
    if (opts.gpu && navigator.gpu) cfg.device = "gpu";
    let out;
    try { out = await cutoutInWorker(input, cfg, onProgress); O.photo.cutThread = "worker"; }
    catch (e) { console.warn("Freistellen im Hintergrund-Thread nicht moeglich, nehme den Haupt-Thread:", e && e.message); O.photo.cutThread = "main"; out = await cutoutMain(input, cfg); }
    const bmp = await createImageBitmap(out), c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; c.getContext("2d").drawImage(bmp, 0, 0); return c;
  }

  /* ---------- Zuschneiden auf das Teil (Alphakanal) ---------- */
  function trim(c, thr, padRatio) {
    const g = c.getContext("2d", { willReadFrequently: true }), w = c.width, h = c.height, d = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) { const row = y * w * 4; for (let x = 0; x < w; x++) if (d[row + x * 4 + 3] > thr) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (x1 < 0) return { canvas: c, empty: true, coverage: 0 };
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, pad = Math.round(Math.max(bw, bh) * (padRatio == null ? 0.04 : padRatio));
    const nx = Math.max(0, x0 - pad), ny = Math.max(0, y0 - pad), nw = Math.min(w, x1 + pad + 1) - nx, nh = Math.min(h, y1 + pad + 1) - ny;
    const o = document.createElement("canvas"); o.width = nw; o.height = nh; o.getContext("2d").drawImage(c, nx, ny, nw, nh, 0, 0, nw, nh);
    return { canvas: o, empty: false, coverage: (bw * bh) / (w * h) };
  }

  /* ---------- Hauptfarben (nur deckende Pixel, aehnliche Toene werden zusammengefasst) ---------- */
  function colors(c, k) {
    const sc = Math.min(1, 96 / Math.max(c.width, c.height)), s = document.createElement("canvas"); s.width = Math.max(1, Math.round(c.width * sc)); s.height = Math.max(1, Math.round(c.height * sc));
    const g = s.getContext("2d", { willReadFrequently: true }); g.drawImage(c, 0, 0, s.width, s.height);
    const d = g.getImageData(0, 0, s.width, s.height).data, b = new Map();
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3), e = b.get(key) || { n: 0, r: 0, g: 0, b: 0 };
      e.n++; e.r += d[i]; e.g += d[i + 1]; e.b += d[i + 2]; b.set(key, e);
    }
    const cl = Array.from(b.values()).map((e) => { const rgb = [e.r / e.n, e.g / e.n, e.b / e.n]; return { n: e.n, rgb, lab: C().rgb2lab(rgb[0], rgb[1], rgb[2]) }; }).sort((a, z) => z.n - a.n);
    const out = [];
    cl.forEach((x) => {
      const m = out.find((o) => C().dE(o.lab, x.lab) < 16);
      if (m) { const n = m.n + x.n; m.rgb = m.rgb.map((v, i) => (v * m.n + x.rgb[i] * x.n) / n); m.n = n; m.lab = C().rgb2lab(m.rgb[0], m.rgb[1], m.rgb[2]); } else out.push({ n: x.n, rgb: x.rgb.slice(), lab: x.lab });
    });
    const total = out.reduce((a, o) => a + o.n, 0) || 1;
    return out.sort((a, z) => z.n - a.n).filter((o, i) => i === 0 || o.n / total >= 0.07).slice(0, k || 3).map((o) => ({ hex: C().rgb2hex(o.rgb[0], o.rgb[1], o.rgb[2]), share: o.n / total }));
  }

  /* ---------- Dateien fuer den Speicher: Foto (max 720 px) und Vorschau (256 px), beide WebP mit Transparenz ---------- */
  async function makeBlobs(c) { return { photo: await toBlob(fit(c, 720), "image/webp", 0.86), thumb: await toBlob(fit(c, 256), "image/webp", 0.8) }; }

  /* ==========================================================================
     Nachbessern: Radieren und Zurueckholen mit dem Finger oder der Maus
     orig = Originalfoto (gleiche Groesse wie cut), cut = freigestelltes Bild mit Transparenz. Gibt das bearbeitete Bild zurueck (oder null bei Abbrechen).
     ========================================================================== */
  function editor(orig, cut) {
    return new Promise((resolve) => {
      const work = copyCanvas(cut), undo = [], ov = document.createElement("div");
      ov.className = "of-ed"; ov.setAttribute("role", "dialog"); ov.setAttribute("aria-modal", "true"); ov.setAttribute("aria-label", "Foto nachbessern");
      ov.innerHTML = '<div class="of-ed-h"><b class="of-px">NACHBESSERN</b><span class="of-ed-hint">Radieren: weg damit. Zurückholen: das Original wieder einblenden.</span></div>' +
        '<div class="of-ed-stage" data-bg="checker"><div class="of-ed-wrap"></div></div>' +
        '<div class="of-ed-tools">' +
        '<div class="of-ed-row"><button type="button" class="of-btn of-sm on" data-tool="erase">RADIEREN</button><button type="button" class="of-btn of-sm" data-tool="restore">ZURÜCKHOLEN</button>' +
        '<label class="of-ed-size">GRÖSSE<input type="range" min="4" max="90" value="26" data-size></label></div>' +
        '<div class="of-ed-row"><button type="button" class="of-btn of-sm" data-act="undo">RÜCKGÄNGIG</button><button type="button" class="of-btn of-sm" data-act="reset">ZURÜCKSETZEN</button>' +
        '<button type="button" class="of-btn of-sm" data-zoom="1">1×</button><button type="button" class="of-btn of-sm" data-zoom="2">2×</button><button type="button" class="of-btn of-sm" data-zoom="3">3×</button>' +
        '<button type="button" class="of-btn of-sm" data-bgs>HINTERGRUND</button></div>' +
        '<div class="of-ed-row of-ed-end"><button type="button" class="of-btn" data-act="cancel">ABBRECHEN</button><button type="button" class="of-btn of-go" data-act="done">FERTIG</button></div></div>';
      document.body.appendChild(ov);
      const wrap = ov.querySelector(".of-ed-wrap"), stage = ov.querySelector(".of-ed-stage"), cv = work, g = cv.getContext("2d");
      cv.className = "of-ed-cv"; wrap.appendChild(cv);
      const ring = document.createElement("i"); ring.className = "of-ed-ring"; wrap.appendChild(ring);
      let tool = "erase", size = 26, zoom = 1, last = null, drawing = false;
      const BGS = ["checker", "white", "dark", "green"]; let bgi = 0;
      const layout = () => { const r = stage.getBoundingClientRect(), base = Math.min(r.width - 8, (r.height - 8) * (cv.width / cv.height)); cv.style.width = Math.round(base * zoom) + "px"; cv.style.height = Math.round(base * zoom * (cv.height / cv.width)) + "px"; };
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
      const dot = (x, y) => {
        const r = size * (cv.width / 1024) * 1.0 + 1;
        if (tool === "erase") { g.save(); g.globalCompositeOperation = "destination-out"; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.restore(); }
        else { g.save(); g.beginPath(); g.arc(x, y, r, 0, 7); g.clip(); g.drawImage(orig, 0, 0, cv.width, cv.height); g.restore(); }
      };
      const stroke = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(2, size * 0.35))); for (let i = 1; i <= n; i++) dot(a[0] + (dx * i) / n, a[1] + (dy * i) / n); };
      const snap = () => { undo.push(copyCanvas(cv)); if (undo.length > 12) undo.shift(); };
      const moveRing = (e) => { const r = wrap.getBoundingClientRect(), d = size * (cv.getBoundingClientRect().width / 1024) * 2; ring.style.width = ring.style.height = d + "px"; ring.style.left = e.clientX - r.left - d / 2 + "px"; ring.style.top = e.clientY - r.top - d / 2 + "px"; ring.style.display = "block"; };
      cv.addEventListener("pointerdown", (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (err) { /* kein aktiver Zeiger */ } snap(); drawing = true; last = pos(e); dot(last[0], last[1]); moveRing(e); });
      cv.addEventListener("pointermove", (e) => { moveRing(e); if (!drawing) return; const p = pos(e); stroke(last, p); last = p; });
      const end = () => { drawing = false; last = null; };
      cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end); cv.addEventListener("pointerleave", () => { ring.style.display = "none"; });
      const close = (val) => { window.removeEventListener("resize", layout); document.removeEventListener("keydown", onKey); ov.remove(); resolve(val); };
      const onKey = (e) => { if (e.key === "Escape") close(null); };
      document.addEventListener("keydown", onKey); window.addEventListener("resize", layout);
      ov.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.tool) { tool = b.dataset.tool; ov.querySelectorAll("[data-tool]").forEach((x) => x.classList.toggle("on", x === b)); }
        else if (b.dataset.zoom) { zoom = +b.dataset.zoom; layout(); }
        else if (b.hasAttribute("data-bgs")) { bgi = (bgi + 1) % BGS.length; stage.dataset.bg = BGS[bgi]; }
        else if (b.dataset.act === "undo") { const u = undo.pop(); if (u) { g.clearRect(0, 0, cv.width, cv.height); g.drawImage(u, 0, 0); } }
        else if (b.dataset.act === "reset") { snap(); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(cut, 0, 0); }
        else if (b.dataset.act === "cancel") close(null);
        else if (b.dataset.act === "done") close(cv);
      });
      ov.querySelector("[data-size]").addEventListener("input", (e) => { size = +e.target.value; });
      requestAnimationFrame(layout);
    });
  }

  /* ==========================================================================
     KI-Erkennung ueber den Cloudflare-Worker (worker/outfit-worker.js). Ohne Adresse und Schluessel wird nichts gesendet.
     Gesendet wird nur das freigestellte Teil auf hellem Grund (klein, JPEG), nie das ganze Foto mit Zimmer.
     ========================================================================== */
  const ai = {
    configured: (store) => !!(store.settings.get("aiUrl") && store.settings.get("aiKey")),
    async call(store, path, body) {
      const url = String(store.settings.get("aiUrl")).replace(/\/+$/, "") + path;
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + store.settings.get("aiKey") }, body: JSON.stringify(body) });
      /* auch bei einem Fehlerstatus steht im Text meist, was fehlt (z. B. "Geheimes Wort stimmt nicht") */
      const j = await res.json().catch(() => null);
      if (!res.ok || !j || !j.ok) throw new Error((j && j.error) || (res.ok ? "KI-Antwort unbrauchbar" : "KI-Dienst antwortet mit Status " + res.status));
      return j;
    },
    async analyze(store, canvas, ctx) {
      const small = flatten(fit(canvas, 640), "#e9e6df"), blob = await toBlob(small, "image/jpeg", 0.8);
      const j = await ai.call(store, "/analyze", { image: await blob2b64(blob), media: "image/jpeg", cats: ctx.cats.map((c) => ({ id: c.id, label: c.label, slot: c.slot })), occ: ctx.occ });
      return j.item;
    },
    /* ganzes Outfit-Foto (kein Freistellen, hoechstens 1024 px) in einzelne Teile zerlegen lassen; gibt eine Liste { cat, desc, colors, layer, warmth, formal } zurueck */
    async inspo(store, canvas, ctx) {
      const blob = await toBlob(flatten(fit(canvas, 1024), "#ffffff"), "image/jpeg", 0.85);
      const j = await ai.call(store, "/inspo", { image: await blob2b64(blob), media: "image/jpeg", cats: ctx.cats.map((c) => ({ id: c.id, label: c.label, slot: c.slot })) });
      return Array.isArray(j.pieces) ? j.pieces : [];
    },
    async ping(store) { return ai.call(store, "/ping", {}); }
  };

  O.photo = { decode, fit, toBlob, copyCanvas, flatten, cutout, trim, colors, makeBlobs, editor, blob2b64 };
  O.ai = ai;
})();
