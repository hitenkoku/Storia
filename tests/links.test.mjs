import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeLinks, toggleItemLink, changeLinkKind, inheritLinks, updateForeshadow } from '../src/links.ts';

test('legacy IDs, missing fields and malformed metadata normalize safely', () => {
  const empty = { id: 'b', kind: '関連', payoffStatus: 'unset', intentNote: '' };
  assert.deepEqual(normalizeLinks({ linkedIds: ['b', null, 42] }), [empty]);
  assert.deepEqual(normalizeLinks({ links: ['b', null, {}, 42] }), [empty]);
  assert.deepEqual(normalizeLinks({ links: [{ id: 'b', kind: 'bad', payoffStatus: 'bad', intentNote: {} }] }), [empty]);
  assert.deepEqual(normalizeLinks(null), []);
  assert.deepEqual(normalizeLinks({ links: [] }), []);
  assert.equal(normalizeLinks({ links: [{ id: 'b', kind: '伏線' }] })[0].payoffStatus, 'unset');
});

test('kind round trip preserves hidden intent and unlink/relink removes it', () => {
  const original = [{ id: 'b', kind: '伏線', payoffStatus: 'resolved', intentNote: '最終章で鍵を使う' }];
  const hidden = changeLinkKind(original, 'b', '対立');
  const restored = changeLinkKind(normalizeLinks(JSON.parse(JSON.stringify({ links: hidden }))), 'b', '伏線');
  assert.deepEqual(restored, original);
  const readded = toggleItemLink(toggleItemLink(restored, 'b'), 'b');
  assert.deepEqual(normalizeLinks({ links: readded }), [{ id: 'b', kind: '関連', payoffStatus: 'unset', intentNote: '' }]);
  assert.equal(original[0].kind, '伏線');
});

test('directional edits survive serialization without changing body, tags, history or reverse links', () => {
  const note = '意図😀\n  空白を保持  '.repeat(10000);
  const state = {
    items: [
      { id: 'a', body: '本文', tags: ['idea'], revisionIds: ['r'], links: [{ id: 'b', kind: '伏線' }, { id: 'c', kind: '関連' }] },
      { id: 'b', body: '逆方向', links: [{ id: 'a', kind: '伏線', payoffStatus: 'unresolved', intentNote: '逆の意図' }] },
    ],
    revisions: [{ id: 'r', itemId: 'a', body: '過去の本文' }],
  };
  const original = structuredClone(state);
  state.items[0].links = updateForeshadow(state.items[0].links, 'b', { payoffStatus: 'resolved', intentNote: note });
  const saved = JSON.parse(JSON.stringify(state));
  saved.items = saved.items.map(item => ({ ...item, links: normalizeLinks(item) }));
  assert.equal(saved.items[0].links[0].intentNote, note);
  assert.equal(saved.items[0].links[0].payoffStatus, 'resolved');
  assert.deepEqual(state.items[1], original.items[1]);
  assert.deepEqual(saved.revisions, original.revisions);
  assert.equal(saved.items[0].body, original.items[0].body);
  assert.deepEqual(saved.items[0].tags, original.items[0].tags);
  assert.deepEqual(saved.items[0].revisionIds, ['r']);
  assert.deepEqual(state.items[0].links[1], original.items[0].links[1]);
});

test('sprouting resets all inherited states, preserves hidden notes, and leaves source unchanged', () => {
  const source = [
    { id: 'a', kind: '伏線', payoffStatus: 'resolved', intentNote: '回収する理由' },
    { id: 'b', kind: '関連', payoffStatus: 'unresolved', intentNote: '非表示の意図' },
    { id: 'c', kind: '伏線' },
  ];
  const before = structuredClone(source);
  const inherited = inheritLinks(source);
  assert.deepEqual(inherited.map(link => link.payoffStatus), ['unset', 'unset', 'unset']);
  assert.deepEqual(inherited.map(link => link.intentNote), ['回収する理由', '非表示の意図', '']);
  assert.deepEqual(source, before);
  assert.deepEqual(inheritLinks([]), []);
});
