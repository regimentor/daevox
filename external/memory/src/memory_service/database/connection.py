from __future__ import annotations

import logging
import sqlite3
import threading
from pathlib import Path

from memory_service.database.schema import SCHEMA, vector_schema

logger = logging.getLogger(__name__)


class Database:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._vector_loaded = False
        self._vector_schema_ready = False
        self._vector_load_attempted = False
        self._vector_error: str | None = None
        self._vector_error_logged = False

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
            self._vector_error = None
        except Exception as exc:
            self._vector_loaded = False
            self._vector_error = str(exc)
            if not self._vector_error_logged:
                logger.warning(
                    "sqlite-vec unavailable; semantic index disabled error=%s",
                    self._vector_error,
                    extra={"error": self._vector_error},
                )
                self._vector_error_logged = True
        finally:
            self._vector_load_attempted = True
            try:
                connection.enable_load_extension(False)
            except (AttributeError, sqlite3.Error):
                pass
        return connection

    def initialize(self, dimension: int | None = None) -> None:
        with self._lock, self.connect() as connection:
            connection.executescript(SCHEMA)
            if dimension and self._vector_loaded:
                existing = connection.execute(
                    "SELECT value FROM index_meta WHERE key='embedding_dimension'"
                ).fetchone()
                if existing and existing[0] != str(dimension):
                    connection.execute("DROP TABLE IF EXISTS chunk_vectors")
                try:
                    connection.execute(vector_schema(dimension))
                    self._vector_schema_ready = True
                except sqlite3.Error as exc:
                    self._vector_schema_ready = False
                    self._vector_error = str(exc)
                    logger.warning(
                        "failed to initialize sqlite-vec schema dimension=%s error=%s",
                        dimension,
                        self._vector_error,
                        extra={"dimension": dimension, "error": self._vector_error},
                    )
                connection.execute(
                    "INSERT INTO index_meta(key, value) VALUES('embedding_dimension', ?) "
                    "ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                    (str(dimension),),
                )
            connection.commit()
        logger.info(
            "database initialized path=%s vector_available=%s embedding_dimension=%s",
            self.path,
            self.vector_available,
            dimension,
            extra={
                "path": str(self.path),
                "vector_available": self.vector_available,
                "embedding_dimension": dimension,
            },
        )

    @property
    def vector_available(self) -> bool:
        return self._vector_loaded and self._vector_schema_ready

    def transaction(self):
        return self._lock
