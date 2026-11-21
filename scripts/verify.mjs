import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { platform, release, cpus, totalmem } from 'node:os';

const root = fileURLToPath(new URL('../', import.meta.url));
const proof = resolve(root, 'docs/proof/phase-1');
mkdirSync(proof, { recursive: true });
function run(argv) {
  const result = spawnSync(process.execPath, argv, { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`${argv.join(' ')} failed (${result.status})\n${result.stdout}\n${result.stderr}`);
  return result;
}
try {
  const tests = run(['--test', '--test-reporter=tap', 'tests/game.test.mjs', 'tests/cli.test.mjs']);
  writeFileSync(resolve(proof, 'unit-tests.tap'), tests.stdout);
  const testCount = Number(tests.stdout.match(/# tests (\d+)/)?.[1]);
  const passCount = Number(tests.stdout.match(/# pass (\d+)/)?.[1]);
  assert.ok(testCount > 0 && testCount === passCount, 'all discovered tests must pass');
  const cases = [];
  for (const [name, ticks, expected] of [['win', 500, 'won'], ['no-flames', 500, 'lost'], ['dawn', 500, 'lost'], ['pulse', 200, 'playing']]) {
    const args = ['src/headless.mjs', '--seed', '12', '--night', '1', '--ticks', String(ticks), '--scenario', `tests/scenarios/${name}.json`, '--out', `docs/proof/phase-1/${name}.jsonl`, '--snapshot-every', '1'];
    if (name === 'win' || name === 'pulse') args.push('--inputs', `tests/inputs/${name}.json`);
    run(args);
    const bytes = readFileSync(resolve(proof, `${name}.jsonl`));
    const records = bytes.toString('utf8').trim().split('\n').map(JSON.parse);
    assert.equal(records.at(-1).type, 'end'); assert.equal(records.at(-1).state, expected);
    if (name === 'win') {
      assert.equal(records.filter((r) => r.name === 'lantern_lit').length, 5);
      assert.equal(records.filter((r) => r.name === 'mote_picked').length, 50);
      assert.equal(records.at(-1).ticks, 181); assert.equal(records.at(-1).score, 1742);
    }
    if (name === 'no-flames') assert.deepEqual(records.find((r) => r.name === 'game_over').data, { result: 'lost', reason: 'no_flames' });
    if (name === 'dawn') assert.equal(records.at(-1).ticks, 60);
    if (name === 'pulse') assert.deepEqual(records.find((r) => r.name === 'pulse').data.stunned_ids, ['S-near']);
    args[args.indexOf('--out') + 1] = `.cache/${name}-repeat.jsonl`;
    run(args);
    assert.ok(bytes.equals(readFileSync(resolve(root, `.cache/${name}-repeat.jsonl`))), `${name}: nondeterministic output`);
    cases.push({ name, result: records.at(-1), byte_identical_replay: true, sha256: createHash('sha256').update(bytes).digest('hex') });
  }
  // Replay a generated controller on the normal level, with no scenario file.
  const normal = ['src/headless.mjs', '--seed', '12', '--night', '1', '--ticks', '18000', '--inputs', 'tests/inputs/default-playthrough.json', '--out', 'docs/proof/phase-1/default-playthrough.jsonl'];
  run(normal);
  const normalBytes = readFileSync(resolve(proof, 'default-playthrough.jsonl'));
  const normalRecords = normalBytes.toString('utf8').trim().split('\n').map(JSON.parse);
  assert.equal(normalRecords.at(-1).state, 'won');
  assert.equal(normalRecords.filter((r) => r.name === 'lantern_lit').length, 5);
  normal[normal.indexOf('--out') + 1] = '.cache/default-repeat.jsonl'; run(normal);
  assert.ok(normalBytes.equals(readFileSync(resolve(root, '.cache/default-repeat.jsonl'))));
  cases.push({ name: 'default-playthrough-no-scenario', result: normalRecords.at(-1), byte_identical_replay: true, sha256: createHash('sha256').update(normalBytes).digest('hex') });
  const randomArgs = ['src/headless.mjs', '--seed', '11021', '--night', '1', '--ticks', '2400', '--out', '.cache/random-a.jsonl'];
  run(randomArgs); randomArgs[randomArgs.length - 1] = '.cache/random-b.jsonl'; run(randomArgs);
  assert.ok(readFileSync(resolve(root, '.cache/random-a.jsonl')).equals(readFileSync(resolve(root, '.cache/random-b.jsonl'))));
  const sourceHashes = {};
  for (const file of ['game.contract.json', 'src/game.mjs', 'src/headless.mjs', 'src/validation.mjs', 'src/client.mjs', 'web/index.html', 'web/style.css', 'tests/game.test.mjs', 'tests/cli.test.mjs', 'scripts/verify.mjs']) sourceHashes[file] = createHash('sha256').update(readFileSync(resolve(root, file))).digest('hex');
  const result = { generated_at: new Date().toISOString(), scope: 'phase-1-contract-1.0', tests: { total: testCount, passed: passCount, failed: 0 }, scenarios: cases, default_random_replay_identical: true, machine: { platform: platform(), release: release(), node: process.version, cpu: cpus()[0]?.model, memory_gib: Math.round(totalmem() / 1024 ** 3) }, source_sha256: sourceHashes };
  writeFileSync(resolve(proof, 'verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log(`${passCount}/${testCount} tests passed; 4 scenarios plus normal-level win verified and replayed byte-for-byte; random default replay identical.`);
} catch (error) { console.error(error.message); process.exitCode = 1; }
