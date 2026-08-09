from __future__ import annotations

import sqlite3
import threading
from pathlib import Path

from memory_service.database.schema import SCHEMA, vector_schema


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._vector_loaded = False

    def connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.path, timeout=30)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute("PRAGMA busy_timeout = 30000")
        try:
            import sqlite_vec

            connection.enable_load_extension(True)
            sqlite_vec.load(connection)
            self._vector_loaded = True
        except (ImportError, AttributeError, OSError, sqlite3.Error):
            self._vector_loaded = False
        finally:
            try:
                connection.enable_load_extension(False)
            except (AttributeError, sqlite3.Error):
                pass
        return connection

    def initialize(self, dimension: int | None = None) -> None:
        with self._lock, self.connect() as connection:
            connection.executescript(SCHEMA)
            if dimension:
                existing = connection.execute(
                    "SELECT value FROM index_meta WHERE key='embedding_dimension'"
                ).fetchone()
                if existing and existing[0] != str(dimension):
                    connection.execute("DROP TABLE IF EXISTS chunk_vectors")
                connection.execute(vector_schema(dimension))
                connection.execute(
                    "INSERT INTO index_meta(key, value) VALUES('embedding_dimension', ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (str(dimension),),
                )
            connection.commit()

    @property
    def vector_available(self) -> bool:
        return self._vector_loaded

    def transaction(self):
        return self._lock
