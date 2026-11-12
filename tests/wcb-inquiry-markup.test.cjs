const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const checks = [];
function check(label, condition) { assert.ok(condition, label); checks.push(label); }
const slugs = ['cylinder', 'edge-seal', 'friction-disc', 'return-spring', 'wear-plate'];

// Inspect the real HTML: generic form-handler tests alone cannot detect a page
// that renders unbound inputs without a form or a submit button.
for (const lang of ['en', 'ar']) {
  for (const slug of slugs) {
    const file = `${lang}/products/wcb-eaton-auxiliary-brake-${slug}/index.html`;
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    const section = html.match(/<section\b[^>]*class="wcb-cn-form"[^>]*>[\s\S]*?<\/section>/)?.[0];
    check(`${file}: inquiry section exists`, section);
    check(`${file}: exactly one shared inquiry form`, (section.match(/<form\b[^>]*data-product-detail-inquiry/g) || []).length === 1);
    check(`${file}: one reachable inquiry anchor`, (html.match(/id="product_inquiry_form"/g) || []).length === 1);
    check(`${file}: named fields with visible labels`, ['name', 'email', 'phone', 'message'].every(name =>
      new RegExp(`<label[^>]*>\\s*<span>[^<]+<\\/span>\\s*<(?:input|textarea)\\b[^>]*name="${name}"`).test(section)));
    check(`${file}: required name, email and message`, ['name', 'email', 'message'].every(name =>
      new RegExp(`<(?:input|textarea)\\b(?=[^>]*name="${name}")(?=[^>]*\\brequired\\b)[^>]*>`).test(section)));
    check(`${file}: browser email validation`, /<input\b(?=[^>]*name="email")(?=[^>]*type="email")[^>]*>/.test(section));
    check(`${file}: submit button exists`, /<button\b(?=[^>]*type="submit")(?=[^>]*data-wcb-inquiry-submit)[^>]*>[^<]+<\/button>/.test(section));
    check(`${file}: controls disabled until bound`, /<fieldset\b(?=[^>]*data-wcb-inquiry-fields)(?=[^>]*\bdisabled\b)[^>]*>/.test(section));
    check(`${file}: accessible draft status`, /<span\b(?=[^>]*data-product-detail-inquiry-status)(?=[^>]*aria-live="polite")[^>]*>/.test(section));
    check(`${file}: no-script direct contact fallback`, /<noscript>[\s\S]*href="mailto:2000@pratt-oil.com"[\s\S]*href="https:\/\/api.whatsapp.com\/send\?phone=8615908080040"[\s\S]*<\/noscript>/.test(section));
    check(`${file}: readiness selector matches body`, /<body\b[^>]*class="[^"]*\bwcb-reference-cn-page\b/.test(html));
    check(`${file}: responsive fieldset style included once`, (html.match(/href="\/assets\/css\/wcb-inquiry.css\?/g) || []).length === 1);
    check(`${file}: ready helper included once after shared script`, (html.match(/src="\/assets\/js\/wcb-inquiry-ready.js\?/g) || []).length === 1 && html.indexOf('/assets/js/wcb-inquiry-ready.js?') > html.indexOf('/script.js?'));
  }
}

const readySource = fs.readFileSync(path.join(root, 'assets/js/wcb-inquiry-ready.js'), 'utf8');
for (const bound of [false, true]) {
  const fields = {disabled: true}, button = {disabled: true}, listeners = [];
  const form = {
    querySelector: selector => selector === '[data-wcb-inquiry-fields]' ? fields : button,
    addEventListener: (type, listener) => { if (type === 'submit') listeners.push(listener); }
  };
  vm.runInNewContext(readySource, {
    window: bound ? {openWhatsAppInquiry() {}} : {},
    document: {readyState: 'complete', querySelectorAll: () => [form]}
  });
  check(`Ready helper ${bound ? 'with' : 'without'} shared handler: correct enabled state`, fields.disabled === !bound && button.disabled === !bound);
  let prevented = false;
  listeners.forEach(listener => listener({preventDefault() { prevented = true; }}));
  check(`Ready helper ${bound ? 'with' : 'without'} shared handler: never GET-submits private fields`, prevented);
}

const drafts = [];
for (const [slug, title] of [['porshen-burovogo-nasosa', 'F-Series Mud Pump Piston'], ['porshen-burovogo-nasosa-2', 'HHF-Series Mud Pump Piston']]) {
  const file = `en/products/${slug}/index.html`;
  const html = fs.readFileSync(path.join(root, file), 'utf8');
  const productUrl = `https://www.pratt-oil.com/en/products/${slug}/`;
  const hero = html.match(/<section\b[^>]*data-product-overview[^>]*>[\s\S]*?<\/section>/)?.[0];
  check(`${slug}: product overview exists`, hero);
  const urls = [...hero.matchAll(/href="(https:\/\/api.whatsapp.com\/send\?[^\"]+)"/g)]
    .map(match => new URL(match[1].replaceAll('&amp;', '&')))
    .filter(url => url.searchParams.has('text'));
  check(`${slug}: both original inquiry entry points remain`, urls.length === 2);
  for (const url of urls) {
    const draft = url.searchParams.get('text');
    check(`${slug}: precise published title and canonical page`, draft.includes(title) && draft.includes(productUrl));
    check(`${slug}: original business recipient`, url.searchParams.get('phone') === '8615908080040');
    check(`${slug}: model and quantity context`, draft.includes('Pump model / part number:') && draft.includes('Quantity:'));
  }
  drafts.push(urls[0].searchParams.get('text'));
}
check('F-Series and HHF-Series no longer produce identical drafts', drafts[0] !== drafts[1]);
console.log(JSON.stringify({status: 'passed', checks: checks.length, scope: 'Actual WCB form markup, readiness safety and piston draft links; no network or inquiry sent.'}));
