(() => {
  // PRATT OIL official website GA4 web data stream.
  const GA_MEASUREMENT_ID = "G-PY30RMKXMD";

  let excluded = !/^(www\.)?pratt-oil\.com$/i.test(window.location.hostname);
  try { excluded ||= localStorage.getItem("pratt_analytics_opt_out") === "1"; } catch (_) {}
  if (excluded || !/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) {
    window.prattAnalyticsReady = false;
    return;
  }
  if (window.prattAnalyticsReady) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer.push(arguments);
  };

  const tag = document.createElement("script");
  tag.async = true;
  tag.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_MEASUREMENT_ID)}`;
  document.head.appendChild(tag);

  window.gtag("js", new Date());
  const cleanURL = value => {
    if (!value) return "";
    try { const url = new URL(value, window.location.origin); return url.origin + url.pathname; }
    catch (_) { return ""; }
  };
  const visit = new URL(window.location.href);
  const campaign = {};
  for (const [query, field] of Object.entries({utm_source:"campaign_source",utm_medium:"campaign_medium",utm_campaign:"campaign_name",utm_id:"campaign_id",utm_term:"campaign_term",utm_content:"campaign_content"})) {
    const value = visit.searchParams.get(query);
    if (value) campaign[field] = value.slice(0, 100);
  }
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true, page_location: cleanURL(window.location.href),
    page_referrer: cleanURL(document.referrer), ...campaign
  });

  window.prattAnalyticsReady = true;

  // Only fixed interaction categories are sent. Form values and contact URLs
  // can contain personal information and must never become event parameters.
  const pageLocation = () => {
    const canonical = document.querySelector('link[rel="canonical"]');
    const url = new URL(canonical ? canonical.href : window.location.pathname, window.location.origin);
    return url.origin + url.pathname;
  };
  const path = new URL(pageLocation()).pathname;
  const isProduct = Boolean(document.querySelector("[data-product-overview], [data-product-detail-inquiry], .wcb-cn-hero, .brake-band-summary-copy"));
  const productSlug = isProduct ? (path.match(/\/products\/([a-z0-9-]+)\//) || [])[1] || "other" : "none";
  const pageType = isProduct ? "product" : /\/contact\//.test(path) ? "contact" : path === "/" || path === "/ar/" ? "homepage" : "other";
  const track = (name, parameters = {}) => {
    window.gtag("event", name, {
      ...parameters,
      page_location: pageLocation(),
      page_type: pageType,
      product_slug: productSlug,
      ui_language: document.documentElement.lang === "ar" ? "ar" : "en"
    });
  };

  const formSelector = "[data-product-detail-inquiry], [data-contact-inquiry], [data-quote-form], [data-zq-inquiry]";
  const formKind = form => form?.matches("[data-product-detail-inquiry], [data-zq-inquiry]") ? "product"
    : form?.matches("[data-contact-inquiry]") ? "contact" : form?.matches("[data-quote-form]") ? "homepage" : "other";
  const started = new WeakSet();
  const start = event => {
    const form = event.target?.closest?.(formSelector);
    if (!form || started.has(form)) return;
    started.add(form);
    track("inquiry_start", {form_kind: formKind(form)});
  };
  document.addEventListener("input", start, true);
  document.addEventListener("change", start, true);

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
    const placement = link.closest(".floating-whatsapp") ? "floating"
      : link.closest(".product-overview, .standard-product-hero") ? "product_hero"
      : link.closest("header") ? "header"
      : link.closest("footer") ? "footer"
      : link.closest("form") ? "form" : "content";
    if (method) track("contact_click", {contact_method: method, contact_placement: placement});
    else if (url.origin === window.location.origin && url.hash === "#product_inquiry_form") {
      track("inquiry_open", {contact_placement: placement, form_kind: "product"});
    }
  }, true);

  document.addEventListener("pratt:inquiry-draft-prepared", event => {
    const kind = event.detail && event.detail.form_kind;
    track("inquiry_draft_prepared", {
      contact_method: event.detail?.contact_method === "email" ? "email" : "whatsapp",
      form_kind: ["product", "contact", "homepage"].includes(kind) ? kind : "other"
    });
  });
  if (isProduct) track("product_view");
})();
