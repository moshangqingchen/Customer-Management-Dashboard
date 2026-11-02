import { useState } from 'react';
import { MoreHorizontal, Plus, Sun, Moon, Monitor, BriefcaseBusiness, CalendarDays, Wallet, ChartNoAxesColumnIncreasing } from 'lucide-react';
import type { ProjectStatus } from '../api/types';
import { useCreateTag, useProjects, useRecentFiles, useSetProjectStatus, useTags } from '../hooks/queries';
import { dateOffset, today } from '../lib/dates';
import { statuses } from '../lib/status';
import { colorNames, tagColors } from '../lib/colors';
import { useUI } from '../stores/ui';
import { Illustration, type IllustrationKind } from '../components/illustrations';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, Combobox, ConfirmDialog, ContextMenu, CopyButton, DateInput, Dialog, DropdownMenu, DueChip, EmptyState, FileRow, FileTile, IconButton, InlineEdit, Input, Kanban, Kbd, Money, NumberInput, PaymentBadge, ProgressBar, Section, Select, SidePanel, Skeleton, StatusPill, StatusSelect, Table, Tabs, TagPicker, TagPill, Textarea, Tooltip, toast, undoToast, HeroBanner, StatCard, IconTile } from '../components/ui';
import { illustrationUrl } from '../components/ui/Illustration';
import { TokenGallery } from '../components/design/TokenGallery';

