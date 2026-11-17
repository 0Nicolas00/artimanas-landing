
/* Interfaz HTML progresiva: los contenidos se editan directamente en index.html. */
(function () {
  'use strict';
  const $ = (selector, scope = document) => scope.querySelector(selector);
  const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
  const core = window.Artimanas;
  const detailTransition=window.ArtimanasWorkTransition;
  const desktop = matchMedia('(min-width:1101px)');
  const labels = {alienacion:'Alienación', entorno:'Entorno', identidad:'Identidad', sensorialidad:'Sensorialidad', sinergia:'Sinergia'};
  const workCards = $$('.work-card');
  const works = workCards.map(el => ({
    el, slug:el.dataset.slug, student:el.dataset.alumno, category:el.dataset.category,
    title:$('h3',el).textContent, author:$('.work-author',el).textContent,
    description:$('.work-description',el).textContent,
    image:$('img',el).getAttribute('src'), youtube:el.dataset.youtube,
    imagePending:el.dataset.imagePending==='true',
    images:el.dataset.images ? el.dataset.images.split(',').map(v=>v.trim()).filter(Boolean) : [$('img',el).getAttribute('src')],
    research:el.dataset.research
  }));
  const people = works.map(work=>work.student);
  const dialogs = $$('dialog');
  const filterDialog = $('#filter-dialog');
  const workDialog = $('#work-dialog');
  let applied = {categories:[],students:[]};
  let draft = {categories:[],students:[]};
  let currentWork = null;
  let slideIndex = 0;
  let lastFocus = null;
  let effectivePage = 'inicio';
  let previousCountMode = null;
  let countEnded = false;
  let filterTab = 'categorias';
  let allVisible = works;
  let synchronizing = false;
  let layoutPending = false;
  let activeSlug = '';
  try { countEnded = localStorage.getItem('artimanas-2026-ended') === 'true'; } catch (_) {}
  function params() { return new URLSearchParams(location.search); }
  function safeMedia(value) {
    if (!value) return '';
    if (/^data:image\/(webp|png|jpeg);base64,[a-z0-9+/=]+$/i.test(value)) return value;
    try {
      const u = new URL(value, location.href);
      return ['http:','https:','file:'].includes(u.protocol) ? u.href : '';
    } catch (_) { return ''; }
  }
  function writeState(next, options = {}) {
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
    $('#media-stage').replaceChildren(); // Stop any YouTube playback.
    document.body.classList.remove('modal-open');
    synchronizing = false;
  }
  function showDialog(dialog) {
    cancelCatalogScroll();
    if (!dialog.open) {
      if (!dialogs.some(d=>d.open)) lastFocus = document.activeElement;
      closeVisibleDialogs();
      if(dialog===filterDialog&&desktop.matches)dialog.show();else dialog.showModal();
    }
    document.body.classList.toggle('modal-open',!(dialog===filterDialog&&desktop.matches));
    $('#custom-cursor').style.opacity = '0';
  }
  function restoreFocus() {
    if (lastFocus && lastFocus.isConnected && !lastFocus.closest('[hidden]')) lastFocus.focus({preventScroll:true});
  }
  function clearOverlayParams(p) {
    ['obra','foto','muestra'].forEach(key=>p.delete(key));
    return p;
  }
  async function dismissDialog(dialog) {
    if(dialog===workDialog&&dialog.open){
      const completed=await detailTransition.close();
      if(!completed)return;
    }
    if (dialog === filterDialog && desktop.matches) {
      writeState(params(), {replace:true});
      closeVisibleDialogs();
      restoreFocus();
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
  function openPhoto(id) {
    const p = clearOverlayParams(params()); p.set('pagina','galeria');p.set('foto',id);
    writeState(p,{overlay:'photo'});renderRoute();
  }
  function applyFiltersToPage() {
    allVisible = works.filter(work=>core.matches(work,applied,desktop.matches));
    const visibleSlugs = new Set(allVisible.map(work=>work.slug));
    works.forEach(work => { work.el.hidden = !visibleSlugs.has(work.slug); });
    $$('[data-student-for]', $('#student-list')).forEach(link => {
      link.closest('li').hidden = !visibleSlugs.has(link.dataset.studentFor);
    });
    $('#empty-state').hidden = allVisible.length > 0;
    $('#works').hidden = allVisible.length === 0;
    const count = applied.categories.length + (desktop.matches ? 0 : applied.students.length);
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
        card.style.gridRowEnd=desktop.matches?'auto':`span ${Math.ceil($('.work-link',card).getBoundingClientRect().height+30)}`;
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
  function renderFilterForm() {
    $$('input[name="categoria"]',filterDialog).forEach(input=>{input.checked=draft.categories.includes(input.value);});
    $$('input[name="alumno"]',filterDialog).forEach(input=>{input.checked=draft.students.includes(input.value);});
    $$('input[name="alumno"]',filterDialog).forEach(input=>{
      input.disabled=!input.checked&&draft.categories.length>0&&!works.some(work=>work.student===input.value&&draft.categories.includes(work.category));
    });
    $$('input[name="categoria"]',filterDialog).forEach(input=>{
      input.disabled=!desktop.matches&&!input.checked&&draft.students.length>0&&!works.some(work=>work.category===input.value&&draft.students.includes(work.student));
    });
    const count = works.filter(work=>core.matches(work,draft,desktop.matches)).length;
    $('#apply-filters').textContent = `Mostrar ${count} ${count===1?'obra':'obras'}`;
    const selected = draft.categories.length + (desktop.matches ? 0 : draft.students.length);
    $('#clear-filters').textContent=selected?`Borrar filtros (${selected})`:'Borrar filtros';
    $$('[data-category-count]',filterDialog).forEach(el=>{
      el.textContent=works.filter(work=>work.category===el.dataset.categoryCount && (desktop.matches || !draft.students.length || draft.students.includes(work.student))).length;
    });
    setFilterTab(desktop.matches ? 'categorias' : filterTab);
  }
  function setFilterTab(name) {
    filterTab=name;
    $$('.filter-tabs button').forEach(button=>{
      const active=button.dataset.filterTab===name;
      button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1;
    });
    $('#panel-categorias').hidden=name!=='categorias';
    $('#panel-alumnos').hidden=name!=='alumnos';
  }
  function openFilters() {
    draft={categories:[...applied.categories],students:[...applied.students]};
    renderFilterForm();
    writeState(params(),{overlay:'filters'});
    showDialog(filterDialog);
  }
  function commitFilters(replace = false) {
    const p=setFilterParams(params(),draft);
    writeState(p,{replace,overlay:desktop.matches&&filterDialog.open?'filters':null});
    applied={categories:[...draft.categories],students:[...draft.students]};
    applyFiltersToPage();
  }
  function clearAll() {
    draft={categories:[],students:[]};
    const p=setFilterParams(clearOverlayParams(params()),draft);
    writeState(p);
    renderRoute();
  }
  function activateWork(work) {
    if(activeSlug===work.slug)return;
    activeSlug=work.slug;
    workCards.forEach(card=>card.classList.toggle('is-active',card===work.el));
    $$('[data-student-for]').forEach(link=>link.setAttribute('aria-current',String(link.dataset.studentFor===work.slug)));
    // The names are an independent list: selection must never move rows under the pointer.
  }
  function renderWork(slug) {
    const work=works.find(item=>item.slug===slug);
    if (!work) return false;
    const wasOpen=workDialog.open;
    const snapshot=detailTransition.capture(work.el);
    currentWork=work;slideIndex=0;
    const listScroll=$('.detail-students').scrollTop;
    activateWork(work);
    $('#detail-title').textContent=work.title;
    $('#detail-description').textContent=work.description;
    $('#detail-author').textContent=work.author;
    $('#detail-category').textContent=labels[work.category];
    $('.detail-students h3').textContent=$('#student-heading').textContent;
    $('#detail-student-list').replaceChildren(...allVisible.map(item=>{
      const li=document.createElement('li');const a=document.createElement('a');
      a.href=`?obra=${encodeURIComponent(item.slug)}`;a.dataset.openWork=item.slug;a.dataset.studentFor=item.slug;
      a.textContent=item.author;a.setAttribute('aria-current',String(item===work));li.append(a);return li;
    }));
    $('.detail-students').scrollTop=listScroll;
    const research=safeMedia(work.research);
    $('#research-link').hidden=!research;
    $('#research-pending').hidden=Boolean(research);
    if (research) {$('#research-link').href=research;$('#research-link').setAttribute('download','');}
    showDialog(workDialog);
    renderSlide();
    if(wasOpen)detailTransition.change(snapshot);else detailTransition.open(snapshot);
    return true;
  }
  function renderSlide() {
    const media=$('#media-stage');media.replaceChildren();
    const slides=currentWork.images.filter(path=>safeMedia(path)).map(src=>({type:'image',src}));
    if(/^[a-zA-Z0-9_-]{11}$/.test(currentWork.youtube||''))slides.push({type:'video',src:currentWork.youtube});
    const total=slides.length;
    $('#media-counter').hidden=currentWork.imagePending||total===0;
    $('#media-prev').hidden=$('#media-next').hidden=total<2;
    $('#media-dots').hidden=total<2;
    $('#media-dots').replaceChildren();
    if(!total){media.textContent='Imagen pendiente';return;}
    slideIndex=(slideIndex+total)%total;
    const slide=slides[slideIndex];
    if(slide.type==='video') {
      const iframe=document.createElement('iframe');
      iframe.src=`https://www.youtube-nocookie.com/embed/${slide.src}?rel=0`;
      iframe.title=`Video de ${currentWork.title}`;iframe.allow='fullscreen; picture-in-picture; encrypted-media';
      iframe.referrerPolicy='strict-origin-when-cross-origin';iframe.allowFullscreen=true;media.append(iframe);
    } else {
      const img=document.createElement('img');img.src=safeMedia(slide.src);
      img.alt=currentWork.imagePending?'Imagen pendiente':`${currentWork.title} · imagen ${slideIndex+1}`;media.append(img);
    }
    $('#media-counter').textContent=`${slideIndex+1}/${total}`;
    $('#media-prev').hidden=$('#media-next').hidden=total<2;
    $('#media-dots').hidden=total<2;
    $('#media-dots').replaceChildren(...slides.map((item,index)=>{
      const button=document.createElement('button');button.type='button';
      button.setAttribute('aria-label',item.type==='video'?'Ver video':`Ver imagen ${index+1}`);
      button.setAttribute('aria-current',String(index===slideIndex));
      button.addEventListener('click',()=>{slideIndex=index;renderSlide();});return button;
    }));
  }
  function renderPhoto(id) {
    const button=$$('.gallery-item').find(item=>item.dataset.photo===id);
    if (!button) return false;
    const source=$('img',button);const img=$('#photo-image');
    img.src=source.src;img.alt=source.alt;$('#photo-caption').textContent=source.alt;
    showDialog($('#photo-dialog'));return true;
  }
  function updateCountdown() {
    const clock=core.countdown(Date.now());
    if (clock.ended) {
      countEnded=true;
      try {localStorage.setItem('artimanas-2026-ended','true');} catch (_) {}
    }
    for (const unit of ['days','hours','minutes','seconds']) $('#count-'+unit).textContent=String(clock[unit]).padStart(2,'0');
    const forced=params().get('pagina')==='countdown';
    const mode=!countEnded&&!clock.ended&&(clock.active||forced);
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
    const countMode=!countEnded&&!clock.ended&&(clock.active||requested==='countdown');
    effectivePage=countMode?'countdown':(requested==='countdown'?'inicio':requested);
    if (!['inicio','galeria','404','countdown'].includes(effectivePage)) effectivePage='404';
    if (!countMode && p.has('obra') && !works.some(work=>work.slug===p.get('obra'))) effectivePage='404';
    if (!countMode && p.has('foto') && !$$('.gallery-item').some(item=>item.dataset.photo===p.get('foto'))) effectivePage='404';
    closeVisibleDialogs();
    $$('[data-view]').forEach(view=>{view.hidden=view.dataset.view!==effectivePage;});
    $('#site-header').hidden=effectivePage==='countdown';
    $('#site-footer').hidden=!['inicio','galeria'].includes(effectivePage);
    $$('[data-page-link]').forEach(link=>{
      if(link.dataset.pageLink===effectivePage) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    document.title=effectivePage==='galeria'?'Galería · Artimañas 2026':effectivePage==='404'?'Página no encontrada · Artimañas 2026':'Artimañas 2026 · Muestra de arte interactivo';
    applied=core.readFilters(p,people);applyFiltersToPage();updateFilterVisibility();
    if(p.has('muestra')) showDialog($('#event-dialog'));
    else if(effectivePage==='inicio' && p.has('obra')) renderWork(p.get('obra'));
    else if(effectivePage==='galeria' && p.has('foto')) renderPhoto(p.get('foto'));
    else if(history.state?.overlay==='filters'&&effectivePage==='inicio') {draft={categories:[...applied.categories],students:[...applied.students]};renderFilterForm();showDialog(filterDialog);}
    else if(history.state?.overlay==='menu') showDialog($('#menu-dialog'));
    if(oldPage!==effectivePage) window.scrollTo({top:0,behavior:'instant'});
  }
  function updateFilterVisibility() {
    const rect=$('#obras').getBoundingClientRect();
    const button=$('#filter-trigger');
    const footer=$('#site-footer');
    const atFooter=!footer.hidden&&footer.getBoundingClientRect().top<innerHeight-100;
    const visible=effectivePage==='inicio'&&window.scrollY>48&&(atFooter||rect.top<innerHeight*.65)&&!document.body.classList.contains('modal-open');
    const action=atFooter?'top':'filters';
    const changed=button.dataset.action!==action;
    button.dataset.action=action;
    const count=applied.categories.length+(desktop.matches?0:applied.students.length);
    $('span',button).textContent=atFooter?'Ir arriba':count?`Filtrar (${count})`:'Filtrar';
    $('path',button).setAttribute('d',atFooter?'M12 20V4m-7 7 7-7 7 7':'M4 7h16M7 12h10M10 17h4');
    if(atFooter){button.removeAttribute('aria-haspopup');button.removeAttribute('aria-controls');}
    else {button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','filter-dialog');}
    if(changed&&visible&&!matchMedia('(prefers-reduced-motion:reduce)').matches)button.animate([{opacity:0,translate:'0 8px'},{opacity:1,translate:'0 0'}],{duration:300,easing:'ease-out'});
    button.hidden=effectivePage!=='inicio';
    button.classList.toggle('is-visible',visible);
    button.inert=!visible;
    button.setAttribute('aria-hidden',String(!visible));
  }
  // Desplazamiento del listado: duración por distancia, aceleración y frenado continuos.
  let catalogScrollFrame=null,catalogEntryRunning=false,entryArmed=window.scrollY<=8,touchScrolling=false;
  function updateCatalogAccess(){
    const locked=window.scrollY<=8||catalogEntryRunning;
    $('#works').inert=locked;
    $('#student-list').inert=locked;
    $('#obras').dataset.entering=String(catalogEntryRunning);
    document.dispatchEvent(new Event('catalogentrychange'));
  }
  function cancelCatalogScroll(){
    if(catalogScrollFrame!==null)cancelAnimationFrame(catalogScrollFrame);
    catalogScrollFrame=null;
    catalogEntryRunning=false;
    updateCatalogAccess();
  }
  function animateCatalogScroll(destination,onComplete){
    cancelCatalogScroll();
    const start=window.scrollY;
    const limit=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    const end=Math.max(0,Math.min(destination,limit));
    const distance=end-start;
    const complete=()=>{
      catalogScrollFrame=null;
      onComplete?.();
    };
    if(Math.abs(distance)<1){
      catalogScrollFrame=requestAnimationFrame(complete);
      return;
    }
    const duration=Math.min(1600,650+Math.sqrt(Math.abs(distance))*12);
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
  function enterCatalog(){
    if(effectivePage!=='inicio'||dialogs.some(dialog=>dialog.open)||!allVisible.length)return;
    const first=allVisible[0].el;
    const rect=(desktop.matches?first:$('.work-link',first)).getBoundingClientRect();
    const destination=window.scrollY+rect.top+rect.height/2-innerHeight/2;
    entryArmed=false;
    animateCatalogScroll(destination,()=>{catalogEntryRunning=false;updateCatalogAccess();});
    catalogEntryRunning=true;updateCatalogAccess();
  }
  function revealWorkFromName(slug){
    const work=works.find(item=>item.slug===slug);
    if(!work||work.el.hidden)return;
    const rect=work.el.getBoundingClientRect();
    const destination=window.scrollY+rect.top+rect.height/2-innerHeight/2;
    animateCatalogScroll(destination,()=>{
      if(effectivePage==='inicio'&&!work.el.hidden&&!dialogs.some(dialog=>dialog.open))openWork(slug);
    });
  }
  // La columna tiene scroll propio: solo los nombres conservan esa interacción.
  // Sobre su fondo, la rueda debe continuar el recorrido principal de obras.
  $('.student-sidebar').addEventListener('wheel',event=>{
    if(!desktop.matches||effectivePage!=='inicio'||document.body.classList.contains('modal-open'))return;
    if(event.ctrlKey||event.metaKey||event.shiftKey||!event.cancelable)return;
    if(event.target.closest('#student-list a')||Math.abs(event.deltaX)>Math.abs(event.deltaY)||!event.deltaY)return;
    event.preventDefault();
    cancelCatalogScroll();
    const unit=event.deltaMode===1?16:event.deltaMode===2?innerHeight:1;
    window.scrollBy({top:event.deltaY*unit,behavior:'instant'});
  },{passive:false});
  window.addEventListener('wheel',event=>{
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
  window.addEventListener('resize',cancelCatalogScroll,{passive:true});
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
    event.preventDefault();name.focus({preventScroll:true});
  });
  document.addEventListener('click',event=>{
    const target=event.target.closest('a,button');if(!target)return;
    if(target.dataset.openWork){
      event.preventDefault();
      if(target.closest('#obras')&&(window.scrollY<=8||catalogEntryRunning))return;
      if(target.closest('#student-list'))revealWorkFromName(target.dataset.openWork);
      else openWork(target.dataset.openWork);
    }
    else if(target.hasAttribute('data-open-event')){event.preventDefault();openEvent();}
    else if(target.dataset.pageLink){event.preventDefault();navigate(target.dataset.pageLink);}
    else if(target.hasAttribute('data-close-dialog')) dismissDialog(target.closest('dialog'));
    else if(target.hasAttribute('data-open-menu')) {writeState(params(),{overlay:'menu'});showDialog($('#menu-dialog'));}
    else if(target.hasAttribute('data-photo')) openPhoto(target.dataset.photo);
    else if(target.hasAttribute('data-clear-all')) clearAll();
    else if(target.hasAttribute('data-back-top')) {event.preventDefault();window.scrollTo({top:0,behavior:'smooth'});}
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
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&filterDialog.open&&desktop.matches){event.preventDefault();dismissDialog(filterDialog);}});
  $('#filter-trigger').addEventListener('click',()=>{
    if($('#filter-trigger').dataset.action==='top')animateCatalogScroll(0);else openFilters();
  });
  filterDialog.addEventListener('change',()=>{
    draft.categories=$$('input[name="categoria"]:checked',filterDialog).map(input=>input.value);
    draft.students=$$('input[name="alumno"]:checked',filterDialog).map(input=>input.value);
    renderFilterForm();if(desktop.matches)commitFilters(true);
  });
  $('#apply-filters').addEventListener('click',()=>{
    writeState(setFilterParams(params(),draft),{replace:true});renderRoute();restoreFocus();
  });
  $('#clear-filters').addEventListener('click',()=>{
    draft={categories:[],students:[]};renderFilterForm();if(desktop.matches)commitFilters(true);
  });
  $$('[data-filter-tab]').forEach(tab=>tab.addEventListener('click',()=>setFilterTab(tab.dataset.filterTab)));
  $('.filter-tabs').addEventListener('keydown',event=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();setFilterTab(event.key==='Home'?'categorias':event.key==='End'?'alumnos':filterTab==='categorias'?'alumnos':'categorias');
    $(`[data-filter-tab="${filterTab}"]`).focus();
  });
  $('#media-prev').addEventListener('click',()=>{slideIndex--;renderSlide();});
  $('#media-next').addEventListener('click',()=>{slideIndex++;renderSlide();});
  workDialog.addEventListener('keydown',event=>{
    if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();slideIndex+=event.key==='ArrowLeft'?-1:1;renderSlide();}
  });
  let swipeX=null;
  $('#media-stage').addEventListener('touchstart',event=>{swipeX=event.changedTouches[0].clientX;},{passive:true});
  $('#media-stage').addEventListener('touchend',event=>{const diff=event.changedTouches[0].clientX-swipeX;if(swipeX!==null&&Math.abs(diff)>50){slideIndex+=diff<0?1:-1;renderSlide();}swipeX=null;},{passive:true});
  // Scroll nativo: no se captura wheel ni se fuerza un salto entre obras.
  // Primero medir todas las filas, luego escribir estilos para evitar layout thrashing.
  function updateScrollFocus() {
    if(!desktop.matches||effectivePage!=='inicio'||workDialog.open||!allVisible.length)return;
    const center=innerHeight/2;
    const measures=allVisible.map(work=>{const r=work.el.getBoundingClientRect();return {work,distance:Math.abs(r.top+r.height/2-center)};});
    let nearest=measures[0];
    for(const item of measures){if(item.distance<nearest.distance)nearest=item;}
    for(const {work,distance} of measures){
      const focus=Math.exp(-Math.pow(distance/(innerHeight*.32),2));
      work.el.style.setProperty('--work-opacity',(0.14+0.86*Math.pow(focus,4)).toFixed(3));
      work.el.style.setProperty('--work-scale',(0.84+0.54*Math.pow(focus,3)).toFixed(3));
    }
    activateWork(nearest.work);
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
    if(filterDialog.open){synchronizing=true;filterDialog.close();synchronizing=false;showDialog(filterDialog);}
    applyFiltersToPage();if(filterDialog.open){draft={categories:[...applied.categories],students:[...applied.students]};renderFilterForm();}updateFilterVisibility();
  });
  window.addEventListener('resize',layoutCards,{passive:true});
  window.addEventListener('resize',updateFilterVisibility,{passive:true});
  new MutationObserver(updateFilterVisibility).observe(document.body,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(updateFilterVisibility).observe($('#obras'));
  $$('.work-card img').forEach(img=>img.addEventListener('load',layoutCards));
  document.fonts?.ready.then(layoutCards);
  window.addEventListener('popstate',()=>{renderRoute();if(!dialogs.some(d=>d.open))restoreFocus();});
  if(!history.state?.app){try{history.replaceState({app:'artimanas',overlay:null},'');}catch(_){}}
  updateCountdown();renderRoute();updateCatalogAccess();setInterval(updateCountdown,1000);
})();

