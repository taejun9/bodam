use rust_xlsxwriter::{Color, Format, FormatAlign, FormatBorder, Workbook};

use super::constants::{HEADERS, MAX_FILE_BYTES, TARGET_SHEET};
use super::export_error::ContractExportError;
use super::export_model::{ContractExportFormat, ContractExportRow};
use super::export_verify::verify_generated_cells;

const COLUMN_WIDTH_PIXELS: u32 = 62;
const DEFAULT_ROW_HEIGHT: f64 = 15.0;
// The reference reports ~13.55 pt; rust_xlsxwriter stores its 18 px
// equivalent as 13.5 pt in worksheet XML.
const USED_ROW_HEIGHT: f64 = 13.55;

pub(super) fn build_xlsx(rows: &[ContractExportRow]) -> Result<Vec<u8>, ContractExportError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet
        .set_name(TARGET_SHEET)
        .map_err(|_| ContractExportError::generation_failed())?;
    worksheet.set_default_row_height(DEFAULT_ROW_HEIGHT);
    for column in 0..HEADERS.len() {
        worksheet
            .set_column_width_pixels(column as u16, COLUMN_WIDTH_PIXELS)
            .map_err(|_| ContractExportError::generation_failed())?;
    }

    let header = header_format();
    let first = first_data_format();
    let body = body_format();
    worksheet
        .set_row_height(0, USED_ROW_HEIGHT)
        .map_err(|_| ContractExportError::generation_failed())?;
    for (column, value) in HEADERS.iter().enumerate() {
        worksheet
            .write_string_with_format(0, column as u16, *value, &header)
            .map_err(|_| ContractExportError::generation_failed())?;
    }
    for (index, row) in rows.iter().enumerate() {
        let sheet_row = index as u32 + 1;
        let format = if index == 0 { &first } else { &body };
        worksheet
            .set_row_height(sheet_row, USED_ROW_HEIGHT)
            .map_err(|_| ContractExportError::generation_failed())?;
        for (column, value) in row.cells.values().iter().enumerate() {
            match value {
                Some(value) => {
                    worksheet.write_string_with_format(sheet_row, column as u16, *value, format)
                }
                None => worksheet.write_blank(sheet_row, column as u16, format),
            }
            .map_err(|_| ContractExportError::generation_failed())?;
        }
    }
    let bytes = workbook
        .save_to_buffer()
        .map_err(|_| ContractExportError::generation_failed())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(ContractExportError::file_too_large());
    }
    verify_generated_cells(ContractExportFormat::Xlsx, rows, &bytes)?;
    Ok(bytes)
}

fn base_format() -> Format {
    Format::new()
        .set_font_name("Calibri")
        .set_font_size(11)
        .set_background_color(Color::White)
        .unset_text_wrap()
}

fn header_format() -> Format {
    base_format()
        .set_border(FormatBorder::Thin)
        .set_border_color(Color::Black)
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter)
}

fn first_data_format() -> Format {
    body_format()
        .set_border_top(FormatBorder::Thin)
        .set_border_top_color(Color::Black)
}

fn body_format() -> Format {
    base_format()
        .set_border(FormatBorder::Thin)
        .set_border_color(Color::Red)
        .set_align(FormatAlign::VerticalCenter)
}

#[cfg(test)]
mod tests {
    use std::io::{Cursor, Read};

    use zip::ZipArchive;

    use super::build_xlsx;
    use crate::data_exchange::export_test_support::export_row;

    #[test]
    fn writes_formula_like_text_blank_styles_and_reference_formatting() {
        let mut first = export_row("xlsx-a", Some("2026-08-07"));
        first.cells.no = None;
        first.cells.affiliation = Some("=SUM(1, 1)".to_owned());
        let second = export_row("xlsx-b", None);

        let bytes = build_xlsx(&[first, second]).unwrap();
        let sheet = archive_text(&bytes, "xl/worksheets/sheet1.xml");
        let styles = archive_text(&bytes, "xl/styles.xml");
        let strings = archive_text(&bytes, "xl/sharedStrings.xml");

        assert!(!sheet.contains("<f>"));
        assert!(strings.contains("=SUM(1, 1)"));
        assert!(sheet.contains("r=\"A2\""));
        assert!(sheet.contains("defaultRowHeight=\"15\""));
        assert_eq!(sheet.matches("ht=\"13.5\"").count(), 3);
        assert!(sheet.contains("<col min=\"1\" max=\"21\""));
        let width = first_attribute(&sheet, "<col ", "width")
            .parse::<f64>()
            .unwrap();
        assert!((width - 8.851_559_638_977_05).abs() < 0.01);
        assert!(styles.contains("rgb=\"FFFF0000\""));
        assert!(styles.contains("rgb=\"FFFFFFFF\""));
        assert!(styles.contains("<left style=\"thin\"><color rgb=\"FF000000\"/></left>"));
        assert!(styles.contains("<left style=\"thin\"><color rgb=\"FFFF0000\"/></left>"));
        assert!(styles.contains("<top style=\"thin\"><color rgb=\"FF000000\"/></top>"));
        assert!(styles.contains("horizontal=\"center\" vertical=\"center\""));
        assert!(styles.contains("<alignment vertical=\"center\"/>"));
    }

    #[test]
    fn xml_control_text_round_trips_or_fails_with_a_value_free_error() {
        let mut row = export_row("control", None);
        row.cells.manager = Some("PRIVATE\0CONTROL".to_owned());

        match build_xlsx(&[row]) {
            Ok(bytes) => assert!(!bytes.is_empty()),
            Err(error) => {
                assert!(matches!(
                    error.code,
                    "EXPORT_GENERATION_FAILED" | "EXPORT_VERIFICATION_FAILED"
                ));
                assert!(!serde_json::to_string(&error).unwrap().contains("PRIVATE"));
            }
        }
    }

    fn archive_text(bytes: &[u8], name: &str) -> String {
        let mut archive = ZipArchive::new(Cursor::new(bytes)).unwrap();
        let mut file = archive.by_name(name).unwrap();
        let mut text = String::new();
        file.read_to_string(&mut text).unwrap();
        text
    }

    fn first_attribute<'a>(xml: &'a str, element: &str, attribute: &str) -> &'a str {
        let fragment = &xml[xml.find(element).unwrap()..];
        let prefix = format!("{attribute}=\"");
        let value = &fragment[fragment.find(&prefix).unwrap() + prefix.len()..];
        &value[..value.find('"').unwrap()]
    }
}
