import { Search } from 'lucide-react';
import type { Project } from '../../api/types';
import type { FileSort } from '../../lib/files';
import { Button, Input, Select } from '../ui';

const sortOptions: { value: FileSort; label: string }[] = [
  { value: 'modified-desc', label: '修改时间：最新优先' },
  { value: 'modified-asc', label: '修改时间：最早优先' },
  { value: 'name-asc', label: '文件名：A 到 Z' },
  { value: 'name-desc', label: '文件名：Z 到 A' },
];
interface FileSearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
  owner: string;
  onOwnerChange: (value: string) => void;
  sort: FileSort;
  onSortChange: (value: FileSort) => void;
  projects?: readonly Pick<Project, 'id' | 'title'>[];
  total: number;
  visible: number;
}

export function FileSearchBar({ query, onQueryChange, owner, onOwnerChange, sort, onSortChange, projects, total, visible }: FileSearchBarProps) {
  const filtered = !!query.trim() || !!owner;
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="查找已存文件">
    <div className="relative min-w-44 flex-1">
      <Search size={16} className="pointer-events-none absolute top-3 left-3 text-fg-2" />
      <Input aria-label="搜索文件名或目录" placeholder="搜索文件名或目录…" className="pl-9" value={query} onChange={event => onQueryChange(event.target.value)} />
    </div>
    {projects && <Select label="筛选文件归属" className="w-48 max-w-full" value={owner || '__all__'} onChange={value => onOwnerChange(value === '__all__' ? '' : value)} options={[
      { value: '__all__', label: '全部资料与项目' },
      { value: '__client__', label: '客户资料' },
      ...projects.map(project => ({ value: project.id, label: project.title })),
    ]} />}
    <Select label="文件排序" className="h-8 w-48 max-w-full text-sm" value={sort} options={sortOptions} onChange={value => {
      const option = sortOptions.find(option => option.value === value); if (option) onSortChange(option.value);
    }} />
    <span className="text-xs whitespace-nowrap text-fg-2" role="status">显示 {visible} / {total} 个文件</span>
    {filtered && <Button size="sm" variant="ghost" onClick={() => { onQueryChange(''); onOwnerChange(''); }}>清除文件筛选</Button>}
  </div>;
}
