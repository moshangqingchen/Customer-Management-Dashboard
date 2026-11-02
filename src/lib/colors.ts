import type { TagColor } from '../api/types';
export const tagColors: TagColor[] = ['red', 'orange', 'amber', 'lime', 'green', 'teal', 'cyan', 'blue', 'violet', 'pink', 'gray'];
export const colorNames: Record<TagColor, string> = { red: '红', orange: '橙', amber: '琥珀', lime: '青柠', green: '绿', teal: '青绿', cyan: '青', blue: '蓝', violet: '紫', pink: '粉', gray: '灰' };
export const colorClasses: Record<TagColor, string> = {
  red: 'bg-tag-red-bg text-tag-red', orange: 'bg-tag-orange-bg text-tag-orange', amber: 'bg-tag-amber-bg text-tag-amber',
  lime: 'bg-tag-lime-bg text-tag-lime', green: 'bg-tag-green-bg text-tag-green', teal: 'bg-tag-teal-bg text-tag-teal',
  cyan: 'bg-tag-cyan-bg text-tag-cyan', blue: 'bg-tag-blue-bg text-tag-blue', violet: 'bg-tag-violet-bg text-tag-violet',
  pink: 'bg-tag-pink-bg text-tag-pink', gray: 'bg-tag-gray-bg text-tag-gray',
};
export function hashString(input: string): number { return [...input].reduce((hash, char) => (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0, 0); }
export const avatarColor = (id: string): TagColor => tagColors[hashString(id) % 10];
export const initial = (name: string) => [...name.trim()][0]?.toLocaleUpperCase('zh-CN') ?? '?';
