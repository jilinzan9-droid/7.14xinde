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
  input.addEventListener('input', filter);
  window.addEventListener('hashchange', revealTarget);
  requestAnimationFrame(revealTarget);
})();
