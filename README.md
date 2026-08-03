# Kilian – Dashboard

Statisches HTML/CSS/JS-Dashboard mit Überblick über Bricklink, Bricks On The Floor,
The Brainwalkers, 2026-Ziele, Zeit-Balance und Tages-To-Do. Installierbar als PWA
("Zum Homescreen hinzufügen"). Keine Frameworks, kein Build-Schritt.

## Dateien

- `index.html`, `styles.css`, `script.js` — das Dashboard selbst
- `data.js` — alle Inhalte/Zahlen. Manuelle Felder trägst du hier von Hand ein;
  automatisierte Felder werden von den Skripten überschrieben (siehe unten)
- `scripts/sync-all.mjs` — zieht **alle** automatisierbaren Daten und schreibt sie
  in `data.js`. Ruft die drei Fetcher in `scripts/fetchers/` auf:
  - `time-tracker.mjs` — Notion "Zeittracker" (Zeit-Balance-Sektion)
  - `youtube.mjs` — YouTube-Abonnenten/Video-Anzahl/letztes **Longform**-Upload-Datum
    (Bricks On The Floor, The Brainwalkers) → speist auch die Upload-Rhythmus-Ampel
  - `bricklink.mjs` — offene Bricklink-Bestellungen (Versand-Alarm) + Umsatz pro Woche
    und pro Monat (Umsatz-Trend-Charts)
- `.github/workflows/sync-all.yml` — automatischer Sync jeden Tag um 08:00 Uhr
  (plus manuell auslösbar über den Sync-Button im Dashboard oder den Actions-Tab)
- `manifest.webmanifest`, `icon.svg`, `sw.js` — machen das Dashboard als PWA installierbar

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
| Views/Wiedergabezeit/Umsatz (28 Tage) | — | ❌ manuell (siehe unten, warum) |
| Bricklink Store-Besuche, Feedback gesamt, Drive-Thru-Mails, Ohne Feedback | — | ❌ manuell (siehe unten, warum) |
| Ziel-Fortschritt (Umsatz, Monetarisierung) | — | ❌ manuell |
| Nächste Video-Idee | — | eigene Notiz, nur im Browser (siehe unten) |

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
- "Permissions" → "Actions" → **"Read and write"**, sonst nichts

Dieser Token landet **nirgends im Code oder Repo** — er wird nur einmal im
Browser abgefragt und lokal in `localStorage` auf deinem eigenen Gerät gespeichert.
Ein Token mit voller Repo-Berechtigung würde ich hier nicht eintragen; die
fine-grained Variante oben kann wirklich nur Workflows anstoßen, sonst nichts.

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

Kleines Notizfeld auf den beiden YouTube-Karten. Speichert automatisch (500ms
nach dem letzten Tastendruck) im Browser (`localStorage`) — bewusst kein
Sync-Feld in `data.js`, das wäre für eine spontane Notiz zu viel Umweg.

## Tages-To-Do

Trägst du direkt im Dashboard ein (drei Spalten: Business, Studium & Job,
Privates). Wird im Browser gespeichert (`localStorage`) und setzt sich jeden
Tag automatisch zurück.

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
