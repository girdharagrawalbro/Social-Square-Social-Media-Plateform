import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  Image,
  Dimensions,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TouchableWithoutFeedback,
  Animated,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
const VideoComponent = Video as any;
import BottomNav from './components/BottomNav';
import ShareModal from './components/ShareModal';
import { api, BASE_URL } from '../lib/api';
import { getCache, setCache, TTL } from '../lib/cache';
import useAuthStore from '../store/zustand/useAuthStore';
import { useTabStore } from '../store/zustand/useTabStore';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../theme';
import type { TabOrStackScreenProps } from '../navigation/types';

const { width, height } = Dimensions.get('window');
const gridWidth = (width - 6) / 3;

function SkeletonSearch() {
  const { colors, spacing, radius } = useTheme();
  const skeletonBg = colors.border;

  return (
    <View style={{ padding: spacing.lg }}>
      {/* People Skeleton */}
      <View style={{ marginBottom: spacing.xl }}>
        <View style={{ width: 80, height: 12, backgroundColor: skeletonBg, borderRadius: radius.sm, marginBottom: spacing.md }} />
        {[1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: skeletonBg, marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: '40%', height: 14, backgroundColor: skeletonBg, borderRadius: radius.sm, marginBottom: spacing.sm }} />
              <View style={{ width: '60%', height: 10, backgroundColor: skeletonBg, borderRadius: radius.sm }} />
            </View>
          </View>
        ))}
      </View>

      {/* AI Results Skeleton */}
      <View>
        <View style={{ width: 120, height: 12, backgroundColor: skeletonBg, borderRadius: radius.sm, marginBottom: spacing.md }} />
        {[1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.surface, marginBottom: spacing.md }}>
            <View style={{ width: 48, height: 48, borderRadius: radius.sm, backgroundColor: skeletonBg, marginRight: spacing.md }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: '80%', height: 14, backgroundColor: skeletonBg, borderRadius: radius.sm, marginBottom: spacing.sm }} />
              <View style={{ width: '50%', height: 10, backgroundColor: skeletonBg, borderRadius: radius.sm }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ExploreScreen({ navigation, route }: TabOrStackScreenProps<'Explore'>) {
  const { colors, spacing, radius, typography, shadows, isDark } = useTheme();
  const isFocused = useIsFocused();
  const { currentTab } = useTabStore();
  const loggedUser = useAuthStore((s) => s.user);

  // States
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  // Advanced Search States
  // Seeded from route.params.searchQuery (e.g. tapping a trending tag on Pulse)
  // instead of always starting blank — this param used to be sent but silently
  // dropped since ExploreScreen never read `route` at all.
  const [search, setSearch] = useState(route?.params?.searchQuery || '');
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[] }>({ users: [], posts: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(!!route?.params?.searchQuery);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);


  // Styling colors (theme tokens)
  const bg = colors.background;
  const headerBg = colors.surface;
  const inputBg = colors.background;
  const textColor = colors.text.primary;
  const cardBg = colors.surface;
  const border = colors.border;
  const subTextColor = colors.text.secondary;

  // Helper to resolve media URLs
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

  // Fetch Reels — cache-first for instant grid display
  const fetchReels = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      // Show cached reels immediately while API loads
      const cached = await getCache<any[]>('explore_reels');
      if (cached && cached.length > 0) {
        setReels(cached);
        setLoading(false);
      } else {
        setLoading(true);
      }
    }

    try {
      const params = new URLSearchParams();
      const currentCursor = isRefresh ? null : cursor;
      if (currentCursor) params.append('cursor', currentCursor);

      const res = await api.get(`/api/post/explore-reels?${params.toString()}`);
      const posts = res.data.posts || res.data.items || [];
      const nextCursor = res.data.nextCursor || null;
      const resHasMore = res.data.hasMore ?? false;

      if (isRefresh) {
        setReels(posts);
        await setCache('explore_reels', posts, TTL.EXPLORE);
      } else {
        setReels((prev) => {
          const combined = [...prev, ...posts];
          // deduplicate
          const unique = combined.filter(
            (v, i, a) => a.findIndex((t) => t._id === v._id) === i
          );
          // cache the full accumulated list
          setCache('explore_reels', unique, TTL.EXPLORE);
          return unique;
        });
      }

      setCursor(nextCursor);
      setHasMore(resHasMore);
    } catch (e) {
      console.warn('Failed to fetch explore reels:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchReels(true);
  }, []);

  // Load categories and recent searches on mount
  useEffect(() => {
    const initData = async () => {
      try {
        const stored = await AsyncStorage.getItem('recentSearches');
        if (stored) {
          setRecentSearches(JSON.parse(stored));
        }
        const catRes = await api.get('/api/post/categories');
        setCategories(catRes.data || []);
      } catch (err) {
        console.warn('Failed to load init search data:', err);
      }
    };
    initData();
  }, []);

  const saveRecentSearch = async (item: any) => {
    if (!item) return;
    const itemId = typeof item === 'object' ? (item._id || item.id) : item;
    const filtered = recentSearches.filter(r => {
      const rId = typeof r === 'object' ? (r._id || r.id) : r;
      return rId !== itemId;
    });
    const updated = [item, ...filtered].slice(0, 8);
    setRecentSearches(updated);
    try {
      await AsyncStorage.setItem('recentSearches', JSON.stringify(updated));
    } catch (e) {
      console.warn(e);
    }
  };

  const clearRecentSearches = async () => {
    setRecentSearches([]);
    try {
      await AsyncStorage.removeItem('recentSearches');
    } catch (e) {
      console.warn(e);
    }
  };

  const performSearch = async (query: string, filter: string = 'all') => {
    const trimmed = query.trim();
    if (!trimmed) {
      setSearchResults({ users: [], posts: [] });
      setAiResults([]);
      setAiAnswer(null);
      return;
    }
    setSearchLoading(true);
    setAiAnswer(null);
    try {
      const res = await api.post('/api/auth/search', { query: trimmed });
      const results = {
        users: res.data?.users || [],
        posts: res.data?.posts || [],
      };
      setSearchResults(results);

      setIsAiLoading(true);
      const aiRes = await api.get('/api/recommendation/search', {
        params: { q: trimmed, typeFilter: filter }
      });
      const items = aiRes.data?.items || [];
      setAiResults(items);

      if (items.length > 0) {
        const topIds = items.slice(0, 3).map((r: any) => r._id);
        const synthRes = await api.post('/api/recommendation/search/synthesize', {
          q: trimmed,
          itemIds: topIds,
        });
        setAiAnswer(synthRes.data?.answer || null);
      }
    } catch (e) {
      console.warn('Advanced search failed:', e);
    } finally {
      setSearchLoading(false);
      setIsAiLoading(false);
    }
  };

  // Debounce search query
  useEffect(() => {
    const trimmed = search.trim();
    if (!trimmed) {
      setSearchResults({ users: [], posts: [] });
      setAiResults([]);
      setAiAnswer(null);
      return;
    }
    const timer = setTimeout(() => {
      performSearch(search, typeFilter);
    }, 450);
    return () => clearTimeout(timer);
  }, [search, typeFilter]);

  const blendedUsers = useMemo(() => {
    const remoteUsers = searchResults.users || [];
    const term = search.toLowerCase().trim();
    const localUserMatches = recentSearches.filter(item => {
      if (typeof item === 'object') {
        return (item.fullname?.toLowerCase().includes(term)) ||
          (item.username?.toLowerCase().includes(term));
      }
      return false;
    });

    const combined = [...localUserMatches];
    const seenIds = new Set(combined.map(u => u._id));

    remoteUsers.forEach(u => {
      if (!seenIds.has(u._id)) {
        combined.push(u);
        seenIds.add(u._id);
      }
    });

    return combined;
  }, [searchResults.users, recentSearches, search]);

  // Opens the shared full-screen Reels viewer (same one used by the Reels tab and
  // Profile's reels grid) at a specific index, instead of a separate in-screen modal
  // that duplicated its own fetch/pagination/player state.
  const openReel = (index: number) => {
    navigation.navigate('Reels', { posts: reels, initialIndex: index });
  };

  // Render Grid Item
  const renderGridItem = ({ item, index }: { item: any; index: number }) => {
    const thumbUrl = resolveMediaUrl(item.videoThumbnail || item.video);

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => openReel(index)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={item.likes ? `Play reel, ${item.likes.length} likes` : 'Play reel'}
      >
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.gridImage} resizeMode="cover" />
        ) : (
          <View style={[styles.gridImage, styles.placeholderGridBg, { backgroundColor: colors.surfaceElevated }]}>
            <MaterialCommunityIcons name="video" size={30} color={colors.primary} />
          </View>
        )}
        <View style={styles.gridOverlay}>
          {/* Overlays a translucent scrim on the video thumbnail itself, not the app surface,
              so it stays white in both themes for contrast against the media. */}
          <MaterialCommunityIcons name="play" size={18} color="#ffffff" />
          {item.likes && (
            <Text style={styles.gridOverlayText}>{item.likes.length}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  // Render Search Result Item
  const renderSearchResultItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={[styles.searchResultItem, { borderBottomColor: border }]}
        onPress={() => {
          if (item._id) {
            navigation.navigate('Profile', { userId: item._id });
          }
        }}
      >
        {item.profile_picture ? (
          <Image source={{ uri: item.profile_picture }} style={styles.searchAvatar} />
        ) : (
          <View style={styles.searchAvatarFallback}>
            <Text style={styles.searchAvatarText}>
              {(item.fullname || item.username || '?')[0].toUpperCase()}
            </Text>
          </View>
        )}
        <View style={styles.searchDetails}>
          <Text style={[styles.searchFullname, { color: textColor }]}>
            {item.fullname || 'Social Square User'}
          </Text>
          <Text style={[styles.searchUsername, { color: subTextColor }]}>
            @{item.username || 'user'}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={subTextColor} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Main Header */}
      <View style={{ height: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, backgroundColor: cardBg, borderBottomWidth: 1, borderBottomColor: border, ...shadows.card }}>
        <TouchableOpacity
          onPress={() => navigation.navigate('NewPost')}
          style={{ width: 40, height: 40, borderRadius: radius.full, justifyContent: 'center', alignItems: 'flex-start' }}
          accessibilityRole="button"
          accessibilityLabel="Create new post"
        >
          <MaterialCommunityIcons name="plus" size={26} color={textColor} style={{ marginLeft: -6 }} />
        </TouchableOpacity>

        <Text style={{ ...typography.h3, color: textColor }}>
          {loggedUser?.username ? `@${loggedUser.username}` : 'Explore'}
        </Text>

        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={{ width: 40, height: 40, borderRadius: radius.full, justifyContent: 'center', alignItems: 'flex-end' }}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          <View style={{ position: 'relative' }}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={colors.primary} style={{ marginRight: -6 }} />
          </View>
        </TouchableOpacity>
      </View>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: headerBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg }]}>
        {isSearchActive && (
          <TouchableOpacity
            onPress={() => { setIsSearchActive(false); setSearch(''); }}
            style={{ marginRight: spacing.sm }}
            accessibilityRole="button"
            accessibilityLabel="Close search"
          >
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBar, { backgroundColor: inputBg, flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: radius.full, paddingHorizontal: spacing.md, height: 40 }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.text.muted} />
          <TextInput
            placeholder="Search users, posts, categories..."
            placeholderTextColor={colors.text.muted}
            style={[styles.input, { color: textColor, flex: 1, paddingVertical: 0, marginLeft: spacing.sm }]}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsSearchActive(true)}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity
              onPress={() => setSearch('')}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <MaterialCommunityIcons name="close-circle" size={18} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>

        {!isSearchActive && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginLeft: spacing.md }}>
            <TouchableOpacity
              onPress={() => navigation.navigate('Pulse')}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : 'rgba(236, 72, 153, 0.1)',
                justifyContent: 'center',
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Pulse — trending"
            >
              <MaterialCommunityIcons name="flash" size={20} color={colors.like} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Knowledge')}
              style={{
                width: 36,
                height: 36,
                borderRadius: radius.full,
                backgroundColor: isDark ? 'rgba(128, 139, 245, 0.15)' : colors.primaryTint,
                justifyContent: 'center',
                alignItems: 'center',
              }}
              accessibilityRole="button"
              accessibilityLabel="Knowledge Center"
            >
              <MaterialCommunityIcons name="book-open-variant" size={20} color={colors.primary} />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Main Content Area */}
      {isSearchActive ? (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* Filter Chips (only when user has typed something) */}
          {search.trim().length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm }}>
              {['all', 'tutorial', 'discussion', 'beginner', 'comments'].map(tf => (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTypeFilter(tf)}
                  style={{
                    paddingHorizontal: spacing.lg,
                    paddingVertical: spacing.sm,
                    borderRadius: radius.full,
                    borderWidth: 1,
                    borderColor: typeFilter === tf ? colors.primary : border,
                    // Chip fill is the solid accent color when selected, which stays the same
                    // hue in both themes, so its label stays literal white for contrast.
                    backgroundColor: typeFilter === tf ? colors.primary : (isDark ? colors.surfaceElevated : colors.background),
                    marginRight: spacing.sm,
                  }}
                >
                  <Text style={{ ...typography.caption, color: typeFilter === tf ? '#ffffff' : subTextColor, textTransform: 'uppercase' }}>{tf}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* SKELETON LOADER while searching */}
          {searchLoading && blendedUsers.length === 0 ? (
            <SkeletonSearch />
          ) : search.trim().length === 0 ? (
            // Empty search layout: recent searches & categories
            <>
              {/* Recent searches */}
              {recentSearches.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: 1 }}>Recent Searches</Text>
                    <TouchableOpacity onPress={clearRecentSearches}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#808bf5' }}>CLEAR ALL</Text>
                    </TouchableOpacity>
                  </View>
                  {recentSearches.map((item, index) => {
                    const isUser = typeof item === 'object';
                    return (
                      <TouchableOpacity
                        key={index}
                        onPress={() => {
                          if (isUser) {
                            saveRecentSearch(item);
                            setIsSearchActive(false);
                            navigation.navigate('Profile', { userId: item._id });
                          } else {
                            setSearch(item);
                            performSearch(item, typeFilter);
                          }
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10 }}
                      >
                        {isUser ? (
                          <>
                            <Image source={{ uri: item.profile_picture || 'https://via.placeholder.com/150' }} style={{ width: 36, height: 36, borderRadius: 18, marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }}>{item.fullname}</Text>
                              <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#808bf5' }}>@{item.username}</Text>
                            </View>
                          </>
                        ) : (
                          <>
                            <MaterialCommunityIcons name="clock-outline" size={20} color={subTextColor} style={{ marginRight: 12 }} />
                            <Text style={{ fontSize: 14, color: textColor }}>{item}</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Categories grid */}
              {categories.length > 0 && (
                <View style={{ paddingHorizontal: 16, paddingTop: 20, marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Browse Categories</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {categories.slice(0, 12).map((cat: any, i) => (
                      <TouchableOpacity
                        key={i}
                        onPress={() => {
                          const tag = `#${cat.category}`;
                          setSearch(tag);
                          performSearch(tag, typeFilter);
                          saveRecentSearch(tag);
                        }}
                        style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: border, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc', marginBottom: 8, marginRight: 4 }}
                      >
                        <Text style={{ fontSize: 13, fontWeight: '600', color: textColor }}>#{cat.category}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </>
          ) : (
            // Search Results Layout
            <>
              {/* AI Answer Box */}
              {aiAnswer && (
                <View style={{ marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 16, backgroundColor: isDark ? 'rgba(128, 139, 245, 0.15)' : 'rgba(128, 139, 245, 0.08)', borderWidth: 1, borderColor: 'rgba(128, 139, 245, 0.2)' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <MaterialCommunityIcons name="creation" size={18} color="#808bf5" />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', letterSpacing: 1 }}>AI Answer</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 22, color: textColor }}>{aiAnswer}</Text>
                </View>
              )}

              {/* Semantic Results */}
              {aiResults.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                  {aiResults.slice(0, 5).map((post: any) => {
                    const thumbnail = post.image_urls?.[0] || post.image_url || post.videoThumbnail;
                    return (
                      <TouchableOpacity
                        key={post._id}
                        onPress={() => {
                          saveRecentSearch(post.caption || '(No caption)');
                          setIsSearchActive(false);
                          navigation.navigate('PostDetail', { postId: post._id });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 16, backgroundColor: isDark ? 'rgba(128, 139, 245, 0.05)' : 'rgba(128, 139, 245, 0.03)', borderWidth: 1, borderColor: 'rgba(128, 139, 245, 0.1)', marginBottom: 8 }}
                      >
                        <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: isDark ? '#1a202c' : '#edf2f7', overflow: 'hidden', marginRight: 12 }}>
                          {thumbnail ? (
                            <Image source={{ uri: resolveMediaUrl(thumbnail) }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialCommunityIcons name="file-document-outline" size={20} color={subTextColor} />
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', marginBottom: 2 }}>#{post.category || post.topic || 'AI'}</Text>
                          <Text style={{ fontSize: 13, color: textColor }} numberOfLines={1}>{post.caption || post.content || '(No content)'}</Text>
                        </View>
                        <MaterialCommunityIcons name="creation" size={16} color={subTextColor} style={{ opacity: 0.5 }} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* People Section */}
              {blendedUsers.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>People</Text>
                  {blendedUsers.map((u: any) => {
                    const isLocalMatch = recentSearches.some(m => m._id === u._id);
                    const isFollowing = loggedUser?.following?.some((id: any) => id?.toString() === u._id?.toString());
                    return (
                      <TouchableOpacity
                        key={u._id}
                        onPress={() => {
                          saveRecentSearch(u);
                          setIsSearchActive(false);
                          navigation.navigate('Profile', { userId: u._id });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                      >
                        <Image source={{ uri: u.profile_picture || 'https://via.placeholder.com/150' }} style={{ width: 44, height: 44, borderRadius: 22, marginRight: 12 }} />
                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={{ fontSize: 14, fontWeight: '600', color: textColor }} numberOfLines={1}>{u.fullname}</Text>
                            {/* {isLocalMatch && (
                              <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: isDark ? '#1e293b' : '#f1f5f9' }}>
                                <Text style={{ fontSize: 8, fontWeight: 'bold', color: subTextColor }}>HISTORY</Text>
                              </View>
                            )} */}
                          </View>
                          <Text style={{ fontSize: 11, color: '#808bf5', fontWeight: 'bold' }}>@{u.username}</Text>
                        </View>
                        {isFollowing && (
                          <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: isDark ? 'rgba(128,139,245,0.15)' : 'rgba(128,139,245,0.08)' }}>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#808bf5' }}>FOLLOWING</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* Posts Section */}
              {searchResults.posts?.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: subTextColor, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Posts</Text>
                  {searchResults.posts.slice(0, 5).map((post: any) => {
                    const thumbnail = post.image_urls?.[0] || post.image_url || post.videoThumbnail;
                    return (
                      <TouchableOpacity
                        key={post._id}
                        onPress={() => {
                          saveRecentSearch(post.caption || '(No caption)');
                          setIsSearchActive(false);
                          navigation.navigate('PostDetail', { postId: post._id });
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}
                      >
                        <View style={{ width: 40, height: 40, borderRadius: 8, backgroundColor: isDark ? '#1a202c' : '#edf2f7', overflow: 'hidden', marginRight: 12 }}>
                          {thumbnail ? (
                            <Image source={{ uri: resolveMediaUrl(thumbnail) }} style={{ width: '100%', height: '100%' }} />
                          ) : (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                              <MaterialCommunityIcons name="file-document-outline" size={18} color={subTextColor} />
                            </View>
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', marginBottom: 2 }}>#{post.category || 'GENERAL'}</Text>
                          <Text style={{ fontSize: 13, color: textColor }} numberOfLines={1}>{post.caption || '(No caption)'}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {/* No Results Info */}
              {blendedUsers.length === 0 && searchResults.posts?.length === 0 && aiResults.length === 0 && (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <Text style={{ fontSize: 32, marginBottom: 8 }}>🔍</Text>
                  <Text style={{ fontSize: 14, color: subTextColor }}>No results for "{search}"</Text>
                </View>
              )}
            </>
          )}
        </ScrollView>
      ) : (
        // Reels Grid Mode
        loading && reels.length === 0 ? (
          // Skeleton loader
          <View style={styles.skeletonContainer}>
            {[...Array(9)].map((_, i) => (
              <View key={i} style={[styles.skeletonItem, { backgroundColor: isDark ? '#1a1a1a' : '#e5e7eb' }]} />
            ))}
          </View>
        ) : (
          <FlatList
            data={reels}
            renderItem={renderGridItem}
            keyExtractor={(item) => item._id}
            numColumns={3}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchReels(true)}
                colors={['#808bf5']}
              />
            }
            onEndReached={() => {
              if (hasMore && !loading && !refreshing) {
                fetchReels(false);
              }
            }}
            onEndReachedThreshold={0.4}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: subTextColor }}>No reels found.</Text>
              </View>
            }
          />
        )
      )}

      <BottomNav currentTab="explore" navigation={navigation} />
    </View>
  );
}

// Sub-component for individual fullscreen reel playback
// Bottom-sheet comments — a transparent Modal overlay, so the reel keeps playing
// behind it instead of navigating away to a full screen (which stopped the video).
function ReelCommentsSheet({ visible, onClose, postId, loggedUser, onCommentAdded }: any) {
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchComments = () => {
    if (!postId) return;
    setLoading(true);
    api.get('/api/post/comments', { params: { postId } })
      .then((res) => setComments(Array.isArray(res.data) ? res.data : []))
      .catch(() => { })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (visible) fetchComments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, postId]);

  const handleAdd = async () => {
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await api.post('/api/post/comments/add', {
        postId,
        content: commentText.trim(),
        user: { _id: loggedUser?._id, fullname: loggedUser?.fullname, profile_picture: loggedUser?.profile_picture },
      });
      setCommentText('');
      fetchComments();
      onCommentAdded && onCommentAdded();
    } catch (e) {
      console.warn('Failed to add comment:', e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.commentsSheetOverlay} activeOpacity={1} onPress={onClose}>
        <TouchableWithoutFeedback>
          <View style={styles.commentsSheetContainer}>
            <View style={styles.commentsSheetHandle} />
            <Text style={styles.commentsSheetTitle}>Comments</Text>
            {loading ? (
              <ActivityIndicator color="#808bf5" style={{ marginTop: 20 }} />
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(c) => c._id}
                style={{ maxHeight: height * 0.4 }}
                renderItem={({ item: c }) => (
                  <View style={styles.commentsSheetRow}>
                    <Image
                      source={{ uri: c.user?.profile_picture || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=80' }}
                      style={styles.commentsSheetAvatar}
                    />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={{ color: '#111827', fontWeight: 'bold', fontSize: 12 }}>{c.user?.fullname || 'User'}</Text>
                      <Text style={{ color: '#111827', fontSize: 13 }}>{c.content}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color: '#6b7280', textAlign: 'center', marginTop: 20 }}>No comments yet. Be the first!</Text>}
              />
            )}
            <View style={styles.commentsSheetInputRow}>
              <TextInput
                style={styles.commentsSheetInput}
                placeholder="Add a comment..."
                placeholderTextColor="#9ca3af"
                value={commentText}
                onChangeText={setCommentText}
              />
              <TouchableOpacity
                onPress={handleAdd}
                disabled={!commentText.trim() || submitting}
                accessibilityRole="button"
                accessibilityLabel="Send comment"
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#808bf5" />
                ) : (
                  <MaterialCommunityIcons name="send" size={22} color={commentText.trim() ? '#808bf5' : '#9ca3af'} />
                )}
              </TouchableOpacity>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </TouchableOpacity>
    </Modal>
  );
}

export function ReelPlayerItem({
  item,
  isActive,
  muted,
  setMuted,
  onClose,
  loggedUser,
  navigation,
  isPreload = false,
  hideHeader = false,
}: any) {
  const isFocused = useIsFocused();
  const [liked, setLiked] = useState(
    (item.likes || []).some((id: any) => (id._id || id) === loggedUser?._id)
  );
  const [likeCount, setLikeCount] = useState(item.likes?.length || 0);
  const [commentCount, setCommentCount] = useState(item.comments?.length || 0);
  const [saved, setSaved] = useState(
    (loggedUser?.savedPosts || []).some((id: any) => id?.toString() === item._id?.toString())
  );
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const singleTapTimeout = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [shareVisible, setShareVisible] = useState(false);
  const [commentsVisible, setCommentsVisible] = useState(false);
  const [videoProgress, setVideoProgress] = useState({ currentTime: 0, duration: 0 });
  const isOwnReel = item.user?._id === loggedUser?._id;
  const [followSent, setFollowSent] = useState(false);

  // Re-sync like state when item changes (safety net if component is reused)
  useEffect(() => {
    setLiked((item.likes || []).some((id: any) => (id._id || id) === loggedUser?._id));
    setLikeCount(item.likes?.length || 0);
    setCommentCount(item.comments?.length || 0);
  }, [item._id]);

  // Toggle Like API
  const handleLikeToggle = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((prev: number) => (nextLiked ? prev + 1 : prev - 1));

    try {
      await api.post(`/api/post/${nextLiked ? 'like' : 'unlike'}`, {
        postId: item._id,
      });
    } catch (e) {
      console.warn('Failed to like post:', e);
      // rollback
      setLiked(!nextLiked);
      setLikeCount((prev: number) => (nextLiked ? prev - 1 : prev + 1));
    }
  };

  const handleSaveToggle = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      await api.post('/api/post/save', { postId: item._id });
    } catch (e) {
      setSaved(!nextSaved);
      console.warn('Failed to toggle save:', e);
    }
  };

  const handleFollowAuthor = async () => {
    if (!item.user?._id) return;
    setFollowSent(true);
    try {
      await api.post('/api/auth/follow', { userId: loggedUser?._id, followUserId: item.user._id });
    } catch (e) {
      console.warn('Failed to follow author:', e);
    }
  };

  // Single tap pauses/resumes; a second tap within the window upgrades to double-tap-to-like
  // instead (matching Instagram) — previously only the double-tap path was ever wired up,
  // so a lone tap silently did nothing even though a "paused" overlay already existed.
  const handleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
      if (singleTapTimeout.current) {
        clearTimeout(singleTapTimeout.current);
        singleTapTimeout.current = null;
      }
      lastTap.current = 0;
      if (!liked) {
        handleLikeToggle();
      }
      setShowHeartBurst(true);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.3, friction: 3, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => setShowHeartBurst(false));
    } else {
      lastTap.current = now;
      singleTapTimeout.current = setTimeout(() => {
        setIsPlaying((p) => !p);
        singleTapTimeout.current = null;
      }, DOUBLE_PRESS_DELAY);
    }
  };

  const formatTime = (secs: number) => {
    if (!isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <TouchableWithoutFeedback onPress={handleTap}>
      <View style={[styles.reelPlayerContainer, { height }]}>
        {(isActive || isPreload) && item.video ? (
          <VideoComponent
            source={{ uri: item.video }}
            style={isActive ? StyleSheet.absoluteFill : { width: 0, height: 0, position: 'absolute' }}
            paused={isActive ? (!isPlaying || !isFocused) : true}
            resizeMode="contain"
            repeat
            muted={isActive ? muted : true}
            playInBackground={false}
            playWhenInactive={false}
            controls={false}
            onProgress={(d: any) => isActive && setVideoProgress({ currentTime: d.currentTime, duration: d.seekableDuration || videoProgress.duration })}
            onLoad={(d: any) => isActive && setVideoProgress((p) => ({ ...p, duration: d.duration }))}
            bufferConfig={{
              minBufferMs: 2000,
              maxBufferMs: 5000,
              bufferForPlaybackMs: 1000,
              bufferForPlaybackAfterRebufferMs: 1500
            }}
          />
        ) : null}

        {/* Play icon when user paused */}
        {!isPlaying && (
          <View style={styles.pausedOverlay} pointerEvents="none">
            <MaterialCommunityIcons name="play" size={60} color="#ffffff" />
          </View>
        )}

        {/* Double tap heart feedback */}
        {showHeartBurst && (
          <Animated.View style={[styles.heartBurst, { transform: [{ scale: heartScale }] }]} pointerEvents="none">
            <MaterialCommunityIcons name="heart" size={100} color="#ef4444" />
          </Animated.View>
        )}

        {/* Top Header Actions */}
        {!hideHeader && (
          <View style={styles.reelHeader}>
            {onClose ? (
              <TouchableOpacity
                onPress={onClose}
                style={styles.iconCircle}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
            <Text style={styles.reelHeaderTitle}>Reels</Text>
            <TouchableOpacity
              onPress={() => setMuted(!muted)}
              style={styles.iconCircle}
              accessibilityRole="button"
              accessibilityLabel={muted ? 'Unmute' : 'Mute'}
              accessibilityState={{ selected: muted }}
            >
              <MaterialCommunityIcons
                name={muted ? 'volume-off' : 'volume-high'}
                size={24}
                color="#ffffff"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom Details (Overlay) */}
        <View style={styles.reelDetailsOverlay}>
          <View style={styles.reelUserRow}>
            <TouchableOpacity
              style={{ position: 'relative' }}
              onPress={() => {
                if (item.user?._id) {
                  navigation.navigate('Profile', { userId: item.user._id });
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`View ${item.user?.fullname || 'user'}'s profile`}
            >
              {item.user?.profile_picture ? (
                <Image source={{ uri: item.user.profile_picture }} style={styles.reelAvatar} />
              ) : (
                <View style={styles.reelAvatarFallback}>
                  <Text style={styles.reelAvatarInitial}>
                    {(item.user?.fullname || '?')[0].toUpperCase()}
                  </Text>
                </View>
              )}
              {!isOwnReel && !followSent && (
                <TouchableOpacity
                  style={styles.reelFollowBadge}
                  onPress={handleFollowAuthor}
                  accessibilityRole="button"
                  accessibilityLabel={`Follow ${item.user?.fullname || 'user'}`}
                >
                  <MaterialCommunityIcons name="plus" size={12} color="#ffffff" />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => {
                if (item.user?._id) navigation.navigate('Profile', { userId: item.user._id });
              }}
            >
              <Text style={styles.reelUsername}>
                @{item.user?.username || (item.user?.fullname ? item.user.fullname.replace(/\s+/g, '').toLowerCase() : 'user')}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.reelCaption} numberOfLines={3}>
            {item.caption || item.content || ''}
          </Text>

          {item.music?.title ? (
            <View style={styles.reelMusicBadge}>
              <MaterialCommunityIcons name="music-note" size={13} color="#ffffff" />
              <Text style={styles.reelMusicText} numberOfLines={1}>
                {item.music.title}{item.music.artist ? ` · ${item.music.artist}` : ''}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Right Actions column */}
        <View style={styles.reelActionsCol}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleLikeToggle}
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike' : 'Like'}
            accessibilityState={{ selected: liked }}
          >
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={32}
              color={liked ? '#ef4444' : '#ffffff'}
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setCommentsVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="View comments"
          >
            <MaterialCommunityIcons name="comment-outline" size={32} color="#ffffff" />
            <Text style={styles.actionText}>{commentCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => setShareVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Share reel"
          >
            <MaterialCommunityIcons name="send-outline" size={32} color="#ffffff" />
            <Text style={styles.actionText}>Share</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleSaveToggle}
            accessibilityRole="button"
            accessibilityLabel={saved ? 'Remove from saved' : 'Save reel'}
            accessibilityState={{ selected: saved }}
          >
            <MaterialCommunityIcons
              name={saved ? 'bookmark' : 'bookmark-outline'}
              size={30}
              color={saved ? '#facc15' : '#ffffff'}
            />
          </TouchableOpacity>
        </View>

        {/* Bottom playback progress bar */}
        {isActive && videoProgress.duration > 0 && (
          <View style={styles.reelProgressTrack} pointerEvents="none">
            <View
              style={[
                styles.reelProgressFill,
                { width: `${Math.min(100, (videoProgress.currentTime / videoProgress.duration) * 100)}%` },
              ]}
            />
          </View>
        )}

        {/* Share Modal Dialog */}
        <ShareModal
          visible={shareVisible}
          onClose={() => setShareVisible(false)}
          post={item}
          myUser={loggedUser}
        />

        <ReelCommentsSheet
          visible={commentsVisible}
          onClose={() => setCommentsVisible(false)}
          postId={item._id}
          loggedUser={loggedUser}
          onCommentAdded={() => setCommentCount((c: number) => c + 1)}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 60,
    justifyContent: 'center',
    paddingHorizontal: 12,
    elevation: 2,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    height: '100%',
    marginLeft: 8,
    fontSize: 14,
    padding: 0,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  listContent: {
    padding: 1,
    paddingBottom: 70,
  },
  gridItem: {
    width: gridWidth,
    height: gridWidth * 1.5,
    margin: 0.5,
    position: 'relative',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  placeholderGridBg: {
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gridOverlay: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  gridOverlayText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 2,
  },
  // Skeleton Styles
  skeletonContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 1,
  },
  skeletonItem: {
    width: gridWidth,
    height: gridWidth * 1.5,
    margin: 0.5,
    borderRadius: 4,
  },
  // Search Styles
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  searchAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  searchAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#808bf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchAvatarText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  searchDetails: {
    flex: 1,
    marginLeft: 12,
  },
  searchFullname: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchUsername: {
    fontSize: 13,
    marginTop: 2,
  },
  // Reels Viewer Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  reelPlayerContainer: {
    width: width,
    backgroundColor: '#000000',
    position: 'relative',
    justifyContent: 'center',
  },
  pausedOverlay: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 40,
    padding: 10,
  },
  heartBurst: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 100,
  },
  reelHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 10,
  },
  reelHeaderTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelDetailsOverlay: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 95 : 75,
    left: 16,
    right: 80,
    zIndex: 10,
  },
  reelUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  reelAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  reelAvatarFallback: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    backgroundColor: '#808bf5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reelAvatarInitial: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  reelUsername: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  reelCaption: {
    color: '#ffffff',
    fontSize: 14,
    lineHeight: 18,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  reelActionsCol: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    right: 12,
    alignItems: 'center',
    zIndex: 10,
  },
  actionButton: {
    alignItems: 'center',
    marginVertical: 10,
  },
  actionText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  reelFollowBadge: {
    position: 'absolute',
    bottom: -4,
    alignSelf: 'center',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#808bf5',
    borderWidth: 1.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  reelMusicBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 5,
  },
  reelMusicText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 200,
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 2,
  },
  reelProgressTrack: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  reelProgressFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  commentsSheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  commentsSheetContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 8,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
    maxHeight: height * 0.6,
  },
  commentsSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
    alignSelf: 'center',
    marginBottom: 10,
  },
  commentsSheetTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 10,
  },
  commentsSheetRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  commentsSheetAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  commentsSheetInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commentsSheetInput: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    color: '#111827',
    fontSize: 13,
  },
});
