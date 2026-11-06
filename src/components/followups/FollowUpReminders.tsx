import { useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../../api/client';
import { useFollowUps } from '../../hooks/followUps';
import { createFollowUpNotifier } from '../../lib/followUps';
import { useNav } from '../../stores/nav';

export function FollowUpReminders() {
  const query = useFollowUps({ status: 'pending' }, true); const reportedError = useRef(false);
  const refetch = query.refetch;
  useEffect(() => {
    const refresh = () => { void refetch(); };
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [refetch]);
  const notify = useMemo(() => createFollowUpNotifier((id, revision) => api.followUps.claimReminder(id, revision), item => {
    toast(`跟进到期：${item.title}`, { id: `followup:${item.id}:${item.revision}`, description: item.clientName, duration: 10_000,
      action: { label: '查看客户', onClick: () => useNav.getState().navigate('clients', { clientId: item.clientId, clientTab: 'followups' }) } });
  }), []);
  useEffect(() => {
    if (!query.data) return;
    void notify(query.data).then(() => { reportedError.current = false; }).catch(() => {
      if (!reportedError.current) toast.error('跟进提醒暂时检查失败，稍后会自动重试。');
      reportedError.current = true;
    });
  }, [query.data, query.dataUpdatedAt, notify]);
  return null;
}
