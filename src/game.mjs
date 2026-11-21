import { validateScenario } from './validation.mjs';

export const HZ = 60;
const DT = 1 / HZ;
const EPS = 1e-9;
const distance = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
const rounded = (n) => { const r = Math.round(n * 1000) / 1000; return Object.is(r, -0) ? 0 : r; };
const position = (p) => p.map(rounded);

// Mulberry32: only the simulation owns this RNG; rendering cannot advance it.
export function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let n = Math.imul(value ^ (value >>> 15), 1 | value);
    n ^= n + Math.imul(n ^ (n >>> 7), 61 | n);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

export class Game {
  constructor({ config, seed = 12, scenario = {} }) {
    validateScenario(scenario, config);
    this.config = config;
    this.tuning = config.tuning;
    this.world = config.world;
    this.rng = seededRandom(seed);
    this.tick = 0;
    this.state = 'playing';
    this.score = 0;
    this.events = [];
    this.initialTime = scenario.time_left_s ?? this.tuning.night1_duration_s;
    this.timeLeft = this.initialTime;
    this.input = { move: [0, 0], cam_yaw_deg: 0, jump: false, interact: false, pulse: false };
    this.player = { pos: [0, 0, 0], carried: 0, flames: this.tuning.flames, ...structuredClone(scenario.player ?? {}) };
    this.velocityY = 0;
    this.invulnUntil = 0;
    this.pulseReadyAt = 0;
    this.nextMoteId = 1;
    this.nextShadeId = 1;
    this.usedShadeIds = new Set((scenario.shades ?? []).filter((s) => s.id).map((s) => s.id));
    this.randomMotes = scenario.random_motes ?? true;
    this.randomShades = scenario.random_shades ?? true;
    this.lanterns = Array.from({ length: this.tuning.lantern_count_night1 }, (_, i) => {
      const angle = (i / 5) * Math.PI * 2;
      return { id: `L${i + 1}`, pos: [Math.sin(angle) * 19, 0, Math.cos(angle) * 19], deposited: 0, lit: false };
    });
    for (const override of scenario.lanterns ?? []) {
      const l = this.lanterns.find((item) => item.id === override.id);
      Object.assign(l, structuredClone(override));
      if (l.deposited >= this.tuning.lantern_cost) l.lit = true;
      if (l.lit) l.deposited = this.tuning.lantern_cost;
    }
    this.motes = [];
    if ('motes' in scenario) scenario.motes.forEach((p) => this.addMote(p));
    else if (this.randomMotes) {
      // Start with enough nearby lights to make the first interaction easy to learn.
      for (let i = 0; i < this.world.initial_motes; i++) {
        const angle = this.rng() * Math.PI * 2;
        const radius = i < 12 ? 2 + this.rng() * 5 : 4 + Math.sqrt(this.rng()) * 24;
        this.addMote([Math.sin(angle) * radius, 0, Math.cos(angle) * radius]);
      }
    }
    this.shades = [];
    if ('shades' in scenario) scenario.shades.forEach((s) => this.addShade(s.pos, s.id, false));
    else if (this.randomShades) for (let i = 0; i < this.world.initial_shades; i++) this.spawnShade(false);
  }

  addMote(pos) {
    this.motes.push({ id: `M${this.nextMoteId++}`, pos: [...pos] });
  }

  addShade(pos, id, emit = true) {
    if (!id) {
      do { id = `S${this.nextShadeId++}`; } while (this.usedShadeIds.has(id));
    }
    this.usedShadeIds.add(id);
    this.shades.push({ id, pos: [...pos], state: 'chase', stunnedUntil: 0 });
    if (emit) this.emit('shade_spawned', { id });
  }

  spawnShade(emit = true) {
    const angle = this.rng() * Math.PI * 2;
    this.addShade([Math.sin(angle) * 29, 0, Math.cos(angle) * 29], undefined, emit);
  }

  emit(name, data) { this.events.push({ type: 'event', tick: this.tick, name, data }); }

