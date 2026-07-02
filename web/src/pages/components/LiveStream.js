import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';
import useAuthStore from '../../store/zustand/useAuthStore';
import toast from 'react-hot-toast';
import { LiveKitRoom, RoomAudioRenderer, useTracks, useLocalParticipant, useRemoteParticipants } from '@livekit/components-react';
import { Track, setLogLevel } from 'livekit-client';
import '@livekit/components-styles';

// Silence LiveKit SDK's internal logger (signal connecting, publishing track, etc.)
// These are SDK-internal logs that clutter the browser console in production.
setLogLevel('silent');

// ── Per-user colour ────────────────────────────────────────────────────────────
const PALETTE = ['#808bf5', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#06b6d4'];
const getUserColor = (id = '') => {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
    return PALETTE[Math.abs(h) % PALETTE.length];
};

const MAX_VISIBLE_MSGS = 5;
const MSG_FADE_MS = 5000;
const MSG_REMOVE_MS = 5500;

// ── Instagram-style chat bubble ───────────────────────────────────────────────
const ChatBubble = ({ msg }) => {
    const color = getUserColor(msg.user?._id || msg.user?.username || '');
    const isSystemMsg = msg.isSystem;

    return (
        <div
            style={{
                display: 'flex', alignItems: 'center', gap: 7,
                opacity: msg.visible ? 1 : 0,
                transform: msg.visible ? 'translateY(0) scale(1)' : 'translateY(6px) scale(0.96)',
                transition: 'opacity 0.45s ease, transform 0.45s ease',
                maxWidth: '88%', pointerEvents: 'none',
            }}
        >
            <img
                src={msg.user?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                alt=""
                style={{
                    width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0,
                    border: '1.5px solid rgba(255,255,255,0.25)', boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                }}
            />
            <div style={{
                background: isSystemMsg ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.52)',
                backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
                borderRadius: 999, padding: '5px 13px',
                border: isSystemMsg ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(255,255,255,0.09)',
                boxShadow: '0 2px 12px rgba(0,0,0,0.3)',
                maxWidth: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
                <span style={{ color: isSystemMsg ? '#ccc' : color, fontWeight: 700, fontSize: 11, marginRight: 5 }}>{msg.user?.fullname}</span>
                <span style={{ color: isSystemMsg ? 'rgba(255,255,255,0.65)' : '#fff', fontSize: 12, fontWeight: isSystemMsg ? 400 : 400, fontStyle: isSystemMsg ? 'italic' : 'normal' }}>{msg.text}</span>
            </div>
        </div>
    );
};

// ── HOST pause overlay ────────────────────────────────────────────────────────
const HostPauseOverlay = ({ loggeduser, onResume, onEnd }) => (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 20,
        animation: 'fadeIn 0.3s ease',
    }}>
        {/* Avatar ring */}
        <div style={{ position: 'relative' }}>
            <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'linear-gradient(135deg,#808bf5,#ec4899)',
                padding: 3,
            }}>
                <img
                    src={loggeduser?.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #111' }}
                />
            </div>
            {/* Pause icon badge */}
            <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 28, height: 28, borderRadius: '50%',
                background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #111',
            }}>
                <i className="pi pi-pause" style={{ fontSize: 12, color: '#111', fontWeight: 900 }} />
            </div>
        </div>

        <div style={{ textAlign: 'center' }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 18, margin: '0 0 4px' }}>Live paused</p>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: 0 }}>Viewers see a waiting screen</p>
        </div>

        {/* Resume */}
        <button
            onClick={onResume}
            style={{
                background: 'linear-gradient(135deg,#808bf5,#6a74e8)',
                color: '#fff', border: 'none', borderRadius: 999,
                padding: '12px 40px', fontSize: 15, fontWeight: 800,
                cursor: 'pointer', boxShadow: '0 6px 24px rgba(128,139,245,0.45)',
                transition: 'transform 0.15s',
                letterSpacing: 0.3,
            }}
            onMouseDown={e => e.currentTarget.style.transform = 'scale(0.95)'}
            onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
        >
            <i className="pi pi-play" style={{ marginRight: 8, fontSize: 13 }} />
            Resume Live
        </button>

        {/* End */}
        <button
            onClick={onEnd}
            style={{
                background: 'transparent', color: 'rgba(255,80,80,0.85)',
                border: '1px solid rgba(255,80,80,0.3)', borderRadius: 999,
                padding: '8px 28px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                transition: 'background 0.2s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,80,80,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        >
            End Live
        </button>
    </div>
);

// ── VIEWER pause overlay ──────────────────────────────────────────────────────
const ViewerPauseOverlay = ({ hostInfo }) => (
    <div style={{
        position: 'absolute', inset: 0, zIndex: 60,
        background: 'rgba(0,0,0,0.60)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 16,
        animation: 'fadeIn 0.35s ease',
    }}>
        {hostInfo && (
            <div style={{
                width: 76, height: 76, borderRadius: '50%',
                background: 'linear-gradient(135deg,#808bf5,#ec4899)', padding: 3,
            }}>
                <img
                    src={hostInfo.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'}
                    alt=""
                    style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', border: '2px solid #111' }}
                />
            </div>
        )}

        {/* Pulsing pause icon */}
        <div style={{
            width: 52, height: 52, borderRadius: '50%',
            background: 'rgba(255,255,255,0.12)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'pulseScale 2s ease-in-out infinite',
            border: '1px solid rgba(255,255,255,0.18)',
        }}>
            <i className="pi pi-pause" style={{ fontSize: 22, color: '#fff' }} />
        </div>

        <div style={{ textAlign: 'center', padding: '0 24px' }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 16, margin: '0 0 5px' }}>
                {hostInfo?.fullname || 'Host'} paused the live
            </p>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12.5, margin: 0 }}>
                Waiting for them to resume…
            </p>
        </div>

        {/* Animated dots */}
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {[0, 1, 2].map(i => (
                <div key={i} style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'rgba(255,255,255,0.5)',
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                }} />
            ))}
        </div>

        <style>{`
            @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
            @keyframes pulseScale {
                0%,100% { transform:scale(1); opacity:0.8 }
                50% { transform:scale(1.08); opacity:1 }
            }
            @keyframes bounce {
                0%,80%,100% { transform:translateY(0) }
                40% { transform:translateY(-7px) }
            }
        `}</style>
    </div>
);

