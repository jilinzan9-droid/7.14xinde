const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/jichai-catalog.js'), 'utf8');
let checks = 0;
const check = (name, condition) => { assert.ok(condition, name); checks++; };

function setup(options = {}) {
  const events = target => {
    const handlers = new Map();
    target.addEventListener = (type, fn) => {
      if (!handlers.has(type)) handlers.set(type, new Set());
      handlers.get(type).add(fn);
    };
    target.removeEventListener = (type, fn) => handlers.get(type)?.delete(fn);
    target.emit = (type, event = {}) => {
      event.preventDefault ||= () => { event.defaultPrevented = true; };
      [...handlers.get(type) || []].forEach(fn => fn(event));
    };
    return target;
  };
  const control = value => events({value, hidden: false, disabled: false, focus() { this.focused = true; }});
  const nodes = {
    form: control(''), search: control(''), family: control('all'), size: control('25'), reset: control(''),
    previous: control(''), next: control(''), label: {textContent: ''}, pagination: {hidden: true}, empty: {hidden: true}
  };
  let statusText = '', throwStatus = Boolean(options.failRender);
  nodes.status = {get textContent() { return statusText; }, set textContent(value) {
    if (throwStatus) { throwStatus = false; throw new Error('Unexpected DOM failure'); }
    statusText = value;
  }};
  const fixtureRows = Array.from({length: 75}, (_, index) => {
    const number = index < 2 ? '0012.34-AB' : 'J-' + String(index + 1).padStart(4, '0');
    const description = index < 2 ? 'Main bearing shell' : index === 69 ? 'Fuel injection pump' : 'Cylinder component ' + (index + 1);
    return {id: 'pn-jichai-' + (index + 1), family: index < 50 ? 'engine-a' : 'engine-b', number, description};
  });
  const rowList = (options.rows || fixtureRows).map(item => {
    const row = {id: item.id, dataset: {family: item.family}, hidden: false,
      number: {textContent: item.number}, description: {textContent: item.description},
      querySelector(selector) { return selector === 'td[data-part-number] code' ? this.number : selector === '.catalog-description' ? this.description : null; },
      scrollIntoView() { this.scrolled = true; }};
    return row;
  });
  if (options.badRow) rowList[26].querySelector = () => null;
  const selectors = {
    '[data-catalog-search-form]': 'form', '#jichai-search': 'search', '#jichai-family': 'family', '#jichai-page-size': 'size',
    '[data-catalog-reset]': 'reset', '[data-catalog-status]': 'status', '[data-catalog-page="previous"]': 'previous',
    '[data-catalog-page="next"]': 'next', '[data-catalog-page-label]': 'label', '[data-catalog-pagination]': 'pagination', '[data-catalog-empty]': 'empty'
  };
  const root = events({dataset: {}, contains: item => Boolean(item?.inside),
    querySelector: selector => options.missingControl && selector === '#jichai-search' ? null : nodes[selectors[selector]],
    querySelectorAll: selector => selector === 'tbody tr[data-catalog-row]' ? rowList : []});
  const location = new URL(options.url || 'https://www.pratt-oil.com/en/products/jichai-engine-spare-parts/');
  const window = events({location, requestAnimationFrame: callback => callback()});
  const forbidden = () => { throw new Error('No network, persistence, analytics or sending permitted'); };
  const context = vm.createContext({document: {querySelectorAll: () => options.unmarked ? [] : [root]}, window, URL,
    fetch: forbidden, localStorage: {setItem: forbidden}, sessionStorage: {setItem: forbidden}});
  const run = () => vm.runInContext(source, context);
  run();
  const visible = () => rowList.filter(row => !row.hidden);
  const search = value => { nodes.search.value = value; nodes.search.emit('input'); };
  const family = value => { nodes.family.value = value; nodes.family.emit('change'); };
  const size = value => { nodes.size.value = String(value); nodes.size.emit('change'); };
  const hash = value => { location.hash = value; window.emit('hashchange'); };
  const click = (href, extra = {}) => {
    const link = {inside: true, target: '', getAttribute: name => name === 'href' ? href : null,
      hasAttribute: () => false, closest() { return this; }, ...extra};
    root.emit('click', {button: 0, target: link, ...extra});
  };
  return {nodes, root, rowList, location, window, visible, search, family, size, hash, click, run};
}

