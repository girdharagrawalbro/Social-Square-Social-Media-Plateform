import React, { useEffect, useRef, useState } from 'react';
import { socket } from '../../socket';
import useAuthStore, { api } from '../../store/zustand/useAuthStore';
import toast from '../../utils/toast.js';
import { USER_DEFAULT_IMAGE } from '../../utils/constantMediaVariable';
import { useCallEngine } from '../../services/calling/useCallEngine';
import { CALL_PROVIDERS } from '../../services/calling/types';

// Web Audio API Ringtone / Dial-tone Synthesizer
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
                } catch (e) {}
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
                } catch (e) {}
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
            } catch (e) {}
            this.ctx = null;
        }
    }
}

const callSynth = new CallSynth();

/**
 * Reusable Media Video / Avatar Stream Tile
 */
const StreamTile = ({ stream, isLocal = false, user, isVideoOff = false, callType = 'video' }) => {
    const videoRef = useRef(null);
    const [hasActiveVideo, setHasActiveVideo] = useState(false);

    useEffect(() => {
        if (!videoRef.current || !stream) return;
        videoRef.current.srcObject = stream;

        const checkTracks = () => {
            const vTracks = stream.getVideoTracks();
            const hasLive = vTracks.some((t) => t.enabled && t.readyState === 'live');
            setHasActiveVideo(hasLive && !isVideoOff && callType === 'video');
        };

        checkTracks();
        stream.onaddtrack = checkTracks;
        stream.onremovetrack = checkTracks;
    }, [stream, isVideoOff, callType]);

    return (
        <div className="relative w-full h-full bg-[#11121a] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl group transition-all duration-300">
            {/* Native Video Element */}
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isLocal} // Always mute local video playback to prevent audio feedback
                className={`w-full h-full object-cover transition-opacity duration-300 ${hasActiveVideo ? 'opacity-100' : 'opacity-0 absolute'}`}
            />

            {/* Fallback Animated Avatar Card */}
            {!hasActiveVideo && (
                <div className="flex flex-col items-center justify-center gap-3 p-4 z-10 text-center">
                    <div className="relative">
                        <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-xl animate-pulse">
                            <img
                                src={user?.avatar || user?.profile_picture || USER_DEFAULT_IMAGE}
                                alt=""
                                className="w-full h-full rounded-full object-cover border-2 border-[#11121a]"
                            />
                        </div>
                        {isLocal && (
                            <span className="absolute bottom-0 right-0 bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full border border-black">
                                YOU
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col items-center">
                        <h4 className="text-white text-sm font-black m-0 tracking-wide drop-shadow-md">
                            {isLocal ? 'You (Microphone On)' : user?.fullname || 'Participant'}
                        </h4>
                        <span className="text-white/40 text-xs mt-0.5 font-medium">
                            {callType === 'voice' ? 'Voice Active' : 'Camera Off'}
                        </span>
                    </div>
                </div>
            )}

            {/* Bottom Overlay Label */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-white text-xs font-semibold flex items-center gap-2 border border-white/10 z-20">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
                <span>{isLocal ? 'You' : user?.fullname || 'Participant'}</span>
            </div>
        </div>
    );
};

/**
 * Active Connected Call View (Works for 1-on-1 and Group Calls)
 */
const ActiveCallView = ({
    conversationId,
    isGroup,
    groupName,
    callType,
    currentUser,
    remoteUser,
    isHost,
    token,
    liveKitUrl,
    providerOverride,
    onClose,
}) => {
    const {
        provider,
        localStream,
        remoteStreams,
        isConnected,
        isMuted,
        isVideoOff,
        toggleMute,
        toggleVideo,
        endCall,
    } = useCallEngine({
        conversationId,
        isGroup,
        callType,
        user: currentUser,
        remoteUser,
        isHost,
        token,
        liveKitUrl,
        provider: providerOverride,
        onEnded: onClose,
    });

    const [secondsElapsed, setSecondsElapsed] = useState(0);

    useEffect(() => {
        if (!isConnected) return;
        const interval = setInterval(() => {
            setSecondsElapsed((prev) => prev + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, [isConnected]);

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    // Calculate grid classes based on participant count
    const totalParticipants = 1 + remoteStreams.length;
    let gridLayoutClass = 'grid-cols-1';
    if (totalParticipants === 2) gridLayoutClass = 'grid-cols-1 sm:grid-cols-2';
    else if (totalParticipants >= 3 && totalParticipants <= 4) gridLayoutClass = 'grid-cols-1 sm:grid-cols-2';
    else if (totalParticipants > 4) gridLayoutClass = 'grid-cols-2 sm:grid-cols-3';

    return (
        <div className="relative w-full h-full flex flex-col bg-[#090a0f] overflow-hidden select-none">
            {/* Top Floating Header */}
            <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-50 pointer-events-none">
                {/* Call Timer & Status Badge */}
                <div className="flex items-center gap-3 pointer-events-auto">
                    <div className="bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 flex items-center gap-2.5 shadow-xl">
                        <div className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                        <span className="text-white text-xs font-bold tracking-wider uppercase">
                            {isConnected ? formatTime(secondsElapsed) : 'Connecting Media...'}
                        </span>
                    </div>

                    {/* Engine Indicator */}
                    <div className="bg-indigo-500/20 backdrop-blur-xl px-3 py-2 rounded-2xl border border-indigo-500/30 flex items-center gap-2">
                        <i className={`pi ${provider === CALL_PROVIDERS.LIVEKIT ? 'pi-cloud' : 'pi-bolt'} text-indigo-400 text-xs`} />
                        <span className="text-indigo-300 text-[11px] font-extrabold uppercase tracking-wider">
                            {provider === CALL_PROVIDERS.LIVEKIT ? 'LiveKit SFU' : 'P2P WebRTC'}
                        </span>
                    </div>
                </div>

                {/* Call Title */}
                <div className="hidden sm:flex bg-black/60 backdrop-blur-xl px-4 py-2 rounded-2xl border border-white/10 text-white text-xs font-bold shadow-xl">
                    {isGroup ? (groupName || 'Group Call') : (remoteUser?.fullname || 'Direct Call')}
                </div>
            </div>

            {/* Main Stream Area */}
            <div className="flex-1 w-full h-full p-4 sm:p-8 pt-20 pb-28 flex items-center justify-center overflow-y-auto">
                {!isGroup && remoteStreams.length === 1 ? (
                    // 1-on-1 Call Optimized View
                    <div className="relative w-full h-full max-w-5xl rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center">
                        <StreamTile
                            stream={remoteStreams[0].stream}
                            isLocal={false}
                            user={remoteStreams[0].user}
                            callType={callType}
                        />

                        {/* Local Picture-in-Picture Thumbnail */}
                        <div className="absolute top-4 right-4 w-32 h-44 sm:w-44 sm:h-60 rounded-2xl overflow-hidden border-2 border-white/20 shadow-2xl z-30">
                            <StreamTile
                                stream={localStream}
                                isLocal={true}
                                user={currentUser}
                                isVideoOff={isVideoOff}
                                callType={callType}
                            />
                        </div>
                    </div>
                ) : (
                    // Group Call Grid View
                    <div className={`grid ${gridLayoutClass} gap-4 w-full h-full max-w-6xl auto-rows-fr items-stretch justify-items-stretch`}>
                        {/* Local Stream Tile */}
                        <div className="min-h-[180px] h-full w-full">
                            <StreamTile
                                stream={localStream}
                                isLocal={true}
                                user={currentUser}
                                isVideoOff={isVideoOff}
                                callType={callType}
                            />
                        </div>

                        {/* Remote Stream Tiles */}
                        {remoteStreams.map((r) => (
                            <div key={r.id} className="min-h-[180px] h-full w-full">
                                <StreamTile
                                    stream={r.stream}
                                    isLocal={false}
                                    user={r.user}
                                    callType={callType}
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Floating Footer Control Bar */}
            <div className="absolute bottom-6 inset-x-0 flex items-center justify-center gap-6 z-50 pointer-events-none">
                <div className="bg-black/70 backdrop-blur-2xl px-6 py-3 rounded-full border border-white/10 flex items-center gap-5 shadow-2xl pointer-events-auto">
                    {/* Microphone Toggle */}
                    <button
                        onClick={toggleMute}
                        className={`w-13 h-13 rounded-full border-0 cursor-pointer flex items-center justify-center transition-all duration-200 ${
                            isMuted ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                        title={isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
                        style={{ width: '52px', height: '52px' }}
                    >
                        <i className={`pi ${isMuted ? 'pi-volume-off' : 'pi-volume-up'} text-lg`} />
                    </button>

                    {/* Hang Up Button */}
                    <button
                        onClick={() => {
                            endCall();
                            onClose();
                        }}
                        className="w-16 h-16 rounded-full border-0 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center cursor-pointer shadow-xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all duration-200"
                        title="End Call"
                        style={{ width: '64px', height: '64px' }}
                    >
                        <i className="pi pi-phone text-2xl" style={{ transform: 'rotate(135deg)' }} />
                    </button>

                    {/* Camera Toggle */}
                    <button
                        onClick={toggleVideo}
                        disabled={callType === 'voice'}
                        className={`w-13 h-13 rounded-full border-0 cursor-pointer flex items-center justify-center transition-all duration-200 ${
                            callType === 'voice'
                                ? 'opacity-30 cursor-not-allowed bg-white/5 text-white/40'
                                : isVideoOff
                                ? 'bg-white/10 text-white/50 hover:bg-white/20'
                                : 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                        }`}
                        title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                        style={{ width: '52px', height: '52px' }}
                    >
                        <i className={`pi ${isVideoOff ? 'pi-video' : 'pi-video'} text-lg`} />
                    </button>
                </div>
            </div>
        </div>
    );
};

/**
 * Top-Level Unified Call Modal
 */
const CallModal = ({
    conversationId,
    recipientId,
    recipientName,
    recipientAvatar,
    callerId,
    callerName,
    callerAvatar,
    groupName,
    isGroup = false,
    callType = 'voice',
    isIncoming: initialIsIncoming = false,
    onClose,
}) => {
    const user = useAuthStore((s) => s.user);
    const [callStatus, setCallStatus] = useState(initialIsIncoming ? 'incoming' : 'calling');
    const [token, setToken] = useState(null);
    const [provider, setProvider] = useState(process.env.REACT_APP_CALL_PROVIDER || CALL_PROVIDERS.WEBSOCKET);
    const [liveKitUrl, setLiveKitUrl] = useState(process.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880');
    const fetchInitiated = useRef(false);

    // Identify remote user details
    const remoteUser = initialIsIncoming
        ? { id: callerId, _id: callerId, fullname: callerName, avatar: callerAvatar }
        : { id: recipientId, _id: recipientId, fullname: recipientName, avatar: recipientAvatar };

    // Dialtone / Ringtone synthesizer triggers
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

    // Handle Socket Signal Handlers
    useEffect(() => {
        const handleCallAccepted = () => {
            console.log('[CallModal] Call accepted by peer');
            setCallStatus('connecting');
        };

        const handleCallDeclined = () => {
            console.log('[CallModal] Call declined');
            toast.error('Call was declined');
            onClose();
        };

        const handleCallEnded = () => {
            console.log('[CallModal] Call ended');
            toast.success('Call ended');
            onClose();
        };

        const handleGroupCallEnded = () => {
            console.log('[CallModal] Group call ended');
            toast.success('Group call ended');
            onClose();
        };

        socket.on('callAccepted', handleCallAccepted);
        socket.on('callDeclined', handleCallDeclined);
        socket.on('callEnded', handleCallEnded);
        socket.on('groupCallEnded', handleGroupCallEnded);

        return () => {
            socket.off('callAccepted', handleCallAccepted);
            socket.off('callDeclined', handleCallDeclined);
            socket.off('callEnded', handleCallEnded);
            socket.off('groupCallEnded', handleGroupCallEnded);
        };
    }, [onClose]);

    // Auto-connect for group calls or outgoing calls once accepted
    useEffect(() => {
        if (isGroup && !initialIsIncoming && callStatus === 'calling') {
            setCallStatus('connecting');
        }
    }, [isGroup, initialIsIncoming, callStatus]);

    // Setup Token & Provider upon connection
    useEffect(() => {
        if (callStatus !== 'connecting' || fetchInitiated.current) return;
        fetchInitiated.current = true;

        const setupCallingSession = async () => {
            try {
                // Fetch provider setting from server
                const providerRes = await api.get('/api/conversation/call/provider');
                const resolvedProvider = process.env.REACT_APP_CALL_PROVIDER || providerRes.data?.provider || CALL_PROVIDERS.WEBSOCKET;
                setProvider(resolvedProvider);
                if (providerRes.data?.livekitUrl) setLiveKitUrl(providerRes.data.livekitUrl);

                if (resolvedProvider === CALL_PROVIDERS.LIVEKIT) {
                    const tokenRes = await api.post('/api/conversation/call/token', { conversationId });
                    setToken(tokenRes.data.token);
                }

                setCallStatus('connected');
            } catch (err) {
                console.warn('[CallModal] Token/Provider query failed, falling back to WebSocket:', err.message);
                setProvider(CALL_PROVIDERS.WEBSOCKET);
                setCallStatus('connected');
            }
        };

        setupCallingSession();
    }, [callStatus, conversationId]);

    const handleAccept = () => {
        if (isGroup) {
            setCallStatus('connecting');
        } else {
            socket.emit('acceptCall', { callerId: remoteUser.id, conversationId });
            setCallStatus('connecting');
        }
    };

    const handleDecline = () => {
        if (!isGroup) {
            socket.emit('declineCall', { callerId: remoteUser.id, conversationId });
        }
        onClose();
    };

    const handleHangUp = () => {
        if (isGroup) {
            socket.emit('leaveGroupCall', { conversationId });
        } else {
            socket.emit('endCall', { recipientId: remoteUser.id, conversationId });
        }
        onClose();
    };

    // ─── Render Incoming Screen ───
    if (callStatus === 'incoming') {
        const title = isGroup ? (groupName || 'Group Call') : (remoteUser.fullname || 'Direct Call');
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-between py-24 px-8 text-center backdrop-blur-md">
                <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in duration-300">
                    <span className="text-indigo-400 text-xs font-black tracking-widest uppercase bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
                        Incoming {isGroup ? 'Group ' : ''}{callType} Call
                    </span>
                    <div className="w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl animate-bounce">
                        <img
                            src={remoteUser.avatar || USER_DEFAULT_IMAGE}
                            alt=""
                            className="w-full h-full rounded-full object-cover border-4 border-black"
                        />
                    </div>
                    <div>
                        <h1 className="text-white text-2xl font-black m-0 mb-1">{title}</h1>
                        <p className="text-white/50 text-sm m-0">
                            {isGroup ? `${callerName || 'Someone'} started a group call` : 'Calling you...'}
                        </p>
                    </div>
                </div>

                <div className="flex gap-12 items-center">
                    <button
                        onClick={handleDecline}
                        className="w-18 h-18 rounded-full border-0 cursor-pointer bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all"
                        style={{ width: '72px', height: '72px' }}
                    >
                        <i className="pi pi-phone text-2xl" style={{ transform: 'rotate(135deg)' }} />
                    </button>
                    <button
                        onClick={handleAccept}
                        className="w-18 h-18 rounded-full border-0 cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-white flex items-center justify-center shadow-2xl shadow-emerald-500/40 hover:scale-105 active:scale-95 transition-all"
                        style={{ width: '72px', height: '72px' }}
                    >
                        <i className="pi pi-phone text-2xl" />
                    </button>
                </div>
            </div>
        );
    }

    // ─── Render Outgoing Calling Screen ───
    if (callStatus === 'calling') {
        const title = isGroup ? (groupName || 'Group Call') : (remoteUser.fullname || 'Direct Call');
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-between py-24 px-8 text-center backdrop-blur-md">
                <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in duration-300">
                    <span className="text-indigo-400 text-xs font-black tracking-widest uppercase bg-indigo-500/10 px-4 py-1.5 rounded-full border border-indigo-500/20">
                        Calling {isGroup ? 'Group...' : '...'}
                    </span>
                    <div className="w-36 h-36 rounded-full p-1 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 shadow-2xl animate-pulse">
                        <img
                            src={remoteUser.avatar || USER_DEFAULT_IMAGE}
                            alt=""
                            className="w-full h-full rounded-full object-cover border-4 border-black"
                        />
                    </div>
                    <div>
                        <h1 className="text-white text-2xl font-black m-0 mb-1">{title}</h1>
                        <p className="text-white/50 text-sm m-0">Ringing...</p>
                    </div>
                </div>

                <button
                    onClick={handleHangUp}
                    className="w-18 h-18 rounded-full border-0 cursor-pointer bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-2xl shadow-red-600/40 hover:scale-105 active:scale-95 transition-all"
                    style={{ width: '72px', height: '72px' }}
                >
                    <i className="pi pi-phone text-2xl" style={{ transform: 'rotate(135deg)' }} />
                </button>
            </div>
        );
    }

    // ─── Render Connecting Spinner ───
    if (callStatus === 'connecting') {
        return (
            <div className="fixed inset-0 bg-black/95 z-[99999] flex flex-col items-center justify-center text-center p-10 gap-6 backdrop-blur-md">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin" />
                <h2 className="text-white text-xl font-bold m-0">Connecting Call</h2>
                <p className="text-white/50 text-sm m-0">Negotiating secure audio/video channels...</p>
            </div>
        );
    }

    // ─── Render Active Connected Session ───
    if (callStatus === 'connected') {
        return (
            <div className="fixed inset-0 z-[99999] overflow-hidden">
                <ActiveCallView
                    conversationId={conversationId}
                    isGroup={isGroup}
                    groupName={groupName}
                    callType={callType}
                    currentUser={user}
                    remoteUser={remoteUser}
                    isHost={!initialIsIncoming}
                    token={token}
                    liveKitUrl={liveKitUrl}
                    providerOverride={provider}
                    onClose={handleHangUp}
                />
            </div>
        );
    }

    return null;
};

export default CallModal;
