import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';
import { useNav } from '../../stores/nav';
import { IconButton, Tooltip } from '../ui';

export function PageHeader({ title, count, actions, titleAdornment, meta, info }: { title: string; count?: number; actions?: ReactNode; titleAdornment?: ReactNode; meta?: ReactNode; info?: ReactNode }) {
  const nav = useNav();
  return <header className="flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2">
    <div className="flex min-w-0 items-center gap-3"><div className="flex gap-0.5">
      <IconButton label="后退（Alt+←）" size="sm" disabled={nav.index === 0} onClick={nav.back}><ChevronLeft size={16} /></IconButton>
      <IconButton label="前进（Alt+→）" size="sm" disabled={nav.index === nav.entries.length - 1} onClick={nav.forward}><ChevronRight size={16} /></IconButton>
    </div><h1 className="text-[24px] leading-8 font-semibold tracking-tight">{title}</h1>{titleAdornment}
      {count !== undefined && <span className="rounded-full bg-subtle px-2.5 py-0.5 text-sm font-medium text-fg-2 tabular-nums">{count}</span>}
      {info && <Tooltip content={info}><button type="button" aria-label={`${title}说明`} className="rounded-full text-fg-2"><Info size={16} /></button></Tooltip>}
      {meta && <span className="border-l border-line-strong pl-3 text-sm text-fg-2">{meta}</span>}
    </div><div className="ml-auto flex items-center gap-2">{actions}</div>
  </header>;
}
