import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useIncidents } from '../contexts/IncidentContext';
import { useBle } from '../contexts/BleContext';
import { NEO_COLORS } from '../constants/neoBrutalism';

type IncidentType = 'fire' | 'crime' | 'roadblock' | 'power_outage';

interface IncidentButton {
  type: IncidentType;
  icon: string;
  label: string;
  color: string;
}

const INCIDENT_TYPES: IncidentButton[] = [
  { type: 'fire', icon: '🔥', label: 'Fire', color: NEO_COLORS.RED },
  { type: 'crime', icon: '🚔', label: 'Crime', color: NEO_COLORS.PURPLE },
  { type: 'roadblock', icon: '🚧', label: 'Roadblock', color: NEO_COLORS.YELLOW },
  { type: 'power_outage', icon: '⚡', label: 'Power Outage', color: NEO_COLORS.BLUE },
];

export default function ReportScreen() {
  const { addIncident, currentLocation, requestLocationPermission, deviceId } = useIncidents();
  const { isMaster, connectedPeers } = useBle();
  
  const [selectedType, setSelectedType] = useState<IncidentType | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleTypeSelect = (type: IncidentType) => {
    setSelectedType(type);
    
    // Auto-fill title based on type
    const defaultTitles: Record<IncidentType, string> = {
      fire: 'Fire Incident',
      crime: 'Crime Report',
      roadblock: 'Road Blocked',
      power_outage: 'Power Outage',
    };
    
    if (!title) {
      setTitle(defaultTitles[type]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedType) {
      Alert.alert('Error', 'Please select an incident type');
      return;
    }

    if (!title.trim()) {
      Alert.alert('Error', 'Please provide a title');
      return;
    }

    // Check location permission
    if (!currentLocation) {
      const granted = await requestLocationPermission();
      if (!granted) {
        Alert.alert(
          'Location Required',
          'Location access is required to report incidents. Please enable location services.'
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Create incident payload
      const incident = {
        report_type: selectedType,
        title: title.trim(),
        description: description.trim(),
        location: {
          lat: currentLocation?.coords.latitude || 0,
          lon: currentLocation?.coords.longitude || 0,
        },
      };

      // addIncident handles both online (API) and offline (BLE) automatically
      const incidentId = await addIncident(incident);

      // Reset form
      setSelectedType(null);
      setTitle('');
      setDescription('');

      Alert.alert(
        'Incident Reported',
        `Your ${selectedType} report has been submitted successfully.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Failed to submit incident:', error);
      Alert.alert('Error', 'Failed to submit incident report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };


  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Report Incident</Text>
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: isMaster ? NEO_COLORS.GREEN : NEO_COLORS.GRAY }]} />
          <Text style={styles.statusText}>
            {isMaster ? `Broadcasting (${connectedPeers} peers)` : 'Listening'}
          </Text>
        </View>
      </View>

      {/* Incident Type Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Select Incident Type</Text>
        <View style={styles.typeGrid}>
          {INCIDENT_TYPES.map((incident) => (
            <TouchableOpacity
              key={incident.type}
              style={[
                styles.typeButton,
                { borderColor: incident.color },
                selectedType === incident.type && { backgroundColor: incident.color },
              ]}
              onPress={() => handleTypeSelect(incident.type)}
              disabled={isSubmitting}
            >
              <Text style={styles.typeIcon}>{incident.icon}</Text>
              <Text
                style={[
                  styles.typeLabel,
                  selectedType === incident.type && styles.typeLabelSelected,
                ]}
              >
                {incident.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Title Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief description of the incident"
          value={title}
          onChangeText={setTitle}
          maxLength={100}
          editable={!isSubmitting}
        />
      </View>

      {/* Description Input */}
      <View style={styles.section}>
        <Text style={styles.label}>Additional Details (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Any additional information..."
          value={description}
          onChangeText={setDescription}
          maxLength={500}
          multiline
          numberOfLines={4}
          editable={!isSubmitting}
        />
      </View>

      {/* Location Info */}
      {currentLocation && (
        <View style={styles.locationInfo}>
          <Text style={styles.locationText}>
            📍 Location: {currentLocation.coords.latitude.toFixed(4)}, {currentLocation.coords.longitude.toFixed(4)}
          </Text>
        </View>
      )}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton,
          (!selectedType || !title.trim() || isSubmitting) && styles.submitButtonDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedType || !title.trim() || isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : 'Report Incident'}
        </Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Reports are broadcast via BLE mesh and synced when online
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeButton: {
    width: '48%',
    aspectRatio: 1,
    borderWidth: 4,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.WHITE,
  },
  typeIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  typeLabelSelected: {
    color: NEO_COLORS.WHITE,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  input: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  locationInfo: {
    backgroundColor: NEO_COLORS.BLUE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    marginBottom: 24,
  },
  locationText: {
    fontSize: 14,
    color: NEO_COLORS.BLACK,
  },
  submitButton: {
    backgroundColor: NEO_COLORS.GREEN,
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: NEO_COLORS.GRAY,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  footerText: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    textAlign: 'center',
  },
});

