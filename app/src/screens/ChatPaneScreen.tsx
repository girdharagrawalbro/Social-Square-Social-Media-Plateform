import { brand } from '../theme/colors';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  TouchableWithoutFeedback,
  Share,
  Animated,
  Linking,
  Dimensions,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useIsFocused } from '@react-navigation/native';
import { useAppNavigation, useAppRoute } from '../navigation/types';
import { launchImageLibrary } from 'react-native-image-picker';
import DocumentPicker, { types } from 'react-native-document-picker';
import { api } from '../lib/api';
import { getCache, setCache, invalidateCache, TTL } from '../lib/cache';
import { getMessagesFromDB, upsertMessages, markMessagesRead, deleteMessageInDB } from '../lib/db';
import useAuthStore from '../store/zustand/useAuthStore';
import { usePresenceStore } from '../store/zustand/usePresenceStore';
import { getSocket } from '../lib/socket';
import ZoomableImage from './components/ZoomableImage';
import { ChatMessageSkeleton } from './components/SkeletonLoader';
import useE2eeStore from '../store/zustand/useE2eeStore';
import { decryptText, encryptText } from '../lib/cryptoUtils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../lib/queryKeys';
import { useSwipeGesture } from '../lib/useSwipeGesture';
import GroupSettingsModal from './components/GroupSettingsModal';
import { useTheme } from '../theme';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import Video from 'react-native-video';
const VideoComponent = Video as any;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const audioRecorderPlayer = new AudioRecorderPlayer();

const decryptionCache = new Map<string, string>();

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

