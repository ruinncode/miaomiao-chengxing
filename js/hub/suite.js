// 套房 — every hotel room is a small walk-through suite: 玄关 (entry) · 卧室 (the existing room) · 浴室 (bath) · 阳台 (balcony, where the building has one).
// Host-authoritative like the rest of travel: all suite state lives in st.ht and rides in the snapshot.
// Interiors are game-original (not the real hotels' rooms); tiers only change size/fixtures.
(function () {
  const M = Hub.MODES.travel, K = window.TravelKit, SC = window.Scenery, SCN = K.SCN, FLOOR = K.FLOOR, DT = K.DT, clamp = K.clamp, mix = SC.mix;
  const OURS = 3;
  // gentle SFX hooks — 游's audio clone fills these in; until then each falls back to an existing sound
  const SFXF = { shower: 'splash', door: 'click', kettle: 'pop', knock: 'pop', flush: 'splash', towel: 'pop', ice: 'pop', brush: 'pop', zip: 'click' };
  function sfx(ev, name) { ev('sfx2', name); }
  function playSafe(name) { const S = window.Sfx; if (!S) return; if (typeof S[name] === 'function') S.play(name); else if (SFXF[name] && typeof S[SFXF[name]] === 'function') S.play(SFXF[name]); else S.play('pop'); }

  // ---- tiers (keyed by the room style; a hotel can override with h.suite) ----
  const TIERS = {
    grand: { name: '海景套房', entryW: 600, bathW: 560, tub: 'free', shower: true, sinks: 2, nook: true, mini: true, robe: true, bathWin: true, wall: '#e8dcc8', tile: '#f2ebe0', tile2: '#e4dccd', floor: '#c8b8a0', floor2: '#b8a890', trim: '#c8a050' },
    std: { name: '高层房', entryW: 480, bathW: 480, tub: 'combo', shower: false, sinks: 1, nook: false, mini: true, balcony: true, wall: '#3a3f55', tile: '#c8d4dc', tile2: '#b8c6d0', floor: '#6a7480', floor2: '#5e6874', trim: '#e8e0d0' },
    small: { name: '小公寓', entryW: 400, bathW: 400, tub: null, shower: true, sinks: 1, nook: false, mini: false, wall: '#7a4a3a', tile: '#f0ece6', tile2: '#e2ded6', floor: '#3a3a40', floor2: '#323238', trim: '#2a2a30', brick: true },
  };
  const BYROOM = { condo: 'grand', modern: 'std', loft: 'small', cozy: 'std', paris: 'std', tropical: 'grand', ryokan: 'small', capsule: 'small' };
  function tierOf(s, cfg) { const h = K.hotel(s, cfg) || {}; return TIERS[h.suite] ? h.suite : (BYROOM[h.room] || 'std'); }
  function T(s, cfg) { return TIERS[tierOf(s, cfg)]; }
  const MENU = [['🐟', '烤三文鱼', 8], ['🍰', '小蛋糕', 6], ['🥛', '温牛奶', 0]];
  const DRINK = [['🍵', '热茶'], ['☕', '热可可']];

  function fresh() { return { h: null, dnd: 0, up: 0, wet: [0, 0], fr: [0, 0], inn: [0, 0], bt: [0, 0], br: [0, 0], tw: [0, 0], lk: [0, 0], fl: 0, tk: 0, kd: 0, dr: [0, 0], dk: 0, rs: 0, ri: 0, ro: 0, tray: -1, eat: 0, bd: 0, cnt: {} }; }
  function ensure(st, cfg) {
    const key = st.city + ':' + st.hotel;
    if (!st.ht || st.ht.h !== key) { const o = fresh(); o.h = key; if (st.ht) { o.fr = st.ht.fr.slice(); } st.ht = o; }
    return st.ht;
  }
  K.suiteTier = tierOf; K.SFX_HOOKS = SFXF;

  // ---- layouts (spot x per tier) ----
  function entryLay(t) {
    if (t === TIERS.grand) return { out: 26, dnd: 56, tray: 86, closet: 116, rack: 156, nook: 214, kettle: 272, mini: 304, phone: 356, menu: 382, bath: 452, arch: 560 };
    if (t === TIERS.small) return { out: 26, dnd: 56, tray: 86, closet: 116, rack: 150, kettle: 196, mini: 226, phone: 262, menu: 286, bath: 318, arch: 372 };
    return { out: 26, dnd: 56, tray: 86, closet: 116, rack: 156, kettle: 196, mini: 228, phone: 268, menu: 292, bath: 352, arch: 444 };
  }
  function bathLay(t) {
    if (t === TIERS.grand) return { door: 26, sink: 86, mirror: 126, towel: 182, wc: 226, shower: 290, tub: 412 };
    if (t === TIERS.small) return { door: 26, sink: 80, mirror: 106, towel: 150, wc: 194, shower: 300 };
    return { door: 26, sink: 86, mirror: 114, towel: 166, wc: 210, tub: 340 };
  }
  const camX = (s, w) => clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, Math.max(0, w - 480));

  // ======================= 玄关 entry =======================
  SCN.entry = {
    w: (s, cfg) => T(s, cfg).entryW,
    spots(s, cfg) {
      const t = T(s, cfg), L = entryLay(t), ht = s.ht || fresh(), m = MENU[ht.ri || 0];
      const out = [
        { id: 'out', x: L.out, w: 20, label: '出门（走廊）', k: 'out' },
        { id: 'dnd', x: L.dnd, w: 8, label: ht.dnd ? '摘下「请勿打扰」' : '挂上「请勿打扰」', k: 'dnd' },
        { id: 'closet', x: L.closet, w: 30, label: ht.up ? '把行李收回箱子' : '打开行李 · 挂进衣柜', k: 'closet' },
        { id: 'kettle', x: L.kettle, w: 16, label: ht.tk > 0 ? '水快开了…' : '烧水泡' + DRINK[ht.kd || 0][1] + '（免费）', k: 'kettle' },
        { id: 'phone', x: L.phone, w: 12, label: '☎ 客房服务：' + m[0] + m[1] + (m[2] ? ' ' + m[2] + '🪙' : ' 免费'), k: 'phone' },
        { id: 'menu', x: L.menu, w: 10, label: '翻翻菜单（换一道）', k: 'menu' },
        { id: 'bath', x: L.bath, w: 22, label: '浴室', k: 'bath' },
        { id: 'arch', x: L.arch, w: 30, label: '卧室', k: 'arch' },
      ];
      out.push({ id: 'mini', x: L.mini, w: 14, label: t.mini ? '迷你吧 · 小鱼干零食 3🪙' : '零食篮 · 小鱼干 2🪙', k: 'mini' });
      if (t.nook) out.push({ id: 'nook', x: L.nook, w: 36, label: '窝在小沙发上', k: 'cuddle', kind: 'sofa', y: FLOOR - 14 });
      if (ht.tray >= 0) out.push({ id: 'tray', x: L.tray, w: 14, label: '开动！' + MENU[ht.tray][0] + MENU[ht.tray][1], k: 'tray' });
      return out;
    },
    act(st, sp, who, cfg, ev) {
      const ht = ensure(st, cfg), t = T(st, cfg), L = entryLay(t);
      switch (sp.k) {
        case 'out': sfx(ev, 'door'); K.go(st, 'hall', { x: 160 + OURS * 96 }, ev); return;
        case 'arch': K.go(st, 'room', { x: 52 }, ev); return;
        case 'bath': sfx(ev, 'door'); K.go(st, 'bath', { x: 40 }, ev); return;
        case 'dnd': ht.dnd = ht.dnd ? 0 : 1; sfx(ev, 'door'); K.msg(st, ht.dnd ? '门外挂上了「请勿打扰 🌙」' : '摘下了牌子，打扫的猫可以来啦'); return;
        case 'closet': {
          const items = Object.keys(st.pack || {}), P = K.PACK || [];
          if (!ht.up) { if (!items.length) { K.msg(st, '箱子是空的——出发前记得收拾行李'); return; } ht.up = 1; sfx(ev, 'zip'); const nm = items.map(id => (P.find(p => p[0] === id) || [id, id, '·'])[2]).join(' '); K.msg(st, '把行李挂进衣柜 ' + nm, 2.6); ev('dcount', 'unpack'); }
          else { ht.up = 0; sfx(ev, 'zip'); K.msg(st, '行李收好啦，随时可以出发 🧳'); }
          return;
        }
        case 'kettle': if (ht.tk > 0) { K.msg(st, '再等一下下，咕嘟咕嘟…'); return; } ht.tk = 4; sfx(ev, 'kettle'); K.msg(st, '烧水中…要泡' + DRINK[ht.kd][1]); return;
        case 'mini': { const c = t.mini ? 3 : 2; if (!Wallet.spend(c)) { K.msg(st, '硬币不够啦'); return; } st.coins = Wallet.coins; ev('sfx', 'coin'); ht.dr = [0, 0]; ht.eat = 3; ht.ek = '🐟'; K.msg(st, '咔嚓咔嚓，小鱼干分着吃 🐟 −' + c + '🪙'); ev('dcount', 'snack'); return; }
        case 'menu': ht.ri = ((ht.ri || 0) + 1) % MENU.length; ev('sfx', 'page'); return;
        case 'phone': {
          if (ht.rs > 0 || ht.tray >= 0) { K.msg(st, ht.tray >= 0 ? '餐已经在门口啦，先吃吧' : '已经点过啦，马上就到'); return; }
          const m = MENU[ht.ri]; if (m[2] && !Wallet.spend(m[2])) { K.msg(st, '硬币不够啦'); return; } st.coins = Wallet.coins; if (m[2]) ev('sfx', 'coin');
          ht.rs = 7; ht.ro = ht.ri; ev('sfx', 'ding'); K.msg(st, '☎「您好，' + m[1] + '，马上送到喵」', 2.6); return;
        }
        case 'tray': { const m = MENU[ht.tray]; ht.eat = 3.5; ht.ek = m[0]; ht.tray = -1; ev('sfx', 'chimeS'); K.msg(st, '好好吃～' + m[0] + m[1] + ' ♥'); ev('diary', 'roomservice', { item: m[1] }); return; }
      }
    },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), t = T(s, cfg), L = entryLay(t), W = t.entryW, ox = camX(s, W), ht = s.ht || fresh(), tod = K.tod(s), night = tod === 'night';
      const rm = SC.ROOMS[h.room] || SC.ROOMS.cozy, X = (x) => x - ox;
      // walls + floor (same language as the bedroom: banded wallpaper, trim, plank floor)
      R.rect(0, 0, 480, 200, rm.wall);
      for (let x = -ox % 24; x < 480; x += 24) R.rect(x, 0, 12, 200, rm.wall2);
      if (rm.brick) for (let y = 0; y < 200; y += 6) for (let x = ((y / 6) % 2) * 8 - ox % 16; x < 480; x += 16) R.rect(x, y, 15, 5, SC.hash(x + ox, y) < .5 ? '#8a5040' : '#7a4434');
      R.rect(0, 196, 480, 4, rm.trim);
      for (let y = 200; y < 272; y += 6) { R.rect(0, y, 480, 6, (y / 6) % 2 ? rm.floor : rm.floor2); for (let x = ((y * 7) % 40) - ox % 40; x < 480; x += 40) R.rect(x, y, 1, 6, mix(rm.floor, '#000', .2)); }
      if (W < 480) { const ex = X(W); R.rect(ex, 0, 480 - ex, 272, '#1c1a22'); R.rect(ex, 0, 3, 200, rm.trim); }
      // ceiling spotlights
      for (let x = 60; x < W; x += 120) { const xx = X(x); if (xx < -20 || xx > 500) continue; R.rect(xx - 4, 0, 8, 3, '#e8e0d0'); if (night) SC.F.glow(R, xx, 6, 26, '#ffd88a', .25, 5); }
      // entry door (inside view) + DND hanger on the handle
      { const x = X(L.out); R.rect(x - 14, 104, 30, 96, rm.trim); R.rect(x - 12, 106, 26, 94, '#5a3a2a'); R.rect(x - 9, 112, 20, 36, '#634030'); R.rect(x - 9, 154, 20, 40, '#634030'); R.rect(x + 8, 152, 3, 8, '#e8c86a'); R.rect(x - 2, 120, 6, 4, '#c8ccd4'); R.rect(x - 1, 121, 4, 2, '#333');
        R.rect(x - 22, 176, 8, 2, '#8a7a6a'); R.rect(x - 22, 172, 8, 4, '#b8a888'); // shoe mat
        const dx = X(L.dnd); R.rect(dx - 1, 150, 2, 4, '#c8a050');
        if (ht.dnd) { R.rect(dx - 6, 154, 12, 22, '#2a2a5a'); R.rect(dx - 5, 155, 10, 20, '#3a3a7a'); R.text('勿扰', dx, 160, { al: 'c', c: '#ffe8a0', sh: false }); R.px(dx - 2, 171, '#ffe8a0'); R.px(dx + 1, 171, '#ffe8a0'); }
        else { R.rect(dx - 5, 154, 10, 18, '#e8e0d0'); R.rect(dx - 4, 156, 8, 4, '#8fd08a'); }
      }
      // room-service cart at the door when it arrives
      if (ht.tray >= 0) { const x = X(L.tray); R.rect(x - 12, FLOOR - 16, 24, 2, '#e8e0d0'); R.rect(x - 11, FLOOR - 14, 2, 14, '#a8a8b4'); R.rect(x + 9, FLOOR - 14, 2, 14, '#a8a8b4'); R.rect(x - 12, FLOOR - 6, 24, 2, '#c8ccd4'); R.rect(x - 8, FLOOR - 22, 16, 6, '#d8dce4'); R.rect(x - 6, FLOOR - 24, 12, 2, '#e8ecf0'); R.rect(x - 1, FLOOR - 26, 2, 2, '#c8a050'); R.px(x - 5, FLOOR - 21, '#fff'); if ((R.t * 2 | 0) % 2) R.text('♨', x, FLOOR - 36, { al: 'c', c: '#f0f0f0', sh: false }); }
      // closet: two doors, open when unpacked (clothes + the packed things on the shelf)
      { const x = X(L.closet) - 20; R.rect(x, 96, 44, 104, '#6a4a30'); R.rect(x + 2, 98, 40, 102, ht.up ? '#2a2026' : '#8a6a4a');
        if (ht.up) { R.rect(x + 4, 104, 36, 1, '#c8c8d0'); const P = K.PACK || [], ids = Object.keys(s.pack || {}); const cols = ['#5a8ac8', '#c8a050', '#8fe0b0', '#9a7aaa', '#e8e4f0'];
          ids.forEach((id, i) => { const cx = x + 6 + i * 7; R.rect(cx + 2, 105, 1, 3, '#c8c8d0'); R.rect(cx, 108, 6, id === 'pajamas' ? 22 : 16, cols[i % 5]); R.rect(cx, 108, 6, 2, mix(cols[i % 5], '#fff', .3)); });
          R.rect(x + 4, 160, 36, 2, '#4a3424'); ids.slice(0, 4).forEach((id, i) => { const p = P.find(q => q[0] === id); if (p) R.text(p[2], x + 9 + i * 9, 150, { al: 'c', sh: false }); });
          R.rect(x - 6, 98, 8, 102, '#8a6a4a'); R.rect(x + 42, 98, 8, 102, '#8a6a4a'); }
        else { R.rect(x + 21, 98, 2, 102, '#6a4a30'); R.rect(x + 17, 146, 2, 8, '#e8c86a'); R.rect(x + 25, 146, 2, 8, '#e8c86a'); }
      }
      // luggage rack + suitcase (open when unpacked)
      { const x = X(L.rack); R.rect(x - 14, FLOOR - 12, 28, 2, '#c8a050'); R.rect(x - 13, FLOOR - 10, 2, 11, '#8a6a3a'); R.rect(x + 11, FLOOR - 10, 2, 11, '#8a6a3a'); R.rect(x - 13, FLOOR - 4, 26, 1, '#8a6a3a');
        if (ht.up) { R.rect(x - 12, FLOOR - 16, 24, 4, '#3f8f95'); R.rect(x - 12, FLOOR - 30, 24, 3, '#3f8f95'); R.rect(x - 12, FLOOR - 28, 2, 12, '#2f6f75'); R.rect(x - 10, FLOOR - 15, 20, 2, '#e8e4f0'); }
        else { R.rect(x - 12, FLOOR - 26, 24, 14, '#3f8f95'); R.rect(x - 12, FLOOR - 20, 24, 1, '#2f6f75'); R.rect(x - 4, FLOOR - 29, 8, 3, '#2a2a30'); R.rect(x + 6, FLOOR - 24, 3, 3, '#e8c86a'); }
      }
      // sitting nook (big suite): armchair-for-two + reading lamp + art
      if (t.nook) { const x = X(L.nook); SC.F.frame(R, x - 20, 70, 40, 28, 0); R.rect(x - 24, FLOOR - 18, 48, 10, '#7a5a8a'); R.rect(x - 26, FLOOR - 26, 52, 8, '#6a4a7a'); R.rect(x - 28, FLOOR - 22, 6, 18, '#5a3a6a'); R.rect(x + 22, FLOOR - 22, 6, 18, '#5a3a6a'); R.rect(x - 24, FLOOR - 8, 3, 8, '#3a2a20'); R.rect(x + 21, FLOOR - 8, 3, 8, '#3a2a20'); R.rect(x - 20, FLOOR - 18, 40, 1, mix('#7a5a8a', '#fff', .2));
        SC.F.lamp(R, x + 40, FLOOR + 1, night, R.t); }
      // coffee corner: counter, kettle (steam while boiling), mugs; minibar fridge or snack basket
      { const x0 = X(L.kettle) - 22, w = (t.mini ? L.mini + 18 : L.mini + 16) - L.kettle + 22; R.rect(x0, FLOOR - 26, w, 4, '#e8e0d0'); R.rect(x0 + 1, FLOOR - 22, w - 2, 22, '#6a4a30'); R.rect(x0 + 1, FLOOR - 22, w - 2, 1, '#4a3424'); for (let xx = x0 + 6; xx < x0 + w - 8; xx += 18) R.rect(xx, FLOOR - 16, 10, 1, '#c8a050');
        R.rect(x0 + 2, 120, w - 4, 3, '#86624a'); R.rect(x0 + 6, 112, 6, 8, '#e8e4f0'); R.rect(x0 + 14, 112, 6, 8, '#3f8f95'); R.rect(x0 + 24, 110, 8, 10, '#c8704a'); R.text('☕', x0 + 40, 108, { sh: false });
        const kx = X(L.kettle); R.rect(kx - 5, FLOOR - 37, 10, 11, '#c8ccd4'); R.rect(kx - 4, FLOOR - 39, 8, 2, '#a8a8b4'); R.rect(kx + 5, FLOOR - 35, 2, 5, '#a8a8b4'); R.rect(kx - 7, FLOOR - 33, 2, 2, '#a8a8b4'); R.rect(kx - 2, FLOOR - 28, 3, 1, ht.tk > 0 ? '#ff5a4a' : '#5a5a6a');
        if (ht.tk > 0) for (let k = 0; k < 4; k++) { const p = (R.t * .9 + k * .25) % 1; R.rect(kx - 8 + Math.round(Math.sin(p * 9 + k) * 2), FLOOR - 42 - p * 18, 3, 2, '#f0f4f8', .6 * (1 - p)); }
        R.rect(kx + 10, FLOOR - 31, 5, 5, '#f0ece6'); R.rect(kx + 15, FLOOR - 30, 1, 3, '#f0ece6'); R.rect(kx + 18, FLOOR - 31, 5, 5, '#3f8f95'); R.rect(kx + 23, FLOOR - 30, 1, 3, '#3f8f95');
        const mx = X(L.mini); if (t.mini) { R.rect(mx - 9, FLOOR - 21, 18, 20, '#2a2a30'); R.rect(mx - 8, FLOOR - 20, 16, 18, '#3a3a44'); R.rect(mx + 5, FLOOR - 16, 1, 8, '#c8ccd4'); R.rect(mx - 6, FLOOR - 18, 9, 14, '#4a5a6a', .5); R.rect(mx - 5, FLOOR - 15, 2, 4, '#e8b64a'); R.rect(mx - 2, FLOOR - 15, 2, 4, '#8fd0f6'); R.rect(mx + 1, FLOOR - 14, 2, 3, '#e8574a'); }
        else { R.rect(mx - 8, FLOOR - 33, 16, 7, '#c8a060'); for (let k = 0; k < 16; k += 3) R.rect(mx - 8 + k, FLOOR - 33, 1, 7, '#a8803a'); R.text('🐟', mx, FLOOR - 42, { al: 'c', sh: false }); }
      }
      // room-service phone on a little table + menu card
      { const x = X(L.phone); R.rect(x - 14, FLOOR - 24, 40, 3, '#86624a'); R.rect(x - 12, FLOOR - 21, 2, 21, '#6a4a30'); R.rect(x + 22, FLOOR - 21, 2, 21, '#6a4a30');
        R.rect(x - 6, FLOOR - 29, 12, 5, '#e8e4f0'); R.rect(x - 7, FLOOR - 31, 14, 2, '#c8c8d0'); R.rect(x - 3, FLOOR - 28, 6, 2, '#3a3a44'); if (ht.rs > 0 && (R.t * 4 | 0) % 2) R.rect(x + 4, FLOOR - 33, 2, 2, '#5af08a');
        const mx = X(L.menu); R.rect(mx - 5, FLOOR - 36, 10, 12, '#f4ead4'); R.rect(mx - 5, FLOOR - 36, 10, 2, '#c8a050'); R.text(MENU[ht.ri || 0][0], mx, FLOOR - 34, { al: 'c', sh: false });
        R.rect(x - 4, 88, 30, 36, '#c8a050'); R.rect(x - 2, 90, 26, 32, '#3a4a5a'); R.rect(x, 110, 22, 10, '#5a7a6a'); R.rect(x + 4, 98, 6, 6, '#e8b64a'); // small framed print
      }
      // bathroom door (frosted panel) + bedroom archway
      { const x = X(L.bath); R.rect(x - 15, 104, 30, 96, rm.trim); R.rect(x - 13, 106, 26, 94, '#e8e4dc'); R.rect(x - 9, 112, 18, 50, '#c8d8e0'); R.rect(x - 9, 112, 18, 50, '#ffffff', .25 + Math.sin(R.t) * .05); R.rect(x + 8, 156, 3, 6, '#c8a050'); R.rect(x - 7, 96, 14, 7, '#3a6a8a'); R.text('浴', x, 96, { al: 'c', c: '#e8f4ff', sh: false }); }
      { const x = X(L.arch); R.rect(x - 26, 92, 52, 108, rm.trim); R.rect(x - 22, 96, 44, 104, '#1e1a26'); R.rect(x - 22, 96, 44, 104, '#ffd27a', night ? .12 : .05); R.rect(x - 14, 150, 28, 50, '#2a2632'); R.rect(x - 12, 160, 10, 6, '#e6dcc4', .4); R.text('卧室', x, 82, { al: 'c', c: C.cream, sh: false }); }
      // lamp glow + night dim
      if (night) R.rect(0, 0, 480, 272, '#0a0d20', .22);
      if (night || tod === 'golden') { if (t.nook) SC.F.glow(R, X(L.nook) + 40, FLOOR - 46, 30, '#ffd27a', .45); SC.F.glow(R, X(L.kettle) + 10, FLOOR - 30, 26, '#ffc870', .3); }
      drawCatsHt(R, s, ox, ht);
      K.bubbles(R, s, SCN.entry.spots(s, cfg), ox, 176);
      K.header(R, s, cfg, h.name + ' · ' + t.name + ' · 玄关'); K.toast(R, s); K.fade(R, s);
    },
  };

  // ======================= 浴室 bath =======================
  function tubSlots(t, L) { return t.tub === 'free' ? [L.tub - 12, L.tub + 12] : [L.tub - 14, L.tub + 14]; }
  function showerSlots(L) { return [L.shower - 8, L.shower + 8]; }
  SCN.bath = {
    w: (s, cfg) => T(s, cfg).bathW,
    spots(s, cfg) {
      const t = T(s, cfg), L = bathLay(t), ht = s.ht || fresh();
      const out = [
        { id: 'door', x: L.door, w: 20, label: '回玄关', k: 'door' },
        { id: 'sink', x: L.sink, w: 14, label: '刷刷牙 🪥', k: 'brush' },
        { id: 'mirror', x: L.mirror, w: 14, label: '照照镜子', k: 'mirror' },
        { id: 'towel', x: L.towel, w: 16, label: '毛巾擦干毛毛', k: 'towel' },
        { id: 'wc', x: L.wc, w: 14, label: '马桶 · 冲水', k: 'wc' },
      ];
      if (t.tub) out.push({ id: 'tub', x: L.tub, w: t.tub === 'free' ? 70 : 84, label: '泡个泡泡浴 🛁（再按一下出来）', k: 'tub' });
      if (t.shower) out.push({ id: 'shower', x: L.shower, w: 30, label: '冲个热水澡 🚿（再按一下出来）', k: 'shower' });
      return out;
    },
    enter(st) { if (st.ht) st.ht.inn = [0, 0]; },
    step(st, inputs, cfg, ev) { // cats in the water stay put; ↑ (spot) still gets them out
      const ht = ensure(st, cfg), t = T(st, cfg), L = bathLay(t);
      for (let i = 0; i < 2; i++) if (ht.inn[i]) { inputs[i] = Object.assign({}, inputs[i], { l: false, r: false, run: false }); const sl = ht.inn[i] === 1 ? tubSlots(t, L) : showerSlots(L); st.c[i][0] = sl[i]; st.f[i] = i ? -1 : 1; ht.bt[i] += DT; st.mv && (st.mv[i] = 0); }
      if (st.cud && (ht.inn[0] || ht.inn[1])) st.cud = null;
      if (st.pw && (ht.inn[0] || ht.inn[1])) st.pw = 0;
    },
    act(st, sp, who, cfg, ev) {
      const ht = ensure(st, cfg), i = who;
      switch (sp.k) {
        case 'door': if (ht.inn[0] || ht.inn[1]) { K.msg(st, '先从浴缸里出来呀'); return; } sfx(ev, 'door'); K.go(st, 'entry', { x: entryLay(T(st, cfg)).bath }, ev); return;
        case 'brush': if (ht.inn[i]) return; ht.br[i] = 2.6; sfx(ev, 'brush'); return;
        case 'mirror': ht.lk[i] = 1.8; K.msg(st, ['镜子里的小猫好可爱', '胡须整整齐齐 ✨', '对着镜子做个鬼脸 :P'][(st.t * 3 | 0) % 3]); return;
        case 'towel': if (ht.inn[i]) return; if (!ht.wet[i]) { K.msg(st, '毛毛是干的～先洗个澡吧'); return; } ht.tw[i] = 1.6; sfx(ev, 'towel'); return;
        case 'wc': ht.fl = 1.2; sfx(ev, 'flush'); K.msg(st, '哗啦——冲干净啦'); return;
        case 'tub': case 'shower': {
          const kind = sp.k === 'tub' ? 1 : 2;
          if (ht.inn[i]) { const long = ht.bt[i] > 3; ht.inn[i] = 0; ht.wet[i] = 40; st.c[i][1] = FLOOR; if (long) bathed(st, ht, kind, ev); K.msg(st, long ? '湿漉漉地出来啦～去毛巾那里擦干 🧺' : '水还没泡热呢就出来了'); sfx(ev, 'splash'); return; }
          if (ht.inn[1 - i] && ht.inn[1 - i] !== kind) { K.msg(st, '一起用同一个吧～'); }
          ht.inn[i] = kind; ht.bt[i] = 0; sfx(ev, kind === 1 ? 'splash' : 'shower'); K.msg(st, kind === 1 ? (ht.inn[1 - i] ? '两只猫一起泡泡浴 🛁🦆' : '暖暖的泡泡浴～') : '热水哗哗的 🚿'); return;
        }
      }
    },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), t = T(s, cfg), L = bathLay(t), W = t.bathW, ox = camX(s, W), ht = s.ht || fresh(), X = (x) => x - ox, tod = K.tod(s), night = tod === 'night';
      // tiled walls: big tiles up top, a darker wainscot band, small floor tiles
      R.rect(0, 0, 480, 200, t.tile);
      for (let y = 0; y < 200; y += 16) for (let x = -ox % 16; x < 480; x += 16) { R.rect(x, y, 16, 1, t.tile2); R.rect(x, y, 1, 16, t.tile2); }
      R.rect(0, 150, 480, 46, mix(t.tile, '#5a7a8a', .25)); for (let x = -ox % 8; x < 480; x += 8) R.rect(x, 150, 1, 46, mix(t.tile, '#5a7a8a', .35)); R.rect(0, 148, 480, 2, t.trim);
      R.rect(0, 196, 480, 4, mix(t.floor, '#000', .3));
      for (let y = 200; y < 272; y += 8) for (let x = -ox % 16; x < 480; x += 8) R.rect(x, y, 8, 8, ((x + ox) / 8 + y / 8) % 2 ? t.floor : t.floor2);
      if (W < 480) { const ex = X(W); R.rect(ex, 0, 480 - ex, 272, '#1c1a22'); R.rect(ex, 0, 3, 200, t.trim); }
      // ceiling light
      { const x = X(W / 2); R.rect(x - 10, 0, 20, 4, '#f0ece6'); SC.F.glow(R, x, 4, 60, '#fff4d8', night ? .35 : .18, 6); }
      // door back to the entry
      { const x = X(L.door); R.rect(x - 14, 104, 30, 96, t.trim); R.rect(x - 12, 106, 26, 94, '#e8e4dc'); R.rect(x + 7, 152, 3, 6, '#c8a050'); R.rect(x + 14, 120, 10, 2, '#c8a050'); R.rect(x + 16, 122, 6, 14, '#ffffff'); R.rect(x + 17, 124, 4, 10, '#e8e4f0'); } // + a robe hook
      if (t.robe) { const x = X(L.door) + 20; R.rect(x - 4, 124, 12, 30, '#f8f4ee'); R.rect(x - 2, 128, 8, 1, '#e0d8cc'); R.rect(x, 136, 4, 2, '#c8a050'); }
      // vanity: counter + basin(s) + tap, toiletries, mirror with live reflections
      const sx0 = X(L.sink) - 20, sw = (L.mirror - L.sink) + 40 + (t.sinks > 1 ? 0 : 0);
      { const mx0 = sx0 + 2, my0 = 160, mw = sw - 4, mh = 50;
        R.rect(mx0 - 2, my0 - 2, mw + 4, mh + 4, t.trim); R.rect(mx0, my0, mw, mh, '#a8c4d0');
        const g = R.ctx, S = R.S; g.save(); g.beginPath(); g.rect(mx0 * S, my0 * S, mw * S, mh * S); g.clip();
        R.rect(mx0, my0, mw, mh, mix(t.tile, '#a8c4d0', .5)); for (let y = my0; y < my0 + mh; y += 16) R.rect(mx0, y, mw, 1, mix(t.tile2, '#a8c4d0', .5)); // the tiles behind us
        for (let i = 0; i < 2; i++) { const c = s.c[i]; if (!c || ht.inn[i]) continue; const cx = c[0] - ox; if (cx < mx0 - 14 || cx > mx0 + mw + 14) continue; R.cat(i, ht.br[i] > 0 ? 'meow' : 'idle0', cx, my0 + mh + 12, { flip: !((s.f ? s.f[i] : 1) < 0), k: .9, a: .85 }); if (ht.br[i] > 0) { R.rect(cx - 3, my0 + mh - 4, 6, 4, '#ffffff', .8); } }
        R.rect(mx0, my0, mw, mh, '#d8f0ff', .18); for (let k = 0; k < 3; k++) R.rect(mx0 + 6 + k * 5, my0 + 4 + k * 3, 10, 1, '#ffffff', .5);
        g.restore();
        if (ht.br[0] > 0 || ht.br[1] > 0 || (ht.inn[0] || ht.inn[1])) R.rect(mx0, my0, mw, mh, '#ffffff', .18 + Math.sin(R.t * 2) * .04); // a little fog
        R.rect(sx0 - 4, FLOOR - 24, sw + 8, 4, '#e8e4dc'); R.rect(sx0 - 4, FLOOR - 20, sw + 8, 1, '#a8a49c'); R.rect(sx0 - 2, FLOOR - 19, sw + 4, 19, t === TIERS.small ? '#2a2a30' : '#6a4a30'); R.rect(sx0 + sw / 2 - 1, FLOOR - 17, 2, 15, '#4a3424');
        const bas = t.sinks > 1 ? [X(L.sink), X(L.mirror)] : [X(L.sink) + 6];
        bas.forEach(bx => { R.rect(bx - 8, FLOOR - 26, 16, 2, '#ffffff'); R.rect(bx - 7, FLOOR - 24, 14, 1, '#d8e0e8'); R.rect(bx - 1, FLOOR - 32, 2, 6, '#c8ccd4'); R.rect(bx - 1, FLOOR - 32, 6, 2, '#c8ccd4'); R.rect(bx - 4, FLOOR - 33, 3, 1, '#c8ccd4'); });
        const tx = t.sinks > 1 ? (X(L.sink) + X(L.mirror)) / 2 : X(L.mirror) + 6; // toiletries: soap, two toothbrush cups (our colours), lotion
        R.rect(tx - 7, FLOOR - 30, 4, 6, '#3f8f95'); R.rect(tx - 6, FLOOR - 34, 1, 4, '#e8e4f0'); R.rect(tx - 2, FLOOR - 30, 4, 6, '#e8b64a'); R.rect(tx - 1, FLOOR - 34, 1, 4, '#8fd0f6'); R.rect(tx + 3, FLOOR - 32, 3, 8, '#f4ead4'); R.rect(tx + 3, FLOOR - 33, 3, 1, '#c8a050'); R.rect(tx + 7, FLOOR - 26, 5, 2, '#f8f0f0');
      }
      // towel rack (two towels in our colours) + bath mat
      { const x = X(L.towel); R.rect(x - 14, 160, 28, 2, '#c8ccd4'); R.rect(x - 15, 158, 2, 6, '#a8a8b4'); R.rect(x + 13, 158, 2, 6, '#a8a8b4');
        const tw = [ht.tw[0] > 0 || ht.tw[1] > 0 ? 0 : 1, 1]; R.rect(x - 12, 162, 11, 26 * tw[0] || 2, '#3f8f95'); R.rect(x - 12, 180, 11, 2, '#2f6f75', tw[0] ? 1 : 0); R.rect(x + 1, 162, 11, 26, '#e8b64a'); R.rect(x + 1, 180, 11, 2, '#c8962a');
        R.rect(x - 10, FLOOR + 2, 20, 4, '#8fd0f6'); R.rect(x - 9, FLOOR + 3, 18, 2, '#a8dcf8'); }
      // toilet (lid, tank, little flush wobble)
      { const x = X(L.wc), wob = ht.fl > 0 ? Math.round(Math.sin(R.t * 30)) : 0; R.rect(x - 2, FLOOR - 40, 12, 18, '#ffffff'); R.rect(x - 2, FLOOR - 40, 12, 2, '#e8ecf0'); R.rect(x + 7, FLOOR - 36 + wob, 3, 2, '#c8ccd4'); R.rect(x - 8, FLOOR - 22, 16, 4, '#ffffff'); R.rect(x - 7, FLOOR - 18, 12, 9, '#f4f4f8'); R.rect(x - 4, FLOOR - 9, 7, 9, '#e8ecf0'); R.rect(x - 8, FLOOR - 23, 16, 1, '#d8e0e8');
        R.rect(x - 18, 170, 6, 8, '#e8e4dc'); R.rect(x - 17, 172, 4, 4, '#ffffff'); /* paper roll */ }
      // shower stall: glass panels, rain head, water lines + steam while used
      if (t.shower) { const x = X(L.shower), on = ht.inn[0] === 2 || ht.inn[1] === 2; R.rect(x - 26, 196, 52, 4, '#d8dce4'); R.rect(x - 26, FLOOR - 2, 52, 3, '#c8ccd4'); R.rect(x - 2, 96, 4, 10, '#c8ccd4'); R.rect(x - 10, 106, 20, 3, '#c8ccd4');
        if (on) for (let k = 0; k < 14; k++) { const xx = x - 9 + k * 1.4, ph = (R.t * 3 + k * .37) % 1; R.rect(Math.round(xx), 110 + ph * 120, 1, 6, '#8fd0f6', .7); }
      }
      // bathtub: freestanding clawfoot (big suite) or tub + shower curtain (standard)
      if (t.tub) { const x = X(L.tub), on = ht.inn[0] === 1 || ht.inn[1] === 1, tw2 = t.tub === 'free' ? 70 : 84;
        if (t.bathWin) { SC.drawView(R, x - 34, 70, 68, 60, K.view(cfg, h.view), { tod, weather: s.wea, t: R.t, off: s.off }); R.rect(x - 36, 68, 72, 2, t.trim); R.rect(x - 36, 130, 72, 3, t.trim); R.rect(x - 36, 68, 2, 64, t.trim); R.rect(x + 34, 68, 2, 64, t.trim); R.rect(x - 1, 70, 2, 60, t.trim); SC.F.plant(R, x + 56, FLOOR + 1); }
        if (t.tub === 'combo') { R.rect(x - tw2 / 2 - 4, 92, tw2 + 8, 2, '#c8ccd4'); for (let k = 0; k < 8; k++) R.rect(x - tw2 / 2 + 2 + k * 4, 94, 3, 104 - 30, k % 2 ? '#8ab8d8' : '#a8cce4'); R.rect(x + tw2 / 2 - 10, 100, 6, 12, '#c8ccd4'); R.rect(x + tw2 / 2 - 8, 112, 2, 30, '#a8a8b4'); /* curtain pushed to the left, shower head on the right */
          R.rect(x + 8, 118, 24, 3, '#c8ccd4'); R.rect(x + 10, 112, 4, 6, '#f4ead4'); R.rect(x + 16, 113, 4, 5, '#8fe0b0'); R.rect(x + 22, 111, 4, 7, '#e8b64a'); }
      }
      // steam over the whole room while anyone bathes
      if (ht.inn[0] || ht.inn[1]) for (let k = 0; k < 10; k++) { const p = (R.t * .25 + k * .1) % 1, sx = (k * 53 + Math.sin(R.t * .7 + k) * 10) % 480; R.rect(Math.round(sx), Math.round(190 - p * 160), 10, 4, '#ffffff', .22 * Math.sin(p * Math.PI)); }
      // cats
      const shown = [0, 1].map(i => !ht.inn[i]);
      drawCatsHt(R, s, ox, ht, shown);
      // shower users: standing in the stall behind fogged glass
      if (t.shower) { const x = X(L.shower); for (let i = 0; i < 2; i++) if (ht.inn[i] === 2) { R.cat(i, (R.t * 1.5 + i | 0) % 2 ? 'happy0' : 'idle0', s.c[i][0] - ox, FLOOR, { flip: i === 1 }); }
        R.rect(x - 26, 104, 1, 136, '#c8ccd4'); R.rect(x + 25, 104, 1, 136, '#c8ccd4'); R.rect(x - 25, 150, 50, 90, '#d8f0ff', ht.inn[0] === 2 || ht.inn[1] === 2 ? .45 : .22); R.rect(x - 22, 160, 1, 40, '#ffffff', .6); R.rect(x - 19, 166, 1, 22, '#ffffff', .5); R.rect(x - 26, 148, 52, 2, '#c8ccd4'); }
      // tub users: heads + shoulders above the rim, bubbles, duck & fish toys
      if (t.tub) { const x = X(L.tub), tw2 = t.tub === 'free' ? 70 : 84, on = ht.inn[0] === 1 || ht.inn[1] === 1, rimY = FLOOR - 18;
        for (let i = 0; i < 2; i++) if (ht.inn[i] === 1) R.cat(i, ht.bt[i] > 6 ? 'sitDoze' : 'sit', s.c[i][0] - ox, rimY + 5 + Math.round(Math.sin(R.t * 2 + i) * .6), { flip: i === 1 });
        if (on) { R.rect(x - tw2 / 2 + 4, rimY - 1, tw2 - 8, 2, '#a8dcf8'); for (let k = 0; k < 16; k++) { const bx = x - tw2 / 2 + 6 + (k * 37) % (tw2 - 12), by = rimY - 2 - ((k * 13) % 4) + Math.round(Math.sin(R.t * 2 + k) * .7), r = 1 + (k % 3); R.rect(bx - r, by - r, r * 2 + 1, r * 2, '#ffffff', .9); R.px(bx - r + 1, by - r, '#e8f4ff'); }
          for (let k = 0; k < 3; k++) { const p = (R.t * .4 + k * .33) % 1; R.rect(Math.round(x - 20 + k * 18 + Math.sin(p * 6) * 3), Math.round(rimY - 6 - p * 26), 2, 2, '#ffffff', .9 * (1 - p)); } // rising bubbles
          const dx = x + Math.round(Math.sin(R.t * .8) * 10), dy = rimY - 4 + Math.round(Math.sin(R.t * 2.4)); R.rect(dx - 3, dy, 6, 3, '#ffd84a'); R.rect(dx + 1, dy - 3, 3, 3, '#ffd84a'); R.px(dx + 4, dy - 2, '#ff8a2a'); R.px(dx + 2, dy - 2, '#222'); // rubber duck
          const fx = x - 16 - Math.round(Math.sin(R.t * .6) * 6), fy = rimY - 3; R.rect(fx - 3, fy, 5, 2, '#5ab0e8'); R.px(fx + 2, fy - 1, '#5ab0e8'); R.px(fx + 2, fy + 2, '#5ab0e8'); R.px(fx - 2, fy, '#fff'); } // fish toy
        if (t.tub === 'free') { R.rect(x - tw2 / 2, rimY, tw2, 3, '#ffffff'); R.rect(x - tw2 / 2 + 2, rimY + 3, tw2 - 4, 12, '#f4f4f8'); R.rect(x - tw2 / 2 + 6, rimY + 15, tw2 - 12, 2, '#e0e4ea'); R.rect(x - tw2 / 2 + 2, rimY + 4, tw2 - 4, 1, '#d8e0e8'); [x - tw2 / 2 + 8, x + tw2 / 2 - 10].forEach(fx => R.rect(fx, rimY + 17, 2, 2, '#c8a050')); R.rect(x + tw2 / 2 - 6, rimY - 14, 2, 14, '#c8a050'); R.rect(x + tw2 / 2 - 10, rimY - 14, 6, 2, '#c8a050'); }
        else { R.rect(x - tw2 / 2, rimY, tw2, 3, '#ffffff'); R.rect(x - tw2 / 2, rimY + 3, tw2, 15, '#eef0f4'); R.rect(x - tw2 / 2, rimY + 10, tw2, 1, '#d8e0e8'); R.rect(x - tw2 / 2 - 2, rimY - 1, 4, 19, '#e0e4ea'); }
        // the bath mat towel peeking out
        R.rect(x - 8, FLOOR + 2, 16, 3, '#e8b64a');
      }
      if (night) R.rect(0, 0, 480, 272, '#0a0d20', .14);
      K.bubbles(R, s, SCN.bath.spots(s, cfg), ox, 120);
      K.header(R, s, cfg, h.name + ' · ' + t.name + ' · 浴室'); K.toast(R, s); K.fade(R, s);
    },
  };

  function bathed(st, ht, kind, ev) {
    if (ht.bd !== st.day) { ht.bd = st.day; K.coins(2, st, ev); ev('diary', 'bath', { kind: kind === 1 ? '泡泡浴' : '淋浴' }); }
    else ev('dcount', 'bathn');
  }

  // cats with per-activity poses: brushing (foam), towel-drying (towel on head, drops), mirror look, holding a mug, wet drips, refreshed sparkles
  function drawCatsHt(R, s, ox, ht, shown) {
    const sv = Object.assign({}, s, { c: s.c.map((c, i) => (shown && !shown[i]) ? null : c) });
    const busy = (i) => ht.br[i] > 0 || ht.tw[i] > 0 || ht.lk[i] > 0 || ht.dr[i] > 0 || ht.eat > 0;
    const anyBusy = (sv.c[0] && busy(0)) || (sv.c[1] && busy(1));
    K.drawCatsWalk(R, sv, ox, 0, anyBusy ? { pose: (i) => ht.br[i] > 0 ? 'meow' : ht.tw[i] > 0 ? ((R.t * 6 | 0) % 2 ? 'dizzy0' : 'dizzy1') : ht.lk[i] > 0 ? 'look' : ht.eat > 0 ? ((R.t * 3 + i | 0) % 2 ? 'happy0' : 'idle0') : ht.dr[i] > 0 && !(s.mv && s.mv[i]) ? 'hold' : K.poseOf(s, i) } : {});
    for (let i = 0; i < 2; i++) { const c = sv.c[i]; if (!c) continue; const x = c[0] - ox, y = c[1], fl = (s.f ? s.f[i] : 1) < 0, d = fl ? -1 : 1;
      if (ht.br[i] > 0) { const wig = Math.round(Math.sin(R.t * 30)); R.rect(x + d * 5 - 2 + wig, y - 15, 5, 1, i ? '#e8b64a' : '#3f8f95'); for (let k = 0; k < 4; k++) R.rect(x + d * 3 + ((k * 3) % 5) - 2, y - 17 + (k % 2) * 2, 2, 2, '#ffffff', .9); if (Math.random() < .3) R.spark(x + d * 6, y - 18, 'star'); }
      if (ht.tw[i] > 0) { const wig = Math.round(Math.sin(R.t * 20) * 1.5); R.rect(x - 7 + wig, y - 26, 14, 5, i ? '#e8b64a' : '#3f8f95'); R.rect(x - 8 + wig, y - 23, 3, 6, i ? '#c8962a' : '#2f6f75'); R.rect(x + 5 + wig, y - 23, 3, 6, i ? '#c8962a' : '#2f6f75'); for (let k = 0; k < 3; k++) { const p = (R.t * 2 + k * .33) % 1; R.px(Math.round(x + (k - 1) * 8 * (1 + p)), Math.round(y - 22 + p * 10), '#8fd0f6'); } }
      if (ht.wet[i] > 0 && !ht.tw[i]) { const p = (R.t * 1.5 + i * .5) % 1; R.px(Math.round(x - 4 + i * 2), Math.round(y - 10 + p * 10), '#8fd0f6'); R.px(Math.round(x + 4), Math.round(y - 16 + ((p + .5) % 1) * 16), '#8fd0f6'); }
      if (ht.dr[i] > 0 && !(s.mv && s.mv[i]) && !busy2(ht, i)) { const mx = x + d * 7; R.rect(mx - 2, y - 13, 4, 4, i ? '#3f8f95' : '#f0ece6'); R.px(mx + d * 2, y - 12, i ? '#3f8f95' : '#f0ece6'); if ((R.t * 2 + i | 0) % 3 === 0) R.px(mx, y - 16, '#ffffff'); }
      if (ht.fr[i] > 0 && Math.random() < .05) R.spark(x + (Math.random() - .5) * 16, y - 22, 'star');
    }
    if (ht.eat > 0 && sv.c[0] && sv.c[1] && Math.random() < .08) R.spark((sv.c[0][0] + sv.c[1][0]) / 2 - ox, sv.c[0][1] - 28, 'heart');
  }
  function busy2(ht, i) { return ht.br[i] > 0 || ht.tw[i] > 0 || ht.lk[i] > 0; }

  // ======================= 阳台 balcony =======================
  SCN.balcony = {
    w: () => 480,
    spots(s) { return [{ id: 'in', x: 30, w: 20, label: '回房间', k: 'in' }, { id: 'chairs', x: 250, w: 60, label: '一起坐坐吹吹风', k: 'cuddle', kind: 'bench', y: FLOOR - 12 }, { id: 'rail', x: 380, w: 50, label: '趴在栏杆上看看', k: 'rail' }]; },
    act(st, sp, who, cfg, ev) {
      if (sp.k === 'in') { sfx(ev, 'door'); K.go(st, 'room', { x: 150 }, ev); }
      if (sp.k === 'rail') { K.msg(st, ['风好舒服～', '楼下的街灯一盏盏亮起来', '能看到好远好远'][(st.t * 2 | 0) % 3]); const ht = ensure(st, cfg); if (ht.bal !== st.day) { ht.bal = st.day; ev('diary', 'balcony'); } }
    },
    draw(R, s, cfg) {
      const h = K.hotel(s, cfg), tod = K.tod(s), night = tod === 'night';
      SC.drawView(R, 0, 0, 480, 200, K.view(cfg, h.view), { tod, weather: s.wea, t: R.t, pan: .5 + ((s.c[0][0] + s.c[1][0]) / 2 - 240) / 1200, off: s.off });
      // building wall + door on the left, overhang above
      R.rect(0, 0, 56, 272, '#3a3f55'); R.rect(10, 100, 34, 100, '#e8e0d0'); R.rect(12, 102, 30, 98, '#8fb8d8', .6); R.rect(27, 102, 1, 98, '#e8e0d0'); R.rect(0, 0, 480, 8, '#2a2e3e'); R.rect(0, 8, 480, 2, '#1a1d28');
      // string lights
      for (let x = 60; x < 480; x += 14) { const y = 14 + Math.round(Math.sin((x - 60) / 420 * Math.PI) * 10); R.rect(x, y - 1, 14, 1, '#2a2a30'); R.rect(x + 6, y, 2, 3, ['#ffd27a', '#8fd0f6', '#ffd27a', '#b6efc8'][(x / 14 | 0) % 4]); if (night || tod === 'golden') SC.F.glow(R, x + 7, y + 2, 6, '#ffd27a', .35, 3); }
      // deck
      for (let y = 200; y < 272; y += 6) { R.rect(56, y, 424, 6, (y / 6) % 2 ? '#8a6a4a' : '#7c5e40'); for (let x = 60 + (y * 5) % 50; x < 480; x += 50) R.rect(x, y, 1, 6, '#5a4430'); }
      // glass railing at the deck edge
      R.rect(56, 150, 424, 50, '#a8d8f0', .16); R.rect(56, 148, 424, 3, '#c8ccd4'); for (let x = 70; x < 480; x += 60) R.rect(x, 151, 2, 49, '#a8a8b4'); R.rect(56, 198, 424, 2, '#a8a8b4');
      // two chairs + round table + plant
      const cx = 250; [cx - 22, cx + 22].forEach((x, k) => { R.rect(x - 9, FLOOR - 14, 18, 3, '#3a3a44'); R.rect(x - 8, FLOOR - 11, 2, 11, '#2a2a30'); R.rect(x + 6, FLOOR - 11, 2, 11, '#2a2a30'); R.rect(k ? x + 7 : x - 9, FLOOR - 30, 2, 18, '#3a3a44'); R.rect(x - 7, FLOOR - 16, 14, 2, k ? '#e8b64a' : '#3f8f95'); });
      R.rect(cx - 6, FLOOR - 20, 12, 2, '#c8ccd4'); R.rect(cx - 1, FLOOR - 18, 2, 18, '#a8a8b4'); R.rect(cx - 4, FLOOR - 24, 3, 4, '#f0ece6'); R.rect(cx + 1, FLOOR - 24, 3, 4, '#3f8f95');
      SC.F.plant(R, 440, FLOOR + 1); SC.F.plant(R, 76, FLOOR + 1);
      if (night) R.rect(0, 0, 480, 272, '#0a0d20', .12);
      if (!K.cuddleDraw(R, s, 0)) K.drawCatsWalk(R, s, 0);
      K.bubbles(R, s, SCN.balcony.spots(s, cfg), 0, 170);
      K.header(R, s, cfg, h.name + ' · 阳台'); K.toast(R, s); K.fade(R, s);
    },
  };

  // ======================= wiring into room / hall =======================
  const roomSpots = SCN.room.spots, roomAct = SCN.room.act, roomDraw = SCN.room.draw;
  SCN.room.spots = function (s, cfg) {
    const out = roomSpots.call(this, s, cfg).map(p => p.id === 'door' ? Object.assign({}, p, { label: '玄关 · 浴室 · 出门' }) : p);
    if (T(s, cfg).balcony) out.push({ id: 'balc', x: 150, w: 8, label: '推开阳台门 🌇', k: 'balc' });
    return out;
  };
  SCN.room.act = function (st, sp, who, cfg, ev) {
    if (sp.k === 'door') { sfx(ev, 'door'); return K.go(st, 'entry', { x: entryLay(T(st, cfg)).arch - 18 }, ev); }
    if (sp.k === 'balc') { sfx(ev, 'door'); return K.go(st, 'balcony', { x: 60 }, ev); }
    return roomAct.call(this, st, sp, who, cfg, ev);
  };
  SCN.room.draw = function (R, s, cfg) { roomDraw.call(this, R, s, cfg); };
  const hallSpots = SCN.hall.spots, hallAct = SCN.hall.act, hallDraw = SCN.hall.draw;
  SCN.hall.spots = function (s, cfg) { const o = hallSpots.call(this, s, cfg); o.splice(1, 0, { id: 'ice', x: 104, w: 14, label: '制冰机 · 来点冰块', k: 'ice' }); return o; };
  SCN.hall.act = function (st, sp, who, cfg, ev) {
    if (sp.k === 'door' && sp.d === OURS) { sfx(ev, 'door'); return K.go(st, 'entry', { x: 44 }, ev); }
    if (sp.k === 'ice') { sfx(ev, 'ice'); K.msg(st, '哗啦啦——一小桶冰块 🧊'); return; }
    return hallAct.call(this, st, sp, who, cfg, ev);
  };
  SCN.hall.draw = function (R, s, cfg) {
    hallDraw.call(this, R, s, cfg);
  };
  // hall extras are drawn under the cats: hook the hall's own drawCatsWalk call through a pre-draw pass
  const HALL_W = 720;
  K.hallDecor = function (R, s, cfg, ox) {
    const x = 104 - ox, ht = s.ht; // ice machine
    if (x > -30 && x < 510) { R.rect(x - 11, 150, 22, 50, '#c8ccd4'); R.rect(x - 9, 152, 18, 18, '#8a96a8'); R.rect(x - 7, 154, 14, 14, '#a8d8f0', .5); R.rect(x - 9, 174, 18, 2, '#5a5a6a'); R.rect(x - 4, 180, 8, 8, '#3a3a44'); R.text('ICE', x, 140, { al: 'c', c: '#e8f4ff', sh: false }); R.rect(x - 11, 198, 22, 2, '#8a8a96'); R.rect(x + 14, 186, 8, 12, '#c8a050'); R.rect(x + 15, 184, 6, 2, '#e8c86a'); }
    if (ht && ht.dnd) { const dx = 160 + OURS * 96 - ox + 8; R.rect(dx - 5, 166, 10, 18, '#2a2a5a'); R.rect(dx - 4, 167, 8, 16, '#3a3a7a'); R.text('勿扰', dx, 170, { al: 'c', c: '#ffe8a0', sh: false }); }
  };

  // ======================= mode hooks =======================
  const step0 = M.step, snap0 = M.snap, onEvent0 = M.onEvent, draw0 = M.draw, coins0 = K.coins;
  M.step = function (st, inputs, ev) {
    const cfg = K.city(st);
    if (cfg && st.hotel != null) {
      const ht = ensure(st, cfg);
      for (let i = 0; i < 2; i++) {
        if (ht.br[i] > 0 && (ht.br[i] -= DT) <= 0) { ht.br[i] = 0; ev('dcount', 'brush'); K.msg(st, '牙齿亮晶晶 ✨'); }
        if (ht.tw[i] > 0 && (ht.tw[i] -= DT) <= 0) { ht.tw[i] = 0; ht.wet[i] = 0; ht.fr[i] = 180; ev('dcount', 'fresh'); ev('sfx', 'chimeS'); K.msg(st, '✨ 神清气爽！活动硬币 +1（一阵子）', 2.6); }
        if (ht.lk[i] > 0) ht.lk[i] = Math.max(0, ht.lk[i] - DT);
        if (ht.wet[i] > 0 && !ht.inn[i] && (ht.wet[i] -= DT) <= 0) { ht.wet[i] = 0; K.msg(st, '毛毛自己晾干了'); }
        if (ht.fr[i] > 0) ht.fr[i] = Math.max(0, ht.fr[i] - DT);
        if (ht.dr[i] > 0) ht.dr[i] = Math.max(0, ht.dr[i] - DT);
        if (ht.inn[i] && st.sc !== 'bath') ht.inn[i] = 0;
      }
      if (ht.fl > 0) ht.fl = Math.max(0, ht.fl - DT);
      if (ht.eat > 0) ht.eat = Math.max(0, ht.eat - DT);
      if (ht.tk > 0 && (ht.tk -= DT) <= 0) { ht.tk = 0; const d = DRINK[ht.kd]; ht.kd = 1 - ht.kd; ht.dr = [30, 30]; ev('sfx', 'ding'); K.msg(st, '泡好两杯' + d[1] + ' ' + d[0] + '，一猫一杯'); ev('diary', 'tea', { kind: d[1] }); }
      if (ht.rs > 0 && (ht.rs -= DT) <= 0) { ht.rs = 0; ht.tray = ht.ro; sfx(ev, 'knock'); K.msg(st, ht.dnd ? '服务员看到「勿扰」，把餐车轻轻放在门口 🛎' : '咚咚～客房服务到啦，在门口 🛎', 2.8); }
    }
    return step0.call(this, st, inputs, ev);
  };
  M.snap = function (st) { const o = snap0.call(this, st); if (st.ht) o.ht = st.ht; return o; };
  M.onEvent = function (R, e, s) { if (e[0] === 'sfx2') { playSafe(e[1]); return; } if (e[0] === 'dcount') { if (window.Diary && Diary.count) Diary.count(e[1]); return; } return onEvent0.call(this, R, e, s); };
  K.coins = function (n, st, ev) { if (n > 0 && st && st.ht && (st.ht.fr[0] > 0 || st.ht.fr[1] > 0)) n += 1; return coins0.call(this, n, st, ev); };
  M.draw = function (R, s, dt) {
    draw0.call(this, R, s, dt);
    const ht = s.ht; if (!ht || !(ht.fr[0] > 0 || ht.fr[1] > 0) || s.sc === 'pick' || s.sc === 'act' || s.panel || s.prompt) return;
    const lb = '✨ 神清气爽', w = R.tw(lb) + 8; R.rect(4, 16, w, 11, '#2a3a5a', .85); R.rect(4, 26, w, 1, R.C.gold); R.text(lb, 8, 17, { c: '#ffe8a0', sh: false });
  };
  // scene lists elsewhere (music / touch pad / hints / cuddle button / place names)
  K.SUITE = ['entry', 'bath', 'balcony'];
  [{ id: 'bath1', name: '第一次泡泡浴 🛁', need: d => (d.n.bath || 0) >= 1 }, { id: 'tea3', name: '三杯热饮 🍵', need: d => (d.n.tea || 0) >= 3 }, { id: 'rs1', name: '客房服务 🛎', need: d => (d.n.roomservice || 0) >= 1 }, { id: 'fresh5', name: '神清气爽 ×5 ✨', need: d => (d.n.fresh || 0) >= 5 }]
    .forEach(a => { if (!Diary.ACH.some(x => x.id === a.id)) Diary.ACH.push(a); });
})();
