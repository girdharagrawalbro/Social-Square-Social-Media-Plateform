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
  Platform,
  ToastAndroid,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Video from 'react-native-video';
import { useNavigation } from '@react-navigation/native';
import { launchImageLibrary, launchCamera } from 'react-native-image-picker';
import ImageCropperModal from './components/ImageCropperModal';
import { api } from '../lib/api';
import { getCache, setCache, invalidateCache, TTL } from '../lib/cache';
import { appChannel } from '../lib/broadcast';
import useAuthStore from '../store/zustand/useAuthStore';
import { usePostHog } from 'posthog-react-native';

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
  const loggedUser = useAuthStore((s: any) => s.user);

  // Collab Search States
  const [collabQuery, setCollabQuery] = useState('');
  const [collabResults, setCollabResults] = useState<any[]>([]);
  const [searchingCollab, setSearchingCollab] = useState(false);

  // Tag Search States
  const [tagQuery, setTagQuery] = useState('');
  const [tagResults, setTagResults] = useState<any[]>([]);
  const [searchingTag, setSearchingTag] = useState(false);

  // Location Fetching State
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Reset search queries when modal changes
  useEffect(() => {
    setCollabQuery('');
    setCollabResults([]);
    setTagQuery('');
    setTagResults([]);
  }, [activeModal]);

  // Collab search effect
  useEffect(() => {
    if (collabQuery.length < 2) {
      setCollabResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchingCollab(true);
      try {
        const res = await api.get(`/api/auth/search?query=${collabQuery}`);
        const users = res.data?.users || [];
        setCollabResults(users.filter((u: any) => u._id !== loggedUser?._id));
      } catch (err) {
        console.warn(err);
      } finally {
        setSearchingCollab(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [collabQuery, loggedUser?._id]);

  // Tag search effect
  useEffect(() => {
    if (tagQuery.length < 2) {
      setTagResults([]);
      return;
    }
    const delayDebounce = setTimeout(async () => {
      setSearchingTag(true);
      try {
        const res = await api.get(`/api/auth/search?query=${tagQuery}`);
        const users = res.data?.users || [];
        setTagResults(users.filter((u: any) => u._id !== loggedUser?._id));
      } catch (err) {
        console.warn(err);
      } finally {
        setSearchingTag(false);
      }
    }, 400);
    return () => clearTimeout(delayDebounce);
  }, [tagQuery, loggedUser?._id]);

  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    // Try IP-based location first
    try {
      const res = await fetch('https://ipapi.co/json/');
      const data = await res.json();
      if (data && data.city) {
        const region = data.region ? `, ${data.region}` : '';
        setLocationName(`${data.city}${region}`);
        setLoadingLocation(false);
        return;
      }
    } catch (e) {
      console.warn('IP location failed, trying HTML5 geolocation...', e);
    }

    // Fallback to navigator.geolocation
    const nav = (globalThis as any).navigator;
    if (nav && nav.geolocation) {
      nav.geolocation.getCurrentPosition(
        async (position: any) => {
          const { latitude, longitude } = position.coords;
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const data = await res.json();
            const name = data.address?.city || data.address?.town || data.address?.village || `${latitude.toFixed(3)}, ${longitude.toFixed(3)}`;
            setLocationName(name);
          } catch (err: any) {
            setLocationName(`${latitude.toFixed(3)}, ${longitude.toFixed(3)}`);
          }
          setLoadingLocation(false);
        },
        (err: any) => {
          console.warn('Geolocation error:', err);
          Alert.alert('Location Error', 'Could not retrieve location. Please type manually.');
          setLoadingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      Alert.alert('Location Error', 'Geolocation is not supported. Please type manually.');
      setLoadingLocation(false);
    }
  };

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
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <TextInput
              style={[styles.modalInput, { color: textColor, borderColor: border, backgroundColor: bg, flex: 1, marginBottom: 0 }]}
              placeholder="e.g. San Francisco, CA"
              placeholderTextColor={subText}
              value={locationName}
              onChangeText={setLocationName}
            />
            <TouchableOpacity
              style={{
                backgroundColor: bg,
                borderColor: border,
                borderWidth: 1,
                borderRadius: 8,
                width: 48,
                height: 48,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onPress={fetchCurrentLocation}
              disabled={loadingLocation}
            >
              {loadingLocation ? (
                <ActivityIndicator size="small" color={primaryColor} />
              ) : (
                <MaterialCommunityIcons name="crosshairs-gps" size={24} color={primaryColor} />
              )}
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: primaryColor }]}
            onPress={() => setActiveModal(null)}
          >
            <Text style={styles.saveBtnText}>Save Location</Text>
          </TouchableOpacity>
        </View>
      );

    case 'collab':
      const collabData = collabQuery.length >= 2 ? collabResults : otherUsers;
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Add Collaborators</Text>
          <TextInput
            style={[styles.modalInput, { color: textColor, borderColor: border, backgroundColor: bg, marginBottom: 12 }]}
            placeholder="Search users..."
            placeholderTextColor={subText}
            value={collabQuery}
            onChangeText={setCollabQuery}
          />
          {searchingCollab && <ActivityIndicator size="small" color={primaryColor} style={{ marginBottom: 12 }} />}
          <FlatList
            data={collabData}
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
      const tagData = tagQuery.length >= 2 ? tagResults : otherUsers;
      return (
        <View style={styles.modalBody}>
          <Text style={[styles.modalHeading, { color: textColor }]}>Mention Users</Text>
          <TextInput
            style={[styles.modalInput, { color: textColor, borderColor: border, backgroundColor: bg, marginBottom: 12 }]}
            placeholder="Search users..."
            placeholderTextColor={subText}
            value={tagQuery}
            onChangeText={setTagQuery}
          />
          {searchingTag && <ActivityIndicator size="small" color={primaryColor} style={{ marginBottom: 12 }} />}
          <FlatList
            data={tagData}
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
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginBottom: 16 }}>
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
  const posthog = usePostHog();
  useEffect(() => {
    try {
      posthog?.startSessionRecording();
    } catch (e) {
      console.error("Failed to start session recording:", e);
    }
    return () => {
      try {
        posthog?.stopSessionRecording();
      } catch (e) {
        console.error("Failed to stop session recording:", e);
      }
    };
  }, [posthog]);

  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const user = useAuthStore((s: any) => s.user);

  // Core Form states
  const [caption, setCaption] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Selected media state (supports multiple files & crop settings)
  const [selectedMedia, setSelectedMedia] = useState<{ uri: string; type: 'image' | 'video'; cropData?: any }[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [croppingModalVisible, setCroppingModalVisible] = useState(false);
  const [croppingItemIndex, setCroppingItemIndex] = useState<number | null>(null);
  const [pickerMenuVisible, setPickerMenuVisible] = useState(false);

  const selectedUri = selectedMedia[activeMediaIndex]?.uri || null;
  const mediaType = selectedMedia[activeMediaIndex]?.type || null;

  const setSelectedUri = (uri: string | null) => {
    if (uri === null) {
      setSelectedMedia([]);
      setActiveMediaIndex(0);
    } else {
      setSelectedMedia(prev => [...prev, { uri, type: 'image' }]);
      setActiveMediaIndex(selectedMedia.length);
    }
  };

  const setMediaType = (type: 'image' | 'video' | null) => {
    if (type !== null && selectedMedia.length > 0) {
      setSelectedMedia(prev => {
        const copy = [...prev];
        if (copy[copy.length - 1]) {
          copy[copy.length - 1].type = type;
        }
        return copy;
      });
    }
  };

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

  const bg = isDark ? '#000000' : '#f3f4f6';
  const cardBg = isDark ? '#111111' : '#ffffff';
  const border = isDark ? '#1a1a1a' : '#e5e7eb';
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

  // Load auxiliary lists on mount — cache-first for instant loading
  useEffect(() => {
    const fetchAuxData = async () => {
      setLoadingData(true);
      try {
        // ─── Groups ──────────────────────────────────────────────────────
        const cachedGroups = await getCache<any[]>('new_post_groups');
        if (cachedGroups) setGroups(cachedGroups);

        // ─── Goals ───────────────────────────────────────────────────────
        const goalCacheKey = `new_post_goals_${user?._id}`;
        const cachedGoals = await getCache<any[]>(goalCacheKey);
        if (cachedGoals) setGoals(cachedGoals);

        // ─── Users ───────────────────────────────────────────────────────
        const cachedUsers = await getCache<any[]>('new_post_users');
        if (cachedUsers) setOtherUsers(cachedUsers);

        // Background-refresh from API
        const groupsRes = await api.get('/api/group/all');
        const freshGroups = groupsRes.data || [];
        setGroups(freshGroups);
        await setCache('new_post_groups', freshGroups, TTL.FORM_DATA);

        if (user?._id) {
          const goalsRes = await api.get(`/api/goal/user/${user._id}`);
          const freshGoals = (goalsRes.data || []).filter((g: any) => g.status === 'active');
          setGoals(freshGoals);
          await setCache(goalCacheKey, freshGoals, TTL.FORM_DATA);
        }

        const usersRes = await api.get('/api/auth/other-users');
        const freshUsers = usersRes.data || [];
        setOtherUsers(freshUsers);
        await setCache('new_post_users', freshUsers, TTL.FORM_DATA);
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

  // Camera/Gallery media picker — asks the user which source to use
  const handlePickMedia = () => {
    setPickerMenuVisible(true);
  };

  const handleCropComplete = (croppedUri: string, cropData?: any) => {
    if (croppingItemIndex !== null) {
      setSelectedMedia(prev => {
        const copy = [...prev];
        if (copy[croppingItemIndex]) {
          copy[croppingItemIndex].cropData = cropData;
        }
        return copy;
      });
    }
    setCroppingModalVisible(false);
    setCroppingItemIndex(null);
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

    const showToast = (message: string) => {
      if (Platform.OS === 'android') {
        ToastAndroid.show(message, ToastAndroid.SHORT);
      } else {
        console.log(message);
      }
    };

    setUploading(true);
    showToast('Posting...');

    // Close the screen after 1 second
    setTimeout(() => {
      navigation.goBack();
    }, 1000);

    // Run the upload in background
    (async () => {
      const uploadedUrls: string[] = [];
      let videoUrlString = '';
      try {
        for (const item of selectedMedia) {
          if (item.uri.startsWith('http')) {
            if (item.type === 'video') {
              videoUrlString = item.uri;
            } else {
              uploadedUrls.push(item.uri);
            }
          } else {
            const formData = new FormData();
            formData.append('file', {
              uri: item.uri,
              name: item.type === 'video' ? 'post.mp4' : 'post.jpg',
              type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
            } as any);
            formData.append('folder', 'posts');
            formData.append('resourceType', item.type);

            const uploadRes = await api.post('/api/media/upload', formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
              },
              timeout: 0,
            });

            if (uploadRes.data?.success && uploadRes.data?.url) {
              if (item.type === 'video') {
                videoUrlString = uploadRes.data.url;
              } else {
                uploadedUrls.push(uploadRes.data.url);
              }
            } else {
              throw new Error(uploadRes.data?.message || 'Failed to upload media to backend proxy.');
            }
          }
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

        if (videoUrlString) {
          payload.videoURL = videoUrlString;
        }
        if (uploadedUrls.length > 0) {
          payload.imageURLs = uploadedUrls;
        }

        const createRes = await api.post('/api/post/create', payload);

        // Invalidate caches
        await invalidateCache('feed_page_1');
        if (user?._id) {
          await invalidateCache(`profile_posts_${user._id}`);
        }

        showToast('Posted successfully!');

        // Broadcast post creation event so home feed inserts it at the top
        appChannel.postMessage({
          type: 'POST_CREATED',
          post: createRes.data?.post || createRes.data,
        });

      } catch (err: any) {
        console.warn('[NewPost] Background publish error:', err);
        showToast('Failed to publish post.');
      }
    })();
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
        {selectedMedia.length > 0 ? (
          <View style={[styles.carouselContainer, { borderColor: border }]}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const x = e.nativeEvent.contentOffset.x;
                const idx = Math.round(x / (Dimensions.get('window').width - 24));
                setActiveMediaIndex(idx);
              }}
              scrollEventThrottle={16}
              style={{ flex: 1 }}
            >
              {selectedMedia.map((item, index) => (
                <View key={index} style={{ width: Dimensions.get('window').width - 24, height: 450, position: 'relative' }}>
                  {item.type === 'video' ? (
                    <Video
                      source={{ uri: item.uri }}
                      style={{ width: '100%', height: '100%' }}
                      resizeMode="contain"
                      paused={true}
                      controls={true}
                      muted={true}
                    />
                  ) : (
                    <Image
                      source={{ uri: item.uri }}
                      style={[
                        { width: '100%', height: '100%' },
                        item.cropData && {
                          transform: [
                            { scale: item.cropData.scale },
                            { translateX: item.cropData.x },
                            { translateY: item.cropData.y },
                          ],
                        },
                      ]}
                      resizeMode="contain"
                    />
                  )}

                  {/* Actions overlay */}
                  <View style={styles.carouselActionsOverlay}>
                    {item.type === 'image' && (
                      <TouchableOpacity
                        style={styles.actionIconBtn}
                        onPress={() => {
                          setCroppingItemIndex(index);
                          setCroppingModalVisible(true);
                        }}
                      >
                        <MaterialCommunityIcons name="crop" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionIconBtn, { backgroundColor: '#ef4444' }]}
                      onPress={() => {
                        setSelectedMedia(prev => prev.filter((_, i) => i !== index));
                        if (activeMediaIndex >= selectedMedia.length - 1) {
                          setActiveMediaIndex(Math.max(0, selectedMedia.length - 2));
                        }
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={20} color="#ffffff" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Pagination & Add more */}
            <View style={styles.carouselFooter}>
              <View style={styles.dotsRow}>
                {selectedMedia.map((_, index) => (
                  <View
                    key={index}
                    style={[
                      styles.dotItem,
                      { backgroundColor: index === activeMediaIndex ? '#808bf5' : subText },
                    ]}
                  />
                ))}
              </View>

              <TouchableOpacity style={styles.addMoreBtn} onPress={handlePickMedia}>
                <MaterialCommunityIcons name="plus" size={16} color="#808bf5" />
                <Text style={styles.addMoreText}>Add Media</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            onPress={handlePickMedia}
            style={[styles.mediaSelector, { backgroundColor: cardBg, borderColor: border }]}
          >
            <View style={styles.mediaPlaceholder}>
              <MaterialCommunityIcons name="image-multiple-outline" size={32} color={subText} />
              <Text style={[styles.mediaPlaceholderText, { color: subText }]}>
                Add Photo / Video
              </Text>
            </View>
          </TouchableOpacity>
        )}

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
            style={[styles.gridBtn, { backgroundColor: cardBg, borderColor: border }, !!(expiresInHours || unlocksInHours) && styles.activeGridBtn]}
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
          <MaterialCommunityIcons name="creation" size={20} color={primaryColor} />
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

      {/* Image Cropper Modal */}
      <ImageCropperModal
        visible={croppingModalVisible}
        mediaUri={croppingItemIndex !== null ? selectedMedia[croppingItemIndex]?.uri : null}
        mediaType={croppingItemIndex !== null ? selectedMedia[croppingItemIndex]?.type : 'image'}
        onCropComplete={handleCropComplete}
        onCancel={() => {
          setCroppingModalVisible(false);
          setCroppingItemIndex(null);
        }}
      />
      {/* Premium Post Media Picker Modal (Instagram-style Bottom Sheet) */}
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
              <Text style={[styles.bottomSheetTitle, { color: textColor }]}>Add Media</Text>
            </View>

            <View style={styles.bottomSheetOptions}>
              <TouchableOpacity
                style={styles.bottomSheetOption}
                onPress={() => {
                  setPickerMenuVisible(false);
                  launchImageLibrary(
                    { mediaType: 'mixed', quality: 0.8 },
                    (result) => {
                      if (result.didCancel || result.errorCode) return;
                      const asset = result.assets?.[0];
                      if (!asset?.uri) return;
                      setSelectedUri(asset.uri);
                      setMediaType(asset.type?.startsWith('video') ? 'video' : 'image');
                    },
                  );
                }}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(128, 139, 245, 0.15)' }]}>
                  <MaterialCommunityIcons name="image-multiple-outline" size={24} color="#808bf5" />
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>Choose from Gallery</Text>
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
                    },
                  );
                }}
              >
                <View style={[styles.optionIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <MaterialCommunityIcons name="camera-outline" size={24} color="#f59e0b" />
                </View>
                <Text style={[styles.optionText, { color: textColor }]}>Take Photo / Video</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
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
  carouselContainer: {
    width: '100%',
    height: 500,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 20,
  },
  carouselActionsOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    gap: 8,
    zIndex: 10,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  carouselFooter: {
    height: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
  },
  dotItem: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  addMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
  },
  addMoreText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#808bf5',
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
