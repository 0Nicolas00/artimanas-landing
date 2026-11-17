/* Estado de entrada al catálogo; las fotos conservan opacidad y escala originales. */
(() => {
  'use strict';
  const hero=document.querySelector('.hero'),catalog=document.querySelector('#obras');
  if(!hero||!catalog)return;
  let pending=false;
  function update(){
    pending=false;
    if(hero.closest('[hidden]')||document.querySelector('dialog[open]'))return;
    const rect=hero.getBoundingClientRect();
    const progress=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height*.55)));
    const cover=window.scrollY<=8&&catalog.dataset.entering!=='true';
    if(catalog.classList.contains('is-cover')!==cover){
      catalog.classList.toggle('is-cover',cover);
      document.dispatchEvent(new Event('catalogpreviewchange'));
    }
    const preview=progress<.85;
    if(catalog.classList.contains('is-preview')!==preview){
      catalog.classList.toggle('is-preview',preview);
      document.dispatchEvent(new Event('catalogpreviewchange'));
    }
  }
  function schedule(){if(!pending){pending=true;requestAnimationFrame(update);}}
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('catalogentrychange',schedule);
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(schedule).observe(hero);
  update();
})();
