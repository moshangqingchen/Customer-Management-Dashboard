import type { FileHistoryApi, FileRecycleEntry, FileVersion } from '../fileHistory';
import type { FileEntry } from '../types';
import { clone, fail, id, now, operation, state } from './store';
import { designAssetId } from './designAssets';

export interface MockStoredVersion extends FileVersion { libraryRoot: string; file: FileEntry }
export interface MockStoredRecycle extends FileRecycleEntry { libraryRoot: string; file: FileEntry; restoredAt?: string }

const normal = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '');
function root(): string { return normal(state().libraryRoot ?? fail('libraryNotConfigured', '请先选择文件库位置')); }
function relative(path: string): string {
  const value = normal(path); const base = root();
  if (!value.toLowerCase().startsWith(`${base.toLowerCase()}/`) || value.split('/').some(part => part === '..' || part === '.')) fail('outsideLibrary', '路径不在当前文件库内');
  return value.slice(base.length + 1);
}
function original(path: string): FileEntry {
  relative(path);
  return state().files.find(file => normal(file.path).toLowerCase() === normal(path).toLowerCase()) ?? fail('notFound', '文件不存在');
}
function copyImageIdentity(from: string, to: string): void {
  const assets = state().fileAssets ??= {};
  assets[to] = assets[from] ?? designAssetId(from);
}
function save(path: string, note = ''): MockStoredVersion {
  if ([...note.trim()].length > 2000) fail('invalid', '版本备注最多 2000 字');
  const file = original(path); const versionId = id();
  const entry: MockStoredVersion = { id: versionId, libraryRoot: root(), originalPath: file.path, originalRelPath: file.relPath,
    snapshotPath: `${root()}/_文件历史/${versionId}.${file.ext}`, name: file.name, sizeBytes: file.sizeBytes, note: note.trim(), createdAt: now(),
    clientId: file.clientId, projectId: file.projectId, available: true, file: clone(file) };
  (state().fileVersions ??= []).push(entry);
  copyImageIdentity(file.path, entry.snapshotPath);
  return entry;
}
function replaceRecord(path: string, size: number, note = ''): FileEntry {
  const file = original(path); save(path, note || '上传新版本前保留');
  file.sizeBytes = size; file.modifiedAt = now(); return file;
}
function numbered(path: string): string {
  let result = path; let index = 2; const dot = path.lastIndexOf('.'); const slash = path.lastIndexOf('/');
  const stem = dot > slash ? path.slice(0, dot) : path; const ext = dot > slash ? path.slice(dot) : '';
  while (state().files.some(file => file.path.toLowerCase() === result.toLowerCase())) result = `${stem} (${index++})${ext}`;
  return result;
}
export function remapHistoryPath(oldRelative: string, nextRelative: string): void {
  const base = root();
  recycleRows();
  for (const entry of [...(state().fileVersions ?? []), ...(state().fileRecycle ?? [])]) {
    if (entry.libraryRoot === base && (entry.originalRelPath === oldRelative || entry.originalRelPath.startsWith(`${oldRelative}/`))) {
      entry.originalRelPath = nextRelative + entry.originalRelPath.slice(oldRelative.length); entry.originalPath = `${base}/${entry.originalRelPath}`;
      entry.file.relPath = entry.originalRelPath; entry.file.path = entry.originalPath;
    }
  }
}
export function recordRecycled(file: FileEntry, recycled: FileEntry): void {
  (state().fileRecycle ??= []).push({ id: id(), libraryRoot: root(), originalPath: file.path, originalRelPath: file.relPath,
    storedPath: recycled.path, name: file.name, sizeBytes: file.sizeBytes, deletedAt: now(), legacy: false,
    clientId: file.clientId, projectId: file.projectId, file: clone(file) });
}
export function historicalFile(path: string): FileEntry | undefined {
  relative(path);
  const version = state().fileVersions?.find(item => item.libraryRoot === root() && item.snapshotPath === path);
  if (version) return { ...version.file, path, name: version.name };
  const recycled = state().trashedFiles?.find(file => file.path === path);
  return recycled;
}
function recycleRows(): MockStoredRecycle[] {
  const base = root(); const rows = (state().fileRecycle ??= []);
  for (const file of state().trashedFiles ?? []) {
    if (!normal(file.path).startsWith(`${base}/_回收站/`) || rows.some(row => row.storedPath === file.path && row.libraryRoot === base)) continue;
    const rel = file.relPath.replace(/^_回收站\//, '');
    rows.push({ id: id(), libraryRoot: base, originalPath: `${base}/${rel}`, originalRelPath: rel, storedPath: file.path,
      name: file.name, sizeBytes: file.sizeBytes, deletedAt: file.modifiedAt, legacy: true, clientId: file.clientId, projectId: file.projectId,
      file: { ...file, relPath: rel, path: `${base}/${rel}` } });
  }
  return rows.filter(row => row.libraryRoot === base && !row.restoredAt).sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}
export const mockFileHistory: FileHistoryApi = {
  list: operation(path => { const rel = path === undefined ? undefined : relative(path); return (state().fileVersions ?? []).filter(item => item.libraryRoot === root() && (rel === undefined || item.originalRelPath === rel)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }),
  save: operation(save),
  replace: operation((path, sourcePath, note) => {
    const source = original(sourcePath); const current = original(path);
    if (source === current) fail('invalid', '请选择另一份文件作为新版本');
    if (source.ext.toLowerCase() !== current.ext.toLowerCase()) fail('invalid', '新版本的扩展名需与当前文件一致');
    const result = replaceRecord(path, source.sizeBytes, note); copyImageIdentity(source.path, result.path); return result;
  }),
  pickReplace: async (path, note) => {
    const picked = await new Promise<File | undefined>(resolve => {
      const input = document.createElement('input'); input.type = 'file'; input.accept = `.${original(path).ext}`;
      input.addEventListener('change', () => resolve(input.files?.[0]), { once: true }); input.addEventListener('cancel', () => resolve(undefined), { once: true }); input.click();
    });
    if (!picked) return null;
    if (picked.name.split('.').at(-1)?.toLowerCase() !== original(path).ext.toLowerCase()) fail('invalid', '新版本的扩展名需与当前文件一致');
    return operation(() => replaceRecord(path, picked.size, note))();
  },
  restore: operation(versionId => {
    const version = state().fileVersions?.find(item => item.id === versionId && item.libraryRoot === root()) ?? fail('notFound', '当前文件库中找不到该版本');
    const existing = state().files.find(file => file.path.toLowerCase() === version.originalPath.toLowerCase());
    if (existing) save(existing.path, '恢复历史版本前保留');
    const restored = { ...version.file, path: version.originalPath, relPath: version.originalRelPath, name: version.originalRelPath.split('/').at(-1) ?? version.name, modifiedAt: now() };
    if (existing) Object.assign(existing, restored); else state().files.push(restored);
    copyImageIdentity(version.snapshotPath, restored.path);
    return restored;
  }),
  trashList: operation(recycleRows),
  restoreTrash: operation(recycleId => {
    const row = recycleRows().find(item => item.id === recycleId) ?? fail('notFound', '当前文件库中找不到该回收文件');
    relative(row.originalPath); const path = numbered(row.originalPath); const rel = relative(path);
    const restored: FileEntry = { ...row.file, path, relPath: rel, name: path.split('/').at(-1) ?? row.name, modifiedAt: now() };
    state().files.push(restored); row.restoredAt = now(); copyImageIdentity(row.storedPath, path); return restored;
  }),
};
