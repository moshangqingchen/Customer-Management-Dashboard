import { invoke } from '@tauri-apps/api/core';
import type { FileHistoryApi } from './fileHistory';

export const tauriFileHistory: FileHistoryApi = {
  list: path => invoke('file_versions_list', { path }),
  save: (path, note) => invoke('file_versions_save', { path, note }),
  replace: (path, sourcePath, note) => invoke('file_versions_replace', { path, sourcePath, note }),
  pickReplace: (path, note) => invoke('file_versions_pick_replace', { path, note }),
  restore: id => invoke('file_versions_restore', { id }),
  trashList: () => invoke('file_recycle_list'),
  restoreTrash: id => invoke('file_recycle_restore', { id }),
};
