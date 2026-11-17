from pathlib import Path
from contextlib import redirect_stderr, redirect_stdout
import io
import tempfile
import unittest
from unittest.mock import patch

import validate_site as validator


class LinkValidationTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.patch = patch.object(validator, 'ROOT', self.root)
        self.patch.start()
        validator.target_path.cache_clear()

    def tearDown(self):
        validator.target_path.cache_clear()
        self.patch.stop()
        self.directory.cleanup()

    def page(self, relative, html):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(html, encoding='utf-8')
        page = validator.Page(relative)
        page.feed(html)
        return path, page

    def test_public_breadcrumb_cannot_point_to_refresh_alias(self):
        home, home_page = self.page('index.html', '<link rel="canonical" href="https://www.pratt-oil.com/">')
        alias, alias_page = self.page('en/index.html', '<meta name="robots" content="noindex"><meta http-equiv="refresh" content="0;url=/"><link rel="canonical" href="https://www.pratt-oil.com/">')
        _, source = self.page('en/contact/index.html', '<a href="/en/">Home</a>')
        pages = {home: home_page, alias: alias_page}
        self.assertIn('noindex or refresh', validator.navigation_error(source, source.navigation[0][1], pages))
        self.assertIsNone(validator.navigation_error(source, 'https://www.pratt-oil.com/', pages))

    def test_noncanonical_prefix_is_not_a_direct_navigation_destination(self):
        path, page = self.page('en/contact/index.html', '<link rel="canonical" href="https://www.pratt-oil.com/en/contact/">')
        source = validator.Page('index.html')
        self.assertIn('noncanonical', validator.navigation_error(source, 'https://www.pratt-oil.com/demo/pratt-oil-oilfield/en/contact/', {path: page}))
        self.assertIsNone(validator.navigation_error(source, 'https://www.pratt-oil.com/en/contact/?source=parts#quote', {path: page}))

    def test_admin_source_can_keep_intentional_private_navigation(self):
        path, destination = self.page('admin/index.html', '<meta name="robots" content="noindex">')
        source = validator.Page('admin/index.html')
        source.noindex = True
        self.assertIsNone(validator.navigation_error(source, 'https://www.pratt-oil.com/admin/', {path: destination}))

    def test_wrong_case_fails_on_every_host_platform(self):
        available = {'assets/images/Pump.webp'}
        folded = {name.casefold(): name for name in available}
        self.assertIsNone(validator.file_target_error(self.root/'assets/images/Pump.webp', available, folded))
        self.assertIn('case mismatch', validator.file_target_error(self.root/'assets/images/pump.webp', available, folded))
        self.assertIn('missing target', validator.file_target_error(self.root/'assets/images/valve.webp', available, folded))

    def test_dynamic_product_images_and_lookup_sources_are_checked(self):
        page = validator.Page('en/parts-reference/index.html')
        page.feed('<button data-product-image="/assets/images/pump.webp">View photo</button><section data-parts-lookup data-source="/assets/data/parts.json"></section><div data-source="not-a-url"></div>')
        self.assertEqual([url for _, url in page.references], ['https://www.pratt-oil.com/assets/images/pump.webp', 'https://www.pratt-oil.com/assets/data/parts.json'])

    def test_correct_case_first_does_not_hide_wrong_case_reference(self):
        self.page('index.html', '<html lang="en"><link rel="canonical" href="https://www.pratt-oil.com/"><img src="/assets/images/Pump.webp"><img src="/assets/images/pump.webp"></html>')
        asset = self.root/'assets/images/Pump.webp'
        asset.parent.mkdir(parents=True)
        asset.write_bytes(b'fixture')
        (self.root/'sitemap.xml').write_text('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://www.pratt-oil.com/</loc></url></urlset>')
        messages = io.StringIO()
        with patch.object(validator, 'validate_legacy_redirects', return_value=0), redirect_stderr(messages), redirect_stdout(messages):
            self.assertEqual(validator.validate(), 1)
        self.assertIn('case mismatch: assets/images/pump.webp', messages.getvalue())


if __name__ == '__main__':
    unittest.main()
