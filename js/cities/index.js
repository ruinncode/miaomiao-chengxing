// ============================================================
//  Cities registry. One config file per city in js/cities/<id>.js,
//  lazy-loaded when the couple travels there. Each file calls
//  Cities.add({...}) — see js/cities/toronto.js for the full schema.
// ============================================================
window.Cities = (function () {
  const LIST = [
    // id, 中文名, local name, country, file, tier (1 = flagship detail)
    ['toronto', '多伦多', 'Toronto', '加拿大', 1], ['waterloo', '滑铁卢', 'Waterloo · Kitchener', '加拿大', 1],
    ['tokyo', '东京', '東京', '日本', 2], ['paris', '巴黎', 'Paris', '法国', 2], ['nyc', '纽约', 'New York', '美国', 2],
    ['boston', '波士顿', 'Boston', '美国', 2], ['vancouver', '温哥华', 'Vancouver', '加拿大', 2], ['london', '伦敦', 'London', '英国', 2],
    ['seoul', '首尔', '서울', '韩国', 2], ['hongkong', '香港', '香港 Hong Kong', '中国香港', 2],
    ['kyoto', '京都', '京都', '日本', 3], ['taipei', '台北', '臺北', '中国台湾', 3], ['shanghai', '上海', '上海', '中国', 3],
    ['singapore', '新加坡', 'Singapore', '新加坡', 3], ['sydney', '悉尼', 'Sydney', '澳大利亚', 3], ['sf', '旧金山', 'San Francisco', '美国', 3],
    ['montreal', '蒙特利尔', 'Montréal', '加拿大', 3], ['amsterdam', '阿姆斯特丹', 'Amsterdam', '荷兰', 3], ['barcelona', '巴塞罗那', 'Barcelona', '西班牙', 3], ['rome', '罗马', 'Roma', '意大利', 3],
  ].map(([id, name, local, country, tier]) => ({ id, name, local, country, tier, file: 'js/cities/' + id + '.js' }));
  const READY = ['toronto', 'waterloo', 'tokyo', 'kyoto', 'paris', 'nyc', 'boston', 'vancouver', 'london', 'seoul', 'hongkong']; LIST.forEach(c => { c.ready = READY.includes(c.id); });
  const DATA = {}, LOADING = {};
  function load(id) {
    if (DATA[id]) return Promise.resolve(DATA[id]);
    const e = LIST.find(c => c.id === id); if (!e) return Promise.reject(new Error('no city ' + id));
    if (!LOADING[id]) LOADING[id] = new Promise((res, rej) => {
      if (typeof document === 'undefined') return rej(new Error('no dom'));
      const s = document.createElement('script'); s.src = e.file + '?v=' + (window.BUILD || 1);
      s.onload = () => DATA[id] ? res(DATA[id]) : rej(new Error('city file did not register ' + id)); s.onerror = () => { delete LOADING[id]; rej(new Error(e.file)); };
      document.head.appendChild(s);
    });
    return LOADING[id];
  }
  // ---- compact builder for tier 2/3 cities -------------------------------------------
  // Stations are strings 'Name|中文@area:x' (an '^' prefix = above ground). Station, hotel,
  // activity and between-area spots are generated; map area pins are placed on the line art.
  function quick(q) {
    const c = Object.assign({ drive: 'R', palette: ['#8a5a4a', '#6a6a7a', '#b8a080', '#5a6a8a', '#9a7a5a'], styles: ['brick', 'glass', 'old'], shops: ['cafe', 'books', 'grocery', 'bakery', 'conv', 'gift', 'flowers'], shopNames: {}, items: {}, taxi: '#e8e8ee', streetSign: { bg: '#2a5a3a', fg: '#fff' }, ann: { next: 'Next station:', arr: 'Arriving at', end: 'Terminus' } }, q);
    c.signs = Object.assign({ welcome: 'Welcome', exit: 'Exit', reception: 'Reception', towards: 'To', boarding: 'Boarding' }, q.signs || {}); c.signs.shop = Object.assign({ cafe: 'Café', books: 'Books', grocery: 'Market', bakery: 'Bakery', ramen: 'Noodles', flowers: 'Flowers', conv: 'Store', bar: 'Bar', gift: 'Gifts', game: 'Games', tea: 'Tea', bank: 'Bank', library: 'Library' }, (q.signs || {}).shop || {});
    c.lines = q.lines.map(l => { const under = l.under != null ? l.under : !['streetcar', 'lrt', 'bilevel', 'shinkansen', 'heritage', 'tram'].includes(l.car);
      return Object.assign({ body: '#e4e4ea', text: '#fff', sign: '#1a1c24', car: 'subway' }, l, { st: undefined, stations: l.st.map(raw => {
        let r = raw, up = false; if (r[0] === '^') { up = true; r = r.slice(1); } const [nz, loc] = r.split('@'); const [n, zh] = nz.split('|'); const o = { n, zh, under: under && !up };
        if (loc) { const [a, x, city] = loc.split(':'); o.area = a; o.x = +x; if (city) o.city = city; } return o; }) }); });
    const areaIds = c.areas.map(a => a.id);
    c.areas = c.areas.map((a, ai) => {
      const len = (a.street && a.street.len) || 7, W = len * 240, sp = (a.spots || []).slice();
      const has = (k, f) => sp.some(p => p.k === k && f(p));
      for (const l of c.lines) for (const s of l.stations) if (s.area === a.id && !s.city && !has('station', p => p.line === l.id && p.stn === s.n)) sp.push({ id: 's' + l.id + s.x, k: l.car === 'streetcar' || l.car === 'tram' ? 'tram' : 'station', x: s.x, line: l.id, stn: s.n, name: s.n + ' · ' + (l.short || l.name) });
      for (const h of c.hotels) if (h.area === a.id) sp.push({ id: 'h' + h.id, k: 'hotel', x: h.x, h: h.id, name: h.name, fw: 50, color: h.color || '#7a8a9a' });
      for (const ac of c.acts) if (ac.area === a.id && ac.x != null) sp.push({ id: 'a' + ac.id, k: 'act', x: ac.x, act: ac.id, icon: ac.icon || 'star', name: ac.spot || ac.name });
      if (a.bench != null) sp.push({ id: 'b' + ai, k: 'cuddle', kind: 'bench', x: a.bench, y: 230, name: a.benchName || '长椅' });
      if (a.sign) sp.push({ id: 'sg' + ai, k: 'sign', x: a.sign[0], text: a.sign[1] });
      if (a.lib) sp.push({ id: 'lib' + ai, k: 'study', kind: a.lib[2] || 'library', x: a.lib[0], name: a.lib[1], fw: 40, color: '#6a5a4a' });
      const nx = c.areas[ai + 1], pv = c.areas[ai - 1];
      if (nx && !has('go', p => p.area === nx.id)) sp.push({ id: 'gn', k: 'go', x: W - 50, area: nx.id, tx: 120, dir: 1, short: nx.name, name: '往前走 → ' + nx.name });
      if (pv && !has('go', p => p.area === pv.id)) sp.push({ id: 'gp', k: 'go', x: 50, area: pv.id, tx: ((pv.street && pv.street.len) || 7) * 240 - 120, dir: -1, short: pv.name, name: '← ' + pv.name });
      return Object.assign({}, a, { spots: sp, street: Object.assign({ len, seed: 7 + ai * 11 }, a.street || {}) });
    });
    c.routes = (q.routes || []).map(r => Array.isArray(r) ? { name: r[0], desc: r[1], legs: r[2] } : r);
    c.acts = c.acts.map(a => Object.assign({ time: 40, good: 12, tod: 'day', view: (c.areas.find(x => x.id === a.area) || c.areas[0]).view }, a));
    c.hotels = c.hotels.map(h => Object.assign({ bed: 'double', floor: 8, lobby: { wall: '#d8d4cc', uniform: '#2a3a5a' }, hall: { wall: '#c8c4bc', carpet: '#4a4a6a', door: '#5a4a3a' } }, h));
    // map: area pins sit on the line art at their station's position
    const m = c.map = Object.assign({ land: '#d8dccc', water: [], parks: [], roads: [], labels: [] }, q.map || {}); const ml = {}; m.areas = Object.assign({}, m.areas || {});
    for (const l of c.lines) { const pts = (q.map && q.map.lines && q.map.lines[l.id]) || null; if (!pts) continue;
      const seg = [0]; for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      const at = f => { const d = f * seg[seg.length - 1]; let i = 1; while (i < seg.length - 1 && seg[i] < d) i++; const k = (d - seg[i - 1]) / ((seg[i] - seg[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; };
      const N = l.stations.length; const out = pts.map(p => p.slice(0, 2)); out[0][2] = l.stations[0].zh || l.stations[0].n; out[out.length - 1][2] = l.stations[N - 1].zh || l.stations[N - 1].n; ml[l.id] = out;
      l.stations.forEach((s, i) => { if (s.area && !s.city && !m.areas[s.area]) { const p = at(N > 1 ? i / (N - 1) : 0); m.areas[s.area] = [Math.round(p[0]), Math.round(p[1])]; } }); }
    m.lines = ml; for (const a of c.areas) if (!m.areas[a.id]) m.areas[a.id] = [50, 50];
    return add(c);
  }
  function add(cfg) { const e = LIST.find(c => c.id === cfg.id); DATA[cfg.id] = Object.assign({ tier: e ? e.tier : 3 }, cfg); return DATA[cfg.id]; }
  return {
    LIST, load, quick,
    add,
    get(id) { return DATA[id] || null; },
    meta(id) { return LIST.find(c => c.id === id); },
  };
})();
