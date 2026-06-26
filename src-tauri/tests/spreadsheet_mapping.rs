use startup_customer_workbench_lib::import_service::map_customer_rows;

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
