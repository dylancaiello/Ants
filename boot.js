
// boot.js — diagnostics + splat/stain + pitch-var pop without touching app.js
(function(){
  const log = (s)=>{ try{ const d=document.getElementById('debug'); if(d) d.textContent += s + "\n"; console.log('[boot]', s); }catch(e){} };

  log('[boot] loaded');

  // Ensure clicks reach UI/button
  try{
    const ui=document.getElementById('ui'); if(ui){ ui.style.pointerEvents='auto'; ui.style.zIndex='9998'; }
    const btn=document.getElementById('startBtn');
    if(btn){ btn.style.pointerEvents='auto'; btn.style.zIndex='9999'; btn.style.cursor='pointer'; }
  }catch(e){}

  // Audio setup (independent of app.js)
  let ac=null, popBuf=null;
  async function initAudio(){
    if(ac) return;
    try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(_e){ ac=null; }
    if(!ac) return;
    try{
      const res = await fetch('assets/pop.mp3');
      const ab = await res.arrayBuffer();
      popBuf = await new Promise((res,rej)=> ac.decodeAudioData(ab.slice(0), res, rej));
      log('[boot] audio decoded');
    }catch(e){ log('[boot] audio failed'); }
  }
  function playPop(){
    if(!ac || !popBuf) return;
    try{
      if(ac.state==='suspended') ac.resume();
      const src = ac.createBufferSource();
      src.buffer = popBuf;
      const cents = (Math.random()*400)-200;
      src.playbackRate.value = Math.pow(2, cents/1200);
      const g = ac.createGain(); g.gain.value=0.85;
      src.connect(g).connect(ac.destination);
      src.start(0);
    }catch(e){}
  }

  // Layers (created by index.html edits)
  const below = document.getElementById('belowSprites') || (function(){ const d=document.createElement('div'); d.id='belowSprites'; d.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:0;'; document.getElementById('wrapper').appendChild(d); return d; })();
  const above = document.getElementById('aboveSprites') || (function(){ const d=document.createElement('div'); d.id='aboveSprites'; d.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:2;'; document.getElementById('wrapper').appendChild(d); return d; })();

  function spawnEffect(layer, src, x, y, lifeMs){
    const el = document.createElement('img');
    el.src = src; el.alt='';
    el.style.position='absolute';
    el.style.left = (x-32)+'px'; el.style.top = (y-32)+'px';
    el.style.width='64px'; el.style.height='64px';
    const rot = (Math.random()*360).toFixed(1);
    el.style.transform = 'rotate('+rot+'deg)';
    el.style.opacity='0';
    el.style.transition='opacity 80ms ease-out, transform '+lifeMs+'ms ease-out';
    layer.appendChild(el);
    requestAnimationFrame(()=> el.style.opacity='1');
    setTimeout(()=> el.style.opacity='0', Math.max(60, lifeMs-120));
    setTimeout(()=> el.remove(), lifeMs+80);
  }
  function spawnStain(x,y){ spawnEffect(below, 'assets/stain.png', x, y, 1200); }
  function spawnSplat(x,y){ spawnEffect(above, 'assets/splat.png', x, y, 600); }

  // Observe ant death via class 'squash' on ant IMG inside #sprites
  const sprites = document.getElementById('sprites');
  if(sprites){
    const mo = new MutationObserver((mutations)=>{
      for(const m of mutations){
        const el = m.target;
        if(m.type==='attributes' && m.attributeName==='class' && el && el.tagName==='IMG'){
          if(el.classList && el.classList.contains('squash')){
            const rect = el.getBoundingClientRect();
            const x = rect.left + rect.width/2;
            const y = rect.top + rect.height/2;
            // convert to CSS pixel coords relative to sprites container
            const srect = sprites.getBoundingClientRect();
            const lx = x - srect.left;
            const ly = y - srect.top;
            spawnStain(lx, ly);
            spawnSplat(lx, ly);
            initAudio().then(playPop);
          }
        }
      }
    });
    mo.observe(sprites, {subtree:true, attributes:true, attributeFilter:['class']});
    log('[boot] observer attached');
  }else{
    log('[boot] sprites layer missing');
  }

  // Diagnostics: which element sits above button center
  setTimeout(()=>{
    const btn=document.getElementById('startBtn');
    if(btn){
      const r=btn.getBoundingClientRect();
      const el=document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
      log('[boot] probe elementFromPoint over start: ' + (el ? (el.id || el.tagName) : 'null'));
    }
  }, 400);

  // Do not attempt to call reset(); app.js handles Start itself.
  // We only keep a small log on click so we know the button is live.
  try{
    const btn=document.getElementById('startBtn');
    if(btn){
      btn.addEventListener('click', ()=>{ log('[boot] startBtn CLICK'); initAudio(); }, {once:false});
    }
  }catch(e){}
})();
