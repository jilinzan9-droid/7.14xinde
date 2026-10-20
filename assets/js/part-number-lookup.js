(() => {
  const root = document.querySelector('[data-parts-lookup]');
  if (!root) return;
  const input = root.querySelector('input[type="search"]');
  const status = root.querySelector('[data-lookup-status]');
  const results = root.querySelector('[data-lookup-results]');
  const normalize = value => value.normalize('NFKC').toLowerCase().trim();
  const compact = value => normalize(value).replace(/[^\p{L}\p{N}]+/gu, '');
  let catalogPromise;
  let request = 0;
  const load = () => {
    if (!catalogPromise) {
      catalogPromise = fetch(root.dataset.source, { cache: 'no-cache' })
        .then(response => {
          if (!response.ok) throw new Error('Reference catalog unavailable');
          return response.json();
        })
        .then(data => data.records)
        .catch(error => { catalogPromise = undefined; throw error; });
    }
    return catalogPromise;
  };
  input.addEventListener('input', async () => {
    const current = ++request;
    const query = normalize(input.value);
    results.replaceChildren();
    if (query.length < 3) {
      status.textContent = 'Enter at least 3 characters, or browse the reference catalogs below.';
      return;
    }
    status.textContent = 'Searching the reference catalogs…';
    try {
      const records = await load();
      if (current !== request) return;
      const numberQuery = compact(query);
      const matches = records.map((record, order) => {
        const identifier = compact(record.number);
        const exact = identifier === numberQuery;
        const numberMatch = /\d/.test(query) && identifier.includes(numberQuery);
        const modelMatch = /[a-z]/.test(query) && /\d/.test(query) && compact(record.model).includes(numberQuery);
        const textMatch = normalize(record.number + ' ' + record.description + ' ' + record.model).includes(query);
        return { record, order, score: exact ? 0 : numberMatch ? 1 : modelMatch || textMatch ? 2 : 3 };
      }).filter(item => item.score < 3).sort((a, b) => a.score - b.score || a.order - b.order);
      if (!matches.length) {
        status.textContent = 'No matching entry in these references. Send the full part number, equipment model and drawing for identification.';
        return;
      }
      const list = document.createElement('ul');
      list.className = 'pn-results';
      for (const { record } of matches.slice(0, 30)) {
        const item = document.createElement('li');
        const link = document.createElement('a');
        const destination = new URL(record.url, window.location.origin);
        if (destination.origin !== window.location.origin || !['/en/products/', '/en/news/', '/en/parts-reference/'].some(prefix => destination.pathname.startsWith(prefix))) continue;
        link.href = destination.pathname + destination.hash;
        link.textContent = record.number + ' — ' + record.model;
        const description = document.createElement('p');
        description.textContent = record.description;
        const context = document.createElement('p');
        context.className = 'pn-result-context';
        context.textContent = record.context;
        item.append(link, description, context);
        list.append(item);
      }
      results.append(list);
      status.textContent = matches.length > 30
        ? `${matches.length} reference entries found. Showing the first 30; add more characters to narrow the results.`
        : `${matches.length} reference ${matches.length === 1 ? 'entry' : 'entries'} found. Open an entry to check its equipment context.`;
    } catch (error) {
      if (current !== request) return;
      status.textContent = 'The combined search is unavailable. Choose a reference catalog below, or email the part number and equipment model.';
    }
  });
})();
