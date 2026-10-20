/* Enable the WCB draft UI only after the shared inquiry code is available. */
(function () {
  "use strict";

  function ready() {
    document.querySelectorAll("body.wcb-reference-cn-page form[data-product-detail-inquiry]").forEach(function (form) {
      // The shared handler prepares the draft; a form must never navigate by GET.
      form.addEventListener("submit", function (event) {
        event.preventDefault();
      });

      if (typeof window.openWhatsAppInquiry !== "function") return;

      var fields = form.querySelector("[data-wcb-inquiry-fields]");
      var button = form.querySelector("[data-wcb-inquiry-submit]");
      if (!fields || !button) return;

      fields.disabled = false;
      button.disabled = false;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ready, { once: true });
  } else {
    ready();
  }
})();
