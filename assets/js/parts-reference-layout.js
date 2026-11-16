/* Presentation controls for the parts directory. The search index stays unchanged. */
(() => {
  const root = document.querySelector('[data-parts-lookup]');
  if (!root) return;
  const input = root.querySelector('input[type="search"]');
  root.querySelector('.pn-search-form')?.addEventListener('submit', event => {
    event.preventDefault();
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  root.querySelectorAll('[data-search-example]').forEach(button => {
    button.addEventListener('click', () => {
      input.value = button.dataset.searchExample;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus({ preventScroll: true });
    });
  });
  function revealReference() {
    let id;
    try { id = decodeURIComponent(window.location.hash.slice(1)); }
    catch (_) { return; }
    if (!id) return;
    const target = document.getElementById(id);
    if (!target || !document.querySelector('.pn-shell')?.contains(target)) return;
    let parent = target;
    while (parent) {
      if (parent.tagName === 'DETAILS') parent.open = true;
      parent = parent.parentElement;
    }
    requestAnimationFrame(() => target.scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
  window.addEventListener('hashchange', revealReference);
  document.querySelectorAll('.pn-shell a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      if (link.hash === window.location.hash) revealReference();
    });
  });
  revealReference();
})();
