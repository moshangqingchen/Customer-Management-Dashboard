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
