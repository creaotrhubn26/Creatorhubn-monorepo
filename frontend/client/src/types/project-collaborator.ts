/**
 * Project Collaborator Types
 * Shared type definitions for project collaborators across components
 */

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'not_sent' | 'sent' | 'updated';

export interface ProjectCollaborator {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  isExistingUser: boolean;
  userId?: string;
  profileImageUrl?: string;
  invitationStatus: InvitationStatus;
  addedBy: string;
  addedAt: string;
  organizationNumber?: string;
  companyName?: string;
  notes?: string;
  googleContactId?: string;
  source?: 'creatorhub' | 'google_contacts' | 'manual';
}
