const menuToggle = document.querySelector(".menu-toggle");
const navLinks = document.querySelector("#navLinks");
const navDropdowns = Array.from(document.querySelectorAll("[data-nav-dropdown]"));

function closeDropdowns(except) {
  navDropdowns.forEach((dropdown) => {
    if (dropdown !== except) {
      dropdown.classList.remove("open");
      dropdown.querySelector("[data-nav-toggle]")?.setAttribute("aria-expanded", "false");
    }
  });
}

if (menuToggle && navLinks) {
  menuToggle.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    if (!isOpen) {
      closeDropdowns();
    }
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuToggle.setAttribute("aria-expanded", "false");
      closeDropdowns();
    });
  });
}

navDropdowns.forEach((dropdown) => {
  const toggle = dropdown.querySelector("[data-nav-toggle]");
  toggle?.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) {
      closeDropdowns(dropdown);
    }
  });
});

document.addEventListener("click", (event) => {
  if (!event.target.closest(".nav")) {
    closeDropdowns();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeDropdowns();
    navLinks?.classList.remove("open");
    menuToggle?.setAttribute("aria-expanded", "false");
  }
});

function setActivePrimaryNavigation() {
  if (document.documentElement.lang !== "en" || !navLinks) return;

  const normalizePath = (value) => value.replace(/\/+$/, "/");
  const currentPath = normalizePath(window.location.pathname);
  const mainLinks = Array.from(navLinks.querySelectorAll(".nav-main-link"));
  const byLabel = (label) => mainLinks.find((link) => link.textContent.trim() === label);
  let activeLink = null;

  if (currentPath === "/" || currentPath === "/index.html" || currentPath.endsWith("/demo/pratt-oil-oilfield/")) {
    activeLink = byLabel("Home");
  } else if (currentPath.includes("/en/services/")) {
    activeLink = byLabel("Services");
  } else if (currentPath.includes("/en/news/")) {
    activeLink = byLabel("News");
  } else if (currentPath.includes("/en/contact/")) {
    activeLink = byLabel("Contact");
  } else if (
    currentPath.includes("/en/about-us/") ||
    currentPath.includes("/en/factory-photos/") ||
    currentPath.includes("/en/export-support/")
  ) {
    activeLink = byLabel("About Us");
  } else if (
    currentPath.includes("/en/products/") ||
    currentPath.includes("/en/mud-pump-spare-parts/") ||
    currentPath.includes("/en/mud-pump-liners-pistons-valves-seats/") ||
    currentPath.includes("/en/drilling-rig-spare-parts/") ||
    currentPath.includes("/en/drawworks-brake-system-parts/") ||
    currentPath.includes("/en/wellhead-equipment-valves/") ||
    currentPath.includes("/en/oilfield-hydraulic-components/") ||
    currentPath.includes("/en/fast-wearing-oilfield-parts/")
  ) {
    activeLink = byLabel("Products");
  }

  mainLinks.forEach((link) => {
    const isActive = link === activeLink;
    link.classList.toggle("is-active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });
}

// Register the disclosure handler once; updating the active link on a hash
// change must not add another handler that toggles the same menu again.
if (navLinks) {
  navLinks.addEventListener("click", (event) => {
    const trigger = event.target.closest(".nav-dropdown-row > a[aria-haspopup=\"true\"]");
    if (!trigger || trigger.hasAttribute("data-nav-link")) return;
    const dropdown = trigger.closest("[data-nav-dropdown]");
    const toggle = dropdown?.querySelector("[data-nav-toggle]");
    if (!dropdown || !toggle) return;
    event.preventDefault();
    event.stopPropagation();
    const isOpen = dropdown.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(isOpen));
    if (isOpen) closeDropdowns(dropdown);
  }, true);
}

setActivePrimaryNavigation();
window.addEventListener("hashchange", setActivePrimaryNavigation);

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  if (slides.length < 2) return;

  const configuredInterval = Number.parseInt(carousel.dataset.carouselInterval || "4500", 10);
  const autoplayInterval = Number.isFinite(configuredInterval) && configuredInterval >= 2500
    ? configuredInterval
    : 4500;

  let current = 0;
  let timer = null;
  let touchStartX = 0;
  let touchStartY = 0;

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === current;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === current;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-current", String(active));
    });
  }

  function stopAutoplay() {
    if (timer) {
      window.clearInterval(timer);
      timer = null;
    }
  }

  function startAutoplay() {
    stopAutoplay();
    if (!reduceMotion.matches && !document.hidden && !carousel.contains(document.activeElement)) {
      timer = window.setInterval(() => showSlide(current + 1), autoplayInterval);
    }
  }

  carousel.addEventListener("focusin", stopAutoplay);
  carousel.addEventListener("focusout", (event) => {
    if (!carousel.contains(event.relatedTarget)) startAutoplay();
  });

  dots.forEach((dot, index) => {
    dot.addEventListener("click", () => {
      showSlide(index);
      startAutoplay();
    });
  });

  prev?.addEventListener("click", () => {
    showSlide(current - 1);
    startAutoplay();
  });

  next?.addEventListener("click", () => {
    showSlide(current + 1);
    startAutoplay();
  });

  carousel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      showSlide(current - 1);
      startAutoplay();
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      showSlide(current + 1);
      startAutoplay();
    }
    if (event.key === "Home") {
      event.preventDefault();
      showSlide(0);
      startAutoplay();
    }
    if (event.key === "End") {
      event.preventDefault();
      showSlide(slides.length - 1);
      startAutoplay();
    }
  });

  carousel.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
    stopAutoplay();
  }, { passive: true });

  carousel.addEventListener("touchend", (event) => {
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    if (Math.abs(deltaX) > 48 && Math.abs(deltaX) > Math.abs(deltaY)) {
      showSlide(deltaX < 0 ? current + 1 : current - 1);
    }
    startAutoplay();
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      stopAutoplay();
    } else {
      startAutoplay();
    }
  });

  reduceMotion.addEventListener?.("change", startAutoplay);
  startAutoplay();
});

