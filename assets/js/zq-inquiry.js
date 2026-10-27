(() => {
  const form = document.querySelector("[data-zq-inquiry]");
  if (!form) return;
  const model = form.elements.model;
  const status = form.querySelector("[data-zq-status]");
  const canonical = document.querySelector('link[rel="canonical"]').href;
  let prepared = "";
  document.querySelectorAll("[data-zq-model]").forEach(link => link.addEventListener("click", () => {
    model.value = link.dataset.zqModel;
    model.dispatchEvent(new Event("change", {bubbles: true}));
    model.focus({preventScroll: true});
  }));
  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const channel = event.submitter?.value === "email" ? "email" : "whatsapp";
    const values = new FormData(form);
    const value = name => String(values.get(name) || "").trim();
    const message = ["Hello Pratt Oil, please quote:", "Product: ZQ Series Drill Pipe Power Tongs",
      `Model: ${value("model")}`, `Requirement: ${value("requirement")}`, `Quantity: ${value("quantity")}`,
      `Details: ${value("details") || "To be confirmed"}`, `Product page: ${canonical}`,
      "I can attach the nameplate, pipe/tool-joint dimensions and photos."].join("\n");
    const destination = channel === "email"
      ? `mailto:2000@pratt-oil.com?subject=${encodeURIComponent("ZQ power tong quotation — " + value("model"))}&body=${encodeURIComponent(message)}`
      : `https://api.whatsapp.com/send?phone=8615908080040&text=${encodeURIComponent(message)}`;
    // Reopening an unchanged draft is not another prepared inquiry.
    const signature = channel + message;
    if (signature !== prepared) {
      document.dispatchEvent(new CustomEvent("pratt:inquiry-draft-prepared", {detail:{form_kind:"product",contact_method:channel}}));
      prepared = signature;
    }
    status.replaceChildren(document.createTextNode(channel === "email"
      ? "Your email draft is ready. Review it and send it in your email app. "
      : "Your WhatsApp draft is ready. Review it and press Send in WhatsApp. "));
    const retry = document.createElement("a");
    // The fallback href contains no form values or message text.
    retry.href = channel === "email" ? "mailto:2000@pratt-oil.com" : "https://api.whatsapp.com/send?phone=8615908080040";
    retry.textContent = channel === "email" ? "Open email draft again" : "Open WhatsApp draft again";
    const open = () => window.open(destination, channel === "email" ? "_self" : "_blank", "noopener,noreferrer");
    retry.addEventListener("click", e => { e.preventDefault(); open(); });
    status.append(retry);
    open();
  });
})();
