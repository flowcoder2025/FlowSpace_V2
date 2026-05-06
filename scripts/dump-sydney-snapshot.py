"""
Dump full Sydney Supabase data to local JSON snapshot before project deletion.

Reads Sydney connection from .env.backup-pre-seoul.
Writes one JSON file per table to .backups/sydney-2026-05-06/.
"""
import json
import re
import sys
from datetime import datetime, date
from decimal import Decimal
from pathlib import Path
from uuid import UUID
import psycopg

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent
OLD_URL = re.search(
    r'DIRECT_URL="([^"]+)"',
    (ROOT / ".env.backup-pre-seoul").read_text(encoding="utf-8"),
).group(1)

OUT_DIR = ROOT / ".backups" / "sydney-2026-05-06"
OUT_DIR.mkdir(parents=True, exist_ok=True)


def encode(o):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if isinstance(o, Decimal):
        return str(o)
    if isinstance(o, UUID):
        return str(o)
    if isinstance(o, bytes):
        return o.hex()
    raise TypeError(f"unserializable: {type(o)}")


def main():
    print(f"Source: {OLD_URL.split('@')[1].split('/')[0]}")
    print(f"Output: {OUT_DIR}")
    print()

    summary = {}
    with psycopg.connect(OLD_URL) as conn, conn.cursor() as cur:
        cur.execute(
            """
            SELECT table_name FROM information_schema.tables
            WHERE table_schema='public' ORDER BY table_name
            """
        )
        tables = [r[0] for r in cur.fetchall()]

        for table in tables:
            cur.execute(
                """
                SELECT column_name FROM information_schema.columns
                WHERE table_schema='public' AND table_name=%s
                ORDER BY ordinal_position
                """,
                (table,),
            )
            cols = [r[0] for r in cur.fetchall()]
            col_idents = ", ".join('"' + c.replace('"', '""') + '"' for c in cols)
            cur.execute(f'SELECT {col_idents} FROM public."{table}";')
            rows = cur.fetchall()

            data = [dict(zip(cols, row)) for row in rows]
            out_file = OUT_DIR / f"{table}.json"
            out_file.write_text(
                json.dumps(data, default=encode, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            summary[table] = len(rows)
            print(f"  {table:24s} {len(rows):4d} rows -> {out_file.name}")

    # Manifest
    manifest = {
        "snapshot_date": "2026-05-06",
        "source_project_id": "afdfkpxsfuyccdvrkqwu",
        "source_region": "ap-southeast-2",
        "source_host": OLD_URL.split("@")[1].split("/")[0],
        "tables": summary,
        "total_rows": sum(summary.values()),
        "purpose": "pre-deletion safety snapshot of Sydney Supabase project",
    }
    (OUT_DIR / "_manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\nTotal: {manifest['total_rows']} rows across {len(summary)} tables")
    print(f"Manifest: {OUT_DIR / '_manifest.json'}")


if __name__ == "__main__":
    main()
