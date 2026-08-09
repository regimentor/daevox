from pathlib import Path

from memory_service.domain.errors import bad_request


class VaultPaths:
    def __init__(self, vault_root: Path):
        self.root = vault_root.resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def relative(self, value: str) -> Path:
        if not value or "\x00" in value:
            raise bad_request("path is empty or contains NUL")
        candidate = Path(value)
        if candidate.is_absolute() or candidate.suffix.lower() != ".md":
            raise bad_request("path must be a relative Markdown path")
        resolved = (self.root / candidate).resolve()
        try:
            resolved.relative_to(self.root)
        except ValueError as exc:
            raise bad_request("path escapes the Vault") from exc
        return resolved.relative_to(self.root)

    def absolute(self, value: str) -> Path:
        relative = self.relative(value)
        absolute = self.root / relative
        if absolute.exists() and absolute.resolve() != absolute:
            raise bad_request("symlinked note paths are not supported")
        return absolute

    def display(self, path: Path) -> str:
        return path.resolve().relative_to(self.root).as_posix()

    def scan(self) -> list[Path]:
        if not self.root.exists():
            return []
        return sorted(
            path
            for path in self.root.rglob("*.md")
            if ".git" not in path.parts and ".obsidian" not in path.parts and path.is_file()
        )
