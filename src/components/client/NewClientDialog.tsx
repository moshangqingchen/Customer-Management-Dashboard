import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ClientInput } from '../../api/types';
import { useClients, useCreateClient, useCreateTag, useSettings, useTags } from '../../hooks/queries';
import { findDuplicateClients } from '../../lib/clientDuplicates';
import { DuplicateClientNotice } from './DuplicateClientNotice';
import { useUI } from '../../stores/ui';
import { useNav } from '../../stores/nav';
import { Button, Dialog, IconButton, Input, Kbd, Select, TagPicker, Textarea } from '../ui';

const initial: ClientInput = { name: '', company: '', phone: '', wechat: '', email: '', address: '', rating: 0, notes: '', accounts: [], tagIds: [] };
export function NewClientDialog() {
  const open = useUI(s => s.newClientOpen); const setOpen = useUI(s => s.setNewClientOpen); const navigate = useNav(s => s.navigate);
  const [form, setForm] = useState(initial); const [error, setError] = useState(''); const nameRef = useRef<HTMLInputElement>(null);
  const clients = useClients(); const [duplicateConfirmed, setDuplicateConfirmed] = useState(false);
  const [uncheckedConfirmed, setUncheckedConfirmed] = useState(false);
  const duplicates = useMemo(() => findDuplicateClients(clients.data ?? [], form), [clients.data, form]);
  const duplicateKey = duplicates.map(match => `${match.client.id}:${match.reasons.join(',')}`).join('|');
  useEffect(() => { setDuplicateConfirmed(false); }, [duplicateKey]);
  const create = useCreateClient(); const createTag = useCreateTag(); const { data: tags = [] } = useTags(); const { data: settings } = useSettings();
  useEffect(() => { if (open) { setForm({ ...initial, accounts: [], tagIds: [] }); setError(''); setDuplicateConfirmed(false); setUncheckedConfirmed(false); } }, [open]);
  function patch<K extends keyof ClientInput>(key: K, value: ClientInput[K]) { setForm(s => ({ ...s, [key]: value })); setDuplicateConfirmed(false); setUncheckedConfirmed(false); setError(''); }
  async function save(keepOpen: boolean) {
    if (create.isPending) return;
    if (!form.name.trim()) { setError('请填写客户名称'); return; }
    if (clients.isPending) { setError('正在核对已有客户，请稍候'); return; }
    if (clients.isError && !uncheckedConfirmed) { setError('请重试客户核对，或确认暂不核对后创建'); return; }
    if (duplicates.length && !duplicateConfirmed) { setError('请先核对已有客户，或勾选确认独立建档'); return; }
    try {
      const client = await create.mutateAsync({ ...form, name: form.name.trim(), accounts: form.accounts?.filter(a => a.handle.trim()) });
      toast.success('客户已创建');
      if (keepOpen) { setForm({ ...initial, accounts: [], tagIds: [] }); setError(''); setDuplicateConfirmed(false); setUncheckedConfirmed(false); nameRef.current?.focus(); }
      else { setOpen(false); navigate('clients', { clientId: client.id }); }
    } catch { /* mutation cache reports the server error */ }
  }
  return <Dialog open={open} onOpenChange={setOpen} title="新建客户" description="只需填写名称，就能开始第一次合作。">
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); void save(false); }} onKeyDown={e => {
      if (e.key === 'Enter' && e.nativeEvent.isComposing) { e.preventDefault(); return; }
      if (e.key === 'Enter' && e.ctrlKey && !e.defaultPrevented) { e.preventDefault(); void save(true); }
    }}>
      <label className="block space-y-2"><span className="font-medium">客户名称 <span className="text-danger-fg">*</span></span><Input ref={nameRef} required maxLength={100} value={form.name} onChange={e => patch('name', e.target.value)} placeholder="姓名或店铺名称" /></label>
      <div className="grid grid-cols-2 gap-4">{([
        ['company', '公司 / 店铺'], ['phone', '电话'], ['wechat', '微信'], ['email', '邮箱'],
      ] as const).map(([key, label]) => <label key={key} className="block space-y-2"><span className="font-medium">{label}</span><Input type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={form[key]} onChange={e => patch(key, e.target.value)} /></label>)}</div>
      <DuplicateClientNotice matches={duplicates} confirmed={duplicateConfirmed} onConfirm={setDuplicateConfirmed} onOpen={id => { setOpen(false); navigate('clients', { clientId: id }); }} />
      {clients.isPending && <p role="status" className="text-sm text-fg-2">正在核对已有客户…</p>}
      {clients.isError && <div className="space-y-2 text-sm text-fg-2"><p>暂时无法核对已有客户。<Button size="sm" variant="ghost" onClick={() => void clients.refetch()}>重新读取</Button></p><label className="flex items-center gap-2"><input type="checkbox" checked={uncheckedConfirmed} onChange={event => setUncheckedConfirmed(event.target.checked)} className="accent-primary" />确认暂不核对，继续创建</label></div>}
      <label className="block space-y-2"><span className="font-medium">地址</span><Input value={form.address} onChange={e => patch('address', e.target.value)} /></label>
      <div className="space-y-2"><div className="flex items-center justify-between"><p className="font-medium">平台账号</p><Button size="sm" variant="ghost" onClick={() => patch('accounts', [...(form.accounts ?? []), { platform: '微信', handle: '' }])}><Plus size={14} />添加账号</Button></div>
        {form.accounts?.map((account, index) => <div key={index} className="flex gap-2"><Select value={account.platform} onChange={platform => patch('accounts', form.accounts?.map((a, i) => i === index ? { ...a, platform } : a))} options={(settings?.sourcePlatforms ?? ['微信']).map(value => ({ value, label: value }))} />
          <Input aria-label={`平台账号 ${index + 1}`} value={account.handle} onChange={e => patch('accounts', form.accounts?.map((a, i) => i === index ? { ...a, handle: e.target.value } : a))} /><IconButton label={`移除平台账号 ${index + 1}`} onClick={() => patch('accounts', form.accounts?.filter((_, i) => i !== index))}><X size={16} /></IconButton></div>)}</div>
      <div className="space-y-2" role="group" aria-label="客户标签"><p className="font-medium">标签</p><TagPicker tags={tags} value={form.tagIds ?? []} onChange={ids => patch('tagIds', ids)} onCreate={(name, color) => createTag.mutateAsync({ name, color })} /></div>
      <div className="space-y-2" role="group" aria-label="客户星级"><p className="font-medium">星级</p><Select value={String(form.rating ?? 0)} onChange={value => patch('rating', Number(value))} options={[0, 1, 2, 3, 4, 5].map(v => ({ value: String(v), label: v ? `${v} 星` : '未设置' }))} /></div>
      <label className="block space-y-2"><span className="font-medium">备注</span><Textarea rows={2} value={form.notes} onChange={e => patch('notes', e.target.value)} /></label>
      {error && <p role="alert" className="text-danger-fg">{error}</p>}
      <footer className="flex items-center justify-between gap-3 border-t border-line pt-4"><span className="text-xs text-fg-2"><Kbd>Ctrl+Enter</Kbd> 保存并继续</span><div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button variant="primary" type="submit" disabled={create.isPending || clients.isPending}>{create.isPending ? '正在创建…' : '创建客户'}</Button></div></footer>
    </form>
  </Dialog>;
}
