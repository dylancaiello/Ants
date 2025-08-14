
(function(){
  const log = (s)=>{ try{ const d=document.getElementById('debug'); if(d) d.textContent += s + "\n"; }catch(e){} };
  // Audio
  let ac=null, popBuf=null;
  async function initAudio(){
    if(ac) return; try{ ac=new (window.AudioContext||window.webkitAudioContext)(); }catch(_e){}
    if(!ac) return;
    try{ const ab=await (await fetch('assets/pop.mp3')).arrayBuffer();
         popBuf=await new Promise((res,rej)=> ac.decodeAudioData(ab.slice(0), res, rej));
    }catch(_e){}
  }
  function playPop(){
    if(!ac||!popBuf) return; try{
      if(ac.state==='suspended') ac.resume();
      const s=ac.createBufferSource(); s.buffer=popBuf;
      const cents=(Math.random()*400)-200; s.playbackRate.value=Math.pow(2,cents/1200);
      const g=ac.createGain(); g.gain.value=0.85; s.connect(g).connect(ac.destination); s.start(0);
    }catch(_e){}
  }
  const sprites=document.getElementById('sprites');
  const wrap=document.getElementById('wrapper');
  if(!sprites||!wrap){ return; }
  const below=document.getElementById('belowSprites') || (()=>{ const d=document.createElement('div'); d.id='belowSprites'; d.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:0;'; wrap.appendChild(d); return d; })();
  const above=document.getElementById('aboveSprites') || (()=>{ const d=document.createElement('div'); d.id='aboveSprites'; d.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2;'; wrap.appendChild(d); return d; })();
  function spawnEffect(layer, src, x, y, lifeMs){
    const el=document.createElement('img'); el.src=src; el.alt='';
    el.style.cssText='position:absolute;width:64px;height:64px;opacity:0;transition:opacity 80ms ease-out';
    el.style.left=(x-32)+'px'; el.style.top=(y-32)+'px';
    el.style.transform='rotate('+(Math.random()*360).toFixed(1)+'deg)';
    layer.appendChild(el); requestAnimationFrame(()=> el.style.opacity='1');
    setTimeout(()=> el.style.opacity='0', Math.max(60, lifeMs-120)); setTimeout(()=> el.remove(), lifeMs+80);
  }
  function spawnStain(x,y){ spawnEffect(below, 'assets/stain.png', x, y, 1200); }
  function spawnSplat(x,y){ spawnEffect(above, 'assets/splat.png', x, y, 600); }
  const mo=new MutationObserver((muts)=>{
    for(const m of muts){
      const el=m.target;
      if(m.type==='attributes' && m.attributeName==='class' && el && el.tagName==='IMG' && el.classList.contains('squash')){
        const r=el.getBoundingClientRect(), sR=sprites.getBoundingClientRect();
        const x=r.left+r.width/2 - sR.left, y=r.top+r.height/2 - sR.top;
        spawnStain(x,y); spawnSplat(x,y); initAudio().then(playPop);
      }
    }
  });
  mo.observe(sprites, {subtree:true, attributes:true, attributeFilter:['class']});
  // Light boot logs for confirmation
  log('[boot] observer attached');
  const btn=document.getElementById('startBtn');
  btn && btn.addEventListener('click', ()=>{ log('[boot] startBtn CLICK'); initAudio(); }, {once:false});
})();
