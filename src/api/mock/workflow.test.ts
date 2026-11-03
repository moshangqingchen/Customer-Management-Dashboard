import { beforeEach, describe, expect, it } from 'vitest';
import { addBrowserFiles, mockApi } from './index';
import { reset, state } from './store';
import { createSeed } from './seed';
import { designImageForPath } from './designAssets';

beforeEach(async () => { reset(); await mockApi.library.setRoot('D:/客户工作台'); });

describe('设计师工作流 Mock', () => {
  it('PSD/AI 返回真实示例，其他类型回退，并记录缩略图请求', async () => {
    const files = await mockApi.files.recent(100);
    for (const file of files) {
      const preview = await mockApi.files.thumbnail(file.path, 256);
      expect(preview).toBe(['psd', 'ai'].includes(file.ext) ? designImageForPath(file.path) : null);
    }
    expect(state().workflowOperations?.filter(value => value.command === 'file_thumbnail')).toHaveLength(files.length);
    await expect(mockApi.files.thumbnail('C:/外部.psd', 256)).rejects.toMatchObject({ code: 'outsideLibrary' });
  });

  it('复制后粘贴多个文件保留大小、子目录、自动编号和自动动态', async () => {
    const original = (await mockApi.files.recent(2));
    const client = await mockApi.clients.create({ name: '剪贴板客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '剪贴板项目' });
    await mockApi.files.copyToClipboard(original.map(file => file.path));
    const first = await mockApi.files.paste({ projectId: project.id }, '参考资料');
    const second = await mockApi.files.paste({ projectId: project.id }, '参考资料');
    expect(first.added.map(file => file.sizeBytes)).toEqual(original.map(file => file.sizeBytes));
    expect(first.added.every(file => file.folderGroup === '参考资料' && file.projectId === project.id)).toBe(true);
    expect(second.added.every(file => file.name.includes(' (2).'))).toBe(true);
    expect((await mockApi.activities.list({ projectId: project.id })).filter(event => event.kind === 'file')).toHaveLength(2);
    expect(state().workflowOperations?.map(value => value.command)).toEqual(['files_copy_to_clipboard', 'files_paste', 'files_paste']);
    await expect(mockApi.files.copyToClipboard([original[0].path, 'C:/外部.txt'])).rejects.toMatchObject({ code: 'outsideLibrary' });
    expect(state().clipboard).toMatchObject({ kind: 'files' });
  });

  it('默认模拟截图粘贴为PNG；空剪贴板保留中文错误且不产生记录', async () => {
    const client = (await mockApi.clients.list())[0];
    const result = await mockApi.files.paste({ clientId: client.id });
    expect(result.added[0].name).toMatch(/^粘贴图片 \d{8}-\d{6}\.png$/);
    expect(result.added[0]).toMatchObject({ kind: 'image', projectId: null, clientId: client.id });
    state().clipboard = { kind: 'empty' };
    const count = state().files.length;
    await expect(mockApi.files.paste({ clientId: client.id })).rejects.toMatchObject({ code: 'clipboardEmpty', message: '剪贴板里没有文件或图片' });
    expect(state().files).toHaveLength(count);
  });

  it('图片优先于更新的源文件，无图片时选最新设计文件，删除后回退PDF', async () => {
    const client = await mockApi.clients.create({ name: '封面客户' });
    const project = await mockApi.projects.create({ clientId: client.id, title: '设计封面' });
    const result = await addBrowserFiles({ projectId: project.id }, [{ name: '方案.pdf', size: 100 }, { name: '源稿.ai', size: 200 }, { name: '图片.bmp', size: 35 * 1024 ** 2 }]);
    result.added.forEach((file, index) => { state().files.find(value => value.path === file.path)!.modifiedAt = `2030-03-0${3 - index}T12:00:00Z`; });
    expect((await mockApi.projects.get(project.id)).coverPath).toBe(result.added[2].path);
    await mockApi.files.trash(result.added[2].path);
    expect((await mockApi.projects.get(project.id)).coverPath).toBe(result.added[0].path);
    await mockApi.files.trash(result.added[0].path);
    expect((await mockApi.projects.get(project.id)).coverPath).toBe(result.added[1].path);
  });

  it.each(['2030-01-01', '2030-11-02', '2032-02-29'])('月初也有多笔当月收款和粘贴动态：%s', base => {
    const seed = createSeed(base);
    const current = seed.payments.filter(payment => payment.kind === 'income' && payment.paidAt.startsWith(base.slice(0, 7)));
    expect(current.length).toBeGreaterThanOrEqual(3);
    expect(current.reduce((sum, value) => sum + value.amountCents, 0)).toBeGreaterThan(300000);
    expect(seed.activities.some(value => value.kind === 'file' && value.meta.source === 'clipboard')).toBe(true);
  });
});
