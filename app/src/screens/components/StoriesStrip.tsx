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

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface StoryItem {
  _id: string;
  mediaUrl: string;
  mediaType: string;
  text?: string;
  visibility?: 'public' | 'followers' | 'close_friends';
  createdAt: string;
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

export default function StoriesStrip() {
  const isDark = useColorScheme() === 'dark';
  const [feed, setFeed] = useState<GroupedStory[]>([]);
  const [loading, setLoading] = useState(false);

  // Stories player modal state
  const [playerVisible, setPlayerVisible] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState(0);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const progressAnim = useRef(0);
  const [timerProgress, setTimerProgress] = useState(0);
  const timerRef = useRef<any>(null);

  // Story creation modal state
  const [createVisible, setCreateVisible] = useState(false);
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [storyText, setStoryText] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');

  const bg = isDark ? '#0f0f1a' : '#f1f5f9';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
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

  // ── Broadcast Event Observers ──
  useBroadcast('STORY_CREATED', React.useCallback(() => {
    fetchStories();
  }, []));

  useBroadcast('STORY_DELETED', React.useCallback(() => {
    fetchStories();
  }, []));

  // Story playback timer
  useEffect(() => {
    if (!playerVisible || feed.length === 0) {
      clearInterval(timerRef.current);
      return;
    }

    const currentGroup = feed[activeGroupIndex];
    if (!currentGroup || !currentGroup.stories || currentGroup.stories.length === 0) {
      return;
    }

    // Set auto-advance timer
    setTimerProgress(0);
    progressAnim.current = 0;

    const intervalTime = 100; // Step every 100ms
    const totalDuration = 5000; // 5 seconds per story
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

    // Mark as viewed
    const currentStory = currentGroup.stories[activeStoryIndex];
    if (currentStory) {
      api.post(`/api/story/view/${currentStory._id}`).catch(() => {});
    }

    return () => clearInterval(timerRef.current);
  }, [playerVisible, activeGroupIndex, activeStoryIndex]);

  const handleNextStory = () => {
    const currentGroup = feed[activeGroupIndex];
    if (!currentGroup) return;

    if (activeStoryIndex < currentGroup.stories.length - 1) {
      setActiveStoryIndex((prev) => prev + 1);
    } else {
      // Move to next user
      if (activeGroupIndex < feed.length - 1) {
        setActiveGroupIndex((prev) => prev + 1);
        setActiveStoryIndex(0);
      } else {
        // End of all stories
        setPlayerVisible(false);
      }
    }
  };

  const handlePrevStory = () => {
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((prev) => prev - 1);
    } else {
      // Move to previous user
      if (activeGroupIndex > 0) {
        setActiveGroupIndex((prev) => prev - 1);
        const prevGroup = feed[activeGroupIndex - 1];
        setActiveStoryIndex(prevGroup ? prevGroup.stories.length - 1 : 0);
      }
    }
  };

  // Launch photo selector to publish a story
  const handlePickMedia = async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      quality: 0.8,
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) return;

    setSelectedUri(asset.uri);
    setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
    setCreateVisible(true);
  };

  const handlePublishStory = async () => {
    if (!selectedUri) return;
    setUploading(true);
    try {
      // 1. Get Cloudinary upload signature
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
            // 4. Submit story info to backend
            api.post('/api/story', {
              mediaUrl: data.secure_url,
              mediaType,
              text: storyText.trim() || undefined,
              visibility,
            }).then((res: any) => {
              Alert.alert('Success', 'Story published successfully!');
              setCreateVisible(false);
              setSelectedUri(null);
              setStoryText('');
              // Emit story creation
              appChannel.postMessage({
                type: 'STORY_CREATED',
                story: res.data,
              });
              fetchStories();
            }).catch((err: any) => {
              Alert.alert('Publish Error', err.response?.data?.message || 'Failed to create story.');
            }).finally(() => {
              setUploading(false);
            });
          } else {
            Alert.alert('Upload Error', data.error?.message || 'Failed to upload media.');
            setUploading(false);
          }
        } catch (e) {
          Alert.alert('Upload Error', 'Failed to parse response.');
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

  const currentGroup = feed[activeGroupIndex];
  const currentStory = currentGroup?.stories[activeStoryIndex];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripScroll}
      >
        {/* Create Story Button bubble */}
        <TouchableOpacity style={styles.bubbleContainer} onPress={handlePickMedia}>
          <View style={[styles.avatarBorder, { borderColor }]}>
            <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#1e1e2f' : '#e2e8f0' }]}>
              <MaterialCommunityIcons name="plus" size={32} color="#808bf5" />
            </View>
          </View>
          <Text style={[styles.usernameText, { color: textColor }]} numberOfLines={1}>
            Your Story
          </Text>
        </TouchableOpacity>

        {/* Existing users active stories bubbles */}
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
            <Text style={[styles.usernameText, { color: textColor }]} numberOfLines={1}>
              {group.user.username}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stories Playback Fullscreen Modal Viewer */}
      <Modal
        visible={playerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPlayerVisible(false)}
      >
        <View style={styles.playerContainer}>
          {currentStory && (
            <>
              {/* Story media display */}
              <Image source={{ uri: currentStory.mediaUrl }} style={styles.playerMedia} resizeMode="cover" />

              {/* Tap overlays to skip / rewind */}
              <View style={styles.gestureOverlay}>
                <TouchableOpacity style={styles.leftTap} onPress={handlePrevStory} activeOpacity={1} />
                <TouchableOpacity style={styles.rightTap} onPress={handleNextStory} activeOpacity={1} />
              </View>

              {/* Progress bars header */}
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

                {/* User Info strip */}
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

              {/* Story text overlay */}
              {currentStory.text ? (
                <View style={styles.playerCaptionBox}>
                  <Text style={styles.playerCaptionText}>{currentStory.text}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      </Modal>

      {/* Story Creation Config Modal */}
      <Modal
        visible={createVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCreateVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: isDark ? '#121212' : '#ffffff' }]}>
            <View style={[styles.modalHeader, { borderBottomColor: borderColor }]}>
              <Text style={[styles.modalTitle, { color: textColor }]}>Publish Story</Text>
              <TouchableOpacity onPress={() => setCreateVisible(false)} style={styles.closeBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Media preview */}
              {selectedUri && (
                <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" />
              )}

              {/* Caption TextInput */}
              <Text style={[styles.inputLabel, { color: subColor }]}>Story Text Overlay</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f8fafc', borderColor, color: textColor }]}
                placeholder="Say something about your day..."
                placeholderTextColor={subColor}
                value={storyText}
                onChangeText={setStoryText}
              />

              {/* Visibility selectors */}
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
                      <Text style={[styles.visibilityBtnText, { color: isSelected ? '#ffffff' : textColor }]}>
                        {option.replace('_', ' ').toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.modalFooter, { borderTopColor: borderColor }]}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn, { borderColor }]}
                onPress={() => setCreateVisible(false)}
                disabled={uploading}
              >
                <Text style={[styles.cancelBtnText, { color: textColor }]}>Cancel</Text>
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
  playerCaptionBox: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    padding: 16,
  },
  playerCaptionText: {
    color: '#ffffff',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
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
    height: 240,
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
