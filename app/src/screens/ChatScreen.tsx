import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useColorScheme,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AppHeader from './components/AppHeader';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { decryptText } from '../lib/cryptoUtils';
import { api } from '../lib/api';
import { getCache, setCache, TTL } from '../lib/cache';
import { ChatSkeleton } from './components/SkeletonLoader';

interface Participant {
  _id: string;
  fullname: string;
  username: string;
  profile_picture?: string;
}

interface Conversation {
  _id: string;
  isGroup: boolean;
  groupName?: string;
  participants: Participant[];
  lastMessage?: {
    content: string;
    createdAt: string;
  };
  unreadCount?: number;
}

interface SearchUser {
  _id: string;
  fullname: string;
  username: string;
  profile_picture?: string;
}

const MessagePreview = ({ messageText, conversationId, recipientId, isDark, subColor, unread, styles }: any) => {
  const [decryptedText, setDecryptedText] = useState('Encrypted');

  const unescapeHtml = (str: string | null | undefined): string | null | undefined => {
    if (!str) return str;
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  };

  useEffect(() => {
    if (!messageText) { setDecryptedText('No messages yet'); return; }
    const unescaped = unescapeHtml(messageText);
    if (!unescaped || !unescaped.startsWith('{"ciphertext":')) {
      setDecryptedText(messageText);
      return;
    }

    let active = true;
    const decrypt = async () => {
      try {
        const e2eeState = useE2eeStore.getState();
        const aesKey = await e2eeState.getConversationKey(conversationId, recipientId);
        if (aesKey && active) {
          const encryptedObj = JSON.parse(unescaped);
          const text = await decryptText(encryptedObj.ciphertext, encryptedObj.iv, aesKey);
          if (active) setDecryptedText(text);
        }
      } catch (err) {
        if (active) setDecryptedText('Encrypted');
      }
    };
    decrypt();
    return () => { active = false; };
  }, [messageText, conversationId, recipientId]);

  return (
    <Text
      style={[
        styles.lastMessage,
        { color: unread ? (isDark ? '#ffffff' : '#000000') : subColor },
        unread && styles.unreadMessage,
      ]}
      numberOfLines={1}
    >
      {decryptedText}
    </Text>
  );
};

