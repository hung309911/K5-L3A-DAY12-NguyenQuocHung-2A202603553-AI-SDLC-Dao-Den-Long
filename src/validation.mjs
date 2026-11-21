export class InputError extends Error {}

const fail = (message) => { throw new InputError(message); };
const obj = (value, at) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${at}: expected object`);
};
const keys = (value, allowed, at) => {
  obj(value, at);
  for (const key of Object.keys(value)) if (!allowed.includes(key)) fail(`${at}: unknown field ${key}`);
};
const num = (value, at) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) fail(`${at}: expected finite number`);
};
const int = (value, min, max, at) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) fail(`${at}: expected integer in [${min}, ${max}]`);
};
const bool = (value, at) => { if (typeof value !== 'boolean') fail(`${at}: expected boolean`); };
const vec = (value, size, at) => {
  if (!Array.isArray(value) || value.length !== size) fail(`${at}: expected ${size}-element array`);
  value.forEach((n, i) => num(n, `${at}[${i}]`));
};
const array = (value, at) => { if (!Array.isArray(value)) fail(`${at}: expected array`); };

export function validateInputs(inputs) {
  keys(inputs, ['frames'], 'inputs');
  array(inputs.frames, 'inputs.frames');
  let previousTick = -1;
  for (const [i, frame] of inputs.frames.entries()) {
    const at = `inputs.frames[${i}]`;
    keys(frame, ['tick', 'move', 'cam_yaw_deg', 'jump', 'interact', 'pulse'], at);
    int(frame.tick, 0, Number.MAX_SAFE_INTEGER, `${at}.tick`);
    if (frame.tick <= previousTick) fail(`${at}.tick: frames must increase strictly`);
    previousTick = frame.tick;
    if ('move' in frame) {
      vec(frame.move, 2, `${at}.move`);
      if (frame.move.some((n) => n < -1 || n > 1)) fail(`${at}.move: components must be in [-1, 1]`);
    }
    if ('cam_yaw_deg' in frame) num(frame.cam_yaw_deg, `${at}.cam_yaw_deg`);
    for (const key of ['jump', 'interact', 'pulse']) if (key in frame) bool(frame[key], `${at}.${key}`);
  }
  return inputs;
}

export function validateScenario(scenario, config) {
  keys(scenario, ['player', 'random_motes', 'random_shades', 'motes', 'shades', 'lanterns', 'time_left_s'], 'scenario');
  if ('player' in scenario) {
    keys(scenario.player, ['pos', 'carried', 'flames'], 'scenario.player');
    if ('pos' in scenario.player) vec(scenario.player.pos, 3, 'scenario.player.pos');
    if ('carried' in scenario.player) int(scenario.player.carried, 0, config.tuning.carry_capacity, 'scenario.player.carried');
    if ('flames' in scenario.player) int(scenario.player.flames, 0, config.tuning.flames, 'scenario.player.flames');
  }
  for (const key of ['random_motes', 'random_shades']) if (key in scenario) bool(scenario[key], `scenario.${key}`);
  if ('time_left_s' in scenario) {
    num(scenario.time_left_s, 'scenario.time_left_s');
    if (scenario.time_left_s < 0) fail('scenario.time_left_s: expected nonnegative number');
  }
  if ('motes' in scenario) {
    array(scenario.motes, 'scenario.motes');
    scenario.motes.forEach((p, i) => vec(p, 3, `scenario.motes[${i}]`));
  }
  if ('shades' in scenario) {
    array(scenario.shades, 'scenario.shades');
    const ids = new Set();
    scenario.shades.forEach((s, i) => {
      const at = `scenario.shades[${i}]`;
      keys(s, ['id', 'pos'], at);
      vec(s.pos, 3, `${at}.pos`);
      if ('id' in s) {
        if (typeof s.id !== 'string' || !s.id.trim() || ids.has(s.id)) fail(`${at}.id: expected unique nonempty string`);
        ids.add(s.id);
      }
    });
  }
  if ('lanterns' in scenario) {
    array(scenario.lanterns, 'scenario.lanterns');
    const ids = new Set();
    scenario.lanterns.forEach((l, i) => {
      const at = `scenario.lanterns[${i}]`;
      keys(l, ['id', 'pos', 'deposited', 'lit'], at);
      if (typeof l.id !== 'string' || !/^L[1-5]$/.test(l.id) || ids.has(l.id)) fail(`${at}.id: expected unique L1...L5`);
      ids.add(l.id);
      if ('pos' in l) vec(l.pos, 3, `${at}.pos`);
      if ('deposited' in l) int(l.deposited, 0, config.tuning.lantern_cost, `${at}.deposited`);
      if ('lit' in l) bool(l.lit, `${at}.lit`);
    });
  }
  return scenario;
}
