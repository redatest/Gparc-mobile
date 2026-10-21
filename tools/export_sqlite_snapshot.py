#!/usr/bin/env python3
"""Crée une copie cohérente d'une base SQLite Gparc, y compris en mode WAL.

Usage:
  python tools/export_sqlite_snapshot.py "chemin/vers/gparc.db" "gparc-mobile.db"
"""
from __future__ import annotations

import argparse
import sqlite3
import sys
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Exporter un instantané SQLite cohérent pour Gparc Mobile.")
    parser.add_argument("source", help="Chemin de la base Gparc active (gparc.db)")
    parser.add_argument("destination", help="Chemin du fichier .db à transférer sur le téléphone")
    parser.add_argument("--force", action="store_true", help="Remplacer le fichier de destination s'il existe")
    args = parser.parse_args()

    source = Path(args.source).expanduser().resolve()
    destination = Path(args.destination).expanduser().resolve()

    if not source.is_file():
        print(f"ERREUR : base source introuvable : {source}", file=sys.stderr)
        return 2
    if source == destination:
        print("ERREUR : la destination doit être différente de la base source.", file=sys.stderr)
        return 2
    if destination.exists() and not args.force:
        print(f"ERREUR : la destination existe déjà : {destination}\nUtilisez --force pour la remplacer.", file=sys.stderr)
        return 2

    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists():
        destination.unlink()

    src = None
    dst = None
    try:
        src = sqlite3.connect(str(source), timeout=15)
        src.execute("PRAGMA query_only = ON")
        dst = sqlite3.connect(str(destination), timeout=15)
        src.backup(dst)
        result = dst.execute("PRAGMA quick_check").fetchone()
        if not result or result[0] != "ok":
            raise RuntimeError(f"Échec du contrôle d'intégrité SQLite : {result}")
        tables = dst.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        ).fetchone()[0]
        dst.commit()
        print("Instantané SQLite créé avec succès.")
        print(f"Source      : {source}")
        print(f"Destination : {destination}")
        print(f"Taille      : {destination.stat().st_size:,} octets")
        print(f"Tables      : {tables}")
        print("Vous pouvez maintenant transférer le fichier de destination par USB ou copie manuelle.")
        return 0
    except Exception as exc:
        if destination.exists():
            destination.unlink()
        print(f"ERREUR pendant l'export : {exc}", file=sys.stderr)
        return 1
    finally:
        if dst is not None:
            dst.close()
        if src is not None:
            src.close()


if __name__ == "__main__":
    raise SystemExit(main())
