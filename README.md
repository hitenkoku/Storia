# Storia

Storia is a Tauri + React TypeScript desktop app for writing and organizing web novels, articles, ideas, revisions, and their relationships.

## Current prototype

- Article and idea records with required `article` / `idea` tags
- Markdown editor with live preview
- Tag search and tag filtering
- Revision snapshots with notes
- Link management between articles, ideas, and revision history
- LLM-Wiki style graph view for connected writing materials

Data is currently stored in browser localStorage while the product shape is being validated.

## Development

```bash
npm install
npm run dev
npm run build
npm run tauri dev
```

The Tauri development server is configured to use `http://localhost:1422`.
