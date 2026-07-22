import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  TextInput,
  Image,
  ActivityIndicator,
  useColorScheme,
  Alert,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import useAuthStore from '../store/zustand/useAuthStore';
import { api, BASE_URL } from '../lib/api';
import { getCache, setCache, invalidateCache, TTL } from '../lib/cache';

export default function CloseFriendsScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const loggedUser = useAuthStore((s: any) => s.user);
  const setUser = useAuthStore((s: any) => s.setUser);

  const [following, setFollowing] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const bg = isDark ? '#000000' : '#f1f5f9';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1a1a1a' : '#e2e8f0';

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

  const fetchFollowing = useCallback(async () => {
    if (!loggedUser?._id) return;
    const cacheKey = `follows_following_${loggedUser._id}_limit100`;
    const cached = await getCache<any[]>(cacheKey);
    if (cached) {
      setFollowing(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      // Fetch up to 100 followed users
      const res = await api.get(`/api/auth/following/${loggedUser._id}?limit=100`);
      const freshList = Array.isArray(res?.data?.users) ? res.data.users : [];
      setFollowing(freshList);
      await setCache(cacheKey, freshList, TTL.FOLLOWS_LIST);
    } catch (err) {
      console.warn('Fetch following list error:', err);
      if (!cached) {
        Alert.alert('Error', 'Failed to load following list.');
      }
    } finally {
      setLoading(false);
    }
  }, [loggedUser?._id]);

  useEffect(() => {
    fetchFollowing();
  }, [fetchFollowing]);

  const toggleCloseFriend = async (targetUserId: string) => {
    if (togglingId) return;
    setTogglingId(targetUserId);

    try {
      const res = await api.post(`/api/auth/close-friends/${targetUserId}/toggle`, {});
      const isCloseFriendNow = !!res?.data?.isCloseFriend;

      let currentCloseFriends = loggedUser?.closeFriends || [];
      if (isCloseFriendNow) {
        currentCloseFriends = [...currentCloseFriends, targetUserId];
      } else {
        currentCloseFriends = currentCloseFriends.filter(
          (id: any) => id?.toString() !== targetUserId.toString()
        );
      }

      await setUser({ ...loggedUser, closeFriends: currentCloseFriends });
      await invalidateCache(`profile_${loggedUser._id}`);
    } catch (err) {
      console.warn('Toggle close friend error:', err);
      Alert.alert('Error', 'Failed to update Close Friend status.');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredFollowing = following.filter((u) => {
    const q = searchQuery.toLowerCase();
    return (
      u.fullname?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q)
    );
  });

  const renderUserItem = ({ item }: { item: any }) => {
    const isCloseFriend = loggedUser?.closeFriends?.some(
      (id: any) => id?.toString() === item._id?.toString()
    );
    const isPending = togglingId === item._id;
    const avatarUrl = resolveMediaUrl(item.profile_picture);

    return (
      <View style={[styles.userRow, { borderColor }]}>
        <View style={styles.userInfo}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarPlaceholder, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
              <Text style={[styles.avatarInitial, { color: textColor }]}>
                {(item.fullname || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={[styles.fullname, { color: textColor }]} numberOfLines={1}>
              {item.fullname}
            </Text>
            {item.username && (
              <Text style={[styles.username, { color: '#808bf5' }]} numberOfLines={1}>
                @{item.username}
              </Text>
            )}
          </View>
        </View>

        <TouchableOpacity
          onPress={() => toggleCloseFriend(item._id)}
          disabled={isPending}
          style={styles.starBtn}
        >
          {isPending ? (
            <ActivityIndicator size="small" color="#22c55e" />
          ) : (
            <MaterialCommunityIcons
              name={isCloseFriend ? 'star' : 'star-outline'}
              size={26}
              color={isCloseFriend ? '#22c55e' : subColor}
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: borderColor, backgroundColor: cardBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Close Friends</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Input */}
      <View style={[styles.searchWrapper, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderColor }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={subColor} style={styles.searchIcon} />
          <TextInput
            placeholder="Search friends..."
            placeholderTextColor={subColor}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: textColor }]}
          />
        </View>
      </View>

      <FlatList
        data={filteredFollowing}
        keyExtractor={(item) => item._id}
        renderItem={renderUserItem}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#808bf5" style={{ marginTop: 40 }} />
          ) : (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons name="star-outline" size={48} color={subColor} />
              <Text style={{ marginTop: 8, color: subColor, fontSize: 13, fontWeight: '600' }}>
                No friends found.
              </Text>
            </View>
          )
        }
      />
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
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  backBtn: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
  },
  searchWrapper: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    paddingVertical: 0,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    marginLeft: 12,
    flex: 1,
  },
  fullname: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  username: {
    fontSize: 11,
    marginTop: 2,
  },
  starBtn: {
    padding: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
