/* Brawl Buns — a slingshot physics duel. Built on Matter.js.
   Local 2-player: both players demolish the SAME fort; highest score wins. */
(() => {
  const { Engine, Composite, Bodies, Body, Events, Vector } = Matter;

  // ---- fixed logical canvas, scaled to fit ----
  const W = 1280, H = 720;
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  function fit() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    canvas.style.width = W * s + 'px';
    canvas.style.height = H * s + 'px';
  }
  fit(); window.addEventListener('resize', fit);

  const GROUND_Y = H - 70;
  const ANCHOR = { x: 250, y: GROUND_Y - 190 };
  const MAX_STRETCH = 130;
  const POWER = 0.22;

  // ---- materials ----
  const MAT = {
    dough: { fill: '#e2a94e', edge: '#b97e28', hp: 55, pts: 55 },
    glass: { fill: 'rgba(150,220,255,.55)', edge: '#8fd0ff', hp: 26, pts: 45 },
    choc:  { fill: '#5a3a26', edge: '#3c2416', hp: 105, pts: 90 },
  };
  const BUN = ['🥐', '🥯']; // P1, P2
  const ENEMY_EMOJI = ['👾', '👹', '👺'];

  // ---- engine ----
  const engine = Engine.create();
  engine.gravity.y = 1.1;
  const world = engine.world;

  const ground = Bodies.rectangle(W / 2, GROUND_Y + 40, W * 2, 120, { isStatic: true });
  ground.gk = 'ground';
  const leftWall = Bodies.rectangle(-40, H / 2, 80, H * 2, { isStatic: true });
  Composite.add(world, [ground, leftWall]);

  // ---- game state ----
  let state = 'menu';           // menu | aiming | flying | settling
  let player = 1;
  const scores = { 1: 0, 2: 0 };
  let score = 0, ammoTotal = 5, ammoLeft = 0;
  let bun = null, aiming = false, dragPos = null;
  let dynamicBodies = [];       // blocks + enemies + spent buns to clear on reset
  let enemies = [];
  let particles = [], floats = [];
  let shake = 0, settleTimer = 0, flyTimer = 0;
  let combo = 0, comboTimer = 0;

  // ---- level (deterministic so both players get the same fort) ----
  function buildLevel() {
    const fx = 900;            // fort x origin
    const add = (x, y, w, h, mat) => {
      const b = Bodies.rectangle(x, y, w, h, { friction: 0.6, restitution: 0.05, density: 0.0016 });
      b.gk = 'block'; b.mat = mat; b.hp = MAT[mat].hp; b.maxHp = MAT[mat].hp; b.bw = w; b.bh = h;
      Composite.add(world, b); dynamicBodies.push(b); return b;
    };
    const enemy = (x, y) => {
      const b = Bodies.circle(x, y, 24, { friction: 0.5, restitution: 0.2, density: 0.0012 });
      b.gk = 'enemy'; b.hp = 34; b.maxHp = 34; b.emoji = ENEMY_EMOJI[enemies.length % ENEMY_EMOJI.length];
      Composite.add(world, b); dynamicBodies.push(b); enemies.push(b); return b;
    };
    const g = GROUND_Y;
    // base pillars (chocolate bars)
    add(fx, g - 55, 34, 110, 'choc'); add(fx + 170, g - 55, 34, 110, 'choc');
    // platform
    add(fx + 85, g - 122, 240, 26, 'dough');
    // glass jars on top
    add(fx + 40, g - 158, 30, 46, 'glass'); add(fx + 130, g - 158, 30, 46, 'glass');
    // upper pillars + roof
    add(fx + 40, g - 205, 26, 60, 'dough'); add(fx + 130, g - 205, 26, 60, 'dough');
    add(fx + 85, g - 250, 200, 24, 'choc');
    // a second little tower
    add(fx + 250, g - 40, 30, 80, 'dough'); add(fx + 250, g - 100, 30, 40, 'glass');
    add(fx + 250, g - 140, 60, 20, 'dough');
    // enemies perched around the fort + the big monster
    enemy(fx + 85, g - 145);   // inside on platform
    enemy(fx + 85, g - 275);   // on the roof
    enemy(fx + 250, g - 165);  // little tower
    enemy(fx + 20, g - 20);    // guard on the ground
  }

  function clearWorld() {
    dynamicBodies.forEach((b) => Composite.remove(world, b));
    if (bun) Composite.remove(world, bun);
    dynamicBodies = []; enemies = []; particles = []; floats = []; bun = null;
  }

  function spawnBun() {
    if (ammoLeft <= 0) { bun = null; return; }
    ammoLeft--;
    bun = Bodies.circle(ANCHOR.x, ANCHOR.y, 26, { friction: 0.4, restitution: 0.35, density: 0.004 });
    bun.gk = 'bun'; bun.emoji = BUN[player - 1]; bun.launched = false; bun.life = 0;
    Body.setStatic(bun, true);
    Composite.add(world, bun);
    dynamicBodies.push(bun);
    state = 'aiming';
    renderAmmo();
  }

  // ---- turn / duel flow ----
  function startTurn(p) {
    player = p; score = 0; ammoLeft = ammoTotal; shake = 0;
    clearWorld(); buildLevel();
    updateHud();
    document.getElementById('playerPill').className = 'pill' + (p === 2 ? ' p2' : '');
    document.getElementById('playerEmoji').textContent = BUN[p - 1];
    document.getElementById('playerLabel').textContent = 'Player ' + p;
    document.getElementById('turnLabel').textContent = 'Your turn';
    spawnBun();
    banner('Player ' + p + ' — FIRE!', 1100);
  }
  function endTurn() {
    state = 'menu';
    // bonus for unused buns if the fort is cleared
    if (enemies.length === 0) { const bonus = ammoLeft * 300; score += bonus; if (bonus) floatText(W/2, 200, '+'+bonus+' clear bonus!', '#2fbf71'); }
    scores[player] = score;
    if (player === 1) {
      document.getElementById('handoffScore').textContent = score;
      document.getElementById('handoffTitle').textContent = 'Player 1 done! 🥐';
      show('handoff');
    } else {
      showResult();
    }
  }
  function showResult() {
    document.getElementById('rs1').textContent = scores[1];
    document.getElementById('rs2').textContent = scores[2];
    const p1 = scores[1], p2 = scores[2];
    const t = document.getElementById('resultTitle');
    document.getElementById('scP1').classList.toggle('win', p1 >= p2);
    document.getElementById('scP2').classList.toggle('win', p2 >= p1);
    if (p1 === p2) { t.textContent = "🤝 It's a tie!"; }
    else t.textContent = (p1 > p2 ? '🥐 Player 1 wins!' : '🥯 Player 2 wins!');
    document.getElementById('resultHint').textContent = 'Margin: ' + Math.abs(p1 - p2) + ' pts of crumbs.';
    show('result');
  }

  // ---- destruction & scoring ----
  function destroy(b, big) {
    if (b.dead) return; b.dead = true;
    combo++; comboTimer = 1.4;
    const mult = Math.max(1, combo);
    const base = b.gk === 'enemy' ? 500 : (MAT[b.mat] ? MAT[b.mat].pts : 30);
    const gain = base * mult;
    score += gain;
    burst(b.position.x, b.position.y, b.gk === 'enemy' ? '#e0345a' : (MAT[b.mat] ? MAT[b.mat].edge : '#c9812f'), big ? 22 : 12);
    floatText(b.position.x, b.position.y, '+' + gain + (mult > 1 ? ' x' + mult : ''), b.gk === 'enemy' ? '#ffd23e' : '#fff');
    shake = Math.min(18, shake + (b.gk === 'enemy' ? 12 : 6));
    if (combo >= 2) showCombo(combo);
    Composite.remove(world, b);
    if (b.gk === 'enemy') enemies = enemies.filter((e) => e !== b);
    dynamicBodies = dynamicBodies.filter((x) => x !== b);
    updateHud();
    if (enemies.length === 0 && state !== 'menu') { banner('FORT CLEARED! 🎉', 1400); setTimeout(() => { if (state !== 'menu') endTurn(); }, 900); }
  }

  Events.on(engine, 'collisionStart', (ev) => {
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (rel < 5.5) continue;
      const bunHit = a.gk === 'bun' || b.gk === 'bun';
      [ [a, b], [b, a] ].forEach(([t]) => {
        if ((t.gk === 'block' || t.gk === 'enemy') && !t.dead) {
          const dmg = rel * (bunHit ? 1.8 : 0.9);
          t.hp -= dmg;
          if (t.hp <= 0) destroy(t, bunHit);
        }
      });
    }
  });

  // ---- effects ----
  function burst(x, y, color, n) { for (let i = 0; i < n; i++) { const a = Math.random() * 6.28, sp = 2 + Math.random() * 7; particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, color, sz: 3 + Math.random() * 5 }); } }
  function floatText(x, y, txt, color) { floats.push({ x, y, txt, color, life: 1.2, vy: -1.1 }); }
  let comboEl = document.getElementById('comboPill'), comboHideT = 0;
  function showCombo(c) { comboEl.textContent = 'COMBO x' + c + ' 🔥'; comboEl.classList.add('show'); comboHideT = 1.2; }

  // ---- input (slingshot) ----
  function toLogical(e) { const r = canvas.getBoundingClientRect(); const p = e.touches ? e.touches[0] : e; return { x: (p.clientX - r.left) * (W / r.width), y: (p.clientY - r.top) * (H / r.height) }; }
  function grab(e) {
    if (state !== 'aiming' || !bun) return;
    const m = toLogical(e); if (Math.hypot(m.x - bun.position.x, m.y - bun.position.y) < 90) { aiming = true; dragPos = m; e.preventDefault(); }
  }
  function move(e) { if (!aiming) return; dragPos = toLogical(e); e.preventDefault(); }
  function release() {
    if (!aiming || !bun) return; aiming = false;
    const dx = ANCHOR.x - bun.position.x, dy = ANCHOR.y - bun.position.y;
    Body.setStatic(bun, false);
    Body.setVelocity(bun, { x: dx * POWER, y: dy * POWER });
    Body.setAngularVelocity(bun, 0.2);
    bun.launched = true; bun.life = 0; state = 'flying'; flyTimer = 0;
  }
  canvas.addEventListener('mousedown', grab); window.addEventListener('mousemove', move); window.addEventListener('mouseup', release);
  canvas.addEventListener('touchstart', grab, { passive: false }); window.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', release);
  window.addEventListener('keydown', (e) => { if (e.key === 'r' || e.key === 'R') { if (state !== 'menu') startTurn(player); } });

  // update held bun position from drag
  function updateAim() {
    if (!aiming || !bun) return;
    let dx = dragPos.x - ANCHOR.x, dy = dragPos.y - ANCHOR.y;
    const d = Math.hypot(dx, dy);
    if (d > MAX_STRETCH) { dx = dx / d * MAX_STRETCH; dy = dy / d * MAX_STRETCH; }
    Body.setPosition(bun, { x: ANCHOR.x + dx, y: ANCHOR.y + dy });
  }

  // ---- main loop ----
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(33, now - last); last = now;
    if (state !== 'menu') {
      updateAim();
      Engine.update(engine, dt);
      stepLifecycle(dt / 1000);
    }
    stepEffects(dt / 1000);
    draw();
    requestAnimationFrame(loop);
  }

  function stepLifecycle(dts) {
    if (comboTimer > 0) { comboTimer -= dts; if (comboTimer <= 0) combo = 0; }
    if (comboHideT > 0) { comboHideT -= dts; if (comboHideT <= 0) comboEl.classList.remove('show'); }
    // remove enemies/blocks that fall off the world
    for (const b of [...dynamicBodies]) {
      if (b.gk === 'enemy' && !b.dead && (b.position.y > H + 60 || b.position.x > W + 120 || b.position.x < -120)) destroy(b, false);
      if (b.gk === 'block' && (b.position.y > H + 200)) { Composite.remove(world, b); dynamicBodies = dynamicBodies.filter((x) => x !== b); }
    }
    // bun lifecycle
    if (state === 'flying' && bun) {
      flyTimer += dts; bun.life += dts;
      const slow = bun.speed < 0.7;
      const gone = bun.position.y > H + 80 || bun.position.x > W + 120 || bun.position.x < -120;
      if (gone || (slow && bun.life > 1.2) || flyTimer > 6) {
        if (bun) { Composite.remove(world, bun); dynamicBodies = dynamicBodies.filter((x) => x !== bun); }
        bun = null;
        if (ammoLeft > 0) { spawnBun(); } else { state = 'settling'; settleTimer = 0; }
      }
    }
    if (state === 'settling') {
      settleTimer += dts;
      const moving = dynamicBodies.some((b) => b.gk !== 'ground' && b.speed > 1.1);
      if ((!moving && settleTimer > 0.6) || settleTimer > 4) endTurn();
    }
  }

  function stepEffects(dts) {
    if (shake > 0) shake = Math.max(0, shake - dts * 40);
    particles = particles.filter((p) => (p.life -= dts * 1.4) > 0);
    particles.forEach((p) => { p.vy += 0.35; p.x += p.vx; p.y += p.vy; });
    floats = floats.filter((f) => (f.life -= dts) > 0);
    floats.forEach((f) => { f.y += f.vy; });
  }

  // ---- rendering ----
  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

    // parallax clouds + sun
    ctx.globalAlpha = 0.9;
    ctx.font = '90px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☀️', 150, 120); ctx.font = '70px serif';
    ctx.fillText('☁️', 520, 110); ctx.fillText('☁️', 900, 80); ctx.globalAlpha = 1;

    // ground (kitchen counter)
    ctx.fillStyle = '#c98a4a'; ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
    ctx.fillStyle = '#a86a2e'; ctx.fillRect(0, GROUND_Y, W, 10);
    ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x, GROUND_Y + 12); ctx.lineTo(x, H); ctx.stroke(); }

    drawSlingshot();

    // bodies
    for (const b of dynamicBodies) {
      if (b.gk === 'block') drawBlock(b);
      else if (b.gk === 'enemy') drawEmoji(b, 52);
    }
    if (bun) drawEmoji(bun, 48);

    // aim trajectory
    if (aiming && bun) drawTrajectory();

    // particles
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.sz, p.sz); }
    ctx.globalAlpha = 1;
    // floats
    ctx.textAlign = 'center'; ctx.font = '900 26px ' + getFont();
    for (const f of floats) { ctx.globalAlpha = Math.max(0, f.life); ctx.fillStyle = f.color; ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 4; ctx.strokeText(f.txt, f.x, f.y); ctx.fillText(f.txt, f.x, f.y); }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
  function getFont() { return "'Segoe UI',system-ui,sans-serif"; }

  function drawSlingshot() {
    const a = ANCHOR;
    // band to held bun
    if (bun && (aiming || state === 'aiming')) {
      ctx.strokeStyle = '#7a3b12'; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(a.x - 20, a.y - 8); ctx.lineTo(bun.position.x, bun.position.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.x + 20, a.y - 8); ctx.lineTo(bun.position.x, bun.position.y); ctx.stroke();
    }
    // wooden fork
    ctx.strokeStyle = '#8a4a1e'; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, GROUND_Y); ctx.lineTo(a.x, a.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(a.x - 22, a.y - 26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(a.x, a.y + 4); ctx.lineTo(a.x + 22, a.y - 26); ctx.stroke();
  }

  function drawTrajectory() {
    const dx = (ANCHOR.x - bun.position.x) * POWER, dy = (ANCHOR.y - bun.position.y) * POWER;
    let x = bun.position.x, y = bun.position.y, vx = dx, vy = dy;
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    for (let i = 0; i < 26; i++) { vy += 1.1 * (16 / 60); x += vx; y += vy; if (i % 2 === 0) { ctx.globalAlpha = 1 - i / 30; ctx.beginPath(); ctx.arc(x, y, 4, 0, 6.28); ctx.fill(); } }
    ctx.globalAlpha = 1;
  }

  function drawBlock(b) {
    const m = MAT[b.mat]; ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle);
    const w = b.bw, h = b.bh, r = 6;
    roundRect(-w / 2, -h / 2, w, h, r); ctx.fillStyle = m.fill; ctx.fill();
    ctx.strokeStyle = m.edge; ctx.lineWidth = 3; ctx.stroke();
    // damage cracks
    const dmg = 1 - b.hp / b.maxHp;
    if (dmg > 0.25) { ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w / 4, -h / 2); ctx.lineTo(0, 0); ctx.lineTo(-w / 6, h / 2); if (dmg > 0.6) { ctx.moveTo(w / 4, -h / 2); ctx.lineTo(0, h / 6); } ctx.stroke(); }
    ctx.restore();
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawEmoji(b, size) { ctx.save(); ctx.translate(b.position.x, b.position.y); ctx.rotate(b.angle); ctx.font = size + 'px serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.emoji, 0, 2); ctx.restore(); }

  // ---- HUD ----
  function updateHud() { document.getElementById('score').textContent = score; }
  function renderAmmo() {
    const el = document.getElementById('ammo'); el.innerHTML = '';
    for (let i = 0; i < ammoTotal; i++) { const d = document.createElement('span'); d.className = 'dot' + (i >= ammoLeft + (state === 'aiming' && bun ? 1 : 0) ? ' used' : ''); d.textContent = BUN[player - 1]; el.appendChild(d); }
  }
  const bannerEl = document.getElementById('banner');
  let bannerT;
  function banner(txt, ms) { bannerEl.textContent = txt; bannerEl.classList.add('show'); clearTimeout(bannerT); bannerT = setTimeout(() => bannerEl.classList.remove('show'), ms); }

  // ---- overlays / buttons ----
  function show(id) { document.querySelectorAll('.overlay').forEach((o) => o.classList.remove('show')); if (id) document.getElementById(id).classList.add('show'); }
  document.getElementById('startBtn').onclick = () => { show(null); startTurn(1); };
  document.getElementById('handoffBtn').onclick = () => { show(null); startTurn(2); };
  document.getElementById('rematchBtn').onclick = () => { show(null); scores[1] = 0; scores[2] = 0; startTurn(1); };
  document.getElementById('menuBtn').onclick = () => { show('menu'); state = 'menu'; clearWorld(); };
  document.getElementById('restart').onclick = () => { if (state !== 'menu') startTurn(player); };

  // expose a tiny hook for automated testing
  window.BrawlBuns = {
    get state() { return state; }, get score() { return score; }, get enemies() { return enemies.length; },
    start() { show(null); startTurn(1); },
    autoFire(vx = 16, vy = -9) { if (state === 'aiming' && bun) { Body.setStatic(bun, false); Body.setVelocity(bun, { x: vx, y: vy }); bun.launched = true; state = 'flying'; flyTimer = 0; } },
    _debug() { return { state, ammoLeft, bodies: world.bodies.length, bun: bun ? { x: Math.round(bun.position.x), y: Math.round(bun.position.y), sp: +bun.speed.toFixed(2), stat: bun.isStatic } : null }; },
    // deterministic simulation stepper (bypasses requestAnimationFrame throttling for tests)
    _tick(n = 60) { for (let i = 0; i < n; i++) { if (state !== 'menu') { updateAim(); Engine.update(engine, 16); stepLifecycle(16 / 1000); } stepEffects(16 / 1000); } return { state, score, enemies: enemies.length, bun: bun ? Math.round(bun.position.x) : null }; },
  };

  requestAnimationFrame(loop);
})();
