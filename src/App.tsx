import {
  BookOpen,
  Check,
  Clock3,
  FileText,
  GitBranch,
  Lightbulb,
  Link2,
  Pencil,
  Save,
  Search,
  Sparkles,
  Sprout,
  Tag,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type WorkType = "article" | "idea";
type GrowthStatus = "seed" | "sprout" | "draft" | "revised" | "published";
type LinkKind = "伏線" | "元ネタ" | "対立" | "派生" | "回収先" | "関連";

type ItemLink = {
  id: string;
  kind: LinkKind;
};

type WorkItem = {
  id: string;
  type: WorkType;
  growthStatus: GrowthStatus;
  title: string;
  tags: string[];
  body: string;
  links: ItemLink[];
  revisionIds: string[];
  createdAt: string;
  updatedAt: string;
};

type Revision = {
  id: string;
  itemId: string;
  title: string;
  tags: string[];
  body: string;
  note: string;
  createdAt: string;
};

type Draft = {
  title: string;
  type: WorkType;
  growthStatus: GrowthStatus;
  tags: string;
  body: string;
  links: ItemLink[];
  note: string;
};

type StoriaState = {
  items: WorkItem[];
  revisions: Revision[];
};

type GraphNode = {
  id: string;
  label: string;
  type: WorkType | "revision";
  x: number;
  y: number;
};

type GraphEdge = {
  from: string;
  to: string;
  kind: "link" | "revision";
  linkKind?: LinkKind;
};

const STORAGE_KEY = "storia.workspace.v1";
const DEFAULT_REVISION_NOTE = "保存前のスナップショット";
const DEFAULT_LINK_KIND: LinkKind = "関連";
const LINK_KINDS: LinkKind[] = ["伏線", "元ネタ", "対立", "派生", "回収先", "関連"];
const GROWTH_STATUSES: GrowthStatus[] = ["seed", "sprout", "draft", "revised", "published"];
const GROWTH_STATUS_LABELS: Record<GrowthStatus, string> = {
  seed: "seed",
  sprout: "sprout",
  draft: "draft",
  revised: "revised",
  published: "published",
};

const nowIso = () => new Date().toISOString();

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const parseTags = (value: string, type: WorkType) => {
  const normalized = value
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
  const requiredTag = type;
  return Array.from(new Set([requiredTag, ...normalized]));
};

const defaultGrowthStatus = (type: WorkType): GrowthStatus =>
  type === "idea" ? "seed" : "draft";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

const isLinkKind = (value: unknown): value is LinkKind =>
  typeof value === "string" && LINK_KINDS.includes(value as LinkKind);

const isGrowthStatus = (value: unknown): value is GrowthStatus =>
  typeof value === "string" && GROWTH_STATUSES.includes(value as GrowthStatus);

const normalizeLinks = (item: unknown): ItemLink[] => {
  const value = item as { links?: unknown; linkedIds?: unknown };

  if (Array.isArray(value.links)) {
    return value.links
      .map((link) => {
        if (typeof link === "string") {
          return { id: link, kind: DEFAULT_LINK_KIND };
        }
        if (link && typeof link === "object") {
          const candidate = link as { id?: unknown; kind?: unknown };
          if (typeof candidate.id === "string") {
            return {
              id: candidate.id,
              kind: isLinkKind(candidate.kind) ? candidate.kind : DEFAULT_LINK_KIND,
            };
          }
        }
        return null;
      })
      .filter((link): link is ItemLink => link !== null);
  }

  if (Array.isArray(value.linkedIds)) {
    return value.linkedIds
      .filter((id): id is string => typeof id === "string")
      .map((id) => ({ id, kind: DEFAULT_LINK_KIND }));
  }

  return [];
};

const normalizeState = (state: StoriaState): StoriaState => ({
  ...state,
  items: state.items.map(
    (item): WorkItem => ({
      id: item.id,
      type: item.type,
      growthStatus: isGrowthStatus((item as { growthStatus?: unknown }).growthStatus)
        ? (item as { growthStatus: GrowthStatus }).growthStatus
        : defaultGrowthStatus(item.type),
      title: item.title,
      tags: item.tags,
      body: item.body,
      links: normalizeLinks(item),
      revisionIds: item.revisionIds,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }),
  ),
});

const seedState = (): StoriaState => {
  const createdAt = nowIso();
  const articleId = newId();
  const ideaId = newId();
  const revisionId = newId();

  return {
    items: [
      {
        id: articleId,
        type: "article",
        growthStatus: "draft",
        title: "連載第一話の下書き",
        tags: ["article", "web-novel", "draft"],
        body: [
          "# 雨の街で拾った手紙",
          "",
          "主人公が古い郵便受けから差出人不明の手紙を見つける。",
          "",
          "- 舞台は夜の商店街",
          "- 手紙には未来の日付がある",
          "- 物語の終盤で idea ノートと回収する",
        ].join("\n"),
        links: [{ id: ideaId, kind: "回収先" }],
        revisionIds: [revisionId],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: ideaId,
        type: "idea",
        growthStatus: "seed",
        title: "未来から届く手紙",
        tags: ["idea", "plot", "mystery"],
        body: [
          "# アイデア",
          "",
          "手紙は未来の自分からではなく、まだ出会っていない読者から届いている。",
          "",
          "> 読者と作者の境界を物語内の謎にする。",
        ].join("\n"),
        links: [{ id: articleId, kind: "元ネタ" }],
        revisionIds: [],
        createdAt,
        updatedAt: createdAt,
      },
    ],
    revisions: [
      {
        id: revisionId,
        itemId: articleId,
        title: "連載第一話の下書き",
        tags: ["article", "web-novel", "draft"],
        body: "# 初期メモ\n\n郵便受けから物語を始める。",
        note: "初期構想",
        createdAt,
      },
    ],
  };
};

const makeDraft = (item: WorkItem): Draft => ({
  title: item.title,
  type: item.type,
  growthStatus: item.growthStatus,
  tags: item.tags.filter((tag) => tag !== item.type).join(", "),
  body: item.body,
  links: item.links,
  note: "",
});

function MarkdownPreview({ source }: { source: string }) {
  if (!source.trim()) {
    return <p className="muted">Markdown preview will appear here.</p>;
  }

  return (
    <div className="markdown-preview">
      {source.split("\n").map((line, index) => {
        const key = `${index}-${line}`;
        if (line.startsWith("### ")) {
          return <h4 key={key}>{line.slice(4)}</h4>;
        }
        if (line.startsWith("## ")) {
          return <h3 key={key}>{line.slice(3)}</h3>;
        }
        if (line.startsWith("# ")) {
          return <h2 key={key}>{line.slice(2)}</h2>;
        }
        if (line.startsWith("> ")) {
          return <blockquote key={key}>{line.slice(2)}</blockquote>;
        }
        if (line.startsWith("- ")) {
          return <li key={key}>{line.slice(2)}</li>;
        }
        if (!line.trim()) {
          return <br key={key} />;
        }
        return <p key={key}>{line}</p>;
      })}
    </div>
  );
}

function App() {
  const [workspace, setWorkspace] = useState<StoriaState>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return seedState();

    try {
      return normalizeState(JSON.parse(stored) as StoriaState);
    } catch {
      return seedState();
    }
  });
  const [selectedId, setSelectedId] = useState(workspace.items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(() => makeDraft(workspace.items[0]));
  const [view, setView] = useState<"preview" | "graph" | "spark">("preview");
  const [editingRevisionId, setEditingRevisionId] = useState("");
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");

  const selectedItem =
    workspace.items.find((item) => item.id === selectedId) ?? workspace.items[0];

  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;

  useEffect(() => {
    if (persistTimer.current !== null) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceRef.current));
    }, 500);
  }, [workspace]);

  useEffect(() => {
    return () => {
      if (persistTimer.current !== null) {
        clearTimeout(persistTimer.current);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaceRef.current));
      }
    };
  }, []);

  useEffect(() => {
    if (selectedItem) {
      setDraft(makeDraft(selectedItem));
    }
  }, [selectedItem?.id]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workspace.items;

    return workspace.items.filter((item) =>
      [item.title, item.body, item.growthStatus, ...item.tags].some((value) =>
        value.toLowerCase().includes(term),
      ),
    );
  }, [query, workspace.items]);

  const revisionsForSelected = useMemo(
    () =>
      workspace.revisions
        .filter((revision) => revision.itemId === selectedItem?.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [workspace.revisions, selectedItem?.id],
  );

  const allTags = useMemo(
    () => Array.from(new Set(workspace.items.flatMap((item) => item.tags))).sort(),
    [workspace.items],
  );

  const itemById = useMemo(
    () => new Map(workspace.items.map((item) => [item.id, item])),
    [workspace.items],
  );

  const normalizeForSearch = (value: string) =>
    value.trim().replace(/\s+/g, " ").toLowerCase();

  const sparkCards = useMemo(() => {
    if (!selectedItem) return [];

    const title = draft.title.trim() || selectedItem.title || "この断片";
    const body = draft.body.trim();
    const normalizedBody = normalizeForSearch(body);
    const lines = body
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const lastLine = lines.length > 0 ? lines[lines.length - 1] : "";
    const linkedItems = draft.links
      .map((link) => {
        const item = itemById.get(link.id);
        return item ? { item, kind: link.kind } : null;
      })
      .filter((link): link is { item: WorkItem; kind: LinkKind } => link !== null);
    const unresolvedLinks = linkedItems.filter(({ item }) => {
      const linkedTitle = normalizeForSearch(item.title);
      return linkedTitle.length > 0 && !normalizedBody.includes(linkedTitle);
    });
    const conflictLinks = linkedItems.filter(({ kind }) => kind === "対立");

    return [
      {
        title: "問い",
        body:
          draft.type === "idea"
            ? `「${title}」が作品になるなら、読者に最初に見せる出来事は何か。`
            : `この場面で、誰が何を失い、何を隠そうとしているか。`,
      },
      {
        title: "矛盾",
        body:
          conflictLinks.length > 0
            ? `対立リンク: ${conflictLinks
                .map(({ item }) => item.title)
                .join("、")}。どちらの主張が本文で強く見えているか見直す。`
            : linkedItems.length === 0
              ? "まだ他の素材と接続されていない。元ネタ、回収先、対立相手を1つ足せるか確認する。"
              : "リンク先との関係はある。本文側にも、その関係が読める手がかりを置けているか確認する。",
      },
      {
        title: "次に書ける一文",
        body: lastLine
          ? `直前の「${lastLine.slice(0, 42)}」に対して、逆の反応をする人物を一人置いてみる。`
          : `「${title}」について、まだ誰にも知られていない事実を一文で書く。`,
      },
      {
        title: "未回収リンク",
        body:
          unresolvedLinks.length > 0
            ? unresolvedLinks.map(({ item, kind }) => `${kind}: ${item.title}`).join(" / ")
            : "未回収リンクはありません。リンクがある場合は、本文内でリンク先に触れられています。",
      },
    ];
  }, [draft.body, draft.links, draft.title, draft.type, itemById, selectedItem]);

  const graphNodes = useMemo<GraphNode[]>(() => {
    const itemNodes = workspace.items.map((item, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(workspace.items.length, 1);
      return {
        id: item.id,
        label: item.title,
        type: item.type,
        x: 250 + Math.cos(angle) * 160,
        y: 190 + Math.sin(angle) * 120,
      };
    });

    const revisionsByItem = workspace.revisions.reduce<Record<string, Revision[]>>(
      (groups, revision) => {
        groups[revision.itemId] = [...(groups[revision.itemId] ?? []), revision];
        return groups;
      },
      {},
    );

    const revisionNodes = Object.entries(revisionsByItem).flatMap(([itemId, revisions]) => {
      const parent = itemNodes.find((node) => node.id === itemId);
      const orderedRevisions = [...revisions].sort((a, b) =>
        a.createdAt.localeCompare(b.createdAt),
      );

      return orderedRevisions.map((revision, index) => {
        const middle = (orderedRevisions.length - 1) / 2;
        const spread = Math.max(44, 92 - orderedRevisions.length * 4);
        const xOffset = 76;
        const yOffset = (index - middle) * spread;
        const note = revision.note.trim() || "revision";

        return {
          id: revision.id,
          label: `${note} ${formatDate(revision.createdAt)}`,
          type: "revision" as const,
          x: Math.min(470, Math.max(30, (parent?.x ?? 250) + xOffset)),
          y: Math.min(350, Math.max(30, (parent?.y ?? 190) + yOffset)),
        };
      });
    });

    return [...itemNodes, ...revisionNodes];
  }, [workspace.items, workspace.revisions]);

  const graphEdges = useMemo<GraphEdge[]>(() => {
    const links = workspace.items.flatMap((item) =>
      item.links.map((link) => ({
        from: item.id,
        to: link.id,
        kind: "link" as const,
        linkKind: link.kind,
      })),
    );
    const revisions = workspace.revisions.map((revision) => ({
      from: revision.itemId,
      to: revision.id,
      kind: "revision" as const,
    }));

    return [...links, ...revisions];
  }, [workspace.items, workspace.revisions]);

  const updateDraft = (patch: Partial<Omit<Draft, "note">>) => {
    if (!selectedItem) return;

    const nextDraft = { ...draft, ...patch };
    const timestamp = nowIso();
    const tags = parseTags(nextDraft.tags, nextDraft.type);

    setDraft(nextDraft);
    setWorkspace((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              title: nextDraft.title.trim() || "Untitled",
              type: nextDraft.type,
              growthStatus: nextDraft.growthStatus,
              tags,
              body: nextDraft.body,
              links: nextDraft.links.filter((link) => link.id !== item.id),
              updatedAt: timestamp,
            }
          : item,
      ),
    }));
  };

  const createSnapshot = (event: FormEvent) => {
    event.preventDefault();
    if (!selectedItem) return;

    const timestamp = nowIso();
    const tags = parseTags(draft.tags, draft.type);
    const revision: Revision = {
      id: newId(),
      itemId: selectedItem.id,
      title: draft.title.trim() || "Untitled",
      tags,
      body: draft.body,
      note: draft.note.trim() || DEFAULT_REVISION_NOTE,
      createdAt: timestamp,
    };

    setWorkspace((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              title: draft.title.trim() || "Untitled",
              type: draft.type,
              growthStatus: draft.growthStatus,
              tags,
              body: draft.body,
              links: draft.links.filter((link) => link.id !== item.id),
              revisionIds: [...item.revisionIds, revision.id],
              updatedAt: timestamp,
            }
          : item,
      ),
      revisions: [...current.revisions, revision],
    }));
    setDraft((current) => ({ ...current, note: "" }));
  };

  const startEditingRevision = (revision: Revision) => {
    setEditingRevisionId(revision.id);
    setRevisionNoteDraft(revision.note);
  };

  const cancelEditingRevision = () => {
    setEditingRevisionId("");
    setRevisionNoteDraft("");
  };

  const saveRevisionNote = (event?: FormEvent) => {
    event?.preventDefault();
    if (!editingRevisionId) return;

    const note = revisionNoteDraft.trim() || DEFAULT_REVISION_NOTE;
    setWorkspace((current) => ({
      ...current,
      revisions: current.revisions.map((revision) =>
        revision.id === editingRevisionId ? { ...revision, note } : revision,
      ),
    }));
    cancelEditingRevision();
  };

  const createItem = (type: WorkType) => {
    const timestamp = nowIso();
    const id = newId();
    const item: WorkItem = {
      id,
      type,
      growthStatus: defaultGrowthStatus(type),
      title: type === "article" ? "新しい記事" : "新しいアイデア",
      tags: [type],
      body: type === "article" ? "# 新しい記事\n\nここから書き始める。" : "# 新しいアイデア\n\n断片を残す。",
      links: [],
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setWorkspace((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedId(id);
    setDraft(makeDraft(item));
  };

  const sproutIdea = () => {
    if (!selectedItem || selectedItem.type !== "idea") return;

    const timestamp = nowIso();
    const articleId = newId();
    const baseTags = parseTags(draft.tags, "article");
    const tags = Array.from(new Set(["idea", ...baseTags]));
    const links = [
      ...draft.links,
      { id: selectedItem.id, kind: "元ネタ" as const },
    ].filter((link, index, allLinks) => {
      if (link.id === articleId) return false;
      return allLinks.findIndex((candidate) => candidate.id === link.id) === index;
    });
    const article: WorkItem = {
      id: articleId,
      type: "article",
      growthStatus: "draft",
      title: draft.title.trim() || selectedItem.title,
      tags,
      body: draft.body,
      links,
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setWorkspace((current) => ({
      ...current,
      items: [
        article,
        ...current.items.map((item) =>
          item.id === selectedItem.id
            ? {
                ...item,
                growthStatus: item.growthStatus === "seed" ? "sprout" : item.growthStatus,
                links: [
                  ...item.links.filter((link) => link.id !== articleId),
                  { id: articleId, kind: "派生" as const },
                ],
                updatedAt: timestamp,
              }
            : item,
        ),
      ],
    }));
    setSelectedId(articleId);
    setDraft(makeDraft(article));
  };

  const toggleLink = (id: string) => {
    const links = draft.links.some((link) => link.id === id)
      ? draft.links.filter((link) => link.id !== id)
      : [...draft.links, { id, kind: DEFAULT_LINK_KIND }];

    updateDraft({ links });
  };

  const updateLinkKind = (id: string, kind: LinkKind) => {
    updateDraft({
      links: draft.links.map((link) => (link.id === id ? { ...link, kind } : link)),
    });
  };

  return (
    <main className="app-shell">
      <aside className="library-pane" aria-label="Storia library">
        <div className="brand-block">
          <BookOpen size={28} aria-hidden="true" />
          <div>
            <h1>Storia</h1>
            <p>Web小説と記事のための執筆 Wiki</p>
          </div>
        </div>

        <div className="toolbar">
          <button className="icon-button" type="button" onClick={() => createItem("article")} title="記事を追加">
            <FileText size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => createItem("idea")} title="アイデアを追加">
            <Lightbulb size={18} aria-hidden="true" />
          </button>
        </div>

        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="タイトル、本文、タグで検索"
          />
        </label>

        <div className="tag-strip" aria-label="Available tags">
          {allTags.map((tag) => (
            <button key={tag} type="button" onClick={() => setQuery(tag)}>
              #{tag}
            </button>
          ))}
        </div>

        <div className="item-list">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              className={item.id === selectedItem?.id ? "item-card active" : "item-card"}
              type="button"
              onClick={() => setSelectedId(item.id)}
            >
              <div className="item-meta">
                <span className={`type-pill ${item.type}`}>
                  {item.type === "article" ? <FileText size={14} /> : <Lightbulb size={14} />}
                  {item.type}
                </span>
                <span className={`growth-pill ${item.growthStatus}`}>
                  stage: {GROWTH_STATUS_LABELS[item.growthStatus]}
                </span>
              </div>
              <strong>{item.title}</strong>
              <small>{formatDate(item.updatedAt)} updated</small>
            </button>
          ))}
        </div>
      </aside>

      {selectedItem && (
        <form className="editor-pane" onSubmit={createSnapshot}>
          <div className="editor-header">
            <div>
              <label htmlFor="title">Title</label>
              <input
                id="title"
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.currentTarget.value })}
              />
            </div>
            <div className="editor-actions">
              <div className="segmented-control" aria-label="Document type">
                <button
                  type="button"
                  className={draft.type === "article" ? "selected" : ""}
                  onClick={() => updateDraft({ type: "article" })}
                >
                  <FileText size={16} aria-hidden="true" />
                  article
                </button>
                <button
                  type="button"
                  className={draft.type === "idea" ? "selected" : ""}
                  onClick={() => updateDraft({ type: "idea" })}
                >
                  <Lightbulb size={16} aria-hidden="true" />
                  idea
                </button>
              </div>
              <label className="growth-select">
                <span>Growth</span>
                <select
                  value={draft.growthStatus}
                  onChange={(event) =>
                    updateDraft({ growthStatus: event.currentTarget.value as GrowthStatus })
                  }
                >
                  {GROWTH_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {GROWTH_STATUS_LABELS[status]}
                    </option>
                  ))}
                </select>
              </label>
              {selectedItem.type === "idea" && (
                <button className="sprout-button" type="button" onClick={sproutIdea}>
                  <Sprout size={16} aria-hidden="true" />
                  記事へ発芽
                </button>
              )}
            </div>
          </div>

          <label className="field-block">
            <span>
              <Tag size={16} aria-hidden="true" />
              Tags
            </span>
            <input
              value={draft.tags}
              onChange={(event) => updateDraft({ tags: event.currentTarget.value })}
              placeholder="web-novel, draft, chapter-1"
            />
          </label>

          <label className="field-block markdown-field">
            <span>Markdown</span>
            <textarea
              value={draft.body}
              onChange={(event) => updateDraft({ body: event.currentTarget.value })}
              spellCheck={false}
            />
          </label>

          <div className="save-row">
            <label>
              <Clock3 size={16} aria-hidden="true" />
              <input
                value={draft.note}
                onChange={(event) => { const note = event.currentTarget.value; setDraft((prev) => ({ ...prev, note })); }}
                placeholder="スナップショット名"
              />
            </label>
            <button className="primary-button" type="submit">
              <Save size={17} aria-hidden="true" />
              スナップショットを作成
            </button>
          </div>
        </form>
      )}

      <section className="knowledge-pane" aria-label="Knowledge graph and metadata">
        <div className="tabs">
          <button type="button" className={view === "preview" ? "selected" : ""} onClick={() => setView("preview")}>
            <BookOpen size={16} aria-hidden="true" />
            Preview
          </button>
          <button type="button" className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}>
            <GitBranch size={16} aria-hidden="true" />
            Graph
          </button>
          <button type="button" className={view === "spark" ? "selected" : ""} onClick={() => setView("spark")}>
            <Sparkles size={16} aria-hidden="true" />
            Spark
          </button>
        </div>

        {view === "preview" ? (
          <div className="preview-panel">
            <MarkdownPreview source={draft.body} />
          </div>
        ) : view === "graph" ? (
          <div className="graph-panel">
            <svg viewBox="0 0 500 380" role="img" aria-label="Storia graph">
              {graphEdges.map((edge, index) => {
                const from = graphNodes.find((node) => node.id === edge.from);
                const to = graphNodes.find((node) => node.id === edge.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={`${edge.from}-${edge.to}-${index}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    className={edge.kind}
                  >
                    {edge.linkKind && <title>{edge.linkKind}</title>}
                  </line>
                );
              })}
              {graphNodes.map((node) => (
                <g key={node.id} onClick={() => workspace.items.some((item) => item.id === node.id) && setSelectedId(node.id)}>
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.type === "revision" ? 13 : 22}
                    className={`${node.type} ${node.id === selectedItem?.id ? "selected" : ""}`}
                  />
                  <text x={node.x} y={node.y + 38}>
                    {node.label.slice(0, 18)}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        ) : (
          <div className="spark-panel">
            {sparkCards.map((card) => (
              <article key={card.title} className="spark-card">
                <strong>{card.title}</strong>
                <p>{card.body}</p>
              </article>
            ))}
          </div>
        )}

        <div className="relation-section">
          <h2>
            <Link2 size={17} aria-hidden="true" />
            Links
          </h2>
          <div className="link-list">
            {workspace.items
              .filter((item) => item.id !== selectedItem?.id)
              .map((item) => {
                const link = draft.links.find((candidate) => candidate.id === item.id);
                const checkboxId = `link-${selectedItem.id}-${item.id}`;

                return (
                  <div key={item.id} className="link-row">
                    <input
                      id={checkboxId}
                      type="checkbox"
                      checked={Boolean(link)}
                      onChange={() => toggleLink(item.id)}
                    />
                    <label htmlFor={checkboxId}>{item.title}</label>
                    <select
                      value={link?.kind ?? DEFAULT_LINK_KIND}
                      onChange={(event) => updateLinkKind(item.id, event.currentTarget.value as LinkKind)}
                      disabled={!link}
                      aria-label={`${item.title} の関係タイプ`}
                    >
                      {LINK_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {kind}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="relation-section">
          <h2>
            <Clock3 size={17} aria-hidden="true" />
            History
          </h2>
          <div className="timeline">
            {revisionsForSelected.map((revision) => (
              <article key={revision.id} className="revision-card">
                {editingRevisionId === revision.id ? (
                  <form className="revision-edit" onSubmit={saveRevisionNote}>
                    <input
                      autoFocus
                      value={revisionNoteDraft}
                      onChange={(event) => setRevisionNoteDraft(event.currentTarget.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape") {
                          cancelEditingRevision();
                        }
                      }}
                      aria-label="スナップショット名"
                    />
                    <button type="submit" title="保存" aria-label="保存">
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={cancelEditingRevision} title="キャンセル" aria-label="キャンセル">
                      <X size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <div className="revision-card-header">
                    <strong>{revision.note}</strong>
                    <button
                      type="button"
                      onClick={() => startEditingRevision(revision)}
                      title="スナップショット名を編集"
                      aria-label="スナップショット名を編集"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <small>{formatDate(revision.createdAt)}</small>
                <p>{revision.title}</p>
              </article>
            ))}
            {revisionsForSelected.length === 0 && <p className="muted">まだ履歴はありません。</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
