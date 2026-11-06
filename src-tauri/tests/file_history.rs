use client_desk_lib::{
    db,
    library::{self, history},
    models::FileTarget,
};
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};
use tempfile::TempDir;

struct Fixture {
    temp: TempDir,
    db: Connection,
    root: PathBuf,
    file: PathBuf,
}
impl Fixture {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let db = db::open(&temp.path().join("data.db")).unwrap();
        let root = temp.path().join("文件库");
        library::set_root(&db, &root).unwrap();
        db.execute("INSERT INTO clients(id,name,created_at,updated_at) VALUES('c','客户','2026-11-05T00:00:00Z','2026-11-05T00:00:00Z')", []).unwrap();
        db.execute("INSERT INTO projects(id,client_id,title,created_at,updated_at) VALUES('p','c','项目','2026-11-05T00:00:00Z','2026-11-05T00:00:00Z')", []).unwrap();
        let dir = library::ensure_folder(
            &db,
            &FileTarget::Project {
                project_id: "p".into(),
            },
        )
        .unwrap();
        let file = dir.join("设计.psd");
        fs::write(&file, b"version one").unwrap();
        Self {
            temp,
            db,
            root,
            file,
        }
    }
}

#[test]
fn history_preserves_bytes_and_restoring_a_version_saves_current_content() {
    let f = Fixture::new();
    let first = history::save_version(&f.db, &f.file, "初稿").unwrap();
    let incoming = f.temp.path().join("新版.psd");
    fs::write(&incoming, b"version two").unwrap();
    history::replace_version(&f.db, &f.file, &incoming, "第二稿").unwrap();
    assert_eq!(fs::read(&f.file).unwrap(), b"version two");
    assert_eq!(fs::read(&first.snapshot_path).unwrap(), b"version one");
    history::restore_version(&f.db, &first.id).unwrap();
    assert_eq!(fs::read(&f.file).unwrap(), b"version one");
    let versions = history::list_versions(&f.db, Some(&f.file)).unwrap();
    assert!(versions
        .iter()
        .any(|v| fs::read(&v.snapshot_path).unwrap() == b"version two"));
    assert_eq!(library::files_recent(&f.db, 100).unwrap().len(), 1);
}

#[test]
fn indexed_and_legacy_trash_restore_without_overwriting_current_file() {
    let f = Fixture::new();
    library::file_trash(&f.db, &f.file).unwrap();
    fs::write(&f.file, b"new current").unwrap();
    let rows = history::list_recycle(&f.db).unwrap();
    assert_eq!(rows.len(), 1);
    assert!(!rows[0].legacy);
    let restored = history::restore_recycled(&f.db, &rows[0].id).unwrap();
    assert_ne!(Path::new(&restored.path), f.file);
    assert_eq!(fs::read(&restored.path).unwrap(), b"version one");
    assert_eq!(fs::read(&f.file).unwrap(), b"new current");
    assert!(history::list_recycle(&f.db).unwrap().is_empty());
    let legacy = f.root.join("_回收站/老客户/旧稿-20261101-120000.psd");
    fs::create_dir_all(legacy.parent().unwrap()).unwrap();
    fs::write(&legacy, b"legacy").unwrap();
    let rows = history::list_recycle(&f.db).unwrap();
    assert_eq!(rows.len(), 1);
    assert!(rows[0].legacy);
    let restored = history::restore_recycled(&f.db, &rows[0].id).unwrap();
    assert!(restored.path.ends_with("旧稿-20261101-120000.psd"));
    assert_eq!(fs::read(restored.path).unwrap(), b"legacy");
}

#[test]
fn rename_keeps_history_and_switching_library_never_exposes_other_snapshots() {
    let f = Fixture::new();
    let saved = history::save_version(&f.db, &f.file, "备注").unwrap();
    let renamed = library::file_rename(&f.db, &f.file, "改名.psd").unwrap();
    assert_eq!(
        history::list_versions(&f.db, Some(Path::new(&renamed.path))).unwrap()[0].id,
        saved.id
    );
    library::set_root(&f.db, &f.temp.path().join("另一文件库")).unwrap();
    assert!(history::list_versions(&f.db, None).unwrap().is_empty());
    assert!(history::restore_version(&f.db, &saved.id).is_err());
}

