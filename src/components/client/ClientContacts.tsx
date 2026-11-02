import { useRef, useState } from 'react';
import { ContactRound, Mail, MapPin, MessageCircle, Phone, Plus, X } from 'lucide-react';
import type { Client, ClientAccount, ClientPatch } from '../../api/types';
import { useSettings } from '../../hooks/queries';
import { clientContactFields } from '../../lib/clients';
import { Button, Card, CopyButton, IconButton, IconTile, InlineEdit, Input, Select } from '../ui';
import { EditableProperty } from '../ui/EditableProperty';

const contactIcons = { phone: Phone, wechat: MessageCircle, email: Mail, address: MapPin };

export function ClientContacts({ client, save }: { client: Client; save: (patch: ClientPatch) => Promise<unknown> }) {
  const [expanded, setExpanded] = useState(false); const [addingAccount, setAddingAccount] = useState(false);
  const [account, setAccount] = useState<ClientAccount>({ platform: '微信', handle: '' });
  const { data: settings } = useSettings(); const committing = useRef(false);
  const fields = clientContactFields(client, expanded);
  async function addAccount() {
    if (!account.handle.trim() || committing.current) return;
    committing.current = true;
    try { await save({ accounts: [...client.accounts, { platform: account.platform, handle: account.handle.trim() }] }); setAccount({ platform: '微信', handle: '' }); setAddingAccount(false); }
    catch { /* mutation hook reports errors; preserve draft for retry */ }
    finally { committing.current = false; }
  }
  return <Card className="p-5">
    <div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><IconTile tone="sky" size="sm"><ContactRound /></IconTile><h2 className="text-lg font-semibold">联系方式</h2></div><Button variant="ghost" size="sm" onClick={() => setExpanded(value => !value)}><Plus size={14} />{expanded ? '收起空白项' : '添加联系方式'}</Button></div>
    <div className="grid grid-cols-1 gap-x-3 gap-y-1 2xl:grid-cols-2">{fields.map(field => { const Icon = contactIcons[field.key]; return <div key={field.key} className="flex min-w-0 items-center"><EditableProperty icon={<Icon size={16} />} label={field.label} className="min-w-0 flex-1" value={client[field.key]} placeholder={`添加${field.label}`} onSave={value => save({ [field.key]: value.trim() })} />{client[field.key] && <CopyButton value={client[field.key]} label={`复制${field.label}`} />}</div>; })}</div>
    {client.accounts.length > 0 && <div className="mt-3 space-y-2 border-t border-line pt-3">{client.accounts.map((item, index) => <div key={index} className="flex min-h-[38px] items-center gap-1">
      <InlineEdit label={`编辑账号 ${index + 1} 的平台`} className="w-24 shrink-0 text-sm text-fg-2" value={item.platform} onSave={platform => save({ accounts: client.accounts.map((row, at) => at === index ? { ...row, platform: platform.trim() || '其他' } : row) })} />
      <InlineEdit label={`编辑平台账号 ${index + 1}`} className="min-w-0 flex-1 break-all" value={item.handle} onSave={handle => save({ accounts: client.accounts.map((row, at) => at === index ? { ...row, handle: handle.trim() } : row).filter(row => row.handle) })} />
      <CopyButton value={item.handle} label={`复制${item.platform}账号`} /><IconButton size="sm" label={`删除平台账号 ${index + 1}`} onClick={() => void save({ accounts: client.accounts.filter((_, at) => at !== index) }).catch(() => undefined)}><X size={14} /></IconButton>
    </div>)}</div>}
    {addingAccount ? <div className="mt-3 flex gap-2"><Select label="新账号平台" value={account.platform} onChange={platform => setAccount(current => ({ ...current, platform }))} options={(settings?.sourcePlatforms ?? ['微信', '淘宝', '小红书', '其他']).map(value => ({ value, label: value }))} />
      <Input autoFocus aria-label="新平台账号" placeholder="输入账号，回车或失焦添加" value={account.handle} onChange={event => setAccount(current => ({ ...current, handle: event.target.value }))} onBlur={() => void addAccount()} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { event.preventDefault(); void addAccount(); } if (event.key === 'Escape') setAddingAccount(false); }} />
      <IconButton label="取消添加账号" onMouseDown={event => event.preventDefault()} onClick={() => { setAddingAccount(false); setAccount({ platform: '微信', handle: '' }); }}><X size={16} /></IconButton></div> : <Button className="mt-3" variant="ghost" size="sm" onClick={() => setAddingAccount(true)}><Plus size={14} />添加平台账号</Button>}
    {!fields.length && !client.accounts.length && <p className="mt-2 text-sm text-fg-2">还没有联系方式，添加后随时一键复制。</p>}
  </Card>;
}
