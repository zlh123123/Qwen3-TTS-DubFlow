#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;

fn main() {
    let mut backend_child = backend::spawn_backend_sidecar();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(child) = backend_child.as_mut() {
                let _ = child.kill();
            }
        }
    });
}
