import type { FileEntry, FileKind } from '../api/types';
import { today } from './dates';

// files_recent accepts u32. Request the complete existing scan without changing
// IPC; the UI renders only one page. An indexed search can later replace this.
export const ALL_LIBRARY_FILES_LIMIT = 0xffffffff;
export const RECENT_FILES_LIMIT = 1000;
export const FILE_PAGE_SIZE = 60;
export interface RecentFileFilters { query?: string; kind?: FileKind; clientId?: string; projectId?: string; from?: string; to?: string }
export function filterRecentFiles(files: readonly FileEntry[], filters: RecentFileFilters): FileEntry[] {
  const terms = filters.query?.trim().toLocaleLowerCase('zh-CN').split(/\s+/).filter(Boolean) ?? [];
  return files.filter(file => {
    const text = `${file.name} ${file.relPath}`.toLocaleLowerCase('zh-CN').replace(/\\/g, '/');
    let modifiedDate = '';
    if (filters.from || filters.to) { const date = new Date(file.modifiedAt); modifiedDate = Number.isNaN(date.getTime()) ? '' : today(date); }
    return terms.every(term => text.includes(term.replace(/\\/g, '/')))
      && (!filters.kind || file.kind === filters.kind)
      && (!filters.clientId || (filters.clientId === '__unassigned__' ? !file.clientId : file.clientId === filters.clientId))
      && (!filters.projectId || (filters.projectId === '__client_files__' ? !!file.clientId && !file.projectId : file.projectId === filters.projectId))
      && (!filters.from || !!modifiedDate && modifiedDate >= filters.from)
      && (!filters.to || !!modifiedDate && modifiedDate <= filters.to);
  })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name, 'zh-CN') || a.path.localeCompare(b.path));
}
