import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
  SafeAreaView,
  Platform,
  useColorScheme,
  Image,
  Dimensions,
  KeyboardAvoidingView,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { registerGlobals, VideoView } from '@livekit/react-native';
import { Room, RoomEvent, Track, RemoteParticipant, RoomOptions } from 'livekit-client';
import { api, BASE_URL } from '../lib/api';
import useAuthStore from '../store/zustand/useAuthStore';

// Initialize WebRTC and audio session globals for LiveKit safely
let isWebRTCAvailable = true;
try {
  registerGlobals();
} catch (e) {
  console.warn('LiveKit registerGlobals failed:', e);
  isWebRTCAvailable = false;
}

// polyfills for TextEncoder / TextDecoder in React Native / Hermes
class TextEncoderPolyfill {
  encode(str: string): Uint8Array {
    const arr = [];
    for (let i = 0; i < str.length; i++) {
      const code = str.charCodeAt(i);
      if (code < 0x80) {
        arr.push(code);
      } else if (code < 0x800) {
        arr.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
      } else if (code < 0xd800 || code >= 0xe000) {
        arr.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
      } else {
        i++;
        const nextCode = str.charCodeAt(i);
        const surrogateCode = 0x10000 + (((code & 0x3ff) << 10) | (nextCode & 0x3ff));
        arr.push(
          0xf0 | (surrogateCode >> 18),
          0x80 | ((surrogateCode >> 12) & 0x3f),
          0x80 | ((surrogateCode >> 6) & 0x3f),
          0x80 | (surrogateCode & 0x3f)
        );
      }
    }
    return new Uint8Array(arr);
  }
}

class TextDecoderPolyfill {
  decode(arr: Uint8Array): string {
    let str = '';
    let i = 0;
    while (i < arr.length) {
      const byte = arr[i++];
      if (byte < 0x80) {
        str += String.fromCharCode(byte);
      } else if (byte < 0xe0) {
        const byte2 = arr[i++];
        str += String.fromCharCode(((byte & 0x1f) << 6) | (byte2 & 0x3f));
      } else if (byte < 0xf0) {
        const byte2 = arr[i++];
        const byte3 = arr[i++];
        str += String.fromCharCode(((byte & 0x0f) << 12) | ((byte2 & 0x3f) << 6) | (byte3 & 0x3f));
      } else {
        const byte2 = arr[i++];
        const byte3 = arr[i++];
        const byte4 = arr[i++];
        const surrogateCode =
          (((byte & 0x07) << 18) | ((byte2 & 0x3f) << 12) | ((byte3 & 0x3f) << 6) | (byte4 & 0x3f)) -
          0x10000;
        str += String.fromCharCode(0xd800 | (surrogateCode >> 10), 0xdc00 | (surrogateCode & 0x3ff));
      }
    }
    return str;
  }
}

if (typeof (globalThis as any).TextEncoder === 'undefined') {
  (globalThis as any).TextEncoder = TextEncoderPolyfill;
}
if (typeof (globalThis as any).TextDecoder === 'undefined') {
  (globalThis as any).TextDecoder = TextDecoderPolyfill;
}

// Declare types for TypeScript compiler
declare global {
  var TextEncoder: any;
  var TextDecoder: any;
}

const { width, height } = Dimensions.get('window');

interface LiveStreamScreenProps {
  streamId: string;
  isHost: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  text: string;
  isSystem?: boolean;
  user: {
    _id: string;
    fullname: string;
    profile_picture?: string;
  };
}

const PALETTE = ['#808bf5', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];
const getUserColor = (id = '') => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return PALETTE[Math.abs(h) % PALETTE.length];
};

