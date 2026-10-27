// ============================================================
//  Travel part 2: station platforms, train / streetcar / LRT rides,
//  and the config-driven city activities.
//  Activity kinds: collect (also catch / dodge / skate), quiz, order,
//  paddle, photo. Each has an intro card (怎么玩), 3-2-1, play, result.
// ============================================================
(function () {
  const K = window.TravelKit, SCN = K.SCN, DT = K.DT, FLOOR = K.FLOOR, SC = Scenery, H = SC.hash, mix = SC.mix, clamp = K.clamp;
  const line = (cfg, id) => cfg.lines.find(l => l.id === id);
  const sIdx = (ln, n) => Math.max(0, ln.stations.findIndex(s => s.n === n));

  // ---------------- station platform ----------------
  const ST_W = 640, CYCLE = 22; // train: arrives 0–3, doors open 3–11, leaves 11–14, gone 14–22
  SCN.station = {
    w: () => ST_W,
    enter(st, arg, cfg) {
      const ln = line(cfg, arg.line); if (!ln) return; const i = sIdx(ln, arg.stn);
      let dir = st.stDir || 1; if (i >= ln.stations.length - 1) dir = -1; if (i <= 0) dir = 1;
      if (arg.route != null) { const r = cfg.routes[arg.route], leg = r.legs[arg.leg || 0]; dir = sIdx(ln, leg[2]) > i ? 1 : -1; }
      st.stn = { line: ln.id, i, dir, tt: 1 }; if (arg.x == null) arg.x = 120;
    },
    spots(s, cfg) {
      const ln = line(cfg, s.stn.line), end = ln.stations[s.stn.dir > 0 ? ln.stations.length - 1 : 0].n, open = s.stn.tt > 3 && s.stn.tt < 11, out = [
        { id: 'exit', x: 30, w: 24, label: '出站 · ' + (cfg.signs.exit || 'Exit'), k: 'exit' },
        { id: 'dir', x: 120, w: 30, label: '方向：往 ' + end + '（切换）', k: 'dir' },
        { id: 'bench', x: 560, w: 40, label: '长椅上靠一靠', k: 'cuddle', kind: 'bench', y: FLOOR - 10 },
      ];
      for (const dx of [220, 330, 440]) out.push({ id: 'door' + dx, x: dx, w: 24, label: open ? '上车 → ' + end : '等车…', k: open ? 'board' : 'wait' });
      return out;
    },
    act(st, sp, who, cfg, ev) {
      const ln = line(cfg, st.stn.line);
      if (sp.k === 'exit') { const s0 = ln.stations[st.stn.i]; if (s0.area && !s0.city) K.go(st, 'street', { area: s0.area, x: s0.x }, ev); else { const r = st.arg.ret || {}; K.go(st, 'street', { area: r.area || st.area, x: r.x }, ev); } }
      if (sp.k === 'dir') { if (st.stn.i > 0 && st.stn.i < ln.stations.length - 1) { st.stn.dir *= -1; st.stDir = st.stn.dir; ev('sfx', 'click'); } }
      if (sp.k === 'wait') K.msg(st, '列车即将到站…');
      if (sp.k === 'board') { K.go(st, 'ride', { line: ln.id, stn: ln.stations[st.stn.i].n, dir: st.stn.dir, route: st.arg.route, leg: st.arg.leg || 0, x: 200 }, ev); }
    },
    step(st) { st.stn.tt = (st.stn.tt + DT) % CYCLE; },
    snap(st, o) { o.stn = st.stn; },
    draw(R, s, cfg) {
      const C = R.C, ln = line(cfg, s.stn.line), stn = ln.stations[s.stn.i], ox = clamp((s.c[0][0] + s.c[1][0]) / 2 - 240, 0, ST_W - 480), under = !!stn.under, tod = K.tod(s), night = tod === 'night', tt = s.stn.tt;
      if (under) { R.rect(0, 0, 480, 200, ln.wall || '#c8c0a8'); for (let x = -ox % 8; x < 480; x += 8) for (let y = 30; y < 150; y += 4) R.rect(x, y, 7, 3, mix(ln.wall || '#c8c0a8', '#fff', H(x + ox, y) * .15)); R.rect(0, 0, 480, 26, '#2a2a33'); for (let x = -ox % 80; x < 480; x += 80) R.rect(x + 10, 24, 50, 2, '#fff6e0'); }
      else { SC.drawView(R, 0, 0, 480, 200, K.view(cfg, (cfg.areas.find(a => a.id === stn.area) || K.area(s, cfg)).view), { tod, weather: s.wea, t: R.t, pan: ox / 160, off: { trains: 1, cars: 1 } }); R.rect(0, 0, 480, 16, '#3a3a44'); for (let x = -ox % 60; x < 480; x += 60) R.rect(x + 28, 16, 4, 140, '#4a4a56'); R.rect(0, 14, 480, 4, ln.color); }
      // line stripe + station name signs (local language, repeated)
      R.rect(0, 120, 480, 6, ln.color);
      for (let x = -ox % 200 + 40; x < 480; x += 200) { const nm = stn.n, w = R.tw(nm, 24) + 16; R.rect(x, 60, w, 22, ln.sign || '#14161e'); R.rect(x, 60, w, 2, ln.color); R.text(nm, x + 8, 64, { size: 24, c: '#ffffff', sh: false }); if (stn.zh) R.text(stn.zh, x + 8, 86, { c: '#14161e', sh: false, size: 12 }); }
      // track + train
      R.rect(0, 196, 480, 10, '#2a2a30'); R.rect(0, 198, 480, 1, '#8a8a94'); R.rect(0, 204, 480, 1, '#8a8a94');
      const tx = tt < 3 ? (s.stn.dir > 0 ? -560 + tt / 3 * 560 : 560 - tt / 3 * 560) : tt < 11 ? 0 : tt < 14 ? (s.stn.dir > 0 ? (tt - 11) / 3 * 600 : -(tt - 11) / 3 * 600) : null;
      if (tx !== null) train(R, ln, 60 + tx - ox, 206, tt > 3.3 && tt < 10.8 ? Math.min(1, (tt - 3.3) * 3, (10.8 - tt) * 3) : 0, night || under, [220, 330, 440].map(d => d - 60), cfg);
      // platform
      R.rect(0, 206, 480, 66, ln.floor || '#9a9aa4'); R.rect(0, 206, 480, 4, '#f3c55e'); for (let x = -ox % 6; x < 480; x += 6) R.rect(x, 207, 3, 2, '#c89a2e');
      for (let y = 214; y < 272; y += 10) R.rect(0, y, 480, 1, mix(ln.floor || '#9a9aa4', '#000', .1));
      // bench + next train board + exit sign
      const bx = 540 - ox; R.rect(bx, 226, 50, 4, '#6a4a30'); R.rect(bx, 214, 50, 3, '#6a4a30'); R.rect(bx + 2, 230, 3, 10, '#333'); R.rect(bx + 45, 230, 3, 10, '#333');
      const nb = 108 - ox, end = ln.stations[s.stn.dir > 0 ? ln.stations.length - 1 : 0].n; R.rect(nb, 132, 120, 20, '#111'); R.text((cfg.signs.towards || 'To') + ' ' + end, nb + 4, 134, { c: '#ffb84a', sh: false }); const wait = tt < 3 ? Math.ceil(3 - tt) : tt < 11 ? 0 : Math.ceil(CYCLE + 3 - tt);
      R.text(wait ? Math.ceil(wait / 10) * 1 + ' min' : (cfg.signs.boarding || 'Boarding'), nb + 4, 143, { c: '#ffb84a', sh: false });
      const ex = 30 - ox; R.rect(ex - 14, 150, 28, 10, '#1a6a3a'); R.text(cfg.signs.exit || 'Exit', ex, 151, { al: 'c', c: '#fff', sh: false });
      // waiting passenger cats (they board when the doors open)
      if (!(tt > 4 && tt < 11)) for (let i = 0; i < 5; i++) { const px = 90 + i * 150 + ((s.stn.i * 37 + i * 53) % 40) - ox; if (px > -20 && px < 500) NPC.draw(R, px, 241 + (i % 2) * 6, { look: s.stn.i * 7 + i * 13 + 3, dir: i % 2 ? -1 : 1, sit: i === 3, role: i === 4 && s.stn.i % 3 === 0 ? 'student' : 'walk', t: R.t, wea: 'clear' }); }
      if (!K.cuddleDraw(R, s, ox)) K.drawCatsWalk(R, s, ox);
      K.bubbles(R, s, SCN.station.spots(s, cfg), ox, 166);
      K.header(R, s, cfg, ln.name + ' · ' + stn.n); K.toast(R, s); K.fade(R, s);
    },
  };
  // a side-view train: kind-specific bodies (subway, streetcar/LRT, bilevel)
  function train(R, ln, x, y, open, lit, doors, cfg) {
    const k = ln.car || 'subway', body = ln.body || '#c8ccd4', str = ln.color, cars = k === 'streetcar' || k === 'lrt' ? 1 : 3, cw = k === 'streetcar' || k === 'lrt' ? 400 : 180, h = k === 'bilevel' ? 64 : 46;
    for (let c = 0; c < cars; c++) {
      const cx = x + c * (cw + 4) - (cars > 1 ? 120 : -20); R.rect(cx, y - h, cw, h, body); R.rect(cx, y - h, cw, 3, mix(body, '#fff', .3)); R.rect(cx, y - 12, cw, 3, str);
      if (k === 'bilevel') { R.rect(cx, y - h + 8, cw, 12, lit ? '#ffe9a8' : '#3a4a5a'); R.rect(cx, y - 34, cw, 12, lit ? '#ffe9a8' : '#3a4a5a'); R.rect(cx, y - 8, cw, 8, ln.color2 || '#2e8a4a'); }
      else for (let w = 8; w < cw - 10; w += 22) R.rect(cx + w, y - h + 10, 16, 14, lit ? '#ffe9a8' : '#3a4a5a');
      if (k === 'streetcar' || k === 'lrt') { R.rect(cx + 180, y - h - 8, 1, 8, '#333'); R.rect(cx + 172, y - h - 9, 17, 1, '#333'); for (const j of [130, 270]) R.rect(cx + j, y - h, 1, h, '#2a2a30'); }
      for (const d of doors) { const dx = x + d - 6; if (dx < cx || dx > cx + cw - 14) continue; const g = Math.round(open * 6); R.rect(dx, y - h + 8, 7 - g, h - 10, mix(body, '#000', .15)); R.rect(dx + 7 + g, y - h + 8, 7 - g, h - 10, mix(body, '#000', .15)); if (g) R.rect(dx + 7 - g, y - h + 8, g * 2, h - 10, lit ? '#fff0c0' : '#e8e4d8'); }
    }
    if (ln.short) { R.rect(x + (cars > 1 ? -116 : 24), y - h + 4, 14, 9, '#111'); R.text(ln.short, x + (cars > 1 ? -109 : 31), y - h + 5, { al: 'c', c: '#ffb84a', sh: false }); }
  }

  // ---------------- riding ----------------
  const SEG = 7; // seconds between stations (×0.33 while napping)
  SCN.ride = {
    w: () => 480,
    enter(st, arg, cfg) {
      const ln = line(cfg, arg.line); let i = sIdx(ln, arg.stn), dir = arg.dir || 1;
      if (arg.route != null) { const leg = cfg.routes[arg.route].legs[arg.leg || 0]; dir = sIdx(ln, leg[2]) > i ? 1 : -1; }
      if (i + dir < 0 || i + dir >= ln.stations.length) dir = -dir;
      st.ride = { line: ln.id, lineName: ln.name, i, dir, p: 0, dwell: 0, ann: 0, route: arg.route, leg: arg.leg || 0 };
      if (arg.x == null) arg.x = 200;
    },
    spots(s, cfg) {
      const r = s.ride, out = [{ id: 'seat1', x: 120, w: 40, label: '坐下靠着打盹', k: 'cuddle', kind: 'seat', y: FLOOR - 12 }, { id: 'seat2', x: 380, w: 40, label: '坐下靠着打盹', k: 'cuddle', kind: 'seat', y: FLOOR - 12 }];
      if (r.dwell > 0) out.push({ id: 'door', x: 250, w: 30, label: '下车 · ' + line(cfg, r.line).stations[r.i].n, k: 'alight' });
      return out;
    },
    act(st, sp, who, cfg, ev) { if (sp.k === 'alight') alight(st, cfg, ev); },
    step(st, inp, cfg, ev) {
      const r = st.ride, ln = line(cfg, r.line);
      if (r.dwell > 0) { r.dwell -= DT; if (r.dwell <= 0) { if (r.i + r.dir < 0 || r.i + r.dir >= ln.stations.length) { r.dir = -r.dir; ev('ann', 'end'); } r.p = 0; ev('sfx', 'chimeS'); } return; }
      r.p += DT / SEG * (st.cud ? 3 : 1);
      if (!r.ann && r.p > .45) { r.ann = 1; ev('ann', 'next', ln.stations[r.i + r.dir].n); }
      if (r.p >= 1) {
        r.i += r.dir; r.p = 0; r.ann = 0; r.dwell = 5; ev('ann', 'arr', ln.stations[r.i].n); ev('sfx', 'ding');
        if (r.route != null) { const R0 = cfg.routes[r.route], leg = R0.legs[r.leg]; if (ln.stations[r.i].n === leg[2]) { if (st.cud) st.cud = null; if (r.leg + 1 < R0.legs.length) { const nx = R0.legs[r.leg + 1]; K.msg(st, '换乘 → ' + line(cfg, nx[0]).name, 3); K.go(st, 'station', { line: nx[0], stn: nx[1], route: r.route, leg: r.leg + 1 }, ev); } else { K.msg(st, '到站啦：' + R0.name + ' ✓', 3); ev('diary', 'route', { r: R0.name }); K.coins(3, st, ev); alight(st, cfg, ev); } } }
      }
    },
    snap(st, o) { o.ride = st.ride && { line: st.ride.line, i: st.ride.i, dir: st.ride.dir, p: Math.round(st.ride.p * 1000) / 1000, dwell: Math.round(st.ride.dwell * 10) / 10 }; },
    onEvent(R, e, s) {
      if (e[0] !== 'ann') return; const cfg = K.city(s), ln = cfg && line(cfg, s.ride && s.ride.line); if (!ln) return; const A = ln.ann || cfg.ann || {};
      if (e[1] === 'next') { K.L.ann = [(A.next || 'Next station:') + ' ' + e[2], '下一站：' + e[2], 4, ln.id]; Sfx.play('chimeS'); }
      if (e[1] === 'arr') { K.L.ann = [(A.arr || 'Arriving at') + ' ' + e[2], '到站：' + e[2] + ((ln.stations.find(x => x.n === e[2]) || {}).area ? '（可下车逛逛）' : ''), 4, ln.id]; }
      if (e[1] === 'end') K.L.ann = [A.end || 'This train terminates here', '终点站，列车将折返', 3, ln.id];
    },
    draw(R, s, cfg, dt) {
      const C = R.C, r = s.ride, ln = line(cfg, r.line), a = ln.stations[r.i], b = ln.stations[clamp(r.i + r.dir, 0, ln.stations.length - 1)], under = r.dwell > 0 ? a.under : (r.p < .5 ? a.under && b.under || a.under : b.under), tod = K.tod(s), night = tod === 'night', k = ln.car || 'subway';
      const speed = r.dwell > 0 ? 0 : Math.sin(Math.min(1, r.p) * Math.PI), sway0 = Math.round(speed * Math.sin(R.t * 7) * 0.8); K.L.rx = (K.L.rx || 0) + speed * dt * 260;
      // window band
      const arv = cfg.areas.find(x => x.id === (r.p < .5 ? a.area || b.area : b.area || a.area)), vid = ln.view || (arv && arv.view) || 'downtown';
      if (window.TrainView) { TrainView.draw(R, 0, 40, 480, 110, { under, tod, wea: s.wea, t: R.t, rx: K.L.rx, speed, city: cfg.id, lake: !under && (vid === 'lake' || vid === 'island'), street: !under && (k === 'streetcar' || k === 'lrt'), wall: ln.wall, near: r.dwell > 0 ? 0 : Math.max(0, (r.p - .82) / .18) * ((b.under ? 1 : 0)) });
        if (under) { if (r.dwell > 0) { R.rect(0, 40, 480, 110, ln.wall || '#c8c0a8'); R.rect(0, 100, 480, 5, ln.color); R.text(a.n, 240, 70, { al: 'c', size: 24, c: '#14161e', sh: false }); } } else { if (r.dwell > 0) { R.rect(0, 120, 480, 30, '#9a9aa4'); R.rect(0, 120, 480, 3, '#f3c55e'); const w = R.tw(a.n) + 10; R.rect(240 - w / 2, 98, w, 12, '#14161e'); R.text(a.n, 240, 100, { al: 'c', c: '#fff', sh: false }); } } }
      else if (under) { R.rect(0, 40, 480, 110, '#0c0d14'); if (r.dwell > 0) { R.rect(0, 40, 480, 110, ln.wall || '#c8c0a8'); R.rect(0, 100, 480, 5, ln.color); R.text(a.n, 240, 70, { al: 'c', size: 24, c: '#14161e', sh: false }); } }
      else { const ar = cfg.areas.find(x => x.id === (r.p < .5 ? a.area : b.area)) || cfg.areas.find(x => x.id === a.area) || K.area(s, cfg); SC.drawView(R, 0, 40, 480, 110, K.view(cfg, ln.view || ar.view), { tod, weather: s.wea, t: R.t, pan: ((K.L.rx / 1500) % 1 + 1) % 1, off: { trains: 1 } }); for (let i = 0; i < 5; i++) { const x = ((i * 120 - K.L.rx * 2) % 600 + 600) % 600 - 60; R.rect(x, 40, 3, 110, '#3a3a44'); } if (r.dwell > 0) { R.rect(0, 120, 480, 30, '#9a9aa4'); R.rect(0, 120, 480, 3, '#f3c55e'); const w = R.tw(a.n) + 10; R.rect(240 - w / 2, 98, w, 12, '#14161e'); R.text(a.n, 240, 100, { al: 'c', c: '#fff', sh: false }); } }
      // interior per kind
      const pal = { subway: ['#d8d8dc', '#b8bcc4', '#5a6a8a'], streetcar: ['#e8e4dc', '#c8c4bc', '#c8343a'], lrt: ['#e8e8ec', '#c8ccd4', '#2a6ab8'], bilevel: ['#d8dcd4', '#b8bcb4', '#2e7a4a'], metro: ['#e0e0e4', '#c0c4cc', '#4a6a9a'], shinkansen: ['#ecece8', '#d0d0cc', '#3a5a9a'], heritage: ['#c8a878', '#8a6a4a', '#7a2a24'] }[k] || ['#d8d8dc', '#b8bcc4', '#5a6a8a'];
      R.rect(0, 0, 480, 40, pal[0]); R.rect(0, 150, 480, 122, pal[0]); R.rect(0, 196, 480, 4, pal[1]); for (let y = 200; y < 272; y += 8) R.rect(0, y, 480, 8, (y / 8) % 2 ? '#5a5a66' : '#52525e');
      for (let x = 0; x < 480; x += 160) { R.rect(x + 10, 40, 140, 3, pal[1]); R.rect(x + 10, 147, 140, 3, pal[1]); }
      for (const sx of [70, 330]) { for (let i = 0; i < 4; i++) { R.rect(sx + i * 26, 206, 24, 16, pal[2]); R.rect(sx + i * 26, 188, 24, 20, mix(pal[2], '#000', .15)); } }
      for (const px of [40, 200, 300, 460]) R.rect(px, 0, 2, 200, k === 'subway' ? '#e8c84a' : '#c8c8d0');
      // passenger cats on the seats (seats next to the doors stay free for jsq & yyf)
      for (const [j, px] of [[0, 82], [1, 108], [2, 342], [3, 420]]) if ((r.i * 3 + j) % 4 !== 0) NPC.draw(R, px - sway0, 208, { look: r.i * 5 + j * 11 + (k.length), dir: px < 240 ? 1 : -1, sit: 1, t: R.t, role: (r.i + j) % 7 === 2 ? 'student' : 'walk' });
      if (r.i % 2) NPC.draw(R, 300, 241, { look: r.i * 9 + 4, dir: -1, t: R.t, role: 'walk' });
      // doors
      const open = r.dwell > 0 ? Math.min(1, (5 - r.dwell) * 3, r.dwell * 3) : 0; R.rect(226, 40, 48, 160, '#9aa0aa'); const g = Math.round(open * 20); R.rect(228, 44, 22 - g, 152, '#c8ccd4'); R.rect(250 + g, 44, 22 - g, 152, '#c8ccd4'); if (g) R.rect(250 - g, 44, g * 2, 152, under ? (ln.wall || '#c8c0a8') : '#9ab8d8');
      // route strip (stations + current position)
      const n = ln.stations.length, step = Math.min(22, 440 / Math.max(1, n - 1)), x0 = 240 - step * (n - 1) / 2;
      R.rect(0, 15, 480, 24, '#14161e'); R.rect(x0, 26, step * (n - 1), 2, ln.color);
      ln.stations.forEach((st0, j) => { const x = x0 + j * step; R.rect(x - 1, 25, 3, 4, j === r.i ? C.warm : '#e8e4f0'); if (j === r.i || j === r.i + r.dir || n < 12 || j === 0 || j === n - 1) R.text(st0.n.length > 8 && n > 10 ? st0.n.slice(0, 7) + '…' : st0.n, x, j % 2 ? 31 : 17, { al: 'c', c: j === r.i ? C.warm : '#9aa3bd', sh: false }); });
      const px = x0 + (r.i + (r.dwell > 0 ? 0 : r.p * r.dir)) * step; R.rect(px - 2, 24, 5, 6, C.gold);
      // announcement ticker
      let an = K.L.ann; if (an && an[3] && s.ride && an[3] !== s.ride.line) an = K.L.ann = null; if (an) { an[2] -= dt; if (an[2] <= 0) K.L.ann = null; R.rect(120, 154, 240, 22, '#111'); R.text(an[0], 240, 156, { al: 'c', c: '#ffb84a', sh: false }); R.text(an[1], 240, 166, { al: 'c', c: '#ffb84a', sh: false }); }
      // sway
      const sway = speed * Math.sin(R.t * 7) * 0.8;
      if (!K.cuddleDraw(R, s, -sway)) K.drawCatsWalk(R, s, -sway);
      K.bubbles(R, s, SCN.ride.spots(s, cfg), 0, 180);
      K.header(R, s, cfg, ln.name + ' · ' + (r.dwell > 0 ? a.n : a.n + ' → ' + b.n)); K.toast(R, s); K.fade(R, s);
    },
  };
  function alight(st, cfg, ev) {
    const r = st.ride, ln = line(cfg, r.line), s0 = ln.stations[r.i];
    if (s0.city && s0.city !== st.city) { // intercity (e.g. GO Kitchener line → Waterloo Region)
      const to = s0.city; ev('sfx', 'chimeS'); st._sw = null; st.sc = 'wait';
      const enter = () => { st.city = to; const c = Cities.get(to); st.hotel = 0; st.inn = 1; st.area = s0.area; K.go(st, 'street', { area: s0.area, x: s0.x }, ev); K.msg(st, '欢迎来到 ' + c.name + '！（已为你订好 ' + c.hotels[0].name + '）', 3.5); ev('place', c.name, to); };
      if (Cities.get(to)) enter(); else Cities.load(to).then(enter).catch(() => { st.sc = 'ride'; K.msg(st, '那座城市还在施工中'); });
      return;
    }
    if (!s0.area) { K.msg(st, '这一站附近还没有可以逛的街区，再坐几站吧'); return; }
    K.go(st, 'street', { area: s0.area, x: s0.x }, ev);
  }

  // ---------------- activities ----------------
  const ICON = {
    leaf: ['..r..', '.rrr.', 'rrrrr', '.rrr.', '..b..'], star: ['..y..', 'yyyyy', '.yyy.', '.y.y.'], fish: ['.bbb.b', 'bbbbbb', '.bbb.b'], apple: ['..g..', '.rrr.', 'rrrrr', 'rrrrr', '.rrr.'],
    book: ['ppppp', 'pwwwp', 'ppppp', 'ppppp'], flower: ['.p.p.', 'ppypp', '.p.p.', '..g..', '..g..'], cup: ['wwwww', 'wbbbw', 'wbbbww', '.www.'], snow: ['w.w.w', '.www.', 'wwwww', '.www.', 'w.w.w'],
    coin: ['.yyy.', 'yyoyy', 'yyoyy', '.yyy.'], ticket: ['ooooo', 'o.o.o', 'ooooo'], raccoon: ['k...k', 'kwwwk', 'wkwkw', 'kwwwk', '.kkk.', 'k.k.k'], syrup: ['.w.', 'ooo', 'ooo', 'ooo'], pie: ['.ooo.', 'oyyyo', 'ooooo'], goose: ['..kk.', '..kwk', '..k..', 'bbbb.', '.bbbb', '.y.y.'], cone: ['..o..', '.owo.', '.ooo.', 'ooooo'],
  };
  const PAL = { r: '#d8343a', b: '#6a4a30', y: '#f3c55e', g: '#5aa86a', p: '#c86a9a', w: '#f4f0e8', o: '#e8873a', k: '#1a1a22' };
  K.icon = (...a) => icon(...a);
  function icon(R, k, x, y, s = 1) { const m = ICON[k] || ICON.star; m.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') R.rect(x - row.length * s / 2 + i * s, y - m.length * s / 2 + j * s, s, s, PAL[ch] || '#fff'); })); }
  K.icon = icon;
  const KINDS = {};
  KINDS.collect = { // walk around a field (2D), grab items; options: fall (catch), hazard (dodge), ice (skate)
    pad: true,
    init(A, c) { A.items = []; A.haz = []; A.v = [[0, 0], [0, 0]]; A.stun = [0, 0]; A.pos = [[180, 220], [300, 220]]; for (let i = 0; i < (c.hazards || 0); i++) A.haz.push([H(i, 3) * 480, 160 + H(i, 4) * 80, i % 2 ? 1 : -1]); },
    step(A, c, inp) {
      const sp = c.ice ? 0 : 70;
      for (let i = 0; i < 2; i++) { const n = inp[i] || {}, dx = (n.r ? 1 : 0) - (n.l ? 1 : 0), dy = c.fall ? 0 : (n.d ? 1 : 0) - (n.j ? 1 : 0); if (A.stun[i] > 0) { A.stun[i] -= DT; continue; }
        if (c.ice) { A.v[i][0] = (A.v[i][0] + dx * 160 * DT) * 0.985; A.v[i][1] = (A.v[i][1] + dy * 160 * DT) * 0.985; } else { A.v[i] = [dx * sp, dy * sp]; }
        A.pos[i][0] = clamp(A.pos[i][0] + A.v[i][0] * DT, 14, 466); A.pos[i][1] = clamp(A.pos[i][1] + A.v[i][1] * DT, c.fall ? 241 : 150, 260); if (c.ice && (A.pos[i][0] <= 14 || A.pos[i][0] >= 466)) A.v[i][0] *= -.5; A.f[i] = dx || A.f[i]; A.mv[i] = (Math.abs(A.v[i][0]) + Math.abs(A.v[i][1])) > 8 ? 1 : 0; }
      if (A.items.length < (c.max || 5) && H(A.t * 60 | 0, 9) < (c.fall ? .06 : .04)) A.items.push([20 + H(A.t * 99 | 0, 1) * 440, c.fall ? 30 : 160 + H(A.t * 77 | 0, 2) * 90, c.items ? c.items[(H(A.t * 13 | 0, 5) * c.items.length) | 0] : (c.item || 'star')]);
      for (const it of A.items) if (c.fall) it[1] += (50 + A.t * .8) * DT;
      A.items = A.items.filter(it => { if (it[1] > 262) return false; for (let i = 0; i < 2; i++) if (Math.abs(it[0] - A.pos[i][0]) < 14 && Math.abs(it[1] - (A.pos[i][1] - 8)) < 16) { A.score++; A.ev('sfx', 'coin'); A.got.push([it[0], it[1], 0.8]); return false; } return true; });
      for (const h of A.haz) { const tg = A.pos[(H(h[0] | 0, 1) * 2) | 0]; h[0] += h[2] * (c.hazSpeed || 40) * DT; h[1] += Math.sign(tg[1] - h[1]) * 12 * DT; if (h[0] < -20 || h[0] > 500) { h[2] = -h[2]; } for (let i = 0; i < 2; i++) if (A.stun[i] <= 0 && Math.abs(h[0] - A.pos[i][0]) < 12 && Math.abs(h[1] - A.pos[i][1]) < 10) { A.stun[i] = 1.2; A.score = Math.max(0, A.score - 1); A.ev('sfx', 'honk'); } }
      A.got = A.got.filter(g => (g[2] -= DT) > 0);
    },
    draw(R, A, c, s, cfg) {
      for (const it of A.items) icon(R, it[2], it[0], it[1], 2);
      for (const h of A.haz) { R.rect(h[0] - 7, h[1] + 1, 14, 2, '#000', .2); icon(R, c.hazard || 'goose', h[0], h[1] - 6, 2); }
      for (const g of A.got) R.text('+1', g[0], g[1] - 20 + g[2] * 10, { al: 'c', c: R.C.gold });
      const cats = [0, 1].map(i => ({ x: A.pos[i][0], y: A.pos[i][1], pose: A.stun[i] > 0 ? 'dizzy' + ((R.t * 6 | 0) % 2) : A.mv[i] ? 'walk' + ((R.t * 10 + i * 3 | 0) % 6) : 'idle0', flip: A.f[i] < 0 }));
      R.pair(s, cats);
    },
  };
  KINDS.quiz = { // both answer each card; finance co-op interview, trivia…
    init(A, c) { A.q = 0; A.pick = [0, 0]; A.lock = [0, 0]; A.rev = 0; A.qt = c.qtime || 20; A.order = c.qs.map((_, i) => i); },
    step(A, c, inp, E) {
      if (A.rev > 0) { A.rev -= DT; if (A.rev <= 0) { A.q++; A.lock = [0, 0]; A.qt = c.qtime || 20; if (A.q >= Math.min(c.qs.length, c.n || 6)) A.over = 1; } return; }
      for (let i = 0; i < 2; i++) { if (A.lock[i]) continue; if (E[i].l || E[i].j) A.pick[i] = (A.pick[i] + 3) % 4; if (E[i].r || E[i].d) A.pick[i] = (A.pick[i] + 1) % 4; if (E[i].a) A.lock[i] = 1; }
      A.qt -= DT; if ((A.lock[0] && A.lock[1]) || A.qt <= 0) { const q = c.qs[A.order[A.q]]; const ok = [0, 1].filter(i => A.lock[i] && A.pick[i] === q[2]).length; A.score += ok; A.last = ok; A.rev = 3.2; A.ev('sfx', ok ? 'coin' : 'pop'); }
    },
    act(A, c, a, who) { if (a.k === 'ans' && !A.lock[who] && A.rev <= 0) { A.pick[who] = a.v | 0; A.lock[who] = 1; } },
    draw(R, A, c, s) {
      const C = R.C, q = c.qs[A.order[Math.min(A.q, A.order.length - 1)]]; if (!q) return;
      R.panel(30, 40, 420, 150, { title: (c.qtitle || '问题') + ' ' + (A.q + 1) + ' / ' + Math.min(c.qs.length, c.n || 6) });
      R.wrap(q[0], 42, 58, 396, { c: C.cream, lh: 9 });
      q[1].forEach((o, j) => { const y = 92 + j * 22, rev = A.rev > 0, ok = j === q[2]; R.btn(42, y, 396, 19, '', { k: 'actx', a: { k: 'ans', v: j } }, { c: rev ? (ok ? '#2e6a4a' : '#3a2a3a') : '#2e3a52' }); R.text('ABCD'[j] + '. ' + o, 48, y + 6, { c: C.paper });
        for (let i = 0; i < 2; i++) if (A.pick[i] === j) { R.rect(i ? 424 : 408, y + 4, 10, 10, A.lock[i] ? (i ? C.paper : '#2b2340') : C.dim); R.text(i ? '棕' : '黑', i ? 429 : 413, y + 5, { al: 'c', c: i ? '#3a2e4f' : C.paper, sh: false }); } });
      if (A.rev > 0 && q[3]) R.wrap('💡 ' + q[3], 42, 196, 396, { c: C.gold, lh: 8 });
      R.rect(30, 34, 420 * Math.max(0, A.qt) / (c.qtime || 20), 3, C.warm);
      R.cat(0, A.lock[0] ? 'sit' : 'idle0', 60, 262); R.cat(1, A.lock[1] ? 'sit' : 'idle1', 420, 262, { flip: true });
      R.text('←/→ 选 · F/Enter 确认（两只猫都要答）', 240, 252, { al: 'c', c: C.dim });
    },
  };
  KINDS.order = { // shopping / ordering list: find the right items together before time runs out
    init(A, c) { A.cur = [0, 7]; A.need = []; const pool = c.pool.map((_, i) => i); for (let k = 0; k < (c.n || 5); k++) A.need.push(pool[(H(k, A.seed) * pool.length) | 0]); A.done = []; },
    step(A, c, inp, E) {
      for (let i = 0; i < 2; i++) { if (E[i].l) A.cur[i] = (A.cur[i] + 7) % 8; if (E[i].r) A.cur[i] = (A.cur[i] + 1) % 8; if (E[i].j) A.cur[i] = (A.cur[i] + 4) % 8; if (E[i].d) A.cur[i] = (A.cur[i] + 4) % 8; if (E[i].a) KINDS.order.pick(A, c, A.cur[i] % c.pool.length); }
      if (A.need.length === 0) { A.score += Math.ceil(A.left / 5); A.over = 1; }
    },
    pick(A, c, k) { const j = A.need.indexOf(k); if (j >= 0) { A.need.splice(j, 1); A.done.push(k); A.score += 2; A.ev('sfx', 'coin'); } else { A.left -= 3; A.ev('sfx', 'pop'); } },
    act(A, c, a) { if (a.k === 'pick') KINDS.order.pick(A, c, a.v | 0); },
    draw(R, A, c) {
      const C = R.C; R.panel(20, 40, 150, 170, { title: c.listTitle || '购物清单' });
      const cnt = {}; A.need.forEach(k => cnt[k] = (cnt[k] || 0) + 1); let y = 58; for (const k in cnt) { icon(R, c.pool[k][1], 34, y + 3, 1); R.text(c.pool[k][0] + ' ×' + cnt[k], 44, y, { c: C.cream }); y += 12; } for (const k of A.done) { R.text('✓ ' + c.pool[k][0], 34, y, { c: C.mint }); y += 10; if (y > 200) break; }
      for (let k = 0; k < 8; k++) { const it = c.pool[k % c.pool.length], x = 186 + (k % 4) * 70, y2 = 50 + (k / 4 | 0) * 76; R.btn(x, y2, 64, 70, '', { k: 'actx', a: { k: 'pick', v: k % c.pool.length } }, { c: '#3a3550' }); icon(R, it[1], x + 32, y2 + 26, 3); R.text(it[0], x + 32, y2 + 52, { al: 'c', c: C.paper }); for (let i = 0; i < 2; i++) if (A.cur[i] === k) R.rect(x + 2 + i * 54, y2 + 2, 6, 6, i ? C.paper : '#2b2340'); }
      R.cat(0, 'idle0', 220, 250); R.cat(1, 'idle1', 400, 250, { flip: true }); R.text('方向键移动 · F/Enter 拿 · 拿错扣 3 秒', 300, 222, { al: 'c', c: C.dim });
    },
  };
  KINDS.paddle = { // canoe / swan boat / ferry rowing: alternate strokes in rhythm
    init(A, c) { A.d = 0; A.v = 0; A.lastW = -1; A.lastT = 0; A.str = [0, 0]; A.goal = c.goal || 600; },
    step(A, c, inp, E) {
      for (let i = 0; i < 2; i++) if (E[i].j || E[i].a) { const gap = A.t - A.lastT; let pw = A.lastW === 1 - i ? (gap > .25 && gap < 1.1 ? 1 : .4) : .25; A.v = Math.min(c.vmax || 70, A.v + 14 * pw); A.lastW = i; A.lastT = A.t; A.str[i] = .3; A.ev('sfx', pw === 1 ? 'chimeS' : 'pop'); }
      for (let i = 0; i < 2; i++) if (A.str[i] > 0) A.str[i] -= DT;
      A.v *= 0.992; A.d += A.v * DT; A.score = Math.floor(A.d / 50); if (A.d >= A.goal) { A.score += Math.ceil(A.left / 3); A.over = 1; }
    },
    draw(R, A, c, s, cfg) {
      const C = R.C; R.rect(0, 170, 480, 102, '#3a7ab8'); for (let i = 0; i < 40; i++) { const x = ((H(i, 1) * 600 - A.d * 1.5) % 600 + 600) % 600 - 60; R.rect(x, 178 + H(i, 2) * 90, 6 + H(i, 3) * 10, 1, '#8ac0e8'); }
      const bx = 240, by = 214; R.rect(bx - 40, by, 80, 8, c.boatColor || '#c8643a'); R.rect(bx - 44, by - 2, 6, 6, c.boatColor || '#c8643a'); R.rect(bx + 38, by - 2, 6, 6, c.boatColor || '#c8643a');
      R.cat(0, 'sit', bx - 16, by + 2); R.cat(1, 'sit', bx + 16, by + 2, { flip: true });
      for (let i = 0; i < 2; i++) { const px = bx + (i ? 24 : -24), a = A.str[i] > 0 ? 1 : 0; R.rect(px - (a ? 10 : 2), by - 8, 2, 20, '#8a5a3a'); R.rect(px - (a ? 14 : 4), by + 10, 6, 4, '#8a5a3a'); }
      R.rect(40, 250, 400, 6, C.ink2); R.rect(40, 250, 400 * Math.min(1, A.d / A.goal), 6, C.mint); R.text(Math.floor(A.d) + ' / ' + A.goal + ' m', 240, 240, { al: 'c', c: C.cream });
      R.text('两只猫轮流按 ↑ 划桨（交替 + 节奏 = 更快）', 240, 160, { al: 'c', c: C.cream });
    },
    bg: 'water',
  };
  KINDS.photo = { // line both cats up in the frame when the landmark is in view
    pad: true,
    init(A, c) { A.fx = 100; A.fd = 1; A.shots = []; A.pos = [[200, FLOOR], [260, FLOOR]]; A.flash = 0; },
    step(A, c, inp, E) {
      A.fx += A.fd * 40 * DT; if (A.fx < 20 || A.fx > 340) A.fd *= -1;
      for (let i = 0; i < 2; i++) { const n = inp[i] || {}, dx = (n.r ? 1 : 0) - (n.l ? 1 : 0); A.pos[i][0] = clamp(A.pos[i][0] + dx * 70 * DT, 14, 466); A.f[i] = dx || A.f[i]; A.mv[i] = dx ? 1 : 0;
        if (E[i].j || E[i].a) { const inF = A.pos.every(p => p[0] > A.fx + 8 && p[0] < A.fx + 112), lm = (c.target || .5) * 480, onLm = lm > A.fx && lm < A.fx + 120; const sc = (inF ? 2 : 0) + (onLm ? 2 : 0) + (Math.abs(A.pos[0][0] - A.pos[1][0]) < 24 ? 1 : 0); A.shots.push([Math.round(A.fx), sc, A.pos.map(p => Math.round(p[0]))]); A.score += sc; A.flash = .3; A.ev('sfx', 'click'); if (A.shots.length >= (c.n || 4)) A.over = 1; } }
      if (A.flash > 0) A.flash -= DT;
    },
    draw(R, A, c, s) {
      const C = R.C; const cats = [0, 1].map(i => ({ x: A.pos[i][0], y: A.pos[i][1], pose: A.mv[i] ? 'walk' + ((R.t * 10 + i * 3 | 0) % 6) : (Math.abs(A.pos[0][0] - A.pos[1][0]) < 24 ? 'happy1' : 'sit'), flip: A.f[i] < 0 })); R.pair(s, cats);
      R.rect(A.fx, 60, 120, 2, '#fff'); R.rect(A.fx, 248, 120, 2, '#fff'); R.rect(A.fx, 60, 2, 190, '#fff'); R.rect(A.fx + 118, 60, 2, 190, '#fff'); R.text('📷', A.fx + 60, 50, { al: 'c' });
      if (A.flash > 0) R.rect(0, 0, 480, 272, '#fff', A.flash * 2);
      A.shots.forEach((sh, i) => { R.rect(10 + i * 40, 180, 34, 40, '#f4f0e8'); R.rect(13 + i * 40, 183, 28, 26, '#5a7a9a'); R.text('★'.repeat(Math.min(5, sh[1])), 27 + i * 40, 211, { al: 'c', c: '#c8a050', sh: false }); });
      R.text('把两只猫和' + (c.lmName || '地标') + '都框进取景框，按 ↑ 拍照', 240, 30, { al: 'c', c: C.cream });
    },
  };
  // scene wrapper
  SCN.act = {
    w: () => 480, noWalk: true,
    enter(st, arg, cfg) { const c = cfg.acts.find(a => a.id === arg.id) || cfg.acts[0]; st.act = { id: c.id, name: c.name, kind: c.kind, ph: 'intro', t: 0, cd: 0, left: c.time || 45, score: 0, over: 0, f: [1, -1], mv: [0, 0], got: [], seed: (Math.random() * 1000) | 0, pad: !!(KINDS[c.kind] || {}).pad }; (KINDS[c.kind] || KINDS.collect).init(st.act, c.cfg || {}); },
    spots: () => [],
    step(st, inp, cfg, ev, E) {
      const A = st.act, c = cfg.acts.find(a => a.id === A.id), Kd = KINDS[c.kind] || KINDS.collect, cc = c.cfg || {}; Object.defineProperty(A, 'ev', { value: ev, enumerable: false, configurable: true });
      if (A.ph === 'intro') { if (E[0].j || E[1].j || E[0].a || E[1].a) { A.ph = 'count'; A.cd = 3; } return; }
      if (A.ph === 'count') { const before = Math.ceil(A.cd); A.cd -= DT; if (Math.ceil(A.cd) !== before) ev('sfx', A.cd <= 0 ? 'chime' : 'click'); if (A.cd <= 0) A.ph = 'play'; return; }
      if (A.ph === 'play') { A.t += DT; A.left -= DT; Kd.step(A, cc, inp, E); if (A.left <= 0 || A.over) { A.ph = 'end'; const coins = clamp(Math.round(A.score * (c.coinK || 1)), 1, 15); A.coins = coins; K.coins(coins, st, ev); ev('diary', 'activity', { a: c.name, s: A.score }); ev('sfx', 'win'); ev('spark', 240, 120, 'star', 10); } return; }
      if (A.ph === 'end') { if (E[0].d || E[1].d) back(st, cfg, ev); if (E[0].j || E[1].j) SCN.act.enter(st, { id: A.id }, cfg); }
    },
    actx(st, a, who, cfg, ev) {
      const A = st.act; if (!A) return; const c = cfg.acts.find(x => x.id === A.id), Kd = KINDS[c.kind];
      if (a.k === 'actStart' && A.ph === 'intro') { A.ph = 'count'; A.cd = 3; }
      if (a.k === 'actAgain') SCN.act.enter(st, { id: A.id }, cfg);
      if (a.k === 'actLeave') back(st, cfg, ev);
      if (a.k === 'actx' && A.ph === 'play' && Kd.act) { Object.defineProperty(A, 'ev', { value: ev, enumerable: false, configurable: true }); Kd.act(A, c.cfg || {}, a.a, who === 1 ? 1 : 0); }
    },
    snap(st, o) { const A = st.act; o.act = A && JSON.parse(JSON.stringify(A)); if (A && A.pos) o.c = A.pos.map(p => [p[0], p[1]]); },
    draw(R, s, cfg) {
      const C = R.C, A = s.act, c = cfg.acts.find(x => x.id === A.id), Kd = KINDS[c.kind] || KINDS.collect, cc = c.cfg || {}, tod = c.tod || K.tod(s);
      const ar = cfg.areas.find(a => a.id === c.area) || K.area(s, cfg);
      SC.drawView(R, 0, 0, 480, 180, K.view(cfg, c.view || ar.view), { tod, weather: c.wea || s.wea, t: R.t, pan: .5 + Math.sin(R.t * .1) * .2 });
      const gr = cc.ground || (cc.ice ? '#dfeaf4' : '#6a9a5a'); R.rect(0, 150, 480, 122, gr); if (cc.ice) for (let i = 0; i < 30; i++) R.rect(H(i, 1) * 480, 150 + H(i, 2) * 120, 10, 1, '#ffffff');
      if (A.ph === 'play' || A.ph === 'end') Kd.draw(R, A, cc, s, cfg);
      R.topBar(c.name); R.text('⏱ ' + Math.max(0, Math.ceil(A.left)) + '  ★ ' + A.score, 470, 18, { al: 'r', c: C.gold });
      if (A.ph === 'intro') { R.rect(0, 0, 480, 272, '#000', .45); R.panel(100, 40, 280, 180, { title: '怎么玩 · ' + c.name }); R.wrap(c.intro || '', 114, 60, 252, { c: C.cream, lh: 10 }); if (c.real) R.wrap('📍 ' + c.real, 114, 160, 252, { c: C.dim, lh: 8 }); R.btn(190, 196, 100, 18, '开始！(↑)', { k: 'actStart' }, { c: '#3a6a5a' }); }
      if (A.ph === 'count') { const n = Math.ceil(A.cd); R.text(n > 0 ? String(n) : 'GO!', 240, 110, { al: 'c', size: 48, c: C.cream }); }
      if (A.ph === 'end') { R.rect(0, 0, 480, 272, '#000', .4); R.panel(140, 60, 200, 130, { title: '完成！' }); R.text('★ ' + A.score, 240, 86, { al: 'c', size: 24, c: C.gold }); R.text('🪙 +' + A.coins + ' 旅行硬币', 240, 116, { al: 'c', c: C.cream }); R.text(A.score >= (c.good || 8) ? (c.win || '太棒了！两只猫配合满分 ♥') : (c.ok || '不错哦，再来一次？'), 240, 132, { al: 'c', c: C.warm }); R.btn(156, 160, 80, 18, '再来 (↑)', { k: 'actAgain' }); R.btn(244, 160, 80, 18, '离开 (↓)', { k: 'actLeave' }, { c: '#6a3a4a' }); if (Math.random() < .1) R.spark(160 + Math.random() * 160, 70, 'heart'); }
      K.toast(R, s); K.fade(R, s);
    },
  };
  function back(st, cfg, ev) { const r = st.arg.ret || {}; st.act = null; K.go(st, 'street', { area: r.area || st.area, x: r.x }, ev); }
  K.KINDS = KINDS;
})();
