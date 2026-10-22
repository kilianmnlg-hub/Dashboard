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
    (Bricks On The Floor, The Brainwalkers) → speist auch die Upload-Rhythmus-Ampel und erkennt neue Videos für die After-Upload-Checkliste
  - `tiktok.mjs` — TikTok-Follower (@bricksonthefloor) per Profilseiten-Scrape
  - `bricklink.mjs` — offene Bricklink-Bestellungen (Versand-Alarm) + Umsatz pro Woche
    und pro Monat (Umsatz-Trend-Charts)
- `.github/workflows/sync-all.yml` — automatischer Sync jeden Tag um 08:00 Uhr
  (plus manuell auslösbar über den Sync-Button im Dashboard oder den Actions-Tab)
- `.github/workflows/check-uploads.yml` — stündlicher Schnellcheck auf neue YouTube-Videos (schreibt `data.js` nur, wenn eines dazugekommen ist), siehe Abschnitt "After-Upload-Checkliste"
- `scripts/lib/uploads.mjs` — Vergleich der abgerufenen Videos mit dem letzten Stand (welches Video ist neu?), ohne Node-Abhängigkeiten
- `manifest.webmanifest`, `icon-*.png`, `sw.js` — machen das Dashboard als PWA installierbar
- `scenery.js` — Pixel-Dschungel: das animierte Pixelbild hinter der Brain-Karte (und als Streifen über einigen Bereichen) mit den Easter Eggs (siehe Abschnitt "Pixel-Dschungel")
- `guests.js`, `guests-data.js` — Pixel-Gäste: 255 Film-, Serien- und Spielfiguren als Easter Eggs im Dashboard mit Skilltree (siehe Abschnitt "Pixel-Gäste"); `guests-data.js` ist erzeugt (Sprites und Level-Themen)
- `palette.js` — Schnellsuche und Befehle (siehe Abschnitt "Schnellsuche")
- `msgseen.js` — merkt sich, welche Bricklink-Nachrichten du geöffnet hast (siehe Abschnitt "Ungelesene Nachrichten")
- `afterupload.js` — After-Upload-Checkliste: erscheint ganz oben, sobald ein neues Video erkannt wird (siehe Abschnitt "After-Upload-Checkliste")
- `room.js` — Anbindung des Minigames "Mein Raum" (Kachel, Stunden und Level, Spielstand in der Cloud, Spiel als Vollbild-Overlay; siehe Abschnitt "Mein Raum")
- `raumspiel/index.html` — das Minigame selbst: ein eigenständiges isometrisches Pixelspiel in einer einzigen Datei (gebaut aus dem Spiele-Projekt, Quellcode liegt dort); `raumspiel/vorschau.png` ist das Kachelbild, bis dein eigener Raum gespeichert ist
- `training.js` — Training: Trainingsplan, Workout-Modus und Verlauf mit Statistiken, mit selbst gezeichneten Pixel-Symbolen (siehe Abschnitt "Training")
- `training-data.json` — Cloud-Datei des Trainings (Pläne, Einheiten, eigene Übungen); entsteht beim ersten Speichern und wird direkt aus dem Browser aktualisiert
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
| Ungelesene Bricklink-Nachrichten (nur Nachrichten zu Bestellungen) | Bricklink API + dein Abhaken im Dashboard | ✅ automatisch, siehe Abschnitt "Ungelesene Nachrichten" |
| Bricklink Store-Besuche, Feedback gesamt, Drive-Thru-Mails, Ohne Feedback | — | ❌ manuell (siehe unten, warum) |
| Ziel-Fortschritt (Umsatz) | — | ❌ manuell |
| Nächste Video-Idee | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Nächste Prüfung/Abgabe (Studium) | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Tages-To-Do | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Aufgaben (persistent) | — | eigene Notiz, ✅ Cloud-Sync über Sync-Button (siehe unten) |
| Training (Pläne, Einheiten, eigene Übungen) | — | eigene Daten, ✅ Cloud-Sync automatisch und über den Sync-Button, dazu lokale Kopie am Gerät (siehe Abschnitt "Training") |

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

## Ungelesene Nachrichten (Bricklink)

Die Bricklink-API kennt **keinen allgemeinen Posteingang**, nur die Nachrichten zu einzelnen Bestellungen (`GET /orders/{id}/messages`), und sie verrät **nicht, was du in
Bricklink schon gelesen oder geöffnet hast**: die Nachrichten haben nur `body`, `dateSent`, `from`, `messageID`, `subject` und `to`, die Bestellungen gar kein Lese-Feld
(`GET /notifications` liefert nur ungelesene Push-Meldungen an Programme, keinen Lesestatus deines Postfachs). Deshalb teilen sich zwei Stellen die Arbeit:

1. **Der Sync** (`scripts/fetchers/bricklink.mjs`) prüft bei jedem Lauf die noch nicht abgeschlossenen Bestellungen und alle der letzten 120 Tage (neueste zuerst, höchstens 150
   Abfragen) und listet die **offenen Käufer-Nachrichten** einzeln auf: alle Nachrichten des Käufers nach der letzten Nachricht des Shops. Das Ergebnis steht in
   `data.bricklinkMessages` (`items` = je Nachricht Bestellnummer, Nachrichten-ID und Zeitpunkt, höchstens 10 je Bestellung und 120 insgesamt; `unanswered` = Zahl der Bestellungen
   mit offener Nachricht, dazu `checkedOrders`, `ordersWithMessages`, `failed`, `fields`, `checkedAt`, `lastError`). Es werden nie Inhalte oder Namen gespeichert, weil das Repo öffentlich ist.
2. **Das Dashboard** (`msgseen.js`) merkt sich, welche dieser Nachrichten du **geöffnet** oder abgehakt hast. **Ungelesen** heißt: offene Käufer-Nachricht, die du noch nicht
   geöffnet hast. Antwortest du in Bricklink, verschwindet die Nachricht beim nächsten Sync von selbst, weil dann die letzte Nachricht vom Shop kommt.

- **Hinweis ganz oben:** "Bricklink: N Nachrichten ungelesen" mit einer Marke je Bestellung (`#Bestellnummer · Anzahl`). Ein Klick auf die Marke öffnet die Bestellung in Bricklink
  (neuer Tab) und hakt ihre Nachrichten ab, "ALLE GELESEN" hakt alles auf einmal ab (für Nachrichten, die du direkt in Bricklink geöffnet hast). Das Kreuz blendet den Hinweis nur für
  die Sitzung aus.
- **Karte Bricklink:** Zeile "Nachrichten ungelesen" mit derselben Zahl (Stand des letzten Syncs minus deine Häkchen).
- **Wo das Abhaken liegt:** in der Cloud (Feld `msgSeen` in `sync-data.json`: Liste der Nachrichten-IDs, höchstens 300), damit Handy und PC dasselbe wissen. Es wird nur vereinigt, nie
  zurückgenommen; solange nichts abgehakt ist, fehlt das Feld.
