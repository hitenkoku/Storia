export type Shelf = { id: string; name: string };
export const ALL_SHELVES = "__all__";
export const UNFILED = "__unfiled__";
type ShelvedItem = { id: string; shelfId?: string };

export function normalizeShelves(value: unknown): Shelf[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>([ALL_SHELVES, UNFILED]);
  return value.flatMap((shelf) => {
    if (!shelf || typeof shelf.id !== "string" || !shelf.id || seen.has(shelf.id)
      || typeof shelf.name !== "string" || !shelf.name.trim()) return [];
    seen.add(shelf.id);
    return [{ id: shelf.id, name: shelf.name.trim() }];
  });
}

export function validShelfId(shelves: Shelf[], id: unknown): string | undefined {
  return shelves.find((shelf) => shelf.id === id)?.id;
}

export function shelfScope(shelves: Shelf[], id: unknown): string {
  return id === UNFILED ? UNFILED : validShelfId(shelves, id) ?? ALL_SHELVES;
}

export function inShelf(item: ShelvedItem, scope: string): boolean {
  return scope === ALL_SHELVES || (scope === UNFILED ? !item.shelfId : item.shelfId === scope);
}

export function selectedInShelf<T extends ShelvedItem>(items: T[], scope: string, id: unknown): string {
  return items.find((item) => item.id === id && inShelf(item, scope))?.id
    ?? items.find((item) => inShelf(item, scope))?.id ?? "";
}

/** Removing a shelf changes membership only; all content and relationships survive. */
export function removeShelf<T extends ShelvedItem>(items: T[], shelves: Shelf[], id: string) {
  return {
    shelves: shelves.filter((shelf) => shelf.id !== id),
    items: items.map((item) => item.shelfId === id ? { ...item, shelfId: undefined } : item),
  };
}

/** Include both incoming and outgoing boundary links, preserving their direction. */
export function shelfBoundaryLinks<T extends ShelvedItem & { links: { id: string; kind: string }[] }>(items: T[], scope: string) {
  const byId = new Map(items.map((item) => [item.id, item]));
  return items.flatMap((from) => from.links.flatMap((link) => {
    const to = byId.get(link.id);
    if (!to || inShelf(from, scope) === inShelf(to, scope)) return [];
    return [{ from, to, kind: link.kind, outside: inShelf(from, scope) ? to : from }];
  }));
}
