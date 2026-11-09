/* Carry a verified public table reference into reviewable contact drafts. */
(() => {
  'use strict';
  const identifier = value => typeof value === 'string' && value.length <= 100
    && /\d/.test(value) && /^[\p{L}\p{N} ._()/+*",:;=\p{Pd}\u00b0\u00d7\u201d\u2212\uff08\uff09]+$/u.test(value) ? value : '';
  const clean = value => String(value || '').replace(/\s+/g, ' ').trim();

  document.querySelectorAll('[data-reference-inquiry]').forEach(root => {
    if (root.dataset.referenceInquiryReady) return;
    root.dataset.referenceInquiryReady = 'true';
    const product = clean(root.dataset.referenceProduct || root.querySelector('h1')?.textContent);
    if (!product) return;
    let source;
    try {
      source = new URL(document.querySelector('link[rel="canonical"]')?.href || location.href);
      if (!/^https?:$/.test(source.protocol)
        || (source.origin !== location.origin && !/^(www\.)?pratt-oil\.com$/i.test(source.hostname))) return;
      source.search = '';
      source.hash = '';
    } catch (_) { return; }

    // Only published identifier columns qualify; row indexes and descriptions do not.
    const referenceCell = (cell, table) => {
      if (!cell?.matches('td, th') || cell.closest('table') !== table) return '';
      const headers = table.tHead?.rows;
      const header = headers?.length ? headers[headers.length - 1].cells[cell.cellIndex] : null;
      const labeled = /(?:part|drawing|material)\s*(?:\/\s*(?:part|drawing|material))?\s*(?:number|no\.?|reference|code)/i.test(clean(header?.textContent));
      if (!labeled && !cell.hasAttribute('data-reference-number')) return '';
      const codes = cell.querySelectorAll('code');
      if (codes.length > 1) return '';
      const value = clean(cell.getAttribute('data-reference-number') || codes[0]?.textContent || cell.textContent);
      return identifier(value);
    };
    const resolve = url => {
      if (url.origin !== location.origin || url.pathname !== location.pathname) return null;
      let id;
      try { id = decodeURIComponent(url.hash.slice(1)); } catch (_) { return null; }
      if (!id.startsWith('pn-')) return null;
      const target = document.getElementById(id);
      const table = target?.closest('table');
      if (!table || !root.contains(table) || target.closest('thead')) return null;
      if (!target.matches('td, th') && !target.matches('tr')) return null;
      let number = '';
      if (target.matches('td, th')) number = referenceCell(target, table);
      else if (target.matches('tr')) {
        const numbers = [...target.cells].map(cell => referenceCell(cell, table)).filter(Boolean);
        if (numbers.length === 1) number = numbers[0];
      }
      // A real table target with an unreadable value must clear the previous
      // selection, rather than silently quoting a different part.
      return {id, number};
    };

    const contacts = [];
    root.querySelectorAll('a[href]').forEach(link => {
      // Form retry links already reopen their original user-reviewed draft.
      if (link.closest('form')) return;
      try {
        const url = new URL(link.href, location.href);
        const whatsapp = url.protocol === 'https:' && ['api.whatsapp.com', 'wa.me', 'web.whatsapp.com'].includes(url.hostname);
        if (whatsapp || url.protocol === 'mailto:') contacts.push({link, original: link.getAttribute('href'), url, whatsapp});
      } catch (_) {}
    });
    const filled = new WeakMap();
    const fields = root.querySelectorAll('form[data-product-detail-inquiry] textarea[name="message"], form[data-contact-inquiry] textarea[name="message"]');
    const status = root.querySelector('[data-reference-inquiry-status]');
    let label, clearButton;
    let selected = null;
    if (status) {
      label = document.createElement('span');
      label.setAttribute('role', 'status');
      label.setAttribute('aria-live', 'polite');
      clearButton = document.createElement('button');
      clearButton.type = 'button';
      clearButton.textContent = 'Clear selected part';
      status.replaceChildren(label, clearButton);
      status.hidden = true;
    }

    const update = reference => {
      selected = reference;
      const recognized = Boolean(reference?.number);
      const partUrl = new URL(source.href);
      if (recognized) partUrl.hash = encodeURIComponent(reference.id);
      const context = recognized ? [
        'Selected part / drawing number: ' + reference.number,
        'Product / model: ' + product,
        'Source page: ' + source.href,
        'Part reference: ' + partUrl.href
      ].join('\n') : '';
      contacts.forEach(({link, original, url, whatsapp}) => {
        if (!recognized) { link.setAttribute('href', original); return; }
        const draft = new URL(url.href);
        const key = whatsapp ? 'text' : 'body';
        const originalMessage = draft.searchParams.get(key) || '';
        const additions = ['Selected part / drawing number: ' + reference.number];
        if (!originalMessage.includes(product)) additions.push('Product / model: ' + product);
        if (!originalMessage.includes(source.href)) additions.push('Source page: ' + source.href);
        additions.push('Part reference: ' + partUrl.href);
        draft.searchParams.set(key, (originalMessage ? originalMessage.trim() + '\n\n' : '') + additions.join('\n'));
        // Percent-encoded spaces also work with mail clients that treat + literally.
        draft.search = draft.search.replace(/\+/g, '%20');
        link.href = draft.href;
      });
      fields.forEach(field => {
        const previous = filled.get(field);
        if (field.value.trim() && field.value !== previous) return;
        field.value = context;
        if (recognized) filled.set(field, context);
        else filled.delete(field);
        // Do not dispatch input/change: selecting a reference is not form entry.
      });
      if (status) {
        label.textContent = recognized ? 'Selected part / drawing number: ' + reference.number + '. Review the draft before sending. '
          : reference ? 'Part not recognized. Enter its number in your inquiry. ' : '';
        clearButton.textContent = recognized ? 'Clear selected part' : 'Clear';
        status.hidden = !reference;
      }
      // Optional analytics consumers validate this public anchor again; no click
      // or inquiry event is generated by selecting, restoring or clearing it.
      document.dispatchEvent(recognized
        ? new CustomEvent('pratt:reference-selected', {detail: {id: reference.id}})
        : new CustomEvent('pratt:reference-cleared'));
    };

    clearButton?.addEventListener('click', () => {
      const current = resolve(new URL(location.href));
      if (current && current.id === selected?.id) {
        history.replaceState(history.state, '', location.pathname + location.search);
      }
      update(null);
    });
    root.addEventListener('click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target?.closest?.('a[href]');
      if (!link || link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
      let reference;
      try { reference = resolve(new URL(link.href, location.href)); } catch (_) { return; }
      if (reference) update(reference);
    });
    window.addEventListener('hashchange', () => {
      const reference = resolve(new URL(location.href));
      if (reference) update(reference);
    });
    const initial = resolve(new URL(location.href));
    if (initial) update(initial);
  });
})();
