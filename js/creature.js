// Pixel creature engine: draws one 8-bit creature, its idle loop, its signature move and the
// "come out of the ball" release effect onto a small canvas. The same canvas is used as the
// AR texture and, scaled up, in the no-camera preview.
(function () {
  const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
  const TEX = 72;            // texture size in pixels
  const PAD_BOTTOM = 2;      // empty rows under the feet
  const PINK = '#d72d6b';

  const rand = (a, b) => a + Math.random() * (b - a);

  function frameToCanvas(rows, palette, silhouette) {
    const n = rows.length;
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(n, n);
    const rgb = palette.map(h => h && [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const v = DIGITS.indexOf(rows[y][x]);
        if (!v) continue;
        const o = (y * n + x) * 4;
        const col = silhouette ? [255, 255, 255] : rgb[v];
        img.data[o] = col[0]; img.data[o + 1] = col[1]; img.data[o + 2] = col[2]; img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // Signature moves, drawn as pixel particles from the creature's fx point (x, y in texture px).
  // Each returns the particles to add this tick.
  const MOVES = {
    fire: {   // Ember: the tail flame flares and throws sparks upward
      spawn(x, y) {
        const out = [];
        for (let i = 0; i < 2; i++) {
          const a = rand(-Math.PI * 0.85, -Math.PI * 0.3);
          out.push({ kind: 'ember', x: x + rand(-1, 1), y, vx: Math.cos(a) * rand(8, 20), vy: Math.sin(a) * rand(18, 32), life: rand(450, 750), age: 0, size: Math.random() < 0.4 ? 2 : 1 });
        }
        return out;
      },
    },
    water: {  // Bubble: blown forward out of the mouth, then floating up. Alternates with Tail Whip.
      kinds: ['bubble', 'tailwhip'],
      spawn(x, y) {
        if (Math.random() < 0.5) return [];
        return [{ kind: 'bubble', x, y, vx: -rand(16, 30), vy: rand(-6, 2), lift: rand(18, 26), life: rand(900, 1300), age: 0, r: Math.random() < 0.5 ? 1 : 2, phase: rand(0, 6) }];
      },
    },
    grass: {  // Razor Leaf: leaves spinning out from the bulb
      spawn(x, y) {
        if (Math.random() < 0.6) return [];
        return [{ kind: 'leaf', cx: x, cy: y, ang: rand(0, Math.PI * 2), rad: 4, vr: rand(10, 16), va: rand(3, 5) * (Math.random() < 0.5 ? -1 : 1), life: rand(900, 1300), age: 0 }];
      },
    },
  };

  class Creature {
    constructor(id) {
      const data = window.NAKAMA_SPRITES[id];
      if (!data) throw new Error('Unknown creature ' + id);
      this.id = id;
      this.data = data;
      this.name = data.name;
      this.move = MOVES[data.type];
      this.size = data.size;
      this.sx = Math.round((TEX - data.size) / 2);   // sprite position inside the texture
      this.sy = TEX - data.size - PAD_BOTTOM;
      this.fx = [this.sx + data.fx[0], this.sy + data.fx[1]];
      this.canvas = document.createElement('canvas');
      this.canvas.width = this.canvas.height = TEX;
      this.ctx = this.canvas.getContext('2d');
      this.ctx.imageSmoothingEnabled = false;
      this.frames = {};
      this.white = {};
      for (const k in data.frames) {
        this.frames[k] = frameToCanvas(data.frames[k], data.palette, false);
        this.white[k] = frameToCanvas(data.frames[k], data.palette, true);
      }
      this.particles = [];
      this.t = 0;
      this.phase = 'hidden';
      this.phaseT = 0;
      this.nextBlink = rand(1500, 3500);
      this.blinkUntil = 0;
      this.nextMove = rand(2200, 3200);
      this.moveUntil = 0;
      this.hopUntil = 0;
      this.moveKind = 'default';
      this.moveStart = 0;
      this.moveCount = 0;
      this.onEvent = () => {};
    }

    appear() {
      this.phase = 'release';
      this.phaseT = 0;
      this.particles = [];
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2), sp = rand(20, 46);
        this.particles.push({ kind: 'spark', x: TEX / 2, y: this.sy + this.size * 0.6, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(350, 650), age: 0, color: i % 3 ? '#ffffff' : PINK });
      }
      this.onEvent('release');
    }

    hide() { this.phase = 'hidden'; this.particles = []; }

    update(dt) {
      dt = Math.min(dt, 100);
      this.t += dt;
      this.phaseT += dt;
      const t = this.t;

      if (this.phase === 'release' && this.phaseT > 700) {
        this.phase = 'idle';
        this.hopUntil = t + 380;
        this.moveUntil = t + 450;              // the "cry": mouth open on landing
        this.moveKind = 'cry';
        this.nextMove = t + rand(2500, 3500);
        this.onEvent('cry');
      }

      if (this.phase === 'idle') {
        if (t > this.nextBlink) { this.blinkUntil = t + 140; this.nextBlink = t + rand(2000, 4500); }
        if (t > this.nextMove) {
          const kinds = this.move.kinds;
          this.moveKind = kinds ? kinds[this.moveCount++ % kinds.length] : 'default';
          this.moveStart = t;
          this.moveUntil = t + 1400;
          this.nextMove = t + 1400 + rand(2800, 4200);
          this.onEvent('move', this.moveKind);
        }
        const spawning = this.moveKind === 'default' || (this.moveKind === 'bubble' && t - this.moveStart > 250);
        if (t < this.moveUntil && t > this.hopUntil && spawning) {
          this.particles.push(...this.move.spawn(this.fx[0], this.fx[1] + this.bob()));
        }
      }

      for (const p of this.particles) {
        p.age += dt;
        const s = dt / 1000;
        if (p.kind === 'leaf') { p.ang += p.va * s; p.rad += p.vr * s; }
        else { p.x += p.vx * s; p.y += p.vy * s; }
        if (p.kind === 'ember') { p.vy -= 10 * s; p.vx *= 0.97; }
        if (p.kind === 'bubble') { p.vx *= 0.94; p.vy -= p.lift * s; }
        if (p.kind === 'spark') { p.vx *= 0.92; p.vy *= 0.92; }
      }
      this.particles = this.particles.filter(p => p.age < p.life);
    }

    moving(kind) { return this.phase === 'idle' && this.t < this.moveUntil && this.moveKind === kind; }

    spriteKey() {
      const st = this.data.states;
      // fire flickers fast, tails sway slow, and a Tail Whip wags really fast
      const speed = st === 3 ? 110 : this.moving('tailwhip') ? 70 : 420;
      const state = Math.floor(this.t / speed) % st;
      const blink = this.t < this.blinkUntil ? 1 : 0;
      const mouth = this.t < this.moveUntil ? 1 : 0;
      return `${state}${blink}${mouth}`;
    }

    // Squash, stretch and wiggle applied to the whole sprite during some moves.
    transform() {
      const k = this.t - this.moveStart;
      if (this.moving('bubble')) {
        if (k < 250) {                                   // big breath in: stretch tall
          const e = Math.sin((k / 250) * Math.PI / 2);
          return { sx: 1 - 0.05 * e, sy: 1 + 0.07 * e, dx: 0 };
        }
        const puff = Math.floor((k - 250) / 150) % 2;    // puff out each bubble: squash
        return puff ? { sx: 1.05, sy: 0.94, dx: 0 } : { sx: 1, sy: 1, dx: 0 };
      }
      if (this.moving('tailwhip')) {                     // wiggle side to side
        return { sx: 1, sy: 1, dx: [0, 2, 0, -2][Math.floor(k / 70) % 4] };
      }
      return { sx: 1, sy: 1, dx: 0 };
    }

    // vertical offset in texture pixels: idle bob plus the hop after release
    bob() {
      if (this.phase !== 'idle') return 0;
      let y = Math.floor(this.t / 500) % 2;
      if (this.t < this.hopUntil) {
        const k = 1 - (this.hopUntil - this.t) / 380;
        y -= Math.round(Math.sin(k * Math.PI) * 5);
      }
      return y;
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, TEX, TEX);
      if (this.phase === 'hidden') return;
      const key = this.spriteKey();

      if (this.phase === 'release') {
        const k = Math.min(this.phaseT / 350, 1);
        const flashWhite = this.phaseT < 350 || Math.floor(this.phaseT / 90) % 2 === 0;
        const img = flashWhite ? this.white[key] : this.frames[key];
        const n = this.size;
        const size = Math.max(2, Math.round(n * (0.15 + 0.85 * k)));
        ctx.drawImage(img, Math.round(this.sx + n / 2 - size / 2), Math.round(this.sy + n - size), size, size);
      } else {
        const tr = this.transform();
        const n = this.size, img = this.frames[key];
        if (tr.sx === 1 && tr.sy === 1) {
          ctx.drawImage(img, this.sx + tr.dx, this.sy + this.bob());
        } else {
          const w = Math.round(n * tr.sx), h = Math.round(n * tr.sy);   // feet stay planted
          ctx.drawImage(img, Math.round(this.sx + (n - w) / 2) + tr.dx, this.sy + n - h + this.bob(), w, h);
        }
      }

      for (const p of this.particles) this.drawParticle(p);
    }

    drawParticle(p) {
      const ctx = this.ctx;
      const k = p.age / p.life;
      const px = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
      if (p.kind === 'spark') {
        px(p.x, p.y, k < 0.5 ? 2 : 1, k < 0.5 ? 2 : 1, p.color);
      } else if (p.kind === 'ember') {
        const c = k < 0.25 ? '#fff4a0' : k < 0.5 ? '#f8d030' : k < 0.75 ? '#f08030' : '#c03018';
        const s = k < 0.6 ? p.size + 1 : p.size;
        px(p.x - s / 2, p.y - s / 2, s, s, c);
      } else if (p.kind === 'bubble') {
        const x = p.x + Math.sin(p.age / 120 + p.phase) * 1.5, y = p.y;
        if (k > 0.92) { // pop
          px(x - 2, y, 1, 1, '#d8f4ff'); px(x + 2, y, 1, 1, '#d8f4ff'); px(x, y - 2, 1, 1, '#d8f4ff'); px(x, y + 2, 1, 1, '#d8f4ff');
          return;
        }
        if (p.r === 1) {
          px(x - 1, y, 1, 1, '#58a8e0'); px(x + 1, y, 1, 1, '#58a8e0'); px(x, y - 1, 1, 1, '#58a8e0'); px(x, y + 1, 1, 1, '#58a8e0');
          px(x, y, 1, 1, '#b8e8ff');
        } else {
          px(x - 1, y - 2, 3, 1, '#58a8e0'); px(x - 1, y + 2, 3, 1, '#58a8e0');
          px(x - 2, y - 1, 1, 3, '#58a8e0'); px(x + 2, y - 1, 1, 3, '#58a8e0');
          px(x - 1, y - 1, 3, 3, 'rgba(184,232,255,0.55)'); px(x - 1, y - 1, 1, 1, '#ffffff');
        }
      } else if (p.kind === 'leaf') {
        const x = p.cx + Math.cos(p.ang) * p.rad, y = p.cy + Math.sin(p.ang) * p.rad * 0.6 - p.age / 90;
        const flip = Math.floor(p.age / 120) % 2;
        px(x, y, 2, 1, '#58b048'); px(x + (flip ? -1 : 2), y + (flip ? 1 : -1), 1, 1, '#307828');
        px(x + (flip ? 0 : 1), y + 1, 1, 1, '#90d870');
      }
    }
  }

  // Soft pixel shadow that sits flat on the marker under the creature.
  function shadowCanvas() {
    const c = document.createElement('canvas');
    c.width = 32; c.height = 16;
    const ctx = c.getContext('2d');
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 32; x++) {
        const dx = (x + 0.5 - 16) / 15, dy = (y + 0.5 - 8) / 7;
        if (dx * dx + dy * dy < 1) ctx.fillRect(x, y, 1, 1);
      }
    }
    return c;
  }

  window.NakamaCreature = Creature;
  window.NakamaShadow = shadowCanvas;
  window.NAKAMA_TEX = TEX;
})();
