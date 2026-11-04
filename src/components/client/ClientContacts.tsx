import { useRef, useState } from 'react';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Mail, MapPin, MessageCircle, Phone, Plus, X } from 'lucide-react';
import type { Client, ClientAccount, ClientPatch } from '../../api/types';
import { useSettings } from '../../hooks/queries';
import { contactFields, type ContactField } from '../../lib/clients';
import { Button, CopyButton, IconButton, InlineEdit, Input, Select } from '../ui';
import { EditableProperty } from '../ui/EditableProperty';

const contactIcons = { phone: Phone, wechat: MessageCircle, email: Mail, address: MapPin };

export function ClientContacts({ client, save }: { client: Client; save: (patch: ClientPatch) => Promise<unknown> }) {
  const [addingField, setAddingField] = useState<ContactField>(); const [fieldDraft, setFieldDraft] = useState('');
  const [addingAccount, setAddingAccount] = useState(false); const [account, setAccount] = useState<ClientAccount>({ platform: '微信', handle: '' });
  const { data: settings } = useSettings(); const committing = useRef(false); const addingInput = useRef<HTMLInputElement>(null);
  async function addField() {
    if (!addingField || committing.current) return;
    if (!fieldDraft.trim()) return;
    committing.current = true;
    try { await save({ [addingField]: fieldDraft.trim() }); setAddingField(undefined); setFieldDraft(''); }
    catch { /* keep the draft available for retry */ }
    finally { committing.current = false; }
  }
  async function addAccount() {
    if (!account.handle.trim() || committing.current) return;
    committing.current = true;
    try { await save({ accounts: [...client.accounts, { platform: account.platform, handle: account.handle.trim() }] }); setAccount({ platform: '微信', handle: '' }); setAddingAccount(false); }
    catch { /* mutation hook reports errors; preserve draft for retry */ }
    finally { committing.current = false; }
  }
  return <section>
    <div className="mb-2 flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">资料</h2><Dropdown.Root><Dropdown.Trigger asChild><Button aria-label="添加客户资料" variant="ghost" size="sm"><Plus size={14} />添加</Button></Dropdown.Trigger><Dropdown.Portal><Dropdown.Content align="end" sideOffset={6} onCloseAutoFocus={event => { if (addingField || addingAccount) { event.preventDefault(); addingInput.current?.focus(); } }} className="z-[90] min-w-36 rounded-lg border border-line bg-surface p-1 shadow-md">
      {contactFields.filter(field => !client[field.key]).map(field => <Dropdown.Item key={field.key} className="flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-hover" onSelect={() => { setAddingField(field.key); setAddingAccount(false); setFieldDraft(''); }}>{field.label}</Dropdown.Item>)}
      <Dropdown.Item className="flex min-h-9 cursor-pointer items-center rounded-sm px-3 text-sm outline-none data-[highlighted]:bg-hover" onSelect={() => { setAddingAccount(true); setAddingField(undefined); }}>平台账号</Dropdown.Item>
    </Dropdown.Content></Dropdown.Portal></Dropdown.Root></div>
    <div className="space-y-1">{contactFields.filter(field => !!client[field.key] || addingField === field.key).map(field => { const Icon = contactIcons[field.key]; return addingField === field.key ? <div key={field.key} className="flex items-center gap-2 py-1"><Icon size={15} className="shrink-0 text-fg-2" /><Input ref={addingInput} autoFocus aria-label={`编辑${field.label}`} placeholder={`输入${field.label}`} value={fieldDraft} onChange={event => setFieldDraft(event.target.value)} onBlur={() => void addField()} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { event.preventDefault(); void addField(); } if (event.key === 'Escape') { event.preventDefault(); setAddingField(undefined); setFieldDraft(''); } }} /></div> : <div key={field.key} className="flex min-w-0 items-center"><EditableProperty icon={<Icon size={15} />} label={field.label} className="min-w-0 flex-1 px-0 [&>span:nth-child(2)]:w-9" value={client[field.key]} placeholder={`添加${field.label}`} onSave={value => save({ [field.key]: value.trim() })} /><CopyButton value={client[field.key]} label={`复制${field.label}`} /></div>; })}</div>
    {client.accounts.length > 0 && <div className="mt-3 space-y-2 border-t border-line pt-3">{client.accounts.map((item, index) => <div key={index} className="flex min-h-[38px] items-center gap-1">
      <InlineEdit label={`编辑账号 ${index + 1} 的平台`} className="w-16 shrink-0 px-1 text-xs text-fg-2" value={item.platform} onSave={platform => save({ accounts: client.accounts.map((row, at) => at === index ? { ...row, platform: platform.trim() || '其他' } : row) })} />
      <InlineEdit label={`编辑平台账号 ${index + 1}`} className="min-w-0 flex-1 px-1" value={item.handle} onSave={handle => save({ accounts: client.accounts.map((row, at) => at === index ? { ...row, handle: handle.trim() } : row).filter(row => row.handle) })} />
      <CopyButton value={item.handle} label={`复制${item.platform}账号`} /><IconButton size="sm" label={`删除平台账号 ${index + 1}`} onClick={() => void save({ accounts: client.accounts.filter((_, at) => at !== index) }).catch(() => undefined)}><X size={14} /></IconButton>
    </div>)}</div>}
    {addingAccount && <div className="mt-3 space-y-2"><Select label="新账号平台" value={account.platform} onChange={platform => setAccount(current => ({ ...current, platform }))} options={(settings?.sourcePlatforms ?? ['微信', '淘宝', '小红书', '其他']).map(value => ({ value, label: value }))} /><div className="flex gap-1">
      <Input ref={addingInput} autoFocus aria-label="新平台账号" placeholder="输入账号" value={account.handle} onChange={event => setAccount(current => ({ ...current, handle: event.target.value }))} onBlur={() => void addAccount()} onKeyDown={event => { if (event.nativeEvent.isComposing) return; if (event.key === 'Enter') { event.preventDefault(); void addAccount(); } if (event.key === 'Escape') setAddingAccount(false); }} />
      <IconButton label="取消添加账号" onMouseDown={event => event.preventDefault()} onClick={() => { setAddingAccount(false); setAccount({ platform: '微信', handle: '' }); }}><X size={16} /></IconButton></div></div>}
    {!contactFields.some(field => client[field.key]) && !client.accounts.length && !addingField && !addingAccount && <p className="py-2 text-sm text-fg-2">还没有联系方式</p>}
  </section>;
}
