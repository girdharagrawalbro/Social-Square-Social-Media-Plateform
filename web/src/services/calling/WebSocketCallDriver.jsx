import { socket } from '../../socket';
import { DEFAULT_ICE_SERVERS } from './types';

/**
 * Custom WebRTC Call Driver using Socket.io for signaling.
 * Handles 1-on-1 and Group calls (full mesh P2P).
 */
export class WebSocketCallDriver {
    constructor({ onStreamsUpdate, onConnectionStateChange, onError }) {
        this.onStreamsUpdate = onStreamsUpdate || (() => {});
        this.onConnectionStateChange = onConnectionStateChange || (() => {});
        this.onError = onError || (() => {});

        this.localStream = null;
        this.peerConnections = new Map(); // targetUserId -> RTCPeerConnection
        this.remoteStreams = new Map(); // targetUserId -> { stream, user }
        this.candidateQueues = new Map(); // targetUserId -> RTCIceCandidate[]

        this.conversationId = null;
        this.isGroup = false;
        this.callType = 'voice';
        this.currentUser = null;
        this.remoteUser = null;
        this.isHost = false;

        this._boundHandleSignal = this._handleSignal.bind(this);
        this._boundHandleUserJoined = this._handleUserJoined.bind(this);
        this._boundHandleUserLeft = this._handleUserLeft.bind(this);
        this._boundHandleExistingUsers = this._handleExistingUsers.bind(this);
    }

