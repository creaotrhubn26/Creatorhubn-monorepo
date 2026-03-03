export type CommunicationPriority = 'low' | 'medium' | 'high';

export interface CommunicationMessage<TData = unknown> {
  type: string;
  from: string;
  to: string;
  priority: CommunicationPriority;
  data: TData;
  timestamp: number;
}

type MessageListener = (message: CommunicationMessage<unknown>) => void;

class CommunicationService {
  private listeners = new Map<string, Set<MessageListener>>();

  subscribe(type: string, listener: MessageListener): () => void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    const listenersForType = this.listeners.get(type);
    listenersForType?.add(listener);

    return () => {
      listenersForType?.delete(listener);
      if (listenersForType && listenersForType.size === 0) {
        this.listeners.delete(type);
      }
    };
  }

  sendMessage<TData>(message: Omit<CommunicationMessage<TData>, 'timestamp'>): void {
    const fullMessage: CommunicationMessage<unknown> = {
      ...message,
      timestamp: Date.now(),
    };

    const listenersForType = this.listeners.get(fullMessage.type);
    if (!listenersForType || listenersForType.size === 0) {
      return;
    }

    listenersForType.forEach((listener) => {
      listener(fullMessage);
    });
  }
}

export const communication = new CommunicationService();
