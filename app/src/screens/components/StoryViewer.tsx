import { brand } from '../../theme/colors';
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
  TextInput,
  FlatList,
  Pressable,
  Animated,
  PanResponder,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
const VideoComponent = Video as any;
import { api } from '../../lib/api';
import ShareModal from './ShareModal';
import { useTheme } from '../../theme';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export interface StoryItem {
  _id: string;
  media?: {
    url: string;
    type: 'image' | 'video';
    thumbnailUrl?: string;
  };
  mediaUrl?: string; // fallback
  mediaType?: string; // fallback
  text?: {
    content?: string;
    color?: string;
    position?: 'top' | 'center' | 'bottom';
    y?: number;
  };
  visibility?: 'public' | 'followers' | 'close_friends';
  createdAt: string;
  poll?: {
    question: string;
    options: {
      text: string;
      votes: string[];
    }[];
    y?: number;
  };
  music?: {
    title: string;
    artist: string;
  };
  likes?: string[];
  viewers?: string[];
  sharedPostId?: any;
  sharedStoryId?: any;
  mentions?: any[];
  viewersCount?: number;
}

export interface GroupedStory {
  user: {
    _id: string;
    username: string;
    fullname: string;
    profile_picture?: string;
    isOnline: boolean;
  };
  stories: StoryItem[];
  hasUnviewed: boolean;
}

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👏'];
const IMAGE_DURATION_MS = 5000;
const SWIPE_DISMISS_THRESHOLD = 120;
const SWIPE_USER_THRESHOLD = 80;

interface StoryViewerProps {
  visible: boolean;
  feed: GroupedStory[];
  initialGroupIndex: number;
  myUser: any;
  isDark: boolean;
  navigation: any;
  onClose: () => void;
  onLike: (storyId: string) => void;
  onVote: (storyId: string, optionIndex: number) => void;
  onReply: (storyId: string, text: string) => Promise<void>;
  onStoriesChanged: () => void;
  onReshare: (story: StoryItem) => void;
}

function getMediaUrlAndType(story?: StoryItem) {
  if (!story) return { url: '', type: 'image' as 'image' | 'video' };
  const url = story.media?.url || story.mediaUrl || '';
  const type = (story.media?.type || story.mediaType || 'image') as 'image' | 'video';
  return { url, type };
}

