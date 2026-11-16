/* Contact page header: no form, slideshow, or production side effects. */
(() => {
  'use strict';

  const page = document.body;
  if (!page || !page.classList.contains('contact-photo-page')) return;

  const header = page.querySelector('.site-header[data-primary-nav="unified"]');
  const banner = page.querySelector('.cp-banner');
  if (!header || !banner) return;

  let headerHeight = -1;
  let frame = 0;

  function updateHeader() {
    frame = 0;
    const measuredHeight = header.offsetHeight;
    if (measuredHeight !== headerHeight) {
      headerHeight = measuredHeight;
      const value = `${headerHeight}px`;
      page.style.setProperty('--contact-header-height', value);
      banner.style.setProperty('--contact-header-height', value);
    }
    header.classList.toggle(
      'is-past-contact-banner',
      banner.getBoundingClientRect().bottom <= headerHeight
    );
  }

  function scheduleUpdate() {
    if (!frame) frame = window.requestAnimationFrame(updateHeader);
  }

  updateHeader();
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  window.addEventListener('resize', scheduleUpdate, { passive: true });
  window.addEventListener('pageshow', scheduleUpdate);
  window.addEventListener('load', scheduleUpdate, { once: true });

  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(header);
    observer.observe(banner);
  }

  // Existing navigation code owns menu interaction; observe its layout changes only.
  const navLinks = header.querySelector('#navLinks');
  if (navLinks && 'MutationObserver' in window) {
    const menuObserver = new MutationObserver(scheduleUpdate);
    menuObserver.observe(navLinks, {
      attributes: true,
      attributeFilter: ['class', 'hidden', 'style']
    });
  }

  if (document.fonts) {
    document.fonts.ready.then(scheduleUpdate).catch(() => {});
    if (typeof document.fonts.addEventListener === 'function') {
      document.fonts.addEventListener('loadingdone', scheduleUpdate);
    }
  }
})();
