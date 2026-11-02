import * as Primitive from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';

export function Tooltip({ children, content }: { children: ReactNode; content: ReactNode }) {
  return <Primitive.Provider delayDuration={400}><Primitive.Root><Primitive.Trigger asChild>{children}</Primitive.Trigger><Primitive.Portal><Primitive.Content sideOffset={6} className="z-[100] max-w-64 rounded-sm border border-line bg-surface px-3 py-1.5 text-xs text-fg shadow-md animate-pop">{content}<Primitive.Arrow className="fill-surface" /></Primitive.Content></Primitive.Portal></Primitive.Root></Primitive.Provider>;
}
