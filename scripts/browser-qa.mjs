import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const proof = resolve(root, 'docs/proof/phase-1'); mkdirSync(proof, { recursive: true });
const candidates = [process.env.QA_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromium.executablePath()].filter(Boolean);
const executablePath = candidates.find(existsSync);
if (!executablePath) { console.error('No browser found. Set QA_BROWSER to a Chromium/Chrome executable.'); process.exit(1); }
const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '4271'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
let serverLog = ''; server.stdout.on('data', (d) => { serverLog += d; }); server.stderr.on('data', (d) => { serverLog += d; });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { ready = (await fetch('http://127.0.0.1:4271/')).ok; } catch { /* server starting */ }
    if (ready) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(ready, serverLog);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const errors = [], failedRequests = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('requestfailed', (r) => failedRequests.push(r.url()));
  await page.goto('http://127.0.0.1:4271/?qa=1');
  await page.waitForFunction(() => !!window.__lab, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: resolve(proof, 'desktop-intro.png') });
  await page.locator('#start').click();
  const before = await page.evaluate(() => window.__lab.snapshot());
  await page.keyboard.down('KeyD');
  await page.waitForFunction((tick) => window.__lab.snapshot().tick >= tick + 60, before.tick, { timeout: 15000 });
  await page.keyboard.up('KeyD');
  const moved = await page.evaluate(() => window.__lab.snapshot());
  assert.ok(moved.player.pos[0] - before.player.pos[0] >= 5.9);
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.__lab.snapshot().player.pos[1] > 0.2);
  await page.keyboard.up('Space');
  await page.screenshot({ path: resolve(proof, 'desktop-playing.png') });
  await page.keyboard.press('Escape'); const paused = await page.evaluate(() => window.__lab.snapshot().tick);
  await page.waitForTimeout(250); assert.equal(await page.evaluate(() => window.__lab.snapshot().tick), paused);
  await page.locator('#resume').click(); await page.waitForFunction((tick) => window.__lab.snapshot().tick > tick, paused);
  const quiet = { random_motes: false, random_shades: false };
  await page.evaluate((q) => window.__lab.start({ ...q, player: { carried: 6 }, shades: [{ id: 'S-test', pos: [3, 0, 0] }] }), quiet);
  await page.keyboard.down('KeyF');
  await page.waitForFunction(() => window.__lab.snapshot().shades[0].state === 'stunned');
  await page.keyboard.up('KeyF');
  assert.equal(await page.evaluate(() => window.__lab.snapshot().player.carried), 3);
  await page.screenshot({ path: resolve(proof, 'desktop-pulse.png') });
  await page.evaluate((q) => window.__lab.start({ ...q, player: { carried: 1 }, lanterns: [{ id: 'L1', pos: [0, 0, 0], deposited: 9 }, ...[2,3,4,5].map((i) => ({ id: `L${i}`, lit: true }))] }), quiet);
  await page.keyboard.down('KeyE');
  await page.waitForFunction(() => window.__lab.snapshot().state === 'won');
  await page.keyboard.up('KeyE');
  assert.equal(await page.locator('#modal-title').textContent(), 'Đảo đã bừng sáng');
  await page.screenshot({ path: resolve(proof, 'desktop-won.png') });
  await page.locator('#restart').click(); assert.equal(await page.evaluate(() => window.__lab.snapshot().state), 'playing');
  await page.evaluate((q) => window.__lab.start({ ...q, player: { flames: 1 }, shades: [{ pos: [0,0,0] }] }), quiet);
  await page.waitForFunction(() => window.__lab.snapshot().state === 'lost');
  assert.equal(await page.locator('#modal-title').textContent(), 'Hẹn Mây đêm sau');
  await page.screenshot({ path: resolve(proof, 'desktop-lost.png') });
  const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const touchPage = await touchContext.newPage();
  touchPage.on('pageerror', (e) => errors.push(e.message));
  await touchPage.goto('http://127.0.0.1:4271/?qa=1'); await touchPage.waitForFunction(() => !!window.__lab);
  assert.equal(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await touchPage.screenshot({ path: resolve(proof, 'mobile-intro.png') });
  await touchPage.locator('#start').click();
  const touchBefore = await touchPage.evaluate(() => window.__lab.snapshot());
  await touchPage.evaluate(() => {
    window.__touchEvents = [];
    for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, (e) => window.__touchEvents.push({ type, target: e.target.dataset?.key, x: e.clientX, y: e.clientY }), true);
  });
  const right = await touchPage.locator('[data-key="KeyD"]').boundingBox();
  const cdp = await touchContext.newCDPSession(touchPage);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: right.x + right.width / 2, y: right.y + right.height / 2 }] });
  await touchPage.waitForFunction((x) => window.__lab.snapshot().player.pos[0] > x + 2.1, touchBefore.player.pos[0], { timeout: 10000 });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const touchAfter = await touchPage.evaluate(() => window.__lab.snapshot());
  const touchEvents = await touchPage.evaluate(() => window.__touchEvents);
  await touchPage.screenshot({ path: resolve(root, '.cache/mobile-debug.png') });
  assert.ok(touchAfter.player.pos[0] > touchBefore.player.pos[0] + 1.9, JSON.stringify({ before: touchBefore.player.pos, after: touchAfter.player.pos, right, touchEvents }));
  assert.equal(await touchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await touchPage.screenshot({ path: resolve(proof, 'mobile-playing.png') });
  assert.deepEqual(errors, []); assert.deepEqual(failedRequests, []);
  writeFileSync(resolve(proof, 'browser.json'), JSON.stringify({ generated_at: new Date().toISOString(), browser: await browser.version(), viewport: [1440,900], mobile_viewport: [390,844], checks: ['render', 'keyboard movement', 'jump', 'pause/resume', 'pulse/stun', 'deposit/win', 'loss', 'replay', 'mobile no horizontal overflow', 'real touch movement'], errors, failed_requests: failedRequests, server_log: serverLog, scenario_note: 'Win/loss/pulse are arranged through ?qa=1 using the same Game class; normal movement and jump use the default level.' }, null, 2) + '\n');
  console.log('Browser QA passed: movement, jump, pause, pulse, win, loss, replay, mobile layout; no browser errors.');
} catch (error) {
  console.error(error.stack); if (serverLog) console.error(serverLog); process.exitCode = 1;
} finally { if (browser) await browser.close(); server.kill(); }
