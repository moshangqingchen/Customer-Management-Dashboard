import { useEffect, useRef, useState } from 'react';
import { thumbnail } from '../api/client';
import { useFileThumbnail } from './queries';

/** Shell handlers are only asked to work after their tile enters the viewport. */
export function useVisibleThumbnail(path: string | undefined, system: boolean, version = '') {
  const ref = useRef<HTMLDivElement>(null);
  const [visiblePath, setVisiblePath] = useState<string>();
  const [direct, setDirect] = useState<{ path: string; url: string }>();
  useEffect(() => {
    const element = ref.current;
    if (!element || !path) return;
    if (typeof IntersectionObserver === 'undefined') { setVisiblePath(path); return; }
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisiblePath(path); observer.disconnect(); }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [path]);
  const result = useFileThumbnail(path, 256, !!path && visiblePath === path && system, version);
  useEffect(() => {
    let active = true;
    if (path && !system) void thumbnail(path).then(url => { if (active) setDirect({ path, url }); }).catch(() => undefined);
    return () => { active = false; };
  }, [path, system, version]);
  return { ref, url: system ? result.data ?? undefined : direct && direct.path === path ? direct.url : undefined, unavailable: system && result.isFetched && !result.data };
}
