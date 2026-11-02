import type { Snippet } from '../api/types';

/** A nonempty search intentionally spans all groups. */
export function filterSnippets(snippets: readonly Snippet[], groupId: string, query: string): Snippet[] {
  const search = query.trim().toLocaleLowerCase('zh-CN');
  return snippets.filter(snippet => search ? `${snippet.title}\n${snippet.body}`.toLocaleLowerCase('zh-CN').includes(search) : groupId === 'all' || snippet.groupId === groupId);
}
export const snippetGroupCount = (snippets: readonly Snippet[], groupId: string): number => snippets.filter(snippet => snippet.groupId === groupId).length;
