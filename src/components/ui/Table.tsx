import { useRef, useState, type ReactNode } from 'react';
import { cn } from '../../lib/cn';
import { ContextMenu, type MenuItem } from './Menus';

export interface TableColumn<T> { key: string; title: ReactNode; render: (row: T) => ReactNode; className?: string }
export function Table<T>({ rows, columns, rowKey, onOpen, selectedId, onSelect, contextMenu, label = '数据列表', empty }: { rows: T[]; columns: TableColumn<T>[]; rowKey: (row: T) => string; onOpen?: (row: T) => void; selectedId?: string; onSelect?: (row: T) => void; contextMenu?: (row: T) => MenuItem[]; label?: string; empty?: ReactNode }) {
  const [focused, setFocused] = useState(0); const refs = useRef<(HTMLTableRowElement | null)[]>([]);
  function focus(index: number) { const next = Math.max(0, Math.min(rows.length - 1, index)); setFocused(next); refs.current[next]?.focus(); if (rows[next]) onSelect?.(rows[next]); }
  return <div className="max-h-[640px] overflow-auto rounded-lg border border-line bg-surface shadow-sm"><table aria-label={label} className="w-full border-collapse text-left text-sm"><thead className="sticky top-0 z-10 bg-subtle text-xs text-fg-2"><tr>{columns.map(column => <th scope="col" key={column.key} className={cn('h-10 border-b border-line px-3 font-medium', column.className)}>{column.title}</th>)}</tr></thead><tbody>{rows.map((row, index) => {
    const id = rowKey(row);
    const element = <tr ref={node => { refs.current[index] = node; }} key={id} tabIndex={Math.min(focused, rows.length - 1) === index ? 0 : -1} aria-selected={selectedId === id} className={cn('h-12 cursor-pointer border-b border-line last:border-b-0 hover:bg-hover focus-visible:outline-offset-[-2px]', selectedId === id && 'table-selected bg-primary-soft')} onFocus={() => setFocused(index)} onClick={() => { onSelect?.(row); onOpen?.(row); }} onKeyDown={event => { if (event.target !== event.currentTarget) return; if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) { event.preventDefault(); focus(event.key === 'Home' ? 0 : event.key === 'End' ? rows.length - 1 : index + (event.key === 'ArrowDown' ? 1 : -1)); } if (event.key === 'Enter') { event.preventDefault(); onOpen?.(row); } }}>{columns.map(column => <td key={column.key} className={cn('px-3 py-1', column.className)}>{column.render(row)}</td>)}</tr>;
    return contextMenu ? <ContextMenu key={id} items={contextMenu(row)}>{element}</ContextMenu> : element;
  })}</tbody></table>{!rows.length && (empty ?? <p className="p-8 text-center text-fg-2">暂无记录</p>)}</div>;
}
