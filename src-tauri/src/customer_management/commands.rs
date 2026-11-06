use super::{ClientMergeInput, ClientMergePreview, CustomerManagementState};
use crate::{commands::Arg, error::Result, models::Client, AppState, Database};
use tauri::State;

#[tauri::command(async)]
pub fn customer_management_states(
    state: State<'_, AppState>,
) -> Result<Vec<CustomerManagementState>> {
    state.read(super::states)
}

#[tauri::command(async)]
pub fn customer_set_archived(
    state: State<'_, AppState>,
    client_id: Arg<String>,
    archived: Arg<bool>,
) -> Result<CustomerManagementState> {
    state.read(|connection| super::set_archived(connection, &client_id.0, archived.0))
}

#[tauri::command(async)]
pub fn customer_merge_preview(
    state: State<'_, AppState>,
    source_id: Arg<String>,
    target_id: Arg<String>,
) -> Result<ClientMergePreview> {
    state.read(|connection| super::preview_merge(connection, &source_id.0, &target_id.0))
}

#[tauri::command(async)]
pub fn customer_merge(state: State<'_, AppState>, input: Arg<ClientMergeInput>) -> Result<Client> {
    let _guard = state.file_guard()?;
    state.read(|connection| super::merge(connection, input.0))
}