const illustrations: { kind: IllustrationKind; label: string }[] = [
  { kind: 'today', label: '今天无急事' }, { kind: 'projects', label: '无项目' }, { kind: 'clients', label: '无客户' }, { kind: 'files', label: '无文件' },
  { kind: 'snippets', label: '无话术' }, { kind: 'search', label: '搜索无结果' }, { kind: 'offline', label: '文件库离线' },
];
const colorTokens = [
  'bg-app', 'bg-sidebar', 'bg-surface', 'bg-subtle', 'bg-hover', 'bg-active', 'border', 'border-strong', 'text', 'text-2', 'text-3',
  'accent', 'accent-hover', 'accent-soft', 'accent-fg', 'focus-ring', 'overlay',
  ...['danger', 'warning', 'success', 'info', 'lead', 'delivered'].flatMap(name => ['fg', 'bg', 'border'].map(part => `${name}-${part}`)),
  ...tagColors.flatMap(color => [`tag-${color}`, `tag-${color}-bg`, `tag-${color}-solid`]),
];
export default function DesignSystemPage() {
  const ui = useUI(); const { data: tags = [] } = useTags(); const createTag = useCreateTag(); const { data: projects = [] } = useProjects(); const { data: files = [] } = useRecentFiles(); const statusMutation = useSetProjectStatus();
  const [name, setName] = useState('冬日品牌视觉提案'); const [amount, setAmount] = useState(128050); const [date, setDate] = useState<string | null>(today());
  const [status, setStatus] = useState<ProjectStatus>('active'); const [selectedTags, setSelectedTags] = useState<string[]>([]); const [choice, setChoice] = useState('a');
  const [customer, setCustomer] = useState('a'); const [customerOptions, setCustomerOptions] = useState([{ value: 'a', label: '林女士' }, { value: 'b', label: '山野咖啡' }]);
  const [tab, setTab] = useState('components'); const [dialog, setDialog] = useState(false); const [confirm, setConfirm] = useState(false); const [panel, setPanel] = useState(false); const [selectedRow, setSelectedRow] = useState<string>();
  const menuItems = [{ label: '复制名称', onSelect: () => toast.success('已复制示例名称') }, { label: '删除示例', onSelect: () => setConfirm(true), danger: true }];
  return <div className="space-y-6 p-8">
    <PageHeader title="设计系统" description="晴空 · 每一单，都被好好照顾 / 组件、状态与交互验收" actions={<div className="flex gap-1">{([{ value: 'light', label: '浅色', Icon: Sun }, { value: 'dark', label: '深色', Icon: Moon }, { value: 'system', label: '跟随系统', Icon: Monitor }] as const).map(t => <IconButton key={t.value} label={t.label} variant={ui.theme === t.value ? 'primary' : 'secondary'} onClick={() => ui.setTheme(t.value)}><t.Icon size={16} /></IconButton>)}</div>} />
    <Tabs value={tab} onChange={setTab} items={[
      { value: 'components', label: '基础组件', content: <div className="space-y-8">
        <Section title="晴空横幅与统计卡片"><HeroBanner image={illustrationUrl(ui.theme === 'dark' || ui.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches ? 'hero-night' : 'hero-afternoon')}><div className="space-y-4"><h2 className="hero-heading text-hero font-bold">下午好，<br />今天也闪闪发光</h2><p className="text-fg-2">让好想法，有一个舒展明亮的工作空间。</p><Button variant="primary" onClick={() => ui.setNewProjectOpen(true)}>新建项目</Button></div></HeroBanner><div className="mt-4 grid grid-cols-2 gap-4 xl:grid-cols-4">{[{ title: '进行中', value: '3', icon: <BriefcaseBusiness />, tone: 'violet' }, { title: '本周到期', value: '2', icon: <CalendarDays />, tone: 'sky' }, { title: '待收款', value: '¥1,280', icon: <Wallet />, tone: 'mint' }, { title: '本月收入', value: '¥8,640', icon: <ChartNoAxesColumnIncreasing />, tone: 'peach' }].map(item => <StatCard key={item.title} {...item} tone={item.tone as 'violet' | 'sky' | 'mint' | 'peach'} onClick={() => toast('已点击统计卡片')} />)}</div><Card className="mt-4 flex flex-wrap gap-4 p-5">{(['violet', 'sky', 'mint', 'peach', 'rose', 'amber'] as const).map(tone => <IconTile key={tone} tone={tone}><Sun size={22} /></IconTile>)}</Card></Section>
        <Section title="按钮与反馈"><Card className="flex flex-wrap items-center gap-3 p-5">{(['primary', 'secondary', 'ghost', 'soft', 'danger'] as const).map(variant => <Button key={variant} variant={variant} onClick={() => toast('按钮已响应')}>{({ primary: '主要操作', secondary: '次要操作', ghost: '轻量操作', soft: '柔和操作', danger: '删除操作' })[variant]}</Button>)}
          <Button size="sm">小按钮</Button><Button size="lg" icon={<Plus size={16} />}>大按钮</Button><Button disabled>不可用</Button><IconButton label="更多示例操作"><MoreHorizontal size={16} /></IconButton><Kbd>Ctrl+K</Kbd><CopyButton value="客户工作台" label="复制示例名称" />
          <Tooltip content="这里是工具提示"><Button variant="ghost">悬停查看提示</Button></Tooltip><Button onClick={() => undoToast('示例已移入回收站', () => { toast.success('已撤销示例操作'); })}>带撤销的提示</Button></Card></Section>
        <Section title="输入与就地编辑"><Card className="grid gap-5 p-5 md:grid-cols-2">
          <label className="space-y-2"><span>普通输入框</span><Input placeholder="输入客户名称" /></label><label className="space-y-2"><span>多行输入</span><Textarea placeholder="记录下一次合作的想法" rows={2} /></label>
          <div className="space-y-2"><p>就地编辑（回车保存 / Esc 取消）</p><InlineEdit label="编辑示例项目名称" value={name} onSave={setName} /></div>
          <div className="space-y-2"><p>金额输入 · 元转分</p><NumberInput aria-label="示例金额" value={amount} onChange={setAmount} /><p className="text-xs text-fg-2">内部整数分：{amount} · <Money cents={amount} /></p></div>
          <div className="space-y-2"><p>日期与快捷选项</p><DateInput value={date} onChange={setDate} /></div><div className="space-y-2"><p>状态选择</p><StatusSelect value={status} onChange={setStatus} /></div>
          <div className="space-y-2"><p>下拉选择</p><Select label="示例下拉选择" value={choice} onChange={setChoice} options={[{ value: 'a', label: '参考资料' }, { value: 'b', label: '过程稿' }, { value: 'c', label: '交付成品' }]} /></div>
          <div className="space-y-2"><p>可搜索 / 可创建选择</p><Combobox value={customer} onChange={setCustomer} options={customerOptions} onCreate={name => { setCustomerOptions(options => [...options, { value: name, label: name }]); toast.success(`已创建示例：${name}`); return name; }} /></div>
          <div className="space-y-2 md:col-span-2"><p>标签选择（真实 Mock 数据）</p><TagPicker tags={tags} value={selectedTags} onChange={setSelectedTags} onCreate={(name, color) => createTag.mutateAsync({ name, color })} /></div>
        </Card></Section>
        <Section title="状态、金额与头像"><Card className="space-y-5 p-5"><div className="flex flex-wrap gap-2">{statuses.map(s => <StatusPill key={s} status={s} />)}</div>
          <div className="flex flex-wrap gap-2">{(['unpaid', 'partial', 'paid', 'over'] as const).map(s => <PaymentBadge key={s} status={s} />)}<DueChip date={dateOffset(-2)} /><DueChip date={dateOffset(1)} /><DueChip date={dateOffset(14)} /><DueChip date={null} /></div>
          <div className="flex flex-wrap items-center gap-4"><Avatar id="lin" name="林女士" size="sm" /><Avatar id="shan" name="山野咖啡" /><Avatar id="momo" name="Momo" size="lg" /><Money cents={128000} /><Money cents={128050} /><Money cents={-30000} color /><Money cents={56000} color showSign /></div>
          <ProgressBar value={60} /><ProgressBar value={120} /><div className="flex flex-wrap gap-2">{tagColors.map(color => <TagPill key={color} color={color}>{colorNames[color]}</TagPill>)}</div></Card></Section>
        <Section title="弹层与菜单"><Card className="flex flex-wrap gap-3 p-5"><Button onClick={() => setDialog(true)}>打开弹窗</Button><Button onClick={() => setConfirm(true)}>二次确认</Button><Button onClick={() => setPanel(true)}>可拖宽侧面板</Button>
          <DropdownMenu items={menuItems}><Button>下拉菜单</Button></DropdownMenu><ContextMenu items={menuItems}><div tabIndex={0} className="rounded-md border border-dashed border-line-strong px-5 py-2">在此右键打开菜单</div></ContextMenu></Card></Section>
        <Section title="加载与空状态"><Card className="grid gap-6 p-5 md:grid-cols-2"><div className="space-y-3"><Skeleton className="size-12 rounded-full" /><Skeleton className="w-3/4" /><Skeleton className="w-1/2" /><Skeleton className="h-20" /></div><EmptyState illustration={<Illustration kind="search" />} title="没有找到相关内容" description="试试换个关键词" action={<Button onClick={() => toast('已清空示例筛选')}>清空筛选</Button>} /></Card></Section>
      </div> },
      { value: 'data', label: '表格、看板与文件', content: <div className="space-y-8"><Section title="表格 · ↑↓ 移动 / Enter 打开 / 右键菜单"><Table rows={projects.slice(0, 5)} rowKey={p => p.id} selectedId={selectedRow} onSelect={p => setSelectedRow(p.id)} onOpen={p => toast(p.title)} contextMenu={() => menuItems} columns={[{ key: 'name', title: '项目名称', render: p => p.title }, { key: 'status', title: '状态', render: p => <StatusPill status={p.status} /> }, { key: 'amount', title: '金额', render: p => <Money cents={p.priceCents} />, className: 'text-right' }]} /></Section>
        <Section title="看板 · 拖动或空格拾取后使用方向键"><Kanban projects={projects.slice(0, 8)} tags={tags} onStatusChange={(id, status) => statusMutation.mutate({ id, status })} /></Section>
        <Section title="文件卡片与文件行"><div className="grid grid-cols-2 gap-4 md:grid-cols-4">{files.slice(0, 4).map(file => <FileTile key={file.path} file={file} onOpen={() => toast(file.name)} context="山野咖啡 · 品牌视觉" contextMenu={menuItems} />)}</div><Card className="mt-4 divide-y divide-line">{files.slice(0, 3).map(file => <FileRow key={file.path} file={file} onOpen={() => toast(file.name)} contextMenu={menuItems} />)}</Card></Section></div> },
      { value: 'tokens', label: '颜色与插画', content: <div className="space-y-8"><Section title="主题颜色 Token"><div className="grid grid-cols-3 gap-3 md:grid-cols-5">{colorTokens.map(token => <Card key={token} className="overflow-hidden"><div className="h-14 border-b border-line" style={{ background: `var(--${token})` }} /><p className="break-words p-2 text-xs text-fg-2">--{token}</p></Card>)}</div></Section><TokenGallery />
        <Section title="七种空状态插画"><div className="grid grid-cols-2 gap-4 md:grid-cols-3">{illustrations.map(item => <Card key={item.kind} className="flex flex-col items-center p-4"><Illustration kind={item.kind} /><p className="text-fg-2">{item.label}</p></Card>)}</div></Section></div> },
    ]} />
    <Dialog open={dialog} onOpenChange={setDialog} title="一个安静的弹窗" description="支持 Esc、焦点约束与关闭后焦点还原。"><p className="mb-4 text-fg-2">在这里完成一件小事，然后回到工作。</p><Input aria-label="弹窗示例输入" placeholder="试试键盘 Tab" /><Button className="mt-4" variant="primary" onClick={() => setDialog(false)}>完成</Button></Dialog>
    <ConfirmDialog open={confirm} onOpenChange={setConfirm} title="删除这个示例？" description="示例操作可以撤销。" onConfirm={() => undoToast('示例已删除', () => { toast.success('已撤销'); })} />
    <SidePanel open={panel} onOpenChange={setPanel} title="可调整的详情面板" width={ui.panelWidth} onWidthChange={ui.setPanelWidth} onExpand={() => { toast('整页打开回调已触发'); setPanel(false); }}><p className="text-fg-2">拖动左边缘调整宽度，也可以聚焦边缘后使用左右方向键。</p><p className="mt-4 tabular-nums">当前宽度：{ui.panelWidth}px</p></SidePanel>
  </div>;
}
