import { useEffect, useLayoutEffect, useRef, useState, type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ContextMenu, type MenuItem } from './Menus';

export interface TableColumn<T> { key: string; title: ReactNode; render: (row: T) => ReactNode; className?: string }
interface TableProps<T> {
  rows: T[]; columns: TableColumn<T>[]; rowKey: (row: T) => string;
  onOpen?: (row: T) => void; selectedId?: string; onSelect?: (row: T) => void;
  contextMenu?: (row: T) => MenuItem[]; label?: string; empty?: ReactNode; compact?: boolean;
  rowProps?: (row: T) => HTMLAttributes<HTMLTableRowElement> & { 'data-drop-target'?: string };
  virtualized?: boolean; rowHeight?: number;
}
const headerHeight = 40; const overscan = 8;
export function Table<T>({ rows, columns, rowKey, onOpen, selectedId, onSelect, contextMenu, label = '数据列表', empty, compact = false, rowProps, virtualized = false, rowHeight = 48 }: TableProps<T>) {
  const [focused, setFocused] = useState(0); const [scrollTop, setScrollTop] = useState(0); const [viewportHeight, setViewportHeight] = useState(640);
  const container = useRef<HTMLDivElement>(null); const refs = useRef(new Map<number, HTMLTableRowElement>()); const pendingFocus = useRef<number | null>(null);
  const virtual = virtualized && rows.length > 100;
  const contentOffset = Math.max(0, scrollTop - headerHeight);
  const first = virtual ? Math.max(0, Math.floor(contentOffset / rowHeight) - overscan) : 0;
  const start = Math.min(first, Math.max(0, rows.length - 1));
  const end = virtual ? Math.min(rows.length, Math.ceil((contentOffset + viewportHeight) / rowHeight) + overscan) : rows.length;
  const tabStop = focused >= start && focused < end ? focused : start;
  useEffect(() => {
    const node = container.current; if (!node || !virtual) return;
    const measure = () => setViewportHeight(node.clientHeight || 640); measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure); observer.observe(node);
    return () => observer.disconnect();
  }, [virtual]);
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    const node = refs.current.get(pendingFocus.current);
    if (node) { pendingFocus.current = null; node.focus({ preventScroll: true }); }
  }, [focused, start, end]);
  useEffect(() => {
    // Filtering can shrink a scrolled list. Keep its new first records reachable.
    const node = container.current; if (!node) return;
    const maxScroll = virtual ? Math.max(0, rows.length * rowHeight + headerHeight - viewportHeight) : 0;
    if (node.scrollTop > maxScroll) { node.scrollTop = maxScroll; setScrollTop(maxScroll); }
  }, [rows.length, virtual, rowHeight, viewportHeight]);
  function focus(index: number) {
    const next = Math.max(0, Math.min(rows.length - 1, index)); setFocused(next); pendingFocus.current = next;
    if (virtual && container.current) {
      const node = container.current; const rowTop = headerHeight + next * rowHeight; const rowBottom = rowTop + rowHeight;
      const desired = rowTop < node.scrollTop + headerHeight ? next * rowHeight : rowBottom > node.scrollTop + viewportHeight ? rowBottom - viewportHeight : node.scrollTop;
      if (desired !== node.scrollTop) { node.scrollTop = desired; setScrollTop(desired); }
    }
    const node = refs.current.get(next);
    if (node) { pendingFocus.current = null; node.focus({ preventScroll: virtual }); }
    if (rows[next]) onSelect?.(rows[next]);
  }
  function spacer(height: number, key: string) {
    return height > 0 ? <tr key={key} aria-hidden="true"><td colSpan={columns.length} style={{ height, padding: 0, border: 0 }} /></tr> : null;
  }
  return <div ref={container} onScroll={event => { if (virtual) setScrollTop(event.currentTarget.scrollTop); }} className="max-h-[640px] overflow-auto rounded-lg border border-line bg-surface shadow-sm">
    <table aria-label={label} aria-rowcount={rows.length + 1} className="w-full border-collapse text-left text-sm">
      <thead className="sticky top-0 z-10 bg-subtle text-xs text-fg-2"><tr aria-rowindex={1}>{columns.map(column => <th scope="col" key={column.key} className={cn('h-10 border-b border-line px-3 font-medium', column.className)}>{column.title}</th>)}</tr></thead>
      <tbody>{virtual && spacer(start * rowHeight, 'before')}{rows.slice(start, end).map((row, visibleIndex) => {
        const index = start + visibleIndex; const id = rowKey(row);
        const element = <tr {...rowProps?.(row)} ref={node => { if (node) refs.current.set(index, node); else refs.current.delete(index); }} key={id} tabIndex={index === tabStop ? 0 : -1} aria-rowindex={index + 2} aria-selected={selectedId === id} style={virtual ? { height: rowHeight } : undefined}
          className={cn('cursor-pointer border-b border-line last:border-b-0 hover:bg-hover focus-visible:outline-offset-[-2px]', compact ? 'h-10' : 'h-12', selectedId === id && 'table-selected bg-primary-soft')}
          onFocus={() => setFocused(index)} onClick={() => { onSelect?.(row); onOpen?.(row); }} onKeyDown={event => {
            if (event.target !== event.currentTarget) return;
            if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focus(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)); }
            if (event.key === 'Enter') { event.preventDefault(); onOpen?.(row); }
          }}>{columns.map(column => <td key={column.key} className={cn('px-3', virtual ? 'py-0' : 'py-1', column.className)}>{virtual ? <div style={{ height: rowHeight - 1 }} className="flex items-center overflow-hidden"><div className="min-w-0 w-full">{column.render(row)}</div></div> : column.render(row)}</td>)}</tr>;
        return contextMenu ? <ContextMenu key={id} items={contextMenu(row)}>{element}</ContextMenu> : element;
      })}{virtual && spacer((rows.length - end) * rowHeight, 'after')}</tbody>
    </table>{!rows.length && (empty ?? <p className="p-8 text-center text-fg-2">暂无记录</p>)}
  </div>;
}
