import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Image,
  ActivityIndicator,
  useColorScheme,
  Alert,
  Dimensions,
  Platform,
  Vibration,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { api, BASE_URL } from '../lib/api';
import { getSocket } from '../lib/socket';
import useAuthStore from '../store/zustand/useAuthStore';
import { Room, RoomEvent, Track, RemoteParticipant, RoomOptions } from 'livekit-client';
import { registerGlobals, VideoView } from '@livekit/react-native';

// Register LiveKit React Native WebRTC globals if not already done
try {
  registerGlobals();
} catch (e) {
  console.warn('registerGlobals error:', e);
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function CallScreen() {
  const isDark = useColorScheme() === 'dark';
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const loggedUser = useAuthStore((s: any) => s.user);

  const {
    conversationId,
    recipientId,
    recipientName,
    recipientAvatar,
    callerId,
    callerName,
    callerAvatar,
    callType,
    isIncoming: initialIsIncoming,
  } = route.params || {};

  const [callStatus, setCallStatus] = useState<
    'incoming' | 'calling' | 'connecting' | 'connected'
  >(initialIsIncoming ? 'incoming' : 'calling');

  const [token, setToken] = useState<string | null>(null);
  const [liveKitRoom, setLiveKitRoom] = useState<Room | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  const fetchInitiated = useRef(false);
  const vibrationInterval = useRef<any>(null);

  // Identify remote user details
  const remoteUser = initialIsIncoming
    ? { id: callerId, fullname: callerName, avatar: callerAvatar }
    : { id: recipientId, fullname: recipientName, avatar: recipientAvatar };

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

  // Ringtone Vibration
  useEffect(() => {
    if (callStatus === 'incoming') {
      // Vibrate pattern for incoming call
      const pattern = [0, 800, 800]; // wait 0ms, vibrate 800ms, sleep 800ms
      Vibration.vibrate(pattern, true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [callStatus]);

  // Socket Call events listener
  useEffect(() => {
    const socket = getSocket();

    const handleCallAccepted = ({ receiverId, conversationId: acceptedConvId }: any) => {
      console.log('[Socket] Call Accepted by:', receiverId);
      setCallStatus('connecting');
    };

    const handleCallDeclined = () => {
      console.log('[Socket] Call Declined');
      Alert.alert('Call', 'Call declined by user.');
      cleanupAndClose();
    };

    const handleCallEnded = () => {
      console.log('[Socket] Call Ended');
      Alert.alert('Call', 'Call ended.');
      cleanupAndClose();
    };

    socket.on('callAccepted', handleCallAccepted);
    socket.on('callDeclined', handleCallDeclined);
    socket.on('callEnded', handleCallEnded);

    // If caller, send initiate call event immediately
    if (!initialIsIncoming) {
      socket.emit('initiateCall', {
        recipientId,
        type: callType,
        conversationId,
        callerName: loggedUser?.fullname || 'User',
        callerAvatar: loggedUser?.profile_picture || loggedUser?.profilePicture || '',
      });
    }

    return () => {
      socket.off('callAccepted', handleCallAccepted);
      socket.off('callDeclined', handleCallDeclined);
      socket.off('callEnded', handleCallEnded);
    };
  }, [conversationId, recipientId, initialIsIncoming, callType]);

  // Fetch LiveKit Token upon acceptance / connection transition
  useEffect(() => {
    if (callStatus !== 'connecting' || fetchInitiated.current) return;
    fetchInitiated.current = true;

    const fetchToken = async () => {
      try {
        const res = await api.post(`/api/conversation/call/token`, { conversationId });
        setToken(res.data.token);
        setCallStatus('connected');
      } catch (err) {
        console.error('[CallScreen] Token generation failed:', err);
        Alert.alert('Connection Error', 'Failed to retrieve media credentials.');
        cleanupAndClose();
      }
    };

    fetchToken();
  }, [callStatus, conversationId]);

  // Connect to LiveKit Room once token is fetched
  useEffect(() => {
    if (callStatus !== 'connected' || !token) return;

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    } as RoomOptions);

    const connectToRoom = async () => {
      try {
        await room.connect(handleLivekitUrl, token);
        setLiveKitRoom(room);

        // Publish local camera and mic
        await room.localParticipant.setMicrophoneEnabled(true);
        if (callType === 'video') {
          await room.localParticipant.setCameraEnabled(true);
          const cameraTrack = room.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
          if (cameraTrack) {
            setLocalVideoTrack(cameraTrack);
          }
        }

        // Check for existing remote camera tracks
        const remoteParticipant = Array.from(room.remoteParticipants.values())[0];
        if (remoteParticipant) {
          const cameraTrack = remoteParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
          if (cameraTrack) {
            setRemoteVideoTrack(cameraTrack);
          }
        }

        // Register room track event listeners
        room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
          if (track.kind === 'video' && track.source === Track.Source.Camera) {
            setRemoteVideoTrack(track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (track) => {
          if (track.kind === 'video' && track.source === Track.Source.Camera) {
            setRemoteVideoTrack(null);
          }
        });

        room.on(RoomEvent.ParticipantConnected, (participant) => {
          console.log('[LiveKit] Participant connected:', participant.identity);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant) => {
          console.log('[LiveKit] Participant disconnected:', participant.identity);
          Alert.alert('Call', 'Participant disconnected.');
          cleanupAndClose();
        });

      } catch (err) {
        console.error('[LiveKit] Connection failed:', err);
        Alert.alert('Connection Error', 'Could not establish media connection.');
        cleanupAndClose();
      }
    };

    connectToRoom();

    return () => {
      room.disconnect();
    };
  }, [callStatus, token]);

  // Call timer effect
  useEffect(() => {
    if (callStatus !== 'connected') return;
    const interval = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [callStatus]);

  const cleanupAndClose = () => {
    Vibration.cancel();
    if (liveKitRoom) {
      try {
        liveKitRoom.disconnect();
      } catch (e) {}
    }
    navigation.goBack();
  };

  const handleAccept = () => {
    getSocket().emit('acceptCall', { callerId: remoteUser.id, conversationId });
    setCallStatus('connecting');
  };

  const handleDecline = () => {
    getSocket().emit('declineCall', { callerId: remoteUser.id });
    cleanupAndClose();
  };

  const handleHangUp = () => {
    getSocket().emit('endCall', { recipientId: remoteUser.id, conversationId });
    cleanupAndClose();
  };

  const handleMuteToggle = async () => {
    if (!liveKitRoom) return;
    const next = !isMuted;
    await liveKitRoom.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  };

  const handleVideoToggle = async () => {
    if (!liveKitRoom || callType === 'voice') return;
    const next = !isVideoOff;
    await liveKitRoom.localParticipant.setCameraEnabled(!next);
    setIsVideoOff(next);
    if (next) {
      setLocalVideoTrack(null);
    } else {
      const cameraTrack = liveKitRoom.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (cameraTrack) {
        setLocalVideoTrack(cameraTrack);
      }
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const remoteAvatarUrl = resolveMediaUrl(remoteUser.avatar);

  // 1. INCOMING VIEW
  if (callStatus === 'incoming') {
    return (
      <SafeAreaView style={styles.incomingContainer}>
        <View style={styles.incomingHeader}>
          <Text style={styles.incomingLabel}>Incoming {callType} call</Text>
        </View>

        <View style={styles.incomingBody}>
          {remoteAvatarUrl ? (
            <Image source={{ uri: remoteAvatarUrl }} style={styles.incomingAvatar} />
          ) : (
            <View style={styles.incomingAvatarFallback}>
              <Text style={styles.incomingAvatarInitial}>
                {(remoteUser.fullname || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.incomingName}>{remoteUser.fullname}</Text>
          <Text style={styles.incomingSubtext}>Calling you...</Text>
        </View>

        <View style={styles.incomingActions}>
          {/* Decline Button */}
          <TouchableOpacity onPress={handleDecline} style={[styles.actionButton, { backgroundColor: '#ef4444' }]}>
            <MaterialCommunityIcons name="phone-hangup" size={32} color="#ffffff" />
          </TouchableOpacity>

          {/* Accept Button */}
          <TouchableOpacity onPress={handleAccept} style={[styles.actionButton, { backgroundColor: '#10b981' }]}>
            <MaterialCommunityIcons name="phone" size={32} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 2. OUTGOING / CALLING VIEW
  if (callStatus === 'calling' || callStatus === 'connecting') {
    return (
      <SafeAreaView style={styles.incomingContainer}>
        <View style={styles.incomingHeader}>
          <Text style={styles.incomingLabel}>
            {callStatus === 'connecting' ? 'Connecting...' : 'Calling...'}
          </Text>
        </View>

        <View style={styles.incomingBody}>
          {remoteAvatarUrl ? (
            <Image source={{ uri: remoteAvatarUrl }} style={styles.incomingAvatar} />
          ) : (
            <View style={styles.incomingAvatarFallback}>
              <Text style={styles.incomingAvatarInitial}>
                {(remoteUser.fullname || 'U')[0].toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.incomingName}>{remoteUser.fullname}</Text>
          <Text style={styles.incomingSubtext}>
            {callStatus === 'connecting' ? 'Establishing media connection...' : 'Ringing...'}
          </Text>
        </View>

        <View style={styles.incomingActions}>
          {/* Hangup Button */}
          <TouchableOpacity onPress={handleHangUp} style={[styles.actionButton, { backgroundColor: '#ef4444' }]}>
            <MaterialCommunityIcons name="phone-hangup" size={32} color="#ffffff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // 3. CONNECTED ROOM VIEW
  return (
    <View style={styles.connectedContainer}>
      {/* Floating Timer Header */}
      <View style={styles.floatingHeader}>
        <View style={styles.timerBadge}>
          <View style={styles.pulseDot} />
          <Text style={styles.timerText}>{formatTime(secondsElapsed)}</Text>
        </View>
      </View>

      {/* Main Video/Audio Stream Canvas */}
      <View style={styles.streamCanvas}>
        {callType === 'video' && remoteVideoTrack ? (
          <VideoView style={StyleSheet.absoluteFill} videoTrack={remoteVideoTrack} />
        ) : (
          <View style={styles.audioCallCenter}>
            {remoteAvatarUrl ? (
              <Image source={{ uri: remoteAvatarUrl }} style={styles.connectedAvatar} />
            ) : (
              <View style={styles.connectedAvatarFallback}>
                <Text style={styles.connectedAvatarInitial}>
                  {(remoteUser.fullname || 'U')[0].toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.connectedName}>{remoteUser.fullname}</Text>
            <Text style={styles.connectedStatus}>Audio Call Connected</Text>
          </View>
        )}
      </View>

      {/* Floating Local Camera Preview */}
      {callType === 'video' && !isVideoOff && localVideoTrack && (
        <View style={styles.localVideoOverlay}>
          <VideoView style={StyleSheet.absoluteFill} videoTrack={localVideoTrack} />
        </View>
      )}

      {/* Controller Controls Footer */}
      <View style={styles.controlsFooter}>
        <View style={styles.controlsRow}>
          {/* Mute Mic button */}
          <TouchableOpacity
            onPress={handleMuteToggle}
            style={[styles.controlBtn, isMuted && { backgroundColor: '#ef4444' }]}
          >
            <MaterialCommunityIcons
              name={isMuted ? 'microphone-off' : 'microphone'}
              size={24}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity onPress={handleHangUp} style={styles.endCallBtn}>
            <MaterialCommunityIcons name="phone-hangup" size={30} color="#ffffff" />
          </TouchableOpacity>

          {/* Camera toggle Button */}
          <TouchableOpacity
            onPress={handleVideoToggle}
            disabled={callType === 'voice'}
            style={[
              styles.controlBtn,
              callType === 'voice' && { opacity: 0.3 },
              isVideoOff && { backgroundColor: '#475569' },
            ]}
          >
            <MaterialCommunityIcons
              name={isVideoOff ? 'video-off' : 'video'}
              size={24}
              color={callType === 'voice' ? 'rgba(255,255,255,0.3)' : '#ffffff'}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  incomingContainer: {
    flex: 1,
    backgroundColor: '#090a0f',
    justifyContent: 'space-between',
    paddingVertical: 40,
  },
  incomingHeader: {
    alignItems: 'center',
    marginTop: 20,
  },
  incomingLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#808bf5',
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  incomingBody: {
    alignItems: 'center',
  },
  incomingAvatar: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 4,
    borderColor: 'rgba(128, 139, 245, 0.4)',
  },
  incomingAvatarFallback: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(128, 139, 245, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(128, 139, 245, 0.4)',
  },
  incomingAvatarInitial: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  incomingName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 20,
  },
  incomingSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.4)',
    marginTop: 8,
  },
  incomingActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 48,
    marginBottom: 40,
  },
  actionButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  connectedContainer: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
  floatingHeader: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    left: 20,
    zIndex: 100,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(9, 10, 15, 0.6)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 8,
  },
  timerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: 'bold',
  },
  streamCanvas: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioCallCenter: {
    alignItems: 'center',
  },
  connectedAvatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#808bf5',
  },
  connectedAvatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(128, 139, 245, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#808bf5',
  },
  connectedAvatarInitial: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  connectedName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
  },
  connectedStatus: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 6,
  },
  localVideoOverlay: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 36,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
    backgroundColor: '#111111',
    zIndex: 50,
  },
  controlsFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    paddingTop: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    zIndex: 60,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
  },
  controlBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  endCallBtn: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
});
