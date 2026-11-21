import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Game } from '../src/game.mjs';
import { InputError, validateInputs } from '../src/validation.mjs';

const config = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));
const quiet = { random_motes: false, random_shades: false, motes: [], shades: [] };
const make = (scenario = {}) => new Game({ config, seed: 123, scenario: { ...quiet, ...scenario } });
const steps = (g, count, patch = {}) => { for (let i = 0; i < count; i++) g.step(patch); return g; };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('tick 0: player at origin, five lamps, no setup events or setup score', () => {
  const g = make({ lanterns: [{ id: 'L2', lit: true }] });
  assert.deepEqual(g.snapshot().player.pos, [0, 0, 0]);
  assert.equal(g.snapshot().lanterns.length, 5);
  assert.equal(g.tick, 0); assert.equal(g.score, 0); assert.deepEqual(g.events, []);
  assert.equal(g.lanterns[1].deposited, config.tuning.lantern_cost);
});
test('one second of motion is six metres, camera-relative rotation is exact', () => {
  const g = make(); steps(g, 60, { move: [0, 1], cam_yaw_deg: 90 });
  near(g.player.pos[0], 6); near(g.player.pos[2], 0); near(g.timeLeft, 299);
  assert.equal(g.snapshot().sim_tick, 60);
});
test('diagonal input is normalized and absent input fields retain previous values', () => {
  const g = make(); g.step({ move: [1, 1] }); steps(g, 59);
  near(Math.hypot(g.player.pos[0], g.player.pos[2]), 6);
  g.step({ move: [0, 0] }); const p = [...g.player.pos]; steps(g, 10);
  assert.deepEqual(g.player.pos, p);
});
test('pickup includes exact radius and ignores height; outside radius stays', () => {
  const g = make({ motes: [[1.35, 99, 0], [1.35001, 0, 0]] });
  const events = g.step(); assert.equal(g.player.carried, 1); assert.equal(g.motes.length, 1);
  assert.deepEqual(events, [{ type: 'event', tick: 1, name: 'mote_picked', data: { carried: 1 } }]);
  assert.equal(g.score, 10);
});
test('pickup capacity does not destroy uncollected motes', () => {
  const g = make({ player: { carried: 11 }, motes: [[0, 0, 0], [0, 0, 0], [0, 0, 0]] });
  g.step(); assert.equal(g.player.carried, 12); assert.equal(g.motes.length, 2); assert.equal(g.score, 10);
});
test('deposit includes exact radius, supports partial deposit and correct event payload', () => {
  const g = make({ player: { carried: 3 }, lanterns: [{ id: 'L1', pos: [2.5, 20, 0], deposited: 4 }] });
  assert.deepEqual(g.step({ interact: true }), [{ type: 'event', tick: 1, name: 'deposit', data: { lantern_id: 'L1', amount: 3, deposited: 7 } }]);
  assert.equal(g.player.carried, 0); assert.equal(g.lanterns[0].lit, false);
});
test('outside interact radius cannot deposit', () => {
  const g = make({ player: { carried: 10 }, lanterns: [{ id: 'L1', pos: [2.50001, 0, 0] }] });
  assert.deepEqual(g.step({ interact: true }), []); assert.equal(g.player.carried, 10);
});
test('interact is a rising edge; nearest lamp wins ties in stable ID order', () => {
  const g = make({ player: { carried: 12 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 9 }, { id: 'L2', pos: [0, 0, 0] }] });
  g.step({ interact: true }); assert.equal(g.lanterns[0].lit, true); assert.equal(g.player.carried, 11);
  steps(g, 10, { interact: true }); assert.equal(g.lanterns[1].deposited, 0);
  g.step({ interact: false }); g.step({ interact: true });
  assert.equal(g.lanterns[1].lit, true); assert.equal(g.player.carried, 1); assert.equal(g.score, 200);
});
test('pulse includes radius, reports IDs, costs light, pushes and stuns', () => {
  const g = make({ player: { carried: 6 }, shades: [{ id: 'edge', pos: [5, 0, 0] }, { id: 'outside', pos: [5.00001, 0, 0] }] });
  const pulse = g.step({ pulse: true }).find((e) => e.name === 'pulse');
  assert.deepEqual(pulse.data, { stunned_ids: ['edge'] });
  assert.equal(g.player.carried, 3); assert.equal(g.shades[0].state, 'stunned'); near(g.shades[0].pos[0], 8);
  assert.equal(g.shades[1].state, 'chase'); assert.equal(g.score, 15);
});
test('pulse cannot fire without sufficient carried light', () => {
  const g = make({ player: { carried: 2 }, shades: [{ pos: [2, 0, 0] }] });
  assert.equal(g.step({ pulse: true }).some((e) => e.name === 'pulse'), false); assert.equal(g.player.carried, 2);
});
test('pulse cooldown and holding do not retrigger actions', () => {
  const g = make({ player: { carried: 12 } });
  g.step({ pulse: true }); g.step({ pulse: false });
  assert.deepEqual(g.step({ pulse: true }), []);
  steps(g, 100, { pulse: true }); assert.equal(g.player.carried, 9);
  g.step({ pulse: false }); g.step({ pulse: true }); assert.equal(g.player.carried, 6);
});
test('stun recovers at the declared tick without moving before recovery', () => {
  const g = make({ player: { carried: 3 }, shades: [{ pos: [2, 0, 0] }] });
  g.step({ pulse: true }); const x = g.shades[0].pos[0];
  steps(g, 179); assert.equal(g.tick, 180); assert.equal(g.shades[0].state, 'stunned'); near(g.shades[0].pos[0], x);
  g.step(); assert.equal(g.shades[0].state, 'chase'); assert.ok(g.shades[0].pos[0] < x);
});
test('shade chase speed uses XZ distance, not vertical offset', () => {
  const g = make({ shades: [{ pos: [10, 100, 0] }] });
  steps(g, 60); near(g.shades[0].pos[0], 7.8);
});
test('contact: one flame, floor-rounded light drop and recoverable motes', () => {
  const g = make({ player: { carried: 9 }, shades: [{ pos: [0, 10, 0] }] });
  const hit = g.step().find((e) => e.name === 'player_hit');
  assert.deepEqual(hit, { type: 'event', tick: 1, name: 'player_hit', data: { by: 'shade', flames: 2, dropped: 2 } });
  assert.equal(g.player.carried, 7); assert.equal(g.motes.length, 2);
});
test('invulnerability blocks simultaneous and repeated hits until exactly two seconds', () => {
  const g = make({ shades: [{ id: 'one', pos: [0, 0, 0] }, { id: 'two', pos: [0, 0, 0] }] });
  assert.equal(g.step().filter((e) => e.name === 'player_hit').length, 1);
  steps(g, 119); assert.equal(g.player.flames, 2);
  g.step(); assert.equal(g.tick, 121); assert.equal(g.player.flames, 1);
});
test('lit lamp safe zone prevents damage, including shades placed inside by a scenario', () => {
  const g = make({ lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [0, 0, 0] }] });
  steps(g, 300); assert.equal(g.player.flames, 3); assert.equal(g.shades[0].state, 'flee');
});
test('chasing shades cannot cross through a lit lamp safe radius', () => {
  const g = make({ player: { pos: [6, 0, 0] }, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ pos: [-6, 0, 0] }] });
  steps(g, 200); assert.ok(g.shades[0].pos[0] < -4); assert.equal(g.player.flames, 3);
});
test('all five lamps wins once; only earned events score, with time and flame bonus', () => {
  const g = make({ time_left_s: 120, player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 9 }, ...[2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true }))] });
  assert.equal(g.score, 0);
  const events = g.step({ interact: true });
  assert.deepEqual(events.map((e) => e.name), ['deposit', 'lantern_lit', 'game_over']);
  assert.equal(g.state, 'won'); assert.equal(g.score, 488);
  const snapshot = g.snapshot(); assert.deepEqual(g.step(), []); assert.deepEqual(g.snapshot(), snapshot);
});
test('no flames loses at step one and records correct reason', () => {
  const g = make({ player: { flames: 1 }, shades: [{ pos: [0, 0, 0] }] });
  assert.deepEqual(g.step().at(-1), { type: 'event', tick: 1, name: 'game_over', data: { result: 'lost', reason: 'no_flames' } });
  assert.equal(g.state, 'lost'); assert.equal(g.end().ticks, 1);
});
test('dawn is based on simulated steps, not wall clock', () => {
  const g = make({ time_left_s: 2 / 60 }); g.step(); assert.equal(g.state, 'playing');
  assert.deepEqual(g.step().at(-1).data, { result: 'lost', reason: 'dawn' }); assert.equal(g.timeLeft, 0);
});
test('jump rises and lands; a held key cannot repeatedly jump', () => {
  const g = make(); g.step({ jump: true }); assert.ok(g.player.pos[1] > 0);
  steps(g, 119, { jump: true }); assert.equal(g.player.pos[1], 0);
  g.step({ jump: false }); g.step({ jump: true }); assert.ok(g.player.pos[1] > 0);
});
test('shore boundary prevents falls without damage', () => {
  const g = make({ player: { pos: [31.9, 0, 0] } }); steps(g, 60, { move: [1, 0] });
  near(g.player.pos[0], 32); assert.equal(g.player.flames, 3); assert.equal(config.tuning.fall_enabled, false);
});
test('random flags disable initial generation and future spawning', () => {
  const g = make(); steps(g, 1200); assert.equal(g.motes.length, 0); assert.equal(g.shades.length, 0);
});
test('spawn events have tick and stable generated IDs, avoiding explicit ID collisions', () => {
  const g = make({ random_shades: true, lanterns: [{ id: 'L1', pos: [0, 0, 0], lit: true }], shades: [{ id: 'S1', pos: [29, 0, 0] }, { pos: [-29, 0, 0] }] });
  assert.deepEqual(g.shades.map((s) => s.id), ['S1', 'S2']);
  steps(g, 1079); const spawn = g.step().find((e) => e.name === 'shade_spawned');
  assert.deepEqual(spawn, { type: 'event', tick: 1080, name: 'shade_spawned', data: { id: 'S3' } });
});
test('same seed and inputs produce identical complete state and events', () => {
  const a = new Game({ config, seed: 9 }), b = new Game({ config, seed: 9 });
  for (let i = 0; i < 1300; i++) {
    const patch = { move: [Math.sin(i / 120), Math.cos(i / 120)], pulse: i % 121 === 0 };
    assert.deepEqual(a.step(patch), b.step(patch));
  }
  assert.deepEqual(a.snapshot(), b.snapshot());
  assert.notDeepEqual(new Game({ config, seed: 10 }).snapshot().motes, new Game({ config, seed: 11 }).snapshot().motes);
});

