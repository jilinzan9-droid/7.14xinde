const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/reference-inquiry.js'), 'utf8');
const publicSymbols = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/public-reference-symbols.json'), 'utf8'));
let checks = 0;
function check(name, value) { assert.ok(value, name); checks++; }

function setup(options = {}) {
  const location = new URL(options.url || 'https://www.pratt-oil.com/en/products/example/?private=PRIVATE#');
  const rootEvents = {}, windowEvents = {}, ids = new Map(), events = [];
  const forbidden = () => { throw new Error('No analytics, persistence, network, submission or popup is allowed'); };
  const root = {dataset: options.disabled ? {} : {referenceProduct: options.product || 'FB-1600 Mud Pump Spare Parts'},
    contains: table => table.owner === root,
    querySelector: selector => selector === '[data-reference-inquiry-status]' ? status : {textContent: 'Fallback product title'},
    querySelectorAll: selector => selector === 'a[href]' ? links : fields,
    addEventListener: (type, callback) => { rootEvents[type] = callback; }};
  const fields = [{value: options.message || ''}, {value: 'User already wrote PRIVATE'}];
  const status = {hidden: true, replaceChildren(...children) {this.children = children;}};
  function link(href, form = false, extra = {}) {
    const attrs = {href};
    return {get href() {return new URL(attrs.href, location).href;}, set href(value) {attrs.href = value;},
      getAttribute: name => attrs[name], setAttribute: (name, value) => {attrs[name] = value;},
      hasAttribute: name => Object.hasOwn(attrs, name),
      closest(selector) {return selector === 'form' ? (form ? {} : null) : selector === 'a[href]' ? this : null;}, ...extra};
  }
  const wa = link('https://api.whatsapp.com/send?phone=8615908080040&text=' + encodeURIComponent(options.waMessage || 'Please quote'));
  const email = link('mailto:sales+parts@pratt-oil.com?subject=FB-1600%20parts&body=Quantity%3A&cc=copy%40pratt-oil.com');
  const retry = link('https://api.whatsapp.com/send?phone=8615908080040', true);
  const evil = link('https://api.whatsapp.com.evil.invalid/?text=Original');
  const links = [wa, email, retry, evil];
  const originals = links.map(item => item.getAttribute('href'));
  function target(id, number, options = {}) {
    const headings = options.headings || ['Item', 'Part / Drawing No.', 'Name', 'Part / Drawing No.', 'Name'];
    const table = {owner: options.outside ? {} : root, tHead: {rows: [{cells: headings.map(textContent => ({textContent}))}]}};
    const cell = {cellIndex: options.index ?? 1, textContent: number,
      matches: selector => selector === 'td, th',
      closest: selector => selector === 'table' ? table : selector === 'thead' && options.inHead ? {} : null,
      hasAttribute: name => name === 'data-reference-number' && Boolean(options.data),
      getAttribute: name => name === 'data-reference-number' ? options.data || null : null,
      querySelectorAll: () => options.multipleCodes ? [{textContent: number}, {textContent: '222'}] : options.code === false ? [] : [{textContent: number}]};
    const row = {cells: options.ambiguous ? [cell, {...cell, cellIndex: 3, textContent: '222', querySelectorAll: () => [{textContent: '222'}]}] : [cell],
      matches: selector => selector === 'tr', closest: cell.closest};
    ids.set(id, options.row ? row : cell);
    return {table, cell};
  }
  target('pn-first', '6316-0022-00');
  target('pn-second', 'NB1602.01.05.00', {index: 3});
  target('pn-leading-zero', '015180102', {headings: ['Part number', 'Description'], index: 0, row: true});
  target('pn-original-2', 'NB2200G.05.18.00（Ⅰ）');
  target('pn-row-number', '42', {index: 0});
  target('pn-description', 'Kit 99 includes 3 items', {index: 2});
  target('pn-outside', '123', {outside: true});
  target('pn-header', '123', {inHead: true});
  target('pn-multiple', '123', {multipleCodes: true});
  target('pn-ambiguous', '123', {row: true, ambiguous: true});
  target('pn-private', 'secret@example.com');
  target('pn-no-digits', 'Unknown');
  target('pn-long', '1'.repeat(101));
  target('pn-raw-cell', 'JC28/11D-06-09', {code: false, headings: ['Item', 'Part / Drawing Reference']});
  target('pn-explicit', 'Displayed component', {data: '1200003993', index: 0});
  const doc = {
    querySelectorAll: () => options.disabled ? [] : [root],
    querySelector: () => ({href: options.canonical || 'https://www.pratt-oil.com/en/products/example/?secret=PRIVATE#ignored'}),
    getElementById: id => ids.get(id),
    createElement: tag => ({tag, handlers: {}, setAttribute(name, value) {this[name] = value;},
      addEventListener(type, callback) {this.handlers[type] = callback;}}),
    dispatchEvent(event) {
      assert.ok(['pratt:reference-selected', 'pratt:reference-cleared'].includes(event.type));
      events.push(event);
    }
  };
  const history = {state: {kept: true}, replaceState(state, unused, href) {
    check('Clearing preserves history state', state.kept); location.href = new URL(href, location).href;
  }};
  const context = {document: doc, location, URL, history,
    CustomEvent: class {constructor(type, options = {}) {this.type = type; this.detail = options.detail;}},
    window: {addEventListener: (type, callback) => {windowEvents[type] = callback;}, open: forbidden, gtag: forbidden},
    localStorage: {setItem: forbidden, getItem: forbidden}, sessionStorage: {setItem: forbidden}, fetch: forbidden};
  vm.createContext(context);
  const run = () => vm.runInContext(source, context);
  run();
  const click = (href, changes = {}) => rootEvents.click?.({button: 0, target: link(href), ...changes});
  const hash = value => {location.hash = value; windowEvents.hashchange?.();};
  const clear = () => status.children[1].handlers.click();
  const message = () => new URL(wa.href).searchParams.get('text');
  return {root, fields, status, wa, email, retry, evil, originals, click, hash, clear, message, run, location, target, events};
}

