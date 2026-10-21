import json
from pathlib import Path
import tempfile
import unittest

from legacy_redirects import expanded_routes, render, safe_path


class LegacyRedirectTests(unittest.TestCase):
    def fixture(self, root, routes):
        (root / 'deploy').mkdir()
        (root / 'new').mkdir()
        (root / 'new/index.html').write_text('new page')
        (root / 'deploy/legacy-redirects.json').write_text(json.dumps({'routes': routes}))

    def test_directory_variants_and_demo_prefix(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root, [{'source': '/old/', 'target': '/new/'}])
            result = expanded_routes(root)
            self.assertEqual(len(result), 6)
            for path in ['/old', '/old/', '/old/index.html', '/demo/pratt-oil-oilfield/old/']:
                self.assertEqual(result[path], '/new/')
            self.assertNotIn('/unknown/', result)
            self.assertIn('default "";', render(root))

    def test_removed_destination_fails(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root, [{'source': '/old/', 'target': '/missing/'}])
            with self.assertRaises(ValueError):
                expanded_routes(root)

    def test_existing_content_is_not_replaced(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            self.fixture(root, [{'source': '/new/', 'target': '/new/'}])
            with self.assertRaises(ValueError):
                expanded_routes(root)

    def test_external_and_configuration_injection_are_rejected(self):
        for path in ['https://other.test/', '//other.test/', '/../etc/', '/x";', '/$host/', '/x\n', '/x?url=bad', '/x%2f']:
            self.assertFalse(safe_path(path), path)
