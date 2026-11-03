use super::{dib, Content};
use crate::error::{AppError, Result};
use windows::{
    core::w,
    Win32::{
        Foundation::{GlobalFree, HANDLE, HGLOBAL, HWND},
        System::{
            DataExchange::{
                CloseClipboard, EmptyClipboard, GetClipboardData, IsClipboardFormatAvailable,
                OpenClipboard, RegisterClipboardFormatW, SetClipboardData,
            },
            Memory::{GlobalAlloc, GlobalLock, GlobalSize, GlobalUnlock, GMEM_MOVEABLE},
        },
        UI::{
            Shell::{DragQueryFileW, HDROP},
            WindowsAndMessaging::{
                CreateWindowExW, DestroyWindow, HWND_MESSAGE, WINDOW_EX_STYLE, WINDOW_STYLE,
            },
        },
    },
};

fn failure(error: windows::core::Error) -> AppError {
    AppError::new(
        "clipboard",
        format!("无法访问剪贴板，请稍后重试（{error}）"),
    )
}

struct Clipboard(HWND);
impl Clipboard {
    fn open() -> Result<Self> {
        unsafe {
            // A real owner is necessary: EmptyClipboard with a NULL owner forbids SetClipboardData.
            let owner = CreateWindowExW(
                WINDOW_EX_STYLE::default(),
                w!("STATIC"),
                w!(""),
                WINDOW_STYLE::default(),
                0,
                0,
                0,
                0,
                Some(HWND_MESSAGE),
                None,
                None,
                None,
            )
            .map_err(failure)?;
            for _ in 0..10 {
                if OpenClipboard(Some(owner)).is_ok() {
                    return Ok(Self(owner));
                }
                std::thread::sleep(std::time::Duration::from_millis(20));
            }
            let _ = DestroyWindow(owner);
        }
        Err(AppError::new(
            "clipboard",
            "剪贴板正被其他程序占用，请稍后重试",
        ))
    }
}
impl Drop for Clipboard {
    fn drop(&mut self) {
        unsafe {
            let _ = CloseClipboard();
            let _ = DestroyWindow(self.0);
        }
    }
}

struct Memory(HGLOBAL);
impl Memory {
    fn new(bytes: &[u8]) -> Result<Self> {
        unsafe {
            let memory = Self(GlobalAlloc(GMEM_MOVEABLE, bytes.len()).map_err(failure)?);
            let pointer = GlobalLock(memory.0);
            if pointer.is_null() {
                return Err(failure(windows::core::Error::from_win32()));
            }
            std::ptr::copy_nonoverlapping(bytes.as_ptr(), pointer.cast(), bytes.len());
            let _ = GlobalUnlock(memory.0);
            Ok(memory)
        }
    }
    fn publish(self, format: u32) -> Result<()> {
        unsafe {
            SetClipboardData(format, Some(HANDLE(self.0 .0))).map_err(failure)?;
        }
        std::mem::forget(self); // Clipboard owns HGLOBAL after success.
        Ok(())
    }
}
impl Drop for Memory {
    fn drop(&mut self) {
        unsafe {
            let _ = GlobalFree(Some(self.0));
        }
    }
}

pub(super) fn copy(data: &[u8]) -> Result<()> {
    let dropfiles = Memory::new(data)?;
    let effect = Memory::new(&1_u32.to_le_bytes())?; // DROPEFFECT_COPY
    let _clipboard = Clipboard::open()?;
    unsafe {
        let format = RegisterClipboardFormatW(w!("Preferred DropEffect"));
        if format == 0 {
            return Err(failure(windows::core::Error::from_win32()));
        }
        EmptyClipboard().map_err(failure)?;
        dropfiles.publish(15)?; // CF_HDROP
        effect.publish(format)
    }
}

fn bytes(format: u32) -> Result<Vec<u8>> {
    unsafe {
        let handle = HGLOBAL(GetClipboardData(format).map_err(failure)?.0);
        let size = GlobalSize(handle);
        if size == 0 || size > 300 * 1024 * 1024 {
            return Err(AppError::invalid("剪贴板图片为空或超过 300MB"));
        }
        let pointer = GlobalLock(handle);
        if pointer.is_null() {
            return Err(failure(windows::core::Error::from_win32()));
        }
        let bytes = std::slice::from_raw_parts(pointer.cast::<u8>(), size).to_vec();
        let _ = GlobalUnlock(handle);
        Ok(bytes)
    }
}