export default function LiveStreamScreen({ streamId, isHost, onClose }: LiveStreamScreenProps) {
  if (!isWebRTCAvailable) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" style={{ marginBottom: 12 }} />
          <Text style={[styles.loadingText, { color: '#ef4444' }]}>WebRTC Module Not Available</Text>
          <Text style={[styles.subLoadingText, { textAlign: 'center', paddingHorizontal: 32 }]}>
            Please ensure you have rebuilt the native Android / iOS application binary to load WebRTC classes.
          </Text>
          <TouchableOpacity style={[styles.resumeBtn, { marginTop: 24 }]} onPress={onClose}>
            <Text style={styles.resumeBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const loggedUser = useAuthStore((s: any) => s.user);
  const isDark = useColorScheme() === 'dark';

  const [token, setToken] = useState('');
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null);
  const [videoTrack, setVideoTrack] = useState<any>(null);
  const [connecting, setConnecting] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [viewersCount, setViewersCount] = useState(0);
  const [hostInfo, setHostInfo] = useState<any>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [showChat, setShowChat] = useState(true);

  // Resolve LiveKit URL dynamically from API Base URL
  const getLiveKitUrl = () => {
    if (BASE_URL.includes('10.0.2.2')) {
      return 'ws://10.0.2.2:7880';
    }
    if (BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')) {
      return 'ws://localhost:7880';
    }
    return 'wss://social-square-wstenfwc.livekit.cloud';
  };

  const handleLivekitUrl = getLiveKitUrl();

  // Load chat history from REST API
  const fetchChatHistory = useCallback(async () => {
    try {
      const res = await api.get(`/api/live/${streamId}/chat/history`);
      if (Array.isArray(res.data)) {
        setChatMessages(res.data);
      }
    } catch (err) {
      console.warn('Failed to load live chat history:', err);
    }
  }, [streamId]);

  // Fetch host info (for viewers)
  const fetchHostInfo = useCallback(async () => {
    if (isHost) return;
    try {
      const res = await api.get(`/api/live/stream/${streamId}`);
      setHostInfo(res.data.host);
    } catch (err) {
      console.warn('Failed to load host info:', err);
    }
  }, [isHost, streamId]);

  // Get LiveKit access token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await api.post(`/api/live/${streamId}/token`);
        setToken(res.data.token);
      } catch (err: any) {
        console.error('Failed to get LiveKit token:', err);
        Alert.alert('Connection Error', err?.response?.data?.error || 'Could not connect to live streaming server.');
        onClose();
      }
    };
    fetchToken();
    fetchHostInfo();
  }, [streamId, onClose, fetchHostInfo]);

  // Connect to LiveKit Room once token is fetched
  useEffect(() => {
    if (!token) return;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    } as RoomOptions);

    const connectToRoom = async () => {
      try {
        await room.connect(handleLivekitUrl, token);
        setLiveKitRoom(room);
        setConnecting(false);

        // If host, enable local video and audio immediately
        if (isHost) {
          await room.localParticipant.setCameraEnabled(true);
          await room.localParticipant.setMicrophoneEnabled(true);
          
          // Set local video track
          const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
          if (cameraTrack) {
            setVideoTrack(cameraTrack);
          }
        } else {
          // If viewer, find existing host video track
          const hostParticipant = Array.from(room.remoteParticipants.values())[0];
          if (hostParticipant) {
            const cameraTrack = hostParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
            if (cameraTrack) {
              setVideoTrack(cameraTrack);
            }
          }
        }

        // Setup viewers count
        setViewersCount(room.remoteParticipants.size);

        // Room event listeners
        room.on(RoomEvent.ParticipantConnected, () => {
          setViewersCount(room.remoteParticipants.size);
        });

        room.on(RoomEvent.ParticipantDisconnected, () => {
          setViewersCount(room.remoteParticipants.size);
        });

        // Track subscription handler for viewers
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'video' && track.source === Track.Source.Camera) {
            setVideoTrack(track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === 'video' && track.source === Track.Source.Camera) {
            setVideoTrack(null);
          }
        });

        // Listen to WebRTC data channel for real-time chat and system control messages
        room.on(RoomEvent.DataReceived, (payload, participant) => {
          try {
            let messageStr = '';
            try {
              messageStr = new TextDecoder().decode(payload);
            } catch {
              messageStr = String.fromCharCode.apply(null, Array.from(payload) as any);
            }

            const data = JSON.parse(messageStr);
            if (data.type === 'chat') {
              setChatMessages((prev) => [...prev, data.message].slice(-100));
            } else if (data.type === 'system') {
              if (data.action === 'pause') {
                setIsPaused(true);
              } else if (data.action === 'resume') {
                setIsPaused(false);
              } else if (data.action === 'ended') {
                Alert.alert('Live Stream Ended', 'This broadcast has been completed by the host.');
                onClose();
              }
            }
          } catch (e) {
            console.warn('Failed to parse WebRTC data message:', e);
          }
        });

        fetchChatHistory();
      } catch (err) {
        console.error('Failed to connect to LiveKit Room:', err);
        Alert.alert('Stream Error', 'Failed to connect to WebRTC video session.');
        onClose();
      }
    };

    connectToRoom();

    return () => {
      room.disconnect();
    };
  }, [token, isHost, handleLivekitUrl, fetchChatHistory, onClose]);

  // Host action: Pause
  const handlePause = async () => {
    if (!liveKitRoom) return;
    try {
      await liveKitRoom.localParticipant.setCameraEnabled(false);
      await liveKitRoom.localParticipant.setMicrophoneEnabled(false);
      
      // Notify viewers via UDP data channel
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify({ type: 'system', action: 'pause' }));
      await liveKitRoom.localParticipant.publishData(payload, { reliable: true });
      
      setIsPaused(true);
    } catch (e) {
      console.warn('Failed to pause video/audio:', e);
    }
  };

  // Host action: Resume
  const handleResume = async () => {
    if (!liveKitRoom) return;
    try {
      await liveKitRoom.localParticipant.setCameraEnabled(true);
      await liveKitRoom.localParticipant.setMicrophoneEnabled(true);
      
      // Set track again
      const cameraTrack = liveKitRoom.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (cameraTrack) {
        setVideoTrack(cameraTrack);
      }

      // Notify viewers via UDP data channel
      const encoder = new TextEncoder();
      const payload = encoder.encode(JSON.stringify({ type: 'system', action: 'resume' }));
      await liveKitRoom.localParticipant.publishData(payload, { reliable: true });

      setIsPaused(false);
    } catch (e) {
      console.warn('Failed to resume video/audio:', e);
    }
  };

  // Host action: End Stream
  const handleEndStream = async () => {
    Alert.alert(
      'End Live Stream',
      'Are you sure you want to stop this live broadcast?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: async () => {
            try {
              if (liveKitRoom) {
                // Notify viewers via UDP data channel
                const encoder = new TextEncoder();
                const payload = encoder.encode(JSON.stringify({ type: 'system', action: 'ended' }));
                await liveKitRoom.localParticipant.publishData(payload, { reliable: true });
              }
              await api.post(`/api/live/end/${streamId}`);
            } catch (err) {
              console.warn('Failed to end stream:', err);
            } finally {
              onClose();
            }
          },
        },
      ]
    );
  };

  // Send message
  const handleSendMessage = async () => {
    if (!inputText.trim() || !liveKitRoom) return;
    const text = inputText.trim();
    setInputText('');

    const newMsg: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      user: {
        _id: loggedUser._id,
        fullname: loggedUser.fullname,
        profile_picture: loggedUser.profile_picture,
      },
    };

    // 1. Update UI locally
    setChatMessages((prev) => [...prev, newMsg].slice(-100));

    // 2. Publish to LiveKit Room data channel (realtime UDP)
    try {
      const encoder = new TextEncoder();
      const payload = encoder.encode(
        JSON.stringify({
          type: 'chat',
          message: newMsg,
        })
      );
      await liveKitRoom.localParticipant.publishData(payload, { reliable: true });
    } catch (err) {
      console.warn('Failed to broadcast chat message via WebRTC:', err);
    }

    // 3. Save to database via REST API (history)
    try {
      await api.post(`/api/live/${streamId}/chat/message`, { text });
    } catch (err) {
      console.warn('Failed to save chat message:', err);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {connecting ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#808bf5" />
          <Text style={styles.loadingText}>Connecting to stream session...</Text>
          <Text style={styles.subLoadingText}>Waiting for host's video feed</Text>
        </View>
      ) : (
        <View style={styles.container}>
          {/* Main Video View */}
          {videoTrack ? (
            <VideoView
              style={StyleSheet.absoluteFill}
              videoTrack={videoTrack}
            />
          ) : (
            <View style={styles.blackBackground}>
              <MaterialCommunityIcons name="video-off-outline" size={60} color="#ffffff" />
              <Text style={styles.noVideoText}>Stream feed is offline</Text>
              <Text style={styles.subNoVideoText}>Waiting for host to resume</Text>
            </View>
          )}

          {/* Pause Overlays */}
          {isPaused && (
            <View style={styles.pauseOverlay}>
              <View style={styles.pauseAvatarContainer}>
                {isHost ? (
                  <Image
                    source={{ uri: loggedUser.profile_picture || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                    style={styles.pauseAvatar}
                  />
                ) : hostInfo ? (
                  <Image
                    source={{ uri: hostInfo.profile_picture || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                    style={styles.pauseAvatar}
                  />
                ) : (
                  <View style={[styles.pauseAvatar, styles.pauseAvatarFallback]}>
                    <Text style={styles.avatarLetter}>H</Text>
                  </View>
                )}
                <View style={styles.pauseBadge}>
                  <MaterialCommunityIcons name="pause" size={14} color="#000000" />
                </View>
              </View>

              <Text style={styles.pauseTitle}>
                {isHost ? 'Live Paused' : `${hostInfo?.fullname || 'Host'} paused the live`}
              </Text>
              <Text style={styles.pauseSubtitle}>
                {isHost ? 'Viewers see a waiting screen' : 'Waiting for them to resume…'}
              </Text>

              {isHost && (
                <TouchableOpacity style={styles.resumeBtn} onPress={handleResume}>
                  <MaterialCommunityIcons name="play" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                  <Text style={styles.resumeBtnText}>Resume Live</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Header Controls */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.badge, isPaused && styles.pausedBadge]}>
                <View style={[styles.badgeDot, !isPaused && styles.animatedDot]} />
                <Text style={styles.badgeText}>{isPaused ? 'PAUSED' : 'LIVE'}</Text>
              </View>

              <View style={styles.viewersPill}>
                <MaterialCommunityIcons name="eye-outline" size={12} color="#ffffff" style={{ marginRight: 4 }} />
                <Text style={styles.viewersCountText}>{viewersCount}</Text>
              </View>

              {!isHost && hostInfo && (
                <View style={styles.hostInfoPill}>
                  <Image
                    source={{ uri: hostInfo.profile_picture || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                    style={styles.hostAvatar}
                  />
                  <Text style={styles.hostNameText} numberOfLines={1}>{hostInfo.fullname.split(' ')[0]}</Text>
                </View>
              )}
            </View>

            <View style={styles.headerRight}>
              {/* Chat Toggle */}
              <TouchableOpacity
                style={[styles.circleBtn, showChat && styles.chatActiveBtn]}
                onPress={() => setShowChat(!showChat)}
              >
                <MaterialCommunityIcons
                  name={showChat ? 'comment' : 'comment-off'}
                  size={16}
                  color={showChat ? '#808bf5' : '#ffffff'}
                />
              </TouchableOpacity>

              {isHost ? (
                <>
                  <TouchableOpacity style={styles.endLiveBtn} onPress={handleEndStream}>
                    <Text style={styles.endLiveText}>End Live</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.circleBtn, isPaused && styles.pausedPauseBtn]}
                    onPress={isPaused ? handleResume : handlePause}
                  >
                    <MaterialCommunityIcons name={isPaused ? 'play' : 'pause'} size={18} color="#ffffff" />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity style={styles.circleBtn} onPress={onClose}>
                  <MaterialCommunityIcons name="close" size={18} color="#ffffff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Floating Chat messages */}
          {showChat ? (
            <View style={styles.chatArea}>
              <FlatList
                data={chatMessages}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.chatListContent}
                renderItem={({ item }) => {
                  const color = getUserColor(item.user._id || item.user.fullname);
                  return (
                    <View style={styles.chatBubbleContainer}>
                      <Image
                        source={{ uri: item.user.profile_picture || 'https://abs.twimg.com/sticky/default_profile_images/default_profile_normal.png' }}
                        style={styles.chatAvatar}
                      />
                      <View style={styles.chatBubble}>
                        <Text style={[styles.chatUsername, { color }]}>
                          {item.user.fullname}
                        </Text>
                        <Text style={styles.chatMessageText}>{item.text}</Text>
                      </View>
                    </View>
                  );
                }}
              />
            </View>
          ) : (
            <View style={styles.chatHiddenBadge}>
              <MaterialCommunityIcons name="eye-off-outline" size={12} color="rgba(255,255,255,0.6)" style={{ marginRight: 4 }} />
              <Text style={styles.chatHiddenText}>Chat hidden</Text>
            </View>
          )}

          {/* Input Bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 40 : 0}
            style={styles.inputContainer}
          >
            <View style={styles.inputRow}>
              <View style={styles.inputWrapper}>
                <TextInput
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Send a message..."
                  placeholderTextColor="rgba(255,255,255,0.4)"
                  style={styles.input}
                />
              </View>
              <TouchableOpacity
                disabled={!inputText.trim()}
                onPress={handleSendMessage}
                style={[
                  styles.sendBtn,
                  inputText.trim() ? styles.sendBtnActive : styles.sendBtnInactive,
                ]}
              >
                <MaterialCommunityIcons name="send" size={16} color="#ffffff" />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  subLoadingText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    marginTop: 6,
  },
  blackBackground: {
    flex: 1,
    backgroundColor: '#050505',
    justifyContent: 'center',
    alignItems: 'center',
  },
  noVideoText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 12,
  },
  subNoVideoText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 4,
  },
  pauseOverlay: {
    position: 'absolute',
    inset: 0,
    zIndex: 60,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  pauseAvatarContainer: {
    position: 'relative',
    marginBottom: 16,
  },
  pauseAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pauseAvatarFallback: {
    backgroundColor: '#808bf5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLetter: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  pauseBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#000000',
  },
  pauseTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
    textAlign: 'center',
  },
  pauseSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 20,
  },
  resumeBtn: {
    backgroundColor: '#808bf5',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    elevation: 4,
  },
  resumeBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 44 : 20,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 50,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ef4444',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginRight: 6,
  },
  pausedBadge: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ffffff',
    marginRight: 6,
  },
  animatedDot: {
    opacity: 0.8,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  viewersPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginRight: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  viewersCountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  hostInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    maxWidth: 100,
  },
  hostAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 4,
  },
  hostNameText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chatActiveBtn: {
    backgroundColor: 'rgba(128,139,245,0.3)',
    borderColor: 'rgba(128,139,245,0.5)',
  },
  pausedPauseBtn: {
    backgroundColor: '#808bf5',
  },
  endLiveBtn: {
    backgroundColor: '#ef4444',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginLeft: 6,
  },
  endLiveText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  chatArea: {
    position: 'absolute',
    bottom: 80,
    left: 12,
    right: 12,
    maxHeight: height * 0.3,
    zIndex: 40,
  },
  chatListContent: {
    paddingVertical: 8,
  },
  chatBubbleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    maxWidth: '85%',
  },
  chatAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.25)',
    marginRight: 8,
  },
  chatBubble: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chatUsername: {
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  chatMessageText: {
    color: '#ffffff',
    fontSize: 12,
  },
  chatHiddenBadge: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    zIndex: 40,
  },
  chatHiddenText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: 'bold',
  },
  inputContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapper: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  input: {
    color: '#ffffff',
    fontSize: 13,
    padding: 0,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  sendBtnActive: {
    backgroundColor: '#808bf5',
  },
  sendBtnInactive: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
