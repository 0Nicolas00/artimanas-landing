/* Cover-to-catalog attention: mouse proximity and keyboard focus are independent. */
(() => {
  'use strict';
  const hero=document.querySelector('.hero'),catalog=document.querySelector('#obras');
  if(!hero||!catalog)return;
  const finePointer=matchMedia('(hover:hover) and (pointer:fine)');
  let pointerY=null,pending=false,keyboard=false;
  const clamp=value=>Math.max(0,Math.min(1,value));
  function update(){
    pending=false;
    if(hero.closest('[hidden]')||document.querySelector('dialog[open]'))return;
    const rect=hero.getBoundingClientRect();
    const progress=clamp(-rect.top/Math.max(1,rect.height*.55));
    let proximity=0;
    if(finePointer.matches&&pointerY!==null&&rect.bottom>0){
      const t=clamp((pointerY-(rect.bottom-160))/200);
      proximity=t*t*(3-2*t);
    }
    const focus=keyboard&&catalog.contains(document.activeElement)?1:0;
    const attention=Math.max(progress,proximity,focus);
    catalog.style.setProperty('--catalog-opacity',(.42+.58*attention).toFixed(3));
    catalog.style.setProperty('--preview-image-opacity',(.42*(1-progress)).toFixed(3));
    catalog.style.setProperty('--preview-name-blur',`${(2.4*(1-progress)).toFixed(2)}px`);
    hero.style.setProperty('--hero-dim',(.38*attention).toFixed(3));
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
  function pointer(event){
    keyboard=false;pointerY=event.pointerType==='mouse'?event.clientY:null;schedule();
  }
  document.addEventListener('pointermove',pointer,{passive:true});
  document.addEventListener('pointerover',pointer,{passive:true});
  document.addEventListener('pointerleave',()=>{pointerY=null;schedule();});
  document.addEventListener('keydown',event=>{if(event.key==='Tab'){keyboard=true;schedule();}});
  window.addEventListener('blur',()=>{pointerY=null;schedule();});
  window.addEventListener('focus',schedule);
  window.addEventListener('scroll',schedule,{passive:true});
  window.addEventListener('resize',schedule,{passive:true});
  document.addEventListener('catalogentrychange',schedule);
  catalog.addEventListener('focusin',schedule);
  catalog.addEventListener('focusout',schedule);
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['class']});
  new ResizeObserver(schedule).observe(hero);
  update();
})();
