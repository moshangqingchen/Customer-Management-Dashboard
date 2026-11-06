use crate::models::Client;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomerManagementState {
    pub client_id: String,
    pub archived_at: Option<String>,
    pub merged_into: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientMergeConflict {
    pub field: String,
    pub label: String,
    pub source_value: String,
    pub target_value: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientMergePreview {
    pub source: Client,
    pub target: Client,
    pub project_count: i64,
    pub deleted_project_count: i64,
    pub payment_count: i64,
    pub activity_count: i64,
    pub follow_up_count: i64,
    pub folders: Vec<String>,
    pub conflicts: Vec<ClientMergeConflict>,
    pub added_accounts: usize,
    pub tag_count: usize,
    pub merged_notes: String,
    pub preview_token: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClientMergeInput {
    pub source_id: String,
    pub target_id: String,
    pub preview_token: String,
}
