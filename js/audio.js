// ============================================================
//  Lo-fi audio engine — all original, synthesized live with WebAudio.
//  No audio files.  Two globals:
//    window.Sfx      — the original API (Sfx.music(scene), Sfx.click(), Sfx.ambience({...}), …)
//    window.CatAudio — the documented settings / scene API (see HANDOFF.md)
//  Compositions, extra SFX and ambience recipes live in js/audio-tracks.js
//  (auto-loaded by this file if index.html does not include it).
//
//  Mix:  voices → per-track gain (crossfades) → musicIn → wobbly low-pass →
//        dry + reverb + tape delay → musicBus ┐
//        ambience beds (noise, off in clean mode) → bedBus → ambBus ┤→ master →
//        sfx → low-pass → sfxBus ┘   glue compressor → limiter → soft clip → out
//  Scheduling: one look-ahead pump (50 ms timer, 0.3 s ahead; 1.5 s ahead when the
//  tab is hidden) places every note on the audio clock, so loops are gapless and
//  the same code renders offline (Sfx._offline) for verification.
// ============================================================
window.Sfx = (function () {
  const LS = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } };
  const num = (k, d) => { const v = LS(k); return v != null && isFinite(+v) ? Math.max(0, Math.min(1, +v)) : d; };
  const set = {
    muted: LS('mmcx-mute') === '1',
    vol: { music: num('mmcx-mvol', 0.6), ambience: num('mmcx-avol', 0.6), sfx: num('mmcx-svol', 0.7) },
    clean: LS('mmcx-clean') !== '0',       // clean mode (default ON): no noise beds, no crackle
    crackle: LS('mmcx-crackle') === '1',   // optional very quiet vinyl crackle (default OFF)
    pick: LS('mmcx-track') || 'auto',
  };
  const MASTER = 0.5, BUS = { music: 0.5, ambience: 1, sfx: 0.45 }, CRACKLE = 0.025;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const lib = { TRACKS: {}, SFX: {}, AMB: {}, SCENE: {}, SCENE_AMB: {}, TOD: {} };

  // ---------- param helpers (always ramp, never jump) ----------
  function hold(prm, t) { if (prm.cancelAndHoldAtTime) prm.cancelAndHoldAtTime(t); else { prm.cancelScheduledValues(t); prm.setValueAtTime(prm.value, t); } }
  function ramp(prm, v, t, tc = 0.05) { hold(prm, t); prm.setTargetAtTime(v, t, tc); }
  function lin(prm, v, t, dur) { hold(prm, t); prm.linearRampToValueAtTime(v, t + Math.max(0.01, dur)); }

  // ---------- graph (works on AudioContext and OfflineAudioContext) ----------
  function makePulse(ctx, duty) { const n = 48, re = new Float32Array(n), im = new Float32Array(n); for (let i = 1; i < n; i++) im[i] = (2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty) * Math.pow(0.88, i); return ctx.createPeriodicWave(re, im); }
  function seamless(ctx, buf, n) { // crossfade the tail into the head so a looped buffer has no seam click
    const d = buf.getChannelData(0), L = d.length, out = ctx.createBuffer(1, L - n, ctx.sampleRate), o = out.getChannelData(0);
    for (let i = 0; i < L - n; i++) o[i] = d[i];
    for (let i = 0; i < n; i++) { const k = i / n; o[i] = d[i] * Math.sqrt(k) + d[L - n + i] * Math.sqrt(1 - k); }
    return out;
  }
  function impulse(ctx, sec) {
    const n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { lp += 0.35 * ((Math.random() * 2 - 1) - lp); d[i] = lp * Math.pow(1 - i / n, 3.2) * Math.min(1, i / 64); } }
    return buf;
  }
  function softClipCurve() { const n = 2048, c = new Float32Array(n); for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1, a = Math.abs(x); c[i] = a < 0.7 ? x : Math.sign(x) * (0.7 + 0.28 * Math.tanh((a - 0.7) / 0.28)); } return c; }

  function buildGraph(ctx, st) {
    const G = { ctx, st, players: [], dead: [], amb: {}, walk: null, scene: null };
    const gain = (v, to) => { const g = ctx.createGain(); g.gain.value = v; if (to) g.connect(to); return g; };
    const filt = (type, f, q = 0.7, to) => { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; if (to) b.connect(to); return b; };
    G.gain = gain; G.filt = filt;
    // master: gain → glue comp → brick-wall-ish limiter → soft clip (nothing can exceed ±0.98)
    const clip = ctx.createWaveShaper(); clip.curve = softClipCurve(); clip.oversample = '2x'; clip.connect(ctx.destination);
    const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -4; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.12; lim.connect(clip);
    const glue = ctx.createDynamicsCompressor(); glue.threshold.value = -18; glue.knee.value = 8; glue.ratio.value = 2.5; glue.attack.value = 0.01; glue.release.value = 0.25; glue.connect(lim);
    G.master = gain(st.muted ? 0 : MASTER, glue);
    G.sfxBus = gain(BUS.sfx * st.vol.sfx); G.sfxBus.connect(filt('lowpass', 3600, 0.5, G.master));
    G.musicBus = gain(BUS.music * st.vol.music, G.master);
    G.musicIn = gain(1);
    const hp = filt('highpass', 38, 0.7); G.musicIn.connect(hp); // keep sub-rumble / DC out of the music bus
    const lp = filt('lowpass', 1900, 0.5); hp.connect(lp);
    const wob = ctx.createOscillator(), wobG = gain(220); wob.frequency.value = 0.07; wob.connect(wobG); wobG.connect(lp.frequency); wob.start();
    lp.connect(gain(0.8, G.musicBus));
    const rev = ctx.createConvolver(); rev.buffer = impulse(ctx, 2.6); lp.connect(rev); rev.connect(gain(0.3, G.musicBus));
    const dl = ctx.createDelay(1.5); dl.delayTime.value = 0.42; const fb = gain(0.26), dlf = filt('lowpass', 1200); lp.connect(dl); dl.connect(dlf); dlf.connect(fb); fb.connect(dl); dlf.connect(gain(0.16, G.musicBus));
    G.ambBus = gain(BUS.ambience * st.vol.ambience, G.master);
    G.bedBus = gain(st.clean ? 0 : 1, G.ambBus); // continuous noise beds only
    G.pulse = makePulse(ctx, 0.25); G.pulse12 = makePulse(ctx, 0.125);
    const sr = ctx.sampleRate;
    let nb = ctx.createBuffer(1, sr * 2, sr); { const d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    let bb = ctx.createBuffer(1, sr * 4, sr); { const b = bb.getChannelData(0); let last = 0, pk = 0, m = 0; for (let i = 0; i < b.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = last; m += last; } m /= b.length; for (let i = 0; i < b.length; i++) { b[i] -= m; pk = Math.max(pk, Math.abs(b[i])); } for (let i = 0; i < b.length; i++) b[i] *= 0.7 / (pk || 1); }
    G.noiseBuf = seamless(ctx, nb, Math.floor(sr * 0.05)); G.brownBuf = seamless(ctx, bb, Math.floor(sr * 0.25));
    // vinyl crackle: sparse low-passed pops only (no hiss floor); off by default and in clean mode
    { const n = sr * 3, buf = ctx.createBuffer(1, n, sr), d = buf.getChannelData(0);
      for (let i = 0; i < n - 40; i++) if (Math.random() < 0.0002) { const a = (Math.random() * 0.5 + 0.2) * (Math.random() < .5 ? -1 : 1); for (let k = 0; k < 40; k++) d[i + k] += a * Math.sin(Math.PI * k / 40) * Math.exp(-k / 10); }
      const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const f = filt('lowpass', 1400, 0.5); G.crackleG = gain(crackleOn(st) ? CRACKLE : 0, G.musicBus); s.connect(f); f.connect(G.crackleG); s.start(); }
    G.k = kit(G);
    return G;
  }
  const crackleOn = (st) => st.crackle && !st.clean;

  // ---------- voices (every voice has an attack/release envelope: no clicks) ----------
  function kit(G) {
    const ctx = G.ctx;
    function tone({ type = 'triangle', f, f1, t, dur, vol, a = 0.01, r = 0.08, bus, detune = 0, vib = 0, vibHz = 5, pan = 0 }) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      if (type === 'pulse') o.setPeriodicWave(G.pulse); else if (type === 'pulse12') o.setPeriodicWave(G.pulse12); else o.type = type;
      o.frequency.setValueAtTime(f, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o.detune.value = detune;
      if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vibHz; lg.gain.value = vib; l.connect(lg); lg.connect(o.detune); l.start(t); l.stop(t + dur + r + 0.05); }
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setValueAtTime(vol, t + Math.max(a, dur - r)); g.gain.linearRampToValueAtTime(0, t + dur + r);
      o.connect(g); out(g, bus, pan); o.start(t); o.stop(t + dur + r + 0.05);
    }
    // decaying voice (e-piano tine, bell, music box): fast attack, exponential decay, gentle release
    function pluck({ type = 'sine', f, t, dur, vol, a = 0.006, decay = 0.4, sus = 0.3, r = 0.2, bus, detune = 0, pan = 0 }) {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = f; o.detune.value = detune;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.setTargetAtTime(vol * sus, t + a, decay);
      g.gain.setTargetAtTime(0, t + dur, r); o.connect(g); out(g, bus, pan); o.start(t); o.stop(t + dur + r * 7);
    }
    function nz({ t, dur, vol, type = 'highpass', freq = 1000, f1, q = 0.7, bus, buf, a = 0.002, pan = 0 }) {
      const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      s.buffer = buf || G.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(Math.max(1e-4, vol * 0.004), t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
      s.connect(f); f.connect(g); out(g, bus, pan); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    }
    // purr: low triangle with tremolo, wrapped in a smooth envelope
    function purr(t, f, am, dur, vol, bus) {
      const o = ctx.createOscillator(), g = ctx.createGain(), env = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(), lp = ctx.createBiquadFilter();
      o.type = 'triangle'; o.frequency.value = f; l.frequency.value = am; lg.gain.value = vol * 0.8; g.gain.value = vol; l.connect(lg); lg.connect(g.gain); lp.type = 'lowpass'; lp.frequency.value = 400;
      env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(1, t + 0.25); env.gain.setValueAtTime(1, t + dur - 0.4); env.gain.linearRampToValueAtTime(0, t + dur);
      o.connect(lp); lp.connect(g); g.connect(env); env.connect(bus); o.start(t); l.start(t); o.stop(t + dur + 0.05); l.stop(t + dur + 0.05);
    }
    function out(g, bus, pan) { if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(bus); } else g.connect(bus); }
    const blip = (m, t, d = 0.08, v = 0.18, type = 'triangle') => tone({ type, f: mtof(m), t, dur: d, vol: v, a: 0.006, r: 0.06, bus: G.sfxBus });
    return { ctx, G, tone, pluck, nz, purr, blip, mtof, get sfx() { return G.sfxBus; }, get music() { return G.musicIn; }, get amb() { return G.ambBus; }, get bed() { return G.bedBus; } };
  }

  // ---------- legacy sound effects (kept, called by game.js) ----------
  const SFX0 = {
    meow: (k, t, pitch = 1) => { const b = pitch > 1 ? 81 : 76; k.tone({ type: 'pulse12', f: mtof(b), f1: mtof(b + 6), t, dur: 0.1, vol: 0.12, bus: k.sfx, vib: 20 }); k.tone({ type: 'triangle', f: mtof(b + 6), f1: mtof(b - 2), t: t + 0.1, dur: 0.22, vol: 0.16, bus: k.sfx, vib: 30, vibHz: 7 }); },
    jump: (k, t) => k.tone({ f: 330, f1: 620, t, dur: 0.09, vol: 0.12, bus: k.sfx }),
    land: (k, t) => k.nz({ t, dur: 0.06, vol: 0.08, type: 'lowpass', freq: 500, bus: k.sfx }),
    stack: (k, t) => { k.blip(79, t); k.blip(84, t + 0.06); },
    plate: (k, t) => { k.blip(72, t, 0.05); k.blip(79, t + 0.05, 0.08); },
    door: (k, t) => [60, 64, 67, 71].forEach((m, i) => k.blip(m, t + i * 0.06, 0.18, 0.14, 'sine')),
    fish: (k, t) => [84, 88, 91].forEach((m, i) => k.blip(m, t + i * 0.05, 0.08, 0.12, 'sine')),
    gold: (k, t) => [84, 88, 91, 95, 98].forEach((m, i) => k.blip(m, t + i * 0.045, 0.1, 0.12, 'sine')),
    power: (k, t) => [72, 76, 79, 83, 86].forEach((m, i) => k.blip(m, t + i * 0.05, 0.12, 0.12)),
    swipe: (k, t) => k.nz({ t, dur: 0.1, vol: 0.12, type: 'bandpass', freq: 2200, q: 1.2, bus: k.sfx }),
    hit: (k, t) => { k.tone({ type: 'sine', f: 200, f1: 70, t, dur: 0.14, vol: 0.28, bus: k.sfx }); k.nz({ t, dur: 0.08, vol: 0.08, type: 'lowpass', freq: 900, bus: k.sfx }); },
    fall: (k, t) => k.tone({ f: 600, f1: 140, t, dur: 0.5, vol: 0.16, bus: k.sfx, vib: 30 }),
    ouch: (k, t) => { k.blip(69, t, 0.07, 0.14); k.blip(64, t + 0.08, 0.12, 0.14); },
    crash: (k, t) => { k.nz({ t, dur: 0.22, vol: 0.12, type: 'bandpass', freq: 3000, bus: k.sfx }); [96, 91, 98].forEach((m, i) => k.blip(m, t + i * 0.03, 0.05, 0.05, 'sine')); },
    tick: (k, t) => k.blip(88, t, 0.03, 0.08, 'sine'),
    go: (k, t) => [72, 76, 79, 84].forEach((m, i) => k.blip(m, t + i * 0.08, 0.14, 0.14, 'sine')),
    click: (k, t) => k.blip(84, t, 0.025, 0.08, 'sine'),
    clear: (k, t) => { [72, 76, 79, 83, 86].forEach((m, i) => k.blip(m, t + i * 0.09, 0.3, 0.12, 'sine')); [48, 55, 59].forEach((m, i) => k.blip(m, t + i * 0.1, 0.8, 0.12)); },
    round: (k, t) => [79, 83, 86].forEach((m, i) => k.blip(m, t + i * 0.1, 0.2, 0.12, 'sine')),
    lose: (k, t) => [67, 64, 60, 57].forEach((m, i) => k.blip(m, t + i * 0.13, 0.2, 0.12)),
    ending: (k, t) => { [72, 76, 79, 83, 86, 83, 79, 84].forEach((m, i) => k.blip(m, t + i * 0.16, 0.4, 0.11, 'sine')); [48, 52, 55, 59].forEach((m, i) => k.blip(m, t + i * 0.3, 1.2, 0.1)); },
    join: (k, t) => [72, 79, 84].forEach((m, i) => k.blip(m, t + i * 0.08, 0.14, 0.12, 'sine')),
    leave: (k, t) => [79, 72, 67].forEach((m, i) => k.blip(m, t + i * 0.1, 0.14, 0.12, 'sine')),
    lever: (k, t) => { k.nz({ t, dur: 0.05, vol: 0.08, type: 'bandpass', freq: 1500, bus: k.sfx }); k.blip(67, t + 0.04, 0.08); },
    swap: (k, t) => k.tone({ type: 'sine', f: 300, f1: 900, t, dur: 0.25, vol: 0.12, bus: k.sfx, vib: 40 }),
    boing: (k, t) => k.tone({ type: 'sine', f: 180, f1: 520, t, dur: 0.18, vol: 0.18, bus: k.sfx, vib: 80, vibHz: 18 }),
    launch: (k, t) => { k.tone({ type: 'sine', f: 120, f1: 700, t, dur: 0.3, vol: 0.18, bus: k.sfx }); k.nz({ t, dur: 0.3, vol: 0.06, type: 'lowpass', freq: 800, bus: k.sfx }); },
    splash: (k, t) => k.nz({ t, dur: 0.35, vol: 0.12, type: 'bandpass', freq: 900, q: 0.6, bus: k.sfx }),
    chime: (k, t) => [84, 88, 91, 96].forEach((m, i) => k.tone({ type: 'sine', f: mtof(m), t: t + i * 0.18, dur: 1.2, vol: 0.08, a: 0.005, r: 1, bus: k.sfx })),
    pop: (k, t) => k.tone({ type: 'sine', f: 500, f1: 900, t, dur: 0.05, vol: 0.12, bus: k.sfx }),
    page: (k, t) => k.nz({ t, dur: 0.25, vol: 0.06, type: 'bandpass', freq: 3500, q: 0.4, bus: k.sfx, a: 0.08 }),
    purr: (k, t) => k.purr(t, 55, 24, 1.4, 0.09, k.sfx),
    honk: (k, t) => { k.tone({ type: 'triangle', f: 392, t, dur: 0.12, vol: 0.06, bus: k.sfx }); k.tone({ type: 'triangle', f: 494, t, dur: 0.12, vol: 0.05, bus: k.sfx }); },
    ding: (k, t) => k.tone({ type: 'sine', f: mtof(88), t, dur: 1.2, vol: 0.08, a: 0.003, r: 1, bus: k.sfx }),
    coin: (k, t) => { k.blip(88, t, 0.05, 0.1, 'triangle'); k.blip(95, t + 0.05, 0.12, 0.08, 'triangle'); },
    bell: (k, t) => { k.tone({ type: 'sine', f: 1320, t, dur: 0.9, vol: 0.07, a: 0.002, r: 0.8, bus: k.sfx }); k.tone({ type: 'sine', f: 1980, t, dur: 0.5, vol: 0.03, a: 0.002, r: 0.4, bus: k.sfx }); },
    chimeS: (k, t) => [76, 72, 67].forEach((m, i) => k.tone({ type: 'sine', f: mtof(m), t: t + i * 0.35, dur: 0.9, vol: 0.07, a: 0.005, r: 0.8, bus: k.sfx })),
    win: (k, t) => [76, 79, 84, 88].forEach((m, i) => k.blip(m, t + i * 0.1, 0.3, 0.12, 'sine')),
  };
  Object.assign(lib.SFX, SFX0);

  // ---------- legacy ambience layers ----------
  // bed(k) → [sourceNode, outNode, gainScale]  (continuous noise → bedBus, muted in clean mode)
  // ev(k, t, v, layer) + rate (events/s) or gap [min,max] s; noise:true ⇒ events muted in clean mode
  Object.assign(lib.AMB, {
    rain: { bed: (k) => { const s = loopSrc(k, k.G.noiseBuf), f2 = k.G.filt('highpass', 250), f0 = k.G.filt('lowpass', 1800), f1 = k.G.filt('lowpass', 1300); s.connect(f2); f2.connect(f0); f0.connect(f1); return [s, f1, 0.07]; },
      rate: 1, ev: (k, t, v) => k.tone({ type: 'sine', f: 900 + Math.random() * 900, f1: 420, t, dur: 0.03, vol: 0.012 * v, a: 0.004, r: 0.05, bus: k.amb }) },
    cafe: { bed: (k) => { const s = loopSrc(k, k.G.brownBuf), f = k.G.filt('bandpass', 380, 0.5); s.connect(f); return [s, f, 0.35]; },
      rate: 0.16, ev: (k, t, v) => k.tone({ type: 'sine', f: 2400 + Math.random() * 900, t, dur: 0.05, vol: 0.03 * v, a: 0.002, r: 0.3, bus: k.amb }) },
    city: { bed: (k) => { const s = loopSrc(k, k.G.brownBuf), f = k.G.filt('lowpass', 220); s.connect(f); return [s, f, 0.5]; },
      rate: 0.04, ev: (k, t, v) => k.tone({ type: 'triangle', f: 330, t, dur: 0.4, vol: 0.02 * v, a: 0.05, r: 0.3, bus: k.amb }) },
    keys: { rate: 2, ev: (k, t, v) => { for (let i = 0, n = 1 + Math.floor(Math.random() * 4); i < n; i++) k.nz({ t: t + i * (0.07 + Math.random() * 0.08), dur: 0.025, vol: 0.05 * v, type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 2, bus: k.amb }); } },
    pages: { rate: 0.2, ev: (k, t, v) => k.nz({ t, dur: 0.35, vol: 0.08 * v, type: 'bandpass', freq: 3200, q: 0.5, bus: k.amb, a: 0.12 }) },
    purr: { rate: 0.12, ev: (k, t, v) => k.purr(t, 52, 23, 2.5, 0.3 * v, k.amb) },
  });
  function loopSrc(k, buf) { const s = k.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(k.ctx.currentTime, Math.random() * 1.5); return s; }

  // ---------- legacy lo-fi tracks (compositions in audio-tracks.js add more) ----------
  const Q = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10], M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], d9: [0, 4, 10, 14], d13: [0, 4, 10, 14, 21], m11: [0, 3, 10, 14, 17], hd: [0, 3, 6, 10], M6: [0, 4, 7, 9, 14], sus: [0, 5, 7, 10, 14], M69: [0, 4, 9, 14], m6: [0, 3, 7, 9, 14], d7b9: [0, 4, 10, 13] };
  const ch = (s) => s.trim().split(/\s+/).map(x => { const [r, q] = x.split(':'); return [+r, Q[q]]; });
  Object.assign(lib.TRACKS, {
    rain:    { name: '夜窗雨声', bpm: 72, swing: 0.62, prog: ch('53:M9 52:m7 50:m9 48:M9 53:M9 52:m7 50:m9 55:d13'), drums: 'lazy', lead: 0.5, seed: 3, amb: { rain: 0.35 } },
    window:  { name: '猫在窗台', bpm: 78, swing: 0.6, prog: ch('50:m9 55:d13 48:M9 57:m7 50:m9 55:d13 52:m7 57:d9'), drums: 'boom', lead: 0.6, seed: 7 },
    coffee:  { name: '咖啡续杯', bpm: 66, swing: 0.58, prog: ch('51:M9 50:m7 48:m9 46:d13 51:M9 55:m7 53:m9 46:sus'), drums: 'soft', lead: 0.35, seed: 11 },
    train:   { name: '末班电车', bpm: 85, swing: 0.6, prog: ch('45:m9 50:d9 43:M9 48:M7 45:m9 50:d9 41:M9 52:d7'), drums: 'groove', lead: 0.7, seed: 19 },
    library: { name: '图书馆的灯', bpm: 64, swing: 0.56, prog: ch('48:M9 45:m9 50:m11 55:d13 52:m7 45:m9 50:m9 55:sus'), drums: 'soft', lead: 0.3, seed: 23, amb: { pages: 0.25 } },
    studio:  { name: '午后画室', bpm: 70, swing: 0.6, prog: ch('55:M9 52:m9 48:M9 50:d9 55:M9 59:m7 52:m9 50:sus'), drums: 'lazy', lead: 0.45, seed: 29 },
    stroll:  { name: '城市散步', bpm: 80, swing: 0.62, prog: ch('53:M7 57:m7 58:M9 48:d13 53:M7 50:m9 55:m7 48:d9'), drums: 'boom', lead: 0.6, seed: 31, amb: { city: 0.12 } },
    arcade:  { name: '掌机小调', bpm: 84, swing: 0.6, prog: ch('48:M9 52:m7 53:M9 55:d9 48:M9 45:m9 50:m9 55:d13'), drums: 'groove', lead: 0.75, seed: 37 },
    night:   { name: '晚安，小猫', bpm: 62, swing: 0.55, prog: ch('53:M9 48:M9 50:m9 46:M9 53:M9 57:m7 46:M6 48:sus'), drums: 'none', lead: 0.4, seed: 41, amb: { purr: 0.08 } },
  });
  Object.assign(lib.SCENE, { title: 'rain', lobby: 'rain', coop: 'window', vs: 'train', action: 'train', board: 'coffee', draw: 'studio', study: 'library', travel: 'stroll', hotel: 'coffee', handheld: 'arcade', ending: 'night', cuddle: 'night', menu: 'arcade' });
  const DRUMS = { // 16 steps. K kick, k soft kick, S snare, s ghost snare, B brush, R rim, H hat, h ghost hat
    lazy:   ['K.......K.K.....', '....S.......S...', 'H.h.H.h.H.h.H.hh'],
    boom:   ['K.....K...K.....', '....S.......S..s', 'H.H.H.H.H.H.H.H.'],
    soft:   ['K.........K.....', '....s.......s...', 'h...h...h...h...'],
    groove: ['K.....K.K.....K.', '....S.......S...', 'HhH.HhH.HhH.HhHh'],
    none:   ['................', '................', '................'],
  };
  lib.DRUMS = DRUMS;

  function prepTrack(tr) {
    if (tr.loopSec) return tr;
    const barSec = 240 / tr.bpm; let bars = tr.prog.length; while (bars * barSec < (tr.minLoop || 60)) bars += tr.prog.length; tr.bars = bars; tr.loopSec = bars * barSec;
    let s = tr.seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    tr.mel = [];
    const lo = tr.leadLo || 67, hi = tr.leadHi || 86;
    if (tr.motif) { // phrase-based melody: two 4-bar rhythm motifs (A, B) realised on each bar's chord tones
      const mk = () => { const ph = []; for (let b = 0; b < 4; b++) { const bar = []; if (b === 3 && rnd() < 0.6) { ph.push(bar); continue; } for (let st = 0; st < 16; st++) if ((st % 4 === 0 && rnd() < 0.5) || (st % 4 === 2 && rnd() < 0.22)) bar.push([st, rnd() < 0.35 ? 6 : rnd() < 0.5 ? 3 : 2, Math.floor(rnd() * 3) - 1]); ph.push(bar); } return ph; };
      const A = mk(), B = mk(), form = tr.form || 'AABA';
      let k = 3;
      for (let b = 0; b < bars; b++) {
        const [root, iv] = tr.prog[b % tr.prog.length]; const pool = iv.map(x => root + 24 + x).concat(iv.map(x => root + 36 + x)).filter(m => m >= lo && m <= hi).sort((a, c) => a - c);
        const sec = form[Math.floor(b / 4) % form.length], ph = sec === 'B' ? B : A, cell = ph[b % 4];
        const rest = (b % 16 === 15) || rnd() > tr.lead;
        const bar = []; if (!rest) for (const [st, len, d] of cell) { k = Math.max(0, Math.min(pool.length - 1, k + d)); bar.push([st, pool[k], len]); }
        tr.mel.push(bar);
      }
    } else {
      for (let b = 0; b < bars; b++) {
        const [root, iv] = tr.prog[b % tr.prog.length]; const pool = iv.map(x => root + 24 + x).concat(iv.map(x => root + 36 + x)).filter(m => m >= lo && m <= hi).sort((a, c) => a - c);
        const rest = (b % 8 === 7) || rnd() > tr.lead; const bar = [];
        if (!rest) { let k = Math.floor(rnd() * pool.length); for (let st = 0; st < 16; st++) { if ((st % 4 === 0 && rnd() < 0.55) || (st % 2 === 0 && rnd() < 0.15)) { k = Math.max(0, Math.min(pool.length - 1, k + Math.floor(rnd() * 3) - 1)); bar.push([st, pool[k], rnd() < 0.3 ? 6 : 3]); } } }
        tr.mel.push(bar);
      }
    }
    return tr;
  }

  // ---------- one 16th step of a track ----------
  function scheduleStep(G, p, i, t) {
    const k = G.k, tr = p.tr, bus = p.g, sp = 15 / tr.bpm, bar = Math.floor(i / 16) % tr.bars, st = i % 16;
    const [root, iv] = tr.prog[bar % tr.prog.length], sw = (s) => (s % 2 ? sp * (tr.swing - 0.5) * 2 : 0);
    const pv = tr.padVol == null ? 1 : tr.padVol, bv = tr.bassVol == null ? 1 : tr.bassVol, lv = tr.leadVol == null ? 1 : tr.leadVol, dv = tr.drumVol == null ? 1 : tr.drumVol;
    const padOct = tr.padOct == null ? 12 : tr.padOct;
    // pads
    if (tr.pad === 'ep') { // soft electric-piano comp: hits on 1 and the "and" of 2 (or 3)
      const hits = tr.comp || [0, 6];
      if (hits.includes(st)) iv.slice(0, 4).forEach((x, n) => { const f = mtof(root + padOct + x); k.pluck({ type: 'sine', f, t: t + sw(st) + n * 0.012, dur: sp * (st === 0 ? 5 : 3), vol: 0.06 * pv, decay: 0.5, sus: 0.35, r: 0.25, bus, detune: n % 2 ? 4 : -4 }); k.pluck({ type: 'sine', f: f * 2, t: t + sw(st), dur: sp * 2, vol: 0.012 * pv, decay: 0.12, sus: 0.1, r: 0.15, bus }); });
      if (st === 0) iv.slice(0, 3).forEach((x, n) => k.tone({ type: 'triangle', f: mtof(root + padOct + x), t, dur: sp * 15, vol: 0.018 * pv, a: 0.6, r: 0.6, bus, detune: n % 2 ? 7 : -7 }));
    } else if (st === 0) { // soft triangle + thin pulse pad, gently detuned, long attack
      iv.slice(0, 4).forEach((x, n) => { const f = mtof(root + padOct + x); k.tone({ type: 'triangle', f, t, dur: sp * 15, vol: 0.05 * pv, a: 0.35, r: 0.5, bus, detune: n % 2 ? 6 : -6 }); k.tone({ type: 'pulse12', f, t, dur: sp * 15, vol: 0.012 * pv, a: 0.5, r: 0.5, bus, detune: 9 }); });
    }
    // bass
    const bs = tr.bass || 'round';
    if (bs !== 'none') {
      if (st === 0) k.tone({ type: 'triangle', f: mtof(root - 12), t, dur: sp * (bs === 'pedal' ? 14 : 6), vol: 0.2 * bv, a: 0.02, r: 0.12, bus });
      if (bs !== 'pedal' && st === 10) k.tone({ type: 'triangle', f: mtof(root - 12 + 7), t, dur: sp * 4, vol: 0.14 * bv, a: 0.02, r: 0.1, bus });
      if (bs === 'walk' && st === 14) { const nx = tr.prog[(bar + 1) % tr.prog.length][0]; k.tone({ type: 'triangle', f: mtof(nx - 12 + (nx > root ? -1 : 1)), t: t + sw(st), dur: sp * 1.6, vol: 0.1 * bv, a: 0.02, r: 0.08, bus }); }
    }
    // arpeggio
    const arp = tr.arp == null ? tr.drums !== 'none' : tr.arp;
    if (arp && st % 4 === 2) { const n = (st / 2 | 0) % iv.length; k.tone({ type: 'triangle', f: mtof(root + 24 + iv[n]), t: t + sw(1), dur: sp * 1.5, vol: 0.035 * (tr.arpVol || 1), a: 0.01, r: 0.2, bus }); }
    if (!arp && tr.drums === 'none' && st % 4 === 0) { const n = (st / 4 | 0) % iv.length; k.tone({ type: 'sine', f: mtof(root + 24 + iv[n]), t, dur: sp * 3, vol: 0.04, a: 0.05, r: 0.5, bus }); }
    // lead
    const lvoice = tr.leadVoice || 'tri';
    for (const [s0, m, len] of tr.mel[bar]) if (s0 === st) {
      const tt = t + sw(st), f = mtof(m);
      if (lvoice === 'bell') { k.pluck({ type: 'sine', f, t: tt, dur: sp * len, vol: 0.05 * lv, decay: 0.35, sus: 0.15, r: 0.4, bus }); k.pluck({ type: 'sine', f: f * 3, t: tt, dur: sp, vol: 0.008 * lv, decay: 0.08, sus: 0.05, r: 0.1, bus }); }
      else if (lvoice === 'flute') k.tone({ type: 'sine', f, t: tt, dur: sp * len, vol: 0.06 * lv, a: 0.06, r: 0.3, bus, vib: 12, vibHz: 4.2 });
      else k.tone({ type: 'triangle', f, t: tt, dur: sp * len, vol: 0.05 * lv, a: 0.02, r: 0.25, bus, vib: 9, vibHz: 4.5, detune: -4 });
    }
    // drums (bar 0 of every loop is a breath: hats only)
    const D = DRUMS[tr.drums] || DRUMS.none, tt = t + sw(st), intro = bar < (tr.intro == null ? 0 : tr.intro);
    const c0 = D[0][st], c1 = D[1][st], c2 = D[2][st];
    if (!intro && c0 === 'K') k.tone({ type: 'sine', f: 110, f1: 42, t: tt, dur: 0.16, vol: 0.4 * dv, a: 0.003, r: 0.06, bus });
    if (!intro && c0 === 'k') k.tone({ type: 'sine', f: 90, f1: 45, t: tt, dur: 0.14, vol: 0.26 * dv, a: 0.004, r: 0.06, bus });
    if (!intro && c1 === 'S') k.nz({ t: tt, dur: 0.18, vol: 0.09 * dv, type: 'bandpass', freq: 1800, q: 0.6, bus });
    if (!intro && c1 === 's') k.nz({ t: tt, dur: 0.1, vol: 0.04 * dv, type: 'bandpass', freq: 2200, q: 0.6, bus });
    if (!intro && c1 === 'B') k.nz({ t: tt, dur: 0.28, vol: 0.05 * dv, type: 'bandpass', freq: 2600, q: 0.5, bus, a: 0.03 });
    if (!intro && c1 === 'R') { k.tone({ type: 'sine', f: 1650, t: tt, dur: 0.012, vol: 0.04 * dv, a: 0.001, r: 0.03, bus }); k.nz({ t: tt, dur: 0.03, vol: 0.03 * dv, type: 'bandpass', freq: 2000, q: 1.5, bus }); }
    if (c2 === 'H') k.nz({ t: tt, dur: 0.035, vol: 0.03 * dv, type: 'highpass', freq: 7000, bus });
    if (c2 === 'h') k.nz({ t: tt, dur: 0.025, vol: 0.015 * dv, type: 'highpass', freq: 8000, bus });
    if (tr.extra) for (const x of [].concat(tr.extra)) { const fn = lib.EXTRA && lib.EXTRA[x]; if (fn) fn(k, t, st, bar, p); }
  }

  // ---------- players (one per playing track, so scenes can crossfade) ----------
  function startPlayer(G, id, t, fade) {
    const tr = prepTrack(lib.TRACKS[id]), g = G.ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + Math.max(0.05, fade)); g.connect(G.musicIn);
    const p = { id, tr, g, step: 0, nextT: t + 0.03, stopAt: Infinity };
    G.players.push(p); return p;
  }
  function fadePlayer(G, p, t, fade) {
    lin(p.g.gain, 0, t, fade); p.stopAt = t + fade; G.players.splice(G.players.indexOf(p), 1); G.dead.push({ p, at: t + fade + 6 });
  }
  function pump(G, until, now) {
    for (const p of G.players.concat(G.dead.map(d => d.p))) {
      const sp = 15 / p.tr.bpm;
      if (now != null && p.nextT < now) { while (p.nextT < now + 0.02) { p.nextT += sp; p.step = (p.step + 1) % (p.tr.bars * 16); } } // stalled timer: skip, never burst
      while (p.nextT < until && p.nextT < p.stopAt) { scheduleStep(G, p, p.step, p.nextT); p.nextT += sp; p.step = (p.step + 1) % (p.tr.bars * 16); }
    }
    if (now != null) for (let i = G.dead.length - 1; i >= 0; i--) if (now > G.dead[i].at) // live only: offline graphs are built before rendering { try { G.dead[i].p.g.disconnect(); } catch (e) {} G.dead.splice(i, 1); }
    for (const [name, a] of Object.entries(G.amb)) {
      const def = lib.AMB[name]; if (!def || !def.ev) continue;
      if (now != null && a.next < now) a.next = now + 0.05;
      while (a.next < until) {
        const mutedByClean = def.noise && G.st.clean;
        if (a.vol > 0.001 && !mutedByClean) def.ev(G.k, a.next, a.vol, a);
        a.next += def.gap ? def.gap[0] + Math.random() * (def.gap[1] - def.gap[0]) : -Math.log(1 - Math.random()) / (def.rate || 0.1);
      }
    }
    const w = G.walk;
    if (w) { if (now != null && w.next < now) w.next = now + 0.02; while (w.next < until) { const fn = lib.SFX['step_' + w.surface] || lib.SFX.step_pavement; if (fn) fn(G.k, w.next, { foot: w.n++ % 2 }); w.next += w.dt * (0.96 + Math.random() * 0.08); } }
  }
  function setAmbLayer(G, name, vol, t) {
    const def = lib.AMB[name]; if (!def) return;
    let a = G.amb[name];
    if (!a) {
      a = G.amb[name] = { vol: 0, next: t + Math.random() * 2 };
      if (def.bed) { a.g = G.ctx.createGain(); a.g.gain.value = 0; a.g.connect(G.bedBus); const [s, o, scale] = def.bed(G.k, a); a.scale = scale; o.connect(a.g); a.src = s; }
    }
    a.vol = vol;
    if (a.g) ramp(a.g.gain, vol * a.scale, t, 0.4);
  }

  // ---------- scene → track + ambience ----------
  function parseScene(scene) { // 'street:night@toronto' → {base:'street', variant:'night', city:'toronto'}
    const m = /^([^:@]+)(?::([^@]+))?(?:@(.+))?$/.exec(String(scene || '')) || [];
    const variant = m[2] && (lib.TOD[m[2]] || m[2]);
    return { base: m[1], variant, city: m[3], key: m[1] + (variant ? ':' + variant : '') };
  }
  function trackFor(scene) {
    if (/^track:/.test(scene || '') && lib.TRACKS[scene.slice(6)]) return scene.slice(6);
    if (set.pick !== 'auto' && lib.TRACKS[set.pick]) return set.pick;
    if (lib.TRACKS[scene]) return scene;
    const P = parseScene(scene);
    const id = lib.SCENE[P.key] || lib.SCENE[P.base] || (lib.TRACKS[P.base] ? P.base : null) || 'rain';
    return lib.TRACKS[id] ? id : 'rain';
  }
  function ambFor(scene, id) {
    const P = parseScene(scene), o = Object.assign({}, (lib.TRACKS[id] || {}).amb);
    const add = (k) => Object.assign(o, lib.SCENE_AMB[k] || {});
    add(P.base); if (P.variant) add(P.key); if (P.city) { add(P.base + '@' + P.city); if (P.variant) add(P.key + '@' + P.city); }
    return o;
  }

  // ---------- live state ----------
  let G = null, timer = null, curScene = null, curTrack = null, fileAudio = null;
  const ambUser = {};
  function ensure() {
    if (!G) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
      G = buildGraph(new AC(), set);
      timer = setInterval(livePump, 50);
    }
    if (G.ctx.state === 'suspended') G.ctx.resume();
    return G;
  }
  const look = () => (typeof document !== 'undefined' && document.hidden ? 1.5 : 0.3);
  function livePump() { if (G) pump(G, G.ctx.currentTime + look(), G.ctx.currentTime); }
  function switchTo(Gx, id, t, xf) {
    for (const p of Gx.players.slice()) if (p.id !== id) fadePlayer(Gx, p, t, xf);
    if (id && !Gx.players.some(p => p.id === id)) startPlayer(Gx, id, t, Math.max(0.3, xf * 0.8));
  }
  function applySceneAmb(Gx, scene, id, t, keepUser) {
    const want = scene ? ambFor(scene, id) : {};
    if (keepUser) Object.assign(want, ambUser);
    for (const k of new Set(Object.keys(Gx.amb).concat(Object.keys(want)))) setAmbLayer(Gx, k, want[k] || 0, t);
  }
  function music(scene, opts) {
    opts = opts || {};
    const xf = opts.crossfade == null ? 2.5 : opts.crossfade;
    const changed = scene !== curScene; curScene = scene;
    if (changed) for (const k in ambUser) delete ambUser[k];
    if (!scene) { curTrack = null; if (G) { switchTo(G, null, G.ctx.currentTime, opts.fade == null ? 1.5 : opts.fade); applySceneAmb(G, null, null, G.ctx.currentTime); } return; }
    const id = trackFor(scene); curTrack = id;
    if (fileAudio) return;
    if (!ensure()) return;
    const t = G.ctx.currentTime + 0.02;
    if (changed || !G.players.some(p => p.id === id)) switchTo(G, id, t, xf);
    if (changed) applySceneAmb(G, scene, id, t);
  }
  function playSfx(name, arg) {
    const fn = lib.SFX[name] || lib.SFX.pop; if (!ensure()) return;
    fn(G.k, G.ctx.currentTime + 0.005, arg);
  }
  function setMuted(m) { set.muted = !!m; LS('mmcx-mute', m ? '1' : '0'); if (G) ramp(G.master.gain, m ? 0 : MASTER, G.ctx.currentTime, 0.05); if (fileAudio) fileAudio.muted = m; }
  function setVolume(chn, v) {
    v = Math.max(0, Math.min(1, +v || 0));
    if (chn === 'music') { set.vol.music = v; LS('mmcx-mvol', String(v)); if (G) ramp(G.musicBus.gain, BUS.music * v, G.ctx.currentTime); if (fileAudio) fileAudio.volume = v; }
    else if (chn === 'ambience' || chn === 'amb') { set.vol.ambience = v; LS('mmcx-avol', String(v)); if (G) ramp(G.ambBus.gain, BUS.ambience * v, G.ctx.currentTime); }
    else if (chn === 'sfx') { set.vol.sfx = v; LS('mmcx-svol', String(v)); if (G) ramp(G.sfxBus.gain, BUS.sfx * v, G.ctx.currentTime); }
    else if (chn === 'master') setMuted(v === 0);
    emit();
  }
  function setClean(v) { set.clean = !!v; LS('mmcx-clean', set.clean ? '1' : '0'); if (G) { const t = G.ctx.currentTime; ramp(G.bedBus.gain, set.clean ? 0 : 1, t, 0.2); ramp(G.crackleG.gain, crackleOn(set) ? CRACKLE : 0, t, 0.2); } emit(); }
  function setCrackle(v) { set.crackle = !!v; LS('mmcx-crackle', set.crackle ? '1' : '0'); if (G) ramp(G.crackleG.gain, crackleOn(set) ? CRACKLE : 0, G.ctx.currentTime, 0.2); emit(); }
  const listeners = []; function emit() { for (const f of listeners) try { f(settings()); } catch (e) {} }
  const settings = () => ({ muted: set.muted, music: set.vol.music, ambience: set.vol.ambience, sfx: set.vol.sfx, clean: set.clean, crackle: set.crackle, track: set.pick });

  // ---------- register compositions from js/audio-tracks.js ----------
  function register(L) {
    for (const k of ['TRACKS', 'SFX', 'AMB', 'SCENE', 'SCENE_AMB', 'TOD']) Object.assign(lib[k], L[k] || {});
    Object.assign(DRUMS, L.DRUMS || {}); lib.EXTRA = Object.assign(lib.EXTRA || {}, L.EXTRA || {});
    if (L.Q) Object.assign(Q, L.Q);
    for (const n of Object.keys(lib.SFX)) if (!(n in S)) S[n] = (arg) => playSfx(n, arg);
    if (curScene && G && !fileAudio) { const sc = curScene; curScene = null; music(sc, { crossfade: 1.5 }); }
  }

  // ---------- offline render (verification; same code path as live) ----------
  // script: [{at, scene}|{at, track, crossfade}|{at, stop, fade}|{at, sfx, arg}|{at, amb:{…}}|{at, walk, rate}]
  function renderOffline({ seconds = 20, sampleRate = 44100, script = [], settings: so = {} } = {}) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const ctx = new OAC(2, Math.ceil(seconds * sampleRate), sampleRate);
    const st = { muted: false, vol: Object.assign({}, set.vol, so.vol || {}), clean: so.clean != null ? so.clean : true, crackle: !!so.crackle, pick: 'auto' };
    const Gx = buildGraph(ctx, st);
    const ev = script.slice().sort((a, b) => a.at - b.at); let t = 0, scene = null;
    for (const e of ev) {
      pump(Gx, e.at); t = e.at;
      if (e.scene !== undefined) { scene = e.scene; const id = e.scene ? trackFor(e.scene) : null; switchTo(Gx, id, t, e.crossfade == null ? 2.5 : e.crossfade); applySceneAmb(Gx, e.scene, id, t); }
      if (e.track !== undefined) switchTo(Gx, e.track, t, e.crossfade == null ? 2.5 : e.crossfade);
      if (e.stop) switchTo(Gx, null, t, e.fade == null ? 1.5 : e.fade);
      if (e.sfx) (lib.SFX[e.sfx] || lib.SFX.pop)(Gx.k, t, e.arg);
      if (e.amb) for (const [k, v] of Object.entries(e.amb)) setAmbLayer(Gx, k, v, t);
      if (e.walk !== undefined) Gx.walk = e.walk ? { surface: e.walk, dt: 1 / (e.rate || 2.2), next: t, n: 0 } : null;
    }
    pump(Gx, seconds);
    return ctx.startRendering();
  }

  // ---------- public API ----------
  const S = {};
  for (const n of Object.keys(lib.SFX)) S[n] = (arg) => playSfx(n, arg);
  const API = {
    play(name, arg) { playSfx(name, arg); },
    unlock() { ensure(); if (curScene && G && !G.players.length && !fileAudio) { const sc = curScene; curScene = null; music(sc, { crossfade: 0.8 }); } },
    toggleMute() { setMuted(!set.muted); return set.muted; },
    get muted() { return set.muted; },
    music,
    TRACKS: lib.TRACKS, SCENE: lib.SCENE,
    get track() { return curTrack; }, get pick() { return set.pick; }, get scene() { return curScene; },
    pickTrack(id) { set.pick = id || 'auto'; LS('mmcx-track', set.pick); if (fileAudio && set.pick !== 'file') { fileAudio.pause(); fileAudio = null; } const sc = curScene; curScene = null; music(sc, { crossfade: 1.5 }); emit(); },
    setMusicVol(v) { setVolume('music', v); }, setSfxVol(v) { setVolume('sfx', v); }, setAmbVol(v) { setVolume('ambience', v); },
    get musicVol() { return set.vol.music; }, get sfxVol() { return set.vol.sfx; }, get ambVol() { return set.vol.ambience; },
    get clean() { return set.clean; }, setClean,
    get crackle() { return set.crackle; }, setCrackle,
    ambience(map) { if (!ensure()) return; const t = G.ctx.currentTime; Object.entries(map).forEach(([k, v]) => { ambUser[k] = v; setAmbLayer(G, k, v, t); }); },
    get amb() { const o = {}; for (const k of Object.keys(lib.AMB)) o[k] = G && G.amb[k] ? G.amb[k].vol : 0; return o; },
    walk(surface, opts) { // idempotent: safe to call every frame with the current surface (or null when standing still)
      if (!surface) { if (G) G.walk = null; return; } if (!ensure()) return;
      const dt = 1 / ((opts && opts.rate) || 2.2);
      if (G.walk && G.walk.surface === surface) { G.walk.dt = dt; return; }
      G.walk = { surface, dt, next: G.ctx.currentTime + 0.02, n: G.walk ? G.walk.n : 0 };
    },
    useFile(file) {
      if (!file) return; if (G) switchTo(G, null, G.ctx.currentTime, 0.8); curTrack = null;
      if (fileAudio) fileAudio.pause();
      fileAudio = new Audio(URL.createObjectURL(file)); fileAudio.loop = true; fileAudio.volume = set.vol.music; fileAudio.muted = set.muted; fileAudio.play().catch(() => {});
      set.pick = 'file';
    },
    _graph() { return G ? { ctx: G.ctx, master: G.master, musicBus: G.musicBus, sfxBus: G.sfxBus, ambBus: G.ambBus, bedBus: G.bedBus, crackleG: G.crackleG, players: G.players.map(p => p.id) } : {}; },
    _register: register, _offline: renderOffline, _lib: lib, _prep: (id) => prepTrack(lib.TRACKS[id]),
  };
  Object.defineProperties(S, Object.getOwnPropertyDescriptors(API)); // keep getters live

  // ---------- CatAudio: the documented settings / scene API ----------
  window.CatAudio = {
    playTrack(name, opts) { if (lib.TRACKS[name]) music('track:' + name, opts); },
    playScene(scene, opts) { music(scene, opts); },
    stopTrack(opts) { music(null, opts); },
    playSfx, setAmbience: (map) => S.ambience(map), walk: (s, o) => S.walk(s, o),
    setVolume, getVolume: (chn) => (chn === 'ambience' || chn === 'amb' ? set.vol.ambience : set.vol[chn]),
    setCleanMode: setClean, get cleanMode() { return set.clean; }, setCrackle,
    setMuted, get muted() { return set.muted; },
    pickTrack: (id) => S.pickTrack(id), unlock: () => S.unlock(),
    settings, onChange(fn) { listeners.push(fn); return () => listeners.splice(listeners.indexOf(fn), 1); },
    tracks: () => Object.entries(lib.TRACKS).map(([id, t]) => ({ id, name: t.name, bpm: t.bpm, group: t.group || 'classic' })),
    sfxNames: () => Object.keys(lib.SFX),
    get track() { return curTrack; }, get scene() { return curScene; },
  };

  if (window.CatAudioTracks) setTimeout(() => register(window.CatAudioTracks), 0);
  else if (typeof document !== 'undefined' && document.currentScript && document.currentScript.src) { // auto-load the compositions (no index.html change needed)
    const sc = document.createElement('script'); sc.src = document.currentScript.src.replace(/audio\.js(\?.*)?$/, 'audio-tracks.js$1'); sc.async = false; document.head.appendChild(sc);
  }
  return S;
})();
