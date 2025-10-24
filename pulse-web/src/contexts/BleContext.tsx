// Web stub for BLE Context - Bluetooth mesh networking not available on web
import React, { createContext, useContext, ReactNode } from 'react';

interface BleContextType {
  isScanning: boolean;
  isAdvertising: boolean;
  peers: any[];
  messages: any[];
  startScanning: () => Promise<void>;
  stopScanning: () => void;
  startAdvertising: () => Promise<void>;
  stopAdvertising: () => void;
  broadcastMessage: (message: string) => Promise<void>;
  relayQuery: (
    queryId: string,
    queryText: string,
    queryType: string,
    location: { lat: number; lon: number },
    originalDevice: string,
    sosData?: any
  ) => Promise<void>;
  onRelayResponse: (callback: (queryId: string, response: string) => void) => void;
}

const BleContext = createContext<BleContextType | undefined>(undefined);

export function BleProvider({ children }: { children: ReactNode }) {
  // Stub implementation - BLE not available on web
  const value: BleContextType = {
    isScanning: false,
    isAdvertising: false,
    peers: [],
    messages: [],
    startScanning: async () => {
      console.warn('BLE mesh networking is not available on web');
    },
    stopScanning: () => {},
    startAdvertising: async () => {
      console.warn('BLE mesh networking is not available on web');
    },
    stopAdvertising: () => {},
    broadcastMessage: async (message: string) => {
      console.warn('BLE mesh networking is not available on web');
    },
    relayQuery: async (
      queryId: string,
      queryText: string,
      queryType: string,
      location: { lat: number; lon: number },
      originalDevice: string,
      sosData?: any
    ) => {
      console.warn('BLE mesh networking is not available on web - query cannot be relayed');
    },
    onRelayResponse: (callback: (queryId: string, response: string) => void) => {
      // No-op
    },
  };

  return <BleContext.Provider value={value}>{children}</BleContext.Provider>;
}

export function useBle() {
  const context = useContext(BleContext);
  if (!context) {
    throw new Error('useBle must be used within a BleProvider');
  }
  return context;
}

