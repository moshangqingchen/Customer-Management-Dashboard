import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Settings } from '../api/types';

type Theme = Settings['theme'];
export type SettingsCategory = 'library' | 'appearance' | 'projects' | 'tags' | 'backup' | 'about';
interface UIState {
  theme: Theme; sidebarCollapsed: boolean; tagsCollapsed: boolean; panelWidth: number;
  projectView: 'list' | 'kanban'; fileView: 'grid' | 'list';
  settingsCategory: SettingsCategory;
  commandOpen: boolean; newProjectOpen: boolean; newClientOpen: boolean;
  setTheme: (theme: Theme) => void; toggleSidebar: () => void; toggleTags: () => void;
  setPanelWidth: (width: number) => void;
  setProjectView: (view: 'list' | 'kanban') => void; setFileView: (view: 'grid' | 'list') => void;
  setSettingsCategory: (category: SettingsCategory) => void;
  setCommandOpen: (open: boolean) => void; setNewProjectOpen: (open: boolean) => void; setNewClientOpen: (open: boolean) => void;
}
export const useUI = create<UIState>()(persist((set) => ({
  theme: 'system', sidebarCollapsed: false, tagsCollapsed: false, panelWidth: 620,
  projectView: 'list', fileView: 'grid', commandOpen: false, newProjectOpen: false, newClientOpen: false,
  settingsCategory: 'library',
  setTheme: theme => set({ theme }), toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  toggleTags: () => set(s => ({ tagsCollapsed: !s.tagsCollapsed })),
  setPanelWidth: width => set({ panelWidth: Math.max(520, Math.min(900, width)) }),
  setProjectView: projectView => set({ projectView }), setFileView: fileView => set({ fileView }),
  setSettingsCategory: settingsCategory => set({ settingsCategory }),
  setCommandOpen: commandOpen => set({ commandOpen }), setNewProjectOpen: newProjectOpen => set({ newProjectOpen }),
  setNewClientOpen: newClientOpen => set({ newClientOpen }),
}), {
  name: 'clientdesk.ui.v1',
  partialize: s => ({ theme: s.theme, sidebarCollapsed: s.sidebarCollapsed, tagsCollapsed: s.tagsCollapsed,
    panelWidth: s.panelWidth, projectView: s.projectView, fileView: s.fileView, settingsCategory: s.settingsCategory }),
}));

export function applyTheme(theme: Theme): void {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
