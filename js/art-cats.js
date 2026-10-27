// ============================================================
//  Cat sprites — original pixel art built from code.
//  Each pose is a few primitives (ellipse body, capsule legs/tail)
//  + a hand-drawn head map; then automatic shading, tabby stripes
//  and a solid dark outline are applied. Tweak POSES / HEADS / CATS.
//  Sprites face RIGHT; canvas 30x24 art px, shown at 2x.
//  Feet rest on row FOOT (outline on FOOT+1 = bottom of hitbox).
// ============================================================
window.CatArt = (function () {
  const CW = 30, CH = 24, FOOT = 21;
  // ---- the two cats (palette per symbol) ----
  //  o outline  b fur  h highlight  d shade  s stripe  m muzzle/chest
  //  e/E eye top/bottom  n nose  p inner ear  l eyelid line  w mouth
  //  c/C collar/scarf  k/K tag or bell  (jsq: blue-teal scarf, round tag; yyf: yellow bell collar — no pink, gender-neutral)
  const CATS = [
    { key: 'cat0', name: 'jsq', tabby: false,
      pal: { o: 0x09080d, b: 0x23212b, h: 0x3d3a4c, H: 0x55516a, d: 0x16151b, s: 0x2a2833, m: 0x23212b,
        e: 0xffe46b, E: 0xf0a92a, n: 0xb86b7c, p: 0x5e3f52, l: 0xffcf4a, w: 0xd76f86,
        c: 0x2fa8a8, C: 0x1b6c76, k: 0xd8dde6, K: 0x8a93a6 } },
    { key: 'cat1', name: 'yyf', tabby: true,
      pal: { o: 0x1c100b, b: 0xb87a43, h: 0xd99c5c, H: 0xeab479, d: 0x8a542c, s: 0x5f3720, m: 0xf1d6ae,
        e: 0x2a1a12, E: 0x2a1a12, n: 0xe0868c, p: 0xe9a3a3, l: 0x2a1a12, w: 0xc8505f,
        c: 0xf2c632, C: 0xb08414, k: 0xfff1a8, K: 0xc88a1a } },
  ];

  // ---- heads, 11 x 9, front-ish 3/4 view (eyes at cols 3 & 7) ----
  const BASE = [
    '.b.......b.',
    '.bb.....bb.',
    '.bpbbbbbpb.',
    'bbbbsbsbbbb',
    'bbbbbsbbbbb',
    'sbb@bbb@bbs',
    'bbb@bbb@bbb',
    'bbbbmnmbbbb',
    '.bbmmmmmbb.',
  ];
  const eyes = (rows, a, b) => rows.map((r, y) => r.replace(/@/g, () => '@')).map((r, y) => {
    if (y === 5) return r.replace('@', a[0]).replace('@', a[1]);
    if (y === 6) return r.replace('@', b[0]).replace('@', b[1]);
    return r;
  });
  const HEADS = {
    open: eyes(BASE, 'ee', 'EE'),
    blink: eyes(BASE, 'bb', 'll'),
    happy: (() => { const r = eyes(BASE, 'bb', 'bb').slice(); r[5] = 'sblbbbblbbs'; r[6] = 'blblbblblbb'.slice(0, 11); return r.map(x => x.slice(0, 11)); })(),
    closed: eyes(BASE, 'bb', 'll'),
    dizzy: (() => { const r = eyes(BASE, 'bb', 'bb').slice(); r[5] = 'sbl.lbl.lbs'.replace(/\./g, 'b'); r[6] = 'bbblbbblbbb'; r[4] = 'bblblbblblb'; return r; })(),
    meow: (() => { const r = eyes(BASE, 'ee', 'EE').slice(); r[7] = 'bbbbmnmbbbb'; r[8] = '.bbmmwmmbb.'; return r; })(),
    look: (() => { const r = BASE.slice(); r[5] = 'sbbebbbbebs'; r[6] = 'bbbEbbbbEbb'; return r; })(),
  };
  HEADS.happy[5] = 'sbbbbbbbbbs'; HEADS.happy[6] = 'bblblbblblb'; HEADS.happy[5] = 'sbblbbbblbs'.slice(0, 11);
  // happy eyes ^ ^
  HEADS.happy[5] = 'sbblbbblbbs'; HEADS.happy[6] = 'bblblblblbb';

  // ---- poses ----
  //  body: ellipses [cx, cy, rx, ry, angleDeg]; legs: capsules [x1,y1,x2,y2,r, far?]
  //  tail: polyline points (r 1.0); head: [x, y, map]; extra: {paw, collar offset}
  const P = (o) => Object.assign({ body: [], legs: [], tail: [], head: [15, 6, 'open'] }, o);
  const TAILS = {
    up:    [[7, 15], [5, 14], [4, 12], [4, 10], [5, 8]],
    up2:   [[7, 15], [5, 14], [3, 13], [2, 11], [2, 9]],
    flick: [[7, 15], [5, 14], [4, 13], [3, 11], [3.5, 9], [5, 8.5]],
    back:  [[7, 15], [5, 15], [3, 14], [1.5, 13]],
    low:   [[7, 16], [5, 17], [3, 17.5], [1.5, 17]],
    wrap:  [[6, 18], [8, 20], [13, 20.3], [18, 20], [21, 19]],
    high:  [[7, 14], [6, 12], [6, 9], [7.5, 7.5]],
  };
  // standing legs helper: four legs (far back, near back, far front, near front)
  const legsStand = (dx = [0, 0, 0, 0], lift = [0, 0, 0, 0]) => [
    [9 + dx[0], 16, 9 + dx[0], FOOT - lift[0], 0.95, 1],
    [11.5 + dx[1], 16, 11.5 + dx[1], FOOT - lift[1], 0.95, 0],
    [16 + dx[2], 16, 16 + dx[2], FOOT - lift[2], 0.95, 1],
    [18.5 + dx[3], 16, 18.5 + dx[3], FOOT - lift[3], 0.95, 0],
  ];
  const BODY = [[13.5, 15.2, 7, 3.1, 0]];
  const WALK = [ // leg x offsets & lifts for a 6-frame cycle (diagonal pairs)
    [[1, -1, -1, 1], [0, 1, 1, 0], 0],
    [[0.5, -0.5, -0.5, 0.5], [0, 0, 0, 0], -1],
    [[-1, 1, 1, -1], [1, 0, 0, 1], 0],
    [[-1, 1, 1, -1], [1, 0, 0, 1], 0],
    [[-0.5, 0.5, 0.5, -0.5], [0, 0, 0, 0], -1],
    [[1, -1, -1, 1], [0, 1, 1, 0], 0],
  ];
  const POSES = {
    idle0: P({ body: BODY, legs: legsStand(), tail: TAILS.up }),
    idle1: P({ body: BODY, legs: legsStand(), tail: TAILS.flick }),
    blink: P({ body: BODY, legs: legsStand(), tail: TAILS.up, head: [15, 6, 'blink'] }),
    look: P({ body: BODY, legs: legsStand(), tail: TAILS.up2, head: [15, 5, 'look'] }),
    meow: P({ body: BODY, legs: legsStand(), tail: TAILS.high, head: [15, 5, 'meow'] }),
    // sit: tall body at the back, front legs straight
    sit: P({ body: [[12, 15.5, 4.6, 4.6, 0]], legs: [[15, 16, 15, FOOT, 0.95, 1], [17, 15, 17, FOOT, 0.95, 0], [9, 19, 13, 20, 1.2, 0]],
      tail: [[8, 19], [6, 20], [4, 19.5], [3, 18]], head: [12, 4, 'open'] }),
    sitBlink: P({ body: [[12, 15.5, 4.6, 4.6, 0]], legs: [[15, 16, 15, FOOT, 0.95, 1], [17, 15, 17, FOOT, 0.95, 0], [9, 19, 13, 20, 1.2, 0]],
      tail: [[8, 19], [6, 20], [4, 19.5], [3, 18.5]], head: [12, 4, 'blink'] }),
    loaf: P({ body: [[13, 17.2, 7.5, 3.6, 0]], legs: [], tail: TAILS.low, noTag: true, head: [16, 9, 'closed'] }),
    sleep0: P({ body: [[13, 17.6, 8, 3.6, 0]], legs: [], tail: TAILS.wrap, tailFront: true, noTag: true, head: [17, 11, 'closed'] }),
    sleep1: P({ body: [[13, 17.4, 8, 3.8, 0]], legs: [], tail: TAILS.wrap, tailFront: true, noTag: true, head: [17, 11, 'closed'] }),
    // jumping up: body tilted, back legs push, front legs reach
    jump: P({ body: [[13.5, 14.5, 6.8, 3, -28]], legs: [[9, 17, 6.5, 21, 0.95, 1], [10.5, 17.5, 8.5, 21.5, 0.95, 0], [16, 13, 19.5, 10.5, 0.95, 1], [17.5, 14, 21, 12, 0.95, 0]],
      tail: [[8, 17], [6, 18.5], [4, 19], [2, 18.5]], head: [16, 3, 'open'] }),
    // mid-air leap: long stretched body
    leap: P({ body: [[13.5, 14, 8.2, 2.7, 0]], legs: [[8, 15.5, 4.5, 17.5, 0.95, 1], [9.5, 16, 6, 18.5, 0.95, 0], [18, 15, 22, 15.5, 0.95, 1], [19, 15.5, 23, 17, 0.95, 0]],
      tail: [[6, 13.5], [4, 13], [2, 12], [0.8, 11]], head: [17, 6, 'open'] }),
    // falling: body tilted down, legs reaching for the ground
    fall: P({ body: [[13.5, 14.8, 6.8, 3, 14]], legs: [[9, 16, 8.5, 20, 0.95, 1], [11, 16.5, 11, 20.5, 0.95, 0], [16, 17, 17.5, 21, 0.95, 1], [18, 17, 19.5, 21, 0.95, 0]],
      tail: [[7, 13.5], [5.5, 11.5], [5, 9], [6, 7]], head: [15, 8, 'open'] }),
    // landing squash
    land: P({ body: [[13.5, 17, 7.8, 2.6, 0]], legs: [[8.5, 18, 8, FOOT, 0.95, 1], [11, 18, 11, FOOT, 0.95, 0], [16.5, 18, 17, FOOT, 0.95, 1], [19, 18, 19.5, FOOT, 0.95, 0]],
      tail: [[6, 17], [4, 16], [2.5, 15], [1.5, 13.5]], head: [15, 9, 'blink'] }),
    // happy hop (legs tucked, tail high)
    happy0: P({ body: [[13.5, 13.8, 6.8, 3.1, 0]], legs: [[9, 15, 8, 18, 0.95, 1], [11.5, 15, 11, 18.5, 0.95, 0], [16, 15, 17, 18, 0.95, 1], [18.5, 15, 19.5, 18.5, 0.95, 0]],
      tail: [[7, 13], [6, 10.5], [6.5, 8], [8, 6.5]], head: [15, 4, 'happy'] }),
    happy1: P({ body: BODY, legs: legsStand(), tail: TAILS.high, head: [15, 6, 'happy'] }),
    // paw swipe: front paw raised forward
    swipe: P({ body: [[13, 15.2, 6.8, 3.1, -6]], legs: [[9, 16, 9, FOOT, 0.95, 1], [11.5, 16, 11.5, FOOT, 0.95, 0], [16.5, 16, 16.5, FOOT, 0.95, 1]],
      front: [[19, 16, 26.5, 13.5, 1.05]], tail: TAILS.high, head: [13, 5, 'open'] }),
    hug: P({ body: [[13, 15.2, 6.6, 3.4, -12]], legs: [[9, 16, 9, FOOT, 0.95, 1], [11.5, 16, 11.5, FOOT, 0.95, 0]],
      front: [[17, 13.5, 24.5, 10.5, 1.05], [16, 14.5, 23.5, 12.5, 1.0]], tail: TAILS.high, head: [15, 4, 'happy'] }),
    nuzzle: P({ body: BODY, legs: legsStand(), tail: TAILS.high, head: [17, 8, 'closed'] }),
    hold: P({ body: [[12, 15.5, 4.6, 4.6, 0]], legs: [[9, 19, 13, 20, 1.2, 0]], front: [[14, 15, 18.5, 15.5, 0.95], [14.5, 16, 19, 16.5, 0.95]],
      tail: [[8, 19], [6, 20], [4, 19.5], [3, 18]], head: [12, 5, 'blink'] }),
    dizzy0: P({ body: BODY, legs: legsStand([1, 0, -1, 0]), tail: TAILS.low, head: [15, 7, 'dizzy'] }),
    dizzy1: P({ body: [[13.5, 15.4, 7, 3, 4]], legs: legsStand([0, 1, 0, -1]), tail: TAILS.low, head: [14, 7, 'dizzy'] }),
  };
  WALK.forEach(([dx, lift, bob], i) => {
    POSES['walk' + i] = P({ body: [[13.5, 15.2 + bob * 0.5, 7, 3.1, 0]], legs: legsStand(dx, lift), tail: i % 3 === 0 ? TAILS.up : (i % 3 === 1 ? TAILS.flick : TAILS.up2), head: [15, 6 + (bob < 0 ? -1 : 0) + 0, 'open'] });
  });
  // run: longer strides (used when moving fast)
  const RUN = [
    { body: [[13.5, 14.6, 7.6, 2.8, -4]], legs: [[9, 16, 5.5, 19.5, 0.95, 1], [10.5, 16, 7.5, 20.5, 0.95, 0], [16.5, 15.5, 20.5, 18.5, 0.95, 1], [18, 15.5, 22, 19.5, 0.95, 0]], head: [16, 5] },
    { body: [[13.5, 15.4, 6.6, 3.1, 0]], legs: [[10, 16, 11, FOOT, 0.95, 1], [12, 16, 13, FOOT, 0.95, 0], [15.5, 16, 14.5, FOOT, 0.95, 1], [17.5, 16, 16.5, FOOT, 0.95, 0]], head: [15, 6] },
    { body: [[13.5, 14.8, 7.2, 3, 3]], legs: [[9.5, 16, 12, 20, 0.95, 1], [11, 16, 14, 20.5, 0.95, 0], [16, 16, 14, 20, 0.95, 1], [18, 16, 16.5, 20.5, 0.95, 0]], head: [15, 6] },
    { body: [[13.5, 15.2, 7, 3.1, 0]], legs: [[9, 16, 7.5, FOOT, 0.95, 1], [11, 16, 9.5, FOOT, 0.95, 0], [16.5, 16, 18.5, FOOT, 0.95, 1], [18.5, 16, 20.5, FOOT, 0.95, 0]], head: [15, 6] },
  ];
  RUN.forEach((r, i) => { POSES['run' + i] = P({ body: r.body, legs: r.legs, tail: i % 2 ? TAILS.back : TAILS.up2, head: [r.head[0], r.head[1], 'open'] }); });

  // ---- rasteriser ----
  function segDist(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1, L = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / L));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
  function render(cat, pose) {
    const g = Array.from({ length: CH }, () => Array(CW).fill(null));
    const part = Array.from({ length: CH }, () => Array(CW).fill(null));
    const set = (x, y, v, p) => { if (x >= 0 && y >= 0 && x < CW && y < CH) { g[y][x] = v; part[y][x] = p; } };
    const tail = () => { for (let k = 0; k < pose.tail.length - 1; k++) {
      const [x1, y1] = pose.tail[k], [x2, y2] = pose.tail[k + 1];
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (segDist(x + 0.5, y + 0.5, x1, y1, x2, y2) < 1.05) set(x, y, 'b', 'tail' + k);
    } };
    if (!pose.tailFront) tail();
    // far legs, body, near legs
    const legs = (far) => pose.legs.forEach(([x1, y1, x2, y2, r, f]) => {
      if (!!f !== far) return;
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (segDist(x + 0.5, y + 0.5, x1, y1, x2, y2) < r) set(x, y, far ? 'd' : 'b', far ? 'legF' : 'leg');
    });
    legs(true);
    pose.body.forEach(([cx, cy, rx, ry, a]) => {
      const ca = Math.cos(a * Math.PI / 180), sa = Math.sin(a * Math.PI / 180);
      for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
        const u = dx * ca + dy * sa, v = -dx * sa + dy * ca;
        if ((u / rx) ** 2 + (v / ry) ** 2 <= 1) set(x, y, 'b', 'body');
      }
    });
    legs(false);
    if (pose.tailFront) tail();
    // shading on non-head fur
    const filled = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH && g[y][x] != null;
    const snap = g.map(r => r.slice());
    const sf = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH && snap[y][x] != null;
    let bx0 = CW, bx1 = 0, by0 = CH, by1 = 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (part[y][x] === 'body') { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const p = part[y][x]; if (!p) continue;
      if (p === 'body') {
        if (!sf(x, y - 1)) g[y][x] = (x > bx0 + 2 && x < bx1 - 1) ? 'h' : 'b';
        else if (!sf(x, y + 1) || !sf(x, y + 2) && y > (by0 + by1) / 2) g[y][x] = 'd';
        else if (cat.tabby && y <= (by0 + by1) / 2 + 0.5 && ((x + (y >> 1)) % 3 === 0) && x < bx1 - 1) g[y][x] = 's';
        if (!cat.tabby && sf(x, y - 1) && !sf(x, y - 2) && x > bx0 + 3 && x < bx1 - 3 && (x % 4 === 1)) g[y][x] = 'h';
      } else if (p.startsWith('tail')) {
        const k = +p.slice(4);
        if (cat.tabby && k % 2 === 1) g[y][x] = 's';
        else if (!sf(x, y - 1)) g[y][x] = 'h';
        if (k >= pose.tail.length - 2 && cat.tabby) g[y][x] = 's';
      } else if (p === 'leg') {
        if (!sf(x, y + 1)) g[y][x] = cat.tabby ? 'm' : 'b'; // light paws on the tabby
      }
    }
    // chest patch (tabby) under the head
    // head
    const [hx, hy, hk] = pose.head;
    const H = HEADS[hk] || HEADS.open;
    H.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') set(hx + x, hy + y, ch, 'head'); }));
    (pose.front || []).forEach(([x1, y1, x2, y2, r]) => { for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (segDist(x + 0.5, y + 0.5, x1, y1, x2, y2) < r) set(x, y, (x2 - x - 0.5) ** 2 + (y2 - y - 0.5) ** 2 < 2 ? (cat.tabby ? 'm' : 'h') : 'b', 'paw'); });
    // head highlight on its top edge + subtle second tone
    for (let x = 0; x < 11; x++) for (let y = 0; y < 9; y++) {
      const X = hx + x, Y = hy + y;
      if (part[Y] && part[Y][X] === 'head' && g[Y][X] === 'b' && !filled(X, Y - 1)) { g[Y][X] = y <= 2 ? 'b' : 'h'; }
    }
    if (!cat.tabby) { [[3, 3], [7, 3]].forEach(([x, y]) => { if (g[hy + y] && g[hy + y][hx + x] === 'b') g[hy + y][hx + x] = 'h'; }); }
    // collar under the chin (jsq: blue-teal scarf + round silver tag; yyf: yellow collar + golden bell)
    const cy = hy + 9;
    for (let x = hx + 2; x <= hx + 8; x++) if (filled(x, cy)) g[cy][x] = 'c';
    if (pose.noTag) { /* collar only */ } else if (cat.key === 'cat0') {
      for (let x = hx + 3; x <= hx + 7; x++) if (filled(x, cy + 1) && part[cy + 1][x] === 'body') g[cy + 1][x] = 'C';
      if (filled(hx + 1, cy)) g[cy][hx + 1] = 'C';
      set(hx + 6, cy + 1, 'k'); set(hx + 7, cy + 1, 'k'); set(hx + 6, cy + 2, 'K'); set(hx + 7, cy + 2, 'K'); // round tag
    } else {
      set(hx + 5, cy + 1, 'k'); set(hx + 5, cy + 2, 'K');
    }
    // outline (4-neighbour) + rounded inner corners
    const out = [];
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x] == null && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx, y + dy))) out.push([x, y]);
    out.forEach(([x, y]) => { g[y][x] = 'o'; });
    return g;
  }

  function build(scene, canvasTex) {
    const keys = [];
    for (const c of CATS) for (const [name, pose] of Object.entries(POSES)) {
      const g = render(c, pose);
      canvasTex(scene, `${c.key}_${name}`, CW, CH, ({ px }) => { for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x]) px(x, y, c.pal[g[y][x]] != null ? c.pal[g[y][x]] : 0xff00ff); });
      keys.push(`${c.key}_${name}`);
    }
    return keys;
  }
  // body centre (x) and foot row, used to anchor sprites to the 26x24 hitbox
  const ANCHOR = { x: 15 / CW, y: (FOOT + 2) / CH };
  return { build, CATS, POSES, HEADS, CW, CH, FOOT, ANCHOR, render };
})();
