use std::{collections::HashMap, fs, path::Path};

use calamine::{open_workbook_auto, Reader};
use encoding_rs::GBK;
use thiserror::Error;

use crate::models::{ImportCustomerRow, SpreadsheetPreview};

#[derive(Debug, Error)]
pub enum SpreadsheetError {
    #[error("无法读取表格：{0}")]
    Calamine(#[from] calamine::Error),
    #[error("无法读取表格文件：{0}")]
    Io(#[from] std::io::Error),
    #[error("CSV 内容格式不正确：{0}")]
    Csv(#[from] csv::Error),
    #[error("仅支持 xlsx、xls、xlsb、ods 和 csv 客户表格")]
    UnsupportedFormat,
    #[error("表格没有可读取的工作表")]
    NoWorksheet,
    #[error("没有找到工作表“{0}”，请重新选择")]
    UnknownWorksheet(String),
    #[error("表格第一行必须包含列名")]
    NoHeaders,
    #[error("表格最多支持 {0} 行数据，请拆分后再导入")]
    TooManyRows(usize),
    #[error("表格最多支持 {0} 列，请精简后再导入")]
    TooManyColumns(usize),
    #[error("表格文件不能超过 {0} MB")]
    FileTooLarge(u64),
}

const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024;
const MAX_DATA_ROWS: usize = 20_000;
const MAX_COLUMNS: usize = 256;

pub fn preview_spreadsheet(
    path: &Path,
    requested_sheet: Option<&str>,
) -> Result<SpreadsheetPreview, SpreadsheetError> {
    let metadata = fs::metadata(path)?;
    if metadata.len() > MAX_FILE_BYTES {
        return Err(SpreadsheetError::FileTooLarge(MAX_FILE_BYTES / 1024 / 1024));
    }
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("客户表格")
        .to_string();
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if extension == "csv" {
        return preview_csv(path, file_name);
    }
    if !matches!(extension.as_str(), "xlsx" | "xls" | "xlsb" | "ods") {
        return Err(SpreadsheetError::UnsupportedFormat);
    }

    let mut workbook = open_workbook_auto(path)?;
    let sheet_names = workbook.sheet_names().to_vec();
    let selected_sheet = match requested_sheet.filter(|value| !value.trim().is_empty()) {
        Some(sheet) if sheet_names.iter().any(|candidate| candidate == sheet) => sheet.to_string(),
        Some(sheet) => return Err(SpreadsheetError::UnknownWorksheet(sheet.to_string())),
        None => sheet_names
            .first()
            .cloned()
            .ok_or(SpreadsheetError::NoWorksheet)?,
    };
    let range = workbook.worksheet_range(&selected_sheet)?;
    if range.width() > MAX_COLUMNS {
        return Err(SpreadsheetError::TooManyColumns(MAX_COLUMNS));
    }
    let total_rows = range.height().saturating_sub(1);
    if total_rows > MAX_DATA_ROWS {
        return Err(SpreadsheetError::TooManyRows(MAX_DATA_ROWS));
    }
    let mut source_rows = range.rows();
    let mut headers = source_rows
        .next()
        .ok_or(SpreadsheetError::NoHeaders)?
        .iter()
        .map(ToString::to_string)
        .collect::<Vec<_>>();
    if let Some(first) = headers.first_mut() {
        *first = first.trim_start_matches('\u{feff}').to_string();
    }
    if headers.iter().all(|header| header.trim().is_empty()) {
        return Err(SpreadsheetError::NoHeaders);
    }
    let rows = source_rows
        .map(|row| row.iter().map(ToString::to_string).collect::<Vec<_>>())
        .collect::<Vec<_>>();
    Ok(SpreadsheetPreview {
        headers,
        rows,
        file_name,
        sheet_names,
        selected_sheet: Some(selected_sheet),
        total_rows,
    })
}

fn preview_csv(path: &Path, file_name: String) -> Result<SpreadsheetPreview, SpreadsheetError> {
    let bytes = fs::read(path)?;
    let content = match std::str::from_utf8(&bytes) {
        Ok(value) => value.trim_start_matches('\u{feff}').to_string(),
        Err(_) => {
            let (decoded, _, had_errors) = GBK.decode(&bytes);
            if had_errors {
                return Err(SpreadsheetError::UnsupportedFormat);
            }
            decoded.into_owned()
        }
    };
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(content.as_bytes());
    let headers = reader
        .headers()?
        .iter()
        .map(|value| value.trim().to_string())
        .collect::<Vec<_>>();
    if headers.is_empty() || headers.iter().all(|header| header.is_empty()) {
        return Err(SpreadsheetError::NoHeaders);
    }
    if headers.len() > MAX_COLUMNS {
        return Err(SpreadsheetError::TooManyColumns(MAX_COLUMNS));
    }
    let mut rows = Vec::new();
    for record in reader.records() {
        if rows.len() >= MAX_DATA_ROWS {
            return Err(SpreadsheetError::TooManyRows(MAX_DATA_ROWS));
        }
        rows.push(record?.iter().map(ToString::to_string).collect());
    }
    let total_rows = rows.len();
    Ok(SpreadsheetPreview {
        headers,
        rows,
        file_name,
        sheet_names: vec!["CSV".to_string()],
        selected_sheet: Some("CSV".to_string()),
        total_rows,
    })
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
