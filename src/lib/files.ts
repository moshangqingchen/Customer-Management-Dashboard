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

export interface FileGroup { key: string; label: string; files: FileEntry[]; }
/** Client aggregates retain project boundaries even when subfolder names match. */
export function groupFiles(files: readonly FileEntry[], includeProjects = false, projects: readonly Pick<Project, 'id' | 'title'>[] = []): FileGroup[] {
  const result = new Map<string, FileGroup>();
  const projectNames = new Map(projects.map(project => [project.id, project.title]));
  for (const file of files) {
    const folder = file.folderGroup.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
    const owner = includeProjects ? file.projectId ?? 'client' : '';
    const key = `${owner}:${folder}`;
    const ownerLabel = file.projectId ? projectNames.get(file.projectId) ?? '项目文件' : '_客户资料';
    const label = includeProjects ? `${ownerLabel}${folder ? ` / ${folder}` : ''}` : folder || '根目录';
    let group = result.get(key);
    if (!group) { group = { key, label, files: [] }; result.set(key, group); }
    group.files.push(file);
  }
  return [...result.values()].sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')).map(group => ({ ...group, files: [...group.files].sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt) || a.name.localeCompare(b.name, 'zh-CN')) }));
}

export function destinationFolders(files: readonly FileEntry[], templates: readonly string[] = []): string[] {
  const folders = new Set<string>(['', ...templates]);
  for (const file of files) {
    if (file.folderGroup) folders.add(file.folderGroup);
  }
  return [...folders];
}
