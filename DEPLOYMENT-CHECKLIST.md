# Deployment Checklist

## Google Analytics

1. Create a Google Analytics 4 property for the production domain.
2. Open Admin > Data streams > Web and copy the Measurement ID, for example `G-ABC123DEF4`.
3. Replace `G-XXXXXXXXXX` in `assets/js/analytics.js` with the real Measurement ID before uploading.
4. After deployment, open the site once in a normal browser and check Google Analytics Realtime.
5. To see today's visits, use Google Analytics Reports with the date set to Today.

## Site Standard

- Every HTML page must include `<script src="/assets/js/analytics.js" defer></script>` before `</head>`.
- Keep only English and Arabic language options.
- Upload the full static site root to the server, including `assets/`, `en/`, `ar/`, `index.html`, `styles.css`, `script.js`, `robots.txt`, and `sitemap.xml`.
- Do not upload `source-images/` or `tools/` to the public server unless they are intentionally needed for maintenance.
