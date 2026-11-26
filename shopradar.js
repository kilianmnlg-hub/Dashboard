/* Shop-Radar (Bricklink): Ausklappmenue in der Karte "Bricklink Store". Zeigt, warum der Shop laeuft oder nicht: feste Regeln (keine Schaetzung) ueber
   Umsatz, Bestellungen, Ø Warenkorb und die Bricklink-Zeit aus dem Zeittracker, dazu das Lager (Lots, Lagerwert, Alter, neu eingestellt), das Wochenziel
   fuer neue Teile (aus dem Jahresziel "Bricklink-Teile" abgeleitet), die Bestseller je Monat, einen Rabattvorschlag mit den zehn Ladenhuetern und den Preis-Check
   (Teile und Minifiguren mit starker Abweichung vom 6-Monats-Schnitt), jeweils mit Bild und Teilenummer. Alles kommt aus Zahlen, die der Sync ohnehin holt (data.bricklinkRevenue, data.bricklinkInventory, data.bricklinkSales und data.bricklinkPrices,
   siehe scripts/fetchers/bricklink.mjs und scripts/lib/inventory.mjs, sales.mjs, pricecheck.mjs) und aus dem Zeittracker. Von Kaeufern wird nichts gespeichert; die
   drei Artikellisten enthalten nur Artikeldaten. Bilder: die kleinen Vorschaubilder von Bricklink (img.bricklink.com), direkt eingebunden.
   Gespeichert wird hier nichts; auf/zu, die Erklaerung und die Wahl Teile/Minifiguren beim Rabattvorschlag merkt sich nur dieser Browser, die Auswahl der Monate und der anderen Reiter gilt bis zum Neuladen.
   Einzige Ausnahme: der Knopf PREIS ANPASSEN im Preis-Check aendert ueber deps.priceEdit (script.js) den Preis eines Lots bei Bricklink und kann das mit RUECKGAENGIG zuruecknehmen
   (Auftrag im privaten Repo, Workflow bricklink-price.yml, Pruefungen in scripts/lib/priceedit.mjs). Ausserdem startet JETZT PRUEFEN die regelmaessige Kontrolle des Preis-Checks sofort
   (deps.priceCheck, Workflow check-prices.yml) und uebernimmt den frischen Stand in data.bricklinkPrices.
   compute() ist eine reine Funktion (ohne Seite), damit sie sich separat pruefen laesst: window.ShopRadarCalc.compute. window.ShopRadarCalc.partsPlan liefert die Rechnung
   hinter dem Wochenziel (Schnitt der letzten vier vollen Wochen, Prognose) auch der Zielkarte "Bricklink-Teile" in script.js. */
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

  // Ladenhueter: neue Daten haben zwei Listen (slow = alles ausser Minifiguren, slowMini = Minifiguren); aeltere hatten eine gemischte Liste (slow), die hier geteilt wird.
  // slowParts: Array = Liste, null = ohne Erstelldatum nicht moeglich, undefined = aeltere Daten ohne Liste (kommt mit dem naechsten Sync)
  function slowLists(inv) {
    const good = (list) => list.filter((r) => r && typeof r.no === "string" && isNum(r.price) && isNum(r.newPrice));
    if (inv.slow === null) return { slowParts: null, slowMinis: null };
    if (!Array.isArray(inv.slow)) return { slowParts: undefined, slowMinis: undefined };
    const all = good(inv.slow);
    if (Array.isArray(inv.slowMini)) return { slowParts: all, slowMinis: good(inv.slowMini) };
    return { slowParts: all.filter((r) => r.t !== "MINIFIG"), slowMinis: all.filter((r) => r.t === "MINIFIG") };
  }

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
      const sl = slowLists(inv);
      lager = {
        lots: inv.lots, parts: isNum(inv.parts) ? inv.parts : null, value: isNum(inv.value) ? inv.value : null,
        newLots: isNum(inv.newLots) ? inv.newLots : null, usedLots: isNum(inv.usedLots) ? inv.usedLots : null,
        stockroomLots: isNum(inv.stockroomLots) ? inv.stockroomLots : 0,
        newLots30: isNum(inv.newLots30) ? inv.newLots30 : null,
        lastListed: inv.lastListed || null, daysSince, listedNow, ageRows,
        olderShare: ageRows ? ageRows[3].p : null, olderN: inv.age ? inv.age.older : null, oldValue: isNum(inv.oldValue) ? inv.oldValue : null,
        slowParts: sl.slowParts, slowMinis: sl.slowMinis,
        // wann die Rabattliste zuletzt neu berechnet wurde: im Sync (inv.checkedAt) oder in der regelmaessigen Kontrolle (bricklinkPrices.liveAt)
        listAt: [inv.checkedAt, m.prices && m.prices.liveAt].filter((x) => typeof x === "string" && x).sort().pop() || "",
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
      // groesste Abweichung in Prozent zuerst (bei gleichem Prozentsatz der groessere Unterschied fuer das Lot)
      const byPercent = (a, b) => Math.abs(b.dev) - Math.abs(a.dev) || Math.abs(b.diff) - Math.abs(a.diff);
      const P = m.prices;
      // Erledigt: Eintraege der regelmaessigen Kontrolle (lib/pricecheck.mjs refreshRows); neu = in den letzten drei Tagen zum ersten Mal aufgefallen
      const okDone = (d) => d && typeof d.no === "string" && isNum(d.from) && (d.why === "gone" || isNum(d.to));
      const newSince = addDaysKey(keyOf(m.now), -2);
      prices = {
        over: (Array.isArray(P.over) ? P.over : []).filter(ok).sort(byPercent), under: (Array.isArray(P.under) ? P.under : []).filter(ok).sort(byPercent),
        eligible: Number(P.eligible) || 0, cycleDays: Math.max(1, Number(P.cycleDays) || 1), checked: Number(P.checked) || 0,
        minDev: Number(P.minDev) || 30, minSales: Number(P.minSales) || 3, minValue: Number(P.minValue) || 1, region: String(P.region || ""), day: String(P.day || ""),
        done: (Array.isArray(P.done) ? P.done : []).filter(okDone), liveAt: String(P.liveAt || ""), liveChecked: isNum(P.liveChecked) ? P.liveChecked : null, sweepLeft: isNum(P.sweepLeft) ? P.sweepLeft : null, checkedAt: String(P.checkedAt || ""), newSince, newCount: 0
      };
      prices.newCount = prices.over.concat(prices.under).filter((r) => typeof r.since === "string" && r.since >= newSince).length;
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
        hints.push({ level: "warn", title: `${lager.olderShare} % der Lots sind älter als ein Jahr`, text: `Ladenhüter binden Geld${lager.oldValue !== null ? ` (ca. ${eur0(lager.oldValue)})` : ""}${(lager.slowParts && lager.slowParts.length) || (lager.slowMinis && lager.slowMinis.length) ? ", siehe Rabattvorschlag." : "."}` });
      }
    } else {
      hints.push({ level: "info", title: "Lager noch nicht geladen", text: "Die Lager-Zahlen kommen mit dem nächsten Sync." });
    }
    if (prices && (prices.over.length || prices.under.length)) {
      hints.push({ level: "info", title: `Preis-Check: ${prices.over.length} Lots deutlich über, ${prices.under.length} deutlich unter dem 6-Monats-Schnitt${prices.newCount ? ` (${prices.newCount} neu)` : ""}`, text: prices.done.length ? `Schon geändert oder verkauft: ${prices.done.length} (Reiter Erledigt). Die Listen stehen weiter unten.` : "Die Listen stehen weiter unten." });
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
  function itemRow(n, r, right, cls, tag) {
    const colorTxt = r.colorName || (r.color ? `Farbe ${r.color}` : "");
    const sub = [colorTxt, r.cond === "N" ? "neu" : r.cond === "U" ? "gebraucht" : "", r.t !== "PART" ? TYPE_LABEL[r.t] || "" : ""].filter(Boolean).join(" · ");
    const img = imgUrl(r.t, r.no, r.color), url = pageUrl(r.t, r.no, r.color);
    return `<li class="sr-item${cls ? ` ${cls}` : ""}"><span class="sr-rank" aria-label="Platz ${n}">${n}</span><span class="sr-img">${img ? `<img src="${esc(img)}" alt="" width="56" height="56" loading="lazy" referrerpolicy="no-referrer">` : ""}</span>
      <div class="sr-im"><b class="sr-no">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="Katalogseite in Bricklink öffnen">${esc(r.no)}</a>` : esc(r.no)}${tag || ""}</b><span class="sr-iname">${esc(decode(r.name))}</span>${sub ? `<span class="sr-isub">${esc(sub)}</span>` : ""}</div>
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

  // Rabattvorschlag: die zehn Ladenhueter (Warenwert mal Alter), mit Vorschlag nach Alter; Reiter fuer Teile und Minifiguren (die Wahl merkt sich der Browser)
  function slowHtml(model, ui) {
    const L = model.lager;
    if (!L || L.slowParts === undefined) return `<p class="sr-note">Die Liste kommt mit dem nächsten Sync.</p>`;
    if (L.slowParts === null) return `<p class="sr-note">Ohne Erstelldatum der Lots gibt es keine Liste.</p>`;
    const tab = ui.slow === "minis" ? "minis" : "parts", list = tab === "minis" ? L.slowMinis : L.slowParts, what = tab === "minis" ? "Minifiguren" : "Teile";
    const tabs = `<div class="sr-tabs" role="group" aria-label="Teile oder Minifiguren wählen"><button type="button" class="sr-tab" data-sr-act="slow:parts" aria-pressed="${tab === "parts"}">Teile (${L.slowParts.length})</button><button type="button" class="sr-tab" data-sr-act="slow:minis" aria-pressed="${tab === "minis"}">Minifiguren (${L.slowMinis.length})</button></div>`;
    const sumTxt = L.olderN !== null ? `<p class="sr-msum">Lots über 1 Jahr (alle zusammen): <b>${de(L.olderN, 0)}</b>${L.oldValue !== null ? `, gebunden ca. <b>${eur0(L.oldValue)}</b> zum Verkaufspreis` : ""}.${list.length ? ` Hier die ${list.length === 10 ? "zehn" : list.length} ${what} mit dem meisten Geld, das am längsten liegt:` : ""}</p>` : "";
    if (!list.length) return `${tabs}${sumTxt}<p class="sr-note">Keine ${what} über ein Jahr gefunden, für die ein Rabatt nötig wäre.</p>`;
    const rows = list.map((r, i) => {
      // Nach RABATT SETZEN zeigt die Zeile bis zum naechsten Abgleich noch den alten Rabatt: dann Haken und RUECKGAENGIG statt des Knopfs
      const last = ui.canEdit ? lastOk(ui.hist, r.id, "sale") : null;
      const chg = !!last && last.saleAfter !== (r.sale || 0) && Date.parse(last.at || "") > Date.parse(L.listAt || "");
      return itemRow(i + 1, r, `<span class="sr-pr"><s>${price(r.price)}</s> → <b>${price(r.newPrice)}</b> <span class="sr-pc">−${r.pct} %</span></span><span class="sr-m"><span class="sr-nb">${de(r.qty, 0)} Stück ·</span> <span class="sr-nb">${eur2(r.value)} gebunden</span></span><span class="sr-m"><span class="sr-nb">seit ${ageText(r.age)}</span>${r.sale > 0 ? ` <span class="sr-nb">· schon −${r.sale} %</span>` : ""}</span>${saleEditHtml(r, ui, last, chg)}`, chg ? "sr-changed" : "");
    }).join("");
    return `${tabs}${sumTxt}<ol class="sr-items">${rows}</ol>
      <p class="sr-note">Vorschlag nach Alter: ab 1 Jahr 10 %, ab 2 Jahren 15 %, ab 3 Jahren 20 % auf den Listenpreis. RABATT SETZEN stellt ihn direkt bei Bricklink ein (Sale in Prozent, der Listenpreis bleibt); beim nächsten Abgleich (alle 2 Stunden oder JETZT PRÜFEN im Preis-Check) rückt das nächste Lot nach. Bricklink verrät nicht, wie oft ein Lot verkauft wurde: „schlecht verkauft“ heißt hier lange da und noch viel Wert.</p>`;
  }

  /* ---------- Preis bei Bricklink aendern (Preis-Check) ---------- */
  const MIN_PRICE = 0.001, MAX_PRICE = 10000, MAX_RATIO = 2000;   // wie scripts/lib/priceedit.mjs (dort prueft der Workflow noch einmal)
  // Genaue Preise (bis zu vier Stellen) fuer Fenster und Meldungen: die Liste rundet ab 1 € auf zwei Stellen, ein Lot kann aber 2,357 € kosten
  const exact = (n) => `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} €`;
  const pr = (n) => (isNum(n) ? exact(n) : "–");
  // Neuer Preis aus dem Eingabefeld: "0,018", "0.018" oder "1.234,56", auch mit €; null, wenn keine Zahl
  function parsePrice(s) {
    let t = String(s).replace(/[€\s]/g, "");
    if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
    if (!/^\d+(\.\d+)?$/.test(t)) return null;
    const n = Math.round(parseFloat(t) * 10000) / 10000;
    return isFinite(n) ? n : null;
  }
  // Warum der neue Preis nicht in Frage kommt ("" = in Ordnung)
  function priceProblem(target, current) {
    if (target === null) return "Bitte den neuen Preis als Zahl eingeben, zum Beispiel 0,018.";
    if (target < MIN_PRICE) return "Der Preis muss mindestens 0,001 € sein.";
    if (target > MAX_PRICE) return "Der Preis darf höchstens 10.000 € sein.";
    if (Math.abs(target - current) < 0.00005) return "Das ist schon der aktuelle Preis.";
    if (target / current > MAX_RATIO || target / current < 1 / MAX_RATIO) return "Das wäre mehr als das 2000-Fache oder weniger als der 2000. Teil des jetzigen Preises. Bitte noch einmal prüfen.";
    return "";
  }
  // Rabatt setzen (Rabattvorschlag): Rabatt aus dem Eingabefeld ("15", "15 %", "-15"), ganze Prozent, sonst null; hoechstens MAX_SALE (wie scripts/lib/priceedit.mjs)
  const MAX_SALE = 50;
  function parseSale(s) {
    const t = String(s).replace(/[%\s−-]/g, "");
    return /^\d{1,2}$/.test(t) ? Number(t) : null;
  }
  function saleProblem(target, current) {
    if (target === null) return "Bitte den Rabatt als ganze Zahl eingeben, zum Beispiel 15.";
    if (target > MAX_SALE) return `Höchstens ${MAX_SALE} % (damit ein Tippfehler nichts verschenkt).`;
    if (target === (current || 0)) return "Das ist schon der aktuelle Rabatt.";
    return "";
  }
  // Knopf oder Zustand im Rabattvorschlag: RABATT SETZEN, "wird geaendert" oder (nach dem Setzen, solange die Liste noch den alten Rabatt zeigt) Haken mit RUECKGAENGIG
  function saleEditHtml(r, ui, last, chg) {
    if (!ui.canEdit || r.id === undefined || r.id === null) return "";
    const id = esc(String(r.id));
    if (ui.busy.has(String(r.id))) return `<span class="sr-ac"><span class="sr-busy" role="status">Bricklink wird geändert …</span></span>`;
    if (chg) {
      const undo = isNum(last.saleBefore) && isNum(last.listBefore) ? `<button type="button" class="sr-edit sr-undo" data-sr-act="rbu:${id}" title="${last.saleBefore ? `Rabatt wieder auf −${last.saleBefore} % setzen` : "Rabatt wieder entfernen"}">RÜCKGÄNGIG</button>` : "";
      return `<span class="sr-ac"><span class="sr-ok">✓ ${last.saleAfter ? `−${last.saleAfter} % gesetzt` : "Rabatt entfernt"}</span>${undo}</span>`;
    }
    return `<span class="sr-ac"><button type="button" class="sr-edit" data-sr-act="rb:${id}" title="Rabatt dieses Lots bei Bricklink setzen (Sale in Prozent)">RABATT SETZEN</button></span>`;
  }
  // Die letzte erfolgreiche Aenderung dieses Lots aus dem Protokoll der Aenderungen (aelteste zuerst) oder null; kind "price" (PREIS ANPASSEN) oder "sale" (RABATT SETZEN)
  function lastOk(hist, id, kind = "price") {
    for (let i = hist.length - 1; i >= 0; i--) {
      const c = hist[i];
      if (c && String(c.id) === String(id) && c.result === "ok" && (c.kind || "price") === kind && isNum(c.effectiveAfter)) return c;
    }
    return null;
  }
  // Wurde das Lot von hier aus geaendert, nachdem die Zeile entstand, und zeigt die Zeile noch den alten Preis? (Spaetestens der naechste Sync prueft das Lot neu.)
  const staleChange = (r, last) => !!last && Math.abs(last.effectiveAfter - r.price) > 0.0005 && String(last.at || "").slice(0, 10) >= String(r.day || "");
  // Meldung, wenn der Workflow ein Lot bewusst nicht angefasst hat
  const skipText = (why) => (/inzwischen/.test(why) ? "Preis oder Rabatt dieses Lots haben sich inzwischen geändert (in Bricklink oder hier), darum habe ich nichts angefasst. Beim nächsten Abgleich wird es neu geprüft."
    : /schon so/.test(why) ? "Bei Bricklink ist es schon so eingestellt, es gab nichts zu ändern." : `Nicht geändert: ${why}.`);
  // Knopf oder Zustand rechts in der Zeile: PREIS ANPASSEN, "wird geaendert" oder (nach einer Aenderung, solange die Zeile noch den alten Preis zeigt) Haken mit RUECKGAENGIG
  function editHtml(r, ui, last, chg) {
    if (!ui.canEdit || r.id === undefined || r.id === null) return "";
    const id = esc(String(r.id));
    if (ui.busy.has(String(r.id))) return `<span class="sr-ac"><span class="sr-busy" role="status">Bricklink wird geändert …</span></span>`;
    if (chg) {
      const undo = isNum(last.effectiveBefore) ? `<button type="button" class="sr-edit sr-undo" data-sr-act="peu:${id}" title="Preis wieder auf ${esc(exact(last.effectiveBefore))} setzen">RÜCKGÄNGIG</button>` : "";
      return `<span class="sr-ac"><span class="sr-ok">✓ jetzt ${exact(last.effectiveAfter)}</span>${undo}</span>`;
    }
    return `<span class="sr-ac"><button type="button" class="sr-edit" data-sr-act="pe:${id}" title="Preis dieses Lots bei Bricklink ändern">PREIS ANPASSEN</button></span>`;
  }

  // Wann zuletzt kontrolliert wurde: "heute 14:41", "gestern 09:12" oder "23.11. 09:12"
  function whenText(iso) {
    const d = new Date(iso);
    if (!isFinite(d.getTime())) return "";
    const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`, diff = Math.round((day0(new Date()) - day0(d)) / DAY);
    return diff === 0 ? `heute ${hm}` : diff === 1 ? `gestern ${hm}` : `${d.getDate()}.${d.getMonth() + 1}. ${hm}`;
  }
  // Zeile oben im Preis-Check: wann zuletzt kontrolliert wurde (die Kontrolle laeuft alle 2 Stunden von selbst, siehe .github/workflows/check-prices.yml) und der Knopf JETZT PRUEFEN
  function standHtml(P, ui) {
    const at = P.liveAt || P.checkedAt, w = at ? whenText(at) : "";
    const late = !!P.liveAt && Date.now() - Date.parse(P.liveAt) > 9 * 3600000;
    const n = P.liveAt && isNum(P.liveChecked) && P.liveChecked > 0 ? ` (${de(P.liveChecked, 0)} Lots geprüft)` : "";
    const txt = late ? `Zuletzt kontrolliert: ${w}${n}. Die automatische Kontrolle hat sich länger nicht gemeldet.` : w ? `Zuletzt kontrolliert: ${w}${n}. Die Liste wird alle 2 Stunden automatisch erneuert.` : "Die Liste wird automatisch erneuert.";
    const btn = ui.canCheck ? `<button type="button" class="sr-edit sr-chk" data-sr-act="pcnow"${ui.checking ? " disabled" : ""}>${ui.checking ? "PRÜFUNG LÄUFT …" : "JETZT PRÜFEN"}</button>` : "";
    return `<div class="sr-pcbar"><span class="sr-stand${late ? " sr-late" : ""}">${esc(txt)}</span>${btn}</div>`;
  }
  const devText = (dev) => `${dev > 0 ? "+" : dev < 0 ? "−" : ""}${Math.abs(dev)} %`;
  // Eine Zeile der Liste "Erledigt": das Lot hat jetzt einen passenden Preis (why "price"), ist weg (why "gone") oder der Unterschied ist zu klein geworden (why "small")
  function doneRow(i, d) {
    const day = typeof d.day === "string" && d.day.length === 10 ? `<span class="sr-m"><span class="sr-nb">erkannt am ${dm(d.day)}</span></span>` : "";
    let right;
    if (d.why === "gone") right = `<span class="sr-pr"><s>${exact(d.from)}</s> → <b>nicht mehr im Shop</b></span><span class="sr-m">verkauft, gelöscht oder im Stockroom</span>${day}`;
    else if (d.why === "small") right = `<span class="sr-pr"><b class="sr-ok">✓ erledigt</b></span><span class="sr-m">Unterschied jetzt unter 0,50 € (${de(d.qty, 0)} Stück)</span>${day}`;
    else right = `<span class="sr-pr"><s>${exact(d.from)}</s> → <b>${exact(d.to)}</b></span><span class="sr-m"><b class="sr-ok">✓ passt jetzt</b>${isNum(d.dev) ? ` <span class="sr-nb">${devText(d.dev)} zum Ø ${exact(d.avg)}</span>` : ""}</span>${day}`;
    return itemRow(i + 1, d, right);
  }

  // Preis-Check: oben der Stand und der Knopf JETZT PRUEFEN, dann die Reiter "Zu teuer" / "Zu billig" / "Erledigt", darunter die Lots mit der groessten Abweichung in Prozent zuerst
  // (zehn, auf Wunsch alle gespeicherten). "Erledigt" zeigt, was sich seit der letzten Kontrolle geaendert hat oder weg ist (lib/pricecheck.mjs refreshRows); NEU kennzeichnet Zeilen,
  // die in den letzten drei Tagen zum ersten Mal auffielen.
  function priceHtml(model, ui) {
    const P = model.prices;
    if (!P) return `<p class="sr-note">Die Liste kommt mit dem nächsten Sync.</p>`;
    const tab = ui.pc === "under" ? "under" : ui.pc === "done" ? "done" : "over";
    const tabBtn = (id, label, n) => `<button type="button" class="sr-tab" data-sr-act="pc:${id}" aria-pressed="${tab === id}">${label} (${n})</button>`;
    const tabs = `<div class="sr-tabs" role="group" aria-label="Liste wählen">${tabBtn("over", "Zu teuer", P.over.length)}${tabBtn("under", "Zu billig", P.under.length)}${tabBtn("done", "Erledigt", P.done.length)}</div>`;
    let list;
    if (tab === "done") {
      list = P.done.length
        ? `<ol class="sr-items">${P.done.map((d, i) => doneRow(i, d)).join("")}</ol><p class="sr-note">Erledigtes bleibt eine Woche stehen und verschwindet dann von selbst.</p>`
        : `<p class="sr-note">Noch nichts erledigt: Sobald sich der Preis eines Lots aus der Liste ändert oder es verkauft ist, steht es hier (eine Woche lang).</p>`;
    } else {
      const rows = P[tab], shown = ui.pcMore ? rows : rows.slice(0, 10);
      list = shown.length
        ? `<ol class="sr-items">${shown.map((r, i) => {
          const up = r.dev > 0, sign = up ? "+" : "−";
          const last = ui.canEdit ? lastOk(ui.hist, r.id) : null, chg = staleChange(r, last);
          const isNew = typeof r.since === "string" && r.since >= P.newSince;
          const was = isNum(r.was) ? `<span class="sr-m">schon geändert, war ${exact(r.was)}</span>` : "";
          return itemRow(i + 1, r, `<span class="sr-pr"><b>${price(r.price)}</b> <span class="sr-vs">statt Ø ${price(r.avg)}</span></span><span class="sr-m"><b class="sr-dev ${up ? "sr-dev-up" : "sr-dev-down"}">${sign}${Math.abs(r.dev)} %</b> <span class="sr-nb">bei ${de(r.n, 0)} Verkäufen</span></span><span class="sr-m"><span class="sr-nb">${de(r.qty, 0)} Stück ·</span> <span class="sr-nb">${sign}${eur2(Math.abs(r.diff))} im Lot</span></span>${was}${editHtml(r, ui, last, chg)}`, chg ? "sr-changed" : "", isNew ? `<span class="sr-new">NEU</span>` : "");
        }).join("")}</ol>${rows.length > shown.length ? `<button type="button" class="sr-more" data-sr-act="pcmore">Alle ${rows.length} anzeigen</button>` : ""}`
        : `<p class="sr-note">${tab === "over" ? "Bisher kein Lot gefunden, das deutlich über dem Durchschnitt liegt." : "Bisher kein Lot gefunden, das deutlich unter dem Durchschnitt liegt."}</p>`;
    }
    const cover = `Geprüft wird in Etappen, weil Bricklink nur begrenzt viele Abfragen am Tag erlaubt: heute ${de(P.checked, 0)} von ${de(P.eligible, 0)} Lots, ein voller Durchlauf dauert ${P.cycleDays} ${P.cycleDays === 1 ? "Tag" : "Tage"}. Zusätzlich wird alle 2 Stunden der Bestand mit der Liste verglichen (geänderte Preise, verkaufte Lots), neu eingestellte Lots werden gleich geprüft und ein Durchlauf prüft weitere Lots der Reihe nach, damit die Liste nachwächst.`;
    return `${standHtml(P, ui)}${tabs}${list}<p class="sr-note">Verglichen wird dein Preis mit dem Durchschnitt der Verkäufe der letzten 6 Monate (${P.region === "europe" ? "Europa" : esc(P.region || "weltweit")}, ohne MwSt., nach Stückzahl gewichtet), nur Teile und Minifiguren ab ${de(P.minValue, 0)} € Warenwert, mindestens ${P.minSales} Verkäufe, Abweichung ab ${P.minDev} %. Sortiert ist nach der Abweichung in Prozent, die größte zuerst; „Im Lot“ ist der Unterschied für die ganze Menge. ${cover}</p>`;
  }

  function panelHtml(model, ui) {
    const note = (t) => (t ? `<p class="sr-insight">${esc(t)}</p>` : "");
    const infoTxt = `<div class="sr-info" ${ui.info ? "" : "hidden"}><span class="sr-kl">SO LIEST DU DEN RADAR</span>
      <p>Die Hinweise sind feste Regeln, keine Schätzung: Sie vergleichen die letzten 4 vollen Wochen mit den 4 Wochen davor, den letzten vollen Monat mit den Monaten davor, deine Bricklink-Zeit mit deinem Wochen-Soll und dein Tempo beim Einstellen mit dem Jahresziel.</p>
      <p>Das Wochenziel für neue Teile folgt aus dem Jahresziel „Bricklink-Teile“: Was bis zum Jahresende fehlt, geteilt durch die Wochen, die noch bleiben. Es ändert sich also von Woche zu Woche, Verkäufe sind nicht eingerechnet.</p>
      <p>Der Lagerwert ist der Verkaufswert (Menge mal Preis), nicht dein Einkaufspreis. „Neu eingestellt“ zählt nur Lots, die noch im Bestand sind. Bestseller zählen die Stückzahl je Monat (neu und gebraucht zusammen), die Bilder kommen direkt von Bricklink.</p>
      <p>Der Preis-Check vergleicht deine Preise mit den Verkaufspreisen der letzten 6 Monate bei Bricklink. Weil dafür je Lot eine Abfrage nötig ist und Bricklink nur begrenzt viele am Tag erlaubt, wird täglich ein Teil deiner Lots geprüft.</p>
      <p>PREIS ANPASSEN ändert den Preis dieses einen Lots sofort bei Bricklink (nur der Preis, und nur wenn er dort noch so ist wie hier angezeigt). Mit RÜCKGÄNGIG stellst du den alten Preis wieder her. Ein eigener Rabatt auf das Lot bleibt dabei erhalten. RABATT SETZEN im Rabattvorschlag stellt den Rabatt (Sale in Prozent) beim Lot ein, der Listenpreis bleibt; auch das lässt sich mit RÜCKGÄNGIG zurücknehmen.</p>
      <p>Alle 2 Stunden wird dein Bestand mit der Preis-Check-Liste verglichen: Lots, deren Preis du geändert hast (in Bricklink oder hier) oder die verkauft sind, wandern für eine Woche in „Erledigt“ und verschwinden dann von selbst. Neu eingestellte Lots werden gleich geprüft, dazu kommen bei jeder Kontrolle weitere Lots der Reihe nach dran (so wächst die Liste nach); was in den letzten drei Tagen zum ersten Mal auffiel, trägt NEU. JETZT PRÜFEN startet die Kontrolle sofort und prüft dabei etwas mehr Lots.</p>
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
      <section class="sr-box"><h4>Rabattvorschlag</h4><p class="sr-sub">Die zehn Ladenhüter, die du am ehesten im Preis senken könntest, getrennt nach Teilen und Minifiguren.</p>${slowHtml(model, ui)}</section>
      <section class="sr-box"><h4>Preis-Check</h4><p class="sr-sub">Teile und Minifiguren, deren Preis stark vom Durchschnitt der letzten 6 Monate abweicht.</p>${priceHtml(model, ui)}</section>
      <p class="sr-foot">Keine Kundendaten: keine Namen, Adressen oder Nachrichten von Käufern. Gespeichert sind Zahlen und die drei Artikellisten. Quellen: Bricklink-API und Zeittracker.</p>`;
  }

  function teaser(model) {
    if (model.issues > 0) return `${model.issues} ${model.issues === 1 ? "Hinweis" : "Hinweise"}: ${model.hints[0].title}`;
    if (model.hints.some((h) => h.level === "ok")) return "keine Auffälligkeiten";
    return model.hints.length ? model.hints[0].title : "";
  }

  // Die Rechnung hinter dem Wochenziel (Ø der letzten vier vollen Wochen, Prognose zum Stichtag) fuer andere Stellen: die Zielkarte "Bricklink-Teile" in script.js
  // zeigt so dieselben Zahlen wie das Radar. Gibt null, solange die Teile je Woche noch nicht da sind oder das Ziel fehlt.
  function partsPlan(inventory, yearGoal, now) {
    const d = now || new Date(), inv = inventory && isNum(inventory.lots) ? inventory : null;
    return buildPlan(inv, yearGoal, d, mondayKey(d));
  }

  window.ShopRadarCalc = { compute, partsPlan };

  window.createShopRadar = function (deps) {
    const { data } = deps;
    const UI_KEY = "dashboard-shopradar-ui";
    // Auf/zu und Erklaerung: nur dieser Browser, standardmaessig zu; der gewaehlte Monat gilt nur bis zum Neuladen
    const ui = { open: false, info: false, month: null, pc: "over", pcMore: false, slow: "parts", canEdit: !!deps.priceEdit, busy: new Set(), hist: [], histTried: false, asking: false, canCheck: !!deps.priceCheck, checking: false };
    try { const u = JSON.parse(localStorage.getItem(UI_KEY) || "{}"); ui.open = u.open === true; ui.info = u.info === true; ui.slow = u.slow === "minis" ? "minis" : "parts"; } catch (e) { /* egal */ }
    const saveUi = () => { try { localStorage.setItem(UI_KEY, JSON.stringify({ open: ui.open, info: ui.info, slow: ui.slow })); } catch (e) { /* egal */ } };

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
        loadHistory();
      } else panel.textContent = "";
      if (card) card.classList.toggle("sr-open", ui.open);
    }
    function refresh() {
      hosts.forEach((h) => { h._srModel = null; render(h); });
      const mdl = hosts.size ? [...hosts][0]._srModel : null;
      if (mdl) goalXp(mdl);
    }
    /* ---------- Preis bei Bricklink aendern (Preis-Check) ---------- */
    const findRow = (id) => {
      const h = [...hosts][0], P = h && h._srModel && h._srModel.prices;
      return P ? P.over.concat(P.under).find((r) => String(r.id) === String(id)) || null : null;
    };
    const histKey = (c) => `${c.batch}|${c.id}`;
    // Bisherige Aenderungen aus dem privaten Repo: einmal je Seitenaufruf und nur mit Token; ohne Zugriff bleiben die Zeilen ohne Markierung
    function loadHistory() {
      if (!ui.canEdit || ui.histTried) return;
      ui.histTried = true;
      Promise.resolve().then(() => deps.priceEdit.history()).then((rows) => {
        if (!Array.isArray(rows)) return;
        const have = new Set(rows.map(histKey));
        ui.hist = rows.filter((c) => c && typeof c === "object").concat(ui.hist.filter((c) => !have.has(histKey(c))));
        refresh();
      }).catch(() => { /* kein Token oder offline: ohne Markierungen weiter */ });
    }
    // Ein Auftrag mit einer Aenderung: Zeile auf "wird geaendert" stellen, auf das Ergebnis warten, melden
    async function runEdit(changes) {
      const id = String(changes[0].id), say = deps.toast || (() => {}), sale = changes[0].kind === "sale";
      ui.busy.add(id);
      refresh();
      say(sale ? "Der Rabatt wird bei Bricklink gesetzt. Das dauert etwa eine halbe Minute." : "Der Preis wird bei Bricklink geändert. Das dauert etwa eine halbe Minute.", "info", 7000);
      try {
        const rows = await deps.priceEdit.run(changes);
        const row = rows.find((x) => String(x.id) === id) || rows[0];
        ui.hist = ui.hist.concat(rows);
        if (row && row.result === "ok" && sale) say(row.saleAfter ? `Rabatt gesetzt: ${row.no} hat jetzt −${row.saleAfter} %, Käufer zahlen ${pr(row.effectiveAfter)} (vorher ${pr(row.effectiveBefore)}).` : `Rabatt entfernt: ${row.no} hat keinen Rabatt mehr, Käufer zahlen wieder ${pr(row.effectiveAfter)}.`, "ok", 9000);
        else if (row && row.result === "ok") say(`Preis geändert: ${row.no} steht jetzt bei ${pr(row.effectiveAfter)} (vorher ${pr(row.effectiveBefore)}).`, "ok", 9000);
        else if (row && row.result === "skipped") say(skipText(String(row.why || "")), "warn", 10000);
        else say(`Bricklink hat ${sale ? "den Rabatt" : "den Preis"} nicht geändert: ${row && row.why ? row.why : "keine Antwort"}`, "err", 10000);
      } catch (e) {
        const msg = e && e.message ? e.message : "unbekannter Fehler";
        say(/^Unklar/.test(msg) ? msg : `${sale ? "Rabatt" : "Preis"} nicht geändert: ${msg}`, "err", 12000);
      }
      ui.busy.delete(id);
      refresh();
    }
    // PREIS ANPASSEN: kleines Fenster mit dem Durchschnitt der letzten 6 Monate als Vorschlag, dann der Auftrag
    async function editPrice(id) {
      const r = findRow(id);
      if (!r || !ui.canEdit || ui.busy.has(id) || ui.asking) return;
      ui.asking = true;
      let target = null;
      try {
        const colorTxt = r.colorName || (r.color ? `Farbe ${r.color}` : "");
        const sub = `${r.no} · ${decode(r.name)}${colorTxt ? ` · ${colorTxt}` : ""}${r.cond === "N" ? " · neu" : r.cond === "U" ? " · gebraucht" : ""} · ${de(r.qty, 0)} Stück. Im Shop zuletzt ${exact(r.price)}${/^\d{4}-\d{2}-\d{2}$/.test(String(r.day)) ? ` (geprüft am ${dm(r.day)})` : ""}, Durchschnitt der letzten 6 Monate ${exact(r.avg)}. Es zählt der Preis, den Käufer sehen (nach einem eigenen Rabatt). Er gilt bei Bricklink sofort.`;
        let value = String(Math.max(MIN_PRICE, Math.round(r.avg * 1000) / 1000)).replace(".", ",");
        for (;;) {
          const v = await deps.askForm({ title: "Preis bei Bricklink ändern", sub, fields: [{ label: "Neuer Preis in €", value }], okText: "Bei Bricklink ändern" });
          if (!v) return;
          value = v[0];
          const t = parsePrice(value), why = priceProblem(t, r.price);
          if (!why) { target = t; break; }
          if (deps.toast) deps.toast(why, "warn", 7000);
        }
      } finally { ui.asking = false; }
      await runEdit([{ id, expect: r.price, target }]);
    }
    // RUECKGAENGIG: der Preis vor der letzten Aenderung (so, wie ihn Käufer sahen) kommt zurück
    async function undoPrice(id) {
      const last = lastOk(ui.hist, id);
      if (!last || !isNum(last.effectiveBefore) || !ui.canEdit || ui.busy.has(id) || ui.asking) return;
      ui.asking = true;
      let ok = null;
      try {
        ok = await deps.askForm({ title: "Preisänderung rückgängig machen?", sub: `${last.no}: Der Preis geht von ${exact(last.effectiveAfter)} wieder auf ${exact(last.effectiveBefore)} zurück. Das gilt bei Bricklink sofort.`, fields: [], okText: "Rückgängig machen" });
      } finally { ui.asking = false; }
      if (ok) await runEdit([{ id, expect: last.effectiveAfter, target: last.effectiveBefore }]);
    }
    // RABATT SETZEN: kleines Fenster mit dem Vorschlag nach Alter, dann der Auftrag (nur der Rabatt des Lots, der Listenpreis bleibt)
    const findSlowRow = (id) => {
      const h = [...hosts][0], L = h && h._srModel && h._srModel.lager;
      return L ? [].concat(L.slowParts || [], L.slowMinis || []).find((r) => String(r.id) === String(id)) || null : null;
    };
    async function editSale(id) {
      const r = findSlowRow(id);
      if (!r || !ui.canEdit || ui.busy.has(id) || ui.asking) return;
      ui.asking = true;
      let target = null;
      try {
        const colorTxt = r.colorName || (r.color ? `Farbe ${r.color}` : "");
        const sub = `${r.no} · ${decode(r.name)}${colorTxt ? ` · ${colorTxt}` : ""}${r.cond === "N" ? " · neu" : r.cond === "U" ? " · gebraucht" : ""} · ${de(r.qty, 0)} Stück, seit ${ageText(r.age)} im Shop. Listenpreis ${exact(r.price)}${r.sale > 0 ? `, jetzt schon −${r.sale} %` : ""}; mit −${r.pct} % zahlen Käufer ${exact(r.newPrice)}. Der Rabatt (Sale in Prozent) gilt bei Bricklink sofort, der Listenpreis bleibt.`;
        let value = String(r.pct);
        for (;;) {
          const v = await deps.askForm({ title: "Rabatt bei Bricklink setzen", sub, fields: [{ label: "Rabatt in %", value }], okText: "Bei Bricklink setzen" });
          if (!v) return;
          value = v[0];
          const t = parseSale(value), why = saleProblem(t, r.sale);
          if (!why) { target = t; break; }
          if (deps.toast) deps.toast(why, "warn", 7000);
        }
      } finally { ui.asking = false; }
      await runEdit([{ id, kind: "sale", expect: r.price, expectSale: r.sale || 0, target }]);
    }
    // RUECKGAENGIG im Rabattvorschlag: der Rabatt vor der letzten Aenderung kommt zurueck
    async function undoSale(id) {
      const last = lastOk(ui.hist, id, "sale");
      if (!last || !isNum(last.saleBefore) || !isNum(last.listBefore) || !ui.canEdit || ui.busy.has(id) || ui.asking) return;
      ui.asking = true;
      let ok = null;
      try {
        ok = await deps.askForm({ title: "Rabatt zurücknehmen?", sub: `${last.no}: Der Rabatt geht von −${last.saleAfter} % wieder auf ${last.saleBefore ? `−${last.saleBefore} %` : "keinen Rabatt"} zurück. Das gilt bei Bricklink sofort.`, fields: [], okText: "Rückgängig machen" });
      } finally { ui.asking = false; }
      if (ok) await runEdit([{ id, kind: "sale", expect: last.listBefore, expectSale: last.saleAfter, target: last.saleBefore }]);
    }
    // JETZT PRUEFEN: startet die Kontrolle bei GitHub (Workflow check-prices.yml), wartet, holt den frischen Stand und sagt, was neu und was erledigt ist
    async function checkNow() {
      if (!ui.canCheck || ui.checking) return;
      const say = deps.toast || (() => {});
      const idsOf = (l) => new Set((Array.isArray(l) ? l : []).map((r) => String(r.id)));
      const old = (data && data.bricklinkPrices) || {};
      const before = { rows: idsOf((old.over || []).concat(old.under || [])), done: idsOf(old.done) };
      ui.checking = true;
      refresh();
      say("Die Prüfung läuft. Das dauert etwa eine Minute.", "info", 7000);
      try {
        const res = await deps.priceCheck.run();
        const fresh = res && res.prices ? res.prices : res;
        if (fresh && typeof fresh === "object" && data) data.bricklinkPrices = fresh;
        if (res && res.inventory && typeof res.inventory === "object" && data) data.bricklinkInventory = res.inventory;
        const nNew = ((fresh && fresh.over) || []).concat((fresh && fresh.under) || []).filter((r) => !before.rows.has(String(r.id))).length;
        const nDone = ((fresh && fresh.done) || []).filter((d) => !before.done.has(String(d.id))).length;
        const checked = fresh && isNum(fresh.liveChecked) ? fresh.liveChecked : null;
        const part = checked !== null ? ` (${de(checked, 0)} Lots geprüft)` : "";
        const limit = checked === 0 && fresh.sweepLeft === 0 ? " Das Tageslimit für zusätzliche Abfragen ist erreicht." : "";
        say(nNew || nDone ? `Preis-Check aktualisiert: ${nNew} neu, ${nDone} erledigt${part}.${limit}` : `Preis-Check aktualisiert: keine Änderung${part}.${limit}`, "ok", 9000);
      } catch (e) {
        say(`Prüfung nicht abgeschlossen: ${e && e.message ? e.message : "unbekannter Fehler"}`, "err", 12000);
      }
      ui.checking = false;
      refresh();
    }
    function onClick(e) {
      const b = e.target.closest("[data-sr-act]");
      if (!b) return;
      const act = b.dataset.srAct;
      if (act === "toggle") { ui.open = !ui.open; saveUi(); refresh(); }
      else if (act === "info") { ui.info = !ui.info; saveUi(); refresh(); }
      else if (act.startsWith("month:")) { ui.month = act.slice(6); refresh(); }
      else if (act === "pc:over" || act === "pc:under" || act === "pc:done") { ui.pc = act.slice(3); ui.pcMore = false; refresh(); }
      else if (act === "pcnow") checkNow();
      else if (act === "pcmore") { ui.pcMore = true; refresh(); }
      else if (act === "slow:parts" || act === "slow:minis") { ui.slow = act.slice(5); saveUi(); refresh(); }
      else if (act.startsWith("peu:")) undoPrice(act.slice(4));
      else if (act.startsWith("pe:")) editPrice(act.slice(3));
      else if (act.startsWith("rbu:")) undoSale(act.slice(4));
      else if (act.startsWith("rb:")) editSale(act.slice(3));
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
