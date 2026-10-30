-- Move legacy schema compatibility changes out of application startup.
-- Safe to run after the existing migrations; IF NOT EXISTS also supports fresh
-- databases where SQLAlchemy create_all has already created these columns.

BEGIN;

ALTER TABLE actor
    ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE actor
    ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE actor
    ADD COLUMN IF NOT EXISTS main_businesses TEXT;

ALTER TABLE use_case
    ADD COLUMN IF NOT EXISTS actor TEXT;
ALTER TABLE use_case
    ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE use_case
    ADD COLUMN IF NOT EXISTS preconditions TEXT;
ALTER TABLE use_case
    ADD COLUMN IF NOT EXISTS minimal_guarantees TEXT;
ALTER TABLE use_case
    ADD COLUMN IF NOT EXISTS postconditions TEXT;

-- Multiple project-level specifications are allowed by the current domain.
DROP INDEX IF EXISTS uq_specification_project_type;

COMMIT;
