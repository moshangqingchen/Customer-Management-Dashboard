import type { ReactNode } from 'react';
export function PageHeader({ title, description, count, actions }: { title: string; description?: string; count?: number; actions?: ReactNode }) {
  return <header className="flex flex-wrap items-start justify-between gap-4">
    <div><div className="flex items-center gap-3"><h1 className="text-[26px] leading-[34px] font-semibold tracking-tight">{title}</h1>
      {count !== undefined && <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-sm font-medium text-accent tabular-nums">{count}</span>}</div>
      {description && <p className="mt-1.5 text-sm text-fg-2">{description}</p>}
    </div><div className="flex items-center gap-2">{actions}</div>
  </header>;
}
