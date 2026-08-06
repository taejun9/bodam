use serde::Serialize;
use std::fmt;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportFileError {
    pub(crate) code: &'static str,
    pub(crate) message: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) source_row: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub(crate) field: Option<&'static str>,
}

impl ImportFileError {
    pub(crate) const fn new(code: &'static str, message: &'static str) -> Self {
        Self {
            code,
            message,
            source_row: None,
            field: None,
        }
    }

    pub(crate) const fn at(
        code: &'static str,
        message: &'static str,
        source_row: u32,
        field: &'static str,
    ) -> Self {
        Self {
            code,
            message,
            source_row: Some(source_row),
            field: Some(field),
        }
    }

    pub(crate) const fn at_row(code: &'static str, message: &'static str, source_row: u32) -> Self {
        Self {
            code,
            message,
            source_row: Some(source_row),
            field: None,
        }
    }
}

impl fmt::Display for ImportFileError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for ImportFileError {}
