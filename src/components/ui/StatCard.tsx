import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { IconTile, type IconTone } from './IconTile';

interface StatCardProps {
  title: string; value: ReactNode; icon: ReactNode; tone?: IconTone; onClick?: () => void;
  change?: { label: string; tone?: 'success' | 'danger' | 'neutral' };
  numericValue?: number; formatValue?: (value: number) => ReactNode; className?: string;
}
export function StatCard({ title, value, icon, tone = 'violet', onClick, change, numericValue, formatValue, className }: StatCardProps) {
  const [count, setCount] = useState(numericValue ?? 0);
  useEffect(() => {
    if (numericValue === undefined) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setCount(numericValue); return; }
    const started = performance.now(); let frame = 0;
    function tick(now: number) { const progress = Math.min((now - started) / 600, 1); setCount(Math.round(numericValue! * (1 - (1 - progress) ** 3))); if (progress < 1) frame = requestAnimationFrame(tick); }
    frame = requestAnimationFrame(tick); return () => cancelAnimationFrame(frame);
  }, [numericValue]);
  const Tag = onClick ? 'button' : 'div';
  return <Tag {...(onClick ? { type: 'button' as const, onClick } : {})} className={cn('stat-card flex min-w-0 items-center gap-4 rounded-lg border border-line/70 bg-surface p-5 text-left shadow-sm', onClick && 'card-interactive', className)}>
    <IconTile tone={tone} className="stat-icon">{icon}</IconTile><span className="stat-content min-w-0 flex-1"><span className="stat-label block text-sm text-fg-2">{title}</span><span className="stat-value mt-1 block text-stat font-bold tracking-tight tabular-nums">{numericValue === undefined ? value : formatValue ? formatValue(count) : count}</span>{change && <span className={cn('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs', change.tone === 'success' ? 'bg-success-bg text-success-fg' : change.tone === 'danger' ? 'bg-danger-bg text-danger-fg' : 'bg-subtle text-fg-2')}>{change.label}</span>}</span>
  </Tag>;
}
