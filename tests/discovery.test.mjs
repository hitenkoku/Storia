import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverItems, localDay, restoredItemId } from '../src/discovery.ts';

const now = new Date(2026, 8, 7, 12);
const item = (id, patch = {}) => ({ id, type: 'idea', growthStatus: 'seed', tags: [], links: [], updatedAt: new Date(2026, 8, 7).toISOString(), ...patch });
const old = new Date(2026, 7, 1).toISOString();

test('one per perspective, deduplicated, stable ID ties regardless of input order', () => {
  const items = [item('current', { tags: ['rain'] }), item('b', { updatedAt: old, tags: ['rain'] }), item('a', { updatedAt: old, tags: ['rain'] }), item('c', { tags: ['rain'] })];
  const expected = [{ id: 'a', reason: 'dormant' }, { id: 'b', reason: 'isolated' }, { id: 'c', reason: 'sharedTags' }];
  assert.deepEqual(discoverItems(items, 'current', now), expected);
  assert.deepEqual(discoverItems([...items].reverse(), 'current', now), expected);
});

test('incoming links including published sources prevent false islands; self/dangling do not', () => {
  const items = [item('source', { growthStatus: 'published', links: [{ id: 'target' }] }), item('target'), item('island', { links: [{ id: 'missing' }, { id: 'island' }] })];
  assert.deepEqual(discoverItems(items, '', now), [{ id: 'island', reason: 'isolated' }]);
});

test('no padding; zero, one, two candidates; published and current are excluded', () => {
  assert.deepEqual(discoverItems([], '', now), []);
  assert.deepEqual(discoverItems([item('p', { growthStatus: 'published', updatedAt: old }), item('current', { updatedAt: old })], 'current', now), []);
  assert.equal(discoverItems([item('a')], '', now).length, 1);
  assert.equal(discoverItems([item('a', { updatedAt: old }), item('b')], '', now).length, 2);
});

test('local calendar midnight is inclusive; next-day rollover changes eligibility', () => {
  const cutoff = new Date(2026, 7, 31);
  const a = item('a', { type: 'article', updatedAt: cutoff.toISOString() });
  const b = item('b', { type: 'article', updatedAt: new Date(cutoff.getTime() + 1).toISOString() });
  assert.deepEqual(discoverItems([a], '', now), [{ id: 'a', reason: 'dormant' }]);
  assert.deepEqual(discoverItems([b], '', now), []);
  assert.deepEqual(discoverItems([b], '', new Date(2026, 8, 8)), [{ id: 'b', reason: 'dormant' }]);
  assert.equal(localDay(new Date(2026, 8, 7, 23, 59)), '2026-09-07');
  assert.equal(localDay(new Date(2026, 8, 8)), '2026-09-08');
});

test('invalid and future dates never become dormant; invalid ties are stable', () => {
  const items = [item('b', { updatedAt: 'bad' }), item('a', { updatedAt: '' })];
  assert.deepEqual(discoverItems(items, '', now), [{ id: 'a', reason: 'isolated' }]);
  assert.deepEqual(discoverItems([item('future', { type: 'article', updatedAt: '2099-01-01' })], '', now), []);
});

test('type-marker tags do not count; matching creative tags do', () => {
  const current = item('current', { tags: ['idea', 'rain'] });
  const other = item('other', { type: 'article', tags: ['idea'], links: [{ id: 'current' }] });
  assert.deepEqual(discoverItems([current, other], 'current', now), []);
  assert.deepEqual(discoverItems([current, { ...other, tags: ['rain'] }], 'current', now), [{ id: 'other', reason: 'sharedTags' }]);
});

test('old/missing/invalid selection falls back; empty workspace is safe', () => {
  const items = [item('a'), item('b')];
  assert.equal(restoredItemId(items, 'b'), 'b');
  for (const saved of [undefined, null, 'missing', 3]) assert.equal(restoredItemId(items, saved), 'a');
  assert.equal(restoredItemId([], 'missing'), '');
});
