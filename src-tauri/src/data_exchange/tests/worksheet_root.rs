use std::io::{Cursor, Read, Write};

use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::helpers::valid_xlsx;
use crate::data_exchange::archive::preflight_xlsx;
use crate::data_exchange::parser::parse_import_bytes;

#[derive(Clone, Copy)]
enum WrapperComment {
    None,
    BeforeRoot,
    InsideRoot,
}

#[test]
fn rejects_wrapped_target_worksheet_before_shared_index_coercion() {
    let bytes = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "source-value").unwrap();
    });
    let wrapped = rewrite_archive(&bytes, true, WrapperComment::None, None);

    let error = parse_import_bytes("wrapped.xlsx", &wrapped).unwrap_err();

    assert_eq!(error.code, "XLSX_STRUCTURE_INVALID");
}

#[test]
fn rejects_malformed_wrapper_before_nested_sheet_data() {
    let bytes = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "source-value").unwrap();
    });
    for comment in [WrapperComment::BeforeRoot, WrapperComment::InsideRoot] {
        let wrapped = rewrite_archive(&bytes, true, comment, None);
        let error = parse_import_bytes("malformed-wrapper.xlsx", &wrapped).unwrap_err();
        assert_eq!(error.code, "XLSX_STRUCTURE_INVALID");
    }
}

#[test]
fn allows_nonworksheet_xml_without_sheet_data() {
    let bytes = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "source-value").unwrap();
    });
    let with_metadata = rewrite_archive(
        &bytes,
        false,
        WrapperComment::None,
        Some((
            "custom/metadata.xml",
            b"<metadata><value>synthetic</value></metadata>",
        )),
    );

    preflight_xlsx(&with_metadata).unwrap();
}

fn rewrite_archive(
    bytes: &[u8],
    wrap_sheet: bool,
    comment: WrapperComment,
    extra: Option<(&str, &[u8])>,
) -> Vec<u8> {
    let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
    let mut writer = ZipWriter::new(Cursor::new(Vec::new()));
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).unwrap();
        let name = entry.name().to_owned();
        let mut content = Vec::new();
        entry.read_to_end(&mut content).unwrap();
        if wrap_sheet && name == "xl/worksheets/sheet1.xml" {
            content = wrapped_sheet_with_invalid_shared_index(&content, comment);
        }
        writer.start_file(name, options).unwrap();
        writer.write_all(&content).unwrap();
    }
    if let Some((name, content)) = extra {
        writer.start_file(name, options).unwrap();
        writer.write_all(content).unwrap();
    }
    writer.finish().unwrap().into_inner()
}

fn wrapped_sheet_with_invalid_shared_index(content: &[u8], comment: WrapperComment) -> Vec<u8> {
    let mut xml = String::from_utf8(content.to_vec()).unwrap();
    let cell = xml.find("r=\"A2\"").unwrap();
    let value_start = cell + xml[cell..].find("<v>").unwrap() + "<v>".len();
    let value_end = value_start + xml[value_start..].find("</v>").unwrap();
    xml.replace_range(value_start..value_end, "not-index");

    let root = xml.find("<worksheet").unwrap();
    let wrapper = if matches!(comment, WrapperComment::InsideRoot) {
        "<wrapper><!-- invalid--comment -->"
    } else {
        "<wrapper>"
    };
    if matches!(comment, WrapperComment::BeforeRoot) {
        xml.insert_str(root, "<!-- invalid--comment -->");
    }
    let root = xml.find("<worksheet").unwrap();
    xml.insert_str(root, wrapper);
    let end = xml.rfind("</worksheet>").unwrap() + "</worksheet>".len();
    xml.insert_str(end, "</wrapper>");
    xml.into_bytes()
}
