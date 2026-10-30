/* Cloudflare Worker fuer die KI-Funktionen des Bereichs "Outfits" (Dashboard).
   Aufgaben: (1) /analyze: ein Foto des freigestellten Teils beschreiben lassen (Kategorie, Farben, Marke, Material, Schicht, Waerme, Formalitaet, Anlaesse).
   (2) /inspo ("Nach Foto nachbauen"): ein Foto eines ganzen Outfits in einzelne Teile zerlegen lassen (Kategorie, Beschreibung, Farben, Schicht). Die Seite schickt nur
   ein kleines Bild an diesen Worker, der Worker fragt die KI und gibt die Beschreibung als JSON zurueck.

   Zwei Wege, der Worker nimmt automatisch den, der eingerichtet ist:
   A) KOSTENLOS: Cloudflare-KI (Workers AI) im eigenen Konto. Kein API-Schluessel, kein Zusatzkonto. Gratis-Kontingent 10.000 "Neurons" pro Tag (reicht fuer mehrere hundert Fotos).
   B) Claude von Anthropic (bessere Marken- und Materialerkennung, kostet grob unter 1 Cent pro Foto): Secret ANTHROPIC_API_KEY setzen, dann wird Claude genommen.

   Einrichtung (einmalig, im Browser, kein Programm noetig):
   1. cloudflare.com -> Workers & Pages -> Create -> Worker, Name z. B. "outfit-ai" -> Deploy, dann "Edit code" und diesen ganzen Code einfuegen -> Deploy.
   2. Settings -> Bindings -> Add -> "Workers AI", Variable name = AI (nur fuer Weg A).
   3. Settings -> Variables and Secrets -> Add (als Secret):
        APP_SECRET         ein langes selbst ausgedachtes Wort; dasselbe traegst du im Dashboard unter Outfits -> Einstellungen als "Geheimes Wort" ein
        ANTHROPIC_API_KEY  nur fuer Weg B (Schluessel von console.anthropic.com, API-Guthaben getrennt vom Claude-Abo)
      Optional (Text): ALLOWED_ORIGINS = https://DEIN-NAME.github.io (mehrere mit Komma), CF_MODEL = anderes Modell der Cloudflare-KI (Standard Mistral Small 3.1, Ersatz Llama 4 Scout), MODEL_FAST = Claude-Modell
   4. Die Adresse des Workers (https://outfit-ai.DEIN-NAME.workers.dev) im Dashboard eintragen und "Testen" tippen. */

const DEFAULT_ORIGINS = ["https://kilianmnlg-hub.github.io", "http://localhost:8951", "http://localhost:8080"];
const MAX_BODY = 1500000; /* Bytes */
const CF_MODEL_DEFAULT = "@cf/mistralai/mistral-small-3.1-24b-instruct"; /* mit einem Pullover-Foto getestet: Kategorie, Material, Schicht, Waerme stimmten */
const CF_FALLBACK = "@cf/meta/llama-4-scout-17b-16e-instruct";
const CLAUDE_MODEL_DEFAULT = "claude-haiku-5-5";

const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status: status || 200, headers: Object.assign({ "Content-Type": "application/json; charset=utf-8" }, cors || {}) });
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* Vergleich in konstanter Zeit, damit das geheime Wort nicht erraten werden kann */
function same(a, b) {
  a = String(a || ""); b = String(b || "");
  let d = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}

function backendOf(env) { return env.ANTHROPIC_API_KEY ? "claude" : env.AI ? "cf" : ""; }

/* ---- gemeinsame Teile: Aufgabe und Aufraeumen der Antwort ---- */
const SYSTEM = "Du hilfst bei einer digitalen Garderobe. Du siehst das Foto genau eines freigestellten Kleidungsstuecks (heller Hintergrund). Beschreibe es sachlich und nur, was du sehen kannst. Erfinde keine Marke und kein Material.";

