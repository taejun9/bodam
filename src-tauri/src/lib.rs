mod backup;
mod consultation;
mod coverage;
mod customer;
mod data_exchange;
mod database;
#[cfg(feature = "e2e")]
mod e2e_backup_paths;
#[cfg(feature = "e2e")]
mod e2e_paths;
mod error;
mod family;
mod insurance;
mod schedule;
mod settings;
mod text;

use std::fs;
use std::io;
#[cfg(feature = "e2e")]
use std::path::PathBuf;
use std::sync::Arc;

use backup::{
    acknowledge_restore_startup, check_daily_backup, choose_backup_directory,
    choose_restore_backup, create_manual_backup, discard_restore_preview, exit_without_backup,
    load_backup_status, prepare_backup_restore, restart_for_backup_restore, retry_exit_backup,
    use_default_backup_directory, BackupRuntime,
};
use consultation::commands::{
    create_consultation, delete_consultation, list_consultations, update_consultation,
};
use consultation::ConsultationRepository;
use coverage::benchmark::commands::{
    create_coverage_benchmark, delete_coverage_benchmark, list_coverage_benchmarks,
    update_coverage_benchmark,
};
use coverage::commands::{
    create_coverage, delete_coverage, delete_coverage_category, list_coverage_categories,
    list_coverages, update_coverage, update_coverage_category,
};
use coverage::CoverageRepository;
use customer::commands::{create_customer, delete_customer, list_customers, update_customer};
use customer::CustomerRepository;
use data_exchange::{
    choose_contract_import_file, commit_contract_import, load_contract_export_summary,
    load_contract_import_context, save_contract_export, DataExchangeRepository,
};
use family::commands::{
    add_family_membership, create_family, delete_family, delete_family_membership, list_families,
    list_family_memberships, update_family, update_family_membership,
};
use family::FamilyRepository;
use insurance::commands::{
    create_insurance_policy, delete_insurance_policy, list_insurance_policies,
    update_insurance_policy,
};
use insurance::InsurancePolicyRepository;
use schedule::commands::{
    create_schedule, delete_schedule, list_schedules, set_schedule_completed, update_schedule,
};
use schedule::ScheduleRepository;
use settings::commands::{load_app_settings, update_app_settings};
use settings::SettingsRepository;
use tauri::Manager;

pub(crate) struct AppState {
    coverages: CoverageRepository,
    consultations: ConsultationRepository,
    customers: CustomerRepository,
    data_exchange: Arc<DataExchangeRepository>,
    families: FamilyRepository,
    insurance_policies: InsurancePolicyRepository,
    schedules: ScheduleRepository,
    settings: SettingsRepository,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default();
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(
        |app, _second_instance_args, _second_instance_cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        },
    ));
    let builder = builder.plugin(tauri_plugin_dialog::init());
    #[cfg(feature = "e2e")]
    let builder = builder
        .plugin(tauri_plugin_wdio::init())
        .plugin(tauri_plugin_wdio_webdriver::init());

    builder
        .setup(|app| {
            #[cfg(feature = "e2e")]
            let database_path = e2e_database_path()?;
            #[cfg(feature = "e2e")]
            let app_data_dir = e2e_backup_paths::validate_app_data_directory(std::env::var_os(
                "BODAM_E2E_DB_PATH",
            ))?;
            #[cfg(not(feature = "e2e"))]
            let app_data_dir = app.path().app_data_dir()?;
            #[cfg(not(feature = "e2e"))]
            let database_path = app_data_dir.join("bodam.sqlite3");

            fs::create_dir_all(&app_data_dir)
                .map_err(|_| io::Error::other("BODAM app data directory is unavailable"))?;
            let _ =
                backup::apply_pending_restore(&database_path, &app_data_dir, chrono::Utc::now())
                    .map_err(|_| io::Error::other("BODAM pending restore failed"))?;
            let startup = backup::read_startup_status(&app_data_dir)
                .map_err(|_| io::Error::other("BODAM restore status is unavailable"))?;
            let customers = CustomerRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let data_exchange = Arc::new(
                DataExchangeRepository::open(&database_path)
                    .map_err(|_| io::Error::other("BODAM database initialization failed"))?,
            );
            let consultations = ConsultationRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let insurance_policies = InsurancePolicyRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let coverages = CoverageRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let families = FamilyRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let schedules = ScheduleRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let settings = SettingsRepository::open(&database_path)
                .map_err(|_| io::Error::other("BODAM database initialization failed"))?;
            let backup = BackupRuntime::open(
                database_path,
                app_data_dir,
                env!("CARGO_PKG_VERSION").to_owned(),
                startup,
            )
            .map_err(|_| io::Error::other("BODAM backup initialization failed"))?;
            app.manage(AppState {
                coverages,
                consultations,
                customers,
                data_exchange,
                families,
                insurance_policies,
                schedules,
                settings,
            });
            app.manage(backup);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            list_customers,
            create_customer,
            update_customer,
            delete_customer,
            choose_contract_import_file,
            load_contract_import_context,
            commit_contract_import,
            load_contract_export_summary,
            save_contract_export,
            list_consultations,
            create_consultation,
            update_consultation,
            delete_consultation,
            list_insurance_policies,
            create_insurance_policy,
            update_insurance_policy,
            delete_insurance_policy,
            list_coverage_categories,
            update_coverage_category,
            delete_coverage_category,
            list_coverages,
            create_coverage,
            update_coverage,
            delete_coverage,
            list_coverage_benchmarks,
            create_coverage_benchmark,
            update_coverage_benchmark,
            delete_coverage_benchmark,
            list_families,
            create_family,
            update_family,
            delete_family,
            list_family_memberships,
            add_family_membership,
            update_family_membership,
            delete_family_membership,
            list_schedules,
            create_schedule,
            update_schedule,
            set_schedule_completed,
            delete_schedule,
            load_app_settings,
            update_app_settings,
            load_backup_status,
            acknowledge_restore_startup,
            choose_backup_directory,
            use_default_backup_directory,
            create_manual_backup,
            choose_restore_backup,
            discard_restore_preview,
            prepare_backup_restore,
            restart_for_backup_restore,
            check_daily_backup,
            retry_exit_backup,
            exit_without_backup,
        ])
        .build(tauri::generate_context!())
        .expect("BODAM desktop runtime failed")
        .run(backup::handle_run_event);
}

#[cfg(feature = "e2e")]
fn e2e_database_path() -> io::Result<PathBuf> {
    e2e_paths::validate_database_path(std::env::var_os("BODAM_E2E_DB_PATH"))
}
