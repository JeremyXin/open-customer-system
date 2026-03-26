export type SenderType = 'VISITOR' | 'AGENT' | 'SYSTEM';

export interface Message {
  id: number;
  conversationId: number;
  senderType: SenderType;
  senderId?: string;
  content: string;
  clientMessageId?: string;
  sequenceNumber: number;
  createdAt: string;
}

export interface SendMessageRequest {
  content: string;
  senderType: SenderType;
  clientMessageId: string;
}
