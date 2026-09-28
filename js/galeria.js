(() => {
  const section = document.querySelector('#galeria');
  if (!section) return;

  // Agregar las fotos de la muestra aquí, en el orden deseado.
  // Ejemplo: { src: 'assets/images/galeria/entrada.webp', alt: 'Visitantes en la entrada de la muestra' }
  // Cada src apunta al archivo original: sirve tanto para la vista ampliada como para Descargar.
  const photos = [];

  const grid = section.querySelector('[data-gallery-grid]');
  const empty = section.querySelector('[data-gallery-empty]');
  const lightbox = section.querySelector('[data-gallery-lightbox]');
  const fullImage = section.querySelector('[data-gallery-full]');
  const download = section.querySelector('[data-gallery-download]');
  const close = section.querySelector('[data-gallery-close]');
  const previous = section.querySelector('[data-gallery-previous]');
  const next = section.querySelector('[data-gallery-next]');
  let currentIndex = 0;
  let previousFocus = null;

  const arrow = (direction) => {
    const path = direction === 'left' ? 'M19 12H5m7 7-7-7 7-7' : 'M5 12h14m-7-7 7 7-7 7';
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
  };

  previous.innerHTML = arrow('left');
  next.innerHTML = arrow('right');

  const show = (index) => {
    currentIndex = (index + photos.length) % photos.length;
    const photo = photos[currentIndex];
    fullImage.src = photo.src;
    fullImage.alt = photo.alt;
    download.href = photo.src;
    download.download = photo.src.split('/').pop().split('?')[0] || 'artimanas-foto';
    download.setAttribute('aria-label', `Descargar foto ${currentIndex + 1} de ${photos.length}`);
  };

  const open = (index) => {
    previousFocus = document.activeElement;
    show(index);
    lightbox.hidden = false;
    document.body.classList.add('has-photo-gallery-lightbox');
    close.focus();
  };

  const dismiss = () => {
    lightbox.hidden = true;
    document.body.classList.remove('has-photo-gallery-lightbox');
    fullImage.removeAttribute('src');
    previousFocus?.focus();
  };

  photos.forEach((photo, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'photo-gallery-item';
    button.setAttribute('aria-label', `Ampliar foto ${index + 1}: ${photo.alt}`);
    const image = document.createElement('img');
    image.src = photo.src;
    image.alt = photo.alt;
    image.loading = 'lazy';
    image.decoding = 'async';
    button.append(image);
    button.addEventListener('click', () => open(index));
    grid.append(button);
  });
  empty.hidden = photos.length > 0;

  close.addEventListener('click', dismiss);
  previous.addEventListener('click', () => show(currentIndex - 1));
  next.addEventListener('click', () => show(currentIndex + 1));
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) dismiss();
  });

  document.addEventListener('keydown', (event) => {
    if (lightbox.hidden) return;
    if (event.key === 'Escape') dismiss();
    if (event.key === 'ArrowLeft') show(currentIndex - 1);
    if (event.key === 'ArrowRight') show(currentIndex + 1);
    if (event.key === 'Tab') {
      const controls = [close, previous, next, download];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();
