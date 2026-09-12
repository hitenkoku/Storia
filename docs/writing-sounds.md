# Writing sounds

Storia can play optional, short feedback sounds for confirmed input in the body editor. The setting is off for new and existing users. Mode and volume are stored locally under `storia.writing-sound.v1` and are included as non-secret settings in cloud backups.

## Interaction rules

- Modes: off, pen, and typewriter.
- Sound is limited to `insertText` and `insertLineBreak` input events in the main Markdown body.
- IME composition, deletion, paste, undo/redo, shortcuts, arrows, and focus movement do not play sound.
- A completed IME commit plays once even if composition emitted several intermediate events.
- A 35 ms gate drops rapid events instead of queueing audio, and each generated sound ends within 38 ms.
- Switching off stops active sources and resets the playback gate immediately.
- Preview uses the same engine and current volume.

The setting component uses native `select` and `range` controls so it remains keyboard and screen-reader operable. Focus mode uses the same editor and engine instance as the normal layout.

## Audio source and license

No recorded audio or third-party sound asset is distributed. Both sounds are synthesized at playback with the Web Audio API from a short random-noise buffer, a filter, and a gain envelope in `src/writingSound.ts`. The synthesis code is original Storia source and is covered by the repository's MIT License.
