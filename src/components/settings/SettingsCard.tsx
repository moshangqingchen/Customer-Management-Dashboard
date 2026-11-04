import type { ReactNode } from 'react';
import { Card } from '../ui/Surfaces';

export function SettingsCard({ title, description, children, action }: { title: string; description?: string; children: ReactNode; action?: ReactNode }) {
  return <Card className="min-w-0 p-5 sm:p-6"><div className="mb-5 flex items-center gap-3"><div className="min-w-0 flex-1"><h2 className="text-lg font-semibold">{title}</h2>{description && <p className="mt-0.5 text-xs text-fg-2">{description}</p>}</div>{action}</div>{children}</Card>;
}
