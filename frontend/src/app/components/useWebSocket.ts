'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

// WebSocket message types
interface WSMessage {
  type: 'status' | 'text' | 'result' | 'error' | 'complete' | 'step';
  payload: any;
  timestamp: number;
}

export interface StatusPayload {
  step: string;
  message: string;
}

export interface StepPayload {
  step: string;
  message: string;
}

export interface TextPayload {
  content: string;
  accumulated: string;
}

export interface ResultPayload {
  success: boolean;
  result: SkillAnalysisResult;
}

export interface ErrorPayload {
  message: string;
}

export interface SkillAnalysisResult {
  overall_score: number;
  dimensions: {
    clarity: number;
    completeness: number;
    correctness: number;
    usability: number;
    documentation: number;
  };
  issues: Array<{
    severity: 'error' | 'warning' | 'info';
    file: string;
    message: string;
  }>;
  suggestions: string[];
  summary: string;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  streamingContent: string;
  currentStatus: StatusPayload | null;
  currentStep: StepPayload | null;
  finalResult: SkillAnalysisResult | null;
  error: string | null;
  isComplete: boolean;
  registerSession: (sessionId: string) => void;
  reset: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [streamingContent, setStreamingContent] = useState('');
  const [currentStatus, setCurrentStatus] = useState<StatusPayload | null>(null);
  const [currentStep, setCurrentStep] = useState<StepPayload | null>(null);
  const [finalResult, setFinalResult] = useState<SkillAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isComplete, setIsComplete] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const registeredSessionRef = useRef<string | null>(null);
  const shouldReconnectRef = useRef(true);

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8002';

  const connect = useCallback(() => {
    // Don't reconnect if already connected or connecting
    if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) {
      return;
    }

    setConnectionStatus('connecting');

    try {
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setConnectionStatus('connected');
        setError(null);
        // Re-register session if we had one
        if (registeredSessionRef.current) {
          ws.send(JSON.stringify({
            type: 'register',
            sessionId: registeredSessionRef.current
          }));
        }
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          switch (message.type) {
            case 'status':
              setCurrentStatus(message.payload as StatusPayload);
              break;

            case 'step':
              setCurrentStep(message.payload as StepPayload);
              break;

            case 'text':
              const textPayload = message.payload as TextPayload;
              // Accumulate text content
              setStreamingContent(prev => prev + textPayload.content);
              break;

            case 'result':
              const resultPayload = message.payload as ResultPayload;
              if (resultPayload.success && resultPayload.result) {
                setFinalResult(resultPayload.result);
              }
              break;

            case 'error':
              const errorPayload = message.payload as ErrorPayload;
              setError(errorPayload.message);
              break;

            case 'complete':
              setIsComplete(true);
              break;
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      ws.onerror = () => {
        // WebSocket error events don't contain useful info
        // The actual error will be reflected in onclose
        console.log('WebSocket connection error - server may not be running');
      };

      ws.onclose = (event) => {
        setConnectionStatus('disconnected');

        // Only reconnect if not a normal closure and should reconnect
        if (shouldReconnectRef.current && event.code !== 1000) {
          if (reconnectTimeoutRef.current) {
            clearTimeout(reconnectTimeoutRef.current);
          }
          reconnectTimeoutRef.current = setTimeout(() => {
            if (shouldReconnectRef.current) {
              connect();
            }
          }, 3000);
        }
      };

    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setConnectionStatus('error');
    }
  }, [WS_URL]);

  const registerSession = useCallback((sessionId: string) => {
    registeredSessionRef.current = sessionId;

    // If WebSocket is connected, send immediately
    // If not connected, it will be sent when connection opens
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'register',
        sessionId
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setStreamingContent('');
    setCurrentStatus(null);
    setCurrentStep(null);
    setFinalResult(null);
    setError(null);
    setIsComplete(false);
    registeredSessionRef.current = null;
  }, []);

  useEffect(() => {
    shouldReconnectRef.current = true;
    connect();

    return () => {
      shouldReconnectRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounted');
      }
    };
  }, [connect]);

  return {
    connectionStatus,
    streamingContent,
    currentStatus,
    currentStep,
    finalResult,
    error,
    isComplete,
    registerSession,
    reset
  };
}
