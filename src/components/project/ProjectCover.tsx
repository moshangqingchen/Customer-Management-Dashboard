import { useEffect, useState } from 'react';
import { Image } from 'lucide-react';
import type { Project } from '../../api/types';
import { isTauri, thumbnail } from '../../api/client';
import { cn } from '../../lib/cn';

export function ProjectCover({ project, className }: { project: Project; className?: string }) {
  const path = project.coverPath; const [resolved, setResolved] = useState<{ path: string; url: string }>(); const [failed, setFailed] = useState<string>();
  useEffect(() => { let active = true; if (path) { if (isTauri) void thumbnail(path).then(url => { if (active) setResolved({ path, url }); }).catch(() => { if (active) setFailed(path); }); else setResolved({ path, url: path }); } return () => { active = false; }; }, [path]);
  return <div className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary-soft text-accent', className)}>{path && failed !== path && resolved?.path === path ? <img src={resolved.url} alt={`${project.title}设计稿`} loading="lazy" onError={() => setFailed(path)} className="size-full object-cover" /> : <Image size={18} />}</div>;
}
