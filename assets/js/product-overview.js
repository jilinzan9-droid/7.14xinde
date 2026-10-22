/* Switch only the preview image; original description pictures remain in the page. */
(() => {
  document.querySelectorAll('[data-product-overview]').forEach(root => {
    const image = root.querySelector('[data-product-primary-image]');
    if (!image) return;
    const buttons = Array.from(root.querySelectorAll('[data-product-image]'));
    buttons.forEach(button => button.addEventListener('click', () => {
      const source = new URL(button.dataset.productImage, location.href);
      if (source.origin !== location.origin) return;
      const previous = { src: image.getAttribute('src'), alt: image.alt, title: image.title };
      image.onload = () => {
        buttons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        image.onload = null;
        image.onerror = null;
      };
      image.onerror = () => {
        image.onload = null;
        image.onerror = null;
        image.src = previous.src;
        image.alt = previous.alt;
        image.title = previous.title;
      };
      image.removeAttribute('srcset');
      image.src = source.href;
      image.alt = button.dataset.productAlt || '';
      image.title = image.alt;
    }));
  });
})();