- **Bis zum ersten Sync mit Einzelnachrichten** (nach dem Update) kennt `data.js` die Liste noch nicht: dann steht weiter die bisherige Zahl als "unbeantwortet", ohne Marken. Einmal
  Sync drücken (oder den täglichen Lauf abwarten), danach erscheint "ungelesen".
- **Nicht erfasst:** Nachrichten, die nicht zu einer Bestellung gehören (z.B. Fragen vor dem Kauf), und Nachrichten zu Bestellungen, die älter als 120 Tage und abgeschlossen sind.
- Der Link nutzt `https://www.bricklink.com/orderDetail.asp?ID=<Bestellnummer>`; ändert Bricklink diese Adresse, steht sie als `BL_ORDER_URL` in `script.js`.
- Schlägt die Abfrage fehl (z.B. fehlende Berechtigung), bleibt der letzte gute Stand stehen und `lastError` nennt den Grund; der Rest des Syncs läuft normal weiter.
- Einstellbar über Umgebungsvariablen im Workflow: `BRICKLINK_MESSAGES=off` (abschalten), `BRICKLINK_MESSAGE_DAYS`, `BRICKLINK_MESSAGE_MAX_ORDERS`.

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

## After-Upload-Checkliste

Sobald auf einem der beiden Kanäle ein **neues Longform-Video** erscheint, zeigt das Dashboard ganz oben (über dem Brain-Bild) das Fenster "After Upload" mit einer Checkliste für genau
dieses Video. Shorts lösen sie nicht aus. Der Code steht in `afterupload.js`.

**Die Standardliste** (drei Gruppen; die Reihenfolge und alle Texte lassen sich ändern):

| Gruppe | Punkt |
|---|---|
| Auf YouTube | Titel und Thumbnail prüfen · Beschreibung: Kapitel, Links, Hashtags · Playlist zuordnen, Untertitel prüfen · **End Screen** und Karten setzen · **Kommentar** schreiben und anheften · **Post** im Community-Tab veröffentlichen |
| Verbreiten | **Short** schneiden und hochladen · **Instagram** (Reel oder Story, Link in Bio) · **Facebook** (Seite und Gruppen) · TikTok |
| Danach | Kommentare beantworten (erste Stunden) · nach 24 Stunden Klickrate und Zuschauerbindung ansehen · nächste Video-Idee festlegen |

**Bedienung:**
- Punkt anklicken = abgehakt (Fortschritt "4 / 13" und Balken oben, die Kennzahl steht auch in der Titelzeile, wenn das Fenster eingeklappt ist). Bei den meisten Punkten führt der kleine Pfeil
  direkt an die richtige Stelle in **YouTube Studio** (Details, Editor mit End Screen und Karten, Kommentare, Analytics) bzw. auf die Videoseite; "Nächste Video-Idee" springt zur Ideen-Liste des Kanals.
- **Link kopieren** legt `https://youtu.be/<ID>` in die Zwischenablage (für Instagram, Facebook und Co.), **Im Studio öffnen** öffnet die Videodetails.
- **Liste anpassen:** Texte umbenennen, mit ▲ ▼ verschieben, mit × löschen, unten neue Punkte hinzufügen, "Standard wiederherstellen" setzt alles zurück. Gilt für alle Videos beider Kanäle;
  schon gesetzte Haken bleiben, weil sie am Punkt hängen, nicht an der Position.
- **Fertig:** Sind alle Punkte abgehakt, steht kurz "ALLES ERLEDIGT" und das Fenster verschwindet. **Schließen** blendet die Liste auch mit offenen Punkten aus. Beides ist endgültig für dieses Video;
  ohne Zutun verschwindet die Liste nach 7 Tagen.
- **Wieder öffnen:** Button "After-Upload-Checkliste" in den Karten Bricks On The Floor und The Brainwalkers (öffnet die Liste des letzten Videos dieses Kanals, auch wenn sie schon erledigt war) oder
  Strg+K → "After-Upload-Checkliste öffnen".
- **XP:** 3 XP je Punkt (jeder nur einmal je Video, auch nach Abhaken und Wiederabhaken) und +15 XP, wenn die ganze Liste fertig ist (siehe Level-System).

**Wie ein neues Video erkannt wird:**
1. `youtube.mjs` speichert in `data.business.<Kanal>.recentUploads` die letzten Longform-Videos (`id`, `title`, `at` = Veröffentlichung, `detectedAt`). Ein Video bekommt `detectedAt` (Zeitpunkt der Entdeckung),
   wenn es im Stand des letzten Abrufs noch nicht stand **und** neuer ist als alles dort (`scripts/lib/uploads.mjs`). Beim allerersten Abruf wird nur der Stand gemerkt: **alte Videos lösen keine Liste aus,
   erst das nächste neue.** Für das letzte bekannte Video gibt es die Liste über den Button in der Kanal-Karte.
2. Der Abruf läuft **stündlich** (`check-uploads.yml`, Minute 17; GitHub startet geplante Läufe manchmal einige Minuten später), beim **täglichen Sync** um 08:00 und bei jedem Druck auf den **Sync-Knopf**.
   Der Stundencheck fragt nur YouTube (3 Abfragen je Kanal) und schreibt `data.js` nur, wenn ein neues Video dabei ist, sonst gibt es keinen Commit. Er braucht dasselbe Secret wie der Sync (`YOUTUBE_API_KEY`).
3. Die Seite liest `data.js` beim Laden: nach dem Hochladen also **einmal neu laden** (oder Sync drücken und danach neu laden), dann steht die Liste oben. Sie erscheint erst, wenn die Cloud geladen ist.

**Speicherung:** In der Cloud (Feld `afterUpload` in `sync-data.json`): je Video die Haken mit Zeitstempel (`lists.<Video-ID>.d`), dazu `x` (geschlossen), `c` (erledigt) und `u` (zuletzt geändert), und die
angepasste Vorlage (`items`, Zeitstempel `tAt`). Je Video gewinnt der neuere Stand, die Vorlage nach ihrem eigenen Zeitstempel. Listen älter als 90 Tage werden aufgeräumt; solange nichts abgehakt oder
angepasst wurde, fehlt das Feld.

**Grenzen:** Die Liste erscheint nur für Videos, die YouTube öffentlich zeigt (kein Entwurf, kein privates Video); ein geplantes Video bekommt sie, sobald es live geht. Links in YouTube Studio öffnen sich im
zuletzt benutzten Google-Konto des Browsers. Das Posten auf Instagram, Facebook und TikTok kann das Dashboard nicht für dich übernehmen: diese Punkte sind Erinnerungen.

