import assert from 'node:assert/strict';
import test from 'node:test';
import { BACKUP_FORMAT, BACKUP_VERSION, backupFilename, createBackup, parseBackup } from '../src/backup.ts';

const workspace = {
  selectedId: '作品-1',
  items: [{
    id: '作品-1', type: 'article', growthStatus: 'draft', title: '雨の物語', tags: ['日本語', 'rain'],
    body: '# 第一章\n\n雨だった。', resumeNote: '次は手紙を開く',
    links: [{ id: 'idea-1', kind: '伏線', payoffStatus: 'unresolved', intentNote: '最終章で回収' }],
    revisionIds: ['rev-1'], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-09-12T00:00:00.000Z',
  }],
  revisions: [{ id: 'rev-1', itemId: '作品-1', title: 'Rain', tags: ['draft'], body: 'old', note: '初稿', createdAt: '2026-01-01T00:00:00.000Z' }],
};

test('complete ja/en workspace round trips with version and integrity metadata', async () => {
  for (const locale of ['ja', 'en']) {
    const source = await createBackup(workspace, { locale }, new Date('2026-09-12T12:34:56.000Z'));
    const restored = await parseBackup(source);
    assert.equal(restored.format, BACKUP_FORMAT);
    assert.equal(restored.version, BACKUP_VERSION);
    assert.equal(restored.settings.locale, locale);
    assert.deepEqual(restored.workspace, workspace);
    assert.match(restored.checksum, /^[a-f0-9]{64}$/);
  }
});

test('tampering and malformed or future formats are rejected', async () => {
  const valid = JSON.parse(await createBackup(workspace, { locale: 'ja' }));
  valid.workspace.items[0].body = 'changed after checksum';
  await assert.rejects(parseBackup(JSON.stringify(valid)), /checksum_mismatch/);
  await assert.rejects(parseBackup('{'), /invalid_json/);
  await assert.rejects(parseBackup(JSON.stringify({ ...valid, version: 2 })), /unsupported_version/);
});

test('legacy workspace fields are preserved without mutation', async () => {
  const legacy = { items: [{ id: 'old', type: 'idea', title: 'legacy', tags: [], body: '', linkedIds: ['next'], revisionIds: [], createdAt: '', updatedAt: '' }], revisions: [] };
  const before = structuredClone(legacy);
  const restored = await parseBackup(await createBackup(legacy, { locale: 'en' }));
  assert.deepEqual(restored.workspace, before);
  assert.deepEqual(legacy, before);
});

test('filename is portable and sortable', () => {
  assert.equal(backupFilename(new Date('2026-09-12T12:34:56.789Z')), 'storia-backup-20260912T123456789Z.json');
  assert.notEqual(
    backupFilename(new Date('2026-09-12T12:34:56.001Z')),
    backupFilename(new Date('2026-09-12T12:34:56.002Z')),
  );
});
