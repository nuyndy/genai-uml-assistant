-- Store human-readable progress for long-running FR consolidation.
ALTER TABLE functional_consolidation_checkpoint ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'starting';
ALTER TABLE functional_consolidation_checkpoint ADD COLUMN current_batch INTEGER NOT NULL DEFAULT 0;
ALTER TABLE functional_consolidation_checkpoint ADD COLUMN total_batches INTEGER NOT NULL DEFAULT 0;
ALTER TABLE functional_consolidation_checkpoint ADD COLUMN status_message TEXT NOT NULL DEFAULT 'Đang chuẩn bị tổng hợp...';
