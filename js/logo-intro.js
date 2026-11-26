(() => {
  'use strict';
  const root = document.documentElement;
  if (root.dataset.heroIntro !== 'preparing') return;

  const view = document.querySelector('[data-view]:not([hidden])');
  const countdown = view?.dataset.view === 'countdown';
  const title = view?.querySelector(countdown ? '.countdown-logo' : '#home-title');
  if (!title?.offsetParent || scrollY > 8) {
    delete root.dataset.heroIntro;
    return;
  }

  const minimumVisibleMs = 1000;
  const entranceFallbackMs = 4500;
  const outline = countdown ? null : view.querySelector('.hero .eyebrow ellipse');
  const lastElement = view.querySelector(countdown ? '.countdown-actions' : '#obras');
  const controller = new AbortController();
  const { signal } = controller;
  let minimum;
  let entranceFallback;

  function centerTitle() {
    const parentTop = title.offsetParent.getBoundingClientRect().top;
    const center = parentTop + title.offsetTop + title.offsetHeight / 2;
    title.style.setProperty('--intro-shift', `${innerHeight / 2 - center}px`);
  }

  function clearIntro() {
    controller.abort();
    clearTimeout(minimum);
    clearTimeout(entranceFallback);
    delete root.dataset.heroIntro;
    title.style.removeProperty('--intro-shift');
    title.style.removeProperty('--intro-start-scale');
  }

  function enter() {
    if (root.dataset.heroIntro !== 'loading') return;
    // Continue from the scale on screen, even when the logo is between pulses.
    title.style.setProperty('--intro-start-scale', getComputedStyle(title).scale);
    root.dataset.glassEntrance = performance.now();
    if (outline) {
      // The label can keep drawing after the intro unlocks scrolling.
      const clearLabel = () => { delete root.dataset.heroLabelEntering; };
      outline.addEventListener('animationend', clearLabel, { once: true });
      outline.addEventListener('animationcancel', clearLabel, { once: true });
      root.dataset.heroLabelEntering = '';
    }
    root.dataset.heroIntro = 'entering';
    entranceFallback = setTimeout(clearIntro, entranceFallbackMs);
  }

  lastElement.addEventListener('animationend', event => {
    if (event.animationName === 'hero-catalog-enter') clearIntro();
  }, { signal });
  window.addEventListener('resize', () => {
    if (root.dataset.heroIntro === 'loading' && title.offsetParent) centerTitle();
  }, { passive: true, signal });
  window.addEventListener('scroll', () => {
    if (scrollY > 8) clearIntro();
  }, { passive: true, signal });
  window.addEventListener('popstate', clearIntro, { once: true, signal });
  document.querySelector('.skip-link')?.addEventListener('click', clearIntro, { once: true, signal });

  async function showLogo() {
    const images = title.matches('img') ? [title] : [...title.querySelectorAll('img')].filter(image => image.offsetWidth > 0);
    await Promise.allSettled(images.map(image => image.decode()));
    if (root.dataset.heroIntro !== 'preparing' || !images.some(image => image.naturalWidth) || !title.offsetParent) {
      clearIntro();
      return;
    }

    centerTitle();
    root.dataset.heroIntro = 'loading';
    const fade = title.getAnimations().find(animation => animation.animationName === 'hero-logo-appear');
    await fade?.finished.catch(() => {});
    if (root.dataset.heroIntro !== 'loading') return;

    // Only the logo needs to be ready before the entrance starts.
    minimum = setTimeout(enter, minimumVisibleMs);
  }

  showLogo();
})();
