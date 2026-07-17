import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
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
import BottomNav from './components/BottomNav';
import { api, BASE_URL } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width, height } = Dimensions.get('window');
const gridWidth = (width - 6) / 3;

function SkeletonSearch() {
  const isDark = useColorScheme() === 'dark';
  const skeletonBg = isDark ? '#1e293b' : '#e2e8f0';

  return (
    <View style={{ padding: 16 }}>
      {/* People Skeleton */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ width: 80, height: 12, backgroundColor: skeletonBg, borderRadius: 4, marginBottom: 12 }} />
        {[1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: skeletonBg, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: '40%', height: 14, backgroundColor: skeletonBg, borderRadius: 4, marginBottom: 8 }} />
              <View style={{ width: '60%', height: 10, backgroundColor: skeletonBg, borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>

      {/* AI Results Skeleton */}
      <View>
        <View style={{ width: 120, height: 12, backgroundColor: skeletonBg, borderRadius: 4, marginBottom: 12 }} />
        {[1, 2].map(i => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', marginBottom: 12 }}>
            <View style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: skeletonBg, marginRight: 12 }} />
            <View style={{ flex: 1 }}>
              <View style={{ width: '80%', height: 14, backgroundColor: skeletonBg, borderRadius: 4, marginBottom: 8 }} />
              <View style={{ width: '50%', height: 10, backgroundColor: skeletonBg, borderRadius: 4 }} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function ExploreScreen({ navigation }: any) {
  const isDark = useColorScheme() === 'dark';
  const loggedUser = useAuthStore((s: any) => s.user);

  // States
  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

  // Advanced Search States
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<{ users: any[]; posts: any[] }>({ users: [], posts: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState('all');
  const [aiResults, setAiResults] = useState<any[]>([]);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Modal / Reels Viewer States
  const [selectedReelIndex, setSelectedReelIndex] = useState<number | null>(null);
  const [isReelModalVisible, setIsReelModalVisible] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [muted, setMuted] = useState(true);

  // Styling colors
  const bg = isDark ? '#0a0a0a' : '#ffffff';
  const headerBg = isDark ? '#121212' : '#ffffff';
  const inputBg = isDark ? 'rgba(255, 255, 255, 0.05)' : '#f3f4f6';
  const textColor = isDark ? '#ffffff' : '#1f2937';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const subTextColor = isDark ? '#9ca3af' : '#6b7280';

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

  // Fetch Reels
  const fetchReels = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
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
      } else {
        setReels((prev) => {
          const combined = [...prev, ...posts];
          // deduplicate
          const unique = combined.filter(
            (v, i, a) => a.findIndex((t) => t._id === v._id) === i
          );
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
      }
    });

    return combined;
  }, [searchResults.users, recentSearches, search]);

  // Open modal at a specific reel
  const openReel = (index: number) => {
    setSelectedReelIndex(index);
    setActiveReelIndex(index);
    setIsReelModalVisible(true);
  };

  // Render Grid Item
  const renderGridItem = ({ item, index }: { item: any; index: number }) => {
    const thumbUrl = resolveMediaUrl(item.videoThumbnail || item.video);

    return (
      <TouchableOpacity
        style={styles.gridItem}
        onPress={() => openReel(index)}
        activeOpacity={0.8}
      >
        {thumbUrl ? (
          <Image source={{ uri: thumbUrl }} style={styles.gridImage} resizeMode="fill" />
        ) : (
          <View style={[styles.gridImage, styles.placeholderGridBg]}>
            <MaterialCommunityIcons name="video" size={30} color="#808bf5" />
          </View>
        )}
        <View style={styles.gridOverlay}>
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
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Search Header */}
      <View style={[styles.header, { backgroundColor: headerBg, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 }]}>
        {isSearchActive && (
          <TouchableOpacity onPress={() => { setIsSearchActive(false); setSearch(''); }} style={{ marginRight: 10 }}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={textColor} />
          </TouchableOpacity>
        )}
        <View style={[styles.searchBar, { backgroundColor: inputBg, flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 20, paddingHorizontal: 12, height: 40 }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={isDark ? '#6b7280' : '#9ca3af'} />
          <TextInput
            placeholder="Search users, posts, categories..."
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            style={[styles.input, { color: textColor, flex: 1, paddingVertical: 0, marginLeft: 8 }]}
            value={search}
            onChangeText={setSearch}
            onFocus={() => setIsSearchActive(true)}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialCommunityIcons name="close-circle" size={18} color={isDark ? '#6b7280' : '#9ca3af'} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Main Content Area */}
      {isSearchActive ? (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* Filter Chips (only when user has typed something) */}
          {search.trim().length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12, gap: 8 }}>
              {['all', 'tutorial', 'discussion', 'beginner', 'comments'].map(tf => (
                <TouchableOpacity
                  key={tf}
                  onPress={() => setTypeFilter(tf)}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 6,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: typeFilter === tf ? '#808bf5' : border,
                    backgroundColor: typeFilter === tf ? '#808bf5' : (isDark ? 'rgba(255,255,255,0.03)' : '#f8fafc'),
                    marginRight: 8
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: typeFilter === tf ? '#ffffff' : subTextColor, textTransform: 'uppercase' }}>{tf}</Text>
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
                    <MaterialCommunityIcons name="sparkles" size={18} color="#808bf5" />
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', letterSpacing: 1 }}>AI Answer</Text>
                  </View>
                  <Text style={{ fontSize: 14, lineHeight: 22, color: textColor }}>{aiAnswer}</Text>
                </View>
              )}

              {/* Semantic Results */}
              {aiResults.length > 0 && (
                <View style={{ paddingHorizontal: 16, marginBottom: 20 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#808bf5', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>✨ Semantic Results</Text>
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
                        <MaterialCommunityIcons name="sparkles" size={16} color={subTextColor} style={{ opacity: 0.5 }} />
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

      {/* REELS VIEWER MODAL */}
      <Modal
        visible={isReelModalVisible}
        transparent={false}
        animationType="slide"
        onRequestClose={() => setIsReelModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          {reels.length > 0 && selectedReelIndex !== null && (
            <FlatList
              data={reels}
              pagingEnabled
              vertical
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item._id}
              initialScrollIndex={selectedReelIndex}
              getItemLayout={(data, index) => ({
                length: height,
                offset: height * index,
                index,
              })}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.y / height);
                setActiveReelIndex(index);
              }}
              renderItem={({ item, index }) => (
                <ReelPlayerItem
                  item={item}
                  isActive={index === activeReelIndex}
                  muted={muted}
                  setMuted={setMuted}
                  onClose={() => setIsReelModalVisible(false)}
                  loggedUser={loggedUser}
                  navigation={navigation}
                />
              )}
            />
          )}
        </SafeAreaView>
      </Modal>

      <BottomNav currentTab="explore" navigation={navigation} />
    </SafeAreaView>
  );
}

// Sub-component for individual fullscreen reel playback
export function ReelPlayerItem({
  item,
  isActive,
  muted,
  setMuted,
  onClose,
  loggedUser,
  navigation,
  hideHeader = false,
}: any) {
  const isFocused = useIsFocused();
  const [liked, setLiked] = useState(
    (item.likes || []).some((id: any) => (id._id || id) === loggedUser?._id)
  );
  const [likeCount, setLikeCount] = useState(item.likes?.length || 0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;
  const lastTap = useRef(0);
  const [isPlaying, setIsPlaying] = useState(true);

  // Toggle Like API
  const handleLikeToggle = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((prev) => (nextLiked ? prev + 1 : prev - 1));

    try {
      await api.post(`/api/post/${nextLiked ? 'like' : 'unlike'}`, {
        postId: item._id,
      });
    } catch (e) {
      console.warn('Failed to like post:', e);
      // rollback
      setLiked(!nextLiked);
      setLikeCount((prev) => (nextLiked ? prev - 1 : prev + 1));
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap.current < DOUBLE_PRESS_DELAY) {
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
    }
  };

  return (
    <TouchableWithoutFeedback onPress={handleDoubleTap}>
      <View style={[styles.reelPlayerContainer, { height }]}>
        {isActive && item.video ? (
          <Video
            source={{ uri: item.video }}
            style={StyleSheet.absoluteFill}
            paused={!isPlaying || !isFocused}
            resizeMode="contain"
            repeat
            muted={muted}
            playInBackground={false}
            playWhenInactive={false}
            controls={false}
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
              <TouchableOpacity onPress={onClose} style={styles.iconCircle}>
                <MaterialCommunityIcons name="arrow-left" size={24} color="#ffffff" />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
            <Text style={styles.reelHeaderTitle}>Reels</Text>
            <TouchableOpacity onPress={() => setMuted(!muted)} style={styles.iconCircle}>
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
          <TouchableOpacity
            style={styles.reelUserRow}
            onPress={() => {
              if (item.user?._id) {
                navigation.navigate('Profile', { userId: item.user._id });
              }
            }}
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
            <Text style={styles.reelUsername}>
              @{item.user?.username || 'user'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.reelCaption} numberOfLines={3}>
            {item.caption || item.content || ''}
          </Text>
        </View>

        {/* Right Actions column */}
        <View style={styles.reelActionsCol}>
          <TouchableOpacity style={styles.actionButton} onPress={handleLikeToggle}>
            <MaterialCommunityIcons
              name={liked ? 'heart' : 'heart-outline'}
              size={32}
              color={liked ? '#ef4444' : '#ffffff'}
            />
            <Text style={styles.actionText}>{likeCount}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              navigation.navigate('PostDetail', { postId: item._id });
            }}
          >
            <MaterialCommunityIcons name="comment-outline" size={32} color="#ffffff" />
            <Text style={styles.actionText}>{item.comments?.length || 0}</Text>
          </TouchableOpacity>
        </View>
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
    margin: 1,
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
});
