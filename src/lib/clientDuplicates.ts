import type { Client, ClientInput } from '../api/types';

export interface DuplicateClient { client: Client; reasons: string[] }
const normalized = (value?: string) => (value ?? '').normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const phoneKey = (value?: string) => normalized(value).replace(/[\s()（）-]/g, '');

/** Matches only explicit identifiers or an exact name; never merges clients automatically. */
export function findDuplicateClients(clients: readonly Client[], input: ClientInput): DuplicateClient[] {
  const name = normalized(input.name); const phone = phoneKey(input.phone);
  const wechat = normalized(input.wechat); const email = normalized(input.email);
  return clients.flatMap(client => {
    const reasons: string[] = [];
    if (phone && phone === phoneKey(client.phone)) reasons.push('电话相同');
    if (wechat && wechat === normalized(client.wechat)) reasons.push('微信相同');
    if (email && email === normalized(client.email)) reasons.push('邮箱相同');
    for (const account of input.accounts ?? []) {
      const platform = normalized(account.platform); const handle = normalized(account.handle);
      if (platform && handle && client.accounts.some(saved => normalized(saved.platform) === platform && normalized(saved.handle) === handle)) reasons.push(`${account.platform.trim()}账号相同`);
    }
    if (name && name === normalized(client.name)) reasons.push('名称相同');
    return reasons.length ? [{ client, reasons: [...new Set(reasons)] }] : [];
  }).sort((a, b) => Number(b.reasons.some(reason => reason !== '名称相同')) - Number(a.reasons.some(reason => reason !== '名称相同')) || a.client.name.localeCompare(b.client.name, 'zh-CN'));
}
