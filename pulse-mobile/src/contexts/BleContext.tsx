import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import { BleManager } from "react-native-ble-plx";
import BleAdvertiser from "react-native-ble-advertiser";
import { useNetInfo } from "@react-native-community/netinfo";
import {
  MessageState,
  broadcastOverBle,
  stopBleBroadcast,
  encodeMessageToChunks,
  decodeSingleChunk,
  listenOverBle,
} from "../utils/bleUtils";
import { API_BASE_URL } from "../constants/api";

// TextDecoder is polyfilled in index.js - declare for TypeScript
declare const TextDecoder: typeof import('text-encoding').TextDecoder;

export interface RelayMessage {
  type: 'RELAY_QUERY' | 'RELAY_RESPONSE';
  query_id: string;
  query_text?: string;
  query_type?: 'assistant' | 'sos';
  location?: { lat: number; lon: number };
  original_device?: string;
  response?: string;
  sos_data?: any;
}

export type RelayResponseCallback = (queryId: string, response: string) => void;

interface BleContextType {
  // State
  isBroadcasting: boolean;
  hasInternet: boolean;
  isMaster: boolean;
  isScanning: boolean;
  connectedPeers: number;
  messagesReceived: number;
  messagesBroadcasting: number;
  masterState: Map<number, MessageState>;
  broadcastQueue: Map<number, Uint8Array[]>;

  // Actions
  broadcastMessage: (message: string) => Promise<void>;
  startBroadcasting: () => void;
  stopBroadcasting: () => void;
  clearAllAndStop: () => Promise<void>;

  // Relay methods
  relayQuery: (queryId: string, queryText: string, queryType: 'assistant' | 'sos', location: any, originalDevice: string, sosData?: any) => Promise<void>;
  relayResponse: (queryId: string, response: string) => Promise<void>;
  onRelayResponse: (callback: RelayResponseCallback) => void;

  // Utility functions
  getCurrentBroadcastInfo: () => { id?: number; text?: string };
  getProgressFor: (state: MessageState) => {
    received: number;
    total: number;
    percent: number;
  };

