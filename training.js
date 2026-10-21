/* Trainingstracker (Bereich "Training"): Plan mit Trainingstagen, Workout-Modus mit Pause-Timer, Verlauf und Statistiken.
   Gebaut aus pixel-dschungel-wip/training (build_training.py) - nicht von Hand bearbeiten, die Quellen liegen im wip-Ordner.
   Speicherort der Daten:
     - Cloud: training-data.json im Repo (eigene Datei, nicht Teil von sync-data.json), Plan/Ruhetage/Einstellungen nach Zeitstempel,
       Einheiten und eigene Uebungen als Liste mit Loesch-Markern (mehrere Geraete werden vereinigt, nichts geht verloren).
     - lokal (nur dieses Geraet, bewusste Ausnahme von Cloud-only wegen Handy im Studio ohne Netz): dashboard-training-cache (Kopie des
       Standes + "noch nicht hochgeladen"-Marke) und dashboard-training-draft (das gerade laufende Workout).
   Verknuepfung: neuer Rekord = 10 XP, Steigerung gegenueber dem letzten Mal = 5 XP (nur als Extra, hoechstens 8 pro Einheit); am Ende
   einer Einheit wird das Habit "Gym" abgehakt (script.js: setHabitDone).
   script.js uebergibt: main (Container), syncEl (Statusanzeige), readCloudJson, getGithubConfig, escapeHtml, todayKey, xp, habitDone, status,
   serial (Warteschlange fuer Schreibzugriffe auf GitHub, eine nach der anderen), wrote (meldet einen Schreibzugriff). */

