type GraphItem = { id: string; links: { id: string }[] };
type GraphRevision = { id: string; itemId: string };

/** Incoming links count too; snapshots and dangling/self links do not. */
export function isolatedItemIds(items: GraphItem[]) {
  const ids = new Set(items.map((item) => item.id));
  const connected = new Set<string>();
  for (const item of items) {
    for (const link of item.links) {
      if (link.id !== item.id && ids.has(link.id)) {
        connected.add(item.id);
        connected.add(link.id);
      }
    }
  }
  return new Set(items.filter((item) => !connected.has(item.id)).map((item) => item.id));
}

/** One row per item, with its snapshots to the right. Canvas grows without clamping. */
export function graphPositions(items: GraphItem[], revisions: GraphRevision[]) {
  const positions = new Map<string, { x: number; y: number }>();
  let columns = 1;
  const revisionsByItemId = new Map<string, GraphRevision[]>();
  revisions.forEach((revision) => {
    const grouped = revisionsByItemId.get(revision.itemId);
    if (grouped) grouped.push(revision);
    else revisionsByItemId.set(revision.itemId, [revision]);
  });
  items.forEach((item, row) => {
    positions.set(item.id, { x: 110, y: 60 + row * 100 });
    const children = revisionsByItemId.get(item.id) ?? [];
    columns = Math.max(columns, children.length + 1);
    children.forEach((revision, column) => {
      positions.set(revision.id, { x: 110 + (column + 1) * 220, y: 60 + row * 100 });
    });
  });
  return { positions, width: Math.max(500, columns * 220), height: Math.max(280, items.length * 100 + 20) };
}

/** Raw Markdown code points, excluding whitespace. Dialogue is text inside Japanese quotes. */
export function writingStats(source: string) {
  const characters = Array.from(source.replace(/\s/gu, "")).length;
  let dialogue = 0;
  const stack: string[] = [];
  for (const character of source) {
    if (character === "「" || character === "『") stack.push(character === "「" ? "」" : "』");
    else if (character === stack[stack.length - 1]) stack.pop();
    else if (stack.length && !/\s/u.test(character)) dialogue += 1;
  }
  let headings = 0;
  let fence: { marker: string; length: number } | undefined;
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (delimiter) {
      if (!fence) fence = { marker: delimiter[1][0], length: delimiter[1].length };
      else if (delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) fence = undefined;
      return;
    }
    if (fence) return;
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line)) headings += 1;
    else if (/^ {0,3}(?:=+|-+)\s*$/.test(line) && index > 0 && lines[index - 1].trim() && !/^\s*(?:#|>|-|`|~)/.test(lines[index - 1])) headings += 1;
  });
  return { characters, manuscriptPages: characters / 400, headings, dialogueRate: characters ? dialogue / characters * 100 : 0 };
}
