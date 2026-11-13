/* Nova Vanguard - jogo de nave (HTML5 Canvas) */
(() => {
'use strict';

/* ============ utilidades ============ */
const $ = id => document.getElementById(id);
const rnd = (a, b) => a + Math.random() * (b - a);
const rint = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = n => Math.round(n).toLocaleString('pt-BR');
const TAU = Math.PI * 2;

const cv = $('game'), g = cv.getContext('2d');
const W = 360;
let H = 640, S = 1;

function resize() {
  const iw = window.innerWidth, ih = window.innerHeight;
  H = clamp(Math.round(W * ih / iw), 540, 800);
  const scale = Math.min(iw / W, ih / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.style.width = (W * scale) + 'px';
  cv.style.height = (H * scale) + 'px';
  cv.width = Math.round(W * scale * dpr);
  cv.height = Math.round(H * scale * dpr);
  S = (W * scale * dpr) / W;
  for (const st of stars) if (st.y > H) st.y = rnd(0, H);
}

/* ============ dados ============ */
const TIERS = [
  { name: 'ESCUTEIRO', col: '#7ee7ff', xp: 0 },
  { name: 'FALCÃO',    col: '#6bffb0', xp: 70 },
  { name: 'FANTASMA',  col: '#ffd166', xp: 200 },
  { name: 'TITÃ',      col: '#ff7ad9', xp: 420 },
  { name: 'NOVA',      col: '#ffffff', xp: 760 },
];

const STAGES = [
  { name: 'Cinturão de Asteroides', hue: 215, boss: 'CEIFADOR',
    msg: 'Aurora Central: Piloto, o enxame está chegando. Você é a nossa última linha de defesa!' },
  { name: 'Nebulosa Carmesim', hue: 340, boss: 'LEVIATÃ',
    msg: 'Cmdt. Reis: Você abriu caminho! Mas ouvi dizer que o pior ainda vem aí...' },
  { name: 'Estaleiro Inimigo', hue: 150, boss: 'ARQUITETO',
    msg: 'Cmdt. Reis: Detectamos o estaleiro deles. Destrua-o antes que construam mais!' },
  { name: 'Campo de Ruínas', hue: 45, boss: 'ESPECTRO',
    msg: 'Aurora Central: Milhões de pessoas estão torcendo por você. Não pare agora!' },
  { name: 'Coração do Enxame', hue: 280, boss: 'RAINHA DO ENXAME',
    msg: 'Cmdt. Reis: O coração do enxame... É agora ou nunca, piloto. Por Aurora!' },
];

const ED = {
  drone: { hp: 2,  r: 13, sp: 95,  score: 10,  xp: 4,  col: '#ff5a7a' },
  zig:   { hp: 3,  r: 13, sp: 80,  score: 20,  xp: 6,  col: '#ffb454' },
  kami:  { hp: 3,  r: 12, sp: 70,  score: 30,  xp: 8,  col: '#ff3b3b' },
  gun:   { hp: 7,  r: 16, sp: 65,  score: 45,  xp: 11, col: '#c77dff' },
  elite: { hp: 30, r: 25, sp: 45,  score: 160, xp: 38, col: '#4de2c5' },
};

const UPG = [
  { id: 'dmg',    name: 'CANHÕES',   desc: '+12% de dano por nível',         max: 8, base: 90 },
  { id: 'rate',   name: 'CADÊNCIA',  desc: '+7% de velocidade de tiro',      max: 8, base: 90 },
  { id: 'hull',   name: 'CASCO',     desc: '+20 de integridade máxima',      max: 8, base: 80 },
  { id: 'magnet', name: 'ÍMÃ',       desc: 'Atrai créditos de mais longe',   max: 5, base: 70 },
  { id: 'bomb',   name: 'BOMBAS',    desc: '+1 bomba Nova inicial',          max: 2, base: 400 },
];
const START_TIER_COST = [0, 700, 2000];

const MT = {
  kills: { txt: n => `Destruir ${fmt(n)} inimigos`,              arr: [25, 60, 120, 250, 500], cum: true },
  pick:  { txt: n => `Coletar ${n} power-ups`,                    arr: [3, 8, 15, 30, 50],      cum: true },
  boss:  { txt: n => `Derrotar ${n} chefe${n > 1 ? 's' : ''}`,    arr: [1, 2, 4, 7, 12],        cum: true },
  tier:  { txt: n => `Evoluir a nave ao nível ${n} numa partida`, arr: [2, 3, 4, 5],            cum: false },
  score: { txt: n => `Fazer ${fmt(n)} pontos numa partida`,       arr: [1500, 4000, 9000, 20000, 40000], cum: false },
  combo: { txt: n => `Atingir combo x${n}`,                       arr: [3, 5, 7, 8],            cum: false },
  nodmg: { txt: n => `Voar ${n}s sem levar dano`,                 arr: [15, 30, 45, 60, 90],    cum: false },
  stage: { txt: n => `Alcançar o setor ${n}`,                     arr: [2, 3, 4, 5, 6],         cum: false },
};

const QUOTES = [
  'Aurora ainda acredita em você, piloto.',
  'Cada herói cai antes de se levantar. Tente de novo.',
  'O enxame não vai esperar. Evolua e volte mais forte.',
  'Sua nave caiu, mas sua coragem ficou no céu de Aurora.',
  'O Cmdt. Reis ainda confia em você. Vamos de novo!',
];

/* ============ save ============ */
const SAVE_KEY = 'novaVanguard.v1';
function defaultSave() {
  return { credits: 0, best: 0, bestStage: 1, up: { dmg: 0, rate: 0, hull: 0, magnet: 0, bomb: 0 },
    startTier: 1, missions: [], mlvl: {}, runs: 0, muted: false, seenIntro: false };
}
let save = (() => {
  try { return Object.assign(defaultSave(), JSON.parse(localStorage.getItem(SAVE_KEY)) || {}); }
  catch (e) { return defaultSave(); }
})();
function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignora */ } }

/* ============ missões ============ */
function mTarget(k, l) {
  const a = MT[k].arr;
  if (l < a.length) return a[l];
  return Math.round(a[a.length - 1] * (1 + 0.5 * (l - a.length + 1)));
}
function mAvailable(k) { return !((k === 'tier' || k === 'combo') && (save.mlvl[k] || 0) >= MT[k].arr.length); }
function mReward(k, l) { return 60 + 50 * l + (k === 'boss' ? 60 : 0); }
function fillMissions() {
  save.missions = save.missions.filter(m => MT[m.k]);
  while (save.missions.length < 3) {
    const pool = Object.keys(MT).filter(k => mAvailable(k) && !save.missions.some(m => m.k === k));
    if (!pool.length) break;
    save.missions.push({ k: pick(pool), prog: 0 });
  }
}
function missionProgress(k, val) {
  let changed = false;
  for (let i = 0; i < save.missions.length; i++) {
    const m = save.missions[i];
    if (m.k !== k) continue;
    const l = save.mlvl[k] || 0, tg = mTarget(k, l);
    const nv = MT[k].cum ? m.prog + val : Math.max(m.prog, val);
    if (nv === m.prog) continue;
    m.prog = nv; changed = true;
    if (m.prog >= tg) {
      const rw = mReward(k, l);
      save.credits += rw;
      save.mlvl[k] = l + 1;
      save.missions.splice(i, 1);
      toast('MISSÃO CUMPRIDA!', `${MT[k].txt(tg)} · +${rw} 💎`);
      Sfx.mission();
      if (run) run.credits += 0;
      fillMissions();
      i--;
    }
  }
  if (changed) persist();
}
function toast(a, b) {
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = `${a}<small>${b}</small>`;
  const box = $('toasts');
  while (box.children.length >= 2) box.firstChild.remove();
  box.appendChild(d);
  setTimeout(() => d.remove(), 3700);
}

/* ============ estado do jogo ============ */
const stars = [];
for (let i = 0; i < 90; i++) stars.push({ x: rnd(0, W), y: rnd(0, 800), z: pick([0.3, 0.6, 1]), s: rnd(0.6, 1.6) });

const G = { mode: 'menu' };
let run = null;
let p, bullets, ebul, enemies, items, coins, parts, rings, floats, banners, timers;
let boss = null;
let shake = 0, flash = 0, flashCol = '255,255,255', tScale = 1, slow = { t: 0, ts: 1 };
let tNow = 0;
let radioMsg = null;
let keys = {};
const ptr = { down: false, id: null, lx: 0, ly: 0 };
let tgt = { x: W / 2, y: 500 };

function reset() {
  const hpMax = 100 + 20 * save.up.hull;
  const st = save.startTier;
  p = { x: W / 2, y: H - 110, hp: hpMax, maxhp: hpMax, tier: st, xp: TIERS[st - 1].xp, shield: 0, inv: 0,
        fireT: 0.2, missT: 0.8, bombs: 1 + save.up.bomb, nodmg: 0, dead: false, vx: 0 };
  tgt = { x: p.x, y: p.y };
  bullets = []; ebul = []; enemies = []; items = []; coins = []; parts = []; rings = []; floats = []; banners = []; timers = [];
  boss = null; shake = 0; flash = 0; slow = { t: 0, ts: 1 }; radioMsg = null;
  run = { score: 0, kills: 0, credits: 0, combo: 0, comboT: 0, mult: 1, maxMult: 1, picks: 0, stage: 0, st: null,
          t: 0, lowWarned: false, heartT: 0, hintT: 6, bosses: 0 };
}

/* ============ efeitos visuais ============ */
const glowCache = {};
function glowSpr(col) {
  if (glowCache[col]) return glowCache[col];
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, '#fff'); gr.addColorStop(0.22, col); gr.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  return glowCache[col] = c;
}
function glow(x, y, r, col, a = 1) {
  g.globalAlpha = a;
  g.drawImage(glowSpr(col), x - r, y - r, r * 2, r * 2);
}
function burst(x, y, col, n, spd, size, life) {
  for (let i = 0; i < n && parts.length < 450; i++) {
    const a = rnd(0, TAU), s = rnd(spd * 0.2, spd);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rnd(life * 0.5, life), max: life, size: rnd(size * 0.5, size), col });
  }
}
function ring(x, y, max, col, life = 0.5) { rings.push({ x, y, r: 4, max, life, t: 0, col }); }
function floater(x, y, txt, col, size = 14) { floats.push({ x, y, txt, col, size, t: 0 }); }
function banner(text, sub, col = '#7ee7ff', dur = 2.6) { banners.push({ text, sub, col, t: 0, dur }); }
function radio(msg) { radioMsg = { msg, t: 0, dur: 5 }; Sfx.radio(); }
function addShake(v) { shake = Math.min(18, Math.max(shake, v)); }
function doFlash(a, col = '255,255,255') { flash = a; flashCol = col; }
function slowmo(t, ts) { slow = { t, ts }; }
function after(sec, fn) { timers.push({ t: sec, fn }); }
function vibrate(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* ignora */ } }

