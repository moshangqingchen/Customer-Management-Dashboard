import { invoke } from '@tauri-apps/api/core';
import type { FollowUpsApi } from './followUps';

export const tauriFollowUps: FollowUpsApi = {
  list: filter => invoke('follow_ups_list', { filter: filter ?? {} }),
  create: input => invoke('follow_up_create', { input }),
  update: (id, patch) => invoke('follow_up_update', { id, patch }),
  setStatus: (id, status, result) => invoke('follow_up_set_status', { id, status, result: result ?? null }),
  claimReminder: (id, revision) => invoke('follow_up_claim_reminder', { id, revision }),
};
