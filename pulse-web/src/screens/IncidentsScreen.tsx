import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
} from 'react-native';
import { FaList, FaMap } from 'react-icons/fa';
import { useIncidents, Incident } from '../contexts/IncidentContext';
import { NEO_COLORS } from '../constants/neoBrutalism';
import IncidentMap from '../components/IncidentMap';

const INCIDENT_ICONS: Record<string, string> = {
  fire: '🔥',
  crime: '🚨',
  roadblock: '🚧',
  power_outage: '⚡',
};

const INCIDENT_COLORS: Record<string, string> = {
  fire: NEO_COLORS.RED,
  crime: NEO_COLORS.BLUE,
  roadblock: NEO_COLORS.YELLOW,
  power_outage: NEO_COLORS.PURPLE,
};

const STATUS_LABELS: Record<string, string> = {
  local: '📱 Local',
  broadcasting: '📡 Broadcasting',
  synced: '☁️ Synced',
};

export default function IncidentsScreen() {
  const { incidents, currentLocation } = useIncidents();
  const [filter, setFilter] = useState<'all' | 'fire' | 'crime' | 'roadblock' | 'power_outage'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');

  const filteredIncidents = incidents.filter(inc => {
    const matchesType = filter === 'all' ? true : inc.report_type === filter;
    const matchesSearch = searchQuery.trim() === '' ||
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    // Show local date and time
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderIncident = ({ item }: { item: Incident }) => {
    const icon = INCIDENT_ICONS[item.report_type] || '📍';
    const color = INCIDENT_COLORS[item.report_type] || NEO_COLORS.GRAY;

    return (
      <View style={[styles.incidentCard, { borderLeftColor: color }]}>
        <View style={styles.incidentHeader}>
          <View style={styles.incidentTypeContainer}>
            <Text style={styles.incidentIcon}>{icon}</Text>
            <View>
              <Text style={styles.incidentTitle}>{item.title}</Text>
              <Text style={styles.incidentTime}>{formatTimestamp(item.timestamp)}</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: color }]}>
            <Text style={styles.statusText}>{STATUS_LABELS[item.status]}</Text>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.incidentDescription}>{item.description}</Text>
        )}

        <View style={styles.incidentFooter}>
          <Text style={styles.locationText}>
            📍 {item.location.lat.toFixed(4)}, {item.location.lon.toFixed(4)}
          </Text>
        </View>
      </View>
    );
  };

  const userLocation = currentLocation ? {
    latitude: currentLocation.coords.latitude,
    longitude: currentLocation.coords.longitude,
  } : undefined;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Incidents</Text>
          <Text style={styles.subtitle}>{filteredIncidents.length} report{filteredIncidents.length !== 1 ? 's' : ''}</Text>
        </View>
        
        {/* View Mode Toggle */}
        <View style={styles.viewModeContainer}>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'list' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('list')}
          >
            <FaList size={18} color={viewMode === 'list' ? NEO_COLORS.WHITE : NEO_COLORS.BLACK} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.viewModeButton,
              viewMode === 'map' && styles.viewModeButtonActive,
            ]}
            onPress={() => setViewMode('map')}
          >
            <FaMap size={18} color={viewMode === 'map' ? NEO_COLORS.WHITE : NEO_COLORS.BLACK} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar - Only show in list mode */}
      {viewMode === 'list' && (
        <>
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search incidents..."
              placeholderTextColor={NEO_COLORS.GRAY}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Filter Buttons */}
          <View style={styles.filterContainer}>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'fire' && styles.filterButtonActive]}
              onPress={() => setFilter('fire')}
            >
              <Text style={[styles.filterText, filter === 'fire' && styles.filterTextActive]}>🔥 Fire</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'crime' && styles.filterButtonActive]}
              onPress={() => setFilter('crime')}
            >
              <Text style={[styles.filterText, filter === 'crime' && styles.filterTextActive]}>🚨 Crime</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'roadblock' && styles.filterButtonActive]}
              onPress={() => setFilter('roadblock')}
            >
              <Text style={[styles.filterText, filter === 'roadblock' && styles.filterTextActive]}>🚧 Road</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.filterButton, filter === 'power_outage' && styles.filterButtonActive]}
              onPress={() => setFilter('power_outage')}
            >
              <Text style={[styles.filterText, filter === 'power_outage' && styles.filterTextActive]}>⚡ Power</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Content */}
      {viewMode === 'map' ? (
        <View style={{ flex: 1 }}>
          <IncidentMap
            incidents={filteredIncidents}
            currentLocation={userLocation}
          />
        </View>
      ) : (
        <FlatList
          data={filteredIncidents}
          keyExtractor={(item: Incident) => item.id}
          renderItem={renderIncident}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>No incidents reported</Text>
              <Text style={styles.emptySubtext}>Reports will appear here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
  },
  header: {
    padding: 16,
    paddingTop: 24,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.RED,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  viewModeContainer: {
    flexDirection: 'row',
    gap: 8,
    position: 'absolute',
    right: 16,
  },
  viewModeButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.WHITE,
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
  },
  viewModeButtonActive: {
    backgroundColor: NEO_COLORS.BLACK,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: NEO_COLORS.BLACK,
    marginTop: 4,
    textAlign: 'center',
  },
  searchContainer: {
    padding: 16,
    backgroundColor: NEO_COLORS.WHITE,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
  },
  searchInput: {
    backgroundColor: NEO_COLORS.CREAM,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: NEO_COLORS.BLACK,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
    backgroundColor: NEO_COLORS.WHITE,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.CREAM,
  },
  filterButtonActive: {
    backgroundColor: NEO_COLORS.BLACK,
  },
  filterText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  filterTextActive: {
    color: NEO_COLORS.WHITE,
  },
  listContent: {
    padding: 16,
  },
  incidentCard: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderLeftWidth: 8,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  incidentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  incidentTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  incidentIcon: {
    fontSize: 24,
  },
  incidentTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  incidentTime: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  incidentDescription: {
    fontSize: 14,
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  incidentFooter: {
    borderTopWidth: 1,
    borderTopColor: NEO_COLORS.GRAY,
    paddingTop: 8,
  },
  locationText: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
  },
});

