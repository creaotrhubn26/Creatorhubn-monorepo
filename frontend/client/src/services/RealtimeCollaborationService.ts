/**
 * Real-time Collaboration Service
 * WebSocket-based multi-user editing with live cursors and presence
 */

import { io, Socket } from 'socket.io-client';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  color: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Cursor {
  userId: string;
  x: number;
  y: number;
  timestamp: number;
}

export interface Selection {
  userId: string;
  elementIds: string[];
  timestamp: number;
}

export interface Change {
  id: string;
  userId: string;
  type: 'add' | 'update' | 'delete' | 'move';
  elementId: string;
  data: unknown;
  timestamp: number;
  synchronized: boolean;
}

export interface Comment {
  id: string;
  userId: string;
  elementId?: string;
  x?: number;
  y?: number;
  text: string;
  resolved: boolean;
  timestamp: number;
  replies: Comment[];
}

export interface SessionState {
  sessionId: string;
  projectId: string;
  users: Map<string, User>;
  cursors: Map<string, Cursor>;
  selections: Map<string, Selection>;
  changes: Change[];
  comments: Comment[];
  version: number;
}

interface RealtimeEvents {
  // Connection
  connected: (user: User) => void;
  disconnected: (userId: string) => void;
  'user:joined': (user: User) => void;
  'user:left': (userId: string) => void;

  // Cursors & Selection
  'cursor:move': (cursor: Cursor) => void;
  'selection:change': (selection: Selection) => void;

  // Changes
  'change:add': (change: Change) => void;
  'change:sync': (changes: Change[]) => void;
  'change:conflict': (conflict: { local: Change; remote: Change }) => void;

  // Comments
  'comment:add': (comment: Comment) => void;
  'comment:update': (comment: Comment) => void;
  'comment:delete': (commentId: string) => void;

  // State
  'state:sync': (state: SessionState) => void;
  'state:version': (version: number) => void;
}

export class RealtimeCollaborationService {
  private socket: Socket | null = null;
  private sessionState: SessionState | null = null;
  private currentUser: User | null = null;
  private eventListeners: Map<keyof RealtimeEvents, Set<Function>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private changeQueue: Change[] = [];
  private isConnected = false;

  constructor() {
    this.initializeEventMaps();
  }

  /**
   * Initialize event listener maps
   */
  private initializeEventMaps() {
    const events: (keyof RealtimeEvents)[] = [
      'connected', 'disconnected','user:joined','user:left','cursor:move','selection:change','change:add','change:sync','change:conflict','comment:add','comment:update','comment:delete','state:sync','state:version',
    ];

    events.forEach((event) => {
      this.eventListeners.set(event, new Set());
    });
  }

