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

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

document.querySelectorAll("[data-carousel]").forEach((carousel) => {
  const slides = Array.from(carousel.querySelectorAll("[data-carousel-slide]"));
  const dots = Array.from(carousel.querySelectorAll("[data-carousel-dot]"));
  const prev = carousel.querySelector("[data-carousel-prev]");
  const next = carousel.querySelector("[data-carousel-next]");
  if (slides.length < 2) return;

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
    if (!reduceMotion.matches) {
      timer = window.setInterval(() => showSlide(current + 1), 5000);
    }
  }

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

  carousel.addEventListener("mouseenter", stopAutoplay);
  carousel.addEventListener("mouseleave", startAutoplay);
  carousel.addEventListener("focusin", stopAutoplay);
  carousel.addEventListener("focusout", startAutoplay);

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
  var path = location.pathname.replace(/\/+$/, "/");
  document.querySelectorAll(".product-sidebar a").forEach(function (a) {
    try {
      var ap = new URL(a.href).pathname.replace(/\/+$/, "/");
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
