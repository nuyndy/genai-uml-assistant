ALTER TABLE project
    ADD COLUMN IF NOT EXISTS user_id INTEGER;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'fk_project_user_id_users'
          AND conrelid = 'project'::regclass
    ) THEN
        ALTER TABLE project
            ADD CONSTRAINT fk_project_user_id_users
            FOREIGN KEY (user_id) REFERENCES users(id);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS ix_project_user_id ON project (user_id);
