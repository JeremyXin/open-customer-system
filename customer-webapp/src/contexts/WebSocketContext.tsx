'use client';

import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { Client, IMessage, StompSubscription } from '@stomp/stompjs';
import { WS_URL } from '@/lib/constants';

interface WebSocketContextType {
  client: Client | null;
  connected: boolean;
  subscribe: (destination: string, callback: (message: IMessage) => void) => StompSubscription | null;
  publish: (destination: string, body: any) => void;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider = ({ children }: { children: ReactNode }) => {
  const [connected, setConnected] = useState(false);
  const clientRef = useRef<Client | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleReconnect = useCallback((connectFn: () => void) => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000);
    reconnectAttemptRef.current += 1;

    console.log(`Scheduling reconnect in ${delay}ms (attempt ${reconnectAttemptRef.current})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      console.log('Attempting to reconnect...');
      connectFn();
    }, delay);
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('access_token');
    
    if (!token) {
      console.log('No access token found, skipping WebSocket connection');
      return;
    }

    const client = new Client({
      brokerURL: WS_URL,
      connectHeaders: {
        Authorization: `Bearer ${token}`,
      },
      reconnectDelay: 0,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log('WebSocket connected');
        setConnected(true);
        reconnectAttemptRef.current = 0;
      },
      onDisconnect: () => {
        console.log('WebSocket disconnected');
        setConnected(false);
      },
      onStompError: (frame) => {
        console.error('STOMP error:', frame);
        setConnected(false);
        scheduleReconnect(connect);
      },
      onWebSocketClose: () => {
        console.log('WebSocket closed');
        setConnected(false);
        scheduleReconnect(connect);
      },
      onWebSocketError: (error) => {
        console.error('WebSocket error:', error);
        setConnected(false);
      },
    });

    clientRef.current = client;
    client.activate();
  }, [scheduleReconnect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (clientRef.current) {
      clientRef.current.deactivate();
      clientRef.current = null;
    }

    setConnected(false);
  }, []);

  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  const subscribe = useCallback((destination: string, callback: (message: IMessage) => void): StompSubscription | null => {
    if (!clientRef.current || !connected) {
      console.warn('Cannot subscribe: WebSocket not connected');
      return null;
    }

    return clientRef.current.subscribe(destination, callback);
  }, [connected]);

  const publish = useCallback((destination: string, body: any) => {
    if (!clientRef.current || !connected) {
      console.warn('Cannot publish: WebSocket not connected');
      return;
    }

    clientRef.current.publish({
      destination,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }, [connected]);

  const value: WebSocketContextType = {
    client: clientRef.current,
    connected,
    subscribe,
    publish,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};
