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
  async function cutoutIsnet(canvas, opts) {
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

  /* ---------- Hintergrund entfernen mit RMBG-1.4 (BRIA, ONNX, laeuft im Browser mit onnxruntime-web) ----------
     Auf echten Fotos (Tisch, Schwert an der Wand, Beine im Bild) findet RMBG das Teil, wo ISNet (imgly) fast nichts sah (weisses Polo, olivgruenes Hemd). Das Modell (44 MB,
     quantisiert) kommt von Hugging Face und wird im Browser-Speicher (Cache Storage) abgelegt; gerechnet wird im eigenen Web Worker. Der Eingang bekommt 1,8-fache Farbsaettigung
     (hilft bei wenig Farbunterschied, z. B. olivgruen auf grau; staerker holt es Fremdes dazu), das Ergebnis wird auf das unveraenderte Foto gelegt. Geht etwas schief, nimmt cutout
     das ISNet-Modell. Lizenz des Modells: nur nicht-kommerzielle Nutzung (https://bria.ai/bria-huggingface-model-license-agreement/). */
  const ORT_BASE = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
  const RMBG_URL = "https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model_quantized.onnx";
  const RMBG_SAT = 1.8;
  const RMBG_WORKER = `
let ort = null, session = null;
async function getModel(url, report) {
  let cache = null; try { cache = await caches.open("outfit-rmbg-1"); const hit = await cache.match(url); if (hit) return await hit.arrayBuffer(); } catch (e) { cache = null; }
  const r = await fetch(url); if (!r.ok) throw new Error("Modell nicht ladbar (" + r.status + ")");
  const total = Number(r.headers.get("content-length")) || 44500000, reader = r.body.getReader(), parts = []; let got = 0;
  for (;;) { const x = await reader.read(); if (x.done) break; parts.push(x.value); got += x.value.length; report(got, total); }
  const buf = new Uint8Array(got); let o = 0; parts.forEach((q) => { buf.set(q, o); o += q.length; });
  if (cache) { try { await cache.put(url, new Response(buf, { headers: { "content-type": "application/octet-stream" } })); } catch (e) { /* egal */ } }
  return buf.buffer;
}
self.onmessage = async (e) => {
  const d = e.data;
  try {
    if (!ort) { ort = await import(d.ort + "ort.min.mjs"); ort.env.wasm.wasmPaths = d.ort; ort.env.wasm.numThreads = 1; }
    if (!session) {
      const buf = await getModel(d.model, (cur, tot) => self.postMessage({ t: "p", cur, tot }));
      session = await ort.InferenceSession.create(buf, { executionProviders: ["wasm"] });
    }
    const res = await session.run({ [session.inputNames[0]]: new ort.Tensor("float32", d.input, [1, 3, 1024, 1024]) });
    const o = res[session.outputNames[0]].data, n = 1024 * 1024; let mi = 1e9, ma = -1e9;
    for (let i = 0; i < n; i++) { if (o[i] < mi) mi = o[i]; if (o[i] > ma) ma = o[i]; }
    const mask = new Uint8Array(n), sc = 255 / Math.max(1e-6, ma - mi);
    for (let i = 0; i < n; i++) { const v = (o[i] - mi) * sc; mask[i] = v < 0 ? 0 : v > 255 ? 255 : v; }
    self.postMessage({ t: "d", mask }, [mask.buffer]);
  } catch (err) { self.postMessage({ t: "e", m: String((err && err.message) || err) }); }
};
`;
  let rmbgWorker = null, rmbgUrl = "", rmbgIdle = 0;
  function stopRmbg() { clearTimeout(rmbgIdle); if (rmbgWorker) { try { rmbgWorker.terminate(); } catch (e) { /* egal */ } } rmbgWorker = null; if (rmbgUrl) { URL.revokeObjectURL(rmbgUrl); rmbgUrl = ""; } }
  function rmbgInWorker(input, onProgress) {
    return new Promise((resolve, reject) => {
      if (typeof Worker === "undefined") return reject(new Error("kein Worker"));
      try {
        if (!rmbgWorker) { rmbgUrl = URL.createObjectURL(new Blob([RMBG_WORKER], { type: "text/javascript" })); rmbgWorker = new Worker(rmbgUrl, { type: "module" }); }
      } catch (e) { stopRmbg(); return reject(e); }
      const w = rmbgWorker, fin = () => { clearTimeout(timer); w.onmessage = null; w.onerror = null; clearTimeout(rmbgIdle); rmbgIdle = setTimeout(stopRmbg, 120000); };
      const timer = setTimeout(() => { stopRmbg(); reject(new Error("Zeitüberschreitung")); }, 360000);
      w.onmessage = (e) => {
        const d = e.data || {};
        if (d.t === "p") onProgress(d.cur / Math.max(1, d.tot), d.tot);
        else if (d.t === "d") { fin(); resolve(d.mask); }
        else if (d.t === "e") { fin(); reject(new Error(d.m)); }
      };
      w.onerror = (e) => { clearTimeout(timer); stopRmbg(); reject(new Error((e && e.message) || "Hintergrund-Thread nicht verfügbar")); };
      clearTimeout(rmbgIdle);
      w.postMessage({ ort: ORT_BASE, model: RMBG_URL, input }, [input.buffer]);
    });
  }
  async function cutoutRmbg(canvas, opts) {
    const w = canvas.width, h = canvas.height, n = 1024 * 1024;
    const sq = document.createElement("canvas"); sq.width = 1024; sq.height = 1024; const sg = sq.getContext("2d", { willReadFrequently: true }); sg.imageSmoothingQuality = "high"; sg.drawImage(canvas, 0, 0, 1024, 1024);
    const px = sg.getImageData(0, 0, 1024, 1024).data, f = new Float32Array(3 * n), cl = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let i = 0; i < n; i++) {
      const r = px[i * 4], gg = px[i * 4 + 1], b = px[i * 4 + 2], l = 0.299 * r + 0.587 * gg + 0.114 * b;
      f[i] = cl(l + (r - l) * RMBG_SAT) / 255 - 0.5; f[n + i] = cl(l + (gg - l) * RMBG_SAT) / 255 - 0.5; f[2 * n + i] = cl(l + (b - l) * RMBG_SAT) / 255 - 0.5;
    }
    const mask = await rmbgInWorker(f, (p, tot) => { if (opts && opts.onProgress) opts.onProgress(p, tot); });
    const mk = document.createElement("canvas"); mk.width = 1024; mk.height = 1024; const mg = mk.getContext("2d"), im = mg.createImageData(1024, 1024);
    for (let i = 0; i < n; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = 255; im.data[i * 4 + 3] = mask[i]; }
    mg.putImageData(im, 0, 0);
    const out = copyCanvas(canvas), og = out.getContext("2d"); og.globalCompositeOperation = "destination-in"; og.imageSmoothingQuality = "high"; og.drawImage(mk, 0, 0, w, h);
    return out;
  }
  /* RMBG ist der Standard (opts.engine "rmbg"); opts.engine "isnet" nimmt das imgly-Modell opts.model. Faellt RMBG aus, kommt ISNet "besser" als Ersatz (O.photo.cutEngine "isnet-ersatz"). */
  async function cutout(canvas, opts) {
    opts = opts || {};
    if (opts.engine !== "isnet") {
      try { const out = await cutoutRmbg(canvas, opts); O.photo.cutEngine = "rmbg"; return out; }
      catch (e) { console.warn("RMBG nicht moeglich, nehme ISNet:", e && e.message); O.photo.cutEngine = "isnet-ersatz"; opts = Object.assign({}, opts, { model: "isnet_fp16" }); }
    } else O.photo.cutEngine = "isnet";
    return cutoutIsnet(canvas, opts);
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

  /* ---------- Aufraeumen des Freistellers: Hauptteil waehlen, Reste und fremde Gegenstaende weg, Loecher fuellen, Farbsaum am Rand ----------
     Das Modell nimmt oft mehr mit als das Teil: blasse Reste (eine Hose daneben), ein Schwert an der Wand, die eigenen Knie. Hier bleibt nur das Hauptteil:
     1) Die deckende Maske (ab 50 %) wird so weit abgetragen, dass Gegenstaende, die sich nur beruehren, getrennt sind; jeder Kern zaehlt nach Groesse und Naehe zur Mitte.
     2) Der beste Kern gewinnt; weitere bleiben nur, wenn sie wie ein Paar aussehen (aehnliche Farbe und Groesse, z. B. zwei Schuhe). Alles andere faellt weg, auch duenne Dinge
        (Schwert, Kabel) und Punkte. Jeder Maskenpixel gehoert zum naechsten Kern, so bleiben Fransen und Traeger am Hauptteil hängen.
     3) Kleine Loecher werden gefuellt, das Innere wird ganz deckend (mit den eigenen Farben), der weiche Rand bleibt, seine Farben kommen aus dem Inneren (kein Farbsaum).
     Gibt { canvas, empty, removed (Anteil der sichtbaren Pixel, die wegfielen), parts (behaltene Kerne), uncertain } zurueck. Ist das Ergebnis offensichtlich falsch (kaum sicher deckende
     Flaeche, wie beim weissen Hoodie, oder mehr als 60 % der Deckkraft waeren weg), bleibt das Bild unveraendert und uncertain ist wahr. */
  function cleanup(c) {
    const w = c.width, h = c.height, n = w * h, T = 128, same = (u) => ({ canvas: c, empty: false, removed: 0, parts: 0, uncertain: u });
    const g = c.getContext("2d", { willReadFrequently: true }), img = g.getImageData(0, 0, w, h), d = img.data;
    const a = new Uint8Array(n); let before = 0; for (let i = 0; i < n; i++) { a[i] = d[i * 4 + 3]; before += a[i]; }
    const a0 = Uint8Array.from(a), M0 = new Uint8Array(n); let any = 0; for (let i = 0; i < n; i++) if (a[i] >= T) { M0[i] = 1; any++; }
    if (!any) return { canvas: c, empty: true, removed: 0, parts: 0, uncertain: true };
    const lab = new Int32Array(n), stack = new Int32Array(n), spread = (src, grow, steps) => {
      let cur = src;
      for (let k = 0; k < steps; k++) {
        const t = new Uint8Array(n), o = new Uint8Array(n);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x, l = x > 0 ? cur[p - 1] : (grow ? 0 : 1), r = x < w - 1 ? cur[p + 1] : (grow ? 0 : 1); t[p] = grow ? cur[p] | l | r : cur[p] & l & r; }
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const p = y * w + x, u = y > 0 ? t[p - w] : (grow ? 0 : 1), v = y < h - 1 ? t[p + w] : (grow ? 0 : 1); o[p] = grow ? t[p] | u | v : t[p] & u & v; }
        cur = o;
      }
      return cur;
    };
    /* 1) Kerne: abtragen, bis Beruehrendes getrennt ist (bei duennen Teilen mit kleinerem Schritt noch einmal) */
    let cores = [];
    for (const r of [Math.max(4, Math.min(9, Math.round(Math.max(w, h) / 130))), 3, 1]) {
      const E = spread(M0, false, r); lab.fill(0); cores = [];
      for (let s = 0; s < n; s++) {
        if (!E[s] || lab[s]) continue;
        const id = cores.length + 1; let sp = 0, area = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0; stack[sp++] = s; lab[s] = id;
        while (sp) {
          const p = stack[--sp], x = p % w, y = (p - x) / w; area++; sx += x; sy += y; sr += d[p * 4]; sg += d[p * 4 + 1]; sb += d[p * 4 + 2];
          for (let yy = y > 0 ? y - 1 : 0, ye = y < h - 1 ? y + 1 : y; yy <= ye; yy++) for (let xx = x > 0 ? x - 1 : 0, xe = x < w - 1 ? x + 1 : x; xx <= xe; xx++) { const q = yy * w + xx; if (E[q] && !lab[q]) { lab[q] = id; stack[sp++] = q; } }
        }
        cores.push({ id, area, cx: sx / area / w, cy: sy / area / h, lab: C().rgb2lab(sr / area, sg / area, sb / area) });
      }
      cores = cores.filter((k) => k.area >= Math.max(40, 0.003 * n));
      if (cores.length) break;
    }
    if (!cores.length) return same(true);
    const score = (k) => k.area * (0.6 + 0.4 * Math.exp(-((k.cx - 0.5) * (k.cx - 0.5) + (k.cy - 0.5) * (k.cy - 0.5)) / (2 * 0.3 * 0.3)));
    let main = cores[0]; cores.forEach((k) => { if (score(k) > score(main)) main = k; });
    const keepId = new Set([main.id]);
    cores.forEach((k) => { if (k !== main && k.area >= 0.25 * main.area && k.area <= 4 * main.area && C().dE(k.lab, main.lab) < 22) keepId.add(k.id); });
    const coreIds = new Set(cores.map((k) => k.id));
    /* jeder Maskenpixel gehoert zum naechsten (vom Rand aus gesehen: durch die Maske erreichbaren) Kern */
    const own = new Int32Array(n); let qh = 0, qt = 0; const queue = stack;
    for (let i = 0; i < n; i++) if (lab[i] && coreIds.has(lab[i])) { own[i] = lab[i]; queue[qt++] = i; }
    while (qh < qt) {
      const p = queue[qh++], x = p % w, y = (p - x) / w, o = own[p];
      for (let yy = y > 0 ? y - 1 : 0, ye = y < h - 1 ? y + 1 : y; yy <= ye; yy++) for (let xx = x > 0 ? x - 1 : 0, xe = x < w - 1 ? x + 1 : x; xx <= xe; xx++) { const q = yy * w + xx; if (M0[q] && !own[q]) { own[q] = o; queue[qt++] = q; } }
    }
    const M = new Uint8Array(n); let keptArea = 0, strong = 0;
    for (let i = 0; i < n; i++) if (own[i] && keepId.has(own[i])) { M[i] = 1; keptArea++; if (a[i] >= 217) strong++; }
    if (strong / Math.max(1, keptArea) < 0.55) return same(true); /* kaum etwas ist sicher Teil: lieber nichts anfassen */
    const parts = keepId.size;
    /* 2) kleine Loecher im Teil schliessen (hoechstens 0,4 % der Flaeche); was vom Rand aus erreichbar ist, ist Hintergrund */
    const out = new Uint8Array(n); let sp = 0;
    const push = (p) => { if (!M[p] && !out[p]) { out[p] = 1; stack[sp++] = p; } };
    for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (sp) { const p = stack[--sp], x = p % w, y = (p - x) / w; if (x > 0) push(p - 1); if (x < w - 1) push(p + 1); if (y > 0) push(p - w); if (y < h - 1) push(p + w); }
    const lim = Math.max(24, Math.round(keptArea * 0.004)), seen = new Uint8Array(n);
    for (let s = 0; s < n; s++) {
      if (M[s] || out[s] || seen[s]) continue;
      const cells = []; sp = 0; stack[sp++] = s; seen[s] = 1;
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w; cells.push(p);
        const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
        for (let k = 0; k < 4; k++) { const q = nb[k]; if (q >= 0 && !M[q] && !out[q] && !seen[q]) { seen[q] = 1; stack[sp++] = q; } }
      }
      if (cells.length <= lim) cells.forEach((p) => { M[p] = 1; });
    }
    /* 3) Zone: 3 Pixel um das Teil (dort bleibt der weiche Rand), Inneres: 3 Pixel in das Teil hinein */
    const Z = spread(M, true, 3), E3 = spread(M, false, 3);
    /* Deckkraft: Inneres ganz deckend, Randzone wie vom Modell, aussen nichts. Farbe: Inneres und deckende Pixel behalten ihre Farbe (hinter fast durchsichtigen Pixeln steckt keine),
       alle anderen bekommen sie aus der Umgebung (Rand: hoechstens 4 Schritte, tote Pixel im Inneren: bis zu 32) */
    const A = new Uint8Array(n), col = new Uint8Array(n), reach = new Uint8Array(n); let after = 0, vis = 0, lost = 0;
    for (let i = 0; i < n; i++) {
      if (E3[i]) { A[i] = 255; if (a0[i] >= 60) col[i] = 1; else reach[i] = 32; }
      else if (Z[i]) { A[i] = a[i]; if (A[i] >= 250) col[i] = 1; else if (A[i] > 0) reach[i] = 4; }
      after += A[i]; if (a0[i] >= 25) { vis++; if (A[i] < 10) lost++; }
    }
    if (after < 0.4 * before) return same(true); /* mehr als die Haelfte weg: das stimmt nicht, nichts aendern */
    for (let it = 0; it < 32; it++) {
      const add = [];
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const p = y * w + x; if (col[p] || it >= reach[p]) continue;
        let r = 0, gg = 0, b = 0, k = 0;
        for (let yy = y > 0 ? y - 1 : 0, ye = y < h - 1 ? y + 1 : y; yy <= ye; yy++) for (let xx = x > 0 ? x - 1 : 0, xe = x < w - 1 ? x + 1 : x; xx <= xe; xx++) { const q = yy * w + xx; if (col[q]) { r += d[q * 4]; gg += d[q * 4 + 1]; b += d[q * 4 + 2]; k++; } }
        if (k) add.push(p, Math.round(r / k), Math.round(gg / k), Math.round(b / k));
      }
      if (!add.length) break;
      for (let j = 0; j < add.length; j += 4) { const p = add[j]; d[p * 4] = add[j + 1]; d[p * 4 + 1] = add[j + 2]; d[p * 4 + 2] = add[j + 3]; col[p] = 1; }
    }
    for (let i = 0; i < n; i++) d[i * 4 + 3] = A[i];
    const o = document.createElement("canvas"); o.width = w; o.height = h; o.getContext("2d").putImageData(img, 0, 0);
    return { canvas: o, empty: false, removed: lost / Math.max(1, vis), parts, uncertain: false };
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

  O.photo = { decode, fit, toBlob, copyCanvas, flatten, cutout, trim, cleanup, colors, makeBlobs, editor, blob2b64 };
  O.ai = ai;
})();
