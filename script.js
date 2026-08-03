(function () {
  const data = window.DASHBOARD_DATA;
  const fmtDE = new Intl.NumberFormat("de-DE");
  const fmtDate = (iso) =>
    new Date(iso + "T00:00:00").toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    });

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
        "GitHub Personal Access Token (fine-grained, nur 'Actions: Read and write' für dieses Repo). " +
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
    bricklink: "var(--accent-bricklink)"
  };

  const daysUntil = (iso) => {
    const due = new Date(iso + "T00:00:00");
    const diff = Math.ceil((due - now) / 86400000);
    return diff;
  };

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
      `;
    }
    goalsGrid.appendChild(card);
  });

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
    document.getElementById("revenueWeeklyRangeLabel").textContent = `${first} – ${last} · pro Kalenderwoche`;
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
  const escapeHtml = (str) => {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  };
  const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

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

  // ---------- PWA: Service Worker registrieren ----------
  // Ermöglicht "Zum Homescreen hinzufügen" auf dem Handy. Schlägt lautlos fehl bei
  // lokalem file://-Öffnen (Service Worker brauchen http/https) — kein Problem, der
  // Rest des Dashboards funktioniert davon unabhängig.
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch((err) => console.warn("Service Worker nicht registriert:", err.message));
  }
})();
