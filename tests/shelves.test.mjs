import assert from 'node:assert/strict';
import test from 'node:test';
import { ALL_SHELVES, UNFILED, normalizeShelves, validShelfId, shelfScope, inShelf, selectedInShelf, removeShelf, shelfBoundaryLinks } from '../src/shelves.ts';
import { discoverItems } from '../src/discovery.ts';
import { graphPositions } from '../src/exploration.ts';

const shelves = [{ id: 'a', name: '物語 A' }, { id: 'b', name: 'Story B' }];
test('legacy and malformed shelves become safe, unique named shelves without reserved IDs', () => {
  for (const value of [undefined, null, {}, 'bad']) assert.deepEqual(normalizeShelves(value), []);
  assert.deepEqual(normalizeShelves([null, {}, { id: ALL_SHELVES, name: 'reserved' }, { id: UNFILED, name: 'reserved' }, { id: 'a', name: '  物語 A  ' }, { id: 'a', name: 'duplicate' }, { id: 'b', name: ' ' }]), [shelves[0]]);
  assert.equal(validShelfId(shelves, 'missing'), undefined);
  assert.equal(shelfScope(shelves, 'missing'), ALL_SHELVES);
  assert.equal(shelfScope(shelves, UNFILED), UNFILED);
});

test('selection stays within shelf; invalid selections and empty shelves are safe', () => {
  const items = [{ id: 'u' }, { id: 'aa', shelfId: 'a' }, { id: 'bb', shelfId: 'b' }];
  assert.equal(selectedInShelf(items, 'a', 'bb'), 'aa');
  assert.equal(selectedInShelf(items, ALL_SHELVES, 'bb'), 'bb');
  assert.equal(selectedInShelf(items, UNFILED, 'aa'), 'u');
  assert.equal(selectedInShelf(items, 'empty', 'aa'), '');
  assert.equal(selectedInShelf([], ALL_SHELVES, 'bad'), '');
});

test('deletion preserves IDs, text, directed metadata, notes, timestamps and revision IDs', () => {
  const material = { id: 'aa', shelfId: 'a', body: '日本語 body', tags: ['rain'], resumeNote: '次は…', links: [{ id: 'bb', kind: '伏線', payoffStatus: 'resolved', intentNote: '最後で回収' }], revisionIds: ['r'], updatedAt: '2026-09-01' };
  const other = { id: 'bb', shelfId: 'b' };
  const result = removeShelf([material, other], shelves, 'a');
  assert.deepEqual(result.shelves, [shelves[1]]);
  assert.deepEqual(result.items[0], { ...material, shelfId: undefined });
  assert.equal(result.items[1], other);
  assert.equal(material.shelfId, 'a');
  assert.equal(inShelf(result.items[0], UNFILED), true);
});

test('graph boundaries preserve incoming/outgoing direction and omit unrelated, internal and dangling links', () => {
  const items = [
    { id: 'aa', shelfId: 'a', links: [{ id: 'bb', kind: '伏線' }, { id: 'missing', kind: '関連' }, { id: 'aa2', kind: '関連' }] },
    { id: 'aa2', shelfId: 'a', links: [] },
    { id: 'bb', shelfId: 'b', links: [{ id: 'aa', kind: '元ネタ' }, { id: 'u', kind: '関連' }] },
    { id: 'u', links: [] },
  ];
  assert.deepEqual(shelfBoundaryLinks(items, 'a').map(({ from, to, outside }) => [from.id, to.id, outside.id]), [['aa', 'bb', 'bb'], ['bb', 'aa', 'bb']]);
  assert.deepEqual(shelfBoundaryLinks(items, ALL_SHELVES), []);
  const graph = graphPositions(items.filter((item) => inShelf(item, 'a')), [{ id: 'ra', itemId: 'aa' }, { id: 'rb', itemId: 'bb' }]);
  assert.deepEqual([...graph.positions.keys()], ['aa', 'ra', 'aa2']);
});

test('discovery scopes candidates while incoming links from other shelves still prevent false islands', () => {
  const now = new Date(2026, 8, 9);
  const item = (id, shelfId, links = []) => ({ id, shelfId, links, type: 'idea', growthStatus: 'seed', tags: [], updatedAt: now.toISOString() });
  const items = [item('source', 'b', [{ id: 'target' }]), item('target', 'a'), item('island', 'a'), item('outside-island', 'b')];
  assert.deepEqual(discoverItems(items, '', now, new Set(['target', 'island'])), [{ id: 'island', reason: 'isolated' }]);
  assert.deepEqual(discoverItems(items, '', now, new Set()), []);
});
