from dotenv import load_dotenv
load_dotenv("backend/.env")
from database.db import Base
import database.models
from sqlalchemy import inspect
for table_name, table in Base.metadata.tables.items():
    print(f"\n[{table_name}]")
    for column in table.columns:
        foreign_keys = ", ".join(
            fk.target_fullname for fk in column.foreign_keys
        )
        details = f"{column.name}: {column.type}"
        if column.primary_key:
            details += " PRIMARY KEY"
        if foreign_keys:
            details += f" -> {foreign_keys}"
        print("  " + details)
