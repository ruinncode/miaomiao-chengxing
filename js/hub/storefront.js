// ============================================================
//  Storefront — reusable pixel storefront renderer for the real streets.
//  Each shop gets a style (facade material, sign band, awning, window grid, door,
//  window display, sidewalk props) from js/cities/<city>-shops.js, falling back to
//  a default per shop kind. All staff and customers are cats. No logos: the sign
//  text is drawn live by travel.js (Storefront.sign) in the brand colours.
//  Chunk coordinates: sign band 184–194, openings 196–228, base 228–232, sidewalk 232+.
// ============================================================
window.Storefront = (function () {
  const SC = window.Scenery, mix = SC.mix, hash = SC.hash;
  const Y0 = 183, YS = 184, YS1 = 194, YO = 196, YB = 228, YG = 232;
  // kind defaults (shop / amenity tag) — approximate by definition
  const KIND = {
    _: { fac: 'glass', band: '#2a2a33', tc: '#f4f0e6', win: 'full', door: 'r', props: ['shelves'], in: '#e4ded2', glow: '#ffd88a' },
    cafe: { props: ['menu', 'counter', 'cups'], in: '#c8a880', glow: '#ffcf8a', out: ['board'] },
    restaurant: { props: ['tables', 'tables'], in: '#8a6a50', glow: '#ffbe6a', out: ['planter'] },
    fast_food: { props: ['menu', 'counter'], in: '#ece4d4', glow: '#ffe8b0' },
    bar: { props: ['bar', 'tables'], in: '#4a3426', glow: '#ffb050' }, pub: { props: ['bar', 'tables'], in: '#4a3426', glow: '#ffb050' },
    bank: { props: ['atm', 'desk'], in: '#eceae6', glow: '#f4f8ff' },
    supermarket: { props: ['shelves', 'produce'], out: ['crates'] }, convenience: { props: ['shelves'] }, deli: { props: ['jars'] },
    clothes: { props: ['mannequin', 'hangers'] }, shoes: { props: ['shoes'] }, jewelry: { props: ['jewels'] }, beauty: { props: ['shelves', 'plant'] }, hairdresser: { props: ['barber'] },
    alcohol: { props: ['bottles', 'wine'] }, wine: { props: ['wine'] }, florist: { props: ['flowers'], out: ['buckets'] }, bakery: { props: ['pastry', 'bread'] }, ice_cream: { props: ['counter'] },
    cannabis: { win: 'frost', props: [] }, fitness_centre: { win: 'frost', props: ['weights'] }, mobile_phone: { props: ['phones'] }, computer: { props: ['screens'] },
    furniture: { props: ['sofa', 'lamp'] }, stationery: { props: ['shelves'] }, dry_cleaning: { props: ['racks'] }, travel_agency: { props: ['posters'] }, ticket: { props: ['posters'] },
    newsagent: { props: ['shelves'] },
  };
  const AREA = { distillery: { fac: 'heritage', sign: 'plaque' } };
  const FAC = { glass: '#2e3238', metal: '#2e3238', brick: '#9a4a3a', heritage: '#8e4634', stone: '#cfc4ae', wood: '#3a4a3a', concrete: '#a8a49c', inset: null, none: null };
  const COAT = ['#1e1e24', '#e08a3a', '#8a8a94', '#f2eee6', '#8a6040', '#e8d0a0', '#5a5a64'];
  function data() { return (window.MM_SHOPSTYLE && window.MM_SHOPSTYLE.toronto) || { brand: {}, shops: {} }; }
  function style(s, area) {
    if (s._st) return s._st;
    const D = data(), B = D.brand || {};
    let br = null; for (const n in B) if ((s.n || '').startsWith(n)) { br = B[n]; break; }
    const k = KIND[s.k] || {}, ar = AREA[area] || {};
    const st = Object.assign({}, KIND._, k, br ? {} : ar, br || {}, (D.shops || {})[s.osm] || {});
    if (st.fac === 'heritage' && !st.sign) st.sign = 'plaque';
    if (!st.sign) st.sign = 'band';
    if (st.fc == null) st.fc = FAC[st.fac];
    if (s.sb && !br && !(D.shops || {})[s.osm]) { st.band = s.sb; st.tc = s.sf || st.tc; }
    return (s._st = st);
  }
  function geom(s, st) { // door + window spans in scene px (absolute x)
    const x = s.sx, w = s.sw, pw = st.fac === 'heritage' ? 3 : st.fac === 'inset' ? 1 : 2;
    const dw = st.door === '2' ? 12 : w >= 28 ? 8 : 6;
    let dx = st.door === 'l' ? x + pw + 1 : st.door === 'c' || st.door === '2' ? Math.round(x + (w - dw) / 2) : x + w - pw - dw - 1;
    if (w < 16) dx = x + w - pw - dw;
    const spans = [[x + pw, dx - 1], [dx + dw + 1, x + w - pw]].filter(([a, b]) => b - a >= 4);
    return { x, w, pw, dx, dw, spans };
  }
  // ---- tiny cats (staff + customers) ----
  function cat(p, x, y, c, apron, night) { // 5×7 sitting cat, y = top of ears
    const e = mix(c, '#000', .25);
    p.px(x, y, c); p.px(x + 3, y, c); p.r(x, y + 1, 4, 3, c); p.px(x + 1, y + 2, night ? '#ffe680' : e); p.px(x + 2, y + 2, night ? '#ffe680' : e);
    p.r(x - 1, y + 4, 6, 3, apron || c); if (!apron) p.px(x + 5, y + 5, c);
  }
  // ---- window displays: (p, x0, x1, top, bot, st, E) ----
  const PROP = {
    counter(p, a, b, t, d, st, E) { const y = d - 7; cat(p, ((a + b) >> 1) - 2, y - 6, COAT[(E.seed * 7 | 0) % COAT.length], st.band, E.night); p.r(a, y, b - a, 7, mix(st.in, '#3a2418', .55)); p.r(a, y, b - a, 1, mix(st.in, '#fff', .3)); },
    cups(p, a, b, t, d, st) { for (let x = a + 1; x < b - 2; x += 4) { p.r(x, d - 10, 2, 3, '#f4f0e6'); p.px(x, d - 11, st.band); } },
    menu(p, a, b, t, d, st, E) { for (let x = a + 1; x < b - 6; x += 9) { p.r(x, t + 1, 7, 5, '#1e1e22'); for (let yy = t + 2; yy < t + 6; yy += 2) p.r(x + 1, yy, 5, 1, E.night ? '#fff4c0' : '#d8d4c8'); } },
    pastry(p, a, b, t, d, st) { const y = d - 8; p.r(a, y, b - a, 8, '#c8d8e0'); p.r(a, y, b - a, 1, '#ffffff'); for (let x = a + 1; x < b - 2; x += 3) p.r(x, y + 3, 2, 2, ['#c8843a', '#e8c070', '#7a4a2a', '#f0e0b0'][x % 4]); p.r(a, d - 2, b - a, 2, '#5a3a26'); },
    donuts(p, a, b, t, d, st) { for (let yy = t + 8; yy < d - 9; yy += 4) { p.r(a, yy + 2, b - a, 1, '#8a5a3a'); for (let x = a + 1; x < b - 3; x += 4) { const c = ['#7a4426', '#e8c070', '#f4ecd8', '#c8843a'][(x + yy) % 4]; p.r(x, yy, 3, 2, c); p.px(x + 1, yy, mix(c, '#000', .3)); } } },
    shelves(p, a, b, t, d, st, E) { for (let yy = t + 4; yy < d - 2; yy += 6) { p.r(a, yy + 4, b - a, 1, '#7a6a5a'); for (let x = a; x < b - 1; x += 2) p.r(x, yy + 1 + (hash(x, yy) * 2 | 0), 2, 3 - (hash(x, yy) * 2 | 0), ['#d84a3a', '#3a7ad8', '#e8c040', '#4aa85a', '#f0ece4', '#8a5ad0'][(hash(x + E.seed * 9, yy) * 6) | 0]); } },
    produce(p, a, b, t, d) { const y = d - 6; p.r(a, y, b - a, 6, '#8a6a44'); for (let x = a + 1; x < b - 1; x += 2) p.px(x, y + 1 + (x & 1), ['#d83a2a', '#4aa83a', '#f0a020', '#e8d040'][((x >> 1) + 3) % 4]); p.r(a, y + 3, b - a, 1, '#6a4a2a'); },
    bottles(p, a, b, t, d) { for (let yy = t + 4; yy < d - 2; yy += 7) { p.r(a, yy + 5, b - a, 1, '#6a5a4a'); for (let x = a + 1; x < b - 1; x += 2) { const c = ['#2a6a3a', '#6a3a1a', '#c8d8c0', '#3a2a4a', '#a8781a'][(x * 3 + yy) % 5]; p.r(x, yy + 1, 1, 4, c); p.px(x, yy, mix(c, '#000', .3)); } } },
    wine(p, a, b, t, d) { for (let yy = t + 4; yy < d - 2; yy += 3) for (let x = a + 1; x < b - 1; x += 3) { p.r(x, yy, 2, 1, (x + yy) % 3 ? '#3a1a22' : '#2a4a2a'); } p.r(a, d - 2, b - a, 2, '#5a3a26'); },
    hangers(p, a, b, t, d, st, E) { p.r(a, t + 4, b - a, 1, '#6a6a70'); for (let x = a + 1; x < b - 2; x += 3) p.r(x, t + 5, 2, 9 + (x % 3), ['#2a3a6a', '#d8d0c0', '#3a3a3a', '#b8783a', '#4a7a5a', '#8a2a2a'][(hash(x, E.seed * 5) * 6) | 0]); },
    mannequin(p, a, b, t, d, st, E) { const x = ((a + b) >> 1) - 2, y = d - 18; p.px(x, y, '#e8e2d8'); p.px(x + 3, y, '#e8e2d8'); p.r(x, y + 1, 4, 3, '#e8e2d8'); p.r(x - 1, y + 4, 6, 9, ['#2a3a5a', '#3a3a3a', '#6a4a2a'][(E.seed * 3 | 0) % 3]); p.r(x + 1, y + 13, 1, 4, '#5a5a60'); p.r(x - 1, d - 1, 6, 1, '#5a5a60'); },
    jewels(p, a, b, t, d, st, E) { for (let x = a + 1; x < b - 4; x += 7) { p.r(x, d - 9, 5, 9, '#2a2a30'); p.r(x, d - 9, 5, 1, '#5a5a66'); p.px(x + 2, d - 11, '#ffffff'); p.px(x + 1, d - 12, E.night ? '#fff8c0' : '#c8e0ff'); p.px(x + 3, d - 12, '#e8c860'); } },
    flowers(p, a, b, t, d) { for (let x = a + 1; x < b - 2; x += 4) { p.r(x, d - 5, 3, 5, '#3a4a5a'); for (let k = 0; k < 4; k++) p.px(x + (k % 3), d - 7 - (k >> 1), ['#e8d040', '#d84a3a', '#f0f0f0', '#8a5ad0'][(x + k) % 4]); p.px(x + 1, d - 6, '#3a8a3a'); } },
    phones(p, a, b, t, d, st, E) { const y = d - 7; p.r(a + 1, y, b - a - 2, 2, '#d8d8dc'); p.r(a + 2, y + 2, 1, 5, '#a8a8b0'); p.r(b - 3, y + 2, 1, 5, '#a8a8b0'); for (let x = a + 2; x < b - 3; x += 4) { p.r(x, y - 3, 2, 3, '#1a1a22'); p.px(x, y - 3, E.night ? '#a8d8ff' : '#5a8ab8'); } },
    screens(p, a, b, t, d, st, E) { for (let x = a + 1; x < b - 6; x += 8) { p.r(x, t + 5, 6, 5, '#1a1a22'); p.r(x + 1, t + 6, 4, 3, E.night ? '#8ac8ff' : '#4a7aa8'); } PROP.counter(p, a, b, t, d, st, E); },
    atm(p, a, b, t, d, st, E) { const x = a + 1; p.r(x, d - 16, 6, 16, '#5a5e66'); p.r(x + 1, d - 14, 4, 3, E.night ? '#9ae8ff' : '#3a7a9a'); p.r(x + 1, d - 9, 4, 1, '#2a2a30'); p.r(x, d - 17, 6, 1, st.band); },
    desk(p, a, b, t, d, st, E) { const x = Math.max(a + 9, b - 14); if (x + 10 > b) return; cat(p, x + 3, d - 13, COAT[(E.seed * 5 | 0) % COAT.length], st.band, E.night); p.r(x, d - 6, 11, 2, '#8a6a4a'); p.r(x + 1, d - 4, 1, 4, '#6a4a2a'); p.r(x + 9, d - 4, 1, 4, '#6a4a2a'); },
    plant(p, a, b, t, d) { const x = b - 5; p.r(x, d - 4, 4, 4, '#a86a3a'); p.r(x - 1, d - 9, 6, 5, '#3a7a3a'); p.px(x + 1, d - 10, '#4a9a4a'); },
    tables(p, a, b, t, d, st, E) { for (let x = a + 2, k = 0; x < b - 8; x += 11, k++) { p.r(x, d - 8, 8, 1, '#3a2a1e'); p.r(x + 3, d - 7, 2, 7, '#3a2a1e'); if (hash(x, E.seed * 13) < .75) cat(p, x - 1, d - 13, COAT[(hash(x, 3) * COAT.length) | 0], null, E.night); p.px(x + 6, d - 9, '#f4f0e6'); } if (E.night || st.glow) for (let x = a + 4; x < b - 2; x += 11) { p.r(x, t, 1, 3, '#2a2a2a'); p.r(x - 1, t + 3, 3, 1, E.night ? '#fff0a0' : '#c8a060'); } },
    bar(p, a, b, t, d, st, E) { for (let x = a + 1; x < b - 1; x += 2) p.r(x, t + 4, 1, 3, ['#a8781a', '#2a6a3a', '#c8d8c0', '#6a3a1a'][x % 4]); p.r(a, t + 7, b - a, 1, '#5a3a26'); cat(p, ((a + b) >> 1) - 2, d - 16, COAT[(E.seed * 11 | 0) % COAT.length], '#1a1a1a', E.night); p.r(a, d - 9, b - a, 9, '#4a2a18'); p.r(a, d - 9, b - a, 1, '#a8784a'); for (let x = a + 3; x < b - 2; x += 6) { p.r(x, d - 12, 1, 3, '#d8d8d8'); } },
    kettle(p, a, b, t, d, st, E) { const cx = (a + b) >> 1; p.circ(cx, d - 9, Math.min(6, (b - a) / 2 - 1 | 0), '#b8703a'); p.r(cx - 1, t + 3, 2, d - t - 16, '#8a5a2a'); p.px(cx - 2, d - 12, '#f0b070'); p.px(cx - 3, d - 10, '#e8a060'); p.r(cx - 5, d - 2, 11, 2, '#5a3a26'); },
    socks(p, a, b, t, d) { for (let x = a + 1; x < b - 1; x += 2) for (let yy = t + 3; yy < d - 4; yy += 7) { const c = ['#e8c040', '#3a7ad8', '#d84a3a', '#4aa85a', '#8a5ad0', '#f0a030'][(x + yy) % 6]; p.r(x, yy, 1, 4, c); p.px(x + 1, yy + 3, c); } },
    barber(p, a, b, t, d, st, E) { const x = a + 2; p.r(x, t + 3, Math.min(10, b - a - 4), 8, '#c8d8e0'); p.r(x + 1, t + 4, Math.min(8, b - a - 6), 6, '#e8f0f4'); p.r(x + 1, d - 7, 7, 2, '#8a2a2a'); p.r(x + 2, d - 5, 1, 5, '#5a5a60'); cat(p, x + 3, d - 13, COAT[2], null, E.night); },
    racks(p, a, b, t, d) { p.r(a, t + 4, b - a, 1, '#8a8a90'); for (let x = a + 1; x < b - 2; x += 3) { p.r(x, t + 5, 2, 12, '#e8eef2'); p.px(x, t + 5, '#a8b0b8'); } },
    posters(p, a, b, t, d, st, E) { for (let x = a + 1; x < b - 5; x += 7) { p.r(x, t + 3, 5, 7, '#f4f0e6'); p.r(x + 1, t + 4, 3, 3, ['#3a8ad8', '#e8a030', '#3aa86a'][x % 3]); p.r(x + 1, t + 8, 3, 1, '#1e5a8a'); } PROP.counter(p, a, b, t, d, st, E); },
    bags(p, a, b, t, d) { p.r(a, d - 3, b - a, 3, '#5a3a26'); for (let x = a + 2; x < b - 5; x += 7) { p.r(x, d - 8, 5, 5, ['#7a4a26', '#3a2418', '#a8683a'][x % 3]); p.r(x + 1, d - 10, 3, 1, '#3a2418'); p.px(x + 1, d - 9, '#3a2418'); p.px(x + 3, d - 9, '#3a2418'); } },
    jars(p, a, b, t, d) { for (let yy = t + 4; yy < d - 2; yy += 6) { p.r(a, yy + 4, b - a, 1, '#6a5a4a'); for (let x = a + 1; x < b - 2; x += 3) { p.r(x, yy + 1, 2, 3, ['#c8a020', '#5a7a2a', '#7a2a1a', '#d8c890'][(x + yy) % 4]); p.px(x, yy, '#c8c8c8'); } } },
    shoes(p, a, b, t, d) { for (let yy = t + 5; yy < d - 2; yy += 6) { p.r(a, yy + 3, b - a, 1, '#d8d0c4'); for (let x = a + 1; x < b - 3; x += 5) { const c = ['#1a1a1a', '#7a4a26', '#e8e4dc', '#3a3a5a'][(x + yy) % 4]; p.r(x, yy + 1, 3, 2, c); p.px(x, yy, c); } } },
    caps(p, a, b, t, d) { for (let yy = t + 3; yy < d - 2; yy += 5) for (let x = a + 1; x < b - 2; x += 4) { const c = ['#1a3a8a', '#c8202a', '#1a1a1a', '#e8a020', '#2a7a3a'][(x * 7 + yy) % 5]; p.r(x, yy, 3, 2, c); p.px(x + 3, yy + 1, c); } },
    sofa(p, a, b, t, d) { const w = Math.min(16, b - a - 2), x = a + 1; p.r(x, d - 7, w, 5, '#7a8a8a'); p.r(x, d - 9, 2, 7, '#6a7a7a'); p.r(x + w - 2, d - 9, 2, 7, '#6a7a7a'); p.r(x + 2, d - 8, w - 4, 1, '#e8c040'); p.r(x, d - 2, w, 2, '#c8b89a'); },
    lamp(p, a, b, t, d, st, E) { const x = b - 4; p.r(x, d - 14, 1, 14, '#2a2a2a'); p.r(x - 2, d - 17, 5, 3, E.night ? '#fff0b0' : '#e8dcc0'); },
    weights(p, a, b, t, d) { for (let x = a + 2; x < b - 5; x += 7) { p.r(x, d - 4, 5, 1, '#5a5a60'); p.r(x, d - 6, 1, 4, '#1a1a1a'); p.r(x + 4, d - 6, 1, 4, '#1a1a1a'); } },
    chicken(p, a, b, t, d) { const y = d - 10; for (let x = a + 1; x < b - 4; x += 6) { p.r(x, y, 4, 3, '#c8782a'); p.r(x, y + 3, 4, 1, '#c8202a'); } },
    pizza(p, a, b, t, d, st, E) { const x = a + 1, w = Math.min(14, b - a - 2); p.r(x, t + 5, w, d - t - 7, '#8a5a3a'); p.r(x + 2, t + 8, w - 4, 6, '#1a0e08'); p.r(x + 3, t + 11, w - 6, 3, E.night ? '#ffb040' : '#e87a2a'); p.px(x + 4, t + 10, '#ffd060'); },
    lanterns(p, a, b, t, d, st, E) { for (let x = a + 2; x < b - 3; x += 7) { p.r(x + 1, t, 1, 2, '#2a2a2a'); p.r(x, t + 2, 3, 4, E.night ? '#ff6a4a' : '#d83a2a'); p.r(x, t + 3, 3, 1, '#ffd080'); } PROP.counter(p, a, b, t, d, st, E); },
    bread(p, a, b, t, d) { for (let x = a + 1; x < b - 4; x += 5) { p.r(x, d - 12, 4, 2, '#c8843a'); p.px(x + 1, d - 12, '#e8b060'); } },
  };
  // ---- the storefront (static, cached in the chunk layer) ----
  function draw(p, s, ox, E) {
    const st = style(s, E.area); if (st.fac === 'none') return;
    const G = geom(s, st), x = G.x - ox, w = G.w, tn = E.tn, night = E.night, k = E.k; // k = tone mix
    const T = (c, kk = k) => mix(c, tn.near, kk);
    const fc = st.fc ? T(st.fc) : null, fdk = fc && mix(fc, '#000', .25), fhi = fc && mix(fc, '#fff', .2);
    const awn = st.awn && st.awn !== 'none', topO = awn ? YO + 6 : YO + 2;
    // facade surround + material
    if (fc) {
      p.r(x, Y0, w, YG - Y0, fc);
      if (st.fac === 'brick' || st.fac === 'heritage') { for (let yy = Y0 + 1; yy < YG; yy += 3) { p.r(x, yy, w, 1, mix(fc, '#000', .1)); for (let xx = x + ((yy / 3 | 0) % 2) * 3; xx < x + w; xx += 6) p.px(xx, yy + 1, mix(fc, '#000', .12)); } }
      else if (st.fac === 'stone') { for (let yy = Y0 + 4; yy < YG; yy += 5) p.r(x, yy, w, 1, mix(fc, '#000', .1)); }
      else if (st.fac === 'wood') { for (let xx = x + 2; xx < x + w; xx += 4) p.r(xx, Y0, 1, YG - Y0, mix(fc, '#000', .15)); }
      else if (st.fac === 'concrete') { for (let yy = Y0; yy < YG; yy += 2) for (let xx = x + (yy & 2) / 2; xx < x + w; xx += 3) p.px(xx, yy, mix(fc, '#fff', .08)); }
      p.r(x, Y0, 1, YG - Y0, fhi); p.r(x + w - 1, Y0, 1, YG - Y0, fdk);
    }
    // sign band / plaque (text drawn live)
    const sb = sign(s, E.area), bandC = T(st.band, night ? .2 : k * .6);
    if (sb.kind === 'band') { p.r(sb.x - ox, sb.y, sb.w, sb.h, bandC); p.r(sb.x - ox, sb.y, sb.w, 1, mix(bandC, '#fff', .22)); p.r(sb.x - ox, sb.y + sb.h - 1, sb.w, 1, mix(bandC, '#000', .3)); if (st.pin) p.r(sb.x - ox, sb.y + sb.h, sb.w, 1, T(st.pin)); }
    else if (sb.kind === 'plaque') { p.r(sb.x - ox - 1, sb.y - 1, sb.w + 2, sb.h + 2, '#c8a860'); p.r(sb.x - ox, sb.y, sb.w, sb.h, bandC);
      for (const lx of [sb.x - ox + 2, sb.x - ox + sb.w - 3]) { p.r(lx, sb.y - 4, 1, 3, '#1a1a1a'); p.r(lx - 1, sb.y - 4, 3, 1, '#1a1a1a'); p.r(lx - 1, sb.y - 3, 3, 1, night ? '#fff0b0' : '#3a3a3a'); } } // gooseneck lamps
    // openings
    const inC = night ? st.glow : E.tod === 'golden' || E.tod === 'dawn' ? mix(st.in, st.glow, .4) : st.in;
    for (const [a0, b0] of G.spans) {
      const a = a0 - ox, b = b0 - ox, frame = fc ? mix(fdk, '#1a1a1e', .4) : '#2a2a30';
      const arch = st.win === 'arch', high = st.win === 'high';
      const t = topO, bot = high ? YB - 6 : YB;
      p.r(a, t, b - a, bot - t, inC);
      if (st.win === 'frost') { p.r(a, t, b - a, bot - t, night ? mix(st.glow, '#ffffff', .3) : '#d8dee4'); p.r(a, t + 4, b - a, 2, st.band); }
      else { const E2 = Object.assign({}, E, { seed: hash(s.x, 7) }); for (const pr of st.props || []) { const f = PROP[pr]; if (f) f(p, a + 1, b - 1, t + 1, bot, st, E2); } }
      // glass: day reflection streaks, mullions, frame; arched heads
      const g = p.g;
      if (!night) { g.globalAlpha = .22; p.r(a, t, b - a, bot - t, '#a8c4dc'); g.globalAlpha = .35; for (let xx = a - 6; xx < b; xx += 13) for (let j = 0; j < 8; j++) { const px = xx + j; if (px >= a && px < b) p.r(px, t + 2 + j, 1, 3, '#ffffff'); } g.globalAlpha = 1; }
      else { g.globalAlpha = .18; p.r(a, t, b - a, 3, '#ffffff'); g.globalAlpha = 1; }
      p.r(a - 1, t - 1, b - a + 2, 1, frame); p.r(a - 1, bot, b - a + 2, 1, frame); p.r(a - 1, t, 1, bot - t, frame); p.r(b, t, 1, bot - t, frame);
      const ms = st.mull || (arch ? 8 : st.win === 'grid' ? 6 : 11);
      if (arch) { const n = Math.max(1, Math.round((b - a) / ms)), cw = (b - a) / n; for (let i = 0; i < n; i++) { const c0 = Math.round(a + i * cw), c1 = Math.round(a + (i + 1) * cw); if (i) p.r(c0 - 1, t - 1, 2, bot - t + 1, fc || frame); p.r(c0, t, 1, 2, fc || frame); p.r(c1 - 1, t, 1, 2, fc || frame); p.px(c0 + 1, t, fc || frame); p.px(c1 - 2, t, fc || frame); p.r(c0, t + 6, c1 - c0, 1, frame); } p.r(a - 2, t - 3, b - a + 4, 2, mix(fc || frame, '#e8d8c0', .45)); } // brick piers, arch heads, transom bar
      else { for (let xx = a + ms; xx < b - 3; xx += ms) p.r(xx, t, 1, bot - t, frame); if (st.win === 'grid') for (let yy = t + 7; yy < bot - 2; yy += 7) p.r(a, yy, b - a, 1, frame); else p.r(a, t + 5, b - a, 1, frame); }
      if (high) p.r(a - 1, bot + 1, b - a + 2, YG - bot - 1, fdk || '#3a3a40');
      p.r(a - 1, YB, b - a + 2, YG - YB, fc ? mix(fc, '#000', .35) : '#3a3a40'); // stall riser / base
      if (st.fac === 'heritage' || st.fac === 'stone') p.r(a - 2, YB, b - a + 4, 1, mix(fc, '#e8dcc8', .5)); // stone sill
    }
    // door (closed; travel.js opens it when a cat walks up)
    const dx = G.dx - ox, dc = st.dc ? T(st.dc) : st.fac === 'heritage' || st.fac === 'wood' ? T('#3a2a1e') : mix(fc || '#2a2a30', '#1a1a1e', .5);
    p.r(dx - 1, topO - 1, G.dw + 2, YG - topO + 1, mix(dc, '#000', .3));
    p.r(dx, topO, G.dw, YG - topO, dc);
    if (G.dw >= 6) { p.r(dx + 1, topO + 2, G.dw - 2, st.fac === 'heritage' ? 12 : YG - topO - 6, night ? st.glow : mix(st.in, '#a8c4dc', .5)); p.px(dx + G.dw - 2, topO + 18, '#d8c070'); }
    if (st.door === '2') p.r(dx + G.dw / 2, topO, 1, YG - topO, mix(dc, '#000', .4));
    // awning + its shadow
    if (awn) {
      const ac = T(st.ac || st.band), ac2 = T(st.ac2 || '#f4f0e6'), a = x + 1, aw = w - 2;
      if (st.awn === 'canopy') { p.r(a, YO, aw, 2, ac); p.r(a, YO + 2, aw, 1, mix(ac, '#000', .4)); }
      else { for (let yy = 0; yy < 5; yy++) p.r(a - (yy >> 1), YO + yy, aw + (yy >> 1) * 2, 1, mix(ac, '#000', .12 - yy * .03));
        if (st.awn === 'stripe') for (let xx = a; xx < a + aw; xx += 6) p.r(xx, YO, 3, 5, ac2);
        for (let xx = a - 2; xx < a + aw + 2; xx += 2) p.px(xx, YO + 5, (xx >> 1) % 2 ? ac : mix(ac, '#000', .3)); }
      if (!night) { p.g.globalAlpha = .28; p.r(a, YO + 6, aw, 4, '#1a1a30'); p.g.globalAlpha = 1; }
    }
  }
  // sidewalk props + light spill (after the ground)
  function front(p, s, ox, E) {
    const st = style(s, E.area); if (st.fac === 'none') return;
    const G = geom(s, st), x = G.x - ox, w = G.w, night = E.night, g = p.g;
    if (night && st.fac !== 'inset') { g.globalAlpha = .22; for (const [a, b] of G.spans) { p.r(a - ox, YG, b - a, 3, st.glow); p.r(a - ox + 2, YG + 3, b - a - 4, 3, st.glow); } g.globalAlpha = 1; }
    let cx = x + 2; const end = x + w - 2, dx0 = G.dx - ox - 1, dx1 = G.dx - ox + G.dw + 1;
    const free = (a, ww) => !(a < dx1 && a + ww > dx0) && a + ww <= end;
    for (const o of st.out || []) {
      if (o === 'patio') { for (let n = 0; n < 2; n++) { while (cx < end && !free(cx, 12)) cx++; if (!free(cx, 12)) break;
          const cc = COAT[(hash(s.x + n, 4) * COAT.length) | 0]; p.r(cx + 3, YG - 7, 6, 1, '#2a2a2a'); p.r(cx + 5, YG - 6, 1, 6, '#2a2a2a'); p.px(cx + 4, YG - 8, '#f4f0e6');
          p.r(cx, YG - 5, 2, 1, '#2a2a2a'); p.r(cx, YG - 4, 1, 4, '#2a2a2a'); p.r(cx + 10, YG - 5, 2, 1, '#2a2a2a'); p.r(cx + 11, YG - 4, 1, 4, '#2a2a2a');
          if (hash(s.x, n + 9) < .7) cat(p, cx, YG - 12, cc, null, night);
          if (w >= 40 && n === 0) { p.r(cx + 5, YG - 19, 1, 12, '#3a3a3a'); p.tri(cx - 1, YG - 23, 13, 4, mix(st.band, E.tn.near, E.k)); }
          cx += 14; } }
      else if (o === 'planter') { while (cx < end && !free(cx, 6)) cx++; if (!free(cx, 6)) continue; p.r(cx, YG - 5, 6, 5, '#5a5a60'); p.r(cx - 1, YG - 9, 8, 4, '#3a7a3a'); p.px(cx + 2, YG - 10, '#4a9a4a'); cx += 9; }
      else if (o === 'board') { while (cx < end && !free(cx, 6)) cx++; if (!free(cx, 6)) continue; p.r(cx + 1, YG - 9, 4, 9, '#1e1e22'); p.r(cx + 2, YG - 8, 2, 1, '#f4f0e6'); p.r(cx + 2, YG - 6, 2, 1, '#e8c040'); p.r(cx + 2, YG - 4, 2, 1, '#f4f0e6'); p.px(cx, YG - 1, '#1e1e22'); p.px(cx + 5, YG - 1, '#1e1e22'); cx += 8; }
      else if (o === 'crates') { while (cx < end && !free(cx, 12)) cx++; if (!free(cx, 12)) continue; PROP.produce(p, cx, cx + 12, 0, YG); p.r(cx, YG - 1, 12, 1, '#5a3a20'); cx += 14; }
      else if (o === 'buckets') { while (cx < end && !free(cx, 12)) cx++; if (!free(cx, 12)) continue; PROP.flowers(p, cx, cx + 12, 0, YG); cx += 14; }
      else if (o === 'barrel') { while (cx < end && !free(cx, 6)) cx++; if (!free(cx, 6)) continue; p.r(cx, YG - 8, 6, 8, '#7a4a26'); p.r(cx, YG - 6, 6, 1, '#3a3a3a'); p.r(cx, YG - 2, 6, 1, '#3a3a3a'); p.r(cx + 1, YG - 8, 4, 1, '#9a6a3a'); cx += 8; }
      else if (o === 'pole') { const px = x + w - 3; p.r(px, 198, 2, 10, '#f4f0e6'); for (let yy = 198; yy < 208; yy += 3) p.px(px + (yy & 1), yy, '#c8202a'); p.px(px, 200, '#1e3a8a'); }
    }
  }
  // sign box for travel.js: where + how to write the wordmark
  function sign(s, area) {
    const st = style(s, area);
    if (st.fac === 'none') return { kind: 'none' };
    const kind = st.sign === 'plaque' ? 'plaque' : 'band';
    if (kind === 'plaque') { const w = Math.min(s.sw - 4, 60); return { kind, x: s.sx + Math.round((s.sw - w) / 2), y: 186, w, h: 8, st }; }
    return { kind, x: s.sx + 1, y: YS, w: s.sw - 2, h: YS1 - YS, st };
  }
  // text candidates: full name, short, tiny — never a truncated "…" plate
  function signText(s, st) { const L = [s.n]; if (st.short) L.push(st.short); if (st.tiny) L.push(st.tiny); const first = (s.n || '').split(/[ ·]/)[0]; if (first.length >= 3 && !L.includes(first)) L.push(first); return L.map(t => (st.caps ? t.toUpperCase() : t).replace(/[\u2018\u2019]/g, "'")); }
  return { style, geom, draw, front, sign, signText, KIND, PROP };
})();
