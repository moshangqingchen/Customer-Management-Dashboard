import type { Snippet } from '../api/types';
import { formatDate, today, validDate } from './dates';
import { formatMoney } from './money';

export const snippetVariables = ['客户', '项目', '报价', '已收', '待收', '截止日'] as const;
export interface SnippetContext {
  clientName?: string | null; projectTitle?: string | null;
  priceCents?: number | null; receivedCents?: number | null; outstandingCents?: number | null;
  dueDate?: string | null; baseDate?: string;
}
const variablePattern = /\{(客户|项目|报价|已收|待收|截止日)\}/g;
export function hasSnippetVariables(body: string): boolean { return /\{(?:客户|项目|报价|已收|待收|截止日)\}/.test(body); }
export function fillSnippet(body: string, context: SnippetContext): string {
  const money = (value: number | null | undefined) => value !== null && value !== undefined && Number.isFinite(value) ? formatMoney(value) : undefined;
  const values: Record<typeof snippetVariables[number], string | null | undefined> = {
    客户: context.clientName, 项目: context.projectTitle, 报价: money(context.priceCents), 已收: money(context.receivedCents), 待收: money(context.outstandingCents),
    截止日: context.dueDate && validDate(context.dueDate) ? formatDate(context.dueDate, context.baseDate ?? today()) : undefined,
  };
  return body.replace(variablePattern, (placeholder: string, key: typeof snippetVariables[number]) => values[key] || placeholder);
}

/** A nonempty search intentionally spans all groups. */
export function filterSnippets(snippets: readonly Snippet[], groupId: string, query: string): Snippet[] {
  const search = query.trim().toLocaleLowerCase('zh-CN');
  return snippets.filter(snippet => search ? `${snippet.title}\n${snippet.body}`.toLocaleLowerCase('zh-CN').includes(search) : groupId === 'all' || snippet.groupId === groupId);
}
export const snippetGroupCount = (snippets: readonly Snippet[], groupId: string): number => snippets.filter(snippet => snippet.groupId === groupId).length;
