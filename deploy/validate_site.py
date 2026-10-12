#!/usr/bin/env python3
"""Check the actual static website before publishing, using only the standard library."""

from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET
from build_release import allowed_path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.pratt-oil.com'
PREFIX = '/demo/pratt-oil-oilfield'
HOSTS = {'pratt-oil.com', 'www.pratt-oil.com'}
CSS_URL = re.compile(r'url\(\s*([\x22\x27]?)(.*?)\1\s*\)', re.I | re.S)


def address(relative):
    if relative == 'index.html':
        return ORIGIN + '/'
    return ORIGIN + '/' + (relative[:-10] if relative.endswith('/index.html') else relative)


def target(url):
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or parsed.hostname not in HOSTS:
        return None
    path = unquote(parsed.path)
    if path == PREFIX:
        path = '/'
    elif path.startswith(PREFIX + '/'):
        path = path[len(PREFIX):]
    candidate = ROOT / path.lstrip('/')
    if path.endswith('/') or candidate.is_dir():
        candidate /= 'index.html'
    if not candidate.resolve().is_relative_to(ROOT.resolve()):
        raise ValueError(f'Internal URL escapes the website directory: {url}')
    if not allowed_path(candidate.relative_to(ROOT).as_posix()):
        raise ValueError(f'Internal URL is outside the deployable static files: {url}')
    return candidate


class Page(HTMLParser):
    def __init__(self, relative):
        super().__init__(convert_charrefs=True)
        self.relative = relative
        self.base = address(relative)
        self.references = []
        self.ids = set()
        self.canonical = []
        self.lang = ''
        self.hreflang = []
        self.noindex = False
        self.refresh = False
        self.jsonld = []
        self.capture = None
        self.parts = []

    def reference(self, value):
        if value and '${' not in value and '{{' not in value:
            self.references.append((self.getpos()[0], urljoin(self.base, value)))

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag == 'html':
            self.lang = (attrs.get('lang') or '').lower().split('-')[0]
        if tag == 'base' and attrs.get('href'):
            self.base = urljoin(self.base, attrs['href'])
        if attrs.get('id'):
            self.ids.add(attrs['id'])
        if tag == 'a' and attrs.get('name'):
            self.ids.add(attrs['name'])
        for key in ('href', 'src', 'action', 'formaction', 'poster'):
            self.reference(attrs.get(key))
        if attrs.get('srcset') and not attrs['srcset'].startswith('data:'):
            for entry in attrs['srcset'].split(','):
                if entry.strip():
                    self.reference(entry.strip().split()[0])
        for match in CSS_URL.finditer(attrs.get('style', '')):
            self.reference(match[2])
        if tag == 'link' and 'canonical' in (attrs.get('rel') or '').lower().split():
            self.canonical.append(urljoin(self.base, attrs.get('href', '')))
        if tag == 'link' and attrs.get('hreflang') and attrs.get('href'):
            self.hreflang.append((attrs['hreflang'].lower(), urljoin(self.base, attrs['href'])))
        if tag == 'meta':
            if (attrs.get('name') or '').lower() in ('robots', 'googlebot', 'bingbot'):
                self.noindex |= 'noindex' in (attrs.get('content') or '').lower()
            self.refresh |= (attrs.get('http-equiv') or '').lower() == 'refresh'
        if tag == 'script' and attrs.get('type') == 'application/ld+json':
            self.capture = 'script'
            self.parts = []
        elif tag == 'style':
            self.capture = 'style'
            self.parts = []

    handle_startendtag = handle_starttag

    def handle_data(self, value):
        if self.capture:
            self.parts.append(value)

    def handle_endtag(self, tag):
        if self.capture != tag:
            return
        content = ''.join(self.parts)
        if tag == 'script':
            self.jsonld.append(content)
        else:
            for match in CSS_URL.finditer(content):
                self.reference(match[2])
        self.capture = None
        self.parts = []


def validate():
    errors = []
    pages = {}
    for file in sorted(ROOT.rglob('*.html')):
        if '.git' in file.parts:
            continue
        page = Page(file.relative_to(ROOT).as_posix())
        page.feed(file.read_text(encoding='utf-8-sig'))
        pages[file] = page
        for value in page.jsonld:
            try:
                json.loads(value)
            except ValueError as exc:
                errors.append(f'{page.relative}: invalid JSON-LD: {exc}')
    references = [(file, line, url) for file, page in pages.items()
                  for line, url in page.references]
    for file in ROOT.rglob('*.css'):
        if '.git' in file.parts:
            continue
        text = re.sub(r'/\*.*?\*/', '', file.read_text(encoding='utf-8-sig'), flags=re.S)
        for match in CSS_URL.finditer(text):
            references.append((file, text[:match.start()].count('\n') + 1,
                               urljoin(ORIGIN + '/' + file.relative_to(ROOT).as_posix(), match[2])))
    for file, line, url in references:
        candidate = target(url)
        if candidate is None:
            continue
        if not candidate.is_file():
            errors.append(f'{file.relative_to(ROOT)}:{line}: missing target {url}')
        else:
            fragment = unquote(urlsplit(url).fragment)
            if fragment and candidate in pages and fragment not in pages[candidate].ids:
                errors.append(f'{file.relative_to(ROOT)}:{line}: missing anchor {url}')
    ns = {'s': 'http://www.sitemaps.org/schemas/sitemap/0.9'}
    urls = [entry.text for entry in ET.parse(ROOT / 'sitemap.xml').findall('s:url/s:loc', ns)]
    if len(urls) != len(set(urls)):
        errors.append('sitemap.xml: duplicate URLs')
    expected = set()
    for file, page in pages.items():
        if page.noindex or page.refresh:
            continue
        if len(page.canonical) != 1 or target(page.canonical[0]) != file:
            errors.append(f'{page.relative}: expected one canonical pointing to this page')
        else:
            expected.add(page.canonical[0])
        if page.hreflang and not any(lang != 'x-default' and target(url) == file
                                     for lang, url in page.hreflang):
            errors.append(f'{page.relative}: missing self hreflang')
        for lang, url in page.hreflang:
            other_file = target(url)
            other = pages.get(other_file)
            if other is None:
                errors.append(f'{page.relative}: hreflang target is not a local HTML page: {url}')
                continue
            if lang != 'x-default' and other.lang != lang.split('-')[0]:
                errors.append(f'{page.relative}: hreflang language mismatch: {url}')
            if len(other.canonical) != 1 or target(other.canonical[0]) != other_file:
                errors.append(f'{page.relative}: hreflang points to a noncanonical page: {url}')
            if not any(target(back) == file for _, back in other.hreflang):
                errors.append(f'{page.relative}: hreflang has no reciprocal link: {url}')
    if set(urls) != expected:
        errors.append(f'sitemap.xml: {len(expected - set(urls))} missing, '
                      f'{len(set(urls) - expected)} unexpected URLs')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        return 1
    print(f'Validated {len(pages)} HTML pages, {len(references)} URL references, '
          f'{len(urls)} sitemap URLs, hreflang and all JSON-LD.')
    return 0


if __name__ == '__main__':
    sys.exit(validate())
