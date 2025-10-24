import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useIncidents } from '../contexts/IncidentContext';
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
  const { addIncident, currentLocation, requestLocationPermission } = useIncidents();
  
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
      window.alert('Please select an incident type');
      return;
    }

    if (!title.trim()) {
      window.alert('Please provide a title');
      return;
    }

    // Check location permission
    if (!currentLocation) {
      const granted = await requestLocationPermission();
      if (!granted) {
        window.alert('Location access is required to report incidents. Please enable location services.');
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

      await addIncident(incident);

      window.alert('✅ Incident Reported!\n\nYour report has been submitted successfully.');
      
      // Reset form
      setSelectedType(null);
      setTitle('');
      setDescription('');
    } catch (error) {
      console.error('Failed to submit incident:', error);
      window.alert('Failed to submit incident. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Report Incident</Text>
        <Text style={styles.subtitle}>Help keep the community safe</Text>
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
                { 
                  borderColor: incident.color,
                  backgroundColor: selectedType === incident.type ? incident.color : `${incident.color}40`
                },
              ]}
              onPress={() => handleTypeSelect(incident.type)}
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
        <Text style={styles.sectionTitle}>Title *</Text>
        <TextInput
          style={styles.input}
          placeholder="Brief description of the incident"
          placeholderTextColor={NEO_COLORS.GRAY}
          value={title}
          onChangeText={setTitle}
        />
      </View>

      {/* Description Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description (Optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Additional details about the incident..."
          placeholderTextColor={NEO_COLORS.GRAY}
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
        />
      </View>

      {/* Location Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationCard}>
          {currentLocation ? (
            <>
              <Text style={styles.locationText}>
                📍 {currentLocation.coords.latitude.toFixed(4)}, {currentLocation.coords.longitude.toFixed(4)}
              </Text>
              <Text style={styles.locationSubtext}>Using your current location</Text>
            </>
          ) : (
            <Text style={styles.locationText}>📍 Location not available</Text>
          )}
        </View>
      </View>

      {/* Submit Button */}
      <TouchableOpacity
        style={[styles.submitButton, (!selectedType || !title.trim() || isSubmitting) && styles.submitButtonDisabled]}
        onPress={handleSubmit}
        disabled={!selectedType || !title.trim() || isSubmitting}
      >
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Submitting...' : '🚨 Submit Report'}
        </Text>
      </TouchableOpacity>

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
    padding: 16,
    paddingTop: 24,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: NEO_COLORS.GRAY,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  typeButton: {
    width: '48%',
    borderWidth: 4,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  typeIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  typeLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  typeLabelSelected: {
    color: NEO_COLORS.WHITE,
  },
  input: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: NEO_COLORS.BLACK,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  locationCard: {
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
  },
  locationSubtext: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    marginTop: 4,
  },
  submitButton: {
    backgroundColor: NEO_COLORS.RED,
    borderWidth: 5,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 12,
    padding: 16,
    margin: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: NEO_COLORS.GRAY,
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
  },
});

