mod dib;
#[cfg(windows)]
mod platform;

use crate::{
    error::{AppError, Result},
    library,
    models::{FileTarget, FilesAddResult},
    Database,
};
use std::{fs, path::Path};

pub(crate) enum Content {
    Files(Vec<String>),
    Png(Vec<u8>),
}

/// DROPFILES is a 20-byte header followed by a double-NUL UTF-16 path list.
pub fn dropfiles_buffer(paths: &[String]) -> Result<Vec<u8>> {
    if paths.is_empty()
        || paths
            .iter()
            .any(|path| path.is_empty() || path.contains('\0'))
    {
        return Err(AppError::invalid("请选择要复制的文件"));
    }
    let mut data = vec![0_u8; 20];
    data[..4].copy_from_slice(&20_u32.to_le_bytes());
    data[16..20].copy_from_slice(&1_u32.to_le_bytes());
    for path in paths {
        for unit in path.encode_utf16().chain([0]) {
            data.extend_from_slice(&unit.to_le_bytes());
        }
    }
    data.extend_from_slice(&[0, 0]);
    Ok(data)
}

pub fn pasted_image_name(stamp: &str, index: usize) -> String {
    library::numbered(&format!("粘贴图片 {stamp}.png"), index.max(1), false)
}

pub fn files_copy_to_clipboard(db: &impl Database, paths: &[String]) -> Result<()> {
    let paths = paths
        .iter()
        .map(|path| library::checked_file(db, Path::new(path)).map(|file| library::display(&file)))
        .collect::<Result<Vec<_>>>()?;
    let data = dropfiles_buffer(&paths)?;
    #[cfg(windows)]
    return platform::copy(&data);
    #[cfg(not(windows))]
    {
        let _ = data;
        Err(AppError::new("unsupported", "此功能仅支持 Windows"))
    }
}

pub fn files_paste(
    db: &impl Database,
    data_dir: &Path,
    target: &FileTarget,
    subfolder: Option<&str>,
) -> Result<FilesAddResult> {
    // Validate target library before touching the system clipboard.
    library::root(db)?;
    #[cfg(windows)]
    let content = platform::read()?;
    #[cfg(not(windows))]
    let content: Content = return Err(AppError::new("unsupported", "此功能仅支持 Windows"));
    paste_content(db, data_dir, target, subfolder, content)
}

fn paste_content(
    db: &impl Database,
    data_dir: &Path,
    target: &FileTarget,
    subfolder: Option<&str>,
    content: Content,
) -> Result<FilesAddResult> {
    match content {
        Content::Files(paths) => library::files_add(db, target, &paths, subfolder),
        Content::Png(bytes) => {
            // Temp files also stay under AppState.data_dir, including portable mode.
            fs::create_dir_all(data_dir)?;
            let temporary = tempfile::Builder::new()
                .prefix("clipboard-")
                .tempdir_in(data_dir)?;
            let stamp = chrono::Local::now().format("%Y%m%d-%H%M%S").to_string();
            let source = temporary.path().join(pasted_image_name(&stamp, 1));
            fs::write(&source, bytes)?;
            library::files_add(db, target, &[library::display(&source)], subfolder)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_and_image_paste_use_the_selected_new_template_for_existing_projects() {
        let temporary = tempfile::tempdir().unwrap();
        let db = crate::db::open(&temporary.path().join("client-desk.db")).unwrap();
        let root = temporary.path().join("文件库");
        library::set_root(&db, &root).unwrap();
        db.execute("INSERT INTO clients(id,name,created_at,updated_at) VALUES('c','客户','2026-11-05T00:00:00Z','2026-11-05T00:00:00Z')", []).unwrap();
        db.execute("INSERT INTO projects(id,client_id,title,created_at,updated_at) VALUES('p','c','项目','2026-11-05T00:00:00Z','2026-11-05T00:00:00Z')", []).unwrap();
        let target = FileTarget::Project {
            project_id: "p".into(),
        };
        let base = library::ensure_folder(&db, &target).unwrap();
        crate::repo::settings::write(&db, "subfolderTemplate", &vec!["新文件", "新截图"]).unwrap();
        let source = temporary.path().join("资料.txt");
        fs::write(&source, b"document").unwrap();
        for (name, content, expected) in [
            (
                "新文件",
                Content::Files(vec![library::display(&source)]),
                b"document".as_slice(),
            ),
            (
                "新截图",
                Content::Png(b"png bytes".to_vec()),
                b"png bytes".as_slice(),
            ),
        ] {
            assert!(!base.join(name).exists());
            let result = paste_content(
                &db,
                &temporary.path().join("数据"),
                &target,
                Some(name),
                content,
            )
            .unwrap();
            assert!(result.failed.is_empty());
            assert_eq!(result.added.len(), 1);
            assert_eq!(result.added[0].folder_group, name);
            assert_eq!(fs::read(&result.added[0].path).unwrap(), expected);
        }
    }
    #[test]
    fn dropfiles_header_unicode_paths_and_double_terminator() {
        let paths = vec![
            "D:\\客户资料\\封面.psd".to_owned(),
            "D:\\稿件\\猫🐈.png".to_owned(),
        ];
        let data = dropfiles_buffer(&paths).unwrap();
        assert_eq!(&data[..4], &20_u32.to_le_bytes());
        assert_eq!(&data[4..16], &[0; 12]);
        assert_eq!(&data[16..20], &1_u32.to_le_bytes());
        let wide: Vec<_> = data[20..]
            .chunks_exact(2)
            .map(|b| u16::from_le_bytes([b[0], b[1]]))
            .collect();
        assert_eq!(
            String::from_utf16(&wide).unwrap(),
            format!("{}\0{}\0\0", paths[0], paths[1])
        );
        assert!(dropfiles_buffer(&[]).is_err());
        assert!(dropfiles_buffer(&["bad\0path".into()]).is_err());
    }
    #[test]
    fn clipboard_png_filename_is_deterministic_and_numbers_before_extension() {
        assert_eq!(
            pasted_image_name("20261102-112233", 1),
            "粘贴图片 20261102-112233.png"
        );
        assert_eq!(
            pasted_image_name("20261102-112233", 2),
            "粘贴图片 20261102-112233 (2).png"
        );
        assert_eq!(
            pasted_image_name("20261102-112233", 10),
            "粘贴图片 20261102-112233 (10).png"
        );
    }
}
