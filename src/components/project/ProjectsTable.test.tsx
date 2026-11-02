import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '../../api/types';
import { createSeed } from '../../api/mock/seed';
import { ProjectsTable } from './ProjectsTable';

const template = createSeed('2026-11-02').projects[0];
const projects: Project[] = Array.from({ length: 360 }, (_, index) => ({ ...template, id: `large-${index}`, title: `大列表项目 ${index + 1}`, coverPath: null, tagIds: [] }));
beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }));
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('大项目列表虚拟化', () => {
  it('360个项目只渲染视口附近行，键盘可跨视口到首尾并打开', async () => {
    const open = vi.fn();
    render(<ProjectsTable projects={projects} tags={[]} onOpen={open} onPin={vi.fn()} menu={() => []} />);
    const table = screen.getByRole('table', { name: '项目列表' });
    expect(table.getAttribute('aria-rowcount')).toBe('361');
    const initial = within(table).getAllByRole('row').filter(row => row.hasAttribute('data-drop-target'));
    expect(initial.length).toBeLessThan(40); expect(initial.length).toBeGreaterThan(10);
    expect(initial[0].getAttribute('aria-rowindex')).toBe('2');
    act(() => initial[0].focus()); fireEvent.keyDown(initial[0], { key: 'End' });
    const last = await waitFor(() => {
      const row = document.querySelector<HTMLTableRowElement>('[data-drop-target="project:large-359"]');
      expect(row).toBeTruthy(); return row!;
    });
    expect(last.getAttribute('aria-rowindex')).toBe('361');
    expect(document.activeElement).toBe(last);
    expect(within(table).getAllByRole('row').length).toBeLessThan(42);
    fireEvent.keyDown(last, { key: 'Enter' }); expect(open).toHaveBeenCalledWith(projects[359]);
    fireEvent.keyDown(last, { key: 'Home' });
    await waitFor(() => expect(document.activeElement?.getAttribute('data-drop-target')).toBe('project:large-0'));
  });

  it('滚动后行仍有文件目标与菜单，筛选缩小时恢复可访问行', async () => {
    const open = vi.fn(); const props = { tags: [], onOpen: open, onPin: vi.fn(), menu: () => [] };
    const view = render(<ProjectsTable {...props} projects={projects} />);
    const table = screen.getByRole('table', { name: '项目列表' }); const scroll = table.parentElement;
    if (!scroll) throw new Error('缺少表格滚动容器');
    fireEvent.scroll(scroll, { target: { scrollTop: 48 * 180 } });
    await waitFor(() => expect(document.querySelector('[data-drop-target="project:large-180"]')).toBeTruthy());
    expect(document.querySelector('[data-drop-target="project:large-0"]')).toBeNull();
    view.rerender(<ProjectsTable {...props} projects={projects.slice(0, 3)} />);
    expect(scroll.scrollTop).toBe(0);
    const rows = within(table).getAllByRole('row').slice(1);
    expect(rows).toHaveLength(3);
    expect(rows[0].tabIndex).toBe(0);
    fireEvent.click(rows[0]); expect(open).toHaveBeenCalledWith(projects[0]);
  });
});
