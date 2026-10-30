# Startet scripts\sync-brainmap.ps1 ohne Rueckfragen und haengt das Ergebnis an %LOCALAPPDATA%\dashboard-brainmap-sync.log.
# Aufgerufen vom Windows-Task "Dashboard Brain-Map Sync" (einrichten mit scripts\install-brainmap-task.ps1), geht aber auch von Hand:
#   powershell -File scripts\run-brainmap-sync.ps1
# Im Hintergrund darf Git nicht nach einem Passwort fragen (das Fenster waere unsichtbar und der Lauf bliebe haengen):
# fehlt der Git-Zugang, scheitert der Lauf stattdessen sauber, und das Protokoll sagt es.

$ErrorActionPreference = "Continue"
$env:GIT_TERMINAL_PROMPT = "0"
$env:GCM_INTERACTIVE = "never"

$log = Join-Path $env:LOCALAPPDATA "dashboard-brainmap-sync.log"
# Protokoll klein halten: ab 200 KB ersetzt der aktuelle Stand die alte Sicherung
if ((Test-Path $log) -and ((Get-Item $log).Length -gt 200KB)) { Move-Item -Path $log -Destination "$log.alt" -Force }

function Log($text) { Add-Content -Path $log -Value $text -Encoding UTF8 }

Log ("[{0}] Start auf {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $env:COMPUTERNAME)
$sync = Join-Path $PSScriptRoot "sync-brainmap.ps1"
$lines = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $sync *>&1 | ForEach-Object { "$_" }
$code = $LASTEXITCODE
# PowerShell 5.1 haengt bei Fehlerausgaben von Git Zeilen "System.Management.Automation.RemoteException" an: fuers Protokoll weglassen
foreach ($l in $lines) { if ($l.Trim() -and ($l.Trim() -ne "System.Management.Automation.RemoteException")) { Log ("    " + $l) } }
Log ("[{0}] Ende: {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $(if ($code -eq 0) { "ok" } else { "FEHLER (Code $code)" }))
exit $code
