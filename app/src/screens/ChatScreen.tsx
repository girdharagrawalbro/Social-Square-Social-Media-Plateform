import { brand } from '../theme/colors';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getSocket } from '../lib/socket';
import { queryKeys } from '../lib/queryKeys';
import AppHeader from './components/AppHeader';
import useAuthStore from '../store/zustand/useAuthStore';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { decryptText } from '../lib/cryptoUtils';
import { api, BASE_URL } from '../lib/api';
import { useAppNavigation } from '../navigation/types';
import { pruneOldMessages, cleanupOrphanedConversations } from '../lib/db';
import { ChatSkeleton } from './components/SkeletonLoader';
import { useTheme } from '../theme';

interface Participant {
  _id: string;
  fullname: string;
  username: string;
  profile_picture?: string;
  profilePicture?: string;
  userId?: {
    _id: string;
    fullname?: string;
    username?: string;
    profile_picture?: string;
    profilePicture?: string;
  } | string;
}

interface Conversation {
  _id: string;
  isGroup: boolean;
  groupName?: string;
  participants: Participant[];
  lastMessage?: {
    content?: string;
    message?: string;
    createdAt?: string;
  };
  lastMessageAt?: string;
  lastMessageBy?: string;
  unreadCount?: number;
}

interface SearchUser {
  _id: string;
  fullname: string;
  username: string;
  profile_picture?: string;
}

const decryptionCache = new Map<string, string>();

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

    // Check RAM cache first to avoid expensive re-decryption on every render
    if (decryptionCache.has(unescaped)) {
      setDecryptedText(decryptionCache.get(unescaped)!);
      return;
    }

    let active = true;
    const decrypt = async () => {
      try {
        const e2eeState = useE2eeStore.getState();
        const aesKey = await e2eeState.getConversationKey(conversationId);
        if (aesKey && active) {
          const encryptedObj = JSON.parse(unescaped);
          const text = await decryptText(encryptedObj.ciphertext, encryptedObj.iv, aesKey);
          if (active) {
            decryptionCache.set(unescaped, text);
            setDecryptedText(text);
          }
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
        { color: unread ? (isDark ? brand.primaryInverse : '#000000') : subColor },
        unread && styles.unreadMessage,
      ]}
      numberOfLines={1}
    >
      {decryptedText}
    </Text>
  );
};

