use client_desk_lib::{
    db, library,
    models::{FileKind, FileTarget, LibraryState},
    repo::activities,
};
use rusqlite::{params, Connection};
use std::{
    fs,
    path::{Path, PathBuf},
};
use tempfile::TempDir;

struct Fixture {
    tmp: TempDir,
    db: Connection,
    root: PathBuf,
}

fn project(id: &str) -> FileTarget {
    FileTarget::Project {
        project_id: id.into(),
    }
}
fn client(id: &str) -> FileTarget {
    FileTarget::Client {
        client_id: id.into(),
    }
}

impl Fixture {
    fn new() -> Self {
        let tmp = tempfile::tempdir().unwrap();
        let db = db::open(&tmp.path().join("clients.db")).unwrap();
        let root = tmp.path().join("客户工作台");
        fs::create_dir(&root).unwrap();
        assert_eq!(
            library::status(&db).unwrap().state,
            LibraryState::NotConfigured
        );
        let status = library::set_root(&db, &root).unwrap();
        assert_eq!(status.state, LibraryState::Ready);
        assert_eq!(
            Path::new(status.root.as_ref().unwrap())
                .canonicalize()
                .unwrap(),
            root.canonicalize().unwrap()
        );
        let date = "2026-11-15T10:30:00Z";
        for id in ["c1", "c2"] {
            db.execute(
                "INSERT INTO clients(id,name,created_at,updated_at) VALUES(?1,'小林',?2,?2)",
                params![id, date],
            )
            .unwrap();
        }
        for id in ["p1", "p2"] {
            db.execute("INSERT INTO projects(id,client_id,title,created_at,updated_at) VALUES(?1,'c1','海报/设计',?2,?2)", params![id, date]).unwrap();
        }
        Self { tmp, db, root }
    }

    fn path(&self, name: &str) -> String {
        self.tmp.path().join(name).to_string_lossy().into_owned()
    }
    fn sources(&self) -> Vec<String> {
        let tree = self.tmp.path().join("素材包");
        fs::create_dir_all(tree.join("照片")).unwrap();
        fs::write(tree.join("照片").join("猫.JPG"), b"cat").unwrap();
        fs::write(tree.join("版式.ai"), b"art").unwrap();
        fs::write(self.path("封面.pdf"), b"pdf").unwrap();
        vec![
            self.path("封面.pdf"),
            self.path("封面.pdf"),
            self.path("素材包"),
        ]
    }
}

#[test]
fn confirming_a_suggested_library_creates_missing_directories() {
    let tmp = tempfile::tempdir().unwrap();
    let db = db::open(&tmp.path().join("client-desk.db")).unwrap();
    let suggested = tmp.path().join("新位置").join("客户资料库");
    assert!(!suggested.exists());
    let status = library::set_root(&db, &suggested).unwrap();
    assert_eq!(status.state, LibraryState::Ready);
    assert!(suggested.is_dir());
    assert_eq!(
        library::root(&db).unwrap(),
        suggested.canonicalize().unwrap()
    );
}

#[test]
fn sanitize_windows_folder_names() {
    assert_eq!(library::sanitize(" .小/店:\n*?\"<>|. "), "小_店________");
    assert_eq!(library::sanitize(" . . "), "未命名");
    assert_eq!(library::sanitize("CON"), "CON_");
    assert_eq!(library::sanitize("nuL.txt"), "nuL_.txt");
    assert_eq!(library::sanitize("com9"), "com9_");
    assert_eq!(library::sanitize("LPT10"), "LPT10");
    let long = "猫".repeat(120);
    assert_eq!(library::sanitize(&long).chars().count(), 80);
}

#[test]
fn offline_library_is_reported_without_losing_the_configured_root() {
    let f = Fixture::new();
    assert_eq!(
        library::set_root(&f.db, Path::new("相对路径"))
            .unwrap_err()
            .code,
        "invalid"
    );
    assert_eq!(
        library::set_root(&f.db, &f.tmp.path().join("clients.db"))
            .unwrap_err()
            .code,
        "libraryUnavailable"
    );
    let moved = f.tmp.path().join("磁盘离线");
    fs::rename(&f.root, &moved).unwrap();
    assert_eq!(library::status(&f.db).unwrap().state, LibraryState::Missing);
    assert_eq!(
        library::files_recent(&f.db, 10).unwrap_err().code,
        "libraryUnavailable"
    );
    fs::rename(moved, &f.root).unwrap();
    assert_eq!(library::status(&f.db).unwrap().state, LibraryState::Ready);
}