const e = setup();
check('Enhancement starts on 25 rows in original order', e.visible().length === 25 && e.visible()[0] === e.rowList[0] && e.visible()[24] === e.rowList[24]);
check('Initial pager and count are accurate', !e.nodes.pagination.hidden && e.nodes.label.textContent === 'Page 1 of 3' && e.nodes.status.textContent === 'Showing 1–25 of 75 reference entries.');
check('Previous disabled and next enabled on first page', e.nodes.previous.disabled && !e.nodes.next.disabled);
e.nodes.next.emit('click');
check('Next page reveals rows 26 through 50', e.visible()[0] === e.rowList[25] && e.visible().at(-1) === e.rowList[49] && e.nodes.label.textContent === 'Page 2 of 3');
e.nodes.next.emit('click');
check('Last page disables next', e.visible()[0] === e.rowList[50] && e.nodes.next.disabled);
e.nodes.next.emit('click');
check('Out-of-range page is clamped', e.nodes.label.textContent === 'Page 3 of 3' && e.visible().length === 25);
e.nodes.previous.emit('click');
check('Previous page works', e.nodes.label.textContent === 'Page 2 of 3');

e.search('0012 34 / ab');
check('Part search normalizes punctuation, spaces and case', e.visible().length === 2 && e.visible()[0] === e.rowList[0]);
check('Duplicate references remain distinct original rows', e.visible()[1] === e.rowList[1] && e.visible()[0].id !== e.visible()[1].id);
check('Original displayed leading zeros and punctuation are unchanged', e.rowList[0].number.textContent === '0012.34-AB');
e.search('BEARING shell');
check('Description supports multiple case-insensitive words', e.visible().length === 2);
e.search('ＦＵＥＬ pump');
check('Unicode normalization works without changing displayed text', e.visible().length === 1 && e.visible()[0] === e.rowList[69]);
e.search('missingpart');
check('Zero results has correct status and pager', e.visible().length === 0 && !e.nodes.empty.hidden && e.nodes.pagination.hidden && e.nodes.label.textContent === 'Page 0 of 0' && e.nodes.status.textContent.includes('75 total'));

e.search(''); e.family('engine-b');
check('Family filter returns exact original family records', e.visible().length === 25 && e.visible()[0] === e.rowList[50]);
e.search('J 0069');
check('Search and family filter combine', e.visible().length === 1 && e.visible()[0] === e.rowList[68]);
e.family('engine-a');
check('Incompatible family and part have no results', e.visible().length === 0);
e.nodes.reset.emit('click');
check('Reset restores all filters, 25 per page and focus', e.nodes.search.value === '' && e.nodes.family.value === 'all' && e.nodes.size.value === '25' && e.visible().length === 25 && e.nodes.search.focused);
e.size(50);
check('50 per page preserves original order and exact totals', e.visible().length === 50 && e.nodes.label.textContent === 'Page 1 of 2');
e.nodes.next.emit('click');
check('Final partial page shows remaining 25 rows', e.visible().length === 25 && e.nodes.status.textContent === 'Showing 51–75 of 75 reference entries.');
e.size(100);
check('100 per page shows all 75 records', e.visible().length === 75 && e.nodes.label.textContent === 'Page 1 of 1' && e.nodes.next.disabled);
e.size(7);
check('Unsupported page sizes fall back to 25', e.visible().length === 25 && e.nodes.label.textContent === 'Page 1 of 3');

e.search('bearing'); e.family('engine-a'); e.size(25); e.hash('#pn-jichai-70');
check('Deep link clears only incompatible search and family', e.nodes.search.value === '' && e.nodes.family.value === 'all');
check('Deep link opens correct page and keeps row visible', !e.rowList[69].hidden && e.nodes.label.textContent === 'Page 3 of 3' && e.rowList[69].scrolled);
e.hash('#pn-jichai-2');
check('Back-style hash navigation reveals earlier source row', !e.rowList[1].hidden && e.nodes.label.textContent === 'Page 1 of 3');
e.family('engine-b'); e.search('fuel'); e.hash('#pn-jichai-70');
check('Compatible filters are preserved on deep link', e.nodes.family.value === 'engine-b' && e.nodes.search.value === 'fuel' && e.visible().length === 1);
e.search('bearing'); e.click('#pn-jichai-70');
check('Repeated same-hash link reveals target hidden by subsequent filtering', !e.rowList[69].hidden && e.nodes.search.value === '');
e.search('bearing'); e.click('#pn-jichai-70', {ctrlKey: true});
check('Modified links do not alter current table filters', e.nodes.search.value === 'bearing');
e.hash('#pn-jichai-%E0%A4%A');
check('Malformed hash leaves filtered table usable', e.nodes.search.value === 'bearing' && e.root.dataset.jichaiCatalogReady === 'true');
e.hash('#pn-jichai-99999');
check('Unknown target does not reset filters', e.nodes.search.value === 'bearing');
e.hash('#outside-row');
check('Other page anchors are ignored', e.nodes.search.value === 'bearing');

