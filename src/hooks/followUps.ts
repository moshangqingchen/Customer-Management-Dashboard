import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../api/client';
import type { FollowUp, FollowUpFilter, FollowUpInput, FollowUpPatch, FollowUpStatus } from '../api/followUps';

export const followUpKeys = { all: ['followUps'] as const, list: (filter: FollowUpFilter) => ['followUps', filter] as const };
export function useFollowUps(filter: FollowUpFilter = {}, poll = false) {
  return useQuery({ queryKey: followUpKeys.list(filter), queryFn: () => api.followUps.list(filter), refetchOnWindowFocus: 'always', refetchInterval: poll ? 60_000 : false, refetchIntervalInBackground: poll });
}
export function useFollowUpActions() {
  const query = useQueryClient();
  const refresh = (item: FollowUp) => Promise.all([
    query.invalidateQueries({ queryKey: followUpKeys.all }), query.invalidateQueries({ queryKey: ['activities'] }),
    query.invalidateQueries({ queryKey: ['clients'] }), query.invalidateQueries({ queryKey: ['client', item.clientId] }),
  ]);
  const onError = (error: Error) => toast.error(error.message || '跟进计划未能保存，请重试');
  const create = useMutation({ mutationFn: (input: FollowUpInput) => api.followUps.create(input), onSuccess: refresh, onError });
  const update = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: FollowUpPatch }) => api.followUps.update(id, patch), onSuccess: refresh, onError });
  const status = useMutation({ mutationFn: ({ id, status, result }: { id: string; status: FollowUpStatus; result?: string }) => api.followUps.setStatus(id, status, result), onSuccess: refresh, onError });
  return { create, update, status, pending: create.isPending || update.isPending || status.isPending };
}
