pub(crate) fn trim_ecmascript_whitespace(value: &str) -> &str {
    value.trim_matches(is_ecmascript_whitespace)
}

fn is_ecmascript_whitespace(character: char) -> bool {
    matches!(
        character,
        '\u{0009}'
            | '\u{000a}'
            | '\u{000b}'
            | '\u{000c}'
            | '\u{000d}'
            | '\u{0020}'
            | '\u{00a0}'
            | '\u{1680}'
            | '\u{2000}'
            ..='\u{200a}'
                | '\u{2028}'
                | '\u{2029}'
                | '\u{202f}'
                | '\u{205f}'
                | '\u{3000}'
                | '\u{feff}'
    )
}

#[cfg(test)]
mod tests {
    use super::trim_ecmascript_whitespace;

    #[test]
    fn matches_ecmascript_bom_and_next_line_behavior() {
        assert_eq!(
            trim_ecmascript_whitespace("\u{feff}synthetic\u{feff}"),
            "synthetic"
        );
        assert_eq!(
            trim_ecmascript_whitespace("\u{0085}synthetic\u{0085}"),
            "\u{0085}synthetic\u{0085}"
        );
    }
}
