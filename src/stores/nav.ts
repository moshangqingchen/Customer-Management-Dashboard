import { create } from 'zustand';
import type { ProjectStatus } from '../api/types';

export type Page = 'today' | 'projects' | 'clients' | 'income' | 'files' | 'snippets' | 'settings' | 'design-system';
export type RouteParams = { view?: 'pinned' | 'overdue' | 'outstanding'; statuses?: ProjectStatus[]; due?: 'week'; tagId?: string; projectId?: string; clientId?: string; payment?: boolean };
export type Route = { page: Page; params: RouteParams };
interface Navigation {
  entries: Route[]; index: number;
  navigate: (page: Page, params?: RouteParams) => void;
  back: () => void; forward: () => void;
}
export const useNav = create<Navigation>((set) => ({
  entries: [{ page: 'today', params: {} }], index: 0,
  navigate: (page, params = {}) => set(state => {
    const current = state.entries[state.index];
    if (current.page === page && JSON.stringify(current.params) === JSON.stringify(params)) return state;
    const entries = [...state.entries.slice(0, state.index + 1), { page, params }];
    return { entries, index: entries.length - 1 };
  }),
  back: () => set(state => ({ index: Math.max(0, state.index - 1) })),
  forward: () => set(state => ({ index: Math.min(state.entries.length - 1, state.index + 1) })),
}));

export const pageLabels: Record<Page, string> = {
  today: '今日', projects: '项目', clients: '客户', income: '收入', files: '文件',
  snippets: '话术', settings: '设置', 'design-system': '设计系统',
};
