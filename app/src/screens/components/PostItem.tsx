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
  PanResponder,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
const VideoComponent = Video as any;
import LinearGradient from 'react-native-linear-gradient';
import useAuthStore from '../../store/zustand/useAuthStore';
import { useNavigation } from '@react-navigation/native';
import { appChannel } from '../../lib/broadcast';
import { useBroadcast } from '../../lib/useBroadcast';
import { useIsFocused } from '@react-navigation/native';
import { BASE_URL, api } from '../../lib/api';
import RNFS from 'react-native-fs';
import PostMenu from './PostMenu';
import BeforeAfterView from './BeforeAfterView';
import ShareModal from './ShareModal';
import { decryptAesGcm, base64ToBytes, bytesToBase64 } from '../../lib/cryptoUtils';

const { width: screenWidth } = Dimensions.get('window');
const aspectRatioCache = new Map<string, number>();

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
  // Encryption fields for new posts (AES-GCM)
  videoKey?: string;  // base64 AES-256 key
  videoIv?: string;   // base64 12-byte IV
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
  isBeforeAfter?: boolean;
  beforeAfter?: any;
  reactions?: any[];
  sharesCount?: number;
}

interface PostItemProps {
  post: Post;
  isDark: boolean;
  isVisible?: boolean;
  showBackButton?: boolean;
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
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays <= 1) return '1d ago';

  const d = new Date(dateStr);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  return `${day} ${month}`;
}

let activePlayersCount = 0;

