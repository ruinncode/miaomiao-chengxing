// ============================================================
//  NPC cats — in this world everybody is a cat (no humans).
//  Built from the same CatArt pose rig as jsq/yyf (shaded fur + dark outline),
//  with breeds/fur patterns and role outfits baked into small textures on demand.
//  NPC.draw(R, x, y, { look, dir, moving, role, t, wea }) — x = body centre, y = feet.
//  Roles: walk · clerk · concierge · barista · chef · driver · police · librarian · student · vendor
//  Reusable by every city: cities may pass `cfg.npcRoles` / colours via o.uni.
// ============================================================
window.NPC = (function () {
  const hex = (s) => parseInt(s.replace('#', ''), 16);
  const BASE = { o: '#17121a', e: '#f0c040', E: '#c8901a', n: '#d88890', p: '#d8a0a0', l: '#2a1a12', w: '#c8505f', k: '#f4f0e6', K: '#c8c4bc' };
  // fur: b base, h light, H top light, d shade, s stripe, m muzzle/paws; pat = pattern post-process
  const BREEDS = [
    { id: 'ginger',  tabby: 1, b: '#dc8740', h: '#eda25c', H: '#f6bd7c', d: '#ad6128', s: '#a24f1c', m: '#f6e2c4', e: '#8fd06a', E: '#4f9a3c' },
    { id: 'blue',    b: '#7c8698', h: '#97a1b2', H: '#aeb8c6', d: '#5c6576', s: '#6c7586', m: '#8d97a7', e: '#f2c442', E: '#c8901a' },
    { id: 'white',   b: '#ece8e0', h: '#faf8f2', H: '#ffffff', d: '#c6c1b8', s: '#e0dbd2', m: '#f8f4ee', o: '#2a2430', e: '#78b8ee', E: '#3a78c0' },
    { id: 'calico',  b: '#ece8e0', h: '#faf8f2', H: '#ffffff', d: '#c6c1b8', s: '#e0dbd2', m: '#f8f4ee', o: '#2a2028', pat: 'calico', O: '#d98a3e', X: '#3a302c', e: '#9ad06a', E: '#5a9a3a' },
    { id: 'siamese', b: '#eee0c4', h: '#f8eedc', H: '#fff8ea', d: '#cbb894', s: '#e2d2b2', m: '#f4e8d2', pat: 'points', P: '#5a3e30', e: '#6ab8f0', E: '#2a6ac0' },
    { id: 'tuxedo',  tabby: 1, b: '#2c2a32', h: '#45424e', H: '#5a5666', d: '#1c1b21', s: '#2c2a32', m: '#f2f0ea', pat: 'tux', e: '#a8e070', E: '#5aa03a' },
    { id: 'silver',  tabby: 1, b: '#b6bac4', h: '#ccd0d8', H: '#e0e2e8', d: '#8e929c', s: '#585c66', m: '#ecedf0', e: '#8ad07a', E: '#4a9a4a' },
    { id: 'tortie',  b: '#3c2c26', h: '#523c32', H: '#664a3c', d: '#2a1e1a', s: '#3c2c26', m: '#4a3830', pat: 'calico', O: '#c4743a', X: '#2a1e1a', e: '#f0b040', E: '#c07a1a' },
    { id: 'cream',   tabby: 1, b: '#e6c898', h: '#f2d9b0', H: '#f9e6c6', d: '#c6a470', s: '#d2ae7a', m: '#f8ecd6', e: '#e8a040', E: '#b8701a' },
    { id: 'smoke',   b: '#4c4a54', h: '#625f6c', H: '#77737f', d: '#36343c', s: '#4c4a54', m: '#5a5862', e: '#f0d050', E: '#c09a20' },
  ];
  // outfit colours: u main, U dark, g accent; c/C neck (scarf/tie)
  const ROLES = {
    walk:      { },
    clerk:     { vest: 1, tie: 1, u: '#7a2e3a', U: '#561e28', g: '#f3c55e' },
    concierge: { vest: 1, tie: 1, cap: 'pill', u: '#2e3c6a', U: '#1e2848', g: '#f3c55e' },
    barista:   { apron: 1, cap: 'beret', u: '#3e6a5a', U: '#2a4a3e', g: '#f4f0e6' },
    chef:      { apron: 1, cap: 'toque', u: '#f4f2ec', U: '#cfcbc2', g: '#c8483a' },
    driver:    { vest: 1, cap: 'peak', u: '#1e2a48', U: '#141c32', g: '#d8343a' }, // TTC-style navy + red band
    police:    { vest: 1, cap: 'peak', u: '#1a2236', U: '#10162a', g: '#f3c55e' },
    librarian: { vest: 1, glasses: 1, u: '#6a5a8a', U: '#4a3e66', g: '#f4f0e6' },
    student:   { pack: 1, glasses: 0, u: '#c8483a', U: '#8a2e26', g: '#f3c55e' },
    vendor:    { apron: 1, cap: 'toque0', u: '#c8a050', U: '#8a6a30', g: '#f4f0e6' },
  };
  const WALKER = [ // casual outfits for passers-by, picked by look
    { }, { cap: 'beanie', u: '#c8483a', U: '#8a2e26', g: '#f4f0e6', scarf: '#c8483a' }, { pack: 1, u: '#3a6a9a', U: '#264a6e', g: '#f3c55e' },
    { scarf: '#4a8a5a' }, { cap: 'beanie', u: '#3a5a8a', U: '#263e62', g: '#f3c55e', scarf: '#3a5a8a' }, { pack: 1, u: '#6a8a3a', U: '#4a6226', g: '#f4f0e6', glasses: 1 },
    { vest: 1, u: '#8a6a4a', U: '#5e4630', g: '#f3c55e' }, { glasses: 1, scarf: '#9a7ab0' },
  ];
  const IDLE = ['idle0', 'idle0', 'idle1', 'idle0', 'blink', 'idle0', 'look', 'idle1'];
  const cache = {};
  function grid(bi, role, w, pose) {
    const br = BREEDS[bi], P = Object.assign({}, CatArt.POSES[pose], { noTag: true });
    const g = CatArt.render({ key: 'npc', tabby: !!br.tabby }, P), part = g.part, hx = g.hx, hy = g.hy, CW = CatArt.CW, CH = CatArt.CH;
    const R = Object.assign({}, role === 'walk' ? WALKER[w % WALKER.length] : ROLES[role] || {});
    const inb = (x, y) => x >= 0 && y >= 0 && x < CW && y < CH;
    const set = (x, y, c) => { if (inb(x, y)) g[y][x] = c; };
    // fur pattern
    let bx0 = CW, bx1 = 0, by0 = CH, by1 = 0;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (part[y][x] === 'body') { bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const p = part[y][x], c = g[y][x]; if (!p || c === 'o' || !c) continue;
      if (br.pat === 'calico' && (p === 'body' || p.startsWith('tail') || (p === 'head' && 'bhsd'.includes(c)))) {
        const z = ((Math.floor((x + 1) / 4) * 7 + Math.floor((y + 2) / 3) * 3 + bi) % 5);
        if (z === 1 || z === 3) g[y][x] = 'O'; else if (z === 4) g[y][x] = 'X';
      }
      if (br.pat === 'points' && ((p === 'leg' || p === 'legF') && y >= 19 || p.startsWith('tail') && +p.slice(4) >= 2 || p === 'head' && (y - hy <= 1 || (y - hy >= 6 && x - hx >= 3 && x - hx <= 7)))) if (c !== 'n' && c !== 'e' && c !== 'E') g[y][x] = 'P';
      if (br.pat === 'tux' && ((p === 'leg' || p === 'legF') && y >= 20 || p === 'body' && x >= bx1 - 3 && y >= by0 + 2)) g[y][x] = 'm';
      if (!br.tabby && c === 's' && p !== 'head') g[y][x] = 'b';
    }
    // neck: scarf / tie colour (collar row under the chin)
    const cy = hy + 9, neck = R.scarf || (R.vest || R.apron ? R.U : null);
    for (let x = hx + 2; x <= hx + 8; x++) if (inb(x, cy) && g[cy][x] === 'c') g[cy][x] = neck ? 'c' : (part[cy][x] === 'head' ? 'm' : 'b');
    if (R.scarf) { set(hx + 3, cy + 1, 'C'); set(hx + 3, cy + 2, 'C'); }
    if (R.tie) { set(hx + 5, cy, 'g'); set(hx + 4, cy, 'g'); set(hx + 6, cy, 'g'); set(hx + 5, cy + 1, 'g'); }
    // body outfits
    if (R.vest) for (let y = by0; y <= by1; y++) for (let x = bx0; x <= bx1; x++) if (part[y][x] === 'body' && g[y][x] !== 'o' && x >= bx0 + 2) g[y][x] = y === by0 || x === bx0 + 2 ? 'U' : 'u';
    if (R.vest && R.tie) for (let y = by0 + 1; y <= by1 - 1; y += 2) set(bx1 - 2, y, 'g'); // buttons
    if (R.apron) for (let y = by0 + 1; y <= by1 + 1; y++) for (let x = bx1 - 6; x <= bx1; x++) if (inb(x, y) && (part[y][x] === 'body' || part[y][x] === 'leg') && g[y][x] !== 'o' && y <= by1 + 1) g[y][x] = y === by0 + 1 ? 'U' : 'u';
    if (R.apron) for (let x = bx0 + 1; x < bx1 - 6; x++) if (part[by0 + 2] && part[by0 + 2][x] === 'body') g[by0 + 2][x] = 'U'; // apron string
    if (R.pack) for (let y = by0 - 2; y <= by0 + 3; y++) for (let x = bx0 + 2; x <= bx0 + 7; x++) set(x, y, y === by0 - 2 || x === bx0 + 2 ? 'U' : (y === by0 + 1 && x > bx0 + 3 && x < bx0 + 7 ? 'g' : 'u'));
    // head gear
    const H = (dx, dy, c) => set(hx + dx, hy + dy, c);
    if (R.glasses) { for (const dx of [2, 3, 4, 6, 7, 8]) H(dx, 4, 'G'); H(5, 5, 'G'); H(2, 5, 'G'); H(8, 5, 'G'); }
    if (R.cap === 'peak') { for (let dx = 2; dx <= 8; dx++) { H(dx, 0, 'u'); H(dx, 1, 'u'); H(dx, 2, dx % 2 ? 'g' : 'g'); } for (let dx = 3; dx <= 7; dx++) H(dx, -1, 'u'); for (let dx = 5; dx <= 10; dx++) H(dx, 3, 'U'); H(5, 0, 'G'); }
    if (R.cap === 'pill') { for (let dx = 3; dx <= 7; dx++) { H(dx, 0, 'u'); H(dx, 1, 'u'); H(dx, 2, 'g'); } H(5, -1, 'g'); }
    if (R.cap === 'beanie') { for (let dx = 2; dx <= 8; dx++) { H(dx, 2, 'U'); H(dx, 1, 'u'); } for (let dx = 3; dx <= 7; dx++) H(dx, 0, 'u'); for (let dx = 4; dx <= 6; dx++) H(dx, -1, 'u'); H(5, -2, 'g'); H(5, -3, 'g'); }
    if (R.cap === 'beret') { for (let dx = 2; dx <= 8; dx++) { H(dx, 1, 'U'); H(dx, 0, 'u'); } for (let dx = 4; dx <= 8; dx++) H(dx, -1, 'u'); }
    if (R.cap === 'toque' || R.cap === 'toque0') { const tall = R.cap === 'toque' ? 4 : 2; for (let dx = 3; dx <= 7; dx++) H(dx, 2, 'U'); for (let dy = 2 - tall; dy <= 1; dy++) for (let dx = 2; dx <= 8; dx++) H(dx, dy, 'W'); for (let dx = 3; dx <= 7; dx++) H(dx, 1 - tall, 'W'); }
    // re-outline whatever the outfit added
    const filled = (x, y) => inb(x, y) && g[y][x] != null && g[y][x] !== 'o';
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x] == null && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => filled(x + dx, y + dy))) g[y][x] = 'o';
    return { g, R };
  }
  function key(bi, role, w, pose) { return `npc_${bi}_${role}_${role === 'walk' ? w % WALKER.length : 0}_${pose}`; }
  function ensure(bi, role, w, pose) {
    const k = key(bi, role, w, pose); if (cache[k]) return k;
    const sc = window.App && App.scene; if (!sc || !sc.textures || !window.CatArt) return null;
    if (!sc.textures.exists(k)) {
      const { g, R } = grid(bi, role, w, pose), br = BREEDS[bi];
      const pal = Object.assign({}, BASE, { c: R.scarf || R.U || '#555', C: R.U || '#333', u: R.u, U: R.U, g: R.g, W: '#f6f4ee', G: '#2a2a33' }, br);
      if (R.scarf) { pal.c = R.scarf; pal.C = R.scarf; }
      const t = sc.textures.createCanvas(k, CatArt.CW, CatArt.CH), ctx = t.getContext();
      for (let y = 0; y < CatArt.CH; y++) for (let x = 0; x < CatArt.CW; x++) { const ch = g[y][x]; if (!ch) continue; const col = pal[ch]; if (!col || typeof col !== 'string') continue; ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); }
      t.refresh();
    }
    cache[k] = 1; return k;
  }
  // look: any integer (stable per NPC); breed + casual outfit come from it
  function draw(R, x, y, o = {}) {
    const look = o.look | 0, bi = (o.breed != null ? o.breed : look % BREEDS.length), role = o.role || 'walk', t = o.t || 0;
    let pose;
    if (o.pose) pose = o.pose;
    else if (o.moving) pose = 'walk' + (((t * 9 + look * 0.37) | 0) % 6);
    else if (o.sit) pose = ((t * 0.7 + look) | 0) % 5 === 0 ? 'sitBlink' : 'sit';
    else pose = IDLE[((t * 0.8 + look * 1.3) | 0) % IDLE.length];
    const k = ensure(bi, role, (look >> 3) + (look % 3), pose); if (!k) return;
    R.img(k, x, y, { ax: CatArt.ANCHOR.x, ay: CatArt.ANCHOR.y, flip: (o.dir || 1) < 0 });
    if (o.wea === 'rain' && o.umbrella !== false && look % 3 !== 1) { // little umbrella tied to the back
      const uc = ['#c84a5a', '#3a5ad8', '#2a2a30', '#e8c84a', '#4a9a6a'][look % 5], bx = x - (o.dir || 1) * 4;
      R.rect(bx, y - 30, 1, 12, '#333'); R.rect(bx - 8, y - 32, 17, 2, uc); R.rect(bx - 6, y - 34, 13, 2, uc); R.rect(bx - 3, y - 35, 7, 1, uc); R.rect(bx - 8, y - 30, 17, 1, '#000', 0.25);
    }
  }
  return { draw, BREEDS, ROLES, ensure };
})();