/* ============ progressão ============ */
function addScore(pts) {
  run.score += Math.round(pts * run.mult);
  missionProgress('score', run.score);
}
function addXp(n) {
  p.xp += n;
  while (p.tier < 5 && p.xp >= TIERS[p.tier].xp) evolve();
}
function evolve() {
  p.tier++;
  const T = TIERS[p.tier - 1];
  p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.25);
  Sfx.evolve();
  doFlash(0.85, '200,240,255');
  addShake(12);
  slowmo(0.7, 0.3);
  ring(p.x, p.y, 320, T.col, 0.8);
  ring(p.x, p.y, 200, '#ffffff', 0.5);
  burst(p.x, p.y, T.col, 60, 320, 5, 0.9);
  for (const b of ebul) { burst(b.x, b.y, '#ffd166', 2, 80, 3, 0.5); coins.push({ x: b.x, y: b.y, vx: 0, vy: 0, v: 1 }); }
  ebul.length = 0;
  banner('EVOLUÇÃO!', `${T.name} · nível ${p.tier}`, T.col, 2.4);
  vibrate([40, 40, 80]);
  missionProgress('tier', p.tier);
}
function addCombo() {
  run.combo++; run.comboT = 2.4;
  const m = Math.min(8, 1 + Math.floor(run.combo / 4));
  if (m > run.mult) { Sfx.combo(m); floater(p.x, p.y - 40, `COMBO x${m}!`, '#ffd166', 18); missionProgress('combo', m); }
  run.mult = m; run.maxMult = Math.max(run.maxMult, m);
}

/* ============ início / fim ============ */
function startRun() {
  reset();
  G.mode = 'play';
  hideAll();
  save.runs++;
  Sfx.resume();
  Sfx.music.muffle(false);
  Sfx.music.set(1, false);
  Sfx.music.start();
  beginStage(1);
  fillMissions();
  missionProgress('stage', 1);
}
function beginStage(n) {
  const def = STAGES[(n - 1) % STAGES.length];
  run.stage = n;
  run.st = { n, t: 0, dur: 52 + Math.min(20, n * 3), spawnT: 1.5, formT: 9, bossSpawned: false, def, warned: false };
  boss = null;
  banner(`SETOR ${n}`, def.name, `hsl(${def.hue},90%,70%)`, 2.8);
  after(0.9, () => radio(def.msg));
  Sfx.music.set(n >= 3 ? 2 : 1, false);
  missionProgress('stage', n);
}
function die() {
  if (p.dead) return;
  p.dead = true;
  p.hp = 0;
  Sfx.music.stop(1.5);
  Sfx.music.muffle(false);
  Sfx.explode(3); Sfx.bomb();
  Sfx.gameOver();
  burst(p.x, p.y, '#ffffff', 80, 380, 6, 1.2);
  burst(p.x, p.y, '#ff9a3c', 60, 260, 7, 1.4);
  ring(p.x, p.y, 220, '#ff6a3c', 0.9);
  doFlash(1, '255,255,255'); addShake(18);
  slowmo(1.6, 0.25);
  vibrate([100, 50, 200]);
  after(2.0, showOver);
}
function showOver() {
  G.mode = 'over';
  const bonus = Math.floor(run.score / 40) + (run.stage - 1) * 40;
  const earned = run.credits + bonus;
  save.credits += earned;
  const isBest = run.score > save.best;
  if (isBest) save.best = run.score;
  save.bestStage = Math.max(save.bestStage, run.stage);
  persist();
  $('overTitle').textContent = isBest ? 'NOVO RECORDE!' : 'FIM DE JOGO';
  $('overQuote').textContent = pick(QUOTES);
  $('overStats').innerHTML = [
    ['Pontuação', fmt(run.score)], ['Setor alcançado', run.stage], ['Inimigos destruídos', run.kills],
    ['Nível da nave', TIERS[p.tier - 1].name], ['Créditos ganhos', `+${fmt(earned)} 💎`],
  ].map(r => `<div class="srow"><span>${r[0]}</span><b>${r[1]}</b></div>`).join('');
  show('over');
}

/* ============ spawn ============ */
function spawn(type, x, y, extra) {
  const d = ED[type], n = run.stage;
  const hp = Math.ceil(d.hp * (1 + 0.3 * (n - 1)));
  const e = Object.assign({ type, x, y, vx: 0, vy: d.sp * (1 + 0.03 * Math.min(n, 10)), hp, maxhp: hp, r: d.r,
    t: 0, fire: rnd(0.8, 1.6), ph: rnd(0, TAU), flash: 0, bx: x, hover: rnd(90, 170), charge: false }, extra || {});
  enemies.push(e);
  return e;
}
function spawnBoss() {
  const n = run.stage, def = run.st.def;
  const hp = Math.round(300 * (1 + 0.7 * (n - 1)));
  boss = { type: 'boss', x: W / 2, y: -80, vx: 0, vy: 0, hp, maxhp: hp, r: 46, t: 0, ph: 0, flash: 0, enter: 2.2,
    a1: 1.2, a2: 2.5, a3: 0, a4: 5, spin: 0, hue: def.hue, name: def.boss, dying: false, phase: 1 };
  enemies.push(boss);
  banner('⚠ ALERTA ⚠', `${def.boss} se aproxima`, '#ff4d6a', 3);
  Sfx.warning();
  after(1.4, () => { Sfx.bossRoar(); addShake(8); });
  Sfx.music.set(3, true);
  run.st.bossSpawned = true;
}
function director(dt) {
  const st = run.st, n = st.n;
  st.t += dt;
  if (st.t > st.dur - 4 && !st.warned && !st.bossSpawned) { st.warned = true; }
  if (st.bossSpawned) {
    // reforço leve durante o chefe
    return;
  }
  if (st.t >= st.dur) { spawnBoss(); return; }
  st.spawnT -= dt;
  if (st.spawnT <= 0) {
    st.spawnT = Math.max(0.42, 1.25 - 0.08 * n) * rnd(0.7, 1.2);
    const pool = ['drone', 'drone', 'zig'];
    if (n >= 2 || st.t > 25) pool.push('kami');
    if (n >= 2) pool.push('zig', 'gun');
    if (n >= 3 || st.t > 40) pool.push('gun');
    if (n >= 3) pool.push('kami');
    const type = pick(pool);
    if (st.t > 18 && type === 'gun' && Math.random() < 0.35 && n >= 3) spawn('elite', rnd(70, W - 70), -30);
    else spawn(type, rnd(30, W - 30), -24);
  }
  st.formT -= dt;
  if (st.formT <= 0 && st.t > 5) {
    st.formT = rnd(8, 13);
    const cx = rnd(90, W - 90), type = pick(['drone', 'zig']);
    for (let i = -2; i <= 2; i++) spawn(type, cx + i * 38, -24 - Math.abs(i) * 22, { bx: cx + i * 38 });
  }
}

