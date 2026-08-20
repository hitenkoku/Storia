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
  Sprout,
  Tag,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import "./App.css";

type WorkType = "article" | "idea";

type WorkItem = {
  id: string;
  type: WorkType;
  title: string;
  tags: string[];
  body: string;
  linkedIds: string[];
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
  tags: string;
  body: string;
  linkedIds: string[];
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

const STORAGE_KEY = "storia.workspace.v1";
const DEFAULT_REVISION_NOTE = "保存前のスナップショット";

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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

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
        linkedIds: [ideaId],
        revisionIds: [revisionId],
        createdAt,
        updatedAt: createdAt,
      },
      {
        id: ideaId,
        type: "idea",
        title: "未来から届く手紙",
        tags: ["idea", "plot", "mystery"],
        body: [
          "# アイデア",
          "",
          "手紙は未来の自分からではなく、まだ出会っていない読者から届いている。",
          "",
          "> 読者と作者の境界を物語内の謎にする。",
        ].join("\n"),
        linkedIds: [articleId],
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
  tags: item.tags.filter((tag) => tag !== item.type).join(", "),
  body: item.body,
  linkedIds: item.linkedIds,
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
      return JSON.parse(stored) as StoriaState;
    } catch {
      return seedState();
    }
  });
  const [selectedId, setSelectedId] = useState(workspace.items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(() => makeDraft(workspace.items[0]));
  const [view, setView] = useState<"preview" | "graph">("preview");
  const [editingRevisionId, setEditingRevisionId] = useState("");
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");

  const selectedItem =
    workspace.items.find((item) => item.id === selectedId) ?? workspace.items[0];

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [workspace]);

  useEffect(() => {
    if (selectedItem) {
      setDraft(makeDraft(selectedItem));
    }
  }, [selectedItem?.id]);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return workspace.items;

    return workspace.items.filter((item) =>
      [item.title, item.body, ...item.tags].some((value) =>
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

  const graphEdges = useMemo(() => {
    const links = workspace.items.flatMap((item) =>
      item.linkedIds.map((linkedId) => ({
        from: item.id,
        to: linkedId,
        kind: "link",
      })),
    );
    const revisions = workspace.revisions.map((revision) => ({
      from: revision.itemId,
      to: revision.id,
      kind: "revision",
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
              tags,
              body: nextDraft.body,
              linkedIds: nextDraft.linkedIds.filter((id) => id !== item.id),
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
      items: current.items.map((item) =>
        item.id === selectedItem.id
          ? {
              ...item,
              title: draft.title.trim() || "Untitled",
              type: draft.type,
              tags,
              body: draft.body,
              linkedIds: draft.linkedIds.filter((id) => id !== item.id),
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
      title: type === "article" ? "新しい記事" : "新しいアイデア",
      tags: [type],
      body: type === "article" ? "# 新しい記事\n\nここから書き始める。" : "# 新しいアイデア\n\n断片を残す。",
      linkedIds: [],
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
    const linkedIds = Array.from(new Set([...draft.linkedIds, selectedItem.id])).filter(
      (id) => id !== articleId,
    );
    const article: WorkItem = {
      id: articleId,
      type: "article",
      title: draft.title.trim() || selectedItem.title,
      tags,
      body: draft.body,
      linkedIds,
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
                linkedIds: Array.from(new Set([...item.linkedIds, articleId])),
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
    const linkedIds = draft.linkedIds.includes(id)
      ? draft.linkedIds.filter((linkedId) => linkedId !== id)
      : [...draft.linkedIds, id];

    updateDraft({ linkedIds });
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
              <span className={`type-pill ${item.type}`}>
                {item.type === "article" ? <FileText size={14} /> : <Lightbulb size={14} />}
                {item.type}
              </span>
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
                onChange={(event) => setDraft({ ...draft, note: event.currentTarget.value })}
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
        </div>

        {view === "preview" ? (
          <div className="preview-panel">
            <MarkdownPreview source={draft.body} />
          </div>
        ) : (
          <div className="graph-panel">
            <svg viewBox="0 0 500 380" role="img" aria-label="LLM Wiki graph">
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
                  />
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
        )}

        <div className="relation-section">
          <h2>
            <Link2 size={17} aria-hidden="true" />
            Links
          </h2>
          <div className="link-list">
            {workspace.items
              .filter((item) => item.id !== selectedItem?.id)
              .map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={draft.linkedIds.includes(item.id)}
                    onChange={() => toggleLink(item.id)}
                  />
                  <span>{item.title}</span>
                </label>
              ))}
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
