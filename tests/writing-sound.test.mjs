import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WRITING_SOUND_SETTINGS,
  WritingSoundEngine,
  WritingSoundGate,
  isConfirmedWritingInput,
  loadWritingSoundSettings,
  normalizeWritingSoundSettings,
  saveWritingSoundSettings,
} from '../src/writingSound.ts';

test('new, malformed, and legacy settings stay off by default', () => {
  assert.deepEqual(loadWritingSoundSettings({ getItem: () => null }), DEFAULT_WRITING_SOUND_SETTINGS);
  assert.deepEqual(loadWritingSoundSettings({ getItem: () => '{' }), DEFAULT_WRITING_SOUND_SETTINGS);
  assert.deepEqual(normalizeWritingSoundSettings({ mode: 'unknown', volume: 5 }), { mode: 'off', volume: 1 });
});

test('mode and bounded volume persist and restore', () => {
  let stored = '';
  const storage = { getItem: () => stored, setItem: (_key, value) => { stored = value; } };
  assert.equal(saveWritingSoundSettings({ mode: 'typewriter', volume: 0.45 }, storage), true);
  assert.deepEqual(loadWritingSoundSettings(storage), { mode: 'typewriter', volume: 0.45 });
});

test('only confirmed inserted text and line breaks produce writing feedback', () => {
  assert.equal(isConfirmedWritingInput({ inputType: 'insertText', data: 'a', isComposing: false }), true);
  assert.equal(isConfirmedWritingInput({ inputType: 'insertText', data: '確定', isComposing: false }), true);
  assert.equal(isConfirmedWritingInput({ inputType: 'insertLineBreak', data: null, isComposing: false }), true);
  for (const event of [
    { inputType: 'insertCompositionText', data: 'か', isComposing: true },
    { inputType: 'insertText', data: 'か', isComposing: true },
    { inputType: 'deleteContentBackward', data: null, isComposing: false },
    { inputType: 'insertFromPaste', data: null, isComposing: false },
    { inputType: 'historyUndo', data: null, isComposing: false },
    { inputType: undefined, data: null, isComposing: false },
  ]) assert.equal(isConfirmedWritingInput(event), false);
});

test('rapid input is dropped rather than queued', () => {
  const gate = new WritingSoundGate(35);
  assert.equal(gate.allow(100), true);
  assert.equal(gate.allow(110), false);
  assert.equal(gate.allow(134), false);
  assert.equal(gate.allow(135), true);
  gate.reset();
  assert.equal(gate.allow(136), true);
});

test('unavailable audio output never rejects or blocks writing', async () => {
  const engine = new WritingSoundEngine();
  engine.configure({ mode: 'pen', volume: 0.35 });
  await assert.doesNotReject(() => engine.play());
  engine.dispose();
});
