// ============================================================
//  Chiptune audio — square / triangle / noise, all WebAudio.
//  Sfx.* = sound effects, Sfx.music(name) = looping 8-bit bgm.
// ============================================================
window.Sfx = (function () {
  let ctx = null, master = null, sfxBus = null, musicBus = null, pulse = null, noiseBuf = null;
  let muted = false;
  try { muted = localStorage.getItem('mmcx-mute') === '1'; } catch (e) {}

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
      sfxBus = ctx.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
      musicBus = ctx.createGain(); musicBus.gain.value = 0.22; musicBus.connect(master);
      // 25% pulse wave (NES-ish)
      const n = 32, re = new Float32Array(n), im = new Float32Array(n);
      for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * 0.25);
      pulse = ctx.createPeriodicWave(re, im);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

  // one chip note: type 'sq' | 'pulse' | 'tri'; f0 -> f1 slide
  function note(type, f0, f1, dur, vol, when = 0, bus) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(), g = c.createGain();
    if (type === 'pulse') o.setPeriodicWave(pulse); else o.type = type === 'tri' ? 'triangle' : 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(bus || sfxBus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol, when = 0, bus, hp = 1000) {
    const c = ensure(); if (!c) return;
    const t = c.currentTime + when;
    const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus); s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (type, notes, step, vol, when = 0) => notes.forEach((m, i) => note(type, mtof(m), 0, step * 0.95, vol, when + i * step));

  // ---------- sound effects ----------
  const S = {
    meow(pitch = 1, when = 0) { // chip "mi-aow": rising then falling pulse with vibrato steps
      const b = 76 + (pitch > 1 ? 5 : 0);
      [[b, b + 7, 0.09], [b + 7, b + 4, 0.08], [b + 4, b - 2, 0.16]].reduce((t, [a, z, d]) => { note('pulse', mtof(a), mtof(z), d, 0.32, when + t); return t + d; }, 0);
    },
    jump() { note('sq', 330, 760, 0.1, 0.18); },
    land() { noise(0.05, 0.12, 0, null, 400); },
    stack() { arp('sq', [79, 84], 0.05, 0.2); },
    plate() { note('sq', 523, 523, 0.05, 0.22); note('sq', 784, 784, 0.07, 0.22, 0.05); },
    door() { arp('tri', [60, 64, 67, 72], 0.05, 0.4); },
    fish() { arp('sq', [84, 88, 91], 0.045, 0.2); },
    gold() { arp('sq', [84, 88, 91, 96, 100], 0.04, 0.22); },
    power() { arp('pulse', [72, 76, 79, 84, 79, 84, 88], 0.04, 0.25); },
    swipe() { noise(0.08, 0.2, 0, null, 2500); note('sq', 900, 300, 0.07, 0.1); },
    hit() { note('sq', 220, 80, 0.15, 0.3); noise(0.1, 0.25, 0, null, 600); },
    fall() { note('tri', 660, 110, 0.5, 0.45); },
    ouch() { note('sq', 440, 220, 0.08, 0.25); note('sq', 330, 160, 0.12, 0.25, 0.08); },
    crash() { noise(0.25, 0.3, 0, null, 3000); arp('sq', [96, 91, 98], 0.03, 0.08); },
    tick() { note('sq', 1046, 1046, 0.04, 0.15); },
    go() { arp('sq', [72, 76, 79, 84], 0.07, 0.25); },
    click() { note('sq', 880, 880, 0.03, 0.15); },
    clear() { arp('pulse', [72, 76, 79, 84, 79, 84, 88], 0.08, 0.28); arp('tri', [48, 55, 60], 0.18, 0.4); },
    round() { arp('pulse', [79, 84, 88, 91], 0.09, 0.28); },
    lose() { arp('tri', [67, 64, 60, 55], 0.12, 0.4); },
    ending() { arp('pulse', [72, 76, 79, 84, 88, 84, 88, 91, 96], 0.11, 0.26); arp('tri', [48, 52, 55, 60, 53, 57, 60, 65], 0.2, 0.45); },
    join() { arp('sq', [72, 79, 84], 0.07, 0.22); },
    leave() { arp('sq', [79, 72, 67], 0.09, 0.2); },
  };

  // ---------- 8-bit background music ----------
  // each song: tempo (bpm), 8th-note steps; lead / bass as MIDI (0 = rest, -1 = hold)
  const C = 0;
  const SONGS = {
    coop: { bpm: 112,
      lead: [76, 0, 79, 0, 81, 79, 76, 0, 74, 0, 76, 74, 72, -1, 0, 0, 72, 0, 74, 0, 76, 0, 79, 0, 77, -1, 76, 0, 74, -1, -1, 0,
             76, 0, 79, 0, 84, 83, 81, 0, 79, 0, 81, 79, 76, -1, 0, 0, 74, 0, 76, 0, 77, 0, 74, 0, 72, -1, -1, -1, 0, 0, 0, 0],
      bass: [48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0, 41, 0, 48, 0, 41, 0, 48, 0, 43, 0, 50, 0, 43, 0, 47, 0,
             48, 0, 55, 0, 48, 0, 55, 0, 45, 0, 52, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0, 48, 0, 43, 0, 48, 0, 0, 0],
      hat: 0b10101010 },
    vs: { bpm: 150,
      lead: [72, 72, 0, 79, 0, 77, 76, 0, 74, 0, 76, 0, 72, 0, 67, 0, 69, 69, 0, 76, 0, 74, 72, 0, 71, 0, 72, 0, 74, -1, 0, 0,
             72, 72, 0, 79, 0, 77, 76, 0, 81, 0, 79, 0, 77, 0, 76, 0, 74, 0, 72, 0, 71, 0, 74, 0, 72, -1, -1, 0, 84, 0, 0, 0],
      bass: [48, 0, 48, 60, 48, 0, 48, 60, 45, 0, 45, 57, 45, 0, 45, 57, 41, 0, 41, 53, 41, 0, 41, 53, 43, 0, 43, 55, 43, 0, 43, 55,
             48, 0, 48, 60, 48, 0, 48, 60, 45, 0, 45, 57, 45, 0, 45, 57, 41, 0, 41, 53, 43, 0, 43, 55, 48, 0, 43, 0, 48, 0, 0, 0],
      hat: 0b11111111 },
    title: { bpm: 96,
      lead: [79, 0, 76, 0, 72, 0, 76, 79, 84, -1, 0, 0, 83, 0, 81, 0, 79, -1, 76, 0, 77, 0, 74, 0, 76, -1, -1, 0, 0, 0, 0, 0],
      bass: [48, 0, 0, 0, 55, 0, 0, 0, 53, 0, 0, 0, 57, 0, 0, 0, 55, 0, 0, 0, 50, 0, 0, 0, 48, 0, 0, 0, 43, 0, 0, 0],
      hat: 0 },
  };
  let cur = null, step = 0, nextT = 0, timer = null;
  function music(name) {
    if (cur === name) return;
    cur = name; step = 0;
    clearInterval(timer); timer = null;
    if (!name || !SONGS[name]) return;
    const c = ensure(); if (!c) return;
    nextT = c.currentTime + 0.1;
    timer = setInterval(tickMusic, 25);
  }
  function tickMusic() {
    const s = SONGS[cur]; if (!s || !ctx) return;
    const st = 60 / s.bpm / 2;
    while (nextT < ctx.currentTime + 0.12) {
      const n = s.lead.length, i = step % n;
      const when = nextT - ctx.currentTime;
      const len = (arr, k) => { let l = 1; while (arr[(k + l) % arr.length] === -1 && l < 8) l++; return l; };
      if (s.lead[i] > 0) note('pulse', mtof(s.lead[i]), 0, st * len(s.lead, i) * 0.9, 0.22, when, musicBus);
      const b = s.bass[i % s.bass.length];
      if (b > 0) note('tri', mtof(b), 0, st * 0.9, 0.55, when, musicBus);
      if (s.hat && (s.hat >> (i % 8)) & 1) noise(0.03, 0.08, when, musicBus, 6000);
      nextT += st; step++;
    }
  }
  function setMuted(m) {
    muted = m;
    try { localStorage.setItem('mmcx-mute', m ? '1' : '0'); } catch (e) {}
    if (master) master.gain.value = m ? 0 : 0.5;
  }

  return Object.assign(S, {
    unlock() { ensure(); if (cur && !timer) { const n = cur; cur = null; music(n); } },
    toggleMute() { setMuted(!muted); return muted; },
    get muted() { return muted; },
    music,
  });
})();
