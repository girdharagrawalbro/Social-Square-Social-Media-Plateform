import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';
import { Button } from 'primereact/button';
import toast from 'react-hot-toast';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

const LiveStream = ({ streamId, isHost, onClose }) => {
    const localStreamRef = useRef(null);
    const peerConnections = useRef({}); // userId -> RTCPeerConnection
    const localVideoRef = useRef(null);
    const [viewersCount, setViewersCount] = useState(0);
    const [hostInfo, setHostInfo] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'failed'

    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const chatEndRef = useRef(null);

    // ─── Cleanup on unmount ───────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            // Use ref so we always get the current value even on unmount
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => track.stop());
                localStreamRef.current = null;
            }
            Object.values(peerConnections.current).forEach(pc => {
                try { pc.close(); } catch { }
            });
            peerConnections.current = {};
        };
    }, []);

    // ─── Initial WebRTC + Signaling Setup ────────────────────────────────────
    useEffect(() => {
        const init = async () => {
            try {
                if (isHost) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    localStreamRef.current = stream;
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
                }
                socket.emit('join-live', streamId);
            } catch (err) {
                console.error('Error accessing media devices:', err);
                toast.error('Could not access camera/microphone');
                setConnectionStatus('failed');
            }
        };
        init();
    }, [isHost, streamId]);

    // ─── SSE Chat setup ───────────────────────────────────────────────────────
    useEffect(() => {
        const baseUrl = process.env.REACT_APP_BACKEND_URL;
        const eventSource = new EventSource(`${baseUrl}/api/live/${streamId}/chat/stream`);

        eventSource.onmessage = (event) => {
            try {
                const newMessage = JSON.parse(event.data);
                setMessages(prev => {
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            } catch (err) {
                console.error('SSE data parse error:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
        };

        return () => eventSource.close();
    }, [streamId]);

    // ─── Auto-scroll chat ─────────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Create Peer Connection ───────────────────────────────────────────────
    const createPeerConnection = useCallback((userId) => {
        // Close any existing connection with this user
        if (peerConnections.current[userId]) {
            try { peerConnections.current[userId].close(); } catch { }
        }

        const pc = new RTCPeerConnection(configuration);
        peerConnections.current[userId] = pc;

        // Host adds local tracks
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: userId, candidate: event.candidate });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') setConnectionStatus('connected');
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                setConnectionStatus('failed');
            }
        };

        pc.ontrack = (event) => {
            setConnectionStatus('connected');
            // Find or create a video element for this stream
            const streamObj = event.streams[0];
            if (streamObj) {
                // We store the stream and update the video element
                setRemoteStream(streamObj);
            }
        };

        return pc;
    }, []);

    const [remoteStream, setRemoteStream] = useState(null);
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteStream]);

    // ─── Socket Event Listeners ───────────────────────────────────────────────
    useEffect(() => {
        // ICE candidates (shared by host and viewer)
        const handleCandidate = async ({ from, candidate }) => {
            const pc = peerConnections.current[from];
            if (pc && candidate) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('[ICE] Failed to add candidate:', err);
                }
            }
        };
        socket.on('ice-candidate', handleCandidate);

        // Viewer count updates
        const handleViewerJoined = ({ viewerCount }) => {
            setViewersCount(viewerCount);
        };
        socket.on('viewer-joined', handleViewerJoined);

        // Stream ended (viewers receive this)
        const handleLiveEnded = (endedStreamId) => {
            if (endedStreamId === streamId) {
                toast('The live stream has ended', { icon: '📺' });
                onClose();
            }
        };
        socket.on('live-ended', handleLiveEnded);

        if (isHost) {
            // Host receives offers from viewers
            const handleOffer = async ({ from, offer }) => {
                try {
                    const pc = createPeerConnection(from);
                    await pc.setRemoteDescription(new RTCSessionDescription(offer));
                    const answer = await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('live-answer', { to: from, answer });
                } catch (err) {
                    console.error('[Host] Failed to handle offer:', err);
                }
            };
            socket.on('live-offer', handleOffer);

            return () => {
                socket.off('live-offer', handleOffer);
                socket.off('ice-candidate', handleCandidate);
                socket.off('viewer-joined', handleViewerJoined);
                socket.off('live-ended', handleLiveEnded);
            };
        } else {
            // Viewer: fetch host info, then send offer
            const handleAnswer = async ({ from, answer }) => {
                const pc = peerConnections.current[from];
                if (pc) {
                    try {
                        await pc.setRemoteDescription(new RTCSessionDescription(answer));
                    } catch (err) {
                        console.error('[Viewer] Failed to set answer:', err);
                    }
                }
            };

            const startConnection = async () => {
                try {
                    const res = await api.get(`/api/live/stream/${streamId}`);
                    const streamData = res.data;
                    setHostInfo(streamData.host);
                    const hostId = streamData.host?._id || streamData.host;
                    if (hostId) {
                        const pc = createPeerConnection(hostId);
                        const offer = await pc.createOffer({
                            offerToReceiveVideo: true,
                            offerToReceiveAudio: true
                        });
                        await pc.setLocalDescription(offer);
                        socket.emit('live-offer', { to: hostId, offer });
                    }
                } catch (err) {
                    console.error('[Viewer] Failed to initiate connection:', err);
                    setConnectionStatus('failed');
                }
            };
            startConnection();

            socket.on('live-answer', handleAnswer);
            return () => {
                socket.off('live-answer', handleAnswer);
                socket.off('ice-candidate', handleCandidate);
                socket.off('viewer-joined', handleViewerJoined);
                socket.off('live-ended', handleLiveEnded);
            };
        }
    }, [isHost, streamId, createPeerConnection, onClose]);

    // ─── End / Leave Stream ───────────────────────────────────────────────────
    const handleEndStream = async () => {
        try {
            if (isHost) {
                await api.post(`/api/live/end/${streamId}`);
                socket.emit('live-ended', streamId);
            }
        } catch (err) {
            console.error('Error ending stream:', err);
        } finally {
            onClose();
        }
    };

    // ─── Send Chat Message ────────────────────────────────────────────────────
    const handleSendMessage = async (e) => {
        e?.preventDefault();
        if (!inputText.trim()) return;
        const text = inputText;
        setInputText('');
        try {
            await api.post(`/api/live/${streamId}/chat/message`, { text });
        } catch (err) {
            console.error('Failed to send message:', err);
            toast.error('Failed to send message');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/90 z-[10000] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg bg-gray-950 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-white/10" style={{ height: 'min(90vh, 700px)' }}>

                {/* Header */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-600 text-white px-3 py-1 rounded-lg text-xs font-bold tracking-wider shadow-lg flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                            LIVE
                        </div>
                        <div className="bg-black/50 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/10 flex items-center gap-1.5 shadow-lg">
                            <i className="pi pi-eye text-[10px]" /> {viewersCount}
                        </div>
                        {!isHost && hostInfo && (
                            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full border border-white/10">
                                <img src={hostInfo.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'} alt="" className="w-5 h-5 rounded-full object-cover border border-white/20" />
                                <span className="text-white text-xs font-semibold">{hostInfo.fullname}</span>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {isHost && (
                            <button
                                onClick={handleEndStream}
                                className="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-full text-xs font-bold border-0 cursor-pointer shadow-lg transition-all hover:scale-105"
                            >
                                End Live
                            </button>
                        )}
                        <button
                            onClick={isHost ? handleEndStream : onClose}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md border-0 text-white cursor-pointer flex items-center justify-center transition-all"
                        >
                            <i className="pi pi-times text-sm" />
                        </button>
                    </div>
                </div>

                {/* Main Video Area */}
                <div className="flex-1 relative bg-black overflow-hidden">
                    {isHost ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        remoteStream ? (
                            <video ref={remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-10 text-center gap-4">
                                {connectionStatus === 'failed' ? (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                                            <i className="pi pi-wifi text-4xl text-red-400" />
                                        </div>
                                        <p className="text-white font-semibold text-lg">Connection Failed</p>
                                        <p className="text-white/60 text-sm">Could not connect to the live stream. The host may have ended the stream.</p>
                                        <button onClick={onClose} className="mt-4 px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white rounded-full text-sm font-semibold transition cursor-pointer">
                                            Close
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <div className="w-16 h-16 rounded-full border-4 border-[#808bf5]/30 border-t-[#808bf5] animate-spin" />
                                        </div>
                                        <p className="text-white font-semibold">Connecting to stream...</p>
                                        <p className="text-white/50 text-sm">Waiting for host's video feed</p>
                                    </>
                                )}
                            </div>
                        )
                    )}

                    {/* Chat Overlay */}
                    <div className="absolute bottom-4 left-4 right-4 max-h-[40%] overflow-y-auto flex flex-col gap-2 z-40 pointer-events-none" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 20%)' }}>
                        <div className="flex flex-col gap-2 pointer-events-auto">
                            {messages.map((msg) => (
                                <div key={msg.id} className="flex items-start gap-2">
                                    <img
                                        src={msg.user.profile_picture || 'https://res.cloudinary.com/dcmrsdydh/image/upload/v1778489986/OIP_ik8g4k.jpg'}
                                        alt=""
                                        className="w-6 h-6 rounded-full border border-white/20 shadow-sm flex-shrink-0"
                                    />
                                    <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-2xl rounded-tl-none border border-white/10 max-w-[80%]">
                                        <p className="text-[10px] font-bold text-[#808bf5] mb-0.5">{msg.user.fullname}</p>
                                        <p className="text-xs text-white leading-relaxed">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                </div>

                {/* Footer Chat Bar */}
                <div className="p-3 bg-black/80 border-t border-white/10 backdrop-blur-xl">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                        <div className="flex-1 h-11 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center px-4 focus-within:border-[#808bf5]/50 transition-colors">
                            <input
                                type="text"
                                value={inputText}
                                onChange={(e) => setInputText(e.target.value)}
                                placeholder="Send a message..."
                                className="bg-transparent border-none outline-none text-white w-full text-sm placeholder:text-white/40"
                            />
                        </div>
                        <Button
                            type="submit"
                            icon="pi pi-send"
                            disabled={!inputText.trim()}
                            className={`p-button-rounded border-none !h-11 !w-11 shadow-2xl transition-all flex-shrink-0 ${inputText.trim() ? 'bg-[#808bf5] hover:bg-[#6a74e8]' : 'bg-white/10 text-white/30'}`}
                        />
                    </form>
                </div>
            </div>
        </div>
    );
};

export default LiveStream;
