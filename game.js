'use strict';

const W = 1280, H = 720, GROUND = 640, GRAV = 0.85;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = a => a[randi(0, a.length - 1)];

/* ================= AUDIO ================= */
const Sfx = {
  ctx: null,
  ensure() {
    if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {} }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  tone(f0, f1, dur, type, vol) {
    if (!this.ctx) return;
    type = type || 'square'; vol = vol || 0.07;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol) {
    if (!this.ctx) return;
    vol = vol || 0.12;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(g); g.connect(this.ctx.destination); src.start(t);
  },
  play(name) {
    this.ensure();
    if (!this.ctx) return;
    switch (name) {
      case 'hit': this.noise(0.07, 0.18); this.tone(220, 70, 0.09); break;
      case 'hitBig': this.noise(0.16, 0.28); this.tone(160, 45, 0.22, 'sawtooth', 0.1); break;
      case 'whoosh': this.tone(650, 180, 0.08, 'sine', 0.035); break;
      case 'block': this.tone(320, 300, 0.06, 'square', 0.05); this.noise(0.04, 0.06); break;
      case 'jump': this.tone(240, 520, 0.12, 'sine', 0.04); break;
      case 'special': this.tone(90, 950, 0.4, 'sawtooth', 0.08); break;
      case 'ko': this.tone(320, 35, 0.7, 'sawtooth', 0.14); this.noise(0.3, 0.25); break;
      case 'select': this.tone(520, 760, 0.08, 'sine', 0.05); break;
      case 'bell': this.tone(880, 860, 0.5, 'sine', 0.1); break;
      case 'shoot': this.tone(400, 900, 0.15, 'sawtooth', 0.06); break;
    }
  }
};

/* ================= PERSONNAGES ================= */
const CHARACTERS = [
  {
    id: 'po', name: 'Po', title: 'Le Guerrier Dragon',
    desc: 'Énorme et imprévisible, le Panda Guerrier écrase tout sur son passage.',
    colors: { fur: '#f2ede0', belly: '#faf7ef', limb: '#2e2b28', accent: '#a03028', pants: '#5b3a1e' },
    size: 1.3, hp: 130, speed: 2.3, power: 1.2,
    special: { name: 'Charge du Panda Piqué', type: 'dash', dmg: 24 }
  },
  {
    id: 'tigress', name: 'Tigresse', title: 'Maîtresse du Poing de Fer',
    desc: 'Rapide, précise, impitoyable. Ses coups sont aussi nets que ses griffes.',
    colors: { fur: '#e8912d', belly: '#f7e3c3', limb: '#e8912d', accent: '#7a4a12', pants: '#4a2c14' },
    size: 1.0, hp: 100, speed: 3.0, power: 1.05,
    special: { name: 'Griffes Silencieuses', type: 'dash', dmg: 22 }
  },
  {
    id: 'monkey', name: 'Singe', title: "L'Acrobate au Bâton",
    desc: 'Jongleur de bâton, agile et farceur. Difficile à toucher.',
    colors: { fur: '#8a5a2b', belly: '#d9b98a', limb: '#6d4420', accent: '#c9a15f', pants: '#7a2a1e' },
    size: 0.95, hp: 95, speed: 3.2, power: 0.95,
    special: { name: 'Danse du Bâton', type: 'rush', dmg: 8, hits: 3 }
  },
  {
    id: 'mantis', name: 'Mante', title: 'Le Poing Minuscule',
    desc: "Tout petit, ultra rapide. Ses piqures s'enchaînent à une vitesse folle.",
    colors: { fur: '#7cb518', belly: '#a8d84f', limb: '#5a8a10', accent: '#3f5e0a', pants: '#3f5e0a' },
    size: 0.7, hp: 80, speed: 3.6, power: 0.85,
    special: { name: 'Mille Aiguilles', type: 'rush', dmg: 6, hits: 4 }
  },
  {
    id: 'viper', name: 'Vipère', title: 'La Grâce Foudroyante',
    desc: "Souple comme l'eau, mordante comme le tonnerre.",
    colors: { fur: '#4f9d69', belly: '#cfe8b8', limb: '#3a7a4e', accent: '#2d5e3c', pants: '#2d5e3c' },
    size: 0.95, hp: 90, speed: 3.1, power: 0.9,
    special: { name: 'Crachat de Jade', type: 'projectile', dmg: 16 }
  },
  {
    id: 'crane', name: 'Grue', title: 'Les Ailes de la Paix',
    desc: 'Maîtrise du ciel : ses rafales de vent frappent à distance.',
    colors: { fur: '#f2f0ea', belly: '#ffffff', limb: '#d8d4c8', accent: '#b23b2e', pants: '#8a8578' },
    size: 1.0, hp: 90, speed: 2.9, power: 0.9,
    special: { name: 'Rafale des Cent Plumes', type: 'projectile', dmg: 14 }
  },
  {
    id: 'tailung', name: 'Taï Lung', title: 'Le Léopard des Neiges',
    desc: "L'élève déchu. Une puissance brutale et une haine froide.",
    colors: { fur: '#b9b3a8', belly: '#ded8cc', limb: '#8a8478', accent: '#5a544c', pants: '#5f3b6e' },
    size: 1.1, hp: 115, speed: 2.8, power: 1.2,
    special: { name: 'Poing du Léopard', type: 'dash', dmg: 26 }
  },
  {
    id: 'shen', name: 'Lord Shen', title: 'Le Paon Albino',
    desc: "Génie machiavélique armé de canons à feu d'artifice.",
    colors: { fur: '#f4f2ec', belly: '#ffffff', limb: '#e0dccf', accent: '#a02328', pants: '#a02328' },
    size: 1.0, hp: 95, speed: 3.0, power: 1.0,
    special: { name: "Canon à Feu d'Artifice", type: 'projectile', dmg: 18 }
  },
  {
    id: 'kai', name: 'Kaï', title: 'Le Collectionneur de Chi',
    desc: "Le Général Jade revenu d'entre les morts, armé de lames spectrales.",
    colors: { fur: '#6e7d6a', belly: '#8a9a84', limb: '#54604f', accent: '#3ddc84', pants: '#3a3f36' },
    size: 1.2, hp: 125, speed: 2.4, power: 1.3,
    special: { name: 'Lames de Jade', type: 'projectile', dmg: 17 }
  },
  {
    id: 'shifu', name: 'Maître Shifu', title: 'Le Petit Grand Maître',
    desc: 'Petit par la taille, immense par le savoir. Son onde de chi traverse tout.',
    colors: { fur: '#c96a2d', belly: '#e8d3ae', limb: '#a04e1c', accent: '#7a4a12', pants: '#6d4420' },
    size: 0.8, hp: 90, speed: 3.0, power: 1.0,
    special: { name: 'Onde du Maître', type: 'projectile', dmg: 15 }
  }
];

const charById = id => CHARACTERS.find(c => c.id === id);

