#!/usr/bin/python3 -I
"""Restricted SSH receiver for Pratt Oil static releases (Linux, Python stdlib)."""

from contextlib import contextmanager
import ctypes
import datetime
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import signal
import subprocess
import sys
import tarfile
import tempfile
import uuid

LIVE = Path('/var/www/html/demo/pratt-oil-oilfield')
BASE = Path('/var/lib/pratt-oil')
RELEASES = BASE / 'releases'
BACKUPS = Path('/var/backups/pratt-oil')
ROOT_FILES = {'index.html', 'styles.css', 'script.js', 'robots.txt', 'sitemap.xml',
              'DEPLOYMENT-CHECKLIST.md', 'IMAGE-SLOTS.md'}
SITE_DIRS = {'assets', 'en', 'ar', 'admin', 'privacy-policy', 'terms'}
EXTENSIONS = {'.html', '.css', '.js', '.json', '.xml', '.txt', '.md', '.csv',
              '.webp', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.ico', '.avif',
              '.woff', '.woff2', '.ttf', '.otf', '.eot', '.pdf', '.webmanifest',
              '.mp4', '.webm', '.mp3', '.ogg', '.wav'}
MAX_ARCHIVE = 256 * 1024 * 1024
MAX_EXPANDED = 512 * 1024 * 1024
MAX_FILE = 128 * 1024 * 1024
MAX_MANIFEST = 1024 * 1024
MAX_FILES = 5000
CHUNK = 256 * 1024
SHA = re.compile(r'^[a-f0-9]{40}$')
RELEASE_NAME = re.compile(r'^\d{8}T\d{6}Z-[a-f0-9]{12}-[a-f0-9]{8}$')


def site_path(name):
    if not isinstance(name, str) or not name or len(name.encode('utf-8')) > 512:
        raise ValueError('Invalid site path')
    parts = name.split('/')
    if '\\' in name or any(not p or p.startswith('.') for p in parts):
        raise ValueError('Hidden, absolute or relative paths are forbidden')
    if any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise ValueError('Control characters are forbidden')
    p = PurePosixPath(name)
    if name not in ROOT_FILES and (len(parts) < 2 or parts[0] not in SITE_DIRS):
        raise ValueError('Path is outside the website allowlist')
    if p.suffix.lower() not in EXTENSIONS:
        raise ValueError('File is not a supported static asset')
    if re.search(r'(?:\.(?:bak|backup|old|orig|swp|tmp)(?:$|\.)|[-_]backup$)', name, re.I):
        raise ValueError('Backup files are forbidden')
    return p


def read_exact(stream, size):
    result = bytearray()
    while len(result) < size:
        block = stream.read(min(CHUNK, size - len(result)))
        if not block:
            raise ValueError('Truncated archive')
        result.extend(block)
    return bytes(result)


def parse_manifest(raw, commit):
    manifest = json.loads(raw)
    if manifest.get('schema_version') != 1 or manifest.get('commit') != commit:
        raise ValueError('Manifest version or commit mismatch')
    files = manifest.get('files')
    if not isinstance(files, list) or not 1 <= len(files) <= MAX_FILES:
        raise ValueError('Invalid manifest file count')
    expected = {}
    total = 0
    for record in files:
        name = record['path']
        site_path(name)
        size = record['size']
        digest = record['sha256']
        if type(size) is not int or not 0 <= size <= MAX_FILE:
            raise ValueError('Invalid file size')
        if not isinstance(digest, str) or not re.fullmatch('[a-f0-9]{64}', digest):
            raise ValueError('Invalid SHA256')
        if name in expected:
            raise ValueError('Duplicate manifest path')
        expected[name] = (size, digest)
        total += size
    if total > MAX_EXPANDED:
        raise ValueError('Release is too large')
    if not {'index.html', 'ar/index.html'} <= expected.keys():
        raise ValueError('Required homepages are missing')
    return manifest, expected


def parse_pax(raw):
    """Support bounded PAX long names, with no sizes, links or sparse extensions."""
    position = 0
    path = None
    while position < len(raw):
        separator = raw.find(b' ', position)
        if separator < 0 or separator - position > 8:
            raise ValueError('Invalid PAX length')
        length = int(raw[position:separator])
        if length <= separator - position + 2 or position + length > len(raw):
            raise ValueError('Invalid PAX record')
        record = raw[separator + 1:position + length]
        if not record.endswith(b'\n') or not record.startswith(b'path=') or path is not None:
            raise ValueError('Only a single PAX path record is accepted')
        path = record[5:-1].decode('utf-8', 'strict')
        position += length
    if path is None:
        raise ValueError('Empty PAX header')
    return path


