/* Follow the native cursor and show the contextual prompts for mouse users. */
(() => {
  'use strict';
  const cursor=document.querySelector('#custom-cursor');
  const label=cursor?.querySelector('.cursor-label');
  if(!cursor||!label)return;
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const gap=8;
  let expanded=false,pop=null,lastPoint=null,scrollFrame=0;
  let x=0,y=0,followFrame=0;
  function place(){
    const radius=cursor.offsetWidth/2;
    const offset=radius+gap;
    const centerX=Math.max(radius,Math.min(document.documentElement.clientWidth-radius,x+offset));
    const centerY=Math.max(radius,Math.min(innerHeight-radius,y+offset));
    cursor.style.transform=`translate3d(${centerX}px, ${centerY}px, 0)`;
  }
  function follow(){
    followFrame=0;
    if(!lastPoint)return;
    const settled=reduce.matches||Math.hypot(lastPoint.x-x,lastPoint.y-y)<.35;
    const amount=settled?1:.2;
    x+=(lastPoint.x-x)*amount;
    y+=(lastPoint.y-y)*amount;
    place();
    if(!settled||pop?.playState==='running')followFrame=requestAnimationFrame(follow);
  }
  let labelMotion=null,labelVersion=0,labelKey='';
  function setLabel(text,scroll=false){
    const key=`${scroll}:${text}`;
    if(key===labelKey)return;
    labelKey=key;const version=++labelVersion;
    const opacity=getComputedStyle(label).opacity;
    labelMotion?.cancel();
    const reveal=()=>{
      if(version!==labelVersion)return;
      labelMotion?.cancel();
      label.textContent=text;cursor.classList.toggle('is-scroll',scroll);
      if(!text){label.style.opacity='0';return;}
      label.style.opacity='1';
      labelMotion=label.animate([{opacity:0},{opacity:1}],{duration:110,delay:expanded&&parseFloat(getComputedStyle(cursor).width)<55?80:0,easing:'ease-out',fill:'both'});
    };
    if(label.textContent&&Number(opacity)>.01){
      labelMotion=label.animate([{opacity},{opacity:0}],{duration:65,easing:'ease-out',fill:'forwards'});
      labelMotion.finished.then(reveal).catch(()=>{});
    }else reveal();
  }
  function setExpanded(next){
    if(next===expanded)return;
    // Read the animated size before cancelling: fast re-entry stays smooth.
    const size=parseFloat(getComputedStyle(cursor).width);
    pop?.cancel();expanded=next;
    cursor.classList.toggle('is-expanded',next);
    // The short cursor pop is intentional even with reduced motion.
    const end=next?90:12,overshoot=next?101:8;
    pop=cursor.animate([
      {width:`${size}px`,height:`${size}px`,offset:0,easing:'cubic-bezier(.4,0,.2,1)'},
      {width:`${overshoot}px`,height:`${overshoot}px`,offset:.7,easing:'cubic-bezier(.25,0,.25,1)'},
      {width:`${end}px`,height:`${end}px`,offset:1}
    ],{duration:next?560:440});
  }
  function hide(){
    labelVersion++;labelMotion?.cancel();labelMotion=null;labelKey='';
    label.textContent='';label.style.opacity='0';cursor.classList.remove('is-scroll');
    pop?.cancel();pop=null;expanded=false;cursor.classList.remove('is-expanded');
    cursor.style.opacity='0';lastPoint=null;
    cancelAnimationFrame(followFrame);followFrame=0;
  }
  function update(target){
    if(!fine.matches||document.querySelector('dialog[open]:not(.filter-dialog)')){hide();return;}
    if(!lastPoint)return;
    const card=target?.closest('.work-link,.gallery-item');
    const preview=Boolean(target?.closest('#cover-entry'));
    setExpanded(preview||Boolean(card));
    setLabel(preview?'Bajá para\nver más':card?(card.classList.contains('gallery-item')?'Ampliar':'Ver obra'):'',preview);
    if(!followFrame)followFrame=requestAnimationFrame(follow);
    cursor.style.opacity='1';
  }
  function trackPointer(event){
    if(event.pointerType!=='mouse'){hide();return;}
    const first=!lastPoint;
    lastPoint={x:event.clientX,y:event.clientY};
    if(first){
      ({x,y}=lastPoint);
      place();
    }
    update(event.target);
  }
  document.addEventListener('pointermove',trackPointer,{passive:true});
  document.addEventListener('pointerover',trackPointer,{passive:true});
  document.addEventListener('pointerleave',hide);
  document.documentElement.addEventListener('pointerleave',hide);
  window.addEventListener('blur',hide);
  window.addEventListener('scroll',()=>{
    if(scrollFrame||!lastPoint)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;
      if(lastPoint)update(document.elementFromPoint(lastPoint.x,lastPoint.y));
    });
  },{passive:true});
  document.addEventListener('catalogpreviewchange',()=>{if(lastPoint)update(document.elementFromPoint(lastPoint.x,lastPoint.y));});
  window.addEventListener('resize',()=>{if(lastPoint&&!followFrame)followFrame=requestAnimationFrame(follow);},{passive:true});
  fine.addEventListener('change',hide);
  new MutationObserver(()=>{if(document.querySelector('dialog[open]:not(.filter-dialog)'))hide();})
    .observe(document.body,{attributes:true,attributeFilter:['class']});
})();
