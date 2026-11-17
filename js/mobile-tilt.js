/* Optional mobile input. It never starts or stops the gradient animation. */
(() => {
  'use strict';
  const hero=document.querySelector('.hero');
  if(!hero)return;
  const mobile=matchMedia('(max-width:1100px) and (hover:none) and (pointer:coarse)');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  const tiltRange=28;
  let origin=null,granted=false,listening=false,denied=false,requesting=false;
  const clamp=value=>Math.max(0,Math.min(1,value));
  const delta=(value,base)=>((value-base+540)%360)-180;
  const eligible=()=>mobile.matches&&!reduced.matches;
  function orientation(event){
    if(!eligible()||hero.dataset.motion!=='running'||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
    const angle=window.screen?.orientation?.angle??window.orientation??0;
    if(!origin||origin.angle!==angle)origin={beta:event.beta,gamma:event.gamma,angle};
    const dx=delta(event.gamma,origin.gamma),dy=delta(event.beta,origin.beta),radians=angle*Math.PI/180;
    hero.dispatchEvent(new CustomEvent('artimanas:tilt',{detail:{
      x:clamp(.5+(dx*Math.cos(radians)+dy*Math.sin(radians))/(tiltRange*2)),
      y:clamp(.5+(dy*Math.cos(radians)-dx*Math.sin(radians))/(tiltRange*2))
    }}));
    hero.dataset.sensor='active';
  }
  function sync(){
    const api=eligible()&&window.isSecureContext?window.DeviceOrientationEvent:null;
    const enabled=!!api&&!denied&&(typeof api.requestPermission!=='function'||granted);
    if(enabled&&!listening){window.addEventListener('deviceorientation',orientation,{passive:true});listening=true;}
    if(!enabled&&listening){window.removeEventListener('deviceorientation',orientation);listening=false;origin=null;}
  }
  // Safari requires activation. A tap on the cover can trigger the system
  // permission; there is no extra button, and denial preserves idle animation.
  hero.addEventListener('click',async()=>{
    if(!eligible()||!window.isSecureContext||granted||denied||requesting)return;
    const api=window.DeviceOrientationEvent;
    if(typeof api?.requestPermission!=='function')return;
    requesting=true;
    try {granted=await api.requestPermission()==='granted';denied=!granted;}
    catch(_){denied=true;}
    finally {requesting=false;hero.dataset.sensor=granted?'ready':'denied';sync();}
  });
  mobile.addEventListener('change',()=>{origin=null;sync();});
  reduced.addEventListener('change',()=>{origin=null;sync();});
  new MutationObserver(()=>{if(hero.dataset.motion!=='running')origin=null;})
    .observe(hero,{attributes:true,attributeFilter:['data-motion']});
  document.addEventListener('visibilitychange',()=>{origin=null;});
  sync();
})();
