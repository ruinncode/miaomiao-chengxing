// ============================================================
//  CatSim — tiny deterministic platformer physics (no Phaser).
//  The host (or local mode) runs this; guests only render snapshots.
// ============================================================
(function (root) {
  const T = 32;
  const CAT_W = 26, CAT_H = 24, BOX_S = 30;
  const DT = 1 / 60;

  function overlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  class Sim {
    constructor(levelIndex, levels, physics) {
      this.levels = levels;
      this.P = physics;
      this.load(levelIndex);
    }

    load(idx) {
      const L = this.levels[idx];
      this.levelIndex = idx;
      this.rows = L.map.length;
      this.cols = L.map[0].length;
      this.W = this.cols * T; this.H = this.rows * T;
      this.grid = [];       // true = wall
      this.doors = []; this.plates = []; this.fish = []; this.boxes = [];
      this.doorAt = {};     // "c,r" -> door
      this.levers = []; this.bridgeAt = {}; this.bridges = []; this.springs = []; this.pads = []; this.switches = [];
      this.water = []; this.convs = []; this.latch = {}; this.timer = {}; this.swapped = false; this.leverOn = false;
      this.convDir = 1; this.convT = 0; this.flipConv = !!L.flipConv; this.boss = null; this.bossBtns = [];
      let spawns = [];
      let gx0 = 1e9, gy0 = 1e9, gx1 = -1, gy1 = -1;
      for (let r = 0; r < this.rows; r++) {
        this.grid.push([]);
        for (let c = 0; c < this.cols; c++) {
          const ch = L.map[r][c];
          this.grid[r].push(ch === '#' ? 1 : ch === '=' ? 2 : ch === 'd' ? 3 : ch === 'w' ? 4 : (ch === '<' || ch === '>') ? 5 : 0);
          if (ch === '<' || ch === '>') this.convs.push({ c, r, dir: ch === '>' ? 1 : -1 });
          if (ch === 'k') this.levers.push({ x: c * T + 4, y: r * T, w: 24, h: T, c, r });
          if (ch === 'X') this.switches.push({ x: c * T + 4, y: r * T, w: 24, h: T, c, r });
          if (ch === 'H') { const b = { c, r }; this.bridges.push(b); this.bridgeAt[c + ',' + r] = b; }
          if (ch === '^') this.springs.push({ x: c * T + 2, y: (r + 1) * T - 10, w: 28, h: 10, c, r, t: 0 });
          if (ch === 'P') this.pads.push({ x: c * T + 1, y: (r + 1) * T - 10, w: 30, h: 10, c, r, t: 0 });
          if (ch === '~') this.water.push({ x: c * T, y: r * T + 8, w: T, h: T - 8, c, r });
          if (ch === '1' || ch === '2') spawns[+ch - 1] = { x: c * T + (T - CAT_W) / 2, y: (r + 1) * T - CAT_H };
          else if (ch === 'G') { gx0 = Math.min(gx0, c); gy0 = Math.min(gy0, r); gx1 = Math.max(gx1, c); gy1 = Math.max(gy1, r); }
          else if (ch === 'O') this.boxes.push({ x: c * T + (T - BOX_S) / 2, y: (r + 1) * T - BOX_S, w: BOX_S, h: BOX_S, vy: 0, kind: 'box' });
          else if (ch === '*') this.fish.push({ x: c * T + 6, y: r * T + 8, w: 20, h: 16, got: false });
          else if ('abcutpq'.includes(ch)) this.plates.push({ ch, x: c * T + 3, y: (r + 1) * T - 6, w: 26, h: 6, pressed: false });
          else if ('ABCUTQ'.includes(ch)) {
            const d = { ch: ch.toLowerCase(), c, r, x: c * T, y: r * T, w: T, h: T, solid: true, open: 0 };
            this.doors.push(d); this.doorAt[c + ',' + r] = d;
          }
        }
      }
      this.goal = gx1 < 0 ? null : { x: gx0 * T, y: gy0 * T, w: (gx1 - gx0 + 1) * T, h: (gy1 - gy0 + 1) * T };
      this.cats = spawns.map((s, i) => ({
        id: i, x: s.x, y: s.y, w: CAT_W, h: CAT_H, vx: 0, vy: 0, face: i === 0 ? 1 : 1,
        onGround: true, standOn: null, coyote: 0, jbuf: 0, jprev: false, pushing: false,
        spawnX: s.x, spawnY: s.y, dx: 0, dy: 0, kind: 'cat', stun: 0, dead: false, dropT: 0, aprev: false,
      }));
      if (L.boss) this.boss = { x: L.boss.x * T, y: (L.boss.r + 1) * T - 44, w: 92, h: 44, dir: -1, spd: L.boss.spd || 110, hp: L.boss.hp || 3, stun: 0, hitT: 0, x0: L.boss.x0 * T, x1: L.boss.x1 * T };
      this.bossPress = {};
      this.events = [];
      this.time = 0;
      this.goalTimer = 0;
      this.cleared = false;
      this.updateSwitches();
    }

    // ---------- collision helpers ----------
    tileSolid(c, r, e) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return this.outOfBoundsSolid(c, r);
      const g = this.grid[r][c];
      if (g === 1 || g === 5) return true;
      if (g === 3 || g === 4) { // dark blocks only for the black cat (id 0), light only for id 1; boxes collide with both
        if (!e || e.kind !== 'cat') return true;
        const dark = (g === 3) !== this.swapped;
        return dark ? e.id === 0 : e.id === 1;
      }
      if (this.leverOn && this.bridgeAt[c + ',' + r]) return true;
      const d = this.doorAt[c + ',' + r];
      return !!(d && d.solid);
    }
    outOfBoundsSolid() { return true; }
    hitTiles(e) { // returns list of solid tile rects overlapping e
      const out = [];
      const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 0.001) / T);
      const r0 = Math.floor(e.y / T), r1 = Math.floor((e.y + e.h - 0.001) / T);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
        if (this.tileSolid(c, r, e)) out.push({ x: c * T, y: r * T, w: T, h: T });
      return out;
    }

    // move a box horizontally by dx; returns actual moved amount
    moveBoxX(b, dx) {
      const x0 = b.x;
      b.x += dx;
      for (const t of this.hitTiles(b)) b.x = dx > 0 ? Math.min(b.x, t.x - b.w) : Math.max(b.x, t.x + t.w);
      for (const o of this.boxes) if (o !== b && overlap(b, o)) b.x = dx > 0 ? o.x - b.w : o.x + o.w;
      return b.x - x0;
    }

    moveCatX(cat, dx) {
      cat.x += dx;
      cat.pushing = false;
      for (const t of this.hitTiles(cat)) cat.x = dx > 0 ? Math.min(cat.x, t.x - cat.w) : Math.max(cat.x, t.x + t.w);
      for (const b of this.boxes) {
        if (!overlap(cat, b)) continue;
        // only push if mostly beside the box (not standing on it)
        if (cat.y + cat.h <= b.y + 4) continue;
        const need = dx > 0 ? (cat.x + cat.w) - b.x : (cat.x) - (b.x + b.w);
        if ((dx > 0 && need > 0) || (dx < 0 && need < 0)) {
          this.moveBoxX(b, need);
          cat.pushing = true;
          cat.x = dx > 0 ? Math.min(cat.x, b.x - cat.w) : Math.max(cat.x, b.x + b.w);
        }
      }
    }

    moveY(e, dy) {
      const prevBottom = e.y + e.h;
      e.y += dy;
      let landed = null, bumped = false;
      for (const t of this.hitTiles(e)) {
        if (dy > 0) { e.y = Math.min(e.y, t.y - e.h); landed = 'tile'; }
        else { e.y = Math.max(e.y, t.y + t.h); bumped = true; }
      }
      for (const b of this.boxes) {
        if (b === e || !overlap(e, b)) continue;
        if (dy > 0) { e.y = b.y - e.h; landed = b; }
        else { e.y = b.y + b.h; bumped = true; }
      }
      if (dy > 0 && !(e.dropT > 0)) { // one-way platforms ('=')
        const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 0.001) / T);
        const r = Math.floor((e.y + e.h - 0.001) / T);
        for (let c = c0; c <= c1; c++) {
          if (r >= 0 && r < this.rows && c >= 0 && c < this.cols && this.grid[r][c] === 2 && prevBottom <= r * T + 0.5) {
            e.y = Math.min(e.y, r * T - e.h); landed = landed || 'tile';
          }
        }
      }
      if (e.kind === 'cat' && dy >= 0) {
        for (const o of this.cats) {
          if (o === e || o.dead) continue;
          const hx = e.x + 3 < o.x + o.w && e.x + e.w - 3 > o.x;
          if (hx && prevBottom <= o.y + 12 && e.y + e.h > o.y) { e.y = o.y - e.h; landed = o; }
        }
      }
      return { landed, bumped };
    }

    // ---------- main step ----------
    // inputs: [{l,r,j}, {l,r,j}]
    step(inputs) {
      const P = this.P;
      this.time += DT;
      // boxes fall
      for (const b of this.boxes) {
        b.vy = Math.min(b.vy + P.gravity * DT, P.maxFall);
        const res = this.moveY(b, b.vy * DT);
        if (res.landed || res.bumped) b.vy = 0;
      }
      // lower cats first, so riders can be carried
      const order = this.cats.slice().sort((a, b) => (b.y - a.y));
      for (const cat of order) {
        if (cat.dead) continue;
        let inp = inputs[cat.id] || {};
        if (cat.stun > 0) { cat.stun -= DT; inp = {}; }
        if (inp.d && cat.onGround) cat.dropT = 0.22;
        cat.dropT = Math.max(0, cat.dropT - DT);
        const x0 = cat.x, y0 = cat.y;
        // carried by the cat below
        if (cat.standOn && cat.standOn.kind === 'cat') {
          const s = cat.standOn;
          if (s.dx) this.moveCatX(cat, s.dx);
          if (s.dy < 0) cat.y += s.dy;
        }
        const dir = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
        const target = dir * P.runSpeed * (cat.pushing ? 0.6 : 1);
        const accel = (cat.stun > 0 ? 500 : (cat.onGround ? 2400 : 1500)) * DT;
        if (cat.vx < target) cat.vx = Math.min(target, cat.vx + accel);
        else if (cat.vx > target) cat.vx = Math.max(target, cat.vx - accel);
        if (dir) cat.face = dir;

        // jump: buffer + coyote time + variable height
        if (inp.j && !cat.jprev) cat.jbuf = 0.12;
        cat.coyote = cat.onGround ? 0.08 : Math.max(0, cat.coyote - DT);
        if (cat.jbuf > 0 && cat.coyote > 0 && cat.stun <= 0) {
          cat.vy = -P.jumpVelocity; cat.jbuf = 0; cat.coyote = 0; cat.onGround = false;
          this.events.push(['jump', cat.id]);
        }
        cat.jbuf = Math.max(0, cat.jbuf - DT);
        if (!inp.j && cat.jprev && cat.vy < -150 && !cat.launched) cat.vy *= 0.5;
        if (cat.onGround) cat.launched = false;
        cat.jprev = !!inp.j;

        cat.vy = Math.min(cat.vy + P.gravity * DT, P.maxFall);
        this.moveCatX(cat, cat.vx * DT);
        const wasGround = cat.onGround;
        const res = this.moveY(cat, cat.vy * DT);
        if (res.landed) {
          if (!wasGround && cat.vy > 250) this.events.push(['land', cat.id]);
          if (res.landed.kind === 'cat' && !(cat.standOn && cat.standOn.kind === 'cat')) this.events.push(['stack', cat.id]);
          cat.vy = 0; cat.onGround = true; cat.standOn = res.landed;
        } else { cat.onGround = false; cat.standOn = null; }
        if (res.bumped && cat.vy < 0) cat.vy = 0;
        cat.dx = cat.x - x0; cat.dy = cat.y - y0;

        for (const f of this.fish) if (!f.got && overlap(cat, f)) { f.got = true; this.events.push(['fish', cat.id]); }
        // action button: levers & colour switches
        const ap = inp.a && !cat.aprev; cat.aprev = !!inp.a;
        if (ap) {
          for (const L of this.levers) if (overlap(cat, L)) { this.leverOn = !this.leverOn; this.events.push(['lever', cat.id, this.leverOn ? 1 : 0]); }
          for (const S of this.switches) if (overlap(cat, S)) { this.swapped = !this.swapped; this.events.push(['swap', cat.id]); this.unstick(); }
        }
        // springs bounce whoever lands on them
        for (const sp of this.springs) if (cat.onGround && overlap(cat, { x: sp.x, y: sp.y - 2, w: sp.w, h: 12 }) && cat.y + cat.h <= sp.y + 12) {
          cat.vy = -(this.P.springVelocity || 760); cat.onGround = false; cat.launched = true; sp.t = 0.25; this.events.push(['boing', cat.id]);
        }
        // conveyors carry cats standing on them
        if (cat.onGround && cat.standOn === 'tile') {
          const r = Math.floor((cat.y + cat.h + 1) / T), cx = Math.floor((cat.x + cat.w / 2) / T);
          if (r >= 0 && r < this.rows && this.grid[r] && this.grid[r][cx] === 5) {
            const cv = this.convs.find(v => v.c === cx && v.r === r);
            this.moveCatX(cat, cv.dir * this.convDir * (this.P.conveyorSpeed || 100) * DT);
          }
        }
        // water: splash back to the start
        for (const w of this.water) if (overlap(cat, w)) { this.respawnCat(cat); this.events.push(['splash', cat.id]); break; }
      }
      // conveyor timing
      if (this.flipConv && this.convs.length) { this.convT += DT; if (this.convT > 3) { this.convT = 0; this.convDir *= -1; this.events.push(['conv']); } }
      for (const sp of this.springs) sp.t = Math.max(0, sp.t - DT);
      for (const pd of this.pads) pd.t = Math.max(0, pd.t - DT);
      if (this.boss) this.stepBoss();
      this.updateSwitches();

      if (!this.goal) return;
      // goal: both cats inside the home
      const inGoal = this.cats.every(c => {
        const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
        return cx > this.goal.x && cx < this.goal.x + this.goal.w && cy > this.goal.y - 8 && cy < this.goal.y + this.goal.h;
      });
      this.goalTimer = inGoal ? this.goalTimer + DT : 0;
      if (!this.cleared && this.goalTimer > 0.35) { this.cleared = true; this.events.push(['clear']); }
    }

    respawnCat(cat) { cat.x = cat.spawnX; cat.y = cat.spawnY; cat.vx = 0; cat.vy = 0; cat.stun = 0.3; cat.onGround = false; cat.standOn = null; }
    // after a colour swap, a cat stuck inside a now-solid block pops up on top of it
    unstick() {
      for (const cat of this.cats) for (let k = 0; k < 3; k++) { const h = this.hitTiles(cat); if (!h.length) break; cat.y = Math.min(...h.map(t => t.y)) - cat.h; cat.vy = 0; }
    }
    stepBoss() {
      const b = this.boss;
      b.hitT = Math.max(0, b.hitT - DT);
      if (b.hp <= 0) { b.y += 0; return; }
      if (b.stun > 0) b.stun -= DT;
      else {
        b.x += b.dir * b.spd * (1 + (3 - b.hp) * 0.25) * DT;
        if (b.x < b.x0) { b.x = b.x0; b.dir = 1; }
        if (b.x + b.w > b.x1) { b.x = b.x1 - b.w; b.dir = -1; }
        for (const cat of this.cats) {
          const box = { x: cat.x + 4, y: cat.y + 6, w: cat.w - 8, h: cat.h - 6 };
          if (cat.stun <= 0 && overlap(box, b)) {
            const dir = Math.sign(cat.x + cat.w / 2 - (b.x + b.w / 2)) || 1;
            cat.vx = dir * 420; cat.vy = -360; cat.stun = 0.6; cat.launched = true; cat.onGround = false;
            this.events.push(['ouch', cat.id]);
          }
        }
      }
      // both boss buttons pressed within a short window -> zap
      const btns = this.plates.filter(p => p.ch === 'q');
      if (btns.length && b.stun <= 0 && btns.every(p => p.lastPress != null && this.time - p.lastPress < 0.8)) {
        b.hp--; b.stun = 2.2; b.hitT = 0.6; btns.forEach(p => p.lastPress = null);
        this.events.push(['bosshit', b.hp]);
        if (b.hp <= 0) this.events.push(['bossdown']);
      }
    }
    updateSwitches() {
      const ents = this.cats.filter(c => !c.dead).concat(this.boxes);
      const open = {};
      for (const p of this.plates) {
        const was = p.pressed;
        p.pressed = ents.some(e => overlap(e, p));
        if (p.pressed && !was) {
          this.events.push(['plate', 1]);
          p.lastPress = this.time;
          if (p.ch === 'p') for (const pd of this.pads) for (const cat of this.cats) {
            if (overlap(cat, { x: pd.x, y: pd.y - 4, w: pd.w, h: 14 })) { cat.vy = -(this.P.launchVelocity || 900); cat.onGround = false; cat.launched = true; cat.standOn = null; pd.t = 0.4; this.events.push(['launch', cat.id]); }
          }
        }
        if (p.pressed && 'abc'.includes(p.ch)) open[p.ch] = true;
        if (p.ch === 't') { if (p.pressed) this.timer.t = this.P.timedDoor || 4; }
      }
      const us = this.plates.filter(p => p.ch === 'u');
      if (us.length && !this.latch.u && us.every(p => p.pressed)) { this.latch.u = true; this.events.push(['latch']); }
      if (this.latch.u) open.u = true;
      if (this.timer.t > 0) { this.timer.t -= DT; open.t = true; }
      if (this.boss && this.boss.hp <= 0) open.q = true;
      for (const d of this.doors) {
        const occupied = ents.some(e => overlap(e, d));
        const wasSolid = d.solid;
        d.solid = !open[d.ch] && !occupied;
        if (d.ch === 'q' && !open.q) d.solid = true;
        if (wasSolid && !d.solid && d === this.doors.find(x => x.ch === d.ch)) this.events.push(['door', 1]);
        d.open += ((d.solid ? 0 : 1) - d.open) * 0.3;
      }
    }

    takeEvents() { const e = this.events; this.events = []; return e; }

    // compact state for rendering / network
    snapshot() {
      const r1 = v => Math.round(v * 10) / 10;
      return {
        lv: this.levelIndex,
        c: this.cats.map(c => [r1(c.x), r1(c.y), r1(c.vx), r1(c.vy), c.onGround ? 1 : 0, c.face]),
        b: this.boxes.map(b => [r1(b.x), r1(b.y)]),
        d: this.doors.map(d => Math.round(d.open * 100) / 100),
        p: this.plates.map(p => p.pressed ? 1 : 0),
        f: this.fish.map(f => f.got ? 1 : 0),
        g: this.goalTimer > 0 ? 1 : 0,
        k: this.leverOn ? 1 : 0, sw: this.swapped ? 1 : 0, cd: this.convDir,
        tt: this.timer.t > 0 ? Math.ceil(this.timer.t) : 0,
        sp: this.springs.map(s => s.t > 0 ? 1 : 0), pd: this.pads.map(s => s.t > 0 ? 1 : 0),
        bo: this.boss ? [r1(this.boss.x), r1(this.boss.y), this.boss.dir, this.boss.hp, this.boss.stun > 0 ? 1 : 0, this.boss.hitT > 0 ? 1 : 0] : null,
      };
    }
  }

  const api = { Sim, T, CAT_W, CAT_H, BOX_S, DT };
  root.CatSim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
