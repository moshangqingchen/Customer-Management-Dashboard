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
});
