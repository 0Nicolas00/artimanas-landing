/* Decorative fine-pointer cursor; native focus and links remain accessible. */
(() => {
  'use strict';
  const cursor=document.querySelector('#custom-cursor');
  const label=cursor?.querySelector('.cursor-label');
  if(!cursor||!label)return;
  const fine=matchMedia('(hover:hover) and (pointer:fine)');
  let expanded=false,pop=null,lastPoint=null,scrollFrame=0;
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
      labelMotion=label.animate([{opacity:0},{opacity:1}],{duration:110,delay:expanded&&parseFloat(getComputedStyle(cursor).width)<55?80:0,easing:'ease-out',fill:'forwards'});
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
    document.documentElement.classList.remove('has-custom-cursor');
  }
  function update(target){
    if(!fine.matches||document.querySelector('dialog[open]')){hide();return;}
    if(!lastPoint)return;
    document.documentElement.classList.add('has-custom-cursor');
    const card=target?.closest('.work-link,.gallery-item');
    const preview=Boolean(target?.closest('#obras.is-cover'));
    setExpanded(preview||Boolean(card));
    setLabel(preview?'Bajá para\nver más':card?(card.classList.contains('gallery-item')?'Ampliar':'Ver obra'):'',preview);
    cursor.style.left=`${lastPoint.x}px`;cursor.style.top=`${lastPoint.y}px`;
    cursor.style.opacity='1';
  }
  function trackPointer(event){
    if(event.pointerType!=='mouse'){hide();return;}
    lastPoint={x:event.clientX,y:event.clientY};update(event.target);
  }
  document.addEventListener('pointermove',trackPointer,{passive:true});
  document.addEventListener('pointerover',trackPointer,{passive:true});
  document.addEventListener('pointerleave',hide);
  window.addEventListener('blur',hide);
  window.addEventListener('scroll',()=>{
    if(scrollFrame||!lastPoint)return;
    scrollFrame=requestAnimationFrame(()=>{
      scrollFrame=0;
      if(lastPoint)update(document.elementFromPoint(lastPoint.x,lastPoint.y));
    });
  },{passive:true});
  document.addEventListener('catalogpreviewchange',()=>{if(lastPoint)update(document.elementFromPoint(lastPoint.x,lastPoint.y));});
  fine.addEventListener('change',hide);
  new MutationObserver(()=>{if(document.querySelector('dialog[open]'))hide();})
    .observe(document.body,{attributes:true,attributeFilter:['class']});
})();
