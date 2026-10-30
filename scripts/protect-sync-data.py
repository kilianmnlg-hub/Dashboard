#!/usr/bin/env python3
"""Schutz gegen ueberschreibende Geraete (Daten im PRIVATEN Repo).

Das Dashboard speichert alles in sync-data.json und habits-data.json. Schreibt ein Geraet mit altem Code die ganze Datei neu,
verschwinden darin Bereiche, die es noch nicht kennt (so ist am 07.10. die Einkaufsliste verloren gegangen). Dieses Skript
laeuft alle 10 Minuten, schaut sich die Schreibzugriffe der letzten Minuten an und holt solche Bereiche aus dem Stand davor zurueck.

Aufruf: protect-sync-data.py <Ordner des privaten Repos> [Minuten, Standard 45]

Wiederhergestellt wird ein Bereich, wenn er
  1. im neuen Stand ganz fehlt, oder
  2. (nur Bereiche mit eigenem Zeitstempel) im neuen Stand auf "nie gespeichert" (updatedAt 0) steht, waehrend er vorher gespeichert war.
Alles andere (auch ein bewusst geleerter Bereich, der einen neuen Zeitstempel hat) bleibt, wie es ist.
Geschrieben wird in den neuesten Stand von origin/main, damit parallele Aenderungen nicht verloren gehen. Wiederholte Pruefung derselben
Schreibzugriffe schadet nicht: was schon wieder da ist, wird nicht noch einmal angefasst.
"""
import json
import os
import subprocess
import sys

FILES = ["sync-data.json", "habits-data.json"]
# Bereiche, die mit updatedAt 0 nur "noch nie gespeichert" bedeuten (todos bewusst nicht: dort setzt der Tageswechsel 0)
STAMPED = {"shopping", "timetracker", "inbox", "remoteTasks", "tasks", "fold", "habits", "xp", "room"}
BOT = "dashboard-bot"


def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} fehlgeschlagen: {r.stderr.strip()}")
    return r.stdout


def show(repo, rev, path):
    r = subprocess.run(["git", "-C", repo, "show", f"{rev}:{path}"], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    try:
        data = json.loads(r.stdout)
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def stamp(value):
    return value.get("updatedAt") if isinstance(value, dict) else None


def lost_keys(before, after):
    """Bereiche, die zwischen before und after verloren gingen."""
    lost = {}
    for key, old in before.items():
        if key not in after:
            lost[key] = old
        elif key in STAMPED and isinstance(old, dict):
            old_t, new_t = stamp(old), stamp(after[key])
            if isinstance(old_t, (int, float)) and old_t > 0 and (new_t in (None, 0) or not isinstance(new_t, (int, float))):
                lost[key] = old
    return lost


def main():
    repo = sys.argv[1]
    minutes = int(sys.argv[2]) if len(sys.argv) > 2 else 45
    since = f"{minutes} minutes ago"
    commits = [c for c in git(repo, "log", f"--since={since}", "--format=%H %an", "--reverse", "--", *FILES).splitlines() if c.strip()]
    todo = {}
    for line in commits:
        sha, _, author = line.partition(" ")
        if author.strip() == BOT:
            continue  # eigene Wiederherstellungen und Sync-Laeufe nicht noch einmal pruefen
        for path in FILES:
            before, after = show(repo, sha + "^", path), show(repo, sha, path)
            if before is None or after is None:
                continue
            lost = lost_keys(before, after)
            if lost:
                todo.setdefault(path, {}).update(lost)
                print(f"{path} ({sha[:7]}): verloren gegangen: {', '.join(sorted(lost))}")
    if not todo:
        print("Nichts verloren gegangen.")
        return 0

    if os.environ.get("DRY_RUN"):
        print("Probelauf: es wird nichts geschrieben.")
        return 0
    git(repo, "config", "user.name", BOT)
    git(repo, "config", "user.email", "actions@users.noreply.github.com")
    for attempt in range(1, 5):
        git(repo, "fetch", "origin", "main")
        git(repo, "checkout", "-B", "main", "origin/main")
        changed = []
        for path, lost in todo.items():
            try:
                current = json.load(open(os.path.join(repo, path), encoding="utf-8"))
            except (OSError, ValueError):
                continue
            restored = [k for k, v in lost.items() if k not in current or (k in STAMPED and lost_keys({k: v}, {k: current[k]}))]
            for k in restored:
                current[k] = lost[k]
            if restored:
                with open(os.path.join(repo, path), "w", encoding="utf-8", newline="\n") as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
                changed.append(f"{path}: {', '.join(sorted(restored))}")
        if not changed:
            print("Inzwischen schon wieder vorhanden, nichts zu tun.")
            return 0
        git(repo, "add", *todo.keys())
        git(repo, "commit", "-m", "Schutz: verlorene Bereiche wiederhergestellt (" + "; ".join(changed) + ")")
        if subprocess.run(["git", "-C", repo, "push", "origin", "main"], capture_output=True, text=True).returncode == 0:
            print("Wiederhergestellt: " + "; ".join(changed))
            return 0
        print(f"Push abgelehnt (Versuch {attempt}), neu versuchen ...")
    print("Konnte nach mehreren Versuchen nicht schreiben.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
