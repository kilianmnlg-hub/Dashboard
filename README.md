# Kilian – Dashboard

Statisches HTML/CSS/JS-Dashboard mit Überblick über Bricklink, Bricks On The Floor,
The Brainwalkers, 2026-Ziele, Zeit-Balance, Google Kalender und Tages-To-Do. Installierbar
als PWA ("Zum Homescreen hinzufügen"). Keine Frameworks, kein Build-Schritt.

## Dateien

- `index.html`, `styles.css`, `script.js` — das Dashboard selbst
- `data.js` — alle Inhalte/Zahlen. Manuelle Felder trägst du hier von Hand ein;
  automatisierte Felder werden von den Skripten überschrieben (siehe unten)
- `scripts/sync-all.mjs` — zieht **alle** automatisierbaren Daten und schreibt sie
  in `data.js`. Ruft die Fetcher in `scripts/fetchers/` nacheinander auf (nicht parallel,
  da youtube.mjs und tiktok.mjs beide das `goals`-Array aktualisieren):
  - `time-tracker.mjs` — Notion "Zeittracker" (Zeit-Balance-Sektion)
  - `youtube.mjs` — YouTube-Abonnenten/Video-Anzahl/letztes **Longform**-Upload-Datum
    (Bricks On The Floor, The Brainwalkers) → speist auch die Upload-Rhythmus-Ampel
  - `tiktok.mjs` — TikTok-Follower (@bricksonthefloor) per Profilseiten-Scrape
  - `bricklink.mjs` — offene Bricklink-Bestellungen (Versand-Alarm) + Umsatz pro Woche
    und pro Monat (Umsatz-Trend-Charts)
- `.github/workflows/sync-all.yml` — automatischer Sync jeden Tag um 08:00 Uhr
  (plus manuell auslösbar über den Sync-Button im Dashboard oder den Actions-Tab)
- `manifest.webmanifest`, `icon.svg`, `sw.js` — machen das Dashboard als PWA installierbar
- `habits-data.json` — Cloud-Kopie des Habit-Trackers, wird vom Sync-Button im Dashboard
  direkt aus dem Browser aktualisiert (siehe Abschnitt "Habit-Tracker")
- `sync-data.json` — Cloud-Kopie von Video-Ideen, Studium-Termin, Tages-To-Do und
  Aufgaben, ebenfalls vom Sync-Button direkt aus dem Browser aktualisiert (siehe
  Abschnitt "Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben")

## Lokal ansehen

Da `data.js` per `<script src>` (kein `fetch`) geladen wird, kannst du `index.html`
einfach per Doppelklick im Browser öffnen — es funktioniert auch ohne Server (nur der
Service Worker/PWA-Teil braucht http/https, siehe Abschnitt "PWA" unten).
Alternativ liegt `preview.ps1` bei (Rechtsklick → "Mit PowerShell ausführen"),
das startet einen lokalen Server auf `http://localhost:8934/`.

## Was automatisch synchronisiert wird — und was nicht

| Daten | Quelle | Status |
|---|---|---|
| Zeit-Balance (YouTube/Bricklink-Stunden) | Notion "Zeittracker" | ✅ automatisch |
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
Browser abgefragt und lokal in `localStorage` auf deinem eigenen Gerät gespeichert.
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

Speichert sofort im Browser (`localStorage`) und läuft automatisch in die
Cloud (siehe Abschnitt "Auto-Sync" unten) sowie zusätzlich beim nächsten Klick
auf "Sync" — bewusst kein Sync-Feld in `data.js`, das läuft über eine eigene,
kleinere Datei (`sync-data.json`).

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
Eingabefelder), gespeichert lokal im Browser (`localStorage`) und per
Cloud-Sync geräteübergreifend (siehe unten).

## Habit-Tracker

Wöchentliche Gewohnheiten (z.B. Gym, Rauchfreier Tag, &lt;2x Koffein) mit Tages-Checkboxen,
plus Monats- und Jahresansicht (GitHub-Style-Heatmap). Eigene Gewohnheiten hinzufügen/
entfernen über das Eingabefeld direkt über der Wochenansicht.

**Wochenziel statt "jeden Tag":** Jede Gewohnheit hat ein Wochenziel (Default 7 = täglich).
Klick in der Wochenansicht auf die kleine Zähler-Badge (z.B. "3/7") neben dem Namen, um es
zu ändern (1–7) — z.B. Sport auf 3× pro Woche. Sobald so oft abgehakt wurde, färbt sich die
Badge ein (✓ 3/3) und die Woche zählt als erledigt, auch wenn nicht jeder Tag angekreuzt ist.
Das Ziel wird pro Gewohnheit mitgespeichert und läuft über denselben Cloud-Sync mit.

**Speicherung, zweistufig:**
1. **Sofort lokal** (`localStorage`) bei jedem Klick — funktioniert immer, auch offline.
2. **Cloud-Kopie in `habits-data.json`** im Repo — automatisch, ca. 2,5 Sekunden nach
   der letzten Änderung (siehe Abschnitt "Auto-Sync" unten), sobald einmal ein
   GitHub-Token hinterlegt ist. Zusätzlich laufen alle Habit-/Sync-Daten-Aenderungen
   auch am "Sync"-Button oben rechts mit, der daneben noch die Business-Daten
   aktualisiert. Voraussetzung: der GitHub-Token braucht "Contents: Read and write".
