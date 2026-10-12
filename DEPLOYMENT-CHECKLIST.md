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

1. Create a Google Analytics 4 property for the production domain.
2. Open Admin > Data streams > Web and copy the Measurement ID, for example `G-ABC123DEF4`.
3. Replace `G-XXXXXXXXXX` in `assets/js/analytics.js` with the real Measurement ID before uploading.
4. After deployment, open the site once in a normal browser and check Google Analytics Realtime.
5. To see today's visits, use Google Analytics Reports with the date set to Today.

## Site Standard

- Every HTML page must include `<script src="/assets/js/analytics.js" defer></script>` before `</head>`.
- Keep only English and Arabic language options.
- Commit changes to the static site root, including `assets/`, `en/`, `ar/`, `index.html`, `styles.css`, `script.js`, `robots.txt`, and `sitemap.xml`, and push to `main` to deploy.
- Do not upload `source-images/` or `tools/` to the public server unless they are intentionally needed for maintenance.
