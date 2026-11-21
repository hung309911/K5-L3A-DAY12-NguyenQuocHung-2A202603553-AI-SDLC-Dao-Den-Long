// A deterministic bot plays the normal level; no scenario overrides or cheats.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { Game } from '../src/game.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(resolve(root, 'game.contract.json'), 'utf8'));
const game = new Game({ config, seed: 12 });
const frames = [];
const distance = (p) => Math.hypot(p[0] - game.player.pos[0], p[2] - game.player.pos[2]);
while (game.state === 'playing' && game.tick < 18000) {
  const lamp = game.lanterns.filter((l) => !l.lit).sort((a, b) => distance(a.pos) - distance(b.pos))[0];
  const deposit = lamp && game.player.carried >= config.tuning.lantern_cost - lamp.deposited;
  const target = deposit ? lamp : [...game.motes].sort((a, b) => distance(a.pos) - distance(b.pos))[0];
  let move = [0, 0];
  if (target && distance(target.pos) > 0.05) {
    const d = distance(target.pos);
    move = [(target.pos[0] - game.player.pos[0]) / d, (target.pos[2] - game.player.pos[2]) / d].map((x) => Math.max(-1, Math.min(1, x)));
  }
  const patch = {
    tick: game.tick, move, cam_yaw_deg: 0,
    interact: !!deposit && distance(lamp.pos) <= config.tuning.interact_radius && !game.input.interact,
    pulse: !game.input.pulse && game.tick + 1 >= game.pulseReadyAt && game.player.carried >= config.tuning.pulse_cost && game.shades.some((s) => s.state !== 'stunned' && distance(s.pos) < 2.6),
  };
  frames.push(patch); game.step(patch);
}
assert.equal(game.state, 'won', 'default level bot failed to win; review playability');
mkdirSync(resolve(root, 'tests/inputs'), { recursive: true });
writeFileSync(resolve(root, 'tests/inputs/default-playthrough.json'), JSON.stringify({ frames }) + '\n');
console.log(`Normal level completed: ${game.tick} ticks (${(game.tick / 60).toFixed(2)} simulated seconds), score ${game.score}, flames ${game.player.flames}.`);
