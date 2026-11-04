import { useId } from 'react';
import { cn } from '../../lib/cn';

export function AppMark({ className }: { className?: string }) {
  const gradientId = `app-mark-${useId().replace(/:/g, '')}`;
  return <svg viewBox="0 0 64 64" className={cn('size-11 shrink-0', className)} aria-hidden="true">
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stopColor="#6366F1" /><stop offset="55%" stopColor="#5B8DEF" /><stop offset="100%" stopColor="#38BDF8" />
    </linearGradient></defs>
    <rect width="64" height="64" rx="17" fill={`url(#${gradientId})`} />
    <path d="M17 19h12l5 6h13a3 3 0 0 1 3 3v19a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V23a4 4 0 0 1 3-4Z" fill="none" stroke="white" strokeWidth="3" strokeLinejoin="round" />
    <path d="m26 37 6 6 12-13" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>;
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return <span className="flex min-w-0 items-center gap-3"><AppMark />
    {!compact && <span className="min-w-0 whitespace-nowrap text-[20px] leading-7 font-bold tracking-tight">客户工作台</span>}
  </span>;
}
