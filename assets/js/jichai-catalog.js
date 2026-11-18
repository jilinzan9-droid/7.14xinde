/* Enhance the published Jichai reference table without changing its source text. */
(() => {
  'use strict';

  const normalize = value => String(value || '').normalize('NFKC').toLowerCase().trim();
  const compact = value => normalize(value).replace(/[^\p{L}\p{N}]/gu, '');
  const matches = (record, query) => {
    if (!query) return true;
    const wholeNumber = compact(query);
    if (wholeNumber && record.compactNumber.includes(wholeNumber)) return true;
    return query.split(/\s+/u).every(word => record.number.includes(word)
      || record.description.includes(word)
      || (/\d/u.test(word) && compact(word) && record.compactNumber.includes(compact(word))));
  };

  document.querySelectorAll('[data-jichai-catalog]').forEach(root => {
    if (root.dataset.jichaiCatalogReady) return;
    const nodes = {
      form: root.querySelector('[data-catalog-search-form]'),
      search: root.querySelector('#jichai-search'),
      family: root.querySelector('#jichai-family'),
      size: root.querySelector('#jichai-page-size'),
      reset: root.querySelector('[data-catalog-reset]'),
      status: root.querySelector('[data-catalog-status]'),
      previous: root.querySelector('[data-catalog-page="previous"]'),
      next: root.querySelector('[data-catalog-page="next"]'),
      label: root.querySelector('[data-catalog-page-label]'),
      pagination: root.querySelector('[data-catalog-pagination]'),
      empty: root.querySelector('[data-catalog-empty]')
    };
    if (Object.values(nodes).some(node => !node)) return;

    const rows = [...root.querySelectorAll('tbody tr[data-catalog-row]')];
    const cleanup = [];
    let records, filtered = [], page = 0;
    const format = number => number.toLocaleString('en-US');
    const restore = () => {
      cleanup.forEach(remove => remove());
      rows.forEach(row => { row.hidden = false; });
      nodes.pagination.hidden = true;
      nodes.empty.hidden = true;
      delete root.dataset.jichaiCatalogReady;
      nodes.status.textContent = format(rows.length) + ' reference entries. Use your browser’s Find command to locate a part.';
    };
    const safely = action => (...args) => {
      try { action(...args); } catch (_) { restore(); }
    };
    const listen = (target, type, action) => {
      const handler = safely(action);
      target.addEventListener(type, handler);
      cleanup.push(() => target.removeEventListener(type, handler));
    };
    const pageSize = () => [25, 50, 100].includes(Number(nodes.size.value)) ? Number(nodes.size.value) : 25;
    const refilter = () => {
      const query = normalize(nodes.search.value);
      filtered = records.filter(record => (nodes.family.value === 'all' || record.family === nodes.family.value)
        && matches(record, query));
    };
    const render = () => {
      const size = pageSize();
      const pages = Math.ceil(filtered.length / size);
      page = Math.max(0, Math.min(page, Math.max(0, pages - 1)));
      const start = page * size;
      const visible = new Set(filtered.slice(start, start + size));
      records.forEach(record => {
        const hidden = !visible.has(record);
        if (record.row.hidden !== hidden) record.row.hidden = hidden;
      });
      nodes.previous.disabled = page === 0;
      nodes.next.disabled = pages === 0 || page >= pages - 1;
      nodes.label.textContent = 'Page ' + (pages ? page + 1 : 0) + ' of ' + pages;
      nodes.pagination.hidden = pages === 0;
      nodes.empty.hidden = filtered.length !== 0;
      nodes.status.textContent = filtered.length
        ? 'Showing ' + format(start + 1) + '–' + format(Math.min(start + size, filtered.length))
          + ' of ' + format(filtered.length) + (filtered.length === records.length ? ' reference entries.' : ' matching reference entries (' + format(records.length) + ' total).')
        : 'No matching reference entries (' + format(records.length) + ' total). Try another part number or description.';
    };
    const update = () => { page = 0; refilter(); render(); };
    const scrollTo = row => {
      const scroll = () => {
        try { row.scrollIntoView({block: 'center', inline: 'nearest'}); } catch (_) { /* Optional scrolling must not hide the table. */ }
      };
      if (typeof window.requestAnimationFrame === 'function') window.requestAnimationFrame(scroll);
      else scroll();
    };

    try {
      records = rows.map(row => {
        const number = row.querySelector('td[data-part-number] code');
        const description = row.querySelector('.catalog-description');
        if (!number || !description) throw new Error('Incomplete catalog row');
        return {row, id: row.id, family: row.dataset.family,
          number: normalize(number.textContent), compactNumber: compact(number.textContent), description: normalize(description.textContent)};
      });
      const byId = new Map(records.map(record => [record.id, record]));
      const revealHash = () => {
        let id;
        try { id = decodeURIComponent(window.location.hash.slice(1)); } catch (_) { return; }
        if (!id.startsWith('pn-jichai-')) return;
        const record = byId.get(id);
        if (!record) return;
        if (!matches(record, normalize(nodes.search.value))) nodes.search.value = '';
        if (nodes.family.value !== 'all' && nodes.family.value !== record.family) nodes.family.value = 'all';
        refilter();
        page = Math.floor(filtered.indexOf(record) / pageSize());
        render();
        scrollTo(record.row);
      };

      listen(nodes.search, 'input', update);
      listen(nodes.family, 'change', update);
      listen(nodes.size, 'change', update);
      listen(nodes.form, 'submit', event => { event.preventDefault(); update(); });
      listen(nodes.reset, 'click', event => {
        event.preventDefault();
        nodes.search.value = '';
        nodes.family.value = 'all';
        nodes.size.value = '25';
        update();
        nodes.search.focus();
      });
      listen(nodes.previous, 'click', event => { event.preventDefault(); page--; render(); });
      listen(nodes.next, 'click', event => { event.preventDefault(); page++; render(); });
      listen(window, 'hashchange', revealHash);
      listen(root, 'click', event => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target?.closest?.('a[href]');
        if (!link || !root.contains(link) || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
        let url;
        try { url = new URL(link.getAttribute('href'), window.location.href); } catch (_) { return; }
        // Changing a hash uses native navigation; repeated links still reveal a filtered-out target.
        if (url.origin === window.location.origin && url.pathname === window.location.pathname
          && url.hash === window.location.hash) revealHash();
      });
      refilter();
      render();
      revealHash();
      root.dataset.jichaiCatalogReady = 'true';
    } catch (_) { restore(); }
  });
})();
