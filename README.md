# Kilian – Dashboard

Statisches HTML/CSS/JS-Dashboard mit Überblick über Bricklink, Bricks On The Floor,
The Brainwalkers, 2026-Ziele, Zeittracker, Google Kalender und Tages-To-Do. Installierbar
als PWA ("Zum Homescreen hinzufügen"). Keine Frameworks, kein Build-Schritt.

## Dateien

- `index.html`, `styles.css`, `script.js` — das Dashboard selbst
- `data.js` — alle Inhalte/Zahlen. Manuelle Felder trägst du hier von Hand ein;
  automatisierte Felder werden von den Skripten überschrieben (siehe unten)
- `scripts/sync-all.mjs` — zieht **alle** automatisierbaren Daten und schreibt sie
  in `data.js`. Ruft die Fetcher in `scripts/fetchers/` nacheinander auf (nicht parallel,
  da youtube.mjs und tiktok.mjs beide das `goals`-Array aktualisieren):
  - `time-tracker.mjs` — Notion "Zeittracker" (Historie für die Zeittracker-Sektion), `push-timetracker.mjs` schreibt im Dashboard erfasste Zeiten nach Notion
  - `youtube.mjs` — YouTube-Abonnenten/Video-Anzahl/letztes **Longform**-Upload-Datum
    (Bricks On The Floor, The Brainwalkers) → speist auch die Upload-Rhythmus-Ampel
  - `tiktok.mjs` — TikTok-Follower (@bricksonthefloor) per Profilseiten-Scrape
  - `bricklink.mjs` — offene Bricklink-Bestellungen (Versand-Alarm) + Umsatz pro Woche
    und pro Monat (Umsatz-Trend-Charts)
- `.github/workflows/sync-all.yml` — automatischer Sync jeden Tag um 08:00 Uhr
  (plus manuell auslösbar über den Sync-Button im Dashboard oder den Actions-Tab)
- `manifest.webmanifest`, `icon-*.png`, `sw.js` — machen das Dashboard als PWA installierbar
- `habits-data.json` — Cloud-Kopie des Habit-Trackers, wird vom Sync-Button im Dashboard
  direkt aus dem Browser aktualisiert (siehe Abschnitt "Habit-Tracker")
- `sync-data.json` — Cloud-Kopie von Video-Ideen, Studium-Termin, Tages-To-Do und
  Aufgaben, ebenfalls vom Sync-Button direkt aus dem Browser aktualisiert (siehe
  Abschnitt "Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben / Remote Tasks / Einkaufsliste")

## Lokal ansehen

Da `data.js` per `<script src>` (kein `fetch`) geladen wird, kannst du `index.html`
einfach per Doppelklick im Browser öffnen — es funktioniert auch ohne Server (nur der
Service Worker/PWA-Teil braucht http/https, siehe Abschnitt "PWA" unten).
Alternativ liegt `preview.ps1` bei (Rechtsklick → "Mit PowerShell ausführen"),
das startet einen lokalen Server auf `http://localhost:8934/`.

## Was automatisch synchronisiert wird — und was nicht

| Daten | Quelle | Status |
|---|---|---|
| Zeittracker: Historie (YouTube/Bricklink-Stunden) | Notion "Zeittracker" | ✅ automatisch |
| Abonnenten Bricks On The Floor & Brainwalkers | YouTube Data API | ✅ automatisch |
| Video-Anzahl Brainwalkers | YouTube Data API | ✅ automatisch |
| Letztes Longform-Upload-Datum (Upload-Rhythmus-Ampel, Shorts zählen nicht) | YouTube Data API | ✅ automatisch |
| Offene Bricklink-Bestellungen / Versand-Alarm | Bricklink API | ✅ automatisch |
| Umsatz-Trend pro Woche & pro Monat (Bricklink) | Bricklink API | ✅ automatisch |
| TikTok-Follower (@bricksonthefloor) | TikTok-Profilseite (Scrape) | ✅ automatisch, siehe Hinweis unten |
| Wochenvergleich-Trendpfeile (Abos, Bricklink-Umsatz) | abgeleitet aus obigen Quellen | ✅ automatisch, siehe Hinweis unten |
| Views/Wiedergabezeit/Umsatz (28 Tage) | — | ❌ manuell (siehe unten, warum) |
| Bricklink Store-Besuche, Feedback gesamt, Drive-Thru-Mails, Ohne Feedback | — | ❌ manuell (siehe unten, warum) |
| Ziel-Fortschritt (Umsatz) | — | ❌ manuell |
| Nächste Video-Idee | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Nächste Prüfung/Abgabe (Studium) | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Tages-To-Do | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Aufgaben (persistent) | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |

**Warum nicht alles automatisch geht:**
- YouTube **Views/Wiedergabezeit/Umsatz** stammen aus YouTube Analytics, nicht aus der
  öffentlichen Data API. Das erfordert einen OAuth2-Login des Kanalinhabers (Consent-Flow
  im Browser) statt eines einfachen API-Keys — für einen unbeaufsichtigten täglichen
  Cronjob deutlich aufwändiger einzurichten. Bei Bedarf später nachrüstbar.
- Bricklink bietet **keine API** für Store-Besuche, aggregiertes Feedback oder deine
  "Drive-Thru-Mail"-Zähler an. Automatisiert wird gezielt das, was die Order-API
  tatsächlich hergibt: offene Bestellungen und deren Status.

## Einrichtung: die drei Datenquellen

### 1. Notion (Zeittracker)

1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → "New integration"
   → Namen vergeben (z.B. "Dashboard") → Token kopieren (`secret_...` oder `ntn_...`).
2. Deine "Zeittracker"-Datenbank in Notion öffnen → "..." Menü → "Connections" →
   die neue Integration hinzufügen.
3. Token als GitHub-Secret `NOTION_TOKEN` hinterlegen (siehe "GitHub Secrets" unten).
4. **Für den Zeittracker im Dashboard:** Die Integration braucht in den Einstellungen (notion.so/my-integrations →
   "Capabilities") zusätzlich **"Insert content"** und **"Update content"**, damit im Dashboard erfasste Zeiten nach Notion
   geschrieben werden können. Ohne diese Rechte läuft alles weiter (Lesen), nur der Abgleich Dashboard → Notion meldet im
   Actions-Log eine Warnung.

### 2. YouTube (Abonnenten)

