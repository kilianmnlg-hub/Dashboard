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

    // Habit-Tracker-Stand läuft am selben Klick mit hoch (Contents API, kein Workflow nötig —
    // sofort fertig, nicht Teil des "läuft 15-30s"-Hinweises unten).
    pushHabitsToCloud(config);

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
        <div class="goal-values">
          <span class="goal-current">${fmtDE.format(goal.current)} ${goal.unit}</span>
          <span>Ziel: ${fmtDE.format(goal.target)} ${goal.unit}</span>
        </div>
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="goal-meta">
          <span class="goal-pct">${pct.toFixed(1)}%</span>
          <span>${dueLabel}</span>
        </div>
        ${trend !== null ? `<p class="goal-trend">${renderTrendBadge(trend, goal.unit)}</p>` : ""}
      `;
    }
    goalsGrid.appendChild(card);
  });

  // ---------- Studium-Countdown (nächste Prüfung/Abgabe) ----------
  // Bewusst klein und nur lokal (localStorage) — kein neuer "Privat"-Bereich, nur ein
  // einzelner editierbarer Termin als kompakte Karte in der Ziele-Sektion.
  const STUDIUM_STORAGE_KEY = "dashboard-studium-deadline";
  const loadStudiumDeadline = () => {
    try {
      const raw = localStorage.getItem(STUDIUM_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    return { label: "", date: "" };
  };
  const saveStudiumDeadline = (d) => localStorage.setItem(STUDIUM_STORAGE_KEY, JSON.stringify(d));

  function renderStudiumCard() {
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
      goalsGrid.removeChild(card);
      renderStudiumCard();
    });

    goalsGrid.appendChild(card);
  }
  renderStudiumCard();

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
      const storageKey = `dashboard-idea-${key}`;
      const textarea = card.querySelector(`#idea-${key}`);
      const savedTag = card.querySelector(`#idea-saved-${key}`);
      textarea.value = localStorage.getItem(storageKey) || "";

      let saveTimer;
      textarea.addEventListener("input", () => {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
          localStorage.setItem(storageKey, textarea.value);
          savedTag.classList.add("show");
          setTimeout(() => savedTag.classList.remove("show"), 1500);
        }, 500);
      });
    }
  });

  // ---------- Time tracker ----------
  const tt = data.timeTracker;
  document.getElementById("timeRangeLabel").textContent = `${fmtDate(tt.range.from)} – ${fmtDate(tt.range.to)} · Quelle: ${tt.source}`;

  const toHours = (min) => min / 60;
  const totalMinutes = Object.values(tt.totalsByCategory).reduce((a, b) => a + b, 0);

  const timeSummary = document.getElementById("timeSummary");
  const categoryColors = { YouTube: "var(--accent-bricks)", Bricklink: "var(--accent-bricklink)" };
  timeSummary.innerHTML =
    Object.entries(tt.totalsByCategory)
      .map(
        ([cat, min]) => `
      <div class="time-stat">
        <div class="time-stat-value" style="color:${categoryColors[cat] || "var(--text)"}">${toHours(min).toFixed(1)} h</div>
        <div class="time-stat-label">${cat} (${((min / totalMinutes) * 100).toFixed(0)}%)</div>
      </div>`
      )
      .join("") +
    `<div class="time-stat">
      <div class="time-stat-value">${toHours(totalMinutes).toFixed(1)} h</div>
      <div class="time-stat-label">Gesamt erfasst</div>
    </div>`;

  document.getElementById("chartLegend").innerHTML = Object.keys(tt.totalsByCategory)
    .map((cat) => `<span><span class="legend-dot" style="background:${categoryColors[cat]}"></span>${cat}</span>`)
    .join("");

  renderChart(tt.daily, categoryColors);

  function renderChart(daily, colors) {
    const svg = document.getElementById("timeChart");
    const W = 800;
    const H = 220;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const categories = Object.keys(colors);
    const maxTotal = Math.max(
      1,
      ...daily.map((d) => categories.reduce((sum, c) => sum + (d[c] || 0), 0))
    );

    const padLeft = 34;
    const padBottom = 24;
    const chartH = H - padBottom - 10;
    const barSlot = (W - padLeft) / daily.length;
    const barWidth = Math.min(34, barSlot * 0.55);

    let svgContent = "";

    // gridlines
    const gridSteps = 4;
    for (let i = 0; i <= gridSteps; i++) {
      const y = 10 + (chartH / gridSteps) * i;
      const hoursLabel = (toHours(maxTotal) * (1 - i / gridSteps)).toFixed(0);
      svgContent += `<line x1="${padLeft}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
      svgContent += `<text x="0" y="${y + 4}" font-size="10" fill="var(--text-faint)">${hoursLabel}h</text>`;
    }

    daily.forEach((d, i) => {
      const x = padLeft + i * barSlot + (barSlot - barWidth) / 2;
      let yCursor = 10 + chartH;
      categories.forEach((cat) => {
        const val = d[cat] || 0;
        const barH = (val / maxTotal) * chartH;
        yCursor -= barH;
        if (val > 0) {
          svgContent += `<rect x="${x}" y="${yCursor}" width="${barWidth}" height="${barH}" rx="3" fill="${colors[cat]}"><title>${cat}: ${toHours(val).toFixed(1)}h</title></rect>`;
        }
      });
      const label = new Date(d.date + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short" });
      svgContent += `<text x="${x + barWidth / 2}" y="${H - 4}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${label}</text>`;
    });

    svg.innerHTML = svgContent;
  }

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
    const svg = document.getElementById(svgId);
    const W = 800;
    const H = 160;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);

    const maxTotal = Math.max(1, ...entries.map((e) => e.total));
    const padLeft = 42;
    const padBottom = 22;
    const chartH = H - padBottom - 10;
    const barSlot = (W - padLeft) / entries.length;
    const barWidth = Math.min(40, barSlot * 0.55);

    let svgContent = "";
    const gridSteps = 3;
    for (let i = 0; i <= gridSteps; i++) {
      const y = 10 + (chartH / gridSteps) * i;
      const valueLabel = Math.round(maxTotal * (1 - i / gridSteps));
      svgContent += `<line x1="${padLeft}" y1="${y}" x2="${W}" y2="${y}" stroke="var(--border)" stroke-width="1" />`;
      svgContent += `<text x="0" y="${y + 4}" font-size="10" fill="var(--text-faint)">${valueLabel}${currency === "EUR" ? "€" : ""}</text>`;
    }

    entries.forEach((e, i) => {
      const key = e[keyField];
      const x = padLeft + i * barSlot + (barSlot - barWidth) / 2;
      const barH = (e.total / maxTotal) * chartH;
      const y = 10 + chartH - barH;
      svgContent += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barH}" rx="3" fill="var(--accent-bricklink)"><title>${formatTooltip(key)}: ${e.total.toFixed(2)} ${currency} (${e.orderCount} Bestellungen)</title></rect>`;
      svgContent += `<text x="${x + barWidth / 2}" y="${H - 4}" font-size="10" fill="var(--text-faint)" text-anchor="middle">${formatLabel(key)}</text>`;
    });

    svg.innerHTML = svgContent;
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

  const loadTodos = () => {
    try {
      const raw = localStorage.getItem(TODO_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    const empty = {};
    TODO_CATEGORIES.forEach((c) => (empty[c.id] = []));
    return empty;
  };
  const saveTodos = (todos) => localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(todos));

  let todos = loadTodos();
  const todoGrid = document.getElementById("todoGrid");
  document.getElementById("todoDateLabel").textContent = `Setzt sich täglich automatisch zurück · ${now.toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long" })}`;

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

  const loadTasks = () => {
    try {
      const raw = localStorage.getItem(TASKS_STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* corrupted storage, fall back to empty */
    }
    return [];
  };
  const saveTasks = (tasks) => localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));

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
    { id: "gym", label: "Gym" },
    { id: "rauchfrei", label: "Rauchfreier Tag" },
    { id: "koffein", label: "<2x Koffein" }
  ];

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
      if (raw) return JSON.parse(raw);
    } catch (e) {
      /* corrupted storage, fall back to defaults */
    }
    return { habits: HABIT_DEFAULTS.map((h) => ({ ...h })), log: {} };
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

  function mergeHabitState(local, remote) {
    const byId = new Map();
    [...(remote.habits || []), ...(local.habits || [])].forEach((h) => byId.set(h.id, h));
    const mergedLog = {};
    [remote.log || {}, local.log || {}].forEach((log) => {
      Object.entries(log).forEach(([date, entries]) => {
        mergedLog[date] = { ...(mergedLog[date] || {}), ...entries };
      });
    });
    return { habits: Array.from(byId.values()), log: mergedLog };
  }

  async function fetchRemoteHabits() {
    try {
      const res = await fetch(HABIT_REMOTE_FILE, { cache: "no-store" });
      if (!res.ok) return;
      const remote = await res.json();
      habitState = mergeHabitState(habitState, remote);
      localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));
      renderHabits();
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
      if (!habitCloudSha) {
        const getRes = await fetch(apiUrl, { headers });
        if (getRes.ok) habitCloudSha = (await getRes.json()).sha;
      }
      const content = btoa(unescape(encodeURIComponent(JSON.stringify(habitState, null, 2))));
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

  const saveHabitState = () => localStorage.setItem(HABIT_STORAGE_KEY, JSON.stringify(habitState));

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
    habitState.habits.push({ id: newId(), label });
    saveHabitState();
    habitNewInput.value = "";
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
        return `<div class="habit-row">
          <div class="habit-label">${escapeHtml(h.label)}<span class="habit-count">${doneCount}/7</span></div>
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

  // ---------- PWA: Service Worker registrieren ----------
  // Ermöglicht "Zum Homescreen hinzufügen" auf dem Handy. Schlägt lautlos fehl bei
  // lokalem file://-Öffnen (Service Worker brauchen http/https) — kein Problem, der
  // Rest des Dashboards funktioniert davon unabhängig.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker nicht registriert:", err.message));
  }
})();
