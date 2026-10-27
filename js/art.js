// ============================================================
//  Art — original pixel art drawn in code (no image files).
//  Everything is drawn at 1x into small canvases (ImageData) and
//  shown at 2x with nearest-neighbour scaling. Palette: moody
//  blue-slate nights with warm lamp / firefly accents.
//  Cats live in art-cats.js; this file: themes, tiles, props, UI.
// ============================================================
window.Art = (function () {
  const PX = 2;
  const INK = 0x0d0f17;
  const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
  const dith = (x, y) => (BAYER[y & 3][x & 3] + 0.5) / 16;
  const hash = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 2147483647) | 0; n = (n ^ (n >>> 13)) * 1274126177; return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };
  const hex = (n) => '#' + n.toString(16).padStart(6, '0');
  const mix = (a, b, t) => { const r = (a >> 16 & 255) + ((b >> 16 & 255) - (a >> 16 & 255)) * t, g = (a >> 8 & 255) + ((b >> 8 & 255) - (a >> 8 & 255)) * t, bl = (a & 255) + ((b & 255) - (a & 255)) * t; return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl); };

  // ---------- canvas texture with a fast pixel buffer ----------
  function canvasTex(scene, key, w, h, draw) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, w, h);
    const ctx = t.getContext(); ctx.imageSmoothingEnabled = false;
    let img = ctx.getImageData(0, 0, w, h), d = img.data;
    const px = (x, y, c, a = 1) => {
      if (c == null) return; x |= 0; y |= 0; if (x < 0 || y < 0 || x >= w || y >= h) return;
      const i = (y * w + x) * 4, r = c >> 16 & 255, g = c >> 8 & 255, b = c & 255;
      if (a >= 1 || d[i + 3] === 0) { d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a >= 1 ? 255 : Math.round(a * 255); }
      else { d[i] = d[i] + (r - d[i]) * a; d[i + 1] = d[i + 1] + (g - d[i + 1]) * a; d[i + 2] = d[i + 2] + (b - d[i + 2]) * a; }
    };
    const get = (x, y) => { if (x < 0 || y < 0 || x >= w || y >= h) return null; const i = (y * w + x) * 4; return d[i + 3] ? (d[i] << 16) | (d[i + 1] << 8) | d[i + 2] : null; };
    const rect = (x, y, ww, hh, c, a = 1) => { for (let yy = y; yy < y + hh; yy++) for (let xx = x; xx < x + ww; xx++) px(xx, yy, c, a); };
    const withCtx = (fn) => { ctx.putImageData(img, 0, 0); fn(ctx); img = ctx.getImageData(0, 0, w, h); d = img.data; };
    draw({ px, get, rect, w, h, withCtx });
    ctx.putImageData(img, 0, 0); t.refresh();
    return t;
  }
  function rowsTex(scene, key, rows, pal) {
    const w = Math.max(...rows.map(r => r.length)), h = rows.length;
    canvasTex(scene, key, w, h, ({ px }) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch] != null) px(x, y, pal[ch]); })));
  }
  // vertical gradient with ordered dithering between stops
  function grad(px, x0, y0, w, h, stops) {
    for (let y = y0; y < y0 + h; y++) {
      const t = (y - y0) / Math.max(1, h - 1) * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(t)), f = t - i;
      for (let x = x0; x < x0 + w; x++) px(x, y, f > dith(x, y) ? stops[i + 1] : stops[i]);
    }
  }
  // dithered radial glow (adds colour with alpha falloff)
  function glow(px, cx, cy, r, c, a = 0.5) {
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      const dd = Math.hypot(x, y) / r; if (dd > 1) continue;
      const k = (1 - dd) * (1 - dd); if (k * 1.6 > dith(cx + x, cy + y) * 0.9) px(cx + x, cy + y, c, a * Math.min(1, k * 2));
    }
  }
  function stars(px, x0, y0, w, h, n, seed, cols = [0xe8ecff, 0xbac6ff, 0xfff2c8]) {
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.floor(hash(i, seed) * w), y = y0 + Math.floor(hash(i, seed + 1) ** 1.4 * h);
      const c = cols[i % cols.length];
      px(x, y, c, 0.6 + hash(i, seed + 2) * 0.4);
      if (i % 11 === 0) { px(x - 1, y, c, 0.4); px(x + 1, y, c, 0.4); px(x, y - 1, c, 0.4); px(x, y + 1, c, 0.4); }
    }
  }
  function moon(px, cx, cy, r, crescent) {
    glow(px, cx, cy, r * 3, 0xdfe6ff, 0.25);
    for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) {
      if (x * x + y * y > r * r) continue;
      if (crescent && (x + r * 0.55) ** 2 + (y - r * 0.2) ** 2 < (r * 0.85) ** 2) continue;
      const shade = (x - y) / (2 * r);
      px(cx + x, cy + y, shade > 0.35 ? 0xd9d2b4 : shade < -0.4 ? 0xfffbe6 : 0xf3ecd0);
    }
    if (!crescent) [[-3, -2, 2], [3, 3, 2], [-1, 5, 1], [4, -4, 1]].forEach(([x, y, rr]) => { for (let yy = -rr; yy <= rr; yy++) for (let xx = -rr; xx <= rr; xx++) if (xx * xx + yy * yy <= rr * rr) px(cx + x + xx, cy + y + yy, 0xd6cfae); });
  }
  // generic outlined shape from a rows map
  const sil = (px, x0, y0, rows, pal) => rows.forEach((r, y) => [...r].forEach((ch, x) => { if (pal[ch] != null) px(x0 + x, y0 + y, pal[ch]); }));

  // ================= themes =================
  const BGW = 520; // background layers are wider than the 480 art-px screen for parallax
  const THEMES = {
    room: {
      label: '夜晚小屋',
      top: [0xa8744e, 0x8a5b3c, 0x6b4430, 0x4a2d22], fill: [0x2a2234, 0x241d2d, 0x332a3f], plank: [0x9a6a46, 0x7a4f34, 0x553522],
      dust: 0x9aa2c0,
    },
    garden: {
      label: '黄昏花园',
      top: [0x8fd07a, 0x5fa25e, 0x3f7a4e, 0x2c5640], fill: [0x2f2530, 0x271f29, 0x3a2e36], plank: [0x8a6a4e, 0x6a4e38, 0x483426],
      dust: 0xb8a6a0,
    },
    roof: {
      label: '屋顶星空',
      top: [0x7f8ab0, 0x5a6488, 0x434b6c, 0x2f3552], fill: [0x3a2834, 0x2f212b, 0x4a3240], plank: [0x8a7f9a, 0x6a6080, 0x4a4260],
      dust: 0x9aa6c8,
    },
  };

  function buildTheme(scene, name) {
    if (name === 'room') buildRoom(scene); else if (name === 'garden') buildGarden(scene); else buildRoof(scene);
  }

  function buildRoom(scene) {
    // layer 0: wall with wallpaper, window, lamp glow
    canvasTex(scene, 'bg_room_0', BGW, 272, ({ px, rect }) => {
      grad(px, 0, 0, BGW, 272, [0x161b2c, 0x1c2338, 0x212a42, 0x242e48]);
      for (let x = 0; x < BGW; x++) for (let y = 0; y < 230; y++) {
        if (x % 24 === 0 || x % 24 === 1) px(x, y, 0x283352, 0.55);
        if ((x % 24 === 12) && (y % 16 === 8)) { px(x, y, 0x34416a); px(x - 1, y + 1, 0x2c3858); px(x + 1, y + 1, 0x2c3858); px(x, y + 2, 0x2c3858); }
      }
      // wainscot
      rect(0, 206, BGW, 66, 0x1a1f33); rect(0, 206, BGW, 2, 0x3a4566); rect(0, 208, BGW, 1, 0x10131f);
      for (let x = 8; x < BGW; x += 40) { rect(x, 216, 30, 40, 0x1e2440); rect(x, 216, 30, 1, 0x2c3558); rect(x, 255, 30, 1, 0x12162a); }
      // window
      const wx = 64, wy = 38, ww = 96, wh = 100;
      grad(px, wx, wy, ww, wh, [0x1a2550, 0x24336a, 0x33467e, 0x435a8e]);
      stars(px, wx + 2, wy + 2, ww - 4, wh - 30, 40, 7);
      moon(px, wx + 70, wy + 26, 11, true);
      // distant rooftops through the window
      for (let x = wx; x < wx + ww; x++) { const hh = 14 + Math.round(6 * Math.abs(Math.sin(x * 0.19)) + (x % 23 < 8 ? 8 : 0)); for (let y = wy + wh - hh; y < wy + wh; y++) px(x, y, 0x161d3a); }
      for (let i = 0; i < 12; i++) px(wx + 4 + Math.floor(hash(i, 3) * (ww - 8)), wy + wh - 4 - Math.floor(hash(i, 4) * 10), 0xf6c76a);
      rect(wx - 4, wy - 4, ww + 8, 4, 0x4a3228); rect(wx - 4, wy + wh, ww + 8, 4, 0x4a3228); rect(wx - 4, wy, 4, wh, 0x4a3228); rect(wx + ww, wy, 4, wh, 0x4a3228);
      rect(wx + ww / 2 - 1, wy, 3, wh, 0x4a3228); rect(wx, wy + 48, ww, 3, 0x4a3228);
      rect(wx - 4, wy - 4, ww + 8, 1, 0x6a4a38); rect(wx - 8, wy + wh + 4, ww + 16, 5, 0x5a3d2e); rect(wx - 8, wy + wh + 4, ww + 16, 1, 0x7a5640); rect(wx - 8, wy + wh + 9, ww + 16, 1, INK);
      // moonlight on the wall/floor below the window
      for (let y = wy + wh + 10; y < 272; y++) for (let x = wx; x < wx + ww; x++) { const k = (y - wy - wh) * 0.3; if (dith(x, y) < 0.18 && x > wx + k * 0.2 && x < wx + ww + k * 0.2) px(x + Math.floor(k * 0.4), y, 0x6a7ab8, 0.25); }
      // curtains
      const curtain = (x0, dir) => { for (let y = wy - 10; y < wy + wh + 14; y++) { const wv = 14 - Math.max(0, (y - (wy + 60)) * 0.12) * (y > wy + 60 ? 1 : 0); for (let x = 0; x < wv; x++) { const X = dir > 0 ? x0 + x : x0 - x; const fold = (x + Math.floor(y / 30)) % 5; px(X, y, fold === 0 ? 0x2e2040 : fold === 1 ? 0x5a4070 : 0x48335a); } } };
      curtain(wx - 14, 1); curtain(wx + ww + 14, -1);
      rect(wx - 20, wy - 12, ww + 40, 3, 0x6a5a4a); rect(wx - 22, wy - 13, 3, 5, 0xb09070); rect(wx + ww + 19, wy - 13, 3, 5, 0xb09070);
      // picture frames
      const frame = (x, y, w2, h2, inner) => { rect(x - 1, y - 1, w2 + 2, h2 + 2, INK); rect(x, y, w2, h2, 0x8a6a40); rect(x + 2, y + 2, w2 - 4, h2 - 4, inner); rect(x, y, w2, 1, 0xb08a54); };
      frame(236, 62, 34, 26, 0x2a3a5a); sil(px, 244, 70, ['..o..o....', '.oooooo...', '.oyooyo..o', '.oooooo.o.', '..oooooo..'], { o: 0x10121c, y: 0xf3c55e });
      frame(282, 52, 22, 30, 0x3a2a3a); sil(px, 287, 60, ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..'], { r: 0xe8577a });
      // string lights along the ceiling
      for (let x = 0; x < BGW; x++) { const y = 10 + Math.round(Math.sin(x / 40) * 4 + 4); px(x, y, 0x0f1220); if (x % 26 === 13) { const c = [0xf6c76a, 0xe58aa6, 0x7cc8a4, 0x8fb4f0][(x / 26 | 0) % 4]; glow(px, x, y + 3, 7, c, 0.35); px(x, y + 2, c); px(x, y + 3, c); px(x - 1, y + 3, c); px(x + 1, y + 3, c, 0.7); px(x, y + 4, c); } }
    });
    // layer 1: furniture in front of the wall (bookshelf, lamp, plant)
    canvasTex(scene, 'bg_room_1', BGW, 272, ({ px, rect }) => {
      // bookshelf
      const bx = 380, by = 82, bw = 92, bh = 130;
      rect(bx - 1, by - 1, bw + 2, bh + 2, INK); rect(bx, by, bw, bh, 0x3e2a22); rect(bx + 3, by + 3, bw - 6, bh - 6, 0x22161a);
      rect(bx, by, bw, 2, 0x5a3e30);
      const BOOK = [0x8a4f5a, 0x4f6f8a, 0x6f8a5a, 0xb08a4f, 0x6a5a8a, 0x9a6a4a, 0x4a7a7a, 0xc07a6a];
      for (let s = 0; s < 4; s++) {
        const sy = by + 3 + s * 32;
        rect(bx + 3, sy + 28, bw - 6, 3, 0x5a3e30); rect(bx + 3, sy + 28, bw - 6, 1, 0x7a5640);
        let x = bx + 5, k = s * 7;
        while (x < bx + bw - 10) {
          const w2 = 4 + Math.floor(hash(k, 11) * 4), h2 = 16 + Math.floor(hash(k, 12) * 10), c = BOOK[k % BOOK.length];
          if (hash(k, 13) < 0.12 && s !== 1) { x += 6; k++; continue; }
          const lean = hash(k, 14) < 0.1;
          for (let y = 0; y < h2; y++) for (let xx = 0; xx < w2; xx++) px(x + xx + (lean ? Math.floor(y / 6) : 0), sy + 28 - h2 + y, xx === 0 ? mix(c, 0xffffff, 0.2) : xx === w2 - 1 ? mix(c, 0, 0.35) : c);
          rect(x + 1, sy + 28 - h2 + 3, w2 - 2, 1, mix(c, 0xf3c55e, 0.5));
          x += w2 + (lean ? 3 : 0); k++;
        }
      }
      // a sleeping toy mouse and a plant on top
      rect(bx + 10, by - 12, 14, 11, 0x8a4a3a); rect(bx + 9, by - 13, 16, 2, 0xa85e48); rect(bx + 10, by - 2, 14, 1, INK);
      for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI; px(bx + 17 + Math.round(Math.cos(a) * (6 + i % 3)), by - 14 - Math.round(Math.sin(a) * (6 + (i * 7) % 5)), i % 2 ? 0x5fa25e : 0x3f7a4e); }
      for (let i = 0; i < 10; i++) { px(bx + 17 + Math.round((hash(i, 2) - 0.5) * 10), by - 16 - Math.floor(hash(i, 3) * 8), 0x8fd07a); }
      // floor lamp with warm glow
      const lx = 338;
      glow(px, lx, 98, 60, 0xf6c76a, 0.22);
      rect(lx - 1, 108, 2, 100, 0x2a2430); rect(lx - 8, 206, 16, 3, 0x2a2430);
      for (let y = 0; y < 18; y++) { const half = 7 + Math.floor(y / 2); rect(lx - half, 88 + y, half * 2, 1, y < 2 ? 0xffe7a3 : y > 15 ? 0xc99548 : 0xf6c76a); px(lx - half - 1, 88 + y, INK); px(lx + half, 88 + y, INK); }
      rect(lx - 7, 87, 14, 1, INK); rect(lx - 16, 106, 32, 1, INK);
      glow(px, lx, 112, 16, 0xffe7a3, 0.5);
      // cat bed basket on the floor (decor)
      rect(196, 196, 40, 12, 0x6a4a36); rect(194, 194, 44, 3, 0x8a6446); for (let x = 196; x < 236; x += 4) rect(x, 198, 1, 10, 0x553a2a);
      rect(198, 192, 36, 3, 0xc07a8a);
    });
    // layer 2: near: hanging plants
    canvasTex(scene, 'bg_room_2', BGW, 272, ({ px }) => {
      [[30, 0, 38], [496, 0, 46]].forEach(([x0, y0, len]) => {
        for (let y = y0; y < y0 + 14; y++) px(x0, y, 0x3a3040);
        for (let y = 14; y < 20; y++) for (let x = -6; x <= 6; x++) if (Math.abs(x) < 7 - (y - 14) / 2) px(x0 + x, y, y === 14 ? 0x9a6a4a : 0x7a4f34);
        for (let v = -1; v <= 1; v++) for (let y = 0; y < len; y++) { const x = x0 + v * 4 + Math.round(Math.sin(y / 5 + v) * 2); px(x, 20 + y, 0x2c5640); if (y % 4 === 0) { px(x - 1, 20 + y, 0x5fa25e); px(x + 1, 21 + y, 0x3f7a4e); } }
      });
    });
  }

  function buildGarden(scene) {
    canvasTex(scene, 'bg_garden_0', BGW, 272, ({ px }) => {
      grad(px, 0, 0, BGW, 272, [0x161a38, 0x222650, 0x3a3268, 0x5e3e72, 0x95527a, 0xd0767a, 0xeea07a, 0xf6c08a]);
      stars(px, 0, 0, BGW, 110, 70, 21);
      moon(px, 410, 44, 10, true);
      // soft dusk clouds lit from below
      [[90, 70, 46], [260, 52, 60], [470, 92, 40]].forEach(([cx, cy, w2]) => {
        for (let y = -6; y <= 6; y++) for (let x = -w2; x <= w2; x++) {
          const inside = (x / w2) ** 2 + (y / 6) ** 2 < 1 && !(y < -2 && Math.abs(x) > w2 * 0.6);
          if (inside) px(cx + x, cy + y, y > 2 ? 0xd88a8e : y > -1 ? 0x8a5a86 : 0x5e4a7e, 0.85);
        }
      });
      // far hills
      for (let x = 0; x < BGW; x++) { const h = 178 + Math.round(Math.sin(x / 55) * 12 + Math.sin(x / 17) * 3); for (let y = h; y < 272; y++) px(x, y, y === h ? 0x4a4278 : 0x352f5e); }
    });
    canvasTex(scene, 'bg_garden_1', BGW, 272, ({ px, rect }) => {
      // tree line silhouettes
      for (let i = 0; i < 14; i++) {
        const cx = Math.floor(i * 40 + hash(i, 5) * 20), r = 16 + Math.floor(hash(i, 6) * 14), cy = 196 - r * 0.6;
        for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) { const dd = x * x + y * y * 1.2; if (dd < r * r && !(dd > (r - 2) ** 2 && dith(cx + x, cy + y) < 0.5)) px(cx + x, cy + y, y < -r * 0.5 && x < 0 ? 0x2c3458 : 0x232a4a); }
        rect(cx - 2, cy + r - 6, 4, 30, 0x1d2240);
      }
      // garden fence
      for (let x = 0; x < BGW; x++) { if (x % 12 < 8) { for (let y = 200; y < 240; y++) px(x, y, (x % 12 === 0) ? 0x3a3660 : 0x2c2a4e); px(x, 199, 0x4a4678); px(x, 198, x % 12 > 1 && x % 12 < 6 ? 0x4a4678 : null); } if (x % 12 >= 8) { px(x, 210, 0x2c2a4e); px(x, 211, 0x2c2a4e); px(x, 228, 0x2c2a4e); px(x, 229, 0x2c2a4e); } }
      for (let y = 240; y < 272; y++) for (let x = 0; x < BGW; x++) px(x, y, 0x1c2238);
      // lantern on a post
      const lx = 300; rect(lx, 150, 2, 90, 0x161a2c); rect(lx - 5, 144, 12, 10, 0x161a2c); rect(lx - 4, 145, 10, 8, 0xf6c76a); rect(lx - 4, 145, 10, 1, 0xffe7a3);
      glow(px, lx + 1, 149, 34, 0xf6c76a, 0.3);
    });
    canvasTex(scene, 'bg_garden_2', BGW, 272, ({ px }) => {
      // foreground bushes with flowers along the bottom
      for (let x = 0; x < BGW; x++) { const h = 238 + Math.round(Math.sin(x / 13) * 6 + Math.sin(x / 5.3) * 2); for (let y = h; y < 272; y++) px(x, y, y < h + 2 ? 0x2a4a48 : 0x1d3436); }
      for (let i = 0; i < 46; i++) { const x = Math.floor(hash(i, 31) * BGW), y = 240 + Math.floor(hash(i, 32) * 22); const c = [0xe58aa6, 0xf3c55e, 0xe8ecff, 0xb98ae0][i % 4]; px(x, y, c); px(x - 1, y, mix(c, 0, 0.3)); px(x + 1, y, mix(c, 0, 0.3)); px(x, y - 1, mix(c, 0xffffff, 0.3)); px(x, y + 1, 0x3f7a4e); }
    });
  }

  function buildRoof(scene) {
    canvasTex(scene, 'bg_roof_0', BGW, 272, ({ px }) => {
      grad(px, 0, 0, BGW, 272, [0x0c1024, 0x121733, 0x1a2044, 0x242a56, 0x343466, 0x4a3e70]);
      stars(px, 0, 0, BGW, 190, 150, 41);
      // a faint milky way band
      for (let i = 0; i < 400; i++) { const t = hash(i, 51); const x = Math.floor(t * BGW), y = Math.floor(30 + t * 90 + (hash(i, 52) - 0.5) * 30); px(x, y, 0x8a92c8, 0.25 + hash(i, 53) * 0.3); }
      moon(px, 96, 52, 16, false);
    });
    canvasTex(scene, 'bg_roof_1', BGW, 272, ({ px, rect }) => {
      let x = 0, i = 0;
      while (x < BGW) {
        const bw = 22 + Math.floor(hash(i, 9) * 26), bh = 60 + Math.floor(hash(i, 10) * 80), top = 272 - bh;
        rect(x, top, bw - 1, bh, 0x1c2244); rect(x, top, bw - 1, 1, 0x2a3260);
        if (hash(i, 12) < 0.3) { rect(x + Math.floor(bw / 2), top - 14, 1, 14, 0x1c2244); px(x + Math.floor(bw / 2), top - 15, 0xe85a5a); glow(px, x + Math.floor(bw / 2), top - 15, 4, 0xe85a5a, 0.4); }
        for (let wy = top + 6; wy < 262; wy += 7) for (let wx = x + 3; wx < x + bw - 4; wx += 5) if (hash(wx, wy, 2) > 0.62) rect(wx, wy, 2, 3, hash(wx, wy, 1) > 0.3 ? 0xa88a4a : 0x6a6aa0);
        x += bw; i++;
      }
    });
    canvasTex(scene, 'bg_roof_2', BGW, 272, ({ px, rect }) => {
      let x = -10, i = 0;
      while (x < BGW) {
        const bw = 40 + Math.floor(hash(i, 19) * 40), bh = 40 + Math.floor(hash(i, 20) * 50), top = 272 - bh;
        rect(x, top, bw - 2, bh, 0x121630); rect(x, top, bw - 2, 2, 0x232a50);
        for (let wy = top + 8; wy < 266; wy += 10) for (let wx = x + 5; wx < x + bw - 8; wx += 9) if (hash(wx, wy, 7) > 0.55) { rect(wx, wy, 4, 5, 0xf6c76a); rect(wx, wy, 4, 1, 0xffe7a3); rect(wx + 2, wy, 1, 5, 0xc99548); glow(px, wx + 2, wy + 2, 6, 0xf6c76a, 0.15); }
        if (i === 2) { // water tower
          const tx = x + 10; rect(tx, top - 34, 26, 22, 0x232a50); rect(tx - 2, top - 36, 30, 3, 0x2e3664); for (let k = 0; k < 4; k++) rect(tx + 2 + k * 7, top - 12, 1, 12, 0x232a50);
          for (let y = top - 33; y < top - 13; y += 4) rect(tx, y, 26, 1, 0x1a1f3e);
        }
        x += bw + 6; i++;
      }
    });
  }

  // ---------- level tiles: the whole static map is drawn into one canvas (autotiled) ----------
  function drawLevel(scene, key, map, theme, extra = {}) {
    const th = THEMES[theme] || THEMES.room;
    const R = map.length, C = map[0].length, S = 16;
    const solid = (c, r) => (r < 0 || r >= R || c < 0 || c >= C) ? null : map[r][c] === '#';
    canvasTex(scene, key, C * S, R * S, ({ px, rect, get }) => {
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const ch = map[r][c], X = c * S, Y = r * S;
        if (ch === '#') {
          const up = solid(c, r - 1) !== false, top = solid(c, r - 1) === false;
          // fill texture
          for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
            let col = th.fill[0];
            const h = hash(X + x, Y + y, 9);
            if (theme === 'roof') { const by = (Y + y) % 8, bx = (X + x + (Math.floor((Y + y) / 8) % 2) * 8) % 16; col = (by === 7 || bx === 15) ? th.fill[1] : (by === 0 ? th.fill[2] : th.fill[0]); }
            else if (theme === 'room') { const by = (Y + y) % 16; col = by === 15 ? th.fill[1] : (h > 0.93 ? th.fill[2] : th.fill[0]); if ((X + x) % 32 === 0) col = th.fill[1]; }
            else { col = h > 0.92 ? th.fill[2] : h < 0.05 ? th.fill[1] : th.fill[0]; if (hash(Math.floor((X + x) / 5), Math.floor((Y + y) / 4), 3) > 0.9) col = 0x433541; }
            px(X + x, Y + y, col);
          }
          if (top) {
            if (theme === 'garden') {
              for (let x = 0; x < S; x++) { const d = 4 + (hash(X + x, Y, 4) > 0.6 ? 1 : 0) + ((X + x) % 7 === 0 ? 1 : 0); for (let y = 0; y < d; y++) px(X + x, Y + y, y === 0 ? th.top[0] : y < 2 ? th.top[1] : y < d - 1 ? th.top[2] : th.top[3]); }
              for (let x = 0; x < S; x += 1) if (hash(X + x, Y, 5) > 0.7) px(X + x, Y - 1, th.top[1]);
              if (hash(c, r, 8) > 0.6) { const fx = X + 3 + Math.floor(hash(c, r, 9) * 10), fc = [0xe58aa6, 0xf3c55e, 0xe8ecff][Math.floor(hash(c, r, 10) * 3)]; px(fx, Y - 2, th.top[2]); px(fx, Y - 3, fc); px(fx - 1, Y - 3, mix(fc, 0, 0.25)); px(fx + 1, Y - 3, mix(fc, 0, 0.25)); px(fx, Y - 4, mix(fc, 0xffffff, 0.35)); }
            } else if (theme === 'room') {
              for (let x = 0; x < S; x++) for (let y = 0; y < 6; y++) { const seam = (X + x + (r % 2) * 8) % 24 === 0; px(X + x, Y + y, y === 0 ? th.top[0] : seam ? th.top[3] : y === 5 ? th.top[3] : y > 3 ? th.top[2] : th.top[1]); }
              if ((X / 16) % 3 === 1) px(X + 6, Y + 2, th.top[3]);
            } else {
              for (let x = 0; x < S; x++) for (let y = 0; y < 6; y++) { const sh = ((X + x + (y > 2 ? 4 : 0)) % 8 === 0); px(X + x, Y + y, y === 0 ? th.top[0] : sh ? th.top[3] : y === 3 ? th.top[3] : y < 3 ? th.top[1] : th.top[2]); }
            }
          }
          // ink outline on every exposed edge + soft bevel
          const L = solid(c - 1, r) === false, Rr = solid(c + 1, r) === false, B = solid(c, r + 1) === false;
          if (top) { for (let x = 0; x < S; x++) px(X + x, Y - 1, INK, get(X + x, Y - 1) == null ? 1 : 0); }
          if (L) for (let y = 0; y < S; y++) { px(X, Y + y, INK); px(X + 1, Y + y, mix(th.fill[0], 0xffffff, 0.08)); }
          if (Rr) for (let y = 0; y < S; y++) { px(X + S - 1, Y + y, INK); px(X + S - 2, Y + y, th.fill[1]); }
          if (B) for (let x = 0; x < S; x++) { px(X + x, Y + S - 1, INK); px(X + x, Y + S - 2, th.fill[1]); }
          if (top && L) { px(X, Y, null); px(X + 1, Y, INK); px(X, Y + 1, INK); }
          if (top && Rr) { px(X + S - 2, Y, INK); px(X + S - 1, Y + 1, INK); }
        } else if (ch === '=') {
          const p = th.plank, l = map[r][c - 1] !== '=', rr = map[r][c + 1] !== '=';
          rect(X, Y, S, 5, p[0]); rect(X, Y + 3, S, 2, p[1]); rect(X, Y, S, 1, mix(p[0], 0xffffff, 0.25)); rect(X, Y + 5, S, 1, INK); rect(X, Y - 1, S, 1, INK);
          px(X + 5, Y + 2, p[2]); px(X + 11, Y + 1, p[2]);
          if (l) { rect(X, Y - 1, 1, 7, INK); px(X, Y - 1, null); px(X + 1, Y, INK); rect(X + 2, Y + 6, 2, 4, p[2]); rect(X + 1, Y + 6, 1, 4, INK); }
          if (rr) { rect(X + S - 1, Y - 1, 1, 7, INK); px(X + S - 1, Y - 1, null); px(X + S - 2, Y, INK); rect(X + S - 4, Y + 6, 2, 4, p[2]); rect(X + S - 2, Y + 6, 1, 4, INK); }
        }
      }
      if (extra.after) extra.after({ px, rect, get });
    });
  }

  // ================= props =================
  function buildProps(scene) {
    const k = INK;
    rowsTex(scene, 'heart', ['.kk.kk.', 'krhkrrk', 'krhrrrk', 'krrrrdk', '.krrdk.', '..kdk..', '...k...'], { k, r: 0xe8577a, h: 0xffb3c6, d: 0xa83a5a });
    rowsTex(scene, 'heartEmpty', ['.kk.kk.', 'keekeek', 'keeeeek', 'keeeeek', '.keeek.', '..kek..', '...k...'], { k, e: 0x3a4566 });
    const FISH = ['k...kkkkk...', 'kk.kbbbbbk..', 'kbkbbhhbwek.', 'kbbbbbbbbbbk', 'kbkbllllbbk.', 'kk.kdbbbdk..', 'k...kkkkk...'];
    rowsTex(scene, 'fish', FISH, { k, b: 0x6fa8dc, h: 0xb4dcf8, l: 0xd8ecf8, d: 0x3f6aa0, w: 0xffffff, e: 0x0d0f17 });
    rowsTex(scene, 'gold', FISH, { k: 0x4a2e08, b: 0xf3c55e, h: 0xfff0b0, l: 0xfff6d0, d: 0xb3822a, w: 0xffffff, e: 0x0d0f17 });
    rowsTex(scene, 'yarn', ['..kkkk...', '.kpPhpk..', 'kpPppPpk.', 'kPppPhpk.', 'kppPppPk.', 'kpPpPpPk.', '.kdPpdk..', '..kkkk.k.', '.......kk'], { k, p: 0xb98ae0, P: 0x8a5ab8, h: 0xe2c8ff, d: 0x6a4096 });
    rowsTex(scene, 'star', ['..k..', '.kyk.', 'kyyyk', '.kyk.', '.k.k.'], { k: 0x6a4a10, y: 0xffe066 });
    rowsTex(scene, 'sparkle', ['..w..', '..y..', 'wyWyw', '..y..', '..w..'], { w: 0xfff6d8, y: 0xffe066, W: 0xffffff });
    rowsTex(scene, 'cup', ['.kkkkkkkk..', 'kwwwwwwwwk.', 'kppppppppkkk', 'kwwwwwwwwk.k', 'kwwwwwwwdkkk', '.kwwwwwdk..', '..kkkkkk...'], { k, w: 0xe8e4f0, p: 0xe58aa6, d: 0xa8a0bc });
    rowsTex(scene, 'shadow', ['.kkkkkkkk.', 'kkkkkkkkkk', '.kkkkkkkk.'], { k: 0x05060c });
    rowsTex(scene, 'shard', ['k.k.', '.w.k', 'k.p.'], { k: 0xe8e4f0, w: 0xe58aa6, p: 0xa8a0bc });
    rowsTex(scene, 'note', ['..kk', '..kk', '..k.', '..k.', 'kkk.', 'kkk.'], { k: 0xe8ecff });
    rowsTex(scene, 'zz', ['kkkk....', '..k.....', '.k......', 'kkkk.kkk', '......k.', '.....kkk'], { k: 0xbac6ff });
    rowsTex(scene, 'paw', ['.k.k.', 'k.k.k', '.....', '.kkk.', 'kkkkk', '.kkk.'], { k: 0xffffff });
    rowsTex(scene, 'firefly', ['.g.', 'gYg', '.g.'], { g: 0x9ad65a, Y: 0xf2ffb0 });
    rowsTex(scene, 'twinkle', ['...w...', '...w...', '.......', 'ww.W.ww', '.......', '...w...', '...w...'], { w: 0x9aa8e8, W: 0xffffff });
    for (let i = 0; i < 3; i++) canvasTex(scene, 'dust' + i, 9, 7, ({ px }) => {
      const r = [2.2, 3, 3.4][i];
      for (let y = 0; y < 7; y++) for (let x = 0; x < 9; x++) { const dd = Math.hypot(x - 4, (y - 3.5) * 1.3); if (dd < r && (i < 2 || dith(x, y) < 0.6)) px(x, y, dd < r - 1.2 ? 0xd8deee : 0x9aa2c0, i === 2 ? 0.7 : 1); }
    });
    // vacuum robot 26x11
    canvasTex(scene, 'vacuum', 26, 12, ({ px, rect }) => {
      rect(2, 2, 22, 8, k); rect(1, 3, 24, 6, k); rect(0, 4, 26, 4, k);
      rect(2, 3, 22, 6, 0x7a8098); rect(1, 4, 24, 4, 0x7a8098); rect(3, 3, 20, 2, 0xaab2cc); rect(4, 3, 18, 1, 0xd8deee);
      rect(9, 1, 8, 2, k); rect(10, 1, 6, 1, 0x5a6080); rect(1, 7, 24, 1, 0x4a5068);
      px(19, 5, 0xff5a5a); px(20, 5, 0xff5a5a); px(19, 4, 0xffb0b0); px(6, 5, 0x7cc8a4);
      rect(4, 10, 4, 2, k); rect(18, 10, 4, 2, k); rect(0, 5, 2, 2, 0xe58aa6);
    });
    // big boss vacuum 56x26 (angry)
    canvasTex(scene, 'bossvac', 58, 28, ({ px, rect }) => {
      for (let y = 0; y < 22; y++) for (let x = 0; x < 58; x++) { const dd = ((x - 28.5) / 29) ** 2 + ((y - 13) / 10) ** 2; if (dd < 1) px(x, y + 2, dd > 0.86 ? k : y < 6 ? 0xb8bed4 : y < 15 ? 0x7a8098 : 0x4a5068); }
      rect(20, 0, 18, 5, k); rect(21, 1, 16, 3, 0x5a6080); rect(27, -1, 4, 2, k);
      rect(14, 10, 8, 4, k); rect(36, 10, 8, 4, k); rect(15, 11, 6, 2, 0xff4a4a); rect(37, 11, 6, 2, 0xff4a4a); px(16, 11, 0xffd0d0); px(38, 11, 0xffd0d0);
      rect(13, 8, 9, 1, k); rect(36, 8, 9, 1, k); px(21, 9, k); px(36, 9, k);
      rect(22, 17, 14, 2, k); for (let x = 23; x < 35; x += 3) px(x, 17, 0xd8deee);
      rect(6, 23, 8, 5, k); rect(44, 23, 8, 5, k); rect(7, 24, 6, 3, 0x2a2e40); rect(45, 24, 6, 3, 0x2a2e40);
    });
    // cardboard box 15x15
    canvasTex(scene, 'box', 15, 15, ({ px, rect }) => {
      rect(0, 0, 15, 15, k); rect(1, 1, 13, 13, 0xb88350); rect(1, 1, 13, 3, 0xd9a56c); rect(1, 4, 13, 1, 0x8a5a33);
      rect(12, 5, 2, 9, 0x9a6a3e); rect(1, 13, 13, 1, 0x8a5a33); rect(6, 1, 3, 4, 0xe8d6a8); rect(6, 4, 3, 1, 0xb8a47a);
      sil(px, 4, 7, ['.k.k.', 'k.k.k', '.kkk.', 'kkkkk', '.kkk.'].map(r => r), { k: 0x8a5a33 });
      px(1, 1, 0xf0c48a);
    });
    // pressure plates per channel & gate doors
    const CHC = { a: [0xe58aa6, 0xffc0d4, 0xa8506e], b: [0x6fa8dc, 0xb8dcff, 0x3f6aa0], c: [0xf3c55e, 0xfff0b0, 0xb3822a] };
    for (const [ch, [c1, c2, c3]] of Object.entries(CHC)) {
      canvasTex(scene, `plate_${ch}`, 14, 5, ({ rect }) => { rect(2, 0, 10, 3, k); rect(3, 0, 8, 2, c1); rect(3, 0, 8, 1, c2); rect(0, 3, 14, 2, k); rect(1, 3, 12, 1, 0x5a6080); });
      canvasTex(scene, `plateP_${ch}`, 14, 5, ({ rect }) => { rect(2, 2, 10, 1, k); rect(3, 2, 8, 1, c3); rect(0, 3, 14, 2, k); rect(1, 3, 12, 1, 0x5a6080); });
      canvasTex(scene, `door_${ch}`, 16, 16, ({ px, rect }) => {
        rect(1, 0, 14, 16, k); rect(2, 0, 12, 16, 0x1a1f33);
        for (let x = 3; x < 14; x += 4) { rect(x, 0, 2, 16, c1); rect(x, 0, 1, 16, c2); rect(x + 1, 0, 1, 16, c3); }
        rect(2, 6, 12, 4, k); rect(3, 7, 10, 2, c3); px(7, 7, c2); px(8, 7, c2); px(7, 8, k); px(8, 8, k);
      });
      canvasTex(scene, `doorO_${ch}`, 16, 16, ({ px }) => { for (let y = 0; y < 16; y += 2) { px(1, y, c3); px(14, y, c3); } px(2, 0, c3); px(13, 0, c3); });
      // tinted gems for HUD/channel markers
      rowsTex(scene, `gem_${ch}`, ['.kk.', 'khck', 'kcdk', '.kk.'], { k, h: c2, c: c1, d: c3 });
    }
    // levers (on/off), launch pad, spring, conveyor, colour platforms, bridge, boss button
    for (const on of [0, 1]) canvasTex(scene, 'lever' + on, 16, 16, ({ px, rect }) => {
      const a = on ? 0.7 : -0.7;
      for (let t = 0; t < 10; t++) { const x = 8 + Math.round(Math.sin(a) * t), y = 12 - Math.round(Math.cos(a) * t); px(x, y, 0x8a90a8); px(x + 1, y, k); px(x - 1, y, k); }
      const tx = 8 + Math.round(Math.sin(a) * 10), ty = 12 - Math.round(Math.cos(a) * 10);
      rect(tx - 2, ty - 2, 5, 5, k); rect(tx - 1, ty - 1, 3, 3, on ? 0x7cc8a4 : 0xe85a5a); px(tx - 1, ty - 1, 0xffffff);
      rect(3, 12, 10, 4, k); rect(4, 13, 8, 2, 0x4a5068); rect(4, 13, 8, 1, 0x7a8098);
    });
    for (const on of [0, 1]) canvasTex(scene, 'launch' + on, 16, 8, ({ rect, px }) => {
      const h = on ? 2 : 5;
      rect(0, 8 - 3, 16, 3, k); rect(1, 6, 14, 1, 0x5a6080);
      for (let y = 8 - 3 - h; y < 5; y++) { px(4, y, (y % 2) ? 0xd8deee : 0x8a90a8); px(11, y, (y % 2) ? 0xd8deee : 0x8a90a8); }
      rect(1, 8 - 4 - h, 14, 2, k); rect(2, 8 - 4 - h, 12, 1, 0xf3c55e);
    });
    canvasTex(scene, 'spring', 16, 8, ({ rect, px }) => { rect(0, 5, 16, 3, k); rect(1, 6, 14, 1, 0x5a6080); for (let y = 1; y < 5; y++) for (let x = 3; x < 13; x++) if ((x + y) % 4 === 0) px(x, y, 0xd8deee); rect(1, 0, 14, 2, k); rect(2, 0, 12, 1, 0xe85a5a); });
    for (let f = 0; f < 4; f++) canvasTex(scene, 'conv' + f, 16, 16, ({ rect, px }) => {
      rect(0, 0, 16, 16, k); rect(1, 1, 14, 6, 0x3a4058); rect(1, 1, 14, 1, 0x5a6080);
      for (let x = 0; x < 16; x += 4) { const X = (x + f) % 16; px(X, 3, 0xf3c55e); px(X + 1, 4, 0xf3c55e); px(X, 5, 0xf3c55e); }
      rect(1, 8, 14, 7, 0x252a3c); rect(1, 8, 14, 1, 0x10131f);
      for (const cx of [4, 11]) { rect(cx - 2, 10, 4, 4, 0x4a5068); px(cx - 1 + (f % 2), 11 + (f >> 1), 0x8a90a8); }
      for (let y = 9; y < 15; y += 2) px(7, y, 0xf3c55e, 0.5);
    });
    const crate = (key, base, hi, lo, mark, ghost) => canvasTex(scene, key, 16, 16, ({ rect, px }) => {
      if (ghost) { for (let i = 0; i < 16; i += 2) { px(i, 0, hi, 0.8); px(i, 15, hi, 0.8); px(0, i, hi, 0.8); px(15, i, hi, 0.8); } sil(px, 6, 6, ['k.k', 'kkk', '.k.'], { k: hi }); return; }
      rect(0, 0, 16, 16, k); rect(1, 1, 14, 14, base); rect(1, 1, 14, 1, hi); rect(1, 14, 14, 1, lo); rect(1, 1, 1, 14, mix(base, hi, 0.5)); rect(14, 1, 1, 14, lo);
      rect(3, 3, 10, 10, mix(base, lo, 0.35)); rect(3, 3, 10, 1, lo); rect(4, 4, 8, 8, base);
      sil(px, 5, 5, ['.k.k..', 'kkkk..', 'kkkk..', '.kk...'].map(r => r), { k: mark });
    });
    crate('cplat_d', 0x2a2640, 0x4a4470, 0x16141f, 0xf3c55e); crate('cplat_l', 0xe0b88a, 0xfff0d0, 0xb08458, 0xe58aa6);
    crate('cghost_d', 0, 0x6a64a0, 0, 0, true); crate('cghost_l', 0, 0xe0b88a, 0, 0, true);
    for (let f = 0; f < 2; f++) canvasTex(scene, 'water' + f, 16, 16, ({ px, rect }) => {
      rect(0, 4, 16, 12, 0x24406a); rect(0, 8, 16, 8, 0x1a2f52);
      for (let x = 0; x < 16; x++) { const y = 4 + ((x + f * 3) % 6 < 3 ? 0 : 1); px(x, y, 0x7fb0e0); }
      px((5 + f * 6) % 16, 9, 0x9ac8f0); px((12 + f * 5) % 16, 12, 0x7fb0e0);
    });
    for (const on of [0, 1]) canvasTex(scene, 'xswitch' + on, 16, 16, ({ rect, px }) => {
      rect(3, 12, 10, 4, k); rect(4, 13, 8, 2, 0x4a5068);
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) { const d = Math.hypot(x - 4.5, y - 4.5); if (d < 5) px(3 + x, 2 + y, d > 4 ? k : ((x < 5) !== !!on ? 0x2a2640 : 0xe0b88a)); }
      px(6, 5, 0xe0b88a); px(10, 8, 0x2a2640);
    });
    canvasTex(scene, 'bridge', 16, 8, ({ rect, px }) => { rect(0, 0, 16, 6, k); rect(1, 1, 14, 4, 0x8a6a4e); rect(1, 1, 14, 1, 0xb08a64); px(4, 3, 0x553522); px(11, 3, 0x553522); rect(7, 1, 1, 4, 0x553522); });
    for (const on of [0, 1]) canvasTex(scene, 'bbtn' + on, 16, 8, ({ rect }) => { rect(0, 5, 16, 3, k); rect(1, 6, 14, 1, 0x5a6080); rect(3, on ? 3 : 1, 10, on ? 2 : 4, k); rect(4, on ? 3 : 2, 8, on ? 1 : 2, on ? 0x7cc8a4 : 0xe85a5a); });
    // the cat house (goal) 32x36
    canvasTex(scene, 'house', 34, 38, ({ px, rect }) => {
      rect(4, 16, 26, 22, k); rect(5, 17, 24, 20, 0x8a5a44);
      for (let y = 17; y < 37; y += 4) rect(5, y, 24, 1, 0x6a4232);
      rect(5, 17, 1, 20, 0xa87458); rect(28, 17, 1, 20, 0x5a3626);
      for (let y = 0; y < 17; y++) { const half = Math.floor(y * 17 / 16) + 1; for (let x = 17 - half; x < 17 + half; x++) px(x, y + 1, y < 1 ? 0x7f8ab0 : ((x + y) % 4 === 0 ? 0x2f3552 : (y % 4 === 3 ? 0x343b5c : 0x4a5272))); px(17 - half - 1, y + 1, k); px(17 + half, y + 1, k); }
      rect(0, 17, 34, 2, k); rect(1, 17, 32, 1, 0x5a6488);
      rect(24, 2, 5, 9, k); rect(25, 3, 3, 8, 0x5a3a44);
      // round door with warm glow
      for (let y = 0; y < 13; y++) for (let x = 0; x < 12; x++) { const dd = ((x - 5.5) / 6) ** 2 + ((y - 6) / 7) ** 2; if (y > 5 ? x >= 0 : dd < 1) px(11 + x, 24 + y, (x === 0 || x === 11 || (y <= 5 && dd > 0.7)) ? k : 0x1a1420); }
      glow(px, 17, 32, 6, 0xf6c76a, 0.45);
      rect(7, 21, 5, 5, k); rect(8, 22, 3, 3, 0xf6c76a); px(8, 22, 0xffe7a3);
      rect(22, 21, 5, 5, k); rect(23, 22, 3, 3, 0xf6c76a); px(23, 22, 0xffe7a3);
      sil(px, 14, 8, ['.r.r.', 'rrrrr', '.rrr.', '..r..'], { r: 0xe8577a });
    });
    rowsTex(scene, 'swipe', ['..ww.....', '....wW...', '.....wW..', '......wW.', '......wW.', '.....wW..', '....wW...', '..ww.....'], { w: 0xe8ecff, W: 0xffffff });
    canvasTex(scene, 'ring', 64, 64, ({ px }) => { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const d = Math.hypot(x - 31.5, y - 31.5); if (d > 28 && d < 31) px(x, y, (x + y) % 4 < 2 ? 0xffffff : 0xb98ae0); } });
    rowsTex(scene, 'pip', ['.kkk.', 'kyyyk', 'kywyk', 'kyyyk', '.kkk.'], { k, y: 0xf3c55e, w: 0xfff6d0 });
    rowsTex(scene, 'pipEmpty', ['.kkk.', 'keeek', 'keeek', 'keeek', '.kkk.'], { k, e: 0x3a4566 });
    canvasTex(scene, 'cloud', 52, 18, ({ px }) => { for (let y = 0; y < 18; y++) for (let x = 0; x < 52; x++) { const inside = ((x - 16) ** 2 + (y - 10) ** 2 * 1.6 < 90) || ((x - 28) ** 2 + (y - 8) ** 2 * 1.4 < 120) || ((x - 38) ** 2 + (y - 11) ** 2 * 1.6 < 60); if (inside) px(x, y, y > 12 ? 0x8a8ab8 : 0xb8bede, 0.8); } });
    canvasTex(scene, 'px', 1, 1, ({ px }) => px(0, 0, 0xffffff));
    // circles (for minigames) r = 2..24
    [2, 3, 4, 5, 6, 8, 10, 12, 16, 24].forEach(r => canvasTex(scene, 'circ' + r, r * 2, r * 2, ({ px }) => { for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) if ((x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2 <= r * r) px(x, y, 0xffffff); }));
    [3, 4, 5, 6, 8, 10, 12, 16].forEach(r => canvasTex(scene, 'ringc' + r, r * 2, r * 2, ({ px }) => { for (let y = 0; y < r * 2; y++) for (let x = 0; x < r * 2; x++) { const d = (x + 0.5 - r) ** 2 + (y + 0.5 - r) ** 2; if (d <= r * r && d > (r - 1) * (r - 1)) px(x, y, 0xffffff); } }));
  }

  // ---------- logo: "喵喵成行" with both cats underneath ----------
  function buildLogo(scene, fontFamily) {
    const text = '喵喵成行', S = 24; // Zpix at 24px = 2x pixel glyphs
    canvasTex(scene, 'logo', 4 * S + 16, S + 34, ({ px, get, withCtx, w, h }) => {
      withCtx((ctx) => { ctx.font = `${S}px ${fontFamily}`; ctx.textBaseline = 'top'; ctx.fillStyle = '#ffffff'; ctx.fillText(text, 8, 4); });
      const mask = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = get(x, y); if (c != null && (c & 255) > 128) mask.push([x, y]); }
      // clear, then paint: shadow, outline, gradient fill, top highlight
      const M = new Set(mask.map(([x, y]) => x + ',' + y)), has = (x, y) => M.has(x + ',' + y);
      withCtx((ctx) => ctx.clearRect(0, 0, w, h));
      mask.forEach(([x, y]) => { px(x + 2, y + 2, 0x05060c); });
      mask.forEach(([x, y]) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) if (!has(x + dx, y + dy)) px(x + dx, y + dy, INK); });
      mask.forEach(([x, y]) => { const t = (y - 4) / S; px(x, y, !has(x, y - 1) ? 0xffffff : t < 0.45 ? 0xfff2cf : t < 0.7 ? 0xf6c76a : 0xe58aa6); });
    });
  }

  function build(scene) {
    window.CatArt.build(scene, canvasTex);
    // legacy frame aliases used by older code paths
    const alias = { happy: 'happy0', happy2: 'happy1', dizzy: 'dizzy0' };
    for (const c of ['cat0', 'cat1']) for (const [a, b] of Object.entries(alias)) {
      const src = scene.textures.get(`${c}_${b}`).getSourceImage();
      canvasTex(scene, `${c}_${a}`, src.width, src.height, ({ withCtx }) => withCtx(ctx => ctx.drawImage(src, 0, 0)));
    }
    Object.keys(THEMES).forEach(t => buildTheme(scene, t));
    buildProps(scene);
    buildLogo(scene, 'Zpix, monospace');
  }

  return { build, PX, THEMES, canvasTex, rowsTex, drawLevel, hash, mix, INK, dith, glow, BGW, grad, sil };
})();
