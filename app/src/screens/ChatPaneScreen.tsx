import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  useColorScheme,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Animated,
  PanResponder,
  Linking,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useRoute, useNavigation, useIsFocused } from '@react-navigation/native';
import { launchImageLibrary } from 'react-native-image-picker';
import { api } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { decryptText, encryptText } from '../lib/cryptoUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── DOUBLE TICK ─────────────────────────────────────────────────────────────
const DoubleCheck = ({ isRead, isMe }: { isRead: boolean; isMe: boolean }) => {
  if (!isMe) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center'}}>
      <MaterialCommunityIcons
        name="check"
        size={12}
        color={isRead ? '#3897f0' : 'rgba(255,255,255,0.65)'}
        style={{  }}
      />
      <MaterialCommunityIcons
        name="check"
        size={12}
        color={isRead ? '#3897f0' : 'rgba(255,255,255,0.65)'}
      />
    </View>
  );
};

// ─── SWIPEABLE BUBBLE ────────────────────────────────────────────────────────
function SwipeableBubble({
  item,
  isMe,
  isDark,
  textColor,
  subColor,
  borderColor,
  currentUser,
  onLongPress,
  onReply,
  onImagePress,
  onStoryPress,
  onPostPress,
}: any) {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyOpacity = useRef(new Animated.Value(0)).current;

  // Keep latest callbacks in refs so PanResponder (created once) always calls the fresh version
  const onReplyRef = useRef(onReply);
  const itemRef = useRef(item);
  useEffect(() => {
    onReplyRef.current = onReply;
    itemRef.current = item;
  });

  // PanResponder MUST be in useRef — creating it on every render breaks it
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
      onPanResponderMove: (_, g) => {
        if (g.dx > 0 && g.dx <= 80) {
          translateX.setValue(g.dx);
          replyOpacity.setValue(g.dx / 80);
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx >= 55) {
          onReplyRef.current && onReplyRef.current(itemRef.current);
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 200,
          friction: 22,
        }).start();
        Animated.timing(replyOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const isDeleted = !!item.deletedAt;
  const incomingBg = '#f8fafc';

  const extractSharedLink = (text: string = '') => {
    const postMatch = text.match(/\/post\/([a-f0-9]{24})/i);
    const profileMatch = text.match(/\/profile\/([a-f0-9]{24})/i);
    return {
      postId: postMatch ? postMatch[1] : null,
      profileId: profileMatch ? profileMatch[1] : null,
    };
  };

  const content = item.decryptedContent || item.content || '';
  const link = extractSharedLink(content);
  const isSharedPost = !!(item.sharedPost?.postId || link.postId);
  const isSharedProfile = !!link.profileId;
  const hasCard = isSharedPost || isSharedProfile || !!item.storyReply;
  const isPlaceholder = content === 'Sent an attachment' || content === 'You sent an attachment' || content.startsWith('http://') || content.startsWith('https://') || content.includes('/post/') || content.includes('/profile/');

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 2 }}>
      <Animated.View
        style={{
          position: 'absolute',
          left: -35,
          opacity: replyOpacity,
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: isDark ? '#334155' : '#e2e8f0',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <MaterialCommunityIcons name="reply" size={15} color="#808bf5" />
      </Animated.View>

      <Animated.View
        style={{ flex: 1, transform: [{ translateX }] }}
        {...panResponder.panHandlers}>
        <TouchableOpacity
          onLongPress={() => onLongPress(item)}
          delayLongPress={250}
          activeOpacity={0.85}
          style={isMe ? styles.bubbleRight : styles.bubbleLeft}>
          <View style={{ maxWidth: '100%' }}>
            {/* Reply Quote */}
            {item.replyTo && !isDeleted && (
              <View style={[styles.replyQuote, {
                borderLeftColor: isMe ? 'rgba(255,255,255,0.6)' : '#808bf5',
                backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : (isDark ? '#334155' : '#e8eaf6'),
              }]}>
                <Text style={[styles.replyQuoteName, {
                  color: isMe ? 'rgba(255,255,255,0.9)' : '#808bf5',
                }]}>
                  {item.replyTo.senderName || item.replyTo.sender?.fullname || 'User'}
                </Text>
                <Text style={[styles.replyQuoteText, {
                  color: isMe ? 'rgba(255,255,255,0.7)' : subColor,
                }]} numberOfLines={1}>
                  {item.replyTo.decryptedContent || item.replyTo.content || '📎 Media'}
                </Text>
              </View>
            )}

            <View style={[styles.bubble, {
              backgroundColor: (isSharedPost || isSharedProfile) ? 'transparent' : isMe ? '#808bf5' : incomingBg,
              borderTopRightRadius: isMe ? 4 : 18,
              borderTopLeftRadius: isMe ? 18 : 4,
            }]}>

              {isDeleted ? (
                <Text style={{
                  fontStyle: 'italic', fontSize: 13,
                  color: isMe ? 'rgba(255,255,255,0.6)' : '#94a3b8'
                }}>
                  🚫 Message deleted
                </Text>
              ) : (
                <>
                  {/* Story reply */}
                  {item.storyReply && (
                    <TouchableOpacity
                      onPress={() => onStoryPress && onStoryPress(item.storyReply.storyId)}
                      style={{
                        backgroundColor: isMe ? 'rgba(0,0,0,0.1)' : (isDark ? '#334155' : '#e8eaf6'),
                        borderRadius: 10, padding: 8, marginBottom: 6, flexDirection: 'row', alignItems: 'center', gap: 8, width: 200
                      }}>
                      {item.storyReply.mediaUrl ? (
                        <Image source={{ uri: item.storyReply.mediaUrl }} style={{ width: 40, height: 40, borderRadius: 8 }} />
                      ) : (
                        <View style={{
                          width: 40, height: 40, borderRadius: 8, backgroundColor: '#808bf5',
                          justifyContent: 'center', alignItems: 'center'
                        }}>
                          <Text style={{ fontSize: 18 }}>✨</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: isMe ? '#fff' : textColor }}>
                          Replied to story
                        </Text>
                        <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.7)' : subColor }}>
                          Tap to view ✨
                        </Text>
                      </View>
                    </TouchableOpacity>
                  )}

                  {/* Shared Post Card */}
                  {isSharedPost && item.sharedPost && (
                    <TouchableOpacity
                      onPress={() => onPostPress && onPostPress(item.sharedPost.postId || link.postId)}
                      style={{
                        borderRadius: 14, overflow: 'hidden', marginBottom: content ? 6 : 0,
                        backgroundColor: isMe ? '#6366f1' : (isDark ? '#1e293b' : '#f1f5f9'),
                        borderWidth: 1, borderColor: isMe ? 'rgba(255,255,255,0.15)' : borderColor,
                        minWidth: 220, maxWidth: 260
                      }}>
                      <View style={{
                        flexDirection: 'row', alignItems: 'center', padding: 8,
                        borderBottomWidth: 1, borderBottomColor: isMe ? 'rgba(255,255,255,0.1)' : borderColor, gap: 6
                      }}>
                        {item.sharedPost.authorProfilePicture ? (
                          <Image source={{ uri: item.sharedPost.authorProfilePicture }}
                            style={{ width: 26, height: 26, borderRadius: 13 }} />
                        ) : (
                          <View style={{
                            width: 26, height: 26, borderRadius: 13,
                            backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center'
                          }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                              {(item.sharedPost.authorName || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isMe ? '#fff' : textColor }}
                            numberOfLines={1}>{item.sharedPost.authorName}</Text>
                          <Text style={{ fontSize: 10, color: isMe ? 'rgba(255,255,255,0.6)' : subColor }}>
                            @{item.sharedPost.authorUsername}
                          </Text>
                        </View>
                      </View>
                      {(item.sharedPost.thumbnailUrl || item.sharedPost.mediaUrl) && (
                        <Image source={{ uri: item.sharedPost.thumbnailUrl || item.sharedPost.mediaUrl }}
                          style={{ width: '100%', height: 220 }} resizeMode="cover" />
                      )}
                      {item.sharedPost.caption ? (
                        <View style={{ padding: 8 }}>
                          <Text style={{ fontSize: 11, color: isMe ? 'rgba(255,255,255,0.8)' : textColor }} numberOfLines={2}>
                            {item.sharedPost.caption}
                          </Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  )}

                  {/* Shared Post link only */}
                  {isSharedPost && !item.sharedPost && (
                    <TouchableOpacity
                      onPress={() => onPostPress && onPostPress(link.postId)}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <MaterialCommunityIcons name="image-multiple" size={18} color={isMe ? '#fff' : '#808bf5'} />
                      <Text style={{ fontSize: 13, color: isMe ? '#fff' : textColor }}>Shared a Post</Text>
                    </TouchableOpacity>
                  )}

                  {/* Shared Profile */}
                  {isSharedProfile && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <MaterialCommunityIcons name="account-circle" size={18} color={isMe ? '#fff' : '#808bf5'} />
                      <Text style={{ fontSize: 13, color: isMe ? '#fff' : textColor }}>Shared a Profile</Text>
                    </View>
                  )}

                  {/* Image Media */}
                  {(item.decryptedMediaUrl || item.mediaUrl) && item.mediaType !== 'video' && !item.storyReply && (
                    <TouchableOpacity onPress={() => onImagePress && onImagePress(item.decryptedMediaUrl || item.mediaUrl)}>
                      <Image source={{ uri: item.decryptedMediaUrl || item.mediaUrl }}
                        style={styles.mediaImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}

                  {/* Video Media */}
                  {(item.decryptedMediaUrl || item.mediaUrl) && item.mediaType === 'video' && !item.storyReply && (
                    <View style={styles.videoPreview}>
                      <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>Video</Text>
                    </View>
                  )}

                  {/* media.url format (web-compatible) */}
                  {item.media?.url && item.media?.type === 'image' && !item.storyReply && (
                    <TouchableOpacity onPress={() => onImagePress && onImagePress(item.media.url)}>
                      <Image source={{ uri: item.media.url }} style={styles.mediaImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {item.media?.url && item.media?.type === 'video' && !item.storyReply && (
                    <View style={styles.videoPreview}>
                      <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
                    </View>
                  )}
                  {item.media?.url && item.media?.type === 'audio' && !item.storyReply && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="waveform" size={20} color={isMe ? '#fff' : '#808bf5'} />
                      <Text style={{ color: isMe ? '#fff' : textColor, fontSize: 13 }}>Voice Note</Text>
                    </View>
                  )}
                  {item.media?.url && item.media?.type === 'file' && !item.storyReply && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      onPress={() => Linking.openURL(item.media.url)}>
                      <MaterialCommunityIcons name="file-outline" size={20} color={isMe ? '#fff' : '#808bf5'} />
                      <Text style={{ color: isMe ? '#fff' : textColor, fontSize: 13 }}>
                        {item.media.name || 'File'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Text */}
                  {!isPlaceholder && content ? (
                    <Text style={[styles.messageText, { color: isMe ? '#ffffff' : '#0f172a', marginTop: hasCard ? 6 : 0 }]}>
                      {content}
                    </Text>
                  ) : null}

                  {/* Edited */}
                  {item.edited && (
                    <Text style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>· edited</Text>
                  )}
                </>
              )}

              {/* Time + ticks */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 2 }}>
                <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.65)' : '#64748b' }]}>
                  {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
                <DoubleCheck isRead={!!item.isRead} isMe={isMe} />
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ChatPaneScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const isFocused = useIsFocused();
  const currentUser = useAuthStore((s: any) => s.user);

  const { conversationId, title, recipientId, recipientAvatar } = route.params;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);

  const [isOnline, setIsOnline] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [storyPlayerVisible, setStoryPlayerVisible] = useState(false);

  const bg = isDark ? '#0f0f1a' : '#f1f5f9';
  const cardBg = isDark ? '#1a1a2e' : '#ffffff';
  const textColor = isDark ? '#f1f5f9' : '#0f172a';
  const subColor = isDark ? '#64748b' : '#94a3b8';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';

  const unescapeHtml = (str: string | null | undefined) => {
    if (!str) return str;
    return str
      .replace(/&quot;/g, '"')
      .replace(/&#x27;/g, "'")
      .replace(/&#x2F;/g, '/')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  };

  const decryptContent = async (raw: string, aesKey: string) => {
    const unescaped = unescapeHtml(raw);
    if (!unescaped || !unescaped.startsWith('{"ciphertext":')) return raw;
    try {
      const obj = JSON.parse(unescaped);
      return await decryptText(obj.ciphertext, obj.iv, aesKey);
    } catch {
      return 'Encrypted';
    }
  };

  const processMessages = useCallback(async (raw: any[]) => {
    const aesKey = await useE2eeStore.getState().getConversationKey(conversationId, recipientId);
    return Promise.all(raw.map(async (msg: any) => {
      let dec = msg.content;
      let decMediaUrl = msg.mediaUrl;
      if (aesKey) {
        if (msg.content) dec = await decryptContent(msg.content, aesKey);
        if (msg.mediaUrl) decMediaUrl = await decryptContent(msg.mediaUrl, aesKey);
      }
      return { ...msg, decryptedContent: dec, decryptedMediaUrl: decMediaUrl };
    }));
  }, [conversationId, recipientId]);

  const fetchMessages = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    try {
      // Send both IDs — server uses whichever is available
      const payload: any = { limit: 50 };
      if (recipientId) payload.recipientId = recipientId;
      if (conversationId) payload.conversationId = conversationId;

      const res = await api.post('/api/conversation/messages', payload);
      const raw = res.data?.messages || (Array.isArray(res.data) ? res.data : []);

      if (!Array.isArray(raw)) {
        console.warn('[ChatPane] Unexpected messages format:', res.data);
        if (showLoader) setLoading(false);
        return;
      }

      try {
        const processed = await processMessages(raw);
        setMessages([...processed].reverse());
      } catch (procErr) {
        console.warn('[ChatPane] processMessages error:', procErr);
        // Fall back: show raw unencrypted messages
        setMessages([...raw].reverse().map(m => ({ ...m, decryptedContent: m.content })));
      }
    } catch (e: any) {
      console.warn('[ChatPane] fetchMessages error:', e?.response?.status, e?.message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [recipientId, conversationId, processMessages]);

  const fetchOnlineStatus = useCallback(async () => {
    try {
      const res = await api.get(`/api/auth/online-status/${recipientId}`);
      setIsOnline(res.data?.isOnline || false);
      setLastSeen(res.data?.lastSeen || null);
    } catch { /* silent */ }
  }, [recipientId]);

  useEffect(() => {
    if (!isFocused) return;
    fetchMessages(true);
    fetchOnlineStatus();
    const msgInterval = setInterval(() => fetchMessages(false), 4000);
    const statusInterval = setInterval(fetchOnlineStatus, 20000);
    return () => {
      clearInterval(msgInterval);
      clearInterval(statusInterval);
    };
  }, [isFocused, fetchMessages, fetchOnlineStatus]);

  const handleSend = async () => {
    if (!inputText.trim() || sending) return;
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    try {
      const aesKey = await useE2eeStore.getState().getConversationKey(conversationId, recipientId);
      let finalContent = text;
      let isEncrypted = false;
      if (aesKey && aesKey !== 'mock-conversation-aes-key') {
        isEncrypted = true;
        finalContent = JSON.stringify(await encryptText(text, aesKey));
      }

      if (editingMessage) {
        await api.put(`/api/conversation/messages/${editingMessage._id}`, { content: finalContent, isEncrypted });
        setMessages(prev => prev.map(m => m._id === editingMessage._id
          ? { ...m, content: finalContent, decryptedContent: text, edited: true } : m));
        setEditingMessage(null);
      } else {
        const res = await api.post('/api/conversation/messages/create', {
          conversationId, content: finalContent, senderName: currentUser?.fullname,
          recipientId, isEncrypted, replyTo: replyTo ? replyTo._id : undefined,
        });
        const newMsg = { ...res.data, decryptedContent: text };
        if (replyTo) newMsg.replyTo = replyTo;
        setMessages(prev => [newMsg, ...prev]);
        setReplyTo(null);
      }
    } catch (e) {
      console.warn('Send failed:', e);
    } finally {
      setSending(false);
    }
  };

  const handleDelete = (msg: any) => {
    const isOwn = String(msg.sender?._id || msg.senderId || msg.sender) === String(currentUser?._id);
    Alert.alert('Delete Message', 'Choose how to delete:', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete for Me', onPress: async () => {
          setMessages(prev => prev.filter(m => m._id !== msg._id));
          try { await api.delete(`/api/conversation/messages/${msg._id}?mode=me`); }
          catch { fetchMessages(false); }
        },
      },
      ...(isOwn ? [{
        text: 'Delete for Everyone', style: 'destructive' as const, onPress: async () => {
          setMessages(prev => prev.map(m => m._id === msg._id
            ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
          try { await api.delete(`/api/conversation/messages/${msg._id}?mode=everyone`); }
          catch { fetchMessages(false); }
        },
      }] : []),
    ]);
  };

  const handlePickMedia = async () => {
    if (uploadingMedia) return;
    try {
      const result = await launchImageLibrary({ mediaType: 'mixed', quality: 0.8 });
      if (result.didCancel || !result.assets?.length) return;
      const asset = result.assets[0];
      if (!asset.uri) return;
      setUploadingMedia(true);

      const type = asset.type?.startsWith('video') ? 'video' : 'image';
      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri, name: type === 'video' ? 'chat.mp4' : 'chat.jpg',
        type: type === 'video' ? 'video/mp4' : 'image/jpeg'
      } as any);
      formData.append('folder', 'messages');
      formData.append('resourceType', type);

      const uploadRes = await api.post('/api/media/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (uploadRes.data?.success && uploadRes.data?.url) {
        const uploadedUrl = uploadRes.data.url;
        const e2ee = useE2eeStore.getState();
        let finalContent = 'Sent an attachment';
        let finalMediaUrl = uploadedUrl;
        let isEncrypted = false;
        const aesKey = await e2ee.getConversationKey(conversationId, recipientId);
        if (aesKey && aesKey !== 'mock-conversation-aes-key') {
          isEncrypted = true;
          finalContent = JSON.stringify(await encryptText('Sent an attachment', aesKey));
          finalMediaUrl = JSON.stringify(await encryptText(uploadedUrl, aesKey));
        }
        const res = await api.post('/api/conversation/messages/create', {
          conversationId, content: finalContent, mediaUrl: finalMediaUrl,
          mediaType: type, senderName: currentUser?.fullname, recipientId, isEncrypted,
        });
        const newMsg = { ...res.data, decryptedContent: 'Sent an attachment', decryptedMediaUrl: uploadedUrl, mediaType: type };
        setMessages(prev => [newMsg, ...prev]);
      } else {
        Alert.alert('Error', 'Failed to upload attachment.');
      }
    } catch (e) {
      console.warn('Media upload error:', e);
      Alert.alert('Error', 'Failed to send attachment.');
    } finally {
      setUploadingMedia(false);
    }
  };

  const handleStoryPress = async (storyId: string) => {
    if (!storyId) return;
    try {
      const res = await api.get(`/api/story/${storyId}`);
      if (res.data?.isExpired) {
        Alert.alert('Story Expired', 'This story has expired and is no longer available.');
        return;
      }
      const story = res.data?.story;
      if (!story) {
        Alert.alert('Story Not Found', 'This story is no longer available.');
        return;
      }
      setSelectedStory(story);
      setStoryPlayerVisible(true);
    } catch (e: any) {
      if (e.response?.status === 404) {
        Alert.alert('Story Not Found', 'This story could not be found or has been deleted.');
      } else {
        Alert.alert('Error', 'Failed to load story details.');
      }
    }
  };

  const handlePostPress = async (postId: string) => {
    if (!postId) return;
    try {
      const res = await api.get(`/api/post/detail/${postId}`);
      if (res.data) {
        navigation.navigate('PostDetail', { postId });
      }
    } catch (e: any) {
      if (e.response?.status === 404) {
        Alert.alert('Post Not Found', 'This post could not be found or has been deleted.');
      } else if (e.response?.status === 403) {
        navigation.navigate('PostDetail', { postId });
      } else {
        Alert.alert('Error', 'Failed to load post details.');
      }
    }
  };

  const formatLastSeen = (iso: string | null) => {
    if (!iso) return '';
    const d = new Date(iso);
    const diff = Math.floor((Date.now() - d.getTime()) / 60000);
    if (diff < 1) return 'just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m =>
      (m.decryptedContent || m.content || '').toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const senderId = item.senderId || item.sender?._id || item.sender;
    const isMe = senderId && String(senderId) === String(currentUser?._id);

    // Date separator (FlatList is inverted so index 0 = newest)
    const nextItem = index < filteredMessages.length - 1 ? filteredMessages[index + 1] : null;
    const showSeparator = nextItem &&
      new Date(item.createdAt).toDateString() !== new Date(nextItem.createdAt).toDateString();
    const formatDate = (d: Date) => {
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (d.toDateString() === today.toDateString()) return 'Today';
      if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
      return d.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
      <>
        <SwipeableBubble
          item={item} isMe={isMe} isDark={isDark} textColor={textColor}
          subColor={subColor} borderColor={borderColor} currentUser={currentUser}
          onLongPress={(msg: any) => setSelectedMessage(msg)}
          onReply={(msg: any) => setReplyTo(msg)}
          onImagePress={(url: string) => setImageViewerUrl(url)}
          onStoryPress={handleStoryPress}
          onPostPress={handlePostPress}
        />
        {showSeparator && (
          <View style={styles.dateSeparator}>
            <View style={[styles.dateLine, { backgroundColor: borderColor }]} />
            <Text style={[styles.dateLabel, { color: subColor, backgroundColor: bg }]}>
              {formatDate(new Date(nextItem!.createdAt))}
            </Text>
            <View style={[styles.dateLine, { backgroundColor: borderColor }]} />
          </View>
        )}
      </>
    );
  }, [filteredMessages, isDark, textColor, subColor, borderColor, bg, currentUser, handleStoryPress, handlePostPress]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
          </TouchableOpacity>

          <View style={{ position: 'relative', marginRight: 10 }}>
            {recipientAvatar ? (
              <Image source={{ uri: recipientAvatar }} style={styles.headerAvatar} />
            ) : (
              <View style={styles.headerAvatarFallback}>
                <Text style={styles.headerAvatarInitial}>
                  {title?.[0]?.toUpperCase() || '?'}
                </Text>
              </View>
            )}
            {isOnline && <View style={styles.onlineDot} />}
          </View>

          <View style={styles.headerInfo}>
            <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{title}</Text>
            <Text style={[styles.headerSub, { color: isOnline ? '#10b981' : subColor }]}>
              {isOnline ? 'Active now' : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => Alert.alert('Voice Call', 'Coming soon!')}>
            <MaterialCommunityIcons name="phone-outline" size={20} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => Alert.alert('Video Call', 'Coming soon!')}>
            <MaterialCommunityIcons name="video-outline" size={22} color={textColor} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { setSearchVisible(v => !v); setSearchQuery(''); }}>
            <MaterialCommunityIcons name={searchVisible ? 'close' : 'magnify'} size={20}
              color={searchVisible ? '#808bf5' : textColor} />
          </TouchableOpacity>
        </View>
      </View>

      {/* SEARCH BAR */}
      {searchVisible && (
        <View style={[styles.searchBar, {
          backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderColor
        }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={subColor} />
          <TextInput style={[styles.searchInput, { color: textColor }]}
            placeholder={`Search in conversation...`}
            placeholderTextColor={subColor} value={searchQuery}
            onChangeText={setSearchQuery} autoFocus />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={16} color={subColor} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* MESSAGE LIST */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#808bf5" /></View>
      ) : (
        <FlatList
          data={filteredMessages}
          inverted
          keyExtractor={(item, index) => item._id ? String(item._id) : `msg-${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: 'center' }}>
              {searchQuery ? (
                <>
                  <MaterialCommunityIcons name="magnify" size={48} color={subColor} />
                  <Text style={{ color: subColor, marginTop: 8, textAlign: 'center' }}>
                    No messages match "{searchQuery}"
                  </Text>
                </>
              ) : (
                <>
                  <MaterialCommunityIcons name="chat-outline" size={56} color={subColor} />
                  <Text style={{ color: subColor, marginTop: 10, fontSize: 14, textAlign: 'center' }}>
                    No messages yet.{'\n'}Say hello! 👋
                  </Text>
                </>
              )}
            </View>
          )}
        />
      )}

      {/* INPUT AREA */}
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {(replyTo || editingMessage) && (
          <View style={[styles.replyBar, { backgroundColor: isDark ? '#1e293b' : '#f1f5f9', borderTopColor: borderColor }]}>
            <View style={[styles.replyBarInner, { borderLeftColor: '#808bf5' }]}>
              <Text style={[styles.replyBarTitle, { color: '#808bf5' }]}>
                {editingMessage ? 'Editing message'
                  : `Replying to ${replyTo?.senderName || replyTo?.sender?.fullname || 'User'}`}
              </Text>
              <Text style={[styles.replyBarContent, { color: subColor }]} numberOfLines={1}>
                {editingMessage ? editingMessage.decryptedContent
                  : (replyTo?.decryptedContent || replyTo?.content || '📎 Media')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => { setReplyTo(null); setEditingMessage(null); setInputText(''); }}
              style={{ padding: 4 }}>
              <MaterialCommunityIcons name="close" size={20} color={subColor} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.inputRow, { backgroundColor: cardBg, borderTopColor: borderColor }]}>
          <TouchableOpacity onPress={handlePickMedia} style={styles.attachBtn} disabled={uploadingMedia}>
            {uploadingMedia
              ? <ActivityIndicator size="small" color="#808bf5" />
              : <MaterialCommunityIcons name="paperclip" size={24} color={subColor} />}
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { color: textColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }]}
            placeholder="Type a message..." placeholderTextColor={subColor}
            value={inputText} onChangeText={setInputText} multiline maxLength={2000} />
          <TouchableOpacity onPress={handleSend}
            style={[styles.sendBtn, { backgroundColor: inputText.trim() ? '#808bf5' : (isDark ? '#334155' : '#e2e8f0') }]}
            disabled={!inputText.trim() || sending}>
            <MaterialCommunityIcons name={editingMessage ? 'check' : 'send'} size={20}
              color={inputText.trim() ? '#fff' : subColor} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* OPTIONS MODAL */}
      <Modal visible={!!selectedMessage} transparent animationType="slide"
        onRequestClose={() => setSelectedMessage(null)}>
        <TouchableWithoutFeedback onPress={() => setSelectedMessage(null)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={[styles.modalSheet, { backgroundColor: cardBg }]}>
                <View style={[styles.modalHandle, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]} />

                {selectedMessage && (
                  <Text style={[styles.modalPreview, { color: subColor, borderBottomColor: borderColor }]} numberOfLines={2}>
                    {selectedMessage.decryptedContent || selectedMessage.content || '📎 Media'}
                  </Text>
                )}

                {[
                  { icon: 'reply', label: 'Reply', color: textColor, onPress: () => { setReplyTo(selectedMessage); setSelectedMessage(null); } },
                  ...(selectedMessage?.decryptedContent || selectedMessage?.content ? [{
                    icon: 'share-variant', label: 'Share', color: textColor,
                    onPress: () => { Share.share({ message: selectedMessage.decryptedContent || selectedMessage.content }); setSelectedMessage(null); },
                  }] : []),
                  ...(String(selectedMessage?.sender?._id || selectedMessage?.senderId || selectedMessage?.sender) === String(currentUser?._id) ? [
                    {
                      icon: 'pencil', label: 'Edit', color: textColor, onPress: () => {
                        setEditingMessage(selectedMessage);
                        setInputText(selectedMessage.decryptedContent || selectedMessage.content || '');
                        setSelectedMessage(null);
                      }
                    },
                  ] : []),
                  {
                    icon: 'delete', label: 'Delete', color: '#ef4444', onPress: () => {
                      const msg = selectedMessage;
                      setSelectedMessage(null);
                      setTimeout(() => handleDelete(msg), 200);
                    }
                  },
                ].map((opt: any) => (
                  <TouchableOpacity key={opt.label} style={styles.modalOpt} onPress={opt.onPress}>
                    <MaterialCommunityIcons name={opt.icon} size={22} color={opt.color} />
                    <Text style={[styles.modalOptText, { color: opt.color }]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}

                <TouchableOpacity style={[styles.modalOpt, { borderTopWidth: 1, borderTopColor: borderColor, marginTop: 4 }]}
                  onPress={() => setSelectedMessage(null)}>
                  <MaterialCommunityIcons name="close" size={22} color={subColor} />
                  <Text style={[styles.modalOptText, { color: subColor }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* IMAGE VIEWER */}
      <Modal visible={!!imageViewerUrl} transparent animationType="fade"
        onRequestClose={() => setImageViewerUrl(null)}>
        <View style={styles.imgViewerBg}>
          <TouchableOpacity style={styles.imgViewerClose} onPress={() => setImageViewerUrl(null)}>
            <MaterialCommunityIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {imageViewerUrl && (
            <Image source={{ uri: imageViewerUrl }} style={styles.imgViewerImg} resizeMode="contain" />
          )}
        </View>
      </Modal>

      {/* STORY PLAYER */}
      <Modal visible={storyPlayerVisible} transparent animationType="slide"
        onRequestClose={() => { setStoryPlayerVisible(false); setSelectedStory(null); }}>
        <View style={styles.imgViewerBg}>
          <TouchableOpacity style={styles.imgViewerClose} onPress={() => { setStoryPlayerVisible(false); setSelectedStory(null); }}>
            <MaterialCommunityIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {selectedStory && (
            <View style={{ flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' }}>
              {/* Header */}
              <View style={{ position: 'absolute', top: 50, left: 16, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10 }}>
                {selectedStory.user?.profile_picture ? (
                  <Image source={{ uri: selectedStory.user.profile_picture }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                ) : (
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: 'bold' }}>
                      {(selectedStory.user?.fullname || 'U')[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View>
                  <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>
                    {selectedStory.user?.fullname || 'User'}
                  </Text>
                  <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
                    {selectedStory.createdAt ? new Date(selectedStory.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                </View>
              </View>

              {/* Story Content */}
              {selectedStory.media?.url ? (
                <Image source={{ uri: selectedStory.media.url }} style={{ width: '100%', height: '80%' }} resizeMode="contain" />
              ) : null}

              {/* Caption overlay */}
              {selectedStory.text?.content ? (
                <View style={{ position: 'absolute', bottom: 100, left: 20, right: 20, alignItems: 'center' }}>
                  <Text style={{ color: selectedStory.text.color || '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                    {selectedStory.text.content}
                  </Text>
                </View>
              ) : null}
            </View>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: {
    height: 62, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 6, borderBottomWidth: 1,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2
  },
  backBtn: { padding: 8 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  headerAvatarFallback: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#808bf5', justifyContent: 'center', alignItems: 'center'
  },
  headerAvatarInitial: { color: '#fff', fontSize: 15, fontWeight: 'bold' },
  onlineDot: {
    position: 'absolute', bottom: 0, right: 0, width: 11, height: 11,
    borderRadius: 6, backgroundColor: '#10b981', borderWidth: 2, borderColor: '#fff'
  },
  headerInfo: { flex: 1, justifyContent: 'center' },
  headerTitle: { fontSize: 15, fontWeight: 'bold' },
  headerSub: { fontSize: 11, marginTop: 1, fontWeight: '500' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: 2 },
  actionBtn: { padding: 7 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    height: 40, marginHorizontal: 12, marginVertical: 6, borderRadius: 20,
    borderWidth: 1, gap: 6
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },

  listContent: { paddingHorizontal: 12, paddingVertical: 10 },
  dateSeparator: { flexDirection: 'row', alignItems: 'center', marginVertical: 10, paddingHorizontal: 4 },
  dateLine: { flex: 1, height: 1 },
  dateLabel: { fontSize: 11, fontWeight: '600', paddingHorizontal: 8 },

  bubbleLeft: { flexDirection: 'row', justifyContent: 'flex-start', alignItems: 'flex-start', width: '100%' },
  bubbleRight: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'flex-end', width: '100%' },
  bubble: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18,
    maxWidth: SCREEN_WIDTH * 0.75,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04, shadowRadius: 1
  },

  replyQuote: {
    borderLeftWidth: 3, borderRadius: 6, paddingVertical: 4,
    paddingHorizontal: 8, marginBottom: 6
  },
  replyQuoteName: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  replyQuoteText: { fontSize: 11 },

  messageText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 9, alignSelf: 'flex-end' },
  mediaImage: { width: 200, height: 155, borderRadius: 10, marginBottom: 4 },
  videoPreview: {
    width: 200, height: 140, borderRadius: 10, backgroundColor: '#000',
    justifyContent: 'center', alignItems: 'center', marginBottom: 4
  },

  replyBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12,
    paddingVertical: 8, borderTopWidth: 1, gap: 8
  },
  replyBarInner: { flex: 1, borderLeftWidth: 3, paddingLeft: 8 },
  replyBarTitle: { fontSize: 11, fontWeight: '700', marginBottom: 1 },
  replyBarContent: { fontSize: 12 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10,
    paddingVertical: 8, borderTopWidth: 1, gap: 6
  },
  attachBtn: { padding: 6 },
  input: {
    flex: 1, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
    maxHeight: 110, fontSize: 14
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 34 },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 10, marginBottom: 8 },
  modalPreview: { fontSize: 12, paddingHorizontal: 20, paddingBottom: 10, borderBottomWidth: 1, marginBottom: 4 },
  modalOpt: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 24, gap: 14 },
  modalOptText: { fontSize: 16, fontWeight: '500' },

  imgViewerBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  imgViewerClose: { position: 'absolute', top: 50, right: 16, zIndex: 10, padding: 8 },
  imgViewerImg: { width: SCREEN_WIDTH, height: SCREEN_WIDTH * 1.2 },
});
