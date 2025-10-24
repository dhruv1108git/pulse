import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { useIncidents } from '../contexts/IncidentContext';
import { useBle } from '../contexts/BleContext';
import { NEO_COLORS } from '../constants/neoBrutalism';
import { getShortLocation } from '../utils/geocoding';

export default function HomeScreen() {
  const { incidents, totalIncidents, incidentsByType, currentLocation, currentAddress, requestLocationPermission, sendSOS } = useIncidents();
  const { peers } = useBle();
  const [sosModalVisible, setSOSModalVisible] = useState(false);
  const [isSendingSOS, setIsSendingSOS] = useState(false);

  const handleSendSOS = async (incidentType: string) => {
    setIsSendingSOS(true);
    try {
      const result = await sendSOS(incidentType, `Emergency SOS: ${incidentType}`);
      
      setSOSModalVisible(false);
      
      if (result.success) {
        window.alert(`🚨 SOS Sent!\n\n${result.message}`);
      } else {
        window.alert(`SOS Error\n\n${result.message}`);
      }
    } catch (error: any) {
      window.alert(`SOS Error\n\nFailed to send SOS: ${error.message}`);
    } finally {
      setIsSendingSOS(false);
    }
  };

  const getRecentIncidents = () => {
    const oneHourAgo = Date.now() - 3600000;
    return incidents.filter(inc => inc.timestamp > oneHourAgo);
  };

  const getIncidentTypeCount = (type: string) => {
    // Use database counts from backend, fallback to local count if not available
    return incidentsByType[type] || 0;
  };

  const recentIncidents = getRecentIncidents();

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Pulse</Text>
        <Text style={styles.subtitle}>Emergency Incident Network - Web</Text>
      </View>

      {/* BLE Not Available Banner */}
      <View style={styles.webBanner}>
        <Text style={styles.webBannerText}>
          ℹ️ Mesh networking not available on web. For full features, use the mobile app.
        </Text>
      </View>

      {/* SOS Button */}
      <TouchableOpacity 
        style={styles.sosButton}
        onPress={() => setSOSModalVisible(true)}
      >
        <Text style={styles.sosButtonText}>🚨 EMERGENCY SOS</Text>
        <Text style={styles.sosButtonSubtext}>Tap to send emergency alert</Text>
      </TouchableOpacity>

      {/* SOS Modal */}
      <Modal
        visible={sosModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isSendingSOS && setSOSModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Emergency Type</Text>
            <Text style={styles.modalSubtitle}>
              {currentLocation 
                ? `Location: ${getShortLocation(currentAddress, {
                    lat: currentLocation.coords.latitude,
                    lon: currentLocation.coords.longitude,
                  })}`
                : 'Getting location...'}
            </Text>

            {isSendingSOS ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={NEO_COLORS.RED} />
                <Text style={styles.loadingText}>Sending SOS...</Text>
              </View>
            ) : (
              <>
                <TouchableOpacity 
                  style={[styles.sosTypeButton, { backgroundColor: NEO_COLORS.RED }]}
                  onPress={() => handleSendSOS('fire')}
                >
                  <Text style={styles.sosTypeIcon}>🔥</Text>
                  <Text style={styles.sosTypeText}>Fire Emergency</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.sosTypeButton, { backgroundColor: NEO_COLORS.BLUE }]}
                  onPress={() => handleSendSOS('medical')}
                >
                  <Text style={styles.sosTypeIcon}>🏥</Text>
                  <Text style={styles.sosTypeText}>Medical Emergency</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.sosTypeButton, { backgroundColor: NEO_COLORS.PURPLE }]}
                  onPress={() => handleSendSOS('police')}
                >
                  <Text style={styles.sosTypeIcon}>🚔</Text>
                  <Text style={styles.sosTypeText}>Police/Security</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.sosTypeButton, { backgroundColor: NEO_COLORS.ORANGE }]}
                  onPress={() => handleSendSOS('violence')}
                >
                  <Text style={styles.sosTypeIcon}>⚠️</Text>
                  <Text style={styles.sosTypeText}>Violence/Threat</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => setSOSModalVisible(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={[styles.statCard, { backgroundColor: NEO_COLORS.GREEN }]}>
          <Text style={styles.statNumber}>{totalIncidents}</Text>
          <Text style={styles.statLabel}>Total Reports</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: NEO_COLORS.BLUE }]}>
          <Text style={styles.statNumber}>{recentIncidents.length}</Text>
          <Text style={styles.statLabel}>Last Hour</Text>
        </View>
      </View>

      {/* Location Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          {currentLocation ? (
            <>
              <Text style={styles.locationText}>
                📍 {getShortLocation(currentAddress, {
                  lat: currentLocation.coords.latitude,
                  lon: currentLocation.coords.longitude,
                })}
              </Text>
              <Text style={styles.locationSubtext}>
                {currentLocation.coords.latitude.toFixed(4)}, {currentLocation.coords.longitude.toFixed(4)}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.locationText}>📍 Getting location...</Text>
              <TouchableOpacity
                style={styles.enableButton}
                onPress={async () => {
                  const success = await requestLocationPermission();
                  if (!success) {
                    window.alert('Location Error\n\nPlease allow location access in your browser settings');
                  }
                }}
              >
                <Text style={styles.enableButtonText}>Enable Location</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>

      {/* Incident Types Overview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Incidents by Type</Text>
        <View style={styles.typeGrid}>
          <View style={[styles.typeCard, { borderColor: NEO_COLORS.RED }]}>
            <Text style={styles.typeIcon}>🔥</Text>
            <Text style={styles.typeCount}>{getIncidentTypeCount('fire')}</Text>
            <Text style={styles.typeLabel}>Fire</Text>
          </View>
          <View style={[styles.typeCard, { borderColor: NEO_COLORS.PURPLE }]}>
            <Text style={styles.typeIcon}>🚔</Text>
            <Text style={styles.typeCount}>{getIncidentTypeCount('crime')}</Text>
            <Text style={styles.typeLabel}>Crime</Text>
          </View>
          <View style={[styles.typeCard, { borderColor: NEO_COLORS.YELLOW }]}>
            <Text style={styles.typeIcon}>🚧</Text>
            <Text style={styles.typeCount}>{getIncidentTypeCount('roadblock')}</Text>
            <Text style={styles.typeLabel}>Roadblock</Text>
          </View>
          <View style={[styles.typeCard, { borderColor: NEO_COLORS.BLUE }]}>
            <Text style={styles.typeIcon}>⚡</Text>
            <Text style={styles.typeCount}>{getIncidentTypeCount('power_outage')}</Text>
            <Text style={styles.typeLabel}>Power</Text>
          </View>
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Pulse web app connects directly to the backend for real-time incident reporting.
          Your reports help keep the community informed and safe.
        </Text>
      </View>

      <View style={{ height: 32 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
  },
  header: {
    padding: 24,
    backgroundColor: NEO_COLORS.BLACK,
    alignItems: 'center',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: NEO_COLORS.CREAM,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  webBanner: {
    backgroundColor: NEO_COLORS.YELLOW,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
    padding: 12,
  },
  webBannerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 12,
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  statLabel: {
    fontSize: 12,
    color: NEO_COLORS.BLACK,
    marginTop: 4,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 16,
  },
  locationText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 4,
  },
  locationSubtext: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
  },
  enableButton: {
    backgroundColor: NEO_COLORS.GREEN,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 6,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  enableButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeCard: {
    width: '23%',
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 4,
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeCount: {
    fontSize: 28,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  typeLabel: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    marginTop: 4,
    fontWeight: 'bold',
  },
  infoSection: {
    backgroundColor: NEO_COLORS.BLUE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 16,
    margin: 16,
  },
  infoText: {
    fontSize: 14,
    color: NEO_COLORS.BLACK,
    lineHeight: 20,
    textAlign: 'center',
  },
  sosButton: {
    backgroundColor: NEO_COLORS.RED,
    borderWidth: 5,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 16,
    padding: 24,
    margin: 16,
    marginTop: 8,
    alignItems: 'center',
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  sosButtonText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  sosButtonSubtext: {
    fontSize: 12,
    color: NEO_COLORS.WHITE,
    marginTop: 4,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 5,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textAlign: 'center',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  modalSubtitle: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
    textAlign: 'center',
    marginBottom: 24,
  },
  sosTypeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  sosTypeIcon: {
    fontSize: 32,
    marginRight: 12,
  },
  sosTypeText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    flex: 1,
  },
  cancelButton: {
    backgroundColor: NEO_COLORS.GRAY,
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginTop: 16,
  },
});

