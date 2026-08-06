use super::helpers::{csv_bytes, row_with};
use crate::data_exchange::constants::{HEADERS, MAX_FILE_BYTES};
use crate::data_exchange::model::ImportSourceRow;
use crate::data_exchange::parser::{parse_import_bytes, parse_import_path};
use std::collections::BTreeSet;
use std::path::Path;

#[test]
fn serializes_the_strict_named_dto_contract() {
    let parsed = parse_import_bytes("synthetic.csv", &csv_bytes(&[row_with("001")])).unwrap();
    let value = serde_json::to_value(parsed).unwrap();
    assert_eq!(value["basename"], "synthetic.csv");
    assert_eq!(value["format"], "csv");
    assert_eq!(value["rows"][0]["sourceRow"], 2);
    assert_eq!(value["rows"][0]["format"], "csv");
    assert_eq!(value["rows"][0]["cells"]["no"], "001");
    let actual = value["rows"][0]["cells"]
        .as_object()
        .unwrap()
        .keys()
        .map(String::as_str)
        .collect::<BTreeSet<_>>();
    let expected = [
        "no",
        "collectionReflectedOn",
        "affiliation",
        "manager",
        "collectionCode",
        "contract",
        "insurer",
        "productName",
        "policyNumber",
        "contractedOn",
        "status",
        "finalPaymentMonth",
        "paymentSequence",
        "paymentPremium",
        "contractor",
        "insured",
        "coverageStartsOn",
        "coverageEndsOn",
        "collectionMethod",
        "paymentTerm",
        "originalRecruiterName",
    ]
    .into_iter()
    .collect::<BTreeSet<_>>();
    assert_eq!(actual, expected);
}

#[test]
fn deserializes_rows_and_rejects_unknown_fields() {
    let parsed = parse_import_bytes("synthetic.csv", &csv_bytes(&[row_with("001")])).unwrap();
    let mut row = serde_json::to_value(&parsed.rows[0]).unwrap();
    let decoded: ImportSourceRow = serde_json::from_value(row.clone()).unwrap();
    assert_eq!(decoded, parsed.rows[0]);

    row.as_object_mut()
        .unwrap()
        .insert("unexpected".to_owned(), serde_json::Value::Bool(true));
    assert!(serde_json::from_value::<ImportSourceRow>(row).is_err());

    let mut cells = serde_json::to_value(&parsed.rows[0]).unwrap();
    cells["cells"]["unexpected"] = serde_json::Value::Bool(true);
    assert!(serde_json::from_value::<ImportSourceRow>(cells).is_err());
}

#[test]
fn fatal_errors_do_not_serialize_paths_or_source_values() {
    let marker = "CUSTOMER_SECRET_MARKER";
    let mut bytes = b"\xEF\xBB\xBF".to_vec();
    bytes.extend_from_slice(format!("{marker},{}\r\n", HEADERS[1..].join(",")).as_bytes());
    bytes.extend_from_slice(format!("{marker},{}\r\n", vec![""; 20].join(",")).as_bytes());
    let error = parse_import_bytes("private-contract.csv", &bytes).unwrap_err();
    let json = serde_json::to_string(&error).unwrap();

    assert_eq!(error.code, "HEADER_INVALID");
    assert!(!json.contains(marker));
    assert!(!json.contains("private-contract.csv"));
    assert!(!error.to_string().contains(marker));
}

#[test]
fn rejects_unsupported_extensions_and_file_size_before_parsing() {
    let unsupported = parse_import_bytes("file.xls", b"").unwrap_err();
    assert_eq!(unsupported.code, "UNSUPPORTED_FILE_FORMAT");

    let oversized = vec![0_u8; MAX_FILE_BYTES as usize + 1];
    let error = parse_import_bytes("file.csv", &oversized).unwrap_err();
    assert_eq!(error.code, "FILE_TOO_LARGE");

    let invalid_name =
        parse_import_bytes("private\\file.csv", &csv_bytes(&[row_with("1")])).unwrap_err();
    assert_eq!(invalid_name.code, "FILE_NAME_UNAVAILABLE");
}

#[test]
fn parses_workspace_synthetic_fixtures_through_the_path_boundary() {
    let fixture_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../tests/fixtures/synthetic");
    for basename in [
        "synthetic-contracts-valid.xlsx",
        "synthetic-contracts-valid.csv",
    ] {
        let parsed = parse_import_path(&fixture_root.join(basename)).unwrap();
        assert_eq!(parsed.basename, basename);
        assert!(!parsed.rows.is_empty());
        assert!(parsed.issues.is_empty());
    }
}
