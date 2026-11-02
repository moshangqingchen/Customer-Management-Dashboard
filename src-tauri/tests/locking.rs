use client_desk_lib::{
    library,
    models::FileTarget,
    repo::{activities, clients, projects},
    AppState, Database,
};
use rusqlite::params;
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Barrier},
    thread,
    time::Duration,
};
use tempfile::TempDir;

struct Fixture {
    tmp: TempDir,
    state: Arc<AppState>,
    root: PathBuf,
}

fn target() -> FileTarget {
    FileTarget::Project {
        project_id: "p1".into(),
    }
}

impl Fixture {
    fn new() -> Self {
        let tmp = tempfile::tempdir().unwrap();
        let state = Arc::new(AppState::open(tmp.path().join("数据")).unwrap());
        let root = tmp.path().join("文件库");
        fs::create_dir(&root).unwrap();
        library::set_root(&*state, &root).unwrap();
        state
            .read(|db| {
                let date = "2026-11-15T10:30:00Z";
                db.execute(
                    "INSERT INTO clients(id,name,created_at,updated_at) VALUES('c1','林女士',?1,?1)",
                    [date],
                )?;
                db.execute(
                    "INSERT INTO projects(id,client_id,title,created_at,updated_at)
                     VALUES('p1','c1','宣传单设计',?1,?1)",
                    params![date],
                )?;
                Ok(())
            })
            .unwrap();
        Self { tmp, state, root }
    }

    fn source(&self, name: &str, content: &[u8]) -> String {
        let path = self.tmp.path().join(name);
        fs::write(&path, content).unwrap();
        path.to_string_lossy().into_owned()
    }

    fn folder(&self) -> String {
        self.state
            .read(|db| {
                Ok(
                    db.query_row("SELECT folder FROM projects WHERE id='p1'", [], |row| {
                        row.get(0)
                    })?,
                )
            })
            .unwrap()
    }

    fn count(&self) -> i64 {
        library::project_file_count(Some(&self.root), Some(&self.folder()))
    }
}

#[test]
fn concurrent_adds_share_one_new_project_folder_and_preserve_same_name_files() {
    let f = Fixture::new();
    let source = f.source("封面.psd", b"design source");
    let start = Arc::new(Barrier::new(3));
    let workers: Vec<_> = (0..2)
        .map(|_| {
            let state = Arc::clone(&f.state);
            let start = Arc::clone(&start);
            let source = source.clone();
            thread::spawn(move || {
                start.wait();
                library::files_add(&*state, &target(), &[source], None)
            })
        })
        .collect();
    start.wait();
    let mut copied = Vec::new();
    for worker in workers {
        copied.extend(worker.join().unwrap().unwrap().added);
    }
    assert_eq!(copied.len(), 2);
    assert_ne!(copied[0].path, copied[1].path);
    for file in &copied {
        assert_eq!(fs::read(&file.path).unwrap(), b"design source");
    }
    assert_eq!(fs::read_dir(&f.root).unwrap().count(), 1);
    let project_dirs: Vec<_> = fs::read_dir(f.root.join("林女士"))
        .unwrap()
        .map(|entry| entry.unwrap())
        .filter(|entry| entry.file_name().to_string_lossy().starts_with("2026-11 "))
        .collect();
    assert_eq!(project_dirs.len(), 1);
    assert_eq!(project_dirs[0].path(), f.root.join(f.folder()));
    assert_eq!(
        library::files_list(&*f.state, &target(), false)
            .unwrap()
            .files
            .len(),
        2
    );
    let notes = f
        .state
        .read(|db| activities::list(db, None, Some("p1"), None))
        .unwrap();
    assert_eq!(notes.len(), 2);
    assert!(notes
        .iter()
        .all(|activity| activity.body == "添加了 1 个文件"));
}

