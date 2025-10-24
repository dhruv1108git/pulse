import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
  useEffect,
} from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { useIncidents } from './IncidentContext';
import { useBle } from './BleContext';
import { API_BASE_URL } from '../constants/api';

export interface ChatMessage {
  _id: string;
  text: string;
  createdAt: Date;
  user: { _id: number; name: string; avatar?: string };
}

interface ChatContextType {
  messages: ChatMessage[];
  isLoading: boolean;
  sessionId: string;
  sendMessage: (text: string) => Promise<void>;
  clearChat: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface PendingQuery {
  queryId: string;
  messageId: string;
  text: string;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [pendingQueries, setPendingQueries] = useState<PendingQuery[]>([]);
  const { currentLocation, currentAddress, deviceId } = useIncidents();
  const bleContext = useBle();
  const netInfo = useNetInfo();
  const hasInternet = netInfo.isConnected ?? false;
  
  // Use ref to avoid dependency on messages in sendMessage callback
  const messagesRef = useRef<ChatMessage[]>(messages);
  
  // Keep ref in sync with state
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Add user message immediately
    const userMessage: ChatMessage = {
      _id: Math.random().toString(),
      text,
      createdAt: new Date(),
      user: {
        _id: 1,
        name: 'You',
      },
    };

    setMessages((previousMessages) => [userMessage, ...previousMessages]);
    setIsLoading(true);

    const queryId = `query-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      if (hasInternet) {
        // ONLINE MODE: Call API directly
        console.log('📶 Online mode: Calling API directly');
        
        // Prepare conversation history for API using ref to avoid dependency
        const conversationHistory = messagesRef.current.slice(0, 10).reverse().map((msg) => ({
          role: msg.user._id === 1 ? 'user' : 'assistant',
          content: msg.text,
        }));

        // Call AI assistant API with proper timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(`${API_BASE_URL}/api/relay/query`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query_id: queryId,
            query_text: text,
            query_type: 'assistant',
            user_location: currentLocation
              ? {
                  lat: currentLocation.coords.latitude,
                  lon: currentLocation.coords.longitude,
                }
              : { lat: 0, lon: 0 },
            original_device: deviceId,
            relayed_by: deviceId,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API error response:', errorText);
          throw new Error(`Failed to get response from assistant: ${response.status}`);
        }

        const data = await response.json();

        // Extract response text - handle nested structure from relay endpoint
        let responseText = 'Sorry, I received an invalid response.';
        if (typeof data.response === 'string') {
          responseText = data.response;
        } else if (data.response && typeof data.response.response === 'string') {
          responseText = data.response.response;
        }

        // Add AI response
        const aiMessage: ChatMessage = {
          _id: Math.random().toString(),
          text: responseText,
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Pulse AI',
            avatar: '🤖',
          },
        };

        setMessages((previousMessages) => [aiMessage, ...previousMessages]);
      } else {
        // OFFLINE MODE: Not supported on web
        const errorMessage: ChatMessage = {
          _id: Math.random().toString(),
          text: 'Offline relay is not available on web. Please connect to the internet to use the AI assistant.',
          createdAt: new Date(),
          user: {
            _id: 2,
            name: 'Pulse AI',
            avatar: '🤖',
          },
        };
        setMessages((previousMessages) => [errorMessage, ...previousMessages]);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      
      let errorText = "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.";
      
      if (error.name === 'AbortError') {
        errorText = "Request timed out. Please check your connection and try again.";
      } else if (error.message?.includes('Network request failed') || error.message?.includes('Failed to fetch')) {
        errorText = "Cannot connect to server. Please ensure the backend is running.";
      }
      
      // Add error message
      const errorMessage: ChatMessage = {
        _id: Math.random().toString(),
        text: errorText,
        createdAt: new Date(),
        user: {
          _id: 2,
          name: 'Pulse AI',
          avatar: '🤖',
        },
      };

      setMessages((previousMessages) => [errorMessage, ...previousMessages]);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, currentLocation, hasInternet, bleContext, deviceId]);

  const clearChat = useCallback(() => {
    setMessages([]);
    setPendingQueries([]);
  }, []);

  const contextValue: ChatContextType = {
    messages,
    isLoading,
    sessionId,
    sendMessage,
    clearChat,
  };

  return (
    <ChatContext.Provider value={contextValue}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}

