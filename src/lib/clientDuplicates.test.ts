import { describe, expect, it } from 'vitest';
import type { Client } from '../api/types';
import { createSeed } from '../api/mock/seed';
import { findDuplicateClients } from './clientDuplicates';

const base = createSeed('2026-11-02').clients[0];
const client = (patch: Partial<Client> = {}): Client => ({ ...base, id: 'saved', name: '已有客户', phone: '', wechat: '', email: '', accounts: [], ...patch });

describe('客户重复提示', () => {
  it('空标识和只有分隔符的电话不会将未填写资料的客户判为重复', () => {
    const saved = client();
    expect(findDuplicateClients([saved], { name: '新客户' })).toEqual([]);
    expect(findDuplicateClients([saved], { name: ' ', phone: ' () - ', wechat: ' ', email: '', accounts: [{ platform: '', handle: '' }, { platform: '微信', handle: ' ' }] })).toEqual([]);
  });

  it('识别全半角、首尾空格、大小写和电话分隔符，返回具体原因', () => {
    const saved = client({ name: 'Leaf', phone: '(139) 0000-1111', wechat: 'Leaf_Studio', email: 'design@leaf.cn' });
    const matches = findDuplicateClients([saved], { name: ' ＬＥＡＦ ', phone: '１３９００００１１１１', wechat: ' leaf_studio ', email: 'DESIGN@LEAF.CN' });
    expect(matches).toEqual([{ client: saved, reasons: ['电话相同', '微信相同', '邮箱相同', '名称相同'] }]);
    expect(saved.name).toBe('Leaf');
  });

  it('平台账号必须在同一平台匹配，空平台和跨平台同账号不会误判', () => {
    const saved = client({ accounts: [{ platform: '淘宝', handle: 'leaf_shop' }] });
    expect(findDuplicateClients([saved], { name: '另一客户', accounts: [{ platform: '闲鱼', handle: 'leaf_shop' }, { platform: '', handle: 'leaf_shop' }] })).toEqual([]);
    expect(findDuplicateClients([saved], { name: '另一客户', accounts: [{ platform: ' 淘宝 ', handle: ' LEAF_SHOP ' }] })[0].reasons).toEqual(['淘宝账号相同']);
  });

  it('联系方式命中排在纯同名之前，每位客户和同一种原因只出现一次', () => {
    const sameName = client({ id: 'name-only', name: '同名工作室' });
    const sameAccount = client({ id: 'account-match', name: '其他名字', accounts: [{ platform: '淘宝', handle: 'leaf' }] });
    const matches = findDuplicateClients([sameName, sameAccount], { name: '同名工作室', accounts: [{ platform: '淘宝', handle: 'leaf' }, { platform: '淘宝', handle: 'leaf' }] });
    expect(matches.map(match => match.client.id)).toEqual(['account-match', 'name-only']);
    expect(matches[0].reasons).toEqual(['淘宝账号相同']);
    expect(matches[1].reasons).toEqual(['名称相同']);
  });

  it('名称仅作精确匹配，姓名的包含关系不会阻止不同客户建档', () => {
    expect(findDuplicateClients([client({ name: '叶子工作室' })], { name: '叶子' })).toEqual([]);
  });
});
