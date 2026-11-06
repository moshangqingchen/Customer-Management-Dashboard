import type { ClientMergeConflict } from '../api/customerManagement';
import type { Client } from '../api/types';

const fields = [
  ['name', '原客户名称'], ['company', '公司 / 店铺'], ['phone', '电话'],
  ['wechat', '微信'], ['email', '邮箱'], ['address', '地址'],
] as const;
export function mergeClientProfile(source: Client, target: Client) {
  const conflicts: ClientMergeConflict[] = fields.flatMap(([field, label]) => source[field].trim() && target[field].trim() && source[field] !== target[field]
    ? [{ field, label, sourceValue: source[field], targetValue: target[field] }] : []);
  const accounts = target.accounts.map(account => ({ ...account }));
  for (const account of source.accounts) {
    if (!accounts.some(saved => saved.platform.trim().toLowerCase() === account.platform.trim().toLowerCase() && saved.handle.trim().toLowerCase() === account.handle.trim().toLowerCase())) accounts.push({ ...account });
  }
  const inherited = conflicts.map(conflict => `${conflict.label}：${conflict.sourceValue}`);
  if (source.rating !== target.rating) inherited.push(`原客户星级：${source.rating}`);
  if (source.notes.trim()) inherited.push(`原客户备注：\n${source.notes}`);
  const section = [`【合并自「${source.name}」】`, ...inherited].join('\n');
  const notes = target.notes.trim() ? `${target.notes}\n\n${section}` : section;
  const filled = Object.fromEntries(fields.filter(([field]) => field !== 'name').map(([field]) => [field, target[field].trim() ? target[field] : source[field]])) as Pick<Client, 'company' | 'phone' | 'wechat' | 'email' | 'address'>;
  return { conflicts, accounts, notes, filled, tagIds: [...new Set([...target.tagIds, ...source.tagIds])] };
}
