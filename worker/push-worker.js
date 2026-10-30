/* Cloudflare Worker "dashboard-push": echte Handy-Benachrichtigungen (Web-Push) fuer das Dashboard.

   Was er tut: alle 10 Minuten (Cron) fragt er Bricklink nach neuen Bestellungen und Kaeufer-Nachrichten, liest die Daten-Dateien des Dashboards (privates Repo)
   (Habits, Training, To-Dos, Upload-Rhythmus, After Upload, Timer) und schickt dir passende Meldungen aufs Handy, auch bei geschlossener App.
   Er merkt sich, was schon gemeldet wurde (nichts kommt doppelt), haelt in den Ruhezeiten alles zurueck und fasst es danach zusammen.
   Die Schluessel fuer die Verschluesselung (VAPID) erzeugt er beim ersten Aufruf selbst und legt sie im KV-Speicher ab.

   Einrichtung (einmalig, alles im Browser, kein Programm noetig):
   1. cloudflare.com -> Workers & Pages -> KV -> "Create a namespace", Name z. B. "dashboard-push".
   2. Workers & Pages -> Create -> Worker, Name z. B. "dashboard-push" -> Deploy, dann "Edit code" und diesen ganzen Code einfuegen -> Deploy.
   3. Worker -> Settings -> Bindings -> Add -> KV namespace: Variable name = KV, Namespace = dashboard-push -> Deploy.
   4. Settings -> Variables and Secrets -> Add (jeweils als Secret):
        APP_SECRET                 ein langes selbst ausgedachtes Wort (dasselbe traegst du im Dashboard als "Geheimes Wort" ein)
        BRICKLINK_CONSUMER_KEY, BRICKLINK_CONSUMER_SECRET, BRICKLINK_TOKEN_VALUE, BRICKLINK_TOKEN_SECRET   (die vier Werte aus deinem Bricklink-API-Zugang, wie bei den GitHub-Secrets)
      Daten aus dem PRIVATEN Repo (seit 30.10.2026): DATA_REPO (Text) = kilianmnlg-hub/dashboard-privat und DATA_TOKEN (Secret) = fine-grained Token, nur dieses Repo, Contents: Read (Lesen reicht)
      Optional (Text): ALLOWED_ORIGINS = https://DEIN-NAME.github.io (mehrere mit Komma), DATA_BASE = nur noch Rueckfall: Adresse der Dashboard-Seite mit / am Ende
   5. Settings -> Triggers -> Cron Triggers -> Add, Cron expression: alle 10 Minuten, also 0-59/10 * * * * (Stern, Schraegstrich, 10 geht auch)
   6. Im Dashboard: Sync-Knopf, Pfeil daneben -> Benachrichtigungen: Adresse des Workers (https://dashboard-push.DEIN-NAME.workers.dev) und Geheimes Wort eintragen,
      "Auf diesem Handy aktivieren" tippen, "Testmeldung senden".
   Kosten: keine (gratis Stufe von Cloudflare reicht). Ohne Eintrag im Dashboard und ohne Handy-Anmeldung wird nichts gesendet.

   Spaeter pruefen: GET <Adresse>/status (mit Kopfzeile Authorization: Bearer <Wort>) oder im Dashboard Sync-Pfeil -> Status. */

const DEFAULT_ORIGINS = ["https://kilianmnlg-hub.github.io", "http://localhost:8951", "http://localhost:8962", "http://localhost:8963", "http://localhost:8080"];
const DEFAULT_DATA_BASE = "https://kilianmnlg-hub.github.io/Dashboard/";
const BL_BASE = "https://api.bricklink.com/api/store/v1";
const SUBJECT = "https://kilianmnlg-hub.github.io/Dashboard/";
const TZ = "Europe/Berlin";
const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const SHIP_STATUSES = ["PAID", "PACKED", "READY"];
const CLOSED_STATUSES = ["COMPLETED", "CANCELLED", "NPB", "NPX", "NRS", "NSS"];
const NON_REVENUE = ["CANCELLED", "NPB", "NPX", "NRS", "NSS"];
const DEFAULT_AU_IDS = ["title", "desc", "playlist", "endscreen", "comment", "post", "short", "insta", "facebook", "tiktok", "reply", "stats", "idea"];
const LABELS = { youtube: "YouTube", bricklink: "Bricklink" };
const MAX_SUBS = 6;

const DEFAULT_SETTINGS = {
  v: 1,
  events: {
    newOrder: { on: true },
    unshipped: { on: true, hours: 24 },
    message: { on: true },
    rhythm: { on: true, time: "09:00" },
    afterUpload: { on: true, delayMin: 60 },
    habits: { on: true, time: "19:00" },
    training: { on: true, time: "11:30" },
    timer: { on: true, hours: 3 },
    summary: { on: true, time: "08:00" }
  },
  quiet: { on: true, from: "22:00", to: "07:00" }
};

