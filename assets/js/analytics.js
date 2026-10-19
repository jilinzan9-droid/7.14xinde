(() => {
  // PRATT OIL official website GA4 web data stream.
  const GA_MEASUREMENT_ID = "G-PY30RMKXMD";

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

  // Only fixed interaction categories are sent. Form values and contact URLs
  // can contain personal information and must never become event parameters.
  const pageLocation = () => {
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = new URL(canonical ? canonical.href : window.location.pathname, window.location.origin);
    return url.origin + url.pathname;
  };
  const track = (name, parameters) => {
    window.gtag("event", name, {
      ...parameters,
      page_location: pageLocation(),
      ui_language: document.documentElement.lang === "ar" ? "ar" : "en"
    });
  };

  document.addEventListener("click", event => {
    const link = event.target && event.target.closest ? event.target.closest("a[href]") : null;
    if (!link) return;
    let url;
    try { url = new URL(link.href, window.location.origin); }
    catch (_) { return; }
    let method;
    if (url.protocol === "mailto:") method = "email";
    else if (url.protocol === "tel:") method = "phone";
    else if (["api.whatsapp.com", "wa.me", "web.whatsapp.com"].includes(url.hostname)) method = "whatsapp";
    else return;
    const placement = link.closest("header") ? "header"
      : link.closest("footer") ? "footer"
      : link.closest("form") ? "form" : "content";
    track("contact_click", {contact_method: method, contact_placement: placement});
  }, true);

  document.addEventListener("pratt:inquiry-draft-prepared", event => {
    const kind = event.detail && event.detail.form_kind;
    track("inquiry_draft_prepared", {
      contact_method: "whatsapp",
      form_kind: ["product", "contact", "homepage"].includes(kind) ? kind : "other"
    });
  });
})();