const direct = setup({url: 'https://www.pratt-oil.com/en/products/jichai-engine-spare-parts/#pn-jichai-70'});
check('Initial direct link reveals row beyond initial page', !direct.rowList[69].hidden && direct.nodes.label.textContent === 'Page 3 of 3');
direct.run(); direct.nodes.previous.emit('click');
check('Duplicate script inclusion does not duplicate pager events', direct.nodes.label.textContent === 'Page 2 of 3');
direct.nodes.search.value = 'bearing'; direct.nodes.form.emit('submit');
check('Keyboard form submission applies search without navigation', direct.visible().length === 2 && direct.location.hash === '#pn-jichai-70');
for (const [name, options] of [['missing required control', {missingControl: true}], ['incomplete row', {badRow: true}], ['render exception', {failRender: true}], ['unmarked root', {unmarked: true}]]) {
  const fallback = setup(options);
  check('SSR rows survive ' + name, fallback.visible().length === 75 && !fallback.root.dataset.jichaiCatalogReady && fallback.nodes.pagination.hidden);
}
check('Implementation has no rebuilding, network, storage, tracking or send API', !/innerHTML|createElement|replaceChildren|fetch\(|Storage|gtag|dataLayer|\.submit\(|window\.open/.test(source));

// Verify the published markup as well as synthetic event fixtures. This uses the
// committed download as the reference, so CI does not depend on a local workbook.
const decode = text => text.replace(/&(?:amp|quot|apos|lt|gt|nbsp|#\d+|#x[\da-f]+);/gi, entity => {
  const named = {'&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>', '&nbsp;': '\u00a0'};
  if (entity[1] !== '#') return named[entity.toLowerCase()];
  return String.fromCodePoint(entity[2].toLowerCase() === 'x' ? parseInt(entity.slice(3, -1), 16) : Number(entity.slice(2, -1)));
});
const attributes = text => Object.fromEntries([...text.matchAll(/([\w:-]+)(?:="([^"]*)")?/g)]
  .map(match => [match[1], decode(match[2] || '')]));
const html = fs.readFileSync(path.join(__dirname, '../en/products/jichai-engine-spare-parts/index.html'), 'utf8');
const section = html.match(/<section\b([^>]*\bdata-jichai-catalog[^>]*)>([\s\S]*?)<\/section>/);
check('Real HTML contains a marked catalog section', Boolean(section));
const catalogHtml = section[2];
const elements = tag => [...catalogHtml.matchAll(new RegExp('<' + tag + '\\b([^>]*)>', 'g'))].map(match => attributes(match[1]));
const input = elements('input').find(attrs => attrs.id === 'jichai-search');
check('Real search input has the contracted id, type and live status reference', input?.type === 'search' && input['aria-describedby'] === 'jichai-status');
check('Real form and reset button satisfy the interaction contract', elements('form').some(attrs => Object.hasOwn(attrs, 'data-catalog-search-form'))
  && elements('button').some(attrs => Object.hasOwn(attrs, 'data-catalog-reset') && attrs.type === 'button'));
const select = id => [...catalogHtml.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)].find(match => attributes(match[1]).id === id);
const options = selection => selection ? [...selection[2].matchAll(/<option\b([^>]*)>/g)].map(match => attributes(match[1])) : [];
const families = options(select('jichai-family'));
const defaultOption = values => values.find(attrs => Object.hasOwn(attrs, 'selected')) || values[0];
check('Real family selector defaults to all, matching the JavaScript contract', defaultOption(families)?.value === 'all');
const sizes = options(select('jichai-page-size'));
check('Real page-size selector offers 25, 50, 100 and defaults to 25', sizes.map(attrs => attrs.value).join(',') === '25,50,100' && defaultOption(sizes)?.value === '25');
check('Real form has explicit labels for all three controls', ['jichai-search', 'jichai-family', 'jichai-page-size'].every(id => elements('label').some(attrs => attrs.for === id)));
check('Real catalog status is an accessible live region', elements('p').some(attrs => Object.hasOwn(attrs, 'data-catalog-status') && attrs.id === 'jichai-status' && attrs.role === 'status'));
check('Real pager buttons and label satisfy the contract', ['previous', 'next'].every(value => elements('button').some(attrs => attrs['data-catalog-page'] === value && attrs.type === 'button'))
  && elements('span').some(attrs => Object.hasOwn(attrs, 'data-catalog-page-label')));
check('Real pager and empty state start hidden for progressive enhancement', elements('div').some(attrs => Object.hasOwn(attrs, 'data-catalog-pagination') && Object.hasOwn(attrs, 'hidden'))
  && elements('p').some(attrs => Object.hasOwn(attrs, 'data-catalog-empty') && Object.hasOwn(attrs, 'hidden')));

const publishedRows = [...catalogHtml.matchAll(/<tr\b([^>]*)>([\s\S]*?)<\/tr>/g)]
  .filter(match => Object.hasOwn(attributes(match[1]), 'data-catalog-row')).map(match => {
    const attrs = attributes(match[1]);
    assert.ok(!Object.hasOwn(attrs, 'hidden'), 'Published rows must remain visible without JavaScript: ' + attrs.id);
    const cells = [...match[2].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/g)];
    const numberCell = cells.find(cell => Object.hasOwn(attributes(cell[1]), 'data-part-number'));
    const descriptionCell = cells.find(cell => (attributes(cell[1]).class || '').split(/\s+/).includes('catalog-description'));
    assert.ok(numberCell && descriptionCell, 'Every real row supplies both contracted cells: ' + attrs.id);
    const number = numberCell[2].match(/<code\b[^>]*>([\s\S]*?)<\/code>/);
    assert.ok(number, 'Every real reference is contained in code: ' + attrs.id);
    const link = numberCell[2].match(/<a\b([^>]*)>/);
    assert.equal(attributes(link[1]).href, '#' + attrs.id, 'Reference link must target its own original row');
    return {id: attrs.id, family: attrs['data-family'], number: decode(number[1]), description: decode(descriptionCell[2].replace(/<[^>]*>/g, ''))};
  });
check('Real SSR table contains 1295 retained source entries', publishedRows.length === 1295);
check('Real source row ids are unique and source item 178 is excluded', new Set(publishedRows.map(row => row.id)).size === publishedRows.length
  && !publishedRows.some(row => row.id === 'pn-jichai-178'));
const familyValues = new Set(families.map(attrs => attrs.value));
check('Every real row family has a selectable option', publishedRows.every(row => row.family && familyValues.has(row.family)));
check('Repeated part numbers remain separate published entries', new Set(publishedRows.map(row => row.number)).size < publishedRows.length);
check('Real page loads the catalog and reference-draft enhancements with defer', /<script\b[^>]*defer[^>]*src="\/assets\/js\/jichai-catalog\.js(?:\?[^"]*)?"/.test(html)
  && /<script\b[^>]*defer[^>]*src="\/assets\/js\/reference-inquiry\.js(?:\?[^"]*)?"/.test(html));

