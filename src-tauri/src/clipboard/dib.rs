use crate::{
    error::{AppError, Result},
    thumbnails::encode_png,
};

fn invalid() -> AppError {
    AppError::invalid("剪贴板图片格式无效或尺寸过大")
}
fn u32_at(data: &[u8], offset: usize) -> Result<u32> {
    let bytes: [u8; 4] = data
        .get(offset..offset + 4)
        .ok_or_else(invalid)?
        .try_into()
        .map_err(|_| invalid())?;
    Ok(u32::from_le_bytes(bytes))
}
fn u16_at(data: &[u8], offset: usize) -> Result<u16> {
    let bytes: [u8; 2] = data
        .get(offset..offset + 2)
        .ok_or_else(invalid)?
        .try_into()
        .map_err(|_| invalid())?;
    Ok(u16::from_le_bytes(bytes))
}
fn channel(value: u32, mask: u32) -> u8 {
    if mask == 0 {
        return 255;
    }
    let shift = mask.trailing_zeros();
    let max = mask >> shift;
    (((value & mask) >> shift) as u64 * 255 / max as u64) as u8
}

/// Decode common Windows DIB/DIBV5 pixel layouts without trusting clipboard pointers.
pub(super) fn to_png(data: &[u8]) -> Result<Vec<u8>> {
    let header = u32_at(data, 0)? as usize;
    if header < 40 || header > data.len() {
        return Err(invalid());
    }
    let width = u32_at(data, 4)? as i32;
    let signed_height = u32_at(data, 8)? as i32;
    let height = signed_height.checked_abs().ok_or_else(invalid)? as usize;
    let bits = u16_at(data, 14)? as usize;
    let compression = u32_at(data, 16)?;
    if width <= 0
        || height == 0
        || u16_at(data, 12)? != 1
        || !matches!(bits, 1 | 4 | 8 | 16 | 24 | 32)
        || !matches!(compression, 0 | 3 | 6)
        || (compression != 0 && !matches!(bits, 16 | 32))
    {
        return Err(invalid());
    }
    let width = width as usize;
    let length = width
        .checked_mul(height)
        .and_then(|n| n.checked_mul(4))
        .filter(|n| *n <= 300 * 1024 * 1024)
        .ok_or_else(invalid)?;
    let stride = width
        .checked_mul(bits)
        .and_then(|n| n.checked_add(31))
        .map(|n| n / 32 * 4)
        .ok_or_else(invalid)?;
    let mut offset = header;
    let mut masks = if bits == 16 {
        [0x7c00, 0x03e0, 0x001f, 0]
    } else {
        [0xff0000, 0xff00, 0xff, 0]
    };
    if compression != 0 {
        let count = if compression == 6 || header >= 56 {
            4
        } else {
            3
        };
        let start = if header >= 52 { 40 } else { header };
        for (index, mask) in masks.iter_mut().take(count).enumerate() {
            *mask = u32_at(data, start + index * 4)?;
        }
        if header == 40 {
            offset += count * 4;
        }
        if masks[..3].contains(&0) {
            return Err(invalid());
        }
    }
    let palette_len = if bits <= 8 {
        let used = u32_at(data, 32)? as usize;
        if used == 0 {
            1 << bits
        } else if used <= 1 << bits {
            used
        } else {
            return Err(invalid());
        }
    } else {
        0
    };
    let palette_start = offset;
    offset = offset.checked_add(palette_len * 4).ok_or_else(invalid)?;
    let end = stride
        .checked_mul(height)
        .and_then(|n| n.checked_add(offset))
        .ok_or_else(invalid)?;
    if end > data.len() {
        return Err(invalid());
    }
    let mut pixels = vec![0_u8; length];
    for y in 0..height {
        let source_y = if signed_height > 0 { height - 1 - y } else { y };
        let row = &data[offset + source_y * stride..offset + (source_y + 1) * stride];
        for x in 0..width {
            let rgba = &mut pixels[(y * width + x) * 4..(y * width + x + 1) * 4];
            if bits <= 8 {
                let index = match bits {
                    1 => (row[x / 8] >> (7 - x % 8)) & 1,
                    4 => (row[x / 2] >> (if x % 2 == 0 { 4 } else { 0 })) & 15,
                    _ => row[x],
                } as usize;
                if index >= palette_len {
                    return Err(invalid());
                }
                let color = &data[palette_start + index * 4..palette_start + index * 4 + 4];
                rgba.copy_from_slice(&[color[2], color[1], color[0], 255]);
            } else if bits == 24 {
                rgba.copy_from_slice(&[row[x * 3 + 2], row[x * 3 + 1], row[x * 3], 255]);
            } else {
                let value = if bits == 16 {
                    u16::from_le_bytes([row[x * 2], row[x * 2 + 1]]) as u32
                } else {
                    u32::from_le_bytes(row[x * 4..x * 4 + 4].try_into().map_err(|_| invalid())?)
                };
                for (component, mask) in rgba.iter_mut().zip(masks) {
                    *component = channel(value, mask);
                }
            }
        }
    }
    encode_png(width as u32, height as u32, &pixels)
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    pub(crate) fn bitmap() -> Vec<u8> {
        let mut dib = vec![0_u8; 44];
        dib[..4].copy_from_slice(&40_u32.to_le_bytes());
        dib[4..8].copy_from_slice(&1_i32.to_le_bytes());
        dib[8..12].copy_from_slice(&1_i32.to_le_bytes());
        dib[12..14].copy_from_slice(&1_u16.to_le_bytes());
        dib[14..16].copy_from_slice(&24_u16.to_le_bytes());
        dib[40..44].copy_from_slice(&[10, 20, 230, 0]);
        dib
    }
    #[test]
    fn padded_bottom_up_bitmap_becomes_rgba_png_and_rejects_truncation() {
        let dib = bitmap();
        let png = to_png(&dib).unwrap();
        let mut reader = png::Decoder::new(std::io::Cursor::new(png))
            .read_info()
            .unwrap();
        let mut pixels = vec![0; reader.output_buffer_size()];
        reader.next_frame(&mut pixels).unwrap();
        assert_eq!(pixels, [230, 20, 10, 255]);
        assert!(to_png(&dib[..41]).is_err());
        let mut oversized = dib;
        oversized[4..8].copy_from_slice(&i32::MAX.to_le_bytes());
        assert!(to_png(&oversized).is_err());
    }
}
