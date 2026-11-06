import { describe, expect, it, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { tauriFollowUps } from './tauriFollowUps';

vi.mock('@tauri-apps/api/core', () => ({ invoke: vi.fn().mockResolvedValue(undefined) }));
describe('跟进桌面接口映射', () => {
  it('传入明确过滤器、可空项目和可空结果，提醒携带版本', async () => {
    await tauriFollowUps.list(); expect(invoke).toHaveBeenLastCalledWith('follow_ups_list', { filter: {} });
    await tauriFollowUps.update('f', { projectId: null }); expect(invoke).toHaveBeenLastCalledWith('follow_up_update', { id: 'f', patch: { projectId: null } });
    await tauriFollowUps.setStatus('f', 'pending'); expect(invoke).toHaveBeenLastCalledWith('follow_up_set_status', { id: 'f', status: 'pending', result: null });
    await tauriFollowUps.claimReminder('f', 3); expect(invoke).toHaveBeenLastCalledWith('follow_up_claim_reminder', { id: 'f', revision: 3 });
  });
});
