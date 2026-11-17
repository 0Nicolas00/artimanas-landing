/* Two identical, contiguous groups. Fill each group even on ultrawide screens. */
(() => {
  'use strict';
  const hero=document.querySelector('.hero');
  if(!hero)return;
  document.querySelectorAll('.marquee').forEach(marquee=>{
    const track=marquee.querySelector('.marquee-track');
    const groups=[...track.querySelectorAll('.marquee-group')];
    if(groups.length!==2)return;
    const template=groups[0].querySelector('span').cloneNode(true);
    let previousWidth=0;
    function fit(){
      const width=marquee.clientWidth;
      if(!width)return;
      groups[0].replaceChildren(template.cloneNode(true));
      while(groups[0].getBoundingClientRect().width<width||groups[0].children.length<2){
        groups[0].append(template.cloneNode(true));
        if(groups[0].children.length>=12)break;
      }
      groups[1].replaceChildren(...[...groups[0].children].map(node=>node.cloneNode(true)));
      const groupWidth=groups[0].getBoundingClientRect().width;
      if(groupWidth!==previousWidth){track.style.animationDuration=`${groupWidth/30}s`;previousWidth=groupWidth;}
    }
    new ResizeObserver(fit).observe(marquee);
    document.fonts?.ready.then(fit);
    fit();
  });
  let visible=true;
  const sync=()=>{hero.dataset.cintaMotion=visible&&!document.hidden&&!document.body.classList.contains('modal-open')?'running':'paused';};
  new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;sync();}).observe(hero);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',sync);sync();
})();