## Nächste Video-Idee

Auf beiden YouTube-Karten: eine kleine Ideen-Liste statt eines einzelnen
Notizfelds. Eine Idee ist farblich hervorgehoben als "die nächste
Video-Idee"; darunter der Rest als "Weitere Ideen", der eingeklappt ist (mit der
Anzahl daneben) und erst per Klick aufgeht. Beim Laden ist er immer zu, damit nur
die nächste Idee zu sehen ist. Welche Idee oben steht,
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

### Verlaufskurve in den Kanal-Karten

In den Karten "Bricks On The Floor" und "The Brainwalkers" (Business-KPIs) zeichnet sich unter der Abonnenten-Zeile eine Kurve der Abonnenten, Linie mit Fläche und
einem Endpunkt (Farbe je Kanal). Sie nutzt dieselben Tageswerte aus `metricsHistory` (`bricksOnTheFloorAbos`, `brainwalkersAbos`, bis zu 60 Tage), also keine
neue Datenquelle. Darüber steht der Zuwachs im Zeitraum, darunter Datum und Wert am Anfang und am Ende. Der Wert eines einzelnen Tages erscheint beim
Darüberfahren oder Antippen und mit den Pfeiltasten (← → Home Ende) auf der fokussierten Kurve. Ohne mindestens zwei Tageswerte erscheint keine Kurve.
Die Bricklink-Karte und der Umsatz-Trend bleiben unverändert (Code: `buildSparkline()` und `bindSparkline()` in `script.js`, Block "Verlaufskurve" in `styles.css`).

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

### Einheitliche Bausteine (Variablen in `styles.css`)

Schriftgrößen, Ecken, Ränder, Schatten und feste Farben kommen aus Variablen ganz oben in `styles.css` (Block "Bausteine: gemeinsame Werte").
Neue Regeln nehmen immer diese Variablen und nie einen eigenen Pixelwert:

- **Schriftstufen** `--fs-8 / 10 / 12 / 14 / 16 / 18 / 20 / 24 / 30`. Pixelschrift (Press Start 2P) nur 8 / 10 / 12 / 16 / 24 und nie kleiner
  als 8 px, Lesetext nie kleiner als 12 px, Eingaben 16 px. Fließende Überschriften dürfen `clamp()` benutzen.
- **Ecken und Rand:** `--r` (3 px, eckig), `--r-round` (Kreise), Rand immer 2 px (`--bw`).
- **Schatten** in drei Stufen: `--sh-s` (2 px, Chips), `--sh-m` (3 px, Knöpfe, Menüs, Hinweise), `--sh-l` (5 px, am Handy 4 px, Karten und Fenster),
  zusammen mit der Farbe, z.B. `box-shadow: var(--sh-m) var(--pxs)`. Gedrückt = `none` plus `transform: translate(3px, 3px)`.
- **Farben:** alles aus der Farbtabelle (`--surface`, `--accent`, `--ok`, `--warn`, `--bad`, `--gold`, Pixel-Symbole `--spr-*` usw.). Für Text gibt es
  die kontraststarken `--ok / --warn / --bad` (hell und dunkel), `--status-*` sind für Flächen.
- **Bedienbarkeit:** `button, input, select, textarea` erben die Schrift der Seite; Fokus-Rahmen überall `var(--focus)` (Gold, 3 px); auf Touch-Geräten sind
  Knöpfe mindestens `--tap` (44 px) hoch.
- Das Skript `normalize_css.py` (Ordner `ui-bausteine` im Arbeitsordner) stellt alte Einzelwerte automatisch auf diese Stufen um.

## Reality-Check bei den Zielen und Achtung-Banner

**Reality-Check:** Jede Zielkarte zeigt unter dem Ring das nötige Tempo bis zur Frist (z.B. "244/Tag"), dein aktuelles Tempo, die
Prognose zur Frist und einen Status: AUF KURS (ab 97 % des Ziels), KNAPP DAHINTER (ab 90 %), DAHINTER (ab 70 %) oder ZU WEIT WEG.
Das Tempo kommt bei Abos und Followern aus `metricsHistory` (letzte 28 Tage, mindestens 7 Tage Verlauf), bei den Longform-Videos
aus dem Upload-Rhythmus des Kanals. Ohne Messwerte (z.B. Umsatz, Bricklink-Teile) steht nur die Zeile "nötig".

**Achtung-Banner:** Ganz oben, wie der Versand-Alarm, erscheinen weitere wegklickbare Hinweise: überfälliger Longform-Upload je Kanal
(rot ab 1,5-fachem Rhythmus, sonst gelb; Shorts zählen nicht) und ungelesene Bricklink-Nachrichten (live aus `data.bricklinkMessages` abzüglich deines Abhakens, siehe "Ungelesene Nachrichten"; bei 0 erscheint kein Hinweis).
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
- **Kurzbefehle am Handy-Icon (Android):** Langes Drücken auf das App-Icon bietet "Schnelle Notiz", "YouTube-Timer starten", "Einkaufsliste" und "Training"
  (`shortcuts` im Manifest, Aufruf als `?action=note`, `?action=timer-youtube`, `?action=shopping`, `?action=training`). Ausgeführt wird erst, wenn die Cloud geladen ist,
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

## Schnellsuche (Strg+K)

