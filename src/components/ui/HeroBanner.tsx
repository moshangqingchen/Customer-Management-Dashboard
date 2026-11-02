import { useEffect, useState, type HTMLAttributes } from 'react';
import { cn } from '../../lib/cn';

export function HeroBanner({ image, className, children, ...props }: HTMLAttributes<HTMLDivElement> & { image?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return <div className={cn('hero-banner relative isolate overflow-hidden rounded-2xl border border-line/60 shadow-sm', className)} {...props}>
    {image && !failed && <img src={image} alt="" onError={() => setFailed(true)} className="hero-art absolute inset-0 -z-20 size-full object-cover object-right" />}
    <div className="hero-overlay absolute inset-0 -z-10" aria-hidden="true" /><div className="flex h-full flex-col justify-center px-8 py-6">{children}</div>
  </div>;
}
