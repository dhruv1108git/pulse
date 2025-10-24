import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useIncidents } from '../contexts/IncidentContext';
import { NEO_COLORS } from '../constants/neoBrutalism';
import IncidentMap from '../components/IncidentMap';

const INCIDENT_ICONS: Record<string, string> = {
  fire: '🔥',
  crime: '🚔',
  roadblock: '🚧',
  power_outage: '⚡',
};

const INCIDENT_COLORS: Record<string, string> = {
  fire: NEO_COLORS.RED,
  crime: NEO_COLORS.PURPLE,
  roadblock: NEO_COLORS.YELLOW,
  power_outage: NEO_COLORS.BLUE,
};

const STATUS_LABELS: Record<string, string> = {
  local: '📱 Local',
  broadcasting: '📡 Broadcasting',
  synced: '☁️ Synced',
};

export default function IncidentsScreen() {
  const { incidents, clearIncidents, currentLocation } = useIncidents();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'fire' | 'crime' | 'roadblock' | 'power_outage'>('all');
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Simulate refresh - in a real app, this would fetch from API
    setTimeout(() => {
      setRefreshing(false);
    }, 1000);
  }, []);

  const filteredIncidents = incidents.filter(inc => {
    // Filter by type
    const matchesType = filter === 'all' ? true : inc.report_type === filter;
    
    // Filter by search query
    const matchesSearch = searchQuery.trim() === '' ||
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.report_type.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesType && matchesSearch;
  });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - timestamp;

    // Less than 1 minute
    if (diff < 60000) {
      return 'Just now';
    }
    // Less than 1 hour
    if (diff < 3600000) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m ago`;
    }
    // Less than 24 hours
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      return `${hours}h ago`;
    }
    // More than 24 hours
    return date.toLocaleDateString();
  };

  const renderIncident = ({ item }: { item: any }) => {
    const icon = INCIDENT_ICONS[item.report_type] || '📍';
    const color = INCIDENT_COLORS[item.report_type] || NEO_COLORS.GRAY;

    return (
      <TouchableOpacity style={[styles.incidentCard, { borderLeftColor: color }]}>
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
          <Text style={styles.incidentDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.incidentFooter}>
          <Text style={styles.locationText}>
            📍 {item.location.lat.toFixed(4)}, {item.location.lon.toFixed(4)}
          </Text>
          {item.mesh_meta?.hops !== undefined && (
            <Text style={styles.hopsText}>
              {item.mesh_meta.hops} hop{item.mesh_meta.hops !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </TouchableOpacity>
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
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.title}>Incidents</Text>
            <Text style={styles.subtitle}>{filteredIncidents.length} report{filteredIncidents.length !== 1 ? 's' : ''}</Text>
          </View>
          {/* View Mode Toggle */}
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
          >
            <Icon
              name={viewMode === 'list' ? 'map' : 'list'}
              size={24}
              color={NEO_COLORS.BLACK}
            />
          </TouchableOpacity>
          {/* Search Toggle */}
          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setShowSearch(!showSearch)}
          >
            <Icon
              name="search"
              size={24}
              color={showSearch ? NEO_COLORS.BLUE : NEO_COLORS.BLACK}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      {showSearch && (
        <View style={styles.searchContainer}>
          <Icon name="search" size={20} color={NEO_COLORS.GRAY} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search incidents..."
            placeholderTextColor={NEO_COLORS.GRAY}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={showSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Icon name="close" size={20} color={NEO_COLORS.GRAY} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {['all', 'fire', 'crime', 'roadblock', 'power_outage'].map((type) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.filterTab,
              filter === type && styles.filterTabActive,
            ]}
            onPress={() => setFilter(type as any)}
          >
            <Text style={[
              styles.filterTabText,
              filter === type && styles.filterTabTextActive,
            ]}>
              {type === 'all' ? 'All' : type === 'power_outage' ? 'Power' : type.charAt(0).toUpperCase() + type.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Map or List View */}
      {viewMode === 'map' ? (
        filteredIncidents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🗺️</Text>
            <Text style={styles.emptyText}>No incidents to map</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all' 
                ? 'Reports will appear on the map when submitted'
                : `No ${filter} incidents found`
              }
            </Text>
          </View>
        ) : (
          <IncidentMap
            incidents={filteredIncidents}
            currentLocation={userLocation}
            onIncidentPress={(incident) => console.log('Incident pressed:', incident)}
          />
        )
      ) : (
        /* Incidents List */
        filteredIncidents.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>No incidents reported yet</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'all' 
                ? 'Reports will appear here when submitted'
                : `No ${filter} incidents found`
              }
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredIncidents}
            renderItem={renderIncident}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      )}

      {/* Clear Button (Development Only) */}
      {incidents.length > 0 && __DEV__ && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={() => {
            Alert.alert(
              'Clear All Incidents',
              'Are you sure you want to clear all incidents?',
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: () => clearIncidents() }
              ]
            );
          }}
        >
          <Text style={styles.clearButtonText}>Clear All (Dev)</Text>
        </TouchableOpacity>
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
    backgroundColor: NEO_COLORS.WHITE,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  viewToggle: {
    width: 48,
    height: 48,
    backgroundColor: NEO_COLORS.CREAM,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.WHITE,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  searchIcon: {
    marginRight: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: NEO_COLORS.BLACK,
    paddingVertical: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  subtitle: {
    fontSize: 16,
    color: NEO_COLORS.GRAY,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: NEO_COLORS.WHITE,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.CREAM,
  },
  filterTabActive: {
    backgroundColor: NEO_COLORS.BLACK,
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  filterTabTextActive: {
    color: NEO_COLORS.WHITE,
  },
  listContent: {
    padding: 16,
    gap: 12,
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
    fontSize: 32,
  },
  incidentTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  incidentTime: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  incidentDescription: {
    fontSize: 14,
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
    lineHeight: 20,
  },
  incidentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
  },
  hopsText: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    backgroundColor: NEO_COLORS.CREAM,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    textAlign: 'center',
  },
  clearButton: {
    backgroundColor: NEO_COLORS.RED,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    margin: 16,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
});

