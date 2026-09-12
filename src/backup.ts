export const BACKUP_FORMAT = "storia.workspace-backup";
export const BACKUP_VERSION = 1;

export type BackupSettings = {
  locale: "ja" | "en";
  writingSound?: {
    mode: "off" | "pen" | "typewriter";
    volume: number;
  };
};

export type StoriaBackup<T = unknown> = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  checksum: string;
  workspace: T;
  settings: BackupSettings;
};

const canonicalPayload = <T>(createdAt: string, workspace: T, settings: BackupSettings) =>
  JSON.stringify({ format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, workspace, settings });

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const hasWorkspaceShape = (value: unknown): value is { items: unknown[]; revisions: unknown[] } =>
  typeof value === "object" && value !== null &&
  Array.isArray((value as { items?: unknown }).items) &&
  Array.isArray((value as { revisions?: unknown }).revisions);

export const createBackup = async <T>(workspace: T, settings: BackupSettings, now = new Date()) => {
  const createdAt = now.toISOString();
  const payload = canonicalPayload(createdAt, workspace, settings);
  const backup: StoriaBackup<T> = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt,
    checksum: await sha256(payload),
    workspace,
    settings,
  };
  return `${JSON.stringify(backup, null, 2)}\n`;
};

export const parseBackup = async <T = unknown>(source: string): Promise<StoriaBackup<T>> => {
  let value: unknown;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error("invalid_json");
  }
  if (typeof value !== "object" || value === null) throw new Error("invalid_backup");
  const backup = value as Partial<StoriaBackup<T>>;
  if (backup.format !== BACKUP_FORMAT) throw new Error("invalid_format");
  if (backup.version !== BACKUP_VERSION) throw new Error("unsupported_version");
  if (typeof backup.createdAt !== "string" || !Number.isFinite(Date.parse(backup.createdAt))) throw new Error("invalid_backup");
  if (!hasWorkspaceShape(backup.workspace)) throw new Error("invalid_workspace");
  if (!backup.settings || (backup.settings.locale !== "ja" && backup.settings.locale !== "en")) throw new Error("invalid_settings");
  if (typeof backup.checksum !== "string") throw new Error("invalid_checksum");
  const expected = await sha256(canonicalPayload(backup.createdAt, backup.workspace, backup.settings));
  if (backup.checksum !== expected) throw new Error("checksum_mismatch");
  return backup as StoriaBackup<T>;
};

export const backupFilename = (date = new Date()) => {
  const stamp = date.toISOString().replace(/[-:.]/g, "");
  return `storia-backup-${stamp}.json`;
};
