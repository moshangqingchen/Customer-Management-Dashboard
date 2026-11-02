import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ProjectStatus } from '../../api/types';
import { useClients, useCreateClient, useCreateProject, useCreateTag, useSettings, useTags } from '../../hooks/queries';
import { useUI } from '../../stores/ui';
import { useNav } from '../../stores/nav';
import { Button, Combobox, DateInput, Dialog, Input, Kbd, NumberInput, Select, StatusSelect, TagPicker } from '../ui';

const initial = { title: '', clientId: '', priceCents: 0, dueDate: null as string | null, tagIds: [] as string[], status: 'active' as ProjectStatus, sourcePlatform: '' };
export function NewProjectDialog() {
  const open = useUI(s => s.newProjectOpen); const setOpen = useUI(s => s.setNewProjectOpen); const navigate = useNav(s => s.navigate);
  const [form, setForm] = useState(initial); const [error, setError] = useState(''); const titleRef = useRef<HTMLInputElement>(null);
  const { data: clients = [] } = useClients(); const { data: tags = [] } = useTags(); const { data: settings } = useSettings();
  const create = useCreateProject(); const createClient = useCreateClient(); const createTag = useCreateTag();
  useEffect(() => { if (open) { const nav = useNav.getState(); const route = nav.entries[nav.index]; setForm({ ...initial, clientId: route.page === 'clients' ? route.params.clientId ?? '' : '', tagIds: [] }); setError(''); } }, [open]);
  function patch<K extends keyof typeof initial>(key: K, value: typeof initial[K]) { setForm(s => ({ ...s, [key]: value })); }
  async function save(keepOpen: boolean) {
    if (create.isPending) return;
    if (!form.title.trim() || !form.clientId) { setError('请填写项目名称并选择客户'); return; }
    try {
      const project = await create.mutateAsync({ ...form, title: form.title.trim() });
      toast.success('项目已创建');
      if (keepOpen) { setForm(s => ({ ...initial, clientId: s.clientId, tagIds: [] })); setError(''); titleRef.current?.focus(); }
      else { setOpen(false); navigate('projects', { projectId: project.id }); }
    } catch { /* mutation cache reports the server error */ }
  }
  return <Dialog open={open} onOpenChange={setOpen} title="新建项目" description="从一个清晰的名字开始，剩下的慢慢完善。">
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); void save(false); }} onKeyDown={e => {
      if (e.key === 'Enter' && e.nativeEvent.isComposing) { e.preventDefault(); return; }
      if (e.key === 'Enter' && e.ctrlKey && !e.defaultPrevented) { e.preventDefault(); void save(true); }
    }}>
      <label className="block space-y-2"><span className="font-medium">项目名称 <span className="text-danger-fg">*</span></span>
        <Input ref={titleRef} value={form.title} onChange={e => patch('title', e.target.value)} placeholder="例如：冬季新品宣传海报" required maxLength={200} /></label>
      <div className="space-y-2" role="group" aria-label="客户"><p className="font-medium">客户 <span className="text-danger-fg">*</span></p>
        <Combobox value={form.clientId} onChange={id => patch('clientId', id)} options={clients.map(c => ({ value: c.id, label: c.name }))}
          placeholder="搜索客户，或输入新客户名称" onCreate={async name => { const client = await createClient.mutateAsync({ name }); return client.id; }} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2" role="group" aria-label="报价"><p className="font-medium">报价</p>
        <NumberInput value={form.priceCents} onChange={v => patch('priceCents', v)} /></div>
        <div className="space-y-2" role="group" aria-label="截止日"><p className="font-medium">截止日</p><DateInput value={form.dueDate} onChange={v => patch('dueDate', v)} /></div></div>
      <div className="space-y-2" role="group" aria-label="项目标签"><p className="font-medium">标签</p><TagPicker tags={tags} value={form.tagIds} onChange={ids => patch('tagIds', ids)} onCreate={(name, color) => createTag.mutateAsync({ name, color })} /></div>
      <div className="grid grid-cols-2 gap-4"><div className="space-y-2" role="group" aria-label="项目状态"><p className="font-medium">状态</p><StatusSelect value={form.status} onChange={v => patch('status', v)} /></div>
        <div className="space-y-2" role="group" aria-label="来源平台"><p className="font-medium">来源平台</p><Select value={form.sourcePlatform} onChange={v => patch('sourcePlatform', v)} placeholder="选择来源平台" options={(settings?.sourcePlatforms ?? []).map(value => ({ value, label: value }))} /></div></div>
      {error && <p role="alert" className="text-danger-fg">{error}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-xs text-fg-2"><Kbd>Ctrl+Enter</Kbd> 保存并继续新建</span>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button variant="primary" type="submit" disabled={create.isPending || createClient.isPending}>{create.isPending ? '正在创建…' : '创建项目'}</Button></div></footer>
    </form>
  </Dialog>;
}
