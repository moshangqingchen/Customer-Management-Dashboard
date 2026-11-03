use crate::error::{AppError, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::{mpsc, Arc, Mutex},
    time::Duration,
};
use tauri::{LogicalSize, PhysicalPosition, WebviewWindow, WindowEvent};

const MIN_WIDTH: f64 = 1100.0;
const MIN_HEIGHT: f64 = 700.0;
const SAVE_DELAY: Duration = Duration::from_millis(600);

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct WindowState {
    x: i32,
    y: i32,
    width: f64,
    height: f64,
    maximized: bool,
}

impl WindowState {
    fn normalize(&mut self) {
        self.width = normalize_dimension(self.width, MIN_WIDTH, 1440.0);
        self.height = normalize_dimension(self.height, MIN_HEIGHT, 900.0);
    }
}

fn normalize_dimension(value: f64, minimum: f64, fallback: f64) -> f64 {
    if value.is_finite() && value > 0.0 {
        value.clamp(minimum, 32768.0)
    } else {
        fallback
    }
}

#[derive(Clone, Copy)]
struct Rect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

fn overlaps(a: Rect, b: Rect) -> bool {
    i64::from(a.x) < i64::from(b.x) + i64::from(b.width)
        && i64::from(b.x) < i64::from(a.x) + i64::from(a.width)
        && i64::from(a.y) < i64::from(b.y) + i64::from(b.height)
        && i64::from(b.y) < i64::from(a.y) + i64::from(a.height)
}

fn window_error(error: impl std::fmt::Display) -> AppError {
    AppError::new("windowState", format!("无法读取或保存窗口位置（{error}）"))
}

