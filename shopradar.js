/* Shop-Radar (Bricklink): Ausklappmenue in der Karte "Bricklink Store". Zeigt, warum der Shop laeuft oder nicht: feste Regeln (keine Schaetzung) ueber
   Umsatz, Bestellungen, Ø Warenkorb und die Bricklink-Zeit aus dem Zeittracker, dazu das Lager (Lots, Lagerwert, Alter, neu eingestellt), das Wochenziel
   fuer neue Teile (aus dem Jahresziel "Bricklink-Teile" abgeleitet), die Bestseller je Monat, einen Rabattvorschlag mit den zehn Ladenhuetern und den Preis-Check
   (Teile und Minifiguren mit starker Abweichung vom 6-Monats-Schnitt), jeweils mit Bild und Teilenummer. Alles kommt aus Zahlen, die der Sync ohnehin holt (data.bricklinkRevenue, data.bricklinkInventory, data.bricklinkSales und data.bricklinkPrices,
   siehe scripts/fetchers/bricklink.mjs und scripts/lib/inventory.mjs, sales.mjs, pricecheck.mjs) und aus dem Zeittracker. Von Kaeufern wird nichts gespeichert; die
   drei Artikellisten enthalten nur Artikeldaten. Bilder: die kleinen Vorschaubilder von Bricklink (img.bricklink.com), direkt eingebunden.
   Gespeichert wird hier nichts; auf/zu und die Erklaerung merkt sich nur dieser Browser, die Auswahl der Monate und Reiter gilt bis zum Neuladen.
   compute() ist eine reine Funktion (ohne Seite), damit sie sich separat pruefen laesst: window.ShopRadarCalc.compute. */
