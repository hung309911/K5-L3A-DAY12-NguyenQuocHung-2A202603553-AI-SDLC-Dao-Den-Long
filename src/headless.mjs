import { readFileSync, mkdirSync, openSync, writeSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { Game } from './game.mjs';
import { InputError, validateInputs } from './validation.mjs';

const config = JSON.parse(readFileSync(new URL('../game.contract.json', import.meta.url), 'utf8'));

function args(argv) {
  const result = { 'snapshot-every': '10' };
  const known = ['seed', 'night', 'scenario', 'inputs', 'ticks', 'out', 'snapshot-every'];
  const seen = new Set();
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!argv[i]?.startsWith('--') || !known.includes(key) || seen.has(key) || argv[i + 1] === undefined) throw new InputError(`Invalid option: ${argv[i] ?? ''}`);
    result[key] = argv[i + 1]; seen.add(key);
  }
  for (const key of ['seed', 'night', 'ticks', 'out']) if (!(key in result)) throw new InputError(`Missing --${key}`);
  for (const key of ['seed', 'night', 'ticks', 'snapshot-every']) {
    if (!/^-?\d+$/.test(result[key]) || !Number.isSafeInteger(Number(result[key]))) throw new InputError(`--${key} must be an integer`);
    result[key] = Number(result[key]);
  }
  if (result.night !== 1) throw new InputError('Phase 1 supports --night 1 only');
  if (result.ticks < 0 || result['snapshot-every'] <= 0) throw new InputError('ticks must be nonnegative and snapshot-every must be positive');
  for (const key of ['inputs', 'scenario']) if (result[key] && resolve(result[key]) === resolve(result.out)) throw new InputError('--out must differ from input files');
  return result;
}

function jsonFile(path, fallback) {
  if (!path) return fallback;
  let text;
  try { text = readFileSync(path, 'utf8').replace(/^\uFEFF/, ''); }
  catch (error) { throw new InputError(`Cannot read ${path}: ${error.message}`); }
  try { return JSON.parse(text); }
  catch { throw new InputError(`Invalid JSON in ${path}`); }
}

let temp, fd;
try {
  const options = args(process.argv.slice(2));
  const scenario = jsonFile(options.scenario, {});
  const { frames } = validateInputs(jsonFile(options.inputs, { frames: [] }));
  const game = new Game({ config, seed: options.seed, scenario });
  const out = resolve(options.out);
  mkdirSync(dirname(out), { recursive: true });
  temp = `${out}.tmp-${process.pid}`;
  fd = openSync(temp, 'w');
  let buffer = '';
  const line = (record) => {
    buffer += JSON.stringify(record) + '\n';
    if (buffer.length > 262144) { writeSync(fd, buffer); buffer = ''; }
  };
  line(game.snapshot());
  let frameIndex = 0;
  while (game.tick < options.ticks && game.state === 'playing') {
    const patch = frames[frameIndex]?.tick === game.tick ? frames[frameIndex++] : {};
    for (const event of game.step(patch)) line(event);
    if (game.tick % options['snapshot-every'] === 0) line(game.snapshot());
  }
  line(game.end());
  if (buffer) writeSync(fd, buffer);
  closeSync(fd); fd = undefined;
  renameSync(temp, out); temp = undefined;
} catch (error) {
  if (fd !== undefined) try { closeSync(fd); } catch { /* retain original error */ }
  if (temp) try { unlinkSync(temp); } catch { /* retain original error */ }
  process.stderr.write(`${error.message}\n`);
  process.exitCode = error instanceof InputError ? 2 : 1;
}
