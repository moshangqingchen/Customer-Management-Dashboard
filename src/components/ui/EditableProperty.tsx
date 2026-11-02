import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from '../../lib/cn';
import { Input, inputClass } from './Input';

interface EditablePropertyProps {
  icon: ReactNode;
  label: string;
  editLabel?: string;
  value: string;
  displayValue?: string;
  placeholder?: string;
  type?: 'text' | 'date';
  options?: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  onSave: (value: string) => Promise<unknown>;
}

export function EditableProperty({ icon, label, editLabel = `编辑${label}`, value, displayValue, placeholder = '未设置', type = 'text', options, disabled, className, onSave }: EditablePropertyProps) {
  const [editing, setEditing] = useState(false); const [draft, setDraft] = useState(value); const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null); const select = useRef<HTMLSelectElement>(null); const trigger = useRef<HTMLButtonElement>(null);
  const canceled = useRef(false); const committing = useRef(false);
  useEffect(() => { if (!editing && !saving) setDraft(value); }, [value, editing, saving]);
  useEffect(() => { if (editing) { (options ? select.current : input.current)?.focus(); if (type === 'text' && !options) input.current?.select(); } }, [editing, options, type]);
  async function commit(restoreFocus = false) {
    if (canceled.current || committing.current) return;
    committing.current = true; setEditing(false);
    if (draft !== value) {
      setSaving(true);
      try { await onSave(draft); } catch (error) { setDraft(value); toast.error(error instanceof Error ? error.message : '保存失败，请重试'); }
      finally { setSaving(false); }
    }
    committing.current = false;
    if (restoreFocus) requestAnimationFrame(() => { if (document.activeElement === document.body) trigger.current?.focus(); });
  }
  const keyDown = (event: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); canceled.current = true; setDraft(value); setEditing(false); requestAnimationFrame(() => trigger.current?.focus()); }
    if (event.key === 'Enter') { event.preventDefault(); void commit(true); }
  };
  return <div className={cn('flex min-w-0 items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-hover', className)}>
    <span aria-hidden className="shrink-0 text-fg-2">{icon}</span><span className="w-16 shrink-0 text-xs text-fg-2">{label}</span>
    <div className="min-w-0 flex-1">{editing ? options ? <select ref={select} aria-label={editLabel} value={draft} className={cn(inputClass, 'h-[34px]')} onChange={event => setDraft(event.target.value)} onBlur={() => void commit()} onKeyDown={keyDown}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <Input ref={input} type={type} aria-label={editLabel} value={draft} className="h-[34px]" onChange={event => setDraft(event.target.value)} onBlur={() => void commit()} onKeyDown={keyDown} /> : <button ref={trigger} type="button" aria-label={editLabel} disabled={disabled || saving} title={displayValue ?? draft} className={cn('h-[34px] w-full truncate rounded-sm px-2 text-left disabled:opacity-50', !draft && 'text-fg-2')} onClick={() => { canceled.current = false; setDraft(value); setEditing(true); }}>{displayValue ?? (draft || placeholder)}</button>}</div>
  </div>;
}

