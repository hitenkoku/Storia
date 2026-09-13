# Manual cloud backup

Storia 0.2 introduces an explicit, one-shot backup of the whole workspace. It is a backup operation, not synchronization: Storia never uploads in the background and never changes local data when an upload fails.

## Initial provider decision

| Provider | Distribution requirements | Fit for the first backup slice |
| --- | --- | --- |
| Google Drive | OAuth application, redirect URI, consent configuration, and provider review for broad distribution | Good future adapter, but the release would depend on a publisher-managed cloud application |
| Dropbox | OAuth application, redirect URI, scoped app folder, and provider review for distribution | Good future adapter with the same publisher dependency |
| WebDAV | User supplies an HTTPS folder URL and an account or app password | Selected: works with user-controlled services and validates the full backup workflow without a Storia-operated cloud service |

The UI uses the `CloudBackupProvider` boundary in `src/cloud.ts`, while serialization stays provider-neutral in `src/backup.ts`. A later Google Drive or Dropbox adapter can reuse the same versioned artifact, confirmation UI, integrity check, and error categories.

## Backup artifact

`storia.workspace-backup` version 1 contains:

- every workspace item, including body, tags, growth status, continuation note, links, and directional link metadata;
- every revision and the selected item;
- non-secret settings, currently the interface locale and optional writing-sound preference;
- a creation timestamp and SHA-256 checksum over the canonical payload.

Credentials and provider configuration are excluded from the artifact. WebDAV credentials, including the endpoint and username, are serialized only inside the operating system credential store entry `com.hitenkoku.storia.cloud-backup` / `webdav`. The Windows build uses Windows Credential Manager; supported macOS and Linux builds use their native keychain service through `keyring`.

Backup filenames include UTC milliseconds and sort chronologically, for example `storia-backup-20260912T123456789Z.json`. Milliseconds prevent two backups prepared within one second from replacing each other.

## User flow

1. Open **Cloud backup** in the library panel.
2. Enter an HTTPS WebDAV folder URL, username, and password or app password. Storia validates the folder with `PROPFIND` before storing the credential.
3. Choose **Back up to cloud**. Storia prepares an immutable snapshot and shows its item count, encoded size, filename, and destination.
4. Confirm the upload. Storia sends one JSON file with `PUT` and reports the timestamp and exact destination.

Authentication, write permission, storage quota, offline, server, invalid configuration, and credential-store failures are shown separately. A failed upload keeps the prepared snapshot available through reauthentication and retry, and does not mutate the workspace. WebDAV redirects are rejected so the confirmed HTTPS destination cannot silently change.

The public browser build explains that this function requires the desktop app because secrets and network access are deliberately kept on the Rust side.

## Restore contract

`parseBackup` validates JSON shape, format, supported version, settings, workspace collections, and checksum before returning any data. Round-trip tests cover Japanese and English settings, current link/revision metadata, and a legacy workspace shape. A restore UI is intentionally deferred until its replacement and conflict behavior can be designed separately; the versioned artifact is already verifiable and restore-ready.

## Out of scope

- automatic or scheduled upload;
- bidirectional synchronization and conflict resolution;
- collaboration;
- multiple simultaneous providers;
- browser-side credential storage or upload.
