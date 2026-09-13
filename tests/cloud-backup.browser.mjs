// Run with a local Vite server and Playwright installed.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } });
await context.addInitScript(() => {
  const workspace = {
    selectedId: 'item-1',
    items: [{ id: 'item-1', type: 'article', growthStatus: 'draft', title: 'Cloud story', tags: ['article'], body: 'Body', links: [], revisionIds: [], createdAt: '2026-01-01', updatedAt: '2026-01-01' }],
    revisions: [],
  };
  localStorage.setItem('storia.workspace.v1', JSON.stringify(workspace));
  localStorage.setItem('storia.locale.v1', 'en');
  window.__cloudCalls = [];
  window.__failUpload = true;
  window.__connected = false;
  window.__TAURI_INTERNALS__ = {
    invoke: async (command, args = {}) => {
      window.__cloudCalls.push({ command, args });
      if (command === 'webdav_connection_status') return { connected: window.__connected };
      if (command === 'connect_webdav') {
        window.__connected = true;
        return { connected: true, endpoint: args.endpoint, username: args.username };
      }
      if (command === 'disconnect_webdav') {
        window.__connected = false;
        return { connected: false };
      }
      if (command === 'upload_webdav_backup') {
        if (window.__failUpload) throw { kind: 'offline', message: 'raw backend detail' };
        return { destination: `https://cloud.example.test/dav/Storia/${args.filename}` };
      }
      throw new Error(`Unexpected command: ${command}`);
    },
  };
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const url = process.env.STORIA_TEST_URL ?? 'http://127.0.0.1:1422';

try {
  await page.goto(url);
  const backup = page.locator('.cloud-backup');
  await backup.locator('summary').focus();
  await page.keyboard.press('Enter');
  await backup.getByLabel('WebDAV folder URL').fill('https://cloud.example.test/dav/Storia');
  await backup.getByLabel('Username').fill('writer');
  await backup.getByLabel('Password / app password').fill('app-secret');
  await backup.getByRole('button', { name: 'Connect', exact: true }).click();
  await assert.doesNotReject(() => backup.getByText('Connected', { exact: true }).waitFor());
  const connect = await page.evaluate(() => window.__cloudCalls.find((call) => call.command === 'connect_webdav'));
  assert.equal(connect.args.password, 'app-secret');
  assert.ok(!(await page.evaluate(() => JSON.stringify(localStorage))).includes('app-secret'));
  const before = await page.evaluate(() => localStorage.getItem('storia.workspace.v1'));

  await backup.getByRole('button', { name: 'Back up to cloud' }).click();
  await backup.getByText('Confirm upload', { exact: true }).waitFor();
  assert.match(await backup.innerText(), /Cloud story|1 items/);
  assert.match(await backup.innerText(), /storia-backup-\d{8}T\d{9}Z\.json/);

  await backup.getByRole('button', { name: 'Upload this backup' }).click();
  await backup.getByRole('alert').waitFor();
  assert.match(await backup.getByRole('alert').innerText(), /could not be reached/i);
  assert.equal(await page.evaluate(() => localStorage.getItem('storia.workspace.v1')), before);

  await backup.locator('.cloud-confirm').getByRole('button', { name: 'Cancel' }).click();
  assert.equal(await backup.getByRole('alert').count(), 0, 'cancel clears the failed pending upload and its error');
  await backup.getByRole('button', { name: 'Back up to cloud' }).click();
  await backup.getByText('Confirm upload', { exact: true }).waitFor();
  await backup.getByRole('button', { name: 'Upload this backup' }).click();
  await backup.getByRole('alert').waitFor();

  await page.evaluate(() => { window.__failUpload = false; });
  await backup.getByRole('button', { name: 'Retry' }).click();
  await backup.getByRole('status').waitFor();
  assert.match(await backup.getByRole('status').innerText(), /Backup completed/);

  const upload = await page.evaluate(() => window.__cloudCalls.findLast((call) => call.command === 'upload_webdav_backup'));
  const artifact = JSON.parse(upload.args.content);
  assert.equal(artifact.format, 'storia.workspace-backup');
  assert.equal(artifact.version, 1);
  assert.equal(artifact.workspace.items[0].title, 'Cloud story');
  assert.equal(artifact.settings.locale, 'en');
  assert.deepEqual(artifact.settings.writingSound, { mode: 'off', volume: 0.35 });
  assert.match(artifact.checksum, /^[a-f0-9]{64}$/);

  await backup.getByRole('button', { name: 'Back up to cloud' }).click();
  await page.evaluate(() => { window.__failUpload = true; });
  await backup.getByRole('button', { name: 'Upload this backup' }).click();
  await backup.getByRole('button', { name: 'Reauthenticate' }).click();
  await backup.getByLabel('Password / app password').fill('fresh-secret');
  await backup.getByRole('button', { name: 'Connect', exact: true }).click();
  assert.ok(await backup.getByText('Confirm upload', { exact: true }).isVisible(), 'prepared snapshot survives reauthentication');
  await page.evaluate(() => { window.__failUpload = false; });
  await backup.getByRole('button', { name: 'Upload this backup' }).click();
  await backup.getByRole('status').waitFor();

  await backup.getByRole('button', { name: 'Reauthenticate' }).click();
  await backup.getByLabel('Password / app password').fill('discard-me');
  await backup.getByRole('button', { name: 'Cancel' }).click();
  await backup.getByRole('button', { name: 'Reauthenticate' }).click();
  assert.equal(await backup.getByLabel('Password / app password').inputValue(), '', 'cancel clears the typed password');
  await backup.getByRole('button', { name: 'Cancel' }).click();
  await backup.getByRole('button', { name: 'Disconnect' }).click();
  await backup.getByRole('button', { name: 'Connect', exact: true }).waitFor();

  await page.getByLabel('Language').selectOption('ja');
  assert.equal(await backup.locator('summary').innerText(), 'クラウドバックアップ');
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok((await backup.boundingBox()).width <= 354);
  assert.deepEqual(errors, []);
  console.log('PASS: explicit confirmation, complete artifact, localized errors, retry, no local mutation, ja/en, keyboard, narrow layout');
} finally {
  await browser.close();
}