(function () {
  const DAY = 86400000, WEEKS = 9, XP_WEEK = 15;
  const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const MON_SHORT = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
  const LEVEL_RANK = { bad: 0, warn: 1, info: 2, ok: 3 };
  // Artikeltyp der Bricklink-API -> Buchstabe in den Adressen von Bild und Katalogseite; Beschriftung fuer alles ausser Teilen
  const TYPE_KEY = { PART: "P", SET: "S", MINIFIG: "M", GEAR: "G", BOOK: "B", CATALOG: "C", INSTRUCTION: "I", ORIGINAL_BOX: "O" };
  const TYPE_LABEL = { SET: "Set", MINIFIG: "Minifigur", GEAR: "Gear", BOOK: "Buch", CATALOG: "Katalog", INSTRUCTION: "Anleitung", ORIGINAL_BOX: "Originalbox", UNSORTED_LOT: "Gemischtes Lot" };
  const isNum = (v) => typeof v === "number" && isFinite(v);
  const pad = (n) => String(n).padStart(2, "0");
  const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const utc = (s) => { const [y, m, d] = s.split("-").map(Number); return Date.UTC(y, m - 1, d); };
  const addDaysKey = (key, n) => new Date(utc(key) + n * DAY).toISOString().slice(0, 10);
  const mondayKey = (d) => { const c = new Date(d.getFullYear(), d.getMonth(), d.getDate()); c.setDate(c.getDate() + (c.getDay() === 0 ? -6 : 1 - c.getDay())); return keyOf(c); };
  const de = (n, dec) => n.toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const eur0 = (n) => `${de(Math.round(n), 0)} €`;
  const eur2 = (n) => `${de(n, 2)} €`;
  // Preise von Teilen sind oft kleiner als ein Euro: bis zu drei Stellen
  const price = (n) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: n < 1 ? 3 : 2 })} €`;
  const one = (n) => de(Math.round(n * 10) / 10, 1);
  const sum = (arr, f) => arr.reduce((s, x) => s + f(x), 0);
  // Veraenderung in Prozent mit echtem Minuszeichen: +12 %, −44 %
  const pct = (a, b) => { const p = Math.round((a / b - 1) * 100); return (p > 0 ? "+" : p < 0 ? "−" : "") + Math.abs(p) + " %"; };
  const dm = (key) => `${+key.slice(8, 10)}.${+key.slice(5, 7)}.`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Die API liefert Artikelnamen mit HTML-Zeichen (z.B. &#40; fuer eine Klammer): erst entschluesseln (als reiner Text), beim Ausgeben wieder maskieren
  const decode = (s) => { const t = document.createElement("textarea"); t.innerHTML = String(s); return t.value; };
  const imgUrl = (t, no, color) => { const k = TYPE_KEY[t]; return k && no ? `https://img.bricklink.com/ItemImage/${k}T/${t === "PART" ? color || 0 : 0}/${encodeURIComponent(no)}.t1.png` : ""; };
  const pageUrl = (t, no, color) => { const k = TYPE_KEY[t]; return k && no ? `https://www.bricklink.com/v2/catalog/catalogitem.page?${k}=${encodeURIComponent(no)}${t === "PART" && color ? `&C=${color}` : ""}` : ""; };
  // Alter in Tagen als "2 J. 4 Mon."
  const ageText = (days) => { const y = Math.floor(days / 365), m = Math.floor((days % 365) / 30); return y > 0 ? `${y} J.${m ? ` ${m} Mon.` : ""}` : `${Math.max(1, m)} Mon.`; };

  /* ---------- Jahresziel Teile und Wochenziel ---------- */
  // Das Jahresziel ("Bricklink-Teile": Gesamtzahl der Teile im Shop bis zum Stichtag) wird auf die Wochen verteilt: Wochenziel = was bis zum Jahresende noch fehlt
  // (ohne die Teile, die in dieser Woche schon eingestellt wurden), geteilt durch die Wochen ab dieser Woche. Das Ziel bleibt so waehrend der Woche stehen und
  // passt sich von Woche zu Woche an. Verkaeufe sind nicht eingerechnet. Fuer vergangene Wochen wird derselbe Wert zurueckgerechnet (Serie).
  function buildPlan(inv, yg, now, curKey) {
    if (!inv || !yg || !isNum(yg.target) || !(yg.target > 0)) return null;
    const wl = (Array.isArray(inv.weekly) ? inv.weekly : []).filter((w) => w && typeof w.weekStart === "string").sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1));
    if (!wl.length || !wl.every((w) => isNum(w.parts))) return null;   // aeltere Daten ohne Teile je Woche: kommen mit dem naechsten Sync
    const total = isNum(inv.parts) ? inv.parts + (isNum(inv.stockroomParts) ? inv.stockroomParts : 0) : isNum(yg.current) ? yg.current : null;
    if (total === null) return null;
    const today = keyOf(now), T = yg.target;
    const yearEnd = typeof yg.due === "string" && /^\d{4}-\d{2}-\d{2}$/.test(yg.due) && yg.due >= today ? yg.due : `${now.getFullYear()}-12-31`;
    const weeksFrom = (key) => Math.max(1, Math.ceil(((utc(yearEnd) - utc(key)) / DAY + 1) / 7));
    const rows = [];
    let tail = 0;
    for (let i = wl.length - 1; i >= 0; i--) {
      tail += wl[i].parts;
      const need = T - (total - tail);
      rows[i] = { key: wl[i].weekStart, parts: wl[i].parts, lots: Number(wl[i].listed) || 0, target: need > 0 ? Math.ceil(need / weeksFrom(wl[i].weekStart)) : 0 };
    }
    const cur = rows.find((r) => r.key === curKey) || null;
    const before = rows.filter((r) => r.key < curKey);
    const prev = before.length ? before[before.length - 1] : null;
    const weeksLeft = weeksFrom(curKey);
    const weekTarget = cur ? cur.target : T - total > 0 ? Math.ceil((T - total) / weeksLeft) : 0;
    let series = 0;
    for (let i = before.length - 1; i >= 0 && before[i].target > 0 && before[i].parts >= before[i].target; i--) series++;
    const last = before.slice(-4);
    const avg4 = last.length >= 2 ? sum(last, (r) => r.parts) / last.length : null;
    const daysLeft = (utc(yearEnd) - utc(today)) / DAY + 1;
    return {
      target: T, total, remaining: Math.max(0, T - total), yearEnd, weeksLeft, weekTarget, done: total >= T,
      listedParts: cur ? cur.parts : null, listedLots: cur ? cur.lots : null,
      reached: !!cur && weekTarget > 0 && cur.parts >= weekTarget,
      prevReached: !!prev && prev.target > 0 && prev.parts >= prev.target,
      series, avg4, projection: avg4 === null ? null : total + (avg4 * daysLeft) / 7,
      curKey, prevKey: prev ? prev.key : null
    };
  }

  /* ---------- Rechnen (reine Funktion) ---------- */
  // m: { now, revenue, inventory, sales, prices, hours, targetHours, ytMonthly, yearGoal }
  //   revenue    data.bricklinkRevenue ({ weekly, monthly, weeklyFrom, monthlyFrom, checkedAt }) oder null
  //   inventory  data.bricklinkInventory (siehe scripts/lib/inventory.mjs) oder null
  //   sales      data.bricklinkSales ({ months: [{ month, orders, units, revenue, top }] }, siehe scripts/lib/sales.mjs) oder null
  //   prices     data.bricklinkPrices ({ over, under, eligible, cycleDays, checked, minDev, minSales, minValue, region, day }, siehe scripts/lib/pricecheck.mjs) oder null
  //   hours      [{ start, youtube, bricklink }] ab der aeltesten Woche, die laufende zuletzt (Zeittracker.weekHours(9)), oder null
  //   targetHours Wochen-Soll Bricklink in Stunden, ytMonthly YouTube-Umsatz je Monat (Ziel "bricks-umsatz"),
  //   yearGoal   das Ziel "bricklink-parts" ({ current, target, due }) oder null
  function compute(m) {
    const now = m.now || new Date();
    const rev = m.revenue && Array.isArray(m.revenue.weekly) ? m.revenue : null;
    const inv = m.inventory && isNum(m.inventory.lots) ? m.inventory : null;
    const hours = Array.isArray(m.hours) && m.hours.length ? m.hours : null;
    const target = isNum(m.targetHours) && m.targetHours > 0 ? m.targetHours : null;

    /* Wochen: neun Spalten, die laufende zuletzt */
    const curMonday = mondayKey(now);
    const keys = hours ? hours.map((h) => h.start) : Array.from({ length: WEEKS }, (_, i) => addDaysKey(curMonday, (i - (WEEKS - 1)) * 7));
    const rw = new Map(((rev && rev.weekly) || []).map((w) => [w.weekStart, w]));
    const wFrom = rev ? rev.weeklyFrom || (rev.weekly[0] && rev.weekly[0].weekStart) || null : null;
    const weeks = keys.map((k, i) => {
      const known = !!rev && wFrom !== null && k >= wFrom;
      const w = rw.get(k);
      return { key: k, partial: i === keys.length - 1, known, rev: known ? (w ? w.total : 0) : null, ord: known ? (w ? w.orderCount : 0) : null, h: hours ? hours[i].bricklink : null, hy: hours ? hours[i].youtube : null };
    });
    const full = weeks.slice(0, -1);
    const group = (a, b) => { if (a < 0) return null; const g = full.slice(a, b); return g.length === b - a && g.every((w) => w.known) ? g : null; };
    const last4 = group(full.length - 4, full.length), prev4 = group(full.length - 8, full.length - 4);
    const avgOrd = (g) => (g ? sum(g, (w) => w.ord) / g.length : null);
    const aovOf = (g) => { if (!g) return null; const o = sum(g, (w) => w.ord); return o > 0 ? sum(g, (w) => w.rev) / o : null; };
    const hoursOf = (g) => (g && g.every((w) => isNum(w.h)) ? sum(g, (w) => w.h) : null);
    const A = avgOrd(last4), B = avgOrd(prev4), aovA = aovOf(last4), aovB = aovOf(prev4), H4 = hoursOf(last4);
    const revA = last4 ? sum(last4, (w) => w.rev) : null;

    /* Monate: die letzten sechs vollen Kalendermonate */
    const curMonth = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const mFrom = rev ? rev.monthlyFrom || (rev.monthly && rev.monthly[0] && rev.monthly[0].month) || null : null;
    const rm = new Map(((rev && rev.monthly) || []).map((x) => [x.month, x]));
    const months = [];
    for (let i = 6; i >= 1; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1), k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const known = !!rev && mFrom !== null && k >= mFrom, x = rm.get(k);
      months.push({ key: k, mi: d.getMonth(), known, rev: known ? (x ? x.total : 0) : null, ord: known ? (x ? x.orderCount : 0) : null });
    }
    months.forEach((x) => { x.aov = x.known && x.ord > 0 ? x.rev / x.ord : null; });
    const running = rm.get(curMonth) || null;

    /* Kennzahlen */
    const kpis = [];
    const lm = months[months.length - 1], pm = months[months.length - 2];
    if (lm && lm.known) {
      const k = { label: `UMSATZ ${MONTHS[lm.mi].toUpperCase()}`, value: eur0(lm.rev), help: `Summe aller Bestellungen im ${MONTHS[lm.mi]}, ohne stornierte.` };
      if (pm && pm.known && pm.rev > 0) { k.line1 = `${pct(lm.rev, pm.rev)} zu ${MONTHS[pm.mi]} (${eur0(pm.rev)})`; k.tone1 = lm.rev < pm.rev ? "bad" : lm.rev > pm.rev ? "good" : "flat"; }
      const best = months.slice(0, -1).filter((x) => x.known).reduce((b, x) => (!b || x.rev > b.rev ? x : b), null);
      if (best && best.rev > 0 && (!pm || best.key !== pm.key)) k.line2 = `${pct(lm.rev, best.rev)} zu ${MONTHS[best.mi]} (${eur0(best.rev)})`;
      else if (running) k.line2 = `${MONTHS[now.getMonth()]} bisher: ${eur0(running.total)}`;
      kpis.push(k);
    }
    if (A !== null) {
      const end = addDaysKey(last4[last4.length - 1].key, 6);
      const k = { label: "BESTELLUNGEN PRO WOCHE", value: one(A), line2: "Ø der letzten 4 vollen Wochen", help: `Bestellungen vom ${dm(last4[0].key)} bis ${dm(end)}, geteilt durch 4.` };
      if (B !== null) { k.line1 = `davor: ${one(B)}`; k.tone1 = A < B ? "bad" : A > B ? "good" : "flat"; }
      kpis.push(k);
    }
    if (aovA !== null) {
      const k = { label: "Ø WARENKORB", value: eur2(aovA), line2: "letzte 4 volle Wochen", help: "Umsatz geteilt durch die Zahl der Bestellungen." };
      if (aovB !== null) { k.line1 = `davor: ${eur2(aovB)}`; k.tone1 = aovA < aovB ? "bad" : aovA > aovB ? "good" : "flat"; }
      kpis.push(k);
    }
    if (last4 && H4 !== null) {
      const hy = hoursOf(last4.map((w) => ({ h: w.hy })));
      const yt = isNum(m.ytMonthly) && m.ytMonthly > 0 && hy > 0 ? m.ytMonthly / hy : null;
      const k = { label: "UMSATZ PRO STUNDE", value: H4 > 0 ? eur2(revA / H4) : "–", line2: "Umsatz, nicht Gewinn", help: "Bricklink-Umsatz geteilt durch deine getrackten Bricklink-Stunden, jeweils die letzten 4 vollen Wochen. Gebühren und Einkauf fehlen." };
      if (yt !== null) { k.line1 = `YouTube: ${eur2(yt)} pro Std.`; k.tone1 = "flat"; k.help += " YouTube: dein Umsatz/Monat aus den Zielen geteilt durch die YouTube-Stunden derselben Wochen."; }
      kpis.push(k);
    }

    /* Wochen-Diagramm: Zusammenhang zwischen Stunden und Umsatz (nur volle Wochen mit beiden Angaben) */
    const hi = new Set();
    let weekNote = "";
    const both = full.map((w, i) => ({ i, w })).filter((x) => x.w.known && isNum(x.w.h));
    if (both.length >= 6) {
      const k = Math.min(3, Math.floor(both.length / 2));
      const byH = both.slice().sort((a, b) => b.w.h - a.w.h);
      const top = byH.slice(0, k), low = byH.slice(-k);
      top.forEach((x) => hi.add(x.i));
      const avg = (g, f) => sum(g, (x) => f(x.w)) / g.length;
      const rT = avg(top, (w) => w.rev), rL = avg(low, (w) => w.rev), hT = avg(top, (w) => w.h), hL = avg(low, (w) => w.h);
      const head = `In den ${k} Wochen mit den meisten Bricklink-Stunden (Ø ${one(hT)} Std.) kamen im Schnitt ${eur0(rT)} rein, in den ${k} Wochen mit den wenigsten (Ø ${one(hL)} Std.)`;
      if (rL <= 0 ? rT > 0 : rT / rL >= 1.3) weekNote = `${head} nur ${eur0(rL)}. Das ist ein Zusammenhang, kein Beweis.`;
      else if (rL > 0 && rT / rL <= 0.8) weekNote = `${head} ${eur0(rL)}. Mehr Stunden brachten hier nicht mehr Umsatz.`;
      else weekNote = `${head} ${eur0(rL)}. Kein klarer Zusammenhang zwischen Stunden und Umsatz.`;
    } else if (hours) weekNote = "Für einen Vergleich von Stunden und Umsatz fehlen noch ein paar volle Wochen.";

    /* Monats-Diagramm: Ø Warenkorb */
    let monthNote = "";
    const withAov = months.filter((x) => x.aov !== null);
    if (lm && lm.aov !== null && withAov.length >= 3) {
      const peak = withAov.slice(0, -1).reduce((b, x) => (!b || x.aov > b.aov ? x : b), null);
      if (peak && lm.aov > peak.aov) {
        monthNote = `${MONTHS[lm.mi]} ist mit ${eur2(lm.aov)} der höchste Wert der letzten ${withAov.length} Monate.`;
      } else if (peak && lm.aov >= peak.aov * 0.9) {
        monthNote = `${MONTHS[lm.mi]} liegt mit ${eur2(lm.aov)} nahe am besten Wert (${MONTHS[peak.mi]}: ${eur2(peak.aov)}).`;
      } else if (peak) {
        monthNote = `${MONTHS[peak.mi]} war mit ${eur2(peak.aov)} der höchste Wert, ${MONTHS[lm.mi]} liegt bei ${eur2(lm.aov)}. Bestellungen pro Monat: ${lm.ord} statt ${peak.ord}.`;
        const fewer = lm.ord <= peak.ord * 0.75, smaller = lm.aov <= peak.aov * 0.75;
        if (fewer && smaller) monthNote += " Weniger und kleinere Bestellungen gleichzeitig.";
        else if (fewer) monthNote += " Es kommen weniger Bestellungen, die Warenkörbe blieben ähnlich groß.";
        else if (smaller) monthNote += " Die Warenkörbe sind kleiner geworden.";
      }
    }

    /* Lager, Wochenziel und Rabattvorschlag */
    let lager = null;
    const curKey = keys[keys.length - 1];
    if (inv) {
      const today = keyOf(now);
      const daysSince = inv.lastListed ? Math.max(0, Math.round((utc(today) - utc(inv.lastListed)) / DAY)) : null;
      const wk = new Map((Array.isArray(inv.weekly) ? inv.weekly : []).map((w) => [w.weekStart, Number(w.listed) || 0]));
      const listedNow = wk.has(curKey) ? wk.get(curKey) : null;
      const ageN = inv.age ? inv.age.d30 + inv.age.d90 + inv.age.d365 + inv.age.older : 0;
      const ageRows = inv.age && ageN > 0
        ? [["unter 30 Tage", inv.age.d30], ["30 bis 90 Tage", inv.age.d90], ["90 bis 365 Tage", inv.age.d365], ["über 1 Jahr", inv.age.older]].map(([label, n]) => ({ label, n, p: Math.round((n / ageN) * 100) }))
        : null;
      lager = {
        lots: inv.lots, parts: isNum(inv.parts) ? inv.parts : null, value: isNum(inv.value) ? inv.value : null,
        newLots: isNum(inv.newLots) ? inv.newLots : null, usedLots: isNum(inv.usedLots) ? inv.usedLots : null,
        stockroomLots: isNum(inv.stockroomLots) ? inv.stockroomLots : 0,
        newLots30: isNum(inv.newLots30) ? inv.newLots30 : null,
        lastListed: inv.lastListed || null, daysSince, listedNow, ageRows,
        olderShare: ageRows ? ageRows[3].p : null, olderN: inv.age ? inv.age.older : null, oldValue: isNum(inv.oldValue) ? inv.oldValue : null,
        // Array = Liste, null = ohne Erstelldatum nicht moeglich, undefined = aeltere Daten (kommt mit dem naechsten Sync)
        slow: Array.isArray(inv.slow) ? inv.slow.filter((r) => r && typeof r.no === "string" && isNum(r.price) && isNum(r.newPrice)) : inv.slow === null ? null : undefined,
        plan: buildPlan(inv, m.yearGoal, now, curKey)
      };
    }

    /* Bestseller je Monat (aelteste zuerst; vorgewaehlt wird der letzte volle Monat mit Bestellungen) */
    let sales = null;
    if (m.sales && Array.isArray(m.sales.months) && m.sales.months.length) {
      const list = m.sales.months.filter((x) => x && typeof x.month === "string" && /^\d{4}-\d{2}$/.test(x.month)).sort((a, b) => (a.month < b.month ? -1 : 1))
        .map((x) => ({ key: x.month, mi: +x.month.slice(5) - 1, year: x.month.slice(0, 4), orders: Number(x.orders) || 0, units: Number(x.units) || 0, revenue: Number(x.revenue) || 0, top: Array.isArray(x.top) ? x.top : [], running: x.month === curMonth }));
      if (list.length) {
        const pick = list.filter((x) => !x.running && x.orders > 0).pop() || list.filter((x) => x.orders > 0).pop() || list[list.length - 1];
        sales = { months: list, defaultKey: pick.key };
      }
    }

    /* Preis-Check: nur Zeilen mit allen Zahlen */
    let prices = null;
    if (m.prices && (Array.isArray(m.prices.over) || Array.isArray(m.prices.under))) {
      const ok = (r) => r && typeof r.no === "string" && isNum(r.price) && isNum(r.avg) && isNum(r.dev) && isNum(r.diff);
      const P = m.prices;
      prices = {
        over: (Array.isArray(P.over) ? P.over : []).filter(ok), under: (Array.isArray(P.under) ? P.under : []).filter(ok),
        eligible: Number(P.eligible) || 0, cycleDays: Math.max(1, Number(P.cycleDays) || 1), checked: Number(P.checked) || 0,
        minDev: Number(P.minDev) || 30, minSales: Number(P.minSales) || 3, minValue: Number(P.minValue) || 1, region: String(P.region || ""), day: String(P.day || "")
      };
    }

    /* Hinweise: feste Regeln, die schlimmsten zuerst */
    const hints = [];
    if (A !== null && B !== null && B > 0) {
      const t = `Letzte 4 volle Wochen Ø ${one(A)}, davor Ø ${one(B)}.`;
      if (A <= B * 0.75) hints.push({ level: A <= B * 0.6 ? "bad" : "warn", title: `Bestellungen: nur noch Ø ${one(A)} pro Woche`, text: t });
      else if (A >= B * 1.25) hints.push({ level: "ok", title: `Bestellungen steigen: Ø ${one(A)} pro Woche`, text: t });
      else hints.push({ level: "ok", title: `Bestellungen stabil: Ø ${one(A)} pro Woche`, text: t });
    }
    const earlier = months.slice(0, -1).filter((x) => x.known && x.ord > 0);
    if (lm && lm.aov !== null && earlier.length >= 2) {
      const base = sum(earlier, (x) => x.rev) / sum(earlier, (x) => x.ord), t = `${MONTHS[lm.mi]} ${eur2(lm.aov)}, in den Monaten davor Ø ${eur2(base)}.`;
      if (lm.aov <= base * 0.75) hints.push({ level: lm.aov <= base * 0.6 ? "bad" : "warn", title: lm.aov <= base * 0.65 ? "Ø Warenkorb stark gefallen" : "Ø Warenkorb gefallen", text: t });
      else if (lm.aov >= base * 1.25) hints.push({ level: "ok", title: "Ø Warenkorb gestiegen", text: t });
    }
    if (target !== null && last4 && H4 !== null) {
      const Ah = H4 / 4;
      if (Ah < target * 0.85) hints.push({ level: Ah < target * 0.6 ? "bad" : "warn", title: "Bricklink-Zeit unter deinem Ziel", text: `Ø ${one(Ah)} Std. pro Woche statt ${one(target)} in den letzten 4 vollen Wochen.` });
      else hints.push({ level: "ok", title: "Bricklink-Zeit im Ziel", text: `Ø ${one(Ah)} Std. pro Woche, Ziel ${one(target)}.` });
    }
    if (lager) {
      const p = lager.plan;
      const part = p && p.listedParts !== null
        ? `Diese Woche ${de(p.listedParts, 0)} Teile${p.weekTarget ? `, Ziel ${de(p.weekTarget, 0)}` : ""}.`
        : lager.listedNow !== null ? `Diese Woche ${lager.listedNow} ${lager.listedNow === 1 ? "neues Lot" : "neue Lots"}.` : "";
      const d = lager.daysSince;
      if (d !== null) {
        const level = d >= 14 ? "bad" : d >= 7 ? "warn" : "ok";
        const title = level !== "ok" ? `Seit ${d} Tagen nichts eingestellt` : d === 0 ? "Heute etwas eingestellt" : d === 1 ? "Gestern etwas eingestellt" : `Zuletzt vor ${d} Tagen etwas eingestellt`;
        hints.push({ level, title, text: part || `Das neueste Lot ist vom ${dm(lager.lastListed)}` });
      }
      if (p && p.done) hints.push({ level: "ok", title: `Jahresziel ${de(p.target, 0)} Teile erreicht`, text: `Im Shop liegen ${de(p.total, 0)} Teile.` });
      else if (p && p.avg4 !== null) {
        const proj = Math.round(p.projection / 100) * 100, level = p.projection >= p.target ? "ok" : p.projection >= p.target * 0.9 ? "warn" : "bad";
        hints.push({
          level,
          title: level === "ok" ? `Jahresziel ${de(p.target, 0)} Teile in Reichweite` : `Jahresziel ${de(p.target, 0)} Teile: bei diesem Tempo ca. ${de(proj, 0)}`,
          text: `Nötig: ${de(p.weekTarget, 0)} Teile pro Woche, dein Schnitt: ${de(Math.round(p.avg4), 0)}.`
        });
      }
      if (lager.olderShare !== null && lager.olderShare >= 40) {
        hints.push({ level: "warn", title: `${lager.olderShare} % der Lots sind älter als ein Jahr`, text: `Ladenhüter binden Geld${lager.oldValue !== null ? ` (ca. ${eur0(lager.oldValue)})` : ""}${lager.slow && lager.slow.length ? ", siehe Rabattvorschlag." : "."}` });
      }
    } else {
      hints.push({ level: "info", title: "Lager noch nicht geladen", text: "Die Lager-Zahlen kommen mit dem nächsten Sync." });
    }
    if (prices && (prices.over.length || prices.under.length)) {
      hints.push({ level: "info", title: `Preis-Check: ${prices.over.length} Lots deutlich über, ${prices.under.length} deutlich unter dem 6-Monats-Schnitt`, text: "Die Listen stehen weiter unten." });
    }
    hints.sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

    const issues = hints.filter((h) => h.level === "bad" || h.level === "warn").length;
    const worst = hints.length ? hints[0].level : "info";
    const stamp = [rev && rev.checkedAt, inv && inv.checkedAt].filter(Boolean).sort().pop();
    const sd = stamp ? new Date(stamp) : null;
    return {
      weeks, hi, weekNote, months, monthNote, kpis, hints, lager, sales, prices, worst, issues,
      stand: sd && !isNaN(sd) ? sd.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "",
      hasRevenue: !!rev, hasHours: !!hours, target
    };
  }

  /* ---------- Anzeige ---------- */
  const sq = (n, max) => `<span class="sr-ords" aria-hidden="true">${"<i></i>".repeat(Math.min(n, max))}${n > max ? `<b>+${n - max}</b>` : ""}</span>`;
  const lab = (key) => `<span class="sr-lab"><span>${+key.slice(8, 10)}.</span><span>${+key.slice(5, 7)}.</span></span>`;
  const maxOf = (arr, f) => Math.max(1, ...arr.map((x) => f(x) || 0));

  function hintsHtml(model) {
    return model.hints.map((h) => `<div class="sr-hint sr-lvl-${h.level}"><span class="sr-hdot"></span><div><b>${esc(h.title)}</b><span>${esc(h.text)}</span></div></div>`).join("");
  }
  function kpiHtml(model, info) {
    return model.kpis.map((k) => `<div class="sr-kpi"><span class="sr-kl">${esc(k.label)}</span><b class="sr-kv">${esc(k.value)}</b>${k.line1 ? `<span class="sr-k1 sr-tone-${k.tone1 || "flat"}">${esc(k.line1)}</span>` : ""}${k.line2 ? `<span class="sr-k2">${esc(k.line2)}</span>` : ""}${info ? `<span class="sr-kh">${esc(k.help)}</span>` : ""}</div>`).join("");
  }
  function weekChartHtml(model) {
    const { weeks, hi, target } = model;
    const rMax = maxOf(weeks, (w) => w.rev), hMax = Math.max(1, target || 0, ...weeks.map((w) => w.h || 0));
    const R = 92, H = 84;
    const cls = (w, i) => `sr-col${hi.has(i) ? " sr-hi" : ""}${w.partial ? " sr-part" : ""}${!w.known ? " sr-unk" : ""}`;
    const revCols = weeks.map((w, i) => {
      const t = w.known ? `${dm(w.key)}: ${eur2(w.rev)} · ${w.ord} ${w.ord === 1 ? "Bestellung" : "Bestellungen"}${w.partial ? " (läuft noch)" : ""}` : `${dm(w.key)}: keine Daten`;
      return `<div class="${cls(w, i)}" title="${esc(t)}"><span class="sr-val">${w.known ? Math.round(w.rev) : "–"}</span><span class="sr-bar sr-bar-r" style="height:${w.known ? (w.rev > 0 ? Math.max(4, Math.round((w.rev / rMax) * R)) : 2) : 4}px"></span>${w.known ? sq(w.ord, 6) : '<span class="sr-ords"></span>'}</div>`;
    }).join("");
    const hCols = weeks.map((w, i) => {
      const known = isNum(w.h);
      const t = known ? `${dm(w.key)}: ${one(w.h)} Std. Bricklink${w.partial ? " (läuft noch)" : ""}` : `${dm(w.key)}: keine Zeitdaten`;
      return `<div class="${cls({ ...w, known: known }, i)}" title="${esc(t)}"><span class="sr-val">${known ? one(w.h) : "–"}</span><span class="sr-bar sr-bar-h" style="height:${known ? (w.h > 0 ? Math.max(4, Math.round((w.h / hMax) * H)) : 2) : 4}px"></span></div>`;
    }).join("");
    const line = target ? `<span class="sr-target" style="bottom:${4 + Math.round((target / hMax) * H)}px"></span>` : "";
    const hoursPart = model.hasHours
      ? `<div class="sr-leg"><span><i class="sr-sw sr-sw-h"></i>Bricklink-Zeit in Std.</span>${target ? `<span><i class="sr-sw sr-sw-t"></i>Ziel ${one(target)} Std.</span>` : ""}</div>
      <div class="sr-hwrap"><div class="sr-grid sr-grid-h" role="group" aria-label="Bricklink-Zeit pro Woche in Stunden">${hCols}</div>${line}</div>`
      : "";
    return `<div class="sr-leg"><span><i class="sr-sw sr-sw-r"></i>Umsatz in €</span><span>■ = 1 Bestellung</span></div>
      <div class="sr-grid sr-grid-r" role="group" aria-label="Umsatz pro Woche in Euro mit Zahl der Bestellungen">${revCols}</div>
      ${hoursPart}
      <div class="sr-grid sr-grid-l">${weeks.map((w) => lab(w.key)).join("")}</div>`;
  }
  function monthChartHtml(model) {
    const ms = model.months, aMax = maxOf(ms, (x) => x.aov);
    return `<div class="sr-grid sr-grid-m" role="group" aria-label="Durchschnittlicher Warenkorb pro Monat in Euro">${ms.map((x) => {
      const t = x.aov !== null ? `${MONTHS[x.mi]}: Ø ${eur2(x.aov)} bei ${x.ord} Bestellungen` : `${MONTHS[x.mi]}: ${x.known ? "keine Bestellung" : "keine Daten"}`;
      return `<div class="sr-col sr-mcol${x.known ? "" : " sr-unk"}" title="${esc(t)}"><span class="sr-val">${x.aov !== null ? Math.round(x.aov) : "–"}</span><span class="sr-bar sr-bar-r" style="height:${x.aov !== null ? Math.max(4, Math.round((x.aov / aMax) * 120)) : 4}px"></span><span class="sr-mlab">${MON_SHORT[x.mi]}</span><span class="sr-mord">${x.known ? `${x.ord} Best.` : ""}</span></div>`;
    }).join("")}</div>`;
  }

  // Eine Zeile mit Rang, Bild, Teilenummer (Link zur Bricklink-Katalogseite), Name und Farbe; rechts die Zahlen
  function itemRow(n, r, right) {
    const colorTxt = r.colorName || (r.color ? `Farbe ${r.color}` : "");
    const sub = [colorTxt, r.cond === "N" ? "neu" : r.cond === "U" ? "gebraucht" : "", r.t !== "PART" ? TYPE_LABEL[r.t] || "" : ""].filter(Boolean).join(" · ");
    const img = imgUrl(r.t, r.no, r.color), url = pageUrl(r.t, r.no, r.color);
    return `<li class="sr-item"><span class="sr-rank" aria-label="Platz ${n}">${n}</span><span class="sr-img">${img ? `<img src="${esc(img)}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">` : ""}</span>
      <div class="sr-im"><b class="sr-no">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Katalogseite in Bricklink öffnen">${esc(r.no)}</a>` : esc(r.no)}</b><span class="sr-iname">${esc(decode(r.name))}</span>${sub ? `<span class="sr-isub">${esc(sub)}</span>` : ""}</div>
      <div class="sr-iv">${right}</div></li>`;
  }

  function lagerHtml(model) {
    const L = model.lager;
    const tile = (label, value, sub, off) => `<div class="sr-tile${off ? " sr-off" : ""}"><span class="sr-kl">${label}</span><b class="sr-kv">${value}</b><span class="sr-k2">${sub}</span></div>`;
    if (!L) {
      return `<div class="sr-tiles">${tile("LOTS IM SHOP", "–", "kommt mit dem nächsten Sync", true)}${tile("NEU EINGESTELLT", "–", "in 30 Tagen", true)}${tile("LAGERWERT", "–", "Menge mal Preis", true)}${tile("ZULETZT EINGESTELLT", "–", "Tage seit dem letzten Lot", true)}</div>
        <p class="sr-note">Der tägliche Sync fragt bei Bricklink deine Lots ab (Anzahl, Menge, Preis, Einstelldatum) und speichert die Summen. Danach stehen hier echte Zahlen.</p>`;
    }
    const parts = [L.parts !== null ? `${de(L.parts, 0)} Teile` : "", L.newLots !== null && L.usedLots !== null ? `${de(L.newLots, 0)} neu, ${de(L.usedLots, 0)} gebraucht` : ""].filter(Boolean).join(" · ");
    const tiles = [
      tile("LOTS IM SHOP", de(L.lots, 0), esc(parts) + (L.stockroomLots ? `${parts ? " · " : ""}+ ${de(L.stockroomLots, 0)} im Stockroom` : ""), false),
      tile("NEU EINGESTELLT", L.newLots30 !== null ? de(L.newLots30, 0) : "–", "in 30 Tagen, noch im Bestand", L.newLots30 === null),
      tile("LAGERWERT", L.value !== null ? eur0(L.value) : "–", "Verkaufswert: Menge mal Preis", L.value === null),
      tile("ZULETZT EINGESTELLT", L.daysSince === null ? "–" : L.daysSince === 0 ? "heute" : L.daysSince === 1 ? "gestern" : `vor ${L.daysSince} Tagen`, L.lastListed ? `am ${dm(L.lastListed)}` : "ohne Erstelldatum nicht bekannt", L.daysSince === null)
    ].join("");
    const ages = L.ageRows
      ? L.ageRows.map((a, i) => `<div class="sr-age"><span>${a.label}</span><span class="sr-track"><span class="sr-fill${i === 3 ? (a.p >= 40 ? " sr-fill-bad" : a.p >= 20 ? " sr-fill-warn" : "") : ""}" style="width:${a.p}%"></span></span><span class="sr-pct">${a.p} %</span></div>`).join("") + `<p class="sr-note">Lots, die älter als ein Jahr sind, nennt man Ladenhüter: Sie binden Geld, ohne zu verkaufen.</p>`
      : `<p class="sr-note">Bricklink liefert für die Lots kein Erstelldatum, deshalb gibt es hier kein Alter.</p>`;
    const p = L.plan;
    let goalBox;
    if (!p) {
      goalBox = `<div class="sr-goal"><span class="sr-kl">WOCHENZIEL: NEUE TEILE EINSTELLEN</span><p class="sr-note">Das Wochenziel richtet sich nach deinem Jahresziel „Bricklink-Teile“. Die Teile je Woche kommen mit dem nächsten Sync.</p></div>`;
    } else if (p.done) {
      goalBox = `<div class="sr-goal"><span class="sr-kl">WOCHENZIEL: NEUE TEILE EINSTELLEN</span><b class="sr-gtext">Jahresziel erreicht: ${de(p.total, 0)} von ${de(p.target, 0)} Teilen</b><span class="sr-k2">Ein Wochenziel ist nicht mehr nötig.</span></div>`;
    } else {
      const n = p.listedParts, barP = n !== null && p.weekTarget > 0 ? Math.min(100, Math.round((n / p.weekTarget) * 100)) : 0;
      const proj = p.projection !== null ? Math.round(p.projection / 100) * 100 : null;
      const serie = p.reached ? `Serie: ${p.series + 1} ${p.series + 1 === 1 ? "Woche" : "Wochen"} in Folge (mit dieser), +15 XP` : p.series > 0 ? `Serie: ${p.series} ${p.series === 1 ? "Woche" : "Wochen"} in Folge geschafft` : "Noch keine Serie: Ziel erreichen, dann zählt die Woche (15 XP).";
      goalBox = `<div class="sr-goal"><span class="sr-kl">WOCHENZIEL: NEUE TEILE EINSTELLEN</span>
        <div class="sr-gtrack"><span class="sr-gfill${p.reached ? " sr-gdone" : ""}" style="width:${barP}%"></span></div>
        <b class="sr-gtext">${n !== null ? `Diese Woche: ${de(n, 0)} von ${de(p.weekTarget, 0)} Teilen` : `Ziel: ${de(p.weekTarget, 0)} neue Teile pro Woche`}</b>
        <span class="sr-k2">Aus dem Jahresziel: ${de(p.target, 0)} Teile bis ${dm(p.yearEnd)} (jetzt ${de(p.total, 0)}, noch ${de(p.remaining, 0)} in ${p.weeksLeft} ${p.weeksLeft === 1 ? "Woche" : "Wochen"}).</span>
        ${p.avg4 !== null ? `<span class="sr-k2">Dein Schnitt: Ø ${de(Math.round(p.avg4), 0)} Teile pro Woche. Bei diesem Tempo ergäbe das zum Jahresende ca. ${de(proj, 0)} Teile, ohne Verkäufe gerechnet.</span>` : ""}
        <span class="sr-k2">${serie}</span></div>`;
    }
    return `<div class="sr-tiles">${tiles}</div><div class="sr-lcols"><div class="sr-ages"><span class="sr-kl">ALTER DER LOTS</span>${ages}</div>${goalBox}</div>`;
  }

  // Bestseller: Reiter fuer die Monate (aelteste links, laufender Monat rechts), darunter die zehn meistverkauften Artikel des gewaehlten Monats
  function salesHtml(model, ui) {
    const S = model.sales;
    if (!S) return `<p class="sr-note">Die Bestseller kommen mit dem nächsten Sync.</p>`;
    const sel = S.months.find((x) => x.key === ui.month) || S.months.find((x) => x.key === S.defaultKey) || S.months[S.months.length - 1];
    const tabs = S.months.map((x) => `<button type="button" class="sr-tab" data-sr-act="month:${x.key}" aria-pressed="${x.key === sel.key ? "true" : "false"}">${MON_SHORT[x.mi]}${x.running ? "*" : ""}</button>`).join("");
    const list = sel.top.length
      ? `<ol class="sr-items">${sel.top.map((r, i) => itemRow(i + 1, r, `<b>${de(r.qty, 0)} Stück</b><span class="sr-m">${eur2(r.revenue)}</span><span class="sr-m">in ${r.orders} ${r.orders === 1 ? "Bestellung" : "Bestellungen"}</span>`)).join("")}</ol>`
      : `<p class="sr-note">In diesem Monat gab es keine Verkäufe.</p>`;
    return `<div class="sr-tabs" role="group" aria-label="Monat wählen">${tabs}</div>
      <p class="sr-msum"><b>${MONTHS[sel.mi]} ${sel.year}${sel.running ? " (läuft noch)" : ""}:</b> ${sel.orders} ${sel.orders === 1 ? "Bestellung" : "Bestellungen"}, ${de(sel.units, 0)} Teile, ${eur0(sel.revenue)}</p>${list}`;
  }

  // Rabattvorschlag: die zehn Ladenhueter (Warenwert mal Alter), mit Vorschlag nach Alter
  function slowHtml(model) {
    const L = model.lager;
    if (!L || L.slow === undefined) return `<p class="sr-note">Die Liste kommt mit dem nächsten Sync.</p>`;
    if (L.slow === null) return `<p class="sr-note">Ohne Erstelldatum der Lots gibt es keine Liste.</p>`;
    if (!L.slow.length) return `<p class="sr-note">Keine Lots über ein Jahr gefunden, für die ein Rabatt nötig wäre.</p>`;
    const sumTxt = L.olderN !== null ? `<p class="sr-msum">Lots über 1 Jahr: <b>${de(L.olderN, 0)}</b>${L.oldValue !== null ? `, gebunden ca. <b>${eur0(L.oldValue)}</b> zum Verkaufspreis` : ""}. Hier die zehn mit dem meisten Geld, das am längsten liegt:</p>` : "";
    const rows = L.slow.map((r, i) => itemRow(i + 1, r, `<span class="sr-pr"><s>${price(r.price)}</s> → <b>${price(r.newPrice)}</b> <span class="sr-pc">−${r.pct} %</span></span><span class="sr-m"><span class="sr-nb">${de(r.qty, 0)} Stück ·</span> <span class="sr-nb">${eur2(r.value)} gebunden</span></span><span class="sr-m"><span class="sr-nb">seit ${ageText(r.age)}</span>${r.sale > 0 ? ` <span class="sr-nb">· schon −${r.sale} %</span>` : ""}</span>`)).join("");
    return `${sumTxt}<ol class="sr-items">${rows}</ol>
      <p class="sr-note">Vorschlag nach Alter: ab 1 Jahr 10 %, ab 2 Jahren 15 %, ab 3 Jahren 20 % auf den Listenpreis. Den Rabatt stellst du in Bricklink beim Lot ein (Sale in Prozent). Bricklink verrät nicht, wie oft ein Lot verkauft wurde: „schlecht verkauft“ heißt hier lange da und noch viel Wert.</p>`;
  }

  // Preis-Check: Reiter "Zu teuer" / "Zu billig", darunter die Lots mit der groessten Wirkung (Unterschied fuer das ganze Lot); zehn, auf Wunsch alle gespeicherten
  function priceHtml(model, ui) {
    const P = model.prices;
    if (!P) return `<p class="sr-note">Die Liste kommt mit dem nächsten Sync.</p>`;
    const tab = ui.pc === "under" ? "under" : "over", rows = P[tab], shown = ui.pcMore ? rows : rows.slice(0, 10);
    const tabs = `<div class="sr-tabs" role="group" aria-label="Richtung wählen"><button type="button" class="sr-tab" data-sr-act="pc:over" aria-pressed="${tab === "over"}">Zu teuer (${P.over.length})</button><button type="button" class="sr-tab" data-sr-act="pc:under" aria-pressed="${tab === "under"}">Zu billig (${P.under.length})</button></div>`;
    const list = shown.length
      ? `<ol class="sr-items">${shown.map((r, i) => {
        const up = r.dev > 0, sign = up ? "+" : "−";
        return itemRow(i + 1, r, `<span class="sr-pr"><b>${price(r.price)}</b> <span class="sr-vs">statt Ø ${price(r.avg)}</span></span><span class="sr-m"><b class="sr-dev ${up ? "sr-dev-up" : "sr-dev-down"}">${sign}${Math.abs(r.dev)} %</b> <span class="sr-nb">bei ${de(r.n, 0)} Verkäufen</span></span><span class="sr-m"><span class="sr-nb">${de(r.qty, 0)} Stück ·</span> <span class="sr-nb">${sign}${eur2(Math.abs(r.diff))} im Lot</span></span>`);
      }).join("")}</ol>${rows.length > shown.length ? `<button type="button" class="sr-more" data-sr-act="pcmore">Alle ${rows.length} anzeigen</button>` : ""}`
      : `<p class="sr-note">${tab === "over" ? "Bisher kein Lot gefunden, das deutlich über dem Durchschnitt liegt." : "Bisher kein Lot gefunden, das deutlich unter dem Durchschnitt liegt."}</p>`;
    const cover = `Geprüft wird in Etappen, weil Bricklink nur begrenzt viele Abfragen am Tag erlaubt: heute ${de(P.checked, 0)} von ${de(P.eligible, 0)} Lots, ein voller Durchlauf dauert ${P.cycleDays} ${P.cycleDays === 1 ? "Tag" : "Tage"}. Die Listen füllen sich in dieser Zeit.`;
    return `${tabs}${list}<p class="sr-note">Verglichen wird dein Preis mit dem Durchschnitt der Verkäufe der letzten 6 Monate (${P.region === "europe" ? "Europa" : esc(P.region || "weltweit")}, ohne MwSt., nach Stückzahl gewichtet), nur Teile und Minifiguren ab ${de(P.minValue, 0)} € Warenwert, mindestens ${P.minSales} Verkäufe, Abweichung ab ${P.minDev} %. „Im Lot“ ist der Unterschied für die ganze Menge. ${cover}</p>`;
  }

  function panelHtml(model, ui) {
    const note = (t) => (t ? `<p class="sr-insight">${esc(t)}</p>` : "");
    const infoTxt = `<div class="sr-info" ${ui.info ? "" : "hidden"}><span class="sr-kl">SO LIEST DU DEN RADAR</span>
      <p>Die Hinweise sind feste Regeln, keine Schätzung: Sie vergleichen die letzten 4 vollen Wochen mit den 4 Wochen davor, den letzten vollen Monat mit den Monaten davor, deine Bricklink-Zeit mit deinem Wochen-Soll und dein Tempo beim Einstellen mit dem Jahresziel.</p>
      <p>Das Wochenziel für neue Teile folgt aus dem Jahresziel „Bricklink-Teile“: Was bis zum Jahresende fehlt, geteilt durch die Wochen, die noch bleiben. Es ändert sich also von Woche zu Woche, Verkäufe sind nicht eingerechnet.</p>
      <p>Der Lagerwert ist der Verkaufswert (Menge mal Preis), nicht dein Einkaufspreis. „Neu eingestellt“ zählt nur Lots, die noch im Bestand sind. Bestseller zählen die Stückzahl je Monat (neu und gebraucht zusammen), die Bilder kommen direkt von Bricklink.</p>
      <p>Der Preis-Check vergleicht deine Preise mit den Verkaufspreisen der letzten 6 Monate bei Bricklink. Weil dafür je Lot eine Abfrage nötig ist und Bricklink nur begrenzt viele am Tag erlaubt, wird täglich ein Teil deiner Lots geprüft.</p>
      <p>Gespeichert werden Zahlen und für die drei Listen je Artikel Nummer, Name, Farbe, Menge und Preis, im privaten Repo. Von Käufern wird nichts gespeichert: keine Namen, keine Adressen, keine Nachrichten.</p></div>`;
    return `<div class="sr-head"><div><span class="sr-t1">SHOP-RADAR</span><span class="sr-t2">Bricklink: Warum läuft der Shop (nicht)?</span></div><div class="sr-meta">${model.stand ? `<span>Stand ${esc(model.stand)}</span>` : ""}<button type="button" class="sr-i" data-sr-act="info" aria-pressed="${ui.info ? "true" : "false"}" aria-label="Erklärungen ein- oder ausblenden">i</button></div></div>
      ${infoTxt}
      <div class="sr-hints">${hintsHtml(model)}</div>
      ${model.kpis.length ? `<div class="sr-kpis">${kpiHtml(model, ui.info)}</div>` : ""}
      ${model.hasRevenue ? `<div class="sr-cols">
        <section class="sr-box sr-boxw"><h4>Zeit und Umsatz pro Woche</h4><p class="sr-sub">Mehr Stunden, mehr Bestellungen? Die letzten ${model.weeks.length} Wochen (die letzte läuft noch).</p>${weekChartHtml(model)}${note(model.weekNote)}</section>
        <section class="sr-box"><h4>Ø Warenkorb pro Monat</h4><p class="sr-sub">Umsatz geteilt durch Bestellungen, die letzten 6 vollen Monate.</p>${monthChartHtml(model)}${note(model.monthNote)}</section>
      </div>` : ""}
      <section class="sr-box"><h4>Lager</h4><p class="sr-sub">Dein Angebot: Wie viel liegt im Shop, und wie frisch ist es?</p>${lagerHtml(model)}</section>
      <section class="sr-box"><h4>Bestseller pro Monat</h4><p class="sr-sub">Die zehn meistverkauften Artikel nach Stückzahl. Bei der Zahl vorn ist es die Teilenummer aus Bricklink.</p>${salesHtml(model, ui)}</section>
      <section class="sr-box"><h4>Rabattvorschlag</h4><p class="sr-sub">Die zehn Ladenhüter, die du am ehesten im Preis senken könntest.</p>${slowHtml(model)}</section>
      <section class="sr-box"><h4>Preis-Check</h4><p class="sr-sub">Teile und Minifiguren, deren Preis stark vom Durchschnitt der letzten 6 Monate abweicht.</p>${priceHtml(model, ui)}</section>
      <p class="sr-foot">Keine Kundendaten: keine Namen, Adressen oder Nachrichten von Käufern. Gespeichert sind Zahlen und die drei Artikellisten. Quellen: Bricklink-API und Zeittracker.</p>`;
  }

  function teaser(model) {
    if (model.issues > 0) return `${model.issues} ${model.issues === 1 ? "Hinweis" : "Hinweise"}: ${model.hints[0].title}`;
    if (model.hints.some((h) => h.level === "ok")) return "keine Auffälligkeiten";
    return model.hints.length ? model.hints[0].title : "";
  }

  window.ShopRadarCalc = { compute };

  window.createShopRadar = function (deps) {
    const { data } = deps;
    const UI_KEY = "dashboard-shopradar-ui";
    // Auf/zu und Erklaerung: nur dieser Browser, standardmaessig zu; der gewaehlte Monat gilt nur bis zum Neuladen
    const ui = { open: false, info: false, month: null, pc: "over", pcMore: false };
    try { const u = JSON.parse(localStorage.getItem(UI_KEY) || "{}"); ui.open = u.open === true; ui.info = u.info === true; } catch (e) { /* egal */ }
    const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ open: ui.open, info: ui.info })); } catch (e) { /* egal */ } };

    const hosts = new Set();
    const goalXp = (model) => {
      // Wochenziel erreicht: 15 XP je Woche, aber erst wenn die Cloud geladen ist (sonst blitzt eine Belohnung auf, die schon gebucht ist)
      const xp = deps.getXp && deps.getXp();
      const p = model && model.lager && model.lager.plan;
      if (!xp || !p || document.body.dataset.cloud !== "ready" || !(xp.cloudHad && xp.cloudHad())) return;
      if (p.reached) xp.award(`partsweek@${p.curKey}`, XP_WEEK, null);
      if (p.prevReached && p.prevKey) xp.award(`partsweek@${p.prevKey}`, XP_WEEK, null);
    };
    function model() {
      const tt = deps.hours;
      let hours = null, targets = null;
      try { hours = tt ? tt.weekHours(WEEKS) : null; targets = tt ? tt.targets() : null; } catch (e) { /* ohne Zeitdaten weiter */ }
      const goals = data && Array.isArray(data.goals) ? data.goals : [];
      const yt = goals.find((g) => g.id === "bricks-umsatz"), yg = goals.find((g) => g.id === "bricklink-parts");
      return compute({
        now: new Date(), revenue: data && data.bricklinkRevenue, inventory: data && data.bricklinkInventory, sales: data && data.bricklinkSales, prices: data && data.bricklinkPrices,
        hours, targetHours: targets ? targets.bricklink : null, ytMonthly: yt && isNum(yt.current) ? yt.current : null,
        yearGoal: yg ? { current: yg.current, target: yg.target, due: yg.due } : null
      });
    }
    // Der Knopf wird nur einmal gebaut und danach nur umgeschrieben (sonst ginge der Tastaturfokus bei jedem Klick verloren);
    // der Inhalt des Menues entsteht nur im aufgeklappten Zustand, ein Knopf darin behaelt seinen Fokus
    function render(host) {
      if (!host.firstElementChild) {
        host.innerHTML = '<button type="button" class="sr-toggle" data-sr-act="toggle" aria-expanded="false" aria-controls="sr-panel"><span class="sr-tg-name">Shop-Radar</span><span class="sr-dot"></span><span class="sr-tg-sum"></span></button><div class="sr-panel" id="sr-panel" role="region" aria-label="Shop-Radar" hidden></div>';
      }
      const mdl = host._srModel || (host._srModel = model());
      const toggle = host.querySelector(".sr-toggle"), panel = host.querySelector(".sr-panel"), card = host.closest(".business-card");
      toggle.className = `sr-toggle sr-lvl-${mdl.worst}`;
      toggle.setAttribute("aria-expanded", ui.open ? "true" : "false");
      toggle.querySelector(".sr-tg-sum").textContent = teaser(mdl);
      panel.hidden = !ui.open;
      if (ui.open) {
        const had = panel.contains(document.activeElement) ? document.activeElement.dataset.srAct : "";
        panel.innerHTML = panelHtml(mdl, ui);
        if (had) { const again = panel.querySelector(`[data-sr-act="${had}"]`); if (again && !again.disabled) again.focus(); }
      } else panel.textContent = "";
      if (card) card.classList.toggle("sr-open", ui.open);
    }
    function refresh() {
      hosts.forEach((h) => { h._srModel = null; render(h); });
      const mdl = hosts.size ? [...hosts][0]._srModel : null;
      if (mdl) goalXp(mdl);
    }
    function onClick(e) {
      const b = e.target.closest("[data-sr-act]");
      if (!b) return;
      const act = b.dataset.srAct;
      if (act === "toggle") { ui.open = !ui.open; saveUi(); refresh(); }
      else if (act === "info") { ui.info = !ui.info; saveUi(); refresh(); }
      else if (act.startsWith("month:")) { ui.month = act.slice(6); refresh(); }
      else if (act === "pc:over" || act === "pc:under") { ui.pc = act.slice(3); ui.pcMore = false; refresh(); }
      else if (act === "pcmore") { ui.pcMore = true; refresh(); }
    }
    // Fehlt ein Bild bei Bricklink, bleibt nur der leere Rahmen (error steigt nicht auf, darum in der Einfangphase)
    function onImgError(e) {
      const t = e.target;
      if (t && t.tagName === "IMG" && t.parentElement && t.parentElement.classList.contains("sr-img")) t.parentElement.classList.add("sr-noimg");
    }

    return {
      // Haengt das Menue in den Platzhalter <div data-sr> der Bricklink-Karte
      mount(host) {
        if (!host || hosts.has(host)) return;
        hosts.add(host);
        host.addEventListener("click", onClick);
        host.addEventListener("error", onImgError, true);
        render(host);
        if (document.body.dataset.cloud !== "ready") document.addEventListener("cloud-ready", refresh, { once: true });
        else goalXp(host._srModel);
      },
      refresh,
      // Fuer die Befehlspalette: Menue aufklappen und hinscrollen
      open() {
        ui.open = true; saveUi(); refresh();
        const h = [...hosts][0];
        if (h) h.scrollIntoView({ block: "start", behavior: "smooth" });
      }
    };
  };
})();
