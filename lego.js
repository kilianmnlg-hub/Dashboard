/* LEGO-Sammlung (Bereich "LEGO-Sammlung"): Sets mit Einkaufspreisen, aktuellem Bricklink-Wert, Rendite und Verlauf.
   Alles liegt im PRIVATEN Daten-Repo (dashboard-privat, siehe private.js), nichts davon im oeffentlichen Repo:
     lego-data.json    Sets und Kaeufe/Verkaeufe (schreibt dieses Dashboard, pro Set gewinnt der neuere Zeitstempel "upd", Loeschungen bleiben als Marke "del")
     lego-prices.json  Wert, Verkaeufe, Angebote und Verlauf je Set (schreibt scripts/lego-prices.mjs im 08:00-Sync oder nach "+ SET" ueber lego-prices.yml)
     lego-img.json     kleine WebP-Bilder je Set als Daten-URL (schreibt dieses Dashboard beim Hinzufuegen; Quelle: das Bricklink-Bild, im Browser verkleinert)
   Wert eines Sets = Durchschnitt der Bricklink-Verkaeufe der letzten 6 Monate (neu, Europa, mit MwSt.), bei weniger als 3 Verkaeufen die Angebote (mit Warnzeichen).
   script.js uebergibt: main, syncEl, readCloudJson, getGithubConfig, escapeHtml, toast, serial, wrote, status, dispatch(file), pixel (PixelSprites). */
