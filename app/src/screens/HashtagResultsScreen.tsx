import { brand } from '../theme/colors';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Image,
  FlatList,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { api, BASE_URL } from '../lib/api';
import { useAppNavigation, useAppRoute } from '../navigation/types';
import { useTheme } from '../theme';

const { width } = Dimensions.get('window');
const gridWidth = (width - 4) / 3;

const resolveMediaUrl = (url?: string) => {
  if (!url) return undefined;
  if (url.startsWith('http://localhost:5000')) return url.replace('http://localhost:5000', BASE_URL);
  if (url.startsWith('/')) return `${BASE_URL}${url}`;
  return url;
};

const getPreviewSource = (post: any) => {
  const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
  const previewSrc = post.video ? (post.videoThumbnail || null) : (images.length > 0 ? images[0] : null);
  return resolveMediaUrl(previewSrc);
};

export default function HashtagResultsScreen() {
  const { colors, isDark } = useTheme();
  const route = useAppRoute<'HashtagResults'>();
  const navigation = useAppNavigation();
  const { tag } = route.params || {};

  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const bg = colors.background;
  const textColor = colors.text.primary;
  const subText = colors.text.secondary;
  const border = colors.border;

  const fetchPosts = async () => {
    if (!tag) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/post/hashtag/${encodeURIComponent(tag.replace(/^#/, ''))}`);
      setPosts(res.data.posts || []);
      setNextCursor(res.data.nextCursor || null);
      setHasMore(res.data.hasMore || false);
    } catch (e) {
      console.warn('Failed to load hashtag posts:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchMore = async () => {
    if (loadingMore || !hasMore || !nextCursor) return;
    setLoadingMore(true);
    try {
      const res = await api.get(`/api/post/hashtag/${encodeURIComponent(tag.replace(/^#/, ''))}?cursor=${nextCursor}`);
      setPosts((prev) => [...prev, ...(res.data.posts || [])]);
      setNextCursor(res.data.nextCursor || null);
      setHasMore(res.data.hasMore || false);
    } catch (e) {
      console.warn('Failed to load more hashtag posts:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tag]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      <View style={[styles.header, { borderBottomColor: border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{tag}</Text>
        <View style={styles.backBtn} />
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={brand.primary} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          numColumns={3}
          onEndReached={fetchMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={loadingMore ? (
            <View style={{ paddingVertical: 16, width: '100%', alignItems: 'center' }}>
              <ActivityIndicator size="small" color={brand.primary} />
            </View>
          ) : null}
          ListEmptyComponent={
            <View style={{ paddingVertical: 60, alignItems: 'center' }}>
              <MaterialCommunityIcons name="pound" size={40} color={subText} />
              <Text style={{ color: subText, marginTop: 10 }}>No posts found for {tag}</Text>
            </View>
          }
          renderItem={({ item: post, index }) => {
            const thumb = getPreviewSource(post);
            return (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('PostDetail', { postId: post._id, posts, initialIndex: index })}
                style={{ width: gridWidth, height: gridWidth, marginRight: 1, marginBottom: 1, backgroundColor: isDark ? '#1e1e1e' : '#f1f5f9', justifyContent: 'center', alignItems: 'center' }}
              >
                {thumb ? (
                  <Image source={{ uri: thumb }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ padding: 8, justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: subText, fontSize: 10, fontStyle: 'italic', textAlign: 'center' }} numberOfLines={4}>
                      {post.caption || 'Post'}
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
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: 'bold', flex: 1, textAlign: 'center' },
});