const e = setup();
check('No selection leaves links and fields untouched', e.wa.getAttribute('href') === e.originals[0] && e.fields[0].value === '' && e.status.hidden);
e.click('#pn-first');
check('Public exact part reaches WhatsApp draft', e.message().includes('Selected part / drawing number: 6316-0022-00'));
check('Product and clean canonical source reach draft', e.message().includes('Product / model: FB-1600 Mud Pump Spare Parts') && e.message().includes('Source page: https://www.pratt-oil.com/en/products/example/'));
check('Exact public row link reaches draft', e.message().includes('Part reference: https://www.pratt-oil.com/en/products/example/#pn-first'));
check('Private URL query and fragment never enter draft', !e.message().includes('PRIVATE') && !e.message().includes('ignored'));
check('Original WhatsApp message and recipient are preserved', e.message().startsWith('Please quote\n\n') && new URL(e.wa.href).searchParams.get('phone') === '8615908080040');
const mail = new URL(e.email.href);
check('Email retains plus-address recipient, subject and cc', mail.pathname === 'sales+parts@pratt-oil.com' && mail.searchParams.get('subject') === 'FB-1600 parts' && mail.searchParams.get('cc') === 'copy@pratt-oil.com');
check('Email body includes original text and exact selected reference', mail.searchParams.get('body').startsWith('Quantity:\n\n') && mail.searchParams.get('body').includes('6316-0022-00'));
check('Mail query uses percent spaces rather than literal plus', !mail.search.includes('+'));
check('Empty message is prefilled', e.fields[0].value.includes('6316-0022-00'));
check('Existing user message is protected', e.fields[1].value === 'User already wrote PRIVATE');
check('Status announces selected part and offers a non-submit clear button', !e.status.hidden && e.status.children[0].role === 'status' && e.status.children[1].type === 'button');
check('Form retry and lookalike hosts are untouched', e.retry.getAttribute('href') === e.originals[2] && e.evil.getAttribute('href') === e.originals[3]);
e.click('#pn-second');
check('Second independent list selects its own number', e.message().includes('NB1602.01.05.00') && !e.message().includes('6316-0022-00'));
check('Unedited automatic message follows selection', e.fields[0].value.includes('NB1602.01.05.00'));
e.click('#pn-second');
check('Repeated click does not append duplicate context', e.message().split('Selected part / drawing number:').length === 2);
e.fields[0].value += '\nMy private specifications';
e.click('#pn-leading-zero');
check('Row targets preserve leading zeros', e.message().includes('015180102'));
check('User edits to automatic text are never overwritten', e.fields[0].value.includes('My private specifications') && e.fields[0].value.includes('NB1602.01.05.00'));
check('No private form text enters contact-link drafts', !e.message().includes('private specifications'));
check('Local selection state contains only the public anchor id', JSON.stringify(e.events.at(-1).detail) === '{"id":"pn-leading-zero"}');
e.hash('#pn-original-2');
check('Hash navigation retains published Unicode reference, not anchor suffix', e.message().includes('Selected part / drawing number: NB2200G.05.18.00（Ⅰ）\n'));
e.hash('#pn-first');
check('Back-style hash change updates selected context', e.message().includes('6316-0022-00') && !e.message().includes('NB2200G'));
for (const id of ['outside', 'header', 'missing']) {
  const before = e.message(); e.click('#pn-' + id); check('Reject invalid reference: ' + id, e.message() === before);
}
for (const id of ['row-number', 'description', 'multiple', 'ambiguous', 'private', 'no-digits', 'long']) {
  e.click('#pn-first'); e.click('#pn-' + id);
  check('Unrecognized table target clears previous contact draft: ' + id, e.wa.getAttribute('href') === e.originals[0] && e.email.getAttribute('href') === e.originals[1]);
  check('Unrecognized table target clears analytics state: ' + id, e.events.at(-1).type === 'pratt:reference-cleared');
  check('Unrecognized table target explains manual entry: ' + id, !e.status.hidden && e.status.children[0].textContent.includes('Enter its number'));
}
e.click('#pn-first');
for (const [href, changes] of [
  ['#pn-second', {ctrlKey: true}], ['#pn-second', {button: 1}], ['#pn-second', {defaultPrevented: true}],
  ['/en/products/other/#pn-second', {}], ['https://evil.invalid/en/products/example/#pn-second', {}], ['#pn-%E0%A4%A', {}]
]) {const before = e.message(); e.click(href, changes); check('Ignore unrelated or modified navigation', e.message() === before);}
e.click('#pn-raw-cell');
check('Raw cell works only under a reference column heading', e.message().includes('JC28/11D-06-09'));
e.click('#pn-explicit');
check('Explicit published data-reference-number is respected', e.message().includes('1200003993') && !e.message().includes('Displayed component'));
e.hash('#pn-first'); e.clear();
check('Clear restores original href and hides selection', e.wa.getAttribute('href') === e.originals[0] && e.email.getAttribute('href') === e.originals[1] && e.status.hidden);
check('Clear removes selected hash but keeps page query', e.location.hash === '' && e.location.search === '?private=PRIVATE');
check('Clear preserves any user-edited message', e.fields[0].value.includes('My private specifications'));
check('Clear dispatches no payload', e.events.at(-1).type === 'pratt:reference-cleared' && e.events.at(-1).detail === undefined);
const auto = setup({url: 'https://www.pratt-oil.com/en/products/example/#pn-leading-zero'});
check('Initial verified anchor prepares context without analytics', auto.message().includes('015180102'));
auto.clear(); check('Clear removes an unchanged automatic message', auto.fields[0].value === '');
auto.click('#pn-first'); auto.run(); auto.click('#pn-second');
check('Duplicate script inclusion does not duplicate context', auto.message().split('Selected part / drawing number:').length === 2);
const disabled = setup({disabled: true}); disabled.click('#pn-first');
check('Unmarked pages are not enabled', disabled.wa.getAttribute('href') === disabled.originals[0]);
const badCanonical = setup({canonical: 'https://evil.invalid/source'}); badCanonical.click('#pn-first');
check('Unrelated canonical host disables enhancement', badCanonical.wa.getAttribute('href') === badCanonical.originals[0]);
const supplied = setup({waMessage: 'Please quote FB-1600 Mud Pump Spare Parts. Part / drawing number: ; quantity: ;\nSource page: https://www.pratt-oil.com/en/products/example/'});
supplied.click('#pn-first');
check('Existing canonical source and exact product are not repeated', supplied.message().split('Source page:').length === 2 && supplied.message().split('FB-1600 Mud Pump Spare Parts').length === 2);
check('Static original template is preserved', supplied.message().includes('Part / drawing number: ; quantity: ;'));
const duplicateRows = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/public-reference-duplicates.json'), 'utf8'));
const duplicateUrl = 'https://www.pratt-oil.com/' + duplicateRows[0].page.replace(/index\.html$/, '');
const duplicate = setup({url: duplicateUrl + '?PRIVATE=ignored', canonical: duplicateUrl + '?PRIVATE=ignored#untrusted', product: 'National 14-P-220'});
const exactLinks = new Set();
for (const record of duplicateRows) {
  const html = fs.readFileSync(path.join(__dirname, '..', record.page), 'utf8');
  check('Duplicate-number fixture is a real published row: ' + record.id, html.includes('id="' + record.id + '"') && html.includes('<code>' + record.number + '</code>'));
  duplicate.target(record.id, record.number); duplicate.click('#' + record.id);
  const exactLink = duplicate.message().split('Part reference: ')[1]; exactLinks.add(exactLink);
  check('Duplicate row carries its precise published anchor: ' + record.id, exactLink === duplicateUrl + '#' + record.id);
}
check('Same published part number yields distinct reference links per source row', exactLinks.size === duplicateRows.length && duplicateRows.length === 4);
check('Exact row and source links exclude current query data', !duplicate.message().includes('?') && !duplicate.message().includes('PRIVATE'));
const unreadable = setup(); unreadable.click('#pn-first'); unreadable.click('#pn-private');
check('Unrecognized target clears an untouched generated message', unreadable.fields[0].value === '');
check('Unrecognized target preserves a user-written message', unreadable.fields[1].value === 'User already wrote PRIVATE');
unreadable.click('#pn-first'); unreadable.hash('#pn-long');
check('Hash navigation to an unrecognized real target also clears stale context', unreadable.wa.getAttribute('href') === unreadable.originals[0] && unreadable.events.at(-1).type === 'pratt:reference-cleared');
const unknownInitial = setup({url: 'https://www.pratt-oil.com/en/products/example/#pn-private'});
check('Direct unrecognized table anchor prompts manual entry without a draft selection', !unknownInitial.status.hidden && unknownInitial.fields[0].value === '' && unknownInitial.events.at(-1).type === 'pratt:reference-cleared');
const symbols = setup();
for (const record of publicSymbols) {
  const html = fs.readFileSync(path.join(__dirname, '..', record.page), 'utf8');
  const escaped = record.number.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  check('Real catalog fixture remains published: ' + record.id, html.includes('id="' + record.id + '"') && (html.includes('<code>' + escaped + '</code>') || html.includes('<code>' + escaped.replace(/"/g, '&quot;') + '</code>')));
  symbols.target(record.id, record.number); symbols.click('#' + record.id);
  check('Published catalog symbols survive WhatsApp and email: ' + record.id, symbols.message().includes('Selected part / drawing number: ' + record.number + '\n') && new URL(symbols.email.href).searchParams.get('body').includes(record.number));
}
check('Local events never contain typed or URL private data', !JSON.stringify(e.events).includes('PRIVATE') && !JSON.stringify(e.events).includes('private specifications'));
check('No analytics or automatic send API is present in enhancement', !/gtag|dataLayer|window\.open|\.submit\(|fetch\(|Storage/.test(source));
console.log(JSON.stringify({status: 'passed', checks, scope: 'Actual enhancement JavaScript in Node VM; no network, analytics or inquiry sent.'}));
