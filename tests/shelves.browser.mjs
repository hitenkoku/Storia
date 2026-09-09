// Optional isolated Edge integration test. See docs/shelves.md.
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';

const url = process.env.STORIA_TEST_URL ?? 'http://127.0.0.1:1433';
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
const base = (id, patch = {}) => ({ id, title: id, type: 'idea', growthStatus: 'seed', tags: ['idea', id + '-tag'], body: `本文 ${id}`, links: [], revisionIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01', ...patch });
const revision = { id: 'r', itemId: 'A', title: '初稿', body: '過去の本文', tags: ['idea'], note: '節目', createdAt: '2026-01-01' };
const initial = { shelves: [{ id: 'sa', name: '雨の物語' }, { id: 'sb', name: 'Story B' }], selectedShelfId: 'sa', selectedId: 'A', items: [
  base('A', { shelfId: 'sa', resumeNote: '次は手紙', revisionIds: ['r'], links: [{ id: 'B', kind: '伏線', payoffStatus: 'resolved', intentNote: '最後で回収' }] }),
  base('A2', { shelfId: 'sa' }), base('B', { shelfId: 'sb', links: [{ id: 'A', kind: '元ネタ' }] }), base('U'),
], revisions: [revision] };

async function fixture(state, locale = 'en') {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await context.addInitScript(({ state, locale }) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem('storia.workspace.v1', JSON.stringify(state));
    localStorage.setItem('storia.locale.v1', locale);
    sessionStorage.setItem('seeded', 'yes');
  }, { state, locale });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(url);
  await page.locator('#discovery-title').waitFor();
  return { page, context };
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('storia.workspace.v1')));
const titles = (page) => page.locator('.item-list .item-card strong').allTextContents();
const selectShelf = (page, id) => page.locator('.shelf-select select').selectOption(id);
const openSource = (page) => page.locator('.link-row').filter({ has: page.locator('input[type="checkbox"][id$="-A"]') }).getByRole('button', { name: 'Open: A · 雨の物語', exact: true }).click();