const badInputs = [null, {}, { frames: null }, { frames: [{ tick: -1 }] }, { frames: [{ tick: 1 }, { tick: 1 }] }, { frames: [{ tick: 2 }, { tick: 1 }] }, { frames: [{ tick: 0.5 }] }, { frames: [{ tick: 0, move: [2, 0] }] }, { frames: [{ tick: 0, move: [0] }] }, { frames: [{ tick: 0, pulse: 1 }] }, { frames: [{ tick: 0, jump: 'true' }] }, { frames: [{ tick: 0, cam_yaw_deg: '90' }] }];
for (const [i, input] of badInputs.entries()) test(`invalid inputs case ${i + 1} is rejected`, () => assert.throws(() => validateInputs(input), InputError));
const badScenarios = [null, [], { random_motes: 0 }, { player: { carried: 13 } }, { player: { flames: -1 } }, { player: { pos: [0, 0] } }, { lanterns: [{ id: 'L6' }] }, { lanterns: [{ id: 'L1' }, { id: 'L1' }] }, { shades: [{ pos: [0, 0, 0], id: 'same' }, { pos: [1, 0, 0], id: 'same' }] }, { motes: [{ pos: [0, 0, 0] }] }, { time_left_s: -1 }];
for (const [i, scenario] of badScenarios.entries()) test(`invalid scenario case ${i + 1} is rejected`, () => assert.throws(() => new Game({ config, scenario }), InputError));