3. Beim Laden der Seite wird `habits-data.json` gelesen (funktioniert ohne Token, da
   öffentliche Datei über GitHub Pages) und mit dem lokalen Stand abgeglichen: beide
   Seiten tragen einen Zeitstempel (`updatedAt`), der bei jeder Änderung aktualisiert
   wird — beim Laden gewinnt schlicht der neuere komplette Stand. Dadurch synct auch
   ein **Entfernen** eines Häkchens korrekt auf andere Geräte (vorheriges Verhalten:
   ein additiver Merge, bei dem ein einmal gesetztes Häkchen nie wieder verschwinden
   konnte). Einzige Einschränkung: ändert man auf zwei Geräten annähernd gleichzeitig
   etwas, ohne zwischendurch zu syncen, gewinnt der Stand mit dem späteren Zeitstempel
   vollständig — die dazwischen verpasste Änderung des anderen Geräts geht verloren.

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

**Läuft komplett im Browser, kein Server nötig:** Anders als Notion erlaubt Googles
Calendar-API direkte Aufrufe aus dem Browser (CORS ist erlaubt), dafür läuft die
Autorisierung über einen waschechten OAuth2-Consent-Popup (Google Identity Services)
statt eines simplen API-Keys.

**Speicherung:** Der Access-Token lebt nur ~1 Stunde und wird lokal (`localStorage`)
zwischengespeichert, aber bewusst **nicht** automatisch im Hintergrund erneuert — das
würde einen Popup ohne Klick brauchen, den die meisten Browser sowieso blockieren.
Läuft ein Token ab, reicht ein erneuter Klick auf "Kalender verbinden".

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
   (`....apps.googleusercontent.com`) — kein Client-Secret nötig, das ist ein reiner
   Browser-Client.
4. Beim ersten Klick auf "Kalender verbinden" im Dashboard fragt dich ein Prompt einmalig
   nach dieser Client-ID und merkt sie sich pro Browser/Gerät in `localStorage` — genauso
   wie beim GitHub-Token für den Sync-Button. Alternativ direkt in `data.js` unter
   `googleCalendar: { clientId: "..." }` eintragen, dann entfällt der Prompt.
5. Direkt danach öffnet sich Googles Consent-Popup (Login + Berechtigung erteilen) —
   danach lädt das Dashboard deine heutigen Termine.

**Kalender-ID für den eingebetteten "Ganzer Kalender"-Link:** wird nach dem Verbinden
automatisch über die API ermittelt (deine `primary`-Kalender-ID, meist deine
Gmail-Adresse) und lokal gemerkt. Optional in `data.js` unter
`googleCalendar: { calendarId: "du@gmail.com" }` fest eintragen, falls du einen anderen
Kalender als deinen Haupt-Kalender einbetten willst.

## Tages-To-Do

Trägst du direkt im Dashboard ein (drei Spalten: Business, Studium & Job,
Privates). Wird im Browser gespeichert (`localStorage`) und setzt sich jeden
Tag automatisch zurück. Der aktuelle Tagesstand wird zusätzlich per Cloud-Sync
geräteübergreifend gehalten (siehe unten) — ein Reset auf einem Gerät um
Mitternacht überschreibt dabei nicht den Stand eines anderen Geräts, das den
Tag noch nicht gewechselt hat: die Cloud-Kopie trägt das jeweilige Datum und
wird nur übernommen, wenn es mit dem heutigen Datum übereinstimmt.

**Nicht abgehakte Punkte verfallen nicht** — beim nächsten Laden des
Dashboards an einem neuen Tag wandert jeder noch offene (nicht abgehakte)
Punkt aus dem alten Tages-To-Do automatisch nach "Aufgaben" (siehe unten), wo
er dauerhaft stehen bleibt statt zu verschwinden. Abgehakte Punkte verfallen
wie bisher einfach mit dem Tageswechsel.

## Aufgaben

Direkt unter dem Tages-To-Do, aber bewusst getrennt gespeichert (eigener
`localStorage`-Key ohne Datum) — im Gegensatz zum Tages-To-Do **kein täglicher
Reset**. Einträge bleiben stehen, bis du sie abhakst; nach dem Abhaken werden
sie automatisch (kurz sichtbar durchgestrichen) aus der Liste entfernt. Läuft
ebenfalls über den Cloud-Sync (siehe unten). Sammelt zusätzlich automatisch
alles, was aus dem Tages-To-Do vergangener Tage nicht abgehakt wurde (siehe
oben).

## Cloud-Sync: Video-Ideen / Studium-Termin / Tages-To-Do / Aufgaben

Diese vier kleinen, unabhängigen Felder teilen sich eine gemeinsame Cloud-Datei
(`sync-data.json`) und funktionieren nach demselben Prinzip wie der
Habit-Tracker oben:

