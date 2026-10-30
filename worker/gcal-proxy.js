const ALLOWED_ORIGINS = new Set([
  "https://kilianmnlg-hub.github.io",
  "http://localhost:8934",
]);

function corsHeaders(origin) {
  const headers = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

async function tokenRequest(env, params) {
  const body = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    client_secret: env.GOOGLE_CLIENT_SECRET,
    ...params,
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = await res.json();
  return { ok: res.ok, data };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: "origin_not_allowed" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    const url = new URL(request.url);

    if (request.method === "POST" && url.pathname === "/exchange") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
      if (!payload.code) {
        return new Response(JSON.stringify({ error: "missing_code" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
      const { ok, data } = await tokenRequest(env, {
        code: payload.code,
        grant_type: "authorization_code",
        redirect_uri: "postmessage",
      });
      return new Response(JSON.stringify(data), {
        status: ok ? 200 : 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    if (request.method === "POST" && url.pathname === "/refresh") {
      let payload;
      try {
        payload = await request.json();
      } catch {
        payload = {};
      }
      if (!payload.refresh_token) {
        return new Response(JSON.stringify({ error: "missing_refresh_token" }), {
          status: 400,
          headers: { "Content-Type": "application/json", ...cors },
        });
      }
      const { ok, data } = await tokenRequest(env, {
        refresh_token: payload.refresh_token,
        grant_type: "refresh_token",
      });
      return new Response(JSON.stringify(data), {
        status: ok ? 200 : 400,
        headers: { "Content-Type": "application/json", ...cors },
      });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
