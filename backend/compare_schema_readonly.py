from sqlalchemy import inspect
from database.db import engine, Base
from database import models
inspector = inspect(engine)
db_tables = set(inspector.get_table_names())
model_tables = set(Base.metadata.tables.keys())
print("=== BANG CHI CO TRONG MODEL ===")
for name in sorted(model_tables - db_tables):
    print(name)
print("\n=== BANG CHI CO TRONG DATABASE ===")
for name in sorted(db_tables - model_tables):
    print(name)
print("\n=== COT KHAC NHAU ===")
for table_name in sorted(model_tables & db_tables):
    model_table = Base.metadata.tables[table_name]
    db_columns = {
        col["name"]: col
        for col in inspector.get_columns(table_name)
    }
    model_columns = {
        col.name: col
        for col in model_table.columns
    }
    missing = sorted(set(model_columns) - set(db_columns))
    extra = sorted(set(db_columns) - set(model_columns))
    if missing or extra:
        print(f"\n[{table_name}]")
        for col in missing:
            print(f"  THIEU TRONG DB: {col}")
        for col in extra:
            print(f"  DB CO THEM: {col}")
print("\n=== KET THUC DOI CHIEU READ-ONLY ===")
engine.dispose()
