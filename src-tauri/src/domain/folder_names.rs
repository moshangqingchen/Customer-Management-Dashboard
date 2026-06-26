use std::path::Path;

pub fn customer_folder_name(customer_name: &str, short_id: &str) -> String {
    format!("{}_[{}]", sanitize_component(customer_name), short_id)
}

pub fn order_folder_name(date: &str, external_order_no: &str, short_id: &str) -> String {
    format!(
        "{}_{}_[{}]",
        sanitize_component(date),
        sanitize_component(external_order_no),
        short_id
    )
}

pub fn next_available_name(original: &str, existing: &[String]) -> String {
    if !existing
        .iter()
        .any(|name| name.eq_ignore_ascii_case(original))
    {
        return original.to_string();
    }

    let path = Path::new(original);
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or(original);
    let extension = path.extension().and_then(|value| value.to_str());

    for version in 2.. {
        let candidate = match extension {
            Some(extension) => format!("{stem} ({version}).{extension}"),
            None => format!("{stem} ({version})"),
        };
        if !existing
            .iter()
            .any(|name| name.eq_ignore_ascii_case(&candidate))
        {
            return candidate;
        }
    }

    unreachable!("a versioned filename is always available")
}

fn sanitize_component(value: &str) -> String {
    let sanitized: String = value
        .chars()
        .map(|character| match character {
            '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*' => '_',
            character if character.is_control() => '_',
            character => character,
        })
        .collect();

    let sanitized = sanitized.trim().trim_end_matches(['.', ' ']);
    if sanitized.is_empty() {
        "未命名".to_string()
    } else {
        sanitized.to_string()
    }
}
