/* Nova Vanguard - áudio 100% procedural (WebAudio): efeitos + trilha dinâmica */
const Sfx = (() => {
  let ctx = null, master, sfxBus, musBus, musLP, delay, noiseBuf;
  let muted = false;
  const gates = {};

  function init() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.2;
    master.connect(comp); comp.connect(ctx.destination);

    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.85; sfxBus.connect(master);

    musLP = ctx.createBiquadFilter(); musLP.type = 'lowpass'; musLP.frequency.value = 16000;
    musBus = ctx.createGain(); musBus.gain.value = 0;
    musBus.connect(musLP); musLP.connect(master);

    // delay (eco) para dar espaço à música
    delay = ctx.createDelay(1); delay.delayTime.value = 0.34;
    const fb = ctx.createGain(); fb.gain.value = 0.38;
    const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 2400;
    delay.connect(dl); dl.connect(fb); fb.connect(delay); dl.connect(musBus);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function resume() {
    if (!init()) return;
    if (ctx.state === 'suspended') ctx.resume();
  }
  function suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); }

  function setMuted(m) {
    muted = m;
    if (ctx) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  }

  function gate(name, ms) {
    const n = performance.now();
    if (gates[name] && n - gates[name] < ms) return false;
    gates[name] = n; return true;
  }

  function tone(f, d, type = 'sine', v = 0.1, o = {}) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const osc = ctx.createOscillator();
    const gn = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + d);
    if (o.det) osc.detune.value = o.det;
    const a = o.a !== undefined ? o.a : 0.005;
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + a);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    let node = osc;
    if (o.lp) {
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(o.lp, t);
      if (o.lp2) lp.frequency.exponentialRampToValueAtTime(o.lp2, t + d);
      osc.connect(lp); node = lp;
    }
    node.connect(gn);
    gn.connect(o.bus || sfxBus);
    if (o.send) { const s = ctx.createGain(); s.gain.value = o.send; gn.connect(s); s.connect(delay); }
    osc.start(t); osc.stop(t + d + 0.05);
  }

  function noise(d, v, f1, f2, o = {}) {
    const t = o.t !== undefined ? o.t : ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = noiseBuf;
    const fl = ctx.createBiquadFilter(); fl.type = o.type || 'lowpass';
    fl.frequency.setValueAtTime(f1, t);
    fl.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + d);
    const gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t + (o.a || 0.004));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
    src.connect(fl); fl.connect(gn); gn.connect(o.bus || sfxBus);
    src.start(t, Math.random() * 0.9); src.stop(t + d + 0.05);
  }

  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  /* ---------------- Efeitos ---------------- */
  const fx = {
    click() { if (!init()) return; tone(660, 0.07, 'square', 0.05, { f2: 990, lp: 3000 }); },
    shoot(tier) {
      if (!ctx || !gate('shoot', 55)) return;
      const f = 900 - tier * 90;
      tone(f, 0.09, tier >= 4 ? 'sawtooth' : 'square', 0.028 + tier * 0.004, { f2: f * 0.28, lp: 4000 });
    },
    missile() {
      if (!ctx || !gate('missile', 120)) return;
      noise(0.28, 0.08, 1800, 500, { type: 'bandpass' });
      tone(180, 0.25, 'sawtooth', 0.04, { f2: 520, lp: 1200 });
    },
    hit() {
      if (!ctx || !gate('hit', 45)) return;
      tone(300, 0.04, 'square', 0.02, { f2: 150 });
    },
    explode(size = 1) {
      if (!ctx || !gate('exp' + (size > 1.5 ? 'b' : 's'), size > 1.5 ? 80 : 45)) return;
      const d = 0.22 + size * 0.28;
      noise(d, 0.16 + size * 0.07, 2200, 160, {});
      tone(130, d, 'sine', 0.2 + size * 0.05, { f2: 38 });
    },
    pickup() {
      if (!ctx) return;
      [72, 76, 79, 84].forEach((m, i) => tone(mtof(m), 0.14, 'triangle', 0.09, { t: ctx.currentTime + i * 0.05, send: 0.3 }));
    },
    coin() {
      if (!ctx || !gate('coin', 40)) return;
      tone(1320, 0.07, 'square', 0.025, { lp: 5000 });
      tone(1760, 0.1, 'square', 0.025, { t: ctx.currentTime + 0.05, lp: 5000 });
    },
    combo(n) {
      if (!ctx) return;
      tone(mtof(60 + n * 2), 0.18, 'triangle', 0.09, { send: 0.3 });
    },
    evolve() {
      if (!ctx) return;
      const t = ctx.currentTime;
      noise(0.9, 0.12, 300, 6000, { type: 'bandpass', a: 0.6 });
      [57, 61, 64, 69, 73, 76, 81].forEach((m, i) =>
        tone(mtof(m), 0.5, 'sawtooth', 0.06, { t: t + i * 0.07, lp: 3500, send: 0.4 }));
      tone(70, 0.9, 'sine', 0.3, { t: t + 0.5, f2: 30 });
      noise(0.7, 0.2, 3000, 100, { t: t + 0.5 });
    },
    bomb() {
      if (!ctx) return;
      noise(1.3, 0.3, 4000, 60, {});
      tone(150, 1.2, 'sine', 0.4, { f2: 28 });
      tone(900, 0.6, 'sawtooth', 0.06, { f2: 60, lp: 2500, send: 0.4 });
    },
    hurt() {
      if (!ctx) return;
      noise(0.35, 0.22, 900, 100, {});
      tone(110, 0.3, 'sawtooth', 0.14, { f2: 45, lp: 600 });
    },
    shieldHit() { if (!ctx || !gate('sh', 90)) return; tone(1200, 0.18, 'sine', 0.08, { f2: 500 }); },
    shieldOn() { if (!ctx) return; tone(400, 0.4, 'sine', 0.1, { f2: 1200, send: 0.3 }); },
    heart() {
      if (!ctx) return;
      const t = ctx.currentTime;
      tone(62, 0.16, 'sine', 0.35, { f2: 40 });
      tone(58, 0.2, 'sine', 0.28, { t: t + 0.17, f2: 38 });
    },
    warning() {
      if (!ctx) return;
      const t = ctx.currentTime;
      for (let i = 0; i < 6; i++) tone(i % 2 ? 520 : 760, 0.22, 'sawtooth', 0.06, { t: t + i * 0.25, lp: 1800 });
    },
    bossRoar() {
      if (!ctx) return;
      noise(1.6, 0.25, 600, 60, {});
      tone(95, 1.5, 'sawtooth', 0.2, { f2: 28, lp: 500 });
      tone(48, 1.6, 'sine', 0.3, { f2: 25 });
    },
    bossShot() { if (!ctx || !gate('bs', 80)) return; tone(420, 0.12, 'square', 0.03, { f2: 140, lp: 2500 }); },
    enemyShot() { if (!ctx || !gate('es', 90)) return; tone(520, 0.08, 'sawtooth', 0.018, { f2: 260, lp: 2500 }); },
    mission() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [67, 72, 76, 79, 84].forEach((m, i) =>
        tone(mtof(m), 0.45, 'triangle', 0.11, { t: t + i * 0.09, send: 0.45 }));
      tone(mtof(60), 0.9, 'sine', 0.12, { t: t + 0.1 });
    },
    stageClear() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79, 84]].forEach((ch, i) =>
        ch.forEach(m => tone(mtof(m), 1.1, 'sawtooth', 0.045, { t: t + i * 0.45, lp: 2600, send: 0.45 })));
    },
    radio() {
      if (!ctx) return;
      tone(1500, 0.05, 'square', 0.03, { lp: 3000 });
      tone(1100, 0.06, 'square', 0.03, { t: ctx.currentTime + 0.07, lp: 3000 });
    },
    gameOver() {
      if (!ctx) return;
      const t = ctx.currentTime;
      [69, 67, 64, 60, 57].forEach((m, i) =>
        tone(mtof(m), 1.4, 'sawtooth', 0.06, { t: t + i * 0.35, lp: 1100, send: 0.6, a: 0.05 }));
    },
  };

  /* ---------------- Música dinâmica ---------------- */
  const Music = (() => {
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];       // Am F C G
    const bossProg = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];   // Dm Bb F C
    const lead = [0, 2, 1, 2, 0, 1];
    let playing = false, timer = null, step = 0, nextT = 0;
    let level = 0, boss = false, tempo = 96;

    function targetTempo() { return boss ? 142 : [92, 108, 120, 130][Math.min(3, level)]; }

    function padNote(ch, t, dur) {
      ch.forEach(m => {
        tone(mtof(m), dur, 'sawtooth', 0.018, { t, a: 0.6, lp: 900, lp2: 500, bus: musBus, det: Math.random() * 10 - 5 });
        tone(mtof(m - 12), dur, 'sine', 0.03, { t, a: 0.5, bus: musBus });
      });
    }

    function playStep(s, t) {
      const bar = Math.floor(s / 16) % 4, i = s % 16;
      const ch = (boss ? bossProg : prog)[bar];
      const sd = 60 / tempo / 4;

      if (i === 0) padNote(ch, t, sd * 16);

      // baixo
      if (level >= 1 || boss) {
        if (i % 2 === 0) {
          const oct = (i === 6 || i === 14) ? 12 : 0;
          tone(mtof(ch[0] - 24 + oct), sd * 1.8, 'sawtooth', 0.075, { t, lp: 520, lp2: 220, bus: musBus });
        }
      } else if (i % 8 === 0) {
        tone(mtof(ch[0] - 24), sd * 7, 'sine', 0.13, { t, a: 0.05, bus: musBus });
      }

      // arpejo
      if (level >= 1 || boss) {
        const every = (level >= 2 || boss) ? 1 : 2;
        if (i % every === 0) {
          const n = ch[[0, 1, 2, 1][(i / every) % 4 | 0]] + 12 + ((i >= 8 && level >= 2) ? 12 : 0);
          tone(mtof(n), sd * 1.4, 'square', 0.022, { t, lp: 2600, lp2: 900, bus: musBus, send: 0.35 });
        }
      }

      // bateria
      if (level >= 1 || boss) {
        if (i % 4 === 0) {
          tone(150, 0.16, 'sine', 0.3, { t, f2: 42, bus: musBus });
        }
        if (boss && i === 14) tone(150, 0.16, 'sine', 0.26, { t, f2: 42, bus: musBus });
        if (i % 4 === 2) noise(0.05, 0.05, 9000, 7000, { t, type: 'highpass', bus: musBus });
        if (level >= 3 || boss) {
          if (i % 2 === 1) noise(0.03, 0.03, 9500, 8000, { t, type: 'highpass', bus: musBus });
        }
      }
      if ((level >= 2 || boss) && (i === 4 || i === 12)) {
        noise(0.16, 0.12, 3200, 1400, { t, type: 'bandpass', bus: musBus });
        tone(220, 0.1, 'triangle', 0.1, { t, f2: 110, bus: musBus });
      }

      // melodia (emocional)
      if (level >= 2 || boss) {
        const spots = { 0: 0, 6: 1, 10: 2, 14: 3 };
        if (spots[i] !== undefined) {
          const k = (bar * 3 + spots[i]) % lead.length;
          const n = ch[lead[k]] + 24;
          tone(mtof(n), sd * (i === 14 ? 3 : 4.5), 'sawtooth', 0.035, { t, a: 0.02, lp: 3200, lp2: 1200, bus: musBus, send: 0.55 });
          tone(mtof(n), sd * 4, 'square', 0.012, { t, det: 7, lp: 2400, bus: musBus });
        }
      }
    }

    function sched() {
      if (!playing || !ctx) return;
      tempo += (targetTempo() - tempo) * 0.02;
      const sd = 60 / tempo / 4;
      if (nextT < ctx.currentTime - 0.2) nextT = ctx.currentTime + 0.05;
      while (nextT < ctx.currentTime + 0.18) {
        playStep(step, nextT);
        nextT += sd;
        step++;
      }
    }

    return {
      start() {
        if (!init()) return;
        resume();
        playing = true; step = 0; nextT = ctx.currentTime + 0.1;
        musBus.gain.cancelScheduledValues(ctx.currentTime);
        musBus.gain.setTargetAtTime(0.65, ctx.currentTime, 0.4);
        if (!timer) timer = setInterval(sched, 30);
      },
      stop(fade = 1.2) {
        if (!ctx) return;
        musBus.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        playing = false;
        if (timer) { clearInterval(timer); timer = null; }
      },
      set(lv, isBoss) { level = lv; boss = !!isBoss; },
      muffle(on) {
        if (!ctx) return;
        musLP.frequency.setTargetAtTime(on ? 650 : 16000, ctx.currentTime, 0.3);
      },
      get playing() { return playing; },
    };
  })();

  return Object.assign({ resume, suspend, setMuted, init, music: Music, get ready() { return !!ctx; } }, wrap(fx));

  // evita erros caso o áudio ainda não tenha sido iniciado por gesto do usuário
  function wrap(obj) {
    const out = {};
    for (const k in obj) out[k] = (...a) => { if (!ctx) return; try { obj[k](...a); } catch (e) { /* ignora */ } };
    out.click = (...a) => { if (!init()) return; try { obj.click(...a); } catch (e) { /* ignora */ } };
    return out;
  }
})();
