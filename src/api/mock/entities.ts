import type { Api } from '../client';
import type * as T from '../types';
import { toApiError } from '../error';
import { today } from '../../lib/dates';
import { activity, activeActivities, cents, checkTags, clientRecord, clientValue, date, fail, id, now, operation, persist, projectRecord, projectValue, rating, required, state, tagValue } from './store';
import { renameClientFolder, renameProjectFolder } from './files';

const newProject = (input: T.ProjectInput): T.Project => {
  const client = clientRecord(input.clientId);
  const title = required(input.title, '项目名称');
  cents(input.priceCents ?? 0); cents(input.costCents ?? 0); date(input.startDate); date(input.dueDate);
  const timestamp = now();
  const status = input.status ?? 'active';
  const value = { id: id(), clientId: client.id, clientName: client.name, title, status, pinned: input.pinned ?? false,
    brief: input.brief ?? '', sourcePlatform: input.sourcePlatform ?? '', sourceOrderNo: input.sourceOrderNo ?? '',
    startDate: input.startDate ?? null, dueDate: input.dueDate ?? null, deliveredAt: status === 'delivered' ? today() : null, completedAt: status === 'done' ? today() : null,
    priceCents: input.priceCents ?? 0, costCents: input.costCents ?? 0, tagIds: checkTags(input.tagIds ?? []), folder: null,
    createdAt: timestamp, updatedAt: timestamp, receivedCents: 0, paymentCount: 0, fileCount: 0, coverPath: null, deletedAt: null, deletedWithClient: false };
  state().projects.push(value);
  activity(client.id, value.id, 'created', '创建了项目');
  return projectValue(value);
};
export const clients: Api['clients'] = {
  list: operation(() => state().clients.filter(c => !c.deletedAt).map(clientValue)),
  get: operation(clientId => clientValue(clientRecord(clientId))),
  create: operation(input => {
    rating(input.rating);
    const timestamp = now();
    const value = { id: id(), name: required(input.name, '客户名称'), company: input.company ?? '', phone: input.phone ?? '', wechat: input.wechat ?? '',
      email: input.email ?? '', address: input.address ?? '', accounts: input.accounts?.map(account => ({ ...account })) ?? [], rating: input.rating ?? 0, pinned: input.pinned ?? false,
      notes: input.notes ?? '', folder: null, tagIds: checkTags(input.tagIds ?? []), createdAt: timestamp, updatedAt: timestamp, deletedAt: null,
      projectCount: 0, openProjectCount: 0, billedCents: 0, receivedCents: 0, outstandingCents: 0, firstProjectAt: null, lastActivityAt: timestamp };
    state().clients.push(value);
    return clientValue(value);
  }),
  update: operation((clientId, patch) => {
    const record = clientRecord(clientId); rating(patch.rating);
    const { renameFolder, ...changes } = patch;
    const name = patch.name === undefined ? record.name : required(patch.name, '客户名称');
    const renamed = name !== record.name;
    Object.assign(record, changes, { name, updatedAt: now() });
    if (patch.accounts) record.accounts = patch.accounts.map(account => ({ ...account }));
    let warning: string | null = null;
    if (renamed && renameFolder && record.folder) {
      try { renameClientFolder(record); } catch (error) { warning = `folderRenameFailed：客户资料已保存。${toApiError(error).message}`; }
    }
    return { value: clientValue(record), warning };
  }),
  delete: operation(clientId => {
    const record = clientRecord(clientId); record.deletedAt = now(); record.updatedAt = record.deletedAt;
    state().projects.filter(p => p.clientId === clientId && !p.deletedAt).forEach(p => { p.deletedAt = record.deletedAt; p.updatedAt = record.updatedAt; p.deletedWithClient = true; });
  }),
  setTags: operation((clientId, tagIds) => { const record = clientRecord(clientId); record.tagIds = checkTags(tagIds); record.updatedAt = now(); }),
};
export const projects: Api['projects'] = {
  list: operation(() => state().projects.filter(p => !p.deletedAt).map(projectValue)), get: operation(projectId => projectValue(projectRecord(projectId))),
  create: operation(newProject),
  update: operation((projectId, patch) => {
    const record = projectRecord(projectId);
    if (patch.clientId !== undefined) clientRecord(patch.clientId);
    if (patch.priceCents !== undefined) cents(patch.priceCents);
    if (patch.costCents !== undefined) cents(patch.costCents);
    date(patch.startDate); date(patch.dueDate);
    const { renameFolder, ...changes } = patch;
    const title = patch.title === undefined ? record.title : required(patch.title, '项目名称');
    const renamed = title !== record.title;
    if (patch.clientId !== undefined && patch.clientId !== record.clientId) {
      state().activities.filter(value => value.projectId === projectId).forEach(value => { value.clientId = patch.clientId!; });
      state().files.filter(value => value.projectId === projectId).forEach(value => { value.clientId = patch.clientId!; });
    }
    Object.assign(record, changes, { title, updatedAt: now() });
    let warning: string | null = null;
    if (renamed && renameFolder && record.folder) {
      try { renameProjectFolder(record); } catch (error) { warning = `folderRenameFailed：项目已保存。${toApiError(error).message}`; }
    }
    return { value: projectValue(record), warning };
  }),
  setStatus: operation((projectId, status) => {
    const record = projectRecord(projectId); const from = record.status;
    if (from !== status) {
      record.status = status; record.updatedAt = now();
      if (status === 'delivered' && !record.deliveredAt) record.deliveredAt = today();
      record.completedAt = status === 'done' ? today() : null;
      activity(record.clientId, record.id, 'status', '更新了项目状态', { from, to: status });
    }
    return projectValue(record);
  }),
  duplicate: operation(projectId => {
    const source = projectRecord(projectId);
    return newProject({ ...source, title: `${source.title}（副本）`, status: 'lead' });
  }),
  delete: operation(projectId => { const record = projectRecord(projectId); record.deletedAt = now(); record.updatedAt = record.deletedAt; record.deletedWithClient = false; }),
  setTags: operation((projectId, tagIds) => { const record = projectRecord(projectId); record.tagIds = checkTags(tagIds); record.updatedAt = now(); }),
};
function paymentRecord(paymentId: string) {
  const payment = state().payments.find(p => p.id === paymentId) ?? fail('notFound', '收款记录不存在');
  projectRecord(payment.projectId); return payment;
}
function paymentEvent(payment: T.Payment, body: string) {
  const project = projectRecord(payment.projectId); project.updatedAt = now();
  activity(project.clientId, project.id, 'payment', body, { kind: payment.kind, amountCents: payment.amountCents, method: payment.method });
}
function validatePayment(amount: number, paidAt: string) {
  cents(amount); if (amount <= 0) fail('invalidInput', '收款金额必须大于 0'); date(paidAt);
}
export const payments: Api['payments'] = {
  list: operation(projectId => { projectRecord(projectId); return state().payments.filter(p => p.projectId === projectId).sort((a, b) => b.paidAt.localeCompare(a.paidAt)); }),
  all: operation(() => state().payments.flatMap(payment => {
    const project = state().projects.find(p => p.id === payment.projectId && !p.deletedAt);
    if (!project) return [];
    return [{ ...payment, projectTitle: project.title, clientId: project.clientId, clientName: clientRecord(project.clientId).name }];
  }).sort((a, b) => b.paidAt.localeCompare(a.paidAt))),
  add: operation(input => {
    projectRecord(input.projectId); validatePayment(input.amountCents, input.paidAt);
    const method = input.method ?? state().settings.lastPaymentMethod;
    if (input.method) state().settings.lastPaymentMethod = input.method;
    const value: T.Payment = { id: id(), projectId: input.projectId, kind: input.kind ?? 'income', amountCents: input.amountCents, paidAt: input.paidAt, method, note: input.note ?? '', createdAt: now() };
    state().payments.push(value); paymentEvent(value, value.kind === 'refund' ? '记录了退款' : '记录了收款'); return value;
  }),
  update: operation((paymentId, patch) => {
    const record = paymentRecord(paymentId); validatePayment(patch.amountCents ?? record.amountCents, patch.paidAt ?? record.paidAt);
    Object.assign(record, patch); projectRecord(record.projectId).updatedAt = now(); return record;
  }),
  delete: operation(paymentId => { const record = paymentRecord(paymentId); paymentEvent(record, '删除了收款记录'); state().payments = state().payments.filter(p => p.id !== paymentId); }),
};
function tagRecord(tagId: string) { return state().tags.find(t => t.id === tagId) ?? fail('notFound', '标签不存在'); }
function uniqueTag(name: string, except?: string) {
  if (state().tags.some(t => t.id !== except && t.name.toLocaleLowerCase() === name.toLocaleLowerCase())) fail('exists', '已有同名标签');
}
function removeTag(tagId: string) {
  state().tags = state().tags.filter(t => t.id !== tagId);
  [...state().clients, ...state().projects].forEach(record => { record.tagIds = record.tagIds.filter(value => value !== tagId); });
}
export const tags: Api['tags'] = {
  list: operation(() => state().tags.map(tagValue).sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'))),
  create: operation((rawName, color) => { const name = required(rawName, '标签名称'); uniqueTag(name); const value = { id: id(), name, color, sort: state().tags.length, clientCount: 0, projectCount: 0 }; state().tags.push(value); return value; }),
  update: operation((tagId, patch) => { const record = tagRecord(tagId); const name = patch.name === undefined ? record.name : required(patch.name, '标签名称'); uniqueTag(name, tagId); Object.assign(record, patch, { name }); return tagValue(record); }),
  delete: operation(tagId => { tagRecord(tagId); removeTag(tagId); }),
  merge: operation((sourceId, targetId) => {
    if (sourceId === targetId) fail('invalidInput', '请选择另一个目标标签');
    tagRecord(sourceId); const target = tagRecord(targetId);
    [...state().clients, ...state().projects].forEach(record => { if (record.tagIds.includes(sourceId)) record.tagIds = [...new Set([...record.tagIds, targetId])]; });
    removeTag(sourceId); return tagValue(target);
  }),
};
function noteRecord(activityId: string) {
  const record = state().activities.find(a => a.id === activityId) ?? fail('notFound', '动态不存在');
  if (record.kind !== 'note') fail('forbidden', '系统动态不能编辑或删除');
  clientRecord(record.clientId); if (record.projectId) projectRecord(record.projectId); return record;
}
export const activities: Api['activities'] = {
  list: operation((filter = {}) => activeActivities().filter(a => (!filter.clientId || a.clientId === filter.clientId) && (!filter.projectId || a.projectId === filter.projectId)).slice(0, Math.max(0, filter.limit ?? Infinity))),
  recent: operation(limit => activeActivities().slice(0, Math.max(0, limit))),
  addNote: operation(input => { clientRecord(input.clientId); if (input.projectId && projectRecord(input.projectId).clientId !== input.clientId) fail('invalidInput', '项目不属于所选客户'); return activity(input.clientId, input.projectId ?? null, 'note', required(input.body, '备注')); }),
  updateNote: operation((activityId, body) => { const record = noteRecord(activityId); record.body = required(body, '备注'); return record; }),
  delete: operation(activityId => { noteRecord(activityId); state().activities = state().activities.filter(a => a.id !== activityId); }),
};

export const flush = persist;
