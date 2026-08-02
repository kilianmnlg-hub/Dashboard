// Minimaler OAuth 1.0a Request-Signer (HMAC-SHA1) für die Bricklink API.
// Kein externes Paket nötig — nur Node's eingebautes crypto-Modul.

import crypto from "crypto";

function percentEncode(str) {
  return encodeURIComponent(str).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

export function buildAuthHeader({ method, url, queryParams = {}, consumerKey, consumerSecret, tokenValue, tokenSecret }) {
  const oauthParams = {
    oauth_consumer_key: consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: tokenValue,
    oauth_version: "1.0"
  };

  const allParams = { ...queryParams, ...oauthParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(String(allParams[key]))}`)
    .join("&");

  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join("&");
  const signingKey = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  const signature = crypto.createHmac("sha1", signingKey).update(baseString).digest("base64");

  const headerParams = { ...oauthParams, oauth_signature: signature };
  const header =
    "OAuth " +
    Object.keys(headerParams)
      .sort()
      .map((key) => `${percentEncode(key)}="${percentEncode(headerParams[key])}"`)
      .join(", ");

  return header;
}
