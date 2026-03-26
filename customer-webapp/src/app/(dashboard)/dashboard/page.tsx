'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, List, Button, Empty, Tag, message, Spin } from 'antd';
import { ClockCircleOutlined, UserOutlined, MessageOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useWebSocket } from '@/contexts/WebSocketContext';
import apiClient from '@/lib/api-client';
import { Conversation } from '@/types/conversation';
import { StompSubscription } from '@stomp/stompjs';

interface QueueEvent {
  type: 'NEW_CONVERSATION' | 'CONVERSATION_TAKEN';
  conversation: Conversation;
}

export default function QueuePage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [takingOver, setTakingOver] = useState<Record<number, boolean>>({});
  const router = useRouter();
  const { subscribe, connected } = useWebSocket();

  const fetchWaitingConversations = useCallback(async () => {
    try {
      const response = await apiClient.get<Conversation[]>(
        '/api/conversations?status=WAITING'
      );
      if (response.data) {
        setConversations(response.data);
      }
    } catch (error: any) {
      console.error('Failed to fetch conversations:', error);
      message.error('Failed to load waiting conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWaitingConversations();
  }, [fetchWaitingConversations]);

  useEffect(() => {
    let subscription: StompSubscription | null = null;

    if (connected) {
      subscription = subscribe('/topic/queue', (msg) => {
        try {
          const event: QueueEvent = JSON.parse(msg.body);
          
          if (event.type === 'NEW_CONVERSATION') {
            setConversations((prev) => [event.conversation, ...prev]);
            message.info('New conversation in queue');
          } else if (event.type === 'CONVERSATION_TAKEN') {
            setConversations((prev) => 
              prev.filter((c) => c.id !== event.conversation.id)
            );
          }
        } catch (error) {
          console.error('Failed to parse queue event:', error);
        }
      });
    }

    return () => {
      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, [connected, subscribe]);

  const handleTakeOver = async (conversationId: number) => {
    setTakingOver((prev) => ({ ...prev, [conversationId]: true }));
    
    try {
      const response = await apiClient.put<Conversation>(
        `/api/conversations/${conversationId}/assign`
      );
      
      if (response.data) {
        message.success('Conversation assigned to you');
        router.push(`/dashboard/chat/${conversationId}`);
      }
    } catch (error: any) {
      console.error('Failed to take over conversation:', error);
      message.error(error?.response?.data?.message || 'Failed to take over conversation');
      setTakingOver((prev) => ({ ...prev, [conversationId]: false }));
    }
  };

  const getWaitTime = (createdAt: string) => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffMinutes = Math.floor((now.getTime() - created.getTime()) / 1000 / 60);
    
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: 400 
      }}>
        <Spin size="large" tip="Loading queue..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: 24,
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: '#1e293b' }}>
            Conversation Queue
          </h2>
          <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
            {conversations.length} conversation{conversations.length !== 1 ? 's' : ''} waiting
          </p>
        </div>
        
        {!connected && (
          <Tag color="error">WebSocket Disconnected</Tag>
        )}
      </div>

      {conversations.length === 0 ? (
        <Card>
          <Empty
            description="No conversations waiting"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '40px 0' }}
          />
        </Card>
      ) : (
        <List
          grid={{ 
            gutter: 16, 
            xs: 1,
            sm: 1,
            md: 2,
            lg: 2,
            xl: 3,
            xxl: 3,
          }}
          dataSource={conversations}
          renderItem={(conversation) => (
            <List.Item>
              <Card
                hoverable
                style={{
                  borderRadius: 8,
                  transition: 'all 0.3s',
                }}
                bodyStyle={{ padding: 20 }}
              >
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column',
                  gap: 12,
                }}>
                  <div style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <UserOutlined style={{ fontSize: 16, color: '#2563eb' }} />
                    <span style={{ 
                      fontSize: '16px',
                      fontWeight: 600,
                      color: '#1e293b',
                    }}>
                      {conversation.visitorName || 'Anonymous Visitor'}
                    </span>
                  </div>

                  {conversation.visitorEmail && (
                    <div style={{ 
                      fontSize: '13px',
                      color: '#64748b',
                      marginTop: -8,
                    }}>
                      {conversation.visitorEmail}
                    </div>
                  )}

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: '13px',
                    color: '#64748b',
                  }}>
                    <ClockCircleOutlined />
                    <span>{getWaitTime(conversation.createdAt)}</span>
                  </div>

                  <div style={{
                    marginTop: 8,
                    paddingTop: 12,
                    borderTop: '1px solid #f1f5f9',
                  }}>
                    <Button
                      type="primary"
                      block
                      size="large"
                      loading={takingOver[conversation.id]}
                      onClick={() => handleTakeOver(conversation.id)}
                      icon={<MessageOutlined />}
                      style={{
                        fontWeight: 600,
                        height: 44,
                      }}
                    >
                      Take Over
                    </Button>
                  </div>
                </div>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
}
