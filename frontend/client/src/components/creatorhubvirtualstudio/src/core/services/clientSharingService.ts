/**
 * Client Sharing Service
 * 
 * Handles sharing Virtual Studio projects with clients for review and approval.
 * 
 * Features:
 * - Generate shareable links (view-only)
 * - PIN protection
 * - Client comments
 * - Approval workflow
 * - Expiration dates
 */

// ============================================================================
// Types
// ============================================================================

export interface ShareLink {
  id: string;
  projectId: string;
  projectName: string;
  token: string;
  pin?: string;
  permissions: SharePermissions;
  expiresAt?: Date;
  createdAt: Date;
  createdBy: string;
  accessCount: number;
  lastAccessedAt?: Date;
  isActive: boolean;
}

export interface SharePermissions {
  canView: boolean;
  canComment: boolean;
  canApprove: boolean;
  canDownload: boolean;
  canViewLighting: boolean;
  canViewCamera: boolean;
  canViewEquipment: boolean;
}

export interface ClientComment {
  id: string;
  shareLinkId: string;
  clientName?: string;
  clientEmail?: string;
  content: string;
  timestamp: Date;
  replyTo?: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: Date;
  // Optional attachment (screenshot annotation)
  annotation?: {
    imageData: string;
    position: { x: number; y: number };
  };
}

export interface ApprovalStatus {
  shareLinkId: string;
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested';
  clientName?: string;
  clientEmail?: string;
  feedback?: string;
  timestamp: Date;
}

export interface ShareAnalytics {
  shareLinkId: string;
  totalViews: number;
  uniqueVisitors: number;
  averageViewTime: number;
  deviceBreakdown: Record<string, number>;
  locationBreakdown: Record<string, number>;
}

// ============================================================================
// Service Implementation
// ============================================================================

class ClientSharingService {
  private apiBase = '/api/virtual-studio/sharing';

  // -------------------------------------------------------------------------
  // Share Link Management
  // -------------------------------------------------------------------------

