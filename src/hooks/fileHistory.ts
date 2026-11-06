import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api/client';
import { queryKeys } from './queries';

export const fileHistoryKeys = { all: ['fileHistory'] as const, versions: (path?: string) => ['fileHistory', 'versions', path] as const, recycle: ['fileHistory', 'recycle'] as const };
export const useFileVersions = (path?: string, enabled = true) => useQuery({ queryKey: fileHistoryKeys.versions(path), queryFn: () => api.fileHistory.list(path), enabled, refetchOnWindowFocus: 'always' });
export const useRecycledFiles = () => useQuery({ queryKey: fileHistoryKeys.recycle, queryFn: () => api.fileHistory.trashList(), refetchOnWindowFocus: 'always' });
function useHistoryAction<A, R>(action: (args: A) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: action, onError: (error: Error) => toast.error(error.message), onSuccess: async () => {
    await Promise.all([fileHistoryKeys.all, queryKeys.files, queryKeys.projects, queryKeys.project(), queryKeys.clients, queryKeys.client(), queryKeys.activities].map(queryKey => queryClient.invalidateQueries({ queryKey })));
  } });
}
export const useSaveFileVersion = () => useHistoryAction(({ path, note }: { path: string; note: string }) => api.fileHistory.save(path, note));
export const useReplaceFileVersion = () => useHistoryAction(({ path, note }: { path: string; note: string }) => api.fileHistory.pickReplace(path, note));
export const useRestoreFileVersion = () => useHistoryAction((id: string) => api.fileHistory.restore(id));
export const useRestoreRecycledFile = () => useHistoryAction((id: string) => api.fileHistory.restoreTrash(id));
