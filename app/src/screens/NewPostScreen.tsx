import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  useColorScheme,
  TouchableOpacity,
  TextInput,
  Image,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
  FlatList,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';

interface ModalBodyProps {
  activeModal: string | null;
  groups: any[];
  goals: any[];
  otherUsers: any[];
  selectedGroup: any;
  setSelectedGroup: (g: any) => void;
  selectedGoal: any;
  setSelectedGoal: (g: any) => void;
  visibility: string;
  setVisibility: (v: any) => void;
  locationName: string;
  setLocationName: (l: string) => void;
  collaborators: any[];
  setCollaborators: (c: any[]) => void;
  taggedUsers: any[];
  setTaggedUsers: (t: any[]) => void;
  isFeedbackRequest: boolean;
  setIsFeedbackRequest: (b: boolean) => void;
  feedbackCategory: string;
  setFeedbackCategory: (c: string) => void;
  expiresInHours: number | null;
  setExpiresInHours: (h: number | null) => void;
  unlocksInHours: number | null;
  setUnlocksInHours: (h: number | null) => void;
  aiPrompt: string;
  setAiPrompt: (p: string) => void;
  generateAiCaption: () => void;
  generateAiImage: () => void;
  generatingAi: boolean;
  aiLimits: { textRemaining: number; imageRemaining: number };
  setActiveModal: (m: string | null) => void;
  textColor: string;
  subText: string;
  border: string;
  bg: string;
  primaryColor: string;
}

