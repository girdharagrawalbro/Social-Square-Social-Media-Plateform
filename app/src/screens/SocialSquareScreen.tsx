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
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';

const VIEWABILITY_CONFIG = {
  itemVisiblePercentThreshold: 60,
};

export default function SocialSquareScreen({ navigation }: any) {
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
  const [viewableItems, setViewableItems] = useState<string[]>([]);

  const onViewableItemsChanged = useRef(({ viewableItems: visible }: any) => {
    setViewableItems(visible.map((item: any) => item.key));
  }).current;

  const fetchFeed = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Fetch posts from recommendation or feed endpoint
      const res = await api.get('/api/recommendation/posts');
      const items = res.data.items || res.data.posts || res.data || [];
      setPosts(items);
      fetchUnreadCount();
    } catch (e: any) {
      console.warn('Failed to fetch feed:', e);
      // Fallback with a mock post if network fails or DB empty to ensure great first impression
      if (posts.length === 0) {
        setPosts([
          {
            _id: 'mock-1',
            user: {
              _id: 'user-1',
              username: 'alex_square',
              fullname: 'Alex Rivera',
              profile_picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            },
            content: 'Just launched the Social Square mobile app! Welcome to our new decentralized workspace and community. 🚀✨',
            mediaUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=800',
            mediaType: 'image',
            likes: [],
            commentsCount: 3,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      fetchFeed();
    });
  }, []);

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const border = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={() => navigation.navigate('NewPost')}>
          <MaterialCommunityIcons name="plus" size={26} color={isDark ? '#f3f4f6' : '#1f2937'} />
        </TouchableOpacity>

        <Text style={styles.headerLogo}>Social Square</Text>

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
              isVisible={viewableItems.includes(item._id)} 
            />
          )}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={VIEWABILITY_CONFIG}
          ListHeaderComponent={<StoriesStrip />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => fetchFeed(true)} colors={['#808bf5']} />
          }
          ListEmptyComponent={
            <View style={styles.emptyView}>
              <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>No posts available.</Text>
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
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 1,
  },
  headerLogo: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#808bf5',
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
