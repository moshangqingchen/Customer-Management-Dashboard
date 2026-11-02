import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockApi as api, addBrowserFiles, thumbnail } from './index';
import { reset, state, storageKey } from './store';
import { createSeed } from './seed';
import { toApiError } from '../error';
import { today, dateOffset, dayDifference, isOpen, weekEnd, weekStart } from '../../lib/dates';
import { sanitize } from './files';
import { designAssetId, designImageForPath } from './designAssets';
import * as designAssets from './designAssets';

vi.mock('sonner', () => ({ toast: { info: vi.fn() } }));
beforeEach(() => { reset(); });
async function emptyProject() {
  const client = await api.clients.create({ name: '测试客户' });
  const project = await api.projects.create({ clientId: client.id, title: '测试项目', priceCents: 10000, costCents: 1000 });
  return { client, project };
}
describe('浏览器 Mock 种子与持久化', () => {
  it('包含完整的真实感样例，所有日期相对注入今天', () => {
    const seed = createSeed('2030-03-15');
    expect(seed.clients).toHaveLength(14); expect(seed.projects).toHaveLength(32); expect(seed.payments).toHaveLength(40);
    expect(seed.tags).toHaveLength(10); expect(seed.activities.length).toBeGreaterThanOrEqual(60); expect(seed.groups).toHaveLength(3); expect(seed.snippets).toHaveLength(12);
    expect(new Set(seed.projects.map(project => project.status)).size).toBe(6);
    expect(seed.projects.filter(project => !['done', 'cancelled'].includes(project.status) && project.dueDate && project.dueDate < '2030-03-15')).toHaveLength(3);
    expect(seed.projects.filter(project => project.dueDate === '2030-03-16')).toHaveLength(2);
    expect(seed.payments.filter(payment => payment.kind === 'refund')).toHaveLength(2);
    expect(new Set(seed.payments.map(payment => payment.paidAt.slice(0, 7))).size).toBe(12);
    expect(seed.files.filter(file => file.kind === 'image')).toHaveLength(20);
  });
  it('首次启动未设文件库；选择位置会持久化并重新映射文件路径', async () => {
    expect((await api.library.status()).state).toBe('notConfigured');
    expect(await api.library.pickFolder()).toBe('D:\\客户工作台');
    await api.library.setRoot('E:\\设计文件库');
    expect((await api.library.status()).root).toBe('E:/设计文件库');
    expect((await api.files.recent(1))[0].path.startsWith('E:/设计文件库/')).toBe(true);
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? '{}') as { libraryRoot: string };
    expect(saved.libraryRoot).toBe('E:/设计文件库');
  });
  it.each(['2030-03-15', '2030-03-17', '2032-02-29'])('自然截止日与更新时间可复现并保留本周样例：%s', base => {
    const seed = createSeed(base);
    expect(createSeed(base).projects).toEqual(seed.projects);
    const dates = seed.projects.flatMap(project => project.dueDate ? [project.dueDate] : []);
    expect(dates.every(date => dayDifference(date, base) >= -60 && dayDifference(date, base) <= 30)).toBe(true);
    expect(new Set(dates.map(date => date.slice(-2))).size).toBeGreaterThan(12);
    expect(seed.projects.some(project => isOpen(project.status) && project.dueDate && project.dueDate >= weekStart(base) && project.dueDate <= weekEnd(base))).toBe(true);
    expect(seed.projects.every(project => project.updatedAt >= project.createdAt && project.updatedAt.slice(0, 10) <= base)).toBe(true);
    expect(seed.projects.every(project => !project.completedAt || project.completedAt >= project.createdAt.slice(0, 10))).toBe(true);
  });
  it('返回数据是副本，调用方不可绕过持久化修改内部数据', async () => {
    const records = await api.clients.list(); records[0].name = '外部修改'; records[0].accounts[0].handle = '外部修改';
    expect((await api.clients.get(records[0].id)).name).not.toBe('外部修改');
    expect((await api.clients.get(records[0].id)).accounts[0].handle).not.toBe('外部修改');
  });
  it('reset 可恢复种子', async () => {
    await api.clients.create({ name: '新增客户' }); window.__mock.reset(); expect(await api.clients.list()).toHaveLength(14);
  });
  it.each(['2030-01-01', '2030-03-02', '2032-02-29', '2030-12-31'])('月初与跨年种子不产生未来历史记录：%s', base => {
    const seed = createSeed(base);
    expect(seed.projects.every(project => project.createdAt.slice(0, 10) <= base)).toBe(true);
    expect(seed.projects.every(project => !project.completedAt || project.completedAt <= base)).toBe(true);
    expect(seed.payments.every(payment => payment.paidAt <= base)).toBe(true);
    expect(new Set(seed.payments.map(payment => payment.paidAt.slice(0, 7))).size).toBe(12);
    expect(seed.projects.filter(project => project.dueDate === dateOffset(1, base))).toHaveLength(2);
  });
  it('存储失败回滚内存；输入与返回对象均不会泄漏可写引用', async () => {
    const accounts = [{ platform: '微信', handle: '原账号' }];
    const record = await api.clients.create({ name: '客户', accounts }); accounts[0].handle = '外部改写';
    expect((await api.clients.get(record.id)).accounts[0].handle).toBe('原账号');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new DOMException('quota'); });
    await expect(api.clients.create({ name: '不能保存' })).rejects.toMatchObject({ code: 'storageFailed' }); write.mockRestore();
    expect(state().clients.some(value => value.name === '不能保存')).toBe(false);
  });
});
describe('项目、收款与派生数据', () => {
  it('创建项目写动态，状态时间戳遵循契约', async () => {
    const { project } = await emptyProject();
    expect((await api.activities.list({ projectId: project.id })).map(activity => activity.kind)).toEqual(['created']);
    const delivered = await api.projects.setStatus(project.id, 'delivered'); expect(delivered.deliveredAt).toBe(today());
    await api.projects.setStatus(project.id, 'done'); expect((await api.projects.get(project.id)).completedAt).toBe(today());
    await api.projects.setStatus(project.id, 'active'); expect((await api.projects.get(project.id)).completedAt).toBeNull();
    expect((await api.projects.get(project.id)).deliveredAt).toBe(today());
    const events = await api.activities.list({ projectId: project.id }); expect(events.filter(event => event.kind === 'status')).toHaveLength(3);
  });
  it('收款净额含退款，取消项目不产生待收，允许超收', async () => {
    const { client, project } = await emptyProject();
    const payment = await api.payments.add({ projectId: project.id, amountCents: 12000, paidAt: today(), method: '微信' });
    await api.payments.add({ projectId: project.id, kind: 'refund', amountCents: 3000, paidAt: today() });
    expect((await api.projects.get(project.id)).receivedCents).toBe(9000);
    expect((await api.clients.get(client.id)).outstandingCents).toBe(1000);
    await api.projects.setStatus(project.id, 'cancelled'); expect((await api.clients.get(client.id)).outstandingCents).toBe(0);
    await api.payments.delete(payment.id); expect((await api.projects.get(project.id)).receivedCents).toBe(-3000);
    expect((await api.activities.list({ projectId: project.id })).filter(event => event.kind === 'payment')).toHaveLength(3);
  });
  it('收款更新重新计算项目与客户统计，流水按日期降序', async () => {
    const { client, project } = await emptyProject();
    const payment = await api.payments.add({ projectId: project.id, amountCents: 2500, paidAt: dateOffset(-3) });
    await api.payments.add({ projectId: project.id, amountCents: 1500, paidAt: today() });
    await api.payments.update(payment.id, { amountCents: 5000 });
    expect((await api.clients.get(client.id)).receivedCents).toBe(6500);
    expect((await api.payments.list(project.id))[0].paidAt).toBe(today());
    expect((await api.payments.all()).find(row => row.id === payment.id)?.clientName).toBe('测试客户');
  });
  it('无效输入拒绝并回滚，金额为正整数分，日期需合法', async () => {
    const { project } = await emptyProject();
    for (const amountCents of [0, -1, 1.2]) await expect(api.payments.add({ projectId: project.id, amountCents, paidAt: today() })).rejects.toMatchObject({ code: 'invalidInput' });
    await expect(api.payments.add({ projectId: project.id, amountCents: 100, paidAt: '2030-02-30' })).rejects.toMatchObject({ code: 'invalidInput' });
    await expect(api.projects.update(project.id, { priceCents: -1 })).rejects.toMatchObject({ code: 'invalidInput' });
    expect((await api.projects.get(project.id)).priceCents).toBe(10000);
  });
  it('复制项目保留属性但重置状态、收款、文件与历史动态', async () => {
    const source = (await api.projects.list())[0]; const copy = await api.projects.duplicate(source.id);
    expect(copy.title).toBe(`${source.title}（副本）`); expect(copy.status).toBe('lead'); expect(copy.folder).toBeNull();
    expect(copy.receivedCents).toBe(0); expect(copy.fileCount).toBe(0); expect(copy.paymentCount).toBe(0);
    expect(copy.coverPath).toBeNull();
    expect(await api.activities.list({ projectId: copy.id })).toHaveLength(1);
    expect(copy.pinned).toBe(source.pinned);
  });
  it('直接创建已完成项目只写完成日期，不推断交付日期', async () => {
    const client = await api.clients.create({ name: '已完成客户' });
    const project = await api.projects.create({ clientId: client.id, title: '已完成项目', status: 'done' });
    expect(project.completedAt).toBe(today()); expect(project.deliveredAt).toBeNull();
  });
  it('收款方式默认使用上次选择，新增记忆；编辑不额外创建系统动态', async () => {
    const { project } = await emptyProject();
    const first = await api.payments.add({ projectId: project.id, amountCents: 100, paidAt: today() }); expect(first.method).toBe('微信');
    await api.payments.add({ projectId: project.id, amountCents: 100, paidAt: today(), method: '支付宝' });
    const next = await api.payments.add({ projectId: project.id, amountCents: 100, paidAt: today() }); expect(next.method).toBe('支付宝');
    expect((await api.settings.get()).lastPaymentMethod).toBe('支付宝');
    await api.payments.update(next.id, { amountCents: 200 });
    expect((await api.activities.list({ projectId: project.id })).filter(value => value.kind === 'payment')).toHaveLength(3);
  });
  it('最近合作取最新可见动态，有动态时编辑属性不改变排序时间', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2030-01-01T12:00:00Z')); const { client, project } = await emptyProject();
      vi.setSystemTime(new Date('2030-01-02T12:00:00Z'));
      await api.clients.update(client.id, { phone: '13800138000' }); await api.projects.update(project.id, { title: '新项目名' });
      expect((await api.clients.get(client.id)).lastActivityAt).toBe('2030-01-01T12:00:00.000Z');
      vi.setSystemTime(new Date('2030-01-03T12:00:00Z'));
      await api.activities.addNote({ clientId: client.id, projectId: project.id, body: '新动态' });
      expect((await api.clients.get(client.id)).lastActivityAt).toBe('2030-01-03T12:00:00.000Z');
      await api.projects.delete(project.id);
      expect((await api.clients.get(client.id)).lastActivityAt).toBe('2030-01-02T12:00:00.000Z');
    } finally { vi.useRealTimers(); }
  });
  it('项目转移客户时历史动态与文件归属一起切换', async () => {
    await api.library.setRoot('D:/客户工作台'); const { client, project } = await emptyProject();
    await addBrowserFiles({ projectId: project.id }, [{ name: '稿件.psd', size: 100 }]);
    const destination = await api.clients.create({ name: '接收客户' }); await api.projects.update(project.id, { clientId: destination.id });
    expect(await api.activities.list({ clientId: client.id })).toHaveLength(0);
    expect((await api.activities.list({ clientId: destination.id })).every(value => value.clientId === destination.id)).toBe(true);
    expect((await api.files.list({ clientId: destination.id }, true)).files[0].clientId).toBe(destination.id);
    expect((await api.clients.get(client.id)).projectCount).toBe(0);
  });
});
describe('软删除、恢复与彻底删除', () => {
  it('恢复客户只恢复随客户删除的项目，排除预先删除的项目', async () => {
    const { client, project } = await emptyProject();
    const independentlyDeleted = await api.projects.create({ clientId: client.id, title: '预先删除' }); await api.projects.delete(independentlyDeleted.id);
    await api.clients.delete(client.id);
    await expect(api.clients.get(client.id)).rejects.toMatchObject({ code: 'notFound' });
    expect((await api.projects.list()).some(value => value.id === project.id)).toBe(false);
    await api.trash.restore('client', client.id);
    expect((await api.projects.get(project.id)).id).toBe(project.id);
    await expect(api.projects.get(independentlyDeleted.id)).rejects.toMatchObject({ code: 'notFound' });
  });
  it('已删除项目的收款、动态从列表消失；彻底删除级联记录但保留文件', async () => {
    await api.library.setRoot('D:/客户工作台'); const { client, project } = await emptyProject();
    await api.payments.add({ projectId: project.id, amountCents: 100, paidAt: today() }); await addBrowserFiles({ projectId: project.id }, [{ name: '成品.svg', size: 100 }]);
    await api.clients.delete(client.id);
    expect((await api.payments.all()).some(payment => payment.projectId === project.id)).toBe(false);
    expect((await api.activities.recent(999)).some(event => event.projectId === project.id)).toBe(false);
    await expect(api.trash.restore('project', project.id)).rejects.toMatchObject({ code: 'clientDeleted' });
    await api.trash.purge('client', client.id);
    expect(state().payments.some(payment => payment.projectId === project.id)).toBe(false);
    expect(state().activities.some(event => event.clientId === client.id)).toBe(false);
    expect(state().files.some(file => file.projectId === project.id)).toBe(true);
  });
});
describe('标签、话术与动态', () => {
  it('标签合并去重并重新计算计数，名称忽略大小写唯一', async () => {
    const { client, project } = await emptyProject(); const source = await api.tags.create('AAA', 'red'); const target = await api.tags.create('BBB', 'blue');
    await expect(api.tags.create('aaa', 'green')).rejects.toMatchObject({ code: 'exists' });
    await api.clients.setTags(client.id, [source.id, target.id]); await api.projects.setTags(project.id, [source.id]);
    await api.tags.merge(source.id, target.id);
    expect((await api.clients.get(client.id)).tagIds).toEqual([target.id]); expect((await api.projects.get(project.id)).tagIds).toEqual([target.id]);
    expect((await api.tags.list()).find(tag => tag.id === target.id)).toMatchObject({ clientCount: 1, projectCount: 1 });
  });
  it('系统动态不可更改，客户维度包含其项目备注', async () => {
    const { client, project } = await emptyProject(); const system = (await api.activities.list({ projectId: project.id }))[0];
    await expect(api.activities.updateNote(system.id, '改动')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(api.activities.delete(system.id)).rejects.toMatchObject({ code: 'forbidden' });
    const note = await api.activities.addNote({ clientId: client.id, projectId: project.id, body: '备注' });
    await api.activities.updateNote(note.id, '新备注'); expect((await api.activities.list({ clientId: client.id })).some(event => event.body === '新备注')).toBe(true);
    await api.activities.delete(note.id); expect(await api.activities.list({ clientId: client.id })).toHaveLength(1);
  });
  it('分组删除级联话术，使用计数递增且保留换行', async () => {
    const group = await api.snippetGroups.create('新分组'); const snippet = await api.snippets.create({ groupId: group.id, title: '问候', body: '您好\n谢谢' });
    await api.snippets.markUsed(snippet.id); expect((await api.snippets.list()).find(value => value.id === snippet.id)).toMatchObject({ useCount: 1, body: '您好\n谢谢' });
    await api.snippetGroups.delete(group.id); expect((await api.snippets.list()).some(value => value.id === snippet.id)).toBe(false);
  });
});
describe('文件库与备份', () => {
  it('封面按最新合规图片派生，排除大图和不支持的格式，改名删除后刷新', async () => {
    await api.library.setRoot('D:/客户工作台'); const { project } = await emptyProject();
    const resolveCover = vi.spyOn(designAssets, 'designImageById').mockImplementation(assetId => `${assetId}?cover`);
    try {
    const files = (await addBrowserFiles({ projectId: project.id }, [
      { name: '旧稿.png', size: 100 }, { name: '新稿.JPG', size: 25 * 1024 * 1024 },
      { name: '大图.webp', size: 25 * 1024 * 1024 + 1 }, { name: '矢量.svg', size: 100 },
    ])).added;
    files.forEach((file, index) => { state().files.find(record => record.path === file.path)!.modifiedAt = `2030-03-0${index + 1}T12:00:00Z`; });
    const current = await api.projects.get(project.id);
    expect(current.fileCount).toBe(4);
    expect(current.coverPath).toBe(`${designAssetId(files[1].path)}?cover`);
    await api.files.rename(files[1].path, '不作封面.bmp');
    expect((await api.projects.get(project.id)).coverPath).toBe(`${designAssetId(files[0].path)}?cover`);
    await api.files.trash(files[0].path);
    expect((await api.projects.get(project.id)).coverPath).toBeNull();
    } finally { resolveCover.mockRestore(); }
  });
  it('约六成种子项目分配示例设计图片，素材未到时安全返回空封面', () => {
    const seed = createSeed('2030-03-15');
    const imageProjects = new Set(seed.files.filter(file => file.ext === 'webp').map(file => file.projectId));
    expect(imageProjects.size / seed.projects.length).toBeCloseTo(0.625);
    expect(seed.projects.every(project => project.coverPath === null || /\.webp(?:\?|$)/.test(project.coverPath))).toBe(true);
  });
  it('文件列表需要文件库；列表 folder 返回目标绝对路径', async () => {
    const { client, project } = await emptyProject();
    await expect(api.files.list({ projectId: project.id })).rejects.toMatchObject({ code: 'libraryNotConfigured' });
    await api.library.setRoot('D:/'); await api.files.openFolder({ projectId: project.id });
    expect((await api.files.list({ projectId: project.id })).folder).toMatch(/^D:\/测试客户\/\d{4}-\d{2} 测试项目$/);
    expect((await api.files.list({ clientId: client.id })).folder).toBe('D:/测试客户/_客户资料');
  });
  it('保留名、截断后的空格及 Unicode 字符按后端规则清理', () => {
    expect(sanitize('CON.txt')).toBe('CON_.txt'); expect(sanitize('.. \t')).toBe('_');
    expect(sanitize(`${'名'.repeat(79)} .后缀`)).toBe('名'.repeat(79));
    expect([...sanitize('😀'.repeat(90))]).toHaveLength(80);
  });
  it('文件夹惰性创建、文件重名自动编号、浏览器拖入保留大小', async () => {
    await api.library.setRoot('D:/客户工作台'); const { client, project } = await emptyProject();
    expect((await api.clients.get(client.id)).folder).toBeNull();
    const added = (await addBrowserFiles({ projectId: project.id }, [{ name: '设计.psd', size: 9123456 }, { name: '设计.psd', size: 50 }], '过程稿')).added;
    expect(added.map(file => file.name)).toEqual(['设计.psd', '设计 (2).psd']); expect(added[0].sizeBytes).toBe(9123456);
    expect((await api.projects.get(project.id)).fileCount).toBe(2); expect((await api.clients.get(client.id)).folder).toBe('测试客户');
    expect((await api.files.list({ clientId: client.id }, true)).files).toHaveLength(2);
    expect((await api.files.list({ clientId: client.id })).files).toHaveLength(0);
  });
  it('添加文件返回逐项失败，全部失败仍为正常结果，目标无效继续报错', async () => {
    await api.library.setRoot('D:/客户工作台'); const { project } = await emptyProject();
    const result = await addBrowserFiles({ projectId: project.id }, [{ name: '可用.png', size: 100 }, { name: '损坏.psd', size: -1 }]);
    expect(result.added.map(file => file.name)).toEqual(['可用.png']);
    expect(result.failed).toEqual([{ name: '损坏.psd', message: '文件大小无效' }]);
    const recent = (await api.activities.list({ projectId: project.id })).find(value => value.kind === 'file');
    expect(recent?.meta.failedNames).toEqual(['损坏.psd']);
    const failed = await api.files.add({ projectId: project.id }, ['relative.ai']);
    expect(failed.added).toEqual([]); expect(failed.failed).toEqual([{ name: 'relative.ai', message: '源文件位置必须是绝对路径' }]);
    await expect(api.files.add({ projectId: 'missing' }, ['D:/图.png'])).rejects.toMatchObject({ code: 'notFound' });
  });
  it('文件与子目录路径必须安全、重命名冲突报错', async () => {
    await api.library.setRoot('D:/客户工作台'); const { project } = await emptyProject();
    const files = (await addBrowserFiles({ projectId: project.id }, [{ name: '甲.png', size: 100 }, { name: '乙.png', size: 200 }])).added;
    await expect(api.files.open('C:/secret.txt')).rejects.toMatchObject({ code: 'outsideLibrary' });
    await expect(addBrowserFiles({ projectId: project.id }, [{ name: '丙.png', size: 100 }], '../外部')).rejects.toMatchObject({ code: 'outsideLibrary' });
    await expect(api.files.rename(files[0].path, '乙.png')).rejects.toMatchObject({ code: 'exists' });
    await expect(api.files.rename(files[0].path, '../丙.png')).rejects.toMatchObject({ code: 'invalidInput' });
    const renamed = await api.files.rename(files[0].path, '最终.png'); expect(renamed.name).toBe('最终.png');
    await api.files.trash(renamed.path); expect((await api.files.list({ projectId: project.id })).files).toHaveLength(1);
  });
  it('客户及项目重命名可同步文件夹与文件路径', async () => {
    await api.library.setRoot('D:/客户工作台'); const { client, project } = await emptyProject();
    const added = (await addBrowserFiles({ projectId: project.id }, [{ name: '稿件.svg', size: 100 }])).added;
    await api.clients.update(client.id, { name: '新客户名', renameFolder: true }); await api.projects.update(project.id, { title: '新项目名', renameFolder: true });
    const result = await api.files.list({ projectId: project.id }); expect(result.files[0].path).toContain('/新客户名/'); expect(result.files[0].path).toContain('新项目名/');
    expect(thumbnail(result.files[0].path)).toBe(designImageForPath(added[0].path) ?? '');
  });
  it('文件夹改名失败仍保存名称并返回 warning', async () => {
    const project = state().projects.find(value => value.folder)!; const oldFolder = project.folder;
    const result = await api.projects.update(project.id, { title: '已保存的新名称', renameFolder: true });
    expect(result.value.title).toBe('已保存的新名称'); expect(result.warning).toContain('folderRenameFailed');
    expect(result.value.folder).toBe(oldFolder);
  });
  it('设置子目录模板与收款方式拒绝非法名称、重名并回滚', async () => {
    await expect(api.settings.update({ subfolderTemplate: ['../外部'] })).rejects.toMatchObject({ code: 'invalidInput' });
    await expect(api.settings.update({ paymentMethods: ['微信', ' 微信 '] })).rejects.toMatchObject({ code: 'invalidInput' });
    expect((await api.settings.get()).subfolderTemplate).toEqual(['参考资料', '过程稿', '交付成品']);
    const names = ['成品']; await api.settings.update({ subfolderTemplate: names }); names[0] = '外部改写';
    expect((await api.settings.get()).subfolderTemplate).toEqual(['成品']);
  });
  it('恢复备份前自动保留当前快照', async () => {
    const before = await api.backups.create(); await api.clients.create({ name: '备份之后的客户' });
    await api.backups.restore(before.fileName); expect(await api.clients.list()).toHaveLength(14);
    const backups = await api.backups.list(); expect(backups.some(value => value.kind === 'beforeRestore')).toBe(true); expect(backups.some(value => value.kind === 'manual')).toBe(true);
  });
  it('错误保留后端 code，可解析 JSON 错误字符串', () => {
    expect(toApiError('{"code":"outsideLibrary","message":"路径无效"}')).toMatchObject({ code: 'outsideLibrary', message: '路径无效' });
    expect(toApiError(new Error('失败'))).toMatchObject({ code: 'unknown', message: '失败' });
  });
});