const ModalBody = ({
  activeModal,
  groups,
  goals,
  otherUsers,
  selectedGroup,
  setSelectedGroup,
  selectedGoal,
  setSelectedGoal,
  visibility,
  setVisibility,
  locationName,
  setLocationName,
  collaborators,
  setCollaborators,
  taggedUsers,
  setTaggedUsers,
  isFeedbackRequest,
  setIsFeedbackRequest,
  feedbackCategory,
  setFeedbackCategory,
  expiresInHours,
  setExpiresInHours,
  unlocksInHours,
  setUnlocksInHours,
  aiPrompt,
  setAiPrompt,
  generateAiCaption,
  generateAiImage,
  generatingAi,
  aiLimits,
  setActiveModal,
  textColor,
  subText,
  border,
  bg,
  primaryColor,
}: ModalBodyProps) => {
  switch (activeModal) {
    case 'community':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Select Community</Text>
          {groups.length === 0 ? (
            <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>No groups available.</Text>
          ) : (
            <FlatList
              data={groups}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    { borderBottomColor: border },
                    selectedGroup?._id === item._id && { backgroundColor: `${primaryColor}20` },
                  ]}
                  onPress={() => {
                    setSelectedGroup(selectedGroup?._id === item._id ? null : item);
                    setActiveModal(null);
                  }}
                >
                  <Text style={[styles.listItemText, { color: textColor }]}>{item.name}</Text>
                  {selectedGroup?._id === item._id && (
                    <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      );

    case 'goal':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Link Active Goal</Text>
          {goals.length === 0 ? (
            <Text style={{ color: subText, textAlign: 'center', padding: 20 }}>No active goals found.</Text>
          ) : (
            <FlatList
              data={goals}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.listItem,
                    { borderBottomColor: border },
                    selectedGoal?._id === item._id && { backgroundColor: `${primaryColor}20` },
                  ]}
                  onPress={() => {
                    setSelectedGoal(selectedGoal?._id === item._id ? null : item);
                    setActiveModal(null);
                  }}
                >
                  <Text style={[styles.listItemText, { color: textColor }]}>{item.title}</Text>
                  {selectedGoal?._id === item._id && (
                    <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </View>
      );

    case 'visibility':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Visibility Audience</Text>
          {['public', 'followers', 'close_friends'].map((v: any) => (
            <TouchableOpacity
              key={v}
              style={[
                styles.listItem,
                { borderBottomColor: border },
                visibility === v && { backgroundColor: `${primaryColor}20` },
              ]}
              onPress={() => {
                setVisibility(v);
                setActiveModal(null);
              }}
            >
              <Text style={[styles.listItemText, { color: textColor, textTransform: 'capitalize' }]}>
                {v.replace('_', ' ')}
              </Text>
              {visibility === v && (
                <MaterialCommunityIcons name="check" size={20} color={primaryColor} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      );

    case 'location':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Add Location</Text>
          <TextInput
            style={[styles.modalInput, { color: textColor, borderColor: border, backgroundColor: bg }]}
            placeholder="e.g. San Francisco, CA"
            placeholderTextColor={subText}
            value={locationName}
            onChangeText={setLocationName}
          />
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primaryColor }]}
            onPress={() => setActiveModal(null)}
          >
            <Text style={styles.saveBtnText}>Save Location</Text>
          </TouchableOpacity>
        </View>
      );

    case 'collab':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Add Collaborators</Text>
          <FlatList
            data={otherUsers}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const isAdded = collaborators.some((c) => c._id === item._id);
              return (
                <TouchableOpacity
                  style={[styles.listItem, { borderBottomColor: border }]}
                  onPress={() => {
                    if (isAdded) {
                      setCollaborators(collaborators.filter((c) => c._id !== item._id));
                    } else {
                      setCollaborators([...collaborators, item]);
                    }
                  }}
                >
                  <Text style={[styles.listItemText, { color: textColor }]}>{item.fullname} (@{item.username})</Text>
                  <MaterialCommunityIcons
                    name={isAdded ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isAdded ? primaryColor : subText}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      );

    case 'tag':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Mention Users</Text>
          <FlatList
            data={otherUsers}
            keyExtractor={(item) => item._id}
            renderItem={({ item }) => {
              const isAdded = taggedUsers.some((t) => t._id === item._id);
              return (
                <TouchableOpacity
                  style={[styles.listItem, { borderBottomColor: border }]}
                  onPress={() => {
                    if (isAdded) {
                      setTaggedUsers(taggedUsers.filter((t) => t._id !== item._id));
                    } else {
                      setTaggedUsers([...taggedUsers, item]);
                    }
                  }}
                >
                  <Text style={[styles.listItemText, { color: textColor }]}>{item.fullname} (@{item.username})</Text>
                  <MaterialCommunityIcons
                    name={isAdded ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={22}
                    color={isAdded ? primaryColor : subText}
                  />
                </TouchableOpacity>
              );
            }}
          />
        </View>
      );

    case 'feedback':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Critique Mode Settings</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: textColor }]}>Enable Feedback Request</Text>
            <Switch
              value={isFeedbackRequest}
              onValueChange={setIsFeedbackRequest}
              trackColor={{ false: '#767577', true: '#a5b4fc' }}
              thumbColor={isFeedbackRequest ? primaryColor : '#f4f3f4'}
            />
          </View>

          {isFeedbackRequest && (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.inputLabel, { color: subText }]}>Feedback Category</Text>
              <View style={styles.visibilityRow}>
                {['general', 'design', 'code', 'writing'].map((opt) => {
                  const isSelected = feedbackCategory === opt;
                  return (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.visibilityBtn,
                        {
                          backgroundColor: isSelected ? primaryColor : 'transparent',
                          borderColor: isSelected ? primaryColor : border,
                        },
                      ]}
                      onPress={() => setFeedbackCategory(opt)}
                    >
                      <Text style={[styles.visibilityBtnText, { color: isSelected ? '#ffffff' : textColor }]}>
                        {opt.toUpperCase()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          )}
        </View>
      );

    case 'settings':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Lock / Expiry Settings</Text>

          <Text style={[styles.inputLabel, { color: subText }]}>Self-Destruct (Expires In)</Text>
          <View style={styles.visibilityRow}>
            {[[null, 'Never'], [24, '24 Hours'], [48, '2 Days'], [120, '5 Days']].map(([h, label]: any) => {
              const isSelected = expiresInHours === h;
              return (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.visibilityBtn,
                    {
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                      borderColor: isSelected ? primaryColor : border,
                    },
                  ]}
                  onPress={() => setExpiresInHours(h)}
                >
                  <Text style={[styles.visibilityBtnText, { color: isSelected ? '#ffffff' : textColor }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={[styles.inputLabel, { color: subText, marginTop: 16 }]}>Scheduled Release (Unlocks In)</Text>
          <View style={styles.visibilityRow}>
            {[[null, 'Immediately'], [1, '1 Hour'], [6, '6 Hours'], [24, '24 Hours']].map(([h, label]: any) => {
              const isSelected = unlocksInHours === h;
              return (
                <TouchableOpacity
                  key={label}
                  style={[
                    styles.visibilityBtn,
                    {
                      backgroundColor: isSelected ? primaryColor : 'transparent',
                      borderColor: isSelected ? primaryColor : border,
                    },
                  ]}
                  onPress={() => setUnlocksInHours(h)}
                >
                  <Text style={[styles.visibilityBtnText, { color: isSelected ? '#ffffff' : textColor }]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      );

    case 'ai':
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>✨ Gemini AI Magic</Text>
          <Text style={{ color: subText, fontSize: 13, marginBottom: 12 }}>
            Enter a prompt or concept, and our AI will write a creative caption or generate an image for you.
          </Text>

          {/* AI Usage Limits Display */}
          <View style={{ flexDirection: 'row', justifyContent: 'end', gap: "10", marginBottom: 16 }}>
            <Text style={{ color: subText, fontSize: 12 }}>
              Caption: <Text style={{ color: textColor, fontWeight: 'bold' }}>{aiLimits.textRemaining} / 2</Text>
            </Text>
            <Text style={{ color: subText, fontSize: 12 }}>
              Image: <Text style={{ color: textColor, fontWeight: 'bold' }}>{aiLimits.imageRemaining} / 2</Text>
            </Text>
          </View>

          <TextInput
            style={[styles.modalInput, { color: textColor, borderColor: border, backgroundColor: bg, height: 80, textAlignVertical: 'top', paddingTop: 8 }]}
            placeholder="e.g. Write a tech launch announcement / cinematic futuristic city"
            placeholderTextColor={subText}
            multiline
            value={aiPrompt}
            onChangeText={setAiPrompt}
          />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: primaryColor, flex: 1 }]}
              onPress={generateAiCaption}
              disabled={generatingAi}
            >
              {generatingAi ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Write Caption</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveBtn, { backgroundColor: '#10b981', flex: 1 }]}
              onPress={generateAiImage}
              disabled={generatingAi}
            >
              {generatingAi ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <Text style={styles.saveBtnText}>Create Image</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      );

    default:
      return null;
  }
};

export default function NewPostScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);

  // Core Form states
  const [caption, setCaption] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Selected media state
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image' | 'video' | null>(null);

  // Selected Premium Feature States
  const [selectedGroup, setSelectedGroup] = useState<any>(null);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [visibility, setVisibility] = useState<'public' | 'followers' | 'close_friends'>('public');
  const [locationName, setLocationName] = useState('');
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [taggedUsers, setTaggedUsers] = useState<any[]>([]);
  const [isFeedbackRequest, setIsFeedbackRequest] = useState(false);
  const [feedbackCategory, setFeedbackCategory] = useState('general');
  const [expiresInHours, setExpiresInHours] = useState<number | null>(null);
  const [unlocksInHours, setUnlocksInHours] = useState<number | null>(null);

  // Modal control states
  const [activeModal, setActiveModal] = useState<string | null>(null);

  // DB Fetched datasets
  const [groups, setGroups] = useState<any[]>([]);
  const [goals, setGoals] = useState<any[]>([]);
  const [otherUsers, setOtherUsers] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // AI Prompt State
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);
  const [aiLimits, setAiLimits] = useState({ textRemaining: 2, imageRemaining: 2 });

  const bg = isDark ? '#0a0a0a' : '#f3f4f6';
  const cardBg = isDark ? '#121212' : '#ffffff';
  const border = isDark ? '#1f2937' : '#e5e7eb';
  const textColor = isDark ? '#ffffff' : '#111827';
  const subText = isDark ? '#9ca3af' : '#6b7280';
  const primaryColor = '#808bf5';

  const fetchAiLimits = async () => {
    try {
      const res = await api.get('/api/ai/limit');
      setAiLimits({
        textRemaining: res.data.text.remaining,
        imageRemaining: res.data.image.remaining,
      });
    } catch (e) {
      console.warn('Failed to fetch AI limits:', e);
    }
  };

  // Load auxiliary lists on mount
  useEffect(() => {
    const fetchAuxData = async () => {
      setLoadingData(true);
      try {
        // Groups
        const groupsRes = await api.get('/api/group/all');
        setGroups(groupsRes.data || []);

        // Goals
        if (user?._id) {
          const goalsRes = await api.get(`/api/goal/user/${user._id}`);
          setGoals((goalsRes.data || []).filter((g: any) => g.status === 'active'));
        }

        // Users
        const usersRes = await api.get('/api/auth/other-users');
        setOtherUsers(usersRes.data || []);
      } catch (e) {
        console.warn('Failed to fetch composer details:', e);
      } finally {
        setLoadingData(false);
      }
    };
    fetchAuxData();
  }, [user?._id]);

  // Fetch AI Limits when Modal opens
  useEffect(() => {
    if (activeModal === 'ai') {
      fetchAiLimits();
    }
  }, [activeModal]);

  const handlePickMedia = async () => {
    const result = await launchImageLibrary({
      mediaType: 'mixed',
      quality: 0.8,
    });

    if (result.didCancel || !result.assets || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) return;

    setSelectedUri(asset.uri);
    setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
  };

  const generateAiCaption = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Required', 'Please enter a topic or prompt for AI.');
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await api.post('/api/ai/generate-text', { prompt: aiPrompt });
      if (res.data?.text) {
        setCaption(res.data.text);
        setAiPrompt('');
        setActiveModal(null);
      } else {
        throw new Error('No text returned from Gemini model.');
      }
    } catch (e: any) {
      Alert.alert('AI Error', e.response?.data?.error || e.message || 'Failed to generate text.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const generateAiImage = async () => {
    if (!aiPrompt.trim()) {
      Alert.alert('Required', 'Please enter a prompt for image generation.');
      return;
    }
    setGeneratingAi(true);
    try {
      const res = await api.post('/api/ai/generate-image', { prompt: aiPrompt });
      if (res.data?.imageUrl) {
        setSelectedUri(res.data.imageUrl);
        setMediaType('image');
        setAiPrompt('');
        setActiveModal(null);
      } else {
        throw new Error('No image URL returned from Gemini model.');
      }
    } catch (e: any) {
      Alert.alert('AI Error', e.response?.data?.error || e.message || 'Failed to generate image.');
    } finally {
      setGeneratingAi(false);
    }
  };

  const handlePublishPost = async () => {
    if (!caption.trim() && !selectedUri) {
      Alert.alert('Required', 'Please add content or upload an image/video.');
      return;
    }

    setUploading(true);
    let uploadedMediaUrl = '';

    try {
      // Upload media if exists (except when it starts with http from AI generation fallback since it is already on Cloudinary!)
      if (selectedUri && mediaType && !selectedUri.startsWith('http')) {
        const formData = new FormData();
        formData.append('file', {
          uri: selectedUri,
          name: mediaType === 'video' ? 'post.mp4' : 'post.jpg',
          type: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
        } as any);
        formData.append('folder', 'posts');
        formData.append('resourceType', mediaType);

        const uploadRes = await api.post('/api/media/upload', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });

        if (uploadRes.data?.success && uploadRes.data?.url) {
          uploadedMediaUrl = uploadRes.data.url;
        } else {
          throw new Error(uploadRes.data?.message || 'Failed to upload media to backend proxy.');
        }
      } else if (selectedUri && selectedUri.startsWith('http')) {
        // If it starts with http, it is already uploaded to Cloudinary by the AI route!
        uploadedMediaUrl = selectedUri;
      }

      let expiresAt: string | undefined;
      if (expiresInHours) {
        expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString();
      }

      let unlocksAt: string | undefined;
      if (unlocksInHours) {
        unlocksAt = new Date(Date.now() + unlocksInHours * 60 * 60 * 1000).toISOString();
      }

      const payload: any = {
        category: 'general',
        caption: caption.trim() || undefined,
        isAnonymous,
        visibility,
        groupId: selectedGroup?._id || undefined,
        goalId: selectedGoal?._id || undefined,
        location: locationName ? { name: locationName } : undefined,
        collaboratorIds: collaborators.map((c) => c._id),
        mentionIds: taggedUsers.map((t) => t._id),
        isFeedbackRequest,
        feedbackCategory: isFeedbackRequest ? feedbackCategory : undefined,
        expiresAt,
        unlocksAt,
      };

      if (uploadedMediaUrl) {
        if (mediaType === 'video') {
          payload.videoURL = uploadedMediaUrl;
        } else {
          payload.imageURLs = [uploadedMediaUrl];
        }
      }

      await api.post('/api/post/create', payload);

      Alert.alert('Success', 'Post shared successfully!', [
        {
          text: 'OK',
          onPress: () => {
            navigation.goBack();
          },
        },
      ]);
    } catch (err: any) {
      console.warn('[NewPost] Publish error:', err);
      Alert.alert('Error', err.message || 'Failed to publish post.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: border }]}>
        <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="close" size={24} color={textColor} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: textColor }]}>Create Post</Text>
        <TouchableOpacity onPress={handlePublishPost} disabled={uploading}>
          {uploading ? (
            <ActivityIndicator size="small" color={primaryColor} />
          ) : (
            <Text style={[styles.shareText, { color: primaryColor }]}>Share</Text>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Caption Input */}
        <TextInput
          multiline
          numberOfLines={4}
          placeholder="What's on your mind?..."
          placeholderTextColor={subText}
          value={caption}
          onChangeText={setCaption}
          style={[styles.captionInput, { color: textColor, borderBottomColor: border }]}
        />

        {/* Media Selector */}
        <TouchableOpacity
          onPress={handlePickMedia}
          style={[styles.mediaSelector, { backgroundColor: cardBg, borderColor: border }]}
        >
          {selectedUri ? (
            <View style={styles.previewContainer}>
              {mediaType === 'video' ? (
                <View style={[styles.previewImage, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' }]}>
                  <MaterialCommunityIcons name="video" size={48} color="#ffffff" />
                  <Text style={{ color: '#ffffff', marginTop: 8 }}>Video Selected</Text>
                </View>
              ) : (
                <Image source={{ uri: selectedUri }} style={styles.previewImage} resizeMode="cover" />
              )}
              <View style={styles.mediaOverlay}>
                <MaterialCommunityIcons name="pencil" size={18} color="#ffffff" />
                <Text style={styles.mediaOverlayText}>Change Media</Text>
              </View>
            </View>
          ) : (
            <View style={styles.mediaPlaceholder}>
              <MaterialCommunityIcons name="image-multiple-outline" size={32} color={subText} />
              <Text style={[styles.mediaPlaceholderText, { color: subText }]}>Add photo or video (Optional)</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* 3x3 Feature Grid Panel */}
        <Text style={[styles.sectionTitle, { color: textColor }]}>Post Features</Text>
        <View style={styles.featureGrid}>
          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, selectedGroup && styles.activeGridBtn]}
            onPress={() => setActiveModal('community')}
          >
            <MaterialCommunityIcons name="globe-model" size={24} color={selectedGroup ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: selectedGroup ? '#ffffff' : textColor }]} numberOfLines={1}>
              {selectedGroup ? selectedGroup.name : 'Community'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, selectedGoal && styles.activeGridBtn]}
            onPress={() => setActiveModal('goal')}
          >
            <MaterialCommunityIcons name="flag-outline" size={24} color={selectedGoal ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: selectedGoal ? '#ffffff' : textColor }]} numberOfLines={1}>
              {selectedGoal ? selectedGoal.title : 'Goal'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, visibility !== 'public' && styles.activeGridBtn]}
            onPress={() => setActiveModal('visibility')}
          >
            <MaterialCommunityIcons name="eye-outline" size={24} color={visibility !== 'public' ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: visibility !== 'public' ? '#ffffff' : textColor }]} numberOfLines={1}>
              {visibility}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, locationName && styles.activeGridBtn]}
            onPress={() => setActiveModal('location')}
          >
            <MaterialCommunityIcons name="map-marker-outline" size={24} color={locationName ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: locationName ? '#ffffff' : textColor }]} numberOfLines={1}>
              {locationName || 'Location'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, collaborators.length > 0 && styles.activeGridBtn]}
            onPress={() => setActiveModal('collab')}
          >
            <MaterialCommunityIcons name="account-multiple-plus-outline" size={24} color={collaborators.length > 0 ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: collaborators.length > 0 ? '#ffffff' : textColor }]} numberOfLines={1}>
              {collaborators.length > 0 ? `${collaborators.length} Collabs` : 'Collab'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, taggedUsers.length > 0 && styles.activeGridBtn]}
            onPress={() => setActiveModal('tag')}
          >
            <MaterialCommunityIcons name="tag-outline" size={24} color={taggedUsers.length > 0 ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: taggedUsers.length > 0 ? '#ffffff' : textColor }]} numberOfLines={1}>
              {taggedUsers.length > 0 ? `${taggedUsers.length} Tagged` : 'Tag'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, isFeedbackRequest && styles.activeGridBtn]}
            onPress={() => setActiveModal('feedback')}
          >
            <MaterialCommunityIcons name="message-draw" size={24} color={isFeedbackRequest ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: isFeedbackRequest ? '#ffffff' : textColor }]} numberOfLines={1}>
              {isFeedbackRequest ? feedbackCategory : 'Feedback'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, (expiresInHours || unlocksInHours) && styles.activeGridBtn]}
            onPress={() => setActiveModal('settings')}
          >
            <MaterialCommunityIcons name="cog-outline" size={24} color={(expiresInHours || unlocksInHours) ? '#ffffff' : primaryColor} />
            <Text style={[styles.gridBtnText, { color: (expiresInHours || unlocksInHours) ? '#ffffff' : textColor }]} numberOfLines={1}>
              Settings
            </Text>
          </TouchableOpacity>

          <View style={[styles.anonContainer, { backgroundColor: cardBg, borderColor: border }]}>
            <MaterialCommunityIcons name="incognito" size={22} color={textColor} />
            <Text style={[styles.anonText, { color: textColor }]}>Anonymous</Text>
            <Switch
              value={isAnonymous}
              onValueChange={setIsAnonymous}
              trackColor={{ false: '#767577', true: '#a5b4fc' }}
              thumbColor={isAnonymous ? primaryColor : '#f4f3f4'}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.aiButton, { borderColor: primaryColor }]}
          onPress={() => setActiveModal('ai')}
        >
          <MaterialCommunityIcons name="sparkles" size={20} color={primaryColor} />
          <Text style={[styles.aiButtonText, { color: primaryColor }]}>AI Magic</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Feature Settings Modals */}
      <Modal
        visible={activeModal !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <View style={[styles.modalHeader, { borderBottomColor: border }]}>
              <TouchableOpacity onPress={() => setActiveModal(null)} style={styles.modalCloseBtn}>
                <MaterialCommunityIcons name="close" size={24} color={textColor} />
              </TouchableOpacity>
              <Text style={[styles.modalTitle, { color: textColor }]}>Post Settings</Text>
              <TouchableOpacity onPress={() => setActiveModal(null)}>
                <Text style={{ color: primaryColor, fontWeight: 'bold' }}>Done</Text>
              </TouchableOpacity>
            </View>

            <ModalBody
              activeModal={activeModal}
              groups={groups}
              goals={goals}
              otherUsers={otherUsers}
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              selectedGoal={selectedGoal}
              setSelectedGoal={setSelectedGoal}
              visibility={visibility}
              setVisibility={setVisibility}
              locationName={locationName}
              setLocationName={setLocationName}
              collaborators={collaborators}
              setCollaborators={setCollaborators}
              taggedUsers={taggedUsers}
              setTaggedUsers={setTaggedUsers}
              isFeedbackRequest={isFeedbackRequest}
              setIsFeedbackRequest={setIsFeedbackRequest}
              feedbackCategory={feedbackCategory}
              setFeedbackCategory={setFeedbackCategory}
              expiresInHours={expiresInHours}
              setExpiresInHours={setExpiresInHours}
              unlocksInHours={unlocksInHours}
              setUnlocksInHours={setUnlocksInHours}
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              generateAiCaption={generateAiCaption}
              generateAiImage={generateAiImage}
              generatingAi={generatingAi}
              aiLimits={aiLimits}
              setActiveModal={setActiveModal}
              textColor={textColor}
              subText={subText}
              border={border}
              bg={bg}
              primaryColor={primaryColor}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  shareText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  captionInput: {
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
    borderBottomWidth: 1,
    paddingBottom: 12,
    marginBottom: 16,
  },
  mediaSelector: {
    height: 120,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 20,
  },
  previewContainer: {
    width: '100%',
    height: '100%',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  mediaOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    height: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  mediaOverlayText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: 'bold',
  },
  mediaPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaPlaceholderText: {
    fontSize: 13,
    marginTop: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  gridBtn: {
    width: '31.5%',
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 6,
  },
  activeGridBtn: {
    backgroundColor: '#808bf5',
    borderColor: '#808bf5',
  },
  gridBtnText: {
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  anonContainer: {
    width: '31.5%',
    height: 80,
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 4,
  },
  anonText: {
    fontSize: 9,
    fontWeight: 'bold',
    marginTop: 2,
    marginBottom: 2,
  },
  aiButton: {
    borderWidth: 1,
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  aiButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },

  // Modals Styling
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    minHeight: '40%',
    paddingBottom: 30,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalBody: {
    padding: 16,
  },
  modalHeading: {
    fontSize: 15,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  listItemText: {
    fontSize: 14,
  },
  modalInput: {
    height: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 16,
  },
  saveBtn: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  visibilityRow: {
    flexDirection: 'row',
    gap: 8,
  },
  visibilityBtn: {
    flex: 1,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  visibilityBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
});