  step(patch = {}) {
    if (this.state !== 'playing') return [];
    const previous = this.input;
    this.input = { ...previous, ...patch, move: [...(patch.move ?? previous.move)] };
    const edge = (key) => this.input[key] && !previous[key];
    this.events = [];
    this.tick += 1;
    this.timeLeft = Math.max(0, this.initialTime - this.tick / HZ);
    const t = this.tuning;
    const p = this.player;

    const [x, z] = this.input.move;
    const magnitude = Math.max(1, Math.hypot(x, z));
    const yaw = (this.input.cam_yaw_deg % 360) * Math.PI / 180;
    p.pos[0] += ((x * Math.cos(yaw) + z * Math.sin(yaw)) / magnitude) * t.player_speed * DT;
    p.pos[2] += ((-x * Math.sin(yaw) + z * Math.cos(yaw)) / magnitude) * t.player_speed * DT;
    const radius = Math.hypot(p.pos[0], p.pos[2]);
    if (radius > this.world.island_radius) {
      // A visible shore barrier, no fall penalty in Phase 1.
      p.pos[0] *= this.world.island_radius / radius;
      p.pos[2] *= this.world.island_radius / radius;
    }
    if (edge('jump') && p.pos[1] <= EPS) this.velocityY = this.world.jump_speed;
    if (p.pos[1] > 0 || this.velocityY > 0) {
      p.pos[1] = Math.max(0, p.pos[1] + this.velocityY * DT);
      this.velocityY -= this.world.gravity * DT;
      if (p.pos[1] === 0) this.velocityY = 0;
    }

    this.motes = this.motes.filter((mote) => {
      if (p.carried < t.carry_capacity && distance(p.pos, mote.pos) <= t.pickup_radius + EPS) {
        p.carried += 1;
        this.score += t.score.per_mote;
        this.emit('mote_picked', { carried: p.carried });
        return false;
      }
      return true;
    });

    if (edge('interact') && p.carried > 0) {
      const nearest = this.lanterns.filter((l) => !l.lit && distance(p.pos, l.pos) <= t.interact_radius + EPS)
        .sort((a, b) => distance(p.pos, a.pos) - distance(p.pos, b.pos) || a.id.localeCompare(b.id, 'en'))[0];
      if (nearest) {
        const amount = Math.min(p.carried, t.lantern_cost - nearest.deposited);
        p.carried -= amount;
        nearest.deposited += amount;
        this.emit('deposit', { lantern_id: nearest.id, amount, deposited: nearest.deposited });
        if (nearest.deposited >= t.lantern_cost) {
          nearest.lit = true;
          this.score += t.score.per_lantern;
          this.emit('lantern_lit', { lantern_id: nearest.id });
        }
      }
    }

    if (edge('pulse') && p.carried >= t.pulse_cost && this.tick >= this.pulseReadyAt) {
      p.carried -= t.pulse_cost;
      this.pulseReadyAt = this.tick + Math.round(t.pulse_cooldown_s * HZ);
      const stunnedIds = [];
      for (const s of this.shades) if (distance(p.pos, s.pos) <= t.pulse_radius + EPS) {
        const d = distance(p.pos, s.pos);
        const direction = d > EPS ? [(s.pos[0] - p.pos[0]) / d, (s.pos[2] - p.pos[2]) / d] : [1, 0];
        s.pos[0] += direction[0] * t.pulse_push_m;
        s.pos[2] += direction[1] * t.pulse_push_m;
        s.stunnedUntil = this.tick + Math.round(t.pulse_stun_s * HZ);
        s.state = 'stunned';
        stunnedIds.push(s.id);
      }
      this.score += stunnedIds.length * t.score.per_stun;
      this.emit('pulse', { stunned_ids: stunnedIds });
    }

    for (const shade of this.shades) {
      if (this.tick < shade.stunnedUntil) { shade.state = 'stunned'; continue; }
      const playerSafe = this.isSafe(p.pos);
      const insideLight = this.isSafe(shade.pos);
      shade.state = playerSafe || insideLight ? 'flee' : 'chase';
      let dx = p.pos[0] - shade.pos[0];
      let dz = p.pos[2] - shade.pos[2];
      if (insideLight) {
        const light = this.lanterns.find((l) => l.lit && distance(shade.pos, l.pos) <= t.safe_radius + EPS);
        dx = shade.pos[0] - light.pos[0]; dz = shade.pos[2] - light.pos[2];
        if (Math.hypot(dx, dz) <= EPS) { dx = 1; dz = 0; }
      } else if (playerSafe) { dx *= -1; dz *= -1; }
      const d = Math.hypot(dx, dz);
      if (d > EPS) {
        const step = Math.min(d, t.shade_speed * DT);
        const candidate = [shade.pos[0] + dx / d * step, shade.pos[1], shade.pos[2] + dz / d * step];
        if (insideLight || !this.isSafe(candidate)) shade.pos = candidate;
      }
      if (!playerSafe && !insideLight && !this.isSafe(shade.pos)
        && distance(p.pos, shade.pos) <= t.shade_hit_radius + EPS && this.tick >= this.invulnUntil && p.flames > 0) {
        p.flames -= 1;
        const dropped = Math.floor(p.carried * t.hit_drop_ratio);
        p.carried -= dropped;
        // Dropped lights return just outside pickup range and can be recovered.
        for (let i = 0; i < dropped; i++) {
          const a = (i / Math.max(1, dropped)) * Math.PI * 2;
          this.addMote([p.pos[0] + Math.cos(a) * 1.8, 0, p.pos[2] + Math.sin(a) * 1.8]);
        }
        this.invulnUntil = this.tick + Math.round(t.invuln_s * HZ);
        this.emit('player_hit', { by: 'shade', flames: p.flames, dropped });
      }
    }

    if (this.lanterns.every((l) => l.lit)) this.finish('won', 'all_lit');
    else if (p.flames <= 0) this.finish('lost', 'no_flames');
    else if (this.timeLeft <= 0) this.finish('lost', 'dawn');
    else {
      if (this.randomMotes && this.tick % Math.round(this.world.mote_respawn_every_s * HZ) === 0 && this.motes.length < this.world.initial_motes) {
        const angle = this.rng() * Math.PI * 2;
        const r = Math.sqrt(this.rng()) * 28;
        this.addMote([Math.sin(angle) * r, 0, Math.cos(angle) * r]);
      }
      if (this.randomShades && this.tick % Math.round(this.world.shade_spawn_every_s * HZ) === 0 && this.shades.length < this.world.max_shades) this.spawnShade();
    }
    return this.events;
  }

  isSafe(pos) { return this.lanterns.some((l) => l.lit && distance(pos, l.pos) <= this.tuning.safe_radius + EPS); }

  finish(result, reason) {
    this.state = result;
    if (result === 'won') this.score += Math.floor(this.timeLeft) * this.tuning.score.per_second_left + this.player.flames * this.tuning.score.per_flame_left;
    this.emit('game_over', { result, reason });
  }

  snapshot() {
    return {
      type: 'snapshot', tick: this.tick, sim_tick: this.tick, state: this.state,
      time_left_s: rounded(this.timeLeft), score: this.score,
      player: { pos: position(this.player.pos), flames: this.player.flames, carried: this.player.carried },
      lanterns: this.lanterns.map((l) => ({ id: l.id, pos: position(l.pos), lit: l.lit, deposited: l.deposited })),
      shades: this.shades.map((s) => ({ id: s.id, pos: position(s.pos), state: s.state })),
      motes_active: this.motes.length,
      motes: this.motes.map((m) => ({ id: m.id, pos: position(m.pos) })),
    };
  }

  end() { return { type: 'end', ticks: this.tick, state: this.state, score: this.score }; }
}
