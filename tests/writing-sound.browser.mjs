// Run with a local Vite server and Playwright installed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await context.addInitScript(() => {
  window.__audioStarts = 0;
  window.__audioStops = 0;
  class FakeNode {
    connect(target) { return target; }
  }
  class FakeSource extends FakeNode {
    addEventListener(_name, callback) { this.ended = callback; }
    start() { window.__audioStarts += 1; }
    stop() { window.__audioStops += 1; this.ended?.(); }
  }
  window.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.sampleRate = 48000; this.destination = new FakeNode(); }
    createGain() { const node = new FakeNode(); node.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return node; }
    createBiquadFilter() { const node = new FakeNode(); node.type = ''; node.frequency = { value: 0 }; node.Q = { value: 0 }; return node; }
    createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    createBufferSource() { return new FakeSource(); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const url = process.env.STORIA_TEST_URL ?? 'http://127.0.0.1:1422';

try {
  await page.goto(url);
  const panel = page.locator('.writing-sound-settings');
  await panel.locator('summary').focus();
  await page.keyboard.press('Enter');
  const mode = panel.getByLabel('音の種類');
  const volume = panel.getByLabel(/音量/);
  const preview = panel.getByRole('button', { name: '試聴' });
  assert.equal(await mode.inputValue(), 'off');
  assert.equal(await preview.isDisabled(), true);

  const body = page.locator('.markdown-field textarea');
  await body.pressSequentially('a');
  assert.equal(await page.evaluate(() => window.__audioStarts), 0, 'off is silent');

  await mode.selectOption('pen');
  await volume.focus();
  await page.keyboard.press('ArrowRight');
  await preview.click();
  assert.equal(await page.evaluate(() => window.__audioStarts), 1, 'preview uses selected sound');

  await page.locator('#title').pressSequentially('x');
  assert.equal(await page.evaluate(() => window.__audioStarts), 1, 'title input is silent');
  await body.pressSequentially('b');
  assert.equal(await page.evaluate(() => window.__audioStarts), 2, 'body text plays');

  await body.evaluate((element) => {
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'か', isComposing: true }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: 'かき', isComposing: true }));
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '確定' }));
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: '確定', isComposing: false }));
  });
  assert.equal(await page.evaluate(() => window.__audioStarts), 3, 'IME commit signals are deduplicated');

  await page.waitForTimeout(40);
  await body.evaluate((element) => {
    for (let index = 0; index < 20; index += 1) {
      element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'z', isComposing: false }));
    }
  });
  assert.equal(await page.evaluate(() => window.__audioStarts), 4, 'rapid input is dropped instead of queued');

  await mode.selectOption('typewriter');
  const savedVolume = await volume.inputValue();
  await page.reload();
  await page.locator('.writing-sound-settings summary').click();
  assert.equal(await page.getByLabel('音の種類').inputValue(), 'typewriter');
  assert.equal(await page.getByLabel(/音量/).inputValue(), savedVolume);

  await page.getByRole('button', { name: '集中モード', exact: true }).click();
  await page.waitForTimeout(40);
  const beforeFocusInput = await page.evaluate(() => window.__audioStarts);
  await page.locator('.markdown-field textarea').pressSequentially('c');
  assert.equal(await page.evaluate(() => window.__audioStarts), beforeFocusInput + 1, 'focus mode shares writing sound settings');
  await page.keyboard.press('Escape');

  await page.getByLabel('音の種類').selectOption('off');
  assert.ok(await page.evaluate(() => window.__audioStops) > 0, 'off stops active sources immediately');
  await page.getByLabel('言語').selectOption('en');
  assert.equal(await page.locator('.writing-sound-settings summary').innerText(), 'Writing sound');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await page.locator('.writing-sound-settings').boundingBox()).width <= 354);
  assert.deepEqual(errors, []);
  console.log('PASS: off default, preview, body-only input, IME commit, rapid input gate, persistence, focus mode, immediate off, ja/en, keyboard, narrow layout');
} finally {
  await browser.close();
}