export default function ChatScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useAppNavigation();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleNewMessage = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations() });
    };

    socket.on('receiveMessage', handleNewMessage);
    socket.on('newMessage', handleNewMessage);

    return () => {
      socket.off('receiveMessage', handleNewMessage);
      socket.off('newMessage', handleNewMessage);
    };
  }, [queryClient]);

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
      // Prune old messages asynchronously on chat list focus
      // to keep SQLite database from growing unbounded over months of usage
      setTimeout(() => {
        pruneOldMessages(2000); // keep only 2000 per chat
      }, 2000);
    }, [])
  );

  const { data: conversations = [], isLoading: loading, isRefetching: refreshing, refetch } = useQuery({
    queryKey: queryKeys.conversations(),
    queryFn: async () => {
      const res = await api.get('/api/conversation');
      const fetchedConversations = res.data?.conversations || res.data || [];
      
      // Cleanup orphaned SQLite messages asynchronously
      if (fetchedConversations.length > 0) {
        setTimeout(() => {
          const activeIds = fetchedConversations.map((c: any) => c._id);
          cleanupOrphanedConversations(activeIds);
        }, 1000);
      }
      
      return fetchedConversations;
    },
  });

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

  const bg = colors.background;
  const cardBg = colors.surface;
  const textColor = colors.text.primary;
  const subColor = colors.text.secondary;
  const borderColor = colors.border;

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleRefresh = async () => {
    await refetch();
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

  const [createGroupModalVisible, setCreateGroupModalVisible] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState<SearchUser[]>([]);

  const handleCreateGroup = async () => {
    if (!groupName.trim() || groupMembers.length === 0) {
      Alert.alert('Error', 'Please enter a group name and add at least one member.');
      return;
    }
    try {
      const res = await api.post('/api/conversation/group/create', {
        name: groupName,
        participantIds: groupMembers.map(m => m._id)
      });
      if (res.data?._id) {
        setCreateGroupModalVisible(false);
        setGroupName('');
        setGroupMembers([]);
        setSearchQuery('');
        setSearchResults([]);
        navigation.navigate('ChatPane', {
          conversationId: res.data._id,
          title: groupName,
          isGroup: true
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.message || 'Failed to create group');
    }
  };

  const renderConversationItem = ({ item }: { item: Conversation }) => {
    let displayTitle = item.groupName || 'Chat';
    let displayAvatar = '';
    let recipientId = '';
    if (!item.isGroup) {
      const other: any = item.participants.find((p: any) => {
        const id = p.userId?._id || p.userId || p._id;
        return id && String(id) !== String(currentUser?._id);
      });
      if (other) {
        displayTitle = other.userId?.fullname || other.fullname || 'User';
        const avatar = other.userId?.profile_picture || other.userId?.profilePicture || other.profilePicture || other.profile_picture || '';
        displayAvatar = avatar ? (resolveMediaUrl(avatar) || '') : '';
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
            <Text style={[styles.name, { color: textColor }, unread && { fontWeight: 'bold' }]}>{displayTitle}</Text>
            {(() => {
              const dateStr = item.lastMessageAt || (item.lastMessage && item.lastMessage.createdAt);
              if (!dateStr) return null;
              const d = new Date(dateStr);
              if (isNaN(d.getTime())) return null;
              return (
                <Text style={[styles.time, { color: unread ? textColor : subColor }, unread && { fontWeight: 'bold' }]}>
                  {d.toLocaleDateString([], { month: 'short', day: 'numeric' })}
                </Text>
              );
            })()}
          </View>
          <View style={styles.messageRow}>
            {item.lastMessageBy && String(item.lastMessageBy) === String(currentUser?._id) && (
              <Text style={{ color: brand.primary, fontWeight: 'bold', marginRight: 4 }}>You:</Text>
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
      return isDark ? brand.primaryInverse : '#000000';
    }
    return subColor;
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Customized Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <TouchableOpacity
          onPress={() => navigation.navigate('NewPost')}
          style={styles.headerLeftBtn}
          accessibilityRole="button"
          accessibilityLabel="Create new post"
        >
          <MaterialCommunityIcons name="plus" size={26} color={textColor} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textColor }]}>
          {currentUser?.username ? `@${currentUser.username}` : 'Conversations'}
        </Text>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity
            onPress={() => { setCreateGroupModalVisible(true); setSearchQuery(''); setSearchResults([]); }}
            style={[styles.headerRightBtn, { marginRight: 8 }]}
            accessibilityRole="button"
            accessibilityLabel="New group chat"
          >
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={24} color={textColor} />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate('Notifications')}
            style={styles.headerRightBtn}
            accessibilityRole="button"
            accessibilityLabel={unreadNotificationsCount > 0 ? `Notifications, ${unreadNotificationsCount} unread` : 'Notifications'}
          >
            <View style={styles.badgeWrapper}>
              {unreadNotificationsCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="bell-outline" size={24} color={brand.primary} />
            </View>
          </TouchableOpacity>
        </View>
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
              <ActivityIndicator color={brand.primary} style={{ padding: 40 }} />
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

      {/* Create Group Modal */}
      <Modal
        visible={createGroupModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateGroupModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>New Group</Text>
              <TouchableOpacity onPress={() => setCreateGroupModalVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <View style={{ padding: 16 }}>
              <TextInput
                style={[styles.searchInput, { color: textColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', marginBottom: 16 }]}
                placeholder="Group Name"
                placeholderTextColor={subColor}
                value={groupName}
                onChangeText={setGroupName}
              />
              
              <Text style={{ color: subColor, marginBottom: 8, fontSize: 12 }}>MEMBERS ({groupMembers.length})</Text>
              {groupMembers.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 8 }}>
                  {groupMembers.map(m => (
                    <TouchableOpacity key={m._id} style={{ backgroundColor: '#e0e7ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, flexDirection: 'row', alignItems: 'center' }}
                      onPress={() => setGroupMembers(prev => prev.filter(x => x._id !== m._id))}>
                      <Text style={{ color: brand.primaryDark, fontSize: 12, marginRight: 4 }}>{m.fullname}</Text>
                      <MaterialCommunityIcons name="close" size={14} color={brand.primaryDark} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <View style={[styles.searchBarContainer, { marginBottom: 16 }]}>
                <MaterialCommunityIcons name="magnify" size={20} color={subColor} style={{ marginLeft: 8 }} />
                <TextInput
                  style={[styles.searchInput, { color: textColor }]}
                  placeholder="Add people..."
                  placeholderTextColor={subColor}
                  value={searchQuery}
                  onChangeText={handleSearchUsers}
                />
              </View>

              <TouchableOpacity onPress={handleCreateGroup} style={{ backgroundColor: brand.primary, padding: 12, borderRadius: 8, alignItems: 'center', opacity: (!groupName.trim() || groupMembers.length === 0) ? 0.5 : 1 }} disabled={!groupName.trim() || groupMembers.length === 0}>
                <Text style={{ color: '#fff', fontWeight: '600' }}>Create Group</Text>
              </TouchableOpacity>
            </View>

            {searching ? (
              <ActivityIndicator color={brand.primary} style={{ padding: 20 }} />
            ) : (
              <FlatList
                data={searchResults}
                keyExtractor={(item) => item._id}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20 }}
                renderItem={({ item }) => {
                  const isSelected = groupMembers.some(m => m._id === item._id);
                  return (
                    <TouchableOpacity
                      style={styles.userListItem}
                      onPress={() => {
                        if (isSelected) setGroupMembers(prev => prev.filter(m => m._id !== item._id));
                        else setGroupMembers(prev => [...prev, item]);
                      }}
                    >
                      {item.profile_picture ? (
                        <Image source={{ uri: item.profile_picture }} style={styles.searchAvatar} />
                      ) : (
                        <View style={styles.searchAvatarFallback}>
                          <Text style={styles.searchAvatarInitial}>{item.fullname[0].toUpperCase()}</Text>
                        </View>
                      )}
                      <View style={{ marginLeft: 12, flex: 1 }}>
                        <Text style={[styles.searchFullname, { color: textColor }]}>{item.fullname}</Text>
                        <Text style={[styles.searchUsername, { color: subColor }]}>@{item.username}</Text>
                      </View>
                      {isSelected && (
                        <MaterialCommunityIcons name="check-circle" size={24} color={brand.primary} />
                      )}
                    </TouchableOpacity>
                  );
                }}
              />
            )}
          </View>
        </View>
      </Modal>

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
    backgroundColor: brand.primary,
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
    fontWeight: 'bold',
  },
  unreadBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: brand.primary,
  },
  fab: {
    position: 'absolute',
    bottom: 90,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: brand.primary,
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
    backgroundColor: brand.primary,
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