    async connect({ conversationId, isGroup, callType, user, remoteUser, isHost }) {
        this.conversationId = conversationId;
        this.isGroup = !!isGroup;
        this.callType = callType;
        this.currentUser = user;
        this.remoteUser = remoteUser;
        this.isHost = isHost;

        try {
            // 1. Acquire Local Media
            const constraints = {
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                },
                video: callType === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false,
            };

            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this._notifyStreams();

            // 2. Attach Socket Listeners
            socket.on('webrtc-signal', this._boundHandleSignal);

            if (this.isGroup) {
                socket.on('groupCallUserJoined', this._boundHandleUserJoined);
                socket.on('groupCallUserLeft', this._boundHandleUserLeft);
                socket.on('groupCallExistingUsers', this._boundHandleExistingUsers);

                socket.emit('joinGroupCall', {
                    conversationId: this.conversationId,
                    user: {
                        id: this.currentUser?._id || this.currentUser?.id,
                        fullname: this.currentUser?.fullname,
                        avatar: this.currentUser?.profile_picture || this.currentUser?.avatar,
                    },
                });
            } else {
                // 1-on-1 Call
                const targetId = this.remoteUser?.id || this.remoteUser?._id;
                if (this.isHost && targetId) {
                    // Host initiates offer to recipient
                    await this._createPeerConnection(targetId, true);
                }
            }

            this.onConnectionStateChange('connected');
        } catch (err) {
            console.error('[WebSocketCallDriver] Media / Connection error:', err);
            this.onError(err);
            this.disconnect();
            throw err;
        }
    }

    _createPeerConnection(targetUserId, isInitiator) {
        if (this.peerConnections.has(targetUserId)) {
            return this.peerConnections.get(targetUserId);
        }

        const pc = new RTCPeerConnection({
            iceServers: DEFAULT_ICE_SERVERS,
            iceCandidatePoolSize: 10,
        });

        this.peerConnections.set(targetUserId, pc);
        this.candidateQueues.set(targetUserId, []);

        // Add Local Tracks to PeerConnection
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => {
                pc.addTrack(track, this.localStream);
            });
        }

        // Handle Incoming Remote Tracks
        pc.ontrack = (event) => {
            console.log(`[WebSocketCallDriver] ontrack from ${targetUserId}:`, event.streams);
            let stream = event.streams[0];
            if (!stream) {
                stream = new MediaStream();
                stream.addTrack(event.track);
            }

            this.remoteStreams.set(targetUserId, {
                stream,
                user: this._findUserData(targetUserId),
            });
            this._notifyStreams();
        };

        // Handle ICE Candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('webrtc-signal', {
                    to: targetUserId,
                    conversationId: this.conversationId,
                    signal: {
                        type: 'candidate',
                        candidate: event.candidate,
                    },
                });
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log(`[WebSocketCallDriver] ICE state with ${targetUserId}: ${pc.iceConnectionState}`);
            if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') {
                // If 1-on-1 and failed, notify
                if (!this.isGroup && this.peerConnections.size <= 1) {
                    this.onConnectionStateChange('disconnected');
                }
            }
        };

        // If Initiator, create and send Offer
        if (isInitiator) {
            pc.onnegotiationneeded = async () => {
                try {
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: this.callType === 'video',
                    });
                    await pc.setLocalDescription(offer);
                    socket.emit('webrtc-signal', {
                        to: targetUserId,
                        conversationId: this.conversationId,
                        signal: {
                            type: 'offer',
                            sdp: pc.localDescription,
                        },
                    });
                } catch (err) {
                    console.error(`[WebSocketCallDriver] Offer creation failed for ${targetUserId}:`, err);
                }
            };
        }

        return pc;
    }

    async _handleSignal({ from, signal, conversationId }) {
        if (conversationId && this.conversationId && conversationId !== this.conversationId) return;
        if (!from) return;

        try {
            if (signal.type === 'offer') {
                const pc = this._createPeerConnection(from, false);
                await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                // Process any queued ICE candidates
                const queue = this.candidateQueues.get(from) || [];
                while (queue.length > 0) {
                    const cand = queue.shift();
                    await pc.addIceCandidate(new RTCIceCandidate(cand));
                }

                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);

                socket.emit('webrtc-signal', {
                    to: from,
                    conversationId: this.conversationId,
                    signal: {
                        type: 'answer',
                        sdp: pc.localDescription,
                    },
                });
            } else if (signal.type === 'answer') {
                const pc = this.peerConnections.get(from);
                if (pc) {
                    await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));

                    // Process any queued ICE candidates
                    const queue = this.candidateQueues.get(from) || [];
                    while (queue.length > 0) {
                        const cand = queue.shift();
                        await pc.addIceCandidate(new RTCIceCandidate(cand));
                    }
                }
            } else if (signal.type === 'candidate' && signal.candidate) {
                const pc = this.peerConnections.get(from);
                if (pc && pc.remoteDescription && pc.remoteDescription.type) {
                    await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
                } else {
                    const queue = this.candidateQueues.get(from) || [];
                    queue.push(signal.candidate);
                    this.candidateQueues.set(from, queue);
                }
            }
        } catch (err) {
            console.error(`[WebSocketCallDriver] Error handling signal from ${from}:`, err);
        }
    }

    async _handleExistingUsers({ participants }) {
        if (!Array.isArray(participants)) return;
        console.log('[WebSocketCallDriver] Existing group participants:', participants);

        for (const targetUserId of participants) {
            if (targetUserId && targetUserId !== (this.currentUser?._id || this.currentUser?.id)) {
                // Initiate peer connection and offer to existing peer
                const pc = this._createPeerConnection(targetUserId, true);
                try {
                    const offer = await pc.createOffer({
                        offerToReceiveAudio: true,
                        offerToReceiveVideo: this.callType === 'video',
                    });
                    await pc.setLocalDescription(offer);
                    socket.emit('webrtc-signal', {
                        to: targetUserId,
                        conversationId: this.conversationId,
                        signal: {
                            type: 'offer',
                            sdp: pc.localDescription,
                        },
                    });
                } catch (err) {
                    console.error(`[WebSocketCallDriver] Failed to connect to existing user ${targetUserId}:`, err);
                }
            }
        }
    }

    _handleUserJoined({ userId, user }) {
        console.log('[WebSocketCallDriver] New user joined group call:', userId, user);
        if (user) {
            this._storeUserData(userId, user);
        }
        // The newly joined user will send an offer via _handleExistingUsers; we await their offer
    }

    _handleUserLeft({ userId }) {
        console.log('[WebSocketCallDriver] User left group call:', userId);
        if (this.peerConnections.has(userId)) {
            const pc = this.peerConnections.get(userId);
            pc.close();
            this.peerConnections.delete(userId);
        }
        if (this.remoteStreams.has(userId)) {
            this.remoteStreams.delete(userId);
            this._notifyStreams();
        }
    }

    _storeUserData(userId, user) {
        if (!this._userMetaCache) this._userMetaCache = new Map();
        this._userMetaCache.set(userId, user);
    }

    _findUserData(userId) {
        if (this._userMetaCache?.has(userId)) {
            return this._userMetaCache.get(userId);
        }
        if (this.remoteUser && (this.remoteUser.id === userId || this.remoteUser._id === userId)) {
            return this.remoteUser;
        }
        return { id: userId, fullname: `Participant (${userId.slice(-4)})` };
    }

    _notifyStreams() {
        this.onStreamsUpdate({
            localStream: this.localStream,
            remoteStreams: new Map(this.remoteStreams),
        });
    }

    async setMicrophoneEnabled(enabled) {
        if (!this.localStream) return;
        const audioTracks = this.localStream.getAudioTracks();
        audioTracks.forEach((t) => {
            t.enabled = enabled;
        });
    }

    async setCameraEnabled(enabled) {
        if (!this.localStream) return;
        const videoTracks = this.localStream.getVideoTracks();
        if (videoTracks.length > 0) {
            videoTracks.forEach((t) => {
                t.enabled = enabled;
            });
        } else if (enabled) {
            try {
                const videoStream = await navigator.mediaDevices.getUserMedia({
                    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                });
                const newTrack = videoStream.getVideoTracks()[0];
                this.localStream.addTrack(newTrack);
                this.peerConnections.forEach((pc) => {
                    pc.addTrack(newTrack, this.localStream);
                });
                this._notifyStreams();
            } catch (e) {
                console.error('[WebSocketCallDriver] Failed to add video track:', e);
            }
        }
    }

    disconnect() {
        // Stop all local tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach((track) => track.stop());
            this.localStream = null;
        }

        // Close all peer connections
        this.peerConnections.forEach((pc) => pc.close());
        this.peerConnections.clear();
        this.remoteStreams.clear();
        this.candidateQueues.clear();

        // Remove socket event listeners
        socket.off('webrtc-signal', this._boundHandleSignal);
        socket.off('groupCallUserJoined', this._boundHandleUserJoined);
        socket.off('groupCallUserLeft', this._boundHandleUserLeft);
        socket.off('groupCallExistingUsers', this._boundHandleExistingUsers);

        if (this.isGroup && this.conversationId) {
            socket.emit('leaveGroupCall', { conversationId: this.conversationId });
        }

        this._notifyStreams();
        this.onConnectionStateChange('disconnected');
    }
}
