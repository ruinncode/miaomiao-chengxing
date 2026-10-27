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
      let spawns = [];
      let gx0 = 1e9, gy0 = 1e9, gx1 = -1, gy1 = -1;
      for (let r = 0; r < this.rows; r++) {
        this.grid.push([]);
        for (let c = 0; c < this.cols; c++) {
          const ch = L.map[r][c];
          this.grid[r].push(ch === '#' ? 1 : (ch === '=' ? 2 : 0));
          if (ch === '1' || ch === '2') spawns[+ch - 1] = { x: c * T + (T - CAT_W) / 2, y: (r + 1) * T - CAT_H };
          else if (ch === 'G') { gx0 = Math.min(gx0, c); gy0 = Math.min(gy0, r); gx1 = Math.max(gx1, c); gy1 = Math.max(gy1, r); }
          else if (ch === 'O') this.boxes.push({ x: c * T + (T - BOX_S) / 2, y: (r + 1) * T - BOX_S, w: BOX_S, h: BOX_S, vy: 0, kind: 'box' });
          else if (ch === '*') this.fish.push({ x: c * T + 6, y: r * T + 8, w: 20, h: 16, got: false });
          else if (ch >= 'a' && ch <= 'c') this.plates.push({ ch, x: c * T + 3, y: (r + 1) * T - 6, w: 26, h: 6, pressed: false });
          else if (ch >= 'A' && ch <= 'C') {
            const d = { ch: ch.toLowerCase(), c, r, x: c * T, y: r * T, w: T, h: T, solid: true, open: 0 };
            this.doors.push(d); this.doorAt[c + ',' + r] = d;
          }
        }
      }
      this.goal = gx1 < 0 ? null : { x: gx0 * T, y: gy0 * T, w: (gx1 - gx0 + 1) * T, h: (gy1 - gy0 + 1) * T };
      this.cats = spawns.map((s, i) => ({
        id: i, x: s.x, y: s.y, w: CAT_W, h: CAT_H, vx: 0, vy: 0, face: i === 0 ? 1 : 1,
        onGround: true, standOn: null, coyote: 0, jbuf: 0, jprev: false, pushing: false,
        spawnX: s.x, spawnY: s.y, dx: 0, dy: 0, kind: 'cat', stun: 0, dead: false, dropT: 0,
      }));
      this.events = [];
      this.time = 0;
      this.goalTimer = 0;
      this.cleared = false;
      this.updateSwitches();
    }

    // ---------- collision helpers ----------
    tileSolid(c, r) {
      if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return this.outOfBoundsSolid(c, r);
      if (this.grid[r][c] === 1) return true;
      const d = this.doorAt[c + ',' + r];
      return !!(d && d.solid);
    }
    outOfBoundsSolid() { return true; }
    hitTiles(e) { // returns list of solid tile rects overlapping e
      const out = [];
      const c0 = Math.floor(e.x / T), c1 = Math.floor((e.x + e.w - 0.001) / T);
      const r0 = Math.floor(e.y / T), r1 = Math.floor((e.y + e.h - 0.001) / T);
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++)
        if (this.tileSolid(c, r)) out.push({ x: c * T, y: r * T, w: T, h: T });
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
      }
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

    updateSwitches() {
      const ents = this.cats.filter(c => !c.dead).concat(this.boxes);
      const open = {};
      for (const p of this.plates) {
        const was = p.pressed;
        p.pressed = ents.some(e => overlap(e, p));
        if (p.pressed && !was) this.events.push(['plate', 1]);
        if (p.pressed) open[p.ch] = true;
      }
      for (const d of this.doors) {
        const occupied = ents.some(e => overlap(e, d));
        const wasSolid = d.solid;
        d.solid = !open[d.ch] && !occupied;
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
      };
    }
  }

  const api = { Sim, T, CAT_W, CAT_H, BOX_S, DT };
  root.CatSim = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
