# Resume and discovery (#23 / #24)

- Workspace key remains `storia.workspace.v1`. Optional item `resumeNote` and workspace `selectedId` are additive. Missing/invalid note values become empty; missing/invalid selection falls back to the first item (or no item). Notes update only that item and its timestamp, without creating a revision.
- Notes use a keyboard-operable disclosure in both normal and focus modes. The textarea has a fixed height and scrolls. No note content is copied into the body or a snapshot.
- The existing 500 ms autosave now also flushes on `pagehide` and hidden-document transitions. Failed writes retain memory state and expose retry. This does not guarantee recovery from process termination or OS failure, or solve simultaneous-window writes.

## Selection contract

Use local data only, excluding the current item and published items at selection time. In order, choose one unused item for each perspective:

1. Unfinished and last updated at or before local midnight seven calendar days ago.
2. An idea with no valid incoming or outgoing connection, using the shared `isolatedItemIds` helper. Dangling/self links do not connect an item; incoming links from published items do.
3. A tag shared with the current item. Internal `idea`/`article` tags are ignored; other tags match exactly.

Within each perspective, oldest valid `updatedAt` first, then ID in JavaScript code-unit order. Invalid dates sort last and cannot qualify as dormant; future dates cannot qualify as dormant. No padding from unrelated items, so zero to three cards are normal.

Cards retain the title, excerpt, and reason from selection time. They are selected on launch, explicit refresh, and a local-day change detected every 30 seconds or on window focus/document visibility change. Editing, switching items, and changing locale do not rerank them. Reasons describe the selection-time data; explicit refresh uses the latest workspace and selection. Shelf filtering is not implemented.

## Verification

Requires Node.js 22.6+ (using `--experimental-strip-types` via `npm test`; Node 24+ also works):

```sh
npm ci
npm test
npm run build
git diff --check
```

Optional browser integration check uses an isolated, headless Edge context, never the user's browser profile. Install Playwright without changing the manifest/lockfile, run Vite in another terminal, then run the script:

```sh
npm install --no-save --package-lock=false playwright
npm run dev -- --host 127.0.0.1 --port 1422
node tests/resume-discovery.browser.mjs
```

`STORIA_TEST_URL` overrides the URL. After stopping Vite, `npm ci` restores the locked dependency tree. Native Tauri lifecycle, real Japanese IME, assistive technology, and forced process termination require separate manual review.