1. [console.cloud.google.com](https://console.cloud.google.com) → Projekt anlegen
   (oder ein bestehendes nutzen) → "APIs & Services" → "Library" → **"YouTube Data API v3"**
   aktivieren.
2. "APIs & Services" → "Credentials" → "Create Credentials" → "API key". Kein OAuth
   nötig, da nur öffentliche Statistiken abgefragt werden.
3. Als GitHub-Secret `YOUTUBE_API_KEY` hinterlegen. Kostenlos im Rahmen des
   Standard-Kontingents (10.000 Einheiten/Tag, ein täglicher Sync verbraucht ~3).

### 3. Bricklink (offene Bestellungen / Versand-Alarm)

1. Auf [bricklink.com/v2/api/register_consumer.page](https://www.bricklink.com/v2/api/register_consumer.page)
   eine neue "Consumer"-App registrieren → du erhältst **Consumer Key** und
   **Consumer Secret**.
2. Auf derselben Seite (oder unter "API" → "Manage Tokens") einen Token für diese
   App erzeugen → du erhältst **Token Value** und **Token Secret**.
3. Alle vier Werte als GitHub-Secrets hinterlegen:
   `BRICKLINK_CONSUMER_KEY`, `BRICKLINK_CONSUMER_SECRET`,
   `BRICKLINK_TOKEN_VALUE`, `BRICKLINK_TOKEN_SECRET`.
4. **Wichtig, einmal prüfen:** `scripts/fetchers/bricklink.mjs` markiert Bestellungen
   mit Status `PAID`, `PACKED` oder `READY` als "noch zu verschicken". Falls dein
   Bricklink-Workflow andere Status-Bezeichnungen nutzt, als zusätzliches Secret/Env
   `BRICKLINK_SHIP_STATUSES` mit deiner eigenen kommagetrennten Liste überschreiben
   (z.B. `PAID,PACKED`).
5. Für die Umsatz-Trends werden zusätzlich archivierte ("filed") Bestellungen
   abgefragt: standardmäßig die letzten 8 Wochen (Wochenchart) bzw. 6 Kalendermonate
   (Monatschart). Anpassbar über `BRICKLINK_REVENUE_WEEKS` bzw. `BRICKLINK_REVENUE_MONTHS`.

### GitHub Secrets hinterlegen

Repo → **Settings → Secrets and variables → Actions → New repository secret**,
für jeden der oben genannten Namen einmal wiederholen. Jede Datenquelle ist optional:
fehlt ein Secret, überspringt `sync-all.mjs` nur diese eine Quelle (mit Warnung im
Log) statt komplett abzubrechen.

## Kostenlos hosten (GitHub Pages)

```bash
git init
git add .
git commit -m "Dashboard"
git branch -M main
git remote add origin https://github.com/<dein-user>/<repo-name>.git
git push -u origin main
```

Dann im Repo: **Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / `root`**.
Nach ein bis zwei Minuten ist es unter `https://<dein-user>.github.io/<repo-name>/` live.

Trag danach in `data.js` unter `github: { owner: "...", repo: "..." }` deinen
GitHub-Benutzernamen und Repo-Namen ein — das nutzt der Sync-Button im Dashboard,
um den richtigen Workflow anzustoßen. Lässt du es leer, fragt dich der Button beim
ersten Klick danach und merkt es sich im Browser.

## Sync auslösen

- **Automatisch:** läuft jeden Tag um 08:00 Uhr (deutsche Zeit) von selbst und
  synchronisiert alle drei Quellen, sobald deren Secrets hinterlegt sind.
- **Manuell im Dashboard:** Button "Sync" oben rechts. Fragt beim ersten Klick
  einmalig nach einem GitHub Personal Access Token (siehe nächster Abschnitt) und
  merkt sich das im Browser — danach reicht ein Klick.
- **Manuell über GitHub:** Repo → Tab "Actions" → Workflow "Sync all dashboard data"
  → Button "Run workflow".
- **Manuell lokal:**
  ```bash
  NOTION_TOKEN=... YOUTUBE_API_KEY=... BRICKLINK_CONSUMER_KEY=... BRICKLINK_CONSUMER_SECRET=... BRICKLINK_TOKEN_VALUE=... BRICKLINK_TOKEN_SECRET=... node scripts/sync-all.mjs
  ```
  Danach `git add data.js && git commit -m "Sync" && git push`, damit es online sichtbar wird.

### Sync-Button: welcher Token, und warum sicher

Der Button ruft die GitHub-API auf, um denselben Workflow anzustoßen, der auch
automatisch läuft (`sync-all.yml`). Dafür braucht er einen **GitHub Personal
Access Token** — anlegen unter
[github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new)
(**fine-grained**, nicht "classic"):

- "Repository access" → nur dein Dashboard-Repo auswählen
- "Permissions" → "Actions" → **"Read and write"** (für den Sync-Button)
- "Permissions" → "Contents" → **"Read and write"** (für den Habit-Tracker-Cloud-Sync,
  siehe unten) — ohne diese Berechtigung funktioniert der Sync-Button trotzdem, nur der
  Habit-Stand landet dann nicht in der Cloud

Dieser Token landet **nirgends im Code oder Repo** — er wird nur einmal im
Browser abgefragt und lokal in `localStorage` auf deinem eigenen Gerät gespeichert
(einer der wenigen Werte, die bewusst im Browser bleiben — siehe Abschnitt "Cloud-only").
Ein Token mit voller Repo-Berechtigung würde ich hier nicht eintragen; die
fine-grained Variante oben kann wirklich nur Workflows anstoßen und diese zwei Dateien
schreiben, sonst nichts.

## Versand-Alarm (Bricklink)

Der Banner ganz oben im Dashboard erscheint automatisch, sobald
`bricklinkOrders.pendingShipments` (befüllt von `scripts/fetchers/bricklink.mjs`)
mindestens einen Eintrag enthält, und verschwindet von selbst, sobald eine
Bestellung nicht mehr in den "noch zu verschicken"-Status fällt. Mit dem ×
lässt er sich für die aktuelle Browser-Sitzung ausblenden.

## Umsatz-Trend (Bricklink)

Zwei kleine Charts nebeneinander unter den Business-KPIs — **Wöchentlich** und
**Monatlich** — erscheinen automatisch sobald `bricklinkRevenue.weekly` bzw.
`.monthly` (befüllt von `scripts/fetchers/bricklink.mjs`) Daten enthalten.
Wöchentlich zeigt die letzten `BRICKLINK_REVENUE_WEEKS` Kalenderwochen (Default
8), monatlich die letzten `BRICKLINK_REVENUE_MONTHS` Kalendermonate (Default 6).
Storniert/nicht bezahlte Bestellungen zählen in beiden nicht mit.

## TikTok-Follower (@bricksonthefloor)

Speist das Ziel "Bricks On The Floor – TikTok-Follower" (10.000er-Marke). Anders als
YouTube bietet TikTok keine öffentliche Statistik-API mit einfachem API-Key — die
offizielle API erfordert eine von TikTok geprüfte Developer-App plus OAuth-Login des
Kontoinhabers. `scripts/fetchers/tiktok.mjs` liest deshalb bewusst die **öffentliche
Profilseite** von `tiktok.com/@bricksonthefloor` aus (kein Login, kein Secret nötig).

**Bekannte Einschränkung:** Das ist kein von TikTok unterstützter Weg. Ändert TikTok das
Seitenformat, bricht nur dieser eine Fetcher (mit Warnung im Actions-Log), der Rest des
Syncs läuft normal weiter — die TikTok-Zahl bleibt dann einfach auf dem letzten Stand,
bis du sie in `data.js` von Hand nachträgst oder das Skript anpasst. Falls du stattdessen
die offizielle TikTok-API willst: [developers.tiktok.com](https://developers.tiktok.com)
→ App registrieren → Review abwarten (kann mehrere Tage dauern) → Login Kit/Display API.

## Upload-Rhythmus-Ampel

Auf den Bricks-On-The-Floor- und Brainwalkers-Karten: vergleicht das Datum des
letzten **Longform**-Uploads mit deinem Zielrhythmus (`uploadRhythmDays` in
`data.js`, aktuell 7 Tage bzw. 14 Tage) und zeigt 🟢/🟡/🔴. **Shorts zählen
nicht** — `youtube.mjs` schaut sich die letzten 50 Uploads an, holt deren Länge
über die Data API und ignoriert alles bis 180 Sekunden (aktuelles YouTube-Short-
Limit) als Short. Faustregel für die Ampel: 🟢 im Ziel-Rhythmus, 🟡 bis zum
1,5-fachen des Zielrhythmus, 🔴 danach. `uploadRhythmDays` änderst du direkt in
`data.js`, falls sich dein angestrebter Rhythmus mal ändert.

## Nächste Video-Idee

Auf beiden YouTube-Karten: eine kleine Ideen-Liste statt eines einzelnen
Notizfelds. Eine Idee ist farblich hervorgehoben als "die nächste
Video-Idee"; darunter der Rest als "Weitere Ideen". Welche Idee oben steht,
wird **ausschließlich manuell** per Klick festgelegt (Text oder ↑-Pfeil in
"Weitere Ideen") — es rutscht nichts automatisch nach. Hakst du die aktuelle
"nächste Idee" ab (Video ist fertig), bleibt der Platz bewusst **leer**, bis
du selbst eine neue auswählst; die übrigen Ideen in "Weitere Ideen" bleiben
dabei unverändert stehen. Neue Ideen landen immer in "Weitere Ideen" (auch
wenn der Platz oben gerade leer ist) und werden nie automatisch befördert.
Häkchen setzen (oben wie unten) markiert eine Idee als erledigt — sie
verschwindet kurz durchgestrichen aus der Liste. Neue Ideen über das
größere Textfeld darunter eintragen (Enter fügt hinzu, Shift+Enter für einen
Zeilenumbruch).

Wird ausschließlich in der Cloud gespeichert (siehe Abschnitt "Cloud-only" unten) —
bewusst kein Sync-Feld in `data.js`, das läuft über eine eigene, kleinere Datei
(`sync-data.json`).

## Wochenvergleich-Trendpfeile

Bei den Ziele-Karten für Bricks-On-The-Floor-Abos, Brainwalkers-Abos und
TikTok-Follower sowie beim wöchentlichen Bricklink-Umsatz-Chart erscheint ein
🟢↑/🔴↓/⚪→ neben dem aktuellen Wert: Vergleich zum Stand vor ~7 Tagen
(bzw. zur Vorwoche beim Umsatz). Dafür schreibt `scripts/sync-all.mjs` bei
jedem erfolgreichen YouTube-/TikTok-Sync einen Tages-Snapshot in
`metricsHistory` (60 Tage Rolling-Window) — der Bricklink-Umsatzvergleich
braucht das nicht extra, der nutzt einfach die letzten zwei Einträge aus dem
ohnehin vorhandenen `bricklinkRevenue.weekly`.

**Erst nach ein paar Tagen sichtbar:** Direkt nach Einführung dieses Features
gibt es noch keine 7 Tage Verlauf — die Badge bleibt so lange einfach weg,
statt mit zu wenig Daten zu raten. "Bricks On The Floor – Umsatz/Monat" hat
keinen Trendpfeil, weil dieser Wert manuell gepflegt wird und kein
automatischer Verlauf dafür existiert.

## Studium-Countdown

Kleine Karte in der Ziele-Sektion für die nächste Prüfung/Abgabe (z.B. IU
Berlin) — bewusst nur eine einzelne editierbare Karte, kein voller
Termin-Manager und keine Rückkehr zu einer großen "Privat"-Sektion. Bezeichnung
und Datum trägst du über den "Termin eintragen"/"Ändern"-Link ein (zwei simple
Eingabefelder), gespeichert in der Cloud (siehe unten).

## Habit-Tracker

Wöchentliche Gewohnheiten (z.B. Gym, Rauchfreier Tag, &lt;2x Koffein) mit Tages-Checkboxen,
plus Monats- und Jahresansicht (GitHub-Style-Heatmap). Eigene Gewohnheiten hinzufügen/
entfernen über das Eingabefeld direkt über der Wochenansicht.

**Wochenziel statt "jeden Tag":** Jede Gewohnheit hat ein Wochenziel (Default 7 = täglich).
Klick in der Wochenansicht auf die kleine Zähler-Badge (z.B. "3/7") neben dem Namen, um es
zu ändern (1–7) — z.B. Sport auf 3× pro Woche. Sobald so oft abgehakt wurde, färbt sich die
Badge ein (✓ 3/3) und die Woche zählt als erledigt, auch wenn nicht jeder Tag angekreuzt ist.
Das Ziel wird pro Gewohnheit mitgespeichert und läuft über denselben Cloud-Sync mit.

**Streak-Badge:** Läuft eine Gewohnheit 7 Tage oder länger am Stück (Wochenenden/Lücken
brechen die Serie), erscheint neben dem Namen ein kleines Badge mit der Streak-Länge — in
allen drei Ansichten (Woche/Monat/Jahr). Ist der heutige Tag noch nicht abgehakt, zählt die
Serie trotzdem ab gestern weiter, statt sofort auf 0 zu springen.

**Speicherung: nur Cloud.** Der Habit-Stand liegt ausschließlich in `habits-data.json`
im Repo — nichts davon wird im Browser gespeichert (Details im Abschnitt "Cloud-only"
unten). Jede Änderung wird nach ca. 0,7 Sekunden automatisch gepusht; Voraussetzung ist
ein GitHub-Token mit "Contents: Read and write". Beim Laden wird die Datei frisch über die
GitHub-API gelesen (nicht über GitHub Pages, dessen Cache bis zu 10 Minuten alt sein kann).
Der Stand trägt einen Zeitstempel (`updatedAt`), der bei jeder Änderung aktualisiert wird.
Dadurch synct auch ein **Entfernen** eines Häkchens korrekt auf andere Geräte. Einzige
Einschränkung: ändert man auf zwei Geräten annähernd gleichzeitig etwas, gewinnt der Stand
mit dem späteren Zeitstempel vollständig.

**Warum GitHub und nicht Notion, obwohl du dort schon einen "Habit Tracker" hast:**
Notions API blockiert direkte Aufrufe aus dem Browser (kein CORS) — ein Klick im
Dashboard könnte also gar nicht bei Notion ankommen, ohne einen zusätzlichen Server
dazwischenzuschalten. GitHubs API erlaubt das (das nutzt der Sync-Button hier schon die
ganze Zeit), deshalb landet der Habit-Stand als JSON-Datei im selben Repo statt in Notion.

## Google Kalender

Karte direkt über dem Tages-To-Do: zeigt die heutigen Termine deines Google-Kalenders,
lässt dich per Kurztext neue Termine anlegen ("Zahnarzt morgen 10 Uhr" — Google parst
Datum/Uhrzeit selbst über den `quickAdd`-Endpunkt) und öffnet über "Ganzen Kalender
ansehen" ein Overlay mit deinem echten, eingebetteten Google-Kalender (offizielles
Google-Embed, alle Ansichten inklusive).

**Autorisierung:** Google Identity Services (GIS) im Browser, über einen waschechten
OAuth2-Consent-Popup. Die Google Calendar API selbst wird danach direkt per `fetch()` aus
dem Browser angesprochen (CORS ist erlaubt) — kein Server nötig für die eigentlichen
Kalender-Aufrufe.

**Dauerhaft verbunden bleiben:** Der Access-Token lebt nur ~1 Stunde. Damit dafür nicht
jedes Mal ein erneuter Klick auf "Kalender verbinden" nötig ist, holt sich das Dashboard
beim ersten Verbinden zusätzlich einen langlebigen `refresh_token` (OAuth
Authorization-Code-Flow statt des einfacheren Implicit-Flows). Der Tausch
`code → {access_token, refresh_token}` bzw. später `refresh_token → neuer access_token`
läuft über einen kleinen **Cloudflare-Worker-Proxy** (`worker/gcal-proxy.js`), weil dafür
das Google-Client-Secret nötig ist — das darf niemals im öffentlichen Browser-Code stehen.
Der `refresh_token` selbst bleibt **nur lokal** in `localStorage` auf dem jeweiligen Gerät
(nie Teil von `sync-data.json` / GitHub, da das Repo öffentlich ist). Die Erneuerung läuft
danach als ganz normaler `fetch()` im Hintergrund — kein Popup mehr, also auch nicht vom
Browser blockierbar. Pro Gerät ist trotzdem einmalig der "Kalender verbinden"-Klick nötig.

### Einrichtung

1. [console.cloud.google.com](https://console.cloud.google.com) → Projekt anlegen (oder
   ein bestehendes nutzen) → "APIs & Services" → "Library" → **"Google Calendar API"**
   aktivieren.
2. "APIs & Services" → "OAuth consent screen" → Typ "External" (für ein privates
   Google-Konto) → Namen/E-Mail eintragen → Scope `.../auth/calendar.events` hinzufügen
   → dich selbst unter "Test users" eintragen. Im Status "Testing" reicht das für den
   persönlichen Gebrauch, eine Google-Verifizierung ist nicht nötig.
3. "APIs & Services" → "Credentials" → "Create Credentials" → **"OAuth client ID"** →
   Anwendungstyp **"Web application"** → unter "Authorized JavaScript origins" die
   Dashboard-URL eintragen (z.B. `https://kilianmnlg-hub.github.io`, für lokales Testen
   zusätzlich `http://localhost:8934`) → erstellen. Du bekommst eine **Client-ID**
   (`....apps.googleusercontent.com`) sowie ein **Client-Secret** — das Secret wird NICHT
   im Dashboard-Code verwendet, sondern nur gleich als Cloudflare-Worker-Secret hinterlegt
   (Schritt 4).
4. **Cloudflare-Worker-Proxy einrichten** (hält das Client-Secret sicher server-seitig):
   - [dash.cloudflare.com](https://dash.cloudflare.com) → kostenloser Account → "Workers &
     Pages" → "Create application" → "Start with Hello World!" → einen Namen vergeben
     (z.B. `dashboard-gcal-proxy`) → deployen.
   - Den Inhalt von `worker/gcal-proxy.js` aus diesem Repo als Worker-Code hinterlegen
     (per Cloudflare-Dashboard-Editor oder per API/`wrangler`).
   - Unter den Worker-Einstellungen zwei Variablen setzen: `GOOGLE_CLIENT_ID` (Plaintext,
     die Client-ID aus Schritt 3) und `GOOGLE_CLIENT_SECRET` (als **Secret**, verschlüsselt
     — das Client-Secret aus Schritt 3).
   - Falls sich die Dashboard-URL ändert oder ein weiteres Gerät/Origin dazukommt: die
     `ALLOWED_ORIGINS`-Liste oben in `worker/gcal-proxy.js` entsprechend erweitern und neu
     deployen.
   - Die resultierende Worker-URL (`https://<name>.<dein-account>.workers.dev`) in
     `data.js` unter `googleCalendar: { workerUrl: "..." }` eintragen.
5. Beim ersten Klick auf "Kalender verbinden" im Dashboard fragt dich ein Prompt einmalig
   nach Client-ID und Worker-URL (falls nicht schon in `data.js` hinterlegt) und merkt sie
   sich pro Browser/Gerät in `localStorage`. Direkt danach öffnet sich Googles
   Consent-Popup (Login + Berechtigung erteilen) — danach lädt das Dashboard deine
   heutigen Termine und bleibt ab jetzt dauerhaft verbunden (siehe oben).

**Kalender-ID für den eingebetteten "Ganzer Kalender"-Link:** wird nach dem Verbinden
automatisch über die API ermittelt (deine `primary`-Kalender-ID, meist deine
Gmail-Adresse) und lokal gemerkt. Optional in `data.js` unter
`googleCalendar: { calendarId: "du@gmail.com" }` fest eintragen, falls du einen anderen
Kalender als deinen Haupt-Kalender einbetten willst.

## Tages-To-Do

Trägst du direkt im Dashboard ein (drei Spalten: Business, Studium & Job,
Privates). Wird ausschließlich in der Cloud gespeichert (siehe unten) und setzt
sich jeden Tag automatisch zurück. Die Cloud-Kopie trägt das jeweilige Datum.

**Nicht abgehakte Punkte verfallen nicht** — beim nächsten Laden des
Dashboards an einem neuen Tag wandert jeder noch offene (nicht abgehakte)
Punkt aus dem alten Tages-To-Do (so wie es in der Cloud steht) automatisch nach
"Aufgaben" (siehe unten), wo er dauerhaft stehen bleibt statt zu verschwinden.
Abgehakte Punkte verfallen wie bisher einfach mit dem Tageswechsel.

## Aufgaben

Direkt unter dem Tages-To-Do, aber bewusst getrennt gespeichert (eigenes
Feld ohne Datum in `sync-data.json`) — im Gegensatz zum Tages-To-Do **kein täglicher
Reset**. Einträge bleiben stehen, bis du sie abhakst; nach dem Abhaken werden
sie automatisch (kurz sichtbar durchgestrichen) aus der Liste entfernt. Läuft
ebenfalls über den Cloud-Sync (siehe unten). Sammelt zusätzlich automatisch
alles, was aus dem Tages-To-Do vergangener Tage nicht abgehakt wurde (siehe
oben).

**Zurück ins Tages-To-Do:** Der Pfeil (↩) an jeder Aufgabe öffnet ein kleines
Menü mit den drei Tages-To-Do-Spalten (Business, Studium & Job, Privates) —
Klick auf eine Spalte verschiebt die Aufgabe dorthin (als neuer, nicht
abgehakter Punkt) und entfernt sie aus "Aufgaben".

## Remote Tasks

Eigene Liste direkt unter "Aufgaben" für alles, was remote/unterwegs erledigt wird. Sie
funktioniert exakt wie "Aufgaben" (gleicher Code): kein täglicher Reset, Abhaken entfernt
den Eintrag, der Pfeil (↩) verschiebt ihn ins Tages-To-Do, und der Stand liegt als eigenes
Feld `remoteTasks` in `sync-data.json` (Cloud-only, siehe unten). Offene Punkte aus dem
Tages-To-Do vergangener Tage wandern weiterhin nur nach "Aufgaben".

## Pixel-Look und Handy-Ansicht

Das ganze Dashboard ist im Retro-Spielstil gehalten: 2-Pixel-Rahmen mit hartem Schatten, Press-Start-Schrift für
Beschriftungen, Pixel-Symbole und Animationen in Stufen. Die Anordnung der Kästchen ist dabei unverändert geblieben,
geändert hat sich nur der Look. Alles ist rein visuell (Code: Block "Pixel-Look" am Ende von `styles.css`, Symbole und
Wisch-Helfer in `shopping.js`) und speichert nichts. Es gilt weiterhin: alle Nutzdaten liegen nur in der Cloud.

- **Sektionstitel** haben je ein Pixel-Symbol (Kalender, Rolle, Schwert, Globus, Flamme, Pokal, Truhe, Sanduhr,
  Einkaufswagen, Buch). Die Business-Karten haben bewusst keine Symbole, nur einen Farbbalken oben.
- **Brain-Karte:** Die Bereiche sind Pixel-Kacheln mit Symbol, verbunden durch gestrichelte, wandernde Wege (kein 3D-Kippen mehr).
- **Ziele:** Die Ringe der Ziele bestehen aus 24 Pixel-Blöcken, die beim
  Laden nacheinander aufleuchten. Balkendiagramme sind aus gestapelten Pixel-Blöcken aufgebaut. Habit-Serien ab 7 Tagen
  zeigen das Flammen-Badge.
- **Level oben in der Leiste:** "LVL 5" mit zehn Kästchen bis zum nächsten Level, daneben die XP ("37 / 120 XP"). Der Level kommt aus dem
  Punktesystem, siehe "Level-System" weiter unten.
- **Handy (bis 720px Breite):**
  - Menü als zweite, seitlich wischbare Zeile, der aktive Eintrag bleibt mittig.
  - Ziele, Business und Tages-To-Do sind wischbare Karten-Reihen mit Einrasten und Positions-Punkten.
  - Habit-Woche: Name oben, die sieben Tage groß darunter.
  - Wischen auf Habits und Zeittracker wechselt Woche/Monat/Jahr, auf der Einkaufsliste die vier Reiter.
  - Eine Zeile in Aufgaben, Remote Tasks und der Einkaufsliste nach rechts wischen = abhaken (ab ca. 90px Zug; in der
    Einkaufsliste lässt sich das durch nochmaliges Wischen zurücknehmen). Diagramme scrollen seitlich.
  - Größere Tippflächen, Eingaben ohne Zoom-Sprung (16px), Rücksicht auf Notch und Home-Leiste.

## Reality-Check bei den Zielen und Achtung-Banner

**Reality-Check:** Jede Zielkarte zeigt unter dem Ring das nötige Tempo bis zur Frist (z.B. "244/Tag"), dein aktuelles Tempo, die
Prognose zur Frist und einen Status: AUF KURS (ab 97 % des Ziels), KNAPP DAHINTER (ab 90 %), DAHINTER (ab 70 %) oder ZU WEIT WEG.
Das Tempo kommt bei Abos und Followern aus `metricsHistory` (letzte 28 Tage, mindestens 7 Tage Verlauf), bei den Longform-Videos
aus dem Upload-Rhythmus des Kanals. Ohne Messwerte (z.B. Umsatz, Bricklink-Teile) steht nur die Zeile "nötig".

**Achtung-Banner:** Ganz oben, wie der Versand-Alarm, erscheinen weitere wegklickbare Hinweise: überfälliger Longform-Upload je Kanal
(rot ab 1,5-fachem Rhythmus, sonst gelb; Shorts zählen nicht) und offene Bricklink-Drive-Thru-Mails bzw. Bestellungen ohne Feedback.
"Wegklicken" gilt nur für die aktuelle Sitzung.

## Kennzahlen, Bereichsfarben und Pixel-Effekte

- **Kennzahl in der Titelzeile:** Jedes Fenster zeigt neben dem Titel das Wichtigste, auch wenn es eingeklappt ist (z.B. "2 OFFEN" bei Aufgaben,
  "2 / 10 HEUTE" bei Habits, "WOCHE 8,2 / 27 H" beim Zeittracker, "≈ 48 €" bei der Einkaufsliste, "1 VOM HANDY" bei Notizen). Die Werte
  werden aus den bestehenden Daten berechnet und aktualisieren sich von selbst; ohne Daten (z.B. Kalender nicht verbunden) bleibt das Feld weg.
- **Farbe pro Bereich:** Der harte Schatten der Karten trägt die Farbe des Bereichs: blau Kalender und Remote Tasks, orange To-Do und
  Business, violett Aufgaben und Notizen, grün Habits, gold Ziele, korall Zeittracker (die Einkaufsliste behält ihre eigene Farbe).
- **Pixel-Funken:** Beim Abhaken gibt es kurze Funken mit den gewonnenen Punkten ("+10 XP", nur Optik, bei reduzierter Bewegung abgeschaltet).
- **Level-up:** Steigt das Level durch einen Abhaken-Punkt, blinkt die Level-Anzeige oben mit "LEVEL UP!", bei einem neuen Rang mit "NEUER RANG: …".

## Spruch des Tages

Unter der Begrüßung oben steht jeden Tag ein anderer Satz ("SPRUCH DES TAGES"), statt der früheren Erklärungstexte, im Ton hart und direkt (Richtung David Goggins) oder philosophisch (stoisch). Die Liste (170 Sätze)
steckt in `quotes.js`, braucht also kein Netz; der Satz ergibt sich aus dem Datum, ist auf allen Geräten gleich und wechselt um Mitternacht.
Erst nach allen 170 Tagen wiederholt sich einer. Neue Sätze einfach in die Liste in `quotes.js` eintragen. Der Stand der Daten steht weiter
unten im Fuß der Seite ("zuletzt synchronisiert").

## Schutz gegen überschreibende Geräte

Ein Gerät mit altem Dashboard-Code kann `sync-data.json` komplett neu schreiben und dabei Bereiche löschen, die es noch nicht kennt (so ging
am 07.10. die Einkaufsliste verloren). Dagegen gibt es zwei Schutzschichten:

- **Workflow `Protect sync data`** (`.github/workflows/protect-sync-data.yml`, Skript `scripts/protect-sync-data.py`): läuft nach jedem Schreiben von
  `sync-data.json` und `habits-data.json`. Fehlt ein Bereich im neuen Stand, oder steht ein Bereich mit eigenem Zeitstempel plötzlich auf
  "nie gespeichert" (updatedAt 0), holt er ihn aus dem Stand davor zurück und committet das als `dashboard-bot`. Bewusst geleerte Bereiche
  (neuer Zeitstempel) bleiben leer. Probelauf lokal: `DRY_RUN=1 python scripts/protect-sync-data.py <vorher> <nachher>`.
- **Im Dashboard selbst:** Beim Speichern behält der Code Bereiche der Cloud-Datei, die er nicht kennt (Felder neuerer Versionen), statt sie zu
  löschen. Das schützt künftig vor Geräten, die auf dieser Version hängen bleiben.

Zusätzlich liegt jeder Stand in der Git-Historie: mit `git show <commit>:sync-data.json` lässt sich ein früherer Stand jederzeit nachlesen.

## Timer in der Leiste, Kurzbefehle, Update-Hinweis, Ladebalken

- **Laufender Timer:** Solange ein Timer läuft, steht er als Chip oben in der Kopfleiste (Uhrzeit und Bereich, Klick springt zum Zeittracker) und im
  Tab-Titel ("▶ 00:42 YouTube · Dashboard"). Der Stand kommt aus der Cloud: ein am Handy gestarteter Timer erscheint auch am PC.
- **Kurzbefehle am Handy-Icon (Android):** Langes Drücken auf das App-Icon bietet "Schnelle Notiz", "YouTube-Timer starten" und "Einkaufsliste"
  (`shortcuts` im Manifest, Aufruf als `?action=note`, `?action=timer-youtube`, `?action=shopping`). Ausgeführt wird erst, wenn die Cloud geladen ist,
  damit der Timer-Start nicht vom noch leeren Stand überschrieben wird. Unter iOS zeigt das Betriebssystem solche Menüs bei Web-Apps nicht an.
- **Neue Version verfügbar:** Das Dashboard vergleicht beim Start, beim Zurückkehren zum Tab und alle 10 Minuten die Versionsnummer in `index.html`
  mit der geladenen. Ist der Server neuer, erscheint oben ein gelber Hinweis im Stil der anderen Banner mit "NEU LADEN".
- **Ladebalken:** Solange die Cloud lädt (und bei Nichterreichbarkeit), zeigt ein Pixel-Balken mit Platzhaltern den Zustand an.

## Handy-Menü zum Springen

Auf dem Handy (bis 720 px Breite) entfällt die kleine wischbare Menüzeile oben. Stattdessen sitzt unten rechts über dem "+"-Knopf ein Menü-Knopf
(Raster-Symbol, mit dem Daumen erreichbar). Er öffnet ein Raster mit großen Kacheln für alle neun Bereiche, jede mit Pixel-Symbol, Farbe des
Bereichs und der aktuellen Kennzahl (z.B. "2 OFFEN"). Der Bereich, in dem du gerade bist, ist markiert. Ein Tipp springt zum Bereich (klappt ihn
auf, falls eingeklappt) und schließt das Menü; auch Tippen daneben, das ×-Symbol und die Esc-Taste schließen es. Auf PC und Tablet bleibt die
Menüleiste oben. Das Menü speichert nichts, die Kennzahlen kommen aus den gleichen Cloud-Daten wie in den Titelzeilen.

## Level-System (XP)

Der Level startete am 10.10.2026 bei 0. Jedes Abhaken gibt Punkte (XP), die automatisch gezählt werden; Level 1 kostet 50 XP, jedes weitere Level
20 % mehr (60, 72, 86, ...). Keine Tageshöchstwerte.

| Was | XP |
|---|---|
| Ziel erreicht (einmal pro Ziel) | so viel wie ein ganzer Levelaufstieg (Meilenstein die Hälfte) |
| Aufgabe / Remote Task erledigt | 12 |
| Tages-To-Do abgehakt | 10 |
| Habit abgehakt (nur für heute) | 6 |
| Alle Habits eines Tages erledigt | +10 Bonus |
| Habit erreicht sein Wochenziel (Mo bis So) | +15 Bonus, pro Habit und Woche einmal |
| Erfasste Zeit | 4 pro volle halbe Stunde |
| Notiz vom Handy | 3 |
| Einkaufsartikel abgehakt | 2 |

**Ränge** alle fünf Level: Anfänger (0), Lehrling (5), Geselle (10), Experte (15), Meister (20), Großmeister (25), Veteran (30), Champion (35),
Legende (40), Mythos (50). Der Rang steht im Tooltip der Level-Anzeige (auf sehr breiten Bildschirmen auch daneben) und beim Rangwechsel im Level-up.

**Speicherung und Sync:** In der Cloud (Feld `xp` in `sync-data.json`, Code in `xp.js`). Jede Buchung hat einen festen Schlüssel (z.B. `habit:gym@2026-10-10`) und
zählt genau einmal, egal auf welchem Gerät; die Geräte vereinigen ihre Buchungen. Tage älter als 60 Tage werden zu einer Summe verdichtet. Haken
zurücknehmen und erneut setzen bringt keine neuen Punkte. Ziele, die beim Start des Systems schon erreicht waren, geben keine Punkte (`xp.goals`).
Neustart auf 0: das Feld `xp` in `sync-data.json` löschen; beim nächsten Laden werden die dann erreichten Ziele wieder still als erledigt markiert.

## Einklappbare Fenster

Jedes Fenster (Brain-Karte oben und alle Sektionen von Kalender bis Notizen) hat vorn in der Überschrift einen Pfeil-Knopf. Ein Klick
klappt den Inhalt zu und lässt nur die Titelzeile stehen, ein zweiter klappt ihn wieder auf. Standard ist immer ausgeklappt; gemerkt
wird nur, was du eingeklappt hast. Die Liste liegt wie alles andere in der Cloud (Feld `fold` in `sync-data.json`, Code in `fold.js`),
gilt also auf allen Geräten gleich und nicht nur im Browser.

## Zeittracker

Ersetzt die frühere Zeit-Balance. Der Arbeitszeit-Tracker ist direkt im Dashboard (Code in `timetracker.js`, Pixel-Stil wie
der Rest):

- **Timer** für YouTube und Bricklink mit Start/Stop. Ein laufender Timer liegt in der Cloud, ein Timer vom Handy läuft
  also auch am PC weiter. Ein Timer stoppt automatisch nach 5 Stunden und wird mit genau dieser Dauer gespeichert (auch wenn das Dashboard
  inzwischen zu war: beim nächsten Öffnen wird es nachgeholt). Unter "Läuft" steht die Uhrzeit des Auto-Stopps.
- **Kacheln** Heute / Diese Woche / Dieser Monat mit Anteil YouTube vs. Bricklink.
- **Ausklappfenster:** "Übersicht" (Diagramm) und "Verlauf" sind standardmäßig zugeklappt und sparen Platz. In der Titelzeile steht
  eine Kurzinfo (z.B. "WOCHE 5.10. – 11.10. · 8h 11m", "224 EINTRÄGE · ZULETZT 06.10.").
- **Diagramm** Woche, Monat und Jahr (Heatmap) mit Vor-/Zurück-Pfeilen; Tipp auf einen Tag öffnet das Tages-Detail.
  Auf dem Handy wechselt Wischen zwischen Woche, Monat und Jahr.
- **Wochenziel** (Ausklappfenster): Stunden-Soll pro Bereich (Standard YouTube 20 h, Bricklink 8 h, mit − und + einstellbar und
  in der Cloud gespeichert), Fortschrittsleiste mit Marke "heute" ("1,7 h unter Plan") und der Verlauf der letzten 9 Wochen mit
  gestrichelter Soll-Linie.
- **Verlauf** der letzten 100 Einträge, "+ Eintrag" für manuelle Zeiten, × zum Löschen.

**Daten:** Im Dashboard erfasste Einträge, gelöschte Einträge und laufende Timer liegen nur in der Cloud (Feld `timetracker`
in `sync-data.json`, wie alles andere). Die Historie kommt aus Notion (`data.timeTracker.entries`, vom täglichen Sync).
Das Dashboard zeigt beides zusammen; Einträge, die in beiden vorkommen, zählen nur einmal (Erkennung über Kategorie plus
Start-Minute). Einträge und Löschungen werden bei gleichzeitigen Änderungen auf zwei Geräten immer vereinigt.

**Abgleich mit Notion:** Der Workflow `sync-all.yml` schreibt in seinem ersten Schritt (`scripts/push-timetracker.mjs`) neue
Dashboard-Einträge als Seiten in die Notion-Datenbank "Zeittracker" und verschiebt gelöschte in den Notion-Papierkorb;
danach liest der normale Sync alles wieder ein. Das passiert täglich um 08:00 Uhr oder sofort über den Sync-Knopf oben.
Bis dahin steht oben rechts im Tracker "N OFFEN" (Einträge, die noch auf Notion warten). Voraussetzung: Die
Notion-Integration hat Schreibrechte (siehe "Einrichtung", Notion). Der alte Notion-Tracker (Artifact) funktioniert
weiter; seine Einträge erscheinen nach dem nächsten Sync im Dashboard.

## Handy-Notiz (Cloud-Inbox)

Am Handy (und überall mit Touch) schwebt unten rechts ein **+**-Knopf. Er öffnet ein Eingabefenster mit Kategorien (die Themen-Ordner deines
Vaults, Standard "Ideen"). Die Notiz geht nur in die Cloud (Feld `inbox` in `sync-data.json`) und erscheint in der Sektion "Notizen" unter
"VOM HANDY". Am PC übernimmt `scripts/sync-brainmap.ps1` (täglicher Task "Dashboard Brain-Map Sync") neue Inbox-Notizen vor dem Vault-Scan
in die jeweilige `Notizen.md` im richtigen Ordner (gleiches Format wie die Schnelle Notiz). Bereits übernommene Notizen merkt sich
`scripts/inbox-imported.json` (nur lokal, nicht im Repo). Sobald eine Notiz in `data.notes` auftaucht, zeigt die Liste "✓ IN OBSIDIAN" und
räumt sie nach 3 Tagen von selbst auf; mit × lässt sich jede Notiz auch sofort entfernen. Am PC mit Chrome/Edge funktioniert weiter die
direkte "Schnelle Notiz" über den Brain-Kern.

## Einkaufsliste

Eigene Sektion zwischen "Zeittracker" und "Notizen" im Retro-Pixel-Stil (Code in `shopping.js`,
eingebunden von `script.js`). Alles in einer kompakten Karte, vier Reiter klappen je ein Feld auf:

- **Liste:** Artikel eintippen (Enter oder +). Mengen wie "2x Milch" werden erkannt, und die Liste
  sortiert automatisch nach Supermarkt-Gängen (Obst & Gemüse, Milch & Kühlregal, Vorrat und so weiter,
  jeder Gang einklappbar). Die Gang-Zuordnung läuft über Stichwörter. Ein Tipp auf das Schriftrollen-Symbol
  einer Zeile ändert den Gang, und die Wahl wird für diesen Artikel gemerkt. Abhaken streicht kurz durch und
  schiebt den Artikel ins Inventar.
- **Inventar:** alles, was du schon gekauft hast (nach Häufigkeit sortiert, mit Anzahl und letztem Preis).
  Antippen legt den Artikel zurück auf die Liste, das × vergisst ihn.
- **Vorrat:** pro Artikel eine Leiste, berechnet aus den Abständen deiner bisherigen Käufe. Ist sie leer
  (blinkt "LEER!"), ist der Artikel vermutlich fällig. Dafür muss ein Artikel mindestens zweimal gekauft worden sein.
- **Rezepte:** Gerichte mit Zutaten. CRAFT legt alle Zutaten auf die Liste, Vorhandenes wird nicht doppelt
  eingetragen. Neue Rezepte entstehen über Name + Zutaten (mit Komma getrennt) oder aus der aktuellen Liste.

**Symbole:** Jeder Gang hat ein Symbol, dazu gibt es 100 eigene Artikel-Symbole (Banane, Nudeln, Cola, Proteinpulver, Skyr,
Süßkartoffel, Thunfisch, Zahnbürste und so weiter), die über Stichwörter hunderte Artikelnamen abdecken. Das erste passende Wort im Namen bestimmt das Symbol, sonst zeigt der Artikel das Symbol seines Gangs.
Der aufklappbare "Symbol-Katalog" unter der Karte zeigt alle.

**Preise:** Beim Eintippen kann ein Preis mitgegeben werden ("Butter 2,39"), oder der Preis-Button in der
Zeile wird angetippt. Der zuletzt bekannte Preis pro Artikel wird gemerkt und bleibt **dauerhaft** gespeichert: Es gibt keine Funktion, die
einen Preis löscht, und beim Abgleich mit der Cloud werden Preise (und gemerkte Gänge) immer vereinigt, auch wenn
ein anderes Gerät einen neueren Stand ohne sie schreibt. Die Münze oben rechts zeigt den
geschätzten Preis der offenen Liste ("+2?" heißt: zwei Artikel ohne Preis). Alle Beträge werden auf volle
Euro aufgerundet angezeigt. Der **Shop-Modus** blendet Eingabe und Reiter aus und macht die Zeilen groß.

**Speicherung:** wie alles andere nur in der Cloud, als Feld `shopping` in `sync-data.json` (Liste, Verlauf mit
den letzten 12 Kaufzeitpunkten je Artikel, Preise, gemerkte Gänge, Rezepte), also auf allen Geräten gleich.
Es gelten dieselben Regeln wie bei den Aufgaben (siehe "Cloud-only" unten): neuester Zeitstempel gewinnt, ein
leerer Stand überschreibt nie einen gefüllten. Die Einkaufsliste wird als Ganzes synchronisiert, parallele
Änderungen auf zwei Geräten innerhalb weniger Sekunden können sich also gegenseitig überschreiben.

## Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben / Remote Tasks / Einkaufsliste

Diese vier kleinen, unabhängigen Felder teilen sich eine gemeinsame Cloud-Datei
(`sync-data.json`) und funktionieren nach demselben Prinzip wie der
Habit-Tracker oben:

1. **Nur in der Cloud** (`sync-data.json` im Repo), nichts im Browser — siehe
   Abschnitt "Cloud-only". Jede Änderung wird nach ca. 0,7 Sekunden automatisch
   gepusht. Voraussetzung: der GitHub-Token braucht "Contents: Read and
   write" (siehe Abschnitt "Sync-Button" oben).
2. Beim Laden der Seite wird `sync-data.json` frisch über die GitHub-API gelesen.
   Jedes Feld trägt einen eigenen Zeitstempel (`updatedAt`); beim Tages-To-Do
   zählt zusätzlich das Datum — ein Cloud-Stand von einem früheren Tag wird nicht
   übernommen, stattdessen wandern dessen offene Punkte einmalig nach "Aufgaben".

**Einschränkung:** wie beim Habit-Tracker gilt "neuester Zeitstempel gewinnt
komplett" pro Feld — änderst du z.B. dieselbe Video-Idee auf zwei Geräten
annähernd gleichzeitig, ohne dazwischen zu syncen, geht eine der beiden
Fassungen verloren. Bei normaler Nutzung (ein Gerät nach dem anderen) fällt
das nicht ins Gewicht.

## Cloud-only

Alle Nutzdaten — Habits, Aufgaben, Tages-To-Dos, Video-Ideen und Studium-Termin —
liegen **ausschließlich in der Cloud** (`habits-data.json` und `sync-data.json` im
Repo). Der Browser hält davon keine Kopie: kein `localStorage`, und der Service
Worker fasst diese Dateien nicht an.

**Was bewusst im Browser bleibt** (gehört nicht in ein öffentliches Repo bzw. ist
pro Gerät): GitHub-Token, Kalender-Zugang (inkl. Refresh-Token), Theme und das
(das Level selbst liegt nicht hier, sondern in der Cloud).

**Verhalten:**
- Beim Laden wird der Cloud-Stand frisch über die GitHub-API gelesen. Bis er da ist,
  ist die Seite kurz gesperrt (leicht ausgegraut). Schlägt das Laden fehl, bleibt sie
  gesperrt, zeigt "Cloud nicht erreichbar" und versucht es alle 10 Sekunden erneut —
  ein Ladefehler wird nie als leerer Stand behandelt und kann daher nichts überschreiben.
- Jede Änderung wird nach ca. 0,7 Sekunden automatisch in genau die betroffene Datei
  gepusht (Status oben rechts neben dem Sync-Button). Bei einem Konflikt (z.B. paralleler
  Workflow-Commit) wird bis zu zweimal automatisch neu versucht.
- **Kein Offline-Bearbeiten.** Ohne Token ist das Dashboard praktisch nur lesbar: bei der
  ersten Änderung fragt es einmal pro Sitzung nach dem Token; lehnst du ab, steht
  "Nicht gespeichert — GitHub-Token fehlt". Beim Schließen mit ungespeicherten
  Änderungen warnt der Browser.
- **Einmalige Übernahme alter Daten:** liegen auf einem Gerät noch alte lokale Daten aus
  früheren Versionen, werden sie beim Laden mit der Cloud abgeglichen (neuerer
  Zeitstempel gewinnt, ein leerer Stand überschreibt nie einen gefüllten), hochgeladen
  und erst nach erfolgreichem Push aus dem Browser gelöscht.
- **GitHub-API-Limit:** 5.000 Anfragen/Stunde pro Token — bei persönlicher Nutzung
  praktisch nicht erreichbar. Mehr Commits in der Historie von `habits-data.json` /
  `sync-data.json` sind die Folge davon, dass jede Änderung sofort gepusht wird.
- Der **"Sync"-Button** stößt zusätzlich den GitHub-Actions-Workflow für die Business-Daten
  an (Bricklink/YouTube/TikTok/Notion) und bleibt bewusst manuell/täglich.

## PWA ("Zum Homescreen hinzufügen")

Sobald das Dashboard über GitHub Pages (oder einen anderen https-Server) läuft,
bietet Chrome/Edge auf Android automatisch "App installieren" an; auf dem iPhone
geht es über Safari → Teilen → "Zum Home-Bildschirm". Technisch dahinter:
`manifest.webmanifest` (App-Name, Farben, Icon) + `sw.js` (Service Worker).

Der Service Worker ist bewusst simpel gehalten: **network-first** für alle
Dateien inklusive `data.js` — das Netzwerk hat immer Vorrang, der Cache dient
nur als Fallback für die App-Dateien ohne Internetverbindung. Bei jedem Laden wird beim Server nachgefragt (`no-cache`), damit GitHub Pages' 10-Minuten-Zwischenspeicher keine alte Version festhält. Die Daten-Dateien
(`habits-data.json`, `sync-data.json`) und alle fremden Hosts (GitHub-API, Google)
ignoriert er komplett, damit nie ein veralteter Cloud-Stand ausgeliefert wird.

**Versionsnummer gegen veraltete Dateien:** `styles.css`, `shopping.js`, `timetracker.js` und `script.js` hängen in `index.html`
mit einem `?v=…`-Parameter, damit der Browser sie nach einem Deploy immer zusammen in der neuen Version lädt (sonst kann eine
alte `script.js` mit einer neuen `index.html` kombiniert werden, und ganze Sektionen bleiben leer). Bei jedem Deploy mit
Code-Änderungen die Version in `index.html` hochzählen und den Cache-Namen in `sw.js` erhöhen. `data.js` hat bewusst keinen
Parameter, ändert sich täglich und wird vom Service Worker immer beim Server nachgefragt; der Zeittracker lädt seine
Notion-Historie zusätzlich frisch nach.

Das App-Icon ist ein Pixel-Pokal im Farbschema des Dashboards, als PNG in drei Größen: `icon-64.png` (Browser-Tab), `icon-200.png`
(Startbildschirm, Apple-Touch-Icon) und `icon-640.png` (Installation, mit Rand für maskierte Icons).
