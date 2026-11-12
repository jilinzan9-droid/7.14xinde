const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../assets/js/home-industrial-hero.js'), 'utf8');
const homepage = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const heroMarkup = homepage.match(/<div class="pratt-hero-scene"[^>]*>([\s\S]*?)<\/div>/)[1];
const heroImages = [...heroMarkup.matchAll(/<img\b[^>]*>/g)].map(match => match[0]);
assert.equal(heroImages.length, 4, 'The production homepage retains all four hero images');
assert.match(heroImages[0], /class="is-active"/);
assert.match(heroImages[0], /fetchpriority="high"/);
assert.doesNotMatch(heroImages[0], /display\s*:\s*none|loading="lazy"/, 'The first image remains visible and eager without JavaScript');
for (const image of heroImages.slice(1)) {
  assert.match(image, /style="display:none"/, 'Inactive scenes must be hidden in HTML before the deferred script runs');
  assert.match(image, /loading="lazy"/);
}
assert.deepEqual(heroImages.map(image => image.match(/src="([^"]+)"/)[1]),
  ['oilfield-equipment', 'land-drilling', 'desert-drilling', 'offshore-platform'].map(name =>
    `/assets/images/hero/home-sr-20261023/${name}-sr2x.webp`), 'All original image sources remain available');

function setup({reducedMotion = false} = {}) {
  let now = 0, nextTimer = 0;
  const timers = new Map(), events = {}, reducedEvents = {}, requested = [], animations = [];
  const setTimeout = (callback, delay) => { const id = ++nextTimer; timers.set(id, {at: now + delay, callback}); return id; };
  const clearTimeout = id => timers.delete(id);
  function element(active = false) {
    const classes = new Set(active ? ['is-active'] : []);
    return {
      hidden: false, attrs: {}, handlers: {}, style: {removeProperty(name) { delete this[name]; }},
      classList: {
        add: (...names) => names.forEach(name => classes.add(name)),
        remove: (...names) => names.forEach(name => classes.delete(name)),
        contains: name => classes.has(name),
        toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }
      },
      setAttribute(name, value) { this.attrs[name] = value; },
      addEventListener(name, callback) { this.handlers[name] = callback; },
      animate(frames, options) {
        let finish;
        const finished = new Promise(resolve => { finish = resolve; });
        const timer = setTimeout(finish, options.duration + (options.delay || 0));
        const animation = {finished, finish, cancel() {clearTimeout(timer); finish();}};
        animations.push(animation);
        return animation;
      }
    };
  }
  const images = Array.from({length: 4}, (_, i) => {
    const image = {...element(i === 0), loading: i ? 'lazy' : 'auto', fetchPriority: i ? 'auto' : 'high', naturalWidth: 0};
    let resolve, reject;
    const decoded = new Promise((ok, fail) => {resolve = ok; reject = fail;});
    image.decode = () => {requested.push(i); return decoded;};
    image.loaded = () => {image.naturalWidth = 4344; resolve();};
    image.failed = () => reject(new Error('Image load failed'));
    return image;
  });
  const buttons = images.map(() => element());
  const copies = images.map((_, i) => ({...element(), hidden: i !== 0, querySelector: () => element()}));
  const root = {
    querySelectorAll: selector => selector === '.pratt-hero-scene img' ? images : selector === '[data-hero-scene]' ? buttons : copies,
    querySelector: () => element()
  };
  const document = {hidden: false, querySelector: selector => selector === '.pratt-hero' ? root : null,
    addEventListener: (name, callback) => {events[name] = callback;}};
  const reduced = {matches: reducedMotion, addEventListener: (name, callback) => {reducedEvents[name] = callback;}};
  vm.runInNewContext(source, {document, window: {matchMedia: () => reduced}, setTimeout, clearTimeout});
  const flush = async () => {for (let i = 0; i < 12; i++) await Promise.resolve();};
  async function tick(ms) {
    const until = now + ms;
    for (;;) {
      const due = [...timers.entries()].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!due) break;
      now = due[1].at; timers.delete(due[0]); due[1].callback(); await flush();
    }
    now = until; await flush();
  }
  return {images, buttons, copies, requested, animations, flush, tick,
    click: index => buttons[index].handlers.click(),
    hide(hidden) {document.hidden = hidden; events.visibilitychange();},
    reduce(value) {reduced.matches = value; reducedEvents.change();},
    active: () => images.flatMap((image, index) => image.classList.contains('is-active') ? [index] : [])};
}

