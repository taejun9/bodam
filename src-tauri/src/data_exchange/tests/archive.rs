use crate::data_exchange::archive::preflight_xlsx;
use crate::data_exchange::constants::MAX_XLSX_SHARED_STRINGS;
use std::io::{Cursor, Write};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

#[test]
fn rejects_non_zip_and_truncated_archives() {
    assert_code(b"not an xlsx", "XLSX_SIGNATURE_INVALID");
    assert_code(b"PK\x03\x04truncated", "XLSX_ARCHIVE_INVALID");
}

#[test]
fn rejects_too_many_archive_entries() {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    for index in 0..1_001 {
        writer
            .start_file(format!("entry-{index}"), SimpleFileOptions::default())
            .unwrap();
    }
    let bytes = writer.finish().unwrap().into_inner();
    assert_code(&bytes, "XLSX_ARCHIVE_ENTRY_LIMIT");
}

#[test]
fn rejects_oversized_uncompressed_entry() {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    writer.start_file("large.bin", options).unwrap();
    writer.write_all(&vec![0_u8; 20 * 1024 * 1024 + 1]).unwrap();
    let bytes = writer.finish().unwrap().into_inner();
    assert!(bytes.len() < 10 * 1024 * 1024);
    assert_code(&bytes, "XLSX_ARCHIVE_ENTRY_TOO_LARGE");
}

#[test]
fn rejects_oversized_total_uncompressed_content() {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    let content = vec![0_u8; 17 * 1024 * 1024];
    for index in 0..3 {
        writer
            .start_file(format!("large-{index}.bin"), options)
            .unwrap();
        writer.write_all(&content).unwrap();
    }
    let bytes = writer.finish().unwrap().into_inner();
    assert_code(&bytes, "XLSX_ARCHIVE_TOTAL_TOO_LARGE");
}

#[test]
fn rejects_forged_declared_size_after_actual_entry_expands_past_limit() {
    let mut bytes =
        archive_with_deflated_entries(&[("xl/worksheets/sheet1.xml", 20 * 1024 * 1024 + 1)]);
    patch_declared_size(&mut bytes, "xl/worksheets/sheet1.xml", 1);

    assert!(bytes.len() < 10 * 1024 * 1024);
    assert_code(&bytes, "XLSX_ARCHIVE_ENTRY_TOO_LARGE");
}

#[test]
fn rejects_forged_declared_sizes_after_actual_total_expands_past_limit() {
    let mut bytes = archive_with_deflated_entries(&[
        ("xl/large-1.bin", 17 * 1024 * 1024),
        ("xl/large-2.bin", 17 * 1024 * 1024),
        ("xl/large-3.bin", 17 * 1024 * 1024),
    ]);
    for name in ["xl/large-1.bin", "xl/large-2.bin", "xl/large-3.bin"] {
        patch_declared_size(&mut bytes, name, 1);
    }

    assert!(bytes.len() < 10 * 1024 * 1024);
    assert_code(&bytes, "XLSX_ARCHIVE_TOTAL_TOO_LARGE");
}

#[test]
fn rejects_unsafe_and_non_ooxml_archives() {
    let mut unsafe_writer = ZipWriter::new(Cursor::new(Vec::new()));
    unsafe_writer
        .start_file("../outside", SimpleFileOptions::default())
        .unwrap();
    let unsafe_bytes = unsafe_writer.finish().unwrap().into_inner();
    assert_code(&unsafe_bytes, "XLSX_ARCHIVE_UNSAFE");

    let mut plain_writer = ZipWriter::new(Cursor::new(Vec::new()));
    plain_writer
        .start_file("plain.txt", SimpleFileOptions::default())
        .unwrap();
    let plain_bytes = plain_writer.finish().unwrap().into_inner();
    assert_code(&plain_bytes, "XLSX_STRUCTURE_INVALID");
}

#[test]
fn rejects_calamine_normalized_archive_name_collisions() {
    let xml = br#"<sst uniqueCount="0"></sst>"#;
    let bytes = archive_with_extra_entries(&[
        ("xl/sharedStrings.xml", xml.as_slice()),
        ("XL\\SHAREDSTRINGS.XML", xml.as_slice()),
    ]);

    assert_code(&bytes, "XLSX_ARCHIVE_UNSAFE");
}