#[test]
fn failed_snapshot_metadata_write_leaves_original_bytes_unchanged() {
    let f = Fixture::new();
    f.db.execute_batch("CREATE TRIGGER reject_versions BEFORE INSERT ON file_versions BEGIN SELECT RAISE(ABORT,'injected metadata failure'); END;").unwrap();
    let incoming = f.temp.path().join("替换.psd");
    fs::write(&incoming, b"new bytes").unwrap();
    assert!(history::replace_version(&f.db, &f.file, &incoming, "失败").is_err());
    assert_eq!(fs::read(&f.file).unwrap(), b"version one");
    assert!(history::list_versions(&f.db, None).unwrap().is_empty());
}

#[test]
fn legacy_trash_rejects_path_traversal_and_junction_destinations() {
    let f = Fixture::new();
    assert!(history::restore_recycled(&f.db, "legacy:../私有.psd").is_err());
    let outside = f.temp.path().join("库外");
    fs::create_dir(&outside).unwrap();
    let link = f.root.join("链接");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        assert!(std::process::Command::new("cmd.exe")
            .creation_flags(0x08000000)
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&link)
            .arg(&outside)
            .output()
            .unwrap()
            .status
            .success());
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, &link).unwrap();
    let archived = f.root.join("_回收站/链接/恢复.psd");
    fs::create_dir_all(archived.parent().unwrap()).unwrap();
    fs::write(&archived, b"safe").unwrap();
    let row = history::list_recycle(&f.db).unwrap().pop().unwrap();
    assert!(history::restore_recycled(&f.db, &row.id).is_err());
    assert!(fs::read_dir(&outside).unwrap().next().is_none());
    assert_eq!(fs::read(archived).unwrap(), b"safe");
}

#[test]
fn legacy_recycle_and_versions_follow_project_then_client_folder_renames() {
    let f = Fixture::new();
    let saved = history::save_version(&f.db, &f.file, "保留改名前版本").unwrap();
    let canonical_root = f.root.canonicalize().unwrap();
    let relative = f.file.strip_prefix(&canonical_root).unwrap();
    let archived = f
        .root
        .join("_回收站")
        .join(relative)
        .with_file_name("旧稿-20261101.psd");
    fs::create_dir_all(archived.parent().unwrap()).unwrap();
    fs::write(&archived, b"legacy before rename").unwrap();
    f.db.execute("UPDATE projects SET title='新项目' WHERE id='p'", [])
        .unwrap();
    library::rename_project_folder(&f.db, Some(&f.root), "p").unwrap();
    f.db.execute("UPDATE clients SET name='新客户' WHERE id='c'", [])
        .unwrap();
    library::rename_client_folder(&f.db, Some(&f.root), "c").unwrap();
    let folder: String =
        f.db.query_row("SELECT folder FROM projects WHERE id='p'", [], |row| {
            row.get(0)
        })
        .unwrap();
    let recycled = history::list_recycle(&f.db).unwrap().pop().unwrap();
    assert!(recycled.original_rel_path.starts_with(&folder));
    assert!(recycled.legacy);
    assert_eq!(recycled.project_id.as_deref(), Some("p"));
    assert!(archived.is_file());
    let restored = history::restore_recycled(&f.db, &recycled.id).unwrap();
    assert_eq!(restored.project_id.as_deref(), Some("p"));
    assert_eq!(fs::read(restored.path).unwrap(), b"legacy before rename");
    let versions = history::list_versions(&f.db, None).unwrap();
    assert_eq!(versions[0].id, saved.id);
    assert!(versions[0].original_rel_path.starts_with(&folder));
}