// ─── VOICE NOTE PLAYBACK BAR ─────────────────────────────────────────────────
function VoiceNoteBar({ isPlaying, currentTime, duration, onPlayPause, onSeek, iconColor, trackColor, labelColor }: any) {
  const trackWidth = useRef(140);
  const progressPct = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const formatMs = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const m = Math.floor(totalSecs / 60);
    const s = totalSecs % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180 }}>
      <TouchableOpacity onPress={onPlayPause}>
        <MaterialCommunityIcons name={isPlaying ? 'pause-circle' : 'play-circle'} size={30} color={iconColor} />
      </TouchableOpacity>
      <TouchableOpacity
        style={{ flex: 1, height: 20, justifyContent: 'center' }}
        disabled={!isPlaying || duration <= 0}
        onLayout={(e) => { trackWidth.current = e.nativeEvent.layout.width; }}
        onPress={(e) => {
          if (!isPlaying || duration <= 0) return;
          const ratio = Math.max(0, Math.min(1, e.nativeEvent.locationX / trackWidth.current));
          onSeek(ratio * duration);
        }}
      >
        <View style={{ height: 3, borderRadius: 2, backgroundColor: trackColor, overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${progressPct * 100}%`, backgroundColor: iconColor }} />
        </View>
      </TouchableOpacity>
      <Text style={{ color: labelColor, fontSize: 11, minWidth: 32 }}>
        {isPlaying && duration > 0 ? formatMs(currentTime) : 'Voice'}
      </Text>
    </View>
  );
}

// ─── DOUBLE TICK ─────────────────────────────────────────────────────────────
const DoubleCheck = ({ isRead, isMe }: { isRead: boolean; isMe: boolean }) => {
  if (!isMe) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <MaterialCommunityIcons
        name="check"
        size={12}
        color={isRead ? '#3897f0' : 'rgba(255,255,255,0.65)'}
        style={{}}
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
  onVideoPress,
  onStoryPress,
  onPostPress,
  onReplyQuotePress,
  onRetry,
  isPlayingAudio,
  audioProgress,
  onPlayAudio,
  onSeekAudio,
  isHighlighted,
  isJumpHighlighted,
  searchQuery,
  isNew,
}: any) {
  const replyOpacity = useRef(new Animated.Value(0)).current;

  // Telegram-style entrance for freshly sent/received bubbles only — history that's
  // just scrolling into view starts fully settled (value 1) so it never animates.
  const entryAnim = useRef(new Animated.Value(isNew ? 0 : 1)).current;
  useEffect(() => {
    if (isNew) {
      Animated.spring(entryAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 65,
      }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entryTranslateY = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const entryTranslateX = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [isMe ? 36 : -36, 0] });
  const entryScale = entryAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  // Keep latest callbacks in refs so PanResponder (created once) always calls the fresh version
  const onReplyRef = useRef(onReply);
  const itemRef = useRef(item);
  useEffect(() => {
    onReplyRef.current = onReply;
    itemRef.current = item;
  });

  // Reply icon fades in as the bubble drags right, and both reset together whether
  // the swipe committed (crossed the threshold, reply fired) or not — matches
  // `dragX`/`replyOpacity` moving in lockstep during the drag itself below.
  const resetSwipeVisual = () => {
    springBack();
    Animated.timing(replyOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start();
  };

  const { panResponder, dragX: translateX, springBack } = useSwipeGesture({
    shouldActivate: (g) => Math.abs(g.dx) > 8 && Math.abs(g.dy) < 12,
    commitThreshold: 55,
    springConfig: { tension: 200, friction: 22 },
    transformDx: (dx) => {
      const clamped = Math.max(0, Math.min(80, dx));
      replyOpacity.setValue(clamped / 80);
      return clamped;
    },
    onCommitPositive: () => {
      onReplyRef.current && onReplyRef.current(itemRef.current);
      resetSwipeVisual();
    },
    onCancel: resetSwipeVisual,
  });

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

  const renderHighlightedText = (text: string, query?: string) => {
    if (!query || !query.trim()) return text;
    // Escape special characters in query to prevent regex errors
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedQuery})`, 'gi');
    const parts = text.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <Text key={i} style={{ backgroundColor: isHighlighted ? '#facc15' : 'rgba(250, 204, 21, 0.4)', color: '#000' }}>{part}</Text>
      ) : (
        <Text key={i}>{part}</Text>
      )
    );
  };

  return (
    <Animated.View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 2,
        opacity: entryAnim,
        transform: [
          { translateY: entryTranslateY },
          { translateX: entryTranslateX },
          { scale: entryScale },
        ],
      }}>
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
        <MaterialCommunityIcons name="reply" size={15} color={brand.primary} />
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
            {/* Reply Quote — tap to jump to the original message */}
            {item.replyTo && !isDeleted && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onReplyQuotePress && onReplyQuotePress(item.replyTo._id)}
                style={[styles.replyQuote, {
                  borderLeftColor: isMe ? 'rgba(255,255,255,0.6)' : brand.primary,
                  backgroundColor: isMe ? 'rgba(0,0,0,0.12)' : (isDark ? '#334155' : '#e8eaf6'),
                }]}>
                <Text style={[styles.replyQuoteName, {
                  color: isMe ? 'rgba(255,255,255,0.9)' : brand.primary,
                }]}>
                  {item.replyTo.senderName || item.replyTo.sender?.fullname || 'User'}
                </Text>
                <Text style={[styles.replyQuoteText, {
                  color: isMe ? 'rgba(255,255,255,0.7)' : subColor,
                }]} numberOfLines={1}>
                  {item.replyTo.decryptedContent || item.replyTo.content || '📎 Media'}
                </Text>
              </TouchableOpacity>
            )}

            <View style={[styles.bubble, {
              backgroundColor: isJumpHighlighted
                ? 'rgba(250, 204, 21, 0.35)'
                : (isSharedPost || isSharedProfile) ? 'transparent' : isMe ? brand.primary : incomingBg,
              borderTopRightRadius: isMe ? 4 : 18,
              borderTopLeftRadius: isMe ? 18 : 4,
              padding: (item.storyReply || item.media?.url || item.mediaUrl || item.decryptedMediaUrl) ? 5 : undefined,
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
                          width: 40, height: 40, borderRadius: 8, backgroundColor: brand.primary,
                          justifyContent: 'center', alignItems: 'center'
                        }}>
                          <Text style={{ fontSize: 18 }}>✨</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 12, fontWeight: 'bold', color: isMe ? brand.primaryInverse : textColor }}>
                          {item.storyReply.isShare
                            ? (item.storyReply.authorName ? `Shared ${item.storyReply.authorName}'s story` : 'Shared a story')
                            : 'Replied to story'}
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
                        backgroundColor: isMe ? brand.primary : (isDark ? '#1e293b' : '#f1f5f9'),
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
                            backgroundColor: brand.primary, justifyContent: 'center', alignItems: 'center'
                          }}>
                            <Text style={{ color: '#fff', fontSize: 11, fontWeight: 'bold' }}>
                              {(item.sharedPost.authorName || 'U')[0].toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: isMe ? brand.primaryInverse : textColor }}
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
                      <MaterialCommunityIcons name="image-multiple" size={18} color={isMe ? brand.primaryInverse : brand.primary} />
                      <Text style={{ fontSize: 13, color: isMe ? brand.primaryInverse : textColor }}>Shared a Post</Text>
                    </TouchableOpacity>
                  )}

                  {/* Shared Profile */}
                  {isSharedProfile && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <MaterialCommunityIcons name="account-circle" size={18} color={isMe ? brand.primaryInverse : brand.primary} />
                      <Text style={{ fontSize: 13, color: isMe ? brand.primaryInverse : textColor }}>Shared a Profile</Text>
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
                    <TouchableOpacity
                      style={styles.videoPreview}
                      onPress={() => onVideoPress && onVideoPress(item.decryptedMediaUrl || item.mediaUrl)}
                    >
                      <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
                      <Text style={{ color: '#fff', fontSize: 11, marginTop: 4 }}>Video</Text>
                    </TouchableOpacity>
                  )}

                  {/* media.url format (web-compatible) */}
                  {item.media?.url && item.media?.type === 'image' && !item.storyReply && (
                    <TouchableOpacity onPress={() => onImagePress && onImagePress(item.media.url)}>
                      <Image source={{ uri: item.media.url }} style={styles.mediaImage} resizeMode="cover" />
                    </TouchableOpacity>
                  )}
                  {item.media?.url && item.media?.type === 'video' && !item.storyReply && (
                    <TouchableOpacity style={styles.videoPreview} onPress={() => onVideoPress && onVideoPress(item.media.url)}>
                      <MaterialCommunityIcons name="play-circle" size={44} color="#fff" />
                    </TouchableOpacity>
                  )}
                  {((item.decryptedMediaUrl || item.mediaUrl) && item.mediaType === 'audio' && !item.storyReply) ||
                  (item.media?.url && item.media?.type === 'audio' && !item.storyReply) ? (
                    <VoiceNoteBar
                      isPlaying={!!isPlayingAudio}
                      currentTime={audioProgress?.currentTime || 0}
                      duration={audioProgress?.duration || 0}
                      onPlayPause={() => onPlayAudio && onPlayAudio(item)}
                      onSeek={(ms: number) => onSeekAudio && onSeekAudio(ms)}
                      iconColor={isMe ? brand.primaryInverse : brand.primary}
                      trackColor={isMe ? 'rgba(255,255,255,0.35)' : 'rgba(128,139,245,0.25)'}
                      labelColor={isMe ? 'rgba(255,255,255,0.85)' : subColor}
                    />
                  ) : null}
                  {item.media?.url && item.media?.type === 'file' && !item.storyReply && (
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
                      onPress={() => Linking.openURL(item.media.url)}>
                      <MaterialCommunityIcons name="file-outline" size={20} color={isMe ? brand.primaryInverse : brand.primary} />
                      <Text style={{ color: isMe ? brand.primaryInverse : textColor, fontSize: 13 }}>
                        {item.media.name || 'File'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  {/* Text */}
                  {!isPlaceholder && content ? (
                    <Text style={[styles.messageText, { color: isMe ? brand.primaryInverse : '#0f172a', marginTop: hasCard ? 6 : 0 }]}>
                      {renderHighlightedText(content, searchQuery)}
                    </Text>
                  ) : null}

                  {/* Edited */}
                  {item.edited && (
                    <Text style={{ fontSize: 9, color: isMe ? 'rgba(255,255,255,0.5)' : '#94a3b8' }}>· edited</Text>
                  )}
                </>
              )}

              {/* Time + ticks / send status */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3, gap: 4 }}>
                {item.status === 'failed' && isMe ? (
                  <TouchableOpacity
                    onPress={() => onRetry && onRetry(item)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                  >
                    <MaterialCommunityIcons name="alert-circle" size={12} color="#fecaca" />
                    <Text style={{ fontSize: 10, color: '#fecaca', fontWeight: '600' }}>Tap to retry</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={[styles.timeText, { color: isMe ? 'rgba(255,255,255,0.65)' : '#64748b' }]}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </Text>
                )}
                {item.status === 'pending' ? (
                  <MaterialCommunityIcons name="clock-outline" size={11} color={isMe ? 'rgba(255,255,255,0.65)' : '#64748b'} />
                ) : (
                  <DoubleCheck isRead={!!item.isRead} isMe={isMe} />
                )}
              </View>
            </View>

            {/* Reactions */}
            {item.reactions && Object.keys(item.reactions).length > 0 && (
              <View style={{
                flexDirection: 'row',
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                marginTop: -10,
                marginRight: isMe ? 10 : 0,
                marginLeft: isMe ? 0 : 10,
                backgroundColor: isDark ? '#1e293b' : '#ffffff',
                borderRadius: 12,
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: isDark ? '#334155' : '#e2e8f0',
                gap: 4,
                zIndex: 2,
              }}>
                {Object.entries(
                  Object.entries(item.reactions).reduce((acc: any, [uid, emoji]: any) => {
                    if (!acc[emoji]) acc[emoji] = 0;
                    acc[emoji]++;
                    return acc;
                  }, {})
                ).map(([emoji, count]: any) => (
                  <Text key={emoji} style={{ fontSize: 12 }}>
                    {emoji} {count > 1 ? <Text style={{ fontSize: 10, color: subColor }}>{count}</Text> : ''}
                  </Text>
                ))}
              </View>
            )}

          </View>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
}

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────
export default function ChatPaneScreen() {
  const { colors, isDark } = useTheme();
  const navigation = useAppNavigation();
  const route = useAppRoute<'ChatPane'>();
  const isFocused = useIsFocused();
  const currentUser = useAuthStore((s) => s.user);

  // Every other screen in the app guards `route.params` with `|| {}` (see CallScreen,
  // PostDetailScreen, WikiDetailScreen, etc.) — this one didn't, and it's also the one
  // screen the app's own deep-link config (`chat/:conversationId` in App.tsx) can open
  // with only `conversationId` set, which would otherwise throw on the very next line.
  const { title, recipientId, recipientAvatar, isGroup } = route.params || {};
  // Typing this screen's route against RootStackParamList surfaced that conversationId
  // is only ever optional (deep link / brand-new-DM-by-recipientId cases) — every
  // downstream use is a SQLite WHERE clause, a Keychain lookup, or a field sent
  // alongside recipientId, all of which already treated a missing id as a safe no-op,
  // so this preserves that exact behavior under the stricter type.
  const conversationId = route.params?.conversationId || '';

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [olderOffset, setOlderOffset] = useState(0);
  const [hasOlderMessages, setHasOlderMessages] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<any[]>([]);

  const [selectedMessage, setSelectedMessage] = useState<any>(null);
  const [replyTo, setReplyTo] = useState<any>(null);
  const [e2eeModalVisible, setE2eeModalVisible] = useState(false);
  const [e2eePassword, setE2eePassword] = useState('');
  const [editingMessage, setEditingMessage] = useState<any>(null);

  // Live presence — kept in a shared store fed by the socket's userOnline/userOffline
  // broadcasts (src/lib/socket.ts), so it updates in real time instead of only on poll.
  const presenceEntry = usePresenceStore((s) => (recipientId ? s.byUserId[recipientId] : undefined));
  const isOnline = presenceEntry?.isOnline ?? false;
  const lastSeen = presenceEntry?.lastSeen ?? null;

  const [searchVisible, setSearchVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchingServer, setSearchingServer] = useState(false);
  const [searchIndex, setSearchIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  // Message IDs that should play a Telegram-style slide/pop-in entrance the next time
  // they're rendered — populated for locally-sent messages and for genuinely new
  // arrivals after the first network sync, never for history that's just loading in.
  const newMessageIdsRef = useRef<Set<string>>(new Set());
  const hasSyncedOnceRef = useRef(false);

  const [groupSettingsModalVisible, setGroupSettingsModalVisible] = useState(false);

  // Voice note recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const queryClient = useQueryClient();

  const matchingIndices = useMemo(() => {
    if (!searchQuery.trim() || !searchVisible) return [];
    const q = searchQuery.toLowerCase();
    const indices: number[] = [];
    messages.forEach((m, idx) => {
      if ((m.decryptedContent || m.content || '').toLowerCase().includes(q)) {
        indices.push(idx);
      }
    });
    return indices;
  }, [messages, searchQuery, searchVisible]);

  useEffect(() => {
    setSearchIndex(0);
    if (!searchQuery.trim() || !searchVisible) return;
    if (matchingIndices.length > 0) return;

    const timer = setTimeout(async () => {
      setSearchingServer(true);
      try {
        const res = await api.get(`/api/conversation/messages/search`, {
          params: { q: searchQuery, conversationId, limit: 20 }
        });
        if (res.data?.messages?.length > 0) {
          const e2ee = useE2eeStore.getState();
          const aesKey = await e2ee.getConversationKey(conversationId);

          const processed = await Promise.all(res.data.messages.map(async (m: any) => {
            if (m.isEncrypted && aesKey) {
              try {
                m.decryptedContent = await decryptText(JSON.parse(m.content), aesKey);
              } catch (e) { }
            }
            return m;
          }));

          setMessages(prev => {
            const existingIds = new Set(prev.map(m => String(m._id)));
            const newMsgs = processed.filter((m: any) => !existingIds.has(String(m._id)));
            return [...prev, ...newMsgs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          });
        }
      } catch (e) {
        console.warn('Server search failed:', e);
      } finally {
        setSearchingServer(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, searchVisible, conversationId]);

  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);
  const [videoViewerUrl, setVideoViewerUrl] = useState<string | null>(null);
  const [selectedStory, setSelectedStory] = useState<any>(null);
  const [storyPlayerVisible, setStoryPlayerVisible] = useState(false);

  // Voice-note playback — only one message plays at a time via the shared player instance.
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState({ currentTime: 0, duration: 0 });

  // Jump-to-original-message (tapping a reply quote) — briefly highlights the target.
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);

  // Typing indicator, driven by the other participant's socket events.
  const [otherUserTyping, setOtherUserTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopTypingEmitRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const bg = colors.background;
  const cardBg = colors.surface;
  const textColor = colors.text.primary;
  const subColor = colors.text.secondary;
  const borderColor = colors.border;

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

    if (decryptionCache.has(unescaped)) {
      return decryptionCache.get(unescaped)!;
    }

    try {
      const obj = JSON.parse(unescaped);
      const text = await decryptText(obj.ciphertext, obj.iv, aesKey);
      decryptionCache.set(unescaped, text);
      return text;
    } catch {
      return 'Encrypted';
    }
  };

  const processMessages = useCallback(async (raw: any[]) => {
    const aesKey = await useE2eeStore.getState().getConversationKey(conversationId);
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

  // Initial SQLite Load
  useEffect(() => {
    const dbMessages = getMessagesFromDB(conversationId, 50, 0);
    if (dbMessages.length > 0) {
      processMessages(dbMessages).then(processed => {
        setMessages(processed);
        setOlderOffset(dbMessages.length);
        setHasOlderMessages(dbMessages.length >= 50);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [conversationId, processMessages]);

  // Network Sync with React Query
  const { data: networkMessages } = useQuery({
    queryKey: queryKeys.messages(conversationId),
    queryFn: async () => {
      const payload: any = { limit: 50 };
      if (recipientId) payload.recipientId = recipientId;
      if (conversationId) payload.conversationId = conversationId;
      const res = await api.post('/api/conversation/messages', payload);
      return res.data?.messages || (Array.isArray(res.data) ? res.data : []);
    },
    // The socket 'receiveMessage' listener below triggers an immediate refetch when a
    // message actually arrives, so this interval is just a slow fallback — it used to
    // be 4s and was hammering the API on every open chat even though nothing changed.
    refetchInterval: 20000,
  });

  // Real-time message delivery — refetch as soon as the socket says something changed
  // for this conversation, instead of waiting up to 4s (formerly the only mechanism).
  useEffect(() => {
    const socket = getSocket();
    const handleReceiveMessage = (msg: any) => {
      if (msg?.conversationId && String(msg.conversationId) !== String(conversationId)) return;
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
    };
    socket.on('receiveMessage', handleReceiveMessage);
    return () => {
      socket.off('receiveMessage', handleReceiveMessage);
    };
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (networkMessages && networkMessages.length > 0) {
      // Persist raw to SQLite
      upsertMessages(networkMessages.map((m: any) => ({ ...m, conversationId })));
      markMessagesRead(conversationId);

      // Decrypt and merge for in-RAM display without destroying older messages
      processMessages(networkMessages).then(processed => {
        // Only animate arrivals from the SECOND sync onward — the first sync is just
        // catching the screen up to history and shouldn't play an entrance for every row.
        const shouldFlagAsNew = hasSyncedOnceRef.current;
        hasSyncedOnceRef.current = true;

        setMessages(prev => {
          const prevMap = new Map(prev.map(m => [m._id, m]));
          // Merge updates for existing messages and append new ones
          const merged = [...prev];
          processed.forEach(newMsg => {
            if (prevMap.has(newMsg._id)) {
              // Update existing
              const index = merged.findIndex(m => m._id === newMsg._id);
              merged[index] = newMsg;
            } else {
              // Add new
              merged.push(newMsg);
              if (shouldFlagAsNew) newMessageIdsRef.current.add(String(newMsg._id));
            }
          });
          // Always re-sort by time (inverted list = index 0 is newest) — insertion
          // order alone isn't reliable once optimistic sends and batched network
          // merges are both touching this array, and a wrong order here is what
          // was pushing newly-sent messages to the top of the screen instead of
          // the bottom.
          merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return merged;
        });
      }).catch(e => console.warn('Process error:', e));
    }
  }, [networkMessages, conversationId, processMessages]);

  /** Load older messages from SQLite (scroll to top — no network needed) */
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasOlderMessages) return;
    setLoadingOlder(true);
    try {
      const older = getMessagesFromDB(conversationId, 30, olderOffset);
      if (older.length === 0) {
        setHasOlderMessages(false);
        return;
      }
      const processed = await processMessages(older);
      setMessages(prev => [...prev, ...processed]);
      setOlderOffset(prev => prev + older.length);
      setHasOlderMessages(older.length >= 30);
    } catch (e) {
      console.warn('[ChatPane] loadOlderMessages error:', e);
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, olderOffset, hasOlderMessages, loadingOlder, processMessages]);

  const { refetch: refetchOnlineStatus } = useQuery({
    queryKey: queryKeys.onlineStatus(recipientId),
    queryFn: async () => {
      const res = await api.get(`/api/auth/online-status/${recipientId}`);
      if (recipientId) {
        usePresenceStore.getState().seed(recipientId, {
          isOnline: !!res.data?.isOnline,
          lastSeen: res.data?.lastSeen || null,
        });
      }
      return res.data;
    },
    // No refetchInterval — the socket's userOnline/userOffline broadcasts (wired in
    // src/lib/socket.ts) keep this live from here on. This REST call only seeds the
    // initial value before the first socket event for this user arrives.
    enabled: !!recipientId,
  });

  useEffect(() => {
    if (!isFocused) return;
    refetchOnlineStatus();
  }, [isFocused, refetchOnlineStatus]);

  // Typing indicator — backend already relays 'typing'/'stopTyping' as 'userTyping'/
  // 'userStoppedTyping' to the other participant(s) (see server/index.js); this just
  // needed a consumer + emitter, neither of which existed anywhere in the app before.
  useEffect(() => {
    const socket = getSocket();
    const clearTypingTimeout = () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
    };
    const handleUserTyping = (data: any) => {
      if (data?.conversationId && data.conversationId !== conversationId) return;
      setOtherUserTyping(true);
      clearTypingTimeout();
      typingTimeoutRef.current = setTimeout(() => setOtherUserTyping(false), 4000);
    };
    const handleUserStoppedTyping = (data: any) => {
      if (data?.conversationId && data.conversationId !== conversationId) return;
      setOtherUserTyping(false);
      clearTypingTimeout();
    };
    socket.on('userTyping', handleUserTyping);
    socket.on('userStoppedTyping', handleUserStoppedTyping);
    return () => {
      socket.off('userTyping', handleUserTyping);
      socket.off('userStoppedTyping', handleUserStoppedTyping);
      clearTypingTimeout();
    };
  }, [conversationId]);

  const handleInputChange = (text: string) => {
    setInputText(text);
    const socket = getSocket();
    socket.emit('typing', { conversationId, recipientId, senderName: currentUser?.fullname });
    if (stopTypingEmitRef.current) clearTimeout(stopTypingEmitRef.current);
    stopTypingEmitRef.current = setTimeout(() => {
      socket.emit('stopTyping', { conversationId, recipientId });
    }, 2000);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && pendingMedia.length === 0) || sending) return;
    const text = inputText.trim();
    const outgoingReplyTo = replyTo;
    const isEditing = !!editingMessage;
    setInputText('');
    setSending(true);
    if (stopTypingEmitRef.current) clearTimeout(stopTypingEmitRef.current);
    getSocket().emit('stopTyping', { conversationId, recipientId });

    // Optimistic placeholder for a plain text send — shows immediately instead of
    // waiting for the round-trip, and if the request fails it stays in the thread
    // marked as failed (tap to retry) instead of silently disappearing with the
    // typed text gone for good.
    let tempId: string | null = null;
    if (text && !isEditing) {
      tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      newMessageIdsRef.current.add(tempId);
      setMessages(prev => [{
        _id: tempId,
        content: text,
        decryptedContent: text,
        sender: { _id: currentUser?._id, fullname: currentUser?.fullname },
        createdAt: new Date().toISOString(),
        isRead: false,
        status: 'pending',
        replyTo: outgoingReplyTo || undefined,
      }, ...prev]);
      setReplyTo(null);
    }

    try {
      const aesKey = await useE2eeStore.getState().getConversationKey(conversationId);

      // If we have text and no media, or text with media, handle text normally
      // But actually, in web, text and media are sent together if it's 1 media, or text goes first.
      // Let's send the text message first if there is text.
      if (text) {
        let finalContent = text;
        let isEncrypted = false;
        if (aesKey) {
          isEncrypted = true;
          finalContent = JSON.stringify(await encryptText(text, aesKey));
        }

        if (isEditing) {
          await api.patch(`/api/conversation/messages/${editingMessage._id}`, { content: finalContent, isEncrypted });
          setMessages(prev => prev.map(m => m._id === editingMessage._id
            ? { ...m, content: finalContent, decryptedContent: text, edited: true } : m));
          setEditingMessage(null);
        } else {
          const res = await api.post('/api/conversation/messages/create', {
            conversationId, content: finalContent, senderName: currentUser?.fullname,
            recipientId, isEncrypted, replyTo: outgoingReplyTo ? outgoingReplyTo._id : undefined,
          });
          const newMsg = { ...res.data, decryptedContent: text, status: 'sent' };
          if (outgoingReplyTo) newMsg.replyTo = outgoingReplyTo;
          setMessages(prev => prev.map(m => m._id === tempId ? newMsg : m));
          if (res.data && res.data._id) {
            upsertMessages([{ ...res.data, conversationId: conversationId || res.data.conversationId }]);
          }
        }
      }

      // Now handle pendingMedia one by one
      if (pendingMedia.length > 0) {
        setUploadingMedia(true);
        for (const media of pendingMedia) {
          const formData = new FormData();
          formData.append('file', {
            uri: media.uri, name: media.name || 'attachment',
            type: media.mimeType || 'application/octet-stream'
          } as any);
          formData.append('folder', 'messages');
          formData.append('resourceType', media.resourceType); // 'image', 'video', 'raw'

          const uploadRes = await api.post('/api/media/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            timeout: 0,
          });

          if (uploadRes.data?.success && uploadRes.data?.url) {
            const uploadedUrl = uploadRes.data.url;
            let finalContent = 'Sent an attachment';
            let finalMediaUrl = uploadedUrl;
            let isEncrypted = false;

            if (aesKey) {
              isEncrypted = true;
              finalContent = JSON.stringify(await encryptText('Sent an attachment', aesKey));
              finalMediaUrl = JSON.stringify(await encryptText(uploadedUrl, aesKey));
            }

            const res = await api.post('/api/conversation/messages/create', {
              conversationId, content: finalContent, mediaUrl: finalMediaUrl,
              mediaType: media.type, senderName: currentUser?.fullname, recipientId, isEncrypted,
              mediaName: media.type === 'file' ? media.name : undefined,
              mediaSize: media.type === 'file' ? media.size : undefined,
            });

            const newMsg = { ...res.data, decryptedContent: 'Sent an attachment', decryptedMediaUrl: uploadedUrl, mediaType: media.type };
            if (media.type === 'file') {
              newMsg.media = { url: uploadedUrl, type: 'file', name: media.name, size: media.size };
            }
            if (newMsg._id) newMessageIdsRef.current.add(String(newMsg._id));
            setMessages(prev => [newMsg, ...prev]);
            if (res.data && res.data._id) {
              upsertMessages([{ ...res.data, conversationId: conversationId || res.data.conversationId }]);
            }
          }
        }
        setPendingMedia([]);
        setUploadingMedia(false);
      }
    } catch (e) {
      console.warn('Send failed:', e);
      if (tempId) {
        setMessages(prev => prev.map(m => m._id === tempId ? { ...m, status: 'failed' } : m));
      } else {
        Alert.alert('Error', 'Failed to send message or attachments.');
      }
    } finally {
      setSending(false);
      setUploadingMedia(false);
    }
  };

  // Voice-note playback — tap toggles play/pause; only one message plays at a time.
  const handlePlayAudio = async (item: any) => {
    const url = item.decryptedMediaUrl || item.media?.url || item.mediaUrl;
    if (!url) return;

    if (playingAudioId === item._id) {
      await audioRecorderPlayer.pausePlayer();
      setPlayingAudioId(null);
      return;
    }

    if (playingAudioId) {
      await audioRecorderPlayer.stopPlayer();
      audioRecorderPlayer.removePlayBackListener();
    }

    try {
      setPlayingAudioId(item._id);
      setAudioProgress({ currentTime: 0, duration: 0 });
      await audioRecorderPlayer.startPlayer(url);
      audioRecorderPlayer.addPlayBackListener((e) => {
        setAudioProgress({ currentTime: e.currentPosition, duration: e.duration });
        if (e.isFinished) {
          audioRecorderPlayer.stopPlayer().catch(() => {});
          audioRecorderPlayer.removePlayBackListener();
          setPlayingAudioId(null);
          setAudioProgress({ currentTime: 0, duration: 0 });
        }
      });
    } catch (e) {
      console.warn('[ChatPane] voice note playback failed:', e);
      setPlayingAudioId(null);
    }
  };

  const handleSeekAudio = async (ms: number) => {
    try {
      await audioRecorderPlayer.seekToPlayer(ms);
    } catch (e) {
      console.warn('[ChatPane] voice note seek failed:', e);
    }
  };

  useEffect(() => {
    return () => {
      if (playingAudioId) {
        audioRecorderPlayer.stopPlayer().catch(() => {});
        audioRecorderPlayer.removePlayBackListener();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Jump to a replied-to message and briefly highlight it — no-op if it isn't
  // currently loaded (older messages not yet paginated in).
  const handleJumpToMessage = (replyToId?: string) => {
    if (!replyToId) return;
    const index = messages.findIndex((m) => String(m._id) === String(replyToId));
    if (index === -1) return;
    flatListRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    setHighlightedMessageId(replyToId);
    setTimeout(() => setHighlightedMessageId((cur) => (cur === replyToId ? null : cur)), 1500);
  };

  // Retry a failed optimistic send without re-typing the message.
  const handleRetrySend = async (failedMsg: any) => {
    setMessages((prev) => prev.map((m) => (m._id === failedMsg._id ? { ...m, status: 'pending' } : m)));
    try {
      const aesKey = await useE2eeStore.getState().getConversationKey(conversationId);
      const plainText = failedMsg.decryptedContent || failedMsg.content;
      let finalContent = plainText;
      let isEncrypted = false;
      if (aesKey) {
        isEncrypted = true;
        finalContent = JSON.stringify(await encryptText(plainText, aesKey));
      }
      const res = await api.post('/api/conversation/messages/create', {
        conversationId, content: finalContent, senderName: currentUser?.fullname,
        recipientId, isEncrypted, replyTo: failedMsg.replyTo ? failedMsg.replyTo._id : undefined,
      });
      const newMsg = { ...res.data, decryptedContent: plainText, status: 'sent' };
      if (failedMsg.replyTo) newMsg.replyTo = failedMsg.replyTo;
      setMessages((prev) => prev.map((m) => (m._id === failedMsg._id ? newMsg : m)));
      if (res.data && res.data._id) {
        upsertMessages([{ ...res.data, conversationId: conversationId || res.data.conversationId }]);
      }
    } catch (e) {
      console.warn('[ChatPane] retry send failed:', e);
      setMessages((prev) => prev.map((m) => (m._id === failedMsg._id ? { ...m, status: 'failed' } : m)));
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
          catch { queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) }); }
        },
      },
      ...(isOwn ? [{
        text: 'Delete for Everyone', style: 'destructive' as const, onPress: async () => {
          setMessages(prev => prev.map(m => m._id === msg._id
            ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m));
          try { await api.delete(`/api/conversation/messages/${msg._id}?mode=everyone`); }
          catch { queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) }); }
        },
      }] : []),
    ]);
  };

  const handleReact = async (messageId: string, emoji: string) => {
    try {
      setSelectedMessage(null);
      // Optimistic update
      setMessages(prev => prev.map(m => {
        if (m._id !== messageId) return m;
        const currentReactions = m.reactions ? { ...m.reactions } : {};
        if (currentReactions[currentUser._id] === emoji) {
          delete currentReactions[currentUser._id];
        } else {
          currentReactions[currentUser._id] = emoji;
        }
        return { ...m, reactions: currentReactions };
      }));
      // Server call
      await api.post(`/api/conversation/messages/${messageId}/react`, { emoji });
    } catch (e) {
      console.warn('React failed:', e);
      // Revert would go here in a robust implementation, or just rely on refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
    }
  };

  const promptAttachment = () => {
    Alert.alert('Send Attachment', 'Choose attachment type:', [
      { text: 'Photo / Video', onPress: handlePickMedia },
      { text: 'Document', onPress: handlePickFile },
      { text: 'Cancel', style: 'cancel' }
    ]);
  };

  const handlePickMedia = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'mixed', selectionLimit: 10, quality: 0.8 });
      if (result.didCancel || !result.assets?.length) return;

      const newMedia = result.assets.map(asset => ({
        uri: asset.uri,
        name: asset.type?.startsWith('video') ? 'chat.mp4' : 'chat.jpg',
        mimeType: asset.type?.startsWith('video') ? 'video/mp4' : 'image/jpeg',
        type: asset.type?.startsWith('video') ? 'video' : 'image',
        resourceType: asset.type?.startsWith('video') ? 'video' : 'image',
      }));

      setPendingMedia(prev => [...prev, ...newMedia]);
    } catch (e) {
      console.warn('Media pick error:', e);
    }
  };

  const handlePickFile = async () => {
    try {
      const results = await DocumentPicker.pick({
        allowMultiSelection: true,
        type: [types.allFiles],
      });
      if (!results || results.length === 0) return;

      const newDocs = results.map(doc => ({
        uri: doc.uri,
        name: doc.name || 'document',
        mimeType: doc.type || 'application/octet-stream',
        type: 'file',
        resourceType: 'raw',
        size: doc.size,
      }));

      setPendingMedia(prev => [...prev, ...newDocs]);
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.warn('File pick error:', err);
      }
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

  const renderItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const senderId = item.senderId || item.sender?._id || item.sender;
    const isMe = senderId && String(senderId) === String(currentUser?._id);

    // Consume the "play an entrance" flag on first read so scrolling this same cell
    // out of the virtualization window and back in later never replays the animation.
    const msgId = item._id ? String(item._id) : '';
    const isNew = msgId ? newMessageIdsRef.current.has(msgId) : false;
    if (isNew) newMessageIdsRef.current.delete(msgId);

    // Date separator (FlatList is inverted so index 0 = newest)
    const nextItem = index < messages.length - 1 ? messages[index + 1] : null;
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
          onVideoPress={(url: string) => setVideoViewerUrl(url)}
          onStoryPress={handleStoryPress}
          onPostPress={handlePostPress}
          onReplyQuotePress={handleJumpToMessage}
          onRetry={handleRetrySend}
          isPlayingAudio={playingAudioId === item._id}
          audioProgress={playingAudioId === item._id ? audioProgress : undefined}
          onPlayAudio={handlePlayAudio}
          onSeekAudio={handleSeekAudio}
          isHighlighted={matchingIndices.includes(index) && matchingIndices[searchIndex] === index}
          isJumpHighlighted={highlightedMessageId === item._id}
          searchQuery={searchQuery}
          isNew={isNew}
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
  }, [messages, matchingIndices, searchIndex, isDark, textColor, subColor, borderColor, bg, currentUser, handleStoryPress, handlePostPress, playingAudioId, audioProgress, highlightedMessageId]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]}>

      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: cardBg, borderBottomColor: borderColor }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <MaterialCommunityIcons name="chevron-left" size={28} color={textColor} />
          </TouchableOpacity>

          <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }} onPress={() => { if (isGroup) setGroupSettingsModalVisible(true); }}>
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
              {isOnline && !isGroup && <View style={styles.onlineDot} />}
            </View>

            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: textColor }]} numberOfLines={1}>{title || 'Chat'}</Text>
              <Text style={[styles.headerSub, { color: otherUserTyping ? brand.primary : isOnline ? '#10b981' : subColor }]}>
                {isGroup
                  ? 'Tap for group info'
                  : otherUserTyping
                    ? 'typing...'
                    : (isOnline ? 'Active now' : lastSeen ? `Last seen ${formatLastSeen(lastSeen)}` : 'Offline')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => { setSearchVisible(v => !v); setSearchQuery(''); }}>
            <MaterialCommunityIcons name={searchVisible ? 'close' : 'magnify'} size={20}
              color={searchVisible ? brand.primary : textColor} />
          </TouchableOpacity>
          {!isGroup && (
            <TouchableOpacity style={styles.actionBtn}
              onPress={() => {
                if (!conversationId || !recipientId) {
                  Alert.alert('Error', 'Cannot start a call without an active conversation.');
                  return;
                }
                Alert.alert('Start Call', 'Select call type', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Voice Call', onPress: () => {
                      navigation.navigate('Call', {
                        conversationId,
                        recipientId,
                        recipientName: title,
                        recipientAvatar,
                        callType: 'voice',
                        isIncoming: false,
                      });
                    }
                  },
                  {
                    text: 'Video Call', onPress: () => {
                      navigation.navigate('Call', {
                        conversationId,
                        recipientId,
                        recipientName: title,
                        recipientAvatar,
                        callType: 'video',
                        isIncoming: false,
                      });
                    }
                  }
                ]);
              }}>
              <MaterialCommunityIcons name="phone-outline" size={20} color={textColor} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.actionBtn}
            onPress={() => {
              Alert.alert('Chat Options', 'Select an action:', [
                { text: 'Set Encryption Password 🔒', onPress: () => setE2eeModalVisible(true) },
                {
                  text: 'View Profile', onPress: () => {
                    if (isGroup) {
                      // Handled by group settings modal later
                    } else {
                      navigation.navigate('Profile', { userId: recipientId });
                    }
                  }
                },
                { text: 'Cancel', style: 'cancel' }
              ]);
            }}>
            <MaterialCommunityIcons name="dots-vertical" size={22} color={textColor} />
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

          {searchingServer ? (
            <ActivityIndicator size="small" color={brand.primary} style={{ marginRight: 8 }} />
          ) : searchQuery.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ color: subColor, fontSize: 12, marginRight: 8 }}>
                {matchingIndices.length > 0 ? `${searchIndex + 1}/${matchingIndices.length}` : '0 results'}
              </Text>
              {matchingIndices.length > 0 && (
                <>
                  <TouchableOpacity onPress={() => {
                    const next = Math.max(0, searchIndex - 1);
                    setSearchIndex(next);
                    flatListRef.current?.scrollToIndex({ index: matchingIndices[next], animated: true });
                  }} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="chevron-down" size={20} color={subColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    const next = Math.min(matchingIndices.length - 1, searchIndex + 1);
                    setSearchIndex(next);
                    flatListRef.current?.scrollToIndex({ index: matchingIndices[next], animated: true });
                  }} style={{ padding: 4, marginRight: 8 }}>
                    <MaterialCommunityIcons name="chevron-up" size={20} color={subColor} />
                  </TouchableOpacity>
                </>
              )}
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialCommunityIcons name="close-circle" size={16} color={subColor} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* MESSAGE LIST */}
      {loading ? (
        <ChatMessageSkeleton />
      ) : (
        <FlatList
          ref={flatListRef}
          data={messages}
          inverted
          keyExtractor={(item, index) => item._id ? String(item._id) : `msg-${index}`}
          contentContainerStyle={styles.listContent}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          onEndReached={loadOlderMessages}
          onEndReachedThreshold={0.2}
          onScrollToIndexFailed={(info) => {
            setTimeout(() => {
              flatListRef.current?.scrollToIndex({ index: info.index, animated: true });
            }, 100);
          }}
          ListHeaderComponent={loadingOlder ? (
            <View style={{ paddingVertical: 12 }}>
              <ActivityIndicator size="small" color={brand.primary} />
            </View>
          ) : null}
          ListEmptyComponent={() => (
            <View style={{ padding: 40, alignItems: 'center', transform: [{ rotate: '180deg' }] }}>
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
            <View style={[styles.replyBarInner, { borderLeftColor: brand.primary }]}>
              <Text style={[styles.replyBarTitle, { color: brand.primary }]}>
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

        <View style={[styles.inputRow, { backgroundColor: cardBg, borderTopColor: borderColor, flexDirection: 'column', alignItems: 'stretch' }]}>

          {/* Pending Media Strip */}
          {pendingMedia.length > 0 && (
            <View style={{ paddingHorizontal: 10, paddingVertical: 4 }}>
              <FlatList
                horizontal
                data={pendingMedia}
                keyExtractor={(item, idx) => item.uri + idx}
                renderItem={({ item, index }) => (
                  <View style={{ marginRight: 8, position: 'relative' }}>
                    {item.type === 'image' || item.type === 'video' ? (
                      <Image source={{ uri: item.uri }} style={{ width: 60, height: 60, borderRadius: 8 }} />
                    ) : (
                      <View style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: isDark ? '#334155' : '#e2e8f0', justifyContent: 'center', alignItems: 'center' }}>
                        <MaterialCommunityIcons name="file-document-outline" size={24} color={subColor} />
                        <Text style={{ fontSize: 9, color: subColor, marginTop: 4, paddingHorizontal: 2 }} numberOfLines={1}>{item.name}</Text>
                      </View>
                    )}
                    <TouchableOpacity
                      style={{ position: 'absolute', top: -5, right: -5, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, padding: 2 }}
                      onPress={() => setPendingMedia(prev => prev.filter((_, i) => i !== index))}
                    >
                      <MaterialCommunityIcons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
                showsHorizontalScrollIndicator={false}
              />
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10 }}>
            {/* Voice note recording UI */}
            {isRecording ? (
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: isDark ? 'rgba(239,68,68,0.1)' : '#fee2e2', borderRadius: 24, paddingHorizontal: 14, paddingVertical: 10 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#ef4444', marginRight: 10 }} />
                <Text style={{ color: '#ef4444', fontWeight: '600', fontSize: 13, flex: 1 }}>
                  Recording... {Math.floor(recordSecs / 60)}:{String(recordSecs % 60).padStart(2, '0')}
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    try {
                      const result = await audioRecorderPlayer.stopRecorder();
                      audioRecorderPlayer.removeRecordBackListener();
                      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
                      setIsRecording(false);
                      setRecordSecs(0);
                      // Upload voice note
                      const formData = new FormData();
                      formData.append('file', { uri: result, type: 'audio/m4a', name: 'voice_note.m4a' } as any);
                      setUploadingMedia(true);
                      try {
                        const uploadRes = await api.post('/api/media/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
                        const url = uploadRes.data.url || uploadRes.data.secure_url;
                        await api.post(`/api/conversation/messages/create`, {
                          conversationId,
                          recipientId: !isGroup ? recipientId : undefined,
                          content: '🎤 Voice message',
                          mediaUrl: url,
                          mediaType: 'audio',
                        });
                      } finally {
                        setUploadingMedia(false);
                      }
                    } catch (e: any) { Alert.alert('Error', e.message || 'Failed to send voice note'); }
                  }}
                  style={{ backgroundColor: brand.primary, width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', marginRight: 8 }}
                >
                  <MaterialCommunityIcons name="send" size={18} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={async () => {
                    await audioRecorderPlayer.stopRecorder();
                    audioRecorderPlayer.removeRecordBackListener();
                    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
                    setIsRecording(false);
                    setRecordSecs(0);
                  }}
                  style={{ backgroundColor: isDark ? '#334155' : '#e2e8f0', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialCommunityIcons name="close" size={18} color={subColor} />
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <TouchableOpacity onPress={promptAttachment} style={styles.attachBtn} disabled={uploadingMedia}>
                  {uploadingMedia
                    ? <ActivityIndicator size="small" color={brand.primary} />
                    : <MaterialCommunityIcons name="paperclip" size={24} color={subColor} />}
                </TouchableOpacity>
                <TextInput
                  style={[styles.input, { color: textColor, backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6' }]}
                  placeholder="Type a message..." placeholderTextColor={subColor}
                  value={inputText} onChangeText={handleInputChange} multiline maxLength={2000} />
                {inputText.trim() || pendingMedia.length > 0 ? (
                  <TouchableOpacity onPress={handleSend}
                    style={[styles.sendBtn, { backgroundColor: brand.primary }]}
                    disabled={sending || uploadingMedia}>
                    <MaterialCommunityIcons name={editingMessage ? 'check' : 'send'} size={20} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onLongPress={async () => {
                      try {
                        await audioRecorderPlayer.startRecorder();
                        audioRecorderPlayer.addRecordBackListener(() => { });
                        setIsRecording(true);
                        setRecordSecs(0);
                        recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
                      } catch (e: any) {
                        Alert.alert('Microphone Permission', 'Please allow microphone access to record voice notes.');
                      }
                    }}
                    onPress={async () => {
                      if (isRecording) return;
                      try {
                        await audioRecorderPlayer.startRecorder();
                        audioRecorderPlayer.addRecordBackListener(() => { });
                        setIsRecording(true);
                        setRecordSecs(0);
                        recordTimerRef.current = setInterval(() => setRecordSecs(s => s + 1), 1000);
                      } catch (e: any) {
                        Alert.alert('Microphone Permission', 'Please allow microphone access to record voice notes.');
                      }
                    }}
                    style={[styles.sendBtn, { backgroundColor: isDark ? '#334155' : '#e2e8f0' }]}
                  >
                    <MaterialCommunityIcons name="microphone" size={20} color={subColor} />
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
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

                {/* Reaction Picker Row */}
                {selectedMessage && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-evenly', paddingVertical: 14, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: borderColor }}>
                    {EMOJI_REACTIONS.map((emoji) => {
                      const hasReacted = selectedMessage.reactions?.[currentUser._id] === emoji;
                      return (
                        <TouchableOpacity
                          key={emoji}
                          onPress={() => handleReact(selectedMessage._id, emoji)}
                          style={{
                            padding: 8,
                            backgroundColor: hasReacted ? (isDark ? 'rgba(128,139,245,0.2)' : '#e0e7ff') : 'transparent',
                            borderRadius: 20
                          }}
                        >
                          <Text style={{ fontSize: 28 }}>{emoji}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}

                {[
                  { icon: 'reply', label: 'Reply', color: textColor, onPress: () => { setReplyTo(selectedMessage); setSelectedMessage(null); } },
                  ...(selectedMessage?.decryptedContent || selectedMessage?.content ? [{
                    icon: 'share-variant', label: 'Share', color: textColor,
                    onPress: () => { Share.share({ message: selectedMessage.decryptedContent || selectedMessage.content }); setSelectedMessage(null); },
                  }] : []),
                  ...(String(selectedMessage?.sender?._id || selectedMessage?.senderId || selectedMessage?.sender) === String(currentUser?._id) && !selectedMessage?.mediaUrl && !selectedMessage?.media && selectedMessage?.content !== 'Started a video call' && selectedMessage?.content !== 'Started a voice call' ? [
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
            <ZoomableImage uri={imageViewerUrl} />
          )}
        </View>
      </Modal>

      {/* VIDEO VIEWER */}
      <Modal visible={!!videoViewerUrl} transparent animationType="fade"
        onRequestClose={() => setVideoViewerUrl(null)}>
        <View style={styles.imgViewerBg}>
          <TouchableOpacity style={styles.imgViewerClose} onPress={() => setVideoViewerUrl(null)}>
            <MaterialCommunityIcons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {videoViewerUrl && (
            <VideoComponent
              source={{ uri: videoViewerUrl }}
              style={{ width: '100%', height: '70%' }}
              resizeMode="contain"
              controls
              paused={false}
            />
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
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: brand.primary, justifyContent: 'center', alignItems: 'center' }}>
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

      <Modal visible={e2eeModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cardBg }]}>
            <Text style={[styles.modalTitle, { color: textColor }]}>Set Conversation Password</Text>
            <Text style={{ color: subColor, marginBottom: 15 }}>Enter the shared secret password for this conversation to enable End-to-End Encryption.</Text>
            <TextInput
              style={[styles.input, { backgroundColor: bg, color: textColor, marginBottom: 15, width: '100%' }]}
              placeholder="Password..."
              placeholderTextColor={subColor}
              secureTextEntry
              value={e2eePassword}
              onChangeText={setE2eePassword}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', width: '100%' }}>
              <TouchableOpacity onPress={() => setE2eeModalVisible(false)} style={{ padding: 10 }}>
                <Text style={{ color: subColor }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (e2eePassword.trim()) {
                    await useE2eeStore.getState().setConversationKey(conversationId, e2eePassword.trim());
                    setE2eeModalVisible(false);
                    setE2eePassword('');
                    // Query handles refetch
                    queryClient.invalidateQueries({ queryKey: queryKeys.messages(conversationId) });
                  }
                }}
                style={{ padding: 10, marginLeft: 10 }}
              >
                <Text style={{ color: '#007AFF', fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    backgroundColor: brand.primary, justifyContent: 'center', alignItems: 'center'
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
