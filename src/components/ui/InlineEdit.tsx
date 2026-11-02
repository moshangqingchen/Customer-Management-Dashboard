import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Input } from './Input';
import { cn } from '../../lib/cn';

export function InlineEdit({ value, onSave, placeholder = '点击填写', label = '编辑内容', className }: { value: string; onSave: (value: string) => Promise<unknown> | unknown; placeholder?: string; label?: string; className?: string }) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value); const [saving, setSaving] = useState(false);
  const cancel = useRef(false); const input = useRef<HTMLInputElement>(null); const committing = useRef(false);
  useEffect(() => { if (!editing) setDraft(value); }, [value, editing]);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  async function save() {
    if (cancel.current || committing.current) return;
    setEditing(false); if (draft === value) return;
    committing.current = true; setSaving(true);
    try { await onSave(draft); } catch (error) { setDraft(value); toast.error(error instanceof Error ? error.message : '保存失败，请重试'); }
    finally { committing.current = false; setSaving(false); }
  }
  return editing ? <Input ref={input} aria-label={label} value={draft} className={className} onChange={event => setDraft(event.target.value)} onBlur={() => void save()} onKeyDown={event => { if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return; if (event.key === 'Escape') { cancel.current = true; setDraft(value); setEditing(false); } if (event.key === 'Enter') { event.preventDefault(); void save(); } }} /> : <button type="button" disabled={saving} aria-label={label} className={cn('min-h-[38px] rounded-md px-3 text-left transition-colors transition-sky hover:bg-hover disabled:opacity-50', !value && 'text-fg-2', className)} onClick={() => { cancel.current = false; setEditing(true); }}>{draft || placeholder}</button>;
}
