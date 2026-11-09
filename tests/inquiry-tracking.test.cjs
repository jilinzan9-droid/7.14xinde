const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['assets/js/analytics.js', 'script.js', 'assets/js/zq-inquiry.js', 'assets/js/part-number-lookup.js'];
const source = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file), 'utf8')]));
const checks = [];
const PRIVATE = 'PRIVATE_PERSON_contact@example.invalid';
const product = '/en/products/burovoy-gidravlicheskiy-klyuch-serii-zq/';
const guide = '/en/news/honghua-3nb-500f-spare-parts-material-code-guide/';
function check(name, predicate) { assert.ok(predicate, name); checks.push(name); }
function env(options = {}) {
  const listeners = {}, scripts = [], opened = [], forms = [], publicIds = new Set(options.ids || []);
  const location = new URL(options.url || 'https://www.pratt-oil.com' + product + '?utm_content=' + PRIVATE + '&utm_term=' + PRIVATE + '&email=' + PRIVATE + '#private');
  const canonical = 'https://www.pratt-oil.com' + (options.path || location.pathname);
  const doc = {
    referrer: 'https://www.google.com/search/' + PRIVATE + '?q=' + PRIVATE,
    documentElement: {lang: options.lang || 'en'}, title: 'Published product title',
    head: {appendChild(script) {scripts.push(script);}},
    querySelector(sel) {
      if (sel === 'link[rel="canonical"]') return {href: canonical};
      if (sel.includes('data-product-overview')) return options.product === false ? null : {};
      if (sel.includes('data-pump-reference-table')) return options.reference ? {} : null;
      if (sel === '[data-zq-inquiry]') return forms.find(x => x.kind === 'zq') || null;
      if (sel === '[data-quote-form]') return forms.find(x => x.kind === 'homepage') || null;
      if (sel.includes('main h1')) return {textContent: 'Published product title'};
      return null;
    },
    querySelectorAll(sel) {
      if (sel === '[data-contact-inquiry]') return forms.filter(x => x.kind === 'contact');
      if (sel === '[data-product-detail-inquiry]') return forms.filter(x => x.kind === 'product');
      if (sel === '[data-zq-model]') return [];
      return [];
    },
    getElementById(id) {
      if (!publicIds.has(id)) return null;
      const value = options.referenceValues?.[id] === undefined ? id.slice(3) : options.referenceValues[id];
      const cell = {textContent: value, matches(sel) {return sel === 'td, th';},
        closest(sel) {return sel === 'table' ? {} : null;},
        querySelector(sel) {return sel === 'code' && options.codeCells ? {textContent: value} : null;},
        getAttribute(name) {return name === 'data-reference-number' && options.dataCells ? value : null;}};
      if (options.rowTargets) return {closest(sel) {return sel === 'table' ? {} : null;}, matches(sel) {return sel === 'tr';}, cells: [cell, {textContent: 'Description should not become the number'}]};
      return cell;
    },
    createElement(tag) {return {tag, dataset: {}, handlers: {}, addEventListener(type, listener) {this.handlers[type] = listener;}, closest(sel) {return sel === 'a[href]' && tag === 'a' ? this : null;}};},
    createTextNode(text) {return {textContent: text};},
    addEventListener(type, listener) {(listeners[type] ||= []).push(listener);},
    dispatchEvent(event) {for (const listener of listeners[event.type] || []) listener(event);}
  };
  const win = {location, addEventListener() {}, matchMedia() {return {matches: true, addEventListener() {}};}, open(...args) {opened.push(args); return options.popupBlocked ? null : {};}};
  const ctx = {window: win, document: doc, location, URL, Date,
    localStorage: {getItem() {return options.optout ? '1' : null;}},
    CustomEvent: class {constructor(type, options = {}) {this.type = type; this.detail = options.detail;}},
    Event: class {constructor(type) {this.type = type;}},
    FormData: class {constructor(form) {this.form = form;} get(name) {return this.form.values[name] || '';}}
  };
  vm.createContext(ctx);
  const run = file => vm.runInContext(source[file], ctx, {filename: file});
  run('assets/js/analytics.js');
  const commands = () => Array.from(win.dataLayer || [], x => Array.from(x));
  const events = () => commands().filter(x => x[0] === 'event');
  const click = (href, container = '', data = {}) => {
    const link = {href: new URL(href, location).href, dataset: data, closest(sel) {
      if (sel === 'a[href]') return this;
      if (container && sel.split(',').map(x => x.trim()).includes(container)) return {};
      return null;
    }};
    doc.dispatchEvent({type: 'click', target: {closest: sel => sel === 'a[href]' ? link : null}});
    return link;
  };
  function addForm(kind) {
    const attrs = {product: 'data-product-detail-inquiry', contact: 'data-contact-inquiry', homepage: 'data-quote-form', zq: 'data-zq-inquiry'};
    const status = {textContent: '', children: [], append(...items) {this.children.push(...items);}, replaceChildren(...items) {this.children = items;}};
    const values = {model: 'ZQ203-100', requirement: 'Replacement parts', quantity: '2', details: PRIVATE, name: PRIVATE, contact: PRIVATE, email: PRIVATE, phone: PRIVATE, company: PRIVATE, country: PRIVATE, part: PRIVATE, message: PRIVATE, part_number: PRIVATE};
    const form = {kind, values, status, handlers: {}, valid: true, elements: {}, hasAttribute(name) {return name === attrs[kind];},
      matches(sel) {return sel.includes('[' + attrs[kind] + ']');},
      querySelector(sel) {return sel === '[data-contact-submit]' ? {disabled: true} : status;},
      addEventListener(type, listener) {this.handlers[type] = listener;}, reportValidity() {return this.valid;}
    };
    form.elements.model = {value: values.model, closest() {return form;}};
    forms.push(form); return form;
  }
  return {win, doc, ctx, run, commands, events, click, addForm, scripts, opened};
}

