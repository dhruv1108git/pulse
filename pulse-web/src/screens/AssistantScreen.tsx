import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useChat } from '../contexts/ChatContext';
import { NEO_COLORS } from '../constants/neoBrutalism';

export default function AssistantScreen() {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyPress = (e: any) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>AI Assistant</Text>
          <Text style={styles.headerSubtitle}>Ask about incidents and emergencies</Text>
        </View>
      </View>

      {isLoading && (
        <View style={styles.loadingBar}>
          <ActivityIndicator size="small" color={NEO_COLORS.BLUE} />
          <Text style={styles.loadingText}>Thinking…</Text>
        </View>
      )}

      <ScrollView
        ref={scrollRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💬</Text>
            <Text style={styles.emptyText}>Start a conversation with the AI assistant</Text>
            <Text style={styles.emptySubtext}>Ask about incidents, get emergency information, or request help</Text>
          </View>
        ) : (
          <>
            {/* Render messages in reverse (newest at bottom) */}
            {[...messages].reverse().map((message) => (
              <View
                key={message._id}
                style={[
                  styles.bubble,
                  message.user._id === 1 ? styles.rightBubble : styles.leftBubble,
                ]}
              >
                <Text
                  style={[
                    styles.bubbleText,
                    message.user._id === 1 ? styles.rightText : styles.leftText,
                  ]}
                >
                  {message.text}
                </Text>
                <Text
                  style={[
                    styles.timestamp,
                    message.user._id === 1 ? styles.rightTimestamp : styles.leftTimestamp,
                  ]}
                >
                  {new Date(message.createdAt).toLocaleTimeString(undefined, { 
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true
                  })}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask me about incidents..."
          placeholderTextColor={NEO_COLORS.GRAY}
          value={input}
          onChangeText={setInput}
          onKeyPress={handleKeyPress as any}
          multiline
        />
        <TouchableOpacity 
          style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]} 
          onPress={handleSend}
          disabled={!input.trim() || isLoading}
        >
          <Text style={styles.sendText}>SEND</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: NEO_COLORS.CREAM,
    flexDirection: 'column',
  },
  header: {
    padding: 16,
    paddingTop: 24,
    borderBottomWidth: 3,
    borderBottomColor: NEO_COLORS.BLACK,
    backgroundColor: NEO_COLORS.BLUE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: NEO_COLORS.BLACK,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 16,
    color: NEO_COLORS.BLACK,
    marginTop: 4,
    textAlign: 'center',
  },
  loadingBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center',
    gap: 8, 
    padding: 8, 
    backgroundColor: NEO_COLORS.WHITE, 
    borderBottomWidth: 3, 
    borderColor: NEO_COLORS.BLACK 
  },
  loadingText: { 
    color: NEO_COLORS.BLACK, 
    fontWeight: 'bold' 
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: { 
    padding: 12,
    minHeight: '100%',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: NEO_COLORS.GRAY,
    textAlign: 'center',
  },
  bubble: { 
    maxWidth: '80%', 
    marginVertical: 6, 
    padding: 12, 
    borderWidth: 3, 
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 8,
  },
  rightBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: NEO_COLORS.BLUE 
  },
  leftBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: NEO_COLORS.WHITE 
  },
  bubbleText: { 
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 20,
  },
  rightText: { 
    color: NEO_COLORS.WHITE 
  },
  leftText: { 
    color: NEO_COLORS.BLACK 
  },
  timestamp: {
    fontSize: 11,
    marginTop: 4,
  },
  rightTimestamp: {
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'right',
  },
  leftTimestamp: {
    color: NEO_COLORS.GRAY,
    textAlign: 'left',
  },
  inputRow: { 
    flexDirection: 'row', 
    alignItems: 'flex-end', 
    padding: 8, 
    gap: 8, 
    borderTopWidth: 3, 
    borderColor: NEO_COLORS.BLACK, 
    backgroundColor: NEO_COLORS.WHITE 
  },
  input: { 
    flex: 1, 
    minHeight: 44,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 3, 
    borderColor: NEO_COLORS.BLACK, 
    backgroundColor: NEO_COLORS.CREAM,
    borderRadius: 6,
    fontSize: 15,
  },
  sendBtn: { 
    paddingVertical: 10, 
    paddingHorizontal: 16, 
    backgroundColor: NEO_COLORS.BLUE, 
    borderWidth: 3, 
    borderColor: NEO_COLORS.BLACK,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: NEO_COLORS.GRAY,
    opacity: 0.5,
  },
  sendText: { 
    color: NEO_COLORS.WHITE, 
    fontWeight: 'bold' 
  },
});

