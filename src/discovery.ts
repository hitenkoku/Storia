import { isolatedItemIds } from "./exploration.ts";

type DiscoveryItem = {
  id: string;
  type: string;
  growthStatus: string;
  tags: string[];
  links: { id: string }[];
  updatedAt: string;
};
export type DiscoveryReason = "dormant" | "isolated" | "sharedTags";

export function restoredItemId(items: { id: string }[], savedId: unknown): string {
  return items.find((item) => item.id === savedId)?.id ?? items[0]?.id ?? "";
}

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** One per perspective, in the order below. Ties use code-unit ID order.
 * Dormant means updated before local midnight seven calendar days ago (inclusive).
 * Invalid/future dates cannot qualify as dormant; invalid dates sort last.
 * Published/current items are excluded. Type-marker tags are not creative tags.
 */
export function discoverItems(items: DiscoveryItem[], currentId: string, now: Date, candidateIds?: Set<string>) {
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).getTime();
  const timestamp = (item: DiscoveryItem) => {
    const value = Date.parse(item.updatedAt);
    return Number.isFinite(value) ? value : Infinity;
  };
  const candidates = items.filter((item) => item.id !== currentId && item.growthStatus !== "published" && (!candidateIds || candidateIds.has(item.id)))
    .sort((a, b) => timestamp(a) - timestamp(b) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const islands = isolatedItemIds(items);
  const tags = new Set(items.find((item) => item.id === currentId)?.tags.filter((tag) => tag !== "idea" && tag !== "article"));
  const perspectives: [DiscoveryReason, (item: DiscoveryItem) => boolean][] = [
    ["dormant", (item) => timestamp(item) <= cutoff],
    ["isolated", (item) => item.type === "idea" && islands.has(item.id)],
    ["sharedTags", (item) => item.tags.some((tag) => tags.has(tag))],
  ];
  const result: { id: string; reason: DiscoveryReason }[] = [];
  for (const [reason, qualifies] of perspectives) {
    const item = candidates.find((candidate) => !result.some((chosen) => chosen.id === candidate.id) && qualifies(candidate));
    if (item) result.push({ id: item.id, reason });
  }
  return result;
}