for (const url of ['http://127.0.0.1:8782/', 'https://preview.example.invalid/']) {
  const e = env({url}); check('Local/preview traffic excluded: ' + url, e.scripts.length === 0 && e.events().length === 0);
}
check('Opt-out prevents collection', env({optout: true}).scripts.length === 0);
const e = env();
check('Product view counted once', e.events().filter(x => x[1] === 'product_view').length === 1);
e.run('assets/js/analytics.js');
check('Duplicate analytics inclusion has one loader and one product view', e.scripts.length === 1 && e.events().length === 1);
const config = e.commands().find(x => x[0] === 'config')[2];
check('Referrer is origin only', config.page_referrer === 'https://www.google.com');
check('UTM and URL personal data excluded from config', !JSON.stringify(config).includes(PRIVATE) && !Object.keys(config).some(x => x.startsWith('campaign_')) && !config.page_location.includes('?'));
const tagged = env({url: 'https://www.pratt-oil.com' + product + '?utm_source=LinkedIn&utm_medium=SOCIAL&utm_campaign=' + PRIVATE + '&utm_term=' + PRIVATE + '&utm_content=' + PRIVATE + '&utm_id=' + PRIVATE});
const taggedConfig = tagged.commands().find(x => x[0] === 'config')[2];
check('Known campaign source and medium preserved as a normalized pair', taggedConfig.campaign_source === 'linkedin' && taggedConfig.campaign_medium === 'social');
check('Unknown campaign name/id/term/content never forwarded', Object.keys(taggedConfig).filter(x => x.startsWith('campaign_')).sort().join(',') === 'campaign_medium,campaign_source' && !JSON.stringify(tagged.commands()).includes(PRIVATE));
for (const query of ['utm_source=google', 'utm_source=' + PRIVATE + '&utm_medium=email', 'utm_source=newsletter&utm_medium=' + PRIVATE]) {
  const rejected = env({url: 'https://www.pratt-oil.com' + product + '?' + query});
  const rejectedConfig = rejected.commands().find(x => x[0] === 'config')[2];
  check('Incomplete or unrecognized UTM pair rejected: ' + query.split('=')[0] + ':' + checks.length, !Object.keys(rejectedConfig).some(x => x.startsWith('campaign_')) && !JSON.stringify(rejected.commands()).includes(PRIVATE));
}
for (const [href, container, method] of [
  ['https://api.whatsapp.com/send?phone=123&text=' + PRIVATE, '.product-overview', 'whatsapp'],
  ['https://wa.me/123?text=' + PRIVATE, 'footer', 'whatsapp'],
  ['mailto:' + PRIVATE + '?body=' + PRIVATE, 'header', 'email'],
  ['tel:+12345678', '.floating-whatsapp', 'phone']
]) {
  const before = e.events().length; e.click(href, container);
  check('Exactly one contact event: ' + method + ' ' + container, e.events().length === before + 1 && e.events().at(-1)[1] === 'contact_click');
  check('Contact means intent: ' + container, e.events().at(-1)[2].inquiry_stage === 'contact_intent' && e.events().at(-1)[2].contact_method === method);
}
const beforeUnrelated = e.events().length;
e.click('https://api.whatsapp.com.evil.invalid/send');
e.click('https://external.invalid/?next=wa.me');
check('Lookalike and unrelated domains ignored', e.events().length === beforeUnrelated);
e.click(product + '#product_inquiry_form', '', {zqModel: 'ZQ203-100'});
check('Published model shortcut attributed', e.events().at(-1)[1] === 'inquiry_open' && e.events().at(-1)[2].model_id === 'ZQ203-100');
e.click(guide, '.product-overview');
check('Related guide navigation counted', e.events().at(-1)[1] === 'related_content_click' && e.events().at(-1)[2].destination_path === guide);
const beforeNav = e.events().length; e.click(guide, 'header');
check('Global navigation excluded from related-content events', e.events().length === beforeNav);

