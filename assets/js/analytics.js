(() => {
  // Set the site's real GA4 Measurement ID after the property is created.
  const GA_MEASUREMENT_ID = "";

  if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) {
    window.prattAnalyticsReady = false;
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(tag);

  window.gtag("js", new Date());
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true,
    anonymize_ip: true
  });

  window.prattAnalyticsReady = true;
})();
