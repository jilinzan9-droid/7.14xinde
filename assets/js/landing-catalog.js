function matchesCatalogSearch(text, query, identifier) {
  const normalize = value => value.normalize('NFKC').toLowerCase();
  const haystack = normalize(text);
  const needle = normalize(query.trim());
  if (haystack.includes(needle)) return true;
  const compact = value => value.replace(/[\s\p{Pd}_./]+/gu, '');
  // Parts tables normalize only their identifier column, never description numbers.
  if (identifier !== undefined) {
    return /\d/.test(needle) && compact(normalize(identifier)).includes(compact(needle));
  }
  // Model and part numbers are commonly written with or without separators.
  // Keep ordinary text searches unchanged, and allow those model variants.
  if (!/[a-z]/.test(needle) || !/\d/.test(needle)) return false;
  return compact(haystack).includes(compact(needle));
}

document.querySelectorAll('[data-lp-catalog]').forEach(catalog => {
  const cards = [...catalog.querySelectorAll('[data-lp-category]')];
  const filters = [...catalog.querySelectorAll('[data-lp-filter]')];
  const search = catalog.querySelector('input[type="search"]');
  let category = catalog.dataset.lpDefault;
  const update = () => {
    const query = search.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(card => {
      const show = (category === 'all' || card.dataset.lpCategory === category) && matchesCatalogSearch(card.textContent, query);
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
  const update = () => {
    const query = input.value.trim().toLowerCase();
    let visible = 0;
    rows.forEach(row => {
      const match = !query || matchesCatalogSearch(row.textContent, query, row.cells[0].textContent);
      row.hidden = !match;
      visible += Number(match);
    });
    status.textContent = visible
      ? `${visible} ${query ? 'matching parts' : 'parts in this reference'}`
      : 'No matching parts. Send your part number or drawing for identification.';
  };

  const revealPart = () => {
    let id;
    try {
      id = decodeURIComponent(window.location.hash.slice(1));
    } catch (error) {
      return;
    }
    if (!id.startsWith('pn-')) return;
    const target = document.getElementById(id);
    if (!rows.includes(target)) return;
    input.value = '';
    update();
    target.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    region.querySelector('.lp-table-scroll')?.scrollIntoView({ block: 'center', inline: 'nearest' });
  };

  input.addEventListener('input', update);
  window.addEventListener('hashchange', revealPart);
  region.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#pn-"]');
    if (link && link.hash === window.location.hash) {
      event.preventDefault();
      revealPart();
    }
  });
  update();
  revealPart();
});
