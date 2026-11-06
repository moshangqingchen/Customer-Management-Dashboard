import type { FileEntry, FileKind, Project } from '../api/types';
import { isValid, parseISO } from 'date-fns';
import { relativeDate, today } from './dates';
const extensions: Record<FileKind, string[]> = {
  image: 'png jpg jpeg webp gif bmp svg'.split(' '), design: 'psd psb ai cdr sketch fig xd indd eps afdesign afphoto'.split(' '),
  pdf: ['pdf'], doc: 'doc docx xls xlsx ppt pptx txt md wps et dps csv'.split(' '), archive: ['zip', 'rar', '7z'], video: 'mp4 mov avi mkv webm'.split(' '), other: [],
};
export const fileExtension = (name: string) => name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
export const fileKind = (name: string): FileKind => (Object.keys(extensions) as FileKind[]).find(kind => extensions[kind].includes(fileExtension(name))) ?? 'other';
export const fileKindLabels: Record<FileKind, string> = { image: '图片', design: '设计源文件', pdf: 'PDF', doc: '文档', archive: '压缩包', video: '视频', other: '其他' };
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${Math.max(0, bytes)} B`;
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 4);
  return `${Number((bytes / 1024 ** unit).toFixed(1))} ${['B', 'KB', 'MB', 'GB', 'TB'][unit]}`;
}
export function middleEllipsis(name: string, maxLength = 28): string {
  const chars = [...name];
  if (chars.length <= maxLength) return name;
  const suffix = Math.min(Math.max(fileExtension(name).length + 4, 7), Math.floor(maxLength / 2));
  return `${chars.slice(0, Math.max(1, maxLength - suffix - 1)).join('')}…${chars.slice(-suffix).join('')}`;
}
export const canThumbnail = (kind: FileKind, bytes: number) => kind === 'image' && bytes <= 25 * 1024 * 1024;
/** Modification timestamps are displayed on the local calendar, like other activity dates. */
export function fileModifiedDate(value: string, base = today()): string {
  const date = parseISO(value);
  return isValid(date) ? relativeDate(today(date), base) : '—';
}

export interface FileGroup { key: string; folder: string; label: string; files: FileEntry[]; }
export type FileSort = 'modified-desc' | 'modified-asc' | 'name-asc' | 'name-desc';
const fileNameOrder = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const compareFilePaths = (a: FileEntry, b: FileEntry) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0;
function sortGroupFiles(files: readonly FileEntry[], sort: FileSort): FileEntry[] {
  const direction = sort.endsWith('-asc') ? 1 : -1;
  if (sort === 'name-asc' || sort === 'name-desc') {
    return [...files].sort((a, b) => direction * fileNameOrder.compare(a.name, b.name) || compareFilePaths(a, b));
  }
  return files.map(file => ({ file, time: Date.parse(file.modifiedAt) })).sort((a, b) => {
    const aValid = Number.isFinite(a.time); const bValid = Number.isFinite(b.time);
    if (aValid !== bValid) return aValid ? -1 : 1;
    const byTime = aValid && bValid ? direction * (a.time - b.time) : 0;
    return byTime || fileNameOrder.compare(a.file.name, b.file.name) || compareFilePaths(a.file, b.file);
  }).map(({ file }) => file);
}
/** Client aggregates retain project boundaries even when subfolder names match. */
export function groupFiles(files: readonly FileEntry[], includeProjects = false, projects: readonly Pick<Project, 'id' | 'title'>[] = [], sort: FileSort = 'modified-desc'): FileGroup[] {
  const result = new Map<string, FileGroup>();
  const projectNames = new Map(projects.map(project => [project.id, project.title]));
  for (const file of files) {
    const folder = file.folderGroup.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const owner = includeProjects ? file.projectId ?? 'client' : '';
    const key = `${owner}:${folder}`;
    const ownerLabel = file.projectId ? projectNames.get(file.projectId) ?? '项目文件' : '_客户资料';
    const label = includeProjects ? `${ownerLabel}${folder ? ` / ${folder}` : ''}` : folder || '根目录';
    let group = result.get(key);
    if (!group) { group = { key, folder, label, files: [] }; result.set(key, group); }
    group.files.push(file);
  }
  return [...result.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')).map(group => ({ ...group, files: sortGroupFiles(group.files, sort) }));
}

export function projectFileFolders(groups: readonly FileGroup[]) {
  const folders = new Map<string, FileGroup[]>();
  for (const group of groups) {
    const name = group.folder.split('/')[0];
    const contents = folders.get(name);
    if (contents) contents.push(group);
    else folders.set(name, [group]);
  }
  return [...folders].map(([name, contents]) => ({ name, groups: contents }));
}

export function destinationFolders(files: readonly FileEntry[], templates: readonly string[] = []): string[] {
  const folders = new Set<string>(['', ...templates]);
  for (const file of files) {
    if (file.folderGroup) folders.add(file.folderGroup);
  }
  return [...folders];
}

/** Undefined includes all owners; null selects client reference documents only. */
export function filterFiles(files: readonly FileEntry[], query: string, projectId?: string | null): FileEntry[] {
  const needle = query.trim().replace(/\\/g, '/').toLocaleLowerCase('zh-CN');
  return files.filter(file => (projectId === undefined || file.projectId === projectId)
    && (!needle || `${file.folderGroup.replace(/\\/g, '/')}/${file.name}`.toLocaleLowerCase('zh-CN').includes(needle)));
}
