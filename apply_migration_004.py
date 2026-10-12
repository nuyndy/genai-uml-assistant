from pathlib import Path
from dotenv import load_dotenv
import os
import psycopg2
load_dotenv("backend/.env")
url = os.getenv("DATABASE_URL")
if not url:
    raise SystemExit("ERROR: DATABASE_URL chưa được cấu hình.")
sql_path = Path("backend/migrations/004_add_baseline_traceability_glossary.sql")
sql = sql_path.read_text(encoding="utf-8")
conn = psycopg2.connect(url)
try:
    conn.autocommit = False
    with conn.cursor() as cur:
        cur.execute("""
            SELECT to_regclass('public.project'),
                   to_regclass('public.users')
        """)
        project_table, users_table = cur.fetchone()
        if not project_table or not users_table:
            raise RuntimeError(
                "Không tìm thấy bảng project hoặc users trong schema public. "
                "Dừng migration để tránh áp dụng sai database."
            )
        cur.execute(sql)
        cur.execute("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
              AND table_name IN (
                  'glossary_term',
                  'trace_link',
                  'project_baseline',
                  'entity_revision'
              )
            ORDER BY table_name
        """)
        tables = [row[0] for row in cur.fetchall()]
    conn.commit()
    print("Migration completed.")
    print("New tables:", ", ".join(tables))
    if len(tables) != 4:
        print("WARNING: Không tìm thấy đủ bốn bảng; cần kiểm tra lại.")
except Exception:
    conn.rollback()
    raise
finally:
    conn.close()