const news = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true, ids: ['pn-1200009392']});
news.click('#pn-1200009392', '.pump-guide-body');
check('News part number click attributed to reference guide', news.events().at(-1)[2].page_type === 'reference_guide' && news.events().at(-1)[2].reference_id === '1200009392');
news.click('https://wa.me/123?text=' + PRIVATE);
check('Contact intent retains selected published part', news.events().at(-1)[2].reference_id === '1200009392' && news.events().at(-1)[2].reference_page === guide);
news.click('/assets/data/model-reference/honghua-3nb-500f-spare-parts-material-code-guide.csv?email=' + PRIVATE);
check('Public catalog download uses only clean path', news.events().at(-1)[1] === 'reference_download' && !news.events().at(-1)[2].destination_path.includes('?'));
const fromSearch = env({url: 'https://www.pratt-oil.com/en/parts-reference/', product: false});
fromSearch.click(guide + '#pn-1200009392', '.pn-results', {referenceNumber: '1200009392', referenceModel: 'Honghua 3NB-500F'});
check('Search result carries catalog number and model', fromSearch.events().at(-1)[2].reference_model === 'Honghua 3NB-500F' && fromSearch.events().at(-1)[2].page_type === 'parts_reference');
const direct = env({url: 'https://www.pratt-oil.com' + guide + '#pn-1200009392', product: false, reference: true, ids: ['pn-1200009392']});
direct.click('mailto:2000@pratt-oil.com');
check('Direct valid part-number anchor preserved for contact context', direct.events().at(-1)[2].reference_id === '1200009392');
const unknown = env({url: 'https://www.pratt-oil.com' + guide + '#pn-PRIVATE123', product: false, reference: true});
unknown.click('mailto:2000@pratt-oil.com');
check('Unpublished fragment is never reported', !unknown.events().at(-1)[2].reference_id);
const landing = env({url: 'https://www.pratt-oil.com/en/mud-pump-spare-parts/', product: false, reference: true, ids: ['pn-1200009392']});
landing.click('#pn-1200009392', '.lp-reference');
check('Landing-page published table anchor is measured', landing.events().at(-1)[1] === 'part_reference_click' && landing.events().at(-1)[2].reference_id === '1200009392');
const landingBefore = landing.events().length;
landing.click('#pn-PRIVATE123', '.lp-reference');
check('Same-page fake fragment without a table target is rejected', landing.events().length === landingBefore);
const guideBefore = news.events().length;
news.click('#pn-PRIVATE123', '.pump-guide-body');
check('Guide container cannot authorize a nonexistent table anchor', news.events().length === guideBefore);
const exactValues = {'pn-gb-t41-1986-10': 'GB/T41—1986', 'pn-ref-2-29-4': '236WCB2', 'pn-unknown-7': ''};
const exact = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true, ids: Object.keys(exactValues), referenceValues: exactValues, codeCells: true});
for (const [id, expected] of Object.entries(exactValues).filter(([, value]) => value)) {
  exact.click('#' + id, '.pump-guide-body');
  check('Original public number, never generated anchor: ' + id, exact.events().at(-1)[2].reference_id === expected);
}
const emptyBefore = exact.events().length; exact.click('#pn-unknown-7', '.pump-guide-body');
check('Missing public identifier is omitted rather than inferred from anchor', exact.events().length === emptyBefore);
const rowTarget = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true, ids: ['pn-first-row'], referenceValues: {'pn-first-row': '1292243'}, rowTargets: true});
rowTarget.click('#pn-first-row', '.pump-guide-body');
check('Row anchor reads first identifier cell without description', rowTarget.events().at(-1)[2].reference_id === '1292243');
const dataTarget = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true, ids: ['pn-known-1'], referenceValues: {'pn-known-1': 'NB2200G.05.18.00（Ⅰ）'}, dataCells: true});
dataTarget.click('#pn-known-1', '.pump-guide-body');
check('Published Unicode drawing identifier is preserved', dataTarget.events().at(-1)[2].reference_id === 'NB2200G.05.18.00（Ⅰ）');
fromSearch.click('/en/products/wcb-eaton-auxiliary-brake-wear-plate/#wcb-part', '.pn-results', {referenceNumber: '236WCB2', referenceModel: 'WCB 236'});
check('Public search result supports shared non-pn anchor', fromSearch.events().at(-1)[1] === 'part_reference_click' && fromSearch.events().at(-1)[2].reference_id === '236WCB2');
fromSearch.click('/en/products/burovoy-gidravlicheskiy-klyuch-serii-zq/#part-identification', '.pn-results', {referenceNumber: 'ZQ203-100', referenceModel: 'ZQ203-100'});
check('Public part-identification result is attributed', fromSearch.events().at(-1)[1] === 'part_reference_click' && fromSearch.events().at(-1)[2].reference_id === 'ZQ203-100');
fromSearch.click('/en/products/burovoy-gidravlicheskiy-klyuch-serii-zq/#part-identification', '', {referenceNumber: 'PRIVATE123'});
check('Generic links cannot authorize arbitrary data-reference identifiers', fromSearch.events().at(-1)[1] !== 'part_reference_click');
news.click('/assets/catalogs/zq203-parts.csv?email=' + PRIVATE);
check('Catalog CSV download uses clean public path', news.events().at(-1)[1] === 'reference_download' && news.events().at(-1)[2].destination_path === '/assets/catalogs/zq203-parts.csv');

