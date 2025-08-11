/* Cake Defense: Ant Rush - wave 1 prototype */
(() => {
  const DPR = Math.min(3, window.devicePixelRatio || 1);
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const startBtn = document.getElementById('startBtn');
  const waveEl = document.getElementById('wave');
  const antsEl = document.getElementById('ants');
  const hpEl = document.getElementById('hp');
  const toast = document.getElementById('toast');

  let W = 0, H = 0, CX = 0, CY = 0;
  function resize() {
    W = Math.floor(window.innerWidth);
    H = Math.floor(window.innerHeight);
    CX = W * 0.5;
    CY = H * 0.5;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    arenaRadius = Math.min(W, H) * 0.42;
  }
  window.addEventListener('resize', resize, { passive: true });
  resize();

  // Game state
  let running = false;
  let gameOver = false;
  let wave = 1;
  let cakeHP = 3;
  let arenaRadius = Math.min(W, H) * 0.42;

  const ants = [];
  const ANT_RADIUS = 14;
  const TAP_RADIUS = 28; // touch forgiveness

  function reset() {
    running = true;
    gameOver = false;
    wave = 1;
    cakeHP = 3;
    ants.length = 0;
    spawnWave(wave);
    updateHUD();
  }

  function spawnWave(n) {
    const count = n === 1 ? 10 : Math.floor(10 + (n-1) * 1.5);
    for (let i = 0; i < count; i++) ants.push(makeAnt());
  }

  function makeAnt() {
    // Spawn outside the arena circle, random direction toward center
    const angle = Math.random() * Math.PI * 2;
    const spawnR = arenaRadius + 40 + Math.random() * 30;
    const x = CX + Math.cos(angle) * spawnR;
    const y = CY + Math.sin(angle) * spawnR;
    const speed = 70 + Math.random() * 40 + wave * 6;
    return { x, y, angle, speed, alive: true };
  }

  function updateHUD() {
    waveEl.textContent = `Wave ${wave}`;
    antsEl.textContent = `Ants: ${ants.filter(a => a.alive).length}`;
    hpEl.textContent = `Cake: ${cakeHP}`;
  }

  // Controls: tap to squish
  function handlePointer(e) {
    if (!running || gameOver) return;
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left);
    const py = (e.clientY - rect.top);
    let hit = false;
    for (const a of ants) {
      if (!a.alive) continue;
      const dx = a.x - px;
      const dy = a.y - py;
      const dist2 = dx*dx + dy*dy;
      if (dist2 <= (TAP_RADIUS*TAP_RADIUS)) {
        a.alive = false;
        hit = true;
      }
    }
    if (hit) showToast('Splat!');
    updateHUD();
  }
  canvas.addEventListener('pointerdown', (e) => { e.preventDefault(); handlePointer(e); }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      // allow desktop testing
      const fake = { clientX: CX, clientY: CY };
      handlePointer(fake);
    }
  });

  startBtn.addEventListener('click', () => {
    startBtn.style.display = 'none';
    reset();
  });

  // Loop
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.03, (now - last) / 1000);
    last = now;

    drawBackground();

    // Draw arena circle
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(CX, CY, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Cake
    drawCake();

    if (running && !gameOver) {
      // Move ants
      for (const a of ants) {
        if (!a.alive) continue;
        const dx = CX - a.x;
        const dy = CY - a.y;
        const len = Math.hypot(dx, dy) || 1;
        const vx = (dx / len) * a.speed * dt;
        const vy = (dy / len) * a.speed * dt;
        a.x += vx;
        a.y += vy;

        // Reached cake?
        const distToCenter = Math.hypot(a.x - CX, a.y - CY);
        if (distToCenter <= 36) { // cake hit radius
          a.alive = false;
          cakeHP -= 1;
          shake(5, 250);
          showToast('They got a bite!');
          if (cakeHP <= 0) {
            gameOver = true;
            running = false;
            startBtn.textContent = 'Restart';
            startBtn.style.display = 'block';
          }
        }
      }

      // Clear dead ants array when finished
      const aliveCount = ants.filter(a => a.alive).length;

      // Wave complete
      if (aliveCount === 0 && cakeHP > 0) {
        gameOver = true;
        running = false;
        startBtn.textContent = 'Next Wave';
        startBtn.style.display = 'block';
        showToast('Wave cleared');
        wave += 1; // prep for next time
      }
      updateHUD();
    }

    // Draw ants
    for (const a of ants) {
      if (!a.alive) continue;
      drawAnt(a);
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Visuals
  function drawBackground() {
    ctx.fillStyle = '#101114';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 12; i++) {
      ctx.fillStyle = i % 2 ? '#1a1c1f' : '#15171a';
      ctx.fillRect(0, i * (H / 12), W, H / 12);
    }
    ctx.globalAlpha = 1;
  }

  function drawCake() {
    const r = 28;
    // plate
    ctx.fillStyle = '#e0e0e0';
    ctx.beginPath(); ctx.arc(CX, CY, r + 10, 0, Math.PI * 2); ctx.fill();
    // cake body
    ctx.fillStyle = '#f7c4c4';
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.fill();
    // frosting squiggle
    ctx.strokeStyle = '#b84a4a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let i = 0; i <= 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const rr = r + Math.sin(i * 0.7) * 2;
      const x = CX + Math.cos(ang) * rr;
      const y = CY + Math.sin(ang) * rr;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath(); ctx.stroke();
  }

  function drawAnt(a) {
    const body = ANT_RADIUS;
    // Body
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.ellipse(a.x, a.y, body * 0.55, body * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.ellipse(a.x + Math.cos(a.angle) * 10, a.y + Math.sin(a.angle) * 10, body * 0.25, body * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    // Legs
    ctx.strokeStyle = '#3a3a3a';
    ctx.lineWidth = 2;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(a.x - 8, a.y + i * 6);
      ctx.lineTo(a.x - 14, a.y + i * 10);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(a.x + 8, a.y + i * 6);
      ctx.lineTo(a.x + 14, a.y + i * 10);
      ctx.stroke();
    }
  }

  // Screen shake
  let shakeMag = 0, shakeEnd = 0;
  function shake(mag, durMs) {
    shakeMag = mag;
    shakeEnd = performance.now() + durMs;
    const origSetTransform = ctx.setTransform.bind(ctx);
    const base = { a: DPR, b: 0, c: 0, d: DPR, e: 0, f: 0 };
    const step = () => {
      if (performance.now() < shakeEnd) {
        const dx = (Math.random() * 2 - 1) * shakeMag;
        const dy = (Math.random() * 2 - 1) * shakeMag;
        ctx.setTransform(base.a, base.b, base.c, base.d, dx, dy);
        requestAnimationFrame(step);
      } else {
        ctx.setTransform(base.a, base.b, base.c, base.d, 0, 0);
      }
    };
    step();
  }

  // Toast
  let toastTimer = 0;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 600);
  }

  // Next wave logic on button press after clear or loss
  startBtn.addEventListener('click', () => {
    if (gameOver && cakeHP > 0) {
      // start next wave
      gameOver = false;
      running = true;
      spawnWave(wave);
      updateHUD();
      startBtn.style.display = 'none';
    } else if (gameOver && cakeHP <= 0) {
      // full reset
      startBtn.style.display = 'none';
      reset();
    }
  });
})();