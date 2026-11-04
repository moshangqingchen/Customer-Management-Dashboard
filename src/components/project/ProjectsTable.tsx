import { memo, useMemo } from 'react';
import { Pin } from 'lucide-react';
import type { Project, Tag } from '../../api/types';
import { ProjectCover } from './ProjectCover';
import { formatDate } from '../../lib/dates';
import { colorClasses } from '../../lib/colors';
import { cn } from '../../lib/cn';
import { Avatar, DueChip, IconButton, Money, ProgressBar, StatusPill, Table } from '../ui';
import type { MenuItem } from '../ui/Menus';
import type { TableColumn } from '../ui/Table';

export const ProjectsTable = memo(function ProjectsTable({ projects, tags, onOpen, onPin, menu, selectedId }: {
  projects: Project[]; tags: Tag[]; onOpen: (project: Project) => void; onPin: (project: Project) => void; menu: (project: Project) => MenuItem[]; selectedId?: string;
}) {
  const columns = useMemo<TableColumn<Project>[]>(() => [
    { key: 'pin', title: <span className="sr-only">置顶</span>, className: 'w-10', render: project => <IconButton size="sm" label={`${project.pinned ? '取消' : '添加'}置顶：${project.title}`} aria-pressed={project.pinned} onClick={event => { event.stopPropagation(); onPin(project); }}><Pin size={15} className={project.pinned ? 'fill-current text-fg' : 'text-fg-3'} /></IconButton> },
    { key: 'title', title: '项目 / 客户', className: 'min-w-[210px]', render: project => <div className="flex items-center gap-3"><ProjectCover project={project} className="size-10" /><div className="min-w-0"><p className="max-w-[250px] truncate font-medium">{project.title}</p><div className="flex items-center gap-1.5 text-xs text-fg-2"><Avatar id={project.clientId} name={project.clientName} size="sm" />{project.clientName}</div></div></div> },
    { key: 'status', title: '状态', render: project => <StatusPill status={project.status} /> },
    { key: 'tags', title: '标签', render: project => { const selected = tags.filter(tag => project.tagIds.includes(tag.id)); return <div className="flex max-w-[180px] flex-wrap gap-x-2 gap-y-1">{selected.slice(0, 2).map(tag => <span key={tag.id} title={tag.name} className="inline-flex min-w-0 items-center gap-1 text-xs text-fg-2"><span className={cn(colorClasses[tag.color], 'bg-transparent')}><span className="block size-1.5 shrink-0 rounded-full bg-current" /></span><span className="max-w-20 truncate">{tag.name}</span></span>)}{selected.length > 2 && <span className="text-xs text-fg-2" title={selected.slice(2).map(tag => tag.name).join('、')}>+{selected.length - 2}</span>}</div>; } },
    { key: 'due', title: '截止日', render: project => <DueChip date={project.dueDate} status={project.status} /> },
    { key: 'money', title: '报价', render: project => <Money cents={project.priceCents} className="font-semibold" /> },
    { key: 'received', title: '收款进度', className: 'min-w-[160px]', render: project => <div className="space-y-1"><ProgressBar value={project.receivedCents} max={project.priceCents} /><p className="text-xs text-fg-2"><Money cents={project.receivedCents} /> / <Money cents={project.priceCents} /></p></div> },
    { key: 'updated', title: '更新', className: 'whitespace-nowrap text-xs text-fg-2', render: project => formatDate(project.updatedAt) },
  ], [tags, onPin]);
  return <Table rows={projects} columns={columns} rowKey={project => project.id} onOpen={onOpen} contextMenu={menu} selectedId={selectedId} label="项目列表" compact virtualized rowHeight={48} rowProps={project => ({ 'data-drop-target': `project:${project.id}` })} />;
});