for (const kind of ['product', 'contact', 'homepage']) {
  const formEnv = env({product: kind === 'product'}), form = formEnv.addForm(kind);
  formEnv.run('script.js');
  const target = {closest() {return form;}};
  formEnv.doc.dispatchEvent({type: 'input', target}); formEnv.doc.dispatchEvent({type: 'change', target});
  check(kind + ': form start deduplicated', formEnv.events().filter(x => x[1] === 'inquiry_start').length === 1);
  form.handlers.submit({preventDefault() {}});
  form.handlers.submit({preventDefault() {}});
  check(kind + ': same draft only counted once', formEnv.events().filter(x => x[1] === 'inquiry_draft_prepared').length === 1);
  form.values.message += ' changed'; form.values.details += ' changed';
  form.handlers.submit({preventDefault() {}});
  check(kind + ': edited draft counted separately', formEnv.events().filter(x => x[1] === 'inquiry_draft_prepared').length === 2);
  check(kind + ': draft opens remain available on repeat', formEnv.opened.length === 3);
  check(kind + ': fallback href has no customer fields', !form.status.children.at(-1).href.includes('text='));
  check(kind + ': prepared stage is not a sent lead', formEnv.events().filter(x => x[1] === 'inquiry_draft_prepared').every(x => x[2].inquiry_stage === 'draft_prepared'));
  check(kind + ': no private values in any analytics command', !JSON.stringify(formEnv.commands()).includes(PRIVATE));
}

