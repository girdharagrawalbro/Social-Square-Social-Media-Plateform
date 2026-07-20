import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import useAuthStore from '../store/zustand/useAuthStore';
import { api, BASE_URL } from '../lib/api';
import { useNavigation } from '@react-navigation/native';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  loading?: boolean;
}

const QUICK_ACTIONS = [
  { label: '✍️ Caption ideas', message: 'Give me caption ideas for my next post' },
  { label: '📸 Stories help', message: 'How do I use stories and pause the timer?' },
  { label: '🤝 Collab posts', message: 'How do collaborative posts work?' },
  { label: '🎭 Confessions', message: 'How do anonymous confessions work?' },
  { label: '🎙️ Messaging & Voice', message: 'Tell me about messaging and voice notes' },
  { label: '🚩 Report an issue', message: 'I want to report a problem with the app' },
];

export default function ChatbotScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);
  const token = useAuthStore((s: any) => s.token);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [userMemory, setUserMemory] = useState<any>(null);
  
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Hey ${user?.fullname?.split(' ')[0] || 'there'}! 👋 I'm SocialBot, your AI assistant for Social Square.\n\nI can help you with posting tips, caption ideas, mood-based content, or any app questions. What can I help you with?`,
    },
  ]);

  const flatListRef = useRef<FlatList>(null);
  const activeRequest = useRef<XMLHttpRequest | null>(null);

  // Fetch memory
  useEffect(() => {
    api.get('/api/recommendation/memory')
      .then((res) => setUserMemory(res.data))
      .catch(() => {});
  }, []);

  // Auto-scroll on messages change
  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = useCallback(async (textToSend: string) => {
    const content = textToSend.trim();
    if (!content || loading) return;

    setInput('');
    setLoading(true);

    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `bot-${Date.now()}`;
    
    const userMsg: ChatMessage = { id: userMsgId, role: 'user', content };
    const loadingMsg: ChatMessage = { id: assistantMsgId, role: 'assistant', content: '', loading: true };

    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      const history = [...messages, userMsg].map(({ role, content }) => ({ role, content }));
      
      const xhr = new XMLHttpRequest();
      activeRequest.current = xhr;
      
      xhr.open('POST', `${BASE_URL}/api/chatbot/chat`);
      xhr.setRequestHeader('Content-Type', 'application/json');
      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }

      let seenBytes = 0;
      let accumulatedText = '';

      xhr.onreadystatechange = () => {
        if (xhr.readyState === 3 || xhr.readyState === 4) {
          const rawText = xhr.responseText;
          const chunk = rawText.substring(seenBytes);
          seenBytes = rawText.length;

          // Parse event-stream lines
          const lines = chunk.split('\n');
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6).trim();
              if (dataStr === '[DONE]') {
                break;
              }
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.content) {
                  accumulatedText += parsed.content;
                  setMessages((prev) => {
                    const filtered = prev.filter((m) => m.id !== assistantMsgId);
                    return [
                      ...filtered,
                      { id: assistantMsgId, role: 'assistant', content: accumulatedText },
                    ];
                  });
                }
              } catch (e) {
                // Ignore incomplete JSON chunks
              }
            }
          }
        }

        if (xhr.readyState === 4) {
          setLoading(false);
          activeRequest.current = null;
        }
      };

      xhr.onerror = () => {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== assistantMsgId);
          return [
            ...filtered,
            { id: assistantMsgId, role: 'assistant', content: '⚠️ Connection error. Please try again.' },
          ];
        });
        setLoading(false);
        activeRequest.current = null;
      };

      xhr.send(
        JSON.stringify({
          messages: history,
          userId: user?._id,
          user_memory: userMemory,
        })
      );

    } catch (err) {
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== assistantMsgId);
        return [
          ...filtered,
          { id: assistantMsgId, role: 'assistant', content: '⚠️ Internal error. Please try again.' },
        ];
      });
      setLoading(false);
      activeRequest.current = null;
    }
  }, [messages, token, user, userMemory, loading]);

  useEffect(() => {
    return () => {
      if (activeRequest.current) {
        activeRequest.current.abort();
      }
    };
  }, []);

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#121212' : '#f9fafb';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const inputBg = isDark ? '#1a1a24' : '#f3f4f6';

  const renderMessageItem = ({ item }: { item: ChatMessage }) => {
    const isBot = item.role === 'assistant';
    
    return (
      <View style={[styles.msgRow, isBot ? styles.msgRowLeft : styles.msgRowRight]}>
        {isBot && (
          <View style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>🤖</Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isBot ? [styles.bubbleBot, { backgroundColor: cardBg }] : styles.bubbleUser,
          ]}
        >
          {item.loading ? (
            <View style={styles.loaderRow}>
              <ActivityIndicator size="small" color="#808bf5" />
            </View>
          ) : (
            <Text style={[styles.msgText, { color: isBot ? textColor : '#ffffff' }]}>
              {item.content}
            </Text>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: border, backgroundColor: bg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: textColor }]}>SocialBot</Text>
          <View style={styles.onlineBadge}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>AI Assistant</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            messages.length === 1 ? (
              <View style={styles.quickActionsContainer}>
                <Text style={[styles.quickActionsTitle, { color: subText }]}>
                  Suggested Topics
                </Text>
                <View style={styles.quickActionsGrid}>
                  {QUICK_ACTIONS.map((action, idx) => (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.quickActionBtn, { backgroundColor: cardBg, borderColor: border }]}
                      onPress={() => sendMessage(action.message)}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.quickActionLabel, { color: textColor }]}>
                        {action.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            ) : null
          }
        />

        {/* Input Bar */}
        <View style={[styles.inputBar, { borderTopColor: border, backgroundColor: bg }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: inputBg, color: textColor }]}
            placeholder="Ask SocialBot anything..."
            placeholderTextColor={subText}
            value={input}
            onChangeText={setInput}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || loading) && { opacity: 0.5 }]}
            onPress={() => sendMessage(input)}
            disabled={!input.trim() || loading}
          >
            <LinearGradient
              colors={['#808bf5', '#6366f1']}
              style={styles.sendBtnGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <MaterialCommunityIcons name="send" size={20} color="#ffffff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#808bf5',
    marginRight: 4,
  },
  onlineText: {
    fontSize: 10,
    color: '#808bf5',
    fontWeight: 'bold',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '85%',
  },
  msgRowLeft: {
    alignSelf: 'flex-start',
  },
  msgRowRight: {
    alignSelf: 'flex-end',
  },
  botAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(128, 139, 245, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    alignSelf: 'flex-end',
  },
  botAvatarText: {
    fontSize: 15,
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleBot: {
    borderBottomLeftRadius: 4,
  },
  bubbleUser: {
    backgroundColor: '#6366f1',
    borderBottomRightRadius: 4,
  },
  msgText: {
    fontSize: 13,
    lineHeight: 18,
  },
  loaderRow: {
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  quickActionsContainer: {
    marginTop: 24,
    paddingHorizontal: 8,
  },
  quickActionsTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickActionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginBottom: 4,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  textInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    fontSize: 14,
    maxHeight: 100,
    marginRight: 10,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendBtnGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
