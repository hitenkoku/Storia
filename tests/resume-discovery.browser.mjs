// Run with a local Vite server and Playwright installed (see docs/resume-discovery.md).
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1400 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const url = process.env.STORIA_TEST_URL ?? 'http://127.0.0.1:1422';
const base = (id, patch = {}) => ({ id, title: id, type: 'idea', growthStatus: 'seed', tags: ['idea', 'rain'], body: `Body ${id}`, links: [], revisionIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', ...patch });
const initial = { items: [base('A', { links: [{ id: 'B', kind: '関連' }, { id: 'C', kind: '伏線', payoffStatus: 'resolved', intentNote: 'Reveal the letter sender' }], revisionIds: ['r'] }), base('B'), base('C')], revisions: [{ id: 'r', itemId: 'A', title: 'A', body: 'Historic body', tags: ['rain'], note: 'History', createdAt: '2026-01-01' }] };
async function load(state, locale = 'en') {
  await page.addInitScript(({ state, locale }) => {
    if (sessionStorage.getItem('fixture-loaded')) return;
    localStorage.setItem('storia.workspace.v1', JSON.stringify(state));
    localStorage.setItem('storia.locale.v1', locale);
    sessionStorage.setItem('fixture-loaded', 'yes');
  }, { state, locale });
  await page.goto(url);
}
async function stored() { return page.evaluate(() => JSON.parse(localStorage.getItem('storia.workspace.v1'))); }
async function checkEditorLayout() {
  const support = await page.locator('.editor-support').boundingBox();
  const body = await page.locator('.markdown-field').boundingBox();
  assert.ok(body.y - (support.y + support.height) < 20, 'No empty flexible row above the body');
  assert.ok(body.height > 650, 'Body receives the available editor height');
}
try {
  await load(initial);
  assert.equal(await page.locator('#title').inputValue(), 'A');
  await checkEditorLayout();
  const picks = await page.locator('.discovery-panel').innerText();
  const summary = page.locator('.resume-note summary');
  await summary.focus();
  await page.keyboard.press('Enter');
  await page.getByLabel('Next writing step', { exact: true }).fill('Write the reply');
  await page.locator('.markdown-field textarea').fill('Changed body');
  assert.equal(await page.locator('.discovery-panel').innerText(), picks);
  await page.locator('.discovery-card').filter({ has: page.locator('strong', { hasText: /^B$/ }) }).press('Enter');
  assert.equal(await page.locator('#title').inputValue(), 'B');
  await page.locator('.item-list .item-card').filter({ has: page.locator('strong', { hasText: /^A$/ }) }).click();
  await page.locator('.resume-note summary').press('Space');
  assert.equal(await page.getByLabel('Next writing step', { exact: true }).inputValue(), 'Write the reply');
  await page.getByRole('button', { name: 'Focus mode', exact: true }).click();
  assert.ok(await page.locator('.resume-note textarea').isVisible());
  await checkEditorLayout();
  await page.getByLabel('Next writing step', { exact: true }).fill('Long note '.repeat(400));
  assert.ok((await page.locator('.resume-note textarea').boundingBox()).height <= 140);
  await page.keyboard.press('Escape');
  await page.reload(); // No debounce wait: pagehide must flush the latest edit.
  assert.equal(await page.locator('#title').inputValue(), 'A');
  await page.locator('.resume-note summary').click();
  assert.equal(await page.getByLabel('Next writing step', { exact: true }).inputValue(), 'Long note '.repeat(400));
  const saved = await stored();
  assert.equal(saved.items[0].body, 'Changed body');
  assert.deepEqual(saved.items[0].links, initial.items[0].links.map(link => ({ payoffStatus: 'unset', intentNote: '', ...link })));
  assert.deepEqual(saved.items[0].links.map(({ id, kind }) => ({ id, kind })), initial.items[0].links.map(({ id, kind }) => ({ id, kind })));
  assert.equal(saved.items[0].links[1].payoffStatus, 'resolved');
  assert.equal(saved.items[0].links[1].intentNote, 'Reveal the letter sender');
  assert.deepEqual(saved.items[0].tags, initial.items[0].tags);
  assert.deepEqual(saved.items[0].revisionIds, ['r']);
  assert.deepEqual(saved.revisions, initial.revisions);
  await page.locator('.item-list .item-card').filter({ has: page.locator('strong', { hasText: /^B$/ }) }).click();
  await page.reload();
  assert.equal(await page.locator('#title').inputValue(), 'B');
  await page.getByLabel('Language').selectOption('ja');
  assert.equal(await page.locator('#discovery-title').innerText(), '今日の素材');
  assert.equal(await page.locator('.resume-note summary').innerText(), '次に書くこと');

  await page.evaluate(() => {
    window.originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function () { throw new Error('Quota exceeded'); };
  });
  await page.locator('.resume-note summary').click();
  await page.getByLabel('次に書くこと', { exact: true }).fill('保存失敗テスト');
  await page.getByRole('alert').waitFor();
  await checkEditorLayout();
  await page.evaluate(() => { Storage.prototype.setItem = window.originalSetItem; });
  await page.getByRole('button', { name: '保存を再試行' }).click();
  assert.equal((await stored()).items.find((item) => item.id === 'B').resumeNote, '保存失敗テスト');

  // Use a fresh context page for independent legacy/empty fixtures.
  for (const state of [{ ...initial, selectedId: 'missing' }, { items: [], revisions: [], selectedId: 'missing' }, { items: [base('bad', { updatedAt: 'invalid' })], revisions: [] }]) {
    const isolated = await browser.newContext();
    await isolated.addInitScript((state) => localStorage.setItem('storia.workspace.v1', JSON.stringify(state)), state);
    const fresh = await isolated.newPage();
    fresh.on('pageerror', (error) => errors.push(error.message));
    await fresh.goto(url);
    await fresh.locator('#discovery-title').waitFor();
    if (state.items.length) assert.equal(await fresh.locator('#title').inputValue(), state.items[0].title);
    else {
      assert.equal(await fresh.locator('#title').count(), 0);
      await fresh.locator('.discovery-panel button').last().press('Enter');
      await fresh.locator('#title').waitFor();
    }
    await isolated.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: legacy/empty/invalid data, note isolation, reload and last selection, stable picks, ja/en, keyboard, focus mode, storage failure/retry');
} catch (error) {
  console.error(await page.locator('.editor-pane').innerText());
  console.error(await page.locator('.resume-note').evaluate((el) => el.outerHTML));
  throw error;
} finally { await browser.close(); }
