import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Project, Settings } from '../api/types';
import type { FileSort } from '../lib/files';

type Theme = Settings['theme'];
export type SettingsCategory = 'library' | 'appearance' | 'projects' | 'tags' | 'backup' | 'about';
interface UIState {
  theme: Theme; sidebarCollapsed: boolean; tagsCollapsed: boolean; panelWidth: number;
  projectView: 'list' | 'kanban'; fileView: 'grid' | 'list';
  detailFileSort: FileSort;
  settingsCategory: SettingsCategory;
  commandOpen: boolean; newProjectOpen: boolean; newClientOpen: boolean;
  newProjectTemplate: Project | null;
  startProjectFrom: (project: Project) => void;
  setTheme: (theme: Theme) => void; toggleSidebar: () => void; toggleTags: () => void;
  setPanelWidth: (width: number) => void;
  setProjectView: (view: 'list' | 'kanban') => void; setFileView: (view: 'grid' | 'list') => void;
  setDetailFileSort: (sort: FileSort) => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  setCommandOpen: (open: boolean) => void; setNewProjectOpen: (open: boolean) => void; setNewClientOpen: (open: boolean) => void;
}
export const useUI = create<UIState>()(persist((set) => ({
  theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, panelWidth: 620,
  projectView: 'list', fileView: 'grid', commandOpen: false, newProjectOpen: false, newClientOpen: false,
  detailFileSort: 'modified-desc',
  newProjectTemplate: null,
  startProjectFrom: project => set({ newProjectTemplate: project, newProjectOpen: true }),
  settingsCategory: 'library',
  setTheme: theme => set({ theme }), toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTags: () => set(s => ({ tagsCollapsed: !s.tagsCollapsed })),
  setPanelWidth: width => set({ panelWidth: Math.max(520, Math.min(900, width)) }),
  setProjectView: projectView => set({ projectView }), setFileView: fileView => set({ fileView }),
  setDetailFileSort: detailFileSort => set({ detailFileSort }),
  setSettingsCategory: settingsCategory => set({ settingsCategory }),
  setCommandOpen: commandOpen => set({ commandOpen }),
  setNewProjectOpen: newProjectOpen => set(state => newProjectOpen && state.newProjectOpen ? state : { newProjectOpen, newProjectTemplate: null }),
  setNewClientOpen: newClientOpen => set({ newClientOpen }),
}), {
  name: 'clientdesk.ui.v1',
  partialize: s => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, tagsCollapsed: s.tagsCollapsed,
    panelWidth: s.panelWidth, projectView: s.projectView, fileView: s.fileView, detailFileSort: s.detailFileSort, settingsCategory: s.settingsCategory }),
}));

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
