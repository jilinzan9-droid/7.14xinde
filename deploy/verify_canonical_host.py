#!/usr/bin/env python3
"""Read-only production routing checks; no JavaScript, analytics or inquiry sent."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import urllib.error
import urllib.request

CANONICAL = 'https://www.pratt-oil.com'

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def check(case):
    url, expected = case
    opener = urllib.request.build_opener(NoRedirect())
    observed = []
    current = url
    for _ in range(5):
        request = urllib.request.Request(current, method='HEAD', headers={'User-Agent': 'Pratt-Canonical-Host-Verification/1.0', 'Cache-Control': 'no-cache'})
        for attempt in range(2):
            try:
                response = opener.open(request, timeout=20)
                break
            except urllib.error.HTTPError as response_error:
                response = response_error
                break
            except (urllib.error.URLError, TimeoutError):
                if attempt == 1:
                    raise
        with response:
            status = response.code
            location = response.headers.get('Location')
        observed.append([status, location])
        if status not in {301, 302, 303, 307, 308}:
            break
        if not location or not location.startswith(CANONICAL + '/'):
            raise AssertionError(('unexpected redirect origin', current, location))
        current = location
    if observed != expected:
        raise AssertionError({'url': url, 'expected': expected, 'observed': observed})
    print('Verified ' + url, flush=True)
    return {'url': url, 'chain': observed, 'passed': True}

def cases():
    samples = ['/', '/en/products/14p220-mud-pump-spare-parts/?part=1295174&source=website', '/en/%63ontact/?part=NB005%2E06%2E00&check=1']
    for origin in ['http://pratt-oil.com', 'http://www.pratt-oil.com', 'https://pratt-oil.com']:
        for path in samples:
            yield origin+path, [[301, CANONICAL+path], [200, None]]
    for path in ['/', '/en/products/burovoy-gidravlicheskiy-klyuch-serii-zq/', '/en/news/national-14p220-legacy-blak-jak-parts-reference/', '/robots.txt', '/sitemap.xml']:
        yield CANONICAL+path, [[200, None]]
    yield 'https://pratt-oil.com/en/en/contact/?check=1', [[301, CANONICAL+'/en/contact/?check=1'], [200, None]]
    legacy = '/demo/pratt-oil-oilfield/en/news/page/2/?check=1'
    yield 'http://pratt-oil.com'+legacy, [[301, CANONICAL+legacy], [301, CANONICAL+'/en/news/page/2/?check=1'], [200, None]]
    missing = '/canonical-host-nonexistent-20261110/'
    yield 'https://pratt-oil.com'+missing, [[301, CANONICAL+missing], [404, None]]
    yield CANONICAL+missing, [[404, None]]

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, help='Optional private verification report path')
    options = parser.parse_args()
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(check, cases()))
    report = {'status': 'passed', 'checks': len(results), 'results': results}
    if options.output:
        options.output.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps({'status': 'passed', 'checks': len(results)}))

if __name__ == '__main__':
    main()
