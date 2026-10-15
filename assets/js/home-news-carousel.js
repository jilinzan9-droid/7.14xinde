(() => {
  'use strict';

  document.querySelectorAll('[data-news-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.news-picture-track');
    const dots = carousel.querySelector('.news-picture-dots');
    if (!track || !dots || track.children.length < 2) return;

    const cards = [...track.children];
    const arabic = document.documentElement.lang === 'ar';
    const rtl = getComputedStyle(track).direction === 'rtl';
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let visible = 0;
    let current = 0;
    let frame = 0;
    let timer = 0;
    let pointerOver = false;
    let pointerDown = false;
    let inView = !('IntersectionObserver' in window);
    const controls = document.createElement('div');
    controls.className = 'news-picture-controls';
    dots.before(controls);
    controls.append(dots);

    function syncPlayback() {
      clearTimeout(timer);
      timer = 0;
      const focused = carousel.contains(document.activeElement);
      if (reduceMotion.matches || pointerOver || pointerDown || focused || document.hidden || !inView || lastStart() === 0) return;
      timer = setTimeout(() => {
        const wrap = current >= lastStart();
        show(wrap ? 0 : current + 1, wrap);
        syncPlayback();
      }, 4200);
    }

    const lastStart = () => Math.max(0, cards.length - visible);
    const edge = () => {
      const rect = track.getBoundingClientRect();
      const style = getComputedStyle(track);
      return rtl ? rect.right - parseFloat(style.paddingRight) : rect.left + parseFloat(style.paddingLeft);
    };
    const distance = (card) => {
      const rect = card.getBoundingClientRect();
      return (rtl ? rect.right : rect.left) - edge();
    };
    const update = () => {
      frame = 0;
      current = cards.slice(0, lastStart() + 1).reduce((best, card, index) =>
        Math.abs(distance(card)) < Math.abs(distance(cards[best])) ? index : best, 0);
      [...dots.children].forEach((dot, index) => {
        if (index === current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
      syncPlayback();
    };
    const show = (index, instant = false) => {
      const next = Math.max(0, Math.min(lastStart(), index));
      track.scrollBy({left: distance(cards[next]), behavior: instant || reduceMotion.matches ? 'instant' : 'smooth'});
    };
    const refresh = () => {
      const count = parseInt(getComputedStyle(track).getPropertyValue('--news-visible'), 10) || 1;
      if (count !== visible) {
        visible = count;
        dots.replaceChildren();
        for (let index = 0; index <= lastStart(); index += 1) {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'news-picture-dot';
          button.setAttribute('aria-controls', track.id);
          button.setAttribute('aria-label', arabic
            ? `عرض الأدلة ${index + 1}–${Math.min(index + visible, cards.length)} من ${cards.length}`
            : `Show guides ${index + 1}–${Math.min(index + visible, cards.length)} of ${cards.length}`);
          button.addEventListener('click', () => {
            show(index);
            syncPlayback();
          });
          dots.append(button);
        }
        dots.hidden = lastStart() === 0;
        show(current, true);
      }
      update();
    };

    carousel.setAttribute('data-news-ready', '');
    carousel.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') {
        pointerOver = true;
        syncPlayback();
      }
    });
    carousel.addEventListener('pointerleave', (event) => {
      if (event.pointerType === 'mouse') {
        pointerOver = false;
        syncPlayback();
      }
    });
    carousel.addEventListener('focusin', syncPlayback);
    carousel.addEventListener('focusout', () => queueMicrotask(syncPlayback));
    track.addEventListener('pointerdown', () => {
      pointerDown = true;
      syncPlayback();
    });
    const releasePointer = () => {
      if (!pointerDown) return;
      pointerDown = false;
      syncPlayback();
    };
    window.addEventListener('pointerup', releasePointer);
    window.addEventListener('pointercancel', releasePointer);
    document.addEventListener('visibilitychange', syncPlayback);
    reduceMotion.addEventListener('change', syncPlayback);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        inView = entries[0].intersectionRatio >= 0.15;
        syncPlayback();
      }, {threshold: [0, 0.15]});
      observer.observe(carousel);
    }
    track.tabIndex = 0;
    track.addEventListener('scroll', () => {
      if (!frame) frame = requestAnimationFrame(update);
    }, {passive: true});
    track.addEventListener('keydown', (event) => {
      if (event.target !== track) return;
      let next;
      if (event.key === 'ArrowRight') next = current + (rtl ? -1 : 1);
      if (event.key === 'ArrowLeft') next = current + (rtl ? 1 : -1);
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = lastStart();
      if (next === undefined) return;
      event.preventDefault();
      show(next);
    });
    window.addEventListener('resize', refresh);
    refresh();
  });
})();