  // Force re-render trigger for UI updates
  forceUpdate: () => void;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

interface BleProviderProps {
  children: ReactNode;
}

export const BleProvider: React.FC<BleProviderProps> = ({ children }) => {
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [, forceRerender] = useState(0);

  // Use NetInfo to get real network connectivity status
  const netInfo = useNetInfo();
  const hasInternet = netInfo.isConnected ?? false;

  // Refs for persistent state
  const managerRef = useRef<BleManager | null>(null);
  const masterStateRef = useRef<Map<number, MessageState>>(new Map());
  const broadcastQueueRef = useRef<Map<number, Uint8Array[]>>(new Map());
  const masterIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const broadcastCursorRef = useRef<{ queueIndex: number; chunkIndex: number }>(
    {
      queueIndex: 0,
      chunkIndex: 0,
    }
  );
  const stopScannerRef = useRef<(() => void) | null>(null);
  
  // Track our own broadcast message IDs vs received message IDs
  const ownMessageIdsRef = useRef<Set<number>>(new Set());
  const receivedMessageIdsRef = useRef<Set<number>>(new Set());
  
  // Track peer activity with timestamps (for timeout-based peer counting)
  const peerActivityRef = useRef<Map<number, number>>(new Map()); // messageId -> lastSeenTimestamp
  const PEER_TIMEOUT = 60000; // Consider peer inactive after 60 seconds
  
  // Heartbeat mechanism for peer discovery
  const deviceIdRef = useRef<string>(`device-${Math.random().toString(36).substr(2, 9)}`);
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const peerHeartbeatsRef = useRef<Map<string, number>>(new Map()); // deviceId -> lastSeenTimestamp
  const HEARTBEAT_INTERVAL_MS = 3000; // Broadcast presence every 3 seconds
  const HEARTBEAT_TIMEOUT_MS = 15000; // Consider peer dead after 15 seconds without heartbeat

  // Relay functionality
  const relayResponseCallbackRef = useRef<RelayResponseCallback | null>(null);
  const processedRelayQueriesRef = useRef<Set<string>>(new Set()); // Track processed query IDs
  const rebroadcastedQueryIdsRef = useRef<Set<string>>(new Set()); // Track rebroadcasted query IDs (prevents infinite loops)
  const querySenderMapRef = useRef<Map<string, string>>(new Map()); // Map query_id -> sender device_id (prevents sending back to sender)

  // Force update function for UI re-renders
  const forceUpdate = () => {
    forceRerender((n) => n + 1);
  };

  // Handle incoming BLE chunks
  const handleIncomingChunk = (chunk: Uint8Array) => {
    const decoded = decodeSingleChunk(chunk);
    if (!decoded) return;

    const { id, totalChunks, chunkNumber, isAck, decodedData } = decoded;
    
    // CRITICAL: Filter out heartbeat messages completely (special format: "HEARTBEAT:<deviceId>")
    // Check the raw decoded data, trimmed of any padding
    const trimmedData = decodedData?.trim() || '';
    if (trimmedData.startsWith('HEARTBEAT:')) {
      const peerDeviceId = trimmedData.replace('HEARTBEAT:', '').trim();
      if (peerDeviceId && peerDeviceId !== deviceIdRef.current) {
        peerHeartbeatsRef.current.set(peerDeviceId, Date.now());
        forceUpdate(); // Update UI to show new peer count
      }
      return; // STOP - Don't process heartbeats as regular messages
    }
    
    // CRITICAL: Ignore our own broadcasts (should already be filtered, but double-check)
    if (ownMessageIdsRef.current.has(id)) {
      // This is our own message, ignore it completely
      return;
    }
    
    const masterState = masterStateRef.current;
    let entry = masterState.get(id);
    
    // Track received message IDs (from other devices)
    if (!receivedMessageIdsRef.current.has(id)) {
      receivedMessageIdsRef.current.add(id);
      peerActivityRef.current.set(id, Date.now());
      forceUpdate(); // Update UI to reflect new peer
    }

    if (entry && !entry.isAck && isAck) {
      // This is the first chunk of a response to our request.
      // Instead of deleting the state, we update it to receive the response.
      entry.isAck = true;
      entry.isComplete = false;
      entry.fullMessage = ""; // Clear the old request message text
      entry.chunks.clear(); // Clear the old request chunks
      entry.totalChunks = totalChunks; // Update with the new total for the response
    }

    if (!entry) {
      entry = {
        id,
        totalChunks,
        isComplete: false,
        isAck,
        chunks: new Map<number, Uint8Array>(),
        fullMessage: "",
      };
      masterState.set(id, entry);
    }

    if (entry.isComplete || entry.chunks.has(chunkNumber)) {
      return;
    }

    entry.chunks.set(chunkNumber, chunk);
    forceUpdate();

    if (entry.chunks.size === entry.totalChunks) {
      entry.isComplete = true;

      // --- CORRECTED REASSEMBLY LOGIC ---
      const DATA_PER_CHUNK = 6;
      const fullBinary = new Uint8Array(entry.totalChunks * DATA_PER_CHUNK);
      let offset = 0;

      // This loop ensures chunks are placed in the correct order (1, 2, 3, ...),
      // regardless of the order they were received in.
      for (let i = 1; i <= entry.totalChunks; i++) {
        const part = entry.chunks.get(i)!.slice(3); // Get chunk by its number and slice header
        fullBinary.set(part, offset);
        offset += part.length;
      }

      const decoder = new TextDecoder();
      const fullMessage = decoder.decode(fullBinary).replace(/\0/g, ""); // Remove null padding
      entry.fullMessage = fullMessage;
      // --- END OF FIX ---

      forceUpdate();

      // Process complete messages
      if (!entry.isAck) {
        // This is a complete incoming message (not an acknowledgement)
        console.log('📨 Complete message received:', fullMessage.substring(0, 100));
        
        if (hasInternet) {
          // Online: Process the message (might be a relay query that needs processing)
          console.log('📶 Device is ONLINE, calling handleApiResponse');
          handleApiResponse(id, fullMessage);
        } else {
          // Offline: Check if it's a relay message that needs rebroadcasting
          console.log('📡 Device is OFFLINE, checking if message needs rebroadcasting');
          try {
            const parsed = JSON.parse(fullMessage);
            if (parsed && (parsed.type === 'RELAY_QUERY' || parsed.type === 'RELAY_RESPONSE')) {
              console.log('📡 Found relay message while offline, will handle it');
              handleRelayMessage(parsed);
            }
          } catch (e) {
            // Not JSON or not a relay message, ignore
            console.log('⚠️ Received non-relay message while offline, ignoring');
          }
        }
      }
    }
  };

  // Handle API responses - when gateway device receives messages and has internet
  const handleApiResponse = async (id: number, messageText: string) => {
    try {
      console.log('📨 Message received by gateway device:', messageText.substring(0, 100));
      
      // Check if this is a relay message (RELAY_QUERY or RELAY_RESPONSE)
      let parsedMessage: any = null;
      try {
        parsedMessage = JSON.parse(messageText);
        
        // Handle relay messages (assistant queries, SOS)
        if (parsedMessage && (parsedMessage.type === 'RELAY_QUERY' || parsedMessage.type === 'RELAY_RESPONSE')) {
          await handleRelayMessage(parsedMessage);
          return; // Relay messages are handled separately
        }
        
        // Handle incident reports from offline devices
        if (parsedMessage && parsedMessage.type === 'INCIDENT_REPORT') {
          console.log('📤 Gateway device submitting offline incident to backend');
          const incident = parsedMessage.incident;
          
          try {
            // Submit to backend API
            const response = await fetch(`${API_BASE_URL}/api/incidents/store`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                report_id: incident.id,
                report_type: incident.report_type,
                title: incident.title,
                description: incident.description,
                location: incident.location,
                severity: 3,
                timestamp: new Date(incident.timestamp).toISOString(),
                device_id: parsedMessage.device_id || 'unknown',
                status: 'synced',
                mesh_relayed: true,
              }),
            });
            
            const apiResponse = response.ok
              ? JSON.stringify({ success: true, message: 'Incident stored successfully', timestamp: Date.now() })
              : JSON.stringify({ success: false, message: 'Failed to store incident', timestamp: Date.now() });
            
            // Send acknowledgement back via BLE
            const ackChunks = encodeMessageToChunks(apiResponse, { id, isAck: true });
            const ackState: MessageState = {
              id,
              totalChunks: ackChunks.length,
              isComplete: true,
              isAck: true,
              chunks: new Map(ackChunks.map((chunk, i) => [i + 1, chunk])),
              fullMessage: apiResponse,
            };
            masterStateRef.current.set(id, ackState);
            forceUpdate();
            addToBroadcastQueue(id, ackChunks);
            
            console.log('✅ Incident submitted to backend and acknowledgement sent');
          } catch (apiError) {
            console.error('❌ Failed to submit incident to backend:', apiError);
          }
          return;
        }
      } catch (e) {
        // Not JSON, ignore
        console.log('⚠️ Received non-JSON message, ignoring');
        return;
      }
      
