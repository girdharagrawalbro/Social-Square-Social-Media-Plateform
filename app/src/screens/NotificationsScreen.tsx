import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import { NotificationSkeleton } from './components/SkeletonLoader';

interface Notification {
  _id: string;
  sender?: {
    _id: string;
    fullname?: string;
    username?: string;
    profile_picture?: string;
  };
  type: string;
  message?: {
    content?: string;
  };
  url?: string;
  read: boolean;
  createdAt: string;
  status?: string; // custom local flag for requests action
}

interface CollabInvite {
  _id: string; // post ID
  user?: {
    _id: string;
    fullname?: string;
    username?: string;
    profile_picture?: string;
  };
  caption?: string;
  createdAt: string;
}

export default function NotificationsScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);

  const [activeTab, setActiveTab] = useState<'notifications' | 'requests' | 'collabs'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [collabInvites, setCollabInvites] = useState<CollabInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Collab Accept Modal states
  const [acceptingCollabId, setAcceptingCollabId] = useState<string | null>(null);
  const [contributionText, setContributionText] = useState('');

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#808bf5';

  const fetchData = async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      // 1. Fetch Notifications
      const notifRes = await api.get('/api/conversation/notifications');
      const fetchedNotifications = notifRes.data.notifications || notifRes.data || [];
      setNotifications(fetchedNotifications);

      // 2. Fetch Collabs
      const collabRes = await api.get(`/api/post/collaborate/invites/${user._id}`);
      setCollabInvites(Array.isArray(collabRes.data) ? collabRes.data : []);
    } catch (err) {
      console.warn('[Notifications] Failed to load data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user?._id]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleMarkAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n._id);
    if (unreadIds.length === 0) return;

    try {
      await api.patch('/api/conversation/notifications/mark-read', { Ids: unreadIds });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch (err) {
      Alert.alert('Error', 'Failed to mark notifications as read.');
    }
  };

  const handleMarkSingleRead = async (id: string) => {
    try {
      await api.patch('/api/conversation/notifications/mark-read', { Ids: [id] });
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
    } catch (err) {
      // Ignore silently
    }
  };

  const handleAcceptFollow = async (requesterId: string, notificationId: string) => {
    try {
      await api.post('/api/auth/follow-request/accept', { userId: user?._id, requesterId });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true, status: 'accepted' } : n))
      );
      Alert.alert('Success', 'Follow request accepted.');
    } catch (err) {
      Alert.alert('Error', 'Failed to accept follow request.');
    }
  };

  const handleDeclineFollow = async (requesterId: string, notificationId: string) => {
    try {
      await api.post('/api/auth/follow-request/decline', { userId: user?._id, requesterId });
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, read: true, status: 'declined' } : n))
      );
      Alert.alert('Declined', 'Follow request declined.');
    } catch (err) {
      Alert.alert('Error', 'Failed to decline follow request.');
    }
  };

  const handleAcceptCollab = async (postId: string) => {
    if (!contributionText.trim()) {
      Alert.alert('Required', 'Please enter your contribution description.');
      return;
    }
    try {
      await api.post('/api/post/collaborate/accept', { postId, contribution: contributionText });
      setCollabInvites((prev) => prev.filter((p) => p._id !== postId));
      setAcceptingCollabId(null);
      setContributionText('');
      Alert.alert('Accepted', 'You have joined the collaboration!');
      fetchData();
    } catch (err) {
      Alert.alert('Error', 'Failed to accept collaboration invite.');
    }
  };

  const handleDeclineCollab = async (postId: string) => {
    try {
      await api.post('/api/post/collaborate/decline', { postId });
      setCollabInvites((prev) => prev.filter((p) => p._id !== postId));
      Alert.alert('Declined', 'Collaboration invitation declined.');
    } catch (err) {
      Alert.alert('Error', 'Failed to decline invitation.');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return { name: 'heart', color: '#ef4444' };
      case 'comment':
        return { name: 'comment-text', color: '#3b82f6' };
      case 'follow':
      case 'follow_request':
        return { name: 'account-plus', color: '#10b981' };
      case 'mention':
        return { name: 'at', color: '#a855f7' };
      case 'new_post':
        return { name: 'post-outline', color: '#f59e0b' };
      default:
        return { name: 'bell-outline', color: '#808bf5' };
    }
  };

  const getNotificationText = (n: Notification) => {
    const name = n.sender?.fullname || 'Someone';
    switch (n.type) {
      case 'new_post':
        return `${name} created a new post.`;
      case 'message':
        return `${name} sent you a message: "${n.message?.content || ''}"`;
      case 'like':
        return `${name} liked your ${n.url?.includes('stories') ? 'story' : 'post'}.`;
      case 'comment':
        return `${name} commented on your post.`;
      case 'follow':
        return `${name} started following you.`;
      case 'follow_request':
        return `${name} sent you a follow request.`;
      case 'mention':
        return `${name} mentioned you in a ${n.url?.includes('stories') ? 'story' : 'post'}.`;
      case 'system':
        return n.message?.content || 'System security alert.';
      default:
        return `${name} sent you a notification.`;
    }
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  // Filters
  const followRequests = notifications.filter((n) => n.type === 'follow_request');
  const generalActivity = notifications.filter((n) => n.type !== 'follow_request');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor, marginLeft: 12 }]}>Notifications</Text>
        </View>
        {activeTab === 'notifications' && notifications.some((n) => !n.read) ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="check-all" size={24} color="#808bf5" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Tabs */}
      <View style={[styles.tabBar, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'notifications' && styles.activeTab]}
          onPress={() => setActiveTab('notifications')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'notifications' ? primaryColor : subText }]}>
            Activity
          </Text>
          {generalActivity.filter((n) => !n.read).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{generalActivity.filter((n) => !n.read).length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'requests' && styles.activeTab]}
          onPress={() => setActiveTab('requests')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'requests' ? primaryColor : subText }]}>
            Requests
          </Text>
          {followRequests.filter((n) => !n.read).length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{followRequests.filter((n) => !n.read).length}</Text>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'collabs' && styles.activeTab]}
          onPress={() => setActiveTab('collabs')}
        >
          <Text style={[styles.tabText, { color: activeTab === 'collabs' ? primaryColor : subText }]}>
            Collabs
          </Text>
          {collabInvites.length > 0 && (
            <View style={[styles.badge, { backgroundColor: '#10b981' }]}>
              <Text style={styles.badgeText}>{collabInvites.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading && !refreshing ? (
        <View style={{ flex: 1 }}>
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
          <NotificationSkeleton />
        </View>
      ) : activeTab === 'notifications' ? (
        <FlatList
          data={generalActivity}
          keyExtractor={(item) => item._id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => {
            const icon = getNotificationIcon(item.type);
            return (
              <TouchableOpacity
                onPress={() => handleMarkSingleRead(item._id)}
                style={[
                  styles.notificationItem,
                  { backgroundColor: cardBg, borderBottomColor: border },
                  !item.read && { backgroundColor: isDark ? '#1a1a2e' : '#f8fafd' },
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.avatarWrapper}>
                    {item.type === 'system' ? (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: '#fef3c7' }]}>
                        <MaterialCommunityIcons name="shield-check" size={24} color="#f59e0b" />
                      </View>
                    ) : item.sender?.profile_picture ? (
                      <Image source={{ uri: item.sender.profile_picture }} style={styles.avatar} />
                    ) : (
                      <View style={[styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
                        <Text style={styles.avatarInitial}>{(item.sender?.fullname || '?')[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <View style={[styles.iconIndicator, { backgroundColor: icon.color }]}>
                      <MaterialCommunityIcons name={icon.name} size={11} color="#ffffff" />
                    </View>
                  </View>

                  <View style={styles.textDetails}>
                    {item.type === 'system' && (
                      <Text style={[styles.bold, { color: textColor, fontSize: 14, marginBottom: 2 }]}>Security Alert</Text>
                    )}
                    <Text style={[styles.description, { color: textColor }]}>{getNotificationText(item)}</Text>
                    <Text style={[styles.timeText, { color: subText }]}>{formatTime(item.createdAt)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <MaterialCommunityIcons name="bell-off-outline" size={48} color={subText} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>All clean here</Text>
              <Text style={[styles.emptySubtitle, { color: subText }]}>No activity notifications found.</Text>
            </View>
          }
        />
      ) : activeTab === 'requests' ? (
        <FlatList
          data={followRequests}
          keyExtractor={(item) => item._id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <View style={[styles.notificationItem, { backgroundColor: cardBg, borderBottomColor: border }]}>
              <View style={styles.row}>
                <View style={styles.avatarWrapper}>
                  {item.sender?.profile_picture ? (
                    <Image source={{ uri: item.sender.profile_picture }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: primaryColor }]}>
                      <Text style={styles.avatarInitial}>{(item.sender?.fullname || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.textDetails}>
                  <Text style={[styles.description, { color: textColor }]}>
                    <Text style={styles.bold}>{item.sender?.fullname || 'Someone'}</Text> wants to follow you.
                  </Text>
                  <Text style={[styles.timeText, { color: subText }]}>{formatTime(item.createdAt)}</Text>

                  {item.status ? (
                    <Text style={[styles.statusText, { color: item.status === 'accepted' ? '#10b981' : '#ef4444' }]}>
                      {item.status.toUpperCase()}
                    </Text>
                  ) : (
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        onPress={() => handleAcceptFollow(item.sender?._id || '', item._id)}
                        style={[styles.actionBtn, { backgroundColor: primaryColor }]}
                      >
                        <Text style={styles.actionBtnText}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeclineFollow(item.sender?._id || '', item._id)}
                        style={[styles.actionBtn, { backgroundColor: isDark ? '#2d2d3f' : '#e2e8f0' }]}
                      >
                        <Text style={[styles.actionBtnText, { color: textColor }]}>Decline</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <MaterialCommunityIcons name="account-clock" size={48} color={subText} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No pending requests</Text>
              <Text style={[styles.emptySubtitle, { color: subText }]}>You don't have any follow requests.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={collabInvites}
          keyExtractor={(item) => item._id}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          renderItem={({ item }) => (
            <View style={[styles.notificationItem, { backgroundColor: cardBg, borderBottomColor: border }]}>
              <View style={styles.row}>
                <View style={styles.avatarWrapper}>
                  {item.user?.profile_picture ? (
                    <Image source={{ uri: item.user.profile_picture }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatarPlaceholder, { backgroundColor: '#10b981' }]}>
                      <Text style={styles.avatarInitial}>{(item.user?.fullname || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.textDetails}>
                  <Text style={[styles.description, { color: textColor }]}>
                    <Text style={styles.bold}>{item.user?.fullname || 'Someone'}</Text> invited you to collaborate on their post.
                  </Text>
                  {item.caption ? (
                    <Text style={[styles.previewText, { color: subText }]} numberOfLines={1}>
                      "{item.caption}"
                    </Text>
                  ) : null}
                  <Text style={[styles.timeText, { color: subText }]}>{formatTime(item.createdAt)}</Text>

                  {acceptingCollabId === item._id ? (
                    <View style={styles.collabForm}>
                      <TextInput
                        placeholder="Describe your contribution..."
                        placeholderTextColor={subText}
                        value={contributionText}
                        onChangeText={setContributionText}
                        style={[styles.input, { color: textColor, borderColor: border, backgroundColor: bg }]}
                      />
                      <View style={styles.btnRow}>
                        <TouchableOpacity
                          onPress={() => handleAcceptCollab(item._id)}
                          style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                        >
                          <Text style={styles.actionBtnText}>Confirm Join</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            setAcceptingCollabId(null);
                            setContributionText('');
                          }}
                          style={[styles.actionBtn, { backgroundColor: isDark ? '#2d2d3f' : '#e2e8f0' }]}
                        >
                          <Text style={[styles.actionBtnText, { color: textColor }]}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.btnRow}>
                      <TouchableOpacity
                        onPress={() => setAcceptingCollabId(item._id)}
                        style={[styles.actionBtn, { backgroundColor: '#10b981' }]}
                      >
                        <Text style={styles.actionBtnText}>Join Collab</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeclineCollab(item._id)}
                        style={[styles.actionBtn, { backgroundColor: isDark ? '#2d2d3f' : '#e2e8f0' }]}
                      >
                        <Text style={[styles.actionBtnText, { color: textColor }]}>Ignore</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <MaterialCommunityIcons name="account-group" size={48} color={subText} />
              <Text style={[styles.emptyTitle, { color: textColor }]}>No collab invitations</Text>
              <Text style={[styles.emptySubtitle, { color: subText }]}>You don't have any collab invites.</Text>
            </View>
          }
        />
      )}
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
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  markReadText: {
    fontSize: 14,
    color: '#808bf5',
    fontWeight: 'bold',
  },
  tabBar: {
    flexDirection: 'row',
    height: 48,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: '#808bf5',
  },
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  badge: {
    marginLeft: 6,
    backgroundColor: '#ef4444',
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'black',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationItem: {
    padding: 14,
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  iconIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  textDetails: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 18,
  },
  bold: {
    fontWeight: 'bold',
  },
  timeText: {
    fontSize: 11,
    marginTop: 4,
  },
  previewText: {
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row',
    marginTop: 10,
    gap: 8,
  },
  actionBtn: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'black',
    marginTop: 8,
  },
  collabForm: {
    marginTop: 10,
  },
  input: {
    height: 38,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    fontSize: 13,
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 6,
  },
});