(function () {
  "use strict";

  /* ==========================================================================
     Daten: Muskelgruppen, Geraete, Farben, Uebungskatalog (244 Uebungen), Vorlagen, Pixel-Symbole
     ========================================================================== */
  const GROUPS = ["Brust", "Rücken", "Schultern", "Arme", "Beine", "Po", "Bauch", "Ausdauer"];
  const GCOL = { "Brust": "#e66767", "Rücken": "#3987e5", "Schultern": "#f4c542", "Arme": "#9085e9", "Beine": "#5fbf63", "Po": "#e89ab8", "Bauch": "#f08a24", "Ausdauer": "#7fd1d9" };
  const GSHORT = { "Brust": "BRU", "Rücken": "RÜC", "Schultern": "SCH", "Arme": "ARM", "Beine": "BEI", "Po": "PO", "Bauch": "BAU", "Ausdauer": "AUS" };
  const EQ = { F: { n: "FREIHANTEL", c: "#e66767" }, M: { n: "MASCHINE", c: "#3987e5" }, K: { n: "KABEL", c: "#9085e9" }, E: { n: "EIGENGEWICHT", c: "#8d8d99" } };
  /* Tagesfarben (15, wie in der Vorlage) */
  const COLORS = ["#b01c1c", "#e84040", "#6b0f0f", "#b0a8a8", "#e0e0e0", "#2f6fe0", "#18a0ec", "#18b9a4", "#17a34a", "#84cc16", "#f59e0b", "#f97316", "#a855f7", "#ec4899", "#8a4b14"];

  /* Katalog: "Name|Geraet" je Gruppe (F Freihantel, M Maschine, K Kabel, E Eigengewicht) */
  const CAT = {
    "Brust": [
      "Bankdrücken (LH)|F", "Bankdrücken (KH)|F", "Bankdrücken (Multipresse)|M", "Schrägbankdrücken (LH)|F", "Schrägbankdrücken (KH)|F", "Schrägbankdrücken (Multipresse)|M",
      "Negativbankdrücken (LH)|F", "Negativbankdrücken (KH)|F", "Fliegende (KH)|F", "Schrägbank-Fliegende (KH)|F", "Überzüge (KH)|F", "Brustpresse|M", "Schräge Brustpresse|M",
      "Butterfly|M", "Kabel-Crossover|K", "Kabelzug-Fliegende (hoch)|K", "Kabelzug-Fliegende (tief)|K", "Kabelzug-Fliegende (mittig)|K", "Einarmiges Kabeldrücken|K",
      "Liegestütze|E", "Liegestütze (Füße erhöht)|E", "Liegestütze (Knie)|E", "Dips (Brust)|E", "Dips-Maschine (Brust)|M", "Floor Press (KH)|F", "Svend Press|F", "Hammer-Strength-Brustpresse|M"
    ],
    "Rücken": [
      "Klimmzüge (breit)|E", "Klimmzüge (eng)|E", "Klimmzüge (neutral)|E", "Klimmzüge (Untergriff)|E", "Klimmzüge (assistiert)|M", "Latzug (breit)|K", "Latzug (eng)|K", "Latzug (neutral)|K",
      "Latzug (Untergriff)|K", "Latzug (einarmig)|K", "Latzug (Maschine)|M", "Geradarmdrücken am Kabel|K", "Langhantelrudern (vorgebeugt)|F", "Langhantelrudern (Untergriff)|F", "Pendlay-Rudern|F",
      "Kurzhantelrudern (einarmig)|F", "Kurzhantelrudern (beidarmig)|F", "Brustgestütztes Rudern (KH)|F", "Brustgestütztes Rudern (Maschine)|M", "Meadows-Rudern|F", "T-Bar-Rudern|F",
      "T-Bar-Rudermaschine|M", "Rudermaschine (sitzend)|M", "Rudermaschine (breit)|M", "Hammer-Strength-Rudern|M", "Kabelrudern (eng)|K", "Kabelrudern (breit)|K", "Kabelrudern (einarmig)|K",
      "Rudern (Multipresse)|M", "Umgekehrtes Rudern|E", "Pullover am Kabel|K", "Pullover (Maschine)|M", "Rückenstrecker (Maschine)|M", "Hyperextensions|E", "Hyperextensions (mit Gewicht)|F",
      "Good Mornings (LH)|F", "Rack Pulls|F", "Shrugs (KH)|F", "Shrugs (LH)|F", "Shrugs (Multipresse)|M", "Supermans|E", "Reverse Hyperextension|M", "Seal-Rudern|F"
    ],
    "Schultern": [
      "Schulterdrücken (LH)|F", "Schulterdrücken (KH)|F", "Schulterdrücken (Multipresse)|M", "Schulterpresse (Maschine)|M", "Arnold Press (KH)|F", "Militärpresse (LH)|F", "Push Press (LH)|F",
      "Seitheben (KH)|F", "Seitheben am Kabel|K", "Seitheben (Maschine)|M", "Seitheben (einarmig, Kabel)|K", "Frontheben (KH)|F", "Frontheben (LH)|F", "Frontheben am Kabel|K",
      "Reverse Butterfly|M", "Reverse Fliegende (KH)|F", "Reverse Fliegende am Kabel|K", "Face Pulls|K", "Aufrechtes Rudern (LH)|F", "Aufrechtes Rudern am Kabel|K", "Nackenheben (LH)|F",
      "Landmine Press|F", "Pike-Liegestütze|E", "Handstand-Liegestütze|E", "Seitheben (vorgebeugt, KH)|F"
    ],
    "Arme": [
      "Bizepscurls (LH)|F", "Bizepscurls (KH)|F", "Bizepscurls (SZ-Stange)|F", "Hammer-Curls|F", "Hammer-Curls am Kabel (Seil)|K", "Konzentrationscurls|F", "Scott-Curls (SZ-Stange)|F", "Scott-Curls (Maschine)|M",
      "Bizepsmaschine|M", "Kabelcurls|K", "Kabelcurls (einarmig)|K", "Schrägbank-Curls (KH)|F", "Spider-Curls|F", "Zottman-Curls|F", "Reverse Curls (SZ-Stange)|F", "Curls am hohen Kabel|K",
      "Bizeps-Klimmzüge (Untergriff, eng)|E", "21er-Curls|F", "Preacher-Hammer-Curls|F", "Drag Curls|F",
      "Trizeps-Pushdown (Seil)|K", "Trizeps-Pushdown (Stange)|K", "Trizeps-Pushdown (einarmig)|K", "Trizeps-Pushdown (Untergriff)|K", "Überkopfdrücken (KH)|F", "Trizepsstrecken über Kopf (Kabel)|K",
      "Trizepsstrecken über Kopf (SZ-Stange)|F", "Skullcrushers (SZ-Stange)|F", "Skullcrushers (KH)|F", "Enges Bankdrücken (LH)|F", "Enges Bankdrücken (Multipresse)|M", "Dips am Barren (Trizeps)|E",
      "Bank-Dips|E", "Dips-Maschine (Trizeps)|M", "Trizepsmaschine|M", "Kickbacks (KH)|F", "Kickbacks am Kabel|K", "Diamond-Liegestütze|E", "JM Press|F", "Tate Press (KH)|F",
      "Handgelenkcurls (LH)|F", "Reverse-Handgelenkcurls (LH)|F", "Handgelenkcurls (KH)|F", "Farmer's Walk|F", "Unterarmrolle|F"
    ],
    "Beine": [
      "Kniebeugen (LH)|F", "Frontkniebeugen (LH)|F", "Kniebeugen (Multipresse)|M", "Goblet Squats (KH)|F", "Hackenschmidt-Kniebeugen|M", "Pendulum Squat|M", "Beinpresse|M", "Beinpresse (einbeinig)|M",
      "Beinpresse (45°)|M", "Beinpresse (horizontal)|M", "Beinstrecker|M", "Beinstrecker (einbeinig)|M", "Sissy Squats|E", "Wandsitzen|E", "Kniebeugen (Eigengewicht)|E", "Sprungkniebeugen|E",
      "Bulgarian Split Squats (KH)|F", "Bulgarian Split Squats (Multipresse)|M", "Ausfallschritte (KH)|F", "Ausfallschritte (LH)|F", "Ausfallschritte (Multipresse)|M", "Ausfallschritte (Eigengewicht)|E",
      "Gehende Ausfallschritte (KH)|F", "Rückwärts-Ausfallschritte (KH)|F", "Step-ups (KH)|F", "Step-ups (Eigengewicht)|E", "Beinbeuger (liegend)|M", "Beinbeuger (sitzend)|M", "Beinbeuger (stehend)|M",
      "Beinbeuger (einbeinig)|M", "Rumänisches Kreuzheben (LH)|F", "Rumänisches Kreuzheben (KH)|F", "Kreuzheben|F", "Sumo-Kreuzheben|F", "Kreuzheben (Trap Bar)|F", "Steifbeiniges Kreuzheben (LH)|F",
      "Einbeiniges Kreuzheben (KH)|F", "Nordic Hamstring Curl|E", "Beinbeugen am Kabel|K", "Wadenheben (stehend, Maschine)|M", "Wadenheben (sitzend)|M", "Wadenheben (Multipresse)|M",
      "Wadenheben (Beinpresse)|M", "Wadenheben (einbeinig, KH)|F", "Wadenheben (Eigengewicht)|E", "Tibialis-Heben|E", "Adduktorenmaschine|M", "Abduktorenmaschine|M", "Beinabduktion am Kabel|K",
      "Beinadduktion am Kabel|K", "Seitliche Ausfallschritte (KH)|F", "Cossack Squats|E", "Belt Squat|M"
    ],
    "Po": [
      "Hip Thrust (LH)|F", "Hip Thrust (Multipresse)|M", "Hip Thrust (Maschine)|M", "Hip Thrust (KH)|F", "Glute Bridge|E", "Glute Bridge (LH)|F", "Kabel-Kickbacks|K", "Kickbacks (Maschine)|M",
      "Glute Ham Raise|E", "Frog Pumps|E", "Fire Hydrants|E", "Donkey Kicks|E", "Beckenheben (einbeinig)|E"
    ],
    "Bauch": [
      "Crunches|E", "Crunches am Kabel|K", "Bauchmaschine|M", "Sit-ups|E", "Decline Sit-ups|E", "Reverse Crunches|E", "Beinheben (hängend)|E", "Knieheben (hängend)|E", "Beinheben (liegend)|E",
      "Toes to Bar|E", "Plank|E", "Seitstütz|E", "Plank mit Beinheben|E", "Mountain Climbers|E", "Bicycle Crunches|E", "Russian Twists|E", "Russian Twists (mit Gewicht)|F", "Bauchroller|E",
      "Hollow Hold|E", "Dragon Flag|E", "V-Ups|E", "Heel Taps|E", "Pallof Press|K", "Holzfäller am Kabel|K", "Rotationsmaschine|M", "Seitliche Bauchmaschine|M", "Seitbeugen (KH)|F",
      "Dead Bug|E", "Bird Dog|E", "Landmine Twist|F"
    ],
    "Ausdauer": ["Laufband|M", "Laufen (draußen)|E", "Crosstrainer|M", "Fahrradergometer|M", "Rudergerät|M", "Stepper|M", "Seilspringen|E", "Gehen|E"]
  };
  const slug = (s) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  const EXS = [];
  const EXBY = {};
  GROUPS.forEach((g) => (CAT[g] || []).forEach((row) => {
    const [n, e] = row.split("|");
    let id = slug(n); if (EXBY[id]) id += "-" + slug(g);
    const ex = { id, n, g, e, cat: true };
    EXS.push(ex); EXBY[id] = ex;
  }));

  /* Haltuebungen: hier zaehlt die Zeit statt der Wiederholungen (Beschriftung SEK statt WDH) */
  const TIMED = {};
  ["Plank", "Plank mit Beinheben", "Seitstütz", "Wandsitzen", "Hollow Hold", "Farmer's Walk"].forEach((n) => { const e = EXS.find((x) => x.n === n); if (e) TIMED[e.id] = 1; });

  /* Vorlagen statt KI-Coach: [Uebung, Saetze, Wiederholungen]; Gewichte traegst du beim ersten Training ein */
  const TEMPLATES = [
    { id: "ppl", name: "Push / Pull / Legs", info: "3 Tage: Drücken, Ziehen, Beine", days: [
      { n: "Push", f: "Brust, Schultern, Trizeps", c: 0, ex: [["Bankdrücken (LH)", 3, 8], ["Schrägbankdrücken (KH)", 3, 10], ["Schulterdrücken (KH)", 3, 10], ["Seitheben (KH)", 3, 12], ["Trizeps-Pushdown (Seil)", 3, 12], ["Skullcrushers (SZ-Stange)", 3, 10]] },
      { n: "Pull", f: "Rücken, Bizeps", c: 5, ex: [["Klimmzüge (breit)", 3, 8], ["Langhantelrudern (vorgebeugt)", 3, 8], ["Latzug (eng)", 3, 10], ["Face Pulls", 3, 15], ["Bizepscurls (SZ-Stange)", 3, 10], ["Hammer-Curls", 3, 12]] },
      { n: "Legs", f: "Beine, Bauch", c: 8, ex: [["Kniebeugen (LH)", 4, 8], ["Rumänisches Kreuzheben (LH)", 3, 8], ["Beinpresse", 3, 12], ["Beinbeuger (liegend)", 3, 12], ["Wadenheben (stehend, Maschine)", 4, 15], ["Beinheben (hängend)", 3, 12]] }
    ] },
    { id: "ou", name: "Oberkörper / Unterkörper", info: "2 Tage, 4x pro Woche im Wechsel", days: [
      { n: "Oberkörper", f: "Brust, Rücken, Schultern, Arme", c: 1, ex: [["Bankdrücken (KH)", 3, 8], ["Latzug (breit)", 3, 10], ["Schulterdrücken (KH)", 3, 10], ["Kabelrudern (eng)", 3, 10], ["Seitheben (KH)", 3, 12], ["Bizepscurls (KH)", 2, 12], ["Trizeps-Pushdown (Seil)", 2, 12]] },
      { n: "Unterkörper", f: "Beine, Po, Bauch", c: 8, ex: [["Kniebeugen (LH)", 4, 8], ["Beinpresse", 3, 12], ["Rumänisches Kreuzheben (KH)", 3, 10], ["Beinstrecker", 3, 12], ["Beinbeuger (sitzend)", 3, 12], ["Wadenheben (sitzend)", 4, 15], ["Crunches am Kabel", 3, 15]] }
    ] },
    { id: "gk", name: "Ganzkörper", info: "1 Tag, 3x pro Woche", days: [
      { n: "Ganzkörper", f: "Brust, Rücken, Schultern, Beine", c: 11, ex: [["Kniebeugen (LH)", 3, 8], ["Bankdrücken (LH)", 3, 8], ["Latzug (breit)", 3, 10], ["Schulterdrücken (KH)", 3, 10], ["Rumänisches Kreuzheben (KH)", 2, 10], ["Bizepscurls (KH)", 2, 12], ["Plank", 2, 45]] }
    ] },
    { id: "split", name: "Brust+Rücken / Schultern+Trizeps / Beine+Bizeps", info: "3 Tage, 6 Übungen je Tag", days: [
      { n: "Chest/Back", f: "Chest, Back", c: 0, ex: [["Bankdrücken (Multipresse)", 3, 8], ["Schrägbankdrücken (LH)", 3, 8], ["Butterfly", 3, 10], ["Latzug (breit)", 3, 10], ["Klimmzüge (neutral)", 3, 8], ["T-Bar-Rudermaschine", 3, 10]] },
      { n: "Shoulders/Triceps", f: "Shoulders, Triceps", c: 11, ex: [["Schulterdrücken (KH)", 3, 8], ["Nackenheben (LH)", 2, 10], ["Reverse Butterfly", 3, 12], ["Seitheben am Kabel", 3, 12], ["Trizeps-Pushdown (Seil)", 3, 12], ["Überkopfdrücken (KH)", 2, 12]] },
      { n: "Legs/Biceps", f: "Legs, Biceps", c: 9, ex: [["Kniebeugen (LH)", 2, 8], ["Beinpresse", 3, 12], ["Beinstrecker", 3, 12], ["Kreuzheben", 2, 6], ["Hammer-Curls", 2, 12], ["Bizepsmaschine", 3, 12]] }
    ] }
  ];

  /* ---------- Pixel-Symbole (8x8); "c" = currentColor, so passen sie sich dem Theme an ---------- */
  const ICONS = {
    pencil: ["......cc", ".....cc.", "....cc..", "...cc...", "..cc....", ".ccc....", "cc.c....", "c......."],
    trash: ["..cccc..", "cccccccc", ".c.cc.c.", ".c.cc.c.", ".c.cc.c.", ".c.cc.c.", ".cccccc.", "........"],
    note: [".cccccc.", ".c....c.", ".c.cc.c.", ".c....c.", ".c.cc.c.", ".c....c.", ".cccccc.", "........"],
    grip: ["........", ".cccccc.", "........", ".cccccc.", "........", ".cccccc.", "........", "........"],
    down: ["........", "cc....cc", ".cc..cc.", "..cccc..", "...cc...", "........", "........", "........"],
    up: ["........", "........", "........", "...cc...", "..cccc..", ".cc..cc.", "cc....cc", "........"],
    right: ["..c.....", "..cc....", "..ccc...", "..cccc..", "..ccc...", "..cc....", "..c.....", "........"],
    left: ["....c...", "...cc...", "..ccc...", ".cccc...", "..ccc...", "...cc...", "....c...", "........"],
    check: ["........", "......cc", ".....cc.", "c...cc..", "cc.cc...", ".ccc....", "..c.....", "........"],
    x: ["c......c", "cc....cc", ".cc..cc.", "..cccc..", "..cccc..", ".cc..cc.", "cc....cc", "c......c"],
    plus: ["...cc...", "...cc...", "...cc...", "cccccccc", "cccccccc", "...cc...", "...cc...", "...cc..."],
    minus: ["........", "........", "........", "cccccccc", "cccccccc", "........", "........", "........"],
    dots: ["........", "........", "........", "cc.cc.cc", "cc.cc.cc", "........", "........", "........"],
    clock: ["..cccc..", ".c....c.", "c..c...c", "c..c...c", "c..cc..c", "c......c", ".c....c.", "..cccc.."],
    save: ["...cc...", "...cc...", ".cccccc.", "..cccc..", "...cc...", "c......c", "cccccccc", "........"],
    swap: ["..c.....", ".ccccccc", "..c....c", "......c.", "c....c..", "ccccccc.", ".....c..", "........"],
    moon: ["..cccc..", ".cc.....", "cc......", "cc......", "cc......", ".cc.....", "..cccc..", "........"]
  };
  const SPRITES = {
    dumbbell: { p: { p: "#e8681c", q: "#f4a15a", b: "#c0c6d0" }, r: ["........", ".pp..pp.", "pppqqppp", "pppbbppp", "pppbbppp", "pppqqppp", ".pp..pp.", "........"] },
    bolt: { p: { y: "#f4c542", d: "#b8892a" }, r: ["....yy..", "...yyd..", "..yyd...", ".yyyyyy.", "..ddyy..", "...yy...", "..yy....", "..d....."] },
    medal: { p: { y: "#f4c542", d: "#b8892a", r: "#e0524b", w: "#fff1a8" }, r: ["..r..r..", "..rr.rr.", "...rrr..", "..dyyd..", ".dywyyd.", ".dyyyyd.", "..dyyd..", "........"] },
    flameblue: { p: { f: "#3987e5", o: "#9cc4e4" }, r: ["...f....", "..ff.f..", "..fff.f.", ".fffoff.", ".ffooff.", ".ffooff.", "..fooff.", "...ff..."] }
  };

  /* ==========================================================================
     Pixel-Symbole (16x16) fuer Uebungen und Muskelgruppen, gezeichnet im Stil von Spiele-Sprites:
     dunkler Umriss, drei Toene je Material (dunkel, normal, hell), Glanzpunkte.
     Ein kleiner Zeichner (mkIcon) fuellt Formen mit Materialien; Umriss, Licht (oben links) und Schatten
     (unten rechts, auch dort, wo eine Form von einer anderen verdeckt wird) entstehen automatisch.
     Materialien: s Stahl, k Gummi/dunkel, g Gruppenfarbe (--gc), f Haut, y Gold, w Stoff/weiss, r Rot, t Holz
     ========================================================================== */
  function mkIcon(n, fn) {
    const M = new Array(n * n).fill(""), S = new Array(n * n).fill(0), TH = new Array(n * n).fill(0), TO = {};
    let sid = 0, keep = false, thin = false;
    const inb = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
    const ns = () => { if (!keep) sid++; keep = false; };
    const A = {
      px(x, y, m) { x = Math.round(x); y = Math.round(y); if (inb(x, y)) { M[y * n + x] = m; S[y * n + x] = sid; TH[y * n + x] = thin && m ? 1 : 0; } return A; },
      join() { keep = true; return A; },                       /* die naechste Form gehoert zur vorigen (gemeinsamer Umriss und Schatten) */
      thin(on) { thin = on !== false; return A; },             /* duenne Details (Seil, Speichen, Rillen): ohne Umriss, ohne Schatten, in einer Farbe */
      tone(x, y, w, h, t) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) TO[(y + j) * n + x + i] = t; return A; },
      ring(cx, cy, rx, ry, th, m) {                            /* Ring (Reifen) */
        ns();
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, ex = (x + 0.5 - cx) / (rx - th), ey = (y + 0.5 - cy) / (ry - th);
          if (dx * dx + dy * dy <= 1 && ex * ex + ey * ey > 1) A.px(x, y, m);
        }
        return A;
      },
      spiral(cx, cy, rx, ry, turns, m) {                       /* Spirale von der Mitte nach aussen (1 px) */
        ns();
        const T = turns * 6.2832;
        for (let t = 0.5; t <= T; t += 0.02) { const r = t / T; A.px(Math.floor(cx + rx * r * Math.cos(t)), Math.floor(cy + ry * r * Math.sin(t)), m); }
        return A;
      },
      arc(cx, cy, rx, ry, m, keepFn) {                         /* Kurve (1 px), optional nur dort, wo keepFn(x, y) wahr ist */
        ns();
        for (let a = 0; a < 6.2832; a += 0.015) {
          const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
          if (!keepFn || keepFn(x, y)) A.px(Math.floor(x), Math.floor(y), m);
        }
        return A;
      },
      rect(x, y, w, h, m) { ns(); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) A.px(x + i, y + j, m); return A; },
      rrect(x, y, w, h, m) {                                   /* Rechteck mit abgerundeten Ecken */
        ns();
        for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
          const cx = i === 0 || i === w - 1, cy = j === 0 || j === h - 1;
          if (!(cx && cy && w > 3 && h > 3)) A.px(x + i, y + j, m);
        }
        return A;
      },
      ell(cx, cy, rx, ry, m) {
        ns();
        for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) A.px(x, y, m);
        }
        return A;
      },
      line(x0, y0, x1, y1, m, th) {
        ns(); th = th || 1;
        const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let err = dx - dy, x = x0, y = y0;
        for (let g = 0; g < 100; g++) {
          for (let j = 0; j < th; j++) for (let i = 0; i < th; i++) A.px(x + i, y + j, m);
          if (x === x1 && y === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x += sx; }
          if (e2 < dx) { err += dx; y += sy; }
        }
        return A;
      },
      poly(pts, m) {
        ns();
        const k = pts.length;
        for (let y = 0; y < n; y++) {
          const yc = y + 0.5, xs = [];
          for (let i = 0; i < k; i++) {
            const a = pts[i], b = pts[(i + 1) % k];
            if ((a[1] <= yc && b[1] > yc) || (b[1] <= yc && a[1] > yc)) xs.push(a[0] + ((yc - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
          }
          xs.sort((p, q) => p - q);
          for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.ceil(xs[i] - 0.5); x <= Math.floor(xs[i + 1] - 0.5); x++) A.px(x, y, m);
        }
        return A;
      },
      hi(x, y) { TO[y * n + x] = 3; return A; },
      lo(x, y) { TO[y * n + x] = 1; return A; },
      mid(x, y) { TO[y * n + x] = 2; return A; }
    };
    fn(A);
    const at = (x, y) => (inb(x, y) ? y * n + x : -1);
    const out = new Array(n * n).fill("");
    const D4 = [[0, -1], [-1, 0], [0, 1], [1, 0]];
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x, m = M[i];
      if (!m) continue;
      const s = S[i];
      let covered = false, lit = false, shade = false;
      D4.forEach((d, k) => {
        const j = at(x + d[0], y + d[1]);
        const mj = j < 0 ? "" : M[j], sj = j < 0 ? 0 : S[j];
        if (mj && sj > s) { if (!TH[j]) covered = true; }     /* von einer spaeter gezeichneten Form verdeckt: Kontaktschatten (duenne Details werfen keinen) */
        else if (!mj || sj < s) { if (k < 2) lit = true; else shade = true; }   /* Rand nach aussen: oben/links hell, unten/rechts dunkel */
      });
      let t = 2;
      if (covered) t = 1; else if (lit && !shade) t = 3; else if (shade && !lit) t = 1;
      if (TH[i]) t = 2;
      if (TO[i]) t = TO[i];
      out[i] = m + t;
    }
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y * n + x;
      if (M[i]) continue;
      if (D4.some((d) => { const j = at(x + d[0], y + d[1]); return j >= 0 && M[j] && !TH[j]; })) out[i] = "o";
    }
    return { n, c: out };
  }

  /* ---------- Zeichnungen ---------- */
  const IC = {
    barbell(A) {
      A.rect(0, 7, 16, 2, "s");
      A.rrect(1, 2, 3, 12, "g"); A.rrect(12, 2, 3, 12, "g");
      A.rrect(4, 4, 2, 8, "k"); A.rrect(10, 4, 2, 8, "k");
      A.rect(6, 6, 1, 4, "s"); A.rect(9, 6, 1, 4, "s");
      A.hi(2, 4); A.hi(2, 5);
    },
    dumbbell(A) {
      A.rect(5, 7, 6, 2, "s");
      A.rrect(0, 3, 4, 10, "g"); A.rrect(12, 3, 4, 10, "g");
      A.rrect(4, 5, 2, 6, "k"); A.rrect(10, 5, 2, 6, "k");
      A.hi(1, 5); A.hi(1, 6);
    },
    kettle(A) {
      A.ell(8, 4.6, 4.3, 3.9, "s"); A.ell(8, 5.2, 2.3, 2.3, "");
      A.ell(8, 10.4, 6, 4.9, "g"); A.join(); A.rect(5, 6, 6, 3, "g");
      A.hi(4, 9); A.hi(3, 10); A.hi(4, 11); A.hi(5, 8); A.hi(6, 7);
      A.lo(11, 13); A.lo(10, 14);
    },
    bench(A) {
      A.rect(0, 3, 16, 1, "s");
      A.rrect(0, 0, 3, 7, "k"); A.rrect(13, 0, 3, 7, "k");
      A.rrect(1, 1, 1, 5, "g"); A.rrect(14, 1, 1, 5, "g");
      A.rrect(1, 10, 14, 3, "g");
      A.rect(3, 13, 2, 3, "s"); A.rect(11, 13, 2, 3, "s");
    },
    dbench(A) {
      A.rect(5, 5, 6, 2, "s");
      A.rrect(1, 2, 4, 8, "g"); A.rrect(11, 2, 4, 8, "g");
      A.rrect(4, 3, 1, 6, "k"); A.rrect(11, 3, 1, 6, "k");
      A.rrect(1, 11, 14, 2, "g");
      A.rect(3, 13, 2, 3, "s"); A.rect(11, 13, 2, 3, "s");
    },
    ibench(A) {
      A.poly([[1, 10], [6, 10], [12, 2], [15, 4], [9, 12], [1, 12]], "g");
      A.rect(2, 12, 2, 3, "s");
      A.line(10, 11, 12, 14, "s", 1);
      A.rect(0, 15, 16, 1, "s");
    },
    rack(A) {
      A.rect(2, 2, 3, 14, "s"); A.rect(11, 2, 3, 14, "s");
      A.rect(5, 6, 1, 2, "s"); A.rect(10, 6, 1, 2, "s");
      A.rect(0, 4, 16, 1, "s");
      A.rrect(0, 1, 2, 7, "g"); A.rrect(14, 1, 2, 7, "g");
      A.rect(0, 15, 6, 1, "k"); A.rect(10, 15, 6, 1, "k");
    },
    smith(A) {
      A.rect(2, 0, 1, 16, "s"); A.rect(13, 0, 1, 16, "s");
      A.rect(0, 7, 16, 2, "s");
      A.rrect(3, 4, 2, 8, "g"); A.rrect(11, 4, 2, 8, "g");
      A.rect(0, 15, 16, 1, "k");
    },
    machine(A) {
      A.rect(1, 1, 4, 3, "k"); A.rect(1, 5, 4, 3, "k"); A.rect(1, 9, 4, 3, "k");
      A.rect(2, 0, 2, 14, "s");
      A.rect(7, 9, 7, 3, "g");
      A.rect(12, 2, 3, 8, "g");
      A.line(5, 10, 9, 5, "s", 1);
      A.rect(8, 4, 3, 2, "k");
      A.rect(0, 14, 16, 2, "s");
    },
    cable(A) {
      A.rect(2, 0, 3, 16, "s");
      A.ell(11, 3.6, 3.2, 3.2, "s"); A.ell(11, 3.6, 1.2, 1.2, "k");
      A.line(11, 7, 11, 12, "k", 1);
      A.rrect(8, 12, 7, 3, "g");
    },
    pulldown(A) {
      A.ell(8, 2.2, 2.6, 2.2, "s"); A.ell(8, 2.2, 0.9, 0.9, "k");
      A.line(7, 4, 3, 8, "k", 1); A.line(9, 4, 13, 8, "k", 1);
      A.rect(1, 8, 14, 2, "s");
      A.rrect(0, 7, 3, 5, "g"); A.rrect(13, 7, 3, 5, "g");
      A.rect(7, 12, 2, 4, "s");
    },
    row(A) {
      A.rect(0, 13, 16, 3, "s");
      A.rect(12, 5, 2, 8, "s"); A.rect(11, 8, 4, 1, "k");
      A.rrect(2, 9, 5, 3, "g");
      A.line(0, 6, 9, 6, "k", 1);
      A.rrect(8, 4, 2, 5, "g");
    },
    rings(A) {
      A.rect(3, 0, 2, 7, "g"); A.rect(11, 0, 2, 7, "g");
      A.ell(4, 10.5, 3.4, 4.2, "t"); A.ell(4, 10.8, 1.7, 2.4, "");
      A.ell(12, 10.5, 3.4, 4.2, "t"); A.ell(12, 10.8, 1.7, 2.4, "");
    },
    mat(A) {                                                   /* aufgerollte Matte: Stirnseite mit Spirale, Gummiband */
      A.rrect(5, 4, 9, 9, "g");
      A.tone(8, 5, 5, 1, 3); A.tone(8, 10, 5, 2, 1);
      A.ell(5, 8.5, 3.9, 4.9, "g");
      A.thin(); A.spiral(5, 8.7, 3.3, 4.2, 1.5, "k"); A.thin(false);
      A.rect(10, 4, 2, 9, "k");
    },
    shoe(A) {
      A.poly([[1, 4], [6, 3], [7, 7], [11, 8], [15, 11], [15, 13], [1, 13]], "g");
      A.rect(0, 12, 16, 3, "w");
      A.rect(3, 6, 3, 1, "w"); A.rect(5, 8, 3, 1, "w");
      A.hi(2, 5); A.hi(3, 4);
    },
    treadmill(A) {                                             /* Laufband: Laufflaeche, Stuetzen, Handlauf, Anzeige */
      A.rect(12, 5, 2, 8, "s");
      A.line(11, 4, 4, 9, "s", 1);
      A.rrect(9, 0, 7, 5, "g"); A.rect(10, 1, 5, 2, "k"); A.tone(10, 1, 5, 1, 2);
      A.rrect(0, 10, 15, 4, "k"); A.tone(1, 10, 13, 1, 3);
      A.thin(); A.rect(2, 12, 11, 1, "s"); A.thin(false);
      A.rect(1, 14, 3, 2, "s"); A.rect(11, 14, 3, 2, "s");
    },
    bike(A) {                                                  /* Fahrrad: zwei Raeder, Rahmen in Gruppenfarbe, Sattel, Lenker */
      A.thin();
      A.ring(3.6, 11.2, 3.6, 3.6, 1, "s"); A.ring(12.4, 11.2, 3.6, 3.6, 1, "s");
      A.line(4, 11, 7, 11, "g", 1); A.line(4, 11, 6, 6, "g", 1); A.line(6, 6, 7, 11, "g", 1);
      A.line(6, 6, 11, 6, "g", 1); A.line(7, 11, 11, 6, "g", 1); A.line(11, 6, 12, 11, "g", 1);
      A.line(11, 4, 11, 6, "s", 1); A.rect(9, 3, 4, 1, "k"); A.rect(4, 5, 4, 1, "k");
      A.rect(4, 11, 1, 1, "s"); A.rect(12, 11, 1, 1, "s"); A.rect(7, 12, 2, 1, "k");
      A.thin(false);
    },
    rope(A) {                                                  /* Springseil: Seil als grosse Schlaufe (Omega), Griffe liegen unten aussen */
      A.thin();
      A.arc(8, 5.6, 5.4, 5.2, "r", (x, y) => y < 9.4);
      A.line(3, 9, 12, 14, "r", 1); A.line(13, 9, 4, 14, "r", 1);
      A.thin(false);
      A.rrect(0, 11, 5, 5, "g"); A.rrect(11, 11, 5, 5, "g");
      A.rect(0, 11, 5, 2, "k"); A.rect(11, 11, 5, 2, "k");
      A.tone(1, 14, 1, 1, 3); A.tone(12, 14, 1, 1, 3);
    },
    heart(A) {
      A.poly([[8, 14.5], [1.2, 7.6], [1.2, 4.6], [3.4, 2.2], [6.4, 2.2], [8, 4.2], [9.6, 2.2], [12.6, 2.2], [14.8, 4.6], [14.8, 7.6]], "r");
      A.hi(3, 4); A.hi(4, 3); A.hi(3, 5);
    },
    wheel(A) {
      A.rect(0, 7, 16, 2, "s");
      A.ell(8, 8, 5, 5.5, "k"); A.ell(8, 8, 2.2, 2.4, "s");
      A.rrect(0, 6, 3, 4, "g"); A.rrect(13, 6, 3, 4, "g");
    }
  };

  /* Muskelgruppen als Bild */
  const TORSO = [[0, 6.5], [2, 4.5], [5, 3.5], [6, 1], [10, 1], [11, 3.5], [14, 4.5], [16, 6.5], [15, 10.5], [12, 15.5], [4, 15.5], [1, 10.5]];
  const IG = {
    chest(A) {                                                 /* Oberkoerper von vorn, Brustmuskeln in Gruppenfarbe */
      A.poly(TORSO, "f");
      A.rrect(2, 5, 6, 5, "g"); A.rrect(8, 5, 6, 5, "g");
      A.tone(4, 9, 2, 1, 1); A.tone(10, 9, 2, 1, 1);
      A.rect(7, 11, 2, 4, "f");
    },
    back(A) {                                                  /* Ruecken: Trapez und Latissimus als V */
      A.poly(TORSO, "f");
      A.poly([[8, 3], [11.5, 5.5], [8, 10], [4.5, 5.5]], "g");
      A.poly([[1.5, 7], [7, 8], [7, 15], [5, 15], [2.2, 11]], "g");
      A.poly([[14.5, 7], [9, 8], [9, 15], [11, 15], [13.8, 11]], "g");
    },
    shoulder(A) {                                              /* Schultern: Nacken, runde Deltamuskeln, Oberarme */
      A.rrect(5, 0, 6, 5, "f");
      A.poly([[4, 3], [12, 3], [13, 6], [3, 6]], "f");
      A.rect(5, 6, 6, 10, "f");
      A.rect(0, 8, 3, 8, "f"); A.rect(13, 8, 3, 8, "f");
      A.ell(3.2, 6.2, 3.3, 3.5, "g"); A.ell(12.8, 6.2, 3.3, 3.5, "g");
    },
    arm(A) {                                                   /* angewinkelter Arm, Bizeps in Gruppenfarbe */
      A.poly([[8, 5], [14, 5], [14, 9], [11, 11], [8, 10]], "f");
      A.ell(11.5, 3.4, 3, 2.8, "f");
      A.poly([[1, 15], [1, 10], [4, 6], [9, 7], [10, 11], [7, 13], [5, 15]], "g");
      A.ell(6, 9, 3, 2.4, "g");
    },
    leg(A) {                                                   /* Beine von vorn: Shorts in Gruppenfarbe, Beine, Schuhe */
      A.poly([[3.5, 6], [6.5, 6], [6.2, 11], [5.6, 14], [3.9, 14], [3.4, 11]], "f");
      A.poly([[12.5, 6], [9.5, 6], [9.8, 11], [10.4, 14], [12.1, 14], [12.6, 11]], "f");
      A.poly([[2, 0], [14, 0], [14.5, 8], [9.2, 8], [8, 5], [6.8, 8], [1.5, 8]], "g");
      A.rrect(1, 13, 6, 3, "w"); A.rrect(9, 13, 6, 3, "w");
    },
    glute(A) {
      A.ell(5, 9, 4.4, 5, "g"); A.ell(11, 9, 4.4, 5, "g");
      A.rect(7, 4, 2, 9, "f");
    },
    abs(A) {
      A.poly([[2, 1], [14, 1], [13, 15], [3, 15]], "f");
      [[4, 2], [9, 2], [4, 6], [9, 6], [4, 10], [9, 10]].forEach((p) => A.rrect(p[0], p[1], 3, 3, "g"));
    },
    heart(A) { IC.heart(A); }
  };
  const ICON_CACHE = {};
  function iconData(key, grp) {
    const k = (grp ? "g:" : "") + key;
    if (!ICON_CACHE[k]) ICON_CACHE[k] = mkIcon(16, (grp ? IG : IC)[key] || IC.barbell);
    return ICON_CACHE[k];
  }
  const GROUP_ICON = { "Brust": "chest", "Rücken": "back", "Schultern": "shoulder", "Arme": "arm", "Beine": "leg", "Po": "glute", "Bauch": "abs", "Ausdauer": "heart" };
  const EQ_ICON = { F: "barbell", M: "machine", K: "cable", E: "mat" };

  /* Welches Symbol gehoert zu einer Uebung? Regeln von oben nach unten, die erste passende gewinnt; sonst nach Geraet (F Frei, M Maschine, K Kabel, E Eigengewicht) */
  const IC_RULES = [
    [/farmer|kettlebell|goblet/, "kettle"],
    [/klimmz|umgekehrtes rudern|dips(?!-maschine)|beinheben \(hängend\)|knieheben|toes to bar|dragon flag/, "rings"],
    [/bauchroller/, "wheel"],
    [/liegestütz|plank|seitstütz|hollow|mountain|dead bug|bird dog|supermans|crunch|sit-up|russian|v-ups|heel taps|beinheben \(liegend\)|landmine twist|hyperextensions|glute bridge|frog pumps|fire hydrants|donkey|beckenheben|nordic|sissy|wandsitzen|kniebeugen \(eigengewicht\)|sprungkniebeugen|seitbeugen|cossack/, "mat"],
    [/pallof|holzfäller|crunches am kabel|kickbacks am kabel|kabel-kickbacks|beinabduktion am kabel|beinadduktion am kabel|beinbeugen am kabel|seitheben am kabel|frontheben am kabel|aufrechtes rudern am kabel|einarmiges kabeldrücken|crossover|kabelzug-fliegende|reverse fliegende am kabel|curls am hohen kabel|kabelcurls|hammer-curls am kabel|trizeps-pushdown|trizepsstrecken über kopf \(kabel\)/, "cable"],
    [/latzug|geradarm|pullover am kabel/, "pulldown"],
    [/face pulls|rudern|rudermaschine|t-bar|pendlay|meadows|seal/, "row"],
    [/schulterpresse|brustpresse|beinpresse|hackenschmidt|pendulum|belt squat|beinstrecker|beinbeuger|abduktoren|adduktoren|trizepsmaschine|bizepsmaschine|bauchmaschine|rotationsmaschine|rückenstrecker \(maschine\)|reverse hyperextension|pullover \(maschine\)|seitheben \(maschine\)|scott-curls \(maschine\)|kickbacks \(maschine\)|butterfly|dips-maschine|hip thrust \(maschine\)|wadenheben \(stehend, maschine\)|wadenheben \(sitzend\)|wadenheben \(beinpresse\)/, "machine"],
    [/multipresse/, "smith"],
    [/ausfallschritt|step-up|bulgarian|wadenheben|tibialis/, "shoe"],
    [/schrägbank|negativbank|decline|incline/, "ibench"],
    [/(bank)drücken \(kh\)|floor press \(kh\)|tate press|skullcrushers \(kh\)|fliegende \(kh\)|überzüge \(kh\)/, "dbench"],
    [/bankdrücken|floor press|svend|jm press|hip thrust/, "bench"],
    [/kniebeugen|rack pulls|good mornings/, "rack"],
    [/kreuzheben/, "barbell"]
  ];
  function iconKey(ex) {
    const n = ex.n.toLowerCase();
    if (ex.g === "Ausdauer") return /laufband/.test(n) ? "treadmill" : /laufen|gehen/.test(n) ? "shoe" : /seil/.test(n) ? "rope" : /fahrrad/.test(n) ? "bike" : /ruder/.test(n) ? "row" : /crosstrainer|stepper/.test(n) ? "machine" : "heart";
    for (let i = 0; i < IC_RULES.length; i++) if (IC_RULES[i][0].test(n)) return IC_RULES[i][1];
    if (ex.e === "K") return "cable";
    if (ex.e === "M") return "machine";
    if (ex.e === "E") return "mat";
    return /\(kh\)|kurzhantel|hammer|konzentration|zottman|spider|zottman|überzüge/.test(n) ? "dumbbell" : "barbell";
  }

  /* ==========================================================================
     Kern: Datum, Format, Datenmodell, Zusammenfuehren, Auswertungen (reine Funktionen, kein DOM)
     ========================================================================== */
  const DAY = 86400000;
  const pad2 = (n) => (n < 10 ? "0" : "") + n;
  const num = (v, d = 0) => { v = Number(v); return Number.isFinite(v) ? v : d; };
  const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const str = (v, max) => String(v == null ? "" : v).slice(0, max);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- Datum: Tage als "JJJJ-MM-TT" (lokal), Woche beginnt am Montag ---------- */
  const dk = (d) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  const pdk = (s) => { const p = String(s).split("-"); return new Date(+p[0], +p[1] - 1, +p[2], 12); };
  const isDK = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(pdk(s).getTime());
  const addD = (s, n) => { const d = pdk(s); d.setDate(d.getDate() + n); return dk(d); };
  const wdOf = (s) => pdk(s).getDay();
  const mondayOf = (s) => addD(s, -((wdOf(s) + 6) % 7));
  const diffD = (a, b) => Math.round((pdk(a) - pdk(b)) / DAY);
  const WD_S = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
  const WD_L = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
  const WK = [1, 2, 3, 4, 5, 6, 0]; /* Mo..So als getDay()-Werte */
  const MON_L = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const MON_S = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

  /* ---------- Format ---------- */
  const fmtN = (n) => String(Math.round(num(n) * 100) / 100).replace(".", ",");
  const fmtInt = (n) => Math.round(num(n)).toLocaleString("de-DE");
  const parseN = (s) => { const v = parseFloat(String(s).trim().replace(/\s+/g, "").replace(",", ".")); return Number.isFinite(v) ? v : null; };
  const fmtClock = (ms) => {
    let s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600); s -= h * 3600;
    const m = Math.floor(s / 60); s -= m * 60;
    return (h ? h + ":" + pad2(m) : pad2(m)) + ":" + pad2(s);
  };
  const fmtDur = (ms) => { const m = Math.round(ms / 60000); return m < 60 ? m + " min" : Math.floor(m / 60) + " h " + pad2(m % 60) + " min"; };
  const fmtHours = (ms) => String(Math.round(ms / 360000) / 10).replace(".", ",");
  const fmtDay = (s) => { const d = pdk(s); return WD_S[d.getDay()] + ", " + pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "."; };
  const fmtDayY = (s) => { const d = pdk(s); return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "." + d.getFullYear(); };
  const fmtShort = (s) => { const d = pdk(s); return pad2(d.getDate()) + "." + pad2(d.getMonth() + 1) + "."; };
  const fmtSet = (ex, s) => (ex.g === "Ausdauer" ? fmtN(s[0]) + " km · " + fmtN(s[1]) + " min" : (s[0] > 0 ? fmtN(s[0]) + " kg × " : "") + fmtN(s[1]) + (TIMED[ex.id] ? " s" : ""));
  const fmtSetShort = (s) => (s[0] > 0 ? fmtN(s[0]) + "×" + fmtN(s[1]) : "" + fmtN(s[1]));
  const isCardio = (ex) => ex.g === "Ausdauer";
  const nSatz = (n) => fmtInt(n) + (n === 1 ? " SATZ" : " SÄTZE");
  const nUeb = (n) => n + (n === 1 ? " ÜBUNG" : " ÜBUNGEN");
  const nTag = (n) => n + (n === 1 ? " TAG" : " TAGE");

  /* ---------- Datenmodell ---------- */
  const DEF_SETTINGS = { restSec: 90, vib: true, snd: true, step: 2.5, auto: true, plan: "" };
  /* plans: mehrere Plaene mit je eigenen Trainingstagen; settings.plan = der gerade aktive Plan */
  const emptyData = () => ({ v: 1, plans: [], rest: { days: [0, 6], u: 0 }, settings: Object.assign({ u: 0 }, DEF_SETTINGS), custom: [], sessions: [], del: {} });
  const planOf = (D) => D.plans.find((p) => p.id === D.settings.plan) || D.plans[0] || null;

  const normSets = (arr, max) => (Array.isArray(arr) ? arr : []).slice(0, max || 40).map((s) => (Array.isArray(s) ? [Math.max(0, num(s[0])), Math.max(0, num(s[1]))] : null)).filter(Boolean);
  function normDay(d) {
    if (!d || typeof d !== "object") return null;
    return {
      id: str(d.id || uid(), 40), n: str(d.n, 40) || "Tag", f: str(d.f, 80), c: clampN(Math.round(num(d.c)), 0, COLORS.length - 1), u: num(d.u),
      ex: (Array.isArray(d.ex) ? d.ex : []).slice(0, 60).map((e) => {
        if (!e || typeof e !== "object" || !e.x) return null;
        const s = normSets(e.s, 20);
        return { id: str(e.id || uid(), 40), x: str(e.x, 80), s: s.length ? s : [[0, 8]], note: str(e.note, 200) };
      }).filter(Boolean)
    };
  }
  function normPlan(p) {
    if (!p || typeof p !== "object") return null;
    return { id: str(p.id || uid(), 40), n: str(p.n, 40) || "Plan", days: (Array.isArray(p.days) ? p.days : []).slice(0, 30).map(normDay).filter(Boolean), u: num(p.u) };
  }
  function normSession(s) {
    if (!s || typeof s !== "object" || !isDK(s.d)) return null;
    const ex = (Array.isArray(s.ex) ? s.ex : []).slice(0, 80).map((e) => {
      if (!e || typeof e !== "object" || !e.x) return null;
      const o = { x: str(e.x, 80), s: normSets(e.s) };
      if (e.n) { o.n = str(e.n, 60); o.g = GROUPS.indexOf(e.g) >= 0 ? e.g : "Brust"; o.e = EQ[e.e] ? e.e : "E"; }
      if (e.note) o.note = str(e.note, 200);
      return o.s.length ? o : null;
    }).filter(Boolean);
    if (!ex.length) return null;
    return { id: str(s.id || uid(), 40), d: s.d, a: num(s.a), b: num(s.b), day: s.day ? str(s.day, 40) : null, dn: str(s.dn, 40), c: clampN(Math.round(num(s.c)), 0, COLORS.length - 1), ex, u: num(s.u) };
  }
  function normalizeData(raw) {
    const o = emptyData();
    if (!raw || typeof raw !== "object") return o;
    if (Array.isArray(raw.plans)) o.plans = raw.plans.slice(0, 30).map(normPlan).filter(Boolean);
    if (raw.rest && Array.isArray(raw.rest.days)) {
      const seen = {};
      o.rest = { days: raw.rest.days.map((n) => Math.round(num(n, -1))).filter((n) => n >= 0 && n <= 6 && !seen[n] && (seen[n] = 1)), u: num(raw.rest.u) };
    }
    if (raw.settings && typeof raw.settings === "object") {
      const s = raw.settings;
      o.settings = { restSec: clampN(Math.round(num(s.restSec, 90)), 0, 600), vib: s.vib !== false, snd: s.snd !== false, step: [1, 2.5, 5].indexOf(num(s.step)) >= 0 ? num(s.step) : 2.5, auto: s.auto !== false, plan: str(s.plan, 40), u: num(s.u) };
    }
    if (Array.isArray(raw.custom)) o.custom = raw.custom.slice(0, 300).map((c) => (c && c.id && c.n ? { id: str(c.id, 40), n: str(c.n, 60), g: GROUPS.indexOf(c.g) >= 0 ? c.g : "Brust", e: EQ[c.e] ? c.e : "E", u: num(c.u) } : null)).filter(Boolean);
    if (Array.isArray(raw.sessions)) o.sessions = raw.sessions.slice(0, 20000).map(normSession).filter(Boolean).sort(cmpSession);
    if (raw.del && typeof raw.del === "object") Object.keys(raw.del).slice(0, 20000).forEach((k) => { const t = num(raw.del[k]); if (t > 0) o.del[str(k, 40)] = t; });
    return o;
  }
  function cmpSession(p, q) { return p.d < q.d ? -1 : p.d > q.d ? 1 : (p.a || 0) - (q.a || 0) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0); }

  /* ---------- Zusammenfuehren (Geraet + Cloud): Listen vereinigen, Bloecke nach Zeitstempel ---------- */
  /* wie remoteWins im Dashboard: ein leerer Stand ersetzt nie einen gefuellten, auch wenn er neuer ist */
  const lwin = (ru, lu, rHas, lHas) => ru > lu && !(lHas && !rHas);
  function unionById(la, lb, del) {
    const m = new Map();
    la.concat(lb).forEach((it) => { const c = m.get(it.id); if (!c || (it.u || 0) > (c.u || 0)) m.set(it.id, it); });
    return Array.from(m.values()).filter((it) => !(it.id in del));
  }
  /* Plaene: je Plan gewinnt der neuere Stand (ein leerer ersetzt nie einen gefuellten), Plaene nur auf einer Seite bleiben erhalten */
  function mergePlans(la, lb, del) {
    const m = new Map();
    la.forEach((p) => m.set(p.id, p));
    lb.forEach((p) => { const c = m.get(p.id); if (!c || lwin(p.u, c.u, p.days.length > 0, c.days.length > 0)) m.set(p.id, p); });
    return Array.from(m.values()).filter((p) => !(p.id in del));
  }
  function mergeData(L, R) {
    const o = emptyData();
    o.rest = R.rest.u > L.rest.u ? R.rest : L.rest;
    o.settings = R.settings.u > L.settings.u ? R.settings : L.settings;
    const del = Object.assign({}, R.del, L.del);
    Object.keys(R.del).forEach((k) => { del[k] = Math.max(R.del[k], L.del[k] || 0); });
    const cut = Date.now() - 400 * DAY;
    Object.keys(del).forEach((k) => { if (del[k] < cut) delete del[k]; });
    o.del = del;
    o.plans = mergePlans(L.plans, R.plans, del);
    if (o.settings.plan && !o.plans.some((p) => p.id === o.settings.plan)) o.settings = Object.assign({}, o.settings, { plan: "" });
    o.custom = unionById(L.custom, R.custom, del);
    o.sessions = unionById(L.sessions, R.sessions, del).sort(cmpSession);
    return o;
  }
  /* Kanonischer Schluessel zum Vergleichen zweier Staende (Reihenfolge von Schluesseln und Listen spielt keine Rolle) */
  const dataKey = (D) => {
    const n = normalizeData(D);
    return JSON.stringify([n.plans.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), n.rest, n.settings, n.custom.slice().sort((a, b) => (a.id < b.id ? -1 : 1)), n.sessions, Object.keys(n.del).sort().map((k) => [k, n.del[k]])]);
  };

  /* ---------- Uebungen nachschlagen (Katalog + eigene) ---------- */
  function lookupFn(D) {
    const cm = {};
    D.custom.forEach((c) => { cm[c.id] = c; });
    return (x, st) => EXBY[x] || cm[x] || { id: x, n: (st && st.n) || x, g: (st && st.g) || "Brust", e: (st && st.e) || "E", gone: 1 };
  }
  const unitsFor = (ex) => (isCardio(ex) ? { a: "KM", b: "MIN", aStep: 0.5, bStep: 5 } : { a: ex.e === "E" ? "+KG" : "KG", b: TIMED[ex.id] ? "SEK" : "WDH", aStep: 0, bStep: TIMED[ex.id] ? 5 : 1 });

  /* ---------- Verlaufs-Index ---------- */
  function buildIndex(D) {
    const sess = D.sessions.slice().sort(cmpSession);
    const byEx = {}, byDate = {};
    sess.forEach((se) => {
      (byDate[se.d] = byDate[se.d] || []).push(se);
      se.ex.forEach((e) => { (byEx[e.x] = byEx[e.x] || []).push({ d: se.d, a: se.a, s: e.s, sid: se.id, note: e.note }); });
    });
    return { sess, byEx, byDate, first: sess.length ? sess[0].d : null };
  }

  /* ---------- Saetze vergleichen: schwerer gewinnt, bei gleichem Gewicht mehr Wiederholungen ---------- */
  const cmpSet = (a, b) => (a[0] - b[0]) || (a[1] - b[1]);
  const bestOf = (sets) => { let m = null; for (let i = 0; i < sets.length; i++) if (!m || cmpSet(sets[i], m) > 0) m = sets[i]; return m; };
  const lastEntry = (idx, x) => { const l = idx.byEx[x]; return l && l.length ? l[l.length - 1] : null; };
  /* Ziel: gleiches Gewicht wie der beste Satz beim letzten Mal, eine Wiederholung mehr */
  const targetOf = (last) => { const b = last && bestOf(last.s); return b ? [b[0], b[1] + 1] : null; };

  /* Startwerte der Saetze: der Plan gilt, wenn es noch keine Einheit gibt oder der Tag nach der letzten Einheit angepasst wurde (planU);
     sonst die Werte der letzten Einheit (bei mehr Saetzen als damals der letzte Satz), sonst Standardwerte */
  function prefillSets(idx, ex, pe, planU) {
    const last = lastEntry(idx, ex.id);
    const planWins = !!pe && (!last || num(planU) > last.a);
    const n = pe ? pe.s.length : last ? last.s.length : isCardio(ex) ? 1 : 3;
    const dflt = isCardio(ex) ? [0, 20] : [0, TIMED[ex.id] ? 30 : 10];
    const out = [];
    for (let i = 0; i < n; i++) {
      const p = pe ? pe.s[i] : null;
      const l = last ? last.s[Math.min(i, last.s.length - 1)] : null;
      let s;
      if (planWins && p) s = [p[0] > 0 ? p[0] : l ? l[0] : 0, p[1] > 0 ? p[1] : l ? l[1] : dflt[1]];
      else if (l) s = l;
      else if (p) s = [p[0], p[1] > 0 ? p[1] : dflt[1]];
      else s = dflt;
      out.push({ kg: s[0], r: s[1], done: false });
    }
    return out;
  }

  /* ---------- Bewertung einer beendeten Einheit: Rekord / Steigerung / erstes Mal ---------- */
  /* idx = Verlauf OHNE diese Einheit; exList = [{x, s:[[kg,wdh],...]}] */
  function evalSession(idx, look, exList) {
    const out = [];
    exList.forEach((e) => {
      const ex = look(e.x, e);
      if (isCardio(ex) || !e.s.length) return;
      const best = bestOf(e.s), hist = idx.byEx[e.x] || [];
      if (!hist.length) { out.push({ x: e.x, kind: "new", best }); return; }
      let rec = null;
      hist.forEach((h) => { const b = bestOf(h.s); if (!rec || cmpSet(b, rec) > 0) rec = b; });
      const lastB = bestOf(hist[hist.length - 1].s);
      if (cmpSet(best, rec) > 0) out.push({ x: e.x, kind: "pr", best, prev: rec });
      else if (cmpSet(best, lastB) > 0) out.push({ x: e.x, kind: "up", best, prev: lastB });
    });
    return out;
  }
  const XP_PR = 10, XP_UP = 5, XP_CAP = 8;
  function xpItems(sid, ev) {
    return ev.filter((e) => e.kind === "pr" || e.kind === "up")
      .sort((a, b) => (b.kind === "pr") - (a.kind === "pr"))
      .slice(0, XP_CAP)
      .map((e) => ["train:" + e.kind + ":" + sid + ":" + e.x, e.kind === "pr" ? XP_PR : XP_UP]);
  }

  /* ---------- Auswertungen ---------- */
  const durOf = (se) => (se.b > se.a ? Math.min(se.b - se.a, 5 * 3600000) : 0);
  const setsOf = (se) => se.ex.reduce((n, e) => n + e.s.length, 0);
  function volumeOf(se, look) {
    let v = 0;
    se.ex.forEach((e) => { if (!isCardio(look(e.x, e))) e.s.forEach((s) => { v += s[0] * s[1]; }); });
    return v;
  }
  const trainedSet = (idx) => { const o = {}; Object.keys(idx.byDate).forEach((d) => { o[d] = 1; }); return o; };
  /* Serie: Trainingstage in Folge, Ruhetage ueberspringen; heute ohne Training bricht noch nichts ab */
  function streakOf(idx, rest, today) {
    if (!idx.first) return 0;
    const tr = trainedSet(idx);
    let n = 0, d = tr[today] ? today : addD(today, -1);
    for (let i = 0; i < 4000 && d >= idx.first; i++) {
      if (tr[d]) n++;
      else if (rest.indexOf(wdOf(d)) < 0) break;
      d = addD(d, -1);
    }
    return n;
  }
  /* Tageszustand fuer Wochenleiste, Monat und Heatmap */
  function dayState(d, today, idx, rest) {
    if (idx.byDate[d]) return "done";
    const isRest = rest.indexOf(wdOf(d)) >= 0;
    if (d > today) return "future";
    if (isRest) return "rest";
    if (d === today) return "today";
    return idx.first && d >= idx.first ? "missed" : "none";
  }
  function rangeOf(period, today, idx) {
    if (period === "week") { const m = mondayOf(today); return [m, addD(m, 6)]; }
    if (period === "month") { const d = pdk(today); return [dk(new Date(d.getFullYear(), d.getMonth(), 1, 12)), dk(new Date(d.getFullYear(), d.getMonth() + 1, 0, 12))]; }
    if (period === "year") { const y = pdk(today).getFullYear(); return [y + "-01-01", y + "-12-31"]; }
    return [idx.first || today, today];
  }
  function periodStats(idx, look, from, to) {
    let n = 0, ms = 0, sets = 0, vol = 0;
    idx.sess.forEach((se) => { if (se.d < from || se.d > to) return; n++; ms += durOf(se); sets += setsOf(se); vol += volumeOf(se, look); });
    return { n, ms, sets, vol };
  }
  function setsByGroup(idx, look, from, to) {
    const o = {};
    GROUPS.forEach((g) => { o[g] = 0; });
    idx.sess.forEach((se) => { if (se.d < from || se.d > to) return; se.ex.forEach((e) => { o[look(e.x, e).g] += e.s.length; }); });
    return o;
  }
  function weeklySets(idx, today, n) {
    const mon = mondayOf(today), out = [];
    for (let i = n - 1; i >= 0; i--) {
      const s = addD(mon, -7 * i), e = addD(s, 6);
      let c = 0, k = 0;
      idx.sess.forEach((se) => { if (se.d >= s && se.d <= e) { c += setsOf(se); k++; } });
      out.push({ from: s, sets: c, n: k });
    }
    return out;
  }
  function recordsOf(idx, look) {
    const out = [];
    Object.keys(idx.byEx).forEach((x) => {
      const ex = look(x);
      if (isCardio(ex)) return;
      let best = null, at = null;
      idx.byEx[x].forEach((en) => { const b = bestOf(en.s); if (b && (!best || cmpSet(b, best) > 0)) { best = b; at = en.d; } });
      if (best) out.push({ x, ex, best, d: at });
    });
    return out;
  }
  function exSeries(idx, x) {
    return (idx.byEx[x] || []).map((en) => {
      const b = bestOf(en.s) || [0, 0];
      let vol = 0, e1 = 0;
      /* e1 = geschaetztes Maximum fuer eine Wiederholung (Epley: Gewicht x (1 + Wdh / 30)), nur mit Gewicht */
      en.s.forEach((s) => { vol += s[0] * s[1]; if (s[0] > 0) e1 = Math.max(e1, s[0] * (1 + s[1] / 30)); });
      return { d: en.d, kg: b[0], r: b[1], vol, e1, n: en.s.length };
    });
  }
  function nextDay(D, idx) {
    const P = planOf(D), days = P ? P.days : [];
    if (!days.length) return null;
    const ids = days.map((d) => d.id);
    for (let i = idx.sess.length - 1; i >= 0; i--) { const p = ids.indexOf(idx.sess[i].day); if (p >= 0) return days[(p + 1) % days.length]; }
    return days[0];
  }
  const planSets = (day) => day.ex.reduce((n, e) => n + e.s.length, 0);
  const estMin = (day, restSec) => Math.max(5, Math.round((planSets(day) * (45 + restSec)) / 60 / 5) * 5);
  /* Kalender: 6 Wochen ab dem Montag vor dem Ersten */
  function monthCells(y, m) {
    const first = dk(new Date(y, m, 1, 12)), start = mondayOf(first), cells = [];
    const days = new Date(y, m + 1, 0).getDate();
    const weeks = Math.ceil((((wdOf(first) + 6) % 7) + days) / 7);
    for (let i = 0; i < weeks * 7; i++) { const d = addD(start, i); cells.push({ d, in: pdk(d).getMonth() === m }); }
    return cells;
  }

  window.createTraining = function (deps) {
    /* ======================================================================
       Zustand, lokale Sicherheitskopie (Handy im Studio ohne Netz) und Cloud-Datei training-data.json
       ====================================================================== */
    const FILE = "training-data.json";
    const LS_CACHE = "dashboard-training-cache", LS_DRAFT = "dashboard-training-draft";
    const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
    const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
    const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* egal */ } };

    let D = emptyData();           /* gespeicherte Daten */
    let W = null;                  /* laufendes Workout (nur Entwurf im Browser, bis es beendet wird) */
    let IDX = null, LOOK = null;
    const idx = () => IDX || (IDX = buildIndex(D));
    const look = () => LOOK || (LOOK = lookupFn(D));
    const bump = () => { IDX = null; LOOK = null; };
    const today = () => (deps.todayKey ? deps.todayKey() : dk(new Date()));

    /* ---------- lokale Kopie ---------- */
    let dirty = false, chgSeq = 0;
    function saveLocal() { lsSet(LS_CACHE, JSON.stringify({ d: D, dirty, at: Date.now() })); }
    function loadLocal() {
      const raw = lsGet(LS_CACHE);
      if (!raw) return;
      try { const o = JSON.parse(raw); D = normalizeData(o.d); dirty = !!o.dirty; bump(); } catch (e) { /* kaputte Kopie: ignorieren, Cloud holt alles */ }
    }

    /* ---------- Entwurf des laufenden Workouts ---------- */
    let draftTimer = 0;
    function saveDraft() {
      clearTimeout(draftTimer);
      if (!W) { lsDel(LS_DRAFT); return; }
      lsSet(LS_DRAFT, JSON.stringify({ w: W, at: Date.now() }));
    }
    const queueDraft = () => { clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 150); };
    function normWorkout(w) {
      if (!w || typeof w !== "object" || !isDK(w.d) || !Array.isArray(w.ex)) return null;
      const o = {
        id: str(w.id || uid(), 40), d: w.d, a: num(w.a, Date.now()), day: w.day ? str(w.day, 40) : null, dn: str(w.dn, 40) || "Training",
        c: clampN(Math.round(num(w.c, 11)), 0, COLORS.length - 1), tab: w.tab === "live" ? "live" : "list", cur: Math.max(0, Math.round(num(w.cur))),
        min: !!w.min, rest: null, ex: []
      };
      o.ex = w.ex.slice(0, 80).map((e) => {
        if (!e || !e.x) return null;
        const sets = (Array.isArray(e.sets) ? e.sets : []).slice(0, 40).map((s) => ({ kg: Math.max(0, num(s && s.kg)), r: Math.max(0, num(s && s.r)), done: !!(s && s.done) }));
        return { id: str(e.id || uid(), 40), x: str(e.x, 80), note: str(e.note, 200), open: !!e.open, sets: sets.length ? sets : [{ kg: 0, r: 10, done: false }] };
      }).filter(Boolean);
      if (w.rest && num(w.rest.end) > 0) {
        const end = num(w.rest.end), len = Math.max(5, num(w.rest.len, 90));
        o.rest = { start: num(w.rest.start, end - len * 1000), end, len, fin: !!w.rest.fin };
      }
      if (o.cur >= o.ex.length) o.cur = 0;
      return o.ex.length ? o : null;
    }
    function loadDraft() {
      const raw = lsGet(LS_DRAFT);
      if (!raw) return;
      try { W = normWorkout(JSON.parse(raw).w); } catch (e) { W = null; }
      if (!W) lsDel(LS_DRAFT);
    }

    /* ---------- Cloud ---------- */
    const b64 = (s) => btoa(unescape(encodeURIComponent(s)));
    let sha = null, cloudKnown = false, pushing = false, pushTimer = 0, retryTimer = 0, lastLoad = 0, tokenDeclined = false, syncState = "load", syncDetail = "";
    const hasToken = () => !!lsGet("dashboard-gh-token");
    const hasContent = (d) => d.plans.length > 0 || d.sessions.length > 0 || d.custom.length > 0;

    function setSync(state, detail, topbar) {
      syncState = state; syncDetail = detail || "";
      const el = deps.syncEl;
      if (el) {
        const txt = { load: "LADE …", ok: "GESICHERT", pending: "SPEICHERE …", saving: "SPEICHERE …", offline: dirty ? "LOKAL GESICHERT · WARTE AUF NETZ" : "OFFLINE", error: "FEHLER · LOKAL GESICHERT", notoken: "KEIN TOKEN · NUR LOKAL" }[state] || "";
        el.dataset.s = state;
        const t = el.querySelector(".tr-sync-t");
        if (t) t.textContent = txt;
        el.title = detail || txt;
      }
      /* Kopfleiste des Dashboards (Wolke): nur bei echtem Speichern, nicht beim blossen Laden */
      if (deps.status) {
        if (state === "saving") deps.status("saving");
        else if (topbar) deps.status(topbar, detail);
      }
    }

    /* Cloud lesen und mit dem lokalen Stand vereinigen. Gibt true zurueck, wenn der Cloud-Stand bekannt ist. */
    async function loadCloud() {
      if (syncState !== "saving") setSync("load");
      try {
        const r = await deps.readCloudJson(FILE);
        lastLoad = Date.now();
        sha = r.sha || null;
        cloudKnown = true;
        if (r.json) {
          const R = normalizeData(r.json), before = dataKey(D);
          D = mergeData(D, R);
          bump();
          if (dataKey(D) !== before) { saveLocal(); onDataReplaced(); }
          if (dataKey(D) !== dataKey(R)) { dirty = true; chgSeq++; saveLocal(); } else { dirty = false; saveLocal(); }
        } else if (hasContent(D)) { dirty = true; chgSeq++; saveLocal(); }
        else dirty = false;
        if (dirty) schedulePush(200); else setSync("ok");
        return true;
      } catch (e) {
        setSync("offline", e && e.message);
        clearTimeout(retryTimer);
        retryTimer = setTimeout(() => { if (!cloudKnown) loadCloud(); }, 25000);
        return false;
      }
    }
    /* 403 heisst bei GitHub nicht immer "Token ungueltig": auch die Schreibbremse (zu viele oder gleichzeitige Schreibzugriffe) antwortet so */
    async function rateLimited(res) {
      if (res.status === 429) return true;
      if (res.headers.get("retry-after") || res.headers.get("x-ratelimit-remaining") === "0") return true;
      try { return /rate limit|abuse|secondary/i.test(String((await res.clone().json()).message || "")); } catch (e) { return false; }
    }
    function schedulePush(ms) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(pushNow, ms == null ? 700 : ms);
      if (syncState !== "offline") setSync("pending");
    }
    async function pushNow() {
      if (pushing) { schedulePush(900); return; }
      if (!dirty) return;
      if (!cloudKnown && !(await loadCloud())) return;   /* ohne bekannten Cloud-Stand nie schreiben */
      if (!dirty) return;
      if (!hasToken()) {
        if (!tokenDeclined && !deps.getGithubConfig()) tokenDeclined = true;
        if (!hasToken()) { setSync("notoken"); return; }
      }
      const cfg = deps.getGithubConfig();
      if (!cfg) { setSync("notoken"); return; }
      pushing = true;
      setSync("saving");
      let ok = false, fail = "";
      const seq = chgSeq;
      try {
        /* Schreibzugriffe auf das Repo laufen nacheinander (deps.serial, siehe script.js): gleichzeitige PUTs geraten bei GitHub in Konflikt */
        await (deps.serial || ((f) => f()))(async () => {
          for (let attempt = 0; attempt < 3 && !ok; attempt++) {
            const api = "https://api.github.com/repos/" + cfg.owner + "/" + cfg.repo + "/contents/" + FILE;
            const payload = Object.assign({ updatedAt: Date.now() }, JSON.parse(JSON.stringify(D)));
            const res = await fetch(api, {
              method: "PUT",
              headers: { Authorization: "Bearer " + cfg.token, Accept: "application/vnd.github+json", "Content-Type": "application/json" },
              body: JSON.stringify({ message: "Training Update", content: b64(JSON.stringify(payload)), ...(sha ? { sha } : {}) })
            });
            if (deps.wrote) deps.wrote();   /* meldet den Schreibzugriff, damit der naechste Push den Mindestabstand einhaelt */
            if (res.ok) { const j = await res.json(); sha = (j.content && j.content.sha) || sha; ok = true; }
            else if (res.status === 409 || res.status === 422) { if (!(await loadCloud())) { fail = "offline"; break; } }
            else if (res.status === 401 || res.status === 403) {
              if (await rateLimited(res)) { fail = "GitHub-Schreibbremse, bitte kurz warten"; break; }
              lsDel("dashboard-gh-token"); fail = "Token ungültig oder ohne Contents-Recht"; break;
            }
            else { fail = "Status " + res.status; break; }
          }
        });
      } catch (e) { fail = "offline"; }
      pushing = false;
      if (ok) {
        if (chgSeq === seq) { dirty = false; saveLocal(); setSync("ok", "", "saved"); } else schedulePush(300);
      } else if (fail === "offline") setSync("offline");
      else setSync("error", fail || "Konflikt", "error");
    }
    /* "Sync"-Knopf des Dashboards: Cloud lesen, vereinigen, Unbestaetigtes hochladen. true = alles gesichert. */
    async function syncNow() {
      clearTimeout(pushTimer);
      if (!(await loadCloud())) return false;
      if (dirty) { clearTimeout(pushTimer); await pushNow(); }
      return !dirty;
    }
    /* Aenderung an D: lokal sichern, Cloud-Push anstossen */
    function changed() {
      bump(); dirty = true; chgSeq++;
      saveLocal();
      schedulePush();
    }
    function flushNow() { saveDraft(); if (dirty) saveLocal(); }

    /* ======================================================================
       Oberflaeche: Grundlagen (Zustand, Symbole, Ebenen, Rendern, Ereignisse)
       ====================================================================== */
    const main = deps.main;
    const esc = deps.escapeHtml || ((s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
    const PX = window.PixelSprites || null;
    const ui = {
      tab: "hist",    /* "hist" (Verlauf, Hauptansicht) | "train" (Plan) */
      screen: null,   /* null | "workout" | "editor" | "summary" */
      sheet: null,    /* offenes Fenster (Objekt mit type) */
      hp: "week",     /* Zeitraum fuer Kacheln und Verteilung */
      hm: null,       /* angezeigter Monat {y, m} */
      hx: "",         /* Uebung fuer "Kraft pro Uebung" */
      hv: "e1",       /* e1 (geschaetztes Maximum) | kg | vol */
      more: 0,        /* zusaetzlich geladene Einheiten in der Liste */
      recAll: false,
      reorder: false, /* Workout: Umsortier-Modus */
      noteFor: "",    /* Workout: Uebung, deren Notizfeld gerade offen ist */
      just: "",       /* Workout: gerade abgehakter Satz ("Uebung-Satz") fuer die kleine Animation */
      E: null,        /* Plan-Editor: Arbeitskopie */
      sum: null       /* Zusammenfassung nach dem Training */
    };

    /* ---------- Symbole ---------- */
    const iconCache = {}, sprCache = {};
    function icon(name, size) {
      size = size || 16;
      const key = name + "|" + size;
      if (iconCache[key]) return iconCache[key];
      const rows = ICONS[name];
      if (!rows) return "";
      let r = "";
      rows.forEach((row, y) => {
        let x = 0;
        while (x < 8) {
          if (row[x] !== "c") { x++; continue; }
          let w = 1;
          while (x + w < 8 && row[x + w] === "c") w++;
          r += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1"/>';
          x += w;
        }
      });
      return (iconCache[key] = '<svg class="tr-i" width="' + size + '" height="' + size + '" viewBox="0 0 8 8" shape-rendering="crispEdges" fill="currentColor" aria-hidden="true">' + r + "</svg>");
    }
    function sprite(name, size) {
      size = size || 16;
      const key = name + "|" + size;
      if (sprCache[key]) return sprCache[key];
      const s = SPRITES[name];
      if (!s) return (sprCache[key] = PX && PX.SPR && PX.SPR[name] ? PX.spr(name, size) : "");
      let r = "";
      s.r.forEach((row, y) => {
        let x = 0;
        while (x < 8) {
          const ch = row[x];
          if (ch === ".") { x++; continue; }
          let w = 1;
          while (x + w < 8 && row[x + w] === ch) w++;
          r += '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="1" fill="' + s.p[ch] + '"/>';
          x += w;
        }
      });
      return (sprCache[key] = '<svg class="spr" width="' + size + '" height="' + size + '" viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">' + r + "</svg>");
    }
    /* Uebungs- und Muskelgruppen-Symbole (tr-icons.js): 16x16 Pixel, jedes Pixel hat eine Klasse (Material + Ton, z.B. s2, g3, o = Umriss),
       die Farben stehen in training.css; --gc = Farbe der Muskelgruppe. Groessen werden auf 16/32/48 gerastert, damit die Pixel scharf bleiben. */
    const xCache = new Map();
    const snapSize = (s) => (s <= 20 ? 16 : s <= 40 ? 32 : s <= 56 ? 48 : 64);
    function xsvg(key, grp, size) {
      size = snapSize(size || 24);
      const ck = (grp ? "g:" : "") + key + "|" + size;
      let s = xCache.get(ck);
      if (s) return s;
      const ic = iconData(key, grp), n = ic.n;
      let r = "";
      for (let y = 0; y < n; y++) {
        let x = 0;
        while (x < n) {
          const c = ic.c[y * n + x];
          if (!c) { x++; continue; }
          let w = 1;
          while (x + w < n && ic.c[y * n + x + w] === c) w++;
          r += '<rect class="' + c + '" x="' + x + '" y="' + y + '" width="' + w + '" height="1"/>';
          x += w;
        }
      }
      s = '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + n + " " + n + '" shape-rendering="crispEdges" aria-hidden="true">' + r + "</svg>";
      xCache.set(ck, s);
      return s;
    }
    /* ab 32 Pixel sitzt das Symbol wie in einem Inventarfeld (Rahmen, Flaeche, unten die Farbe der Muskelgruppe) */
    const xi = (key, grp, size, col) => { const sz = snapSize(size || 24); return '<span class="tr-xi' + (sz >= 32 ? " tr-xl" : "") + '" style="--gc:' + col + '">' + xsvg(key, grp, sz) + "</span>"; };
    const exIco = (ex, size) => xi(iconKey(ex), false, size, GCOL[ex.g]);
    const grpIco = (g, size) => xi(GROUP_ICON[g] || "chest", true, size, GCOL[g] || "var(--accent)");
    const eqIco = (e, size) => xi(EQ_ICON[e], false, size, EQ[e].c);
    /* Bausteine aus Bloecken (wie in den anderen Bereichen) */
    const blocks = (n, total, color) => '<div class="tr-blk" style="--cc:' + color + '">' + Array.from({ length: total }, (_, i) => '<i class="' + (i < n ? "on" : "") + '"></i>').join("") + "</div>";

    /* ---------- Meldung ---------- */
    let toastEl = null, toastT = 0;
    function toast(msg) {
      if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "tr-toast"; toastEl.setAttribute("role", "status"); toastEl.setAttribute("aria-live", "polite"); document.body.appendChild(toastEl); }
      toastEl.textContent = msg;
      toastEl.classList.remove("on");
      void toastEl.offsetWidth;
      toastEl.classList.add("on");
      clearTimeout(toastT);
      toastT = setTimeout(() => toastEl.classList.remove("on"), 2400);
    }

    /* ---------- Huellen im Dokument: Vollbild (Workout, Editor), Fenster, Minileiste ---------- */
    const app = document.createElement("div");
    app.className = "tr tr-app"; app.hidden = true;
    app.setAttribute("role", "dialog"); app.setAttribute("aria-modal", "true"); app.setAttribute("aria-label", "Training");
    const sheetOv = document.createElement("div");
    sheetOv.className = "tr tr-ov"; sheetOv.hidden = true;
    const mini = document.createElement("div");
    mini.className = "tr tr-mini"; mini.hidden = true;
    document.body.append(app, sheetOv, mini);

    /* ---------- Ebenen + Zurueck-Taste (Handy): jede offene Ebene hat einen Verlaufseintrag ---------- */
    const layers = [];
    let ignorePopUntil = 0, pendingBack = 0, backTimer = 0;
    function layerOpen(name) {
      try { history.pushState({ tr: layers.length + 1 }, ""); layers.push(name); } catch (e) { /* ohne Verlauf (z.B. eingebettet): dann gilt nur der Schliessen-Knopf */ }
    }
    /* mehrere Ebenen, die im selben Moment schliessen, gehen mit EINEM Sprung zurueck */
    function layerClose(name) {
      const i = layers.lastIndexOf(name);
      if (i < 0) return;
      layers.splice(i, 1);
      pendingBack++;
      clearTimeout(backTimer);
      backTimer = setTimeout(() => {
        const n = pendingBack;
        pendingBack = 0;
        ignorePopUntil = Date.now() + 700;
        try { history.go(-n); } catch (e) { ignorePopUntil = 0; }
      }, 0);
    }
    const relayer = layerOpen;
    window.addEventListener("popstate", () => {
      if (Date.now() < ignorePopUntil) { ignorePopUntil = 0; return; }
      if (!layers.length) return;
      const top = layers.pop();
      if (top === "sheet") { ui.sheet = null; renderSheet(); return; }
      backFromScreen();
    });
    function backFromScreen() {
      if (ui.screen === "workout" && W) { W.min = true; queueDraft(); ui.screen = null; renderApp(); renderMini(); renderMain(); return; }
      if (ui.screen === "editor" && ui.E && ui.E.dirty) {
        relayer("screen");
        openSheet({ type: "confirm", title: "ÄNDERUNGEN VERWERFEN?", text: "Du hast diesen Tag geändert, aber noch nicht gespeichert.", yes: "VERWERFEN", no: "WEITER BEARBEITEN", act: "edDiscard" });
        return;
      }
      ui.screen = null; ui.E = null; ui.sum = null;
      renderApp(); renderMini(); renderMain();
    }
    function setScreen(name) {
      if (!ui.screen) layerOpen("screen");
      ui.screen = name;
      if (name !== "workout") ui.reorder = false;
      renderApp(); renderMini();
    }
    function closeScreen() {
      if (!ui.screen) return;
      ui.screen = null; ui.E = null; ui.sum = null; ui.reorder = false;
      renderApp(); renderMini(); renderMain();
      layerClose("screen");
    }
    function openSheet(sh) {
      if (!ui.sheet) layerOpen("sheet");
      ui.sheet = sh;
      renderSheet();
    }
    function closeSheet() {
      if (!ui.sheet) return;
      ui.sheet = null;
      renderSheet();
      layerClose("sheet");
    }

    /* ---------- Rendern ---------- */
    const SHEETS = {};   /* type -> function(sh) -> Innen-HTML */
    function renderAll() { renderMain(); renderApp(); renderSheet(); renderMini(); }
    function renderSheet() {
      const sh = ui.sheet;
      sheetOv.hidden = !sh;
      if (!sh) { sheetOv.innerHTML = ""; sheetOv.dataset.sig = ""; return; }
      /* dasselbe Fenster neu gezeichnet (z. B. Monat gewechselt): Bildlaufposition behalten */
      const sig = sh.type + "|" + (sh.t || "") + "|" + (sh.id || ""), old = sheetOv.querySelector(".tr-sheet");
      const keep = old && sheetOv.dataset.sig === sig ? old.scrollTop : 0;
      sheetOv.dataset.sig = sig;
      sheetOv.innerHTML = '<div class="tr-sheet tr-sh-' + sh.type + '" role="dialog" aria-modal="true">' + (SHEETS[sh.type] ? SHEETS[sh.type](sh) : "") + "</div>";
      const box = sheetOv.querySelector(".tr-sheet");
      if (keep && box) box.scrollTop = keep;
      sheetOv.querySelectorAll("[data-endscroll]").forEach((el) => { el.scrollLeft = el.scrollWidth; });
      const f = sheetOv.querySelector("[data-focus]");
      if (f && !(window.matchMedia && matchMedia("(pointer: coarse)").matches)) f.focus();
    }
    function renderApp() {
      const s = ui.screen;
      const keep = app.querySelector(".tr-abody");
      const sc = keep && app.dataset.s === s + (s === "workout" && W ? W.tab : "") ? keep.scrollTop : 0;
      app.hidden = !s;
      document.documentElement.classList.toggle("tr-lock", !!s);
      if (!s) { app.innerHTML = ""; app.dataset.s = ""; wakeSync(); return; }
      app.dataset.s = s + (s === "workout" && W ? W.tab : "");
      app.innerHTML = s === "workout" && W ? workoutHtml() : s === "editor" && ui.E ? editorHtml() : s === "summary" && ui.sum ? summaryHtml() : "";
      const body = app.querySelector(".tr-abody");
      if (body && sc) body.scrollTop = sc;
      wakeSync();
    }
    function renderMini() {
      const show = !!(W && !ui.screen);
      mini.hidden = !show;
      if (!show) { mini.innerHTML = ""; return; }
      const t = wTotals(), nm = esc(W.dn);
      mini.style.setProperty("--dc", COLORS[W.c]);
      mini.innerHTML = '<button type="button" class="tr-mini-b" data-a="wopen" aria-label="Laufendes Training öffnen"><span class="tr-led"></span><b>' + nm + '</b><span class="tr-mono" data-clock>' + fmtClock(Date.now() - W.a) + "</span><em>" + t.done + "/" + t.total + ' SÄTZE</em><span class="tr-mini-go">' + icon("up", 12) + "</span></button>";
    }

    /* ---------- Ereignisse (eine Verteilung je Huelle) ---------- */
    const ACT = {}, INP = {}, CHG = {};
    function onClick(e) {
      if (e.target === sheetOv) { closeSheet(); return; }
      const el = e.target.closest("[data-a]");
      if (!el || el.disabled) return;
      const f = ACT[el.dataset.a];
      if (f) f(el, e);
    }
    const onInput = (e) => { const el = e.target.closest("[data-in]"); if (el && INP[el.dataset.in]) INP[el.dataset.in](el, e); };
    const onChange = (e) => { const el = e.target.closest("[data-in]"); if (el && CHG[el.dataset.in]) CHG[el.dataset.in](el, e); };
    const onKey = (e) => {
      if (e.key === "Enter" && e.target.matches && e.target.matches("input[data-in]")) { e.preventDefault(); e.target.blur(); return; }
      if (e.key === "Escape") {
        if (ui.sheet) { closeSheet(); e.stopPropagation(); }
        else if (ui.screen) { if (ui.screen === "workout") ACT.wmin(); else if (ui.screen === "editor") ACT.edBack(); else closeScreen(); e.stopPropagation(); }
      }
    };
    [main, app, sheetOv, mini].forEach((c) => {
      c.addEventListener("click", onClick);
      c.addEventListener("input", onInput);
      c.addEventListener("change", onChange);
      c.addEventListener("keydown", onKey);
      c.addEventListener("focusin", (e) => { const t = e.target; if (t && t.matches && t.matches('input[data-in="num"]')) setTimeout(() => { try { t.select(); } catch (err) { /* egal */ } }, 0); });
    });

    /* ---------- Zahlenfelder: Plus/Minus und Eingabe in Workout, Live-Ansicht und Plan-Editor ---------- */
    /* Ein Zahlenfeld sitzt in .tr-stp[data-k]; der Kontext steht an einem Vorfahren mit data-ctx (w, l oder e) */
    function stpTarget(el) {
      const c = el.closest("[data-ctx]");
      if (!c) return null;
      const k = el.closest("[data-k]").dataset.k;
      const ctx = c.dataset.ctx;
      if (ctx === "e") {
        const pe = ui.E && ui.E.draft.ex.find((x) => x.id === c.dataset.id);
        if (!pe) return null;
        return { ctx, k, pe, si: c.dataset.si === undefined ? -1 : +c.dataset.si, ex: look()(pe.x), root: c };
      }
      const e = W && W.ex[+c.dataset.ei];
      if (!e) return null;
      return { ctx, k, e, ei: +c.dataset.ei, si: +c.dataset.si, ex: look()(e.x), root: c };
    }
    function stpGet(t) {
      if (t.ctx === "e") {
        if (t.k === "n") return t.pe.s.length;
        const s = t.pe.s[Math.max(0, t.si)];
        return t.k === "kg" ? s[0] : s[1];
      }
      const s = t.e.sets[t.si];
      return t.k === "kg" ? s.kg : s.r;
    }
    function stpPut(t, v) {
      v = clampN(Math.round(v * 100) / 100, 0, t.k === "n" ? 20 : 9999);
      if (t.ctx === "e") {
        const pe = t.pe;
        if (t.k === "n") {
          v = Math.max(1, Math.round(v));
          while (pe.s.length < v) pe.s.push(pe.s[pe.s.length - 1].slice());
          pe.s.length = v;
        } else {
          const i = t.k === "kg" ? 0 : 1;
          if (t.si < 0) pe.s.forEach((s) => { s[i] = v; }); else pe.s[t.si][i] = v;
        }
        ui.E.dirty = true;
      } else {
        t.e.sets[t.si][t.k === "kg" ? "kg" : "r"] = v;
        queueDraft();
      }
      return v;
    }
    function stpStep(t, dir) {
      const u = unitsFor(t.ex);
      const step = t.k === "kg" ? (u.aStep || D.settings.step) : t.k === "r" ? u.bStep : 1;
      return stpPut(t, stpGet(t) + dir * step);
    }
    /* Anzeige derselben Zahl in allen Feldern desselben Satzes (Liste und Live-Ansicht teilen den Zustand, nie gleichzeitig sichtbar) */
    function stpShow(el, v) { const inp = el.closest(".tr-stp").querySelector("input"); if (inp) inp.value = fmtN(v); }
    ACT.stp = (el) => {
      const t = stpTarget(el);
      if (!t) return;
      const v = stpStep(t, +el.dataset.d);
      stpShow(el, v);
      if (t.ctx === "e" && t.k === "n") renderApp();      /* Satzanzahl aendert die Zeilen */
      if (t.ctx === "e") { const sm = app.querySelector('[data-id="' + t.pe.id + '"] .tr-edsum'); if (sm) sm.textContent = planLine(t.pe); }
    };
    INP.num = (el) => {
      const t = stpTarget(el);
      if (!t) return;
      const v = parseN(el.value);
      if (v == null) return;
      stpPut(t, v);
    };
    CHG.num = (el) => {
      const t = stpTarget(el);
      if (!t) return;
      const v = parseN(el.value);
      const nv = stpPut(t, v == null ? stpGet(t) : v);
      el.value = fmtN(nv);
      if (t.ctx === "e" && t.k === "n") renderApp();
      if (t.ctx === "e") { const sm = app.querySelector('[data-id="' + t.pe.id + '"] .tr-edsum'); if (sm) sm.textContent = planLine(t.pe); }
    };
    /* Eingabe-Markup */
    const stepper = (k, v, label) =>
      '<div class="tr-stp" data-k="' + k + '"><button type="button" data-a="stp" data-d="-1" aria-label="' + label + ' verringern">' + icon("minus", 12) + '</button><input type="text" inputmode="decimal" autocomplete="off" value="' + fmtN(v) + '" data-in="num" aria-label="' + label + '"><button type="button" data-a="stp" data-d="1" aria-label="' + label + ' erhöhen">' + icon("plus", 12) + "</button></div>";

    /* ---------- Display-Wachhalten, solange ein Training laeuft (Handy bleibt an) ---------- */
    let wake = null;
    async function acquireWake() {
      try {
        if (navigator.wakeLock && W && document.visibilityState === "visible" && !wake) {
          wake = await navigator.wakeLock.request("screen");
          wake.addEventListener("release", () => { wake = null; });
        }
      } catch (e) { wake = null; }
    }
    function releaseWake() { try { if (wake) wake.release(); } catch (e) { /* egal */ } wake = null; }
    function wakeSync() { if (W) acquireWake(); else releaseWake(); }

    /* ======================================================================
       Workout: Start, Liste, Live-Ansicht, Pause-Timer, Beenden, Zusammenfassung
       ====================================================================== */
    function wTotals() {
      let done = 0, total = 0;
      W.ex.forEach((e) => e.sets.forEach((s) => { total++; if (s.done) done++; }));
      return { done, total };
    }
    function startWorkout(dayId) {
      if (W) { W.min = false; saveDraft(); setScreen("workout"); return; }
      const P0 = planOf(D), day = dayId && P0 ? P0.days.find((d) => d.id === dayId) : null;
      const I = idx(), L = look();
      W = { id: uid(), d: today(), a: Date.now(), day: day ? day.id : null, dn: day ? day.n : "Freies Training", c: day ? day.c : 11, tab: "list", cur: 0, min: false, rest: null, ex: [] };
      if (day) day.ex.forEach((pe) => W.ex.push({ id: uid(), x: pe.x, note: pe.note || "", open: false, sets: prefillSets(I, L(pe.x), pe, day.u) }));
      if (W.ex.length) W.ex[0].open = true;
      saveDraft();
      audioUnlock();
      setScreen("workout");
      renderMain();
      acquireWake();
    }
    function addExercises(ids, at) {
      const I = idx(), L = look();
      let pos = at == null ? W.ex.length : at;
      ids.forEach((x) => { W.ex.splice(pos++, 0, { id: uid(), x, note: "", open: false, sets: prefillSets(I, L(x), null) }); });
      if (ids.length) { W.ex.forEach((e) => { e.open = false; }); W.ex[pos - 1].open = true; W.cur = pos - 1; }
      queueDraft();
    }
    const exProgress = (e) => e.sets.filter((s) => s.done).length;

    /* ---------- Kopf, Reiter, Fuss ---------- */
    function workoutHtml() {
      const t = wTotals();
      return '<div class="tr-aw" style="--dc:' + COLORS[W.c] + '">' +
        '<header class="tr-ah"><button type="button" class="tr-ib" data-a="wmin" aria-label="Minimieren, Training läuft weiter">' + icon("down", 16) + "</button>" +
        '<div class="tr-at"><b>' + esc(W.dn) + '</b><small><span data-wsets>' + t.done + "/" + t.total + "</span> SÄTZE</small></div>" +
        '<span class="tr-clock tr-mono" data-clock>' + fmtClock(Date.now() - W.a) + "</span>" +
        '<button type="button" class="tr-btn tr-sm tr-go" data-a="wfinish">BEENDEN</button></header>' +
        '<div class="tr-aprog" data-wprog>' + progBlocks(t) + "</div>" +
        '<nav class="tr-wtabs" role="tablist">' +
        '<button type="button" role="tab" class="tr-wtab" data-a="wtab" data-v="list" aria-selected="' + (W.tab === "list") + '">ÜBUNGEN</button>' +
        '<button type="button" role="tab" class="tr-wtab" data-a="wtab" data-v="live" aria-selected="' + (W.tab === "live") + '">LIVE</button></nav>' +
        '<div class="tr-abody">' + (W.tab === "live" ? liveHtml() : listHtml()) + "</div>" +
        '<footer class="tr-afoot" data-wfoot>' + restHtml() + "</footer></div>";
    }
    const progBlocks = (t) => blocks(t.total ? Math.round((20 * t.done) / t.total) : 0, 20, "var(--dc)");
    function refreshProgress() {
      if (!W) return;
      const t = wTotals();
      app.querySelectorAll("[data-wsets]").forEach((el) => { el.textContent = t.done + "/" + t.total; });
      const p = app.querySelector("[data-wprog]");
      if (p) p.innerHTML = progBlocks(t);
    }

    /* ---------- Liste ---------- */
    function exLabel(ex) { return GSHORT[ex.g] === undefined ? "" : ex.g.toUpperCase() + " · " + EQ[ex.e].n; }
    function listHtml() {
      const add = '<div class="tr-addbar"><button type="button" class="tr-btn tr-wide" data-a="waddex">' + icon("plus", 12) + " ÜBUNG HINZUFÜGEN</button>" +
        (W.ex.length > 1 ? '<button type="button" class="tr-btn tr-sm" data-a="wreorder" aria-pressed="' + ui.reorder + '">' + icon("swap", 12) + (ui.reorder ? " FERTIG" : " UMSORTIEREN") + "</button>" : "") + "</div>";
      if (!W.ex.length) return '<div class="tr-empty">' + sprite("dumbbell", 44) + "<b>NOCH KEINE ÜBUNG</b><p>Füge deine erste Übung hinzu und trage deine Sätze ein.</p></div>" + add;
      return '<div class="tr-exl' + (ui.reorder ? " reorder" : "") + '" id="trExL">' + W.ex.map(exCard).join("") + "</div>" + add;
    }
    function exCard(e, i) {
      const L = look(), ex = L(e.x), I = idx(), u = unitsFor(ex);
      const done = exProgress(e), all = e.sets.length, col = GCOL[ex.g];
      const open = e.open && !ui.reorder;
      let body = "";
      if (open) {
        const last = lastEntry(I, e.x), tg = isCardio(ex) ? null : targetOf(last);
        const hint = last
          ? '<div class="tr-hint"><span class="tr-hl">ZULETZT · ' + fmtShort(last.d) + " <b>" + last.s.map(fmtSetShort).join(" · ") + "</b></span>" + (tg ? '<button type="button" class="tr-goal" data-a="goal" data-ei="' + i + '" title="Ziel in den nächsten offenen Satz eintragen">ZIEL ' + fmtSetShort(tg) + "</button>" : "") + "</div>"
          : '<div class="tr-hint"><span class="tr-hl">ERSTES MAL · KEIN VERGLEICH</span></div>';
        body = '<div class="tr-exb">' + hint +
          '<div class="tr-sethd"><span></span><span>' + u.a + "</span><span>" + u.b + "</span><span></span></div>" +
          e.sets.map((s, si) =>
            '<div class="tr-set' + (s.done ? " done" : "") + (ui.just === i + "-" + si ? " just" : "") + '" data-ctx="w" data-ei="' + i + '" data-si="' + si + '"><span class="tr-sn">' + (si + 1) + "</span>" +
            stepper("kg", s.kg, u.a + " Satz " + (si + 1)) + stepper("r", s.r, u.b + " Satz " + (si + 1)) +
            '<button type="button" class="tr-chk" data-a="chk" aria-label="Satz ' + (si + 1) + ' abhaken" aria-pressed="' + s.done + '">' + (s.done ? icon("check", 18) : "") + "</button></div>").join("") +
          '<div class="tr-exact"><button type="button" class="tr-btn tr-sm" data-a="addset" data-ei="' + i + '">' + icon("plus", 10) + " SATZ</button>" +
          (all > 1 ? '<button type="button" class="tr-btn tr-sm" data-a="delset" data-ei="' + i + '">' + icon("minus", 10) + " SATZ</button>" : "") +
          '<button type="button" class="tr-btn tr-sm" data-a="note" data-ei="' + i + '">' + icon("note", 10) + " NOTIZ</button></div>" +
          (e.note || ui.noteFor === e.id ? '<textarea class="tr-note" rows="2" maxlength="200" placeholder="Notiz zur Übung …" data-in="wnote" data-ei="' + i + '" aria-label="Notiz">' + esc(e.note) + "</textarea>" : "") + "</div>";
      }
      return '<article class="tr-ex' + (e.open ? " open" : "") + (done === all && all ? " fin" : "") + '" data-ei="' + i + '" style="--gc:' + col + '">' +
        '<div class="tr-exh">' + (ui.reorder ? '<span class="tr-grip" aria-label="Zum Umsortieren ziehen" role="img">' + icon("grip", 16) + "</span>" : "") +
        '<button type="button" class="tr-ext" data-a="exopen" data-ei="' + i + '" aria-expanded="' + open + '">' + exIco(ex, 28) + '<span class="tr-exn"><b>' + esc(ex.n) + "</b><small>" + esc(exLabel(ex)) + '</small></span><span class="tr-prog tr-mono">' + done + "/" + all + "</span>" +
        (ui.reorder ? "" : '<span class="tr-chev">' + icon(open ? "up" : "down", 12) + "</span>") + "</button>" +
        (ui.reorder ? '<button type="button" class="tr-ib" data-a="exup" data-ei="' + i + '" aria-label="Nach oben"' + (i === 0 ? " disabled" : "") + ">" + icon("up", 12) + '</button><button type="button" class="tr-ib" data-a="exdown" data-ei="' + i + '" aria-label="Nach unten"' + (i === W.ex.length - 1 ? " disabled" : "") + ">" + icon("down", 12) + "</button>"
          : '<button type="button" class="tr-ib" data-a="exmenu" data-ei="' + i + '" aria-label="Übung: Menü">' + icon("dots", 14) + "</button>") + "</div>" + body + "</article>";
    }

    /* ---------- Live-Ansicht: eine Uebung gross, ein Satz nach dem anderen ---------- */
    function liveHtml() {
      if (!W.ex.length) return listHtml();
      W.cur = clampN(W.cur, 0, W.ex.length - 1);
      const e = W.ex[W.cur], ex = look()(e.x), u = unitsFor(ex), I = idx();
      const last = lastEntry(I, e.x), tg = isCardio(ex) ? null : targetOf(last);
      const si = e.sets.findIndex((s) => !s.done);
      const chips = e.sets.map((s, i) => '<button type="button" class="tr-lchip' + (s.done ? " done" : i === si ? " cur" : "") + '" data-a="lchip" data-si="' + i + '" aria-label="Satz ' + (i + 1) + (s.done ? " erledigt, antippen zum Bearbeiten" : "") + '"><span>' + (i + 1) + "</span><b>" + (s.done ? fmtSetShort([s.kg, s.r]) : "–") + "</b></button>").join("");
      let act;
      if (si >= 0) {
        const s = e.sets[si];
        act = '<div class="tr-lbig" data-ctx="l" data-ei="' + W.cur + '" data-si="' + si + '"><div><label>' + u.a + "</label>" + stepper("kg", s.kg, u.a) + "</div><div><label>" + u.b + "</label>" + stepper("r", s.r, u.b) + "</div></div>" +
          '<button type="button" class="tr-bigbtn" data-a="lcheck">' + icon("check", 20) + " SATZ " + (si + 1) + " ABHAKEN</button>";
      } else {
        const nx = W.ex.findIndex((x, i) => i > W.cur && x.sets.some((s) => !s.done));
        act = '<div class="tr-ldone">' + sprite("medal", 36) + "<b>ÜBUNG FERTIG</b></div>" +
          (nx >= 0 ? '<button type="button" class="tr-bigbtn" data-a="lgo" data-i="' + nx + '">NÄCHSTE ÜBUNG ' + icon("right", 14) + "</button>" : '<button type="button" class="tr-bigbtn" data-a="wfinish">TRAINING BEENDEN</button>');
      }
      const nextEx = W.ex.find((x, i) => i > W.cur && x.sets.some((s) => !s.done));
      return '<div class="tr-live" style="--gc:' + GCOL[ex.g] + '">' +
        '<div class="tr-lnav"><button type="button" class="tr-ib" data-a="lgo" data-i="' + (W.cur - 1) + '" aria-label="Vorherige Übung"' + (W.cur === 0 ? " disabled" : "") + ">" + icon("left", 14) + "</button><span>ÜBUNG " + (W.cur + 1) + " / " + W.ex.length + '</span><button type="button" class="tr-ib" data-a="lgo" data-i="' + (W.cur + 1) + '" aria-label="Nächste Übung"' + (W.cur >= W.ex.length - 1 ? " disabled" : "") + ">" + icon("right", 14) + "</button></div>" +
        '<div class="tr-lh">' + exIco(ex, 64) + '<div class="tr-lhx"><h3 class="tr-lt">' + esc(ex.n) + "</h3><p class=\"tr-lsub\">" + esc(exLabel(ex)) + "</p></div></div>" +
        (last ? '<div class="tr-hint"><span class="tr-hl">ZULETZT · ' + fmtShort(last.d) + " <b>" + last.s.map(fmtSetShort).join(" · ") + "</b></span>" + (tg ? '<button type="button" class="tr-goal" data-a="goal" data-ei="' + W.cur + '">ZIEL ' + fmtSetShort(tg) + "</button>" : "") + "</div>" : '<div class="tr-hint"><span class="tr-hl">ERSTES MAL · KEIN VERGLEICH</span></div>') +
        '<div class="tr-lchips">' + chips + "</div>" + act +
        '<div class="tr-lfoot"><button type="button" class="tr-btn tr-sm" data-a="addset" data-ei="' + W.cur + '">' + icon("plus", 10) + " SATZ</button>" + (nextEx ? '<span class="tr-lnx">DANACH: ' + esc(look()(nextEx.x).n) + "</span>" : "") + "</div></div>";
    }

    /* ---------- Pause-Timer ---------- */
    const restPct = () => (W && W.rest ? clampN((100 * (W.rest.end - Date.now())) / Math.max(1, W.rest.end - W.rest.start), 0, 100) : 0);
    function restHtml() {
      if (!W || !W.rest) return "";
      return '<div class="tr-rest' + (W.rest.fin ? " fin" : "") + '" role="timer"><span class="tr-rl">' + icon("clock", 12) + ' PAUSE</span><b class="tr-mono" data-rest>' + fmtClock(Math.max(0, W.rest.end - Date.now())) + "</b>" +
        '<button type="button" class="tr-rb" data-a="rest" data-d="-15" aria-label="15 Sekunden weniger">-15</button><button type="button" class="tr-rb" data-a="rest" data-d="15" aria-label="15 Sekunden mehr">+15</button>' +
        '<button type="button" class="tr-rb" data-a="rskip" aria-label="Pause beenden">' + icon("x", 12) + '</button><div class="tr-rbar"><i data-rbar style="width:' + restPct() + '%"></i></div></div>';
    }
    function renderRest() { const f = app.querySelector("[data-wfoot]"); if (f) f.innerHTML = restHtml(); }
    function startRest() {
      const now = Date.now(), sec = D.settings.restSec;
      if (!sec) { W.rest = null; renderRest(); return; }   /* Pause-Timer aus */
      W.rest = { start: now, end: now + sec * 1000, len: sec, fin: false };
      renderRest();
    }
    let actx = null;
    function audioUnlock() {
      try {
        if (!D.settings.snd) return;
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        actx = actx || new AC();
        if (actx.state === "suspended") actx.resume();
      } catch (e) { /* kein Ton */ }
    }
    function beep(freq, t0, dur) {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = "square"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.1, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g); g.connect(actx.destination);
      o.start(t0); o.stop(t0 + dur + 0.02);
    }
    function restAlert() {
      if (D.settings.vib && navigator.vibrate) { try { navigator.vibrate([220, 90, 220, 90, 420]); } catch (e) { /* egal */ } }
      if (D.settings.snd && actx) { try { const t = actx.currentTime; beep(880, t, 0.12); beep(880, t + 0.2, 0.12); beep(1320, t + 0.4, 0.26); } catch (e) { /* egal */ } }
    }
    function tick() {
      if (!W) return;
      const now = Date.now();
      document.querySelectorAll("[data-clock]").forEach((el) => { el.textContent = fmtClock(now - W.a); });
      const r = W.rest;
      if (!r) return;
      const left = r.end - now;
      const el = app.querySelector("[data-rest]");
      if (el) el.textContent = fmtClock(Math.max(0, left));
      const bar = app.querySelector("[data-rbar]");
      if (bar) bar.style.width = restPct() + "%";
      if (left <= 0 && !r.fin) { r.fin = true; if (left > -5000) restAlert(); renderRest(); queueDraft(); }
      else if (left < -9000) { W.rest = null; renderRest(); queueDraft(); }
    }

    /* ---------- Aktionen im Workout ---------- */
    ACT.start = (el) => { if (W) { toast("EIN TRAINING LÄUFT BEREITS"); startWorkout(); return; } startWorkout(el.dataset.id); };
    ACT.quick = () => startWorkout(null);
    ACT.wopen = () => { if (!W) return; W.min = false; queueDraft(); setScreen("workout"); };
    ACT.wmin = () => { if (!W) return; W.min = true; saveDraft(); closeScreen(); };
    ACT.wtab = (el) => { W.tab = el.dataset.v; queueDraft(); renderApp(); };
    ACT.exopen = (el) => {
      const i = +el.dataset.ei;
      if (ui.reorder) return;
      W.ex[i].open = !W.ex[i].open;
      W.cur = i;
      queueDraft(); renderApp();
    };
    ACT.chk = (el) => { const r = el.closest(".tr-set"); toggleSet(+r.dataset.ei, +r.dataset.si); };
    ACT.lcheck = () => { const e = W.ex[W.cur], si = e.sets.findIndex((s) => !s.done); if (si >= 0) toggleSet(W.cur, si); };
    ACT.lchip = (el) => {
      const e = W.ex[W.cur], si = +el.dataset.si, s = e.sets[si];
      if (s.done) { s.done = false; queueDraft(); renderApp(); refreshProgress(); renderMini(); }
    };
    ACT.lgo = (el) => { const i = +el.dataset.i; if (i >= 0 && i < W.ex.length) { W.cur = i; queueDraft(); renderApp(); } };
    function toggleSet(ei, si) {
      const e = W.ex[ei], s = e.sets[si], ex = look()(e.x);
      s.done = !s.done;
      let scrollTo = -1;
      if (s.done) {
        audioUnlock();
        ui.just = ei + "-" + si;
        const all = W.ex.every((x) => x.sets.every((y) => y.done));
        if (all || isCardio(ex)) W.rest = null; else startRest();
        if (e.sets.every((y) => y.done) && W.tab === "list") {
          e.open = false;
          const nx = W.ex.findIndex((x, i) => i > ei && x.sets.some((y) => !y.done));
          if (nx >= 0) { W.ex[nx].open = true; W.cur = nx; scrollTo = nx; }
        }
      } else ui.just = "";
      queueDraft();
      renderApp(); renderMini();
      if (scrollTo >= 0) { const c = app.querySelector('.tr-ex[data-ei="' + scrollTo + '"]'); if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); }
    }
    ACT.goal = (el) => {
      const ei = +el.dataset.ei, e = W.ex[ei], ex = look()(e.x), tg = targetOf(lastEntry(idx(), e.x));
      if (!tg) return;
      let si = e.sets.findIndex((s) => !s.done);
      if (si < 0) si = e.sets.length - 1;
      e.sets[si].kg = tg[0]; e.sets[si].r = tg[1];
      queueDraft(); renderApp();
      toast("ZIEL IN SATZ " + (si + 1) + " EINGETRAGEN");
    };
    ACT.addset = (el) => {
      const e = W.ex[+el.dataset.ei], l = e.sets[e.sets.length - 1];
      e.sets.push({ kg: l ? l.kg : 0, r: l ? l.r : 10, done: false });
      queueDraft(); renderApp(); refreshProgress(); renderMini();
    };
    ACT.delset = (el) => {
      const e = W.ex[+el.dataset.ei];
      if (e.sets.length > 1) e.sets.pop();
      queueDraft(); renderApp(); refreshProgress(); renderMini();
    };
    ACT.note = (el) => { const e = W.ex[+el.dataset.ei]; ui.noteFor = e.id; renderApp(); const t = app.querySelector("textarea.tr-note"); if (t) t.focus(); };
    INP.wnote = (el) => { const e = W.ex[+el.dataset.ei]; if (e) { e.note = el.value.slice(0, 200); queueDraft(); } };
    ACT.wreorder = () => { ui.reorder = !ui.reorder; renderApp(); };
    function moveEx(from, to) {
      if (to < 0 || to >= W.ex.length || from === to) return;
      const cur = W.ex[W.cur];
      const [m] = W.ex.splice(from, 1);
      W.ex.splice(to, 0, m);
      W.cur = Math.max(0, W.ex.indexOf(cur));
      queueDraft(); renderApp();
    }
    ACT.exup = (el) => moveEx(+el.dataset.ei, +el.dataset.ei - 1);
    ACT.exdown = (el) => moveEx(+el.dataset.ei, +el.dataset.ei + 1);
    ACT.waddex = () => openPicker({ ctx: "workout", mode: "add", exclude: W.ex.map((e) => e.x) });
    ACT.rest = (el) => {
      if (!W || !W.rest) return;
      const d = +el.dataset.d * 1000;
      W.rest.end = Math.max(Date.now() + 1000, W.rest.end + d);
      W.rest.fin = false;
      renderRest(); queueDraft();
    };
    ACT.rskip = () => { if (!W) return; W.rest = null; renderRest(); queueDraft(); };

    /* Menue einer Uebung (Notiz, verschieben, ersetzen, entfernen, Verlauf) */
    ACT.exmenu = (el) => openSheet({ type: "exmenu", ei: +el.dataset.ei });
    SHEETS.exmenu = (sh) => {
      const e = W.ex[sh.ei], ex = look()(e.x);
      const b = (a, ic, t, cls) => '<button type="button" class="tr-mi' + (cls ? " " + cls : "") + '" data-a="' + a + '" data-ei="' + sh.ei + '">' + icon(ic, 14) + "<span>" + t + "</span></button>";
      return '<div class="tr-sh-h"><h3 class="tr-hico">' + exIco(ex, 26) + "<span>" + esc(ex.n) + '</span></h3><button type="button" class="tr-ib" data-a="shclose" aria-label="Schließen">' + icon("x", 12) + '</button></div><div class="tr-menu">' +
        b("mnote", "note", "NOTIZ") + b("mhist", "clock", "VERLAUF DIESER ÜBUNG") + (sh.ei > 0 ? b("mup", "up", "NACH OBEN") : "") + (sh.ei < W.ex.length - 1 ? b("mdown", "down", "NACH UNTEN") : "") +
        b("mrepl", "swap", "ÜBUNG ERSETZEN") + b("mrm", "trash", "ÜBUNG ENTFERNEN", "bad") + "</div>";
    };
    ACT.shclose = () => closeSheet();
    ACT.mnote = (el) => { const e = W.ex[+el.dataset.ei]; ui.noteFor = e.id; e.open = true; closeSheet(); renderApp(); const t = app.querySelector("textarea.tr-note"); if (t) t.focus(); };
    ACT.mup = (el) => { closeSheet(); moveEx(+el.dataset.ei, +el.dataset.ei - 1); };
    ACT.mdown = (el) => { closeSheet(); moveEx(+el.dataset.ei, +el.dataset.ei + 1); };
    ACT.mrm = (el) => {
      const i = +el.dataset.ei;
      closeSheet();
      W.ex.splice(i, 1);
      W.cur = clampN(W.cur, 0, Math.max(0, W.ex.length - 1));
      queueDraft(); renderApp(); refreshProgress(); renderMini();
    };
    ACT.mrepl = (el) => { const i = +el.dataset.ei; openPicker({ ctx: "workout", mode: "replace", at: i, exclude: W.ex.map((e) => e.x) }); };
    ACT.mhist = (el) => openSheet({ type: "exhist", x: W.ex[+el.dataset.ei].x });
    SHEETS.exhist = (sh) => {
      const ex = look()(sh.x), I = idx(), list = (I.byEx[sh.x] || []).slice().reverse().slice(0, 8);
      const rec = recordsOf(I, look()).find((r) => r.x === sh.x);
      return '<div class="tr-sh-h"><h3 class="tr-hico">' + exIco(ex, 26) + "<span>" + esc(ex.n) + '</span></h3><button type="button" class="tr-ib" data-a="shclose" aria-label="Schließen">' + icon("x", 12) + "</button></div>" +
        (rec ? '<p class="tr-rec">' + sprite("medal", 16) + " REKORD <b>" + esc(fmtSet(ex, rec.best)) + "</b> · " + fmtDayY(rec.d) + "</p>" : "") +
        (list.length ? '<ul class="tr-hl-list">' + list.map((en) => "<li><span>" + fmtDay(en.d) + "</span><b>" + en.s.map(fmtSetShort).join(" · ") + "</b></li>").join("") + "</ul>" : '<p class="tr-mute">Noch keine Einheit mit dieser Übung.</p>');
    };

    /* ---------- Beenden / Verwerfen ---------- */
    ACT.wfinish = () => {
      if (!W) return;
      const t = wTotals();
      if (!t.done) { openSheet({ type: "confirm", title: "NICHTS ABGEHAKT", text: "Du hast noch keinen Satz abgehakt. Training verwerfen?", yes: "VERWERFEN", no: "WEITER TRAINIEREN", act: "wDiscard" }); return; }
      const open = t.total - t.done;
      openSheet({ type: "confirm", title: "TRAINING BEENDEN?", text: open ? open + (open === 1 ? " nicht abgehakter Satz wird" : " nicht abgehakte Sätze werden") + " nicht gespeichert." : "Alle Sätze sind abgehakt. Stark!", yes: "BEENDEN & SPEICHERN", no: "ZURÜCK", act: "wFinish", good: true });
    };
    function finishWorkout() {
      if (!W) return;
      const L = look(), I = idx(), now = Date.now();
      const exs = [];
      W.ex.forEach((e) => {
        const sets = e.sets.filter((s) => s.done && s.r > 0).map((s) => [s.kg, s.r]);
        if (sets.length) exs.push({ x: e.x, s: sets, note: e.note });
      });
      if (!exs.length) { discardWorkout(); return; }
      const ev = evalSession(I, L, exs);
      const se = {
        id: W.id, d: W.d, a: W.a, b: now, day: W.day, dn: W.dn, c: W.c, u: now,
        ex: exs.map((e) => { const ex = L(e.x), o = { x: e.x, s: e.s }; if (!EXBY[e.x]) { o.n = ex.n; o.g = ex.g; o.e = ex.e; } if (e.note) o.note = e.note; return o; })
      };
      D.sessions.push(se);
      /* Plan nachziehen: die geschafften Werte werden zum neuen Plan-Wert (abschaltbar) */
      if (D.settings.auto && se.day) {
        let day = null, pl = null, ch = false;
        D.plans.forEach((p) => { const d = p.days.find((x) => x.id === se.day); if (d) { day = d; pl = p; } });
        if (day) se.ex.forEach((e) => {
          const pe = day.ex.find((p) => p.x === e.x);
          if (!pe) return;
          e.s.forEach((s, i) => { if (!pe.s[i] || pe.s[i][0] !== s[0] || pe.s[i][1] !== s[1]) { pe.s[i] = [s[0], s[1]]; ch = true; } });
        });
        if (ch) { day.u = now; pl.u = now; }
      }
      changed();
      const items = xpItems(se.id, ev);
      const lv0 = deps.xp && deps.xp.info ? deps.xp.info() : null;   /* Level vor Habit und XP, fuer den Hinweis "Level-Up" */
      const wait = !cloudOk();
      let habit = null;
      if (wait) { pendAdd(items, se.d); habit = "wait"; }
      else if (deps.habitDone) habit = deps.habitDone("gym", se.d);
      const sum = {
        se, ev, items, habit, wait, lv0, lv1: null,
        xp: items.reduce((n, it) => n + it[1], 0),
        sets: setsOf(se), dur: durOf(se), vol: volumeOf(se, look())
      };
      W = null;
      saveDraft(); releaseWake();
      ui.sum = sum;
      closeSheetSilently();
      setScreen("summary");
      renderMain();
      if (deps.xp && !wait) setTimeout(() => {
        const chip = app.querySelector(".tr-xpchip");
        if (items.length) deps.xp.awardMany(items, chip || null);
        if (ui.sum === sum && deps.xp.info) { sum.lv1 = deps.xp.info(); renderApp(); }
      }, 350);
    }

    /* ---------- Belohnungen: XP und Habit "Gym" ----------
       Beides gehoert dem Dashboard und geht erst, wenn dessen Cloud-Stand geladen ist (body[data-cloud="ready"]); vorher liefe die Buchung in einen
       noch leeren Speicher. Im Studio ohne Netz wird sie lokal vorgemerkt (dashboard-training-pend) und beim naechsten "cloud-ready" eingeloest.
       Jede XP-Buchung hat einen festen Schluessel (zaehlt nur einmal) und das Habit wird nur eingeschaltet: ein doppeltes Einloesen ist harmlos. */
    const LS_PEND = "dashboard-training-pend";
    const cloudOk = () => (deps.cloudReady ? !!deps.cloudReady() : true);
    function pendRead() {
      const none = { items: [], days: [] };
      try {
        const p = JSON.parse(lsGet(LS_PEND) || "null");
        if (!p || typeof p !== "object") return none;
        return {
          items: (Array.isArray(p.items) ? p.items : []).filter((it) => Array.isArray(it) && typeof it[0] === "string" && num(it[1]) > 0).slice(-200).map((it) => [it[0].slice(0, 120), num(it[1])]),
          days: (Array.isArray(p.days) ? p.days : []).filter(isDK).slice(-60)
        };
      } catch (e) { return none; }
    }
    function pendAdd(items, day) {
      const p = pendRead();
      items.forEach((it) => { if (!p.items.some((x) => x[0] === it[0])) p.items.push([it[0], it[1]]); });
      if (isDK(day) && p.days.indexOf(day) < 0) p.days.push(day);
      lsSet(LS_PEND, JSON.stringify(p));
    }
    function redeemPending() {
      const p = pendRead();
      if (!(p.items.length || p.days.length) || !cloudOk()) return;
      let got = 0;
      if (p.items.length && deps.xp) got = deps.xp.awardMany(p.items, null) || 0;
      if (deps.habitDone) p.days.forEach((d) => deps.habitDone("gym", d));
      lsDel(LS_PEND);
      toast("TRAINING: " + (got ? "+" + got + " XP GUTGESCHRIEBEN" : "HABIT GYM ABGEHAKT"));
    }
    /* Fenster schliessen ohne zweiten Verlaufssprung (wird direkt vor einem Screen-Wechsel gebraucht) */
    function closeSheetSilently() { if (ui.sheet) { ui.sheet = null; renderSheet(); layerClose("sheet"); } }
    function discardWorkout() {
      W = null; saveDraft(); releaseWake();
      closeSheetSilently();
      closeScreen();
      renderMini(); renderMain();
      toast("TRAINING VERWORFEN");
    }
    ACT.sumClose = () => { closeScreen(); };
    /* Stand der Level-Leiste nach den Buchungen (gleiche Leiste wie oben im Dashboard), bei Aufstieg mit Hinweis */
    function levelHtml(s) {
      const a = s.lv1;
      if (!a) return "";
      const up = s.lv0 && a.level > s.lv0.level;
      return (up ? '<div class="tr-lvup">' + sprite("bolt", 16) + " LEVEL UP! LVL " + a.level + " · " + esc(String(a.rank).toUpperCase()) + "</div>" : "") +
        '<div class="tr-lvl"><b class="tr-mono">LVL ' + a.level + "</b>" + blocks(Math.floor((10 * a.into) / a.need), 10, "var(--accent)") + "<small>" + a.into + " / " + a.need + " XP</small></div>";
    }
    function summaryHtml() {
      const s = ui.sum, se = s.se, L = look();
      const badge = (k) => k === "pr" ? '<span class="tr-bdg pr">' + sprite("medal", 12) + " NEUER REKORD</span>" : k === "up" ? '<span class="tr-bdg up">' + sprite("bolt", 12) + " STEIGERUNG</span>" : k === "new" ? '<span class="tr-bdg nw">ERSTES MAL</span>' : "";
      const rows = se.ex.map((e) => {
        const ex = L(e.x, e), ev = s.ev.find((v) => v.x === e.x), b = isCardio(ex) ? null : bestOf(e.s);
        return "<li>" + exIco(ex, 28) + "<div><b>" + esc(ex.n) + "</b><small>" + nSatz(e.s.length) + (b ? " · BESTER: " + esc(fmtSet(ex, b)) : "") + (ev && ev.prev ? " · VORHER " + esc(fmtSet(ex, ev.prev)) : "") + "</small></div>" + (ev ? badge(ev.kind) : "") + "</li>";
      }).join("");
      return '<div class="tr-aw tr-sum" style="--dc:' + COLORS[se.c] + '"><header class="tr-ah"><div class="tr-at"><b>GESCHAFFT!</b><small>' + esc(se.dn) + " · " + fmtDay(se.d) + '</small></div><button type="button" class="tr-btn tr-sm tr-go" data-a="sumClose">FERTIG</button></header>' +
        '<div class="tr-abody"><div class="tr-trophy">' + sprite("medal", 64) + '</div><div class="tr-sumstats"><div><small>DAUER</small><b class="tr-mono">' + fmtDur(s.dur) + '</b></div><div><small>SÄTZE</small><b class="tr-mono">' + s.sets + '</b></div><div><small>VOLUMEN</small><b class="tr-mono">' + fmtInt(s.vol) + ' kg</b></div></div>' +
        (s.xp ? '<div class="tr-xpchip">' + sprite("bolt", 16) + " +" + s.xp + " XP EXTRA</div>" : "") +
        (s.wait ? '<p class="tr-okline tr-wait">' + icon("clock", 12) + " XP UND HABIT „GYM“ FOLGEN, SOBALD DIE CLOUD GELADEN IST</p>" : "") +
        (s.habit === true ? '<p class="tr-okline">' + icon("check", 12) + " HABIT „GYM“ FÜR HEUTE ABGEHAKT</p>" : s.habit === false ? '<p class="tr-okline">' + icon("check", 12) + " HABIT „GYM“ WAR SCHON ABGEHAKT</p>" : "") +
        levelHtml(s) +
        (s.ev.some((v) => v.kind === "pr" || v.kind === "up") ? "" : '<p class="tr-mute">Diesmal kein neuer Rekord und keine Steigerung gegenüber dem letzten Mal – dranbleiben!</p>') +
        '<ul class="tr-sumlist">' + rows + "</ul></div></div>";
    }

    /* ---------- Umsortieren per Ziehen (Workout-Liste und Plan-Editor) ---------- */
    function dragSort(e, listEl, itemSel, onDone) {
      const grip = e.target.closest(".tr-grip");
      if (!grip || !listEl || (e.button != null && e.button > 0)) return;
      const item = grip.closest(itemSel);
      if (!item) return;
      const items = Array.from(listEl.querySelectorAll(":scope > " + itemSel));
      const from = items.indexOf(item);
      if (from < 0) return;
      e.preventDefault();
      const rects = items.map((el) => el.getBoundingClientRect());
      const gap = items.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
      const hh = rects[from].height + gap, y0 = e.clientY;
      let to = from;
      item.classList.add("drag");
      try { grip.setPointerCapture(e.pointerId); } catch (err) { /* egal */ }
      const move = (ev) => {
        const dy = ev.clientY - y0;
        item.style.transform = "translateY(" + dy + "px)";
        const c = rects[from].top + rects[from].height / 2 + dy;
        let t = from;
        for (let i = 0; i < items.length; i++) {
          const mid = rects[i].top + rects[i].height / 2;
          if (i < from && c < mid) { t = i; break; }
          if (i > from && c > mid) t = i;
        }
        if (t !== to) {
          to = t;
          items.forEach((el, i) => {
            if (i === from) return;
            const sh = from < to && i > from && i <= to ? -hh : from > to && i < from && i >= to ? hh : 0;
            el.style.transform = sh ? "translateY(" + sh + "px)" : "";
          });
        }
      };
      const up = () => {
        grip.removeEventListener("pointermove", move);
        grip.removeEventListener("pointerup", up);
        grip.removeEventListener("pointercancel", up);
        item.classList.remove("drag");
        items.forEach((el) => { el.style.transform = ""; });
        if (to !== from) onDone(from, to);
      };
      grip.addEventListener("pointermove", move);
      grip.addEventListener("pointerup", up);
      grip.addEventListener("pointercancel", up);
    }
    app.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".tr-grip")) return;
      if (ui.screen === "workout") dragSort(e, app.querySelector("#trExL"), ".tr-ex", moveEx);
      else if (ui.screen === "editor") dragSort(e, app.querySelector("#trEdL"), ".tr-edx", edMove);
    });

    /* ---------- Bestaetigungs-Fenster (gemeinsam genutzt) ---------- */
    const CONFIRM = {
      wDiscard: () => { closeSheetSilently(); discardWorkout(); },
      wFinish: () => finishWorkout()
    };
    SHEETS.confirm = (sh) =>
      '<div class="tr-sh-h"><h3>' + esc(sh.title) + '</h3></div><p class="tr-sh-p">' + esc(sh.text) + '</p><div class="tr-sh-a"><button type="button" class="tr-btn" data-a="cno" data-focus>' + esc(sh.no) + '</button><button type="button" class="tr-btn ' + (sh.good ? "tr-go" : "tr-bad") + '" data-a="cyes">' + esc(sh.yes) + "</button></div>";
    ACT.cno = () => closeSheet();
    ACT.cyes = () => {
      const sh = ui.sheet;
      if (!sh) return;
      const f = CONFIRM[sh.act];
      if (f) f(sh.arg);
    };

    /* ======================================================================
       Bereich im Dashboard: Karte "Als naechstes" / laufendes Training, Reiter Verlauf | Plan, Plan mit Tageskarten, Kennzahl
       ====================================================================== */
    /* "3x8 · 80 kg" bzw. "8/8/6 · 80 kg" */
    function planLine(pe) {
      const s = pe.s, ex = look()(pe.x);
      if (isCardio(ex)) return fmtN(s[0][1]) + " min";
      const same = s.every((x) => x[0] === s[0][0] && x[1] === s[0][1]);
      const unit = TIMED[pe.x] ? " s" : "";
      const kgMax = s.reduce((m, x) => Math.max(m, x[0]), 0);
      return same
        ? s.length + "×" + fmtN(s[0][1]) + unit + (s[0][0] > 0 ? " · " + fmtN(s[0][0]) + " kg" : "")
        : s.map((x) => fmtN(x[1])).join("/") + unit + (kgMax > 0 ? " · " + fmtN(kgMax) + " kg" : "");
    }
    const shHead = (title) => '<div class="tr-sh-h"><h3>' + title + '</h3><button type="button" class="tr-ib" data-a="shclose" aria-label="Schließen">' + icon("x", 12) + "</button></div>";

    function renderMain() {
      const t = ui.tab;
      main.innerHTML = nextCard() +
        '<div class="tr-tabs" role="tablist" aria-label="Training">' +
        '<button type="button" role="tab" class="tr-tab" data-a="tab" data-v="hist" aria-selected="' + (t === "hist") + '">' + sprite("medal", 14) + "VERLAUF</button>" +
        '<button type="button" role="tab" class="tr-tab" data-a="tab" data-v="train" aria-selected="' + (t === "train") + '">' + sprite("dumbbell", 14) + "PLAN</button></div>" +
        (t === "hist" ? histHtml() : planHtml());
    }
    ACT.tab = (el) => { ui.tab = el.dataset.v; renderMain(); };

    /* Immer ganz oben (egal welcher Reiter): laeuft ein Training, ist es die Karte zum Weitermachen; sonst steht der naechste Tag mit START bereit */
    function nextCard() {
      const I = idx(), L = look(), t = today();
      if (W) {
        const wt = wTotals();
        return '<div class="tr-card tr-run" style="--dc:' + COLORS[W.c] + '"><span class="tr-led"></span><div class="tr-run-t"><b>TRAINING LÄUFT · ' + esc(W.dn) + '</b><small><span class="tr-mono" data-clock>' + fmtClock(Date.now() - W.a) + "</span> · " + wt.done + "/" + wt.total + ' SÄTZE</small></div><button type="button" class="tr-btn tr-go" data-a="wopen">WEITER ' + icon("right", 12) + "</button></div>";
      }
      const nx = nextDay(D, I), P = planOf(D);
      const isRest = D.rest.days.indexOf(wdOf(t)) >= 0, did = !!I.byDate[t];
      const todayTxt = "HEUTE · " + WD_L[wdOf(t)].toUpperCase() + (did ? " · SCHON TRAINIERT" : isRest ? " · RUHETAG" : "");
      if (!nx) {
        return '<div class="tr-card tr-next tr-next0"><div class="tr-nx-t"><small>' + (isRest && !did ? icon("moon", 10) : icon("clock", 10)) + " " + todayTxt + "</small><b>" + (P ? "Plan „" + esc(P.n) + "“ ist noch leer" : "Noch kein Trainingsplan") + "</b><span>Lege einen Trainingstag an, nimm eine Vorlage oder starte ein freies Training.</span></div>" +
          '<div class="tr-nx-a"><button type="button" class="tr-btn tr-go" data-a="newDay">' + icon("plus", 12) + ' TAG ANLEGEN</button><button type="button" class="tr-btn" data-a="tpl">VORLAGEN</button><button type="button" class="tr-btn" data-a="quick">' + icon("right", 12) + " FREIES TRAINING</button></div></div>";
      }
      const icons = nx.ex.slice(0, 5).map((pe) => exIco(L(pe.x), 26)).join("");
      return '<div class="tr-card tr-next" style="--dc:' + COLORS[nx.c] + '"><div class="tr-nx-i">' + (icons || sprite("dumbbell", 30)) + '</div><div class="tr-nx-t"><small>ALS NÄCHSTES</small><b>' + esc(nx.n) + "</b><span>" + (nx.f ? esc(nx.f) + " · " : "") + nUeb(nx.ex.length) + " · ~" + estMin(nx, D.settings.restSec) + ' MIN</span><em class="tr-nx-d">' + (isRest && !did ? icon("moon", 10) : icon("clock", 10)) + " " + todayTxt + "</em></div>" +
        '<div class="tr-nx-a"><button type="button" class="tr-btn tr-go" data-a="start" data-id="' + nx.id + '">' + icon("right", 12) + ' START</button><button type="button" class="tr-btn tr-sm" data-a="quick">FREIES TRAINING</button></div></div>';
    }

    function dayCard(d, nx) {
      const L = look(), isNext = nx && nx.id === d.id;
      const prev = d.ex.slice(0, 4).map((pe) => {
        const ex = L(pe.x);
        return "<li>" + exIco(ex, 18) + '<span class="tr-nm">' + esc(ex.n) + "</span><em>" + esc(planLine(pe)) + "</em></li>";
      }).join("");
      const more = d.ex.length > 4 ? '<li class="more">+ ' + (d.ex.length - 4) + " WEITERE</li>" : "";
      return '<article class="tr-card tr-day' + (isNext ? " next" : "") + '" style="--dc:' + COLORS[d.c] + '">' +
        '<div class="tr-dh"><div><h3>' + esc(d.n) + "</h3>" + (d.f ? "<p>" + esc(d.f) + "</p>" : "") + "</div>" + (isNext ? '<span class="tr-tag"><i></i>ALS NÄCHSTES</span>' : "") + "</div>" +
        '<p class="tr-dm">' + nUeb(d.ex.length) + " · " + nSatz(planSets(d)) + " · ~" + estMin(d, D.settings.restSec) + " MIN</p>" +
        (d.ex.length ? '<ul class="tr-dl">' + prev + more + "</ul>" : '<p class="tr-mute">Noch keine Übungen – im Editor hinzufügen.</p>') +
        '<div class="tr-da"><button type="button" class="tr-btn tr-go" data-a="start" data-id="' + d.id + '">' + icon("right", 12) + ' START</button><button type="button" class="tr-btn" data-a="editDay" data-id="' + d.id + '" aria-label="' + esc(d.n) + ' bearbeiten">' + icon("pencil", 12) + " BEARBEITEN</button></div></article>";
    }

    /* Reiter PLAN: Plan-Kopf (Plaene, Vorlagen, Einstellungen), Ruhetage-Zeile, Tageskarten */
    function planHtml() {
      const P = planOf(D), days = P ? P.days : [], nx = nextDay(D, idx());
      const exN = days.reduce((n, d) => n + d.ex.length, 0);
      let h = '<div class="tr-card tr-ph"><div class="tr-ph-l">' + sprite("dumbbell", 30) + "<div><h3>" + esc((P ? P.n : "Mein Plan").toUpperCase()) + "</h3><p>" + (days.length ? nTag(days.length) + " · " + nUeb(exN) : "NOCH LEER") + (D.plans.length > 1 ? " · " + D.plans.length + " PLÄNE" : "") + '</p></div></div><div class="tr-ph-r"><button type="button" class="tr-btn tr-sm" data-a="plans">PLÄNE</button><button type="button" class="tr-btn tr-sm" data-a="tpl">VORLAGEN</button><button type="button" class="tr-btn tr-sm" data-a="settings" aria-label="Einstellungen und Ruhetage">' + icon("dots", 12) + " EINSTELLUNGEN</button></div></div>";
      const restTxt = WK.filter((n) => D.rest.days.indexOf(n) >= 0).map((n) => WD_S[n].toUpperCase()).join(" ") || "KEINE";
      h += '<div class="tr-todayrow"><button type="button" class="tr-link" data-a="settings" aria-label="Ruhetage ändern">' + icon("moon", 10) + " RUHETAGE: " + restTxt + "</button></div>";
      if (!days.length) {
        h += '<div class="tr-card tr-emptycard">' + sprite("dumbbell", 56) + "<h3>DEIN PLAN IST NOCH LEER</h3><p>Lege deinen ersten Trainingstag an oder starte mit einer fertigen Vorlage. Ein freies Training ohne Plan geht auch.</p>" +
          '<div class="tr-row"><button type="button" class="tr-btn tr-go" data-a="newDay">' + icon("plus", 12) + ' ERSTER TAG</button><button type="button" class="tr-btn" data-a="tpl">VORLAGEN</button></div></div>';
      } else {
        h += '<div class="tr-days">' + days.map((d) => dayCard(d, nx)).join("") + '<button type="button" class="tr-addday" data-a="newDay">' + icon("plus", 14) + "<span>TAG HINZUFÜGEN</span></button></div>";
      }
      return h;
    }
    ACT.newDay = () => editDay(null);
    ACT.editDay = (el) => editDay(el.dataset.id);
    ACT.tpl = () => openSheet({ type: "tpl" });
    ACT.settings = () => openSheet({ type: "settings" });

    /* Cloud-Stand wurde eingemischt: Anzeige im Bereich auffrischen (Fenster und Vollbild bleiben unberuehrt) */
    function onDataReplaced() { renderMain(); renderMini(); }

    /* Kennzahl in der Titelzeile des Bereichs */
    function metric() {
      if (W) return "LÄUFT " + fmtClock(Date.now() - W.a);
      const I = idx(), t = today();
      if (I.sess.length) return "WOCHE " + periodStats(I, look(), mondayOf(t), addD(mondayOf(t), 6)).n + " · SERIE " + streakOf(I, D.rest.days, t);
      const nx = nextDay(D, I);
      return nx ? ("NÄCHSTES: " + nx.n.toUpperCase()).slice(0, 26) : "";
    }

    /* ======================================================================
       Plan: Tag-Editor, Uebungswahl (Katalog + eigene), Vorlagen, Einstellungen
       ====================================================================== */
    function defaultPlanSets(ex) {
      const last = lastEntry(idx(), ex.id);
      if (last) return last.s.map((s) => [s[0], s[1]]);
      const d = isCardio(ex) ? [0, 20] : [0, TIMED[ex.id] ? 30 : 10];
      return Array.from({ length: isCardio(ex) ? 1 : 3 }, () => d.slice());
    }

    /* ---------- Tag-Editor (Arbeitskopie, erst SPEICHERN schreibt in den Plan) ---------- */
    function editDay(id) {
      const P = planOf(D), days = P ? P.days : [];
      const src = id ? days.find((d) => d.id === id) : null;
      const draft = src ? JSON.parse(JSON.stringify(src)) : { id: uid(), n: "Tag " + (days.length + 1), f: "", c: days.length % COLORS.length, ex: [] };
      ui.E = { draft, isNew: !src, open: null, uni: {}, dirty: false };
      draft.ex.forEach((pe) => { ui.E.uni[pe.id] = pe.s.every((s) => s[0] === pe.s[0][0] && s[1] === pe.s[0][1]); });
      setScreen("editor");
    }
    const edEx = (id) => ui.E && ui.E.draft.ex.find((p) => p.id === id);
    function edItem(pe) {
      const E = ui.E, ex = look()(pe.x), open = E.open === pe.id, u = unitsFor(ex);
      let body = "";
      if (open) {
        const ctx = 'data-ctx="e" data-id="' + pe.id + '"';
        let rows;
        if (E.uni[pe.id]) {
          rows = '<div class="tr-eds" ' + ctx + '><div class="tr-edrow"><label>SÄTZE</label>' + stepper("n", pe.s.length, "Sätze") + '</div><div class="tr-edrow"><label>' + u.b + "</label>" + stepper("r", pe.s[0][1], u.b) + '</div><div class="tr-edrow"><label>' + u.a + "</label>" + stepper("kg", pe.s[0][0], u.a) + "</div></div>";
        } else {
          rows = '<div class="tr-sethd tr-sethd-e"><span></span><span>' + u.b + "</span><span>" + u.a + "</span></div>" +
            pe.s.map((s, si) => '<div class="tr-set tr-set-e" ' + ctx + ' data-si="' + si + '"><span class="tr-sn">' + (si + 1) + "</span>" + stepper("r", s[1], u.b + " Satz " + (si + 1)) + stepper("kg", s[0], u.a + " Satz " + (si + 1)) + "</div>").join("") +
            '<div class="tr-exact"><button type="button" class="tr-btn tr-sm" data-a="edAddSet" data-id="' + pe.id + '">' + icon("plus", 10) + ' SATZ</button>' + (pe.s.length > 1 ? '<button type="button" class="tr-btn tr-sm" data-a="edDelSet" data-id="' + pe.id + '">' + icon("minus", 10) + " SATZ</button>" : "") + "</div>";
        }
        body = '<div class="tr-edxb"><div class="tr-chips"><button type="button" class="tr-chip" data-a="edUni" data-id="' + pe.id + '" aria-pressed="' + !!E.uni[pe.id] + '">ALLE SÄTZE GLEICH</button></div>' + rows +
          '<label class="tr-fl tr-fl-s"><span>NOTIZ</span><input type="text" class="tr-in" maxlength="200" value="' + esc(pe.note) + '" data-in="edpn" data-id="' + pe.id + '" placeholder="z. B. Tempo 3-1-1" autocomplete="off"></label></div>';
      }
      return '<div class="tr-edx' + (open ? " open" : "") + '" data-id="' + pe.id + '" style="--gc:' + GCOL[ex.g] + '"><div class="tr-edxh"><span class="tr-grip" aria-label="Zum Umsortieren ziehen" role="img">' + icon("grip", 16) + "</span>" +
        '<button type="button" class="tr-edxt" data-a="edOpen" data-id="' + pe.id + '" aria-expanded="' + open + '">' + exIco(ex, 28) + '<span class="tr-exn"><b>' + esc(ex.n) + '</b><small class="tr-edsum">' + esc(planLine(pe)) + '</small></span><span class="tr-chev">' + icon(open ? "up" : "down", 12) + "</span></button>" +
        '<button type="button" class="tr-ib" data-a="edRm" data-id="' + pe.id + '" aria-label="' + esc(ex.n) + ' entfernen">' + icon("trash", 12) + "</button></div>" + body + "</div>";
    }
    function editorHtml() {
      const E = ui.E, d = E.draft;
      const sw = COLORS.map((c, i) => '<button type="button" class="tr-sw" data-a="edColor" data-c="' + i + '" style="--sw:' + c + '" aria-label="Farbe ' + (i + 1) + '" aria-pressed="' + (d.c === i) + '">' + (d.c === i ? icon("check", 12) : "") + "</button>").join("");
      return '<div class="tr-aw tr-ed" style="--dc:' + COLORS[d.c] + '"><header class="tr-ah"><button type="button" class="tr-ib" data-a="edBack" aria-label="Zurück">' + icon("left", 16) + '</button><div class="tr-at"><b>' + (E.isNew ? "NEUER TAG" : "TAG BEARBEITEN") + "</b><small>" + nSatz(planSets(d)) + " · ~" + estMin(d, D.settings.restSec) + ' MIN</small></div><button type="button" class="tr-btn tr-sm tr-go" data-a="edSave">' + icon("save", 10) + " SPEICHERN</button></header>" +
        '<div class="tr-abody"><label class="tr-fl"><span>NAME</span><input type="text" class="tr-in" maxlength="40" value="' + esc(d.n) + '" data-in="edn" autocomplete="off"></label>' +
        '<label class="tr-fl"><span>FOKUS</span><input type="text" class="tr-in" maxlength="80" value="' + esc(d.f) + '" data-in="edf" placeholder="z. B. Brust, Schultern, Trizeps" autocomplete="off"></label>' +
        '<div class="tr-fl"><span>FARBE</span><div class="tr-sws">' + sw + "</div></div>" +
        '<div class="tr-edh"><span>ÜBUNGEN</span><b class="tr-mono">' + d.ex.length + "</b></div>" +
        (d.ex.length ? '<div class="tr-edl" id="trEdL">' + d.ex.map(edItem).join("") + "</div>" : '<div class="tr-empty tr-empty-s"><p>Noch keine Übung in diesem Tag.</p></div>') +
        '<button type="button" class="tr-btn tr-wide" data-a="edAdd">' + icon("plus", 12) + " ÜBUNG HINZUFÜGEN</button>" +
        (E.isNew ? "" : '<div class="tr-edfoot"><button type="button" class="tr-btn tr-sm" data-a="edL">' + icon("left", 10) + ' TAG NACH VORN</button><button type="button" class="tr-btn tr-sm" data-a="edR">TAG NACH HINTEN ' + icon("right", 10) + '</button><button type="button" class="tr-btn tr-sm tr-bad" data-a="edDel">' + icon("trash", 10) + " TAG LÖSCHEN</button></div>") +
        "</div></div>";
    }
    INP.edn = (el) => { ui.E.draft.n = el.value; ui.E.dirty = true; };
    INP.edf = (el) => { ui.E.draft.f = el.value; ui.E.dirty = true; };
    INP.edpn = (el) => { const pe = edEx(el.dataset.id); if (pe) { pe.note = el.value.slice(0, 200); ui.E.dirty = true; } };
    ACT.edColor = (el) => { ui.E.draft.c = +el.dataset.c; ui.E.dirty = true; renderApp(); };
    ACT.edOpen = (el) => { ui.E.open = ui.E.open === el.dataset.id ? null : el.dataset.id; renderApp(); };
    ACT.edUni = (el) => {
      const E = ui.E, pe = edEx(el.dataset.id);
      const on = !E.uni[pe.id];
      E.uni[pe.id] = on;
      if (on) { const f = pe.s[0]; pe.s = pe.s.map(() => f.slice()); E.dirty = true; }
      renderApp();
    };
    ACT.edAddSet = (el) => { const pe = edEx(el.dataset.id); pe.s.push(pe.s[pe.s.length - 1].slice()); ui.E.dirty = true; renderApp(); };
    ACT.edDelSet = (el) => { const pe = edEx(el.dataset.id); if (pe.s.length > 1) pe.s.pop(); ui.E.dirty = true; renderApp(); };
    ACT.edRm = (el) => { ui.E.draft.ex = ui.E.draft.ex.filter((p) => p.id !== el.dataset.id); ui.E.dirty = true; renderApp(); };
    function edMove(from, to) {
      const a = ui.E.draft.ex;
      if (to < 0 || to >= a.length || from === to) return;
      const [m] = a.splice(from, 1);
      a.splice(to, 0, m);
      ui.E.dirty = true;
      renderApp();
    }
    ACT.edAdd = () => openPicker({ ctx: "editor", mode: "add", exclude: ui.E.draft.ex.map((p) => p.x) });
    ACT.edSave = () => {
      const E = ui.E, d = E.draft;
      d.n = (d.n || "").trim() || "Tag";
      d.f = (d.f || "").trim();
      d.u = Date.now();
      const P = ensurePlan();
      const i = P.days.findIndex((x) => x.id === d.id);
      if (i >= 0) P.days[i] = d; else P.days.push(d);
      P.u = Date.now();
      changed();
      E.dirty = false;
      closeScreen();
      toast("TAG GESPEICHERT");
    };
    ACT.edBack = () => {
      if (ui.E && ui.E.dirty) openSheet({ type: "confirm", title: "ÄNDERUNGEN VERWERFEN?", text: "Du hast diesen Tag geändert, aber noch nicht gespeichert.", yes: "VERWERFEN", no: "WEITER BEARBEITEN", act: "edDiscard" });
      else closeScreen();
    };
    CONFIRM.edDiscard = () => { closeSheetSilently(); if (ui.E) ui.E.dirty = false; closeScreen(); };
    ACT.edDel = () => openSheet({ type: "confirm", title: "TAG LÖSCHEN?", text: "„" + ui.E.draft.n + "“ wird aus deinem Plan entfernt. Deine bisherigen Einheiten bleiben im Verlauf.", yes: "LÖSCHEN", no: "ABBRECHEN", act: "edDelYes" });
    CONFIRM.edDelYes = () => {
      const id = ui.E.draft.id, P = planOf(D);
      if (P) { P.days = P.days.filter((d) => d.id !== id); P.u = Date.now(); }
      changed();
      closeSheetSilently();
      ui.E.dirty = false;
      closeScreen();
      toast("TAG GELÖSCHT");
    };
    function moveDay(dir) {
      const P = planOf(D), days = P ? P.days : [], i = days.findIndex((d) => d.id === ui.E.draft.id), j = i + dir;
      if (i < 0 || j < 0 || j >= days.length) { toast(dir < 0 ? "SCHON GANZ VORN" : "SCHON GANZ HINTEN"); return; }
      const t = days[i]; days[i] = days[j]; days[j] = t;
      P.u = Date.now();
      changed();
      toast("TAG VERSCHOBEN · PLATZ " + (j + 1));
    }
    ACT.edL = () => moveDay(-1);
    ACT.edR = () => moveDay(1);

    /* ---------- Uebungswahl ---------- */
    const EQ_S = { F: "FREI", M: "MASCH.", K: "KABEL", E: "KÖRPER" };
    function openPicker(o) { openSheet({ type: "picker", ctx: o.ctx, mode: o.mode, at: o.at, exclude: o.exclude || [], sel: [], q: "", g: "", e: "", cform: false, cn: "", cg: "Brust", ce: "F", delx: "" }); }
    function pickerRows(sh) {
      const all = [];
      GROUPS.forEach((g) => {
        EXS.forEach((x) => { if (x.g === g) all.push(x); });
        D.custom.forEach((c) => { if (c.g === g) all.push({ id: c.id, n: c.n, g: c.g, e: c.e, custom: true }); });
      });
      const q = sh.q.trim().toLowerCase();
      const rows = all.filter((x) => (!sh.g || x.g === sh.g) && (!sh.e || x.e === sh.e) && (!q || x.n.toLowerCase().indexOf(q) >= 0));
      if (q) rows.sort((a, b) => (a.n.toLowerCase().indexOf(q) === 0 ? 0 : 1) - (b.n.toLowerCase().indexOf(q) === 0 ? 0 : 1) || a.n.localeCompare(b.n, "de"));
      return { rows, q };
    }
    function pickerList(sh) {
      const { rows, q } = pickerRows(sh);
      if (!rows.length) return '<p class="tr-mute tr-pad">Keine Übung gefunden. Mit „EIGENE ÜBUNG“ legst du sie selbst an.</p>';
      let out = "", cur = "";
      rows.forEach((x) => {
        if (!q && x.g !== cur) { cur = x.g; out += '<h4 class="tr-pg">' + grpIco(x.g, 16) + esc(x.g.toUpperCase()) + "</h4>"; }
        const used = sh.exclude.indexOf(x.id) >= 0, sel = sh.sel.indexOf(x.id) >= 0;
        out += '<div class="tr-prow-w"><button type="button" class="tr-prow' + (sel ? " sel" : "") + (used ? " used" : "") + '" data-a="ppick" data-x="' + esc(x.id) + '" style="--gc:' + GCOL[x.g] + '"' + (used ? " disabled" : "") + '><i class="tr-pbox">' + (sel ? icon("check", 12) : "") + "</i>" + exIco(x, 26) + '<span class="tr-pn"><b>' + esc(x.n) + "</b><small>" + (q ? esc(x.g.toUpperCase()) + " · " : "") + (used ? "SCHON DABEI" : x.custom ? "EIGENE ÜBUNG" : esc(EQ[x.e].n)) + '</small></span><span class="tr-eq" style="--ec:' + EQ[x.e].c + '">' + EQ_S[x.e] + "</span></button>" +
          (x.custom ? '<button type="button" class="tr-ib tr-prow-x" data-a="pdel" data-x="' + esc(x.id) + '" aria-label="' + esc(x.n) + ' löschen">' + (sh.delx === x.id ? "?" : icon("trash", 12)) + "</button>" : "") + "</div>";
      });
      return out;
    }
    SHEETS.picker = (sh) => {
      const chipsG = '<button type="button" class="tr-chip" data-a="pg" data-v="" aria-pressed="' + !sh.g + '">ALLE</button>' + GROUPS.map((g) => '<button type="button" class="tr-chip" style="--cc:' + GCOL[g] + '" data-a="pg" data-v="' + esc(g) + '" aria-pressed="' + (sh.g === g) + '">' + grpIco(g, 14) + esc(g.toUpperCase()) + "</button>").join("");
      const chipsE = Object.keys(EQ).map((k) => '<button type="button" class="tr-chip" style="--cc:' + EQ[k].c + '" data-a="pe" data-v="' + k + '" aria-pressed="' + (sh.e === k) + '">' + eqIco(k, 14) + EQ[k].n + "</button>").join("");
      const form = sh.cform
        ? '<div class="tr-cform"><label class="tr-fl"><span>NAME DER ÜBUNG</span><input type="text" class="tr-in" maxlength="60" value="' + esc(sh.cn) + '" data-in="pcn" data-focus autocomplete="off"></label>' +
          '<label class="tr-fl"><span>MUSKELGRUPPE</span><select class="tr-in" data-in="pcg">' + GROUPS.map((g) => '<option value="' + esc(g) + '"' + (sh.cg === g ? " selected" : "") + ">" + esc(g) + "</option>").join("") + "</select></label>" +
          '<label class="tr-fl"><span>GERÄT</span><select class="tr-in" data-in="pce">' + Object.keys(EQ).map((k) => '<option value="' + k + '"' + (sh.ce === k ? " selected" : "") + ">" + EQ[k].n + "</option>").join("") + "</select></label>" +
          '<div class="tr-sh-a"><button type="button" class="tr-btn" data-a="pcno">ABBRECHEN</button><button type="button" class="tr-btn tr-go" data-a="pcsave">ANLEGEN</button></div></div>'
        : "";
      return shHead(sh.mode === "replace" ? "ÜBUNG ERSETZEN" : "ÜBUNG WÄHLEN") +
        (sh.cform ? form : '<input type="search" class="tr-in tr-search" placeholder="Übung suchen …" value="' + esc(sh.q) + '" data-in="pq" aria-label="Übung suchen" autocomplete="off" data-focus><div class="tr-chips tr-chips-s">' + chipsG + '</div><div class="tr-chips tr-chips-s">' + chipsE + "</div>") +
        (sh.cform ? "" : '<div class="tr-plist" id="trPList">' + pickerList(sh) + "</div>") +
        (sh.cform ? "" : '<div class="tr-sh-a tr-sh-a2"><button type="button" class="tr-btn" data-a="pcustom">' + icon("plus", 12) + " EIGENE ÜBUNG</button>" + (sh.mode === "replace" ? "" : '<button type="button" class="tr-btn tr-go" data-a="pdone" data-pdone' + (sh.sel.length ? "" : " disabled") + ">FERTIG" + (sh.sel.length ? " (" + sh.sel.length + ")" : "") + "</button>") + "</div>");
    };
    const refreshPickerList = () => { const l = sheetOv.querySelector("#trPList"); if (l && ui.sheet && ui.sheet.type === "picker") l.innerHTML = pickerList(ui.sheet); };
    function refreshPickerFoot() {
      const b = sheetOv.querySelector("[data-pdone]"), sh = ui.sheet;
      if (!b || !sh) return;
      b.disabled = !sh.sel.length;
      b.textContent = "FERTIG" + (sh.sel.length ? " (" + sh.sel.length + ")" : "");
    }
    INP.pq = (el) => { ui.sheet.q = el.value; refreshPickerList(); };
    ACT.pg = (el) => { ui.sheet.g = el.dataset.v; renderSheet(); const l = sheetOv.querySelector(".tr-search"); if (l) l.value = ui.sheet.q; };
    ACT.pe = (el) => { ui.sheet.e = ui.sheet.e === el.dataset.v ? "" : el.dataset.v; renderSheet(); };
    ACT.ppick = (el) => {
      const sh = ui.sheet, x = el.dataset.x;
      if (sh.mode === "replace") { applyPicked([x], sh); return; }
      const i = sh.sel.indexOf(x);
      if (i >= 0) sh.sel.splice(i, 1); else sh.sel.push(x);
      el.classList.toggle("sel", i < 0);
      const box = el.querySelector(".tr-pbox");
      if (box) box.innerHTML = i < 0 ? icon("check", 12) : "";
      refreshPickerFoot();
    };
    ACT.pdone = () => applyPicked(ui.sheet.sel.slice(), ui.sheet);
    function applyPicked(ids, sh) {
      closeSheet();
      if (!ids.length) return;
      const I = idx(), L = look();
      if (sh.ctx === "workout") {
        if (!W) return;
        if (sh.mode === "replace") {
          const e = W.ex[sh.at];
          if (!e) return;
          e.x = ids[0]; e.sets = prefillSets(I, L(ids[0]), null); e.open = true; e.note = "";
          W.rest = null;
          queueDraft(); renderApp(); refreshProgress(); renderMini();
        } else {
          addExercises(ids);
          renderApp(); refreshProgress(); renderMini();
          const c = app.querySelector('.tr-ex[data-ei="' + (W.ex.length - 1) + '"]');
          if (c && c.scrollIntoView) c.scrollIntoView({ block: "nearest" });
        }
      } else if (ui.E) {
        ids.forEach((x) => {
          const pe = { id: uid(), x, s: defaultPlanSets(L(x)), note: "" };
          ui.E.draft.ex.push(pe);
          ui.E.uni[pe.id] = pe.s.every((s) => s[0] === pe.s[0][0] && s[1] === pe.s[0][1]);
        });
        ui.E.dirty = true;
        renderApp();
      }
    }
    /* eigene Uebung */
    ACT.pcustom = () => { const sh = ui.sheet; sh.cform = true; sh.cn = sh.q || ""; sh.cg = sh.g || "Brust"; sh.ce = sh.e || "F"; renderSheet(); };
    ACT.pcno = () => { ui.sheet.cform = false; renderSheet(); };
    INP.pcn = (el) => { ui.sheet.cn = el.value; };
    CHG.pcg = (el) => { ui.sheet.cg = el.value; };
    CHG.pce = (el) => { ui.sheet.ce = el.value; };
    ACT.pcsave = () => {
      const sh = ui.sheet, name = sh.cn.trim();
      if (!name) { toast("BITTE EINEN NAMEN EINGEBEN"); return; }
      const low = name.toLowerCase();
      if (EXS.some((x) => x.n.toLowerCase() === low) || D.custom.some((c) => c.n.toLowerCase() === low)) { toast("DIESE ÜBUNG GIBT ES SCHON"); return; }
      const c = { id: "c_" + uid(), n: name, g: sh.cg, e: sh.ce, u: Date.now() };
      D.custom.push(c);
      changed();
      if (sh.mode === "replace") { applyPicked([c.id], sh); return; }
      sh.sel.push(c.id); sh.cform = false; sh.q = ""; sh.g = sh.cg; sh.e = "";
      renderSheet();
      toast("ÜBUNG ANGELEGT");
    };
    ACT.pdel = (el) => {
      const sh = ui.sheet, x = el.dataset.x;
      if (sh.delx !== x) { sh.delx = x; refreshPickerList(); toast("NOCHMAL TIPPEN ZUM LÖSCHEN"); return; }
      const now = Date.now();
      D.custom = D.custom.filter((c) => c.id !== x);
      D.del[x] = now;
      D.plans.forEach((P) => P.days.forEach((d) => { const n = d.ex.length; d.ex = d.ex.filter((pe) => pe.x !== x); if (d.ex.length !== n) P.u = now; }));
      sh.sel = sh.sel.filter((s) => s !== x);
      sh.delx = "";
      changed();
      refreshPickerList(); refreshPickerFoot(); renderMain();
      toast("EIGENE ÜBUNG GELÖSCHT");
    };

    /* ---------- Vorlagen ---------- */
    SHEETS.tpl = () => shHead("VORLAGEN") +
      '<p class="tr-sh-p">Fertige Pläne zum Start. Die Gewichte trägst du beim ersten Training ein, danach merkt sich der Tracker deine letzten Werte.</p><div class="tr-tpls">' +
      TEMPLATES.map((t) => '<div class="tr-card tr-tpl"><h4>' + esc(t.name) + "</h4><p>" + esc(t.info) + "</p><ul>" +
        t.days.map((d) => '<li style="--dc:' + COLORS[d.c] + '"><b>' + esc(d.n) + '</b><span class="tr-ic4">' + d.ex.slice(0, 5).map((r) => { const ex = EXS.find((e) => e.n === r[0]); return ex ? exIco(ex, 16) : ""; }).join("") + "</span><small>" + nUeb(d.ex.length) + "</small></li>").join("") +
        '</ul><button type="button" class="tr-btn tr-go tr-sm" data-a="tplUse" data-id="' + t.id + '">ÜBERNEHMEN</button></div>').join("") + "</div>";
    /* Eine Vorlage wird ein eigener Plan (und gleich der aktive); ist der aktive Plan noch leer, wird er stattdessen gefuellt */
    ACT.tplUse = (el) => applyTemplate(el.dataset.id);
    function applyTemplate(id) {
      const t = TEMPLATES.find((x) => x.id === id);
      if (!t) return;
      const now = Date.now();
      const days = t.days.map((d) => ({
        id: uid(), n: d.n, f: d.f, c: d.c, u: now,
        ex: d.ex.map((r) => { const ex = EXS.find((e) => e.n === r[0]); return ex ? { id: uid(), x: ex.id, s: Array.from({ length: r[1] }, () => [0, r[2]]), note: "" } : null; }).filter(Boolean)
      }));
      let P = planOf(D);
      if (P && !P.days.length) { P.n = t.name.slice(0, 40); P.days = days; P.u = now; }
      else { P = { id: uid(), n: t.name.slice(0, 40), days, u: now }; D.plans.push(P); }
      D.settings.plan = P.id; D.settings.u = now;
      changed();
      closeSheet();
      renderMain();
      toast("PLAN „" + P.n.toUpperCase() + "“ ÜBERNOMMEN");
    }

    /* ---------- Plaene (Plan-Wechsler) ---------- */
    function ensurePlan() {
      let P = planOf(D);
      if (!P) { P = { id: uid(), n: "Mein Plan", days: [], u: Date.now() }; D.plans.push(P); D.settings.plan = P.id; D.settings.u = Date.now(); }
      return P;
    }
    ACT.plans = () => openSheet({ type: "plans" });
    SHEETS.plans = () => {
      const act = planOf(D);
      return shHead("PLÄNE") + '<p class="tr-sh-p">Der markierte Plan ist aktiv: Start, „Als nächstes“ und Verlauf-Vorschläge beziehen sich auf ihn.</p><div class="tr-pls">' +
        (D.plans.length ? D.plans.map((p) => {
          const on = act && act.id === p.id;
          return '<div class="tr-plr"><button type="button" class="tr-pl' + (on ? " on" : "") + '" data-a="plsel" data-id="' + p.id + '" aria-pressed="' + !!on + '"><i></i><span><b>' + esc(p.n) + "</b><small>" + nTag(p.days.length) + " · " + nUeb(p.days.reduce((n, d) => n + d.ex.length, 0)) + '</small></span></button><button type="button" class="tr-ib" data-a="pledit" data-id="' + p.id + '" aria-label="' + esc(p.n) + ' bearbeiten">' + icon("pencil", 12) + "</button></div>";
        }).join("") : '<p class="tr-mute">Noch kein Plan. Lege einen an oder nimm eine Vorlage.</p>') +
        '</div><div class="tr-sh-a tr-sh-a2"><button type="button" class="tr-btn" data-a="tpl">VORLAGEN</button><button type="button" class="tr-btn tr-go" data-a="plnew">' + icon("plus", 12) + " NEUER PLAN</button></div>";
    };
    ACT.plsel = (el) => {
      D.settings.plan = el.dataset.id; D.settings.u = Date.now();
      changed(); closeSheet(); renderMain();
      const P = planOf(D);
      toast("PLAN „" + (P ? P.n.toUpperCase() : "") + "“ AKTIV");
    };
    ACT.plnew = () => openSheet({ type: "planedit", id: "", name: "Plan " + (D.plans.length + 1) });
    ACT.pledit = (el) => { const p = D.plans.find((x) => x.id === el.dataset.id); if (p) openSheet({ type: "planedit", id: p.id, name: p.n }); };
    SHEETS.planedit = (sh) => shHead(sh.id ? "PLAN BEARBEITEN" : "NEUER PLAN") +
      '<label class="tr-fl"><span>NAME</span><input type="text" class="tr-in" maxlength="40" value="' + esc(sh.name) + '" data-in="pln" data-focus autocomplete="off"></label>' +
      '<div class="tr-sh-a">' + (sh.id ? '<button type="button" class="tr-btn tr-sm tr-bad" data-a="pldel">' + icon("trash", 10) + ' LÖSCHEN</button><button type="button" class="tr-btn tr-sm" data-a="pldup">DUPLIZIEREN</button>' : "") + '<button type="button" class="tr-btn tr-go" data-a="plsave">SPEICHERN</button></div>';
    INP.pln = (el) => { ui.sheet.name = el.value; };
    ACT.plsave = () => {
      const sh = ui.sheet, name = (sh.name || "").trim().slice(0, 40) || "Plan", now = Date.now();
      if (sh.id) { const p = D.plans.find((x) => x.id === sh.id); if (p) { p.n = name; p.u = now; } }
      else { const p = { id: uid(), n: name, days: [], u: now }; D.plans.push(p); D.settings.plan = p.id; D.settings.u = now; }
      changed(); closeSheet(); renderMain();
      toast(sh.id ? "PLAN GESPEICHERT" : "PLAN ANGELEGT");
    };
    ACT.pldup = () => {
      const sh = ui.sheet, src = D.plans.find((x) => x.id === sh.id);
      if (!src) return;
      const now = Date.now(), cp = JSON.parse(JSON.stringify(src));
      cp.id = uid(); cp.n = (src.n + " (Kopie)").slice(0, 40); cp.u = now;
      cp.days.forEach((d) => { d.id = uid(); d.u = now; d.ex.forEach((pe) => { pe.id = uid(); }); });
      D.plans.push(cp); D.settings.plan = cp.id; D.settings.u = now;
      changed(); closeSheet(); renderMain();
      toast("PLAN DUPLIZIERT");
    };
    ACT.pldel = () => {
      const p = D.plans.find((x) => x.id === ui.sheet.id);
      if (p) openSheet({ type: "confirm", title: "PLAN LÖSCHEN?", text: "„" + p.n + "“ mit " + nTag(p.days.length).toLowerCase() + " wird gelöscht. Deine bisherigen Einheiten bleiben im Verlauf.", yes: "LÖSCHEN", no: "ABBRECHEN", act: "plDelYes", arg: p.id });
    };
    CONFIRM.plDelYes = (id) => {
      const now = Date.now();
      D.plans = D.plans.filter((p) => p.id !== id);
      D.del[id] = now;
      if (D.settings.plan === id) { D.settings.plan = D.plans[0] ? D.plans[0].id : ""; D.settings.u = now; }
      changed(); closeSheet(); renderMain();
      toast("PLAN GELÖSCHT");
    };

    /* ---------- Einstellungen ---------- */
    SHEETS.settings = () => {
      const S = D.settings;
      const wd = WK.map((n) => '<button type="button" class="tr-chip tr-chip-wd" data-a="srest" data-d="' + n + '" aria-pressed="' + (D.rest.days.indexOf(n) >= 0) + '">' + WD_S[n].toUpperCase() + "</button>").join("");
      const tg = (a, label, on, sub) => '<button type="button" class="tr-tg" data-a="' + a + '" role="switch" aria-checked="' + on + '"><span>' + label + (sub ? "<small>" + sub + "</small>" : "") + "</span><i></i></button>";
      const st = [1, 2.5, 5].map((v) => '<button type="button" class="tr-chip" data-a="sstep" data-v="' + v + '" aria-pressed="' + (S.step === v) + '">' + fmtN(v) + " KG</button>").join("");
      return shHead("EINSTELLUNGEN") + '<div class="tr-setbody">' +
        "<h4>RUHETAGE</h4><p class=\"tr-sh-p\">An Ruhetagen gibt es kein Rot im Verlauf, und deine Serie reißt nicht ab.</p><div class=\"tr-chips\">" + wd + "</div>" +
        '<h4>PAUSEN-TIMER</h4><div class="tr-resetrow"><button type="button" class="tr-ib tr-ib-l" data-a="srsec" data-d="-15" aria-label="Pause kürzer">' + icon("minus", 12) + '</button><b class="tr-mono">' + (S.restSec ? fmtClock(S.restSec * 1000) : "AUS") + '</b><button type="button" class="tr-ib tr-ib-l" data-a="srsec" data-d="15" aria-label="Pause länger">' + icon("plus", 12) + "</button></div>" +
        '<h4>GEWICHT: SCHRITT MIT +/−</h4><div class="tr-chips">' + st + "</div>" +
        '<div class="tr-tgs">' + tg("sSnd", "TON AM PAUSEN-ENDE", S.snd) + tg("sVib", "VIBRATION AM PAUSEN-ENDE", S.vib, "nur Android") + tg("sAuto", "PLAN NACH DEM TRAINING ANPASSEN", S.auto, "geschaffte Werte werden zum neuen Plan-Wert") + "</div>" +
        '<h4>DATEN</h4><p class="tr-sh-p">' + D.sessions.length + (D.sessions.length === 1 ? " Einheit" : " Einheiten") + " · " + D.plans.length + (D.plans.length === 1 ? " Plan" : " Pläne") + " · liegt in der Cloud (training-data.json) und als Sicherheitskopie auf diesem Gerät.</p>" +
        '<button type="button" class="tr-btn tr-wide" data-a="export">' + icon("save", 12) + " EXPORT (JSON)</button></div>";
    };
    const setTouch = () => { D.settings.u = Date.now(); changed(); renderSheet(); };
    ACT.srest = (el) => {
      const n = +el.dataset.d, a = D.rest.days, i = a.indexOf(n);
      if (i >= 0) a.splice(i, 1); else a.push(n);
      D.rest.u = Date.now();
      changed(); renderSheet(); renderMain();
    };
    ACT.srsec = (el) => { D.settings.restSec = clampN(D.settings.restSec + +el.dataset.d, 0, 600); setTouch(); };
    ACT.sstep = (el) => { D.settings.step = +el.dataset.v; setTouch(); };
    ACT.sSnd = () => { D.settings.snd = !D.settings.snd; if (D.settings.snd) audioUnlock(); setTouch(); };
    ACT.sVib = () => { D.settings.vib = !D.settings.vib; if (D.settings.vib && navigator.vibrate) { try { navigator.vibrate(60); } catch (e) { /* egal */ } } setTouch(); };
    ACT.sAuto = () => { D.settings.auto = !D.settings.auto; setTouch(); };
    ACT.export = () => {
      const json = JSON.stringify(Object.assign({ exportedAt: new Date().toISOString() }, D), null, 2);
      try {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([json], { type: "application/json" }));
        a.download = "training-" + today() + ".json";
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
        toast("EXPORT GESTARTET");
      } catch (e) { toast("EXPORT NICHT MÖGLICH"); }
    };

    /* ======================================================================
       Verlauf und Statistiken: Wochenleiste, Uebersicht, Kacheln (Einzelheiten oeffnen sich im Fenster)
       ====================================================================== */
    const PERIODS = [["week", "WOCHE"], ["month", "MONAT"], ["year", "JAHR"], ["all", "GESAMT"]];
    const periodChips = () => '<div class="tr-chips tr-per" role="group" aria-label="Zeitraum">' + PERIODS.map((p) => '<button type="button" class="tr-chip" data-a="hper" data-v="' + p[0] + '" aria-pressed="' + (ui.hp === p[0]) + '">' + p[1] + "</button>").join("") + "</div>";
    const refreshHist = () => { renderMain(); if (ui.sheet && ui.sheet.type === "tile") renderSheet(); };
    const satz = (n) => fmtInt(n) + (n === 1 ? " Satz" : " Sätze");
    const ago = (d, t) => { const n = diffD(t, d); return n <= 0 ? "heute" : n === 1 ? "gestern" : n < 14 ? "vor " + n + " Tagen" : n < 60 ? "vor " + Math.round(n / 7) + " Wochen" : "vor " + Math.round(n / 30) + " Monaten"; };
    const PLUR = { Schultern: 1, Arme: 1, Beine: 1 };
    const missText = (miss) => (miss.length === 1 ? miss[0] + (PLUR[miss[0]] ? " fehlen" : " fehlt") + " ganz" : miss.length === 2 ? miss[0] + " und " + miss[1] + " fehlen ganz" : miss[0] + " und " + (miss.length - 1) + " weitere fehlen ganz");
    const heatLv = (n) => (n === 0 ? 0 : n <= 9 ? 1 : n <= 18 ? 2 : n <= 27 ? 3 : 4);

    function histHtml() {
      const I = idx(), L = look(), t = today();
      if (!I.sess.length) {
        return '<div class="tr-card tr-emptycard">' + sprite("medal", 56) + "<h3>NOCH KEIN VERLAUF</h3><p>Sobald du dein erstes Training beendest, siehst du hier Wochenleiste, Rekorde, Muskelverteilung und deine Kraft-Entwicklung.</p>" +
          '<div class="tr-row"><button type="button" class="tr-btn" data-a="tab" data-v="train">' + icon("right", 12) + " ZUM PLAN</button></div></div>";
      }
      if (!ui.hm) ui.hm = { y: pdk(t).getFullYear(), m: pdk(t).getMonth() };
      return weekCard(I, t) + statsCard(I, L, t) +
        '<div class="tr-divh"><span>FORTSCHRITT</span></div>' +
        '<div class="tr-tiles">' + tileDist(I, L, t) + tileRec(I, L, t) + tileStr(I, L) + tileCal(I, t) + tileHeat(I, t) + tileWk(I, t) + tileSess(I, L) + "</div>" +
        '<div class="tr-quick"><button type="button" class="tr-btn tr-sm" data-a="export">' + icon("save", 12) + " EXPORT (JSON)</button></div>";
    }

    /* ---------- Wochenleiste: gruen = trainiert, rot = verpasst, Mond = Ruhetag ---------- */
    function dayIcon(st) { return st === "done" ? icon("check", 12) : st === "missed" ? icon("x", 12) : st === "rest" ? icon("moon", 12) : ""; }
    function weekCard(I, t) {
      const mon = mondayOf(t), rest = D.rest.days;
      let n = 0;
      const cells = WK.map((wd, i) => {
        const d = addD(mon, i), st = dayState(d, t, I, rest), ses = I.byDate[d];
        if (ses) n += ses.length;
        return '<button type="button" class="tr-wd ' + st + (d === t ? " now" : "") + '" data-a="day" data-d="' + d + '" aria-label="' + fmtDay(d) + ", " + ({ done: "trainiert", missed: "verpasst", rest: "Ruhetag", today: "heute", future: "kommt noch", none: "kein Training" }[st]) + '"><span>' + WD_S[wd].toUpperCase() + "</span><b>" + pdk(d).getDate() + "</b><i>" + dayIcon(st) + "</i>" + (ses ? '<em style="background:' + COLORS[ses[0].c] + '"></em>' : "") + "</button>";
      }).join("");
      return '<div class="tr-card"><div class="tr-ch"><h3>DIESE WOCHE</h3><span class="tr-px">' + n + (n === 1 ? " EINHEIT" : " EINHEITEN") + '</span></div><div class="tr-week">' + cells + '</div><p class="tr-legend"><span class="g"><i></i>TRAINIERT</span><span class="r"><i></i>VERPASST</span><span class="m"><i></i>RUHETAG</span></p></div>';
    }
    function statsCard(I, L, t) {
      const r = rangeOf(ui.hp, t, I), s = periodStats(I, L, r[0], r[1]), st = streakOf(I, D.rest.days, t);
      return '<div class="tr-card"><div class="tr-ch"><h3>ÜBERSICHT</h3>' + periodChips() + '</div><div class="tr-stats3"><div class="tr-stat"><small>' + sprite("dumbbell", 14) + ' EINHEITEN</small><b class="tr-mono">' + s.n + '</b></div><div class="tr-stat"><small>' + sprite("hourglass", 14) + ' STUNDEN</small><b class="tr-mono">' + fmtHours(s.ms) + '</b></div><div class="tr-stat tr-streak"><small>' + sprite("flame", 14) + ' SERIE</small><b class="tr-mono">' + st + "</b></div></div>" +
        '<p class="tr-sub">' + nSatz(s.sets) + " · " + fmtInt(s.vol) + " KG VOLUMEN</p></div>";
    }

    /* ---------- Kacheln ---------- */
    const tile = (t, label, inner, cls) => '<button type="button" class="tr-card tr-tile' + (cls ? " " + cls : "") + '" data-a="tile" data-t="' + t + '"><span class="tr-tl">' + label + "</span>" + inner + "</button>";
    function tileDist(I, L, t) {
      const r = rangeOf(ui.hp, t, I), o = setsByGroup(I, L, r[0], r[1]);
      const gs = GROUPS.filter((g) => g !== "Ausdauer"), tot = gs.reduce((n, g) => n + o[g], 0);
      if (!tot) return tile("dist", "MUSKELVERTEILUNG", '<p class="tr-tm">Noch keine Sätze in diesem Zeitraum.</p>');
      const top4 = gs.filter((g) => o[g] > 0).sort((a, b) => o[b] - o[a]).slice(0, 4);
      const rows = top4.map((g) => {
        const p = Math.round((100 * o[g]) / tot);
        return '<div class="tr-mr" style="--gc:' + GCOL[g] + '"><span>' + esc(g) + '</span><i><b style="width:' + Math.max(8, Math.round((100 * o[g]) / o[top4[0]])) + '%"></b></i><em>' + p + "%</em></div>";
      }).join("");
      const miss = gs.filter((g) => o[g] === 0);
      return tile("dist", "MUSKELVERTEILUNG", '<div class="tr-mrs">' + rows + "</div>" + (miss.length ? '<p class="tr-warn">' + esc(missText(miss)) + "</p>" : ""));
    }
    function tileRec(I, L, t) {
      const recs = recordsOf(I, L).sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : cmpSet(b.best, a.best)));
      if (!recs.length) return tile("rec", "REKORDE", '<p class="tr-tm">Noch keine Rekorde.</p>');
      const r = recs[0], big = r.best[0] > 0 ? fmtN(r.best[0]) + " KG × " + fmtN(r.best[1]) : fmtN(r.best[1]) + (TIMED[r.ex.id] ? " SEK" : " WDH");
      return tile("rec", "REKORDE", '<div class="tr-big tr-mono">' + big + '</div><p class="tr-tn">' + exIco(r.ex, 18) + "<span>" + esc(r.ex.n) + '</span></p><p class="tr-ts">' + ago(r.d, t) + '</p><p class="tr-ts">' + recs.length + (recs.length === 1 ? " Rekord" : " Rekorde") + " insgesamt</p>");
    }
    /* Uebung fuer "Kraft pro Uebung": die gewaehlte, sonst die am haeufigsten trainierte */
    function strPick(I, L) {
      const exs = Object.keys(I.byEx).map((x) => L(x)).filter((e) => !isCardio(e)).sort((a, b) => I.byEx[b.id].length - I.byEx[a.id].length || a.n.localeCompare(b.n, "de"));
      if (!exs.length) return null;
      return { exs, ex: exs.find((e) => e.id === ui.hx) || exs[0] };
    }
    const r1 = (v) => fmtN(Math.round(v * 10) / 10);
    function sparkHtml(vals) {
      const n = vals.length;
      if (!n) return "";
      let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      if (hi === lo) { hi += 1; lo -= 1; }
      const px = (i) => 3 + (i * 94) / Math.max(1, n - 1), py = (v) => 88 - (76 * (v - lo)) / (hi - lo);
      const pts = n === 1 ? "3,50 97,50" : vals.map((v, i) => px(i).toFixed(1) + "," + py(v).toFixed(1)).join(" ");
      const lx = n === 1 ? 97 : px(n - 1), ly = n === 1 ? 50 : py(vals[n - 1]);
      return '<div class="tr-sparkw"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '"/></svg><i style="left:' + lx.toFixed(1) + "%;top:" + ly.toFixed(1) + '%"></i></div>';
    }
    function tileStr(I, L) {
      const pk = strPick(I, L);
      if (!pk) return tile("str", "KRAFT PRO ÜBUNG", '<p class="tr-tm">Noch keine Kraft-Übung im Verlauf.</p>', "wide");
      const ser = exSeries(I, pk.ex.id), hasKg = ser.some((s) => s.kg > 0), last = ser[ser.length - 1];
      const vals = ser.map((s) => (hasKg ? s.e1 || s.kg : s.r));
      const cap = hasKg ? "<b class=\"tr-mono\">" + r1(last.e1 || last.kg) + " kg</b> geschätztes Maximum" : "<b class=\"tr-mono\">" + fmtN(last.r) + (TIMED[pk.ex.id] ? " Sek." : " Wdh.") + "</b> in der letzten Einheit";
      const gain = hasKg && ser.length > 1 ? (last.e1 || last.kg) - (ser[0].e1 || ser[0].kg) : 0;
      return tile("str", "KRAFT PRO ÜBUNG", '<p class="tr-tn">' + exIco(pk.ex, 18) + "<span>" + esc(pk.ex.n) + "</span></p>" + sparkHtml(vals) + '<p class="tr-ts">' + cap + (gain ? " · " + (gain > 0 ? "+" : "") + r1(gain) + " kg seit " + fmtShort(ser[0].d) : "") + "</p>", "wide");
    }
    function tileCal(I, t) {
      const d = pdk(t), cells = monthCells(d.getFullYear(), d.getMonth()), rest = D.rest.days;
      const n = cells.filter((c) => c.in && I.byDate[c.d]).length;
      return tile("cal", "KALENDER", '<div class="tr-mc">' + cells.map((c) => '<i class="' + (c.in ? dayState(c.d, t, I, rest) + (c.d === t ? " now" : "") : "out") + '"></i>').join("") + '</div><p class="tr-ts">' + MON_L[d.getMonth()] + " · " + n + (n === 1 ? " Tag" : " Tage") + "</p>");
    }
    function tileHeat(I, t) {
      const start = mondayOf(addD(t, -7 * 25));
      let cells = "", n = 0;
      for (let w = 0; w < 26; w++) {
        for (let k = 0; k < 7; k++) {
          const ds = addD(start, w * 7 + k), ses = I.byDate[ds];
          if (ses) n += ses.length;
          cells += '<i class="l' + (ds > t ? "x" : heatLv(ses ? ses.reduce((a, s) => a + setsOf(s), 0) : 0)) + '"></i>';
        }
      }
      return tile("heat", "JAHRESÜBERSICHT", '<div class="tr-mh2">' + cells + '</div><p class="tr-ts">Letzte 6 Monate · ' + n + (n === 1 ? " Einheit" : " Einheiten") + "</p>");
    }
    function tileWk(I, t) {
      const w = weeklySets(I, t, 8), max = Math.max(1, Math.max.apply(null, w.map((x) => x.sets))), cur = w[w.length - 1];
      return tile("wk", "SÄTZE JE WOCHE", '<div class="tr-mb">' + w.map((x, i) => '<i class="' + (i === w.length - 1 ? "now" : "") + '" style="--p:' + Math.max(4, Math.round((100 * x.sets) / max)) + '"></i>').join("") + '</div><p class="tr-ts">' + satz(cur.sets) + " diese Woche</p>");
    }
    function tileSess(I, L) {
      const se = I.sess[I.sess.length - 1], icons = se.ex.slice(0, 5).map((e) => exIco(L(e.x, e), 18)).join("");
      return tile("sess", "EINHEITEN", '<div class="tr-ic4">' + icons + '</div><p class="tr-tn"><span>' + esc(se.dn || "Training") + '</span></p><p class="tr-ts">' + fmtDay(se.d) + " · " + satz(setsOf(se)) + " · " + fmtDur(durOf(se)) + '</p><p class="tr-ts">' + I.sess.length + (I.sess.length === 1 ? " Einheit" : " Einheiten") + " insgesamt</p>");
    }
    const TILE_TITLES = { dist: "MUSKELVERTEILUNG", rec: "REKORDE", str: "KRAFT PRO ÜBUNG", cal: "KALENDER", heat: "JAHRESÜBERSICHT", wk: "SÄTZE JE WOCHE", sess: "EINHEITEN" };
    ACT.tile = (el) => openSheet({ type: "tile", t: el.dataset.t });
    SHEETS.tile = (sh) => {
      const I = idx(), L = look(), t = today();
      const body = { dist: () => distBody(I, L, t), rec: () => recBody(recordsOf(I, L)), str: () => strBody(I, L), cal: () => monthBody(I, t), heat: () => heatBody(I, t), wk: () => wkBody(I, t), sess: () => sessBody(I) }[sh.t];
      return shHead(TILE_TITLES[sh.t] || "") + '<div class="tr-tb">' + (body ? body() : "") + "</div>";
    };

    /* ---------- Einzelheiten: Kalender ---------- */
    function monthBody(I, t) {
      const m = ui.hm, rest = D.rest.days, cells = monthCells(m.y, m.m);
      return '<div class="tr-mnav"><button type="button" class="tr-ib" data-a="mprev" aria-label="Vorheriger Monat">' + icon("left", 14) + "</button><b>" + MON_L[m.m].toUpperCase() + " " + m.y + '</b><button type="button" class="tr-ib" data-a="mnext" aria-label="Nächster Monat">' + icon("right", 14) + "</button></div>" +
        '<div class="tr-mgrid">' + WK.map((n) => '<div class="tr-mh">' + WD_S[n].toUpperCase() + "</div>").join("") +
        cells.map((c) => { const st = dayState(c.d, t, I, rest); return '<button type="button" class="tr-md ' + st + (c.in ? "" : " out") + (c.d === t ? " now" : "") + '" data-a="day" data-d="' + c.d + '" aria-label="' + fmtDay(c.d) + '"><b>' + pdk(c.d).getDate() + "</b>" + (st === "done" ? '<em style="background:' + COLORS[I.byDate[c.d][0].c] + '"></em>' : "") + "</button>"; }).join("") + "</div>" +
        '<p class="tr-legend"><span class="g"><i></i>TRAINIERT</span><span class="r"><i></i>VERPASST</span><span class="m"><i></i>RUHETAG</span></p>';
    }
    ACT.mprev = () => { const m = ui.hm; m.m--; if (m.m < 0) { m.m = 11; m.y--; } refreshHist(); };
    ACT.mnext = () => { const m = ui.hm; m.m++; if (m.m > 11) { m.m = 0; m.y++; } refreshHist(); };
    ACT.day = (el) => {
      const d = el.dataset.d, I = idx(), ses = I.byDate[d], t = today();
      if (!ses) {
        const st = dayState(d, t, I, D.rest.days);
        toast(fmtDay(d).toUpperCase() + " · " + ({ rest: "RUHETAG", missed: "NICHT TRAINIERT", today: "NOCH NICHT TRAINIERT", future: "KOMMT NOCH", none: "KEIN TRAINING" }[st] || "KEIN TRAINING"));
        return;
      }
      openSheet(ses.length === 1 ? { type: "sess", id: ses[0].id } : { type: "day", d });
    };

    /* ---------- Einzelheiten: Jahres-Heatmap ---------- */
    function heatBody(I, t) {
      const start = mondayOf(addD(t, -7 * 52));
      let cells = "", months = "", lastM = -1;
      for (let w = 0; w < 53; w++) {
        const mon = addD(start, w * 7), mm = pdk(mon).getMonth();
        if (mm !== lastM && pdk(mon).getDate() <= 7) { months += '<span style="grid-column:' + (w + 1) + '">' + MON_S[mm].toUpperCase() + "</span>"; lastM = mm; }
        for (let k = 0; k < 7; k++) {
          const ds = addD(start, w * 7 + k), ses = I.byDate[ds];
          const n = ses ? ses.reduce((a, s) => a + setsOf(s), 0) : 0;
          cells += '<button type="button" class="tr-hc l' + (ds > t ? "x" : heatLv(n)) + '"' + (ses ? ' data-a="day" data-d="' + ds + '"' : " disabled tabindex=\"-1\"") + ' title="' + fmtDayY(ds) + (n ? " · " + n + " Sätze" : "") + '" aria-label="' + fmtDayY(ds) + (n ? ", " + n + " Sätze" : "") + '"></button>';
        }
      }
      return '<div class="tr-heatw" data-endscroll><div class="tr-heatm">' + months + '</div><div class="tr-heat">' + cells + '</div></div><p class="tr-legend tr-legend-h"><span>WENIGER</span><i class="l0"></i><i class="l1"></i><i class="l2"></i><i class="l3"></i><i class="l4"></i><span>MEHR SÄTZE</span></p>';
    }

    /* ---------- Einzelheiten: Rekorde ---------- */
    function recBody(recs) {
      recs = recs.slice().sort((a, b) => (a.d < b.d ? 1 : a.d > b.d ? -1 : cmpSet(b.best, a.best)));
      const shown = ui.recAll ? recs : recs.slice(0, 10);
      const rows = shown.map((r) => '<div class="tr-rrow">' + exIco(r.ex, 22) + '<span class="tr-rn">' + esc(r.ex.n) + '</span><b class="tr-mono">' + esc(fmtSet(r.ex, r.best)) + "</b><em>" + fmtShort(r.d) + "</em></div>").join("");
      return '<p class="tr-sh-p">Bestes Gewicht je Übung (bei gleichem Gewicht zählen mehr Wiederholungen). Neueste zuerst.</p>' + (rows || '<p class="tr-mute">Noch keine Rekorde.</p>') +
        (recs.length > 10 ? '<button type="button" class="tr-btn tr-sm tr-wide" data-a="recmore">' + (ui.recAll ? "WENIGER ANZEIGEN" : "ALLE " + recs.length + " ANZEIGEN") + "</button>" : "");
    }
    ACT.recmore = () => { ui.recAll = !ui.recAll; refreshHist(); };

    /* ---------- Einzelheiten: Muskelverteilung ---------- */
    function distBody(I, L, t) {
      const r = rangeOf(ui.hp, t, I), o = setsByGroup(I, L, r[0], r[1]);
      const gs = GROUPS.filter((g) => g !== "Ausdauer"), tot = gs.reduce((n, g) => n + o[g], 0);
      if (!tot) return periodChips() + '<p class="tr-mute">In diesem Zeitraum noch keine Sätze.</p>';
      const rows = gs.slice().sort((a, b) => o[b] - o[a]).map((g) =>
        '<div class="tr-dr' + (o[g] ? "" : " zero") + '">' + grpIco(g, 18) + '<span class="tr-dgl">' + esc(g.toUpperCase()) + "</span>" + blocks(o[g] ? Math.max(1, Math.round((20 * o[g]) / tot)) : 0, 20, GCOL[g]) + '<b class="tr-mono">' + Math.round((100 * o[g]) / tot) + " %</b><small>" + o[g] + "</small></div>").join("");
      const miss = gs.filter((g) => o[g] === 0);
      return periodChips() + '<p class="tr-sh-p">Abgehakte Sätze je Hauptmuskelgruppe der Übung.</p><div class="tr-dist">' + rows + "</div>" + (miss.length ? '<p class="tr-warn">' + esc(missText(miss)) + "</p>" : "") + (o.Ausdauer ? '<p class="tr-mute">Ausdauer (' + o.Ausdauer + ' Einträge) zählt hier nicht mit.</p>' : "");
    }
    ACT.hper = (el) => { ui.hp = el.dataset.v; refreshHist(); };

    /* ---------- Einzelheiten: Saetze je Woche ---------- */
    function wkBody(I, t) {
      const w = weeklySets(I, t, 12), max = Math.max(1, Math.max.apply(null, w.map((x) => x.sets)));
      return '<div class="tr-bars" style="--n:12">' + w.map((x, i) => '<div class="tr-bar' + (i === w.length - 1 ? " now" : "") + '"><b class="tr-mono">' + x.sets + '</b><div class="tr-bartrack" title="' + x.n + (x.n === 1 ? " Einheit" : " Einheiten") + '"><i style="--p:' + Math.round((100 * x.sets) / max) + '"></i></div><span>' + fmtShort(x.from) + "</span></div>").join("") + '</div><p class="tr-sub">WOCHENBEGINN · ABGEHAKTE SÄTZE</p>';
    }

    /* ---------- Einzelheiten: Kraft pro Uebung (Liniendiagramm) ---------- */
    function lineChart(ser, vals, metric, ex) {
      const W0 = 320, H0 = 150, pl = 42, pr = 12, pt = 12, pb = 24;
      let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
      if (hi === lo) { hi += 1; lo = Math.max(0, lo - 1); }
      const pad = (hi - lo) * 0.15;
      lo = Math.max(0, lo - pad); hi += pad;
      const x = (i) => pl + (ser.length === 1 ? (W0 - pl - pr) / 2 : (i * (W0 - pl - pr)) / (ser.length - 1));
      const y = (v) => pt + (H0 - pt - pb) * (1 - (v - lo) / (hi - lo));
      const fmtV = (v) => (metric === "vol" ? fmtInt(v) : fmtN(Math.round(v * 10) / 10));
      /* runde Achsenwerte (1, 2, 2,5, 5, 10 ... je nach Spanne) statt krummer Zahlen */
      const rough = (hi - lo) / 3, mag = Math.pow(10, Math.floor(Math.log10(rough)));
      const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= rough) || rough;
      const ticks = [];
      for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100);
      let svg = '<svg class="tr-chart" viewBox="0 0 ' + W0 + " " + H0 + '" role="img" aria-label="Verlauf ' + esc(ex.n) + '" shape-rendering="crispEdges">';
      (ticks.length ? ticks : [hi, lo]).forEach((v) => { svg += '<line class="tr-gl" x1="' + pl + '" x2="' + (W0 - pr) + '" y1="' + y(v).toFixed(1) + '" y2="' + y(v).toFixed(1) + '"/><text class="tr-tx" x="' + (pl - 5) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + fmtV(v) + "</text>"; });
      if (ser.length > 1) svg += '<polyline class="tr-ln" points="' + ser.map((s, i) => x(i).toFixed(1) + "," + y(vals[i]).toFixed(1)).join(" ") + '"/>';
      ser.forEach((s, i) => {
        svg += '<rect class="tr-pt' + (i === ser.length - 1 ? " last" : "") + '" x="' + (x(i) - 3).toFixed(1) + '" y="' + (y(vals[i]) - 3).toFixed(1) + '" width="6" height="6"><title>' + fmtShort(s.d) + " · " + (s.kg > 0 ? fmtN(s.kg) + " kg × " : "") + fmtN(s.r) + (metric === "vol" ? " · Volumen " + fmtInt(s.vol) + " kg" : metric === "e1" ? " · geschätzt " + r1(s.e1) + " kg" : "") + "</title></rect>";
      });
      svg += '<text class="tr-tx" x="' + pl + '" y="' + (H0 - 6) + '" text-anchor="start">' + fmtShort(ser[0].d) + '</text><text class="tr-tx" x="' + (W0 - pr) + '" y="' + (H0 - 6) + '" text-anchor="end">' + fmtShort(ser[ser.length - 1].d) + "</text></svg>";
      return svg;
    }
    function strBody(I, L) {
      const pk = strPick(I, L);
      if (!pk) return '<p class="tr-mute">Noch keine Kraft-Übung im Verlauf.</p>';
      const ex = pk.ex, ser = exSeries(I, ex.id), hasKg = ser.some((s) => s.kg > 0);
      const metric = hasKg ? (ui.hv === "vol" ? "vol" : ui.hv === "kg" ? "kg" : "e1") : "reps";
      const vals = ser.map((s) => (metric === "vol" ? s.vol : metric === "kg" ? s.kg : metric === "e1" ? s.e1 || s.kg : s.r));
      const unit = metric === "e1" ? "GESCHÄTZTES MAXIMUM JE EINHEIT (KG)" : metric === "vol" ? "VOLUMEN (KG × WDH)" : metric === "kg" ? "BESTES GEWICHT JE EINHEIT (KG)" : TIMED[ex.id] ? "BESTE ZEIT JE EINHEIT (SEK)" : "BESTE WIEDERHOLUNGEN JE EINHEIT";
      const rows = ser.slice(-5).reverse().map((s) => '<div class="tr-rrow"><span class="tr-rn">' + fmtDayY(s.d) + "</span><b class=\"tr-mono\">" + (s.kg > 0 ? fmtN(s.kg) + " kg × " : "") + fmtN(s.r) + (TIMED[ex.id] ? " s" : "") + "</b><em>" + nSatz(s.n) + "</em></div>").join("");
      return '<label class="tr-fl"><span>ÜBUNG</span><select class="tr-in" data-in="hx" aria-label="Übung wählen">' + pk.exs.map((e) => '<option value="' + esc(e.id) + '"' + (e.id === ex.id ? " selected" : "") + ">" + esc(e.n) + " (" + I.byEx[e.id].length + "×)</option>").join("") + "</select></label>" +
        (hasKg ? '<div class="tr-chips"><button type="button" class="tr-chip" data-a="hvm" data-v="e1" aria-pressed="' + (metric === "e1") + '">GESCHÄTZTES MAX.</button><button type="button" class="tr-chip" data-a="hvm" data-v="kg" aria-pressed="' + (metric === "kg") + '">GEWICHT</button><button type="button" class="tr-chip" data-a="hvm" data-v="vol" aria-pressed="' + (metric === "vol") + '">VOLUMEN</button></div>' : "") +
        '<p class="tr-sub tr-subx">' + exIco(ex, 16) + " " + unit + "</p>" + lineChart(ser, vals, metric, ex) + '<div class="tr-rrows">' + rows + "</div>";
    }
    CHG.hx = (el) => { ui.hx = el.value; refreshHist(); };
    ACT.hvm = (el) => { ui.hv = el.dataset.v; refreshHist(); };

    /* ---------- Einzelheiten: Einheiten ---------- */
    function sessBody(I) {
      const list = I.sess.slice().reverse(), n = 8 + ui.more, L = look();
      const rows = list.slice(0, n).map((se) => '<button type="button" class="tr-sr" data-a="sess" data-id="' + se.id + '" style="--dc:' + COLORS[se.c] + '"><i></i><span class="tr-srd">' + fmtDay(se.d) + "</span><b>" + esc(se.dn || "Training") + '</b><span class="tr-ic4">' + se.ex.slice(0, 4).map((e) => exIco(L(e.x, e), 16)).join("") + "</span><em>" + nSatz(setsOf(se)) + " · " + fmtDur(durOf(se)) + "</em></button>").join("");
      return '<div class="tr-srl">' + rows + "</div>" + (list.length > n ? '<button type="button" class="tr-btn tr-sm tr-wide" data-a="smore">MEHR ANZEIGEN (' + (list.length - n) + ")</button>" : "");
    }
    ACT.smore = () => { ui.more += 10; refreshHist(); };
    ACT.sess = (el) => openSheet({ type: "sess", id: el.dataset.id, from: ui.sheet && ui.sheet.type === "tile" ? ui.sheet.t : "" });
    SHEETS.day = (sh) => {
      const ses = idx().byDate[sh.d] || [], L = look();
      return shHead(fmtDayY(sh.d)) + '<div class="tr-srl">' + ses.map((se) => '<button type="button" class="tr-sr" data-a="sess" data-id="' + se.id + '" style="--dc:' + COLORS[se.c] + '"><i></i><span class="tr-srd">' + (se.a ? pad2(new Date(se.a).getHours()) + ":" + pad2(new Date(se.a).getMinutes()) : "") + "</span><b>" + esc(se.dn || "Training") + '</b><span class="tr-ic4">' + se.ex.slice(0, 4).map((e) => exIco(L(e.x, e), 16)).join("") + "</span><em>" + nSatz(setsOf(se)) + "</em></button>").join("") + "</div>";
    };
    SHEETS.sess = (sh) => {
      const se = D.sessions.find((s) => s.id === sh.id);
      if (!se) return shHead("EINHEIT") + '<p class="tr-mute">Diese Einheit gibt es nicht mehr.</p>';
      const L = look(), hm = (ms) => pad2(new Date(ms).getHours()) + ":" + pad2(new Date(ms).getMinutes());
      const exs = se.ex.map((e) => {
        const x = L(e.x, e);
        return '<div class="tr-sx" style="--gc:' + GCOL[x.g] + '"><div class="tr-sxh">' + exIco(x, 22) + "<b>" + esc(x.n) + "</b><small>" + esc(x.g.toUpperCase()) + '</small></div><div class="tr-sxs">' +
          e.s.map((s, i) => "<span><em>" + (i + 1) + "</em>" + esc(fmtSet(x, s)) + "</span>").join("") + "</div>" + (e.note ? '<p class="tr-mute">' + esc(e.note) + "</p>" : "") + "</div>";
      }).join("");
      return shHead(esc(se.dn || "Training")) + (sh.from ? '<button type="button" class="tr-btn tr-sm" data-a="tile" data-t="' + sh.from + '">' + icon("left", 10) + " ZURÜCK ZUR LISTE</button>" : "") + '<p class="tr-sub">' + fmtDay(se.d) + (se.a ? " · " + hm(se.a) + (se.b > se.a ? "–" + hm(se.b) : "") : "") + "</p>" +
        '<div class="tr-stats3 tr-stats3-s"><div class="tr-stat"><small>DAUER</small><b class="tr-mono">' + fmtDur(durOf(se)) + '</b></div><div class="tr-stat"><small>SÄTZE</small><b class="tr-mono">' + setsOf(se) + '</b></div><div class="tr-stat"><small>VOLUMEN</small><b class="tr-mono">' + fmtInt(volumeOf(se, L)) + " kg</b></div></div>" +
        '<div class="tr-sxl">' + exs + "</div>" +
        (sh.sure ? '<p class="tr-sh-p">Diese Einheit wirklich löschen? Das lässt sich nicht rückgängig machen.</p><div class="tr-sh-a"><button type="button" class="tr-btn" data-a="sno" data-focus>NEIN</button><button type="button" class="tr-btn tr-bad" data-a="syes">JA, LÖSCHEN</button></div>'
          : '<button type="button" class="tr-btn tr-sm tr-bad" data-a="sdel">' + icon("trash", 10) + " EINHEIT LÖSCHEN</button>");
    };
    ACT.sdel = () => { ui.sheet.sure = true; renderSheet(); };
    ACT.sno = () => { ui.sheet.sure = false; renderSheet(); };
    ACT.syes = () => {
      const id = ui.sheet.id;
      D.sessions = D.sessions.filter((s) => s.id !== id);
      D.del[id] = Date.now();
      changed();
      closeSheet();
      renderMain(); renderMini();
      toast("EINHEIT GELÖSCHT");
    };

    /* ======================================================================
       Start: lokale Kopie laden, Entwurf wiederherstellen, Ereignisse, Cloud holen
       ====================================================================== */
    loadLocal();
    loadDraft();
    renderMain();
    if (W && !W.min) setScreen("workout"); else renderMini();
    setSync("load");

    setInterval(tick, 250);
    /* Handy: Seite wird versteckt/geschlossen -> Entwurf und Kopie sofort sichern; wieder sichtbar -> Display-Sperre, Cloud auffrischen */
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushNow();
      else {
        if (W) { acquireWake(); tick(); }
        if (!dirty && !pushing && Date.now() - lastLoad > 120000) loadCloud();
      }
    });
    window.addEventListener("pagehide", flushNow);
    window.addEventListener("online", () => { if (dirty) pushNow(); else loadCloud(); });
    /* ohne Netz geaendert: alle 60 s nochmal versuchen */
    setInterval(() => { if (dirty && !pushing && cloudKnown && syncState !== "notoken") pushNow(); }, 60000);
    setTimeout(loadCloud, 250);
    /* im Studio ohne Netz vorgemerkte XP und das Habit "Gym" einloesen, sobald das Dashboard seine Cloud-Daten hat */
    document.addEventListener("cloud-ready", redeemPending);
    setTimeout(redeemPending, 600);

    if (deps.debug) deps.debug({ ui, ACT, INP, CHG, SHEETS, get D() { return D; }, get W() { return W; }, idx, look, loadCloud, pushNow, syncNow, redeemPending, startWorkout, finishWorkout, renderAll, get dirty() { return dirty; }, get syncState() { return syncState; } });

    return {
      metric,
      refresh: loadCloud,
      sync: syncNow,
      running: () => !!W,
      open: () => { if (W) ACT.wopen(); },
      /* Gesamtdauer aller beendeten Einheiten in Stunden (fuer das Raum-Minigame); eine einzelne Einheit zaehlt hoechstens 3 Stunden */
      hoursSince: (since) => D.sessions.reduce((sum, x) => sum + (x.a >= since && x.b > x.a ? Math.min(x.b - x.a, 3 * 3600000) : 0), 0) / 3600000,
      totalHours: () => D.sessions.reduce((sum, x) => sum + (x.a > 0 && x.b > x.a ? Math.min(x.b - x.a, 3 * 3600000) : 0), 0) / 3600000
    };

  };

  /* Pixel-Symbole fuer die Bereichs-Titelzeile und das Handy-Menue (script.js: SECTION_SPRITES) in die gemeinsame Liste eintragen */
  try {
    const P = window.PixelSprites;
    if (P && P.SPR) Object.keys(SPRITES).forEach((k) => { if (!P.SPR[k]) P.SPR[k] = SPRITES[k]; });
  } catch (e) { /* ohne gemeinsame Liste: Symbole fehlen nur in der Titelzeile */ }
})();
