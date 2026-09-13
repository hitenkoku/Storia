export const WRITING_SOUND_STORAGE_KEY = "storia.writing-sound.v1";
export const WRITING_SOUND_MODES = ["off", "pen", "typewriter"] as const;
export type WritingSoundMode = typeof WRITING_SOUND_MODES[number];

export type WritingSoundSettings = {
  mode: WritingSoundMode;
  volume: number;
};

export const DEFAULT_WRITING_SOUND_SETTINGS: WritingSoundSettings = {
  mode: "off",
  volume: 0.35,
};

export const normalizeWritingSoundSettings = (value: unknown): WritingSoundSettings => {
  if (typeof value !== "object" || value === null) return { ...DEFAULT_WRITING_SOUND_SETTINGS };
  const candidate = value as Partial<WritingSoundSettings>;
  const mode = WRITING_SOUND_MODES.includes(candidate.mode as WritingSoundMode)
    ? candidate.mode as WritingSoundMode
    : "off";
  const volume = typeof candidate.volume === "number" && Number.isFinite(candidate.volume)
    ? Math.min(1, Math.max(0, candidate.volume))
    : DEFAULT_WRITING_SOUND_SETTINGS.volume;
  return { mode, volume };
};

export const loadWritingSoundSettings = (storage?: Pick<Storage, "getItem">) => {
  try {
    const resolvedStorage = storage ?? localStorage;
    const stored = resolvedStorage.getItem(WRITING_SOUND_STORAGE_KEY);
    return stored ? normalizeWritingSoundSettings(JSON.parse(stored)) : { ...DEFAULT_WRITING_SOUND_SETTINGS };
  } catch {
    return { ...DEFAULT_WRITING_SOUND_SETTINGS };
  }
};

export const saveWritingSoundSettings = (
  settings: WritingSoundSettings,
  storage?: Pick<Storage, "setItem">,
) => {
  try {
    const resolvedStorage = storage ?? localStorage;
    resolvedStorage.setItem(WRITING_SOUND_STORAGE_KEY, JSON.stringify(normalizeWritingSoundSettings(settings)));
    return true;
  } catch {
    return false;
  }
};

type InputLike = {
  inputType?: string;
  isComposing?: boolean;
  data?: string | null;
};

export const isConfirmedWritingInput = (event: InputLike) =>
  event.isComposing !== true &&
  (event.inputType === "insertText" || event.inputType === "insertLineBreak") &&
  (event.inputType === "insertLineBreak" || (typeof event.data === "string" && event.data.length > 0));

export class WritingSoundGate {
  private lastPlayedAt = Number.NEGATIVE_INFINITY;
  private readonly minimumIntervalMs: number;

  constructor(minimumIntervalMs = 35) {
    this.minimumIntervalMs = minimumIntervalMs;
  }

  allow(now: number) {
    if (now - this.lastPlayedAt < this.minimumIntervalMs) return false;
    this.lastPlayedAt = now;
    return true;
  }

  reset() {
    this.lastPlayedAt = Number.NEGATIVE_INFINITY;
  }
}

export class WritingSoundEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private settings = { ...DEFAULT_WRITING_SOUND_SETTINGS };
  private active = new Set<AudioScheduledSourceNode>();
  private readonly gate = new WritingSoundGate();

  configure(settings: WritingSoundSettings) {
    this.settings = normalizeWritingSoundSettings(settings);
    if (this.master) this.master.gain.value = this.settings.mode === "off" ? 0 : this.settings.volume;
    if (this.settings.mode === "off") this.silence();
  }

  async play(preview = false) {
    if (this.settings.mode === "off") return;
    try {
      const now = performance.now();
      if (!preview && !this.gate.allow(now)) return;
      const context = this.ensureContext();
      if (context.state === "suspended") await context.resume();
      const mode = this.currentMode();
      if (mode === "off") return;
      if (mode === "pen") this.playPen(context);
      else this.playTypewriter(context);
    } catch {
      // Audio feedback is optional and must never interrupt text input.
      this.stopActiveSources();
      const mode = this.currentMode();
      if (this.master) this.master.gain.value = mode === "off" ? 0 : this.settings.volume;
    }
  }

  silence() {
    this.stopActiveSources();
    if (this.master) this.master.gain.value = 0;
  }

  private stopActiveSources() {
    for (const source of this.active) {
      try { source.stop(); } catch { /* Source may already have ended. */ }
    }
    this.active.clear();
    this.gate.reset();
  }

  private currentMode(): WritingSoundMode {
    return this.settings.mode;
  }

  dispose() {
    this.silence();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }

  private ensureContext() {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.master = this.context.createGain();
      this.master.gain.value = this.settings.volume;
      this.master.connect(this.context.destination);
    }
    return this.context;
  }

  private track(source: AudioScheduledSourceNode) {
    this.active.add(source);
    source.addEventListener("ended", () => this.active.delete(source), { once: true });
  }

  private noise(context: AudioContext, duration: number) {
    const buffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      const envelope = 1 - index / channel.length;
      channel[index] = (Math.random() * 2 - 1) * envelope;
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    this.track(source);
    return source;
  }

  private playPen(context: AudioContext) {
    const source = this.noise(context, 0.038);
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "bandpass";
    filter.frequency.value = 2400 + Math.random() * 450;
    filter.Q.value = 1.4;
    gain.gain.setValueAtTime(0.16, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.038);
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();
  }

  private playTypewriter(context: AudioContext) {
    const source = this.noise(context, 0.026);
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    filter.type = "highpass";
    filter.frequency.value = 1250;
    gain.gain.setValueAtTime(0.22, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.026);
    source.connect(filter).connect(gain).connect(this.master!);
    source.start();
  }
}
