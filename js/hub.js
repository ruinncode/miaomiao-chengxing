// ============================================================
//  Hub — framework for every non-platformer mode (study room, city
//  travel, minigames, drawing, handheld, diary).
//  * Host-authoritative: the host owns `st`; both players send actions
//    with App.act({k:...}); the host runs mode.act(st, a, who, ev) and
//    mode.step(st, inputs, ev) at 60 Hz and broadcasts mode.snap(st).
//  * Rendering: one DOM canvas, 960x544 device px = 480x272 art px at x2.
//  * Modes are lazy-loaded from js/hub/<name>.js.
// ============================================================
window.CAT_NAMES = [String(window.NAMES.p1), String(window.NAMES.p2)];
window.Hub = (function () {
  const MODES = {}, LOADING = {};
  const AW = 480, AH = 272, S = 2;
  const FILES = { // mode -> scripts it needs (loaded in order)
    study: ['js/hub/scenery.js', 'js/hub/study.js'],
    travel: ['js/hub/scenery.js', 'js/cities/toronto-streets.js', 'js/cities/toronto-shops.js', 'js/hub/storefront.js', 'js/cities/index.js', 'js/hub/travel.js', 'js/hub/travel2.js', 'js/hub/trainview.js', 'js/hub/trip.js', 'js/hub/suite.js', 'js/hub/maps.js', 'js/hub/study.js'],
    games: ['js/hub/games.js'],
    handheld: ['js/hub/games.js', 'js/hub/handheld.js'],
    diary: ['js/hub/scenery.js', 'js/cities/toronto-streets.js', 'js/cities/toronto-shops.js', 'js/hub/storefront.js', 'js/cities/index.js', 'js/hub/diary.js'],
  };
  const loaded = {};
  function loadScript(src) {
    if (loaded[src]) return loaded[src];
    return (loaded[src] = new Promise((res, rej) => { const s = document.createElement('script'); s.src = src + '?v=' + (window.BUILD || 1); s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error(src)); }; document.head.appendChild(s); }));
  }
  function need(name) {
    if (MODES[name]) return Promise.resolve();
    if (!LOADING[name]) LOADING[name] = (FILES[name] || []).reduce((p, f) => p.then(() => loadScript(f)), Promise.resolve());
    return LOADING[name];
  }

  // ---------------- host-side game object ----------------
  class HubGame {
    constructor(name, arg, session) {
      this.name = name; this.arg = arg; this.session = session; this.events = []; this.st = null; this.seq = 0;
      need(name).then(() => this.init()).catch(e => { console.error(e); this.err = String(e); });
    }
    init() {
      const M = MODES[this.name], a = this.arg || {};
      if (a._restore) { this.st = a._restore; this.ev('enter', this.name); if (M.resume) M.resume(this.st, this.events, { from: 'game' }); return; }
      this.st = M.create(a, this.events); this.st._m = this.name; this.ev('enter', this.name);
    }
    // launch a Phaser platformer game (coop level / versus) and come back to this exact hub state afterwards
    playGame(m, arg) { const root = { m: this.name, st: this.st }; setTimeout(() => App.playFrom(m, arg, { name: root.m, st: root.st, label: root.m === 'travel' ? '旅行' : root.m === 'games' ? '小游戏厅' : root.m === 'handheld' ? '掌机' : '大厅' }), 0); }
    ev(...e) { this.events.push(e); }
    act(a, who) {
      if (!a || !this.st) return;
      if (a.k === 'leave') { setTimeout(() => App.backToModes(), 0); return; }
      if (a.k === 'play') { this.playGame(a.m, a.arg); return; }
      if (a.k === 'switch') { // jump to another hub mode, carrying a context (e.g. study inside a city)
        const prev = { m: this.name, st: this.st };
        this.name = a.m; this.st = null;
        need(a.m).then(() => { const M = MODES[a.m]; this.st = M.create(Object.assign({}, a.arg || {}, { _back: a.back ? prev : null }), this.events); this.st._back = a.back ? prev : null; this.st._m = a.m; this.ev('enter', a.m); });
        return;
      }
      if (a.k === 'return' && this.st._back) { const b = this.st._back; this.name = b.m; this.st = b.st; this.ev('enter', b.m); if (MODES[b.m].resume) MODES[b.m].resume(this.st, this.events, a.res); return; }
      const M = MODES[this.name]; M.act && M.act(this.st, a, who, this.ev.bind(this));
    }
    step(inputs) { if (!this.st) return; const M = MODES[this.name]; M.step && M.step(this.st, inputs, this.ev.bind(this)); if (this.st && this.st._sw) { const a = this.st._sw; delete this.st._sw; this.act(a, -1); } } // a mode may request a switch from step()
    onHug() { if (this.st) { const M = MODES[this.name]; M.onHug && M.onHug(this.st, this.ev.bind(this)); } }
    snapshot() {
      if (!this.st) return { hm: this.name, sc: 'loading', c: [null, null] };
      const M = MODES[this.name], s = M.snap ? M.snap(this.st) : Object.assign({}, this.st);
      delete s._back; s.hm = this.name; s.bk = this.st._back ? 1 : 0; if (!s.c) s.c = [null, null];
      return s;
    }
    takeEvents() { const e = this.events.splice(0); return e; }
  }

  // ---------------- renderer ----------------
  let cv = null, ctx = null, ui = null, buttons = [], hover = null, active = false, lastV = null, tAcc = 0;
  const off = {}; // cached offscreen canvases
  function canvas() {
    if (cv) return cv;
    cv = document.getElementById('hub'); ctx = cv.getContext('2d'); ui = document.getElementById('hubui');
    cv.width = AW * S; cv.height = AH * S; ctx.imageSmoothingEnabled = false;
    const toArt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * AW, (e.clientY - r.top) / r.height * AH]; };
    cv.addEventListener('pointerdown', (e) => {
      e.preventDefault(); Sfx.unlock(); const [x, y] = toArt(e);
      for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h) { if (!b.silent) Sfx.click(); fire(b, x, y, 'down'); return; } }
      const M = lastV && MODES[lastV.s.hm]; if (M && M.pointer) M.pointer(R, lastV.s, 'down', x, y);
    });
    cv.addEventListener('pointermove', (e) => { const [x, y] = toArt(e); hover = [x, y]; const M = lastV && MODES[lastV.s.hm]; if (M && M.pointer && e.buttons) M.pointer(R, lastV.s, 'move', x, y); });
    cv.addEventListener('pointerup', (e) => { const [x, y] = toArt(e); const M = lastV && MODES[lastV.s.hm]; if (M && M.pointer) M.pointer(R, lastV.s, 'up', x, y); });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      if (!active || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      const M = lastV && MODES[lastV.s.hm]; if (M && M.key) M.key(R, lastV.s, e.code, e);
      if (e.code === 'Escape') R.back();
    });
    window.addEventListener('resize', fit); fit();
    return cv;
  }
  function fit() {
    if (!cv) return; const g = document.getElementById('game'); const r = g.getBoundingClientRect();
    const k = Math.min(r.width / (AW * S), r.height / (AH * S));
    const w = Math.floor(AW * S * k), h = Math.floor(AH * S * k);
    Object.assign(cv.style, { width: w + 'px', height: h + 'px', left: Math.round(r.left + (r.width - w) / 2) + 'px', top: Math.round(r.top + (r.height - h) / 2) + 'px' });
    Object.assign(ui.style, { width: w + 'px', height: h + 'px', left: cv.style.left, top: cv.style.top });
  }
  function fire(b, x, y) {
    if (typeof b.a === 'function') b.a(x - b.x, y - b.y); else if (b.a) App.act(b.a, R.who());
  }

  // pixel palette (slate night + warm accents)
  const C = { ink: '#0d0f17', ink2: '#1a1f2e', slate: '#222b3d', slate2: '#2e3a52', edge: '#3a4763', edge2: '#566788', paper: '#e8e4f0', dim: '#9aa3bd', gold: '#f3c55e', warm: '#f3a85e', warmd: '#c8743a', mint: '#8fe0b0', blue: '#8fd0f6', red: '#e04a48', cream: '#fff3d6', brown: '#8a5a3a' };
  const R = {
    AW, AH, C, S, get ctx() { return ctx; }, t: 0,
    who() { return App.role === 'local' ? (R.localWho || 0) : App.me; }, localWho: 0,
    me() { return App.role === 'local' ? R.localWho || 0 : App.me; },
    local() { return App.role === 'local'; },
    rect(x, y, w, h, c, a) { if (a != null) ctx.globalAlpha = a; ctx.fillStyle = c; ctx.fillRect(Math.round(x) * S, Math.round(y) * S, Math.round(w) * S, Math.round(h) * S); if (a != null) ctx.globalAlpha = 1; },
    px(x, y, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x) * S, Math.round(y) * S, S, S); },
    // text: size 12 = 6 art px tall; 24 = 12 art px tall. x,y in art px. align: l/c/r
    text(str, x, y, o = {}) {
      const size = o.size || 12, col = o.c || C.paper; ctx.font = `${o.it ? 'italic ' : ''}${size}px Zpix, monospace`; ctx.textBaseline = 'top';
      let X = Math.round(x * S); const w = ctx.measureText(str).width;
      if (o.al === 'c') X = Math.round(x * S - w / 2); else if (o.al === 'r') X = Math.round(x * S - w);
      const Y = Math.round(y * S);
      if (o.sh !== false) { ctx.fillStyle = o.shc || C.ink; ctx.fillText(str, X + (size >= 24 ? 2 : 1) * (o.shk || 1), Y + (size >= 24 ? 2 : 1) * (o.shk || 1)); }
      ctx.fillStyle = col; ctx.fillText(str, X, Y); if (o.b) ctx.fillText(str, X + 1, Y); return w / S;
    },
    tw(str, size = 12, it) { ctx.font = `${it ? 'italic ' : ''}${size}px Zpix, monospace`; return ctx.measureText(str).width / S; },
    clip(str, maxW, size = 12) { str = String(str); if (R.tw(str, size) <= maxW) return str; while (str.length > 1 && R.tw(str + '…', size) > maxW) str = str.slice(0, -1); return str + '…'; },
    wrap(str, x, y, maxW, o = {}) { const size = o.size || 12, lh = o.lh || (size / S + 3); let line = '', yy = y; for (const ch of String(str)) { if (ch === '\n' || R.tw(line + ch, size) > maxW) { R.text(line, x, yy, o); yy += lh; line = ch === '\n' ? '' : ch; } else line += ch; } if (line) R.text(line, x, yy, o); return yy + lh - y; },
    panel(x, y, w, h, o = {}) {
      const fill = o.fill || C.slate, edge = o.edge || C.edge;
      if (o.shadow !== false) R.rect(x + 3, y + 3, w, h, C.ink, 0.45);
      R.rect(x + 1, y, w - 2, h, C.ink); R.rect(x, y + 1, w, h - 2, C.ink);
      R.rect(x + 1, y + 1, w - 2, h - 2, edge); R.rect(x + 2, y + 2, w - 4, h - 4, fill);
      if (o.title) { R.rect(x + 2, y + 2, w - 4, 11, o.tfill || C.edge); R.text(o.title, x + w / 2, y + 3, { al: 'c', c: o.tc || C.cream }); }
    },
    // button; a = action object (sent to host) or function (local only)
    btn(x, y, w, h, label, a, o = {}) {
      const on = !!o.on, dis = !!o.dis, hv = hover && hover[0] >= x && hover[1] >= y && hover[0] < x + w && hover[1] < y + h;
      const fill = dis ? C.ink2 : on ? (o.onc || C.gold) : (o.c || C.slate2);
      R.rect(x + 1, y, w - 2, h, C.ink); R.rect(x, y + 1, w, h - 2, C.ink);
      R.rect(x + 1, y + 1, w - 2, h - 2, fill); R.rect(x + 1, y + h - 3, w - 2, 2, C.ink, 0.35); R.rect(x + 1, y + 1, w - 2, 1, '#ffffff', hv && !dis ? 0.35 : 0.18);
      if (o.icon) o.icon(x, y, w, h);
      if (label) R.text(label, x + w / 2, y + (h - 6) / 2 - 1, { al: 'c', c: dis ? C.dim : on ? C.ink : (o.tc || C.paper), sh: !on });
      if (!dis) buttons.push({ x, y, w, h, a, silent: o.silent });
    },
    hit(x, y, w, h, a, silent = true) { buttons.push({ x, y, w, h, a, silent }); },
    img(key, x, y, o = {}) { // draw a Phaser texture (1x art) at art px
      const im = R.tex(key); if (!im) return;
      const sx = o.sx || 1, sy = o.sy || sx, flip = !!o.flip, w = im.width * sx, h = im.height * sy;
      if (o.a != null) ctx.globalAlpha = o.a;
      let X = x, Y = y; if (o.ax != null) X -= w * o.ax; if (o.ay != null) Y -= h * o.ay;
      if (flip) { ctx.save(); ctx.translate(Math.round(X + w) * S, 0); ctx.scale(-1, 1); ctx.drawImage(im, 0, Math.round(Y) * S, w * S, h * S); ctx.restore(); }
      else ctx.drawImage(im, Math.round(X) * S, Math.round(Y) * S, Math.round(w * S), Math.round(h * S));
      if (o.a != null) ctx.globalAlpha = 1;
    },
    tex(key) { const sc = window.App && App.scene; const g = sc && sc.textures; if (!g || !g.exists(key)) return null; return g.get(key).getSourceImage(); },
    // offscreen cache: draw(fn) once per key at art resolution
    cache(key, w, h, fn) {
      let c = off[key]; if (c) return c;
      c = off[key] = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; fn(g, w, h); return c;
    },
    drop(prefix) { for (const k of Object.keys(off)) if (k.startsWith(prefix)) delete off[k]; },
    blit(c, x, y, o = {}) { if (o.a != null) ctx.globalAlpha = o.a; ctx.drawImage(c, o.sx || 0, o.sy || 0, o.sw || c.width, o.sh || c.height, Math.round(x) * S, Math.round(y) * S, (o.sw || c.width) * S * (o.k || 1), (o.sh || c.height) * S * (o.k || 1)); if (o.a != null) ctx.globalAlpha = 1; },
    // a cat sprite at art px: (x = centre, y = feet)
    cat(i, pose, x, y, o = {}) { const k = o.k || 1; R.img(`cat${i}_${pose}`, x, y, { ax: CatArt.ANCHOR.x, ay: CatArt.ANCHOR.y, flip: o.flip, sx: k * (o.qx || 1), sy: k * (o.qy || 1), a: o.a }); },
    nameTag(i, x, y) { const n = CAT_NAMES[i], w = R.tw(n) + 6; R.rect(x - w / 2, y - 8, w, 8, i ? C.paper : '#2b2340'); R.rect(x - w / 2, y - 8, w, 1, i ? '#ffffff' : '#4a3f66'); R.text(n, x, y - 8, { al: 'c', c: i ? '#3a2e4f' : C.paper, sh: false }); },
    back() { if (lastV && lastV.s.bk) App.act({ k: 'return' }); else if (App.role !== 'guest') App.backToModes(); else App.act({ k: 'leave' }); },
    topBar(title, o = {}) {
      R.rect(0, 0, AW, 14, C.ink, 0.72); R.rect(0, 14, AW, 1, C.edge);
      R.btn(2, 1, 40, 12, lastV && lastV.s.bk ? '◀ 返回' : '⌂ 菜单', () => R.back());
      R.text(title, AW / 2, 3, { al: 'c', c: C.cream });
      if (R.local()) { R.btn(AW - 150, 1, 66, 12, '操作：' + CAT_NAMES[R.localWho || 0], () => { R.localWho = 1 - (R.localWho || 0); }, { c: R.localWho ? '#7a4a5a' : '#3a3550' }); }
    },
    // DOM text prompt (goals, todo, chat, guesses)
    ask(label, value, cb, o = {}) {
      ui.classList.remove('hidden');
      ui.innerHTML = `<form class="hub-ask"><label>${GameUI.esc(label)}</label><input maxlength="${o.max || 40}" value="${GameUI.esc(value || '')}" placeholder="${GameUI.esc(o.ph || '')}"><div><button class="btn small" type="submit">好</button> <button class="btn small ghost" type="button">取消</button></div></form>`;
      const f = ui.querySelector('form'), inp = f.querySelector('input');
      const done = (ok) => { ui.classList.add('hidden'); ui.innerHTML = ''; if (ok) cb(inp.value.trim()); };
      f.onsubmit = (e) => { e.preventDefault(); done(true); };
      f.querySelector('.ghost').onclick = () => done(false);
      inp.focus(); inp.select();
    },
    // seeded hash for deterministic decoration
    hash(a, b = 0) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177 | 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; },
    heart(x, y, k = 1, c = C.red) { const m = ['.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...']; m.forEach((r, j) => [...r].forEach((ch, i) => ch === 'x' && R.rect(x + i * k, y + j * k, k, k, c))); },
    // draw both cats; handles hug / ask / nuzzle from the session affection state s.af
    // cats[i] = {x, y, pose, flip, k, tag}
    pair(s, cats) {
      const af = s.af || [-1, -1, -1, 0, 0, 0];
      if (af[0] >= 0 && cats[0] && cats[1]) {
        const l = af[1], k = cats[0].k || 1, hx = (cats[0].x + cats[1].x) / 2, hy = Math.max(cats[0].y, cats[1].y), sq = 1 + Math.sin(af[0] * 9) * 0.04;
        cats[l] = Object.assign({}, cats[l], { x: hx - 5 * k, y: hy, pose: 'hug', flip: false, qx: sq, qy: 2 - sq });
        cats[1 - l] = Object.assign({}, cats[1 - l], { x: hx + 5 * k, y: hy, pose: af[0] > 0.4 ? 'hug' : 'happy1', flip: true, qx: sq, qy: 2 - sq });
        if (Math.random() < 0.12) R.spark(hx, hy - 26 * k, 'heart');
      }
      for (let i = 0; i < 2; i++) { const c = cats[i]; if (!c) continue; let pose = c.pose; if (af[3 + i] && af[0] < 0) pose = 'nuzzle'; R.cat(i, pose, c.x, c.y, { flip: c.flip, k: c.k, qx: c.qx, qy: c.qy, a: c.a }); }
      for (let i = 0; i < 2; i++) { const c = cats[i]; if (!c) continue; if (c.tag !== false) R.nameTag(i, c.x, c.y - 24 * (c.k || 1) - 2); if (af[2] === i) { const b = Math.sin(R.t * 8) > 0 ? 1 : 0; R.heart(c.x - 3, c.y - 24 * (c.k || 1) - 18 - b, 1, C.red); } }
    },
    fx: [], // transient particles {x,y,vx,vy,life,kind}
    spark(x, y, kind = 'heart', n = 1) { for (let i = 0; i < n; i++) R.fx.push({ x: x + (Math.random() - 0.5) * 12, y, vx: (Math.random() - 0.5) * 12, vy: -14 - Math.random() * 10, life: 1.4, kind }); },
    drawFx(dt) {
      R.fx = R.fx.filter(p => (p.life -= dt) > 0);
      for (const p of R.fx) { p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = Math.min(1, p.life); if (p.kind === 'heart') R.heart(p.x, p.y, 1); else if (p.kind === 'zz') R.text('z', p.x, p.y, { c: C.blue }); else if (p.kind === 'note') R.text('♪', p.x, p.y, { c: C.gold }); else if (p.kind === 'star') R.text('✦', p.x, p.y, { c: C.gold }); else R.rect(p.x, p.y, 2, 2, C.paper); ctx.globalAlpha = 1; }
    },
  };

  function frame(v, dt) {
    const on = !!v; canvas();
    if (on !== active) {
      active = on; cv.classList.toggle('hidden', !on); if (!on) { ui.classList.add('hidden'); ui.innerHTML = ''; } fit();
      document.getElementById('game').classList.toggle('dimmed', on); document.body.classList.toggle('hubon', on);
    }
    if (!on) { lastV = null; return; }
    lastV = v; R.t += dt; buttons = [];
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = false;
    const s = v.s, M = MODES[s.hm];
    if (!M || s.sc === 'loading') {
      need(s.hm).catch(() => {});
      R.rect(0, 0, AW, AH, C.ink2);
      R.text('加载中…', AW / 2, AH / 2 - 4, { al: 'c', size: 24 });
      R.cat(0, 'walk' + (Math.floor(R.t * 10) % 6), AW / 2 - 14, AH / 2 + 40); R.cat(1, 'walk' + (Math.floor(R.t * 10 + 3) % 6), AW / 2 + 14, AH / 2 + 40);
      R.topBar('');
      return;
    }
    M.draw(R, s, dt);
    R.drawFx(dt);
    // affection overlay (hug requests are drawn by the mode; here: global hug button for touch)
    if (M.hugButton !== false && s.c && s.c[0] && s.c[1]) {
      R.btn(AW - 20, AH - 20, 18, 18, '', () => App.hug(R.who()), { c: '#7a4a2a', icon: (x, y) => R.heart(x + 5, y + 6, 1, C.red) });
    }
  }
  return {
    mode(name, def) { MODES[name] = def; }, MODES, R, need,
    create(name, arg, session) { return new HubGame(name, arg, session); },
    frame,
    onEvents(evs) { for (const e of evs) { const M = lastV && MODES[lastV.s.hm]; if (M && M.onEvent) M.onEvent(R, e, lastV.s); if (e[0] === 'sfx') Sfx.play(e[1]); if (e[0] === 'spark') R.spark(e[1], e[2], e[3], e[4]); } },
    musicScene(v) { const M = MODES[v.s.hm]; return M && M.music ? M.music(v.s) : 'title'; },
    wantsPad(v) { const M = MODES[v.s.hm]; return !!(M && M.pad && M.pad(v.s)); },
  };
})();

