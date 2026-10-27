-- Durable checkpoints for batched User Story -> Functional Requirement consolidation.
CREATE TABLE IF NOT EXISTS functional_consolidation_checkpoint (
    project_id INTEGER PRIMARY KEY REFERENCES project(id) ON DELETE CASCADE,
    story_signature TEXT NOT NULL,
    completed_batches TEXT NOT NULL DEFAULT '[]',
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
