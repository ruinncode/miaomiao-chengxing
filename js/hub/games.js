// ============================================================
//  小游戏厅 — the arcade room that holds the existing mini-games
//  (versus platform games + co-op levels). Walk to a cabinet and
//  press ↑ (or tap it). Games run in the Phaser engine and come
//  back here afterwards (App.playFrom stash).  Also exports
//  window.MiniGames, shared by the handheld and the hotel TV.
// ============================================================
(function () {
  const DT = 1 / 60, FLOOR = 232, SPD = 80;
  const MG = window.MiniGames = [
    { id: 'fish', name: '抢小鱼', m: 'vs', arg: { only: 'fish' }, c: '#3a7ac8', tip: '对战 · 谁抢到的小鱼多' },
    { id: 'knock', name: '猫拳擂台', m: 'vs', arg: { only: 'knock' }, c: '#c8566a', tip: '对战 · 把对方拍下台' },
    { id: 'vacuum', name: '躲避扫地机', m: 'vs', arg: { only: 'vacuum' }, c: '#4a9a6a', tip: '对战 · 坚持到最后' },
    { id: 'match', name: '五局三胜', m: 'vs', arg: {}, c: '#8a5ac8', tip: '三个小游戏轮流来' },
    { id: 'coop', name: '合作闯关', m: 'coop', arg: { lv: 0 }, c: '#c89a3a', tip: '10 个关卡 · 一起回家', coop: true },
  ];
  const CABX = [70, 140, 210, 280, 350, 420];
  const M = {
    music: () => 'menu',
    pad: () => true,
    create(arg) { return { sc: 'games', c: [[220, FLOOR], [250, FLOOR]], f: [1, -1], mv: [0, 0], t: 0, pin: [{}, {}], lv: 0, panel: 0, place: arg.place || '' }; },
    resume(st) { st.panel = 0; },
    act(st, a, who, ev) {
      if (a.k === 'cab') return cab(st, a.i | 0, ev);
      if (a.k === 'lv') { st.lv = Math.max(0, Math.min(9, a.v | 0)); return; }
      if (a.k === 'panel') { st.panel = 0; return; }
    },
    step(st, inputs, ev) {
      st.t += DT;
      for (let i = 0; i < 2; i++) {
        const n = inputs[i] || {}, o = st.pin[i] || {}; st.pin[i] = { l: !!n.l, r: !!n.r, j: !!n.j, d: !!n.d };
        if (st.panel) { if (n.j && !o.j) cab(st, 4, ev, true); if (n.d && !o.d) st.panel = 0; if (n.l && !o.l) st.lv = Math.max(0, st.lv - 1); if (n.r && !o.r) st.lv = Math.min(9, st.lv + 1); continue; }
        const dx = (n.r ? 1 : 0) - (n.l ? 1 : 0); st.mv[i] = dx ? 1 : 0; if (dx) st.f[i] = dx;
        st.c[i][0] = Math.max(20, Math.min(460, st.c[i][0] + dx * SPD * DT));
        if (n.j && !o.j) { const k = near(st.c[i][0]); if (k >= 0) cab(st, k, ev); }
      }
    },
    snap(st) { return { sc: 'games', c: st.c.map(c => [Math.round(c[0]), c[1]]), f: st.f.slice(), mv: st.mv.slice(), t: Math.round(st.t * 20) / 20, lv: st.lv, panel: st.panel, place: st.place }; },
    draw(R, s) {
      const C = R.C, t = R.t;
      R.rect(0, 0, 480, 272, '#1e1830'); for (let x = 0; x < 480; x += 32) R.rect(x, 0, 16, 190, '#241d3a');
      for (let i = 0; i < 24; i++) { const on = ((t * 3 + i) | 0) % 3 === 0; R.rect(10 + i * 20, 20, 6, 4, on ? '#ff8fb8' : '#5a3a6a'); }
      R.text('🕹 小游戏厅' + (s.place ? ' · ' + s.place : ''), 240, 30, { al: 'c', size: 24, c: '#ffd6e6' });
      R.rect(0, 190, 480, 82, '#3a2e4a'); for (let y = 190; y < 272; y += 10) for (let x = ((y / 10) % 2) * 10; x < 480; x += 20) R.rect(x, y, 10, 10, '#423554');
      MG.concat([{ id: 'hh', name: '掌机柜台', c: '#5a5a7a', tip: '借一台掌机' }]).forEach((g, i) => {
        const x = CABX[i], nearC = [0, 1].some(c => s.c[c] && Math.abs(s.c[c][0] - x) < 22);
        R.rect(x - 22, 84, 44, 112, '#14101e'); R.rect(x - 20, 86, 40, 108, g.c); R.rect(x - 16, 96, 32, 26, '#0a0a12');
        const ph = (t * 2 + i) % 4; R.rect(x - 13, 99, 26, 20, ph < 2 ? '#1a3a5a' : '#2a1a4a'); R.rect(x - 8 + Math.sin(t * 3 + i) * 6, 108, 4, 4, '#ffd36a');
        R.rect(x - 18, 130, 36, 10, '#2a2238'); R.rect(x - 10, 132, 4, 6, '#e85a6a'); R.rect(x + 4, 132, 4, 4, '#5ae88a');
        R.rect(x - 22, 70, 44, 14, '#0c0a14'); let n = g.name; R.text(n, x, 73, { al: 'c', c: '#fff3d6', sh: false });
        if (nearC) R.rect(x - 20, 86, 40, 108, '#fff', .12 + Math.sin(t * 6) * .05);
        R.hit(x - 22, 70, 44, 126, { k: 'cab', i });
      });
      R.pair(s, [0, 1].map(i => ({ x: s.c[i][0], y: s.c[i][1], pose: s.mv[i] ? 'walk' + ((t * 10 + i * 3 | 0) % 6) : 'idle' + ((t + i | 0) % 2), flip: s.f[i] < 0 })));
      const k = [0, 1].map(i => near(s.c[i][0])).find(k => k >= 0);
      if (k != null && k >= 0) { const g = MG[k] || { name: '掌机柜台', tip: '借一台掌机' }; R.panel(140, 244, 200, 22, { fill: '#14101e', shadow: false }); R.text(g.name + ' · ' + g.tip + '  ↑', 240, 249, { al: 'c', c: C.cream }); }
      if (s.panel) {
        R.panel(120, 60, 240, 120, { title: '合作闯关 · 选关', tfill: '#7a5a2a' });
        for (let i = 0; i < 10; i++) R.btn(134 + (i % 5) * 44, 84 + (i / 5 | 0) * 26, 38, 20, String(i + 1), { k: 'lv', v: i }, { c: i === s.lv ? '#c89a3a' : '#3a3550' });
        R.btn(140, 148, 100, 18, '开始第 ' + (s.lv + 1) + ' 关', { k: 'cab', i: 4, go: 1 }, { c: '#3a6a5a' }); R.btn(250, 148, 90, 18, '算了', { k: 'panel' });
      }
      R.topBar('小游戏厅');
    },
  };
  function near(x) { let b = -1, bd = 24; CABX.forEach((cx, i) => { const d = Math.abs(cx - x); if (d < bd) { bd = d; b = i; } }); return b; }
  function cab(st, i, ev, go) {
    if (i === 5) { st._sw = { k: 'switch', m: 'handheld', arg: { place: st.place }, back: true }; ev('sfx', 'click'); return; }
    const g = MG[i]; if (!g) return;
    if (g.coop && !go && !st.panel) { st.panel = 1; ev('sfx', 'click'); return; }
    st.panel = 0; ev('sfx', 'chimeS'); ev('play', g.id);
    st._sw = { k: 'play', m: g.m, arg: g.coop ? { lv: st.lv } : g.arg };
  }
  M.act = (function (a0) { return function (st, a, who, ev) { if (a.k === 'cab' && a.go) return cab(st, 4, ev, true); return a0.call(this, st, a, who, ev); }; })(M.act);
  Hub.mode('games', M);
})();