function inputs(body) {
  const cats = Array.isArray(body.cats) ? body.cats.slice(0, 60) : [];
  const occ = Array.isArray(body.occ) ? body.occ.slice(0, 24).map(String) : [];
  if (!body.image || typeof body.image !== "string") throw new Error("Bild fehlt");
  return { cats, occ, catIds: cats.map((c) => String(c.id)), media: body.media === "image/png" ? "image/png" : "image/jpeg" };
}

function tidy(out, catIds, occ) {
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c).toLowerCase() : null);
  out = out || {};
  return {
    cat: catIds.indexOf(out.cat) >= 0 ? out.cat : catIds.indexOf("other") >= 0 ? "other" : catIds[0] || "other",
    name: String(out.name || "").slice(0, 80),
    colors: (Array.isArray(out.colors) ? out.colors : []).map(hex).filter(Boolean).slice(0, 3),
    brand: String(out.brand || "").slice(0, 40),
    material: String(out.material || "").slice(0, 60),
    layer: ["base", "mid", "outer"].indexOf(out.layer) >= 0 ? out.layer : "",
    warmth: clamp(Math.round(+out.warmth || 3), 1, 5),
    formal: clamp(Math.round(+out.formal || 3), 1, 5),
    occ: (Array.isArray(out.occ) ? out.occ : []).map(String).filter((o) => occ.indexOf(o) >= 0).slice(0, 8),
    conf: clamp(+out.conf || 0.6, 0, 1)
  };
}

/* ---- Weg B: Claude (strukturierte Antwort ueber ein Werkzeug) ---- */
async function claude(env, model, system, tool, content, maxTokens) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: maxTokens || 700, system, tools: [tool], tool_choice: { type: "tool", name: tool.name }, messages: [{ role: "user", content }] })
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Anthropic " + res.status + ": " + t.slice(0, 200)); }
  const j = await res.json();
  const block = (j.content || []).find((b) => b.type === "tool_use");
  if (!block) throw new Error("Keine strukturierte Antwort");
  return block.input || {};
}

async function analyzeClaude(env, body) {
  const { cats, occ, catIds, media } = inputs(body);
  const tool = {
    name: "describe_garment",
    description: "Beschreibt genau ein Kleidungsstueck oder Accessoire fuer eine digitale Garderobe.",
    input_schema: {
      type: "object",
      properties: {
        cat: { type: "string", enum: catIds.length ? catIds : ["other"], description: "Am besten passende Kategorie" },
        name: { type: "string", description: "Kurze deutsche Bezeichnung, z. B. 'Navy-Hoodie mit Logo' (max. 40 Zeichen)" },
        colors: { type: "array", items: { type: "string", description: "Hex-Farbe wie #1c3f7a" }, description: "1 bis 3 Hauptfarben des Teils, wichtigste zuerst" },
        brand: { type: "string", description: "Marke NUR wenn Logo oder Schriftzug klar lesbar ist, sonst leerer Text" },
        material: { type: "string", description: "Materialvermutung nur wenn erkennbar (z. B. 'Denim', 'Strick', 'Leder'), sonst leerer Text" },
        layer: { type: "string", enum: ["base", "mid", "outer"], description: "Schicht beim Layering: base = direkt am Koerper (T-Shirt, Hemd, Top), mid = waermende Schicht darueber (Pullover, Hoodie, Strickjacke, Weste), outer = aeusserste Schicht (Jacke, Mantel, Parka)" },
        warmth: { type: "integer", minimum: 1, maximum: 5, description: "1 sehr luftig (Sommer), 3 Uebergang, 5 sehr warm (Winter)" },
        formal: { type: "integer", minimum: 1, maximum: 5, description: "1 sehr leger/Sport, 3 Smart Casual, 5 sehr elegant" },
        occ: { type: "array", items: { type: "string" }, description: "Passende Anlaesse, NUR aus der gegebenen Liste" },
        conf: { type: "number", minimum: 0, maximum: 1, description: "Wie sicher du bei Kategorie und Farben bist" }
      },
      required: ["cat", "colors", "warmth", "formal", "conf"]
    }
  };
  const text = "Kategorien (id: Name): " + cats.map((c) => c.id + ": " + c.label).join("; ") + "\nAnlaesse: " + occ.join(", ") + "\nBeschreibe das Teil.";
  const out = await claude(env, env.MODEL_FAST || CLAUDE_MODEL_DEFAULT, SYSTEM, tool, [
    { type: "image", source: { type: "base64", media_type: media, data: body.image } },
    { type: "text", text }
  ]);
  return tidy(out, catIds, occ);
}