/* ============ disparos ============ */
const PAT = [
  [],
  [[0, 0]],
  [[-7, 0], [7, 0]],
  [[0, 0], [-9, -0.13], [9, 0.13]],
  [[0, 0], [-9, -0.13], [9, 0.13]],
  [[0, 0], [-8, -0.12], [8, 0.12], [-15, -0.26], [15, 0.26]],
];
function pDmg() { return (1 + 0.12 * save.up.dmg) * (p.tier >= 5 ? 1.2 : 1); }
function pInterval() { return Math.max(0.1, (0.28 - 0.02 * p.tier) * Math.pow(0.93, save.up.rate)); }
function firePlayer(dt) {
  p.fireT -= dt;
  if (p.fireT <= 0) {
    p.fireT = Math.max(p.fireT + pInterval(), 0.02);
    const col = p.tier >= 5 ? '#ffffff' : TIERS[p.tier - 1].col;
    for (const [dx, a] of PAT[p.tier]) {
      bullets.push({ x: p.x + dx, y: p.y - 16, vx: Math.sin(a) * 650, vy: -Math.cos(a) * 650, dmg: pDmg(), r: 4,
        col, pierce: p.tier >= 5 ? 1 : 0, hit: null, hom: false });
    }
    Sfx.shoot(p.tier);
  }
  if (p.tier >= 4) {
    p.missT -= dt;
    if (p.missT <= 0) {
      p.missT = 1.1;
      const n = p.tier >= 5 ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const side = (i % 2 ? 1 : -1) * (1 + (i >> 1) * 0.7);
        bullets.push({ x: p.x + side * 12, y: p.y, vx: side * 80, vy: -160, dmg: 3 * pDmg(), r: 5, col: '#ff9a3c', hom: true, life: 2.6, hit: null, pierce: 0 });
      }
      Sfx.missile();
    }
  }
}
function ebullet(x, y, ang, sp, col = '#ff4d6a', r = 5, dmg = 12) {
  ebul.push({ x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, r, col, dmg });
}
function aimAng(x, y) { return Math.atan2(p.y - y, p.x - x); }

function useBomb() {
  if (G.mode !== 'play' || p.dead || p.bombs <= 0) return;
  p.bombs--;
  Sfx.bomb();
  doFlash(1, '255,230,180'); addShake(16);
  ring(p.x, p.y, 520, '#ffcf70', 0.9); ring(p.x, p.y, 380, '#ffffff', 0.6);
  for (const b of ebul) { burst(b.x, b.y, '#ffd166', 2, 90, 3, 0.5); coins.push({ x: b.x, y: b.y, vx: 0, vy: 0, v: 1 }); }
  ebul.length = 0;
  for (const e of enemies) {
    if (e.type === 'boss') { if (e.enter <= 0) damageEnemy(e, 40, true); }
    else damageEnemy(e, 40, true);
  }
  p.inv = Math.max(p.inv, 1.2);
  vibrate(120);
}

/* ============ dano ============ */
function hurtPlayer(d) {
  if (p.dead || p.inv > 0) return;
  if (p.shield > 0) { Sfx.shieldHit(); p.inv = 0.25; ring(p.x, p.y, 36, '#5fe3ff', 0.3); return; }
  p.hp -= d; p.inv = 1.0; p.nodmg = 0;
  run.combo = 0; run.comboT = 0; run.mult = 1;
  addShake(11); doFlash(0.35, '255,40,60');
  Sfx.hurt(); vibrate(60);
  burst(p.x, p.y, '#ff6a6a', 16, 200, 4, 0.5);
  if (p.hp <= 0) die();
}
function damageEnemy(e, d, noSpark) {
  if (e.dying) return;
  if (e.type === 'boss' && e.enter > 0) return;
  e.hp -= d; e.flash = 0.07;
  if (!noSpark) { burst(e.x + rnd(-6, 6), e.y + e.r * 0.5, '#fff1a8', 2, 120, 2.5, 0.25); Sfx.hit(); }
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  if (e.dying) return;
  if (e.type === 'boss') return killBoss(e);
  e.dying = true;
  const d = ED[e.type];
  run.kills++;
  missionProgress('kills', 1);
  addCombo(); addScore(d.score); addXp(d.xp);
  const big = e.type === 'elite';
  Sfx.explode(big ? 2 : 0.7);
  burst(e.x, e.y, d.col, big ? 40 : 16, big ? 280 : 200, big ? 6 : 4, 0.7);
  burst(e.x, e.y, '#ffffff', big ? 12 : 5, 160, 3, 0.4);
  ring(e.x, e.y, big ? 80 : 38, d.col, 0.4);
  addShake(big ? 6 : 1.5);
  const nc = big ? 8 : rint(1, 2);
  for (let i = 0; i < nc; i++) coins.push({ x: e.x + rnd(-8, 8), y: e.y + rnd(-8, 8), vx: rnd(-60, 60), vy: rnd(-40, 60), v: 1 });
  if (big || Math.random() < 0.075) {
    const t = pick(['heal', 'shield', 'power', 'power', 'bomb', 'heal']);
    items.push({ x: e.x, y: e.y, t, ph: 0 });
  }
}
function killBoss(b) {
  b.dying = true;
  run.bosses++;
  missionProgress('boss', 1);
  ebul.length = 0;
  for (const e of enemies) if (e !== b && !e.dying) { e.dying = true; burst(e.x, e.y, ED[e.type].col, 10, 160, 4, 0.5); }
  Sfx.bossRoar();
  slowmo(2.2, 0.22);
  addShake(10);
  // cadeia de explosões
  for (let i = 0; i < 14; i++) {
    after(0.1 + i * 0.13, () => {
      const x = b.x + rnd(-b.r, b.r), y = b.y + rnd(-b.r * 0.7, b.r * 0.7);
      Sfx.explode(1.6); addShake(8);
      burst(x, y, '#ff9a3c', 22, 280, 6, 0.8); burst(x, y, '#ffffff', 8, 200, 4, 0.5);
      ring(x, y, 70, '#ffb454', 0.5);
    });
  }
  after(1.95, () => {
    Sfx.explode(3); Sfx.bomb();
    doFlash(1, '255,255,255'); addShake(18);
    burst(b.x, b.y, '#ffffff', 90, 420, 7, 1.3);
    burst(b.x, b.y, `hsl(${b.hue},100%,65%)`, 80, 340, 8, 1.4);
    ring(b.x, b.y, 460, '#ffffff', 1.0);
    b.gone = true;
    addScore(1000 * run.stage); addXp(120);
    for (let i = 0; i < 40; i++) coins.push({ x: b.x + rnd(-30, 30), y: b.y + rnd(-30, 30), vx: rnd(-160, 160), vy: rnd(-160, 160), v: 2 });
    items.push({ x: b.x, y: b.y, t: 'heal', ph: 0 });
    items.push({ x: b.x - 40, y: b.y, t: 'bomb', ph: 0 });
    vibrate([80, 40, 160]);
  });
  after(3.2, () => {
    Sfx.stageClear();
    banner('SETOR LIBERADO!', STAGES[(run.stage - 1) % STAGES.length].name, '#7affc8', 3);
    p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.3);
    p.shield = Math.max(p.shield, 3);
  });
  after(6.3, () => { if (!p.dead) beginStage(run.stage + 1); });
}

/* ============ atualização ============ */
function updateBg(dt) {
  for (const s of stars) {
    s.y += s.z * 60 * dt * (G.mode === 'play' ? 1.6 : 0.8);
    if (s.y > H + 4) { s.y = -4; s.x = rnd(0, W); }
  }
}

