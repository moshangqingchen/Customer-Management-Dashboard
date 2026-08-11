use std::fs;

use startup_customer_workbench_lib::import_service::{map_customer_rows, preview_spreadsheet};
use tempfile::tempdir;

#[test]
fn maps_arbitrary_spreadsheet_columns_using_explicit_field_mapping() {
    let headers = vec![
        "买家".to_string(),
        "联系号码".to_string(),
        "渠道".to_string(),
        "备注标签".to_string(),
    ];
    let rows = vec![vec![
        "林女士".to_string(),
        "13800138000".to_string(),
        "闲鱼".to_string(),
        "复购,加急".to_string(),
    ]];
    let mapping = vec![
        ("name".to_string(), "买家".to_string()),
        ("phone".to_string(), "联系号码".to_string()),
        ("platform".to_string(), "渠道".to_string()),
        ("tags".to_string(), "备注标签".to_string()),
    ];

    let imported = map_customer_rows(&headers, &rows, &mapping);

    assert_eq!(imported[0].name, "林女士");
    assert_eq!(imported[0].phone, "13800138000");
    assert_eq!(imported[0].platform, "闲鱼");
    assert_eq!(imported[0].tags, vec!["复购", "加急"]);
}

#[test]
fn previews_utf8_csv_with_metadata_and_quoted_cells() {
    let temp = tempdir().unwrap();
    let path = temp.path().join("客户清单.csv");
    fs::write(
        &path,
        "\u{feff}客户名称,电话,备注\r\n林女士,13800138000,\"复购,加急\"\r\n",
    )
    .unwrap();

    let preview = preview_spreadsheet(&path, None).unwrap();

    assert_eq!(preview.file_name, "客户清单.csv");
    assert_eq!(preview.sheet_names, vec!["CSV"]);
    assert_eq!(preview.selected_sheet.as_deref(), Some("CSV"));
    assert_eq!(preview.total_rows, 1);
    assert_eq!(preview.rows[0][2], "复购,加急");
}
