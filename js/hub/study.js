// ============================================================
//  一起自习室 — shared Pomodoro study room.
//  Synced (host-authoritative): timer, presets, goals, todos, rain/night.
//  Per device (localStorage 'mmcx-study'): streak, minutes, week chart,
//  unlocks; ambience sliders ('mmcx-amb'); DND.
// ============================================================
(function () {
  const DT = 1 / 60;
  const PRESETS = [[25, 5], [50, 10], [90, 15]];
  const UNLOCKS = [[30, '小仙人掌', 'cactus'], [90, '猫咪马克杯', 'mug'], [180, '暖光台灯', 'lamp'], [300, '小鱼缸', 'tank'], [600, '星星灯串', 'lights'], [1000, '金色书架', 'gold']];
  const TICK = [['喵指数', 3120.5], ['FISH', 42.1], ['YARN', 8.73], ['TUNA', 117.2], ['MEOW', 66.6], ['NAP', 12.4], ['CATNIP', 3.05], ['PAW', 250.9]];
  const BOOKS = ['CFA一级', '估值', '会计', '期权', '固收', '金融学', '公司理财', '计量', 'Excel', '面试'];
  const DEFAULT_VIEW = { id: 'home', horizon: .7, skyline: { hMax: 64, seed: 5, center: .45 }, landmarks: [{ k: 'clocktower', x: .3 }], movers: [{ k: 'tram', y: 2, color: '#e8e4f0', stripe: '#b8704a', speed: 30, period: 24 }, { k: 'birds', n: 4 }] };

  // ---------------- per-device stats ----------------
  const day = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const Stats = {
    load() { try { return Object.assign({ total: 0, days: {}, streak: 0, last: '', pomos: 0 }, JSON.parse(localStorage.getItem('mmcx-study') || '{}')); } catch (e) { return { total: 0, days: {}, streak: 0, last: '', pomos: 0 }; } },
    save(s) { try { localStorage.setItem('mmcx-study', JSON.stringify(s)); } catch (e) {} },
    add(min, now = new Date()) {
      const s = Stats.load(), d = day(now); s.total += min; s.days[d] = (s.days[d] || 0) + min; s.pomos++;
      if (s.last !== d) { const y = new Date(now); y.setDate(y.getDate() - 1); s.streak = s.last === day(y) ? s.streak + 1 : 1; s.last = d; }
      const before = UNLOCKS.filter(u => s.total - min >= u[0]).length, after = UNLOCKS.filter(u => s.total >= u[0]);
      Stats.save(s); return { s, newUnlock: after.length > before ? after[after.length - 1] : null };
    },
    week(now = new Date()) { const s = Stats.load(), out = []; for (let i = 6; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); out.push([['日', '一', '二', '三', '四', '五', '六'][d.getDay()], s.days[day(d)] || 0]); } return out; },
    has(id) { const s = Stats.load(); const u = UNLOCKS.find(u => u[2] === id); return u && s.total >= u[0]; },
  };

  // ---------------- local UI state ----------------
  const L = { panel: null, dnd: false, amb: (() => { try { return Object.assign({ rain: 0.4, cafe: 0, keys: 0.2, pages: 0.1 }, JSON.parse(localStorage.getItem('mmcx-amb') || '{}')); } catch (e) { return { rain: 0.4, cafe: 0, keys: 0.2, pages: 0.1 }; } })(), ambOn: false };
  function applyAmb(s) { const a = Object.assign({}, L.amb); if (!s.rain) a.rain = a.rain * 0.25; if (s.tm.ph !== 'focus' || !s.tm.run) { a.keys = 0; a.pages = 0; } Sfx.ambience && Sfx.ambience(a); }

  const fmt = (sec) => { sec = Math.max(0, Math.ceil(sec)); return String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0'); };

  const M = {
    music: () => 'study',
    create(arg) {
      return { sc: 'study', place: arg.place || '我们的小屋', view: arg.view || DEFAULT_VIEW, room: arg.room || 'study',
        tm: { pre: [25, 5], ph: 'idle', left: 25 * 60, run: false, n: 0, studied: 0 }, goals: ['', ''], todo: [], rain: arg.rain ?? true, night: arg.night ?? (new Date().getHours() >= 19 || new Date().getHours() < 6), t: 0, c: [[200, 172], [282, 172]], poke: [0, 0] };
    },
    act(st, a, who, ev) {
      const tm = st.tm;
      switch (a.k) {
        case 'preset': if (a.f >= 1 && a.f <= 180 && a.b >= 1 && a.b <= 60) { tm.pre = [a.f | 0, a.b | 0]; tm.ph = 'idle'; tm.run = false; tm.left = tm.pre[0] * 60; tm.studied = 0; ev('sfx', 'click'); } break;
        case 'start': if (tm.ph === 'idle') { tm.ph = 'focus'; tm.left = tm.pre[0] * 60; tm.studied = 0; } tm.run = true; ev('focus', who); break;
        case 'pause': tm.run = false; ev('pause', who); break;
        case 'reset': tm.ph = 'idle'; tm.run = false; tm.left = tm.pre[0] * 60; tm.studied = 0; break;
        case 'skip': if (tm.ph === 'break') { tm.ph = 'focus'; tm.left = tm.pre[0] * 60; tm.studied = 0; tm.run = true; ev('focus', who); } break;
        case 'goal': if (who === 0 || who === 1) st.goals[who] = String(a.text || '').slice(0, 30); break;
        case 'todo': if (a.text && st.todo.length < 8) st.todo.push({ t: String(a.text).slice(0, 26), w: who, d: false }); break;
        case 'todoT': if (st.todo[a.i]) { st.todo[a.i].d = !st.todo[a.i].d; if (st.todo[a.i].d) ev('sfx', 'pop'); } break;
        case 'todoDel': st.todo.splice(a.i, 1); break;
        case 'rain': st.rain = !st.rain; break;
        case 'night': st.night = !st.night; break;
        case 'poke': st.poke[who] = 1.2; ev('sfx', 'meow'); break;
      }
    },
    step(st, inputs, ev) {
      const tm = st.tm; st.t += DT;
      for (let i = 0; i < 2; i++) if (st.poke[i] > 0) st.poke[i] -= DT;
      if (!tm.run || tm.ph === 'idle') return;
      tm.left -= DT; if (tm.ph === 'focus') tm.studied += DT;
      if (tm.left <= 0) {
        if (tm.ph === 'focus') { tm.n++; ev('studied', Math.round(tm.pre[0])); ev('chime'); tm.ph = 'break'; tm.left = tm.pre[1] * 60; tm.studied = 0; }
        else { ev('chime'); tm.ph = 'focus'; tm.left = tm.pre[0] * 60; }
      }
    },
    snap(st) { return { sc: 'study', place: st.place, view: st.view, room: st.room, tm: Object.assign({}, st.tm, { left: Math.round(st.tm.left * 10) / 10, studied: Math.round(st.tm.studied) }), goals: st.goals.slice(), todo: st.todo.map(x => Object.assign({}, x)), rain: st.rain, night: st.night, c: st.c, pk: st.poke.map(p => p > 0 ? 1 : 0) }; },
    onEvent(R, e, s) {
      if (e[0] === 'studied') { const r = Stats.add(e[1]); Diary.count('studyMin', e[1]); Diary.stamp('study', { min: e[1] }); GameUI.banner(`完成一个番茄 🍅 +${e[1]} 分钟`, 2400); if (r.newUnlock) setTimeout(() => GameUI.banner('解锁：' + r.newUnlock[1] + ' ✨', 2600), 2600); R.spark(240, 120, 'star', 8); }
      if (e[0] === 'chime') Sfx.chime();
      if (e[0] === 'focus') { Sfx.page && Sfx.page(); }
    },
    pointer() {},
    key(R, s, code) { if (code === 'Space') App.act({ k: s.tm.run ? 'pause' : 'start' }, R.who()); },

    draw(R, s, dt) {
      const C = R.C, t = R.t, tod = s.night ? 'night' : 'golden', wea = s.rain ? 'rain' : 'clear';
      applyAmb(s);
      const rm = Scenery.roomBack(R, s.room);
      const W = rm.win;
      Scenery.drawView(R, W.x, W.y, W.w, W.h, s.view, { tod, weather: wea, t, pan: 0.5 + Math.sin(t * 0.05) * 0.1 });
      if (Stats.has('lights')) for (let i = 0; i < 16; i++) { R.rect(W.x + i * W.w / 15, W.y + 2 + Math.sin(i) * 2, 2, 2, ['#ffd25a', '#f3a85e', '#8fd0f6'][i % 3]); }
      Scenery.windowFrame(R, W.x, W.y, W.w, W.h, { style: W.style, curtains: true, curtainC: rm.curtain || '#7a6aa8', t, weather: wea, open: 0.9 });
      // dim the room at night, warm lamp pool
      if (s.night) { R.rect(0, 0, R.AW, R.AH, '#0a0d20', 0.35); }
      // bookshelf with finance books + garden
      const gold = Stats.has('gold');
      for (const [yy, off] of [[150, 0], [176, 5]]) { R.rect(16, yy, 104, 3, gold ? '#c8a050' : '#6a4a30'); for (let i = 0; i < 9; i++) { const bx = 18 + i * 11, bh = 16 + (Scenery.hash(i, yy) * 6 | 0), c = ['#2a4a7a', '#7a2a3a', '#2a5a4a', '#5a4a2a', '#4a3a6a'][(i + off) % 5]; R.rect(bx, yy - bh, 10, bh, c); R.rect(bx + 1, yy - bh + 3, 8, 1, '#e8d8a8'); } }
      const st0 = Stats.load(); const pots = Math.min(5, 1 + Math.floor(st0.total / 40));
      for (let i = 0; i < pots; i++) { const px = 22 + i * 20, gh = Math.min(14, 3 + Math.floor((st0.total - i * 40) / 15)); R.rect(px, 190, 10, 7, '#b86a4a'); for (let j = 0; j < gh; j++) R.rect(px + 4 + Math.round(Math.sin(j * .8 + i) * 1.5), 190 - j, 2, 1, '#5aa86a'); if (gh > 8) R.rect(px + 2, 190 - gh, 6, 3, i % 2 ? '#f3a85e' : '#ffd25a'); }
      if (Stats.has('cactus')) { R.rect(124, 184, 8, 6, '#b86a4a'); R.rect(126, 174, 4, 10, '#4a8a5a'); }
      if (Stats.has('tank')) { R.rect(360, 158, 30, 18, '#3a6a9a'); R.rect(360, 156, 30, 2, '#cfdcec'); R.rect(366 + Math.sin(t) * 8, 166, 4, 2, '#f3a85a'); }
      Scenery.F.rug(R, 150, 214, 180, '#5a4a7a'); Scenery.F.plant(R, 352, 214); Scenery.F.bed(R, 'windowseat', 380, 232);
      // desk
      const top = 172; R.rect(130, top, 220, 6, '#8a6040'); R.rect(130, top + 6, 220, 2, '#6a4a30'); R.rect(136, top + 8, 6, 24, '#6a4a30'); R.rect(338, top + 8, 6, 24, '#6a4a30');
      // lamp
      Scenery.F.lamp(R, 330, top, true, t); if (Stats.has('lamp')) { R.rect(296, 116, 68, 60, '#ffb070', 0.08); }
      // laptop w/ ticker
      R.rect(218, top - 26, 44, 26, '#2a2f3e'); R.rect(220, top - 24, 40, 20, '#0e1a12'); R.rect(212, top - 2, 56, 2, '#c3c8d4');
      for (let i = 0; i < 3; i++) { const k = ((t / 2 | 0) + i) % TICK.length, [n, v] = TICK[k], ch = Math.sin(t * .3 + k * 7) * 2.1; R.ctx.font = '12px Zpix'; R.text(n, 221, top - 23 + i * 6, { c: '#9affb0', sh: false }); R.text((v * (1 + ch / 100)).toFixed(1) + (ch >= 0 ? '▲' : '▼'), 259, top - 23 + i * 6, { al: 'r', c: ch >= 0 ? '#5aff8a' : '#ff6a7a', sh: false }); }
      // mugs with steam
      for (const mx of [168, 306]) { R.rect(mx, top - 8, 8, 8, Stats.has('mug') ? '#f3a85e' : '#e8e4f0'); R.rect(mx + 8, top - 6, 2, 4, Stats.has('mug') ? '#f3a85e' : '#e8e4f0'); R.rect(mx + 1, top - 7, 6, 1, '#6a4030'); for (let j = 0; j < 3; j++) { const sy = ((t * 6 + j * 4) % 12); R.rect(mx + 3 + Math.sin(t * 2 + j) * 1.5, top - 10 - sy, 1, 2, '#ffffff', 0.5 * (1 - sy / 12)); } }
      // cats: typing / blink / look / break stretch
      const tm = s.tm, focus = tm.ph === 'focus' && tm.run, brk = tm.ph === 'break';
      const pose = (i) => {
        if (s.pk && s.pk[i]) return 'meow';
        if (brk) return ['happy0', 'happy1', 'leap', 'happy1'][((t * 2 + i) | 0) % 4];
        if (focus) { const ph = (t * 0.7 + i * 1.3) % 9; if (ph < 0.25) return 'sitBlink'; if (ph > 7.5 && ph < 8.4) return 'look'; return (t * 6 | 0) % 2 ? 'sit' : 'sitBlink'; }
        if (tm.ph === 'idle' && !tm.run) return ((t / 3 + i) | 0) % 3 === 2 ? 'loaf' : 'sit';
        return ((t * 0.4 + i) | 0) % 4 === 0 ? 'sleep0' : 'loaf';
      };
      R.pair(s, [{ x: s.c[0][0], y: s.c[0][1], pose: pose(0), flip: false }, { x: s.c[1][0], y: s.c[1][1], pose: pose(1), flip: true }]);
      if (focus && Math.random() < 0.02) R.spark(240, top - 30, 'note');
      if (!focus && tm.ph !== 'idle' && !brk && Math.random() < 0.02) R.spark(s.c[0][0], s.c[0][1] - 26, 'zz');
      // poke hit areas on cats
      R.hit(s.c[0][0] - 14, s.c[0][1] - 26, 28, 26, { k: 'poke' }); R.hit(s.c[1][0] - 14, s.c[1][1] - 26, 28, 26, { k: 'poke' });

      if (L.dnd) { // do-not-disturb: only big timer
        R.rect(0, 0, R.AW, R.AH, '#05060c', 0.55);
        R.text(fmt(tm.left), R.AW / 2, 20, { al: 'c', size: 24, c: brk ? C.mint : C.cream }); R.text(brk ? '休息中' : tm.run ? '专注中 · 免打扰' : '已暂停', R.AW / 2, 40, { al: 'c', c: C.dim });
        R.btn(R.AW / 2 - 30, 250, 60, 14, '退出免打扰', () => { L.dnd = false; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); });
        return;
      }
      R.topBar('一起自习室 · ' + s.place);
      // ---- timer panel ----
      R.panel(4, 18, 116, 112, { title: tm.ph === 'break' ? '休息 ☕' : tm.ph === 'focus' ? '专注 🍅' : '番茄钟' });
      R.text(fmt(tm.left), 62, 34, { al: 'c', size: 24, c: brk ? C.mint : tm.run ? C.cream : C.dim });
      const prog = tm.ph === 'focus' ? 1 - tm.left / (tm.pre[0] * 60) : tm.ph === 'break' ? 1 - tm.left / (tm.pre[1] * 60) : 0;
      R.rect(10, 50, 104, 3, C.ink); R.rect(10, 50, 104 * Math.max(0, Math.min(1, prog)), 3, brk ? C.mint : C.warm);
      PRESETS.forEach((p, i) => R.btn(8 + i * 28, 57, 26, 12, p[0] + '/' + p[1], { k: 'preset', f: p[0], b: p[1] }, { on: tm.pre[0] === p[0] && tm.pre[1] === p[1] }));
      R.btn(92, 57, 24, 12, '自定', () => R.ask('专注分钟/休息分钟（如 40/8）', tm.pre.join('/'), (v) => { const m = v.match(/(\d+)\D+(\d+)/); if (m) App.act({ k: 'preset', f: +m[1], b: +m[2] }, R.who()); }), { on: !PRESETS.some(p => p[0] === tm.pre[0] && p[1] === tm.pre[1]) });
      R.btn(8, 73, 52, 16, tm.run ? '暂停' : tm.ph === 'idle' ? '开始' : '继续', { k: tm.run ? 'pause' : 'start' }, { c: tm.run ? C.slate2 : '#3a7a5a' });
      R.btn(64, 73, 52, 16, '重置', { k: 'reset' });
      R.text(`今天 ${tm.n} 个番茄`, 62, 94, { al: 'c', c: C.dim });
      R.text('任意一只猫都能开始/暂停', 62, 104, { al: 'c', c: C.dim, sh: false });
      R.text('空格键 = 开始/暂停', 62, 114, { al: 'c', c: C.dim, sh: false });
      // ---- goals + todos ----
      R.panel(364, 18, 112, 150, { title: '今日目标' });
      for (let i = 0; i < 2; i++) {
        const y = 33 + i * 22; R.text(CAT_NAMES[i] + '：', 368, y, { c: i ? C.gold : C.blue });
        const g = s.goals[i] || (R.me() === i ? '点这里写目标…' : '（还没写）');
        R.text(g.length > 9 ? g.slice(0, 9) + '…' : g, 368, y + 9, { c: s.goals[i] ? C.paper : C.dim, sh: false });
        if (R.me() === i || R.local()) R.hit(366, y - 1, 108, 20, () => R.ask(CAT_NAMES[i] + ' 今天的目标', s.goals[i], (v) => App.act({ k: 'goal', text: v }, R.local() ? i : R.who())), false);
      }
      R.rect(368, 78, 104, 1, C.edge); R.text('待办', 368, 81, { c: C.gold });
      s.todo.forEach((td, i) => {
        const y = 91 + i * 9; R.btn(368, y, 8, 8, td.d ? '✓' : '', { k: 'todoT', i }, { on: td.d, onc: C.mint });
        R.text(td.t.length > 10 ? td.t.slice(0, 10) + '…' : td.t, 379, y + 1, { c: td.d ? C.dim : (td.w ? '#ffc8dc' : '#cfe6ff'), sh: false });
        if (td.d) R.rect(379, y + 4, Math.min(80, R.tw(td.t.slice(0, 11))), 1, C.dim);
        R.btn(464, y, 8, 8, '×', { k: 'todoDel', i }, { c: C.ink2 });
      });
      if (s.todo.length < 8) R.btn(368, 92 + s.todo.length * 9, 50, 9, '+ 加一项', () => R.ask('加一个待办', '', (v) => v && App.act({ k: 'todo', text: v }, R.who())));
      // ---- bottom bar ----
      R.rect(0, 252, R.AW, 20, C.ink, 0.75);
      const bb = [['雨 ' + (s.rain ? '开' : '关'), { k: 'rain' }, s.rain], ['夜 ' + (s.night ? '开' : '关'), { k: 'night' }, s.night], ['环境声', () => { L.panel = L.panel === 'amb' ? null : 'amb'; }, L.panel === 'amb'], ['统计', () => { L.panel = L.panel === 'stats' ? null : 'stats'; }, L.panel === 'stats'], ['免打扰', () => { L.dnd = true; L.panel = null; const el = document.getElementById('wrap'); if (el.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {}); }, false], ['结束卡 PNG', () => endCard(R, s), false]];
      bb.forEach(([lab, a, on], i) => R.btn(4 + i * 62, 255, 58, 14, lab, a, { on }));
      if (L.panel === 'amb') {
        R.panel(130, 150, 220, 98, { title: '环境声（只在本机）' });
        [['rain', '雨声'], ['cafe', '咖啡馆'], ['keys', '键盘'], ['pages', '翻书']].forEach(([k, n], i) => {
          const y = 168 + i * 19; R.text(n, 138, y + 2); R.rect(190, y + 4, 140, 4, C.ink); R.rect(190, y + 4, 140 * L.amb[k], 4, C.mint); R.rect(188 + 140 * L.amb[k], y, 5, 12, C.cream);
          R.hit(186, y - 3, 150, 18, (dx) => { L.amb[k] = Math.max(0, Math.min(1, (dx - 4) / 140)); try { localStorage.setItem('mmcx-amb', JSON.stringify(L.amb)); } catch (e) {} });
        });
      }
      if (L.panel === 'stats') {
        const S = Stats.load(); R.panel(120, 24, 240, 222, { title: '我们的学习记录（本机）' });
        R.text(`连续 ${S.streak} 天   ·   共 ${S.total} 分钟   ·   ${S.pomos} 个番茄`, 240, 42, { al: 'c', c: C.cream });
        const wk = Stats.week(), mx = Math.max(25, ...wk.map(w => w[1]));
        wk.forEach(([d, m], i) => { const bx = 140 + i * 30, bh = Math.round(80 * m / mx); R.rect(bx, 140 - bh, 18, bh, i === 6 ? C.warm : C.blue); R.rect(bx, 140 - bh, 18, 1, '#ffffff'); R.text(d, bx + 9, 144, { al: 'c', c: C.dim }); if (m) R.text(String(m), bx + 9, 130 - bh, { al: 'c', c: C.paper, sh: false }); });
        R.text('解锁', 132, 160, { c: C.gold });
        UNLOCKS.forEach((u, i) => { const got = S.total >= u[0], x = 132 + (i % 3) * 76, y = 172 + ((i / 3) | 0) * 22; R.panel(x, y, 72, 18, { fill: got ? '#3a4a3a' : C.ink2, shadow: false }); R.text((got ? '✓ ' : '🔒 ') + u[1], x + 4, y + 3, { c: got ? C.mint : C.dim, sh: false }); R.text(u[0] + '分', x + 4, y + 10, { c: C.dim, sh: false }); });
      }
      // ---- break screen ----
      if (brk) {
        R.rect(0, 15, R.AW, 237, '#0a1a14', 0.45);
        R.panel(150, 60, 180, 70, { title: '休息一下 ☕', tfill: '#3a7a5a' });
        R.text(fmt(tm.left), 240, 80, { al: 'c', size: 24, c: C.mint });
        R.text('站起来伸个懒腰，喝口水～', 240, 100, { al: 'c', c: C.paper });
        R.btn(212, 112, 56, 13, '跳过休息', { k: 'skip' });
      }
    },
  };
  function endCard(R, s) {
    const S = Stats.load(), src = document.getElementById('hub');
    const c = document.createElement('canvas'); c.width = src.width; c.height = src.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(src, 0, 0);
    g.fillStyle = 'rgba(13,15,23,.72)'; g.fillRect(240, 150, 480, 250); g.strokeStyle = '#f3c55e'; g.lineWidth = 4; g.strokeRect(244, 154, 472, 242);
    g.fillStyle = '#fff3d6'; g.font = '24px Zpix'; g.textAlign = 'center';
    g.fillText(`${CAT_NAMES[0]} & ${CAT_NAMES[1]} 一起自习`, 480, 200); g.font = '24px Zpix'; g.fillStyle = '#f3a85e';
    g.fillText(`今天 ${S.days[day()] || 0} 分钟 · 番茄 ${s.tm.n} 个`, 480, 250); g.fillStyle = '#8fe0b0'; g.fillText(`连续 ${S.streak} 天 · 共 ${S.total} 分钟`, 480, 296);
    g.font = '12px Zpix'; g.fillStyle = '#9aa3bd'; g.fillText(`${s.place} · ${day()} · 喵喵成行`, 480, 350);
    c.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = `miaomiao-study-${day()}.png`; document.body.appendChild(a); a.click(); a.remove(); GameUI.banner('结束卡已保存 📸', 1800); });
    Diary.stamp('studycard');
  }
  Hub.mode('study', M);
  window.StudyStats = Stats; window.StudyMode = M;
})();
