import { beforeEach, describe, expect, it } from 'vitest';
import { addBrowserFiles, mockApi as api } from './index';
import { reset, state } from './store';

beforeEach(async () => { reset(); await api.library.setRoot('D:/客户工作台'); });
async function fixture() {
  const client = await api.clients.create({ name: '文件历史测试客户' });
  const project = await api.projects.create({ clientId: client.id, title: '文件历史测试项目' });
  const result = await addBrowserFiles({ projectId: project.id }, [{ name: '旧稿.psd', size: 100 }, { name: '新稿.psd', size: 200 }]);
  return { client, project, first: result.added[0], second: result.added[1] };
}
describe('文件版本与回收 Mock', () => {
  it('上传保留旧版本；恢复先保留当前版本，快照预览保持原图身份', async () => {
    const { first, second } = await fixture();
    const originalImage = await api.files.thumbnail(first.path, 256);
    const saved = await api.fileHistory.save(first.path, ' 初稿 ');
    expect(saved.note).toBe('初稿');
    expect(await api.files.thumbnail(saved.snapshotPath, 256)).toBe(originalImage);
    expect((await api.fileHistory.replace(first.path, second.path)).sizeBytes).toBe(200);
    expect((await api.fileHistory.restore(saved.id)).sizeBytes).toBe(100);
    expect((await api.fileHistory.list(first.path)).map(version => version.sizeBytes)).toContain(200);
    expect(await api.files.thumbnail(first.path, 256)).toBe(originalImage);
    await expect(api.fileHistory.save(first.path, '稿'.repeat(2001))).rejects.toMatchObject({ code: 'invalid' });
    await expect(api.fileHistory.replace(first.path, first.path)).rejects.toMatchObject({ code: 'invalid' });
  });
  it('回收恢复遇到同名自动编号，归档仍可定位且不会再次显示', async () => {
    const { first, project } = await fixture();
    await api.files.trash(first.path);
    const [recycled] = await api.fileHistory.trashList();
    await addBrowserFiles({ projectId: project.id }, [{ name: first.name, size: 300 }]);
    const restored = await api.fileHistory.restoreTrash(recycled.id);
    expect(restored.name).toBe('旧稿 (2).psd');
    expect(restored.sizeBytes).toBe(100);
    expect((await api.files.list({ projectId: project.id })).files.find(file => file.name === first.name)?.sizeBytes).toBe(300);
    expect(await api.fileHistory.trashList()).toEqual([]);
    await expect(api.files.reveal(recycled.storedPath)).resolves.toBeUndefined();
  });
  it('未索引旧回收文件和版本跟随项目文件夹改名', async () => {
    const { first, project } = await fixture();
    const saved = await api.fileHistory.save(first.path, '改名前');
    const old = { ...first, relPath: `_回收站/${first.relPath}`, path: `D:/客户工作台/_回收站/${first.relPath}` };
    (state().trashedFiles ??= []).push(old);
    const renamed = await api.projects.update(project.id, { title: '改名项目', renameFolder: true });
    const versions = await api.fileHistory.list();
    expect(versions[0].id).toBe(saved.id);
    expect(versions[0].originalRelPath).toContain(renamed.value.folder);
    const [recycled] = await api.fileHistory.trashList();
    expect(recycled.legacy).toBe(true);
    expect(recycled.originalRelPath).toContain(renamed.value.folder);
    expect((await api.fileHistory.restoreTrash(recycled.id)).relPath).toContain(renamed.value.folder);
  });
  it('切换文件库后旧版本与回收记录不可操作', async () => {
    const { first } = await fixture();
    const version = await api.fileHistory.save(first.path);
    await api.files.trash(first.path);
    const [recycled] = await api.fileHistory.trashList();
    await api.library.setRoot('E:/另一个库');
    expect(await api.fileHistory.list()).toEqual([]);
    expect(await api.fileHistory.trashList()).toEqual([]);
    await expect(api.fileHistory.restore(version.id)).rejects.toMatchObject({ code: 'notFound' });
    await expect(api.fileHistory.restoreTrash(recycled.id)).rejects.toMatchObject({ code: 'notFound' });
  });
});
