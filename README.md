# Storia

**Turn sparks into stories.**

Storia is a desktop writing workspace for people who build stories from fragments: a line of dialogue, a half-formed scene, a character question, or a thread that may become foreshadowing later.

Instead of treating notes, drafts, and revisions as separate piles, Storia keeps their relationships visible. Capture an idea, connect it to the story, grow it into a draft, and leave yourself a clear place to continue next time.

[Website](https://hitenkoku.github.io/Storia/) · [Releases](https://github.com/hitenkoku/Storia/releases) · [Issues](https://github.com/hitenkoku/Storia/issues)

## What you can do

### Capture a fragment

Save a thought immediately with quick capture, or begin from a scene, setting, question, or fragment template. Ideas and articles keep distinct growth stages, so unfinished material can remain unfinished without disappearing.

### Connect it to the story

Link ideas and drafts as foreshadowing, source material, conflict, derivation, payoff, or a general relationship. The graph view shows how material connects and reveals ideas that still stand alone. Foreshadowing links can carry an intent note and an open or resolved payoff state.

### Grow it into prose

Turn a promising idea into an article while preserving its relationships. Write in Markdown with a live preview, enter focus mode when you need a quieter workspace, and read the result horizontally or in Japanese vertical layout. Revision snapshots let you compare changes or branch from an earlier version.

### Leave a way back in

Add a “next writing step” note before you stop. Storia restores the piece you were working on and surfaces dormant fragments, isolated ideas, and material with shared tags so that the next session has a natural starting point.

## Highlights

- Japanese and English interface
- Markdown editor with live preview
- Focus mode with keyboard exit
- Optional pen and typewriter feedback sounds with local volume settings
- Article and idea growth stages
- Typed relationships and a visual story graph
- Foreshadowing intent and payoff tracking
- Revision snapshots, diffs, and branching
- Tag search and filtering
- Horizontal and vertical reader previews
- Local writing statistics, including character count and a 400-character manuscript-page estimate
- Per-item continuation notes and local material discovery
- Explicit, versioned WebDAV workspace backups with OS-protected credentials

## Download

Download the latest preview from [GitHub Releases](https://github.com/hitenkoku/Storia/releases).

Choose the package for your system:

- **Windows:** `.msi` or `.exe`
- **macOS Apple silicon:** the `aarch64` `.dmg`
- **macOS Intel:** the `x86_64` `.dmg`
- **Linux:** `.AppImage` or `.deb`

Storia is in early preview. The first packages are not backed by paid Windows or Apple distribution certificates. Your operating system may therefore ask you to confirm that you trust the application. macOS builds use an ad-hoc signature, but macOS may still require approval in Privacy & Security.

## Data and privacy

Storia stores its workspace locally in the app WebView. It sends writing outside the device only when you configure a WebDAV folder, choose **Back up to cloud**, review the destination, and confirm the upload. WebDAV credentials stay in the operating system credential store.

Cloud sync, automatic backups, and file import/export are not available yet. Manual WebDAV backup is available in the desktop app. Clearing the app's site data or uninstalling it may remove the local workspace, so keep verified backups of important manuscripts.

## Development

### Requirements

- Node.js 22.6 or later
- Rust stable
- The platform dependencies listed in the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/)

### Run locally

```sh
npm ci
npm run tauri dev
```

The frontend alone is available with:

```sh
npm run dev
```

### Validate a change

```sh
npm test
npm run build
git diff --check
```

The test suite covers graph exploration, local discovery, relationship metadata, and workspace compatibility. Native packaging and platform behavior are also checked by the release workflow.

## Project status

Storia is an evolving prototype. Feedback and focused bug reports are welcome in [GitHub Issues](https://github.com/hitenkoku/Storia/issues).

## License

Storia is available under the [MIT License](LICENSE).
