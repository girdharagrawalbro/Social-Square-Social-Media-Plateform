import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  Image,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Dimensions,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  Share,
  RefreshControl,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';
import { api, BASE_URL } from '../lib/api';
import { getCache, setCache, invalidateCache, TTL } from '../lib/cache';
import { appChannel } from '../lib/broadcast';
import { ProfileSkeleton } from './components/SkeletonLoader';

const { width } = Dimensions.get('window');
const gridWidth = (width - 35) / 3;

export default function ProfileScreen({ navigation, route }: any) {
  const isDark = useColorScheme() === 'dark';
  const { user, logout, setUser } = useAuthStore();
  const targetUserId = route?.params?.userId;
  const isOwner = !targetUserId || targetUserId === user?._id;
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.get('/api/conversation/notifications');
      const notifications = res.data.notifications || res.data || [];
      const count = notifications.filter((n: any) => !n.read).length;
      setUnreadNotificationsCount(count);
    } catch (e) {
      console.warn('Failed to fetch unread notifications count:', e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
    }, [])
  );

  const [profileData, setProfileData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [contributions, setContributions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isRequested, setIsRequested] = useState(false);

  // Edit Profile States
  const [editVisible, setEditVisible] = useState(false);
  const [fullnameInput, setFullnameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [profilePicInput, setProfilePicInput] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'goals' | 'graveyard' | 'saved' | 'collabs' | 'analytics'>('posts');
  const [savedPosts, setSavedPosts] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [graveyardIdeas, setGraveyardIdeas] = useState<any[]>([]);
  const [collabInvites, setCollabInvites] = useState<any[]>([]);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loadingTab, setLoadingTab] = useState(false);

  const fetchTabContent = async (tab: string) => {
    const profileId = targetUserId || user?._id;
    if (!profileId) return;

    setLoadingTab(true);
    try {
      if (tab === 'saved') {
        const res = await api.get(`/api/post/saved/${profileId}`);
        setSavedPosts(res.data || []);
      } else if (tab === 'goals') {
        const res = await api.get(`/api/goal/user/${profileId}`);
        setGoals(res.data || []);
      } else if (tab === 'graveyard') {
        const res = await api.get(`/api/idea/user/${profileId}`);
        setGraveyardIdeas(res.data || []);
      } else if (tab === 'collabs') {
        const res = await api.get(`/api/post/collaborate/invites/${profileId}`);
        setCollabInvites(res.data || []);
      } else if (tab === 'analytics') {
        const res = await api.get(`/api/auth/analytics/${profileId}`);
        setAnalyticsData(res.data || null);
      }
    } catch (e) {
      console.warn(`Failed to fetch tab data for ${tab}:`, e);
    } finally {
      setLoadingTab(false);
    }
  };

  useEffect(() => {
    if (activeTab !== 'posts' && activeTab !== 'reels') {
      fetchTabContent(activeTab);
    }
  }, [activeTab, targetUserId]);

  const handleShareProfile = async () => {
    try {
      const profileLink = `${BASE_URL}/profile/${profileData?._id || user?._id}`;
      await Share.share({
        message: `Check out my profile on Social Square! ${profileLink}`,
        title: 'Social Square Profile',
      });
    } catch (error) {
      console.warn('Error sharing profile:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    const profileId = targetUserId || user?._id;
    if (profileId) {
      await invalidateCache(`profile_${profileId}`);
      await invalidateCache(`profile_posts_${profileId}`);
    }
    await fetchProfileInfo();
    setRefreshing(false);
  };

  const fetchProfileInfo = async () => {
    const profileId = targetUserId || user?._id;
    if (!profileId) return;

    // ─── Cache-first: show profile instantly on re-visit ─────────────────────
    const profileCacheKey = `profile_${profileId}`;
    const postsCacheKey = `profile_posts_${profileId}`;
    const cachedProfile = await getCache<any>(profileCacheKey);
    const cachedPosts = await getCache<any[]>(postsCacheKey);
    if (cachedProfile) {
      setProfileData(cachedProfile);
      setLoading(false);
    }
    if (cachedPosts) {
      setPosts(cachedPosts);
    }

    try {
      let userObj;
      if (isOwner) {
        const profileRes = await api.get('/api/auth/me');
        userObj = profileRes.data;
        setIsFollowing(true);
        setIsRequested(false);
      } else {
        const profileRes = await api.get(`/api/auth/other-user/view/${targetUserId}`);
        userObj = profileRes.data.user || profileRes.data;
        setIsFollowing(profileRes.data.isFollowing || false);
        setIsRequested(profileRes.data.hasPendingRequest || false);
      }
      setProfileData(userObj);
      await setCache(profileCacheKey, userObj, TTL.PROFILE);

      const postsRes = await api.get(`/api/post/user/${userObj._id}?limit=9`);
      const freshPosts = postsRes.data.posts || postsRes.data || [];
      setPosts(freshPosts);
      await setCache(postsCacheKey, freshPosts, TTL.FEED);
      setNextCursor(postsRes.data.nextCursor || null);
      setHasMore(postsRes.data.hasMore || false);

      const contributionsRes = await api.get(`/api/auth/users/${userObj._id}/contributions`);
      setContributions(contributionsRes.data.contributions || {});
    } catch (err) {
      console.warn('Failed to load profile info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMorePosts = async () => {
    if (loadingMore || !hasMore || !nextCursor || !profileData) return;
    setLoadingMore(true);
    try {
      const postsRes = await api.get(`/api/post/user/${profileData._id}?limit=9&cursor=${nextCursor}`);
      const newPosts = postsRes.data.posts || postsRes.data || [];
      console.log('[ProfileScreen] fetchMorePosts loaded:', newPosts.length, 'nextCursor:', postsRes.data.nextCursor, 'hasMore:', postsRes.data.hasMore);
      setPosts((prev) => [...prev, ...newPosts]);
      setNextCursor(postsRes.data.nextCursor || null);
      setHasMore(postsRes.data.hasMore || false);
    } catch (err) {
      console.warn('Failed to load more posts:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleFollow = async () => {
    if (!targetUserId || !user) return;
    try {
      const res = await api.post('/api/auth/follow', { userId: user._id, followUserId: targetUserId });
      if (res.data.requested) {
        setIsRequested(true);
        setIsFollowing(false);
      } else {
        setIsFollowing(true);
        setIsRequested(false);
      }
      fetchProfileInfo();
    } catch (err) {
      console.warn('Failed to follow user:', err);
    }
  };

  const handleUnfollow = async () => {
    if (!targetUserId || !user) return;
    try {
      await api.post('/api/auth/unfollow', { userId: user._id, unfollowUserId: targetUserId });
      setIsFollowing(false);
      setIsRequested(false);
      fetchProfileInfo();
    } catch (err) {
      console.warn('Failed to unfollow user:', err);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchUnreadCount();
      fetchProfileInfo();
    }, [])
  );

  useEffect(() => {
    const unsub = appChannel.on('POST_CREATED', (data: any) => {
      if (isOwner && data?.post) {
        setPosts((prev) => [data.post, ...prev]);

        // Also update local cache for profile posts
        const postsCacheKey = `profile_posts_${user?._id}`;
        getCache<any[]>(postsCacheKey).then((cached) => {
          const updated = cached ? [data.post, ...cached] : [data.post];
          setCache(postsCacheKey, updated, TTL.FEED);
        });
      }
    });

    return () => unsub();
  }, [isOwner, user?._id]);

  const handleSaveProfile = async () => {
    if (!fullnameInput.trim() || !usernameInput.trim()) {
      Alert.alert('Validation Error', 'Full Name and Username cannot be empty.');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await api.put('/api/auth/update-profile', {
        fullname: fullnameInput.trim(),
        username: usernameInput.trim(),
        bio: bioInput.trim(),
        profile_picture: profilePicInput.trim() || undefined,
      });
      setUser(res.data.user || res.data);
      // Invalidate profile cache so it reloads fresh after edit
      await invalidateCache(`profile_${user?._id}`);
      await invalidateCache(`profile_posts_${user?._id}`);
      Alert.alert('Success', 'Profile updated successfully!');
      setEditVisible(false);
      fetchProfileInfo();
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const border = isDark ? '#1a1a1a' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#808bf5';

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

  const getPreviewSource = (post: any) => {
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    let previewSrc = images.length > 0 ? images[0] : null;
    if (post.video) {
      previewSrc = post.videoThumbnail || null;
    } else if (post.isBeforeAfter && !previewSrc) {
      if (post.beforeAfter?.type === 'code') {
        previewSrc = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1782133031/ChatGPT_Image_Jun_22_2026_06_26_15_PM_j0k8kg.png";
      } else if (post.beforeAfter?.type === 'text') {
        previewSrc = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1782133031/ChatGPT_Image_Jun_22_2026_06_24_51_PM_qshub2.png";
      }
    }
    return resolveMediaUrl(previewSrc);
  };
  const renderTabBar = () => {
    const TABS = isOwner
      ? [
        { key: 'posts', icon: 'table', label: 'Posts' },
        { key: 'reels', icon: 'video', label: 'Reels' },
        { key: 'goals', icon: 'flag', label: 'Roadmap' },
        { key: 'graveyard', icon: 'history', label: 'Graveyard' },
        { key: 'saved', icon: 'bookmark', label: 'Saved' },
        { key: 'collabs', icon: 'users', label: 'Collabs' },
        { key: 'analytics', icon: 'chart-bar', label: 'Insights' },
      ]
      : [
        { key: 'posts', icon: 'table', label: 'Posts' },
        { key: 'reels', icon: 'video', label: 'Reels' },
        { key: 'goals', icon: 'flag', label: 'Roadmap' },
        { key: 'graveyard', icon: 'history', label: 'Graveyard' },
      ];

    return (
      <View style={{ marginBottom: 8 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingVertical: 8,
          }}
        >
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              onPress={() => setActiveTab(tab.key as any)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: activeTab === tab.key ? '#808bf5' : (isDark ? '#1e293b' : '#f1f5f9'),
                marginRight: 8,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <MaterialCommunityIcons
                name={tab.icon}
                size={16}
                color={activeTab === tab.key ? '#ffffff' : subText}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderGoals = () => {
    if (loadingTab) return <ActivityIndicator color="#808bf5" style={{ marginVertical: 40 }} />;
    if (goals.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <MaterialCommunityIcons name="flag-outline" size={48} color={subText} />
          <Text style={{ color: subText, marginTop: 12 }}>No goals set yet.</Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        {goals.map((g: any) => {
          const completedMilestones = (g.milestones || []).filter((m: any) => m.completed).length;
          const totalMilestones = (g.milestones || []).length;
          const progress = totalMilestones > 0 ? completedMilestones / totalMilestones : 0;
          return (
            <View key={g._id} style={{ padding: 16, borderRadius: 16, backgroundColor: cardBg, borderWidth: 1, borderColor: border, marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor, flex: 1, marginRight: 8 }}>{g.title}</Text>
                <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase' }}>{g.category || 'General'}</Text>
                </View>
              </View>
              <Text style={{ fontSize: 13, color: subText, marginBottom: 12 }}>{g.description}</Text>

              {totalMilestones > 0 && (
                <View style={{ marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '600', color: subText }}>Progress</Text>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#808bf5' }}>{completedMilestones}/{totalMilestones}</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ height: '100%', width: `${progress * 100}%`, backgroundColor: '#808bf5' }} />
                  </View>
                </View>
              )}

              {totalMilestones > 0 && (
                <View style={{ gap: 8 }}>
                  {g.milestones.map((m: any, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 2 }}>
                      <MaterialCommunityIcons
                        name={m.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={16}
                        color={m.completed ? '#10b981' : subText}
                      />
                      <Text style={{ fontSize: 13, color: m.completed ? subText : textColor, textDecorationLine: m.completed ? 'line-through' : 'none' }}>{m.title}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const renderGraveyard = () => {
    if (loadingTab) return <ActivityIndicator color="#808bf5" style={{ marginVertical: 40 }} />;
    if (graveyardIdeas.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <MaterialCommunityIcons name="skull-outline" size={48} color={subText} />
          <Text style={{ color: subText, marginTop: 12 }}>Graveyard is empty.</Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        {graveyardIdeas.map((idea: any) => (
          <View key={idea._id} style={{ padding: 16, borderRadius: 16, backgroundColor: cardBg, borderWidth: 1, borderColor: border, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <MaterialCommunityIcons name="skull" size={16} color="#ef4444" />
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: textColor }}>{idea.title}</Text>
            </View>
            <Text style={{ fontSize: 13, color: textColor, marginBottom: 8 }}>{idea.description}</Text>

            <View style={{ backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.03)', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#ef4444', marginBottom: 8 }}>
              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#ef4444', textTransform: 'uppercase', marginBottom: 2 }}>Why it was killed</Text>
              <Text style={{ fontSize: 12, color: subText }}>{idea.killedReason}</Text>
            </View>

            {idea.lessonsLearned ? (
              <View style={{ backgroundColor: isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.03)', padding: 12, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: '#10b981' }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase', marginBottom: 2 }}>Lessons Learned</Text>
                <Text style={{ fontSize: 12, color: subText }}>{idea.lessonsLearned}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    );
  };

  const renderCollabs = () => {
    if (loadingTab) return <ActivityIndicator color="#808bf5" style={{ marginVertical: 40 }} />;
    if (collabInvites.length === 0) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <MaterialCommunityIcons name="account-group-outline" size={48} color={subText} />
          <Text style={{ color: subText, marginTop: 12 }}>No collaboration invites.</Text>
        </View>
      );
    }
    return (
      <View style={{ gap: 12 }}>
        {collabInvites.map((invite: any) => (
          <View key={invite._id} style={{ padding: 16, borderRadius: 16, backgroundColor: cardBg, borderWidth: 1, borderColor: border, marginBottom: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Image source={{ uri: invite.sender?.profile_picture || 'https://via.placeholder.com/150' }} style={{ width: 36, height: 36, borderRadius: 18 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: textColor }}>{invite.sender?.fullname}</Text>
                <Text style={{ fontSize: 11, color: '#808bf5' }}>@{invite.sender?.username}</Text>
              </View>
            </View>
            <Text style={{ fontSize: 13, color: textColor, marginBottom: 12 }}>Invited you to collaborate on their post.</Text>

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#ffffff' }}>Accept</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ flex: 1, height: 36, borderRadius: 8, backgroundColor: isDark ? '#1e293b' : '#e2e8f0', borderWidth: 1, borderColor: border, justifyContent: 'center', alignItems: 'center' }}>
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: textColor }}>Decline</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderAnalytics = () => {
    if (loadingTab) return <ActivityIndicator color="#808bf5" style={{ marginVertical: 40 }} />;
    if (!analyticsData) {
      return (
        <View style={{ alignItems: 'center', paddingVertical: 40 }}>
          <MaterialCommunityIcons name="chart-bar" size={48} color={subText} />
          <Text style={{ color: subText, marginTop: 12 }}>No insights available yet.</Text>
        </View>
      );
    }
    const { stats } = analyticsData;
    return (
      <View style={{ gap: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: 'bold', color: textColor, marginBottom: 4 }}>Overview</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {[
            { label: 'Total Reach', value: stats?.reach || 0, icon: 'eye-outline' },
            { label: 'Engagement Rate', value: `${stats?.engagementRate || 0}%`, icon: 'heart-flash' },
            { label: 'Content Shared', value: stats?.totalPosts || 0, icon: 'image-multiple' },
          ].map((item, idx) => (
            <View key={idx} style={{ width: (width - 42) / 2, padding: 16, borderRadius: 16, backgroundColor: cardBg, borderWidth: 1, borderColor: border, marginBottom: 12 }}>
              <MaterialCommunityIcons name={item.icon as any} size={20} color="#808bf5" style={{ marginBottom: 8 }} />
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: textColor }}>{item.value}</Text>
              <Text style={{ fontSize: 11, color: subText, marginTop: 2 }}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        {/* Left Side: Back or Plus Icon */}
        {isOwner ? (
          <TouchableOpacity onPress={() => navigation.navigate('NewPost')} style={styles.headerLeftBtn}>
            <MaterialCommunityIcons name="plus" size={26} color={textColor} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerLeftBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
          </TouchableOpacity>
        )}

        {/* Center: Title */}
        <Text style={[styles.headerTitle, { color: textColor }]}>
          {profileData?.username ? `@${profileData.username}` : (isOwner && user?.username ? `@${user.username}` : 'Profile')}
        </Text>

        {/* Right Side: Bell & Hamburger */}
        {isOwner ? (
          <View style={styles.headerRightGroup}>
            <TouchableOpacity onPress={() => navigation.navigate('Notifications')} style={styles.headerRightBtn}>
              <View style={styles.badgeWrapper}>
                {unreadNotificationsCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
                  </View>
                )}
                <MaterialCommunityIcons name="bell-outline" size={24} color="#808bf5" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                Alert.alert(
                  'Menu',
                  'What would you like to do?',
                  [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Logout', onPress: () => { logout(); navigation.navigate('Login'); }, style: 'destructive' }
                  ]
                );
              }}
              style={styles.headerRightBtn}
            >
              <MaterialCommunityIcons name="menu" size={26} color={textColor} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerRightGroup} />
        )}
      </View>

      {loading ? (
        <ProfileSkeleton />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          numColumns={3}
          ListHeaderComponent={
            <>
              {/* User Card */}
              <View style={[styles.profileCard]}>
                <View style={{ position: 'relative' }}>
                  <Image
                    source={{
                      uri: profileData?.profile_picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150',
                    }}
                    style={styles.avatar}
                  />
                </View>
                <Text style={[styles.fullname, { color: textColor }]}>{profileData?.fullname || 'Alex Rivera'}</Text>
                {profileData?.bio ? (
                  <Text style={[styles.bioText, { color: textColor }]} numberOfLines={3}>
                    {profileData.bio}
                  </Text>
                ) : null}

                {/* Level / Streak / XP Row */}
                <View style={[styles.gamificationRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : '#f8f9fe', borderColor: border }]}>
                  <View style={[styles.gamifyBadge]}>
                    <Text style={[styles.gamifyVal, { color: '#6366f1' }]}>{profileData?.level || 1}</Text>
                    <Text style={styles.gamifyLabel}>LEVEL</Text>
                  </View>
                  <View style={styles.gamifyDivider} />
                  <View style={[styles.gamifyBadge]}>
                    <Text
                      style={[
                        styles.gamifyVal,
                        { color: (profileData?.streak?.count || 0) > 0 ? '#f97316' : subText },
                      ]}
                    >
                      {profileData?.streak?.count || 0}{' '}
                      {(profileData?.streak?.count || 0) > 0 ? '🔥' : ''}
                    </Text>
                    <Text style={styles.gamifyLabel}>STREAK</Text>
                  </View>
                  <View style={styles.gamifyDivider} />
                  <View style={[styles.gamifyBadge]}>
                    <Text style={[styles.gamifyVal, { color: '#10b981' }]}>{profileData?.xp || 0}</Text>
                    <Text style={styles.gamifyLabel}>XP</Text>
                  </View>
                </View>

                {/* Detailed Statistics Cards */}
                <View style={styles.statsGrid}>
                  <View style={[styles.statBox]}>
                    <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.followersCount || 0}</Text>
                    <Text style={[styles.statBoxLabel, { color: subText }]}>FOLLOWERS</Text>
                  </View>
                  <View style={[styles.statBox]}>
                    <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.followingCount || 0}</Text>
                    <Text style={[styles.statBoxLabel, { color: subText }]}>FOLLOWING</Text>
                  </View>
                  <View style={[styles.statBox]}>
                    <Text style={[styles.statBoxNum, { color: textColor }]}>{posts.length}</Text>
                    <Text style={[styles.statBoxLabel, { color: subText }]}>POSTS</Text>
                  </View>
                  <View style={[styles.statBox]}>
                    <Text style={[styles.statBoxNum, { color: textColor }]}>{profileData?.profileViews || 0}</Text>
                    <Text style={[styles.statBoxLabel, { color: subText }]}>VIEWS</Text>
                  </View>
                </View>

                {/* Follow & Message actions for visiting other profile */}
                {!isOwner && (
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 16 }}>
                    <TouchableOpacity
                      onPress={isFollowing ? handleUnfollow : handleFollow}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isFollowing ? (isDark ? '#1e293b' : '#e2e8f0') : '#808bf5',
                        borderWidth: isFollowing ? 1 : 0,
                        borderColor: border
                      }}
                    >
                      <Text style={{ fontSize: 13, color: isFollowing ? textColor : '#ffffff', fontWeight: 'bold' }}>
                        {isFollowing ? 'Following' : isRequested ? 'Requested' : 'Follow'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => {
                        if (profileData?._id) {
                          navigation.navigate('Chat', { recipientId: profileData._id, recipientName: profileData.fullname });
                        }
                      }}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                        borderWidth: 1,
                        borderColor: border
                      }}
                    >
                      <Text style={{ fontSize: 13, color: textColor, fontWeight: 'bold' }}>
                        Message
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}

                {isOwner && (
                  <View style={{ flexDirection: 'row', gap: 10, width: '100%', marginTop: 16 }}>
                    <TouchableOpacity
                      onPress={() => {
                        setFullnameInput(profileData?.fullname || '');
                        setUsernameInput(profileData?.username || '');
                        setBioInput(profileData?.bio || '');
                        setProfilePicInput(profileData?.profile_picture || '');
                        setEditVisible(true);
                      }}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: '#808bf5',
                      }}
                    >
                      <Text style={{ fontSize: 13, color: '#ffffff', fontWeight: 'bold' }}>
                        Edit Profile
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={handleShareProfile}
                      style={{
                        flex: 1,
                        height: 42,
                        borderRadius: 12,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: isDark ? '#1e293b' : '#e2e8f0',
                        borderWidth: 1,
                        borderColor: border
                      }}
                    >
                      <Text style={{ fontSize: 13, color: textColor, fontWeight: 'bold' }}>
                        Share Profile
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Consistency Graph Card */}
              <View style={[styles.consistencyCard, { backgroundColor: cardBg, borderColor: border }]}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setShowGraph(!showGraph)}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: showGraph ? 12 : 0 }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="calendar-month" size={16} color="#808bf5" />
                    <Text style={[styles.consistencyTitle, { color: textColor }]}>CONSISTENCY GRAPH</Text>
                  </View>
                  <MaterialCommunityIcons
                    name={showGraph ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={subText}
                  />
                </TouchableOpacity>

                {showGraph && (
                  <>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
                      {/* Render last 16 weeks of posting days */}
                      {Array.from({ length: 16 }).map((_, wIdx) => {
                        return (
                          <View key={wIdx} style={{ flexDirection: 'column', gap: 3 }}>
                            {Array.from({ length: 7 }).map((_, dIdx) => {
                              const targetDate = new Date();
                              targetDate.setDate(targetDate.getDate() - (15 - wIdx) * 7 - (6 - dIdx));
                              const dateStr = targetDate.toISOString().split('T')[0];
                              const count = contributions[dateStr] || 0;

                              let cellBg = isDark ? '#1e293b' : '#e2e8f0';
                              if (count === 1) cellBg = 'rgba(99, 102, 241, 0.35)';
                              else if (count === 2) cellBg = 'rgba(99, 102, 241, 0.65)';
                              else if (count > 2) cellBg = '#6366f1';

                              return (
                                <View
                                  key={dIdx}
                                  style={{
                                    width: 8,
                                    height: 8,
                                    borderRadius: 1.5,
                                    backgroundColor: cellBg
                                  }}
                                />
                              );
                            })}
                          </View>
                        );
                      })}
                    </View>

                    {/* Legend so the grid isn't unexplained visual noise */}
                    <View style={styles.legendRow}>
                      <Text style={[styles.legendLabel, { color: subText }]}>Less</Text>
                      <View style={[styles.legendSwatch, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
                      <View style={[styles.legendSwatch, { backgroundColor: 'rgba(99, 102, 241, 0.35)' }]} />
                      <View style={[styles.legendSwatch, { backgroundColor: 'rgba(99, 102, 241, 0.65)' }]} />
                      <View style={[styles.legendSwatch, { backgroundColor: '#6366f1' }]} />
                      <Text style={[styles.legendLabel, { color: subText }]}>More</Text>
                    </View>

                    {Object.keys(contributions).length === 0 && (
                      <Text style={[styles.legendHint, { color: subText }]}>
                        Post consistently to light up your grid.
                      </Text>
                    )}
                  </>
                )}
              </View>

              {/* Scrollable Tabs Bar Selector */}
              {renderTabBar()}
            </>
          }
          data={
            activeTab === 'posts'
              ? posts
              : activeTab === 'reels'
                ? posts.filter((p) => !!p.video)
                : activeTab === 'saved'
                  ? savedPosts
                  : []
          }
          renderItem={({ item: post }) => {
            const thumb = getPreviewSource(post);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
                style={{ width: gridWidth, height: gridWidth, marginRight: 1, marginBottom: 1, position: 'relative', overflow: 'hidden', backgroundColor: isDark ? '#1e1e1e' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ flex: 1, padding: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: subText, fontSize: 10, fontStyle: 'italic', textAlign: 'center' }} numberOfLines={4}>
                      {post.caption || post.content || 'Text Post'}
                    </Text>
                  </View>
                )}
                {post.video && (
                  <View style={{ position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 }}>
                    <MaterialCommunityIcons name="video" size={14} color="#ffffff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          onEndReached={activeTab === 'posts' ? fetchMorePosts : undefined}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            activeTab === 'posts' && loadingMore ? (
              <View style={{ paddingVertical: 16, alignItems: 'center', width: '100%' }}>
                <ActivityIndicator size="small" color={primaryColor} />
              </View>
            ) : null
          }
          ListEmptyComponent={() => {
            if (activeTab === 'posts' || activeTab === 'reels' || activeTab === 'saved') {
              return (
                <View style={{ paddingVertical: 40, alignItems: 'center', width: '100%' }}>
                  <MaterialCommunityIcons name="camera-off-outline" size={48} color={subText} />
                  <Text style={{ color: subText, marginTop: 12, fontSize: 14 }}>
                    {activeTab === 'saved' ? 'No saved posts' : (isOwner ? "You haven't shared anything yet" : 'No posts shared yet')}
                  </Text>
                  {isOwner && activeTab === 'posts' && (
                    <TouchableOpacity
                      onPress={() => navigation.navigate('NewPost')}
                      style={{
                        marginTop: 16,
                        paddingHorizontal: 20,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: primaryColor,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 13 }}>
                        Share your first post
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            }
            if (activeTab === 'goals') return renderGoals();
            if (activeTab === 'graveyard') return renderGraveyard();
            if (activeTab === 'collabs') return renderCollabs();
            if (activeTab === 'analytics') return renderAnalytics();
            return null;
          }}
          contentContainerStyle={[styles.scrollContent, { paddingHorizontal: 16 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={['#808bf5']}
              tintColor={'#808bf5'}
            />
          }
        />
      )}

      {/* Edit Profile Modal */}
      <Modal
        visible={editVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20, gap: 12 }}>
              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Full Name</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={fullnameInput}
                onChangeText={setFullnameInput}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Username</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={usernameInput}
                onChangeText={setUsernameInput}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Bio</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={bioInput}
                onChangeText={setBioInput}
                multiline
                numberOfLines={3}
              />

              <Text style={{ color: subText, fontSize: 12, fontWeight: 'bold' }}>Profile Picture URL</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor: border, color: textColor }]}
                value={profilePicInput}
                onChangeText={setProfilePicInput}
              />
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: border }]}>
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: primaryColor }]}
                onPress={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {isOwner && <BottomNav currentTab="profile" navigation={navigation} />}
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
    paddingHorizontal: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    zIndex: 1,
  },
  headerLeftBtn: {
    padding: 4,
    zIndex: 2,
  },
  headerRightGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    zIndex: 2,
  },
  headerRightBtn: {
    padding: 4,
  },
  badgeWrapper: {
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#ff4b4b',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    zIndex: 10,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 80,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 45,
    marginBottom: 4,
  },
  fullname: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  username: {
    fontSize: 14,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    borderTopWidth: 1,
    borderTopColor: 'rgba(128, 128, 128, 0.15)',
    paddingTop: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 10,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridImage: {
    width: gridWidth,
    height: gridWidth,
    borderRadius: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  editAvatarBtn: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#808bf5',
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  bioText: {
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 18,
  },
  gamificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    marginTop: 4,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    width: '100%',
  },
  gamifyBadge: {
    flex: 1,
    alignItems: 'center',
  },
  gamifyDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(128, 128, 128, 0.2)',
  },
  gamifyLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#6b7280',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  gamifyVal: {
    fontSize: 14,
    fontWeight: '900',
  },
  statsGrid: {
    flexDirection: 'row',
    width: '100%',
  },
  statBox: {
    flexGrow: 1,
    alignItems: 'center',
  },
  statBoxNum: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  statBoxLabel: {
    fontSize: 9,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  consistencyCard: {
    padding: 10,
  },
  consistencyTitle: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 10,
  },
  legendSwatch: {
    width: 8,
    height: 8,
    borderRadius: 1.5,
  },
  legendLabel: {
    fontSize: 10,
    marginHorizontal: 2,
  },
  legendHint: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    alignItems: 'center',
  },
  saveBtn: {
    width: '100%',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});