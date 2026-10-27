// ============================================================
//  旅行日记 — scrapbook of moments (hugs, cuddles, goodnights,
//  arrivals, rides, activities…), the per-city bucket list,
//  heart achievements, souvenirs and travel coins.
//  Reads this device's localStorage (Diary / Bucket / Wallet);
//  page & tab are local UI state, so each player can browse alone.
// ============================================================
(function () {
  const L = { tab: 0, pg: 0, city: null };
  const KIND = {
    hug: ['🤗', '抱抱'], hugtravel: ['🤗', '旅途中抱抱'], cuddle: ['💤', '一起窝着'], paws: ['🐾', '牵爪爪'], pawswalk: ['🐾', '牵着爪散了好久的步'], nuzzle: ['😽', '蹭蹭'],
    goodnight: ['🌙', '说了晚安'], checkin: ['🛎', '办理入住'], activity: ['📸', '活动'], route: ['🚇', '走完一条路线'], bought: ['🎁', '买了东西'], study: ['🍅', '一起学习'],
    arrive: ['✈', '抵达'], pack: ['🧳', '收拾行李'], door: ['🚪', '选了一扇门'], morning: ['☀', '新的一天'],
  };
  function label(p) {
    const k = KIND[p.k] || ['✦', p.k], x = p.x || {};
    const extra = x.a || x.r || x.d || x.c || x.item || (x.min ? x.min + ' 分钟' : '') || '';
    return [k[0], k[1] + (extra ? '：' + extra : '')];
  }
  const fmtD = (t) => { const d = new Date(t); return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const TABS = ['剪贴簿', '心愿清单', '成就', '纪念品'];
  const M = {
    music: () => 'study',
    create(arg) { return { sc: 'diary', t: 0, c: [null, null], place: arg.place || '' }; },
    act() {}, step(st) { st.t += 1 / 60; },
    snap(st) { return { sc: 'diary', t: Math.round(st.t * 10) / 10, c: [null, null], place: st.place }; },
    draw(R, s) {
      const C = R.C, d = Diary.data;
      R.rect(0, 0, 480, 272, '#3a2a24'); R.rect(16, 20, 448, 244, '#7a4a3a'); R.rect(20, 24, 440, 236, '#f4ead8'); R.rect(238, 24, 4, 236, '#e0d4bc');
      for (let y = 40; y < 260; y += 12) { R.rect(24, y, 212, 1, '#e8dcc4'); R.rect(244, y, 212, 1, '#e8dcc4'); }
      TABS.forEach((t, i) => R.btn(28 + i * 74, 28, 70, 14, t, () => { L.tab = i; L.pg = 0; }, { c: L.tab === i ? '#c8566a' : '#8a6a5a' }));
      R.text('🪙 ' + Wallet.coins, 452, 30, { al: 'r', c: '#8a6a2a', sh: false });
      const ink = '#4a3a2a';
      if (L.tab === 0) {
        const P = d.pages.slice().reverse(), per = 8, pages = Math.max(1, Math.ceil(P.length / per)); L.pg = Math.min(L.pg, pages - 1);
        if (!P.length) R.text('还没有记录～ 去抱抱、窝着、旅行吧 ♥', 240, 130, { al: 'c', c: ink, sh: false });
        P.slice(L.pg * per, L.pg * per + per).forEach((p, i) => {
          const col = i % 2, row = i / 2 | 0, x = 30 + col * 214 + (row % 2) * 4, y = 50 + row * 50, [ic, tx] = label(p), tilt = ((i * 7) % 3) - 1;
          R.rect(x + 2, y + 2, 196, 44, '#000', .08); R.rect(x, y + tilt, 196, 44, '#fffaf0'); R.rect(x + 4, y + 4 + tilt, 36, 36, ['#ffd6e6', '#d6ecff', '#e6ffd6', '#fff0c8'][i % 4]);
          R.text(ic, x + 22, y + 12 + tilt, { al: 'c', size: 24 });
          let t = tx; while (t.length > 2 && R.tw(t) > 148) t = t.slice(0, -1); R.text(t === tx ? t : t + '…', x + 46, y + 7 + tilt, { c: ink, sh: false });
          R.text((p.p || '我们的小屋').slice(0, 14), x + 46, y + 20 + tilt, { c: '#8a6a5a', sh: false }); R.text(fmtD(p.t), x + 46, y + 31 + tilt, { c: '#a89070', sh: false });
          R.rect(x + 80, y - 3 + tilt, 30, 6, '#e8c86a', .7);
        });
        R.text((L.pg + 1) + ' / ' + pages + ' 页 · 共 ' + P.length + ' 个瞬间', 240, 252, { al: 'c', c: '#8a6a5a', sh: false });
        if (pages > 1) { R.btn(30, 248, 40, 12, '◀', () => { L.pg = (L.pg + pages - 1) % pages; }, { c: '#8a6a5a' }); R.btn(410, 248, 40, 12, '▶', () => { L.pg = (L.pg + 1) % pages; }, { c: '#8a6a5a' }); }
      } else if (L.tab === 1) {
        const list = (window.Cities ? Cities.LIST.filter(c => c.ready) : []);
        list.forEach((c, i) => { const pr = (window.Bucket && Bucket.progress(c.id)) || [0, 0], y = 50 + i * 16, on = L.city === c.id || (!L.city && i === 0);
          R.btn(28, y, 204, 14, '', () => { L.city = c.id; Cities.load(c.id).catch(() => {}); }, { c: on ? '#c8566a' : '#b89a8a' });
          R.text(c.name, 34, y + 2, { c: '#fff', sh: false }); const tot = pr[1] || 1; R.rect(110, y + 4, 90, 5, '#7a5a4a'); R.rect(110, y + 4, 90 * pr[0] / tot, 5, '#ffd36a'); R.text(pr[0] + (pr[1] ? '/' + pr[1] : ''), 228, y + 2, { al: 'r', c: '#fff', sh: false }); });
        const id = L.city || (list[0] && list[0].id), cfg = id && Cities.get(id);
        if (id && !cfg) Cities.load(id).catch(() => {});
        if (cfg && window.Bucket) { const b = Bucket.of(id); R.text(cfg.name + ' 心愿清单', 250, 48, { c: '#c8566a', sh: false }); Bucket.items(cfg).slice(0, 17).forEach(([k, n], j) => { let t = n; while (t.length > 2 && R.tw(t) > 180) t = t.slice(0, -1); R.text((b[k] ? '☑ ' : '☐ ') + t, 252, 62 + j * 11.5, { c: b[k] ? '#3a8a5a' : ink, sh: false }); }); }
        else R.text('先去旅行吧 ✈', 340, 120, { al: 'c', c: ink, sh: false });
      } else if (L.tab === 2) {
        Diary.ACH.forEach((a, i) => { const got = d.ach[a.id], x = 30 + (i % 2) * 214, y = 50 + (i / 2 | 0) * 26;
          R.rect(x, y, 200, 22, got ? '#ffe0ea' : '#ece2d0'); R.heart(x + 6, y + 8, 1, got ? C.pink : '#c8b8a8'); R.text(a.name, x + 20, y + 3, { c: got ? '#8a2a4a' : '#a89888', sh: false }); R.text(got ? fmtD(got) : '未解锁', x + 20, y + 12, { c: '#a89070', sh: false }); });
        const n = d.n || {}; R.text('抱抱 ' + (n.hug || 0) + ' · 窝着 ' + (n.cuddle || 0) + ' · 晚安 ' + (n.goodnight || 0) + ' · 去过 ' + Object.keys(d.cities || {}).length + ' 城', 240, 252, { al: 'c', c: '#8a6a5a', sh: false });
      } else {
        const w = Wallet.data; R.text('纪念品', 30, 48, { c: '#c8566a', sh: false });
        if (!w.souv.length) R.text('在城市的礼品店、书店、花店买点东西吧', 30, 64, { c: ink, sh: false });
        w.souv.slice(-30).forEach(([n], i) => { const x = 30 + (i % 2) * 214, y = 62 + (i / 2 | 0) * 13; let t = n; while (t.length > 2 && R.tw(t) > 200) t = t.slice(0, -1); R.text('🎁 ' + t, x, y, { c: ink, sh: false }); });
        R.text('旅行硬币 🪙 ' + w.coins + ' · 做活动、走完路线、玩掌机都能赚', 240, 252, { al: 'c', c: '#8a6a5a', sh: false });
      }
      R.topBar('旅行日记');
    },
  };
  Hub.mode('diary', M);
})();
