import {
  BookOpen,
  Check,
  Clock3,
  CopyPlus,
  FileText,
  GitBranch,
  Lightbulb,
  Link2,
  Pencil,
  Plus,
  Save,
  Search,
  Sparkles,
  Sprout,
  Tag,
  X,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { graphPositions, isolatedItemIds, writingStats } from "./exploration";

type WorkType = "article" | "idea";
type GrowthStatus = "seed" | "sprout" | "draft" | "revised" | "published";
type StartTemplate = "blank" | "scene" | "setting" | "question" | "fragment";
type Locale = "ja" | "en";
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
const LOCALE_STORAGE_KEY = "storia.locale.v1";
const DEFAULT_REVISION_NOTES: Record<Locale, string> = {
  ja: "保存前のスナップショット",
  en: "Snapshot before saving",
};
const DEFAULT_LINK_KIND: LinkKind = "関連";
const LINK_KINDS: LinkKind[] = ["伏線", "元ネタ", "対立", "派生", "回収先", "関連"];
const GROWTH_STATUSES: GrowthStatus[] = ["seed", "sprout", "draft", "revised", "published"];
const START_TEMPLATE_OPTIONS: StartTemplate[] = ["blank", "scene", "setting", "question", "fragment"];
const LOCALES: Locale[] = ["ja", "en"];
const GROWTH_STATUS_LABELS: Record<GrowthStatus, string> = {
  seed: "seed",
  sprout: "sprout",
  draft: "draft",
  revised: "revised",
  published: "published",
};
const TYPE_LABELS: Record<Locale, Record<WorkType, string>> = {
  ja: {
    article: "記事",
    idea: "アイデア",
  },
  en: {
    article: "Article",
    idea: "Idea",
  },
};
const LINK_KIND_LABELS: Record<Locale, Record<LinkKind, string>> = {
  ja: {
    伏線: "伏線",
    元ネタ: "元ネタ",
    対立: "対立",
    派生: "派生",
    回収先: "回収先",
    関連: "関連",
  },
  en: {
    伏線: "Foreshadowing",
    元ネタ: "Source",
    対立: "Conflict",
    派生: "Derived",
    回収先: "Payoff",
    関連: "Related",
  },
};
const START_TEMPLATE_LABELS: Record<Locale, Record<StartTemplate, string>> = {
  ja: {
    blank: "白紙",
    scene: "場面",
    setting: "設定",
    question: "問い",
    fragment: "断片",
  },
  en: {
    blank: "Blank",
    scene: "Scene",
    setting: "Setting",
    question: "Question",
    fragment: "Fragment",
  },
};
const UI_TEXT = {
  ja: {
    brandSubtitle: "Web小説と記事のための執筆 Wiki",
    libraryAriaLabel: "Storia ライブラリ",
    localeLabel: "言語",
    addArticle: "記事を追加",
    addIdea: "アイデアを追加",
    quickCaptureLabel: "断片クイックキャプチャ",
    quickCapturePlaceholder: "一行の断片をすぐ残す",
    saveFragment: "断片を保存",
    startTemplate: "開始テンプレート",
    create: "作成",
    searchPlaceholder: "タイトル、本文、タグ、成長段階で検索",
    availableTags: "利用できるタグ",
    updated: "更新",
    stage: "段階",
    title: "タイトル",
    focusMode: "集中モード",
    exitFocusMode: "集中モードを終了",
    focusHelp: "Escキーでも終了できます。",
    documentType: "ドキュメント種別",
    growth: "成長段階",
    sproutArticle: "記事へ発芽",
    tags: "タグ",
    tagsPlaceholder: "web小説, 下書き, 第1章",
    snapshotName: "スナップショット名",
    createSnapshot: "スナップショットを作成",
    graphAndMetadata: "知識グラフとメタデータ",
    preview: "プレビュー",
    graph: "グラフ",
    spark: "発想",
    storiaGraph: "Storia グラフ",
    islands: "孤島（未接続の素材）",
    noIslands: "すべての素材が接続されています。",
    graphHelp: "実線は素材間の関係、破線は履歴。上下・左右にスクロールできます。",
    horizontal: "横書き", vertical: "縦書き",
    characters: "文字数", manuscriptPages: "原稿用紙（400字）換算",
    headings: "見出し数", dialogueRate: "会話文率（概算）",
    statsHelp: "空白・改行を除く本文の文字数（Markdown記号を含む）。用紙換算は文字数÷400。会話文率は「」・『』内の文字数（括弧を除く）の割合です。見出しはコードブロックを除いて集計します。",

    links: "リンク",
    linkKindLabel: "の関係タイプ",
    history: "履歴",
    revisionBody: "この版の本文",
    revisionDiff: "現在版との差分",
    addedLine: "追加",
    removedLine: "削除",
    unchangedLine: "同じ",
    branchFromRevision: "この版から別展開を作る",
    branchedTitle: (title: string) => `${title} の別展開`,
    save: "保存",
    cancel: "キャンセル",
    editSnapshotName: "スナップショット名を編集",
    emptyHistory: "まだ履歴はありません。",
    markdownPreviewEmpty: "Markdown プレビューがここに表示されます。",
    sparkFallbackTitle: "この断片",
    sparkQuestionTitle: "問い",
    sparkConflictTitle: "矛盾",
    sparkNextLineTitle: "次に書ける一文",
    sparkUnresolvedTitle: "未回収リンク",
    sparkQuestionIdea: (title: string) =>
      `「${title}」が作品になるなら、読者に最初に見せる出来事は何か。`,
    sparkQuestionArticle: "この場面で、誰が何を失い、何を隠そうとしているか。",
    sparkConflictLinks: (titles: string) =>
      `対立リンク: ${titles}。どちらの主張が本文で強く見えているか見直す。`,
    sparkNoLinks: "まだ他の素材と接続されていない。元ネタ、回収先、対立相手を1つ足せるか確認する。",
    sparkLinked: "リンク先との関係はある。本文側にも、その関係が読める手がかりを置けているか確認する。",
    sparkNextFromLastLine: (line: string) =>
      `直前の「${line}」に対して、逆の反応をする人物を一人置いてみる。`,
    sparkNextFromTitle: (title: string) =>
      `「${title}」について、まだ誰にも知られていない事実を一文で書く。`,
    sparkNoUnresolved:
      "未回収リンクはありません。リンクがある場合は、本文内でリンク先に触れられています。",
  },
  en: {
    brandSubtitle: "Writing Wiki for web fiction and articles",
    libraryAriaLabel: "Storia library",
    localeLabel: "Language",
    addArticle: "Add article",
    addIdea: "Add idea",
    quickCaptureLabel: "Quick capture fragment",
    quickCapturePlaceholder: "Capture a one-line fragment",
    saveFragment: "Save fragment",
    startTemplate: "Start template",
    create: "Create",
    searchPlaceholder: "Search by title, body, tags, or growth stage",
    availableTags: "Available tags",
    updated: "updated",
    stage: "stage",
    title: "Title",
    focusMode: "Focus mode",
    exitFocusMode: "Exit focus mode",
    focusHelp: "You can also exit with Esc.",
    documentType: "Document type",
    growth: "Growth",
    sproutArticle: "Sprout into article",
    tags: "Tags",
    tagsPlaceholder: "web-novel, draft, chapter-1",
    snapshotName: "Snapshot name",
    createSnapshot: "Create snapshot",
    graphAndMetadata: "Knowledge graph and metadata",
    preview: "Preview",
    graph: "Graph",
    spark: "Spark",
    storiaGraph: "Storia graph",
    islands: "Islands (unconnected material)",
    noIslands: "All material is connected.",
    graphHelp: "Solid lines connect material; dashed lines show history. Scroll horizontally or vertically to explore.",
    horizontal: "Horizontal", vertical: "Vertical",
    characters: "Characters", manuscriptPages: "400-character pages",
    headings: "Headings", dialogueRate: "Dialogue (estimate)",
    statsHelp: "Characters exclude whitespace and include Markdown syntax. Pages = characters / 400. Dialogue is the share inside Japanese quotes, excluding quote marks. Headings exclude fenced code blocks.",

    links: "Links",
    linkKindLabel: " relationship type",
    history: "History",
    revisionBody: "Revision body",
    revisionDiff: "Diff from current",
    addedLine: "Added",
    removedLine: "Removed",
    unchangedLine: "Same",
    branchFromRevision: "Branch from this revision",
    branchedTitle: (title: string) => `${title} branch`,
    save: "Save",
    cancel: "Cancel",
    editSnapshotName: "Edit snapshot name",
    emptyHistory: "No history yet.",
    markdownPreviewEmpty: "Markdown preview will appear here.",
    sparkFallbackTitle: "this fragment",
    sparkQuestionTitle: "Question",
    sparkConflictTitle: "Conflict",
    sparkNextLineTitle: "Next line",
    sparkUnresolvedTitle: "Unresolved links",
    sparkQuestionIdea: (title: string) =>
      `If "${title}" became a finished work, what event should the reader see first?`,
    sparkQuestionArticle: "In this scene, who loses what, and what are they trying to hide?",
    sparkConflictLinks: (titles: string) =>
      `Conflict links: ${titles}. Check which claim currently feels stronger in the body.`,
    sparkNoLinks: "This piece is not connected to other material yet. Add one source, payoff, or opposing idea.",
    sparkLinked: "The links are in place. Check whether the body gives readers enough clues to understand those relationships.",
    sparkNextFromLastLine: (line: string) =>
      `After "${line}", try adding one person who reacts in the opposite way.`,
    sparkNextFromTitle: (title: string) =>
      `Write one sentence about "${title}" that no character knows yet.`,
    sparkNoUnresolved:
      "There are no unresolved links. When links exist, their targets are already mentioned in the body.",
  },
} satisfies Record<Locale, Record<string, string | ((value: string) => string)>>;
const START_TEMPLATES: Record<
  StartTemplate,
  {
    label: string;
    type: WorkType;
    growthStatus: GrowthStatus;
    title: string;
    tags: string[];
    body: string;
  }
> = {
  blank: {
    label: "白紙",
    type: "article",
    growthStatus: "draft",
    title: "新しい記事",
    tags: ["article"],
    body: "# 新しい記事\n\nここから書き始める。",
  },
  scene: {
    label: "場面",
    type: "article",
    growthStatus: "draft",
    title: "新しい場面",
    tags: ["article", "scene"],
    body: "# 新しい場面\n\n誰が、どこで、何を失うのか。\n\n## 起きること\n\n- ",
  },
  setting: {
    label: "設定",
    type: "idea",
    growthStatus: "seed",
    title: "新しい設定",
    tags: ["idea", "setting"],
    body: "# 新しい設定\n\nこの世界では、何が当たり前で、何が禁じられているのか。",
  },
  question: {
    label: "問い",
    type: "idea",
    growthStatus: "seed",
    title: "新しい問い",
    tags: ["idea", "question"],
    body: "# 新しい問い\n\nもし、主人公が一番信じているものが嘘だったら？",
  },
  fragment: {
    label: "断片",
    type: "idea",
    growthStatus: "seed",
    title: "新しい断片",
    tags: ["idea", "fragment"],
    body: "# 新しい断片\n\nまだ形になっていない一文や会話をここに置く。",
  },
};
const EN_START_TEMPLATES: typeof START_TEMPLATES = {
  blank: {
    label: "Blank",
    type: "article",
    growthStatus: "draft",
    title: "New article",
    tags: ["article"],
    body: "# New article\n\nStart writing here.",
  },
  scene: {
    label: "Scene",
    type: "article",
    growthStatus: "draft",
    title: "New scene",
    tags: ["article", "scene"],
    body: "# New scene\n\nWho is here, where are they, and what do they lose?\n\n## What happens\n\n- ",
  },
  setting: {
    label: "Setting",
    type: "idea",
    growthStatus: "seed",
    title: "New setting",
    tags: ["idea", "setting"],
    body: "# New setting\n\nWhat is normal in this world, and what is forbidden?",
  },
  question: {
    label: "Question",
    type: "idea",
    growthStatus: "seed",
    title: "New question",
    tags: ["idea", "question"],
    body: "# New question\n\nWhat if the thing the protagonist trusts most is a lie?",
  },
  fragment: {
    label: "Fragment",
    type: "idea",
    growthStatus: "seed",
    title: "New fragment",
    tags: ["idea", "fragment"],
    body: "# New fragment\n\nPlace an unfinished sentence or line of dialogue here.",
  },
};
const DEFAULT_ITEM_CONTENT: Record<Locale, Record<WorkType, { title: string; body: string }>> = {
  ja: {
    article: {
      title: "新しい記事",
      body: "# 新しい記事\n\nここから書き始める。",
    },
    idea: {
      title: "新しいアイデア",
      body: "# 新しいアイデア\n\n断片を残す。",
    },
  },
  en: {
    article: {
      title: "New article",
      body: "# New article\n\nStart writing here.",
    },
    idea: {
      title: "New idea",
      body: "# New idea\n\nSave the fragment here.",
    },
  },
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

const isStartTemplate = (value: unknown): value is StartTemplate =>
  typeof value === "string" && START_TEMPLATE_OPTIONS.includes(value as StartTemplate);

const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && LOCALES.includes(value as Locale);

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

function MarkdownPreview({ emptyText, source }: { emptyText: string; source: string }) {
  if (!source.trim()) {
    return <p className="muted">{emptyText}</p>;
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

type DiffLine = {
  id: string;
  type: "added" | "removed" | "unchanged";
  text: string;
};

const buildLineDiff = (before: string, after: string): DiffLine[] => {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  const rows = beforeLines.length + 1;
  const columns = afterLines.length + 1;
  const table = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let beforeIndex = beforeLines.length - 1; beforeIndex >= 0; beforeIndex -= 1) {
    for (let afterIndex = afterLines.length - 1; afterIndex >= 0; afterIndex -= 1) {
      table[beforeIndex][afterIndex] =
        beforeLines[beforeIndex] === afterLines[afterIndex]
          ? table[beforeIndex + 1][afterIndex + 1] + 1
          : Math.max(table[beforeIndex + 1][afterIndex], table[beforeIndex][afterIndex + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let beforeIndex = 0;
  let afterIndex = 0;

  while (beforeIndex < beforeLines.length || afterIndex < afterLines.length) {
    if (
      beforeIndex < beforeLines.length &&
      afterIndex < afterLines.length &&
      beforeLines[beforeIndex] === afterLines[afterIndex]
    ) {
      lines.push({
        id: `${lines.length}-unchanged`,
        type: "unchanged",
        text: beforeLines[beforeIndex],
      });
      beforeIndex += 1;
      afterIndex += 1;
    } else if (
      afterIndex < afterLines.length &&
      (beforeIndex === beforeLines.length ||
        table[beforeIndex][afterIndex + 1] >= table[beforeIndex + 1][afterIndex])
    ) {
      lines.push({
        id: `${lines.length}-added`,
        type: "added",
        text: afterLines[afterIndex],
      });
      afterIndex += 1;
    } else if (beforeIndex < beforeLines.length) {
      lines.push({
        id: `${lines.length}-removed`,
        type: "removed",
        text: beforeLines[beforeIndex],
      });
      beforeIndex += 1;
    }
  }

  return lines;
};

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
  const [locale, setLocale] = useState<Locale>(() => {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : "ja";
  });
  const [selectedId, setSelectedId] = useState(workspace.items[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<Draft>(() => makeDraft(workspace.items[0]));
  const [verticalReading, setVerticalReading] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const focusToggleRef = useRef<HTMLButtonElement>(null);
  const [view, setView] = useState<"preview" | "graph" | "spark">("preview");
  const [quickCapture, setQuickCapture] = useState("");
  const [startTemplate, setStartTemplate] = useState<StartTemplate>("blank");
  const [editingRevisionId, setEditingRevisionId] = useState("");
  const [revisionNoteDraft, setRevisionNoteDraft] = useState("");
  const [openRevisionDiffs, setOpenRevisionDiffs] = useState<Record<string, boolean>>({});
  const [revisionDiffCache, setRevisionDiffCache] = useState<
    Record<string, { draftBody: string; lines: DiffLine[] }>
  >({});

  const selectedItem =
    workspace.items.find((item) => item.id === selectedId) ?? workspace.items[0];
  const text = UI_TEXT[locale];
  const typeLabels = TYPE_LABELS[locale];
  const linkKindLabels = LINK_KIND_LABELS[locale];
  const startTemplateLabels = START_TEMPLATE_LABELS[locale];

  useEffect(() => {
    if (!focusMode) return;
    const exitOnEscape = (event: KeyboardEvent) => {
      // Escape may belong to an IME candidate list or an open native control.
      if (event.key !== "Escape" || event.isComposing || event.keyCode === 229 || event.defaultPrevented) return;
      if (event.target instanceof HTMLSelectElement) return;
      event.preventDefault();
      setFocusMode(false);
      focusToggleRef.current?.focus();
    };
    window.addEventListener("keydown", exitOnEscape);
    return () => window.removeEventListener("keydown", exitOnEscape);
  }, [focusMode]);

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
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale]);

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

    const title = draft.title.trim() || selectedItem.title || text.sparkFallbackTitle;
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
        title: text.sparkQuestionTitle,
        body:
          draft.type === "idea"
            ? text.sparkQuestionIdea(title)
            : text.sparkQuestionArticle,
      },
      {
        title: text.sparkConflictTitle,
        body:
          conflictLinks.length > 0
            ? text.sparkConflictLinks(
                conflictLinks.map(({ item }) => item.title).join(locale === "ja" ? "、" : ", "),
              )
            : linkedItems.length === 0
              ? text.sparkNoLinks
              : text.sparkLinked,
      },
      {
        title: text.sparkNextLineTitle,
        body: lastLine
          ? text.sparkNextFromLastLine(lastLine.slice(0, 42))
          : text.sparkNextFromTitle(title),
      },
      {
        title: text.sparkUnresolvedTitle,
        body:
          unresolvedLinks.length > 0
            ? unresolvedLinks
                .map(({ item, kind }) => `${linkKindLabels[kind]}: ${item.title}`)
                .join(" / ")
            : text.sparkNoUnresolved,
      },
    ];
  }, [draft.body, draft.links, draft.title, draft.type, itemById, linkKindLabels, locale, selectedItem, text]);

  const isolatedIds = useMemo(() => isolatedItemIds(workspace.items), [workspace.items]);
  const graphLayout = useMemo(() => graphPositions(workspace.items, workspace.revisions), [workspace.items, workspace.revisions]);
  const stats = useMemo(() => writingStats(draft.body), [draft.body]);
  const graphNodes = useMemo<GraphNode[]>(() => [
    ...workspace.items.map((item) => ({
      id: item.id, label: item.title, type: item.type, ...graphLayout.positions.get(item.id)!,
    })),
    ...workspace.revisions.filter((revision) => graphLayout.positions.has(revision.id)).map((revision) => ({
      id: revision.id,
      label: `${revision.note.trim() || "revision"} ${formatDate(revision.createdAt)}`,
      type: "revision" as const,
      ...graphLayout.positions.get(revision.id)!,
    })),
  ], [workspace.items, workspace.revisions, graphLayout]);

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
      note: draft.note.trim() || DEFAULT_REVISION_NOTES[locale],
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

    const note = revisionNoteDraft.trim() || DEFAULT_REVISION_NOTES[locale];
    setWorkspace((current) => ({
      ...current,
      revisions: current.revisions.map((revision) =>
        revision.id === editingRevisionId ? { ...revision, note } : revision,
      ),
    }));
    cancelEditingRevision();
  };

  const branchFromRevision = (revision: Revision) => {
    if (!selectedItem) return;

    const timestamp = nowIso();
    const itemType: WorkType = revision.tags.includes("article")
      ? "article"
      : revision.tags.includes("idea")
        ? "idea"
        : selectedItem.type;
    const item: WorkItem = {
      id: newId(),
      type: itemType,
      growthStatus: defaultGrowthStatus(itemType),
      title: text.branchedTitle(revision.title.trim() || selectedItem.title),
      tags: Array.from(new Set([itemType, ...revision.tags.filter((tag) => tag !== itemType)])),
      body: revision.body,
      links: [{ id: selectedItem.id, kind: "元ネタ" }],
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    createWorkItem(item);
  };

  const cacheRevisionDiff = (revision: Revision, isOpen: boolean) => {
    if (!isOpen) return;
    setRevisionDiffCache((current) => {
      const cached = current[revision.id];
      if (cached?.draftBody === draft.body) return current;
      return {
        ...current,
        [revision.id]: {
          draftBody: draft.body,
          lines: buildLineDiff(revision.body, draft.body),
        },
      };
    });
  };

  useEffect(() => {
    setRevisionDiffCache((current) => {
      let changed = false;
      const next = { ...current };
      for (const revision of revisionsForSelected) {
        if (!openRevisionDiffs[revision.id]) continue;
        if (next[revision.id]?.draftBody === draft.body) continue;
        next[revision.id] = {
          draftBody: draft.body,
          lines: buildLineDiff(revision.body, draft.body),
        };
        changed = true;
      }
      return changed ? next : current;
    });
  }, [draft.body, openRevisionDiffs, revisionsForSelected]);

  const createWorkItem = (item: WorkItem) => {
    setWorkspace((current) => ({ ...current, items: [item, ...current.items] }));
    setSelectedId(item.id);
    setDraft(makeDraft(item));
  };

  const createItem = (type: WorkType) => {
    const timestamp = nowIso();
    const id = newId();
    const content = DEFAULT_ITEM_CONTENT[locale][type];
    const item: WorkItem = {
      id,
      type,
      growthStatus: defaultGrowthStatus(type),
      title: content.title,
      tags: [type],
      body: content.body,
      links: [],
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    createWorkItem(item);
  };

  const createFromTemplate = () => {
    const template = (locale === "ja" ? START_TEMPLATES : EN_START_TEMPLATES)[startTemplate];
    const timestamp = nowIso();
    const item: WorkItem = {
      id: newId(),
      type: template.type,
      growthStatus: template.growthStatus,
      title: template.title,
      tags: template.tags,
      body: template.body,
      links: [],
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    createWorkItem(item);
  };

  const submitQuickCapture = (event: FormEvent) => {
    event.preventDefault();
    const text = quickCapture.trim();
    if (!text) return;

    const timestamp = nowIso();
    const title = text.length > 36 ? `${text.slice(0, 36)}...` : text;
    const item: WorkItem = {
      id: newId(),
      type: "idea",
      growthStatus: "seed",
      title,
      tags: ["idea", "fragment"],
      body: `# ${title}\n\n${text}`,
      links: [],
      revisionIds: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    createWorkItem(item);
    setQuickCapture("");
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

  const handleLinkKindChange = (id: string, value: string) => {
    if (isLinkKind(value)) {
      updateLinkKind(id, value);
    }
  };

  return (
    <main className={`app-shell${focusMode ? " focus-mode" : ""}`}>
      <aside className="library-pane" aria-label={text.libraryAriaLabel}>
        <div className="brand-block">
          <BookOpen size={28} aria-hidden="true" />
          <div>
            <h1>Storia</h1>
            <p>{text.brandSubtitle}</p>
          </div>
        </div>

        <label className="locale-switch">
          <span>{text.localeLabel}</span>
          <select
            value={locale}
            onChange={(event) => {
              const nextLocale = event.currentTarget.value;
              if (isLocale(nextLocale)) {
                setLocale(nextLocale);
              }
            }}
          >
            <option value="ja">日本語</option>
            <option value="en">English</option>
          </select>
        </label>

        <div className="toolbar">
          <button className="icon-button" type="button" onClick={() => createItem("article")} title={text.addArticle} aria-label={text.addArticle}>
            <FileText size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => createItem("idea")} title={text.addIdea} aria-label={text.addIdea}>
            <Lightbulb size={18} aria-hidden="true" />
          </button>
        </div>

        <form className="quick-capture" onSubmit={submitQuickCapture}>
          <input
            value={quickCapture}
            onChange={(event) => setQuickCapture(event.currentTarget.value)}
            aria-label={text.quickCaptureLabel}
            placeholder={text.quickCapturePlaceholder}
          />
          <button type="submit" title={text.saveFragment} aria-label={text.saveFragment}>
            <Plus size={16} aria-hidden="true" />
          </button>
        </form>

        <div className="template-create">
          <label>
            <span>{text.startTemplate}</span>
            <select
              value={startTemplate}
              onChange={(event) => {
                const nextTemplate = event.currentTarget.value;
                if (isStartTemplate(nextTemplate)) {
                  setStartTemplate(nextTemplate);
                }
              }}
            >
              {START_TEMPLATE_OPTIONS.map((template) => (
                <option key={template} value={template}>
                  {startTemplateLabels[template]}
                </option>
              ))}
            </select>
          </label>
          <button type="button" onClick={createFromTemplate}>
            <Sparkles size={16} aria-hidden="true" />
            {text.create}
          </button>
        </div>

        <label className="search-box">
          <Search size={16} aria-hidden="true" />
          <input
            value={query}
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder={text.searchPlaceholder}
          />
        </label>

        <div className="tag-strip" aria-label={text.availableTags}>
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
                  {typeLabels[item.type]}
                </span>
                <span className={`growth-pill ${item.growthStatus}`}>
                  {text.stage}: {GROWTH_STATUS_LABELS[item.growthStatus]}
                </span>
              </div>
              <strong>{item.title}</strong>
              <small>{formatDate(item.updatedAt)} {text.updated}</small>
            </button>
          ))}
        </div>
      </aside>

      {selectedItem && (
        <form className="editor-pane" onSubmit={createSnapshot}>
          <div className="editor-header">
            <div>
              <label htmlFor="title">{text.title}</label>
              <input
                id="title"
                value={draft.title}
                onChange={(event) => updateDraft({ title: event.currentTarget.value })}
              />
            </div>
            <div className="editor-actions">
              <button
                ref={focusToggleRef}
                className="focus-toggle"
                type="button"
                aria-pressed={focusMode}
                title={focusMode ? text.focusHelp : undefined}
                onClick={() => setFocusMode((current) => !current)}
              >
                <Pencil size={16} aria-hidden="true" />
                {focusMode ? text.exitFocusMode : text.focusMode}
              </button>
              <div className="segmented-control" aria-label={text.documentType}>
                <button
                  type="button"
                  className={draft.type === "article" ? "selected" : ""}
                  onClick={() => updateDraft({ type: "article" })}
                >
                  <FileText size={16} aria-hidden="true" />
                  {typeLabels.article}
                </button>
                <button
                  type="button"
                  className={draft.type === "idea" ? "selected" : ""}
                  onClick={() => updateDraft({ type: "idea" })}
                >
                  <Lightbulb size={16} aria-hidden="true" />
                  {typeLabels.idea}
                </button>
              </div>
              <label className="growth-select">
                <span>{text.growth}</span>
                <select
                  value={draft.growthStatus}
                  onChange={(event) => {
                    const nextGrowthStatus = event.currentTarget.value;
                    if (isGrowthStatus(nextGrowthStatus)) {
                      updateDraft({ growthStatus: nextGrowthStatus });
                    }
                  }}
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
                  {text.sproutArticle}
                </button>
              )}
            </div>
          </div>

          <label className="field-block">
            <span>
              <Tag size={16} aria-hidden="true" />
              {text.tags}
            </span>
            <input
              value={draft.tags}
              onChange={(event) => updateDraft({ tags: event.currentTarget.value })}
              placeholder={text.tagsPlaceholder}
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
                placeholder={text.snapshotName}
              />
            </label>
            <button className="primary-button" type="submit">
              <Save size={17} aria-hidden="true" />
              {text.createSnapshot}
            </button>
          </div>
        </form>
      )}

      <section className="knowledge-pane" aria-label={text.graphAndMetadata}>
        <div className="tabs">
          <button type="button" className={view === "preview" ? "selected" : ""} onClick={() => setView("preview")}>
            <BookOpen size={16} aria-hidden="true" />
            {text.preview}
          </button>
          <button type="button" className={view === "graph" ? "selected" : ""} onClick={() => setView("graph")}>
            <GitBranch size={16} aria-hidden="true" />
            {text.graph}
          </button>
          <button type="button" className={view === "spark" ? "selected" : ""} onClick={() => setView("spark")}>
            <Sparkles size={16} aria-hidden="true" />
            {text.spark}
          </button>
        </div>

        {view === "preview" ? (
          <div className="preview-panel">
            <div className="reading-controls" role="group" aria-label={text.preview}>
              <button type="button" aria-pressed={!verticalReading} onClick={() => setVerticalReading(false)}>{text.horizontal}</button>
              <button type="button" aria-pressed={verticalReading} onClick={() => setVerticalReading(true)}>{text.vertical}</button>
            </div>
            <dl className="writing-stats">
              <div><dt>{text.characters}</dt><dd>{stats.characters.toLocaleString(locale)}</dd></div>
              <div><dt>{text.manuscriptPages}</dt><dd>{stats.manuscriptPages.toFixed(1)}</dd></div>
              <div><dt>{text.headings}</dt><dd>{stats.headings}</dd></div>
              <div><dt>{text.dialogueRate}</dt><dd>{stats.dialogueRate.toFixed(1)}%</dd></div>
            </dl>
            <p className="muted stats-help">{text.statsHelp}</p>
            <div className={`reader-surface ${verticalReading ? "vertical" : ""}`}>
              <MarkdownPreview emptyText={text.markdownPreviewEmpty} source={draft.body} />
            </div>
          </div>
        ) : view === "graph" ? (
          <div className="graph-panel">
            <p className="muted">{text.graphHelp}</p>
            <div className="graph-legend">
              {LINK_KINDS.map((kind, index) => <span key={kind}><i className={`relation-color relation-${index}`} />{linkKindLabels[kind]}</span>)}
            </div>
            <div className="graph-scroll" tabIndex={0} role="region" aria-label={text.storiaGraph}>
            <svg width={graphLayout.width} height={graphLayout.height} viewBox={`0 0 ${graphLayout.width} ${graphLayout.height}`} aria-label={text.storiaGraph}>
              {graphEdges.map((edge, index) => {
                const from = graphLayout.positions.get(edge.from);
                const to = graphLayout.positions.get(edge.to);
                if (!from || !to || edge.from === edge.to) return null;
                const colorIndex = edge.linkKind ? LINK_KINDS.indexOf(edge.linkKind) : -1;
                return (
                  <path key={`${edge.from}-${edge.to}-${index}`}
                    d={edge.kind === "revision"
                      ? `M ${from.x} ${from.y} Q ${(from.x + to.x) / 2} ${from.y - 45} ${to.x} ${to.y}`
                      : `M ${from.x} ${from.y} C ${20 + colorIndex * 10} ${from.y}, ${20 + colorIndex * 10} ${to.y}, ${to.x} ${to.y}`}
                    className={`${edge.kind} relation-${colorIndex}`}>
                    <title>{edge.linkKind ? `${itemById.get(edge.from)?.title} → ${itemById.get(edge.to)?.title}: ${linkKindLabels[edge.linkKind]}` : text.history}</title>
                  </path>
                );
              })}
              {graphNodes.map((node) => (
                <g key={node.id} role={node.type !== "revision" ? "button" : undefined}
                  tabIndex={node.type !== "revision" ? 0 : undefined}
                  aria-label={`${node.label}${isolatedIds.has(node.id) ? ` (${text.islands})` : ""}`}
                  onClick={() => node.type !== "revision" && setSelectedId(node.id)}
                  onKeyDown={(event) => {
                    if (node.type !== "revision" && (event.key === "Enter" || event.key === " ")) {
                      event.preventDefault(); setSelectedId(node.id);
                    }
                  }}>
                  <title>{node.label}</title>
                  {isolatedIds.has(node.id) && <circle cx={node.x} cy={node.y} r={29} className="island-ring" />}
                  <circle cx={node.x} cy={node.y} r={node.type === "revision" ? 13 : 22}
                    className={`${node.type} ${node.id === selectedItem?.id ? "selected" : ""}`} />
                  <text x={node.x} y={node.y + 43}>{Array.from(node.label).slice(0, 14).join("")}</text>
                </g>
              ))}
            </svg>
            </div>
            <h3>{text.islands}</h3>
            <div className="island-list">
              {workspace.items.filter((item) => isolatedIds.has(item.id)).map((item) => (
                <button type="button" key={item.id} onClick={() => setSelectedId(item.id)}>
                  {typeLabels[item.type]} · {item.title}
                </button>
              ))}
              {!isolatedIds.size && <p className="muted">{text.noIslands}</p>}
            </div>
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
            {text.links}
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
                      onChange={(event) => handleLinkKindChange(item.id, event.currentTarget.value)}
                      disabled={!link}
                      aria-label={`${item.title}${text.linkKindLabel}`}
                    >
                      {LINK_KINDS.map((kind) => (
                        <option key={kind} value={kind}>
                          {linkKindLabels[kind]}
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
            {text.history}
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
                      aria-label={text.snapshotName}
                    />
                    <button type="submit" title={text.save} aria-label={text.save}>
                      <Check size={15} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={cancelEditingRevision} title={text.cancel} aria-label={text.cancel}>
                      <X size={15} aria-hidden="true" />
                    </button>
                  </form>
                ) : (
                  <div className="revision-card-header">
                    <strong>{revision.note}</strong>
                    <button
                      type="button"
                      onClick={() => branchFromRevision(revision)}
                      title={text.branchFromRevision}
                      aria-label={text.branchFromRevision}
                    >
                      <CopyPlus size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startEditingRevision(revision)}
                      title={text.editSnapshotName}
                      aria-label={text.editSnapshotName}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                <small>{formatDate(revision.createdAt)}</small>
                <p>{revision.title}</p>
                <details className="revision-details">
                  <summary>{text.revisionBody}</summary>
                  <MarkdownPreview emptyText={text.markdownPreviewEmpty} source={revision.body} />
                </details>
                <details
                  className="revision-details diff-details"
                  onToggle={(event) => {
                    const isOpen = event.currentTarget.open;
                    setOpenRevisionDiffs((current) =>
                      current[revision.id] === isOpen ? current : { ...current, [revision.id]: isOpen },
                    );
                    cacheRevisionDiff(revision, isOpen);
                  }}
                >
                  {(() => {
                    const diff = revisionDiffCache[revision.id];
                    const diffLines = diff?.draftBody === draft.body ? diff.lines : [];
                    return (
                      <>
                        <summary>{text.revisionDiff}</summary>
                        <div className="diff-list">
                          {diffLines.map((line) => (
                            <div key={line.id} className={`diff-line ${line.type}`}>
                              <span>
                                {line.type === "added"
                                  ? text.addedLine
                                  : line.type === "removed"
                                    ? text.removedLine
                                    : text.unchangedLine}
                              </span>
                              <code>{line.text || " "}</code>
                            </div>
                          ))}
                        </div>
                      </>
                    );
                  })()}
                </details>
              </article>
            ))}
            {revisionsForSelected.length === 0 && <p className="muted">{text.emptyHistory}</p>}
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;
