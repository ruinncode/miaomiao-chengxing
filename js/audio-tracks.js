// ============================================================
//  喵喵成行 — original lo-fi compositions, gentle SFX and city ambience.
//  Pure data + small recipes; the engine is js/audio.js (it auto-loads this file).
//  Everything is synthesized: no samples, no recordings, no human voices.
//  All progressions / melodies are written for this game (melodies are built
//  from 4-bar motifs on each bar's chord tones with a fixed seed) — no covers.
// ============================================================
(function () {
  if (window.CatAudioTracks) return;
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  const Q = { M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], d7: [0, 4, 7, 10], M9: [0, 4, 7, 11, 14], m9: [0, 3, 7, 10, 14], d9: [0, 4, 10, 14], d13: [0, 4, 10, 14, 21], m11: [0, 3, 10, 14, 17], M6: [0, 4, 7, 9, 14], sus: [0, 5, 7, 10, 14], M69: [0, 4, 9, 14], m6: [0, 3, 7, 9, 14], d7b9: [0, 4, 10, 13] };
  const ch = (s) => s.trim().split(/\s+/).map(x => { const [r, q] = x.split(':'); return [+r, Q[q]]; });

  // 16-step drum lanes: [kick, snare/rim/brush, hats]
  const DRUMS = {
    depart: ['K.....k...K.....', '....S.......S...', 'H.h.H.h.H.h.H.h.'],
    rail:   ['k.......k.......', '....R.......R...', 'h.h.h.h.h.h.h.h.'],
    brush:  ['k.........k.....', '....B.......B...', '..h...h...h...h.'],
    study:  ['k.........k.....', '....R.......R...', 'h...h...h...h...'],
    map:    ['k.......k.......', '....s.......R...', 'h.h.h.h.h.h.h.h.'],
  };

  // per-step extras (scheduled on the track's own gain, so they crossfade with it)
  const EXTRA = {
    // rail joints: soft "ta-dum" pairs, the second pair quieter (gentle train rhythm)
    rail(k, t, st, bar, p) {
      if (st !== 0 && st !== 2 && st !== 8 && st !== 10) return;
      const v = st < 8 ? 1 : 0.6;
      k.nz({ t, dur: 0.07, vol: 0.05 * v, type: 'lowpass', freq: 320, bus: p.g, a: 0.004 });
      k.tone({ type: 'sine', f: 78, f1: 52, t, dur: 0.06, vol: 0.09 * v, a: 0.004, r: 0.04, bus: p.g });
    },
  };

  const TRACKS = {
    departures:   { name: '出发大厅', group: 'travel', bpm: 76, swing: 0.6, prog: ch('53:M9 57:m7 50:m9 55:d13 53:M9 57:m7 58:M9 48:sus'), pad: 'ep', comp: [0, 6], bass: 'walk', drums: 'depart', drumVol: 0.85, lead: 0.65, motif: 1, form: 'AABA', seed: 101, amb: { cafe: 0.12 } },
    street_day:   { name: '晴天街角', group: 'travel', bpm: 84, swing: 0.62, prog: ch('55:M9 59:m7 52:m9 48:M9 55:M9 50:m9 48:M69 50:sus'), bass: 'walk', drums: 'boom', lead: 0.7, motif: 1, form: 'AABA', seed: 211, arpVol: 0.9 },
    street_dusk:  { name: '黄昏散步', group: 'travel', bpm: 74, swing: 0.6, prog: ch('51:M9 55:m7 53:m9 46:d13 51:M9 48:m9 56:M9 46:sus'), pad: 'ep', comp: [0, 10], drums: 'lazy', drumVol: 0.85, lead: 0.55, motif: 1, form: 'ABAB', seed: 223 },
    street_night: { name: '路灯下', group: 'travel', bpm: 66, swing: 0.58, prog: ch('50:m9 46:M9 43:m9 45:d7b9 50:m9 55:d9 46:M9 45:sus'), pad: 'ep', comp: [0], drums: 'brush', drumVol: 0.9, lead: 0.45, leadVoice: 'flute', leadVol: 0.8, motif: 1, form: 'AABA', seed: 233, arp: false },
    ride:         { name: '电车摇摇', group: 'travel', bpm: 80, swing: 0.58, prog: ch('45:m9 53:M9 48:M9 55:d9 45:m9 50:m9 52:sus 52:d7'), drums: 'rail', extra: 'rail', lead: 0.5, leadVoice: 'bell', motif: 1, form: 'AABB', seed: 307, amb: { hum: 0.3 } },
    hotel_rain:   { name: '酒店雨夜', group: 'hotel', bpm: 62, swing: 0.56, prog: ch('46:M9 50:m7 51:M9 53:sus 46:M9 43:m9 51:M69 53:d9'), pad: 'ep', comp: [0, 8], bass: 'pedal', drums: 'soft', drumVol: 0.7, lead: 0.35, leadVoice: 'flute', leadVol: 0.75, motif: 1, form: 'AABA', seed: 401, arp: false, amb: { rain: 0.45 } },
    study_room:   { name: '自习时光', group: 'study', bpm: 68, swing: 0.56, prog: ch('48:M9 52:m7 45:m9 53:M9 48:M9 50:m9 53:m6 55:sus'), drums: 'study', drumVol: 0.9, lead: 0.3, leadVoice: 'bell', leadVol: 0.8, motif: 1, form: 'AABA', seed: 503, amb: { pages: 0.25 } },
    map_screen:   { name: '地图上的小旗', group: 'travel', bpm: 72, swing: 0.6, prog: ch('50:M9 54:m7 55:M9 57:d9 50:M9 47:m9 55:M69 57:sus'), padVol: 0.8, bass: 'walk', drums: 'map', drumVol: 0.8, lead: 0.75, leadVoice: 'bell', motif: 1, form: 'ABAC', seed: 601, leadLo: 72, leadHi: 91 },
    minigame_bed: { name: '小游戏时间', group: 'games', bpm: 88, swing: 0.6, prog: ch('48:M9 45:m9 50:m9 55:d13 52:m7 57:m7 50:m9 55:sus'), pad: 'ep', comp: [0, 6, 10], bass: 'walk', drums: 'groove', drumVol: 0.8, lead: 0.7, motif: 1, form: 'AABA', seed: 701, padVol: 0.85 },
  };
  for (const t of Object.values(TRACKS)) if (t.intro == null) t.intro = 1; // first bar of every loop: drums rest (soft seam)

  // scene keys: 'base', 'base:variant' (variant = day|dusk|night), city ambience via '@city'
  const TOD = { dawn: 'day', morning: 'day', noon: 'day', golden: 'dusk', evening: 'dusk', sunset: 'dusk', late: 'night' };
  const SCENE = {
    departures: 'departures', depart: 'departures', pack: 'departures', plan: 'departures',
    street: 'street_day', 'street:day': 'street_day', 'street:dusk': 'street_dusk', 'street:night': 'street_night',
    travel: 'street_day', 'travel:day': 'street_day', 'travel:dusk': 'street_dusk', 'travel:night': 'street_night',
    ride: 'ride', journey: 'ride', subway: 'ride', streetcar: 'ride', station: 'ride',
    room: 'coffee', 'room:day': 'coffee', 'room:dusk': 'hotel_rain', 'room:night': 'hotel_rain',
    'hotel:night': 'hotel_rain', 'hotel:dusk': 'hotel_rain',
    study: 'study_room', library: 'study_room',
    map: 'map_screen', pick: 'map_screen', worldmap: 'map_screen',
    minigame: 'minigame_bed', menu: 'minigame_bed', vs: 'minigame_bed', action: 'minigame_bed', games: 'minigame_bed',
  };
  // ambience per scene (merged on top of the track's own amb)
  const SCENE_AMB = {
    street: { city: 0.12 }, 'street:night': { city: 0.08 }, travel: { city: 0.12 }, 'travel:night': { city: 0.08 },
    'street@toronto': { streetcar: 0.5, gulls: 0.25, waves: 0.25 }, 'street:dusk@toronto': { gulls: 0.15 }, 'street:night@toronto': { gulls: 0, waves: 0.2, streetcar: 0.35 },
    'travel@toronto': { streetcar: 0.5, gulls: 0.25, waves: 0.25 }, 'travel:dusk@toronto': { gulls: 0.15 }, 'travel:night@toronto': { gulls: 0, waves: 0.2, streetcar: 0.35 },
    'ride@toronto': { streetcar: 0.3 },
    'room:night': { rain: 0.45 },
  };

  // ---------- ambience layers ----------
  // bed = continuous noise (→ bedBus, silent in clean mode); ev = sparse tonal events
  const bell = (k, t, f, v, pan) => { [[1, 1], [2.32, 0.4], [3.9, 0.18], [5.4, 0.08]].forEach(([m, a]) => k.pluck({ type: 'sine', f: f * m, t, dur: 0.05, vol: v * a, a: 0.002, decay: 0.25 / m + 0.15, sus: 0.0, r: 0.4 / m, bus: k.amb, pan })); };
  const loop = (k, buf) => { const s = k.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(k.ctx.currentTime, Math.random() * 1.5); return s; };
  const AMB = {
    // Toronto streetcar bell: two (sometimes three) soft "ding"s, off to one side
    streetcar: { gap: [16, 38], ev(k, t, v) { const pan = (Math.random() - 0.5) * 0.8, n = Math.random() < 0.3 ? 3 : 2; for (let i = 0; i < n; i++) bell(k, t + i * 0.24, 1175, 0.035 * v, pan); } },
    // lake gulls, far away: 1–3 descending "kee-ow" glides
    gulls: { gap: [8, 20], ev(k, t, v) { const pan = (Math.random() - 0.5) * 1.2, n = 1 + Math.floor(Math.random() * 3); for (let i = 0; i < n; i++) { const tt = t + i * (0.42 + Math.random() * 0.15), f = 1700 + Math.random() * 400; k.tone({ type: 'sine', f: f * 0.8, f1: f, t: tt, dur: 0.06, vol: 0.010 * v, a: 0.015, r: 0.02, bus: k.amb, pan }); k.tone({ type: 'sine', f, f1: f * 0.62, t: tt + 0.06, dur: 0.3, vol: 0.014 * v, a: 0.02, r: 0.08, bus: k.amb, pan, vib: 25, vibHz: 16 }); } } },
    // lake waves: brown noise swells every 6.5–10 s (noise → clean mode silences it)
    waves: { bed(k, a) { const s = loop(k, k.G.brownBuf), f = k.G.filt('lowpass', 650, 0.5), sw = k.ctx.createGain(); sw.gain.value = 0.25; s.connect(f); f.connect(sw); a.sw = sw; return [s, sw, 0.55]; },
      gap: [6.5, 10], ev(k, t, v, a) { if (!a.sw) return; a.sw.gain.setTargetAtTime(1, t, 1.1); a.sw.gain.setTargetAtTime(0.22, t + 2.6, 1.8); } },
    // train / subway car interior hum (noise bed)
    hum: { bed(k) { const s = loop(k, k.G.brownBuf), f = k.G.filt('lowpass', 150, 0.6); s.connect(f); return [s, f, 0.5]; } },
  };

  // ---------- gentle SFX ----------
  const step = (k, t, o, fn) => { const foot = o && o.foot ? 1 : 0, pan = foot ? 0.12 : -0.12, d = 0.94 + Math.random() * 0.12, v = 0.85 + Math.random() * 0.3; fn(pan, d, v); };
  const SFX = {
    // footsteps for upright two-legged cats: light, padded, alternating feet
    step_pavement: (k, t, o) => step(k, t, o, (pan, d, v) => { k.nz({ t, dur: 0.05, vol: 0.12 * v, type: 'lowpass', freq: 1500 * d, bus: k.sfx, a: 0.003, pan }); k.tone({ type: 'sine', f: 150 * d, f1: 95, t, dur: 0.035, vol: 0.1 * v, a: 0.003, r: 0.03, bus: k.sfx, pan }); }),
    step_wood: (k, t, o) => step(k, t, o, (pan, d, v) => { k.tone({ type: 'sine', f: 230 * d, f1: 165 * d, t, dur: 0.05, vol: 0.11 * v, a: 0.003, r: 0.05, bus: k.sfx, pan }); k.nz({ t, dur: 0.04, vol: 0.065 * v, type: 'bandpass', freq: 900 * d, q: 1.2, bus: k.sfx, pan }); }),
    step_carpet: (k, t, o) => step(k, t, o, (pan, d, v) => { k.nz({ t, dur: 0.08, vol: 0.16 * v, type: 'lowpass', freq: 520 * d, bus: k.sfx, a: 0.012, pan }); k.tone({ type: 'sine', f: 110 * d, f1: 80, t, dur: 0.05, vol: 0.06 * v, a: 0.008, r: 0.04, bus: k.sfx, pan }); }),
    // shop door bell (two soft tones) and hotel / station chimes
    // soft two-tap knock on a hotel door (hub uses ev('sfx','knock'))
    knock: (k, t) => { [0, 0.17].forEach((dt) => { k.tone({ type: 'sine', f: 190, f1: 140, t: t + dt, dur: 0.05, vol: 0.12, a: 0.002, r: 0.06, bus: k.sfx }); k.nz({ t: t + dt, dur: 0.035, vol: 0.06, type: 'bandpass', freq: 700, q: 1.5, bus: k.sfx }); }); },
    doorChime: (k, t) => { [[88, 0], [84, 0.28]].forEach(([m, dt]) => { k.pluck({ type: 'sine', f: mtof(m), t: t + dt, dur: 0.1, vol: 0.07, decay: 0.45, sus: 0, r: 0.5, bus: k.sfx }); k.pluck({ type: 'sine', f: mtof(m) * 2.4, t: t + dt, dur: 0.05, vol: 0.012, decay: 0.12, sus: 0, r: 0.15, bus: k.sfx }); }); },
    // ticket gate: two short soft beeps, then the flap's padded thunk
    gateBeep: (k, t) => { [0, 0.11].forEach(dt => k.tone({ type: 'sine', f: 1320, t: t + dt, dur: 0.06, vol: 0.06, a: 0.006, r: 0.025, bus: k.sfx })); k.nz({ t: t + 0.28, dur: 0.08, vol: 0.05, type: 'lowpass', freq: 420, bus: k.sfx, a: 0.006 }); k.tone({ type: 'sine', f: 120, f1: 80, t: t + 0.28, dur: 0.06, vol: 0.05, a: 0.004, r: 0.04, bus: k.sfx }); },
    // hug "mrrp": a little rolled trill rising into a chirp
    mrrp: (k, t, pitch = 1) => { k.tone({ type: 'triangle', f: 480 * pitch, f1: 640 * pitch, t, dur: 0.16, vol: 0.09, a: 0.02, r: 0.03, bus: k.sfx, vib: 70, vibHz: 26 }); k.tone({ type: 'sine', f: 680 * pitch, f1: 920 * pitch, t: t + 0.16, dur: 0.09, vol: 0.08, a: 0.01, r: 0.06, bus: k.sfx }); },
    hug: (k, t) => { SFX.mrrp(k, t); k.purr(t + 0.15, 55, 24, 1.6, 0.09, k.sfx); },
    purrLong: (k, t) => k.purr(t, 52, 23, 3, 0.1, k.sfx),
    // UI
    uiClick: (k, t) => { k.tone({ type: 'sine', f: 1250, f1: 900, t, dur: 0.018, vol: 0.06, a: 0.002, r: 0.02, bus: k.sfx }); k.tone({ type: 'triangle', f: mtof(84), t, dur: 0.02, vol: 0.03, a: 0.002, r: 0.03, bus: k.sfx }); },
    uiHover: (k, t) => k.tone({ type: 'sine', f: 1760, t, dur: 0.012, vol: 0.022, a: 0.002, r: 0.02, bus: k.sfx }),
    uiOpen: (k, t) => [79, 84].forEach((m, i) => k.blip(m, t + i * 0.05, 0.05, 0.07, 'sine')),
    uiClose: (k, t) => [84, 79].forEach((m, i) => k.blip(m, t + i * 0.05, 0.05, 0.07, 'sine')),
    uiBack: (k, t) => [79, 72].forEach((m, i) => k.blip(m, t + i * 0.06, 0.05, 0.06, 'triangle')),
    uiToggleOn: (k, t) => [76, 83].forEach((m, i) => k.blip(m, t + i * 0.045, 0.04, 0.06, 'sine')),
    uiToggleOff: (k, t) => [83, 76].forEach((m, i) => k.blip(m, t + i * 0.045, 0.04, 0.06, 'sine')),
    // coin: two round bell tones (replaces the old square-wave coin)
    coin: (k, t) => { [[88, 0, 0.07], [95, 0.06, 0.06]].forEach(([m, dt, v]) => { k.pluck({ type: 'sine', f: mtof(m), t: t + dt, dur: 0.08, vol: v, decay: 0.12, sus: 0.2, r: 0.18, bus: k.sfx }); k.pluck({ type: 'sine', f: mtof(m) * 2.76, t: t + dt, dur: 0.03, vol: v * 0.15, decay: 0.05, sus: 0, r: 0.06, bus: k.sfx }); }); },
    // goodnight: slow music-box fall over a warm low fifth
    goodnight: (k, t) => { [84, 79, 76, 72, 67].forEach((m, i) => k.pluck({ type: 'sine', f: mtof(m), t: t + i * 0.26, dur: 0.3, vol: 0.06, decay: 0.5, sus: 0.15, r: 0.6, bus: k.sfx })); [48, 55, 64].forEach(m => k.tone({ type: 'sine', f: mtof(m), t: t + 0.1, dur: 1.8, vol: 0.045, a: 0.4, r: 1.2, bus: k.sfx })); },
    streetcarBell: (k, t) => { for (let i = 0; i < 2; i++) [[1, 1], [2.32, 0.4], [3.9, 0.18]].forEach(([m, a]) => k.pluck({ type: 'sine', f: 1175 * m, t: t + i * 0.24, dur: 0.05, vol: 0.06 * a, a: 0.002, decay: 0.25 / m + 0.15, sus: 0, r: 0.4 / m, bus: k.sfx })); },
    gull: (k, t) => { const f = 1800; k.tone({ type: 'sine', f: f * 0.8, f1: f, t, dur: 0.06, vol: 0.03, a: 0.015, r: 0.02, bus: k.sfx }); k.tone({ type: 'sine', f, f1: f * 0.62, t: t + 0.06, dur: 0.3, vol: 0.04, a: 0.02, r: 0.08, bus: k.sfx, vib: 25, vibHz: 16 }); },
  };

  // ---------- settings panel helper ----------
  // CatAudio.mountSettings(el) renders 3 sliders + clean-mode + crackle toggles into el.
  function mountSettings(el) {
    const A = window.CatAudio, s = A.settings();
    const row = (id, label, v) => `<label class="vol">${label} <input type="range" min="0" max="1" step="0.05" value="${v}" data-vol="${id}"></label>`;
    el.innerHTML = row('music', '音乐', s.music) + row('ambience', '环境声', s.ambience) + row('sfx', '音效', s.sfx) +
      `<button class="btn small" data-a="clean"></button><button class="btn small ghost" data-a="crackle"></button>`;
    const paint = () => { const z = A.settings(), c = el.querySelector('[data-a=clean]'), k = el.querySelector('[data-a=crackle]');
      c.textContent = z.clean ? '✓ 纯净模式（无底噪/雨声/黑胶）' : '纯净模式：关'; c.classList.toggle('ghost', !z.clean);
      k.textContent = z.crackle ? '✓ 黑胶噼啪（很轻）' : '黑胶噼啪：关'; k.disabled = z.clean; };
    el.querySelectorAll('[data-vol]').forEach(i => { i.oninput = () => A.setVolume(i.dataset.vol, +i.value); });
    el.querySelector('[data-a=clean]').onclick = () => { A.setCleanMode(!A.cleanMode); A.playSfx(A.cleanMode ? 'uiToggleOn' : 'uiToggleOff'); paint(); };
    el.querySelector('[data-a=crackle]').onclick = () => { A.setCrackle(!A.settings().crackle); paint(); };
    paint(); return el;
  }

  window.CatAudioTracks = { Q, DRUMS, EXTRA, TRACKS, SCENE, SCENE_AMB, TOD, AMB, SFX };
  if (window.CatAudio) window.CatAudio.mountSettings = mountSettings;
  if (window.Sfx && window.Sfx._register) window.Sfx._register(window.CatAudioTracks);
})();
