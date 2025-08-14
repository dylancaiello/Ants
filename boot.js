
// boot.js — early diagnostics and starter shim
(function(){
  function logLine(s){
    try{
      const d = document.getElementById('debug');
      if(d){ d.textContent += s + "\n"; }
      console.log('[boot]', s);
    }catch(_e){}
  }
  logLine('[boot] loaded');

  // Ensure UI/button receive clicks
  try{
    const ui = document.getElementById('ui');
    const btn = document.getElementById('startBtn');
    if(ui){ ui.style.pointerEvents='auto'; ui.style.zIndex='9998'; }
    if(btn){
      btn.style.pointerEvents='auto';
      btn.style.zIndex='9999';
      btn.style.cursor='pointer';
      btn.addEventListener('click', function(){
        logLine('[boot] startBtn CLICK');
        try{
          if(typeof window.reset === 'function'){
            logLine('[boot] calling reset()');
            btn.style.display='none';
            // Try to init audio if available
            try{ (window.ac && ac.resume) ? ac.resume() : null; }catch(_e){}
            // Try to set flags and call reset()
            try{
              window.running = true;
              window.gameOver = false;
            }catch(_e){}
            window.reset();
          }else{
            logLine('[boot] reset() missing');
          }
        }catch(err){ logLine('[boot] error: ' + err.message); }
      }, {once:false});
      setTimeout(()=>{
        // Probe what element is at button center
        const r = btn.getBoundingClientRect();
        const el = document.elementFromPoint(Math.round(r.left+r.width/2), Math.round(r.top+r.height/2));
        logLine('[boot] probe elementFromPoint over start: ' + (el ? (el.id || el.tagName) : 'null'));
      }, 300);
    } else {
      logLine('[boot] startBtn not found');
    }
  }catch(err){ logLine('[boot] setup error ' + err.message); }
})();
