import { CalendarDays, CalendarPlus, Hash, ShoppingBag, Tags } from 'lucide-react';
import type { Project, ProjectPatch } from '../../api/types';
import { useCreateTag, useSetProjectTags, useSettings, useTags, useUpdateProject } from '../../hooks/queries';
import { CopyButton, TagPicker } from '../ui';
import { EditableProperty } from '../ui/EditableProperty';

export function ProjectProperties({ project }: { project: Project }) {
  const update = useUpdateProject(); const setTags = useSetProjectTags(); const createTag = useCreateTag();
  const { data: settings } = useSettings(); const { data: tags = [] } = useTags();
  const save = (patch: ProjectPatch) => update.mutateAsync({ id: project.id, patch });
  const platforms = [...new Set([...(settings?.sourcePlatforms ?? []), project.sourcePlatform].filter(Boolean))];
  return <div className="grid grid-cols-1 gap-x-3 gap-y-1 @min-[640px]:grid-cols-2">
    <EditableProperty icon={<CalendarPlus size={16} />} label="开始日期" editLabel="项目开始日期" type="date" value={project.startDate ?? ''} onSave={value => save({ startDate: value || null })} disabled={update.isPending} />
    <EditableProperty icon={<ShoppingBag size={16} />} label="来源平台" editLabel="项目来源平台" value={project.sourcePlatform} options={[{ value: '', label: '未设置' }, ...platforms.map(value => ({ value, label: value }))]} onSave={sourcePlatform => save({ sourcePlatform })} disabled={update.isPending} />
    <div className="flex min-w-0 items-center"><EditableProperty className="min-w-0 flex-1" icon={<Hash size={16} />} label="订单号" editLabel="编辑平台订单号" value={project.sourceOrderNo} onSave={value => save({ sourceOrderNo: value.trim() })} disabled={update.isPending} />{project.sourceOrderNo && <CopyButton value={project.sourceOrderNo} label="复制平台订单号" />}</div>
    <div className="mt-1 flex min-w-0 items-start gap-2 rounded-md px-2 py-1 hover:bg-hover @min-[640px]:col-span-2"><Tags size={16} aria-hidden className="mt-2.5 shrink-0 text-fg-2" /><span className="mt-2.5 w-16 shrink-0 text-xs text-fg-2">项目标签</span><div className="min-w-0 flex-1"><TagPicker label="编辑项目标签" tags={tags} value={project.tagIds} onChange={tagIds => setTags.mutate({ projectId: project.id, tagIds })} onCreate={(name, color) => createTag.mutateAsync({ name, color })} variant="inline" /></div></div>
  </div>;
}

export function ProjectDueDate({ project }: { project: Project }) {
  const update = useUpdateProject();
  return <EditableProperty className="w-52" icon={<CalendarDays size={14} />} label="截止日" editLabel="项目截止日期" type="date" value={project.dueDate ?? ''} onSave={value => update.mutateAsync({ id: project.id, patch: { dueDate: value || null } })} disabled={update.isPending} />;
}
