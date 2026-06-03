import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';
import toast from 'react-hot-toast';
import { LiveKitRoom, RoomAudioRenderer, useTracks, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { Track, setLogLevel } from 'livekit-client';
import '@livekit/components-styles';

setLogLevel('silent');

// Web Audio API Ringtone / Dial-tone Synthesizer (Zero asset dependencies!)
class CallSynth {
    constructor() {
        this.ctx = null;
        this.interval = null;
    }

    startDialTone() {
        this.stop();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        const playBeep = () => {
            if (!this.ctx) return;
            const osc1 = this.ctx.createOscillator();
            const osc2 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.frequency.value = 440;
            osc2.frequency.value = 480;

            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.15, this.ctx.currentTime + 0.1);
            gain.gain.setValueAtTime(0.15, this.ctx.currentTime + 2.0);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 2.1);

            osc1.connect(gain);
            osc2.connect(gain);
            gain.connect(this.ctx.destination);

            osc1.start();
            osc2.start();

            setTimeout(() => {
                try {
                    osc1.stop();
                    osc2.stop();
                } catch (e) { }
            }, 2200);
        };

        playBeep();
        this.interval = setInterval(playBeep, 4000);
    }

    startRingTone() {
        this.stop();
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        const playRing = () => {
            if (!this.ctx) return;
            const osc1 = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(453, this.ctx.currentTime);
            // Warble effect
            const modulator = this.ctx.createOscillator();
            const modulatorGain = this.ctx.createGain();
            modulator.frequency.value = 20;
            modulatorGain.gain.value = 30;

            modulator.connect(modulatorGain);
            modulatorGain.connect(osc1.frequency);

            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime + 0.4);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.45);
            gain.gain.setValueAtTime(0, this.ctx.currentTime + 0.6);
            gain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.65);
            gain.gain.setValueAtTime(0.2, this.ctx.currentTime + 1.05);
            gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.1);

            osc1.connect(gain);
            gain.connect(this.ctx.destination);

            modulator.start();
            osc1.start();

            setTimeout(() => {
                try {
                    modulator.stop();
                    osc1.stop();
                } catch (e) { }
            }, 1200);
        };

        playRing();
        this.interval = setInterval(playRing, 3000);
    }

    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        if (this.ctx) {
            try {
                this.ctx.close();
            } catch (e) { }
            this.ctx = null;
        }
    }
}

const callSynth = new CallSynth();