/* Beispielmeldungen fuer "Alle Beispiele senden" im Dashboard (so sehen die echten aus; vor dem Titel steht "Beispiel:"; Aufruf: POST /test {kind:"sample", index:0..8}) */
const SAMPLES = [
  { title: "Beispiel: Neue Bricklink-Bestellung", body: "#32912345 · 3 Teile · 24,90 €", url: "#business", tag: "sample-order" },
  { title: "Beispiel: Bestellung wartet seit 26 Std.", body: "#32900634 ist noch nicht versendet", url: "#business", tag: "sample-unshipped" },
  { title: "Beispiel: Neue Nachricht von einem Käufer", body: "Bestellung #32618443", url: "#business", tag: "sample-msg" },
  { title: "Beispiel: Brainwalkers: 15 Tage ohne Longform-Video", body: "Dein Rhythmus: alle 14 Tage", url: "#business", tag: "sample-rhythm" },
  { title: "Beispiel: After Upload: 3 Punkte offen", body: "Diese LEGO Jurassic World Sets fehlen bis heute!", url: "#afterupload", tag: "sample-after" },
  { title: "Beispiel: Gym: 1 von 3 diese Woche", body: "Noch 3 Tage Zeit", url: "#habits", tag: "sample-habits" },
  { title: "Beispiel: Heute: Brust/Rücken", body: "Brust, Rücken · 6 Übungen · ca. 50 Min", url: "#training", tag: "sample-training" },
  { title: "Beispiel: YouTube-Timer läuft seit 3 Std.", body: "Vergessen zu stoppen?", url: "#zeit", tag: "sample-timer" },
  { title: "Beispiel: Guten Morgen, Kilian", body: "Heute: 3 To-Dos · Brust/Rücken · 1 Bestellung zu versenden", url: "./", tag: "sample-summary" }
];

/* ---------------------------------------------------------------------------------------------------------------------------------- Helfer */
const enc = new TextEncoder();
const b64u = (buf) => {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s) => {
  s = String(s).replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s), out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};
const cat = (...arrs) => {
  const out = new Uint8Array(arrs.reduce((n, a) => n + a.length, 0));
  let o = 0;
  arrs.forEach((a) => { out.set(a, o); o += a.length; });
  return out;
};
const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors || {}) });
const clip = (s, n) => { s = String(s == null ? "" : s); return s.length > n ? s.slice(0, n - 1) + "…" : s; };
const lower = (v) => String(v == null ? "" : v).trim().toLowerCase();

/* Vergleich in konstanter Zeit, damit das geheime Wort nicht erraten werden kann */
function same(a, b) {
  a = String(a || ""); b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

/* Datum und Uhrzeit in Deutschland (Sommer-/Winterzeit automatisch) */
function berlin(ms) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", weekday: "short" });
  const p = {};
  f.formatToParts(new Date(ms)).forEach((x) => { p[x.type] = x.value; });
  return { date: p.year + "-" + p.month + "-" + p.day, min: (+p.hour) * 60 + (+p.minute), wd: { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[p.weekday] };
}
const toMin = (t) => { const m = /^(\d{2}):(\d{2})$/.exec(t || ""); return m ? (+m[1]) * 60 + (+m[2]) : 0; };
const isTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
function inQuiet(q, min) {
  if (!q || !q.on) return false;
  const a = toMin(q.from), b = toMin(q.to);
  if (a === b) return false;
  return a < b ? min >= a && min < b : min >= a || min < b;
}
/* Eine feste Tageszeit ist "dran", wenn sie erreicht ist und hoechstens 3 Stunden zurueckliegt (Dedup-Schluessel verhindern Wiederholungen) */
const dueNow = (t, min) => { const a = toMin(t); return min >= a && min < a + 180; };
/* Die sieben Tage (Mo bis So) der Woche eines Datums als Texte */
function weekKeys(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d), wd = (new Date(t).getUTCDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => new Date(t - wd * DAY + i * DAY).toISOString().slice(0, 10));
}

function cleanSettings(raw) {
  const out = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (!raw || typeof raw !== "object") return out;
  const ev = raw.events && typeof raw.events === "object" ? raw.events : {};
  Object.keys(out.events).forEach((k) => {
    const src = ev[k], dst = out.events[k];
    if (!src || typeof src !== "object") return;
    if (typeof src.on === "boolean") dst.on = src.on;
    if ("time" in dst && isTime(src.time)) dst.time = src.time;
    if ("hours" in dst && Number.isFinite(+src.hours)) dst.hours = Math.max(1, Math.min(72, Math.round(+src.hours)));
    if ("delayMin" in dst && Number.isFinite(+src.delayMin)) dst.delayMin = Math.max(0, Math.min(1440, Math.round(+src.delayMin)));
  });
  const q = raw.quiet;
  if (q && typeof q === "object") {
    if (typeof q.on === "boolean") out.quiet.on = q.on;
    if (isTime(q.from)) out.quiet.from = q.from;
    if (isTime(q.to)) out.quiet.to = q.to;
  }
  return out;
}

/* KV-Speicher (Binding "KV") */
async function kget(env, key, fallback) { try { const v = await env.KV.get(key, "json"); return v == null ? fallback : v; } catch (e) { return fallback; } }
const kput = (env, key, val) => env.KV.put(key, JSON.stringify(val));

/* ----------------------------------------------------------------------------------------------------------------------------- Web-Push */
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

