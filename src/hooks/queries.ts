import { useMutation, useQuery, useQueryClient, type QueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api, type ActivityFilter, type GroupPatch, type NoteInput, type SnippetInput, type SnippetPatch, type TagPatch, type TrashType } from '../api/client';
import type { Activity, Client, ClientInput, ClientPatch, FileEntry, FileTarget, MutationResult, Payment, PaymentInput, PaymentPatch, Project, ProjectInput, ProjectPatch, ProjectStatus, Settings, TagColor } from '../api/types';
import { today } from '../lib/dates';

export const queryKeys = {
  app: ['app'] as const, library: ['library'] as const, clients: ['clients'] as const,
  client: (id?: string) => id ? ['client', id] as const : ['client'] as const,
  projects: ['projects'] as const, project: (id?: string) => id ? ['project', id] as const : ['project'] as const,
  payments: (id?: string) => id ? ['payments', id] as const : ['payments'] as const,
  allPayments: ['allPayments'] as const, tags: ['tags'] as const, activities: ['activities'] as const,
  activityList: (filter?: ActivityFilter) => ['activities', 'list', filter ?? {}] as const,
  recentActivities: (limit: number) => ['activities', 'recent', limit] as const,
  files: ['files'] as const, fileList: (target?: FileTarget, includeProjects = false) => ['files', 'list', target, includeProjects] as const,
  recentFiles: (limit: number) => ['files', 'recent', limit] as const,
  snippetGroups: ['snippetGroups'] as const, snippets: ['snippets'] as const, settings: ['settings'] as const,
  backups: ['backups'] as const, trash: ['trash'] as const,
};
export const useAppInfo = () => useQuery({ queryKey: queryKeys.app, queryFn: () => api.app.info() });
export const useLibraryStatus = () => useQuery({ queryKey: queryKeys.library, queryFn: () => api.library.status() });
export const useClients = () => useQuery({ queryKey: queryKeys.clients, queryFn: () => api.clients.list() });
export const useClient = (id?: string) => useQuery({ queryKey: queryKeys.client(id), queryFn: () => api.clients.get(id!), enabled: !!id });
export const useProjects = () => useQuery({ queryKey: queryKeys.projects, queryFn: () => api.projects.list() });
export const useProject = (id?: string) => useQuery({ queryKey: queryKeys.project(id), queryFn: () => api.projects.get(id!), enabled: !!id });
export const usePayments = (projectId?: string) => useQuery({ queryKey: queryKeys.payments(projectId), queryFn: () => api.payments.list(projectId!), enabled: !!projectId });
export const useAllPayments = () => useQuery({ queryKey: queryKeys.allPayments, queryFn: () => api.payments.all() });
export const useTags = () => useQuery({ queryKey: queryKeys.tags, queryFn: () => api.tags.list() });
export const useActivities = (filter?: ActivityFilter) => useQuery({ queryKey: queryKeys.activityList(filter), queryFn: () => api.activities.list(filter) });
export const useRecentActivities = (limit = 10) => useQuery({ queryKey: queryKeys.recentActivities(limit), queryFn: () => api.activities.recent(limit) });
export const useFiles = (target?: FileTarget, includeProjects = false) => useQuery({ queryKey: queryKeys.fileList(target, includeProjects), queryFn: () => api.files.list(target!, includeProjects), enabled: !!target, refetchOnWindowFocus: 'always' });
export const useRecentFiles = (limit = 100) => useQuery({ queryKey: queryKeys.recentFiles(limit), queryFn: () => api.files.recent(limit), refetchOnWindowFocus: 'always' });
export const useSnippetGroups = () => useQuery({ queryKey: queryKeys.snippetGroups, queryFn: () => api.snippetGroups.list() });
export const useSnippets = () => useQuery({ queryKey: queryKeys.snippets, queryFn: () => api.snippets.list() });
export const useSettings = () => useQuery({ queryKey: queryKeys.settings, queryFn: () => api.settings.get() });
export const useBackups = () => useQuery({ queryKey: queryKeys.backups, queryFn: () => api.backups.list() });
export const useTrash = () => useQuery({ queryKey: queryKeys.trash, queryFn: () => api.trash.list() });

