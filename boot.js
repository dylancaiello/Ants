
(function(){
  if(window.__ANTS_BOOT_INIT__) return; window.__ANTS_BOOT_INIT__=true;

// ===== hook canvas pointerdown registered by app.js =====
(function(){
  try{
    const canvas = document.getElementById('game');
    if(!canvas) return;
    const _origAdd = canvas.addEventListener.bind(canvas);
    if(!window.__ANTS_HOOKED__){
      canvas.addEventListener = function(type, listener, options){
        if(type === 'pointerdown'){
          try{
            window.__antsPointerHandler = listener;
            const d=document.getElementById('debug'); if(d){ d.textContent += "[boot] hooked canvas pointerdown
"; }
          }catch(_e){}
        }
        return _origAdd(type, listener, options);
      };
      // Add a single logger to confirm events reach the canvas
      _origAdd('pointerdown', function(e){
        const d=document.getElementById('debug'); if(d){ d.textContent += "[boot] canvas pointerdown
"; }
      }, {passive:false});
      window.__ANTS_HOOKED__=true;
    }
  }catch(_e){}
})();

  // Force-unregister any service workers to avoid stale caches
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations && navigator.serviceWorker.getRegistrations().then(regs=>{
        var n = regs.length;
        regs.forEach(r=>r.unregister());
        try{ if(n>0){ const d=document.getElementById('debug'); if(d) d.textContent += `[boot] unregistered SWs: ${n}\n`; } }catch(_e){}
        if(n>0){ setTimeout(()=> location.reload(), 50); }
      });
    }
  }catch(_e){}
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
  
// Audio pitch-variation shim: random ±200 cents on each start()
try{
  const AC = window.AudioContext || window.webkitAudioContext;
  if(AC && !AC.__antsShimmed){
    const proto = AC.prototype;
    const _origCreate = proto.createBufferSource;
    proto.createBufferSource = function(){
      const node = _origCreate.call(this);
      try{
        const _start = node.start.bind(node);
        node.start = function(){
          try{
            if(node.playbackRate){ const cents=(Math.random()*400)-200; node.playbackRate.value = Math.pow(2, cents/1200); }
          }catch(_e){}
          return _start.apply(null, arguments);
        };
      }catch(_e){}
      return node;
    };
    AC.__antsShimmed = true;
  }
}catch(_e){}

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
        if(!window.__antsSeen){ window.__antsSeen = new WeakSet(); }
        if(!window.__antsSeen.has(el)){
          window.__antsSeen.add(el);
          spawnStain(x,y); spawnSplat(x,y);
          // Let app.js play the pop; pitch variation added via shim
        }
      }
    }
  });
  mo.observe(sprites, {subtree:true, attributes:true, attributeFilter:['class']});
  // Light boot logs for confirmation
  log('[boot] observer attached');
  const btn=document.getElementById('startBtn');
  btn && btn.addEventListener('click', ()=>{ log('[boot] startBtn CLICK'); initAudio(); }, {once:false});
})();

  // Forward pointer events to canvas so ant taps always register
  try{
    const canvas = document.getElementById('game');
    const startBtn = document.getElementById('startBtn');
    if(canvas){
      document.addEventListener('pointerdown', function(e){
        // Ignore clicks on Start/Next Wave button
        if(startBtn && startBtn.contains(e.target)) return;
        // Re-dispatch to canvas with the same client coordinates
        try{
          const ev = new PointerEvent('pointerdown', {
            bubbles: true,
            cancelable: true,
            clientX: e.clientX,
            clientY: e.clientY,
            pointerId: e.pointerId || 1,
            pointerType: e.pointerType || 'mouse',
            buttons: e.buttons || 1,
          });
          canvas.dispatchEvent(ev);
        }catch(_err){
          // Fallback for older browsers
          const evt = document.createEvent('MouseEvents');
          evt.initMouseEvent('pointerdown', true, true, window, 0, 0,0, e.clientX, e.clientY, false,false,false,false, 0, null);
          canvas.dispatchEvent(evt);
        }
      }, {capture:true});
    }
  }catch(_e){}

  // Ensure canvas gets clicks: make #ui transparent and move Start button out of it
  try{
    const wrap = document.getElementById('wrapper');
    const ui = document.getElementById('ui');
    const btn = document.getElementById('startBtn');
    if(ui){ ui.style.pointerEvents = 'none'; }
    if(btn && wrap && btn.parentElement === ui){
      wrap.appendChild(btn); // move out of #ui so parent's pointer-events:none doesn't affect it
      btn.style.pointerEvents = 'auto';
      btn.style.zIndex = '5';
      btn.style.position = 'absolute';
      btn.style.left = '50%';
      btn.style.top = '50%';
      btn.style.transform = 'translate(-50%, -50%)';
    }
  }catch(_e){}

try{
  const bs = document.getElementById('belowSprites'); if(bs) bs.style.pointerEvents='none';
  const as = document.getElementById('aboveSprites'); if(as) as.style.pointerEvents='none';
  const sp = document.getElementById('sprites'); if(sp) sp.style.pointerEvents='none';
}catch(_e){}