document.querySelectorAll("[data-news-tabs]").forEach((section) => {
  const tabs = Array.from(section.querySelectorAll("[data-news-tab]"));
  const panels = Array.from(section.querySelectorAll("[data-news-panel]"));
  if (!tabs.length || !panels.length) return;

  function activate(target) {
    tabs.forEach((tab) => {
      const active = tab.dataset.newsTab === target;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    panels.forEach((panel) => {
      panel.classList.toggle("is-active", panel.dataset.newsPanel === target);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => activate(tab.dataset.newsTab));
    tab.addEventListener("keydown", (event) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      event.preventDefault();
      const index = tabs.indexOf(tab);
      const nextIndex = event.key === "ArrowRight" ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      activate(tabs[nextIndex].dataset.newsTab);
    });
  });
});

function openWhatsAppInquiry(form, message, statusSelector) {
  const url = `https://api.whatsapp.com/send?phone=8615908080040&text=${encodeURIComponent(message)}`;
  const status = form.querySelector(statusSelector);
  const isArabic = document.documentElement.lang === "ar";
  if (status) {
    status.textContent = isArabic
      ? "مسودة WhatsApp جاهزة. راجع الرسالة واضغط إرسال في WhatsApp لإرسال طلبك."
      : "Your WhatsApp draft is ready. Review it and press Send in WhatsApp to send your inquiry.";
    const link = document.createElement("a");
    link.href = "https://api.whatsapp.com/send?phone=8615908080040";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = isArabic ? "افتح WhatsApp" : "Open WhatsApp";
    link.addEventListener("click", event => {
      event.preventDefault();
      window.open(url, "_blank", "noopener,noreferrer");
    });
    status.append(" ", link);
  }
  document.dispatchEvent(new CustomEvent("pratt:inquiry-draft-prepared", {
    detail: {form_kind: form.hasAttribute("data-product-detail-inquiry") ? "product"
      : form.hasAttribute("data-contact-inquiry") ? "contact"
      : form.hasAttribute("data-quote-form") ? "homepage" : "other"}
  }));
  window.open(url, "_blank", "noopener,noreferrer");
}

const quoteForm = document.querySelector("[data-quote-form]");

if (quoteForm) {
  quoteForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const data = new FormData(quoteForm);
    const value = (name) => String(data.get(name) || "").trim();
    const message = [
      "Hello Pratt Oil, I need an oilfield spare parts quotation.",
      "",
      `Name: ${value("name")}`,
      `Company: ${value("company") || "Not provided"}`,
      `Country / market: ${value("country")}`,
      `Email or phone: ${value("contact") || "Not provided"}`,
      `Part number / model / product: ${value("part")}`,
      `Quantity and notes: ${value("details") || "Not provided"}`,
      "",
      "I can attach product photos or technical drawings in WhatsApp."
    ].join("\n");

    openWhatsAppInquiry(quoteForm, message, "[data-quote-status]");
  });
}

