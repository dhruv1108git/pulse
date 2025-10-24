import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useChat } from '../contexts/ChatContext';
import { NEO_COLORS } from '../constants/neoBrutalism';

export default function AssistantScreen() {
  const { messages, isLoading, sendMessage } = useChat();
  const [input, setInput] = useState('');
  const listRef = useRef<FlatList>(null);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(text);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.keyboardView} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {isLoading && (
          <View style={styles.loadingBar}>
            <ActivityIndicator size="small" color={NEO_COLORS.BLUE} />
            <Text style={styles.loadingText}>Thinking…</Text>
          </View>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          contentContainerStyle={styles.listContent}
          keyExtractor={(item) => String(item._id)}
          inverted
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.user._id === 1 ? styles.rightBubble : styles.leftBubble]}>
              <Text style={[styles.bubbleText, item.user._id === 1 ? styles.rightText : styles.leftText]}>{item.text}</Text>
            </View>
          )}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Ask me about incidents..."
            placeholderTextColor={NEO_COLORS.GRAY}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
            <Text style={styles.sendText}>SEND</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: NEO_COLORS.CREAM },
  keyboardView: { flex: 1 },
  loadingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8, backgroundColor: NEO_COLORS.WHITE, borderBottomWidth: 3, borderColor: NEO_COLORS.BLACK },
  loadingText: { color: NEO_COLORS.BLACK, fontWeight: 'bold' },
  listContent: { padding: 12 },
  bubble: { maxWidth: '80%', marginVertical: 6, padding: 12, borderWidth: 3, borderColor: NEO_COLORS.BLACK },
  rightBubble: { alignSelf: 'flex-end', backgroundColor: NEO_COLORS.BLUE },
  leftBubble: { alignSelf: 'flex-start', backgroundColor: NEO_COLORS.WHITE },
  bubbleText: { fontWeight: '600' },
  rightText: { color: NEO_COLORS.WHITE },
  leftText: { color: NEO_COLORS.BLACK },
  inputRow: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8, borderTopWidth: 3, borderColor: NEO_COLORS.BLACK, backgroundColor: NEO_COLORS.WHITE },
  input: { flex: 1, height: 44, paddingHorizontal: 12, borderWidth: 3, borderColor: NEO_COLORS.BLACK, backgroundColor: NEO_COLORS.CREAM },
  sendBtn: { paddingVertical: 10, paddingHorizontal: 16, backgroundColor: NEO_COLORS.BLUE, borderWidth: 3, borderColor: NEO_COLORS.BLACK },
  sendText: { color: NEO_COLORS.WHITE, fontWeight: 'bold' },
});
