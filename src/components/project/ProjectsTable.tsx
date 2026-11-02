import { memo, useMemo } from 'react';
import { Star } from 'lucide-react';
import type { Project, Tag } from '../../api/types';
import { ProjectCover } from './ProjectCover';
import { activityTime } from '../../lib/today';
import { useNav } from '../../stores/nav';
import { Avatar, DueChip, IconButton, Money, ProgressBar, StatusPill, Table, TagPill } from '../ui';
import type { MenuItem } from '../ui/Menus';
import type { TableColumn } from '../ui/Table';

export const ProjectsTable = memo(function ProjectsTable({ projects, tags, onOpen, onPin, menu, selectedId }: {
  projects: Project[]; tags: Tag[]; onOpen: (project: Project) => void; onPin: (project: Project) => void; menu: (project: Project) => MenuItem[]; selectedId?: string;
}) {
  const navigate = useNav(s => s.navigate);
  const columns = useMemo<TableColumn<Project>[]>(() => [
    { key: 'pin', title: '星标', className: 'w-10', render: project => <IconButton size="sm" label={`${project.pinned ? '取消' : '添加'}星标：${project.title}`} onClick={event => { event.stopPropagation(); onPin(project); }}><Star size={15} className={project.pinned ? 'fill-warning text-warning-fg' : 'text-fg-3'} /></IconButton> },
    { key: 'title', title: '项目 / 客户', className: 'min-w-[210px]', render: project => <div className="flex items-center gap-3"><ProjectCover project={project} className="size-10" /><div className="min-w-0"><p className="max-w-[250px] truncate font-medium">{project.title}</p><div className="flex items-center gap-1.5 text-xs text-fg-2"><Avatar id={project.clientId} name={project.clientName} size="sm" />{project.clientName}</div></div></div> },
    { key: 'status', title: '状态', render: project => <StatusPill status={project.status} /> },
    { key: 'tags', title: '标签', render: project => <div className="flex max-w-[180px] flex-wrap gap-1">{tags.filter(tag => project.tagIds.includes(tag.id)).map(tag => <button type="button" key={tag.id} aria-label={`按标签筛选：${tag.name}`} onClick={event => { event.stopPropagation(); navigate('projects', { tagId: tag.id }); }}><TagPill tag={tag} /></button>)}</div> },
    { key: 'due', title: '截止日', render: project => <DueChip date={project.dueDate} status={project.status} /> },
    { key: 'money', title: '报价', render: project => <Money cents={project.priceCents} className="font-semibold" /> },
    { key: 'received', title: '收款进度', className: 'min-w-[160px]', render: project => <div className="space-y-1"><ProgressBar value={project.receivedCents} max={project.priceCents} /><p className="text-xs text-fg-2"><Money cents={project.receivedCents} /> / <Money cents={project.priceCents} /></p></div> },
    { key: 'updated', title: '更新', className: 'whitespace-nowrap text-xs text-fg-2', render: project => activityTime(project.updatedAt) },
  ], [tags, onPin, navigate]);
  return <Table rows={projects} columns={columns} rowKey={project => project.id} onOpen={onOpen} contextMenu={menu} selectedId={selectedId} label="项目列表" compact virtualized rowHeight={48} rowProps={project => ({ 'data-drop-target': `project:${project.id}` })} />;
});
