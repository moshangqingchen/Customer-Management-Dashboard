import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FileEntry } from '../types';
import { mockApi, addBrowserFiles, thumbnail } from './index';
import { createSeed } from './seed';
import { reset, state, storageKey } from './store';
import { designAssetId, designImageById } from './designAssets';
import { migrateMockAssets } from './migrateAssets';

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
beforeEach(reset);

function legacySeed() {
  const data = createSeed('2030-03-15');
  delete data.assetVersion; delete data.fileAssets;
  data.files = data.files.filter(file => file.kind !== 'image');
  data.clients.forEach(client => { client.folder = null; });
  data.projects.forEach(project => { project.folder = null; Reflect.deleteProperty(project, 'coverPath'); });
  for (let index = 0; index < 8; index++) {
    const project = data.projects[index]; const client = data.clients[index];
    client.folder = client.name; project.folder = `${client.folder}/${project.createdAt.slice(0, 7)} ${project.title}`;
    const name = `${project.title}·方案.svg`; const relPath = `${project.folder}/交付成品/${name}`;
    data.files.push({ path: `D:/客户工作台/${relPath}`, relPath, name, ext: 'svg', kind: 'image', sizeBytes: 1800 + index * 210,
      modifiedAt: project.updatedAt, folderGroup: '交付成品', clientId: client.id, projectId: project.id });
  }
  return data;
}

