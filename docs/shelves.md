# Story shelves (#25)

The library shelf selector always includes All and Unfiled. Manage shelves creates, renames, and deletes named shelves; deletion requires a second action and moves materials to Unfiled without deleting them. Each material's shelf selector moves it. In a specific shelf, moving a material follows it to its new shelf and offers a return button. From All, the view stays on All.

Search, tag suggestions, the material list, today's picks, and graph materials/history use the selected shelf. Switching shelves clears the search and keeps the selected material if it belongs there, otherwise selects the first material in that shelf. Empty shelves show a creation entry point. New materials, templates, and quick captures join the current named shelf; creation from All or Unfiled is unfiled. Sprouts and revision branches inherit their source material's current shelf, including when created from All.

Links remain workspace-wide and show shelf names. Opening a material outside the current shelf switches to its shelf, shows the target in the editor, and offers a button back to the previous shelf. The graph has a separate cross-shelf relationship list that includes incoming and outgoing links with direction, relationship type, destination title, and shelf. Internal graph nodes and snapshots remain limited to the current shelf. Isolation and discovery isolation are computed against all valid workspace links, so a material connected only from another shelf is not called isolated.

## Persistence and compatibility

- The storage key remains `storia.workspace.v1`. Additive fields are workspace `shelves: { id, name }[]`, `selectedShelfId`, and optional material `shelfId`.
- `__all__` and `__unfiled__` are reserved view IDs, never material membership. Missing shelf data loads as no named shelves; existing materials become unfiled. Missing/invalid membership becomes unfiled. Missing/invalid selected shelf falls back to All. Invalid material selection falls back only within the chosen shelf; empty shelves have no selected material.
- Shelf names are trimmed and must be nonempty. Malformed entries, reserved IDs, and duplicate IDs are discarded on load; first valid ID wins. Names may repeat; stable IDs determine membership. Long names are truncated visually in material/link badges and retain their full accessible text and tooltip.
- Rename, move, and delete preserve material IDs, bodies, tags, timestamps, notes, directional link metadata, revision IDs, and revision objects. They do not create snapshots. Snapshot schema is unchanged; a branch uses the source material's current membership, not a historical membership.
- Shelf selection and changes use the existing 500ms autosave/pagehide flush and failure/retry UI. The back-to-previous-shelf shortcut is temporary UI state and is not persisted.

## Verification

```sh
npm ci
npm test
npm run build
git diff --check
```

For optional browser integration tests, install Playwright without modifying package manifests and use a local Vite server. Tests use isolated, headless Edge profiles and fixture data.

```sh
npm install --no-save --package-lock=false playwright
npm run dev -- --host 127.0.0.1 --port 1433
node tests/shelves.browser.mjs
```

`STORIA_TEST_URL` overrides the URL (set it to port 1433 also when running `tests/resume-discovery.browser.mjs`). Stop Vite and run `npm ci` to restore the locked dependency tree afterward.

Automated coverage includes legacy/malformed/empty data, selection fallback, shelf search/tags/discovery, graph boundary direction and navigation, creation paths, source inheritance from All, live-draft moves, rename/deletion/reload without content loss, Japanese/English, keyboard activation, narrow layout, and regression checks for resume notes, focus mode, and storage failure/retry. Browser screenshots are local verification artifacts, not committed. Native Tauri shutdown, real IME input, and screen-reader behavior remain manual checks.
