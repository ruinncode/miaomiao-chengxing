// TrainView — atmospheric moving-window scenery for train / streetcar rides.
// Layered parallax silhouettes, dusk/night gradients, glowing windows & neon,
// passing poles, rain on the glass and a soft interior reflection.
// Original pixel art drawn procedurally (no external assets). Reusable for any city:
// pass o.city = 'toronto' to get the CN Tower on the skyline; other ids get a generic skyline.
(function () {
  const PER = 960; // strip period in art px
  const cache = {};
  const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const PAL = {
    dawn:   { sky: ['#2c3566', '#4c4f86', '#7c6c9c', '#c28c98', '#eab49a', '#f6d2a2'], far: '#55507e', mid: '#34345e', near: '#1c1d38', lit: '#ffd890', glass: '#c8d8f0', water: ['#5a5a8a', '#7a6a90', '#b08a94'], glow: .5 },
    day:    { sky: ['#4f8fd2', '#66a2da', '#80b4e2', '#9cc6ea', '#bcd8ee', '#d8e8f2'], far: '#a4bad0', mid: '#7088a2', near: '#3c4c5e', lit: '#e4eef8', glass: '#d8ecf8', water: ['#3a78b4', '#4a8cc4', '#7aaed6'], glow: 0 },
    golden: { sky: ['#272858', '#3e3270', '#6c3e78', '#b05a6c', '#e4825a', '#f6b25e'], far: '#5e3e6e', mid: '#3a2a52', near: '#1c1632', lit: '#ffc86e', glass: '#ffd8a8', water: ['#4a3a6a', '#8a4e6a', '#d8845a'], glow: .7 },
    night:  { sky: ['#080a20', '#0e1230', '#15183e', '#1e1f4c', '#2a2858', '#3a3066'], far: '#2a2c62', mid: '#15173e', near: '#09091c', lit: '#ffd27a', glass: '#8aa0d8', water: ['#0a0e2a', '#10163a', '#1a1e48'], glow: 1 },
  };
  const NEON = ['#5ae8e0', '#ffb24a', '#9a8aff', '#7aff9a', '#ff7a5a'];
  const mixc = (a, b, k) => { const p = (c) => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const A = p(a), B = p(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join(''); };
  function pal(tod, wea) {
    const P = PAL[tod] || PAL.night; if (wea !== 'rain' && wea !== 'fog' && wea !== 'snow') return P;
    const k = tod === 'night' ? '#141826' : '#7a8496', f = wea === 'fog' ? .55 : .4;
    return Object.assign({}, P, { sky: P.sky.map(c => mixc(c, k, f)), far: mixc(P.far, k, f * .8), water: P.water.map(c => mixc(c, k, f)), wet: 1 });
  }
  function cv(key, w, h, fn) { let c = cache[key]; if (c) return c; c = cache[key] = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; const r = (x, y, ww, hh, col, a) => { g.globalAlpha = a == null ? 1 : a; g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh)); g.globalAlpha = 1; }; fn(r, g); return c; }
  // blit a periodic strip with wrap-around
  function strip(R, c, X, Y, W, off) { const o = ((Math.round(off) % PER) + PER) % PER; R.blit(c, X - o, Y); if (PER - o < W) R.blit(c, X - o + PER, Y); }

  function sky(R, X, Y, W, H, P, tod, wea, t) {
    const c = cv(`tv:sky:${tod}:${wea}:${W}:${H}`, W, H, (r, g) => {
      const n = P.sky.length, bh = H / n;
      for (let i = 0; i < n; i++) { r(0, i * bh, W, bh + 1, P.sky[i]); if (i < n - 1) { const yy = Math.round((i + 1) * bh) - 2; for (let x = 0; x < W; x += 2) { r(x + ((x >> 1) & 1), yy, 1, 1, P.sky[i + 1]); r(x + 1 - ((x >> 1) & 1), yy + 1, 1, 1, P.sky[i + 1]); } } }
      if (tod === 'night' && !P.wet) for (let i = 0; i < W * H / 170; i++) r(hash(i, 1) * W, hash(i, 2) * H * .55, 1, 1, hash(i, 3) < .2 ? '#ffffff' : '#8a96d0');
    });
    R.blit(c, X, Y);
    if (!P.wet) { // moon / sun, slowly drifting (they are "very far away")
      const sx = X + W * .74, sy = Y + H * ({ dawn: .5, day: .14, golden: .46, night: .16 }[tod] || .2);
      if (tod === 'night') { R.rect(sx - 4, sy - 5, 9, 10, '#f2ecd0'); R.rect(sx - 5, sy - 3, 11, 6, '#f2ecd0'); R.rect(sx - 1, sy - 4, 6, 7, P.sky[1]); R.rect(sx - 10, sy - 10, 20, 20, '#f2ecd0', .06); }
      else { const c2 = tod === 'day' ? '#fff6d0' : '#ffd890'; R.rect(sx - 14, sy - 14, 28, 28, c2, .1); R.rect(sx - 9, sy - 9, 18, 18, c2, .18); R.rect(sx - 5, sy - 6, 10, 12, c2); R.rect(sx - 6, sy - 5, 12, 10, c2); }
    }
  }
  // far skyline (+ CN Tower for Toronto)
  function far(R, X, Y, W, H, P, tod, city, off, base) {
    const c = cv(`tv:far:${tod}:${P.wet ? 1 : 0}:${city}:${H}:${base}`, PER, H, (r) => {
      let x = 0, i = 0; while (x < PER) { const w = 8 + hash(i, 11) * 16, h = 10 + hash(i, 12) * hash(i, 13) * 44 + (x > 200 && x < 420 ? 16 : 0); r(x, base - h, w, h + 2, P.far); if (hash(i, 14) < .3) r(x + w / 2 - 1, base - h - 4, 1, 4, P.far); if (P.glow) for (let k = 0; k < h * w / 40; k++) if (hash(i * 7 + k, 15) < .2 + .3 * P.glow) r(x + 1 + hash(i, k) * (w - 2), base - h + 2 + hash(k, i) * (h - 4), 1, 1, P.lit, .5 + .3 * P.glow); x += w + (hash(i, 16) < .2 ? 6 : 0); i++; }

    });
    strip(R, c, X, Y, W, off);
    if (P.glow) { R.rect(X, Y + base - 18, W, 18, P.lit, .05 * P.glow); R.rect(X, Y + base - 8, W, 8, P.lit, .06 * P.glow); } // city glow on the horizon
    if (city === 'toronto') { // CN Tower + dome, drawn on their own so they come round regularly
      const span = W + 160, cx = Math.round(X + ((((W * .78 + 80 - off * .4) % span) + span) % span) - 80), by = Y + base, cn = P.glow ? mixc(P.far, '#6a6aa8', .25) : mixc(P.far, '#000000', .12);
      const k = Math.min(1, (base - 4) / 112), Y_ = (v) => Math.round(by - v * k), HH = (v) => Math.max(1, Math.round(v * k));
      R.rect(cx - 3, Y_(64), 6, HH(64), cn); R.rect(cx - 2, Y_(80), 4, HH(16), cn); R.rect(cx - 1, Y_(112), 2, HH(32), cn); R.rect(cx - 5, Y_(22), 2, HH(22), cn); R.rect(cx + 3, Y_(22), 2, HH(22), cn);
      R.rect(cx - 8, Y_(84), 16, 3, cn); R.rect(cx - 7, Y_(84) + 3, 14, 3, cn); R.rect(cx - 5, Y_(84) + 6, 10, 1, cn); R.rect(cx - 3, Y_(96), 6, 3, cn);
      R.rect(cx - 7, Y_(84) + 2, 14, 1, P.glow ? P.lit : '#e8f0f8', P.glow ? .95 : .7); R.rect(cx - 2, Y_(96) + 1, 4, 1, P.glow ? P.lit : '#e8f0f8', P.glow ? .8 : .5);
      R.rect(cx + 18, by - 12, 34, 12, cn); for (let k = 0; k < 5; k++) R.rect(cx + 20 + k * 2, by - 13 - k, 30 - k * 4, 1, cn);
      if (P.glow) { R.rect(cx - 10, Y_(84) - 3, 20, 12, P.lit, .08); if ((R.t * 1.5 | 0) % 2) R.rect(cx - 1, Y_(112) - 1, 2, 2, '#ff4a4a'); for (let j = 0; j < 6; j++) R.rect(cx - 2, Y_(60) + j * Math.round(10 * k), 4, 1, ['#5ae8e0', '#9a8aff', '#ffb24a'][((R.t * 2 | 0) + j) % 3], .5); }
    }
  }
  // mid layer: towers with window grids and the odd neon sign
  function mid(R, X, Y, W, H, P, tod, off, base, street) {
    const c = cv(`tv:mid:${tod}:${P.wet ? 1 : 0}:${H}:${base}:${street ? 1 : 0}`, PER, H, (r) => {
      let x = 0, i = 0; while (x < PER) {
        const w = street ? 40 + hash(i, 21) * 40 : 22 + hash(i, 21) * 30, h = street ? 30 + hash(i, 22) * 34 : 22 + hash(i, 22) * 52, top = base - h;
        const body = street ? mixc(P.mid, ['#5a2e28', '#4a3a30', '#3a3a46'][i % 3], P.glow ? .25 : .5) : P.mid;
        r(x, top, w, h + 4, body); r(x, top, w, 1, mixc(body, '#ffffff', .12)); r(x + w - 2, top, 2, h + 4, mixc(body, '#000000', .25));
        if (street) { r(x - 1, top - 2, w + 2, 2, mixc(body, '#000000', .3)); } // cornice
        const cols = Math.floor((w - 4) / 5), rows = Math.floor((h - (street ? 14 : 4)) / 6);
        for (let a = 0; a < cols; a++) for (let b = 0; b < rows; b++) { const on = hash(i * 31 + a, b + 40) < (P.glow ? .42 : 0); r(x + 3 + a * 5, top + 3 + b * 6, 3, 3, on ? (hash(a, i + b) < .15 ? '#bfe8ff' : P.lit) : mixc(body, P.sky[3], .35)); }
        if (street) { // shop front with lit window + awning
          const aw = ['#2e6a7a', '#7a3a2a', '#3a5a2e', '#5a4a7a'][i % 4]; r(x + 2, base - 12, w - 4, 10, P.glow ? mixc(P.lit, '#000000', .2) : mixc(body, '#bcd8ee', .5)); r(x + 1, base - 15, w - 2, 3, aw); for (let k = 0; k < w - 2; k += 4) r(x + 1 + k, base - 12, 2, 1, aw);
        }
        if (hash(i, 23) < (street ? .5 : .22)) { const nc = NEON[i % NEON.length], ny = top + 4 + hash(i, 24) * Math.min(20, h - 10); r(x + 3, ny, Math.min(14, w - 6), 4, '#0c0c18'); r(x + 4, ny + 1, Math.min(12, w - 8), 2, nc); if (P.glow) r(x + 1, ny - 2, Math.min(18, w - 2), 8, nc, .14); }
        x += w + (street ? 0 : 2 + hash(i, 25) * 6); i++;
      }
    });
    strip(R, c, X, Y, W, off);
  }
  function near(R, X, Y, W, H, P, tod, off, street) {
    const c = cv(`tv:near:${tod}:${H}:${street ? 1 : 0}`, PER, H, (r) => {
      for (let x = 0; x < PER; x += 2) { const hh = street ? 0 : 6 + Math.round(4 * Math.sin(x * .05) + 3 * Math.sin(x * .13)); if (hh) r(x, H - hh, 2, hh, P.near); }
      if (!street) for (let i = 0; i < 12; i++) { const x = hash(i, 31) * PER, s = 8 + hash(i, 32) * 10; r(x - s / 2, H - 10 - s, s, s, P.near); r(x - s / 2 - 2, H - 8 - s * .6, s + 4, s * .6, P.near); r(x - 1, H - 12, 2, 12, P.near); }
      else for (let i = 0; i < 9; i++) { const x = hash(i, 33) * PER; r(x, H - 9, 22, 6, mixc(P.near, '#3a4a6a', .4)); r(x + 4, H - 13, 13, 5, mixc(P.near, '#3a4a6a', .3)); r(x + 2, H - 3, 4, 3, '#000000'); r(x + 15, H - 3, 4, 3, '#000000'); if (P.glow) r(x + 20, H - 8, 2, 2, '#ff5a4a'); }
      r(0, H - 3, PER, 3, mixc(P.near, '#000000', .3));
    });
    strip(R, c, X, Y, W, off);
  }
  function lake(R, X, Y, W, H, P, base, t, off) {
    const wy = Y + base, hh = H - base; R.rect(X, wy, W, hh, P.water[0]); R.rect(X, wy, W, 2, P.water[2], .6); R.rect(X, wy + 2, W, 3, P.water[1], .5);
    for (let i = 0; i < 46; i++) { const lx = X + (((hash(i, 41) * W * 1.5 - off * .3 + Math.sin(t * .8 + i) * 2) % W) + W) % W, ly = wy + 3 + hash(i, 42) * (hh - 6); R.rect(lx, ly, 2 + hash(i, 43) * 7, 1, P.glow && i % 3 === 0 ? P.lit : P.water[2], P.glow ? .55 : .4); }
    // sun / moon glitter column
    if (!P.wet) for (let k = 0; k < 6; k++) { const y = wy + 3 + k * (hh - 4) / 6; R.rect(X + W * .74 - 3 - k + Math.sin(t * 2 + k) * 2, y, 6 + k * 2, 1, P.lit, .5); }
  }
  function poles(R, X, Y, W, H, off, speed, P, dense) {
    const gap = dense ? 120 : 170, col = mixc(P.near, '#000000', .2);
    for (let i = -1; i < W / gap + 2; i++) { const x = X + ((i * gap - off) % gap + gap) % gap + Math.floor(i) * 0 - gap + i * 0; void x; }
    const o = ((off % gap) + gap) % gap; for (let x = -o; x < W + gap; x += gap) { const w = 3 + Math.round(speed * 7); R.rect(X + x, Y, w, H, col, speed > .4 ? .7 : 1); R.rect(X + x - 6, Y + 12, w + 12, 2, col, speed > .4 ? .6 : 1); if (P.glow) R.rect(X + x + w - 1, Y, 1, H, P.lit, .12); }
    R.rect(X, Y + 13, W, 1, col, .8); R.rect(X, Y + 20, W, 1, col, .5);
  }
  function glass(R, X, Y, W, H, P, wea, t, speed, under) {
    const ctx = R.ctx; // diagonal reflection streaks
    for (let i = 0; i < 3; i++) { const x0 = X + 40 + i * 170; for (let k = 0; k < H; k += 2) R.rect(x0 + k * .5, Y + k, 10 + i * 4, 2, '#ffffff', under ? .035 : .05); }
    if (under) { R.rect(X, Y + 8, W, 3, '#fff4d8', .05); for (const sx of [60, 320]) { R.rect(X + sx, Y + H - 34, 110, 18, '#ffffff', .04); R.rect(X + sx + 8, Y + H - 30, 22, 14, '#ffffff', .03); } }
    if (wea === 'rain') { // streaks pushed back by the airflow + clinging droplets
      for (let i = 0; i < 70; i++) { const x = X + ((hash(i, 51) * W * 3 + t * (40 + speed * 260)) % (W + 30)) - 15, y = Y + ((hash(i, 52) * H + t * (30 + 50 * hash(i, 53))) % H), len = 3 + speed * 10; for (let k = 0; k < len; k += 1) R.rect(x - k, y + k * (.6 - speed * .45), 1, 1, P.glass, .35 - k / len * .3); }
      for (let i = 0; i < 26; i++) R.rect(X + hash(i, 54) * W, Y + hash(i, 55) * H, 1, 2, P.glass, .5);
    }
    if (wea === 'snow') for (let i = 0; i < 40; i++) { const x = X + ((hash(i, 56) * W * 2 - t * (10 + speed * 200)) % W + W) % W, y = Y + ((hash(i, 57) * H + t * 12) % H); R.rect(x, y, speed > .5 ? 3 : 1, 1, '#ffffff', .8); }
    if (wea === 'fog') R.rect(X, Y, W, H, '#c8ccd8', .18);
    R.rect(X, Y, W, 4, '#000000', .18); R.rect(X, Y + H - 4, W, 4, '#000000', .18); // vignette
    void ctx;
  }
  function tunnel(R, X, Y, W, H, rx, speed, t, o) {
    const ctx = R.ctx; R.rect(X, Y, W, H, '#07080f'); R.rect(X, Y + H * .55, W, H * .45, '#0b0c16'); R.rect(X, Y + H - 18, W, 18, '#0e0f1a');
    // ribs and cable bundles
    const rib = 48, o1 = ((rx * 3) % rib + rib) % rib; for (let x = -o1; x < W; x += rib) R.rect(X + x, Y, 2 + speed * 10, H, '#12131f', .9);
    for (const [cy, c] of [[22, '#1a1c2a'], [26, '#22242e'], [29, '#16171f']]) R.rect(X, Y + cy, W, 2, c);
    // lamps: warm streaks that stretch with speed + glow on the wall
    const gap = 150, o2 = ((rx * 2.4) % gap + gap) % gap; for (let x = -o2; x < W + gap; x += gap) { const len = 4 + speed * 60; R.rect(X + x - 20, Y + 18, len + 40, 26, '#ffcf7a', .05 + .03 * (1 - speed)); R.rect(X + x - 6, Y + 26, len + 12, 10, '#ffcf7a', .1); R.rect(X + x, Y + 30, len, 2, '#ffe9b0'); }
    // signal lights
    const g3 = 420, o3 = ((rx * 2.4 + 200) % g3 + g3) % g3; for (let x = -o3; x < W + g3; x += g3) { R.rect(X + x, Y + 70, 3, 3, (t * 2 | 0) % 3 ? '#4aff8a' : '#2a8a4a'); R.rect(X + x - 3, Y + 67, 9, 9, '#4aff8a', .12); R.rect(X + x + 1, Y + 73, 1, 30, '#1a1c26'); }
    // approaching a station: light floods in
    if (o.near > 0) { R.rect(X, Y, W, H, o.wall || '#c8c0a8', Math.min(.35, o.near * .35)); }
  }

  // public: draw the full window band
  function draw(R, X, Y, W, H, o) {
    const tod = o.tod || 'night', wea = o.wea || 'clear', t = o.t || 0, rx = o.rx || 0, speed = o.speed || 0, P = pal(tod, wea);
    const ctx = R.ctx, S = R.S; ctx.save(); ctx.beginPath(); ctx.rect(X * S, Y * S, W * S, H * S); ctx.clip();
    if (o.under) tunnel(R, X, Y, W, H, rx, speed, t, o);
    else {
      const street = !!o.street && !o.lake, base = o.lake ? Math.round(H * .62) : street ? H - 6 : Math.round(H * .8);
      sky(R, X, Y, W, H, P, tod, wea, t);
      far(R, X, Y, W, H, P, tod, o.city || '', rx * .05, street ? H - 40 : base);
      if (o.lake) lake(R, X, Y, W, H, P, base, t, rx);
      else { mid(R, X, Y, W, H, P, tod, rx * (street ? .9 : .3), street ? H - 4 : base + 6, street); if (!street) near(R, X, Y, W, H, P, tod, rx * 1.1, false); }
      if (o.lake) near(R, X, Y, W, H, P, tod, rx * 1.1, false);
      if (street || (o.lake && o.street)) near(R, X, Y, W, H, P, tod, rx * 1.6, true);
      if (o.poles !== false) poles(R, X, Y, W, H, rx * 2.2, speed, P, !!o.street);
      if (P.glow && wea === 'rain') R.rect(X, Y + H - 10, W, 10, P.lit, .06); // wet glow
    }
    glass(R, X, Y, W, H, P, wea, t, speed, o.under);
    ctx.restore();
  }
  window.TrainView = { draw, PAL };
})();
