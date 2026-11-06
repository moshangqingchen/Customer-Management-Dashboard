import type { FollowUp, FollowUpsApi } from '../followUps';
import { isValid, parseISO } from 'date-fns';
import { activity, clientRecord, fail, id, now, operation, projectRecord, required, state } from './store';

function timestamp(value: string): string {
  const parsed = parseISO(value);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !isValid(parsed)) fail('invalid', '请选择有效的跟进日期和时间');
  return parsed.toISOString();
}
const records = () => state().followUps ??= [];
function record(followUpId: string) {
  const value = records().find(item => item.id === followUpId) ?? fail('notFound', '跟进计划不存在');
  clientRecord(value.clientId);
  return value;
}
function relation(clientId: string, projectId: string | null) {
  clientRecord(clientId);
  if (projectId && projectRecord(projectId).clientId !== clientId) fail('invalid', '关联项目不属于这个客户');
}
function value(item: FollowUp): FollowUp {
  const project = item.projectId ? state().projects.find(entry => entry.id === item.projectId) : undefined;
  return { ...item, clientName: clientRecord(item.clientId).name, projectTitle: project?.title ?? null,
    projectAvailable: !item.projectId || !!project && !project.deletedAt && project.clientId === item.clientId };
}
function event(item: FollowUp, body: string) {
  // Follow-up state changes use the existing system-status activity category.
  activity(item.clientId, value(item).projectAvailable ? item.projectId : null, 'status', body, { entity: 'followUp', followUpId: item.id, status: item.status });
}
export const mockFollowUps: FollowUpsApi = {
  list: operation((filter = {}) => records().filter(item => state().clients.some(client => client.id === item.clientId && !client.deletedAt)
    && (!filter.clientId || item.clientId === filter.clientId) && (!filter.status || item.status === filter.status)).map(value).sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.id.localeCompare(b.id))),
  create: operation(input => {
    relation(input.clientId, input.projectId ?? null);
    const item: FollowUp = { id: id(), clientId: input.clientId, clientName: '', projectId: input.projectId ?? null, projectTitle: null, projectAvailable: true,
      title: required(input.title, '跟进主题'), dueAt: timestamp(input.dueAt), notes: input.notes?.trim() ?? '', status: 'pending', result: '', completedAt: null,
      revision: 1, remindedRevision: null, createdAt: now(), updatedAt: now() };
    records().push(item); event(item, `安排了客户跟进：${item.title}`); return value(item);
  }),
  update: operation((followUpId, patch) => {
    const item = record(followUpId);
    if (item.status !== 'pending') fail('invalid', '请先重新开启跟进，再修改计划');
    const projectId = patch.projectId === undefined ? item.projectId : patch.projectId;
    if (patch.projectId !== undefined) relation(item.clientId, projectId);
    const dueAt = patch.dueAt === undefined ? item.dueAt : timestamp(patch.dueAt);
    const rescheduled = dueAt !== item.dueAt;
    Object.assign(item, { title: patch.title === undefined ? item.title : required(patch.title, '跟进主题'), projectId, dueAt,
      notes: patch.notes === undefined ? item.notes : patch.notes.trim(), updatedAt: now() });
    if (rescheduled) { item.revision += 1; item.remindedRevision = null; event(item, `调整了跟进时间：${item.title}`); }
    return value(item);
  }),
  setStatus: operation((followUpId, status, result) => {
    const item = record(followUpId);
    if (!['pending', 'completed', 'cancelled'].includes(status)) fail('invalid', '跟进状态无效');
    if (status === item.status) return value(item);
    if (status === 'completed') { item.result = required(result ?? '', '跟进结果'); item.completedAt = now(); }
    if (status === 'pending') { item.revision += 1; item.remindedRevision = null; item.completedAt = null; }
    item.status = status; item.updatedAt = now();
    event(item, status === 'completed' ? `完成了客户跟进：${item.title}\n结果：${item.result}` : status === 'cancelled' ? `取消了客户跟进：${item.title}` : `重新开启了客户跟进：${item.title}`);
    return value(item);
  }),
  claimReminder: operation((followUpId, revision) => {
    const item = records().find(entry => entry.id === followUpId);
    if (!item || !state().clients.some(client => client.id === item.clientId && !client.deletedAt)) return false;
    if (item.status !== 'pending' || item.revision !== revision || item.remindedRevision === revision || !value(item).projectAvailable || Date.parse(item.dueAt) > Date.now()) return false;
    item.remindedRevision = revision;
    return true;
  }),
};