#[test]
fn list_is_read_only_and_folder_creation_is_lazy_unique_and_uses_template() {
    let f = Fixture::new();
    let empty = library::files_list(&f.db, &project("p1"), false).unwrap();
    assert!(!empty.folder_missing && empty.folder.is_none());
    assert_eq!(fs::read_dir(&f.root).unwrap().count(), 0);
    let first = library::ensure_folder(&f.db, &project("p1")).unwrap();
    assert!(first.ends_with(Path::new("小林/2026-11 海报_设计")));
    for name in ["参考资料", "过程稿", "交付成品"] {
        assert!(first.join(name).is_dir());
    }
    let second = library::ensure_folder(&f.db, &project("p2")).unwrap();
    assert!(second.ends_with("2026-11 海报_设计 (2)"));
    let second_client = library::ensure_folder(&f.db, &client("c2")).unwrap();
    assert!(second_client.ends_with(Path::new("小林 (2)/_客户资料")));
    fs::rename(&first, first.with_file_name("手动移动")).unwrap();
    let missing = library::files_list(&f.db, &project("p1"), false).unwrap();
    assert!(missing.folder_missing && missing.files.is_empty() && !first.exists());
    assert_eq!(
        library::ensure_folder(&f.db, &project("p1"))
            .unwrap_err()
            .code,
        "libraryUnavailable"
    );
}

#[test]
fn import_copy_and_filesystem_views_reflect_current_files() {
    let f = Fixture::new();
    let sources = f.sources();
    let added = library::files_add(&f.db, &project("p1"), &sources, Some("过程稿"))
        .unwrap()
        .added;
    assert_eq!(added.len(), 4);
    assert_eq!(added[1].name, "封面 (2).pdf");
    let photo = added.iter().find(|e| e.name == "猫.JPG").unwrap();
    assert_eq!(photo.kind, FileKind::Image);
    assert_eq!(photo.folder_group, "过程稿/素材包/照片");
    assert_eq!(photo.size_bytes, 3);
    assert!(Path::new(&sources[0]).is_file());
    let recent_note = &activities::list(&f.db, Some("c1"), None, Some(1)).unwrap()[0];
    assert_eq!(recent_note.body, "添加了 4 个文件");
    assert_eq!(recent_note.meta["names"].as_array().unwrap().len(), 4);

    let base = library::ensure_folder(&f.db, &project("p1")).unwrap();
    for ignored in [".隐藏", "~$草稿.doc", "Thumbs.db", "desktop.ini"] {
        fs::write(base.join(ignored), "").unwrap();
    }
    fs::write(base.join("自行保存.psd"), "外部设计稿").unwrap();
    let docs = library::ensure_folder(&f.db, &client("c1")).unwrap();
    fs::write(docs.join("名片.png"), "名片").unwrap();
    let list = library::files_list(&f.db, &project("p1"), false).unwrap();
    assert_eq!(list.files.len(), 4); // The photo is below the three-level list depth.
    assert!(list
        .files
        .iter()
        .any(|e| e.folder_group.is_empty() && e.kind == FileKind::Design));
    assert_eq!(
        library::project_file_count(Some(&f.root), Some("小林/2026-11 海报_设计")),
        4
    );
    let aggregate = library::files_list(&f.db, &client("c1"), true).unwrap();
    assert_eq!(aggregate.files.len(), 5);
    assert!(aggregate
        .files
        .iter()
        .any(|e| e.project_id.as_deref() == Some("p1") && e.name == "自行保存.psd"));
    assert!(aggregate
        .files
        .iter()
        .any(|e| e.project_id.is_none() && e.name == "名片.png"));
    for excluded in ["_回收站", "_备份"] {
        fs::create_dir(f.root.join(excluded)).unwrap();
        fs::write(f.root.join(excluded).join("排除.txt"), "排除").unwrap();
    }
    fs::write(f.root.join("库根.txt"), "无归属").unwrap();
    let recent = library::files_recent(&f.db, 99).unwrap();
    assert_eq!(recent.len(), 7);
    assert!(recent
        .windows(2)
        .all(|items| items[0].modified_at >= items[1].modified_at));
    assert!(recent.iter().any(|e| e.name == "猫.JPG"
        && e.client_id.as_deref() == Some("c1")
        && e.project_id.as_deref() == Some("p1")));
    assert!(recent
        .iter()
        .any(|e| e.name == "库根.txt" && e.client_id.is_none()));
    f.db.execute(
        "UPDATE projects SET deleted_at='2026-11-15' WHERE id='p1'",
        [],
    )
    .unwrap();
    assert_eq!(library::files_recent(&f.db, 99).unwrap().len(), 2);
}

