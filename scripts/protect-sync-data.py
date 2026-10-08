#!/usr/bin/env python3
"""Schutz gegen ueberschreibende Geraete.

Das Dashboard speichert alles in sync-data.json und habits-data.json. Schreibt ein Geraet mit altem Code die ganze Datei neu,
verschwinden darin Bereiche, die es noch nicht kennt (so ist am 07.10. die Einkaufsliste verloren gegangen). Dieses Skript
laeuft nach jedem Schreiben dieser Dateien und holt solche Bereiche aus dem Stand davor zurueck.

Aufruf: protect-sync-data.py <vorher-commit> <nachher-commit>

Wiederhergestellt wird ein Bereich, wenn er
  1. im neuen Stand ganz fehlt, oder
  2. (nur Bereiche mit eigenem Zeitstempel) im neuen Stand auf "nie gespeichert" (updatedAt 0) steht, waehrend er vorher gespeichert war.
Alles andere (auch ein bewusst geleerter Bereich, der einen neuen Zeitstempel hat) bleibt, wie es ist.
Geschrieben wird in den neuesten Stand von origin/main, damit parallele Aenderungen nicht verloren gehen.
"""
import json
import os
import subprocess
import sys

FILES = ["sync-data.json", "habits-data.json"]
# Bereiche, die mit updatedAt 0 nur "noch nie gespeichert" bedeuten (todos bewusst nicht: dort setzt der Tageswechsel 0)
STAMPED = {"shopping", "timetracker", "inbox", "remoteTasks", "tasks", "fold", "habits"}


def git(*args, check=True):
    r = subprocess.run(["git", *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} fehlgeschlagen: {r.stderr.strip()}")
    return r.stdout


def show(rev, path):
    r = subprocess.run(["git", "show", f"{rev}:{path}"], capture_output=True, text=True)
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
    before_rev, after_rev = sys.argv[1], sys.argv[2]
    if set(before_rev) == {"0"}:
        print("Erster Commit, nichts zu pruefen.")
        return 0
    todo = {}
    for path in FILES:
        before, after = show(before_rev, path), show(after_rev, path)
        if before is None or after is None:
            continue
        lost = lost_keys(before, after)
        if lost:
            todo[path] = lost
            print(f"{path}: verloren gegangen: {', '.join(sorted(lost))}")
    if not todo:
        print("Nichts verloren gegangen.")
        return 0

    if os.environ.get("DRY_RUN"):
        print("Probelauf: es wird nichts geschrieben.")
        return 0
    git("config", "user.name", "dashboard-bot")
    git("config", "user.email", "actions@users.noreply.github.com")
    for attempt in range(1, 5):
        git("fetch", "origin", "main")
        git("checkout", "-B", "main", "origin/main")
        changed = []
        for path, lost in todo.items():
            try:
                current = json.load(open(path, encoding="utf-8"))
            except (OSError, ValueError):
                continue
            restored = [k for k, v in lost.items() if k not in current or (k in STAMPED and lost_keys({k: v}, {k: current[k]}))]
            for k in restored:
                current[k] = lost[k]
            if restored:
                with open(path, "w", encoding="utf-8", newline="\n") as f:
                    json.dump(current, f, ensure_ascii=False, indent=2)
                changed.append(f"{path}: {', '.join(sorted(restored))}")
        if not changed:
            print("Inzwischen schon wieder vorhanden, nichts zu tun.")
            return 0
        git("add", *todo.keys())
        git("commit", "-m", "Schutz: verlorene Bereiche wiederhergestellt (" + "; ".join(changed) + ")")
        if subprocess.run(["git", "push", "origin", "main"], capture_output=True, text=True).returncode == 0:
            print("Wiederhergestellt: " + "; ".join(changed))
            return 0
        print(f"Push abgelehnt (Versuch {attempt}), neu versuchen ...")
    print("Konnte nach mehreren Versuchen nicht schreiben.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
