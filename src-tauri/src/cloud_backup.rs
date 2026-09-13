use reqwest::{Method, StatusCode, Url};
use serde::{Deserialize, Serialize};
use std::time::Duration;

const CREDENTIAL_SERVICE: &str = "com.hitenkoku.storia.cloud-backup";
const CREDENTIAL_ACCOUNT: &str = "webdav";

#[derive(Debug, Deserialize, Serialize)]
struct WebDavCredential {
    endpoint: String,
    username: String,
    password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStatus {
    connected: bool,
    endpoint: Option<String>,
    username: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadResult {
    destination: String,
}

#[derive(Debug, Serialize)]
pub struct CloudError {
    kind: &'static str,
    message: String,
}

impl CloudError {
    fn new(kind: &'static str, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }
}

fn entry() -> Result<keyring::Entry, CloudError> {
    keyring::Entry::new(CREDENTIAL_SERVICE, CREDENTIAL_ACCOUNT).map_err(|_| {
        CloudError::new(
            "credential_store",
            "Could not open the operating system credential store.",
        )
    })
}

fn validate_endpoint(endpoint: &str) -> Result<Url, CloudError> {
    let mut url = Url::parse(endpoint.trim())
        .map_err(|_| CloudError::new("invalid_config", "Enter a valid WebDAV folder URL."))?;
    if url.scheme() != "https" {
        return Err(CloudError::new(
            "invalid_config",
            "The WebDAV URL must use HTTPS.",
        ));
    }
    if url.username() != ""
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(CloudError::new(
            "invalid_config",
            "Do not include credentials, a query, or a fragment in the WebDAV URL.",
        ));
    }
    url.set_query(None);
    url.set_fragment(None);
    Ok(url)
}

fn destination_url(endpoint: &str, filename: &str) -> Result<Url, CloudError> {
    if filename.is_empty()
        || filename.len() > 160
        || filename.contains(['/', '\\'])
        || !filename.ends_with(".json")
    {
        return Err(CloudError::new(
            "invalid_config",
            "The backup filename is invalid.",
        ));
    }
    let mut url = validate_endpoint(endpoint)?;
    url.path_segments_mut()
        .map_err(|_| {
            CloudError::new(
                "invalid_config",
                "The WebDAV URL cannot be used as a folder.",
            )
        })?
        .pop_if_empty()
        .push(filename);
    Ok(url)
}

fn map_status(status: StatusCode) -> CloudError {
    match status.as_u16() {
        401 => CloudError::new(
            "unauthorized",
            "Authentication was denied. Reconnect and try again.",
        ),
        403 => CloudError::new(
            "permission",
            "This account cannot write to the selected WebDAV folder.",
        ),
        507 => CloudError::new(
            "quota",
            "The server rejected the backup because storage is unavailable.",
        ),
        _ => CloudError::new(
            "server",
            format!("The WebDAV server returned HTTP {}.", status.as_u16()),
        ),
    }
}

fn map_request(error: reqwest::Error) -> CloudError {
    if error.is_timeout() || error.is_connect() {
        CloudError::new("offline", "Could not reach the WebDAV server.")
    } else {
        CloudError::new("server", "The WebDAV request failed.")
    }
}

fn client() -> Result<reqwest::Client, CloudError> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(30))
        .user_agent(concat!("Storia/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|_| CloudError::new("server", "Could not initialize the WebDAV client."))
}

fn load_credential() -> Result<WebDavCredential, CloudError> {
    let secret = entry()?.get_password().map_err(|error| match error {
        keyring::Error::NoEntry => {
            CloudError::new("not_connected", "Connect a WebDAV account first.")
        }
        _ => CloudError::new(
            "credential_store",
            "Could not read credentials from the operating system store.",
        ),
    })?;
    serde_json::from_str(&secret)
        .map_err(|_| CloudError::new("credential_store", "Stored WebDAV credentials are invalid."))
}

#[tauri::command]
pub async fn connect_webdav(
    endpoint: String,
    username: String,
    password: String,
) -> Result<ConnectionStatus, CloudError> {
    let endpoint_url = validate_endpoint(&endpoint)?;
    if username.trim().is_empty() || password.is_empty() {
        return Err(CloudError::new(
            "invalid_config",
            "Enter both a username and password.",
        ));
    }
    let response = client()?
        .request(
            Method::from_bytes(b"PROPFIND").expect("valid method"),
            endpoint_url.clone(),
        )
        .header("Depth", "0")
        .basic_auth(username.trim(), Some(&password))
        .send()
        .await
        .map_err(map_request)?;
    if !(response.status().is_success() || response.status().as_u16() == 207) {
        return Err(map_status(response.status()));
    }
    let credential = WebDavCredential {
        endpoint: endpoint_url.to_string().trim_end_matches('/').to_string(),
        username: username.trim().to_string(),
        password,
    };
    let secret = serde_json::to_string(&credential).map_err(|_| {
        CloudError::new(
            "credential_store",
            "Could not prepare credentials for secure storage.",
        )
    })?;
    entry()?.set_password(&secret).map_err(|_| {
        CloudError::new(
            "credential_store",
            "Could not save credentials in the operating system store.",
        )
    })?;
    Ok(ConnectionStatus {
        connected: true,
        endpoint: Some(credential.endpoint),
        username: Some(credential.username),
    })
}

#[tauri::command]
pub fn webdav_connection_status() -> Result<ConnectionStatus, CloudError> {
    match load_credential() {
        Ok(credential) => Ok(ConnectionStatus {
            connected: true,
            endpoint: Some(credential.endpoint),
            username: Some(credential.username),
        }),
        Err(error) if error.kind == "not_connected" => Ok(ConnectionStatus {
            connected: false,
            endpoint: None,
            username: None,
        }),
        Err(error) => Err(error),
    }
}

#[tauri::command]
pub fn disconnect_webdav() -> Result<ConnectionStatus, CloudError> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(ConnectionStatus {
            connected: false,
            endpoint: None,
            username: None,
        }),
        Err(_) => Err(CloudError::new(
            "credential_store",
            "Could not remove credentials from the operating system store.",
        )),
    }
}