/* Contact and category forms prepare a draft; the visitor sends it in WhatsApp. */
document.querySelectorAll("[data-contact-inquiry]").forEach((form) => {
  form.querySelector("[data-contact-submit]").disabled = false;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const value = (name) => String(data.get(name) || "").trim();
    const isArabic = document.documentElement.lang === "ar";
    const title = document.querySelector("main h1")?.textContent.trim() || document.title;
    const message = isArabic
      ? [
          "مرحباً Pratt Oil، أحتاج إلى عرض سعر.", "",
          `الصفحة: ${title}`,
          `الاسم: ${value("name")}`,
          `البريد الإلكتروني أو WhatsApp: ${value("contact")}`,
          `رقم القطعة أو الموديل: ${value("part_number") || "غير مذكور"}`,
          `الرسالة: ${value("message")}`,
          `رابط الصفحة: ${window.location.href}`
        ]
      : [
          "Hello Pratt Oil, I need an oilfield spare parts quotation.", "",
          `Page: ${title}`,
          `Name: ${value("name")}`,
          `Email or WhatsApp: ${value("contact")}`,
          `Part number / model: ${value("part_number") || "Not provided"}`,
          `Message: ${value("message")}`,
          `Page URL: ${window.location.href}`
        ];
    openWhatsAppInquiry(form, message.join("\n"), "[data-contact-inquiry-status]");
  });
});

/* Product category sidebar dropdown (expand/collapse + active highlight) */
(function () {
  document.querySelectorAll(".product-sidebar [data-sidebar-toggle]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var g = btn.closest("[data-sidebar-group]");
      if (!g) return;
      var open = g.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  });
  function canonicalSidebarPath(value) {
    var normalized = value.replace(/^\/demo\/pratt-oil-oilfield(?=\/|$)/, "") || "/";
    normalized = normalized.replace(/\/index\.html$/i, "/");
    return normalized.replace(/\/+$/, "/");
  }
  var path = canonicalSidebarPath(location.pathname);
  document.querySelectorAll(".product-sidebar a").forEach(function (a) {
    try {
      var ap = canonicalSidebarPath(new URL(a.href).pathname);
      if (ap === path) {
        a.classList.add("active");
        var g = a.closest("[data-sidebar-group]");
        if (g) {
          g.classList.add("is-open");
          var b = g.querySelector("[data-sidebar-toggle]");
          if (b) b.setAttribute("aria-expanded", "true");
        }
      }
    } catch (e) {}
  });
})();

/* Product detail inquiry form: prepare a WhatsApp message from the form. */
document.querySelectorAll("[data-product-detail-inquiry]").forEach(function (form) {
  form.addEventListener("submit", function (event) {
    event.preventDefault();

    var data = new FormData(form);
    var value = function (name) {
      return String(data.get(name) || "").trim();
    };
    var productTitle = document.querySelector(
      ".ru-product-detail-copy h1, .wcb-cn-hero-copy h1, .brake-band-summary-copy h1, main h1"
    );
    var product = productTitle ? productTitle.textContent.trim() : "Oilfield spare part";
    var canonical = document.querySelector('link[rel="canonical"]');
    var pageUrl = canonical ? canonical.href : window.location.origin + window.location.pathname;
    var isArabic = document.documentElement.lang === "ar";
    var lines = isArabic
      ? [
          "مرحباً Pratt Oil، أحتاج إلى عرض سعر.",
          "",
          "المنتج: " + product,
          "الاسم: " + value("name"),
          "البريد الإلكتروني: " + value("email"),
          "الهاتف: " + (value("phone") || "غير مذكور"),
          "الرسالة: " + value("message"),
          "رابط المنتج: " + pageUrl
        ]
      : [
          "Hello Pratt Oil, I need a quotation.",
          "",
          "Product: " + product,
          "Name: " + value("name"),
          "Email: " + value("email"),
          "Phone: " + (value("phone") || "Not provided"),
          "Message: " + value("message"),
          "Product URL: " + pageUrl
        ];
    openWhatsAppInquiry(form, lines.join("\n"), "[data-product-detail-inquiry-status]");
  });
});