try {
  const { page, context } = await fixture(initial);
  assert.deepEqual(await titles(page), ['A', 'A2']);
  assert.ok(!(await page.locator('.tag-strip').innerText()).includes('B-tag'));
  assert.deepEqual(await page.locator('.discovery-card strong').allTextContents(), ['A2']);
  const picks = await page.locator('.discovery-panel').innerText();
  await page.locator('.markdown-field textarea').fill('編集中の本文 English');
  assert.equal(await page.locator('.discovery-panel').innerText(), picks);
  await page.locator('.search-box input').fill('B');
  assert.deepEqual(await titles(page), []);
  await page.locator('.search-box input').fill('');
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  assert.equal(await page.locator('.graph-scroll svg g[role="button"]').count(), 2);
  assert.equal(await page.locator('.graph-scroll svg circle.revision').count(), 1);
  assert.equal(await page.locator('.boundary-links button').count(), 2);
  assert.ok(!(await page.locator('.island-list').innerText()).split('\n').some((line) => line === 'Idea · A'));
  await page.locator('.boundary-links button').first().press('Enter');
  assert.equal(await page.locator('#title').inputValue(), 'B');
  assert.equal(await page.locator('.shelf-select select').inputValue(), 'sb');
  assert.equal(await page.locator('.item-shelf select').inputValue(), 'sb');
  await page.getByRole('button', { name: /Back to previous shelf/ }).click();
  assert.equal(await page.locator('#title').inputValue(), 'A');
  assert.equal(await page.locator('.markdown-field textarea').inputValue(), '編集中の本文 English');
  await page.getByRole('button', { name: 'Open: B · Story B', exact: true }).click();
  assert.equal(await page.locator('#title').inputValue(), 'B');
  await page.getByRole('button', { name: /Back to previous shelf/ }).click();

  // Named shelf inheritance remains the source's shelf even from All.
  await selectShelf(page, '__all__');
  await page.getByRole('button', { name: 'Sprout into article' }).click();
  await page.reload();
  let saved = await stored(page);
  const sprout = saved.items.find((item) => item.id === saved.selectedId);
  assert.equal(sprout.shelfId, 'sa');
  assert.equal(sprout.links.find((link) => link.id === 'B').payoffStatus, 'unset');
  assert.equal(sprout.links.find((link) => link.id === 'B').intentNote, '最後で回収');
  await openSource(page);
  await page.getByRole('button', { name: /Branch from this revision/ }).click();
  await page.reload();
  saved = await stored(page);
  const branch = saved.items.find((item) => item.id === saved.selectedId);
  assert.equal(branch.shelfId, 'sa');
  assert.equal(branch.body, revision.body);
  assert.equal(branch.links.length, 1);
  assert.deepEqual(saved.revisions, [revision]);

  // Empty shelf, Japanese names, keyboard creation and all creation paths.
  await page.locator('.shelf-panel summary').press('Enter');
  await page.getByLabel('New shelf name', { exact: true }).fill('新しい物語');
  await page.getByLabel('New shelf name', { exact: true }).press('Enter');
  const newShelf = await page.locator('.shelf-select select').inputValue();
  assert.equal(await page.locator('#title').count(), 0);
  assert.equal(await page.locator('.discovery-card').count(), 0);
  await page.reload();
  assert.equal(await page.locator('.shelf-select select').inputValue(), newShelf);
  assert.equal(await page.locator('#title').count(), 0);
  await page.locator('.toolbar').getByRole('button', { name: 'Add idea' }).click();
  assert.equal(await page.locator('.item-shelf select').inputValue(), newShelf);
  await page.getByLabel('Quick capture fragment').fill('新しい断片');
  await page.getByLabel('Quick capture fragment').press('Enter');
  assert.equal(await page.locator('.item-shelf select').inputValue(), newShelf);
  await page.locator('.template-create button').click();
  assert.equal(await page.locator('.item-shelf select').inputValue(), newShelf);
  await page.locator('.toolbar').getByRole('button', { name: 'Add article' }).click();
  assert.equal(await page.locator('.item-shelf select').inputValue(), newShelf);
  await page.reload();
  saved = await stored(page);
  assert.equal(saved.items.filter((item) => item.shelfId === newShelf).length, 4);

  // Move a live draft, retain its identity, and follow its new shelf.
  await selectShelf(page, 'sa');
  await openSource(page);
  await page.locator('.item-shelf select').selectOption('sb');
  assert.equal(await page.locator('#title').inputValue(), 'A');
  assert.equal(await page.locator('.shelf-select select').inputValue(), 'sb');
  await page.reload();
  saved = await stored(page);
  const moved = saved.items.find((item) => item.id === 'A');
  assert.equal(moved.shelfId, 'sb');
  assert.equal(moved.body, '編集中の本文 English');
  assert.equal(moved.resumeNote, '次は手紙');
  assert.deepEqual(moved.revisionIds, ['r']);
  assert.deepEqual(moved.links.find((link) => link.id === 'B'), initial.items[0].links[0]);

  // Rename / delete never changes content or history. Cancel is available.
  await page.locator('.shelf-panel summary').click();
  const longName = '長い棚の名前物語 '.repeat(30);
  await page.getByLabel('Shelf name', { exact: true }).fill(longName);
  await page.getByRole('button', { name: 'Rename shelf', exact: true }).click();
  await page.reload();
  assert.equal((await stored(page)).shelves.find((shelf) => shelf.id === 'sb').name, longName.trim());
  await page.getByLabel('Language').selectOption('ja');
  assert.equal(await page.getByLabel('作品の棚', { exact: true }).count(), 1);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow at 390px with long shelf names');
  await page.screenshot({ path: join(tmpdir(), 'storia-shelves-mobile.png'), fullPage: true });
  await page.getByLabel('言語').selectOption('en');
  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.locator('.shelf-panel summary').click();
  await page.getByRole('button', { name: 'Delete shelf', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Delete shelf', exact: true }).click();
  const beforeDelete = await stored(page);
  await page.getByRole('button', { name: 'Delete shelf and keep materials' }).click();
  await page.reload();
  saved = await stored(page);
  assert.equal(saved.selectedShelfId, '__unfiled__');
  assert.equal(saved.shelves.some((shelf) => shelf.id === 'sb'), false);
  assert.deepEqual(saved.items, beforeDelete.items.map(({ shelfId, ...item }) => shelfId === 'sb' ? item : { ...item, ...(shelfId ? { shelfId } : {}) }));
  assert.deepEqual(saved.revisions, beforeDelete.revisions);
  await selectShelf(page, '__all__');
  await page.locator('.toolbar').getByRole('button', { name: 'Add idea' }).click();
  await page.reload();
  saved = await stored(page);
  assert.equal(saved.items.find((item) => item.id === saved.selectedId).shelfId, undefined);
  await page.getByRole('button', { name: 'Graph', exact: true }).click();
  await page.screenshot({ path: join(tmpdir(), 'storia-shelves-desktop.png'), fullPage: true });
  await context.close();

  for (const state of [
    { items: [base('legacy')], revisions: [] },
    { shelves: [{ id: 'valid', name: 'Valid' }], selectedShelfId: 'deleted', selectedId: 'missing', items: [base('orphan', { shelfId: 'missing' })], revisions: [] },
    { shelves: [], items: [], revisions: [] },
  ]) {
    const { page, context } = await fixture(state);
    assert.equal(await page.locator('.shelf-select select').inputValue(), '__all__');
    if (state.items.length) {
      assert.equal(await page.locator('.item-shelf select').inputValue(), '__unfiled__');
      await page.reload();
      assert.equal((await stored(page)).items[0].id, state.items[0].id);
    } else {
      assert.equal(await page.locator('#title').count(), 0);
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS: shelf filtering/search/tags/discovery, graph boundaries and return, live draft move, source inheritance, creation paths, rename/delete/reload preservation, legacy/invalid/empty data, ja/en, keyboard, 390px layout');
} finally {
  await browser.close();
}
