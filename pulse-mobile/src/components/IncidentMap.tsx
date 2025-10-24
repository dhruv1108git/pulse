import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  Text,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NEO_COLORS } from '../constants/neoBrutalism';
import { Incident } from '../contexts/IncidentContext';

interface IncidentMapProps {
  incidents: Incident[];
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
  onIncidentPress?: (incident: Incident) => void;
}

const { width, height } = Dimensions.get('window');

export default function IncidentMap({
  incidents,
  currentLocation,
  onIncidentPress,
}: IncidentMapProps) {
  const mapRef = useRef<MapView>(null);
  
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

  // Calculate initial region based on incidents and user location
  const getInitialRegion = (): Region => {
    if (currentLocation) {
      return {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
    }

    if (incidents.length > 0) {
      // Use first incident as center
      const firstIncident = incidents[0];
      return {
        latitude: firstIncident.location.lat,
        longitude: firstIncident.location.lon,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    // Default to San Francisco
    return {
      latitude: 37.7749,
      longitude: -122.4194,
      latitudeDelta: 0.1,
      longitudeDelta: 0.1,
    };
  };

  const getMarkerColor = (type: string): string => {
    switch (type) {
      case 'fire':
        return NEO_COLORS.RED;
      case 'crime':
        return NEO_COLORS.BLUE;
      case 'roadblock':
        return NEO_COLORS.YELLOW;
      case 'power_outage':
        return NEO_COLORS.PURPLE;
      case 'medical':
        return '#FF69B4'; // Pink
      case 'accident':
        return '#FF8C00'; // Dark orange
      default:
        return NEO_COLORS.GRAY;
    }
  };

  const getIncidentIcon = (type: string): string => {
    switch (type) {
      case 'fire':
        return 'whatshot';
      case 'crime':
        return 'security';
      case 'roadblock':
        return 'block';
      case 'power_outage':
        return 'power-off';
      case 'medical':
        return 'local-hospital';
      case 'accident':
        return 'car-crash';
      default:
        return 'error';
    }
  };

  const handleMarkerPress = (incident: Incident) => {
    setSelectedIncident(incident);
    onIncidentPress?.(incident);
  };

  const fitToIncidents = () => {
    if (incidents.length === 0) return;

    const coordinates = incidents.map((inc) => ({
      latitude: inc.location.lat,
      longitude: inc.location.lon,
    }));

    if (currentLocation) {
      coordinates.push(currentLocation);
    }

    mapRef.current?.fitToCoordinates(coordinates, {
      edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
      animated: true,
    });
  };

  const centerOnUser = () => {
    if (!currentLocation) return;

    mapRef.current?.animateToRegion({
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      latitudeDelta: 0.05,
      longitudeDelta: 0.05,
    });
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={getInitialRegion()}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        showsScale={true}
        onMapReady={() => console.log('🗺️ Map ready')}
        onRegionChangeComplete={(r) => {
          // lightweight debug to ensure map renders and region updates
          // console.log('Region:', r);
        }}
        onMarkerPress={() => { /* noop to ensure props shape compat */ }}
      >
        {/* Incident Markers */}
        {incidents.map((incident) => (
          <Marker
            key={incident.id}
            coordinate={{
              latitude: incident.location.lat,
              longitude: incident.location.lon,
            }}
            pinColor={getMarkerColor(incident.report_type)}
            title={incident.title}
            description={incident.description}
            onPress={() => handleMarkerPress(incident)}
          />
        ))}
      </MapView>

      {/* Map Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={centerOnUser}
          disabled={!currentLocation}
        >
          <Icon name="my-location" size={24} color={NEO_COLORS.BLACK} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={fitToIncidents}
          disabled={incidents.length === 0}
        >
          <Icon name="fit-screen" size={24} color={NEO_COLORS.BLACK} />
        </TouchableOpacity>
      </View>

      {/* Selected Incident Card */}
      {selectedIncident && (
        <View style={styles.selectedCard}>
          <View style={styles.cardHeader}>
            <View style={styles.incidentTypeContainer}>
              <Icon
                name={getIncidentIcon(selectedIncident.report_type)}
                size={20}
                color={NEO_COLORS.WHITE}
              />
              <Text style={styles.incidentTypeText}>
                {selectedIncident.report_type.replace('_', ' ').toUpperCase()}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedIncident(null)}>
              <Icon name="close" size={24} color={NEO_COLORS.BLACK} />
            </TouchableOpacity>
          </View>

          <Text style={styles.cardTitle}>{selectedIncident.title}</Text>
          <Text style={styles.cardDescription} numberOfLines={2}>
            {selectedIncident.description}
          </Text>

          <View style={styles.cardFooter}>
            <Text style={styles.cardTimestamp}>
              {new Date(selectedIncident.timestamp).toLocaleTimeString()}
            </Text>
            <Text style={styles.cardStatus}>
              {selectedIncident.status.toUpperCase()}
            </Text>
          </View>
        </View>
      )}

      {/* Incident Count Badge */}
      <View style={styles.countBadge}>
        <Icon name="report" size={20} color={NEO_COLORS.WHITE} />
        <Text style={styles.countText}>{incidents.length}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
  },
  map: {
    width: '100%',
    height: '100%',
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
    elevation: 4,
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
    elevation: 6,
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
    backgroundColor: NEO_COLORS.RED,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    gap: 6,
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
  countBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.BLACK,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    gap: 6,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  countText: {
    color: NEO_COLORS.WHITE,
    fontSize: 16,
    fontWeight: 'bold',
  },
});

