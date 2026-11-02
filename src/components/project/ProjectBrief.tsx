import { useState } from 'react';
import { useUpdateProject } from '../../hooks/queries';
import { Textarea } from '../ui';

export function ProjectBrief({ projectId, value }: { projectId: string; value: string }) {
  const [draft, setDraft] = useState(value); const [saved, setSaved] = useState(value); const update = useUpdateProject();
  async function save() {
    if (draft === saved || update.isPending) return;
    const next = draft;
    try { await update.mutateAsync({ id: projectId, patch: { brief: next } }); setSaved(next); }
    catch { setDraft(saved); }
  }
  return <section className="space-y-2"><div className="flex justify-between gap-2"><h3 className="text-sm font-medium">需求说明</h3><span aria-live="polite" className="text-xs text-fg-3">{update.isPending ? '正在保存…' : draft === saved ? '已自动保存' : '离开输入框后自动保存'}</span></div><Textarea aria-label="项目需求说明" disabled={update.isPending} className="min-h-64 bg-surface" value={draft} onChange={event => setDraft(event.target.value)} onBlur={() => void save()} onKeyDown={event => { if (event.ctrlKey && event.key === 'Enter') { event.preventDefault(); void save(); } }} placeholder="记录需求、尺寸、文案、修改意见与交付要求…" /></section>;
}
