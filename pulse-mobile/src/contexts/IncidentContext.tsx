import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';
import { useNetInfo } from '@react-native-community/netinfo';
import { API_BASE_URL } from '../constants/api';
import { reverseGeocode, Address } from '../utils/geocoding';
import { useBle } from './BleContext';

export interface Incident {
  id: string;
  report_type: 'fire' | 'crime' | 'roadblock' | 'power_outage';
  title: string;
  description: string;
  location: {
    lat: number;
    lon: number;
  };
  timestamp: number;
  status: 'local' | 'broadcasting' | 'synced';
  mesh_meta?: {
    hops?: number;
    first_seen?: string;
  };
}

interface IncidentContextType {
  incidents: Incident[];
  totalIncidents: number;
  incidentsByType: Record<string, number>;
  deviceId: string;
  currentLocation: { coords: { latitude: number; longitude: number } } | null;
  currentAddress: Address | null;
  addIncident: (incident: Omit<Incident, 'id' | 'timestamp' | 'status'>) => Promise<string>;
  updateIncidentStatus: (id: string, status: Incident['status']) => void;
  getIncidentById: (id: string) => Incident | undefined;
  clearIncidents: () => Promise<void>;
  requestLocationPermission: () => Promise<boolean>;
  sendSOS: (incidentType: string, description?: string) => Promise<{ success: boolean; message: string; sosId: string }>;
  refreshTotalIncidents: () => Promise<void>;
}

const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

const STORAGE_KEY = '@pulse_incidents';
const DEVICE_ID_KEY = '@pulse_device_id';

