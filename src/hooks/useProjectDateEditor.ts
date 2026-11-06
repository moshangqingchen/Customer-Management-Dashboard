import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Project } from '../api/types';
import { projectDateError } from '../lib/projectDraft';
import { useProject, useUpdateProject } from './queries';

type DateField = 'startDate' | 'dueDate';

export function useProjectDateEditor(projectId: Project['id']) {
  const queryClient = useQueryClient();
  const current = useProject(projectId);
  const update = useUpdateProject();
  const mutationKey = ['projectDateEdit', projectId] as const;
  const pending = useIsMutating({ mutationKey, exact: true }) > 0;
  const change = useMutation({
    mutationKey,
    mutationFn: async ({ field, value }: { field: DateField; value: string | null }) => {
      // Keep the shared lock while reading, validating and saving both endpoints.
      const result = await current.refetch();
      if (result.error) throw result.error;
      if (!result.data) throw new Error('项目暂不可用，请重新打开后再试。');
      const latest = result.data;
      const error = projectDateError(field === 'startDate' ? value : latest.startDate, field === 'dueDate' ? value : latest.dueDate);
      if (error) throw new Error(error);
      return update.mutateAsync({ id: projectId, patch: { [field]: value } });
    },
  });

  async function save(field: DateField, value: string | null) {
    // QueryClient sees pending mutations before React has rendered disabled buttons.
    if (queryClient.isMutating({ mutationKey, exact: true })) throw new Error('项目日期正在保存，请稍后再试。');
    return change.mutateAsync({ field, value });
  }

  return { pending, save };
}
