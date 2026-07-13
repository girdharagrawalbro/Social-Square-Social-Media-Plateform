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
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../../lib/api';
import { appChannel } from '../../lib/broadcast';
import { useBroadcast } from '../../lib/useBroadcast';
import useAuthStore from '../../store/zustand/useAuthStore';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  };
  visibility?: 'public' | 'followers' | 'close_friends';
  createdAt: string;
  poll?: {
    question: string;
    options: {
      text: string;
      votes: string[];
    }[];
  };
  music?: {
    title: string;
    artist: string;
  };
  likes?: string[];
  viewers?: string[];
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
  const [feed, setFeed] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(false);

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

  // Story creation modal state
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);

  // Rich Creator states
  const [storyText, setStoryText] = useState('');
  const [textColor, setTextColor] = useState('#ffffff');
  const [textPosition, setTextPosition] = useState<'top' | 'center' | 'bottom'>('center');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');

  // Poll Composer States
  const [hasPoll, setHasPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');

  // Music Composer States
  const [hasMusic, setHasMusic] = useState(false);
  const [musicTitle, setMusicTitle] = useState('');
  const [musicArtist, setMusicArtist] = useState('');

  const bg = isDark ? '#0f0f1a' : '#f1f5f9';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColorStyle = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';

  const fetchStories = async () => {
    try {
      const res = await api.get('/api/story/feed');
      setFeed(res.data || []);
    } catch (e) {
      console.warn('Failed to fetch stories feed:', e);
    }
  };

  useEffect(() => {
    fetchStories();
  }, []);

  useBroadcast('STORY_CREATED', React.useCallback(() => {
    fetchStories();
  }, []));

  useBroadcast('STORY_DELETED', React.useCallback(() => {
    fetchStories();
  }, []));

  // Story playback timer logic
  useEffect(() => {
    if (!playerVisible || feed.length === 0) {
      clearInterval(timerRef.current);
      return;
    }

    const currentGroup = feed[activeGroupIndex];
    if (!currentGroup || !currentGroup.stories || currentGroup.stories.length === 0) {
      return;
    }

    setTimerProgress(0);
    progressAnim.current = 0;

    const intervalTime = 100;
    const totalDuration = 5000; // 5 seconds
    const steps = totalDuration / intervalTime;

    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      progressAnim.current += 1;
      setTimerProgress(progressAnim.current / steps);

      if (progressAnim.current >= steps) {
        clearInterval(timerRef.current);
        handleNextStory();
      }
    }, intervalTime);

    const currentStory = currentGroup.stories[activeStoryIndex];
    if (currentStory) {
      api.post(`/api/story/view/${currentStory._id}`).catch(() => { });
    }

    return () => clearInterval(timerRef.current);
  }, [playerVisible, activeGroupIndex, activeStoryIndex]);

  const handleNextStory = () => {
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

  const handlePickMedia = async () => {
    Alert.alert('Debug', 'handlePickMedia triggered');
    try {
      const result = await launchImageLibrary({
        mediaType: 'mixed',
        quality: 0.8,
      });

      if (result.didCancel) {
        return;
      }
      if (result.errorMessage) {
        Alert.alert('Error', result.errorMessage);
        return;
      }

      if (!result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      if (!asset.uri) return;

      setSelectedUri(asset.uri);
      setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
      setCreateVisible(true);
    } catch (e: any) {
      console.warn('[handlePickMedia Error]:', e);
      Alert.alert('Picker Exception', e.message || 'Failed to launch image library.');
    }
  };

  const handlePublishStory = async () => {
    if (!selectedUri) return;
    setUploading(true);

    try {
      // 1. Get signature
      const signRes = await api.post('/api/media/cloud/sign-upload', {
        folder: 'stories',
      });

      const { signature, timestamp, cloudName, apiKey, folder, success, message } = signRes.data;
      if (!success) {
        throw new Error(message || 'Failed to sign upload');
      }

      // 2. Build FormData
      const formData = new FormData();
      formData.append('file', {
        uri: selectedUri,
        name: mediaType === 'video' ? 'story.mp4' : 'story.jpg',
        type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      } as any);
      formData.append('signature', signature);
      formData.append('timestamp', timestamp.toString());
      formData.append('api_key', apiKey);
      formData.append('folder', folder);

      // 3. Post to Cloudinary
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `https://api.cloudinary.com/v1_1/${cloudName || 'dcmrsdydh'}/${mediaType}/upload`, true);

      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            // Form poll & music objects
            const pollData = hasPoll && pollQuestion.trim()
              ? { question: pollQuestion.trim(), options: [{ text: 'Yes' }, { text: 'No' }] }
              : undefined;

            const musicData = hasMusic && musicTitle.trim()
              ? { title: musicTitle.trim(), artist: musicArtist.trim() || 'Unknown Artist' }
              : undefined;

            // Submit story info
            api.post('/api/story/create', {
              mediaUrl: data.secure_url,
              mediaType,
              text: storyText.trim()
                ? { content: storyText.trim(), color: textColor, position: textPosition }
                : undefined,
              visibility,
              poll: pollData,
              music: musicData,
            })
              .then((res: any) => {
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
              })
              .catch((err: any) => {
                Alert.alert('Publish Error', err.response?.data?.message || 'Failed to create story.');
              })
              .finally(() => {
                setUploading(false);
              });
          } else {
            Alert.alert('Upload Error', data.error?.message || 'Failed to upload media.');
            setUploading(false);
          }
        } catch (e) {
          Alert.alert('Upload Error', 'Failed to parse upload reply.');
          setUploading(false);
        }
      };

      xhr.onerror = () => {
        Alert.alert('Upload Error', 'Network error.');
        setUploading(false);
      };

      xhr.send(formData);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Signature fetch failed.');
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

  // Helper properties
  const storyMediaUrl = currentStory?.media?.url || currentStory?.mediaUrl || '';
  const storyMediaType = currentStory?.media?.type || currentStory?.mediaType || 'image';

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
      >
        {/* Create Story Button */}
        <TouchableOpacity style={styles.bubbleContainer} onPress={handlePickMedia}>
          <View style={[styles.avatarBorder, { borderColor }]}>
            <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1e1e2f' : '#e2e8f0' }]}>
              <MaterialCommunityIcons name="plus" size={32} color="#808bf5" />
            </View>
          </View>
          <Text style={[styles.usernameText, { color: textColorStyle }]} numberOfLines={1}>
            Your Story
          </Text>
        </TouchableOpacity>

        {/* Story Feed list */}
        {feed.map((group, index) => (
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
        ))}
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
            <>
              {/* Media item rendering */}
              <Image source={{ uri: storyMediaUrl }} style={styles.playerMedia} resizeMode="cover" />

              {/* Tap skip zones */}
              <View style={styles.gestureOverlay}>
                <TouchableOpacity style={styles.leftTap} onPress={handlePrevStory} activeOpacity={1} />
                <TouchableOpacity style={styles.rightTap} onPress={handleNextStory} activeOpacity={1} />
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
              {currentStory.music && (
                <View style={styles.musicOverlayBadge}>
                  <MaterialCommunityIcons name="music-note" size={16} color="#ffffff" />
                  <Text style={styles.musicOverlayText} numberOfLines={1}>
                    {currentStory.music.title} - {currentStory.music.artist}
                  </Text>
                </View>
              )}

              {/* Rich text overlay caption */}
              {currentStory.text && currentStory.text.content ? (
                <View
                  style={[
                    styles.textOverlayContainer,
                    currentStory.text.position === 'top' && { top: 120 },
                    currentStory.text.position === 'center' && { top: screenHeight / 2.5 },
                    currentStory.text.position === 'bottom' && { bottom: 180 },
                  ]}
                >
                  <Text style={[styles.textOverlayContent, { color: currentStory.text.color || '#ffffff' }]}>
                    {currentStory.text.content}
                  </Text>
                </View>
              ) : null}

              {/* Interactive Poll card */}
              {currentStory.poll && currentStory.poll.question ? (
                <View style={styles.pollCard}>
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
                )}
              </View>
            </>
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
                <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" />
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
                        style={[styles.colorBubble, { backgroundColor: c }, textColor === c && { borderWidth: 2, borderColor: primaryColor }]}
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
                  <Text style={{ color: subColor, fontSize: 11 }}>Tag the song you are listening to</Text>
                </View>
                <Switch
                  value={hasMusic}
                  onValueChange={setHasMusic}
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
                  />
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColorStyle }]}
                    placeholder="Artist Name (e.g. The Weeknd)"
                    placeholderTextColor={subColor}
                    value={musicArtist}
                    onChangeText={setMusicArtist}
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

  // Fullscreen Player Styles
  playerContainer: {
    flex: 1,
    backgroundColor: '#000000',
    justifyContent: 'center',
  },
  playerMedia: {
    width: screenWidth,
    height: screenHeight,
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
    top: screenHeight / 1.8,
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
});