function updateEnemy(e, dt) {
  e.t += dt;
  if (e.flash > 0) e.flash -= dt;
  switch (e.type) {
    case 'drone':
      e.y += e.vy * dt; e.x += Math.sin(e.t * 2 + e.ph) * 28 * dt; break;
    case 'zig':
      e.y += e.vy * dt; e.x = e.bx + Math.sin(e.t * 3 + e.ph) * 70; break;
    case 'kami':
      if (!e.charge) {
        e.y += 55 * dt;
        if (e.t > 0.9) {
          e.charge = true;
          const a = aimAng(e.x, e.y), sp = 235 + run.stage * 8;
          e.vx = Math.cos(a) * sp; e.vy = Math.sin(a) * sp;
        }
      } else { e.x += e.vx * dt; e.y += e.vy * dt; }
      break;
    case 'gun':
      if (e.y < e.hover && e.t < 9) e.y += e.vy * 1.5 * dt;
      else if (e.t >= 9) e.y += 120 * dt;
      e.x += Math.sin(e.t * 1.2 + e.ph) * 40 * dt;
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 40 && e.y < H - 120) {
        e.fire = Math.max(0.9, 1.9 - 0.1 * run.stage);
        ebullet(e.x, e.y + 10, aimAng(e.x, e.y), 170 + run.stage * 6);
        Sfx.enemyShot();
      }
      break;
    case 'elite':
      if (e.y < 115) e.y += 60 * dt;
      e.x += Math.cos(e.t * 0.9 + e.ph) * 55 * dt;
      e.fire -= dt;
      if (e.fire <= 0 && e.y > 40) {
        e.fire = 1.7;
        const a = aimAng(e.x, e.y);
        for (let k = -1; k <= 1; k++) ebullet(e.x, e.y + 14, a + k * 0.28, 185, '#4de2c5', 5);
        Sfx.enemyShot();
      }
      if (e.t > 22) e.y += 90 * dt;
      break;
    case 'boss': updateBoss(e, dt); break;
  }
  if (e.type !== 'boss') {
    e.x = clamp(e.x, -40, W + 40);
    if (e.y > H + 50 || e.y < -120 || e.x < -60 || e.x > W + 60) e.gone = true;
  }
}

function updateBoss(b, dt) {
  if (b.dying) { b.x += Math.sin(tNow * 60) * 0.8; return; }
  if (b.enter > 0) {
    b.enter -= dt;
    b.y += (125 - b.y) * Math.min(1, dt * 1.6);
    return;
  }
  const ratio = b.hp / b.maxhp;
  const newPhase = ratio > 0.66 ? 1 : ratio > 0.33 ? 2 : 3;
  if (newPhase !== b.phase) {
    b.phase = newPhase;
    Sfx.bossRoar(); addShake(12); doFlash(0.5, '255,60,80');
    ring(b.x, b.y, 300, '#ff4d6a', 0.7);
    ebul.length = 0;
    banner(newPhase === 2 ? 'ELE ESTÁ FURIOSO!' : 'ÚLTIMA FASE!', '', '#ff4d6a', 1.8);
    if (newPhase === 3) radio('Cmdt. Reis: Ele está enfraquecendo! Mais um pouco, piloto!');
  }
  b.t += dt;
  const spd = 0.7 + b.phase * 0.15;
  b.x = W / 2 + Math.sin(b.t * spd) * (W / 2 - 75);
  b.y = 125 + Math.sin(b.t * 0.9) * 22;
  const sc = 1 + 0.08 * (run.stage - 1);
  b.a1 -= dt;
  if (b.a1 <= 0) {
    b.a1 = Math.max(0.6, 1.3 - 0.2 * b.phase) / Math.min(1.5, sc);
    const a = aimAng(b.x, b.y), n = b.phase + 2;
    for (let k = 0; k < n; k++) ebullet(b.x, b.y + 30, a + (k - (n - 1) / 2) * 0.2, 190 * Math.min(1.4, sc), '#ff4d6a', 5);
    Sfx.bossShot();
  }
  if (b.phase >= 2) {
    b.a2 -= dt;
    if (b.a2 <= 0) {
      b.a2 = 2.8 - 0.2 * b.phase;
      const n = 14 + run.stage * 2, off = rnd(0, TAU);
      for (let k = 0; k < n; k++) ebullet(b.x, b.y, off + k / n * TAU, 120 * Math.min(1.4, sc), '#ffb454', 5);
      Sfx.bossShot();
    }
  }
  if (b.phase >= 3) {
    b.a3 -= dt;
    if (b.a3 <= 0) {
      b.a3 = 0.11;
      b.spin += 0.55;
      ebullet(b.x, b.y, b.spin, 150, '#c77dff', 4, 10);
      ebullet(b.x, b.y, b.spin + Math.PI, 150, '#c77dff', 4, 10);
    }
    b.a4 -= dt;
    if (b.a4 <= 0) {
      b.a4 = 6;
      spawn('kami', b.x - 40, b.y + 30); spawn('kami', b.x + 40, b.y + 30);
    }
  }
}

