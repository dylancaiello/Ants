// Ants Game v6.10 DEBUG
(() => {
  'use strict';

  const BUILD_VERSION = 'v6.10 DEBUG';

  // Canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  // WebAudio
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const audioCtx = new AudioCtx();
  let popBuffer = null;

  // Asset loading
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function loadArrayBuffer(url) {
    return fetch(url).then(r => r.arrayBuffer());
  }
  async function loadAudioBuffer(url) {
    const buf = await loadArrayBuffer(url);
    return new Promise((resolve, reject) => {
      audioCtx.decodeAudioData(buf.slice(0), resolve, reject);
    });
  }

  // Configurable sprite meta if using sprite sheets
  // For the provided placeholders, frames=1 (static).
  const SPRITES = {
    stain: { src: 'assets/stain.png', frameWidth: 256, frameHeight: 256, frames: 1, fps: 0, life: 0.8 },
    splat: { src: 'assets/splat.png', frameWidth: 256, frameHeight: 256, frames: 1, fps: 0, life: 0.6 }
  };

  const WORLD = {
    width: canvas.width,
    height: canvas.height
  };

  // Entities
  const ants = [];
  const effectsBelow = []; // stains
  const effectsAbove = []; // splats

  // Debug
  let debug = true;
  let lastFpsTime = 0;
  let frameCount = 0;
  let fps = 0;

  function rand(min, max) { return Math.random() * (max - min) + min; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  class SpriteAnimation {
    constructor(img, frameWidth, frameHeight, frames, fps, life) {
      this.img = img;
      this.fw = frameWidth;
      this.fh = frameHeight;
      this.frames = Math.max(1, frames|0);
      this.fps = fps || 0;
      this.life = life || 0.7; // seconds
      this.time = 0;
      this.frameIndex = 0;
      this.dead = false;
      this.rotation = rand(0, Math.PI*2);
      this.scale = rand(0.75, 1.15);
      // Position set externally
      this.x = 0;
      this.y = 0;
    }
    update(dt) {
      this.time += dt;
      if (this.fps > 0 && this.frames > 1) {
        this.frameIndex = Math.min(this.frames-1, Math.floor(this.time * this.fps));
      }
      if (this.life > 0 && this.time >= this.life) {
        this.dead = true;
      }
    }
    draw(ctx) {
      const sx = (this.frameIndex * this.fw) % this.img.width;
      const sy = Math.floor((this.frameIndex * this.fw) / this.img.width) * this.fh;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.rotation);
      ctx.scale(this.scale, this.scale);
      ctx.drawImage(this.img, sx, sy, this.fw, this.fh, -this.fw/2, -this.fh/2, this.fw, this.fh);
      ctx.restore();
    }
  }

  class Ant {
    constructor(x, y) {
      this.x = x;
      this.y = y;
      this.vx = rand(-40, 40);
      this.vy = rand(-40, 40);
      this.radius = 10;
      this.dead = false;
    }
    update(dt) {
      if (this.dead) return;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (this.x < 0 || this.x > WORLD.width) this.vx *= -1;
      if (this.y < 0 || this.y > WORLD.height) this.vy *= -1;
    }
    draw(ctx) {
      if (this.dead) return;
      // simple ant placeholder
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = '#3a3';
      ctx.beginPath();
      ctx.arc(0, 0, this.radius, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = '#262';
      ctx.beginPath();
      ctx.arc(8, -6, 3, 0, Math.PI*2);
      ctx.arc(8,  6, 3, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    }
  }

  // Audio: play pop with pitch variation ±100–200 cents
  function playPop() {
    if (!popBuffer) return;
    const src = audioCtx.createBufferSource();
    src.buffer = popBuffer;

    // random cents between -200 and +200
    const cents = (Math.random() * 400) - 200;
    const rate = Math.pow(2, cents / 1200);
    src.playbackRate.value = rate;

    const gain = audioCtx.createGain();
    gain.gain.value = 0.8;
    src.connect(gain).connect(audioCtx.destination);
    src.start();
  }

  function spawnAnt(x, y) {
    ants.push(new Ant(x ?? rand(40, WORLD.width-40), y ?? rand(40, WORLD.height-40)));
  }

  function killAnt(ant) {
    if (ant.dead) return;
    ant.dead = true;

    // stain below
    const sMeta = SPRITES.stain;
    const stain = new SpriteAnimation(Images.stain, sMeta.frameWidth, sMeta.frameHeight, sMeta.frames, sMeta.fps, sMeta.life);
    stain.x = ant.x;
    stain.y = ant.y;
    effectsBelow.push(stain);

    // splat above
    const pMeta = SPRITES.splat;
    const splat = new SpriteAnimation(Images.splat, pMeta.frameWidth, pMeta.frameHeight, pMeta.frames, pMeta.fps, pMeta.life);
    splat.x = ant.x;
    splat.y = ant.y;
    effectsAbove.push(splat);

    playPop();
  }

  // Mouse interaction
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const my = (e.clientY - rect.top) * (canvas.height / rect.height);
    // pick first live ant within radius
    for (let i=0;i<ants.length;i++) {
      const a = ants[i];
      if (a.dead) continue;
      const dx = a.x - mx, dy = a.y - my;
      if (dx*dx + dy*dy <= a.radius*a.radius) {
        killAnt(a);
        break;
      }
    }
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') {
      debug = !debug;
    } else if (e.key === 's' || e.key === 'S') {
      spawnAnt();
    }
  });

  // Preload
  const Images = { stain: null, splat: null };
  Promise.all([
    loadImage(SPRITES.stain.src).then(img => Images.stain = img),
    loadImage(SPRITES.splat.src).then(img => Images.splat = img),
    loadAudioBuffer('audio/pop.wav').then(buf => popBuffer = buf).catch(() => null)
  ]).then(() => {
    // Auto-spawn a few ants
    for (let i=0;i<6;i++) spawnAnt();
    audioCtx.resume && audioCtx.resume();
    lastTime = performance.now();
    requestAnimationFrame(loop);
  });

  let lastTime = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  function update(dt) {
    for (const a of ants) a.update(dt);
    // cleanup dead ants after effects finish
    for (let i=ants.length-1; i>=0; i--) {
      if (ants[i].dead) {
        // wait until splat is done (roughly controlled by life)
        // For simplicity, remove immediately; in a real build you might delay removal.
      }
    }
    for (const e of effectsBelow) e.update(dt);
    for (const e of effectsAbove) e.update(dt);
    // remove finished effects
    for (let i=effectsBelow.length-1; i>=0; i--) if (effectsBelow[i].dead) effectsBelow.splice(i,1);
    for (let i=effectsAbove.length-1; i>=0; i--) if (effectsAbove[i].dead) effectsAbove.splice(i,1);

    // FPS calc
    frameCount++;
    const t = performance.now();
    if (t - lastFpsTime >= 500) {
      fps = Math.round(frameCount * 1000 / (t - lastFpsTime));
      frameCount = 0;
      lastFpsTime = t;
    }
  }

  function draw() {
    ctx.clearRect(0,0,canvas.width, canvas.height);
    // background grid for debug visibility
    ctx.fillStyle = '#202020';
    ctx.fillRect(0,0,canvas.width, canvas.height);
    ctx.strokeStyle = '#2b2b2b';
    for (let x=0; x<canvas.width; x+=64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
    for (let y=0; y<canvas.height; y+=64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

    // draw order: below effects, ants, above effects
    for (const e of effectsBelow) e.draw(ctx);
    for (const a of ants) a.draw(ctx);
    for (const e of effectsAbove) e.draw(ctx);

    if (debug) {
      ctx.fillStyle = '#eaeaea';
      ctx.font = '14px system-ui, sans-serif';
      ctx.fillText(`Build: ${BUILD_VERSION}`, 10, 20);
      ctx.fillText(`Ants: ${ants.filter(a=>!a.dead).length}  Effects: ${effectsBelow.length + effectsAbove.length}  FPS: ${fps}`, 10, 40);
      ctx.fillText(`Click an ant to splat. Keys: [D]=debug, [S]=spawn`, 10, 60);
    }
  }
})();