// ── Inner Component context for LiveKitRoom ──────────────────────────────────
const LiveStreamInner = ({ streamId, isHost, onClose }) => {
    const loggeduser = useAuthStore(s => s.user);
    const msgTimers = useRef({});
    const { localParticipant } = useLocalParticipant();
    const remoteParticipants = useRemoteParticipants(); // eslint-disable-line no-unused-vars
    const videoRef = useRef(null);

    const [viewersCount, setViewersCount] = useState(0);
    const [hostInfo, setHostInfo] = useState(null);

    // Pause state
    const [isPaused, setIsPaused] = useState(false);

    // Chat
    const [chatMessages, setChatMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const [showChat, setShowChat] = useState(true);

    // ── Track selection split by role ─────────────────────────────────────────
    // For the HOST: fetch ALL tracks (including unpublished placeholders) so we
    // can read our own local camera track immediately after setCameraEnabled().
    const localTracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: false }],
        { onlySubscribed: false }
    );

    // For VIEWERS: only fetch tracks that the room has subscribed to (remote ones).
    // onlySubscribed:true is the right flag here because the viewer never publishes.
    const remoteTracks = useTracks(
        [{ source: Track.Source.Camera, withPlaceholder: false }],
        { onlySubscribed: true }
    );

    // Pick the correct track based on role:
    //   HOST   → find the local participant's camera publication, read .track from it
    //   VIEWER → find the first remote participant's camera publication, read .track from it
    //
    // IMPORTANT: TrackReference from useTracks exposes tracks via .publication.track,
    // NOT via .track directly. Accessing .track returns undefined and the video never renders.
    const activeTrackRef = isHost
        ? localTracks.find(t => t.participant?.isLocal)
        : remoteTracks.find(t => !t.participant?.isLocal);
    const activeTrack = activeTrackRef?.publication?.track ?? null;

    // Attach track to the <video> element whenever it changes
    useEffect(() => {
        const videoElement = videoRef.current;
        if (!activeTrack || !videoElement) return;

        activeTrack.attach(videoElement);
        return () => {
            try {
                activeTrack.detach(videoElement);
            } catch (e) {
                console.warn('Track detach warning:', e);
            }
        };
    }, [activeTrack]);

    // ── Publish media for host explicitly on mount ───────────────────────────
    useEffect(() => {
        if (isHost && localParticipant) {
            const publishMedia = async () => {
                try {
                    await localParticipant.setCameraEnabled(true);
                    await localParticipant.setMicrophoneEnabled(true);
                } catch (err) {
                    console.error('Failed to publish host media:', err);
                    toast.error('Could not access camera or microphone. Please check permissions.', { icon: '📷' });
                }
            };
            publishMedia();
        }
    }, [isHost, localParticipant]);

    // ── Cleanup ──────────────────────────────────────────────────────────────
    useEffect(() => {
        const timers = msgTimers.current;
        return () => {
            Object.values(timers).forEach(t => { clearTimeout(t.fade); clearTimeout(t.remove); });
            // Emit leave-live instantly on component unmount
            if (!isHost) {
                socket.emit('leave-live', streamId);
            }
        };
    }, [isHost, streamId]);

    const seenIds = useRef(new Set());

    // ── Add message with auto-fade & deduplication ────────────────────────────
    const addMessage = useCallback((msg) => {
        const id = msg.id || msg._id || `${Date.now()}-${Math.random()}`;
        if (seenIds.current.has(id)) return;
        seenIds.current.add(id);

        setChatMessages(prev => {
            if (prev.some(m => m.id === id)) return prev;
            return [...prev, { ...msg, id, visible: true }].slice(-MAX_VISIBLE_MSGS);
        });
        const fadeTimer = setTimeout(() => setChatMessages(prev => prev.map(m => m.id === id ? { ...m, visible: false } : m)), MSG_FADE_MS);
        const removeTimer = setTimeout(() => { setChatMessages(prev => prev.filter(m => m.id !== id)); delete msgTimers.current[id]; }, MSG_REMOVE_MS);
        msgTimers.current[id] = { fade: fadeTimer, remove: removeTimer };
    }, []);

    // ── Emit socket join-live ────────────────────────────────────────────────
    useEffect(() => {
        socket.emit('join-live', streamId);
        if (!isHost) {
            const fetchStreamHost = async () => {
                try {
                    const res = await api.get(`/api/live/stream/${streamId}`);
                    setHostInfo(res.data.host);
                } catch (err) {
                    console.error('Failed to get host info:', err);
                }
            };
            fetchStreamHost();
        }
    }, [isHost, streamId]);

    // ── Load Chat History ────────────────────────────────────────────────────
    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await api.get(`/api/live/${streamId}/chat/history`);
                if (Array.isArray(res.data)) {
                    res.data.forEach(msg => {
                        addMessage(msg);
                    });
                }
            } catch (err) {
                console.error('Failed to load chat history:', err);
            }
        };
        fetchHistory();
    }, [streamId, addMessage]);

    // ── Socket listeners ──────────────────────────────────────────────────────
    useEffect(() => {
        socket.on('viewer-joined', ({ viewerCount }) => setViewersCount(viewerCount));

        // Instagram-style Join/Leave Chat Alerts
        const handleViewerJoinedChat = ({ fullname, profile_picture, userId }) => {
            addMessage({
                id: `join-${userId}-${Date.now()}`,
                text: 'joined the live',
                isSystem: true,
                user: { fullname, profile_picture, _id: userId }
            });
        };
        const handleViewerLeftChat = ({ fullname, profile_picture, userId }) => {
            addMessage({
                id: `leave-${userId}-${Date.now()}`,
                text: 'left the live',
                isSystem: true,
                user: { fullname, profile_picture, _id: userId }
            });
        };

        socket.on('viewer-joined-chat', handleViewerJoinedChat);
        socket.on('viewer-left-chat', handleViewerLeftChat);

        const handleLiveEnded = (id) => { if (id === streamId) { toast('The live stream has ended', { icon: '📺' }); onClose(); } };
        socket.on('live-ended', handleLiveEnded);

        // Pause / resume (received by viewers)
        const handleLivePaused = (id) => { if (id === streamId) setIsPaused(true); };
        const handleLiveResumed = (id) => { if (id === streamId) setIsPaused(false); };
        socket.on('live-paused', handleLivePaused);
        socket.on('live-resumed', handleLiveResumed);

        // Live Chat Messages relayed via Socket
        const handleLiveMessage = (msg) => {
            if (msg.streamId === streamId) {
                addMessage(msg);
            }
        };
        socket.on('live-message', handleLiveMessage);

        return () => {
            socket.off('viewer-joined');
            socket.off('viewer-joined-chat', handleViewerJoinedChat);
            socket.off('viewer-left-chat', handleViewerLeftChat);
            socket.off('live-ended', handleLiveEnded);
            socket.off('live-paused', handleLivePaused);
            socket.off('live-resumed', handleLiveResumed);
            socket.off('live-message', handleLiveMessage);
        };
    }, [streamId, onClose, addMessage]);

    // ── Pause (host) — disable camera/microphone tracks, notify viewers ───────
    const handlePause = async () => {
        try {
            if (localParticipant) {
                await localParticipant.setCameraEnabled(false);
                await localParticipant.setMicrophoneEnabled(false);
            }
        } catch (err) {
            console.error('Failed to disable tracks:', err);
        }
        socket.emit('live-paused', streamId);
        setIsPaused(true);
    };

    // ── Resume (host) — re-enable tracks, notify viewers ─────────────────────
    const handleResume = async () => {
        try {
            if (localParticipant) {
                await localParticipant.setCameraEnabled(true);
                await localParticipant.setMicrophoneEnabled(true);
            }
        } catch (err) {
            console.error('Failed to enable tracks:', err);
        }
        socket.emit('live-resumed', streamId);
        setIsPaused(false);
    };

    // ── End stream ────────────────────────────────────────────────────────────
    const handleEndStream = async () => {
        try {
            if (isHost) { await api.post(`/api/live/end/${streamId}`); socket.emit('live-ended', streamId); }
        } catch (err) { console.error('Error ending stream:', err); }
        finally { onClose(); }
    };

    // ── Send chat ─────────────────────────────────────────────────────────────
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!inputText.trim()) return;
        const text = inputText;
        setInputText('');
        try { await api.post(`/api/live/${streamId}/chat/message`, { text }); }
        catch { toast.error('Failed to send message'); }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
            {/* Global keyframe styles */}
            <style>{`
                @keyframes fadeIn { from{opacity:0} to{opacity:1} }
                @keyframes pulseScale { 0%,100%{transform:scale(1);opacity:.8} 50%{transform:scale(1.08);opacity:1} }
                @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-7px)} }
            `}</style>

            <div
                className="relative w-full max-w-sm bg-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10"
                style={{ height: 'min(90vh, 700px)' }}
            >
                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2 flex-wrap">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold tracking-wider shadow-lg flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full bg-white inline-block ${isPaused ? '' : 'animate-pulse'}`} />
                            {isPaused ? 'PAUSED' : 'LIVE'}
                        </div>
                        <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/10 flex items-center gap-1.5 shadow-lg">
                            <i className="pi pi-eye text-[10px]" /> {viewersCount}
                        </div>
                        {!isHost && hostInfo && (
                            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                                <img src={hostInfo.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1773920333/9e837528f01cf3f42119c5aeeed1b336_qf6lzf.jpg'} alt="" className="w-5 h-5 rounded-full object-cover border border-white/20" />
                                <span className="text-white text-xs font-semibold">{hostInfo.fullname}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Chat toggle */}
                        <button
                            onClick={() => setShowChat(v => !v)}
                            title={showChat ? 'Hide chat' : 'Show chat'}
                            style={{
                                width: 32, height: 32, borderRadius: '50%', border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContents: 'center',
                                background: showChat ? 'rgba(128,139,245,0.35)' : 'rgba(255,255,255,0.12)',
                                backdropFilter: 'blur(8px)',
                                color: showChat ? '#a5b4fc' : 'rgba(255,255,255,0.4)',
                                transition: 'background 0.2s, color 0.2s',
                                boxShadow: showChat ? '0 0 0 1.5px rgba(128,139,245,0.5)' : '0 0 0 1px rgba(255,255,255,0.1)',
                                position: 'relative',
                            }}
                        >
                            <i className="pi pi-comment text-sm" style={{ display: 'block', margin: '0 auto' }} />
                            {!showChat && (
                                <span style={{ position: 'absolute', left: '50%', top: '50%', width: 16, height: 2, background: 'rgba(255,255,255,0.4)', transform: 'translate(-50%, -50%) rotate(-45deg)', borderRadius: 2 }} />
                            )}
                        </button>

                        {/* HOST: X = pause; End Live = end */}
                        {isHost ? (
                            <>
                                <button
                                    onClick={handleEndStream}
                                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer shadow-lg transition-all hover:scale-105"
                                >
                                    End Live
                                </button>
                                {/* X → PAUSE */}
                                <button
                                    onClick={isPaused ? handleResume : handlePause}
                                    title={isPaused ? 'Resume live' : 'Pause live'}
                                    className="w-8 h-8 rounded-full backdrop-blur-md border-0 text-white cursor-pointer flex items-center justify-center transition-all hover:scale-105"
                                    style={{ background: isPaused ? 'rgba(128,139,245,0.5)' : 'rgba(255,255,255,0.2)' }}
                                >
                                    <i className={`pi ${isPaused ? 'pi-play' : 'pi-pause'} text-sm`} />
                                </button>
                            </>
                        ) : (
                            /* VIEWER: X = leave */
                            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border-0 text-white cursor-pointer flex items-center justify-center transition-all">
                                <i className="pi pi-times text-sm" />
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Video area ──────────────────────────────────────────── */}
                <div className="flex-1 relative bg-black overflow-hidden">
                    {activeTrack ? (
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted={isHost}
                            className="w-full h-full object-cover"
                        />
                    ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-10 text-center gap-4">
                            <div className="w-16 h-16 rounded-full border-4 border-[#808bf5]/30 border-t-[#808bf5] animate-spin" />
                            <p className="text-white font-semibold">Connecting to stream...</p>
                            <p className="text-white/50 text-sm">Waiting for host's video feed</p>
                        </div>
                    )}

                    {/* ── Pause overlay ── */}
                    {isPaused && isHost && <HostPauseOverlay loggeduser={loggeduser} onResume={handleResume} onEnd={handleEndStream} />}
                    {isPaused && !isHost && <ViewerPauseOverlay hostInfo={hostInfo} />}

                    {/* ── Floating chat bubbles ── */}
                    <div style={{
                        position: 'absolute', bottom: 16, left: 12, right: 12,
                        display: 'flex', flexDirection: 'column', gap: 7,
                        zIndex: 40, pointerEvents: 'none',
                        opacity: showChat ? 1 : 0,
                        transition: 'opacity 0.3s ease',
                    }}>
                        {chatMessages.map(msg => <ChatBubble key={msg.id} msg={msg} />)}
                    </div>

                    {/* Chat-hidden pill */}
                    {!showChat && (
                        <div style={{
                            position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                            background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
                            borderRadius: 999, padding: '4px 14px',
                            border: '1px solid rgba(255,255,255,0.1)',
                            color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600,
                            zIndex: 40, pointerEvents: 'none', whiteSpace: 'nowrap',
                        }}>
                            <i className="pi pi-eye-slash" style={{ marginRight: 5, fontSize: 10 }} />
                            Chat hidden
                        </div>
                    )}
                </div>

                {/* ── Chat input bar ────────────────────────────────────── */}
                <div style={{
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.75)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    backdropFilter: 'blur(20px)',
                }}>
                    <form onSubmit={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                            flex: 1, height: 40,
                            background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)',
                            borderRadius: 999, border: '1px solid rgba(255,255,255,0.18)',
                            display: 'flex', alignItems: 'center', paddingLeft: 16, paddingRight: 12,
                        }}>
                            <input
                                type="text"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                placeholder="Send a message..."
                                style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', width: '100%', fontSize: 13 }}
                                className="placeholder:text-white/40"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            style={{
                                width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0,
                                cursor: inputText.trim() ? 'pointer' : 'default',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: inputText.trim() ? '#808bf5' : 'rgba(255,255,255,0.1)',
                                color: inputText.trim() ? '#fff' : 'rgba(255,255,255,0.3)',
                                transition: 'background 0.2s, transform 0.15s',
                                boxShadow: inputText.trim() ? '0 4px 14px rgba(128,139,245,0.45)' : 'none',
                            }}
                            onMouseDown={e => { if (inputText.trim()) e.currentTarget.style.transform = 'scale(0.9)'; }}
                            onMouseUp={e => { e.currentTarget.style.transform = 'scale(1)'; }}
                        >
                            <i className="pi pi-send" style={{ fontSize: 14 }} />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