// ------------------------------------------------------------
//  Diary / scrapbook + session tally + heart achievements (localStorage)
// ------------------------------------------------------------
window.Diary = (function () {
  const KEY = 'mmcx-diary';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  const ACH = [
    { id: 'hug1', name: '第一个抱抱', need: d => (d.n.hug || 0) >= 1 },
    { id: 'hug10', name: '抱抱大师 ×10', need: d => (d.n.hug || 0) >= 10 },
    { id: 'hug50', name: '离不开彼此 ×50', need: d => (d.n.hug || 0) >= 50 },
    { id: 'cuddle1', name: '一起窝着', need: d => (d.n.cuddle || 0) >= 1 },
    { id: 'night3', name: '三个晚安', need: d => (d.n.goodnight || 0) >= 3 },
    { id: 'paws', name: '牵爪散步', need: d => (d.n.paws || 0) >= 1 },
    { id: 'nuzzle20', name: '蹭蹭 ×20', need: d => (d.n.nuzzle || 0) >= 20 },
    { id: 'study60', name: '一起学习 1 小时', need: d => (d.n.studyMin || 0) >= 60 },
    { id: 'cities3', name: '去过 3 座城市', need: d => Object.keys(d.cities || {}).length >= 3 },
    { id: 'cities10', name: '环游世界 · 10 城', need: d => Object.keys(d.cities || {}).length >= 10 },
  ];
  let place = '';
  const api = {
    setPlace(p, city) { place = p || ''; if (city) { const d = load(); d.cities = d.cities || {}; d.cities[city] = (d.cities[city] || 0) + 1; save(d); api.check(); } },
    get place() { return place; },
    stamp(kind, extra) {
      const d = load(); d.n = d.n || {}; d.n[kind] = (d.n[kind] || 0) + 1; d.pages = d.pages || [];
      d.pages.push({ k: kind, p: place, t: Date.now(), x: extra || null }); if (d.pages.length > 300) d.pages.splice(0, d.pages.length - 300);
      save(d); api.check();
    },
    count(kind, by = 1) { const d = load(); d.n = d.n || {}; d.n[kind] = (d.n[kind] || 0) + by; save(d); api.check(); },
    tally(kind, w) { try { const T = JSON.parse(localStorage.getItem('mmcx-tally') || '{}'); T[kind] = (T[kind] || 0) + 1; if (w != null) { T.w = T.w || [0, 0]; T.w[w]++; } localStorage.setItem('mmcx-tally', JSON.stringify(T)); } catch (e) {} },
    check() {
      const d = load(); d.n = d.n || {}; d.ach = d.ach || {}; let got = null;
      for (const a of ACH) if (!d.ach[a.id] && a.need(d)) { d.ach[a.id] = Date.now(); got = a; }
      if (got) { save(d); window.GameUI && GameUI.banner('♥ 成就：' + got.name, 2600); window.Sfx && Sfx.chime(); }
    },
    get data() { const d = load(); d.n = d.n || {}; d.pages = d.pages || []; d.ach = d.ach || {}; return d; },
    ACH,
  };
  return api;
})();

// ------------------------------------------------------------
//  Travel coins + inventory (stored on the host's device; shown to the
//  guest through mode snapshots). Earned in activities and handheld games.
// ------------------------------------------------------------
window.Wallet = (function () {
  const KEY = 'mmcx-wallet';
  const load = () => { try { return Object.assign({ coins: 30, inv: { handheld: 1 }, souv: [] }, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { return { coins: 30, inv: { handheld: 1 }, souv: [] }; } };
  const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch (e) {} };
  return {
    get coins() { return load().coins; },
    add(n) { const d = load(); d.coins = Math.max(0, d.coins + n); save(d); return d.coins; },
    spend(n) { const d = load(); if (d.coins < n) return false; d.coins -= n; save(d); return true; },
    has(id) { return !!load().inv[id]; },
    give(id) { const d = load(); d.inv[id] = (d.inv[id] || 0) + 1; save(d); },
    souvenir(name, city) { const d = load(); if (!d.souv.some(s => s[0] === name)) d.souv.push([name, city]); save(d); },
    get data() { return load(); },
  };
})();