def unpack(archive, site, commit):
    """Read tar headers ourselves, bounding extended metadata before parsing."""
    expected = None
    seen = set()
    expanded = 0
    manifest = None
    pending_path = None
    with gzip.open(archive, 'rb') as stream:
        while True:
            header = read_exact(stream, 512)
            expanded += 512
            if header == bytes(512):
                if pending_path is not None:
                    raise ValueError('PAX header has no following file')
                if read_exact(stream, 512) != bytes(512):
                    raise ValueError('Invalid tar terminator')
                expanded += 512
                while True:
                    tail = stream.read(CHUNK)
                    if not tail:
                        break
                    expanded += len(tail)
                    if expanded > MAX_EXPANDED + 16 * 1024 * 1024 or any(tail):
                        raise ValueError('Invalid archive padding')
                break
            member = tarfile.TarInfo.frombuf(header, 'utf-8', 'strict')
            if header[257:263] != b'ustar\x00':
                raise ValueError('Expected a POSIX tar header')
            if member.type == tarfile.XHDTYPE:
                if pending_path is not None or not 0 < member.size <= 16 * 1024:
                    raise ValueError('Invalid or oversized PAX header')
                pending_path = parse_pax(read_exact(stream, member.size))
                if any(read_exact(stream, -member.size % 512)):
                    raise ValueError('Invalid PAX padding')
                expanded += member.size + (-member.size % 512)
                continue
            if member.type not in {tarfile.REGTYPE, tarfile.AREGTYPE}:
                raise ValueError('Only regular files and bounded path headers are allowed')
            if pending_path is not None:
                member.name = pending_path
                pending_path = None
            if member.linkname or not 0 <= member.size <= MAX_FILE:
                raise ValueError('Invalid member type or size')
            expanded += member.size + (-member.size % 512)
            if expanded > MAX_EXPANDED + 16 * 1024 * 1024:
                raise ValueError('Expanded archive is too large')
            if expected is None:
                if member.name != 'manifest.json' or member.size > MAX_MANIFEST:
                    raise ValueError('First member must be the bounded manifest')
                raw = read_exact(stream, member.size)
                manifest, expected = parse_manifest(raw, commit)
            else:
                if not member.name.startswith('site/'):
                    raise ValueError('Unexpected archive member')
                name = member.name[5:]
                relative = site_path(name)
                if name in seen or name not in expected or expected[name][0] != member.size:
                    raise ValueError('Duplicate, unexpected or incorrectly sized member')
                destination = site.joinpath(*relative.parts)
                destination.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
                digest = hashlib.sha256()
                remaining = member.size
                with destination.open('xb') as target:
                    while remaining:
                        block = stream.read(min(CHUNK, remaining))
                        if not block:
                            raise ValueError('Truncated file data')
                        target.write(block)
                        digest.update(block)
                        remaining -= len(block)
                destination.chmod(0o644)
                if digest.hexdigest() != expected[name][1]:
                    raise ValueError('File SHA256 mismatch: ' + name)
                seen.add(name)
            padding = read_exact(stream, -member.size % 512)
            if any(padding):
                raise ValueError('Invalid file padding')
    if expected is None or seen != expected.keys():
        raise ValueError('Manifest and payload files differ')
    return manifest


def exchange(a, b):
    """Atomically exchange a directory and symlink on the Ubuntu filesystem."""
    libc = ctypes.CDLL(None, use_errno=True)
    rename = libc.renameat2
    rename.argtypes = [ctypes.c_int, ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p, ctypes.c_uint]
    rename.restype = ctypes.c_int
    if rename(-100, os.fsencode(a), -100, os.fsencode(b), 2) != 0:
        error = ctypes.get_errno()
        raise OSError(error, os.strerror(error))


def health_check(commit):
    command = ['/usr/bin/curl', '--noproxy', '*', '--resolve', 'www.pratt-oil.com:443:127.0.0.1',
               '--fail', '--silent', '--show-error', '--max-time', '15']
    subprocess.run(command + ['--output', '/dev/null', 'https://www.pratt-oil.com/'], check=True)
    subprocess.run(command + ['--output', '/dev/null', 'https://www.pratt-oil.com/styles.css'], check=True)
    result = subprocess.check_output(command + [
        'https://www.pratt-oil.com/__pratt_release.json?commit=' + commit])
    if json.loads(result).get('commit') != commit:
        raise RuntimeError('The served release is not the requested commit')


@contextmanager
def deployment_signals_blocked():
    """Defer deployment interrupts until filesystem transitions are consistent."""
    if not hasattr(signal, 'pthread_sigmask'):
        # Activation runs on Linux; archive validation also runs on Windows.
        yield
        return
    interrupts = {signal.SIGTERM, signal.SIGINT, signal.SIGALRM}
    previous = signal.pthread_sigmask(signal.SIG_BLOCK, interrupts)
    try:
        yield
    finally:
        signal.pthread_sigmask(signal.SIG_SETMASK, previous)


