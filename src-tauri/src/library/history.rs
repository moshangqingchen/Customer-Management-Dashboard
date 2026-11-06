mod legacy;
mod recycle;
mod storage;
mod versions;

pub use recycle::{list_recycle, restore_recycled, trash, FileRecycleEntry};
pub use versions::{list_versions, replace_version, restore_version, save_version, FileVersion};

use crate::error::Result;
use rusqlite::{params, Connection};
use std::path::Path;

/// Called inside the same metadata transaction as a file/folder rename. Archive
/// bytes retain their immutable internal paths; only their original location moves.
pub fn rename_prefix(conn: &Connection, root: &Path, old: &str, next: &str) -> Result<()> {
    let old = old.replace('\\', "/");
    let next = next.replace('\\', "/");
    legacy::index_prefix(conn, root, &old, &next)?;
    let Some(library_id) = storage::library_id(root, false)? else {
        return Ok(());
    };
    let prefix = format!("{old}/");
    for table in ["file_versions", "file_recycle"] {
        conn.execute(&format!("UPDATE {table} SET original_rel_path=?1 || substr(original_rel_path,length(?2)+1) WHERE library_id=?3 AND (original_rel_path=?2 OR substr(original_rel_path,1,length(?4))=?4)"), params![next, old, library_id, prefix])?;
    }
    Ok(())
}
