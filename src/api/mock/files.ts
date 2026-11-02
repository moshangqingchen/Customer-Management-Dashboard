import { toast } from 'sonner';
import type { Api } from '../client';
import type * as T from '../types';
import { fileExtension, fileKind } from '../../lib/files';
import { activity, clientRecord, fail, moveImageIdentity, now, operation, projectRecord, required, state } from './store';
import type { StoredClient, StoredProject } from './store';

const normalize = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '');
export function sanitize(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|\p{Cc}]/gu, '_').replace(/^[\s.]+|[\s.]+$/g, '');
  let value = [...clean].slice(0, 80).join('').replace(/[\s.]+$/g, '') || '未命名';
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])\s*(?:\.|$)/i.test(value)) {
    const dot = value.indexOf('.'); const position = dot < 0 ? value.length : dot;
    value = [...`${value.slice(0, position)}_${value.slice(position)}`].slice(0, 80).join('');
  }
  return value;
}
function root() { return state().libraryRoot ?? fail('libraryNotConfigured', '请先选择文件库位置'); }
function safePath(path: string): string {
  const value = normalize(path); const base = normalize(root());
  if (value.split('/').includes('..') || (value.toLocaleLowerCase() !== base.toLocaleLowerCase() && !value.toLocaleLowerCase().startsWith(`${base.toLocaleLowerCase()}/`))) fail('outsideLibrary', '路径不在文件库内');
  return value;
}
function uniqueFolder(proposed: string, except?: string): string {
  const occupied = [...state().clients, ...state().projects].filter(record => record.id !== except).map(record => record.folder?.toLocaleLowerCase());
  let folder = proposed; let count = 2;
  while (occupied.includes(folder.toLocaleLowerCase()) || ['_备份', '_回收站'].includes(folder)) folder = `${proposed} (${count++})`;
  return folder;
}
function clientFolder(client: StoredClient) { client.folder ??= uniqueFolder(sanitize(client.name), client.id); return client.folder; }
function folder(target: T.FileTarget): string {
  root();
  if ('projectId' in target) {
    const project = projectRecord(target.projectId); const client = clientRecord(project.clientId);
    project.folder ??= uniqueFolder(`${clientFolder(client)}/${projectMonth(project)} ${sanitize(project.title)}`, project.id);
    return project.folder;
  }
  return `${clientFolder(clientRecord(target.clientId))}/_客户资料`;
}
function replacePrefix(oldFolder: string, newFolder: string) {
  state().files.forEach(file => {
    if (file.relPath === oldFolder || file.relPath.startsWith(`${oldFolder}/`)) {
      file.relPath = newFolder + file.relPath.slice(oldFolder.length);
      const path = `${normalize(state().libraryRoot ?? 'D:/客户工作台')}/${file.relPath}`;
      moveImageIdentity(file.path, path); file.path = path;
    }
  });
}
export function renameClientFolder(client: StoredClient) {
  root();
  if (!client.folder) return;
  const oldFolder = client.folder; client.folder = uniqueFolder(sanitize(client.name), client.id);
  state().projects.filter(p => p.folder?.startsWith(`${oldFolder}/`)).forEach(p => { p.folder = client.folder + p.folder!.slice(oldFolder.length); });
  replacePrefix(oldFolder, client.folder);
}
export function renameProjectFolder(project: StoredProject) {
  root();
  if (!project.folder) return;
  const oldFolder = project.folder;
  const parent = oldFolder.slice(0, oldFolder.lastIndexOf('/'));
  project.folder = uniqueFolder(`${parent}/${projectMonth(project)} ${sanitize(project.title)}`, project.id);
  replacePrefix(oldFolder, project.folder);
}
const projectMonth = (project: StoredProject) => {
  const created = new Date(project.createdAt);
  return `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
};
export function rebaseFiles(path: string) { state().files.forEach(file => {
  const next = `${normalize(path)}/${file.relPath}`;
  moveImageIdentity(file.path, next); file.path = next;
}); }
function fileRecord(path: string) {
  const normalized = safePath(path);
  return state().files.find(file => normalize(file.path).toLocaleLowerCase() === normalized.toLocaleLowerCase()) ?? fail('notFound', '文件不存在');
}
function activeFile(file: T.FileEntry) {
  return (!file.clientId || state().clients.some(c => c.id === file.clientId && !c.deletedAt)) && (!file.projectId || state().projects.some(p => p.id === file.projectId && !p.deletedAt));
}
function uniqueName(directory: string, name: string) {
  const extension = fileExtension(name); const stem = extension ? name.slice(0, -(extension.length + 1)) : name;
  const suffix = extension ? `.${extension}` : ''; let candidate = name; let count = 2;
  while (state().files.some(file => file.relPath.toLocaleLowerCase() === `${directory}/${candidate}`.toLocaleLowerCase())) candidate = `${stem} (${count++})${suffix}`;
  return candidate;
}
export function addFileRecords(target: T.FileTarget, source: { name: string; size: number }[], subfolder = ''): T.FileEntry[] {
  if (subfolder.split(/[\\/]/).some(segment => segment === '..') || /^[\\/]|^[A-Za-z]:/.test(subfolder)) fail('outsideLibrary', '子文件夹路径无效');
  const baseFolder = folder(target); const group = subfolder.split(/[\\/]/).filter(Boolean).map(sanitize).join('/');
  const directory = `${baseFolder}${group ? `/${group}` : ''}`;
  const project = 'projectId' in target ? projectRecord(target.projectId) : null;
  const clientId = project?.clientId ?? ('clientId' in target ? target.clientId : null);
  const result = source.map(sourceFile => {
    const name = uniqueName(directory, sanitize(sourceFile.name)); const relPath = `${directory}/${name}`;
    const entry: T.FileEntry = { path: `${normalize(root())}/${relPath}`, relPath, name, ext: fileExtension(name), kind: fileKind(name), sizeBytes: Math.max(0, sourceFile.size), modifiedAt: now(), folderGroup: group, clientId, projectId: project?.id ?? null };
    state().files.push(entry); return entry;
  });
  if (result.length && clientId) activity(clientId, project?.id ?? null, 'file', `添加了 ${result.length} 个文件`, { names: result.map(file => file.name) });
  return result;
}
function addResult(target: T.FileTarget, incoming: { name: string; size: number; error?: string }[], subfolder?: string): T.FilesAddResult {
  // Validate the destination before collecting per-file failures, including an empty selection.
  addFileRecords(target, [], subfolder);
  const failed: T.FilesAddResult['failed'] = [];
  const accepted = incoming.filter(file => {
    const message = file.error ?? (!file.name.trim() ? '文件名不能为空' : !Number.isFinite(file.size) || file.size < 0 ? '文件大小无效' : undefined);
    if (message) failed.push({ name: file.name || '未命名', message });
    return !message;
  });
  const added = addFileRecords(target, accepted, subfolder);
  if (failed.length && added.length) {
    const latest = state().activities.at(-1);
    if (latest?.kind === 'file') {
      latest.meta.failedNames = failed.map(file => file.name);
      latest.meta.errors = failed.map(file => `${file.name}：${file.message}`);
      latest.body += `；以下文件添加失败：${failed.map(file => `${file.name}：${file.message}`).join('；')}`;
    }
  }
  return { added, failed };
}
export const addBrowserFiles = operation((target: T.FileTarget, incoming: { name: string; size: number }[], subfolder?: string) => addResult(target, incoming, subfolder));
function pickFiles(): Promise<File[]> {
  return new Promise(resolve => {
    const input = document.createElement('input'); input.type = 'file'; input.multiple = true;
    input.addEventListener('change', () => resolve(Array.from(input.files ?? [])), { once: true });
    input.addEventListener('cancel', () => resolve([]), { once: true }); input.click();
  });
}
export const files: Api['files'] = {
  list: operation((target, includeProjects = false) => {
    const libraryRoot = normalize(root());
    const record = 'projectId' in target ? projectRecord(target.projectId) : clientRecord(target.clientId);
    const result = state().files.filter(file => activeFile(file) && ('projectId' in target ? file.projectId === target.projectId : file.clientId === target.clientId && (includeProjects || !file.projectId)));
    const base = record.folder ? `${libraryRoot}/${record.folder}${'clientId' in target ? '/_客户资料' : ''}` : null;
    return { files: result.sort((a, b) => a.relPath.localeCompare(b.relPath)), folder: base, folderMissing: false };
  }),
  recent: operation(limit => { root(); return state().files.filter(activeFile).sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt)).slice(0, Math.max(0, limit)); }),
  add: operation((target, sourcePaths, subfolder) => addResult(target, sourcePaths.map(path => ({ name: normalize(path).split('/').at(-1) ?? '未命名', size: 0, error: !/^(?:[A-Za-z]:[\\/]|[\\/])/.test(path) ? '源文件位置必须是绝对路径' : undefined })), subfolder)),
  pickAndAdd: async (target, subfolder) => addBrowserFiles(target, await pickFiles(), subfolder),
  open: operation(path => { const file = fileRecord(path); toast.info(`模拟打开：${file.name}`); }),
  reveal: operation(path => { const file = fileRecord(path); toast.info(`模拟在文件夹中显示：${file.name}`); }),
  rename: operation((path, rawName) => {
    const file = fileRecord(path); const name = required(rawName, '文件名');
    if (/[\\/]/.test(name) || sanitize(name) !== name) fail('invalidInput', '文件名包含无效字符');
    const directory = file.relPath.slice(0, -(file.name.length + 1));
    if (state().files.some(other => other !== file && other.relPath.toLocaleLowerCase() === `${directory}/${name}`.toLocaleLowerCase())) fail('exists', '已有同名文件');
    const nextPath = `${normalize(root())}/${directory}/${name}`;
    moveImageIdentity(file.path, nextPath);
    Object.assign(file, { name, ext: fileExtension(name), kind: fileKind(name), relPath: `${directory}/${name}`, path: nextPath, modifiedAt: now() });
    return file;
  }),
  trash: operation(path => {
    const file = fileRecord(path); state().files = state().files.filter(entry => entry !== file);
    const recycled = state().trashedFiles ??= [];
    let relPath = `_回收站/${file.relPath}`;
    if (recycled.some(entry => entry.relPath === relPath)) relPath = `${relPath}.${Date.now()}`;
    recycled.push({ ...file, relPath, path: `${normalize(root())}/${relPath}` });
    toast.info('文件已移入模拟回收站');
  }),
  openFolder: operation(target => { const value = folder(target); toast.info(`模拟打开文件夹：${value}`); }),
};
