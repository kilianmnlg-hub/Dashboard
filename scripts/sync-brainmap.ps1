# Liest die Ordnerstruktur des lokalen Obsidian-Vaults aus und schreibt sie als "brainMap"-
# Block in data.js (Grundlage fuer die Brain-Grafik), und sammelt aus jeder "Notizen.md" pro
# Themen-Ordner alle Eintraege in einen gemeinsamen "notes"-Block (Grundlage fuer die
# Notizen-Liste ganz unten im Dashboard) - jede Notiz landet beim Erfassen direkt im
# richtigen Themen-Ordner, das Dashboard listet trotzdem einfach alle zusammen auf.
#
# Laeuft bewusst lokal (nicht ueber GitHub Actions): Microsoft/Apple erlauben keinen
# unbeaufsichtigten Hintergrundzugriff auf ein privates Cloud-Konto, aber der Vault-Ordner
# liegt lokal auf diesem Rechner, also braucht es dafuer gar keine Cloud-API.
#
# Aufruf manuell: powershell -File scripts\sync-brainmap.ps1
# Wiederkehrend: Windows-Aufgabenplanung-Task "Dashboard Brain-Map Sync", taeglich 08:00.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$vaultPath = "C:\Users\kilia\OneDrive\Claude\Kilian Obsidian"
$dataJsPath = Join-Path $repoRoot "data.js"

if (-not (Test-Path $vaultPath)) {
  Write-Error "Vault nicht gefunden unter: $vaultPath"
  exit 1
}

function Slugify($name) {
  $s = $name.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  return $s.Trim("-")
}

function ToJsonString($s) {
  if ($null -eq $s) { return "" }
  $s = $s -replace '\\', '\\\\'
  $s = $s -replace '"', '\"'
  $s = $s -replace "`r`n", '\n'
  $s = $s -replace "`n", '\n'
  $s = $s -replace "`t", '\t'
  return $s
}

# Bekannte Ordner -> stabile ID + Akzentfarbe (fuer die bereits im Dashboard etablierten
# Themenfarben). Unbekannte/neue Ordner bekommen automatisch eine generische ID+Farbe,
# damit neue Themenbereiche im Vault auch ohne Skript-Anpassung als Knoten auftauchen.
$knownAreas = @{
  "Bricklink"           = @{ id = "bricklink";    color = "var(--accent-bricklink)" }
  "Bricks On The Floor" = @{ id = "botf";         color = "var(--accent-bricks)" }
  "The Brainwalkers"    = @{ id = "brainwalkers"; color = "var(--accent-brainwalkers)" }
  "Laden"               = @{ id = "laden";        color = "var(--node-laden)" }
  "Privat"              = @{ id = "privat";       color = "var(--node-privat)" }
  "Ideen"               = @{ id = "ideen";        color = "var(--accent-tiktok)" }
}
$fallbackColors = @("var(--accent-privat)", "var(--node-laden)", "var(--node-privat)")

$folders = Get-ChildItem -Path $vaultPath -Directory | Where-Object { $_.Name -ne ".obsidian" } | Sort-Object Name

$areas = @()
$notes = @()
$fallbackIdx = 0
foreach ($f in $folders) {
  $noteCount = (Get-ChildItem -Path $f.FullName -Filter "*.md" -Recurse -File -ErrorAction SilentlyContinue).Count
  if ($knownAreas.ContainsKey($f.Name)) {
    $meta = $knownAreas[$f.Name]
    $id = $meta.id
    $color = $meta.color
  } else {
    $id = Slugify $f.Name
    $color = $fallbackColors[$fallbackIdx % $fallbackColors.Count]
    $fallbackIdx++
  }
  $areas += [PSCustomObject]@{ id = $id; folder = $f.Name; noteCount = $noteCount; color = $color }

  $notizenPath = Join-Path $f.FullName "Notizen.md"
  if (Test-Path $notizenPath) {
    $content = Get-Content -Raw -Path $notizenPath -Encoding UTF8
    $entryMatches = [regex]::Matches($content, '(?ms)^## (.+?)\r?\n(.*?)(?=\r?\n## |\z)')
    foreach ($m in $entryMatches) {
      $dateStr = $m.Groups[1].Value.Trim()
      $bodyText = $m.Groups[2].Value.Trim()
      if (-not $bodyText) { continue }
      try {
        $dt = [datetime]::ParseExact($dateStr, "dd.MM.yyyy, HH:mm", [System.Globalization.CultureInfo]::InvariantCulture)
        $iso = $dt.ToString("yyyy-MM-ddTHH:mm:ss")
      } catch {
        $iso = $dateStr
      }
      $notes += [PSCustomObject]@{ date = $iso; category = $f.Name; text = $bodyText }
    }
  }
}
$notes = @($notes | Sort-Object date -Descending)

