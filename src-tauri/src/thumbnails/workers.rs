use super::{save, shell};
use std::{
    path::PathBuf,
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc::{self, Receiver, SyncSender},
        Arc, OnceLock,
    },
};
use windows::Win32::System::Com::{CoInitializeEx, CoUninitialize, COINIT_APARTMENTTHREADED};

struct Job {
    source: PathBuf,
    cache: PathBuf,
    destination: PathBuf,
    size: u32,
    reply: SyncSender<Option<String>>,
}

struct Worker {
    sender: SyncSender<Job>,
    busy: Arc<AtomicBool>,
}

fn pool() -> &'static Vec<Worker> {
    static POOL: OnceLock<Vec<Worker>> = OnceLock::new();
    POOL.get_or_init(|| {
        (0..2)
            .filter_map(|index| {
                let (sender, receiver) = mpsc::sync_channel::<Job>(1);
                let busy = Arc::new(AtomicBool::new(false));
                let active = busy.clone();
                let launched = std::thread::Builder::new()
                    .name(format!("shell-thumbnail-sta-{index}"))
                    .spawn(move || {
                        // Exactly two long-lived STA threads, including permanently hung handlers.
                        let initialized =
                            unsafe { CoInitializeEx(None, COINIT_APARTMENTTHREADED) }.is_ok();
                        while let Ok(job) = receiver.recv() {
                            let result = if initialized {
                                shell::thumbnail(&job.source, job.size).and_then(|png| {
                                    save(&job.cache, &job.destination, &png).ok()?;
                                    Some(crate::library::display(&job.destination))
                                })
                            } else {
                                None
                            };
                            let _ = job.reply.send(result);
                            active.store(false, Ordering::Release);
                        }
                        if initialized {
                            unsafe { CoUninitialize() };
                        }
                    });
                launched.ok().map(|_| Worker { sender, busy })
            })
            .collect()
    })
}

pub(super) fn submit(
    source: PathBuf,
    cache: PathBuf,
    destination: PathBuf,
    size: u32,
) -> Option<Receiver<Option<String>>> {
    for worker in pool() {
        if worker
            .busy
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Relaxed)
            .is_ok()
        {
            let (reply, receiver) = mpsc::sync_channel(1);
            if worker
                .sender
                .try_send(Job {
                    source,
                    cache,
                    destination,
                    size,
                    reply,
                })
                .is_err()
            {
                worker.busy.store(false, Ordering::Release);
                return None;
            }
            return Some(receiver);
        }
    }
    None
}
