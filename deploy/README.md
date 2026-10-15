# Tencent production deployment

Pushes to `main` trigger `.github/workflows/deploy.yml`. The workflow builds an archive from tracked website files and sends it over SSH to the existing Tencent Ubuntu server. It can also be run manually on `main` from GitHub Actions.

- Website: https://www.pratt-oil.com/
- Server: `43.160.235.91`
- Nginx root: `/var/www/html/demo/pratt-oil-oilfield`
- Receiver installed by an administrator: `/usr/local/sbin/pratt-oil-github-deploy`
- Release storage: `/var/lib/pratt-oil/releases/<release-id>/site`
- Original website backup: `/var/backups/pratt-oil/initial-*`
- GitHub Actions secret: `PRATT_DEPLOY_SSH_KEY`
- Pinned public SSH host key: `deploy/known_hosts`

The deployment key is dedicated to this repository and restricted to the receiver command in `authorized_keys`. It does not provide an interactive shell. Private keys must never be committed. Changing the receiver in this repository requires an administrator to install the reviewed script on the server; a website release cannot replace it.

Only the static website directories `assets/`, `en/`, `ar/`, `admin/`, `privacy-policy/`, `terms/` and the listed root website files are packaged. Git metadata, workflow files, deployment scripts and historical backups are excluded. Each archive includes a fresh manifest with file sizes and SHA256 hashes; the receiver rejects unexpected files, links, path traversal, unsupported metadata and oversized archives. Transfers and validation use bounded chunks.

Before packaging, `python3 deploy/validate_site.py` checks the actual HTML and CSS references, anchors, canonical URLs, reciprocal hreflang, sitemap coverage and JSON-LD. A failed check stops automatic publication. This is a static-file check; it does not verify message delivery or search-engine indexing.

The receiver prepares a separate release and atomically switches the website root to it. On the first deployment it atomically exchanges the original directory and the new symlink, then preserves the original directory outside the public web root. It checks the served homepage, stylesheet and `/__pratt_release.json` against the requested commit. If this check fails, it restores the previous website. TERM, INT and ALRM interruptions are deferred during filesystem transitions and restoration; exception recovery checks the actual live target. Five recent releases and the original backup are retained. Nginx configuration and certificates are not changed.

## Site integrations

Inquiries continue through the existing public WhatsApp number. A visitor must confirm sending in WhatsApp; opening a prepared message is not a delivery confirmation. The admin page is a browser-local draft editor. Its JSON exports do not generate or publish the static website; reviewed source changes are published through this repository's `main` branch.

Google Analytics 4 is configured in `assets/js/analytics.js` for the `PRATT OIL 官方网站` web data stream, Measurement ID `G-PY30RMKXMD`. The property uses China time (UTC+08:00) for daily reports. Public pages load the shared script once; the browser-local admin page is excluded. The business has not opened a YouTube channel, so the broken placeholder channel links have been removed.

Public footers display small YouTube and Facebook icons as plain, non-interactive spans with no account URLs. Keep them unlinked until the owner supplies the official channel and page links. The standard footer reuses the existing transparent company logo, shows four information columns, and places monochrome social icons between copyright and legal links in its bottom bar. Preserve the existing dark green background, all contact links, QR codes and landing-page navigation. Compact content footers retain their own backgrounds and use a smaller logo and horizontal icon row. All social marks are local SVG assets; no platform scripts, embeds or Organization `sameAs` entries are added. The original logo and social images remain available.

Public headers include a thin white contact strip with muted local social icons and the existing sales email. YouTube and Facebook remain unlinked here as well; VK and Telegram reuse the existing footer destinations. `header-utility.css` replaces the older contact strip and accounts for the additional height in menu and sticky-sidebar spacing. Custom flex headers use a separate strip before the header. `product-visual-polish.css` keeps full product-card names visible, uses consistent image frames with `contain`, and reduces product-page spacing. Product templates omit the decorative `product-detail-reference-banner` section so breadcrumbs follow the navigation directly. Category supply links sit beneath their heading descriptions as plain text links; their landing-page destinations are preserved. Footer QR images retain their original assets and display WeChat or WhatsApp labels. Load these scoped sheets after the existing page styles.

Arabic pages load `arabic-navigation.css` last to preserve the mobile menu, the eight Arabic product categories and right-to-left layout. Language controls follow the page's existing hreflang counterpart; Arabic home navigation and breadcrumbs point to `/ar/`. Product categories use CollectionPage with an ItemList containing only the current page's visible cards. Verified component cards link to their existing detail pages. Large PNG product assets have pixel-identical lossless WebP alternatives; retain the original assets for old URLs. The shared carousel pauses while a keyboard control has focus. Sitemap modification dates change only for HTML files actually edited in a release.

Search Console ownership for `https://www.pratt-oil.com/` uses the original Google file `google64ce287d7385b530.html` at the website root. Keep this file in future releases to retain verification. The build and receiver explicitly allow this exact filename; the validator checks its original verification text and excludes it from content-page metadata and sitemap coverage. A receiver update must be installed by an administrator before publishing this file.

`product-reference-cards.css` loads after the existing styles on pages with image product cards. Only cards marked `data-product-reference="true"` receive the white rectangular layout, blue category label, left-aligned black product name and outlined arrow. Arabic cards retain right-to-left alignment. The arrow stays inside the existing product or inquiry link, and campaign quotation links are preserved. Text-only related-product lists and technical drawing controls keep their existing layouts. Keep product names fully visible and use `contain` for product images.

