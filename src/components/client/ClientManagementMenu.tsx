import { useState } from 'react';
import { Archive, ArchiveRestore, Combine, MoreHorizontal, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Client } from '../../api/types';
import { useArchiveClient, useCustomerManagementStates } from '../../hooks/customerManagement';
import { formatMoney } from '../../lib/money';
import { useNav } from '../../stores/nav';
import { ConfirmDialog, DropdownMenu, IconButton } from '../ui';
import { MergeClientDialog } from './MergeClientDialog';

export function ClientManagementMenu({ client, onDelete }: { client: Client; onDelete: () => void }) {
  const [archiving, setArchiving] = useState(false); const [merging, setMerging] = useState(false);
  const management = useCustomerManagementStates(); const archive = useArchiveClient(); const navigate = useNav(state => state.navigate);
  const archived = management.data?.find(item => item.clientId === client.id)?.archivedAt != null;
  async function restore() {
    try { await archive.mutateAsync({ clientId: client.id, archived: false }); toast.success('已恢复到常用客户'); } catch { /* hook reports errors */ }
  }
  return <>
    {archived && <span className="shrink-0 text-xs text-fg-2">已归档</span>}
    <DropdownMenu label="客户更多操作" trigger={<IconButton label="客户更多操作"><MoreHorizontal size={18} /></IconButton>} items={[
      { label: archived ? '恢复客户' : '归档客户', icon: archived ? <ArchiveRestore size={16} /> : <Archive size={16} />, disabled: management.isPending || management.isError || archive.isPending, onSelect: () => { if (archived) void restore(); else setArchiving(true); } },
      { label: '合并到其他客户', icon: <Combine size={16} />, onSelect: () => setMerging(true) },
      { label: '删除客户', icon: <Trash2 size={16} />, danger: true, separator: true, onSelect: onDelete },
    ]} />
    <ConfirmDialog open={archiving} onOpenChange={setArchiving} danger={false} title={`归档客户「${client.name}」？`} description={`归档后从常用客户列表隐藏，可在「已归档」中恢复。${client.openProjectCount} 个未完成项目和 ${formatMoney(client.outstandingCents)} 待收款会继续显示，历史收入、文件与跟进保留。`} confirmLabel="归档客户" onConfirm={async () => { await archive.mutateAsync({ clientId: client.id, archived: true }); toast.success('客户已归档，项目和收款继续保留'); navigate('clients'); }} />
    {merging && <MergeClientDialog source={client} onClose={() => setMerging(false)} />}
  </>;
}
