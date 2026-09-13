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

test('storage access stays best-effort when localStorage is unavailable', () => {
  const originalStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
  };
  try {
    assert.deepEqual(loadWritingSoundSettings(), DEFAULT_WRITING_SOUND_SETTINGS);
    assert.equal(saveWritingSoundSettings({ mode: 'pen', volume: 0.5 }), false);
  } finally {
    globalThis.localStorage = originalStorage;
  }
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

test('switching off during resume prevents delayed playback', async () => {
  const originalAudioContext = globalThis.AudioContext;
  let starts = 0;
  class FakeNode {
    connect(target) { return target; }
  }
  class FakeSource extends FakeNode {
    addEventListener() {}
    start() { starts += 1; }
    stop() {}
  }
  globalThis.AudioContext = class {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = new FakeNode();
    }
    createGain() { const node = new FakeNode(); node.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; return node; }
    createBiquadFilter() { const node = new FakeNode(); node.type = ''; node.frequency = { value: 0 }; node.Q = { value: 0 }; return node; }
    createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    createBufferSource() { return new FakeSource(); }
    async resume() { engine.configure({ mode: 'off', volume: 0.35 }); this.state = 'running'; }
    async close() { this.state = 'closed'; }
  };
  const engine = new WritingSoundEngine();
  engine.configure({ mode: 'typewriter', volume: 0.35 });
  try {
    await engine.play();
    assert.equal(starts, 0);
  } finally {
    engine.dispose();
    globalThis.AudioContext = originalAudioContext;
  }
});

test('startup failures do not leave later playback muted', async () => {
  const originalAudioContext = globalThis.AudioContext;
  let starts = 0;
  let failCreateBufferSource = true;
  let gainNode;
  class FakeNode {
    connect(target) { return target; }
  }
  class FakeSource extends FakeNode {
    addEventListener() {}
    start() { starts += 1; }
    stop() {}
  }
  globalThis.AudioContext = class {
    constructor() {
      this.state = 'running';
      this.currentTime = 0;
      this.sampleRate = 48000;
      this.destination = new FakeNode();
    }
    createGain() {
      const node = new FakeNode();
      node.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
      gainNode ??= node;
      return node;
    }
    createBiquadFilter() { const node = new FakeNode(); node.type = ''; node.frequency = { value: 0 }; node.Q = { value: 0 }; return node; }
    createBuffer(_channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
    createBufferSource() {
      if (failCreateBufferSource) throw new Error('transient');
      return new FakeSource();
    }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  };
  const engine = new WritingSoundEngine();
  engine.configure({ mode: 'pen', volume: 0.35 });
  try {
    await engine.play();
    assert.equal(gainNode.gain.value, 0.35);
    failCreateBufferSource = false;
    await engine.play(true);
    assert.equal(starts, 1);
  } finally {
    engine.dispose();
    globalThis.AudioContext = originalAudioContext;
  }
});
