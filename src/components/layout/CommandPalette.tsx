import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { ArrowRight, Copy, FolderOpen, Moon, Plus, Search, Sun, Users, Wallet, Palette, Monitor } from 'lucide-react';
import { useClients, useMarkSnippetUsed, useOpenLibrary, useProjects, useSnippets, useUpdateSettings } from '../../hooks/queries';
import { useCopy } from '../../hooks/useCopy';
import { matchesSearch, searchScore } from '../../lib/search';
import { hasSnippetVariables } from '../../lib/snippets';
import { useUI } from '../../stores/ui';
import { useNav, pageLabels } from '../../stores/nav';
import { Dialog, Kbd } from '../ui';
import { primaryPages } from './Sidebar';

export function CommandPalette() {
  const ui = useUI(); const navigate = useNav(s => s.navigate); const [search, setSearch] = useState(''); const [paymentMode, setPaymentMode] = useState(false);
  const { data: clients = [] } = useClients(); const { data: projects = [] } = useProjects(); const { data: snippets = [] } = useSnippets();
  const openLibrary = useOpenLibrary(); const markUsed = useMarkSnippetUsed(); const updateSettings = useUpdateSettings(); const { copy } = useCopy();
  useEffect(() => { if (ui.commandOpen) { setSearch(''); setPaymentMode(false); } }, [ui.commandOpen]);
  const close = () => ui.setCommandOpen(false);
  const go = (action: () => void) => { close(); action(); };
  const theme = (value: 'light' | 'dark' | 'system') => go(() => { ui.setTheme(value); updateSettings.mutate({ theme: value }); });
  const commands = [
    { label: '新建项目', Icon: Plus, run: () => go(() => ui.setNewProjectOpen(true)), shortcut: 'Ctrl+N' },
    { label: '新建客户', Icon: Users, run: () => go(() => ui.setNewClientOpen(true)), shortcut: 'Ctrl+Shift+N' },
    { label: '记一笔收款', Icon: Wallet, run: () => { setPaymentMode(true); setSearch(''); }, shortcut: '' },
    ...primaryPages.map(({ page, icon }) => ({ label: `跳转${pageLabels[page]}`, Icon: icon, run: () => go(() => navigate(page)), shortcut: '' })),
    { label: '跳转设置', Icon: ArrowRight, run: () => go(() => navigate('settings')), shortcut: '' },
    { label: '切换浅色主题', Icon: Sun, run: () => theme('light'), shortcut: '' },
    { label: '切换深色主题', Icon: Moon, run: () => theme('dark'), shortcut: '' },
    { label: '主题跟随系统', Icon: Monitor, run: () => theme('system'), shortcut: '' },
    { label: '打开文件库', Icon: FolderOpen, run: () => go(() => openLibrary.mutate()), shortcut: '' },
    ...(import.meta.env.DEV ? [{ label: '设计系统', Icon: Palette, run: () => go(() => navigate('design-system')), shortcut: '' }] : []),
  ];
  const matchingProjects = projects.filter(p => matchesSearch(`${p.title} ${p.clientName}`, search)).sort((a, b) => searchScore(b.title, search) - searchScore(a.title, search));
  return <Dialog open={ui.commandOpen} onOpenChange={ui.setCommandOpen} title={paymentMode ? '选择收款项目' : '搜索与命令'} description="使用上下方向键选择，按回车执行。">
    <Command shouldFilter={false} label="搜索与命令" className="-mx-2">
      <div className="flex items-center gap-2 border-b border-line px-3 pb-3"><Search size={18} className="text-fg-2" />
        <Command.Input value={search} onValueChange={setSearch} placeholder={paymentMode ? '搜索要记收款的项目…' : '搜索客户、项目、话术或命令…'} className="h-9 flex-1 bg-transparent text-sm outline-none" aria-label="搜索客户、项目、话术或命令" />
      </div>
      <Command.List label="搜索结果" className="max-h-[420px] overflow-y-auto py-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-fg-2 [&_[cmdk-item]]:flex [&_[cmdk-item]]:cursor-pointer [&_[cmdk-item]]:items-center [&_[cmdk-item]]:gap-2 [&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-3 [&_[cmdk-item]]:py-2 [&_[cmdk-item][data-selected=true]]:bg-accent-soft [&_[cmdk-item][data-selected=true]]:text-accent">
        <Command.Empty className="px-3 py-10 text-center text-fg-2">没有找到相关内容</Command.Empty>
        {!paymentMode && <Command.Group heading="命令">{commands.filter(c => matchesSearch(c.label, search)).map(c => <Command.Item key={c.label} value={c.label} onSelect={c.run}><c.Icon size={16} /><span className="flex-1">{c.label}</span>{c.shortcut && <Kbd>{c.shortcut}</Kbd>}</Command.Item>)}</Command.Group>}
        <Command.Group heading="项目">{matchingProjects.slice(0, search ? 12 : 5).map(p => <Command.Item key={p.id} value={`project-${p.id}`} onSelect={() => go(() => navigate('projects', { projectId: p.id, ...(paymentMode ? { payment: true } : {}) }))}><FolderOpen size={16} /><span className="flex-1 truncate">{p.title}</span><span className="text-xs text-fg-2">{p.clientName}</span></Command.Item>)}</Command.Group>
        {!paymentMode && <><Command.Group heading="客户">{clients.filter(c => matchesSearch(`${c.name} ${c.company} ${c.phone} ${c.wechat}`, search)).slice(0, search ? 10 : 3).map(c => <Command.Item key={c.id} value={`client-${c.id}`} onSelect={() => go(() => navigate('clients', { clientId: c.id }))}><Users size={16} />{c.name}</Command.Item>)}</Command.Group>
          <Command.Group heading="话术 · 回车复制">{snippets.filter(s => matchesSearch(`${s.title} ${s.body}`, search)).slice(0, search ? 10 : 3).map(s => <Command.Item key={s.id} value={`snippet-${s.id}`} onSelect={() => { void copy(s.body, hasSnippetVariables(s.body) ? '已复制（含未填写的变量）' : '已复制').then(ok => { if (ok) { markUsed.mutate(s.id); close(); } }); }}><Copy size={16} />{s.title}</Command.Item>)}</Command.Group></>}
      </Command.List><div className="flex items-center gap-3 border-t border-line px-3 pt-3 text-xs text-fg-2"><span>↑↓ 选择</span><span>Enter 执行</span><span className="ml-auto">Esc 关闭</span></div>
    </Command>
  </Dialog>;
}
