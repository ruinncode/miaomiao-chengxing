// ============================================================
//  掌机 — a pixel handheld console. Its screen is a cartridge
//  launcher for the mini-games (window.MiniGames from games.js).
//  ←/→ pick a cartridge, ↑ (A) starts, ↓ (B) goes back.
//  Opened from the departures hub, the hotel TV, the arcade, or
//  the suitcase (if packed). Games return to where you came from.
// ============================================================
(function () {
  const DT = 1 / 60;
  const MG = () => window.MiniGames || [];
  const SHELLS = ['#f6b8c8', '#a8d8c8', '#c8b8f0'];
  const M = {
    music: () => 'menu',
    create(arg) { return { sc: 'handheld', sel: 0, lv: 0, t: 0, pin: [{}, {}], place: arg.place || '', tv: !!arg.tv, shell: 0, boot: 1.2 }; },
    resume(st) { st.boot = .6; },
    act(st, a, who, ev) {
      const n = MG().length;
      if (a.k === 'sel') { st.sel = ((a.v | 0) % n + n) % n; ev('sfx', 'click'); }
      if (a.k === 'mv') { st.sel = (st.sel + (a.v | 0) + n) % n; ev('sfx', 'click'); }
      if (a.k === 'lv') st.lv = (st.lv + (a.v | 0) + 10) % 10;
      if (a.k === 'start') start(st, ev);
      if (a.k === 'shell') st.shell = (st.shell + 1) % SHELLS.length;
      if (a.k === 'back') st._sw = st._back ? { k: 'return' } : { k: 'leave' };
    },
    step(st, inputs, ev) {
      st.t += DT; if (st.boot > 0) { st.boot -= DT; return; }
      for (let i = 0; i < 2; i++) {
        const n = inputs[i] || {}, o = st.pin[i] || {}; st.pin[i] = { l: !!n.l, r: !!n.r, j: !!n.j, d: !!n.d, a: !!n.a };
        if (n.l && !o.l) M.act(st, { k: 'mv', v: -1 }, i, ev);
        if (n.r && !o.r) M.act(st, { k: 'mv', v: 1 }, i, ev);
        if ((n.j && !o.j) || (n.a && !o.a)) start(st, ev);
        if (n.d && !o.d) { const g = MG()[st.sel]; if (g && g.coop) st.lv = (st.lv + 1) % 10; }
      }
    },
    snap(st) { return { sc: 'handheld', sel: st.sel, lv: st.lv, t: Math.round(st.t * 20) / 20, place: st.place, tv: st.tv, shell: st.shell, boot: Math.max(0, Math.round(st.boot * 20) / 20), c: [null, null] }; },
    draw(R, s) {
      const C = R.C, t = R.t, G = MG(), g = G[s.sel] || {}, sh = SHELLS[s.shell || 0];
      R.rect(0, 0, 480, 272, s.tv ? '#2a2236' : '#3a3046'); for (let y = 0; y < 272; y += 12) R.rect(0, y, 480, 6, s.tv ? '#2e2640' : '#3e344c');
      // console body
      R.rect(98, 26, 284, 236, '#2a2030'); R.rect(100, 24, 280, 236, sh); R.rect(100, 24, 280, 4, '#fff', .35); R.rect(106, 254, 268, 4, '#000', .12);
      R.rect(130, 36, 220, 136, '#4a4058'); R.rect(140, 44, 200, 120, '#0e1a14');
      R.rect(132, 38, 6, 6, s.boot > 0 ? '#e85a6a' : '#5ae88a');
      R.text('MIAO·BOY', 240, 166, { al: 'c', c: '#4a4058', sh: false });
      // screen
      const sx = 140, sy = 44;
      if (s.boot > 0) { R.rect(sx, sy, 200, 120, '#c8e8b0'); R.text('喵喵 掌机', 240, sy + 40 + Math.max(0, s.boot - .6) * 60, { al: 'c', size: 24, c: '#2a4a2a', sh: false }); }
      else {
        R.rect(sx, sy, 200, 120, '#c8e8b0'); for (let y = sy; y < sy + 120; y += 2) R.rect(sx, y, 200, 1, '#b8d8a0');
        R.text('选一张卡带', 240, sy + 4, { al: 'c', c: '#2a4a2a', sh: false });
        G.forEach((c, i) => { const d = i - s.sel; if (Math.abs(d) > 1) return; const x = 240 + d * 58, on = d === 0, w = on ? 46 : 36, h = on ? 52 : 40, y = sy + (on ? 22 : 30);
          R.rect(x - w / 2, y, w, h, on ? '#2a4a2a' : '#6a8a5a'); R.rect(x - w / 2 + 4, y + 4, w - 8, h * .5, on ? c.c : '#8aa87a'); R.rect(x - 6, y + h - 8, 12, 4, '#c8e8b0'); R.hit(x - w / 2, y, w, h, on ? { k: 'start' } : { k: 'sel', v: i }); });
        R.text(g.name || '', 240, sy + 80, { al: 'c', size: 24, c: '#1a3a1a', sh: false });
        R.text(g.coop ? '第 ' + (s.lv + 1) + ' 关  (↓ 换关)' : (g.tip || ''), 240, sy + 104, { al: 'c', c: '#2a4a2a', sh: false });
      }
      // controls
      const dx = 160, dy = 206; R.rect(dx - 6, dy - 18, 12, 36, '#2a2030'); R.rect(dx - 18, dy - 6, 36, 12, '#2a2030');
      R.btn(dx - 20, dy - 7, 14, 14, '◀', { k: 'mv', v: -1 }, { c: '#2a2030' }); R.btn(dx + 6, dy - 7, 14, 14, '▶', { k: 'mv', v: 1 }, { c: '#2a2030' });
      R.btn(dx - 7, dy + 6, 14, 14, '▼', { k: 'lv', v: 1 }, { c: '#2a2030' });
      R.btn(300, 190, 26, 26, 'A', { k: 'start' }, { c: '#c8566a' }); R.btn(272, 210, 26, 26, 'B', { k: 'back' }, { c: '#7a5a8a' });
      R.btn(206, 236, 30, 8, '', { k: 'shell' }, { c: '#6a5a6a' }); R.btn(244, 236, 30, 8, '', { k: 'start' }, { c: '#6a5a6a' });
      R.text('换色   START', 240, 246, { al: 'c', c: '#5a4a5a', sh: false });
      for (let i = 0; i < 4; i++) R.rect(330 + i * 6, 236 - i * 3, 3, 14, '#000', .18);
      // the two cats holding it
      R.pair({}, [{ x: 70, y: 252, pose: 'sit', flip: false }, { x: 410, y: 252, pose: 'sit', flip: true }]);
      R.text(s.tv ? '📺 连在酒店电视上' : '两只猫都能按 ← → ↑', 240, 14 + 4, { al: 'c', c: C.dim });
      R.topBar('掌机' + (s.place ? ' · ' + s.place : ''));
    },
  };
  function start(st, ev) {
    const g = MG()[st.sel]; if (!g || st.boot > 0) return; ev('sfx', 'chimeS');
    st._sw = { k: 'play', m: g.m, arg: g.coop ? { lv: st.lv } : g.arg };
  }
  Hub.mode('handheld', M);
})();
