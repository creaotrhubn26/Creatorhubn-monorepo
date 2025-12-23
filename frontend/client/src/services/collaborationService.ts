/**
 * Collaboration Service for CreatorHub
 * Provides real-time collaboration features, team management, and shared workspace capabilities
 */

export interface CollaborationSession {
  sessionId: string;
  projectId: string;
  sessionName: string;
  participants: Participant[];
  startTime: string;
  endTime?: string;
  status: 'active' | 'paused' | 'ended';
  capabilities: CollaborationCapabilities;
  metadata?: Record<string, any>;
}

export interface Participant {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'editor' | 'viewer' | 'commenter';
  permissions: Permission[];
  avatar?: string;
  isOnline: boolean;
  lastSeen?: string;
  cursor?: CursorPosition;
  selectedElements?: string[], ;, 
}

export interface Permission {
  action: 'read' | 'write' | 'delete' | 'comment' | 'share';
  resource: string;
  scope: 'global' | 'project' | 'element', ;, 
}

export interface CursorPosition {
  x: number;
  y: number;
  elementId?: string;
  timestamp: string, ;, 
}

export interface CollaborationCapabilities {
  realTimeEditing: boolean;
  voiceChat: boolean;
  screenSharing: boolean;
  cursorSharing: boolean;
  annotationEnabled: boolean;
  whiteboardMode: boolean, ;, 
}

export interface CollaborationEvent {
  eventId: string;
  sessionId: string;
  userId: string;
  type: 'cursor_move' | 'element_select' | 'change' | 'join' | 'leave' | 'annotate' | 'chat';
  timestamp: string;
  data: any;
  metadata?: Record<string, any>;
}

export interface ProjectShare {
  projectId: string;
  shareUrl: string;
  accessLevel: 'private' | 'team' | 'public';
  shareToken: string;
  permissions: Permission[];
  expiresAt?: string;
  createdBy: string;
  createdAt: string, ;, 
}

export interface TeamInvitation {
  invitationId: string;
  email: string;
  role: Participant['role'];
  projectId?: string;
  invitedBy: string;
  expiresAt: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  message?: string, ;, 
}

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
  type: 'text' | 'emoji' | 'file' | 'image' | 'system';
  mentions?: string[];
  attachments?: FileAttachment[], ;, 
}

export interface FileAttachment {
  fileId: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  url: string, ;, 
}

export interface VoiceCall {
  callId: string;
  sessionId: string;
  participants: string[];
  status: 'connecting' | 'connected' | 'ended';
  startTime?: string;
  endTime?: string;
  audioSettings: AudioSettings, ;, 
}

export interface AudioSettings {
  microphone: boolean;
  speakers: boolean;
  noiseCancellation: boolean;
  gain: number, ;, 
}

class CollaborationService {
  private baseUrl: string;
  private socket?: WebSocket;
  private activeSessions: Map<string, CollaborationSession> = new Map();
  private eventHandlers: Map<string, Function[]> = new Map();
  private isConnected: boolean = false;
  private userId?: string;

  constructor(baseUrl = '/api/collaboration') {
    this.baseUrl = baseUrl;
    this.initWebSocket();
,}