/* Nachricht nach RFC 8291 (aes128gcm) verschluesseln. sub = { endpoint, keys: { p256dh, auth } }. test (nur fuer Pruefungen): feste Schluessel und Salz. */
async function encryptPayload(sub, plaintext, test) {
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const salt = (test && test.salt) || crypto.getRandomValues(new Uint8Array(16));
  let asPriv, asPub;
  if (test && test.asJwk) {
    asPriv = await crypto.subtle.importKey("jwk", test.asJwk, { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
    asPub = cat(new Uint8Array([4]), unb64u(test.asJwk.x), unb64u(test.asJwk.y));
  } else {
    const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    asPriv = kp.privateKey;
    asPub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  }
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, asPriv, 256));
  const ikm = await hkdf(auth, ecdh, cat(enc.encode("WebPush: info\0"), uaPub, asPub), 32);
  const cek = await hkdf(salt, ikm, enc.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, enc.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, cat(plaintext, new Uint8Array([2]))));
  return cat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub, ct);
}

/* VAPID-Schluessel: beim ersten Mal erzeugen und im KV ablegen */
async function getVapid(env) {
  let v = await kget(env, "vapid", null);
  if (v && v.pub && v.jwk) return v;
  const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  v = { pub: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)), jwk: await crypto.subtle.exportKey("jwk", kp.privateKey) };
  await kput(env, "vapid", v);
  return v;
}
async function vapidAuth(vapid, endpoint, cache, now) {
  const aud = new URL(endpoint).origin;
  if (cache && cache[aud]) return cache[aud];
  const head = b64u(enc.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const claims = b64u(enc.encode(JSON.stringify({ aud, exp: Math.floor((now || Date.now()) / 1000) + 12 * 3600, sub: SUBJECT })));
  const key = await crypto.subtle.importKey("jwk", vapid.jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, enc.encode(head + "." + claims));
  const header = "vapid t=" + head + "." + claims + "." + b64u(sig) + ", k=" + vapid.pub;
  if (cache) cache[aud] = header;
  return header;
}
async function sendPush(vapid, sub, payload, o) {
  try {
    const body = await encryptPayload(sub, payload);
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: { Authorization: await vapidAuth(vapid, sub.endpoint, o && o.cache, o && o.now), "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String((o && o.ttl) || 43200), Urgency: (o && o.urgency) || "normal" },
      body
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, gone: res.status === 404 || res.status === 410 };
  } catch (e) {
    return { ok: false, status: 0, error: String((e && e.message) || e).slice(0, 120) };
  }
}

/* -------------------------------------------------------------------------------------------------------------------------- Bricklink */
const pe = (s) => encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
/* OAuth 1.0a (HMAC-SHA1), gleiche Rechnung wie scripts/lib/oauth1.mjs */
async function oauthHeader(method, url, query, c, fixed) {
  const o = {
    oauth_consumer_key: c.key,
    oauth_nonce: (fixed && fixed.nonce) || Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join(""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: (fixed && fixed.ts) || String(Math.floor(Date.now() / 1000)),
    oauth_token: c.token,
    oauth_version: "1.0"
  };
  const all = Object.assign({}, query, o);
  const ps = Object.keys(all).sort().map((k) => pe(k) + "=" + pe(String(all[k]))).join("&");
  const base = [method.toUpperCase(), pe(url), pe(ps)].join("&");
  const key = await crypto.subtle.importKey("raw", enc.encode(pe(c.secret) + "&" + pe(c.tokenSecret)), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = btoa(String.fromCharCode.apply(null, new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(base)))));
  const hp = Object.assign({}, o, { oauth_signature: sig });
  return "OAuth " + Object.keys(hp).sort().map((k) => pe(k) + '="' + pe(hp[k]) + '"').join(", ");
}
async function blGet(env, path, query) {
  const url = BL_BASE + path, qs = new URLSearchParams(query || {}).toString();
  const auth = await oauthHeader("GET", url, query || {}, { key: env.BRICKLINK_CONSUMER_KEY, secret: env.BRICKLINK_CONSUMER_SECRET, token: env.BRICKLINK_TOKEN_VALUE, tokenSecret: env.BRICKLINK_TOKEN_SECRET });
  const res = await fetch(qs ? url + "?" + qs : url, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error("Bricklink " + res.status);
  const j = await res.json();
  if (j.meta && j.meta.code >= 300) throw new Error("Bricklink: " + (j.meta.message || j.meta.code));
  return j.data;
}
const messageTime = (m) => Date.parse((m && (m.dateSent || m.date_sent || m.date)) || "") || 0;
const messageFrom = (m) => lower(m && (m.from || m.from_user || m.sender));
const messageId = (m) => String((m && (m.messageID || m.message_id || m.id)) || "").trim();
const money = (v, cur) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  try { return new Intl.NumberFormat("de-DE", { style: "currency", currency: cur || "EUR" }).format(n); } catch (e) { return n.toFixed(2).replace(".", ",") + " " + (cur || "€"); }
};

/* --------------------------------------------------------------------------------------------------------------------------- Meldungen */
/* Eine Meldung vormerken. key = Schluessel gegen Doppelte (leer = keiner). In den Ruhezeiten wird sie zurueckgehalten (force = trotzdem sofort). */
function emit(ctx, n) {
  if (n.key && !n.force) {
    if (ctx.seen.sent[n.key]) return false;
    ctx.seen.sent[n.key] = ctx.now;
  }
  n.ts = ctx.now;
  if (!n.force && ctx.quiet) ctx.st.queue.push(n);
  else ctx.out.push(n);
  return true;
}

async function loadData(ctx, file) {
  if (ctx.cache[file]) return ctx.cache[file];
  const base = ctx.env.DATA_BASE || DEFAULT_DATA_BASE;
  ctx.cache[file] = (async () => {
    /* Die Daten-Dateien liegen im PRIVATEN Repo: Zugriff ueber DATA_REPO ("besitzer/repo") und das Secret DATA_TOKEN (nur Lesen noetig).
       Fehlt eines von beiden, wird wie frueher die oeffentliche Seite gelesen (DATA_BASE). */
    const priv = ctx.env.DATA_REPO && ctx.env.DATA_TOKEN;
    const res = priv
      ? await fetch("https://api.github.com/repos/" + ctx.env.DATA_REPO + "/contents/" + file, { headers: { Authorization: "Bearer " + ctx.env.DATA_TOKEN, Accept: "application/vnd.github.raw+json", "User-Agent": "dashboard-push-worker" } })
      : await fetch(base + file + "?t=" + Math.floor(ctx.now / MIN), { headers: { "Cache-Control": "no-cache" } });
    if (!res.ok) throw new Error(file + " " + res.status);
    if (file !== "data.js") return res.json();
    const text = await res.text(), a = text.indexOf("{", text.indexOf("DASHBOARD_DATA")), b = text.lastIndexOf("\n};");
    if (a < 0 || b < a) throw new Error("data.js nicht lesbar");
    return JSON.parse(text.slice(a, b + 2));
  })();
  return ctx.cache[file];
}

async function checkBricklink(ctx) {
  const { env, ev, seen, st, now } = ctx;
  if (!(ev.newOrder.on || ev.unshipped.on || ev.message.on)) return;
  if (!(env.BRICKLINK_CONSUMER_KEY && env.BRICKLINK_CONSUMER_SECRET && env.BRICKLINK_TOKEN_VALUE && env.BRICKLINK_TOKEN_SECRET)) {
    st.bl = { ok: false, at: now, error: "Bricklink-Zugangsdaten fehlen im Worker", fails: 0 };
    return;
  }
  let orders;
  try {
    orders = (await blGet(env, "/orders", { direction: "in", filed: "false" })) || [];
  } catch (e) {
    const fails = ((st.bl && st.bl.fails) || 0) + 1;
    st.bl = { ok: false, at: now, error: clip((e && e.message) || e, 120), fails };
    if (fails >= 3) emit(ctx, { type: "ops", key: "ops-bl:" + ctx.nowB.date, title: "Bricklink-Abfrage fehlgeschlagen", body: st.bl.error, url: "#business", tag: "ops-bl" });
    return;
  }
  const first = !seen.ordersInit;
  const late = [];
  let ships = 0;
  orders.forEach((o) => {
    const id = String(o.order_id), status = String(o.status || "").toUpperCase(), at = Date.parse(o.date_ordered) || 0;
    if (!seen.orders[id]) {
      seen.orders[id] = now;
      if (!first && ev.newOrder.on && !NON_REVENUE.includes(status)) {
        const parts = ["#" + id];
        if (o.total_count) parts.push(o.total_count + (Number(o.total_count) === 1 ? " Teil" : " Teile"));
        const total = money(o.cost && o.cost.grand_total, o.cost && o.cost.currency_code);
        if (total) parts.push(total);
        emit(ctx, { type: "newOrder", key: "order:" + id, title: "Neue Bricklink-Bestellung", body: parts.join(" · "), url: "#business", tag: "order-" + id, urgency: "high" });
      }
    }
    if (SHIP_STATUSES.includes(status)) {
      ships++;
      const ageH = at ? (now - at) / HOUR : 0;
      if (ev.unshipped.on && at && ageH >= ev.unshipped.hours) late.push({ id, ageH, bucket: Math.floor(ageH / 24) });
    }
  });
  seen.ordersInit = true;
  const fresh = late.filter((x) => !seen.sent["unshipped:" + x.id + ":" + x.bucket]);
  if (fresh.length) {
    late.forEach((x) => { seen.sent["unshipped:" + x.id + ":" + x.bucket] = now; });
    late.sort((a, b) => b.ageH - a.ageH);
    const w = late[0], hrs = Math.floor(w.ageH), age = hrs >= 48 ? Math.floor(hrs / 24) + " Tagen" : hrs + " Std.";
    emit(ctx, late.length === 1
      ? { type: "unshipped", title: "Bestellung wartet seit " + age, body: "#" + w.id + " ist noch nicht versendet", url: "#business", tag: "unshipped" }
      : { type: "unshipped", title: late.length + " Bestellungen warten auf Versand", body: "Älteste: #" + w.id + " seit " + age, url: "#business", tag: "unshipped" });
  }
  st.bl = { ok: true, at: now, error: "", fails: 0, open: orders.length, ships, msgAt: (st.bl && st.bl.msgAt) || 0 };

  /* Kaeufer-Nachrichten: nur alle ca. 30 Minuten, hoechstens 15 Bestellungen (die Bricklink-API erlaubt 5.000 Aufrufe am Tag) */
  if (ev.message.on && now - (st.lastMsgAt || 0) >= 25 * MIN) {
    st.lastMsgAt = now;
    const cands = orders.filter((o) => !CLOSED_STATUSES.includes(String(o.status || "").toUpperCase())).sort((a, b) => (Date.parse(b.date_ordered) || 0) - (Date.parse(a.date_ordered) || 0)).slice(0, 15);
    const fresh2 = [];
    let failed = 0;
    for (let i = 0; i < cands.length && failed < 3; i += 5) {
      const res = await Promise.all(cands.slice(i, i + 5).map(async (o) => {
        try { return { o, msgs: await blGet(env, "/orders/" + o.order_id + "/messages", {}) }; } catch (e) { failed++; return null; }
      }));
      res.forEach((r) => {
        if (!r || !Array.isArray(r.msgs) || !r.msgs.length) return;
        const buyer = lower(r.o.buyer_name), sorted = r.msgs.slice().sort((a, b) => messageTime(a) - messageTime(b));
        let s = sorted.length;
        while (s > 0 && buyer && messageFrom(sorted[s - 1]) === buyer) s--;
        sorted.slice(s).forEach((m) => {
          const id = messageId(m) || r.o.order_id + "-" + messageTime(m);
          if (seen.msgs[id]) return;
          seen.msgs[id] = now;
          fresh2.push(String(r.o.order_id));
        });
      });
    }
    if (failed < 3) {
      if (!seen.msgsInit) seen.msgsInit = true;
      else if (fresh2.length) {
        const ords = Array.from(new Set(fresh2));
        emit(ctx, { type: "message", title: fresh2.length === 1 ? "Neue Nachricht von einem Käufer" : fresh2.length + " neue Käufer-Nachrichten", body: (ords.length === 1 ? "Bestellung #" : "Bestellungen #") + ords.slice(0, 3).join(", #") + (ords.length > 3 ? " …" : ""), url: "#business", tag: "msg", urgency: "high" });
      }
    }
  }
}

/* Naechster Trainingstag wie in training.js nextDay(): auf den Tag nach der letzten Einheit des Plans, sonst der erste */
function nextTrainingDay(t) {
  const plan = (t.plans || []).find((p) => p.id === (t.settings && t.settings.plan)) || (t.plans || [])[0];
  const days = plan ? plan.days || [] : [];
  if (!days.length) return null;
  const ids = days.map((d) => d.id), sess = (t.sessions || []).slice().sort((a, b) => (a.a || 0) - (b.a || 0));
  for (let i = sess.length - 1; i >= 0; i--) { const p = ids.indexOf(sess[i].day); if (p >= 0) return days[(p + 1) % days.length]; }
  return days[0];
}
const planSets = (day) => (day.ex || []).reduce((n, e) => n + ((e.s || []).length), 0);

async function checkData(ctx) {
  const { ev, now, nowB, seen, st } = ctx, f = (name) => ctx.force === name;
  const wantHabits = f("habits") || (ev.habits.on && dueNow(ev.habits.time, nowB.min));
  const wantTraining = f("training") || (ev.training.on && dueNow(ev.training.time, nowB.min));
  const wantRhythm = f("rhythm") || (ev.rhythm.on && dueNow(ev.rhythm.time, nowB.min));
  const wantSummary = f("summary") || (ev.summary.on && dueNow(ev.summary.time, nowB.min));
  const wantAfter = ev.afterUpload.on, wantTimer = ev.timer.on;
  if (!(wantHabits || wantTraining || wantRhythm || wantSummary || wantAfter || wantTimer)) return;
  const key = (k, force) => (force ? "" : k);

  try {
    if (wantHabits) {
      const h = await loadData(ctx, "habits-data.json"), keys = weekKeys(nowB.date), left = 7 - keys.indexOf(nowB.date), log = h.log || {};
      const risk = [];
      (h.habits || []).forEach((x) => {
        const target = Number.isInteger(x.targetPerWeek) ? x.targetPerWeek : 7;
        const ticks = keys.filter((k) => log[k] && log[k][x.id]).length, today = !!(log[nowB.date] && log[nowB.date][x.id]);
        const chances = today ? left - 1 : left, need = target - ticks;
        /* in Gefahr = es muss ab jetzt jeder verbleibende Tag klappen (braucht mehr Tage als uebrig, ist das Ziel schon verloren und es gibt nichts mehr zu retten) */
        if (need > 0 && need === chances) risk.push({ label: x.label, ticks, target, chances });
      });
      if (risk.length) {
        const one = risk.length === 1, r = risk[0];
        emit(ctx, { type: "habits", force: f("habits"), key: key("habits:" + nowB.date, f("habits")), title: one ? r.label + ": " + r.ticks + " von " + r.target + " diese Woche" : risk.length + " Wochenziele in Gefahr", body: one ? "Noch " + r.chances + (r.chances === 1 ? " Tag" : " Tage") + " Zeit" : risk.slice(0, 4).map((x) => x.label + " " + x.ticks + "/" + x.target).join(" · ") + (risk.length > 4 ? " …" : ""), url: "#habits", tag: "habits" });
      } else if (f("habits")) emit(ctx, { type: "habits", force: true, title: "Alle Wochenziele auf Kurs", body: "Kein Habit ist in Gefahr.", url: "#habits", tag: "habits" });
    }

    let day = null, trainedToday = false, restToday = false;
    if (wantTraining || wantSummary) {
      const t = await loadData(ctx, "training-data.json");
      day = nextTrainingDay(t);
      trainedToday = (t.sessions || []).some((s) => s.d === nowB.date);
      restToday = ((t.rest && t.rest.days) || []).indexOf(nowB.wd) >= 0;
      if (wantTraining && day && (f("training") || (!restToday && !trainedToday))) {
        const sets = planSets(day), rest = (t.settings && t.settings.restSec) || 120, est = Math.max(5, Math.round((sets * (45 + rest)) / 60 / 5) * 5);
        emit(ctx, { type: "training", force: f("training"), key: key("training:" + nowB.date, f("training")), title: "Heute: " + day.n, body: [day.f, (day.ex || []).length + " Übungen", "ca. " + est + " Min"].filter(Boolean).join(" · "), url: "#training", tag: "training" });
      }
    }

    if (wantRhythm || wantAfter) {
      const d = await loadData(ctx, "data.js"), biz = d.business || {};
      if (wantRhythm) {
        Object.keys(biz).forEach((k) => {
          const b = biz[k];
          if (!b || !b.uploadRhythmDays || !b.lastUploadAt) return;
          const days = Math.floor((now - Date.parse(b.lastUploadAt)) / DAY);
          if (days <= b.uploadRhythmDays && !f("rhythm")) return;
          emit(ctx, { type: "rhythm", force: f("rhythm"), key: key("rhythm:" + k + ":" + nowB.date, f("rhythm")), title: String(b.title || k).replace(/^The /, "") + ": " + days + (days === 1 ? " Tag" : " Tage") + " ohne Longform-Video", body: "Dein Rhythmus: alle " + b.uploadRhythmDays + " Tage", url: "#business", tag: "rhythm-" + k });
        });
      }
      if (wantAfter) {
        const s = await loadData(ctx, "sync-data.json"), au = s.afterUpload || {}, ids = Array.isArray(au.items) && au.items.length ? au.items.map((i) => i.id) : DEFAULT_AU_IDS;
        Object.keys(biz).forEach((k) => {
          ((biz[k] && biz[k].recentUploads) || []).forEach((v) => {
            const det = Date.parse(v.detectedAt || "");
            if (!det || now - det < ev.afterUpload.delayMin * MIN || now - det > 7 * DAY) return;
            const l = (au.lists || {})[v.id];
            if (l && (l.x || l.c)) return;
            const open = ids.length - ids.filter((i) => l && l.d && l.d[i]).length;
            if (open > 0) emit(ctx, { type: "afterUpload", key: "after:" + v.id, title: "After Upload: " + open + (open === 1 ? " Punkt" : " Punkte") + " offen", body: clip(v.title, 90), url: "#afterupload", tag: "after-" + v.id });
          });
        });
      }
    }

    if (wantTimer) {
      const s = await loadData(ctx, "sync-data.json"), act = (s.timetracker && s.timetracker.active) || {};
      Object.keys(act).forEach((c) => {
        const start = Number(act[c]);
        if (!start || now - start < ev.timer.hours * HOUR) return;
        const hrs = Math.floor((now - start) / HOUR);
        emit(ctx, { type: "timer", key: "timer:" + c + ":" + start, title: (LABELS[c] || c) + "-Timer läuft seit " + hrs + " Std.", body: "Vergessen zu stoppen?", url: "#zeit", tag: "timer-" + c });
      });
    }

    if (wantSummary) {
      const s = await loadData(ctx, "sync-data.json"), parts = [];
      const td = s.todos && s.todos.date === nowB.date ? s.todos.items || {} : {};
      const todos = Object.keys(td).reduce((n, k) => n + (td[k] || []).filter((i) => !i.done).length, 0);
      const tasks = ((s.tasks && s.tasks.items) || []).filter((i) => !i.done).length + ((s.remoteTasks && s.remoteTasks.items) || []).filter((i) => !i.done).length;
      if (todos) parts.push(todos + (todos === 1 ? " To-Do" : " To-Dos"));
      if (tasks) parts.push(tasks + (tasks === 1 ? " Aufgabe" : " Aufgaben"));
      if (day && !restToday && !trainedToday) parts.push(day.n);
      let ships = st.bl && st.bl.ok ? st.bl.ships : null;
      if (ships == null) { try { ships = (((await loadData(ctx, "data.js")).bricklinkOrders || {}).pendingShipments || []).length; } catch (e) { ships = 0; } }
      if (ships) parts.push(ships + (ships === 1 ? " Bestellung" : " Bestellungen") + " zu versenden");
      if (parts.length || f("summary")) emit(ctx, { type: "summary", force: f("summary"), key: key("summary:" + nowB.date, f("summary")), title: "Guten Morgen, Kilian", body: parts.length ? "Heute: " + parts.join(" · ") : "Heute ist nichts offen.", url: "./", tag: "summary" });
    }
    st.data = { ok: true, at: now, error: "" };
  } catch (e) {
    st.data = { ok: false, at: now, error: clip((e && e.message) || e, 120) };
  }
}

/* ------------------------------------------------------------------------------------------------------------------------------ Ablauf */
async function run(env, opts) {
  opts = opts || {};
  const now = opts.now || Date.now(), nowB = berlin(now);
  const settings = cleanSettings(await kget(env, "settings", null));
  const st = Object.assign({ queue: [], sent: [], runs: 0 }, await kget(env, "state", {}));
  const seen = Object.assign({ orders: {}, msgs: {}, sent: {}, ordersInit: false, msgsInit: false }, await kget(env, "seen", {}));
  const subs = await kget(env, "subs", []);
  const seenBefore = JSON.stringify(seen);
  const ctx = { env, now, nowB, settings, ev: settings.events, st, seen, out: [], cache: {}, force: opts.only || "", quiet: inQuiet(settings.quiet, nowB.min) };
  st.lastRun = now;
  st.runs = (st.runs || 0) + 1;

  if (!opts.only) { try { await checkBricklink(ctx); } catch (e) { st.bl = { ok: false, at: now, error: clip((e && e.message) || e, 120), fails: 1 }; } }
  try { await checkData(ctx); } catch (e) { st.data = { ok: false, at: now, error: clip((e && e.message) || e, 120) }; }

  /* Zurueckgehaltenes nach der Ruhezeit: eine Meldung oder eine Sammelmeldung */
  if (!ctx.quiet && st.queue.length && !opts.only) {
    const q = st.queue.filter((n) => now - n.ts < 18 * HOUR);
    st.queue = [];
    if (q.length === 1) ctx.out.unshift(q[0]);
    else if (q.length > 1) ctx.out.unshift({ type: "overnight", title: "Über Nacht: " + q.length + " Meldungen", body: q.slice(0, 3).map((n) => n.title).join(" · ") + (q.length > 3 ? " …" : ""), url: q[0].url, tag: "overnight", ts: now });
  }

  let delivered = 0;
  if (ctx.out.length && subs.length) {
    const vapid = await getVapid(env), jwt = {}, gone = new Set();
    for (const n of ctx.out) {
      const payload = enc.encode(JSON.stringify({ title: n.title, body: n.body, url: n.url || "./", tag: n.tag || "", ts: n.ts || now, type: n.type }));
      const rs = await Promise.all(subs.map((s) => sendPush(vapid, s, payload, { cache: jwt, now, urgency: n.urgency })));
      rs.forEach((r, i) => { if (r.gone) gone.add(subs[i].endpoint); });
      const ok = rs.filter((r) => r.ok).length;
      delivered += ok;
      st.sent.push({ t: now, type: n.type, title: n.title, ok, n: rs.length, status: rs.length ? rs[0].status : 0 });
    }
    if (gone.size) await kput(env, "subs", subs.filter((s) => !gone.has(s.endpoint)));
  } else if (ctx.out.length) {
    ctx.out.forEach((n) => st.sent.push({ t: now, type: n.type, title: n.title, ok: 0, n: 0, status: 0 }));
  }
  st.sent = st.sent.filter((x) => now - x.t < 3 * DAY).slice(-40);

  /* Vergessene Schluessel aufraeumen */
  ["orders", "msgs", "sent"].forEach((k) => {
    const keys = Object.keys(seen[k]);
    if (keys.length > 400) keys.sort((a, b) => seen[k][a] - seen[k][b]).slice(0, keys.length - 300).forEach((x) => delete seen[k][x]);
    keys.forEach((x) => { if (seen[k][x] && now - seen[k][x] > 45 * DAY) delete seen[k][x]; });
  });
  await kput(env, "state", st);
  if (JSON.stringify(seen) !== seenBefore) await kput(env, "seen", seen);
  return { out: ctx.out.map((n) => ({ type: n.type, title: n.title, body: n.body })), delivered, subs: subs.length, quiet: ctx.quiet };
}

/* ------------------------------------------------------------------------------------------------------------------------ Schnittstelle */
function corsFor(req, env) {
  const allowed = (env.ALLOWED_ORIGINS ? String(env.ALLOWED_ORIGINS).split(",").map((s) => s.trim()) : DEFAULT_ORIGINS);
  const origin = req.headers.get("Origin") || "";
  const ok = allowed.indexOf(origin) >= 0;
  return { ok, headers: { "Access-Control-Allow-Origin": ok ? origin : allowed[0], "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Max-Age": "86400", Vary: "Origin" } };
}

async function handle(req, env) {
  const cors = corsFor(req, env), url = new URL(req.url), path = url.pathname.replace(/\/+$/, "") || "/";
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors.headers });
  if (path === "/") return new Response("Dashboard-Push läuft.", { headers: cors.headers });
  if (!env.KV) return json({ error: "KV-Binding fehlt (Variable name KV)" }, 500, cors.headers);
  if (path === "/vapid") { const v = await getVapid(env); return json({ publicKey: v.pub }, 200, cors.headers); }
  if (!env.APP_SECRET) return json({ error: "APP_SECRET fehlt im Worker" }, 500, cors.headers);
  const auth = req.headers.get("Authorization") || "";
  if (!same(auth.replace(/^Bearer\s+/i, ""), env.APP_SECRET)) return json({ error: "Geheimes Wort falsch" }, 401, cors.headers);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};

  if (path === "/ping") return json({ ok: true, bricklink: !!(env.BRICKLINK_CONSUMER_KEY && env.BRICKLINK_TOKEN_VALUE), now: Date.now() }, 200, cors.headers);

  if (path === "/subscribe" && req.method === "POST") {
    const s = body.subscription;
    if (!s || !s.endpoint || !s.keys || !s.keys.p256dh || !s.keys.auth || !/^https:\/\//.test(s.endpoint)) return json({ error: "Anmeldung unvollständig" }, 400, cors.headers);
    const subs = (await kget(env, "subs", [])).filter((x) => x.endpoint !== s.endpoint);
    subs.push({ endpoint: s.endpoint, keys: { p256dh: s.keys.p256dh, auth: s.keys.auth }, label: clip(body.label || "", 60), at: Date.now() });
    await kput(env, "subs", subs.slice(-MAX_SUBS));
    return json({ ok: true, count: Math.min(subs.length, MAX_SUBS) }, 200, cors.headers);
  }
  if (path === "/unsubscribe" && req.method === "POST") {
    const subs = (await kget(env, "subs", [])).filter((x) => x.endpoint !== body.endpoint);
    await kput(env, "subs", subs);
    return json({ ok: true, count: subs.length }, 200, cors.headers);
  }
  if (path === "/settings") {
    if (req.method === "POST") { const s = cleanSettings(body); await kput(env, "settings", s); return json({ ok: true, settings: s }, 200, cors.headers); }
    return json({ settings: cleanSettings(await kget(env, "settings", null)) }, 200, cors.headers);
  }
  if (path === "/test" && req.method === "POST") {
    const subs = await kget(env, "subs", []);
    if (!subs.length) return json({ ok: false, error: "Noch kein Handy angemeldet" }, 200, cors.headers);
    /* Beispiele kommen einzeln (das Dashboard fragt Nummer fuer Nummer an), damit jede Anfrage unter dem kleinen Rechenzeit-Limit des Gratis-Tarifs bleibt */
    const asSample = body.kind === "sample", idx = asSample ? Math.floor(+body.index) : -1;
    if (asSample && !(idx >= 0 && idx < SAMPLES.length)) return json({ ok: false, error: "Unbekannte Beispielmeldung", count: SAMPLES.length }, 200, cors.headers);
    const n = asSample ? SAMPLES[idx] : { title: "Testmeldung", body: "So sehen deine Meldungen aus. Alles klar!", url: "./", tag: "test" };
    const vapid = await getVapid(env), jwt = {}, now = Date.now();
    const payload = enc.encode(JSON.stringify({ title: n.title, body: n.body, url: n.url, tag: n.tag, ts: now, type: "test" }));
    const rs = await Promise.all(subs.map((s) => sendPush(vapid, s, payload, { cache: jwt, now, urgency: "high" })));
    const gone = rs.map((r, i) => (r.gone ? subs[i].endpoint : null)).filter(Boolean);
    if (gone.length) await kput(env, "subs", subs.filter((s) => gone.indexOf(s.endpoint) < 0));
    return json({ ok: rs.some((r) => r.ok), sent: rs.filter((r) => r.ok).length, failed: rs.filter((r) => !r.ok).length, status: rs.map((r) => r.status), title: n.title, index: idx, count: SAMPLES.length }, 200, cors.headers);
  }
  if (path === "/run" && req.method === "POST") {
    const only = ["summary", "habits", "training", "rhythm"].indexOf(body.only) >= 0 ? body.only : "";
    return json(await run(env, { only }), 200, cors.headers);
  }
  if (path === "/status") {
    const st = await kget(env, "state", {}), subs = await kget(env, "subs", []), settings = cleanSettings(await kget(env, "settings", null)), now = Date.now();
    return json({
      now, lastRun: st.lastRun || 0, runs: st.runs || 0, subs: subs.length, quiet: inQuiet(settings.quiet, berlin(now).min),
      bricklink: st.bl || null, data: st.data || null, queue: (st.queue || []).length,
      sent24h: (st.sent || []).filter((x) => now - x.t < DAY).length, last: (st.sent || []).slice(-5).reverse().map((x) => ({ t: x.t, type: x.type, title: x.title, ok: x.ok, n: x.n }))
    }, 200, cors.headers);
  }
  return json({ error: "Unbekannte Adresse" }, 404, cors.headers);
}

export default {
  async fetch(req, env) {
    try { return await handle(req, env); } catch (e) { return new Response(JSON.stringify({ error: String((e && e.message) || e).slice(0, 200) }), { status: 500, headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" } }); }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(run(env).catch(() => {}));
  }
};

/* Nur fuer Pruefungen ausserhalb von Cloudflare (die Pruefseite setzt __PUSH_TEST_MODE__ vor dem Laden) */
if (typeof globalThis !== "undefined" && globalThis.__PUSH_TEST_MODE__) globalThis.__PUSH_TEST__ = { encryptPayload, vapidAuth, oauthHeader, run, handle, berlin, inQuiet, dueNow, weekKeys, cleanSettings, nextTrainingDay, b64u, unb64u, getVapid };