fn load(path: &Path) -> Result<Option<WindowState>> {
    match fs::read(path) {
        Ok(bytes) => {
            let mut state: WindowState = serde_json::from_slice(&bytes).map_err(window_error)?;
            state.normalize();
            Ok(Some(state))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(window_error(error)),
    }
}

fn save(path: &Path, state: &WindowState) -> Result<()> {
    let directory = path
        .parent()
        .ok_or_else(|| window_error("窗口位置文件没有父目录"))?;
    let mut file = tempfile::NamedTempFile::new_in(directory).map_err(window_error)?;
    serde_json::to_writer_pretty(&mut file, state).map_err(window_error)?;
    file.flush().map_err(window_error)?;
    file.persist(path).map_err(window_error)?;
    Ok(())
}

fn capture(window: &WebviewWindow, previous: Option<&WindowState>) -> Result<WindowState> {
    if window.is_minimized().map_err(window_error)? {
        if let Some(previous) = previous {
            return Ok(previous.clone());
        }
    }
    let maximized = window.is_maximized().map_err(window_error)?;
    if maximized {
        if let Some(previous) = previous {
            let mut state = previous.clone();
            state.maximized = true;
            return Ok(state);
        }
    }
    let position = window.outer_position().map_err(window_error)?;
    let size = window
        .inner_size()
        .map_err(window_error)?
        .to_logical::<f64>(window.scale_factor().map_err(window_error)?);
    let mut state = WindowState {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
        maximized,
    };
    state.normalize();
    Ok(state)
}

fn restore(window: &WebviewWindow, path: &Path) -> Result<WindowState> {
    window
        .set_min_size(Some(LogicalSize::new(MIN_WIDTH, MIN_HEIGHT)))
        .map_err(window_error)?;
    let saved = match load(path) {
        Ok(saved) => saved,
        Err(error) => {
            // Window preferences are disposable; a damaged preference must not block the database.
            eprintln!("{error}");
            None
        }
    };
    if let Some(saved) = saved {
        window
            .set_position(PhysicalPosition::new(saved.x, saved.y))
            .map_err(window_error)?;
        window
            .set_size(LogicalSize::new(saved.width, saved.height))
            .map_err(window_error)?;
        let position = window.outer_position().map_err(window_error)?;
        let size = window.outer_size().map_err(window_error)?;
        let rect = Rect {
            x: position.x,
            y: position.y,
            width: size.width,
            height: size.height,
        };
        let visible = window
            .available_monitors()
            .map_err(window_error)?
            .iter()
            .any(|monitor| {
                overlaps(
                    rect,
                    Rect {
                        x: monitor.position().x,
                        y: monitor.position().y,
                        width: monitor.size().width,
                        height: monitor.size().height,
                    },
                )
            });
        if !visible {
            window.center().map_err(window_error)?;
        }
        let mut state = capture(window, None)?;
        state.maximized = saved.maximized;
        if saved.maximized {
            window.maximize().map_err(window_error)?;
        }
        Ok(state)
    } else {
        capture(window, None)
    }
}

struct Persistence {
    state: WindowState,
    closed: bool,
}

fn save_pending(path: &Path, pending: &Mutex<Persistence>) -> bool {
    match pending.lock() {
        Ok(pending) => {
            if pending.closed {
                return false;
            }
            if let Err(error) = save(path, &pending.state) {
                eprintln!("{error}");
            }
            true
        }
        Err(_) => {
            eprintln!("窗口位置状态异常，请重新打开应用");
            false
        }
    }
}

/// Stores normal bounds plus maximization in the selected application data directory.
pub fn attach(window: &WebviewWindow, data_dir: &Path) -> Result<()> {
    let path: PathBuf = data_dir.join("window-state.json");
    let pending = Arc::new(Mutex::new(Persistence {
        state: restore(window, &path)?,
        closed: false,
    }));
    let (sender, receiver) = mpsc::sync_channel(1);
    let worker_pending = Arc::clone(&pending);
    let worker_path = path.clone();
    std::thread::Builder::new()
        .name("window-state".into())
        .spawn(move || {
            while receiver.recv().is_ok() {
                loop {
                    match receiver.recv_timeout(SAVE_DELAY) {
                        Ok(()) => continue,
                        Err(mpsc::RecvTimeoutError::Timeout) => {
                            if !save_pending(&worker_path, &worker_pending) {
                                return;
                            }
                            break;
                        }
                        Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    }
                }
            }
        })
        .map_err(window_error)?;

    let event_window = window.clone();
    window.on_window_event(move |event| {
        let closing = matches!(event, WindowEvent::CloseRequested { .. });
        if !closing
            && !matches!(
                event,
                WindowEvent::Moved(_)
                    | WindowEvent::Resized(_)
                    | WindowEvent::ScaleFactorChanged { .. }
            )
        {
            return;
        }
        let Ok(mut pending) = pending.lock() else {
            eprintln!("窗口位置状态异常，请重新打开应用");
            return;
        };
        match capture(&event_window, Some(&pending.state)) {
            Ok(state) => pending.state = state,
            Err(error) => eprintln!("{error}"),
        }
        if closing {
            // Flush synchronously before the event loop destroys the window/process.
            pending.closed = true;
            if let Err(error) = save(&path, &pending.state) {
                eprintln!("{error}");
            }
        }
        let _ = sender.try_send(());
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn state() -> WindowState {
        WindowState {
            x: -1440,
            y: 120,
            width: 1440.0,
            height: 900.0,
            maximized: true,
        }
    }

    #[test]
    fn minimum_size_is_enforced_and_invalid_dimensions_are_replaced() {
        let mut state = state();
        state.width = 300.0;
        state.height = 400.0;
        state.normalize();
        assert_eq!((state.width, state.height), (MIN_WIDTH, MIN_HEIGHT));
        state.width = f64::NAN;
        state.height = f64::INFINITY;
        state.normalize();
        assert_eq!((state.width, state.height), (1440.0, 900.0));
    }

    #[test]
    fn finds_windows_on_secondary_monitors_and_rejects_offscreen_bounds() {
        let monitor = Rect {
            x: -1920,
            y: 0,
            width: 1920,
            height: 1080,
        };
        assert!(overlaps(
            Rect {
                x: -1440,
                y: 100,
                width: 1440,
                height: 900,
            },
            monitor
        ));
        assert!(!overlaps(
            Rect {
                x: 4000,
                y: 3000,
                width: 1440,
                height: 900,
            },
            monitor
        ));
    }

    #[test]
    fn persists_and_replaces_bounds_in_the_provided_data_directory() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("window-state.json");
        assert_eq!(load(&path).unwrap(), None);
        save(&path, &state()).unwrap();
        assert_eq!(load(&path).unwrap(), Some(state()));
        let mut changed = state();
        changed.maximized = false;
        changed.x = 40;
        save(&path, &changed).unwrap();
        assert_eq!(load(&path).unwrap(), Some(changed));
        assert_eq!(fs::read_dir(directory.path()).unwrap().count(), 1);
    }

    #[test]
    fn corrupt_window_preferences_return_an_error() {
        let directory = tempfile::tempdir().unwrap();
        let path = directory.path().join("window-state.json");
        fs::write(&path, "{broken").unwrap();
        assert!(load(&path).is_err());
    }
}
