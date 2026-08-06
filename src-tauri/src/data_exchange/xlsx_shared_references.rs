use std::io::{BufReader, Read, Seek};

use quick_xml::events::{BytesStart, Event};
use quick_xml::Reader;
use zip::ZipArchive;

use super::error::ImportFileError;
use super::xlsx_cell_contract::{declared_cell_type, CellState, DeclaredCellType, DirectValueRule};
use super::xlsx_xml_detection::contains_sheet_data;

pub(super) fn preflight_shared_string_references<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(), ImportFileError> {
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(|_| structure_invalid())?;
        preflight_if_worksheet(entry)?;
    }
    Ok(())
}

fn preflight_if_worksheet<R: Read>(reader: R) -> Result<(), ImportFileError> {
    let mut xml = Reader::from_reader(BufReader::new(reader));
    xml.config_mut().expand_empty_elements = true;
    // Match Calamine while locating the logical root so malformed comments
    // cannot stop this scan before a nested `sheetData` it would still read.
    xml.config_mut().enable_all_checks(false);
    let mut buffer = Vec::with_capacity(1024);
    let mut doctype_seen = false;

    loop {
        buffer.clear();
        match xml.read_event_into(&mut buffer) {
            Ok(Event::Start(root)) => {
                if root.local_name().as_ref() != b"worksheet" {
                    if root.local_name().as_ref() == b"sheetData"
                        || contains_sheet_data(&mut xml, &mut buffer)
                            .map_err(|_| structure_invalid())?
                    {
                        return Err(structure_invalid());
                    }
                    return Ok(());
                }
                if doctype_seen {
                    return Err(structure_invalid());
                }
                validate_attributes(&root)?;
                xml.config_mut().enable_all_checks(true);
                break;
            }
            Ok(Event::DocType(_)) => doctype_seen = true,
            Ok(Event::Eof) | Err(_) => return Ok(()),
            _ => {}
        }
    }

    scan_worksheet(&mut xml, &mut buffer)
}

fn scan_worksheet<R: std::io::BufRead>(
    xml: &mut Reader<R>,
    buffer: &mut Vec<u8>,
) -> Result<(), ImportFileError> {
    let mut depth = 1_usize;
    let mut root_closed = false;
    let mut sheet_data_depth = None;
    let mut cell: Option<CellState> = None;

    loop {
        buffer.clear();
        match xml.read_event_into(buffer) {
            Ok(Event::Start(element)) => {
                if root_closed {
                    return Err(structure_invalid());
                }
                if sheet_data_depth.is_none() && element.local_name().as_ref() == b"sheetData" {
                    sheet_data_depth = Some(depth.checked_add(1).ok_or_else(structure_invalid)?);
                }
                if cell.is_none()
                    && sheet_data_depth.is_some()
                    && element.local_name().as_ref() == b"c"
                {
                    cell = Some(CellState::new(declared_cell_type(&element)?));
                } else {
                    validate_attributes(&element)?;
                    if let Some(state) = &mut cell {
                        if state.nesting == 0 {
                            match element.local_name().as_ref() {
                                b"v" => match state.declared_type {
                                    DeclaredCellType::Shared => {
                                        state.mark_value()?;
                                        read_direct_value(
                                            xml,
                                            buffer,
                                            DirectValueRule::SharedIndex,
                                        )?;
                                        continue;
                                    }
                                    DeclaredCellType::ImplicitNumeric => {
                                        state.mark_value()?;
                                        read_direct_value(
                                            xml,
                                            buffer,
                                            DirectValueRule::ImplicitNumeric,
                                        )?;
                                        continue;
                                    }
                                    DeclaredCellType::FormulaString => {
                                        state.mark_value()?;
                                        read_direct_value(xml, buffer, DirectValueRule::Text)?;
                                        continue;
                                    }
                                    DeclaredCellType::Inline => {
                                        return Err(structure_invalid());
                                    }
                                    DeclaredCellType::Other => {}
                                },
                                b"is" => {
                                    if state.declared_type != DeclaredCellType::Inline {
                                        return Err(structure_invalid());
                                    }
                                    state.mark_value()?;
                                }
                                _ => {}
                            }
                        }
                        state.nesting =
                            state.nesting.checked_add(1).ok_or_else(structure_invalid)?;
                    }
                }
                depth = depth.checked_add(1).ok_or_else(structure_invalid)?;
            }
            Ok(Event::End(element)) => {
                if root_closed {
                    return Err(structure_invalid());
                }
                if let Some(state) = &mut cell {
                    if state.nesting > 0 {
                        state.nesting -= 1;
                    } else if element.local_name().as_ref() == b"c" {
                        cell = None;
                    } else {
                        return Err(structure_invalid());
                    }
                }
                if sheet_data_depth == Some(depth) && element.local_name().as_ref() == b"sheetData"
                {
                    sheet_data_depth = None;
                }
                depth = depth.checked_sub(1).ok_or_else(structure_invalid)?;
                root_closed = depth == 0;
            }
            Ok(Event::DocType(_) | Event::Decl(_)) | Err(_) => {
                return Err(structure_invalid());
            }
            Ok(Event::Text(text))
                if cell.as_ref().is_some_and(|state| state.nesting == 0)
                    && !is_ascii_whitespace(text.as_ref()) =>
            {
                return Err(structure_invalid());
            }
            Ok(Event::CData(_) | Event::GeneralRef(_))
                if cell.as_ref().is_some_and(|state| state.nesting == 0) =>
            {
                return Err(structure_invalid());
            }
            Ok(Event::Text(text)) if root_closed && !is_ascii_whitespace(text.as_ref()) => {
                return Err(structure_invalid());
            }
            Ok(Event::CData(_) | Event::GeneralRef(_)) if root_closed => {
                return Err(structure_invalid());
            }
            Ok(Event::Eof) => {
                return (root_closed && sheet_data_depth.is_none() && cell.is_none())
                    .then_some(())
                    .ok_or_else(structure_invalid);
            }
            _ => {}
        }
    }
}

fn read_direct_value<R: std::io::BufRead>(
    xml: &mut Reader<R>,
    buffer: &mut Vec<u8>,
    rule: DirectValueRule,
) -> Result<(), ImportFileError> {
    let mut payload_seen = false;
    loop {
        buffer.clear();
        match xml.read_event_into(buffer) {
            Ok(Event::Text(_) | Event::GeneralRef(_)) if rule == DirectValueRule::Text => {
                payload_seen = true;
            }
            Ok(Event::Text(text)) if !payload_seen => {
                let bytes: &[u8] = text.as_ref();
                if !bytes.is_empty() && !rule.accepts(bytes) {
                    return Err(structure_invalid());
                }
                payload_seen = true;
            }
            Ok(Event::End(element)) if element.local_name().as_ref() == b"v" => return Ok(()),
            Ok(Event::Eof) | Err(_) => return Err(structure_invalid()),
            _ => return Err(structure_invalid()),
        }
    }
}

fn validate_attributes(element: &BytesStart<'_>) -> Result<(), ImportFileError> {
    for attribute in element.attributes() {
        attribute.map_err(|_| structure_invalid())?;
    }
    Ok(())
}

fn is_ascii_whitespace(bytes: &[u8]) -> bool {
    bytes.iter().all(u8::is_ascii_whitespace)
}

fn structure_invalid() -> ImportFileError {
    ImportFileError::new(
        "XLSX_STRUCTURE_INVALID",
        "XLSX workbook 구조를 읽을 수 없습니다.",
    )
}
