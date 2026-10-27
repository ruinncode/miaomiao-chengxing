// ============================================================
//  Lo-fi audio — all original, synthesized live with WebAudio.
//  BGM: slow swung drums + vinyl crackle, jazzy 7th/9th chords on soft
//  triangle / thin-pulse pads, round bass, a sparse wobbly lead, all
//  through a low-pass + reverb + tape delay.  Each track is a seamless
//  60–120 s loop.  Sfx.* = soft sound effects, Sfx.music(scene) picks
//  the scene's track (unless the player picked one), Sfx.ambience({...})
//  mixes rain / cafe / keyboard / pages / city / purr layers.
//  "自己的音乐": Sfx.useFile(file) loops a local audio file (never uploaded).
// ============================================================
window.Sfx = (function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null, musicIn = null, ambBus = null, pulse = null, pulse12 = null, noiseBuf = null, brownBuf = null;
  let muted = false, musicVol = 0.6, sfxVol = 0.7;
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  muted = LS('mmcx-mute') === '1';
  if (LS('mmcx-mvol') != null) musicVol = +LS('mmcx-mvol');
  if (LS('mmcx-svol') != null) sfxVol = +LS('mmcx-svol');
  let pick = LS('mmcx-track') || 'auto';

  function makePulse(duty) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * Math.pow(0.88, i); return ctx.createPeriodicWave(re, im); }
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.6; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.45 * sfxVol;
      const sfxLp = ctx.createBiquadFilter(); sfxLp.type = 'lowpass'; sfxLp.frequency.value = 3200; sfxBus.connect(sfxLp); sfxLp.connect(master);
      // music chain: in -> lowpass -> (dry, reverb, tape delay) -> musicBus -> master
      musicBus = ctx.createGain(); musicBus.gain.value = 0.5 * musicVol; musicBus.connect(master);
      musicIn = ctx.createGain();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1900; lp.Q.value = 0.5;
      const wob = ctx.createOscillator(), wobG = ctx.createGain(); wob.frequency.value = 0.07; wobG.gain.value = 260; wob.connect(wobG); wobG.connect(lp.frequency); wob.start();
      musicIn.connect(lp);
      const dry = ctx.createGain(); dry.gain.value = 0.8; lp.connect(dry); dry.connect(musicBus);
      const rev = ctx.createConvolver(); rev.buffer = impulse(2.6); const revG = ctx.createGain(); revG.gain.value = 0.32; lp.connect(rev); rev.connect(revG); revG.connect(musicBus);
      const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.42; const fb = ctx.createGain(); fb.gain.value = 0.28; const dlf = ctx.createBiquadFilter(); dlf.type = 'lowpass'; dlf.frequency.value = 1200; const dlG = ctx.createGain(); dlG.gain.value = 0.18;
      lp.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(dlG); dlG.connect(musicBus);
      ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(master);
      pulse = makePulse(0.25); pulse12 = makePulse(0.125);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      brownBuf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const b = brownBuf.getChannelData(0); let last = 0; for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last * 3.5; }
      startCrackle();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function impulse(sec) {
    const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return buf;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // ---------- voices ----------
  function tone({ type = 'triangle', f, f1, t, dur, vol, a = 0.01, r = 0.08, bus, detune = 0, vib = 0, vibHz = 5 }) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse); else if (type === 'pulse12') o.setPeriodicWave(pulse12); else o.type = type;
    o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.detune.value = detune;
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibHz; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + r + 0.05); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.linearRampToValueAtTime(0, t + dur + r);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + r + 0.05);
  }
  function nz({ t, dur, vol, type = 'highpass', freq = 1000, q = 0.7, bus, buf, a = 0.002 }) {
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = buf || noiseBuf; s.loop = true; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  const now = () => ctx.currentTime;
  const T = (fn) => () => { if (!ensure()) return; fn(now()); };

  // ---------- soft sound effects (rounded waveforms, low volume) ----------
  const blip = (m, t, d = 0.08, v = 0.18, type = 'triangle') => tone({ type, f: mtof(m), t, dur: d, vol: v, a: 0.006, r: 0.06, bus: sfxBus });
  const S = {
    meow(pitch = 1) { if (!ensure()) return; const t = now(), b = pitch > 1 ? 81 : 76; tone({ type: 'pulse12', f: mtof(b), f1: mtof(b + 6), t, dur: 0.1, vol: 0.12, bus: sfxBus, vib: 20 }); tone({ type: 'triangle', f: mtof(b + 6), f1: mtof(b - 2), t: t + 0.1, dur: 0.22, vol: 0.16, bus: sfxBus, vib: 30, vibHz: 7 }); },
    jump: T(t => tone({ f: 330, f1: 620, t, dur: 0.09, vol: 0.12, bus: sfxBus })),
    land: T(t => nz({ t, dur: 0.06, vol: 0.08, type: 'lowpass', freq: 500, bus: sfxBus })),
    stack: T(t => { blip(79, t); blip(84, t + 0.06); }),
    plate: T(t => { blip(72, t, 0.05); blip(79, t + 0.05, 0.08); }),
    door: T(t => [60, 64, 67, 71].forEach((m, i) => blip(m, t + i * 0.06, 0.18, 0.14, 'sine'))),
    fish: T(t => [84, 88, 91].forEach((m, i) => blip(m, t + i * 0.05, 0.08, 0.12, 'sine'))),
    gold: T(t => [84, 88, 91, 95, 98].forEach((m, i) => blip(m, t + i * 0.045, 0.1, 0.12, 'sine'))),
    power: T(t => [72, 76, 79, 83, 86].forEach((m, i) => blip(m, t + i * 0.05, 0.12, 0.12))),
    swipe: T(t => nz({ t, dur: 0.1, vol: 0.12, type: 'bandpass', freq: 2200, q: 1.2, bus: sfxBus })),
    hit: T(t => { tone({ type: 'sine', f: 200, f1: 70, t, dur: 0.14, vol: 0.28, bus: sfxBus }); nz({ t, dur: 0.08, vol: 0.08, type: 'lowpass', freq: 900, bus: sfxBus }); }),
    fall: T(t => tone({ f: 600, f1: 140, t, dur: 0.5, vol: 0.16, bus: sfxBus, vib: 30 })),
    ouch: T(t => { blip(69, t, 0.07, 0.14); blip(64, t + 0.08, 0.12, 0.14); }),
    crash: T(t => { nz({ t, dur: 0.22, vol: 0.12, type: 'bandpass', freq: 3000, bus: sfxBus }); [96, 91, 98].forEach((m, i) => blip(m, t + i * 0.03, 0.05, 0.05, 'sine')); }),
    tick: T(t => blip(88, t, 0.03, 0.08, 'sine')),
    go: T(t => [72, 76, 79, 84].forEach((m, i) => blip(m, t + i * 0.08, 0.14, 0.14, 'sine'))),
    click: T(t => blip(84, t, 0.025, 0.08, 'sine')),
    clear: T(t => { [72, 76, 79, 83, 86].forEach((m, i) => blip(m, t + i * 0.09, 0.3, 0.12, 'sine')); [48, 55, 59].forEach((m, i) => blip(m, t + i * 0.1, 0.8, 0.12)); }),
    round: T(t => [79, 83, 86].forEach((m, i) => blip(m, t + i * 0.1, 0.2, 0.12, 'sine'))),
    lose: T(t => [67, 64, 60, 57].forEach((m, i) => blip(m, t + i * 0.13, 0.2, 0.12))),
    ending: T(t => { [72, 76, 79, 83, 86, 83, 79, 84].forEach((m, i) => blip(m, t + i * 0.16, 0.4, 0.11, 'sine')); [48, 52, 55, 59].forEach((m, i) => blip(m, t + i * 0.3, 1.2, 0.1)); }),
    join: T(t => [72, 79, 84].forEach((m, i) => blip(m, t + i * 0.08, 0.14, 0.12, 'sine'))),
    leave: T(t => [79, 72, 67].forEach((m, i) => blip(m, t + i * 0.1, 0.14, 0.12, 'sine'))),
    lever: T(t => { nz({ t, dur: 0.05, vol: 0.08, type: 'bandpass', freq: 1500, bus: sfxBus }); blip(67, t + 0.04, 0.08); }),
    swap: T(t => { tone({ type: 'sine', f: 300, f1: 900, t, dur: 0.25, vol: 0.12, bus: sfxBus, vib: 40 }); }),
    boing: T(t => tone({ type: 'sine', f: 180, f1: 520, t, dur: 0.18, vol: 0.18, bus: sfxBus, vib: 80, vibHz: 18 })),
    launch: T(t => { tone({ type: 'sine', f: 120, f1: 700, t, dur: 0.3, vol: 0.18, bus: sfxBus }); nz({ t, dur: 0.3, vol: 0.06, type: 'lowpass', freq: 800, bus: sfxBus }); }),
    splash: T(t => nz({ t, dur: 0.35, vol: 0.12, type: 'bandpass', freq: 900, q: 0.6, bus: sfxBus })),
    chime: T(t => [84, 88, 91, 96].forEach((m, i) => tone({ type: 'sine', f: mtof(m), t: t + i * 0.18, dur: 1.2, vol: 0.08, a: 0.005, r: 1, bus: sfxBus }))),
    pop: T(t => tone({ type: 'sine', f: 500, f1: 900, t, dur: 0.05, vol: 0.12, bus: sfxBus })),
    page: T(t => nz({ t, dur: 0.25, vol: 0.06, type: 'bandpass', freq: 3500, q: 0.4, bus: sfxBus, a: 0.08 })),
    purr: T(t => { const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 55; l.frequency.value = 24; lg.gain.value = 0.08; l.connect(lg); lg.connect(g.gain); g.gain.value = 0.09; o.connect(g); g.connect(sfxBus); o.start(t); l.start(t); o.stop(t + 1.4); l.stop(t + 1.4); }),
    honk: T(t => { tone({ type: 'square', f: 392, t, dur: 0.12, vol: 0.05, bus: sfxBus }); tone({ type: 'square', f: 494, t, dur: 0.12, vol: 0.04, bus: sfxBus }); }),
    ding: T(t => tone({ type: 'sine', f: mtof(88), t, dur: 1.2, vol: 0.08, a: 0.003, r: 1, bus: sfxBus })),
    coin: T(t => { blip(88, t, 0.05, 0.1, 'square'); blip(95, t + 0.05, 0.12, 0.08, 'square'); }),
    bell: T(t => { tone({ type: 'sine', f: 1320, t, dur: 0.9, vol: 0.07, a: 0.002, r: 0.8, bus: sfxBus }); tone({ type: 'sine', f: 1980, t, dur: 0.5, vol: 0.03, a: 0.002, r: 0.4, bus: sfxBus }); }),
    chimeS: T(t => [76, 72, 67].forEach((m, i) => tone({ type: 'sine', f: mtof(m), t: t + i * 0.35, dur: 0.9, vol: 0.07, a: 0.005, r: 0.8, bus: sfxBus }))),
    win: T(t => [76, 79, 84, 88].forEach((m, i) => blip(m, t + i * 0.1, 0.3, 0.12, 'sine'))),
    play(name) { (S[name] || S.pop)(); },
  };

  // ---------- lo-fi tracks ----------
  // chord = [root midi, ...intervals]; one chord per bar unless 'half'.
  const Q = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10], M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], d9: [0, 4, 10, 14], d13: [0, 4, 10, 14, 21], m11: [0, 3, 10, 14, 17], hd: [0, 3, 6, 10], M6: [0, 4, 7, 9, 14], sus: [0, 5, 7, 10, 14] };
  const ch = (s) => s.split(' ').map(x => { const [r, q] = x.split(':'); return [+r, Q[q]]; });
  const TRACKS = {
    rain:    { name: '夜窗雨声', bpm: 72, swing: 0.62, prog: ch('53:M9 52:m7 50:m9 48:M9 53:M9 52:m7 50:m9 55:d13'), drums: 'lazy', lead: 0.5, seed: 3, amb: { rain: 0.35 } },
    window:  { name: '猫在窗台', bpm: 78, swing: 0.6, prog: ch('50:m9 55:d13 48:M9 57:m7 50:m9 55:d13 52:m7 57:d9'), drums: 'boom', lead: 0.6, seed: 7 },
    coffee:  { name: '咖啡续杯', bpm: 66, swing: 0.58, prog: ch('51:M9 50:m7 48:m9 46:d13 51:M9 55:m7 53:m9 46:sus'), drums: 'soft', lead: 0.35, seed: 11 },
    train:   { name: '末班电车', bpm: 85, swing: 0.6, prog: ch('45:m9 50:d9 43:M9 48:M7 45:m9 50:d9 41:M9 52:d7'), drums: 'groove', lead: 0.7, seed: 19 },
    library: { name: '图书馆的灯', bpm: 64, swing: 0.56, prog: ch('48:M9 45:m9 50:m11 55:d13 52:m7 45:m9 50:m9 55:sus'), drums: 'soft', lead: 0.3, seed: 23, amb: { pages: 0.25 } },
    studio:  { name: '午后画室', bpm: 70, swing: 0.6, prog: ch('55:M9 52:m9 48:M9 50:d9 55:M9 59:m7 52:m9 50:sus'), drums: 'lazy', lead: 0.45, seed: 29 },
    stroll:  { name: '城市散步', bpm: 80, swing: 0.62, prog: ch('53:M7 57:m7 58:M9 48:d13 53:M7 50:m9 55:m7 48:d9'), drums: 'boom', lead: 0.6, seed: 31, amb: { city: 0.12 } },
    arcade:  { name: '掌机小调', bpm: 84, swing: 0.6, prog: ch('48:M9 52:m7 53:M9 55:d9 48:M9 45:m9 50:m9 55:d13'), drums: 'groove', lead: 0.75, seed: 37 },
    night:   { name: '晚安，小猫', bpm: 62, swing: 0.55, prog: ch('53:M9 48:M9 50:m9 46:M9 53:M9 57:m7 46:M6 48:sus'), drums: 'none', lead: 0.4, seed: 41, amb: { purr: 0.08 } },
  };
  // which track plays in which scene (player can override with the picker)
  const SCENE = { title: 'rain', lobby: 'rain', coop: 'window', vs: 'train', action: 'train', board: 'coffee', draw: 'studio', study: 'library', travel: 'stroll', hotel: 'coffee', handheld: 'arcade', ending: 'night', cuddle: 'night' };
  // each track: whole bars so that the loop is 60–120 s
  for (const tr of Object.values(TRACKS)) {
    const barSec = 240 / tr.bpm; let bars = tr.prog.length; while (bars * barSec < 60) bars += tr.prog.length; tr.bars = bars; tr.loopSec = bars * barSec;
    // pre-compose a sparse, deterministic lead line (chord tones + passing notes)
    let s = tr.seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    tr.mel = [];
    for (let b = 0; b < bars; b++) {
      const [root, iv] = tr.prog[b % tr.prog.length]; const pool = iv.map(x => root + 24 + x).concat(iv.map(x => root + 36 + x)).filter(m => m >= 67 && m <= 86).sort((a, c) => a - c);
      const rest = (b % 8 === 7) || rnd() > tr.lead; const bar = [];
      if (!rest) { let k = Math.floor(rnd() * pool.length); for (let st = 0; st < 16; st++) { if ((st % 4 === 0 && rnd() < 0.55) || (st % 2 === 0 && rnd() < 0.15)) { k = Math.max(0, Math.min(pool.length - 1, k + Math.floor(rnd() * 3) - 1)); bar.push([st, pool[k], rnd() < 0.3 ? 6 : 3]); } } }
      tr.mel.push(bar);
    }
  }
  const DRUMS = { // 16 steps: K kick, S snare, H hat, h ghost hat
    lazy:   ['K.......K.K.....', '....S.......S...', 'H.h.H.h.H.h.H.hh'],
    boom:   ['K.....K...K.....', '....S.......S..s', 'H.H.H.H.H.H.H.H.'],
    soft:   ['K.........K.....', '....s.......s...', 'h...h...h...h...'],
    groove: ['K.....K.K.....K.', '....S.......S...', 'HhH.HhH.HhH.HhHh'],
    none:   ['................', '................', '................'],
  };
  let curTrack = null, curScene = null, timer = null, step = 0, nextT = 0, fileAudio = null;
  function scheduleStep(tr, i, t) {
    const sp = 15 / tr.bpm, bar = Math.floor(i / 16) % tr.bars, st = i % 16;
    const [root, iv] = tr.prog[bar % tr.prog.length];
    if (st === 0) {
      // pad: soft triangle + thin pulse, gently detuned, long attack
      iv.slice(0, 4).forEach((x, k) => { const f = mtof(root + 12 + x); tone({ type: 'triangle', f, t, dur: sp * 15, vol: 0.05, a: 0.35, r: 0.5, bus: musicIn, detune: k % 2 ? 6 : -6 }); tone({ type: 'pulse12', f, t, dur: sp * 15, vol: 0.012, a: 0.5, r: 0.5, bus: musicIn, detune: 9 }); });
      tone({ type: 'triangle', f: mtof(root - 12), t, dur: sp * 6, vol: 0.2, a: 0.02, r: 0.12, bus: musicIn });
    }
    if (st === 10) tone({ type: 'triangle', f: mtof(root - 12 + 7), t, dur: sp * 4, vol: 0.14, a: 0.02, r: 0.1, bus: musicIn });
    // gentle arpeggio (chord tones, every other 8th), swung
    if (st % 4 === 2 && tr.drums !== 'none') { const k = (st / 2 | 0) % iv.length; tone({ type: 'triangle', f: mtof(root + 24 + iv[k]), t: t + sp * (tr.swing - 0.5) * 2, dur: sp * 1.5, vol: 0.035, a: 0.01, r: 0.2, bus: musicIn }); }
    if (tr.drums === 'none' && st % 4 === 0) { const k = (st / 4 | 0) % iv.length; tone({ type: 'sine', f: mtof(root + 24 + iv[k]), t, dur: sp * 3, vol: 0.04, a: 0.05, r: 0.5, bus: musicIn }); }
    // lead
    for (const [s0, m, len] of tr.mel[bar]) if (s0 === st) tone({ type: 'triangle', f: mtof(m), t: t + (st % 2 ? sp * (tr.swing - 0.5) * 2 : 0), dur: sp * len, vol: 0.05, a: 0.02, r: 0.25, bus: musicIn, vib: 9, vibHz: 4.5, detune: -4 });
    // drums (swing every second 16th)
    const D = DRUMS[tr.drums], tt = t + (st % 2 ? sp * (tr.swing - 0.5) * 2 : 0);
    if (D[0][st] === 'K') tone({ type: 'sine', f: 110, f1: 42, t: tt, dur: 0.16, vol: 0.4, a: 0.002, r: 0.06, bus: musicIn });
    if (D[1][st] === 'S') nz({ t: tt, dur: 0.18, vol: 0.09, type: 'bandpass', freq: 1800, q: 0.6, bus: musicIn });
    if (D[1][st] === 's') nz({ t: tt, dur: 0.1, vol: 0.04, type: 'bandpass', freq: 2200, q: 0.6, bus: musicIn });
    if (D[2][st] === 'H') nz({ t: tt, dur: 0.035, vol: 0.03, type: 'highpass', freq: 7000, bus: musicIn });
    if (D[2][st] === 'h') nz({ t: tt, dur: 0.025, vol: 0.015, type: 'highpass', freq: 8000, bus: musicIn });
  }
  function tick() {
    const tr = TRACKS[curTrack]; if (!tr || !ctx) return;
    const sp = 15 / tr.bpm;
    while (nextT < ctx.currentTime + 0.15) { scheduleStep(tr, step, nextT); nextT += sp; step = (step + 1) % (tr.bars * 16); }
  }
  function playTrack(id) {
    if (curTrack === id && timer) return;
    curTrack = id; step = 0; clearInterval(timer); timer = null;
    if (!id || !TRACKS[id] || fileAudio) return;
    if (!ensure()) return;
    nextT = ctx.currentTime + 0.12; timer = setInterval(tick, 30);
    if (TRACKS[id].amb) Object.entries(TRACKS[id].amb).forEach(([k, v]) => { if (ambUser[k] == null) setAmb(k, v, true); });
  }
  function music(scene) {
    curScene = scene;
    const id = scene ? (pick !== 'auto' && TRACKS[pick] ? pick : (TRACKS[scene] ? scene : SCENE[scene] || 'rain')) : null;
    if (!scene) { clearInterval(timer); timer = null; curTrack = null; return; }
    playTrack(id);
  }

  // ---------- vinyl crackle (always on under the music, very quiet) ----------
  let crackleG = null;
  function startCrackle() {
    const n = ctx.sampleRate * 3, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() < 0.0009 ? (Math.random() * 2 - 1) * 0.9 : 0) + (Math.random() * 2 - 1) * 0.012;
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.3;
    crackleG = ctx.createGain(); crackleG.gain.value = 0.5; s.connect(f); f.connect(crackleG); crackleG.connect(musicBus); s.start();
  }

  // ---------- ambience layers ----------
  const amb = {}, ambUser = {};
  const AMB_DEF = {
    rain: () => { const s = src(noiseBuf), f1 = filt('lowpass', 2600), f2 = filt('highpass', 400); s.connect(f2); f2.connect(f1); return [s, f1, 0.22]; },
    cafe: () => { const s = src(brownBuf), f = filt('bandpass', 380, 0.5); s.connect(f); return [s, f, 0.6]; },
    city: () => { const s = src(brownBuf), f = filt('lowpass', 220); s.connect(f); return [s, f, 0.8]; },
    keys: null, pages: null, purr: null, // event-based, see ambTick
  };
  const src = (b) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(0, Math.random() * 1.5); return s; };
  const filt = (type, fr, q = 0.7) => { const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = fr; f.Q.value = q; return f; };
  function setAmb(name, vol, auto) {
    if (!auto) ambUser[name] = vol;
    if (!ensure()) return;
    let a = amb[name];
    if (!a) {
      a = amb[name] = { vol: 0, g: ctx.createGain() }; a.g.gain.value = 0; a.g.connect(ambBus);
      if (AMB_DEF[name]) { const [s, out, k] = AMB_DEF[name](); a.k = k; out.connect(a.g); a.src = s; }
    }
    a.vol = vol; a.g.gain.setTargetAtTime(AMB_DEF[name] ? vol * a.k : 1, ctx.currentTime, 0.4);
  }
  setInterval(() => { // sparse event ambience
    if (!ctx || muted) return; const t = ctx.currentTime;
    const v = (k) => (amb[k] ? amb[k].vol : 0);
    if (v('keys') > 0 && Math.random() < 0.5) for (let i = 0; i < 1 + Math.floor(Math.random() * 4); i++) nz({ t: t + i * (0.07 + Math.random() * 0.08), dur: 0.025, vol: 0.05 * v('keys'), type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 2, bus: ambBus });
    if (v('pages') > 0 && Math.random() < 0.05) nz({ t, dur: 0.35, vol: 0.08 * v('pages'), type: 'bandpass', freq: 3200, q: 0.5, bus: ambBus, a: 0.12 });
    if (v('cafe') > 0 && Math.random() < 0.04) tone({ type: 'sine', f: 2400 + Math.random() * 900, t, dur: 0.05, vol: 0.03 * v('cafe'), a: 0.001, r: 0.3, bus: ambBus });
    if (v('rain') > 0 && Math.random() < 0.25) tone({ type: 'sine', f: 1200 + Math.random() * 1600, f1: 500, t, dur: 0.03, vol: 0.025 * v('rain'), a: 0.001, r: 0.04, bus: ambBus });
    if (v('purr') > 0 && Math.random() < 0.03) { const o = ctx.createOscillator(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'triangle'; o.frequency.value = 52; l.frequency.value = 23; lg.gain.value = 0.25 * v('purr'); l.connect(lg); lg.connect(g.gain); g.gain.value = 0.3 * v('purr'); o.connect(g); g.connect(ambBus); o.start(t); l.start(t); o.stop(t + 2.5); l.stop(t + 2.5); }
    if (v('city') > 0 && Math.random() < 0.01) tone({ type: 'triangle', f: 330, t, dur: 0.4, vol: 0.02 * v('city'), a: 0.05, r: 0.3, bus: ambBus });
  }, 250);

  function setMuted(m) { muted = m; LS('mmcx-mute', m ? '1' : '0'); if (master) master.gain.value = m ? 0 : 0.6; if (fileAudio) fileAudio.muted = m; }

  return Object.assign(S, {
    unlock() { ensure(); if (curScene && !timer && !fileAudio) { const sc = curScene; curTrack = null; music(sc); } },
    toggleMute() { setMuted(!muted); return muted; },
    get muted() { return muted; },
    music, TRACKS, SCENE,
    get track() { return curTrack; }, get pick() { return pick; },
    pickTrack(id) { pick = id || 'auto'; LS('mmcx-track', pick); if (fileAudio && pick !== 'file') { fileAudio.pause(); fileAudio = null; } const sc = curScene; curTrack = null; music(sc); },
    setMusicVol(v) { musicVol = v; LS('mmcx-mvol', String(v)); if (musicBus) musicBus.gain.value = 0.5 * v; if (fileAudio) fileAudio.volume = v; },
    setSfxVol(v) { sfxVol = v; LS('mmcx-svol', String(v)); if (sfxBus) sfxBus.gain.value = 0.45 * v; },
    get musicVol() { return musicVol; }, get sfxVol() { return sfxVol; },
    ambience(map) { Object.entries(map).forEach(([k, v]) => setAmb(k, v)); },
    get amb() { const o = {}; for (const k of ['rain', 'cafe', 'keys', 'pages', 'city', 'purr']) o[k] = amb[k] ? amb[k].vol : 0; return o; },
    // 自己的音乐: loop a local file chosen by the player (stays on this device)
    useFile(file) {
      if (!file) return; clearInterval(timer); timer = null; curTrack = null;
      if (fileAudio) fileAudio.pause();
      fileAudio = new Audio(URL.createObjectURL(file)); fileAudio.loop = true; fileAudio.volume = musicVol; fileAudio.muted = muted; fileAudio.play().catch(() => {});
      pick = 'file';
    },
  });
})();
