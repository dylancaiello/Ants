(function(){
  // Prevent double-init
  if(window.__ANTS_BOOT_VER__ === 2) return;
  window.__ANTS_BOOT_VER__ = 2;

  // --- Service worker clean ---
  try{
    if('serviceWorker' in navigator){
      navigator.serviceWorker.getRegistrations && navigator.serviceWorker.getRegistrations().then(regs=>{
        var n=regs.length; regs.forEach(r=>r.unregister());
        if(n>0){ const d=document.getElementById('debug'); if(d) d.textContent += "[boot] unregistered SWs: "+n+"\n"; setTimeout(()=>location.reload(),50); }
      });
    }
  }catch(_e){}

  // --- Audio pitch shim ---
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if(AC && !AC.__antsShimmed){
      const proto = AC.prototype;
      const _create = proto.createBufferSource;
      proto.createBufferSource = function(){
        const node = _create.call(this);
        try{
          const _start = node.start.bind(node);
          node.start = function(){
            try{ if(node.playbackRate){ const cents=(Math.random()*400)-200; node.playbackRate.value=Math.pow(2,cents/1200); } }catch(_e){}
            return _start.apply(null, arguments);
          };
        }catch(_e){}
        return node;
      };
      AC.__antsShimmed = true;
    }
  }catch(_e){}

  // --- Effects layers ---
  const wrap = document.getElementById('wrapper');
  const sprites = document.getElementById('sprites');
  if(!wrap || !sprites) return;
  function mkLayer(id, z){ let d=document.getElementById(id); if(!d){ d=document.createElement('div'); d.id=id; d.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:'+z+';'; wrap.appendChild(d); } return d; }
  const below = mkLayer('belowSprites', 0);

  // --- Preload effect assets as ArrayBuffers so each spawn gets a fresh object URL (restarts APNG/GIF) ---
  const __ANT_ASSETS = { splatBuf:null, stainBuf:null };
  (async function preloadEffects(){
    try{
      const spl = await fetch('assets/splat.png'); __ANT_ASSETS.splatBuf = await spl.arrayBuffer();
    }catch(_e){}
    try{
      const stn = await fetch('assets/stain.png'); __ANT_ASSETS.stainBuf = await stn.arrayBuffer();
    }catch(_e){}
  })();

  const above = mkLayer('aboveSprites', 2);

  function spawnEffect(layer, key, x, y, lifeMs){
    const el=document.createElement('img'); el.alt='';
    let url=null;
    try{
      const buf = key==='splat' ? __ANT_ASSETS.splatBuf : __ANT_ASSETS.stainBuf;
      if(buf){ url = URL.createObjectURL(new Blob([buf], {type:'image/png'})); }
    }catch(_e){}
    if(!url){ url = 'assets/'+key+'.png?u=' + Math.floor(performance.now()); }
    el.src=url;
    el.style.cssText='position:absolute;width:64px;height:64px;opacity:0;transition:opacity 80ms ease-out';
    el.style.left=(x-32)+'px'; el.style.top=(y-32)+'px';
    el.style.transform='rotate('+(Math.random()*360).toFixed(1)+'deg)';
    layer.appendChild(el);
    requestAnimationFrame(()=> el.style.opacity='1');
    const fadeOutAt = Math.max(60, lifeMs-120);
    setTimeout(()=> el.style.opacity='0', fadeOutAt);
    setTimeout(()=> { 
      try{ if(url && url.startsWith('blob:')) URL.revokeObjectURL(url); }catch(_e){} 
      el.remove(); 
    }, lifeMs+80);
  }
  function spawnStain(x,y){ spawnEffect(below, 'stain', x, y, 1200); }
  function spawnSplat(x,y){ spawnEffect(above, 'splat', x, y, 600); }

  // --- Ant death observer (de-duped) ---
  if(!window.__antsSeen){ window.__antsSeen = new WeakSet(); }
  const mo = new MutationObserver((muts)=>{
    for(const m of muts){
      const el = m.target;
      if(m.type==='attributes' && m.attributeName==='class' && el && el.tagName==='IMG' && el.classList.contains('squash')){
        if(window.__antsSeen.has(el)) continue;
        window.__antsSeen.add(el);
        const r=el.getBoundingClientRect(), sR=sprites.getBoundingClientRect();
        const x=r.left+r.width/2 - sR.left, y=r.top+r.height/2 - sR.top;
        spawnStain(x,y); spawnSplat(x,y);
      }
    }
  });
  mo.observe(sprites, {subtree:true, attributes:true, attributeFilter:['class']});
  try{ const d=document.getElementById('debug'); if(d) d.textContent += "[boot] observer attached\n"; }catch(_e){}

  // --- Forward clicks to canvas exactly once ---
  (function(){
    const canvas = document.getElementById('game');
    const startBtn = document.getElementById('startBtn');
    if(!canvas) return;
    let lastForwardStamp = 0;
    document.addEventListener('pointerdown', function(e){
      // If click is on the Start/Next button, do nothing
      if(startBtn && startBtn.contains(e.target)) return;
      // If already forwarded this event, skip
      const stamp = e.timeStamp || Date.now();
      if(stamp === lastForwardStamp) return;
      // Only forward if the click landed within the canvas box
      const r = canvas.getBoundingClientRect();
      const x = e.clientX, y = e.clientY;
      if(x >= r.left && x <= r.right && y >= r.top && y <= r.bottom){
        lastForwardStamp = stamp;
        try{
          const ev = new PointerEvent('pointerdown', {bubbles:true, cancelable:true, clientX:x, clientY:y, pointerId:e.pointerId||1, pointerType:e.pointerType||'mouse', buttons:e.buttons||1});
          canvas.dispatchEvent(ev);
        }catch(_e){
          const evt = document.createEvent('MouseEvents');
          evt.initMouseEvent('pointerdown', true, true, window, 0, 0,0, x, y, false,false,false,false, 0, null);
          canvas.dispatchEvent(evt);
        }
        try{ const d=document.getElementById('debug');  }catch(_e){}
      }
    }, {capture:true});
  })();
})();
  // --- Update version badge with query 'v' and cb for easy cache checks ---
  (function updateBadge(){
  try{
    const verEl = document.getElementById('ver'); if(!verEl) return;
    const qp = new URLSearchParams(location.search);
    let v = qp.get('v') || '6.10 DEBUG fixV';
    let cb = qp.get('cb') || 'n/a';
    const now = new Date();
    const hh = now.getHours().toString().padStart(2,'0');
    const mm = now.getMinutes().toString().padStart(2,'0');
    const ss = now.getSeconds().toString().padStart(2,'0');
    verEl.textContent = v + " | cb:" + cb + " | " + hh + ":" + mm + ":" + ss;
  }catch(e){}
})();

  // --- Robust Start fallback: ensure game starts even if original listener fails ---
  (function(){
    const btn = document.getElementById('startBtn');
    if(!btn) return;
    btn.addEventListener('click', function(){
      try{
        // Prefer game's own handler; if it didn't run, do a minimal start
        if(typeof window.reset === 'function'){
          // Mirror the game's own start sequence
          if(typeof window.ac !== 'undefined' && ac && ac.state==='suspended'){ try{ ac.resume(); }catch(_e){} }
          btn.style.display='none';
          // Set flags if present
          try{ window.gameOver=false; window.running=true; }catch(_e){}
          window.reset();
        } else {
          // Minimal fallback: hide button so waves can spawn if logic allows
          btn.style.display='none';
        }
      }catch(_e){}
    }, {capture:false});
  })();

  try{
    const ui=document.getElementById('ui');
    if(ui){ ui.style.pointerEvents='auto'; }
  }catch(_e){}
  // --- Robust Start fallback (fixP) ---
  (function(){
    const btn = document.getElementById('startBtn');
    if(!btn) return;
    btn.addEventListener('click', function(){
      try{
        const d=document.getElementById('debug'); if(d){ d.textContent += "[boot] start fallback\n"; }
        if(typeof window.ac !== 'undefined' && ac && ac.state==='suspended'){ try{ ac.resume(); }catch(_e){} }
        btn.style.display='none';
        try{ window.gameOver=false; window.running=true; }catch(_e){}
        if(typeof window.reset === 'function'){ window.reset(); }
      }catch(_e){}
    }, {capture:false});
  })();
    
// Strong start fallback fixS
(function(){
  const btn = document.getElementById('startBtn');
  if(!btn) return;
  btn.addEventListener('click', function(){
    try{
      const dbg = document.getElementById('debug');
      if(dbg) dbg.textContent += "[boot] start fallback fixS\n";
      // Ensure layers click-through
      try{
        const sp = document.getElementById('sprites'); if(sp) sp.style.pointerEvents='none';
        const bs = document.getElementById('belowSprites'); if(bs) bs.style.pointerEvents='none';
        const as = document.getElementById('aboveSprites'); if(as) as.style.pointerEvents='none';
        const ui = document.getElementById('ui'); if(ui) ui.style.pointerEvents='auto';
      }catch(_e){}
      // Hide button
      btn.style.display='none';
      // Try to start via game API
      if(typeof window.ac!=='undefined' && ac && ac.state==='suspended'){ try{ ac.resume(); }catch(_e){} }
      if(typeof window.reset==='function'){ window.reset(); }
      // After a short delay, if no ants present, force spawns
      setTimeout(function(){
        const spriteLayer = document.getElementById('sprites');
        const antImgs = spriteLayer ? spriteLayer.querySelectorAll('img[src*=\"ant\"]').length : 0;
        if(antImgs===0 && typeof window.spawnBurst==='function'){
          if(dbg) dbg.textContent += "[boot] no ants detected — forcing spawn\n";
          try{ window.spawnBurst(); }catch(_e){}
          setTimeout(()=>{ try{ window.spawnBurst(); }catch(_e){} }, 150);
          setTimeout(()=>{ try{ window.spawnBurst(); }catch(_e){} }, 300);
        }
      }, 250);
    }catch(_e){}
  }, {capture:false});
})();
// --- Start fallback and ant assurance (fixU) ---
(function(){
  try{
    var btn = document.getElementById('startBtn');
    if(!btn) return;
    btn.addEventListener('click', function(){
      try{
        var d=document.getElementById('debug'); if(d) d.textContent += "[boot] start fallback fixU\n";
        try{ if(window.ac && ac.state==='suspended') ac.resume(); }catch(_e){}
        btn.style.display='none';
        try{ window.running=true; window.gameOver=false; }catch(_e){}
        if(typeof window.reset==='function'){ window.reset(); }
        // After a short delay, if no ants are present, force spawns
        setTimeout(function assure(){
          try{
            var sprites = document.getElementById('sprites');
            var anyAnt = sprites && sprites.querySelector('img[src*="ant.png"]');
            if(!anyAnt){
              if(typeof window.spawnBurst==='function'){
                var d=document.getElementById('debug'); if(d) d.textContent += "[boot] forcing spawnBurst\n";
                window.spawnBurst(); window.spawnBurst(); window.spawnBurst();
              }
            }
          }catch(_e){}
        }, 250);
      }catch(_e){}
    }, {capture:false});
  }catch(_e){}
})();
// --- fixV start guard ---
(function(){
  const btn=document.getElementById('startBtn');
  if(!btn) return;
  btn.addEventListener('click', function(){
    try{
      const d=document.getElementById('debug'); if(d) d.textContent += "[boot] start fallback fixV\n";
      btn.style.display='none';
      if(typeof window.ac!=='undefined' && ac && ac.state==='suspended'){ try{ ac.resume(); }catch(e){} }
      if(typeof window.reset==='function'){ try{ window.reset(); }catch(e){} }
      // After a short delay, ensure ants exist; if not, force-spawn 3 bursts.
      setTimeout(()=>{
        let hasAnts = false;
        try{
          const q = document.querySelector('#sprites img[src*="ant"]');
          hasAnts = !!q;
        }catch(_e){}
        if(!hasAnts && typeof window.spawnBurst==='function'){
          const d=document.getElementById('debug'); if(d) d.textContent += "[boot] no ants detected — forcing spawn\n";
          try{ window.spawnBurst(); }catch(e){}
          setTimeout(()=>{ try{ window.spawnBurst(); }catch(e){} }, 150);
          setTimeout(()=>{ try{ window.spawnBurst(); }catch(e){} }, 300);
        }
      }, 300);
    }catch(_e){}
  }, {capture:false});
})();
