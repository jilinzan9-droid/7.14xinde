/* Page-only table filtering and exact component context for contact drafts. */
(() => {
  'use strict';
  const toggle = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#navigation');
  const closeMenu = () => {
    toggle?.setAttribute('aria-expanded', 'false');
    navigation?.classList.remove('is-open');
  };
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    navigation?.classList.toggle('is-open', open);
  });
  navigation?.addEventListener('click', event => {
    if (event.target.closest('a')) closeMenu();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && toggle?.getAttribute('aria-expanded') === 'true') {
      closeMenu();
      toggle.focus();
    }
  });

  const root = document.querySelector('[data-reference-inquiry]');
  const search = document.querySelector('#parts-search');
  const rows = [...document.querySelectorAll('#catalogue-tables tbody tr')];
  const families = [...document.querySelectorAll('.catalog-family')];
  const status = document.querySelector('#parts-status');
  const empty = document.querySelector('#parts-empty');
  const normalize = value => value.normalize('NFKC').toLowerCase();
  const compact = value => normalize(value).replace(/[\s\p{Pd}_./]+/gu, '');
  const update = () => {
    const query = normalize(search.value.trim());
    const counts = new Map();
    let visible = 0;
    rows.forEach(row => {
      const number = row.querySelector('[data-reference-number]').dataset.referenceNumber;
      const match = !query || normalize(row.textContent).includes(query)
        || (/\d/.test(query) && compact(number).includes(compact(query)));
      row.hidden = !match;
      if (match) {
        visible += 1;
        counts.set(row.dataset.family, (counts.get(row.dataset.family) || 0) + 1);
      }
    });
    families.forEach(section => {
      const name = section.id.replace(/-parts$/, '');
      const count = counts.get(name) || 0;
      section.hidden = count === 0;
      section.querySelector('[data-family-count]').textContent = `${count} ${query ? 'matching part references' : 'part references'}`;
    });
    status.textContent = query ? `${visible} matching part references` : `${visible} part references across three equipment families`;
    empty.hidden = visible !== 0;
  };
  if (search) {
    document.querySelector('[data-search-controls]').hidden = false;
    search.addEventListener('input', update);
    document.querySelector('#parts-clear')?.addEventListener('click', () => {
      search.value = '';
      update();
      search.focus();
    });
    update();
  }
  document.querySelectorAll('.family-jumps a, .family-copy a[href^="#"]').forEach(link => {
    link.addEventListener('click', () => {
      if (!search.value) return;
      search.value = '';
      update();
    });
  });
  const reveal = () => {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch (_) { return; }
    if (!id.startsWith('pn-')) return;
    const row = document.getElementById(id);
    if (!rows.includes(row)) return;
    if (search.value) { search.value = ''; update(); }
    row.scrollIntoView({block:'center', inline:'nearest'});
  };
  window.addEventListener('hashchange', reveal);
  reveal();

  // The shared selector builds each draft from its original URL, then emits
  // this event. Append context from that verified, visible table row once.
  document.addEventListener('pratt:reference-selected', event => {
    const row = document.getElementById(event.detail?.id);
    if (!rows.includes(row) || row.cells.length !== 3) return;
    const number = row.cells[0].dataset.referenceNumber;
    if (!number || !row.id.startsWith('pn-')) return;
    const section = row.closest('.catalog-family');
    const family = section.querySelector('h3').textContent.trim();
    const component = row.cells[1].childNodes[0].textContent.trim();
    const model = row.cells[2].textContent.trim();
    const context = `Equipment family: ${family}\nModel reference: ${model}\nComponent: ${component}`;
    root.querySelectorAll('a[href]').forEach(link => {
      if (link.closest('form')) return;
      let url;
      try { url = new URL(link.href, location.href); } catch (_) { return; }
      const whatsapp = url.protocol === 'https:' && ['api.whatsapp.com', 'wa.me', 'web.whatsapp.com'].includes(url.hostname);
      if (!whatsapp && url.protocol !== 'mailto:') return;
      const key = whatsapp ? 'text' : 'body';
      const draft = url.searchParams.get(key) || '';
      if (!draft.includes('Selected part / drawing number: ' + number)) return;
      url.searchParams.set(key, draft + '\n' + context);
      url.search = url.search.replace(/\+/g, '%20');
      link.href = url.href;
    });
    const selectedLabel = root.querySelector('[data-reference-inquiry-status] [role="status"]');
    if (selectedLabel) selectedLabel.textContent = `${number} · ${family} · ${model} · ${component}. Review the draft before sending. `;
  });
})();