function updatePlay(rdt) {
  tNow += rdt;
  // temporizadores em tempo real
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= rdt;
    if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); f(); }
  }
  if (slow.t > 0) { slow.t -= rdt; tScale = slow.ts; } else tScale = 1;
  const dt = rdt * tScale;
  run.t += dt;

  updateBg(dt);

  // efeitos visuais
  shake *= Math.pow(0.02, rdt);
  if (flash > 0) flash = Math.max(0, flash - rdt * 1.6);
  for (let i = banners.length - 1; i >= 0; i--) { banners[i].t += rdt; if (banners[i].t > banners[i].dur) banners.splice(i, 1); }
  if (radioMsg) { radioMsg.t += rdt; if (radioMsg.t > radioMsg.dur) radioMsg = null; }
  run.hintT -= rdt;

  // jogador
  if (!p.dead) {
    const ks = 330;
    if (keys.ArrowLeft || keys.a) tgt.x -= ks * dt;
    if (keys.ArrowRight || keys.d) tgt.x += ks * dt;
    if (keys.ArrowUp || keys.w) tgt.y -= ks * dt;
    if (keys.ArrowDown || keys.s) tgt.y += ks * dt;
    tgt.x = clamp(tgt.x, 18, W - 18);
    tgt.y = clamp(tgt.y, H * 0.28, H - 36);
    const ox = p.x;
    const k = Math.min(1, rdt * 16);
    p.x += (tgt.x - p.x) * k; p.y += (tgt.y - p.y) * k;
    p.vx = (p.x - ox) / Math.max(rdt, 0.001);
    if (p.inv > 0) p.inv -= dt;
    if (p.shield > 0) p.shield -= dt;
    p.nodmg += dt;
    if (Math.floor(p.nodmg) !== Math.floor(p.nodmg - dt)) missionProgress('nodmg', Math.floor(p.nodmg));
    firePlayer(dt);
    // trilha do motor
    if (parts.length < 400 && Math.random() < 0.8)
      parts.push({ x: p.x + rnd(-3, 3), y: p.y + 16, vx: rnd(-15, 15), vy: rnd(90, 180), life: 0.3, max: 0.3, size: rnd(2, 3.5), col: p.tier >= 5 ? '#bfe9ff' : '#58b6ff' });

    // combo
    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) { run.combo = 0; run.mult = 1; } }

    // vida baixa: emoção
    const low = p.hp / p.maxhp < 0.3;
    Sfx.music.muffle(low);
    if (low) {
      run.heartT -= dt;
      if (run.heartT <= 0) { run.heartT = 0.85; Sfx.heart(); vibrate(25); }
      if (!run.lowWarned) { run.lowWarned = true; radio('Cmdt. Reis: Casco crítico! Aguenta firme, piloto!'); }
    } else if (p.hp / p.maxhp > 0.5) run.lowWarned = false;
  }

  if (!p.dead) director(dt);

  // balas do jogador
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.hom) {
      b.life -= dt;
      let best = null, bd = 1e9;
      for (const e of enemies) {
        if (e.dying || (e.type === 'boss' && e.enter > 0)) continue;
        const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
        if (d < bd && e.y > -10) { bd = d; best = e; }
      }
      let dx = 0, dy = -420;
      if (best) { const a = Math.atan2(best.y - b.y, best.x - b.x); dx = Math.cos(a) * 430; dy = Math.sin(a) * 430; }
      const k = Math.min(1, dt * 5);
      b.vx += (dx - b.vx) * k; b.vy += (dy - b.vy) * k;
      if (b.life <= 0) b.dead = true;
      if (parts.length < 400) parts.push({ x: b.x, y: b.y, vx: rnd(-10, 10), vy: rnd(-10, 10), life: 0.35, max: 0.35, size: 3, col: '#ff9a3c' });
    }
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) b.dead = true;
  }
  // balas inimigas
  for (const b of ebul) {
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (b.y < -30 || b.y > H + 30 || b.x < -30 || b.x > W + 30) b.dead = true;
  }
  // inimigos
  for (const e of enemies) updateEnemy(e, dt);

  // colisões: tiros x inimigos
  for (const b of bullets) {
    if (b.dead) continue;
    for (const e of enemies) {
      if (e.dying || e.gone) continue;
      const rr = e.r + b.r;
      if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 < rr * rr) {
        if (b.hit && b.hit.includes(e)) continue;
        if (e.type === 'boss' && e.enter > 0) { b.dead = true; break; }
        damageEnemy(e, b.dmg);
        if (b.hom) { burst(b.x, b.y, '#ff9a3c', 10, 160, 4, 0.4); ring(b.x, b.y, 28, '#ffb454', 0.25); }
        if (b.pierce > 0) { b.pierce--; (b.hit = b.hit || []).push(e); }
        else { b.dead = true; break; }
      }
    }
  }
  if (!p.dead) {
    // inimigo x jogador
    for (const e of enemies) {
      if (e.dying || e.gone) continue;
      const rr = e.r * 0.8 + 9;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 < rr * rr) {
        if (e.type === 'boss') hurtPlayer(25);
        else { hurtPlayer(e.type === 'kami' ? 24 : 18); if (p.inv > 0 || p.shield > 0) damageEnemy(e, 999); }
      }
    }
    for (const b of ebul) {
      if (b.dead) continue;
      const rr = b.r + 7;
      if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < rr * rr) { b.dead = true; hurtPlayer(b.dmg); }
    }
  }
  // limpeza
  bullets = bullets.filter(b => !b.dead);
  ebul = ebul.filter(b => !b.dead);
  enemies = enemies.filter(e => !e.dying && !e.gone || (e.type === 'boss' && !e.gone));
  if (boss && boss.gone) boss = null;

  // itens
  const magR = 70 + 28 * save.up.magnet;
  for (let i = items.length - 1; i >= 0; i--) {
    const it = items[i];
    it.ph += dt; it.y += 70 * dt;
    if (!p.dead) {
      const d2 = (it.x - p.x) ** 2 + (it.y - p.y) ** 2;
      if (d2 < 55 * 55) { it.x += (p.x - it.x) * dt * 6; it.y += (p.y - it.y) * dt * 6; }
      if (d2 < 24 * 24) { collectItem(it); items.splice(i, 1); continue; }
    }
    if (it.y > H + 30) items.splice(i, 1);
  }
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.x += c.vx * dt; c.y += c.vy * dt;
    c.vx *= Math.pow(0.1, dt); c.vy += 60 * dt * (c.vy < 120 ? 1 : 0);
    if (!p.dead) {
      const dx = p.x - c.x, dy = p.y - c.y, d2 = dx * dx + dy * dy;
      if (d2 < magR * magR) { const d = Math.sqrt(d2) || 1; c.x += dx / d * 420 * dt; c.y += dy / d * 420 * dt; }
      if (d2 < 18 * 18) { run.credits += c.v; Sfx.coin(); coins.splice(i, 1); continue; }
    }
    if (c.y > H + 20) coins.splice(i, 1);
  }
  // partículas
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vx *= Math.pow(0.25, dt); q.vy *= Math.pow(0.25, dt);
    if (q.life <= 0) parts.splice(i, 1);
  }
  for (let i = rings.length - 1; i >= 0; i--) { rings[i].t += dt; if (rings[i].t > rings[i].life) rings.splice(i, 1); }
  for (let i = floats.length - 1; i >= 0; i--) { floats[i].t += dt; floats[i].y -= 28 * dt; if (floats[i].t > 1.2) floats.splice(i, 1); }
}

function collectItem(it) {
  run.picks++;
  missionProgress('pick', 1);
  Sfx.pickup();
  burst(it.x, it.y, '#ffffff', 14, 180, 3.5, 0.5);
  ring(it.x, it.y, 50, '#ffffff', 0.35);
  if (it.t === 'heal') { p.hp = Math.min(p.maxhp, p.hp + p.maxhp * 0.35); floater(p.x, p.y - 30, 'REPARO +', '#6bffb0'); }
  else if (it.t === 'shield') { p.shield = 7; Sfx.shieldOn(); floater(p.x, p.y - 30, 'ESCUDO!', '#5fe3ff'); }
  else if (it.t === 'power') { addXp(45); floater(p.x, p.y - 30, 'ENERGIA +', '#ffd166'); }
  else if (it.t === 'bomb') { p.bombs = Math.min(3, p.bombs + 1); floater(p.x, p.y - 30, 'BOMBA NOVA!', '#ff9a3c'); }
}

/* ============ desenho ============ */
function poly(pts, fill, stroke, lw = 1.5) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  if (fill) { g.fillStyle = fill; g.fill(); }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); }
}

