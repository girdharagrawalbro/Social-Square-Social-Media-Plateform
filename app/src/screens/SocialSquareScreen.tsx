import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from '@react-navigation/native';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import StoriesStrip from './components/StoriesStrip';
import MoodFeedToggle from './components/MoodFeedToggle';
import { PostItem } from './components/PostItem';
import { PostSkeleton } from './components/SkeletonLoader';
import { api } from '../lib/api';
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
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(false);
  const [viewableItems, setViewableItems] = useState<string[]>([]);
  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [showHeader, setShowHeader] = useState(true);
  const lastOffsetY = useRef(0);

  const handleScroll = (event: any) => {
    const currentOffsetY = event.nativeEvent.contentOffset.y;
    const diff = currentOffsetY - lastOffsetY.current;
    if (currentOffsetY <= 0) {
      setShowHeader(true);
    } else if (Math.abs(diff) > 15) {
      if (diff > 0 && showHeader) {
        setShowHeader(false);
      } else if (diff < 0 && !showHeader) {
        setShowHeader(true);
      }
    }
    lastOffsetY.current = currentOffsetY;
  };

  const onViewableItemsChanged = useRef(({ viewableItems: visible }: any) => {
    setViewableItems(visible.map((item: any) => item.key));
  }).current;

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isRefetching,
    refetch,
    isError
  } = useInfiniteQuery({
    queryKey: ['feed', activeMood],
    queryFn: async ({ pageParam = null }) => {
      try {
        const endpoint = activeMood
          ? `/api/ai/mood-feed?mood=${activeMood}`
          : `/api/recommendation/posts${pageParam ? `?cursor=${pageParam}` : ''}`;
        const res = await api.get(endpoint);
        const items = res.data.posts || res.data.items || res.data || [];
        const cursor = res.data.nextCursor || null;
        const more = activeMood ? false : (res.data.hasMore !== undefined ? res.data.hasMore : items.length >= 20);
        setIsOffline(false);
        return { items, nextCursor: more ? cursor : null };
      } catch (e) {
        setIsOffline(true);
        throw e;
      }
    },
    getNextPageParam: (lastPage) => lastPage?.nextCursor || undefined,
    initialPageParam: null as string | null,
  });

  const posts = data?.pages.flatMap((page) => page.items) || [];
  const loading = isLoading;
  const refreshing = isRefetching && !isFetchingNextPage;
  const loadingMore = isFetchingNextPage;
  const hasMore = hasNextPage;

  const fetchFeed = async (isRefresh = false) => {
    if (isRefresh) {
      // react-query v5's refetch() on an infinite query re-fetches EVERY loaded page —
      // 10 pages deep, that's 10 sequential requests, and it can silently rewrite posts
      // far below the viewport. Truncate to just the first page before refetching so a
      // pull-to-refresh only reloads the top, like Instagram; scrolling back down
      // re-paginates naturally from the freshly refetched page 1's cursor.
      queryClient.setQueryData(['feed', activeMood], (old: any) => {
        if (!old?.pages?.length) return old;
        return { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) };
      });
      await refetch();
    }
  };

  const fetchMoreFeed = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleMoodSelect = useCallback((mood: string) => {
    setActiveMood(mood);
  }, []);

  const handleClearMood = useCallback(() => {
    setActiveMood(null);
  }, []);

  useEffect(() => {
    // Listen to post creation event
    const unsub = appChannel.on('POST_CREATED', (data: any) => {
      if (data?.post) {
        queryClient.setQueryData(['feed', activeMood], (oldData: any) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any, index: number) => {
              if (index === 0) {
                return { ...page, items: [data.post, ...page.items] };
              }
              return page;
            })
          };
        });
      }
    });

    return () => unsub();
  }, [activeMood, queryClient]);

  const bg = isDark ? '#000000' : '#ffffff';
  const cardBg = isDark ? '#000000' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const border = isDark ? '#1a1a1a' : '#e5e7eb';

  // Stable reference unless `posts` itself changes — without this, every unrelated
  // re-render (header show/hide, viewability tracking, notification count) built a
  // brand-new array, forcing FlatList to re-diff every mounted row for no reason.
  const listData = useMemo(
    () => [{ _id: 'mood_selector', type: 'mood_selector' } as any, ...posts],
    [posts]
  );

  const renderItem = useCallback(({ item }: any) => {
    if (item.type === 'mood_selector') {
      return (
        <View style={{ backgroundColor: bg }}>
          <MoodFeedToggle
            activeMood={activeMood}
            onMoodSelect={handleMoodSelect}
            onClear={handleClearMood}
          />
        </View>
      );
    }
    return (
      <PostItem
        post={item}
        isDark={isDark}
        isVisible={viewableItems.includes(item._id) && currentTab === 'feed'}
      />
    );
  }, [bg, activeMood, handleMoodSelect, handleClearMood, isDark, viewableItems, currentTab]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, paddingHorizontal: 12, height: showHeader ? 56 : 0, opacity: showHeader ? 1 : 0, overflow: 'hidden' }]}>
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
          data={listData}
          keyExtractor={(item) => item._id}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={5}
          stickyHeaderIndices={[1]}
          renderItem={renderItem}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          ListHeaderComponent={
            <StoriesStrip />
          }
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
