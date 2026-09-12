import { CloudUpload, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { backupFilename, createBackup } from "./backup";
import { webDavProvider, type ConnectionStatus } from "./cloud";
import type { WritingSoundSettings } from "./writingSound";

type Locale = "ja" | "en";
type PendingBackup = { filename: string; content: string; bytes: number; itemCount: number };
type CloudFailure = { kind?: string; message?: string };

const COPY = {
  ja: {
    title: "クラウドバックアップ",
    description: "原稿・リンク・履歴・設定を、手動でWebDAVへ保存します。",
    desktopOnly: "バックアップはStoriaデスクトップ版で利用できます。",
    endpoint: "WebDAVフォルダーURL",
    endpointPlaceholder: "https://cloud.example.com/remote.php/dav/files/me/Storia",
    username: "ユーザー名",
    password: "パスワード / アプリパスワード",
    connect: "接続する",
    reconnect: "再認証",
    disconnect: "接続解除",
    connected: "接続済み",
    secure: "パスワードはOSの資格情報ストアに保存されます。",
    prepare: "クラウドへバックアップ",
    confirmTitle: "アップロード前の確認",
    workspace: "ワークスペース",
    items: "件",
    destination: "保存先",
    filename: "ファイル名",
    size: "サイズ",
    upload: "この内容をアップロード",
    cancel: "キャンセル",
    uploading: "アップロード中…",
    success: "バックアップしました",
    retry: "再試行",
    unknownError: "バックアップ処理に失敗しました。",
    errors: {
      unauthorized: "認証が拒否されました。再認証してください。",
      permission: "このWebDAVフォルダーへの書き込みが許可されていません。",
      quota: "クラウド側の空き容量が不足しています。",
      offline: "WebDAVサーバーへ接続できません。ネットワークを確認してください。",
      server: "WebDAVサーバーでエラーが発生しました。",
      invalid_config: "WebDAVの設定を確認してください。HTTPSのフォルダーURLが必要です。",
      credential_store: "OSの資格情報ストアを利用できませんでした。",
      not_connected: "先にWebDAVへ接続してください。",
    },
  },
  en: {
    title: "Cloud backup",
    description: "Manually save writing, links, history, and settings to WebDAV.",
    desktopOnly: "Cloud backup is available in the Storia desktop app.",
    endpoint: "WebDAV folder URL",
    endpointPlaceholder: "https://cloud.example.com/remote.php/dav/files/me/Storia",
    username: "Username",
    password: "Password / app password",
    connect: "Connect",
    reconnect: "Reauthenticate",
    disconnect: "Disconnect",
    connected: "Connected",
    secure: "The password is stored in the operating system credential store.",
    prepare: "Back up to cloud",
    confirmTitle: "Confirm upload",
    workspace: "Workspace",
    items: "items",
    destination: "Destination",
    filename: "Filename",
    size: "Size",
    upload: "Upload this backup",
    cancel: "Cancel",
    uploading: "Uploading…",
    success: "Backup completed",
    retry: "Retry",
    unknownError: "The backup operation failed.",
    errors: {
      unauthorized: "Authentication was denied. Reauthenticate and try again.",
      permission: "This account cannot write to the selected WebDAV folder.",
      quota: "The cloud destination does not have enough available storage.",
      offline: "The WebDAV server could not be reached. Check your network.",
      server: "The WebDAV server returned an error.",
      invalid_config: "Check the WebDAV settings. An HTTPS folder URL is required.",
      credential_store: "The operating system credential store is unavailable.",
      not_connected: "Connect WebDAV before creating a backup.",
    },
  },
} as const;

const isDesktop = () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

const failureText = (error: unknown, locale: Locale) => {
  const copy = COPY[locale];
  const failure = typeof error === "object" && error !== null ? error as CloudFailure : {};
  if (failure.kind && failure.kind in copy.errors) {
    return copy.errors[failure.kind as keyof typeof copy.errors];
  }
  return failure.message || copy.unknownError;
};

export function CloudBackup({ workspace, locale, writingSound }: { workspace: { items: unknown[] }; locale: Locale; writingSound: WritingSoundSettings }) {
  const text = COPY[locale];
  const desktop = isDesktop();
  const [status, setStatus] = useState<ConnectionStatus>({ connected: false });
  const [showCredentials, setShowCredentials] = useState(false);
  const [endpoint, setEndpoint] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<PendingBackup | null>(null);
  const [completed, setCompleted] = useState<{ at: string; destination: string } | null>(null);

  useEffect(() => {
    if (!desktop) return;
    webDavProvider.status()
      .then((next) => {
        setStatus(next);
        setEndpoint(next.endpoint ?? "");
        setUsername(next.username ?? "");
        setShowCredentials(!next.connected);
      })
      .catch((cause) => {
        setShowCredentials(true);
        setError(failureText(cause, locale));
      });
  }, [desktop]);

  const connect = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const next = await webDavProvider.connect({ endpoint, username, password });
      setStatus(next);
      setPassword("");
      setShowCredentials(false);
    } catch (cause) {
      setError(failureText(cause, locale));
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setError("");
    try {
      const next = await webDavProvider.disconnect();
      setStatus(next);
      setPassword("");
      setPending(null);
      setShowCredentials(true);
    } catch (cause) {
      setError(failureText(cause, locale));
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    setError("");
    setCompleted(null);
    try {
      const filename = backupFilename();
      const content = await createBackup(workspace, { locale, writingSound });
      setPending({ filename, content, bytes: new TextEncoder().encode(content).byteLength, itemCount: workspace.items.length });
    } catch (cause) {
      setError(failureText(cause, locale));
    }
  };

  const upload = async () => {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      const result = await webDavProvider.upload(pending.filename, pending.content);
      setCompleted({ at: new Date().toISOString(), destination: result.destination });
      setPending(null);
    } catch (cause) {
      setError(failureText(cause, locale));
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="cloud-backup">
      <summary><CloudUpload size={16} aria-hidden="true" />{text.title}</summary>
      <p>{text.description}</p>
      {!desktop && <p className="cloud-notice">{text.desktopOnly}</p>}

      {desktop && status.connected && !showCredentials && (
        <div className="cloud-connection">
          <p><ShieldCheck size={16} aria-hidden="true" /><strong>{text.connected}</strong></p>
          <small>{status.username}<br />{status.endpoint}</small>
          <div className="cloud-actions">
            <button type="button" onClick={() => setShowCredentials(true)} disabled={busy}><RefreshCw size={14} />{text.reconnect}</button>
            <button type="button" onClick={disconnect} disabled={busy}><LogOut size={14} />{text.disconnect}</button>
          </div>
        </div>
      )}

      {desktop && showCredentials && (
        <form className="cloud-credentials" onSubmit={connect}>
          <label>{text.endpoint}<input type="url" required value={endpoint} placeholder={text.endpointPlaceholder} onChange={(event) => setEndpoint(event.currentTarget.value)} /></label>
          <label>{text.username}<input required autoComplete="username" value={username} onChange={(event) => setUsername(event.currentTarget.value)} /></label>
          <label>{text.password}<input type="password" required autoComplete="current-password" value={password} onChange={(event) => setPassword(event.currentTarget.value)} /></label>
          <small>{text.secure}</small>
          <div className="cloud-actions">
            <button className="cloud-primary" type="submit" disabled={busy}>{text.connect}</button>
            {status.connected && <button type="button" onClick={() => setShowCredentials(false)}>{text.cancel}</button>}
          </div>
        </form>
      )}

      {desktop && status.connected && !showCredentials && (
        <button className="cloud-primary cloud-prepare" type="button" onClick={prepare} disabled={busy}>{text.prepare}</button>
      )}

      {pending && (
        <section className="cloud-confirm" aria-labelledby="cloud-confirm-title">
          <h3 id="cloud-confirm-title">{text.confirmTitle}</h3>
          <dl>
            <div><dt>{text.workspace}</dt><dd>{pending.itemCount.toLocaleString(locale)} {text.items}</dd></div>
            <div><dt>{text.size}</dt><dd>{new Intl.NumberFormat(locale, { style: "unit", unit: "kilobyte", maximumFractionDigits: 1 }).format(pending.bytes / 1000)}</dd></div>
            <div><dt>{text.filename}</dt><dd>{pending.filename}</dd></div>
            <div><dt>{text.destination}</dt><dd>{status.endpoint}</dd></div>
          </dl>
          <div className="cloud-actions">
            <button className="cloud-primary" type="button" onClick={upload} disabled={busy}>{busy ? text.uploading : text.upload}</button>
            <button type="button" onClick={() => setPending(null)} disabled={busy}>{text.cancel}</button>
          </div>
        </section>
      )}

      {completed && <p className="cloud-success" role="status"><CheckResult />{text.success}<small>{new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(completed.at))}<br />{completed.destination}</small></p>}
      {error && <div className="cloud-error" role="alert"><span>{error}</span>{pending && <button type="button" onClick={upload} disabled={busy}>{text.retry}</button>}</div>}
    </details>
  );
}

function CheckResult() {
  return <ShieldCheck size={16} aria-hidden="true" />;
}
