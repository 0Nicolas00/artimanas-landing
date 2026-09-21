const worksSection = document.querySelector('.works-section');

if (worksSection) {
  const artists = [
    'Joselevich Puiggrós, Federico',
    'Adam, Florencia Araceli',
    'Andrés, Guadalupe',
    'Aroza, Matias',
    'Bareiro Quevedo, Elias Gabriel',
    'Besnati Saldise, Victoria',
    'Bigot, Juan Martín',
    'Di Bella, Martina',
    'Errecarte, Juan Ignacio',
    'Ferrer, Evelyn',
    'Galdeano, Sofia',
    'Galindez, Catalina',
    'Gamón, Martina',
    'Giambruni, Adelina',
    'Gimenez, Julia',
    'Grassi, Maria',
    'Griguoli, Nicolás',
    'Ignoffo, Lara Belén',
    'Iriarte, Jeremías Daniel',
    'Isasmendi, Rodrigo',
    'La Pioggia, Franco',
    'Lajoinie, María Delfina',
    'Magallanes Diaz, Lara Jazmín',
    'Mansilla Torres, Nicolas',
    'Migone, Maria Candela',
    'Orbaiceta, Catalina',
    'Panelli, Dolores',
    'Riol Fernández, Juan Cruz',
    'Rojas Rabassio, Juliana',
    'Rossetti, Matías',
    'Sago, Suyay',
    'Segundo, Tatiana',
    'Triolo, Valentina',
    'Ubaldi, Guadalupe'
  ];

  const gallery = [
    'assets/images/detalle-obra/microbioespecularis-01.webp',
    'assets/images/detalle-obra/microbioespecularis-02.webp',
    'assets/images/detalle-obra/microbioespecularis-03.webp'
  ];

  const authorsList = worksSection.querySelector('[data-works-authors]');
  const reel = worksSection.querySelector('[data-works-reel]');
  const progress = worksSection.querySelector('[data-works-progress]');
  const medium = worksSection.querySelector('[data-work-medium]');
  const title = worksSection.querySelector('[data-work-title]');
  const artist = worksSection.querySelector('[data-work-artist]');
  const mobileQuery = window.matchMedia('(max-width: 820px)');
  let activeIndex = 0;
  let frameRequested = false;

  artists.forEach((artistName, index) => {
    const listItem = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'works-author-button';
    button.type = 'button';
    button.textContent = artistName;
    button.dataset.workIndex = index;
    button.setAttribute('aria-label', `Ver obra de ${artistName}`);
    listItem.append(button);
    authorsList.append(listItem);

    const card = document.createElement('figure');
    const image = document.createElement('img');
    card.className = 'works-card';
    card.dataset.workIndex = index;
    image.src = gallery[index % gallery.length];
    image.alt = index === 0 ? 'Microbioespecularis, instalación interactiva' : '';
    image.loading = index < 3 ? 'eager' : 'lazy';
    image.decoding = 'async';
    card.append(image);
    reel.append(card);

    const mark = document.createElement('span');
    mark.className = 'works-progress-mark';
    progress.append(mark);
  });

  const buttons = [...authorsList.querySelectorAll('.works-author-button')];
  const cards = [...reel.querySelectorAll('.works-card')];
  const marks = [...progress.querySelectorAll('.works-progress-mark')];

  function positionReel() {
    if (mobileQuery.matches) return;

    const activeCard = cards[activeIndex];
    const cardCenter = activeCard.offsetTop + (activeCard.offsetHeight / 2);
    const viewportCenter = window.innerHeight / 2;
    reel.style.transform = `translate3d(0, ${viewportCenter - cardCenter}px, 0)`;
  }

  function positionAuthors() {
    if (mobileQuery.matches) return;

    const activeButton = buttons[activeIndex];
    const navHeight = authorsList.parentElement.clientHeight;
    const preferredTop = Math.min(navHeight * 0.45, 360);
    const target = Math.max(0, activeButton.offsetTop - preferredTop);
    authorsList.style.transform = `translate3d(0, ${-target}px, 0)`;
  }

  function updateDetails(index) {
    artist.textContent = artists[index];

    if (index === 0) {
      medium.textContent = 'Instalación interactiva';
      title.textContent = 'Microbioespecularis';
      return;
    }

    medium.textContent = 'Obra por alumno';
    title.textContent = 'Detalle próximamente';
  }

  function setActive(index, { movePage = false, followList = true } = {}) {
    const nextIndex = Math.max(0, Math.min(artists.length - 1, index));
    activeIndex = nextIndex;

    buttons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === nextIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });

    cards.forEach((card, cardIndex) => card.classList.toggle('is-active', cardIndex === nextIndex));
    marks.forEach((mark, markIndex) => mark.classList.toggle('is-active', markIndex === nextIndex));
    updateDetails(nextIndex);
    positionReel();
    if (followList) positionAuthors();

    if (mobileQuery.matches) {
      buttons[nextIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    } else if (movePage) {
      const scrollDistance = worksSection.offsetHeight - window.innerHeight;
      const sectionTop = worksSection.getBoundingClientRect().top + window.scrollY;
      const target = sectionTop + (nextIndex / (artists.length - 1)) * scrollDistance;
      window.scrollTo({ top: target, behavior: 'smooth' });
    }
  }

  function syncFromScroll() {
    frameRequested = false;
    if (mobileQuery.matches) return;

    const rect = worksSection.getBoundingClientRect();
    const scrollDistance = worksSection.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return;

    const progressValue = Math.max(0, Math.min(1, -rect.top / scrollDistance));
    const nextIndex = Math.round(progressValue * (artists.length - 1));
    if (nextIndex !== activeIndex) setActive(nextIndex);
  }

  function requestScrollSync() {
    if (frameRequested) return;
    frameRequested = true;
    window.requestAnimationFrame(syncFromScroll);
  }

  function setSectionHeight() {
    if (mobileQuery.matches) {
      worksSection.style.removeProperty('height');
      return;
    }

    const step = Math.min(window.innerHeight * 0.46, 420);
    worksSection.style.height = `${window.innerHeight + ((artists.length - 1) * step)}px`;
    positionReel();
    positionAuthors();
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => setActive(index, { movePage: true }));
    button.addEventListener('mouseenter', () => {
      if (!mobileQuery.matches) setActive(index, { followList: false });
    });
  });

  window.addEventListener('scroll', requestScrollSync, { passive: true });
  window.addEventListener('resize', setSectionHeight);
  mobileQuery.addEventListener('change', () => {
    reel.style.removeProperty('transform');
    authorsList.style.removeProperty('transform');
    setSectionHeight();
    setActive(activeIndex);
  });

  setSectionHeight();
  setActive(0);
  syncFromScroll();
}
