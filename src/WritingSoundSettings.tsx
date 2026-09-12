import { Volume2 } from "lucide-react";
import type { WritingSoundMode, WritingSoundSettings as Settings } from "./writingSound";

const COPY = {
  ja: {
    title: "入力音",
    description: "本文を入力したときの短い音。初期状態はオフです。",
    kind: "音の種類",
    modes: { off: "オフ", pen: "筆記音", typewriter: "タイプライター音" },
    volume: "音量",
    preview: "試聴",
  },
  en: {
    title: "Writing sound",
    description: "A short sound for confirmed input in the body. Off by default.",
    kind: "Sound",
    modes: { off: "Off", pen: "Pen", typewriter: "Typewriter" },
    volume: "Volume",
    preview: "Preview",
  },
} as const;

export function WritingSoundSettings({
  locale,
  settings,
  onChange,
  onPreview,
}: {
  locale: "ja" | "en";
  settings: Settings;
  onChange: (settings: Settings) => void;
  onPreview: () => void;
}) {
  const text = COPY[locale];
  return (
    <details className="writing-sound-settings">
      <summary><Volume2 size={16} aria-hidden="true" />{text.title}</summary>
      <p>{text.description}</p>
      <label>
        <span>{text.kind}</span>
        <select
          value={settings.mode}
          onChange={(event) => onChange({ ...settings, mode: event.currentTarget.value as WritingSoundMode })}
        >
          <option value="off">{text.modes.off}</option>
          <option value="pen">{text.modes.pen}</option>
          <option value="typewriter">{text.modes.typewriter}</option>
        </select>
      </label>
      <label>
        <span>{text.volume}: {Math.round(settings.volume * 100)}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={settings.volume}
          disabled={settings.mode === "off"}
          onChange={(event) => onChange({ ...settings, volume: Number(event.currentTarget.value) })}
        />
      </label>
      <button type="button" onClick={onPreview} disabled={settings.mode === "off"}>
        <Volume2 size={15} aria-hidden="true" />{text.preview}
      </button>
    </details>
  );
}