(function () {
  "use strict";
  const DAY = 86400000;
  const F_DATA = "lego-data.json", F_PRICES = "lego-prices.json", F_IMG = "lego-img.json", WORKFLOW = "lego-prices.yml";
  const LS_UI = "dashboard-lego-ui", LS_TOKEN = "dashboard-gh-token";
  const COND = ["NEU", "GEBAUT", "GEBRAUCHT"];
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const pad2 = (n) => String(n).padStart(2, "0");
  const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); };
  const parseDay = (s) => { const p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2]).getTime(); };
  const uid = () => { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch (e) { /* alter Browser */ } return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); };
  const str = (v, n) => String(v == null ? "" : v).slice(0, n || 80);
  const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
  const unb64 = (s) => decodeURIComponent(escape(atob(String(s).replace(/\s/g, ""))));
  const eur0 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
  const eur2 = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const pct = (x, d) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toLocaleString("de-DE", { minimumFractionDigits: d == null ? 1 : d, maximumFractionDigits: d == null ? 1 : d }) + " %";
  const sgn = (x) => (x >= 0 ? "+" : "−") + eur0.format(Math.abs(x));
  const fdate = (s) => new Date(parseDay(s)).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const nrOf = (no) => "#" + String(no).split("-")[0];

  /* "75331" -> "75331-1", "75192-1" bleibt (gleiche Regel wie scripts/lib/lego.mjs) */
  function normSetNo(input) {
    const s = String(input == null ? "" : input).trim().replace(/^#/, "").replace(/\s+/g, "");
    const m = /^([A-Za-z0-9]{2,14})(?:-(\d{1,2}))?$/.exec(s);
    return !m || !/\d/.test(m[1]) ? null : m[1] + "-" + (m[2] || "1");
  }
  const money = (v) => { const n = typeof v === "string" ? parseFloat(v.replace(",", ".")) : +v; return isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null; };
  const dateOk = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || "") && isFinite(parseDay(s));

  /* Kauf- oder Verkaufszeile auf sichere Typen bringen */
  function cleanLine(r) {
    r = r || {};
    const p = money(r.p), q = Math.floor(+r.q);
    if (p === null || !(q >= 1) || !dateOk(r.d)) return null;
    return { id: str(r.id, 40) || uid(), d: r.d, p, q: Math.min(q, 9999) };
  }
  function cleanSet(r) {
    const no = normSetNo(r && r.no);
    if (!no) return null;
    const s = { no, upd: isNum(r.upd) ? r.upd : 0 };
    if (r.del) { s.del = true; return s; }
    s.cond = COND.indexOf(r.cond) >= 0 ? r.cond : "NEU";
    s.buys = (Array.isArray(r.buys) ? r.buys : []).map(cleanLine).filter(Boolean).slice(0, 300);
    s.sold = (Array.isArray(r.sold) ? r.sold : []).map(cleanLine).filter(Boolean).slice(0, 300);
    s.added = isNum(r.added) ? r.added : s.upd || Date.now();
    return s.buys.length ? s : null;
  }
  /* Zwei Staende vereinigen: pro Set gewinnt der neuere Zeitstempel (bei Gleichstand der lokale) */
  function mergeSets(local, remote) {
    const m = new Map();
    (remote || []).forEach((x) => { if (x && x.no) m.set(x.no, x); });
    (local || []).forEach((x) => { if (!x || !x.no) return; const o = m.get(x.no); if (!o || (x.upd || 0) >= (o.upd || 0)) m.set(x.no, x); });
    return Array.from(m.values());
  }
  const sortKeys = (v) => (Array.isArray(v) ? v.map(sortKeys) : v && typeof v === "object" ? Object.keys(v).sort().reduce((o, k) => { o[k] = sortKeys(v[k]); return o; }, {}) : v);
  /* Vergleichsform unabhaengig von Reihenfolge und Zusatzfeldern (z. B. traegt eine Loeschmarke in der Cloud nur no, upd, del) */
  const canon = (sets) => JSON.stringify(sortKeys((sets || []).map(cleanSet).filter(Boolean).sort((a, b) => (a.no < b.no ? -1 : a.no > b.no ? 1 : 0))));

  /* ==========================================================================
     Rechnen
     ========================================================================== */
  /* Verlauf eines Sets als aufsteigende Liste [Zeit(ms), Wert] */
  function histOf(p) { return (p && Array.isArray(p.h) ? p.h : []).map((x) => [parseDay(x[0]), +x[1]]).filter((x) => isFinite(x[0]) && isFinite(x[1])); }
  function histAt(h, t) {
    if (!h.length) return null;
    if (t <= h[0][0]) return h[0][1];
    const last = h[h.length - 1];
    if (t >= last[0]) return last[1];
    let lo = 0, hi = h.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (h[mid][0] <= t) lo = mid; else hi = mid; }
    const a = h[lo], b = h[hi];
    return a[1] + (b[1] - a[1]) * ((t - a[0]) / (b[0] - a[0] || 1));
  }

  window.createLego = function (deps) {
    deps = deps || {};
    const main = deps.main;
    if (!main) return null;
    const esc = deps.escapeHtml || ((s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const PX = deps.pixel || window.PixelSprites || null;
    const toast = deps.toast || (() => {});
    const NOW = () => Date.now();

    let D = { v: 1, sets: [], updatedAt: 0 };      /* lego-data.json */
    let P = { items: {}, vat: true, updatedAt: "" }; /* lego-prices.json */
    let IMG = {};                                  /* lego-img.json: Set-Nr -> Daten-URL */
    let sha = null, cloudKnown = false, dirty = false, pushing = false, pushTimer = 0, retryTimer = 0, chgSeq = 0, syncState = "load";
    let imgDirty = false, imgSha = null, needPriceRun = false, pollTimer = 0, assetsLoaded = false; /* assetsLoaded: Werte und Bilder wurden einmal geholt (vorher keine Anzeige, sonst blitzt "Wert folgt" auf) */
    let ui = { view: "cards", sort: "roi", range: "ALLES", sets: false, info: false };
    try { ui = Object.assign(ui, JSON.parse(localStorage.getItem(LS_UI) || "{}") || {}); } catch (e) { /* egal */ }
    const saveUi = () => { try { localStorage.setItem(LS_UI, JSON.stringify(ui)); } catch (e) { /* egal */ } };
    const spr = (name, size) => (PX && PX.spr ? PX.spr(name, size) : "");

    /* ---------- Zugriff auf das private Daten-Repo ---------- */
    const hasToken = () => { try { return !!localStorage.getItem(LS_TOKEN); } catch (e) { return false; } };
    function repoCfg() {
      if (!hasToken() || !deps.getGithubConfig) return null;
      const c = deps.getGithubConfig();
      return c && c.token ? { owner: c.dataOwner || c.owner, repo: c.dataRepo || c.repo, token: c.token } : null;
    }
    const apiUrl = (c, file) => "https://api.github.com/repos/" + c.owner + "/" + c.repo + "/contents/" + file;
    const authHeaders = (c, accept) => ({ Authorization: "Bearer " + c.token, Accept: accept || "application/vnd.github+json" });
    async function rateLimited(res) {
      if (res.status === 429) return true;
      if (res.headers.get("retry-after") || res.headers.get("x-ratelimit-remaining") === "0") return true;
      try { return /rate limit|abuse|secondary/i.test(String((await res.clone().json()).message || "")); } catch (e) { return false; }
    }
    /* Datei lesen, auch ueber 1 MB (dann liefert GitHub den Inhalt nur als "raw"). 404 = noch nicht angelegt. */
    async function readFile(file) {
      const c = repoCfg();
      if (!c) throw new Error("GitHub-Token fehlt");
      const res = await fetch(apiUrl(c, file), { headers: authHeaders(c), cache: "no-store" });
      if (res.status === 404) return { json: null, sha: null };
      if (!res.ok) throw new Error("GitHub " + res.status);
      const j = await res.json();
      let text = "";
      if (j.encoding === "base64" && j.content) text = unb64(j.content);
      else { const r2 = await fetch(apiUrl(c, file), { headers: authHeaders(c, "application/vnd.github.raw+json"), cache: "no-store" }); if (!r2.ok) throw new Error("GitHub " + r2.status); text = await r2.text(); }
      return { json: text ? JSON.parse(text) : null, sha: j.sha || null };
    }

    /* ---------- Statusanzeige in der Ueberschrift ---------- */
    function setSync(state, detail, topbar) {
      syncState = state;
      const el = deps.syncEl;
      if (el) {
        const txt = { load: "LADE …", ok: "GESICHERT", pending: "SPEICHERE …", saving: "SPEICHERE …", offline: "OFFLINE", error: "FEHLER", notoken: "KEIN TOKEN" }[state] || "";
        el.dataset.s = state;
        const t = el.querySelector(".lg-sync-t");
        if (t) t.textContent = txt;
        el.title = detail || txt;
      }
      if (deps.status) {
        if (state === "saving") deps.status("saving");
        else if (topbar) deps.status(topbar, detail);
      }
    }

    /* ==========================================================================
       Laden und Speichern
       ========================================================================== */
    const IMG_OK = /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/;
    async function loadPrices() {
      try {
        const r = await readFile(F_PRICES);
        if (r.json && r.json.items && typeof r.json.items === "object") P = { items: r.json.items, vat: r.json.vat !== false, updatedAt: r.json.updatedAt || "" };
      } catch (e) { /* ohne Preise bleiben die Sets sichtbar, der Wert fehlt nur */ }
    }
    async function loadImages() {
      try {
        const r = await readFile(F_IMG);
        imgSha = r.sha || null;
        const remote = {};
        if (r.json && typeof r.json === "object") Object.keys(r.json).forEach((k) => { if (IMG_OK.test(r.json[k] || "")) remote[k] = r.json[k]; });
        IMG = Object.assign(remote, IMG); /* eigene, noch nicht gespeicherte Bilder behalten */
      } catch (e) { /* ohne Bilder zeigt die Karte ein Symbol */ }
    }
    /* Cloud lesen und mit dem lokalen Stand vereinigen. true = der Cloud-Stand ist bekannt. inPush: beim Wiederholen eines Speicherversuchs (der laufende Versuch schreibt den vereinigten Stand selbst). */
    async function loadCloud(inPush) {
      if (syncState !== "saving") setSync("load");
      try {
        const r = await deps.readCloudJson(F_DATA);
        sha = r.sha || null;
        cloudKnown = true;
        const remote = r.json && Array.isArray(r.json.sets) ? r.json.sets.map(cleanSet).filter(Boolean) : [];
        D.sets = mergeSets(D.sets, remote);
        if (r.json && isNum(r.json.updatedAt)) D.updatedAt = Math.max(D.updatedAt, r.json.updatedAt);
        dirty = canon(D.sets) !== canon(remote); /* lokal gibt es etwas, das in der Cloud noch fehlt */
        renderAll();
        if (dirty) { if (!inPush) schedulePush(200); } else if (syncState !== "saving") setSync("ok");
        return true;
      } catch (e) {
        setSync(hasToken() ? "offline" : "notoken", e && e.message);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (!cloudKnown) boot(); }, 25000);
        return false;
      }
    }
    function schedulePush(ms) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, ms == null ? 700 : ms);
      if (syncState !== "offline") setSync("pending");
    }
    /* Geloeschte Sets bleiben als schlanke Marke stehen (damit ein anderes Geraet sie nicht wieder anlegt) und fallen nach 120 Tagen weg */
    const pruned = () => D.sets.filter((s) => !(s.del && NOW() - (s.upd || 0) > 120 * DAY)).map((s) => (s.del ? { no: s.no, upd: s.upd, del: true } : s));
    async function pushNow() {
      if (pushing) { schedulePush(900); return; }
      if (!dirty && !imgDirty) return;
      if (!cloudKnown && !(await loadCloud())) return; /* ohne bekannten Cloud-Stand nie schreiben */
      const c = repoCfg();
      if (!c) { setSync("notoken"); return; }
      pushing = true;
      setSync("saving");
      let ok = false, fail = "";
      const seq = chgSeq;
      try {
        await (deps.serial || ((f) => f()))(async () => {
          /* erst die Bilder (sind sie weg, bleibt das Set trotzdem erhalten), dann die Daten */
          if (imgDirty) {
            let imgOk = false;
            for (let attempt = 0; attempt < 3 && !imgOk; attempt++) {
              const body = { message: "LEGO Bilder", content: b64(JSON.stringify(IMG)), ...(imgSha ? { sha: imgSha } : {}) };
              const res = await fetch(apiUrl(c, F_IMG), { method: "PUT", headers: { ...authHeaders(c), "Content-Type": "application/json" }, body: JSON.stringify(body) });
              if (deps.wrote) deps.wrote();
              if (res.ok) { const j = await res.json(); imgSha = (j.content && j.content.sha) || imgSha; imgDirty = false; imgOk = true; }
              else if (res.status === 409 || res.status === 422) { await loadImages(); }
              else if (res.status === 401 || res.status === 403) { fail = (await rateLimited(res)) ? "GitHub-Schreibbremse, bitte kurz warten" : "Token ohne Schreibrecht für das private Projekt"; break; }
              else { fail = "Status " + res.status; break; }
            }
            if (!imgOk) return;
          }
          if (!dirty) { ok = true; return; }
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            const payload = { v: 1, updatedAt: NOW(), sets: pruned() };
            const res = await fetch(apiUrl(c, F_DATA), { method: "PUT", headers: { ...authHeaders(c), "Content-Type": "application/json" }, body: JSON.stringify({ message: "LEGO Update", content: b64(JSON.stringify(payload)), ...(sha ? { sha } : {}) }) });
            if (deps.wrote) deps.wrote();
            if (res.ok) { const j = await res.json(); sha = (j.content && j.content.sha) || sha; ok = true; }
            else if (res.status === 409 || res.status === 422) { if (!(await loadCloud(true))) { fail = "offline"; break; } }
            else if (res.status === 401 || res.status === 403) { fail = (await rateLimited(res)) ? "GitHub-Schreibbremse, bitte kurz warten" : "Token ohne Schreibrecht für das private Projekt"; break; }
            else { fail = "Status " + res.status; break; }
          }
        });
      } catch (e) { ok = false; fail = "offline"; }
      pushing = false;
      if (ok) {
        if (chgSeq === seq) dirty = false; else schedulePush(300);
        if (!dirty && !imgDirty) setSync("ok", "", "saved");
        if (needPriceRun && !dirty) runPrices();
      } else if (fail === "offline") setSync("offline");
      else setSync("error", fail || "Konflikt", "error");
    }
    function changed() { dirty = true; chgSeq++; D.updatedAt = NOW(); renderAll(); schedulePush(); }

    /* Werte holen lassen: startet den Workflow und wartet dann auf die neue lego-prices.json */
    async function runPrices() {
      needPriceRun = false;
      let started = false;
      try { started = deps.dispatch ? await deps.dispatch(WORKFLOW) : false; } catch (e) { started = false; }
      if (!started) { toast("Der Wert kommt mit dem nächsten Sync (täglich 08:00 oder Sync-Knopf).", "warn", 8000); return; }
      toast("Wert wird geholt, das dauert etwa eine Minute.", "ok", 6000);
      pollPrices();
    }
    const missingPrices = () => D.sets.filter((s) => !s.del && ownedOf(s) > 0 && !(P.items[s.no] && (P.items[s.no].val || P.items[s.no].none || P.items[s.no].err)));
    function pollPrices() {
      clearTimeout(pollTimer);
      const until = NOW() + 5 * 60000;
      const tick = async () => {
        await loadPrices();
        renderAll();
        if (missingPrices().length && NOW() < until) pollTimer = setTimeout(tick, 15000);
        else if (!missingPrices().length) toast("Der Wert ist da.", "ok", 3500);
      };
      pollTimer = setTimeout(tick, 25000);
    }

    /* ==========================================================================
       Bild: Bricklink-Bild holen und klein machen
       ========================================================================== */
    function loadImageEl(url) {
      return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("Bild nicht ladbar")); im.src = url; });
    }
    const blobTo = (cv, type, q) => new Promise((res) => cv.toBlob(res, type, q));
    const blobToUrl = (b) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(b); });
    /* null = Bricklink kennt die Nummer nicht */
    async function fetchSetImage(no) {
      const res = await fetch("https://img.bricklink.com/ItemImage/SN/0/" + encodeURIComponent(no) + ".png");
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Bricklink " + res.status);
      const blob = await res.blob();
      const obj = URL.createObjectURL(blob);
      try {
        const im = await loadImageEl(obj);
        const W = 256, H = 192, cv = document.createElement("canvas");
        cv.width = W; cv.height = H;
        const ctx = cv.getContext("2d");
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);
        const k = Math.min(W / im.naturalWidth, H / im.naturalHeight), w = Math.round(im.naturalWidth * k), h = Math.round(im.naturalHeight * k);
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(im, Math.round((W - w) / 2), Math.round((H - h) / 2), w, h);
        let out = await blobTo(cv, "image/webp", 0.7);
        if (!out || out.type !== "image/webp") out = await blobTo(cv, "image/jpeg", 0.75); /* z. B. Safari kann kein WebP schreiben */
        if (out && out.size > 40000) out = await blobTo(cv, out.type, 0.5);
        return out ? await blobToUrl(out) : null;
      } finally { URL.revokeObjectURL(obj); }
    }

    /* ==========================================================================
       Rechnen: Set, Summe, Verlauf
       ========================================================================== */
    const liveSets = () => D.sets.filter((s) => !s.del && s.buys && s.buys.length);
    const sumQ = (list) => (list || []).reduce((n, x) => n + x.q, 0);
    function ownedOf(s) { return Math.max(0, sumQ(s.buys) - sumQ(s.sold)); }
    function enrich(s) {
      const p = P.items[s.no] || null, now = NOW();
      const bought = sumQ(s.buys), costAll = s.buys.reduce((n, b) => n + b.q * b.p, 0), avg = bought ? costAll / bought : 0;
      const soldQ = Math.min(bought, sumQ(s.sold)), soldRev = s.sold.reduce((n, b) => n + b.q * b.p, 0);
      const qty = Math.max(0, bought - soldQ), costHeld = qty * avg;
      const unit = p && p.val ? p.val : null, value = qty * (unit == null ? avg : unit);
      const realised = soldQ ? soldRev - soldQ * avg : 0;
      const profit = value - costHeld + realised, roi = costAll ? profit / costAll : 0;
      const first = Math.min(...s.buys.map((b) => parseDay(b.d)));
      const days = Math.max(30, costAll ? s.buys.reduce((n, b) => n + b.q * b.p * (now - parseDay(b.d)), 0) / costAll / DAY : 30);
      const pa = Math.pow(Math.max(0.01, 1 + roi), 365 / days) - 1;
      return { s, p, no: s.no, bought, costAll, avg, soldQ, qty, costHeld, unit, value, realised, profit, roi, days, pa, first, hasPrice: unit != null };
    }
    function totals(list) {
      const t = { value: 0, held: 0, profit: 0, costAll: 0, wDays: 0, pieces: 0, n: 0, nSold: 0 };
      list.forEach((e) => { t.value += e.value; t.held += e.costHeld; t.profit += e.profit; t.costAll += e.costAll; t.wDays += e.costAll * e.days; t.pieces += e.qty; if (e.qty > 0) t.n++; else t.nSold++; });
      t.roi = t.costAll ? t.profit / t.costAll : 0;
      t.yrs = t.costAll ? Math.max(30, t.wDays / t.costAll) / 365 : 1;
      t.pa = Math.pow(Math.max(0.01, 1 + t.roi), 1 / t.yrs) - 1;
      return t;
    }
    /* Wert und Einsatz des ganzen Bestands zu einem Zeitpunkt. Vor dem ersten Bricklink-Wert wird vom Einkaufspreis geradlinig zu diesem Wert verbunden. */
    function stateAt(sets, t, hmap) {
      let v = 0, inv = 0;
      sets.forEach((s) => {
        const h = hmap[s.no];
        const bought = s.buys.filter((b) => parseDay(b.d) <= t), qb = sumQ(bought);
        if (!qb) return;
        const qs = sumQ(s.sold.filter((b) => parseDay(b.d) <= t)), keep = Math.max(0, qb - qs) / qb;
        bought.forEach((b) => {
          const tb = parseDay(b.d);
          let price = b.p;
          if (h.length) {
            if (t >= h[0][0]) price = histAt(h, t);
            else if (h[0][0] > tb) price = b.p + (h[0][1] - b.p) * ((t - tb) / (h[0][0] - tb));
            else price = h[0][1];
          }
          v += b.q * keep * price;
          inv += b.q * keep * b.p;
        });
      });
      return { v, inv };
    }
    function series(sets, range) {
      if (!sets.length) return [];
      const now = NOW(), first = Math.min(...sets.map((s) => Math.min(...s.buys.map((b) => parseDay(b.d)))));
      const span = { "6M": 183, "1J": 365, ALLES: 99999 }[range] || 99999;
      let from = Math.max(first, now - span * DAY);
      if (now - from < 14 * DAY) from = now - 30 * DAY;
      const step = Math.max(DAY, (now - from) / 70), pts = [], hmap = {};
      sets.forEach((s) => { hmap[s.no] = histOf(P.items[s.no]); });
      for (let t = from; t < now - step / 2; t += step) { const s = stateAt(sets, t, hmap); pts.push({ t, v: s.v, inv: s.inv }); }
      const e = totals(sets.map(enrich));
      pts.push({ t: now, v: e.value, inv: e.held });
      return pts;
    }

    /* ==========================================================================
       Oberflaeche
       ========================================================================== */
    const warnFor = (e) => (e.p && e.p.val && (e.p.src === "stock" || (e.p.sales != null && e.p.sales < 3)) ? '<i class="lg-warn" title="' + (e.p.src === "stock" ? "Wenige Verkäufe, der Wert kommt aus den Angeboten" : "Nur " + e.p.sales + " Verkäufe") + '">⚠</i> ' : "");
    function picHtml(no) { return IMG[no] ? '<img src="' + IMG[no] + '" alt="" decoding="async">' : '<span class="lg-nopic">' + spr("brick", 36) + "</span>"; }
    const nameOf = (e) => (e.p && e.p.name) || "Set " + nrOf(e.no).slice(1);
    const pendText = (e) => (e.p && e.p.none ? "kein Preis" : e.p && e.p.err ? "Abruf-Fehler" : "Wert folgt");

    function tilesHtml(t) {
      const pc = t.profit >= 0 ? "lg-up" : "lg-down", pac = t.pa >= 0 ? "lg-up" : "lg-down";
      const cell = (l, v, sub, cls, subCls) => '<div class="lg-tile"><span class="lg-lbl">' + l + '</span><span class="lg-val ' + (cls || "") + '">' + v + '</span><span class="lg-dl ' + (subCls || "") + '">' + sub + "</span></div>";
      return cell("Wert", eur0.format(t.value), "investiert " + eur0.format(t.held), "") + cell("Gewinn", sgn(t.profit), pct(t.roi), pc, pc) +
        cell("Pro Jahr", pct(t.pa), "Ø " + t.yrs.toLocaleString("de-DE", { maximumFractionDigits: 1 }) + " Jahre", pac, "");
    }
    function chartHtml() {
      const sets = liveSets();
      const pts = series(sets, ui.range), now = NOW();
      if (pts.length < 2) return "";
      const W = 640, H = 170, L = 52, R = 14, T = 12, B = 24;
      let mn = Infinity, mx = 0;
      pts.forEach((p) => { mn = Math.min(mn, p.v, p.inv); mx = Math.max(mx, p.v, p.inv); });
      const padv = (mx - mn) * 0.12 || mx * 0.1 || 10; mn = Math.max(0, mn - padv); mx += padv;
      const t0 = pts[0].t, t1 = pts[pts.length - 1].t;
      const X = (t) => L + ((t - t0) / (t1 - t0 || 1)) * (W - L - R), Y = (v) => T + (1 - (v - mn) / (mx - mn || 1)) * (H - T - B);
      const ax = (v) => (mx >= 1000 ? (v / 1000).toLocaleString("de-DE", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + "k" : Math.round(v).toLocaleString("de-DE"));
      let g = "";
      for (let i = 0; i <= 3; i++) { const gv = mn + ((mx - mn) / 3) * i, gy = Y(gv); g += '<line class="lg-c-grid" x1="' + L + '" x2="' + (W - R) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) + '"/><text class="lg-c-txt" x="' + (L - 6) + '" y="' + (gy + 3).toFixed(1) + '" text-anchor="end">' + ax(gv) + "</text>"; }
      const ticks = Math.min(5, pts.length); let xl = "";
      for (let i = 0; i < ticks; i++) { const p = pts[Math.round((i * (pts.length - 1)) / Math.max(1, ticks - 1))]; xl += '<text class="lg-c-txt" x="' + X(p.t).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? "start" : i === ticks - 1 ? "end" : "middle") + '">' + new Date(p.t).toLocaleDateString("de-DE", { month: "short", year: "2-digit" }) + "</text>"; }
      const line = pts.map((p, k) => (k ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1)).join("");
      const area = line + "L" + X(t1).toFixed(1) + " " + (H - B) + "L" + X(t0).toFixed(1) + " " + (H - B) + "Z";
      const inv = pts.map((p, k) => (k ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.inv).toFixed(1)).join("");
      const last = pts[pts.length - 1];
      return g + xl + '<path class="lg-c-area" d="' + area + '"/><path class="lg-c-inv" d="' + inv + '"/><path class="lg-c-line" d="' + line + '"/><circle class="lg-c-dot" cx="' + X(t1).toFixed(1) + '" cy="' + Y(last.v).toFixed(1) + '" r="5"/><text class="lg-c-end" x="' + (X(t1) - 9).toFixed(1) + '" y="' + (Y(last.v) - 11).toFixed(1) + '" text-anchor="end">' + eur0.format(last.v) + "</text>";
    }
    const SORTS = { roi: (a, b) => b.roi - a.roi, profit: (a, b) => b.profit - a.profit, value: (a, b) => b.value - a.value, name: (a, b) => nameOf(a).localeCompare(nameOf(b), "de"), date: (a, b) => b.first - a.first };
    function itemsHtml(list) {
      const sorted = list.slice().sort((a, b) => (a.qty > 0) !== (b.qty > 0) ? (a.qty > 0 ? -1 : 1) : (SORTS[ui.sort] || SORTS.roi)(a, b));
      if (ui.view === "list") {
        return '<div class="lg-list">' + sorted.map((e) => {
          const cls = e.roi >= 0 ? "lg-up" : "lg-down";
          return '<button class="lg-lrow" type="button" data-no="' + esc(e.no) + '"><span class="lg-thumb">' + picHtml(e.no) + '</span><span class="lg-nmx">' + esc(nameOf(e)) + "<small>" + nrOf(e.no) + (e.qty > 1 ? " · ×" + e.qty : "") + (e.s.cond !== "NEU" ? " · " + e.s.cond : "") + (e.qty === 0 ? " · verkauft" : "") + "</small></span>" +
            '<span class="lg-n lg-hide-s">' + (e.qty ? warnFor(e) + (e.hasPrice ? eur0.format(e.value) : pendText(e).replace("Wert ", "")) : "–") + '</span><span class="lg-n lg-hide-s ' + cls + '">' + sgn(e.profit) + '</span><span class="lg-rp ' + cls + '">' + pct(e.roi) + "</span></button>";
        }).join("") + "</div>";
      }
      return '<div class="lg-grid">' + sorted.map((e) => {
        const cls = e.roi >= 0 ? "lg-up" : "lg-down", sold = e.qty === 0;
        return '<button class="lg-card' + (sold ? " lg-sold" : "") + '" type="button" data-no="' + esc(e.no) + '"><div class="lg-pic">' + picHtml(e.no) + (e.qty > 1 ? '<span class="lg-tag l">×' + e.qty + "</span>" : "") + (sold ? '<span class="lg-tag r">VERKAUFT</span>' : e.s.cond !== "NEU" ? '<span class="lg-tag r">' + esc(e.s.cond) + "</span>" : "") + "</div>" +
          '<div class="lg-cb"><div class="lg-mt">' + nrOf(e.no) + '</div><div class="lg-nm">' + esc(nameOf(e)) + "</div>" +
          '<div class="lg-vl"><b>' + (sold ? "–" : warnFor(e) + (e.hasPrice ? eur0.format(e.value) : '<span class="lg-pend">' + pendText(e) + "</span>")) + '</b><span class="lg-rp ' + cls + '">' + pct(e.roi) + "</span></div>" +
          '<div class="lg-sub">Einkauf Ø ' + eur0.format(e.avg) + ' · <span class="' + cls + '">' + sgn(e.profit) + "</span></div></div></button>";
      }).join("") + "</div>";
    }

    const root = { tiles: null, svg: null, info: null, fold: null, body: null, items: null };
    function buildShell() {
      main.innerHTML =
        '<p class="lg-note" id="lgNote" role="status">Lade Sammlung …</p>' +
        '<div class="lg-empty" id="lgEmpty" hidden><div class="lg-empty-ic">' + spr("brick", 48) + '</div><p>Noch keine Sets in der Sammlung.</p><button class="lg-btn lg-go" type="button" data-act="add">+ SET HINZUFÜGEN</button></div>' +
        '<div class="lg-panel" id="lgPanel"><div class="lg-tiles" id="lgTiles"></div>' +
        '<div class="lg-chart"><div class="lg-chart-top"><div class="lg-legend"><span><i></i>Wert</span><span><i class="dash"></i>Investiert</span></div><div class="lg-ranges" id="lgRanges"></div></div>' +
        '<div class="lg-info" id="lgInfo" hidden></div><svg id="lgSvg" viewBox="0 0 640 170" role="img" aria-label="Verlauf von Wert und Investition"></svg></div>' +
        '<button class="lg-fold" id="lgFold" type="button" aria-expanded="false"><span class="lg-tri" aria-hidden="true">▸</span><span class="lg-px">SETS</span><span class="lg-fs" id="lgFs"></span></button>' +
        '<div id="lgBody" hidden><div class="lg-bar"><div class="lg-seg" id="lgSeg"><button type="button" data-v="cards">KARTEN</button><button type="button" data-v="list">LISTE</button></div>' +
        '<select id="lgSort" aria-label="Sortieren"><option value="roi">Rendite</option><option value="profit">Gewinn</option><option value="value">Wert</option><option value="name">Name</option><option value="date">Kaufdatum</option></select></div><div id="lgItems"></div></div></div>';
      root.tiles = main.querySelector("#lgTiles"); root.svg = main.querySelector("#lgSvg"); root.info = main.querySelector("#lgInfo");
      root.fold = main.querySelector("#lgFold"); root.body = main.querySelector("#lgBody"); root.items = main.querySelector("#lgItems");
    }
    function infoHtml() {
      const vat = P.vat === false ? "ohne MwSt." : "mit MwSt.";
      const stand = P.updatedAt ? "Stand der Werte: " + new Date(P.updatedAt).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) + ". " : "";
      return "<p><b>Wert</b>Bricklink, neue Sets: Durchschnitt der Verkäufe der letzten 6 Monate in Europa, " + vat + ". Bei weniger als 3 Verkäufen zählen die Angebote (Mittel der günstigsten 5), dann steht ein ⚠ dabei. Gebaute und gebrauchte Sets nehmen die Preise für gebraucht.</p>" +
        "<p><b>Stand</b>" + stand + "Täglich mit dem 08:00-Sync, ein neues Set nach etwa einer Minute. Der Verlauf läuft ab dem ersten Abruf, die letzten 6 Monate werden aus den Verkäufen nachgerechnet; davor wird vom Einkaufspreis geradlinig verbunden.</p>" +
        "<p><b>Rendite</b>Gewinn durch Einkauf. Der Gewinn zählt den Wertzuwachs und schon verkaufte Gewinne zusammen; pro Jahr nach der Haltedauer. Mehrere Käufe eines Sets ergeben den Mischpreis.</p>" +
        "<p><b>Gespeichert</b>Privat in der Cloud wie deine anderen Daten, auf allen Geräten gleich. Die Bilder holt das Dashboard einmal von Bricklink.</p>";
    }
    function renderAll() {
      if (!root.tiles) return;
      const sets = liveSets(), list = sets.map(enrich), t = totals(list);
      const note = main.querySelector("#lgNote"), ready = cloudKnown && assetsLoaded;
      note.hidden = ready;
      if (!ready) note.textContent = syncState === "offline" ? "Die Sammlung ist gerade nicht erreichbar, neuer Versuch läuft …" : syncState === "notoken" ? "GitHub-Token fehlt." : "Lade Sammlung …";
      main.querySelector("#lgEmpty").hidden = !ready || !!sets.length;
      main.querySelector("#lgPanel").hidden = !ready || !sets.length;
      if (!ready || !sets.length) return;
      root.tiles.innerHTML = tilesHtml(t);
      main.querySelector("#lgFs").textContent = t.n + " Sets · " + t.pieces + " Stück";
      main.querySelector("#lgRanges").innerHTML = ["6M", "1J", "ALLES"].map((r) => '<button class="lg-chip" type="button" data-r="' + r + '" aria-pressed="' + (ui.range === r) + '">' + r + "</button>").join("") + '<button class="lg-chip lg-ibtn" type="button" data-act="info" aria-expanded="' + ui.info + '" aria-label="Woher die Zahlen kommen">i</button>';
      root.info.hidden = !ui.info; if (ui.info) root.info.innerHTML = infoHtml();
      root.svg.innerHTML = chartHtml();
      root.fold.setAttribute("aria-expanded", String(ui.sets)); root.body.hidden = !ui.sets;
      main.querySelectorAll("#lgSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.v === ui.view)));
      main.querySelector("#lgSort").value = ui.sort;
      if (ui.sets) root.items.innerHTML = itemsHtml(list);
    }

    /* ---------- Fenster ---------- */
    let ov = null;
    function openSheet(html) {
      closeSheet();
      ov = document.createElement("div");
      ov.className = "lg-ov";
      ov.innerHTML = '<div class="lg-sheet" role="dialog" aria-modal="true">' + html + "</div>";
      document.body.appendChild(ov);
      document.body.classList.add("lg-lock");
      ov.addEventListener("click", (e) => { if (e.target === ov || e.target.closest("[data-close]")) closeSheet(); });
      const f = ov.querySelector("input,select,button.lg-go");
      if (f) setTimeout(() => { try { f.focus(); } catch (e) { /* egal */ } }, 30);
      return ov.firstElementChild;
    }
    function closeSheet() { if (ov) { ov.remove(); ov = null; } document.body.classList.remove("lg-lock"); }
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && ov) closeSheet(); });
    const arm = (btn, label, run) => {
      if (btn.dataset.armed) { run(); return; }
      btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = label; btn.classList.add("armed");
      setTimeout(() => { if (btn.isConnected) { delete btn.dataset.armed; btn.textContent = old; btn.classList.remove("armed"); } }, 3200);
    };
    const todayStr = () => dayKey(NOW());
    const field = (id, label, inner) => '<label class="lg-fld" for="' + id + '">' + label + inner + "</label>";
    const setOf = (no) => D.sets.find((s) => s.no === no && !s.del);
    function touch(s) { s.upd = NOW(); changed(); }

    function lineRows(list, kind) {
      return list.slice().sort((a, b) => (a.d < b.d ? 1 : -1)).map((b) => "<tr><td>" + fdate(b.d) + "</td><td>" + b.q + "</td><td>" + eur2.format(b.p) + '</td><td class="lg-tdx"><button class="lg-rowx" type="button" data-del="' + kind + '" data-id="' + esc(b.id) + '" aria-label="Eintrag löschen">×</button></td></tr>').join("");
    }
    function openDetail(no) {
      const s = setOf(no);
      if (!s) return;
      const e = enrich(s), p = e.p || {}, cls = e.roi >= 0 ? "lg-up" : "lg-down";
      const stats = e.hasPrice ? (p.sales != null ? p.sales + " Verkäufe in 6 Monaten" + (p.min && p.max ? ", " + eur0.format(p.min) + " bis " + eur0.format(p.max) : "") : "") + (p.offers ? " · " + p.offers + " Angebote" + (p.from ? " ab " + eur0.format(p.from) : "") : "") : (p.none ? "Bricklink hat zu diesem Set keinen Preis." : p.err ? "Abruf fehlgeschlagen: " + p.err : "Der Wert wird mit dem nächsten Abruf geholt.");
      const meta = [nrOf(no), p.theme, p.year, s.cond !== "NEU" ? s.cond : ""].filter(Boolean).join(" · ");
      const sh = openSheet('<div class="lg-sh-head"><h3>' + esc(nameOf(e)) + '</h3><button class="lg-x" type="button" data-close aria-label="Schließen">×</button></div>' +
        '<div class="lg-pv"><div class="lg-pic">' + picHtml(no) + '</div><div class="lg-pv-t"><span class="lg-mt">' + esc(meta) + '</span><span class="lg-val ' + cls + '">' + pct(e.roi) + '</span><span class="lg-dl">' + sgn(e.profit) + " · " + pct(e.pa) + " pro Jahr</span></div></div>" +
        '<div class="lg-nums"><span>Einkauf Ø <b>' + eur0.format(e.avg) + "</b></span><span>Wert <b>" + (e.qty ? warnFor(e) + (e.hasPrice ? eur0.format(e.unit) : pendText(e).replace("Wert ", "")) : "–") + "</b></span><span>Stück <b>" + e.qty + "</b></span>" + (e.soldQ ? "<span>Verkauft <b>" + e.soldQ + "</b></span>" : "") + "</div>" +
        '<p class="lg-msg">' + esc(stats) + "</p>" +
        '<div class="lg-scroll"><table><thead><tr><th>Kaufdatum</th><th>Menge</th><th>Preis/Stück</th><th></th></tr></thead><tbody>' + lineRows(s.buys, "buys") + "</tbody></table></div>" +
        (s.sold.length ? '<div class="lg-scroll"><table><thead><tr><th>Verkauft am</th><th>Menge</th><th>Preis/Stück</th><th></th></tr></thead><tbody>' + lineRows(s.sold, "sold") + "</tbody></table></div>" : "") +
        '<div class="lg-actions"><button class="lg-btn lg-sm" type="button" data-act="buy">+ KAUF</button>' + (e.qty ? '<button class="lg-btn lg-sm" type="button" data-act="sell">VERKAUFT</button>' : "") + '<button class="lg-btn lg-sm lg-bad" type="button" data-act="del">LÖSCHEN</button></div>');
      sh.addEventListener("click", (ev) => {
        const b = ev.target.closest("button");
        if (!b) return;
        if (b.dataset.act === "buy") openLine(no, "buy");
        else if (b.dataset.act === "sell") openLine(no, "sell");
        else if (b.dataset.act === "del") arm(b, "WIRKLICH LÖSCHEN?", () => { s.del = true; s.buys = []; s.sold = []; touch(s); closeSheet(); });
        else if (b.dataset.del) arm(b, "SICHER?", () => {
          const list = s[b.dataset.del], i = list.findIndex((x) => x.id === b.dataset.id);
          if (i < 0) return;
          list.splice(i, 1);
          if (!s.buys.length) { s.del = true; s.sold = []; touch(s); closeSheet(); return; }
          touch(s); openDetail(no);
        });
      });
    }
    /* weiterer Kauf oder Verkauf zu einem vorhandenen Set */
    function openLine(no, kind) {
      const s = setOf(no);
      if (!s) return;
      const e = enrich(s), sell = kind === "sell";
      const sh = openSheet('<div class="lg-sh-head"><h3>' + (sell ? "Verkauf eintragen" : "Kauf eintragen") + '</h3><button class="lg-x" type="button" data-close aria-label="Schließen">×</button></div><p class="lg-msg">' + esc(nameOf(e)) + (sell ? " · du hast " + e.qty + " Stück" : "") + "</p>" +
        '<div class="lg-form"><div class="lg-f2">' + field("lgQty", "Anzahl", '<input type="number" id="lgQty" min="1" ' + (sell ? 'max="' + e.qty + '" ' : "") + 'value="1" inputmode="numeric">') +
        field("lgPrice", sell ? "Verkaufspreis pro Stück in Euro" : "Preis pro Stück in Euro", '<input type="text" id="lgPrice" inputmode="decimal" placeholder="0,00"' + (sell && e.unit ? ' value="' + String(e.unit).replace(".", ",") + '"' : "") + ">") + "</div>" +
        field("lgDate", sell ? "Verkauft am" : "Kaufdatum", '<input type="date" id="lgDate" value="' + todayStr() + '" max="' + todayStr() + '">') + '<p class="lg-msg lg-err" id="lgErr" hidden></p></div>' +
        '<div class="lg-actions"><button class="lg-btn lg-sm" type="button" data-close>ABBRECHEN</button><button class="lg-btn lg-go lg-sm" type="button" id="lgSave">SPEICHERN</button></div>');
      const err = (t) => { const el = sh.querySelector("#lgErr"); el.textContent = t; el.hidden = !t; };
      const save = () => {
        const q = Math.floor(+sh.querySelector("#lgQty").value), price = money(sh.querySelector("#lgPrice").value), d = sh.querySelector("#lgDate").value;
        if (!(q >= 1)) return err("Bitte eine Anzahl von mindestens 1 eintragen.");
        if (sell && q > e.qty) return err("So viele Stück hast du nicht (" + e.qty + ").");
        if (price === null) return err("Bitte einen Preis eintragen, z. B. 129,99.");
        if (!dateOk(d) || d > todayStr()) return err("Bitte ein Datum bis heute eintragen.");
        (sell ? s.sold : s.buys).push({ id: uid(), d, p: price, q });
        touch(s); closeSheet(); openDetail(no);
      };
      sh.querySelector("#lgSave").addEventListener("click", save);
      sh.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.tagName === "INPUT") save(); });
    }
    /* neues Set */
    function openAdd() {
      if (!cloudKnown || !assetsLoaded) { toast("Die Sammlung ist noch nicht geladen.", "warn", 4000); return; }
      let img = null, looked = "", lookTimer = 0, busy = 0;
      const sh = openSheet('<div class="lg-sh-head"><h3>Set hinzufügen</h3><button class="lg-x" type="button" data-close aria-label="Schließen">×</button></div>' +
        '<div class="lg-form">' + field("lgNo", "Set-Nummer", '<input type="text" id="lgNo" inputmode="numeric" placeholder="z. B. 75192" autocomplete="off">') +
        '<div id="lgPv"></div><div class="lg-f2">' + field("lgQty", "Anzahl", '<input type="number" id="lgQty" min="1" value="1" inputmode="numeric">') + field("lgPrice", "Preis pro Stück in Euro", '<input type="text" id="lgPrice" inputmode="decimal" placeholder="0,00">') + "</div>" +
        '<p class="lg-msg" id="lgTot" hidden></p><div class="lg-f2">' + field("lgDate", "Kaufdatum", '<input type="date" id="lgDate" value="' + todayStr() + '" max="' + todayStr() + '">') + field("lgCond", "Zustand", '<select id="lgCond">' + COND.map((c) => "<option>" + c + "</option>").join("") + "</select>") + '</div><p class="lg-msg lg-err" id="lgErr" hidden></p></div>' +
        '<div class="lg-actions"><button class="lg-btn lg-sm" type="button" data-close>ABBRECHEN</button><button class="lg-btn lg-go lg-sm" type="button" id="lgSave" disabled>SPEICHERN</button></div>');
      const $ = (id) => sh.querySelector(id);
      const err = (t) => { $("#lgErr").textContent = t; $("#lgErr").hidden = !t; };
      const total = () => { const q = Math.max(1, Math.floor(+$("#lgQty").value) || 1), p = money($("#lgPrice").value) || 0, t = $("#lgTot"); t.hidden = q < 2; t.textContent = "= " + eur2.format(q * p) + " zusammen"; };
      function look() {
        clearTimeout(lookTimer);
        const mine = ++busy; /* jede Eingabe macht eine noch laufende Suche ungueltig */
        const no = normSetNo($("#lgNo").value), pv = $("#lgPv"), save = $("#lgSave");
        err("");
        img = null; looked = ""; save.disabled = true;
        if (!no) { pv.innerHTML = '<p class="lg-msg">Nummer eingeben, Bild und Wert kommen automatisch.</p>'; return; }
        const own = setOf(no);
        lookTimer = setTimeout(async () => {
          pv.innerHTML = '<p class="lg-msg">Suche Set ' + esc(no) + " …</p>"; save.disabled = true;
          try {
            let url = IMG[no] || null, found = !!url;
            if (!url) { url = await fetchSetImage(no); found = !!url; }
            if (mine !== busy) return;
            if (!found) { img = null; looked = ""; pv.innerHTML = '<p class="lg-msg lg-err">Bricklink kennt das Set ' + esc(no) + " nicht. Nummer geprüft?</p>"; return; }
            img = url; looked = no;
            const e = own ? enrich(own) : null;
            pv.innerHTML = '<div class="lg-pv"><div class="lg-pic"><img src="' + img + '" alt=""></div><div class="lg-pv-t"><span class="lg-mt">' + nrOf(no) + (own ? " · schon in der Sammlung" : "") + "</span>" + (e ? "<b>" + esc(nameOf(e)) + '</b><span class="lg-dl">' + (e.hasPrice ? "Wert jetzt " + eur0.format(e.unit) : "Wert folgt") + "</span>" : '<span class="lg-dl">Name und Wert kommen nach dem Speichern (etwa eine Minute).</span>') + "</div></div>";
            save.disabled = false;
            if (own) $("#lgCond").value = own.cond;
          } catch (er) {
            if (mine !== busy) return;
            img = null; looked = ""; pv.innerHTML = '<p class="lg-msg lg-err">Bild konnte nicht geladen werden (' + esc(er.message) + "). Netz prüfen und die Nummer nochmal eintippen.</p>";
          }
        }, 380);
      }
      $("#lgNo").addEventListener("input", look); $("#lgQty").addEventListener("input", total); $("#lgPrice").addEventListener("input", total);
      look(); total();
      const save = () => {
        const no = looked, q = Math.floor(+$("#lgQty").value), price = money($("#lgPrice").value), d = $("#lgDate").value;
        if (!no || !img) return err("Bitte erst eine gültige Set-Nummer eintragen.");
        if (!(q >= 1)) return err("Bitte eine Anzahl von mindestens 1 eintragen.");
        if (price === null) return err("Bitte den Einkaufspreis eintragen, z. B. 479,99.");
        if (!dateOk(d) || d > todayStr()) return err("Bitte ein Datum bis heute eintragen.");
        let s = setOf(no);
        const isNew = !s;
        if (isNew) {
          const tomb = D.sets.find((x) => x.no === no);
          s = { no, cond: $("#lgCond").value, buys: [], sold: [], added: NOW(), upd: NOW() };
          if (tomb) D.sets.splice(D.sets.indexOf(tomb), 1);
          D.sets.push(s);
        }
        s.buys.push({ id: uid(), d, p: price, q });
        if (!IMG[no]) { IMG[no] = img; imgDirty = true; }
        if (isNew || !(P.items[no] && P.items[no].val)) needPriceRun = true;
        ui.sets = true; saveUi();
        touch(s); closeSheet();
        toast(isNew ? "Set hinzugefügt." : "Kauf ergänzt.", "ok", 3000);
      };
      $("#lgSave").addEventListener("click", save);
      sh.addEventListener("keydown", (ev) => { if (ev.key === "Enter" && ev.target.tagName === "INPUT" && !$("#lgSave").disabled) save(); });
    }

    /* ---------- Bedienung ---------- */
    main.addEventListener("click", (e) => {
      const b = e.target.closest("button");
      if (!b || !main.contains(b)) return;
      if (b.dataset.r) { ui.range = b.dataset.r; saveUi(); renderAll(); }
      else if (b.dataset.v) { ui.view = b.dataset.v; saveUi(); renderAll(); }
      else if (b.dataset.act === "info") { ui.info = !ui.info; saveUi(); renderAll(); }
      else if (b.dataset.act === "add") openAdd();
      else if (b.id === "lgFold") { ui.sets = !ui.sets; saveUi(); renderAll(); }
      else if (b.dataset.no) openDetail(b.dataset.no);
    });
    main.addEventListener("change", (e) => { if (e.target.id === "lgSort") { ui.sort = e.target.value; saveUi(); renderAll(); } });
    const addBtn = document.getElementById("lgAdd");
    if (addBtn) addBtn.addEventListener("click", openAdd);

    /* ---------- Start ---------- */
    buildShell();
    async function boot() {
      const ok = await loadCloud();
      if (ok) { await Promise.all([loadPrices(), loadImages()]); assetsLoaded = true; renderAll(); if (missingPrices().length) pollPrices(); }
      else renderAll();
    }
    boot();
    return {
      /* "Sync"-Knopf: Cloud lesen, vereinigen, Unbestaetigtes hochladen. true = alles gesichert. */
      async sync() {
        clearTimeout(pushTimer);
        if (!(await loadCloud())) return false;
        await Promise.all([loadPrices(), loadImages()]);
        renderAll();
        if (dirty || imgDirty) { await pushNow(); }
        return !dirty && !imgDirty;
      },
      refresh() { return Promise.all([loadPrices(), loadImages()]).then(renderAll); },
      open() { if (!cloudKnown) return; ui.sets = true; saveUi(); renderAll(); },
      add: openAdd
    };
  };
})();