export default function StoryViewer({
  visible,
  feed,
  initialGroupIndex,
  myUser,
  isDark,
  navigation,
  onClose,
  onLike,
  onVote,
  onReply,
  onStoriesChanged,
  onReshare,
}: StoryViewerProps) {
  const [activeGroupIndex, setActiveGroupIndex] = useState(initialGroupIndex);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const currentIndexRef = useRef({ group: initialGroupIndex, story: 0 });

  useEffect(() => {
    currentIndexRef.current = { group: activeGroupIndex, story: activeStoryIndex };
  }, [activeGroupIndex, activeStoryIndex]);

  const progressAnim = useRef(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const timerRef = useRef<any>(null);

  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [videoDuration, setVideoDuration] = useState<number | null>(null);

  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [burstEmoji, setBurstEmoji] = useState<string | null>(null);
  const reactionBurstScale = useRef(new Animated.Value(0)).current;

  const [viewers, setViewers] = useState<any[]>([]);
  const [viewersVisible, setViewersVisible] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  const { colors, spacing, radius } = useTheme();
  const styles = createStyles(colors, spacing, radius);

  const borderColor = colors.border;
  const textColorStyle = colors.text.primary;
  const subColor = colors.text.secondary;

  // Re-seed navigation to wherever the tray asked to open, every time the viewer opens.
  useEffect(() => {
    if (visible) {
      setActiveGroupIndex(initialGroupIndex);
      setActiveStoryIndex(0);
      progressAnim.current = 0;
      setTimerProgress(0);
      setVideoDuration(null);
    }
  }, [visible, initialGroupIndex]);

  const currentGroup = feed[activeGroupIndex];
  const currentStory = currentGroup?.stories[activeStoryIndex];
  const { url: storyMediaUrl, type: storyMediaType } = getMediaUrlAndType(currentStory);

  // Reset per-story playback state whenever the active story changes.
  useEffect(() => {
    progressAnim.current = 0;
    setTimerProgress(0);
    setVideoDuration(null);
  }, [currentStory?._id]);

  const handleNextStory = () => {
    progressAnim.current = 0;
    const group = feed[activeGroupIndex];
    if (!group) return;

    if (activeStoryIndex < group.stories.length - 1) {
      setActiveStoryIndex((prev) => prev + 1);
    } else if (activeGroupIndex < feed.length - 1) {
      setActiveGroupIndex((prev) => prev + 1);
      setActiveStoryIndex(0);
    } else {
      onClose();
    }
  };

  const handlePrevStory = () => {
    progressAnim.current = 0;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
    } else if (activeGroupIndex > 0) {
      setActiveGroupIndex((prev) => prev - 1);
      const prevGroup = feed[activeGroupIndex - 1];
      setActiveStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
    }
  };

  // Swipe left/right jumps to the next/previous PERSON's story stack (distinct from
  // tapping, which just advances within the current person's stack).
  const goToNextUser = () => {
    if (activeGroupIndex < feed.length - 1) {
      setActiveGroupIndex((prev) => prev + 1);
      setActiveStoryIndex(0);
    } else {
      onClose();
    }
  };

  const goToPrevUser = () => {
    if (activeGroupIndex > 0) {
      setActiveGroupIndex((prev) => prev - 1);
      setActiveStoryIndex(0);
    }
  };

  // Story playback timer — waits for a video's real duration (reported via onLoad)
  // before starting, instead of the old hardcoded 15s guess that would desync the bar.
  useEffect(() => {
    if (!visible || isPaused || !currentStory) {
      clearInterval(timerRef.current);
      return;
    }

    const isVideo = storyMediaType === 'video';
    if (isVideo && videoDuration == null) {
      clearInterval(timerRef.current);
      return;
    }

    const totalDuration = isVideo ? (videoDuration as number) : IMAGE_DURATION_MS;
    const intervalTime = 100;
    const steps = totalDuration / intervalTime;

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      progressAnim.current += 1;
      setTimerProgress(progressAnim.current / steps);

      if (progressAnim.current >= steps) {
        clearInterval(timerRef.current);
        progressAnim.current = 0;
        handleNextStory();
      }
    }, intervalTime);

    if (progressAnim.current === 1) {
      api.post(`/api/story/view/${currentStory._id}`).catch(() => { });
    }

    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, activeGroupIndex, activeStoryIndex, isPaused, videoDuration, currentStory?._id]);

  // Preload whatever tapping-forward would load next, so advancing never shows a blank
  // frame/spinner — same idea as the Reels feed's isPreload pattern.
  const getNextStoryRef = (): StoryItem | null => {
    const group = feed[activeGroupIndex];
    if (!group) return null;
    if (activeStoryIndex < group.stories.length - 1) return group.stories[activeStoryIndex + 1];
    const nextGroup = feed[activeGroupIndex + 1];
    return nextGroup?.stories[0] || null;
  };
  const nextStory = getNextStoryRef();
  const nextMedia = getMediaUrlAndType(nextStory || undefined);
  useEffect(() => {
    if (nextMedia.type === 'image' && nextMedia.url) {
      Image.prefetch(nextMedia.url).catch(() => { });
    }
  }, [nextMedia.url, nextMedia.type]);

  const handleSendReply = async (storyId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);
    try {
      await onReply(storyId, replyText.trim());
      Alert.alert('Sent', 'Story reply sent as a Direct Message!');
      setReplyText('');
    } catch (e: any) {
      Alert.alert('Reply Error', e.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const handleQuickReact = (storyId: string, emoji: string) => {
    setBurstEmoji(emoji);
    reactionBurstScale.setValue(0);
    Animated.sequence([
      Animated.spring(reactionBurstScale, { toValue: 1.3, friction: 3, useNativeDriver: true }),
      Animated.timing(reactionBurstScale, { toValue: 0, duration: 400, delay: 300, useNativeDriver: true }),
    ]).start(() => setBurstEmoji(null));
    onReply(storyId, emoji).catch((e) => console.warn('[StoryViewer] quick reaction failed:', e));
  };

  const handleDeleteStory = (storyId: string) => {
    setIsPaused(true);
    Alert.alert('Delete Story', 'Are you sure you want to delete this story?', [
      { text: 'Cancel', style: 'cancel', onPress: () => setIsPaused(false) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/api/story/${storyId}`);
            onClose();
            onStoriesChanged();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete story.');
            setIsPaused(false);
          }
        },
      },
    ]);
  };

  // ── Gestures: swipe down to dismiss, swipe left/right between users ──────────────
  // Built on PanResponder (no gesture-handler dependency in this project). Only
  // captures real drags (onMoveShouldSetPanResponder gates on a small threshold) so
  // simple taps on the left/right skip zones below still work untouched — the same
  // technique already used for video scrubbing in PostItem.tsx.
  const translateY = useRef(new Animated.Value(0)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const gestureDirection = useRef<'none' | 'vertical' | 'horizontal'>('none');

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_evt, g) => Math.abs(g.dx) > 10 || Math.abs(g.dy) > 10,
      onPanResponderGrant: () => {
        gestureDirection.current = 'none';
        setIsPaused(true);
      },
      onPanResponderMove: (_evt, g) => {
        if (gestureDirection.current === 'none') {
          gestureDirection.current = Math.abs(g.dy) > Math.abs(g.dx) ? 'vertical' : 'horizontal';
        }
        if (gestureDirection.current === 'vertical') {
          translateY.setValue(g.dy);
        } else {
          translateX.setValue(g.dx);
        }
      },
      onPanResponderRelease: (_evt, g) => {
        if (gestureDirection.current === 'vertical') {
          if (g.dy > SWIPE_DISMISS_THRESHOLD || g.vy > 1.2) {
            Animated.timing(translateY, { toValue: screenHeight, duration: 200, useNativeDriver: true }).start(() => {
              translateY.setValue(0);
              onClose();
            });
          } else if (g.dy < -50 || g.vy < -1.2) {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
            const currentGroup = feed[currentIndexRef.current.group];
            const currentStory = currentGroup?.stories?.[currentIndexRef.current.story];
            if (currentGroup?.user?._id === myUser?._id && currentStory) {
              setIsPaused(true);
              setLoadingViewers(true);
              setViewersVisible(true);
              api.get(`/api/story/viewers/${currentStory._id}`).then(res => {
                setViewers(res.data || []);
              }).catch(e => {
                console.warn('Failed to fetch viewers on swipe:', e);
              }).finally(() => {
                setLoadingViewers(false);
              });
            } else {
              setIsPaused(false);
            }
          } else {
            Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
            setIsPaused(false);
          }
        } else if (gestureDirection.current === 'horizontal') {
          if (g.dx < -SWIPE_USER_THRESHOLD) {
            Animated.timing(translateX, { toValue: -screenWidth, duration: 150, useNativeDriver: true }).start(() => {
              translateX.setValue(0);
              goToNextUser();
              setIsPaused(false);
            });
          } else if (g.dx > SWIPE_USER_THRESHOLD) {
            Animated.timing(translateX, { toValue: screenWidth, duration: 150, useNativeDriver: true }).start(() => {
              translateX.setValue(0);
              goToPrevUser();
              setIsPaused(false);
            });
          } else {
            Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
            setIsPaused(false);
          }
        } else {
          setIsPaused(false);
        }
        gestureDirection.current = 'none';
      },
      onPanResponderTerminate: () => {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
        setIsPaused(false);
        gestureDirection.current = 'none';
      },
    })
  ).current;

  const dismissOpacity = translateY.interpolate({
    inputRange: [0, screenHeight],
    outputRange: [1, 0.3],
    extrapolate: 'clamp',
  });

  if (!visible) return null;

  const isReshareBg = !!(currentStory?.sharedPostId || currentStory?.sharedStoryId);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.playerContainer}>
        {currentGroup && currentStory && (
          <Animated.View
            style={[
              styles.playerContent,
              {
                opacity: dismissOpacity,
                transform: [{ translateY }, { translateX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Background media */}
            {storyMediaType === 'video' ? (
              <VideoComponent
                source={{ uri: storyMediaUrl }}
                style={[styles.playerMedia, { opacity: isReshareBg ? 0.6 : 1 }]}
                resizeMode={isReshareBg ? 'cover' : 'contain'}
                paused={isPaused}
                muted={isMuted}
                repeat={false}
                onLoad={(data: any) => {
                  if (data?.duration) setVideoDuration(data.duration * 1000);
                }}
                onEnd={handleNextStory}
                onError={(e: any) => console.warn('[StoryViewer] video error:', e)}
              />
            ) : (
              <Image
                source={{ uri: storyMediaUrl }}
                style={[styles.playerMedia, { opacity: isReshareBg ? 0.6 : 1 }]}
                resizeMode={isReshareBg ? 'cover' : 'contain'}
                blurRadius={isReshareBg ? 35 : 0}
              />
            )}

            {/* Hidden preload of the next story's video so advancing never buffers */}
            {nextMedia.type === 'video' && nextMedia.url ? (
              <VideoComponent
                source={{ uri: nextMedia.url }}
                style={styles.preloadVideo}
                paused
                muted
                repeat={false}
              />
            ) : null}

            {/* Tap skip zones */}
            <View style={styles.gestureOverlay}>
              <Pressable
                style={styles.leftTap}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
                onPress={handlePrevStory}
              />
              <Pressable
                style={styles.rightTap}
                onPressIn={() => setIsPaused(true)}
                onPressOut={() => setIsPaused(false)}
                onPress={handleNextStory}
              />
            </View>

            {/* Header bars */}
            <View style={styles.progressHeaderContainer}>
              <View style={styles.progressBarRow}>
                {currentGroup.stories.map((s, idx) => {
                  let progress = 0;
                  if (idx < activeStoryIndex) progress = 1;
                  if (idx === activeStoryIndex) progress = timerProgress;
                  return (
                    <View key={s._id} style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
                    </View>
                  );
                })}
              </View>

              <View style={styles.playerUserInfoRow}>
                {currentGroup.user.profile_picture ? (
                  <Image source={{ uri: currentGroup.user.profile_picture }} style={styles.playerAvatar} />
                ) : (
                  <View style={[styles.playerAvatar, { backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }]}>
                    <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{currentGroup.user.fullname[0]}</Text>
                  </View>
                )}
                <Text style={styles.playerUsername}>{currentGroup.user.username}</Text>

                {currentStory.visibility === 'close_friends' && (
                  <View style={styles.closeFriendsBadge}>
                    <Text style={styles.closeFriendsText}>Close Friends</Text>
                  </View>
                )}

                {storyMediaType === 'video' && (
                  <TouchableOpacity style={styles.muteBtn} onPress={() => setIsMuted((m) => !m)}>
                    <MaterialCommunityIcons name={isMuted ? 'volume-mute' : 'volume-high'} size={22} color="#ffffff" />
                  </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.playerCloseBtn} onPress={onClose}>
                  <MaterialCommunityIcons name="close" size={26} color="#ffffff" />
                </TouchableOpacity>
              </View>
            </View>

            {/* Music overlay tag */}
            {currentStory.music && currentStory.music.title ? (
              <View style={styles.musicOverlayBadge}>
                <MaterialCommunityIcons name="music-note" size={16} color="#ffffff" />
                <Text style={styles.musicOverlayText} numberOfLines={1}>
                  {currentStory.music.title} - {currentStory.music.artist || 'Unknown Artist'}
                </Text>
              </View>
            ) : null}

            {/* Rich text overlay caption */}
            {currentStory.text && currentStory.text.content ? (
              <View
                style={[
                  styles.textOverlayContainer,
                  currentStory.text.position === 'top' && { top: '20%' },
                  currentStory.text.position === 'center' && { top: '45%' },
                  currentStory.text.position === 'bottom' && { top: '75%' },
                  currentStory.text.y !== undefined && { top: `${currentStory.text.y}%` },
                ]}
              >
                <Text style={[styles.textOverlayContent, { color: currentStory.text.color || '#ffffff' }]}>
                  {currentStory.text.content}
                </Text>
              </View>
            ) : null}

            {/* Tagged/Mentioned Users Overlay */}
            {currentStory.mentions && currentStory.mentions.length > 0 && (
              <View style={styles.mentionsOverlayContainer}>
                {currentStory.mentions.map((m: any) => {
                  const uid = m?._id || m;
                  const name = m?.username || m?.fullname || 'user';
                  return (
                    <TouchableOpacity
                      key={uid?.toString?.() || Math.random().toString()}
                      style={styles.mentionChip}
                      onPress={() => {
                        setIsPaused(true);
                        Alert.alert('Mention', `@${name}`, [{ text: 'OK', onPress: () => setIsPaused(false) }]);
                      }}
                    >
                      <MaterialCommunityIcons name="account" size={10} color="#ffffff" />
                      <Text style={styles.mentionChipText}>@{name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Mention-back / Reshare Button */}
            {currentGroup.user._id !== myUser?._id &&
              currentStory.mentions?.some((m: any) => (m._id || m).toString() === myUser?._id?.toString()) && (
                <TouchableOpacity
                  style={styles.reshareBtn}
                  onPress={() => {
                    onClose();
                    onReshare(currentStory);
                  }}
                >
                  <MaterialCommunityIcons name="flash" size={14} color="#ffffff" />
                  <Text style={styles.reshareBtnText}>Add to your Story</Text>
                </TouchableOpacity>
              )}

            {/* Reshared Post Sticker Card */}
            {currentStory.sharedPostId && (
              <TouchableOpacity
                style={styles.stickerCard}
                activeOpacity={0.9}
                onPress={() => {
                  setIsPaused(true);
                  const pid = currentStory.sharedPostId._id || currentStory.sharedPostId.id || currentStory.sharedPostId;
                  if (pid) {
                    Alert.alert('Open Post', 'Would you like to view this post?', [
                      { text: 'Cancel', onPress: () => setIsPaused(false), style: 'cancel' },
                      {
                        text: 'View Post',
                        onPress: () => {
                          setIsPaused(false);
                          onClose();
                          navigation.navigate('PostDetail', { postId: pid.toString() });
                        },
                      },
                    ]);
                  }
                }}
              >
                <View style={styles.stickerHeader}>
                  {currentStory.sharedPostId.user?.profile_picture ? (
                    <Image source={{ uri: currentStory.sharedPostId.user.profile_picture }} style={styles.stickerAvatar} />
                  ) : (
                    <View style={[styles.stickerAvatar, { backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
                        {currentStory.sharedPostId.user?.fullname?.[0]?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stickerName} numberOfLines={1}>{currentStory.sharedPostId.user?.fullname}</Text>
                    <Text style={styles.stickerSub} numberOfLines={1}>Social Square Post</Text>
                  </View>
                  <MaterialCommunityIcons name="instagram" size={16} color="#9ca3af" />
                </View>
                <View style={styles.stickerMediaContainer}>
                  <Image
                    source={{
                      uri:
                        currentStory.sharedPostId.image_urls?.[0] ||
                        currentStory.sharedPostId.image_url ||
                        'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80',
                    }}
                    style={styles.stickerMedia1to1}
                    resizeMode="cover"
                  />
                </View>
                {currentStory.sharedPostId.caption ? (
                  <Text style={styles.stickerCaption} numberOfLines={2}>{currentStory.sharedPostId.caption}</Text>
                ) : null}
              </TouchableOpacity>
            )}

            {/* Reshared Story Sticker Card */}
            {currentStory.sharedStoryId && (
              <TouchableOpacity
                style={styles.stickerCard}
                activeOpacity={0.9}
                onPress={() => {
                  setIsPaused(true);
                  const originalUser = currentStory.sharedStoryId.user?.username || currentStory.sharedStoryId.user?._id;
                  if (originalUser) {
                    Alert.alert('View Story', `Would you like to view @${originalUser}'s original story?`, [
                      { text: 'Cancel', onPress: () => setIsPaused(false), style: 'cancel' },
                      {
                        text: 'View',
                        onPress: () => {
                          setIsPaused(false);
                          const grpIdx = feed.findIndex((g) => g.user._id === currentStory.sharedStoryId.user?._id);
                          if (grpIdx !== -1) {
                            setActiveGroupIndex(grpIdx);
                            setActiveStoryIndex(0);
                          } else {
                            Alert.alert('Notice', 'This story group is no longer active.');
                          }
                        },
                      },
                    ]);
                  }
                }}
              >
                <View style={styles.stickerHeader}>
                  {currentStory.sharedStoryId.user?.profile_picture ? (
                    <Image source={{ uri: currentStory.sharedStoryId.user.profile_picture }} style={styles.stickerAvatar} />
                  ) : (
                    <View style={[styles.stickerAvatar, { backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
                        {currentStory.sharedStoryId.user?.fullname?.[0]?.toUpperCase() || 'U'}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stickerName} numberOfLines={1}>{currentStory.sharedStoryId.user?.fullname}</Text>
                    <Text style={styles.stickerSub} numberOfLines={1}>Social Square Story</Text>
                  </View>
                  <MaterialCommunityIcons name="layers" size={16} color="#9ca3af" />
                </View>
                <View style={styles.stickerMediaContainer9to16}>
                  <Image
                    source={{ uri: currentStory.sharedStoryId.media?.url }}
                    style={styles.stickerMedia9to16}
                    resizeMode="cover"
                  />

                  {currentStory.sharedStoryId.text && currentStory.sharedStoryId.text.content ? (
                    <View
                      style={[
                        styles.miniTextOverlayContainer,
                        currentStory.sharedStoryId.text.position === 'top' && { top: '15%' },
                        currentStory.sharedStoryId.text.position === 'center' && { top: '45%' },
                        currentStory.sharedStoryId.text.position === 'bottom' && { top: '75%' },
                        currentStory.sharedStoryId.text.y !== undefined && { top: `${currentStory.sharedStoryId.text.y}%` },
                      ]}
                    >
                      <Text style={[styles.miniTextOverlayContent, { color: currentStory.sharedStoryId.text.color || '#ffffff' }]}>
                        {currentStory.sharedStoryId.text.content}
                      </Text>
                    </View>
                  ) : null}

                  {currentStory.sharedStoryId.poll && currentStory.sharedStoryId.poll.question ? (
                    <View style={[styles.miniPollCard, { top: currentStory.sharedStoryId.poll.y !== undefined ? `${currentStory.sharedStoryId.poll.y}%` : '28%' }]}>
                      <Text style={styles.miniPollQuestion} numberOfLines={1}>{currentStory.sharedStoryId.poll.question}</Text>
                      <View style={styles.miniPollOptionsRow}>
                        {currentStory.sharedStoryId.poll.options.map((opt: any) => (
                          <View key={opt.text} style={styles.miniPollOptionBtn}>
                            <Text style={styles.miniPollOptionText}>{opt.text}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            )}

            {/* Interactive Poll card */}
            {currentStory.poll && currentStory.poll.question ? (
              <View style={[styles.pollCard, { top: currentStory.poll.y !== undefined ? `${currentStory.poll.y}%` : '28%' }]}>
                <Text style={styles.pollQuestion}>{currentStory.poll.question}</Text>
                <View style={styles.pollOptionsRow}>
                  {currentStory.poll.options.map((opt, optIdx) => {
                    const votes = opt.votes || [];
                    const totalVotes = (currentStory.poll?.options || []).reduce((acc, cur) => acc + (cur.votes || []).length, 0);
                    const hasVoted = (currentStory.poll?.options || []).some((o) =>
                      (o.votes || []).some((vId) => vId.toString() === myUser?._id?.toString())
                    );
                    const votePercent = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;

                    return (
                      <TouchableOpacity
                        key={opt.text}
                        style={[styles.pollOptionBtn, hasVoted && styles.pollOptionVoted]}
                        onPress={() => !hasVoted && onVote(currentStory._id, optIdx)}
                        disabled={hasVoted}
                      >
                        {hasVoted ? (
                          <View style={styles.pollVotedWrapper}>
                            <Text style={styles.pollOptionText}>{opt.text}</Text>
                            <Text style={styles.pollPercentText}>{votePercent}%</Text>
                          </View>
                        ) : (
                          <Text style={styles.pollOptionText}>{opt.text}</Text>
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {/* Quick emoji reaction burst */}
            {burstEmoji && (
              <Animated.View style={[styles.reactionBurst, { transform: [{ scale: reactionBurstScale }] }]} pointerEvents="none">
                <Text style={{ fontSize: 80 }}>{burstEmoji}</Text>
              </Animated.View>
            )}

            {/* Story Actions & Reply compose footer */}
            {currentGroup.user._id === myUser?._id ? (
              <View style={styles.ownerFooterRow}>
                <TouchableOpacity
                  style={styles.viewsBtn}
                  onPress={async () => {
                    setIsPaused(true);
                    setLoadingViewers(true);
                    setViewersVisible(true);
                    try {
                      const res = await api.get(`/api/story/viewers/${currentStory._id}`);
                      setViewers(res.data || []);
                    } catch (e) {
                      console.warn('Failed to fetch viewers:', e);
                    } finally {
                      setLoadingViewers(false);
                    }
                  }}
                >
                  <MaterialCommunityIcons name="eye" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#ffffff', fontWeight: 'bold', fontSize: 14 }}>
                    {(currentStory.viewersCount || (currentStory.viewers || []).length)} Views
                  </Text>
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => { setIsPaused(true); setShareVisible(true); }}>
                    <MaterialCommunityIcons name="send-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '-25deg' }] }} />
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.deleteStoryBtn} onPress={() => handleDeleteStory(currentStory._id)}>
                    <MaterialCommunityIcons name="delete-outline" size={24} color={colors.danger} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <View style={styles.quickReactionsRow}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.quickReactionBtn}
                      onPress={() => handleQuickReact(currentStory._id, emoji)}
                    >
                      <Text style={{ fontSize: 22 }}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View style={styles.playerFooterRow}>
                  <TextInput
                    style={styles.replyInput}
                    placeholder="Send message..."
                    placeholderTextColor="rgba(255,255,255,0.7)"
                    value={replyText}
                    onChangeText={setReplyText}
                    onSubmitEditing={() => handleSendReply(currentStory._id)}
                  />

                  {replyText.trim().length > 0 ? (
                    <TouchableOpacity style={styles.actionBtn} onPress={() => handleSendReply(currentStory._id)} disabled={sendingReply}>
                      {sendingReply ? <ActivityIndicator size="small" color={brand.primaryInverse} /> : <MaterialCommunityIcons name="send" size={24} color="#ffffff" />}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity style={styles.actionBtn} onPress={() => onLike(currentStory._id)}>
                        <MaterialCommunityIcons
                          name={(currentStory.likes || []).some((id) => id.toString() === myUser?._id?.toString()) ? 'heart' : 'heart-outline'}
                          size={28}
                          color={(currentStory.likes || []).some((id) => id.toString() === myUser?._id?.toString()) ? colors.danger : '#ffffff'}
                        />
                      </TouchableOpacity>

                      <TouchableOpacity style={styles.actionBtn} onPress={() => { setIsPaused(true); setShareVisible(true); }}>
                        <MaterialCommunityIcons name="send-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '-25deg' }] }} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}

            {/* Viewers list modal */}
            <Modal
              visible={viewersVisible}
              transparent
              animationType="slide"
              onRequestClose={() => { setViewersVisible(false); setIsPaused(false); }}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
                  <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                    <Text style={[styles.modalTitle, { color: textColorStyle }]}>Viewers ({viewers.length})</Text>
                    <TouchableOpacity onPress={() => { setViewersVisible(false); setIsPaused(false); }}>
                      <MaterialCommunityIcons name="close" size={24} color={textColorStyle} />
                    </TouchableOpacity>
                  </View>

                  {loadingViewers ? (
                    <ActivityIndicator size="large" color={colors.primaryMuted} style={{ marginVertical: 40 }} />
                  ) : viewers.length === 0 ? (
                    <Text style={{ color: subColor, textAlign: 'center', marginVertical: 40 }}>No views yet</Text>
                  ) : (
                    <FlatList
                      data={viewers}
                      keyExtractor={(item) => item._id}
                      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
                      renderItem={({ item }) => {
                        const hasLiked = (currentStory?.likes || []).some((likeId) => likeId.toString() === item._id.toString());
                        return (
                          <View style={[styles.viewerItem, { borderBottomColor: borderColor }]}>
                            {item.profile_picture ? (
                              <Image source={{ uri: item.profile_picture }} style={styles.viewerAvatar} />
                            ) : (
                              <View style={[styles.viewerAvatar, { backgroundColor: colors.primaryMuted, justifyContent: 'center', alignItems: 'center' }]}>
                                <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{item.fullname[0]}</Text>
                              </View>
                            )}
                            <View style={{ flex: 1, marginLeft: 12 }}>
                              <Text style={[styles.viewerName, { color: textColorStyle }]}>{item.fullname}</Text>
                              <Text style={{ color: subColor, fontSize: 12 }}>@{item.username}</Text>
                            </View>
                            {hasLiked && <MaterialCommunityIcons name="heart" size={20} color={colors.danger} />}
                          </View>
                        );
                      }}
                    />
                  )}
                </View>
              </View>
            </Modal>

            <ShareModal
              visible={shareVisible}
              onClose={() => { setShareVisible(false); setIsPaused(false); }}
              story={currentStory}
              myUser={myUser}
            />
          </Animated.View>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (colors: ReturnType<typeof useTheme>['colors'], spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) => StyleSheet.create({
  // Immersive full-bleed media backdrop — intentionally fixed black regardless of app theme.
  playerContainer: { flex: 1, backgroundColor: '#000000' },
  playerContent: { flex: 1, position: 'relative' },
  playerMedia: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000000' },
  preloadVideo: { position: 'absolute', width: 1, height: 1, opacity: 0, top: -10, left: -10 },
  gestureOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  leftTap: { flex: 1 },
  rightTap: { flex: 2 },
  progressHeaderContainer: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 50, paddingHorizontal: spacing.sm },
  progressBarRow: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.md },
  progressBarTrack: { flex: 1, height: 2.5, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: '#ffffff' },
  playerUserInfoRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  playerAvatar: { width: 32, height: 32, borderRadius: radius.full, marginRight: 10 },
  playerUsername: { color: '#ffffff', fontWeight: 'bold', fontSize: 14, flex: 1 },
  closeFriendsBadge: { backgroundColor: 'rgba(74, 222, 128, 0.25)', borderRadius: 10, paddingHorizontal: spacing.sm, paddingVertical: 3, marginRight: spacing.sm },
  closeFriendsText: { color: '#4ade80', fontSize: 10, fontWeight: 'bold' },
  muteBtn: { padding: 6, marginRight: spacing.xs },
  playerCloseBtn: { padding: 6 },
  musicOverlayBadge: {
    position: 'absolute', top: 110, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, paddingHorizontal: spacing.md, paddingVertical: 6, maxWidth: screenWidth - 80, gap: 6,
  },
  musicOverlayText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  textOverlayContainer: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  textOverlayContent: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 6 },
  mentionsOverlayContainer: { position: 'absolute', top: 160, left: 16, right: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mentionChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: radius.md, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: spacing.xs },
  mentionChipText: { color: '#ffffff', fontSize: 11, fontWeight: '600' },
  reshareBtn: {
    position: 'absolute', bottom: 140, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(128,139,245,0.85)', borderRadius: 20, paddingHorizontal: 14, paddingVertical: spacing.sm, gap: 6,
  },
  reshareBtnText: { color: brand.primaryInverse, fontSize: 12, fontWeight: 'bold' },
  stickerCard: {
    position: 'absolute', top: '28%', alignSelf: 'center', width: 260, backgroundColor: 'rgba(20,20,20,0.85)',
    borderRadius: radius.lg, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  stickerHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  stickerAvatar: { width: 24, height: 24, borderRadius: radius.full },
  stickerName: { color: '#ffffff', fontSize: 12, fontWeight: 'bold' },
  stickerSub: { color: '#9ca3af', fontSize: 10 },
  stickerMediaContainer: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  stickerMedia1to1: { width: '100%', height: '100%' },
  stickerMediaContainer9to16: { width: '100%', aspectRatio: 9 / 16, borderRadius: 10, overflow: 'hidden', position: 'relative' },
  stickerMedia9to16: { width: '100%', height: '100%' },
  stickerCaption: { color: '#e5e7eb', fontSize: 12, marginTop: spacing.sm },
  sizeCycleBtn: {
    position: 'absolute', bottom: 40, alignSelf: 'center', flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: radius.lg, paddingHorizontal: 10, paddingVertical: 6,
  },
  miniTextOverlayContainer: { position: 'absolute', left: 12, right: 12, alignItems: 'center' },
  miniTextOverlayContent: { fontSize: 13, fontWeight: 'bold', textAlign: 'center' },
  miniPollCard: { position: 'absolute', left: 12, right: 12, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: spacing.sm },
  miniPollQuestion: { color: '#ffffff', fontSize: 11, fontWeight: 'bold', marginBottom: 4, textAlign: 'center' },
  miniPollOptionsRow: { flexDirection: 'row', gap: spacing.xs, justifyContent: 'center' },
  miniPollOptionBtn: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  miniPollOptionText: { color: '#ffffff', fontSize: 10, fontWeight: '600' },
  pollCard: { position: 'absolute', left: 24, right: 24, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: radius.lg, padding: 14 },
  pollQuestion: { color: '#ffffff', fontSize: 16, fontWeight: 'bold', textAlign: 'center', marginBottom: 10 },
  pollOptionsRow: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'center', flexWrap: 'wrap' },
  pollOptionBtn: { backgroundColor: 'rgba(255,255,255,0.9)', borderRadius: 20, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, minWidth: 90, alignItems: 'center' },
  pollOptionVoted: { backgroundColor: 'rgba(128,139,245,0.9)' },
  pollVotedWrapper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pollOptionText: { color: '#1f2937', fontWeight: 'bold', fontSize: 13 },
  pollPercentText: { color: '#ffffff', fontWeight: 'bold', fontSize: 13 },
  reactionBurst: { position: 'absolute', top: '45%', left: '50%', marginTop: -50, marginLeft: -50, justifyContent: 'center', alignItems: 'center', zIndex: 60 },
  quickReactionsRow: {
    position: 'absolute', bottom: 78, left: 16, right: 16, flexDirection: 'row', justifyContent: 'space-evenly',
    backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: radius.xl, paddingVertical: spacing.sm,
  },
  quickReactionBtn: { paddingHorizontal: spacing.sm, paddingVertical: 2 },
  ownerFooterRow: {
    position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  viewsBtn: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 4 },
  deleteStoryBtn: { padding: 4 },
  playerFooterRow: {
    position: 'absolute', bottom: 24, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: spacing.md,
  },
  replyInput: {
    flex: 1, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: spacing.lg, color: '#ffffff',
  },
  // Viewers-list bottom sheet — genuinely theme-tracking chrome (unlike the media overlays above).
  modalOverlay: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: 1 },
  modalTitle: { fontSize: 16, fontWeight: 'bold' },
  viewerItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  viewerAvatar: { width: 40, height: 40, borderRadius: radius.full },
  viewerName: { fontWeight: '600', fontSize: 14 },
});
