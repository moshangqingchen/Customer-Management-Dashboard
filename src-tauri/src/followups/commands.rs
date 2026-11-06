use super::{FollowUp, FollowUpFilter, FollowUpInput, FollowUpPatch};
use crate::{commands::Arg, error::Result, AppState, Database};
use tauri::State;
#[tauri::command(async)]
pub fn follow_ups_list(
    state: State<'_, AppState>,
    filter: Arg<FollowUpFilter>,
) -> Result<Vec<FollowUp>> {
    state.read(|db| super::list(db, filter.0))
}
#[tauri::command(async)]
pub fn follow_up_create(state: State<'_, AppState>, input: Arg<FollowUpInput>) -> Result<FollowUp> {
    state.read(|db| super::create(db, input.0))
}
#[tauri::command(async)]
pub fn follow_up_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<FollowUpPatch>,
) -> Result<FollowUp> {
    state.read(|db| super::update(db, &id.0, patch.0))
}
#[tauri::command(async)]
pub fn follow_up_set_status(
    state: State<'_, AppState>,
    id: Arg<String>,
    status: Arg<String>,
    result: Arg<Option<String>>,
) -> Result<FollowUp> {
    state.read(|db| super::set_status(db, &id.0, &status.0, result.0.as_deref()))
}
#[tauri::command(async)]
pub fn follow_up_claim_reminder(
    state: State<'_, AppState>,
    id: Arg<String>,
    revision: Arg<i64>,
) -> Result<bool> {
    state.read(|db| super::claim(db, &id.0, revision.0))
}
