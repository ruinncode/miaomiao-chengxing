// ============================================================
//  Versus mini-games (host-authoritative, pure logic, no Phaser)
//  Add a mini-game: add an arena to VS_GAMES and handle it in VsRound.
//  '=' is a one-way platform (jump up through it, press Down to drop).
// ============================================================
(function (root) {
  const { Sim, T, DT } = root.CatSim || require('./sim.js');

  const VS_GAMES = {
    fish: {
      name: '抢小鱼', icon: '🐟', time: 30, theme: 'garden',
      hint: '抢最多的鱼！拍对方会把鱼拍掉，毛线球=超级拍拍！',
      map: [
        '##############################',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#..........========..........#',
        '#............................#',
        '#..======............======..#',
        '#............................#',
        '#........============........#',
        '#............................#',
        '#.======..............======.#',
        '#....1..................2....#',
        '##############################',
      ],
    },
    knock: {
      name: '猫拳擂台', icon: '🥊', time: 60, theme: 'roof',
      hint: '把对方拍下屋顶！每只猫3条命',
      map: [
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '..............................',
        '...........========...........',
        '..............................',
        '...======............======...',
        '.........1..........2.........',
        '......##################......',
        '......##################......',
        '..............................',
        '..............................',
        '..............................',
      ],
    },
    vacuum: {
      name: '躲避扫地机', icon: '🤖', time: 40, theme: 'room',
      hint: '跳过扫地机器人，躲开掉下来的杯子，坚持到最后！',
      map: [
        '##############################',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#............................#',
        '#..======............======..#',
        '#............................#',
        '#..........========..........#',
        '#....1..................2....#',
        '##############################',
      ],
    },
  };
  const ORDER = ['fish', 'knock', 'vacuum'];

  // deterministic-ish RNG so tests are repeatable
  function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  class VsSim extends Sim {
    outOfBoundsSolid(c, r) { return this.open ? false : true; }
  }

  // One round of a mini-game
  class VsRound {
    constructor(type, physics, seed) {
      this.type = type; this.def = VS_GAMES[type];
      this.sim = new VsSim(0, [this.def], physics);
      this.sim.open = type === 'knock';
      this.sim.load(0);
      this.rand = rng(seed);
      this.timeLeft = this.def.time;
      this.score = [0, 0];                // fish
      this.lives = type === 'fish' ? [0, 0] : [3, 3];
      this.items = [];                    // {k:'fish'|'gold'|'yarn', x,y,life}
      this.vacs = []; this.cups = [];
      this.power = [0, 0];                // yarn charges
      this.cool = [0, 0]; this.inv = [0, 0]; this.respawn = [0, 0]; this.hits = [0, 0];
      this.swipeT = [0, 0];
      this.spawnT = 0.5; this.yarnT = 6; this.cupT = 3;
      this.over = false; this.winner = -1;
      this.events = [];
      this.aprev = [false, false];
      if (type === 'vacuum') this.vacs.push({ x: 440, y: 512 - 20, w: 50, h: 20, dir: 1, spd: 120 });
      // spots where fish can appear (above walkable surfaces)
      this.spots = [];
      const m = this.def.map;
      for (let r = 1; r < m.length; r++) for (let c = 1; c < 29; c++) {
        if ((m[r][c] === '#' || m[r][c] === '=') && m[r - 1][c] !== '#' && m[r - 1][c] !== '=') this.spots.push({ x: c * T + 6, y: (r - 1) * T + 8 });
      }
    }

    get cats() { return this.sim.cats; }
    ev(...a) { this.events.push(a); }

    step(inputs) {
      if (this.over) { this.sim.step([{}, {}]); return; }
      const sim = this.sim;
      this.timeLeft = Math.max(0, this.timeLeft - DT);
      sim.step(inputs);
      for (const e of sim.takeEvents()) if (e[0] === 'jump' || e[0] === 'land' || e[0] === 'stack') this.events.push(e);
      for (let i = 0; i < 2; i++) {
        const cat = sim.cats[i], inp = inputs[i] || {};
        this.cool[i] = Math.max(0, this.cool[i] - DT);
        this.inv[i] = Math.max(0, this.inv[i] - DT);
        this.swipeT[i] = Math.max(0, this.swipeT[i] - DT);
        const pressed = inp.a && !this.aprev[i];
        this.aprev[i] = !!inp.a;
        if (pressed && !cat.dead && cat.stun <= 0 && this.cool[i] <= 0) this.swipe(i);
        // dead cats respawn (knock-off)
        if (cat.dead && this.respawn[i] > 0) {
          this.respawn[i] -= DT;
          if (this.respawn[i] <= 0 && this.lives[i] > 0) {
            cat.dead = false; cat.x = cat.spawnX; cat.y = cat.spawnY - 120; cat.vx = 0; cat.vy = 0; cat.stun = 0;
            this.inv[i] = 1.5; this.ev('spawn', i);
          }
        }
      }
      if (this.type === 'fish') this.stepFish();
      if (this.type === 'knock') this.stepKnock();
      if (this.type === 'vacuum') this.stepVacuum();
      this.checkEnd();
    }

    swipe(i) {
      const me = this.sim.cats[i], other = this.sim.cats[1 - i];
      this.cool[i] = 0.55; this.swipeT[i] = 0.2;
      const big = this.type === 'fish' && this.power[i] > 0;
      if (big) this.power[i]--;
      this.ev(big ? 'bigswipe' : 'swipe', i);
      if (other.dead) return;
      const dx = (other.x + other.w / 2) - (me.x + me.w / 2), dy = (other.y + other.h / 2) - (me.y + me.h / 2);
      let hit;
      if (big) hit = Math.hypot(dx, dy) < 130;
      else hit = Math.abs(dy) < 30 && Math.abs(dx) < 48 && dx * me.face > -8;
      if (!hit || this.inv[1 - i] > 0.9) return;
      const dir = big ? (Math.sign(dx) || me.face) : me.face;
      let power;
      if (this.type === 'knock') { this.hits[1 - i]++; power = 330 + 70 * this.hits[1 - i]; }
      else power = big ? 560 : 320;
      other.vx = dir * power; other.vy = this.type === 'knock' ? -280 - 20 * this.hits[1 - i] : (big ? -380 : -220);
      other.stun = big ? 0.9 : (this.type === 'knock' ? 0.45 + 0.04 * this.hits[1 - i] : 0.35);
      other.launched = true; other.onGround = false;
      this.ev('hit', 1 - i);
      if (this.type === 'fish') {
        const n = Math.min(this.score[1 - i], big ? 2 : 1);
        if (n > 0) {
          this.score[1 - i] -= n;
          if (big) { this.score[i] += n; this.ev('steal', i, n); }
          else this.drop(other, n);
        }
      }
    }
    drop(cat, n) {
      for (let k = 0; k < n; k++) {
        const s = this.spots[Math.floor(this.rand() * this.spots.length)];
        this.items.push({ k: 'fish', x: s.x, y: s.y, life: 6 });
      }
    }

    stepFish() {
      this.spawnT -= DT; this.yarnT -= DT;
      for (const it of this.items) it.life -= DT;
      this.items = this.items.filter(it => it.life > 0);
      if (this.spawnT <= 0 && this.items.filter(i => i.k !== 'yarn').length < 6) {
        this.spawnT = 0.7 + this.rand() * 0.6;
        const s = this.spots[Math.floor(this.rand() * this.spots.length)];
        if (!this.items.some(it => Math.abs(it.x - s.x) < 20 && Math.abs(it.y - s.y) < 20))
          this.items.push({ k: this.rand() < 0.12 ? 'gold' : 'fish', x: s.x, y: s.y, life: 7 });
      }
      if (this.yarnT <= 0) {
        this.yarnT = 8;
        const s = this.spots[Math.floor(this.rand() * this.spots.length)];
        this.items.push({ k: 'yarn', x: s.x, y: s.y, life: 8 });
      }
      for (let i = 0; i < 2; i++) {
        const c = this.sim.cats[i];
        for (const it of this.items) {
          if (it.life <= 0) continue;
          if (c.x < it.x + 20 && c.x + c.w > it.x && c.y < it.y + 16 && c.y + c.h > it.y) {
            it.life = 0;
            if (it.k === 'yarn') { this.power[i] = 1; this.ev('power', i); }
            else { const v = it.k === 'gold' ? 3 : 1; this.score[i] += v; this.ev('fish', i, v); }
          }
        }
      }
      this.items = this.items.filter(it => it.life > 0);
    }

    stepKnock() {
      const sim = this.sim;
      for (let i = 0; i < 2; i++) {
        const c = sim.cats[i];
        if (!c.dead && (c.y > sim.H + 30 || c.x < -80 || c.x > sim.W + 80)) {
          c.dead = true; this.lives[i]--; this.hits[i] = 0; this.respawn[i] = 1.2;
          this.ev('fall', i);
        }
      }
    }

    stepVacuum() {
      const sim = this.sim, elapsed = this.def.time - this.timeLeft;
      if (elapsed > 14 && this.vacs.length < 2) { this.vacs.push({ x: 60, y: 512 - 20, w: 50, h: 20, dir: 1, spd: 150 }); this.ev('vac'); }
      for (const v of this.vacs) {
        v.spd = Math.min(260, v.spd + DT * 3);
        v.x += v.dir * v.spd * DT;
        if (v.x < 32) { v.x = 32; v.dir = 1; }
        if (v.x + v.w > sim.W - 32) { v.x = sim.W - 32 - v.w; v.dir = -1; }
      }
      // falling cups with a warning shadow
      this.cupT -= DT;
      if (this.cupT <= 0) {
        this.cupT = Math.max(0.45, 1.6 - elapsed * 0.03);
        // aim near a random cat half the time
        const tgt = sim.cats[Math.floor(this.rand() * 2)];
        const x = this.rand() < 0.5 && !tgt.dead ? tgt.x + tgt.w / 2 - 10 + (this.rand() - 0.5) * 60 : 40 + this.rand() * 860;
        this.cups.push({ x: Math.max(36, Math.min(sim.W - 56, x)), y: -24, w: 20, h: 20, warn: 0.8, vy: 0, broke: 0 });
      }
      for (const cup of this.cups) {
        if (cup.warn > 0) { cup.warn -= DT; continue; }
        if (cup.broke > 0) { cup.broke -= DT; if (cup.broke <= 0) cup.gone = true; continue; }
        cup.vy = Math.min(cup.vy + 1200 * DT, 520); cup.y += cup.vy * DT;
        if (cup.y + cup.h >= 512) { cup.y = 512 - cup.h; cup.broke = 0.5; this.ev('crash'); }
      }
      this.cups = this.cups.filter(c => !c.gone);
      for (let i = 0; i < 2; i++) {
        const c = sim.cats[i];
        if (c.dead || this.inv[i] > 0) continue;
        const box = { x: c.x + 3, y: c.y + 4, w: c.w - 6, h: c.h - 4 };
        const hitR = (o) => box.x < o.x + o.w && box.x + box.w > o.x && box.y < o.y + o.h && box.y + box.h > o.y;
        let hit = null;
        for (const v of this.vacs) if (hitR(v)) hit = { dir: Math.sign((c.x + c.w / 2) - (v.x + v.w / 2)) || 1 };
        for (const cup of this.cups) if (cup.warn <= 0 && cup.broke <= 0 && hitR(cup)) { hit = { dir: c.face * -1 }; cup.broke = 0.5; }
        if (hit) {
          this.lives[i]--; this.inv[i] = 1.5;
          c.vx = hit.dir * 300; c.vy = -320; c.stun = 0.4; c.launched = true;
          this.ev('ouch', i);
          if (this.lives[i] <= 0) { c.dead = true; this.ev('out', i); }
        }
      }
    }

    checkEnd() {
      let w = -2;
      if (this.type !== 'fish') {
        const a = this.lives[0] <= 0, b = this.lives[1] <= 0;
        if (a && b) w = -1; else if (a) w = 1; else if (b) w = 0;
      }
      if (w === -2 && this.timeLeft <= 0) {
        const v = this.type === 'fish' ? this.score : this.lives;
        w = v[0] > v[1] ? 0 : v[1] > v[0] ? 1 : -1;
      }
      if (w !== -2) { this.over = true; this.winner = w; this.ev('roundover', w); }
    }

    snapshot() {
      const r1 = v => Math.round(v * 10) / 10;
      return {
        c: this.sim.cats.map((c, i) => [r1(c.x), r1(c.y), r1(c.vx), r1(c.vy), c.onGround ? 1 : 0, c.face,
          (c.dead ? 1 : 0) | (c.stun > 0 ? 2 : 0) | (this.inv[i] > 0 ? 4 : 0) | (this.power[i] > 0 ? 8 : 0) | (this.swipeT[i] > 0 ? 16 : 0)]),
        it: this.items.map(it => [it.k, r1(it.x), r1(it.y), it.life < 1.5 ? 1 : 0]),
        v: this.vacs.map(v => [r1(v.x), r1(v.y), v.dir]),
        cu: this.cups.map(c => [r1(c.x), r1(c.y), c.warn > 0 ? 1 : (c.broke > 0 ? 2 : 0)]),
        sc: this.score.slice(), li: this.lives.slice(), tl: Math.ceil(this.timeLeft),
      };
    }
  }

  // Best-of-5 match (first to 3 round wins; ties replay up to 9 rounds)
  class VsMatch {
    constructor(physics, seed = Date.now(), opt = {}) {
      this.physics = physics; this.seed = seed; this.order = opt.order || ORDER; this.need = opt.need || 3;
      this.wins = [0, 0]; this.roundNo = 0; this.history = [];
      this.events = [];
      this.nextRound();
    }
    nextRound() {
      this.roundNo++;
      const type = this.order[(this.roundNo - 1) % this.order.length];
      this.round = new VsRound(type, this.physics, this.seed + this.roundNo * 7919);
      this.phase = 'intro'; this.phaseT = 0;
      this.events.push(['round', this.roundNo, type]);
    }
    step(inputs) {
      this.phaseT += DT;
      if (this.phase === 'intro') { this.round.sim.step([{}, {}]); this.round.sim.takeEvents(); if (this.phaseT > 3) { this.phase = 'play'; this.phaseT = 0; this.events.push(['go']); } }
      else if (this.phase === 'play') {
        this.round.step(inputs);
        this.events.push(...this.round.events); this.round.events = [];
        if (this.round.over) {
          const w = this.round.winner;
          if (w >= 0) this.wins[w]++;
          this.history.push(w);
          this.phase = 'roundEnd'; this.phaseT = 0;
        }
      } else if (this.phase === 'roundEnd') {
        this.round.step([{}, {}]); this.round.events = [];
        if (this.phaseT > 3) {
          if (this.wins[0] >= this.need || this.wins[1] >= this.need || this.roundNo >= this.need * 3) { this.phase = 'matchEnd'; this.phaseT = 0; this.events.push(['matchover', this.matchWinner()]); }
          else this.nextRound();
        }
      } else if (this.phase === 'matchEnd') { this.round.sim.step([{}, {}]); this.round.sim.takeEvents(); }
    }
    matchWinner() { return this.wins[0] > this.wins[1] ? 0 : this.wins[1] > this.wins[0] ? 1 : -1; }
    takeEvents() { const e = this.events; this.events = []; return e; }
    snapshot() {
      return Object.assign(this.round.snapshot(), {
        gt: this.round.type, rn: this.roundNo, ph: this.phase, pt: Math.round(this.phaseT * 10) / 10, w: this.wins.slice(), h: this.history.slice(),
        rw: this.round.over ? this.round.winner : -2, mw: this.phase === 'matchEnd' ? this.matchWinner() : -2,
      });
    }
  }

  const api = { VS_GAMES, ORDER, VsRound, VsMatch };
  root.Versus = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
