import { Room, RoomEvent, setLogLevel } from 'livekit-client';

setLogLevel('silent');

/**
 * LiveKit Call Driver using livekit-client SDK.
 * Wraps LiveKit SFU into the exact same interface contract as WebSocketCallDriver.
 */
export class LiveKitCallDriver {
    constructor({ onStreamsUpdate, onConnectionStateChange, onError }) {
        this.onStreamsUpdate = onStreamsUpdate || (() => {});
        this.onConnectionStateChange = onConnectionStateChange || (() => {});
        this.onError = onError || (() => {});

        this.room = null;
        this.localStream = null;
        this.remoteStreams = new Map(); // identity -> { stream, user }

        this.conversationId = null;
        this.isGroup = false;
        this.callType = 'voice';
        this.currentUser = null;
        this.remoteUser = null;
    }

    async connect({ conversationId, isGroup, callType, user, remoteUser, token, liveKitUrl }) {
        this.conversationId = conversationId;
        this.isGroup = !!isGroup;
        this.callType = callType;
        this.currentUser = user;
        this.remoteUser = remoteUser;

        const serverUrl = liveKitUrl || import.meta.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880';

        try {
            this.room = new Room({
                adaptiveStream: true,
                dynacast: true,
                publishDefaults: {
                    simulcast: true,
                },
            });

            // 1. Setup LiveKit Event Listeners
            this.room.on(RoomEvent.Connected, () => {
                console.log('[LiveKitCallDriver] Connected to room:', conversationId);
                this.onConnectionStateChange('connected');
                this._syncLocalStream();
            });

            this.room.on(RoomEvent.Disconnected, () => {
                console.log('[LiveKitCallDriver] Disconnected from room');
                this.onConnectionStateChange('disconnected');
            });

            this.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
                console.log(`[LiveKitCallDriver] Track subscribed: ${track.kind} from ${participant.identity}`);
                this._handleRemoteTrackSubscribed(track, participant);
            });

            this.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
                console.log(`[LiveKitCallDriver] Track unsubscribed: ${track.kind} from ${participant.identity}`);
                this._handleRemoteTrackUnsubscribed(track, participant);
            });

            this.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
                console.log(`[LiveKitCallDriver] Participant disconnected: ${participant.identity}`);
                this.remoteStreams.delete(participant.identity);
                this._notifyStreams();
            });

            // 2. Connect to LiveKit SFU Room
            await this.room.connect(serverUrl, token);

            // 3. Publish Local Audio & Video Tracks
            await this.room.localParticipant.setMicrophoneEnabled(true);
            if (callType === 'video') {
                await this.room.localParticipant.setCameraEnabled(true);
            }

            this._syncLocalStream();
        } catch (err) {
            console.error('[LiveKitCallDriver] Error connecting to LiveKit room:', err);
            this.onError(err);
            this.disconnect();
            throw err;
        }
    }

    _syncLocalStream() {
        if (!this.room || !this.room.localParticipant) return;
        const stream = new MediaStream();

        this.room.localParticipant.trackPublications.forEach((pub) => {
            if (pub.track && pub.track.mediaStreamTrack) {
                stream.addTrack(pub.track.mediaStreamTrack);
            }
        });

        this.localStream = stream;
        this._notifyStreams();
    }

    _handleRemoteTrackSubscribed(track, participant) {
        const id = participant.identity;
        let entry = this.remoteStreams.get(id);

        if (!entry) {
            const stream = new MediaStream();
            let userData = null;
            try {
                userData = participant.metadata ? JSON.parse(participant.metadata) : null;
            } catch (e) {}

            entry = {
                stream,
                user: userData || this._resolveParticipantUser(participant),
            };
            this.remoteStreams.set(id, entry);
        }

        if (track.mediaStreamTrack) {
            // Avoid duplicate track
            const existing = entry.stream.getTracks().find((t) => t.id === track.mediaStreamTrack.id);
            if (!existing) {
                entry.stream.addTrack(track.mediaStreamTrack);
            }
        }

        this._notifyStreams();
    }

    _handleRemoteTrackUnsubscribed(track, participant) {
        const id = participant.identity;
        const entry = this.remoteStreams.get(id);
        if (entry && track.mediaStreamTrack) {
            entry.stream.removeTrack(track.mediaStreamTrack);
            if (entry.stream.getTracks().length === 0) {
                this.remoteStreams.delete(id);
            }
        }
        this._notifyStreams();
    }

    _resolveParticipantUser(participant) {
        if (this.remoteUser && (this.remoteUser.id === participant.identity || this.remoteUser.username === participant.identity)) {
            return this.remoteUser;
        }
        return {
            id: participant.identity,
            fullname: participant.name || participant.identity,
        };
    }

    _notifyStreams() {
        this.onStreamsUpdate({
            localStream: this.localStream,
            remoteStreams: new Map(this.remoteStreams),
        });
    }

    async setMicrophoneEnabled(enabled) {
        if (this.room && this.room.localParticipant) {
            await this.room.localParticipant.setMicrophoneEnabled(enabled);
            this._syncLocalStream();
        }
    }

    async setCameraEnabled(enabled) {
        if (this.room && this.room.localParticipant) {
            await this.room.localParticipant.setCameraEnabled(enabled);
            this._syncLocalStream();
        }
    }

    disconnect() {
        if (this.room) {
            try {
                this.room.disconnect();
            } catch (e) {
                console.warn('[LiveKitCallDriver] Disconnect error:', e);
            }
            this.room = null;
        }
        this.localStream = null;
        this.remoteStreams.clear();
        this._notifyStreams();
        this.onConnectionStateChange('disconnected');
    }
}
