mod customer;
mod database;
mod error;

use std::fs;
use std::io;
#[cfg(feature = "e2e")]
use std::path::PathBuf;

use customer::commands::{create_customer, delete_customer, list_customers, update_customer};
use customer::CustomerRepository;
use tauri::Manager;

pub(crate) struct AppState {
    customers: CustomerRepository,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(|app| {
            #[cfg(feature = "e2e")]
            let database_path = e2e_database_path()?;
            #[cfg(not(feature = "e2e"))]
            let database_path = app.path().app_data_dir()?.join("bodam.sqlite3");

            let parent = database_path
                .parent()
                .ok_or_else(|| io::Error::other("BODAM database path is unavailable"))?;
            fs::create_dir_all(parent)
                .map_err(|_| io::Error::other("BODAM app data directory is unavailable"))?;
            let customers = CustomerRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            app.manage(AppState { customers });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_customers,
            create_customer,
            update_customer,
            delete_customer
        ])
        .run(tauri::generate_context!())
        .expect("BODAM desktop runtime failed");
}

#[cfg(feature = "e2e")]
fn e2e_database_path() -> io::Result<PathBuf> {
    let path = std::env::var_os("BODAM_E2E_DB_PATH")
        .map(PathBuf::from)
        .ok_or_else(|| io::Error::other("BODAM E2E database path is required"))?;

    if !path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("sqlite3") {
        return Err(io::Error::other("BODAM E2E database path is invalid"));
    }

    Ok(path)
}
