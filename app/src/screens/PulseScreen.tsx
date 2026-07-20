import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import BottomNav from './components/BottomNav';
import { api, BASE_URL } from '../lib/api';

const { width } = Dimensions.get('window');

export default function PulseScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const [pulseData, setPulseData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrending = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get('/api/post/trending');
      setPulseData(res.data);
    } catch (err) {
      console.warn('Failed to fetch trending pulse:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchTrending();
    
    // Refresh trending every 30 seconds automatically
    const interval = setInterval(() => {
      fetchTrending(true);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

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

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#121212' : '#f9fafb';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { backgroundColor: bg, borderBottomColor: border }]}>
        <View style={styles.headerInfo}>
          <View style={styles.pulseBadge}>
            <MaterialCommunityIcons name="flash" size={18} color="#808bf5" />
            <Text style={[styles.headerTitle, { color: textColor }]}>Social Pulse</Text>
          </View>
          <Text style={[styles.headerSub, { color: subText }]}>Live trending updates from Social Square</Text>
        </View>
      </View>

      {loading && !pulseData ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#808bf5" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchTrending(true)} colors={['#808bf5']} />
          }
        >
          {/* Section 1: Trending Tags */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              <MaterialCommunityIcons name="tag-outline" size={18} color="#ec4899" /> Trending Tags
            </Text>
            <View style={styles.tagsContainer}>
              {pulseData?.hashtags && pulseData.hashtags.length > 0 ? (
                pulseData.hashtags.map((h: any, idx: number) => (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.tagCard, { backgroundColor: cardBg, borderColor: border }]}
                    activeOpacity={0.7}
                    onPress={() => navigation.navigate('Explore', { searchQuery: h.tag.substring(1) })}
                  >
                    <View style={styles.tagInfo}>
                      <Text style={[styles.tagText, { color: textColor }]}>{h.tag}</Text>
                      <Text style={[styles.tagSub, { color: subText }]}>{h.count} posts this week</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={subText} />
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: subText }]}>No trending tags found.</Text>
              )}
            </View>
          </View>

          {/* Section 2: Rising Stars */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              <MaterialCommunityIcons name="star-outline" size={18} color="#f59e0b" /> Rising Stars
            </Text>
            <View style={styles.creatorsContainer}>
              {pulseData?.topUsers && pulseData.topUsers.length > 0 ? (
                pulseData.topUsers.map((u: any, idx: number) => {
                  const avatarUrl = resolveMediaUrl(u.user?.profile_picture);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.creatorCard, { backgroundColor: cardBg, borderColor: border }]}
                      activeOpacity={0.7}
                      onPress={() => navigation.navigate('Profile', { userId: u.user?._id })}
                    >
                      <View style={styles.creatorInfo}>
                        {avatarUrl ? (
                          <Image source={{ uri: avatarUrl }} style={styles.creatorAvatar} />
                        ) : (
                          <View style={styles.avatarFallback}>
                            <Text style={styles.avatarText}>
                              {(u.user?.fullname || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.creatorName, { color: textColor }]} numberOfLines={1}>
                            {u.user?.fullname}
                          </Text>
                          <Text style={[styles.creatorUser, { color: subText }]} numberOfLines={1}>
                            @{u.user?.username}
                          </Text>
                        </View>
                        <View style={styles.statsWrapper}>
                          <Text style={styles.statVal}>{u.totalLikes || 0}</Text>
                          <Text style={styles.statLabel}>LIKES</Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <Text style={[styles.emptyText, { color: subText }]}>No trending stars found.</Text>
              )}
            </View>
          </View>

          {/* Section 3: Hot Categories */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              <MaterialCommunityIcons name="shape-outline" size={18} color="#3b82f6" /> Hot Categories
            </Text>
            <View style={styles.categoryGrid}>
              {pulseData?.categories && pulseData.categories.length > 0 ? (
                pulseData.categories.map((c: any, idx: number) => (
                  <View key={idx} style={[styles.categoryCard, { backgroundColor: cardBg, borderColor: border }]}>
                    <Text style={[styles.categoryName, { color: textColor }]} numberOfLines={1}>
                      {c._id || 'General'}
                    </Text>
                    <Text style={[styles.categoryMeta, { color: subText }]}>
                      🔥 {c.totalLikes || 0} likes • 📁 {c.postCount || 0} posts
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={[styles.emptyText, { color: subText }]}>No categories found.</Text>
              )}
            </View>
          </View>
        </ScrollView>
      )}

      <BottomNav currentTab="pulse" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  headerInfo: {
    justifyContent: 'center',
  },
  pulseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  headerSub: {
    fontSize: 11,
    marginTop: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tagsContainer: {
    gap: 10,
  },
  tagCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagInfo: {
    flex: 1,
  },
  tagText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  tagSub: {
    fontSize: 11,
    marginTop: 2,
  },
  creatorsContainer: {
    gap: 10,
  },
  creatorCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
  },
  creatorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  creatorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#808bf520',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#808bf5',
  },
  creatorName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  creatorUser: {
    fontSize: 11,
    marginTop: 2,
  },
  statsWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  statVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#808bf5',
  },
  statLabel: {
    fontSize: 8,
    color: '#808bf5',
    fontWeight: 'bold',
    marginTop: 2,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: (width - 42) / 2,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  categoryName: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  categoryMeta: {
    fontSize: 10,
    marginTop: 4,
  },
  emptyText: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingVertical: 10,
  },
});
