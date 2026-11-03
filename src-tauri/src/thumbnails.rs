#[cfg(windows)]
mod shell;
#[cfg(windows)]
mod workers;

use crate::{
    error::{AppError, Result},
    library, Database,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    time::SystemTime,
};

const CACHE_LIMIT: u64 = 300 * 1024 * 1024;

fn cache_path(source: &Path, cache: &Path, size: u32) -> Result<PathBuf> {
    let metadata = fs::metadata(source)?;
    let modified = metadata
        .modified()?
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(|_| AppError::invalid("文件修改时间无效"))?;
    let mut hash = Sha256::new();
    hash.update(library::display(source).as_bytes());
    hash.update([0]);
    hash.update(modified.as_secs().to_le_bytes());
    hash.update(modified.subsec_nanos().to_le_bytes());
    hash.update(metadata.len().to_le_bytes());
    hash.update(size.to_le_bytes());
    Ok(cache.join(format!("{:x}.png", hash.finalize())))
}

pub(crate) fn encode_png(width: u32, height: u32, rgba: &[u8]) -> Result<Vec<u8>> {
    let mut bytes = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut bytes, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder
            .write_header()
            .map_err(|e| AppError::new("io", format!("无法编码图片（{e}）")))?;
        writer
            .write_image_data(rgba)
            .map_err(|e| AppError::new("io", format!("无法编码图片（{e}）")))?;
    }
    Ok(bytes)
}

fn touch(path: &Path) {
    // File access times may be disabled by Windows. Our own use clock is mtime.
    if let Ok(file) = fs::OpenOptions::new().write(true).open(path) {
        let _ = file.set_modified(SystemTime::now());
    }
}

pub(crate) fn prune(cache: &Path, limit: u64) -> Result<()> {
    let mut entries = Vec::new();
    let mut total = 0_u64;
    for entry in fs::read_dir(cache)? {
        let entry = entry?;
        let metadata = entry.metadata()?;
        if metadata.is_file() && entry.path().extension().is_some_and(|ext| ext == "png") {
            total = total.saturating_add(metadata.len());
            entries.push((metadata.modified()?, metadata.len(), entry.path()));
        }
    }
    entries.sort_by(|a, b| a.0.cmp(&b.0).then_with(|| a.2.cmp(&b.2)));
    for (_, bytes, path) in entries {
        if total <= limit {
            break;
        }
        if fs::remove_file(path).is_ok() {
            total = total.saturating_sub(bytes);
        }
    }
    Ok(())
}

pub(crate) fn save(cache: &Path, path: &Path, png: &[u8]) -> Result<()> {
    static STORAGE: std::sync::Mutex<()> = std::sync::Mutex::new(());
    let _guard = STORAGE
        .lock()
        .map_err(|_| AppError::new("io", "缩略图缓存暂时不可用"))?;
    fs::create_dir_all(cache)?;
    let mut temporary = tempfile::NamedTempFile::new_in(cache)?;
    temporary.write_all(png)?;
    temporary.persist(path).map_err(|e| e.error)?;
    prune(cache, CACHE_LIMIT)
}

pub(crate) fn initialize(data_dir: &Path) -> Result<PathBuf> {
    let cache = data_dir.join("thumbs");
    fs::create_dir_all(&cache)?;
    prune(&cache, CACHE_LIMIT)?;
    Ok(cache)
}

