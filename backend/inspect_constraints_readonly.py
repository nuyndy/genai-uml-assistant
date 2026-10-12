from sqlalchemy import inspect
from database.db import engine, Base
from database import models
inspector = inspect(engine)
print("=== 1. KIEU DU LIEU / NULL / DEFAULT ===")
for table_name in sorted(Base.metadata.tables):
    model_table = Base.metadata.tables[table_name]
    db_columns = {
        c["name"]: c
        for c in inspector.get_columns(table_name)
    }
    for name, model_col in model_table.columns.items():
        db_col = db_columns[name]
        model_type = model_col.type.compile(dialect=engine.dialect)
        db_type = db_col["type"].compile(dialect=engine.dialect)
        if (
            str(model_type).lower() != str(db_type).lower()
            or model_col.nullable != db_col["nullable"]
        ):
            print(
                f"{table_name}.{name}: "
                f"model(type={model_type}, nullable={model_col.nullable}) | "
                f"db(type={db_type}, nullable={db_col['nullable']})"
            )
print("\n=== 2. FOREIGN KEYS TRONG DATABASE ===")
for table_name in sorted(Base.metadata.tables):
    for fk in inspector.get_foreign_keys(table_name):
        cols = ", ".join(fk.get("constrained_columns") or [])
        ref_cols = ", ".join(fk.get("referred_columns") or [])
        print(
            f"{table_name}.{fk.get('name')}: "
            f"({cols}) -> {fk.get('referred_table')}({ref_cols}); "
            f"ondelete={fk.get('options', {}).get('ondelete')}"
        )
print("\n=== 3. UNIQUE / CHECK CONSTRAINTS ===")
for table_name in sorted(Base.metadata.tables):
    for item in inspector.get_unique_constraints(table_name):
        print(f"UNIQUE {table_name}: {item}")
    for item in inspector.get_check_constraints(table_name):
        print(f"CHECK {table_name}: {item}")
print("\n=== 4. INDEXES TRONG DATABASE ===")
for table_name in sorted(Base.metadata.tables):
    for item in inspector.get_indexes(table_name):
        print(f"INDEX {table_name}: {item}")
print("\n=== HOAN TAT - READ ONLY ===")
engine.dispose()
