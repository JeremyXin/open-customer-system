'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Client } from '@stomp/stompjs';
import widgetApiClient from '@/lib/widget-api-client';
import { WS_URL } from '@/lib/constants';
import type { Conversation, ConversationStatus } from '@/types/conversation';
import type { Message, SendMessageRequest } from '@/types/message';

type WidgetState = 'LOADING' | 'PRE_CHAT' | 'CHATTING';
type ConnectionState = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING';

interface ApiResult<T> {
  code: number;
  message: string;
  data: T;
}

interface TypingEvent {
  conversationId: number;
  typing: boolean;
  agentName?: string;
}

export default function WidgetPage() {
  const [state, setState] = useState<WidgetState>('LOADING');
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Chat state
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageContent, setMessageContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);
  const [agentTypingName, setAgentTypingName] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('DISCONNECTED');
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  
  const stompClientRef = useRef<Client | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const statusPollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scheduleReconnectRef = useRef<(immediate?: boolean) => void>(() => {});
  const messagesRef = useRef<Message[]>([]);
  const shouldReconnectRef = useRef(false);
  const isResettingClientRef = useRef(false);
  const hadDisconnectRef = useRef(false);

  useEffect(() => {
    initializeWidget();
    
    return () => {
      if (stompClientRef.current) {
        shouldReconnectRef.current = false;
        stompClientRef.current.deactivate();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const getLastSequence = () =>
    messagesRef.current.reduce((max, message) => Math.max(max, message.sequenceNumber), 0);

  const mergeMessages = useCallback((incoming: Message[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const existingIds = new Set(prev.map((message) => message.id));
      const existingClientIds = new Set(
        prev.map((message) => message.clientMessageId).filter((id): id is string => Boolean(id))
      );
      const merged = [...prev];

      incoming.forEach((message) => {
        if (existingIds.has(message.id)) return;
        if (message.clientMessageId && existingClientIds.has(message.clientMessageId)) return;
        merged.push(message);
      });

      return merged.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
    });
    setTimeout(scrollToBottom, 0);
  }, []);

  const recoverMissedMessages = useCallback(async () => {
    if (!conversation) return;

    try {
      const lastSequence = getLastSequence();
      const response = await widgetApiClient.get<ApiResult<Message[]>>(
        `/api/conversations/${conversation.id}/messages?afterSequence=${lastSequence}&limit=100`
      );
      const recoveredMessages = response.data.data;
      mergeMessages(recoveredMessages);
    } catch (error) {
      console.error('Failed to recover missed messages:', error);
    }
  }, [conversation, mergeMessages]);

  const clearReconnectTimeout = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  };

  const connectWebSocket = useCallback((forceReconnect = false) => {
    if (!conversation) return;

    const visitorToken = localStorage.getItem('visitor_token');
    if (!visitorToken) return;

    if (stompClientRef.current?.active && !forceReconnect) {
      return;
    }

    if (stompClientRef.current?.active && forceReconnect) {
      isResettingClientRef.current = true;
      stompClientRef.current.deactivate();
    }

    clearReconnectTimeout();
    setConnectionState(forceReconnect ? 'RECONNECTING' : 'CONNECTING');

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        'X-Visitor-Token': visitorToken,
      },
      reconnectDelay: 0,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        console.log('WebSocket connected');
        setConnectionState('CONNECTED');
        setReconnectAttempt(0);
        clearReconnectTimeout();

        if (hadDisconnectRef.current) {
          hadDisconnectRef.current = false;
          recoverMissedMessages();
        }
        
        // Subscribe to messages
        client.subscribe(`/topic/conversation/${conversation.id}`, (message) => {
          try {
            const newMessage: Message = JSON.parse(message.body);
            
            setMessages((prev) => {
              // Deduplicate using clientMessageId
              if (newMessage.clientMessageId) {
                const exists = prev.some(
                  (m) => m.clientMessageId === newMessage.clientMessageId
                );
                if (exists) return prev;
              }
              
              // Deduplicate using message id
              if (prev.some((m) => m.id === newMessage.id)) {
                return prev;
              }
              
              return [...prev, newMessage].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
            });
          } catch (error) {
            console.error('Failed to parse message:', error);
          }
        });

        // Subscribe to typing indicators
        client.subscribe(`/topic/conversation/${conversation.id}/typing`, (message) => {
          try {
            const typingEvent: TypingEvent = JSON.parse(message.body);
            
            if (typingEvent.typing) {
              setIsAgentTyping(true);
              setAgentTypingName(typingEvent.agentName || null);
              
              // Auto-clear after 5 seconds
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
              typingTimeoutRef.current = setTimeout(() => {
                setIsAgentTyping(false);
                setAgentTypingName(null);
              }, 5000);
            } else {
              setIsAgentTyping(false);
              setAgentTypingName(null);
              if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
              }
            }
          } catch (error) {
            console.error('Failed to parse typing event:', error);
          }
        });
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        if (isResettingClientRef.current) {
          isResettingClientRef.current = false;
          return;
        }
        if (!shouldReconnectRef.current) {
          return;
        }
        hadDisconnectRef.current = true;
        setConnectionState('DISCONNECTED');
        scheduleReconnectRef.current(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
      },
      onWebSocketClose: () => {
        if (isResettingClientRef.current) {
          isResettingClientRef.current = false;
          return;
        }
        if (!shouldReconnectRef.current) {
          return;
        }
        hadDisconnectRef.current = true;
        setConnectionState('DISCONNECTED');
        scheduleReconnectRef.current(false);
      },
    });

    client.activate();
    stompClientRef.current = client;
  }, [conversation, recoverMissedMessages]);

  const scheduleReconnect = useCallback(
    (immediate = false) => {
      if (!shouldReconnectRef.current) return;

      if (!immediate && reconnectTimeoutRef.current) {
        return;
      }

      clearReconnectTimeout();
      setConnectionState('RECONNECTING');
      setReconnectAttempt((prev) => {
        const nextAttempt = prev + 1;
        const delay = immediate ? 0 : Math.min(1000 * 2 ** (nextAttempt - 1), 30000);

        if (immediate) {
          connectWebSocket(true);
        } else {
          reconnectTimeoutRef.current = setTimeout(() => {
            connectWebSocket(true);
          }, delay);
        }

        return nextAttempt;
      });
    },
    [connectWebSocket]
  );

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const startStatusPolling = useCallback(() => {
    if (!conversation) return;

    statusPollIntervalRef.current = setInterval(async () => {
      try {
        const response = await widgetApiClient.get<ApiResult<Conversation>>(
          `/api/conversations/${conversation.id}`
        );
        const updatedConversation = response.data.data;
        setConversation(updatedConversation);
      } catch (error) {
        console.error('Failed to poll conversation status:', error);
      }
    }, 10000);
  }, [conversation]);

  const initializeChat = useCallback(async () => {
    if (!conversation) return;

    try {
      // Fetch messages
      const response = await widgetApiClient.get<ApiResult<Message[]>>(
        `/api/conversations/${conversation.id}/messages?limit=50`
      );
      const fetchedMessages = response.data.data;
      setMessages(fetchedMessages.sort((a, b) => a.sequenceNumber - b.sequenceNumber));

      // Connect WebSocket
      shouldReconnectRef.current = true;
      connectWebSocket();

      // Poll status
      startStatusPolling();
    } catch (error) {
      console.error('Failed to initialize chat:', error);
    }
  }, [conversation, connectWebSocket, startStatusPolling]);

  useEffect(() => {
    if (state === 'CHATTING' && conversation) {
      initializeChat();
    }
  }, [state, conversation, initializeChat]);

  useEffect(() => {
    if (state !== 'CHATTING' || !conversation) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return;

      if (connectionState !== 'CONNECTED' || !stompClientRef.current?.connected) {
        scheduleReconnect(true);
        return;
      }

      recoverMissedMessages();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversation, connectionState, recoverMissedMessages, scheduleReconnect, state]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const initializeWidget = async () => {
    try {
      const visitorToken = localStorage.getItem('visitor_token');
      
      if (visitorToken) {
        const response = await widgetApiClient.get<ApiResult<Conversation[]>>(
          `/api/conversations?visitorToken=${visitorToken}`
        );
        
        const conversations = response.data.data;
        const activeConversation = conversations.find(
          (c: Conversation) => c.status === 'ACTIVE' || c.status === 'WAITING'
        );
        
        if (activeConversation) {
          setConversation(activeConversation);
          setState('CHATTING');
          return;
        }
        
        const storedName = localStorage.getItem('visitor_name') || '';
        const storedEmail = localStorage.getItem('visitor_email') || '';
        setName(storedName);
        setEmail(storedEmail);
      }
      
      setState('PRE_CHAT');
    } catch (error) {
      console.error('Failed to initialize widget:', error);
      setState('PRE_CHAT');
    }
  };

  const handleTyping = (typing: boolean) => {
    if (!conversation || !stompClientRef.current?.connected) return;

    try {
      stompClientRef.current.publish({
        destination: '/app/typing',
        body: JSON.stringify({
          conversationId: conversation.id,
          typing,
        }),
      });
    } catch (error) {
      console.error('Failed to send typing indicator:', error);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageContent.trim() || !conversation || isSending) return;
    if (conversation.status === 'RESOLVED' || conversation.status === 'CLOSED') return;

    const clientMessageId = crypto.randomUUID();
    const content = messageContent.trim();
    
    // Optimistic UI
    const optimisticMessage: Message = {
      id: Date.now(), // Temporary ID
      conversationId: conversation.id,
      senderType: 'VISITOR',
      content,
      clientMessageId,
      sequenceNumber: messages.length + 1,
      createdAt: new Date().toISOString(),
    };
    
    setMessages((prev) => [...prev, optimisticMessage]);
    setMessageContent('');
    setIsSending(true);
    handleTyping(false);

    try {
      const request: SendMessageRequest = {
        content,
        senderType: 'VISITOR',
        clientMessageId,
      };
      
      const response = await widgetApiClient.post<ApiResult<Message>>(
        `/api/conversations/${conversation.id}/messages`,
        request
      );
      
      const serverMessage = response.data.data;
      
      // Replace optimistic message with server message
      setMessages((prev) =>
        prev.map((m) =>
          m.clientMessageId === clientMessageId ? serverMessage : m
        )
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      
      // Remove optimistic message on error
      setMessages((prev) =>
        prev.filter((m) => m.clientMessageId !== clientMessageId)
      );
      
      setMessageContent(content);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  const handleInputChange = (value: string) => {
    if (value.length <= 5000) {
      setMessageContent(value);
      
      // Send typing indicator
      if (value.trim()) {
        handleTyping(true);
      } else {
        handleTyping(false);
      }
    }
  };

  const handleNewChat = () => {
    localStorage.removeItem('conversation_id');
    setConversation(null);
    setMessages([]);
    setMessageContent('');
    setState('PRE_CHAT');
    setConnectionState('DISCONNECTED');
    setReconnectAttempt(0);
    shouldReconnectRef.current = false;
    clearReconnectTimeout();
    
    if (stompClientRef.current) {
      isResettingClientRef.current = true;
      stompClientRef.current.deactivate();
    }
    if (statusPollIntervalRef.current) {
      clearInterval(statusPollIntervalRef.current);
    }
  };

  useEffect(() => {
    if (state !== 'CHATTING' || !conversation) return;

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimeout();
      if (stompClientRef.current) {
        isResettingClientRef.current = true;
        stompClientRef.current.deactivate();
      }
      if (statusPollIntervalRef.current) {
        clearInterval(statusPollIntervalRef.current);
      }
    };
  }, [state, conversation]);

  const handleClose = () => {
    window.parent.postMessage({ type: 'widget-close' }, '*');
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const newErrors: { name?: string; email?: string } = {};
    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid email';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setErrors({});
    setIsSubmitting(true);
    
    try {
      let visitorToken = localStorage.getItem('visitor_token');
      if (!visitorToken) {
        visitorToken = crypto.randomUUID();
        localStorage.setItem('visitor_token', visitorToken);
      }
      
      localStorage.setItem('visitor_name', name);
      localStorage.setItem('visitor_email', email);
      
      const response = await widgetApiClient.post<ApiResult<Conversation>>(
        '/api/conversations',
        {
          visitorName: name,
          visitorEmail: email,
          initialMessage: 'Chat started'
        }
      );
      
      const newConversation = response.data.data;
      localStorage.setItem('conversation_id', newConversation.id.toString());
      
      setConversation(newConversation);
      setState('CHATTING');
    } catch (error) {
      console.error('Failed to create conversation:', error);
      setErrors({ email: 'Failed to start chat. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const getStatusDisplay = () => {
    if (!conversation) return null;

    if (connectionState === 'CONNECTING') {
      return (
        <div className="flex items-center gap-2 text-blue-100">
          <div className="w-2 h-2 rounded-full bg-blue-200 animate-pulse" />
          <span className="text-sm">Connecting...</span>
        </div>
      );
    }

    if (connectionState === 'RECONNECTING') {
      return (
        <div className="flex items-center gap-2 text-blue-100">
          <div className="w-2 h-2 rounded-full bg-yellow-200 animate-pulse" />
          <span className="text-sm">Reconnecting...</span>
        </div>
      );
    }

    if (connectionState === 'DISCONNECTED') {
      return (
        <div className="flex items-center gap-2 text-blue-100">
          <div className="w-2 h-2 rounded-full bg-yellow-200" />
          <span className="text-sm">Connection lost</span>
        </div>
      );
    }

    switch (conversation.status) {
      case 'WAITING':
        return (
          <div className="flex items-center gap-2 text-blue-100">
            <div className="w-2 h-2 rounded-full bg-blue-200 animate-pulse" />
            <span className="text-sm">Waiting for an agent...</span>
          </div>
        );
      case 'ACTIVE':
        return (
          <div className="flex items-center gap-2 text-blue-100">
            <div className="w-2 h-2 rounded-full bg-green-400" />
            <span className="text-sm">Connected with Support</span>
          </div>
        );
      case 'RESOLVED':
        return (
          <div className="flex items-center gap-2 text-blue-100">
            <div className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-sm">Conversation resolved</span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div>
              <h1 className="font-semibold text-lg">Support</h1>
              {state === 'CHATTING' ? getStatusDisplay() : <p className="text-xs text-blue-100">We&rsquo;re here to help</p>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {state === 'CHATTING' && conversation?.status === 'RESOLVED' && (
            <button
              onClick={handleNewChat}
              className="px-3 py-1.5 text-sm rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
            >
              New Chat
            </button>
          )}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full hover:bg-white/20 flex items-center justify-center transition-colors"
            aria-label="Close chat"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      {state === 'LOADING' && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      )}

      {state === 'PRE_CHAT' && (
        <div className="flex-1 flex items-center justify-center p-6 bg-gradient-to-br from-gray-50 to-white overflow-auto">
          <div className="w-full max-w-md space-y-6 animate-fade-in">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="36"
                  height="36"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                </svg>
              </div>
              <h2 className="mt-6 text-3xl font-bold text-gray-900">
                Welcome!
              </h2>
              <p className="mt-2 text-gray-600">
                Start a conversation with our support team
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                  Your Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={`w-full px-4 py-3 border ${
                    errors.name ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
                  placeholder="John Doe"
                  disabled={isSubmitting}
                />
                {errors.name && (
                  <p className="mt-2 text-sm text-red-600">{errors.name}</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={`w-full px-4 py-3 border ${
                    errors.email ? 'border-red-300' : 'border-gray-300'
                  } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none`}
                  placeholder="john@example.com"
                  disabled={isSubmitting}
                />
                {errors.email && (
                  <p className="mt-2 text-sm text-red-600">{errors.email}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-medium rounded-lg hover:from-blue-700 hover:to-blue-800 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Starting Chat...</span>
                  </>
                ) : (
                  <>
                    <span>Start Chat</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 text-center">
              <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span>Typically replies in minutes</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {state === 'CHATTING' && conversation && (
        <>
          <div
            className={`fixed left-0 right-0 top-[72px] z-20 mx-auto flex w-full max-w-3xl justify-center px-6 transition-all duration-300 ease-out ${
              connectionState === 'DISCONNECTED' || connectionState === 'RECONNECTING'
                ? 'translate-y-0 opacity-100'
                : '-translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <div className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
              <span className="font-medium">
                Connection lost. Reconnecting...
              </span>
              {connectionState === 'RECONNECTING' && reconnectAttempt > 0 && (
                <span className="ml-2 text-amber-700">
                  (attempt {reconnectAttempt})
                </span>
              )}
            </div>
          </div>
          {/* Resolved Banner */}
          {conversation.status === 'RESOLVED' && (
            <div className="px-4 py-3 bg-yellow-50 border-b border-yellow-200 text-center">
              <p className="text-sm text-yellow-800 font-medium">
                This conversation has been resolved
              </p>
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.senderType === 'VISITOR'
                    ? 'justify-end'
                    : message.senderType === 'SYSTEM'
                    ? 'justify-center'
                    : 'justify-start'
                }`}
              >
                {message.senderType === 'SYSTEM' ? (
                  <div className="max-w-xs px-4 py-2 bg-gray-200 text-gray-600 text-sm rounded-full text-center">
                    {message.content}
                  </div>
                ) : (
                  <div className={`max-w-xs lg:max-w-md ${message.senderType === 'VISITOR' ? 'text-right' : 'text-left'}`}>
                    <div
                      className={`inline-block px-4 py-2.5 rounded-2xl ${
                        message.senderType === 'VISITOR'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 rounded-bl-sm shadow-sm'
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{message.content}</p>
                    </div>
                    <p className="mt-1 text-xs text-gray-500 px-1">
                      {formatTime(message.createdAt)}
                    </p>
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {isAgentTyping && (
              <div className="flex justify-start">
                <div className="max-w-xs lg:max-w-md">
                  <div className="inline-block px-4 py-2.5 rounded-2xl bg-white text-gray-900 rounded-bl-sm shadow-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 px-1">
                    {agentTypingName || 'Agent'} is typing...
                  </p>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-gray-200 bg-white p-4">
            <form onSubmit={handleSendMessage} className="flex gap-3">
              <div className="flex-1 relative">
                <textarea
                  value={messageContent}
                  onChange={(e) => handleInputChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    conversation.status === 'RESOLVED' || conversation.status === 'CLOSED'
                      ? 'This conversation is closed'
                      : 'Type a message...'
                  }
                  disabled={
                    isSending ||
                    conversation.status === 'RESOLVED' ||
                    conversation.status === 'CLOSED'
                  }
                  className="w-full px-4 py-3 pr-16 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none disabled:bg-gray-50 disabled:cursor-not-allowed"
                  rows={1}
                  style={{ minHeight: '48px', maxHeight: '120px' }}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = '48px';
                    target.style.height = Math.min(target.scrollHeight, 120) + 'px';
                  }}
                />
                <span className="absolute bottom-3 right-3 text-xs text-gray-400">
                  {messageContent.length}/5000
                </span>
              </div>
              <button
                type="submit"
                disabled={
                  !messageContent.trim() ||
                  isSending ||
                  conversation.status === 'RESOLVED' ||
                  conversation.status === 'CLOSED'
                }
                className="px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {isSending ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </form>
            <p className="mt-2 text-xs text-gray-500 text-center">
              Press Enter to send, Shift+Enter for new line
            </p>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center text-xs text-gray-500">
        Powered by Open Customer System
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