export default function ChatScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const currentUser = useAuthStore((s: any) => s.user);

  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/api/conversation/notifications/unread-count');
      const count = res.data.count || 0;
      setUnreadNotificationsCount(count);
    } catch (e) {
      console.warn('Failed to fetch unread notifications count:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Chat states
  const [searchModalVisible, setSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  // Main Conversation Search state
  const [mainSearchQuery, setMainSearchQuery] = useState('');

  const resolveMediaUrl = (url?: string) => {
    if (!url) return undefined;
    if (url.startsWith('http://localhost:5000')) {
      return url.replace('http://localhost:5000', BASE_URL);
    }
    if (url.startsWith('https://localhost:5000')) {
      return url.replace('https://localhost:5000', BASE_URL);
    }
    if (url.startsWith('/')) {
      return `${BASE_URL}${url}`;
    }
    return url;
  };

  const bg = isDark ? '#000000' : '#f1f5f9';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1a1a1a' : '#e2e8f0';

  const fetchConversations = useCallback(async (showLoader = false) => {
    // Load from cache immediately for instant display (like WhatsApp)
    const cached = await getCache<Conversation[]>('conversations_list');
    if (cached && cached.length > 0) {
      setConversations(cached);
      if (showLoader) setLoading(false); // don't show spinner if we have cache
    } else if (showLoader) {
      setLoading(true);
    }
    try {
      const res = await api.get('/api/conversation');
      const fresh = res.data?.conversations || res.data || [];
      setConversations(fresh);
      // Cache the list for next time (profile pics, names, last message)
      await setCache('conversations_list', fresh, TTL.CONVERSATIONS);
    } catch (e) {
      console.warn('Failed to load conversations:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchConversations(conversations.length === 0);
    }, [fetchConversations])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchConversations(false);
    setRefreshing(false);
  };

  const handleSearchUsers = async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await api.get(`/api/auth/search?query=${query}`);
      // Backend users search returns list
      setSearchResults(res.data || []);
    } catch (e) {
      console.warn('Failed to search users:', e);
    } finally {
      setSearching(false);
    }
  };

  const handleCreateChat = async (recipientId: string, recipientName: string) => {
    setSearchModalVisible(false);
    setSearchQuery('');
    setSearchResults([]);
    try {
      const res = await api.post('/api/conversation/create', { recipientId });
      if (res.data?._id) {
        navigation.navigate('ChatPane', {
          conversationId: res.data._id,
          title: recipientName,
          recipientId: recipientId,
          recipientAvatar: '', // since we compose to a new user, we don't have avatar yet, it will fallback
        });
      }
    } catch (e: any) {
      const errorMsg = e.response?.data?.message || 'Failed to start conversation.';
      Alert.alert('Error', errorMsg);
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    let displayTitle = item.groupName || 'Chat';
    let displayAvatar = '';
    let recipientId = '';
    if (!item.isGroup) {
      const other = item.participants.find((p: any) => {
        const id = p.userId?._id || p.userId || p._id;
        return id && String(id) !== String(currentUser?._id);
      });
      if (other) {
        displayTitle = other.userId?.fullname || other.fullname || 'User';
        const avatar = other.userId?.profile_picture || other.userId?.profilePicture || other.profilePicture || other.profile_picture || '';
        displayAvatar = avatar ? resolveMediaUrl(avatar) : '';
        const extractedId = other.userId?._id || other.userId || other._id;
        recipientId = typeof extractedId === 'object' ? extractedId._id || String(extractedId) : String(extractedId);
      }
    }

    const unread = (item.unreadCount || 0) > 0;

    return (
      <TouchableOpacity
        style={[styles.chatItem, { borderBottomColor: borderColor }]}
        onPress={() =>
          navigation.navigate('ChatPane', {
            conversationId: item._id,
            title: displayTitle,
            recipientId: recipientId,
            recipientAvatar: displayAvatar,
          })
        }
      >
        {displayAvatar ? (
          <Image source={{ uri: displayAvatar }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitial}>{displayTitle[0].toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.chatInfo}>
          <View style={styles.chatHeader}>
            <Text style={[styles.name, { color: textColor }]}>{displayTitle}</Text>
            {(() => {
              const dateStr = item.lastMessageAt || (item.lastMessage && item.lastMessage.createdAt);
              if (!dateStr) return null;
              const d = new Date(dateStr);
              if (isNaN(d.getTime())) return null;
              return (
                <Text style={[styles.time, { color: subColor }]}>
                  {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              );
            })()}
          </View>
          <View style={styles.messageRow}>
            {item.lastMessageBy && String(item.lastMessageBy) === String(currentUser?._id) && (
              <Text style={{ color: '#808bf5', fontWeight: 'bold', marginRight: 4 }}>You:</Text>
            )}
            <MessagePreview
              messageText={item.lastMessage?.message || item.lastMessage?.content}
              conversationId={item._id}
              recipientId={recipientId}
              isDark={isDark}
              subColor={subColor}
              unread={unread}
              styles={styles}
            />
            {unread && <View style={styles.unreadBadge} />}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const filteredConversations = conversations.filter(item => {
    if (!mainSearchQuery.trim()) return true;
    const q = mainSearchQuery.toLowerCase();
    if (item.groupName && item.groupName.toLowerCase().includes(q)) return true;

    return item.participants.some(p =>
      p.fullname?.toLowerCase().includes(q) ||
      p.username?.toLowerCase().includes(q)
    );
  });

  const unColor = (unread: boolean) => {
    if (unread) {
      return isDark ? '#ffffff' : '#000000';
    }
    return subColor;
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Customized Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity
          onPress={() => setSearchModalVisible(true)}
          style={styles.headerLeftBtn}
        >
          <MaterialCommunityIcons name="plus" size={26} color={textColor} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textColor }]}>
          {currentUser?.username ? `@${currentUser.username}` : 'Conversations'}
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={styles.headerRightBtn}
        >
          <View style={styles.badgeWrapper}>
            {unreadNotificationsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
              </View>
            )}
            <MaterialCommunityIcons name="bell-outline" size={24} color="#808bf5" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Main Conversation Search Bar */}
      <View style={[styles.mainSearchBarContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderWidth: 0 }]}>
        <MaterialCommunityIcons name="magnify" size={20} color={subColor} style={{ marginLeft: 8 }} />
        <TextInput
          style={[styles.mainSearchInput, { color: textColor }]}
          placeholder="Search people..."
          placeholderTextColor={subColor}
          value={mainSearchQuery}
          onChangeText={setMainSearchQuery}
        />
        {mainSearchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setMainSearchQuery('')} style={{ padding: 4, marginRight: 4 }}>
            <MaterialCommunityIcons name="close-circle" size={18} color={subColor} />
          </TouchableOpacity>
        )}
      </View>

      {loading ? (
        <View style={{ flex: 1 }}>
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
          <ChatSkeleton />
        </View>
      ) : (
        <FlatList
          data={filteredConversations}
          keyExtractor={(item) => item._id}
          renderItem={renderConversationItem}
          contentContainerStyle={styles.scrollContent}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="chat-outline" size={48} color={subColor} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No messages yet</Text>
              <Text style={[styles.emptySubtitle, { color: subColor }]}>
                Start a new conversation with friends!
              </Text>
            </View>
          )}
        />
      )}

      {/* Floating Action Button for New Chat */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setSearchModalVisible(true)}
      >
        <MaterialCommunityIcons name="chat-plus" size={24} color="#ffffff" />
      </TouchableOpacity>

      {/* Search and New Chat Modal */}
      <Modal
        visible={searchModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSearchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>New Message</Text>
              <TouchableOpacity onPress={() => setSearchModalVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={subColor} style={{ marginLeft: 8 }} />
              <TextInput
                style={[styles.searchInput, { color: textColor }]}
                placeholder="Search people..."
                placeholderTextColor={subColor}
                value={searchQuery}
                onChangeText={handleSearchUsers}
                autoFocus
              />
            </View>

            {searching ? (
              <ActivityIndicator color="#808bf5" style={{ padding: 40 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ padding: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.userListItem}
                    onPress={() => handleCreateChat(item._id, item.fullname)}
                  >
                    {item.profile_picture ? (
                      <Image source={{ uri: item.profile_picture }} style={styles.searchAvatar} />
                    ) : (
                      <View style={styles.searchAvatarFallback}>
                        <Text style={styles.searchAvatarInitial}>{item.fullname[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={{ marginLeft: 12 }}>
                      <Text style={[styles.searchFullname, { color: textColor }]}>{item.fullname}</Text>
                      <Text style={[styles.searchUsername, { color: subColor }]}>@{item.username}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                  <View style={{ padding: 40, alignItems: 'center' }}>
                    <Text style={{ color: subColor }}>
                      {searchQuery.trim() ? 'No users found.' : 'Search for friends to start chatting.'}
                    </Text>
                  </View>
                )}
              />
            )}
          </View>
        </View>
      </Modal>

      <BottomNav currentTab="messages" navigation={navigation} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingTop: 8,
    paddingBottom: 80,
  },
  chatItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#808bf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
  },
  time: {
    fontSize: 12,
  },
  messageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  unreadMessage: {
    fontWeight: '700',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#808bf5',
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#808bf5',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 60,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  // Modal layout
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  searchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 8,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
  },
  userListItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  searchAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  searchAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#808bf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchAvatarInitial: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  searchFullname: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchUsername: {
    fontSize: 12,
  },
  mainSearchBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 10,
    paddingHorizontal: 8,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
  },
  mainSearchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    paddingVertical: 0,
  },
  header: {
    height: 60,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerRightBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerLeftBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeWrapper: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ef4444',
    borderRadius: 7,
    width: 14,
    height: 14,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});
