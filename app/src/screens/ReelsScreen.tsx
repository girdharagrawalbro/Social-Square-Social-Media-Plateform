import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Dimensions,
  FlatList,
  ActivityIndicator,
  RefreshControl,
  StatusBar,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import BottomNav from './components/BottomNav';
import { ReelPlayerItem } from './ExploreScreen';

const { height } = Dimensions.get('window');

export default function ReelsScreen({ navigation }: any) {
  const isFocused = useIsFocused();
  const loggedUser = useAuthStore((s: any) => s.user);

  const [reels, setReels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeReelIndex, setActiveReelIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [cursor, setCursor] = useState<string | null>(null);

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
        setActiveReelIndex(0);
      } else {
        setReels((prev) => {
          const combined = [...prev, ...posts];
          const unique = combined.filter(
            (v, i, a) => a.findIndex((t) => t._id === v._id) === i
          );
          return unique;
        });
      }

      setCursor(nextCursor);
      setHasMore(resHasMore);
    } catch (e) {
      console.warn('Failed to fetch reels feed:', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isFocused) {
      fetchReels(true);
    }
  }, [isFocused]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      
      {/* FIXED/STATIC HEADER AT THE TOP */}
      <View style={styles.fixedHeader}>
        <View style={{ width: 40 }} />
        <Text style={styles.headerTitle}>Reels</Text>
        <TouchableOpacity onPress={() => setMuted(!muted)} style={styles.iconCircle}>
          <MaterialCommunityIcons
            name={muted ? 'volume-off' : 'volume-high'}
            size={24}
            color="#ffffff"
          />
        </TouchableOpacity>
      </View>

      {loading && reels.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#808bf5" />
        </View>
      ) : (
        <FlatList
          data={reels}
          pagingEnabled
          vertical
          showsVerticalScrollIndicator={false}
          keyExtractor={(item) => item._id}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.y / height);
            setActiveReelIndex(index);
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchReels(true)}
              colors={['#808bf5']}
              tintColor="#ffffff"
            />
          }
          onEndReached={() => {
            if (hasMore && !loading && !refreshing) {
              fetchReels(false);
            }
          }}
          onEndReachedThreshold={0.4}
          renderItem={({ item, index }) => (
            <ReelPlayerItem
              item={item}
              isActive={index === activeReelIndex && isFocused}
              isPreload={index === activeReelIndex + 1 || index === activeReelIndex + 2}
              muted={muted}
              setMuted={setMuted}
              loggedUser={loggedUser}
              navigation={navigation}
              hideHeader={true} // Disable individual scrolling header
            />
          )}
          contentContainerStyle={{ paddingBottom: 60 }}
        />
      )}

      <BottomNav currentTab="reels" navigation={navigation} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  fixedHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 100, // Make sure it sits on top of everything
  },
  headerTitle: {
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
});
