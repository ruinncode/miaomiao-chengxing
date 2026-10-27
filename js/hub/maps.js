// Pixel maps (world + city) in a pastel "desktop window" look. Original art: every
// shape here is drawn in code (simple lon/lat outlines, icons from tiny bitmaps).
(function () {
  const K = window.TravelKit, T = K, SC = window.Scenery, SCN = K.SCN;
  const mix = SC.mix;
  // palettes: day = pastel lavender desktop, night = deep indigo with glowing lines
  const PAL = {
    day: { desk: '#b9c3ea', desk2: '#c7cff0', face: '#eceef9', hi: '#ffffff', lo: '#7a7ea6', ink: '#3a3a5a', t0: '#7b8be0', t1: '#a9c9f3', land: '#f1ead6', land2: '#e6dec6', water: '#9cc8e8', water2: '#b8daf0', park: '#b8dca0', park2: '#94c47e', road: '#ffffff', grid: '#e4dcc4', txt: '#3a3a5a', dim: '#7a7a9a', tip: '#fffbd6' },
    night: { desk: '#2a2d58', desk2: '#31346a', face: '#3b3f72', hi: '#6a70b0', lo: '#14163a', ink: '#e8e8ff', t0: '#5a3f9a', t1: '#3a5aa8', land: '#3e4270', land2: '#383c68', water: '#1e2a5a', water2: '#26346a', park: '#2e5a52', park2: '#264a44', road: '#5a5f94', grid: '#444878', txt: '#e8e8ff', dim: '#a0a6d0', tip: '#4a4f8a' },
  };
  const palOf = (tod) => tod === 'night' ? PAL.night : PAL.day;
  // ---- a pastel desktop window ----
  function win(R, x, y, w, h, title, P, o = {}) {
    R.rect(x + 3, y + 3, w, h, '#000', .25);
    R.rect(x, y, w, h, P.lo); R.rect(x, y, w - 1, h - 1, P.hi); R.rect(x + 1, y + 1, w - 2, h - 2, P.face);
    // title bar: two-tone dithered gradient
    const tb = 11; for (let i = 0; i < w - 4; i += 2) { const k = i / (w - 4); R.rect(x + 2 + i, y + 2, 2, tb, mix(P.t0, P.t1, k)); }
    if (o.icon) o.icon(x + 4, y + 3);
    R.text(title, x + (o.icon ? 15 : 5), y + 4, { c: '#ffffff', sh: true, shc: mix(P.t0, '#000', .45) });
    // _ □ × buttons (drawn only)
    for (let k = 0; k < 3; k++) { const bx = x + w - 12 - k * 10, by = y + 3; R.rect(bx, by, 9, 9, P.lo); R.rect(bx, by, 8, 8, P.hi); R.rect(bx + 1, by + 1, 7, 7, P.face);
      const c = P.ink; if (k === 2) R.rect(bx + 2, by + 6, 5, 1, c); else if (k === 1) { R.rect(bx + 2, by + 2, 5, 1, c); R.rect(bx + 2, by + 2, 1, 5, c); R.rect(bx + 6, by + 2, 1, 5, c); R.rect(bx + 2, by + 6, 5, 1, c); } else for (let q = 0; q < 5; q++) { R.rect(bx + 2 + q, by + 2 + q, 1, 1, c); R.rect(bx + 6 - q, by + 2 + q, 1, 1, c); } }
    return { x: x + 3, y: y + 2 + tb + 2, w: w - 6, h: h - tb - 7 };
  }
  // sunken well + raised button
  function well(R, x, y, w, h, P, fill) { R.rect(x - 1, y - 1, w + 2, h + 2, P.hi); R.rect(x - 1, y - 1, w + 1, h + 1, P.lo); R.rect(x, y, w, h, fill); }
  function wbtn(R, x, y, w, h, label, a, P, o = {}) {
    const on = !!o.on; R.rect(x, y, w, h, on ? P.hi : P.lo); R.rect(x, y, w - 1, h - 1, on ? P.lo : P.hi); R.rect(x + 1, y + 1, w - 2, h - 2, on ? mix(P.face, P.t1, .45) : P.face);
    if (label) R.text(label, x + w / 2, y + (h - 6) / 2, { al: 'c', c: P.txt, sh: false });
    if (a) R.hit(x, y, w, h, a, false);
  }
  // ---- tiny bitmaps (each char = palette key) ----
  const BM = {
    boat: ['....#....', '....##...', '....###..', '....####.', '....#....', 'ooooooooo', '.ooooooo.', '~~.~~.~~.'],
    train: ['.#######.', '#ccccccc#', '#c#c#c#c#', '#ccccccc#', '#########', '#y#####y#', '.#.....#.', 'o.......o'],
    tower: ['....#....', '....#....', '...###...', '...#c#...', '..#####..', '...#c#...', '..##c##..', '.###c###.', '#########'],
    barrel: ['..#####..', '.#ooooo#.', '#ooooooo#', '#########', '#ooooooo#', '#########', '#ooooooo#', '.#ooooo#.', '..#####..'],
    condo: ['...####..', '...#cc#..', '.###cc#..', '.#c##c###', '.#c#cc#c#', '.#c#cc#c#', '.#c#cc#c#', '#########'],
    pin: ['..###..', '.#ccc#.', '#ccccc#', '#ccccc#', '.#ccc#.', '..#c#..', '...#...'],
    plane: ['...#....', '...##...', '#..###..', '########', '#..###..', '...##...', '...#....'],
    hotel: ['#######', '#c#c#c#', '#######', '#c#c#c#', '#######', '##ooo##', '##o.o##'],
    // cat heads 8x7: k = fur, e = eyes, s = scarf/collar, b = tag/bell, t = stripes
    cat0: ['k......k', 'kk....kk', 'kkkkkkkk', 'kekkkkek', 'kkkkkkkk', '.ssssss.', '...bb...'],
    cat1: ['k......k', 'kk....kk', 'ktktktkk', 'kekkkkek', 'kkkttkkk', '.ssssss.', '...bb...'],
    cursor: ['#.......', '##......', '#w#.....', '#ww#....', '#www#...', '#wwww#..', '#wwwww#.', '#www####', '#w#w#...', '##.#w#..', '#..#w#..', '....##..'],
  };
  const CATPAL = [{ k: '#1e1e28', e: '#f3d25e', s: '#3fb3b8', b: '#d8dce6', t: '#1e1e28' }, { k: '#a87038', e: '#3a2a1a', s: '#f0c840', b: '#e8b830', t: '#6a4220' }];
  function bm(R, name, x, y, pal) { const rows = BM[name]; if (!rows) return; for (let j = 0; j < rows.length; j++) for (let i = 0; i < rows[j].length; i++) { const ch = rows[j][i]; if (ch === '.') continue; const c = pal[ch]; if (c) R.rect(x + i, y + j, 1, 1, c); } }
  const ICON_PAL = (P, c) => ({ '#': P.ink === '#e8e8ff' ? '#14163a' : '#3a3a5a', c: c || '#ffffff', o: '#d89a5a', y: '#f3c55e', '~': '#5a9ad8' });
  function catHead(R, i, x, y) { R.rect(x - 1, y + 1, 10, 7, '#000', .25); bm(R, 'cat' + i, x, y, CATPAL[i]); }
  function cursor(R, x, y) { bm(R, 'cursor', x, y, { '#': '#14163a', w: '#ffffff' }); }
  function thick(R, x0, y0, x1, y1, w, c) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0; for (let q = 0; q <= n; q++) { const t = q / (n || 1); R.rect(x0 + (x1 - x0) * t - (w >> 1), y0 + (y1 - y0) * t - (w >> 1), w, w, c); } }

  // =============== city map ===============
  const AREA_ICON = { waterfront: 'boat', union: 'train', bay: 'tower', distillery: 'barrel', yongeeg: 'condo' };
  function cityMap(R, s, cfg) {
    const tod = K.tod(s), P = palOf(tod), m = cfg.map || {}, night = tod === 'night';
    // desktop
    R.rect(0, 0, 480, 272, P.desk); for (let y = 15; y < 272; y += 2) for (let x = (y >> 1) % 2 * 2; x < 480; x += 4) R.rect(x, y, 1, 1, P.desk2);
    const wv = win(R, 4, 17, 308, 252, '🗺 ' + cfg.name + '.map · 喵喵地图', P);
    const X = wv.x + 2, Y = wv.y + 2, W = wv.w - 4, Hh = wv.h - 16, sx = (x) => X + x / 100 * W, sy = (y) => Y + y / 100 * Hh;
    well(R, X, Y, W, Hh, P, P.land);
    // cached terrain (land grid, water with wave pixels, parks with trees)
    const key = 'mapT:' + cfg.id + ':' + (night ? 'n' : 'd') + ':' + R.S;
    const terr = R.cache(key, W, Hh, (g) => {
      const f = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
      f(P.land, 0, 0, W, Hh);
      for (let y = 0; y < Hh; y += 8) f(P.grid, 0, y, W, 1); for (let x = 0; x < W; x += 8) f(P.grid, x, 0, 1, Hh);
      for (const w of m.water || []) { const wx = w[0] / 100 * W, wy = w[1] / 100 * Hh, ww = w[2] / 100 * W, wh = w[3] / 100 * Hh; f(P.water, wx, wy, ww, wh); f(P.land2, wx, wy, ww, 1);
        for (let yy = wy + 4; yy < wy + wh; yy += 6) for (let xx = wx + ((yy / 6) % 2) * 6; xx < wx + ww - 3; xx += 12) { f(P.water2, xx, yy, 3, 1); f(P.water2, xx + 3, yy - 1, 2, 1); } }
      for (const p of m.parks || []) { const px = p[0] / 100 * W, py = p[1] / 100 * Hh, pw = p[2] / 100 * W, ph = p[3] / 100 * Hh; f(P.park, px, py, pw, ph);
        for (let yy = py + 2; yy < py + ph - 2; yy += 4) for (let xx = px + 2 + ((yy / 4) % 2) * 2; xx < px + pw - 2; xx += 5) { f(P.park2, xx, yy, 2, 2); } }
      for (const r of m.roads || []) for (let k = 0; k < r.length - 1; k++) { const [x0, y0] = r[k], [x1, y1] = r[k + 1]; const n = Math.max(Math.abs(x1 - x0) / 100 * W, Math.abs(y1 - y0) / 100 * Hh) | 0; for (let q = 0; q <= n; q++) { const t = q / (n || 1); f(P.road, (x0 + (x1 - x0) * t) / 100 * W - 1, (y0 + (y1 - y0) * t) / 100 * Hh - 1, 2, 2); } }
    });
    R.blit(terr, X, Y);
    // water / place labels
    for (const l of m.labels || []) R.text(l[2], sx(l[0]), sy(l[1]), { c: night ? '#9ab0e0' : (l[3] || P.dim), sh: false });
    // transit lines: outline + colour (night = soft glow)
    const lines = cfg.lines.filter(ln => (m.lines || {})[ln.id]);
    for (const ln of lines) { const pts = m.lines[ln.id]; for (let k = 0; k < pts.length - 1; k++) thick(R, sx(pts[k][0]), sy(pts[k][1]), sx(pts[k + 1][0]), sy(pts[k + 1][1]), night ? 5 : 4, night ? mix(ln.color, '#000', .5) : '#ffffff'); }
    for (const ln of lines) { const pts = m.lines[ln.id]; for (let k = 0; k < pts.length - 1; k++) thick(R, sx(pts[k][0]), sy(pts[k][1]), sx(pts[k + 1][0]), sy(pts[k + 1][1]), 2, night ? mix(ln.color, '#fff', .2) : ln.color); }
    const stn = []; for (const ln of lines) for (const p of m.lines[ln.id]) if (p[2]) { const x = sx(p[0]), y = sy(p[1]); R.rect(x - 2, y - 2, 5, 5, P.ink === '#e8e8ff' ? '#14163a' : '#3a3a5a'); R.rect(x - 1, y - 1, 3, 3, '#ffffff');
      const tw = R.tw(p[2]); stn.push({ t: p[2], w: tw, x: Math.min(Math.max(x + 4, X + 1), X + W - tw - 2), y: Math.max(Y + 1, y - 9) }); }
    // area stickers: icon + tooltip label, labels laid out so they never overlap
    const cur = cfg.areas[s.mapI != null ? s.mapI : Math.max(0, cfg.areas.findIndex(x => x.id === s.area))];
    const items = cfg.areas.map(a => { const p = (m.areas || {})[a.id]; if (!p) return null; return { a, x: sx(p[0]), y: sy(p[1]), left: p[0] < 56 && p[1] > 50 }; }).filter(Boolean);
    const place = (grp) => { grp.sort((u, v) => u.y - v.y); let last = -99; for (const it of grp) { it.ly = Math.max(it.y - 4, last + 13); last = it.ly; } const over = last + 10 - (Y + Hh - 2); if (over > 0) grp.forEach(it => { it.ly -= over; }); };
    place(items.filter(i => i.left)); place(items.filter(i => !i.left));
    const boxes = items.map(it => { const tw = R.tw(it.a.name) + 6, lx = it.left ? it.x - 9 - tw - 6 : it.x + 9 + 6; return [Math.min(lx, it.x - 8), Math.min(it.ly, it.y - 8), Math.max(lx + tw, it.x + 8), Math.max(it.ly + 9, it.y + 15)]; });
    const hitBox = (l) => boxes.some(b => l.x < b[2] && l.x + l.w > b[0] && l.y < b[3] && l.y + 7 > b[1]);
    for (const l of stn) if (!hitBox(l)) { R.text(l.t, l.x, l.y, { c: P.dim, sh: false }); boxes.push([l.x - 2, l.y - 1, l.x + l.w + 2, l.y + 8]); }
    const h = K.hotel(s, cfg);
    for (const it of items) {
      const lab = it.a.name, tw = R.tw(lab) + 6, lx = it.left ? it.x - 9 - tw - 6 : it.x + 9 + 6, ly = it.ly, here = s.area === it.a.id, sel = cur && cur.id === it.a.id;
      // leader
      const ax = it.left ? lx + tw : lx, ay = ly + 4; thick(R, it.x + (it.left ? -6 : 6), it.y, ax, ay, 1, P.lo);
      // icon sticker
      R.rect(it.x - 7, it.y - 6, 15, 13, '#000', .2); R.rect(it.x - 7, it.y - 7, 14, 13, sel ? '#ffe9a0' : P.hi); R.rect(it.x - 6, it.y - 6, 12, 11, sel ? '#fff4c8' : (night ? '#5a5f94' : '#ffffff'));
      bm(R, AREA_ICON[it.a.id] || 'pin', it.x - 4, it.y - 4, ICON_PAL(P, '#cfe6ff'));
      // tooltip label
      R.rect(lx, ly, tw, 9, P.ink === '#e8e8ff' ? '#14163a' : '#3a3a5a'); R.rect(lx + 1, ly + 1, tw - 2, 7, sel ? '#ffe9a0' : P.tip);
      R.text(lab, lx + 3, ly + 1, { c: sel ? '#3a3a5a' : P.txt, sh: false });
      R.hit(Math.min(lx, it.x - 7), Math.min(ly, it.y - 7), Math.max(lx + tw, it.x + 8) - Math.min(lx, it.x - 7), 14, { k: 'goArea', id: it.a.id }, false);
      if (h && h.area === it.a.id) bm(R, 'hotel', it.x + 6, it.y - 12, ICON_PAL(P, '#f3c55e'));
      if (here) { const b = Math.floor(R.t * 3) % 2; catHead(R, 0, it.x - 9, it.y + 7 + b); catHead(R, 1, it.x + 1, it.y + 7 + (1 - b)); }
      if (sel) { const b = Math.floor(R.t * 4) % 2; cursor(R, it.x + 3 + b, it.y + 1 + b); }
    }
    // compass + scale
    const cx = X + W - 16, cy = Y + 14; R.rect(cx - 7, cy - 7, 15, 15, P.hi, .8); R.text('N', cx, cy - 6, { al: 'c', c: P.txt, sh: false }); R.rect(cx, cy + 1, 1, 5, P.txt);
    // status bar
    const sb = Y + Hh + 3; well(R, X, sb, W, 9, P, P.face);
    R.text('← → 选街区 · ↑ 过去 · ↓ 返回 · 点贴纸也行' + (night ? ' · 🌙 夜' : ''), X + 3, sb + 1, { c: P.txt, sh: false });
    // side window: legend + routes + buttons
    const sv = win(R, 316, 17, 160, 252, cfg.name + ' 交通.txt', P);
    let y = sv.y + 2; R.text('线路', sv.x + 2, y, { c: P.dim, sh: false }); y += 9;
    for (const ln of cfg.lines) { if (y > 104) break; R.rect(sv.x + 3, y + 1, 12, 5, '#ffffff'); R.rect(sv.x + 4, y + 2, 10, 3, ln.color); R.text(R.clip(ln.name, 134), sv.x + 19, y, { c: P.txt, sh: false }); y += 9; }
    y += 3; R.text('推荐路线', sv.x + 2, y, { c: P.dim, sh: false }); y += 9;
    (cfg.routes || []).forEach((r, i) => { if (y > 220) return; wbtn(R, sv.x + 2, y, sv.w - 4, 21, '', { k: 'route', i }, P); R.text(R.clip(r.name, sv.w - 12), sv.x + 6, y + 3, { c: P.txt, sh: false }); R.text(R.clip(r.desc, sv.w - 12), sv.x + 6, y + 12, { c: P.dim, sh: false }); y += 23; });
    wbtn(R, sv.x + 2, sv.y + sv.h - 15, 74, 14, '🏨 回酒店', { k: 'taxi' }, P); wbtn(R, sv.x + 80, sv.y + sv.h - 15, sv.w - 82, 14, '换城市', { k: 'pickCity' }, P);
    R.topBar(cfg.name + ' · 地图'); K.toast(R, s);
  }
  SCN.map.draw = function (R, s, cfg) { cityMap(R, s, cfg); };

  // =============== world map ===============
  // hand-traced, very rough continent outlines (lon, lat) — just enough for a pixel map
  const LAND = [
    [[-165, 68], [-140, 70], [-100, 72], [-80, 72], [-62, 62], [-55, 50], [-67, 45], [-75, 38], [-80, 31], [-81, 25], [-88, 30], [-97, 27], [-97, 20], [-88, 15], [-83, 9], [-79, 8], [-92, 15], [-105, 20], [-112, 30], [-118, 34], [-124, 40], [-125, 48], [-133, 56], [-150, 60], [-165, 60]],
    [[-60, 80], [-20, 82], [-20, 70], [-45, 60], [-55, 66]],
    [[-80, 10], [-60, 10], [-50, 0], [-35, -6], [-40, -22], [-48, -28], [-58, -38], [-65, -42], [-68, -55], [-74, -50], [-72, -30], [-70, -18], [-81, -5]],
    [[-10, 36], [-9, 43], [-2, 44], [-5, 48], [3, 51], [8, 54], [5, 58], [10, 64], [18, 70], [30, 71], [42, 68], [42, 45], [28, 41], [25, 36], [15, 38], [12, 44], [3, 42]],
    [[-6, 50], [2, 51], [0, 58], [-5, 58]],
    [[-17, 15], [-10, 30], [-5, 36], [10, 37], [32, 31], [35, 28], [43, 12], [51, 12], [40, -2], [40, -15], [32, -28], [20, -35], [15, -25], [12, -5], [8, 4], [-8, 5]],
    [[40, 45], [42, 68], [60, 70], [80, 73], [110, 77], [140, 72], [180, 68], [178, 62], [160, 60], [142, 52], [135, 43], [122, 40], [121, 30], [110, 20], [106, 10], [100, 13], [98, 8], [92, 22], [88, 22], [80, 10], [72, 20], [66, 25], [57, 25], [55, 17], [43, 12], [35, 28], [36, 36], [28, 41]],
    [[130, 32], [141, 36], [142, 42], [140, 44], [136, 36]],
    [[95, 5], [106, -6], [120, -9], [140, -8], [130, 0], [118, 5]],
    [[114, -22], [130, -12], [142, -11], [153, -27], [150, -37], [140, -38], [130, -32], [115, -34]],
  ];
  const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; };
  const GEO = { toronto: [-79.4, 43.7], waterloo: [-80.5, 43.5] };
  function worldMap(R, s) {
    const P = palOf(K.tod ? K.tod(s) : 'day'), night = P === PAL.night;
    R.rect(0, 0, 480, 272, '#000', .45); R.hit(0, 0, 480, 272, { k: 'dmapX' });
    const wv = win(R, 24, 20, 432, 240, '🌏 世界地图.exe · 喵喵航线', P);
    const X = wv.x + 2, Y = wv.y + 2, W = wv.w - 4, Hh = wv.h - 18, LA0 = 80, LA1 = -56;
    const sx = (lo) => X + (lo + 180) / 360 * W, sy = (la) => Y + (LA0 - la) / (LA0 - LA1) * Hh;
    well(R, X, Y, W, Hh, P, P.water);
    const key = 'wmap:' + (night ? 'n' : 'd') + ':' + W + 'x' + Hh;
    const terr = R.cache(key, W, Hh, (g) => {
      const f = (c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); }, CELL = 3;
      f(P.water, 0, 0, W, Hh);
      for (let y = 0; y < Hh; y += 6) for (let x = ((y / 6) % 2) * 6; x < W; x += 12) f(P.water2, x, y, 3, 1);
      for (let y = 0; y < Hh; y += CELL) for (let x = 0; x < W; x += CELL) {
        const lo = (x + CELL / 2) / W * 360 - 180, la = LA0 - (y + CELL / 2) / Hh * (LA0 - LA1);
        if (LAND.some(p => inPoly(lo, la, p))) { f(((x / CELL + y / CELL) % 7 === 0) ? P.land2 : (night ? '#4a5a7a' : '#c8e0a8'), x, y, CELL, CELL); }
      }
      // graticule
      for (let lo = -150; lo <= 150; lo += 30) for (let y = 0; y < Hh; y += 4) f(night ? '#3a4a8a' : '#d8e8f8', (lo + 180) / 360 * W, y, 1, 1);
      for (let la = -30; la <= 60; la += 30) for (let x = 0; x < W; x += 4) f(night ? '#3a4a8a' : '#d8e8f8', x, (LA0 - la) / (LA0 - LA1) * Hh, 1, 1);
    });
    R.blit(terr, X, Y);
    // the cats' home + dotted flight loops (decorative), and pins for the ready destinations
    const ds = Cities.LIST.filter(c => c.ready && c.board);
    const t = R.t;
    ds.forEach((c, i) => {
      const g = GEO[c.id]; if (!g) return; const x = sx(g[0]), y = sy(g[1]);
      for (let k = 0; k < 18; k++) { const a = k / 18 * Math.PI * 2 + t * .6; if (k % 2) continue; R.rect(x + Math.cos(a) * 30, y + Math.sin(a) * 12, 1, 1, night ? '#f3c55e' : '#5a6ab8'); }
      bm(R, 'pin', x - 3, y - 7, ICON_PAL(P, '#f3a65e'));
      const lab = c.name + ' ' + (c.local || ''), tw = R.tw(lab) + 6, lx = x + 10, ly = y - 18;
      R.rect(lx, ly, tw, 9, '#3a3a5a'); R.rect(lx + 1, ly + 1, tw - 2, 7, '#ffe9a0'); R.text(lab, lx + 3, ly + 1, { c: '#3a3a5a', sh: false });
      R.hit(lx, ly, tw, 9, { k: 'dest', id: c.id }, false);
      const b = Math.floor(t * 3) % 2; catHead(R, 0, x - 10, y + 2 + b); catHead(R, 1, x + 1, y + 2 + 1 - b);
      const pa = (t * .08) % 1, px = x + 30 * Math.cos(pa * Math.PI * 2), py = y + 12 * Math.sin(pa * Math.PI * 2); bm(R, 'plane', px - 4, py - 3, ICON_PAL(P, '#ffffff'));
    });
    // "more coming" sticker in the Pacific
    const nx = sx(-170), ny = sy(-20); R.rect(nx, ny, 92, 22, '#3a3a5a'); R.rect(nx + 1, ny + 1, 90, 20, P.tip);
    R.text('更多目的地', nx + 46, ny + 3, { al: 'c', c: P.txt, sh: false }); R.text('敬请期待 ✈', nx + 46, ny + 12, { al: 'c', c: P.dim, sh: false });
    const sb = Y + Hh + 3; well(R, X, sb, W, 9, P, P.face);
    R.text('点 多伦多 直接选它 · 按 ↑ / ↓ 或点空白处关上地图', X + 3, sb + 1, { c: P.txt, sh: false });
  }
  T.worldMap = worldMap;
  // remember which pins exist (for tests)
  T.MAPS = { GEO, AREA_ICON };
})();
