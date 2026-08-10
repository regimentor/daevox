# Local Obsidian Memory Service Specification

## Source of truth

The configured Obsidian-compatible Markdown Vault is authoritative. SQLite stores disposable metadata, FTS5 rows and vectors. Git stores Vault history only. Deleting the SQLite database must never delete notes; startup reconciliation and `/v1/admin/reindex` rebuild all derived data from Markdown.

## Components

- FastAPI exposes typed CRUD, search, administration, health and Git endpoints.
- Markdown storage validates Vault containment, parses YAML frontmatter, and writes atomically.
- Indexer extracts headings, tags and wikilinks, creates deterministic heading-aware chunks, and updates SQLite transactionally.
- FTS5 provides BM25 lexical retrieval; sqlite-vec plus a local SentenceTransformer provides semantic retrieval.
- Hybrid retrieval combines candidate lists with Reciprocal Rank Fusion. Link expansion is optional and one-hop only.
- `watchfiles` reconciles externally edited Markdown files. CRUD, watcher reconciliation and
  full rebuild share one coordinator, so an incremental event cannot interleave with a rebuild
  or observe a partially ordered API write. Git mutations use a separate Git lock.
- Git CLI provides explicit init, status, diff, checkpoint, history, revision read and non-destructive restore.

## Consistency and failure behavior

Markdown is written before indexing. A failed index operation leaves a valid note and can be repaired by reconciliation. FTS/metadata remain usable when embeddings are temporarily unavailable; semantic requests report `503`. SQLite transactions replace all derived rows for one note. Watcher events are treated as hints and reconciliation remains the recovery mechanism.

## Identity and reconciliation

Every indexed note is identified by `frontmatter.id`; the Markdown path is an indexed
attribute, not the identity. Before indexing, reconciliation groups all Vault files by ID.
Duplicate IDs are reported and never automatically edited, deleted or allowed to overwrite
the existing indexed path. If the indexed path is still present, it remains authoritative.
If it was manually renamed, the surviving file with the same ID updates the indexed path.
Stale deletion requires the exact `(note_id, indexed_path)` pair. API create and rename reject
an occupied Markdown path even when SQLite has no row for it, and ID/path conflicts return `409`.

## Retrieval and vector fallback

User keyword queries are escaped into a safe FTS5 phrase; FTS operators are data, not syntax.
`path_prefix` is a literal path prefix and `%`/`_` are escaped. Link expansion is one-hop and
applies the same path and tag filters as the direct search. sqlite-vec extension loading and
vector schema creation are separate operations. When loading fails, no `vec0` table is
created: keyword mode remains available and semantic mode returns `503`.

## Git rename semantics

Checkpoint serializes Git init/checkpoint operations, stages Markdown files in the Vault only,
and commits them with an explicit Markdown pathspec, leaving unrelated staged files alone.
Revision reads first use the current path and then search historical Markdown paths by note ID,
so a revision before a rename can be read and restored. Restore writes a new working-tree
modification and never rewrites history. Missing revisions/files are structured `404` errors;
invalid Git input or Git command conflicts are `409`.

## Security

The service binds to loopback by default. All note paths are relative `.md` paths contained under the resolved Vault root. Git commands use argument arrays and never use a shell. Note content is data and is never executed.