// ─── CallInner Component ───
const CallInner = ({ conversationId, callType, remoteUser, isHost, onClose }) => {
    const { localParticipant } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants();
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');

    // Fetch local and remote camera tracks
    const localTracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: false }],
        { onlySubscribed: false }
    );
    const remoteTracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: false }],
        { onlySubscribed: true }
    );

    const activeLocalTrackRef = localTracks.find(t => t.participant?.isLocal);
    const activeLocalTrack = activeLocalTrackRef?.publication?.track ?? null;

    const activeRemoteTrackRef = remoteTracks.find(t => !t.participant?.isLocal);
    const activeRemoteTrack = activeRemoteTrackRef?.publication?.track ?? null;

    // Attach local track
    useEffect(() => {
        const videoEl = localVideoRef.current;
        if (!activeLocalTrack || !videoEl || isVideoOff) return;
        activeLocalTrack.attach(videoEl);
        return () => {
            try { activeLocalTrack.detach(videoEl); } catch (e) { }
        };
    }, [activeLocalTrack, isVideoOff]);

    // Attach remote track
    useEffect(() => {
        const videoEl = remoteVideoRef.current;
        if (!activeRemoteTrack || !videoEl) return;
        activeRemoteTrack.attach(videoEl);
        return () => {
            try { activeRemoteTrack.detach(videoEl); } catch (e) { }
        };
    }, [activeRemoteTrack]);

    // Publish local media
    useEffect(() => {
        if (localParticipant) {
            localParticipant.setMicrophoneEnabled(true);
            if (callType === 'video') {
                localParticipant.setCameraEnabled(true);
            }
        }
    }, [localParticipant, callType]);

    const handleMuteToggle = async () => {
        if (!localParticipant) return;
        const next = !isMuted;
        await localParticipant.setMicrophoneEnabled(!next);
        setIsMuted(next);
    };

    const handleVideoToggle = async () => {
        if (!localParticipant || callType === 'voice') return;
        const next = !isVideoOff;
        await localParticipant.setCameraEnabled(!next);
        setIsVideoOff(next);
    };

    const isConnected = remoteParticipants.length > 0;
    const [secondsElapsed, setSecondsElapsed] = useState(0);

    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(() => {
            setSecondsElapsed(prev => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isConnected]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#090a0f', justifyContent: 'space-between' }}>
            {/* Elegant Floating Header for Call Status / Timer */}
            <div style={{ zIndex: 100, position: 'absolute', top: '24px', left: '24px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ background: 'rgba(9, 10, 15, 0.6)', backdropFilter: 'blur(12px)', padding: '6px 14px', borderRadius: '20px', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: isConnected ? '#10b981' : '#f59e0b' }} />
                    <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>
                        {isConnected ? formatTime(secondsElapsed) : 'Connecting...'}
                    </span>
                </div>
            </div>

            {/* Background Stream View */}
            <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {callType === 'video' && isConnected && activeRemoteTrack ? (
                    <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', zIndex: 10 }}>
                        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #ec4899)', padding: '4px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
                            <img src={remoteUser?.avatar || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '3px solid #090a0f' }} />
                        </div>
                        <div style={{ textAlign: 'center' }}>
                            <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 800, margin: '0 0 6px' }}>{remoteUser?.fullname}</h2>
                            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>
                                {isConnected ? `Call Connected • ${formatTime(secondsElapsed)}` : 'Connecting Audio/Video...'}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Local Video Thumbnail Overlay (for Video Calls) */}
            {callType === 'video' && !isVideoOff && (
                <div style={{ position: 'absolute', top: '24px', right: '24px', width: '100px', height: '150px', borderRadius: '16px', border: '2px solid rgba(255,255,255,0.2)', overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', background: '#111', zIndex: 50 }}>
                    <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
            )}

            {/* Control Panel Footer */}
            <div style={{
                zIndex: 60, width: '100%', padding: '24px 0 40px',
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px',
                marginTop: 'auto'
            }}>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                    {/* Audio Mute Button */}
                    <button onClick={handleMuteToggle} style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                    }}>
                        <i className={`pi ${isMuted ? 'pi-volume-off' : 'pi-volume-up'}`} style={{ fontSize: '20px' }} />
                    </button>

                    {/* End Call Button */}
                    <button onClick={onClose} style={{
                        width: '68px', height: '68px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 8px 24px rgba(239, 68, 68, 0.4)', transition: 'all 0.2s'
                    }}>
                        <i className="pi pi-phone" style={{ fontSize: '24px', transform: 'rotate(135deg)' }} />
                    </button>

                    {/* Camera Toggle Button */}
                    <button onClick={handleVideoToggle} disabled={callType === 'voice'} style={{
                        width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                        background: isVideoOff ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.15)',
                        backdropFilter: 'blur(10px)', color: callType === 'voice' ? 'rgba(255,255,255,0.2)' : '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s'
                    }}>
                        <i className={`pi ${isVideoOff ? 'pi-video' : 'pi-video'}`} style={{ fontSize: '20px', opacity: isVideoOff ? 0.4 : 1 }} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main CallModal Component ───
const CallModal = ({
    conversationId, recipientId, recipientName, recipientAvatar,
    callerId, callerName, callerAvatar, callType,
    isIncoming: initialIsIncoming, onClose
}) => {
    const [callStatus, setCallStatus] = useState(initialIsIncoming ? 'incoming' : 'calling');
    const [token, setToken] = useState(null);
    const [liveKitUrl] = useState(process.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880');
    const fetchInitiated = useRef(false);

    // Identity resolved
    const remoteUser = initialIsIncoming
        ? { id: callerId, fullname: callerName, avatar: callerAvatar }
        : { id: recipientId, fullname: recipientName, avatar: recipientAvatar };

    // Dial-tone or ringtone playback based on status
    useEffect(() => {
        if (callStatus === 'calling') {
            callSynth.startDialTone();
        } else if (callStatus === 'incoming') {
            callSynth.startRingTone();
        } else {
            callSynth.stop();
        }
        return () => callSynth.stop();
    }, [callStatus]);

    // Handle Socket Call Events
    useEffect(() => {
        const handleCallAccepted = ({ receiverId, conversationId: acceptedConvId }) => {
            console.log('[Socket] Call Accepted by:', receiverId);
            setCallStatus('connecting');
        };

        const handleCallDeclined = () => {
            console.log('[Socket] Call Declined');
            toast.error('Call declined');
            onClose();
        };

        const handleCallEnded = () => {
            console.log('[Socket] Call Ended');
            toast.success('Call ended');
            onClose();
        };

        socket.on('callAccepted', handleCallAccepted);
        socket.on('callDeclined', handleCallDeclined);
        socket.on('callEnded', handleCallEnded);

        return () => {
            socket.off('callAccepted', handleCallAccepted);
            socket.off('callDeclined', handleCallDeclined);
            socket.off('callEnded', handleCallEnded);
        };
    }, [onClose]);

    // Fetch LiveKit Token upon acceptance / connection
    useEffect(() => {
        if (callStatus !== 'connecting' || fetchInitiated.current) return;
        fetchInitiated.current = true;

        const fetchToken = async () => {
            try {
                const res = await api.post(`/api/conversation/call/token`, { conversationId });
                setToken(res.data.token);
                setCallStatus('connected');
            } catch (err) {
                console.error('[CallModal] Token generation failed:', err);
                toast.error('Failed to establish media server credentials');
                onClose();
            }
        };

        fetchToken();
    }, [callStatus, conversationId, onClose]);

    const handleAccept = () => {
        socket.emit('acceptCall', { callerId: remoteUser.id, conversationId });
        setCallStatus('connecting');
    };

    const handleDecline = () => {
        socket.emit('declineCall', { callerId: remoteUser.id });
        onClose();
    };

    const handleHangUp = () => {
        socket.emit('endCall', { recipientId: remoteUser.id, conversationId });
        onClose();
    };

    // Render Overlay Views
    if (callStatus === 'incoming') {
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-between py-24 px-8 text-center backdrop-blur-md">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '12px', color: '#808bf5', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>Incoming {callType} Call</span>
                    <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #ec4899)', padding: '4px', margin: '20px 0', animation: 'pulseRing 2s infinite' }}>
                        <img src={remoteUser.avatar || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '4px solid #000' }} />
                    </div>
                    <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: 0 }}>{remoteUser.fullname}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Calling you...</p>
                </div>

                <div style={{ display: 'flex', gap: '48px', alignItems: 'center' }}>
                    {/* Decline Button */}
                    <button onClick={handleDecline} style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4)' }}>
                        <i className="pi pi-phone" style={{ fontSize: '24px', transform: 'rotate(135deg)' }} />
                    </button>
                    {/* Accept Button */}
                    <button onClick={handleAccept} style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(16, 185, 129, 0.4)' }}>
                        <i className="pi pi-phone" style={{ fontSize: '24px' }} />
                    </button>
                </div>

                <style>{`
                    @keyframes pulseRing {
                        0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(128, 139, 245, 0.5); }
                        70% { transform: scale(1); box-shadow: 0 0 0 20px rgba(128, 139, 245, 0); }
                        100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(128, 139, 245, 0); }
                    }
                `}</style>
            </div>
        );
    }

    if (callStatus === 'calling') {
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-between py-24 px-8 text-center backdrop-blur-md">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
                    <span style={{ fontSize: '12px', color: '#808bf5', fontWeight: 800, letterSpacing: '2px', textTransform: 'uppercase' }}>Calling...</span>
                    <div style={{ width: 140, height: 140, borderRadius: '50%', background: 'linear-gradient(135deg, #808bf5, #ec4899)', padding: '4px', margin: '20px 0', animation: 'callingPulse 2.5s infinite' }}>
                        <img src={remoteUser.avatar || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '4px solid #000' }} />
                    </div>
                    <h1 style={{ color: '#fff', fontSize: '24px', fontWeight: 800, margin: 0 }}>{remoteUser.fullname}</h1>
                    <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', margin: 0 }}>Ringing your phone...</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {/* Hang Up Button */}
                    <button onClick={handleHangUp} style={{ width: '72px', height: '72px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#ef4444', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 32px rgba(239, 68, 68, 0.4)' }}>
                        <i className="pi pi-phone" style={{ fontSize: '24px', transform: 'rotate(135deg)' }} />
                    </button>
                </div>

                <style>{`
                    @keyframes callingPulse {
                        0% { transform: scale(1); opacity: 0.9; }
                        50% { transform: scale(1.04); opacity: 1; }
                        100% { transform: scale(1); opacity: 0.9; }
                    }
                `}</style>
            </div>
        );
    }

    if (callStatus === 'connecting') {
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-center text-center p-10 gap-6 backdrop-blur-md">
                <div className="w-16 h-16 rounded-full border-4 border-[#808bf5]/30 border-t-[#808bf5] animate-spin" />
                <h2 style={{ color: '#fff', fontSize: '20px', fontWeight: 700, margin: 0 }}>Securing Connection</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '14px', margin: 0 }}>Establishing secure audio/video channel...</p>
            </div>
        );
    }

    if (callStatus === 'connected' && token) {
        return (
            <div className="fixed inset-0 z-[99999] overflow-hidden">
                <LiveKitRoom
                    video={callType === 'video'}
                    audio={true}
                    token={token}
                    serverUrl={liveKitUrl}
                    connectOptions={{ autoSubscribe: true }}
                    options={{ adaptiveStream: true, dynacast: true }}
                >
                    <RoomAudioRenderer />
                    <CallInner
                        conversationId={conversationId}
                        callType={callType}
                        remoteUser={remoteUser}
                        isHost={!initialIsIncoming}
                        onClose={handleHangUp}
                    />
                </LiveKitRoom>
            </div>
        );
    }

    return null;
};

export default CallModal;