#[test]
fn project_cover_shares_the_count_scan_depth_visibility_size_and_cache_rules() {
    use std::time::{Duration, SystemTime};

    let f = Fixture::new();
    assert_eq!(
        library::project_files(None, None),
        library::ProjectFiles::default()
    );
    let base = library::ensure_folder(&f.db, &project("p1")).unwrap();
    fs::create_dir_all(base.join("一层/二层/三层")).unwrap();
    let changed = SystemTime::UNIX_EPOCH + Duration::from_secs(1_000_000);
    let write = |name: &str, size: u64, seconds: u64| {
        let path = base.join(name);
        let file = fs::File::create(&path).unwrap();
        file.set_len(size).unwrap();
        file.set_modified(changed + Duration::from_secs(seconds))
            .unwrap();
        path
    };
    write("初稿.png", 10, 1);
    write("一层/二层/终稿.JPEG", 10, 2);
    write("一层/二层/三层/太深.png", 10, 9);
    let latest = write("过大.webp", 25 * 1024 * 1024 + 1, 9);
    write("矢量.svg", 10, 6);
    write("位图.bmp", 10, 7);
    write(".隐藏.png", 10, 9);
    let folder: String =
        f.db.query_row("SELECT folder FROM projects WHERE id='p1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    let files = library::project_files(Some(&f.root), Some(&folder));
    assert_eq!(files.file_count, 5);
    assert_eq!(
        Path::new(files.cover_path.as_ref().unwrap())
            .canonicalize()
            .unwrap(),
        latest.canonicalize().unwrap()
    );

    let newest = write("边界.gif", 25 * 1024 * 1024, 10);
    assert_eq!(
        library::project_files(Some(&f.root), Some(&folder)),
        files,
        "外部修改的计数和封面必须共享同一缓存"
    );
    library::ensure_folder(&f.db, &project("p1")).unwrap();
    let refreshed = library::project_files(Some(&f.root), Some(&folder));
    assert_eq!(refreshed.file_count, 6);
    assert_eq!(
        Path::new(refreshed.cover_path.as_ref().unwrap())
            .canonicalize()
            .unwrap(),
        newest.canonicalize().unwrap()
    );
    library::file_trash(&f.db, &newest).unwrap();
    assert_eq!(library::project_files(Some(&f.root), Some(&folder)), files);
}

#[test]
fn project_cover_prefers_any_image_then_latest_design_or_pdf() {
    use std::time::{Duration, SystemTime};
    let f = Fixture::new();
    let base = library::ensure_folder(&f.db, &project("p1")).unwrap();
    let folder: String =
        f.db.query_row("SELECT folder FROM projects WHERE id='p1'", [], |row| {
            row.get(0)
        })
        .unwrap();
    let write = |name: &str, seconds| {
        let path = base.join(name);
        let file = fs::File::create(&path).unwrap();
        file.set_modified(SystemTime::UNIX_EPOCH + Duration::from_secs(seconds))
            .unwrap();
        path
    };
    write("旧稿.psd", 1);
    let pdf = write("交付.pdf", 2);
    write("参考.txt", 100);
    library::ensure_folder(&f.db, &project("p1")).unwrap();
    assert_eq!(
        Path::new(
            library::project_files(Some(&f.root), Some(&folder))
                .cover_path
                .as_ref()
                .unwrap()
        )
        .canonicalize()
        .unwrap(),
        pdf.canonicalize().unwrap()
    );
    let image = write("图标.svg", 1);
    library::ensure_folder(&f.db, &project("p1")).unwrap();
    assert_eq!(
        Path::new(
            library::project_files(Some(&f.root), Some(&folder))
                .cover_path
                .as_ref()
                .unwrap()
        )
        .canonicalize()
        .unwrap(),
        image.canonicalize().unwrap()
    );
}

#[test]
fn failed_batch_preserves_successful_files_and_reports_failures_in_activity() {
    let f = Fixture::new();
    let mut sources = f.sources();
    sources.push(f.path("不存在.txt"));
    let result = library::files_add(&f.db, &project("p1"), &sources, None).unwrap();
    assert_eq!(result.failed.len(), 1);
    assert_eq!(result.failed[0].name, "不存在.txt");
    assert!(!result.failed[0].message.is_empty());
    let copied = result.added;
    assert_eq!(copied.len(), 4);
    for file in &copied {
        assert!(Path::new(&file.path).is_file());
    }
    let listed = library::files_list(&f.db, &project("p1"), false).unwrap();
    assert!(listed.folder.is_some());
    assert_eq!(listed.files.len(), copied.len());
    let activity = &activities::list(&f.db, Some("c1"), None, Some(1)).unwrap()[0];
    assert!(activity.body.contains("添加了 4 个文件"));
    assert!(activity.body.contains("不存在.txt"));
    assert_eq!(activity.meta["names"].as_array().unwrap().len(), 4);
    assert_eq!(
        activity.meta["failedNames"],
        serde_json::json!(["不存在.txt"])
    );
    let folder = library::ensure_folder(&f.db, &project("p1")).unwrap();
    let recursive = folder.parent().unwrap().to_string_lossy().to_string();
    let result = library::files_add(&f.db, &project("p1"), &[recursive], None).unwrap();
    assert!(result.added.is_empty());
    assert_eq!(result.failed.len(), 1);
    assert!(result.failed[0].message.contains("自身"));
    assert!(folder.is_dir());
}

#[test]
fn wholly_failed_batch_names_each_failure_and_does_not_write_success_activity() {
    let f = Fixture::new();
    let sources = [f.path("缺失甲.psd"), f.path("缺失乙.ai")];
    let result = library::files_add(&f.db, &project("p1"), &sources, None).unwrap();
    assert!(result.added.is_empty());
    assert_eq!(result.failed.len(), 2);
    assert_eq!(result.failed[0].name, "缺失甲.psd");
    assert_eq!(result.failed[1].name, "缺失乙.ai");
    assert!(result.failed.iter().all(|file| !file.message.is_empty()));
    assert!(activities::list(&f.db, Some("c1"), None, None)
        .unwrap()
        .is_empty());
    assert!(library::files_list(&f.db, &project("p1"), false)
        .unwrap()
        .files
        .is_empty());
}

#[test]
fn directory_batch_keeps_copied_files_and_reports_unsafe_nested_entries() {
    let f = Fixture::new();
    let source = f.tmp.path().join("带失败的素材包");
    fs::create_dir(&source).unwrap();
    fs::write(source.join("可用.ai"), b"design source").unwrap();
    let outside = f.tmp.path().join("不可跟随");
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("私有.txt"), b"secret").unwrap();
    let link = source.join("链接资料");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        let result = std::process::Command::new("cmd.exe")
            .creation_flags(0x08000000)
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&link)
            .arg(&outside)
            .output()
            .unwrap();
        assert!(result.status.success());
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, &link).unwrap();
    let result = library::files_add(
        &f.db,
        &project("p1"),
        &[source.to_string_lossy().into_owned()],
        None,
    )
    .unwrap();
    assert_eq!(result.added.len(), 1);
    assert_eq!(result.added[0].name, "可用.ai");
    assert_eq!(fs::read(&result.added[0].path).unwrap(), b"design source");
    assert!(result
        .failed
        .iter()
        .any(|failure| failure.name == "链接资料"));
    assert!(result
        .failed
        .iter()
        .all(|failure| !failure.message.is_empty()));
    let note = &activities::list(&f.db, Some("c1"), None, Some(1)).unwrap()[0];
    assert_eq!(note.meta["names"], serde_json::json!(["可用.ai"]));
    assert!(note.body.contains("链接资料"));
    assert!(outside.join("私有.txt").is_file());
}

