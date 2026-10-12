document.querySelectorAll('[data-lp-catalog]').forEach(catalog => {
  const cards = [...catalog.querySelectorAll('[data-lp-category]')];
  const filters = [...catalog.querySelectorAll('[data-lp-filter]')];
  const search = catalog.querySelector('input[type="search"]');
  let category = catalog.dataset.lpDefault;
  const update = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const show = (category === 'all' || card.dataset.lpCategory === category) && card.textContent.toLowerCase().includes(query);
      card.hidden = !show;
      visible += Number(show);
    });
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.lpFilter === category)));
    catalog.querySelector('[data-lp-count]').textContent = `${visible} ${visible === 1 ? 'product' : 'products'} · View details or request a quote`;
    catalog.querySelector('[data-lp-empty]').hidden = visible !== 0;
  };
  filters.forEach(button => button.addEventListener('click', () => { category = button.dataset.lpFilter; update(); }));
  search.addEventListener('input', update);
  catalog.querySelector('.lp-controls').hidden = false;
  update();
});
document.querySelectorAll('[data-parts-search]').forEach(input => {
  const region = input.closest('.lp-reference');
  const rows = [...region.querySelectorAll('tbody tr')];
  const status = region.querySelector('[data-parts-status]');
  let currentPage = 0;
  const pageSize = 20;
  const pager = document.createElement('div');
  pager.className = 'lp-pager';
  const previous = document.createElement('button');
  previous.type = 'button'; previous.textContent = '← Previous';
  const next = document.createElement('button');
  next.type = 'button'; next.textContent = 'Next →';
  pager.append(previous, next);
  region.append(pager);
  const update = () => {
    const query = input.value.trim().toLowerCase();
    const matches = rows.filter(row => row.textContent.toLowerCase().includes(query));
    rows.forEach(row => row.hidden = true);
    const start = currentPage * pageSize;
    matches.slice(start, start + pageSize).forEach(row => row.hidden = false);
    status.textContent = matches.length ? `${start + 1}–${Math.min(start + pageSize, matches.length)} of ${matches.length} matching parts` : 'No matching parts. Send your part number or drawing for identification.';
    previous.disabled = currentPage === 0;
    next.disabled = start + pageSize >= matches.length;
  };
  input.addEventListener('input', () => { currentPage = 0; update(); });
  previous.addEventListener('click', () => { currentPage--; update(); });
  next.addEventListener('click', () => { currentPage++; update(); });
  update();
});
