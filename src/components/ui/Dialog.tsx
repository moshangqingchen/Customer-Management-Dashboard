import * as Primitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { useRef, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { Button, IconButton } from './Button';
import { cn } from '../../lib/cn';

export interface DialogProps { open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string; children: ReactNode; footer?: ReactNode; className?: string }
export function Dialog({ open, onOpenChange, title, description, children, footer, className }: DialogProps) {
  const opener = useRef<HTMLElement | null>(null);
  const content = useRef<HTMLDivElement>(null);
  return <Primitive.Root open={open} onOpenChange={onOpenChange}><Primitive.Portal><Primitive.Overlay className="fixed inset-0 z-50 bg-overlay animate-pop" /><Primitive.Content ref={content} onOpenAutoFocus={event => { opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; event.preventDefault(); (content.current?.querySelector<HTMLElement>('input:not([disabled]):not([type="hidden"]),textarea:not([disabled]),[data-autofocus]') ?? content.current)?.focus(); }} onCloseAutoFocus={event => { event.preventDefault(); opener.current?.focus(); }} className={cn('fixed top-1/2 left-1/2 z-50 flex max-h-[90dvh] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl border border-line bg-surface shadow-lg animate-pop', className)}><div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4"><div className="min-w-0 [overflow-wrap:anywhere]"><Primitive.Title className="text-xl font-semibold">{title}</Primitive.Title><Primitive.Description className={cn('mt-1 text-sm text-fg-2', !description && 'sr-only')}>{description ?? title}</Primitive.Description></div><Primitive.Close asChild><IconButton label="关闭弹窗"><X size={16} /></IconButton></Primitive.Close></div><div className="min-h-0 overflow-y-auto px-6 pb-5">{children}</div>{footer && <div className="flex items-center justify-end gap-2 rounded-b-xl border-t border-line bg-subtle px-6 py-4">{footer}</div>}</Primitive.Content></Primitive.Portal></Primitive.Root>;
}
export function ConfirmDialog({ open, onOpenChange, title, description, onConfirm, confirmLabel = '确认删除', danger = true }: Omit<DialogProps, 'children' | 'footer'> & { onConfirm: () => Promise<unknown> | unknown; confirmLabel?: string; danger?: boolean }) {
  const [pending, setPending] = useState(false);
  async function confirm() { setPending(true); try { await onConfirm(); onOpenChange(false); } catch (error) { toast.error(error instanceof Error ? error.message : '操作失败'); } finally { setPending(false); } }
  return <Dialog open={open} onOpenChange={next => { if (!pending) onOpenChange(next); }} title={title} description={description} footer={<><Button onClick={() => onOpenChange(false)} disabled={pending}>取消</Button><Button variant={danger ? 'danger' : 'primary'} onClick={() => void confirm()} disabled={pending}>{pending ? '处理中…' : confirmLabel}</Button></>}><p className="text-sm text-fg-2">{danger ? '这项操作会影响关联数据，请确认后继续。' : '请确认后继续。'}</p></Dialog>;
}