pub(super) fn read() -> Result<Content> {
    let _clipboard = Clipboard::open()?;
    unsafe {
        if IsClipboardFormatAvailable(15).is_ok() {
            let drop = HDROP(GetClipboardData(15).map_err(failure)?.0);
            let count = DragQueryFileW(drop, u32::MAX, None);
            if count > 10000 {
                return Err(AppError::invalid("剪贴板文件数量过多"));
            }
            let mut paths = Vec::new();
            for index in 0..count {
                let length = DragQueryFileW(drop, index, None);
                if length == 0 || length > 32767 {
                    return Err(AppError::invalid("剪贴板文件路径无效"));
                }
                let mut wide = vec![0_u16; length as usize + 1];
                let written = DragQueryFileW(drop, index, Some(&mut wide));
                let path = String::from_utf16(&wide[..written as usize])
                    .map_err(|_| AppError::invalid("剪贴板文件路径无效"))?;
                paths.push(path);
            }
            if !paths.is_empty() {
                return Ok(Content::Files(paths));
            }
        }
        let png = RegisterClipboardFormatW(w!("PNG"));
        if png != 0 && IsClipboardFormatAvailable(png).is_ok() {
            let data = bytes(png)?;
            let mut decoder = png::Decoder::new(std::io::Cursor::new(&data));
            decoder.set_limits(png::Limits {
                bytes: 300 * 1024 * 1024,
            });
            let mut reader = decoder
                .read_info()
                .map_err(|_| AppError::invalid("剪贴板 PNG 图片无效"))?;
            if reader.output_buffer_size() > 300 * 1024 * 1024 {
                return Err(AppError::invalid("剪贴板图片尺寸过大"));
            }
            let mut buffer = vec![0; reader.output_buffer_size()];
            reader
                .next_frame(&mut buffer)
                .map_err(|_| AppError::invalid("剪贴板 PNG 图片无效"))?;
            return Ok(Content::Png(data));
        }
        for format in [17, 8] {
            // CF_DIBV5, CF_DIB
            if IsClipboardFormatAvailable(format).is_ok() {
                return dib::to_png(&bytes(format)?).map(Content::Png);
            }
        }
    }
    Err(AppError::new("clipboardEmpty", "剪贴板里没有文件或图片"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{clipboard, library, models::FileTarget, repo::activities, AppState, Database};

    #[test]
    fn windows_real_clipboard_roundtrip_files_and_paste_bitmap_as_png() {
        // This explicitly authorized integration test overwrites the local clipboard.
        let workspace_cache = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../.cache");
        std::fs::create_dir_all(&workspace_cache).unwrap();
        let temporary = tempfile::tempdir_in(&workspace_cache).unwrap();
        let state = AppState::open(temporary.path().join("数据")).unwrap();
        let root = temporary.path().join("文件库");
        library::set_root(&state, &root).unwrap();
        state.read(|db| {
            db.execute("INSERT INTO clients(id,name,created_at,updated_at) VALUES('c','剪贴板测试','2026-11-02','2026-11-02')", [])?;
            Ok(())
        }).unwrap();
        let file = root.join("源稿件.psd");
        std::fs::write(&file, b"test").unwrap();
        clipboard::files_copy_to_clipboard(&state, &[library::display(&file)]).unwrap();
        let Content::Files(paths) = read().unwrap() else {
            panic!("expected CF_HDROP");
        };
        assert_eq!(paths, [library::display(&file.canonicalize().unwrap())]);
        {
            let _clipboard = Clipboard::open().unwrap();
            let format = unsafe { RegisterClipboardFormatW(w!("Preferred DropEffect")) };
            assert_eq!(&bytes(format).unwrap()[..4], &1_u32.to_le_bytes());
            unsafe {
                EmptyClipboard().unwrap();
            }
            Memory::new(&dib::tests::bitmap())
                .unwrap()
                .publish(8)
                .unwrap();
        }
        let target = FileTarget::Client {
            client_id: "c".into(),
        };
        let result = clipboard::files_paste(&state, &state.data_dir, &target, None).unwrap();
        assert_eq!(result.added.len(), 1);
        assert!(result.failed.is_empty());
        let image = &result.added[0];
        assert!(image.name.starts_with("粘贴图片 "));
        assert!(image.name.ends_with(".png"));
        assert_eq!(
            &std::fs::read(&image.path).unwrap()[..8],
            b"\x89PNG\r\n\x1a\n"
        );
        assert_eq!(
            state
                .read(|db| activities::list(db, Some("c"), None, Some(1)))
                .unwrap()[0]
                .body,
            "添加了 1 个文件"
        );
        // Same-second pastes retain both files via the normal files_add collision rule.
        let second = clipboard::files_paste(&state, &state.data_dir, &target, None).unwrap();
        assert_eq!(second.added.len(), 1);
        assert_ne!(second.added[0].path, image.path);
        // Native PNG takes precedence over a different bitmap in the same clipboard.
        let native_png = crate::thumbnails::encode_png(1, 1, &[10, 30, 70, 255]).unwrap();
        {
            let _clipboard = Clipboard::open().unwrap();
            unsafe {
                EmptyClipboard().unwrap();
            }
            let format = unsafe { RegisterClipboardFormatW(w!("PNG")) };
            Memory::new(&native_png).unwrap().publish(format).unwrap();
            Memory::new(&dib::tests::bitmap())
                .unwrap()
                .publish(8)
                .unwrap();
        }
        let Content::Png(preferred) = read().unwrap() else {
            panic!("expected PNG");
        };
        assert_eq!(preferred, native_png);
        {
            let _clipboard = Clipboard::open().unwrap();
            unsafe {
                EmptyClipboard().unwrap();
            }
            let bitmap = dib::tests::bitmap();
            let mut v5 = vec![0; 124];
            v5[..40].copy_from_slice(&bitmap[..40]);
            v5[..4].copy_from_slice(&124_u32.to_le_bytes());
            v5.extend_from_slice(&bitmap[40..]);
            Memory::new(&v5).unwrap().publish(17).unwrap();
        }
        assert_eq!(
            clipboard::files_paste(&state, &state.data_dir, &target, None)
                .unwrap()
                .added
                .len(),
            1
        );
        {
            let _clipboard = Clipboard::open().unwrap();
            unsafe {
                EmptyClipboard().unwrap();
            }
        }
        assert_eq!(
            clipboard::files_paste(&state, &state.data_dir, &target, None)
                .unwrap_err()
                .code,
            "clipboardEmpty"
        );
    }
}
