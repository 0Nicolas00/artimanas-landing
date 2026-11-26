
/* Interfaz HTML progresiva: los contenidos se editan directamente en index.html. */
(function () {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const core = window.Artimanas;
  const detailTransition=window.ArtimanasWorkTransition;
  const desktop = matchMedia('(min-width:1101px)');
  const labels = {alienacion:'Alienación', entorno:'Entorno', identidad:'Identidad', sensorialidad:'Sensorialidad', sinergia:'Sinergia'};
  const indications = {
    individual: ['1 persona','M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM5 21v-2a7 7 0 0 1 14 0v2'],
    duo: ['2 personas','M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6-6a3 3 0 1 1 0 6M3 21v-2a6 6 0 0 1 12 0v2m3-7a5 5 0 0 1 3 5v2'],
    sonido: ['Tiene sonido','M4 9h4l5-4v14l-5-4H4Zm12 0a5 5 0 0 1 0 6m2-8a8 8 0 0 1 0 10'],
    sinflash: ['No usar flash','m3 3 18 18m-9-7-2 7 9-11h-6l2-7-5 6m-2 2-2 3h5']
  };
  const placeholderUrl = safeMedia('assets/imagen-pendiente.svg');
  const workCards = $$('.work-card');
  const works = workCards.map(el => {
    const title = $('h3',el).textContent;
    const author = $('.work-author',el).textContent;
    return {
      el, slug:el.dataset.slug, student:el.dataset.alumno, category:el.dataset.category,
      title, author, description:$('.work-description',el).textContent,
      slides:readWorkMedia(el,title,author),
      indications:(el.dataset.indications || "").split(",").flatMap(key=>Object.hasOwn(indications,key.trim())?[indications[key.trim()]]:[]),
      research:el.dataset.research
    };
  });
  const progress=$('#catalog-progress');
  const hero=$('#inicio');
  const homeView=$('[data-view="inicio"]');
  const countdownView=$('[data-view="countdown"]');
  const studentSidebar=$('.student-sidebar');
  const detailSidebar=$('.detail-students');
  const detailNames=$('#detail-student-list');
  const filterIconPath=$('#filter-trigger path').getAttribute('d');
  const dialogs = $$('dialog');
  const filterDialog = $('#filter-dialog');
  const workDialog = $('#work-dialog');
  const mediaStage = $('#media-stage');
  let applied = {categories:[],students:[]};
  let currentWork = null;
  let slideIndex = 0;
  let lastFocus = null;
  let effectivePage = 'inicio';
  let previousCountMode = null;
  let allVisible = works;
  let synchronizing = false;
  let layoutPending = false;
  let activeSlug = '';
  function params() { return new URLSearchParams(location.search); }
  function safeMedia(value) {
    if (!value) return '';
    if (/^data:image\/(webp|png|jpeg);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try {
      const u = new URL(value, location.href);
      return ['http:','https:','file:'].includes(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  }
  function youtubeId(value = '') {
    const videoId = /^[\w-]{11}$/;
    const candidate = value.trim();
    if (videoId.test(candidate)) return candidate;
    try {
      const url = new URL(candidate);
      if (!['http:','https:'].includes(url.protocol)) return '';
      const [, kind, pathId] = url.pathname.split('/');
      let id = '';
      if (url.hostname === 'youtu.be') id = kind;
      else if (['youtube.com','www.youtube.com','m.youtube.com'].includes(url.hostname)) {
        if (kind === 'watch') id = url.searchParams.get('v');
        else if (['embed','shorts','live'].includes(kind)) id = pathId;
      }
      return videoId.test(id || '') ? id : '';
    } catch (_) { return ''; }
  }
  function readWorkMedia(card,title,author) {
    const link = $('.work-link',card);
    let cover = $('img',link);
    const source = safeMedia(cover?.getAttribute('src')?.trim());
    const coverPhoto = source === placeholderUrl ? '' : source;
    const photos = [...new Set((card.dataset.images || '').split(',')
      .map(value=>safeMedia(value.trim())).filter(url=>url && url!==placeholderUrl))];
    if (coverPhoto && !photos.includes(coverPhoto)) photos.push(coverPhoto);
    if (!cover) {
      cover = document.createElement('img');
      cover.loading = 'lazy';
      cover.decoding = 'async';
      link.prepend(cover);
    }
    if (!coverPhoto) {
      const fallback = photos[0] || placeholderUrl;
      if (source !== fallback) {
        cover.removeAttribute('width');
        cover.removeAttribute('height');
        cover.src = fallback;
      }
      cover.alt = photos.length ? `Obra ${title} · ${author}` : 'Imagen pendiente';
    }
    if (photos.length) delete card.dataset.imagePending;
    else card.dataset.imagePending = 'true';

    const slides = photos.map((src,index)=>({type:'image',src,number:index+1}));
    const id = youtubeId(card.dataset.youtube);
    if (id) slides.unshift({type:'video',id});
    if (!slides.length) slides.push({type:'placeholder',src:placeholderUrl});
    return slides;
  }
  function writeState(next, options = {}) {
    if(params().get('revision')==='tesis')next.set('revision','tesis');
    const url = new URL(location.href);
    url.search = next.toString();
    const state = {app:'artimanas', overlay: options.overlay || null};
    try { history[options.replace ? 'replaceState' : 'pushState'](state, '', url); }
    catch (_) { /* Offline browsers that restrict History still keep in-page interactions. */ }
  }
  function closeVisibleDialogs() {
    detailTransition.reset();
    synchronizing = true;
    dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
    mediaStage.replaceChildren();
    document.body.classList.remove('modal-open');
    $('#filter-trigger').setAttribute('aria-expanded','false');
    synchronizing = false;
  }
  function showDialog(dialog) {
    cancelCatalogScroll();
    if (!dialog.open) {
      if (!dialogs.some(d=>d.open)) lastFocus = document.activeElement;
      closeVisibleDialogs();
      if(dialog===filterDialog)dialog.show();else dialog.showModal();
    }
    document.body.classList.toggle('modal-open',dialog!==filterDialog);
    if(dialog.id==='event-dialog'){
      dialog.scrollTop=0;
      layoutEventTicket();
    }
  }
  function restoreFocus() {
    if (lastFocus && lastFocus.isConnected && !lastFocus.closest('[hidden]')) lastFocus.focus({preventScroll:true});
  }
  function clearOverlayParams(p) {
    ['obra','foto','muestra'].forEach(key=>p.delete(key));
    return p;
  }
  function closeWorkDetail() {
    const player = $('.media-video-player',mediaStage);
    if (player) {
      player.remove();
      $('.media-video-preview',mediaStage).hidden = false;
    }
    return detailTransition.close();
  }
  async function dismissDialog(dialog) {
    if(dialog===workDialog&&dialog.open){
      if(dialog.hasAttribute('data-scrollbar-exiting'))return;
      const from=location.href;
      const completed=await closeWorkDetail();
      if(!completed||location.href!==from)return;
    }
    if (dialog === filterDialog) {
      closeFilters();
      return;
    }
    if (history.state?.app === 'artimanas' && history.state.overlay) {
      history.back();
    } else {
      writeState(clearOverlayParams(params()), {replace:true});
      renderRoute();
      restoreFocus();
    }
  }
  function navigate(page) {
    const p = new URLSearchParams();
    p.set('pagina',page);
    writeState(p, {replace:history.state?.overlay === 'menu'});
    renderRoute();
    window.scrollTo({top:0,behavior:'instant'});
    $('#contenido').setAttribute('tabindex','-1');
    $('#contenido').focus({preventScroll:true});
  }
  function openWork(slug, options = {}) {
    const work = works.find(item=>item.slug===slug);
    if (!work) return;
    const p = clearOverlayParams(params()); p.set('obra',slug);
    writeState(p,{overlay:'work',replace:options.replace || workDialog.open});
    if(workDialog.open)renderWork(slug);else renderRoute();
  }
  function openEvent() {
    const p = clearOverlayParams(params()); p.set('muestra','');
    writeState(p,{overlay:'event',replace:history.state?.overlay==='menu'});
    renderRoute();
  }
  function layoutEventTicket(){
    const dialog=$('#event-dialog');
    if(!dialog.open)return;
    const ticket=$('.ticket',dialog),rect=ticket.getBoundingClientRect();
    // Include the rotated edges in normal flow, without shrinking the ticket or its text.
    dialog.style.setProperty('--ticket-bleed',`${Math.max(0,(rect.height-ticket.offsetHeight)/2)}px`);
    dialog.style.setProperty('--ticket-outer-height',`${rect.height}px`);
  }
  function openPhoto(id) {
    const p = clearOverlayParams(params()); p.set('pagina','galeria');p.set('foto',id);
    writeState(p,{overlay:'photo'});renderRoute();
  }
  function applyFiltersToPage() {
    allVisible = works.filter(work=>core.matches(work,applied,desktop.matches));
    const visibleSlugs = new Set(allVisible.map(work=>work.slug));
    progress.style.setProperty('--progress-count',allVisible.length);
    progress.replaceChildren(...allVisible.map(work=>{
      const mark=document.createElement('button');
      mark.type='button';
      mark.setAttribute('aria-label',`Ir a ${work.title}`);
      mark.dataset.progressFor=work.slug;
      mark.classList.toggle('is-active',work.slug===activeSlug);
      mark.setAttribute('aria-current',String(work.slug===activeSlug));
      return mark;
    }));
    works.forEach(work => { work.el.hidden = !visibleSlugs.has(work.slug); });
    $$('[data-student-for]', $('#student-list')).forEach(link => {
      link.closest('li').hidden = !visibleSlugs.has(link.dataset.studentFor);
    });
    $('#empty-state').hidden = allVisible.length > 0;
    $('#works').hidden = allVisible.length === 0;
    const count = applied.categories.length;
    $('#filter-trigger span').textContent = count ? `Filtrar (${count})` : 'Filtrar';
    $('#student-heading').textContent = applied.categories.length === 1 ? `Obras de ${labels[applied.categories[0]]}` : 'Obras por alumno';
    $('#results-status').textContent = `${allVisible.length} ${allVisible.length===1?'obra disponible':'obras disponibles'}`;
    layoutCards();
  }
  function layoutCards() {
    if(layoutPending)return;
    layoutPending=true;
    requestAnimationFrame(()=>{
      workCards.forEach(card=>{
        card.style.gridRowEnd=desktop.matches?'auto':`span ${Math.ceil($('.work-link',card).getBoundingClientRect().height+40)}`;
      });
      layoutPending=false;
      updateScrollFocus();
    });
  }
  function setFilterParams(p, selection) {
    for (const [key, values] of [['categoria',selection.categories],['alumno',selection.students]]) {
      if (values.length) p.set(key,values.join(',')); else p.delete(key);
    }
    return p;
  }
  function resetFiltersOnReload() {
    if (performance.getEntriesByType('navigation')[0]?.type !== 'reload') return;
    const p = params();
    if (!p.has('categoria') && !p.has('alumno')) return;
    writeState(setFilterParams(p, {categories:[],students:[]}), {replace:true});
  }
  function renderFilterForm() {
    $$('input[name="categoria"]',filterDialog).forEach(input=>{input.checked=applied.categories.includes(input.value);});
    const selected=applied.categories.length;
    $('#filter-all').setAttribute('aria-pressed',String(selected===0));
    $('#clear-filters').textContent=selected?`Borrar filtros (${selected})`:'Borrar filtros';
    $('#clear-filters').disabled=selected===0;
    $$('[data-category-count]',filterDialog).forEach(el=>{
      el.textContent=works.filter(work=>work.category===el.dataset.categoryCount).length;
    });
  }
  function anchorFilters() {
    const rect=$('#filter-trigger').getBoundingClientRect();
    const width=Math.min(304,innerWidth-24);
    const left=Math.max(12,Math.min(rect.left+(rect.width-width)/2,innerWidth-width-12));
    filterDialog.style.setProperty('--filter-popover-left',`${left}px`);
    filterDialog.style.setProperty('--filter-popover-bottom',`${innerHeight-rect.top+8}px`);
  }
  function openFilters() {
    renderFilterForm();
    anchorFilters();
    showDialog(filterDialog);
    $('#filter-trigger').setAttribute('aria-expanded','true');
  }
  function closeFilters(returnFocus=true) {
    filterDialog.close();
    $('#filter-trigger').setAttribute('aria-expanded','false');
    if(returnFocus)restoreFocus();
  }
  function commitCategories(categories) {
    applied={categories,students:[]};
    writeState(setFilterParams(params(),applied),{replace:true});
    applyFiltersToPage();
    renderFilterForm();
    updateFilterVisibility();
  }
  function clearAll() {
    writeState(setFilterParams(clearOverlayParams(params()),{categories:[],students:[]}));
    renderRoute();
  }
  function activateWork(work) {
    if(activeSlug===work.slug)return;
    activeSlug=work.slug;
    workCards.forEach(card=>card.classList.toggle('is-active',card===work.el));
    $$('[data-student-for]').forEach(link=>link.setAttribute('aria-current',String(link.dataset.studentFor===work.slug)));
    $$('[data-progress-for]',progress).forEach(mark=>{
      const current=mark.dataset.progressFor===work.slug;
      mark.classList.toggle('is-active',current);
      mark.setAttribute('aria-current',String(current));
    });
  }
  function setDescriptionExpanded(expanded){
    $('#description-block').classList.toggle('is-expanded',expanded);
    $('#description-toggle').setAttribute('aria-expanded',String(expanded));
    $('#description-toggle span').textContent=expanded?'Leer menos':'Leer más';
  }
  function updateDescription(){
    if(!workDialog.open)return;
    const long=$('#detail-description').scrollHeight>(desktop.matches?304:216)+1;
    $('#description-block').classList.toggle('is-long',long);
    $('#description-toggle').hidden=!long;
    if(!long)setDescriptionExpanded(false);
  }
  function renderWork(slug) {
    const work=works.find(item=>item.slug===slug);
    if (!work) return false;
    const wasOpen=workDialog.open;
    const snapshot=detailTransition.capture(work.el);
    currentWork=work;slideIndex=0;
    const sourceName=!wasOpen&&desktop.matches
      ? $$('[data-student-for]',studentSidebar).find(link=>link.dataset.studentFor===slug)
      : null;
    const sourceRect=sourceName?.getBoundingClientRect();
    const sidebarRect=sourceName&&studentSidebar.getBoundingClientRect();
    const visibleName=sourceRect?.height>0&&sourceRect.bottom>sidebarRect.top
      &&sourceRect.top<Math.min(innerHeight,sidebarRect.bottom);
    activateWork(work);
    $('#detail-title').textContent=work.title;
    $('#detail-description').replaceChildren(...work.description.trim().split(/\n\s*\n/).map(text=>{
      const paragraph=document.createElement('p');paragraph.textContent=text;return paragraph;
    }));
    setDescriptionExpanded(false);
    $('.detail-copy').scrollTop=0;
    workDialog.scrollTop=0;
    $('#detail-author').textContent=work.author;
    $('#detail-category').textContent=labels[work.category];
    $('#detail-indications').replaceChildren(...work.indications.map(([label,path])=>{
      const item=document.createElement('li');
      const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
      const outline=document.createElementNS(icon.namespaceURI,'path');
      icon.setAttribute('viewBox','0 0 24 24');
      icon.setAttribute('aria-hidden','true');
      outline.setAttribute('d',path);
      icon.append(outline);
      item.append(icon,label);
      return item;
    }));
    $('#detail-indications-row').hidden=work.indications.length===0;
    if(!wasOpen){
      $('h3',detailSidebar).textContent=$('#student-heading').textContent;
      detailNames.replaceChildren(...allVisible.map(item=>{
        const li=document.createElement('li');const a=document.createElement('a');
        a.href=`?obra=${encodeURIComponent(item.slug)}`;a.dataset.openWork=item.slug;a.dataset.studentFor=item.slug;
        a.textContent=item.author;a.setAttribute('aria-current',String(item===work));li.append(a);return li;
      }));
    }
    const research=safeMedia(work.research);
    $('#research-link').hidden=!research;
    $('#research-pending').hidden=Boolean(research);
    if (research) {$('#research-link').href=research;$('#research-link').setAttribute('download','');}
    showDialog(workDialog);
    let nameOffset;
    if(!wasOpen){
      detailSidebar.scrollTop=0;
      if(desktop.matches){
        const active=$('[aria-current="true"]',detailNames);
        if(active){
          const row=active.getBoundingClientRect();
          const list=detailSidebar.getBoundingClientRect();
          detailSidebar.scrollTop=row.top-(visibleName?sourceRect.top:list.top+(list.height-row.height)/2);
          if(visibleName){
            const aligned=active.getBoundingClientRect();
            nameOffset=sourceRect.left-aligned.left;
          }
        }
      }
    }
    updateDescription();
    renderSlide();
    if(wasOpen)detailTransition.change();else detailTransition.open(snapshot,nameOffset);
    return true;
  }
  function videoPreview(id,title) {
    const preview = document.createElement('button');
    preview.type = 'button';
    preview.className = 'media-video-preview';
    preview.setAttribute('aria-label',`Reproducir video de ${title}`);
    const thumbnail = document.createElement('img');
    thumbnail.alt = '';
    thumbnail.draggable = false;
    const thumbnailBase = `https://i.ytimg.com/vi/${id}`;
    const fullThumbnail = `${thumbnailBase}/maxresdefault.jpg`;
    thumbnail.addEventListener('error',()=>{
      if (thumbnail.src === fullThumbnail) thumbnail.src = `${thumbnailBase}/mqdefault.jpg`;
      else thumbnail.hidden = true;
    });
    thumbnail.src = fullThumbnail;
    const play = document.createElement('span');
    play.className = 'icon-button media-play';
    play.setAttribute('aria-hidden','true');
    preview.addEventListener('click',event=>{
      const container = document.createElement('div');
      container.className = 'media-video-player';
      const player = document.createElement('iframe');
      player.title = `Video de ${title}`;
      player.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
      player.referrerPolicy = 'strict-origin-when-cross-origin';
      player.allowFullscreen = true;
      player.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&playsinline=1&rel=0`;
      container.append(player);
      preview.hidden = true;
      mediaStage.append(container);
      if (event.detail===0) player.focus({preventScroll:true});
    });
    preview.append(thumbnail,play);
    return preview;
  }
  function selectSlide(index) {
    const total = currentWork.slides.length;
    const next = (index+total)%total;
    if (next===slideIndex) return;
    slideIndex = next;
    renderSlide();
  }
  function renderSlide() {
    const dots = $('#media-dots');
    const dotsFocused = dots.contains(document.activeElement);
    const {slides,title} = currentWork;
    const slide = slides[slideIndex];
    const placeholder = slide.type==='placeholder';
    if (slide.type==='video') {
      mediaStage.replaceChildren(videoPreview(slide.id,title));
    } else {
      const img = document.createElement('img');
      img.src = slide.src;
      img.alt = placeholder ? 'Imagen pendiente' : `${title} · imagen ${slide.number}`;
      mediaStage.replaceChildren(img);
    }

    const download = $('#media-download');
    download.hidden = slide.type!=='image';
    if (download.hidden) download.removeAttribute('href');
    else download.href = slide.src;
    const counter = $('#media-counter');
    counter.hidden = placeholder;
    counter.textContent = `${slideIndex+1}/${slides.length}`;
    $('#media-prev').hidden = $('#media-next').hidden = dots.hidden = slides.length<2;
    dots.replaceChildren(...slides.map((item,index)=>{
      const button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('aria-label',item.type==='video'?'Ver video':`Ver imagen ${item.number || 1}`);
      button.setAttribute('aria-current',String(index===slideIndex));
      button.addEventListener('click',()=>selectSlide(index));
      return button;
    }));
    if (dotsFocused) $('[aria-current="true"]',dots)?.focus({preventScroll:true});
  }
  function renderPhoto(id) {
    const button=$$('.gallery-item').find(item=>item.dataset.photo===id);
    if (!button) return false;
    const source=$('img',button);const img=$('#photo-image');
    img.src=source.src;img.alt=source.alt;$('#photo-caption').textContent=source.alt;
    showDialog($('#photo-dialog'));return true;
  }
  function shouldShowCountdown(clock,p) {
    return !clock.ended&&p.get('revision')!=='tesis'&&(clock.active||p.get('pagina')==='countdown');
  }
  function updateCountdown() {
    const clock=core.countdown(Date.now());
    for (const unit of ['days','hours','minutes','seconds']) $('#count-'+unit).textContent=String(clock[unit]).padStart(2,'0');
    const mode=shouldShowCountdown(clock,params());
    if (previousCountMode!==null && mode!==previousCountMode) {
      previousCountMode=mode;renderRoute();return;
    }
    previousCountMode=mode;
  }
  function renderRoute() {
    cancelCatalogScroll();
    const p=params();
    const oldPage=effectivePage;
    const requested=p.get('pagina')||document.body.dataset.startPage||'inicio';
    const clock=core.countdown(Date.now());
    const countMode=shouldShowCountdown(clock,p);
    previousCountMode=countMode;
    effectivePage=countMode?'countdown':(requested==='countdown'?'inicio':requested);
    if (!['inicio','galeria','404','countdown'].includes(effectivePage)) effectivePage='404';
    if (!countMode && p.has('obra') && !works.some(work=>work.slug===p.get('obra'))) effectivePage='404';
    if (!countMode && p.has('foto') && !$$('.gallery-item').some(item=>item.dataset.photo===p.get('foto'))) effectivePage='404';
    closeVisibleDialogs();
    $$('[data-view]').forEach(view=>{view.hidden=view.dataset.view!==effectivePage;});
    const counting=effectivePage==='countdown';
    const heroParent=counting?countdownView:homeView;
    if(hero.parentElement!==heroParent)heroParent.prepend(hero);
    if(counting) hero.setAttribute('aria-hidden','true');
    else hero.removeAttribute('aria-hidden');
    $('#site-header').hidden=counting;
    $('#site-footer').hidden=!['inicio','galeria'].includes(effectivePage);
    $$('[data-page-link]').forEach(link=>{
      if(link.dataset.pageLink===effectivePage) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    document.title=effectivePage==='galeria'?'Galería · Artimañas 2026':effectivePage==='404'?'Página no encontrada · Artimañas 2026':'Artimañas 2026 · Muestra de arte interactivo';
    applied=core.readFilters(p,[]);applyFiltersToPage();updateFilterVisibility();
    if(oldPage!==effectivePage) window.scrollTo({top:0,behavior:'instant'});
    if(p.has('muestra')) showDialog($('#event-dialog'));
    else if(effectivePage==='inicio' && p.has('obra')){
      const work=works.find(item=>item.slug===p.get('obra'));
      if(!work.el.hidden)alignWorkAtCenter(work);
      renderWork(work.slug);
    }
    else if(effectivePage==='galeria' && p.has('foto')) renderPhoto(p.get('foto'));
    else if(history.state?.overlay==='menu') showDialog($('#menu-dialog'));
  }
  function updateFilterVisibility() {
    const rect=$('#obras').getBoundingClientRect();
    const button=$('#filter-trigger');
    const footer=$('#site-footer');
    const atFooter=!footer.hidden&&footer.getBoundingClientRect().top<innerHeight;
    const visible=effectivePage==='inicio'&&window.scrollY>48&&(atFooter||rect.top<innerHeight*.65)&&!document.body.classList.contains('modal-open');
    const action=atFooter?'top':'filters';
    const changed=button.dataset.action!==action;
    button.dataset.action=action;
    const count=applied.categories.length;
    $('span',button).textContent=atFooter?'Volver arriba':count?`Filtrar (${count})`:'Filtrar';
    $('path',button).setAttribute('d',atFooter?'M12 20V4m-7 7 7-7 7 7':filterIconPath);
    if(filterDialog.open){
      if(atFooter||!visible)closeFilters(false);else anchorFilters();
    }
    const showProgress=visible&&!atFooter&&allVisible.length>0;
    progress.classList.toggle('is-visible',showProgress);
    progress.inert=!showProgress;
    if(atFooter){button.removeAttribute('aria-haspopup');button.removeAttribute('aria-controls');button.removeAttribute('aria-expanded');}
    else {button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','filter-dialog');button.setAttribute('aria-expanded',String(filterDialog.open));}
    if(changed&&visible&&catalogScrollFrame===null&&!matchMedia('(prefers-reduced-motion:reduce)').matches)button.animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:300,easing:'ease-out'});
    button.hidden=effectivePage!=='inicio';
    button.classList.toggle('is-visible',visible);
    button.inert=!visible;
    button.setAttribute('aria-hidden',String(!visible));
  }
  // Desplazamiento del listado: duración por distancia, aceleración y frenado continuos.
  let catalogScrollFrame=null,catalogEntryRunning=false,returningToTop=false,selectingWork=false;
  let pressedName=null;
  let entryArmed=window.scrollY<=8,touchScrolling=false;
  function updateCatalogAccess(){
    const locked=window.scrollY<=8||catalogEntryRunning;
    $('#works').inert=locked;
    $('#student-list').inert=window.scrollY<=8;
    $('#obras').dataset.entering=String(catalogEntryRunning);
    document.dispatchEvent(new Event('catalogentrychange'));
  }
  function cancelCatalogScroll(){
    if(catalogScrollFrame!==null)cancelAnimationFrame(catalogScrollFrame);
    catalogScrollFrame=null;
    catalogEntryRunning=false;
    returningToTop=false;
    selectingWork=false;
    updateCatalogAccess();
  }
  function animateCatalogScroll(destination,onComplete,{durationOverride,backToTop=false,openSelection=false}={}){
    cancelCatalogScroll();
    returningToTop=backToTop;
    selectingWork=openSelection;
    const start=window.scrollY;
    const limit=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const end=Math.max(0,Math.min(destination,limit));
    const distance=end-start;
    const complete=()=>{
      catalogScrollFrame=null;
      returningToTop=false;
      selectingWork=false;
      onComplete?.();
    };
    if(Math.abs(distance)<1){
      catalogScrollFrame=requestAnimationFrame(complete);
      return;
    }
    const duration=durationOverride??Math.min(1600,650+Math.sqrt(Math.abs(distance))*12);
    let started=null;
    function frame(now){
      if(started===null)started=now;
      const progress=Math.min(1,(now-started)/duration);
      // Smootherstep: velocidad y aceleración nulas en ambos extremos.
      const eased=progress*progress*progress*(progress*(progress*6-15)+10);
      window.scrollTo({top:start+distance*eased,behavior:'instant'});
      // Let scroll-driven card sizing update before the detail captures its source.
      catalogScrollFrame=requestAnimationFrame(progress<1?frame:complete);
    }
    catalogScrollFrame=requestAnimationFrame(frame);
  }
  function positionForWork(work){
    const target=desktop.matches?work.el:$('.work-link',work.el);
    const rect=target.getBoundingClientRect();
    return window.scrollY+rect.top+rect.height/2-innerHeight/2;
  }
  function workPhotoCenterOffset(work){
    const rect=$('img',work.el).getBoundingClientRect();
    return rect.top+rect.height/2-innerHeight/2;
  }
  function alignWorkAtCenter(work){
    const offset=workPhotoCenterOffset(work);
    if(Math.abs(offset)>1)window.scrollBy({top:offset,behavior:'instant'});
  }
  function enterCatalog(){
    if(document.documentElement.dataset.heroIntro||effectivePage!=='inicio'||dialogs.some(dialog=>dialog.open)||!allVisible.length)return;
    entryArmed=false;
    animateCatalogScroll(positionForWork(allVisible[0]),()=>{catalogEntryRunning=false;updateCatalogAccess();});
    catalogEntryRunning=true;updateCatalogAccess();
  }
  function revealWork(slug){
    const work=works.find(item=>item.slug===slug);
    if(!work||work.el.hidden)return;
    if(filterDialog.open)closeFilters(false);
    const destination=window.scrollY+workPhotoCenterOffset(work);
    const distance=Math.abs(destination-window.scrollY);
    const duration=Math.min(900,360+Math.sqrt(distance)*10);
    animateCatalogScroll(destination,()=>{
      if(effectivePage==='inicio'&&!work.el.hidden&&!dialogs.some(dialog=>dialog.open))openWork(slug);
    },{durationOverride:duration,openSelection:true});
  }
  $('#cover-entry').addEventListener('click',enterCatalog);
  progress.addEventListener('click',event=>{
    const mark=event.target.closest('button[data-progress-for]');
    const work=allVisible.find(item=>item.slug===mark?.dataset.progressFor);
    if(work)animateCatalogScroll(positionForWork(work));
  });
  function scrollToTop(){
    const start=$('#home-title');
    start.setAttribute('tabindex','-1');
    const duration=Math.min(940,520+Math.sqrt(window.scrollY)*4);
    animateCatalogScroll(0,()=>start.focus({preventScroll:true}),{durationOverride:duration,backToTop:true});
  }
  window.addEventListener('wheel',event=>{
    if(returningToTop||selectingWork||pressedName!==null){
      // La inercia del último gesto puede seguir llegando después del clic.
      if(!event.ctrlKey&&!event.metaKey)event.preventDefault();
      return;
    }
    const downward=event.deltaY>0&&Math.abs(event.deltaY)>=Math.abs(event.deltaX);
    if(downward&&!event.ctrlKey&&!event.metaKey&&event.cancelable&&effectivePage==='inicio'&&allVisible.length&&!dialogs.some(dialog=>dialog.open)&&(catalogEntryRunning||window.scrollY<=8)){
      event.preventDefault();
      if(!catalogEntryRunning)enterCatalog();
      return;
    }
    cancelCatalogScroll();
  },{passive:false});
  window.addEventListener('touchstart',()=>{touchScrolling=true;cancelCatalogScroll();},{passive:true});
  window.addEventListener('touchend',()=>{
    touchScrolling=false;
    if(entryArmed&&window.scrollY>8&&window.scrollY<$('.hero').offsetHeight)enterCatalog();
  },{passive:true});
  window.addEventListener('touchcancel',()=>{touchScrolling=false;cancelCatalogScroll();},{passive:true});
  window.addEventListener('pointerdown',cancelCatalogScroll,{passive:true});
  window.addEventListener('resize',()=>{
    // Al reaparecer la barra del navegador móvil, el inicio sigue en y=0.
    if(!returningToTop&&!selectingWork)cancelCatalogScroll();
  },{passive:true});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelCatalogScroll();});
  document.addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End',' ','Escape','Tab'].includes(event.key))cancelCatalogScroll();
    if(['ArrowDown','PageDown',' '].includes(event.key)&&window.scrollY<=8&&effectivePage==='inicio'&&allVisible.length&&!dialogs.some(dialog=>dialog.open)&&!event.target.closest('a,button,input,textarea,select')){
      event.preventDefault();enterCatalog();
    }
  });
  document.addEventListener('pointerdown',event=>{
    const name=event.target.closest('#student-list a,#detail-student-list a');
    if(!name||event.button!==0||event.pointerType==='touch')return;
    // Native focus can scroll a partially visible row before its click is delivered.
    event.preventDefault();
    if(name.closest('#student-list'))pressedName=event.pointerId;
    name.setAttribute('data-pointer-focus','');
    name.focus({preventScroll:true});
  });
  function releaseName(event){
    if(event.pointerId===pressedName)pressedName=null;
  }
  window.addEventListener('pointerup',releaseName,{passive:true});
  window.addEventListener('pointercancel',releaseName,{passive:true});
  window.addEventListener('blur',()=>{pressedName=null;});
  document.addEventListener('keydown',()=>{
    $$('.student-list a[data-pointer-focus]').forEach(name=>name.removeAttribute('data-pointer-focus'));
  });
  document.addEventListener('focusout',event=>{
    if(event.target.matches('.student-list a'))event.target.removeAttribute('data-pointer-focus');
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('a,button');if(!target)return;
    if(target.dataset.openWork){
      event.preventDefault();
      if(target.closest('#obras')){
        if(window.scrollY<=8||(!target.closest('#student-list')&&catalogEntryRunning))return;
        revealWork(target.dataset.openWork);
      }else openWork(target.dataset.openWork);
    }
    else if(target.hasAttribute('data-open-event')){event.preventDefault();openEvent();}
    else if(target.dataset.pageLink){event.preventDefault();navigate(target.dataset.pageLink);}
    else if(target.hasAttribute('data-close-dialog')) dismissDialog(target.closest('dialog'));
    else if(target.hasAttribute('data-open-menu')) {writeState(params(),{overlay:'menu'});showDialog($('#menu-dialog'));}
    else if(target.hasAttribute('data-photo')) openPhoto(target.dataset.photo);
    else if(target.hasAttribute('data-clear-all')) clearAll();
    else if(target.hasAttribute('data-back-top')) {event.preventDefault();scrollToTop();}
  });
  dialogs.forEach(dialog=>{
    dialog.addEventListener('cancel',event=>{event.preventDefault();dismissDialog(dialog);});
    dialog.addEventListener('click',event=>{
      if(event.target!==dialog)return;
      const r=dialog.getBoundingClientRect();
      if(dialog.id==='event-dialog'||event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) dismissDialog(dialog);
    });
    dialog.addEventListener('close',()=>{if(!synchronizing&&!dialogs.some(d=>d.open))document.body.classList.remove('modal-open');});
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&filterDialog.open){event.preventDefault();closeFilters();}
  });
  document.addEventListener('pointerdown',event=>{
    if(filterDialog.open&&!filterDialog.contains(event.target)&&!event.target.closest('#filter-trigger,#student-list a'))closeFilters(false);
  });
  $('#filter-trigger').addEventListener('click',()=>{
    if($('#filter-trigger').dataset.action==='top'){
      scrollToTop();
    }else if(filterDialog.open)closeFilters();
    else openFilters();
  });
  filterDialog.addEventListener('change',()=>{
    commitCategories($$('input[name="categoria"]:checked',filterDialog).map(input=>input.value));
  });
  $('#clear-filters').addEventListener('click',()=>{
    commitCategories([]);
    $('#filter-all').focus({preventScroll:true});
  });
  $('#filter-all').addEventListener('click',()=>commitCategories([]));
  $('#media-prev').addEventListener('click',()=>selectSlide(slideIndex-1));
  $('#media-next').addEventListener('click',()=>selectSlide(slideIndex+1));
  workDialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();selectSlide(slideIndex+(event.key==='ArrowLeft'?-1:1));}
  });
  $('#description-toggle').addEventListener('click',()=>setDescriptionExpanded($('#description-toggle').getAttribute('aria-expanded')!=='true'));
  new ResizeObserver(updateDescription).observe($('.detail-copy'));
  document.fonts?.ready.then(updateDescription);
  window.addEventListener('resize',updateDescription,{passive:true});
  workDialog.addEventListener('click',event=>{
    if(event.target===workDialog||event.target.matches('.media-panel,.detail-veil,.work-detail'))dismissDialog(workDialog);
  });
  const mediaPanel = $('.media-panel',workDialog);
  let swipeStart = null;
  mediaPanel.addEventListener('touchstart',event=>{
    swipeStart = event.touches.length===1 ? event.changedTouches[0] : null;
  },{passive:true});
  mediaPanel.addEventListener('touchcancel',()=>{swipeStart=null;},{passive:true});
  mediaPanel.addEventListener('touchend',event=>{
    const start = swipeStart;
    swipeStart = null;
    if (!start || currentWork.slides.length<2) return;
    const end = Array.from(event.changedTouches).find(touch=>touch.identifier===start.identifier);
    if (!end) return;
    const dx = end.clientX-start.clientX;
    const dy = end.clientY-start.clientY;
    if (Math.abs(dx)<=50 || Math.abs(dx)<=Math.abs(dy)) return;
    if (event.cancelable) event.preventDefault();
    selectSlide(slideIndex+(dx<0?1:-1));
  },{passive:false});
  // El scroll de la página gobierna las dos columnas.
  function updateScrollFocus() {
    if(!desktop.matches||effectivePage!=='inicio'||selectingWork||workDialog.open||!allVisible.length)return;
    const center=innerHeight/2;
    const measures=allVisible.map(work=>{
      const bounds=work.el.getBoundingClientRect();
      const midpoint=bounds.top+bounds.height/2;
      return {work,midpoint,distance:Math.abs(midpoint-center)};
    });
    let nearest=measures[0];
    for(const item of measures){if(item.distance<nearest.distance)nearest=item;}
    const first=measures[0].midpoint;
    const span=measures[measures.length-1].midpoint-first;
    const fraction=span>0?Math.max(0,Math.min(1,(center-first)/span)):0;
    const sidebarOffset=(studentSidebar.scrollHeight-studentSidebar.clientHeight)*fraction;
    // Curva y tiempos recuperados de ce084de: énfasis continuo según distancia al centro.
    for(const {work,distance} of measures){
      const focus=Math.exp(-Math.pow(distance/(innerHeight*.32),2));
      work.el.style.setProperty('--work-opacity',(0.14+0.86*Math.pow(focus,4)).toFixed(3));
      work.el.style.setProperty('--work-scale',(0.84+0.54*Math.pow(focus,3)).toFixed(3));
    }
    activateWork(nearest.work);
    // Durante navegación con Tab, dejar que el navegador revele el enlace enfocado.
    if(pressedName===null&&!studentSidebar.querySelector('a:focus-visible:not([data-pointer-focus])'))studentSidebar.scrollTop=sidebarOffset;
  }
  let scrollPending=false,lastCatalogScroll=window.scrollY;
  window.addEventListener('scroll',()=>{
    const current=window.scrollY,previous=lastCatalogScroll;
    lastCatalogScroll=current;
    if(current<=8&&!catalogEntryRunning)entryArmed=true;
    if(!touchScrolling&&entryArmed&&previous<=8&&current>8&&current-previous<innerHeight*.4&&catalogScrollFrame===null)enterCatalog();
    else if(!touchScrolling&&current>8)entryArmed=false;
    updateCatalogAccess();
    if(scrollPending)return;scrollPending=true;
    requestAnimationFrame(()=>{
      updateFilterVisibility();scrollPending=false;
      updateScrollFocus();
    });
  },{passive:true});
  desktop.addEventListener('change',()=>{
    applyFiltersToPage();
    updateFilterVisibility();
  });
  window.addEventListener('resize',layoutCards,{passive:true});
  window.addEventListener('resize',updateFilterVisibility,{passive:true});
  new MutationObserver(updateFilterVisibility).observe(document.body,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(updateFilterVisibility).observe($('#obras'));
  new ResizeObserver(layoutEventTicket).observe($('.ticket'));
  document.fonts?.ready.then(layoutEventTicket);
  window.addEventListener('resize',layoutEventTicket,{passive:true});
  $$('.work-card img').forEach(img=>img.addEventListener('load',layoutCards));
  document.fonts?.ready.then(layoutCards);
  window.addEventListener('popstate',async()=>{
    const destination=location.href,p=params();
    const home=(p.get('pagina')||document.body.dataset.startPage)==='inicio';
    if(workDialog.open&&effectivePage==='inicio'&&home&&!['obra','foto','muestra'].some(key=>p.has(key))){
      const completed=await closeWorkDetail();
      if(!completed||location.href!==destination)return;
    }
    renderRoute();
    if(!dialogs.some(d=>d.open))restoreFocus();
  });
  if(!history.state?.app){try{history.replaceState({app:'artimanas',overlay:null},'');}catch(_){}}
  resetFiltersOnReload();
  updateCountdown();renderRoute();updateCatalogAccess();setInterval(updateCountdown,1000);
})();

