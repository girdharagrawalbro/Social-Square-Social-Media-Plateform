import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Animated,
  Dimensions,
  useColorScheme,
  Modal,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import LinearGradient from 'react-native-linear-gradient';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import { appChannel } from '../../lib/broadcast';
import { useBroadcast } from '../../lib/useBroadcast';
import { useIsFocused } from '@react-navigation/native';

const { width: screenWidth } = Dimensions.get('window');

export interface Post {
  _id: string;
  user?: {
    _id: string;
    fullname?: string;
    username?: string;
    profile_picture?: string;
    isOnline?: boolean;
  };
  content?: string;
  caption?: string;
  image_url?: string;
  image_urls?: string[];
  video?: string;
  videoThumbnail?: string;
  likes?: string[];
  comments?: any[];
  createdAt?: string;
  updatedAt?: string;
  mood?: string;
  isAnonymous?: boolean;
  aiSummary?: string;
  unlocksAt?: string;
  voiceNote?: {
    url?: string;
    duration?: number;
  };
}

interface PostItemProps {
  post: Post;
  isDark: boolean;
  isVisible?: boolean;
}

// ─── Time ago helper ────────────────────────────────────────────────────────────
function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

let activePlayersCount = 0;

export const PostItem = React.memo(({ post, isDark, isVisible = false }: PostItemProps) => {
  const navigation = useNavigation<any>();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [saved, setSaved] = useState(false);
  const [videoPaused, setVideoPaused] = useState(true);
  const videoRef = useRef(null);
  const isFocused = useIsFocused();

  // Sync pause state with visibility
  useEffect(() => {
    if (isVisible) {
      setVideoPaused(false);
    } else {
      setVideoPaused(true);
    }
  }, [isVisible]);

  const shouldRenderVideo = isVisible || !videoPaused;

  // Active players count logging
  useEffect(() => {
    if (shouldRenderVideo) {
      activePlayersCount++;
      console.log(`[Video Mounted] Post ID: ${post._id}. Active players count: ${activePlayersCount}`);
      return () => {
        activePlayersCount--;
        console.log(`[Video Unmounted] Post ID: ${post._id}. Active players count: ${activePlayersCount}`);
      };
    }
  }, [shouldRenderVideo, post._id]);

  const isActuallyPlaying = shouldRenderVideo && !videoPaused && isFocused && isVisible;

  useEffect(() => {
    if (isActuallyPlaying) {
      console.log(`[Video Started] Post ID: ${post._id}`);
      return () => {
        console.log(`[Video Paused] Post ID: ${post._id}`);
      };
    }
  }, [isActuallyPlaying, post._id]);

  useEffect(() => {
    return () => {
      setVideoPaused(true);
    };
  }, []);


  // Double tap to like burst animations
  const [lastTap, setLastTap] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;

  // AI Summary modal/tooltip state
  const [aiTooltipVisible, setAiTooltipVisible] = useState(false);
  // Hidden when deleted or blocked
  const [hidden, setHidden] = useState(false);

  const user = post.user;
  const isAnon = post.isAnonymous;
  const content = post.caption || post.content || '';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const dividerColor = isDark ? '#1e293b' : '#f1f5f9';
  const iconColor = isDark ? '#64748b' : '#94a3b8';

  const loggedUser = useAuthStore((s: any) => s.user);
  const isOwn = !isAnon && user?._id && loggedUser?._id === user._id;
  const isLocked = post.unlocksAt && new Date(post.unlocksAt) > new Date() && !isOwn;

  // ── Broadcast: POST_LIKE_COUNT — emit when this user likes; sync when another card emits
  const toggleLike = useCallback(() => {
    const nextLiked = !liked;
    const nextCount = nextLiked ? likeCount + 1 : likeCount - 1;
    setLiked(nextLiked);
    setLikeCount(nextCount);
    appChannel.postMessage({
      type: 'POST_LIKE_COUNT',
      postId: post._id,
      count: nextCount,
      liked: nextLiked,
    });
  }, [liked, likeCount, post._id]);

  useBroadcast('POST_LIKE_COUNT', useCallback(({ postId, count, liked: incomingLiked }) => {
    if (postId === post._id) {
      setLikeCount(count);
      setLiked(incomingLiked);
    }
  }, [post._id]));

  // ── Broadcast: POST_DELETED — hide this card if it was deleted
  useBroadcast('POST_DELETED', useCallback(({ postId }) => {
    if (postId === post._id) setHidden(true);
  }, [post._id]));

  // ── Broadcast: USER_BLOCK — hide posts from blocked users
  useBroadcast('USER_BLOCK', useCallback(({ targetUserId }) => {
    if (user?._id === targetUserId) setHidden(true);
  }, [user?._id]));

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_PRESS_DELAY = 300;
    if (now - lastTap < DOUBLE_PRESS_DELAY) {
      if (!liked) {
        toggleLike();
      }
      setShowHeartBurst(true);
      Animated.sequence([
        Animated.spring(heartScale, { toValue: 1.3, friction: 3, useNativeDriver: true }),
        Animated.timing(heartScale, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start(() => setShowHeartBurst(false));
    } else {
      setLastTap(now);
    }
  };

  const getFirstImage = () => {
    if (post.image_urls && post.image_urls.length > 0) {
      return post.image_urls[0];
    }
    return post.image_url;
  };

  const imageUrl = getFirstImage();

  // If post hidden (deleted or user blocked), render nothing
  if (hidden) return null;

  return (
    <View style={[styles.postCard, { backgroundColor: cardBg, borderColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
      {/* Collab / Locked Notification overlay banner */}
      {isLocked && (
        <View style={styles.lockedOverlay}>
          <MaterialCommunityIcons name="lock" size={32} color="#ffffff" />
          <Text style={styles.lockedText}>Locked Post</Text>
          <Text style={styles.lockedSubtext}>Unlocks at {new Date(post.unlocksAt!).toLocaleString()}</Text>
        </View>
      )}

      {/* Post Header */}
      <View style={styles.postHeader}>
        <View style={styles.avatarContainer}>
          {isAnon ? (
            <LinearGradient
              colors={['#808bf5', '#ec4899']}
              style={styles.avatarFallback}
            >
              <MaterialCommunityIcons name="incognito" size={22} color="#ffffff" />
            </LinearGradient>
          ) : user?.profile_picture ? (
            <View style={user?.isOnline ? styles.onlineIndicatorWrapper : null}>
              <Image source={{ uri: user.profile_picture }} style={styles.avatar} />
              {user?.isOnline && <View style={styles.onlineBadge} />}
            </View>
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#808bf5' }]}>
              <Text style={styles.avatarInitial}>
                {(user?.fullname || '?')[0].toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.postUserInfo}>
          <Text style={[styles.username, { color: textColor }]}>
            {isAnon ? 'Anonymous' : (user?.fullname || 'Unknown User')}
          </Text>
          <Text style={[styles.postMeta, { color: subColor }]}>
            {timeAgo(post.createdAt || post.updatedAt)}
          </Text>
        </View>

        {/* Sparkles / AI Badge */}
        {post.aiSummary ? (
          <TouchableOpacity
            style={styles.sparkleBtn}
            onPress={() => setAiTooltipVisible(true)}
          >
            <MaterialCommunityIcons name="sparkles" size={20} color="#a855f7" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={iconColor} />
        </TouchableOpacity>
      </View>

      {/* Unified Media Display with double tap to like detector */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.mediaContainer}>
          {/* Post Video */}
          {post.video ? (
            <View style={styles.videoWrapper}>
              {shouldRenderVideo ? (
                <Video
                  source={{ uri: post.video }}
                  style={styles.postVideo}
                  paused={!isFocused || !isVisible || videoPaused}
                  resizeMode="cover"
                  controls={false}
                  ref={videoRef}
                  muted={false}
                />
              ) : (
                <Image
                  source={post.videoThumbnail ? { uri: post.videoThumbnail } : undefined}
                  style={styles.postVideo}
                  resizeMode="cover"
                />
              )}
              {videoPaused && (
                <TouchableOpacity
                  style={styles.videoPlayOverlay}
                  onPress={() => setVideoPaused(false)}
                >
                  <MaterialCommunityIcons name="play-circle" size={54} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          ) : null}

          {/* Post Image */}
          {!post.video && imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : null}

          {/* Heart burst double tap animation pop */}
          {showHeartBurst && (
            <Animated.View style={[styles.heartBurst, { transform: [{ scale: heartScale }] }]}>
              <MaterialCommunityIcons name="heart" size={90} color="#ef4444" />
            </Animated.View>
          )}
        </View>
      </TouchableWithoutFeedback>


      {/* Voice note audio player container */}
      {post.voiceNote?.url && (
        <View style={[styles.voicePlayer, { backgroundColor: isDark ? '#1e1e2f' : '#f8fafc', borderColor: dividerColor }]}>
          <TouchableOpacity style={styles.voicePlayBtn}>
            <MaterialCommunityIcons name="play" size={24} color="#808bf5" />
          </TouchableOpacity>
          <View style={styles.voiceProgressBg}>
            <View style={styles.voiceProgressFill} />
          </View>
          <Text style={[styles.voiceDuration, { color: subColor }]}>0:12</Text>
        </View>
      )}

      {/* Post Content */}
      {content ? (
        <Text style={[styles.postContent, { color: textColor }]}>{content}</Text>
      ) : null}

      {/* Mood tag */}
      {post.mood && (
        <View style={styles.moodTag}>
          <Text style={styles.moodText}>#{post.mood}</Text>
        </View>
      )}

      {/* Footer Actions */}
      <View style={[styles.divider, { backgroundColor: dividerColor }]} />
      <View style={styles.postFooter}>
        <TouchableOpacity style={styles.footerAction} onPress={toggleLike} activeOpacity={0.7}>
          <MaterialCommunityIcons
            name={liked ? 'heart' : 'heart-outline'}
            size={22}
            color={liked ? '#ef4444' : iconColor}
          />
          {likeCount > 0 && (
            <Text style={[styles.actionCount, { color: liked ? '#ef4444' : subColor }]}>
              {likeCount}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerAction}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
        >
          <MaterialCommunityIcons name="comment-outline" size={22} color={iconColor} />
          {post.comments && post.comments.length > 0 && (
            <Text style={[styles.actionCount, { color: subColor }]}>{post.comments.length}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerAction} activeOpacity={0.7}>
          <MaterialCommunityIcons name="share-variant-outline" size={22} color={iconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerAction}
          onPress={() => setSaved(!saved)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={saved ? '#6366f1' : iconColor}
          />
        </TouchableOpacity>
      </View>

      {/* AI Dwell Popup / Tooltip Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={aiTooltipVisible}
        onRequestClose={() => setAiTooltipVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPressOut={() => setAiTooltipVisible(false)}
        >
          <View style={[styles.aiSummaryCard, { backgroundColor: isDark ? '#1a1a2e' : '#ffffff' }]}>
            <View style={styles.aiSummaryHeader}>
              <MaterialCommunityIcons name="sparkles" size={18} color="#a855f7" />
              <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            </View>
            <Text style={[styles.aiSummaryText, { color: textColor }]}>{post.aiSummary}</Text>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
});

const styles = StyleSheet.create({
  postCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    position: 'relative',
    overflow: 'hidden',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    zIndex: 40,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  lockedText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  lockedSubtext: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  onlineIndicatorWrapper: {
    position: 'relative',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  postUserInfo: {
    flex: 1,
  },
  username: {
    fontSize: 15,
    fontWeight: '700',
  },
  postMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  sparkleBtn: {
    marginRight: 8,
    padding: 4,
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  mediaContainer: {
    position: 'relative',
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  videoWrapper: {
    width: '100%',
    height: 220,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  postVideo: {
    width: '100%',
    height: '100%',
  },
  videoPlayOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    width: '100%',
    height: '100%',
  },
  postImage: {
    width: '100%',
    height: 220,
    backgroundColor: '#e2e8f0',
  },
  heartBurst: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -45,
    marginLeft: -45,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 50,
  },
  voicePlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  voicePlayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(128, 139, 245, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceProgressBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  voiceProgressFill: {
    width: '35%',
    height: '100%',
    backgroundColor: '#808bf5',
  },
  voiceDuration: {
    fontSize: 12,
    fontWeight: '600',
  },
  moodTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(128, 139, 245, 0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  moodText: {
    color: '#808bf5',
    fontSize: 13,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
  },
  actionCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  aiSummaryCard: {
    width: screenWidth - 40,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#e8d5f8',
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  aiSummaryTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#a855f7',
  },
  aiSummaryText: {
    fontSize: 14,
    lineHeight: 20,
  },
});
