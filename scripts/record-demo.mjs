// Records real browser frames into MP4. QA overlays identify arranged/replayed actions.
import { chromium } from 'playwright-core';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../', import.meta.url));
const ffmpeg = process.argv[2] ?? process.env.FFMPEG_PATH;
if (!ffmpeg || !existsSync(ffmpeg)) throw new Error('Usage: node scripts/record-demo.mjs <absolute-path-to-ffmpeg>');
const executablePath = [process.env.QA_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', chromium.executablePath()].filter(Boolean).find(existsSync);
const outputDir = resolve(root, 'docs/demo'); mkdirSync(outputDir, { recursive: true });
const output = resolve(outputDir, 'demo.mp4');
const server = spawn(process.execPath, ['scripts/serve.mjs', '--port', '4272'], { cwd: root, stdio: 'ignore' });
let browser, encoder, recording = true, capturedFrames = 0, log = '';
const encoderExit = () => new Promise((resolveExit) => encoder.on('exit', (code) => resolveExit(code)));
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:4272/')).ok) break; } catch { /* starting */ }
    await new Promise((r) => setTimeout(r, 100));
  }
  browser = await chromium.launch({ executablePath, headless: true, args: ['--enable-unsafe-swiftshader', '--no-first-run'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
  await page.goto('http://127.0.0.1:4272/?qa=1'); await page.waitForFunction(() => !!window.__lab);
  encoder = spawn(ffmpeg, ['-y', '-loglevel', 'warning', '-f', 'image2pipe', '-vcodec', 'mjpeg', '-framerate', '15', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', output], { stdio: ['pipe', 'ignore', 'pipe'] });
  encoder.stderr.on('data', (d) => { log += d; });
  const finished = encoderExit();
  const capture = (async () => {
    while (recording) {
      const begin = performance.now();
      const jpg = await page.screenshot({ type: 'jpeg', quality: 82 });
      if (!encoder.stdin.write(jpg)) await once(encoder.stdin, 'drain');
      capturedFrames++;
      await new Promise((r) => setTimeout(r, Math.max(0, 1000 / 15 - (performance.now() - begin))));
    }
  })();
  const annotate = (text) => page.evaluate((text) => {
    let note = document.getElementById('recording-note');
    if (!note) { note = document.createElement('div'); note.id = 'recording-note'; Object.assign(note.style, { position: 'fixed', right: '20px', bottom: '65px', font: '14px Arial', background: '#071928e8', color: '#ffdb9f', border: '1px solid #ffd59866', borderRadius: '6px', padding: '12px 16px', zIndex: '100' }); document.body.append(note); }
    note.textContent = text;
  }, text);
  await annotate('PHASE 1 · Ghi hình trình duyệt thật · seed 12');
  await page.waitForTimeout(2000); await page.locator('#start').click();
  await annotate('Kiểm tra bàn phím: di chuyển và nhảy');
  await page.keyboard.down('KeyD'); await page.waitForTimeout(1500); await page.keyboard.up('KeyD');
  await page.keyboard.down('Space'); await page.waitForTimeout(450); await page.keyboard.up('Space'); await page.waitForTimeout(1200);
  const inputs = JSON.parse(readFileSync(resolve(root, 'tests/inputs/default-playthrough.json'), 'utf8'));
  await page.evaluate((inputs) => window.__lab.replay(inputs), inputs);
  await annotate('Replay bot trên màn mặc định · cùng logic headless · không sửa trạng thái');
  await page.waitForFunction(() => window.__lab.snapshot().state !== 'playing', undefined, { timeout: 120000 });
  const final = await page.evaluate(() => window.__lab.snapshot()); assert.equal(final.state, 'won');
  console.log(`Recorded normal-level win: tick ${final.tick}, score ${final.score}.`);
  await page.waitForTimeout(3000);
  const report = JSON.parse(readFileSync(resolve(root, 'docs/proof/phase-1/verification.json'), 'utf8'));
  await page.goto('about:blank');
  const escaped = JSON.stringify({ tests: report.tests, scenarios: report.scenarios.map((s) => ({ name: s.name, result: s.result, byte_identical_replay: s.byte_identical_replay })), default_random_replay_identical: report.default_random_replay_identical }, null, 2).replaceAll('&', '&amp;').replaceAll('<', '&lt;');
  await page.setContent(`<html lang="vi"><meta charset="utf-8"><body style="margin:0;background:#102230;color:#e1eee6;font:18px Arial;padding:36px 60px"><p style="color:#ffd598;letter-spacing:2px">PHASE 1 · BẰNG CHỨNG CHẠY THẬT</p><h1 style="font-size:36px">${report.tests.passed}/${report.tests.total} kiểm thử đạt · Replay giống từng byte</h1><p>Nguồn: docs/proof/phase-1/verification.json · Tạo lại bằng npm run verify</p><pre style="font:14px monospace;line-height:1.4;columns:2;column-gap:40px;white-space:pre-wrap">${escaped}</pre></body></html>`);
  await page.waitForTimeout(6500);
  recording = false; await capture; encoder.stdin.end();
  assert.equal(await finished, 0, log);
  const duration = capturedFrames / 15; assert.ok(duration < 300); assert.ok(statSync(output).size < 100 * 1024 * 1024);
  writeFileSync(resolve(outputDir, 'metadata.json'), JSON.stringify({ generated_at: new Date().toISOString(), captured_frames: capturedFrames, fps: 15, duration_s: duration, bytes: statSync(output).size, codec: 'H.264 / yuv420p / MP4', source: 'Real Chromium screenshots, keyboard test then normal-level bot input replay; no scenario overrides in the win replay.', final_state: { tick: final.tick, state: final.state, score: final.score }, verification_source: 'docs/proof/phase-1/verification.json', note: 'Capture cadence may shorten playback relative to wall-clock recording time; this is not a performance benchmark.' }, null, 2) + '\n');
  console.log(`Saved docs/demo/demo.mp4: ${duration.toFixed(1)} seconds, ${(statSync(output).size / 1024 / 1024).toFixed(2)} MiB.`);
} finally {
  recording = false;
  if (browser) await browser.close();
  if (encoder && encoder.exitCode === null) encoder.kill();
  server.kill();
}
