# Storia

Storia is a Tauri + React TypeScript desktop app for writing and organizing web novels, articles, ideas, revisions, and their relationships.

## Current prototype

- Article and idea records with required `article` / `idea` tags
- Markdown editor with live preview
- Tag search and tag filtering
- Revision snapshots with notes
- Link management between articles, ideas, and revision history
- LLM-Wiki style graph view for connected writing materials
- Graph islands include materials with neither incoming nor outgoing links; snapshots do not count as material links. Relationship colors and hover titles distinguish link types, while dashed curves show history. The graph scrolls as materials and snapshots grow.
- Japanese reader preview with horizontal/vertical layout, character count, 400-character page estimate, Markdown heading count, and an approximate Japanese dialogue share. Statistics run locally on the current draft; the preview explains the counting rules.

Data is currently stored in browser localStorage while the product shape is being validated.

## Development

```bash
npm install
npm run dev
npm run build
npm run tauri dev
```

The Tauri development server is configured to use `http://localhost:1422`.

Run the exploration/statistics regression tests with Node.js 22.6+:

```bash
node --experimental-strip-types --test tests/exploration.test.mjs
```
