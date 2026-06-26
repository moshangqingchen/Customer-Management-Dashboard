use std::path::{Path, PathBuf};

use crate::service::{AppResult, AppService};

pub trait CloudReadModelExporter {
    fn export_read_model(&self, destination: &Path) -> AppResult<PathBuf>;
}

impl CloudReadModelExporter for AppService {
    fn export_read_model(&self, destination: &Path) -> AppResult<PathBuf> {
        self.export_cloud_read_model(destination)
    }
}
