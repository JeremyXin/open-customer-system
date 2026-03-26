import { Message } from './message';
import { Conversation } from './conversation';
import { UserStatus } from './user';

export type WSEventType =
  | 'NEW_MESSAGE'
  | 'CONVERSATION_UPDATED'
  | 'AGENT_TYPING'
  | 'QUEUE_UPDATE'
  | 'PRESENCE_CHANGE';

export interface WSEvent<T = unknown> {
  type: WSEventType;
  payload: T;
  timestamp: string;
}

export interface NewMessagePayload {
  message: Message;
}

export interface ConversationUpdatedPayload {
  conversation: Conversation;
}

export interface AgentTypingPayload {
  conversationId: number;
  agentId: number;
  isTyping: boolean;
}

export interface QueueUpdatePayload {
  waitingCount: number;
}

export interface PresenceChangePayload {
  agentId: number;
  status: UserStatus;
}
