import type * as T from '../types';
import { ApiError } from '../error';
import { today } from '../../lib/dates';
import { netReceived, outstanding } from '../../lib/money';
import { createSeed } from './seed';
import { designAssetId, designImageById } from './designAssets';
import { migrateMockAssets } from './migrateAssets';

export type StoredClient = T.Client & { deletedAt: string | null };
export type StoredProject = T.Project & { deletedAt: string | null; deletedWithClient: boolean };
export interface MockData {
  version: 1; clients: StoredClient[]; projects: StoredProject[]; payments: T.Payment[];
  tags: T.Tag[]; activities: T.Activity[]; groups: T.SnippetGroup[]; snippets: T.Snippet[];
  files: T.FileEntry[]; libraryRoot: string | null; settings: T.Settings; backups: T.BackupInfo[];
  backupSnapshots: Record<string, string>;
  lastAutoBackupDate?: string;
  trashedFiles?: T.FileEntry[];
  fileAssets?: Record<string, string>;
  assetVersion?: 1;
}
export const storageKey = 'clientdesk.mock.v1';
let data: MockData | undefined;
export const now = () => new Date().toISOString();
export const id = () => crypto.randomUUID();
export function fail(code: string, message: string): never { throw new ApiError(code, message); }
export function required(value: string, label: string): string {
  if (!value.trim()) fail('invalidInput', `请填写${label}`);
  return value.trim();
}
export function cents(value: number) {
  if (!Number.isSafeInteger(value) || value < 0) fail('invalidInput', '金额必须为非负整数分');
}
export function date(value: string | null | undefined) {
  if (value == null) return;
  const parsed = new Date(`${value}T12:00:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(parsed.getTime()) || today(parsed) !== value) fail('invalidInput', '日期格式无效');
}
export function rating(value: number | undefined) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 5)) fail('invalidInput', '星级应为 0 至 5');
}
export function state(): MockData {
  if (data) return data;
  try {
    const saved = localStorage.getItem(storageKey);
    const parsed: unknown = saved ? JSON.parse(saved) : null;
    if (parsed && typeof parsed === 'object' && 'version' in parsed && parsed.version === 1 && 'clients' in parsed && Array.isArray(parsed.clients)) data = parsed as MockData;
  } catch { /* A damaged browser fixture can be safely replaced with a fresh seed. */ }
  data ??= createSeed();
  migrateMockAssets(data);
  return data;
}
export function persist() {
  try { localStorage.setItem(storageKey, JSON.stringify(state())); }
  catch { fail('storageFailed', '浏览器存储空间不足，数据未能保存'); }
}
export function reset() { data = createSeed(); persist(); }
export function replace(next: MockData) { migrateMockAssets(next); data = next; persist(); }
export function clientRecord(clientId: string, includeDeleted = false): StoredClient {
  return state().clients.find(c => c.id === clientId && (includeDeleted || !c.deletedAt)) ?? fail('notFound', '客户不存在或已删除');
}
export function projectRecord(projectId: string, includeDeleted = false): StoredProject {
  const project = state().projects.find(p => p.id === projectId && (includeDeleted || !p.deletedAt)) ?? fail('notFound', '项目不存在或已删除');
  if (!includeDeleted) clientRecord(project.clientId);
  return project;
}
export function projectValue(record: StoredProject): T.Project {
  const { deletedAt: _deletedAt, deletedWithClient: _deletedWithClient, ...project } = record;
  const payments = state().payments.filter(p => p.projectId === project.id);
  const files = state().files.filter(file => file.projectId === project.id);
  const cover = files.filter(eligibleCover)
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.path.localeCompare(b.path))[0];
  return { ...project, tagIds: [...project.tagIds], clientName: clientRecord(project.clientId, true).name,
    receivedCents: netReceived(payments), paymentCount: payments.length,
    fileCount: files.length, coverPath: cover ? mockImage(cover.path) : null };
}

export function eligibleCover(file: T.FileEntry): boolean {
  const parts = [...file.folderGroup.split(/[\\/]/).filter(Boolean), file.name];
  return parts.length <= 3 && parts.every(name => !name.startsWith('.') && !name.startsWith('~$') && !['thumbs.db', 'desktop.ini'].includes(name.toLowerCase()))
    && ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(file.ext.toLowerCase()) && file.sizeBytes <= 25 * 1024 * 1024;
}

export function mockImage(path: string): string | null {
  const assets = state().fileAssets ??= {};
  assets[path] ??= designAssetId(path);
  return designImageById(assets[path]);
}

/** Keep a file's sample identity when its absolute path changes. */
export function moveImageIdentity(oldPath: string, newPath: string): void {
  const assets = state().fileAssets ??= {};
  const assetId = assets[oldPath] ?? designAssetId(oldPath);
  delete assets[oldPath]; assets[newPath] = assetId;
}
export function clientValue(record: StoredClient): T.Client {
  const { deletedAt: _deletedAt, ...client } = record;
  const projects = state().projects.filter(p => p.clientId === client.id && !p.deletedAt).map(projectValue);
  const activityDates = state().activities.filter(a => a.clientId === client.id && (!a.projectId || projects.some(p => p.id === a.projectId))).map(a => a.createdAt);
  return { ...client, accounts: client.accounts.map(a => ({ ...a })), tagIds: [...client.tagIds],
    projectCount: projects.length, openProjectCount: projects.filter(p => !['done', 'cancelled'].includes(p.status)).length,
    billedCents: projects.reduce((sum, p) => sum + (p.status === 'cancelled' ? 0 : p.priceCents), 0),
    receivedCents: projects.reduce((sum, p) => sum + p.receivedCents, 0),
    outstandingCents: projects.reduce((sum, p) => sum + outstanding(p.priceCents, p.receivedCents, p.status), 0),
    firstProjectAt: projects.map(p => p.createdAt).sort()[0] ?? null,
    lastActivityAt: activityDates.sort().at(-1) ?? client.updatedAt };
}
export function tagValue(record: T.Tag): T.Tag {
  return { ...record, clientCount: state().clients.filter(c => !c.deletedAt && c.tagIds.includes(record.id)).length,
    projectCount: state().projects.filter(p => !p.deletedAt && p.tagIds.includes(record.id)).length };
}
export function checkTags(tagIds: string[]) {
  if (tagIds.some(tagId => !state().tags.some(t => t.id === tagId))) fail('notFound', '标签不存在');
  return [...new Set(tagIds)];
}
export function activity(clientId: string, projectId: string | null, kind: T.ActivityKind, body: string, meta: Record<string, unknown> = {}): T.Activity {
  const value: T.Activity = { id: id(), clientId, projectId, kind, body, meta, createdAt: now(),
    clientName: clientRecord(clientId, true).name, projectTitle: projectId ? projectRecord(projectId, true).title : null };
  state().activities.push(value);
  return value;
}
export function activeActivities() {
  const clientIds = new Set(state().clients.filter(c => !c.deletedAt).map(c => c.id));
  const projectIds = new Set(state().projects.filter(p => !p.deletedAt).map(p => p.id));
  return state().activities.filter(a => clientIds.has(a.clientId) && (!a.projectId || projectIds.has(a.projectId))).map(a => ({ ...a, meta: { ...a.meta },
    clientName: clientRecord(a.clientId).name, projectTitle: a.projectId ? projectRecord(a.projectId).title : null })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
export const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
/** Persist once per successful operation; roll back all in-memory changes on failure. */
export function operation<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => Promise<R> {
  return async (...args) => {
    const previous = clone(state());
    try { const result = fn(...args); persist(); return result === undefined ? result : clone(result); }
    catch (error) { data = previous; throw error; }
  };
}
