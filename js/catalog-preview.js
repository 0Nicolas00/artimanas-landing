/* Estado de entrada al catálogo; las fotos conservan opacidad y escala originales. */
(() => {
  'use strict';
  const hero=document.querySelector('.hero'),catalog=document.querySelector('#obras');
  if(!hero||!catalog)return;
  const band=hero.querySelector('.marquee');
  const entry=document.querySelector('#cover-entry');
  let pending=false;
  function update(){
    pending=false;
    if(hero.closest('[hidden]')||document.querySelector('dialog[open]')){
      entry.hidden=true;
      return;
    }
    const rect=hero.getBoundingClientRect();
    const progress=Math.max(0,Math.min(1,-rect.top/Math.max(1,rect.height*.55)));
    catalog.style.setProperty('--preview-blur',`${(3.2*(1-progress)).toFixed(2)}px`);
    catalog.style.setProperty('--preview-opacity',(.27+.73*progress).toFixed(3));
    const first=catalog.querySelector('.student-list li:not([hidden])');
    catalog.querySelectorAll('.is-preview-first').forEach(item=>{if(item!==first)item.classList.remove('is-preview-first');});
    first?.classList.add('is-preview-first');
    const cover=window.scrollY<=8&&catalog.dataset.entering!=='true';
    const bandTop=band.getBoundingClientRect().top;
    entry.hidden=!cover||Boolean(document.documentElement.dataset.heroIntro)
      ||catalog.querySelector('.works').hidden||bandTop>=innerHeight;
    if(!entry.hidden)entry.style.top=`${Math.max(0,bandTop)}px`;
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
  new MutationObserver(schedule).observe(document.documentElement,{attributes:true,attributeFilter:['data-hero-intro']});
  new MutationObserver(schedule).observe(catalog.querySelector('.student-list'),{subtree:true,attributes:true,attributeFilter:['hidden']});
  new ResizeObserver(schedule).observe(hero);
  update();
})();
