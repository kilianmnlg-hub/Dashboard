(function () {
  const data = window.DASHBOARD_DATA;
  const fmtDE = new Intl.NumberFormat("de-DE");
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });
  // Früh deklariert (nicht erst beim Tages-To-Do weiter unten), weil auch die
  // Studium-Countdown-Karte in der Goals-Sektion sie schon braucht.
  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

  // Sicherheitsnetz fuer alle Cloud-Sync-Felder (Habit-Tracker, Video-Ideen, Studium-Termin,
  // Tages-To-Do, Aufgaben): ein Cloud-Stand darf einen nicht-leeren lokalen Stand NIE durch
  // einen leeren ersetzen, selbst wenn er laut Zeitstempel neuer ist. Sonst kann ein Geraet,
  // das ein Feld einfach nie befuellt hat (z.B. noch nie eine Aufgabe eingetragen), beim
  // blossen Sync-Klick echte Daten auf einem anderen Geraet loeschen — genau das ist einmal
  // passiert (leere Todos/Aufgaben von einem ungenutzten Geraet haben echte Eintraege auf
  // einem anderen Geraet ueberschrieben).
  const remoteWins = (remoteUpdatedAt, localUpdatedAt, remoteHasContent, localHasContent) => {
    if (remoteUpdatedAt <= localUpdatedAt) return false;
    if (localHasContent && !remoteHasContent) return false;
    return true;
  };

  // ---------- Theme ----------
  const root = document.documentElement;
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("dashboard-theme");
  if (savedTheme) root.setAttribute("data-theme", savedTheme);

  themeToggle.addEventListener("click", () => {
    const prefersLight = matchMedia("(prefers-color-scheme: light)").matches;
    const current = root.getAttribute("data-theme") || (prefersLight ? "light" : "dark");
    const next = current === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    localStorage.setItem("dashboard-theme", next);
  });

  // ---------- Header ----------
  const now = new Date();
  document.getElementById("todayLabel").textContent = now.toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long"
  });
  const syncedLabel = data.meta.lastSyncedAt
    ? new Date(data.meta.lastSyncedAt).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : fmtDate(data.meta.lastUpdated);
  document.getElementById("lastUpdated").textContent = syncedLabel;
  document.getElementById("footerUpdated").textContent = syncedLabel;

  const hour = now.getHours();
  const greetingWord = hour < 11 ? "Guten Morgen" : hour < 18 ? "Schönen Tag" : "Guten Abend";
  document.getElementById("greeting").textContent = `${greetingWord}, ${data.meta.owner || ""}`.trim();

  // ---------- Versand-Alarm ----------
  const shipAlert = document.getElementById("shipAlert");
  const pending = data.bricklinkOrders?.pendingShipments || [];
  const dismissKey = `dashboard-ship-alert-dismissed-${data.bricklinkOrders?.checkedAt || ""}`;

  if (pending.length > 0 && !sessionStorage.getItem(dismissKey)) {
    const text =
      pending.length === 1
        ? `1 Bricklink-Bestellung wartet auf Versand — #${pending[0].orderId} (${pending[0].buyer}, bestellt am ${fmtDate(pending[0].orderedDate.slice(0, 10))})`
        : `${pending.length} Bricklink-Bestellungen warten auf Versand — älteste: #${pending[0].orderId} (${pending[0].buyer}, bestellt am ${fmtDate(pending[0].orderedDate.slice(0, 10))})`;
    document.getElementById("shipAlertText").textContent = text;
    shipAlert.hidden = false;
  }

  document.getElementById("shipAlertDismiss").addEventListener("click", () => {
    sessionStorage.setItem(dismissKey, "1");
    shipAlert.hidden = true;
  });

  // ---------- Sync-Button ----------
  const syncButton = document.getElementById("syncButton");
  const syncLabel = document.getElementById("syncButtonLabel");

  function getGithubConfig() {
    let owner = data.github?.owner || localStorage.getItem("dashboard-gh-owner") || "";
    let repo = data.github?.repo || localStorage.getItem("dashboard-gh-repo") || "";
    if (!owner || !repo) {
      const input = prompt('GitHub-Repo für den Sync (Format "benutzername/repo-name"):', `${owner}/${repo}`.replace(/^\/$/, ""));
      if (!input || !input.includes("/")) return null;
      [owner, repo] = input.split("/").map((s) => s.trim());
      localStorage.setItem("dashboard-gh-owner", owner);
      localStorage.setItem("dashboard-gh-repo", repo);
    }
    let token = localStorage.getItem("dashboard-gh-token");
    if (!token) {
      token = prompt(
        "GitHub Personal Access Token (fine-grained, mit 'Actions: Read and write' + 'Contents: Read and write' für dieses Repo, für Sync-Button und Habit-Tracker-Cloud-Sync). " +
          "Wird nur in deinem Browser gespeichert, nie im Code:"
      );
      if (!token) return null;
      localStorage.setItem("dashboard-gh-token", token.trim());
      token = token.trim();
    }
    return { owner, repo, token, workflowFile: data.github?.workflowFile || "sync-all.yml" };
  }

  syncButton.addEventListener("click", async () => {
    const config = getGithubConfig();
    if (!config) return;

    syncButton.disabled = true;
    syncButton.classList.add("spinning");
    syncLabel.textContent = "Synchronisiere…";

    // Habit-Tracker- und Video-Ideen/Studium/To-Do/Aufgaben-Stand laufen am selben Klick
    // mit hoch (Contents API, kein Workflow nötig — sofort fertig, nicht Teil des
    // "läuft 15-30s"-Hinweises unten).
    pushHabitsToCloud(config);
    pushSyncDataToCloud(config);

    try {
      const res = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/actions/workflows/${config.workflowFile}/dispatches`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ ref: "main" })
        }
      );

      if (res.status === 204) {
        syncLabel.textContent = "Gestartet ✓";
        setTimeout(() => {
          syncLabel.textContent = "Sync";
          syncButton.disabled = false;
          syncButton.classList.remove("spinning");
        }, 4000);
        alert("Sync gestartet. Läuft ca. 15–30 Sekunden — lade die Seite danach neu.");
      } else if (res.status === 401 || res.status === 403) {
        localStorage.removeItem("dashboard-gh-token");
        throw new Error("Token ungültig/abgelaufen (entfernt) — bitte beim nächsten Klick neu eingeben.");
      } else if (res.status === 404) {
        throw new Error("Repo oder Workflow nicht gefunden. Bitte Repo-Angabe prüfen (localStorage 'dashboard-gh-owner/-repo' löschen zum Neueingeben).");
      } else {
        throw new Error(`GitHub API antwortete mit Status ${res.status}`);
      }
    } catch (err) {
      syncLabel.textContent = "Sync";
      syncButton.disabled = false;
      syncButton.classList.remove("spinning");
      alert(`Sync fehlgeschlagen: ${err.message}`);
    }
  });

  // ---------- Scrollspy nav ----------
  const navLinks = Array.from(document.querySelectorAll("#mainNav a"));
  const sections = navLinks
    .map((a) => document.querySelector(a.getAttribute("href")))
    .filter(Boolean);

  const setActive = (id) => {
    navLinks.forEach((a) => a.classList.toggle("active", a.getAttribute("href") === `#${id}`));
  };

  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id);
        });
      },
      { rootMargin: "-40% 0px -55% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
  }

  // ---------- Brain-Map: Vault-Struktur (aus data.brainMap, per lokalem Sync-Skript aktuell
  // gehalten), Hover/Klick-Interaktion, Notiz-Erfassung über die File System Access API ----------

  function layoutBrainNodes(areas) {
    const core = { id: "core", label: "Brain", x: 50, y: 50, z: 60, r: 15, color: "var(--accent)" };
    const nodes = [core];
    const links = [];
    const n = areas.length;
    areas.forEach((a, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(angle) * 34;
      const y = 50 + Math.sin(angle) * 34 * 0.72;
      const z = (i % 2 === 0 ? 1 : -1) * (10 + ((i * 6) % 24));
      const noteLabel = a.noteCount === 1 ? "1 Notiz" : `${a.noteCount} Notizen`;
      nodes.push({ id: a.id, label: a.folder, x, y, z, r: 8 + Math.min(4, a.noteCount * 0.4), color: a.color || "var(--accent)", stat: noteLabel });
      links.push(["core", a.id]);
    });
    return { nodes, links };
  }

  const brainAreas = data.brainMap?.areas || [];
  const { nodes: brainNodesData, links: brainLinksData } = layoutBrainNodes(brainAreas);
  const brainInteractiveIds = new Set(brainAreas.map((a) => a.id));

  const brainNodesEl = document.getElementById("brainNodes");
  const brainLinksSvg = document.getElementById("brainLinks");
  const brainSceneWrap = document.getElementById("brainSceneWrap");

  brainNodesEl.innerHTML = brainNodesData
    .map(
      (t) => `
    <div class="node ${t.id === "core" ? "core" : ""}" data-topic="${t.id}" style="left:${t.x}%; top:${t.y}%; --z:${t.z}px; width:${t.r * 2}px; height:${t.r * 2}px;">
      <div class="dotcore" style="--nc:${t.color}"></div>
      ${t.label ? `<div class="node-label">${escapeHtml(t.label)}</div>` : ""}
    </div>`
    )
    .join("");

  // Flache, nicht 3D-transformierte Klick-/Hover-Flaechen — bewusst getrennt von .node
  // (siehe CSS-Kommentar): eine 3D-Kipp-Rotation macht Hit-Testing auf den echten Knoten
  // unzuverlaessig, sobald ihre Tiefe (--z) sie hinter ihren eigenen Container dreht.
  const brainHitsEl = document.getElementById("brainHits");
  brainHitsEl.innerHTML = brainNodesData
    .map((t) => {
      const isInteractive = brainInteractiveIds.has(t.id) || t.id === "core";
      const size = Math.max(28, t.r * 2 + 10);
      return `<div class="hit-target" data-topic="${t.id}" ${isInteractive ? "data-interactive" : ""} style="left:${t.x}%; top:${t.y}%; width:${size}px; height:${size}px;"></div>`;
    })
    .join("");

  function drawBrainLinks() {
    const wrap = brainSceneWrap.getBoundingClientRect();
    brainLinksSvg.setAttribute("viewBox", `0 0 ${wrap.width} ${wrap.height}`);
    brainLinksSvg.innerHTML = brainLinksData
      .map(([a, b]) => {
        const ta = brainNodesData.find((t) => t.id === a);
        const tb = brainNodesData.find((t) => t.id === b);
        return `<line data-a="${a}" data-b="${b}" class="hot" x1="${(ta.x / 100) * wrap.width}" y1="${(ta.y / 100) * wrap.height}" x2="${(tb.x / 100) * wrap.width}" y2="${(tb.y / 100) * wrap.height}" />`;
      })
      .join("");
  }
  if (brainNodesData.length > 1) {
    drawBrainLinks();
    window.addEventListener("resize", drawBrainLinks);
  }

  function setBrainHover(id) {
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.toggle("hovered", n.dataset.topic === id));
    brainLinksSvg.querySelectorAll("line").forEach((l) => l.classList.toggle("lit", id !== null && (l.dataset.a === id || l.dataset.b === id)));
  }
  brainHitsEl.querySelectorAll(".hit-target[data-interactive]").forEach((h) => {
    h.addEventListener("mouseenter", () => setBrainHover(h.dataset.topic));
    h.addEventListener("mouseleave", () => setBrainHover(null));
  });

  // Tilt-Parallax: EIN Transform fuer die ganze Szene (nicht pro Knoten) — Knoten und
  // Verbindungslinien laufen dadurch nie auseinander, unabhaengig von der Mausposition.
  const brainTilt = document.getElementById("brainTilt");
  let brainTargetX = 8,
    brainTargetY = -10,
    brainCurX = 8,
    brainCurY = -10;
  brainSceneWrap.addEventListener("mousemove", (e) => {
    const r = brainSceneWrap.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    brainTargetY = -10 + px * 16;
    brainTargetX = 8 - py * 12;
  });
  brainSceneWrap.addEventListener("mouseleave", () => {
    brainTargetX = 8;
    brainTargetY = -10;
  });
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduceMotion) {
    (function animateBrainTilt() {
      brainCurX += (brainTargetX - brainCurX) * 0.08;
      brainCurY += (brainTargetY - brainCurY) * 0.08;
      brainTilt.style.transform = `rotateX(${brainCurX}deg) rotateY(${brainCurY}deg)`;
      requestAnimationFrame(animateBrainTilt);
    })();
  }

  // ---------- Bereichs-Popover ----------
  const brainAreaPop = document.getElementById("brainAreaPop");
  let brainActiveId = null;

  function closeBrainPop() {
    brainActiveId = null;
    brainAreaPop.classList.remove("open");
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.remove("active"));
  }

  function openBrainPop(topic, anchorEl) {
    brainActiveId = topic.id;
    brainNodesEl.querySelectorAll(".node").forEach((n) => n.classList.toggle("active", n.dataset.topic === topic.id));
    brainAreaPop.innerHTML = `
      <p class="ap-title"><span class="ap-dot" style="background:${topic.color}"></span>${escapeHtml(topic.label)}</p>
      <p class="ap-stat">${topic.stat}</p>
      <div class="ap-actions">
        <button type="button" class="ap-btn" id="apClose">Schließen</button>
        <button type="button" class="ap-btn primary" id="apNote" style="--chip-c:${topic.color}">Notiz erfassen</button>
      </div>
    `;
    brainAreaPop.classList.add("open");

    const cardRect = document.querySelector(".brain-card").getBoundingClientRect();
    const anchorRect = anchorEl.getBoundingClientRect();
    const popRect = brainAreaPop.getBoundingClientRect();
    const margin = 14;
    let left = anchorRect.left - cardRect.left + anchorRect.width / 2 - popRect.width / 2;
    left = Math.max(margin, Math.min(left, cardRect.width - popRect.width - margin));
    let top = anchorRect.bottom - cardRect.top + 14;
    if (top + popRect.height > cardRect.height - margin) {
      top = anchorRect.top - cardRect.top - popRect.height - 14;
    }
    top = Math.max(margin, top);
    brainAreaPop.style.left = `${left}px`;
    brainAreaPop.style.top = `${top}px`;

    document.getElementById("apNote").addEventListener("click", () => {
      closeBrainPop();
      openNoteModal(topic.id);
    });
    document.getElementById("apClose").addEventListener("click", closeBrainPop);
  }

  brainHitsEl.querySelectorAll(".hit-target[data-interactive]").forEach((h) => {
    h.addEventListener("click", (e) => {
      e.stopPropagation();
      const topic = brainNodesData.find((t) => t.id === h.dataset.topic);
      if (topic.id === "core") {
        closeBrainPop();
        openNoteModal();
        return;
      }
      if (brainActiveId === topic.id) closeBrainPop();
      else openBrainPop(topic, h);
    });
  });
  brainAreaPop.addEventListener("click", (e) => e.stopPropagation());
  // Klick auf leere Flaeche schliesst nur ein offenes Popover — das Notiz-Modal geht
  // bewusst ausschliesslich ueber den "Brain"-Kern-Knoten auf, kein zusaetzlicher Button.
  brainSceneWrap.addEventListener("click", () => {
    if (brainActiveId) closeBrainPop();
  });

  // ---------- Notiz-Erfassung: File System Access API (nur Chrome/Edge) ----------
  // Kein Cloud-Umweg: der Vault liegt lokal auf diesem Rechner, also reicht einmalige
  // Dateisystem-Berechtigung fuer den Vault-Ordner. Jede Notiz landet in "Notizen.md" im
  // jeweils richtigen Themen-Ordner (z.B. Bricklink/Notizen.md) statt in einer Sammeldatei -
  // "Ideen" ist dabei einfach der Auffang-Ordner fuer alles ohne spezifischere Kategorie.
  // Das Handle wird in IndexedDB gemerkt (localStorage kann keine FileSystemHandles speichern).
  const IDB_NAME = "dashboard-brain";
  const IDB_STORE = "handles";
  const IDB_KEY = "vaultDirHandle";
  const fsAccessSupported = "showDirectoryPicker" in window;
  let vaultDirHandle = null;

  function idbOpen() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbGet(key) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readonly");
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }
  async function idbSet(key, value) {
    const db = await idbOpen();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, "readwrite");
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  async function getStoredVaultHandle() {
    if (vaultDirHandle) return vaultDirHandle;
    const stored = await idbGet(IDB_KEY).catch(() => null);
    if (stored) vaultDirHandle = stored;
    return vaultDirHandle;
  }
  async function connectVault() {
    const handle = await window.showDirectoryPicker({ mode: "readwrite" });
    vaultDirHandle = handle;
    await idbSet(IDB_KEY, handle);
    return handle;
  }
  async function appendNoteToFolder(dirHandle, folderName, text) {
    const folderHandle = await dirHandle.getDirectoryHandle(folderName, { create: true });
    const fileHandle = await folderHandle.getFileHandle("Notizen.md", { create: true });
    let existing = "";
    try {
      existing = await (await fileHandle.getFile()).text();
    } catch (e) {
      /* neue/leere Datei, mit leerem Inhalt starten */
    }
    const stamp = new Date().toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const entry = `## ${stamp}\n${text.trim()}\n\n`;
    const body = existing.trim() ? existing.replace(/\n*$/, "\n\n") : "# Notizen\n\n";
    const writable = await fileHandle.createWritable();
    await writable.write(body + entry);
    await writable.close();
    return `${folderName}/Notizen.md`;
  }

  // ---------- Notiz-Modal ----------
  const noteOverlay = document.getElementById("noteOverlay");
  const noteFormState = document.getElementById("noteFormState");
  const noteSavedState = document.getElementById("noteSavedState");
  const noteTextEl = document.getElementById("noteText");
  const noteChipRow = document.getElementById("noteChipRow");
  const noteGuessLabel = document.getElementById("noteGuessLabel");
  const noteSaveBtn = document.getElementById("noteSaveBtn");
  const noteModalSub = document.getElementById("noteModalSub");

  const noteChips = brainAreas.map((a) => ({ id: a.id, label: a.folder, color: a.color || "var(--accent)" }));
  const DEFAULT_NOTE_CHIP_ID = noteChips.find((c) => c.label.toLowerCase() === "ideen")?.id || noteChips[0]?.id || null;
  let noteSelectedChip = null;

  noteChipRow.innerHTML = noteChips
    .map((c) => `<button type="button" class="chip" data-id="${c.id}" style="--chip-c:${c.color}"><span class="cdot" style="background:${c.color}"></span>${escapeHtml(c.label)}</button>`)
    .join("");

  function setNoteChip(id, fromGuess) {
    noteSelectedChip = id;
    noteChipRow.querySelectorAll(".chip").forEach((c) => c.classList.toggle("active", c.dataset.id === id));
    if (fromGuess) {
      const c = noteChips.find((x) => x.id === id);
      if (c) noteGuessLabel.textContent = `Erkannt: ${c.label} — du kannst das ändern.`;
    }
  }
  noteChipRow.querySelectorAll(".chip").forEach((btn) => btn.addEventListener("click", () => setNoteChip(btn.dataset.id, false)));

  noteTextEl.addEventListener("input", () => {
    const val = noteTextEl.value.toLowerCase();
    if (!val) {
      setNoteChip(DEFAULT_NOTE_CHIP_ID, false);
      noteGuessLabel.textContent = "Landet in „Ideen“, wenn keine andere Kategorie passt.";
      return;
    }
    const match = noteChips.find((c) => c.id !== DEFAULT_NOTE_CHIP_ID && (val.includes(c.label.toLowerCase()) || val.includes(c.id)));
    setNoteChip(match ? match.id : DEFAULT_NOTE_CHIP_ID, true);
  });

  const noteConnectionStatus = document.getElementById("noteConnectionStatus");

  // Prueft den Verbindungsstatus OHNE zu prompten (queryPermission fragt nie nach, nur
  // requestPermission tut das) und macht den Button-Text ehrlich: er sagt "Verbinden", wenn
  // ein Klick tatsaechlich einen Ordner-Dialog oeffnen wird, und nur "Speichern", wenn der
  // Klick wirklich sofort speichert — kein ueberraschender Dialog mehr bei "Speichern".
  async function refreshNoteModalState() {
    if (!fsAccessSupported) {
      noteModalSub.textContent = "Direktes Speichern braucht Chrome oder Edge.";
      noteConnectionStatus.textContent = "";
      noteSaveBtn.disabled = true;
      return;
    }
    const handle = await getStoredVaultHandle();
    let permitted = false;
    if (handle) {
      try {
        permitted = (await handle.queryPermission({ mode: "readwrite" })) === "granted";
      } catch (e) {
        permitted = false;
      }
    }
    if (permitted) {
      noteModalSub.textContent = "Landet als Notizen.md im gewählten Themen-Ordner deines Vaults.";
      noteConnectionStatus.className = "modal-status ok";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Vault verbunden (${escapeHtml(handle.name)})`;
      noteSaveBtn.textContent = "Speichern";
    } else if (handle) {
      noteModalSub.textContent = "Zugriff auf deinen Vault-Ordner wurde zurückgesetzt (z.B. nach Browser-Neustart).";
      noteConnectionStatus.className = "modal-status pending";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Zugriff erneut bestätigen nötig — kein neuer Ordner-Dialog, nur eine kurze Bestätigung.`;
      noteSaveBtn.textContent = "Zugriff bestätigen & speichern";
    } else {
      noteModalSub.textContent = "Einmalig deinen Vault-Ordner auswählen — danach speichert „Speichern“ immer direkt.";
      noteConnectionStatus.className = "modal-status pending";
      noteConnectionStatus.innerHTML = `<span class="sdot"></span>Noch nicht verbunden`;
      noteSaveBtn.textContent = "Vault verbinden & speichern";
    }
    noteSaveBtn.disabled = false;
  }

  function openNoteModal(presetId) {
    noteOverlay.classList.add("open");
    noteFormState.style.display = "";
    noteSavedState.classList.remove("show");
    noteTextEl.value = "";
    setNoteChip(presetId || DEFAULT_NOTE_CHIP_ID, false);
    noteGuessLabel.textContent = "Landet in „Ideen“, wenn keine andere Kategorie passt.";
    refreshNoteModalState();
    setTimeout(() => noteTextEl.focus(), 50);
  }
  function closeNoteModal() {
    noteOverlay.classList.remove("open");
  }

  document.getElementById("noteCloseBtn").addEventListener("click", closeNoteModal);
  document.getElementById("noteCancelBtn").addEventListener("click", closeNoteModal);
  noteOverlay.addEventListener("click", (e) => {
    if (e.target === noteOverlay) closeNoteModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && noteOverlay.classList.contains("open")) closeNoteModal();
  });

  noteSaveBtn.addEventListener("click", async () => {
    if (!fsAccessSupported) return;
    const text = noteTextEl.value.trim();
    if (!text) {
      noteTextEl.focus();
      return;
    }
    try {
      let handle = await getStoredVaultHandle();
      if (!handle) handle = await connectVault();
      const granted =
        (await handle.queryPermission({ mode: "readwrite" })) === "granted" ||
        (await handle.requestPermission({ mode: "readwrite" })) === "granted";
      if (!granted) {
        await refreshNoteModalState();
        return;
      }
      const folder = noteChips.find((c) => c.id === noteSelectedChip)?.label || "Ideen";
      const savedPath = await appendNoteToFolder(handle, folder, text);
      noteFormState.style.display = "none";
      noteSavedState.classList.add("show");
      document.getElementById("noteSavedFile").textContent = savedPath;
      setTimeout(closeNoteModal, 1400);
    } catch (err) {
      if (err?.name !== "AbortError") {
        console.error("Brain-Notiz speichern fehlgeschlagen:", err);
        alert(`Speichern fehlgeschlagen: ${err.message}`);
      }
    }
  });

  // ---------- Notizen-Liste (unten im Dashboard, alle Themen-Ordner zusammengefasst) ----------
  // Quelle: data.notes, vom lokalen Sync-Skript aus jeder Notizen.md im Vault zusammengetragen.
  const notesListEl = document.getElementById("notesList");
  const notesData = data.notes || [];
  const colorByFolder = new Map(brainAreas.map((a) => [a.folder, a.color || "var(--accent)"]));

  notesListEl.innerHTML = notesData.length
    ? notesData
        .map((n) => {
          const color = colorByFolder.get(n.category) || "var(--accent)";
          const dateLabel = new Date(n.date).toLocaleString("de-DE", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
          });
          return `<li class="note-row">
          <span class="note-tag"><span class="cdot" style="background:${color}"></span>${escapeHtml(n.category)}</span>
          <span class="note-date">${dateLabel}</span>
          <span class="note-text">${escapeHtml(n.text)}</span>
        </li>`;
        })
        .join("")
    : `<li class="notes-empty">Noch keine Notizen erfasst — klick auf „Brain“ in der Grafik oben.</li>`;

  // ---------- Goals ----------
  const accentByProject = {
    bricksOnTheFloor: "var(--accent-bricks)",
    brainwalkers: "var(--accent-brainwalkers)",
    bricklink: "var(--accent-bricklink)",
    tiktok: "var(--accent-tiktok)"
  };

  const daysUntil = (iso) => {
    const due = new Date(iso + "T00:00:00");
    const diff = Math.ceil((due - now) / 86400000);
    return diff;
  };

  // ---------- Wochenvergleich-Trendpfeile ----------
  // Vergleicht den aktuellsten Verlaufswert mit dem Wert von vor ~7 Tagen. Braucht dafür
  // metricsHistory (befüllt von scripts/sync-all.mjs) — in den ersten Tagen nach Einführung
  // ist noch keine Woche Verlauf da, dann bleibt die Badge einfach leer statt zu raten.
  const HISTORY_KEY_BY_GOAL = {
    "bricks-abos": "bricksOnTheFloorAbos",
    "brainwalkers-abos": "brainwalkersAbos",
    "tiktok-follower": "tiktokFollower"
  };

  function computeTrend(history, days = 7) {
    if (!history || history.length < 2) return null;
    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const cutoff = new Date(latest.date + "T00:00:00");
    cutoff.setDate(cutoff.getDate() - days);
    const past = [...sorted].reverse().find((h) => new Date(h.date + "T00:00:00") <= cutoff);
    if (!past) return null;
    return latest.value - past.value;
  }

  function renderTrendBadge(delta, unit, periodLabel = "7 Tage") {
    if (delta === null || delta === undefined) return "";
    if (delta === 0) return `<span class="trend-badge flat">→ ±0 (${periodLabel})</span>`;
    const dir = delta > 0 ? "up" : "down";
    const arrow = delta > 0 ? "↑" : "↓";
    const sign = delta > 0 ? "+" : "";
    return `<span class="trend-badge ${dir}">${arrow} ${sign}${fmtDE.format(delta)} ${unit || ""} (${periodLabel})</span>`;
  }

  const goalsGrid = document.getElementById("goalsGrid");
  data.goals.forEach((goal) => {
    const accent = accentByProject[goal.project] || "var(--accent-goal)";
    const pct = Math.max(0, Math.min(100, (goal.current / goal.target) * 100));
    const remaining = daysUntil(goal.due);
    const dueLabel =
      remaining > 0 ? `noch ${fmtDE.format(remaining)} Tage` : remaining === 0 ? "heute fällig" : "überfällig";

    const card = document.createElement("div");
    card.className = "card goal-card";
    card.style.setProperty("--card-accent", accent);

    if (goal.isMilestone) {
      const reached = goal.current >= goal.target;
      card.innerHTML = `
        <p class="card-title">${goal.label}</p>
        <p class="card-subtitle">Ziel bis ${fmtDate(goal.due)} · ${dueLabel}</p>
        <span class="milestone-badge ${reached ? "done" : ""}">${reached ? "✓ erreicht" : "○ noch offen"}</span>
      `;
    } else {
      const historyKey = HISTORY_KEY_BY_GOAL[goal.id];
      const trend = historyKey ? computeTrend(data.metricsHistory?.[historyKey]) : null;
      card.innerHTML = `
        <p class="card-title">${goal.label}</p>
        <div class="gauge-row">
          <div class="gauge" style="--pct:${pct}; --gc:${accent}"><span>${pct.toFixed(0)}%</span></div>
          <div class="gauge-meta">
            <span class="num">${fmtDE.format(goal.current)} ${goal.unit}</span>
            <span class="lbl">Ziel ${fmtDE.format(goal.target)} ${goal.unit}</span>
            <span class="due">${dueLabel}</span>
          </div>
        </div>
        ${trend !== null ? `<div class="goal-trend">${renderTrendBadge(trend, goal.unit)}</div>` : ""}
      `;
    }
    goalsGrid.appendChild(card);
  });

  // ---------- Studium-Countdown (nächste Prüfung/Abgabe) ----------
  // Bewusst klein — kein neuer "Privat"-Bereich, nur ein einzelner editierbarer Termin
  // als kompakte Karte in der Ziele-Sektion. Cloud-Sync ueber sync-data.json (siehe
  // Abschnitt "Cloud-Sync: Video-Ideen / Studium-Termin / To-Do / Aufgaben" unten),
  // gleiches Zeitstempel-Prinzip wie beim Habit-Tracker.
  const STUDIUM_STORAGE_KEY = "dashboard-studium-deadline";
  const loadStudiumDeadline = () => {
    try {
      const raw = localStorage.getItem(STUDIUM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        return parsed;
      }
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    return { label: "", date: "", updatedAt: -1 };
  };
  const saveStudiumDeadline = (d) => {
    const state = { label: d.label || "", date: d.date || "", updatedAt: Date.now() };
    localStorage.setItem(STUDIUM_STORAGE_KEY, JSON.stringify(state));
    return state;
  };

  function buildStudiumCard() {
    const deadline = loadStudiumDeadline();
    const card = document.createElement("div");
    card.className = "card goal-card studium-card";
    card.style.setProperty("--card-accent", "var(--accent-privat)");

    if (deadline.date) {
      const remaining = daysUntil(deadline.date);
      const dueLabel =
        remaining > 0 ? `noch ${fmtDE.format(remaining)} Tage` : remaining === 0 ? "heute" : "vorbei";
      card.innerHTML = `
        <p class="card-title">🎓 ${escapeHtml(deadline.label || "Prüfung/Abgabe")}</p>
        <p class="card-subtitle">${fmtDate(deadline.date)} · ${dueLabel}</p>
        <button type="button" class="link-button-inline" id="studiumEditBtn">Ändern</button>
      `;
    } else {
      card.innerHTML = `
        <p class="card-title">🎓 Studium</p>
        <p class="card-subtitle">Noch keine nächste Prüfung/Abgabe eingetragen</p>
        <button type="button" class="link-button-inline" id="studiumEditBtn">Termin eintragen</button>
      `;
    }

    card.querySelector("#studiumEditBtn").addEventListener("click", () => {
      const label = prompt("Bezeichnung (z.B. \"Klausur Marketing\"):", deadline.label || "");
      if (label === null) return;
      const dateInput = prompt("Datum (JJJJ-MM-TT):", deadline.date || "");
      if (dateInput === null) return;
      saveStudiumDeadline({ label: label.trim(), date: dateInput.trim() });
      refreshStudiumCard();
    });

    return card;
  }
  // Eigene Funktion statt direkt in buildStudiumCard, da diese Karte auch nach einem
  // Remote-Fetch (neuerer Cloud-Stand) neu gebaut wird, ohne die Position der anderen
  // Ziel-Karten in goalsGrid zu verschieben (replaceChild statt remove+append).
  let studiumCardEl = null;
  function refreshStudiumCard() {
    const newCard = buildStudiumCard();
    if (studiumCardEl && studiumCardEl.parentNode) {
      studiumCardEl.parentNode.replaceChild(newCard, studiumCardEl);
    } else {
      goalsGrid.appendChild(newCard);
    }
    studiumCardEl = newCard;
  }
  refreshStudiumCard();

  // ---------- Business ----------
  const businessGrid = document.getElementById("businessGrid");
  const accentVarByKey = {
    bricklink: "var(--accent-bricklink)",
    bricksOnTheFloor: "var(--accent-bricks)",
    brainwalkers: "var(--accent-brainwalkers)"
  };

  const RHYTHM_META = {
    green: { dot: "🟢", label: "im Rhythmus" },
    yellow: { dot: "🟡", label: "wird knapp" },
    red: { dot: "🔴", label: "überfällig" }
  };

  function daysSince(iso) {
    if (!iso) return null;
    return Math.floor((now - new Date(iso)) / 86400000);
  }

  function rhythmStatus(days, targetDays) {
    if (days === null) return null;
    if (days <= targetDays) return "green";
    if (days <= targetDays * 1.5) return "yellow";
    return "red";
  }

  function renderRhythmBadge(biz) {
    if (!biz.uploadRhythmDays) return "";
    const days = daysSince(biz.lastUploadAt);
    if (days === null) {
      return `<p class="rhythm-badge neutral">⏳ Longform-Rhythmus: noch nicht synchronisiert</p>`;
    }
    const status = rhythmStatus(days, biz.uploadRhythmDays);
    const meta = RHYTHM_META[status];
    const dayLabel = days === 0 ? "heute" : days === 1 ? "vor 1 Tag" : `vor ${days} Tagen`;
    return `<p class="rhythm-badge ${status}">${meta.dot} Letztes Longform-Video ${dayLabel} · ${meta.label} (Ziel: alle ${biz.uploadRhythmDays} Tage, Shorts zählen nicht)</p>`;
  }

  // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker
  // (siehe Abschnitt weiter unten). Altformat vor Einfuehrung des Sync war ein purer
  // String ohne Wrapper - JSON.parse schlaegt dafuer fehl oder liefert kein {text:...}
  // zurueck, dann als Altformat-String behandeln statt zu verwerfen.
  const loadIdeaState = (key) => {
    const raw = localStorage.getItem(`dashboard-idea-${key}`);
    if (raw === null) return { text: "", updatedAt: -1 };
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        return parsed;
      }
    } catch (e) {
      /* Altformat: purer String vor Einfuehrung des Cloud-Sync */
    }
    return { text: raw, updatedAt: 0 };
  };
  const saveIdeaState = (key, text) => {
    const state = { text, updatedAt: Date.now() };
    localStorage.setItem(`dashboard-idea-${key}`, JSON.stringify(state));
    return state;
  };
  const ideaTextareas = {};

  Object.entries(data.business).forEach(([key, biz]) => {
    const card = document.createElement("div");
    card.className = "card business-card";
    card.style.setProperty("--card-accent", accentVarByKey[key] || "var(--accent-goal)");

    if (key === "bricklink" && data.bricklinkOrders?.checkedAt) {
      biz = {
        ...biz,
        stats: biz.stats.map((s) =>
          s.label === "Sendung ausstehend"
            ? { ...s, value: String(data.bricklinkOrders.pendingShipments.length), hint: "live via Bricklink-API" }
            : s
        )
      };
    }

    const stats = biz.stats
      .map(
        (s) => `
        <div class="stat-row">
          <span class="stat-label">${s.label}</span>
          <span class="stat-value">${s.value}${s.hint ? `<span class="stat-hint">${s.hint}</span>` : ""}</span>
        </div>`
      )
      .join("");

    const isYoutubeChannel = key === "bricksOnTheFloor" || key === "brainwalkers";

    card.innerHTML = `
      <p class="card-title">${biz.title}</p>
      <p class="card-subtitle">${biz.subtitle}</p>
      <div class="stat-list">${stats}</div>
      ${biz.note ? `<p class="card-note">${biz.note}</p>` : ""}
      ${renderRhythmBadge(biz)}
      ${
        isYoutubeChannel
          ? `<div class="idea-note">
              <label for="idea-${key}">Nächste Video-Idee</label>
              <textarea id="idea-${key}" rows="2" placeholder="Notiz…"></textarea>
              <span class="idea-saved" id="idea-saved-${key}">Gespeichert ✓</span>
            </div>`
          : ""
      }
    `;
    businessGrid.appendChild(card);

    if (isYoutubeChannel) {
      const textarea = card.querySelector(`#idea-${key}`);
      const savedTag = card.querySelector(`#idea-saved-${key}`);
      ideaTextareas[key] = textarea;
      textarea.value = loadIdeaState(key).text;

      let saveTimer;
      textarea.addEventListener("input", () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          saveIdeaState(key, textarea.value);
          savedTag.classList.add("show");
          setTimeout(() => savedTag.classList.remove("show"), 1500);
        }, 500);
      });
    }
  });

  // ---------- Time tracker: Donut + gestapelte Balken (Woche/Monat/Jahr) ----------
  const tt = data.timeTracker;
  const toHours = (min) => min / 60;
  const categoryColors = { YouTube: "var(--accent-bricks)", Bricklink: "var(--accent-bricklink)" };
  // Lokaler Helfer statt des später deklarierten `dateKey` — sonst Temporal-Dead-Zone-Fehler
  // (siehe escapeHtml/newId oben: gleiche Falle, hier bewusst vermieden).
  const timeDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  let timeView = "week";

  function timeCategoriesOf(rows) {
    const set = new Set();
    rows.forEach((row) => Object.keys(row).forEach((k) => k !== "date" && set.add(k)));
    return [...set];
  }

  function sumByCategory(rows) {
    const totals = {};
    rows.forEach((row) => {
      Object.entries(row).forEach(([k, v]) => {
        if (k === "date") return;
        totals[k] = (totals[k] || 0) + v;
      });
    });
    return totals;
  }

  function aggregateMonthly(daily) {
    const byMonth = {};
    daily.forEach((row) => {
      const key = row.date.slice(0, 7);
      byMonth[key] = byMonth[key] || { date: key };
      Object.entries(row).forEach(([k, v]) => {
        if (k === "date") return;
        byMonth[key][k] = (byMonth[key][k] || 0) + v;
      });
    });
    return Object.keys(byMonth)
      .sort()
      .map((k) => byMonth[k]);
  }

  function timeViewRows(view) {
    const today = new Date();
    if (view === "week") {
      const cutoff = new Date(today);
      cutoff.setDate(cutoff.getDate() - 6);
      const cutoffKey = timeDateKey(cutoff);
      return { rows: tt.daily.filter((d) => d.date >= cutoffKey), granularity: "day" };
    }
    if (view === "month") {
      const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
      return { rows: tt.daily.filter((d) => d.date.startsWith(prefix)), granularity: "day" };
    }
    const yearRows = tt.daily.filter((d) => d.date.startsWith(String(today.getFullYear())));
    return { rows: aggregateMonthly(yearRows), granularity: "month" };
  }

  const timeViewRangeLabel = {
    week: () => "Letzte 7 Tage",
    month: () => new Date().toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
    year: () => `${new Date().getFullYear()}`
  };

  function renderTimeBalance() {
    const { rows, granularity } = timeViewRows(timeView);
    const categories = timeCategoriesOf(rows);
    const totals = sumByCategory(rows);
    const totalMinutes = Object.values(totals).reduce((a, b) => a + b, 0);

    document.getElementById("timeRangeLabel").textContent = rows.length
      ? `${timeViewRangeLabel[timeView]()} · Quelle: ${tt.source}`
      : `Keine Zeiteinträge für diesen Zeitraum · Quelle: ${tt.source}`;

    document.getElementById("timeDonutTotal").textContent = `${toHours(totalMinutes).toFixed(1)}h`;

    let donutCursor = 0;
    const donutStops = categories.map((cat) => {
      const from = donutCursor;
      donutCursor += totalMinutes ? (totals[cat] / totalMinutes) * 100 : 0;
      return `${categoryColors[cat] || "var(--surface-3)"} ${from}% ${donutCursor}%`;
    });
    donutStops.push(`var(--surface-3) ${donutCursor}% 100%`);
    document.getElementById("timeDonut").style.background = `conic-gradient(${donutStops.join(", ")})`;

    document.getElementById("timeLegend").innerHTML = categories.length
      ? categories
          .map(
            (cat) => `
        <div class="legend-row">
          <span class="legend-dot" style="background:${categoryColors[cat] || "var(--surface-3)"}"></span>
          ${cat}
          <span class="v">${toHours(totals[cat]).toFixed(1)}h · ${totalMinutes ? ((totals[cat] / totalMinutes) * 100).toFixed(0) : 0}%</span>
        </div>`
          )
          .join("")
      : `<p class="habit-empty">Keine Zeiteinträge in diesem Zeitraum.</p>`;

    const rowTotals = rows.map((row) => categories.reduce((sum, c) => sum + (row[c] || 0), 0));
    const maxRowTotal = Math.max(1, ...rowTotals);

    const labelFor = (row) =>
      granularity === "month"
        ? new Date(row.date + "-01T00:00:00").toLocaleDateString("de-DE", { month: "short" })
        : new Date(row.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short" });

    const tooltipFor = (row, dayTotal) => {
      const dateLabel =
        granularity === "month"
          ? new Date(row.date + "-01T00:00:00").toLocaleDateString("de-DE", { month: "long", year: "numeric" })
          : fmtDate(row.date);
      const parts = categories.map((c) => `${c}: ${toHours(row[c] || 0).toFixed(1)}h`).join(" · ");
      return `${dateLabel} — ${toHours(dayTotal).toFixed(1)}h gesamt (${parts})`;
    };

    document.getElementById("timeBars").innerHTML = rows
      .map((row, i) => {
        const dayTotal = rowTotals[i];
        const h = Math.max(4, Math.round((dayTotal / maxRowTotal) * 130));
        const segs = categories
          .map((c) => {
            const segH = dayTotal > 0 ? Math.round(((row[c] || 0) / dayTotal) * h) : 0;
            return segH > 0
              ? `<div class="seg" style="height:${segH}px; background:${categoryColors[c] || "var(--surface-3)"}"></div>`
              : "";
          })
          .join("");
        return `<div class="iso-bar-col" title="${tooltipFor(row, dayTotal)}">
          <div class="iso-bar-value">${toHours(dayTotal).toFixed(1)}h</div>
          <div class="stack-bar" style="height:${h}px">${segs}</div>
          <div class="iso-bar-label">${labelFor(row)}</div>
        </div>`;
      })
      .join("");
  }

  document.querySelectorAll("#timeViewToggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      timeView = btn.dataset.view;
      document.querySelectorAll("#timeViewToggle button").forEach((b) => b.classList.toggle("active", b === btn));
      renderTimeBalance();
    });
  });

  renderTimeBalance();

  // ---------- Umsatz-Trend (Bricklink) ----------
  const revenue = data.bricklinkRevenue;
  const hasWeekly = revenue?.weekly?.length > 0;
  const hasMonthly = revenue?.monthly?.length > 0;

  if (hasWeekly || hasMonthly) {
    document.getElementById("revenuePanel").hidden = false;
  }

  if (hasWeekly) {
    document.getElementById("revenueWeeklyBlock").hidden = false;
    const first = fmtDate(revenue.weekly[0].weekStart);
    const last = fmtDate(revenue.weekly[revenue.weekly.length - 1].weekStart);
    const weekCount = revenue.weekly.length;
    const revenueTrend =
      weekCount >= 2 ? revenue.weekly[weekCount - 1].total - revenue.weekly[weekCount - 2].total : null;
    document.getElementById("revenueWeeklyRangeLabel").innerHTML =
      `${first} – ${last} · pro Kalenderwoche` +
      (revenueTrend !== null ? ` · ${renderTrendBadge(Math.round(revenueTrend * 100) / 100, "€", "ggü. Vorwoche")}` : "");
    renderRevenueChart({
      svgId: "revenueChartWeekly",
      entries: revenue.weekly,
      currency: revenue.currency,
      keyField: "weekStart",
      formatLabel: (key) => new Date(key + "T00:00:00").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
      formatTooltip: (key) => `KW ab ${fmtDate(key)}`
    });
  }

  if (hasMonthly) {
    document.getElementById("revenueMonthlyBlock").hidden = false;
    const fmtMonth = (key) => new Date(key + "-01T00:00:00").toLocaleDateString("de-DE", { month: "short", year: "2-digit" });
    document.getElementById("revenueMonthlyRangeLabel").textContent = `${fmtMonth(revenue.monthly[0].month)} – ${fmtMonth(revenue.monthly[revenue.monthly.length - 1].month)} · pro Kalendermonat`;
    renderRevenueChart({
      svgId: "revenueChartMonthly",
      entries: revenue.monthly,
      currency: revenue.currency,
      keyField: "month",
      formatLabel: fmtMonth,
      formatTooltip: fmtMonth
    });
  }

  function renderRevenueChart({ svgId, entries, currency, keyField, formatLabel, formatTooltip }) {
    const container = document.getElementById(svgId);
    const maxTotal = Math.max(1, ...entries.map((e) => e.total));
    const currencySign = currency === "EUR" ? "€" : "";

    container.innerHTML = entries
      .map((e) => {
        const key = e[keyField];
        const h = Math.round((e.total / maxTotal) * 130) + 24;
        return `<div class="iso-bar-col" title="${formatTooltip(key)}: ${e.total.toFixed(2)} ${currency} (${e.orderCount} Bestellungen)">
          <div class="iso-bar-value">${Math.round(e.total)}${currencySign}</div>
          <div class="iso-bar" style="--h:${h}px"></div>
          <div class="iso-bar-label">${formatLabel(key)}</div>
        </div>`;
      })
      .join("");
  }

  // ---------- Tages-To-Do ----------
  const TODO_CATEGORIES = [
    { id: "business", label: "Business (Bricklink & YouTube)", accent: "var(--accent-bricks)" },
    { id: "studium", label: "Studium & Job", accent: "var(--accent-privat)" },
    { id: "privat", label: "Privates", accent: "var(--accent-laden)" }
  ];

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const TODO_STORAGE_KEY = `dashboard-todo-${todayKey()}`;

  // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker
  // (siehe Abschnitt weiter unten). loadTodosState() liefert den Wrapper mit Zeitstempel
  // (fuer den Abgleich mit der Cloud), loadTodos() nur die Kategorien-Items (fuer die UI).
  // parseTodosPayload() ist von migrateStaleTodosToTasks() weiter unten mitbenutzt, um auch
  // die Tages-To-Do-Eintraege VERGANGENER Tage (eigener Storage-Key pro Tag) einlesen zu
  // koennen, nicht nur den heutigen TODO_STORAGE_KEY.
  const parseTodosPayload = (raw) => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.items) {
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        return parsed;
      }
      // Altformat: Kategorien-Objekt direkt ohne Wrapper (vor Einfuehrung des Cloud-Sync)
      return { items: parsed, updatedAt: 0 };
    } catch (e) {
      return null;
    }
  };
  const loadTodosState = () => {
    const raw = localStorage.getItem(TODO_STORAGE_KEY);
    if (raw) {
      const parsed = parseTodosPayload(raw);
      if (parsed) return parsed;
    }
    const empty = {};
    TODO_CATEGORIES.forEach((c) => (empty[c.id] = []));
    return { items: empty, updatedAt: -1 };
  };
  const loadTodos = () => loadTodosState().items;
  const saveTodos = (items) => localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify({ items, updatedAt: Date.now() }));

  let todos = loadTodos();
  const todoGrid = document.getElementById("todoGrid");
  document.getElementById("todoDateLabel").textContent = `Setzt sich täglich automatisch zurück, offene Punkte wandern in „Aufgaben“ · ${now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}`;

  function renderTodos() {
    todoGrid.innerHTML = "";
    TODO_CATEGORIES.forEach((cat) => {
      const items = todos[cat.id] || [];
      const doneCount = items.filter((i) => i.done).length;

      const listHtml = items.length
        ? items
            .map(
              (item) => `
        <li class="todo-item ${item.done ? "done" : ""}" data-id="${item.id}">
          <input type="checkbox" ${item.done ? "checked" : ""} />
          <span>${escapeHtml(item.text)}</span>
          <button type="button" class="todo-remove" aria-label="Entfernen">×</button>
        </li>`
            )
            .join("")
        : `<li class="todo-empty">Noch nichts eingetragen.</li>`;

      const card = document.createElement("div");
      card.className = "card todo-card";
      card.style.setProperty("--card-accent", cat.accent);
      card.innerHTML = `
        <p class="card-title">${cat.label}</p>
        <p class="todo-progress">${items.length ? `${doneCount}/${items.length} erledigt` : "&nbsp;"}</p>
        <div class="todo-add">
          <input type="text" placeholder="Aufgabe hinzufügen…" maxlength="120" />
          <button type="button" aria-label="Hinzufügen">+</button>
        </div>
        <ul class="todo-list">${listHtml}</ul>
      `;

      const input = card.querySelector(".todo-add input");
      const addItem = () => {
        const text = input.value.trim();
        if (!text) return;
        todos[cat.id] = todos[cat.id] || [];
        todos[cat.id].push({ id: newId(), text, done: false });
        saveTodos(todos);
        renderTodos();
      };
      card.querySelector(".todo-add button").addEventListener("click", addItem);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") addItem();
      });

      card.querySelectorAll(".todo-item").forEach((row) => {
        const id = row.getAttribute("data-id");
        row.querySelector("input[type=checkbox]").addEventListener("change", (e) => {
          const item = todos[cat.id].find((i) => i.id === id);
          if (item) item.done = e.target.checked;
          saveTodos(todos);
          renderTodos();
        });
        row.querySelector(".todo-remove").addEventListener("click", () => {
          todos[cat.id] = todos[cat.id].filter((i) => i.id !== id);
          saveTodos(todos);
          renderTodos();
        });
      });

      todoGrid.appendChild(card);
    });
  }

  renderTodos();

  // ---------- Aufgaben (persistent, kein täglicher Reset) ----------
  const TASKS_STORAGE_KEY = "dashboard-tasks-v1";

  // Cloud-Sync ueber sync-data.json, gleiches Zeitstempel-Prinzip wie beim Habit-Tracker.
  const loadTasksState = () => {
    try {
      const raw = localStorage.getItem(TASKS_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return { items: parsed, updatedAt: 0 }; // Altformat: reines Array
        if (parsed && Array.isArray(parsed.items)) {
          if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
          return parsed;
        }
      }
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    return { items: [], updatedAt: -1 };
  };
  const loadTasks = () => loadTasksState().items;
  const saveTasks = (items) => localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify({ items, updatedAt: Date.now() }));

  let tasks = loadTasks();
  const taskList = document.getElementById("taskList");
  const taskInput = document.getElementById("taskInput");

  function renderTasks() {
    taskList.innerHTML = tasks.length
      ? tasks
          .map(
            (item) => `
      <li class="todo-item ${item.done ? "done" : ""}" data-id="${item.id}">
        <input type="checkbox" ${item.done ? "checked" : ""} />
        <span>${escapeHtml(item.text)}</span>
        <button type="button" class="todo-remove" aria-label="Entfernen">×</button>
      </li>`
          )
          .join("")
      : `<li class="todo-empty">Noch nichts eingetragen.</li>`;

    taskList.querySelectorAll(".todo-item").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelector("input[type=checkbox]").addEventListener("change", () => {
        // Abhaken = erledigt: kurz sichtbar durchgestrichen, dann automatisch aus der Liste
        // entfernt (im Gegensatz zum Tages-To-Do, das bleibt hier nichts dauerhaft "erledigt"
        // liegen — das ist ja gerade der Sinn dieser Liste, anders als beim täglichen Reset).
        row.classList.add("done");
        setTimeout(() => {
          tasks = tasks.filter((t) => t.id !== id);
          saveTasks(tasks);
          renderTasks();
        }, 400);
      });
      row.querySelector(".todo-remove").addEventListener("click", () => {
        tasks = tasks.filter((t) => t.id !== id);
        saveTasks(tasks);
        renderTasks();
      });
    });
  }

  function addTask() {
    const text = taskInput.value.trim();
    if (!text) return;
    tasks.push({ id: newId(), text, done: false });
    saveTasks(tasks);
    taskInput.value = "";
    renderTasks();
  }
  document.getElementById("taskAddBtn").addEventListener("click", addTask);
  taskInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addTask();
  });

  renderTasks();

  // Nicht abgehakte Tages-To-Dos VERGANGENER Tage nach "Aufgaben" uebernehmen, bevor der
  // alte Tages-Eintrag verworfen wird. Jeder Tag hat einen eigenen Storage-Key
  // (dashboard-todo-JJJJ-MM-TT) - ein neuer Tag bedeutet bisher einfach einen neuen, leeren
  // Key (TODO_STORAGE_KEY oben), der alte blieb bislang ungenutzt liegen. Jetzt: offene
  // Punkte wandern automatisch rueber, erledigte verfallen wie gehabt, und der alte
  // Tages-Key wird danach geloescht (idempotent - beim naechsten Laden ist nichts mehr da,
  // was nochmal migriert werden koennte).
  function migrateStaleTodosToTasks() {
    const todayK = todayKey();
    let moved = false;
    Object.keys(localStorage)
      .filter((k) => /^dashboard-todo-\d{4}-\d{2}-\d{2}$/.test(k) && k !== TODO_STORAGE_KEY)
      .forEach((key) => {
        const dateStr = key.slice("dashboard-todo-".length);
        if (dateStr >= todayK) return; // heute oder in der Zukunft (Zeitzonen-Kuriosum): unberuehrt lassen
        const raw = localStorage.getItem(key);
        const state = raw ? parseTodosPayload(raw) : null;
        if (state) {
          TODO_CATEGORIES.forEach((cat) => {
            (state.items[cat.id] || []).forEach((item) => {
              if (!item.done) {
                tasks.push({ id: newId(), text: item.text, done: false });
                moved = true;
              }
            });
          });
        }
        localStorage.removeItem(key);
      });
    if (moved) {
      saveTasks(tasks);
      renderTasks();
    }
  }
  migrateStaleTodosToTasks();

  // ---------- Habit-Tracker ----------
  const HABIT_STORAGE_KEY = "dashboard-habits-v1";
  const HABIT_COLORS = [
    "var(--accent-bricks)",
    "var(--accent-privat)",
    "var(--accent-laden)",
    "var(--accent-brainwalkers)",
    "var(--accent-bricklink)",
    "var(--accent-goal)"
  ];
  const HABIT_DEFAULTS = [
    { id: "gym", label: "Gym", targetPerWeek: 7 },
    { id: "rauchfrei", label: "Rauchfreier Tag", targetPerWeek: 7 },
    { id: "koffein", label: "<2x Koffein", targetPerWeek: 7 }
  ];
  // Faellt jede Gewohnheit standardmaessig auf "taeglich" (7/7) zurueck - fuer Alt-Eintraege
  // (lokal oder aus der Cloud) ohne targetPerWeek, und schuetzt vor kaputten/leeren Werten.
  const normalizeHabit = (h) => ({
    id: h.id,
    label: h.label,
    targetPerWeek: Number.isInteger(h.targetPerWeek) && h.targetPerWeek >= 1 && h.targetPerWeek <= 7 ? h.targetPerWeek : 7
  });

  const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const mondayOf = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const day = d.getDay() || 7;
    if (day !== 1) d.setDate(d.getDate() - (day - 1));
    return d;
  };

  function loadHabitState() {
    try {
      const raw = localStorage.getItem(HABIT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Stand existiert schon lokal (ggf. aus der Zeit vor Einfuehrung von
        // "updatedAt") - auf 0 statt -1 defaulten, damit ein reiner Zeitstempel-
        // Gleichstand mit der Cloud NICHT automatisch die Cloud gewinnen laesst
        // und so echte, noch nicht gepushte lokale Aenderungen ueberschreibt.
        if (typeof parsed.updatedAt !== "number") parsed.updatedAt = 0;
        parsed.habits = (parsed.habits || []).map(normalizeHabit);
        return parsed;
      }
    } catch (e) {
      /* corrupted storage, fall back to defaults */
    }
    // Kein lokaler Stand vorhanden (frisches Geraet/Browser): -1 statt 0, damit der
    // erste fetchRemoteHabits()-Aufruf beim Laden IMMER den Cloud-Stand uebernimmt,
    // auch wenn habits-data.json selbst noch kein "updatedAt" hat (dann 0, siehe unten).
    return { habits: HABIT_DEFAULTS.map((h) => ({ ...h })), log: {}, updatedAt: -1 };
  }

  // ---------- Habit-Tracker: Cloud-Sync über GitHub Contents API ----------
  // Kein neuer Dienst nötig: läuft am globalen "Sync"-Button oben rechts mit (derselbe
  // GitHub-Token/Repo wie für den Daten-Sync) und schreibt den Habit-Stand zusätzlich in
  // habits-data.json im Repo. Notion fiel raus: dessen API blockt direkte Browser-Aufrufe
  // (kein CORS), GitHub erlaubt das — genau wie beim Sync-Button oben schon genutzt.
  // Lesen beim Laden geht ohne Token (öffentliche Datei über GitHub Pages), Schreiben
  // braucht den Token mit Berechtigung "Contents: Read and write".
  const HABIT_REMOTE_FILE = "habits-data.json";
  const habitSyncStatusEl = document.getElementById("habitSyncStatus");
  let habitCloudSha = null;

  function setHabitSyncStatus(state, detail) {
    if (!habitSyncStatusEl) return;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const map = {
      idle: "☁️ Wird beim nächsten Klick auf \"Sync\" oben rechts gesichert",
      synced: `☁️ Zuletzt mit Sync gesichert · ${time}`,
      "local-only": "💾 Nur lokal — für Cloud-Sync oben rechts auf \"Sync\" klicken",
      error: `⚠️ Cloud-Sync fehlgeschlagen${detail ? " — " + detail : ""}`
    };
    habitSyncStatusEl.textContent = map[state] || map.idle;
  }

  // Frueher wurde hier pro Tag/Gewohnheit additiv gemergt ("erledigt, sobald lokal ODER
  // Cloud erledigt") - das konnte ein Häkchen nie wieder entfernen: sobald ein Zustand
  // einmal in die Cloud gepusht war, kam er bei jedem Laden auf jedem Geraet automatisch
  // zurueck, auch nach bewusstem Entfernen. Jetzt gewinnt schlicht der neuere Zeitstempel
  // (ganzer Zustand, nicht pro Eintrag) - kein Zombie-Haekchen mehr, dafuer im seltenen
  // Fall zeitgleicher Aenderungen auf zwei Geraeten verliert die aeltere. habitHasContent()
  // + remoteWins() (oben) verhindern zusaetzlich, dass ein leerer/frischer Stand einen
  // bereits befuellten grundlos ersetzt.
  const habitHasContent = (state) => (state?.habits?.length || 0) > 0 || Object.keys(state?.log || {}).length > 0;

  async function fetchRemoteHabits() {
    try {
      const res = await fetch(HABIT_REMOTE_FILE, { cache: "no-store" });
      if (!res.ok) return;
      const remote = await res.json();
      const remoteUpdatedAt = typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
      if (remoteWins(remoteUpdatedAt, habitState.updatedAt, habitHasContent(remote), habitHasContent(habitState))) {
        habitState = { habits: (remote.habits || []).map(normalizeHabit), log: remote.log || {}, updatedAt: remoteUpdatedAt };
        localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
        renderHabits();
      }
    } catch (err) {
      /* offline, file:// geöffnet, oder Datei existiert noch nicht — lokaler Stand bleibt gültig */
    }
  }

  // config optional: wird vom Sync-Button-Klick mitgegeben (ein Prompt statt zwei),
  // sonst holt sich die Funktion die Zugangsdaten selbst.
  async function pushHabitsToCloud(config) {
    config = config || getGithubConfig();
    if (!config) {
      setHabitSyncStatus("local-only");
      return;
    }
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${HABIT_REMOTE_FILE}`;
    const headers = { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" };
    try {
      // Immer frisch abrufen (nicht nur beim allerersten Push cachen) und, falls die Cloud
      // inzwischen einen ECHT neueren UND inhaltlich mindestens gleichwertigen Stand hat
      // (anderes, fast zeitgleich synchronisierendes Geraet), diesen zuerst uebernehmen.
      // Sonst kann ein Push blind einen neueren Cloud-Stand mit einem aelteren lokalen
      // ueberschreiben — beobachtet bei mehreren Sync-Klicks kurz hintereinander.
      const getRes = await fetch(apiUrl, { headers });
      if (getRes.ok) {
        const meta = await getRes.json();
        habitCloudSha = meta.sha;
        try {
          const remote = JSON.parse(decodeURIComponent(escape(atob(meta.content.replace(/\n/g, "")))));
          const remoteUpdatedAt = typeof remote.updatedAt === "number" ? remote.updatedAt : 0;
          if (remoteWins(remoteUpdatedAt, habitState.updatedAt, habitHasContent(remote), habitHasContent(habitState))) {
            habitState = { habits: (remote.habits || []).map(normalizeHabit), log: remote.log || {}, updatedAt: remoteUpdatedAt };
            localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
            renderHabits();
          }
        } catch (e) {
          /* Datei leer/kein valides JSON — mit lokalem Stand weitermachen */
        }
      }
      // -1 ist nur ein interner Marker fuer "noch nie lokal gespeichert" (siehe loadHabitState())
      // und wuerde extern nur verwirren - beim Export auf 0 normalisieren.
      const exportState = { ...habitState, updatedAt: Math.max(0, habitState.updatedAt) };
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(exportState, null, 2))));
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Habit-Tracker Update", content, ...(habitCloudSha ? { sha: habitCloudSha } : {}) })
      });
      if (putRes.ok) {
        habitCloudSha = (await putRes.json()).content?.sha || habitCloudSha;
        setHabitSyncStatus("synced");
      } else if (putRes.status === 401 || putRes.status === 403) {
        localStorage.removeItem("dashboard-gh-token");
        setHabitSyncStatus("error", "Token ungültig oder ohne 'Contents'-Berechtigung (entfernt, beim nächsten Mal neu eingeben)");
      } else if (putRes.status === 409) {
        habitCloudSha = null; // jemand anders hat parallel geschrieben — sha neu holen beim nächsten Versuch
        setHabitSyncStatus("error", "Konflikt, bitte erneut versuchen");
      } else {
        setHabitSyncStatus("error", `Status ${putRes.status}`);
      }
    } catch (err) {
      setHabitSyncStatus("error", err.message);
    }
  }

  const saveHabitState = () => {
    habitState.updatedAt = Date.now();
    localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
  };

  let habitState = loadHabitState();
  let habitView = "week";
  let habitMonthRef = new Date();
  let habitYearRef = new Date().getFullYear();

  const habitNewInput = document.getElementById("habitNewInput");
  const habitAddBtn = document.getElementById("habitAddBtn");
  const habitViews = {
    week: document.getElementById("habitViewWeek"),
    month: document.getElementById("habitViewMonth"),
    year: document.getElementById("habitViewYear")
  };

  function toggleHabitDay(habitId, key) {
    habitState.log[key] = habitState.log[key] || {};
    habitState.log[key][habitId] = !habitState.log[key][habitId];
    if (!habitState.log[key][habitId]) delete habitState.log[key][habitId];
    saveHabitState();
    renderHabits();
  }

  function removeHabit(habitId) {
    habitState.habits = habitState.habits.filter((h) => h.id !== habitId);
    Object.values(habitState.log).forEach((day) => delete day[habitId]);
    saveHabitState();
    renderHabits();
  }

  function addHabit() {
    const label = habitNewInput.value.trim();
    if (!label) return;
    habitState.habits.push({ id: newId(), label, targetPerWeek: 7 });
    saveHabitState();
    habitNewInput.value = "";
    renderHabits();
  }

  function editHabitTarget(habitId) {
    const habit = habitState.habits.find((h) => h.id === habitId);
    if (!habit) return;
    const input = prompt(`Wie oft pro Woche soll "${habit.label}" erfuellt sein, damit die Woche zaehlt? (1-7)`, String(habit.targetPerWeek));
    if (input === null) return;
    const n = parseInt(input.trim(), 10);
    if (!Number.isInteger(n) || n < 1 || n > 7) return;
    habit.targetPerWeek = n;
    saveHabitState();
    renderHabits();
  }
  habitAddBtn.addEventListener("click", addHabit);
  habitNewInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addHabit();
  });

  document.querySelectorAll("#habitViewToggle button").forEach((btn) => {
    btn.addEventListener("click", () => {
      habitView = btn.dataset.view;
      document.querySelectorAll("#habitViewToggle button").forEach((b) => b.classList.toggle("active", b === btn));
      Object.entries(habitViews).forEach(([key, el]) => (el.hidden = key !== habitView));
      renderHabits();
    });
  });

  function daycellHtml({ habitId, key, done, today, extraClass, colorIdx }) {
    const color = HABIT_COLORS[colorIdx % HABIT_COLORS.length];
    const classes = ["habit-daycell", extraClass || "", done ? "done" : "", today ? "today" : ""].filter(Boolean).join(" ");
    return `<button type="button" class="${classes}" style="--habit-color:${color}" data-habit="${habitId}" data-date="${key}"></button>`;
  }

  function wireDaycellClicks(container) {
    container.querySelectorAll(".habit-daycell[data-habit]").forEach((cell) => {
      cell.addEventListener("click", () => toggleHabitDay(cell.dataset.habit, cell.dataset.date));
    });
  }

  function renderHabitEmptyOr(container, bodyHtml) {
    container.innerHTML = habitState.habits.length ? bodyHtml : `<p class="habit-empty">Noch keine Gewohnheiten — oben hinzufügen.</p>`;
  }

  function renderHabitWeek() {
    const weekStart = mondayOf(new Date());
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
    const todayK = dateKey(new Date());

    const headerCells = days
      .map((d) => `<div class="habit-daycell habit-dayhead">${d.toLocaleDateString("de-DE", { weekday: "short" })}<br>${d.getDate()}.</div>`)
      .join("");

    const rows = habitState.habits
      .map((h, idx) => {
        const cells = days
          .map((d) => {
            const key = dateKey(d);
            const done = !!habitState.log[key]?.[h.id];
            return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
          })
          .join("");
        const doneCount = days.filter((d) => habitState.log[dateKey(d)]?.[h.id]).length;
        const target = h.targetPerWeek;
        const weekDone = doneCount >= target;
        return `<div class="habit-row">
          <div class="habit-label">${escapeHtml(h.label)}<button type="button" class="habit-count${weekDone ? " done" : ""}" data-target="${h.id}" title="Wochenziel aendern">${weekDone ? "✓ " : ""}${doneCount}/${target}</button></div>
          <div class="habit-days">${cells}</div>
          <button type="button" class="habit-remove" data-remove="${h.id}" aria-label="Entfernen">×</button>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(
      habitViews.week,
      `<div class="habit-row habit-header-row"><div class="habit-label"></div><div class="habit-days">${headerCells}</div><span></span></div>${rows}`
    );

    wireDaycellClicks(habitViews.week);
    habitViews.week.querySelectorAll(".habit-remove").forEach((btn) => {
      btn.addEventListener("click", () => removeHabit(btn.dataset.remove));
    });
    habitViews.week.querySelectorAll(".habit-count[data-target]").forEach((btn) => {
      btn.addEventListener("click", () => editHabitTarget(btn.dataset.target));
    });
  }

  function renderHabitMonth() {
    const year = habitMonthRef.getFullYear();
    const month = habitMonthRef.getMonth();
    const monthLabel = habitMonthRef.toLocaleDateString("de-DE", { month: "long", year: "numeric" });
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1);
    const leadingBlanks = (firstDay.getDay() || 7) - 1;
    const todayK = dateKey(new Date());

    const nav = `<div class="habit-month-nav">
      <button type="button" id="habitMonthPrev">‹</button>
      <span>${monthLabel}</span>
      <button type="button" id="habitMonthNext">›</button>
    </div>`;

    const rows = habitState.habits
      .map((h, idx) => {
        const blanks = Array.from({ length: leadingBlanks }, () => `<span class="habit-daycell blank"></span>`).join("");
        const cells = Array.from({ length: daysInMonth }, (_, i) => {
          const d = new Date(year, month, i + 1);
          const key = dateKey(d);
          const done = !!habitState.log[key]?.[h.id];
          return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
        }).join("");
        return `<div class="habit-month-row">
          <div class="habit-month-title">${escapeHtml(h.label)}</div>
          <div class="habit-month-grid">${blanks}${cells}</div>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(habitViews.month, `${nav}${rows}`);

    const monthEl = habitViews.month;
    monthEl.querySelector("#habitMonthPrev")?.addEventListener("click", () => {
      habitMonthRef.setMonth(habitMonthRef.getMonth() - 1);
      renderHabits();
    });
    monthEl.querySelector("#habitMonthNext")?.addEventListener("click", () => {
      habitMonthRef.setMonth(habitMonthRef.getMonth() + 1);
      renderHabits();
    });
    wireDaycellClicks(monthEl);
  }

  function buildYearWeeks(year) {
    const start = mondayOf(new Date(year, 0, 1));
    const end = new Date(year, 11, 31);
    const weeks = [];
    let cur = new Date(start);
    while (cur <= end) {
      const week = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(cur);
        d.setDate(d.getDate() + i);
        return d.getFullYear() === year ? d : null;
      });
      weeks.push(week);
      cur.setDate(cur.getDate() + 7);
    }
    return weeks;
  }

  function renderHabitYear() {
    const weeks = buildYearWeeks(habitYearRef);
    const todayK = dateKey(new Date());

    const nav = `<div class="habit-year-nav">
      <button type="button" id="habitYearPrev">‹</button>
      <span>${habitYearRef}</span>
      <button type="button" id="habitYearNext">›</button>
    </div>`;

    let lastMonth = -1;
    const monthLabels = weeks
      .map((week) => {
        const firstReal = week.find(Boolean);
        const m = firstReal ? firstReal.getMonth() : lastMonth;
        const label = firstReal && m !== lastMonth ? firstReal.toLocaleDateString("de-DE", { month: "short" }) : "";
        lastMonth = m;
        return `<span>${label}</span>`;
      })
      .join("");

    const rows = habitState.habits
      .map((h, idx) => {
        const cells = weeks
          .map((week) =>
            week
              .map((d) => {
                if (!d) return `<span class="habit-daycell blank"></span>`;
                const key = dateKey(d);
                const done = !!habitState.log[key]?.[h.id];
                return daycellHtml({ habitId: h.id, key, done, today: key === todayK, colorIdx: idx });
              })
              .join("")
          )
          .join("");
        return `<div class="habit-year-row">
          <div class="habit-year-title">${escapeHtml(h.label)}</div>
          <div class="habit-year-scroll">
            <div class="habit-year-months">${monthLabels}</div>
            <div class="habit-year-grid">${cells}</div>
          </div>
        </div>`;
      })
      .join("");

    renderHabitEmptyOr(habitViews.year, `${nav}${rows}`);

    const yearEl = habitViews.year;
    yearEl.querySelector("#habitYearPrev")?.addEventListener("click", () => {
      habitYearRef -= 1;
      renderHabits();
    });
    yearEl.querySelector("#habitYearNext")?.addEventListener("click", () => {
      habitYearRef += 1;
      renderHabits();
    });
    wireDaycellClicks(yearEl);
  }

  function renderHabits() {
    if (habitView === "week") renderHabitWeek();
    else if (habitView === "month") renderHabitMonth();
    else renderHabitYear();
  }

  renderHabits();
  setHabitSyncStatus(localStorage.getItem("dashboard-gh-token") ? "idle" : "local-only");
  fetchRemoteHabits();

  // ---------- Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben ----------
  // Gleiches Prinzip wie beim Habit-Tracker weiter oben (GitHub Contents API, Zeitstempel-
  // basiertes "neuerer Stand gewinnt komplett" statt additivem Merge), nur in einer eigenen
  // Datei gebuendelt, da es vier kleine, unabhaengige Felder statt eines einzelnen Zustands
  // sind. Lesen beim Laden geht ohne Token (oeffentliche Datei ueber GitHub Pages), Schreiben
  // laeuft am selben "Sync"-Klick mit wie Habit-Tracker und Business-Daten.
  const SYNC_DATA_REMOTE_FILE = "sync-data.json";
  let syncDataCloudSha = null;

  async function pushSyncDataToCloud(config) {
    config = config || getGithubConfig();
    if (!config) return;
    // Vor dem Push erst den aktuellen Cloud-Stand ziehen (mit denselben Sicherheitsregeln
    // wie beim Laden, siehe applyRemote* unten): falls ein anderes Geraet zwischenzeitlich
    // einen echt neueren UND inhaltlich nicht-leeren Stand gepusht hat, den zuerst
    // uebernehmen. Sonst kann ein Push blind einen neueren Cloud-Stand ueberschreiben.
    await fetchRemoteSyncData();
    // -1 ist nur ein interner Marker fuer "noch nie lokal gespeichert" (siehe load*State()-
    // Funktionen) und wuerde extern nur verwirren - beim Export auf 0 normalisieren.
    const clampedAt = (v) => Math.max(0, v);
    const ideas = {};
    Object.keys(ideaTextareas).forEach((key) => {
      const state = loadIdeaState(key);
      ideas[key] = { text: state.text, updatedAt: clampedAt(state.updatedAt) };
    });
    const studium = loadStudiumDeadline();
    const studiumDeadline = { label: studium.label, date: studium.date, updatedAt: clampedAt(studium.updatedAt) };
    const todosState = loadTodosState();
    const tasksState = loadTasksState();
    const payload = {
      ideas,
      studiumDeadline,
      todos: { date: todayKey(), items: todosState.items, updatedAt: clampedAt(todosState.updatedAt) },
      tasks: { items: tasksState.items, updatedAt: clampedAt(tasksState.updatedAt) }
    };
    const apiUrl = `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${SYNC_DATA_REMOTE_FILE}`;
    const headers = { Authorization: `Bearer ${config.token}`, Accept: "application/vnd.github+json" };
    try {
      if (!syncDataCloudSha) {
        const getRes = await fetch(apiUrl, { headers });
        if (getRes.ok) syncDataCloudSha = (await getRes.json()).sha;
      }
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))));
      const putRes = await fetch(apiUrl, {
        method: "PUT",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Sync-Daten Update", content, ...(syncDataCloudSha ? { sha: syncDataCloudSha } : {}) })
      });
      if (putRes.ok) {
        syncDataCloudSha = (await putRes.json()).content?.sha || syncDataCloudSha;
      } else if (putRes.status === 401 || putRes.status === 403) {
        localStorage.removeItem("dashboard-gh-token");
        console.warn("Cloud-Sync (Video-Ideen/Studium/To-Do/Aufgaben) fehlgeschlagen: Token ungültig oder ohne 'Contents'-Berechtigung.");
      } else if (putRes.status === 409) {
        syncDataCloudSha = null; // jemand anders hat parallel geschrieben — sha neu holen beim naechsten Versuch
      } else {
        console.warn(`Cloud-Sync (Video-Ideen/Studium/To-Do/Aufgaben) fehlgeschlagen: Status ${putRes.status}`);
      }
    } catch (err) {
      console.warn("Cloud-Sync (Video-Ideen/Studium/To-Do/Aufgaben) fehlgeschlagen:", err.message);
    }
  }

  function applyRemoteIdeas(remoteIdeas) {
    if (!remoteIdeas) return;
    Object.entries(remoteIdeas).forEach(([key, remoteIdea]) => {
      const textarea = ideaTextareas[key];
      if (!textarea) return;
      const local = loadIdeaState(key);
      const remoteUpdatedAt = typeof remoteIdea?.updatedAt === "number" ? remoteIdea.updatedAt : 0;
      const remoteText = remoteIdea.text || "";
      if (remoteWins(remoteUpdatedAt, local.updatedAt, !!remoteText.trim(), !!local.text.trim())) {
        const merged = { text: remoteText, updatedAt: remoteUpdatedAt };
        localStorage.setItem(`dashboard-idea-${key}`, JSON.stringify(merged));
        textarea.value = merged.text;
      }
    });
  }

  function applyRemoteStudium(remoteStudium) {
    if (!remoteStudium) return;
    const local = loadStudiumDeadline();
    const remoteUpdatedAt = typeof remoteStudium.updatedAt === "number" ? remoteStudium.updatedAt : 0;
    if (remoteWins(remoteUpdatedAt, local.updatedAt, !!remoteStudium.date, !!local.date)) {
      const merged = { label: remoteStudium.label || "", date: remoteStudium.date || "", updatedAt: remoteUpdatedAt };
      localStorage.setItem(STUDIUM_STORAGE_KEY, JSON.stringify(merged));
      refreshStudiumCard();
    }
  }

  const todosHaveContent = (items) => TODO_CATEGORIES.some((c) => (items?.[c.id]?.length || 0) > 0);

  function applyRemoteTodos(remoteTodos) {
    // Andere/aeltere Tagesdaten aus der Cloud ignorieren — der taegliche Reset laeuft
    // ueber den datumsbasierten Storage-Key ohnehin lokal von selbst.
    if (!remoteTodos || remoteTodos.date !== todayKey()) return;
    const localState = loadTodosState();
    const remoteUpdatedAt = typeof remoteTodos.updatedAt === "number" ? remoteTodos.updatedAt : 0;
    if (remoteWins(remoteUpdatedAt, localState.updatedAt, todosHaveContent(remoteTodos.items), todosHaveContent(localState.items))) {
      todos = remoteTodos.items || {};
      saveTodos(todos);
      renderTodos();
    }
  }

  function applyRemoteTasks(remoteTasks) {
    if (!remoteTasks) return;
    const localState = loadTasksState();
    const remoteUpdatedAt = typeof remoteTasks.updatedAt === "number" ? remoteTasks.updatedAt : 0;
    const remoteItems = remoteTasks.items || [];
    if (remoteWins(remoteUpdatedAt, localState.updatedAt, remoteItems.length > 0, localState.items.length > 0)) {
      tasks = remoteItems;
      saveTasks(tasks);
      renderTasks();
    }
  }

  async function fetchRemoteSyncData() {
    try {
      const res = await fetch(SYNC_DATA_REMOTE_FILE, { cache: "no-store" });
      if (!res.ok) return;
      const remote = await res.json();
      applyRemoteIdeas(remote.ideas);
      applyRemoteStudium(remote.studiumDeadline);
      applyRemoteTodos(remote.todos);
      applyRemoteTasks(remote.tasks);
    } catch (err) {
      /* offline, file:// geöffnet, oder Datei existiert noch nicht — lokaler Stand bleibt gültig */
    }
  }
  fetchRemoteSyncData();

  // ---------- Google Kalender ----------
  // Laeuft komplett im Browser (kein Backend noetig, passt zum Rest des Dashboards):
  // Google Identity Services (GIS, aus dem <script>-Tag in index.html) fuer den OAuth2-
  // Token-Client, Google Calendar API direkt per fetch() mit dem erhaltenen Access-Token.
  // Der Access-Token lebt nur ~1 Std und wird bewusst NICHT automatisch im Hintergrund
  // erneuert (das wuerde einen Popup-Aufruf ohne Nutzer-Klick brauchen, was Browser meist
  // blockieren) - stattdessen einfach erneut auf "Kalender verbinden" klicken, wenn eine
  // Anfrage mit 401 fehlschlaegt. Einrichtung siehe README, Abschnitt "Google Kalender".
  const GCAL_SCOPE = "https://www.googleapis.com/auth/calendar.events";
  const GCAL_TOKEN_KEY = "dashboard-gcal-token";
  const GCAL_CLIENT_ID_KEY = "dashboard-gcal-clientid";
  const GCAL_CALENDAR_ID_KEY = "dashboard-gcal-calendarid";

  let gcalTokenClient = null;
  let gcalAccessToken = null;
  let gcalCalendarId = data.googleCalendar?.calendarId || localStorage.getItem(GCAL_CALENDAR_ID_KEY) || null;

  const calendarConnectState = document.getElementById("calendarConnectState");
  const calendarConnectHint = document.getElementById("calendarConnectHint");
  const calendarConnectedState = document.getElementById("calendarConnectedState");
  const calendarConnectBtn = document.getElementById("calendarConnectBtn");
  const calendarEventList = document.getElementById("calendarEventList");
  const calendarQuickAddInput = document.getElementById("calendarQuickAddInput");
  const calendarQuickAddBtn = document.getElementById("calendarQuickAddBtn");
  const calendarSyncStatusEl = document.getElementById("calendarSyncStatus");
  const calendarDateLabelEl = document.getElementById("calendarDateLabel");
  const calendarOpenFullBtn = document.getElementById("calendarOpenFullBtn");
  const calendarOverlay = document.getElementById("calendarOverlay");
  const calendarEmbedFrame = document.getElementById("calendarEmbedFrame");
  const calendarModalCloseBtn = document.getElementById("calendarModalCloseBtn");

  if (calendarDateLabelEl) {
    calendarDateLabelEl.textContent = now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" });
  }

  function setCalendarStatus(state, detail) {
    if (!calendarSyncStatusEl) return;
    const time = new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const map = {
      loading: "⏳ Lade Termine…",
      ok: `☁️ Aktualisiert · ${time}`,
      error: `⚠️ Fehler${detail ? " — " + detail : ""}`
    };
    calendarSyncStatusEl.textContent = map[state] || "";
  }

  function showCalendarConnected(show) {
    if (calendarConnectState) calendarConnectState.hidden = show;
    if (calendarConnectedState) calendarConnectedState.hidden = !show;
  }

  function loadCachedGcalToken() {
    try {
      const raw = localStorage.getItem(GCAL_TOKEN_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // 30s Sicherheitsmarge, damit ein Request nicht mitten in der Ausfuehrung abläuft
      if (typeof parsed.expiresAt === "number" && parsed.expiresAt > Date.now() + 30000) return parsed;
    } catch (e) {
      /* corrupted storage, fall back to null */
    }
    return null;
  }
  function saveGcalToken(accessToken, expiresInSeconds) {
    const state = { access_token: accessToken, expiresAt: Date.now() + expiresInSeconds * 1000 };
    localStorage.setItem(GCAL_TOKEN_KEY, JSON.stringify(state));
    return state;
  }

  function getGcalClientId() {
    let clientId = data.googleCalendar?.clientId || localStorage.getItem(GCAL_CLIENT_ID_KEY) || "";
    if (!clientId) {
      const input = prompt(
        "Google OAuth Client-ID für den Kalender (siehe README, Abschnitt \"Google Kalender\" für die Einrichtung):"
      );
      if (!input) return null;
      clientId = input.trim();
      localStorage.setItem(GCAL_CLIENT_ID_KEY, clientId);
    }
    return clientId;
  }

  async function gcalFetch(path, options) {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, {
      ...options,
      headers: { ...((options && options.headers) || {}), Authorization: `Bearer ${gcalAccessToken}` }
    });
    if (res.status === 401) {
      // Token abgelaufen/ungueltig — lokal verwerfen, UI faellt zurueck auf "Verbinden".
      localStorage.removeItem(GCAL_TOKEN_KEY);
      gcalAccessToken = null;
      showCalendarConnected(false);
    }
    return res;
  }

  async function resolveCalendarId() {
    if (gcalCalendarId) return gcalCalendarId;
    try {
      const res = await gcalFetch("calendars/primary");
      if (res.ok) {
        const cal = await res.json();
        gcalCalendarId = cal.id;
        localStorage.setItem(GCAL_CALENDAR_ID_KEY, gcalCalendarId);
      }
    } catch (e) {
      /* Embed-Link bleibt dann leer, bis data.googleCalendar.calendarId gesetzt wird */
    }
    return gcalCalendarId;
  }

  function renderCalendarEvents(events) {
    if (!calendarEventList) return;
    calendarEventList.innerHTML = events.length
      ? events
          .map((ev) => {
            const title = escapeHtml(ev.summary || "(ohne Titel)");
            const timeLabel = ev.start?.dateTime
              ? new Date(ev.start.dateTime).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
              : "Ganztägig";
            return `<li class="todo-item">
              <span class="calendar-event-time">${timeLabel}</span>
              <span>${title}</span>
              ${ev.htmlLink ? `<a class="link-button-inline" href="${ev.htmlLink}" target="_blank" rel="noopener">Öffnen</a>` : ""}
            </li>`;
          })
          .join("")
      : `<li class="todo-empty">Keine Termine heute.</li>`;
  }

  async function fetchTodayEvents() {
    if (!gcalAccessToken) return;
    setCalendarStatus("loading");
    try {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date();
      end.setHours(23, 59, 59, 999);
      const params = new URLSearchParams({
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: "true",
        orderBy: "startTime",
        maxResults: "20"
      });
      const res = await gcalFetch(`calendars/${encodeURIComponent(gcalCalendarId || "primary")}/events?${params}`);
      if (!res.ok) throw new Error(`Status ${res.status}`);
      const payload = await res.json();
      renderCalendarEvents(payload.items || []);
      setCalendarStatus("ok");
    } catch (err) {
      setCalendarStatus("error", err.message);
    }
  }

  async function quickAddEvent(text) {
    if (!gcalAccessToken || !text.trim()) return;
    try {
      const res = await gcalFetch(
        `calendars/${encodeURIComponent(gcalCalendarId || "primary")}/events/quickAdd?text=${encodeURIComponent(text.trim())}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error(`Status ${res.status}`);
      calendarQuickAddInput.value = "";
      await fetchTodayEvents();
    } catch (err) {
      setCalendarStatus("error", err.message);
    }
  }
  calendarQuickAddBtn?.addEventListener("click", () => quickAddEvent(calendarQuickAddInput.value));
  calendarQuickAddInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") quickAddEvent(calendarQuickAddInput.value);
  });

  function ensureGcalTokenClient(clientId) {
    if (gcalTokenClient) return gcalTokenClient;
    if (!window.google?.accounts?.oauth2) return null;
    gcalTokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GCAL_SCOPE,
      callback: async (resp) => {
        if (resp.error) {
          setCalendarStatus("error", resp.error);
          return;
        }
        gcalAccessToken = resp.access_token;
        saveGcalToken(resp.access_token, resp.expires_in);
        showCalendarConnected(true);
        await resolveCalendarId();
        await fetchTodayEvents();
      }
    });
    return gcalTokenClient;
  }

  calendarConnectBtn?.addEventListener("click", () => {
    const clientId = getGcalClientId();
    if (!clientId) return;
    const client = ensureGcalTokenClient(clientId);
    if (!client) {
      alert("Google-Anmeldedienst ist noch nicht geladen — bitte kurz warten und nochmal klicken.");
      return;
    }
    client.requestAccessToken({ prompt: "consent" });
  });

  calendarOpenFullBtn?.addEventListener("click", async () => {
    const calId = await resolveCalendarId();
    if (!calId) {
      alert('Kalender-ID noch nicht bekannt — erst auf "Kalender verbinden" klicken, oder googleCalendar.calendarId in data.js eintragen.');
      return;
    }
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    calendarEmbedFrame.src = `https://calendar.google.com/calendar/embed?src=${encodeURIComponent(calId)}&ctz=${encodeURIComponent(tz)}`;
    calendarOverlay.classList.add("open");
  });
  calendarModalCloseBtn?.addEventListener("click", () => calendarOverlay.classList.remove("open"));
  calendarOverlay?.addEventListener("click", (e) => {
    if (e.target === calendarOverlay) calendarOverlay.classList.remove("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && calendarOverlay?.classList.contains("open")) calendarOverlay.classList.remove("open");
  });

  // Beim Laden: nur einsteigen, wenn schon ein gueltiger (nicht abgelaufener) Token
  // gecacht ist — bewusst KEIN automatischer Popup-Versuch ohne Klick, den wuerden die
  // meisten Browser ohnehin als ungewollten Popup blockieren.
  (function initGoogleCalendarOnLoad() {
    const cached = loadCachedGcalToken();
    if (!cached) {
      if (!data.googleCalendar?.clientId && !localStorage.getItem(GCAL_CLIENT_ID_KEY) && calendarConnectHint) {
        calendarConnectHint.textContent = 'Noch nicht eingerichtet — siehe README, Abschnitt "Google Kalender".';
      }
      return;
    }
    gcalAccessToken = cached.access_token;
    showCalendarConnected(true);
    resolveCalendarId().then(fetchTodayEvents);
  })();

  // ---------- PWA: Service Worker registrieren ----------
  // Ermöglicht "Zum Homescreen hinzufügen" auf dem Handy. Schlägt lautlos fehl bei
  // lokalem file://-Öffnen (Service Worker brauchen http/https) — kein Problem, der
  // Rest des Dashboards funktioniert davon unabhängig.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker nicht registriert:", err.message));
  }
})();
