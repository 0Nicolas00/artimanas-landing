/* Choreography shared by both directions of the work detail transition. */
(() => {
  'use strict';
  const dialog=document.querySelector('#work-dialog');
  const panel=dialog?.querySelector('.media-panel');
  if(!dialog||!panel)return;
  const detail=dialog.querySelector('.work-detail');
  const names=dialog.querySelector('#detail-student-list');
  const copy=dialog.querySelector('.detail-copy');
  const media=dialog.querySelector('.media-stage');
  const catalog=document.querySelector('#contenido');
  const desktop=matchMedia('(min-width:1101px)');
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  const forcedColors=matchMedia('(forced-colors:active)');
  const motion={duration:880,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
  const veil=document.createElement('div');
  veil.className='detail-veil';veil.setAttribute('aria-hidden','true');
  dialog.prepend(veil);

  const animations=new Set(),hiddenSources=new Set();
  let revision=0,ghost=null,activeCard=null,closing=null;
  const running=token=>token===revision&&dialog.open;
  const finished=animation=>animation.finished.catch(()=>null);
  function animate(element,frames,options){
    const animation=element.animate(frames,options);
    animations.add(animation);
    return finished(animation);
  }
  function clearAnimations(){
    animations.forEach(animation=>animation.cancel());animations.clear();
  }
  function reverseAnimations(){
    return Promise.all([...animations].map(animation=>{
      animation.reverse();
      return finished(animation);
    }));
  }
  function clearFlight(){
    ghost?.remove();ghost=null;media.classList.remove('is-moving');
  }
  function cancel(){
    revision++;closing=null;
    clearAnimations();clearFlight();
  }
  function hideSource(source){
    source.element.classList.add('detail-source-hidden');hiddenSources.add(source.element);
  }
  function restoreSources(){
    hiddenSources.forEach(element=>element.classList.remove('detail-source-hidden'));hiddenSources.clear();
  }
  function reset(){
    cancel();restoreSources();
    activeCard=null;detail.inert=false;
    dialog.removeAttribute('data-phase');
    delete dialog.dataset.scrollbarExiting;
  }
  function capture(card){
    const img=card?.querySelector('img');
    const selected=img?{
      element:img,src:img.currentSrc||img.src,rect:img.getBoundingClientRect(),
      opacity:Number(getComputedStyle(img).opacity),naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight
    }:null;
    return {card,selected};
  }
  function image(src){
    const img=document.createElement('img');
    img.src=src;img.alt='';
    return img;
  }
  function onScreen(rect){
    return rect&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
  }
  function containedRect(img,source){
    const rect=img.getBoundingClientRect();
    const naturalWidth=img.naturalWidth||source.naturalWidth;
    const naturalHeight=img.naturalHeight||source.naturalHeight;
    if(!naturalWidth||!naturalHeight)return rect;
    const scale=Math.min(rect.width/naturalWidth,rect.height/naturalHeight);
    const width=naturalWidth*scale,height=naturalHeight*scale;
    return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};
  }
  function moveImage(source,track,options){
    const target=media.querySelector(':scope > img');
    if(!target||!onScreen(source?.rect))return false;
    const end=containedRect(target,source);
    if(!end.width||!end.height||end.top>=innerHeight||end.top+end.height<=0)return false;
    media.classList.add('is-moving');
    hideSource(source);
    ghost=document.createElement('div');ghost.className='detail-moving-image';ghost.setAttribute('aria-hidden','true');
    Object.assign(ghost.style,{left:`${end.left}px`,top:`${end.top}px`,width:`${end.width}px`,height:`${end.height}px`});
    ghost.append(image(source.src));dialog.append(ghost);
    const start=source.rect;
    const x=start.left+start.width/2-(end.left+end.width/2);
    const y=start.top+start.height/2-(end.top+end.height/2);
    const transform=`translate(${x}px,${y}px) scale(${start.width/end.width},${start.height/end.height})`;
    track(ghost,[{transform,opacity:source.opacity,borderRadius:'0px'},{transform:'none',opacity:1,borderRadius:'8px'}],options);
    const detailSrc=target.currentSrc||target.src;
    if(detailSrc!==source.src){
      const slide=image(detailSrc);
      ghost.append(slide);
      track(slide,[{opacity:0},{opacity:0,offset:.76},{opacity:1}],options);
    }
    return true;
  }
  function returnNameOffset(){
    if(!desktop.matches)return null;
    const source=catalog.querySelector('#student-list [aria-current="true"]');
    const target=names.querySelector('[aria-current="true"]');
    if(!source||!target)return null;
    return source.getBoundingClientRect().left-target.getBoundingClientRect().left;
  }
  function compose(snapshot,nameOffset,reverse=false){
    const move={...motion,duration:reverse?660:motion.duration};
    const reveal={...move,delay:80};
    const total=reveal.delay+reveal.duration;
    const tasks=[];
    function track(element,frames,options){
      const delay=options.delay??0;
      const endDelay=total-delay-options.duration;
      tasks.push(animate(element,frames,reverse
        ? {...options,delay:endDelay,endDelay:delay,direction:'reverse'}
        : {...options,endDelay}));
    }
    track(veil,[{opacity:0},{opacity:1}],{...motion,duration:move.duration});
    if(Math.abs(nameOffset)>.5){
      track(names,[{transform:`translateX(${nameOffset}px)`},{transform:'none'}],move);
    }
    track(copy,[{transform:'translateX(-100%)',opacity:0},{transform:'translateX(0)',opacity:1}],reveal);
    if(!moveImage(snapshot.selected,track,move)){
      track(media,[{opacity:0,transform:'translateX(-28px) scale(.96)'},{opacity:1,transform:'none'}],reveal);
    }
    for(const control of dialog.querySelectorAll('.dialog-close,.detail-students h3,.media-arrow,.media-counter,.media-dots,.media-download')){
      track(control,[{opacity:0},{}],{...motion,duration:300,delay:80});
    }
    if(!reverse&&!reducedMotion.matches&&!forcedColors.matches){
      track(dialog,[{scrollbarColor:'transparent transparent'},{scrollbarColor:'var(--text-muted) transparent'}],{
        ...motion,duration:400,delay:120
      });
    }
    return Promise.all(tasks);
  }
  async function open(snapshot,nameOffset){
    cancel();const token=revision;
    activeCard=snapshot.card;
    dialog.dataset.phase='composing';
    await compose(snapshot,nameOffset);
    if(!running(token))return;
    dialog.dataset.phase='settled';
    clearAnimations();clearFlight();
  }
  async function change(){
    cancel();const token=revision;
    restoreSources();
    dialog.dataset.phase='changing';
    await animate(media,[{opacity:0,transform:'translateX(-32px)'},{opacity:1,transform:'none'}],{duration:480,easing:motion.easing});
    if(!running(token))return;
    dialog.dataset.phase='settled';clearAnimations();
  }
  async function hideScrollbar(start){
    const entry=[...animations].find(animation=>animation.effect.target===dialog);
    const alreadyHidden=entry?.effect.getComputedTiming().progress===0;
    entry?.cancel();
    animations.delete(entry);
    if(alreadyHidden||!start||start==='auto'||reducedMotion.matches||forcedColors.matches)return;
    if(![dialog,names.parentElement,copy].some(element=>element.clientHeight>0&&element.scrollHeight>element.clientHeight))return;
    animations.forEach(animation=>animation.pause());
    const fade=dialog.animate([{scrollbarColor:start},{scrollbarColor:'transparent transparent'}],{
      ...motion,duration:220,easing:'ease-out'
    });
    animations.add(fade);
    await finished(fade);
    fade.cancel();animations.delete(fade);
  }
  async function leave(){
    const phase=dialog.dataset.phase,token=++revision;
    const scrollbarColor=getComputedStyle(dialog).scrollbarColor;
    dialog.dataset.scrollbarExiting='';detail.inert=true;
    await hideScrollbar(scrollbarColor);
    if(!running(token))return false;
    dialog.dataset.phase='closing';
    if(phase==='composing'){
      await reverseAnimations();
    }else{
      clearAnimations();clearFlight();restoreSources();
      await compose(capture(activeCard),returnNameOffset(),true);
    }
    return running(token);
  }
  function close(){
    if(!closing)closing=leave();
    return closing;
  }
  window.ArtimanasWorkTransition={capture,open,change,close,reset};
})();
