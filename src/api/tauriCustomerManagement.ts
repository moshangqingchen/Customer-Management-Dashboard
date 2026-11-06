import { invoke } from '@tauri-apps/api/core';
import type { CustomerManagementApi } from './customerManagement';

export const tauriCustomerManagement: CustomerManagementApi = {
  states: () => invoke('customer_management_states'),
  setArchived: (clientId, archived) => invoke('customer_set_archived', { clientId, archived }),
  previewMerge: (sourceId, targetId) => invoke('customer_merge_preview', { sourceId, targetId }),
  merge: input => invoke('customer_merge', { input }),
};
