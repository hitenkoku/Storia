mod cloud_backup;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            cloud_backup::connect_webdav,
            cloud_backup::webdav_connection_status,
            cloud_backup::disconnect_webdav,
            cloud_backup::upload_webdav_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
