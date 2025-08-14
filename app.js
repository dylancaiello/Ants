// Ants v6.4 DEBUG — external JS
(function(){

  const debug=document.getElementById('debug');
  const log=(...a)=>{ if(debug){ debug.textContent += a.join(' ') + "\n"; } console.log('[Ants]', ...a); };
  window.onerror=(m,s,l,c,e)=>{ log('ERROR:', m, '@', s, l+':'+c); };

  if('serviceWorker' in navigator){ addEventListener('load',()=>navigator.serviceWorker.register('sw-v64.js')); }
  log('boot v6.4 DEBUG');
  const DPR=Math.min(3, devicePixelRatio||1);
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d', {alpha:false});
  const startBtn=document.getElementById('startBtn');
  const waveEl=document.getElementById('wave');
  const antsEl=document.getElementById('ants');
  const hpEl=document.getElementById('hp');
  const toast=document.getElementById('toast');

  const antImg=new Image(); antImg.src='assets/ant.png';
  const cakeImg=new Image(); cakeImg.src='assets/cake.png';
  antImg.onload=()=>log('ant.png loaded', antImg.width+'x'+antImg.height);
  cakeImg.onload=()=>log('cake.png loaded', cakeImg.width+'x'+cakeImg.height);

  let W=0,H=0,CX=0,CY=0, arenaRadius=0;
  function resize(){ W=innerWidth; H=innerHeight; CX=W*0.5; CY=H*0.5;
    canvas.width=W*DPR; canvas.height=H*DPR; canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    arenaRadius=Math.min(W,H)*0.42;
    log('resize', W, H, 'arena', arenaRadius.toFixed(1));
  }
  addEventListener('resize', resize, {passive:true}); resize();

  let running=false, gameOver=false, wave=1, cakeHP=3;
  const ants=[]; const TAP_RADIUS=32;
  let waveTotal=10, spawned=0, spawnTimer=0.4+Math.random()*0.4;

  function reset(){ running=true; gameOver=false; wave=1; cakeHP=3; ants.length=0;
    waveTotal=10; spawned=0; spawnTimer=0.35+Math.random()*0.4;
    updateHUD(); log('reset -> wave', wave, 'waveTotal', waveTotal);
  }
  function spawnBurst(){ const remaining=waveTotal-spawned; if(remaining<=0) return;
    const pool=[1,1,1,1,2,2,3]; let count=pool[(Math.random()*pool.length)|0]; count=Math.min(count, remaining);
    for(let i=0;i<count;i++) ants.push(makeAnt());
    spawned+=count; log('spawn', count, 'spawned', spawned, 'of', waveTotal);
    spawnTimer=0.35+Math.random()*0.75;
  }
  function spawnWaveIfNeeded(dt){ if(!running||gameOver) return; if(spawned<waveTotal){ spawnTimer-=dt; if(spawnTimer<=0) spawnBurst(); } }

  function makeAnt(){ const ang=Math.random()*Math.PI*2; const r=arenaRadius+40+Math.random()*30;
    const x=CX+Math.cos(ang)*r; const y=CY+Math.sin(ang)*r; const speed=70+Math.random()*40+wave*6;
    return {x,y,angle:Math.atan2(CY-y,CX-x),speed,alive:true};
  }
  function updateHUD(){ waveEl.textContent='Wave '+wave; antsEl.textContent='Ants: '+ants.filter(a=>a.alive).length; hpEl.textContent='Cake: '+cakeHP; }

  function handlePointer(e){ const r=canvas.getBoundingClientRect(); const px=(e.clientX-r.left); const py=(e.clientY-r.top);
    log('tap', px|0, py|0, 'running', running, 'gameOver', gameOver);
    if(!running||gameOver) return; let hit=false;
    for(const a of ants){ if(!a.alive) continue; const dx=a.x-px, dy=a.y-py; if(dx*dx+dy*dy<=TAP_RADIUS*TAP_RADIUS){ a.alive=false; hit=true; } }
    if(hit) showToast('Splat!'); updateHUD();
  }
  canvas.addEventListener('pointerdown',(e)=>{ e.preventDefault(); handlePointer(e); },{passive:false});

  startBtn.addEventListener('click',()=>{ log('startBtn click', 'running', running, 'gameOver', gameOver);
    if(!running && !gameOver){ startBtn.style.display='none'; reset(); }
    else if(gameOver && cakeHP>0){ gameOver=false; running=true; wave++; waveTotal=Math.floor(10+(wave-1)*1.5); spawned=0; spawnTimer=0.35+Math.random()*0.4; updateHUD(); startBtn.style.display='none'; }
    else if(gameOver && cakeHP<=0){ startBtn.style.display='none'; reset(); }
  });

  let last=performance.now();
  function frame(now){ const dt=Math.min(0.03, (now-last)/1000); last=now;
    try { drawBG(); drawArena(); drawCake(); if(running && !gameOver){ spawnWaveIfNeeded(dt); tickAnts(dt); } drawAnts(); }
    catch(err){ log('ERROR in frame:', err && err.message ? err.message : String(err)); }
    requestAnimationFrame(frame);
  } requestAnimationFrame(frame);

  function drawBG(){ ctx.fillStyle='#101114'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=0.06;
    for(let i=0;i<12;i++){ ctx.fillStyle=i%2?'#1a1c1f':'#15171a'; ctx.fillRect(0, i*(H/12), W, H/12); } ctx.globalAlpha=1; }
  function drawArena(){ ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(CX,CY,arenaRadius,0,Math.PI*2); ctx.stroke(); }
  function drawCake(){ const size=Math.min(150, Math.max(100, Math.min(W,H)*0.18)); ctx.drawImage(cakeImg, CX-size/2, CY-size/2, size, size); }
  function tickAnts(dt){ for(const a of ants){ if(!a.alive) continue; const dx=CX-a.x, dy=CY-a.y; const len=Math.hypot(dx,dy)||1;
      a.x += (dx/len)*a.speed*dt; a.y += (dy/len)*a.speed*dt; a.angle=Math.atan2(dy,dx); const d=Math.hypot(a.x-CX, a.y-CY);
      if(d<=36){ a.alive=false; cakeHP--; showToast('They got a bite!'); if(cakeHP<=0){ gameOver=true; running=false; startBtn.textContent='Restart'; startBtn.style.display='block'; } }
    } const alive=ants.filter(a=>a.alive).length;
    if(alive===0 && spawned>=waveTotal && cakeHP>0){ gameOver=true; running=false; startBtn.textContent='Next Wave'; startBtn.style.display='block'; showToast('Wave cleared'); updateHUD(); }
    updateHUD();
  }
  function drawAnts(){ for(const a of ants){ if(!a.alive) continue; const s=64; ctx.save(); ctx.translate(a.x,a.y); ctx.rotate(a.angle+Math.PI/2); ctx.drawImage(antImg,-s/2,-s/2,s,s); ctx.restore(); } }
  let toastTimer=0; function showToast(msg){ toast.textContent=msg; toast.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.classList.remove('show'),600); log('toast:', msg); }
})();