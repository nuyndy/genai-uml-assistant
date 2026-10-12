BEGIN;
-- 1. Project glossary
CREATE TABLE IF NOT EXISTS glossary_term (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES project(id) ON DELETE CASCADE,
    term VARCHAR(255) NOT NULL,
    canonical_term VARCHAR(255) NOT NULL,
    aliases JSONB NOT NULL DEFAULT '[]'::jsonb,
    definition TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_glossary_project_term
        UNIQUE (project_id, canonical_term)
);
CREATE INDEX IF NOT EXISTS ix_glossary_project
    ON glossary_term(project_id);
-- 2. Traceability between project elements
CREATE TABLE IF NOT EXISTS trace_link (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES project(id) ON DELETE CASCADE,
    source_type VARCHAR(50) NOT NULL,
    source_id INTEGER NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id INTEGER NOT NULL,
    relation_type VARCHAR(50) NOT NULL DEFAULT 'traces_to',
    rationale TEXT NOT NULL DEFAULT '',
    validation_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    validation_message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_trace_link_not_self
        CHECK (
            source_type <> target_type
            OR source_id <> target_id
        ),
    CONSTRAINT ck_trace_link_validation_status
        CHECK (
            validation_status IN ('pending', 'valid', 'invalid')
        ),
    CONSTRAINT uq_trace_link
        UNIQUE (
            project_id, source_type, source_id,
            target_type, target_id, relation_type
        )
);
CREATE INDEX IF NOT EXISTS ix_trace_link_project
    ON trace_link(project_id);
CREATE INDEX IF NOT EXISTS ix_trace_link_source
    ON trace_link(project_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS ix_trace_link_target
    ON trace_link(project_id, target_type, target_id);
-- 3. Whole-project baseline snapshots
CREATE TABLE IF NOT EXISTS project_baseline (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES project(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    snapshot JSONB NOT NULL,
    open_issues JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMPTZ NULL,
    CONSTRAINT uq_project_baseline_version
        UNIQUE (project_id, version),
    CONSTRAINT ck_project_baseline_status
        CHECK (status IN ('draft', 'approved', 'archived'))
);
CREATE INDEX IF NOT EXISTS ix_project_baseline_project
    ON project_baseline(project_id, version DESC);
-- 4. Generic version history for requirement, story and SRS entities
CREATE TABLE IF NOT EXISTS entity_revision (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL
        REFERENCES project(id) ON DELETE CASCADE,
    entity_type VARCHAR(50) NOT NULL,
    entity_id INTEGER NOT NULL,
    version INTEGER NOT NULL,
    content JSONB NOT NULL,
    change_type VARCHAR(30) NOT NULL DEFAULT 'update',
    change_note TEXT NOT NULL DEFAULT '',
    created_by INTEGER
        REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_entity_revision_version
        UNIQUE (project_id, entity_type, entity_id, version)
);
CREATE INDEX IF NOT EXISTS ix_entity_revision_lookup
    ON entity_revision(project_id, entity_type, entity_id, version DESC);
COMMIT;