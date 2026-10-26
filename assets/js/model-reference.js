(() => {
  'use strict';
  const table = document.querySelector('[data-pump-reference-table]');
  const input = document.querySelector('[data-pump-filter]');
  const status = document.querySelector('[data-pump-filter-status]');
  if (!table || !input || !status) return;
  const rows = [...table.tBodies[0].rows];
  const normalize = value => value.normalize('NFKC').toLowerCase().trim();
  const compact = value => normalize(value).replace(/[^\p{L}\p{N}]+/gu, '');
  function filter() {
    const query = normalize(input.value);
    const numberQuery = /\d/.test(query) ? compact(query) : '';
    let count = 0;
    rows.forEach(row => {
      const textMatch = normalize(row.textContent).includes(query);
      const numberMatch = Boolean(numberQuery) && compact(row.cells[0].textContent).includes(numberQuery);
      row.hidden = Boolean(query) && !textMatch && !numberMatch;
      if (!row.hidden) count += 1;
    });
    status.textContent = count + ' of ' + rows.length + ' reference entries';
  }
  function revealTarget() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !table.contains(target)) return;
    if (input.value) { input.value = ''; filter(); }
    target.scrollIntoView({ block: 'center', behavior: 'instant' });
  }
  // Clicking the current fragment does not emit hashchange. Reveal it again
  // when a table filter has hidden or removed the selected reference entry.
  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target?.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
    let destination;
    try { destination = new URL(link.href, location.href); } catch { return; }
    if (destination.origin !== location.origin || destination.pathname !== location.pathname || destination.search !== location.search || !destination.hash || destination.hash !== location.hash) return;
    let id;
    try { id = decodeURIComponent(destination.hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target || !table.contains(target)) return;
    event.preventDefault();
    revealTarget();
  });
  input.addEventListener('input', filter);
  window.addEventListener('hashchange', revealTarget);
  requestAnimationFrame(revealTarget);
})();
