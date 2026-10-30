/* Privater Daten-Speicher: Kennzahlen, Notizen, Ziele und alles andere aus data.js liegen NICHT mehr oeffentlich in diesem Repo, sondern in einem
   privaten zweiten GitHub-Repo (Standard "<Besitzer>/dashboard-privat", gleicher Token wie sonst). Diese Datei holt data.js von dort, BEVOR das
   Dashboard startet, und stellt window.DASHBOARD_DATA bereit; script.js wird erst danach geladen (siehe Ende von index.html).
   Ohne Token oder ohne Zugriff erscheint statt des Dashboards ein Hinweis mit Eingabefeld fuer den Token.
   Gespeichert wird hier nichts ausser Repo-Name und Token im Browser (localStorage "dashboard-private-repo", "dashboard-gh-token"). */
(function () {
  var K_TOKEN = "dashboard-gh-token", K_OWNER = "dashboard-gh-owner", K_REPO = "dashboard-private-repo";
  var P = (window.PrivateData = { owner: "", repo: "", ok: false, error: "", ready: null });
  var ls = function (k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } };
  var lsSet = function (k, v) { try { localStorage.setItem(k, v); } catch (e) { /* egal */ } };
  var host = /^([a-z0-9-]+)\.github\.io$/i.exec(location.hostname);
  P.owner = ls(K_OWNER) || (host ? host[1] : "") || "kilianmnlg-hub";
  P.repo = ls(K_REPO) || "dashboard-privat";
  var token = ls(K_TOKEN);

  function setCloud(state, text) {
    try {
      document.body.dataset.cloud = state;
      var t = document.getElementById("cloudLoadTxt");
      if (t && text) t.textContent = text;
    } catch (e) { /* egal */ }
  }

  /* Hinweis mit Eingabefeld, wenn der private Speicher nicht erreichbar ist */
  function showProblem(title, msg, askToken) {
    setCloud("failed", "DATEN NICHT GELADEN");
    try { document.body.classList.add("priv-fail"); } catch (e) { /* egal */ }
    var box = document.createElement("div");
    box.className = "priv-boot";
    box.setAttribute("role", "alert");
    var h = document.createElement("b"); h.textContent = title;
    var p = document.createElement("p"); p.textContent = msg;
    box.appendChild(h); box.appendChild(p);
    if (askToken) {
      var inp = document.createElement("input");
      inp.type = "password"; inp.autocomplete = "off"; inp.placeholder = "GitHub-Token einfügen"; inp.setAttribute("aria-label", "GitHub-Token");
      var save = document.createElement("button");
      save.type = "button"; save.textContent = "SPEICHERN UND NEU LADEN";
      save.addEventListener("click", function () { var v = (inp.value || "").trim(); if (!v) return; lsSet(K_TOKEN, v); location.reload(); });
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") save.click(); });
      box.appendChild(inp); box.appendChild(save);
    }
    var again = document.createElement("button");
    again.type = "button"; again.className = "priv-again"; again.textContent = "NOCHMAL VERSUCHEN";
    again.addEventListener("click", function () { location.reload(); });
    box.appendChild(again);
    var anchor = document.getElementById("cloudLoad");
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling); else document.body.appendChild(box);
  }

  function where() { return P.owner + "/" + P.repo; }

  async function load() {
    setCloud("loading", "LADE DEINE DATEN …");
    if (!token) {
      P.error = "token";
      showProblem("Token fehlt", "Für die privaten Daten (" + where() + ") braucht dieses Gerät einmal deinen GitHub-Token (derselbe wie für den Sync-Knopf, mit Zugriff auf dieses Projekt).", true);
      return;
    }
    var res;
    try {
      res = await fetch("https://api.github.com/repos/" + encodeURIComponent(P.owner) + "/" + encodeURIComponent(P.repo) + "/contents/data.js", {
        headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github.raw+json" },
        cache: "no-store"
      });
    } catch (e) {
      P.error = "net";
      showProblem("Keine Verbindung", "GitHub ist gerade nicht erreichbar. Prüfe das Netz und versuche es nochmal.", false);
      return;
    }
    if (res.status === 401) { P.error = "token"; showProblem("Token ungültig", "GitHub lehnt den gespeicherten Token ab (abgelaufen oder zurückgezogen). Bitte einen neuen eintragen.", true); return; }
    if (res.status === 403) { P.error = "denied"; showProblem("Zugriff verweigert", "Der Token darf das Projekt " + where() + " nicht lesen, oder GitHub bremst gerade. Prüfe die Rechte (Contents: Read and write) und versuche es nochmal.", true); return; }
    if (res.status === 404) { P.error = "missing"; showProblem("Privates Projekt nicht gefunden", where() + " (Datei data.js) gibt es nicht oder dein Token hat keinen Zugriff darauf. Bitte im Token das Projekt freigeben.", true); return; }
    if (!res.ok) { P.error = "http"; showProblem("GitHub antwortet mit Fehler " + res.status, "Bitte gleich nochmal versuchen.", false); return; }
    var text = await res.text();
    try {
      var s = document.createElement("script");
      s.textContent = text;
      document.head.appendChild(s);
      document.head.removeChild(s);
    } catch (e) { /* unten geprueft */ }
    var D = window.DASHBOARD_DATA;
    if (!D || typeof D !== "object") { P.error = "data"; showProblem("data.js nicht lesbar", "Die Datei im privaten Projekt ist leer oder kaputt.", false); return; }
    /* damit script.js weiss, wo die Daten-Dateien liegen: die Besitzer-Angaben des Daten-Projekts */
    D.github = Object.assign({ owner: P.owner }, D.github || {}, { dataOwner: P.owner, dataRepo: P.repo });
    P.ok = true;
    document.dispatchEvent(new CustomEvent("private-ready"));
  }

  P.ready = load().catch(function (e) {
    P.error = "boot";
    showProblem("Start fehlgeschlagen", String((e && e.message) || e), false);
  });
})();
