/// <reference types="google.maps" />

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FaTimes, FaMapMarkerAlt, FaExpand } from 'react-icons/fa';
import { NEO_COLORS } from '../constants/neoBrutalism';
import { Incident } from '../contexts/IncidentContext';
import { loadGoogleMapsAPI } from '../utils/loadGoogleMaps';

interface IncidentMapProps {
  incidents: Incident[];
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  onIncidentPress?: (incident: Incident) => void;
}

export default function IncidentMap({
  incidents,
  currentLocation,
  onIncidentPress,
}: IncidentMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [apiLoaded, setApiLoaded] = useState(false);

  // Load Google Maps API on mount
  useEffect(() => {
    loadGoogleMapsAPI()
      .then(() => {
        console.log('✅ Google Maps API ready');
        setApiLoaded(true);
      })
      .catch((error) => {
        console.error('❌ Failed to load Google Maps API:', error);
      });
  }, []);

  // Initialize map when Google Maps is loaded
  useEffect(() => {
    // Check if Google Maps is available
    if (!apiLoaded || !window.google?.maps || !mapRef.current || googleMapRef.current) return;

    const initialCenter = currentLocation
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : incidents.length > 0
      ? { lat: incidents[0].location.lat, lng: incidents[0].location.lon }
      : { lat: 37.7749, lng: -122.4194 }; // Default to SF

    try {
      googleMapRef.current = new google.maps.Map(mapRef.current, {
        center: initialCenter,
        zoom: 12,
        mapTypeControl: true,
        streetViewControl: false,
        fullscreenControl: false,
        zoomControl: true,
      });

      console.log('🗺️ Map initialized at', initialCenter);
      setMapReady(true);
    } catch (error) {
      console.error('❌ Error initializing map:', error);
    }
  }, [apiLoaded, currentLocation, incidents]);

  // Update markers when map is ready and incidents change
  useEffect(() => {
    if (!mapReady || !googleMapRef.current) {
      console.log('⏳ Map not ready yet for markers');
      return;
    }

    console.log('📍 Adding markers for', incidents.length, 'incidents');

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    // Add incident markers
    incidents.forEach((incident, index) => {
      try {
        const markerColor = getMarkerColor(incident.report_type);
        const position = { lat: incident.location.lat, lng: incident.location.lon };
        
        console.log(`  Marker ${index + 1}:`, incident.report_type, 'at', position);
        
        const marker = new google.maps.Marker({
          position: position,
          map: googleMapRef.current!,
          title: incident.title,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: markerColor,
            fillOpacity: 1,
            strokeColor: '#000000',
            strokeWeight: 2,
          },
        });

        marker.addListener('click', () => {
          console.log('Marker clicked:', incident.title);
          setSelectedIncident(incident);
          onIncidentPress?.(incident);
        });

        markersRef.current.push(marker);
      } catch (error) {
        console.error('Error adding marker:', error);
      }
    });

    // Add user location marker
    if (currentLocation) {
      try {
        const userMarker = new google.maps.Marker({
          position: { lat: currentLocation.latitude, lng: currentLocation.longitude },
          map: googleMapRef.current!,
          title: 'Your Location',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#4285F4',
            fillOpacity: 1,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
          },
        });
        markersRef.current.push(userMarker);
        console.log('📍 Added user location marker');
      } catch (error) {
        console.error('Error adding user marker:', error);
      }
    }

    console.log('✅ Total markers added:', markersRef.current.length);
  }, [mapReady, incidents, currentLocation, onIncidentPress]);

  const getMarkerColor = (type: string): string => {
    switch (type) {
      case 'fire':
        return NEO_COLORS.RED;
      case 'crime':
        return NEO_COLORS.PURPLE;
      case 'roadblock':
        return NEO_COLORS.YELLOW;
      case 'power_outage':
        return NEO_COLORS.BLUE;
      case 'medical':
        return '#FF69B4';
      case 'accident':
        return '#FF8C00';
      default:
        return NEO_COLORS.GRAY;
    }
  };

  const getIncidentTypeColor = (type: string): string => {
    return getMarkerColor(type);
  };

  const centerOnUser = () => {
    if (!currentLocation || !googleMapRef.current) return;
    googleMapRef.current.setCenter({
      lat: currentLocation.latitude,
      lng: currentLocation.longitude,
    });
    googleMapRef.current.setZoom(14);
  };

  const fitToIncidents = () => {
    if (incidents.length === 0 || !googleMapRef.current) return;

    const bounds = new google.maps.LatLngBounds();
    
    incidents.forEach((inc) => {
      bounds.extend({ lat: inc.location.lat, lng: inc.location.lon });
    });

    if (currentLocation) {
      bounds.extend({ lat: currentLocation.latitude, lng: currentLocation.longitude });
    }

    googleMapRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  };

  return (
    <View style={styles.container}>
      <div 
        ref={mapRef} 
        style={{ 
          width: '100%', 
          height: '100%',
          minHeight: '400px',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0
        }} 
      />

      {/* Map Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.controlButton, !currentLocation && styles.controlButtonDisabled]}
          onPress={centerOnUser}
          disabled={!currentLocation}
        >
          <FaMapMarkerAlt size={20} color={NEO_COLORS.BLACK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlButton, incidents.length === 0 && styles.controlButtonDisabled]}
          onPress={fitToIncidents}
          disabled={incidents.length === 0}
        >
          <FaExpand size={20} color={NEO_COLORS.BLACK} />
        </TouchableOpacity>
      </View>

      {/* Selected Incident Card */}
      {selectedIncident && (
        <View style={styles.selectedCard}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.incidentTypeContainer,
                { backgroundColor: getIncidentTypeColor(selectedIncident.report_type) },
              ]}
            >
              <Text style={styles.incidentTypeText}>
                {selectedIncident.report_type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedIncident(null)}>
              <FaTimes size={20} color={NEO_COLORS.BLACK} />
            </TouchableOpacity>
          </View>

          <Text style={styles.cardTitle}>{selectedIncident.title}</Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {selectedIncident.description}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardTimestamp}>
              {new Date(selectedIncident.timestamp).toLocaleString()}
            </Text>
            <Text style={styles.cardStatus}>
              {selectedIncident.status.toUpperCase()}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
    position: 'relative',
  },
  controls: {
    position: 'absolute',
    right: 16,
    top: 16,
    gap: 12,
  },
  controlButton: {
    width: 48,
    height: 48,
    backgroundColor: NEO_COLORS.WHITE,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    cursor: 'pointer',
  },
  controlButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  selectedCard: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    backgroundColor: NEO_COLORS.WHITE,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    padding: 16,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    maxWidth: 500,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  incidentTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  incidentTypeText: {
    color: NEO_COLORS.WHITE,
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
    marginBottom: 12,
    lineHeight: 20,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTimestamp: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
  },
  cardStatus: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.GREEN,
    letterSpacing: 1,
  },
});

