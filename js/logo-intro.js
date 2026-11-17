
/* Emisión inicial del logo; la cinta conserva su propio bucle lento por CSS. */
(() => {
  'use strict';
  const hero = document.querySelector('.hero');
  const title = hero?.querySelector('h1');
  if (!hero || !title || !title.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let visible = false;
  let emitted = false;
  let glow = null;
  const canRun = () => visible && !document.hidden &&
    !document.body.classList.contains('modal-open');

  function sync() {
    if (!emitted && canRun()) {
      emitted = true;
      glow = title.animate([
        {offset: 0, filter: 'brightness(1) drop-shadow(0 0 0px #efcaff00)'},
        {offset: .42, filter: 'brightness(1.48) drop-shadow(0 0 24px #f5dcffdd) drop-shadow(0 0 54px #b576edaa)'},
        {offset: 1, filter: 'brightness(1) drop-shadow(0 0 0px #efcaff00)'}
      ], {duration: 3200, delay: 400, easing: 'ease-in-out'});
    }
    if (glow && glow.playState !== 'finished') {
      if (canRun()) glow.play(); else glow.pause();
    }
  }

  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    sync();
  }, {threshold: 0}).observe(hero);
  new MutationObserver(sync).observe(document.body,
    {attributes: true, attributeFilter: ['class']});
  document.addEventListener('visibilitychange', sync);
})();