(async () => {
  const initial = setup();
  assert.deepEqual(initial.requested, [0], 'Only the first image is prepared initially');
  assert.equal(initial.images[0].fetchPriority, 'high');
  assert.ok(initial.images.slice(1).every(image => image.loading === 'lazy' && image.style.display === 'none'));
  await initial.tick(2000);
  assert.deepEqual(initial.requested, [0], 'No next image competes with an unfinished first image');
  initial.images[0].loaded(); await initial.flush(); await initial.tick(999);
  assert.deepEqual(initial.requested, [0]);
  await initial.tick(1);
  assert.deepEqual(initial.requested, [0, 1], 'Only the immediate successor is preloaded');
  assert.equal(initial.images[1].fetchPriority, 'low');
  assert.equal(initial.images[2].loading, 'lazy');
  assert.equal(initial.images[3].loading, 'lazy');
  initial.images[1].loaded(); await initial.flush(); await initial.tick(5000); await initial.tick(1100);
  assert.deepEqual(initial.active(), [1], 'Automatic transition still reaches the next decoded scene');
  assert.equal(initial.copies[0].hidden, true); assert.equal(initial.copies[1].hidden, false);

  const manual = setup();
  manual.images[0].loaded(); await manual.flush(); manual.click(3); await manual.flush();
  assert.deepEqual(manual.active(), [0], 'A click on an unloaded scene keeps the current image visible');
  assert.equal(manual.copies[0].hidden, false);
  manual.images[3].loaded(); await manual.flush(); await manual.tick(1100);
  assert.deepEqual(manual.active(), [3]);
  assert.equal(manual.images[3].style.display, undefined);
  assert.equal(manual.buttons[3].attrs['aria-pressed'], 'true');

  const queued = setup();
  queued.images[0].loaded(); await queued.flush();
  queued.click(1); queued.click(2); queued.click(3);
  queued.images[1].failed(); await queued.flush();
  assert.deepEqual(queued.active(), [0], 'A failed image never replaces the current scene');
  assert.ok(queued.requested.includes(3), 'Failure drains the latest queued click');
  assert.ok(!queued.requested.includes(2), 'Superseded queued selections do not start downloads');
  queued.images[3].loaded(); await queued.flush(); await queued.tick(1100);
  assert.deepEqual(queued.active(), [3]);

  const timeout = setup();
  timeout.images[0].loaded(); await timeout.flush(); timeout.click(2);
  await timeout.tick(15000);
  assert.deepEqual(timeout.active(), [0], 'A stalled download leaves the current scene visible');
  timeout.click(3); timeout.images[3].loaded(); await timeout.flush(); await timeout.tick(1100);
  assert.deepEqual(timeout.active(), [3], 'Controls recover after a download timeout');

  const reduced = setup({reducedMotion: true});
  await reduced.tick(20000);
  assert.deepEqual(reduced.requested, [], 'Reduced motion does not preload or autoplay hidden scenes');
  reduced.click(2); reduced.images[2].loaded(); await reduced.flush();
  assert.deepEqual(reduced.active(), [2]); assert.equal(reduced.animations.length, 0);
  assert.equal(reduced.copies[2].hidden, false);

  const visibility = setup();
  visibility.images[0].loaded(); await visibility.flush(); visibility.hide(true); await visibility.tick(10000);
  assert.deepEqual(visibility.requested, [0], 'A hidden document cancels scheduled preloading and autoplay');
  visibility.hide(false); await visibility.flush(); await visibility.tick(1000);
  assert.ok(visibility.requested.includes(1), 'Preloading resumes on return');
  console.log('Homepage hero loading: 7 behavioral scenarios passed.');
})().catch(error => {console.error(error); process.exitCode = 1;});