def activate(site, live, backups, check):
    temporary = live.parent / ('.pratt-next-' + uuid.uuid4().hex)
    restore = live.parent / ('.pratt-restore-' + uuid.uuid4().hex)
    old_target = None
    initial_backup = None
    try:
        with deployment_signals_blocked():
            temporary.symlink_to(site, target_is_directory=True)
            if live.is_symlink():
                old_target = live.resolve(strict=True)
                old_target.relative_to(RELEASES.resolve())
                os.replace(temporary, live)
            elif live.is_dir():
                backups.mkdir(parents=True, exist_ok=True, mode=0o700)
                initial_backup = backups / ('initial-' + uuid.uuid4().hex)
                exchange(temporary, live)
                os.replace(temporary, initial_backup)
            else:
                raise RuntimeError('Expected an existing website directory or managed symlink')
        check()
    except BaseException:
        with deployment_signals_blocked():
            # A signal or syscall wrapper can fail after the rename succeeded.
            # Determine whether rollback is needed from the live filesystem.
            if live.is_symlink() and live.resolve() == site.resolve():
                if old_target is not None:
                    restore.symlink_to(old_target, target_is_directory=True)
                    os.replace(restore, live)
                elif initial_backup is not None:
                    if initial_backup.is_dir() and not initial_backup.is_symlink():
                        original = initial_backup
                    elif temporary.is_dir() and not temporary.is_symlink():
                        original = temporary
                    else:
                        raise RuntimeError('Cannot find the original website for rollback')
                    exchange(original, live)
                    original.unlink()  # The failed release's symlink after exchange.
        raise
    finally:
        with deployment_signals_blocked():
            # Never remove a directory: it may be the original website if a
            # filesystem error interrupted first-install backup or rollback.
            for pending in (temporary, restore):
                if pending.is_symlink():
                    pending.unlink()
    return initial_backup


def cleanup_releases(active):
    candidates = sorted((p for p in RELEASES.iterdir()
                         if p.is_dir() and not p.is_symlink() and RELEASE_NAME.fullmatch(p.name)),
                        key=lambda p: p.name, reverse=True)
    keep = {active.parent, *candidates[:5]}
    for candidate in candidates:
        if candidate not in keep and candidate.resolve().parent == RELEASES.resolve():
            shutil.rmtree(candidate)


def main():
    command = os.environ.get('SSH_ORIGINAL_COMMAND', '')
    match = re.fullmatch(r'deploy ([a-f0-9]{40})', command)
    if match is None:
        raise ValueError('This key only accepts: deploy <40-character commit>')
    commit = match.group(1)
    def interrupted(signum, frame):
        raise RuntimeError('Deployment interrupted or timed out')
    signal.signal(signal.SIGTERM, interrupted)
    signal.signal(signal.SIGINT, interrupted)
    signal.signal(signal.SIGALRM, interrupted)
    signal.alarm(15 * 60)
    os.umask(0o022)
    BASE.mkdir(parents=True, exist_ok=True, mode=0o755)
    RELEASES.mkdir(exist_ok=True, mode=0o755)
    import fcntl
    with (BASE / 'deploy.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if shutil.disk_usage(BASE).free < 1024 * 1024 * 1024:
            raise RuntimeError('Less than 1 GiB free: deploy aborted')
        timestamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        release = RELEASES / (timestamp + '-' + commit[:12] + '-' + uuid.uuid4().hex[:8])
        archive = None
        complete = False
        try:
            with tempfile.NamedTemporaryFile(dir=BASE, prefix='incoming-', suffix='.tar.gz', delete=False) as target:
                archive = Path(target.name)
                size = 0
                while True:
                    block = sys.stdin.buffer.read(CHUNK)
                    if not block:
                        break
                    size += len(block)
                    if size > MAX_ARCHIVE:
                        raise ValueError('Compressed archive is too large')
                    target.write(block)
            release.mkdir(mode=0o755)
            site = release / 'site'
            site.mkdir(mode=0o755)
            manifest = unpack(archive, site, commit)
            (release / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
            (release / 'manifest.json').chmod(0o600)
            marker = {'commit': commit, 'published_at': timestamp,
                      'file_count': len(manifest['files'])}
            (site / '__pratt_release.json').write_text(json.dumps(marker) + '\n')
            backup = activate(site, LIVE, BACKUPS, lambda: health_check(commit))
            complete = True
            try:
                cleanup_releases(site)
            except OSError as error:
                print('Release cleanup warning: ' + str(error), file=sys.stderr)
            print(json.dumps({**marker, 'status': 'deployed', 'initial_backup': str(backup) if backup else None}))
        finally:
            if archive is not None:
                archive.unlink(missing_ok=True)
            active = LIVE.is_symlink() and LIVE.resolve() == release / 'site'
            if not complete and not active and release.exists() and release.resolve().parent == RELEASES.resolve():
                shutil.rmtree(release)


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print('Deployment failed: ' + str(exc), file=sys.stderr)
        sys.exit(1)
