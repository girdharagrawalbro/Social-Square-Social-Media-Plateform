import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
  ActivityIndicator,
  useColorScheme,
  Dimensions,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { api, BASE_URL } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import { PostItem } from './components/PostItem';
import { PostSkeleton } from './components/SkeletonLoader';

const { width } = Dimensions.get('window');

interface Group {
  _id: string;
  name: string;
  description?: string;
  isPrivate: boolean;
  isAccountabilityCircle: boolean;
  maxMembers?: number;
  cover_picture?: string;
  creator: string;
  members: any[];
  admins: string[];
}

export default function CommunitiesScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);

  const [activeTab, setActiveTab] = useState<'confessions' | 'groups'>('confessions');

  // --- CONFESSIONS STATES ---
  const [confessions, setConfessions] = useState<any[]>([]);
  const [loadingConfessions, setLoadingConfessions] = useState(false);
  const [refreshingConfessions, setRefreshingConfessions] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMoreConfessions, setHasMoreConfessions] = useState(true);

  // --- GROUPS STATES ---
  const [groups, setGroups] = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupPosts, setGroupPosts] = useState<any[]>([]);
  const [loadingGroupDetails, setLoadingGroupDetails] = useState(false);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [newWip, setNewWip] = useState('');
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Styling
  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#121212' : '#f9fafb';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const inputBg = isDark ? '#1a1a24' : '#f3f4f6';

  // --- FETCH CONFESSIONS ---
  const fetchConfessions = async (isRefresh = false) => {
    if (loadingConfessions) return;
    if (isRefresh) {
      setRefreshingConfessions(true);
    } else {
      setLoadingConfessions(true);
    }

    try {
      const cursorParam = !isRefresh && nextCursor ? `&cursor=${nextCursor}` : '';
      const res = await api.get(`/api/post/confessions?limit=10${cursorParam}`);
      const posts = res.data.posts || res.data || [];
      const cursor = res.data.nextCursor || null;

      if (isRefresh) {
        setConfessions(posts);
      } else {
        setConfessions((prev) => [...prev, ...posts]);
      }
      setNextCursor(cursor);
      setHasMoreConfessions(!!cursor);
    } catch (err) {
      console.warn('Failed to fetch confessions:', err);
    } finally {
      setLoadingConfessions(false);
      setRefreshingConfessions(false);
    }
  };

  // --- FETCH GROUPS ---
  const fetchGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await api.get('/api/group/all');
      setGroups(res.data || []);
    } catch (err) {
      console.warn('Failed to fetch groups:', err);
    } finally {
      setLoadingGroups(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchConfessions(true);
    fetchGroups();
  }, []);

  const handleTabChange = (tab: 'confessions' | 'groups') => {
    setActiveTab(tab);
    if (tab === 'confessions' && confessions.length === 0) {
      fetchConfessions(true);
    } else if (tab === 'groups') {
      fetchGroups();
    }
  };

  // --- CONFESSION ACTIONS ---
  const handleMute = (post: any) => {
    Alert.alert(
      'Mute Author',
      'Are you sure you want to mute the author of this anonymous post? Their posts will be hidden from your feed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mute',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/post/${post._id}/mute-author`);
              Alert.alert('Success', 'Author muted.');
              fetchConfessions(true);
            } catch (err) {
              Alert.alert('Error', 'Failed to mute author.');
            }
          },
        },
      ]
    );
  };

  const handleBlock = (post: any) => {
    Alert.alert(
      'Block Author',
      "Are you sure you want to block the author of this anonymous post? You won't see each other's content.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/post/${post._id}/block-author`);
              Alert.alert('Success', 'Author blocked.');
              fetchConfessions(true);
            } catch (err) {
              Alert.alert('Error', 'Failed to block author.');
            }
          },
        },
      ]
    );
  };

  // --- GROUP DETAILS & JOIN/LEAVE ---
  const loadGroupDetails = async (group: Group) => {
    setSelectedGroup(group);
    setLoadingGroupDetails(true);
    setCheckins([]);
    try {
      const detailsRes = await api.get(`/api/group/${group._id}`);
      setGroupPosts(detailsRes.data?.posts || []);

      if (group.isAccountabilityCircle) {
        const checkinsRes = await api.get(`/api/group/${group._id}/checkins`);
        setCheckins(checkinsRes.data || []);
      }
    } catch (err) {
      console.warn('Failed to load group details:', err);
    } finally {
      setLoadingGroupDetails(false);
    }
  };

  const handleJoinGroup = async (group: Group) => {
    try {
      await api.post(`/api/group/join/${group._id}`);
      Alert.alert('Joined', `You are now a member of ${group.name}!`);
      fetchGroups();
      setSelectedGroup(null);
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to join group.');
    }
  };

  const handleLeaveGroup = async (group: Group) => {
    Alert.alert(
      'Leave Group',
      `Are you sure you want to leave ${group.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.post(`/api/group/leave/${group._id}`);
              Alert.alert('Left', `You left ${group.name}.`);
              fetchGroups();
              setSelectedGroup(null);
            } catch (err) {
              Alert.alert('Error', 'Failed to leave group.');
            }
          },
        },
      ]
    );
  };

  const handleCreateCheckin = async () => {
    if (!newWip.trim() || !selectedGroup) return;
    setSubmittingCheckin(true);
    try {
      await api.post(`/api/group/${selectedGroup._id}/checkin`, { wipText: newWip });
      setNewWip('');
      // Reload checkins
      const checkinsRes = await api.get(`/api/group/${selectedGroup._id}/checkins`);
      setCheckins(checkinsRes.data || []);
      Alert.alert('Success', 'WIP check-in submitted!');
    } catch (err) {
      Alert.alert('Error', 'Failed to submit check-in.');
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const handleToggleCheckinStatus = async (checkinId: string, status: string) => {
    if (!selectedGroup) return;
    try {
      await api.put(`/api/group/${selectedGroup._id}/checkin/${checkinId}/status`, { status });
      const checkinsRes = await api.get(`/api/group/${selectedGroup._id}/checkins`);
      setCheckins(checkinsRes.data || []);
    } catch (err) {
      Alert.alert('Error', 'Failed to update check-in status.');
    }
  };

  // --- RENDER METHODS ---
  const renderConfessionsTab = () => {
    if (loadingConfessions && confessions.length === 0) {
      return (
        <ScrollView style={{ padding: 16 }}>
          <PostSkeleton />
          <PostSkeleton />
        </ScrollView>
      );
    }

    return (
      <FlatList
        data={confessions}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.postWrapper}>
            <PostItem post={item} isDark={isDark} isVisible={true} />
            <View style={[styles.anonOptionsRow, { borderColor: border }]}>
              <TouchableOpacity onPress={() => handleMute(item)} style={styles.anonActionBtn}>
                <MaterialCommunityIcons name="volume-off" size={16} color={subText} />
                <Text style={[styles.anonActionText, { color: subText }]}>Mute Author</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleBlock(item)} style={styles.anonActionBtn}>
                <MaterialCommunityIcons name="ban" size={16} color="#ef4444" />
                <Text style={[styles.anonActionText, { color: '#ef4444' }]}>Block Author</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        refreshing={refreshingConfessions}
        onRefresh={() => fetchConfessions(true)}
        onEndReached={() => {
          if (hasMoreConfessions) fetchConfessions();
        }}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingConfessions ? (
            <ActivityIndicator size="small" color="#808bf5" style={{ marginVertical: 20 }} />
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyView}>
            <MaterialCommunityIcons name="comment-text-multiple-outline" size={48} color={subText} />
            <Text style={[styles.emptyText, { color: subText }]}>No confessions yet.</Text>
          </View>
        }
      />
    );
  };

  const renderGroupsTab = () => {
    if (selectedGroup) {
      return renderGroupDetails();
    }

    const filtered = groups.filter((g) =>
      g.name.toLowerCase().includes(groupSearch.toLowerCase()) ||
      g.description?.toLowerCase().includes(groupSearch.toLowerCase())
    );

    const isMember = (g: Group) => g.members.some((m) => (m._id || m) === user?._id);
    const myGroups = filtered.filter(isMember);
    const discoverGroups = filtered.filter((g) => !isMember(g));

    return (
      <View style={{ flex: 1 }}>
        {/* Search Bar */}
        <View style={[styles.searchContainer, { borderBottomColor: border }]}>
          <View style={[styles.searchBox, { backgroundColor: inputBg }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={subText} />
            <TextInput
              style={[styles.searchInput, { color: textColor }]}
              placeholder="Search communities..."
              placeholderTextColor={subText}
              value={groupSearch}
              onChangeText={setGroupSearch}
            />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.groupsScrollContent}>
          {myGroups.length > 0 && (
            <View style={styles.groupsSection}>
              <Text style={[styles.sectionTitle, { color: textColor }]}>My Communities</Text>
              {myGroups.map((g) => renderGroupCard(g, true))}
            </View>
          )}

          <View style={styles.groupsSection}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Discover Communities</Text>
            {discoverGroups.length > 0 ? (
              discoverGroups.map((g) => renderGroupCard(g, false))
            ) : (
              <Text style={[styles.noGroupsText, { color: subText }]}>No new communities found.</Text>
            )}
          </View>
        </ScrollView>
      </View>
    );
  };

  const renderGroupCard = (g: Group, joined: boolean) => {
    return (
      <TouchableOpacity
        key={g._id}
        style={[styles.groupCard, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => loadGroupDetails(g)}
        activeOpacity={0.7}
      >
        <View style={styles.groupCardHeader}>
          <View style={styles.groupInfoRow}>
            <View style={styles.groupAvatar}>
              <Text style={styles.groupAvatarText}>👥</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.groupName, { color: textColor }]} numberOfLines={1}>
                {g.name}
              </Text>
              <Text style={[styles.groupMembersCount, { color: subText }]}>
                {g.members.length} member{g.members.length !== 1 ? 's' : ''}
                {g.isAccountabilityCircle && ' • Accountability Circle'}
              </Text>
            </View>
          </View>
        </View>

        {g.description ? (
          <Text style={[styles.groupDesc, { color: subText }]} numberOfLines={2}>
            {g.description}
          </Text>
        ) : null}

        <View style={styles.groupCardActions}>
          {joined ? (
            <TouchableOpacity onPress={() => handleLeaveGroup(g)} style={styles.leaveBtn}>
              <Text style={styles.leaveBtnText}>Leave</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={() => handleJoinGroup(g)} style={styles.joinBtn}>
              <Text style={styles.joinBtnText}>Join Community</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderGroupDetails = () => {
    if (!selectedGroup) return null;
    const isMember = selectedGroup.members.some((m) => (m._id || m) === user?._id);

    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: bg }}>
        {/* Detail Header */}
        <View style={[styles.detailHeader, { borderBottomColor: border }]}>
          <TouchableOpacity onPress={() => setSelectedGroup(null)} style={styles.detailBackBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.detailTitle, { color: textColor }]} numberOfLines={1}>
            {selectedGroup.name}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={styles.detailScrollContent}>
          {/* Cover Placeholder */}
          <View style={[styles.groupBanner, { backgroundColor: cardBg }]}>
            <Text style={styles.bannerEmoji}>🏔️</Text>
            <Text style={[styles.bannerTitle, { color: textColor }]}>{selectedGroup.name}</Text>
            <Text style={[styles.bannerSub, { color: subText }]}>
              {selectedGroup.members.length} members • {selectedGroup.isAccountabilityCircle ? 'Accountability Circle' : 'General Group'}
            </Text>
          </View>

          {/* Description */}
          {selectedGroup.description ? (
            <View style={[styles.detailSec, { borderColor: border }]}>
              <Text style={[styles.secTitle, { color: textColor }]}>About</Text>
              <Text style={[styles.secBody, { color: subText }]}>{selectedGroup.description}</Text>
            </View>
          ) : null}

          {/* Accountability Circle Widget */}
          {selectedGroup.isAccountabilityCircle && isMember && (
            <View style={[styles.detailSec, { borderColor: border, backgroundColor: cardBg }]}>
              <Text style={[styles.secTitle, { color: textColor }]}>🎯 Weekly Accountability</Text>
              <Text style={[styles.secBody, { color: subText, marginBottom: 12 }]}>
                Share your WIP (Work In Progress) and check in at the end of the week!
              </Text>

              {/* Checkin form */}
              <View style={styles.checkinForm}>
                <TextInput
                  style={[styles.checkinInput, { backgroundColor: inputBg, color: textColor, borderColor: border }]}
                  placeholder="What are you working on this week?"
                  placeholderTextColor={subText}
                  value={newWip}
                  onChangeText={setNewWip}
                />
                <TouchableOpacity
                  style={[styles.checkinSubmitBtn, !newWip.trim() && { opacity: 0.5 }]}
                  onPress={handleCreateCheckin}
                  disabled={!newWip.trim() || submittingCheckin}
                >
                  {submittingCheckin ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.checkinSubmitBtnText}>Submit WIP</Text>
                  )}
                </TouchableOpacity>
              </View>

              {/* Members WIPs list */}
              <View style={{ marginTop: 16 }}>
                <Text style={[styles.subSecTitle, { color: textColor }]}>Peer Check-ins</Text>
                {checkins.length === 0 ? (
                  <Text style={[styles.noCheckinsText, { color: subText }]}>No check-ins yet this week.</Text>
                ) : (
                  checkins.map((c) => {
                    const isMyCheckin = c.user?._id === user?._id;
                    return (
                      <View key={c._id} style={[styles.checkinCard, { borderColor: border }]}>
                        <View style={styles.checkinUserRow}>
                          <Text style={[styles.checkinUserName, { color: textColor }]}>
                            {c.user?.fullname} {isMyCheckin && '(You)'}
                          </Text>
                          <Text style={[styles.checkinStatusBadge, c.status === 'completed' ? { color: '#10b981' } : { color: '#f59e0b' }]}>
                            {c.status.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.checkinWipText, { color: textColor }]}>{c.wipText}</Text>
                        
                        {isMyCheckin && c.status === 'pending' && (
                          <View style={styles.checkinActionsRow}>
                            <TouchableOpacity
                              onPress={() => handleToggleCheckinStatus(c._id, 'completed')}
                              style={styles.checkinCompleteBtn}
                            >
                              <Text style={styles.checkinCompleteBtnText}>Mark Completed</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          )}

          {/* Group Feed */}
          <View style={{ marginTop: 16 }}>
            <Text style={[styles.secTitle, { color: textColor, paddingHorizontal: 16, marginBottom: 12 }]}>
              Community Feed
            </Text>
            {loadingGroupDetails ? (
              <ActivityIndicator color="#808bf5" style={{ marginVertical: 20 }} />
            ) : groupPosts.length === 0 ? (
              <View style={styles.emptyFeed}>
                <MaterialCommunityIcons name="image-outline" size={32} color={subText} />
                <Text style={[styles.emptyFeedText, { color: subText }]}>No posts in this community yet.</Text>
              </View>
            ) : (
              groupPosts.map((post) => (
                <PostItem key={post._id} post={post} isDark={isDark} isVisible={true} />
              ))
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      {selectedGroup === null && (
        <View style={[styles.header, { borderBottomColor: border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Communities & Confessions</Text>
          <View style={{ width: 40 }} />
        </View>
      )}

      {/* Tabs Selector */}
      {selectedGroup === null && (
        <View style={[styles.tabSelectorRow, { borderBottomColor: border }]}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'confessions' && [styles.activeTabBtn, { borderBottomColor: '#808bf5' }]]}
            onPress={() => handleTabChange('confessions')}
          >
            <Text style={[styles.tabText, activeTab === 'confessions' ? styles.activeTabText : { color: subText }]}>
              🎭 Confessions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'groups' && [styles.activeTabBtn, { borderBottomColor: '#808bf5' }]]}
            onPress={() => handleTabChange('groups')}
          >
            <Text style={[styles.tabText, activeTab === 'groups' ? styles.activeTabText : { color: subText }]}>
              👥 Communities
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Tab Contents */}
      <View style={{ flex: 1 }}>
        {activeTab === 'confessions' ? renderConfessionsTab() : renderGroupsTab()}
      </View>
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
  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  tabSelectorRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabBtn: {},
  tabText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  activeTabText: {
    color: '#808bf5',
  },
  postWrapper: {
    marginBottom: 8,
  },
  anonOptionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.02)',
  },
  anonActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  anonActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    marginTop: 12,
  },
  searchContainer: {
    padding: 12,
    borderBottomWidth: 1,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  groupsScrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  groupsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  noGroupsText: {
    fontSize: 13,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
  groupCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  groupCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  groupInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  groupAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  groupAvatarText: {
    fontSize: 20,
  },
  groupName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  groupMembersCount: {
    fontSize: 11,
    marginTop: 2,
  },
  groupDesc: {
    fontSize: 12,
    marginTop: 10,
    lineHeight: 16,
  },
  groupCardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 12,
  },
  joinBtn: {
    backgroundColor: '#808bf5',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  leaveBtn: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  leaveBtnText: {
    color: '#ef4444',
    fontSize: 12,
    fontWeight: 'bold',
  },
  detailHeader: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    paddingHorizontal: 8,
  },
  detailBackBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  detailTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  detailScrollContent: {
    paddingBottom: 40,
  },
  groupBanner: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  bannerEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  bannerSub: {
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  detailSec: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  secTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  secBody: {
    fontSize: 12,
    lineHeight: 18,
  },
  checkinForm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkinInput: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  checkinSubmitBtn: {
    backgroundColor: '#808bf5',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkinSubmitBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  subSecTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    marginVertical: 12,
  },
  noCheckinsText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  checkinCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  checkinUserRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkinUserName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  checkinStatusBadge: {
    fontSize: 10,
    fontWeight: '800',
  },
  checkinWipText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  checkinActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
  },
  checkinCompleteBtn: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  checkinCompleteBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  emptyFeed: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyFeedText: {
    fontSize: 12,
    marginTop: 8,
  },
});