function drawShip(x, y, tier, t, sc = 1, blink = false) {
  const col = TIERS[tier - 1].col;
  g.save(); g.translate(x, y); g.scale(sc, sc);
  if (blink && Math.floor(t * 20) % 2) g.globalAlpha = 0.35;
  const fl = 9 + Math.sin(t * 45) * 3 + tier * 2.2;
  g.globalCompositeOperation = 'lighter';
  const flameX = tier >= 3 ? [-8, 8] : [0];
  for (const fx of flameX) {
    glow(fx, 16 + fl * 0.5, 14 + fl * 0.4, tier >= 4 ? '#ff7ad9' : '#4aa8ff', 0.9);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  if (blink && Math.floor(t * 20) % 2) g.globalAlpha = 0.35;

  const ws = 12 + tier * 4;
  // asas
  const wing = s => poly([s * 6, -4, s * ws, 10 + tier, s * (ws - 3), 17 + tier, s * 5, 11], '#16264a', col, 1.5);
  wing(-1); wing(1);
  if (tier >= 2) { poly([-ws * 0.55, 6, -ws * 0.55 - 2, -4 - tier, -ws * 0.55 + 2, 6], col); poly([ws * 0.55, 6, ws * 0.55 - 2, -4 - tier, ws * 0.55 + 2, 6], col); }
  if (tier >= 4) {
    g.fillStyle = '#16264a'; g.strokeStyle = col; g.lineWidth = 1.5;
    for (const s of [-1, 1]) { g.beginPath(); g.rect(s * ws - 3, 2, 6, 14); g.fill(); g.stroke(); }
  }
  // fuselagem
  const gr = g.createLinearGradient(0, -24, 0, 16);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#9bb9e6'); gr.addColorStop(1, '#2c4577');
  poly([0, -20 - tier * 1.6, 7, 4, 5.5, 15, -5.5, 15, -7, 4], gr, col, 1.5);
  // cabine
  g.fillStyle = tier >= 5 ? '#ffe9a8' : '#bff6ff';
  g.beginPath(); g.ellipse(0, -3, 2.8, 6, 0, 0, TAU); g.fill();
  // aura nível máximo
  if (tier >= 5) {
    g.globalCompositeOperation = 'lighter';
    glow(0, 0, 34 + Math.sin(t * 6) * 3, '#8fd0ff', 0.45);
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
  g.globalAlpha = 1;
}

function drawEnemy(e) {
  const d = e.type === 'boss' ? null : ED[e.type];
  g.save(); g.translate(e.x, e.y);
  const fl = e.flash > 0;
  const fill = fl ? '#ffffff' : '#1d1030';
  switch (e.type) {
    case 'drone':
      poly([0, 14, 12, -8, 5, -4, 0, -10, -5, -4, -12, -8], fill, d.col); break;
    case 'zig':
      poly([0, 13, 14, 0, 8, -10, 0, -5, -8, -10, -14, 0], fill, d.col); break;
    case 'kami':
      g.rotate(Math.atan2(-e.vx, e.vy || 1) * (e.charge ? 1 : 0));
      poly([0, 16, 10, -10, 0, -4, -10, -10], fill, d.col); break;
    case 'gun':
      poly([-6, 18, -6, 8, -16, 2, -10, -10, 10, -10, 16, 2, 6, 8, 6, 18], fill, d.col);
      break;
    case 'elite':
      poly([0, 24, 14, 14, 26, 6, 20, -14, 8, -18, -8, -18, -20, -14, -26, 6, -14, 14], fill, d.col, 2);
      poly([-18, 12, -14, 24, -10, 12], d.col); poly([18, 12, 14, 24, 10, 12], d.col);
      break;
    case 'boss': drawBoss(e); break;
  }
  if (d) {
    g.globalCompositeOperation = 'lighter';
    glow(0, 0, e.r * 0.8, d.col, 0.55 + Math.sin(tNow * 8 + e.ph) * 0.15);
    g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    if (e.type === 'elite' || e.type === 'gun') {
      if (e.hp < e.maxhp) {
        const w = e.r * 1.6;
        g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(-w / 2, -e.r - 10, w, 3);
        g.fillStyle = d.col; g.fillRect(-w / 2, -e.r - 10, w * Math.max(0, e.hp / e.maxhp), 3);
      }
    }
  }
  g.restore();
}

function drawBoss(b) {
  const h = b.hue, c = `hsl(${h},90%,60%)`, dark = `hsl(${h},50%,12%)`;
  const fl = b.flash > 0;
  const f = fl ? '#ffffff' : dark;
  const pulse = 0.6 + Math.sin(tNow * (4 + b.phase * 3)) * 0.4;
  if (b.dying) g.translate(rnd(-3, 3), rnd(-3, 3));
  // asas
  poly([-20, -10, -80, -6, -92, 20, -60, 28, -30, 12], f, c, 2);
  poly([20, -10, 80, -6, 92, 20, 60, 28, 30, 12], f, c, 2);
  poly([-50, 6, -70, 36, -56, 34, -40, 14], c); poly([50, 6, 70, 36, 56, 34, 40, 14], c);
  // corpo
  poly([0, 46, 26, 26, 34, -10, 22, -40, 0, -46, -22, -40, -34, -10, -26, 26], f, c, 2.5);
  poly([0, 30, 14, 8, 0, -22, -14, 8], 'rgba(0,0,0,.45)', c, 1.5);
  // canhões
  g.fillStyle = c; g.fillRect(-48, 20, 8, 22); g.fillRect(40, 20, 8, 22);
  g.globalCompositeOperation = 'lighter';
  glow(0, 4, 26 + pulse * 8, `hsl(${(h + 20) % 360},100%,65%)`, 0.55 + pulse * 0.4);
  glow(-44, 42, 12, c, 0.7); glow(44, 42, 12, c, 0.7);
  g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
}

function drawItem(it) {
  const col = { heal: '#6bffb0', shield: '#5fe3ff', power: '#ffd166', bomb: '#ff9a3c' }[it.t];
  const ic = { heal: '+', shield: 'S', power: '★', bomb: 'N' }[it.t];
  g.save(); g.translate(it.x, it.y + Math.sin(it.ph * 4) * 2);
  g.globalCompositeOperation = 'lighter'; glow(0, 0, 22, col, 0.8); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
  g.fillStyle = 'rgba(5,10,30,.85)'; g.strokeStyle = col; g.lineWidth = 2;
  g.beginPath(); g.arc(0, 0, 11, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = col; g.font = 'bold 14px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ic, 0, 1);
  g.restore();
}

function drawBackground() {
  const st = run && run.st ? run.st.def : null;
  const hue = G.mode === 'menu' || !st ? 220 : st.hue;
  const gr = g.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0, `hsl(${hue},60%,5%)`);
  gr.addColorStop(0.6, `hsl(${hue},55%,9%)`);
  gr.addColorStop(1, `hsl(${(hue + 30) % 360},55%,14%)`);
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = 'lighter';
  const t = tNow * 0.02;
  glow(W * 0.2 + Math.sin(t * 3) * 40, H * 0.3, 190, `hsl(${hue},80%,40%)`, 0.22);
  glow(W * 0.85 + Math.cos(t * 2) * 30, H * 0.7, 230, `hsl(${(hue + 40) % 360},80%,38%)`, 0.18);
  g.globalAlpha = 1;
  for (const s of stars) {
    g.fillStyle = `rgba(200,225,255,${0.35 + s.z * 0.55})`;
    const l = (G.mode === 'play' ? s.z * 5 : 0) + s.s;
    g.fillRect(s.x, s.y, s.s, l);
  }
  g.globalCompositeOperation = 'source-over';
}

function drawWorld() {
  const sx = shake ? rnd(-shake, shake) : 0, sy = shake ? rnd(-shake, shake) : 0;
  g.save(); g.translate(sx, sy);
  for (const c of coins) {
    g.globalCompositeOperation = 'lighter'; glow(c.x, c.y, 9, '#ffd166', 0.9); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
    g.fillStyle = '#fff2b0'; g.fillRect(c.x - 2, c.y - 2, 4, 4);
  }
  for (const it of items) drawItem(it);
  for (const e of enemies) if (!e.gone) drawEnemy(e);
  g.globalCompositeOperation = 'lighter';
  for (const b of ebul) { glow(b.x, b.y, b.r * 3.2, b.col, 0.9); }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const b of ebul) { g.fillStyle = '#fff'; g.beginPath(); g.arc(b.x, b.y, b.r * 0.55, 0, TAU); g.fill(); }
  g.globalCompositeOperation = 'lighter';
  for (const b of bullets) {
    glow(b.x, b.y, b.r * 3, b.col, 0.85);
    if (!b.hom) { g.globalAlpha = 0.8; g.fillStyle = '#fff'; g.fillRect(b.x - 1.2, b.y - 8, 2.4, 14); }
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  if (p && !p.dead) {
    drawShip(p.x, p.y, p.tier, tNow, 1, p.inv > 0 && p.shield <= 0);
    if (p.shield > 0) {
      g.globalCompositeOperation = 'lighter';
      const a = p.shield < 1.5 ? (Math.floor(tNow * 10) % 2 ? 0.2 : 0.7) : 0.7;
      glow(p.x, p.y, 40, '#5fe3ff', a * 0.7); g.globalAlpha = a;
      g.strokeStyle = '#8ff0ff'; g.lineWidth = 2; g.beginPath(); g.arc(p.x, p.y, 27, 0, TAU); g.stroke();
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    }
  }
  g.globalCompositeOperation = 'lighter';
  for (const q of parts) { glow(q.x, q.y, q.size * 2.6, q.col, clamp(q.life / q.max, 0, 1)); }
  g.globalAlpha = 1;
  for (const r of rings) {
    const k = clamp(r.t / r.life, 0, 1);
    g.globalAlpha = (1 - k) * 0.9; g.strokeStyle = r.col; g.lineWidth = 4 * (1 - k) + 1;
    g.beginPath(); g.arc(r.x, r.y, 4 + (r.max - 4) * (1 - Math.pow(1 - k, 2)), 0, TAU); g.stroke();
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  for (const f of floats) {
    g.globalAlpha = clamp(1.2 - f.t, 0, 1); g.fillStyle = f.col; g.font = `bold ${f.size}px system-ui`; g.textAlign = 'center';
    g.fillText(f.txt, f.x, f.y);
  }
  g.globalAlpha = 1;
  g.restore();
}

function wrapText(txt, maxW) {
  const words = txt.split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (g.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  lines.push(cur); return lines;
}
function bar(x, y, w, h, k, col, bg = 'rgba(0,0,0,.55)') {
  g.fillStyle = bg; g.fillRect(x, y, w, h);
  g.fillStyle = col; g.fillRect(x, y, w * clamp(k, 0, 1), h);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(x + .5, y + .5, w - 1, h - 1);
}

function drawHUD() {
  const T = TIERS[p.tier - 1];
  const topY = 12;
  // vida
  const hk = p.hp / p.maxhp;
  const hcol = hk < 0.3 ? (Math.floor(tNow * 6) % 2 ? '#ff2a4a' : '#ff7a8a') : hk < 0.6 ? '#ffd166' : '#6bffb0';
  bar(10, topY, 120, 10, hk, hcol);
  g.fillStyle = '#fff'; g.font = 'bold 9px system-ui'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('CASCO', 12, topY + 8);
  // xp
  const nextXp = p.tier < 5 ? TIERS[p.tier].xp : TIERS[4].xp, prevXp = TIERS[p.tier - 1].xp;
  const xk = p.tier < 5 ? (p.xp - prevXp) / (nextXp - prevXp) : 1;
  bar(10, topY + 14, 120, 6, xk, T.col);
  g.fillStyle = T.col; g.font = 'bold 10px system-ui';
  g.fillText(`${T.name} · NV ${p.tier}${p.tier < 5 ? '' : ' MAX'}`, 10, topY + 33);
  if (p.shield > 0) { g.fillStyle = '#5fe3ff'; g.fillText(`ESCUDO ${p.shield.toFixed(0)}s`, 10, topY + 45); }
  // placar
  g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = 'bold 20px system-ui';
  g.fillText(fmt(run.score), W / 2 + 6, topY + 16);
  if (run.mult > 1) {
    g.fillStyle = '#ffd166'; g.font = `bold ${14 + run.mult}px system-ui`;
    g.fillText(`COMBO x${run.mult}`, W / 2 + 6, topY + 38);
    g.fillStyle = 'rgba(255,209,102,.9)'; g.fillRect(W / 2 - 30, topY + 44, 72 * clamp(run.comboT / 2.4, 0, 1), 2);
  }
  // pausa
  g.fillStyle = 'rgba(10,24,60,.7)'; g.strokeStyle = 'rgba(126,231,255,.6)'; g.lineWidth = 1.5;
  g.beginPath(); g.roundRect ? g.roundRect(W - 42, 8, 32, 32, 8) : g.rect(W - 42, 8, 32, 32); g.fill(); g.stroke();
  g.fillStyle = '#dff4ff'; g.fillRect(W - 33, 17, 4, 14); g.fillRect(W - 25, 17, 4, 14);
  // chefe
  if (boss && !boss.gone && !boss.dying) {
    const bk = boss.hp / boss.maxhp;
    g.textAlign = 'center'; g.fillStyle = '#ff7a8a'; g.font = 'bold 11px system-ui'; g.letterSpacing = '2px';
    g.fillText(boss.name, W / 2, 66);
    bar(40, 71, W - 80, 8, bk, `hsl(${boss.hue},90%,60%)`);
    g.letterSpacing = '0px';
  }
  // bomba
  const bx = W - 46, by = H - 54;
  g.fillStyle = p.bombs > 0 ? 'rgba(255,140,40,.25)' : 'rgba(80,80,80,.25)';
  g.strokeStyle = p.bombs > 0 ? '#ff9a3c' : '#666'; g.lineWidth = 2.5;
  g.beginPath(); g.arc(bx, by, 28, 0, TAU); g.fill(); g.stroke();
  g.fillStyle = p.bombs > 0 ? '#ffd9a0' : '#777'; g.font = 'bold 12px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('NOVA', bx, by - 6);
  g.font = 'bold 16px system-ui'; g.fillText('x' + p.bombs, bx, by + 10);
  g.textBaseline = 'alphabetic';
  // missão atual
  const m = save.missions[0];
  if (m) {
    const l = save.mlvl[m.k] || 0, tg = mTarget(m.k, l);
    g.textAlign = 'left'; g.fillStyle = 'rgba(190,215,255,.85)'; g.font = '11px system-ui';
    g.fillText(`🎯 ${MT[m.k].txt(tg)}  ${fmt(Math.min(m.prog, tg))}/${fmt(tg)}`, 10, H - 12);
  }
  // dica
  if (run.hintT > 0 && run.t < 12) {
    g.textAlign = 'center'; g.fillStyle = `rgba(255,255,255,${clamp(run.hintT / 2, 0, 0.8)})`; g.font = '13px system-ui';
    g.fillText('Arraste para mover · tiro automático', W / 2, H - 150);
    g.fillText('(PC: setas/WASD · espaço = bomba)', W / 2, H - 132);
  }
  // banners
  let by2 = H * 0.3;
  for (const b of banners) {
    const a = Math.min(1, b.t / 0.3, (b.dur - b.t) / 0.5);
    const sc = 1 + (1 - Math.min(1, b.t / 0.25)) * 0.5;
    g.save(); g.translate(W / 2, by2); g.scale(sc, sc); g.globalAlpha = clamp(a, 0, 1);
    g.textAlign = 'center'; g.fillStyle = b.col; g.font = 'bold 32px system-ui';
    g.shadowColor = b.col; g.shadowBlur = 18;
    g.fillText(b.text, 0, 0); g.shadowBlur = 0;
    if (b.sub) { g.fillStyle = '#fff'; g.font = '16px system-ui'; g.fillText(b.sub, 0, 26); }
    g.restore(); by2 += 64;
  }
  g.globalAlpha = 1;
  // rádio
  if (radioMsg) {
    const r = radioMsg, a = clamp(Math.min(r.t / 0.2, (r.dur - r.t) / 0.5), 0, 1);
    g.globalAlpha = a;
    g.font = '13px system-ui';
    const lines = wrapText(r.msg, W - 76), hh = 22 + lines.length * 17;
    const ry = H - 96 - hh;
    g.fillStyle = 'rgba(6,16,40,.88)'; g.strokeStyle = 'rgba(126,231,255,.6)'; g.lineWidth = 1.5;
    g.beginPath(); g.roundRect ? g.roundRect(14, ry, W - 28, hh, 10) : g.rect(14, ry, W - 28, hh); g.fill(); g.stroke();
    g.fillStyle = '#ff7a8a'; g.font = 'bold 9px system-ui'; g.textAlign = 'left'; g.fillText('● RÁDIO', 24, ry + 14);
    g.fillStyle = '#e8f3ff'; g.font = '13px system-ui';
    lines.forEach((ln, i) => g.fillText(ln, 24, ry + 32 + i * 17));
    g.globalAlpha = 1;
  }
}

function drawOverlays() {
  // vinheta de perigo
  if (p && !p.dead) {
    const k = p.hp / p.maxhp;
    if (k < 0.35) {
      const pulse = 0.5 + Math.sin(tNow * 7) * 0.5;
      const a = (0.35 - k) / 0.35 * (0.25 + pulse * 0.3);
      const gr = g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H * 0.8);
      gr.addColorStop(0, 'rgba(255,0,40,0)'); gr.addColorStop(1, `rgba(255,0,40,${a})`);
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
    }
  }
  if (flash > 0) { g.fillStyle = `rgba(${flashCol},${flash * 0.7})`; g.fillRect(0, 0, W, H); }
  if (tScale < 0.6) {
    const gr = g.createRadialGradient(W / 2, H / 2, H * 0.25, W / 2, H / 2, H * 0.75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.45)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
}

function render() {
  g.setTransform(S, 0, 0, S, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  drawBackground();
  if (G.mode === 'play' || G.mode === 'pause' || G.mode === 'over') {
    drawWorld();
    drawHUD();
    drawOverlays();
  } else {
    // vitrine no menu
    const t = tNow;
    drawShip(W / 2 + Math.sin(t * 0.8) * 20, H * 0.13 + Math.sin(t * 1.3) * 6, save.startTier, t, 1.6);
  }
}

/* ============ loop ============ */
let last = performance.now();
function loop(now) {
  const rdt = clamp((now - last) / 1000, 0, 0.05);
  last = now;
  try { frame(rdt); } catch (err) {
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    document.title = 'FRAMEERR: ' + err.message + ' | ' + String(err.stack).split('\n').slice(0, 3).join(' < ');
  }
  requestAnimationFrame(loop);
}
function frame(rdt) {
  if (G.mode === 'play') updatePlay(rdt);
  else if (G.mode === 'over') {
    tNow += rdt;
    for (const q of parts) { q.life -= rdt; q.x += q.vx * rdt; q.y += q.vy * rdt; }
    parts = parts.filter(q => q.life > 0);
    for (const r of rings) r.t += rdt;
    rings = rings.filter(r => r.t < r.life);
    updateBg(rdt);
    shake = 0; if (flash > 0) flash = Math.max(0, flash - rdt);
  } else if (G.mode === 'menu') { tNow += rdt; updateBg(rdt); }
  render();
}

/* ============ entrada ============ */
function toGame(e) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
cv.addEventListener('pointerdown', e => {
  Sfx.resume();
  if (G.mode !== 'play' || p.dead) return;
  const q = toGame(e);
  if (q.x > W - 46 && q.y < 48) { pauseGame(); return; }
  if ((q.x - (W - 46)) ** 2 + (q.y - (H - 54)) ** 2 < 40 * 40) { useBomb(); return; }
  if (ptr.down) return;
  ptr.down = true; ptr.id = e.pointerId; ptr.lx = q.x; ptr.ly = q.y;
  try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignora */ }
});
cv.addEventListener('pointermove', e => {
  if (!ptr.down || e.pointerId !== ptr.id || G.mode !== 'play') return;
  const q = toGame(e);
  tgt.x += (q.x - ptr.lx) * 1.25; tgt.y += (q.y - ptr.ly) * 1.25;
  ptr.lx = q.x; ptr.ly = q.y;
});
const endPtr = e => { if (e.pointerId === ptr.id) { ptr.down = false; ptr.id = null; } };
cv.addEventListener('pointerup', endPtr);
cv.addEventListener('pointercancel', endPtr);
cv.addEventListener('contextmenu', e => e.preventDefault());

window.addEventListener('keydown', e => {
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = true;
  if (k === ' ' || k === 'b') { e.preventDefault(); useBomb(); }
  if (k === 'p' || k === 'Escape') { if (G.mode === 'play') pauseGame(); else if (G.mode === 'pause') resumeGame(); }
});
window.addEventListener('keyup', e => { keys[e.key.length === 1 ? e.key.toLowerCase() : e.key] = false; });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.mode === 'play' && !p.dead) pauseGame(); Sfx.suspend(); }
  else if (G.mode !== 'pause') Sfx.resume();
});
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 150));