  /**
   * Connect to real-time collaboration server
   */
  async connect(user: User, projectId: string, sessionId?: string): Promise<void> {
    if (this.socket?.connected) {
      console.warn('Already connected to collaboration server');
      return;
    }

    this.currentUser = user;

    // Connect to WebSocket server
    this.socket = io(import.meta.env.VITE_COLLAB_SERVER_URL || 'http://localhost:3001', {
      auth: {
        userId: user.id,
        projectId,
        sessionId,
      },
      transports: ['websocket','polling'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.setupSocketListeners();

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket!.once('connect', () => {
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.flushChangeQueue();
        resolve();
      });

      this.socket!.once('connect_error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Setup socket event listeners
   */
  private setupSocketListeners() {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connected', (data: { user: User; sessionState: SessionState }) => {
      this.sessionState = data.sessionState;
      this.emit('connected', data.user);
    });

    this.socket.on('user:joined', (user: User) => {
      if (this.sessionState) {
        this.sessionState.users.set(user.id, user);
      }
      this.emit('user:joined', user);
    });

    this.socket.on('user:left', (userId: string) => {
      if (this.sessionState) {
        this.sessionState.users.delete(userId);
        this.sessionState.cursors.delete(userId);
        this.sessionState.selections.delete(userId);
      }
      this.emit('user:left', userId);
    });

    // Cursor events
    this.socket.on('cursor:move', (cursor: Cursor) => {
      if (this.sessionState && cursor.userId !== this.currentUser?.id) {
        this.sessionState.cursors.set(cursor.userId, cursor);
        this.emit('cursor:move', cursor);
      }
    });

    // Selection events
    this.socket.on('selection:change', (selection: Selection) => {
      if (this.sessionState && selection.userId !== this.currentUser?.id) {
        this.sessionState.selections.set(selection.userId, selection);
        this.emit('selection:change', selection);
      }
    });

    // Change events
    this.socket.on('change:add', (change: Change) => {
      if (change.userId !== this.currentUser?.id) {
        this.handleRemoteChange(change);
      }
    });

    this.socket.on('change:sync', (changes: Change[]) => {
      this.emit('change:sync', changes);
    });

    // Comment events
    this.socket.on('comment:add', (comment: Comment) => {
      if (this.sessionState) {
        this.sessionState.comments.push(comment);
      }
      this.emit('comment:add', comment);
    });

    this.socket.on('comment:update', (comment: Comment) => {
      if (this.sessionState) {
        const index = this.sessionState.comments.findIndex((c) => c.id === comment.id);
        if (index !== -1) {
          this.sessionState.comments[index] = comment;
        }
      }
      this.emit('comment:update', comment);
    });

    this.socket.on('comment:delete', (commentId: string) => {
      if (this.sessionState) {
        this.sessionState.comments = this.sessionState.comments.filter((c) => c.id !== commentId);
      }
      this.emit('comment:delete', commentId);
    });

    // State sync
    this.socket.on('state:sync', (state: SessionState) => {
      this.sessionState = state;
      this.emit('state:sync', state);
    });

    // Reconnection
    this.socket.on('reconnect', () => {
      console.log('Reconnected to collaboration server');
      this.requestStateSync();
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      this.emit('disconnected', this.currentUser?.id || ', ');
    });
  }

  /**
   * Disconnect from collaboration server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.sessionState = null;
      this.isConnected = false;
    }
  }

  /**
   * Update cursor position
   */
  updateCursor(x: number, y: number) {
    if (!this.isConnected || !this.currentUser) return;

    const cursor: Cursor = {
      userId: this.currentUser.id,
      x,
      y,
      timestamp: Date.now(),
    };

    this.socket?.emit('cursor:move', cursor);
  }

  /**
   * Update selection
   */
  updateSelection(elementIds: string[]) {
    if (!this.isConnected || !this.currentUser) return;

    const selection: Selection = {
      userId: this.currentUser.id,
      elementIds,
      timestamp: Date.now(),
    };

    this.socket?.emit('selection:change', selection);
  }

  /**
   * Add a change
   */
  addChange(change: Omit<Change, 'id' | 'userId' | 'timestamp' | 'synchronized'>) {
    if (!this.currentUser) return;

    const fullChange: Change = {
      ...change,
      id: `${this.currentUser.id}-${Date.now()}`,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      synchronized: false,
    };

    if (this.isConnected) {
      this.socket?.emit('change:add', fullChange);
      fullChange.synchronized = true;
    } else {
      this.changeQueue.push(fullChange);
    }

    if (this.sessionState) {
      this.sessionState.changes.push(fullChange);
    }

    this.emit('change:add', fullChange);
  }

  /**
   * Handle remote change
   */
  private handleRemoteChange(remoteChange: Change) {
    if (!this.sessionState) return;

    // Check for conflicts
    const localChanges = this.sessionState.changes.filter(
      (c) =>
        c.elementId === remoteChange.elementId &&
        c.timestamp > remoteChange.timestamp &&
        c.userId === this.currentUser?.id,
    );

    if (localChanges.length > 0) {
      // Conflict detected - last write wins
      const lastLocal = localChanges[localChanges.length - 1];
      this.emit('change:conflict', { local: lastLocal, remote: remoteChange });
    }

    this.sessionState.changes.push(remoteChange);
    this.emit('change:add', remoteChange);
  }

  /**
   * Add a comment
   */
  addComment(comment: Omit<Comment, 'id' | 'userId' | 'timestamp' |'replies'>) {
    if (!this.currentUser) return;

    const fullComment: Comment = {
      ...comment,
      id: `comment-${Date.now()}`,
      userId: this.currentUser.id,
      timestamp: Date.now(),
      replies: [],
    };

    this.socket?.emit('comment:add', fullComment);
  }

  /**
   * Update comment
   */
  updateComment(comment: Comment) {
    this.socket?.emit('comment:update', comment);
  }

  /**
   * Delete comment
   */
  deleteComment(commentId: string) {
    this.socket?.emit('comment:delete', commentId);
  }

  /**
   * Request full state sync
   */
  requestStateSync() {
    this.socket?.emit('state:request-sync');
  }

  /**
   * Flush queued changes
   */
  private flushChangeQueue() {
    while (this.changeQueue.length > 0) {
      const change = this.changeQueue.shift();
      if (change) {
        this.socket?.emit('change:add', change);
        change.synchronized = true;
      }
    }
  }

  /**
   * Subscribe to events
   */
  on<K extends keyof RealtimeEvents>(event: K, listener: RealtimeEvents[K]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.add(listener);
    }
  }

  /**
   * Unsubscribe from events
   */
  off<K extends keyof RealtimeEvents>(event: K, listener: RealtimeEvents[K]) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event
   */
  private emit<K extends keyof RealtimeEvents>(event: K, ...args: Parameters<RealtimeEvents[K]>) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => {
        (listener as any)(...args);
      });
    }
  }

  /**
   * Get current session state
   */
  getSessionState(): SessionState | null {
    return this.sessionState;
  }

  /**
   * Get connected users
   */
  getUsers(): User[] {
    return this.sessionState ? Array.from(this.sessionState.users.values()) : [];
  }

  /**
   * Get user cursors
   */
  getCursors(): Map<string, Cursor> {
    return this.sessionState?.cursors || new Map();
  }

  /**
   * Get user selections
   */
  getSelections(): Map<string, Selection> {
    return this.sessionState?.selections || new Map();
  }

  /**
   * Check if connected
   */
  isUserConnected(): boolean {
    return this.isConnected;
  }
}

// Singleton instance
export const realtimeCollaboration = new RealtimeCollaborationService();