/* ================= ARÈNES ================= */
const STAGES = [
  {
    id: 'palace', name: 'Palais de Jade',
    draw(ctx, t) {
      let g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#f7b267'); g.addColorStop(0.6, '#e8875a'); g.addColorStop(1, '#a04a3a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = 'rgba(90,50,70,0.5)';
      for (let i = 0; i < 5; i++) {
        const mx = i * 320 - 100, mh = 180 + (i % 2) * 70;
        ctx.beginPath(); ctx.moveTo(mx - 160, GROUND); ctx.quadraticCurveTo(mx, GROUND - mh * 2, mx + 160, GROUND); ctx.fill();
      }
      ctx.fillStyle = '#7a2a1e';
      ctx.fillRect(160, GROUND - 300, 960, 300);
      ctx.fillStyle = '#5a1a10';
      for (let i = 0; i < 7; i++) ctx.fillRect(180 + i * 140, GROUND - 300, 26, 300);
      ctx.fillStyle = '#2e7d4f';
      for (let r = 0; r < 2; r++) {
        const rw = 1060 - r * 480, rx = 640, ry = GROUND - 310 - r * 90;
        ctx.beginPath();
        ctx.moveTo(rx - rw / 2, ry);
        ctx.quadraticCurveTo(rx, ry - 90, rx + rw / 2, ry);
        ctx.quadraticCurveTo(rx, ry - 30, rx - rw / 2, ry);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd54f';
      for (let i = 0; i < 6; i++) {
        const lx = 250 + i * 156, ly = GROUND - 180 + Math.sin(t * 0.03 + i) * 4;
        ctx.beginPath(); ctx.ellipse(lx, ly, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
      }
      const petals = ['#f7a8b8', '#fbd0d8', '#e88aa0'];
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 14; i++) {
        const px = (i * 173 + t * (0.6 + (i % 3) * 0.3)) % (W + 40) - 20;
        const py = (i * 97 + t * (1 + (i % 2))) % GROUND;
        ctx.fillStyle = petals[i % 3];
        ctx.beginPath(); ctx.ellipse(px, py, 5, 3, i + t * 0.02, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4a3423'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#5d4430';
      for (let i = 0; i < 20; i++) ctx.fillRect(i * 64 + ((i % 2) * 10), GROUND, 54, H - GROUND);
    }
  },
  {
    id: 'bridge', name: 'Pont de Corde',
    draw(ctx, t) {
      let g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#8ab6c9'); g.addColorStop(1, '#4a6a7a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = 'rgba(60,80,90,0.6)';
      for (let i = 0; i < 4; i++) {
        const mx = 150 + i * 380;
        ctx.beginPath(); ctx.moveTo(mx - 220, GROUND); ctx.lineTo(mx, GROUND - 420 - (i % 2) * 120); ctx.lineTo(mx + 220, GROUND); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      for (let i = 0; i < 6; i++) {
        const cx = (i * 260 + t * 0.4) % (W + 300) - 150, cy = 80 + (i % 3) * 60;
        ctx.beginPath(); ctx.ellipse(cx, cy, 90, 26, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = '#6d4b1f'; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(0, 120); ctx.quadraticCurveTo(W / 2, 160, W, 120); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 200); ctx.quadraticCurveTo(W / 2, 240, W, 200); ctx.stroke();
      ctx.lineWidth = 3;
      for (let i = 0; i < 16; i++) { const x = i * 85; ctx.beginPath(); ctx.moveTo(x, 122 + Math.sin(i) * 8); ctx.lineTo(x, 200 + Math.sin(i) * 8); ctx.stroke(); }
      ctx.fillStyle = '#5d4430';
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#7a5a38';
      for (let i = 0; i < 22; i++) ctx.fillRect(i * 60, GROUND + 4, 52, 16);
      ctx.fillStyle = 'rgba(200,220,230,0.12)';
      ctx.fillRect(0, GROUND - 60, W, 60);
    }
  },
  {
    id: 'village', name: 'Vallée de la Paix',
    draw(ctx, t) {
      let g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#3a2a5a'); g.addColorStop(0.55, '#c94f3a'); g.addColorStop(1, '#e8a04a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(980, 420, 70, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 9; i++) {
        const bx = i * 160 - 60, bh = 180 + ((i * 53) % 120);
        ctx.fillStyle = 'rgba(40,25,50,0.85)';
        ctx.fillRect(bx, GROUND - bh, 150, bh);
        ctx.fillStyle = '#1e1428';
        ctx.beginPath();
        ctx.moveTo(bx - 18, GROUND - bh); ctx.quadraticCurveTo(bx + 75, GROUND - bh - 70, bx + 168, GROUND - bh);
        ctx.lineTo(bx + 168, GROUND - bh + 26); ctx.lineTo(bx - 18, GROUND - bh + 26); ctx.fill();
        ctx.fillStyle = '#ffce54';
        for (let w = 0; w < 3; w++) if ((i + w) % 2 === 0) ctx.fillRect(bx + 25 + w * 42, GROUND - bh + 60, 22, 30);
      }
      for (let i = 0; i < 8; i++) {
        const lx = 100 + i * 160, ly = 150 + (i % 3) * 40 + Math.sin(t * 0.02 + i) * 5;
        ctx.fillStyle = '#c94f3a';
        ctx.beginPath(); ctx.ellipse(lx, ly, 12, 16, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,180,80,0.25)';
        ctx.beginPath(); ctx.arc(lx, ly, 26, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#33241a'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#4a3423';
      for (let i = 0; i < 20; i++) ctx.fillRect(i * 64, GROUND, 60, H - GROUND);
    }
  },
  {
    id: 'snow', name: 'Prison de Chorh-Gom',
    draw(ctx, t) {
      let g = ctx.createLinearGradient(0, 0, 0, GROUND);
      g.addColorStop(0, '#1a2436'); g.addColorStop(1, '#4a5a72');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, GROUND);
      ctx.fillStyle = '#2a3648';
      for (let i = 0; i < 5; i++) {
        const mx = i * 340 - 80;
        ctx.beginPath(); ctx.moveTo(mx - 200, GROUND); ctx.lineTo(mx, GROUND - 480 - (i % 2) * 100); ctx.lineTo(mx + 200, GROUND); ctx.fill();
      }
      ctx.fillStyle = '#dde6ee';
      for (let i = 0; i < 5; i++) {
        const mx = i * 340 - 80;
        ctx.beginPath(); ctx.moveTo(mx - 60, GROUND - 380 - (i % 2) * 80); ctx.lineTo(mx, GROUND - 480 - (i % 2) * 100); ctx.lineTo(mx + 60, GROUND - 380 - (i % 2) * 80); ctx.fill();
      }
      ctx.strokeStyle = '#5a6a7a'; ctx.lineWidth = 8;
      for (let i = 0; i < 4; i++) {
        const cx = 180 + i * 300;
        ctx.beginPath(); ctx.moveTo(cx, 0);
        for (let y = 0; y < 300; y += 30) ctx.lineTo(cx + Math.sin(y * 0.05 + i) * 14, y);
        ctx.stroke();
        ctx.fillStyle = '#8a94a2';
        ctx.beginPath(); ctx.arc(cx, 300, 12, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.globalAlpha = 0.7;
      for (let i = 0; i < 40; i++) {
        const sx = (i * 137 + t * (1.4 + (i % 3) * 0.5)) % W;
        const sy = (i * 89 + t * (2 + (i % 4) * 0.7)) % GROUND;
        ctx.beginPath(); ctx.arc(sx, sy, 2 + (i % 2), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#c9d4de'; ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.fillStyle = '#e8eef4';
      for (let i = 0; i < 18; i++) ctx.fillRect(i * 72 + ((i % 2) * 14), GROUND, 58, H - GROUND);
    }
  }
];

/* ================= ATTAQUES ================= */
const ATTACKS = {
  punch: { dmg: 6, range: 82, startup: 6, active: 5, recovery: 10, kb: 4, kbY: 0, stun: 14 },
  kick: { dmg: 10, range: 100, startup: 9, active: 6, recovery: 16, kb: 7, kbY: -4, stun: 20 }
};

/* ================= PARTICULES ================= */
const particles = [];
function spawnParticles(x, y, n, colors, spd, grav) {
  for (let i = 0; i < n; i++) {
    particles.push({
      x, y,
      vx: rand(-spd, spd), vy: rand(-spd, spd * 0.6),
      life: rand(18, 40), maxLife: 40,
      size: rand(2, 6), color: pick(colors), grav: grav === undefined ? 0.25 : grav
    });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.life -= dt;
    if (p.life <= 0) particles.splice(i, 1);
  }
}
function drawParticles(ctx) {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/* ================= PROJECTILES ================= */
const projectiles = [];
function spawnProjectile(owner, target) {
  const sp = owner.def.special;
  const dir = owner.facing;
  projectiles.push({
    owner, target,
    x: owner.x + dir * 60 * owner.def.size,
    y: owner.y - 95 * owner.def.size,
    vx: dir * 11, dmg: sp.dmg,
    r: 16, t: 0, color: owner.def.colors.accent, id: owner.def.id
  });
  Sfx.play('shoot');
}
function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt; p.t += dt;
    if (p.id === 'crane' || p.id === 'shifu') p.y += Math.sin(p.t * 0.15) * 2;
    if (p.x < -60 || p.x > W + 60) { projectiles.splice(i, 1); continue; }
    const tgt = p.target;
    if (tgt && tgt.state !== 'ko') {
      const bw = 60 * tgt.def.size, bh = 150 * tgt.def.size;
      if (p.x > tgt.x - bw / 2 - p.r && p.x < tgt.x + bw / 2 + p.r && p.y > tgt.y - bh - p.r && p.y < tgt.y + p.r) {
        tgt.takeHit({ dmg: p.dmg, kb: 9, kbY: -5, stun: 22 }, p.owner, true);
        spawnParticles(p.x, p.y, 16, [p.color, '#fff', '#ffe9a8'], 6);
        Game.shake = Math.max(Game.shake, 6);
        projectiles.splice(i, 1);
      }
    }
  }
}
function drawProjectiles(ctx) {
  for (const p of projectiles) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, p.r + 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    if (p.id === 'kai') {
      ctx.rotate(p.t * 0.4);
      ctx.fillStyle = '#3ddc84';
      ctx.beginPath();
      ctx.moveTo(-20, 0); ctx.lineTo(14, -7); ctx.lineTo(22, 0); ctx.lineTo(14, 7);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#a8f5c8'; ctx.lineWidth = 2; ctx.stroke();
    } else if (p.id === 'shen') {
      ctx.fillStyle = '#e05a2a';
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.arc(0, 0, p.r * 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffb347'; ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        const a = p.t * 0.3 + i * Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * p.r, Math.sin(a) * p.r);
        ctx.lineTo(Math.cos(a) * (p.r + 10), Math.sin(a) * (p.r + 10)); ctx.stroke();
      }
    } else if (p.id === 'crane') {
      ctx.rotate(p.t * 0.25);
      ctx.fillStyle = '#f2f0ea';
      for (let i = 0; i < 3; i++) {
        ctx.rotate(Math.PI * 2 / 3);
        ctx.beginPath(); ctx.ellipse(12, 0, 14, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
    } else if (p.id === 'shifu') {
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath();
      ctx.moveTo(-14, -18); ctx.quadraticCurveTo(18, 0, -14, 18);
      ctx.quadraticCurveTo(4, 0, -14, -18); ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(0, 0, p.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.vx > 0 ? 5 : -5, -3, p.r * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

/* ================= COMBATTANT ================= */
class Fighter {
  constructor(def, isP2) {
    this.def = def;
    this.isP2 = !!isP2;
    this.maxHp = def.hp;
    this.reset(0, 1);
  }
  reset(x, facing) {
    this.x = x; this.y = GROUND;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.facing = facing;
    this.hp = this.maxHp;
    this.energy = 0;
    this.state = 'idle';
    this.atk = null; this.atkName = ''; this.atkT = 0; this.hasHit = false;
    this.stunT = 0; this.walkT = 0; this.animT = rand(0, 100);
    this.koT = 0;
    this.specialT = 0; this.specialHitCount = 0;
    this.prevInput = {};
  }
  get bodyW() { return 62 * this.def.size; }
  get bodyH() { return 150 * this.def.size; }
  startAttack(name) {
    this.state = 'attack';
    this.atk = ATTACKS[name]; this.atkName = name;
    this.atkT = 0; this.hasHit = false;
    Sfx.play('whoosh');
  }
  startSpecial() {
    this.energy = 0;
    this.state = 'special';
    this.specialT = 0; this.specialHitCount = 0;
    Sfx.play('special');
    Game.announceSmall(this.def.special.name);
    spawnParticles(this.x, this.y - 70 * this.def.size, 26, [this.def.colors.accent, '#ffce54', '#fff'], 7, 0.05);
  }
  takeHit(atk, attacker, isProj) {
    if (this.state === 'ko') return;
    const srcX = isProj ? this.x + (attacker ? attacker.facing : 1) * -200 : attacker.x;
    const blocked = this.state === 'block' && ((srcX > this.x) === (this.facing > 0));
    let dmg = atk.dmg * (attacker ? attacker.def.power : 1);
    if (blocked) {
      dmg *= 0.2;
      this.hp -= dmg;
      Sfx.play('block');
      spawnParticles(this.x + this.facing * 30, this.y - 90 * this.def.size, 8, ['#7fd4f0', '#fff'], 4);
      this.energy = clamp(this.energy + 4, 0, 100);
      if (attacker) attacker.energy = clamp(attacker.energy + 3, 0, 100);
      return;
    }
    this.hp -= dmg;
    this.state = 'hurt';
    this.stunT = atk.stun || 16;
    this.vx = (attacker ? attacker.facing : 1) * (atk.kb || 5);
    if (atk.kbY) { this.vy = atk.kbY; this.onGround = false; }
    this.energy = clamp(this.energy + 6, 0, 100);
    if (attacker) attacker.energy = clamp(attacker.energy + 9, 0, 100);
    const hitX = this.x - this.facing * 20, hitY = this.y - 90 * this.def.size;
    const big = dmg > 12;
    spawnParticles(hitX, hitY, big ? 22 : 12, big ? ['#ff5a3a', '#ffce54', '#fff'] : ['#ffce54', '#fff'], big ? 8 : 5);
    Sfx.play(big ? 'hitBig' : 'hit');
    Game.shake = Math.max(Game.shake, big ? 10 : 5);
    if (this.hp <= 0) {
      this.hp = 0;
      this.state = 'ko'; this.koT = 0;
      this.vy = -9; this.vx = (attacker ? attacker.facing : 1) * 8; this.onGround = false;
      Sfx.play('ko');
      Game.onKO(this);
    }
  }
  update(dt, opp, input) {
    this.animT += dt;
    if (this.state === 'ko') {
      this.koT += dt;
      this.vy += GRAV * dt;
      this.x += this.vx * dt; this.y += this.vy * dt;
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.vx *= 0.85; }
      this.x = clamp(this.x, 50, W - 50);
      return;
    }
    const pressed = k => input[k] && !this.prevInput[k];
    if (this.state === 'hurt') {
      this.stunT -= dt;
      this.vx *= Math.pow(0.9, dt);
      this.x += this.vx * dt;
      if (!this.onGround) { this.vy += GRAV * dt; this.y += this.vy * dt; if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; this.onGround = true; } }
      if (this.stunT <= 0) this.state = 'idle';
      this.prevInput = Object.assign({}, input);
      return;
    }
    if (this.state === 'special') {
      this.updateSpecial(dt, opp);
      this.prevInput = Object.assign({}, input);
      return;
    }
    if (this.state === 'attack') {
      this.atkT += dt;
      const a = this.atk;
      const total = a.startup + a.active + a.recovery;
      if (!this.hasHit && this.atkT >= a.startup && this.atkT <= a.startup + a.active) {
        const hx = this.x + this.facing * a.range * this.def.size * 0.8;
        const hy = this.y - (this.atkName === 'kick' ? 70 : 95) * this.def.size;
        const bw = opp.bodyW, bh = opp.bodyH;
        if (Math.abs(hx - opp.x) < bw / 2 + 30 && hy > opp.y - bh - 20 && hy < opp.y + 20 && opp.state !== 'ko') {
          this.hasHit = true;
          opp.takeHit(a, this, false);
        }
      }
      if (this.atkT >= total) this.state = 'idle';
      if (this.onGround) this.vx *= Math.pow(0.8, dt);
      this.x += this.vx * dt;
      this.prevInput = Object.assign({}, input);
      return;
    }
    if (this.onGround) this.facing = opp.x >= this.x ? 1 : -1;
    const blocking = input.down && this.onGround;
    if (blocking) {
      this.state = 'block';
      this.vx = 0;
    } else {
      if (pressed('special') && this.energy >= 100) {
        this.startSpecial();
        this.prevInput = Object.assign({}, input);
        return;
      }
      if (pressed('punch')) { this.startAttack('punch'); this.prevInput = Object.assign({}, input); return; }
      if (pressed('kick')) { this.startAttack('kick'); this.prevInput = Object.assign({}, input); return; }
      let mv = 0;
      if (input.left) mv -= 1;
      if (input.right) mv += 1;
      this.vx = mv * this.def.speed;
      this.state = mv !== 0 ? 'walk' : 'idle';
      if (mv !== 0) this.walkT += dt * this.def.speed;
      if (pressed('jump') && this.onGround) {
        this.vy = -15.5; this.onGround = false;
        Sfx.play('jump');
        spawnParticles(this.x, this.y, 6, ['#c9a86a', '#8a6a42'], 3);
      }
    }
    if (!this.onGround) { this.vy += GRAV * dt; }
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND) {
      if (!this.onGround) spawnParticles(this.x, GROUND, 5, ['#c9a86a', '#8a6a42'], 3);
      this.y = GROUND; this.vy = 0; this.onGround = true;
    }
    this.x = clamp(this.x, 60, W - 60);
    this.prevInput = Object.assign({}, input);
  }
  updateSpecial(dt, opp) {
    const sp = this.def.special;
    this.specialT += dt;
    if (sp.type === 'dash') {
      const D = 26;
      if (this.specialT < D) {
        if (this.specialT < 10) {
          this.vx = 0;
          if (this.specialT < 2) spawnParticles(this.x, this.y - 60 * this.def.size, 3, [this.def.colors.accent, '#ffce54'], 4, 0);
        } else {
          this.vx = this.facing * 15;
          this.x = clamp(this.x + this.vx * dt, 60, W - 60);
          if (this.specialHitCount < 1) {
            const bw = opp.bodyW;
            if (Math.abs(this.x - opp.x) < bw / 2 + 55 * this.def.size && Math.abs(opp.y - this.y) < 120 && opp.state !== 'ko') {
              this.specialHitCount++;
              opp.takeHit({ dmg: sp.dmg, kb: 14, kbY: -8, stun: 30 }, this, false);
              Game.shake = 16;
            }
          }
          if (Math.random() < 0.5) spawnParticles(this.x - this.facing * 30, this.y - 70 * this.def.size, 2, [this.def.colors.accent, '#fff'], 3, 0);
        }
      } else { this.state = 'idle'; this.vx = 0; }
    } else if (sp.type === 'rush') {
      const D = 34;
      if (this.specialT < D) {
        if (this.specialT < 8) {
          this.vx = 0;
          this.x += (opp.x - this.x) * 0.08 * dt;
        } else {
          this.x = clamp(opp.x - this.facing * 55 * this.def.size, 60, W - 60);
          if (this.specialT % 6 < dt && this.specialHitCount < (sp.hits || 3) && opp.state !== 'ko') {
            this.specialHitCount++;
            opp.takeHit({ dmg: sp.dmg, kb: 2, kbY: 0, stun: 10 }, this, false);
            spawnParticles(opp.x, opp.y - 90 * opp.def.size, 8, [this.def.colors.accent, '#fff'], 6);
          }
        }
      } else {
        this.state = 'idle';
        if (this.specialHitCount > 0 && opp.state !== 'ko') {
          opp.takeHit({ dmg: 4, kb: 10, kbY: -6, stun: 18 }, this, false);
        }
      }
    } else {
      if (this.specialT >= 12 && this.specialT - dt < 12) spawnProjectile(this, opp);
      if (this.specialT > 26) this.state = 'idle';
    }
  }

  /* ---------- Rendu ---------- */
  draw(ctx) { this.drawAt(ctx, this.x, this.y, 1); }
  drawAt(ctx, px, py, scale) {
    const d = this.def, c = d.colors, s = d.size * scale, t = this.animT;
    if (d.id === 'viper') { this.drawViper(ctx, px, py, s); return; }
    ctx.save();
    ctx.translate(px, py);
    if (this.state === 'ko') {
      const r = Math.min(this.koT * 0.1, 1);
      ctx.rotate(-this.facing * r * Math.PI / 2);
      ctx.translate(0, -r * 12);
    }
    ctx.scale(this.facing * s, s);
    if (this.state === 'special' || (this.energy >= 100 && this.state !== 'ko')) {
      ctx.globalAlpha = this.state === 'special' ? 0.45 : 0.22 + Math.sin(t * 0.2) * 0.08;
      ctx.fillStyle = c.accent;
      ctx.beginPath(); ctx.arc(0, -75, 78, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    let bob = Math.sin(t * 0.12) * 2.5;
    let lean = 0, armF = { x: 16, y: -92 }, armB = { x: -10, y: -92 }, legF = { x: 12, y: 0 }, legB = { x: -12, y: 0 };
    let hipY = -58 + bob, shY = -102 + bob, headY = -128 + bob;
    if (this.state === 'walk') {
      const ph = Math.sin(this.walkT * 0.35);
      legF = { x: 12 + ph * 14, y: -Math.max(0, ph) * 8 };
      legB = { x: -12 - ph * 14, y: -Math.max(0, -ph) * 8 };
      armF = { x: 14 - ph * 10, y: -92 };
      armB = { x: -12 + ph * 10, y: -92 };
    } else if (this.state === 'jump' || !this.onGround) {
      legF = { x: 16, y: -26 }; legB = { x: -8, y: -18 };
      armF = { x: 20, y: -108 }; armB = { x: -16, y: -100 };
    } else if (this.state === 'block') {
      armF = { x: 22, y: -108 }; armB = { x: 18, y: -86 };
      lean = -0.06;
    } else if (this.state === 'hurt') {
      lean = 0.28;
      armF = { x: 6, y: -118 }; armB = { x: -22, y: -104 };
      headY -= 4;
    } else if (this.state === 'attack') {
      const a = this.atk;
      let ext = 0;
      if (this.atkT < a.startup) ext = (this.atkT / a.startup) * 0.3;
      else if (this.atkT < a.startup + a.active) ext = 1;
      else ext = Math.max(0, 1 - (this.atkT - a.startup - a.active) / a.recovery);
      if (this.atkName === 'punch') { armF = { x: 16 + 62 * ext, y: -95 }; armB = { x: -14, y: -90 }; lean = 0.1 * ext; }
      else { legF = { x: 14 + 78 * ext, y: -68 + 12 * (1 - ext) }; legB = { x: -10, y: 0 }; lean = -0.12 * ext; armF = { x: -6, y: -100 }; armB = { x: -20, y: -84 }; }
    } else if (this.state === 'special') {
      const sp = d.special;
      if (sp.type === 'dash') {
        if (this.specialT < 10) { lean = -0.2; armF = { x: 10, y: -110 }; armB = { x: -14, y: -104 }; }
        else { lean = 0.35; armF = { x: 55, y: -85 }; armB = { x: -25, y: -95 }; legF = { x: 22, y: -6 }; legB = { x: -20, y: 0 }; }
      } else if (sp.type === 'rush') {
        lean = 0.2;
        const ph = Math.sin(this.specialT * 0.9);
        armF = { x: 30 + ph * 25, y: -95 }; armB = { x: 20 - ph * 25, y: -95 };
      } else {
        const push = clamp(this.specialT / 12, 0, 1);
        armF = { x: 20 + 40 * push, y: -100 }; armB = { x: 10 + 30 * push, y: -100 };
      }
    }
    ctx.rotate(lean);
    const lw = 13;
    const limb = (x1, y1, x2, y2, w, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    };
    limb(-4, hipY, legB.x, legB.y - 4, lw, c.limb);
    limb(4, shY + 4, armB.x, armB.y, lw * 0.85, c.limb);
    ctx.fillStyle = c.pants || c.accent;
    ctx.beginPath();
    ctx.ellipse(0, hipY + 8, 26, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c.fur;
    ctx.beginPath();
    ctx.moveTo(-20, shY + 8);
    ctx.quadraticCurveTo(-26, hipY, -14, hipY + 10);
    ctx.lineTo(14, hipY + 10);
    ctx.quadraticCurveTo(26, hipY, 20, shY + 8);
    ctx.quadraticCurveTo(0, shY - 12, -20, shY + 8);
    ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath();
    ctx.ellipse(4, (shY + hipY) / 2 + 10, 13, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    limb(4, hipY, legF.x - 4, legF.y - 4, lw, c.limb);
    limb(4, shY + 4, armF.x, armF.y, lw * 0.85, c.limb);
    ctx.fillStyle = c.limb;
    ctx.beginPath(); ctx.arc(legF.x - 4, legF.y - 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(legB.x, legB.y - 3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(armF.x, armF.y, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(armB.x, armB.y, 7.5, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(2, headY);
    if (this.state === 'hurt') ctx.rotate(0.2);
    this.drawHead(ctx, c, t);
    ctx.restore();
    ctx.restore();
  }
  drawHead(ctx, c, t) {
    const d = this.def;
    ctx.fillStyle = c.fur;
    ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    const eye = (ex, er, pupil) => {
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex, -3, er, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = pupil || '#1a1a1a';
      ctx.beginPath(); ctx.arc(ex + 2, -3, er * 0.45, 0, Math.PI * 2); ctx.fill();
    };
    const brow = (ex, ang, col) => {
      ctx.strokeStyle = col || c.accent; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ex - 6, -12 + ang); ctx.lineTo(ex + 6, -12 - ang); ctx.stroke();
    };
    const angry = this.state === 'attack' || this.state === 'special' || this.state === 'hurt';
    switch (d.id) {
      case 'po':
        ctx.fillStyle = '#2e2b28';
        ctx.beginPath(); ctx.arc(-10, -19, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(11, -19, 8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(-7, -2, 7, 9, 0.3, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(8, -2, 7, 9, -0.3, 0, Math.PI * 2); ctx.fill();
        eye(-6, 4); eye(7, 4);
        ctx.fillStyle = '#2e2b28';
        ctx.beginPath(); ctx.ellipse(2, 9, 3, 2.4, 0, 0, Math.PI * 2); ctx.fill();
        break;
      case 'tigress':
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.moveTo(-20, -12); ctx.lineTo(-26, -30); ctx.lineTo(-8, -19); ctx.fill();
        ctx.beginPath(); ctx.moveTo(20, -12); ctx.lineTo(26, -30); ctx.lineTo(8, -19); ctx.fill();
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(14, -14 + i * 7); ctx.lineTo(21, -12 + i * 7); ctx.stroke(); }
        eye(-6, 4, '#3a6a1a'); eye(7, 4, '#3a6a1a');
        brow(-6, angry ? 3 : 1.5); brow(7, angry ? -3 : -1.5);
        ctx.fillStyle = '#c9a86a';
        ctx.beginPath(); ctx.arc(2, 7, 3, 0, Math.PI * 2); ctx.fill();
        break;
      case 'monkey':
        ctx.fillStyle = '#e8c39a';
        ctx.beginPath(); ctx.ellipse(2, 2, 15, 13, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = c.fur;
        ctx.beginPath(); ctx.arc(-21, -4, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(23, -4, 7, 0, Math.PI * 2); ctx.fill();
        eye(-4, 3.5); eye(9, 3.5);
        ctx.strokeStyle = '#5a3a18'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-4, 10); ctx.quadraticCurveTo(2, 13, 9, 10); ctx.stroke();
        break;
      case 'mantis':
        ctx.fillStyle = '#2d4a08';
        ctx.beginPath(); ctx.arc(-8, -3, 9, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(10, -3, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#d8f0a0';
        ctx.beginPath(); ctx.arc(-6, -4, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(12, -4, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#2d4a08'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-8, -12); ctx.quadraticCurveTo(-14, -24, -8, -28); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(10, -12); ctx.quadraticCurveTo(16, -24, 10, -28); ctx.stroke();
        break;
      case 'crane':
        ctx.fillStyle = '#e08a2e';
        ctx.beginPath(); ctx.moveTo(14, -4); ctx.lineTo(30, 2); ctx.lineTo(14, 7); ctx.fill();
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.ellipse(0, -20, 6, 9, 0, 0, Math.PI * 2); ctx.fill();
        eye(-4, 3.5, '#2a2a2a'); eye(6, 3.5, '#2a2a2a');
        break;
      case 'tailung':
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.moveTo(-20, -10); ctx.lineTo(-27, -28); ctx.lineTo(-7, -18); ctx.fill();
        ctx.beginPath(); ctx.moveTo(20, -10); ctx.lineTo(27, -28); ctx.lineTo(7, -18); ctx.fill();
        ctx.fillStyle = '#5a544c';
        for (let i = 0; i < 4; i++) {
          ctx.beginPath(); ctx.arc(-14 + i * 9, -16 + (i % 2) * 4, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        eye(-6, 4, '#c9a015'); eye(7, 4, '#c9a015');
        brow(-6, 4, '#3a352e'); brow(7, -4, '#3a352e');
        ctx.strokeStyle = '#3a352e'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-4, 10); ctx.lineTo(2, 8); ctx.lineTo(8, 10); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.moveTo(0, 8); ctx.lineTo(-3, 14); ctx.lineTo(3, 14); ctx.fill();
        break;
      case 'shen':
        ctx.fillStyle = '#e8b8c0';
        ctx.beginPath(); ctx.ellipse(-6, -2, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(9, -2, 6, 7, 0, 0, Math.PI * 2); ctx.fill();
        eye(-6, 3, '#8a2a2a'); eye(9, 3, '#8a2a2a');
        ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.moveTo(-16, -18); ctx.quadraticCurveTo(0, -32, 16, -18); ctx.quadraticCurveTo(0, -24, -16, -18); ctx.fill();
        ctx.fillStyle = '#e8b8c0';
        ctx.beginPath(); ctx.arc(2, 9, 2.5, 0, Math.PI * 2); ctx.fill();
        break;
      case 'kai':
        ctx.strokeStyle = '#2a2e26'; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-12, -16); ctx.quadraticCurveTo(-24, -30, -16, -38); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(12, -16); ctx.quadraticCurveTo(24, -30, 16, -38); ctx.stroke();
        eye(-6, 4, '#3ddc84'); eye(7, 4, '#3ddc84');
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = '#3ddc84';
        ctx.beginPath(); ctx.arc(-6, -3, 6, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(7, -3, 6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        break;
      case 'shifu':
        ctx.fillStyle = c.fur;
        ctx.beginPath(); ctx.arc(-19, -8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(21, -8, 7, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e8d3ae';
        ctx.beginPath(); ctx.ellipse(2, 4, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
        eye(-5, 3.5); eye(8, 3.5);
        ctx.strokeStyle = '#f5f0e6'; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-11, -10); ctx.lineTo(-2, -8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(15, -10); ctx.lineTo(6, -8); ctx.stroke();
        ctx.fillStyle = '#f5f0e6';
        ctx.beginPath(); ctx.ellipse(2, 15, 8, 6, 0, 0, Math.PI); ctx.fill();
        break;
      default:
        eye(-6, 4); eye(7, 4);
    }
  }
  drawViper(ctx, px, py, s) {
    const c = this.def.colors, t = this.animT;
    ctx.save();
    ctx.translate(px, py);
    if (this.state === 'ko') {
      const r = Math.min(this.koT * 0.1, 1);
      ctx.rotate(-this.facing * r * Math.PI / 2);
    }
    ctx.scale(this.facing * s, s);
    let headX = 18, headY = -115, ext = 0;
    if (this.state === 'attack') {
      const a = this.atk;
      if (this.atkT < a.startup) ext = (this.atkT / a.startup) * 0.3;
      else if (this.atkT < a.startup + a.active) ext = 1;
      else ext = Math.max(0, 1 - (this.atkT - a.startup - a.active) / a.recovery);
      headX += 70 * ext; headY += 10 * ext;
    } else if (this.state === 'special') {
      headX += 20; headY -= 8;
    } else if (this.state === 'hurt') {
      headX -= 10; headY -= 6;
    }
    headY += Math.sin(t * 0.1) * 4;
    ctx.strokeStyle = c.fur; ctx.lineWidth = 16; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-46, -6);
    ctx.quadraticCurveTo(-20, -50 + Math.sin(t * 0.08) * 8, -2, -70);
    ctx.quadraticCurveTo(12, -88, headX - 8, headY + 10);
    ctx.stroke();
    ctx.strokeStyle = c.belly; ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-44, -2);
    ctx.quadraticCurveTo(-18, -46 + Math.sin(t * 0.08) * 8, 0, -66);
    ctx.stroke();
    ctx.save();
    ctx.translate(headX, headY);
    ctx.rotate(ext * 0.15);
    ctx.fillStyle = c.fur;
    ctx.beginPath(); ctx.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = c.belly;
    ctx.beginPath(); ctx.ellipse(6, 5, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd54f';
    ctx.beginPath(); ctx.arc(-2, -4, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -4, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(-1, -4, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(9, -4, 2, 0, Math.PI * 2); ctx.fill();
    if (Math.floor(t * 0.2) % 3 === 0) {
      ctx.strokeStyle = '#e05a4a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(15, 4); ctx.lineTo(26, 4); ctx.moveTo(26, 4); ctx.lineTo(30, 1); ctx.moveTo(26, 4); ctx.lineTo(30, 7); ctx.stroke();
    }
    ctx.restore();
    ctx.restore();
  }
}

/* ================= IA ================= */
const DIFFICULTIES = {
  easy: { react: 480, aggro: 0.45, blockChance: 0.12, specialChance: 0.3, jumpChance: 0.06, err: 0.35 },
  normal: { react: 280, aggro: 0.75, blockChance: 0.32, specialChance: 0.6, jumpChance: 0.1, err: 0.15 },
  hard: { react: 150, aggro: 0.95, blockChance: 0.55, specialChance: 0.85, jumpChance: 0.14, err: 0.04 }
};
class AIController {
  constructor(fighter, opp, diff) {
    this.f = fighter; this.opp = opp;
    this.p = DIFFICULTIES[diff] || DIFFICULTIES.normal;
    this.timer = 0; this.plan = {}; this.blockT = 0;
  }
  update(dt) {
    const f = this.f, opp = this.opp;
    this.timer -= dt * 16.7;
    this.blockT -= dt * 16.7;
    if (this.timer <= 0) {
      this.timer = this.p.react * rand(0.7, 1.4);
      this.plan = {};
      const dist = Math.abs(opp.x - f.x);
      const incoming = projectiles.some(p => p.target === f && (f.x - p.x) * Math.sign(p.vx) > 0 && Math.abs(p.x - f.x) < 340);
      if (opp.state === 'attack' && dist < 180 && Math.random() < this.p.blockChance) {
        this.blockT = rand(300, 600);
      } else if (incoming) {
        if (Math.random() < 0.5) this.plan = { jump: true };
        else this.blockT = rand(250, 500);
      } else if (f.energy >= 100 && Math.random() < this.p.specialChance && dist < 420) {
        this.plan = { special: true };
      } else if (dist < 120 * f.def.size) {
        const r = Math.random();
        if (r < this.p.aggro * 0.55) this.plan = { punch: true };
        else if (r < this.p.aggro * 0.9) this.plan = { kick: true };
        else if (r < 0.97) this.plan = { back: true };
        else this.plan = { jump: true };
      } else if (dist < 700) {
        if (Math.random() < this.p.jumpChance) this.plan = { jump: true, toward: true };
        else this.plan = { toward: true };
      } else {
        this.plan = { toward: true };
      }
      if (Math.random() < this.p.err) this.plan = { toward: Math.random() < 0.5 };
    }
    const inp = { left: false, right: false, jump: false, down: false, punch: false, kick: false, special: false };
    if (this.blockT > 0) {
      inp.down = true;
    } else {
      if (this.plan.special) inp.special = true;
      if (this.plan.punch) inp.punch = true;
      if (this.plan.kick) inp.kick = true;
      if (this.plan.back) { if (opp.x > f.x) inp.left = true; else inp.right = true; }
      if (this.plan.toward) { if (opp.x > f.x) inp.right = true; else inp.left = true; }
      if (this.plan.jump) inp.jump = true;
    }
    return inp;
  }
}

/* ================= ENTRÉES CLAVIER ================= */
const keys = {};
window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
  Sfx.ensure();
});
window.addEventListener('keyup', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = false;
});
function humanInput() {
  return {
    left: !!(keys['ArrowLeft'] || keys['q']),
    right: !!(keys['ArrowRight'] || keys['d']),
    jump: !!(keys['ArrowUp'] || keys[' '] || keys['z']),
    down: !!(keys['ArrowDown'] || keys['s']),
    punch: !!(keys['a'] || keys['j']),
    kick: !!(keys['e'] || keys['k']),
    special: !!(keys['w'] || keys['l'])
  };
}

/* ================= JEU ================= */
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

const Game = {
  state: 'menu',
  difficulty: 'normal',
  stage: STAGES[0],
  p1: null, p2: null, ai: null,
  round: 1, wins: [0, 0],
  timer: 60, phase: 'intro', phaseT: 0,
  shake: 0,
  selStep: 1, selP1: null, selOpp: null,

  startMatch() {
    this.p1 = new Fighter(this.selP1, false);
    this.p2 = new Fighter(this.selOpp, true);
    this.ai = new AIController(this.p2, this.p1, this.difficulty);
    this.stage = pick(STAGES);
    this.round = 1; this.wins = [0, 0];
    $('p1-name').textContent = this.p1.def.name;
    $('p2-name').textContent = this.p2.def.name;
    this.state = 'fight';
    showScreen(null);
    $('hud').classList.remove('hidden');
    this.buildPips();
    this.startRound();
  },
  buildPips() {
    const box = $('round-pips');
    box.innerHTML = '';
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 2; i++) {
        const d = document.createElement('div');
        d.className = 'pip' + (i < this.wins[s] ? ' won' : '');
        if (s === 1) d.style.marginLeft = '8px';
        box.appendChild(d);
      }
    }
  },
  startRound() {
    projectiles.length = 0; particles.length = 0;
    this.p1.reset(W * 0.32, 1);
    this.p2.reset(W * 0.68, -1);
    this.timer = 60;
    this.phase = 'intro'; this.phaseT = 110;
    this.announce('MANCHE ' + this.round, false);
    Sfx.play('bell');
  },
  announce(text, ko) {
    const a = $('announce');
    a.textContent = text;
    a.className = '';
    void a.offsetWidth;
    a.className = ko ? 'show-ko' : 'show';
  },
  announceSmall(text) {
    const a = $('announce');
    a.textContent = text;
    a.style.fontSize = 'clamp(22px,3.5vw,40px)';
    a.className = '';
    void a.offsetWidth;
    a.className = 'show';
    setTimeout(() => { a.style.fontSize = ''; }, 1500);
  },
  onKO(loser) {
    if (this.phase !== 'combat') return;
    this.phase = 'ko'; this.phaseT = 110;
    this.announce('K.O. !', true);
    const winner = loser === this.p1 ? 1 : 0;
    this.wins[winner]++;
    this.buildPips();
  },
  endRoundByTime() {
    const w = this.p1.hp === this.p2.hp ? -1 : (this.p1.hp > this.p2.hp ? 0 : 1);
    if (w >= 0) this.wins[w]++;
    this.buildPips();
    this.announce(w < 0 ? 'ÉGALITÉ' : 'TEMPS ÉCOULÉ', false);
    this.phase = 'ko'; this.phaseT = 110;
  },
  nextPhase() {
    if (this.wins[0] >= 2 || this.wins[1] >= 2) {
      this.state = 'end';
      $('hud').classList.add('hidden');
      const p1Win = this.wins[0] >= 2;
      const t = $('end-title');
      t.textContent = p1Win ? 'VICTOIRE !' : 'DÉFAITE...';
      t.style.color = p1Win ? '#ffe9a8' : '#e05a4a';
      $('end-sub').textContent = p1Win
        ? this.p1.def.name + ' remporte le tournoi de kung fu !'
        : this.p2.def.name + " l'emporte. Entraîne-toi et reviens plus fort !";
      showScreen('screen-end');
      Sfx.play(p1Win ? 'bell' : 'ko');
    } else {
      this.round++;
      this.startRound();
    }
  },
  update(dt) {
    if (this.state !== 'fight') return;
    this.phaseT -= dt;
    if (this.phase === 'intro') {
      if (this.phaseT <= 55 && this.phaseT + dt > 55) this.announce('COMBATTEZ !', false);
      if (this.phaseT <= 0) this.phase = 'combat';
      this.updateFighters(dt, true);
      return;
    }
    if (this.phase === 'combat') {
      this.timer -= dt / 60;
      if (this.timer <= 0) { this.timer = 0; this.endRoundByTime(); }
      this.updateFighters(dt, false);
      updateProjectiles(dt);
      return;
    }
    if (this.phase === 'ko') {
      this.updateFighters(dt, false);
      if (this.phaseT <= 0) this.nextPhase();
    }
  },
  updateFighters(dt, frozen) {
    const in1 = frozen ? {} : humanInput();
    const in2 = frozen ? {} : this.ai.update(dt);
    this.p1.update(dt, this.p2, in1);
    this.p2.update(dt, this.p1, in2);
    const bw = (this.p1.bodyW + this.p2.bodyW) / 2 - 14;
    const d = this.p2.x - this.p1.x;
    if (Math.abs(d) < bw && this.p1.state !== 'ko' && this.p2.state !== 'ko') {
      const push = (bw - Math.abs(d)) / 2 * Math.sign(d || 1);
      this.p1.x -= push * 0.5; this.p2.x += push * 0.5;
      this.p1.x = clamp(this.p1.x, 60, W - 60);
      this.p2.x = clamp(this.p2.x, 60, W - 60);
    }
  },
  render() {
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));
      this.shake *= 0.85;
      if (this.shake < 0.5) this.shake = 0;
    }
    this.stage.draw(ctx, performance.now() * 0.06);
    if ((this.state === 'fight' || this.state === 'end') && this.p1 && this.p2) {
      for (const f of [this.p1, this.p2]) {
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        const sw = 55 * f.def.size * (f.onGround ? 1 : 0.6);
        ctx.beginPath(); ctx.ellipse(f.x, GROUND + 8, sw, 10, 0, 0, Math.PI * 2); ctx.fill();
      }
      const order = this.p1.y <= this.p2.y ? [this.p2, this.p1] : [this.p1, this.p2];
      order[0].draw(ctx);
      order[1].draw(ctx);
      drawProjectiles(ctx);
      drawParticles(ctx);
      this.updateHUD();
    }
    ctx.restore();
  },
  updateHUD() {
    $('p1-hp').style.width = (this.p1.hp / this.p1.maxHp * 100) + '%';
    $('p2-hp').style.width = (this.p2.hp / this.p2.maxHp * 100) + '%';
    $('p1-en').style.width = this.p1.energy + '%';
    $('p2-en').style.width = this.p2.energy + '%';
    $('timer').textContent = Math.ceil(this.timer);
    $('timer').style.color = this.timer < 11 ? '#ff5a3a' : '#ffce54';
  }
};

/* ================= ÉCRANS ================= */
function showScreen(id) {
  for (const s of ['screen-menu', 'screen-select', 'screen-end']) {
    $(s).classList.toggle('hidden', s !== id);
  }
}

function drawPortrait(def, cv) {
  const c2 = cv.getContext('2d');
  c2.clearRect(0, 0, 100, 100);
  const f = new Fighter(def, false);
  f.drawAt(c2, 50, 92, 0.52);
}
function showInfo(def) {
  $('info-name').textContent = def.name;
  $('info-title').textContent = def.title + ' — ' + def.desc;
  const bar = (label, v) => '<span class="stat">' + label + '<span class="mini-bar"><div style="width:' + v + '%"></div></span></span>';
  $('info-stats').innerHTML =
    bar('Vie', def.hp / 1.4) +
    bar('Vitesse', def.speed / 4 * 100) +
    bar('Puissance', def.power / 1.4 * 100) +
    bar('Taille', def.size / 1.4 * 100);
  $('info-special').textContent = '⚡ Spécial : ' + def.special.name;
}
function refreshCardHighlights() {
  $('char-grid').querySelectorAll('.char-card').forEach(c => {
    c.classList.remove('selected', 'opp');
    if (Game.selP1 && c.dataset.id === Game.selP1.id) c.classList.add('selected');
    if (Game.selStep === 2 && Game.selOpp && c.dataset.id === Game.selOpp.id) c.classList.add('selected', 'opp');
  });
}
function addRandomCard() {
  const grid = $('char-grid');
  if (grid.querySelector('.random-card')) return;
  const card = document.createElement('div');
  card.className = 'char-card random-card';
  card.innerHTML = '<div class="qmark">?</div><div class="cname">Aléatoire</div>';
  card.addEventListener('click', () => {
    Sfx.play('select');
    Game.selOpp = pick(CHARACTERS.filter(c => c !== Game.selP1));
    $('btn-fight').disabled = false;
    $('char-grid').querySelectorAll('.char-card').forEach(c => c.classList.remove('selected', 'opp'));
    card.classList.add('selected', 'opp');
    showInfo(Game.selOpp);
  });
  grid.appendChild(card);
}
function selectChar(def) {
  Sfx.play('select');
  if (Game.selStep === 1) {
    Game.selP1 = def;
    Game.selStep = 2;
    $('select-title').textContent = 'Choisis ton adversaire';
    addRandomCard();
  } else {
    Game.selOpp = def;
    $('btn-fight').disabled = false;
  }
  refreshCardHighlights();
  showInfo(def);
}
function resetSelect() {
  Game.selStep = 1;
  Game.selP1 = null; Game.selOpp = null;
  $('select-title').textContent = 'Choisis ton guerrier';
  $('btn-fight').disabled = true;
  const rc = $('char-grid').querySelector('.random-card');
  if (rc) rc.remove();
  $('char-grid').querySelectorAll('.char-card').forEach(c => c.classList.remove('selected', 'opp'));
  $('info-name').textContent = '';
  $('info-title').textContent = '';
  $('info-stats').innerHTML = '';
  $('info-special').textContent = '';
}

function buildSelectGrid() {
  const grid = $('char-grid');
  grid.innerHTML = '';
  for (const def of CHARACTERS) {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.dataset.id = def.id;
    const cv = document.createElement('canvas');
    cv.width = 100; cv.height = 100;
    const name = document.createElement('div');
    name.className = 'cname'; name.textContent = def.name;
    card.appendChild(cv); card.appendChild(name);
    card.addEventListener('click', () => selectChar(def));
    card.addEventListener('mouseenter', () => showInfo(def));
    grid.appendChild(card);
    drawPortrait(def, cv);
  }
}

$('btn-play').addEventListener('click', () => {
  Sfx.play('select');
  resetSelect();
  showScreen('screen-select');
});
$('btn-back').addEventListener('click', () => {
  if (Game.selStep === 2) {
    Game.selStep = 1; Game.selP1 = null; Game.selOpp = null;
    $('btn-fight').disabled = true;
    $('select-title').textContent = 'Choisis ton guerrier';
    const rc = $('char-grid').querySelector('.random-card');
    if (rc) rc.remove();
    refreshCardHighlights();
  } else showScreen('screen-menu');
});
$('btn-fight').addEventListener('click', () => {
  if (Game.selP1 && Game.selOpp) Game.startMatch();
});
$('btn-rematch').addEventListener('click', () => { Sfx.play('select'); Game.startMatch(); });
$('btn-reselect').addEventListener('click', () => { Sfx.play('select'); resetSelect(); showScreen('screen-select'); });
$('btn-menu').addEventListener('click', () => { Sfx.play('select'); Game.state = 'menu'; showScreen('screen-menu'); });
document.querySelectorAll('.btn.diff').forEach(b => {
  b.addEventListener('click', () => {
    Sfx.play('select');
    document.querySelectorAll('.btn.diff').forEach(x => x.classList.remove('selected'));
    b.classList.add('selected');
    Game.difficulty = b.dataset.diff;
  });
});

/* ================= BOUCLE ================= */
buildSelectGrid();
showInfo(CHARACTERS[0]);
let last = performance.now();
function loop(ts) {
  const dt = clamp((ts - last) / 16.666, 0.1, 2.5);
  last = ts;
  Game.update(dt);
  updateParticles(dt);
  Game.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
