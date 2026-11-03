import { toast } from 'sonner';
import type { Api } from '../client';
import type * as T from '../types';
import { today } from '../../lib/dates';
import { activities, clients, payments, projects, tags } from './entities';
import { files, rebaseFiles, sanitize } from './files';
import { clientRecord, clone, fail, id, now, operation, persist, projectRecord, replace, required, reset, state } from './store';
export { addBrowserFiles } from './files';
export { thumbnail } from './thumbnails';

const sorted = <T extends { sort: number; name?: string }>(records: T[]) => [...records].sort((a, b) => a.sort - b.sort || (a.name ?? '').localeCompare(b.name ?? '', 'zh-CN'));
function groupRecord(groupId: string) { return state().groups.find(group => group.id === groupId) ?? fail('notFound', '话术分组不存在'); }
function snippetRecord(snippetId: string) { return state().snippets.find(snippet => snippet.id === snippetId) ?? fail('notFound', '话术不存在'); }
function status(): T.LibraryStatus { return { root: state().libraryRoot, state: state().libraryRoot ? 'ready' : 'notConfigured', freeBytes: state().libraryRoot ? 128 * 1024 ** 3 : null, message: state().libraryRoot ? '浏览器演示文件库已就绪' : '请选择文件库位置' }; }
function backup(kind: T.BackupInfo['kind']): T.BackupInfo {
  const timestamp = now();
  const fileName = `client-desk-${timestamp.replace(/[-:]/g, '').replace('T', '-').slice(0, 15)}-${kind}-${id().slice(0, 8)}.db`;
  const snapshot = JSON.stringify({ ...state(), backupSnapshots: {}, backups: [] });
  const value: T.BackupInfo = { fileName, path: `${state().libraryRoot ?? '浏览器演示数据'}/_备份/${fileName}`, sizeBytes: new Blob([snapshot]).size, createdAt: timestamp, kind };
  state().backups.push(value); state().backupSnapshots[fileName] = snapshot;
  return value;
}
function purgeProject(projectId: string) {
  state().projects = state().projects.filter(project => project.id !== projectId);
  state().payments = state().payments.filter(payment => payment.projectId !== projectId);
  state().activities = state().activities.filter(activity => activity.projectId !== projectId);
}

