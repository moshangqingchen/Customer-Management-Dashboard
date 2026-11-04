import { useEffect, useState } from 'react';
import { Textarea, Tooltip } from '../ui';

export function ClientNotes({ value, onSave }: { value: string; onSave: (notes: string) => Promise<unknown> }) {
  const [draft, setDraft] = useState(value); const [editing, setEditing] = useState(false); const [pending, setPending] = useState(false);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  async function save() {
    setEditing(false); if (draft === value) return;
    setPending(true);
    try { await onSave(draft); } catch { setDraft(value); } finally { setPending(false); }
  }
  return <div className="mt-4 border-t border-line pt-4"><label className="block space-y-3"><span className="flex items-center justify-between gap-3"><Tooltip content="失焦自动保存"><span tabIndex={0} className="font-medium">客户备注</span></Tooltip>{pending && <span className="text-xs text-fg-3">正在保存…</span>}</span><Textarea aria-label="编辑客户备注" rows={4} placeholder="记录偏好、合作习惯或特别提醒" value={draft} onFocus={() => setEditing(true)} onChange={event => setDraft(event.target.value)} onBlur={() => void save()} /></label></div>;
}
