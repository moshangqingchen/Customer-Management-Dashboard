import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useClients, useCreateClient, useCreateProject, useCreateTag, useSettings, useTags } from '../../hooks/queries';
import { useUI } from '../../stores/ui';
import { useNav } from '../../stores/nav';
import { emptyProjectDraft, projectDateError, projectDraftFrom, type ProjectDraft } from '../../lib/projectDraft';
import { Button, Combobox, DateInput, Dialog, Input, Kbd, NumberInput, Select, StatusSelect, TagPicker, Textarea } from '../ui';

export function NewProjectDialog() {
  const open = useUI(s => s.newProjectOpen); const setOpen = useUI(s => s.setNewProjectOpen); const navigate = useNav(s => s.navigate);
  const template = useUI(s => s.newProjectTemplate);
  const [usingTemplate, setUsingTemplate] = useState(false);
  const [form, setForm] = useState(emptyProjectDraft); const [error, setError] = useState(''); const titleRef = useRef<HTMLInputElement>(null);
  const { data: clients = [] } = useClients(); const { data: tags = [] } = useTags(); const { data: settings } = useSettings();
  const create = useCreateProject(); const createClient = useCreateClient(); const createTag = useCreateTag();
  useEffect(() => { if (open) { const nav = useNav.getState(); const route = nav.entries[nav.index]; setForm(template ? projectDraftFrom(template) : emptyProjectDraft(route.page === 'clients' ? route.params.clientId : '')); setUsingTemplate(!!template); setError(''); } }, [open, template]);
  function patch<K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) { setForm(s => ({ ...s, [key]: value })); setError(''); }
  async function save(keepOpen: boolean) {
    if (create.isPending) return;
    if (!form.title.trim() || !form.clientId) { setError('请填写项目名称并选择客户'); return; }
    const dateError = projectDateError(form.startDate, form.dueDate);
    if (dateError) { setError(dateError); return; }
    try {
      const project = await create.mutateAsync({ ...form, title: form.title.trim() });
      toast.success('项目已创建');
      if (keepOpen) { setForm(s => emptyProjectDraft(s.clientId)); setUsingTemplate(false); setError(''); titleRef.current?.focus(); }
      else { setOpen(false); navigate('projects', { projectId: project.id }); }
    } catch { /* mutation cache reports the server error */ }
  }
  return <Dialog open={open} onOpenChange={setOpen} title={usingTemplate ? '按此项目新建' : '新建项目'} description={usingTemplate && template ? `参考「${template.title}」，确认本次需求、报价和日期后创建。旧订单号、日期、收款与文件不会带入。` : '从一个清晰的名字开始，剩下的慢慢完善。'}>
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
      <details key={usingTemplate ? template?.id : 'new'} open={usingTemplate ? true : undefined} className="space-y-3"><summary className="cursor-pointer text-sm text-fg-2">需求与更多信息</summary>
        <label className="block space-y-2"><span className="text-sm">需求说明</span><Textarea aria-label="新项目需求说明" value={form.brief} onChange={event => patch('brief', event.target.value)} className="min-h-32" /></label>
        <div className="grid grid-cols-2 gap-4"><label className="space-y-2"><span className="text-sm">开始日期</span><Input type="date" aria-label="新项目开始日期" value={form.startDate ?? ''} onChange={event => patch('startDate', event.target.value || null)} /></label><label className="space-y-2"><span className="text-sm">平台订单号</span><Input aria-label="新项目平台订单号" value={form.sourceOrderNo} onChange={event => patch('sourceOrderNo', event.target.value)} /></label></div>
      </details>
      {(error || projectDateError(form.startDate, form.dueDate)) && <p role="alert" className="text-danger-fg">{error || projectDateError(form.startDate, form.dueDate)}</p>}
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4"><span className="text-xs text-fg-2"><Kbd>Ctrl+Enter</Kbd> 保存并继续新建</span>
        <div className="flex gap-2"><Button variant="ghost" onClick={() => setOpen(false)}>取消</Button><Button variant="primary" type="submit" disabled={create.isPending || createClient.isPending}>{create.isPending ? '正在创建…' : '创建项目'}</Button></div></footer>
    </form>
  </Dialog>;
}
