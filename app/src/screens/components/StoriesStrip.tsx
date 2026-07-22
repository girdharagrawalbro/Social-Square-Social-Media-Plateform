import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  Dimensions,
  useColorScheme,
  Alert,
  TextInput,
  Switch,
  FlatList,
  Pressable,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import { api } from '../../lib/api';
import { getCache, setCache, TTL } from '../../lib/cache';
import { appChannel } from '../../lib/broadcast';
import { useBroadcast } from '../../lib/useBroadcast';
import useAuthStore from '../../store/zustand/useAuthStore';
import { usePostHog } from 'posthog-react-native';
import { useLiveStore } from '../../store/zustand/useLiveStore';
import { useNavigation } from '@react-navigation/native';
import ShareModal from './ShareModal';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const playerHeight = Math.min(screenHeight, screenWidth * (16 / 9));

interface StoryItem {
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

interface GroupedStory {
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

const COLOR_OPTIONS = ['#ffffff', '#facc15', '#60a5fa', '#f87171', '#4ade80', '#c084fc'];

export default function StoriesStrip() {
  const isDark = useColorScheme() === 'dark';
  const myUser = useAuthStore((s: any) => s.user);
  const { setLiveStream } = useLiveStore();
  const navigation = useNavigation<any>();
  const [feed, setFeed] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeStreams, setActiveStreams] = useState<any[]>([]);

  const fetchActiveStreams = async () => {
    try {
      const res = await api.get('/api/live/active');
      setActiveStreams(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.warn('Failed to fetch active streams:', err);
    }
  };

  const handleGoLive = async () => {
    try {
      const res = await api.post('/api/live/start', { title: `${myUser?.fullname}'s Live Stream` });
      const stream = res.data;
      if (stream?._id) {
        setLiveStream(stream._id, true);
        Alert.alert('Success', 'Live stream started successfully!');
      }
    } catch (err: any) {
      console.warn('Failed to start live stream:', err);
      Alert.alert('Error', err.response?.data?.error || 'Could not start live stream');
    }
  };

  // Stories player modal state
  const [playerVisible, setPlayerVisible] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const progressAnim = useRef(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const timerRef = useRef<any>(null);

  // Stories player interactive elements
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [viewers, setViewers] = useState<any[]>([]);
  const [viewersVisible, setViewersVisible] = useState(false);
  const [loadingViewers, setLoadingViewers] = useState(false);
  const [shareVisible, setShareVisible] = useState(false);

  // Story creation modal state
  const [createVisible, setCreateVisible] = useState(false);
  const [pickerMenuVisible, setPickerMenuVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  // Rich Creator states
  const [storyText, setStoryText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');

  const posthog = usePostHog();
  useEffect(() => {
    if (createVisible) {
      try {
        posthog?.startSessionRecording();
      } catch (e) {
        console.error("Failed to start session recording:", e);
      }
    } else {
      try {
        posthog?.stopSessionRecording();
      } catch (e) {
        console.error("Failed to stop session recording:", e);
      }
    }
  }, [createVisible, posthog]);

  // Poll Composer States
  const [hasPoll, setHasPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');

  // Music Composer States
  const [hasMusic, setHasMusic] = useState(false);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');
  
  // Reshared Story State
  const [resharedStory, setResharedStory] = useState<any>(null);
  const [stickerSize, setStickerSize] = useState<'small' | 'medium' | 'large'>('medium');

  const bg = isDark ? '#000000' : '#f1f5f9';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const textColorStyle = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1a1a1a' : '#e2e8f0';

  const filterExpiredStories = (groupedStories: GroupedStory[]): GroupedStory[] => {
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();
    return groupedStories
      .map(group => ({
        ...group,
        stories: group.stories.filter(story => {
          const createdTime = new Date(story.createdAt).getTime();
          return now - createdTime < ONE_DAY_MS;
        })
      }))
      .filter(group => group.stories.length > 0);
  };

  const fetchStories = async () => {
    try {
      // Load from cache first so strip renders instantly on app open
      const cached = await getCache<GroupedStory[]>('stories_feed');
      if (cached && cached.length > 0) {
        setFeed(filterExpiredStories(cached));
      }
      const res = await api.get('/api/story/feed');
      const fresh = res.data || [];
      const filteredFresh = filterExpiredStories(fresh);
      setFeed(filteredFresh);
      await setCache('stories_feed', filteredFresh, TTL.STORIES);
    } catch (e) {
      console.warn('Failed to fetch stories feed:', e);
    }
  };

  useEffect(() => {
    fetchStories();
    fetchActiveStreams();
    const interval = setInterval(fetchActiveStreams, 15000);
    return () => clearInterval(interval);
  }, []);

  useBroadcast('STORY_CREATED', React.useCallback(() => {
    fetchStories();
  }, []));

  useBroadcast('STORY_DELETED', React.useCallback(() => {
    fetchStories();
  }, []));

  // Story playback timer logic
  useEffect(() => {
    if (!playerVisible || feed.length === 0 || isPaused) {
      clearInterval(timerRef.current);
      return;
    }

    const currentGroup = feed[activeGroupIndex];
    if (!currentGroup || !currentGroup.stories || currentGroup.stories.length === 0) {
      return;
    }

    const currentStory = currentGroup.stories[activeStoryIndex];
    const isVideo = currentStory?.media?.type === 'video' || currentStory?.mediaType === 'video';
    const totalDuration = isVideo ? 15000 : 5000;

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

    if (currentStory && progressAnim.current === 1) {
      api.post(`/api/story/view/${currentStory._id}`).catch(() => { });
    }

    return () => clearInterval(timerRef.current);
  }, [playerVisible, activeGroupIndex, activeStoryIndex, isPaused]);

  const handleNextStory = () => {
    progressAnim.current = 0;
    const currentGroup = feed[activeGroupIndex];
    if (!currentGroup) return;

    if (activeStoryIndex < currentGroup.stories.length - 1) {
      setActiveStoryIndex((prev) => prev + 1);
    } else {
      if (activeGroupIndex < feed.length - 1) {
        setActiveGroupIndex((prev) => prev + 1);
        setActiveStoryIndex(0);
      } else {
        setPlayerVisible(false);
      }
    }
  };

  const handlePrevStory = () => {
    progressAnim.current = 0;
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
    } else {
      if (activeGroupIndex > 0) {
        setActiveGroupIndex((prev) => prev - 1);
        const prevGroup = feed[activeGroupIndex - 1];
        setActiveStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
      }
    }
  };

  // Opens camera/gallery choice — the proper way, like Instagram/WhatsApp
  const handlePickMedia = () => {
    setPickerMenuVisible(true);
  };

  const handleChangeMedia = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.8,
      });
      if (result.didCancel) return;
      if (result.errorMessage) {
        Alert.alert('Error', result.errorMessage);
        return;
      }
      if (!result.assets || result.assets.length === 0) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      setSelectedUri(asset.uri);
      setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
    } catch (e: any) {
      console.warn('[handleChangeMedia Error]:', e);
      Alert.alert('Picker Exception', 'Your device does not support the system image picker intent.');
    }
  };

