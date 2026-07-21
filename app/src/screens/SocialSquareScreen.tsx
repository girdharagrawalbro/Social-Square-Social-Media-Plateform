import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useColorScheme,
  ActivityIndicator,
  SafeAreaView,
  RefreshControl,
  Alert,
  InteractionManager,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import StoriesStrip from './components/StoriesStrip';
import { PostItem } from './components/PostItem';
import { PostSkeleton } from './components/SkeletonLoader';
import { api } from '../lib/api';
import { getCache, setCache, invalidateCache, invalidateCacheByPrefix, TTL } from '../lib/cache';
import { appChannel } from '../lib/broadcast';
import useAuthStore from '../store/zustand/useAuthStore';
import { useTabStore } from '../store/zustand/useTabStore';
import BottomNav from './components/BottomNav';

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 40,
  minimumViewTime: 250,
};

export default function SocialSquareScreen({ navigation }: any) {
  const { currentTab } = useTabStore();
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
      InteractionManager.runAfterInteractions(() => {
        fetchUnreadCount();
      });
    }, [])
  );
  const isDark = useColorScheme() === 'dark';
  const { logout, user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewableItems, setViewableItems] = useState<string[]>([]);

  const onViewableItemsChanged = useRef(({ viewableItems: visible }: any) => {
    setViewableItems(visible.map((item: any) => item.key));
  }).current;

  const fetchFeed = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
      await invalidateCacheByPrefix('feed_page_');
    } else {
      // Load page 1 from cache instantly on mount
      const cached = await getCache<any[]>('feed_page_1');
      if (cached && cached.length > 0) {
        setPosts(cached);
      } else {
        setLoading(true);
      }
    }

    try {
      const res = await api.get('/api/recommendation/posts');
      const items = res.data.items || res.data.posts || res.data || [];
      const cursor = res.data.nextCursor || null;
      const more = res.data.hasMore !== undefined ? res.data.hasMore : items.length >= 20;

      setPosts(items);
      setNextCursor(cursor);
      setHasMore(more);
      setCurrentPage(1);
      setIsOffline(false);

      // Persist page 1 to cache
      await setCache('feed_page_1', items, TTL.FEED);
      fetchUnreadCount();
    } catch (e: any) {
      console.warn('Failed to fetch feed:', e);
      setIsOffline(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchMoreFeed = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);

    const nextPage = currentPage + 1;
    const cacheKey = `feed_page_${nextPage}`;

    // Load next page from cache first if available
    const cached = await getCache<any[]>(cacheKey);
    if (cached && cached.length > 0) {
      setPosts((prev) => [...prev, ...cached]);
      setCurrentPage(nextPage);
      setLoadingMore(false);
      return;
    }

    try {
      const res = await api.get(`/api/recommendation/posts?cursor=${nextCursor}`);
      const items = res.data.items || res.data.posts || res.data || [];
      const cursor = res.data.nextCursor || null;
      const more = res.data.hasMore !== undefined ? res.data.hasMore : items.length >= 20;

      if (items.length > 0) {
        setPosts((prev) => [...prev, ...items]);
        setNextCursor(cursor);
        setHasMore(more);
        setCurrentPage(nextPage);

        // Cache page-by-page
        await setCache(cacheKey, items, TTL.FEED);
      } else {
        setHasMore(false);
      }
      setIsOffline(false);
    } catch (e) {
      console.warn('Failed to fetch more feed:', e);
      setIsOffline(true);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      fetchFeed();
    });

    // Listen to post creation event
    const unsub = appChannel.on('POST_CREATED', (data: any) => {
      if (data?.post) {
        setPosts((prev) => [data.post, ...prev]);
        
        // Update first page cache asynchronously
        getCache<any[]>('feed_page_1').then((cached) => {
          const updated = cached ? [data.post, ...cached] : [data.post];
          setCache('feed_page_1', updated, TTL.FEED);
        });
      }
    });

    return () => unsub();
  }, []);

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const border = isDark ? '#1a1a1a' : '#e5e7eb';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, paddingHorizontal: 12 }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.navigate('NewPost')}>
            <MaterialCommunityIcons name="plus" size={26} color={isDark ? '#f3f4f6' : '#1f2937'} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Communities')}>
            <MaterialCommunityIcons name="account-group-outline" size={25} color={isDark ? '#f3f4f6' : '#1f2937'} />
          </TouchableOpacity>
        </View>

        <Text style={styles.headerLogo}>Social Square</Text>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <TouchableOpacity onPress={() => navigation.navigate('Chatbot')}>
            <MaterialCommunityIcons name="robot-outline" size={24} color="#808bf5" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate('Notifications')}>
            <View style={styles.chatIconWrapper}>
              {unreadNotificationsCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadNotificationsCount}</Text>
                </View>
              )}
              <MaterialCommunityIcons name="bell-outline" size={24} color="#808bf5" />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {loading && posts.length === 0 ? (
        <View style={{ flex: 1 }}>
          <PostSkeleton />
          <PostSkeleton />
          <PostSkeleton />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          renderItem={({ item }) => (
            <PostItem 
              post={item} 
              isDark={isDark} 
              isVisible={viewableItems.includes(item._id) && currentTab === 'feed'} 
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          ListHeaderComponent={<StoriesStrip />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchFeed(true)} colors={['#808bf5']} />
          }
          onEndReached={fetchMoreFeed}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <ActivityIndicator size="small" color="#808bf5" style={styles.loader} />
          ) : null}
          ListEmptyComponent={
            <View style={styles.emptyView}>
              {isOffline ? (
                <>
                  <MaterialCommunityIcons name="wifi-off" size={40} color={isDark ? '#4b5563' : '#9ca3af'} />
                  <Text style={{ color: isDark ? '#6b7280' : '#9ca3af', marginTop: 12, textAlign: 'center' }}>
                    {"You're offline. Pull down to retry."}
                  </Text>
                </>
              ) : (
                <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>No posts available.</Text>
              )}
            </View>
          }
          contentContainerStyle={styles.listContent}
        />
      )}

      <BottomNav currentTab="feed" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor:'#000000',
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  headerLogo: {
    fontSize: 22,
    fontWeight: '800',
    color: '#808bf5',
    letterSpacing: -0.5,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
  },
  chatIconWrapper: {
    padding: 4,
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#ef4444',
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  bellBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: 'black',
  },
  listContent: {
    paddingBottom: 80,
  },
  loader: {
    marginVertical: 40,
  },
  emptyView: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
});
