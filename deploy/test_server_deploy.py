"""Receiver safety tests. All filesystem operations stay inside TemporaryDirectory.

Run with python -B deploy/test_server_deploy.py. Linux also exercises renameat2
activation and rollback; Windows runs only archive-validation tests.
"""

import gzip
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import signal
import sys
import tarfile
import tempfile
import unittest
from unittest import mock

sys.dont_write_bytecode = True
_spec = importlib.util.spec_from_file_location(
    "pratt_receiver_under_test", Path(__file__).with_name("server_deploy.py")
)
receiver = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(receiver)

COMMIT = "a" * 40
FILES = {
    "index.html": b"<h1>English home</h1>",
    "en/index.html": b"<h1>English directory</h1>",
    "ar/index.html": "<h1>العربية</h1>".encode("utf-8"),
}
REJECTED = (ValueError, tarfile.TarError, EOFError, gzip.BadGzipFile)


class InjectedInterruption(RuntimeError):
    """A handled Linux signal sent only to this temporary-fixture test process."""


def manifest_for(files):
    return {
        "schema_version": 1,
        "commit": COMMIT,
        "files": [
            {"path": name, "size": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            for name, data in files.items()
        ],
    }


def tar_member(name, data=b"", kind=tarfile.REGTYPE, linkname=""):
    member = tarfile.TarInfo(name)
    member.type = kind
    member.size = len(data)
    member.mode = 0o644
    member.uid = member.gid = 0
    member.uname = member.gname = ""
    member.mtime = 0
    member.linkname = linkname
    return member, data


def archive_bytes(files=None, manifest=None, entries=None, include_manifest=True):
    files = FILES if files is None else files
    manifest = manifest_for(files) if manifest is None else manifest
    entries = ([tar_member("site/" + name, data) for name, data in files.items()]
               if entries is None else entries)
    output = io.BytesIO()
    with gzip.GzipFile(fileobj=output, mode="wb", mtime=0) as compressed:
        with tarfile.open(fileobj=compressed, mode="w", format=tarfile.PAX_FORMAT) as archive:
            if include_manifest:
                raw = json.dumps(manifest).encode("utf-8")
                member, data = tar_member("manifest.json", raw)
                archive.addfile(member, io.BytesIO(data))
            for member, data in entries:
                archive.addfile(member, io.BytesIO(data))
    return output.getvalue()


class ArchiveValidationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="pratt-receiver-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.site = self.root / "staged-site"
        self.site.mkdir()
        self.archive = self.root / "payload.tar.gz"
        self.live = self.root / "unchanged-live"
        self.live.mkdir()
        (self.live / "index.html").write_bytes(b"previous live version")

    def unpack(self, payload):
        self.archive.write_bytes(payload)
        return receiver.unpack(self.archive, self.site, COMMIT)

    def assert_rejected(self, payload):
        with self.assertRaises(REJECTED):
            self.unpack(payload)
        self.assertEqual((self.live / "index.html").read_bytes(), b"previous live version")
        self.assertFalse((self.root / "escape.txt").exists())

    def test_valid_homepages_and_bounded_pax_long_basename(self):
        files = dict(FILES)
        long_path = "assets/images/" + "x" * 102 + ".webp"
        files[long_path] = b"small test image"
        payload = archive_bytes(files)
        self.assertIn(b"path=site/" + long_path.encode(), gzip.decompress(payload))
        manifest = self.unpack(payload)
        self.assertEqual(manifest, manifest_for(files))
        for name, data in files.items():
            self.assertEqual((self.site / name).read_bytes(), data)
        self.assertEqual({p.relative_to(self.site).as_posix()
                          for p in self.site.rglob("*") if p.is_file()}, set(files))

    def test_parent_traversal_archive_member(self):
        entries = [tar_member("site/../escape.txt", b"must not be written")]
        self.assert_rejected(archive_bytes(entries=entries))

    def test_absolute_archive_member(self):
        self.assert_rejected(archive_bytes(entries=[tar_member("/site/index.html", b"bad")]))

    def test_traversal_inside_manifest(self):
        manifest = manifest_for(FILES)
        manifest["files"][0]["path"] = "../escape.txt"
        self.assert_rejected(archive_bytes(manifest=manifest))

    def test_hidden_path_in_manifest(self):
        files = dict(FILES, **{"assets/.private/config.json": b"{}"})
        self.assert_rejected(archive_bytes(files))

    def test_symlink_member(self):
        entry = tar_member("site/index.html", kind=tarfile.SYMTYPE, linkname="../escape.txt")
        self.assert_rejected(archive_bytes(entries=[entry]))

    def test_hardlink_member(self):
        entry = tar_member("site/en/index.html", kind=tarfile.LNKTYPE, linkname="site/index.html")
        self.assert_rejected(archive_bytes(entries=[entry]))

    def test_contiguous_member_is_not_a_regular_file(self):
        entries = [tar_member("site/" + name, data,
                              tarfile.CONTTYPE if name == "index.html" else tarfile.REGTYPE)
                   for name, data in FILES.items()]
        self.assert_rejected(archive_bytes(entries=entries))

    def test_gnu_sparse_member_is_not_a_regular_file(self):
        entries = [tar_member("site/" + name, data,
                              tarfile.GNUTYPE_SPARSE if name == "index.html" else tarfile.REGTYPE)
                   for name, data in FILES.items()]
        self.assert_rejected(archive_bytes(entries=entries))

    def test_duplicate_archive_member(self):
        entries = [tar_member("site/" + name, data) for name, data in FILES.items()]
        entries.append(tar_member("site/index.html", FILES["index.html"]))
        self.assert_rejected(archive_bytes(entries=entries))

    def test_duplicate_manifest_record(self):
        manifest = manifest_for(FILES)
        manifest["files"].append(dict(manifest["files"][0]))
        self.assert_rejected(archive_bytes(manifest=manifest))

    def test_missing_manifest(self):
        self.assert_rejected(archive_bytes(include_manifest=False))

    def test_required_homepage_missing_from_manifest(self):
        files = {name: data for name, data in FILES.items() if name != "ar/index.html"}
        self.assert_rejected(archive_bytes(files))

    def test_manifest_file_missing_from_payload(self):
        entries = [tar_member("site/" + name, data)
                   for name, data in FILES.items() if name != "ar/index.html"]
        self.assert_rejected(archive_bytes(entries=entries))

    def test_unlisted_payload_file(self):
        entries = [tar_member("site/" + name, data) for name, data in FILES.items()]
        entries.append(tar_member("site/assets/extra.txt", b"unlisted"))
        self.assert_rejected(archive_bytes(entries=entries))

    def test_incorrect_sha256(self):
        manifest = manifest_for(FILES)
        manifest["files"][0]["sha256"] = "0" * 64
        self.assert_rejected(archive_bytes(manifest=manifest))

    def test_incorrect_size(self):
        manifest = manifest_for(FILES)
        manifest["files"][0]["size"] += 1
        self.assert_rejected(archive_bytes(manifest=manifest))

    def test_wrong_commit(self):
        manifest = manifest_for(FILES)
        manifest["commit"] = "b" * 40
        self.assert_rejected(archive_bytes(manifest=manifest))

    def test_truncated_tar_payload(self):
        raw = gzip.decompress(archive_bytes())
        self.assert_rejected(gzip.compress(raw[:512], mtime=0))

    def test_truncated_gzip_footer(self):
        self.assert_rejected(archive_bytes()[:-8])

    def test_oversized_pax_is_rejected_before_payload_read(self):
        raw = json.dumps(manifest_for(FILES)).encode()
        first, _ = tar_member("manifest.json", raw)
        extended = tarfile.TarInfo("PaxHeaders/oversized")
        extended.type = tarfile.XHDTYPE
        extended.size = 16 * 1024 + 1
        # Deliberately omit the announced PAX data: the size guard must fail first.
        tar = (first.tobuf(format=tarfile.USTAR_FORMAT) + raw + bytes(-len(raw) % 512)
               + extended.tobuf(format=tarfile.USTAR_FORMAT))
        self.archive.write_bytes(gzip.compress(tar, mtime=0))
        with self.assertRaisesRegex(ValueError, "oversized PAX"):
            receiver.unpack(self.archive, self.site, COMMIT)
        self.assertEqual(list(self.site.iterdir()), [])

    def test_pax_metadata_other_than_path_is_rejected(self):
        entry = tar_member("site/index.html", FILES["index.html"])
        entry[0].pax_headers = {"mtime": "0"}
        self.assert_rejected(archive_bytes(entries=[entry]))

    def test_manifest_and_expanded_limits(self):
        payload = archive_bytes()
        with mock.patch.object(receiver, "MAX_MANIFEST", 16):
            self.assert_rejected(payload)
        with mock.patch.object(receiver, "MAX_EXPANDED", 1):
            self.assert_rejected(payload)


@unittest.skipUnless(sys.platform.startswith("linux"), "renameat2 activation tests require Linux")
class LinuxActivationTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="pratt-activate-test-")
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.releases = self.root / "releases"
        self.releases.mkdir()
        self.live = self.root / "live"
        self.backups = self.root / "backups"
        for name, value in (("BASE", self.root), ("RELEASES", self.releases),
                            ("LIVE", self.live), ("BACKUPS", self.backups)):
            patch = mock.patch.object(receiver, name, value)
            patch.start()
            self.addCleanup(patch.stop)
        self.new_site = self.make_site("new", b"new release")

    def make_site(self, name, content):
        site = self.releases / name / "site"
        site.mkdir(parents=True)
        (site / "index.html").write_bytes(content)
        return site

    def assert_no_temporary_links(self):
        self.assertEqual(list(self.root.glob(".pratt-next-*")), [])
        self.assertEqual(list(self.root.glob(".pratt-restore-*")), [])

    def install_interrupt_handlers(self):
        def interrupted(signum, frame):
            raise InjectedInterruption("injected signal " + str(signum))

        for signum in (signal.SIGTERM, signal.SIGINT, signal.SIGALRM):
            previous = signal.signal(signum, interrupted)
            self.addCleanup(signal.signal, signum, previous)

    def make_original_directory(self):
        self.live.mkdir()
        (self.live / "index.html").write_bytes(b"original directory")

    def assert_original_directory_restored(self):
        self.assertTrue(self.live.is_dir())
        self.assertFalse(self.live.is_symlink())
        self.assertEqual((self.live / "index.html").read_bytes(), b"original directory")
        self.assertEqual(list(self.backups.iterdir()), [])
        self.assert_no_temporary_links()

    def test_initial_directory_conversion_preserves_backup(self):
        self.live.mkdir()
        (self.live / "index.html").write_bytes(b"original directory")
        checked = []
        backup = receiver.activate(self.new_site, self.live, self.backups,
                                   lambda: checked.append(self.live.resolve()))
        self.assertTrue(self.live.is_symlink())
        self.assertEqual(self.live.resolve(), self.new_site.resolve())
        self.assertEqual(checked, [self.new_site.resolve()])
        self.assertTrue(backup.is_dir())
        self.assertFalse(backup.is_symlink())
        self.assertEqual((backup / "index.html").read_bytes(), b"original directory")
        self.assert_no_temporary_links()

    def test_initial_health_failure_restores_original_directory(self):
        self.live.mkdir()
        (self.live / "index.html").write_bytes(b"original directory")

        def fail_health():
            self.assertEqual(self.live.resolve(), self.new_site.resolve())
            raise RuntimeError("simulated unhealthy release")

        with self.assertRaisesRegex(RuntimeError, "simulated unhealthy"):
            receiver.activate(self.new_site, self.live, self.backups, fail_health)
        self.assertTrue(self.live.is_dir())
        self.assertFalse(self.live.is_symlink())
        self.assertEqual((self.live / "index.html").read_bytes(), b"original directory")
        self.assertEqual(list(self.backups.iterdir()), [])
        self.assert_no_temporary_links()

    def test_existing_symlink_switch_success(self):
        previous = self.make_site("previous", b"previous release")
        self.live.symlink_to(previous, target_is_directory=True)
        backup = receiver.activate(self.new_site, self.live, self.backups, lambda: None)
        self.assertIsNone(backup)
        self.assertEqual(self.live.resolve(), self.new_site.resolve())
        self.assertEqual((previous / "index.html").read_bytes(), b"previous release")
        self.assert_no_temporary_links()

    def test_existing_symlink_health_failure_restores_previous_release(self):
        previous = self.make_site("previous", b"previous release")
        self.live.symlink_to(previous, target_is_directory=True)

        def fail_health():
            self.assertEqual(self.live.resolve(), self.new_site.resolve())
            raise RuntimeError("simulated unhealthy release")

        with self.assertRaisesRegex(RuntimeError, "simulated unhealthy"):
            receiver.activate(self.new_site, self.live, self.backups, fail_health)
        self.assertTrue(self.live.is_symlink())
        self.assertEqual(self.live.resolve(), previous.resolve())
        self.assertEqual((self.live / "index.html").read_bytes(), b"previous release")
        self.assert_no_temporary_links()

    def test_unmanaged_symlink_is_rejected_without_switch(self):
        unmanaged = self.root / "outside-releases"
        unmanaged.mkdir()
        self.live.symlink_to(unmanaged, target_is_directory=True)
        check = mock.Mock()
        with self.assertRaises(ValueError):
            receiver.activate(self.new_site, self.live, self.backups, check)
        self.assertEqual(self.live.resolve(), unmanaged.resolve())
        check.assert_not_called()
        self.assert_no_temporary_links()

    def test_symlink_interrupt_after_successful_replace_rolls_back(self):
        self.install_interrupt_handlers()
        previous = self.make_site("previous", b"previous release")
        self.live.symlink_to(previous, target_is_directory=True)
        replace = receiver.os.replace
        injected = False

        def replace_then_interrupt(source, destination):
            nonlocal injected
            result = replace(source, destination)
            if destination == self.live and not injected:
                injected = True
                os.kill(os.getpid(), signal.SIGTERM)
            return result

        health = mock.Mock()
        with mock.patch.object(receiver.os, "replace", replace_then_interrupt):
            with self.assertRaises(InjectedInterruption):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertTrue(injected)
        self.assertEqual(self.live.resolve(), previous.resolve())
        self.assertEqual((previous / "index.html").read_bytes(), b"previous release")
        health.assert_not_called()
        self.assert_no_temporary_links()

    def test_initial_interrupt_after_exchange_restores_original(self):
        self.install_interrupt_handlers()
        self.make_original_directory()
        exchange = receiver.exchange
        injected = False

        def exchange_then_interrupt(first, second):
            nonlocal injected
            result = exchange(first, second)
            if not injected:
                injected = True
                os.kill(os.getpid(), signal.SIGINT)
            return result

        health = mock.Mock()
        with mock.patch.object(receiver, "exchange", exchange_then_interrupt):
            with self.assertRaises(InjectedInterruption):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertTrue(injected)
        health.assert_not_called()
        self.assert_original_directory_restored()

    def test_initial_interrupt_after_backup_move_restores_original(self):
        self.install_interrupt_handlers()
        self.make_original_directory()
        replace = receiver.os.replace
        injected = False

        def replace_then_interrupt(source, destination):
            nonlocal injected
            result = replace(source, destination)
            if destination.parent == self.backups and not injected:
                injected = True
                os.kill(os.getpid(), signal.SIGALRM)
            return result

        health = mock.Mock()
        with mock.patch.object(receiver.os, "replace", replace_then_interrupt):
            with self.assertRaises(InjectedInterruption):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertTrue(injected)
        health.assert_not_called()
        self.assert_original_directory_restored()

    def test_symlink_interrupt_during_rollback_finishes_restoration(self):
        self.install_interrupt_handlers()
        previous = self.make_site("previous", b"previous release")
        self.live.symlink_to(previous, target_is_directory=True)
        replace = receiver.os.replace
        injected = False

        def replace_then_interrupt(source, destination):
            nonlocal injected
            result = replace(source, destination)
            if source.name.startswith(".pratt-restore-"):
                injected = True
                os.kill(os.getpid(), signal.SIGINT)
            return result

        health = mock.Mock(side_effect=RuntimeError("simulated unhealthy release"))
        with mock.patch.object(receiver.os, "replace", replace_then_interrupt):
            with self.assertRaises(InjectedInterruption):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertTrue(injected)
        self.assertEqual(self.live.resolve(), previous.resolve())
        self.assertEqual((previous / "index.html").read_bytes(), b"previous release")
        self.assert_no_temporary_links()

    def test_initial_interrupt_during_rollback_keeps_original_directory(self):
        self.install_interrupt_handlers()
        self.make_original_directory()
        exchange = receiver.exchange
        calls = 0

        def exchange_then_interrupt(first, second):
            nonlocal calls
            result = exchange(first, second)
            calls += 1
            if calls == 2:
                os.kill(os.getpid(), signal.SIGTERM)
            return result

        health = mock.Mock(side_effect=RuntimeError("simulated unhealthy release"))
        with mock.patch.object(receiver, "exchange", exchange_then_interrupt):
            with self.assertRaises(InjectedInterruption):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertEqual(calls, 2)
        self.assert_original_directory_restored()

    def test_symlink_exception_after_rename_uses_actual_live_state(self):
        previous = self.make_site("previous", b"previous release")
        self.live.symlink_to(previous, target_is_directory=True)
        replace = receiver.os.replace
        injected = False

        def replace_then_raise(source, destination):
            nonlocal injected
            result = replace(source, destination)
            if destination == self.live and not injected:
                injected = True
                raise RuntimeError("injected exception after rename")
            return result

        health = mock.Mock()
        with mock.patch.object(receiver.os, "replace", replace_then_raise):
            with self.assertRaisesRegex(RuntimeError, "after rename"):
                receiver.activate(self.new_site, self.live, self.backups, health)
        self.assertEqual(self.live.resolve(), previous.resolve())
        health.assert_not_called()
        self.assert_no_temporary_links()

    def test_initial_exception_after_exchange_uses_actual_live_state(self):
        self.make_original_directory()
        exchange = receiver.exchange
        injected = False

        def exchange_then_raise(first, second):
            nonlocal injected
            result = exchange(first, second)
            if not injected:
                injected = True
                raise RuntimeError("injected exception after exchange")
            return result

        health = mock.Mock()
        with mock.patch.object(receiver, "exchange", exchange_then_raise):
            with self.assertRaisesRegex(RuntimeError, "after exchange"):
                receiver.activate(self.new_site, self.live, self.backups, health)
        health.assert_not_called()
        self.assert_original_directory_restored()

    def test_initial_backup_move_failure_does_not_delete_original(self):
        self.make_original_directory()
        replace = receiver.os.replace

        def fail_backup_move(source, destination):
            if destination.parent == self.backups:
                raise OSError("injected backup move failure")
            return replace(source, destination)

        health = mock.Mock()
        with mock.patch.object(receiver.os, "replace", fail_backup_move):
            with self.assertRaisesRegex(OSError, "backup move failure"):
                receiver.activate(self.new_site, self.live, self.backups, health)
        health.assert_not_called()
        self.assert_original_directory_restored()


if __name__ == "__main__":
    unittest.main(verbosity=2)
