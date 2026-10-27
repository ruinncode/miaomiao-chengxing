// ============================================================
//  一起旅行 — city travel engine (host-authoritative, data-driven).
//  Scene flow:  pick city → hotel → lobby (front desk, elevators) → hall
//  (numbered doors) → room (big window view, bed / sofa cuddles, TV, desk)
//  → street (walkable side view: signals, traffic, pedestrians, shops,
//  stations, activities) → shop / library / cafe → station → ride → act.
//  Each city is ONE config in js/cities/<id>.js (see toronto.js).
//  Scenes station / ride / act live in js/hub/travel2.js.
// ============================================================
(function () {
  const DT = 1 / 60, SPD = 74, RUN = 1.35, FLOOR = 241, SC = Scenery, H = SC.hash, mix = SC.mix;
  const TODH = { dawn: 7, day: 12, golden: 18, night: 22 };
  const todOf = (h) => (h >= 6 && h < 9) ? 'dawn' : (h >= 9 && h < 17) ? 'day' : (h >= 17 && h < 20) ? 'golden' : 'night';
  const city = (s) => s && s.city ? Cities.get(s.city) : null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const SCN = {}; // scene registry: {w(s,cfg), enter(st,arg,cfg,ev), step(st,inp,cfg,ev), spots(s,cfg), draw(R,s,cfg,dt), act(st,a,who,cfg,ev)}
  const L = { panel: null, lastCar: {}, ann: null, shopPick: null }; // local-only UI state

  // ---------------- helpers shared with travel2 ----------------
  const K = {
    SCN, L, DT, SPD, FLOOR, TODH, todOf, city, clamp,
    tod: (s) => todOf(s.clock),
    msg(st, text, ttl = 2.2) { st.msg = [String(text), ttl]; },
    go(st, sc, arg, ev) { // switch scene with a short fade
      const cfg = city(st); st.sc = sc; st.arg = arg || {}; st.fi = 0.45; st.cud = null; st.ask = null; st.prompt = null; st.pw = st.pw && (sc === 'street' || sc === 'lobby' || sc === 'hall') ? 1 : 0;
      const S = SCN[sc]; if (S && S.enter) S.enter(st, st.arg, cfg, ev);
      const w = S && S.w ? S.w(st, cfg) : 480;
      if (st.arg.x != null) { st.c[0][0] = clamp(st.arg.x - 9, 20, w - 20); st.c[1][0] = clamp(st.arg.x + 9, 20, w - 20); }
      st.c[0][1] = st.c[1][1] = FLOOR;
      if (cfg && ev) ev('place', placeName(st, cfg), st.city);
    },
    area(st, cfg) { cfg = cfg || city(st); return cfg && (cfg.areas.find(a => a.id === (st.area)) || cfg.areas[0]); },
    hotel(st, cfg) { cfg = cfg || city(st); return cfg && st.hotel != null ? cfg.hotels[st.hotel] : null; },
    view(cfg, id) { return (cfg && cfg.views && cfg.views[id]) || (cfg && cfg.views && Object.values(cfg.views)[0]) || { id: 'none', skyline: {} }; },
    poseOf(s, i) {
      const mv = s.mv ? s.mv[i] : 0, t = (window.Hub && Hub.R.t) || 0;
      return mv ? (mv > 1 ? 'run' + ((t * 14 + i * 2 | 0) % 4) : 'walk' + ((t * 10 + i * 3 | 0) % 6)) : ((t + i * 1.7) % 5 < 0.15 ? 'blink' : 'idle' + ((t * 1.2 + i | 0) % 2));
    },
    coins(n, st, ev) { const c = Wallet.add(n); st.coins = c; ev && ev('coin', n); return c; },
    sig, drawCatsWalk, spotNear, bubbles, toast, fade, header, cuddleDraw, walk, edges, cuddleStep, cuddleAsk, honk: null,
  };
  window.TravelKit = K;
  function placeName(st, cfg) { const a = K.area(st, cfg), h = K.hotel(st, cfg); const where = { lobby: h && h.name, hall: h && h.name, room: h && h.name, entry: h && h.name, bath: h && h.name, balcony: h && h.name, street: a && a.name, shop: st.arg && st.arg.name, station: st.arg && st.arg.stn, ride: st.ride && st.ride.lineName, act: st.act && st.act.name, map: '地图', hotels: '选酒店' }[st.sc]; return cfg.name + (where ? ' · ' + where : ''); }

  // ---------------- input: edges + walking + paws ----------------
  function edges(st, inputs) {
    const E = [{}, {}];
    for (let i = 0; i < 2; i++) { const n = inputs[i] || {}, o = st.pin[i] || {}; for (const k of ['l', 'r', 'j', 'd', 'a']) E[i][k] = !!n[k] && !o[k]; st.pin[i] = { l: !!n.l, r: !!n.r, j: !!n.j, d: !!n.d, a: !!n.a }; }
    return E;
  }
  function walk(st, inputs, minX, maxX, block) {
    const dx = [0, 1].map(i => { const n = inputs[i] || {}; return (n.r ? 1 : 0) - (n.l ? 1 : 0); });
    st.mv = [0, 0];
    if (st.cud) return;
    if (st.pw) { // holding paws: either cat can lead, both move together
      const d = clamp(dx[0] + dx[1], -1, 1), mid = (st.c[0][0] + st.c[1][0]) / 2; let nx = mid + d * SPD * 0.85 * DT;
      nx = clamp(nx, minX + 8, maxX - 8); if (block) nx = block(nx, mid, d, 2);
      const left = st.c[0][0] <= st.c[1][0] ? 0 : 1; st.c[left][0] = nx - 7; st.c[1 - left][0] = nx + 7;
      if (d) { st.f[left] = st.f[1 - left] = d; st.mv = [1, 1]; st.pwDist = (st.pwDist || 0) + Math.abs(d * SPD * DT); }
      return;
    }
    for (let i = 0; i < 2; i++) {
      if (!dx[i]) continue; const n = inputs[i] || {}, sp = SPD * (n.a ? RUN : 1);
      let nx = st.c[i][0] + dx[i] * sp * DT; nx = clamp(nx, minX, maxX);
      nx = clamp(nx, st.c[1 - i][0] - 440, st.c[1 - i][0] + 440); // stay on the same screen
      if (block) nx = block(nx, st.c[i][0], dx[i], i);
      st.c[i][0] = nx; st.f[i] = dx[i]; st.mv[i] = n.a ? 2 : 1;
    }
  }
  function spotNear(spots, x, r = 16) { let best = null, bd = 1e9; for (const sp of spots) { const d = Math.abs(sp.x - x) - (sp.w || 0) / 2; if (d < r && d < bd) { bd = d; best = sp; } } return best; }

  // cuddle / paws: one asks (press ↓), the other answers within 2.5 s
  function cuddleAsk(st, who, spot, ev) {
    if (st.cud) return;
    const k = spot ? 'cuddle' : 'paws';
    if (st.ask && st.ask.who !== who && st.ask.k === k) {
      if (k === 'paws') { st.pw = 1; st.pwDist = 0; ev('diary', 'paws'); ev('sfx', 'chimeS'); K.msg(st, '牵爪散步 ♥'); }
      else startCuddle(st, st.ask.spot || spot, ev);
      st.ask = null; return;
    }
    if (k === 'paws' && st.pw) { st.pw = 0; K.msg(st, '松开爪爪'); return; }
    st.ask = { who, k, spot: spot || null, t: 2.5 }; ev('ask', who, k);
  }
  function startCuddle(st, spot, ev) {
    st.cud = { id: spot.id, kind: spot.kind, x: spot.x, y: spot.y, bed: !!spot.bed, t: 0, gn: 0 }; st.pw = 0;
    st.c[0][0] = spot.x - 8; st.c[1][0] = spot.x + 8; ev('cuddle', spot.kind); ev('diary', 'cuddle', { kind: spot.kind });
  }
  function cuddleStep(st, E, ev) {
    if (st.ask && (st.ask.t -= DT) <= 0) st.ask = null;
    const cu = st.cud; if (!cu) return false;
    cu.t += DT;
    if (cu.gn > 0) { cu.gn += DT; if (cu.gn > 3.2) { cu.gn = 0; st.day++; st.clock = 7.2; st.auto = true; ev('morning', st.day); K.msg(st, `第 ${st.day} 天 · 早安 ☀`, 3); } return true; }
    if (cu.t > 0.8 && (E[0].j || E[1].j || E[0].l || E[1].l || E[0].r || E[1].r)) { st.cud = null; ev('uncuddle'); }
    return true;
  }
  function goodnight(st, ev) { if (!st.cud || !st.cud.bed || st.cud.gn) return; const td = todOf(st.clock); if (td !== 'night' && td !== 'golden') return; /* no 晚安 in the morning/daytime */ st.cud.gn = 0.01; ev('goodnight'); ev('diary', 'goodnight'); }

  // ---------------- traffic signals (deterministic from time) ----------------
  // cycle 24 s: main green 0–11, yellow 11–14, all-red 14–15, cross green 15–21, cross yellow 21–23, all-red 23–24
  function sig(t, k) {
    const ph = ((t + k * 7) % 24 + 24) % 24;
    return { ph, main: ph < 11 ? 'g' : ph < 14 ? 'y' : 'r', cross: ph >= 15 && ph < 21 ? 'g' : ph >= 21 && ph < 23 ? 'y' : 'r', ped: ph < 7 ? 'walk' : ph < 11 ? 'flash' : 'stop', cnt: ph < 11 ? Math.ceil(11 - ph) : 0 };
  }

  // ---------------- drawing helpers ----------------
  function drawCatsWalk(R, s, ox, oy = 0, o = {}) {
    const cats = [0, 1].map(i => s.c[i] ? { x: s.c[i][0] - ox, y: s.c[i][1] + oy, pose: o.pose ? o.pose(i) : K.poseOf(s, i), flip: (s.f ? s.f[i] : 1) < 0, k: o.k || 1 } : null);
    // holding paws: upright cats walk hand in hand, the inner paw reaching for the partner's
    const pwOn = s.pw && cats[0] && cats[1] && !o.pose;
    if (pwOn) {
      const L = cats[0].x <= cats[1].x ? 0 : 1;
      cats.forEach((c, i) => { const towards = (i === L) !== c.flip; const m = /^(walk|run)(\d)$/.exec(c.pose); c.pose = (towards ? 'pwF' : 'pwB') + (m ? (+m[2]) % 6 : 'i'); });
    }
    R.pair(s, cats);
    if (pwOn) { const a = cats[0].x < cats[1].x ? cats[0] : cats[1], b = a === cats[0] ? cats[1] : cats[0], k = a.k || 1, hy = Math.round(a.y - 8 * k); if (b.x - a.x > 13 * k) R.rect(a.x + 6 * k, hy, b.x - a.x - 12 * k, 1, R.C.gold); R.px(Math.round((a.x + b.x) / 2), hy - 1, R.C.gold); if (Math.random() < 0.02) R.spark((a.x + b.x) / 2, a.y - 26, 'heart'); }
  }
  function toast(R, s) { if (!s.msg || s.msg[1] <= 0) return; const w = R.tw(s.msg[0]) + 16; R.panel(240 - w / 2, 20, w, 15, { fill: R.C.ink2, shadow: false }); R.text(s.msg[0], 240, 24, { al: 'c', c: R.C.cream }); }
  function fade(R, s) { if (s.fi > 0) R.rect(0, 0, 480, 272, '#000', Math.min(1, s.fi / 0.45)); }
  function header(R, s, cfg, title) {
    R.topBar(title);
    R.text('🪙' + (s.coins | 0), 476, 3, { al: 'r', c: R.C.gold });
    R.text('第' + s.day + '天 ' + String(Math.floor(s.clock)).padStart(2, '0') + ':' + String(Math.floor((s.clock % 1) * 60)).padStart(2, '0'), 424, 3, { al: 'r', c: R.C.dim });
  }
  // touch bubbles above the spot nearest to *my* cat
  function bubbles(R, s, spots, ox, y = 176) {
    const me = R.who(), c = s.c[me]; if (!c || s.cud) return;
    const sp = spotNear(spots, c[0]); if (!sp) return;
    const lb = '↑ ' + sp.label, w = R.tw(lb) + 10, x = clamp(sp.x - ox - w / 2, 2, 478 - w), by = (sp.by || y) + Math.sin(R.t * 4) * 1.5;
    R.btn(x, by, w, 13, lb, { k: 'spot', id: sp.id }, { c: '#3a4a6a' });
  }
  // shared cuddle rendering: blanket, intertwined tails, breathing, zzz, hearts
  function cuddleDraw(R, s, ox = 0) {
    const cu = s.cud, C = R.C; if (!cu) return false;
    const x = cu.x - ox, y = cu.y, br = Math.sin(R.t * 1.6) * 0.04, seat = cu.kind === 'seat' || cu.kind === 'sofa' || cu.kind === 'windowseat' || cu.kind === 'bench' || cu.kind === 'cafe';
    const pose = seat ? (cu.t > 4 ? 'sitDoze' : 'sit') : 'sleep' + ((R.t * .5 | 0) % 2); // upright cats sit side by side on seats; beds keep the curled-up lying pose
    // tails curling into a little heart between them
    const tc = ['#2b2340', '#9a6a44'];
    for (let k = 0; k < 6; k++) { R.px(x - 3 + k, y + 1 - Math.round(Math.sin(k * .9 + R.t) * 1.5), tc[0]); R.px(x + 3 - k, y + 1 - Math.round(Math.cos(k * .9 + R.t) * 1.5), tc[1]); }
    R.cat(0, pose, x - 7, y + 1, { qx: 1 - br, qy: 1 + br }); R.cat(1, pose, x + 7, y + 1, { flip: true, qx: 1 + br, qy: 1 - br });
    if (!seat || cu.kind === 'sofa') { const bc = cu.kind === 'capsule' ? '#8fd0f6' : cu.kind === 'futon' ? '#4a6a8a' : cu.kind === 'sofa' ? '#8a9a6a' : '#e6dcc4', st2 = cu.kind === 'double' || cu.bed && cu.kind !== 'futon' && cu.kind !== 'capsule' ? '#a8b896' : mix(bc, '#fff', .15), by = Math.round(y - 1 + Math.sin(R.t * 1.6));
      R.rect(x - 22, by, 44, 9, bc); R.rect(x - 22, by, 44, 2, '#f8f4ea'); R.rect(x - 23, by + 1, 1, 8, mix(bc, '#000', .15)); R.rect(x + 22, by + 1, 1, 8, mix(bc, '#000', .15)); // a quilt pulled up to their chins
      for (let i = 4; i < 44; i += 10) R.rect(x - 22 + i, by + 3, 1, 6, st2); R.rect(x - 22, by + 6, 44, 1, st2);
      R.rect(x - 2, by + 2, 4, 2, mix(bc, '#000', .1)); } // the dip where their paws meet
    if (Math.random() < 0.025) R.spark(x + 6, y - 18, 'zz'); if (Math.random() < 0.015) R.spark(x, y - 20, 'heart');
    return true;
  }

  // ---------------- city pick + hotels ----------------
  SCN.pick = {
    draw(R, s) {
      const C = R.C; R.rect(0, 0, 480, 272, '#141a2c');
      for (let i = 0; i < 60; i++) R.px(H(i, 1) * 480, H(i, 2) * 272, i % 4 ? '#2a3456' : '#4a5a8a');
      R.text('去哪座城市？', 240, 22, { al: 'c', size: 24, c: C.cream });
      const L0 = Cities.LIST; let i = 0;
      for (const c of L0) {
        const col = i % 4, row = i / 4 | 0, x = 14 + col * 116, y = 52 + row * 40, ready = c.ready;
        R.btn(x, y, 110, 34, '', ready ? { k: 'city', id: c.id } : null, { dis: !ready, c: c.tier === 1 ? '#5a3a5a' : '#2e3a52' });
        R.text(c.name, x + 8, y + 6, { c: ready ? C.cream : C.dim, size: 12 }); R.text(c.local, x + 8, y + 18, { c: C.dim });
        if (c.tier === 1) R.text('★', x + 100, y + 5, { c: C.gold, al: 'r' });
        if (!ready) R.text('施工中', x + 104, y + 20, { al: 'r', c: '#6a7390' });
        i++;
      }
      R.text('提示：多伦多和滑铁卢最详细 · 坐 GO 火车可以在两城之间往返', 240, 262, { al: 'c', c: C.dim });
      R.topBar('一起旅行');
    },
  };
  SCN.hotels = {
    draw(R, s, cfg) {
      const C = R.C; R.rect(0, 0, 480, 272, '#1a1f2e');
      SC.drawView(R, 0, 15, 480, 90, K.view(cfg, cfg.areas[0].view), { tod: 'golden', weather: 'clear', t: R.t, pan: .5 + Math.sin(R.t * .05) * .3 });
      R.rect(0, 105, 480, 167, '#1a1f2e', .92);
      R.text(cfg.name + '  ' + cfg.local, 12, 20, { size: 24, c: C.cream }); R.text(cfg.blurb || '', 12, 44, { c: C.paper });
      R.text('选一家酒店住下', 12, 110, { c: C.gold });
      cfg.hotels.forEach((h, i) => {
        const x = 12 + (i % 2) * 232, y = 124 + (i / 2 | 0) * 46;
        R.btn(x, y, 226, 42, '', { k: 'hotel', i }, { c: '#2e3a52' });
        R.text(h.name, x + 6, y + 4, { c: C.cream }); R.text(h.local || '', x + 220, y + 4, { al: 'r', c: C.dim });
        const a = cfg.areas.find(a => a.id === h.area); R.text((a ? a.name : '') + ' · ' + (h.roomName || h.room) + ' · ' + ({ double: '双猫床', futon: '榻榻米被褥', capsule: '情侣胶囊', seat: '座位' }[h.bed] || '双猫床'), x + 6, y + 16, { c: C.blue });
        R.wrap(h.desc || '', x + 6, y + 27, 214, { c: C.dim, lh: 7 });
      });
      R.btn(380, 252, 92, 15, '换个城市', { k: 'pickCity' });
      R.topBar(cfg.name);
    },
  };

  // ---------------- lobby ----------------
  const LOBBY_W = 640;
  SCN.lobby = {
    w: () => LOBBY_W,
    enter(st, arg) { st.el = 0; if (arg.x == null) arg.x = arg.from === 'elev' ? 560 : 80; },
    spots(s, cfg) {
      return [
        { id: 'door', x: 40, w: 30, label: '出门 · 上街', k: 'go' },
        { id: 'sofa', x: 150, w: 60, label: '在沙发窝一会', k: 'cuddle', kind: 'sofa', y: FLOOR - 16 },
        { id: 'desk', x: 320, w: 70, label: s.inn ? '问问前台' : '办理入住', k: 'desk' },
        { id: 'board', x: 440, w: 30, label: '看推荐 / 地图', k: 'map' },
        { id: 'elev', x: 560, w: 50, label: '坐电梯上楼', k: 'elev' },
      ];
    },
    act(st, sp, who, cfg, ev) {
      if (sp.k === 'go') K.go(st, 'street', { area: K.hotel(st, cfg).area, x: K.hotel(st, cfg).x || 240 }, ev);
      if (sp.k === 'desk') { if (!st.inn) { st.inn = 1; ev('sfx', 'bell'); K.msg(st, (cfg.signs.welcome || 'Welcome!') + ' 房卡给您～ ' + K.hotel(st, cfg).floor + '楼', 3); ev('diary', 'checkin', { h: K.hotel(st, cfg).name }); } else { ev('sfx', 'bell'); K.msg(st, '前台：' + (K.hotel(st, cfg).tip || '祝两位玩得开心！'), 3); } }
      if (sp.k === 'elev') { if (!st.inn) { K.msg(st, '先去前台办理入住哦'); return; } st.el = 1.6; ev('sfx', 'ding'); }
      if (sp.k === 'map') K.go(st, 'map', { back: 'lobby' }, ev);
    },
    step(st, inp, cfg, ev) { if (st.el > 0 && (st.el -= DT) <= 0) K.go(st, 'hall', { x: 50 }, ev); },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), cam = clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, LOBBY_W - 480), ox = cam, pal = h.lobby || {};
      const wall = pal.wall || '#5a4038', wall2 = mix(wall, '#000', .12);
      R.rect(0, 0, 480, 272, wall);
      for (let x = -ox % 60; x < 480; x += 60) R.rect(x, 0, 30, 200, wall2);
      for (let x = -ox % 120 + 60; x < 480; x += 120) { R.rect(x - 6, 0, 12, 200, mix(wall, '#f4e8d0', .35)); R.rect(x - 8, 0, 16, 6, mix(wall, '#f4e8d0', .5)); R.rect(x - 8, 194, 16, 6, mix(wall, '#f4e8d0', .5)); }
      R.rect(0, 196, 480, 4, '#c8a060');
      for (let y = 200; y < 272; y += 8) for (let x = (-ox % 16) - 16 + ((y / 8) % 2) * 8; x < 480; x += 16) R.rect(x, y, 8, 8, (y / 8) % 2 ? '#e8e0d0' : '#cfc6b4');
      // chandeliers
      for (const cx of [200, 440]) { const x = cx - ox; R.rect(x, 0, 1, 16, '#c8a050'); R.rect(x - 14, 16, 28, 3, '#e8c86a'); for (let i = 0; i < 5; i++) { R.rect(x - 12 + i * 6, 19, 2, 4, '#fff6d0'); } R.rect(x - 30, 10, 60, 30, '#ffe8a0', .06); }
      // entrance (revolving door) with the street outside
      const dx = 18 - ox; SC.drawView(R, dx, 120, 44, 76, K.view(cfg, K.area(s, cfg).view || h.view), { tod: K.tod(s), weather: s.wea, t: R.t, pan: .3 });
      R.rect(dx - 3, 116, 50, 4, '#c8a050'); R.rect(dx - 3, 116, 3, 84, '#c8a050'); R.rect(dx + 44, 116, 3, 84, '#c8a050'); const rv = (R.t * 0.4) % 1; R.rect(dx + 22 + Math.cos(rv * 6.28) * 18, 120, 2, 76, '#e8e8f0', .7); R.rect(dx + 21, 120, 2, 76, '#c8a050');
      R.text(cfg.signs.exit || 'EXIT', dx + 22, 106, { al: 'c', c: '#8fe0b0' });
      // sofa + plants
      const sp = SC.F.bed(R, 'sofa', 95 - ox, FLOOR + 2); SC.F.plant(R, 80 - ox, FLOOR + 2); SC.F.plant(R, 220 - ox, FLOOR + 2);
      // front desk
      const fx = 262 - ox; R.rect(fx, 150, 120, 12, '#2a2030'); R.text(h.local || h.name, fx + 60, 152, { al: 'c', c: C.gold });
      R.text((cfg.signs.reception || 'Reception') + ' · 前台', fx + 60, 168, { al: 'c', c: C.paper });
      NPC.draw(R, fx + 50, 214, { look: 4, breed: 6, role: 'concierge', sit: 1, dir: -1, t: R.t }); NPC.draw(R, fx + 82, 214, { look: 9, breed: 0, role: 'clerk', sit: 1, dir: -1, t: R.t + 1.3 }); // front-desk cats
      R.rect(fx, 212, 120, 30, '#6a4030'); R.rect(fx, 210, 120, 3, '#e8d0a0'); R.rect(fx + 4, 216, 112, 2, '#8a5a40');
      R.rect(fx + 90, 206, 6, 4, '#e8c86a'); R.rect(fx + 92, 204, 2, 2, '#e8c86a');
      // luggage cart
      const lx = 400 - ox; R.rect(lx, 206, 2, 34, '#e8c86a'); R.rect(lx + 22, 206, 2, 34, '#e8c86a'); R.rect(lx, 204, 24, 2, '#e8c86a'); R.rect(lx - 2, 236, 28, 3, '#e8c86a'); R.rect(lx + 3, 222, 10, 14, '#b8704a'); R.rect(lx + 12, 226, 9, 10, '#5a8ac8');
      // concierge board
      const bx = 428 - ox; R.rect(bx, 170, 26, 34, '#2a2030'); R.rect(bx + 2, 172, 22, 26, '#f4ecd8'); for (let i = 0; i < 4; i++) R.rect(bx + 4, 176 + i * 5, 14 + (i % 2) * 4, 2, '#8a7a6a'); R.rect(bx + 12, 204, 2, 36, '#2a2030');
      // elevators with floor indicators
      for (const [k, ex] of [[0, 530], [1, 590]]) { const x = ex - ox, open = k === 0 && s.el > 0 ? Math.min(1, (1.6 - s.el) * 3) : 0, fl = k === 0 ? (s.el > 0 ? Math.max(1, Math.round(h.floor * (1 - s.el / 1.6))) : 1) : 1 + ((R.t / 3 | 0) % (h.floor || 12));
        R.rect(x - 22, 140, 44, 102, '#a8a8b4'); R.rect(x - 18, 156, 36, 86, '#2a2a33'); const dw = 18 * (1 - open); R.rect(x - 18, 156, dw, 86, '#c8ccd4'); R.rect(x + 18 - dw, 156, dw, 86, '#c8ccd4'); R.rect(x - .5, 156, 1, 86, open ? '#2a2a33' : '#8a8a96');
        R.rect(x - 10, 144, 20, 9, '#111'); R.text(String(fl), x, 145, { al: 'c', c: '#ff7a4a', sh: false }); R.rect(x + 24, 190, 4, 8, '#e8c86a'); }
      // cats
      if (!cuddleDraw(R, s, ox)) drawCatsWalk(R, s, ox);
      bubbles(R, s, SCN.lobby.spots(s, cfg), ox, 130);
      header(R, s, cfg, h.name + ' · 大堂'); toast(R, s); fade(R, s);
      void sp;
    },
  };

  // ---------------- hallway with numbered doors ----------------
  const HALL_W = 720, DOORS = 6, OURS = 3;
  SCN.hall = {
    w: () => HALL_W,
    spots(s, cfg) {
      const h = K.hotel(s, cfg), out = [{ id: 'elev', x: 50, w: 40, label: '坐电梯下楼', k: 'elev' }];
      for (let d = 0; d < DOORS; d++) out.push({ id: 'd' + d, x: 160 + d * 96, w: 24, label: (d === OURS ? '我们的房间 ' : '') + (h.floor * 100 + d * 2 + 1), k: 'door', d });
      out.push({ id: 'win', x: 690, w: 20, label: '看看窗外', k: 'peek' });
      return out;
    },
    act(st, sp, who, cfg, ev) {
      if (sp.k === 'elev') { ev('sfx', 'ding'); K.go(st, 'lobby', { from: 'elev' }, ev); }
      if (sp.k === 'door') { if (sp.d === OURS) { ev('sfx', 'click'); K.go(st, 'room', { x: 60 }, ev); } else { ev('sfx', 'knock'); K.msg(st, ['这间住着别的猫哦', '门里传来电视声…', '请勿打扰 🚫', '有猫在练小提琴'][sp.d % 4]); } }
      if (sp.k === 'peek') K.msg(st, '走廊尽头能看到 ' + (cfg.peek || '城市的屋顶'));
    },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), ox = clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, HALL_W - 480), pal = h.hall || {};
      const wall = pal.wall || '#4a4a5e'; R.rect(0, 0, 480, 200, wall);
      R.rect(0, 140, 480, 60, mix(wall, '#000', .18)); R.rect(0, 138, 480, 3, mix(wall, '#fff', .2));
      for (let x = -ox % 48; x < 480; x += 48) R.rect(x, 144, 40, 50, mix(wall, '#000', .1));
      R.rect(0, 196, 480, 4, '#2a2030');
      const cp = pal.carpet || '#6a2a3a'; R.rect(0, 200, 480, 72, cp);
      for (let x = -ox % 32; x < 480; x += 32) for (let y = 204; y < 272; y += 16) { R.rect(x + 8, y, 4, 4, mix(cp, '#e8c86a', .4)); R.rect(x + 24, y + 8, 4, 4, mix(cp, '#000', .25)); }
      // end window
      const wx = 676 - ox; if (wx < 480) { SC.drawView(R, wx, 60, 30, 90, K.view(cfg, h.view), { tod: K.tod(s), weather: s.wea, t: R.t, off: s.off }); R.rect(wx - 2, 58, 34, 2, '#e8e0d0'); R.rect(wx - 2, 150, 34, 3, '#e8e0d0'); }
      // elevator
      const ex = 50 - ox; R.rect(ex - 20, 110, 40, 90, '#a8a8b4'); R.rect(ex - 16, 124, 32, 76, '#c8ccd4'); R.rect(ex - .5, 124, 1, 76, '#8a8a96'); R.rect(ex - 8, 114, 16, 8, '#111'); R.text(String(h.floor), ex, 115, { al: 'c', c: '#ff7a4a', sh: false });
      // doors
      for (let d = 0; d < DOORS; d++) {
        const x = 160 + d * 96 - ox; if (x < -40 || x > 520) continue; const ours = d === OURS;
        R.rect(x - 14, 110, 28, 90, '#e8e0d0'); R.rect(x - 12, 112, 24, 88, pal.door || '#5a3a2a'); R.rect(x - 9, 118, 18, 30, mix(pal.door || '#5a3a2a', '#fff', .08)); R.rect(x - 9, 156, 18, 38, mix(pal.door || '#5a3a2a', '#fff', .08));
        R.rect(x + 7, 158, 3, 8, '#e8c86a'); R.rect(x + 6, 166, 5, 2, ours ? '#5af08a' : '#e8574a');
        R.rect(x - 9, 100, 18, 8, '#e8c86a'); R.text(String(h.floor * 100 + d * 2 + 1), x, 101, { al: 'c', c: '#3a2a20', sh: false });
        R.rect(x + 24, 120, 6, 6, '#ffe8a0'); R.rect(x + 20, 112, 14, 20, '#ffe8a0', .08);
        if (ours) { R.heart(x - 3, 90 + Math.sin(R.t * 3), 1, C.red); }
      }
      if (K.hallDecor) K.hallDecor(R, s, cfg, ox);
      drawCatsWalk(R, s, ox);
      bubbles(R, s, SCN.hall.spots(s, cfg), ox, 84);
      header(R, s, cfg, h.name + ' · ' + h.floor + ' 楼'); toast(R, s); fade(R, s);
    },
  };

  // ---------------- room ----------------
  function roomLayout(h) {
    const rm = SC.ROOMS[h.room] || SC.ROOMS.cozy, bed = h.bed || rm.bed || 'double';
    const bx = bed === 'futon' ? 300 : bed === 'capsule' ? 310 : 300;
    return { rm, bed, bx, sofa: h.sofa || (h.room === 'condo' || h.room === 'modern' || h.room === 'loft' ? 'sofa' : 'windowseat') };
  }
  SCN.room = {
    w: () => 480,
    spots(s, cfg) {
      const h = K.hotel(s, cfg), lay = roomLayout(h), out = [
        { id: 'door', x: 28, w: 20, label: '出门（走廊）', k: 'door' },
        { id: 'desk', x: 92, w: 40, label: '坐下一起学习？', k: 'desk' },
        { id: 'win', x: 240, w: 60, label: '窗外风景设置', k: 'view' },
        { id: 'bed', x: lay.bx + (lay.bed === 'double' ? 48 : 70), w: 80, label: '一起窝着 ↓ / 晚安', k: 'cuddle', kind: lay.bed, bed: true, y: FLOOR - (lay.bed === 'futon' ? 6 : lay.bed === 'capsule' ? 26 : 24) },
        { id: 'tv', x: 197, w: 24, label: '电视 · 掌机游戏', k: 'tv' },
      ];
      if (lay.sofa === 'windowseat') out.push({ id: 'seat', x: 240, w: 0, label: '窗边坐坐', k: 'cuddle', kind: 'windowseat', y: FLOOR - 26, by: 150 });
      return out;
    },
    act(st, sp, who, cfg, ev) {
      const h = K.hotel(st, cfg);
      if (sp.k === 'door') K.go(st, 'hall', { x: 160 + OURS * 96 }, ev);
      if (sp.k === 'desk') st.prompt = { k: 'study', place: cfg.name + ' · ' + h.name, view: K.view(cfg, h.view) };
      if (sp.k === 'view') st.panel = st.panel ? 0 : 1;
      if (sp.k === 'tv') st._sw = { k: 'switch', m: 'handheld', arg: { tv: true, place: h.name }, back: true };
    },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), lay = roomLayout(h), rm = SC.roomBack(R, h.room), W = rm.win, tod = K.tod(s), night = tod === 'night';
      SC.drawView(R, W.x, W.y, W.w, W.h, K.view(cfg, h.view), { tod, weather: s.wea, t: R.t, pan: .5 + ((s.c[0][0] + s.c[1][0]) / 2 - 240) / 900, off: s.off });
      L.cur = L.cur == null ? s.cur : L.cur + (s.cur - L.cur) * 0.06;
      SC.windowFrame(R, W.x, W.y, W.w, W.h, { style: W.style, curtains: !!rm.curtain, curtainC: rm.curtain, t: R.t, weather: s.wea, open: L.cur, frame: rm.trim });
      if (!rm.curtain && L.cur < .5) R.rect(W.x, W.y, W.w, W.h, '#e8dcc0', .85 - L.cur); // shoji / blinds
      // furniture
      const dim = s.cud ? Math.min(.45, s.cud.t * .2) : 0;
      const lampOn = night || tod === 'golden' || dim > 0, rx = W.x + W.w + 12; // room furniture, left to right: door, desk + lamp, scratching post, media console + TV, nightstand, bed, bowls
      SC.F.frame(R, 30, 60, 30, 22, 1);
      if (rx < 404) { SC.F.clock(R, 430, 66, s.clock); SC.F.catshelf(R, 412, 112); } else SC.F.frame(R, 400, 56, 36, 26, 2);
      if (lay.sofa !== 'windowseat') SC.F.sill(R, W.x, W.y + W.h + 2, W.w);
      SC.F.rug(R, 150, 248, 140, h.rug || '#4a5a7a');
      SC.F.desk(R, 66, FLOOR + 1, 62); SC.F.lamp(R, 78, FLOOR - 29, false, R.t); R.rect(100, FLOOR - 38, 14, 8, '#3a3a4a'); R.rect(101, FLOOR - 37, 12, 6, s.study ? '#8fe0b0' : '#8fd0f6'); R.rect(116, FLOOR - 33, 8, 2, '#e8e4f0'); R.rect(117, FLOOR - 35, 6, 2, '#3f8f95');
      SC.F.scratch(R, 140, FLOOR + 1);
      SC.F.console(R, 152, FLOOR + 1, 90); SC.F.tv(R, 165, FLOOR - 15, !!s.tvOn, R.t); // TV on the console (ties into the handheld library)
      if (rm.plants || h.room === 'tropical') SC.F.plant(R, 140, FLOOR + 1);
      if (lay.sofa === 'windowseat') SC.F.bed(R, 'windowseat', W.x + W.w / 2 - 60, FLOOR - 8);
      if (lay.bed === 'double') SC.F.nightstand(R, lay.bx - 32, FLOOR + 1, lampOn);
      SC.F.bed(R, lay.bed, lay.bx, FLOOR + 1);
      if (lay.bed === 'double') SC.F.bowls(R, 450, FLOOR + 1);
      // door
      R.rect(14, 104, 30, 96, rm.trim); R.rect(16, 106, 26, 94, '#5a3a2a'); R.rect(36, 152, 3, 8, '#e8c86a');
      if (dim > 0 || night || tod === 'golden') R.rect(0, 0, 480, 272, '#0a0d20', (night ? .3 : tod === 'golden' ? .08 : 0) + dim);
      if (lampOn) { const a = night || dim ? .5 : .25; SC.F.glow(R, 78, FLOOR - 46, 34, '#ffd27a', a); SC.F.glow(R, 78, FLOOR - 46, 8, '#fff0c0', a); R.rect(64, FLOOR - 30, 30, 1, '#ffe6a0', .5); // desk lamp + the pool it throws on the desk
        if (lay.bed === 'double') { SC.F.glow(R, lay.bx - 21, FLOOR - 30, 30, '#ffc870', a); SC.F.glow(R, lay.bx - 21, FLOOR - 30, 7, '#fff0c0', a); R.rect(lay.bx, FLOOR - 26, 40, 1, '#ffe6a0', .35); } }
      if (s.tvOn) SC.F.glow(R, 197, FLOOR - 32, 40, '#6a9ad8', night ? .35 : .15, 4);
      if (s.cud && lampOn) SC.F.glow(R, s.cud.x, s.cud.y - 4, 22, '#ffc870', .3);
      if (!cuddleDraw(R, s, 0)) drawCatsWalk(R, s, 0);
      if (s.cud && s.cud.bed && !s.cud.gn && (tod === 'night' || tod === 'golden')) R.btn(200, 250, 80, 15, '晚安 🌙', { k: 'goodnight' }, { c: '#3a3a6a' });
      if (s.cud && s.cud.gn) { const a = s.cud.gn < 1.2 ? s.cud.gn / 1.2 : s.cud.gn < 2.2 ? 1 : 1 - (s.cud.gn - 2.2); R.rect(0, 0, 480, 272, '#05060e', a); if (a > .6) R.text('晚安 ♥ zzz…', 240, 130, { al: 'c', size: 24, c: C.cream }); }
      bubbles(R, s, SCN.room.spots(s, cfg), 0, 170);
      header(R, s, cfg, h.name + ' · ' + (h.floor * 100 + OURS * 2 + 1)); toast(R, s);
      if (s.panel === 1) viewPanel(R, s);
      fade(R, s);
    },
  };
  // window view controls: time of day, weather, curtains, animated layers
  const OFFS = [['clouds', '云'], ['planes', '飞机'], ['trains', '列车'], ['cars', '车流'], ['boats', '船'], ['birds', '鸟'], ['windows', '灯火'], ['neon', '霓虹'], ['wheel', '摩天轮']];
  function viewPanel(R, s) {
    const C = R.C, x = 120, y = 30, w = 240; R.panel(x, y, w, 150, { title: '窗外风景' });
    R.text('时间', x + 8, y + 20, { c: C.dim });
    SC.TODS.forEach((t, i) => R.btn(x + 36 + i * 44, y + 17, 42, 12, SC.TOD_NAME[t], { k: 'tod', v: t }, { on: !s.auto && K.tod(s) === t }));
    R.btn(x + 36, y + 31, 70, 12, s.auto ? '时间流动 ✓' : '时间流动', { k: 'tod', v: 'auto' }, { on: s.auto });
    R.text('天气', x + 8, y + 50, { c: C.dim });
    SC.WEATHERS.forEach((t, i) => R.btn(x + 36 + i * 40, y + 47, 38, 12, SC.WEA_NAME[t], { k: 'wea', v: t }, { on: s.wea === t }));
    R.text('动画', x + 8, y + 66, { c: C.dim });
    OFFS.forEach(([k, n], i) => R.btn(x + 36 + (i % 5) * 40, y + 63 + (i / 5 | 0) * 14, 38, 12, n, { k: 'off', v: k }, { on: !s.off[k] }));
    R.btn(x + 36, y + 96, 70, 12, s.cur > .5 ? '拉上窗帘' : '拉开窗帘', { k: 'curtain' });
    R.btn(x + 112, y + 96, 70, 12, s.tvOn ? '关电视' : '开电视', { k: 'tv' });
    if (s.city === 'toronto') R.btn(x + 36, y + 110, 146, 12, SC.REAL.on ? '窗外：实景像素 ✓（点切手绘）' : '窗外：手绘像素（点切实景像素）', () => SC.REAL.toggle(), { on: SC.REAL.on });
    R.btn(x + w / 2 - 30, y + 128, 60, 14, '好了', { k: 'panel' });
  }

  // ---------------- street ----------------
  const streetCache = {};
  function street(cfg, area) {
    const key = cfg.id + ':' + area.id; if (streetCache[key]) return streetCache[key];
    const s = area.street || {};
    const RD = area.real && window.MM_STREETS && MM_STREETS[cfg.id] && MM_STREETS[cfg.id].areas[area.real];
    if (RD && RD.buildings.length) return (streetCache[key] = realStreet(cfg, area, RD, key));
    const len = s.len || 6;
    const sc = { id: key, seed: s.seed || 3, palette: s.palette || cfg.palette, styles: s.styles || cfg.styles, walk: s.walk, lane: s.lane || cfg.laneColor, tram: !!s.tram, shops: s.shops || cfg.shops, cross: s.cross || [2, 4], hMax: s.hMax, road: s.road };
    const W = len * 240, spots = [];
    for (let i = 0; i < len; i++) for (const sh of SC.shopsIn(sc, i)) { if ((area.spots || []).some(p => Math.abs(p.x - sh.x) < 40)) continue; spots.push({ id: 'sh' + sh.x, x: sh.x + 4, w: 10, k: 'shop', kind: sh.kind, sx: sh.sx, sw: sh.sw, label: '进去看看 · ' + (cfg.signs.shop[sh.kind] || SC.SHOPKINDS[sh.kind]), name: shopName(cfg, sh.kind, sh.x) }); }
    for (const p of area.spots || []) spots.push(Object.assign({ w: 24 }, p, { label: p.label || p.name }));
    return (streetCache[key] = { sc, W, len, spots, cross: sc.cross.map(i => i * 240) });
  }
  // Real streets: building order, storefronts and furniture come from OpenStreetMap (js/cities/<city>-streets.js).
  // Real shops are only drawn and labelled; ones whose type has a game interior can be entered (generic interior).
  const SF = () => window.Storefront;
  function realStreet(cfg, area, RD, key) {
    const s = area.street || {}, spots = [], signs = [];
    const as = area.spots || [];
    for (const sh of SC.realLayout(RD)) {
      const label = sh.n + (sh.zh ? ' · ' + sh.zh : ''), front = sh.front;
      if (front && SF()) { const sb = SF().sign(sh, RD.id); if (sb.kind !== 'none') signs.push({ sh, sb, x: sh.x, door: SF().geom(sh, sb.st), text: SF().signText(sh, sb.st) }); }
      if (as.some(p => Math.abs(p.x - sh.x) < 18)) continue;
      if (sh.g && front) spots.push({ id: 'rs' + sh.osm, x: sh.x, w: Math.max(6, Math.min(12, sh.sw / 2)), k: 'shop', kind: sh.g, sx: sh.sx, sw: sh.sw, real: 1, label: '进去看看 · ' + label, name: sh.n });
      else spots.push({ id: 'rs' + sh.osm, x: sh.x, w: Math.max(6, Math.min(10, (sh.sw || 12) / 2)), k: 'sign', real: front ? 1 : 2, label, text: sh.n + ' · ' + sh.zh + (front ? '（真实店铺，这里只画了店面）' : '（真实地点）') });
    }
    for (const p of as) spots.push(Object.assign({ w: 24 }, p, { label: p.label || p.name }));
    const cr = RD.cross.filter(c => c.x != null && c.kind === 'street');
    const sc = { id: key, real: RD, lane: s.lane || cfg.laneColor, tram: !!s.tram };
    return { sc, real: RD, W: RD.W, len: RD.len, spots, signs, cross: cr.map(c => c.x), names: cr.map(c => c.name), fur: RD.fur.filter(f => f.side !== 'far' || f.k === 'tram') };
  }
  const furDraw = (R, f, x, sy, night) => { // TTC stop poles, subway entrances, Bike Share docks, public art (plain text, no logos)
    if (f.k === 'tram') { R.rect(x, sy + 128, 2, 42, '#3a3a44'); R.rect(x - 5, sy + 120, 12, 9, '#d8343a'); R.rect(x - 4, sy + 124, 10, 1, '#fff'); }
    else if (f.k === 'subway') { R.rect(x - 10, sy + 150, 20, 20, '#2a2a33'); R.rect(x - 8, sy + 154, 16, 16, '#14161e'); R.rect(x - 1, sy + 132, 2, 18, '#3a3a44'); R.rect(x - 9, sy + 124, 19, 9, '#c8102e'); R.text('TTC', x + 1, sy + 125, { al: 'c', c: '#fff', sh: false }); }
    else if (f.k === 'bicycle_rental') { for (let k = 0; k < 4; k++) { const bx = x - 12 + k * 7; R.rect(bx, sy + 163, 5, 1, '#2e8a3e'); R.rect(bx, sy + 165, 2, 2, '#1a1a22'); R.rect(bx + 4, sy + 165, 2, 2, '#1a1a22'); R.rect(bx + 2, sy + 160, 1, 4, '#2e8a3e'); } R.rect(x - 14, sy + 167, 30, 2, '#5a5a66'); }
    else if (f.k === 'artwork') { R.rect(x - 6, sy + 162, 12, 8, '#8a8a8a'); R.rect(x - 3, sy + 146, 6, 16, night ? '#5a5a60' : '#a8a0a8'); R.rect(x - 5, sy + 142, 10, 4, night ? '#5a5a60' : '#a8a0a8'); }
  };
  function shopName(cfg, kind, x) { const L0 = (cfg.shopNames && cfg.shopNames[kind]) || [cfg.signs.shop[kind] || SC.SHOPKINDS[kind]]; return L0[(H(x, 7) * L0.length) | 0]; }
  K.street = street;
  const CAR_COLS = ['#d84a4a', '#e8e8ee', '#3a5ad8', '#2a2a30', '#8a8a96', '#5aa86a', '#e89a3a', '#7a3a5a'];
  function spawnTraffic(st, cfg, area) {
    const S = street(cfg, area); st.cars = []; st.peds = [];
    const nCar = (area.street || {}).cars === false ? 0 : Math.round(S.len * 1.6);
    for (let i = 0; i < nCar; i++) { const lane = i % 2, kind = H(i, 5) < .12 ? 2 : (cfg.taxi && H(i, 6) < .25 ? 1 : 0); st.cars.push([Math.round(H(i, 9) * S.W), lane, (H(i, 3) * CAR_COLS.length) | 0, kind, 30]); }
    if (S.sc.tram) st.cars.push([S.W * .3, cfg.drive === 'L' ? 0 : 1, 0, 3, 0, 0]);
    const nPed = Math.round(S.len * 2.2); for (let i = 0; i < nPed; i++) st.peds.push([H(i, 11) * S.W, i % 2 ? 1 : -1, (H(i, 12) * 1000) | 0, 0]);
  }
  const carLen = (k) => k === 2 ? 46 : k === 3 ? 66 : 24;
  const laneDir = (cfg, lane) => cfg.drive === 'L' ? (lane === 1 ? -1 : 1) : (lane === 1 ? 1 : -1);
  function trafficStep(st, cfg, S) {
    const t = st.t;
    for (const lane of [0, 1]) {
      const dir = laneDir(cfg, lane), cars = st.cars.filter(c => c[1] === lane);
      const front = (c) => dir > 0 ? c[0] + carLen(c[3]) : c[0];
      cars.sort((a, b) => (front(b) - front(a)) * dir);
      for (let n = 0; n < cars.length; n++) {
        const c = cars[n], f = front(c), vmax = c[3] === 2 ? 34 : c[3] === 3 ? 30 : 44 + (c[2] % 3) * 5;
        let lim = 1e9;
        if (n > 0) { const ahead = cars[n - 1], rear = dir > 0 ? ahead[0] : ahead[0] + carLen(ahead[3]); const d = (rear - f) * dir - 8; if (d > -40) lim = Math.min(lim, d); }
        for (let k = 0; k < S.cross.length; k++) { const X = S.cross[k], g = sig(t, k).main; if (g === 'g') continue; const stop = dir > 0 ? X - 2 : X + SC.GAP + 2, d = (stop - f) * dir; if (d >= -1 && d < 70 && !(g === 'y' && d < 10)) lim = Math.min(lim, d); }
        if (c[3] === 3) { // streetcar dwell at stops
          for (const p of S.spots) if (p.k === 'tram') { const d = (p.x + dir * 30 - f) * dir; if (d >= -1 && d < 60 && c[5] !== p.id) lim = Math.min(lim, d); if (d < 1 && d > -2 && c[5] !== p.id) { c[4] = 0; c[6] = (c[6] || 0) + DT; if (c[6] > 4) { c[5] = p.id; c[6] = 0; } } }
          st.tram = { x: c[0], dir, at: c[6] > 0 ? c[5] : null, stop: S.spots.find(p => p.k === 'tram' && Math.abs(p.x - (c[0] + carLen(3) / 2)) < 40 && c[6] > 0) ? 1 : 0 };
        }
        let v = c[4] || 0; v = lim < 2 ? 0 : Math.min(vmax, v + 70 * DT, lim * 3); c[4] = v; c[0] += dir * v * DT;
        if (dir > 0 && c[0] > S.W + 60) { c[0] = -90; c[2] = (c[2] + 3) % CAR_COLS.length; c[5] = 0; } if (dir < 0 && c[0] < -90) { c[0] = S.W + 60; c[2] = (c[2] + 5) % CAR_COLS.length; c[5] = 0; }
      }
    }
    // pedestrians wait at crosswalks on "don't walk"
    for (const p of st.peds) {
      let v = 20 + (p[2] % 7); const nx = p[0] + p[1] * v * DT;
      for (let k = 0; k < S.cross.length; k++) { const X = S.cross[k], edge = p[1] > 0 ? X : X + SC.GAP; const before = (edge - p[0]) * p[1], after = (edge - nx) * p[1]; if (before >= 0 && after < 0 && sig(t, k).ped !== 'walk') { v = 0; break; } }
      p[3] = v ? 1 : 0; if (v) p[0] = nx; if (p[0] > S.W + 20) p[0] = -20; if (p[0] < -20) p[0] = S.W + 20;
    }
  }
  SCN.street = {
    w: (s, cfg) => street(cfg, K.area(s, cfg)).W,
    enter(st, arg, cfg) { st.area = arg.area || st.area || cfg.areas[0].id; const a = K.area(st, cfg); const S = street(cfg, a); if (arg.x == null) arg.x = a.start || S.W / 2; spawnTraffic(st, cfg, a); st.tram = null; },
    spots(s, cfg) { return street(cfg, K.area(s, cfg)).spots; },
    act(st, sp, who, cfg, ev) {
      const h = K.hotel(st, cfg);
      if (sp.k === 'shop') K.go(st, 'shop', { kind: sp.kind, name: sp.name, ret: { area: st.area, x: sp.x } }, ev);
      else if (sp.k === 'hotel') { if (h && sp.h === h.id) K.go(st, 'lobby', { x: 80 }, ev); else K.msg(st, '这是 ' + sp.name + '，我们住在 ' + (h ? h.name : '?')); }
      else if (sp.k === 'study') K.go(st, 'shop', { kind: sp.kind || 'library', name: sp.name, study: true, ret: { area: st.area, x: sp.x } }, ev);
      else if (sp.k === 'station') K.go(st, 'station', { line: sp.line, stn: sp.stn, ret: { area: st.area, x: sp.x } }, ev);
      else if (sp.k === 'tram') { if (st.tram && st.tram.stop) K.go(st, 'ride', { line: sp.line, stn: sp.stn, ret: { area: st.area, x: sp.x } }, ev); else K.msg(st, '电车还没来，等一等～ (' + (cfg.lines.find(l => l.id === sp.line) || {}).name + ')'); }
      else if (sp.k === 'act') K.go(st, 'act', { id: sp.act, ret: { area: st.area, x: sp.x } }, ev);
      else if (sp.k === 'go') K.go(st, 'street', { area: sp.area, x: sp.tx }, ev);
      else if (sp.k === 'sign') K.msg(st, sp.text || sp.label, 3.5);
      else if (sp.k === 'cuddle') cuddleAsk(st, who, sp, ev);
    },
    block(st, cfg, S) { // cats wait for the walk signal before stepping into a crosswalk
      return (nx, ox, d) => {
        for (let k = 0; k < S.cross.length; k++) { const X = S.cross[k], edge = d > 0 ? X - 4 : X + SC.GAP + 4; if ((edge - ox) * d >= 0 && (edge - nx) * d < 0 && sig(st.t, k).ped === 'stop') { if (!st.redT || st.redT <= 0) { K.msg(st, '红灯！等一等 🚦'); st.redT = 2.5; st.honk = 1; } return edge; } }
        return nx;
      };
    },
    step(st, inp, cfg, ev) { const S = street(cfg, K.area(st, cfg)); trafficStep(st, cfg, S); if (st.redT > 0) st.redT -= DT; if (st.honk) { st.honk = 0; if (H(st.t * 10 | 0, 2) < .5) ev('sfx', 'honk'); } },
    draw(R, s, cfg) {
      const C = R.C, a = K.area(s, cfg), S = street(cfg, a), tod = K.tod(s), night = tod === 'night', t = R.t;
      const mid = (s.c[0][0] + s.c[1][0]) / 2, ox = clamp(mid - 240, 0, S.W - 480);
      SC.drawView(R, 0, 0, 480, 200, K.view(cfg, a.view), { tod, weather: s.wea, t, street: 1, pan: ox / Math.max(1, S.W - 480), off: { cars: 1, trains: 1, boats: 1, neon: s.off.neon, clouds: s.off.clouds, planes: s.off.planes, birds: s.off.birds } });
      const i0 = Math.floor(ox / 240);
      for (let i = i0; i <= i0 + 2 && i < S.len; i++) { if (S.real) R.blit(SC.realChunk(R, S.sc, i, tod), i * 240 - ox, 0); else R.blit(SC.streetChunk(R, S.sc, i, tod), i * 240 - ox, 72); }
      const sy = 72; // chunk top on screen → sidewalk 232–244, road 246–272
      // lamps first so shop signs draw on top of the posts (no sign/lamp overlap)
      for (let wx = Math.floor(ox / 120) * 120 + 60; wx < ox + 520; wx += 120) { if (S.cross.some(X => wx > X - 6 && wx < X + SC.GAP + 6)) continue; const x = wx - ox; R.rect(x, sy + 112, 2, 58, '#2a2a33'); R.rect(x - 4, sy + 110, 10, 3, '#2a2a33'); R.rect(x - 3, sy + 113, 8, 2, night ? '#ffe9a8' : '#c8c8d0'); if (night) R.rect(x - 14, sy + 115, 30, 50, '#ffe9a8', .07); }
      // shop signs (local language) + custom facades
      if (S.real) { for (const f of S.fur) { const x = f.x - ox; if (x < -30 || x > 510 || S.spots.some(q => !q.real && Math.abs(q.x - f.x) < (f.k === 'subway' ? 30 : 14))) continue; furDraw(R, f, x, sy, night); }
        const near = (x0, x1) => [0, 1].some(i => s.c[i] && s.c[i][0] > x0 - 10 && s.c[i][0] < x1 + 10) || (s.b || []).some(q => q[0] > x0 - 4 && q[0] < x1 + 4);
        for (const g of S.signs) { const st = g.sb.st, x0 = g.sb.x - ox; if (x0 < -80 || x0 > 500) continue;
          // doors swing open when a cat walks up (a dark doorway + the open leaf)
          const D = g.door; if (near(D.dx, D.dx + D.dw)) { const dx = D.dx - ox, top = st.awn && st.awn !== 'none' ? 202 : 198; R.rect(dx, top, D.dw, 232 - top, night ? st.glow : mix(st.in, '#000', .45)); R.rect(dx, top, 2, 232 - top, mix(st.dc || '#2a2a30', '#000', .2)); R.rect(dx + 2, top + 2, 1, 232 - top - 4, '#a8c4dc', .6); }
          // wordmark: full name → short → tiny form, never a truncated '…' plate
          const it = !!st.it; let fit = g.text.find(t => R.tw(t, 12, it) + (st.bold ? .5 : 0) <= g.sb.w - 2);
          if (!fit) { fit = g.text.reduce((a, b) => R.tw(b) < R.tw(a) ? b : a); const ew = R.tw(fit, 12, it) + 4; R.rect(g.sb.x + g.sb.w / 2 - ox - ew / 2, g.sb.y, ew, g.sb.h, mix(st.band, '#000', night ? .2 : 0)); } // a sign that sticks out a little, never a '…' plate
          const tc = st.tc || '#f4f0e6', tx = g.sb.x + g.sb.w / 2 - ox;
          if (night) R.rect(tx - R.tw(fit, 12, it) / 2 - 1, g.sb.y + 1, R.tw(fit, 12, it) + 2, g.sb.h - 2, tc, .14); // lit signage
          R.text(fit, tx, g.sb.y + (g.sb.h - 6) / 2 - .5, { al: 'c', c: night ? mix(tc, '#ffffff', .25) : tc, sh: false, b: st.bold, it }); } }
      for (const sp of S.spots) { const x = sp.x - ox; if (x < -80 || x > 560) continue;
        if (sp.real === 1) continue;
        if (sp.real === 2) { R.rect(x, sy + 146, 2, 24, '#3a3a44'); R.rect(x - 6, sy + 140, 14, 8, '#2a5a8a'); R.text('i', x + 1, sy + 140, { al: 'c', c: '#fff', sh: false }); continue; }
        if (S.real && (sp.k === 'hotel' || sp.k === 'study')) { const nm = sp.name, w = R.tw(nm) + 8, lx = clamp(sp.x, w / 2 + 2, S.W - w / 2 - 2) - ox; R.rect(lx - w / 2, sy + 104, w, 9, '#1a1a22'); R.rect(lx - w / 2, sy + 112, w, 1, C.gold); R.text(nm, lx, sy + 105, { al: 'c', c: C.gold, sh: false }); if (sp.k === 'hotel') { R.rect(x - 16, sy + 118, 32, 4, '#c8a050'); R.rect(x - 15, sy + 122, 1, 48, '#8a7a5a'); R.rect(x + 14, sy + 122, 1, 48, '#8a7a5a'); } else { R.rect(x, sy + 130, 2, 40, '#3a3a44'); } continue; }
        if (sp.k === 'shop') { const nm = sp.name, nx = S.spots.reduce((m, q) => q.k === 'shop' && q.sx > sp.sx && q.sx < m ? q.sx : m, 1e9), w = Math.min(sp.sw - 4, R.tw(nm) + 6, nx - sp.sx - 3); R.rect(sp.sx + 2 - ox, sy + 113, w, 8, '#1a1a22'); const t = [nm, nm.split(' ')[0]].find(q => R.tw(q) <= w - 5); if (t) R.text(t, sp.sx + 5 - ox, sy + 114, { c: night ? '#ffe9a8' : '#f4f0e6', sh: false }); }
        else facade(R, s, cfg, sp, x, sy, night, t);
      }
      // street furniture: lamps, trees, signals, street-name signs
      const fur = a.street || {};
      if (S.real ? fur.trees : fur.trees !== false) for (let wx = Math.floor(ox / 160) * 160 + 20; wx < ox + 520; wx += 160) { if (S.cross.some(X => wx > X - 14 && wx < X + SC.GAP + 14)) continue; const x = wx - ox, gc = s.wea === 'snow' ? '#e8eef4' : tod === 'golden' ? '#c8783a' : '#3a7a4a'; R.rect(x - 1, sy + 140, 3, 30, '#4a3424'); R.rect(x - 9, sy + 124, 19, 16, gc); R.rect(x - 6, sy + 120, 13, 4, gc); R.rect(x - 7, sy + 168, 15, 2, '#5a4a3a'); }
      S.cross.forEach((X, k) => { const x = X - ox; if (x < -60 || x > 520) return; const g = sig(s.t, k);
        // cross-street traffic during cross green
        if (g.cross !== 'r') for (let j = 0; j < 3; j++) { const yy = ((s.t * 30 + j * 23) % 70); const cy = sy + 118 + yy * .6, cw = 6 + yy * .14; R.rect(x + SC.GAP / 2 - (j % 2 ? cw + 2 : -2), cy, cw, cw * .6, CAR_COLS[(j * 3 + k) % 8]); }
        for (const [px, side] of [[x - 2, 0], [x + SC.GAP + 1, 1]]) {
          R.rect(px, sy + 104, 2, 66, '#3a3a44');
          R.rect(px - 3, sy + 100, 8, 18, '#2a2a30'); const lit = side ? g.main : g.main; R.rect(px - 1, sy + 102, 4, 4, lit === 'r' ? '#ff4a4a' : '#4a2020'); R.rect(px - 1, sy + 107, 4, 4, lit === 'y' ? '#ffc84a' : '#4a4020'); R.rect(px - 1, sy + 112, 4, 4, lit === 'g' ? '#5af08a' : '#204a2a');
          R.rect(px - 3, sy + 128, 8, 8, '#2a2a30'); if (g.ped === 'walk') { R.rect(px, sy + 129, 2, 2, '#f4f8ff'); R.rect(px - 1, sy + 131, 4, 3, '#f4f8ff'); } else if (g.ped === 'stop' || (t * 3 | 0) % 2) R.rect(px - 1, sy + 129, 4, 5, '#ff8a3a');
          if (g.ped !== 'stop' && g.cnt && cfg.countdown !== false) R.text(String(g.cnt), px + 1, sy + 137, { al: 'c', c: '#ff8a3a', sh: false });
        }
        const nm = (S.names || fur.names || [])[k]; if (nm) { const w = R.tw(nm) + 6, ss = cfg.streetSign || { bg: '#1f5a3a', fg: '#ffffff' }; R.rect(x + 4, sy + 94, w, 9, ss.bg); R.rect(x + 4, sy + 94, w, 1, mix(ss.bg, '#fff', .3)); R.text(nm, x + 7, sy + 95, { c: ss.fg, sh: false }); }
      });
      // passers-by (s.b) — NPC cats (everyone in this world is a cat), umbrellas when it rains
      for (const p of s.b || []) { const x = p[0] - ox; if (x < -20 || x > 500) continue; NPC.draw(R, x, sy + 170, { look: p[2], dir: p[1], moving: p[3], role: p[2] % 23 === 5 ? 'police' : p[2] % 11 === 3 ? 'student' : 'walk', wea: s.wea, t }); }
      // cats
      if (!cuddleDraw(R, s, ox)) drawCatsWalk(R, s, ox);
      // traffic (s.cars) — skip a frame when a car wraps (no streak across the street)
      for (let n = 0; n < (s.v || []).length; n++) { const c = s.v[n], dir = laneDir(cfg, c[1]), last = L.lastCar[n]; L.lastCar[n] = c[0]; if (last != null && (c[0] - last) * dir < -30) continue; const x = c[0] - ox; if (x < -70 || x > 490) continue; vehicle(R, x, c[1] ? sy + 196 : sy + 186, dir, c[3], CAR_COLS[c[2]], night, cfg, t); }
      if (s.wea === 'rain') { R.rect(0, 244, 480, 28, '#8aa0c8', .08); }
      bubbles(R, s, S.spots, ox, 150);
      // mini progress bar of the street
      R.rect(140, 18, 200, 3, C.ink2); R.rect(140 + mid / S.W * 200 - 2, 17, 5, 5, C.gold); for (const sp of S.spots) if (sp.k !== 'shop' && !sp.real) R.rect(140 + sp.x / S.W * 200, 18, 1, 3, sp.k === 'station' ? C.blue : sp.k === 'act' ? C.gold : C.mint);
      R.text(a.local || '', 140, 23, { c: C.dim });
      R.btn(4, 252, 42, 16, '地图', { k: 'map' }); R.btn(48, 252, 54, 16, '回酒店', { k: 'taxi' }); if (cfg.id === 'toronto') R.btn(104, 252, 54, 16, SC.REAL.on ? '实景像素' : '手绘像素', () => SC.REAL.toggle(), { on: SC.REAL.on });
      header(R, s, cfg, cfg.name + ' · ' + a.name); toast(R, s); fade(R, s);
    },
  };
  function vehicle(R, x, y, dir, kind, col, night, cfg, t) {
    const len = carLen(kind);
    if (kind === 3) { // streetcar / LRV (Flexity-style articulated)
      const tc = cfg.tramColor || '#d8343a', tw = cfg.tramColor2 || '#f4f0e8';
      R.rect(x, y - 18, len, 16, tc); R.rect(x, y - 12, len, 5, tw); for (let w = 3; w < len - 4; w += 7) R.rect(x + w, y - 16, 5, 4, night ? '#ffe9a8' : '#3a4a5a');
      R.rect(x + 21, y - 18, 1, 16, '#2a2a30'); R.rect(x + 44, y - 18, 1, 16, '#2a2a30'); R.rect(x + 30, y - 24, 1, 6, '#333'); R.rect(x + 26, y - 25, 9, 1, '#333');
      for (const wx of [6, 30, 54]) R.rect(x + wx, y - 2, 6, 2, '#1a1a22'); R.rect(dir > 0 ? x + len - 3 : x, y - 15, 3, 9, '#1a2a3a');
      if (cfg.tramLabel) R.text(cfg.tramLabel, dir > 0 ? x + len - 10 : x + 10, y - 23, { al: 'c', c: '#ff9a3a', sh: false });
      return;
    }
    if (kind === 2) { R.rect(x, y - 16, len, 14, cfg.busColor || '#e8e4dc'); R.rect(x, y - 6, len, 2, cfg.busStripe || '#c8344a'); for (let w = 4; w < len - 6; w += 7) R.rect(x + w, y - 14, 5, 5, night ? '#ffe9a8' : '#3a4a5a'); R.rect(x + 6, y - 2, 6, 2, '#1a1a22'); R.rect(x + len - 12, y - 2, 6, 2, '#1a1a22'); return; }
    const c = kind === 1 ? (cfg.taxi || '#f2c230') : col;
    R.rect(x, y - 7, len, 5, c); R.rect(x + 5, y - 11, 13, 4, c); R.rect(x + 6, y - 10, 5, 3, '#9ab8d8'); R.rect(x + 12, y - 10, 5, 3, '#9ab8d8');
    R.rect(x + 3, y - 3, 5, 3, '#1a1a22'); R.rect(x + len - 8, y - 3, 5, 3, '#1a1a22'); if (kind === 1) R.rect(x + 9, y - 13, 5, 2, '#fff6c0');
    R.px(dir > 0 ? x + len - 1 : x, y - 6, night ? '#fff6c0' : '#e8e8e8'); R.px(dir > 0 ? x : x + len - 1, y - 6, '#ff4060');
    if (night) R.rect(dir > 0 ? x + len : x - 14, y - 7, 14, 3, '#fff6c0', .15);
  }
  // custom street facades: stations, hotels, libraries, activity boards, tram stops, signs
  function facade(R, s, cfg, sp, x, sy, night, t) {
    const C = R.C;
    if (sp.k === 'station') { const ln = cfg.lines.find(l => l.id === sp.line) || { color: '#888' };
      if (ln.short === '5') { // Crosstown (Line 5) entrance: glass pavilion with a white frame and a sloped roof plane (approximate, after Metrolinx renderings)
        const gl = night ? '#ffe7b0' : '#a8c8d4'; R.rect(x - 22, sy + 132, 44, 3, '#f0f0ec'); R.rect(x - 22, sy + 130, 30, 2, '#f0f0ec'); R.rect(x - 21, sy + 135, 42, 35, gl, night ? .9 : .85);
        for (let k = 0; k < 4; k++) R.rect(x - 9 + k * 6, sy + 152 + k * 4, 18 - k * 4, 1, night ? '#c8a060' : '#6a7a88'); // stairs down, seen through the glass
        for (const cx of [-21, -7, 7, 20]) R.rect(x + cx, sy + 135, 1, 35, '#f4f4f0'); R.rect(x - 21, sy + 168, 42, 2, '#c8c8c4'); R.rect(x - 21, sy + 135, 42, 1, ln.color); if (!night) R.rect(x - 18, sy + 138, 6, 10, '#ffffff', .35);
        const lb = sp.sign || sp.stn, w = R.tw(lb) + 8; R.rect(x - w / 2, sy + 122, w, 9, '#1a1a1e'); R.rect(x - w / 2, sy + 122, 2, 9, ln.color); R.text(lb, x + 1, sy + 123, { al: 'c', c: '#ffffff', sh: false }); R.rect(x + w / 2 + 2, sy + 122, 9, 9, ln.color); R.text('5', x + w / 2 + 6.5, sy + 123, { al: 'c', c: ln.text || '#111', sh: false }); return; }
      R.rect(x - 20, sy + 138, 40, 32, '#2a2a33'); R.rect(x - 22, sy + 134, 44, 5, ln.color); R.rect(x - 14, sy + 144, 28, 26, '#14161e'); for (let k = 0; k < 4; k++) R.rect(x - 12 + k * 4, sy + 160 + k * 2, 24 - k * 8 + 8, 1, '#3a3a44');
      const lb = sp.sign || sp.stn; const w = R.tw(lb) + 8; R.rect(x - w / 2, sy + 124, w, 10, '#14161e'); R.rect(x - w / 2, sy + 124, 3, 10, ln.color); R.text(lb, x + 1, sy + 125, { al: 'c', c: '#ffffff', sh: false }); if (ln.short) { R.rect(x + w / 2 + 2, sy + 124, 10, 10, ln.color); R.text(ln.short, x + w / 2 + 7, sy + 125, { al: 'c', c: ln.text || '#111', sh: false }); } }
    else if (sp.k === 'tram') { const ln = cfg.lines.find(l => l.id === sp.line) || { color: '#c8344a', name: '' }; R.rect(x, sy + 132, 2, 38, '#3a3a44'); R.rect(x - 6, sy + 124, 14, 10, ln.color); R.text(ln.short || '', x + 1, sy + 125, { al: 'c', c: '#fff', sh: false }); R.rect(x + 6, sy + 150, 20, 2, '#5a5a66'); R.rect(x + 8, sy + 152, 1, 18, '#5a5a66'); R.rect(x + 24, sy + 152, 1, 18, '#5a5a66'); }
    else if (sp.k === 'hotel') { const w = sp.fw || 80; R.rect(x - w / 2, sy + 20, w, 140, sp.color || '#3a3a4e'); for (let yy = sy + 28; yy < sy + 116; yy += 10) for (let xx = x - w / 2 + 6; xx < x + w / 2 - 6; xx += 10) R.rect(xx, yy, 6, 6, night ? (H(xx, yy) < .5 ? '#ffe9a8' : '#1a2240') : '#9ab8d8'); R.rect(x - w / 2 - 4, sy + 120, w + 8, 6, '#c8a050'); R.text(sp.name, x, sy + 112, { al: 'c', c: C.gold }); R.rect(x - 12, sy + 132, 24, 38, '#9ab8d8'); R.rect(x - .5, sy + 132, 1, 38, '#c8a050'); }
    else if (sp.k === 'study') { const w = sp.fw || 70; R.rect(x - w / 2, sy + 70, w, 90, sp.color || '#8a7a6a'); R.tri && 0; for (let k = 0; k < 5; k++) R.rect(x - w / 2 + 6 + k * (w - 12) / 4, sy + 96, 4, 64, mix(sp.color || '#8a7a6a', '#fff', .3)); R.rect(x - w / 2 - 3, sy + 88, w + 6, 8, mix(sp.color || '#8a7a6a', '#fff', .2)); R.text(sp.name, x, sy + 78, { al: 'c', c: C.cream }); R.rect(x - 8, sy + 140, 16, 30, '#3a2a20'); }
    else if (sp.k === 'act') { R.rect(x - 9, sy + 146, 18, 16, '#f4ecd8'); R.rect(x - 10, sy + 145, 20, 2, '#6a4a30'); R.rect(x - 8, sy + 162, 2, 8, '#6a4a30'); R.rect(x + 6, sy + 162, 2, 8, '#6a4a30'); if (K.icon) K.icon(R, sp.icon || 'star', x, sy + 154, 2); else R.text('★', x, sy + 149, { al: 'c', c: '#c84a4a', sh: false }); if ((t * 2 | 0) % 2) R.text('!', x, sy + 136, { al: 'c', c: C.gold }); }
    else if (sp.k === 'sign') { R.rect(x, sy + 140, 2, 30, '#3a3a44'); R.rect(x - 10, sy + 132, 22, 10, sp.color || '#2a5a8a'); R.text('i', x + 1, sy + 133, { al: 'c', c: '#fff', sh: false }); }
    else if (sp.k === 'go') { R.rect(x - 1, sy + 136, 2, 34, '#3a3a44'); R.rect(x - 16, sy + 130, 32, 9, '#1f5a3a'); R.text((sp.dir < 0 ? '◀ ' : '') + (sp.short || sp.label) + (sp.dir > 0 ? ' ▶' : ''), x, sy + 131, { al: 'c', c: '#fff', sh: false }); }
    else if (sp.k === 'cuddle') { R.rect(x - 16, sy + 158, 32, 4, '#6a4a30'); R.rect(x - 16, sy + 150, 32, 3, '#6a4a30'); R.rect(x - 14, sy + 162, 2, 8, '#2a2a33'); R.rect(x + 12, sy + 162, 2, 8, '#2a2a33'); }
  }

  // ---------------- shop / cafe / library interiors ----------------
  const ITEMS = {
    cafe: [['拿铁', 4], ['抹茶拿铁', 5], ['可颂', 3], ['热可可', 4]], books: [['城市明信片', 2], ['旅行手账', 6], ['猫咪书签', 2], ['当地地图', 3]],
    grocery: [['小鱼干', 3], ['牛奶', 2], ['水果', 3], ['薯片', 2]], bakery: [['肉桂卷', 4], ['法棍', 3], ['蛋挞', 3], ['小熊饼干', 2]],
    ramen: [['豚骨拉面', 8], ['煎饺', 4], ['温泉蛋', 2]], flowers: [['一支玫瑰', 3], ['向日葵', 4], ['小花束', 8]], conv: [['饭团', 2], ['热咖啡', 2], ['冰淇淋', 2], ['雨伞', 5]],
    bar: [['热苹果汁', 4], ['气泡水', 3], ['小食拼盘', 7]], gift: [['冰箱贴', 3], ['钥匙扣', 3], ['雪花玻璃球', 9], ['帽衫', 15]], game: [['扭蛋', 2], ['掌机卡带', 12], ['贴纸', 1]],
    tea: [['奶茶', 4], ['乌龙茶', 3], ['茶点', 4]], bank: [['兑换硬币', 0]], library: [['借一本书', 0]],
  };
  SCN.shop = {
    w: () => 480,
    enter(st, arg) { if (arg.x == null) arg.x = 60; if (arg.study || arg.kind === 'library' || arg.kind === 'cafe') st.prompt = { k: 'study', place: arg.name, kind: arg.kind }; },
    spots(s, cfg) { const sp = [{ id: 'out', x: 30, w: 20, label: '出门', k: 'out' }, { id: 'counter', x: 330, w: 60, label: s.arg.kind === 'library' ? '借书台' : '柜台 · 买东西', k: 'buy' }]; if (s.arg.kind === 'cafe' || s.arg.kind === 'tea' || s.arg.kind === 'library' || s.arg.kind === 'bakery') sp.push({ id: 'nap', x: 170, w: 40, label: '靠着打个盹', k: 'cuddle', kind: 'cafe', y: FLOOR - 14 }); return sp; },
    act(st, sp, who, cfg, ev) {
      if (sp.k === 'out') { const r = st.arg.ret || {}; K.go(st, 'street', { area: r.area, x: r.x }, ev); }
      if (sp.k === 'buy') st.panel = 'buy';
      if (sp.k === 'cuddle') cuddleAsk(st, who, sp, ev);
    },
    draw(R, s, cfg) {
      const C = R.C, kind = s.arg.kind || 'cafe', lib = kind === 'library', wall = { cafe: '#5a4038', library: '#3a3550', books: '#4a3a3a', grocery: '#d8d8d0', conv: '#e8e8f0', bakery: '#e8d8c0', ramen: '#4a2a2a', flowers: '#d8e8d0', gift: '#4a3a5a', bar: '#2a2030', game: '#2a2a4a', tea: '#c8b898', bank: '#d0d0d8' }[kind] || '#4a4a5a';
      R.rect(0, 0, 480, 200, wall); R.rect(0, 196, 480, 4, '#2a2030'); for (let y = 200; y < 272; y += 6) R.rect(0, y, 480, 6, (y / 6) % 2 ? '#7a5a42' : '#6e503a');
      // front window to the street
      SC.drawView(R, 60, 60, 80, 90, K.view(cfg, K.area(s, cfg).view), { tod: K.tod(s), weather: s.wea, t: R.t, off: s.off }); SC.windowFrame(R, 60, 60, 80, 90, { style: 'grid', t: R.t, weather: s.wea });
      R.rect(14, 104, 30, 96, '#e8e0d0'); R.rect(16, 106, 26, 94, '#5a3a2a');
      // shelves full of goods
      const goods = (lib || kind === 'books') ? 4 : 3;
      for (let r = 0; r < goods; r++) { const y = 70 + r * 32; R.rect(200, y, lib ? 270 : 110, 3, '#6a4a30'); for (let i = 0; i < (lib ? 52 : 20); i++) { const bh = lib || kind === 'books' ? 14 + (H(i, r) * 8 | 0) : 8 + (H(i, r) * 6 | 0); R.rect(202 + i * 5, y - bh, 4, bh, ['#b8704a', '#5a8ac8', '#f3c55e', '#8fe0b0', '#9a7aaa', '#e8e4f0', '#c87a3a'][(i * 3 + r) % 7]); } }
      if (!lib) { R.rect(300, 206, 110, 36, '#6a4030'); R.rect(300, 204, 110, 3, '#e8d0a0'); R.rect(380, 186, 18, 18, '#2a2a33'); R.rect(382, 188, 14, 10, '#5af08a'); }
      else { for (const tx of [250, 380]) { R.rect(tx, 216, 70, 4, '#8a6040'); R.rect(tx + 4, 220, 3, 22, '#6a4a30'); R.rect(tx + 63, 220, 3, 22, '#6a4a30'); SC.F.lamp(R, tx + 35, 216, true, R.t); } }
      if (kind === 'cafe' || kind === 'tea' || kind === 'bakery' || lib) { R.rect(150, 222, 40, 4, '#8a6040'); R.rect(168, 226, 4, 16, '#6a4a30'); R.rect(150, 214, 8, 8, '#f4f0e6'); R.rect(176, 216, 6, 6, '#f4f0e6'); if (kind === 'cafe') { R.rect(310, 168, 20, 18, '#a8a8b4'); R.rect(352, 150, 50, 24, '#1a1a22'); R.text('MENU', 377, 152, { al: 'c', c: '#f4f0e6', sh: false }); } }
      if (!lib) { const role = { cafe: 'barista', tea: 'barista', bakery: 'chef', ramen: 'chef', books: 'librarian', bar: 'concierge', bank: 'clerk', flowers: 'vendor', grocery: 'vendor', conv: 'clerk', gift: 'clerk', game: 'student' }[kind] || 'clerk'; NPC.draw(R, 342, 206, { look: (kind.length * 7) | 0, role, sit: 1, dir: -1, t: R.t }); R.rect(300, 206, 110, 36, '#6a4030'); R.rect(300, 204, 110, 3, '#e8d0a0'); }
      else NPC.draw(R, 285, 214, { look: 12, breed: 4, role: 'librarian', sit: 1, dir: -1, t: R.t });
      const nm = s.arg.name || ''; const w = R.tw(nm) + 14; R.rect(240 - w / 2, 18, w, 14, '#1a1a22'); R.text(nm, 240, 22, { al: 'c', c: C.cream });
      if (!cuddleDraw(R, s, 0)) drawCatsWalk(R, s, 0);
      bubbles(R, s, SCN.shop.spots(s, cfg), 0, 160);
      header(R, s, cfg, nm); toast(R, s);
      if (s.panel === 'buy') { const items = (cfg.items && cfg.items[kind]) || ITEMS[kind] || ITEMS.gift; R.panel(140, 50, 200, 30 + items.length * 18, { title: lib ? '借书台' : '买点什么？' }); items.forEach(([n, p], i) => R.btn(150, 68 + i * 18, 180, 15, n + (p ? '  🪙' + p : ''), { k: 'buy', i }, { dis: p > s.coins })); R.btn(210, 72 + items.length * 18, 60, 12, '不买了', { k: 'panel' }); }
      fade(R, s);
    },
    buy(st, i, cfg, ev) { const kind = st.arg.kind, items = (cfg.items && cfg.items[kind]) || ITEMS[kind] || ITEMS.gift, it = items[i]; if (!it) return; if (!Wallet.spend(it[1])) { K.msg(st, '硬币不够啦'); return; } st.coins = Wallet.coins; ev('sfx', 'coin'); ev('bought', it[0], cfg.name); if (kind === 'gift' || kind === 'books' || kind === 'flowers') Wallet.souvenir(it[0] + '（' + cfg.name + '）', cfg.id); K.msg(st, '买到了：' + it[0] + ' ✨'); st.panel = 0; },
  };

  // ---------------- map ----------------
  SCN.map = {
    draw(R, s, cfg) {
      const C = R.C, m = cfg.map || {}, X = 8, Y = 18, W = 300, Hh = 246, sx = (x) => X + x / 100 * W, sy = (y) => Y + y / 100 * Hh;
      R.rect(0, 0, 480, 272, '#1a1f2e'); R.rect(X, Y, W, Hh, m.land || '#e8e0cc');
      for (const w of m.water || []) R.rect(sx(w[0]), sy(w[1]), w[2] / 100 * W, w[3] / 100 * Hh, '#8ab8d8');
      for (const p of m.parks || []) R.rect(sx(p[0]), sy(p[1]), p[2] / 100 * W, p[3] / 100 * Hh, '#a8d098');
      for (const r of m.roads || []) { for (let k = 0; k < r.length - 1; k++) { const [x0, y0] = r[k], [x1, y1] = r[k + 1]; const n = Math.max(Math.abs(sx(x1) - sx(x0)), Math.abs(sy(y1) - sy(y0))) | 0; for (let q = 0; q <= n; q++) R.rect(sx(x0) + (sx(x1) - sx(x0)) * q / (n || 1), sy(y0) + (sy(y1) - sy(y0)) * q / (n || 1), 1, 1, '#ffffff'); } }
      for (const ln of cfg.lines) { const pts = (m.lines || {})[ln.id]; if (!pts) continue; for (let k = 0; k < pts.length - 1; k++) { const [x0, y0] = pts[k], [x1, y1] = pts[k + 1]; const n = Math.max(Math.abs(sx(x1) - sx(x0)), Math.abs(sy(y1) - sy(y0))) | 0; for (let q = 0; q <= n; q++) R.rect(sx(x0) + (sx(x1) - sx(x0)) * q / (n || 1) - 1, sy(y0) + (sy(y1) - sy(y0)) * q / (n || 1) - 1, 2, 2, ln.color); } for (const p of pts) if (p[2]) { R.rect(sx(p[0]) - 1, sy(p[1]) - 1, 3, 3, '#fff'); R.text(p[2], sx(p[0]) + 3, sy(p[1]) - 3, { c: '#2a2a33', sh: false }); } }
      for (const l of m.labels || []) R.text(l[2], sx(l[0]), sy(l[1]), { c: l[3] || '#5a5a6a', sh: false });
      for (const a of cfg.areas) { const p = (m.areas || {})[a.id]; if (!p) continue; const here = s.area === a.id; R.btn(sx(p[0]) - 30, sy(p[1]) - 7, 60, 13, a.name, { k: 'goArea', id: a.id }, { c: here ? '#7a4a2a' : '#3a4a6a' }); }
      const h = K.hotel(s, cfg), hp = h && (m.areas || {})[h.area]; if (hp) R.text('🏨', sx(hp[0]) + 26, sy(hp[1]) - 14, {});
      // legend + routes
      R.panel(314, 18, 160, 246, { title: cfg.name + ' 交通' });
      let y = 34; for (const ln of cfg.lines) { R.rect(320, y + 1, 10, 6, ln.color); R.text(ln.name, 334, y, { c: C.paper }); y += 10; if (y > 120) break; }
      R.text('推荐路线', 320, y + 4, { c: C.gold }); y += 16;
      (cfg.routes || []).forEach((r, i) => { if (y > 228) return; R.btn(318, y, 152, 22, '', { k: 'route', i }, { c: '#2e3a52' }); R.text(R.clip ? R.clip(r.name, 144) : r.name, 322, y + 2, { c: C.cream }); R.text(R.clip ? R.clip(r.desc, 144) : r.desc.slice(0, 26), 322, y + 12, { c: C.dim }); y += 24; });
      R.btn(318, 246, 74, 14, '回酒店', { k: 'taxi' }); R.btn(396, 246, 74, 14, '换城市', { k: 'pickCity' });
      R.text('点一个街区就过去（散步/打车）', X + 4, Y + Hh - 10, { c: '#5a5a6a', sh: false });
      R.topBar(cfg.name + ' · 地图'); toast(R, s);
    },
  };

  // prompt (坐下一起学习？) — rendered over any scene
  function promptDraw(R, s) {
    const p = s.prompt; if (!p) return; const C = R.C;
    R.rect(0, 0, 480, 272, '#000', .35); R.panel(140, 80, 200, 92, { title: p.place || '' });
    R.text('坐下一起学习？', 240, 102, { al: 'c', size: 24, c: C.cream });
    R.btn(150, 132, 58, 16, '坐下学习', { k: 'prompt', v: 'study' }, { c: '#3a6a5a' }); R.btn(212, 132, 58, 16, '逛逛', { k: 'prompt', v: 'browse' }); R.btn(274, 132, 58, 16, '离开', { k: 'prompt', v: 'leave' }, { c: '#6a3a4a' });
    R.text('↑ 坐下学习 · ↓ 逛逛', 240, 154, { al: 'c', c: C.dim });
  }
  function doPrompt(st, v, cfg, ev) {
    const p = st.prompt; if (!p) return; st.prompt = null;
    if (v === 'study') { const a = K.area(st, cfg); st._sw = { k: 'switch', m: 'study', arg: { place: p.place, view: p.view || K.view(cfg, a.view), room: 'study', rain: st.wea === 'rain', night: K.tod(st) === 'night' }, back: true }; ev('diary', 'studyspot', { p: p.place }); }
    if (v === 'leave' && st.sc === 'shop') { const r = st.arg.ret || {}; K.go(st, 'street', { area: r.area, x: r.x }, ev); }
  }

  // ---------------- the mode ----------------
  Hub.mode('travel', {
    music(s) { if (s.cud) return 'cuddle'; if (['room', 'lobby', 'hall', 'entry', 'bath', 'balcony'].includes(s.sc)) return 'hotel'; if (s.sc === 'shop') return s.arg && s.arg.kind === 'library' ? 'study' : 'hotel'; return 'travel'; },
    pad(s) { return ['street', 'lobby', 'hall', 'room', 'entry', 'bath', 'balcony', 'shop', 'station', 'ride'].includes(s.sc) || (s.sc === 'act' && s.act && s.act.pad); },
    create(arg) {
      const st = { sc: 'pick', city: null, hotel: null, area: null, arg: {}, day: 1, clock: 16, auto: true, wea: 'clear', off: {}, cur: 0.9, tvOn: 0, inn: 0, c: [[200, FLOOR], [230, FLOOR]], f: [1, -1], mv: [0, 0], pw: 0, cud: null, ask: null, msg: null, t: 0, cars: [], peds: [], tram: null, prompt: null, panel: 0, pin: [{}, {}], fi: 0, coins: Wallet.coins, ride: null, act: null };
      if (arg.city && Cities.get(arg.city)) { st.city = arg.city; st.sc = 'hotels'; }
      return st;
    },
    resume(st, ev, res) { st.prompt = null; st.panel = 0; st.fi = .45; st.coins = Wallet.coins; K.msg(st, res && res.msg || '回来啦～'); },
    act(st, a, who, ev) {
      const cfg = city(st);
      switch (a.k) {
        case 'city': {
          const enter = () => { st.city = a.id; st.sc = 'hotels'; st.hotel = null; st.inn = 0; const c = Cities.get(a.id); ev('place', c.name, a.id); ev('sfx', 'chimeS'); if (a.area) { st.hotel = 0; st.inn = 1; K.go(st, 'street', { area: a.area, x: a.x }, ev); } };
          if (Cities.get(a.id)) enter(); else { st.sc = 'wait'; Cities.load(a.id).then(enter).catch(() => { st.sc = 'pick'; K.msg(st, '这座城市还在施工中'); }); }
          return;
        }
        case 'pickCity': st.sc = 'pick'; st.city = null; return;
        case 'hotel': if (cfg && cfg.hotels[a.i]) { st.hotel = a.i; st.inn = 0; st.area = cfg.hotels[a.i].area; K.go(st, 'lobby', { x: 80 }, ev); } return;
        case 'map': if (cfg) K.go(st, 'map', { back: st.sc }, ev); return;
        case 'goArea': if (cfg) { ev('sfx', 'honk'); K.go(st, 'street', { area: a.id }, ev); K.msg(st, '到了：' + cfg.areas.find(x => x.id === a.id).name); } return;
        case 'taxi': if (cfg && st.hotel != null) { ev('sfx', 'honk'); st.area = K.hotel(st, cfg).area; K.go(st, 'lobby', { x: 80 }, ev); K.msg(st, '打车回酒店 🚕'); } return;
        case 'route': if (cfg && cfg.routes[a.i]) { const r = cfg.routes[a.i], leg = r.legs[0]; st.routeI = a.i; K.go(st, 'station', { line: leg[0], stn: leg[1], route: a.i, ret: { area: st.area, x: st.c[0][0] } }, ev); K.msg(st, '路线：' + r.name, 3); } return;
        case 'spot': { const S = SCN[st.sc]; if (!S || !S.spots || st.cud) return; const sp = S.spots(st, cfg).find(p => p.id === a.id); if (!sp) return; const ci = who === 1 ? 1 : 0; if (Math.abs(sp.x - st.c[ci][0]) > (sp.w || 0) / 2 + 30) return; doSpot(st, sp, ci, cfg, ev); return; }
        case 'prompt': doPrompt(st, a.v, cfg, ev); return;
        case 'tod': if (a.v === 'auto') st.auto = !st.auto; else if (TODH[a.v]) { st.clock = TODH[a.v]; st.auto = false; } return;
        case 'wea': if (SC.WEATHERS.includes(a.v)) st.wea = a.v; return;
        case 'off': if (typeof a.v === 'string') st.off[a.v] = !st.off[a.v]; return;
        case 'curtain': st.cur = st.cur > .5 ? 0.12 : 0.9; ev('sfx', 'click'); return;
        case 'tv': st.tvOn = st.tvOn ? 0 : 1; return;
        case 'panel': st.panel = 0; return;
        case 'buy': if (st.sc === 'shop') SCN.shop.buy(st, a.i | 0, cfg, ev); return;
        case 'goodnight': goodnight(st, ev); return;
        case 'cuddleBtn': { const S = SCN[st.sc]; const ci = who === 1 ? 1 : 0; const sp = S && S.spots ? spotNear(S.spots(st, cfg).filter(p => p.k === 'cuddle'), st.c[ci][0], 40) : null; cuddleAsk(st, ci, sp, ev); return; }
      }
      const S = SCN[st.sc]; if (S && S.actx) S.actx(st, a, who, cfg, ev);
    },
    step(st, inputs, ev) {
      st.t += DT; if (st.fi > 0) st.fi -= DT; if (st.msg && st.msg[1] > 0) st.msg[1] -= DT;
      if (st.auto) st.clock = (st.clock + DT / 45) % 24; // one game hour ≈ 45 s
      const cfg = city(st), E = edges(st, inputs); if (!cfg) return;
      const S = SCN[st.sc]; if (!S) return;
      if (st.prompt) { for (let i = 0; i < 2; i++) { if (E[i].j || E[i].a) doPrompt(st, 'study', cfg, ev); else if (E[i].d) doPrompt(st, 'browse', cfg, ev); } return; }
      if (st.panel) { if (E[0].d || E[1].d) st.panel = 0; return; }
      const busy = cuddleStep(st, E, ev);
      if (S.step) S.step(st, inputs, cfg, ev, E);
      if (busy || !S.spots || S.noWalk) return;
      const w = S.w ? S.w(st, cfg) : 480;
      walk(st, inputs, 16, w - 16, S.block ? S.block(st, cfg, st.sc === 'street' ? street(cfg, K.area(st, cfg)) : null) : null);
      if (st.pw && st.pwDist > 400) { st.pwDist = -1e9; ev('diary', 'pawswalk'); }
      const spots = S.spots(st, cfg);
      for (let i = 0; i < 2; i++) {
        if (E[i].j || (E[i].a && !(inputs[i] || {}).l && !(inputs[i] || {}).r)) { const sp = spotNear(spots, st.c[i][0]); if (sp) doSpot(st, sp, i, cfg, ev); }
        if (E[i].d) { const sp = spotNear(spots.filter(p => p.k === 'cuddle'), st.c[i][0], 40); if (sp) cuddleAsk(st, i, sp, ev); else if (Math.abs(st.c[0][0] - st.c[1][0]) < 40 || st.pw) cuddleAsk(st, i, null, ev); }
      }
    },
    onHug(st, ev) { if (st.cud) return; ev('diary', 'hugtravel'); },
    snap(st) {
      const o = { sc: st.sc, city: st.city, hotel: st.hotel, area: st.area, arg: st.arg, day: st.day, clock: Math.round(st.clock * 100) / 100, auto: st.auto, wea: st.wea, off: st.off, cur: st.cur, tvOn: st.tvOn, inn: st.inn, c: st.c.map(c => [Math.round(c[0] * 10) / 10, c[1]]), f: st.f.slice(), mv: st.mv.slice(), pw: st.pw, cud: st.cud && Object.assign({}, st.cud, { t: Math.round(st.cud.t * 10) / 10, gn: Math.round(st.cud.gn * 20) / 20 }), ask: st.ask && { who: st.ask.who, k: st.ask.k }, msg: st.msg && st.msg[1] > 0 ? st.msg : null, t: Math.round(st.t * 20) / 20, prompt: st.prompt, panel: st.panel, fi: Math.max(0, Math.round(st.fi * 20) / 20), coins: st.coins, el: st.el };
      if (st.sc === 'street') { o.v = st.cars.map(c => [Math.round(c[0]), c[1], c[2], c[3]]); o.b = st.peds.map(p => [Math.round(p[0]), p[1], p[2], p[3]]); o.tram = st.tram; }
      const S = SCN[st.sc]; if (S && S.snap) S.snap(st, o);
      return o;
    },
    onEvent(R, e, s) {
      if (e[0] === 'place') Diary.setPlace(e[1], e[2]);
      if (e[0] === 'diary') Diary.stamp(e[1], e[2]);
      if (e[0] === 'cuddle') { Sfx.purr(); Sfx.ambience && Sfx.ambience({ purr: 0.25 }); }
      if (e[0] === 'uncuddle') Sfx.ambience && Sfx.ambience({ purr: 0 });
      if (e[0] === 'goodnight') { Sfx.purr(); GameUI.banner('晚安 ♥ 明天见', 2200); }
      if (e[0] === 'morning') { Sfx.ambience && Sfx.ambience({ purr: 0 }); Sfx.chime(); }
      if (e[0] === 'coin') { Sfx.play('coin'); GameUI.banner('🪙 +' + e[1] + ' 旅行硬币', 1600); }
      if (e[0] === 'bought') Diary.stamp('bought', { item: e[1], city: e[2] });
      if (e[0] === 'ask') { const me = R.who(); const what = e[2] === 'paws' ? '牵爪爪' : '一起窝着'; if (App.role === 'local' || e[1] !== me) GameUI.banner(`${CAT_NAMES[e[1]]} 想${what}！按 ↓ 答应`, 2200); else GameUI.banner(`等 ${CAT_NAMES[1 - e[1]]} 也按 ↓…`, 1800); }
      const S = SCN[s && s.sc]; if (S && S.onEvent) S.onEvent(R, e, s);
    },
    key(R, s, code) { if (code === 'KeyM' && s.city && App.role !== 'local') App.act({ k: 'map' }, R.who()); },
    pointer(R, s, kind, x, y) { const S = SCN[s.sc]; if (S && S.pointer) S.pointer(R, s, kind, x, y); },
    draw(R, s, dt) {
      const cfg = city(s);
      if (s.sc === 'pick') return SCN.pick.draw(R, s);
      if (!cfg || s.sc === 'wait') { if (s.city) Cities.load(s.city).catch(() => {}); R.rect(0, 0, 480, 272, R.C.ink2); R.text('打包行李中… 🧳', 240, 120, { al: 'c', size: 24 }); R.topBar(''); return; }
      const S = SCN[s.sc]; if (!S) return;
      S.draw(R, s, cfg, dt);
      // touch helpers: paws / cuddle button
      if (['street', 'lobby', 'hall', 'room', 'entry', 'bath', 'balcony', 'shop', 'ride'].includes(s.sc) && !s.cud && s.c[0] && s.c[1]) { const near = Math.abs(s.c[0][0] - s.c[1][0]) < 40; if (near || s.pw) R.btn(AWm - 64, 252, 42, 16, s.pw ? '松爪' : '牵爪/窝', { k: 'cuddleBtn' }, { c: '#6a3a5a' }); }
      if (s.ask) { const c = s.c[s.ask.who]; if (c) { const ox = s.sc === 'street' ? clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, street(cfg, K.area(s, cfg)).W - 480) : S.w ? clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, Math.max(0, S.w(s, cfg) - 480)) : 0; R.text(s.ask.k === 'paws' ? '🐾?' : '💤?', c[0] - ox, c[1] - 44 + Math.sin(R.t * 6), { al: 'c', c: R.C.warm }); } }
      promptDraw(R, s);
    },
  });
  const AWm = 480;
  function doSpot(st, sp, who, cfg, ev) {
    const S = SCN[st.sc];
    if (sp.k === 'cuddle') return cuddleAsk(st, who, sp, ev);
    if (S.act) S.act(st, sp, who, cfg, ev);
  }
})();
