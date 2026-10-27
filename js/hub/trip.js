// ============================================================
//  Trip loop on top of the travel engine (loaded after travel2.js):
//  departures hub (title) → packing → the journey (plane / train) →
//  hotel check-in → each morning a choice of three doors (itinerary)
//  → streets / rides / activities → evening "go back?" → cuddle +
//  goodnight → next day.  Also: per-city bucket list (心愿清单),
//  hotel TV with a game channel, and packing effects.
//  Everything is host-authoritative (state in st), drawn on both sides.
// ============================================================
(function () {
  const K = TravelKit, SCN = K.SCN, SC = Scenery, H = SC.hash, mix = SC.mix, DT = K.DT, FLOOR = K.FLOOR, clamp = K.clamp;
  const M = Hub.MODES.travel;

  // ---------- arrival per city: [by, number, code, arrival hub] (numbers fictional) ----------
  const ARR = {
    toronto: ['plane', 'MM 0417', 'YYZ', '皮尔逊国际机场'], waterloo: ['train', 'GO 4701', 'KIT', 'Kitchener 站'],
    tokyo: ['plane', 'MM 0011', 'HND', '羽田机场'], kyoto: ['shinkansen', 'のぞみ 21', 'KYO', '京都站'],
    paris: ['plane', 'MM 0880', 'CDG', '戴高乐机场'], nyc: ['plane', 'MM 0212', 'JFK', '肯尼迪机场'], boston: ['plane', 'MM 2150', 'BOS', '洛根机场'],
    vancouver: ['plane', 'MM 0604', 'YVR', '温哥华机场'], london: ['plane', 'MM 0858', 'LHR', '希思罗机场'], seoul: ['plane', 'MM 0520', 'ICN', '仁川机场'],
    hongkong: ['plane', 'MM 0852', 'HKG', '香港机场'],
  };
  const arr = (id) => ARR[id] || ['plane', 'MM ' + String(100 + (H(id.length, id.charCodeAt(0)) * 800 | 0)).padStart(4, '0'), id.slice(0, 3).toUpperCase(), '机场'];
  const CLIMATE = {
    toronto: '秋天凉爽，常有小雨；冬天会下雪 ❄', waterloo: '比多伦多更冷一点，风大，带围巾！', tokyo: '秋天舒服，偶尔下雨', kyoto: '红叶季，早晚凉，走路很多',
  };
  const PACK = [
    ['umbrella', '雨伞', '☂', '下雨也能一起挤在伞下'], ['scarf', '围巾', '🧣', '冷天不怕风'], ['camera', '相机', '📷', '拍照活动多拿硬币'],
    ['snacks', '小鱼干', '🐟', '路上分着吃'], ['handheld', '掌机', '🎮', '酒店里随时开一局'], ['guide', '旅行指南', '📖', '门后行程多一个提示'],
    ['pajamas', '情侣睡衣', '🌙', '晚安时多一点心动'], ['sunscreen', '防晒', '☀', '晴天在外更久'],
  ];
  const MAXPACK = 5;

  // ---------- bucket list (心愿清单), stored per device; host copy lives in st.bk ----------
  const BK = 'mmcx-bucket';
  const Bucket = window.Bucket = {
    all() { try { return JSON.parse(localStorage.getItem(BK) || '{}'); } catch (e) { return {}; } },
    of(city) { return this.all()[city] || {}; },
    mark(city, key) { const d = this.all(); d[city] = d[city] || {}; if (d[city][key]) return false; d[city][key] = Date.now(); try { localStorage.setItem(BK, JSON.stringify(d)); } catch (e) {} return true; },
    items(cfg) { // [key, label]
      const out = [['arrive', '抵达' + cfg.name], ['checkin', '入住酒店'], ['gn', '在' + cfg.name + '说晚安']];
      for (const a of cfg.areas) out.push(['a:' + a.id, '逛逛 ' + a.name]);
      for (const l of cfg.lines) out.push(['l:' + l.id, '坐一次 ' + l.name]);
      for (const a of cfg.acts || []) out.push(['act:' + a.id, a.name]);
      (cfg.routes || []).forEach((r, i) => out.push(['r:' + i, '路线：' + r.name]));
      return out;
    },
    progress(id) { const cfg = Cities.get(id); if (!cfg) { const n = Object.keys(this.of(id)).length; return n ? [n, 0] : null; } const it = this.items(cfg), b = this.of(id); return [it.filter(([k]) => b[k]).length, it.length]; },
  };
  function tick(st, key, ev) { // host: mark a bucket item for the current city
    if (!st.city) return; st.bk = st.bk || {}; if (st.bk[key]) return; st.bk[key] = 1;
    const cfg = K.city(st); const it = cfg && Bucket.items(cfg).find(x => x[0] === key);
    ev('bucket', st.city, key, it ? it[1] : key);
  }

  // ---------- itinerary doors ----------
  function doors(st, cfg) {
    const b = st.bk || {}, d = st.day || 1, pick = (arr, f) => { const fresh = arr.filter(f); const L = fresh.length ? fresh : arr; return L.length ? L[(d * 7 + (st.dseed || 0)) % L.length] : null; };
    const out = [];
    const act = pick(cfg.acts || [], a => !b['act:' + a.id]); if (act) out.push({ k: 'act', id: act.id, area: act.area, x: act.x, t: '活动', n: act.name, c: '#b8643a' });
    const ri = (cfg.routes || []).map((r, i) => i), r = pick(ri, i => !b['r:' + i]); if (r != null) out.push({ k: 'route', i: r, t: '坐车', n: cfg.routes[r].name, c: '#3a7ac8' });
    const ar = pick(cfg.areas, a => !b['a:' + a.id]); if (ar) out.push({ k: 'area', id: ar.id, t: '散步', n: ar.name, c: '#4a9a6a' });
    out.push({ k: 'free', t: '随意', n: '在酒店附近走走', c: '#8a7a5a' });
    return out;
  }
  const PLAN_X = [92, 192, 292, 392];
  SCN.plan = {
    w: () => 480,
    enter(st) { st.dseed = (st.dseed || 0); },
    spots(s, cfg) { return doors(s, cfg).map((d, i) => ({ id: 'door' + i, x: PLAN_X[i], w: 30, label: d.t + ' · ' + d.n, k: 'door', i })).concat([{ id: 'back', x: 24, w: 16, label: '回大堂', k: 'back' }]); },
    act(st, sp, who, cfg, ev) {
      if (sp.k === 'back') return K.go(st, 'lobby', { x: 60 }, ev);
      const d = doors(st, cfg)[sp.i]; if (!d) return; const h = K.hotel(st, cfg); ev('sfx', 'ding'); ev('diary', 'door', { d: d.n });
      if (d.k === 'act') { st.area = d.area || st.area; K.go(st, 'act', { id: d.id, ret: { area: st.area, x: d.x } }, ev); }
      else if (d.k === 'route') { st.area = h.area; M.act(st, { k: 'route', i: d.i }, who, ev); }
      else if (d.k === 'area') { ev('sfx', 'honk'); K.go(st, 'street', { area: d.id }, ev); K.msg(st, '出发去 ' + d.n); }
      else K.go(st, 'street', { area: h.area, x: h.x || 240 }, ev);
    },
    draw(R, s, cfg) {
      const C = R.C, h = K.hotel(s, cfg), pal = h.lobby || {}, wall = pal.wall || '#5a4038', tod = K.tod(s);
      R.rect(0, 0, 480, 272, wall); for (let x = 0; x < 480; x += 40) R.rect(x, 0, 20, 200, mix(wall, '#000', .1));
      R.rect(0, 196, 480, 4, '#c8a060'); for (let y = 200; y < 272; y += 8) for (let x = ((y / 8) % 2) * 8 - 8; x < 480; x += 16) R.rect(x, y, 8, 8, (y / 8) % 2 ? '#e8e0d0' : '#cfc6b4');
      R.text('今天想去哪？选一扇门 🚪 · 第' + s.day + '天 · ' + SC.TOD_NAME[tod], 240, 40, { al: 'c', c: C.cream });
      if (s.pack && s.pack.guide) R.text('📖 指南：没去过的地方排在前面', 240, 186, { al: 'c', c: C.dim });
      doors(s, cfg).forEach((d, i) => {
        const x = PLAN_X[i], near = [0, 1].some(c => Math.abs(s.c[c][0] - x) < 22);
        R.rect(x - 24, 98, 48, 104, '#2a1e1a'); R.rect(x - 21, 101, 42, 99, d.c); R.rect(x - 18, 104, 36, 44, mix(d.c, '#fff', .18)); R.rect(x - 18, 152, 36, 44, mix(d.c, '#000', .1));
        if (near) { R.rect(x - 21, 101, 42, 99, '#fff8d0', .12 + Math.sin(R.t * 5) * .05); }
        R.rect(x + 12, 150, 4, 4, '#e8c86a');
        R.panel(x - 46, 58, 92, 34, { fill: '#1a1f2e', shadow: false }); R.text(d.t, x, 62, { al: 'c', c: C.gold }); let t = d.n; while (t.length > 2 && R.tw(t) > 84) t = t.slice(0, -1); R.text(t === d.n ? t : t.slice(0, -1) + '…', x, 74, { al: 'c', c: C.cream });
        if ((s.bl || {})[d.k === 'act' ? 'act:' + d.id : d.k === 'route' ? 'r:' + d.i : d.k === 'area' ? 'a:' + d.id : '_'] ) R.text('✓', x + 40, 60, { al: 'r', c: C.mint });
      });
      R.rect(12, 150, 24, 50, '#3a2a20'); R.text('←', 24, 140, { al: 'c', c: C.dim });
      if (!K.cuddleDraw(R, s, 0)) K.drawCatsWalk(R, s, 0);
      K.bubbles(R, s, SCN.plan.spots(s, cfg), 0, 206);
      K.header(R, s, cfg, h.name + ' · 出门'); K.toast(R, s); K.fade(R, s);
    },
  };
  // lobby exit → door choices
  const lobbyAct = SCN.lobby.act;
  SCN.lobby.act = function (st, sp, who, cfg, ev) { if (sp.k === 'go') { if (!st.inn) { K.msg(st, '先去前台办理入住哦'); return; } return K.go(st, 'plan', { x: 240 }, ev); } return lobbyAct.call(this, st, sp, who, cfg, ev); };
  const lobbySpots = SCN.lobby.spots;
  SCN.lobby.spots = function (s, cfg) { return lobbySpots.call(this, s, cfg).map(p => p.id === 'door' ? Object.assign({}, p, { label: '出门 · 今天去哪？' }) : p); };

  // room: TV opens the game channel; the window panel only on panel === 1
  const roomAct = SCN.room.act;
  SCN.room.act = function (st, sp, who, cfg, ev) { if (sp.k === 'tv') { st.tvOn = 1; st.panel = 'tv'; ev('sfx', 'click'); return; } return roomAct.call(this, st, sp, who, cfg, ev); };
  const roomSpots = SCN.room.spots;
  SCN.room.spots = function (s, cfg) { return roomSpots.call(this, s, cfg).map(p => p.id === 'tv' ? Object.assign({}, p, { label: '看电视 · 游戏频道' }) : p); };
  const TVG = [['抢小鱼', 'vs', { only: 'fish' }], ['猫拳擂台', 'vs', { only: 'knock' }], ['躲避扫地机', 'vs', { only: 'vacuum' }], ['对战 · 五局三胜', 'vs', {}]];
  function tvPanel(R, s) {
    const C = R.C, x = 100, y = 26, w = 280; R.panel(x, y, w, 196, { title: '📺 酒店电视 · 游戏频道', tfill: '#5a3a6a' });
    R.text('对战（两只猫一起玩，打完回到房间）', x + 10, y + 18, { c: C.gold });
    TVG.forEach(([n, m, arg], i) => R.btn(x + 10 + (i % 2) * 132, y + 30 + (i / 2 | 0) * 18, 128, 15, n, { k: 'play', m, arg }, { c: '#3a4a6a' }));
    R.text('合作闯关（选一关）', x + 10, y + 72, { c: C.gold });
    for (let i = 0; i < 10; i++) R.btn(x + 10 + i * 26, y + 84, 24, 15, String(i + 1), { k: 'play', m: 'coop', arg: { lv: i } }, { c: '#3a6a5a' });
    R.text('掌机 · 小游戏厅', x + 10, y + 108, { c: C.gold });
    R.btn(x + 10, y + 120, 128, 15, '🎮 连上掌机', { k: 'hubgo', m: 'handheld' }, { c: '#6a4a7a' });
    R.btn(x + 142, y + 120, 128, 15, '🕹 小游戏厅', { k: 'hubgo', m: 'games' }, { c: '#6a4a7a' });
    R.text('城市台：' + (s.city ? '今天' + SC.WEA_NAME[s.wea] + ' · ' + SC.TOD_NAME[K.tod(s)] : ''), x + 10, y + 144, { c: C.dim });
    R.btn(x + 10, y + 172, 80, 15, '关电视', { k: 'tvOff' }); R.btn(x + w - 90, y + 172, 80, 15, '先不看', { k: 'panel' });
  }

  // ---------- departures hub (title of the travel mode) — a walkable terminal ----------
  // The cats walk along the concourse (← → / A D) and press ↑ (W / F / Enter) at a spot:
  // arcade, handheld shop, diary bench, travel TV, world map, then one gate per city.
  const L = { pg: 0 };
  function depTime(i) { const m = 8 * 60 + i * 37; return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  const dests = () => Cities.LIST.filter(c => c.ready && c.board);
  const GATE0 = 300, GATEW = 46;
  // controls hint for every travel scene (local split keys vs. online either set)
  function hint(R, s, extra) {
    const role = window.App && App.role, t = role === 'local' ? 'jsq：A D 走 · W 互动 · S 牵爪 ｜ yyf：← → 走 · ↑ 互动 · ↓ 牵爪' : '← → / A D 走 · ↑ / W 互动 · ↓ 牵爪' + (App && App.isTouch ? ' · 也可以用屏幕方向键' : '');
    const txt = extra ? t + ' · ' + extra : t, w = R.tw(txt) + 8;
    R.rect(2, 262, w, 9, '#000', .45); R.text(txt, 6, 263, { c: '#d8dcf0', sh: false });
  }
  K.hint = hint;
  // shared walking for the city-less scenes (depart / pack): walk + ↑ to use the nearest spot
  function stripStep(st, inputs, ev, S) {
    st.t += DT; if (st.fi > 0) st.fi -= DT; if (st.msg && st.msg[1] > 0) st.msg[1] -= DT;
    const E = K.edges(st, inputs);
    if (st.dmap) { for (let i = 0; i < 2; i++) if (E[i].j || E[i].d || E[i].a) { st.dmap = 0; return; } return; }
    const w = S.w(st); K.walk(st, inputs, 16, w - 16); st.mv = st.mv || [0, 0];
    const spots = S.spots(st);
    for (let i = 0; i < 2; i++) {
      if (E[i].j || (E[i].a && !(inputs[i] || {}).l && !(inputs[i] || {}).r)) { const sp = K.spotNear(spots, st.c[i][0]); if (sp) { S.use(st, sp, i, ev); return; } }
      if (E[i].d && Math.abs(st.c[0][0] - st.c[1][0]) < 40) { st.pw = st.pw ? 0 : 1; K.msg(st, st.pw ? '牵爪散步 ♥' : '松开爪爪'); }
    }
  }
  const camX = (s, w) => clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, Math.max(0, w - 480));
  SCN.depart = {
    w: () => Math.max(480, GATE0 + dests().length * GATEW + 100),
    spots(s) {
      const out = [
        { id: 'games', x: 40, label: '🕹 小游戏厅', go: 'games' }, { id: 'handheld', x: 92, label: '🎮 掌机店', go: 'handheld' },
        { id: 'diary', x: 144, label: '📔 旅行日记', go: 'diary' }, { id: 'tv', x: 196, label: '📺 旅行频道' }, { id: 'map', x: 248, label: '🗺 世界地图' },
      ];
      dests().forEach((c, i) => out.push({ id: 'g:' + c.id, x: GATE0 + i * GATEW, label: 'A' + (3 + i) + ' 去' + c.name, dest: c.id, i }));
      out.push({ id: 'soon', x: GATE0 + dests().length * GATEW + 40, label: '更多目的地 · 敬请期待' });
      return out;
    },
    use(st, sp, who, ev) {
      if (sp.dest) return M.act(st, { k: 'dest', id: sp.dest }, who, ev);
      if (sp.go) return M.act(st, { k: 'hubgo', m: sp.go }, who, ev);
      if (sp.id === 'soon') { K.msg(st, '更多目的地 敬请期待 ✈'); return; }
      if (sp.id === 'map') { st.dmap = 1; ev('sfx', 'click'); return; }
      if (sp.id === 'tv') { const L0 = dests(), c = L0[(st.tvI = ((st.tvI || 0) + 1) % L0.length)]; ev('sfx', 'click'); K.msg(st, '📺 ' + c.name + '：' + (CLIMATE[c.id] || '天气不错，适合一起出门'), 3); }
    },
    draw(R, s) {
      const C = R.C, W = this.w(), ox = camX(s, W), D = dests(), me = s.c[R.who()] || s.c[0], near = K.spotNear(this.spots(s), me[0]);
      R.rect(0, 0, 480, 272, '#1a2236');
      // concourse (scrolls with the cats)
      for (let x = -(ox % 48); x < 480; x += 48) R.rect(x, 0, 2, 200, '#222c44');
      R.rect(0, 150, 480, 46, '#8ab8e0'); R.rect(0, 186, 480, 10, '#6a7a8a');
      const px = ((R.t * 18) % (W + 160)) - 80 - ox; R.rect(px, 176, 50, 7, '#f4f4f8'); R.rect(px + 18, 170, 12, 4, '#f4f4f8'); R.rect(px + 4, 172, 5, 5, '#5aa8c8'); R.rect(px + 46, 177, 4, 3, '#2a3a5a');
      for (let x = -(ox % 60); x < 480; x += 60) R.rect(x, 150, 3, 46, '#3a4458');
      R.rect(0, 196, 480, 76, '#c8ccd4'); for (let x = -(ox % 24); x < 480; x += 24) R.rect(x, 196, 1, 76, '#b0b4bc');
      const X = (x) => x - ox;
      // props
      R.rect(X(30), 204, 20, 37, '#4a3a6a'); R.rect(X(33), 208, 14, 10, '#8fd0f6'); R.rect(X(34), 222, 4, 3, '#f3c55e'); R.rect(X(42), 222, 4, 3, '#e86a5a'); // arcade
      R.rect(X(78), 214, 28, 27, '#5a4a7a'); R.rect(X(80), 206, 24, 9, '#f3c55e'); R.text('GAME', X(92), 207, { al: 'c', c: '#3a2a10', sh: false }); R.rect(X(84), 220, 8, 6, '#2a2a3a'); R.rect(X(94), 220, 8, 6, '#2a2a3a'); // handheld shop
      R.rect(X(130), 228, 28, 5, '#8a5a3a'); R.rect(X(132), 233, 3, 8, '#6a4a2a'); R.rect(X(153), 233, 3, 8, '#6a4a2a'); R.rect(X(140), 222, 8, 6, '#e8d8c0'); // diary bench
      R.rect(X(194), 200, 4, 41, '#5a5a6a'); R.rect(X(180), 200, 32, 20, '#2a2a3a'); R.rect(X(182), 202, 28, 16, (R.t * 2 | 0) % 2 ? '#3a6a9a' : '#4a7aaa'); R.text('TV', X(196), 206, { al: 'c', c: '#fff', sh: false }); // TV
      R.rect(X(234), 204, 28, 22, '#e8e0cc'); R.rect(X(236), 208, 10, 6, '#a8d098'); R.rect(X(248), 214, 10, 6, '#a8d098'); R.rect(X(240), 216, 4, 4, '#8ab8d8'); R.rect(X(247), 226, 2, 15, '#5a5a6a'); // map stand
      D.forEach((c, i) => { const gx = X(GATE0 + i * GATEW); if (gx < -30 || gx > 510) return; const on = near && near.dest === c.id;
        R.rect(gx - 16, 222, 32, 19, on ? '#4a6a9a' : '#3a4a6a'); R.rect(gx - 16, 222, 32, 2, '#8a9ac8');
        R.rect(gx - 18, 152, 36, 22, '#0c0e14'); R.text('A' + (3 + i), gx, 154, { al: 'c', c: '#f3c55e', sh: false }); R.text(c.name, gx, 164, { al: 'c', c: on ? '#fff8d0' : C.paper, sh: false }); });
      // board (fixed overhead, compact: sized to the rows it shows); follows the gate my cat is standing at
      const per = 6, pages = Math.max(1, Math.ceil(D.length / per)); if (near && near.dest) L.pg = near.i / per | 0; const pg = Math.min(L.pg, pages - 1);
      const rows = D.slice(pg * per, pg * per + per), BX = 64, BW = 352, BY = 20, RH = 11, nR = rows.length + 1, BH = 26 + nR * RH + 13;
      R.rect(BX + 40, 0, 2, BY, '#3a4458'); R.rect(BX + BW - 42, 0, 2, BY, '#3a4458'); // hanging rods
      R.rect(BX - 2, BY - 2, BW + 4, BH + 4, '#3a4458'); R.rect(BX, BY, BW, BH, '#0c0e14');
      R.rect(BX + 2, BY + 2, BW - 4, 11, '#f3c55e'); R.text('出发 DEPARTURES', BX + 6, BY + 3, { c: '#0c0e14', sh: false }); R.text('喵喵航空 · 喵喵铁路', BX + BW - 6, BY + 3, { al: 'r', c: '#3a2a10', sh: false });
      const cx = [6, 40, 98, 234, 282].map(v => BX + v);
      [['时间', cx[0]], ['航班/车次', cx[1]], ['目的地', cx[2]], ['登机口', cx[3]], ['状态', cx[4]]].forEach(([t, x]) => R.text(t, x, BY + 15, { c: '#8a90a8', sh: false }));
      rows.forEach((c, j) => {
        const i = pg * per + j, y = BY + 27 + j * RH, a = arr(c.id), pr = Bucket.progress(c.id), flip = (R.t * 2 + i) % 9 < .25, on = near && near.dest === c.id;
        R.hit(BX + 2, y - 1, BW - 4, RH, { k: 'dest', id: c.id });
        if (on) R.rect(BX + 2, y - 1, BW - 4, RH, '#2a3a5a'); else if (j % 2) R.rect(BX + 2, y - 1, BW - 4, RH, '#14171f');
        const yel = flip ? '#fff8d0' : '#f3c55e';
        R.text(depTime(i), cx[0], y, { c: yel, sh: false }); R.text(a[1], cx[1], y, { c: yel, sh: false });
        R.text(c.name + ' ' + c.local, cx[2], y, { c: '#fff3d6', sh: false });
        R.text((a[0] === 'plane' ? '✈ ' : '🚆 ') + 'A' + (3 + i), cx[3], y, { c: C.paper, sh: false });
        R.text(pr && pr[0] ? '心愿 ' + pr[0] + '/' + pr[1] : '登机中', cx[4], y, { c: pr && pr[0] ? C.gold : C.mint, sh: false });
        R.text('▶', BX + BW - 6, y, { al: 'r', c: C.gold, sh: false });
      });
      R.text('—— 更多目的地 · 敬请期待', cx[2], BY + 27 + rows.length * RH, { c: '#5a6078', sh: false });
      const fy = BY + BH - 11; R.rect(BX + 2, fy - 2, BW - 4, 1, '#22283a');
      R.text('走到登机口按 ↑ 出发（也可以直接点航班）', BX + 6, fy, { c: C.dim, sh: false });
      if (pages > 1) { R.btn(BX + BW - 58, fy - 1, 24, 10, '◀', () => { L.pg = (L.pg + pages - 1) % pages; }, { c: '#2a3046' }); R.btn(BX + BW - 30, fy - 1, 24, 10, '▶', () => { L.pg = (L.pg + 1) % pages; }, { c: '#2a3046' }); R.text((pg + 1) + '/' + pages, BX + BW - 62, fy, { al: 'r', c: C.dim, sh: false }); }
      // terminal wall under the board: warm pendant lights + wayfinding sign (scroll with the cats)
      for (let x = -(ox % 96) + 24; x < 480; x += 96) { R.rect(x, BY + BH + 2, 1, 128 - BY - BH, '#3a4458'); R.rect(x - 5, 130, 11, 4, '#4a5468'); R.rect(x - 3, 134, 7, 2, '#ffe0a0'); R.rect(x - 8, 136, 17, 1, '#ffe0a0', .25); }
      { const sx = X(GATE0 - 78); if (sx > -60 && sx < 520) { R.rect(sx - 2, 138, 50, 10, '#f3c55e'); R.text('登机口 A3 →', sx + 23, 139, { al: 'c', c: '#0c0e14', sh: false }); } }
      K.drawCatsWalk(R, s, ox);
      if (!s.dmap) K.bubbles(R, s, this.spots(s), ox, 184);
      R.text('🪙' + (s.coins | 0), 476, 3, { al: 'r', c: C.gold });
      if (s.dmap) (K.worldMap || worldMap)(R, s);
      hint(R, s); R.topBar('喵喵成行 · 出发大厅'); K.toast(R, s);
    },
  };
  SCN.pick.draw = (R, s) => SCN.depart.draw(R, s); // old name kept for older saves / tests
  // rough lon/lat for the world-map pins (pixel map, no real imagery)
  const GEO = { toronto: [-79, 44], waterloo: [-81, 43], tokyo: [140, 36], kyoto: [136, 35], paris: [2, 49], nyc: [-74, 41], boston: [-71, 42], vancouver: [-123, 49], london: [0, 52], seoul: [127, 38], hongkong: [114, 22], rome: [12, 42] };
  function worldMap(R, s) {
    const C = R.C, X = 40, Y = 40, W = 400, Hh = 190, sx = (lo) => X + (lo + 180) / 360 * W, sy = (la) => Y + (75 - la) / 135 * Hh;
    R.rect(0, 0, 480, 272, '#000', .4); R.panel(X - 6, Y - 18, W + 12, Hh + 30, { title: '🗺 世界地图 · 喵喵航线', tfill: '#2a5a7a' }); R.rect(X, Y, W, Hh, '#5a8ab8');
    [[-165, 70, 110, 55], [-80, 12, 45, 68], [-10, 72, 55, 36], [-18, 36, 70, 72], [45, 75, 100, 65], [112, -10, 45, 35]].forEach(([lo, la, w, h]) => R.rect(sx(lo), sy(la), w / 360 * W, h / 135 * Hh, '#a8c898'));
    dests().forEach((c, i) => { const g = GEO[c.id]; if (!g) return; const x = sx(g[0]), y = sy(g[1]); R.rect(x - 2, y - 2, 4, 4, '#e86a5a'); R.text(c.name, x + 3, y - 4 + (i % 2) * 6, { c: '#fff', sh: true }); });
    R.text('按 ↑ / ↓ 关上地图', X + W / 2, Y + Hh - 10, { al: 'c', c: C.cream });
    R.hit(0, 0, 480, 272, { k: 'dmapX' });
  }

  // ---------- packing (walk along the shelf, ↑ to put a thing in / take it out) ----------
  const PK0 = 70, PKW = 40;
  SCN.pack = {
    w: () => 480,
    spots(s) {
      const a = arr(s.dest || ''), out = [{ id: 'back', x: 26, label: '◀ 换目的地' }];
      PACK.forEach(([id, nm, ic], i) => out.push({ id: 'p:' + id, x: PK0 + i * PKW, label: (s.pack && s.pack[id] ? '拿出 ' : '装进 ') + nm, item: id, i }));
      out.push({ id: 'go', x: 440, w: 40, label: a[0] === 'plane' ? '✈ 去机场出发！' : '🚆 去车站出发！' });
      return out;
    },
    use(st, sp, who, ev) {
      if (sp.item) return M.act(st, { k: 'packT', id: sp.item }, who, ev);
      if (sp.id === 'go') return M.act(st, { k: 'depart' }, who, ev);
      if (sp.id === 'back') return M.act(st, { k: 'pickCity' }, who, ev);
    },
    draw(R, s) {
      const C = R.C, c = Cities.LIST.find(x => x.id === s.dest) || {}, a = arr(s.dest || ''), n = Object.keys(s.pack || {}).length, me = s.c[R.who()] || s.c[0], near = K.spotNear(this.spots(s), me[0]);
      R.rect(0, 0, 480, 272, '#2a2236'); for (let y = 0; y < 200; y += 16) for (let x = ((y / 16) % 2) * 16; x < 480; x += 32) R.rect(x, y, 16, 16, '#30283e');
      R.text('收拾行李 🧳  →  ' + (c.name || '') + ' ' + (c.local || ''), 240, 20, { al: 'c', size: 24, c: C.cream });
      R.text((CLIMATE[s.dest] || '看看天气再带东西～') + '  ·  最多带 ' + MAXPACK + ' 样', 240, 40, { al: 'c', c: C.blue });
      // open suitcase (click also works)
      R.rect(60, 52, 360, 118, '#3a4a7a'); R.rect(64, 56, 352, 110, '#e8d8c0'); R.rect(238, 52, 4, 118, '#2a3a5a');
      PACK.forEach(([id, nm, ic, tip], i) => {
        const x = 74 + (i % 4) * 86, y = 59 + (i / 4 | 0) * 54, on = s.pack && s.pack[id], hl = near && near.item === id;
        R.btn(x, y, 80, 50, '', { k: 'packT', id }, { c: on ? (on === 1 ? '#3a4a6a' : '#7a5a3a') : hl ? '#e8d090' : '#c8b8a0' });
        R.text(ic, x + 40, y + 5, { al: 'c', size: 24 }); R.text(nm, x + 40, y + 26, { al: 'c', c: on ? C.cream : '#3a2a2a', sh: !!on });
        R.text(on ? '✓ ' + CAT_NAMES[on - 1] + ' 装的' : tip.slice(0, 9), x + 40, y + 38, { al: 'c', c: on ? C.mint : '#6a5a4a', sh: false });
      });
      // floor + shelf with the things to pack
      R.rect(0, 196, 480, 76, '#4a3a4a'); for (let x = 0; x < 480; x += 32) R.rect(x, 196, 1, 76, '#3e2e3e');
      R.rect(PK0 - 18, 216, PKW * PACK.length, 4, '#8a5a3a');
      PACK.forEach(([id, nm, ic], i) => { const x = PK0 + i * PKW; if (!(s.pack && s.pack[id])) R.text(ic, x, 203, { al: 'c', size: 12 }); else R.text('✓', x, 205, { al: 'c', c: C.mint }); });
      R.rect(4, 206, 44, 35, '#3a3048'); R.text('◀ 大厅', 26, 220, { al: 'c', c: C.paper }); // back door
      R.rect(420, 196, 46, 45, '#3a6a5a'); R.rect(424, 200, 38, 20, '#8ab8e0'); R.text(a[0] === 'plane' ? '✈' : '🚆', 443, 205, { al: 'c' }); // exit to the airport
      R.text('已装 ' + n + '/' + MAXPACK, 70, 174, { c: C.gold });
      R.btn(300, 172, 120, 13, (a[0] === 'plane' ? '✈ 去机场出发！' : '🚆 去车站出发！'), { k: 'depart' }, { c: '#3a6a5a' });
      K.drawCatsWalk(R, s, 0);
      K.bubbles(R, s, this.spots(s), 0, 188);
      hint(R, s); R.topBar('收拾行李'); K.toast(R, s);
    },
  };

  // ---------- hotels (arrivals hall): walk to a hotel desk, ↑ to check in ----------
  SCN.hotels.w = () => 480;
  SCN.hotels.spots = function (s, cfg) {
    const n = Math.min(4, cfg.hotels.length), xs = n <= 2 ? [123, 357] : [60, 170, 290, 400], out = cfg.hotels.slice(0, 4).map((h, i) => ({ id: 'h' + i, x: xs[i], label: '入住 ' + h.name, hi: i }));
    out.push({ id: 'city', x: 456, label: '换个城市' }); return out;
  };
  SCN.hotels.act = function (st, sp, who, cfg, ev) { if (sp.hi != null) return M.act(st, { k: 'hotel', i: sp.hi }, who, ev); if (sp.id === 'city') return M.act(st, { k: 'pickCity' }, who, ev); };
  SCN.hotels.draw = function (R, s, cfg) {
    const C = R.C, me = s.c[R.who()] || s.c[0], near = K.spotNear(this.spots(s, cfg), me[0]);
    R.rect(0, 0, 480, 272, '#1a1f2e');
    SC.drawView(R, 0, 15, 480, 62, K.view(cfg, cfg.areas[0].view), { tod: 'golden', weather: 'clear', t: R.t, pan: .5 + Math.sin(R.t * .05) * .3 });
    R.rect(0, 58, 480, 19, '#1a1f2e', .7); R.text(cfg.name + '  ' + cfg.local, 10, 62, { size: 12, c: C.cream }); R.text(R.clip ? R.clip(cfg.blurb || '', 300) : '', 470, 63, { al: 'r', c: C.paper });
    R.text('选一家酒店住下 · 走到柜台按 ↑', 10, 80, { c: C.gold });
    cfg.hotels.slice(0, 4).forEach((h, i) => {
      const x = 10 + (i % 2) * 234, y = 92 + (i / 2 | 0) * 50, hl = near && near.hi === i;
      R.btn(x, y, 226, 46, '', { k: 'hotel', i }, { c: hl ? '#3e5276' : '#2e3a52' });
      R.text((hl ? '▶ ' : '') + h.name, x + 6, y + 4, { c: C.cream }); R.text(h.local || '', x + 220, y + 4, { al: 'r', c: C.dim });
      const a = cfg.areas.find(a => a.id === h.area); R.text((a ? a.name : '') + ' · ' + (h.roomName || h.room) + ' · ' + ({ double: '双猫床', futon: '榻榻米被褥', capsule: '情侣胶囊', seat: '座位' }[h.bed] || '双猫床'), x + 6, y + 16, { c: C.blue });
      R.wrap(h.desc || '', x + 6, y + 27, 214, { c: C.dim, lh: 7 });
    });
    // arrivals hall floor with one desk per hotel
    R.rect(0, 196, 480, 76, '#c8c4bc'); for (let x = 0; x < 480; x += 24) R.rect(x, 196, 1, 76, '#b4b0a8');
    this.spots(s, cfg).forEach(sp => { const hl = near && near.id === sp.id;
      if (sp.hi != null) { R.rect(sp.x - 18, 220, 36, 21, hl ? '#6a5a8a' : '#4a3a5a'); R.rect(sp.x - 18, 220, 36, 2, '#e8d8c0'); R.rect(sp.x - 2, 215, 4, 5, C.gold); R.text(String(sp.hi + 1), sp.x, 228, { al: 'c', c: C.cream, sh: false }); }
      else { R.rect(sp.x - 14, 206, 28, 35, '#3a4a6a'); R.text('✈', sp.x, 214, { al: 'c' }); } });
    K.drawCatsWalk(R, s, 0); K.bubbles(R, s, this.spots(s, cfg), 0, 184);
    hint(R, s); R.topBar(cfg.name + ' · 到达大厅'); K.toast(R, s);
  };
  // map: ← → choose a district, ↑ go there, ↓ close (back to where we were)
  SCN.map.step = function (st, inp, cfg, ev, E) {
    const n = cfg.areas.length; if (st.mapI == null) st.mapI = Math.max(0, cfg.areas.findIndex(a => a.id === st.area));
    for (let i = 0; i < 2; i++) {
      if (E[i].l) st.mapI = (st.mapI + n - 1) % n; if (E[i].r) st.mapI = (st.mapI + 1) % n;
      if (E[i].j || E[i].a) { const id = cfg.areas[st.mapI].id; st.mapI = null; return M.act(st, { k: 'goArea', id }, i, ev); }
      if (E[i].d) { const b = st.arg && st.arg.back, x = st.c[0][0] + 9; st.mapI = null; if (b === 'lobby' || b === 'hall' || b === 'room') return K.go(st, b, { x }, ev); return K.go(st, 'street', { area: st.area, x }, ev); }
    }
  };
  const C0 = { gold: '#f3c55e' };

  // ---------- the journey (plane / train window) ----------
  const TRIP_T = 7;
  SCN.journey = {
    step(st, inp, cfg, ev, E) { st.jt = (st.jt || 0) + DT; if (st.jt > TRIP_T || ((E[0].j || E[1].j) && st.jt > 1)) arrive(st, ev); },
    draw(R, s, cfg) {
      const C = R.C, a = arr(s.city), plane = a[0] === 'plane', p = clamp((s.jt || 0) / TRIP_T, 0, 1);
      R.rect(0, 0, 480, 272, plane ? '#d8d4cc' : '#5a6a7a');
      for (let w = 0; w < 2; w++) {
        const wx = 70 + w * 200, wy = 50, ww = plane ? 120 : 170, wh = plane ? 110 : 90;
        if (plane) { // sky + clouds + wing
          R.rect(wx, wy, ww, wh, '#6ab0f0'); R.rect(wx, wy + wh * .6, ww, wh * .4, '#8ac8f4');
          for (let k = 0; k < 6; k++) { const cx = wx + ((H(k, w) * ww - R.t * (20 + k * 6)) % ww + ww) % ww, cy = wy + 20 + H(k, 9) * 70; R.rect(cx - 12, cy, 24, 6, '#ffffff', .9); R.rect(cx - 6, cy - 4, 14, 5, '#ffffff', .9); }
          if (w === 1) { R.rect(wx + 10, wy + 80, 110, 8, '#c8ccd4'); R.rect(wx + 90, wy + 72, 12, 10, '#a8acb4'); }
          R.rect(wx - 4, wy - 4, ww + 8, 4, '#b8b4ac'); R.rect(wx - 4, wy + wh, ww + 8, 4, '#b8b4ac'); R.rect(wx - 4, wy, 4, wh, '#b8b4ac'); R.rect(wx + ww, wy, 4, wh, '#b8b4ac');
        } else { SC.drawView(R, wx, wy, ww, wh, K.view(cfg, cfg.areas[0].view), { tod: K.tod(s), weather: s.wea, t: R.t, pan: (R.t * .15 + w * .5) % 1 }); R.rect(wx - 3, wy - 3, ww + 6, 3, '#2a3040'); R.rect(wx - 3, wy + wh, ww + 6, 3, '#2a3040'); }
      }
      // seats + cats
      R.rect(0, 180, 480, 92, plane ? '#4a5a7a' : '#3a4a5a'); for (let x = 40; x < 480; x += 120) { R.rect(x, 170, 70, 40, plane ? '#2a3a6a' : '#7a2a34'); R.rect(x + 4, 166, 62, 6, mix(plane ? '#2a3a6a' : '#7a2a34', '#fff', .2)); }
      const lean = (s.jt || 0) > 3;
      R.pair(s, [{ x: 212, y: 204, pose: lean ? 'sitDoze' : 'sit', flip: false }, { x: 250, y: 204, pose: lean ? 'sitDoze' : 'sitBlink', flip: true }]);
      if (lean && Math.random() < .03) R.spark(230, 180, 'heart');
      if (s.pack && s.pack.snacks && (s.jt || 0) > 1.5 && (s.jt || 0) < 3) R.text('🐟 分小鱼干吃～', 230, 160, { al: 'c', c: C.cream });
      // progress
      R.panel(90, 226, 300, 34, { fill: '#1a1f2e', shadow: false });
      R.text(a[1] + ' → ' + cfg.name + ' ' + a[2] + ' · ' + a[3], 240, 230, { al: 'c', c: C.cream });
      R.rect(100, 246, 280, 4, '#3a4058'); R.rect(100, 246, 280 * p, 4, C.gold); R.text(plane ? '✈' : '🚆', 100 + 280 * p, 240, { al: 'c' });
      R.text('按 ↑ / 点这里 跳过', 240, 262, { al: 'c', c: C.dim }); R.hit(90, 226, 300, 44, { k: 'jskip' });
      R.topBar(plane ? '飞行中…' : '列车行驶中…');
    },
  };
  function arrive(st, ev) {
    const cfg = K.city(st), a = arr(st.city); st.jt = 0; st.sc = 'hotels'; st.fi = .45; st.pw = 0; st.c[0][0] = 230; st.c[1][0] = 250; st.c[0][1] = st.c[1][1] = FLOOR;
    tick(st, 'arrive', ev); ev('diary', 'arrive', { c: cfg.name, by: a[0] }); ev('sfx', 'chimeS');
    K.msg(st, '抵达 ' + a[3] + '！选一家酒店住下吧', 3);
  }

  // ---------- evening: "天黑啦，回酒店吗？" ----------
  const OUT = ['street', 'station', 'map', 'shop'];
  function evePanel(R, s) {
    const C = R.C; R.rect(0, 0, 480, 272, '#000', .35); R.panel(130, 80, 220, 96, { title: '🌙 天黑啦', tfill: '#3a3a6a' });
    R.text('今天玩得开心吗？回酒店窝着说晚安吧', 240, 102, { al: 'c', c: C.cream });
    R.text('（明天会有新的门可以选）', 240, 116, { al: 'c', c: C.dim });
    R.btn(146, 140, 90, 18, '🚕 回酒店房间', { k: 'eve', v: 'home' }, { c: '#3a6a5a' }); R.btn(244, 140, 90, 18, '再逛一会儿', { k: 'eve', v: 'stay' });
  }

  // ---------- wrap the travel mode ----------
  const create0 = M.create, act0 = M.act, step0 = M.step, draw0 = M.draw, snap0 = M.snap, onEvent0 = M.onEvent, pad0 = M.pad, music0 = M.music;
  M.create = function (arg, ev) { const st = create0.call(this, arg, ev); if (st.sc === 'pick') st.sc = 'depart'; st.pack = {}; st.bk = {}; st.eve = 0; st.eveDay = 0; st.jt = 0; return st; };
  M.music = function (s) { if (s.sc === 'depart' || s.sc === 'pack' || s.sc === 'journey') return 'travel'; return music0.call(this, s); };
  M.pad = function (s) { return ['plan', 'depart', 'pick', 'pack', 'hotels', 'map'].includes(s.sc) || pad0.call(this, s); };
  M.act = function (st, a, who, ev) {
    switch (a.k) {
      case 'dest': {
        const e = Cities.LIST.find(c => c.id === a.id); if (!e || !e.ready) return;
        st.dest = a.id; st.sc = 'pack'; st.pack = st.pack || {}; st.dmap = 0; st.pw = 0; st.c[0][0] = 230; st.c[1][0] = 250; ev('sfx', 'click'); Cities.load(a.id).catch(() => {}); return;
      }
      case 'packT': { st.pack = st.pack || {}; if (st.pack[a.id]) delete st.pack[a.id]; else if (Object.keys(st.pack).length < MAXPACK) st.pack[a.id] = (who === 1 ? 1 : 0) + 1; else K.msg(st, '箱子装不下啦～'); ev('sfx', 'click'); return; }
      case 'depart': {
        const id = st.dest; if (!id) return;
        const go = () => { st.city = id; st.hotel = null; st.inn = 0; st.day = 1; st.clock = 10; st.eveDay = 0; st.eve = 0; st.bk = Object.assign({}, Bucket.of(id)); Object.keys(st.bk).forEach(k => { st.bk[k] = 1; }); st.sc = 'journey'; st.jt = 0; st.fi = .45; ev('place', Cities.get(id).name, id); ev('diary', 'pack', { items: Object.keys(st.pack).join(',') }); };
        if (Cities.get(id)) go(); else { st.sc = 'wait'; st.city = id; Cities.load(id).then(go).catch(() => { st.sc = 'depart'; K.msg(st, '这班还在筹备中'); }); }
        return;
      }
      case 'jskip': if (st.sc === 'journey' && st.jt > .5) arrive(st, ev); return;
      case 'pickCity': { const back = st.dest && dests().findIndex(c => c.id === st.dest); st.sc = 'depart'; st.city = null; st.dest = null; st.dmap = 0; st.pw = 0; const x = back >= 0 ? GATE0 + back * GATEW : 200; st.c[0][0] = x - 10; st.c[1][0] = x + 10; st.c[0][1] = st.c[1][1] = FLOOR; return; }
      case 'dmapX': st.dmap = 0; return;
      case 'spot': { const S = SCN[st.sc]; if (!S || !S.use) break; const sp = S.spots(st).find(p => p.id === a.id), ci = who === 1 ? 1 : 0; if (sp && Math.abs(sp.x - st.c[ci][0]) <= 30) S.use(st, sp, ci, ev); return; }
      case 'hubgo': st._sw = { k: 'switch', m: a.m, arg: { from: 'travel', place: st.city ? K.city(st).name : '' }, back: true }; return;
      case 'tvOff': st.tvOn = 0; st.panel = 0; return;
      case 'eve': { st.eve = 0; if (a.v === 'home') { const cfg = K.city(st); if (st.hotel == null) return; ev('sfx', 'honk'); st.area = K.hotel(st, cfg).area; K.go(st, 'room', { x: 300 }, ev); K.msg(st, '回到房间啦 · 去床上按 ↓ 一起窝着，再说晚安', 3.5); } return; }
      case 'door': { const cfg = K.city(st); if (st.sc === 'plan' && cfg) SCN.plan.act(st, { k: 'door', i: a.i }, who, cfg, ev); return; }
    }
    return act0.call(this, st, a, who, ev);
  };
  M.step = function (st, inputs, ev) {
    if (st.sc === 'journey') { st.t += DT; if (st.fi > 0) st.fi -= DT; if (st.msg && st.msg[1] > 0) st.msg[1] -= DT; const E = K.edges(st, inputs); SCN.journey.step(st, inputs, K.city(st), ev, E); return; }
    if (st.sc === 'pick') st.sc = 'depart';
    if (st.sc === 'depart' || st.sc === 'pack') return stripStep(st, inputs, ev, SCN[st.sc]);
    if (st.eve) { st.t += DT; const E = K.edges(st, inputs); if (E[0].j || E[1].j) M.act(st, { k: 'eve', v: 'home' }, 0, ev); else if (E[0].d || E[1].d) st.eve = 0; return; }
    const day = st.day, sc = st.sc;
    step0.call(this, st, inputs, ev);
    const cfg = K.city(st); if (!cfg) return;
    // bucket list ticks
    if (st.inn) tick(st, 'checkin', ev);
    if (st.sc === 'street' && st.area) tick(st, 'a:' + st.area, ev);
    if (st.sc === 'ride' && st.ride && st.ride.p > 0.05) tick(st, 'l:' + st.ride.line, ev);
    if (st.sc === 'act' && st.act && st.act.ph === 'end') { tick(st, 'act:' + st.act.id, ev); if (st.pack && st.pack.camera && !st.act.cam && (cfg.acts.find(a => a.id === st.act.id) || {}).kind === 'photo') { st.act.cam = 1; K.coins(2, st, ev); K.msg(st, '📷 带了相机：多拍几张 +2'); } }
    if (st.day !== day) { tick(st, 'gn', ev); st.eve = 0; st.dseed = (st.dseed || 0) + 1; K.msg(st, '第 ' + st.day + ' 天 · 早安 ☀ 下楼出门，选今天的门 🚪', 3.5); if (st.pack && st.pack.pajamas) ev('spark', 240, 150, 'heart', 6); }
    if (sc !== st.sc && st.sc === 'street') { // entering a street: weather + packing remarks
      if ((st.wea === 'rain' || st.wea === 'storm') && st.pack) K.msg(st, st.pack.umbrella ? '☂ 撑起雨伞，一起挤在伞下' : '忘带伞了…去便利店躲躲雨吧', 2.6);
      else if (st.wea === 'snow' && st.pack && st.pack.scarf) K.msg(st, '🧣 围好围巾，雪好漂亮', 2.4);
    }
    if (sc !== st.sc && st.sc === 'room' && st.day > 1 && !st.cud) { /* back home */ }
    // route finished → tick it
    if (sc === 'ride' && st.sc !== 'ride' && st.routeI != null && st.msg && /✓/.test(st.msg[0])) tick(st, 'r:' + st.routeI, ev);
    // evening prompt once a day when outside after 20:30
    if (OUT.includes(st.sc) && st.hotel != null && st.clock >= 20.5 && st.clock < 23.9 && st.eveDay !== st.day && !st.cud && !st.prompt) { st.eveDay = st.day; st.eve = 1; ev('sfx', 'chimeS'); }
  };
  M.snap = function (st) { const o = snap0.call(this, st); Object.assign(o, { dmap: st.dmap, mapI: st.mapI, pack: st.pack, bl: st.bk, eve: st.eve, jt: Math.round((st.jt || 0) * 20) / 20, dest: st.dest, dseed: st.dseed }); return o; };
  M.onEvent = function (R, e, s) {
    if (e[0] === 'bucket') { if (Bucket.mark(e[1], e[2])) GameUI.banner('✓ 心愿清单：' + e[3], 1800); }
    return onEvent0.call(this, R, e, s);
  };
  M.draw = function (R, s, dt) {
    if (s.sc === 'depart' || s.sc === 'pick') return SCN.depart.draw(R, s);
    if (s.sc === 'pack') return SCN.pack.draw(R, s);
    const cfg = K.city(s);
    if (s.sc === 'journey' && cfg) return SCN.journey.draw(R, s, cfg);
    draw0.call(this, R, s, dt);
    if (['street', 'lobby', 'hall', 'room', 'entry', 'bath', 'balcony', 'shop', 'station', 'ride', 'plan'].includes(s.sc) && !s.panel && !s.prompt && !s.eve) hint(R, s, s.sc === 'ride' ? '停站时走到车门按 ↑ 下车' : s.sc === 'street' ? 'Shift/F 跑' : '');
    if (s.sc === 'room' && s.pack && s.pack.handheld && !s.panel && !s.cud) R.btn(372, 252, 50, 16, '🎮 掌机', { k: 'hubgo', m: 'handheld' }, { c: '#5a4a7a' });
    if (s.sc === 'room' && s.panel === 'tv') tvPanel(R, s);
    if (s.eve) evePanel(R, s);
  };
  M.resume = (function (r0) { return function (st, ev, res) { r0.call(this, st, ev, res); if (res && res.from === 'game') K.msg(st, '回到房间啦 · 电视还开着'); }; })(M.resume);
  [{ id: 'trip1', name: '第一次出发 ✈', need: d => (d.n.arrive || 0) >= 1 }, { id: 'trip3', name: '旅行过 3 次', need: d => (d.n.arrive || 0) >= 3 }, { id: 'door10', name: '推开 10 扇门', need: d => (d.n.door || 0) >= 10 }, { id: 'night7', name: '一周的晚安', need: d => (d.n.goodnight || 0) >= 7 }]
    .forEach(a => { if (!Diary.ACH.some(x => x.id === a.id)) Diary.ACH.push(a); });
  K.Bucket = Bucket; K.doors = doors; K.PACK = PACK; K.arr = arr;
})();
