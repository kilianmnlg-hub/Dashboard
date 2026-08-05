# Liest die Ordnerstruktur des lokalen Obsidian-Vaults aus und schreibt sie als
# "brainMap"-Block in data.js — Grundlage fuer die Brain-Grafik im Dashboard.
# Laeuft bewusst lokal (nicht ueber GitHub Actions): Microsoft/Apple erlauben keinen
# unbeaufsichtigten Hintergrundzugriff auf ein privates Cloud-Konto, aber der Vault-Ordner
# liegt lokal auf diesem Rechner, also braucht es dafuer gar keine Cloud-API.
#
# Aufruf manuell: powershell -File scripts\sync-brainmap.ps1
# Wiederkehrend: als Windows-Aufgabenplanung-Task eingerichtet (taeglich / bei Anmeldung).

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$vaultPath = "C:\Users\kilia\OneDrive\Claude\Kilian Obsidian"
$dataJsPath = Join-Path $repoRoot "data.js"

if (-not (Test-Path $vaultPath)) {
  Write-Error "Vault nicht gefunden unter: $vaultPath"
  exit 1
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
}
$fallbackColors = @("var(--accent-tiktok)", "var(--accent-privat)", "var(--node-laden)", "var(--node-privat)")

function Slugify($name) {
  $s = $name.ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  return $s.Trim("-")
}

$folders = Get-ChildItem -Path $vaultPath -Directory | Where-Object { $_.Name -ne ".obsidian" } | Sort-Object Name

$areas = @()
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
}

$areasJson = ($areas | ForEach-Object {
  "      { `"id`": `"$($_.id)`", `"folder`": `"$($_.folder -replace '"','\"')`", `"noteCount`": $($_.noteCount), `"color`": `"$($_.color)`" }"
}) -join ",`n"

$syncedAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ss.fffZ")

$text = Get-Content -Raw -Path $dataJsPath
$startMarker = '"brainMap": {'
$startIdx = $text.IndexOf($startMarker)
if ($startIdx -lt 0) { Write-Error "brainMap-Block nicht in data.js gefunden."; exit 1 }
# Ende des brainMap-Objekts: das "}," auf eigener Zeile mit 2 Leerzeichen Einrueckung danach
$endMarker = "`n  },"
$endIdx = $text.IndexOf($endMarker, $startIdx)
if ($endIdx -lt 0) { Write-Error "Ende des brainMap-Blocks nicht gefunden."; exit 1 }

$newBlock = @"
"brainMap": {
    "syncedAt": "$syncedAt",
    "vaultName": "Kilian Obsidian",
    "inboxFile": "Inbox.md",
    "areas": [
$areasJson
    ]
  },
"@

$before = $text.Substring(0, $startIdx)
$after = $text.Substring($endIdx + $endMarker.Length)
Set-Content -Path $dataJsPath -Value ($before + $newBlock + $after) -NoNewline -Encoding utf8

Write-Host "brainMap aktualisiert: $($areas.Count) Bereiche, $syncedAt"

Set-Location $repoRoot
git add data.js
$diff = git diff --cached --stat
if (-not $diff) {
  Write-Host "Keine Aenderungen an data.js - nichts zu committen."
  exit 0
}
git commit -m "Brain-Map Sync (automatisch)" | Out-Null
git pull --rebase origin main
git push origin main
Write-Host "Gepusht."