#[test]
fn rename_and_trash_copy_path_stays_in_library_and_preserves_collisions() {
    let f = Fixture::new();
    let files = library::files_add(&f.db, &project("p1"), &f.sources(), None)
        .unwrap()
        .added;
    let original = Path::new(&files[0].path);
    assert_eq!(
        library::file_rename(&f.db, original, "../新名")
            .unwrap_err()
            .code,
        "invalid"
    );
    assert_eq!(
        library::file_rename(&f.db, original, &files[1].name)
            .unwrap_err()
            .code,
        "exists"
    );
    let renamed = library::file_rename(&f.db, original, "交付.pdf").unwrap();
    assert_eq!(renamed.project_id.as_deref(), Some("p1"));
    let path = Path::new(&renamed.path);
    library::file_trash(&f.db, path).unwrap();
    let trashed = f.root.join("_回收站").join(&renamed.rel_path);
    assert_eq!(fs::read(&trashed).unwrap(), b"pdf");
    fs::write(path, "新版").unwrap();
    library::file_trash(&f.db, path).unwrap();
    assert!(!path.exists());
    assert_eq!(fs::read(&trashed).unwrap(), b"pdf");
    assert_eq!(fs::read_dir(trashed.parent().unwrap()).unwrap().count(), 2);

    let outside = f.tmp.path().join("封面.pdf");
    assert_eq!(
        library::file_trash(&f.db, &outside).unwrap_err().code,
        "outsideLibrary"
    );
    assert_eq!(
        library::file_rename(&f.db, &outside, "x").unwrap_err().code,
        "outsideLibrary"
    );
    assert_eq!(
        library::checked_file(&f.db, &outside).unwrap_err().code,
        "outsideLibrary"
    );
    assert_eq!(
        library::files_add(&f.db, &project("p1"), &[f.path("封面.pdf")], Some("../"))
            .unwrap_err()
            .code,
        "outsideLibrary"
    );
}

