"""
Sydney → Seoul Supabase data migration.

Reads from .env.backup-pre-seoul (old) and .env.new-seoul (new).
Migrates all public.* tables in dependency-safe order.
"""
import re
import sys
from pathlib import Path
import psycopg
from psycopg.types.json import Json

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parent.parent

old_env = (ROOT / ".env.backup-pre-seoul").read_text(encoding="utf-8")
new_env = (ROOT / ".env.new-seoul").read_text(encoding="utf-8")
OLD_URL = re.search(r'DIRECT_URL="([^"]+)"', old_env).group(1)
NEW_URL = re.search(r'DIRECT_URL="([^"]+)"', new_env).group(1)

# Migration order (FK-safe with replica role, but this is the natural order)
TABLES = [
    "User",
    "Template",
    "VerificationToken",
    "_prisma_migrations",
    "Account",
    "Session",
    "AssetWorkflow",
    "Space",
    "GuestSession",
    "SpaceMember",
    "ChatMessage",
    "GeneratedAsset",
    "SpaceEventLog",
    "MapObject",
    "PartyZone",
    "SpotlightGrant",
]


def get_columns(cur, table):
    cur.execute(
        """
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='public' AND table_name=%s
        ORDER BY ordinal_position
        """,
        (table,),
    )
    return [r[0] for r in cur.fetchall()]


def quote_ident(name):
    return '"' + name.replace('"', '""') + '"'


def main():
    print(f"OLD: {OLD_URL.split('@')[1].split('/')[0]}")
    print(f"NEW: {NEW_URL.split('@')[1].split('/')[0]}")
    print()

    summary = []

    with psycopg.connect(OLD_URL) as src, psycopg.connect(NEW_URL) as dst:
        with src.cursor() as src_cur, dst.cursor() as dst_cur:
            # Disable FK checks on destination
            dst_cur.execute("SET session_replication_role = 'replica';")

            for table in TABLES:
                cols = get_columns(src_cur, table)
                col_idents = ", ".join(quote_ident(c) for c in cols)
                src_cur.execute(f"SELECT {col_idents} FROM public.{quote_ident(table)};")
                raw_rows = src_cur.fetchall()
                # Wrap dict/list values (JSONB) with Json adapter
                rows = []
                for row in raw_rows:
                    rows.append(tuple(
                        Json(v) if isinstance(v, (dict, list)) else v
                        for v in row
                    ))

                if not rows:
                    summary.append((table, 0, "skipped (empty)"))
                    continue

                placeholders = ", ".join(["%s"] * len(cols))
                insert_sql = (
                    f"INSERT INTO public.{quote_ident(table)} ({col_idents}) "
                    f"VALUES ({placeholders}) "
                    f"ON CONFLICT DO NOTHING"
                )
                dst_cur.executemany(insert_sql, rows)
                summary.append((table, len(rows), "inserted"))
                print(f"  {table:24s} {len(rows):4d} rows -> {dst_cur.rowcount} inserted")

            # Re-enable FK checks
            dst_cur.execute("SET session_replication_role = 'origin';")
            dst.commit()

    print("\n=== Summary ===")
    for t, n, status in summary:
        print(f"  {t:24s} {n:4d} {status}")
    print(f"\nTotal: {sum(n for _, n, _ in summary)} rows migrated.")


if __name__ == "__main__":
    main()
