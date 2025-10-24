import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useHelplines } from '../contexts/HelplinesContext';
import { NEO_COLORS } from '../constants/neoBrutalism';

export default function HelplinesScreen() {
  const {
    helplines,
    isLoading,
    error,
    fetchHelplines,
    fetchNearbyHelplines,
    clearError,
  } = useHelplines();

  const [searchText, setSearchText] = useState('');

  const handleSearch = () => {
    if (searchText.trim()) {
      fetchHelplines(searchText);
    }
  };

  const handleNearbySearch = () => {
    fetchNearbyHelplines();
  };

  const handleCall = (number: string) => {
    const phoneNumber = number.replace(/[^0-9+]/g, '');
    Alert.alert(
      'Call Emergency Service',
      `Do you want to call ${number}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Call',
          onPress: () => {
            Linking.openURL(`tel:${phoneNumber}`).catch((err) => {
              Alert.alert('Error', 'Unable to make phone call');
              console.error('Error making call:', err);
            });
          },
        },
      ]
    );
  };

  const handleSMS = (number: string) => {
    const phoneNumber = number.replace(/[^0-9+]/g, '');
    Linking.openURL(`sms:${phoneNumber}`).catch((err) => {
      Alert.alert('Error', 'Unable to send SMS');
      console.error('Error sending SMS:', err);
    });
  };

  const getContactIcon = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'fire':
      case 'local_fire_dept':
        return 'local-fire-department';
      case 'police':
        return 'local-police';
      case 'medical':
      case 'hospital':
        return 'local-hospital';
      case 'ambulance':
        return 'ambulance';
      case 'poison_control':
        return 'warning';
      default:
        return 'phone';
    }
  };

  const getContactColor = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'fire':
      case 'local_fire_dept':
        return NEO_COLORS.RED;
      case 'police':
        return NEO_COLORS.BLUE;
      case 'medical':
      case 'hospital':
      case 'ambulance':
        return NEO_COLORS.GREEN;
      case 'poison_control':
        return NEO_COLORS.YELLOW;
      default:
        return NEO_COLORS.GRAY;
    }
  };

  const formatContactType = (type: string): string => {
    return type
      .replace(/_/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Emergency Helplines</Text>
        <Text style={styles.subtitle}>Find local emergency contacts</Text>
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchContainer}>
          <Icon
            name="search"
            size={24}
            color={NEO_COLORS.GRAY}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Enter city or location..."
            placeholderTextColor={NEO_COLORS.GRAY}
            value={searchText}
            onChangeText={setSearchText}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.searchButton]}
            onPress={handleSearch}
            disabled={isLoading || !searchText.trim()}
          >
            <Icon name="search" size={20} color={NEO_COLORS.WHITE} />
            <Text style={styles.buttonText}>Search</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.nearbyButton]}
            onPress={handleNearbySearch}
            disabled={isLoading}
          >
            <Icon name="my-location" size={20} color={NEO_COLORS.WHITE} />
            <Text style={styles.buttonText}>Near Me</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading State */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={NEO_COLORS.BLUE} />
          <Text style={styles.loadingText}>
            Searching for emergency contacts...
          </Text>
          <Text style={styles.loadingSubtext}>
            Using web search + AI extraction
          </Text>
        </View>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={NEO_COLORS.RED} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={clearError}>
            <Text style={styles.retryButtonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Results */}
      {helplines && !isLoading && !error && (
        <ScrollView
          style={styles.resultsContainer}
          contentContainerStyle={styles.resultsContent}
        >
          {/* Location Header */}
          <View style={styles.locationHeader}>
            <Icon name="place" size={24} color={NEO_COLORS.BLACK} />
            <Text style={styles.locationText}>{helplines.location}</Text>
          </View>

          {/* Cache Info */}
          <View style={styles.cacheInfo}>
            <Icon
              name={helplines.from_cache ? 'check-circle' : 'cloud-download'}
              size={16}
              color={helplines.from_cache ? NEO_COLORS.GREEN : NEO_COLORS.BLUE}
            />
            <Text style={styles.cacheText}>
              {helplines.from_cache
                ? 'Cached data (instant)'
                : `Fresh search (${helplines.sources_checked || 0} sources)`}
            </Text>
          </View>

          {/* Emergency Number */}
          <View style={[styles.card, styles.emergencyCard]}>
            <View style={styles.emergencyHeader}>
              <Icon name="warning" size={32} color={NEO_COLORS.WHITE} />
              <View style={styles.emergencyTextContainer}>
                <Text style={styles.emergencyLabel}>EMERGENCY</Text>
                <Text style={styles.emergencyNumber}>{helplines.emergency}</Text>
              </View>
            </View>
            <View style={styles.emergencyButtons}>
              <TouchableOpacity
                style={styles.emergencyCallButton}
                onPress={() => handleCall(helplines.emergency)}
              >
                <Icon name="phone" size={24} color={NEO_COLORS.WHITE} />
                <Text style={styles.emergencyCallText}>CALL NOW</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Contacts List */}
          {helplines.contacts.length > 0 && (
            <View style={styles.contactsSection}>
              <Text style={styles.sectionTitle}>Local Services</Text>
              {helplines.contacts.map((contact, index) => (
                <View key={index} style={styles.contactCard}>
                  <View style={styles.contactHeader}>
                    <View
                      style={[
                        styles.contactIcon,
                        { backgroundColor: getContactColor(contact.type) },
                      ]}
                    >
                      <Icon
                        name={getContactIcon(contact.type)}
                        size={24}
                        color={NEO_COLORS.WHITE}
                      />
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactType}>
                        {formatContactType(contact.type)}
                      </Text>
                      <Text style={styles.contactNumber}>{contact.number}</Text>
                    </View>
                  </View>

                  {/* Confidence Badge */}
                  {contact.confidence && (
                    <View style={styles.confidenceBadge}>
                      <Text style={styles.confidenceText}>
                        {Math.round(contact.confidence * 100)}% confidence
                      </Text>
                    </View>
                  )}

                  {/* Source Link */}
                  {contact.source && (
                    <TouchableOpacity
                      onPress={() => Linking.openURL(contact.source)}
                    >
                      <Text style={styles.sourceText} numberOfLines={1}>
                        Source: {contact.source}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Action Buttons */}
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      style={styles.callButton}
                      onPress={() => handleCall(contact.number)}
                    >
                      <Icon name="phone" size={20} color={NEO_COLORS.WHITE} />
                      <Text style={styles.callButtonText}>Call</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.smsButton}
                      onPress={() => handleSMS(contact.number)}
                    >
                      <Icon name="message" size={20} color={NEO_COLORS.BLACK} />
                      <Text style={styles.smsButtonText}>SMS</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Fallback Info */}
          <View style={styles.fallbackInfo}>
            <Icon name="info" size={16} color={NEO_COLORS.GRAY} />
            <Text style={styles.fallbackText}>
              If unable to reach any number above, call {helplines.fallback}
            </Text>
          </View>
        </ScrollView>
      )}

      {/* Empty State */}
      {!helplines && !isLoading && !error && (
        <View style={styles.emptyContainer}>
          <Icon name="phone-in-talk" size={64} color={NEO_COLORS.GRAY} />
          <Text style={styles.emptyText}>Search for Emergency Contacts</Text>
          <Text style={styles.emptySubtext}>
            Enter a location or use "Near Me" to find local emergency services
          </Text>
        </View>
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
  searchSection: {
    padding: 16,
    backgroundColor: NEO_COLORS.WHITE,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.CREAM,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    color: NEO_COLORS.BLACK,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  searchButton: {
    backgroundColor: NEO_COLORS.BLUE,
  },
  nearbyButton: {
    backgroundColor: NEO_COLORS.GREEN,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginTop: 16,
  },
  loadingSubtext: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: NEO_COLORS.RED,
    textAlign: 'center',
    marginTop: 16,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: NEO_COLORS.BLACK,
    borderRadius: 8,
  },
  retryButtonText: {
    color: NEO_COLORS.WHITE,
    fontWeight: 'bold',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    padding: 16,
    gap: 16,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  cacheInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  cacheText: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
  },
  card: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 12,
    padding: 16,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  emergencyCard: {
    backgroundColor: NEO_COLORS.RED,
    marginBottom: 24,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  emergencyTextContainer: {
    flex: 1,
  },
  emergencyLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    letterSpacing: 2,
  },
  emergencyNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  emergencyButtons: {
    flexDirection: 'row',
  },
  emergencyCallButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    backgroundColor: NEO_COLORS.BLACK,
    borderRadius: 8,
  },
  emergencyCallText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  contactsSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  contactCard: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 16,
    gap: 12,
  },
  contactHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactType: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  contactNumber: {
    fontSize: 18,
    color: NEO_COLORS.BLACK,
    marginTop: 2,
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: NEO_COLORS.GREEN,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  confidenceText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  sourceText: {
    fontSize: 12,
    color: NEO_COLORS.BLUE,
    textDecorationLine: 'underline',
  },
  contactActions: {
    flexDirection: 'row',
    gap: 12,
  },
  callButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: NEO_COLORS.GREEN,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  callButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  smsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: NEO_COLORS.WHITE,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  smsButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  fallbackInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
    backgroundColor: NEO_COLORS.YELLOW,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
  },
  fallbackText: {
    flex: 1,
    fontSize: 14,
    color: NEO_COLORS.BLACK,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
    marginTop: 8,
    textAlign: 'center',
  },
});