/// Validation and cache lookup happen before admission to the two fixed STA workers.
pub async fn file_thumbnail(
    db: &impl Database,
    data_dir: &Path,
    path: &Path,
    size: u32,
) -> Result<Option<String>> {
    if !matches!(size, 256 | 1024) {
        return Err(AppError::invalid("缩略图尺寸必须为 256 或 1024"));
    }
    let source = library::checked_file(db, path)?;
    let cache = data_dir.join("thumbs");
    fs::create_dir_all(&cache)?;
    let destination = cache_path(&source, &cache, size)?;
    if destination.is_file() {
        touch(&destination);
        return Ok(Some(library::display(&destination)));
    }
    #[cfg(windows)]
    {
        let Some(receiver) = workers::submit(source, cache, destination, size) else {
            return Ok(None);
        };
        // Only admitted jobs wait here. No COM, sleeps or recv on the IPC/runtime thread.
        let result = tauri::async_runtime::spawn_blocking(move || {
            receiver
                .recv_timeout(std::time::Duration::from_secs(5))
                .ok()
                .flatten()
        })
        .await;
        Ok(result.ok().flatten())
    }
    #[cfg(not(windows))]
    Ok(None)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temporary() -> tempfile::TempDir {
        let cache = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.cache");
        fs::create_dir_all(&cache).unwrap();
        tempfile::tempdir_in(cache).unwrap()
    }

    #[test]
    fn stable_key_tracks_size_time_and_requested_resolution() {
        let dir = temporary();
        let file = dir.path().join("稿件.psd");
        fs::write(&file, b"a").unwrap();
        let first = cache_path(&file, dir.path(), 256).unwrap();
        assert_eq!(first, cache_path(&file, dir.path(), 256).unwrap());
        assert_ne!(first, cache_path(&file, dir.path(), 1024).unwrap());
        fs::write(&file, b"changed").unwrap();
        assert_ne!(first, cache_path(&file, dir.path(), 256).unwrap());
    }

    #[test]
    fn cache_evicts_least_recently_used_first() {
        let dir = temporary();
        let old = dir.path().join("old.png");
        let recent = dir.path().join("recent.png");
        fs::write(&old, [1; 10]).unwrap();
        fs::File::options()
            .write(true)
            .open(&old)
            .unwrap()
            .set_modified(SystemTime::UNIX_EPOCH)
            .unwrap();
        fs::write(&recent, [2; 10]).unwrap();
        prune(dir.path(), 10).unwrap();
        assert!(!old.exists());
        assert!(recent.exists());
    }

    #[cfg(windows)]
    #[test]
    fn windows_real_shell_png_bmp_cache_hit_and_source_invalidation() {
        let workspace_cache = Path::new(env!("CARGO_MANIFEST_DIR")).join("../.cache");
        fs::create_dir_all(&workspace_cache).unwrap();
        let temporary = tempfile::tempdir_in(&workspace_cache).unwrap();
        // Both standard and portable resolve this same data_dir field.
        let state = crate::AppState::open(temporary.path().join("数据")).unwrap();
        let root = temporary.path().join("文件库");
        library::set_root(&state, &root).unwrap();
        let png = encode_png(256, 256, &[70, 120, 220, 255].repeat(256 * 256)).unwrap();
        let source_png = root.join("测试.png");
        fs::write(&source_png, png).unwrap();
        let source_bmp = root.join("测试.bmp");
        let pixels = [30, 100, 240].repeat(256 * 256);
        let mut bmp = vec![0_u8; 54];
        bmp[..2].copy_from_slice(b"BM");
        bmp[2..6].copy_from_slice(&(54 + pixels.len() as u32).to_le_bytes());
        bmp[10..14].copy_from_slice(&54_u32.to_le_bytes());
        bmp[14..18].copy_from_slice(&40_u32.to_le_bytes());
        bmp[18..22].copy_from_slice(&256_i32.to_le_bytes());
        bmp[22..26].copy_from_slice(&256_i32.to_le_bytes());
        bmp[26..28].copy_from_slice(&1_u16.to_le_bytes());
        bmp[28..30].copy_from_slice(&24_u16.to_le_bytes());
        bmp.extend_from_slice(&pixels);
        fs::write(&source_bmp, bmp).unwrap();
        for source in [source_png, source_bmp] {
            let get = || {
                tauri::async_runtime::block_on(file_thumbnail(
                    &state,
                    &state.data_dir,
                    &source,
                    256,
                ))
                .unwrap()
                .expect("Windows PNG/BMP thumbnail handler must be available")
            };
            let first = get();
            assert!(Path::new(&first).starts_with(&state.data_dir));
            assert_eq!(&fs::read(&first).unwrap()[..8], b"\x89PNG\r\n\x1a\n");
            let first_content = fs::read(&first).unwrap();
            assert_eq!(get(), first);
            assert_eq!(fs::read(&first).unwrap(), first_content);
            let original = fs::metadata(&source).unwrap().modified().unwrap();
            fs::OpenOptions::new()
                .write(true)
                .open(&source)
                .unwrap()
                .set_modified(original + std::time::Duration::from_secs(5))
                .unwrap();
            let changed = get();
            assert_ne!(changed, first);
            assert!(Path::new(&changed).is_file());
        }
        let outside = temporary.path().join("库外.png");
        fs::write(&outside, b"outside").unwrap();
        assert_eq!(
            tauri::async_runtime::block_on(file_thumbnail(&state, &state.data_dir, &outside, 256))
                .unwrap_err()
                .code,
            "outsideLibrary"
        );
    }
}
