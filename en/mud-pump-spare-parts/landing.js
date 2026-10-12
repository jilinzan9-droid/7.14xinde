(() => {
  const menu = document.querySelector('.menu-toggle');
  const navigation = document.querySelector('#main-navigation');
  menu.addEventListener('click', () => {
    const open = menu.getAttribute('aria-expanded') !== 'true';
    menu.setAttribute('aria-expanded', String(open));
    navigation.classList.toggle('is-open', open);
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) {
      menu.setAttribute('aria-expanded', 'false');
      navigation.classList.remove('is-open');
    }
  });

  document.querySelectorAll('[data-gallery]').forEach(root => {
    const track = root.querySelector('.gallery-track');
    const slides = [...root.querySelectorAll('.gallery-slide')];
    const choices = [...root.querySelectorAll('[data-slide]')];
    const caption = root.querySelector('.gallery-caption');
    const pause = root.querySelector('.gallery-pause');
    const kind = root.dataset.gallery === 'products' ? 'product' : 'factory';
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let index = 0;
    let direction = 1;
    let paused = reducedMotion.matches;
    let timer;

    function go(next) {
      index = (next + slides.length) % slides.length;
      if (index === 0) direction = 1;
      if (index === slides.length - 1) direction = -1;
      track.style.transform = `translateX(-${index * 100}%)`;
      slides.forEach((slide, i) => slide.setAttribute('aria-hidden', String(i !== index)));
      choices.forEach(button => {
        const active = Number(button.dataset.slide) === index;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
      });
      if (caption) caption.textContent = slides[index].querySelector('img').alt;
    }
    function stop() { clearTimeout(timer); }
    function start() {
      stop();
      if (paused || document.hidden || root.matches(':hover') || root.contains(document.activeElement)) return;
      timer = setTimeout(() => { go(index + direction); start(); }, 4500);
    }
    function updatePause() {
      pause.setAttribute('aria-label', `${paused ? 'Play' : 'Pause'} ${kind} slideshow`);
      pause.firstElementChild.textContent = paused ? '▶' : 'Ⅱ';
    }
    root.querySelector('.previous').addEventListener('click', () => { go(index - 1); start(); });
    root.querySelector('.next').addEventListener('click', () => { go(index + 1); start(); });
    choices.forEach(button => button.addEventListener('click', () => { go(Number(button.dataset.slide)); start(); }));
    pause.addEventListener('click', () => { paused = !paused; updatePause(); start(); });
    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', start);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', () => setTimeout(start, 0));
    root.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
        event.preventDefault(); go(index + (event.key === 'ArrowRight' ? 1 : -1)); start();
      }
    });
    document.addEventListener('visibilitychange', start);
    reducedMotion.addEventListener('change', () => { paused = reducedMotion.matches; updatePause(); start(); });
    go(0); updatePause(); start();
  });
})();
