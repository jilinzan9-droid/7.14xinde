#!/usr/bin/env python3
"""Build a deterministic, allowlisted static-site release from tracked files."""

import argparse
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import subprocess
import sys
import tarfile
import tempfile


DIRECTORIES = {"assets", "en", "ar", "admin", "privacy-policy", "terms"}
ROOT_FILES = {
    "index.html", "styles.css", "script.js", "robots.txt", "sitemap.xml",
    "DEPLOYMENT-CHECKLIST.md", "IMAGE-SLOTS.md",
    "google64ce287d7385b530.html",
}
STATIC_SUFFIXES = {
    ".html", ".css", ".js", ".json", ".xml", ".txt", ".csv", ".md", ".webmanifest",
    ".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".ico", ".avif",
    ".woff", ".woff2", ".ttf", ".otf", ".eot", ".pdf",
    ".mp4", ".webm", ".mp3", ".ogg", ".wav",
}
BACKUP_NAME = re.compile(r"(^|[._-])(bak|backup|backups|old|orig|save|tmp|temp)([._-]|$)", re.I)
PRIVATE_KEY = re.compile(br"-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----")
CHUNK_SIZE = 1024 * 1024
MAX_FILES = 5000
MAX_FILE_BYTES = 128 * 1024 * 1024
MAX_TOTAL_BYTES = 512 * 1024 * 1024
MAX_MANIFEST_BYTES = 1024 * 1024


def git_output(root, *arguments):
    return subprocess.run(
        ["git", "-C", str(root), *arguments], check=True,
        stdout=subprocess.PIPE, stderr=subprocess.PIPE,
    ).stdout


def allowed_path(path):
    """Reject hidden files, credentials, backups and executable server files."""
    parts = PurePosixPath(path).parts
    if not parts or path != "/".join(parts) or "\\" in path or ":" in path:
        return False
    if PurePosixPath(path).is_absolute() or any(
        part in {".", ".."} or part.startswith(".")
        or any(ord(character) < 32 or ord(character) == 127 for character in part)
        or part.endswith("~") or BACKUP_NAME.search(part)
        or part.lower().startswith(("id_rsa", "id_dsa", "id_ecdsa", "id_ed25519"))
        for part in parts
    ):
        return False
    if len(parts) == 1:
        return path in ROOT_FILES
    return parts[0] in DIRECTORIES and PurePosixPath(path).suffix.lower() in STATIC_SUFFIXES


def regular_file(root, relative):
    """Check each path component so a linked directory cannot be included."""
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        metadata = current.lstat()
        if stat.S_ISLNK(metadata.st_mode) or getattr(metadata, "st_file_attributes", 0) & 0x400:
            return None
    return current if stat.S_ISREG(current.lstat().st_mode) else None


def tracked_files(root):
    files = []
    for record in git_output(root, "ls-files", "--stage", "-z").split(b"\0"):
        if not record:
            continue
        metadata, name = record.split(b"\t", 1)
        mode, _object_id, stage = metadata.split()
        relative = name.decode("utf-8")
        if not allowed_path(relative):
            continue
        if stage != b"0":
            raise ValueError(f"Unresolved Git conflict: {relative}")
        if mode not in {b"100644", b"100755"}:
            continue
        source = regular_file(root, relative)
        if source is not None:
            files.append((relative, source))
    files.sort(key=lambda item: item[0])
    if not files or not any(relative == "index.html" for relative, _ in files):
        raise ValueError("The tracked website must include a regular index.html")
    if len(files) > MAX_FILES:
        raise ValueError(f"The release exceeds {MAX_FILES} static files")
    return files


