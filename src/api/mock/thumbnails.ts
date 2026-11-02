import { mockImage } from './store';

/** Missing concurrent illustration exports deliberately resolve to the file-type fallback. */
export function thumbnail(path: string): string {
  return mockImage(path) ?? '';
}
