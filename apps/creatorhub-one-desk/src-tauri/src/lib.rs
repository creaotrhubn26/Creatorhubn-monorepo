//! Creatorhub One Desk — Tauri backend.
//!
//! F0-scaffold: minimal entrypoint som starter Tauri-runtimet og registrerer
//! plugins (opener, dialog, updater). Faktiske commands kommer i F1+.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running Creatorhub One Desk");
}
