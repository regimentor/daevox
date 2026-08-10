# Implementation Plan

- [x] Bootstrap standalone uv project, configuration and FastAPI lifecycle.
- [x] Implement safe Markdown storage, frontmatter and atomic writes.
- [x] Implement Markdown parsing and deterministic heading-aware chunking.
- [x] Implement SQLite metadata, FTS5 and sqlite-vec schema.
- [x] Implement embedding abstraction and keyword/semantic/hybrid retrieval.
- [x] Implement startup reconciliation and filesystem watcher.
- [x] Implement note, search, admin, health and Git API routes.
- [x] Add comprehensive unit and integration tests.
- [x] Run lint, type checks, tests and end-to-end smoke test.

## Consistency hardening

- [x] Detect duplicate `frontmatter.id` values before indexing; preserve both Markdown files,
  return reconciliation conflict reports, and reject API ID/path collisions with `409`.
- [x] Track stale rows by `(note_id, indexed_path)` and reconcile manual rename by stable ID.
- [x] Share an operation coordinator across CRUD, watcher and rebuild; serialize Git mutations
  with a separate lock and keep rebuild atomic relative to incremental operations.

## Retrieval and degradation

- [x] Use `_split_unit` for long paragraph/list/code units, keep heading context, and preserve
  fenced-code line boundaries while enforcing ordinary-text chunk limits.
- [x] Quote user FTS5 input, escape literal path prefixes, and apply filters during link expansion.
- [x] Separate sqlite-vec extension loading from schema creation; support keyword-only fallback
  and structured `503` semantic errors.

## Git, API and verification

- [x] Resolve historical Markdown paths by note ID after rename; scope checkpoints to Vault Markdown
  and exclude unrelated staged files.
- [x] Add typed endpoint responses and generic SQLite/Git error responses without tracebacks.
- [x] Cover duplicate IDs, unindexed overwrite, rename/rebuild concurrency boundaries, chunk limits,
  FTS filters, vector fallback, Git restore across rename, staged-file isolation and disposable
  SQLite recovery. Completion checks: `uv sync`, `uv run ruff check .`, `uv run mypy src`, `uv run pytest`.
