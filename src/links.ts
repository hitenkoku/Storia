export type LinkKind = "伏線" | "元ネタ" | "対立" | "派生" | "回収先" | "関連";
export type PayoffStatus = "unset" | "unresolved" | "resolved";
export type ItemLink = {
  id: string;
  kind: LinkKind;
  payoffStatus?: PayoffStatus;
  intentNote?: string;
};

export const DEFAULT_LINK_KIND: LinkKind = "関連";
export const LINK_KINDS: LinkKind[] = ["伏線", "元ネタ", "対立", "派生", "回収先", "関連"];
export const isLinkKind = (value: unknown): value is LinkKind =>
  typeof value === "string" && LINK_KINDS.includes(value as LinkKind);
export const normalizePayoffStatus = (value: unknown): PayoffStatus =>
  value === "unresolved" || value === "resolved" ? value : "unset";

export const normalizeLinks = (item: unknown): ItemLink[] => {
  const value = (item ?? {}) as { links?: unknown; linkedIds?: unknown };
  const links = Array.isArray(value.links) ? value.links
    : Array.isArray(value.linkedIds) ? value.linkedIds.filter((id) => typeof id === "string") : [];
  return links.flatMap((link): ItemLink[] => {
    if (typeof link === "string") {
      return [{ id: link, kind: DEFAULT_LINK_KIND, payoffStatus: "unset", intentNote: "" }];
    }
    if (!link || typeof link !== "object" || typeof link.id !== "string") return [];
    return [{
      id: link.id,
      kind: isLinkKind(link.kind) ? link.kind : DEFAULT_LINK_KIND,
      payoffStatus: normalizePayoffStatus(link.payoffStatus),
      intentNote: typeof link.intentNote === "string" ? link.intentNote : "",
    }];
  });
};

export const toggleItemLink = (links: ItemLink[], id: string): ItemLink[] =>
  links.some((link) => link.id === id)
    ? links.filter((link) => link.id !== id)
    : [...links, { id, kind: DEFAULT_LINK_KIND }];

export const changeLinkKind = (links: ItemLink[], id: string, kind: LinkKind): ItemLink[] =>
  links.map((link) => link.id === id ? { ...link, kind } : link);

export const updateForeshadow = (
  links: ItemLink[], id: string, patch: { payoffStatus?: unknown; intentNote?: string },
): ItemLink[] => links.map((link) => link.id === id ? {
  ...link,
  ...(patch.payoffStatus !== undefined ? { payoffStatus: normalizePayoffStatus(patch.payoffStatus) } : {}),
  ...(patch.intentNote !== undefined ? { intentNote: patch.intentNote } : {}),
} : link);

// New articles inherit intent, including metadata hidden by another kind.
// The original idea keeps its own payoff state.
export const inheritLinks = (links: ItemLink[]): ItemLink[] =>
  links.map((link) => ({ ...link, payoffStatus: "unset", intentNote: link.intentNote ?? "" }));