  /**
   * Create a new share link for a project
   */
  async createShareLink(
    projectId: string,
    projectName: string,
    options: {
      permissions?: Partial<SharePermissions>;
      pin?: string;
      expiresIn?: number; // hours
    } = {}
  ): Promise<ShareLink> {
    const token = this.generateToken();
    const now = new Date();

    const shareLink: ShareLink = {
      id: `share_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      projectName,
      token,
      pin: options.pin,
      permissions: {
        canView: true,
        canComment: true,
        canApprove: true,
        canDownload: false,
        canViewLighting: true,
        canViewCamera: true,
        canViewEquipment: true,
        ...options.permissions,
      },
      expiresAt: options.expiresIn
        ? new Date(now.getTime() + options.expiresIn * 60 * 60 * 1000)
        : undefined,
      createdAt: now,
      createdBy: 'current_user', // Will be replaced with actual user
      accessCount: 0,
      isActive: true,
    };

    try {
      const response = await fetch(`${this.apiBase}/links`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(shareLink),
      });

      if (!response.ok) {
        throw new Error('Failed to create share link');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local share link storage', error);
      // Fallback to localStorage for offline support
      const links = this.getLocalShareLinks();
      links.push(shareLink);
      localStorage.setItem('vs_share_links', JSON.stringify(links));
      return shareLink;
    }
  }

  /**
   * Get all share links for a project
   */
  async getShareLinks(projectId: string): Promise<ShareLink[]> {
    try {
      const response = await fetch(`${this.apiBase}/links?projectId=${projectId}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch share links');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local share links', error);
      return this.getLocalShareLinks().filter((l) => l.projectId === projectId);
    }
  }

  /**
   * Validate a share link (for client access)
   */
  async validateShareLink(token: string, pin?: string): Promise<{
    valid: boolean;
    shareLink?: ShareLink;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.apiBase}/validate`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ token, pin }),
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.warn('Falling back to local share link validation', error);
      // Check local storage
      const links = this.getLocalShareLinks();
      const link = links.find((l) => l.token === token && l.isActive);

      if (!link) {
        return { valid: false, error: 'Link not found or expired' };
      }

      if (link.pin && link.pin !== pin) {
        return { valid: false, error: 'Invalid PIN' };
      }

      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        return { valid: false, error: 'Link has expired' };
      }

      // Update access count
      link.accessCount++;
      link.lastAccessedAt = new Date();
      localStorage.setItem('vs_share_links', JSON.stringify(links));

      return { valid: true, shareLink: link };
    }
  }

  /**
   * Revoke a share link
   */
  async revokeShareLink(linkId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/links/${linkId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.warn('Falling back to local share link revoke', error);
      const links = this.getLocalShareLinks();
      const index = links.findIndex((l) => l.id === linkId);
      if (index !== -1) {
        links[index].isActive = false;
        localStorage.setItem('vs_share_links', JSON.stringify(links));
        return true;
      }
      return false;
    }
  }

  /**
   * Update share link permissions
   */
  async updateShareLink(
    linkId: string,
    updates: Partial<ShareLink>
  ): Promise<ShareLink | null> {
    try {
      const response = await fetch(`${this.apiBase}/links/${linkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        throw new Error('Failed to update share link');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local share link update', error);
      const links = this.getLocalShareLinks();
      const index = links.findIndex((l) => l.id === linkId);
      if (index !== -1) {
        links[index] = { ...links[index], ...updates };
        localStorage.setItem('vs_share_links', JSON.stringify(links));
        return links[index];
      }
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // Comments
  // -------------------------------------------------------------------------

  /**
   * Add a client comment
   */
  async addComment(
    shareLinkId: string,
    content: string,
    options: {
      clientName?: string;
      clientEmail?: string;
      replyTo?: string;
      annotation?: ClientComment['annotation'];
    } = {}
  ): Promise<ClientComment> {
    const comment: ClientComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      shareLinkId,
      content,
      timestamp: new Date(),
      resolved: false,
      ...options,
    };

    try {
      const response = await fetch(`${this.apiBase}/comments`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(comment),
      });

      if (!response.ok) {
        throw new Error('Failed to add comment');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local comment storage', error);
      const comments = this.getLocalComments();
      comments.push(comment);
      localStorage.setItem('vs_client_comments', JSON.stringify(comments));
      return comment;
    }
  }

  /**
   * Get comments for a share link
   */
  async getComments(shareLinkId: string): Promise<ClientComment[]> {
    try {
      const response = await fetch(`${this.apiBase}/comments?shareLinkId=${shareLinkId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local comments', error);
      return this.getLocalComments().filter((c) => c.shareLinkId === shareLinkId);
    }
  }

  /**
   * Resolve a comment
   */
  async resolveComment(commentId: string, resolvedBy: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiBase}/comments/${commentId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolvedBy }),
      });

      return response.ok;
    } catch (error) {
      console.warn('Falling back to local comment resolution', error);
      const comments = this.getLocalComments();
      const index = comments.findIndex((c) => c.id === commentId);
      if (index !== -1) {
        comments[index].resolved = true;
        comments[index].resolvedBy = resolvedBy;
        comments[index].resolvedAt = new Date();
        localStorage.setItem('vs_client_comments', JSON.stringify(comments));
        return true;
      }
      return false;
    }
  }

  // -------------------------------------------------------------------------
  // Approval Workflow
  // -------------------------------------------------------------------------

  /**
   * Submit approval/rejection
   */
  async submitApproval(
    shareLinkId: string,
    status: ApprovalStatus['status'],
    options: {
      clientName?: string;
      clientEmail?: string;
      feedback?: string;
    } = {}
  ): Promise<ApprovalStatus> {
    const approval: ApprovalStatus = {
      shareLinkId,
      status,
      timestamp: new Date(),
      ...options,
    };

    try {
      const response = await fetch(`${this.apiBase}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify(approval),
      });

      if (!response.ok) {
        throw new Error('Failed to submit approval');
      }

      return await response.json();
    } catch (error) {
      console.warn('Falling back to local approval storage', error);
      const approvals = this.getLocalApprovals();
      approvals.push(approval);
      localStorage.setItem('vs_approvals', JSON.stringify(approvals));
      return approval;
    }
  }

  /**
   * Get approval status for a share link
   */
  async getApprovalStatus(shareLinkId: string): Promise<ApprovalStatus | null> {
    try {
      const response = await fetch(`${this.apiBase}/approvals?shareLinkId=${shareLinkId}`);

      if (!response.ok) {
        throw new Error('Failed to fetch approval status');
      }

      const approvals = await response.json();
      return approvals.length > 0 ? approvals[approvals.length - 1] : null;
    } catch (error) {
      console.warn('Falling back to local approval state', error);
      const approvals = this.getLocalApprovals().filter((a) => a.shareLinkId === shareLinkId);
      return approvals.length > 0 ? approvals[approvals.length - 1] : null;
    }
  }

  // -------------------------------------------------------------------------
  // URL Generation
  // -------------------------------------------------------------------------

  /**
   * Generate the full share URL
   */
  getShareUrl(token: string): string {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    return `${baseUrl}/studio/share/${token}`;
  }

  /**
   * Copy share URL to clipboard
   */
  async copyShareUrl(token: string): Promise<boolean> {
    const url = this.getShareUrl(token);
    try {
      await navigator.clipboard.writeText(url);
      return true;
    } catch (error) {
      console.warn('Clipboard API unavailable, falling back to legacy copy', error);
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      return true;
    }
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private generateToken(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let token = '';
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return token;
  }

  private getLocalShareLinks(): ShareLink[] {
    try {
      return JSON.parse(localStorage.getItem('vs_share_links') || '[]');
    } catch {
      return [];
    }
  }

  private getLocalComments(): ClientComment[] {
    try {
      return JSON.parse(localStorage.getItem('vs_client_comments') || '[]');
    } catch {
      return [];
    }
  }

  private getLocalApprovals(): ApprovalStatus[] {
    try {
      return JSON.parse(localStorage.getItem('vs_approvals') ||'[]');
    } catch {
      return [];
    }
  }
}

// Export singleton
export const clientSharingService = new ClientSharingService();
export default clientSharingService;
