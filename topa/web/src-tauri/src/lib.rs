#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|_app| {
            // NFC exists only on the phone app; desktop builds do not even compile the plugin
            #[cfg(mobile)]
            _app.handle().plugin(tauri_plugin_nfc::init())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running the TOPA app");
}
