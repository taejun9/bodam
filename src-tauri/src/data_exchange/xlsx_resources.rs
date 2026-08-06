use std::io::{BufReader, Read, Seek};

use calamine::{DataRef, XlsxFormulaMetadata};
use quick_xml::events::Event;
use quick_xml::Reader;
use zip::ZipArchive;

use super::constants::{MAX_XLSX_LOGICAL_TEXT_BYTES, MAX_XLSX_SHARED_STRINGS};
use super::error::ImportFileError;

pub(super) fn preflight_shared_string_tables<R: Read + Seek>(
    archive: &mut ZipArchive<R>,
) -> Result<(), ImportFileError> {
    // Calamine reserves `uniqueCount` before opening any worksheet. Inspect every
    // possible shared-string part first so a decoy relationship cannot bypass the cap.
    for index in 0..archive.len() {
        let name = archive
            .by_index_raw(index)
            .map_err(|_| invalid_archive())?
            .name()
            .to_owned();
        let normalized = normalized_archive_name(&name);
        if normalized == "sharedstrings.xml" || normalized.ends_with("/sharedstrings.xml") {
            let entry = archive.by_index(index).map_err(|_| invalid_archive())?;
            preflight_shared_string_table(entry)?;
        }
    }
    Ok(())
}

pub(super) struct LogicalTextBudget(u64);

impl LogicalTextBudget {
    pub(super) const fn new() -> Self {
        Self(0)
    }

    pub(super) fn include(
        &mut self,
        value: &DataRef<'_>,
        formula: Option<&XlsxFormulaMetadata>,
    ) -> Result<(), ImportFileError> {
        // The cell reader borrows SST values. Call this before the parser clones
        // `SharedString` into the long-lived preview DTO.
        let value_bytes = match value {
            DataRef::String(value) => value.len(),
            DataRef::SharedString(value) => value.len(),
            _ => 0,
        };
        let formula_bytes = match formula {
            Some(XlsxFormulaMetadata::Normal { formula })
            | Some(XlsxFormulaMetadata::Shared { formula, .. }) => formula.len(),
            _ => 0,
        };
        let added = value_bytes
            .checked_add(formula_bytes)
            .and_then(|bytes| u64::try_from(bytes).ok())
            .ok_or_else(logical_text_limit)?;
        self.0 = self.0.checked_add(added).ok_or_else(logical_text_limit)?;
        if self.0 > MAX_XLSX_LOGICAL_TEXT_BYTES {
            return Err(logical_text_limit());
        }
        Ok(())
    }
}

pub(super) fn normalized_archive_name(name: &str) -> String {
    // This intentionally matches Calamine's ZIP path-cache normalization.
    name.replace('\\', "/").to_ascii_lowercase()
}

fn preflight_shared_string_table<R: Read>(reader: R) -> Result<(), ImportFileError> {
    let mut xml = Reader::from_reader(BufReader::new(reader));
    xml.config_mut().expand_empty_elements = true;
    let mut buffer = Vec::with_capacity(1024);
    let mut root_seen = false;
    let mut item_count = 0_usize;

    loop {
        buffer.clear();
        match xml.read_event_into(&mut buffer) {
            Ok(Event::Start(element)) if element.local_name().as_ref() == b"sst" => {
                if root_seen {
                    return Err(invalid_archive());
                }
                root_seen = true;
                for attribute in element.attributes() {
                    let attribute = attribute.map_err(|_| invalid_archive())?;
                    if attribute.key.as_ref() == b"uniqueCount" {
                        let value = std::str::from_utf8(attribute.value.as_ref())
                            .ok()
                            .and_then(|value| value.parse::<usize>().ok())
                            .ok_or_else(invalid_archive)?;
                        if value > MAX_XLSX_SHARED_STRINGS {
                            return Err(shared_string_limit());
                        }
                    }
                }
            }
            Ok(Event::Start(element)) if element.local_name().as_ref() == b"si" => {
                if !root_seen {
                    return Err(invalid_archive());
                }
                item_count = item_count.checked_add(1).ok_or_else(shared_string_limit)?;
                if item_count > MAX_XLSX_SHARED_STRINGS {
                    return Err(shared_string_limit());
                }
            }
            Ok(Event::DocType(_)) => return Err(invalid_archive()),
            Ok(Event::Eof) => break,
            Err(_) => return Err(invalid_archive()),
            _ => {}
        }
    }
    root_seen.then_some(()).ok_or_else(invalid_archive)
}

fn invalid_archive() -> ImportFileError {
    ImportFileError::new("XLSX_ARCHIVE_INVALID", "XLSX 압축 구조를 읽을 수 없습니다.")
}

fn shared_string_limit() -> ImportFileError {
    ImportFileError::new(
        "XLSX_SHARED_STRING_LIMIT",
        "XLSX 공유 문자열 수가 허용 범위를 초과했습니다.",
    )
}

fn logical_text_limit() -> ImportFileError {
    ImportFileError::new(
        "XLSX_LOGICAL_TEXT_LIMIT",
        "XLSX 텍스트 총량이 허용 범위를 초과했습니다.",
    )
}

#[cfg(test)]
mod tests {
    use calamine::{DataRef, XlsxFormulaMetadata};

    use super::{LogicalTextBudget, MAX_XLSX_LOGICAL_TEXT_BYTES};

    #[test]
    fn counts_decoded_direct_shared_and_formula_utf8_bytes() {
        let mut budget = LogicalTextBudget::new();
        budget
            .include(
                &DataRef::String("&".to_owned()),
                Some(&XlsxFormulaMetadata::Normal {
                    formula: "SUM".to_owned(),
                }),
            )
            .unwrap();
        budget.include(&DataRef::SharedString("가"), None).unwrap();

        assert_eq!(budget.0, 7);
    }

    #[test]
    fn rejects_before_accepting_text_past_the_budget() {
        let mut budget = LogicalTextBudget(MAX_XLSX_LOGICAL_TEXT_BYTES - 1);
        let error = budget
            .include(&DataRef::SharedString("ab"), None)
            .unwrap_err();

        assert_eq!(error.code, "XLSX_LOGICAL_TEXT_LIMIT");
    }
}
