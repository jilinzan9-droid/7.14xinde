# Deployment Checklist

## Production deployment

- GitHub repository: `jilinzan9-droid/7.14xinde`, branch `main`.
- Pushes to `main` run the **Deploy Pratt Oil to Tencent** GitHub Actions workflow.
- Production: `https://www.pratt-oil.com/`, Tencent server `43.160.235.91`.
- Nginx site root remains `/var/www/html/demo/pratt-oil-oilfield`.
- The workflow packages only tracked static website files. The receiver validates every file before switching the active release and checks the served homepage and release marker.
- A failed server health check restores the previous version. The original website and five recent releases remain available for recovery.
- Check the workflow result in GitHub Actions after pushing. Manual reruns are available through **Run workflow** on `main`.
- Deployment details and recovery commands are in `deploy/README.md`. The example Nginx file is not applied by the workflow.

## Google Analytics

1. The `PRATT OIL 网站` GA4 property uses China time (UTC+08:00).
2. The `PRATT OIL 官方网站` web data stream is configured for `https://www.pratt-oil.com/`, Measurement ID `G-PY30RMKXMD`.
3. The shared `assets/js/analytics.js` contains this ID. Each public page loads it once; the admin page is excluded.
4. After deployment, open the site in a normal browser and check Google Analytics Realtime to confirm receipt; queuing the tag does not prove that Google has received it.
5. To see today's users and page views, open Google Analytics Reports and set the date to Today. Collection starts when the tag is installed, and processed reports may take 24–48 hours to populate.

## Site Standard

- Every public HTML page must include the shared `analytics.js` with `defer` before `</head>`. Use a valid path and update its version parameter when the tracking configuration changes.
- Keep only English and Arabic language options.
- Commit changes to the static site root, including `assets/`, `en/`, `ar/`, `index.html`, `styles.css`, `script.js`, `robots.txt`, and `sitemap.xml`, and push to `main` to deploy.
- Do not upload `source-images/` or `tools/` to the public server unless they are intentionally needed for maintenance.
