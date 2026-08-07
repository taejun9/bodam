pub(super) fn is_safe(value: &str) -> bool {
    if value.ends_with('.')
        || value.ends_with(' ')
        || value
            .chars()
            .any(|character| matches!(character, '<' | '>' | ':' | '"' | '|' | '?' | '*'))
    {
        return false;
    }
    let stem = value.split('.').next().unwrap_or(value);
    !is_reserved_device_stem(&stem.to_ascii_uppercase())
}

fn is_reserved_device_stem(stem: &str) -> bool {
    if matches!(stem, "CON" | "PRN" | "AUX" | "NUL") {
        return true;
    }
    stem.strip_prefix("COM")
        .or_else(|| stem.strip_prefix("LPT"))
        .is_some_and(|suffix| {
            matches!(
                suffix,
                "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "¹" | "²" | "³"
            )
        })
}

#[cfg(test)]
mod tests {
    use super::is_safe;

    #[test]
    fn reserved_and_unsafe_names_are_rejected_without_unicode_panics() {
        for name in ["CON", "con.txt", "bad:name", "trail. "] {
            assert!(!is_safe(name));
        }
        for prefix in ["COM", "com", "LPT", "lpt"] {
            for suffix in ["1", "2", "3", "4", "5", "6", "7", "8", "9", "¹", "²", "³"] {
                let alias = format!("{prefix}{suffix}");
                assert!(!is_safe(&alias));
                assert!(!is_safe(&format!("{alias}.log")));
            }
        }
        assert!(is_safe("éé.bodam-backup"));
        assert!(is_safe("보담.bodam-backup"));
        assert!(is_safe("档案.bodam-backup"));
    }
}