const zq = env(), zqForm = zq.addForm('zq'); zq.run('assets/js/zq-inquiry.js');
zqForm.valid = false; zqForm.handlers.submit({preventDefault() {}, submitter: {value: 'whatsapp'}});
check('Invalid ZQ form neither opens nor records draft', zq.opened.length === 0 && !zq.events().some(x => x[1] === 'inquiry_draft_prepared'));
zqForm.valid = true;
for (const channel of ['whatsapp', 'whatsapp', 'email']) zqForm.handlers.submit({preventDefault() {}, submitter: {value: channel}});
check('ZQ unchanged same channel deduplicated, email distinct', zq.events().filter(x => x[1] === 'inquiry_draft_prepared').length === 2);
check('ZQ draft carries only allowlisted model', zq.events().at(-1)[2].model_id === 'ZQ203-100');
check('ZQ retry URLs are clean', !zqForm.status.children.at(-1).href.includes('body='));
for (const environment of [e, news, fromSearch, direct, unknown, zq]) {
  check('All queued analytics commands exclude customer input', !JSON.stringify(environment.commands()).includes(PRIVATE));
  check('No event claims a sent/delivered/qualified lead', !environment.events().some(x => /generate_lead|success|sent|delivered|qualified/.test(x[1])));
}
const synced = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true, ids: ['pn-known'], referenceValues: {'pn-known': 'NB1602.01.05.00'}});
const syncBefore = synced.events().length;
synced.doc.dispatchEvent({type: 'pratt:reference-selected', detail: {id: 'pn-known'}});
check('Local selection sync does not emit a click or draft event', synced.events().length === syncBefore);
synced.click('mailto:2000@pratt-oil.com');
check('Next contact uses the verified public selected identifier', synced.events().at(-1)[2].reference_id === 'NB1602.01.05.00');
synced.doc.dispatchEvent({type: 'pratt:reference-selected', detail: {id: 'pn-' + PRIVATE}});
synced.click('mailto:2000@pratt-oil.com');
check('Unverified local selection payload cannot enter analytics', synced.events().at(-1)[2].reference_id === 'NB1602.01.05.00' && !JSON.stringify(synced.commands()).includes(PRIVATE));
const clearBefore = synced.events().length;
synced.doc.dispatchEvent({type: 'pratt:reference-cleared'});
check('Clearing a selection does not emit a GA event', synced.events().length === clearBefore);
synced.click('mailto:2000@pratt-oil.com');
check('Contact after clearing carries no stale identifier', !('reference_id' in synced.events().at(-1)[2]));

const publicSymbols = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/public-reference-symbols.json'), 'utf8'));
for (const record of publicSymbols) {
  const symbols = env({url: 'https://www.pratt-oil.com' + guide, product: false, reference: true,
    ids: [record.id], referenceValues: {[record.id]: record.number}, codeCells: true});
  symbols.doc.dispatchEvent({type: 'pratt:reference-selected', detail: {id: record.id}});
  symbols.click('mailto:2000@pratt-oil.com');
  check('Analytics preserves the complete published catalog identifier: ' + record.id,
    symbols.events().at(-1)[2].reference_id === record.number);
}

for (const file of files) {cp.execFileSync(process.execPath, ['--check', path.join(root, file)]); check('Syntax: ' + file, true);}
const report = {status: 'passed', checked_utc: new Date().toISOString(), checks: checks.length, details: checks,
  hashes: Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(source[file]).digest('hex')])),
  scope: 'Actual JavaScript executed in Node VM with isolated document/form mocks. No GA request or customer inquiry sent.',
  limitations: ['GA4 receipt and remote Enhanced Measurement/key-event settings are not tested.', 'No real WhatsApp/email delivery or qualified inquiry can be inferred from client-side events.', 'Only a known source/medium UTM pair is forwarded. Arbitrary campaign names, IDs, terms and content are omitted. Organic referrer origin is retained.']};

console.log(JSON.stringify({status: report.status, checks: checks.length}));
