import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useIncidents } from '../contexts/IncidentContext';
import { NEO_COLORS } from '../constants/neoBrutalism';
import { API_BASE_URL } from '../constants/api';

interface SafetyMetrics {
  safety_score: number;
  total_incidents: number;
  critical_incidents: number;
  recent_24h: number;
  by_type: Array<{ type: string; count: number }>;
}

export default function InsightsScreen() {
  const { currentLocation } = useIncidents();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [metrics, setMetrics] = useState<SafetyMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = async () => {
    setLoading(true);
    setError(null);

    try {
      const lat = currentLocation?.coords.latitude || 37.7749;
      const lon = currentLocation?.coords.longitude || -122.4194;

      const response = await fetch(
        `${API_BASE_URL}/api/insights/safety-score?lat=${lat}&lon=${lon}&radius=10km&time_range=7d`
      );

      const json = await response.json();

      if (json.success && json.data) {
        setMetrics({
          safety_score: json.data.safety_score,
          total_incidents: json.data.metrics?.total_incidents || 0,
          critical_incidents: json.data.metrics?.critical_incidents || 0,
          recent_24h: json.data.metrics?.recent_24h || 0,
          by_type: json.data.metrics?.by_type || [],
        });
      } else {
        setError('Failed to load insights');
      }
    } catch (err) {
      setError('Unable to connect to insights service');
      console.error('Error fetching insights:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [currentLocation]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  const getSafetyColor = (score: number): string => {
    if (score >= 80) return NEO_COLORS.GREEN;
    if (score >= 60) return NEO_COLORS.YELLOW;
    if (score >= 40) return '#FF8C00'; // Orange
    return NEO_COLORS.RED;
  };

  const getSafetyLabel = (score: number): string => {
    if (score >= 80) return 'SAFE';
    if (score >= 60) return 'MODERATE';
    if (score >= 40) return 'CAUTION';
    return 'UNSAFE';
  };

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'fire':
        return 'local-fire-department';
      case 'crime':
        return 'security';
      case 'roadblock':
        return 'block';
      case 'power_outage':
        return 'power-off';
      case 'medical':
        return 'local-hospital';
      default:
        return 'error';
    }
  };

  const getTypeColor = (type: string): string => {
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
        return NEO_COLORS.GREEN;
      default:
        return NEO_COLORS.GRAY;
    }
  };

  if (loading && !metrics) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={NEO_COLORS.BLUE} />
        <Text style={styles.loadingText}>Loading insights...</Text>
      </View>
    );
  }

  if (error && !metrics) {
    return (
      <View style={styles.errorContainer}>
        <Icon name="error-outline" size={64} color={NEO_COLORS.RED} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchInsights}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Safety Insights</Text>
        <Text style={styles.subtitle}>Last 7 days • 10km radius</Text>
      </View>

      {metrics && (
        <>
          {/* Safety Score Card */}
          <View style={styles.section}>
            <View
              style={[
                styles.safetyScoreCard,
                { backgroundColor: getSafetyColor(metrics.safety_score) },
              ]}
            >
              <View style={styles.scoreHeader}>
                <Icon name="shield" size={48} color={NEO_COLORS.WHITE} />
                <View style={styles.scoreContent}>
                  <Text style={styles.scoreNumber}>{metrics.safety_score.toFixed(0)}</Text>
                  <Text style={styles.scoreLabel}>{getSafetyLabel(metrics.safety_score)}</Text>
                </View>
              </View>
              <Text style={styles.scoreDescription}>
                Area Safety Score (0-100)
              </Text>
            </View>
          </View>

          {/* Quick Stats */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Statistics</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: NEO_COLORS.BLUE }]}>
                <Icon name="assessment" size={32} color={NEO_COLORS.WHITE} />
                <Text style={styles.statNumber}>{metrics.total_incidents}</Text>
                <Text style={styles.statLabel}>Total Reports</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: NEO_COLORS.RED }]}>
                <Icon name="warning" size={32} color={NEO_COLORS.WHITE} />
                <Text style={styles.statNumber}>{metrics.critical_incidents}</Text>
                <Text style={styles.statLabel}>Critical</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: NEO_COLORS.GREEN }]}>
                <Icon name="schedule" size={32} color={NEO_COLORS.WHITE} />
                <Text style={styles.statNumber}>{metrics.recent_24h}</Text>
                <Text style={styles.statLabel}>Last 24h</Text>
              </View>
            </View>
          </View>

          {/* Incident Types Breakdown */}
          {metrics.by_type.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Incidents by Type</Text>
              <View style={styles.typesList}>
                {metrics.by_type.map((item, index) => (
                  <View key={index} style={styles.typeCard}>
                    <View
                      style={[
                        styles.typeIcon,
                        { backgroundColor: getTypeColor(item.type) },
                      ]}
                    >
                      <Icon
                        name={getTypeIcon(item.type)}
                        size={24}
                        color={NEO_COLORS.WHITE}
                      />
                    </View>
                    <View style={styles.typeInfo}>
                      <Text style={styles.typeName}>
                        {item.type.replace('_', ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.typeCount}>{item.count} reports</Text>
                    </View>
                    <View style={styles.typeBar}>
                      <View
                        style={[
                          styles.typeBarFill,
                          {
                            width: `${Math.min(
                              (item.count / metrics.total_incidents) * 100,
                              100
                            )}%`,
                            backgroundColor: getTypeColor(item.type),
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Info Card */}
          <View style={styles.infoCard}>
            <Icon name="info" size={20} color={NEO_COLORS.BLUE} />
            <Text style={styles.infoText}>
              Safety score is calculated using AI-powered analysis of incident
              frequency, severity, and proximity. Pull down to refresh.
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.CREAM,
  },
  loadingText: {
    fontSize: 16,
    color: NEO_COLORS.GRAY,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.CREAM,
    padding: 32,
  },
  errorText: {
    fontSize: 16,
    color: NEO_COLORS.RED,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  retryButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: NEO_COLORS.BLUE,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
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
  section: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
  },
  safetyScoreCard: {
    padding: 24,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  scoreHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 16,
  },
  scoreContent: {
    flex: 1,
  },
  scoreNumber: {
    fontSize: 48,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  scoreLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    letterSpacing: 2,
  },
  scoreDescription: {
    fontSize: 14,
    color: NEO_COLORS.WHITE,
    opacity: 0.9,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    alignItems: 'center',
    gap: 8,
    shadowColor: NEO_COLORS.BLACK,
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textAlign: 'center',
  },
  typesList: {
    gap: 12,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NEO_COLORS.WHITE,
    padding: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    gap: 12,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeInfo: {
    flex: 1,
  },
  typeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  typeCount: {
    fontSize: 12,
    color: NEO_COLORS.GRAY,
    marginTop: 2,
  },
  typeBar: {
    width: 80,
    height: 8,
    backgroundColor: NEO_COLORS.CREAM,
    borderRadius: 4,
    overflow: 'hidden',
  },
  typeBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    margin: 16,
    backgroundColor: NEO_COLORS.BLUE + '20',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLUE,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: NEO_COLORS.BLACK,
    lineHeight: 20,
  },
});

