import type { CustomerManagementState } from '../api/customerManagement';
import type { Client } from '../api/types';

export type ClientArchiveScope = 'current' | 'archived' | 'all';
export function filterArchivedClients(clients: readonly Client[], states: readonly CustomerManagementState[], scope: ClientArchiveScope): Client[] {
  const indexed = new Map(states.map(item => [item.clientId, item]));
  return clients.filter(client => {
    const status = indexed.get(client.id);
    if (status?.mergedInto) return false;
    return scope === 'all' || (scope === 'archived' ? !!status?.archivedAt : !status?.archivedAt);
  });
}
