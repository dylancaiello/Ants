// Ants v6.8 DEBUG — dmg=2, score=combo, smaller health bar, cake flash & edge hit, ant collision
(function(){

  const debug=document.getElementById('debug');
  const log=(...a)=>{ if(debug){ debug.textContent += a.join(' ') + "\n"; } console.log('[Ants]', ...a); };
  window.onerror=(m,s,l,c,e)=>{ log('ERROR:', m, '@', s, l+':'+c); };


  // DEBUG: unregister any SW
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations && navigator.serviceWorker.getRegistrations().then(regs=>{
      regs.forEach(r=>r.unregister());
      log('DEBUG: unregistered SWs:', regs.length);
    });
  }

  log('boot v6.8 DEBUG');

  const DPR=Math.min(3, devicePixelRatio||1);
  const canvas=document.getElementById('game');
  const ctx=canvas.getContext('2d', {alpha:false});
  const startBtn=document.getElementById('startBtn');
  const waveEl=document.getElementById('wave');
  const antsEl=document.getElementById('ants');
  const hpEl=document.getElementById('hp');
  const scoreEl=document.getElementById('score');
  const comboLabel=document.getElementById('comboLabel');
  const comboFill=document.getElementById('comboFill');
  const toast=document.getElementById('toast');
  const spritesLayer=document.getElementById('sprites');
  const cakeSprite=document.getElementById('cakeSprite');
  const healthFg=document.getElementById('healthFg');

  // Audio
  let ac, popBuf=null;
  function initAudio(){ try{ ac = new (window.AudioContext||window.webkitAudioContext)(); }catch(_e){ ac=null; }
    if(!ac) return;
    fetch('assets/pop.mp3').then(r=>r.arrayBuffer()).then(ab=>ac.decodeAudioData(ab)).then(buf=>{ popBuf=buf; log('audio decoded'); }).catch(()=>{});
  }
  function playPop(){ if(popBuf && ac && ac.state!=='suspended'){ const s=ac.createBufferSource(); s.buffer=popBuf; const g=ac.createGain(); g.gain.value=0.7; s.connect(g); g.connect(ac.destination); s.start(0); } }

  let W=0,H=0,CX=0,CY=0, arenaRadius=0, cakeRadius=60;
  function resize(){ W=innerWidth; H=innerHeight; CX=W*0.5; CY=H*0.5;
    canvas.width=W*DPR; canvas.height=H*DPR; canvas.style.width=W+'px'; canvas.style.height=H+'px';
    ctx.setTransform(DPR,0,0,DPR,0,0);
    arenaRadius=Math.min(W,H)*0.42;
    const cakeSize = Math.min(180, Math.max(110, Math.min(W,H)*0.20));
    cakeSprite.style.width = cakeSize + 'px';
    cakeSprite.style.height = 'auto';
    cakeSprite.style.left = '50%'; cakeSprite.style.top = '50%';
    cakeRadius = cakeSize * 0.48; // hit roughly at cake edge
    log('resize', W, H, 'arena', arenaRadius.toFixed(1), 'cake', cakeSize, 'cakeRadius', cakeRadius.toFixed(1));
  }
  addEventListener('resize', resize, {passive:true}); resize();

  // Game state
  let running=false, gameOver=false, wave=1, cakeHP=50, score=0;
  const ants=[]; const TAP_RADIUS=32;
  let waveTotal=10, spawned=0, spawnTimer=0.4+Math.random()*0.4;

  // Combo logic
  let combo=1, comboTimer=0, COMBO_WINDOW=1.2;
  function bumpCombo(){ const now=performance.now()/1000;
    if(now - comboTimer <= COMBO_WINDOW) combo++; else combo=1;
    comboTimer = now;
    comboLabel.textContent='Combo x'+combo;
    comboFill.style.width = '100%'; // refill on hit
  }
  function tickCombo(dt){ if(combo>1 or combo==1){ // always show decay fill
      const elapsed = Math.max(0, (performance.now()/1000) - comboTimer);
      const rem = Math.max(0, COMBO_WINDOW - elapsed);
      comboFill.style.width = (rem/COMBO_WINDOW*100)+'%';
      if(rem<=0) combo=1, comboLabel.textContent='Combo x1';
  } }

  // Ant creation
  function makeAnt(){ const ang=Math.random()*Math.PI*2; const r=arenaRadius+40+Math.random()*30;
    const x=CX+Math.cos(ang)*r; const y=CY+Math.sin(ang)*r; const speed=70+Math.random()*40+wave*6;
    const el=document.createElement('img'); el.src='assets/ant.png'; el.className='sprite ant'; el.alt='ant'; el.style.width='64px'; el.style.height='64px'; spritesLayer.appendChild(el);
    return {x,y,angle:Math.atan2(CY-y,CX-x),speed,alive:true,el};
  }

  function reset(){ running=true; gameOver=false; wave=1; cakeHP=50; score=0; combo=1; comboLabel.textContent='Combo x1'; comboFill.style.width='0%';
    for(const a of ants){ if(a.el && a.el.parentNode) a.el.parentNode.removeChild(a.el); }
    ants.length=0; waveTotal=10; spawned=0; spawnTimer=0.35+Math.random()*0.4;
    updateHUD(); log('reset -> wave', wave, 'waveTotal', waveTotal);
  }

  function spawnBurst(){ const remaining=waveTotal-spawned; if(remaining<=0) return;
    const pool=[1,1,1,1,2,2,3]; let count=pool[(Math.random()*pool.length)|0]; count=Math.min(count, remaining);
    for(let i=0;i<count;i++) ants.push(makeAnt());
    spawned+=count; log('spawn', count, 'spawned', spawned, 'of', waveTotal);
    spawnTimer=0.35+Math.random()*0.75;
  }
  function spawnWaveIfNeeded(dt){ if(!running||gameOver) return; if(spawned<waveTotal){ spawnTimer-=dt; if(spawnTimer<=0) spawnBurst(); } }

  function updateHUD(){ waveEl.textContent='Wave '+wave; antsEl.textContent='Ants: '+ants.filter(a=>a.alive).length; hpEl.textContent='Cake: '+cakeHP; scoreEl.textContent='Score: '+score; healthFg.style.width=(Math.max(0,cakeHP)/50*100)+'%'; }

  function blip(x,y,txt){ const b=document.createElement('div'); b.className='blip'; b.textContent=txt; b.style.left=x+'px'; b.style.top=y+'px'; spritesLayer.appendChild(b);
    requestAnimationFrame(()=> b.classList.add('show'));
    setTimeout(()=> b.remove(), 420);
  }

  function handlePointer(e){ if(!ac) initAudio(); else if(ac.state==='suspended') ac.resume();
    const r=canvas.getBoundingClientRect(); const px=(e.clientX-r.left); const py=(e.clientY-r.top);
    if(!running||gameOver) return; let hit=false;
    for(const a of ants){ if(!a.alive) continue; const dx=a.x-px, dy=a.y-py; if(dx*dx+dy*dy<=TAP_RADIUS*TAP_RADIUS){ a.alive=false; hit=true;
          bumpCombo(); const gain = combo; score += gain; playPop(); blip(a.x, a.y, '+'+gain);
          if(a.el){ a.el.classList.add('squash'); setTimeout(()=> a.el.remove(), 200); }
    } }
    if(hit) updateHUD();
  }
  canvas.addEventListener('pointerdown',(e)=>{ e.preventDefault(); handlePointer(e); },{passive:false});

  startBtn.addEventListener('click', ()=>{ if(!ac) initAudio(); else if(ac.state==='suspended') ac.resume();
    if(!running && !gameOver){ startBtn.style.display='none'; reset(); }
    else if(gameOver && cakeHP>0){ gameOver=false; running=true; wave++; waveTotal=Math.floor(10+(wave-1)*1.5); spawned=0; spawnTimer=0.35+Math.random()*0.4; updateHUD(); startBtn.style.display='none'; }
    else if(gameOver && cakeHP<=0){ startBtn.style.display='none'; reset(); }
  });

  // Physics helpers
  function antSeparation(dt){ const MIN_DIST=38; const PUSH=120; // px/sec correction
    for(let i=0;i<ants.length;i++){ const a=ants[i]; if(!a.alive) continue;
      for(let j=i+1;j<ants.length;j++){ const b=ants[j]; if(!b.alive) continue;
        const dx=b.x-a.x, dy=b.y-a.y; const d2=dx*dx+dy*dy; const min2=MIN_DIST*MIN_DIST;
        if(d2>0 && d2<min2){ const d=Math.sqrt(d2)||1; const overlap=(MIN_DIST-d); const nx=dx/d, ny=dy/d;
          // push them apart equally
          a.x -= nx*overlap*0.5; a.y -= ny*overlap*0.5;
          b.x += nx*overlap*0.5; b.y += ny*overlap*0.5;
          // slight angle tweak so they steer around
          a.angle = Math.atan2((CY-a.y), (CX-a.x));
          b.angle = Math.atan2((CY-b.y), (CX-b.x));
        }
      }
    }
  }

  let last=performance.now();
  function frame(now){ const dt=Math.min(0.03,(now-last)/1000); last=now;
    try{ drawBG(); drawArena(); positionSprites(); if(running&&!gameOver){ spawnWaveIfNeeded(dt); antSeparation(dt); tickAnts(dt); } tickCombo(dt); }catch(err){ log('ERROR in frame:', err && err.message ? err.message : String(err)); }
    requestAnimationFrame(frame);
  } requestAnimationFrame(frame);

  function drawBG(){ ctx.fillStyle='#101114'; ctx.fillRect(0,0,W,H); ctx.globalAlpha=0.06;
    for(let i=0;i<12;i++){ ctx.fillStyle=i%2?'#1a1c1f':'#15171a'; ctx.fillRect(0,i*(H/12),W,H/12); } ctx.globalAlpha=1; }
  function drawArena(){ ctx.strokeStyle='#2a2a2a'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(CX,CY,arenaRadius,0,Math.PI*2); ctx.stroke(); }

  function positionSprites(){ for(const a of ants){ if(!a.el) continue; a.el.style.left = a.x+'px'; a.el.style.top = a.y+'px'; a.el.style.transform = 'translate(-50%,-50%) rotate(' + (a.angle*180/Math.PI + 90) + 'deg)'; } }

  function tickAnts(dt){ const BITE_DMG=2;
    for(const a of ants){ if(!a.alive) continue; const dx=CX-a.x, dy=CY-a.y; const len=Math.hypot(dx,dy)||1;
      // steer inward
      a.x += (dx/len)*a.speed*dt; a.y += (dy/len)*a.speed*dt; a.angle=Math.atan2(dy,dx);
      const d=Math.hypot(a.x-CX, a.y-CY);
      if(d<=cakeRadius){ // bite at cake edge
        a.alive=false; if(a.el) a.el.remove();
        cakeHP = Math.max(0, cakeHP - BITE_DMG);
        cakeSprite.classList.add('hurt'); setTimeout(()=>cakeSprite.classList.remove('hurt'), 120);
        toast.textContent='They got a bite!'; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),600);
        if(cakeHP<=0){ gameOver=true; running=false; startBtn.textContent='Restart'; startBtn.style.display='block'; }
      }
    }
    const alive=ants.filter(a=>a.alive).length;
    if(alive===0 && spawned>=waveTotal && cakeHP>0){ gameOver=true; running=false; startBtn.textContent='Next Wave'; startBtn.style.display='block'; 
      toast.textContent='Wave cleared'; toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),600);
    }
    updateHUD();
  }
})();