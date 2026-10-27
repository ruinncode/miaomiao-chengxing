// ============================================================
//  Scenery — procedural pixel window views, rooms and streets.
//  Everything is drawn in code (no photos, no logos). A "view" is a
//  small config: sky + skyline layers + landmarks + movers.
//    Scenery.window(R, x, y, w, h, view, {tod, weather, t, curtains})
//  tod: 'dawn' | 'day' | 'golden' | 'night'
//  weather: 'clear' | 'rain' | 'snow' | 'fog' | 'aurora'
// ============================================================
window.Scenery = (function () {
  const TODS = ['dawn', 'day', 'golden', 'night'], WEATHERS = ['clear', 'rain', 'snow', 'fog', 'aurora'];
  const TOD_NAME = { dawn: '清晨', day: '白天', golden: '黄昏', night: '夜晚' };
  const WEA_NAME = { clear: '晴', rain: '雨', snow: '雪', fog: '雾', aurora: '极光' };
  const SKY = {
    dawn: ['#2b3466', '#5a4f8f', '#a9709f', '#e8949c', '#f6bf9a', '#fbe1b0'],
    day: ['#3f7fd0', '#5a97dc', '#79afe6', '#9cc6ee', '#bfdcf4', '#dcecf8'],
    golden: ['#33407a', '#6a4f86', '#b0607a', '#e2806a', '#f3a85a', '#f9d58a'],
    night: ['#070a1c', '#0b1028', '#111839', '#18204a', '#212b5a', '#2d3a6c'],
  };
  // building tones per tod: [far, mid, near] base colours + window colours
  const TONE = {
    dawn: { far: '#6a5f8f', mid: '#4d4774', near: '#35315a', lit: '#ffd9a0', dark: '#2a2748', hl: '#8f80b0', p: 0.25 },
    day: { far: '#9fb4d0', mid: '#7f93b4', near: '#5b6c8c', lit: '#cfe6ff', dark: '#46546f', hl: '#d6e2f0', p: 0.0 },
    golden: { far: '#8a6a86', mid: '#6a4f6e', near: '#4a3654', lit: '#ffd27a', dark: '#382844', hl: '#e8a070', p: 0.35 },
    night: { far: '#1d2547', mid: '#161c38', near: '#0f1329', lit: '#ffd88a', dark: '#0b0e20', hl: '#2c3766', p: 0.55 },
  };
  const hash = (a, b = 0) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const mix = (a, b, k) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * k, g = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * k, bl = (pa & 255) + ((pb & 255) - (pa & 255)) * k; return '#' + ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(bl)).toString(16).slice(1); };

  // ---------- low-level painters on an offscreen 2d ctx (1 unit = 1 art px) ----------
  function P(g) {
    const o = {
      g, r(x, y, w, h, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
      px(x, y, c) { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), 1, 1); },
      // banded sky with 2px checker dither between bands
      sky(x, y, w, h, cols) {
        const n = cols.length, bh = h / n;
        for (let i = 0; i < n; i++) { o.r(x, y + i * bh, w, bh + 1, cols[i]); if (i < n - 1) { g.fillStyle = cols[i + 1]; const yy = Math.round(y + (i + 1) * bh) - 2; for (let xx = 0; xx < w; xx += 2) g.fillRect(x + xx + ((xx >> 1) & 1), yy, 1, 1); for (let xx = 1; xx < w; xx += 2) g.fillRect(x + xx, yy + 1, 1, 1); } }
      },
      tri(x, y, w, h, c) { for (let j = 0; j < h; j++) { const ww = Math.max(1, Math.round(w * (j + 1) / h)); o.r(x + (w - ww) / 2, y + j, ww, 1, c); } },
      circ(cx, cy, rad, c) { for (let j = -rad; j <= rad; j++) { const ww = Math.round(Math.sqrt(rad * rad - j * j)); o.r(cx - ww, cy + j, ww * 2 + 1, 1, c); } },
      ring(cx, cy, rad, c) { for (let a = 0; a < 6.283; a += 0.5 / rad) o.px(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad, c); },
      line(x0, y0, x1, y1, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let i = 0; i <= n; i++) o.px(x0 + (x1 - x0) * i / (n || 1), y0 + (y1 - y0) * i / (n || 1), c); },
    };
    return o;
  }

  // ---------- skyline building ----------
  function building(p, x, base, w, h, kind, tn, layer, seed, night) {
    const body = tn[layer], top = base - h, lit = tn.lit;
    const shade = mix(body, '#000000', 0.18), hi = mix(body, tn.hl, 0.35);
    const k = kind || 'glass';
    p.r(x, top, w, h, body);
    p.r(x + w - Math.max(1, (w / 5) | 0), top, Math.max(1, (w / 5) | 0), h, shade); // side shade
    if (layer !== 'far') p.r(x, top, 1, h, hi);
    // roofs
    const roof = (seed * 7 % 6) | 0;
    if (k === 'glass') { if (roof === 0) p.r(x + w / 2 - 0.5, top - 6, 1, 6, body); if (roof === 1) p.r(x + 2, top - 2, w - 4, 2, body); if (roof === 2) { p.tri(x, top - 4, w, 4, body); } }
    if (k === 'old') { p.r(x - 1, top, w + 2, 1, hi); if (roof < 2) p.tri(x + 1, top - 5, w - 2, 5, mix(body, '#5a2a2a', 0.3)); }
    if (k === 'brick') { p.r(x - 1, top, w + 2, 2, shade); }
    if (k === 'condo') { for (let yy = top + 3; yy < base - 2; yy += 4) p.r(x - 1, yy, w + 2, 1, hi); }
    // windows
    if (layer === 'far' && !night) return;
    const ww = layer === 'near' ? 2 : 1, gx = layer === 'near' ? 4 : 3, gy = layer === 'near' ? 4 : 3;
    for (let yy = top + 3; yy < base - 2; yy += gy) for (let xx = x + 1 + (k === 'glass' ? 0 : 1); xx < x + w - ww - 1; xx += gx) {
      const hsh = hash(xx * 13 + seed, yy * 7);
      if (night || tn.p > 0) { if (hsh < tn.p * (layer === 'far' ? 0.6 : 1)) p.r(xx, yy, ww, layer === 'near' ? 2 : 1, hsh < tn.p * 0.15 ? '#bfe0ff' : lit); else if (layer !== 'far') p.r(xx, yy, ww, layer === 'near' ? 2 : 1, tn.dark); }
      else if (layer !== 'far') p.r(xx, yy, ww, layer === 'near' ? 2 : 1, k === 'glass' ? mix(body, '#e8f4ff', hsh * 0.5) : tn.dark);
    }
  }

  // ---------- landmarks (original pixel interpretations of public architecture) ----------
  const LM = {
    cntower(p, x, base, s, tn) { // tall needle with pod
      const c = mix(tn.mid, '#bfc6d6', tn.p ? 0.2 : 0.6), d = mix(c, '#000', .25);
      p.r(x - 3, base - 70 * s, 6, 70 * s, c); p.r(x + 1, base - 70 * s, 2, 70 * s, d);
      p.r(x - 1, base - 118 * s, 2, 48 * s, c); p.r(x - 7, base - 78 * s, 14, 5, c); p.r(x - 6, base - 73 * s, 12, 2, d); p.r(x - 3, base - 92 * s, 6, 3, c);
      p.r(x - 5, base - 76 * s, 10, 1, tn.p ? '#ffe9a8' : '#dfe8f4'); p.px(x, base - 119 * s, '#ff4060');
    },
    dome(p, x, base, s, tn) { const c = mix(tn.mid, '#c8ccd6', tn.p ? .15 : .5); p.r(x - 22, base - 14, 44, 14, c); for (let i = 0; i < 6; i++) p.r(x - 22 + i * 2, base - 14 - i * 2 + 0, 44 - i * 4, 2, mix(c, '#fff', .1 + i * .03)); },
    tokyotower(p, x, base, s, tn) { const R = tn.p > .4 ? '#ff7a3a' : '#e0452e', W = '#f2efe8'; for (let j = 0; j < 90; j++) { const hw = Math.max(1, 16 - j * 0.17); const c = ((j / 10) | 0) % 2 ? W : R; p.r(x - hw, base - j, 2, 1, c); p.r(x + hw - 2, base - j, 2, 1, c); if (j % 6 === 0) p.r(x - hw, base - j, hw * 2, 1, c); } p.r(x - 6, base - 36, 12, 4, W); p.r(x - 4, base - 64, 8, 3, R); p.r(x - 0.5, base - 106, 1, 16, W); },
    skytree(p, x, base, s, tn) { const c = mix(tn.mid, '#dfe6f0', tn.p ? .25 : .7); for (let j = 0; j < 130; j++) { const hw = Math.max(1, 6 - j * 0.04); p.r(x - hw, base - j, hw * 2, 1, c); } p.r(x - 5, base - 88, 10, 4, c); p.r(x - 4, base - 108, 8, 3, c); p.r(x - .5, base - 140, 1, 12, c); if (tn.p > .4) p.r(x - 4, base - 87, 8, 1, '#a8b8ff'); },
    eiffel(p, x, base, s, tn) { const c = tn.p > .4 ? '#d8a050' : mix(tn.mid, '#6a5a4a', .5); for (let j = 0; j < 100; j++) { const hw = j < 30 ? 18 - j * 0.33 : Math.max(1, 8 - (j - 30) * 0.1); p.r(x - hw, base - j, 2, 1, c); p.r(x + hw - 2, base - j, 2, 1, c); if (j === 12 || j === 30 || j === 62) p.r(x - hw, base - j, hw * 2, 2, c); } for (let a = 0; a < 3.14; a += .05) p.px(x + Math.cos(a) * 9, base - 4 - Math.sin(a) * 7, c); p.r(x - .5, base - 110, 1, 10, c); },
    empire(p, x, base, s, tn) { const c = tn.near, l = tn.lit; p.r(x - 10, base - 60, 20, 60, c); p.r(x - 7, base - 75, 14, 15, c); p.r(x - 4, base - 86, 8, 11, c); p.r(x - 2, base - 94, 4, 8, c); p.r(x - .5, base - 106, 1, 12, c); if (tn.p) { p.r(x - 4, base - 86, 8, 2, l); p.r(x - 2, base - 92, 4, 2, l); } },
    spire(p, x, base, s, tn) { const c = mix(tn.near, '#b8c0d0', tn.p ? .1 : .5); p.r(x - 8, base - 70, 16, 70, tn.near); for (let i = 0; i < 6; i++) p.r(x - 7 + i, base - 70 - i * 4, 14 - i * 2, 4, c); p.r(x - .5, base - 100, 1, 8, c); if (tn.p) for (let i = 0; i < 5; i++) p.px(x - 4 + i * 2, base - 74 - i * 3, tn.lit); },
    bigben(p, x, base, s, tn) { const c = mix(tn.near, '#c8a868', tn.p ? .35 : .6); p.r(x - 5, base - 70, 10, 70, c); p.r(x - 6, base - 74, 12, 12, c); p.circ(x, base - 68, 3, tn.p ? '#ffe9a8' : '#f2ecd8'); p.tri(x - 5, base - 92, 10, 18, mix(c, '#2a3a3a', .4)); p.r(x - .5, base - 96, 1, 4, c); p.r(x + 10, base - 30, 50, 30, c); for (let i = 0; i < 10; i++) p.r(x + 12 + i * 5, base - 34, 2, 4, c); },
    wheel(p, x, base, s, tn, t = 0, rad = 28) { // ferris / observation wheel (animated when t given)
      const c = mix(tn.near, '#e8ecf4', tn.p ? .25 : .7); const cy = base - rad - 4;
      p.line(x, cy, x - 10, base, c); p.line(x, cy, x + 10, base, c); p.ring(x, cy, rad, c); p.ring(x, cy, rad - 3, c);
      for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283 + t * 0.15; p.line(x, cy, x + Math.cos(a) * rad, cy + Math.sin(a) * rad, mix(c, tn.near, .4)); p.r(x + Math.cos(a) * rad - 1, cy + Math.sin(a) * rad, 3, 3, tn.p ? (i % 3 ? '#ff8fb8' : '#8fd0f6') : '#f2efe8'); }
    },
    namsan(p, x, base, s, tn) { p.tri(x - 50, base - 26, 100, 26, mix(tn.far, '#2a4a3a', .4)); const c = mix(tn.mid, '#e8ecf4', tn.p ? .3 : .7); p.r(x - 2, base - 66, 4, 40, c); p.r(x - 6, base - 70, 12, 6, c); p.r(x - .5, base - 90, 1, 20, c); if (tn.p) p.r(x - 5, base - 68, 10, 1, '#8fd0f6'); },
    peak(p, x, base, s, tn) { // hong kong: mountain ridge + tall tower w/ crown
      p.tri(x - 120, base - 60, 240, 60, mix(tn.far, '#1f3a32', .5));
      const c = mix(tn.near, '#cfd8e6', tn.p ? .1 : .5); p.r(x - 7, base - 96, 14, 96, c); for (let i = 0; i < 4; i++) p.r(x - 6 + i, base - 100 - i * 3, 12 - i * 2, 3, c); if (tn.p) for (let y = base - 92; y < base - 4; y += 4) p.r(x - 5, y, 9, 1, tn.lit);
    },
    t101(p, x, base, s, tn) { const c = mix(tn.near, '#7aa6a0', tn.p ? .2 : .55); p.r(x - 7, base - 30, 14, 30, c); for (let i = 0; i < 8; i++) { p.r(x - 7, base - 30 - i * 10 - 10, 14, 10, c); p.r(x - 8, base - 30 - i * 10 - 10, 16, 2, mix(c, '#fff', .2)); } p.r(x - 2, base - 118, 4, 8, c); p.r(x - .5, base - 132, 1, 14, c); },
    pearl(p, x, base, s, tn) { const c = mix(tn.near, '#d8d8e8', .3), pk = tn.p ? '#ff5aa8' : '#d84a8a'; p.r(x - 1, base - 110, 2, 110, c); p.r(x - 8, base, 2, -30, c); p.r(x + 6, base, 2, -30, c); p.circ(x, base - 32, 9, pk); p.circ(x, base - 78, 6, pk); p.circ(x, base - 96, 2, pk); },
    mbs(p, x, base, s, tn) { const c = mix(tn.near, '#c8d0dc', tn.p ? .15 : .6); for (let i = 0; i < 3; i++) { p.r(x - 30 + i * 24, base - 62, 12, 62, c); p.r(x - 26 + i * 24, base - 62, 2, 62, mix(c, '#000', .2)); } p.r(x - 36, base - 68, 74, 5, c); p.r(x + 34, base - 66, 10, 2, c); },
    opera(p, x, base, s, tn) { const c = '#f4f0e6'; for (let i = 0; i < 4; i++) { const xx = x - 30 + i * 16; for (let j = 0; j < 20 - i * 2; j++) p.r(xx + j * 0.4, base - 6 - j, 16 - j * 0.7, 1, mix(c, '#a8a090', j % 4 === 0 ? .25 : 0)); } p.r(x - 36, base - 6, 76, 6, mix(tn.near, '#c8a070', .5)); },
    harbourbridge(p, x, base, s, tn) { const c = mix(tn.near, '#5a6070', .4); for (let a = 0; a <= 3.14; a += .02) { p.px(x + Math.cos(a) * -60, base - 10 - Math.sin(a) * 34, c); p.px(x + Math.cos(a) * -60, base - 8 - Math.sin(a) * 30, c); } p.r(x - 70, base - 16, 140, 3, c); p.r(x - 72, base - 26, 10, 26, mix(c, '#c8b898', .5)); p.r(x + 62, base - 26, 10, 26, mix(c, '#c8b898', .5)); },
    goldengate(p, x, base, s, tn) { const c = '#c8452e'; p.r(x - 50, base - 70, 4, 70, c); p.r(x + 46, base - 70, 4, 70, c); p.r(x - 120, base - 22, 240, 3, c); for (let i = -120; i < 120; i++) { const yy = i < -48 ? base - 22 - (i + 120) * 0.6 : i < 48 ? base - 70 + Math.pow(i / 48, 2) * 46 : base - 70 + (i - 48) * 0.6; p.px(x + i, Math.min(base - 22, yy), c); if (i % 4 === 0 && i > -48 && i < 48) p.r(x + i, yy, 1, base - 22 - yy, mix(c, tn.mid, .4)); } },
    needle(p, x, base, s, tn) { const c = mix(tn.near, '#e8ecf4', tn.p ? .2 : .7); p.r(x - 1, base - 70, 3, 70, c); p.line(x - 6, base, x - 1, base - 50, c); p.line(x + 7, base, x + 2, base - 50, c); p.r(x - 12, base - 74, 25, 3, c); p.r(x - 9, base - 78, 19, 4, mix(c, '#fff', .2)); p.r(x - .5, base - 92, 1, 14, c); if (tn.p) p.r(x - 11, base - 73, 23, 1, tn.lit); },
    colosseum(p, x, base, s, tn) { const c = mix(tn.near, '#d8b888', tn.p ? .3 : .7); p.r(x - 40, base - 34, 80, 34, c); for (let r = 0; r < 3; r++) for (let i = 0; i < 13; i++) p.r(x - 38 + i * 6, base - 30 + r * 10, 3, 6, mix(c, '#3a2a2a', .55)); p.r(x + 26, base - 40, 14, 6, c); },
    sagrada(p, x, base, s, tn) { const c = mix(tn.near, '#c8a878', tn.p ? .3 : .6); for (let i = 0; i < 4; i++) { const xx = x - 18 + i * 10, h = 70 + (i % 3) * 10; p.r(xx, base - h + 10, 6, h - 10, c); p.tri(xx, base - h, 6, 12, c); p.px(xx + 3, base - h - 1, '#f3c55e'); } p.r(x - 22, base - 30, 48, 30, c); },
    castle(p, x, base, s, tn) { const w = '#eef0f6', b = '#5a7ad8'; p.r(x - 30, base - 24, 60, 24, w); for (let i = 0; i < 5; i++) { const xx = x - 28 + i * 13, h = 30 + ((i * 17) % 3) * 10 + (i === 2 ? 26 : 0); p.r(xx, base - h, 6, h, w); p.tri(xx - 1, base - h - 10, 8, 10, b); if (tn.p) p.r(xx + 2, base - h + 6, 2, 3, tn.lit); } },
    pagoda(p, x, base, s, tn) { const c = mix(tn.near, '#4a3a3a', .3), r = '#3a2a2a'; for (let i = 0; i < 5; i++) { const y = base - 12 - i * 13, hw = 16 - i * 2; p.r(x - hw + 3, y, (hw - 3) * 2, 10, mix(c, '#c84a3a', .2)); p.r(x - hw - 2, y - 3, hw * 2 + 4, 3, r); } p.r(x - .5, base - 90, 1, 14, '#c8a050'); },
    gables(p, x, base, s, tn) { const cols = ['#7a4a3a', '#3a3a4a', '#8a6a4a', '#5a3a2a', '#4a5a5a']; for (let i = 0; i < 8; i++) { const xx = x - 60 + i * 15, h = 30 + (i * 7 % 3) * 5, c = mix(cols[i % 5], tn.near, tn.p * .7); p.r(xx, base - h, 14, h, c); p.tri(xx + 2, base - h - 8, 10, 8, c); for (let y = base - h + 3; y < base - 4; y += 6) { p.r(xx + 2, y, 3, 4, tn.p ? (hash(i, y) < .6 ? tn.lit : tn.dark) : '#e8eef4'); p.r(xx + 9, y, 3, 4, tn.p ? (hash(y, i) < .5 ? tn.lit : tn.dark) : '#e8eef4'); } } },
    clocktower(p, x, base, s, tn) { const c = mix(tn.near, '#b86a4a', tn.p ? .3 : .6); p.r(x - 4, base - 46, 8, 46, c); p.r(x - 5, base - 50, 10, 6, c); p.circ(x, base - 40, 2, tn.p ? '#ffe9a8' : '#f2ecd8'); p.tri(x - 4, base - 60, 8, 10, '#3a4a4a'); },
    hills(p, VW, base, tn) { const c1 = mix(tn.far, '#5a7a4a', .45), c2 = mix(tn.mid, '#4a6a3a', .45); for (let x = 0; x < VW; x += 2) { const h1 = 10 + Math.sin(x / 70) * 5 + Math.sin(x / 23) * 2, h2 = 5 + Math.sin(x / 41 + 2) * 3; p.r(x, base - h1, 2, h1, c1); p.r(x, base - h2, 2, h2, c2); } },
    mountains(p, x, base, s, tn, t, snow = true) { const far = mix(tn.far, '#6a7a9a', .3), near = mix(tn.mid, '#3a4a5a', .3); [[x - 140, 70], [x - 40, 92], [x + 70, 80], [x + 170, 64]].forEach(([mx, h], i) => { p.tri(mx - h * 1.2, base - h, h * 2.4, h, i % 2 ? near : far); if (snow) p.tri(mx - h * .3, base - h, h * .6, h * .25, '#eef2f8'); }); },
    chateau(p, x, base, s, tn) { const c = mix(tn.near, '#8a6a5a', tn.p ? .3 : .6), roof = '#3a6a5a'; p.r(x - 30, base - 30, 60, 30, c); p.r(x - 6, base - 52, 12, 52, c); p.tri(x - 8, base - 70, 16, 18, roof); for (let i = -1; i <= 1; i += 2) { p.r(x + i * 24 - 4, base - 40, 8, 10, c); p.tri(x + i * 24 - 5, base - 50, 10, 10, roof); } if (tn.p) for (let i = 0; i < 9; i++) p.r(x - 26 + i * 6, base - 22, 2, 3, tn.lit); },
    falls(p, x, base, s, tn, t = 0) { const w = '#dceaf6'; p.r(x - 70, base - 30, 140, 4, mix(tn.near, '#3a5a3a', .4)); for (let i = 0; i < 140; i++) for (let j = 0; j < 26; j += 2) p.px(x - 70 + i, base - 26 + j + ((j + i * 7 + (t * 30 | 0)) % 3), hash(i, j + (t * 10 | 0)) < .5 ? w : '#a8c8e8'); p.r(x - 70, base - 2, 140, 2, '#f4f8fc'); },
    dc(p, x, base, s, tn) { // Waterloo campus: big modern library-ish block + pond + geese hint
      const c = mix(tn.near, '#c8b8a0', tn.p ? .3 : .6), g = mix(tn.near, '#9ab8d0', tn.p ? .2 : .6);
      p.r(x - 40, base - 26, 80, 26, c); for (let i = 0; i < 9; i++) p.r(x - 38 + i * 9, base - 22, 6, 14, tn.p ? (i % 3 ? tn.lit : tn.dark) : g);
      p.r(x + 44, base - 40, 34, 40, mix(c, '#7a5a4a', .3)); for (let y = base - 36; y < base - 4; y += 5) p.r(x + 46, y, 30, 2, tn.p ? tn.lit : g);
    },
  };

  // ---------- static layer cache ----------
  const cache = {};
  function layer(key, w, h, fn) { let c = cache[key]; if (c) return c; c = cache[key] = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(P(g), w, h); return c; }

  const animCvs = {}; function animCv(w, h) { const k = w + 'x' + h; if (!animCvs[k]) { const c = document.createElement('canvas'); c.width = w; c.height = h; animCvs[k] = c; } return animCvs[k]; }
  // view config defaults
  function skylineLayer(p, W, base, L, tn, night, which) {
    const n = L.n || 18, seed = L.seed || 1, kinds = L.kinds || ['glass', 'glass', 'condo', 'brick'];
    let x = -4; let i = 0;
    while (x < W) {
      const r = hash(seed * 31 + i, which.length), cx = (x / W - (L.center ?? .5));
      const peak = Math.exp(-cx * cx / (2 * (L.spread || .22) ** 2));
      const h = Math.round((L.hMin || 12) + ((L.hMax || 60) - (L.hMin || 12)) * (0.35 * r + 0.65 * peak * (0.6 + 0.4 * hash(i, seed))));
      const w = Math.round((L.wMin || 10) + r * ((L.wMax || 22) - (L.wMin || 10)));
      building(p, x, base, w, h, kinds[(r * 97 | 0) % kinds.length], tn, which, seed * 100 + i, night);
      x += w + ((hash(i, seed * 3) * (L.gap || 3)) | 0); i++;
    }
  }

  // Draw the full window view into the hub canvas at (X,Y,W,H) art px.
  // pan: 0..1 horizontal parallax (mouse/cat position), t: seconds
  // ---- Real-photo mode (opt-in, local to this device). Open-license Wikimedia Commons photos only, see CREDITS.md.
  // Photos are lazy-loaded the first time a matching view is drawn; until then the pixel view is shown.
  const REAL = {
    on: (() => { try { return localStorage.getItem('mm_real') === '1'; } catch (e) { return false; } })(),
    base: 'assets/photos/toronto/', img: {},
    credit: { 'to-lake': 'Maksim Sokolov · CC BY-SA 4.0', 'to-island': 'Jchmrt · CC BY-SA 4.0', 'to-dt': 'Alessio Bragadini · CC BY-SA 2.0', 'to-dist': 'Mark · CC BY 2.0', 'to-mid': 'Maksim Sokolov · CC BY-SA 4.0' },
    has(id) { return !!this.credit[id]; },
    get(id) {
      if (!this.has(id) || typeof Image === 'undefined') return null;
      let im = this.img[id]; if (!im) { im = this.img[id] = new Image(); im.decoding = 'async'; im.src = this.base + id + '.webp'; }
      return im.complete && im.naturalWidth ? im : null;
    },
    toggle() { this.on = !this.on; try { localStorage.setItem('mm_real', this.on ? '1' : '0'); } catch (e) {} return this.on; },
  };
  const PHOTO_TINT = { dawn: ['#ff9a8a', .16], day: null, golden: ['#ff9a3a', .2], night: ['#0a1030', .5] };
  function drawPhoto(R, X, Y, W, H, view, im, o) {
    const ctx = R.ctx, S = R.S, pan = o.pan ?? .5, tod = o.tod || 'day', wea = o.weather || 'clear';
    const k = Math.max(W * S / im.naturalWidth, H * S / im.naturalHeight) * 1.08, dw = im.naturalWidth * k, dh = im.naturalHeight * k;
    const dx = X * S - (dw - W * S) * Math.max(0, Math.min(1, pan)), dy = Y * S - (dh - H * S) * .5;
    ctx.save(); ctx.beginPath(); ctx.rect(X * S, Y * S, W * S, H * S); ctx.clip();
    const sm = ctx.imageSmoothingEnabled; ctx.imageSmoothingEnabled = true; ctx.drawImage(im, dx, dy, dw, dh); ctx.imageSmoothingEnabled = sm;
    const tn = view.id === 'to-island' && tod !== 'night' ? null : PHOTO_TINT[tod]; // the island photo is already a dusk shot
    if (tn) R.rect(X, Y, W, H, tn[0], tn[1]);
    if (wea === 'rain' || wea === 'fog' || wea === 'snow') R.rect(X, Y, W, H, wea === 'snow' ? '#e8eef4' : '#8a94a8', wea === 'fog' ? .45 : .25);
    if (wea === 'snow' || wea === 'rain') for (let i = 0; i < W * H / 300; i++) { const t = o.t || 0, xx = X + (hash(i, 7) * W + (wea === 'rain' ? t * 30 : Math.sin(t + i) * 6)) % W, yy = Y + (hash(i, 8) * H + t * (wea === 'rain' ? 140 : 18)) % H; R.rect(xx, yy, 1, wea === 'rain' ? 4 : 1, wea === 'rain' ? '#c8d4e8' : '#ffffff', .8); }
    if (W >= 160 && H >= 60 && o.credit !== false) R.text('照片 ' + REAL.credit[view.id], X + W - 3, Y + H - 10, { al: 'r', size: 10, c: '#ffffff', shc: '#000000' });
    ctx.restore();
  }
  function drawView(R, X, Y, W, H, view, o = {}) {
    if (REAL.on && REAL.has(view.id)) { const im = REAL.get(view.id); if (im) return drawPhoto(R, X, Y, W, H, view, im, o); }
    const tod = o.tod || 'night', wea = o.weather || 'clear', t = o.t || 0, pan = o.pan ?? .5, ctx = R.ctx, S = R.S;
    const tn = TONE[tod], night = tod === 'night', VW = W + 80, OFF = o.off || {}; // views are wider for parallax
    const horizon = Math.round(H * (view.horizon || .68));
    ctx.save(); ctx.beginPath(); ctx.rect(X * S, Y * S, W * S, H * S); ctx.clip();
    // sky
    const sky = layer(`sky:${tod}:${wea}:${W}:${H}`, W, H, (p) => {
      let cols = SKY[tod]; if (wea === 'rain' || wea === 'fog' || wea === 'snow') cols = cols.map(c => mix(c, tod === 'night' ? '#1a1f2e' : '#8a94a8', .55));
      p.sky(0, 0, W, H, cols);
      if (night && wea !== 'rain' && wea !== 'fog') for (let i = 0; i < W * H / 260; i++) p.px(hash(i, 1) * W, hash(i, 2) * H * .6, hash(i, 3) < .2 ? '#ffffff' : '#9aa8d8');
    });
    R.blit(sky, X, Y);
    // sun / moon
    if (wea === 'clear' || wea === 'aurora') {
      const sx = X + W * (view.sunX ?? .78), sy = Y + H * ({ dawn: .55, day: .16, golden: .5, night: .14 }[tod]);
      if (night) { R.rect(sx - 5, sy - 5, 10, 10, '#f2ecd0'); R.rect(sx - 6, sy - 3, 12, 6, '#f2ecd0'); R.rect(sx - 1, sy - 4, 7, 7, '#d8d2b8'); }
      else { const c = tod === 'day' ? '#fff6d0' : tod === 'golden' ? '#ffd27a' : '#ffc8a8'; ctx.globalAlpha = .25; R.rect(sx - 10, sy - 10, 20, 20, c); ctx.globalAlpha = 1; R.rect(sx - 6, sy - 6, 12, 12, c); R.rect(sx - 7, sy - 4, 14, 8, c); }
    }
    // aurora ribbons
    if (wea === 'aurora') for (let b = 0; b < 3; b++) for (let i = 0; i < W; i += 2) { const yy = Y + H * .12 + b * 10 + Math.sin(i * .035 + t * .6 + b) * 8 + Math.sin(i * .011 - t * .3) * 6; ctx.globalAlpha = .25 + .15 * Math.sin(i * .05 + t + b); R.rect(X + i, yy, 2, 14 - b * 3, b === 1 ? '#7affc0' : b ? '#8a7aff' : '#5aeaa0'); } ctx.globalAlpha = 1;
    // clouds (drifting)
    const nc = OFF.clouds ? 0 : wea === 'clear' ? 4 : 7;
    for (let i = 0; i < nc; i++) { const cw = 30 + hash(i, 9) * 40, cx = X + ((hash(i, 4) * (W + 80) + t * (3 + i)) % (W + 80)) - 40, cy = Y + 6 + hash(i, 5) * H * .3; const cc = night ? '#2a3360' : tod === 'day' ? '#f4f8fc' : tod === 'golden' ? '#f8c098' : '#f0b8c0'; ctx.globalAlpha = wea === 'clear' ? .7 : .9; R.rect(cx, cy, cw, 4, cc); R.rect(cx + 6, cy - 3, cw * .5, 3, cc); R.rect(cx + 3, cy + 4, cw - 8, 2, mix(cc, '#000', .12)); ctx.globalAlpha = 1; }
    // plane with blinking light
    if (view.plane !== false && !OFF.planes) { const px = X + ((t * 9) % (W + 60)) - 30, py = Y + H * .22; R.rect(px, py, 6, 1, night ? '#3a4370' : '#e8eef6'); if ((t * 2 | 0) % 2) R.px(px + 5, py, '#ff4060'); }
    // layers: far, landmarks, mid, near
    const off = (k) => Math.round(-80 * pan * k);
    const sl = view.skyline || {};
    const far = layer(`far:${view.id}:${tod}:${W}:${H}`, VW, H, (p) => { if (view.mountains === 'hills') LM.hills(p, VW, horizon - 4, tn); else if (view.mountains) LM.mountains(p, VW / 2, horizon - 10, 1, tn, 0, view.mountains !== 'green'); skylineLayer(p, VW, horizon - 4, Object.assign({ hMax: 40, seed: 3 }, sl.far || sl), tn, night, 'far'); });
    R.blit(far, X + off(.2), Y);
    for (const L of view.landmarks || []) { const fn = LM[L.k]; if (!fn) continue; if (L.anim) continue; const lc = layer(`lm:${view.id}:${L.k}:${tod}:${H}`, 260, H, (p) => fn(p, 130, horizon - (L.dy || 0), 1, tn)); R.blit(lc, X + W * L.x - 130 + off(L.depth ?? .35), Y); }
    const mid = layer(`mid:${view.id}:${tod}:${W}:${H}`, VW, H, (p) => skylineLayer(p, VW, horizon, Object.assign({ hMax: 70, seed: 7, hMin: 14 }, sl.mid || sl), tn, night, 'mid'));
    R.blit(mid, X + off(.45), Y);
    for (const L of view.landmarks || []) if (L.anim && LM[L.k]) { const still = !!OFF.wheel; // animated (e.g. ferris wheel): redraw a small canvas each frame
      const rad = L.r || 28, sz = rad * 2 + 12, c = animCv(sz, sz + 6), g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
      LM[L.k](P(g), sz / 2, sz + 4, 1, tn, still ? 0 : t, rad); R.blit(c, X + W * L.x - sz / 2 + off(L.depth ?? .5), Y + horizon - (L.dy || 0) - sz - 4);
    }
    // flickering windows on mid layer at night
    if (tn.p > .3 && !OFF.windows) for (let i = 0; i < 10; i++) { const fx = X + hash(i, 77) * W, fy = Y + horizon - 8 - hash(i, 78) * 40; if (Math.sin(t * (1 + hash(i, 79) * 3) + i) > .6) R.rect(fx, fy, 1, 1, tn.lit); }
    // water / ground band
    const gy = Y + horizon;
    if (view.water) {
      const wc = night ? '#0c1430' : tod === 'day' ? '#3a7ab8' : tod === 'golden' ? '#7a5a7a' : '#6a5a8a';
      R.rect(X, gy, W, H - horizon, wc);
      for (let i = 0; i < 40; i++) { const lx = X + ((hash(i, 11) * W + t * 4 * (i % 2 ? 1 : -1)) % W + W) % W, ly = gy + 2 + hash(i, 12) * (H - horizon - 4); R.rect(lx, ly, 3 + hash(i, 13) * 6, 1, night ? (i % 3 ? '#2a3a6a' : tn.lit) : mix(wc, '#ffffff', .3)); }
    } else {
      R.rect(X, gy, W, H - horizon, view.ground || (night ? '#141a30' : '#5a6a5a'));
    }
    // movers (trains, cars, boats, birds) — drawn from bottom config
    for (const m of view.movers || []) if (!OFF[MKIND[m.k] || m.k]) mover(R, X, Y, W, H, m, t, tn, view, tod);
    // near skyline (foreground rooftops)
    if (view.near !== false) { const near = layer(`near:${view.id}:${tod}:${W}:${H}`, VW, H, (p) => skylineLayer(p, VW, H + 2, Object.assign({ hMax: 34, hMin: 10, seed: 11, wMin: 22, wMax: 40, kinds: ['brick', 'condo', 'old'] }, sl.near || {}), tn, night, 'near')); R.blit(near, X + off(.9), Y + (view.nearDy || 8)); }
    // weather
    weather(R, X, Y, W, H, wea, t, tod);
    ctx.restore();
  }

  const MKIND = { train: 'trains', tram: 'trains', go: 'trains', subway: 'trains', shinkansen: 'trains', cars: 'cars', boat: 'boats', sail: 'boats', birds: 'birds', geese: 'birds', neon: 'neon', blink: 'neon' };
  function mover(R, X, Y, W, H, m, t, tn, view, tod) {
    const night = tod === 'night', horizon = H * (view.horizon || .68), y = Y + horizon + (m.y || 0);
    const span = W + 160, ctx = R.ctx;
    const loop = (speed, period, phase = 0) => { const T = (t + phase) % period; const x = T * speed; return x < span ? x - 80 : null; };
    if (m.k === 'train' || m.k === 'tram' || m.k === 'go' || m.k === 'subway' || m.k === 'shinkansen') {
      const dir = m.dir || 1, len = m.len || (m.k === 'tram' ? 46 : m.k === 'go' ? 110 : 90), sp = m.speed || 40;
      const xx = loop(sp, m.period || 16, m.phase || 0); if (xx === null) return;
      const x = dir > 0 ? X + xx - len : X + W - xx;
      if (m.track !== false) { R.rect(X, y + (m.k === 'go' ? 14 : 9), W, 1, '#2a2a33'); }
      const body = m.color || '#d8dce4', stripe = m.stripe || '#c8344a', h = m.k === 'go' ? 14 : m.k === 'tram' ? 9 : 9;
      const cars = Math.max(1, Math.round(len / (m.k === 'tram' ? 15 : 22)));
      for (let c = 0; c < cars; c++) {
        const cx = x + c * (len / cars), cw = len / cars - 1;
        R.rect(cx, y, cw, h, body); R.rect(cx, y + h - 3, cw, 1, stripe);
        if (m.k === 'go') { R.rect(cx, y + 3, cw, 2, night ? tn.lit : '#4a5a6a'); R.rect(cx, y + 8, cw, 2, night ? tn.lit : '#4a5a6a'); R.rect(cx, y + h - 2, cw, 2, m.stripe || '#2e8a4a'); }
        else for (let w = 2; w < cw - 2; w += 4) R.rect(cx + w, y + 2, 2, 3, night ? tn.lit : '#3a4a5a');
      }
      if (m.k === 'shinkansen') { R.rect(dir > 0 ? x + len - 2 : x - 6, y + 3, 8, 6, body); }
      if (m.k === 'tram') { R.rect(x + len / 2, y - 4, 1, 4, '#333'); R.rect(X, y - 5, W, 1, '#3a3a44'); }
      if (night) R.rect(dir > 0 ? x + len - 1 : x, y + h - 3, 2, 1, '#fff6c0');
    } else if (m.k === 'cars') {
      // two lanes; m.side 'R' (right-hand traffic) or 'L'
      const rht = (m.side || 'R') === 'R';
      R.rect(X, y, W, 10, night ? '#1a1c26' : '#4a4c56'); for (let i = 0; i < W; i += 10) R.rect(X + i, y + 5, 5, 1, '#c8b84a');
      for (let i = 0; i < (m.n || 6); i++) {
        const lane = i % 2, near = lane === 1, dir = near ? (rht ? 1 : -1) : (rht ? -1 : 1);
        const sp = 18 + hash(i, 3) * 14, ph = hash(i, 4) * 40; const xx = ((t * sp + ph * 20) % span) - 80;
        const cx = dir > 0 ? X + xx : X + W - xx, cy = y + (near ? 6 : 1);
        const cols = ['#d84a4a', '#e8e8ee', '#3a5ad8', '#2a2a30', '#e8c84a', '#5aa86a'];
        const taxi = m.taxi && i % 3 === 0;
        R.rect(cx, cy, 8, 3, taxi ? m.taxi : cols[(i * 7) % cols.length]); R.rect(cx + 2, cy - 1, 4, 1, taxi ? m.taxi : cols[(i * 7) % cols.length]);
        if (night) { R.px(dir > 0 ? cx + 8 : cx - 1, cy + 1, '#fff6c0'); R.px(dir > 0 ? cx - 1 : cx + 8, cy + 1, '#ff4060'); }
      }
    } else if (m.k === 'boat') {
      const xx = loop(m.speed || 8, m.period || 70, m.phase || 0); if (xx === null) return; const dir = m.dir || 1;
      const x = dir > 0 ? X + xx : X + W - xx, c = m.color || '#f2efe8';
      R.rect(x, y + 4, 22, 3, c); R.rect(x + 2, y + 7, 18, 1, '#2a2a33'); R.rect(x + 5, y + 1, 10, 3, c); R.rect(x + 6, y + 2, 8, 1, night ? tn.lit : '#4a5a6a'); R.rect(x + 9, y - 3, 1, 4, '#333');
      ctx.globalAlpha = .4; R.rect(x - 6 * dir, y + 7, 8, 1, '#ffffff'); ctx.globalAlpha = 1;
    } else if (m.k === 'sail') {
      const xx = loop(m.speed || 5, m.period || 90, m.phase || 0); if (xx === null) return; const x = X + xx;
      R.rect(x, y + 4, 12, 2, '#f2efe8'); for (let j = 0; j < 9; j++) R.rect(x + 6, y - 6 + j, Math.max(1, j * .6), 1, '#ffffff');
    } else if (m.k === 'birds' || m.k === 'geese') {
      for (let i = 0; i < (m.n || 5); i++) { const bx = X + ((t * (m.speed || 12) + i * 9 + hash(i, 2) * 30) % (W + 40)) - 20, by = Y + H * .3 + Math.sin(t + i) * 3 + (m.k === 'geese' ? Math.abs(i - 2) * 3 : hash(i, 3) * 20); const f = ((t * 6 + i) | 0) % 2; const c = night ? '#4a5378' : '#2a2a33'; if (m.k === 'geese') { R.rect(bx, by, 4, 1, '#3a3028'); R.px(bx + 4, by - 1, '#111'); R.px(bx + 1, by - 1 + f * 2, c); } else { R.px(bx, by, c); R.px(bx - 1, by - 1 + f * 2, c); R.px(bx + 1, by - 1 + f * 2, c); } }
    } else if (m.k === 'neon') {
      for (let i = 0; i < (m.n || 6); i++) { const nx = X + hash(i, 21) * W, ny = Y + horizon - 6 - hash(i, 22) * 30, on = Math.sin(t * 3 + i * 2) > -.7; if (!night && tod !== 'golden') continue; const c = ['#ff5aa8', '#5af0ff', '#ffd25a', '#9a7aff'][i % 4]; ctx.globalAlpha = on ? 1 : .25; R.rect(nx, ny, 2, 8, c); R.rect(nx - 1, ny + 2, 4, 1, c); ctx.globalAlpha = on ? .2 : 0; R.rect(nx - 3, ny - 2, 8, 12, c); ctx.globalAlpha = 1; }
    } else if (m.k === 'blink') { // tower beacons
      if ((t * 1.5 | 0) % 2) for (const bx of m.xs || [.3, .6]) R.rect(X + W * bx, Y + horizon - (m.h || 60), 1, 1, '#ff4060');
    }
  }

  // ---------- weather overlay ----------
  function weather(R, X, Y, W, H, wea, t, tod) {
    const ctx = R.ctx;
    if (wea === 'rain') { ctx.globalAlpha = .55; for (let i = 0; i < 70; i++) { const x = X + (hash(i, 1) * W + t * 20) % W, y = Y + ((hash(i, 2) * H + t * 160) % H); R.rect(x, y, 1, 4, '#b8cce8'); } ctx.globalAlpha = 1; }
    if (wea === 'snow') for (let i = 0; i < 60; i++) { const x = X + ((hash(i, 1) * W + Math.sin(t + i) * 6 + t * 4) % W + W) % W, y = Y + ((hash(i, 2) * H + t * (12 + hash(i, 3) * 10)) % H); R.rect(x, y, hash(i, 4) < .3 ? 2 : 1, hash(i, 4) < .3 ? 2 : 1, '#f4f8ff'); }
    if (wea === 'fog') for (let b = 0; b < 5; b++) { ctx.globalAlpha = .18; const yy = Y + H * .45 + b * 10; R.rect(X + Math.sin(t * .2 + b) * 20 - 20, yy, W + 40, 8, tod === 'night' ? '#4a5378' : '#e8eef4'); } ctx.globalAlpha = 1;
  }

  // ---------- the window frame / glass / curtains ----------
  function windowFrame(R, X, Y, W, H, o = {}) {
    const fr = o.frame || '#e8e0d0', fd = mix(fr, '#000', .3), t = o.t || 0, ctx = R.ctx;
    // raindrops on glass
    if (o.weather === 'rain') for (let i = 0; i < 26; i++) { const dx = X + 3 + hash(i, 31) * (W - 6), sp = 3 + hash(i, 32) * 10, dy = Y + ((hash(i, 33) * H + t * sp) % H); R.rect(dx, dy, 1, 2, '#dfe9f8'); R.px(dx, dy + 2, '#8aa0c8'); ctx.globalAlpha = .4; R.rect(dx, dy - 6, 1, 6, '#cfdcf0'); ctx.globalAlpha = 1; }
    if (o.weather === 'snow') { R.rect(X, Y + H - 3, W, 3, '#f4f8ff'); for (let i = 0; i < W; i += 3) R.rect(X + i, Y + H - 4 - (hash(i, 9) * 2 | 0), 3, 1, '#f4f8ff'); }
    // reflection
    ctx.globalAlpha = .07; for (let i = 0; i < 3; i++) R.rect(X + 10 + i * 30, Y, 12, H, '#ffffff'); ctx.globalAlpha = 1;
    // mullions
    const style = o.style || 'grid';
    if (style === 'grid') { R.rect(X + W / 2 - 1, Y, 3, H, fr); R.rect(X, Y + H * .38, W, 3, fr); }
    if (style === 'floor') { for (let i = 1; i < 4; i++) R.rect(X + W * i / 4 - 1, Y, 2, H, '#2a2f3a'); }
    if (style === 'shoji') { for (let i = 1; i < 4; i++) R.rect(X + W * i / 4 - 1, Y, 2, H, '#6a4a2a'); for (let j = 1; j < 3; j++) R.rect(X, Y + H * j / 3, W, 2, '#6a4a2a'); }
    if (style === 'french') { R.rect(X + W / 2 - 1, Y, 3, H, fr); for (let j = 1; j < 4; j++) { R.rect(X, Y + H * j / 4, W, 2, fr); } }
    if (style === 'arch') { /* drawn by caller */ }
    if (style === 'train') { R.rect(X, Y + H * .12, W, 2, '#5a5a66'); }
    // frame
    R.rect(X - 4, Y - 4, W + 8, 4, fr); R.rect(X - 4, Y + H, W + 8, 5, fr); R.rect(X - 4, Y - 4, 4, H + 8, fr); R.rect(X + W, Y - 4, 4, H + 8, fr);
    R.rect(X - 4, Y + H + 4, W + 8, 1, fd); R.rect(X - 6, Y + H + 2, W + 12, 4, mix(fr, '#fff', .15)); R.rect(X - 6, Y + H + 6, W + 12, 1, fd);
    // curtains
    if (o.curtains) {
      const cc = o.curtainC || '#c86a7a', cd = mix(cc, '#000', .25), open = o.open ?? 1, sway = Math.sin(t * .8) * 1.5;
      const cw = Math.round(14 + (1 - open) * (W / 2 - 14));
      R.rect(X - 10, Y - 10, W + 20, 4, '#5a4a3a');
      for (const side of [0, 1]) {
        const x0 = side ? X + W + 8 - cw : X - 8;
        R.rect(x0, Y - 6, cw, H + 16, cc);
        for (let i = 2; i < cw; i += 5) R.rect(x0 + i + (side ? -sway : sway) * (i / cw), Y - 6, 1, H + 16, cd);
        R.rect(side ? x0 : x0 + cw - 2, Y + H * .5, 2, 4, '#e8c86a');
      }
    }
  }

  // ---------- rooms ----------
  // Each room style: wall, floor, furniture painter. Drawn into the full 480x272 canvas.
  const ROOMS = {
    modern: { wall: '#3a3f55', wall2: '#33384c', floor: '#6a5a4a', floor2: '#5f5042', trim: '#e8e0d0', curtain: '#8a96b0', win: { x: 120, y: 34, w: 240, h: 128, style: 'floor' }, bed: 'double' },
    condo: { wall: '#4a4458', wall2: '#423d50', floor: '#8a7058', floor2: '#7c644e', trim: '#e8e0d0', curtain: '#c8a87a', win: { x: 100, y: 30, w: 280, h: 136, style: 'floor' }, bed: 'double' },
    cozy: { wall: '#5a4a5a', wall2: '#524352', floor: '#7a5a42', floor2: '#6e503a', trim: '#f0e6d6', curtain: '#c86a7a', win: { x: 150, y: 40, w: 180, h: 112, style: 'grid' }, bed: 'double' },
    ryokan: { wall: '#c8b898', wall2: '#bcac8c', floor: '#a8a060', floor2: '#9a9254', trim: '#6a4a2a', curtain: null, win: { x: 130, y: 36, w: 220, h: 120, style: 'shoji' }, bed: 'futon', tatami: true },
    capsule: { wall: '#2a2f3e', wall2: '#252a38', floor: '#3a3f4e', floor2: '#343948', trim: '#d8dce4', curtain: null, win: { x: 170, y: 46, w: 140, h: 86, style: 'grid' }, bed: 'capsule' },
    paris: { wall: '#e8dcc8', wall2: '#dccfb8', floor: '#8a5a3a', floor2: '#7c5032', trim: '#ffffff', curtain: '#5a7a9a', win: { x: 160, y: 26, w: 160, h: 140, style: 'french' }, bed: 'double', mould: true },
    loft: { wall: '#7a4a3a', wall2: '#6e4234', floor: '#4a3a32', floor2: '#40322a', trim: '#2a2a30', curtain: null, win: { x: 110, y: 30, w: 260, h: 132, style: 'grid' }, bed: 'double', brick: true },
    tropical: { wall: '#e8d8b8', wall2: '#dccca8', floor: '#a87a4a', floor2: '#9a6e40', trim: '#6a4a2a', curtain: '#f4f0e6', win: { x: 100, y: 30, w: 280, h: 136, style: 'floor' }, bed: 'double', plants: true },
    train: { wall: '#4a4a58', wall2: '#424250', floor: '#2a2a33', floor2: '#25252e', trim: '#8a8a96', curtain: null, win: { x: 40, y: 50, w: 400, h: 90, style: 'train' }, bed: 'seat' },
    study: { wall: '#3c3550', wall2: '#352f48', floor: '#6a4e3a', floor2: '#5e4432', trim: '#e8dcc8', curtain: '#7a6aa8', win: { x: 150, y: 28, w: 180, h: 104, style: 'grid' }, bed: null },
  };
  function roomBack(R, style, o = {}) {
    const rm = ROOMS[style] || ROOMS.cozy;
    const bg = layer(`room:${style}`, R.AW, R.AH, (p) => {
      p.r(0, 0, R.AW, 200, rm.wall);
      for (let x = 0; x < R.AW; x += 24) p.r(x, 0, 12, 200, rm.wall2);
      if (rm.brick) for (let y = 0; y < 200; y += 6) for (let x = (y / 6 % 2) * 8; x < R.AW; x += 16) { p.r(x, y, 15, 5, hash(x, y) < .5 ? '#8a5040' : '#7a4434'); }
      if (rm.mould) { for (let x = 10; x < R.AW; x += 120) { p.r(x, 20, 100, 1, '#fff'); p.r(x, 150, 100, 1, '#fff'); p.r(x, 20, 1, 130, '#fff'); p.r(x + 99, 20, 1, 130, '#fff'); } p.r(0, 8, R.AW, 3, '#fff'); }
      p.r(0, 196, R.AW, 4, rm.trim);
      for (let y = 200; y < R.AH; y += 6) { p.r(0, y, R.AW, 6, (y / 6) % 2 ? rm.floor : rm.floor2); for (let x = (y * 7) % 40; x < R.AW; x += 40) p.r(x, y, 1, 6, mix(rm.floor, '#000', .2)); }
      if (rm.tatami) { for (let x = 0; x < R.AW; x += 96) { p.r(x, 200, 1, 72, '#6a6430'); } p.r(0, 236, R.AW, 1, '#6a6430'); }
    });
    R.blit(bg, 0, 0);
    return rm;
  }
  // furniture helpers drawn on hub canvas directly
  const F = {
    bed(R, kind, x, y, o = {}) { // y = floor line
      const c = o.c || '#e8e4f0', b = o.blanket || '#c86a7a';
      if (kind === 'futon') { R.rect(x, y - 8, 120, 8, '#f4f0e6'); R.rect(x + 30, y - 10, 90, 4, b); R.rect(x + 4, y - 12, 22, 5, '#ffffff'); return { x: x + 60, y: y - 8 }; }
      if (kind === 'capsule') { R.rect(x - 10, y - 80, 150, 80, '#d8dce4'); R.rect(x, y - 70, 130, 54, '#1a1f2e'); R.rect(x + 4, y - 30, 122, 10, '#e8e4f0'); R.rect(x + 40, y - 34, 86, 6, b); R.rect(x + 6, y - 66, 30, 3, '#8fd0f6'); R.rect(x - 10, y - 16, 150, 16, '#c3c8d4'); return { x: x + 64, y: y - 28 }; }
      if (kind === 'seat') { for (let i = 0; i < 2; i++) { R.rect(x + i * 46, y - 40, 40, 30, '#3a5a8a'); R.rect(x + i * 46, y - 14, 42, 8, '#30507a'); R.rect(x + i * 46 + 6, y - 40, 28, 6, '#e8e4f0'); } return { x: x + 44, y: y - 12 }; }
      if (kind === 'sofa') { R.rect(x, y - 30, 110, 14, '#8a6a9a'); R.rect(x - 6, y - 26, 10, 22, '#7a5a8a'); R.rect(x + 106, y - 26, 10, 22, '#7a5a8a'); R.rect(x, y - 18, 110, 12, '#9a7aaa'); R.rect(x + 2, y - 6, 4, 6, '#3a2a2a'); R.rect(x + 104, y - 6, 4, 6, '#3a2a2a'); return { x: x + 55, y: y - 18 }; }
      if (kind === 'windowseat') { R.rect(x, y - 16, 120, 16, '#c8b8a0'); R.rect(x, y - 20, 120, 6, '#e8d8c0'); R.rect(x + 8, y - 26, 18, 8, '#c86a7a'); return { x: x + 60, y: y - 20 }; }
      // double bed
      R.rect(x - 4, y - 46, 8, 46, '#5a4030'); R.rect(x - 6, y - 50, 12, 6, '#6a4a38');
      R.rect(x, y - 22, 140, 16, c); R.rect(x, y - 8, 140, 8, '#5a4030'); R.rect(x + 6, y - 28, 30, 8, '#ffffff'); R.rect(x + 40, y - 26, 100, 20, b); R.rect(x + 40, y - 26, 100, 2, mix(b, '#fff', .25)); R.rect(x + 136, y - 30, 6, 30, '#5a4030');
      return { x: x + 76, y: y - 22 };
    },
    lamp(R, x, y, on = true, t = 0) { R.rect(x - 1, y - 40, 2, 34, '#c8a050'); R.rect(x - 6, y - 6, 12, 6, '#8a6a3a'); R.rect(x - 10, y - 50, 20, 10, '#f4d8a0'); if (on) { for (let k = 0; k < 4; k++) { const rr = 14 + k * 10; R.ctx.globalAlpha = .05 + Math.sin(t * 2) * .005; R.rect(x - rr, y - 46 - rr * .3, rr * 2, rr * 1.3 + 4, '#ffd88a'); R.rect(x - rr + 4, y - 46 - rr * .3 - 3, rr * 2 - 8, rr * 1.3 + 10, '#ffd88a'); } R.ctx.globalAlpha = 1; } },
    plant(R, x, y) { R.rect(x - 6, y - 10, 12, 10, '#b86a4a'); R.rect(x - 7, y - 11, 14, 2, '#c87a5a'); [[0, -22], [-6, -18], [6, -17], [-3, -28], [4, -26]].forEach(([dx, dy], i) => R.rect(x + dx - 2, y + dy, 5, 9, i % 2 ? '#4a8a5a' : '#5aa86a')); },
    desk(R, x, y, w = 120) { R.rect(x, y - 30, w, 5, '#8a6040'); R.rect(x, y - 25, w, 1, '#6a4a30'); R.rect(x + 4, y - 25, 4, 25, '#6a4a30'); R.rect(x + w - 8, y - 25, 4, 25, '#6a4a30'); return y - 30; },
    tv(R, x, y, on, t) { R.rect(x, y - 40, 64, 38, '#14161e'); R.rect(x + 3, y - 37, 58, 32, on ? '#2a3a6a' : '#1a1f2e'); if (on) { for (let i = 0; i < 6; i++) R.rect(x + 6 + i * 9, y - 30 + Math.sin(t * 3 + i) * 3, 6, 6, ['#ff8fb8', '#8fd0f6', '#f3c55e'][i % 3]); } R.rect(x + 28, y - 2, 8, 2, '#14161e'); },
    rug(R, x, y, w, c = '#7a5a8a') { R.rect(x, y, w, 14, c); R.rect(x + 3, y + 3, w - 6, 8, mix(c, '#fff', .15)); for (let i = 0; i < w; i += 4) { R.px(x + i, y - 1, c); R.px(x + i, y + 14, c); } },
    shelf(R, x, y, w = 70) { R.rect(x, y, w, 3, '#6a4a30'); const cols = ['#c86a7a', '#5a8ac8', '#f3c55e', '#8fe0b0', '#9a7aaa', '#e8e4f0']; for (let i = 0; i < w - 4; i += 5) R.rect(x + 2 + i, y - 10 - (hash(i, x) * 4 | 0), 4, 10 + (hash(i, x) * 4 | 0), cols[(i * 3 + x) % cols.length]); },
    frame(R, x, y, w, h, kind = 0) { R.rect(x, y, w, h, '#c8a050'); R.rect(x + 2, y + 2, w - 4, h - 4, ['#8fd0f6', '#ffc8a8', '#b6efc8'][kind % 3]); R.rect(x + 4, y + h - 8, w - 8, 4, '#5a8a6a'); },
  };

  // ---------- streets (side view) ----------
  // cfg: {seed, styles:[...], palette:[...], side:'R'|'L', tram, signs:[...], ground}
  const SHOPKINDS = { cafe: '咖啡', books: '书店', grocery: '超市', bakery: '面包', ramen: '拉面', flowers: '花店', conv: '便利店', bar: '小酒馆', gift: '礼品', game: '电玩', tea: '茶铺', bank: '银行', library: '图书馆' };
  const GAP = 48;
  function streetChunk(R, cfg, i, tod) {
    const key = `st:${cfg.id}:${i}:${tod}`, tn = TONE[tod], night = tod === 'night';
    return layer(key, 240, 200, (p) => {
      const pal = cfg.palette || ['#8a5a4a', '#6a6a7a', '#b8a080', '#5a6a8a', '#9a7a5a'];
      const gap = !!(cfg.cross && cfg.cross.includes(i));
      let x = gap ? GAP : 0, j = 0;
      while (x < 240) {
        const r = hash(i * 17 + j, cfg.seed || 1), w = 40 + ((r * 4) | 0) * 10, h = Math.min(cfg.hMax || 999, 70 + ((hash(j, i) * 5) | 0) * 18);
        const col = mix(pal[(r * 31 | 0) % pal.length], tn.near, night ? .55 : tod === 'day' ? 0 : .25), top = 160 - h;
        const st = (cfg.styles || ['brick', 'glass', 'old'])[(hash(j, i * 3) * 9 | 0) % (cfg.styles || [0, 0, 0]).length];
        if (st === 'machiya') { // low two-storey wooden townhouse: tiled eaves, lattice (koshi), noren
          const wd = mix('#4a3226', tn.near, night ? .5 : tod === 'day' ? 0 : .2), tile = mix('#3a3a44', tn.near, night ? .4 : .1), mt = 96;
          p.r(x, mt, w, 64, wd); p.r(x, mt - 6, w, 6, tile); p.r(x - 1, mt - 7, w + 2, 2, mix(tile, '#fff', .2));
          for (let xx = x + 4; xx < x + w - 4; xx += 3) p.r(xx, mt + 4, 1, 14, mix(wd, '#c8a070', .45));
          p.r(x - 2, 116, w + 4, 5, tile); p.r(x - 2, 115, w + 4, 1, mix(tile, '#fff', .25));
          if (night) p.r(x + w / 2 - 2, 104, 4, 6, '#ffb86a');
          p.r(x + 2, 124, w - 4, 36, mix(wd, '#000', .25)); for (let xx = x + 4; xx < x + w - 16; xx += 3) p.r(xx, 128, 1, 30, mix(wd, '#d8b080', .5));
          p.r(x + w - 14, 132, 9, 28, '#2a1a14'); p.r(x + w - 16, 124, 13, 9, ['#2a3a6a', '#7a2a2a', '#3a5a4a'][(r * 7 | 0) % 3]);
          x += w + 1; j++; continue;
        }
        p.r(x, top, w, h, col); p.r(x, top, w, 3, mix(col, '#fff', .15)); p.r(x + w - 2, top, 2, h, mix(col, '#000', .2));
        if (st === 'glass') for (let yy = top + 6; yy < 120; yy += 8) p.r(x + 3, yy, w - 6, 5, night ? (hash(yy, x) < .5 ? tn.lit : '#1a2240') : mix('#9ab8d8', '#fff', hash(yy, x) * .3));
        else for (let yy = top + 8; yy < 120; yy += 14) for (let xx = x + 5; xx < x + w - 8; xx += 11) { p.r(xx, yy, 6, 9, night ? (hash(xx, yy) < .45 ? tn.lit : '#1a2240') : '#cfdcec'); p.r(xx - 1, yy + 9, 8, 1, mix(col, '#fff', .3)); if (st === 'old') p.r(xx - 1, yy - 2, 8, 2, mix(col, '#fff', .2)); }
        if (st === 'old' && hash(j, 5) < .5) p.tri(x + 2, top - 10, w - 4, 10, mix(col, '#3a2a2a', .3));
        if (st === 'victorian') { p.tri(x + 4, top - 14, w - 8, 14, mix(col, '#2a2a3a', .4)); p.r(x + w / 2 - 4, top - 6, 8, 6, '#cfdcec'); }
        // shopfront
        p.r(x + 2, 124, w - 4, 36, mix(col, '#000', .25)); p.r(x + 6, 130, w - 22, 24, night ? '#ffd88a' : '#a8c4dc'); p.r(x + w - 14, 132, 9, 28, '#3a2a2a');
        p.r(x + 4, 120, w - 8, 6, ['#c84a4a', '#3a6a5a', '#2a3a6a', '#c8a050', '#7a4a7a'][(r * 13 | 0) % 5]);
        for (let k = 0; k < w - 8; k += 6) p.r(x + 4 + k, 126, 3, 2, '#f4f0e6');
        x += w + 1; j++;
      }
      // sidewalk + curb
      p.r(0, 160, 240, 12, cfg.walk || '#a8a8b0'); for (let xx = 0; xx < 240; xx += 16) p.r(xx, 160, 1, 12, '#8a8a94'); p.r(0, 172, 240, 2, '#d8d8e0');
      if (cfg.road) { p.r(0, 174, 240, 26, mix(cfg.road, '#000', night ? .55 : 0)); for (let yy = 176; yy < 200; yy += 6) for (let xx = (yy / 6 % 2) * 8; xx < 240; xx += 16) p.r(xx, yy, 15, 5, mix(cfg.road, '#fff', night ? -.0 : .08)); }
      else { p.r(0, 174, 240, 26, night ? '#22242e' : '#4a4c56'); for (let xx = 0; xx < 240; xx += 20) p.r(xx, 186, 10, 1, cfg.lane || '#e8e0a0'); }
      if (cfg.tram) { p.r(0, 180, 240, 1, '#8a8a94'); p.r(0, 192, 240, 1, '#8a8a94'); }
      if (gap) { // cross street receding into the distance + zebra crossings + stop lines
        const rd = night ? '#22242e' : '#4a4c56', sw = cfg.walk || '#a8a8b0';
        for (let yy = 118; yy < 160; yy++) { const k = (yy - 118) / 42, hw = 6 + k * 16, cx = GAP / 2; p.r(cx - hw - 3 * k - 1, yy, 3 * k + 1, 1, sw); p.r(cx - hw, yy, hw * 2, 1, rd); p.r(cx + hw, yy, 3 * k + 1, 1, sw); if ((yy >> 2) % 2) p.px(cx, yy, cfg.lane || '#e8e0a0'); }
        p.r(0, 160, GAP, 12, rd); for (let xx = 3; xx < GAP - 3; xx += 5) p.r(xx, 161, 3, 10, '#ecece4');
        p.r(0, 172, GAP, 2, rd);
        for (let yy = 176; yy < 199; yy += 4) p.r(3, yy, GAP - 6, 2, '#ecece4');
        p.r(GAP + 1, 187, 2, 12, '#f4f4ee'); p.r(-3 + 0, 175, 2, 11, '#f4f4ee');
      }
    });
  }
  // shops for chunk i (deterministic): returns [{x,w,kind,name}]
  function shopsIn(cfg, i) {
    const out = []; let x = cfg.cross && cfg.cross.includes(i) ? GAP : 0, j = 0;
    while (x < 240) { const r = hash(i * 17 + j, cfg.seed || 1), w = 40 + ((r * 4) | 0) * 10; const kinds = cfg.shops || ['cafe', 'books', 'grocery', 'bakery', 'flowers', 'conv']; out.push({ x: i * 240 + x + w - 14, w: 9, kind: kinds[(r * 53 | 0) % kinds.length], sx: i * 240 + x + 4, sw: w - 8 }); x += w + 1; j++; }
    return out;
  }
  return { REAL, TODS, WEATHERS, TOD_NAME, WEA_NAME, TONE, SKY, LM, ROOMS, F, SHOPKINDS, hash, mix, drawView, windowFrame, roomBack, streetChunk, shopsIn, layer, P, GAP };
})();
