import { useState } from 'react';
import { FileText } from 'lucide-react';
import { useUpdateProject } from '../../hooks/queries';
import { briefTemplates } from '../../lib/projectDraft';
import { Button, ConfirmDialog, DropdownMenu, Textarea, Tooltip } from '../ui';

export function ProjectBrief({ projectId, value }: { projectId: string; value: string }) {
  const [draft, setDraft] = useState(value); const [saved, setSaved] = useState(value); const update = useUpdateProject();
  const [pendingTemplate, setPendingTemplate] = useState<(typeof briefTemplates)[number] | null>(null);
  async function save(next = draft) {
    if (next === saved || update.isPending) return;
    setDraft(next);
    try { await update.mutateAsync({ id: projectId, patch: { brief: next } }); setSaved(next); }
    catch { setDraft(saved); }
  }
  return <section className="space-y-2"><div className="flex items-center justify-between gap-2"><Tooltip content="离开输入框后自动保存，也可按 Ctrl+Enter 保存"><h3 tabIndex={0} className="text-sm font-medium">需求说明</h3></Tooltip><div className="flex items-center gap-2"><span aria-live="polite" className="text-xs text-fg-3">{update.isPending ? '正在保存…' : ''}</span><DropdownMenu label="选择需求模板" trigger={<Button size="sm" variant="ghost" icon={<FileText size={14} />} disabled={update.isPending}>需求模板</Button>} items={briefTemplates.map(template => ({ label: template.name, onSelect: () => { if (draft.trim()) setPendingTemplate(template); else void save(template.body); } }))} /></div></div><Textarea aria-label="项目需求说明" disabled={update.isPending} className="min-h-64 bg-surface" value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => void save()} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void save(); } }} placeholder="记录需求、尺寸、文案、修改意见与交付要求…" />
    <ConfirmDialog open={pendingTemplate !== null} onOpenChange={open => { if (!open) setPendingTemplate(null); }} title="追加需求模板？" description={`将「${pendingTemplate?.name ?? ''}」模板追加到现有需求末尾，原有内容会保留。`} danger={false} confirmLabel="追加模板" onConfirm={async () => { if (pendingTemplate) await save(`${draft.trimEnd()}\n\n${pendingTemplate.body}`); }} />
  </section>;
}
