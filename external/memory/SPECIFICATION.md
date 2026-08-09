# Local Obsidian Memory Service Specification

## Source of truth

The configured Obsidian-compatible Markdown Vault is authoritative. SQLite stores disposable metadata, FTS5 rows and vectors. Git stores Vault history only. Deleting the SQLite database must never delete notes; startup reconciliation and `/v1/admin/reindex` rebuild all derived data from Markdown.

## Components

- FastAPI exposes typed CRUD, search, administration, health and Git endpoints.
- Markdown storage validates Vault containment, parses YAML frontmatter, and writes atomically.
- Indexer extracts headings, tags and wikilinks, creates deterministic heading-aware chunks, and updates SQLite transactionally.
- FTS5 provides BM25 lexical retrieval; sqlite-vec plus a local SentenceTransformer provides semantic retrieval.
- Hybrid retrieval combines candidate lists with Reciprocal Rank Fusion. Link expansion is optional and one-hop only.
- `watchfiles` reconciles externally edited Markdown files. Operations are idempotent and serialized per process.
- Git CLI provides explicit init, status, diff, checkpoint, history, revision read and non-destructive restore.

## Consistency and failure behavior

Markdown is written before indexing. A failed index operation leaves a valid note and can be repaired by reconciliation. FTS/metadata remain usable when embeddings are temporarily unavailable; semantic requests report `503`. SQLite transactions replace all derived rows for one note. Watcher events are treated as hints and reconciliation remains the recovery mechanism.

## Security

The service binds to loopback by default. All note paths are relative `.md` paths contained under the resolved Vault root. Git commands use argument arrays and never use a shell. Note content is data and is never executed.
