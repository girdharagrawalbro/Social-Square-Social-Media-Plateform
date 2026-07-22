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
import { api, BASE_URL } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';

const { width } = Dimensions.get('window');

export default function CreatorInsightsScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { user } = useAuthStore() as any;
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async (isRefresh = false) => {
    if (!user?._id) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const res = await api.get(`/api/auth/analytics/${user._id}`);
      setAnalytics(res.data);
    } catch (err) {
      console.warn('Failed to fetch creator analytics:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [user?._id]);

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
  const cardBg = isDark ? '#111111' : '#f9fafb';
  const border = isDark ? '#1a1a1a' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';

  if (loading && !analytics) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: textColor }]}>Creator Insights</Text>
        </View>
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#808bf5" />
        </View>
      </SafeAreaView>
    );
  }

  const stats = analytics?.stats || { totalViews: 0, engagementRate: 0, totalPosts: 0 };
  const topPosts = analytics?.topPosts || [];

  // Custom visual representation bar values for categories
  const categoryViews = topPosts.reduce((acc: any, post: any) => {
    const views = post.views || 0;
    // Extract a mock topic or tag for chart
    const label = post.caption?.split(' ')?.[0]?.substring(0, 10) || 'Post';
    acc.push({ label, val: views });
    return acc;
  }, []).slice(0, 5);

  const maxVal = Math.max(...categoryViews.map((c: any) => c.val), 1);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Creator Insights</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchAnalytics(true)} colors={['#808bf5']} />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          {/* impressions */}
          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(128,139,245,0.08)' : 'rgba(128,139,245,0.05)', borderColor: 'rgba(128,139,245,0.15)' }]}>
            <Text style={styles.statLabel}>IMPRESSIONS</Text>
            <Text style={styles.statNumber}>{stats.totalViews.toLocaleString()}</Text>
            <Text style={[styles.statSub, { color: subText }]}>Total post views</Text>
          </View>

          {/* engagement */}
          <View style={[styles.statCard, { backgroundColor: isDark ? 'rgba(236,72,153,0.08)' : 'rgba(236,72,153,0.05)', borderColor: 'rgba(236,72,153,0.15)' }]}>
            <Text style={[styles.statLabel, { color: '#ec4899' }]}>ENGAGEMENT</Text>
            <Text style={[styles.statNumber, { color: '#ec4899' }]}>{stats.engagementRate}%</Text>
            <Text style={[styles.statSub, { color: subText }]}>Interaction rate</Text>
          </View>

          {/* posts */}
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.statLabel, { color: textColor }]}>TOTAL CONTENT</Text>
            <Text style={[styles.statNumber, { color: textColor }]}>{stats.totalPosts}</Text>
            <Text style={[styles.statSub, { color: subText }]}>Published posts</Text>
          </View>

          {/* average performance */}
          <View style={[styles.statCard, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.statLabel, { color: '#f59e0b' }]}>AVG. VIEWS</Text>
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{Math.round(stats.totalViews / (stats.totalPosts || 1))}</Text>
            <Text style={[styles.statSub, { color: subText }]}>Per published item</Text>
          </View>
        </View>

        {/* Visual Charts section */}
        {categoryViews.length > 0 && (
          <View style={[styles.chartSection, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>Content Distribution</Text>
            <Text style={[styles.sectionSubtitle, { color: subText }]}>Views by recent post tags/keywords</Text>

            <View style={styles.chartContainer}>
              {categoryViews.map((item: any, index: number) => {
                const percent = (item.val / maxVal) * 100;
                return (
                  <View key={index} style={styles.chartBarWrapper}>
                    <View style={styles.chartTrack}>
                      <View style={[styles.chartFill, { height: `${percent}%` }]} />
                    </View>
                    <Text style={[styles.chartBarLabel, { color: subText }]} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Hall of Fame */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>Hall of Fame</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Top Performers</Text>
          </View>
        </View>

        {topPosts.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="chart-bar-off" size={40} color={subText} />
            <Text style={[styles.emptyText, { color: subText }]}>
              No analytics details yet. Start sharing posts to see performance graphs.
            </Text>
          </View>
        ) : (
          <View style={styles.postsList}>
            {topPosts.map((post: any, index: number) => (
              <TouchableOpacity
                key={post.id}
                onPress={() => navigation.navigate('PostDetail', { postId: post.id })}
                style={[styles.postRow, { backgroundColor: cardBg, borderColor: border }]}
              >
                {/* Image / Icon */}
                <View style={[styles.postMediaContainer, { borderColor: border }]}>
                  {post.image ? (
                    <Image source={{ uri: resolveMediaUrl(post.image) }} style={styles.postThumbnail} />
                  ) : (
                    <View style={styles.postIconFallback}>
                      <MaterialCommunityIcons name="text-box-outline" size={24} color="#808bf5" />
                    </View>
                  )}
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>#{index + 1}</Text>
                  </View>
                </View>

                {/* Info details */}
                <View style={styles.postInfo}>
                  <Text style={[styles.postCaption, { color: textColor }]} numberOfLines={1}>
                    {post.caption || 'Untitled Post'}
                  </Text>
                  
                  <View style={styles.metricsRow}>
                    <View style={styles.metricItem}>
                      <MaterialCommunityIcons name="eye" size={14} color="#808bf5" />
                      <Text style={[styles.metricText, { color: subText }]}>{post.views.toLocaleString()}</Text>
                    </View>

                    <View style={styles.metricItem}>
                      <MaterialCommunityIcons name="heart" size={14} color="#ec4899" />
                      <Text style={[styles.metricText, { color: subText }]}>{post.likes.toLocaleString()}</Text>
                    </View>

                    <View style={styles.metricItem}>
                      <MaterialCommunityIcons name="comment" size={14} color="#3b82f6" />
                      <Text style={[styles.metricText, { color: subText }]}>{post.comments.toLocaleString()}</Text>
                    </View>
                  </View>
                </View>

                <MaterialCommunityIcons name="chevron-right" size={20} color={subText} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
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
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    padding: 4,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    width: (width - 44) / 2,
    borderRadius: 24,
    borderWidth: 1,
    padding: 16,
  },
  statLabel: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#808bf5',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  statNumber: {
    fontSize: 26,
    fontWeight: '900',
    color: '#808bf5',
    lineHeight: 30,
  },
  statSub: {
    fontSize: 11,
    marginTop: 4,
  },
  chartSection: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionSubtitle: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: 16,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    height: 120,
    alignItems: 'flex-end',
    paddingHorizontal: 10,
  },
  chartBarWrapper: {
    alignItems: 'center',
    width: 44,
  },
  chartTrack: {
    width: 14,
    height: 90,
    backgroundColor: 'rgba(128,139,245,0.06)',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  chartFill: {
    width: '100%',
    backgroundColor: '#808bf5',
    borderRadius: 7,
  },
  chartBarLabel: {
    fontSize: 9,
    marginTop: 6,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    backgroundColor: 'rgba(128,139,245,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#808bf5',
    fontSize: 10,
    fontWeight: 'bold',
  },
  postsList: {
    gap: 12,
  },
  postRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  postMediaContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  postThumbnail: {
    width: '100%',
    height: '100%',
  },
  postIconFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: '#808bf5',
    borderBottomRightRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  rankText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  postInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 6,
  },
  postCaption: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  metricItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 30,
  },
});
