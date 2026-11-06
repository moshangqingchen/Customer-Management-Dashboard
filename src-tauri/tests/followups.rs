use client_desk_lib::{
    db,
    followups::{self, FollowUpFilter, FollowUpInput, FollowUpPatch},
    models::{ClientInput, ProjectInput},
    repo::{activities, clients, projects},
};
use rusqlite::Connection;
use tempfile::TempDir;

fn setup() -> (TempDir, Connection, String) {
    let dir = tempfile::tempdir().unwrap();
    let db = db::open(&dir.path().join("client-desk.db")).unwrap();
    let client = clients::create(
        &db,
        ClientInput {
            name: "跟进客户".into(),
            ..Default::default()
        },
    )
    .unwrap();
    (dir, db, client.id)
}
fn input(client_id: &str, due_at: &str) -> FollowUpInput {
    FollowUpInput {
        client_id: client_id.into(),
        title: "确认初稿".into(),
        due_at: due_at.into(),
        notes: "确认配色与交付尺寸".into(),
        ..Default::default()
    }
}

#[test]
fn schedule_uses_utc_and_rejects_invalid_time_and_foreign_project() {
    let (_dir, db, client_id) = setup();
    let item = followups::create(&db, input(&client_id, "2026-11-05T09:00:00+08:00")).unwrap();
    assert_eq!(item.due_at, "2026-11-05T01:00:00.000Z");
    assert!(followups::create(&db, input(&client_id, "2026-02-30T09:00:00Z")).is_err());
    assert!(followups::create(&db, input(&client_id, "2026-11-05T09:00:00")).is_err());
    let other = clients::create(
        &db,
        ClientInput {
            name: "另一位客户".into(),
            ..Default::default()
        },
    )
    .unwrap();
    let project = projects::create_record(
        &db,
        ProjectInput {
            client_id: other.id,
            title: "别人的项目".into(),
            ..Default::default()
        },
    )
    .unwrap();
    let mut bad = input(&client_id, "2026-11-05T09:00:00Z");
    bad.project_id = Some(project.id);
    assert_eq!(followups::create(&db, bad).unwrap_err().code, "invalid");
    assert_eq!(
        followups::list(&db, FollowUpFilter::default())
            .unwrap()
            .len(),
        1
    );
}

#[test]
fn reminder_claim_is_atomic_persistent_and_reschedule_has_a_new_revision() {
    let (dir, db, client_id) = setup();
    let item = followups::create(&db, input(&client_id, "2026-11-05T09:00:00Z")).unwrap();
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-05T08:59:59.999Z").unwrap());
    assert!(followups::claim_at(&db, &item.id, 1, "2026-11-05T09:00:00Z").unwrap());
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-05T09:00:00Z").unwrap());
    drop(db);
    let db = db::open(&dir.path().join("client-desk.db")).unwrap();
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-06T09:00:00Z").unwrap());
    let later = followups::update(
        &db,
        &item.id,
        FollowUpPatch {
            due_at: Some("2026-11-07T10:00:00+08:00".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(later.revision, 2);
    assert_eq!(later.reminded_revision, None);
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-08T09:00:00Z").unwrap());
    assert!(!followups::claim_at(&db, &item.id, 2, "2026-11-07T01:59:59Z").unwrap());
    assert!(followups::claim_at(&db, &item.id, 2, "2026-11-07T02:00:00Z").unwrap());
}

#[test]
fn completion_result_and_activity_are_saved_together_and_reopen_can_remind() {
    let (_dir, db, client_id) = setup();
    let item = followups::create(&db, input(&client_id, "2026-11-05T09:00:00Z")).unwrap();
    assert!(followups::set_status(&db, &item.id, "completed", Some("  ")).is_err());
    assert_eq!(followups::get(&db, &item.id).unwrap().status, "pending");
    let done = followups::set_status(&db, &item.id, "completed", Some("客户确认暖色，下周结尾款"))
        .unwrap();
    assert!(done.completed_at.is_some());
    assert_eq!(done.result, "客户确认暖色，下周结尾款");
    let events = activities::list(&db, Some(&client_id), None, None).unwrap();
    let event = events
        .iter()
        .find(|event| event.body.contains("客户确认暖色"))
        .unwrap();
    assert!(activities::update_note(&db, &event.id, "改写系统记录").is_err());
    assert!(!followups::claim_at(&db, &item.id, done.revision, "2026-11-06T09:00:00Z").unwrap());
    let reopened = followups::set_status(&db, &item.id, "pending", None).unwrap();
    assert!(followups::claim_at(&db, &item.id, reopened.revision, "2026-11-06T09:00:00Z").unwrap());
    followups::set_status(&db, &item.id, "cancelled", None).unwrap();
    assert!(
        !followups::claim_at(&db, &item.id, reopened.revision, "2026-11-06T09:00:00Z").unwrap()
    );
}

#[test]
fn deleted_relations_suppress_reminders_without_erasing_history() {
    let (_dir, db, client_id) = setup();
    let project = projects::create_record(
        &db,
        ProjectInput {
            client_id: client_id.clone(),
            title: "关联项目".into(),
            ..Default::default()
        },
    )
    .unwrap();
    let mut data = input(&client_id, "2026-11-05T09:00:00Z");
    data.project_id = Some(project.id.clone());
    let item = followups::create(&db, data).unwrap();
    projects::delete(&db, &project.id).unwrap();
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-06T09:00:00Z").unwrap());
    assert!(!followups::list(&db, FollowUpFilter::default()).unwrap()[0].project_available);
    let detached = followups::update(
        &db,
        &item.id,
        FollowUpPatch {
            project_id: Some(None),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(detached.project_available);
    clients::delete(&db, &client_id).unwrap();
    assert!(followups::list(&db, FollowUpFilter::default())
        .unwrap()
        .is_empty());
    assert!(!followups::claim_at(&db, &item.id, 1, "2026-11-06T09:00:00Z").unwrap());
}

#[test]
fn activity_failure_rolls_back_completion_and_reminder_failure_keeps_claim_available() {
    let (_dir, db, client_id) = setup();
    let item = followups::create(&db, input(&client_id, "2026-11-05T09:00:00Z")).unwrap();
    db.execute_batch("CREATE TRIGGER reject_followup_activity BEFORE INSERT ON activities BEGIN SELECT RAISE(ABORT,'test'); END;").unwrap();
    assert!(followups::set_status(&db, &item.id, "completed", Some("已确认")).is_err());
    assert_eq!(followups::get(&db, &item.id).unwrap().status, "pending");
    db.execute_batch("CREATE TRIGGER reject_followup_claim BEFORE UPDATE OF reminded_revision ON follow_ups BEGIN SELECT RAISE(ABORT,'test'); END;").unwrap();
    assert!(followups::claim_at(&db, &item.id, 1, "2026-11-06T09:00:00Z").is_err());
    assert_eq!(
        followups::get(&db, &item.id).unwrap().reminded_revision,
        None
    );
    db.execute_batch("DROP TRIGGER reject_followup_claim;")
        .unwrap();
    assert!(followups::claim_at(&db, &item.id, 1, "2026-11-06T09:00:00Z").unwrap());
}
