ALTER TABLE specification
    ALTER COLUMN user_story_id DROP NOT NULL;

ALTER TABLE specification
    ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES project(id);

WITH ranked AS (
    SELECT
        id,
        FIRST_VALUE(id) OVER (
            PARTITION BY user_story_id, type
            ORDER BY version DESC, id DESC
        ) AS retained_id,
        ROW_NUMBER() OVER (
            PARTITION BY user_story_id, type
            ORDER BY version DESC, id DESC
        ) AS position
    FROM specification
    WHERE user_story_id IS NOT NULL
)
UPDATE use_case
SET specification_id = ranked.retained_id
FROM ranked
WHERE use_case.specification_id = ranked.id
  AND ranked.position > 1;

WITH ranked AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY user_story_id, type
            ORDER BY version DESC, id DESC
        ) AS position
    FROM specification
    WHERE user_story_id IS NOT NULL
)
DELETE FROM specification
WHERE id IN (SELECT id FROM ranked WHERE position > 1);

CREATE INDEX IF NOT EXISTS ix_specification_project_id
    ON specification (project_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_specification_story_type
    ON specification (user_story_id, type)
    WHERE user_story_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_specification_project_type
    ON specification (project_id, type)
    WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS srs_document (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL UNIQUE REFERENCES project(id),
    intro_purpose TEXT NOT NULL DEFAULT '',
    intro_scope TEXT NOT NULL DEFAULT '',
    intro_definitions TEXT NOT NULL DEFAULT '',
    overview_user_classes TEXT NOT NULL DEFAULT '',
    overview_environment TEXT NOT NULL DEFAULT '',
    appendix_notes TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
