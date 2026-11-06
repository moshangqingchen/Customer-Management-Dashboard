import type { Client, ID } from './types';

export interface CustomerManagementState { clientId: ID; archivedAt: string | null; mergedInto: ID | null }
export interface ClientFolderAlias { folder: string; clientId: ID; sourceName: string }
export interface ClientMergeRecord { sourceClient: Client; previousTarget: Client; targetClientId: ID; mergedAt: string }
export interface ClientMergeConflict { field: string; label: string; sourceValue: string; targetValue: string }
export interface ClientMergePreview {
  source: Client; target: Client; projectCount: number; deletedProjectCount: number;
  paymentCount: number; activityCount: number; followUpCount: number;
  folders: string[]; conflicts: ClientMergeConflict[]; addedAccounts: number; tagCount: number;
  mergedNotes: string; previewToken: string;
}
export interface ClientMergeInput { sourceId: ID; targetId: ID; previewToken: string }
export interface CustomerManagementApi {
  states(): Promise<CustomerManagementState[]>;
  setArchived(clientId: ID, archived: boolean): Promise<CustomerManagementState>;
  previewMerge(sourceId: ID, targetId: ID): Promise<ClientMergePreview>;
  merge(input: ClientMergeInput): Promise<Client>;
}