const LiveStream = ({ streamId, isHost, onClose }) => {
    const [token, setToken] = useState('');
    const [liveKitUrl] = useState(process.env.REACT_APP_LIVEKIT_URL || 'ws://localhost:7880');
    const [connectionError, setConnectionError] = useState('');
    const fetchInitiated = useRef(false);   // StrictMode guard — only fetch once

    useEffect(() => {
        // Prevent StrictMode double-invocation from issuing two token requests
        if (fetchInitiated.current) return;
        fetchInitiated.current = true;

        const fetchToken = async () => {
            try {
                const res = await api.post(`/api/live/${streamId}/token`);
                setToken(res.data.token);
            } catch (err) {
                console.error('Failed to get LiveKit token:', err);
                const msg = err?.response?.data?.error || 'Failed to connect to stream server';
                setConnectionError(msg);
                toast.error(msg);
            }
        };
        fetchToken();
    }, [streamId]);

    if (connectionError) {
        return (
            <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-sm bg-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center border border-white/10 p-10 text-center gap-4" style={{ height: 'min(90vh, 700px)' }}>
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
                        <i className="pi pi-exclamation-triangle text-red-400 text-2xl" />
                    </div>
                    <p className="text-white font-semibold">Connection failed</p>
                    <p className="text-white/50 text-sm">{connectionError}</p>
                    <button
                        onClick={onClose}
                        className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-full text-sm font-semibold border border-white/10 transition-all"
                    >
                        Close
                    </button>
                </div>
            </div>
        );
    }

    if (!token) {
        return (
            <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
                <div className="relative w-full max-w-sm bg-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col items-center justify-center border border-white/10 p-10 text-center" style={{ height: 'min(90vh, 700px)' }}>
                    <div className="w-16 h-16 rounded-full border-4 border-[#808bf5]/30 border-t-[#808bf5] animate-spin" />
                    <p className="text-white font-semibold mt-4">Connecting to live stream...</p>
                    <p className="text-white/50 text-sm mt-2">Authenticating credentials</p>
                </div>
            </div>
        );
    }

    return (
        <LiveKitRoom
            video={isHost}
            audio={isHost}
            token={token}
            serverUrl={liveKitUrl}
            connectOptions={{ autoSubscribe: true }}
            options={{ adaptiveStream: true, dynacast: true }}
        >
            <RoomAudioRenderer />
            <LiveStreamInner
                streamId={streamId}
                isHost={isHost}
                onClose={onClose}
            />
        </LiveKitRoom>
    );
};

export default LiveStream;
