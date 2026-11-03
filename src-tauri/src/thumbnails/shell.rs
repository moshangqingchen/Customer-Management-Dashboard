use std::{mem::size_of, path::Path};
use windows::{
    core::PCWSTR,
    Win32::{
        Foundation::SIZE,
        Graphics::Gdi::{
            CreateCompatibleDC, DeleteDC, DeleteObject, GetDIBits, GetObjectW, BITMAP, BITMAPINFO,
            BITMAPINFOHEADER, BI_RGB, DIB_RGB_COLORS, HBITMAP, HGDIOBJ,
        },
        UI::Shell::{
            IShellItemImageFactory, SHCreateItemFromParsingName, SIIGBF_BIGGERSIZEOK,
            SIIGBF_THUMBNAILONLY,
        },
    },
};

struct Bitmap(HBITMAP);
impl Drop for Bitmap {
    fn drop(&mut self) {
        unsafe {
            let _ = DeleteObject(HGDIOBJ(self.0 .0));
        }
    }
}

pub(super) fn thumbnail(path: &Path, size: u32) -> Option<Vec<u8>> {
    let wide: Vec<u16> = crate::library::display(path)
        .encode_utf16()
        .chain([0])
        .collect();
    unsafe {
        let factory: IShellItemImageFactory =
            SHCreateItemFromParsingName(PCWSTR(wide.as_ptr()), None).ok()?;
        let bitmap = Bitmap(
            factory
                .GetImage(
                    SIZE {
                        cx: size as i32,
                        cy: size as i32,
                    },
                    SIIGBF_THUMBNAILONLY | SIIGBF_BIGGERSIZEOK,
                )
                .ok()?,
        );
        bitmap_png(bitmap.0)
    }
}

/// Shell bitmaps carry premultiplied alpha; PNG expects straight alpha.
fn unpremultiply(pixel: &mut [u8]) {
    let alpha = u16::from(pixel[3]);
    if alpha == 0 || alpha == 255 {
        return;
    }
    for channel in &mut pixel[..3] {
        *channel = (u16::from(*channel) * 255 / alpha).min(255) as u8;
    }
}

pub(crate) unsafe fn bitmap_png(bitmap: HBITMAP) -> Option<Vec<u8>> {
    let mut description = BITMAP::default();
    if GetObjectW(
        HGDIOBJ(bitmap.0),
        size_of::<BITMAP>() as i32,
        Some((&mut description as *mut BITMAP).cast()),
    ) == 0
    {
        return None;
    }
    let width = description.bmWidth;
    let height = description.bmHeight.abs();
    if width <= 0 || height <= 0 || width > 16384 || height > 16384 {
        return None;
    }
    let bytes = (width as usize)
        .checked_mul(height as usize)?
        .checked_mul(4)?;
    if bytes > 300 * 1024 * 1024 {
        return None;
    }
    let mut pixels = vec![0_u8; bytes];
    let mut info = BITMAPINFO {
        bmiHeader: BITMAPINFOHEADER {
            biSize: size_of::<BITMAPINFOHEADER>() as u32,
            biWidth: width,
            biHeight: -height,
            biPlanes: 1,
            biBitCount: 32,
            biCompression: BI_RGB.0,
            ..Default::default()
        },
        ..Default::default()
    };
    let dc = CreateCompatibleDC(None);
    if dc.is_invalid() {
        return None;
    }
    let lines = GetDIBits(
        dc,
        bitmap,
        0,
        height as u32,
        Some(pixels.as_mut_ptr().cast()),
        &mut info,
        DIB_RGB_COLORS,
    );
    let _ = DeleteDC(dc);
    if lines != height {
        return None;
    }
    let has_alpha = pixels.chunks_exact(4).any(|p| p[3] != 0);
    for pixel in pixels.chunks_exact_mut(4) {
        pixel.swap(0, 2);
        if !has_alpha {
            pixel[3] = 255;
        } else {
            unpremultiply(pixel);
        }
    }
    super::encode_png(width as u32, height as u32, &pixels).ok()
}

#[cfg(test)]
mod tests {
    use super::unpremultiply;

    #[test]
    fn premultiplied_edges_are_restored_and_opaque_pixels_untouched() {
        let mut half = [64, 32, 0, 128];
        unpremultiply(&mut half);
        assert_eq!(half, [127, 63, 0, 128]);
        let mut opaque = [10, 20, 30, 255];
        unpremultiply(&mut opaque);
        assert_eq!(opaque, [10, 20, 30, 255]);
        let mut clear = [0, 0, 0, 0];
        unpremultiply(&mut clear);
        assert_eq!(clear, [0, 0, 0, 0]);
    }
}
