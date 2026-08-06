use std::ffi::OsStr;

pub(in crate::data_exchange) fn native_dialog_enabled(value: Option<&OsStr>) -> bool {
    value == Some(OsStr::new("1"))
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::native_dialog_enabled;

    #[test]
    fn enables_native_dialog_only_for_exact_one() {
        assert!(native_dialog_enabled(Some(OsStr::new("1"))));
        for value in [None, Some(""), Some("0"), Some("01"), Some("true")] {
            assert!(!native_dialog_enabled(value.map(OsStr::new)));
        }
        for value in [" 1", "1 ", "+1", "１"] {
            assert!(!native_dialog_enabled(Some(OsStr::new(value))));
        }
    }
}