def file_record(relative, source):
    digest = hashlib.sha256()
    size = 0
    previous = b""
    with source.open("rb") as handle:
        while chunk := handle.read(CHUNK_SIZE):
            if PRIVATE_KEY.search(previous + chunk):
                raise ValueError(f"Private key content found in static file: {relative}")
            digest.update(chunk)
            size += len(chunk)
            if size > MAX_FILE_BYTES:
                raise ValueError(f"Static file exceeds 128 MiB: {relative}")
            previous = chunk[-128:]
    return {"path": relative, "size": size, "sha256": digest.hexdigest()}


class HashingReader:
    def __init__(self, handle):
        self.handle = handle
        self.digest = hashlib.sha256()

    def read(self, size=-1):
        chunk = self.handle.read(size)
        self.digest.update(chunk)
        return chunk


def tar_info(name, size):
    if len(name.encode("utf-8")) > 512:
        raise ValueError(f"Release member path exceeds 512 UTF-8 bytes: {name}")
    member = tarfile.TarInfo(name)
    member.size = size
    member.mode = 0o644
    member.uid = member.gid = 0
    member.uname = member.gname = ""
    member.mtime = 0
    return member


def build_release(root, output, commit):
    root = root.resolve()
    output = output.absolute()
    # Never overwrite source files, including a tracked non-site file.
    tracked_names = git_output(root, "ls-files", "-z").split(b"\0")
    if output.resolve() == Path(__file__).resolve() or any(
        name and output.resolve() == (root / name.decode("utf-8")).resolve()
        for name in tracked_names
    ):
        raise ValueError("The archive output cannot overwrite a tracked file or this script")
    if output.is_symlink() or (output.exists() and not output.is_file()):
        raise ValueError("The archive output must be a regular file path")
    output.parent.mkdir(parents=True, exist_ok=True)
    output.unlink(missing_ok=True)
    temporary = None
    try:
        if not re.fullmatch(r"[0-9a-f]{40}", commit):
            raise ValueError("--commit must be a full 40-character lowercase Git SHA")
        if git_output(root, "rev-parse", "HEAD").decode("ascii").strip() != commit:
            raise ValueError("--commit must match the checked-out Git HEAD")
        sources = tracked_files(root)
        records = [file_record(relative, source) for relative, source in sources]
        manifest = json.dumps(
            {"schema_version": 1, "commit": commit, "files": records},
            ensure_ascii=False, sort_keys=True, separators=(",", ":"),
        ).encode("utf-8") + b"\n"
        if len(manifest) > MAX_MANIFEST_BYTES:
            raise ValueError("The release manifest exceeds 1 MiB")
        if len(manifest) + sum(record["size"] for record in records) > MAX_TOTAL_BYTES:
            raise ValueError("The unpacked release exceeds 512 MiB")
        with tempfile.NamedTemporaryFile(
            prefix=".pratt-release-", suffix=".tmp", dir=output.parent, delete=False,
        ) as raw:
            temporary = Path(raw.name)
            with gzip.GzipFile(filename="", mode="wb", fileobj=raw, mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
                    archive.addfile(tar_info("manifest.json", len(manifest)), io.BytesIO(manifest))
                    for (relative, source), record in zip(sources, records):
                        if regular_file(root, relative) != source:
                            raise ValueError(f"File became a link or non-regular file: {relative}")
                        with source.open("rb") as handle:
                            reader = HashingReader(handle)
                            archive.addfile(tar_info("site/" + relative, record["size"]), reader)
                            if handle.read(1) or reader.digest.hexdigest() != record["sha256"]:
                                raise ValueError(f"File changed during packaging: {relative}")
            raw.flush()
            os.fsync(raw.fileno())
        os.replace(temporary, output)
        temporary = None
        return len(records)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    arguments = parser.parse_args()
    try:
        count = build_release(Path(__file__).resolve().parents[1], arguments.output, arguments.commit)
    except (OSError, ValueError, subprocess.CalledProcessError, tarfile.TarError) as error:
        print(f"Release build failed: {error}", file=sys.stderr)
        return 1
    print(f"Built {count} static files for {arguments.commit}: {arguments.output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
