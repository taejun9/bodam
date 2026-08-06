# Windows E2E evidence boundary

## Hosted runner

`.github/workflows/tauri-e2e-windows.yml` builds an E2E-only release binary and runs
the embedded WebDriver customer flow on GitHub-hosted Windows. A passing run proves
the workflow, WebView2 interaction path, Tauri IPC, and temporary SQLite behavior in
that hosted environment.

## Offline VM

Offline Windows acceptance is separate evidence. Record the VM image/version,
network-disabled state, installer artifact hash, install result, application launch,
customer create/update/search/exclude result, restart persistence result, and log
location in the active Exec Plan. A hosted-runner pass must not be reported as an
offline installer or offline VM pass.

Both environments use synthetic customer data only. The E2E feature requires an
absolute `BODAM_E2E_DB_PATH`, and the runner deletes that temporary database after
the test. Production builds omit the feature, embedded server, environment override,
and WebDriver capability.
