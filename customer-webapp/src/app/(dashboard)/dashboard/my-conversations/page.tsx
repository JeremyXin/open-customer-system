'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Badge, Empty, Spin, Avatar, Typography, message } from 'antd';
import { UserOutlined, MessageOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/lib/api-client';
import { Conversation } from '@/types/conversation';
import { Message } from '@/types/message';
import { StompSubscription } from '@stomp/stompjs';

const { Text } = Typography;

interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
}

interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  size: number;
}

interface ConversationWithMeta extends Conversation {
  lastMessage?: Message;
  unreadCount: number;
}

interface QueueEvent {
  type: 'CONVERSATION_TAKEN' | 'CONVERSATION_RESOLVED' | 'NEW_MESSAGE';
  conversation?: Conversation;
  message?: Message;
}

const UNREAD_KEY_PREFIX = 'lastSeen:';

export default function MyConversationsPage() {
  const [conversations, setConversations] = useState<ConversationWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const { subscribe, connected } = useWebSocket();
  const { user } = useAuth();

  const getLastSeenSequence = useCallback((conversationId: number): number => {
    if (typeof window === 'undefined') return 0;
    const stored = localStorage.getItem(`${UNREAD_KEY_PREFIX}${conversationId}`);
    return stored ? parseInt(stored, 10) : 0;
  }, []);

  const calculateUnreadCount = useCallback((conversationId: number, lastMessage?: Message): number => {
    if (!lastMessage) return 0;
    const lastSeen = getLastSeenSequence(conversationId);
    return lastMessage.sequenceNumber > lastSeen ? 1 : 0;
  }, [getLastSeenSequence]);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<Conversation[]>(
        '/api/conversations?status=ACTIVE'
      );

      if (response.data) {
        const convos = response.data as Conversation[];

        const conversationsWithMessages = await Promise.all(
          convos.map(async (convo) => {
            try {
              const msgResponse = await apiClient.get<Message[]>(
                `/api/conversations/${convo.id}/messages?page=0&size=1`
              );

              const msgs = msgResponse.data as Message[]; const lastMessage = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
              const unreadCount = calculateUnreadCount(convo.id, lastMessage);

              return {
                ...convo,
                lastMessage,
                unreadCount,
              } as ConversationWithMeta;
            } catch (error) {
              console.error(`Failed to fetch messages for conversation ${convo.id}:`, error);
              return {
                ...convo,
                lastMessage: undefined,
                unreadCount: 0,
              } as ConversationWithMeta;
            }
          })
        );

        conversationsWithMessages.sort((a, b) => {
          const timeA = a.lastMessage?.createdAt || a.updatedAt;
          const timeB = b.lastMessage?.createdAt || b.updatedAt;
          return new Date(timeB).getTime() - new Date(timeA).getTime();
        });

        setConversations(conversationsWithMessages);
      }
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      message.error('Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, [calculateUnreadCount]);

  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  useEffect(() => {
    let subscription: StompSubscription | null = null;
    const messageSubscriptions: StompSubscription[] = [];

    if (connected && user) {
      subscription = subscribe('/topic/queue', (msg) => {
        try {
          const event: QueueEvent = JSON.parse(msg.body);

          if (event.type === 'CONVERSATION_TAKEN' && event.conversation) {
            if (event.conversation.agentId === user.id && event.conversation.status === 'ACTIVE') {
              fetchConversations();
            }
          } else if (event.type === 'CONVERSATION_RESOLVED' && event.conversation) {
            setConversations((prev) => prev.filter((c) => c.id !== event.conversation!.id));
          }
        } catch (error) {
          console.error('Failed to parse queue event:', error);
        }
      });

      conversations.forEach((convo) => {
        const msgSub = subscribe(`/topic/conversations/${convo.id}/messages`, (msg) => {
          try {
            const newMessage: Message = JSON.parse(msg.body);
            
            setConversations((prev) =>
              prev.map((c) => {
                if (c.id === convo.id) {
                  const unreadCount = calculateUnreadCount(c.id, newMessage);
                  return {
                    ...c,
                    lastMessage: newMessage,
                    unreadCount,
                    updatedAt: newMessage.createdAt,
                  };
                }
                return c;
              }).sort((a, b) => {
                const timeA = a.lastMessage?.createdAt || a.updatedAt;
                const timeB = b.lastMessage?.createdAt || b.updatedAt;
                return new Date(timeB).getTime() - new Date(timeA).getTime();
              })
            );
          } catch (error) {
            console.error('Failed to parse message event:', error);
          }
        });
        
        if (msgSub) {
          messageSubscriptions.push(msgSub);
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
      messageSubscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [connected, subscribe, user, conversations, calculateUnreadCount, fetchConversations]);

  const handleConversationClick = useCallback((convo: ConversationWithMeta) => {
    if (convo.lastMessage) {
      localStorage.setItem(
        `${UNREAD_KEY_PREFIX}${convo.id}`,
        convo.lastMessage.sequenceNumber.toString()
      );
    }
    
    router.push(`/dashboard/chat/${convo.id}`);
  }, [router]);

  const formatTimeAgo = (dateString: string): string => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMinutes = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;

    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  };

  const truncateMessage = (content: string, maxLength: number = 60): string => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div>
        <h2 style={{ marginBottom: 24, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
          My Conversations
        </h2>
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <Spin size="large" />
          </div>
        </Card>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div>
        <h2 style={{ marginBottom: 24, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
          My Conversations
        </h2>
        <Card>
          <Empty
            description="No active conversations"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
        My Conversations
      </h2>
      <Card bodyStyle={{ padding: 0 }}>
        <List
          dataSource={conversations}
          renderItem={(convo) => {
            const displayName = convo.visitorName || 'Anonymous Visitor';
            const lastMessageContent = convo.lastMessage?.content || 'No messages yet';
            const lastMessageTime = convo.lastMessage?.createdAt || convo.updatedAt;

            return (
              <List.Item
                key={convo.id}
                onClick={() => handleConversationClick(convo)}
                style={{
                  cursor: 'pointer',
                  padding: '16px 24px',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background-color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8fafc';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <List.Item.Meta
                  avatar={
                    <Badge count={convo.unreadCount} offset={[-5, 5]}>
                      <Avatar
                        size={48}
                        icon={<UserOutlined />}
                        style={{
                          backgroundColor: '#2563eb',
                          fontSize: '20px',
                        }}
                      />
                    </Badge>
                  }
                  title={
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text
                        strong
                        style={{
                          fontSize: '16px',
                          color: '#1e293b',
                          fontWeight: convo.unreadCount > 0 ? 700 : 600,
                        }}
                      >
                        {displayName}
                      </Text>
                      <Text
                        type="secondary"
                        style={{
                          fontSize: '13px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <ClockCircleOutlined />
                        {formatTimeAgo(lastMessageTime)}
                      </Text>
                    </div>
                  }
                  description={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                      <MessageOutlined style={{ color: '#94a3b8', fontSize: '14px' }} />
                      <Text
                        type="secondary"
                        style={{
                          fontSize: '14px',
                          color: convo.unreadCount > 0 ? '#475569' : '#94a3b8',
                          fontWeight: convo.unreadCount > 0 ? 500 : 400,
                        }}
                      >
                        {truncateMessage(lastMessageContent)}
                      </Text>
                    </div>
                  }
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </div>
  );
}
