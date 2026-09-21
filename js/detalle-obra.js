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

  const categories = ['Corporalidad', 'Entorno', 'Sinergia', 'Sensorialidad'];
  const gallery = [
    'assets/images/detalle-obra/microbioespecularis-01.webp',
    'assets/images/detalle-obra/microbioespecularis-02.webp',
    'assets/images/detalle-obra/microbioespecularis-03.webp'
  ];

  // Asignación provisoria y equilibrada. Reemplazar aquí cuando el equipo
  // entregue la categoría definitiva de cada obra.
  const works = artists.map((artistName, index) => ({
    artist: artistName,
    category: index === 0 ? 'Sensorialidad' : categories[(index - 1) % categories.length]
  }));

  const worksHeading = worksSection.querySelector('#works-heading');
  const authorsList = worksSection.querySelector('[data-works-authors]');
  const reel = worksSection.querySelector('[data-works-reel]');
  const progress = worksSection.querySelector('[data-works-progress]');
  const medium = worksSection.querySelector('[data-work-medium]');
  const title = worksSection.querySelector('[data-work-title]');
  const artist = worksSection.querySelector('[data-work-artist]');
  const worksSticky = worksSection.querySelector('.works-sticky');

  const filter = worksSection.querySelector('[data-works-filter]');
  const filterMenu = filter.querySelector('[data-filter-menu]');
  const filterTrigger = filter.querySelector('[data-filter-trigger]');
  const filterTriggerCount = filter.querySelector('[data-filter-trigger-count]');
  const filterClose = filter.querySelector('[data-filter-close]');
  const filterAll = filter.querySelector('[data-filter-all]');
  const filterClear = filter.querySelector('[data-filter-clear]');
  const filterClearCount = filter.querySelector('[data-filter-clear-count]');
  const filterCategoryButtons = [...filter.querySelectorAll('[data-filter-category]')];

  const modal = worksSection.querySelector('[data-work-modal]');
  const modalAuthors = modal.querySelector('[data-modal-authors]');
  const modalAuthorsHeading = modal.querySelector('.work-modal-authors h2');
  const modalTitle = modal.querySelector('[data-modal-title]');
  const modalDescription = modal.querySelector('[data-modal-description]');
  const modalArtist = modal.querySelector('[data-modal-artist]');
  const modalCategory = modal.querySelector('[data-modal-category]');
  const modalImage = modal.querySelector('[data-modal-image]');
  const modalDownload = modal.querySelector('[data-modal-download]');
  const modalPagination = modal.querySelector('[data-modal-pagination]');
  const modalClose = modal.querySelector('[data-modal-close]');
  const modalPrevious = modal.querySelector('[data-modal-previous]');
  const modalNext = modal.querySelector('[data-modal-next]');

  const mobileQuery = window.matchMedia('(max-width: 820px)');
  const selectedCategories = new Set();
  let visibleIndices = works.map((_, index) => index);
  let activeIndex = 0;
  let modalImageIndex = 1;
  let frameRequested = false;
  let lastFocusedElement = null;
  let imageSwapTimer = null;

  works.forEach((work, index) => {
    const listItem = document.createElement('li');
    const button = document.createElement('button');
    button.className = 'works-author-button';
    button.type = 'button';
    button.textContent = work.artist;
    button.dataset.workIndex = index;
    button.setAttribute('aria-label', `Ver obra de ${work.artist}, categoría ${work.category}`);
    listItem.dataset.category = work.category;
    listItem.append(button);
    authorsList.append(listItem);

    const modalListItem = document.createElement('li');
    const modalAuthorButton = button.cloneNode(true);
    modalListItem.dataset.category = work.category;
    modalListItem.append(modalAuthorButton);
    modalAuthors.append(modalListItem);

    const card = document.createElement('button');
    const image = document.createElement('img');
    card.className = 'works-card';
    card.type = 'button';
    card.dataset.workIndex = index;
    card.dataset.category = work.category;
    card.setAttribute('aria-label', `Abrir detalle de la obra de ${work.artist}, categoría ${work.category}`);
    image.src = gallery[index % gallery.length];
    image.alt = index === 0 ? 'Microbioespecularis, obra de la categoría Sensorialidad' : '';
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
  const modalAuthorButtons = [...modalAuthors.querySelectorAll('.works-author-button')];

  gallery.forEach(() => {
    const page = document.createElement('span');
    page.className = 'work-modal-page';
    modalPagination.append(page);
  });
  const modalPages = [...modalPagination.querySelectorAll('.work-modal-page')];

  categories.forEach((category) => {
    const total = works.filter((work) => work.category === category).length;
    filter.querySelector(`[data-filter-count="${category}"]`).textContent = total;
  });

  function getWorkData(index) {
    const work = works[index];
    if (index === 0) {
      return {
        title: 'Microbioespecularis',
        artist: work.artist,
        category: work.category,
        description: 'Microbioespecularis es una instalación interactiva que simula un experimento biotecnológico mediante inteligencia artificial y algoritmos de vida artificial seca. La obra se presenta como una proyección sobre un vaso reactor de vidrio, dentro del cual se visualiza un ecosistema virtual habitado por organismos sintéticos llamados Bichos Mimicus.'
      };
    }
    return {
      title: 'Detalle próximamente',
      artist: work.artist,
      category: work.category,
      description: 'La información completa de esta obra se incorporará cuando el equipo de diseño entregue sus textos, categoría y recursos visuales definitivos.'
    };
  }

  function toggleFilterMenu(forceOpen) {
    const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : filterMenu.hidden;
    filterMenu.hidden = !shouldOpen;
    filterTrigger.setAttribute('aria-expanded', String(shouldOpen));
    if (shouldOpen) filterAll.focus();
  }

  function renderFilterControls() {
    const count = selectedCategories.size;
    const isAll = count === 0;
    filterAll.setAttribute('aria-pressed', String(isAll));
    filterAll.querySelector('img').hidden = !isAll;
    filterCategoryButtons.forEach((button) => {
      const isSelected = selectedCategories.has(button.dataset.filterCategory);
      button.setAttribute('aria-pressed', String(isSelected));
      button.querySelector('img').hidden = !isSelected;
    });
    filterTriggerCount.textContent = count ? ` (${count})` : '';
    filterClearCount.textContent = count ? `(${count})` : '';
    filterClear.hidden = isAll;
  }

  function updateFilteredHeading() {
    let heading = 'Obras por alumno';
    if (selectedCategories.size === 1) heading = `Obras de ${[...selectedCategories][0]}`;
    else if (selectedCategories.size > 1) heading = 'Obras filtradas';
    worksHeading.textContent = heading;
    modalAuthorsHeading.textContent = heading;
  }

  function applyFilters({ reposition = true } = {}) {
    visibleIndices = works
      .map((work, index) => ({ work, index }))
      .filter(({ work }) => selectedCategories.size === 0 || selectedCategories.has(work.category))
      .map(({ index }) => index);

    works.forEach((_, index) => {
      const isVisible = visibleIndices.includes(index);
      buttons[index].closest('li').hidden = !isVisible;
      modalAuthorButtons[index].closest('li').hidden = !isVisible;
      cards[index].hidden = !isVisible;
      marks[index].hidden = !isVisible;
    });

    if (!visibleIndices.includes(activeIndex)) activeIndex = visibleIndices[0];
    renderFilterControls();
    updateFilteredHeading();
    setSectionHeight();
    setActive(activeIndex);
    if (reposition && !mobileQuery.matches) {
      window.requestAnimationFrame(() => scrollToWork(activeIndex, 'smooth'));
    }
  }

  function updateModalImage(nextIndex) {
    modalImageIndex = (nextIndex + gallery.length) % gallery.length;
    const source = gallery[modalImageIndex];
    modalImage.classList.add('is-changing');
    window.clearTimeout(imageSwapTimer);
    imageSwapTimer = window.setTimeout(() => {
      modalImage.src = source;
      modalDownload.href = source;
      modalImage.classList.remove('is-changing');
    }, 160);
    modalPages.forEach((page, pageIndex) => {
      page.classList.toggle('is-active', pageIndex === modalImageIndex);
    });
  }

  function openModal(index) {
    const work = getWorkData(index);
    const wasHidden = modal.hidden;
    setActive(index);
    toggleFilterMenu(false);
    modalTitle.textContent = work.title;
    modalDescription.textContent = work.description;
    modalArtist.textContent = work.artist;
    modalCategory.textContent = work.category;
    modalImage.alt = index === 0 ? 'Microbioespecularis, instalación interactiva' : `Obra de ${work.artist}`;
    if (wasHidden) lastFocusedElement = document.activeElement;
    modal.hidden = false;
    worksSticky.inert = true;
    document.body.classList.add('has-work-modal');
    positionModalAuthors();
    updateModalImage(index === 0 ? 1 : index % gallery.length);
    if (wasHidden) modalClose.focus();
  }

  function closeModal() {
    modal.hidden = true;
    worksSticky.inert = false;
    document.body.classList.remove('has-work-modal');
    if (lastFocusedElement) lastFocusedElement.focus();
  }

  function positionReel() {
    if (mobileQuery.matches) return;
    const activeCard = cards[activeIndex];
    const cardCenter = activeCard.offsetTop + (activeCard.offsetHeight / 2);
    reel.style.transform = `translate3d(0, ${(window.innerHeight / 2) - cardCenter}px, 0)`;
  }

  function positionAuthors() {
    if (mobileQuery.matches) return;
    const activeButton = buttons[activeIndex];
    const preferredTop = Math.min(authorsList.parentElement.clientHeight * 0.45, 360);
    authorsList.style.transform = `translate3d(0, ${-Math.max(0, activeButton.offsetTop - preferredTop)}px, 0)`;
  }

  function positionModalAuthors() {
    if (modalAuthors.parentElement.offsetParent === null) return;
    const activeButton = modalAuthorButtons[activeIndex];
    const preferredTop = Math.min(modalAuthors.parentElement.clientHeight * 0.45, 360);
    modalAuthors.style.transform = `translate3d(0, ${-Math.max(0, activeButton.offsetTop - preferredTop)}px, 0)`;
  }

  function updateDetails(index) {
    const work = getWorkData(index);
    artist.textContent = work.artist;
    medium.textContent = work.category;
    title.textContent = work.title;
  }

  function scrollToWork(index, behavior = 'smooth') {
    const visiblePosition = visibleIndices.indexOf(index);
    if (visiblePosition < 0) return;
    const scrollDistance = worksSection.offsetHeight - window.innerHeight;
    const sectionTop = worksSection.getBoundingClientRect().top + window.scrollY;
    const ratio = visibleIndices.length > 1 ? visiblePosition / (visibleIndices.length - 1) : 0;
    window.scrollTo({ top: sectionTop + (ratio * scrollDistance), behavior });
  }

  function setActive(index, { movePage = false, followList = true } = {}) {
    const nextIndex = visibleIndices.includes(index) ? index : visibleIndices[0];
    activeIndex = nextIndex;
    buttons.forEach((button, buttonIndex) => {
      const isActive = buttonIndex === nextIndex;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-pressed', String(isActive));
    });
    modalAuthorButtons.forEach((button, buttonIndex) => {
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
      scrollToWork(nextIndex);
    }
  }

  function syncFromScroll() {
    frameRequested = false;
    if (mobileQuery.matches) return;
    const scrollDistance = worksSection.offsetHeight - window.innerHeight;
    if (scrollDistance <= 0) return;
    const progressValue = Math.max(0, Math.min(1, -worksSection.getBoundingClientRect().top / scrollDistance));
    const visiblePosition = Math.round(progressValue * (visibleIndices.length - 1));
    const nextIndex = visibleIndices[visiblePosition];
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
    worksSection.style.height = `${window.innerHeight + ((visibleIndices.length - 1) * step)}px`;
    positionReel();
    positionAuthors();
    if (!modal.hidden) positionModalAuthors();
  }

  buttons.forEach((button, index) => {
    button.addEventListener('click', () => setActive(index, { movePage: true }));
    button.addEventListener('mouseenter', () => {
      if (!mobileQuery.matches) setActive(index, { followList: false });
    });
  });
  cards.forEach((card, index) => card.addEventListener('click', () => openModal(index)));
  modalAuthorButtons.forEach((button, index) => button.addEventListener('click', () => openModal(index)));

  filterTrigger.addEventListener('click', () => toggleFilterMenu());
  filterClose.addEventListener('click', () => toggleFilterMenu(false));
  filterAll.addEventListener('click', () => {
    selectedCategories.clear();
    applyFilters();
  });
  filterClear.addEventListener('click', () => {
    selectedCategories.clear();
    applyFilters();
  });
  filterCategoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const category = button.dataset.filterCategory;
      if (selectedCategories.has(category)) selectedCategories.delete(category);
      else selectedCategories.add(category);
      applyFilters();
    });
  });

  modalClose.addEventListener('click', closeModal);
  modalPrevious.addEventListener('click', () => updateModalImage(modalImageIndex - 1));
  modalNext.addEventListener('click', () => updateModalImage(modalImageIndex + 1));

  document.addEventListener('click', (event) => {
    if (!filterMenu.hidden && !filter.contains(event.target)) toggleFilterMenu(false);
  });
  document.addEventListener('keydown', (event) => {
    if (!modal.hidden) {
      if (event.key === 'Escape') closeModal();
      if (event.key === 'ArrowLeft') updateModalImage(modalImageIndex - 1);
      if (event.key === 'ArrowRight') updateModalImage(modalImageIndex + 1);
      return;
    }
    if (event.key === 'Escape') toggleFilterMenu(false);
  });

  window.addEventListener('scroll', requestScrollSync, { passive: true });
  window.addEventListener('resize', setSectionHeight);
  mobileQuery.addEventListener('change', () => {
    reel.style.removeProperty('transform');
    authorsList.style.removeProperty('transform');
    setSectionHeight();
    setActive(activeIndex);
  });

  renderFilterControls();
  setSectionHeight();
  setActive(0);
  syncFromScroll();
}
