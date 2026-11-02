use super::ProjectFiles;
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::{Mutex, OnceLock},
    time::{Duration, Instant},
};

const MAX_AGE: Duration = Duration::from_secs(30);

#[derive(Default)]
struct Cache {
    next_scan: u64,
    counts: HashMap<PathBuf, (ProjectFiles, Instant)>,
    scans: HashMap<PathBuf, (u64, Instant)>,
}

fn cache() -> &'static Mutex<Cache> {
    static CACHE: OnceLock<Mutex<Cache>> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(Cache::default()))
}

pub(super) fn count(path: &Path, calculate: impl FnOnce() -> Option<ProjectFiles>) -> ProjectFiles {
    count_with(cache(), path, calculate)
}

fn count_with(
    state: &Mutex<Cache>,
    path: &Path,
    calculate: impl FnOnce() -> Option<ProjectFiles>,
) -> ProjectFiles {
    let started = Instant::now();
    let token = match state.lock() {
        Ok(mut cache) => {
            cache.counts.retain(|_, (_, at)| at.elapsed() < MAX_AGE);
            cache.scans.retain(|_, (_, at)| at.elapsed() < MAX_AGE);
            if let Some((count, _)) = cache.counts.get(path) {
                return count.clone();
            }
            cache.next_scan = cache.next_scan.wrapping_add(1);
            let token = cache.next_scan;
            cache.scans.insert(path.to_path_buf(), (token, started));
            token
        }
        Err(_) => return calculate().unwrap_or_default(),
    };
    let result = calculate();
    if let Ok(mut cache) = state.lock() {
        // Only mutations or newer scans of this path can supersede this result.
        if cache
            .scans
            .get(path)
            .is_some_and(|(active, _)| *active == token)
        {
            cache.scans.remove(path);
            if let Some(count) = result.clone().filter(|_| started.elapsed() < MAX_AGE) {
                cache.counts.insert(path.to_path_buf(), (count, started));
            }
        }
    }
    result.unwrap_or_default()
}

pub(super) fn invalidate_file_counts(path: &Path) {
    invalidate(cache(), path);
}

fn invalidate(state: &Mutex<Cache>, path: &Path) {
    if let Ok(mut cache) = state.lock() {
        cache
            .counts
            .retain(|base, _| !path.starts_with(base) && !base.starts_with(path));
        cache
            .scans
            .retain(|base, _| !path.starts_with(base) && !base.starts_with(path));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files(count: i64) -> ProjectFiles {
        ProjectFiles {
            file_count: count,
            cover_path: Some(format!("/library/cover-{count}.png")),
        }
    }

    #[test]
    fn counts_expire_after_thirty_seconds_without_sleeping() {
        let state = Mutex::new(Cache::default());
        let path = Path::new("/library/project");
        assert_eq!(count_with(&state, path, || Some(files(1))), files(1));
        state.lock().unwrap().counts.get_mut(path).unwrap().1 =
            Instant::now() - MAX_AGE - Duration::from_secs(1);
        assert_eq!(count_with(&state, path, || Some(files(2))), files(2));
    }

    #[test]
    fn invalidating_the_scanned_path_prevents_stale_cache_fill() {
        let state = Mutex::new(Cache::default());
        let path = Path::new("/library/project");
        assert_eq!(
            count_with(&state, path, || {
                invalidate(&state, &path.join("new.psd"));
                Some(files(1))
            }),
            files(1)
        );
        assert!(!state.lock().unwrap().counts.contains_key(path));
        assert!(state.lock().unwrap().scans.is_empty());
        assert_eq!(count_with(&state, path, || Some(files(2))), files(2));
    }

    #[test]
    fn invalidating_another_project_does_not_discard_the_scan() {
        let state = Mutex::new(Cache::default());
        let path = Path::new("/library/project");
        assert_eq!(
            count_with(&state, path, || {
                invalidate(&state, Path::new("/library/another/new.psd"));
                Some(files(0))
            }),
            files(0)
        );
        assert_eq!(count_with(&state, path, || panic!("应命中缓存")), files(0));
        assert!(state.lock().unwrap().scans.is_empty());
    }

    #[test]
    fn failed_scans_are_removed_and_retried() {
        let state = Mutex::new(Cache::default());
        let path = Path::new("/library/project");
        assert_eq!(count_with(&state, path, || None), ProjectFiles::default());
        assert!(state.lock().unwrap().scans.is_empty());
        assert!(!state.lock().unwrap().counts.contains_key(path));
        assert_eq!(count_with(&state, path, || Some(files(3))), files(3));
    }
}
