import { invoke } from '@tauri-apps/api/core';
import type { Api } from './client';
import type { FilesAddResult, Project } from './types';

export const tauriApi: Api = {
  app: { info: () => invoke('app_info'), saveTextFile: (defaultName, content) => invoke('save_text_file', { defaultName, content }) },
  library: {
    status: () => invoke('library_status'), setRoot: path => invoke('library_set_root', { path }),
    openRoot: () => invoke('library_open_root'), pickFolder: title => invoke('pick_folder', { title }),
  },
  clients: {
    list: () => invoke('clients_list'), get: id => invoke('client_get', { id }), create: input => invoke('client_create', { input }),
    update: (id, patch) => invoke('client_update', { id, patch }), delete: id => invoke('client_delete', { id }),
    setTags: (clientId, tagIds) => invoke('client_set_tags', { clientId, tagIds }),
  },
  projects: {
    list: () => invoke<Project[]>('projects_list'), get: id => invoke<Project>('project_get', { id }), create: input => invoke<Project>('project_create', { input }),
    update: (id, patch) => invoke('project_update', { id, patch }), setStatus: (id, status) => invoke<Project>('project_set_status', { id, status }),
    duplicate: id => invoke<Project>('project_duplicate', { id }), delete: id => invoke('project_delete', { id }),
    setTags: (projectId, tagIds) => invoke('project_set_tags', { projectId, tagIds }),
  },
  payments: {
    list: projectId => invoke('payments_list', { projectId }), all: () => invoke('payments_all'), add: input => invoke('payment_add', { input }),
    update: (id, patch) => invoke('payment_update', { id, patch }), delete: id => invoke('payment_delete', { id }),
  },
  tags: {
    list: () => invoke('tags_list'), create: (name, color) => invoke('tag_create', { name, color }),
    update: (id, patch) => invoke('tag_update', { id, patch }), delete: id => invoke('tag_delete', { id }),
    merge: (sourceId, targetId) => invoke('tag_merge', { sourceId, targetId }),
  },
  activities: {
    list: (filter = {}) => invoke('activities_list', filter), recent: limit => invoke('activities_recent', { limit }),
    addNote: input => invoke('activity_add_note', input), updateNote: (id, body) => invoke('activity_update_note', { id, body }),
    delete: id => invoke('activity_delete', { id }),
  },
  files: {
    list: (target, includeProjects) => invoke('files_list', { target, includeProjects }), recent: limit => invoke('files_recent', { limit }),
    add: (target, sourcePaths, subfolder) => invoke<FilesAddResult>('files_add', { target, sourcePaths, subfolder }),
    pickAndAdd: (target, subfolder) => invoke<FilesAddResult>('files_pick_and_add', { target, subfolder }),
    open: path => invoke('file_open', { path }), reveal: path => invoke('file_reveal', { path }),
    rename: (path, newName) => invoke('file_rename', { path, newName }), trash: path => invoke('file_trash', { path }),
    openFolder: target => invoke('folder_open', { target }),
  },
  snippetGroups: {
    list: () => invoke('snippet_groups_list'), create: name => invoke('snippet_group_create', { name }),
    update: (id, patch) => invoke('snippet_group_update', { id, patch }), delete: id => invoke('snippet_group_delete', { id }),
  },
  snippets: {
    list: () => invoke('snippets_list'), create: input => invoke('snippet_create', { input }),
    update: (id, patch) => invoke('snippet_update', { id, patch }), delete: id => invoke('snippet_delete', { id }),
    markUsed: id => invoke('snippet_mark_used', { id }),
  },
  settings: { get: () => invoke('settings_get'), update: patch => invoke('settings_update', { patch }) },
  backups: { list: () => invoke('backups_list'), create: () => invoke('backup_create'), restore: fileName => invoke('backup_restore', { fileName }) },
  trash: { list: () => invoke('trash_list'), restore: (type, id) => invoke('trash_restore', { type, id }), purge: (type, id) => invoke('trash_purge', { type, id }) },
};
