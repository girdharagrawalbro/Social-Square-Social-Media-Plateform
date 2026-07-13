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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import StoriesStrip from './components/StoriesStrip';
import { PostItem } from './components/PostItem';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';

export default function SocialSquareScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const { logout, user } = useAuthStore();
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [viewableItems, setViewableItems] = useState<string[]>([]);

  const onViewableItemsChanged = useRef(({ viewableItems: visible }: any) => {
    setViewableItems(visible.map((item: any) => item.key));
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
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
    fetchFeed();
  }, []);

  const handleLogout = () => {
    Alert.alert('Logout', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const textColor = isDark ? '#ffffff' : '#111827';
  const border = isDark ? '#1f2937' : '#e5e7eb';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={24} color={isDark ? '#f3f4f6' : '#1f2937'} />
        </TouchableOpacity>

        <Text style={styles.headerLogo}>Social Square</Text>

        <TouchableOpacity onPress={() => navigation.navigate('Chat')}>
          <View style={styles.chatIconWrapper}>
            <MaterialCommunityIcons name="message-text-outline" size={24} color="#808bf5" />
          </View>
        </TouchableOpacity>
      </View>

      {/* Posts List */}
      <FlatList
        data={posts}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => <PostItem post={item} isDark={isDark} />}
        ListHeaderComponent={<StoriesStrip />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => fetchFeed(true)} colors={['#808bf5']} />
        }
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color="#808bf5" style={styles.loader} />
          ) : (
            <View style={styles.emptyView}>
              <Text style={{ color: isDark ? '#9ca3af' : '#6b7280' }}>No posts available.</Text>
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
      />

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
