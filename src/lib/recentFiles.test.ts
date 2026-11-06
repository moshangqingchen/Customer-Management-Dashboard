import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../api/types';
import { filterRecentFiles } from './recentFiles';

const file = (path: string, patch: Partial<FileEntry> = {}): FileEntry => ({ path, relPath: path, name: `${path}.PSD`, ext: 'psd', kind: 'design', sizeBytes: 12, modifiedAt: '2026-11-02T10:00:00Z', clientId: 'client1', projectId: null, folderGroup: '', ...patch });
describe('最近文件筛选', () => {
  it('名称忽略大小写并组合类型、客户条件，输出按修改时间排序且不改原数组', () => {
    const files = [file('old', { modifiedAt: '2026-10-01T10:00:00Z' }), file('new'), file('unassigned', { clientId: null }), file('image', { kind: 'image' })];
    expect(filterRecentFiles(files, { query: ' pSd ', kind: 'design', clientId: 'client1' }).map(value => value.path)).toEqual(['new', 'old']);
    expect(filterRecentFiles(files, { clientId: '__unassigned__' }).map(value => value.path)).toEqual(['unassigned']);
    expect(files[0].path).toBe('old');
  });
  it('可用客户目录与文件名组合查找，并区分项目和公共客户资料', () => {
    const files = [file('a', { relPath: '青木花店/春季宣传/定稿.ai', projectId: 'project1' }), file('b', { relPath: '青木花店/_客户资料/标志.ai' }), file('c', { clientId: null })];
    expect(filterRecentFiles(files, { query: '青木花店 定稿', projectId: 'project1' }).map(value => value.path)).toEqual(['a']);
    expect(filterRecentFiles(files, { projectId: '__client_files__' }).map(value => value.path)).toEqual(['b']);
    expect(filterRecentFiles(files, { query: '青木花店\\春季宣传' }).map(value => value.path)).toEqual(['a']);
  });
  it('修改日期按本地日历筛选并包含结束当天的文件', () => {
    const files = [file('inside', { modifiedAt: new Date(2026, 10, 5, 23, 59).toISOString() }), file('outside', { modifiedAt: new Date(2026, 10, 6, 0, 1).toISOString() })];
    expect(filterRecentFiles(files, { from: '2026-11-05', to: '2026-11-05' }).map(value => value.path)).toEqual(['inside']);
  });
});
