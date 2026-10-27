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
    const act = pick(cfg.acts || [], a => !b['act:' + a.id]); if (act) out.push({ k: 'act', id: act.id, area: act.area, x: act.x, t: '活动', n: act.name, c: '#c8566a' });
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

  // ---------- departures hub (title of the travel mode) ----------
  const L = { pg: 0 };
  function depTime(i) { const m = 8 * 60 + i * 37; return String(Math.floor(m / 60) % 24).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); }
  SCN.depart = {
    draw(R, s) {
      const C = R.C; R.rect(0, 0, 480, 272, '#1a2236');
      for (let x = 0; x < 480; x += 48) { R.rect(x, 0, 2, 200, '#222c44'); }
      R.rect(0, 196, 480, 76, '#c8ccd4'); for (let x = 0; x < 480; x += 24) R.rect(x, 196, 1, 76, '#b0b4bc');
      for (let x = 20; x < 480; x += 120) { R.rect(x, 216, 70, 2, '#a0a4ac'); }
      // big windows with a plane taxiing
      R.rect(0, 150, 480, 46, '#8ab8e0'); R.rect(0, 186, 480, 10, '#6a7a8a'); const px = ((R.t * 18) % 640) - 80; R.rect(px, 176, 50, 7, '#f4f4f8'); R.rect(px + 18, 170, 12, 4, '#f4f4f8'); R.rect(px + 4, 172, 5, 5, '#ff8fb8'); R.rect(px + 46, 177, 4, 3, '#2a3a5a');
      for (let x = 0; x < 480; x += 60) R.rect(x, 150, 3, 46, '#3a4458');
      // board
      R.rect(10, 18, 460, 128, '#0c0e14'); R.rect(12, 20, 456, 12, '#f3c55e'); R.text('出发 DEPARTURES', 18, 22, { c: '#0c0e14', sh: false }); R.text('喵喵航空 · 喵喵铁路', 462, 22, { al: 'r', c: '#3a2a10', sh: false });
      [['时间', 18], ['航班/车次', 62], ['目的地', 138], ['登机口', 314], ['状态', 368]].forEach(([t, x]) => R.text(t, x, 34, { c: '#8a90a8', sh: false }));
      const LIST = Cities.LIST, per = 7, pages = Math.ceil(LIST.length / per), pg = Math.min(L.pg, pages - 1);
      LIST.slice(pg * per, pg * per + per).forEach((c, j) => {
        const i = pg * per + j, y = 47 + j * 12, ready = c.ready, a = arr(c.id), pr = Bucket.progress(c.id), flip = (R.t * 2 + i) % 9 < .25;
        if (ready) R.hit(12, y - 1, 456, 12, { k: 'dest', id: c.id });
        if (j % 2) R.rect(12, y - 1, 456, 12, '#14171f');
        const yel = flip ? '#fff8d0' : '#f3c55e';
        R.text(depTime(i), 18, y, { c: yel, sh: false }); R.text(a[1], 62, y, { c: yel, sh: false });
        R.text(c.name + ' ' + c.local, 138, y, { c: ready ? '#fff3d6' : '#6a7390', sh: false });
        R.text((a[0] === 'plane' ? '✈ ' : '🚆 ') + (ready ? 'A' + (3 + i) : '--'), 314, y, { c: ready ? C.paper : '#6a7390', sh: false });
        R.text(ready ? (pr && pr[0] ? '心愿 ' + pr[0] + '/' + pr[1] : '登机中') : '筹备中', 368, y, { c: ready ? (pr && pr[0] ? C.pink : C.mint) : '#6a7390', sh: false });
        if (ready) R.text('▶', 460, y, { al: 'r', c: C.gold, sh: false });
      });
      if (pages > 1) { R.btn(380, 132, 40, 11, '◀', () => { L.pg = (L.pg + pages - 1) % pages; }, { c: '#2a3046' }); R.btn(424, 132, 40, 11, '▶', () => { L.pg = (L.pg + 1) % pages; }, { c: '#2a3046' }); R.text((pg + 1) + '/' + pages, 374, 134, { al: 'r', c: C.dim, sh: false }); }
      R.text('点一班出发 → 收拾行李 → 出发！', 18, 134, { c: C.dim, sh: false });
      // cats with suitcases
      const bob = Math.sin(R.t * 2) > 0 ? 1 : 0;
      R.rect(178, 226 - bob, 14, 16, '#c86a7a'); R.rect(181, 222 - bob, 8, 2, '#3a2a2a'); R.rect(288, 226, 14, 16, '#5a8ac8'); R.rect(291, 222, 8, 2, '#3a2a2a');
      R.pair(s, [{ x: 210, y: 242, pose: 'idle' + ((R.t | 0) % 2), flip: false }, { x: 270, y: 242, pose: 'idle' + ((R.t + 1 | 0) % 2), flip: true }]);
      R.btn(10, 252, 76, 16, '🕹 小游戏厅', { k: 'hubgo', m: 'games' }, { c: '#4a3a6a' });
      R.btn(90, 252, 66, 16, '🎮 掌机', { k: 'hubgo', m: 'handheld' }, { c: '#4a3a6a' });
      R.btn(324, 252, 76, 16, '📔 旅行日记', { k: 'hubgo', m: 'diary' }, { c: '#4a3a6a' });
      R.text('🪙' + (s.coins | 0), 470, 256, { al: 'r', c: C.gold });
      R.topBar('喵喵成行 · 出发大厅');
    },
  };
  SCN.pick.draw = SCN.depart.draw; // old name kept for older saves / tests

  // ---------- packing ----------
  SCN.pack = {
    draw(R, s) {
      const C = R.C, c = Cities.LIST.find(x => x.id === s.dest) || {}, a = arr(s.dest || ''), n = Object.keys(s.pack || {}).length;
      R.rect(0, 0, 480, 272, '#2a2236'); for (let y = 0; y < 272; y += 16) for (let x = ((y / 16) % 2) * 16; x < 480; x += 32) R.rect(x, y, 16, 16, '#30283e');
      R.text('收拾行李 🧳  →  ' + (c.name || '') + ' ' + (c.local || ''), 240, 22, { al: 'c', size: 24, c: C.cream });
      R.text((CLIMATE[s.dest] || '看看天气再带东西～') + '  ·  最多带 ' + MAXPACK + ' 样', 240, 42, { al: 'c', c: C.blue });
      // open suitcase
      R.rect(60, 60, 360, 150, '#7a3a4a'); R.rect(64, 64, 352, 142, '#e8d8c0'); R.rect(238, 60, 4, 150, '#5a2a3a');
      PACK.forEach(([id, nm, ic, tip], i) => {
        const x = 74 + (i % 4) * 86, y = 72 + (i / 4 | 0) * 66, on = s.pack && s.pack[id];
        R.btn(x, y, 80, 58, '', { k: 'packT', id }, { c: on ? (on === 1 ? '#4a3a6a' : '#8a5a6a') : '#c8b8a0' });
        R.text(ic, x + 40, y + 6, { al: 'c', size: 24 }); R.text(nm, x + 40, y + 30, { al: 'c', c: on ? C.cream : '#3a2a2a', sh: !!on });
        R.text(on ? '✓ ' + CAT_NAMES[on - 1] + ' 装的' : tip.slice(0, 9), x + 40, y + 43, { al: 'c', c: on ? C.mint : '#6a5a4a', sh: false });
      });
      R.text('已装 ' + n + '/' + MAXPACK, 70, 216, { c: C.gold });
      R.btn(300, 236, 120, 22, (a[0] === 'plane' ? '✈ 去机场出发！' : '🚆 去车站出发！'), { k: 'depart' }, { c: '#3a6a5a' });
      R.btn(60, 240, 80, 16, '◀ 换目的地', { k: 'pickCity' });
      R.pair(s, [{ x: 200, y: 258, pose: 'happy' + 0, flip: false }, { x: 260, y: 258, pose: 'idle0', flip: true }].map((o, i) => Object.assign(o, { pose: i ? 'idle' + ((R.t | 0) % 2) : 'idle' + ((R.t + 1 | 0) % 2) })));
      R.topBar('收拾行李'); K.toast(R, s);
    },
  };

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
      R.pair(s, [{ x: 212, y: 204, pose: lean ? 'sleep0' : 'loaf', flip: false }, { x: 250, y: 204, pose: lean ? 'sleep1' : 'loaf', flip: true }]);
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
    const cfg = K.city(st), a = arr(st.city); st.jt = 0; st.sc = 'hotels'; st.fi = .45;
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
  M.pad = function (s) { return s.sc === 'plan' || pad0.call(this, s); };
  M.act = function (st, a, who, ev) {
    switch (a.k) {
      case 'dest': {
        const e = Cities.LIST.find(c => c.id === a.id); if (!e || !e.ready) return;
        st.dest = a.id; st.sc = 'pack'; st.pack = st.pack || {}; ev('sfx', 'click'); Cities.load(a.id).catch(() => {}); return;
      }
      case 'packT': { st.pack = st.pack || {}; if (st.pack[a.id]) delete st.pack[a.id]; else if (Object.keys(st.pack).length < MAXPACK) st.pack[a.id] = (who === 1 ? 1 : 0) + 1; else K.msg(st, '箱子装不下啦～'); ev('sfx', 'click'); return; }
      case 'depart': {
        const id = st.dest; if (!id) return;
        const go = () => { st.city = id; st.hotel = null; st.inn = 0; st.day = 1; st.clock = 10; st.eveDay = 0; st.eve = 0; st.bk = Object.assign({}, Bucket.of(id)); Object.keys(st.bk).forEach(k => { st.bk[k] = 1; }); st.sc = 'journey'; st.jt = 0; st.fi = .45; ev('place', Cities.get(id).name, id); ev('diary', 'pack', { items: Object.keys(st.pack).join(',') }); };
        if (Cities.get(id)) go(); else { st.sc = 'wait'; st.city = id; Cities.load(id).then(go).catch(() => { st.sc = 'depart'; K.msg(st, '这班还在筹备中'); }); }
        return;
      }
      case 'jskip': if (st.sc === 'journey' && st.jt > .5) arrive(st, ev); return;
      case 'pickCity': st.sc = 'depart'; st.city = null; st.dest = null; return;
      case 'hubgo': st._sw = { k: 'switch', m: a.m, arg: { from: 'travel', place: st.city ? K.city(st).name : '' }, back: true }; return;
      case 'tvOff': st.tvOn = 0; st.panel = 0; return;
      case 'eve': { st.eve = 0; if (a.v === 'home') { const cfg = K.city(st); if (st.hotel == null) return; ev('sfx', 'honk'); st.area = K.hotel(st, cfg).area; K.go(st, 'room', { x: 300 }, ev); K.msg(st, '回到房间啦 · 去床上按 ↓ 一起窝着，再说晚安', 3.5); } return; }
      case 'door': { const cfg = K.city(st); if (st.sc === 'plan' && cfg) SCN.plan.act(st, { k: 'door', i: a.i }, who, cfg, ev); return; }
    }
    return act0.call(this, st, a, who, ev);
  };
  M.step = function (st, inputs, ev) {
    if (st.sc === 'journey') { st.t += DT; if (st.fi > 0) st.fi -= DT; if (st.msg && st.msg[1] > 0) st.msg[1] -= DT; const E = K.edges(st, inputs); SCN.journey.step(st, inputs, K.city(st), ev, E); return; }
    if (st.sc === 'depart' || st.sc === 'pack') { st.t += DT; if (st.msg && st.msg[1] > 0) st.msg[1] -= DT; return; }
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
  M.snap = function (st) { const o = snap0.call(this, st); Object.assign(o, { pack: st.pack, bl: st.bk, eve: st.eve, jt: Math.round((st.jt || 0) * 20) / 20, dest: st.dest, dseed: st.dseed }); return o; };
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
    if (s.sc === 'room' && s.pack && s.pack.handheld && !s.panel && !s.cud) R.btn(372, 252, 50, 16, '🎮 掌机', { k: 'hubgo', m: 'handheld' }, { c: '#5a4a7a' });
    if (s.sc === 'room' && s.panel === 'tv') tvPanel(R, s);
    if (s.eve) evePanel(R, s);
  };
  M.resume = (function (r0) { return function (st, ev, res) { r0.call(this, st, ev, res); if (res && res.from === 'game') K.msg(st, '回到房间啦 · 电视还开着'); }; })(M.resume);
  [{ id: 'trip1', name: '第一次出发 ✈', need: d => (d.n.arrive || 0) >= 1 }, { id: 'trip3', name: '旅行过 3 次', need: d => (d.n.arrive || 0) >= 3 }, { id: 'door10', name: '推开 10 扇门', need: d => (d.n.door || 0) >= 10 }, { id: 'night7', name: '一周的晚安', need: d => (d.n.goodnight || 0) >= 7 }]
    .forEach(a => { if (!Diary.ACH.some(x => x.id === a.id)) Diary.ACH.push(a); });
  K.Bucket = Bucket; K.doors = doors; K.PACK = PACK; K.arr = arr;
})();
