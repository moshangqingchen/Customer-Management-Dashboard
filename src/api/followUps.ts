export type FollowUpStatus = 'pending' | 'completed' | 'cancelled';
export interface FollowUp {
  id: string; clientId: string; clientName: string; projectId: string | null; projectTitle: string | null;
  projectAvailable: boolean; title: string; dueAt: string; notes: string; status: FollowUpStatus;
  result: string; completedAt: string | null; revision: number; remindedRevision: number | null;
  createdAt: string; updatedAt: string;
}
export interface FollowUpInput { clientId: string; projectId?: string | null; title: string; dueAt: string; notes?: string }
export type FollowUpPatch = Partial<Omit<FollowUpInput, 'clientId'>>;
export interface FollowUpFilter { clientId?: string; status?: FollowUpStatus }
export interface FollowUpsApi {
  list(filter?: FollowUpFilter): Promise<FollowUp[]>;
  create(input: FollowUpInput): Promise<FollowUp>;
  update(id: string, patch: FollowUpPatch): Promise<FollowUp>;
  setStatus(id: string, status: FollowUpStatus, result?: string): Promise<FollowUp>;
  claimReminder(id: string, revision: number): Promise<boolean>;
}
