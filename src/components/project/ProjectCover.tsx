import { Image } from 'lucide-react';
import { useState } from 'react';
import type { Project } from '../../api/types';
import { isTauri } from '../../api/client';
import { useVisibleThumbnail } from '../../hooks/useVisibleThumbnail';
import { fileKind } from '../../lib/files';
import { cn } from '../../lib/cn';

export function ProjectCover({ project, className }: { project: Project; className?: string }) {
  return <Cover key={project.coverPath} project={project} className={className} />;
}
function Cover({ project, className }: { project: Project; className?: string }) {
  const path = project.coverPath ?? undefined; const image = path ? fileKind(path) === 'image' : false;
  // Native covers always use capped Shell thumbnails, even for large images.
  const { ref, url, unavailable } = useVisibleThumbnail(path, isTauri || !image);
  const [failed, setFailed] = useState<string>();
  return <div ref={ref} className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-soft text-accent', className, path && !image && (unavailable || !!failed && failed === url) && 'hidden')}>{url && failed !== url ? <img src={url} alt={`${project.title}设计稿`} loading="lazy" onError={() => setFailed(url)} className="size-full object-cover" /> : <Image size={18} />}</div>;
}