#[test]
fn rejects_root_shared_string_reserve_above_cell_contract() {
    let xml = format!(r#"<sst uniqueCount="{}"></sst>"#, usize::MAX);
    let bytes = archive_with_extra_entries(&[("sharedStrings.xml", xml.as_bytes())]);

    assert_code(&bytes, "XLSX_SHARED_STRING_LIMIT");
}

#[test]
fn rejects_actual_shared_string_items_above_cell_contract() {
    let mut xml = String::from("<sst>");
    for _ in 0..=MAX_XLSX_SHARED_STRINGS {
        xml.push_str("<si/>");
    }
    xml.push_str("</sst>");
    let bytes = archive_with_extra_entries(&[("xl/sharedStrings.xml", xml.as_bytes())]);

    assert_code(&bytes, "XLSX_SHARED_STRING_LIMIT");
}

#[test]
fn rejects_shared_string_indices_that_calamine_would_alias_to_zero() {
    let invalid_indices = [
        "not-index".to_owned(),
        "-1".to_owned(),
        format!("{}0", usize::MAX),
    ];

    for index in invalid_indices {
        let xml = worksheet_with_shared_cell(&format!("<v>{index}</v>"));
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        assert_code(&bytes, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn accepts_decimal_and_empty_shared_string_indices() {
    for value in ["<v>0</v>", "<v>000</v>", "<v></v>", "<v/>"] {
        let xml = worksheet_with_shared_cell(value);
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        preflight_xlsx(&bytes).unwrap();
    }
}

#[test]
fn rejects_ambiguous_shared_string_index_payloads() {
    for value in [
        "<v><![CDATA[0]]></v>",
        "<v>&#48;</v>",
        "<v><index>0</index></v>",
        "<v>0<!-- split -->0</v>",
        "<v>0</v><v>0</v>",
    ] {
        let xml = worksheet_with_shared_cell(value);
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        assert_code(&bytes, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn rejects_implicit_numeric_text_coercion() {
    for value in ["not-number", "1x"] {
        let xml = worksheet_with_cell("", &format!("<v>{value}</v>"));
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        assert_code(&bytes, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn rejects_mismatched_and_ambiguous_text_cells() {
    for (attributes, value) in [
        (" t=\"s\"", "<is/>"),
        (" t=\"str\"", "<is/>"),
        (" t=\"n\"", "<is/>"),
        ("", "<is/>"),
        (" t=\"inlineStr\"", "<v>0</v>"),
        (" t=\"str\"", "<v><text>value</text></v>"),
        (" t=\"str\"", "<v>first</v><v>last</v>"),
    ] {
        let xml = worksheet_with_cell(attributes, value);
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        assert_code(&bytes, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn accepts_valid_text_empty_and_implicit_numeric_cells() {
    for (attributes, value) in [
        (" t=\"inlineStr\"", "<is/>"),
        (" t=\"inlineStr\"", ""),
        (" t=\"s\"", ""),
        ("", ""),
        ("", "<v/>"),
        ("", "<v>-1.25e3</v>"),
        (" t=\"str\"", "<v>safe &amp; sound</v>"),
        (" t=\"str\"", "<v/>"),
    ] {
        let xml = worksheet_with_cell(attributes, value);
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        preflight_xlsx(&bytes).unwrap();
    }
}

#[test]
fn rejects_duplicate_cell_types_and_worksheet_xml_errors() {
    for xml in [
        "<worksheet><sheetData><row><c t=\"n\" t=\"s\"><v>bad</v></c></row></sheetData></worksheet>",
        "<worksheet><sheetData broken></sheetData></worksheet>",
        "<worksheet><!-- bad--comment --><sheetData/></worksheet>",
        "<!DOCTYPE worksheet><worksheet><sheetData/></worksheet>",
        "<worksheet><!DOCTYPE worksheet><sheetData/></worksheet>",
        "<worksheet><sheetData>",
    ] {
        let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

        assert_code(&bytes, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn ignores_extension_c_elements_outside_sheet_data() {
    let xml = concat!(
        "<worksheet><sheetData/><extLst><ext>",
        "<x:c xmlns:x=\"urn:test\" t=\"s\"><v>not-index</v></x:c>",
        "</ext></extLst></worksheet>"
    );
    let bytes = archive_with_extra_entries(&[("custom-part.bin", xml.as_bytes())]);

    preflight_xlsx(&bytes).unwrap();
}

fn worksheet_with_shared_cell(value: &str) -> String {
    worksheet_with_cell(" t=\"s\"", value)
}

fn worksheet_with_cell(attributes: &str, value: &str) -> String {
    format!("<worksheet><sheetData><row><c{attributes}>{value}</c></row></sheetData></worksheet>")
}

fn assert_code(bytes: &[u8], expected: &str) {
    let error = preflight_xlsx(bytes).unwrap_err();
    assert_eq!(error.code, expected);
}

fn archive_with_deflated_entries(entries: &[(&str, usize)]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for name in ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"] {
        writer.start_file(name, options).unwrap();
    }
    for (name, size) in entries {
        writer.start_file(*name, options).unwrap();
        writer.write_all(&vec![b'x'; *size]).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

fn archive_with_extra_entries(entries: &[(&str, &[u8])]) -> Vec<u8> {
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    for name in ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml"] {
        writer.start_file(name, options).unwrap();
    }
    for (name, content) in entries {
        writer.start_file(*name, options).unwrap();
        writer.write_all(content).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

fn patch_declared_size(bytes: &mut [u8], target_name: &str, declared_size: u32) {
    let target = target_name.as_bytes();
    let positions = bytes
        .windows(target.len())
        .enumerate()
        .filter_map(|(position, value)| (value == target).then_some(position))
        .collect::<Vec<_>>();
    let mut patched = 0;
    for position in positions {
        if position >= 30 && &bytes[position - 30..position - 26] == b"PK\x03\x04" {
            bytes[position - 8..position - 4].copy_from_slice(&declared_size.to_le_bytes());
            patched += 1;
        } else if position >= 46 && &bytes[position - 46..position - 42] == b"PK\x01\x02" {
            bytes[position - 22..position - 18].copy_from_slice(&declared_size.to_le_bytes());
            patched += 1;
        }
    }
    assert_eq!(patched, 2, "local and central sizes must both be patched");
}
