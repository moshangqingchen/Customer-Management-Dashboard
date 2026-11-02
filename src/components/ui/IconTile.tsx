import type { HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export type IconTone = 'violet' | 'sky' | 'mint' | 'peach' | 'rose' | 'amber';
export const iconToneClasses: Record<IconTone, string> = {
  violet: 'bg-tile-violet-bg text-tile-violet-fg', sky: 'bg-tile-sky-bg text-tile-sky-fg',
  mint: 'bg-tile-mint-bg text-tile-mint-fg', peach: 'bg-tile-peach-bg text-tile-peach-fg',
  rose: 'bg-tile-rose-bg text-tile-rose-fg', amber: 'bg-tile-amber-bg text-tile-amber-fg',
};
export function IconTile({ tone = 'violet', size = 'md', className, children, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: IconTone; size?: 'sm' | 'md' }) {
  return <span className={cn('inline-flex shrink-0 items-center justify-center [&>svg]:size-5', iconToneClasses[tone], size === 'sm' ? 'size-9 rounded-[10px]' : 'size-12 rounded-[14px]', className)} {...props}>{children}</span>;
}
