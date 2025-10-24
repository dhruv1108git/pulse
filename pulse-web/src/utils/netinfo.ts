// Web implementation of NetInfo using browser navigator.onLine

import { useState, useEffect } from 'react';

export interface NetInfoState {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  type: string;
}

export function useNetInfo(): NetInfoState {
  const [isConnected, setIsConnected] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsConnected(true);
    const handleOffline = () => setIsConnected(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return {
    isConnected,
    isInternetReachable: isConnected,
    type: isConnected ? 'wifi' : 'none',
  };
}

const NetInfo = {
  fetch: async (): Promise<NetInfoState> => {
    return {
      isConnected: navigator.onLine,
      isInternetReachable: navigator.onLine,
      type: navigator.onLine ? 'wifi' : 'none',
    };
  },
};

export default NetInfo;