export const mockApi: Api = {
  clients, projects, payments, tags, activities, files,
  app: {
    info: operation(() => state().appInfo ?? { version: '2.0.1', dataDir: '浏览器本地存储', dbPath: 'clientdesk.mock.v1', portable: false, suggestedLibraryRoot: null }),
    openDataDir: operation(() => { toast.info('模拟打开数据文件夹'); }),
    saveTextFile: async (defaultName, content) => {
      const url = URL.createObjectURL(new Blob(['\ufeff', content], { type: 'text/plain;charset=utf-8' }));
      const link = document.createElement('a'); link.href = url; link.download = defaultName; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); return defaultName;
    },
  },
  library: {
    status: operation(status),
    setRoot: operation(rawPath => {
      const normalized = required(rawPath, '文件库路径').replace(/\\/g, '/');
      const path = /^(?:[A-Za-z]:\/|\/)\/*$/.test(normalized) ? normalized.replace(/\/+$/, '/') : normalized.replace(/\/+$/, '');
      if (!/^(?:[A-Za-z]:\/|\/|\/\/)/.test(path) || path.split('/').includes('..')) fail('invalidPath', '请选择绝对路径');
      state().libraryRoot = path; rebaseFiles(path); return status();
    }),
    openRoot: operation(() => { if (!state().libraryRoot) fail('libraryNotConfigured', '请先选择文件库位置'); toast.info('模拟打开文件库'); }),
    pickFolder: operation(() => 'D:\\客户工作台'),
  },
  snippetGroups: {
    list: operation(() => sorted(state().groups)),
    create: operation(name => { const value = { id: id(), name: required(name, '分组名称'), sort: state().groups.length }; state().groups.push(value); return value; }),
    update: operation((groupId, patch) => { const record = groupRecord(groupId); Object.assign(record, patch, { name: patch.name === undefined ? record.name : required(patch.name, '分组名称') }); return record; }),
    delete: operation(groupId => { groupRecord(groupId); state().groups = state().groups.filter(group => group.id !== groupId); state().snippets = state().snippets.filter(snippet => snippet.groupId !== groupId); }),
  },
  snippets: {
    list: operation(() => sorted(state().snippets)),
    create: operation(input => {
      groupRecord(input.groupId); const value = { id: id(), ...input, title: required(input.title, '话术标题'), body: required(input.body, '话术内容'), sort: state().snippets.filter(snippet => snippet.groupId === input.groupId).length, useCount: 0, updatedAt: now() };
      state().snippets.push(value); return value;
    }),
    update: operation((snippetId, patch) => {
      const record = snippetRecord(snippetId); if (patch.groupId !== undefined) groupRecord(patch.groupId);
      Object.assign(record, patch, { title: patch.title === undefined ? record.title : required(patch.title, '话术标题'), body: patch.body === undefined ? record.body : required(patch.body, '话术内容'), updatedAt: now() }); return record;
    }),
    delete: operation(snippetId => { snippetRecord(snippetId); state().snippets = state().snippets.filter(snippet => snippet.id !== snippetId); }),
    markUsed: operation(snippetId => { snippetRecord(snippetId).useCount++; }),
  },
  settings: {
    get: operation(() => state().settings),
    update: operation(patch => {
      for (const names of [patch.paymentMethods, patch.sourcePlatforms, patch.subfolderTemplate]) {
        if (!names) continue;
        const unique = new Set<string>();
        for (const name of names) {
          const trimmed = required(name, '名称').toLocaleLowerCase();
          if (unique.has(trimmed)) fail('invalidInput', '名称不能重复');
          unique.add(trimmed);
        }
      }
      if (patch.subfolderTemplate?.some(name => name !== sanitize(name))) fail('invalidInput', '子文件夹模板包含非法名称');
      Object.assign(state().settings, clone(patch)); return state().settings;
    }),
  },
  backups: {
    list: operation(() => [...state().backups].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
    create: operation(() => backup('manual')),
    restore: operation(fileName => {
      const snapshot = state().backupSnapshots[fileName] ?? fail('notFound', '备份不存在');
      backup('beforeRestore');
      const backups = clone(state().backups); const snapshots = clone(state().backupSnapshots);
      const restored = JSON.parse(snapshot) as ReturnType<typeof state>;
      replace({ ...restored, backups, backupSnapshots: snapshots });
    }),
  },
  trash: {
    list: operation(() => [
      ...state().clients.filter(client => client.deletedAt).map(client => ({ type: 'client' as const, id: client.id, title: client.name, subtitle: client.company, deletedAt: client.deletedAt! })),
      ...state().projects.filter(project => project.deletedAt).map(project => ({ type: 'project' as const, id: project.id, title: project.title, subtitle: clientRecord(project.clientId, true).name, deletedAt: project.deletedAt! })),
    ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt))),
    restore: operation((type, recordId) => {
      if (type === 'client') {
        clientRecord(recordId, true).deletedAt = null;
        state().projects.filter(project => project.clientId === recordId && project.deletedWithClient).forEach(project => { project.deletedAt = null; project.deletedWithClient = false; });
      } else {
        const record = projectRecord(recordId, true);
        if (clientRecord(record.clientId, true).deletedAt) fail('clientDeleted', '请先恢复所属客户');
        record.deletedAt = null; record.deletedWithClient = false;
      }
    }),
    purge: operation((type, recordId) => {
      if (type === 'client') {
        const record = clientRecord(recordId, true); if (!record.deletedAt) fail('invalidInput', '请先将客户移入回收站');
        state().projects.filter(project => project.clientId === recordId).forEach(project => purgeProject(project.id));
        state().activities = state().activities.filter(activity => activity.clientId !== recordId);
        state().clients = state().clients.filter(client => client.id !== recordId);
      } else {
        if (!projectRecord(recordId, true).deletedAt) fail('invalidInput', '请先将项目移入回收站'); purgeProject(recordId);
      }
      toast.info('记录已彻底删除，模拟文件夹予以保留');
    }),
  },
};

declare global { interface Window { __mock: { reset(): void } } }
if (typeof window !== 'undefined') window.__mock = { reset: () => { reset(); window.dispatchEvent(new Event('mock-reset')); } };
if (state().lastAutoBackupDate !== today()) {
  backup('auto'); state().lastAutoBackupDate = today();
  const older = state().backups.filter(value => value.kind === 'auto').sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(30);
  const obsolete = new Set(older.map(value => value.fileName));
  state().backups = state().backups.filter(value => !obsolete.has(value.fileName));
  older.forEach(value => { delete state().backupSnapshots[value.fileName]; });
  persist();
}
