/**
 * Google Chat Service for CreatorHub Norge
 * Handles Google Chat API integration with real-time messaging
 */

import { useDemoMode } from '@/contexts/DemoModeContext';

export interface GoogleChatSpace {
  name: string;
  displayName: string;
  type: 'DM' | 'ROOM' | 'THREAD';
  spaceType: 'DIRECT_MESSAGE' | 'SPACE';
  singleUserBotDm: boolean;
  threaded: boolean;
  spaceHistoryState: string;
  spaceThreadingState: 'THREADED_MESSAGES' | 'UNTHREADED_MESSAGES';
  adminInstalled: boolean;
}

export interface GoogleChatMessage {
  name: string;
  sender: {
    name: string;
    displayName: string;
    avatarUrl?: string;
    email?: string;
  };
  text?: string;
  cards?: any[];
  createTime: string;
  updateTime: string;
  thread: {
    name: string;
  };
  space: {
    name: string;
    displayName: string;
  };
  quotedMessage?: GoogleChatMessage;
  annotations?: any[];
  argumentText?: string;
  attachment?: any[];
  threadReply?: boolean;
  clientAssignedMessageId?: string;
}

export interface GoogleChatUser {
  name: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  type: 'HUMAN' | 'BOT';
  domainId?: string;
}

class GoogleChatService {
  private isDemoMode: boolean = false;
  private accessToken: string | null = null;
  private baseUrl = 'https://chat.googleapis.com/v1';

  constructor() {
    // Get demo mode from context
    this.isDemoMode = false; // Will be set by the hook
  }

  setDemoMode(isDemo: boolean) {
    this.isDemoMode = isDemo;
  }

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}) {
    if (this.isDemoMode) {
      return this.getDemoData(endpoint);
    }

    if (!this.accessToken) {
      throw new Error('Google Chat access token not available');
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`'Content-Type' : 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`Google Chat API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private getDemoData(endpoint: string) {
    // Return demo data based on endpoint
    switch (endpoint) {
      case '/spaces':
        return {
          spaces: [
            {
              name: 'spaces/AAAA123456789',
              displayName: 'CreatorHub Norge Team',
              type: 'ROOM',
              spaceType: 'SPACE',
              singleUserBotDm: false,
              threaded: true,
              spaceHistoryState: 'HISTORY_MESSAGES',
              spaceThreadingState: 'THREADED_MESSAGES',
              adminInstalled: true,
            },
            {
              name: 'spaces/BBBB123456789',
              displayName: 'Fotografer Norge',
              type: 'ROOM',
              spaceType: 'SPACE',
              singleUserBotDm: false,
              threaded: true,
              spaceHistoryState: 'HISTORY_MESSAGES',
              spaceThreadingState: 'THREADED_MESSAGES',
              adminInstalled: true,
            },
            {
              name: 'spaces/CCCC123456789',
              displayName: 'Anna Larsen',
              type: 'DM',
              spaceType: 'DIRECT_MESSAGE',
              singleUserBotDm: false,
              threaded: false,
              spaceHistoryState: 'HISTORY_MESSAGES',
              spaceThreadingState: 'UNTHREADED_MESSAGES',
              adminInstalled: false,
            },
          ],
        };

      case '/spaces/AAAA1234567890/messages':
        return {
          messages: [
            {
              name: 'spaces/AAAA1234567890/messages/msg001',
              sender: {
                name: 'users/anna.larsen',
                displayName: 'Anna Larsen',
                avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocK...',
                email: 'anna.larsen@example.com',
              },
              text: 'Hei alle sammen! Hvordan går det med prosjektet?',
              createTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              updateTime: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
              thread: {
                name: 'spaces/AAAA1234567890/threads/thread001',
              },
              space: {
                name: 'spaces/AAAA123456789',
                displayName: 'CreatorHub Norge Team',
              },
            },
            {
              name: 'spaces/AAAA1234567890/messages/msg002',
              sender: {
                name: 'users/erik.hansen',
                displayName: 'Erik Hansen',
                avatarUrl: 'https://lh3.googleusercontent.com/a/ACg8ocK...',
                email: 'erik.hansen@example.com',
              },
              text: 'Alt går bra! Vi er nesten ferdig med redigeringen.',
              createTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              updateTime: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
              thread: {
                name: 'spaces/AAAA1234567890/threads/thread001',
              },
              space: {
                name: 'spaces/AAAA123456789',
                displayName: 'CreatorHub Norge Team',
              },
            },
          ],
        };

      default: 
        return { error: 'Demo data not available for this endpoint' };
    }
  }

  // Get all spaces the user has access to
  async getSpaces(): Promise<{ spaces: GoogleChatSpace[] }> {
    return this.makeRequest('/spaces');
  }

  // Get messages from a specific space
  async getMessages(spaceName: string, pageSize: number = 50): Promise<{ messages: GoogleChatMessage[] }> {
    return this.makeRequest(`${spaceName}/messages?pageSize=${pageSize}`);
  }

  // Send a message to a space
  async sendMessage(spaceName: string, text: string, threadName?: string): Promise<GoogleChatMessage> {
    const messageData = {
      text,
      ...(threadName && { thread: { name: threadName } }),
    };

    return this.makeRequest(`${spaceName}/messages`, {
      method: 'POST',
      body: JSON.stringify(messageData),
    });
  }

  // Create a new space
  async createSpace(displayName: string, description?: string): Promise<GoogleChatSpace> {
    const spaceData = {
      displayName,
      ...(description && { description }),
    };

    return this.makeRequest('/spaces', {
      method: 'POST',
      body: JSON.stringify(spaceData),
    });
  }

  // Get user information
  async getUser(userName: string): Promise<GoogleChatUser> {
    return this.makeRequest(`/users/${userName}`);
}

  // Search for messages
  async searchMessages(query: string, spaces?: string[]): Promise<{ messages: GoogleChatMessage[] }> {
    const params = new URLSearchParams({ q: query });
    if (spaces) {
      spaces.forEach(space => params.append('spaces', space));
    }

    return this.makeRequest(`/messages?${params.toString()}`);
  }

  // Add reaction to a message
  async addReaction(messageName: string, emoji: string): Promise<any> {
    const reactionData = {
      emoji: {
        unicode: emoji,
      },
    };

    return this.makeRequest(`${messageName}/reactions`, {
      method: 'POST',
      body: JSON.stringify(reactionData),
    });
  }

  // Get space members
  async getSpaceMembers(spaceName: string): Promise<{ members: GoogleChatUser[] }> {
    return this.makeRequest(`${spaceName}/members`);
  }
}

export const googleChatService = new GoogleChatService();
export default googleChatService;
