import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../api/types';
import { canThumbnail, destinationFolders, groupFiles, middleEllipsis } from './files';

const file = (name: string, projectId: string | null, folderGroup = '', modifiedAt = '2026-11-02T12:00:00Z'): FileEntry => ({ path: `D:/库/${name}`, relPath: name, name, ext: 'png', kind: 'image', sizeBytes: 100, modifiedAt, folderGroup, clientId: 'c', projectId });
describe('文件分组', () => {
  it('统一路径分隔符、根目录分组并按修改时间排序，不修改原数组', () => {
    const source = [file('旧稿.png', 'p', '过程稿\\初稿', '2026-10-01T00:00:00Z'), file('新稿.png', 'p', '过程稿/初稿'), file('说明.png', 'p')];
    const result = groupFiles(source);
    expect(result).toHaveLength(2);
    expect(result.find(group => group.label === '根目录')?.files[0].name).toBe('说明.png');
    expect(result.find(group => group.label === '过程稿/初稿')?.files.map(value => value.name)).toEqual(['新稿.png', '旧稿.png']);
    expect(source[0].name).toBe('旧稿.png');
  });
  it('客户汇总把不同项目的相同子目录分开，客户资料单列', () => {
    const result = groupFiles([file('甲.png', 'p1', '过程稿'), file('乙.png', 'p2', '过程稿'), file('名片.png', null)], true, [{ id: 'p1', title: '海报' }, { id: 'p2', title: '菜单' }]);
    expect(result.map(group => group.label)).toEqual(expect.arrayContaining(['海报 / 过程稿', '菜单 / 过程稿', '_客户资料']));
    expect(result).toHaveLength(3);
  });
  it('目标目录合并模板与已有子目录并去重', () => {
    expect(destinationFolders([file('甲.png', 'p', '交付成品'), file('乙.png', 'p', '自定义')], ['参考资料', '交付成品'])).toEqual(['', '参考资料', '交付成品', '自定义']);
  });
  it('25MB 边界允许缩略图，超大图片及源文件使用类型图标', () => {
    expect(canThumbnail('image', 25 * 1024 * 1024)).toBe(true);
    expect(canThumbnail('image', 25 * 1024 * 1024 + 1)).toBe(false);
    expect(canThumbnail('design', 100)).toBe(false);
    expect(middleEllipsis('非常长的文件名'.repeat(12) + '.psd')).toMatch(/….*\.psd$/);
  });
});
