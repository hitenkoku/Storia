import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_WRITING_SOUND_SETTINGS,
  WritingSoundEngine,
  WritingSoundGate,
  isCompositionCommit,
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

test('blocked default storage access falls back without interrupting the app', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('storage blocked'); },
  });
  try {
    assert.deepEqual(loadWritingSoundSettings(), DEFAULT_WRITING_SOUND_SETTINGS);
    assert.equal(saveWritingSoundSettings({ mode: 'pen', volume: 0.4 }), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
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
  assert.equal(isCompositionCommit('確定'), true);
  assert.equal(isCompositionCommit(''), false);
  assert.equal(isCompositionCommit(null), false);
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

const installFakeAudioContext = () => {
  const original = globalThis.AudioContext;
  const contexts = [];
  let nextResumePromise = null;
  class FakeNode {
    connect(target) { return target; }
  }
  class FakeSource extends FakeNode {
    addEventListener(_name, callback) { this.ended = callback; }
    start() { this.context.starts += 1; }
    stop() { this.ended?.(); }
  }
  class FakeAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 0;
      this.sampleRate = 100;
      this.destination = new FakeNode();
      this.starts = 0;
      this.resumeAttempts = 0;
      this.resumePromise = null;
      contexts.push(this);
    }
    createGain() { const node = new FakeNode(); node.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} }; this.master ??= node; return node; }
    createBiquadFilter() { const node = new FakeNode(); node.frequency = { value: 0 }; node.Q = { value: 0 }; return node; }
    createBuffer(_channels, length) { return { getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { const source = new FakeSource(); source.context = this; return source; }
    resume() { this.resumeAttempts += 1; return nextResumePromise ?? Promise.resolve().then(() => { this.state = 'running'; }); }
    close() { return Promise.resolve(); }
  }
  globalThis.AudioContext = FakeAudioContext;
  return {
    contexts,
    setResumePromise: (promise) => { nextResumePromise = promise; },
    restore: () => { if (original) globalThis.AudioContext = original; else delete globalThis.AudioContext; },
  };
};

test('switching off while audio resume is pending does not start a sound', async () => {
  const fake = installFakeAudioContext();
  try {
    let release;
    fake.setResumePromise(new Promise((resolve) => { release = resolve; }));
    const engine = new WritingSoundEngine();
    engine.configure({ mode: 'pen', volume: 0.35 });
    const playing = engine.play();
    const context = fake.contexts[0];
    engine.configure({ mode: 'off', volume: 0.35 });
    release?.();
    context.state = 'running';
    await playing;
    assert.equal(context.starts, 0);
    engine.dispose();
  } finally {
    fake.restore();
  }
});

test('a transient resume failure does not leave later feedback muted', async () => {
  const fake = installFakeAudioContext();
  try {
    const engine = new WritingSoundEngine();
    engine.configure({ mode: 'pen', volume: 0.42 });
    await engine.play(true);
    const context = fake.contexts[0];
    context.state = 'suspended';
    fake.setResumePromise(Promise.reject(new Error('autoplay denied')));
    await engine.play(true);
    assert.equal(context.master.gain.value, 0.42);
    fake.setResumePromise(Promise.resolve().then(() => { context.state = 'running'; }));
    await engine.play(true);
    assert.equal(context.starts, 2);
    engine.dispose();
  } finally {
    fake.restore();
  }
});
