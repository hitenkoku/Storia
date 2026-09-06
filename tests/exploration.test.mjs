import assert from 'node:assert/strict';
import test from 'node:test';
import { graphPositions, isolatedItemIds, writingStats } from '../src/exploration.ts';

test('incoming links connect both ends; dangling and self links leave islands', () => {
  const items = [
    { id: 'a', links: [{ id: 'b' }] }, { id: 'b', links: [] },
    { id: 'c', links: [{ id: 'missing' }, { id: 'c' }] },
  ];
  assert.deepEqual([...isolatedItemIds(items)], ['c']);
  assert.deepEqual([...isolatedItemIds(items.map(item => ({ ...item, links: [] })))], ['a', 'b', 'c']);
});

test('large graphs keep all nodes distinct and inside the canvas', () => {
  const items = Array.from({ length: 80 }, (_, i) => ({ id: `item-${i}`, links: [] }));
  const revisions = items.flatMap(item => Array.from({ length: 20 }, (_, i) => ({ id: `${item.id}-rev-${i}`, itemId: item.id })));
  const layout = graphPositions(items, [...revisions, { id: 'orphan', itemId: 'missing' }]);
  assert.equal(layout.positions.size, 1680);
  assert.equal(new Set([...layout.positions.values()].map(p => `${p.x},${p.y}`)).size, 1680);
  for (const { x, y } of layout.positions.values()) {
    assert.ok(x >= 30 && x + 100 <= layout.width);
    assert.ok(y >= 30 && y + 45 <= layout.height);
  }
});

test('empty text, Unicode code points, and manuscript conversion', () => {
  assert.deepEqual(writingStats(' \n'), { characters: 0, manuscriptPages: 0, headings: 0, dialogueRate: 0 });
  assert.equal(writingStats('あ😀\r\n い').characters, 3);
  assert.equal(writingStats('あ'.repeat(600)).manuscriptPages, 1.5);
});

test('nested Japanese dialogue excludes quote marks without double counting', () => {
  const stats = writingStats('地「声『音』」');
  assert.equal(stats.dialogueRate, 2 / 7 * 100);
  assert.equal(writingStats('「未完').dialogueRate, 2 / 3 * 100);
});

test('Markdown headings include six levels and setext but exclude code and plain hashes', () => {
  const source = '# 一\n###### 六\n#hashtag\n見出し\n===\n\n---\n```md\n# code\n```\n~~~~\n## code\n~~~\n# still code\n~~~~\n## 二';
  assert.equal(writingStats(source).headings, 4);
});
