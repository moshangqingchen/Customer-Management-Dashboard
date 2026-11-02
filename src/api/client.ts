import type * as T from './types';
import { toApiError } from './error';
export { ApiError, toApiError } from './error';

export type TagPatch = Partial<Pick<T.Tag, 'name' | 'color' | 'sort'>>;
export type GroupPatch = Partial<Pick<T.SnippetGroup, 'name' | 'sort'>>;
export type SnippetInput = Pick<T.Snippet, 'groupId' | 'title' | 'body'>;
export type SnippetPatch = Partial<SnippetInput & Pick<T.Snippet, 'sort'>>;
export type ActivityFilter = { clientId?: T.ID; projectId?: T.ID; limit?: number };
export type NoteInput = { clientId: T.ID; projectId?: T.ID; body: string };
export type TrashType = T.TrashItem['type'];

export interface Api {
  app: { info(): Promise<T.AppInfo>; saveTextFile(defaultName: string, content: string): Promise<string | null> };
  library: { status(): Promise<T.LibraryStatus>; setRoot(path: string): Promise<T.LibraryStatus>; openRoot(): Promise<void>; pickFolder(title?: string): Promise<string | null> };
  clients: {
    list(): Promise<T.Client[]>; get(id: T.ID): Promise<T.Client>; create(input: T.ClientInput): Promise<T.Client>;
    update(id: T.ID, patch: T.ClientPatch): Promise<T.MutationResult<T.Client>>; delete(id: T.ID): Promise<void>;
    setTags(clientId: T.ID, tagIds: T.ID[]): Promise<void>;
  };
  projects: {
    list(): Promise<T.Project[]>; get(id: T.ID): Promise<T.Project>; create(input: T.ProjectInput): Promise<T.Project>;
    update(id: T.ID, patch: T.ProjectPatch): Promise<T.MutationResult<T.Project>>;
    setStatus(id: T.ID, status: T.ProjectStatus): Promise<T.Project>; duplicate(id: T.ID): Promise<T.Project>;
    delete(id: T.ID): Promise<void>; setTags(projectId: T.ID, tagIds: T.ID[]): Promise<void>;
  };
  payments: {
    list(projectId: T.ID): Promise<T.Payment[]>; all(): Promise<T.PaymentWithContext[]>;
    add(input: T.PaymentInput): Promise<T.Payment>; update(id: T.ID, patch: T.PaymentPatch): Promise<T.Payment>; delete(id: T.ID): Promise<void>;
  };
  tags: { list(): Promise<T.Tag[]>; create(name: string, color: T.TagColor): Promise<T.Tag>; update(id: T.ID, patch: TagPatch): Promise<T.Tag>; delete(id: T.ID): Promise<void>; merge(sourceId: T.ID, targetId: T.ID): Promise<T.Tag> };
  activities: { list(filter?: ActivityFilter): Promise<T.Activity[]>; recent(limit: number): Promise<T.Activity[]>; addNote(input: NoteInput): Promise<T.Activity>; updateNote(id: T.ID, body: string): Promise<T.Activity>; delete(id: T.ID): Promise<void> };
  files: {
    list(target: T.FileTarget, includeProjects?: boolean): Promise<T.FileListResult>; recent(limit: number): Promise<T.FileEntry[]>;
    add(target: T.FileTarget, sourcePaths: string[], subfolder?: string): Promise<T.FileEntry[]>;
    pickAndAdd(target: T.FileTarget, subfolder?: string): Promise<T.FileEntry[]>;
    open(path: string): Promise<void>; reveal(path: string): Promise<void>; rename(path: string, newName: string): Promise<T.FileEntry>;
    trash(path: string): Promise<void>; openFolder(target: T.FileTarget): Promise<void>;
  };
  snippetGroups: { list(): Promise<T.SnippetGroup[]>; create(name: string): Promise<T.SnippetGroup>; update(id: T.ID, patch: GroupPatch): Promise<T.SnippetGroup>; delete(id: T.ID): Promise<void> };
  snippets: { list(): Promise<T.Snippet[]>; create(input: SnippetInput): Promise<T.Snippet>; update(id: T.ID, patch: SnippetPatch): Promise<T.Snippet>; delete(id: T.ID): Promise<void>; markUsed(id: T.ID): Promise<void> };
  settings: { get(): Promise<T.Settings>; update(patch: Partial<T.Settings>): Promise<T.Settings> };
  backups: { list(): Promise<T.BackupInfo[]>; create(): Promise<T.BackupInfo>; restore(fileName: string): Promise<void> };
  trash: { list(): Promise<T.TrashItem[]>; restore(type: TrashType, id: T.ID): Promise<void>; purge(type: TrashType, id: T.ID): Promise<void> };
}

export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
let implementation: Promise<Api> | undefined;
export function getApi(): Promise<Api> {
  implementation ??= isTauri ? import('./tauri').then(m => m.tauriApi) : import('./mock').then(m => m.mockApi);
  return implementation;
}
export async function thumbnail(path: string): Promise<string> {
  if (isTauri) return (await import('@tauri-apps/api/core')).convertFileSrc(path);
  return (await import('./mock')).thumbnail(path);
}
// Keep runtime implementations out of the initial bundle, with one error boundary for every method.
export const api = new Proxy({} as Api, {
  get: (_target, group: keyof Api) => new Proxy({}, {
    get: (_namespace, method: string) => async (...args: unknown[]): Promise<unknown> => {
      try {
        const namespace = (await getApi())[group];
        const fn = Reflect.get(namespace, method) as (...values: unknown[]) => Promise<unknown>;
        return await fn(...args);
      } catch (error) { throw toApiError(error); }
    },
  }),
});
