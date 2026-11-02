import { useState, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export const illustrationNames = ['hero-morning', 'hero-afternoon', 'hero-night', 'welcome', 'empty-today', 'empty-projects', 'empty-clients', 'empty-files', 'empty-snippets', 'empty-search', 'library-offline'] as const;
export type IllustrationName = typeof illustrationNames[number];
const illustrations = import.meta.glob<string>('../../assets/illustrations/*.webp', { eager: true, query: '?url', import: 'default' });
export function illustrationUrl(name: string): string | undefined { return illustrations[`../../assets/illustrations/${name}.webp`]; }
export function BitmapIllustration({ name, alt = '', className, ...props }: HTMLAttributes<HTMLDivElement> & { name: string; alt?: string }) {
  const [failed, setFailed] = useState(false); const source = illustrationUrl(name);
  return <div className={cn('illustration-glow relative flex size-48 shrink-0 items-center justify-center rounded-full', className)} {...props}>
    {source && !failed ? <img key={source} src={source} alt={alt} onError={() => setFailed(true)} className="size-full object-contain" /> : <span aria-hidden="true" className="size-3/5 rounded-full border border-line/40 bg-primary-soft/60" />}
  </div>;
}
