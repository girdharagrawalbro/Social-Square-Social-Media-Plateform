import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Clipboard,
  useColorScheme,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../../lib/api';

interface ShareModalProps {
  visible: boolean;
  onClose: () => void;
  story?: any;
  post?: any;
  myUser: any;
}

export default function ShareModal({ visible, onClose, story, post, myUser }: ShareModalProps) {
  const isDark = useColorScheme() === 'dark';
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sharingIds, setSharingIds] = useState<string[]>([]);

  // Theme styles
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc';

  useEffect(() => {
    if (visible) {
      fetchUsers();
    }
  }, [visible]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/auth/other-users');
      setUsers(res.data || []);
    } catch (e) {
      console.warn('[ShareModal] Failed to fetch users:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    let url = '';
    if (story) {
      url = `https://social-square.me/stories/${story.user?.username || story.user?._id}/${story._id}`;
    } else if (post) {
      url = `https://social-square.me/posts/${post._id}`;
    }
    if (url) {
      Clipboard.setString(url);
      Alert.alert('Copied', 'Link copied to clipboard!');
    }
  };

  const handleShare = async (targetUser: any) => {
    const targetId = targetUser._id;
    setSharingIds((prev) => [...prev, targetId]);

    try {
      // 1. Get or create conversation
      const convRes = await api.post('/api/conversation/messages', { recipientId: targetId });
      const conversationId = convRes.data.conversation?._id;

      if (!conversationId) {
        throw new Error('Conversation ID not found.');
      }

      // 2. Prepare payload
      const payload: any = {
        conversationId,
        recipientId: targetId,
        content: 'sent an attachment',
      };

      if (story) {
        payload.storyReply = {
          storyId: story._id,
          mediaUrl: story.media?.url || story.mediaUrl,
          mediaType: story.media?.type || story.mediaType || 'image',
          authorName: story.user?.fullname || 'Someone',
          authorUsername: story.user?.username || 'user',
          authorProfilePicture: story.user?.profile_picture,
          isShare: true,
        };
      } else if (post) {
        payload.sharedPost = {
          postId: post._id,
          mediaUrl: post.media?.url || post.mediaUrl,
          mediaType: post.media?.type || post.mediaType,
          caption: post.caption,
          authorName: post.user?.fullname || 'Someone',
          authorUsername: post.user?.username || 'user',
          authorProfilePicture: post.user?.profile_picture,
        };
      }

      // 3. Send message
      await api.post('/api/conversation/send', payload);
      Alert.alert('Shared', `Successfully shared with ${targetUser.fullname}!`);
    } catch (e: any) {
      console.warn('[ShareModal] Share failed:', e);
      Alert.alert('Error', e.response?.data?.message || 'Failed to share attachment.');
    } finally {
      setSharingIds((prev) => prev.filter((id) => id !== targetId));
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.fullname?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.content, { backgroundColor: cardBg }]}>
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: borderColor }]}>
            <Text style={[styles.title, { color: textColor }]}>Share Story</Text>
            <TouchableOpacity onPress={onClose}>
              <MaterialCommunityIcons name="close" size={24} color={textColor} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchRow}>
            <MaterialCommunityIcons name="magnify" size={20} color={subColor} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { backgroundColor: inputBg, color: textColor }]}
              placeholder="Search people..."
              placeholderTextColor={subColor}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          {/* Copy Link Button */}
          <TouchableOpacity style={[styles.copyBtn, { borderColor }]} onPress={handleCopyLink}>
            <MaterialCommunityIcons name="link-variant" size={18} color={textColor} />
            <Text style={[styles.copyBtnText, { color: textColor }]}>Copy Link</Text>
          </TouchableOpacity>

          {/* User List */}
          {loading ? (
            <ActivityIndicator size="large" color="#808bf5" style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={filteredUsers}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContainer}
              renderItem={({ item }) => {
                const isSharing = sharingIds.includes(item._id);
                return (
                  <View style={styles.userRow}>
                    {item.profile_picture ? (
                      <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
                        <Text style={styles.avatarInitial}>{item.fullname[0]}</Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={[styles.fullname, { color: textColor }]}>{item.fullname}</Text>
                      <Text style={{ color: subColor, fontSize: 12 }}>@{item.username}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.sendBtn, isSharing && { opacity: 0.7 }]}
                      onPress={() => handleShare(item)}
                      disabled={isSharing}
                    >
                      {isSharing ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text style={styles.sendText}>Send</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '75%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginTop: 14,
  },
  searchIcon: {
    position: 'absolute',
    left: 32,
    zIndex: 1,
  },
  searchInput: {
    flex: 1,
    height: 44,
    borderRadius: 12,
    paddingLeft: 44,
    paddingRight: 16,
    fontSize: 14,
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 12,
    height: 44,
    marginHorizontal: 20,
    marginTop: 14,
    gap: 8,
  },
  copyBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarInitial: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
  },
  fullname: {
    fontSize: 14,
    fontWeight: '600',
  },
  sendBtn: {
    backgroundColor: '#808bf5',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 18,
  },
  sendText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
