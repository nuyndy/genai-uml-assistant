from database.db import engine

try:
    conn = engine.connect()
    print("Kết nối Database thành công!")
    conn.close()
except Exception as e:
    print("Lỗi kết nối:", e)