Mit **Strg+K** (Mac: Cmd+K), mit **/** (wenn gerade kein Feld aktiv ist) oder mit der Lupe in der Kopfleiste öffnet sich ein Fenster zum Suchen und für
Befehle. Am Handy füllt es den ganzen Bildschirm (ab 350 px Breite gibt es die Lupe oben).

- **Suchen:** findet Bereiche und Einträge aus dem sichtbaren Text des Dashboards: Tages-To-Dos, Aufgaben, Remote Tasks, Einkauf (Liste, Vorrat, Rezepte),
  Habits, Ziele, Notizen, Video-Ideen und Training. Ein Treffer klappt den Bereich auf, scrollt hin und hebt den Eintrag kurz hervor.
- **Befehle:** Timer YouTube/Bricklink starten oder stoppen, Training starten (oder das laufende Workout fortsetzen), neue Notiz, Design wechseln, synchronisieren,
  Pixel-Gäste und Skilltree öffnen.
- **Anlegen:** zu jedem Text gibt es "Zum Einkauf hinzufügen" (erkennt Menge und Preis, z.B. `2x Milch 1,15`), "Aufgabe anlegen", "To-Do für heute anlegen"
  (die Kategorie wählst du im zweiten Schritt) und "Notiz speichern". Damit nichts aus Versehen angelegt wird, stehen diese Aktionen unter den Treffern und sind erst
  vorgewählt, wenn du das Wort davor schreibst: `einkauf milch`, `aufgabe Steuer sortieren`, `todo Wäsche`, `notiz Idee`.
- **Bedienung:** ↑ ↓ wählen, Enter führt aus, Esc geht einen Schritt zurück oder schließt. Der Tabulator bleibt im Fenster, danach springt der Fokus zurück.
- **Technik:** Gespeichert wird über die vorhandenen Eingaben und Boards (Einkaufsfeld, Aufgabenfeld, Notiz-Eingang, Tages-To-Do), deshalb gelten Cloud-Sync, XP und
  Pixel-Gäste wie bei einer Eingabe von Hand. Solange die Cloud-Daten laden (oder nicht erreichbar sind), sind Anlegen und Timer gesperrt, wie die ganze Seite.
  Die Suche selbst speichert nichts.

## Mein Raum (Minigame)

Bereich "Mein Raum" (Menü "Raum"): Ein eigenständiges isometrisches Pixelspiel, in dem du mit deinen gesammelten **Stunden** einen Raum (und später ganze Wohnungen) einrichtest. Alle Teile sind selbst gezeichnet (kein fremdes Material).
Im Dashboard steht nur eine Kachel (Vorschaubild deines Raums, Stunden zum Ausgeben, Level, nächste Freischaltung); "Raum öffnen" startet das Spiel als Vollbild-Overlay, der Haus-Knopf im Spiel (oder die Zurück-Taste) bringt dich zurück.

- **Stunden = Geld, aber nur seit dem 1. Oktober 2026:** Es zählt die Zeit aus dem **Zeittracker** (Notion-Verlauf und im Dashboard erfasste Zeiten, ohne laufende Timer) und die Dauer beendeter **Trainingseinheiten** (eine Einheit höchstens 3 Stunden), jeweils ab dem 1. Oktober 2026. Guthaben = so verdient minus alles, was du im Raum ausgegeben hast. Verkaufen gibt den vollen Preis zurück.
- **Level schalten frei:** Das Level kommt aus dem Level-System (XP, siehe unten). Mit jedem Level werden mehr Möbel, Böden, Wände, Haustiere und Kleidung freigeschaltet (im Spiel "ab Lv N"); die Teile selbst kaufst du dann mit Stunden.
- **Im Spiel:** Möbel kaufen, ziehen, drehen, ins Lager legen; Räume anbauen; Boden und Wände teilweise ändern; eine Figur, die selbstständig durch die Räume läuft, liest, schläft, trainiert, und die du mit Stunden anziehst; Haustiere, die von allein herumlaufen; Figur und Tiere laufen um Möbel herum statt hindurch. Schränke lassen sich öffnen (Klick) und öffnen sich von selbst, wenn du ein Kleinteil darüber hältst: so stellst du Kleinkram (Kategorie "Fürs Regal") direkt in Regale und Schränke. Die Bedienung steht im Spiel (Hinweise unten im Bild).
- **Verteidigung (Kampagne):** Der Schwert-Knopf ("Verteidigen") im Raum öffnet ein zweites Spiel im Querformat: Dein Haus steht links, du verteidigst es mit deiner Figur gegen Monster von rechts. Zuerst wählst du eine von fünf Steinzeit-Stufen (Lagerfeuer-Tal, Nebelwald, Aschefeld, Echsensumpf, Säbelzahn-Höhle; die nächste öffnet sich mit mindestens einem Stern) und die Schwierigkeit (Leicht, Normal, Schwer). Keule und Schleuder greifen von allein an, der Steinhagel hat einen Knopf mit Abklingzeit, Antippen schickt die Figur dorthin (am PC A/D und Leertaste). Es kommen Raptorlinge, Wollnashörner, Spuckechsen (Säure im Bogen) und Flugsaurier; am Ende jeder Stufe wartet ein Boss mit drei Phasen. Beute (Fell, Knochen, Feuerstein) und Erfahrung machen deinen Helden stärker (Held-Level, Obergrenze das Doppelte deines Dashboard-Levels); Sterne gibt es nach dem Zustand des Hauses. Der Stand liegt im Spielstand des Raums (Feld `def`) und wandert mit in die Cloud; die Kachel zeigt die Zeile „Verteidigung · Steinzeit · Held Lv N“. Jede Stufe hat ihre eigene Welt (Lagerfeuer-Tal, Nebelwald, Aschefeld, Echsensumpf, Säbelzahn-Höhle); das Bild ist breiter als früher und das Haus steht halb am linken Rand, damit mehr Platz zum Spielen bleibt. Dein Held ist kleinköpfiger und dem Raum-Charakter ähnlicher und hat neue Bewegungen (Gehen, Rennen, Sprung nach dem Sieg). Mit dem Knopf „Ausrüstung“ kaufst du mit Stunden (gemeinsamer Topf mit dem Raum, Kauf mit Rückfrage) Waffen (Keule, Steinaxt, Speer; Schleuder, Steinbogen, Feuertopf), Rüstung (Fellweste, Knochenpanzer), Kopfschutz (Lederkappe, Knochenhelm) und Fähigkeiten (Steinhagel, Kriegsschrei, Heilfeuer; bis zu drei Plätze je nach Held-Level). Verbessern geht bis +10 mit Material (+8 % Wirkung je Stufe), alles ist am Helden sichtbar. Haustiere als Begleiter und weitere Zeitalter folgen (Plan: `PLAN_VERTEIDIGUNG.md` im Spiele-Projekt). Der Kampf selbst ändert deinen Raum nicht; Stunden kosten nur die Käufe.
- **Querformat auf dem Handy:** Das Dashboard selbst ist als installierte Verknüpfung auf Hochformat festgelegt (`orientation` in `manifest.webmanifest`). „Raum öffnen“ stellt das Spiel dagegen sofort quer (Standard), damit du auch den Raum quer einrichten kannst: `room.js` sperrt beim Öffnen die Ausrichtung (`screen.orientation.lock('landscape')`, im Browser-Tab zusammen mit Vollbild) und gibt sie beim Verlassen wieder frei. Der Knopf mit dem Handy-Symbol oben rechts im Spiel wechselt zwischen quer und hochkant und merkt sich die Wahl (Browser-Speicher `dashboard-room-orient`). Klappt die Sperre nicht (z. B. iPhone), erscheint die Auswahl „Oben links / Oben rechts / Hochkant bleiben“: Dann dreht `room.js` das Bild des Spiels selbst (CSS auf dem iframe), du hältst das Handy quer und die Seite wird gemerkt (`dashboard-room-rot`). Der Kampf nutzt dieselbe Ausrichtung; steht der Raum hochkant, fordert er sie für sich an.
- **Speicherung:** In der Cloud (Feld `room` in `sync-data.json`: der ganze Spielstand plus ausgegebene Stunden). Der neuere Stand gewinnt (ganzer Raum); solange noch nichts gespeichert wurde, fehlt das Feld. Gespeichert wird beim Ändern (gebündelt) und beim Verlassen des Spiels. Das Vorschaubild der Kachel liegt nur im Browser. Nur das Dashboard schreibt in die Cloud, das Spiel selbst kennt keinen Token.
- **Technik:** `raumspiel/index.html` ist eine einzelne Datei (Voxel-Modelle als Pixel-Sprites, Licht und Tageszeit, Wegfindung). Sie läuft im iframe und spricht per `postMessage` (nur gleiche Herkunft) mit `room.js`: `hello`, `init` (Stunden, Level, Spielstand), `save`, `economy`, `flush`, `close`. Ohne Dashboard (direkt geöffnet) läuft das Spiel mit Demo-Stunden und Speicherstand im Browser.

## Level-System (XP)

Der Level startete am 09.10.2026 bei 0. Jedes Abhaken gibt Punkte (XP), die automatisch gezählt werden; Level 1 kostet 50 XP, jedes weitere Level
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
| After-Upload-Punkt abgehakt (einmal je Video und Punkt) | 3 |
| After-Upload-Liste komplett abgehakt | +15 Bonus |
| Einkaufsartikel abgehakt | 2 |
| Training: neuer Rekord bei einer Übung (einmal je Übung und Einheit) | 10 |
| Training: Steigerung gegenüber dem letzten Mal (mehr Gewicht oder mehr Wiederholungen) | 5 |

Beim Training gibt es höchstens 8 solcher Buchungen je Einheit, Ausdauer zählt nicht, beim ersten Mal einer Übung gibt es nichts; dazu wird das Habit "Gym" abgehakt (das gibt die normalen Habit-Punkte).

**Ränge** alle fünf Level: Anfänger (0), Lehrling (5), Geselle (10), Experte (15), Meister (20), Großmeister (25), Veteran (30), Champion (35),
Legende (40), Mythos (50). Der Rang steht im Tooltip der Level-Anzeige (auf sehr breiten Bildschirmen auch daneben) und beim Rangwechsel im Level-up.

**Speicherung und Sync:** In der Cloud (Feld `xp` in `sync-data.json`, Code in `xp.js`). Jede Buchung hat einen festen Schlüssel (z.B. `habit:gym@2026-10-10`) und
zählt genau einmal, egal auf welchem Gerät; die Geräte vereinigen ihre Buchungen. Tage älter als 60 Tage werden zu einer Summe verdichtet. Haken
zurücknehmen und erneut setzen bringt keine neuen Punkte. Ziele, die beim Start des Systems schon erreicht waren, geben keine Punkte (`xp.goals`).
Neustart auf 0: das Feld `xp` in `sync-data.json` löschen; beim nächsten Laden werden die dann erreichten Ziele wieder still als erledigt markiert.

## Pixel-Dschungel (Bild und Easter Eggs)

Die Brain-Karte liegt auf einem großen, animierten Pixelbild (ein Wasserfall-Tal im Dschungel); Begrüßung und Brain-Graph stehen davor, auf kleinen
Platten, damit sie lesbar bleiben. Dazu kommt über To-Do, Habits, Zeittracker und Notizen je ein schmaler Streifen mit einem anderen Ausschnitt. Das Bild
ist komplett per Code gezeichnet (`scenery.js`), es gibt keine Bilddatei. Ein Klick auf das Schild "EASTER EGGS" in der Brain-Karte oder auf einen Streifen
öffnet das ganze Bild mit der Liste der Easter Eggs (ein Tippen auf das Bild selbst tut in der Karte nichts, damit der Brain-Graph bedienbar bleibt).

- **Tageszeit nach Uhr:** Morgen (5 bis 10 Uhr), Tag (10 bis 17), Abend (17 bis 20), Nacht (20 bis 5). Licht und Farben ändern sich; nachts leuchten
  Laterne, Lagerfeuer, Lotus, Tempelzeichen und die Augen von Eule, Fuchs und Katzenstatue.
- **Easter Eggs hängen am Level** (siehe Level-System): Level 0 ist schon ein fertiges Bild, mit jedem Meilenstein kommt eine Kleinigkeit dazu. Die Liste
  zeigt gefundene Eggs mit Fundort; ein Klick darauf (oder auf das Egg im großen Bild) markiert die Stelle. Noch gesperrte stehen als "???" mit ihrem Level da.
- **Neues Egg:** Steigt der Level über ein Egg-Level, erscheint unten ein Hinweis "Neues Easter Egg" (ein Klick öffnet die Liste) und die Fundstelle blinkt
  kurz. Auf einem Gerät, das das Dashboard zum ersten Mal öffnet, kommt kein Hinweis, nur das Bild.

| Level | Easter Egg | Fundort |
|---|---|---|
| 1 | Blauer Morpho-Schmetterling | flattert über dem Blumenbeet und landet ab und zu |
| 2 | Fliegenpilze | neben dem Wegweiser am Brückenanfang |
| 3 | Rotaugenlaubfrosch | auf dem Trittstein im Bach, quakt manchmal |
| 4 | Kolibri | schwebt von Blüte zu Blüte |
| 5 | Schatztruhe | zwischen den Wurzeln des großen Stamms, glitzert |
| 6 | Tukan | auf dem Ast, klappert mit dem Schnabel |
| 7 | Regenbogen | im Nebel über dem Becken am Fuß der Kaskade |
| 8 | Laterne | am Brückenpfosten, leuchtet abends |
| 9 | Fuchs | sitzt im Farn zwischen den Stämmen, blinzelt, die Ohren zucken |
| 10 | Eule | im Baumloch; nachts leuchten ihre Augen |
| 11 | Bricklink-Stein | roter 2x4-Stein auf einem Trittstein |
| 12 | Wegweiser mit Play-Knopf | am Beginn der Brücke |
| 13 | Libelle | patrouilliert über dem Becken und spiegelt sich im Wasser |
| 14 | Zeltlager mit Lagerfeuer | auf der Lichtung; abends brennt das Feuer |
| 15 | Kleiner Drache | fliegt ab und zu durchs Himmelsband und taucht in die Schlucht ein |
| 16 | Leuchtlotus | blüht im Becken und leuchtet nachts |
| 18 | Verborgenes Tempeltor | am Fuß der Felswand, die Zeichen leuchten |
| 22 | Polarlicht | über der Kaskade, am hellsten nachts |
| 26 | Leuchtbaum | rosa Geisterbaum auf der Felsinsel im Becken |
| 30 | Goldener Wächter | Katzenstatue auf dem Stein vor der Kaskade; nachts glühen ihre Augen |

Zum Einordnen, was ein Level an XP kostet (Summe aller Level davor): Level 5 ≈ 370, 10 ≈ 1.300, 16 ≈ 4.400, 18 ≈ 6.400, 22 ≈ 13.600, 26 ≈ 28.400,
30 ≈ 59.100. Die Level der Eggs stehen in `scenery.js` in der Liste `EGGS` (Feld `lv`) und lassen sich dort einzeln ändern.

**Speicherung und Sync:** Das Bild speichert nichts in der Cloud. Es liest nur den Level aus dem XP-Stand (`xp.js` meldet jede Änderung über `onChange`
an `scenery.js`), und der ist auf allen Geräten gleich. Im Browser liegt nur der Merker `dashboard-scn-seen` (bis zu welchem Level die Eggs auf diesem
Gerät schon angezeigt wurden, damit der Hinweis nur einmal erscheint).

**Technik:** `scenery.js` ist in Abschnitte gegliedert (Zeichenwerkzeuge, Szene, Sprites, Easter Eggs, Laufzeit, Oberfläche). Der Aufbau dauert ca. 0,3 Sekunden
und passiert erst nach dem ersten Anzeigen der Seite; danach läuft das Bild mit ca. 6 Bildern pro Sekunde, nur solange es im sichtbaren Bereich ist und der
Tab offen ist. Bei "Bewegung reduzieren" im System zeigt es ein ruhiges Standbild. Auf dem Handy schwenkt das Bild sehr langsam hinter der Karte. Zugeklappt bleibt von der Brain-Karte ein schmales Band mit dem Bild dahinter.

## Pixel-Gäste (Easter Eggs im Dashboard und Skilltree)

255 Figuren und Dinge aus Filmen, Serien und Spielen (Mario, Star Wars, Marvel, Harry Potter, ...) stehen als kleine Pixel-Gäste im Dashboard. Sie kommen mit dem
Level (siehe Level-System): **jedes Level schaltet ein Thema frei**, immer erst die Figuren einer Welt, danach ihre Symbole und Dinge.

- **Skilltree:** Ein Klick (oder Enter) auf die Level-Anzeige oben öffnet ihn. Er zeigt alle 30 Level mit ihrem Thema, die freigeschalteten und die noch gesperrten Gäste
  (gesperrte als Silhouette mit Nummer) und die Easter Eggs des Bildes. Ein Tipp auf einen Gast zeigt Name, Level und Platz; dort gibt es auch "Ins Dashboard setzen",
  "Zeig mir, wo" und "Aus dem Dashboard nehmen". Filter (freigeschaltet, gesperrt, im Dashboard) und Suche nach Nummer, Name oder Thema.
- **Plätze:** Das Layout wird gemessen (Text, Knöpfe, Bilder, Eingaben zählen als belegt), alles andere ist frei. Auf den freien Stellen entstehen so viele Plätze wie möglich
  (am Desktop gut 300): stehend auf den Oberkanten der Karten, in ihren unteren Ecken, in Lücken zwischen Karten und am Seitenrand, dazu bis zu vier Plätze in der Kopfzeile.
  Kein Platz verdeckt Text oder Bedienelemente; die Gäste liegen in einer eigenen Ebene (`#guestLayer`, z-index 4, unter Menüs und Hinweisen) und ändern kein Layout.
  Karten in scrollbaren Behältern (Karussells auf dem Handy) bekommen keine Plätze. Zugeklappte Ausklappfelder zählen nicht als belegt (nur ihre Titelzeile), scrollende Behälter
  (z.B. die Einkaufsliste) ganz, ihre Oberkante ist selbst ein Platz. Innerhalb der Karten stehen Gäste außerdem auf Textzeilen, Knöpfen, Balken und Kacheln, wo darüber Platz frei ist
  (am Desktop gut 500 Plätze). Die Automatik verteilt die Gäste gleichmäßig über die Bereiche. Der Hinweis beim Darüberfahren erscheint nur mit der Maus und verschwindet immer wieder.
- **Automatik:** Neue Gäste ziehen mit dem Levelaufstieg von selbst ein, ein Hinweis nennt das neue Thema. Insgesamt stehen nur so viele, dass das Dashboard ruhig bleibt
  (Seitenhöhe / 200 px, am Desktop ca. 36); ältere, nicht von dir gesetzte Gäste weichen (höchstens 16 pro Aufstieg). Die Automatik setzt nur Gäste, die voll sichtbar sind.
- **Tauschen, setzen, leer lassen:** Klick auf einen Gast öffnet die Auswahl aller freigeschalteten Gäste (Suche, Welt, "nicht im Bild", "neu"); "Leer lassen" lässt den Platz leer.
  **Plätze bearbeiten** (im Skilltree oder in der Auswahl unter "Alle Plätze") zeigt alle Plätze, freie mit einem Plus; ein Klick darauf öffnet die Auswahl. Was du gesetzt oder
  leer gelassen hast, fasst die Automatik nie an. In der Leiste des Bearbeiten-Modus: "Automatik: Aus" lässt nur stehen, was du gesetzt hast, "Zurücksetzen" fängt neu an,
  "Alle leeren" räumt auf (beide fragen zweimal), "Neu mischen" im Skilltree würfelt die Plätze neu.
- **Speicherung:** nichts in der Cloud. Im Browser (pro Gerät) liegen `dashboard-guests-seen`, `dashboard-guests-off` und `dashboard-guests-v2` (Zufallszahl, Besetzung der Plätze,
  was du selbst gesetzt hast). Beim Drucken sind die Gäste ausgeblendet; bei "Bewegung reduzieren" stehen sie still.

| Level | Thema | Gäste |
|---|---|---|
| 1 | DC · Helden | 4 |
| 2 | DC · Symbole | 5 |
| 3 | Breaking Bad · Figuren | 5 |
| 4 | Breaking Bad · Dinge | 6 |
| 5 | Harry Potter · Figuren | 6 |
| 6 | Harry Potter · Zauberzubehör | 6 |
| 7 | Drachenzähmen leicht gemacht | 7 |
| 8 | The Last of Us | 9 |
| 9 | Arcane · Figuren | 5 |
| 10 | Arcane · Waffen & Technik | 7 |
| 11 | The Witcher · Figuren | 6 |
| 12 | The Witcher · Zeichen & Waffen | 10 |
| 13 | Toy Story & Shrek | 11 |
| 14 | Avatar · Figuren | 8 |
| 15 | Avatar · Elemente & Symbole | 7 |
| 16 | Gravity Falls | 12 |
| 17 | Spiele-Klassiker · Figuren | 10 |
| 18 | Spiele-Klassiker · Power-Ups & Items | 11 |
| 19 | Stranger Things | 15 |
| 20 | LEGO & Magic · Figuren | 11 |
| 21 | LEGO & Magic · Steine & Mana | 7 |
| 22 | Jurassic Park | 16 |
| 23 | Sci-Fi-Cartoons · Rick & Morty, Futurama | 10 |
| 24 | Sitcom-Cartoons · Simpsons, Family Guy, South Park | 8 |
| 25 | Star Wars · Rebellen & Droiden | 8 |
| 26 | Star Wars · Imperium & Kopfgeldjäger | 8 |
| 27 | Star Wars · Schiffe & Symbole | 10 |
| 28 | Marvel · Avengers | 11 |
| 29 | Marvel · Guardians, Gegner & Mutanten | 9 |
| 30 | Marvel · Waffen & Steine | 7 |

Jeder Gast hat eine feste Nummer (1 bis 255, im Skilltree unter der Figur). Die Themen sind in `guests-data.js` fest eingebaut (`themes` und das Feld `lv` je Gast); sie lassen sich im
Arbeitsordner (`THEMES` in `build_guests.py`) ändern und neu erzeugen.

**Technik:** `guests.js` (Laufzeit) liest den Level wie `scenery.js` über den `onChange`-Hook von `xp.js` und wartet auf `cloud-ready`. Die Messung (ein 4-px-Raster aller belegten Stellen,
Plätze nach dem Zufallsprinzip ohne Überlappung gepackt) dauert ca. 30 ms und läuft nach Größenänderungen, nach dem Laden der Daten und beim Ein- und Ausklappen; Bewegung nur im sichtbaren
Bereich (ca. 12 Bilder pro Sekunde). Die Gäste sind Pixelbilder aus `guests-data.js` (ca. 320 KB), Zeichenwerkzeuge und Quellen liegen nicht im Repo.

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

## Training

Eigener Bereich ganz unten, direkt über den Notizen (Code in `training.js`, Menüpunkt "Training"). Oben steht immer die Karte **Als nächstes**: der nächste Trainingstag
deines Plans mit den Symbolen seiner Übungen und den Knöpfen START und FREIES TRAINING (läuft schon eins, steht dort "Training läuft" und WEITER). Darunter zwei Reiter:

- **Verlauf** (beim Öffnen sichtbar): Wochenleiste (grün = trainiert, rot = verpasster Trainingstag, grau = Ruhetag), Übersicht mit Einheiten, Stunden und Serie für
  Woche, Monat, Jahr oder gesamt, dazu kleine Kacheln: Muskelverteilung, Rekorde, Kraft pro Übung (mit geschätztem Maximum nach Epley), Kalender, Jahresübersicht,
  Sätze je Woche und die letzten Einheiten. Ein Tipp auf eine Kachel öffnet die Einzelheiten in einem Fenster, Einheiten lassen sich dort ansehen und löschen. Export als JSON.
- **Plan:** mehrere Pläne mit Wechsler, je Plan beliebig viele Trainingstage (Name, Fokus, Farbe, Übungen mit Sätzen, Wiederholungen und Gewicht, gleich für alle Sätze oder je
  Satz, Notiz). Der Katalog hat 244 Übungen in 8 Muskelgruppen (Suche, Filter nach Gruppe und Gerät, eigene Übungen), dazu vier Vorlagen, Ruhetage (Standard Samstag und
  Sonntag) und Einstellungen (Pausenzeit, Ton, Vibration, Schrittweite, Plan automatisch nachziehen). Am Anfang sind Pläne und Verlauf leer, nur der Katalog ist da.

**Workout-Modus** (Vollbild): die Übungen als Liste mit Haken je Satz, oder die Ansicht **Live** mit einem Satz groß. Daneben steht "Zuletzt" (die Sätze der letzten Einheit)
und das Ziel. Nach jedem Haken läuft ein Pause-Timer (mit Ton und Vibration, abschaltbar); dazu Notiz je Übung, Satz oder Übung dazu, umsortieren, ersetzen und minimieren
(die Leiste unten bringt zurück). Das Display bleibt an (Wake Lock, wo der Browser es erlaubt). Ein laufendes Training überlebt Neuladen und die Zurück-Taste.

**Regeln:**
- Ziel = gleiches Gewicht wie der beste Satz der letzten Einheit, eine Wiederholung mehr. Ein Satz ist besser, wenn er mehr Gewicht hat, bei gleichem Gewicht mehr Wiederholungen.
- **Rekord** = bester Satz besser als alles davor, **Steigerung** = besser als beim letzten Mal. Haltübungen zählen Sekunden, Ausdauer (km und Minuten) zählt nicht.
- Eine Einheit zählt am Tag des Starts. Rot wird erst ab dem Tag der ersten Einheit angezeigt; Ruhetage sind neutral. Serie = Trainingstage in Folge, Ruhetage überspringt sie.
- Nach dem Training werden die Werte des Plans auf die geschafften Sätze gesetzt (abschaltbar; die Zahl der Sätze schrumpft dabei nie). Startwerte im Workout: die des Plans,
  wenn er nach der letzten Einheit geändert wurde, sonst die der letzten Einheit.

**XP und Habit:** Beim Beenden gibt ein neuer Rekord 10 XP und eine Steigerung 5 XP (siehe Level-System), und das Habit "Gym" (`gym`) wird für den Tag der Einheit abgehakt.
Die Abschlussansicht zeigt die Level-Leiste und bei einem Aufstieg "Level up". Jede Buchung hat einen festen Schlüssel (`train:pr:<Einheit>:<Übung>`) und zählt nur einmal.
Ist die Cloud noch nicht geladen (z.B. im Studio ohne Netz), werden XP und Habit im Browser vorgemerkt (`dashboard-training-pend`) und beim nächsten Laden eingelöst.

**Speicherung (bewusste Ausnahme von "Cloud-only", siehe unten):** Die Daten liegen in `training-data.json` im Repo (`plans`, `rest`, `settings`, `custom`, `sessions`, `del`).
Am Gerät bleibt zusätzlich eine lokale Kopie (`dashboard-training-cache`), das laufende Workout als Entwurf (`dashboard-training-draft`) und die vorgemerkten Belohnungen
(`dashboard-training-pend`), damit das Handy im Studio auch ohne Netz weiter bedienbar bleibt; die Sperre der Seite beim Laden (`body[data-cloud]`) gilt für diesen Bereich nicht.
Änderungen werden nach ca. 0,7 Sekunden gepusht; es wird nie geschrieben, bevor der Cloud-Stand gelesen wurde. Ohne Netz steht "Lokal gesichert · warte auf Netz", beim
nächsten Netz und alle 60 Sekunden gibt es einen neuen Versuch. Bei einem Konflikt (zweites Gerät) wird neu gelesen, vereinigt und wiederholt: Pläne nach Zeitstempel (ein leerer
Plan ersetzt nie einen gefüllten), Einheiten und eigene Übungen als Liste mit Lösch-Markern. Der **Sync**-Button liest und sichert das Training mit. Wie alle Daten im Repo sind auch
diese öffentlich lesbar.

**Technik:** `training.js` (ca. 165 KB) wird aus den Quellen im Arbeitsordner (`training/`) gebaut. Die 16 × 16 Pixel großen Symbole (20 für Übungen und Geräte, 8 für Muskelgruppen)
sind per Code gezeichnet (Umriss, drei Töne je Material) und ordnen jede der 244 Übungen automatisch zu. Pixel-Gäste stehen auch hier auf freien Stellen (Oberkanten der Karten, Lücken,
Seitenränder); Fenster und Vollbild liegen über ihnen.

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
pro Gerät): GitHub-Token, Kalender-Zugang (inkl. Refresh-Token), Theme und der Merker, bis zu
welchem Level die Easter Eggs schon angezeigt wurden (`dashboard-scn-seen`, nur Optik; das Level
selbst liegt nicht hier, sondern in der Cloud) sowie bei den Pixel-Gästen der Merker für "schon angezeigt" (`dashboard-guests-seen`), "ausgeblendet"
(`dashboard-guests-off`) und die Besetzung der Easter-Egg-Plätze (`dashboard-guests-v2`, pro Gerät, weil das Layout je Gerät anders ist; reine Optik).

**Bewusste Ausnahme: das Training.** Es soll im Studio ohne Netz bedienbar bleiben. Deshalb liegen dort eine lokale Kopie der Trainingsdaten (`dashboard-training-cache`), das laufende
Workout (`dashboard-training-draft`) und noch nicht eingelöste XP samt Habit "Gym" (`dashboard-training-pend`) im Browser; die Cloud-Datei `training-data.json` bleibt maßgeblich und wird
bei jedem Laden gelesen und vereinigt, die Kopie wird erst nach erfolgreichem Push als gesichert markiert (Details im Abschnitt "Training").

**Verhalten:**
- Beim Laden wird der Cloud-Stand frisch über die GitHub-API gelesen. Bis er da ist,
  ist die Seite kurz gesperrt (leicht ausgegraut). Schlägt das Laden fehl, bleibt sie
  gesperrt, zeigt "Cloud nicht erreichbar" und versucht es alle 10 Sekunden erneut —
  ein Ladefehler wird nie als leerer Stand behandelt und kann daher nichts überschreiben.
- Jede Änderung wird nach ca. 0,7 Sekunden automatisch in genau die betroffene Datei
  gepusht (Status oben rechts neben dem Sync-Button). Bei einem Konflikt (z.B. paralleler
  Workflow-Commit) wird bis zu zweimal automatisch neu versucht.
- **Schreibzugriffe nacheinander.** Alle Speicherungen aufs Repo (Gewohnheiten, Aufgaben/Ideen, Training und der Workflow-Start des Sync-Knopfs) laufen durch eine gemeinsame
  Warteschlange mit mindestens einer Sekunde Abstand (`serialWrite` in `script.js`). GitHub quittiert gleichzeitige Schreibzugriffe mit einem Konflikt oder seiner Schreibbremse; der
  Sync-Knopf hat früher alles auf einmal geschickt und zeigte dann "Auto-Sync fehlgeschlagen". Er wiederholt Konflikte jetzt selbst und schreibt im Fehlerfall den Grund
  ins Statusfeld.
- **Schreibbremse ist kein ungültiger Token.** Antwortet GitHub mit 403 und "rate limit"/"retry-after", bleibt der Token gespeichert und es heißt "GitHub-Schreibbremse … bitte kurz
  warten". Nur ein echtes 401/403 ohne diese Zeichen löscht den Token.
- **Keine leeren Commits.** Ist der Inhalt von `habits-data.json` / `sync-data.json` schon identisch mit dem Stand in der Cloud, wird nicht geschrieben (kein "Habit-Tracker Update"
  ohne Änderung, keine überflüssige Pages-Veröffentlichung). Klickst du Sync ohne neue Änderungen, startet nur der Workflow.
- **Kein Offline-Bearbeiten.** Ohne Token ist das Dashboard praktisch nur lesbar: bei der
  ersten Änderung fragt es einmal pro Sitzung nach dem Token; lehnst du ab, steht
  "Nicht gespeichert — GitHub-Token fehlt". Beim Schließen mit ungespeicherten
  Änderungen warnt der Browser.
- **Zurückkehren in den Tab und Tageswechsel:** Kommst du in einen schon länger offenen Tab oder die App zurück (und alle 5 Minuten, solange er sichtbar ist), wird der Cloud-Stand
  aufgefrischt (nur mit Token, höchstens alle 2 Minuten, nicht während du tippst oder ein Fenster offen ist), damit Änderungen vom anderen Gerät ankommen. Hat inzwischen ein neuer Tag
  begonnen, lädt die Seite von selbst neu (sonst stehen Datum, Tages-To-Do und Habits auf dem alten Tag); ist gerade etwas offen oder nicht gespeichert, erscheint stattdessen der Hinweis
  "Ein neuer Tag hat begonnen".
- **Hinweise statt Dialogfenstern:** Meldungen (Sync gestartet, Fehler) erscheinen als kurze Hinweise unten (Klick schließt sie); Studium-Termin und Wochenziel eines Habits werden in einem
  kleinen Fenster eingegeben. Nur die einmalige Eingabe von Token, Repo und Kalender-Zugang nutzt noch das Eingabefenster des Browsers.
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
(`habits-data.json`, `sync-data.json`, `training-data.json`) und alle fremden Hosts (GitHub-API, Google)
ignoriert er komplett, damit nie ein veralteter Cloud-Stand ausgeliefert wird.

**Versionsnummer gegen veraltete Dateien:** `styles.css`, `shopping.js`, `timetracker.js` und `script.js` hängen in `index.html`
mit einem `?v=…`-Parameter, damit der Browser sie nach einem Deploy immer zusammen in der neuen Version lädt (sonst kann eine
alte `script.js` mit einer neuen `index.html` kombiniert werden, und ganze Sektionen bleiben leer). Bei jedem Deploy mit
Code-Änderungen die Version in `index.html` hochzählen und den Cache-Namen in `sw.js` erhöhen. `data.js` hat bewusst keinen
Parameter, ändert sich täglich und wird vom Service Worker immer beim Server nachgefragt; der Zeittracker lädt seine
Notion-Historie zusätzlich frisch nach.

Das App-Icon ist ein Pixel-Pokal im Farbschema des Dashboards, als PNG in drei Größen: `icon-64.png` (Browser-Tab), `icon-200.png`
(Startbildschirm, Apple-Touch-Icon) und `icon-640.png` (Installation, mit Rand für maskierte Icons).
