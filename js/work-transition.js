/* Detail choreography: move images into place, reveal the sheet, then blur.
   Kept separate from routing, filters and artwork data. */
(() => {
  'use strict';
  const dialog=document.querySelector('#work-dialog');
  const panel=dialog?.querySelector('.media-panel');
  if(!dialog||!panel)return;
  // These user-triggered transitions are part of the requested interaction.
  const motion={duration:880,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
  const desktop=matchMedia('(min-width:1101px)');
  const background=document.createElement('div');
  background.className='detail-background';background.setAttribute('aria-hidden','true');
  panel.prepend(background);
  const veil=document.createElement('div');
  veil.className='detail-veil';veil.setAttribute('aria-hidden','true');dialog.prepend(veil);
  let animations=new Set(),hiddenSources=new Set(),revision=0,ghost=null,closing=false;
  function hideSource(source){
    if(!source?.element)return;
    source.element.classList.add('detail-source-hidden');hiddenSources.add(source.element);
  }
  function restoreSources(){
    hiddenSources.forEach(element=>element.classList.remove('detail-source-hidden'));hiddenSources.clear();
  }

  function animate(element,frames,options){
    const animation=element.animate(frames,options);
    animations.add(animation);
    return animation.finished.catch(()=>null);
  }
  function cancel(){
    revision++;
    animations.forEach(animation=>animation.cancel());animations.clear();
    ghost?.remove();ghost=null;closing=false;
  }
  function reset(){
    cancel();restoreSources();background.replaceChildren();
    document.body.classList.remove('work-detail-open');
    dialog.removeAttribute('data-phase');
    dialog.querySelector('.media-stage')?.classList.remove('is-moving');
  }
  function capture(card){
    const visible=[...document.querySelectorAll('.work-card:not([hidden])')];
    const index=visible.indexOf(card);
    const snapshot=element=>{
      const img=element?.querySelector('img');
      if(!img)return null;
      return {element:img,src:img.currentSrc||img.src,rect:img.getBoundingClientRect(),opacity:getComputedStyle(img).opacity,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};
    };
    return {selected:snapshot(card),neighbors:[snapshot(visible[index-1]),snapshot(visible[index+1])]};
  }
  function addNeighbors(snapshot){
    background.replaceChildren();
    // Mobile keeps the real grid stationary; only the selected photo moves.
    if(!desktop.matches)return [];
    return (snapshot?.neighbors||[]).flatMap((source,index)=>{
      if(!source)return [];
      const img=document.createElement('img');img.src=source.src;img.alt='';
      img.className=`detail-neighbor neighbor-${index}`;background.append(img);
      return [{img,source}];
    });
  }
  function onScreen(rect){return rect&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;}
  function clearAnimations(){
    animations.forEach(animation=>animation.cancel());animations.clear();
  }
  async function blurBackground(token){
    dialog.dataset.phase='blurring';
    const options={duration:900,easing:'cubic-bezier(.4,0,.2,1)',fill:'both'};
    const tasks=desktop.matches ? [
      animate(veil,[{opacity:0},{opacity:1}],options),
      ...[...background.children].map(img=>animate(img,[
        {filter:'blur(0px)',opacity:.25},
        {filter:'blur(20px)',opacity:.13}
      ],options))
    ] : [animate(veil,[
      {backdropFilter:'blur(0px)',backgroundColor:'rgba(17,9,16,0)'},
      {backdropFilter:'blur(12px)',backgroundColor:'rgba(17,9,16,.72)'}
    ],options)];
    await Promise.all(tasks);
    if(token!==revision||!dialog.open)return;
    dialog.dataset.phase='settled';clearAnimations();
  }
  function containedRect(img,source){
    const rect=img.getBoundingClientRect();
    const naturalWidth=img.naturalWidth||source?.naturalWidth;
    const naturalHeight=img.naturalHeight||source?.naturalHeight;
    if(!naturalWidth||!naturalHeight)return rect;
    const scale=Math.min(rect.width/naturalWidth,rect.height/naturalHeight);
    const width=naturalWidth*scale,height=naturalHeight*scale;
    return {left:rect.left+(rect.width-width)/2,top:rect.top+(rect.height-height)/2,width,height};
  }
  function moveImage(source,target){
    if(!source||!onScreen(source.rect)||!target)return Promise.resolve();
    const end=containedRect(target,source),start=source.rect;
    const stage=dialog.querySelector('.media-stage');stage.classList.add('is-moving');
    hideSource(source);
    ghost=document.createElement('img');ghost.src=source.src;ghost.alt='';
    ghost.className='detail-moving-image';dialog.append(ghost);
    return animate(ghost,[
      {left:`${start.left}px`,top:`${start.top}px`,width:`${start.width}px`,height:`${start.height}px`,opacity:1,borderRadius:'0px'},
      {left:`${end.left}px`,top:`${end.top}px`,width:`${end.width}px`,height:`${end.height}px`,opacity:1,borderRadius:'8px'}
    ],motion);
  }
  function open(snapshot){
    cancel();const token=revision;
    const neighbors=addNeighbors(snapshot);
    document.body.classList.add('work-detail-open');
    dialog.dataset.phase='composing';
    const tasks=[];
    const copy=dialog.querySelector('.detail-copy');
    tasks.push(animate(copy,[
      {transform:'translateX(-100%)',opacity:0},
      {transform:'translateX(0)',opacity:1}
    ],{...motion,delay:80}));
    for(const {img,source} of neighbors){
      hideSource(source);
      const end=img.getBoundingClientRect(),start=source.rect;
      const transform=onScreen(start)?`translate(${start.left-end.left}px,${start.top-end.top}px) scale(${start.width/end.width},${start.height/end.height})`:'translateY(35px) scale(.94)';
      tasks.push(animate(img,[{transform,opacity:Number(source.opacity)},{transform:'none',opacity:.25}],motion));
    }
    tasks.push(moveImage(snapshot?.selected,dialog.querySelector('.media-stage img')));
    const media=dialog.querySelector('.media-stage');
    if(!media.classList.contains('is-moving'))tasks.push(animate(media,[{opacity:0,transform:'translateX(-28px) scale(.96)'},{opacity:1,transform:'none'}],{...motion,delay:80}));
    Promise.all(tasks).then(()=>{
      if(token!==revision||!dialog.open)return;
      clearAnimations();
      ghost?.remove();ghost=null;media.classList.remove('is-moving');
      // An explicit second animation guarantees intermediate blur frames,
      // including newly inserted neighbors when switching to another work.
      blurBackground(token);
    });
  }
  function change(snapshot){
    cancel();dialog.querySelector('.media-stage').classList.remove('is-moving');
    addNeighbors(snapshot);dialog.dataset.phase='settled';
    animate(dialog.querySelector('.media-stage'),[{opacity:0,transform:'translateX(-32px)'},{opacity:1,transform:'none'}],{duration:480,easing:motion.easing});
    if(desktop.matches)blurBackground(revision);
  }
  async function close(){
    if(closing)return false;
    cancel();closing=true;const token=revision;
    dialog.querySelector('.media-stage').classList.remove('is-moving');
    dialog.dataset.phase='closing';
    restoreSources();
    document.body.classList.remove('work-detail-open');
    await Promise.all([
      animate(dialog.querySelector('.detail-copy'),[{opacity:1,transform:'none'},{opacity:0,transform:'translateX(-40px)'}],{duration:240,easing:'ease-in',fill:'both'}),
      animate(dialog.querySelector('.media-panel'),[{opacity:1},{opacity:0}],{duration:240,easing:'ease-in',fill:'both'})
    ]);
    return token===revision;
  }
  // A mobile browser's toolbar can resize the viewport during opening.
  // Keep playing instead of jumping to the last frame on every resize.
  window.ArtimanasWorkTransition={capture,open,change,close,reset};
})();
