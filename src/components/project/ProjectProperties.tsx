import type { Project } from '../../api/types';
import { useCreateTag, useSetProjectTags, useSettings, useTags, useUpdateProject } from '../../hooks/queries';
import { useNav } from '../../stores/nav';
import { Card, CopyButton, DateInput, InlineEdit, Select, TagPicker, TagPill } from '../ui';

export function ProjectProperties({ project }: { project: Project }) {
  const update = useUpdateProject(); const setTags = useSetProjectTags(); const createTag = useCreateTag();
  const { data: settings } = useSettings(); const { data: tags = [] } = useTags(); const navigate = useNav(state => state.navigate);
  const save = (patch: Parameters<typeof update.mutate>[0]['patch']) => update.mutate({ id: project.id, patch });
  const platforms = [...new Set([...(settings?.sourcePlatforms ?? []), project.sourcePlatform].filter(Boolean))];
  return <Card className="p-5"><dl className="grid grid-cols-2 gap-4">
    <div><dt className="mb-1.5 text-xs text-fg-2">截止日期</dt><dd><DateInput label="项目截止日期" value={project.dueDate} onChange={dueDate => save({ dueDate })} disabled={update.isPending} /></dd></div>
    <div><dt className="mb-1.5 text-xs text-fg-2">开始日期</dt><dd><DateInput label="项目开始日期" value={project.startDate} onChange={startDate => save({ startDate })} disabled={update.isPending} /></dd></div>
    <div><dt className="mb-1.5 text-xs text-fg-2">来源平台</dt><dd><Select label="项目来源平台" value={project.sourcePlatform || '__none'} onChange={sourcePlatform => save({ sourcePlatform: sourcePlatform === '__none' ? '' : sourcePlatform })} disabled={update.isPending} options={[{ value: '__none', label: '未设置' }, ...platforms.map(value => ({ value, label: value }))]} /></dd></div>
    <div><dt className="mb-1.5 text-xs text-fg-2">平台订单号</dt><dd className="flex items-center gap-1 rounded-md bg-subtle"><InlineEdit label="编辑平台订单号" value={project.sourceOrderNo} className="min-w-0 flex-1 truncate" placeholder="点击填写订单号" onSave={sourceOrderNo => update.mutateAsync({ id: project.id, patch: { sourceOrderNo: sourceOrderNo.trim() } })} />{project.sourceOrderNo && <CopyButton value={project.sourceOrderNo} label="复制平台订单号" />}</dd></div>
    <div className="col-span-2"><dt className="mb-1.5 text-xs text-fg-2">项目标签</dt><dd><TagPicker label="编辑项目标签" tags={tags} value={project.tagIds} onChange={tagIds => setTags.mutate({ projectId: project.id, tagIds })} onCreate={(name, color) => createTag.mutateAsync({ name, color })} />{project.tagIds.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{tags.filter(tag => project.tagIds.includes(tag.id)).map(tag => <button type="button" key={tag.id} aria-label={`筛选标签：${tag.name}`} onClick={() => navigate('projects', { tagId: tag.id })}><TagPill tag={tag} /></button>)}</div>}</dd></div>
  </dl></Card>;
}