describe('Mock 封面身份与兼容升级', () => {
  it('未预先读取缩略图也能在文件改名、客户/项目文件夹改名及换库后保持同一图片', async () => {
    await mockApi.library.setRoot('D:/客户工作台');
    const client = await mockApi.clients.create({ name: '稳定图客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '稳定图项目' });
    const [original] = (await addBrowserFiles({ projectId: project.id }, [{ name: '初稿.png', size: 100 }])).added;
    const assetId = designAssetId(original.path);
    await mockApi.files.rename(original.path, '定稿.webp');
    await mockApi.clients.update(client.id, { name: '新的客户名', renameFolder: true });
    await mockApi.projects.update(project.id, { title: '新的项目名', renameFolder: true });
    await mockApi.library.setRoot('E:/设计素材');
    const [current] = (await mockApi.files.list({ projectId: project.id })).files;
    expect(current.path).toContain('E:/设计素材/新的客户名/');
    expect(current.path).toContain('新的项目名/');
    expect(current.name).toBe('定稿.webp');
    expect(thumbnail(current.path)).toBe(designImageById(assetId));
    expect((await mockApi.projects.get(project.id)).coverPath).toBe(designImageById(assetId));
    expect(state().fileAssets?.[current.path]).toBe(assetId);
    expect(state().fileAssets?.[original.path]).toBeUndefined();
    expect(current).not.toHaveProperty('assetId');
  });

  it('稳定图片身份进入原有备份快照，恢复后继续改名仍保持原图', async () => {
    await mockApi.library.setRoot('D:/客户工作台');
    const project = (await mockApi.projects.list()).find(value => value.id === 'project-1')!;
    const [image] = (await mockApi.files.list({ projectId: project.id })).files.filter(file => file.kind === 'image');
    const expected = thumbnail(image.path);
    const backup = await mockApi.backups.create();
    await mockApi.files.rename(image.path, '临时改名.webp');
    await mockApi.backups.restore(backup.fileName);
    const restored = await mockApi.files.rename(image.path, '恢复后改名.webp');
    expect(thumbnail(restored.path)).toBe(expected);
    expect((JSON.parse(localStorage.getItem(storageKey)!) as ReturnType<typeof state>).fileAssets?.[restored.path]).toBeTruthy();
  });

  it('封面排除第四层、隐藏文件/目录与系统临时文件，不扩大原有文件计数行为', async () => {
    await mockApi.library.setRoot('D:/客户工作台');
    const client = await mockApi.clients.create({ name: '深度规则客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '深度规则项目' });
    const [valid] = (await addBrowserFiles({ projectId: project.id }, [{ name: '可见稿.png', size: 100 }], '一层/二层')).added;
    const [deep] = (await addBrowserFiles({ projectId: project.id }, [{ name: '第四层.png', size: 100 }], '一层/二层/三层')).added;
    const hidden: FileEntry[] = [
      { ...valid, name: '.隐藏.png', path: `${valid.path}.hidden`, folderGroup: '' },
      { ...valid, name: '~$临时.png', path: `${valid.path}.temp`, folderGroup: '' },
      { ...valid, name: '目录里的图片.png', path: `${valid.path}.directory`, folderGroup: '.隐藏目录' },
      { ...valid, name: '临时目录图片.png', path: `${valid.path}.temporary`, folderGroup: '~$目录' },
    ];
    state().files.push(...hidden);
    state().files.filter(file => file.path === deep.path || hidden.some(value => value.path === file.path)).forEach(file => { file.modifiedAt = '2099-01-01T00:00:00Z'; });
    const value = await mockApi.projects.get(project.id);
    expect(value.coverPath).toBe(thumbnail(valid.path));
    expect(value.fileCount).toBe(6);
  });

  it('旧种子升级只改演示图片，保留业务字段、自建文件、修改与已删除的预置图片', () => {
    const data = legacySeed();
    data.projects[0].priceCents = 12345; data.projects[0].brief = '用户改过的需求';
    data.projects[8].title = '用户改过的项目名';
    const removed = data.files.find(file => file.projectId === 'project-2' && file.kind === 'image')!;
    data.files = data.files.filter(file => file !== removed);
    const edited = data.files.find(file => file.projectId === 'project-1' && file.kind === 'image')!;
    edited.name = '用户自命名.svg'; edited.relPath = `${data.projects[0].folder}/交付成品/${edited.name}`; edited.path = `D:/客户工作台/${edited.relPath}`;
    const changedContent = data.files.find(file => file.projectId === 'project-3' && file.kind === 'image')!;
    changedContent.sizeBytes = 9999;
    const custom: FileEntry = { ...edited, name: '自建文件.svg', relPath: `${data.projects[8].folder}/自建文件.svg`, path: 'D:/客户工作台/自建文件.svg', projectId: 'project-9' };
    data.files.push(custom);
    const originalBusiness = JSON.stringify({ clients: data.clients, projects: data.projects, payments: data.payments, activities: data.activities, tags: data.tags });
    const originalEdited = JSON.stringify(edited); const originalCustom = JSON.stringify(custom); const originalChanged = JSON.stringify(changedContent);
    migrateMockAssets(data);
    expect(JSON.stringify({ clients: data.clients, projects: data.projects, payments: data.payments, activities: data.activities, tags: data.tags })).toBe(originalBusiness);
    expect(JSON.stringify(edited)).toBe(originalEdited); expect(JSON.stringify(custom)).toBe(originalCustom);
    expect(JSON.stringify(changedContent)).toBe(originalChanged);
    expect(data.files.some(file => file.projectId === 'project-2' && file.kind === 'image')).toBe(false);
    expect(data.files.some(file => file.projectId === 'project-9' && file.ext === 'webp')).toBe(false);
    expect(data.files.filter(file => file.ext === 'webp').length).toBeGreaterThanOrEqual(18);
    expect(data.fileAssets).toBeTruthy(); expect(data.assetVersion).toBe(1);
    const migrated = JSON.stringify(data); migrateMockAssets(data); expect(JSON.stringify(data)).toBe(migrated);
  });

  it('标准旧种子升级到约六成封面，碰到用户同名WebP不覆盖', () => {
    const data = legacySeed();
    const source = data.files.find(file => file.name.endsWith('方案.svg'))!;
    const collision = { ...source, ext: 'webp', name: source.name.replace(/svg$/, 'webp'), path: source.path.replace(/svg$/, 'webp'), relPath: source.relPath.replace(/svg$/, 'webp') };
    data.files.push(collision); const preserved = JSON.stringify(collision);
    migrateMockAssets(data);
    expect(JSON.stringify(collision)).toBe(preserved);
    expect(data.files.some(file => file.name.includes('方案 (2).webp'))).toBe(true);
    expect(new Set(data.files.filter(file => file.ext === 'webp').map(file => file.projectId)).size).toBe(20);
  });

  it('从原v1 localStorage载入时自动升级图片并保存，保留客户项目收款', async () => {
    const old = legacySeed(); localStorage.setItem(storageKey, JSON.stringify(old));
    vi.resetModules(); const reloaded = await import('./store');
    const loaded = reloaded.state();
    expect(loaded.clients).toEqual(old.clients); expect(loaded.projects).toEqual(old.projects); expect(loaded.payments).toEqual(old.payments);
    expect(loaded.files.filter(file => file.ext === 'webp')).toHaveLength(20);
    reloaded.persist();
    const saved = JSON.parse(localStorage.getItem(storageKey)!) as ReturnType<typeof state>;
    expect(saved.assetVersion).toBe(1); expect(saved.fileAssets).toEqual(loaded.fileAssets);
  });
});