1. **Sofort lokal** (`localStorage`) bei jeder Änderung — funktioniert immer,
   auch offline.
2. **Cloud-Kopie in `sync-data.json`** im Repo — automatisch, ca. 2,5 Sekunden
   nach der letzten Änderung (siehe Abschnitt "Auto-Sync" unten), sobald einmal
   ein GitHub-Token hinterlegt ist. Läuft daneben auch am "Sync"-Button oben
   rechts mit. Voraussetzung: der GitHub-Token braucht "Contents: Read and
   write" (siehe Abschnitt "Sync-Button" oben).
3. Beim Laden der Seite wird `sync-data.json` gelesen (kein Token nötig) und
   pro Feld einzeln mit dem lokalen Stand abgeglichen: jedes Feld trägt einen
   eigenen Zeitstempel (`updatedAt`), und der jeweils neuere komplette Stand
   gewinnt. Beim Tages-To-Do zählt zusätzlich das Datum — ein Cloud-Stand von
   einem anderen Tag wird ignoriert, da der tägliche Reset ohnehin lokal über
   den datumsbasierten Storage-Key läuft.

**Einschränkung:** wie beim Habit-Tracker gilt "neuester Zeitstempel gewinnt
komplett" pro Feld — änderst du z.B. dieselbe Video-Idee auf zwei Geräten
annähernd gleichzeitig, ohne dazwischen zu syncen, geht eine der beiden
Fassungen verloren. Bei normaler Nutzung (ein Gerät nach dem anderen) fällt
das nicht ins Gewicht.

## Auto-Sync

Damit du nicht nach jeder Kleinigkeit auf "Sync" klicken musst: jede Änderung
am Habit-Tracker, an Video-Ideen, Studium-Termin, Tages-To-Do oder Aufgaben
löst automatisch (debounced, ca. 2,5s nach der letzten Änderung in genau
diesem Bereich) einen Push in die Cloud aus — **aber nur für die eine Datei,
die den geänderten Bereich enthält** (`habits-data.json` *oder*
`sync-data.json`, nie beide auf einmal, wenn sich nur ein Bereich geändert
hat). Der aktuelle Stand steht klein oben rechts neben dem "Sync"-Button
("☁️ Automatisch gesichert · HH:MM").

**Voraussetzungen und Einschränkungen:**
- Läuft nur, wenn auf diesem Gerät **schon einmal ein GitHub-Token hinterlegt
  wurde** (z.B. durch einen früheren manuellen Sync-Klick). Ohne Token bleibt
  alles beim Alten: sofort lokal gespeichert, Cloud erst beim nächsten
  manuellen Klick. So gibt es beim allerersten Eintrag auf einem neuen Gerät
  keinen überraschenden Token-Prompt mitten in der Nutzung.
- Der **"Sync"-Button selbst bleibt bewusst manuell/täglich** — er stößt
  zusätzlich den GitHub-Actions-Workflow für die Business-Daten an
  (Bricklink/YouTube/TikTok/Notion, 15–30s Laufzeit, externe API-Aufrufe).
  Eine Habit-Änderung soll nicht nebenbei diesen Workflow mit anstoßen.
- **Mehr Commits im Repo:** da jede Änderung (statt gesammelt beim
  Sync-Klick) einen eigenen Commit erzeugt, wächst die Commit-Historie von
  `habits-data.json`/`sync-data.json` entsprechend schneller — funktional
  unproblematisch, aber sichtbar in der Historie.
- **GitHub-API-Limit:** 5.000 Anfragen/Stunde pro Token — bei normaler
  persönlicher Nutzung (auch bei reger Habit-/To-Do-Pflege) realistisch nie
  erreichbar.
- Schließt du den Tab **innerhalb der 2,5s-Wartezeit**, bevor der Push
  rausgegangen ist, geht die letzte Änderung nur cloud-seitig verloren (lokal
  bleibt sie immer erhalten) — betrifft nur den seltenen Fall "Änderung, dann
  sofort Tab schließen".

## PWA ("Zum Homescreen hinzufügen")

Sobald das Dashboard über GitHub Pages (oder einen anderen https-Server) läuft,
bietet Chrome/Edge auf Android automatisch "App installieren" an; auf dem iPhone
geht es über Safari → Teilen → "Zum Home-Bildschirm". Technisch dahinter:
`manifest.webmanifest` (App-Name, Farben, Icon) + `sw.js` (Service Worker).

Der Service Worker ist bewusst simpel gehalten: **network-first** für alle
Dateien inklusive `data.js` — das Netzwerk hat immer Vorrang, der Cache dient
nur als Fallback ohne Internetverbindung. So gibt es nie veraltete Zahlen durch
einen zu aggressiven Cache.

Das App-Icon (`icon.svg`) ist ein einfaches generiertes SVG im Farbschema des
Dashboards. Für optimale iOS-Darstellung kannst du es bei Bedarf einmal extern
in eine PNG-Datei (z.B. 180×180) umwandeln und den `apple-touch-icon`-Link in
`index.html` darauf zeigen lassen — notwendig ist das aber nicht, die App
funktioniert auch mit dem SVG.
