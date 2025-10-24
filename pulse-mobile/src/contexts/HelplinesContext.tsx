import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import { useIncidents } from './IncidentContext';
import { API_BASE_URL } from '../constants/api';

interface Contact {
  type: string;
  number: string;
  source: string;
  confidence: number;
}

interface HelplineData {
  location: string;
  emergency: string;
  contacts: Contact[];
  fallback: string;
  from_cache: boolean;
  cached_at?: string;
  expires_at?: string;
  sources_checked?: number;
}

interface HelplinesContextType {
  helplines: HelplineData | null;
  isLoading: boolean;
  error: string | null;
  fetchHelplines: (location: string) => Promise<void>;
  fetchNearbyHelplines: () => Promise<void>;
  clearError: () => void;
}

const HelplinesContext = createContext<HelplinesContextType | undefined>(
  undefined
);

export function HelplinesProvider({ children }: { children: ReactNode }) {
  const [helplines, setHelplines] = useState<HelplineData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { currentLocation, currentAddress } = useIncidents();

  const fetchHelplines = useCallback(async (location: string) => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for helplines (web search takes time)

      console.log('🔍 Fetching helplines for:', location);
      console.log('API URL:', `${API_BASE_URL}/api/helplines/smart`);

      const url = `${API_BASE_URL}/api/helplines/smart?location=${encodeURIComponent(location)}`;
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);

      let json: any = null;
      try {
        json = await response.json();
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Invalid JSON response from server');
      }
      
      console.log('✅ Helplines API Response:', JSON.stringify(json, null, 2));

      if (!response.ok) {
        throw new Error(json.error || `Server error: ${response.status}`);
      }

      // Check both outer and inner success flags
      const innerSuccess = json.data?.success;
      if (innerSuccess === false) {
        const errorMsg = json.data?.error || 'Backend service could not find helplines';
        console.warn('⚠️ Backend returned success=false:', errorMsg);
        throw new Error(errorMsg);
      }

      // Handle different response structures (be tolerant if success=false)
      if (json && json.data) {
        const container = json.data;
        const helplineData = container.data || container;

        console.log('📞 Extracted helpline data:', JSON.stringify(helplineData, null, 2));

        setHelplines({
          location: container.location || location,
          emergency: helplineData.emergency || '911',
          contacts: Array.isArray(helplineData.contacts) ? helplineData.contacts : [],
          fallback: helplineData.fallback || '911',
          from_cache: !!(container.from_cache || helplineData.from_cache),
          cached_at: helplineData.cached_at,
          expires_at: helplineData.expires_at,
          sources_checked: container.sources_checked || helplineData.sources_checked || 0,
        });
      } else {
        console.error('Invalid response structure:', json);
        // Graceful fallback
        setHelplines({
          location: location,
          emergency: '911',
          contacts: [],
          fallback: '911',
          from_cache: false,
        });
      }
    } catch (err: any) {
      console.error('Error fetching helplines:', err);
      
      let errorMessage = 'Failed to fetch helplines';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err.message?.includes('Network request failed')) {
        errorMessage = 'Cannot connect to server. Ensure backend is running and device can reach it.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchNearbyHelplines = useCallback(async () => {
    if (!currentLocation) {
      setError('Location not available. Please enable location services first.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { latitude, longitude } = currentLocation.coords;

      // Use the city from currentAddress if available, otherwise use coordinates
      let locationStr = '';
      if (currentAddress?.city) {
        locationStr = currentAddress.city;
        if (currentAddress.state) {
          locationStr += `, ${currentAddress.state}`;
        }
        if (currentAddress.country) {
          locationStr += `, ${currentAddress.country}`;
        }
      } else if (currentAddress?.formatted) {
        locationStr = currentAddress.formatted;
      } else {
        locationStr = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      }

      // Add timeout to fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      console.log('🔍 Fetching nearby helplines for:', locationStr);

      // Use smart helplines - the API will work better with city names
      const url = `${API_BASE_URL}/api/helplines/smart?location=${encodeURIComponent(locationStr)}`;
      const response = await fetch(url, { signal: controller.signal });

      clearTimeout(timeoutId);

      console.log('Response status:', response.status);

      let json: any = null;
      try {
        json = await response.json();
      } catch (e) {
        console.error('Failed to parse JSON:', e);
        throw new Error('Invalid JSON response from server');
      }
      
      console.log('✅ Nearby Helplines API Response:', JSON.stringify(json, null, 2));

      if (!response.ok) {
        throw new Error(json.error || `Server error: ${response.status}`);
      }

      // Check both outer and inner success flags
      const innerSuccess = json.data?.success;
      if (innerSuccess === false) {
        const errorMsg = json.data?.error || 'Backend service could not find helplines for your location';
        console.warn('⚠️ Backend returned success=false:', errorMsg);
        throw new Error(errorMsg);
      }

      // Handle different response structures (be tolerant if success=false)
      if (json && json.data) {
        const container = json.data;
        const helplineData = container.data || container;

        console.log('📞 Extracted nearby helpline data:', JSON.stringify(helplineData, null, 2));

        setHelplines({
          location: container.location || 'Your Location',
          emergency: helplineData.emergency || '911',
          contacts: Array.isArray(helplineData.contacts) ? helplineData.contacts : [],
          fallback: helplineData.fallback || '911',
          from_cache: !!(container.from_cache || helplineData.from_cache),
          cached_at: helplineData.cached_at,
          expires_at: helplineData.expires_at,
          sources_checked: container.sources_checked || helplineData.sources_checked || 0,
        });
      } else {
        console.error('Invalid response structure:', json);
        // Graceful fallback
        setHelplines({
          location: 'Your Location',
          emergency: '911',
          contacts: [],
          fallback: '911',
          from_cache: false,
        });
      }
    } catch (err: any) {
      console.error('Error fetching nearby helplines:', err);
      
      let errorMessage = 'Failed to fetch nearby helplines';
      
      if (err.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (err.message?.includes('Network request failed')) {
        errorMessage = 'Cannot connect to server. Ensure backend is running and device can reach it.';
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [currentLocation, currentAddress]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const contextValue: HelplinesContextType = {
    helplines,
    isLoading,
    error,
    fetchHelplines,
    fetchNearbyHelplines,
    clearError,
  };

  return (
    <HelplinesContext.Provider value={contextValue}>
      {children}
    </HelplinesContext.Provider>
  );
}

export function useHelplines() {
  const context = useContext(HelplinesContext);
  if (context === undefined) {
    throw new Error('useHelplines must be used within a HelplinesProvider');
  }
  return context;
}