/* ---- Weg A: Cloudflare-KI (Workers AI), Antwort als JSON im Text ---- */
function jsonFrom(res) {
  let v = res;
  if (v && typeof v === "object") {
    if (typeof v.response === "string") v = v.response;
    else if (v.response && typeof v.response === "object") return v.response;
    else if (v.choices && v.choices[0] && v.choices[0].message) v = v.choices[0].message.content;
    else if (v.result && typeof v.result.response === "string") v = v.result.response;
    else if (v.description) v = v.description;
  }
  if (Array.isArray(v)) v = v.map((p) => (p && p.text) || "").join("");
  v = String(v || "").replace(/```(?:json)?/gi, "");
  const a = v.indexOf("{"), b = v.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("Antwort der KI nicht lesbar: " + v.slice(0, 120));
  try { return JSON.parse(v.slice(a, b + 1)); } catch (e) { throw new Error("Antwort der KI kein gueltiges JSON: " + v.slice(a, a + 120)); }
}

async function analyzeCF(env, body) {
  const { cats, occ, catIds, media } = inputs(body);
  const prompt =
    "Kategorien (id: Name): " + cats.map((c) => c.id + ": " + c.label).join("; ") + "\nAnlaesse: " + occ.join(", ") + "\n\n" +
    "Beschreibe das Kleidungsstueck auf dem Foto. Antworte NUR mit einem JSON-Objekt, ohne weiteren Text, mit genau diesen Feldern:\n" +
    '{"cat": "<eine id aus der Kategorienliste>", "name": "<kurze deutsche Bezeichnung, max. 40 Zeichen>", "colors": ["#rrggbb", ...] (1 bis 3 Hauptfarben als Hex, wichtigste zuerst), ' +
    '"brand": "<Marke nur wenn Logo oder Schriftzug klar lesbar, sonst leer>", "material": "<Material nur wenn erkennbar, z. B. Denim, Strick, Leder, sonst leer>", ' +
    '"layer": "base" | "mid" | "outer" (base = direkt am Koerper wie T-Shirt oder Hemd, mid = waermende Schicht darueber wie Pullover, Hoodie, Strickjacke, outer = aeusserste Schicht wie Jacke oder Mantel), ' +
    '"warmth": 1 bis 5 (1 sehr luftig, 3 Uebergang, 5 sehr warm), "formal": 1 bis 5 (1 sehr leger, 3 Smart Casual, 5 sehr elegant), "occ": [Anlaesse NUR aus der Liste], "conf": 0 bis 1 (wie sicher du bist)}';
  const messages = [
    { role: "system", content: SYSTEM },
    { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: "data:" + media + ";base64," + body.image } }] }
  ];
  /* erst das gewaehlte Modell, bei einem Fehler das zweite */
  const models = [env.CF_MODEL || CF_MODEL_DEFAULT, CF_FALLBACK].filter((m, i, a) => a.indexOf(m) === i);
  let last = null;
  for (const model of models) {
    try {
      const res = await env.AI.run(model, { messages, max_tokens: 500, temperature: 0.1 });
      return tidy(jsonFrom(res), catIds, occ);
    } catch (e) { last = e; console.error("outfit-ai", model, String((e && e.message) || e)); }
  }
  throw last || new Error("Keine Antwort der KI");
}

/* ---- /inspo: ein ganzes Outfit in einzelne Teile zerlegen ---- */
const INSPO_SYSTEM = "Du hilfst bei einer digitalen Garderobe. Du siehst das Foto eines kompletten Outfits (getragen oder flach ausgelegt). Liste jedes sichtbare Kleidungsstueck und Accessoire einzeln auf und beschreibe es sachlich. Erfinde nichts, was nicht zu sehen ist.";

function tidyInspo(out, catIds) {
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(String(c)) ? String(c).toLowerCase() : null);
  const list = Array.isArray(out && out.pieces) ? out.pieces : Array.isArray(out) ? out : [];
  const other = catIds.indexOf("other") >= 0 ? "other" : catIds[0] || "other";
  return list.slice(0, 8).map((p) => {
    p = p || {};
    return {
      cat: catIds.indexOf(p.cat) >= 0 ? p.cat : other,
      desc: String(p.desc || "").slice(0, 80),
      colors: (Array.isArray(p.colors) ? p.colors : []).map(hex).filter(Boolean).slice(0, 2),
      layer: ["base", "mid", "outer"].indexOf(p.layer) >= 0 ? p.layer : "",
      warmth: clamp(Math.round(+p.warmth || 3), 1, 5),
      formal: clamp(Math.round(+p.formal || 3), 1, 5)
    };
  }).filter((p) => p.desc || p.cat !== other);
}

async function inspoClaude(env, body) {
  const { cats, catIds, media } = inputs(body);
  const tool = {
    name: "list_outfit_pieces",
    description: "Listet alle sichtbaren Kleidungsstuecke und Accessoires eines Outfit-Fotos einzeln auf (von oben nach unten).",
    input_schema: {
      type: "object",
      properties: {
        pieces: {
          type: "array", maxItems: 8,
          items: {
            type: "object",
            properties: {
              cat: { type: "string", enum: catIds.length ? catIds : ["other"], description: "Am besten passende Kategorie" },
              desc: { type: "string", description: "Kurze deutsche Beschreibung mit Farbe und auffaelligem Muster, z. B. 'Kariertes Hemd, braun-grau' (max. 60 Zeichen)" },
              colors: { type: "array", items: { type: "string", description: "Hex-Farbe wie #1c3f7a" }, description: "1 bis 2 Hauptfarben dieses Teils, wichtigste zuerst" },
              layer: { type: "string", enum: ["base", "mid", "outer", ""], description: "Nur fuer Oberteile und Jacken: base = direkt am Koerper, mid = waermende Schicht darueber, outer = aeusserste Schicht; sonst leerer Text" },
              warmth: { type: "integer", minimum: 1, maximum: 5 },
              formal: { type: "integer", minimum: 1, maximum: 5 }
            },
            required: ["cat", "desc", "colors"]
          }
        }
      },
      required: ["pieces"]
    }
  };
  const text = "Kategorien (id: Name): " + cats.map((c) => c.id + ": " + c.label).join("; ") + "\nListe jedes sichtbare Teil dieses Outfits einzeln auf.";
  const out = await claude(env, env.MODEL_FAST || CLAUDE_MODEL_DEFAULT, INSPO_SYSTEM, tool, [
    { type: "image", source: { type: "base64", media_type: media, data: body.image } },
    { type: "text", text }
  ], 1200);
  return tidyInspo(out, catIds);
}

async function inspoCF(env, body) {
  const { cats, catIds, media } = inputs(body);
  const prompt =
    "Kategorien (id: Name): " + cats.map((c) => c.id + ": " + c.label).join("; ") + "\n\n" +
    "Du siehst ein Foto eines Outfits. Liste JEDES sichtbare Kleidungsstueck und Accessoire einzeln auf (hoechstens 8, von oben nach unten; nur was wirklich zu sehen ist, keine Haut, keine Haare, keine Gegenstaende im Hintergrund). " +
    "Antworte NUR mit einem JSON-Objekt, ohne weiteren Text, in dieser Form:\n" +
    '{"pieces": [{"cat": "<eine id aus der Kategorienliste>", "desc": "<kurze deutsche Beschreibung mit Farbe und auffaelligem Muster, max. 60 Zeichen>", "colors": ["#rrggbb", ...] (1 bis 2 Hauptfarben genau dieses Teils als Hex), ' +
    '"layer": "base" | "mid" | "outer" (nur bei Oberteilen und Jacken: base = direkt am Koerper wie T-Shirt oder Hemd, mid = waermende Schicht darueber wie Pullover oder Hoodie, outer = aeusserste Schicht wie Jacke oder Mantel; sonst leerer Text), ' +
    '"warmth": 1 bis 5, "formal": 1 bis 5}]}';
  const messages = [
    { role: "system", content: INSPO_SYSTEM },
    { role: "user", content: [{ type: "text", text: prompt }, { type: "image_url", image_url: { url: "data:" + media + ";base64," + body.image } }] }
  ];
  const models = [env.CF_MODEL || CF_MODEL_DEFAULT, CF_FALLBACK].filter((m, i, a) => a.indexOf(m) === i);
  let last = null;
  for (const model of models) {
    try {
      const res = await env.AI.run(model, { messages, max_tokens: 900, temperature: 0.1 });
      return tidyInspo(jsonFrom(res), catIds);
    } catch (e) { last = e; console.error("outfit-ai inspo", model, String((e && e.message) || e)); }
  }
  throw last || new Error("Keine Antwort der KI");
}

export default {
  async fetch(request, env, ctx) {
    const origins = (env.ALLOWED_ORIGINS ? String(env.ALLOWED_ORIGINS).split(",").map((s) => s.trim()) : []).concat(DEFAULT_ORIGINS);
    const origin = request.headers.get("Origin") || "";
    const cors = { "Access-Control-Allow-Origin": origins.indexOf(origin) >= 0 ? origin : origins[0], "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Allow-Methods": "POST, OPTIONS", Vary: "Origin" };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ ok: false, error: "POST erwartet" }, 405, cors);
    const backend = backendOf(env);
    if (!env.APP_SECRET || !backend) return json({ ok: false, error: "Worker nicht fertig eingerichtet (APP_SECRET und entweder Workers-AI-Bindung AI oder ANTHROPIC_API_KEY fehlen)" }, 500, cors);
    const auth = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!same(auth, env.APP_SECRET)) return json({ ok: false, error: "Geheimes Wort stimmt nicht" }, 401, cors);
    const path = new URL(request.url).pathname.replace(/\/+$/, "");
    try {
      if (path === "/ping") return json({ ok: true, backend, inspo: true, model: backend === "claude" ? env.MODEL_FAST || CLAUDE_MODEL_DEFAULT : env.CF_MODEL || CF_MODEL_DEFAULT }, 200, cors);
      const raw = await request.text();
      if (raw.length > MAX_BODY) return json({ ok: false, error: "Bild zu gross" }, 413, cors);
      const body = JSON.parse(raw || "{}");
      if (path === "/analyze") return json({ ok: true, backend, item: await (backend === "claude" ? analyzeClaude : analyzeCF)(env, body) }, 200, cors);
      if (path === "/inspo") return json({ ok: true, backend, pieces: await (backend === "claude" ? inspoClaude : inspoCF)(env, body) }, 200, cors);
      return json({ ok: false, error: "Unbekannter Pfad" }, 404, cors);
    } catch (e) {
      console.error("outfit-ai", backend, String((e && e.message) || e));
      return json({ ok: false, error: String((e && e.message) || e).slice(0, 300) }, 502, cors);
    }
  }
};