      // Unknown message type - ignore
      console.log('⚠️ Unknown message type received, ignoring');
    } catch (err) {
      console.error("API handling error", err);
    }
  };

  // Handle relay messages (queries and responses)
  const handleRelayMessage = async (message: RelayMessage) => {
    try {
      console.log('📡 [RELAY] Received relay message:', message.type, 'Query ID:', message.query_id);
      console.log('📡 [RELAY] Full message:', JSON.stringify(message, null, 2));

      if (message.type === 'RELAY_QUERY') {
        console.log('📡 [RELAY] Processing RELAY_QUERY...');
        
        // Check if we already processed this query with backend
        if (processedRelayQueriesRef.current.has(message.query_id)) {
          console.log('✅ [RELAY] Query already processed with backend, skipping:', message.query_id);
          return;
        }

        // Check if we already rebroadcasted this query (prevents infinite loops)
        if (rebroadcastedQueryIdsRef.current.has(message.query_id)) {
          console.log('✅ [RELAY] Query already rebroadcasted, skipping to prevent loop:', message.query_id);
          return;
        }

        // If we have internet, process the query with backend
        if (hasInternet) {
          console.log('📶 [RELAY] Device has internet, processing relay query:', message.query_id);
          console.log('📶 [RELAY] API URL:', API_BASE_URL);
          processedRelayQueriesRef.current.add(message.query_id);

          try {
            const payload = {
              query_id: message.query_id,
              query_text: message.query_text,
              query_type: message.query_type,
              user_location: message.location,
              original_device: message.original_device,
              relayed_by: deviceIdRef.current,
              sos_data: message.sos_data,
            };
            
            console.log('📶 [RELAY] Sending to backend:', JSON.stringify(payload, null, 2));
            
            const response = await fetch(`${API_BASE_URL}/api/relay/query`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload),
            });

            console.log('📶 [RELAY] Backend response status:', response.status);
            
            if (!response.ok) {
              const errorText = await response.text();
              console.error('❌ [RELAY] Backend error:', errorText);
              throw new Error(`Backend returned ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ [RELAY] Query processed successfully:', JSON.stringify(result, null, 2));

            // Send response back via BLE (broadcast to all devices)
            if (result.success && result.response) {
              console.log('📡 [RELAY] Sending response back via BLE');
              await relayResponse(message.query_id, result.response);
              console.log('✅ [RELAY] Response sent via BLE');
            } else {
              console.error('❌ [RELAY] No response to send back:', result);
            }
          } catch (error) {
            console.error('❌ [RELAY] Failed to process relay query:', error);
            console.error('❌ [RELAY] Error details:', error);
          }
        } else {
          // No internet, rebroadcast the query ONCE to extend mesh range
          console.log('📡 No internet, rebroadcasting query ONCE to extend mesh:', message.query_id);
          
          // Mark as rebroadcasted to prevent infinite loops
          rebroadcastedQueryIdsRef.current.add(message.query_id);
          
          // Store sender to prevent sending back (if available)
          if (message.original_device) {
            querySenderMapRef.current.set(message.query_id, message.original_device);
          }
          
          // Rebroadcast the query as-is
          const queryJson = JSON.stringify(message);
          await broadcastMessage(queryJson);
          console.log('✅ Query rebroadcasted once');
        }
      } else if (message.type === 'RELAY_RESPONSE') {
        // This is a response to a query - deliver it to the callback or rebroadcast if offline
        console.log('📨 [RELAY_RESPONSE] Received relay response for query:', message.query_id);
        console.log('📨 [RELAY_RESPONSE] Response text:', message.response?.substring(0, 100));
        
        // Deliver to callback if we have one (we're the original requester)
        if (relayResponseCallbackRef.current && message.response) {
          console.log('✅ [RELAY_RESPONSE] Delivering response to callback');
          relayResponseCallbackRef.current(message.query_id, message.response);
        } else {
          console.log('⚠️ [RELAY_RESPONSE] No callback registered or no response in message');
        }
        
        // If we're offline, rebroadcast the response ONCE to help it reach the original sender
        if (!hasInternet && !rebroadcastedQueryIdsRef.current.has(`response-${message.query_id}`)) {
          console.log('📡 [RELAY_RESPONSE] Offline, rebroadcasting response to help it reach sender');
          rebroadcastedQueryIdsRef.current.add(`response-${message.query_id}`);
          const responseJson = JSON.stringify(message);
          await broadcastMessage(responseJson);
          console.log('✅ [RELAY_RESPONSE] Response rebroadcasted');
        }
      }
    } catch (error) {
      console.error('Error handling relay message:', error);
    }
  };

  // Relay a query via BLE (ONLY when offline)
  const relayQuery = async (
    queryId: string,
    queryText: string,
    queryType: 'assistant' | 'sos',
    location: any,
    originalDevice: string,
    sosData?: any
  ) => {
    try {
      // CRITICAL: Only broadcast if we're offline
      // If online, ChatContext should call API directly
      if (hasInternet) {
        console.log('⚠️ Device has internet, skipping BLE broadcast (should use API directly)');
        return;
      }

      const message: RelayMessage = {
        type: 'RELAY_QUERY',
        query_id: queryId,
        query_text: queryText,
        query_type: queryType,
        location,
        original_device: originalDevice,
        sos_data: sosData,
      };

      const messageJson = JSON.stringify(message);
      console.log('📡 Relaying query via BLE (OFFLINE MODE):', queryId);
      await broadcastMessage(messageJson);
    } catch (error) {
      console.error('Error relaying query:', error);
      throw error;
    }
  };

  // Relay a response via BLE
  const relayResponse = async (queryId: string, response: string) => {
    try {
      console.log('📡 [RELAY_RESPONSE] Starting to relay response for query:', queryId);
      console.log('📡 [RELAY_RESPONSE] Response text:', response.substring(0, 100));
      
      const message: RelayMessage = {
        type: 'RELAY_RESPONSE',
        query_id: queryId,
        response,
      };

      const messageJson = JSON.stringify(message);
      console.log('📡 [RELAY_RESPONSE] Message JSON length:', messageJson.length);
      console.log('📡 [RELAY_RESPONSE] Broadcasting message...');
      
      await broadcastMessage(messageJson);
      
      console.log('✅ [RELAY_RESPONSE] Response broadcast complete for query:', queryId);
    } catch (error) {
      console.error('❌ [RELAY_RESPONSE] Error relaying response:', error);
      throw error;
    }
  };

  // Set callback for relay responses
  const onRelayResponse = (callback: RelayResponseCallback) => {
    relayResponseCallbackRef.current = callback;
  };

  // Add chunks to broadcast queue
  const addToBroadcastQueue = (id: number, chunks: Uint8Array[]) => {
    broadcastQueueRef.current.set(id, chunks);
    if (!masterIntervalRef.current) {
      startMasterBroadcastLoop();
    }
  };

  // Start the master broadcast loop
  const startMasterBroadcastLoop = () => {
    setIsBroadcasting(true);
    if (masterIntervalRef.current) clearInterval(masterIntervalRef.current);

    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };

    masterIntervalRef.current = setInterval(() => {
      const entries = Array.from(broadcastQueueRef.current.entries());
      if (entries.length === 0) {
        stopMasterBroadcastLoop();
        return;
      }

      let { queueIndex, chunkIndex } = broadcastCursorRef.current;
      if (queueIndex >= entries.length) queueIndex = 0;

      const [currentId, chunksToBroadcast] = entries[queueIndex]!;
      if (!chunksToBroadcast || chunksToBroadcast.length === 0) {
        broadcastQueueRef.current.delete(currentId);
        broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };
        return;
      }

      if (chunkIndex >= chunksToBroadcast.length) chunkIndex = 0;

      try {
        broadcastOverBle(chunksToBroadcast[chunkIndex]);
      } catch (e) {
        console.error("broadcast error", e);
      }

      chunkIndex++;
      if (chunkIndex >= chunksToBroadcast.length) {
        chunkIndex = 0;
        queueIndex++;
        if (queueIndex >= entries.length) queueIndex = 0;
      }

      broadcastCursorRef.current = { queueIndex, chunkIndex };
      forceUpdate();
    }, 250);
  };

  // Stop the master broadcast loop
  const stopMasterBroadcastLoop = () => {
    if (masterIntervalRef.current) {
      clearInterval(masterIntervalRef.current);
      masterIntervalRef.current = null;
    }
    stopBleBroadcast();
    setIsBroadcasting(false);
    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };
    forceUpdate();
  };

  // Broadcast a new message
  const broadcastMessage = async (message: string) => {
    try {
      console.log('📡 [BROADCAST] Starting broadcast, message length:', message.length);
      console.log('📡 [BROADCAST] Message preview:', message.substring(0, 100));
      
      const chunks = encodeMessageToChunks(message, { isAck: false });
      const id = decodeSingleChunk(chunks[0])!.id;

      console.log('📡 [BROADCAST] Encoded into', chunks.length, 'chunks, ID:', id);

      // Mark this as our own message ID
      ownMessageIdsRef.current.add(id);

      const newState: MessageState = {
        id,
        totalChunks: chunks.length,
        isComplete: true,
        isAck: false,
        chunks: new Map(chunks.map((c, i) => [i + 1, c])),
        fullMessage: message,
      };

      masterStateRef.current.set(id, newState);
      forceUpdate();
      addToBroadcastQueue(id, chunks);
      
      console.log('✅ [BROADCAST] Message added to broadcast queue, ID:', id);
    } catch (err) {
      console.error('❌ [BROADCAST] Error broadcasting message:', err);
      throw err;
    }
  };

  // Get current broadcast info for UI
  const getCurrentBroadcastInfo = (): { id?: number; text?: string } => {
    const entries = Array.from(broadcastQueueRef.current.entries());
    if (entries.length === 0) return {};
    let idx = broadcastCursorRef.current.queueIndex;
    if (idx >= entries.length) idx = 0;
    const [id] = entries[idx];
    const state = masterStateRef.current.get(id);
    if (!state) {
      const chunks = entries[idx][1];
      try {
        const maybe = decodeSingleChunk(chunks[0]) as any;
        return {
          id,
          text: maybe?.decodedData?.slice(0, 120) ?? "Broadcasting...",
        };
      } catch {
        return { id, text: "Broadcasting..." };
      }
    }
    const maxLen = 60;
    const text =
      state.fullMessage.length > maxLen
        ? `${state.fullMessage.slice(0, maxLen)}...`
        : state.fullMessage;
    return { id: state.id, text };
  };

  // Get progress for a message state
  const getProgressFor = (state: MessageState) => {
    const received = state.chunks.size;
    const total = state.totalChunks || 1;
    const percent = Math.round((received / total) * 100);
    return { received, total, percent };
  };

  // Count active peers (messages received from others, active within timeout)
  const getActivePeerCount = (): number => {
    const now = Date.now();
    let activePeers = 0;
    
    // Clean up old peers and count active ones
    peerHeartbeatsRef.current.forEach((lastSeen, deviceId) => {
      if ((now - lastSeen) > HEARTBEAT_TIMEOUT_MS) {
        peerHeartbeatsRef.current.delete(deviceId); // Remove dead peers
      } else {
        activePeers++;
      }
    });
    
    return activePeers;
  };

  // Clear everything and stop all operations
  const clearAllAndStop = async () => {
    // Stop all current operations
    if (stopScannerRef.current) {
      stopScannerRef.current();
      stopScannerRef.current = null;
    }
    if (masterIntervalRef.current) {
      clearInterval(masterIntervalRef.current);
      masterIntervalRef.current = null;
    }
    await stopBleBroadcast();

    // Destroy the BleManager instance to clear the native cache
    if (managerRef.current) {
      managerRef.current.destroy();
      managerRef.current = null;
    }

    // Clear all application-level state
    masterStateRef.current.clear();
    broadcastQueueRef.current.clear();
    ownMessageIdsRef.current.clear();
    receivedMessageIdsRef.current.clear();
    peerActivityRef.current.clear();
    rebroadcastedQueryIdsRef.current.clear();
    querySenderMapRef.current.clear();
    processedRelayQueriesRef.current.clear();
    setIsBroadcasting(false);
    broadcastCursorRef.current = { queueIndex: 0, chunkIndex: 0 };

    // Force a UI update to reflect the cleared state
    forceUpdate();

    // Re-initialize and restart the scanner after a short delay
    setTimeout(() => {
      try {
        // Create a new BleManager instance
        managerRef.current = new BleManager();
        // Start listening again
        stopScannerRef.current = listenOverBle(
          managerRef.current,
          handleIncomingChunk
        );
        console.log("BLE stack reset and scanner restarted.");
      } catch (e) {
        console.error("Failed to restart scanner after clear:", e);
      }
    }, 500);
  };

  // Start heartbeat broadcast to announce presence to nearby devices
  // ONLY when offline - no need for heartbeat when online
  const startHeartbeatBroadcast = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    
    const sendHeartbeat = async () => {
      try {
        // CRITICAL: Only send heartbeat when OFFLINE
        // Online devices don't need mesh networking
        if (hasInternet) {
          console.log('📶 Online - skipping heartbeat broadcast');
          return;
        }
        
        const heartbeatMessage = `HEARTBEAT:${deviceIdRef.current}`;
        const chunks = encodeMessageToChunks(heartbeatMessage);
        
        if (chunks.length > 0) {
          await broadcastOverBle(chunks[0]); // Heartbeat is always 1 chunk
          console.log(`💓 Heartbeat sent (OFFLINE): ${deviceIdRef.current.substring(0, 8)}`);
        }
      } catch (error) {
        console.warn('⚠️ Heartbeat broadcast error:', error);
      }
    };
    
    // Send initial heartbeat
    sendHeartbeat();
    
    // Then send periodically (checks online status each time)
    heartbeatIntervalRef.current = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    console.log(`✅ Heartbeat broadcast started (only when offline, every ${HEARTBEAT_INTERVAL_MS}ms)`);
    console.log(`📱 Device ID: ${deviceIdRef.current}`);
  };

  // Monitor internet connectivity changes
  useEffect(() => {
    if (hasInternet) {
      // When online, clear any pending broadcasts (except relay responses)
      console.log('📶 Device came online - cleaning up mesh broadcasts');
      
      // Keep only RELAY_RESPONSE messages in queue (to help offline devices get responses)
      const entriesToKeep: [number, Uint8Array[]][] = [];
      broadcastQueueRef.current.forEach((chunks, id) => {
        const state = masterStateRef.current.get(id);
        if (state?.isAck) {
          // Keep acknowledgements/responses
          entriesToKeep.push([id, chunks]);
        } else {
          console.log(`🧹 Removing broadcast queue entry ${id} (device is online)`);
        }
      });
      
      broadcastQueueRef.current.clear();
      entriesToKeep.forEach(([id, chunks]) => {
        broadcastQueueRef.current.set(id, chunks);
      });
      
      // Stop broadcasting loop if no more messages to send
      if (broadcastQueueRef.current.size === 0 && masterIntervalRef.current) {
        stopMasterBroadcastLoop();
        console.log('🛑 Stopped broadcast loop (device is online)');
      }
    }
  }, [hasInternet]);

  // Initialize BLE on mount
  useEffect(() => {
    const initBle = async () => {
      try {
        // Check if BLE is available (won't work in standard Expo Go)
        if (!BleManager || typeof BleManager !== 'function') {
          console.warn('⚠️ BLE NOT AVAILABLE');
          console.warn('BLE native modules require an Expo Development Build');
          console.warn('Standard Expo Go does NOT support BLE');
          console.warn('Options: 1) expo run:android, or 2) eas build --profile development');
          return;
        }

        // Initialize BLE Manager
        managerRef.current = new BleManager();
        console.log('✅ BLE Manager initialized');
        console.log(`📱 My Device ID: ${deviceIdRef.current}`);
        
        // Check BLE state
        const state = await managerRef.current.state();
        console.log(`📡 BLE State: ${state}`);
        
        if (state !== 'PoweredOn') {
          console.warn(`⚠️ BLE is not powered on. Current state: ${state}`);
          console.warn('Please enable Bluetooth on your device');
        }
        
        if (Platform.OS === "android") {
          try {
            if (BleAdvertiser && (BleAdvertiser as any).setCompanyId) {
              (BleAdvertiser as any).setCompanyId(0xffff);
              console.log('✅ BLE Advertiser configured (Company ID: 0xFFFF)');
            }
            
            // Check if advertising is supported
            if ((BleAdvertiser as any).isSupported) {
              const supported = await (BleAdvertiser as any).isSupported();
              console.log(`📡 BLE Advertising supported: ${supported}`);
            }
          } catch (e) {
            console.warn("⚠️ BLE advertiser init error (non-fatal):", e);
          }
        }

        // Start listening for BLE messages - this runs continuously in the background
        // (to help relay messages from offline devices even when we're online)
        if (managerRef.current) {
          stopScannerRef.current = listenOverBle(
            managerRef.current,
            handleIncomingChunk
          );
          console.log('✅ BLE Scanner started');
          console.log('👂 Listening for relay messages...');
        }
        
        // DISABLED: Heartbeat was causing message loops on online devices
        // Peer counting now uses actual relay message IDs instead
        // startHeartbeatBroadcast();
      } catch (error) {
        console.error('❌ BLE initialization failed:', error);
        console.log('Note: BLE requires Expo Development Build, not standard Expo Go');
      }
    };

    initBle();

    return () => {
      try {
        stopScannerRef.current?.();
      } catch {}
      stopScannerRef.current = null;

      if (masterIntervalRef.current) {
        clearInterval(masterIntervalRef.current);
        masterIntervalRef.current = null;
      }
      
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
        heartbeatIntervalRef.current = null;
      }
      
      try {
        managerRef.current?.destroy();
      } catch {}
      managerRef.current = null;
    };
  }, []);

  const contextValue: BleContextType = {
    // State
    isBroadcasting,
    hasInternet,
    isMaster: isBroadcasting,
    isScanning: true, // Always scanning in the background
    connectedPeers: getActivePeerCount(), // Count active peers from other devices
    messagesReceived: receivedMessageIdsRef.current.size, // Total unique messages received
    messagesBroadcasting: broadcastQueueRef.current.size, // Messages currently being broadcast
    masterState: masterStateRef.current,
    broadcastQueue: broadcastQueueRef.current,

    // Actions
    broadcastMessage,
    startBroadcasting: startMasterBroadcastLoop,
    stopBroadcasting: stopMasterBroadcastLoop,
    clearAllAndStop,

    // Relay methods
    relayQuery,
    relayResponse,
    onRelayResponse,

    // Utility functions
    getCurrentBroadcastInfo,
    getProgressFor,
    forceUpdate,
  };

  return (
    <BleContext.Provider value={contextValue}>{children}</BleContext.Provider>
  );
};

// Hook to use the BLE context
export const useBle = (): BleContextType => {
  const context = useContext(BleContext);
  if (context === undefined) {
    throw new Error("useBle must be used within a BleProvider");
  }
  return context;
};