#[test]
fn interrupted_trash_reservation_does_not_block_retry_or_show_missing_file() {
    let f = Fixture::new();
    library::file_trash(&f.db, &f.file).unwrap();
    let initial = history::list_recycle(&f.db).unwrap().pop().unwrap();
    // Reconstruct the crash window: committed metadata, bytes still at origin.
    fs::rename(&initial.stored_path, &f.file).unwrap();
    assert!(history::list_recycle(&f.db).unwrap().is_empty());
    library::file_trash(&f.db, &f.file).unwrap();
    let retry = history::list_recycle(&f.db).unwrap().pop().unwrap();
    assert_ne!(retry.stored_path, initial.stored_path);
    let restored = history::restore_recycled(&f.db, &retry.id).unwrap();
    assert_eq!(fs::read(restored.path).unwrap(), b"version one");
    assert!(history::list_recycle(&f.db).unwrap().is_empty());
}

#[test]
fn moving_the_whole_library_preserves_identity_and_history() {
    let f = Fixture::new();
    let saved = history::save_version(&f.db, &f.file, "移动文件库").unwrap();
    library::file_trash(&f.db, &f.file).unwrap();
    let moved = f.temp.path().join("移动后的文件库");
    fs::rename(&f.root, &moved).unwrap();
    library::set_root(&f.db, &moved).unwrap();
    let versions = history::list_versions(&f.db, None).unwrap();
    assert_eq!(versions[0].id, saved.id);
    assert!(Path::new(&versions[0].snapshot_path)
        .canonicalize()
        .unwrap()
        .starts_with(moved.canonicalize().unwrap()));
    assert_eq!(
        fs::read(&versions[0].snapshot_path).unwrap(),
        b"version one"
    );
    let recycle = history::list_recycle(&f.db).unwrap().pop().unwrap();
    let restored = history::restore_recycled(&f.db, &recycle.id).unwrap();
    assert!(Path::new(&restored.path)
        .canonicalize()
        .unwrap()
        .starts_with(moved.canonicalize().unwrap()));
    assert_eq!(fs::read(restored.path).unwrap(), b"version one");
}

#[test]
fn stale_legacy_id_cannot_restore_from_a_different_library() {
    let f = Fixture::new();
    let archive = f.root.join("_回收站/旧稿.psd");
    fs::create_dir(archive.parent().unwrap()).unwrap();
    fs::write(&archive, b"first library").unwrap();
    let stale = history::list_recycle(&f.db).unwrap().pop().unwrap();
    let other = f.temp.path().join("另一文件库");
    library::set_root(&f.db, &other).unwrap();
    fs::create_dir(other.join("_回收站")).unwrap();
    fs::write(other.join("_回收站/旧稿.psd"), b"second library").unwrap();
    assert!(history::restore_recycled(&f.db, &stale.id).is_err());
    assert!(!other.join("旧稿.psd").exists());
    assert_eq!(
        fs::read(other.join("_回收站/旧稿.psd")).unwrap(),
        b"second library"
    );
}

#[cfg(windows)]
#[test]
fn atomic_replacement_failure_keeps_original_and_durable_snapshot() {
    let f = Fixture::new();
    let incoming = f.temp.path().join("新稿.psd");
    fs::write(&incoming, b"new content").unwrap();
    let original_permissions = fs::metadata(&f.file).unwrap().permissions();
    let mut permissions = original_permissions.clone();
    permissions.set_readonly(true);
    fs::set_permissions(&f.file, permissions).unwrap();
    let result = history::replace_version(&f.db, &f.file, &incoming, "失败时保留");
    fs::set_permissions(&f.file, original_permissions).unwrap();
    assert!(result.is_err());
    assert_eq!(fs::read(&f.file).unwrap(), b"version one");
    let snapshots = history::list_versions(&f.db, None).unwrap();
    assert_eq!(snapshots.len(), 1);
    assert_eq!(
        fs::read(&snapshots[0].snapshot_path).unwrap(),
        b"version one"
    );
    assert!(fs::metadata(&snapshots[0].snapshot_path)
        .unwrap()
        .permissions()
        .readonly());
}
