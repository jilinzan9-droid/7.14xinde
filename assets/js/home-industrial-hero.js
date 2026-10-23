(() => {
  const root = document.querySelector('.pratt-hero');
  if (!root) return;
  const images = [...root.querySelectorAll('.pratt-hero-scene img')];
  const buttons = [...root.querySelectorAll('[data-hero-scene]')];
  const copies = [...root.querySelectorAll('[data-hero-copy]')];
  const actions = root.querySelector('.pratt-hero-actions');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const slideDuration = 1000;
  const holdDuration = 6000;
  let current = 0, timer, moving = false, queued = null;
  let animations = [];

  // Prepare the next scene before it moves into view.
  images.forEach(image => { image.loading = 'eager'; });
  function stop() { clearTimeout(timer); }
  function start() {
    stop();
    if (!reduced.matches && !document.hidden && !moving) {
      timer = setTimeout(() => select((current + 1) % images.length, 1), holdDuration);
    }
  }
  function markSelected(index) {
    buttons.forEach((button, i) => {
      button.classList.toggle('is-selected', i === index);
      button.setAttribute('aria-pressed', String(i === index));
    });
  }
  function animate(element, frames, options) {
    const animation = element.animate(frames, options);
    animations.push(animation);
    return animation.finished.catch(() => {});
  }
  async function select(index, direction = index > current ? 1 : -1) {
    if (moving) { queued = index; return; }
    if (index === current) { start(); return; }
    stop();
    moving = true;
    const previous = current;
    const incoming = images[index];
    const outgoing = images[previous];
    if (!incoming.complete) {
      try { await incoming.decode(); } catch (_) { /* Keep the current scene if the image fails. */ }
    }
    if (!incoming.naturalWidth) { moving = false; start(); return; }
    current = index;
    markSelected(index);

    if (reduced.matches) {
      images.forEach((image, i) => image.classList.toggle('is-active', i === index));
      copies.forEach((copy, i) => { copy.hidden = i !== index; });
    } else {
      incoming.classList.add('is-active', 'is-moving');
      outgoing.classList.add('is-moving');
      const motion = { duration: slideDuration, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'both' };
      const imageMotion = [
        animate(outgoing, [{ transform: 'translateX(0)' }, { transform: `translateX(${-direction * 100}%)` }], motion),
        animate(incoming, [{ transform: `translateX(${direction * 100}%)` }, { transform: 'translateX(0)' }], motion)
      ];
      // Text enters after the new image starts arriving, as in the reference.
      const textMotion = (async () => {
        await animate(copies[previous], [{ opacity: 1 }, { opacity: 0 }], { duration: 160, fill: 'both' });
        copies[previous].hidden = true;
        copies[index].hidden = false;
        const reveal = [{ opacity: 0, transform: 'translateY(16px)' }, { opacity: 1, transform: 'translateY(0)' }];
        const options = { duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', fill: 'both' };
        await Promise.all([
          animate(copies[index].querySelector('.pratt-hero-title'), reveal, { ...options, delay: 140 }),
          animate(copies[index].querySelector('.pratt-hero-intro'), reveal, { ...options, delay: 250 })
        ]);
      })();
      const buttonMotion = animate(actions,
        [{ opacity: 1 }, { opacity: 0, offset: .18 }, { opacity: 0, offset: .4 }, { opacity: 1 }],
        { duration: 1000, easing: 'ease', fill: 'both' });
      await Promise.all([...imageMotion, textMotion, buttonMotion]);
      outgoing.classList.remove('is-active');
      images.forEach(image => image.classList.remove('is-moving'));
      animations.forEach(animation => animation.cancel());
      animations = [];
    }
    moving = false;
    if (queued !== null) {
      const next = queued;
      queued = null;
      select(next);
    } else start();
  }
  buttons.forEach((button, index) => button.addEventListener('click', () => select(index)));
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  reduced.addEventListener('change', () => {
    if (reduced.matches) animations.forEach(animation => animation.finish());
    start();
  });
  start();
})();

(() => {
  const header = document.querySelector('[data-hero-header="overlay"] .site-header');
  const hero = document.querySelector('.pratt-hero');
  if (!header || !hero) return;
  let height = 0;
  let frame = 0;
  function updateHeader() {
    frame = 0;
    header.classList.toggle('is-past-hero', hero.getBoundingClientRect().bottom <= height);
  }
  function measureHeader() {
    const nextHeight = header.offsetHeight;
    if (nextHeight !== height) {
      height = nextHeight;
      hero.style.setProperty('--hero-header-height', `${height}px`);
    }
    updateHeader();
  }
  measureHeader();
  new ResizeObserver(measureHeader).observe(header);
  window.addEventListener('scroll', () => {
    if (!frame) frame = requestAnimationFrame(updateHeader);
  }, { passive: true });
  window.addEventListener('resize', measureHeader, { passive: true });
})();
