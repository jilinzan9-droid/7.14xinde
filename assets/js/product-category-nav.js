(() => {
  document.querySelectorAll('.lp-category-nav').forEach(menu => {
    const summary = menu.querySelector('summary');
    let hoverOpened = false;
    const close = () => { menu.open = false; hoverOpened = false; };
    menu.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && matchMedia('(min-width:851px)').matches && !menu.open) {
        menu.open = true;
        hoverOpened = true;
      }
    });
    summary.addEventListener('click', event => {
      if (hoverOpened) { event.preventDefault(); hoverOpened = false; }
    });
    menu.addEventListener('pointerleave', () => {
      if (!menu.contains(document.activeElement)) close();
    });
    menu.addEventListener('focusout', event => {
      if (!menu.contains(event.relatedTarget)) close();
    });
    menu.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); summary.focus(); }
    });
    menu.addEventListener('click', event => { if (event.target.closest('a')) close(); });
    document.addEventListener('click', event => { if (!menu.contains(event.target)) close(); });
  });
})();
