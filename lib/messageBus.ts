/**
 * Message Bus for Multi-Agent Communication
 * Handles message passing between agents and orchestrates workflows
 * Extended to support intent agent topic subscriptions
 */

export interface Message {
  id: string;
  from: string;
  to: string;
  type: 'request' | 'response' | 'approval' | 'rejection' | 'event';
  content: string;
  metadata?: Record<string, any>;
  timestamp: number;
  topic?: string; // For pub/sub topic-based messaging
}

export interface AgentResponse {
  agentName: string;
  approved: boolean;
  feedback: string;
  suggestions?: string[];
}

export interface IntentEvent {
  topic: string;
  data: Record<string, any>;
  timestamp: number;
}

export class MessageBus {
  private messages: Message[] = [];
  private subscribers: Map<string, (message: Message) => void> = new Map();
  private topicSubscribers: Map<string, Set<(event: IntentEvent) => void>> = new Map();

  /**
   * Publish a message to the bus
   */
  publish(message: Omit<Message, 'id' | 'timestamp'>): Message {
    const fullMessage: Message = {
      ...message,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
    };

    this.messages.push(fullMessage);
    
    // Notify subscribers
    const subscriber = this.subscribers.get(message.to);
    if (subscriber) {
      subscriber(fullMessage);
    }

    return fullMessage;
  }

  /**
   * Subscribe an agent to receive messages
   */
  subscribe(agentName: string, callback: (message: Message) => void): void {
    this.subscribers.set(agentName, callback);
  }

  /**
   * Unsubscribe an agent
   */
  unsubscribe(agentName: string): void {
    this.subscribers.delete(agentName);
  }

  /**
   * Get message history
   */
  getMessages(): Message[] {
    return [...this.messages];
  }

  /**
   * Clear message history
   */
  clear(): void {
    this.messages = [];
  }

  /**
   * Subscribe to a topic (for intent agents)
   */
  subscribeTo(topic: string, callback: (event: IntentEvent) => void): () => void {
    if (!this.topicSubscribers.has(topic)) {
      this.topicSubscribers.set(topic, new Set());
    }
    this.topicSubscribers.get(topic)!.add(callback);
    console.log(`[MessageBus] Subscriber registered for topic '${topic}', total subscribers:`, this.topicSubscribers.get(topic)?.size);
    
    // Return unsubscribe function
    return () => {
      this.topicSubscribers.get(topic)?.delete(callback);
    };
  }

  /**
   * Publish event to topic
   */
  publishToTopic(topic: string, data: Record<string, any>): void {
    const event: IntentEvent = {
      topic,
      data,
      timestamp: Date.now(),
    };

    const callbacks = this.topicSubscribers.get(topic);
    console.log(`[MessageBus] Publishing to topic '${topic}', subscribers:`, callbacks?.size || 0);
    if (callbacks) {
      callbacks.forEach((callback) => {
        console.log(`[MessageBus] Calling callback for topic '${topic}'`);
        callback(event);
      });
    }
  }

  /**
   * Get topic subscribers count
   */
  getTopicSubscriberCount(topic: string): number {
    return this.topicSubscribers.get(topic)?.size || 0;
  }
}
