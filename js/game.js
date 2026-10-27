// ============================================================
//  喵喵成行 — main game (menus, local / online, rendering)
// ============================================================
(function () {
  const CFG = window.GAME_CONFIG;
  const { Sim, T, DT } = window.CatSim;
  const { VsMatch, VS_GAMES } = window.Versus;
  const LEVELS = window.LEVELS;
  const W = 960, H = 544, FONT = 'Zpix, "Press Start 2P", monospace';
  const NAMES = [String(CFG.names.p1), String(CFG.names.p2)];
  const SHORT = NAMES;
  const fmt = (t) => String(t || '').replace(/\{p1\}/g, NAMES[0]).replace(/\{p2\}/g, NAMES[1]);
  const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BOTH = `${NAMES[0]} 和 ${NAMES[1]}`;
  // fill the names into the static menu text
  function fillNames() {
    document.querySelectorAll('.n-p1').forEach(e => e.textContent = NAMES[0]);
    document.querySelectorAll('.n-p2').forEach(e => e.textContent = NAMES[1]);
  }
  const $ = (id) => document.getElementById(id);
  const qs = new URLSearchParams(location.search);

  // ---------------------------------------------------------- co-op game (host/local only)
  class CoopGame {
    constructor() { this.sim = new Sim(0, LEVELS, CFG.physics); this.phase = 'play'; this.t = 0; this.k = 0; this.fishTotal = 0; this.events = []; }
    step(inputs) {
      const sim = this.sim;
      if (this.phase === 'play') {
        sim.step(inputs);
        for (const e of sim.takeEvents()) this.events.push(e);
        if (sim.cleared) { this.phase = 'clear'; this.t = 0; this.fishTotal += sim.fish.filter(f => f.got).length; }
      } else {
        sim.step([{}, {}]); sim.takeEvents(); this.t += DT;
        if (this.phase === 'clear' && this.t > 2.6) {
          if (sim.levelIndex + 1 >= LEVELS.length) { this.phase = 'end'; this.events.push(['ending']); }
          else { sim.load(sim.levelIndex + 1); this.k++; this.phase = 'play'; this.events.push(['level', sim.levelIndex]); }
        }
      }
    }
    restart() { if (this.phase !== 'play') return; this.sim.load(this.sim.levelIndex); this.k++; this.events.push(['restart']); }
    takeEvents() { const e = this.events; this.events = []; return e; }
    snapshot() { return Object.assign(this.sim.snapshot(), { ph: this.phase, k: this.k, ft: this.fishTotal }); }
  }

  // ---------------------------------------------------------- session (what is being played)
  class Session {
    constructor() { this.mode = 'pick'; this.mk = 0; this.game = null; this.events = []; }
    setMode(m) {
      this.mode = m; this.mk++;
      this.game = m === 'coop' ? new CoopGame() : m === 'vs' ? new VsMatch(CFG.physics, (Date.now() % 1e6) | 0) : null;
      this.events.push(['mode', m]);
    }
    step(inputs) { if (!this.game) return; this.game.step(inputs); this.events.push(...this.game.takeEvents()); }
    snapshot() { return this.game ? this.game.snapshot() : null; }
    takeEvents() { const e = this.events; this.events = []; return e; }
  }

  // ---------------------------------------------------------- input
  const keys = new Set();
  const touch = { l: false, r: false, j: false, a: false, d: false };
  const GAME_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'];
  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (GAME_KEYS.includes(e.code)) e.preventDefault();
    if (!keys.has(e.code)) onKeyPress(e.code);
    keys.add(e.code); Sfx.unlock();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());
  const any = (...c) => c.some(k => keys.has(k));
  function readInput(which) { // which: 0 / 1 for local split, 'me' for online
    if (which === 0) return { l: any('KeyA') || touch.l, r: any('KeyD') || touch.r, j: any('KeyW') || touch.j, d: any('KeyS') || touch.d, a: any('KeyF') || touch.a };
    if (which === 1) return { l: any('ArrowLeft'), r: any('ArrowRight'), j: any('ArrowUp'), d: any('ArrowDown'), a: any('Enter', 'NumpadEnter', 'Slash', 'ShiftRight') };
    return {
      l: any('KeyA', 'ArrowLeft') || touch.l, r: any('KeyD', 'ArrowRight') || touch.r, j: any('KeyW', 'ArrowUp', 'Space') || touch.j,
      d: any('KeyS', 'ArrowDown') || touch.d, a: any('KeyF', 'KeyJ', 'Enter', 'NumpadEnter') || touch.a,
    };
  }
  function onKeyPress(code) {
    if (!App.role || App.role === 'menu') return;
    if (code === 'KeyR') App.restart();
    if (App.role === 'local') { if (code === 'KeyE') App.meow(0); if (code === 'KeyM') App.meow(1); }
    else if (code === 'KeyE' || code === 'KeyM') App.meow(App.me);
  }
  function setupTouch() {
    const isTouch = ('ontouchstart' in window) || matchMedia('(pointer: coarse)').matches || qs.has('touch');
    App.isTouch = isTouch;
    document.querySelectorAll('#touch button').forEach((b) => {
      const k = b.dataset.k;
      const down = (e) => {
        e.preventDefault(); Sfx.unlock(); b.classList.add('down');
        if (k === 'meow') App.meow(App.role === 'local' ? 0 : App.me);
        else if (k === 'restart') App.restart();
        else touch[k] = true;
      };
      const up = (e) => { e.preventDefault(); b.classList.remove('down'); if (k in touch) touch[k] = false; };
      b.addEventListener('pointerdown', down); b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
      b.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  // ---------------------------------------------------------- UI helpers
  const SCREENS = ['screen-title', 'screen-lobby', 'screen-joining', 'screen-mode', 'screen-end', 'screen-vsend'];
  let curScreen = null;
  function show(id) {
    if (curScreen === id) return;
    curScreen = id;
    SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id));
    $('overlay').classList.toggle('hidden', !id);
  }
  let bannerTimer = null;
  function banner(text, ms = 2500) {
    const b = $('banner'); clearTimeout(bannerTimer);
    if (!text) { b.classList.add('hidden'); return; }
    b.textContent = text; b.classList.remove('hidden');
    if (ms > 0) bannerTimer = setTimeout(() => b.classList.add('hidden'), ms);
  }
  function fillSprites(scene) {
    document.querySelectorAll('img[data-tex]').forEach((img) => {
      const tex = scene.textures.get(img.dataset.tex);
      if (!tex || tex.key === '__MISSING') return;
      img.src = tex.getSourceImage().toDataURL();
    });
  }

  // ---------------------------------------------------------- App controller
  const App = {
    role: 'menu', me: 0, net: null, session: null, paused: false, isTouch: false,
    remote: { l: false, r: false, j: false, d: false, a: false }, rTapJ: false, rTapA: false,
    buf: [], lastSend: 0, lastInputSend: 0, lastInputStr: '', lastRestart: 0, guestPkt: null,

    toMenu() {
      if (this.net) { this.net.destroy(); this.net = null; }
      this.role = 'menu'; this.session = null; this.buf = []; this.guestPkt = null; this.paused = false;
      history.replaceState(null, '', location.pathname);
      show('screen-title'); banner(''); $('btn-menu').classList.add('hidden');
      Scene && Scene.showAttract();
      Sfx.music('title');
    },
    startLocal() {
      this.role = 'local'; this.me = 0; this.session = new Session();
      show('screen-mode'); this.modeScreen(); $('btn-menu').classList.remove('hidden');
    },
    createRoom() {
      this.role = 'host'; this.me = 0; this.session = new Session(); this.paused = false;
      show('screen-lobby'); $('lobby-code').textContent = '····'; $('lobby-link').value = '';
      $('lobby-status').innerHTML = '<span class="dots">正在连接服务器</span>';
      let preferred = null; try { preferred = sessionStorage.getItem('cc-host-code'); } catch (e) {}
      this.net = new Net({
        onStatus: (kind, info) => {
          if (kind === 'room-ready') {
            try { sessionStorage.setItem('cc-host-code', info); } catch (e) {}
            this.code = info;
            $('lobby-code').textContent = info;
            $('lobby-link').value = location.origin + location.pathname + '?room=' + info;
            $('lobby-status').innerHTML = `<span class="dots">等待 ${esc(NAMES[1])} 加入</span>`;
          } else if (kind === 'signal-trouble') $('lobby-status').textContent = '服务器连接不稳定，正在重试…';
          else if (kind === 'error') $('lobby-status').textContent = '出错了：' + info + '（可以返回再试一次）';
        },
        onConnected: () => {
          Sfx.join(); this.paused = false;
          if (this.session.mode === 'pick') { show('screen-mode'); this.modeScreen(); }
          else banner(`${NAMES[1]} 回来啦！继续玩 ♥`, 2500);
          $('btn-menu').classList.remove('hidden');
          this.sendState(true);
        },
        onDisconnected: () => {
          Sfx.leave();
          if (this.session && this.session.mode !== 'pick') { this.paused = true; banner(`${NAMES[1]} 掉线了… 等待重新连接（房间码 ` + this.code + '）', 0); }
          else { show('screen-lobby'); $('lobby-status').innerHTML = `<span class="dots">${esc(NAMES[1])} 掉线了，等待重新加入</span>`; }
        },
        onMessage: (m) => this.hostMsg(m),
      });
      this.net.host(preferred);
    },
    joinRoom(code) {
      code = (code || '').toUpperCase().replace(/[^A-Z]/g, '');
      if (code.length !== 4) { $('title-err').textContent = '房间码是4个字母哦'; return; }
      $('title-err').textContent = '';
      this.role = 'guest'; this.me = 1; this.buf = []; this.guestPkt = null;
      history.replaceState(null, '', location.pathname + '?room=' + code);
      show('screen-joining'); $('joining-code').textContent = code;
      $('joining-status').innerHTML = `<span class="dots">正在寻找 ${esc(NAMES[0])} 的房间</span>`;
      this.net = new Net({
        onStatus: (kind, info) => {
          if (kind === 'no-room') {
            $('joining-status').textContent = '找不到房间 ' + info + `，请检查房间码，或让 ${NAMES[0]} 先创建房间。正在重试…`;
            setTimeout(() => { if (this.role === 'guest' && this.net && !this.net.connected) this.net.connectToHost(); }, 3000);
          } else if (kind === 'error') $('joining-status').textContent = '出错了：' + info;
          else if (kind === 'signal-trouble') $('joining-status').textContent = '服务器连接不稳定，正在重试…';
        },
        onConnected: () => { Sfx.join(); banner(this.guestPkt ? '重新连上啦 ♥' : '连上啦！', 2000); $('btn-menu').classList.remove('hidden'); },
        onDisconnected: () => { Sfx.leave(); banner('连接断开了，正在重新连接…', 0); },
        onMessage: (m) => this.guestMsg(m),
      });
      this.net.join(code);
    },
    modeScreen() {
      const host = this.role !== 'guest';
      $('btn-mode-coop').disabled = !host; $('btn-mode-vs').disabled = !host;
      $('mode-wait').classList.toggle('hidden', host);
      $('mode-sub').textContent = this.role === 'local' ? `同一台设备：${NAMES[0]}（黑猫）用 WASD，${NAMES[1]}（白猫）用方向键` : (host ? `${BOTH} 都到齐啦！你来选：` : `${BOTH} 都到齐啦！`);
      document.querySelectorAll('.host-only').forEach(b => b.classList.toggle('hidden', !host));
    },
    pickMode(m) {
      if (this.role === 'guest' || !this.session) return;
      Sfx.click(); this.session.setMode(m); this.sendState(true);
    },
    again() {
      Sfx.click();
      if (this.role === 'guest') { this.net && this.net.send({ t: 'again' }); return; }
      if (this.session && this.session.mode !== 'pick') { this.session.setMode(this.session.mode); this.sendState(true); }
    },
    backToModes() {
      if (this.role === 'guest' || !this.session) return;
      Sfx.click(); this.session.mode = 'pick'; this.session.mk++; this.session.game = null; this.sendState(true);
    },
    restart() {
      const now = performance.now(); if (now - this.lastRestart < 400) return; this.lastRestart = now;
      if (this.role === 'guest') { this.net && this.net.send({ t: 'restart' }); return; }
      const g = this.session && this.session.game;
      if (g && g instanceof CoopGame) g.restart();
    },
    meow(i) {
      if (this.role === 'guest') { this.net && this.net.send({ t: 'meow' }); return; }
      if (this.session) this.session.events.push(['meow', i]);
    },
    hostMsg(m) {
      if (!m) return;
      if (m.t === 'i') {
        if (m.j && !this.remote.j) this.rTapJ = true;
        if (m.a && !this.remote.a) this.rTapA = true;
        this.remote = { l: !!m.l, r: !!m.r, j: !!m.j, d: !!m.d, a: !!m.a };
      } else if (m.t === 'restart') this.restart();
      else if (m.t === 'meow') this.session.events.push(['meow', 1]);
      else if (m.t === 'again') { const ph = this.session.snapshot(); if (ph && (ph.ph === 'end' || ph.ph === 'matchEnd')) this.again(); }
    },
    guestMsg(m) {
      if (!m || m.t !== 's') return;
      const now = performance.now();
      const pkt = { at: now, m: m.m, mk: m.mk, s: m.s };
      this.buf.push(pkt); if (this.buf.length > 30) this.buf.shift();
      this.guestPkt = pkt;
      if (m.e && m.e.length) Scene.handleEvents(m.e, m.m);
    },
    sendState(force) {
      if (this.role !== 'host' || !this.net || !this.net.connected) return;
      const now = performance.now();
      if (!force && now - this.lastSend < 1000 / CFG.net.snapshotHz) return;
      this.lastSend = now;
      this.net.send({ t: 's', m: this.session.mode, mk: this.session.mk, s: this.session.snapshot(), e: this.pendingEv || [] });
      this.pendingEv = [];
    },
    // fixed-step simulation (host & local)
    acc: 0,
    tick(dtMs) {
      if (this.role === 'guest') {
        const inp = readInput('me'); const str = JSON.stringify(inp); const now = performance.now();
        if (this.net && this.net.connected && (str !== this.lastInputStr || now - this.lastInputSend > 100)) {
          this.net.send(Object.assign({ t: 'i' }, inp)); this.lastInputStr = str; this.lastInputSend = now;
        }
        return;
      }
      if (!this.session || this.role === 'menu') return;
      if (this.paused) { this.acc = 0; return; }
      this.acc += Math.min(dtMs, 100) / 1000;
      while (this.acc >= DT) {
        this.acc -= DT;
        let inputs;
        if (this.role === 'local') inputs = [readInput(0), readInput(1)];
        else {
          const r = Object.assign({}, this.remote);
          if (this.rTapJ) { r.j = true; this.rTapJ = false; }
          if (this.rTapA) { r.a = true; this.rTapA = false; }
          inputs = [readInput('me'), r];
        }
        this.session.step(inputs);
      }
      const ev = this.session.takeEvents();
      if (ev.length) {
        Scene.handleEvents(ev, this.session.mode);
        if (this.role === 'host') (this.pendingEv = this.pendingEv || []).push(...ev);
      }
      this.sendState(false);
    },
    // what to draw this frame: {m, mk, s}
    view() {
      if (this.role === 'guest') return this.interp();
      if (!this.session) return null;
      return { m: this.session.mode, mk: this.session.mk, s: this.session.snapshot() };
    },
    interp() {
      const buf = this.buf; if (!buf.length) return null;
      const t = performance.now() - CFG.net.interpDelayMs;
      let i = buf.length - 1;
      while (i > 0 && buf[i - 1].at > t) i--;
      const b = buf[i], a = buf[i - 1];
      if (!a || a.at > t || a.mk !== b.mk || !a.s || !b.s || a.m !== b.m || (a.s.k !== b.s.k) || (a.s.rn !== b.s.rn) || (a.s.lv !== b.s.lv)) return b;
      const f = Math.max(0, Math.min(1, (t - a.at) / Math.max(1, b.at - a.at)));
      const L = (x, y) => x + (y - x) * f;
      const s = Object.assign({}, b.s);
      const lerpArr = (A, B, n) => (A && B && A.length === B.length) ? B.map((e, k) => { const o = e.slice(); for (let q = 0; q < n; q++) o[q] = L(A[k][q], e[q]); return o; }) : B;
      s.c = lerpArr(a.s.c, b.s.c, 2);
      if (b.s.b) s.b = lerpArr(a.s.b, b.s.b, 2);
      if (b.s.v) s.v = lerpArr(a.s.v, b.s.v, 2);
      if (b.s.cu) s.cu = lerpArr(a.s.cu, b.s.cu, 2);
      return { m: b.m, mk: b.mk, s };
    },
  };
  window.App = App;

  // ---------------------------------------------------------- Phaser scene
  let Scene = null;
  const ATTRACT = {
    name: '', theme: 'garden', map: [
      '..............................', '..............................', '..............................', '..............................',
      '..............................', '..............................', '..............................', '..............................',
      '..............................', '..............................', '..............................', '...=====..............=====...',
      '..............................', '..............................', '..............................', '.......1..............2.......',
      '##############################'] };

  class MainScene extends Phaser.Scene {
    constructor() { super('main'); }
    create() {
      Scene = this;
      Art.build(this);
      fillSprites(this);
      this.staticLayer = this.add.layer().setDepth(0);
      this.pools = {};
      this.catAnim = [0, 1].map(() => ({ nextBlink: 1 + Math.random() * 3, blinkT: 0, label: null }));
      this.cats = [0, 1].map(i => this.add.image(0, 0, `cat${i}_idle0`).setScale(2).setOrigin(0.5, 15 / 16).setDepth(6));
      this.catFx = [0, 1].map(() => ({
        swipe: this.add.image(0, 0, 'swipe').setScale(2).setDepth(7).setVisible(false),
        star: this.add.image(0, 0, 'star').setScale(2).setDepth(7).setVisible(false),
        yarn: this.add.image(0, 0, 'yarn').setScale(2).setDepth(7).setVisible(false),
        ring: this.add.image(0, 0, 'ring').setScale(2).setDepth(7).setVisible(false),
      }));
      this.catFx.forEach((fx, i) => { fx.tag = this.makeNameTag(i); });
      this.fx = this.add.layer().setDepth(8);
      // HUD
      const hud = this.hud = {};
      hud.title = this.add.text(16, 6, '', this.ts(24)).setDepth(20);
      hud.hint = this.add.text(W / 2, 46, '', this.ts(12, '#3a2e4f', '#ffffffcc')).setOrigin(0.5, 0).setDepth(20).setPadding(8, 4, 8, 4);
      hud.fishIcon = this.add.image(W - 132, 20, 'fish').setScale(2).setDepth(20);
      hud.fish = this.add.text(W - 112, 6, '', this.ts(24)).setDepth(20);
      hud.net = this.add.text(12, H - 22, '', this.ts(12, '#ffffff')).setDepth(20).setAlpha(0.8);
      hud.big = this.add.text(W / 2, H / 2 - 60, '', this.ts(48, '#ffffff')).setOrigin(0.5).setDepth(21);
      hud.sub = this.add.text(W / 2, H / 2 + 4, '', this.ts(24, '#ffffff')).setOrigin(0.5).setDepth(21);
      hud.sub2 = this.add.text(W / 2, H / 2 + 44, '', this.ts(12, '#3a2e4f', '#fff6facc')).setOrigin(0.5).setDepth(21).setPadding(8, 4, 8, 4);
      hud.center = this.add.text(W / 2, 6, '', this.ts(24)).setOrigin(0.5, 0).setDepth(20);
      hud.timer = this.add.text(W / 2, 34, '', this.ts(24, '#fff07a')).setOrigin(0.5, 0).setDepth(20);
      hud.side = [0, 1].map(i => ({
        name: this.add.text(i ? W - 16 : 16, 6, '', this.ts(24, i ? '#ffd0e4' : '#ffffff')).setOrigin(i ? 1 : 0, 0).setDepth(20),
        pips: [0, 1, 2].map(k => this.add.image(i ? W - 22 - k * 14 : 22 + k * 14, 44, 'pipEmpty').setScale(2).setDepth(20)),
        icons: [0, 1, 2].map(k => this.add.image(i ? W - 22 - k * 18 : 22 + k * 18, 66, 'heart').setScale(2).setDepth(20)),
        val: this.add.text(i ? W - 46 : 46, 54, '', this.ts(24)).setOrigin(i ? 1 : 0, 0).setDepth(20),
        ficon: this.add.image(i ? W - 26 : 26, 68, 'fish').setScale(2).setDepth(20),
      }));
      this.viewKey = null; this.time0 = 0; this.heartT = 0; this.lastPh = null; this.lastCount = -1; this.confettiT = 0;
      this.showAttract();
      App.toMenu();
      if (qs.get('room')) { $('join-code').value = qs.get('room').toUpperCase(); App.joinRoom(qs.get('room')); }
    }
    // small pixel "pill" name tag above a cat (black cat: light text on dark; white cat: dark text on light)
    makeNameTag(i) {
      const dark = i === 0;
      const fill = dark ? 0x2b2340 : 0xfff6fa, edge = dark ? 0xfff6fa : 0x3a2e4f;
      const txt = this.add.text(0, 0, NAMES[i], { fontFamily: FONT, fontSize: '12px', color: dark ? '#fff6fa' : '#3a2e4f', resolution: 1 });
      const tw = Math.ceil(txt.width), th = Math.ceil(txt.height);
      const w = Math.max(20, tw + 10 + ((tw + 10) % 2)), h = 16, x0 = -w / 2, y0 = -h;
      const g = this.add.graphics();
      g.fillStyle(0x3a2e4f, 0.35).fillRect(x0 + 2, y0 + 2, w - 2, h - 1);          // soft drop shadow
      g.fillStyle(edge, 1).fillRect(x0 + 1, y0, w - 2, h).fillRect(x0, y0 + 1, w, h - 2); // outline (pixel-rounded)
      g.fillStyle(fill, 1).fillRect(x0 + 2, y0 + 1, w - 4, h - 2).fillRect(x0 + 1, y0 + 2, w - 2, h - 4);
      g.fillStyle(edge, 1).fillRect(-2, 0, 4, 1).fillRect(-1, 1, 2, 1);           // little pointer
      txt.setPosition(Math.round(-tw / 2), y0 + Math.floor((h - th) / 2));
      const c = this.add.container(0, 0, [g, txt]).setDepth(9).setVisible(false); c.tagW = w; return c;
    }
    ts(size, color = '#ffffff', bg) {
      const o = { fontFamily: FONT, fontSize: size + 'px', color, resolution: 1 };
      if (bg) o.backgroundColor = bg; else o.shadow = { offsetX: size >= 24 ? 2 : 1, offsetY: size >= 24 ? 2 : 1, color: '#3a2e4f', blur: 0, fill: true };
      return o;
    }
    // ----- attract mode on the title screen
    showAttract() {
      this.attract = new Sim(0, [ATTRACT], CFG.physics);
      this.attractAI = [{ dir: 1, t: 0 }, { dir: -1, t: 0 }];
      this.viewKey = null;
    }
    stepAttract(dt) {
      const sim = this.attract, inputs = [];
      for (let i = 0; i < 2; i++) {
        const ai = this.attractAI[i]; ai.t -= dt;
        if (ai.t <= 0) { ai.t = 0.6 + Math.random() * 1.8; ai.dir = Math.random() < 0.3 ? 0 : (Math.random() < 0.5 ? -1 : 1); ai.jump = Math.random() < 0.35; }
        const c = sim.cats[i];
        if (c.x < 80) ai.dir = 1; if (c.x > W - 110) ai.dir = -1;
        inputs.push({ l: ai.dir < 0, r: ai.dir > 0, j: ai.jump && ai.t > 0.4 });
      }
      sim.step(inputs); sim.takeEvents();
      return { m: 'attract', mk: 0, s: sim.snapshot() };
    }

    // ----- static level graphics
    buildView(key, map, theme, coopLv) {
      this.viewKey = key;
      this.staticLayer.removeAll(true);
      Object.values(this.pools).forEach(p => p.forEach(s => s.destroy())); this.pools = {};
      this.staticLayer.add(this.add.image(0, 0, 'bg_' + theme).setOrigin(0).setScale(2));
      const wall = (r, c) => r >= 0 && r < map.length && map[r][c] === '#';
      for (let r = 0; r < map.length; r++) for (let c = 0; c < map[r].length; c++) {
        const ch = map[r][c];
        if (ch === '#') this.staticLayer.add(this.add.image(c * T, r * T, `t_${theme}_${(r > 0 && !wall(r - 1, c)) ? 'top' : 'fill'}`).setOrigin(0).setScale(2));
        else if (ch === '=') this.staticLayer.add(this.add.image(c * T, r * T, `t_${theme}_plank`).setOrigin(0).setScale(2));
      }
      this.coopInfo = null;
      if (coopLv != null) {
        const s = new Sim(coopLv, LEVELS, CFG.physics);
        const info = this.coopInfo = { doors: [], plates: [], fish: [], boxes: [], house: null, glow: null };
        if (s.goal) {
          info.house = this.add.image(s.goal.x + s.goal.w / 2, s.goal.y + s.goal.h, 'house').setOrigin(0.5, 1).setScale(2).setDepth(2);
          info.glow = this.add.image(s.goal.x + s.goal.w / 2, s.goal.y + 8, 'sparkle').setScale(2).setDepth(2).setVisible(false);
          this.staticLayer.add([info.house, info.glow]);
        }
        s.doors.forEach(d => {
          const cl = this.add.image(d.x, d.y, 'door_' + d.ch).setOrigin(0).setScale(2).setDepth(3);
          const op = this.add.image(d.x, d.y, 'doorO_' + d.ch).setOrigin(0).setScale(2).setDepth(3);
          this.staticLayer.add([op, cl]); info.doors.push({ cl, op });
        });
        s.plates.forEach(p => {
          const img = this.add.image(p.x - 1, p.y - 2, 'plate_' + p.ch).setOrigin(0).setScale(2).setDepth(3);
          this.staticLayer.add(img); info.plates.push({ img, ch: p.ch });
        });
        s.fish.forEach(f => { const img = this.add.image(f.x + 10, f.y + 8, 'fish').setScale(2).setDepth(4); this.staticLayer.add(img); info.fish.push({ img, y: f.y + 8 }); });
        s.boxes.forEach(() => { const img = this.add.image(0, 0, 'box').setOrigin(0).setScale(2).setDepth(5); this.staticLayer.add(img); info.boxes.push(img); });
        info.total = s.fish.length;
      }
    }
    pool(name, i, tex) {
      const p = this.pools[name] || (this.pools[name] = []);
      if (!p[i]) p[i] = this.add.image(0, 0, tex).setScale(2).setDepth(name === 'vac' ? 5 : 4);
      const s = p[i]; if (s.texture.key !== tex) s.setTexture(tex); s.setVisible(true); return s;
    }
    hidePool(name, from) { (this.pools[name] || []).forEach((s, i) => { if (i >= from) s.setVisible(false); }); }

    update(time, delta) {
      const dt = Math.min(delta, 100) / 1000;
      this.time0 += dt;
      App.tick(delta);
      let v = App.view();
      // screens follow state
      if (App.role !== 'menu') this.syncScreens(v);
      const inMenu = App.role === 'menu' || !v || !v.s || v.m === 'pick';
      if (inMenu) v = this.stepAttract(dt);
      // build the static view if needed
      let key, map, theme, lv = null;
      if (v.m === 'attract') { key = 'attract'; map = ATTRACT.map; theme = 'garden'; }
      else if (v.m === 'coop') { key = `c${v.mk}_${v.s.lv}_${v.s.k}`; map = LEVELS[v.s.lv].map; theme = LEVELS[v.s.lv].theme || 'garden'; lv = v.s.lv; }
      else { const d = VS_GAMES[v.s.gt]; key = `v${v.mk}_${v.s.rn}`; map = d.map; theme = d.theme || 'room'; }
      if (key !== this.viewKey) this.buildView(key, map, theme, lv);
      this.drawCats(v);
      if (v.m === 'coop') this.drawCoop(v.s); else this.hidePool('none', 0);
      if (v.m === 'vs') this.drawVs(v.s);
      this.drawHud(v);
      this.ambient(v, dt);
    }

    syncScreens(v) {
      const role = App.role;
      if (role === 'guest' && !App.guestPkt) return; // still joining
      if (role === 'host' && !(App.net && App.net.everConnected)) return; // lobby
      if (role === 'host' && !App.net.connected && (!v || v.m === 'pick')) return; // partner left while picking
      const m = v && v.m;
      if (!v || m === 'pick') { if (curScreen !== 'screen-mode') { show('screen-mode'); App.modeScreen(); Sfx.music('title'); } return; }
      if (m === 'coop' && v.s.ph === 'end') {
        if (curScreen !== 'screen-end') {
          show('screen-end'); App.modeScreen();
          $('end-title').textContent = fmt(CFG.endingTitle); $('end-msg').textContent = fmt(CFG.endingMessage);
          $('end-fish').textContent = `${BOTH} 一共收集了 ${v.s.ft} 条小鱼 · 谢谢你一直陪着我`;
        }
        return;
      }
      if (m === 'vs' && v.s.ph === 'matchEnd') {
        if (curScreen !== 'screen-vsend') {
          show('screen-vsend'); App.modeScreen();
          const w = v.s.mw;
          $('vs-title').textContent = w < 0 ? `平局！${BOTH} 都是最棒的猫` : `${NAMES[w]} 赢啦！`;
          $('vs-winner-img').src = this.textures.get(w === 1 ? 'cat1_happy' : 'cat0_happy').getSourceImage().toDataURL();
          $('vs-score').innerHTML = `<span class="nm">${esc(NAMES[0])}</span> <span class="p0">${v.s.w[0]}</span> : <span class="p1">${v.s.w[1]}</span> <span class="nm">${esc(NAMES[1])}</span>`;
          $('vs-history').textContent = v.s.h.map((x, i) => `第${i + 1}局 ${x < 0 ? '平' : SHORT[x]}`).join(' · ');
        }
        return;
      }
      if (curScreen) show(null);
      Sfx.music(m === 'vs' ? 'vs' : 'coop');
    }

    catFrame(i, st, happy, t) {
      const a = this.catAnim[i];
      const [x, y, vx, vy, ground, face, flags = 0] = st;
      if (flags & 2) return 'dizzy';
      if (happy) return (t % 0.6 < 0.3) ? 'happy' : 'happy2';
      if (!ground) return 'jump';
      if (Math.abs(vx) > 25) return 'walk' + (Math.floor(t * 10) % 4);
      a.nextBlink -= 1 / 60;
      if (a.nextBlink <= 0) { a.blinkT = 0.15; a.nextBlink = 2 + Math.random() * 3; }
      if (a.blinkT > 0) { a.blinkT -= 1 / 60; return 'blink'; }
      return (t % 1.4 < 0.7) ? 'idle0' : 'idle1';
    }
    drawCats(v) {
      const s = v.s, t = this.time0;
      for (let i = 0; i < 2; i++) {
        const st = s.c[i], spr = this.cats[i], fx = this.catFx[i];
        if (!st) { spr.setVisible(false); continue; }
        const flags = st[6] || 0;
        let happy = false;
        if (v.m === 'coop') happy = s.g === 1 || s.ph !== 'play';
        if (v.m === 'vs') happy = (s.ph === 'roundEnd' && s.rw === i) || (s.ph === 'matchEnd' && s.mw === i);
        if (v.m === 'attract') happy = false;
        const fr = this.catFrame(i, st, happy, t + i * 0.37);
        spr.setTexture(`cat${i}_${fr}`).setFlipX(st[5] < 0).setVisible(!(flags & 1));
        spr.setPosition(Math.round(st[0] + 13), Math.round(st[1] + 24));
        spr.setAlpha((flags & 4) && Math.floor(t * 12) % 2 ? 0.35 : 1);
        const cx = st[0] + 13, top = st[1] - 6;
        fx.swipe.setVisible(!!(flags & 16) && !(flags & 1)).setPosition(cx + st[5] * 30, st[1] + 10).setFlipX(st[5] < 0);
        fx.star.setVisible(!!(flags & 2) && !(flags & 1)).setPosition(cx + Math.cos(t * 10) * 12, top + Math.sin(t * 10) * 3);
        fx.yarn.setVisible(!!(flags & 8) && !(flags & 1)).setPosition(cx + Math.cos(t * 4) * 18, st[1] - 4 + Math.sin(t * 4) * 4);
        fx.ring.setVisible(false);
        // name tags: who is who
        fx.tag.setPosition(Math.round(cx), Math.round(top - 4)).setVisible(!(flags & 1));
      }
      // keep the two name tags readable when the cats overlap (stacking, cuddling)
      const [A, B] = this.catFx.map(f => f.tag);
      if (A.visible && B.visible) {
        const need = (A.tagW + B.tagW) / 2 + 2, dx = B.x - A.x;
        if (Math.abs(B.y - A.y) < 18 && Math.abs(dx) < need) {
          const push = Math.ceil((need - Math.abs(dx)) / 2), dir = dx > 0 || (dx === 0) ? 1 : -1;
          A.x -= push * dir; B.x += push * dir;
        }
      }
    }
    drawCoop(s) {
      const info = this.coopInfo; if (!info) return;
      info.doors.forEach((d, i) => { const o = s.d[i] || 0; d.cl.setAlpha(1 - o).setVisible(o < 0.98); d.op.setVisible(o > 0.02); });
      info.plates.forEach((p, i) => p.img.setTexture((s.p[i] ? 'plateP_' : 'plate_') + p.ch));
      info.fish.forEach((f, i) => { f.img.setVisible(!s.f[i]); f.img.y = Math.round(f.y + Math.sin(this.time0 * 3 + i) * 2); });
      info.boxes.forEach((b, i) => { if (s.b[i]) b.setPosition(Math.round(s.b[i][0]), Math.round(s.b[i][1])); });
      if (info.glow) { info.glow.setVisible(s.g === 1 || s.ph !== 'play'); info.glow.setAlpha(Math.floor(this.time0 * 6) % 2 ? 1 : 0.4); }
    }
    drawVs(s) {
      // items
      (s.it || []).forEach((it, i) => {
        const spr = this.pool('item', i, it[0]);
        spr.setPosition(Math.round(it[1] + 10), Math.round(it[2] + 8 + Math.sin(this.time0 * 4 + i) * 2));
        spr.setAlpha(it[3] && Math.floor(this.time0 * 8) % 2 ? 0.3 : 1);
      });
      this.hidePool('item', (s.it || []).length);
      (s.v || []).forEach((v, i) => { this.pool('vac', i, 'vacuum').setOrigin(0, 1).setPosition(Math.round(v[0] - 1), Math.round(v[1] + 21)).setFlipX(v[2] > 0); });
      this.hidePool('vac', (s.v || []).length);
      let n = 0, m = 0;
      (s.cu || []).forEach((c) => {
        if (c[2] === 1) { const sh = this.pool('shadow', n++, 'shadow'); sh.setPosition(c[0] + 10, 506).setAlpha(Math.floor(this.time0 * 10) % 2 ? 0.55 : 0.2); }
        else if (c[2] === 0) { const cu = this.pool('cup', m++, 'cup'); cu.setPosition(Math.round(c[0] + 11), Math.round(c[1] + 12)).setAlpha(1).setAngle(0); }
        else { const cu = this.pool('cup', m++, 'shard'); cu.setPosition(Math.round(c[0] + 10), 506).setAlpha(0.9); }
      });
      this.hidePool('shadow', n); this.hidePool('cup', m);
    }
    drawHud(v) {
      const h = this.hud, s = v.s, coop = v.m === 'coop', vs = v.m === 'vs';
      [h.title, h.hint, h.fishIcon, h.fish].forEach(o => o.setVisible(coop));
      [h.center, h.timer].forEach(o => o.setVisible(vs));
      h.side.forEach(sd => { sd.name.setVisible(vs); sd.pips.forEach(p => p.setVisible(vs)); sd.icons.forEach(p => p.setVisible(false)); sd.val.setVisible(false); sd.ficon.setVisible(false); });
      h.net.setVisible(App.role !== 'menu' && v.m !== 'attract');
      if (App.role === 'local') h.net.setText(`本地双人 · ${NAMES[0]} WASD+F  ${NAMES[1]} 方向键+回车`);
      else if (App.net) h.net.setText(App.net.connected ? `在线 · 房间 ${App.net.code} · 延迟 ${Math.round(App.net.rtt)}ms` : '连接中…');
      let big = '', sub = '', sub2 = '';
      if (coop) {
        const L = LEVELS[s.lv];
        h.title.setText(`第${s.lv + 1}/${LEVELS.length}关 · ${L.name}`);
        h.hint.setText(L.hint);
        h.fish.setText(`${s.f.filter(Boolean).length}/${s.f.length}`);
        if (s.ph === 'clear') { big = s.lv + 1 >= LEVELS.length ? '到家啦！' : '过关啦！'; sub = `${BOTH} 都到啦 ♥`; }
        if (App.paused) sub2 = `暂停中：等待 ${NAMES[1 - App.me]} 重新连接`;
      }
      if (vs) {
        const d = VS_GAMES[s.gt];
        h.center.setText(`第${s.rn}局 · ${d.name}`);
        h.timer.setText(s.ph === 'play' || s.ph === 'roundEnd' ? String(s.tl) : '');
        for (let i = 0; i < 2; i++) {
          const sd = h.side[i];
          sd.name.setText(NAMES[i]);
          sd.pips.forEach((p, k) => p.setTexture(k < s.w[i] ? 'pip' : 'pipEmpty'));
          if (s.gt === 'fish') { sd.ficon.setVisible(true); sd.val.setVisible(true).setText(String(s.sc[i])); }
          else sd.icons.forEach((p, k) => p.setVisible(true).setTexture(k < s.li[i] ? 'heart' : 'heartEmpty'));
        }
        if (s.ph === 'intro') {
          const n = 3 - Math.floor(s.pt || 0);
          big = d.name; sub = n > 0 ? String(n) : '开始！'; sub2 = d.hint;
          if (n !== this.lastCount) { this.lastCount = n; if (n > 0 && n <= 3) Sfx.tick(); }
        } else this.lastCount = -1;
        if (s.ph === 'roundEnd') { big = s.rw < 0 ? '平局！' : `${SHORT[s.rw]} 赢了这一局！`; sub = `${NAMES[0]} ${s.w[0]} : ${s.w[1]} ${NAMES[1]}`; }
        if (s.ph === 'play' && s.tl <= 5 && s.tl > 0) sub = String(s.tl);
        if (App.paused) sub2 = `暂停中：等待 ${NAMES[1 - App.me]} 重新连接`;
      }
      if (App.role === 'guest' && App.net && !App.net.connected && App.guestPkt) sub2 = '连接断开了，正在重新连接…';
      h.big.setText(big); h.sub.setText(sub); h.sub2.setText(sub2).setVisible(!!sub2);
    }
    ambient(v, dt) {
      const s = v.s;
      // hearts when the two cats cuddle (close & still)
      this.heartT -= dt;
      const a = s.c[0], b = s.c[1];
      if (a && b && this.heartT <= 0 && Math.abs(a[0] - b[0]) < 40 && Math.abs(a[1] - b[1]) < 40 && Math.abs(a[2]) < 5 && Math.abs(b[2]) < 5 && v.m !== 'vs') {
        this.heartT = 1.2; this.spawnHeart((a[0] + b[0]) / 2 + 13, Math.min(a[1], b[1]) - 6);
      }
      // celebration confetti at the end of a match / co-op ending
      const party = (v.m === 'vs' && s.ph === 'matchEnd') || (v.m === 'coop' && (s.ph === 'end' || s.ph === 'clear'));
      if (party) {
        this.confettiT -= dt;
        if (this.confettiT <= 0) {
          this.confettiT = 0.06;
          const img = this.add.image(Math.random() * W, -10, Math.random() < 0.5 ? 'heart' : 'sparkle').setScale(2).setDepth(19);
          this.tweens.add({ targets: img, y: H + 20, x: img.x + (Math.random() - 0.5) * 120, duration: 2200 + Math.random() * 1200, onComplete: () => img.destroy() });
        }
      }
    }
    spawnHeart(x, y, n = 1) {
      for (let k = 0; k < n; k++) {
        const img = this.add.image(x + (Math.random() - 0.5) * 20 * (n > 1 ? 2 : 1), y, 'heart').setScale(2).setDepth(8);
        this.tweens.add({ targets: img, y: y - 50 - Math.random() * 20, alpha: 0, duration: 1100, ease: 'Stepped', easeParams: [8], onComplete: () => img.destroy() });
      }
    }
    sparkle(x, y, n = 4, tex = 'sparkle') {
      for (let k = 0; k < n; k++) {
        const img = this.add.image(x, y, tex).setScale(2).setDepth(8);
        const ang = Math.random() * Math.PI * 2, r = 20 + Math.random() * 20;
        this.tweens.add({ targets: img, x: x + Math.cos(ang) * r, y: y + Math.sin(ang) * r, alpha: 0, duration: 500, onComplete: () => img.destroy() });
      }
    }
    bubble(i, text = '喵~') {
      const c = this.cats[i]; if (!c.visible) return;
      const t = this.add.text(c.x, c.y - 44, text, this.ts(12, '#3a2e4f', '#ffffff')).setOrigin(0.5, 1).setDepth(9).setPadding(6, 3, 6, 3);
      this.tweens.add({ targets: t, y: t.y - 16, alpha: 0, delay: 600, duration: 500, onComplete: () => t.destroy() });
    }
    catPos(i) { const c = this.cats[i]; return { x: c.x, y: c.y - 16 }; }
    handleEvents(evs, mode) {
      for (const e of evs) {
        const [k, i] = e;
        const p = (typeof i === 'number' && i >= 0 && i < 2) ? this.catPos(i) : { x: W / 2, y: H / 2 };
        switch (k) {
          case 'jump': Sfx.jump(); break;
          case 'land': Sfx.land(); break;
          case 'stack': Sfx.stack(); this.spawnHeart(p.x, p.y - 10, 2); break;
          case 'fish':
            if (mode === 'vs' && e[2] === 3) Sfx.gold(); else Sfx.fish();
            this.sparkle(p.x, p.y, 4); break;
          case 'plate': Sfx.plate(); break;
          case 'door': Sfx.door(); break;
          case 'clear': Sfx.clear(); this.spawnHeart(p.x, p.y, 6); break;
          case 'level': case 'restart': break;
          case 'ending': Sfx.ending(); break;
          case 'meow': Sfx.meow(i ? 1.25 : 1); this.bubble(i, i ? '喵~♥' : '喵！'); break;
          case 'swipe': Sfx.swipe(); break;
          case 'bigswipe': {
            Sfx.swipe(); Sfx.power();
            const r = this.add.image(p.x, p.y + 8, 'ring').setScale(1).setDepth(8);
            this.tweens.add({ targets: r, scale: 4, alpha: 0, duration: 350, onComplete: () => r.destroy() });
            break;
          }
          case 'hit': Sfx.hit(); this.sparkle(p.x, p.y, 5, 'star'); this.cameras.main.shake(120, 0.004); break;
          case 'steal': this.bubble(i, `抢到 ${e[2]} 条！`); break;
          case 'power': Sfx.power(); this.bubble(i, '超级拍拍！'); break;
          case 'fall': Sfx.fall(); break;
          case 'spawn': break;
          case 'ouch': Sfx.ouch(); this.sparkle(p.x, p.y, 4, 'star'); this.cameras.main.shake(100, 0.004); break;
          case 'out': Sfx.lose(); break;
          case 'crash': Sfx.crash(); break;
          case 'vac': Sfx.ouch(); banner('又来了一台扫地机！', 1800); break;
          case 'round': Sfx.round(); break;
          case 'go': Sfx.go(); break;
          case 'roundover': if (e[1] >= 0) { Sfx.clear(); } else Sfx.lose(); break;
          case 'matchover': Sfx.ending(); break;
          case 'mode': break;
        }
      }
    }
  }

  // ---------------------------------------------------------- wire up DOM
  function wire() {
    $('btn-create').onclick = () => { Sfx.unlock(); Sfx.click(); App.createRoom(); };
    $('btn-join').onclick = () => { Sfx.unlock(); Sfx.click(); App.joinRoom($('join-code').value); };
    $('join-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
    $('join-code').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Za-z]/g, ''); });
    $('btn-local').onclick = () => { Sfx.unlock(); Sfx.click(); App.startLocal(); };
    $('btn-copy').onclick = async () => {
      const v = $('lobby-link').value; if (!v) return;
      try { await navigator.clipboard.writeText(v); } catch (e) { $('lobby-link').select(); try { document.execCommand('copy'); } catch (e2) {} }
      $('btn-copy').textContent = '已复制'; setTimeout(() => $('btn-copy').textContent = '复制', 1500);
    };
    $('btn-lobby-back').onclick = () => App.toMenu();
    $('btn-join-back').onclick = () => App.toMenu();
    $('btn-mode-coop').onclick = () => App.pickMode('coop');
    $('btn-mode-vs').onclick = () => App.pickMode('vs');
    $('btn-mode-back').onclick = () => App.toMenu();
    $('btn-again').onclick = () => App.again();
    $('btn-rematch').onclick = () => App.again();
    $('btn-end-mode').onclick = () => App.backToModes();
    $('btn-vs-mode').onclick = () => App.backToModes();
    $('btn-end-menu').onclick = () => App.toMenu();
    $('btn-vs-menu').onclick = () => App.toMenu();
    $('btn-menu').onclick = () => { if (App.role === 'local' || confirm('离开房间，回到主菜单？')) App.toMenu(); };
    const mute = $('btn-mute');
    const paint = () => mute.classList.toggle('off', Sfx.muted);
    mute.onclick = () => { Sfx.unlock(); Sfx.toggleMute(); paint(); };
    paint();
    setupTouch();
    document.addEventListener('pointerdown', () => Sfx.unlock(), { once: false, passive: true });
    // touch layout follows the game mode
    setInterval(() => {
      const v = App.view(); const tc = $('touch');
      const playing = App.isTouch && App.role !== 'menu' && v && v.s && v.m !== 'pick' && !curScreen;
      tc.classList.toggle('hidden', !playing);
      tc.classList.toggle('coop', !!(v && v.m === 'coop')); tc.classList.toggle('vs', !!(v && v.m === 'vs'));
    }, 250);
  }

  // ---------------------------------------------------------- boot (wait for the pixel font)
  function boot() {
    fillNames();
    wire();
    new Phaser.Game({
      type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#2d2650',
      pixelArt: true, roundPixels: true, antialias: false,
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      input: { keyboard: false },
      scene: [MainScene],
      fps: { target: 60 },
    });
  }
  const fontReady = (document.fonts && document.fonts.load) ? Promise.race([
    Promise.all([document.fonts.load('24px Zpix', '喵喵成行ABC123'), document.fonts.load('12px Zpix', '喵')]),
    new Promise(r => setTimeout(r, 4000)),
  ]).catch(() => {}) : Promise.resolve();
  fontReady.then(boot);
})();