function generateDeviceId(): string {
  return `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function generateIncidentId(): string {
  return `inc-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export function IncidentProvider({ children }: { children: ReactNode }) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [totalIncidents, setTotalIncidents] = useState<number>(0);
  const [incidentsByType, setIncidentsByType] = useState<Record<string, number>>({});
  const [deviceId, setDeviceId] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<{ coords: { latitude: number; longitude: number } } | null>(null);
  const [currentAddress, setCurrentAddress] = useState<Address | null>(null);
  const netInfo = useNetInfo();
  const bleContext = useBle();
  const hasInternet = netInfo.isConnected ?? false;

  // Initialize device ID
  useEffect(() => {
    const initDeviceId = async () => {
      try {
        let id = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!id) {
          id = generateDeviceId();
          await AsyncStorage.setItem(DEVICE_ID_KEY, id);
        }
        setDeviceId(id);
      } catch (error) {
        console.error('Failed to initialize device ID:', error);
        setDeviceId(generateDeviceId());
      }
    };

    initDeviceId();
  }, []);

  // Automatically fetch location on app start
  useEffect(() => {
    const getInitialLocation = async () => {
      try {
        // On Android, check permission first
        if (Platform.OS === 'android') {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          
          if (!hasPermission) {
            console.log('⚠️ No location permission - skipping auto-fetch');
            return;
          }
        }

        console.log('📍 Fetching location...');
        Geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ GOT LOCATION:', position);
            setCurrentLocation({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }
            });
          },
          (error) => {
            console.error('❌ Location error:', error.code, error.message);
          },
          { 
            enableHighAccuracy: false, 
            timeout: 15000, 
            maximumAge: 10000,
          }
        );
      } catch (error) {
        console.error('Error in getInitialLocation:', error);
      }
    };

    getInitialLocation();
  }, []);

  // Reverse geocode location when it changes
  useEffect(() => {
    const geocodeLocation = async () => {
      if (!currentLocation) {
        setCurrentAddress(null);
        return;
      }

      try {
        console.log('🗺️ Reverse geocoding location...');
        const address = await reverseGeocode(
          currentLocation.coords.latitude,
          currentLocation.coords.longitude
        );
        
        if (address) {
          console.log('✅ Address:', address.formatted);
          setCurrentAddress(address);
        } else {
          console.log('⚠️ Could not geocode location');
        }
      } catch (error) {
        console.error('❌ Geocoding error:', error);
      }
    };

    geocodeLocation();
  }, [currentLocation]);

  // Load incidents from storage
  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) {
          setIncidents(JSON.parse(stored));
        }
      } catch (error) {
        console.error('Failed to load incidents:', error);
      }
    };

    loadIncidents();
  }, []);

  // Save incidents to storage whenever they change
  useEffect(() => {
    const saveIncidents = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
      } catch (error) {
        console.error('Failed to save incidents:', error);
      }
    };

    if (incidents.length > 0) {
      saveIncidents();
    }
  }, [incidents]);

  // Fetch total incident count and types from backend
  const refreshTotalIncidents = async () => {
    // Use local incidents count (already loaded from fetchIncidentsFromDb)
    setTotalIncidents(incidents.length);
    const typeMap: Record<string, number> = {};
    incidents.forEach(inc => {
      typeMap[inc.report_type] = (typeMap[inc.report_type] || 0) + 1;
    });
    setIncidentsByType(typeMap);
    console.log('✅ Refreshed stats from loaded incidents:', incidents.length, 'types:', typeMap);
  };

  // Fetch incidents from database
  const fetchIncidentsFromDb = async () => {
    if (!hasInternet) return;
    try {
      const response = await fetch(`${API_BASE_URL}/api/incidents/list?limit=200`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && Array.isArray(data.incidents)) {
          const dbIncidents: Incident[] = data.incidents.map((inc: any) => ({
            id: inc.report_id || inc.id,
            report_type: inc.report_type,
            title: inc.title || inc.report_type.toUpperCase(),
            description: inc.description || '',
            location: inc.location,
            timestamp: inc.timestamp ? new Date(inc.timestamp).getTime() : (inc['@timestamp'] ? new Date(inc['@timestamp']).getTime() : Date.now()),
            status: (inc.status as Incident['status']) || 'synced',
            mesh_meta: inc.mesh_meta,
          }));
          setIncidents(dbIncidents);
          
          // Update total count directly from the fetched data
          setTotalIncidents(dbIncidents.length);
          
          // Calculate types from the incidents
          const typeMap: Record<string, number> = {};
          dbIncidents.forEach(inc => {
            typeMap[inc.report_type] = (typeMap[inc.report_type] || 0) + 1;
          });
          setIncidentsByType(typeMap);
          
          console.log('✅ Loaded incidents from DB:', dbIncidents.length, 'types:', typeMap);
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to load incidents from DB');
    }
  };

  // Initial load from DB - this sets incidents, totalIncidents, and incidentsByType
  useEffect(() => {
    if (hasInternet) {
      fetchIncidentsFromDb();
    }
  }, [hasInternet]);

  // Request location permissions and get location
  const requestLocationPermission = async (): Promise<boolean> => {
    try {
      console.log('🔄 Requesting location permission...');
      
      // Request permissions on Android
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Pulse needs access to your location',
            buttonPositive: 'OK',
          }
        );
        
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          console.log('❌ Permission denied');
          return false;
        }
      }

      // Get location
      return new Promise((resolve) => {
        Geolocation.getCurrentPosition(
          (position) => {
            console.log('✅ Location obtained:', position);
            setCurrentLocation({
              coords: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              }
            });
            resolve(true);
          },
          (error) => {
            console.error('❌ Location error:', error.code, error.message);
            resolve(false);
          },
          { 
            enableHighAccuracy: true, 
            timeout: 20000, 
            maximumAge: 0,
          }
        );
      });
    } catch (error) {
      console.error('Error requesting permission:', error);
      return false;
    }
  };

  // Add new incident
  const addIncident = async (
    incident: Omit<Incident, 'id' | 'timestamp' | 'status'>
  ): Promise<string> => {
    const id = generateIncidentId();
    const timestamp = Date.now();
    const newIncident: Incident = {
      ...incident,
      id,
      timestamp,
      status: 'local',
    };

    setIncidents((prev) => [newIncident, ...prev]);

    // If online, store in backend directly
    if (hasInternet) {
      try {
        console.log('📤 Storing incident online:', id);
        const response = await fetch(`${API_BASE_URL}/api/incidents/store`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            report_id: id,
            report_type: incident.report_type,
            title: incident.title,
            description: incident.description,
            location: incident.location,
            severity: 3, // Default medium severity
            timestamp: new Date(timestamp).toISOString(),
            device_id: deviceId,
            status: 'synced',
          }),
        });

        if (response.ok) {
          console.log('✅ Incident stored online successfully');
          // Update status to synced
          setIncidents((prev) =>
            prev.map((inc) => (inc.id === id ? { ...inc, status: 'synced' } : inc))
          );
          // Refresh total count from backend
          refreshTotalIncidents();
        } else {
          console.error('❌ Failed to store incident online:', response.status);
        }
      } catch (error) {
        console.error('❌ Error storing incident online:', error);
      }
    } else {
      // OFFLINE MODE: Broadcast via BLE for mesh syncing
      console.log('📴 Offline - broadcasting incident via BLE');
      try {
        const incidentBroadcast = JSON.stringify({
          type: 'INCIDENT_REPORT',
          incident: newIncident,
          device_id: deviceId,
        });
        
        await bleContext.broadcastMessage(incidentBroadcast);
        console.log('📡 Incident broadcast via BLE:', id);
        
        // Update status to broadcasting
        setIncidents((prev) =>
          prev.map((inc) => (inc.id === id ? { ...inc, status: 'broadcasting' } : inc))
        );
      } catch (bleError) {
        console.warn('⚠️ BLE broadcast failed:', bleError);
      }
    }

    return id;
  };

  // Update incident status
  const updateIncidentStatus = (id: string, status: Incident['status']) => {
    setIncidents((prev) =>
      prev.map((inc) => (inc.id === id ? { ...inc, status } : inc))
    );
  };

  // Get incident by ID
  const getIncidentById = (id: string): Incident | undefined => {
    return incidents.find((inc) => inc.id === id);
  };

  // Clear all incidents
  const clearIncidents = async () => {
    setIncidents([]);
    try {
      await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear incidents:', error);
    }
  };

  // Send SOS emergency
  const sendSOS = async (
    incidentType: string,
    description: string = 'Emergency SOS'
  ): Promise<{ success: boolean; message: string; sosId: string }> => {
    try {
      const sosId = `sos-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const sosData = {
        incident_type: incidentType,
        description,
        user_name: deviceId,
      };

      const location = currentLocation
        ? {
            lat: currentLocation.coords.latitude,
            lon: currentLocation.coords.longitude,
          }
        : { lat: 0, lon: 0 };

      console.log('🚨 Sending SOS:', incidentType, location);

      if (hasInternet) {
        // ONLINE MODE: Send directly to backend
        console.log('📶 Online mode: Sending SOS directly to backend');
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000);

          const response = await fetch(`${API_BASE_URL}/api/relay/query`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query_id: sosId,
              query_text: `SOS: ${incidentType}`,
              query_type: 'sos',
              user_location: location,
              original_device: deviceId,
              relayed_by: deviceId,
              sos_data: sosData,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!response.ok) {
            throw new Error(`SOS request failed: ${response.status}`);
          }

          const data = await response.json();
          console.log('✅ SOS sent successfully:', data);

          return {
            success: true,
            message: 'SOS sent successfully! Emergency services have been notified.',
            sosId,
          };
        } catch (error: any) {
          console.error('Error sending SOS online:', error);
          // Fall back to BLE if online fails
          throw error;
        }
      } else {
        // OFFLINE MODE: Relay via BLE
        console.log('📡 Offline mode: Relaying SOS via Bluetooth');
        
        await bleContext.relayQuery(
          sosId,
          `SOS: ${incidentType}`,
          'sos',
          location,
          deviceId,
          sosData
        );

        return {
          success: true,
          message: 'SOS is being relayed via nearby devices...',
          sosId,
        };
      }
    } catch (error: any) {
      console.error('Error sending SOS:', error);
      return {
        success: false,
        message: `Failed to send SOS: ${error.message}`,
        sosId: '',
      };
    }
  };

  const value: IncidentContextType = {
    incidents,
    totalIncidents,
    incidentsByType,
    deviceId,
    currentLocation,
    currentAddress,
    addIncident,
    updateIncidentStatus,
    getIncidentById,
    clearIncidents,
    requestLocationPermission,
    sendSOS,
    refreshTotalIncidents,
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
}

export function useIncidents() {
  const context = useContext(IncidentContext);
  if (!context) {
    throw new Error('useIncidents must be used within an IncidentProvider');
  }
  return context;
}

