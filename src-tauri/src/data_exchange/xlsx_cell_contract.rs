use quick_xml::events::BytesStart;

use super::error::ImportFileError;

pub(super) fn declared_cell_type(
    element: &BytesStart<'_>,
) -> Result<DeclaredCellType, ImportFileError> {
    let mut declared_type = DeclaredCellType::ImplicitNumeric;
    let mut type_seen = false;
    for attribute in element.attributes() {
        let attribute = attribute.map_err(|_| structure_invalid())?;
        if attribute.key.as_ref() == b"t" {
            if type_seen {
                return Err(structure_invalid());
            }
            type_seen = true;
            declared_type = match attribute.value.as_ref() {
                b"s" => DeclaredCellType::Shared,
                b"inlineStr" => DeclaredCellType::Inline,
                b"str" => DeclaredCellType::FormulaString,
                _ => DeclaredCellType::Other,
            };
        }
    }
    Ok(declared_type)
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum DeclaredCellType {
    Shared,
    Inline,
    FormulaString,
    ImplicitNumeric,
    Other,
}

pub(super) struct CellState {
    pub(super) declared_type: DeclaredCellType,
    pub(super) nesting: usize,
    value_seen: bool,
}

impl CellState {
    pub(super) const fn new(declared_type: DeclaredCellType) -> Self {
        Self {
            declared_type,
            nesting: 0,
            value_seen: false,
        }
    }

    pub(super) fn mark_value(&mut self) -> Result<(), ImportFileError> {
        if self.value_seen {
            return Err(structure_invalid());
        }
        self.value_seen = true;
        Ok(())
    }
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub(super) enum DirectValueRule {
    SharedIndex,
    ImplicitNumeric,
    Text,
}

impl DirectValueRule {
    pub(super) fn accepts(self, bytes: &[u8]) -> bool {
        match self {
            Self::SharedIndex => {
                bytes.iter().all(u8::is_ascii_digit)
                    && bytes
                        .iter()
                        .try_fold(0_usize, |value, byte| {
                            value
                                .checked_mul(10)?
                                .checked_add(usize::from(*byte - b'0'))
                        })
                        .is_some()
            }
            Self::ImplicitNumeric => fast_float2::parse::<f64, _>(bytes).is_ok(),
            Self::Text => true,
        }
    }
}

fn structure_invalid() -> ImportFileError {
    ImportFileError::new(
        "XLSX_STRUCTURE_INVALID",
        "XLSX workbook 구조를 읽을 수 없습니다.",
    )
}
