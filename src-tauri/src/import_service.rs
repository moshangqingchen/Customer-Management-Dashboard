use std::{collections::HashMap, path::Path};

use calamine::{open_workbook_auto, Reader};
use thiserror::Error;

use crate::models::{ImportCustomerRow, SpreadsheetPreview};

#[derive(Debug, Error)]
pub enum SpreadsheetError {
    #[error("无法读取表格：{0}")]
    Calamine(#[from] calamine::Error),
    #[error("表格没有可读取的工作表")]
    NoWorksheet,
    #[error("表格第一行必须包含列名")]
    NoHeaders,
}

pub fn preview_spreadsheet(path: &Path) -> Result<SpreadsheetPreview, SpreadsheetError> {
    let mut workbook = open_workbook_auto(path)?;
    let range = workbook
        .worksheet_range_at(0)
        .ok_or(SpreadsheetError::NoWorksheet)??;
    let mut source_rows = range.rows();
    let headers = source_rows
        .next()
        .ok_or(SpreadsheetError::NoHeaders)?
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    let rows = source_rows
        .map(|row| row.iter().map(ToString::to_string).collect::<Vec<_>>())
        .collect::<Vec<_>>();
    Ok(SpreadsheetPreview { headers, rows })
}

pub fn map_customer_rows(
    headers: &[String],
    rows: &[Vec<String>],
    mapping: &[(String, String)],
) -> Vec<ImportCustomerRow> {
    let column_indexes = mapping
        .iter()
        .filter_map(|(field, header)| {
            headers
                .iter()
                .position(|candidate| candidate == header)
                .map(|index| (field.as_str(), index))
        })
        .collect::<HashMap<_, _>>();
    let value = |row: &[String], field: &str| {
        column_indexes
            .get(field)
            .and_then(|index| row.get(*index))
            .map(|value| value.trim().to_string())
            .unwrap_or_default()
    };

    rows.iter()
        .enumerate()
        .map(|(index, row)| ImportCustomerRow {
            row_number: index + 2,
            name: value(row, "name"),
            phone: value(row, "phone"),
            wechat: value(row, "wechat"),
            platform: value(row, "platform"),
            platform_handle: value(row, "platformHandle"),
            notes: value(row, "notes"),
            vip_level: value(row, "vipLevel")
                .parse::<i64>()
                .unwrap_or_default()
                .clamp(0, 5),
            tags: value(row, "tags")
                .split([',', '，', ';', '；'])
                .map(str::trim)
                .filter(|tag| !tag.is_empty())
                .map(ToString::to_string)
                .collect(),
        })
        .collect()
}
