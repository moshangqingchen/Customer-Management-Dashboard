import type { FileEntry, FileKind } from '../api/types';

export interface RecentFileFilters { query?: string; kind?: FileKind; clientId?: string }
export function filterRecentFiles(files: readonly FileEntry[], filters: RecentFileFilters): FileEntry[] {
  const query = filters.query?.trim().toLocaleLowerCase('zh-CN') ?? '';
  return files.filter(file => (!query || file.name.toLocaleLowerCase('zh-CN').includes(query)) && (!filters.kind || file.kind === filters.kind) && (!filters.clientId || (filters.clientId === '__unassigned__' ? !file.clientId : file.clientId === filters.clientId)))
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name, 'zh-CN') || a.path.localeCompare(b.path));
}
