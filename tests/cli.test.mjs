import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function run(extra = [], scenario = { random_motes: false, random_shades: false }, inputs = { frames: [] }) {
  const dir = mkdtempSync(join(tmpdir(), 'dao-contract-'));
  const out = join(dir, 'out.jsonl');
  writeFileSync(join(dir, 'scenario.json'), JSON.stringify(scenario));
  writeFileSync(join(dir, 'inputs.json'), JSON.stringify(inputs));
  const result = spawnSync(process.execPath, ['src/headless.mjs', '--seed', '4', '--night', '1', '--ticks', '13', '--out', out, '--scenario', join(dir, 'scenario.json'), '--inputs', join(dir, 'inputs.json'), ...extra], { cwd: root, encoding: 'utf8' });
  const text = existsSync(out) ? readFileSync(out, 'utf8') : '';
  rmSync(dir, { recursive: true, force: true });
  return { ...result, text, records: text.trim() ? text.trim().split('\n').map(JSON.parse) : [] };
}
test('CLI contract defaults to snapshots 0,10; final record is mandatory end', () => {
  const result = run(); assert.equal(result.status, 0, result.stderr); assert.equal(result.stdout, '');
  assert.deepEqual(result.records.filter((r) => r.type === 'snapshot').map((s) => s.tick), [0, 10]);
  assert.deepEqual(result.records.at(-1), { type: 'end', ticks: 13, state: 'playing', score: 0 });
});
test('no optional scenario or inputs files is supported', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dao-defaults-'));
  try {
    const result = spawnSync(process.execPath, ['src/headless.mjs', '--seed', '-3', '--night', '1', '--ticks', '0', '--out', join(dir, 'out.jsonl')], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    const records = readFileSync(join(dir, 'out.jsonl'), 'utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.length, 2); assert.equal(records[0].tick, 0); assert.equal(records[1].ticks, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('event tick follows input tick by one, then snapshot, then end on early game over', () => {
  const scenario = { random_motes: false, random_shades: false, motes: [[0, 0, 0]], lanterns: [1, 2, 3, 4, 5].map((i) => ({ id: `L${i}`, lit: true })) };
  const result = run(['--snapshot-every', '1'], scenario, { frames: [{ tick: 0, move: [1, 0] }] });
  assert.equal(result.status, 0); assert.deepEqual(result.records.map((r) => r.type), ['snapshot', 'event', 'event', 'snapshot', 'end']);
  assert.equal(result.records[0].score, 0); assert.equal(result.records[1].tick, 1); assert.equal(result.records.at(-1).ticks, 1);
  assert.deepEqual(result.records[3].player.pos, [0.1, 0, 0]);
});
test('malformed input schema exits 2, writes stderr and no output', () => {
  const result = run([], {}, { frames: [{ tick: 2 }, { tick: 1 }] });
  assert.equal(result.status, 2); assert.match(result.stderr, /strictly/); assert.equal(result.text, '');
});
test('malformed scenario schema exits 2', () => { const r = run([], { player: { carried: '3' } }); assert.equal(r.status, 2); assert.equal(r.text, ''); });
test('malformed JSON file exits 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dao-badjson-'));
  try {
    writeFileSync(join(dir, 'bad.json'), '{ broken');
    const result = spawnSync(process.execPath, ['src/headless.mjs', '--seed', '1', '--night', '1', '--ticks', '1', '--out', join(dir, 'out.jsonl'), '--scenario', join(dir, 'bad.json')], { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 2); assert.match(result.stderr, /Invalid JSON/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
test('unknown and duplicate CLI arguments fail instead of silently ignoring', () => { assert.equal(run(['--bogus', '1']).status, 2); assert.equal(run(['--seed', '8']).status, 2); });
test('headless JSONL is byte-for-byte deterministic with random generation', () => {
  const a = run([], {}), b = run([], {}); assert.equal(a.status, 0); assert.equal(b.status, 0); assert.equal(a.text, b.text);
});
