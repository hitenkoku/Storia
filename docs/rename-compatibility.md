# Fumitoria rename compatibility

Storia is now named Fumitoria. App labels, the HTML/window title, package names, release-workflow copy, and current documentation use the new name. Newly created backup files use the `fumitoria-backup-` prefix; their data format is unchanged.

The published Storia v0.1.0 packages and `docs/releases/v0.1.0.md` are historical records. This change keeps version 0.1.0 and does not publish a new release. GitHub repository links remain `https://github.com/hitenkoku/Storia`, and the website remains `https://hitenkoku.github.io/Storia/`.

## Identifiers retained intentionally

| Purpose | Retained value |
| --- | --- |
| Tauri bundle identifier | `com.hitenkoku.storia` |
| Workspace storage | `storia.workspace.v1` |
| Locale storage | `storia.locale.v1` |
| Writing sound storage | `storia.writing-sound.v1` |
| Backup format and version | `storia.workspace-backup`, version `1` |
| OS credential service | `com.hitenkoku.storia.cloud-backup` (account `webdav`) |
| WiX MSI Upgrade Code | `1f16aa03-8678-5f0b-beea-b79db0556a3f` |

These values preserve the existing data and credential namespaces and backup parsing contract. Renaming them would require a separate migration. Existing WebDAV folder URLs are not rewritten. The legacy `STORIA_TEST_URL` browser-test environment variable is also retained.

The MSI Upgrade Code is explicitly pinned in `bundle.windows.wix.upgradeCode`. It is UUIDv5 of `Storia.exe.app.x64` in the DNS namespace, matching the old configuration's CLI output. [Tauri recommends pinning this value when changing the product name](https://v2.tauri.app/reference/config/#upgradecode). Verify the override with `npm run tauri -- inspect wix-upgrade-code`; the newly derived Fumitoria default is not the code to use.

## Verification limits

Source/configuration checks, backup compatibility checks, unit tests, frontend builds, and Cargo checks do not verify installation upgrades. End-to-end upgrades from installed Storia packages remain unverified on real machines, including WiX MSI, NSIS, macOS, and Linux. Installer paths, shortcuts, uninstall entries, and persistence of manuscripts, settings, and OS credentials after an actual upgrade still require platform testing before a future release. No native upgrade or new release is performed as part of this rename.

## NSIS migration risk before the next distribution (R1)

The [Tauri CLI 2.11.4 NSIS template](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi#L66) derives uninstall registration and previous-install detection from the product name. Renaming may therefore leave Storia installed alongside Fumitoria. Its [uninstall data-removal code](https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.4/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi#L868) can delete the APPDATA and LOCALAPPDATA directories for the bundle identifier when data deletion is selected outside update mode. Because both names share that identifier, the old uninstaller could delete Fumitoria's manuscript storage. This is an inference from the upstream template, not an observed installation or data-loss result; real-machine behavior remains unverified. No new installer is distributed in this change.

Before the next NSIS distribution, verify detection of an installed Storia version and its replacement in the appropriate update mode on real machines, including retained manuscripts/settings and removal of obsolete uninstall entries. Implement any necessary migration handling before claiming NSIS upgrade compatibility; this documentation change does not implement it. Back up manuscripts before migration, avoid using both versions simultaneously, and **do not select data deletion when uninstalling the old Storia version**, because the storage is shared.
