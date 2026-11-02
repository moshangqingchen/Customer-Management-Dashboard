import { Skeleton } from '../ui/Surfaces';

export function PageSkeleton({ label = '正在加载页面' }: { label?: string }) {
  return <div role="status" aria-label={label} className="space-y-6 p-7">
    <span className="sr-only">{label}</span>
    <Skeleton className="h-9 w-48" />
    <div className="grid grid-cols-3 gap-4">{[0, 1, 2].map(index => <Skeleton key={index} className="h-28" />)}</div>
    <Skeleton className="h-64 w-full" />
  </div>;
}
