use super::models::ClientMergeConflict;
use crate::models::{Client, ClientAccount};

pub(super) fn conflicts(source: &Client, target: &Client) -> Vec<ClientMergeConflict> {
    [
        ("name", "原客户名称", &source.name, &target.name),
        ("company", "公司 / 店铺", &source.company, &target.company),
        ("phone", "电话", &source.phone, &target.phone),
        ("wechat", "微信", &source.wechat, &target.wechat),
        ("email", "邮箱", &source.email, &target.email),
        ("address", "地址", &source.address, &target.address),
    ]
    .into_iter()
    .filter(|(_, _, source, target)| {
        !source.trim().is_empty() && !target.trim().is_empty() && source != target
    })
    .map(|(field, label, source, target)| ClientMergeConflict {
        field: field.into(),
        label: label.into(),
        source_value: source.clone(),
        target_value: target.clone(),
    })
    .collect()
}

pub(super) fn accounts(source: &Client, target: &Client) -> Vec<ClientAccount> {
    let mut result = target.accounts.clone();
    for account in &source.accounts {
        if !result.iter().any(|existing| {
            existing.platform.trim().to_lowercase() == account.platform.trim().to_lowercase()
                && existing.handle.trim().to_lowercase() == account.handle.trim().to_lowercase()
        }) {
            result.push(account.clone());
        }
    }
    result
}

pub(super) fn notes(source: &Client, target: &Client, conflicts: &[ClientMergeConflict]) -> String {
    let mut inherited = conflicts
        .iter()
        .map(|conflict| format!("{}：{}", conflict.label, conflict.source_value))
        .collect::<Vec<_>>();
    if source.rating != target.rating {
        inherited.push(format!("原客户星级：{}", source.rating));
    }
    if !source.notes.trim().is_empty() {
        inherited.push(format!("原客户备注：\n{}", source.notes));
    }
    let heading = format!("【合并自「{}」】", source.name);
    let section = if inherited.is_empty() {
        heading
    } else {
        format!("{heading}\n{}", inherited.join("\n"))
    };
    if target.notes.trim().is_empty() {
        section
    } else {
        format!("{}\n\n{section}", target.notes)
    }
}

pub(super) fn prefer_target(target: &str, source: &str) -> String {
    if target.trim().is_empty() {
        source.to_string()
    } else {
        target.to_string()
    }
}
