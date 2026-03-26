export type ConversationStatus = 'WAITING' | 'ACTIVE' | 'RESOLVED' | 'CLOSED';

export interface Conversation {
  id: number;
  visitorToken: string;
  visitorName?: string;
  visitorEmail?: string;
  status: ConversationStatus;
  agentId?: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface CreateConversationRequest {
  visitorName: string;
  visitorEmail: string;
  initialMessage: string;
}
