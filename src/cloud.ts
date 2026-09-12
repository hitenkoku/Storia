import { invoke } from "@tauri-apps/api/core";

export type ConnectionStatus = { connected: boolean; endpoint?: string; username?: string };
export type UploadResult = { destination: string };

export interface CloudBackupProvider<Credentials> {
  status(): Promise<ConnectionStatus>;
  connect(credentials: Credentials): Promise<ConnectionStatus>;
  disconnect(): Promise<ConnectionStatus>;
  upload(filename: string, content: string): Promise<UploadResult>;
}

export type WebDavCredentials = {
  endpoint: string;
  username: string;
  password: string;
};

export const webDavProvider: CloudBackupProvider<WebDavCredentials> = {
  status: () => invoke<ConnectionStatus>("webdav_connection_status"),
  connect: (credentials) => invoke<ConnectionStatus>("connect_webdav", credentials),
  disconnect: () => invoke<ConnectionStatus>("disconnect_webdav"),
  upload: (filename, content) => invoke<UploadResult>("upload_webdav_backup", { filename, content }),
};

