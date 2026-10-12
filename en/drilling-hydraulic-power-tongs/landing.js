'use strict';
const menu = document.querySelector('.menu');
const navigation = document.querySelector('#navigation');
function closeMenu() { menu.setAttribute('aria-expanded', 'false'); navigation.classList.remove('is-open'); }
menu.addEventListener('click', () => { const open = menu.getAttribute('aria-expanded') !== 'true'; menu.setAttribute('aria-expanded', String(open)); navigation.classList.toggle('is-open', open); });
navigation.addEventListener('click', event => { if (event.target.closest('a')) closeMenu(); });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && menu.getAttribute('aria-expanded') === 'true') { closeMenu(); menu.focus(); } });
const viewer = document.querySelector('dialog');
document.querySelectorAll('.zoom').forEach(button => button.addEventListener('click', () => { document.querySelector('#viewer-image').src = button.dataset.image; document.querySelector('#viewer-image').alt = button.dataset.title; document.querySelector('#viewer-title').textContent = button.dataset.title; viewer.showModal(); }));
document.querySelector('.close-viewer').addEventListener('click', () => viewer.close());
viewer.addEventListener('click', event => { if (event.target === viewer) { const bounds = viewer.getBoundingClientRect(); if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) viewer.close(); } });