const invalidate = (queryClient: QueryClient, keys: readonly QueryKey[]) => Promise.all(keys.map(queryKey => queryClient.invalidateQueries({ queryKey })));
const errorToast = (error: Error) => toast.error(error.message || '操作失败，请重试');
const warning = <T,>(result: MutationResult<T>) => {
  if (result.warning) toast.warning(result.warning.replace(/^folderRenameFailed[：:]?\s*/, '文件夹重命名失败：'));
};
const projectClient = (queryClient: QueryClient, id: string) => queryClient.getQueryData<Project>(queryKeys.project(id))?.clientId ?? queryClient.getQueryData<Project[]>(queryKeys.projects)?.find(project => project.id === id)?.clientId;
const projectKeys = (queryClient: QueryClient, id?: string, clientId?: string): QueryKey[] => [queryKeys.projects, queryKeys.project(id), queryKeys.clients, queryKeys.client(clientId ?? (id ? projectClient(queryClient, id) : undefined)), queryKeys.activities, queryKeys.tags];
const clientProjectKeys = (q: QueryClient, clientId: string): QueryKey[] => {
  const projects = [...(q.getQueryData<Project[]>(queryKeys.projects) ?? []), ...q.getQueriesData<Project>({ queryKey: queryKeys.project() }).flatMap(([, value]) => value ? [value] : [])];
  return [...new Set(projects.filter(project => project.clientId === clientId).map(project => project.id))].map(id => queryKeys.project(id));
};
function useAction<A, R>(action: (args: A) => Promise<R>, keys: (queryClient: QueryClient, result: R, args: A) => QueryKey[] = () => []) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: action, onError: errorToast, onSuccess: (result, args) => invalidate(queryClient, keys(queryClient, result, args)) });
}
export const useCreateClient = () => useAction((input: ClientInput) => api.clients.create(input), () => [queryKeys.clients, queryKeys.tags]);
export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ClientPatch }) => api.clients.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: queryKeys.clients }), queryClient.cancelQueries({ queryKey: queryKeys.client(id) })]);
      const list = queryClient.getQueryData<Client[]>(queryKeys.clients); const detail = queryClient.getQueryData<Client>(queryKeys.client(id));
      if (patch.pinned !== undefined) {
        queryClient.setQueryData<Client[]>(queryKeys.clients, old => old?.map(client => client.id === id ? { ...client, pinned: patch.pinned! } : client));
        if (detail) queryClient.setQueryData(queryKeys.client(id), { ...detail, pinned: patch.pinned });
      }
      return { list, detail };
    },
    onError: (error, { id }, context) => { queryClient.setQueryData(queryKeys.clients, context?.list); queryClient.setQueryData(queryKeys.client(id), context?.detail); errorToast(error); },
    onSuccess: warning,
    onSettled: (_data, _error, { id, patch }) => invalidate(queryClient, [queryKeys.clients, queryKeys.client(id),
      ...(patch.name !== undefined || patch.renameFolder ? [queryKeys.projects, ...clientProjectKeys(queryClient, id)] : []),
      ...(patch.name !== undefined ? [queryKeys.allPayments, queryKeys.activities] : []), ...(patch.renameFolder ? [queryKeys.files] : [])]),
  });
}
export const useDeleteClient = () => useAction((id: string) => api.clients.delete(id), (_q, _r, id) => [queryKeys.clients, queryKeys.client(id), queryKeys.projects, queryKeys.project(), queryKeys.allPayments, queryKeys.activities, queryKeys.tags, queryKeys.trash, queryKeys.files]);
export const useSetClientTags = () => useAction(({ clientId, tagIds }: { clientId: string; tagIds: string[] }) => api.clients.setTags(clientId, tagIds), (_q, _r, a) => [queryKeys.clients, queryKeys.client(a.clientId), queryKeys.tags]);
export const useCreateProject = () => useAction((input: ProjectInput) => api.projects.create(input), (q, result) => projectKeys(q, result.id, result.clientId));
export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ProjectPatch }) => api.projects.update(id, patch),
    onMutate: async ({ id, patch }) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: queryKeys.projects }), queryClient.cancelQueries({ queryKey: queryKeys.project(id) })]);
      const list = queryClient.getQueryData<Project[]>(queryKeys.projects); const detail = queryClient.getQueryData<Project>(queryKeys.project(id));
      if (patch.pinned !== undefined) {
        queryClient.setQueryData<Project[]>(queryKeys.projects, old => old?.map(project => project.id === id ? { ...project, pinned: patch.pinned! } : project));
        if (detail) queryClient.setQueryData(queryKeys.project(id), { ...detail, pinned: patch.pinned });
      }
      return { list, detail, previousClientId: detail?.clientId ?? list?.find(project => project.id === id)?.clientId };
    },
    onError: (error, { id }, context) => { queryClient.setQueryData(queryKeys.projects, context?.list); queryClient.setQueryData(queryKeys.project(id), context?.detail); errorToast(error); },
    onSuccess: warning,
    onSettled: (data, _error, { id }, context) => invalidate(queryClient, [...projectKeys(queryClient, id, data?.value.clientId), ...(context?.previousClientId ? [queryKeys.client(context.previousClientId)] : []), queryKeys.allPayments, queryKeys.files]),
  });
}
export function useSetProjectStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => api.projects.setStatus(id, status),
    onMutate: async ({ id, status }) => {
      await Promise.all([queryClient.cancelQueries({ queryKey: queryKeys.projects }), queryClient.cancelQueries({ queryKey: queryKeys.project(id) })]);
      const list = queryClient.getQueryData<Project[]>(queryKeys.projects); const detail = queryClient.getQueryData<Project>(queryKeys.project(id));
      const optimistic = (project: Project): Project => ({ ...project, status,
        deliveredAt: status === 'delivered' ? project.deliveredAt ?? today() : project.deliveredAt,
        completedAt: status === 'done' ? today() : null });
      queryClient.setQueryData<Project[]>(queryKeys.projects, old => old?.map(project => project.id === id ? optimistic(project) : project));
      if (detail) queryClient.setQueryData(queryKeys.project(id), optimistic(detail));
      return { list, detail };
    },
    onError: (error, { id }, context) => { queryClient.setQueryData(queryKeys.projects, context?.list); queryClient.setQueryData(queryKeys.project(id), context?.detail); errorToast(error); },
    onSuccess: project => {
      queryClient.setQueryData<Project[]>(queryKeys.projects, old => old?.map(value => value.id === project.id ? project : value));
      queryClient.setQueryData(queryKeys.project(project.id), project);
    },
    onSettled: (_data, _error, { id }) => invalidate(queryClient, projectKeys(queryClient, id)),
  });
}
export const useDuplicateProject = () => useAction((id: string) => api.projects.duplicate(id), (q, project) => projectKeys(q, project.id, project.clientId));
export const useDeleteProject = () => useAction((id: string) => api.projects.delete(id), (q, _r, id) => [...projectKeys(q, id), queryKeys.allPayments, queryKeys.payments(id), queryKeys.files, queryKeys.trash]);
export const useSetProjectTags = () => useAction(({ projectId, tagIds }: { projectId: string; tagIds: string[] }) => api.projects.setTags(projectId, tagIds), (_q, _r, a) => [queryKeys.projects, queryKeys.project(a.projectId), queryKeys.tags]);
const paymentKeys = (q: QueryClient, payment: Payment): QueryKey[] => [...projectKeys(q, payment.projectId), queryKeys.payments(payment.projectId), queryKeys.allPayments];
export const useAddPayment = () => useAction((input: PaymentInput) => api.payments.add(input), paymentKeys);
export const useUpdatePayment = () => useAction(({ id, patch }: { id: string; patch: PaymentPatch }) => api.payments.update(id, patch), paymentKeys);
export function useDeletePayment() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.payments.delete(id), onMutate: id => queryClient.getQueriesData<Payment[]>({ queryKey: queryKeys.payments() }).flatMap(([, payments]) => payments ?? []).find(payment => payment.id === id) ?? queryClient.getQueryData<Payment[]>(queryKeys.allPayments)?.find(payment => payment.id === id), onError: errorToast, onSuccess: (_r, _id, payment) => invalidate(queryClient, payment ? paymentKeys(queryClient, payment) : [queryKeys.projects, queryKeys.project(), queryKeys.clients, queryKeys.client(), queryKeys.payments(), queryKeys.allPayments, queryKeys.activities]) });
}
export const useCreateTag = () => useAction(({ name, color }: { name: string; color: TagColor }) => api.tags.create(name, color), () => [queryKeys.tags]);
export const useUpdateTag = () => useAction(({ id, patch }: { id: string; patch: TagPatch }) => api.tags.update(id, patch), () => [queryKeys.tags]);
const tagRelationKeys = (): QueryKey[] => [queryKeys.tags, queryKeys.projects, queryKeys.project(), queryKeys.clients, queryKeys.client()];
export const useDeleteTag = () => useAction((id: string) => api.tags.delete(id), tagRelationKeys);
export const useMergeTags = () => useAction(({ sourceId, targetId }: { sourceId: string; targetId: string }) => api.tags.merge(sourceId, targetId), tagRelationKeys);
export const useAddNote = () => useAction((input: NoteInput) => api.activities.addNote(input), (_q, result) => [queryKeys.activities, queryKeys.clients, queryKeys.client(result.clientId)]);
export const useUpdateNote = () => useAction(({ id, body }: { id: string; body: string }) => api.activities.updateNote(id, body), () => [queryKeys.activities]);
export function useDeleteActivity() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.activities.delete(id),
    onMutate: id => queryClient.getQueriesData<Activity[]>({ queryKey: queryKeys.activities }).flatMap(([, values]) => values ?? []).find(value => value.id === id),
    onError: errorToast,
    onSuccess: (_result, _id, activity) => invalidate(queryClient, [queryKeys.activities, queryKeys.clients, queryKeys.client(activity?.clientId)]),
  });
}
const fileKeys = (q: QueryClient, files: FileEntry[], target?: FileTarget): QueryKey[] => {
  const projectIds = [...new Set(files.flatMap(file => file.projectId ? [file.projectId] : []))];
  if (target && 'projectId' in target) projectIds.push(target.projectId);
  return [queryKeys.files, queryKeys.projects, queryKeys.clients, queryKeys.activities, ...projectIds.map(id => queryKeys.project(id)), ...projectIds.map(id => queryKeys.client(projectClient(q, id))), ...(target && 'clientId' in target ? [queryKeys.client(target.clientId)] : [])];
};
export const useAddFiles = () => useAction(({ target, sourcePaths, subfolder }: { target: FileTarget; sourcePaths: string[]; subfolder?: string }) => api.files.add(target, sourcePaths, subfolder), (q, files, a) => fileKeys(q, files, a.target));
export const usePickAndAddFiles = () => useAction(({ target, subfolder }: { target: FileTarget; subfolder?: string }) => api.files.pickAndAdd(target, subfolder), (q, files, a) => fileKeys(q, files, a.target));
export const useAddBrowserFiles = () => useAction(async ({ target, files, subfolder }: { target: FileTarget; files: { name: string; size: number }[]; subfolder?: string }) => (await import('../api/mock')).addBrowserFiles(target, files, subfolder), (q, files, a) => fileKeys(q, files, a.target));
export const useRenameFile = () => useAction(({ path, newName }: { path: string; newName: string }) => api.files.rename(path, newName), (_q, file) => [queryKeys.files, ...(file.projectId ? [queryKeys.project(file.projectId)] : [])]);
export const useTrashFile = () => useAction((path: string) => api.files.trash(path), () => [queryKeys.files, queryKeys.projects, queryKeys.project(), queryKeys.activities]);
export const useOpenFile = () => useAction((path: string) => api.files.open(path));
export const useRevealFile = () => useAction((path: string) => api.files.reveal(path));
export const useOpenFolder = () => useAction((target: FileTarget) => api.files.openFolder(target), (q, _r, target) => fileKeys(q, [], target));
export const useCreateSnippetGroup = () => useAction((name: string) => api.snippetGroups.create(name), () => [queryKeys.snippetGroups]);
export const useUpdateSnippetGroup = () => useAction(({ id, patch }: { id: string; patch: GroupPatch }) => api.snippetGroups.update(id, patch), () => [queryKeys.snippetGroups]);
export const useDeleteSnippetGroup = () => useAction((id: string) => api.snippetGroups.delete(id), () => [queryKeys.snippetGroups, queryKeys.snippets]);
export const useCreateSnippet = () => useAction((input: SnippetInput) => api.snippets.create(input), () => [queryKeys.snippets]);
export const useUpdateSnippet = () => useAction(({ id, patch }: { id: string; patch: SnippetPatch }) => api.snippets.update(id, patch), () => [queryKeys.snippets]);
export const useDeleteSnippet = () => useAction((id: string) => api.snippets.delete(id), () => [queryKeys.snippets]);
export const useMarkSnippetUsed = () => useAction((id: string) => api.snippets.markUsed(id), () => [queryKeys.snippets]);
export const useUpdateSettings = () => useAction((patch: Partial<Settings>) => api.settings.update(patch), () => [queryKeys.settings]);
export const useSetLibraryRoot = () => useAction((path: string) => api.library.setRoot(path), () => [queryKeys.library, queryKeys.files, queryKeys.projects, queryKeys.project()]);
export const usePickFolder = () => useAction((title?: string) => api.library.pickFolder(title));
export const useOpenLibrary = () => useAction(() => api.library.openRoot());
export const useCreateBackup = () => useAction(() => api.backups.create(), () => [queryKeys.backups]);
export function useRestoreBackup() { const q = useQueryClient(); return useMutation({ mutationFn: (fileName: string) => api.backups.restore(fileName), onError: errorToast, onSuccess: () => q.invalidateQueries() }); }
export const useRestoreTrash = () => useAction(({ type, id }: { type: TrashType; id: string }) => api.trash.restore(type, id), (q, _r, a) => [...(a.type === 'project' ? projectKeys(q, a.id) : [queryKeys.projects, queryKeys.project(), queryKeys.clients, queryKeys.client(a.id), queryKeys.activities, queryKeys.tags]), queryKeys.trash, queryKeys.allPayments, queryKeys.files]);
export const usePurgeTrash = () => useAction(({ type, id }: { type: TrashType; id: string }) => api.trash.purge(type, id), () => [queryKeys.trash, queryKeys.tags, queryKeys.activities]);
export const useSaveTextFile = () => useAction(({ defaultName, content }: { defaultName: string; content: string }) => api.app.saveTextFile(defaultName, content));
