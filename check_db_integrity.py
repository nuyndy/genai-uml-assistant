from sqlalchemy import text
from database.db import engine
checks = {
    "Diagram không có revision cùng version": """
        SELECT COUNT(*)
        FROM diagram d
        WHERE NOT EXISTS (
            SELECT 1 FROM diagram_revision r
            WHERE r.diagram_id = d.id
              AND r.version = COALESCE(d.version, 1)
        )
    """,
    "Revision không có diagram cha": """
        SELECT COUNT(*)
        FROM diagram_revision r
        LEFT JOIN diagram d ON d.id = r.diagram_id
        WHERE d.id IS NULL
    """,
    "Requirement không có project cha": """
        SELECT COUNT(*)
        FROM raw_requirement r
        LEFT JOIN project p ON p.id = r.project_id
        WHERE p.id IS NULL
    """,
    "User story không có requirement cha": """
        SELECT COUNT(*)
        FROM user_story s
        LEFT JOIN raw_requirement r ON r.id = s.requirement_id
        WHERE r.id IS NULL
    """,
    "Use case không có specification cha": """
        SELECT COUNT(*)
        FROM use_case u
        LEFT JOIN specification s ON s.id = u.specification_id
        WHERE s.id IS NULL
    """,
    "Specification có project và story đều NULL": """
        SELECT COUNT(*)
        FROM specification
        WHERE project_id IS NULL AND user_story_id IS NULL
    """,
    "Baseline có snapshot NULL": """
        SELECT COUNT(*)
        FROM project_baseline
        WHERE snapshot IS NULL
    """,
    "Revision có version trùng trong cùng diagram": """
        SELECT COUNT(*)
        FROM (
            SELECT diagram_id, version
            FROM diagram_revision
            GROUP BY diagram_id, version
            HAVING COUNT(*) > 1
        ) duplicates
    """,
}
with engine.connect() as conn:
    for label, sql in checks.items():
        result = conn.execute(text(sql)).scalar_one()
        print(f"{label}: {result}")
engine.dispose()