#[test]
fn slow_file_copy_does_not_hold_the_database_mutex() {
    let f = Fixture::new();
    let source = f.source("大设计稿.psd", b"design source");
    let (started_tx, started_rx) = mpsc::channel();
    let (resume_tx, resume_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let copying = thread::spawn(move || {
        library::files_add_with_copy_hook(&*state, &target(), &[source], None, |_| {
            started_tx.send(()).unwrap();
            resume_rx.recv_timeout(Duration::from_secs(10)).unwrap();
        })
    });
    let started = started_rx.recv_timeout(Duration::from_secs(5));
    let (queried_tx, queried_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let querying = thread::spawn(move || {
        let result = state.read(clients::list);
        queried_tx.send(result).unwrap();
    });
    let queried = queried_rx.recv_timeout(Duration::from_secs(2));
    // Always release and join both workers before asserting, including a lock regression.
    let _ = resume_tx.send(());
    let copied = copying.join().unwrap();
    querying.join().unwrap();
    started.unwrap();
    assert_eq!(queried.expect("客户查询被文件复制阻塞").unwrap().len(), 1);
    assert_eq!(copied.unwrap().added.len(), 1);
}

#[test]
fn file_count_cache_is_invalidated_by_add_rename_trash_and_folder_open() {
    let f = Fixture::new();
    let base = library::ensure_folder(&*f.state, &target()).unwrap();
    assert_eq!(f.count(), 0);
    fs::write(base.join("外部保存.psd"), b"external").unwrap();
    assert_eq!(f.count(), 0, "外部写入在缓存有效期内沿用旧计数");

    let source = f.source("新稿.ai", b"new");
    let added = library::files_add(&*f.state, &target(), &[source], None)
        .unwrap()
        .added;
    assert_eq!(f.count(), 2, "添加文件必须立即使此前缓存失效");
    library::file_rename(&*f.state, Path::new(&added[0].path), ".隐藏.ai").unwrap();
    assert_eq!(f.count(), 1, "重命名后重新应用可见文件规则");
    library::file_trash(&*f.state, &base.join("外部保存.psd")).unwrap();
    assert_eq!(f.count(), 0, "移入回收站后必须重新计数");

    fs::write(base.join("再次保存.psd"), b"saved").unwrap();
    assert_eq!(f.count(), 0);
    library::ensure_folder(&*f.state, &target()).unwrap();
    assert_eq!(f.count(), 1, "打开已有文件夹也必须使缓存失效");
}

#[test]
fn concurrent_renames_to_the_same_name_preserve_both_original_contents() {
    let f = Fixture::new();
    let sources = [
        f.source("初稿.ai", b"first design"),
        f.source("终稿.ai", b"second design"),
    ];
    let added = library::files_add(&*f.state, &target(), &sources, None)
        .unwrap()
        .added;
    let start = Arc::new(Barrier::new(3));
    let workers: Vec<_> = added
        .into_iter()
        .map(|file| {
            let state = Arc::clone(&f.state);
            let start = Arc::clone(&start);
            thread::spawn(move || {
                start.wait();
                library::file_rename(&*state, Path::new(&file.path), "交付.ai")
            })
        })
        .collect();
    start.wait();
    let results: Vec<_> = workers
        .into_iter()
        .map(|worker| worker.join().unwrap())
        .collect();
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    let errors: Vec<_> = results
        .iter()
        .filter_map(|result| result.as_ref().err())
        .collect();
    assert_eq!(errors.len(), 1);
    assert_eq!(errors[0].code, "exists");

    let listed = library::files_list(&*f.state, &target(), false).unwrap();
    assert_eq!(listed.files.len(), 2);
    let mut contents: Vec<_> = listed
        .files
        .iter()
        .map(|file| fs::read(&file.path).unwrap())
        .collect();
    contents.sort();
    assert_eq!(
        contents,
        [b"first design".to_vec(), b"second design".to_vec()]
    );
    assert_eq!(
        listed
            .files
            .iter()
            .filter(|file| file.name == "交付.ai")
            .count(),
        1
    );
}

#[test]
fn rename_cannot_replace_a_destination_reserved_by_an_in_progress_copy() {
    let f = Fixture::new();
    let original_source = f.source("保留原稿.ai", b"original design");
    let original = library::files_add(&*f.state, &target(), &[original_source], None)
        .unwrap()
        .added
        .remove(0);
    let source = f.source("占用名称.ai", b"copied design");
    let (started_tx, started_rx) = mpsc::channel();
    let (resume_tx, resume_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let copying = thread::spawn(move || {
        library::files_add_with_copy_hook(&*state, &target(), &[source], None, |_| {
            started_tx.send(()).unwrap();
            resume_rx.recv_timeout(Duration::from_secs(10)).unwrap();
        })
    });
    let started = started_rx.recv_timeout(Duration::from_secs(5));
    let (renamed_tx, renamed_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let original_path = PathBuf::from(&original.path);
    let renaming = thread::spawn(move || {
        let result = library::file_rename(&*state, &original_path, "占用名称.ai");
        renamed_tx.send(result).unwrap();
    });
    let renamed = renamed_rx.recv_timeout(Duration::from_secs(2));
    let _ = resume_tx.send(());
    let copied = copying.join().unwrap();
    renaming.join().unwrap();
    started.unwrap();
    assert_eq!(
        renamed.expect("重命名被复制字节阶段阻塞").unwrap_err().code,
        "exists"
    );
    let copied = copied.unwrap().added;
    assert_eq!(copied.len(), 1);
    assert_eq!(fs::read(&copied[0].path).unwrap(), b"copied design");
    assert_eq!(fs::read(&original.path).unwrap(), b"original design");
}

#[test]
fn copy_completion_uses_the_projects_current_client_after_a_transfer() {
    let f = Fixture::new();
    let source = f.source("转移期间的设计稿.psd", b"design source");
    let (started_tx, started_rx) = mpsc::channel();
    let (resume_tx, resume_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let copying = thread::spawn(move || {
        library::files_add_with_copy_hook(&*state, &target(), &[source], None, |_| {
            started_tx.send(()).unwrap();
            resume_rx.recv_timeout(Duration::from_secs(10)).unwrap();
        })
    });
    let started = started_rx.recv_timeout(Duration::from_secs(5));
    let (transferred_tx, transferred_rx) = mpsc::channel();
    let state = Arc::clone(&f.state);
    let transferring = thread::spawn(move || {
        let result = state.read(|db| {
            db.execute(
                "INSERT INTO clients(id,name,created_at,updated_at)
                 VALUES('c2','新客户','2026-11-15T10:30:00Z','2026-11-15T10:30:00Z')",
                [],
            )?;
            projects::update_record(
                db,
                "p1",
                serde_json::from_value(serde_json::json!({"clientId":"c2"})).unwrap(),
            )?;
            Ok(())
        });
        transferred_tx.send(result).unwrap();
    });
    let transferred = transferred_rx.recv_timeout(Duration::from_secs(2));
    let _ = resume_tx.send(());
    let copied = copying.join().unwrap();
    transferring.join().unwrap();
    started.unwrap();
    transferred.expect("项目转移被文件复制阻塞").unwrap();
    let copied = copied.unwrap().added;
    assert_eq!(copied.len(), 1);
    assert_eq!(copied[0].client_id.as_deref(), Some("c2"));
    let notes = f
        .state
        .read(|db| activities::list(db, None, Some("p1"), None))
        .unwrap();
    assert_eq!(notes.len(), 1);
    assert_eq!(notes[0].client_id, "c2");
    assert_eq!(notes[0].body, "添加了 1 个文件");
}