$areasJson = ($areas | ForEach-Object {
  "      { `"id`": `"$($_.id)`", `"folder`": `"$(ToJsonString $_.folder)`", `"noteCount`": $($_.noteCount), `"color`": `"$($_.color)`" }"
}) -join ",`n"

$notesJson = if ($notes.Count -gt 0) {
  ($notes | ForEach-Object {
    "    { `"date`": `"$($_.date)`", `"category`": `"$(ToJsonString $_.category)`", `"text`": `"$(ToJsonString $_.text)`" }"
  }) -join ",`n"
} else { $null }

$syncedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$text = Get-Content -Raw -Path $dataJsPath -Encoding UTF8

# --- brainMap-Block ersetzen ---
$startIdx = $text.IndexOf('"brainMap": {')
if ($startIdx -lt 0) { Write-Error "brainMap-Block nicht in data.js gefunden."; exit 1 }
$endMarker = "`n  },"
$endIdx = $text.IndexOf($endMarker, $startIdx)
if ($endIdx -lt 0) { Write-Error "Ende des brainMap-Blocks nicht gefunden."; exit 1 }
$brainMapBlock = @"
"brainMap": {
    "syncedAt": "$syncedAt",
    "vaultName": "Kilian Obsidian",
    "areas": [
$areasJson
    ]
  },
"@
$text = $text.Substring(0, $startIdx) + $brainMapBlock + $text.Substring($endIdx + $endMarker.Length)

# --- notes-Block ersetzen ---
$startIdx = $text.IndexOf('"notes": [')
if ($startIdx -lt 0) { Write-Error "notes-Block nicht in data.js gefunden."; exit 1 }
$endIdx = $text.IndexOf("],", $startIdx)
if ($endIdx -lt 0) { Write-Error "Ende des notes-Blocks nicht gefunden."; exit 1 }
$notesBlock = if ($notesJson) { "`"notes`": [`n$notesJson`n  ]," } else { "`"notes`": []," }
$text = $text.Substring(0, $startIdx) + $notesBlock + $text.Substring($endIdx + 2)

Set-Content -Path $dataJsPath -Value $text -NoNewline -Encoding utf8

Write-Host "brainMap aktualisiert: $($areas.Count) Bereiche, $($notes.Count) Notizen, $syncedAt"

Set-Location $repoRoot
git add data.js
$diff = git diff --cached --stat
if (-not $diff) {
  Write-Host "Keine Aenderungen an data.js - nichts zu committen."
  exit 0
}
git commit -m "Brain-Map Sync (automatisch)" | Out-Null

# Wiederholung mit Wartezeit: dieses Skript und der GitHub-Actions-Sync laufen beide um
# 08:00 Uhr und pushen gelegentlich zeitgleich - dann schlaegt der Rebase mit einem
# Konflikt fehl. Statt sofort aufzugeben: Rebase abbrechen, kurz warten, mit frischem
# Stand erneut versuchen. Der Abbruch selbst wird bewusst nicht als fataler Fehler
# behandelt (kann fehlschlagen, wenn gar kein Rebase mehr laeuft) - das darf den
# Wiederholungsversuch nicht abwuergen.
$pushed = $false
for ($i = 1; $i -le 5; $i++) {
  git pull --rebase origin main
  if ($LASTEXITCODE -eq 0) {
    git push origin main
    if ($LASTEXITCODE -eq 0) { $pushed = $true; break }
  }
  Write-Host "Push fehlgeschlagen (Versuch $i/5), vermutlich zeitgleicher anderer Push - erneut versuchen..."
  if (Test-Path ".git\rebase-merge") {
    try { git rebase --abort 2>$null } catch { }
    if (Test-Path ".git\rebase-merge") { Remove-Item ".git\rebase-merge" -Recurse -Force -ErrorAction SilentlyContinue }
  }
  Start-Sleep -Seconds (Get-Random -Minimum 3 -Maximum 11)
}
if (-not $pushed) {
  Write-Error "Push nach 5 Versuchen weiterhin fehlgeschlagen."
  exit 1
}
Write-Host "Gepusht."
