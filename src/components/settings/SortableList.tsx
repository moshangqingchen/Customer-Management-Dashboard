import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconButton } from '../ui/Button';
import { cn } from '../../lib/cn';

function Row({ id, label, children, disabled }: { id: string; label: string; children: ReactNode; disabled: boolean }) {
  const { setNodeRef, transform, transition, attributes, listeners, isDragging } = useSortable({ id, disabled });
  return <div ref={setNodeRef} style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, transition }} className={cn('relative flex min-w-0 items-center gap-1 rounded-md bg-surface', isDragging && 'z-10 shadow-md ring-1 ring-primary')}>
    <IconButton {...attributes} {...listeners} label={`拖动排序：${label}`} disabled={disabled} size="sm" className="touch-none"><GripVertical size={15} /></IconButton>
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}
export function SortableList({ items, onReorder, renderItem, disabled = false }: { items: { id: string; label: string }[]; onReorder: (ids: string[]) => void; renderItem: (id: string) => ReactNode; disabled?: boolean }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  function drop({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex(item => item.id === active.id); const newIndex = items.findIndex(item => item.id === over.id);
    if (oldIndex >= 0 && newIndex >= 0) onReorder(arrayMove(items.map(item => item.id), oldIndex, newIndex));
  }
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={drop} accessibility={{ screenReaderInstructions: { draggable: '按空格开始排序，方向键移动，空格确认，Escape 取消。' }, announcements: { onDragStart: () => '开始排序', onDragOver: ({ over }) => over ? `移动到${items.find(item => item.id === over.id)?.label ?? '新位置'}` : '移出列表', onDragEnd: () => '排序完成', onDragCancel: () => '已取消排序' } }}>
    <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}><div className="space-y-1">{items.map(item => <Row key={item.id} {...item} disabled={disabled}>{renderItem(item.id)}</Row>)}</div></SortableContext>
  </DndContext>;
}
