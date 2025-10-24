import React, { useState } from 'react';
import {
  Alert,
  View,
  StyleSheet,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { useBle } from '../contexts/BleContext';
import { MessageState } from '../utils/bleUtils';
import { NEO_COLORS } from '../constants/neoBrutalism';

const MeshScreen = () => {
  const [message, setMessage] = useState('');

  // Use the global BLE context
  const {
    isBroadcasting,
    hasInternet,
    masterState,
    broadcastMessage,
    startBroadcasting,
    stopBroadcasting,
    clearAllAndStop,
    getCurrentBroadcastInfo,
    getProgressFor,
  } = useBle();

  const handleStartUserBroadcast = async () => {
    try {
      await broadcastMessage(message);
      setMessage('');
    } catch (err) {
      Alert.alert(
        'Error',
        (err as Error).message || 'Failed to encode message'
      );
    }
  };

  // Clear everything & stop (single button)
  const handleClearEverythingAndStop = () => {
    if (masterState.size === 0 && !isBroadcasting) {
      return;
    }

    Alert.alert(
      'Clear Everything & Stop',
      'This will clear received messages, clear the broadcast queue, and stop broadcasting. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear all & stop',
          style: 'destructive',
          onPress: clearAllAndStop,
        },
      ]
    );
  };

  const renderReceivedMessageCard = (state: MessageState) => {
    const progress = getProgressFor(state);
    return (
      <View key={`msg-${state.id}`} style={styles.messageCard}>
        <View style={styles.messageHeader}>
          <Text style={styles.messageTitle}>
            {state.isAck ? '✅ RESPONSE' : '📤 REQUEST'}
          </Text>
        </View>

        <Text style={styles.messageText} numberOfLines={3}>
          {state.fullMessage ||
            (state.isComplete ? '(Decoded)' : '(Incomplete)')}
        </Text>

        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text style={styles.progressText}>
              Chunks: {progress.received}/{progress.total}
            </Text>
            <Text style={styles.progressPercent}>{progress.percent}%</Text>
          </View>
          
          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${progress.percent}%` },
              ]}
            />
          </View>

          <View style={styles.chunkGrid}>
            {Array.from({ length: state.totalChunks }, (_, i) => {
              const idx = i + 1;
              const have = state.chunks.has(idx);
              return (
                <View
                  key={idx}
                  style={[
                    styles.chunkBadge,
                    have ? styles.chunkHave : styles.chunkMissing,
                  ]}
                >
                  <Text style={styles.chunkBadgeText}>{idx}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>
    );
  };

  const allMessages = Array.from(masterState.values()).sort(
    (a, b) => b.id - a.id
  );
  const currentBroadcast = getCurrentBroadcastInfo();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>MESH NETWORK</Text>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                {
                  backgroundColor: hasInternet
                    ? NEO_COLORS.GREEN
                    : NEO_COLORS.BLUE,
                },
              ]}
            />
            <Text style={styles.statusText}>
              {hasInternet ? 'ONLINE' : 'BLE MESH'}
            </Text>
          </View>
        </View>

        {/* Broadcast Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BROADCAST</Text>
          <View style={styles.card}>
            <View style={styles.broadcastStatus}>
              <Text style={styles.label}>Currently Broadcasting:</Text>
              <Text style={styles.broadcastText}>
                {isBroadcasting && currentBroadcast.text
                  ? `🔊 ${currentBroadcast.text}`
                  : '— not broadcasting —'}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.controlButton,
                { backgroundColor: isBroadcasting ? NEO_COLORS.RED : NEO_COLORS.GREEN },
              ]}
              onPress={() => {
                if (isBroadcasting) stopBroadcasting();
                else startBroadcasting();
              }}
            >
              <Text style={styles.controlButtonText}>
                {isBroadcasting ? '⏸ PAUSE' : '▶ START'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.inputLabel}>New Message:</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder="Type your message..."
              placeholderTextColor={NEO_COLORS.GRAY}
              style={styles.textInput}
              multiline
            />
            
            <TouchableOpacity
              style={[
                styles.broadcastButton,
                !message.trim() && styles.broadcastButtonDisabled,
              ]}
              onPress={handleStartUserBroadcast}
              disabled={!message.trim()}
            >
              <Text style={styles.broadcastButtonText}>📡 BROADCAST MESSAGE</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Network Messages Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>NETWORK MESSAGES</Text>
            <TouchableOpacity
              onPress={handleClearEverythingAndStop}
              style={styles.clearButton}
            >
              <Text style={styles.clearButtonText}>CLEAR</Text>
            </TouchableOpacity>
          </View>

          {allMessages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>📡 Listening for messages...</Text>
            </View>
          ) : (
            allMessages.map((msg) => renderReceivedMessageCard(msg))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NEO_COLORS.CREAM,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    paddingTop: 24,
    backgroundColor: NEO_COLORS.BLACK,
    borderBottomWidth: 4,
    borderBottomColor: NEO_COLORS.BLACK,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
    letterSpacing: 2,
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
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
  },
  section: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
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
  broadcastStatus: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 4,
  },
  broadcastText: {
    fontSize: 16,
    color: NEO_COLORS.BLACK,
    fontWeight: '600',
  },
  controlButton: {
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  controlButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textTransform: 'uppercase',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  textInput: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  broadcastButton: {
    backgroundColor: NEO_COLORS.BLUE,
    borderWidth: 4,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
  },
  broadcastButtonDisabled: {
    backgroundColor: NEO_COLORS.GRAY,
    opacity: 0.5,
  },
  broadcastButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textTransform: 'uppercase',
  },
  clearButton: {
    backgroundColor: NEO_COLORS.RED,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.WHITE,
    textTransform: 'uppercase',
  },
  emptyState: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: NEO_COLORS.GRAY,
    fontWeight: '600',
  },
  messageCard: {
    backgroundColor: NEO_COLORS.WHITE,
    borderWidth: 3,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  messageHeader: {
    marginBottom: 8,
  },
  messageTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textTransform: 'uppercase',
  },
  messageText: {
    fontSize: 14,
    color: NEO_COLORS.BLACK,
    marginBottom: 12,
    lineHeight: 20,
  },
  progressSection: {
    marginTop: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  progressPercent: {
    fontSize: 12,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
  },
  progressBarContainer: {
    height: 12,
    backgroundColor: NEO_COLORS.CREAM,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: NEO_COLORS.GREEN,
  },
  chunkGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  chunkBadge: {
    minWidth: 28,
    height: 28,
    borderWidth: 2,
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chunkBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  chunkHave: {
    backgroundColor: NEO_COLORS.GREEN,
  },
  chunkMissing: {
    backgroundColor: NEO_COLORS.YELLOW,
  },
});

export default MeshScreen;
