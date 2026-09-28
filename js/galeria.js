(() => {
  const section = document.querySelector('#galeria');
  if (!section) return;

  // Agregar las fotos reales después de la muestra. Al cargar una, se oculta la vista previa.
  // Ejemplo: { src: 'assets/images/galeria/entrada.webp', alt: 'Visitantes en la entrada de la muestra' }
  const eventPhotos = [];

  // Vista previa temporal con imágenes de obras que ya están en el repositorio.
  // Los recortes y el blanco y negro sirven únicamente para evaluar la composición.
  const previewSources = [
    'assets/images/detalle-obra/microbioespecularis-01.webp',
    'assets/images/detalle-obra/microbioespecularis-02.webp',
    'assets/images/detalle-obra/microbioespecularis-03.webp'
  ];
  const ratios = ['3 / 4', '4 / 3', '2 / 3', '1 / 1', '3 / 5', '5 / 4', '4 / 5',
    '3 / 4', '2 / 3', '4 / 3', '1 / 1', '3 / 5', '5 / 4', '4 / 5', '3 / 4', '2 / 3'];
  const previewPhotos = ratios.map((ratio, index) => ({
    src: previewSources[(index * 2 + Math.floor(index / 3)) % previewSources.length],
    alt: `Imagen de obra usada para la vista previa ${index + 1}`,
    ratio
  }));
  const photos = eventPhotos.length ? eventPhotos : previewPhotos;
  section.classList.toggle('is-preview', eventPhotos.length === 0);
  section.querySelector('[data-gallery-preview]').hidden = eventPhotos.length > 0;

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
    if (photo.ratio) button.style.setProperty('--photo-ratio', photo.ratio);
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