/* ============ telas ============ */
const screens = ['menu', 'story', 'hangar', 'missions', 'pause', 'over'];
function show(id) { screens.forEach(s => $(s).classList.toggle('hidden', s !== id)); }
function hideAll() { screens.forEach(s => $(s).classList.add('hidden')); }
function toMenu() {
  G.mode = 'menu';
  Sfx.music.stop(0.8);
  run = null; p = null; bullets = []; ebul = []; enemies = []; parts = []; rings = [];
  refreshMenu(); show('menu');
}
function refreshMenu() {
  $('mCredits').textContent = fmt(save.credits);
  $('mBest').textContent = fmt(save.best);
  $('btnSound').textContent = save.muted ? '🔇 SOM: DESLIGADO' : '🔊 SOM: LIGADO';
}
function pauseGame() {
  if (G.mode !== 'play' || p.dead) return;
  G.mode = 'pause'; ptr.down = false; show('pause'); Sfx.music.stop(0.3);
}
function resumeGame() {
  if (G.mode !== 'pause') return;
  hideAll(); G.mode = 'play'; last = performance.now(); Sfx.resume(); Sfx.music.start();
  Sfx.music.set(run.st && run.st.def && run.stage >= 3 ? 2 : 1, !!boss);
}

function renderHangar() {
  $('hCredits').textContent = fmt(save.credits);
  const list = $('hangarList'); list.innerHTML = '';
  const cost = (u, l) => Math.round(u.base * Math.pow(1.7, l));
  for (const u of UPG) {
    const l = save.up[u.id] || 0, maxed = l >= u.max, c = cost(u, l);
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<div class="info"><div class="nm">${u.name}</div><div class="ds">${u.desc}</div><div class="lv">Nível ${l}/${u.max}</div>
      <div class="bar"><i style="width:${l / u.max * 100}%"></i></div></div>`;
    const b = document.createElement('button');
    b.textContent = maxed ? 'MÁX' : `💎 ${fmt(c)}`;
    b.disabled = maxed || save.credits < c;
    b.onclick = () => { if (save.credits >= c && !maxed) { save.credits -= c; save.up[u.id] = l + 1; persist(); Sfx.pickup(); renderHangar(); } };
    row.appendChild(b); list.appendChild(row);
  }
  // nave inicial
  const st = save.startTier, maxed = st >= 3, c = START_TIER_COST[st] || 0;
  const row = document.createElement('div'); row.className = 'row';
  row.innerHTML = `<div class="info"><div class="nm">NAVE INICIAL</div><div class="ds">Comece cada partida já evoluída</div>
    <div class="lv">${TIERS[st - 1].name} (nível ${st}/3)</div><div class="bar"><i style="width:${st / 3 * 100}%"></i></div></div>`;
  const b = document.createElement('button');
  b.textContent = maxed ? 'MÁX' : `💎 ${fmt(c)}`;
  b.disabled = maxed || save.credits < c;
  b.onclick = () => { if (save.credits >= c && !maxed) { save.credits -= c; save.startTier = st + 1; persist(); Sfx.evolve(); renderHangar(); } };
  row.appendChild(b); list.appendChild(row);
}
function renderMissions() {
  fillMissions(); persist();
  $('msCredits').textContent = fmt(save.credits);
  const list = $('missionList'); list.innerHTML = '';
  for (const m of save.missions) {
    const l = save.mlvl[m.k] || 0, tg = mTarget(m.k, l);
    const row = document.createElement('div'); row.className = 'row';
    row.innerHTML = `<div class="info"><div class="nm">${MT[m.k].txt(tg)}</div>
      <div class="lv">${fmt(Math.min(m.prog, tg))} / ${fmt(tg)}</div>
      <div class="bar"><i style="width:${Math.min(100, m.prog / tg * 100)}%"></i></div></div>
      <div style="font-weight:800;color:#ffe29a">+${mReward(m.k, l)} 💎</div>`;
    list.appendChild(row);
  }
}

const INTRO = 'Ano 2187. O enxame alienígena destruiu todas as frotas... exceto uma nave.\n\nA sua.\n\nAurora, o último planeta habitável, conta com você. Destrua o inimigo, evolua sua nave e liberte cada setor.\n\nBoa sorte, piloto.';
let storyTimer = null;
function playIntro(done) {
  show('story');
  const el = $('storyText'); el.textContent = '';
  let i = 0, fin = false;
  clearInterval(storyTimer);
  storyTimer = setInterval(() => {
    el.textContent = INTRO.slice(0, ++i);
    if (i % 3 === 0) Sfx.radio();
    if (i >= INTRO.length) { clearInterval(storyTimer); fin = true; }
  }, 34);
  $('story').onclick = () => {
    Sfx.resume();
    if (!fin) { clearInterval(storyTimer); el.textContent = INTRO; fin = true; return; }
    $('story').onclick = null; save.seenIntro = true; persist(); done();
  };
}

$('btnPlay').onclick = () => { Sfx.resume(); Sfx.click(); if (!save.seenIntro) playIntro(startRun); else startRun(); };
$('btnHangar').onclick = () => { Sfx.click(); renderHangar(); show('hangar'); };
$('btnMissions').onclick = () => { Sfx.click(); renderMissions(); show('missions'); };
$('btnSound').onclick = () => { save.muted = !save.muted; Sfx.setMuted(save.muted); persist(); refreshMenu(); Sfx.click(); };
$('hangarBack').onclick = () => { Sfx.click(); if (G.mode === 'over') show('over'); else { refreshMenu(); show('menu'); } };
$('missionsBack').onclick = () => { Sfx.click(); refreshMenu(); show('menu'); };
$('btnResume').onclick = () => { Sfx.click(); resumeGame(); };
$('btnQuit').onclick = () => { Sfx.click(); toMenu(); };
$('btnAgain').onclick = () => { Sfx.click(); startRun(); };
$('btnOverHangar').onclick = () => { Sfx.click(); renderHangar(); show('hangar'); };
$('btnOverMenu').onclick = () => { Sfx.click(); toMenu(); };

/* ============ init ============ */
Sfx.setMuted(save.muted);
fillMissions();
resize();
refreshMenu();
requestAnimationFrame(loop);

// modo de teste (ex.: index.html?test=1&tier=4&stage=2) usado só para verificação automática
const qs = new URLSearchParams(location.search);
if (qs.get('test')) {
  save.seenIntro = true;
  save.startTier = clamp(+qs.get('tier') || 1, 1, 5);
  startRun();
  const sg = +qs.get('stage') || 1;
  if (sg > 1) beginStage(sg);
  if (qs.get('boss')) { run.st.t = run.st.dur; }
  window.__nv = { get p() { return p; }, get run() { return run; }, get enemies() { return enemies; } };
  const steps = +qs.get('sim') || 0;
  try {
    for (let i = 0; i < steps; i++) {            // simulação determinística para testes
      tgt.x = W / 2 + Math.sin(i / 40) * 120;
      if (p.hp < 40) p.hp = p.maxhp;
      if (qs.get('god')) p.inv = 9;
      updatePlay(1 / 60);
      if (G.mode !== 'play') break;
    }
  } catch (err) { document.title = 'SIMERR: ' + err.message + ' | ' + String(err.stack).split('\n').slice(0, 3).join(' < '); }
  if (!document.title.startsWith('SIMERR'))
    document.title = `T:${run ? run.t.toFixed(1) : 0} score:${run ? run.score : 0} tier:${p ? p.tier : 0} stage:${run ? run.stage : 0} boss:${!!boss} e:${enemies.length} G:${G.mode}`;
}
window.addEventListener('error', e => { document.title = 'ERR: ' + e.message + ' @' + e.lineno; });
})();