#[test]
fn folder_rename_updates_recorded_paths_including_deleted_projects() {
    let f = Fixture::new();
    let p1 = library::ensure_folder(&f.db, &project("p1")).unwrap();
    let p2 = library::ensure_folder(&f.db, &project("p2")).unwrap();
    f.db.execute(
        "UPDATE projects SET deleted_at='2026-11-15' WHERE id='p2'",
        [],
    )
    .unwrap();
    f.db.execute("UPDATE clients SET name='林先生' WHERE id='c1'", [])
        .unwrap();
    library::rename_client_folder(&f.db, Some(&f.root), "c1").unwrap();
    assert!(!p1.exists() && !p2.exists());
    let folder: String =
        f.db.query_row("SELECT folder FROM projects WHERE id='p2'", [], |r| {
            r.get(0)
        })
        .unwrap();
    assert!(folder.starts_with("林先生/"));
    assert!(f.root.join(folder).is_dir());
    f.db.execute("UPDATE projects SET title='新标题' WHERE id='p1'", [])
        .unwrap();
    library::rename_project_folder(&f.db, Some(&f.root), "p1").unwrap();
    assert!(f.root.join("林先生/2026-11 新标题").is_dir());
}

#[test]
fn folder_junctions_cannot_leak_files_or_redirect_writes() {
    let f = Fixture::new();
    let project_folder = library::ensure_folder(&f.db, &project("p1")).unwrap();
    let outside = f.tmp.path().join("库外");
    fs::create_dir(&outside).unwrap();
    fs::write(outside.join("私有.txt"), b"secret").unwrap();
    let link = project_folder.join("跳转");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // NTFS junction creation works without symlink privileges.
        let result = std::process::Command::new("cmd.exe")
            .creation_flags(0x08000000)
            .args(["/d", "/c", "mklink", "/J"])
            .arg(&link)
            .arg(&outside)
            .output()
            .unwrap();
        assert!(
            result.status.success(),
            "{}",
            String::from_utf8_lossy(&result.stderr)
        );
    }
    #[cfg(unix)]
    std::os::unix::fs::symlink(&outside, &link).unwrap();
    assert_eq!(
        library::checked_file(&f.db, &link.join("私有.txt"))
            .unwrap_err()
            .code,
        "outsideLibrary"
    );
    assert!(library::files_list(&f.db, &project("p1"), false)
        .unwrap()
        .files
        .is_empty());
    assert!(library::files_recent(&f.db, 100).unwrap().is_empty());
    assert_eq!(
        library::files_add(&f.db, &project("p1"), &f.sources(), Some("跳转"))
            .unwrap_err()
            .code,
        "outsideLibrary"
    );
    assert_eq!(fs::read_dir(&outside).unwrap().count(), 1);
}