  const handlePublishStory = async () => {
    if (!selectedUri) return;
    setUploading(true);

    try {
      let finalMediaUrl = selectedUri;

      // 1. Upload if it's a local file
      if (!selectedUri.startsWith('http')) {
        const formData = new FormData();
        formData.append('file', {
          uri: selectedUri,
          name: mediaType === 'video' ? 'story.mp4' : 'story.jpg',
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        } as any);
        formData.append('folder', 'stories');
        formData.append('resourceType', mediaType);

        const uploadRes = await api.post('/api/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          timeout: 0, // Disable timeout for media uploads
        });

        if (uploadRes.data?.success && uploadRes.data?.url) {
          finalMediaUrl = uploadRes.data.url;
        } else {
          throw new Error(uploadRes.data?.message || 'Failed to upload media to backend proxy.');
        }
      }

      // 2. Form poll & music objects
      const pollData = hasPoll && pollQuestion.trim()
        ? { question: pollQuestion.trim(), options: [{ text: 'Yes' }, { text: 'No' }] }
        : undefined;

      const musicData = hasMusic && musicTitle.trim()
        ? { title: musicTitle.trim(), artist: musicArtist.trim() || 'Unknown Artist' }
        : undefined;

      // 3. Submit story info to backend
      const res = await api.post('/api/story/create', {
        mediaUrl: finalMediaUrl,
        mediaType,
        text: storyText.trim()
          ? { content: storyText.trim(), color: textColor, position: textPosition }
          : undefined,
        visibility,
        poll: pollData,
        music: musicData,
      });

      Alert.alert('Success', 'Story shared successfully!');
      setCreateVisible(false);
      setSelectedUri(null);
      setStoryText('');
      setHasPoll(false);
      setPollQuestion('');
      setHasMusic(false);
      setMusicTitle('');
      setMusicArtist('');

      appChannel.postMessage({
        type: 'STORY_CREATED',
        story: res.data,
      });
      fetchStories();

    } catch (err: any) {
      console.warn('[StoriesStrip] Publish error:', err);
      Alert.alert('Publish Error', err.response?.data?.message || err.message || 'Failed to share story.');
    } finally {
      setUploading(false);
    }
  };

  // Story Actions (Like, Vote, Reply)
  const handleLikeStory = async (storyId: string) => {
    try {
      const res = await api.post(`/api/story/like/${storyId}`);
      // Refresh feed in place
      setFeed((prev) =>
        prev.map((g) => {
          const updatedStories = g.stories.map((s) => (s._id === storyId ? { ...s, likes: res.data.likes } : s));
          return { ...g, stories: updatedStories };
        })
      );
    } catch (e) {
      console.warn('Failed to like story:', e);
    }
  };

  const handleVotePoll = async (storyId: string, optionIndex: number) => {
    try {
      const res = await api.post(`/api/story/vote/${storyId}`, { optionIndex });
      // Update locally
      setFeed((prev) =>
        prev.map((g) => {
          const updatedStories = g.stories.map((s) => (s._id === storyId ? { ...s, poll: res.data.poll } : s));
          return { ...g, stories: updatedStories };
        })
      );
    } catch (e) {
      console.warn('Failed to vote on story poll:', e);
    }
  };

