'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, Input, Button, Tag, Avatar, Spin, message as antdMessage, Tooltip } from 'antd';
import { SendOutlined, UserOutlined, CheckCircleOutlined, RollbackOutlined, LoadingOutlined } from '@ant-design/icons';
import { useWebSocket } from '@/contexts/WebSocketContext';
import { useAuth } from '@/contexts/AuthContext';
import apiClient from '@/lib/api-client';
import { Message, SenderType, SendMessageRequest } from '@/types/message';
import { Conversation, ConversationStatus } from '@/types/conversation';
import { StompSubscription } from '@stomp/stompjs';
import { CannedResponse } from '@/types/canned-response';

const { TextArea } = Input;

const MAX_MESSAGE_LENGTH = 5000;

interface Result<T> {
  code: number;
  message: string;
  data: T;
}

interface MessageResponse {
  id: number;
  conversationId: number;
  senderType: SenderType;
  senderId?: string;
  content: string;
  clientMessageId?: string;
  sequenceNumber: number;
  createdAt: string;
  deduplicated?: boolean;
}

interface ConversationResponse {
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

interface TypingEvent {
  conversationId: number;
  typing: boolean;
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params?.id as string;
  
  const { subscribe, publish, connected } = useWebSocket();
  const { user } = useAuth();
  
  const [conversation, setConversation] = useState<ConversationResponse | null>(null);
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [visitorTyping, setVisitorTyping] = useState(false);
  const [isResolving, setIsResolving] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [cannedResponses, setCannedResponses] = useState<CannedResponse[]>([]);
  const [showCannedDropdown, setShowCannedDropdown] = useState(false);
  const [cannedFilter, setCannedFilter] = useState("");
  const [selectedCannedIndex, setSelectedCannedIndex] = useState(0);
  const inputRef = useRef<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageSubscriptionRef = useRef<StompSubscription | null>(null);
  const typingSubscriptionRef = useRef<StompSubscription | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastScrollHeightRef = useRef<number>(0);
  const isInitialLoadRef = useRef(true);
  
  // Fetch conversation details
  const fetchConversation = useCallback(async () => {
    try {
      const response = await apiClient.get<ConversationResponse>(`/api/conversations/${conversationId}`);
      setConversation(response.data);
    } catch (error) {
      console.error('Failed to fetch conversation:', error);
      antdMessage.error('Failed to load conversation details');
    } finally {
      setIsLoadingConversation(false);
    }
  }, [conversationId]);

  // Fetch canned responses
  const fetchCannedResponses = useCallback(async () => {
    try {
      const response = await apiClient.get<CannedResponse[]>('/api/canned-responses');
      setCannedResponses(response.data || []);
    } catch (error) {
      console.error('Failed to fetch canned responses:', error);
    }
  }, []);

  
  // Fetch messages
  const fetchMessages = useCallback(async (afterSequence?: number) => {
    const isLoadingOlderMessages = afterSequence !== undefined;
    
    if (isLoadingOlderMessages) {
      setIsLoadingOlder(true);
    } else {
      setIsLoadingMessages(true);
    }
    
    try {
      const url = afterSequence !== undefined
        ? `/api/conversations/${conversationId}/messages?afterSequence=${afterSequence}&limit=50`
        : `/api/conversations/${conversationId}/messages?limit=50`;
        
      const response = await apiClient.get<MessageResponse[]>(url);
      const newMessages = response.data;
      
      if (isLoadingOlderMessages) {
        // Loading older messages - prepend and restore scroll position
        if (newMessages.length === 0) {
          setHasMoreMessages(false);
        } else {
          setMessages(prev => {
            const combined = [...newMessages, ...prev];
            // Deduplicate by clientMessageId and id
            const seen = new Set<string>();
            return combined.filter(msg => {
              const key = msg.clientMessageId || `id-${msg.id}`;
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            }).sort((a, b) => a.sequenceNumber - b.sequenceNumber);
          });
        }
      } else {
        // Initial load
        setMessages(newMessages.sort((a, b) => a.sequenceNumber - b.sequenceNumber));
        setHasMoreMessages(newMessages.length === 50);
      }
    } catch (error) {
      console.error('Failed to fetch messages:', error);
      antdMessage.error('Failed to load messages');
    } finally {
      if (isLoadingOlderMessages) {
        setIsLoadingOlder(false);
      } else {
        setIsLoadingMessages(false);
      }
    }
  }, [conversationId]);
  
  // Load older messages on scroll
  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingOlder || !hasMoreMessages) return;
    