function readCsv(text) {
  const records = []; let row = [], field = '', quoted = false;
  text = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); records.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
  }
  if (field || row.length) { row.push(field); records.push(row); }
  return records;
}
const csvRows = readCsv(fs.readFileSync(path.join(__dirname, '../assets/catalogs/jichai-engine-parts-reference.csv'), 'utf8'));
check('Published download retains its source-number, number and description columns', csvRows[0].join('|') === 'Reference No.|Part Number|English Description');
const downloadRows = csvRows.slice(1);
check('Real table and download preserve identical source order and exact original number strings', downloadRows.length === publishedRows.length
  && downloadRows.every((row, index) => publishedRows[index].id === 'pn-jichai-' + row[0] && publishedRows[index].number === row[1]));
check('Real table retains each supplied English description from its download', downloadRows.every((row, index) => !row[2] || publishedRows[index].description === row[2]));
check('Source item 178 is absent from the public download', !downloadRows.some(row => row[0] === '178'));

const last = publishedRows.at(-1);
const real = setup({rows: publishedRows, url: 'https://www.pratt-oil.com/en/products/jichai-engine-spare-parts/#' + last.id});
check('Real 1295-row data initializes correctly and deep-links to its last source entry', real.root.dataset.jichaiCatalogReady === 'true'
  && !real.rowList.at(-1).hidden && real.nodes.label.textContent === 'Page 52 of 52');
check('Real duplicate entries are counted as references, not unique parts', real.nodes.status.textContent === 'Showing 1,276–1,295 of 1,295 reference entries.');
real.hash('#pn-jichai-1');
check('Real published deep-link return opens its first page', !real.rowList[0].hidden && real.nodes.label.textContent === 'Page 1 of 52');
console.log(JSON.stringify({status: 'passed', checks, publishedRows: publishedRows.length,
  scope: 'Actual catalog JavaScript in Node VM plus real published HTML/download contract, original numbers, source order, exclusion and deep-link pagination.'}));
