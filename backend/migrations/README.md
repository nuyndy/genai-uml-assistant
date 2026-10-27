# Project ownership migration

Run `001_add_project_owner.sql` once against the PostgreSQL database before
deploying the updated backend. The migration deliberately leaves `user_id`
nullable so existing projects are preserved and are not assigned to an
arbitrary account.

After identifying the correct owner of each existing project, assign it
explicitly before that owner needs to access it:

```sql
UPDATE project
SET user_id = <users.id>
WHERE id = <project.id>;
```

Find account IDs by querying the `users` table for the signed-in account's
email. New projects are assigned to the authenticated user by the API.
Project listing and all Stage 1 and Stage 2 endpoints enforce ownership.
Keep the column nullable only while legacy rows still need owner assignment.
After all existing projects have been assigned, make `user_id` non-null in the
database and set `nullable=False` in the `Project` model.

Run `002_add_srs_specifications.sql` once after `001_add_project_owner.sql` to
make specification stories nullable, associate project-level non-functional
specifications with their project, and create the editable SRS metadata table.
The migration keeps the latest functional specification per story and re-points
existing use cases to it before removing older duplicate rows.

PDF export requires `reportlab` and an installed Unicode TrueType font such as
DejaVu Sans or Arial for Vietnamese text.

Functional and non-functional specification generation uses the local Ollama
service. Start Ollama and install the selected model with `ollama pull
qwen2.5:3b`. Configure `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, and
`OLLAMA_TIMEOUT_SECONDS` as needed; defaults are
`http://localhost:11434`, `qwen2.5:3b`, and 900 seconds.

Run `005_functional_consolidation_checkpoint.sql` once to enable resumable functional-requirement consolidation. The API stores each completed batch separately and reuses those batches on retry while the project's User Stories remain unchanged. Existing official FRs are only replaced after all batches pass validation.


Run `006_functional_consolidation_progress.sql` after migration 005 to add live status fields for the FR consolidation overlay. The frontend polls the status endpoint and displays the current batch, completed batches, and the current backend activity (for example, waiting for Ollama, validating traceability, or saving results).
