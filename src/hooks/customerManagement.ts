import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api/client';
import type { ClientMergeInput } from '../api/customerManagement';
import { queryKeys } from './queries';

export const customerManagementKeys = {
  all: ['customerManagement'] as const,
  states: ['customerManagement', 'states'] as const,
  preview: (sourceId: string, targetId: string) => ['customerManagement', 'preview', sourceId, targetId] as const,
};
export const useCustomerManagementStates = () => useQuery({ queryKey: customerManagementKeys.states, queryFn: () => api.customerManagement.states() });
export const useClientMergePreview = (sourceId: string, targetId: string, enabled: boolean) => useQuery({ queryKey: customerManagementKeys.preview(sourceId, targetId), queryFn: () => api.customerManagement.previewMerge(sourceId, targetId), enabled: enabled && !!targetId && sourceId !== targetId, refetchOnWindowFocus: false });
export function useArchiveClient() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ clientId, archived }: { clientId: string; archived: boolean }) => api.customerManagement.setArchived(clientId, archived),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async result => {
      await Promise.all([customerManagementKeys.all, queryKeys.clients, queryKeys.client(result.clientId), queryKeys.activities].map(queryKey => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
export function useMergeClients() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (input: ClientMergeInput) => api.customerManagement.merge(input),
    onError: (error: Error) => toast.error(error.message),
    onSuccess: async (target, input) => {
      queryClient.setQueryData(queryKeys.client(target.id), target);
      await queryClient.invalidateQueries({ queryKey: queryKeys.client(input.sourceId), refetchType: 'none' });
      await queryClient.invalidateQueries({ queryKey: customerManagementKeys.all, refetchType: 'none' });
      await Promise.all([customerManagementKeys.states, queryKeys.clients, queryKeys.projects, queryKeys.project(), queryKeys.allPayments, queryKeys.activities, queryKeys.tags, queryKeys.files, queryKeys.trash, ['followUps'], ['fileHistory']].map(queryKey => queryClient.invalidateQueries({ queryKey })));
    },
  });
}