export const PostItem = React.memo(({ post, isDark, isVisible = false, showBackButton = false }: PostItemProps) => {
  const navigation = useNavigation<any>();
  const loggedUser = useAuthStore((s: any) => s.user);

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

  const getFirstImage = () => {
    if (post.image_urls && post.image_urls.length > 0) {
      return post.image_urls[0];
    }
    return post.image_url;
  };

  const imageUrl = resolveMediaUrl(getFirstImage());
  const rawVideoUrl = resolveMediaUrl(post.video);
  const videoThumbnailUrl = resolveMediaUrl(post.videoThumbnail);

  // ── E2E-encrypted video decryption ──────────────────────────────────────────
  // New posts uploaded with AES-GCM encryption store the key in post.videoKey
  // and IV in post.videoIv. We need to fetch, decrypt, and write a temp file.
  const [decryptedVideoPath, setDecryptedVideoPath] = useState<string | null>(null);
  const [isDecryptingVideo, setIsDecryptingVideo] = useState(false);
  const isEncryptedVideo = !!(post.video && post.videoKey && post.videoIv);

  useEffect(() => {
    if (!isEncryptedVideo || !rawVideoUrl || !post.videoKey || !post.videoIv) {
      setDecryptedVideoPath(null);
      return;
    }

    let active = true;
    const tempPath = `${RNFS.TemporaryDirectoryPath}/ss_video_${post._id}.mp4`;

    const run = async () => {
      const exists = await RNFS.exists(tempPath);
      if (exists) {
        if (active) setDecryptedVideoPath(`file://${tempPath}`);
        return;
      }

      setIsDecryptingVideo(true);
      try {
        const downloadRes = await RNFS.downloadFile({
          fromUrl: rawVideoUrl,
          toFile: tempPath + '.enc',
        }).promise;

        if (!active) return;

        const encBase64 = await RNFS.readFile(tempPath + '.enc', 'base64');
        const encBytes = base64ToBytes(encBase64);
        const decBytes = await decryptAesGcm(encBytes, post.videoKey!, post.videoIv!);
        const decBase64 = bytesToBase64(decBytes);
        await RNFS.writeFile(tempPath, decBase64, 'base64');
        await RNFS.unlink(tempPath + '.enc').catch(() => { });

        if (active) setDecryptedVideoPath(`file://${tempPath}`);
      } catch (err) {
        console.warn('[Video Decryption Error] Post:', post._id, err);
        if (active) setDecryptedVideoPath(rawVideoUrl ?? null);
      } finally {
        if (active) setIsDecryptingVideo(false);
      }
    };

    run();
    return () => { active = false; };
  }, [rawVideoUrl, post.videoKey, post.videoIv, post._id, isEncryptedVideo]);

  // Effective video URL: use decrypted local path if encrypted, otherwise direct URL
  const videoUrl = isEncryptedVideo ? decryptedVideoPath : rawVideoUrl;

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.likes?.length || 0);
  const [saved, setSaved] = useState(
    loggedUser?.savedPosts?.some((id: any) => id?.toString() === post._id?.toString()) || false
  );
  const [menuVisible, setMenuVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const videoRef = useRef(null);
  const isFocused = useIsFocused();

  // ── Video playback state ────────────────────────────────────────────────
  // Only ONE source of truth for "user explicitly paused this video".
  // Everything else (isVisible, isFocused) is derived, not stored/synced via effects.
  const [userPaused, setUserPaused] = useState(false);

  // Reset the manual-pause flag once the post scrolls out of view, so it
  // autoplays again next time it becomes visible (expected feed behaviour).
  useEffect(() => {
    if (!isVisible) {
      setUserPaused(false);
    }
  }, [isVisible]);

  // OPTIMIZATION: Only mount the native Video component if the post is actually visible.
  // Gating this on isVisible prevents having dozens of active video player buffers
  // in memory at once, which is the primary cause of out-of-memory crashes on feeds.
  const shouldRenderVideo = !!post.video && isVisible;
  const isPlaying = isVisible && isFocused && !userPaused;

  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [wasPlayingBeforeScrub, setWasPlayingBeforeScrub] = useState(false);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const currentTimeRef = useRef(videoCurrentTime);
  currentTimeRef.current = videoCurrentTime;

  const durationRef = useRef(videoDuration);
  durationRef.current = videoDuration;

  const wasPlayingRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderGrant: (evt, gestureState) => {
        setIsScrubbing(true);
        const originallyPlaying = isPlayingRef.current;
        wasPlayingRef.current = originallyPlaying;
        setWasPlayingBeforeScrub(originallyPlaying);
        if (originallyPlaying) {
          setUserPaused(true);
        }
        setScrubTime(currentTimeRef.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        const duration = durationRef.current;
        if (duration <= 0) return;
        const timeShift = (gestureState.dx / screenWidth) * duration;
        const targetTime = Math.max(0, Math.min(duration, currentTimeRef.current + timeShift));
        setScrubTime(targetTime);
        if (videoRef.current) {
          (videoRef.current as any).seek(targetTime);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        setIsScrubbing(false);
        const duration = durationRef.current;
        if (duration > 0) {
          const timeShift = (gestureState.dx / screenWidth) * duration;
          const targetTime = Math.max(0, Math.min(duration, currentTimeRef.current + timeShift));
          setVideoCurrentTime(targetTime);
          if (videoRef.current) {
            (videoRef.current as any).seek(targetTime);
          }
        }
        if (wasPlayingRef.current) {
          setUserPaused(false);
        }
      },
      onPanResponderTerminate: () => {
        setIsScrubbing(false);
        if (wasPlayingRef.current) {
          setUserPaused(false);
        }
      },
    })
  ).current;

  useEffect(() => {
    if (shouldRenderVideo) {
      activePlayersCount++;
      return () => {
        activePlayersCount--;
      };
    }
  }, [shouldRenderVideo, post._id]);

  useEffect(() => {
    if (isPlaying) {
      console.log(`[Video Started] Post ID: ${post._id}. Playing URL: ${videoUrl}`);
      return () => {
        console.log(`[Video Paused] Post ID: ${post._id}. Paused URL: ${videoUrl}`);
      };
    }
  }, [isPlaying, post._id, videoUrl]);

  // Double tap to like burst animations
  const [lastTap, setLastTap] = useState(0);
  const [showHeartBurst, setShowHeartBurst] = useState(false);
  const heartScale = useRef(new Animated.Value(0)).current;

  // AI Summary modal/tooltip state
  const [aiTooltipVisible, setAiTooltipVisible] = useState(false);
  // Hidden when deleted or blocked
  const [hidden, setHidden] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(() => {
    if (imageUrl && aspectRatioCache.has(imageUrl)) {
      return aspectRatioCache.get(imageUrl)!;
    }
    return 1.2;
  });
  const [imageLoading, setImageLoading] = useState(true);
  const imageOpacity = useRef(new Animated.Value(0)).current;

  const handleImageLoad = () => {
    setImageLoading(false);
    Animated.timing(imageOpacity, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const user = post.user;
  const isAnon = post.isAnonymous;
  const content = post.caption || post.content || '';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const dividerColor = isDark ? '#1a1a1a' : '#f1f5f9';
  const iconColor = isDark ? '#64748b' : '#94a3b8';

  const isOwn = !isAnon && user?._id && loggedUser?._id === user._id;
  const isLocked = post.unlocksAt && new Date(post.unlocksAt) > new Date() && !isOwn;

  const [reactions, setReactions] = useState<any[]>(post.reactions || []);

  useEffect(() => {
    setReactions(post.reactions || []);
  }, [post.reactions]);

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

  useBroadcast('POST_REACTED', useCallback(({ postId, reactions: incomingReactions }) => {
    if (postId === post._id) {
      setReactions(incomingReactions);
    }
  }, [post._id]));

  const handleSaveToggle = async () => {
    const nextSaved = !saved;
    setSaved(nextSaved);
    try {
      await api.post('/api/post/save', { postId: post._id });
    } catch (e) {
      setSaved(!nextSaved);
      console.warn('Failed to toggle save:', e);
    }
  };

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



  useEffect(() => {
    if (imageUrl) {
      if (aspectRatioCache.has(imageUrl)) {
        setAspectRatio(aspectRatioCache.get(imageUrl)!);
        setImageLoading(false);
        imageOpacity.setValue(1);
        return;
      }
      Image.getSize(
        imageUrl,
        (width, height) => {
          if (width && height) {
            const ratio = width / height;
            aspectRatioCache.set(imageUrl, ratio);
            setAspectRatio(ratio);
          }
        },
        (error) => {
          console.warn('Failed to get image size:', error);
        }
      );
    }
  }, [imageUrl]);

  // If post hidden (deleted or user blocked), render nothing
  if (hidden) return null;


  return (
    <View style={[styles.postCard, { backgroundColor: 'transparent', borderColor: 'transparent' }]}>
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
        {showBackButton && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{ marginRight: 4, paddingVertical: 4, paddingLeft: 4, paddingRight: 2 }}
          >
            <MaterialCommunityIcons name="chevron-left" size={32} color={textColor} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            if (!isAnon && user?._id) {
              navigation.push('Profile', { userId: user._id });
            }
          }}
          disabled={isAnon}
          style={styles.avatarContainer}
        >
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
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            if (!isAnon && user?._id) {
              navigation.push('Profile', { userId: user._id });
            }
          }}
          disabled={isAnon}
          style={styles.postUserInfo}
        >
          <Text style={[styles.username, { color: textColor }]}>
            {isAnon ? 'Anonymous' : (user?.fullname || 'Unknown User')}
          </Text>
          <Text style={[styles.postMeta, { color: subColor }]}>
            {timeAgo(post.createdAt || post.updatedAt)}
          </Text>
        </TouchableOpacity>

        {/* Sparkles / AI Badge */}
        {post.aiSummary ? (
          <TouchableOpacity
            style={styles.sparkleBtn}
            onPress={() => setAiTooltipVisible(true)}
          >
            <MaterialCommunityIcons name="creation" size={20} color="#a855f7" />
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          onPress={() => setMenuVisible(true)}
        >
          <MaterialCommunityIcons name="dots-horizontal" size={22} color={iconColor} />
        </TouchableOpacity>
      </View>

      {/* Unified Media Display with double tap to like detector */}
      <TouchableWithoutFeedback onPress={handleDoubleTap}>
        <View style={styles.mediaContainer}>
          {/* Before After View */}
          {post.isBeforeAfter && post.beforeAfter ? (
            <BeforeAfterView beforeAfter={post.beforeAfter} isDark={isDark} />
          ) : null}

          {/* Post Video */}
          {!post.isBeforeAfter && post.video ? (
            <View style={[styles.videoWrapper, { aspectRatio }]} {...panResponder.panHandlers}>
              {/* Decrypting overlay spinner */}
              {isDecryptingVideo ? (
                <View style={[styles.videoPlayOverlay, { flexDirection: 'column', gap: 8 }]}>
                  {videoThumbnailUrl ? (
                    <Image source={{ uri: videoThumbnailUrl }} style={[StyleSheet.absoluteFill]} resizeMode="contain" />
                  ) : null}
                  <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, padding: 12, alignItems: 'center', gap: 6 }}>
                    <MaterialCommunityIcons name="lock-open-outline" size={24} color="#808bf5" />
                    <Text style={{ color: '#ffffff', fontSize: 12 }}>Decrypting video…</Text>
                  </View>
                </View>
              ) : shouldRenderVideo && videoUrl ? (
                <TouchableWithoutFeedback
                  onPress={() => {
                    if (isPlaying) {
                      setUserPaused(true);
                    } else {
                      setUserPaused(false);
                    }
                  }}
                >
                  <View style={StyleSheet.absoluteFill}>
                    <VideoComponent
                      source={{ uri: videoUrl }}
                      style={styles.postVideo}
                      paused={!isPlaying}
                      resizeMode="cover"
                      controls={false}
                      ref={videoRef}
                      muted={true}
                      repeat={true}
                      playInBackground={false}
                      playWhenInactive={false}
                      onLoad={(data: any) => {
                        if (data?.naturalSize?.width && data?.naturalSize?.height) {
                          setAspectRatio(data.naturalSize.width / data.naturalSize.height);
                        }
                        if (data?.duration) {
                          setVideoDuration(data.duration);
                        }
                      }}
                      onProgress={(data: any) => {
                        if (!isScrubbing) {
                          setVideoCurrentTime(data.currentTime);
                        }
                      }}
                      onError={(e: any) => console.warn('[Video Error] Post:', post._id, e)}
                    />
                  </View>
                </TouchableWithoutFeedback>
              ) : null}

              {/* Hide thumbnail/play overlays while decrypting */}
              {!isDecryptingVideo ? (
                <>
                  {!isPlaying && videoThumbnailUrl ? (
                    <Image
                      source={{ uri: videoThumbnailUrl }}
                      style={[styles.postVideo, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}
                      resizeMode="cover"
                    />
                  ) : null}

                  {/* Play icon when post is off-screen or user hasn't interacted yet */}
                  {!isPlaying && !userPaused && (
                    <View style={[styles.videoPlayOverlay, { backgroundColor: 'rgba(0,0,0,0.15)' }]} pointerEvents="none">
                      <MaterialCommunityIcons name="play-circle-outline" size={52} color="rgba(255,255,255,0.75)" />
                    </View>
                  )}

                  {/* Resume button — only when user explicitly tapped to pause */}
                  {userPaused && !isScrubbing && (
                    <TouchableOpacity
                      style={styles.videoPlayOverlay}
                      onPress={() => setUserPaused(false)}
                    >
                      <MaterialCommunityIcons name="play-circle" size={54} color="#ffffff" />
                    </TouchableOpacity>
                  )}
                </>
              ) : null}

              {/* Scrubbing Overlay */}
              {isScrubbing && (
                <View style={styles.scrubOverlay} pointerEvents="none">
                  <MaterialCommunityIcons
                    name={scrubTime >= videoCurrentTime ? 'fast-forward' : 'rewind'}
                    size={36}
                    color="#ffffff"
                  />
                  <Text style={styles.scrubText}>
                    {formatTime(scrubTime)} / {formatTime(videoDuration)}
                  </Text>
                </View>
              )}
            </View>
          ) : null}

          {/* Post Image Carousel */}
          {!post.isBeforeAfter && !post.video && post.image_urls && post.image_urls.length > 1 ? (
            <View style={{ width: '100%', position: 'relative' }}>
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.round(x / (screenWidth - 24));
                  setActiveIndex(idx);
                }}
                scrollEventThrottle={16}
              >
                {post.image_urls.map((url: string, index: number) => (
                  <Image
                    key={index}
                    source={{ uri: resolveMediaUrl(url) }}
                    style={{ width: screenWidth - 24, aspectRatio: 1.2, borderRadius: 12 }}
                    resizeMode="cover"
                  />
                ))}
              </ScrollView>
              {/* Pagination Dots */}
              <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                {post.image_urls.map((_: any, index: number) => (
                  <View
                    key={index}
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: index === activeIndex ? '#808bf5' : '#64748b',
                    }}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {/* Post Single Image */}
          {!post.isBeforeAfter && !post.video && imageUrl && (!post.image_urls || post.image_urls.length <= 1) ? (
            <View style={{ position: 'relative', width: '100%', aspectRatio, backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)', borderRadius: 12, overflow: 'hidden' }}>
              {imageLoading && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
                  <ActivityIndicator size="small" color="#808bf5" />
                </View>
              )}
              <Animated.Image
                source={{ uri: imageUrl }}
                style={[styles.postImage, { aspectRatio, opacity: imageOpacity }]}
                resizeMode="contain"
                onLoad={handleImageLoad}
              />
            </View>
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
        <View style={[styles.voicePlayer, { backgroundColor: isDark ? '#121212' : '#f8fafc', borderColor: dividerColor }]}>
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
        <View style={{ marginBottom: 4, paddingLeft: 5, paddingRight: 5 }}>
          <Text
            style={[styles.postContent, { color: textColor, marginBottom: 0 }]}
            numberOfLines={isExpanded ? undefined : 2}
          >
            {content}
          </Text>
          {content.length > 90 && (
            <TouchableOpacity
              onPress={() => setIsExpanded(!isExpanded)}
              style={{ marginTop: 4, alignSelf: 'flex-start' }}
            >
              <Text style={{ color: '#808bf5', fontWeight: '600', fontSize: 13 }}>
                {isExpanded ? 'Show less' : '...more'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}

      {/* Mood tag */}
      {post.mood && (
        <View style={styles.moodTag}>
          <Text style={styles.moodText}>#{post.mood}</Text>
        </View>
      )}

      {/* Reaction breakdown pills */}
      {reactions && reactions.length > 0 && (
        <View style={styles.reactionsBreakdown}>
          {(() => {
            const reactionGroups = (reactions || []).reduce((acc: any, r: any) => {
              if (r.emoji !== '❤️') {
                acc[r.emoji] = (acc[r.emoji] || 0) + 1;
              }
              return acc;
            }, {});

            const myReaction = reactions.find((r: any) => {
              const rUserId = r.userId?._id?.toString() || r.userId?.toString();
              const currentUserId = loggedUser?._id?.toString();
              return r.emoji !== '❤️' && rUserId && currentUserId && rUserId === currentUserId;
            });

            return Object.entries(reactionGroups).map(([emoji, count]: any) => {
              const isMine = myReaction?.emoji === emoji;
              return (
                <TouchableOpacity
                  key={emoji}
                  onPress={async () => {
                    try {
                      const res = await api.post('/api/post/react', { postId: post._id, emoji });
                      appChannel.postMessage({ type: 'POST_REACTED', postId: post._id, reactions: res.data.reactions || [] });
                    } catch (err) {
                      console.warn('Failed to react:', err);
                    }
                  }}
                  style={[
                    styles.reactionPill,
                    isMine && { backgroundColor: 'rgba(128, 139, 245, 0.15)', borderColor: 'rgba(128, 139, 245, 0.3)' }
                  ]}
                >
                  <Text style={styles.reactionPillEmoji}>{emoji}</Text>
                  <Text style={[styles.reactionPillCount, { color: isMine ? '#808bf5' : subColor }]}>{count}</Text>
                </TouchableOpacity>
              );
            });
          })()}
        </View>
      )}

      {/* Footer Actions */}
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

        {/* Reaction Action */}
        <TouchableOpacity
          style={styles.footerAction}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          {(() => {
            const myReaction = reactions?.find((r: any) => {
              const rUserId = r.userId?._id?.toString() || r.userId?.toString();
              const currentUserId = loggedUser?._id?.toString();
              return r.emoji !== '❤️' && rUserId && currentUserId && rUserId === currentUserId;
            });
            return myReaction ? (
              <Text style={{ fontSize: 18 }}>{myReaction.emoji}</Text>
            ) : (
              <MaterialCommunityIcons name="star-outline" size={22} color={iconColor} />
            );
          })()}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerAction}
          activeOpacity={0.7}
          onPress={() => navigation.navigate('PostDetail', { postId: post._id })}
        >
          <MaterialCommunityIcons name="comment-outline" size={22} color={iconColor} />
          {post.comments && post.comments.length > 0 && (
            <Text style={[styles.actionCount, { color: subColor }]}>
              {post.comments.length}
            </Text>
          )}
        </TouchableOpacity>

        {/* Share Action */}
        <TouchableOpacity
          style={styles.footerAction}
          onPress={() => setShareVisible(true)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="send-outline" size={22} color={iconColor} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.footerAction}
          onPress={handleSaveToggle}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons
            name={saved ? 'bookmark' : 'bookmark-outline'}
            size={22}
            color={saved ? '#6366f1' : iconColor}
          />
        </TouchableOpacity>
      </View>

      {/* Share Modal Dialog */}
      <ShareModal
        visible={shareVisible}
        onClose={() => setShareVisible(false)}
        post={post}
        myUser={loggedUser}
      />

      {/* Reaction Picker overlay Modal */}
      <Modal
        visible={pickerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setPickerVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.pickerContainer, { backgroundColor: cardBg, borderColor: dividerColor }]}>
                {[
                  { emoji: '💡', label: 'Learned' },
                  { emoji: '🤝', label: 'Respect' },
                  { emoji: '🚀', label: 'Tried' },
                  { emoji: '🔖', label: 'Saved' }
                ].map((reaction) => (
                  <TouchableOpacity
                    key={reaction.emoji}
                    onPress={async () => {
                      setPickerVisible(false);
                      try {
                        const res = await api.post('/api/post/react', { postId: post._id, emoji: reaction.emoji });
                        appChannel.postMessage({ type: 'POST_REACTED', postId: post._id, reactions: res.data.reactions || [] });
                      } catch (err) {
                        console.warn('Failed to react:', err);
                      }
                    }}
                    style={styles.pickerOption}
                  >
                    <Text style={{ fontSize: 24, marginBottom: 4 }}>{reaction.emoji}</Text>
                    <Text style={{ fontSize: 10, color: subColor, fontWeight: 'bold' }}>{reaction.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>


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
          <View style={[styles.aiSummaryCard, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={styles.aiSummaryHeader}>
              <MaterialCommunityIcons name="creation" size={18} color="#a855f7" />
              <Text style={styles.aiSummaryTitle}>AI Summary</Text>
            </View>
            <Text style={[styles.aiSummaryText, { color: textColor }]}>{post.aiSummary}</Text>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Post Action Menu */}
      <PostMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        post={post}
        isSaved={saved}
        onToggleSave={(nextSaved) => setSaved(nextSaved)}
        onDeleteSuccess={() => setHidden(true)}
        onMuteBlockSuccess={() => setHidden(true)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  postCard: {
    marginBottom: 12,
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 2,
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
    padding: 6,
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
    maxHeight: 800,
    overflow: 'hidden',
    marginBottom: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',

  },
  // No fixed/min height here on purpose — actual height comes entirely from
  // the real aspect ratio (set dynamically) combined with maxHeight below,
  // so width stays 100% and height scales to fit the real media dimensions.
  videoWrapper: {
    width: '100%',
    maxHeight: 800,
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
    maxHeight: 800,
    backgroundColor: '#000000',
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
    paddingVertical: 5,
    marginBottom: 12,
    marginHorizontal: 5,
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
  scrubOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  scrubText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 8,
  },
  progressBarBg: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 15,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#808bf5',
  },
  reactionsBreakdown: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  reactionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 14,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  reactionPillEmoji: {
    fontSize: 12,
  },
  reactionPillCount: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    width: screenWidth - 48,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  pickerOption: {
    alignItems: 'center',
    padding: 8,
    flex: 1,
  },
});