  /**
   * Initialize WebSocket connection for real-time collaboration
   */
  private async initWebSocket(): Promise<void> {
    try {
      const wsUrl = this.baseUrl.replace('http', 'ws') + '/socket';
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected = true;
        this.emit('connected', {});
        console.log('Collaboration WebSocket connected');
    };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
      } catch (error) {
          console.error('Failed to parse collaboration event: ', error);
      }
    };

      this.socket.onclose = () => {
        this.isConnected = false;
        this.emit('disconnected', {});
        // Attempt to reconnect
        setTimeout(() => this.initWebSocket(), 5000);
    };

      this.socket.onerror = (error) => {
        console.error('Collaboration WebSocket error:', error);
        this.emit('error', { error });
    };
  } catch (error) {
      console.error('WebSocket initialization failed:', error);
  }
}

  /**
   * Start a collaboration session
   */
  async startSession(
    projectId: string,
    sessionName: string,
    capabilities?: Partial<CollaborationCapabilities>
  ): Promise<string> {
    try {
      const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const session: CollaborationSession = {
        sessiond,
        projectId,
        sessionName,
        participants:  [],
        startTime: new Date().toISOString(),
        status: 'active',
        capabilities: {
          realTimeEditing: true,
          voiceChat: capabilities?.voiceChat ?? false,
          screenSharing: capabilities?.screenSharing ?? false,
          cursorSharing: capabilities?.cursorSharing ?? true,
          annotationEnabled: capabilities?.annotationEnabled ?? true,
          whiteboardMode: capabilities?.whiteboardMode ?? false,
          ...capabilities
      }
    };

      this.activeSessions.set(sessionId, session);

      // Send session start to server
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'session_start',
          sessionData: session
      ,}));
    }

      return sessionId;
  } catch (error) {
      console.error('Failed to start collaboration session:', error);
      throw error;
  }
}

  /**
   * Join an existing collaboration session
   */
  async joinSession(
    sessionId: string,
    userId: string,
    userDetails: { name: string; email: string; avatar?: string }
  ): Promise<boolean> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        throw new Error(`Session ${sessionId} not found`);
    }

      const participant: Participant = {
        userd,
        name: userDetails.name,
        email: userDetails.email,
        role: 'editor', // Default role
        permissions: [
          { action: 'read', resource: ', *, ', scope: 'global,',},
          { action: 'write', resource: session.projectd, scope: 'project',}
        ],
        avatar: userDetails.avatar,
        isOnline: true,
        lastSeen: new Date().toISOString()
    ,};

      session.participants.push(participant);
      this.userId = userId;

      // Notify other participants
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'participant_joined',
          sessionId,
          participant
      }));
    }

      return true;
  } catch (error) {
      console.error('Failed to join collaboration session:', error);
      return false;
  }
}

  /**
   * Leave a collaboration session
   */
  async leaveSession(sessionId: string, userId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.participants = session.participants.filter(p => p.userId !== userId);
        
        if (session.participants.length === 0) {
          session.status = 'ended';
          session.endTime = new Date().toISOString();
      }

        // Notify other participants
        if (this.isConnected && this.socket) {
          this.socket.send(JSON.stringify({
            type: 'participant_left',
            sessionId,
            userId
        }));
      }
    }
  } catch (error) {
      console.error('Failed to leave collaboration session:', error);
  }
}

  /**
   * Share cursor position with other participants
   */
  async shareCursor(
    sessionId: string,
    userId: string,
    cursor: CursorPosition
  ): Promise<void> {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session || !session.capabilities.cursorSharing) {
        return;
    }

      // Update local participant cursor
      const participant = session.participants.find(p => p.userId === userId);
      if (participant) {
        participant.cursor = cursor;
    }

      // Broadcast to other participants
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'cursor_move',
          sessionId,
          userId,
          cursor
      }));
    }
  } catch (error) {
      console.error('Failed to share cursor:', error);
  }
}

  /**
   * Send chat message in collaboration session
   */
  async sendChatMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'messageId' | , 'timestamp, '>
  ): Promise<string> {
    try {
      const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const chatMessage: ChatMessage = {
        messaged,
        timestamp: new Date().toISOString(),
        ...message
    };

      // Send to WebSocket
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'chat_message',
          sessionId,
          message: chatMessage
      ,}));
    }

      return messageId;
  } catch (error) {
      console.error('Failed to send chat message:', error);
      throw error;
  }
}

  /**
   * Share a project with specific permissions
   */
  async shareProject(
    projectId: string,
    accessLevel: ProjectShare[', '],
    options: {
      permissions: Permission[];
      expiresAt?: string;
      message?: string;
  }
  ): Promise<ProjectShare> {
    try {
      const shareToken = `share_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const shareUrl = `${window.location.origin}/shared/${shareToken}`;

      const projectShare: ProjectShare = {
        projectd,
        shareUrl,
        accessLevel,
        shareToken,
        permissions: options.permissions,
        expiresAt: options.expirest,
        createdBy: this.userId || 'anonymous',
        createdAt: new Date().toISOString()
    ,};

      // Send to server
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'share_project',
          share: projectShare
      ,}));
    }

      return projectShare;
  } catch (error) {
      console.error('Failed to share project:', error);
      throw error;
  }
}

  /**
   * Send team invitation
   */
  async sendTeamInvitation(invitation: Omit<TeamInvitation, 'invitationId' | 'invitedBy'>): Promise<string> {
    try {
      const invitationId = `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const fullInvitation: TeamInvitation = {
        invitationd,
        invitedBy: this.userId || 'anonymous',
        timestamp: new Date().toISOString(),
        status: 'pending',
        ...invitation
    };

      // Send invitation to server
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'team_invitation',
          invitation: fullInvitation
      ,}));
    }

      return invitationId;
  } catch (error) {
      console.error('Failed to send team invitation:', error);
      throw error;
  }
}

  /**
   * Start a voice call in the session
   */
  async startVoiceCall(sessionId: string, audioSettings?: Partial<AudioSettings>): Promise<string> {
    try {
      const callId = `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const voiceCall: VoiceCall = {
        calld,
        sessionId,
        participants:  [],
        status: 'connecting',
        audioSettings: {
          microphone: audioSettings?.microphone ?? true,
          speakers: audioSettings?.speakers ?? true,
          noiseCancellation: audioSettings?.noiseCancellation ?? true,
          gain: audioSettings?.gain ?? 1.0
      }
    };

      // Initialize WebRTC connection or use service audio
      if (this.isConnected && this.socket) {
        this.socket.send(JSON.stringify({
          type: 'voice_call_start',
          call: voiceCall
      ,}));
    }

      return callId;
  } catch (error) {
      console.error('Failed to start voice call:', error);
      throw error;
  }
}

  /**
   * Enable real-time editing
   */
  enableCollaboration(sessionId: string): boolean {
    try {
      const session = this.activeSessions.get(sessionId);
      if (!session) {
        return false;
    }

      session.capabilities.realTimeEditing = true;
      
      // Notify participants
      this.emit('collaboration_enabled', { sessionId });
      
      return true;
  } catch (error) {
      console.error('Failed to enable collaboration:', error);
      return false;
  }
}

  /**
   * Handle incoming collaboration events
   */
  private handleIncomingEvent(data: any): void {
    switch (data.type) {
      case 'cursor_move':
        this.emit('cursor_update', data);
        break;
      case 'participant_joined':
      case 'participant_left':
        this.emit('participants_update', data);
        break;
      case 'chat_message':
        this.emit('chat_message', data.message);
        break;
      case'collaboration_event':
        this.emit('edit_change', data.data);
        break;
      default: this.emit('custom_event', data);
  }
}

  /**
   * Event handling system
   */
  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
  }
    this.eventHandlers.get(event)!.push(handler);
}

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
    }
  }
}

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
  }
}

  /**
   * Get active collaboration sessions
   */
  getActiveSessions(): CollaborationSession[] {
    return Array.from(this.activeSessions.values());
}

  /**
   * Get collaboration session details
   */
  getSession(sessionId: string): CollaborationSession | undefined {
    return this.activeSessions.get(sessionId);
,}

  /**
   * Disconnect from collaboration service
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.close();
      this.socket = undefined;
  }
    this.isConnected = false;
    this.activeSessions.clear();
}

  /**
   * Check if service is connected and ready
   */
  get isConnectionHealthy(): boolean {
    return this.isConnected && this.socket?.readyState === WebSocket.OPEN;
}
}

// Create singleton instance
export const collaborationService = new CollaborationService();

export default collaborationService;







