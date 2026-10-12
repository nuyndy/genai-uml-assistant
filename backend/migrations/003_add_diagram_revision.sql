
CREATE TABLE IF NOT EXISTS diagram_revision (
    id SERIAL PRIMARY KEY,
    diagram_id INTEGER NOT NULL
        REFERENCES diagram(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    source_code TEXT NOT NULL,
    image_url TEXT,
    change_type VARCHAR(30) NOT NULL DEFAULT 'edit',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_diagram_revision_version
        UNIQUE (diagram_id, version)
);

CREATE INDEX IF NOT EXISTS ix_diagram_revision_diagram_id
    ON diagram_revision(diagram_id);

CREATE INDEX IF NOT EXISTS ix_diagram_revision_created_at
    ON diagram_revision(created_at);

-- Lưu phiên bản hiện tại của các biểu đồ đã tồn tại.
INSERT INTO diagram_revision (
    diagram_id, version, source_code, image_url, change_type
)
SELECT id, COALESCE(version, 1), source_code, image_url, 'baseline'
FROM diagram
ON CONFLICT (diagram_id, version) DO NOTHING;
