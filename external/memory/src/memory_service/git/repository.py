from __future__ import annotations

import re
import subprocess
import threading
from pathlib import Path

from memory_service.domain.errors import ServiceError, conflict, not_found


class GitRepository:
    def __init__(self, root: Path, settings):
        self.root = root
        self.settings = settings
        self._lock = threading.RLock()

    def _run(self, *args: str, check: bool = True) -> str:
        try:
            result = subprocess.run(
                ["git", *args],
                cwd=self.root,
                text=True,
                capture_output=True,
                check=False,
                timeout=30,
            )
        except (OSError, subprocess.TimeoutExpired) as exc:
            raise ServiceError(503, "git_unavailable", str(exc)) from exc
        if check and result.returncode:
            raise ServiceError(409, "git_error", result.stderr.strip() or "Git command failed")
        return result.stdout

    @property
    def initialized(self) -> bool:
        result = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=self.root,
            text=True,
            capture_output=True,
            check=False,
        )
        return result.returncode == 0 and result.stdout.strip() == "true"

    def init(self) -> dict[str, object]:
        with self._lock:
            if not self.initialized:
                self._run("init")
            return {"initialized": True, "path": str(self.root)}

    def status(self) -> dict[str, object]:
        with self._lock:
            if not self.initialized:
                return {"initialized": False, "entries": []}
            output = self._run("status", "--porcelain", "--untracked-files=all")
            return {"initialized": True, "entries": output.splitlines()}

    def diff(self) -> str:
        with self._lock:
            if not self.initialized:
                return ""
            return self._run("diff", "--", "*.md")

    def checkpoint(self, message: str) -> dict[str, object]:
        with self._lock:
            if not self.initialized:
                raise conflict("Vault is not a Git repository; call /v1/git/init first")
            # This pathspec stages only Markdown under the Vault. `--only` on
            # commit keeps unrelated pre-existing staged files out of the commit.
            self._run("add", "-A", "--", "*.md")
            result = subprocess.run(
                ["git", "diff", "--cached", "--quiet", "--", "*.md"],
                cwd=self.root,
                capture_output=True,
                check=False,
            )
            if result.returncode == 0:
                return {"created": False}
            args = []
            if self.settings.git_author_name:
                args.extend(["-c", f"user.name={self.settings.git_author_name}"])
            if self.settings.git_author_email:
                args.extend(["-c", f"user.email={self.settings.git_author_email}"])
            self._run(*args, "commit", "--only", "-m", message, "--", "*.md")
            commit = self._run("rev-parse", "HEAD").strip()
            return {"created": True, "commit": commit, "message": message}

    def history(self, path: str | None = None, limit: int = 50) -> list[dict[str, str]]:
        with self._lock:
            if not self.initialized:
                return []
            args = ["log", f"-{limit}", "--date=iso-strict", "--format=%H%x09%aI%x09%an%x09%s"]
            if path:
                args.extend(["--follow", "--", path])
            rows = []
            for line in self._run(*args).splitlines():
                commit, timestamp, author, message = line.split("\t", 3)
                rows.append(
                    {"commit": commit, "timestamp": timestamp, "author": author, "message": message}
                )
            return rows

    def show(self, revision: str, path: str, note_id: str | None = None) -> str:
        with self._lock:
            if not self.initialized:
                raise not_found("Vault is not a Git repository")
            if not re.fullmatch(r"[A-Za-z0-9_./~^-]+", revision):
                raise conflict("invalid Git revision")
            verified = subprocess.run(
                ["git", "rev-parse", "--verify", f"{revision}^{{commit}}"],
                cwd=self.root,
                text=True,
                capture_output=True,
                check=False,
            )
            if verified.returncode:
                raise not_found(f"Git revision not found: {revision}")
            try:
                return self._run("show", f"{revision}:{path}")
            except ServiceError as exc:
                if note_id is None:
                    raise not_found(f"historical file not found: {path}") from exc
                historical_path = self._find_path_by_id(revision, note_id)
                if historical_path is None:
                    raise not_found(f"historical file not found for note: {note_id}") from exc
                return self._run("show", f"{revision}:{historical_path}")

    def _find_path_by_id(self, revision: str, note_id: str) -> str | None:
        paths = self._run("ls-tree", "-r", "--name-only", revision).splitlines()
        for path in paths:
            if not path.lower().endswith(".md"):
                continue
            try:
                raw = self._run("show", f"{revision}:{path}")
            except ServiceError:
                continue
            if re.search(rf"(?m)^id:\s*{re.escape(note_id)}\s*$", raw):
                return path
        return None