#[tauri::command]
pub async fn upload_webdav_backup(
    filename: String,
    content: String,
) -> Result<UploadResult, CloudError> {
    let credential = load_credential()?;
    let destination = destination_url(&credential.endpoint, &filename)?;
    let response = client()?
        .put(destination.clone())
        .header("Content-Type", "application/json; charset=utf-8")
        .basic_auth(&credential.username, Some(&credential.password))
        .body(content)
        .send()
        .await
        .map_err(map_request)?;
    if !response.status().is_success() {
        return Err(map_status(response.status()));
    }
    Ok(UploadResult {
        destination: destination.to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn endpoint_requires_https_and_excludes_embedded_secrets() {
        assert!(validate_endpoint("https://cloud.example.test/dav/backups").is_ok());
        assert_eq!(
            validate_endpoint("http://cloud.example.test/dav")
                .unwrap_err()
                .kind,
            "invalid_config"
        );
        assert_eq!(
            validate_endpoint("https://user:secret@cloud.example.test/dav")
                .unwrap_err()
                .kind,
            "invalid_config"
        );
    }

    #[test]
    fn destination_encodes_filename_and_keeps_folder_path() {
        let result = destination_url(
            "https://cloud.example.test/dav/backups/",
            "storia-backup-20260912T123456789Z.json",
        )
        .unwrap();
        assert_eq!(
            result.as_str(),
            "https://cloud.example.test/dav/backups/storia-backup-20260912T123456789Z.json"
        );
        assert!(destination_url("https://cloud.example.test/dav", "../secret.json").is_err());
    }

    #[test]
    fn response_errors_are_stable_categories() {
        assert_eq!(map_status(StatusCode::UNAUTHORIZED).kind, "unauthorized");
        assert_eq!(map_status(StatusCode::FORBIDDEN).kind, "permission");
        assert_eq!(map_status(StatusCode::INSUFFICIENT_STORAGE).kind, "quota");
        assert_eq!(map_status(StatusCode::PAYLOAD_TOO_LARGE).kind, "server");
        assert_eq!(map_status(StatusCode::INTERNAL_SERVER_ERROR).kind, "server");
    }
}
