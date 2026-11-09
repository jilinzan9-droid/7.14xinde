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
  // Preserve known campaign channels as a pair, never arbitrary query text.
  // Campaign names, IDs, terms and content can contain customer data.
  const visit = new URL(window.location.href);
  const source = (visit.searchParams.get("utm_source") || "").trim().toLowerCase();
  const medium = (visit.searchParams.get("utm_medium") || "").trim().toLowerCase();
  const campaign = ["google", "bing", "linkedin", "facebook", "youtube", "whatsapp", "newsletter"].includes(source)
    && ["organic", "cpc", "paid_social", "social", "email", "referral"].includes(medium)
    ? {campaign_source: source, campaign_medium: medium} : {};
  let referrerOrigin = "";
  try { referrerOrigin = new URL(document.referrer).origin; } catch (_) {}
  window.gtag("config", GA_MEASUREMENT_ID, {
    send_page_view: true, page_location: cleanURL(window.location.href),
    page_referrer: referrerOrigin, ...campaign
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
  const isProduct = Boolean(document.querySelector("[data-product-overview], [data-product-detail-inquiry], [data-zq-inquiry], .wcb-cn-hero, .brake-band-summary-copy"));
  const productSlug = isProduct ? (path.match(/\/products\/([a-z0-9-]+)\//) || [])[1] || "other" : "none";
  const isReference = Boolean(document.querySelector("[data-pump-reference-table], [data-parts-catalog], [data-product-reference], .lp-reference"));
  const isNews = /\/(en|ar)\/news\/[^/]+\/$/.test(path) && !/\/(company-news|industry-news)\/$/.test(path);
  const pageType = isProduct ? "product" : /\/contact\//.test(path) ? "contact"
    : path === "/" || path === "/ar/" ? "homepage"
    : /\/parts-reference\//.test(path) ? "parts_reference"
    : isNews ? (isReference ? "reference_guide" : "news")
    : /\/products\//.test(path) ? "product_category" : "other";
  const contentSlug = (path.match(/\/(?:news|products)\/([a-z0-9-]+)\/$/) || [])[1] || "none";
  let selectedReference = {};
  const track = (name, parameters = {}) => {
    window.gtag("event", name, {
      ...parameters,
      page_location: pageLocation(),
      page_type: pageType,
      product_slug: productSlug,
      content_slug: contentSlug,
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

  const publicIdentifier = value => typeof value === "string" && value.length <= 100
    && /\d/.test(value) && /^[\p{L}\p{N} ._()/+*",:;=\p{Pd}\u00b0\u00d7\u201d\u2212\uff08\uff09]+$/u.test(value) ? value : "";
  const publishedReference = (link, url) => {
    if (url.origin !== window.location.origin) return null;
    const samePage = url.pathname === path;
    if (!samePage && !/^\/(en|ar)\/(products|news|parts-reference)\//.test(url.pathname)) return null;
    // Search metadata is copied from the public catalog, not the entered query.
    // Some catalog entries use shared anchors such as #part-identification.
    const result = link?.closest(".pn-results");
    if (result) {
      const number = publicIdentifier(link.dataset?.referenceNumber);
      if (!number) return null;
      const model = publicIdentifier(link.dataset?.referenceModel);
      return {reference_id: number, reference_page: url.pathname, ...(model ? {reference_model: model} : {})};
    }
    // Anchor IDs may be lowercased, generated, or suffixed to remove duplicates.
    // Only the verified table's public value is a part/drawing number.
    if (!samePage) return null;
    let id;
    try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { return null; }
    if (!id.startsWith("pn-")) return null;
    const target = document.getElementById(id);
    if (!target?.closest("table")) return null;
    const cell = target.matches("td, th") ? target : target.matches("tr") ? target.cells[0] : null;
    if (!cell) return null;
    const value = cell.getAttribute("data-reference-number") || cell.querySelector("code")?.textContent || cell.textContent;
    const number = publicIdentifier(value?.trim());
    if (!number) return null;
    return {reference_id: number, reference_page: url.pathname};
  };
  // A search result can arrive directly at a published part-number anchor.
  // Unmatched fragments are ignored rather than treated as customer data.
  selectedReference = publishedReference(null, new URL(window.location.href)) || {};

  // Draft selection is independent of analytics. Synchronize public context
  // without treating an anchor restore or a clear action as a click/inquiry.
  document.addEventListener("pratt:reference-selected", event => {
    const id = event.detail?.id;
    if (typeof id !== "string" || !id.startsWith("pn-")) return;
    const url = new URL(window.location.href);
    url.hash = id;
    const reference = publishedReference(null, url);
    if (reference) selectedReference = reference;
  });
  document.addEventListener("pratt:reference-cleared", () => { selectedReference = {}; });

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
    if (method) {
      track("contact_click", {...selectedReference, contact_method: method, contact_placement: placement, inquiry_stage: "contact_intent"});
      return;
    }
    if (url.origin !== window.location.origin) return;
    if (/^\/assets\/(data|documents|catalogs)\/.+\.(csv|pdf)$/i.test(url.pathname)) {
      track("reference_download", {destination_path: url.pathname});
      return;
    }
    const reference = publishedReference(link, url);
    if (reference) {
      selectedReference = reference;
      track("part_reference_click", reference);
    } else if (url.hash === "#product_inquiry_form") {
      const model = publicIdentifier(link.dataset?.zqModel);
      track("inquiry_open", {...selectedReference, contact_placement: placement, form_kind: "product", ...(model ? {model_id: model} : {})});
    } else if (url.pathname !== path && /^\/(en|ar)\/(products|news|parts-reference)\//.test(url.pathname)
      && !link.closest("header, footer, .product-sidebar")) {
      track("related_content_click", {destination_path: url.pathname});
    }
  }, true);

  document.addEventListener("pratt:inquiry-draft-prepared", event => {
    const kind = event.detail && event.detail.form_kind;
    track("inquiry_draft_prepared", {
      ...selectedReference,
      contact_method: event.detail?.contact_method === "email" ? "email" : "whatsapp",
      form_kind: ["product", "contact", "homepage"].includes(kind) ? kind : "other",
      inquiry_stage: "draft_prepared",
      ...(["ZQ127-25", "ZQ162-50", "ZQ203-100", "ZQ203-125"].includes(event.detail?.model_id) ? {model_id: event.detail.model_id} : {})
    });
  });
  if (isProduct) track("product_view");
})();
