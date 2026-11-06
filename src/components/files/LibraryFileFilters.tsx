import { Search } from 'lucide-react';
import type { Client, FileKind, Project } from '../../api/types';
import type { RecentFileFilters } from '../../lib/recentFiles';
import { fileKindLabels } from '../../lib/files';
import { Button, Input, Select } from '../ui';

export function LibraryFileFilters({ filters, clients, projects, onChange, onClear }: {
  filters: RecentFileFilters; clients: Client[]; projects: Project[];
  onChange: (filters: RecentFileFilters) => void; onClear: () => void;
}) {
  const filtered = Object.values(filters).some(Boolean);
  const projectOptions = projects.filter(project => !filters.clientId || project.clientId === filters.clientId);
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative min-w-56 flex-1"><Search size={17} className="absolute top-3 left-3 text-fg-2" /><Input data-page-search aria-label="搜索文件名" placeholder="搜索全库文件名或路径…" value={filters.query ?? ''} className="pl-9" onChange={event => onChange({ ...filters, query: event.target.value })} /></div>
      <Select label="筛选文件类型" className="w-40" value={filters.kind ?? '__all__'} onChange={value => onChange({ ...filters, kind: value === '__all__' ? undefined : value as FileKind })} options={[{ value: '__all__', label: '全部文件类型' }, ...(Object.entries(fileKindLabels) as [FileKind, string][]).map(([value, label]) => ({ value, label }))]} />
      <Select label="筛选文件客户" className="w-40" value={filters.clientId || '__all__'} onChange={value => onChange({ ...filters, clientId: value === '__all__' ? undefined : value, projectId: undefined })} options={[{ value: '__all__', label: '全部客户' }, { value: '__unassigned__', label: '未归属客户' }, ...clients.map(client => ({ value: client.id, label: client.name }))]} />
      <Select label="筛选文件项目" className="w-44" value={filters.projectId || '__all__'} onChange={value => onChange({ ...filters, projectId: value === '__all__' ? undefined : value })} options={[{ value: '__all__', label: '全部项目及资料' }, ...(filters.clientId !== '__unassigned__' ? [{ value: '__client_files__', label: '仅客户资料' }] : []), ...projectOptions.map(project => ({ value: project.id, label: project.title }))]} />
      {filtered && <Button size="sm" variant="ghost" onClick={onClear}>清除筛选</Button>}
    </div>
    <details className="text-sm text-fg-2"><summary className="w-fit cursor-pointer rounded-sm">修改时间{filters.from || filters.to ? `：${filters.from || '不限'} 至 ${filters.to || '不限'}` : ''}</summary>
      <div className="mt-2 flex flex-wrap items-center gap-3"><label className="flex items-center gap-2">从<Input type="date" aria-label="文件修改开始日期" className="w-40" value={filters.from ?? ''} onChange={event => onChange({ ...filters, from: event.target.value })} /></label><label className="flex items-center gap-2">至<Input type="date" aria-label="文件修改结束日期" className="w-40" value={filters.to ?? ''} onChange={event => onChange({ ...filters, to: event.target.value })} /></label></div>
    </details>
  </div>;
}
