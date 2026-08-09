SCHEMA = """
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    path TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    raw_content TEXT NOT NULL,
    created_at TEXT,
    updated_at TEXT,
    indexed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chunks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    heading_path TEXT NOT NULL,
    content TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    UNIQUE(note_id, position)
);
CREATE TABLE IF NOT EXISTS tags (
    tag TEXT PRIMARY KEY
);
CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag TEXT NOT NULL REFERENCES tags(tag) ON DELETE CASCADE,
    PRIMARY KEY(note_id, tag)
);
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_text TEXT NOT NULL,
    target_note_id TEXT REFERENCES notes(id) ON DELETE SET NULL,
    target_heading TEXT,
    alias TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS chunk_fts USING fts5(
    content, heading_path, title, path,
    note_id UNINDEXED, chunk_id UNINDEXED,
    tokenize='unicode61'
);
CREATE TABLE IF NOT EXISTS index_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
"""


def vector_schema(dimension: int) -> str:
    return (
        "CREATE VIRTUAL TABLE IF NOT EXISTS chunk_vectors "
        f"USING vec0(embedding float[{dimension}]);"
    )
