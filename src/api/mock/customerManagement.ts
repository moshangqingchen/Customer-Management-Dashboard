import type { CustomerManagementApi, CustomerManagementState, ClientMergePreview } from '../customerManagement';
import { mergeClientProfile } from '../../lib/clientMerge';
import { activity, clientRecord, clientValue, clone, fail, now, operation, state } from './store';

function ensureNotMerged(clientId: string) {
  if (state().customerManagement?.some(item => item.clientId === clientId && item.mergedInto)) fail('alreadyMerged', '该客户已合并，不能再次操作或从回收站恢复');
}
function management(clientId: string): CustomerManagementState {
  const records = state().customerManagement ??= [];
  let record = records.find(item => item.clientId === clientId);
  if (!record) { record = { clientId, archivedAt: null, mergedInto: null }; records.push(record); }
  return record;
}
function preview(sourceId: string, targetId: string): ClientMergePreview {
  if (sourceId === targetId) fail('invalid', '请选择另一位客户作为合并目标');
  ensureNotMerged(sourceId); ensureNotMerged(targetId);
  const source = clientValue(clientRecord(sourceId)); const target = clientValue(clientRecord(targetId));
  const profile = mergeClientProfile(source, target);
  const projects = state().projects.filter(project => project.clientId === sourceId);
  const projectIds = new Set(projects.map(project => project.id));
  const folders = [...new Set([...(source.folder ? [source.folder] : []), ...(state().clientFolderAliases ?? []).filter(alias => alias.clientId === sourceId).map(alias => alias.folder)])].sort();
  const value = {
    source, target, projectCount: projects.length, deletedProjectCount: projects.filter(project => project.deletedAt).length,
    paymentCount: state().payments.filter(payment => projectIds.has(payment.projectId)).length,
    activityCount: state().activities.filter(item => item.clientId === sourceId).length,
    followUpCount: (state().followUps ?? []).filter(item => item.clientId === sourceId).length,
    folders, conflicts: profile.conflicts, addedAccounts: profile.accounts.length - target.accounts.length,
    tagCount: profile.tagIds.length, mergedNotes: profile.notes,
  };
  return { ...value, previewToken: JSON.stringify(value) };
}

export const mockCustomerManagement: CustomerManagementApi = {
  states: operation(() => state().customerManagement ?? []),
  setArchived: operation((clientId, archived) => {
    ensureNotMerged(clientId); clientRecord(clientId);
    const record = management(clientId); const previous = record.archivedAt;
    record.archivedAt = archived ? record.archivedAt ?? now() : null;
    if (previous !== record.archivedAt) activity(clientId, null, 'status', archived ? '已归档客户，项目、收款与文件继续保留' : '已恢复客户到常用列表', { entity: 'customerManagement', event: archived ? 'customerArchived' : 'customerRestored' });
    return record;
  }),
  previewMerge: operation(preview),
  merge: operation(input => {
    const current = preview(input.sourceId, input.targetId);
    if (current.previewToken !== input.previewToken) fail('mergePreviewChanged', '客户资料已变化，请重新查看合并预览后确认');
    const source = clientRecord(input.sourceId); const target = clientRecord(input.targetId);
    const profile = mergeClientProfile(current.source, current.target); const timestamp = now();
    (state().clientMergeHistory ??= []).push({ sourceClient: clone(current.source), previousTarget: clone(current.target), targetClientId: target.id, mergedAt: timestamp });
    Object.assign(target, profile.filled, { accounts: profile.accounts, notes: profile.notes, tagIds: profile.tagIds, rating: target.rating || source.rating, pinned: target.pinned || source.pinned, updatedAt: timestamp });
    source.tagIds = [];
    state().projects.filter(project => project.clientId === source.id).forEach(project => { project.clientId = target.id; project.clientName = target.name; project.updatedAt = timestamp; });
    state().activities.filter(item => item.clientId === source.id).forEach(item => { item.clientId = target.id; item.clientName = target.name; });
    (state().followUps ?? []).filter(item => item.clientId === source.id).forEach(item => { item.clientId = target.id; item.clientName = target.name; });
    state().files.filter(file => file.clientId === source.id).forEach(file => { file.clientId = target.id; });
    (state().trashedFiles ?? []).filter(file => file.clientId === source.id).forEach(file => { file.clientId = target.id; });
    (state().fileVersions ?? []).filter(version => version.clientId === source.id).forEach(version => { version.clientId = target.id; version.file.clientId = target.id; });
    (state().fileRecycle ?? []).filter(entry => entry.clientId === source.id).forEach(entry => { entry.clientId = target.id; entry.file.clientId = target.id; });
    const aliases = state().clientFolderAliases ??= [];
    for (const folder of current.folders) {
      const alias = aliases.find(item => item.folder.replace(/\\/g, '/').toLowerCase() === folder.replace(/\\/g, '/').toLowerCase());
      if (alias && alias.clientId !== source.id && alias.clientId !== target.id) fail('folderOwnershipChanged', '客户目录归属已改变，请重新核对后合并');
      if (alias) alias.clientId = target.id;
      else aliases.push({ folder, clientId: target.id, sourceName: source.name });
    }
    aliases.filter(alias => alias.clientId === source.id).forEach(alias => { alias.clientId = target.id; });
    management(source.id).mergedInto = target.id;
    state().customerManagement?.filter(item => item.mergedInto === source.id).forEach(item => { item.mergedInto = target.id; });
    source.deletedAt = timestamp; source.updatedAt = timestamp;
    activity(target.id, null, 'status', `合并了客户「${source.name}」：${current.projectCount} 个项目、${current.paymentCount} 笔收款，文件保留原位置`, { entity: 'customerManagement', event: 'customerMerged', sourceId: source.id, sourceName: source.name });
    return clientValue(target);
  }),
};
