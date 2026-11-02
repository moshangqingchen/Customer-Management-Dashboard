import { DndContext, KeyboardSensor, PointerSensor, closestCorners, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical, Paperclip } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Project, ProjectStatus, Tag } from '../../api/types';
import { boardStatuses, statusMeta } from '../../lib/status';
import { dayDifference } from '../../lib/dates';
import { cn } from '../../lib/cn';
import { colorClasses } from '../../lib/colors';
import { Avatar, DueChip, Money, PaymentBadge, StatusPill } from './Badges';
import { IconButton } from './Button';

function BoardCard({ project, children }: { project: Project; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: project.id, data: { status: project.status } });
  return <div ref={setNodeRef} data-drop-target={`project:${project.id}`} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${isDragging ? 1.02 : 1}) rotate(${isDragging ? 2 : 0}deg)` : undefined, transition }} className={cn('relative rounded-lg border border-line bg-surface p-4 shadow-sm card-interactive', isDragging && 'z-20 shadow-lg')}><IconButton {...attributes} {...listeners} label={`拖动项目：${project.title}`} size="sm" className="absolute top-1 right-0 touch-none"><GripVertical size={14} /></IconButton><div className="pr-4">{children}</div></div>;
}
function BoardColumn({ status, projects, renderCard }: { status: ProjectStatus; projects: Project[]; renderCard: (project: Project) => ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${status}`, data: { status } });
  return <section ref={setNodeRef} aria-label={statusMeta[status].label} className={cn('min-h-48 w-[270px] min-w-[260px] flex-1 rounded-lg border border-transparent bg-subtle/65 p-3 transition-colors', isOver && 'border-primary border-dashed bg-primary-soft')}><div className="mb-3 flex items-center justify-between gap-2 px-1 pt-1"><StatusPill status={status} /><span className="text-xs text-fg-2 tabular-nums">{projects.length}</span></div><p className="mb-3 px-1 text-xs text-fg-2"><Money cents={projects.reduce((sum, project) => sum + project.priceCents, 0)} /></p><SortableContext items={projects.map(project => project.id)} strategy={verticalListSortingStrategy}><div className="space-y-2">{projects.map(project => <BoardCard key={project.id} project={project}>{renderCard(project)}</BoardCard>)}</div></SortableContext>{projects.length === 0 && <p className="px-2 py-8 text-center text-xs text-fg-2">拖动项目到这里</p>}</section>;
}
function DefaultCard({ project, tags }: { project: Project; tags: Tag[] }) {
  return <><p className="font-medium">{project.title}</p><div className="mt-2 flex items-center gap-1.5 text-xs text-fg-2"><Avatar id={project.clientId} name={project.clientName} size="sm" /><span className="truncate">{project.clientName}</span></div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><DueChip date={project.dueDate} status={project.status} />{tags.filter(tag => project.tagIds.includes(tag.id)).map(tag => <span key={tag.id} aria-label={tag.name} title={tag.name} className={cn(colorClasses[tag.color], 'size-2 rounded-full bg-current')} />)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><Money cents={project.priceCents} /><PaymentBadge priceCents={project.priceCents} receivedCents={project.receivedCents} /><span className="ml-auto inline-flex items-center gap-1 text-fg-2" aria-label={`${project.fileCount} 个文件`}><Paperclip size={12} />{project.fileCount}</span></div></>;
}
export function Kanban({ projects, onStatusChange, renderCard, showAllDone = false, tags = [] }: { projects: Project[]; onStatusChange: (id: string, status: ProjectStatus) => void; renderCard?: (project: Project) => ReactNode; showAllDone?: boolean; tags?: Tag[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function drop({ active, over }: DragEndEvent) { if (!over) return; const status = over.data.current?.status as ProjectStatus | undefined; const project = projects.find(item => item.id === active.id); if (status && project && project.status !== status) onStatusChange(project.id, status); }
  return <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={drop} accessibility={{ screenReaderInstructions: { draggable: '按空格键开始拖动，使用方向键移动，再按空格键放下，Escape 取消。' }, announcements: { onDragStart: () => '已开始拖动项目', onDragOver: ({ over }) => over ? `移动到${statusMeta[over.data.current?.status as ProjectStatus]?.label ?? '项目位置'}` : '移出看板', onDragEnd: () => '已放下项目', onDragCancel: () => '已取消拖动' } }}><div className="flex items-start gap-4 overflow-x-auto pb-3">{boardStatuses.map(status => <BoardColumn key={status} status={status} projects={projects.filter(project => project.status === status && (status !== 'done' || showAllDone || !!project.completedAt && dayDifference(project.completedAt) >= -30))} renderCard={renderCard ?? (project => <DefaultCard project={project} tags={tags} />)} />)}</div></DndContext>;
}
