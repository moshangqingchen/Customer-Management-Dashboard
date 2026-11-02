import { describe, expect, it, vi } from 'vitest';
import { tauriApi as api } from './tauri';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
const cases: [string, Record<string, unknown> | undefined, () => Promise<unknown>][] = [
  ['app_info', undefined, () => api.app.info()],
  ['save_text_file', { defaultName: '收款.csv', content: '日期,金额' }, () => api.app.saveTextFile('收款.csv', '日期,金额')],
  ['library_status', undefined, () => api.library.status()],
  ['library_set_root', { path: 'D:/文件库' }, () => api.library.setRoot('D:/文件库')],
  ['library_open_root', undefined, () => api.library.openRoot()],
  ['pick_folder', { title: '文件库位置' }, () => api.library.pickFolder('文件库位置')],
  ['clients_list', undefined, () => api.clients.list()],
  ['client_get', { id: 'c' }, () => api.clients.get('c')],
  ['client_create', { input: { name: '林女士' } }, () => api.clients.create({ name: '林女士' })],
  ['client_update', { id: 'c', patch: { pinned: true } }, () => api.clients.update('c', { pinned: true })],
  ['client_delete', { id: 'c' }, () => api.clients.delete('c')],
  ['client_set_tags', { clientId: 'c', tagIds: ['t'] }, () => api.clients.setTags('c', ['t'])],
  ['projects_list', undefined, () => api.projects.list()],
  ['project_get', { id: 'p' }, () => api.projects.get('p')],
  ['project_create', { input: { clientId: 'c', title: '海报' } }, () => api.projects.create({ clientId: 'c', title: '海报' })],
  ['project_update', { id: 'p', patch: { title: '新海报' } }, () => api.projects.update('p', { title: '新海报' })],
  ['project_set_status', { id: 'p', status: 'review' }, () => api.projects.setStatus('p', 'review')],
  ['project_duplicate', { id: 'p' }, () => api.projects.duplicate('p')],
  ['project_delete', { id: 'p' }, () => api.projects.delete('p')],
  ['project_set_tags', { projectId: 'p', tagIds: ['t'] }, () => api.projects.setTags('p', ['t'])],
  ['payments_list', { projectId: 'p' }, () => api.payments.list('p')],
  ['payments_all', undefined, () => api.payments.all()],
  ['payment_add', { input: { projectId: 'p', amountCents: 10000, paidAt: '2026-11-02' } }, () => api.payments.add({ projectId: 'p', amountCents: 10000, paidAt: '2026-11-02' })],
  ['payment_update', { id: 'pay', patch: { note: '尾款' } }, () => api.payments.update('pay', { note: '尾款' })],
  ['payment_delete', { id: 'pay' }, () => api.payments.delete('pay')],
  ['tags_list', undefined, () => api.tags.list()],
  ['tag_create', { name: '餐饮', color: 'orange' }, () => api.tags.create('餐饮', 'orange')],
  ['tag_update', { id: 't', patch: { color: 'blue' } }, () => api.tags.update('t', { color: 'blue' })],
  ['tag_delete', { id: 't' }, () => api.tags.delete('t')],
  ['tag_merge', { sourceId: 's', targetId: 't' }, () => api.tags.merge('s', 't')],
  ['activities_list', { clientId: 'c', projectId: 'p', limit: 10 }, () => api.activities.list({ clientId: 'c', projectId: 'p', limit: 10 })],
  ['activities_recent', { limit: 10 }, () => api.activities.recent(10)],
  ['activity_add_note', { clientId: 'c', projectId: 'p', body: '已沟通' }, () => api.activities.addNote({ clientId: 'c', projectId: 'p', body: '已沟通' })],
  ['activity_update_note', { id: 'a', body: '新备注' }, () => api.activities.updateNote('a', '新备注')],
  ['activity_delete', { id: 'a' }, () => api.activities.delete('a')],
  ['files_list', { target: { projectId: 'p' }, includeProjects: true }, () => api.files.list({ projectId: 'p' }, true)],
  ['files_recent', { limit: 30 }, () => api.files.recent(30)],
  ['files_add', { target: { projectId: 'p' }, sourcePaths: ['C:/a.psd'], subfolder: '过程稿' }, () => api.files.add({ projectId: 'p' }, ['C:/a.psd'], '过程稿')],
  ['files_pick_and_add', { target: { clientId: 'c' }, subfolder: '资料' }, () => api.files.pickAndAdd({ clientId: 'c' }, '资料')],
  ['file_open', { path: 'D:/文件库/a.psd' }, () => api.files.open('D:/文件库/a.psd')],
  ['file_reveal', { path: 'D:/文件库/a.psd' }, () => api.files.reveal('D:/文件库/a.psd')],
  ['file_rename', { path: 'D:/文件库/a.psd', newName: 'b.psd' }, () => api.files.rename('D:/文件库/a.psd', 'b.psd')],
  ['file_trash', { path: 'D:/文件库/a.psd' }, () => api.files.trash('D:/文件库/a.psd')],
  ['folder_open', { target: { projectId: 'p' } }, () => api.files.openFolder({ projectId: 'p' })],
  ['snippet_groups_list', undefined, () => api.snippetGroups.list()],
  ['snippet_group_create', { name: '交付' }, () => api.snippetGroups.create('交付')],
  ['snippet_group_update', { id: 'g', patch: { sort: 2 } }, () => api.snippetGroups.update('g', { sort: 2 })],
  ['snippet_group_delete', { id: 'g' }, () => api.snippetGroups.delete('g')],
  ['snippets_list', undefined, () => api.snippets.list()],
  ['snippet_create', { input: { groupId: 'g', title: '问候', body: '您好' } }, () => api.snippets.create({ groupId: 'g', title: '问候', body: '您好' })],
  ['snippet_update', { id: 's', patch: { body: '谢谢' } }, () => api.snippets.update('s', { body: '谢谢' })],
  ['snippet_delete', { id: 's' }, () => api.snippets.delete('s')],
  ['snippet_mark_used', { id: 's' }, () => api.snippets.markUsed('s')],
  ['settings_get', undefined, () => api.settings.get()],
  ['settings_update', { patch: { theme: 'dark' } }, () => api.settings.update({ theme: 'dark' })],
  ['backups_list', undefined, () => api.backups.list()],
  ['backup_create', undefined, () => api.backups.create()],
  ['backup_restore', { fileName: 'backup.db' }, () => api.backups.restore('backup.db')],
  ['trash_list', undefined, () => api.trash.list()],
  ['trash_restore', { type: 'client', id: 'c' }, () => api.trash.restore('client', 'c')],
  ['trash_purge', { type: 'project', id: 'p' }, () => api.trash.purge('project', 'p')],
];
describe('Tauri 接口契约', () => {
  it('项目封面路径按后端原值返回，缺少图片时保留 null', async () => {
    vi.mocked(invoke).mockResolvedValueOnce({ id: 'p', coverPath: 'D:/文件库/终稿.png' });
    expect((await api.projects.get('p')).coverPath).toBe('D:/文件库/终稿.png');
    vi.mocked(invoke).mockResolvedValueOnce([{ id: 'p', coverPath: null }]);
    expect((await api.projects.list())[0].coverPath).toBeNull();
  });
  it.each(cases)('%s 的命令名与 camelCase 参数不漂移', async (command, args, call) => {
    vi.mocked(invoke).mockClear(); await call();
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith(...args === undefined ? [command] : [command, args]);
  });
});
