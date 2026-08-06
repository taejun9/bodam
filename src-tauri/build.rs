fn main() {
    println!("cargo:rerun-if-changed=capabilities");

    let capability = if std::env::var_os("CARGO_FEATURE_E2E").is_some() {
        "capabilities/e2e.json"
    } else {
        "capabilities/default.json"
    };

    tauri_build::try_build(tauri_build::Attributes::new().capabilities_path_pattern(capability))
        .expect("failed to build BODAM desktop context");
}
