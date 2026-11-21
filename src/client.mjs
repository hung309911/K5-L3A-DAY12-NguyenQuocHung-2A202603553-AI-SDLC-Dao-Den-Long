import * as THREE from 'three';
import { Game, HZ, seededRandom } from './game.mjs';

const $ = (id) => document.getElementById(id);
const config = await fetch('./game.contract.json').then((r) => {
  if (!r.ok) throw new Error('Không tải được cấu hình game.');
  return r.json();
}).catch(showFatal);
if (config) {
  try { launch(config); } catch (error) { showFatal(error); }
}

function showFatal(error) {
  $('intro').hidden = true;
  $('modal').hidden = false;
  $('modal-title').textContent = 'Chưa thể mở hòn đảo';
  $('modal-body').textContent = `${error.message} Hãy dùng trình duyệt có WebGL 2 và bật tăng tốc đồ họa.`;
  $('resume').hidden = true;
  $('restart').textContent = 'Tải lại trang';
  $('restart').onclick = () => location.reload();
}

function launch(config) {
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#14253a');
  scene.fog = new THREE.FogExp2('#1c3045', 0.010);
  const camera = new THREE.PerspectiveCamera(49, innerWidth / innerHeight, 0.1, 250);
  camera.position.set(43, 31, 46);
  camera.lookAt(-6, 0, 0);
  const ambient = new THREE.HemisphereLight('#9bc8e8', '#172f2f', 1.7);
  scene.add(ambient);
  const moonlight = new THREE.DirectionalLight('#b6d3e7', 2.3);
  moonlight.position.set(-12, 32, -18);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(1024, 1024);
  Object.assign(moonlight.shadow.camera, { left: -38, right: 38, top: 38, bottom: -38, far: 90 });
  moonlight.shadow.normalBias = 0.04;
  scene.add(moonlight);

  const material = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...extra });
  const mesh = (geometry, mat, parent, pos = [0, 0, 0]) => {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(...pos); object.castShadow = true; object.receiveShadow = true;
    parent.add(object); return object;
  };
  const green = material('#35645a', { flatShading: true });
  const cliff = material('#253e48', { flatShading: true });
  const earth = material('#203641', { flatShading: true });
  mesh(new THREE.CylinderGeometry(32, 26, 7, 40, 2), [green, green, cliff], scene, [0, -3.6, 0]);
  mesh(new THREE.CylinderGeometry(26, 9, 7, 26), earth, scene, [0, -10.6, 0]);
  const ground = mesh(new THREE.CircleGeometry(32, 72), green, scene, [0, 0, 0]);
  ground.rotation.x = -Math.PI / 2;
  const shore = mesh(new THREE.TorusGeometry(31.8, 0.07, 5, 160), material('#8cbca7', { emissive: '#395f5b', emissiveIntensity: 0.5 }), scene, [0, 0.05, 0]);
  shore.rotation.x = Math.PI / 2;

  const sceneryRng = seededRandom(812);
  const bark = material('#506160');
  const leaves = [material('#315655', { flatShading: true }), material('#3b6e65', { flatShading: true }), material('#537f70', { flatShading: true })];
  for (let i = 0; i < 20; i++) {
    const a = sceneryRng() * Math.PI * 2, r = 24 + sceneryRng() * 6;
    const tree = new THREE.Group(); tree.position.set(Math.sin(a) * r, 0, Math.cos(a) * r); scene.add(tree);
    const scale = 0.75 + sceneryRng() * 0.65; tree.scale.setScalar(scale);
    mesh(new THREE.CylinderGeometry(0.13, 0.22, 2.1, 6), bark, tree, [0, 1.05, 0]);
    for (let j = 0; j < 3; j++) mesh(new THREE.ConeGeometry(1.4 - j * 0.23, 1.8, 7), leaves[j], tree, [0, 2 + j * 0.8, 0]);
  }
  const stone = material('#78918b', { flatShading: true });
  for (let i = 0; i < 50; i++) {
    const a = sceneryRng() * Math.PI * 2, r = 9 + sceneryRng() * 21;
    const rock = mesh(new THREE.DodecahedronGeometry(0.3 + sceneryRng() * 0.5), stone, scene, [Math.sin(a) * r, 0.07, Math.cos(a) * r]);
    rock.scale.y = 0.4;
  }
  // A path of small stones is decorative; it has no collision or gameplay effect.
  for (let arm = 0; arm < 5; arm++) for (let j = 0; j < 12; j++) {
    const a = arm / 5 * Math.PI * 2, r = 3 + j * 1.22;
    const step = mesh(new THREE.CylinderGeometry(0.31, 0.35, 0.05, 7), stone, scene, [Math.sin(a) * r, 0.025, Math.cos(a) * r]);
    step.scale.z = 1.5; step.rotation.y = a;
  }
  const grassMat = material('#6b9980', { side: THREE.DoubleSide });
  for (let i = 0; i < 80; i++) {
    const a = sceneryRng() * Math.PI * 2, r = Math.sqrt(sceneryRng()) * 30;
    const grass = mesh(new THREE.ConeGeometry(0.13, 0.55, 3), grassMat, scene, [Math.sin(a) * r, 0.23, Math.cos(a) * r]);
    grass.rotation.z = 0.12; grass.castShadow = false;
  }

  const cloudMat = new THREE.MeshBasicMaterial({ color: '#4f657c', transparent: true, opacity: 0.22, depthWrite: false });
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 38; i++) {
    const a = i / 38 * Math.PI * 2, r = 38 + sceneryRng() * 35;
    const cloud = mesh(new THREE.IcosahedronGeometry(3 + sceneryRng() * 5, 1), cloudMat, clouds, [Math.sin(a) * r, -6 - sceneryRng() * 6, Math.cos(a) * r]);
    cloud.scale.set(2.5, 0.4, 1); cloud.castShadow = false; cloud.receiveShadow = false;
  }
  const starsData = new Float32Array(250 * 3);
  for (let i = 0; i < 250; i++) starsData.set([(sceneryRng() - 0.5) * 180, 25 + sceneryRng() * 70, (sceneryRng() - 0.5) * 180], i * 3);
  const starsGeo = new THREE.BufferGeometry(); starsGeo.setAttribute('position', new THREE.BufferAttribute(starsData, 3));
  scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#c3d7e9', size: 0.14, transparent: true, opacity: 0.7 })));

  const hero = new THREE.Group(); scene.add(hero);
  const clothes = material('#c57454'), dark = material('#283d47'), skin = material('#edbd92');
  mesh(new THREE.CylinderGeometry(0.25, 0.35, 0.65, 8), clothes, hero, [0, 0.9, 0]);
  mesh(new THREE.SphereGeometry(0.28, 12, 10), skin, hero, [0, 1.48, 0]);
  const hat = mesh(new THREE.ConeGeometry(0.75, 0.42, 24), material('#e3c48a'), hero, [0, 1.9, 0]);
  mesh(new THREE.TorusGeometry(0.65, 0.025, 5, 24), material('#9e7c51'), hat, [0, -0.15, 0]).rotation.x = Math.PI / 2;
  const legA = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.55, 6), dark, hero, [-0.15, 0.3, 0]);
  const legB = mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.55, 6), dark, hero, [0.15, 0.3, 0]);
  const armA = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), clothes, hero, [-0.35, 1, 0]);
  const armB = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 6), clothes, hero, [0.35, 1, 0]);
  for (const x of [-0.1, 0.1]) mesh(new THREE.SphereGeometry(0.025, 6, 6), dark, hero, [x, 1.5, -0.26]);
  const flameMat = material('#ffd598', { emissive: '#ffb546', emissiveIntensity: 2.2 });
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.45, 5), bark, hero, [0.63, 1.4, 0]);
  const miniLantern = mesh(new THREE.SphereGeometry(0.16, 10, 8), flameMat, hero, [0.63, 1.1, 0]);
  miniLantern.scale.y = 1.3;
  const heroLight = new THREE.PointLight('#ffcc7b', 9, 7, 1.6); heroLight.position.set(0.63, 1.25, 0); hero.add(heroLight);
  const shadow = mesh(new THREE.CircleGeometry(0.5, 20), new THREE.MeshBasicMaterial({ color: '#061b22', transparent: true, opacity: 0.35, depthWrite: false }), scene, [0, 0.013, 0]);
  shadow.rotation.x = -Math.PI / 2;

  const lanternViews = new Map(), shadeViews = new Map();
  function createLantern() {
    const group = new THREE.Group(); scene.add(group);
    mesh(new THREE.CylinderGeometry(0.12, 0.2, 2.8, 8), material('#645c55'), group, [0, 1.4, 0]);
    mesh(new THREE.CylinderGeometry(0.8, 1, 0.3, 8), stone, group, [0, 0.15, 0]);
    const lampMat = material('#8a7d64', { emissive: '#ffb441', emissiveIntensity: 0.04 });
    const lamp = mesh(new THREE.SphereGeometry(0.68, 12, 10), lampMat, group, [0, 3.05, 0]); lamp.scale.y = 1.35;
    for (const y of [2.1, 3.95]) mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.13, 10), material('#c2a16d'), group, [0, y, 0]);
    mesh(new THREE.ConeGeometry(0.75, 0.4, 8), material('#557271'), group, [0, 4.23, 0]);
    const light = new THREE.PointLight('#ffbb60', 0, 16, 1.7); light.position.y = 3; group.add(light);
    const halo = mesh(new THREE.RingGeometry(config.tuning.safe_radius - 0.07, config.tuning.safe_radius, 64), new THREE.MeshBasicMaterial({ color: '#ffd58d', side: THREE.DoubleSide, transparent: true, opacity: 0.27, depthWrite: false }), group, [0, 0.025, 0]); halo.rotation.x = -Math.PI / 2;
    const marker = mesh(new THREE.OctahedronGeometry(0.19), flameMat, group, [0, 5, 0]);
    return { group, lampMat, light, halo, marker };
  }
  const shadeMat = material('#312643', { emissive: '#39224b', emissiveIntensity: 0.2, flatShading: true });
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#e7acd7' });
  function createShade() {
    const group = new THREE.Group(); scene.add(group);
    const body = mesh(new THREE.SphereGeometry(0.65, 10, 9), shadeMat, group, [0, 0.8, 0]); body.scale.set(1, 1.2, 0.85);
    for (const x of [-0.2, 0.2]) mesh(new THREE.SphereGeometry(0.095, 7, 6), eyeMat, group, [x, 0.95, -0.49]);
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2;
      mesh(new THREE.ConeGeometry(0.17, 0.6, 5), shadeMat, group, [Math.sin(a) * 0.45, 0.3, Math.cos(a) * 0.4]);
    }
    const ring = mesh(new THREE.TorusGeometry(0.7, 0.035, 5, 24), flameMat, group, [0, 1.7, 0]); ring.rotation.x = Math.PI / 2;
    return { group, ring };
  }
  const moteGeometry = new THREE.BufferGeometry();
  const moteGlow = document.createElement('canvas'); moteGlow.width = moteGlow.height = 32;
  const ctx = moteGlow.getContext('2d');
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, '#fff5caff'); gradient.addColorStop(0.15, '#ffdd8eff'); gradient.addColorStop(0.4, '#ffcc6660'); gradient.addColorStop(1, '#ffcc6600');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 32, 32);
  const motesView = new THREE.Points(moteGeometry, new THREE.PointsMaterial({ size: 0.68, map: new THREE.CanvasTexture(moteGlow), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: '#fff0ab' })); scene.add(motesView);
  const pulseRing = mesh(new THREE.TorusGeometry(1, 0.035, 6, 72), new THREE.MeshBasicMaterial({ color: '#ffd48b', transparent: true, opacity: 0, depthWrite: false }), scene); pulseRing.rotation.x = Math.PI / 2;
  let pulseAge = 10, pulseCenter = [0, 0, 0];

  let game = new Game({ config });
  let qaFrames = null, qaFrameIndex = 0;
  let mode = 'menu', yaw = 0, accumulator = 0, lastFrame = performance.now(), walk = 0;
  let toastUntil = 0, soundEnabled = false, audio, hasPicked = false, cameraSettled = false;
  const keys = new Set();
  const track = $('lantern-track');
  for (let i = 0; i < 5; i++) { const item = document.createElement('div'); item.textContent = '♧'; item.title = `Đèn L${i + 1}`; track.append(item); }
  function chime(frequency = 700) {
    if (!soundEnabled) return;
    audio ??= new AudioContext();
    if (audio.state === 'suspended') audio.resume();
    const oscillator = audio.createOscillator(), volume = audio.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 1.5, audio.currentTime + 0.25);
    volume.gain.setValueAtTime(0.035, audio.currentTime); volume.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.45);
    oscillator.connect(volume); volume.connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.46);
  }
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); toastUntil = performance.now() + 3200; }
  function setVisible(playing) {
    for (const id of ['hud', 'carry', 'mission', 'lantern-track', 'pause']) $(id).hidden = !playing;
    $('intro').hidden = playing; document.body.classList.toggle('playing', playing);
  }
  function start(scenario = {}) {
    game = new Game({ config, seed: 12, scenario }); keys.clear(); qaFrames = null; qaFrameIndex = 0;
    mode = 'playing'; accumulator = 0; hasPicked = false; yaw = 0;
    $('modal').hidden = true; $('interaction').hidden = true;
    setVisible(true); canvas.focus();
    toast('Gom đom đóm vàng. Mỗi đèn cần 10 đốm sáng.');
  }
  function pause() {
    if (mode !== 'playing') return;
    mode = 'paused'; keys.clear(); accumulator = 0;
    $('modal-kicker').textContent = 'MỘT KHOẢNH KHẮC YÊN BÌNH';
    $('modal-title').textContent = 'Đêm tạm lắng';
    $('modal-body').textContent = 'Mây đang đợi bạn. Ánh sáng và thời gian sẽ ở nguyên đây.';
    $('resume').hidden = false; $('modal').hidden = false; $('resume').focus();
  }
  $('start').onclick = () => start();
  $('pause').onclick = pause;
  $('resume').onclick = () => { $('modal').hidden = true; mode = 'playing'; keys.clear(); accumulator = 0; };
  $('restart').onclick = () => start();
  $('sound').onclick = () => {
    soundEnabled = !soundEnabled; $('sound').textContent = soundEnabled ? 'Âm thanh: bật' : 'Âm thanh: tắt';
    $('sound').setAttribute('aria-pressed', String(soundEnabled)); if (soundEnabled) chime(600);
  };
  const controlKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyE', 'KeyF'];
  window.addEventListener('keydown', (event) => {
    if (event.code === 'Tab' && !$('modal').hidden) {
      const buttons = [...$('modal').querySelectorAll('button')].filter((b) => !b.hidden);
      if (!buttons.length) return;
      const first = buttons[0], last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    if (event.code === 'Escape') { if (mode === 'playing') pause(); else if (mode === 'paused') $('resume').click(); return; }
    if (event.code === 'KeyR' && mode === 'ended') { start(); return; }
    if (mode !== 'playing' || event.target instanceof HTMLButtonElement) return;
    if (controlKeys.includes(event.code)) { event.preventDefault(); keys.add(event.code); }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => { keys.clear(); pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });
  let drag;
  canvas.addEventListener('pointerdown', (event) => { drag = { x: event.clientX, id: event.pointerId }; canvas.setPointerCapture(event.pointerId); });
  canvas.addEventListener('pointermove', (event) => { if (drag?.id === event.pointerId) { yaw -= (event.clientX - drag.x) * 0.006; drag.x = event.clientX; } });
  const releaseDrag = () => { drag = undefined; };
  canvas.addEventListener('pointerup', releaseDrag); canvas.addEventListener('pointercancel', releaseDrag);
  for (const button of document.querySelectorAll('[data-key]')) {
    button.addEventListener('pointerdown', (event) => { event.preventDefault(); keys.add(button.dataset.key); button.setPointerCapture(event.pointerId); });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) button.addEventListener(name, () => keys.delete(button.dataset.key));
  }

  function onEvents(events) {
    for (const event of events) {
      if (event.name === 'mote_picked') { if (!hasPicked) { toast('Đã nhặt đom đóm! Tìm đèn lồng và nhấn E để nạp.'); hasPicked = true; } if (event.data.carried % 3 === 0) chime(720); }
      if (event.name === 'lantern_lit') { toast(`Đèn ${event.data.lantern_id} đã sáng. Bóng Mực sẽ tránh vùng sáng này.`); chime(420); }
      if (event.name === 'deposit') chime(520);
      if (event.name === 'pulse') { pulseAge = 0; pulseCenter = [...game.player.pos]; chime(280); }
      if (event.name === 'player_hit') toast('Bóng Mực chạm vào Mây! Tỏa sáng hoặc tìm nơi có đèn.');
      if (event.name === 'game_over') {
        mode = 'ended'; keys.clear();
        $('modal-kicker').textContent = event.data.result === 'won' ? 'NĂM NGỌN ĐÈN, MỘT HÒN ĐẢO THỨC GIẤC' : 'ÁNH SÁNG SẼ LẠI TRỞ VỀ';
        $('modal-title').textContent = event.data.result === 'won' ? 'Đảo đã bừng sáng' : 'Hẹn Mây đêm sau';
        const reason = { all_lit: 'Bạn đã đem ánh sáng về cho Đảo Bến.', dawn: 'Bình minh đã đến trước khi cả năm đèn được thắp.', no_flames: 'Mây đã hết sức sống. Hãy dùng vùng sáng để tránh Bóng Mực.' }[event.data.reason];
        $('modal-body').textContent = `${reason} Điểm của bạn: ${game.score}.`;
        $('resume').hidden = true; $('modal').hidden = false; $('restart').focus();
      }
    }
  }
  const targetCamera = new THREE.Vector3(), lookAt = new THREE.Vector3();
  function draw(dt, time) {
    const pos = game.player.pos;
    hero.position.set(...pos);
    const moving = Math.hypot(...game.input.move) > 0 && mode === 'playing';
    walk += moving ? dt * 13 : 0;
    legA.rotation.x = armB.rotation.x = moving ? Math.sin(walk) * 0.45 : 0;
    legB.rotation.x = armA.rotation.x = moving ? -Math.sin(walk) * 0.45 : 0;
    if (moving) {
      const [x, z] = game.input.move;
      hero.rotation.y = Math.atan2(-(x * Math.cos(yaw) + z * Math.sin(yaw)), -(-x * Math.sin(yaw) + z * Math.cos(yaw)));
    }
    hero.visible = !(game.tick < game.invulnUntil && Math.floor(time * 9) % 2 === 0 && mode === 'playing');
    shadow.position.set(pos[0], 0.014, pos[2]); shadow.scale.setScalar(1 - Math.min(0.5, Math.max(0, pos[1]) / 8));
    let lit = 0;
    for (const l of game.lanterns) {
      if (!lanternViews.has(l.id)) lanternViews.set(l.id, createLantern());
      const v = lanternViews.get(l.id); v.group.position.set(...l.pos);
      v.lampMat.color.set(l.lit ? '#ffd18a' : '#8b796b');
      v.lampMat.emissiveIntensity = l.lit ? 2 : 0.06 + l.deposited / 20;
      v.light.intensity = l.lit ? 80 : 0;
      v.halo.visible = l.lit; v.marker.visible = !l.lit;
      v.marker.position.y = 5 + Math.sin(time * 1.6 + l.pos[0]) * 0.15;
      if (l.lit) lit++;
    }
    for (const [id, view] of shadeViews) if (!game.shades.some((s) => s.id === id)) { scene.remove(view.group); shadeViews.delete(id); }
    for (const s of game.shades) {
      if (!shadeViews.has(s.id)) shadeViews.set(s.id, createShade());
      const v = shadeViews.get(s.id);
      v.group.position.set(s.pos[0], s.pos[1] + Math.sin(time * 2.5 + s.pos[0]) * 0.09, s.pos[2]);
      v.group.rotation.y = Math.atan2(s.pos[0] - pos[0], s.pos[2] - pos[2]);
      v.ring.visible = s.state === 'stunned'; v.ring.rotation.z += dt;
    }
    const needed = game.motes.length * 3;
    let attr = moteGeometry.getAttribute('position');
    if (!attr || attr.array.length !== needed) { attr = new THREE.BufferAttribute(new Float32Array(needed), 3); moteGeometry.setAttribute('position', attr); }
    game.motes.forEach((m, i) => attr.setXYZ(i, m.pos[0] + Math.sin(time + i) * 0.1, m.pos[1] + 0.7 + Math.sin(time * 1.7 + i * 0.7) * 0.16, m.pos[2]));
    attr.needsUpdate = true; moteGeometry.computeBoundingSphere();
    pulseAge += dt;
    pulseRing.position.set(pulseCenter[0], pulseCenter[1] + 0.25, pulseCenter[2]);
    pulseRing.visible = pulseAge < 0.65; pulseRing.scale.setScalar(0.2 + pulseAge * config.tuning.pulse_radius / 0.65);
    pulseRing.material.opacity = Math.max(0, 0.9 - pulseAge / 0.65);
    ambient.intensity = 1.6 + lit * 0.17;
    clouds.rotation.y = Math.sin(time * 0.02) * 0.03;
    if (mode === 'menu') {
      camera.position.set(43 + Math.sin(time * 0.06) * 2, 31, 46); camera.lookAt(-6, 0, 0);
    } else {
      targetCamera.set(pos[0] + Math.sin(yaw) * 12, pos[1] + 8.5, pos[2] + Math.cos(yaw) * 12);
      camera.position.lerp(targetCamera, cameraSettled ? 1 - Math.exp(-dt * 7) : 1 - Math.exp(-dt * 3));
      lookAt.set(pos[0], pos[1] + 1, pos[2]); camera.lookAt(lookAt);
      cameraSettled ||= camera.position.distanceTo(targetCamera) < 0.1;
    }
    $('time').textContent = `${String(Math.floor(game.timeLeft / 60)).padStart(2, '0')}:${String(Math.floor(game.timeLeft % 60)).padStart(2, '0')}`;
    $('flames').textContent = '♥ '.repeat(game.player.flames) + '♡ '.repeat(config.tuning.flames - game.player.flames);
    $('flames').style.color = '#ffd598'; $('flames').setAttribute('aria-label', `${game.player.flames} sức sống`);
    $('score').textContent = game.score; $('lit').textContent = lit; $('carried').textContent = game.player.carried;
    $('carry-fill').style.width = `${game.player.carried / config.tuning.carry_capacity * 100}%`;
    const cooldown = Math.max(0, (game.pulseReadyAt - game.tick) / HZ);
    $('pulse-hint').textContent = cooldown > 0 ? `Tỏa sáng đang hồi · ${cooldown.toFixed(1)}s` : 'F · Tỏa sáng · cần 3 đom đóm';
    $('mission-text').textContent = lit === 0 ? 'Gom đom đóm và mang đến năm đèn lồng.' : `Đã có ${lit}/5 vùng sáng an toàn. Tiếp tục nào!`;
    [...track.children].forEach((node, i) => { node.classList.toggle('on', game.lanterns[i].lit); node.title = `${game.lanterns[i].id}: ${game.lanterns[i].deposited}/10`; });
    const near = game.lanterns.filter((l) => !l.lit && Math.hypot(l.pos[0] - pos[0], l.pos[2] - pos[2]) <= config.tuning.interact_radius)
      .sort((a, b) => Math.hypot(a.pos[0] - pos[0], a.pos[2] - pos[2]) - Math.hypot(b.pos[0] - pos[0], b.pos[2] - pos[2]))[0];
    $('interaction').hidden = !near || mode !== 'playing';
    if (near) $('interaction').textContent = `E · Nạp đèn ${near.id} · ${near.deposited}/10${game.player.carried === 0 ? ' · Cần thêm đom đóm' : ''}`;
    if (performance.now() > toastUntil) $('toast').classList.remove('show');
    renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
    if (mode === 'playing') {
      accumulator += dt;
      while (accumulator >= 1 / HZ && mode === 'playing') {
        const down = (...codes) => codes.some((key) => keys.has(key));
        const controls = { move: [Number(down('KeyD', 'ArrowRight')) - Number(down('KeyA', 'ArrowLeft')), Number(down('KeyS', 'ArrowDown')) - Number(down('KeyW', 'ArrowUp'))], cam_yaw_deg: yaw * 180 / Math.PI, jump: down('Space'), interact: down('KeyE'), pulse: down('KeyF') };
        const patch = qaFrames ? (qaFrames[qaFrameIndex]?.tick === game.tick ? qaFrames[qaFrameIndex++] : {}) : controls;
        onEvents(game.step(patch));
        accumulator -= 1 / HZ;
      }
    }
    draw(dt, now / 1000); requestAnimationFrame(frame);
  }
  window.addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
  if (new URLSearchParams(location.search).get('qa') === '1') {
    window.__lab = { snapshot: () => game.snapshot(), start, replay: (inputs) => { start(); qaFrames = inputs.frames; qaFrameIndex = 0; }, mode: () => mode, config, renderInfo: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }) };
  }
  requestAnimationFrame(frame);
}
