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
        try{ const d=document.getElementById('debug'); if(d) d.textContent += "[boot] forwarded to canvas\n"; }catch(_e){}
      }
    }, {capture:true});
  })();
})();
  // --- Update version badge with query 'v' and cb for easy cache checks ---
  (function updateBadge(){
    try{
      const verEl = document.getElementById('ver'); if(!verEl) return;
      const params = new URLSearchParams(location.search);
      const v = params.get('v') || '6.10 DEBUG fixN';
      let cb = params.get('cb');
      if(!cb){
        const scr = document.querySelector('script[src*="boot.js"]');
        if(scr){ try{ cb = new URL(scr.src, location.href).searchParams.get('cb'); }catch(_e){} }
      }
      const now = new Date();
      const hh = String(now.getHours()).padStart(2,'0');
      const mm = String(now.getMinutes()).padStart(2,'0');
      const ss = String(now.getSeconds()).padStart(2,'0');
      verEl.textContent = v + " | cb:" + (cb||'n/a') + " | " + hh + ":" + mm + ":" + ss;
    }catch(_e){}
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