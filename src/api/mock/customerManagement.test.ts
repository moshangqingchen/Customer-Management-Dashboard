import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { mockApi } from './index';
import { addBrowserFiles } from './files';
import { clone, reset, state } from './store';
import { filterArchivedClients } from '../../lib/clientArchive';

beforeEach(async () => { reset(); await mockApi.library.setRoot('D:/客户工作台'); });
afterEach(() => vi.restoreAllMocks());
async function merge(sourceId: string, targetId: string) {
  const preview = await mockApi.customerManagement.previewMerge(sourceId, targetId);
  return mockApi.customerManagement.merge({ sourceId, targetId, previewToken: preview.previewToken });
}

describe('客户归档与合并', () => {
  it('归档只改变常用客户范围，项目、收入与待收保持原值并能恢复', async () => {
    const customer = await mockApi.clients.create({ name: '归档验收' });
    const project = await mockApi.projects.create({ clientId: customer.id, title: '进行中', priceCents: 10000 });
    await mockApi.payments.add({ projectId: project.id, amountCents: 3000, paidAt: '2026-11-01' });
    const before = await mockApi.clients.get(customer.id);
    await mockApi.customerManagement.setArchived(customer.id, true);
    const archived = await mockApi.clients.get(customer.id);
    expect(archived).toMatchObject({ projectCount: before.projectCount, receivedCents: before.receivedCents, outstandingCents: before.outstandingCents });
    const clients = await mockApi.clients.list(); const statuses = await mockApi.customerManagement.states();
    expect(filterArchivedClients(clients, statuses, 'current').some(item => item.id === customer.id)).toBe(false);
    expect(filterArchivedClients(clients, statuses, 'archived').map(item => item.id)).toEqual([customer.id]);
    expect(filterArchivedClients(clients, statuses, 'all').some(item => item.id === customer.id)).toBe(true);
    expect((await mockApi.trash.list()).some(item => item.id === customer.id)).toBe(false);
    expect((await mockApi.payments.all()).some(item => item.projectId === project.id)).toBe(true);
    await mockApi.customerManagement.setArchived(customer.id, false);
    expect(filterArchivedClients(await mockApi.clients.list(), await mockApi.customerManagement.states(), 'current').some(item => item.id === customer.id)).toBe(true);
    const events = (await mockApi.activities.list({ clientId: customer.id })).filter(item => item.meta.entity === 'customerManagement');
    expect(events).toHaveLength(2); expect(events.every(item => item.kind === 'status')).toBe(true);
  });

  it('合并目标资料优先，保留冲突、账号、标签和备注，含软删项目一起转移且收款不重复', async () => {
    const source = await mockApi.clients.create({ name: '旧名字', phone: '13800000001', email: 'source@leaf.cn', notes: '来源备注\n保留换行', accounts: [{ platform: '淘宝', handle: 'same' }, { platform: '闲鱼', handle: 'same' }] });
    const target = await mockApi.clients.create({ name: '保留名字', phone: '13800000002', notes: '目标备注', accounts: [{ platform: '淘宝', handle: 'same' }] });
    const tag = await mockApi.tags.create('合并测试标签', 'blue'); await mockApi.clients.setTags(source.id, [tag.id]);
    const active = await mockApi.projects.create({ clientId: source.id, title: '进行中', priceCents: 10000 });
    const deleted = await mockApi.projects.create({ clientId: source.id, title: '已删除', priceCents: 50000 });
    const own = await mockApi.projects.create({ clientId: target.id, title: '目标项目', priceCents: 20000 });
    for (const [projectId, amountCents] of [[active.id, 3000], [deleted.id, 2000], [own.id, 4000]] as const) await mockApi.payments.add({ projectId, amountCents, paidAt: '2026-11-01' });
    await mockApi.projects.delete(deleted.id);
    const follow = await mockApi.followUps.create({ clientId: source.id, projectId: active.id, title: '回访', dueAt: '2026-11-08T10:00:00Z' });
    const preview = await mockApi.customerManagement.previewMerge(source.id, target.id);
    expect(preview).toMatchObject({ projectCount: 2, deletedProjectCount: 1, paymentCount: 2, followUpCount: 1 });
    const merged = await merge(source.id, target.id);
    expect(merged).toMatchObject({ name: '保留名字', phone: '13800000002', email: 'source@leaf.cn', projectCount: 2, receivedCents: 7000, outstandingCents: 23000 });
    for (const text of ['目标备注', '13800000001', '来源备注\n保留换行']) expect(merged.notes).toContain(text);
    expect(merged.accounts).toHaveLength(2); expect(merged.tagIds).toContain(tag.id);
    expect(state().payments.filter(item => [active.id, deleted.id, own.id].includes(item.projectId))).toHaveLength(3);
    expect(state().projects.find(item => item.id === deleted.id)).toMatchObject({ clientId: target.id, deletedAt: expect.any(String) });
    expect((await mockApi.followUps.list({ clientId: target.id })).find(item => item.id === follow.id)?.clientId).toBe(target.id);
    expect(state().clientMergeHistory?.at(-1)?.sourceClient.phone).toBe('13800000001');
    expect((await mockApi.trash.list()).some(item => item.id === source.id)).toBe(false);
    await expect(mockApi.trash.restore('client', source.id)).rejects.toMatchObject({ code: 'alreadyMerged' });
    await expect(mockApi.customerManagement.merge({ sourceId: source.id, targetId: target.id, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'alreadyMerged' });
  });

  it('客户资料及项目文件保留原路径，历史版本与回收记录归属一起更新', async () => {
    const source = await mockApi.clients.create({ name: '原目录客户' }); const target = await mockApi.clients.create({ name: '目标目录客户' });
    const project = await mockApi.projects.create({ clientId: source.id, title: '原项目' });
    const docs = (await addBrowserFiles({ clientId: source.id }, [{ name: 'logo.png', size: 100 }])).added[0];
    const design = (await addBrowserFiles({ projectId: project.id }, [{ name: 'design.psd', size: 200 }])).added[0];
    await mockApi.fileHistory.save(design.path, '原客户版本');
    const trashed = (await addBrowserFiles({ clientId: source.id }, [{ name: 'old.txt', size: 50 }])).added[0];
    await mockApi.files.trash(trashed.path);
    await merge(source.id, target.id);
    const files = (await mockApi.files.list({ clientId: target.id }, true)).files;
    expect(files.map(file => file.path).sort()).toEqual([docs.path,design.path].sort());
    expect(files.every(file => file.clientId === target.id)).toBe(true);
    expect(state().clientFolderAliases?.find(item => item.clientId === target.id)?.folder).toBe('原目录客户');
    expect((await mockApi.fileHistory.list(design.path))[0].clientId).toBe(target.id);
    expect((await mockApi.fileHistory.trashList()).find(item => item.originalPath === trashed.path)?.clientId).toBe(target.id);
  });

  it('预览后资料改变会拒绝旧确认，不能部分转移', async () => {
    const source = await mockApi.clients.create({ name: '预览来源' }); const target = await mockApi.clients.create({ name: '预览目标' });
    const preview = await mockApi.customerManagement.previewMerge(source.id, target.id);
    await mockApi.clients.update(target.id, { phone: '13900000000' });
    const before = clone(state());
    await expect(mockApi.customerManagement.merge({ sourceId: source.id, targetId: target.id, previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'mergePreviewChanged' });
    expect(state()).toEqual(before);
  });

  it('保存失败回滚所有内存变更，客户、项目、动态和审计记录保持完整', async () => {
    const source = await mockApi.clients.create({ name: '失败来源' }); const target = await mockApi.clients.create({ name: '失败目标' });
    await mockApi.projects.create({ clientId: source.id, title: '应保留归属' });
    const preview = await mockApi.customerManagement.previewMerge(source.id, target.id); const before = clone(state());
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('磁盘已满'); });
    await expect(mockApi.customerManagement.merge({ sourceId: source.id,targetId: target.id,previewToken: preview.previewToken })).rejects.toMatchObject({ code: 'storageFailed' });
    expect(state()).toEqual(before);
  });
});
