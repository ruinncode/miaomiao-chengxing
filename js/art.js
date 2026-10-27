// ============================================================
//  Art — pixel art drawn in code (no image files).
//  Everything is drawn at 1x on small canvases and shown at 2x
//  with nearest-neighbour scaling (Phaser pixelArt: true).
// ============================================================
window.Art = (function () {
  const PX = 2; // on-screen size of one art pixel

  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, w, h);
    const ctx = t.getContext();
    ctx.imageSmoothingEnabled = false;
    const px = (x, y, c, a = 1) => { if (c == null) return; ctx.globalAlpha = a; ctx.fillStyle = typeof c === 'number' ? hex(c) : c; ctx.fillRect(x, y, 1, 1); ctx.globalAlpha = 1; };
    const rect = (x, y, ww, hh, c) => { ctx.fillStyle = typeof c === 'number' ? hex(c) : c; ctx.fillRect(x, y, ww, hh); };
    draw({ ctx, px, rect, w, h });
    t.refresh();
    return t;
  }
  // build a sprite from string rows + palette
  function rowsTex(scene, key, rows, pal) {
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    canvasTex(scene, key, w, h, ({ px }) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch] != null) px(x, y, pal[ch]); })));
  }
  // pixel grid helper with auto-outline
  function grid(w, h) {
    const g = Array.from({ length: h }, () => Array(w).fill(null));
    return {
      g, w, h,
      set(x, y, c) { if (x >= 0 && y >= 0 && x < w && y < h) g[y][x] = c; },
      get(x, y) { return (x >= 0 && y >= 0 && x < w && y < h) ? g[y][x] : null; },
      outline(c) {
        const add = [];
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (g[y][x] == null &&
          [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) != null && this.get(x + dx, y + dy) !== c)) add.push([x, y]);
        add.forEach(([x, y]) => g[y][x] = c);
      },
      toTex(scene, key) { canvasTex(scene, key, w, h, ({ px }) => { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px(x, y, g[y][x]); }); },
    };
  }
  const hash = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

  // ---------------- cats ----------------
  const CATS = [
    { key: 'cat0', body: 0x2f2a45, hi: 0x4d4672, shade: null, outline: 0x15111f, eye: 0xffd93b, lid: 0x8f86bd, blush: 0xd9587d,
      bow: 0xe8404f, bowDark: 0x9e1f35, bowAt: 'neck' },
    { key: 'cat1', body: 0xfffbf6, hi: null, shade: 0xe3d7ee, outline: 0x7d6c9e, eye: 0x2e2742, lid: 0x2e2742, blush: 0xffa9c4,
      bow: 0xff7fb0, bowDark: 0xd24f87, bowAt: 'head' },
  ];
  const PINK = 0xff8fb1;

  // frame: {legs:'stand'|'walkA'|'walkB'|'jump', bob, tail:0|1|2|3, eyes:'open'|'blink'|'happy'}
  function drawCat(c, f) {
    const G = grid(20, 16);
    const B = c.body, yo = f.bob || 0;
    // tail
    const tails = [
      [[2, 10], [1, 9], [1, 8], [1, 7], [2, 6], [3, 6]],
      [[2, 10], [1, 9], [0, 8], [0, 7], [0, 6], [1, 5]],
      [[2, 10], [1, 10], [0, 9], [0, 8], [1, 7]],
      [[2, 10], [1, 11], [0, 11], [0, 12]],
    ][f.tail || 0];
    tails.forEach(([x, y]) => G.set(x, y + yo, B));
    // legs
    const L = { stand: [[4, 0], [6, 0], [10, 0], [12, 0]], walkA: [[3, 1], [6, 0], [10, 0], [13, 1]], walkB: [[5, 0], [6, 1], [11, 1], [12, 0]],
      jump: [[3, 1], [5, 1], [12, 1], [14, 1]] }[f.legs || 'stand'];
    L.forEach(([x, lift]) => { for (let y = 12; y <= 14 - lift; y++) G.set(x, y, B); });
    // body
    for (let y = 7; y <= 13; y++) for (let x = 1; x <= 15; x++)
      if (((x - 8) / 5.8) ** 2 + ((y - 10.4) / 2.7) ** 2 <= 1) G.set(x, y + yo, B);
    // head
    for (let y = 1; y <= 11; y++) for (let x = 8; x <= 19; x++)
      if (((x - 13.5) / 4.7) ** 2 + ((y - 6.3) / 3.8) ** 2 <= 1) G.set(x, y + yo, B);
    // ears
    [[10, 0], [10, 1], [11, 1], [10, 2], [11, 2], [12, 2], [17, 0], [16, 1], [17, 1], [15, 2], [16, 2], [17, 2]].forEach(([x, y]) => G.set(x, y + yo, B));
    // shading / highlight
    const snap = G.g.map(r => r.slice());
    for (let y = 0; y < 16; y++) for (let x = 0; x < 20; x++) if (snap[y][x] === B) {
      if (c.shade && (y + 1 >= 16 || snap[y + 1][x] == null) && y > 4) G.set(x, y, c.shade);
      if (c.hi && (y - 1 < 0 || snap[y - 1][x] == null) && x > 8) G.set(x, y, c.hi);
    }
    G.set(10, 1 + yo, PINK); G.set(17, 1 + yo, PINK);
    // face
    const ey = 6 + yo;
    if (f.eyes === 'blink') { [11, 12, 15, 16].forEach(x => G.set(x, ey + 1, c.lid)); }
    else if (f.eyes === 'happy') { [[11, 1], [12, 0], [13, 1], [14, 1], [15, 0], [16, 1]].forEach(([x, d]) => G.set(x, ey + d, c.lid)); }
    else { G.set(12, ey, c.eye); G.set(12, ey + 1, c.eye); G.set(15, ey, c.eye); G.set(15, ey + 1, c.eye);
      if (c.key === 'cat0') { G.set(12, ey + 1, 0x15111f); G.set(15, ey + 1, 0x15111f); } else { G.set(12, ey, 0xffffff); G.set(15, ey, 0xffffff); } }
    G.set(13, 8 + yo, PINK); G.set(14, 8 + yo, PINK);
    G.set(11, 9 + yo, c.blush); G.set(16, 9 + yo, c.blush);
    // bow
    if (c.bowAt === 'neck') {
      [[8, 9], [8, 10], [8, 11], [10, 9], [10, 10], [10, 11]].forEach(([x, y]) => G.set(x, y + yo, c.bow));
      G.set(9, 10 + yo, c.bowDark); G.set(9, 12 + yo, c.bow); G.set(10, 12 + yo, c.bowDark);
    } else {
      [[12, 0], [12, 1], [12, 2], [14, 0], [14, 1], [14, 2]].forEach(([x, y]) => G.set(x, y + yo, c.bow));
      G.set(13, 1 + yo, c.bowDark);
    }
    G.outline(c.outline);
    return G;
  }
  const CAT_FRAMES = {
    idle0: { tail: 0 }, idle1: { tail: 1 }, blink: { tail: 0, eyes: 'blink' },
    walk0: { legs: 'walkA', tail: 2 }, walk1: { legs: 'stand', tail: 2, bob: -1 }, walk2: { legs: 'walkB', tail: 1 }, walk3: { legs: 'stand', tail: 1, bob: -1 },
    jump: { legs: 'jump', tail: 3, bob: -1 }, happy: { eyes: 'happy', tail: 1, bob: -1 }, happy2: { eyes: 'happy', tail: 0 },
    dizzy: { eyes: 'blink', legs: 'jump', tail: 3 },
  };

  // ---------------- themes ----------------
  const THEMES = {
    garden: { fill: [0xc9a27e, 0xb68b66, 0xd6b28d], top: [0x8fdc8f, 0x6fc07a, 0xb6ef9f], plank: [0xe8bf8f, 0xb98a5f], name: 'garden' },
    room:   { fill: [0xe8b98a, 0xcf9a6c, 0xf0c79c], top: [0xf6a5c0, 0xe07ea2, 0xffd0e0], plank: [0xd9a77a, 0x9e6e48], name: 'room' },
    roof:   { fill: [0xb57a96, 0x9a6280, 0xc88ea8], top: [0xf2b6c8, 0xd98aa6, 0xffe0ea], plank: [0xbab1d6, 0x7f76a6], name: 'roof' },
  };

  function buildTheme(scene, name) {
    const th = THEMES[name];
    // ground fill
    canvasTex(scene, `t_${name}_fill`, 16, 16, ({ px, rect }) => {
      rect(0, 0, 16, 16, th.fill[0]);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const h = hash(x, y, name.length);
        if (name === 'room' && (y === 7 || y === 15 || (x === ((y < 8) ? 4 : 11)))) px(x, y, th.fill[1]);
        else if (name === 'roof' && (y % 5 === 4 || ((x + (Math.floor(y / 5) % 2) * 4) % 8 === 0))) px(x, y, th.fill[1]);
        else if (h > 0.9) px(x, y, th.fill[1]); else if (h < 0.06) px(x, y, th.fill[2]);
      }
    });
    // ground top
    canvasTex(scene, `t_${name}_top`, 16, 16, ({ px, rect }) => {
      rect(0, 0, 16, 16, th.fill[0]);
      for (let y = 4; y < 16; y++) for (let x = 0; x < 16; x++) { const h = hash(x, y, 3); if (h > 0.9) px(x, y, th.fill[1]); else if (h < 0.06) px(x, y, th.fill[2]); }
      rect(0, 0, 16, 4, th.top[0]); rect(0, 0, 16, 1, th.top[2]);
      for (let x = 0; x < 16; x++) { const d = (x * 7) % 5 < 2 ? 5 : 4; for (let y = 4; y < d; y++) px(x, y, th.top[1]); if (d === 4) px(x, 4, th.top[1]); }
      if (name === 'garden') { px(3, 0, 0xff8fb1); px(11, 0, 0xfff07a); }
      if (name === 'room') { for (let x = 1; x < 16; x += 3) px(x, 2, 0xffffff); }
    });
    // one-way plank
    canvasTex(scene, `t_${name}_plank`, 16, 8, ({ px, rect }) => {
      rect(0, 0, 16, 5, th.plank[0]); rect(0, 5, 16, 1, th.plank[1]);
      rect(0, 0, 16, 1, 0xffffff); px(0, 0, th.plank[0]); px(15, 0, th.plank[0]);
      px(5, 2, th.plank[1]); px(12, 3, th.plank[1]);
      rect(2, 6, 1, 2, th.plank[1]); rect(13, 6, 1, 2, th.plank[1]);
    });
    // background (480x272, shown at 2x)
    canvasTex(scene, `bg_${name}`, 480, 272, ({ px, rect, ctx }) => {
      if (name === 'garden') {
        const bands = [0xbfe6ff, 0xcdeaff, 0xdcefff, 0xeaf0ff, 0xf7eefa, 0xffe6f0];
        bands.forEach((c, i) => rect(0, i * 34, 480, 34, c));
        for (let i = 0; i < bands.length - 1; i++) for (let x = 0; x < 480; x += 2) px(x + (i % 2), (i + 1) * 34 - 1, bands[i + 1]);
        rect(0, 204, 480, 68, 0xffe6f0);
        cloud(px, 60, 40); cloud(px, 300, 26); cloud(px, 400, 70);
        // sun
        for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) if (x * x + y * y <= 100) px(420 + x, 30 + y, x * x + y * y > 70 ? 0xffe9a8 : 0xfff6c8);
        // hills
        for (let x = 0; x < 480; x++) {
          const h1 = 190 + Math.round(Math.sin(x / 40) * 10 + Math.sin(x / 13) * 3);
          for (let y = h1; y < 272; y++) px(x, y, y === h1 ? 0xc8f2c8 : 0xa8e6b8);
          const h2 = 220 + Math.round(Math.sin(x / 25 + 2) * 7);
          for (let y = h2; y < 272; y++) px(x, y, y === h2 ? 0xa8e6b8 : 0x8fd6a4);
        }
        for (let i = 0; i < 40; i++) { const x = Math.floor(hash(i, 1) * 480), y = 228 + Math.floor(hash(i, 2) * 40); px(x, y, [0xff8fb1, 0xfff07a, 0xffffff][i % 3]); px(x, y + 1, 0x6fc07a); }
      } else if (name === 'room') {
        rect(0, 0, 480, 272, 0xfde3ec);
        for (let x = 0; x < 480; x += 16) rect(x, 0, 6, 272, 0xf9d4e2);
        for (let y = 8; y < 272; y += 24) for (let x = 11; x < 480; x += 32) { px(x, y, 0xf4b3cb); px(x - 1, y - 1, 0xf4b3cb); px(x + 1, y - 1, 0xf4b3cb); }
        // window
        rect(60, 40, 84, 70, 0xb07a5a); rect(64, 44, 76, 62, 0xbfe6ff); rect(64, 80, 76, 26, 0xdff1ff);
        rect(100, 44, 4, 62, 0xb07a5a); rect(64, 72, 76, 4, 0xb07a5a);
        cloud(px, 70, 52); for (let i = 0; i < 6; i++) { px(115 + i * 3, 90 - i, 0xffffff); }
        rect(56, 108, 92, 6, 0xd9a77a);
        // curtains
        rect(48, 34, 14, 84, 0xf6a5c0); rect(142, 34, 14, 84, 0xf6a5c0); rect(46, 30, 112, 6, 0xe07ea2);
        // frames
        rect(330, 50, 50, 40, 0xc99566); rect(334, 54, 42, 32, 0xfff4e6);
        heart(px, 349, 64, 0xff7fa8);
        rect(400, 60, 30, 30, 0xc99566); rect(403, 63, 24, 24, 0xd8f0ff); fish(px, 409, 72);
        // lamp
        rect(240, 0, 2, 30, 0x9e6e48); rect(228, 30, 26, 10, 0xfff0a8); rect(226, 40, 30, 2, 0xf0d070);
        // plant
        rect(440, 190, 20, 20, 0xe07ea2); rect(442, 186, 16, 4, 0xf6a5c0);
        for (let i = 0; i < 9; i++) { px(450 + Math.round(Math.sin(i) * 6), 184 - i * 2, 0x6fc07a); px(451 + Math.round(Math.cos(i) * 5), 183 - i * 2, 0x8fdc8f); }
      } else {
        const bands = [0x3b3265, 0x4a3a75, 0x6a4a8a, 0x8a5a9e, 0xb46aa6, 0xe08aaa, 0xf6b0b8, 0xffd2b8];
        bands.forEach((c, i) => rect(0, i * 26, 480, 26, c));
        for (let i = 0; i < bands.length - 1; i++) for (let x = 0; x < 480; x += 2) { px(x + (i % 2), (i + 1) * 26 - 1, bands[i + 1]); px(x + ((i + 1) % 2), (i + 1) * 26, bands[i]); }
        rect(0, 208, 480, 64, 0xffd2b8);
        for (let i = 0; i < 70; i++) { const x = Math.floor(hash(i, 5) * 480), y = Math.floor(hash(i, 6) * 120); px(x, y, i % 7 ? 0xfff6d8 : 0xffffff); if (i % 9 === 0) { px(x - 1, y, 0xc8b8ff); px(x + 1, y, 0xc8b8ff); } }
        for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) { const d = x * x + y * y; if (d <= 144 && (x + 5) ** 2 + (y - 3) ** 2 > 110) px(90 + x, 40 + y, 0xfff2c0); }
        // skyline
        let x = 0, i = 0;
        while (x < 480) {
          const bw = 24 + Math.floor(hash(i, 9) * 30), bh = 50 + Math.floor(hash(i, 10) * 70);
          rect(x, 272 - bh, bw - 2, bh, 0x2d2650);
          for (let wy = 272 - bh + 6; wy < 262; wy += 8) for (let wx = x + 4; wx < x + bw - 6; wx += 6) if (hash(wx, wy) > 0.45) rect(wx, wy, 2, 3, hash(wx, wy, 1) > 0.5 ? 0xffd98a : 0xff9fb8);
          x += bw; i++;
        }
      }
    });
  }
  function cloud(px, cx, cy) {
    for (let y = -8; y <= 8; y++) for (let x = -24; x <= 24; x++) {
      const inside = ((x + 10) ** 2 + y * y * 1.6 < 100) || (x * x + (y + 3) ** 2 * 1.4 < 130) || ((x - 12) ** 2 + y * y * 1.6 < 80) || (y >= 0 && y <= 5 && Math.abs(x) < 20);
      if (inside) px(cx + x, cy + y, y > 3 ? 0xf0eaff : 0xffffff);
    }
  }
  function heart(px, x0, y0, c) {
    ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'].forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && px(x0 + x, y0 + y, c)));
  }
  function fish(px, x0, y0) {
    ['#..####..', '##.#####.', '#########', '##.#####.', '#..####..'].forEach((r, y) => [...r].forEach((ch, x) => ch === '#' && px(x0 + x, y0 + y, 0x7fb8e8)));
    px(x0 + 7, y0 + 1, 0x2e2742);
  }

  const CH = { a: [0xff7fa8, 0xc8487a], b: [0x7fc4f2, 0x3f86c0], c: [0xffd35c, 0xc89a20] };

  function build(scene) {
    Object.values(CATS).forEach(c => {
      for (const [fk, f] of Object.entries(CAT_FRAMES)) drawCat(c, f).toTex(scene, `${c.key}_${fk}`);
    });
    Object.keys(THEMES).forEach(t => buildTheme(scene, t));

    const k = 0x3a2e4f;
    rowsTex(scene, 'heart', ['.kk.kk.', 'krrkrrk', 'krwrrrk', 'krrrrrk', '.krrrk.', '..krk..', '...k...'], { k, r: 0xff5f8f, w: 0xffd0e0 });
    rowsTex(scene, 'heartEmpty', ['.kk.kk.', 'keekeek', 'keeeeek', 'keeeeek', '.keeek.', '..kek..', '...k...'], { k, e: 0xd8cde6 });
    rowsTex(scene, 'fish', ['k...kkkkk...', 'kk.kbbbbbk..', 'kbkbbbbbwek.', 'kbbbbbbbbbbk', 'kbkbllllbbk.', 'kk.kbbbbbk..', 'k...kkkkk...'],
      { k, b: 0x7fb8e8, l: 0xb4dcf8, w: 0xffffff, e: 0x2e2742 });
    rowsTex(scene, 'gold', ['k...kkkkk...', 'kk.kbbbbbk..', 'kbkbbbbbwek.', 'kbbbbbbbbbbk', 'kbkbllllbbk.', 'kk.kbbbbbk..', 'k...kkkkk...'],
      { k: 0x8a5a10, b: 0xffc93c, l: 0xfff0a0, w: 0xffffff, e: 0x2e2742 });
    rowsTex(scene, 'yarn', ['..kkkk..', '.kpPppk.', 'kpPppPpk', 'kPppPppk', 'kppPppPk', 'kpPppPpk', '.kpPppk.', '..kkkk.k', '.......k'],
      { k, p: 0xc9a0ff, P: 0x9a70e0 });
    rowsTex(scene, 'star', ['..y..', '.yyy.', 'yyyyy', '.yyy.', '.y.y.'], { y: 0xffe066 });
    rowsTex(scene, 'sparkle', ['..w..', '..w..', 'wwyww', '..w..', '..w..'], { w: 0xffffff, y: 0xfff07a });
    rowsTex(scene, 'cup', ['..kkkkkk..', '.kwwwwwwk.', '.kppppppkkk', '.kwwwwwwk.k', '.kwwwwwwkkk', '..kwwwwk..', 'kkkkkkkkkk'],
      { k, w: 0xfff8f0, p: 0xff9fc0 });
    rowsTex(scene, 'shadow', ['.kkkkkkkk.', 'kkkkkkkkkk', '.kkkkkkkk.'], { k: 0x3a2e4f });
    rowsTex(scene, 'shard', ['k.k', '.w.', 'k.k'], { k: 0xfff8f0, w: 0xff9fc0 });
    rowsTex(scene, 'note', ['..kk', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'], { k: 0xffffff });
    // vacuum robot 26x10
    canvasTex(scene, 'vacuum', 26, 11, ({ px, rect }) => {
      rect(2, 2, 22, 7, 0x3a2e4f); rect(1, 3, 24, 5, 0x3a2e4f);
      rect(3, 3, 20, 5, 0xc8c0e0); rect(2, 4, 22, 3, 0xc8c0e0); rect(4, 3, 18, 1, 0xe8e2f8);
      rect(9, 2, 8, 1, 0x3a2e4f); rect(10, 1, 6, 1, 0x3a2e4f); rect(11, 2, 4, 1, 0x9a90c0);
      px(18, 4, 0xff4f6f); px(19, 4, 0xff4f6f); px(6, 5, 0x6fe08f);
      rect(2, 8, 22, 1, 0x7f76a6); rect(4, 9, 4, 2, 0x3a2e4f); rect(18, 9, 4, 2, 0x3a2e4f);
      rect(0, 5, 2, 3, 0xff9fc0);
    });
    // cardboard box 15x15
    canvasTex(scene, 'box', 15, 15, ({ px, rect }) => {
      rect(0, 0, 15, 15, k); rect(1, 1, 13, 13, 0xe8b989); rect(1, 1, 13, 1, 0xf6d3aa); rect(1, 13, 13, 1, 0xc99566);
      rect(1, 4, 13, 1, 0xc99566); rect(6, 1, 3, 4, 0xfff0d0);
      heart(px, 4, 7, 0xff7fa8);
    });
    // pressure plates (per channel) & doors
    for (const [ch, [c1, c2]] of Object.entries(CH)) {
      canvasTex(scene, `plate_${ch}`, 14, 4, ({ rect }) => { rect(1, 0, 12, 2, c1); rect(2, 0, 10, 1, 0xffffff); rect(0, 2, 14, 2, 0x7f76a6); rect(0, 3, 14, 1, k); });
      canvasTex(scene, `plateP_${ch}`, 14, 4, ({ rect }) => { rect(1, 2, 12, 1, c2); rect(0, 3, 14, 1, k); rect(0, 2, 1, 1, 0x7f76a6); rect(13, 2, 1, 1, 0x7f76a6); });
      canvasTex(scene, `door_${ch}`, 16, 16, ({ px, rect }) => {
        rect(1, 0, 14, 16, k); rect(2, 0, 12, 16, c2);
        for (let x = 3; x < 14; x += 3) rect(x, 0, 2, 16, c1);
        rect(2, 7, 12, 2, k); px(7, 7, 0xffe066); px(8, 7, 0xffe066);
      });
      canvasTex(scene, `doorO_${ch}`, 16, 16, ({ px }) => { for (let y = 0; y < 16; y += 2) { px(1, y, c1); px(14, y, c1); } });
    }
    // home 32x36
    canvasTex(scene, 'house', 32, 36, ({ px, rect }) => {
      rect(3, 15, 26, 21, k); rect(4, 16, 24, 20, 0xfff4e6); rect(4, 16, 24, 2, 0xf0dcc8);
      for (let y = 0; y < 15; y++) { const half = Math.floor(y * 16 / 14) + 1; rect(16 - half, y + 1, half * 2, 1, y % 3 === 2 ? 0xd9668f : 0xf28db2); px(16 - half - 1, y + 1, k); px(16 + half, y + 1, k); }
      rect(0, 15, 32, 2, k); rect(23, 2, 4, 8, k); rect(24, 3, 2, 7, 0xbfe6cf);
      rect(11, 22, 10, 14, k); rect(12, 23, 8, 13, 0xc99be0); rect(12, 23, 8, 1, 0xb17fd0); px(18, 30, 0xffe066);
      heart(px, 13, 8, 0xff5f8f);
      rect(5, 20, 5, 5, k); rect(6, 21, 3, 3, 0xffe9a8); rect(22, 20, 5, 5, k); rect(23, 21, 3, 3, 0xffe9a8);
    });
    rowsTex(scene, 'swipe', ['..ww....', '....ww..', '.....ww.', '..p...w.', '..p...w.', '.....ww.', '....ww..', '..ww....'], { w: 0xffffff, p: 0xffc0d8 });
    canvasTex(scene, 'ring', 64, 64, ({ px }) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 31.5, y - 31.5); if (d > 28 && d < 31) px(x, y, (x + y) % 4 < 2 ? 0xffffff : 0xc9a0ff); } });
    rowsTex(scene, 'pip', ['.kkk.', 'kyyyk', 'kywyk', 'kyyyk', '.kkk.'], { k, y: 0xffd35c, w: 0xffffff });
    rowsTex(scene, 'pipEmpty', ['.kkk.', 'keeek', 'keeek', 'keeek', '.kkk.'], { k, e: 0xd8cde6 });
    canvasTex(scene, 'cloud', 52, 20, ({ px }) => cloud(px, 26, 10));
  }

  return { build, PX, CATS, THEMES, CH };
})();
