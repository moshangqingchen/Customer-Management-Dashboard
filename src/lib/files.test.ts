import { describe, expect, it } from 'vitest';
import type { FileEntry } from '../api/types';
import { canThumbnail, destinationFolders, fileModifiedDate, filterFiles, groupFiles, middleEllipsis, projectFileFolders } from './files';

const file = (name: string, projectId: string | null, folderGroup = '', modifiedAt = '2026-11-02T12:00:00Z'): FileEntry => ({ path: `D:/库/${name}`, relPath: name, name, ext: 'png', kind: 'image', sizeBytes: 100, modifiedAt, folderGroup, clientId: 'c', projectId });
describe('文件分组', () => {
  it('文件名自然数字升降序保留目录分组且不修改源数组', () => {
    const source = [file('10_设计.png', 'p', '交付成品'), file('2_设计.png', 'p', '交付成品'), file('01_设计.png', 'p', '交付成品'), file('参考.png', 'p', '参考资料')];
    const before = structuredClone(source);
    const asc = groupFiles(source, false, [], 'name-asc');
    const desc = groupFiles(source, false, [], 'name-desc');
    expect(asc.find(group => group.folder === '交付成品')?.files.map(value => value.name)).toEqual(['01_设计.png', '2_设计.png', '10_设计.png']);
    expect(desc.find(group => group.folder === '交付成品')?.files.map(value => value.name)).toEqual(['10_设计.png', '2_设计.png', '01_设计.png']);
    expect(asc.map(group => group.key)).toEqual(desc.map(group => group.key));
    expect(source).toEqual(before);
  });
  it('修改时间按真实时刻升降序，无效时间始终放末尾', () => {
    const source = [file('较旧.png', 'p', '', '2026-11-02T10:00:00+08:00'), file('较新.png', 'p', '', '2026-11-02T04:00:00Z'), file('无时间.png', 'p', '', 'invalid')];
    expect(groupFiles(source, false, [], 'modified-desc')[0].files.map(value => value.name)).toEqual(['较新.png', '较旧.png', '无时间.png']);
    expect(groupFiles(source, false, [], 'modified-asc')[0].files.map(value => value.name)).toEqual(['较旧.png', '较新.png', '无时间.png']);
  });
  it('同名文件以路径稳定排序，不因输入顺序改变', () => {
    const a = { ...file('同名.png', null), path: 'D:/库/A/同名.png' };
    const b = { ...file('同名.png', null), path: 'D:/库/B/同名.png' };
    for (const mode of ['modified-desc', 'modified-asc', 'name-asc', 'name-desc'] as const) {
      expect(groupFiles([b, a], false, [], mode)[0].files).toEqual(groupFiles([a, b], false, [], mode)[0].files);
    }
  });
  it('就地查找同时匹配名称与目录，并保持客户资料和具体项目的边界', () => {
    const files = [file('LOGO.png', null, '品牌资料'), file('LOGO.png', 'p1', '交付成品\\源文件'), file('海报.png', 'p2', '交付成品')];
    expect(filterFiles(files, ' logo ')).toHaveLength(2);
    expect(filterFiles(files, '交付成品/源文件', 'p1')).toEqual([files[1]]);
    expect(filterFiles(files, '', null)).toEqual([files[0]]);
    expect(filterFiles(files, '交付成品', 'p2')).toEqual([files[2]]);
    expect(filterFiles(files, '交付成品', null)).toEqual([]);
  });
  it('修改时间按本地日历显示，跨年带年份，无效时间显示占位', () => {
    const previousYear = new Date(2025, 11, 31, 23, 30).toISOString();
    expect(fileModifiedDate(previousYear, '2026-11-02')).toBe('2025年12月31日');
    expect(fileModifiedDate(new Date(2026, 10, 2, 23, 30).toISOString(), '2026-11-02')).toBe('今天');
    expect(fileModifiedDate('invalid', '2026-11-02')).toBe('—');
  });
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
  it('按真实顶层目录归集交付文件，区分根目录、同前缀目录及其他目录里的交付文件', () => {
    const groups = groupFiles([
      file('正文.png', 'p', '交付成品'), file('源稿.png', 'p', '交付成品\\源文件'),
      file('旧稿.png', 'p', '交付成品备份'), file('样例.png', 'p', '参考资料/交付成品'),
      file('清单.png', 'p'), file('附件.png', 'p', '根目录'),
    ]);
    const folders = projectFileFolders(groups);
    expect(folders).toHaveLength(5);
    const delivery = folders.find(folder => folder.name === '交付成品');
    expect(delivery?.groups.map(group => group.folder)).toEqual(['交付成品', '交付成品/源文件']);
    expect(delivery?.groups.flatMap(group => group.files.map(entry => entry.name))).toEqual(['正文.png', '源稿.png']);
    expect(folders.find(folder => !folder.name)?.groups[0].files[0].name).toBe('清单.png');
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