    if (container.scrollTop < 100) {
      const oldestMessage = messages[0];
      if (oldestMessage) {
        lastScrollHeightRef.current = container.scrollHeight;
        fetchMessages(oldestMessage.sequenceNumber);
      }
    }
  }, [messages, isLoadingOlder, hasMoreMessages, fetchMessages]);
  
  // Auto-scroll to bottom on new messages
  const scrollToBottom = useCallback((force = false) => {
    if (!messagesEndRef.current || !messagesContainerRef.current) return;
    
    const container = messagesContainerRef.current;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
    
    if (force || isNearBottom || isInitialLoadRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: isInitialLoadRef.current ? 'auto' : 'smooth' });
      isInitialLoadRef.current = false;
    }
  }, []);
  
  // Restore scroll position after loading older messages
  useEffect(() => {
    if (!isLoadingOlder && lastScrollHeightRef.current > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        const newScrollHeight = container.scrollHeight;
        const scrollDiff = newScrollHeight - lastScrollHeightRef.current;
        container.scrollTop = scrollDiff;
        lastScrollHeightRef.current = 0;
      }
    }
  }, [isLoadingOlder, messages]);
  
  // Send message
  const handleSend = useCallback(async () => {
    const trimmedContent = inputValue.trim();
    if (!trimmedContent || isSending) return;
    
    if (conversation?.status === 'RESOLVED' || conversation?.status === 'CLOSED') {
      antdMessage.warning('Cannot send messages to a resolved or closed conversation');
      return;
    }
    
    const clientMessageId = crypto.randomUUID();
    const optimisticMessage: MessageResponse = {
      id: Date.now(),
      conversationId: parseInt(conversationId),
      senderType: 'AGENT',
      senderId: user?.id?.toString(),
      content: trimmedContent,
      clientMessageId,
      sequenceNumber: messages.length > 0 ? messages[messages.length - 1].sequenceNumber + 1 : 1,
      createdAt: new Date().toISOString(),
    };
    
    // Optimistic UI update
    setMessages(prev => [...prev, optimisticMessage]);
    setInputValue('');
    setIsSending(true);
    
    // Send typing=false
    if (connected) {
      publish('/app/typing', {
        conversationId: parseInt(conversationId),
        typing: false,
      });
    }
    
    try {
      const requestBody: SendMessageRequest = {
        content: trimmedContent,
        senderType: 'AGENT',
        clientMessageId,
      };
      
      await apiClient.post<MessageResponse>(
        `/api/conversations/${conversationId}/messages`,
        requestBody
      );
      
      // Scroll to bottom after sending
      setTimeout(() => scrollToBottom(true), 100);
    } catch (error) {
      console.error('Failed to send message:', error);
      antdMessage.error('Failed to send message');
      
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => msg.clientMessageId !== clientMessageId));
      setInputValue(trimmedContent);
    } finally {
      setIsSending(false);
    }
  }, [inputValue, isSending, conversation, conversationId, user, messages, connected, publish, scrollToBottom]);
  
    // Handle input change and typing indicator + slash trigger
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    if (value.length <= MAX_MESSAGE_LENGTH) {
      setInputValue(value);
      
      // Detect slash trigger
      const cursorPos = e.target.selectionStart || 0;
      const textBeforeCursor = value.substring(0, cursorPos);
      const lines = textBeforeCursor.split('\n');
      const currentLine = lines[lines.length - 1];
      const slashMatch = currentLine.match(/\/([a-zA-Z0-9-_]*)$/);
      
      if (slashMatch) {
        setCannedFilter(slashMatch[1].toLowerCase());
        setShowCannedDropdown(true);
        setSelectedCannedIndex(0);
      } else {
        setShowCannedDropdown(false);
        setCannedFilter("");
      }
      
      // Send typing indicator
      if (connected && value.trim()) {
        publish('/app/typing', {
          conversationId: parseInt(conversationId),
          typing: true,
        });
        
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }
        
        // Set timeout to send typing=false after 3 seconds of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          publish('/app/typing', {
            conversationId: parseInt(conversationId),
            typing: false,
          });
        }, 3000);
      }
    }
  }, [connected, conversationId, publish]);
  
  // Handle resolve
  const handleResolve = useCallback(async () => {
    if (!conversation) return;
    
    setIsResolving(true);
    try {
      await apiClient.put<ConversationResponse>(
        `/api/conversations/${conversationId}/resolve`,
        {}
      );
      antdMessage.success('Conversation resolved');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to resolve conversation:', error);
      antdMessage.error('Failed to resolve conversation');
    } finally {
      setIsResolving(false);
    }
  }, [conversation, conversationId, router]);
  
  // Handle return to queue
  const handleReturnToQueue = useCallback(async () => {
    if (!conversation) return;
    
    setIsReturning(true);
    try {
      await apiClient.put<ConversationResponse>(
        `/api/conversations/${conversationId}/return-to-queue`,
        {}
      );
      antdMessage.success('Conversation returned to queue');
      router.push('/dashboard');
    } catch (error) {
      console.error('Failed to return to queue:', error);
      antdMessage.error('Failed to return conversation to queue');
    } finally {
      setIsReturning(false);
    }
  }, [conversation, conversationId, router]);
  
  // Initial data fetch
  useEffect(() => {
    fetchConversation();
    fetchMessages();
  }, [fetchConversation, fetchMessages]);
  
  // WebSocket subscriptions
  useEffect(() => {
    if (!connected) return;
    
    // Subscribe to new messages
    const messageSub = subscribe(`/topic/conversation/${conversationId}`, (msg) => {
      const messageData: MessageResponse = JSON.parse(msg.body);
      
      // Deduplicate - check if message already exists by clientMessageId or id
      setMessages(prev => {
        const exists = prev.some(m => 
          (m.clientMessageId && messageData.clientMessageId && m.clientMessageId === messageData.clientMessageId) ||
          m.id === messageData.id
        );
        
        if (exists) return prev;
        
        return [...prev, messageData].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
      });
      
      // Scroll to bottom on new message
      setTimeout(() => scrollToBottom(), 100);
    });
    
    // Subscribe to typing indicator
    const typingSub = subscribe(`/topic/conversation/${conversationId}/typing`, (msg) => {
      const typingData: TypingEvent = JSON.parse(msg.body);
      setVisitorTyping(typingData.typing);
      
      // Auto-clear typing indicator after 5 seconds
      if (typingData.typing) {
        setTimeout(() => setVisitorTyping(false), 5000);
      }
    });
    
    messageSubscriptionRef.current = messageSub;
    typingSubscriptionRef.current = typingSub;
    
    return () => {
      messageSub?.unsubscribe();
      typingSub?.unsubscribe();
    };
  }, [connected, conversationId, subscribe, scrollToBottom]);

  // Update last seen sequence number when messages change
  useEffect(() => {
    if (messages.length > 0) {
      const latestMessage = messages[messages.length - 1];
      localStorage.setItem(`lastSeen:${conversationId}`, latestMessage.sequenceNumber.toString());
    }
  }, [messages, conversationId]);
  
  // Insert canned response
  const insertCannedResponse = useCallback((response: CannedResponse) => {
    const textarea = inputRef.current?.resizableTextArea?.textArea;
    if (!textarea) {
      setInputValue(response.content);
      setShowCannedDropdown(false);
      return;
    }
    
    const cursorPos = textarea.selectionStart || 0;
    const textBefore = inputValue.substring(0, cursorPos);
    const textAfter = inputValue.substring(cursorPos);
    
    // Find the start of the slash command
    const lines = textBefore.split('\n');
    const currentLineStart = textBefore.lastIndexOf('\n') + 1;
    const beforeSlash = inputValue.substring(0, currentLineStart);
    const slashMatch = lines[lines.length - 1].match(/\/([ a-zA-Z0-9-_]*)$/);
    
    if (slashMatch) {
      const newValue = beforeSlash + response.content + textAfter;
      setInputValue(newValue);
      setShowCannedDropdown(false);
      setCannedFilter("");
      
      // Set cursor after inserted content
      setTimeout(() => {
        const newCursorPos = beforeSlash.length + response.content.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
        textarea.focus();
      }, 0);
    }
  }, [inputValue]);

    // Keyboard handler
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showCannedDropdown) {
      const filtered = cannedResponses.filter(cr => 
        cr.shortcut.toLowerCase().includes(cannedFilter)
      );
      
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedCannedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedCannedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (filtered[selectedCannedIndex]) {
          insertCannedResponse(filtered[selectedCannedIndex]);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setShowCannedDropdown(false);
        setCannedFilter("");
      }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [showCannedDropdown, cannedResponses, cannedFilter, selectedCannedIndex, handleSend, insertCannedResponse]);
  
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }
    
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  // Get status color
  const getStatusColor = (status: ConversationStatus) => {
    switch (status) {
      case 'WAITING': return 'gold';
      case 'ACTIVE': return 'blue';
      case 'RESOLVED': return 'green';
      case 'CLOSED': return 'default';
      default: return 'default';
    }
  };
  
  const isConversationClosed = conversation?.status === 'RESOLVED' || conversation?.status === 'CLOSED';
  
  
  // Filter canned responses for dropdown
  const filteredCannedResponses = React.useMemo(() => {
    if (!showCannedDropdown) return [];
    return cannedResponses.filter(cr => 
      cr.shortcut.toLowerCase().includes(cannedFilter)
    ).slice(0, 5);
  }, [showCannedDropdown, cannedResponses, cannedFilter]);


  if (isLoadingConversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Spin size="large" />
      </div>
    );
  }
  
  if (!conversation) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Card>
          <p className="text-gray-500">Conversation not found</p>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Avatar icon={<UserOutlined />} size={40} className="bg-blue-500" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  {conversation.visitorName || 'Anonymous Visitor'}
                </span>
                <Tag color={getStatusColor(conversation.status)}>
                  {conversation.status}
                </Tag>
              </div>
              {conversation.visitorEmail && (
                <span className="text-sm text-gray-500">{conversation.visitorEmail}</span>
              )}
            </div>
          </div>        {/* Canned Responses Dropdown */}
        {showCannedDropdown && filteredCannedResponses.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '100%',
            left: 24,
            right: 24,
            marginBottom: 8,
            backgroundColor: 'white',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            maxHeight: 200,
            overflowY: 'auto',
            zIndex: 1000,
          }}>
            {filteredCannedResponses.map((response, index) => (
              <div
                key={response.id}
                onClick={() => insertCannedResponse(response)}
                style={{
                  padding: '8px 12px',
                  cursor: 'pointer',
                  backgroundColor: index === selectedCannedIndex ? '#e6f4ff' : 'white',
                  borderBottom: index < filteredCannedResponses.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
                onMouseEnter={() => setSelectedCannedIndex(index)}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: '#1890ff', marginBottom: 2 }}>
                  /{response.shortcut}
                </div>
                <div style={{ fontSize: '12px', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {response.content}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="flex gap-2">
            <Button
              icon={<RollbackOutlined />}
              onClick={handleReturnToQueue}
              loading={isReturning}
              disabled={isConversationClosed || isReturning}
            >
              Return to Queue
            </Button>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleResolve}
              loading={isResolving}
              disabled={isConversationClosed || isResolving}
              className="bg-[#2563eb] hover:bg-[#1d4ed8]"
            >
              Resolve
            </Button>
          </div>
        </div>
      </div>
      
      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4"
        onScroll={handleScroll}
      >
        {isLoadingOlder && (
          <div className="flex justify-center py-2">
            <Spin indicator={<LoadingOutlined style={{ fontSize: 20 }} spin />} />
          </div>
        )}
        
        {isLoadingMessages ? (
          <div className="flex items-center justify-center h-full">
            <Spin size="large" />
          </div>
        ) : (
          <>
            {messages.map((msg) => {
              const isAgent = msg.senderType === 'AGENT';
              const isSystem = msg.senderType === 'SYSTEM';
              const isVisitor = msg.senderType === 'VISITOR';
              
              if (isSystem) {
                return (
                  <div key={msg.id} className="flex justify-center my-4">
                    <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                      {msg.content}
                    </div>
                  </div>
                );
              }
              
              return (
                <div
                  key={msg.id}
                  className={`flex mb-4 ${isAgent ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex gap-2 max-w-[70%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}>
                    <Avatar
                      icon={<UserOutlined />}
                      size={32}
                      className={isAgent ? 'bg-[#2563eb]' : 'bg-gray-400'}
                    />
                    <div>
                      <div
                        className={`px-4 py-2 rounded-lg ${
                          isAgent
                            ? 'bg-[#2563eb] text-white rounded-tr-none'
                            : 'bg-gray-200 text-gray-900 rounded-tl-none'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      </div>
                      <div className={`text-xs text-gray-500 mt-1 ${isAgent ? 'text-right' : 'text-left'}`}>
                        {formatTimestamp(msg.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            
            {visitorTyping && (
              <div className="flex justify-start mb-4">
                <div className="flex gap-2 items-center">
                  <Avatar icon={<UserOutlined />} size={32} className="bg-gray-400" />
                  <div className="bg-gray-200 px-4 py-2 rounded-lg rounded-tl-none text-gray-600 italic text-sm">
                    Visitor is typing...
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-6 py-4" style={{ position: "relative" }}>
        {isConversationClosed && (
          <div className="mb-3 text-center text-sm text-gray-500">
            This conversation is {conversation.status.toLowerCase()}. You cannot send new messages.
          </div>
        )}
        
        <div className="flex gap-2">
          <TextArea
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={isConversationClosed ? 'Conversation closed' : 'Type a message... (Press Enter to send, Shift+Enter for new line)'}
            autoSize={{ minRows: 1, maxRows: 4 }}
            disabled={isConversationClosed || isSending}
            maxLength={MAX_MESSAGE_LENGTH}
            showCount
            className="flex-1"
          />
          <Tooltip title={isConversationClosed ? 'Cannot send to closed conversation' : 'Send message'}>
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={isSending}
              disabled={!inputValue.trim() || isConversationClosed || isSending}
              size="large"
              className="bg-[#2563eb] hover:bg-[#1d4ed8]"
            >
              Send
            </Button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