`product-breadcrumbs.css` loads last on RU product templates that have breadcrumb navigation. The inner breadcrumb container aligns with the category heading and content width beneath the header; the two brake-band detail layouts follow their own content container width. Arabic navigation remains right-to-left and long names wrap on mobile. The visible breadcrumb links and BreadcrumbList data retain their original destinations.

Product category grids omit the large `product-detail-inquiry` form beneath the cards and pagination. Product detail inquiry forms, the dedicated contact page and existing WhatsApp/contact links remain available. Do not add links to an inquiry-form anchor on a category page that has no corresponding form.

Pages also omit the large repeated `contact-section` directory with multiple email and WhatsApp cards beneath the main content. Links that previously targeted these removed `#contact` sections point to `/en/contact/`. Keep the shared footer contacts, dedicated contact page, product detail inquiry forms and smaller product-specific quotation sections available.

The existing `/en/news/f1600-mud-pump-spare-parts-selection-support/` guide is the English F1600 parts topic page. Its content and internal links cover replacement-part matching and quotation requirements, consistent with the owner's parts-only F1600 business. It uses a labeled cylinder-liner reference photo rather than the former F-1600HL pump photo. Preserve its canonical URL and BlogPosting type; do not invent whole-pump sales, OEM authorization, stock, technical ratings or ranking gains. `f1600-parts-guide.css` affects only this guide. Search Console performance was still processing data when this optimization was released.

News and Company News contain nine articles: the existing F1600 guide plus eight parts-identification guides published on 15 October 2026 (two mud pump, three fracturing pump and three drawworks guides). The 16 previously removed news details remain unpublished. Industry News retains its explicit empty state because the new articles are company-authored product guides. Both homepages use full-image news cards with bottom title overlays, rounded corners and manual dot navigation. The first three feature one guide from each product family; all nine guides remain static HTML links and use a responsive grid without JavaScript. The dedicated news script supports touch scrolling, keyboard navigation, reduced motion and RTL. Arabic cards identify the guides as English. The complete news list remains available. `technical-parts-guides.css` styles the new articles without changing the F1600 guide. Product catalog tables, shared images, search data and inquiry forms are retained. The admin seed contains the nine posts; existing browser-local drafts remain independent of the published static site.

The new guide keywords use the available Saudi Arabia Google-search estimates from Ahrefs Free Keyword Generator, as approved by the owner. All eight selected phrases were displayed in the same monthly volume bucket, `<100`; do not convert this into exact counts or claim it represents the combined Middle East market. Google Ads monthly volumes and volumes for other Middle East countries were not obtained. Search Console exposure and existing-page indexing observations are separate evidence, not keyword market volume or proof that newly published articles are indexed.

Product navigation points to the catalog pages. The existing landing pages and services page remain available at their original URLs for future reuse. `deploy/landing-pages.json` records these pages and their resources; preserve their source files, shared assets and unused landing images when reorganizing navigation.

## Check a release

Check the GitHub Actions run and `https://www.pratt-oil.com/__pratt_release.json`. The marker's `commit` must equal the deployed GitHub commit. The receiver returns a nonzero exit code on validation or health-check failure.

## Restore a previous release

Use an administrator SSH connection or Tencent's terminal, rather than the restricted deployment key. Inspect the available releases and the current target:

```bash
readlink -f /var/www/html/demo/pratt-oil-oilfield
ls -1 /var/lib/pratt-oil/releases
```

After choosing an existing release ID, run the following, replacing `RELEASE_ID` with that exact directory name. This takes the same lock as deployment and atomically changes the symlink:

```bash
sudo flock /var/lib/pratt-oil/deploy.lock python3 - RELEASE_ID <<'PY'
import os, pathlib, re, sys, uuid
name = sys.argv[1]
if not re.fullmatch(r'\d{8}T\d{6}Z-[a-f0-9]{12}-[a-f0-9]{8}', name):
    raise SystemExit('Invalid release ID')
target = pathlib.Path('/var/lib/pratt-oil/releases') / name / 'site'
if not (target / 'index.html').is_file():
    raise SystemExit('Release does not exist')
live = pathlib.Path('/var/www/html/demo/pratt-oil-oilfield')
temporary = live.parent / ('.pratt-rollback-' + uuid.uuid4().hex)
temporary.symlink_to(target, target_is_directory=True)
os.replace(temporary, live)
print('Restored:', target)
PY
```

Verify the homepage and marker after recovery. A subsequent successful push to `main` publishes that new commit again. Updating `admin/seed.json` does not clear data already stored in a visitor's browser localStorage.

## Static delivery settings

On 2026-10-13, the existing Tencent HTTPS server received the reviewed static delivery settings in `nginx-seo-static-cache.conf` and `nginx-seo-static-delivery.conf`. The first file is installed in `/etc/nginx/conf.d/` and defines the HTTP-context cache map. The second is installed in `/etc/nginx/snippets/` and included by the existing Pratt domain HTTPS server. These administrative configuration files are excluded from website archives; an ordinary website deployment cannot change them.

CSS, JavaScript, images and fonts receive a one-day browser cache lifetime. HTML, sitemap XML and the release marker use `Cache-Control: no-cache` so a browser revalidates documents rather than heuristically retaining an old release. This is generated by the existing `expires` map, preserving inherited security headers. Text assets receive negotiated gzip compression, with `Vary: Accept-Encoding`; the existing security headers, TLS settings, site roots and routing are preserved. Bump the stylesheet or script URL version whenever its contents change so visitors can receive a new revision immediately.

Before the change, the existing domain configuration was backed up outside the web root under `/var/backups/pratt-oil/seo-nginx-*`. Configuration validation with `nginx -t`, a reload and an HTTPS health check passed. Restore the reviewed domain configuration and remove its added include and map together if these settings need to be reverted, then validate before reloading.
