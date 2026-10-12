import os
import subprocess
from pathlib import Path
from datetime import datetime
from sqlalchemy import text
from database.db import engine
pg_dump = Path(r"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe")
pg_restore = Path(r"C:\Program Files\PostgreSQL\18\bin\pg_restore.exe")
backup_dir = Path(r"D:\DB_Backups")
backup_dir.mkdir(parents=True, exist_ok=True)
if not pg_dump.exists():
    raise SystemExit("Khong tim thay pg_dump.exe")
# Xác nhận kết nối bằng đúng cấu hình backend trước khi sao lưu.
with engine.connect() as conn:
    conn.execute(text("SELECT 1"))
url = engine.url
if not url.password:
    raise SystemExit("Backend khong co mat khau trong cau hinh")
backup_file = backup_dir / (
    "genai-uml-assistant-" +
    datetime.now().strftime("%Y%m%d-%H%M%S") + ".dump"
)
env = os.environ.copy()
env["PGPASSWORD"] = url.password
cmd = [
    str(pg_dump),
    "-h", url.host or "localhost",
    "-p", str(url.port or 5432),
    "-U", url.username or "postgres",
    "-d", url.database,
    "-Fc",
    "-f", str(backup_file),
]
try:
    result = subprocess.run(cmd, env=env, check=False)
finally:
    env.pop("PGPASSWORD", None)
if result.returncode != 0:
    backup_file.unlink(missing_ok=True)
    raise SystemExit("BACKUP THAT BAI; khong tiep tuc sua DB")
if not backup_file.exists() or backup_file.stat().st_size == 0:
    backup_file.unlink(missing_ok=True)
    raise SystemExit("File backup rong hoac khong ton tai")
# Xác minh cấu trúc archive có thể đọc được.
check = subprocess.run(
    [str(pg_restore), "-l", str(backup_file)],
    capture_output=True,
    text=True,
    check=False,
)
if check.returncode != 0:
    raise SystemExit("File da tao nhung kiem tra archive that bai")
print("BACKUP VA KIEM TRA ARCHIVE THANH CONG")
print("File:", backup_file)
print("Dung luong:", backup_file.stat().st_size, "bytes")
print("Database:", url.database)
