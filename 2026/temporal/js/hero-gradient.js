
/* Gradiente procedural Canvas 2D, sin imágenes ni dependencias para la animación.
   El campo de color se calcula una sola vez; el cursor deforma sus coordenadas.
   Funciona también sin WebGL. Ajustes visuales al principio del archivo. */
(function () {
  'use strict';
  const cover=document.querySelector('.hero');
  if(!cover)return;
  cover.dataset.motion='paused';
  let started=false;
  function startFallback(){
    if(started||cover.dataset.shader!=='fallback')return;
    started=true;initializeFallback();
  }
  cover.addEventListener('artimanas:shader-state',startFallback);
  startFallback();
  function initializeFallback(){
  // Colores RGB entre 0 y 1. Cada propiedad conserva el mismo papel visual.
  // Paletas del respaldo 2D. El shader principal usa las de Hero.jsx.
  const PALETTES=[
    {
      name:'original',
      background:[0.059,0.057,0.051],
      haloLeft:[0.25,0.015,0.67],haloRight:[0.20,0.016,0.69],
      leftOrange:[0.82,0.30,0.20],leftPink:[0.64,0.12,0.46],
      light:[0.94,0.85,0.91],warm:[0.94,0.67,0.42],
      rightPink:[0.56,0.055,0.67],rightPurple:[0.26,0.025,0.65],
      rightOrange:[0.88,0.30,0.17]
    },
    {
      name:'violeta-rosa',
      background:[0.055,0.035,0.070],
      haloLeft:[0.32,0.025,0.66],haloRight:[0.27,0.020,0.64],
      leftOrange:[0.78,0.28,0.32],leftPink:[0.70,0.15,0.50],
      light:[0.93,0.80,0.89],warm:[0.93,0.58,0.46],
      rightPink:[0.65,0.075,0.62],rightPurple:[0.34,0.035,0.64],
      rightOrange:[0.86,0.32,0.26]
    },
    {
      name:'coral',
      background:[0.065,0.035,0.050],
      haloLeft:[0.29,0.020,0.62],haloRight:[0.24,0.018,0.65],
      leftOrange:[0.86,0.35,0.19],leftPink:[0.68,0.16,0.42],
      light:[0.95,0.83,0.86],warm:[0.96,0.66,0.36],
      rightPink:[0.61,0.075,0.60],rightPurple:[0.30,0.030,0.62],
      rightOrange:[0.92,0.36,0.18]
    },
    {
      name:'magenta',
      background:[0.060,0.030,0.065],
      haloLeft:[0.35,0.020,0.64],haloRight:[0.30,0.018,0.66],
      leftOrange:[0.80,0.25,0.28],leftPink:[0.74,0.11,0.48],
      light:[0.94,0.80,0.90],warm:[0.94,0.57,0.40],
      rightPink:[0.70,0.060,0.61],rightPurple:[0.37,0.025,0.65],
      rightOrange:[0.88,0.28,0.23]
    },
    {
      name:'ciruela',
      background:[0.050,0.035,0.065],
      haloLeft:[0.28,0.025,0.59],haloRight:[0.23,0.020,0.62],
      leftOrange:[0.76,0.29,0.25],leftPink:[0.61,0.15,0.47],
      light:[0.91,0.81,0.90],warm:[0.90,0.61,0.43],
      rightPink:[0.55,0.070,0.62],rightPurple:[0.29,0.035,0.60],
      rightOrange:[0.83,0.31,0.22]
    }
  ];
  const hero=document.querySelector('.hero'), canvas=document.querySelector('#hero-gradient');
  if(!hero||!canvas)return;
  // Una sola elección por carga; resize, scroll y orientación reutilizan el campo.
  const paletteIndex=window.ArtimanasHeroPalette?.index??0;
  const palette=PALETTES[paletteIndex];
  hero.dataset.paletteIndex=String(paletteIndex);
  hero.dataset.palette=palette.name;
  const ctx=canvas.getContext('2d',{alpha:false});
  if(!ctx){hero.dataset.gradient='static';return;}
  const portrait=matchMedia('(max-width: 1100px)');
  const settings={response:0.28, maxPixels:50000, fps:30, drift:0.35};
  const fieldSize=760, fieldSpan=1.6, fieldOrigin=-0.3;
  const colors=new Uint8ClampedArray(fieldSize*fieldSize*3);
  const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
  const field=(x,y,cx,cy,rx,ry)=>((x-cx)/rx)**2+((y-cy)/ry)**2;
  // Dos lóbulos asimétricos, cuello oscuro y luz cálida en el borde izquierdo.
  // La composición inicial reproduce la referencia, sin usarla como textura.
  for(let iy=0;iy<fieldSize;iy++){
    const y=fieldOrigin+iy/(fieldSize-1)*fieldSpan;
    for(let ix=0;ix<fieldSize;ix++){
      const x=fieldOrigin+ix/(fieldSize-1)*fieldSpan;
      const left=Math.sqrt(field(x,y,0.055,0.52,0.385,0.51));
      const right=Math.sqrt(field(x,y,0.935,0.51,0.45,0.48));
      const haloL=1-smooth(0.92,1.27,left), haloR=1-smooth(0.94,1.27,right);
      let r=palette.background[0]+(palette.haloLeft[0]-palette.background[0])*haloL,
          g=palette.background[1]+(palette.haloLeft[1]-palette.background[1])*haloL,
          b=palette.background[2]+(palette.haloLeft[2]-palette.background[2])*haloL;
      r+=(palette.haloRight[0]-r)*haloR;g+=(palette.haloRight[1]-g)*haloR;b+=(palette.haloRight[2]-b)*haloR;
      const pink=smooth(0.44,1.16,Math.abs(y-0.53)*2);
      let lr=palette.leftOrange[0]+(palette.leftPink[0]-palette.leftOrange[0])*pink,
          lg=palette.leftOrange[1]+(palette.leftPink[1]-palette.leftOrange[1])*pink,
          lb=palette.leftOrange[2]+(palette.leftPink[2]-palette.leftOrange[2])*pink;
      const light=Math.exp(-field(x,y,0.368,0.54,0.105,0.34)*1.35);
      lr+=(palette.light[0]-lr)*light;lg+=(palette.light[1]-lg)*light;lb+=(palette.light[2]-lb)*light;
      const warm=Math.exp(-field(x,y,0.292,0.57,0.088,0.34)*1.3)*0.38;
      lr+=(palette.warm[0]-lr)*warm;lg+=(palette.warm[1]-lg)*warm;lb+=(palette.warm[2]-lb)*warm;
      const edge=0.28+(0.024-0.28)*smooth(0.18,0.42,x), maskL=1-smooth(1-edge,1+edge,left);
      r+=(lr-r)*maskL;g+=(lg-g)*maskL;b+=(lb-b)*maskL;
      const purple=smooth(0.71,1.15,x);
      let rr=palette.rightPink[0]+(palette.rightPurple[0]-palette.rightPink[0])*purple,
          rg=palette.rightPink[1]+(palette.rightPurple[1]-palette.rightPink[1])*purple,
          rb=palette.rightPink[2]+(palette.rightPurple[2]-palette.rightPink[2])*purple;
      const orange=Math.exp(-field(x,y,0.525,0.54,0.12,0.34)*1.1);
      rr+=(palette.rightOrange[0]-rr)*orange;rg+=(palette.rightOrange[1]-rg)*orange;rb+=(palette.rightOrange[2]-rb)*orange;
      const edgeR=0.025+(0.24-0.025)*smooth(0.49,0.72,x),maskR=1-smooth(1-edgeR,1+edgeR,right);
      r+=(rr-r)*maskR;g+=(rg-g)*maskR;b+=(rb-b)*maskR;
      const shade=1-0.55*smooth(0.83,1.15,y),i=(iy*fieldSize+ix)*3;
      colors[i]=r*shade*255;colors[i+1]=g*shade*255;colors[i+2]=b*shade*255;
    }
  }
  let pixels, wavesX, wavesY, frame=null, last=null, elapsed=0, time=0;
  let visible=false, interacted=false, energy=0, inside=false;
  const pointer={x:0.5,y:0.5},target={x:0.5,y:0.5},trail={x:0.5,y:0.5};
  function draw(){
    if(!pixels)return;
    const w=canvas.width,h=canvas.height,data=pixels.data,amount=energy;
    const aspect=w/h,vertical=portrait.matches,scale=(fieldSize-1)/fieldSpan;
    for(let x=0;x<w;x++)wavesX[x]=amount*(0.10*Math.sin(x/w*6-time*0.29)+(pointer.y-0.5)*0.36*Math.sin(x/w*Math.PI));
    for(let y=0;y<h;y++)wavesY[y]=amount*(0.14*Math.sin(y/h*5.5+time*0.37)+(pointer.x-0.5)*0.48*Math.sin(y/h*Math.PI));
    const pullX=(pointer.x-trail.x)*1.35,pullY=(pointer.y-trail.y)*1.35;
    for(let y=0,i=0;y<h;y++){
      const v=y/h,dy=(v-pointer.y)**2*12;
      for(let x=0;x<w;x++,i+=4){
        const u=x/w,dx=(u-pointer.x)*aspect,influence=1/(1+dx*dx*12+dy);
        let px=u-pullX*influence+wavesY[y],py=v-pullY*influence+wavesX[x];
        if(vertical){const oldX=px;px=1-py;py=0.5+(oldX-0.5)*0.63;}
        const sx=Math.max(0,Math.min(fieldSize-1.001,(px-fieldOrigin)*scale));
        const sy=Math.max(0,Math.min(fieldSize-1.001,(py-fieldOrigin)*scale));
        const fx=sx|0,fy=sy|0,ax=sx-fx,ay=sy-fy,base=(fy*fieldSize+fx)*3;
        const next=base+fieldSize*3;
        for(let c=0;c<3;c++){
          const top=colors[base+c]+(colors[base+3+c]-colors[base+c])*ax;
          const bottom=colors[next+c]+(colors[next+3+c]-colors[next+c])*ax;
          data[i+c]=top+(bottom-top)*ay;
        }
        data[i+3]=255;
      }
    }
    ctx.putImageData(pixels,0,0);
    hero.dataset.phase=time.toFixed(2);
  }
  function resize(){
    const width=hero.clientWidth,height=hero.clientHeight;
    if(!width||!height)return;
    const ratio=Math.min(1,Math.sqrt(settings.maxPixels/(width*height)));
    canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);
    pixels=ctx.createImageData(canvas.width,canvas.height);
    wavesX=new Float32Array(canvas.width);wavesY=new Float32Array(canvas.height);
    draw();hero.classList.add('gradient-ready');hero.dataset.gradient='canvas';sync();
  }
  function tick(now){
    frame=null;
    elapsed+=last===null?0:Math.min((now-last)/1000,0.25);last=now;
    if(elapsed>=1/settings.fps){
      const dt=elapsed;elapsed=0;time+=dt;
      const ease=1-Math.exp(-dt/settings.response),slow=1-Math.exp(-dt/1.1);
      pointer.x+=(target.x-pointer.x)*ease;pointer.y+=(target.y-pointer.y)*ease;
      trail.x+=(pointer.x-trail.x)*slow;trail.y+=(pointer.y-trail.y)*slow;
      const desired=interacted?(inside?1:0.48):(time>2?settings.drift:0);
      energy+=(desired-energy)*slow;draw();
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    const running=visible&&!document.hidden&&!document.body.classList.contains('modal-open')&&hero.dataset.shader==='fallback';
    if(running&&frame===null){last=null;elapsed=0;frame=requestAnimationFrame(tick);}
    if(!running&&frame!==null){cancelAnimationFrame(frame);frame=null;last=null;}
    hero.dataset.motion=running?'running':'paused';
  }
  hero.addEventListener('pointermove',event=>{
    if(event.pointerType==='touch')return;
    const rect=hero.getBoundingClientRect();
    target.x=Math.max(0,Math.min(1,(event.clientX-rect.left)/rect.width));
    target.y=Math.max(0,Math.min(1,(event.clientY-rect.top)/rect.height));
    inside=true;interacted=true;sync();
  },{passive:true});
  hero.addEventListener('pointerleave',()=>{inside=false;target.x=target.y=0.5;});
  // Entrada opcional del módulo móvil; el mouse y el render conservan su ciclo.
  const mobileInput=matchMedia('(max-width:1100px) and (hover:none) and (pointer:coarse)');
  hero.addEventListener('artimanas:tilt',event=>{
    if(!mobileInput.matches||hero.dataset.motion!=='running')return;
    const {x,y}=event.detail||{};
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    target.x=Math.max(0,Math.min(1,x));target.y=Math.max(0,Math.min(1,y));
    inside=true;interacted=true;
  });
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();},{threshold:0}).observe(hero);
  new ResizeObserver(resize).observe(hero);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);
  hero.addEventListener('artimanas:shader-state',sync);
  portrait.addEventListener('change',resize);
  resize();
  }
})();

