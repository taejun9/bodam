use crate::data_exchange::constants::{HEADERS, TARGET_SHEET};
use csv::{Terminator, WriterBuilder};
use rust_xlsxwriter::{Workbook, Worksheet};

pub(super) fn csv_bytes(rows: &[Vec<String>]) -> Vec<u8> {
    let mut writer = WriterBuilder::new()
        .terminator(Terminator::CRLF)
        .flexible(true)
        .from_writer(Vec::new());
    writer.write_record(HEADERS).unwrap();
    for row in rows {
        writer.write_record(row).unwrap();
    }
    let payload = writer.into_inner().unwrap();
    let mut bytes = b"\xEF\xBB\xBF".to_vec();
    bytes.extend(payload);
    bytes
}

pub(super) fn row_with(first: &str) -> Vec<String> {
    let mut row = vec![String::new(); HEADERS.len()];
    row[0] = first.to_owned();
    row
}

pub(super) fn xlsx_bytes(
    sheet_name: &str,
    headers: &[String],
    edit: impl FnOnce(&mut Worksheet),
) -> Vec<u8> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name(sheet_name).unwrap();
    for (column, header) in headers.iter().enumerate() {
        worksheet
            .write_string(0, column as u16, header.as_str())
            .unwrap();
    }
    edit(worksheet);
    workbook.save_to_buffer().unwrap()
}

pub(super) fn valid_xlsx(edit: impl FnOnce(&mut Worksheet)) -> Vec<u8> {
    let headers = HEADERS
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    xlsx_bytes(TARGET_SHEET, &headers, edit)
}
