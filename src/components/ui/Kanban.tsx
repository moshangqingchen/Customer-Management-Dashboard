import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Paperclip } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import type { Project, ProjectStatus, Tag } from '../../api/types';
import { statusMeta } from '../../lib/status';
import { groupBoard, type BoardGroup } from '../../lib/projects';
import { cn } from '../../lib/cn';
import { Avatar, DueChip, Money, PaymentBadge, ProgressBar, StatusPill, TagPill } from './Badges';
import { ContextMenu, type MenuItem } from './Menus';
import { IconButton } from './Button';
import { ProjectCover } from '../project/ProjectCover';

function BoardCard({ project, children, onOpen, menu }: { project: Project; children: ReactNode; onOpen?: () => void; menu?: MenuItem[] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, data: { status: project.status } });
  const card = <div ref={setNodeRef} data-drop-target={`project:${project.id}`} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.02 : 1}) rotate(${isDragging ? 2 : 0}deg)` : undefined, transition }} className={cn('relative rounded-lg border border-line/60 bg-surface p-4 shadow-sm card-interactive', isDragging && 'z-20 shadow-lg')}>
    <IconButton {...attributes} {...listeners} label={`拖动项目：${project.title}`} size="sm" className="absolute top-2 right-1 touch-none"><GripVertical size={14} /></IconButton>
    <div role={onOpen ? 'button' : undefined} tabIndex={onOpen ? 0 : undefined} aria-label={onOpen ? `打开项目：${project.title}` : undefined} onClick={onOpen} onKeyDown={event => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onOpen?.(); } }}>{children}</div>
  </div>;
  return menu ? <ContextMenu items={menu}>{card}</ContextMenu> : card;
}
function BoardColumn({ group, renderCard, onOpen, contextMenu }: { group: BoardGroup; renderCard: (project: Project) => ReactNode; onOpen?: (project: Project) => void; contextMenu?: (project: Project) => MenuItem[] }) {
  const { status, projects, totalCents, hiddenCount } = group;
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { status } });
  return <section ref={setNodeRef} aria-label={statusMeta[status].label} className={cn('mx-1.5 min-h-64 min-w-0 rounded-lg border border-transparent bg-subtle/65 p-3 transition-colors', isOver && 'border-primary border-dashed bg-primary-soft')}>
    <div className="mb-2 flex items-center justify-between gap-2 px-1 pt-1"><StatusPill status={status} /><span className="rounded-full bg-surface/60 px-2 text-xs text-fg-2 tabular-nums">{projects.length}</span></div><p className="mb-4 px-1 text-xs text-fg-2">合计 <Money cents={totalCents} /></p>
    <SortableContext items={projects.map(project => project.id)} strategy={verticalListSortingStrategy}><div className="space-y-3">{projects.map(project => <BoardCard key={project.id} project={project} onOpen={onOpen ? () => onOpen(project) : undefined} menu={contextMenu?.(project)}>{renderCard(project)}</BoardCard>)}</div></SortableContext>
    {projects.length === 0 && <p className="px-2 py-8 text-center text-xs text-fg-2">拖动项目到这里</p>}{hiddenCount > 0 && <p className="pt-3 text-center text-xs text-fg-2">另有 {hiddenCount} 个较早完成的项目</p>}
  </section>;
}
function DefaultCard({ project, tags, onTagClick }: { project: Project; tags: Tag[]; onTagClick?: (id: string) => void }) {
  return <><p title={project.title} className="truncate pr-4 text-[15px] font-semibold">{project.title}</p><div className="mt-2 flex items-center gap-1.5 text-xs text-fg-2"><Avatar id={project.clientId} name={project.clientName} size="sm" /><span className="truncate">{project.clientName}</span></div>
    <div className="mt-3 flex flex-wrap gap-1">{tags.filter(tag => project.tagIds.includes(tag.id)).map(tag => <button type="button" key={tag.id} className="min-w-0 max-w-full" aria-label={`按标签筛选：${tag.name}`} onClick={event => { event.stopPropagation(); onTagClick?.(tag.id); }}><TagPill tag={tag} /></button>)}</div>
    <div className="mt-2"><DueChip date={project.dueDate} status={project.status} /></div><div className="mt-3 flex items-center justify-between gap-2"><Money cents={project.priceCents} className="text-lg font-semibold" /><span className="inline-flex items-center gap-1 text-xs text-fg-2" aria-label={`${project.fileCount} 个文件`}><Paperclip size={13} />{project.fileCount} 个文件</span></div>
    <div className="mt-2"><ProgressBar value={project.receivedCents} max={project.priceCents} /></div><p className="mt-1 text-xs text-fg-2">已收 <Money cents={project.receivedCents} /> / <Money cents={project.priceCents} /></p><div className="mt-2 flex flex-wrap gap-1"><PaymentBadge priceCents={project.priceCents} receivedCents={project.receivedCents} />{project.status === 'delivered' && project.receivedCents >= project.priceCents && <span className="rounded-full bg-primary-soft px-2 text-xs text-accent">可以标记完成</span>}</div>
    {project.coverPath && <ProjectCover project={project} className="mt-3 h-[132px] w-full" />}</>;
}
export function Kanban({ projects, onStatusChange, renderCard, showAllDone = false, tags = [], onOpen, contextMenu, onTagClick }: {
  projects: Project[]; onStatusChange: (id: string, status: ProjectStatus) => void; renderCard?: (project: Project) => ReactNode; showAllDone?: boolean; tags?: Tag[]; onOpen?: (project: Project) => void; contextMenu?: (project: Project) => MenuItem[]; onTagClick?: (id: string) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const groups = useMemo(() => groupBoard(projects, showAllDone), [projects, showAllDone]);
  function drop({ active, over }: DragEndEvent) { if (!over) return; const value = over.data.current?.status as ProjectStatus | undefined; const project = projects.find(item => item.id === active.id); if (value && project && project.status !== value) onStatusChange(project.id, value); }
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={drop} accessibility={{ screenReaderInstructions: { draggable: '按空格键开始拖动，使用方向键移动，再按空格键放下，Escape 取消。' }, announcements: { onDragStart: () => '已开始拖动项目', onDragOver: ({ over }) => over ? `移动到${statusMeta[over.data.current?.status as ProjectStatus]?.label ?? '项目位置'}` : '移出看板', onDragEnd: () => '已放下项目', onDragCancel: () => '已取消拖动' } }}><div className="overflow-x-auto pb-3"><div className="-mx-1.5 grid min-w-[1100px] grid-cols-5 items-start">{groups.map(group => <BoardColumn key={group.status} group={group} renderCard={renderCard ?? (project => <DefaultCard project={project} tags={tags} onTagClick={onTagClick} />)} onOpen={onOpen} contextMenu={contextMenu} />)}</div></div></DndContext>;
}