  const handleSendReply = async (storyId: string) => {
    if (!replyText.trim()) return;
    setSendingReply(true);

    try {
      await api.post(`/api/story/reply/${storyId}`, { text: replyText.trim() });
      Alert.alert('Sent', 'Story reply sent as a Direct Message!');
      setReplyText('');
    } catch (e: any) {
      Alert.alert('Reply Error', e.response?.data?.message || 'Failed to send reply.');
    } finally {
      setSendingReply(false);
    }
  };

  const currentGroup = feed[activeGroupIndex];
  const currentStory = currentGroup?.stories[activeStoryIndex];

  const myGroupIndex = feed.findIndex((g) => g.user._id === myUser?._id);
  const myGroup = myGroupIndex !== -1 ? feed[myGroupIndex] : null;

  const storyMediaUrl = currentStory?.media?.url || currentStory?.mediaUrl || '';
  const storyMediaType = currentStory?.media?.type || currentStory?.mediaType || 'image';

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
      >
        {/* Create / View own Story bubble */}
        <View style={styles.bubbleContainer}>
          {myGroup ? (
            <TouchableOpacity
              onPress={() => {
                setActiveGroupIndex(myGroupIndex);
                setActiveStoryIndex(0);
                setPlayerVisible(true);
              }}
            >
              {myGroup.hasUnviewed ? (
                <LinearGradient
                  colors={['#f43f5e', '#ec4899', '#8b5cf6']}
                  style={styles.gradientBorder}
                >
                  <View style={{ position: 'relative' }}>
                    {myGroup.user.profile_picture ? (
                      <Image source={{ uri: myGroup.user.profile_picture }} style={styles.bubbleAvatar} />
                    ) : (
                      <View style={styles.bubbleAvatarFallback}>
                        <Text style={styles.avatarInitial}>{myGroup.user.fullname[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.miniPlusBadge} onPress={handlePickMedia}>
                      <MaterialCommunityIcons name="plus" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </LinearGradient>
              ) : (
                <View style={[styles.avatarBorder, { borderColor }]}>
                  <View style={{ position: 'relative' }}>
                    {myGroup.user.profile_picture ? (
                      <Image source={{ uri: myGroup.user.profile_picture }} style={styles.bubbleAvatar} />
                    ) : (
                      <View style={styles.bubbleAvatarFallback}>
                        <Text style={styles.avatarInitial}>{myGroup.user.fullname[0].toUpperCase()}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={styles.miniPlusBadge} onPress={handlePickMedia}>
                      <MaterialCommunityIcons name="plus" size={12} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={handlePickMedia}>
              <View style={[styles.avatarBorder, { borderColor }]}>
                <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1e1e2f' : '#e2e8f0' }]}>
                  <MaterialCommunityIcons name="plus" size={32} color="#808bf5" />
                </View>
              </View>
            </TouchableOpacity>
          )}
          <Text style={[styles.usernameText, { color: textColorStyle }]} numberOfLines={1}>
            Your Story
          </Text>
        </View>

        {/* Active Followings Live Streams */}
        {activeStreams.map((stream) => {
          const host = stream.host;
          if (!host) return null;
          return (
            <TouchableOpacity
              key={stream._id}
              style={styles.bubbleContainer}
              onPress={() => setLiveStream(stream._id, false)}
            >
              <LinearGradient
                colors={['#ef4444', '#f43f5e']}
                style={[styles.gradientBorder, { shadowColor: '#ef4444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 6 }]}
              >
                {host.profile_picture ? (
                  <Image source={{ uri: host.profile_picture }} style={styles.bubbleAvatar} />
                ) : (
                  <View style={styles.bubbleAvatarFallback}>
                    <Text style={styles.avatarInitial}>{host.fullname[0].toUpperCase()}</Text>
                  </View>
                )}
              </LinearGradient>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>LIVE</Text>
              </View>
              <Text style={[styles.usernameText, { color: textColorStyle }]} numberOfLines={1}>
                {host.fullname.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          );
        })}

        {/* Story Feed list */}
        {feed.map((group, index) => {
          if (group.user._id === myUser?._id) return null; // Skip rendering owner separately
          return (
            <TouchableOpacity
              key={group.user._id}
              style={styles.bubbleContainer}
              onPress={() => {
                setActiveGroupIndex(index);
                setActiveStoryIndex(0);
                setPlayerVisible(true);
              }}
            >
              {group.hasUnviewed ? (
                <LinearGradient
                  colors={['#f43f5e', '#ec4899', '#8b5cf6']}
                  style={styles.gradientBorder}
                >
                  {group.user.profile_picture ? (
                    <Image source={{ uri: group.user.profile_picture }} style={styles.bubbleAvatar} />
                  ) : (
                    <View style={styles.bubbleAvatarFallback}>
                      <Text style={styles.avatarInitial}>{group.user.fullname[0].toUpperCase()}</Text>
                    </View>
                  )}
                </LinearGradient>
              ) : (
                <View style={[styles.avatarBorder, { borderColor }]}>
                  {group.user.profile_picture ? (
                    <Image source={{ uri: group.user.profile_picture }} style={styles.bubbleAvatar} />
                  ) : (
                    <View style={styles.bubbleAvatarFallback}>
                      <Text style={styles.avatarInitial}>{group.user.fullname[0].toUpperCase()}</Text>
                    </View>
                  )}
                </View>
              )}
              <Text style={[styles.usernameText, { color: textColorStyle }]} numberOfLines={1}>
                {group.user.username}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Stories Playback Modal */}
      <Modal
        visible={playerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPlayerVisible(false)}
      >
        <View style={styles.playerContainer}>
          {currentGroup && currentStory && (
            <View style={styles.playerContent}>
              {/* Background media with dynamic blur and resizeMode */}
              <Image
                source={{ uri: storyMediaUrl }}
                style={[
                  styles.playerMedia,
                  (currentStory.sharedPostId || currentStory.sharedStoryId)
                    ? { opacity: 0.6 }
                    : { opacity: 1 }
                ]}
                resizeMode={(currentStory.sharedPostId || currentStory.sharedStoryId) ? 'cover' : 'contain'}
                blurRadius={(currentStory.sharedPostId || currentStory.sharedStoryId) ? 35 : 0}
              />

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

                {/* User info header row */}
                <View style={styles.playerUserInfoRow}>
                  {currentGroup.user.profile_picture ? (
                    <Image source={{ uri: currentGroup.user.profile_picture }} style={styles.playerAvatar} />
                  ) : (
                    <View style={[styles.playerAvatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
                      <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{currentGroup.user.fullname[0]}</Text>
                    </View>
                  )}
                  <Text style={styles.playerUsername}>{currentGroup.user.username}</Text>

                  {currentStory.visibility === 'close_friends' && (
                    <View style={styles.closeFriendsBadge}>
                      <Text style={styles.closeFriendsText}>Close Friends</Text>
                    </View>
                  )}

                  <TouchableOpacity style={styles.playerCloseBtn} onPress={() => setPlayerVisible(false)}>
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
                    const uid = m._id || m;
                    const name = m.username || m.fullname || 'user';
                    return (
                      <TouchableOpacity
                        key={uid.toString()}
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
              {currentGroup.user._id !== myUser?._id && currentStory.mentions?.some((m: any) => (m._id || m).toString() === myUser?._id?.toString()) && (
                <TouchableOpacity
                  style={styles.reshareBtn}
                  onPress={() => {
                    setResharedStory(currentStory);
                    setSelectedUri(currentStory.media?.url || currentStory.mediaUrl || null);
                    setMediaType((currentStory.media?.type || currentStory.mediaType || 'image') as 'image' | 'video');
                    
                    // Music rules: if original has music, pre-fill and lock it!
                    if (currentStory.music) {
                      setHasMusic(true);
                      setMusicTitle(currentStory.music.title);
                      setMusicArtist(currentStory.music.artist);
                    } else {
                      setHasMusic(false);
                      setMusicTitle('');
                      setMusicArtist('');
                    }

                    setPlayerVisible(false);
                    setCreateVisible(true);
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
                    // Navigate to post detail if possible
                    setIsPaused(true);
                    const pid = currentStory.sharedPostId._id || currentStory.sharedPostId.id || currentStory.sharedPostId;
                    if (pid) {
                      Alert.alert(
                        'Open Post',
                        'Would you like to view this post?',
                        [
                          { text: 'Cancel', onPress: () => setIsPaused(false), style: 'cancel' },
                          {
                            text: 'View Post',
                            onPress: () => {
                              setIsPaused(false);
                              setPlayerVisible(false);
                              navigation.navigate('PostDetail', { postId: pid.toString() });
                            }
                          }
                        ]
                      );
                    }
                  }}
                >
                  <View style={styles.stickerHeader}>
                    {currentStory.sharedPostId.user?.profile_picture ? (
                      <Image source={{ uri: currentStory.sharedPostId.user.profile_picture }} style={styles.stickerAvatar} />
                    ) : (
                      <View style={[styles.stickerAvatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
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
                      source={{ uri: currentStory.sharedPostId.image_urls?.[0] || currentStory.sharedPostId.image_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=80' }}
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
                      Alert.alert(
                        'View Story',
                        `Would you like to view @${originalUser}'s original story?`,
                        [
                          { text: 'Cancel', onPress: () => setIsPaused(false), style: 'cancel' },
                          {
                            text: 'View',
                            onPress: () => {
                              setIsPaused(false);
                              // Load group and open original story
                              const grpIdx = feed.findIndex((g) => g.user._id === currentStory.sharedStoryId.user?._id);
                              if (grpIdx !== -1) {
                                setActiveGroupIndex(grpIdx);
                                setActiveStoryIndex(0);
                              } else {
                                Alert.alert('Notice', 'This story group is no longer active.');
                              }
                            }
                          }
                        ]
                      );
                    }
                  }}
                >
                  <View style={styles.stickerHeader}>
                    {currentStory.sharedStoryId.user?.profile_picture ? (
                      <Image source={{ uri: currentStory.sharedStoryId.user.profile_picture }} style={styles.stickerAvatar} />
                    ) : (
                      <View style={[styles.stickerAvatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
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

                    {/* Original story text caption overlay inside reshared story */}
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

                    {/* Original story poll sticker inside reshared story */}
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
                      const totalVotes = (currentStory.poll?.options || []).reduce(
                        (acc, cur) => acc + (cur.votes || []).length,
                        0
                      );
                      const hasVoted = (currentStory.poll?.options || []).some((o) =>
                        (o.votes || []).some((vId) => vId.toString() === myUser?._id?.toString())
                      );

                      const votePercent = totalVotes > 0 ? Math.round((votes.length / totalVotes) * 100) : 0;

                      return (
                        <TouchableOpacity
                          key={opt.text}
                          style={[styles.pollOptionBtn, hasVoted && styles.pollOptionVoted]}
                          onPress={() => !hasVoted && handleVotePoll(currentStory._id, optIdx)}
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
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => {
                        setIsPaused(true);
                        setShareVisible(true);
                      }}
                    >
                      <MaterialCommunityIcons name="send-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '-25deg' }] }} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteStoryBtn}
                      onPress={() => {
                        setIsPaused(true);
                        Alert.alert('Delete Story', 'Are you sure you want to delete this story?', [
                          { text: 'Cancel', style: 'cancel', onPress: () => setIsPaused(false) },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: async () => {
                              try {
                                await api.delete(`/api/story/${currentStory._id}`);
                                setPlayerVisible(false);
                                fetchStories();
                              } catch (e) {
                                Alert.alert('Error', 'Failed to delete story.');
                                setIsPaused(false);
                              }
                            }
                          }
                        ]);
                      }}
                    >
                      <MaterialCommunityIcons name="delete-outline" size={24} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
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
                    <TouchableOpacity
                      style={styles.actionBtn}
                      onPress={() => handleSendReply(currentStory._id)}
                      disabled={sendingReply}
                    >
                      {sendingReply ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <MaterialCommunityIcons name="send" size={24} color="#ffffff" />
                      )}
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleLikeStory(currentStory._id)}
                      >
                        <MaterialCommunityIcons
                          name={
                            (currentStory.likes || []).some((id) => id.toString() === myUser?._id?.toString())
                              ? 'heart'
                              : 'heart-outline'
                          }
                          size={28}
                          color={
                            (currentStory.likes || []).some((id) => id.toString() === myUser?._id?.toString())
                              ? '#ef4444'
                              : '#ffffff'
                          }
                        />
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => {
                          setIsPaused(true);
                          setShareVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="send-outline" size={24} color="#ffffff" style={{ transform: [{ rotate: '-25deg' }] }} />
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              )}

              {/* Viewers list modal */}
              <Modal
                visible={viewersVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => {
                  setViewersVisible(false);
                  setIsPaused(false);
                }}
              >
                <View style={styles.modalOverlay}>
                  <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
                    <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
                      <Text style={[styles.modalTitle, { color: textColorStyle }]}>Viewers ({viewers.length})</Text>
                      <TouchableOpacity onPress={() => { setViewersVisible(false); setIsPaused(false); }}>
                        <MaterialCommunityIcons name="close" size={24} color={textColorStyle} />
                      </TouchableOpacity>
                    </View>

                    {loadingViewers ? (
                      <ActivityIndicator size="large" color="#808bf5" style={{ marginVertical: 40 }} />
                    ) : viewers.length === 0 ? (
                      <Text style={{ color: subColor, textAlign: 'center', marginVertical: 40 }}>No views yet</Text>
                    ) : (
                      <FlatList
                        data={viewers}
                        keyExtractor={(item) => item._id}
                        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 30 }}
                        renderItem={({ item }) => {
                          const hasLiked = (currentStory?.likes || []).some(
                            (likeId) => likeId.toString() === item._id.toString()
                          );
                          return (
                            <View style={[styles.viewerItem, { borderBottomColor: borderColor }]}>
                              {item.profile_picture ? (
                                <Image source={{ uri: item.profile_picture }} style={styles.viewerAvatar} />
                              ) : (
                                <View style={[styles.viewerAvatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
                                  <Text style={{ color: '#ffffff', fontWeight: 'bold' }}>{item.fullname[0]}</Text>
                                </View>
                              )}
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.viewerName, { color: textColorStyle }]}>{item.fullname}</Text>
                                <Text style={{ color: subColor, fontSize: 12 }}>@{item.username}</Text>
                              </View>
                              {hasLiked && (
                                <MaterialCommunityIcons name="heart" size={20} color="#ef4444" />
                              )}
                            </View>
                          );
                        }}
                      />
                    )}
                  </View>
                </View>
              </Modal>

              {/* Share Story Modal */}
              <ShareModal
                visible={shareVisible}
                onClose={() => {
                  setShareVisible(false);
                  setIsPaused(false);
                }}
                story={currentStory}
                myUser={myUser}
              />
            </View>
          )}
        </View>
      </Modal>

      {/* Story Creation configuration Modal */}
      <Modal
        visible={createVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColorStyle }]}>Story Settings</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColorStyle} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {selectedUri && (
                resharedStory ? (
                  <View style={styles.resharePreviewContainer}>
                    {/* Blurred background media */}
                    <Image
                      source={{ uri: selectedUri }}
                      style={styles.resharePreviewBlurBg}
                      blurRadius={35}
                      resizeMode="cover"
                    />

                    {/* Centered miniature story card sticker preview */}
                    <View
                      style={[
                        styles.stickerCard,
                        {
                          position: 'relative',
                          top: 0,
                          alignSelf: 'center',
                          width: stickerSize === 'small' ? 200 : stickerSize === 'large' ? 310 : 260,
                        }
                      ]}
                    >
                      <View style={styles.stickerHeader}>
                        {resharedStory.user?.profile_picture ? (
                          <Image source={{ uri: resharedStory.user.profile_picture }} style={styles.stickerAvatar} />
                        ) : (
                          <View style={[styles.stickerAvatar, { backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }]}>
                            <Text style={{ color: '#ffffff', fontSize: 10, fontWeight: 'bold' }}>
                              {resharedStory.user?.fullname?.[0]?.toUpperCase() || 'U'}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.stickerName} numberOfLines={1}>{resharedStory.user?.fullname}</Text>
                          <Text style={styles.stickerSub} numberOfLines={1}>Social Square Story</Text>
                        </View>
                        <MaterialCommunityIcons name="layers" size={16} color="#9ca3af" />
                      </View>
                      <View style={styles.stickerMediaContainer9to16}>
                        <Image
                          source={{ uri: resharedStory.media?.url }}
                          style={styles.stickerMedia9to16}
                          resizeMode="cover"
                        />

                        {/* Original caption inside reshared story preview */}
                        {resharedStory.text && resharedStory.text.content ? (
                          <View
                            style={[
                              styles.miniTextOverlayContainer,
                              resharedStory.text.position === 'top' && { top: '15%' },
                              resharedStory.text.position === 'center' && { top: '45%' },
                              resharedStory.text.position === 'bottom' && { top: '75%' },
                              resharedStory.text.y !== undefined && { top: `${resharedStory.text.y}%` },
                            ]}
                          >
                            <Text style={[styles.miniTextOverlayContent, { color: resharedStory.text.color || '#ffffff' }]}>
                              {resharedStory.text.content}
                            </Text>
                          </View>
                        ) : null}

                        {/* Original poll inside reshared story preview */}
                        {resharedStory.poll && resharedStory.poll.question ? (
                          <View style={[styles.miniPollCard, { top: resharedStory.poll.y !== undefined ? `${resharedStory.poll.y}%` : '28%' }]}>
                            <Text style={styles.miniPollQuestion} numberOfLines={1}>{resharedStory.poll.question}</Text>
                            <View style={styles.miniPollOptionsRow}>
                              {resharedStory.poll.options.map((opt: any) => (
                                <View key={opt.text} style={styles.miniPollOptionBtn}>
                                  <Text style={styles.miniPollOptionText}>{opt.text}</Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    </View>

                    {/* Button to cycle sticker size */}
                    <TouchableOpacity
                      style={styles.sizeCycleBtn}
                      onPress={() => {
                        setStickerSize((prev) => (prev === 'small' ? 'medium' : prev === 'medium' ? 'large' : 'small'));
                      }}
                    >
                      <MaterialCommunityIcons name="resize" size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontSize: 11, fontWeight: 'bold', marginLeft: 4 }}>
                        Size: {stickerSize.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity onPress={handleChangeMedia} style={{ position: 'relative' }}>
                    <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="contain" />
                    <View style={styles.changeMediaBadge}>
                      <MaterialCommunityIcons name="camera" size={16} color="#ffffff" />
                      <Text style={{ color: '#ffffff', fontSize: 12, fontWeight: 'bold' }}>Change Media</Text>
                    </View>
                  </TouchableOpacity>
                )
              )}

              {/* Text settings */}
              <Text style={[styles.inputLabel, { color: subColor }]}>Story Text Caption</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColorStyle }]}
                placeholder="Say something about your day..."
                placeholderTextColor={subColor}
                value={storyText}
                onChangeText={setStoryText}
              />

              {storyText.trim().length > 0 && (
                <>
                  <Text style={[styles.inputLabel, { color: subColor }]}>Text Color</Text>
                  <View style={styles.colorRow}>
                    {COLOR_OPTIONS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[styles.colorBubble, { backgroundColor: c }, textColor === c && { borderWidth: 2, borderColor: '#808bf5' }]}
                        onPress={() => setTextColor(c)}
                      />
                    ))}
                  </View>

                  <Text style={[styles.inputLabel, { color: subColor }]}>Text Position</Text>
                  <View style={styles.positionRow}>
                    {['top', 'center', 'bottom'].map((pos: any) => (
                      <TouchableOpacity
                        key={pos}
                        style={[
                          styles.posBtn,
                          { borderColor: textPosition === pos ? '#808bf5' : borderColor },
                        ]}
                        onPress={() => setTextPosition(pos)}
                      >
                        <Text style={[styles.posBtnText, { color: textColorStyle }]}>
                          {pos.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Visibility Settings */}
              <Text style={[styles.inputLabel, { color: subColor }]}>Visibility Options</Text>
              <View style={styles.visibilityRow}>
                {['public', 'followers', 'close_friends'].map((option) => {
                  const isSelected = visibility === option;
                  return (
                    <TouchableOpacity
                      key={option}
                      style={[
                        styles.visibilityBtn,
                        {
                          backgroundColor: isSelected ? '#808bf5' : (isDark ? '#1e1e2f' : '#f1f5f9'),
                          borderColor: isSelected ? '#808bf5' : borderColor,
                        },
                      ]}
                      onPress={() => setVisibility(option as any)}
                    >
                      <Text style={[styles.visibilityBtnText, { color: isSelected ? '#ffffff' : textColorStyle }]}>
                        {option.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Interactive Yes/No Poll section */}
              <View style={styles.toggleSectionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleSectionHeading, { color: textColorStyle }]}>Add Interactive Poll</Text>
                  <Text style={{ color: subColor, fontSize: 11 }}>Let friends vote Yes or No on your story</Text>
                </View>
                <Switch
                  value={hasPoll}
                  onValueChange={setHasPoll}
                  trackColor={{ false: '#767577', true: '#a5b4fc' }}
                  thumbColor={hasPoll ? '#808bf5' : '#f4f3f4'}
                />
              </View>

              {hasPoll && (
                <TextInput
                  style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColorStyle }]}
                  placeholder="e.g. Is this layout premium? 🚀"
                  placeholderTextColor={subColor}
                  value={pollQuestion}
                  onChangeText={setPollQuestion}
                />
              )}

              {/* Music Section */}
              <View style={styles.toggleSectionRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.toggleSectionHeading, { color: textColorStyle }]}>Attach Music Tag</Text>
                  <Text style={{ color: subColor, fontSize: 11 }}>
                    {resharedStory?.music ? 'Locked to original story music' : 'Tag the song you are listening to'}
                  </Text>
                </View>
                <Switch
                  value={hasMusic}
                  onValueChange={setHasMusic}
                  disabled={!!resharedStory?.music}
                  trackColor={{ false: '#767577', true: '#a5b4fc' }}
                  thumbColor={hasMusic ? '#808bf5' : '#f4f3f4'}
                />
              </View>

              {hasMusic && (
                <View style={{ gap: 8 }}>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColorStyle, marginBottom: 4 }]}
                    placeholder="Song Title (e.g. Starboy)"
                    placeholderTextColor={subColor}
                    value={musicTitle}
                    onChangeText={setMusicTitle}
                    editable={!resharedStory?.music}
                  />
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColorStyle }]}
                    placeholder="Artist Name (e.g. The Weeknd)"
                    placeholderTextColor={subColor}
                    value={musicArtist}
                    onChangeText={setMusicArtist}
                    editable={!resharedStory?.music}
                  />
                </View>
              )}
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor }]}
                onPress={() => setCreateVisible(false)}
                disabled={uploading}
              >
                <Text style={[styles.cancelBtnText, { color: textColorStyle }]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalBtn}
                onPress={handlePublishStory}
                disabled={uploading}
              >
                <LinearGradient
                  colors={['#808bf5', '#4f46e5']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.shareGradient}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.shareBtnText}>Share Story</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Premium Story Media Picker Modal (Instagram-style Bottom Sheet) */}
      <Modal
        visible={pickerMenuVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setPickerMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerMenuVisible(false)}
        >
          <View style={[styles.bottomSheetContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={styles.bottomSheetHeader}>
              <View style={[styles.bottomSheetHandle, { backgroundColor: isDark ? '#222222' : '#e2e8f0' }]} />
              <Text style={[styles.bottomSheetTitle, { color: textColorStyle }]}>Create Story</Text>
            </View>

            <View style={styles.bottomSheetOptions}>
              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={() => {
                  setPickerMenuVisible(false);
                  launchImageLibrary(
                    { mediaType: 'mixed', quality: 0.9 },
                    (result) => {
                      if (result.didCancel || result.errorCode) return;
                      const asset = result.assets?.[0];
                      if (!asset?.uri) return;
                      setSelectedUri(asset.uri);
                      setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
                      setCreateVisible(true);
                    },
                  );
                }}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(128, 139, 245, 0.15)' }]}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={24} color="#808bf5" />
                </View>
                <Text style={[styles.optionText, { color: textColorStyle }]}>Choose from Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={() => {
                  setPickerMenuVisible(false);
                  launchCamera(
                    { mediaType: 'mixed', quality: 0.9, saveToPhotos: false },
                    (result) => {
                      if (result.didCancel || result.errorCode) return;
                      const asset = result.assets?.[0];
                      if (!asset?.uri) return;
                      setSelectedUri(asset.uri);
                      setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
                      setCreateVisible(true);
                    },
                  );
                }}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <MaterialCommunityIcons name="camera-outline" size={24} color="#f59e0b" />
                </View>
                <Text style={[styles.optionText, { color: textColorStyle }]}>Take Photo / Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={() => {
                  setPickerMenuVisible(false);
                  handleGoLive();
                }}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                  <MaterialCommunityIcons name="video-wireless-outline" size={24} color="#ef4444" />
                </View>
                <Text style={[styles.optionText, { color: textColorStyle }]}>Go Live 🔴</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  stripScroll: {
    paddingHorizontal: 16,
    gap: 16,
  },
  bubbleContainer: {
    alignItems: 'center',
    width: 68,
  },
  gradientBorder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBorder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bubbleAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  bubbleAvatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#808bf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 58,
    height: 58,
    borderRadius: 29,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  usernameText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  miniPlusBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#808bf5',
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // Fullscreen Player Styles
  playerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  playerContent: {
    width: screenWidth,
    height: screenHeight,
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    alignSelf: 'center',
  },
  playerMedia: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  gestureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  leftTap: {
    flex: 1,
  },
  rightTap: {
    flex: 2,
  },
  progressHeaderContainer: {
    position: 'absolute',
    top: 40,
    left: 12,
    right: 12,
    zIndex: 5,
  },
  progressBarRow: {
    flexDirection: 'row',
    gap: 4,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#ffffff',
  },
  playerUserInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  playerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  playerUsername: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
    marginLeft: 10,
    flex: 1,
  },
  closeFriendsBadge: {
    backgroundColor: '#10b981',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 10,
  },
  closeFriendsText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  playerCloseBtn: {
    padding: 4,
  },

  // Music Tag styling
  musicOverlayBadge: {
    position: 'absolute',
    top: 100,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
    maxWidth: '80%',
    zIndex: 4,
  },
  musicOverlayText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },

  // Positioning text caption style
  textOverlayContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
    zIndex: 4,
  },
  textOverlayContent: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },

  // Poll card styling
  pollCard: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 16,
    borderRadius: 20,
    width: '75%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 4,
  },
  pollQuestion: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 14,
  },
  pollOptionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pollOptionBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pollOptionVoted: {
    backgroundColor: '#94a3b8',
  },
  pollOptionText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  pollVotedWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pollPercentText: {
    color: '#ffffff',
    fontWeight: 'black',
    fontSize: 14,
  },

  // Footer / Message input compose
  playerFooterRow: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    zIndex: 5,
  },
  ownerFooterRow: {
    position: 'absolute',
    bottom: 24,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  viewsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  deleteStoryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  viewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  viewerName: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  replyInput: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 20,
    color: '#ffffff',
    fontSize: 14,
  },
  actionBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mentionsOverlayContainer: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    zIndex: 10,
  },
  mentionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  mentionChipText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '600',
  },
  reshareBtn: {
    position: 'absolute',
    bottom: 140,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    zIndex: 15,
  },
  reshareBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  stickerCard: {
    position: 'absolute',
    top: '18%',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 20,
    width: 280,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 10,
    zIndex: 8,
  },
  stickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  stickerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
  stickerName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  stickerSub: {
    fontSize: 10,
    color: '#666666',
    marginTop: -2,
  },
  stickerMediaContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  stickerMedia1to1: {
    width: '100%',
    height: '100%',
  },
  stickerCaption: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '600',
    marginTop: 8,
    lineHeight: 16,
  },
  stickerMediaContainer9to16: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  stickerMedia9to16: {
    width: '100%',
    height: '100%',
  },

  miniTextOverlayContainer: {
    position: 'absolute',
    left: 10,
    right: 10,
    alignItems: 'center',
    zIndex: 4,
  },
  miniTextOverlayContent: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 4,
  },
  miniPollCard: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 8,
    borderRadius: 10,
    width: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 4,
    zIndex: 4,
  },
  miniPollQuestion: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 6,
  },
  miniPollOptionsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  miniPollOptionBtn: {
    flex: 1,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniPollOptionText: {
    color: '#ffffff',
    fontWeight: 'bold',
    fontSize: 8,
  },

  resharePreviewContainer: {
    width: '100%',
    aspectRatio: 9 / 16,
    maxHeight: 400,
    borderRadius: 20,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: 16,
    backgroundColor: '#000000',
  },
  resharePreviewBlurBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  sizeCycleBtn: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    zIndex: 10,
  },

  // Story Creation Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeBtn: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    marginBottom: 16,
  },
  changeMediaBadge: {
    position: 'absolute',
    bottom: 24,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 4,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 8,
  },
  modalInput: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  colorBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  positionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  posBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  posBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  visibilityBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityBtnText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  toggleSectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(128,128,128,0.1)',
  },
  toggleSectionHeading: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cancelBtn: {
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  shareGradient: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  liveBadge: {
    position: 'absolute',
    bottom: 12,
    alignSelf: 'center',
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  liveBadgeText: {
    color: '#ffffff',
    fontSize: 8,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  bottomSheetContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    width: '100%',
    position: 'absolute',
    bottom: 0,
  },
  bottomSheetHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 12,
  },
  bottomSheetTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomSheetOptions: {
    gap: 16,
    paddingBottom: 20,
  },
  bottomSheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(128, 139, 245, 0.03)',
  },
  optionIconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
