import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';
import { Button } from 'primereact/button';
import toast from 'react-hot-toast';

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

const LiveStream = ({ streamId, isHost, onClose }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
    const peerConnections = useRef({}); // userId -> RTCPeerConnection
    const localVideoRef = useRef(null);
    const [viewersCount] = useState(0);
    
    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputText, setInputText] = useState('');
    const chatEndRef = useRef(null);

    // Initial WebRTC and signaling setup
    useEffect(() => {
        const init = async () => {
            try {
                if (isHost) {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    setLocalStream(stream);
                    if (localVideoRef.current) localVideoRef.current.srcObject = stream;

                    socket.emit('join-live', streamId);
                } else {
                    socket.emit('join-live', streamId);
                }
            } catch (err) {
                console.error('Error accessing media devices:', err);
                toast.error('Could not access camera/microphone');
            }
        };

        init();

        const pcs = peerConnections.current;
        return () => {
            if (localStream) localStream.getTracks().forEach(track => track.stop());
            Object.values(pcs).forEach(pc => pc.close());
        };
    }, [isHost, streamId, localStream]);

    // SSE Chat setup
    useEffect(() => {
        const baseUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
        const eventSource = new EventSource(`${baseUrl}/api/live/${streamId}/chat/stream`);

        eventSource.onmessage = (event) => {
            try {
                const newMessage = JSON.parse(event.data);
                setMessages(prev => {
                    // Avoid duplicates if any
                    if (prev.some(m => m.id === newMessage.id)) return prev;
                    return [...prev, newMessage];
                });
            } catch (err) {
                console.error('SSE data parse error:', err);
            }
        };

        eventSource.onerror = (err) => {
            console.error('SSE Error:', err);
            // eventSource.close(); // Don't close immediately, let it retry
        };

        return () => {
            eventSource.close();
        };
    }, [streamId]);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const createPeerConnection = useCallback((userId) => {
        const pc = new RTCPeerConnection(configuration);
        peerConnections.current[userId] = pc;

        if (localStream) {
            localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
        }

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socket.emit('ice-candidate', { to: userId, candidate: event.candidate });
            }
        };

        pc.ontrack = (event) => {
            setRemoteStreams(prev => ({ ...prev, [userId]: event.streams[0] }));
        };

        return pc;
    }, [localStream]);

    useEffect(() => {
        // Signaling listeners
        if (isHost) {
            const handleOffer = async ({ from, offer }) => {
                const pc = createPeerConnection(from);
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('live-answer', { to: from, answer });
            };
            socket.on('live-offer', handleOffer);
            return () => socket.off('live-offer', handleOffer);
        } else {
            const handleAnswer = async ({ from, answer }) => {
                const pc = peerConnections.current[from];
                if (pc) await pc.setRemoteDescription(new RTCSessionDescription(answer));
            };
            const handleCandidate = async ({ from, candidate }) => {
                const pc = peerConnections.current[from];
                if (pc) await pc.addIceCandidate(new RTCIceCandidate(candidate));
            };
            socket.on('live-answer', handleAnswer);
            socket.on('ice-candidate', handleCandidate);
            return () => {
                socket.off('live-answer', handleAnswer);
                socket.off('ice-candidate', handleCandidate);
            };
        }
    }, [isHost, createPeerConnection]);

    const handleEndStream = async () => {
        try {
            if (isHost) {
                await api.post(`/api/live/end/${streamId}`);
                socket.emit('live-ended', streamId);
            }
            onClose();
        } catch (err) {
            console.error('Error ending stream:', err);
            onClose();
        }
    };

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
        <div className="fixed inset-0 bg-black z-[10000] flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
                {/* Header */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-50">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse shadow-lg">LIVE</div>
                        <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold border border-white/10 flex items-center shadow-lg">
                            <i className="pi pi-eye mr-2 text-[10px]"></i> {viewersCount}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isHost && (
                            <Button
                                label="End Live"
                                className="p-button-danger p-button-sm rounded-full px-4 text-xs font-bold border-none shadow-lg transform hover:scale-105 transition-all"
                                onClick={handleEndStream}
                            />
                        )}
                        <Button
                            icon="pi pi-times"
                            className="p-button-rounded p-button-text p-button-plain text-white bg-white/20 backdrop-blur-md hover:bg-white/30 border-none !w-8 !h-8 transition-colors"
                            onClick={onClose}
                        />
                    </div>
                </div>

                {/* Main Video Area */}
                <div className="flex-1 relative bg-black overflow-hidden">
                    {isHost ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        Object.values(remoteStreams)[0] ? (
                            <video autoPlay playsInline className="w-full h-full object-cover" ref={el => el && (el.srcObject = Object.values(remoteStreams)[0])} />
                        ) : (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-10 text-center">
                                <i className="pi pi-spin pi-spinner text-4xl mb-4 text-[#808bf5]"></i>
                                <p className="text-white/70 font-medium">Waiting for host to start streaming...</p>
                            </div>
                        )
                    )}

                    {/* Chat Overlay */}
                    <div className="absolute bottom-20 left-4 right-4 max-h-[40%] overflow-y-auto custom-scrollbar flex flex-col gap-2 z-40 pointer-events-none">
                        <div className="flex flex-col gap-2 pointer-events-auto">
                            {messages.map((msg) => (
                                <div key={msg.id} className="flex items-start gap-2 animate-in slide-in-from-left-4 duration-300">
                                    <img 
                                        src={msg.user.profile_picture || '/default-profile.png'} 
                                        alt="" 
                                        className="w-6 h-6 rounded-full border border-white/20 shadow-sm"
                                    />
                                    <div className="bg-black/30 backdrop-blur-md px-3 py-1.5 rounded-2xl rounded-tl-none border border-white/10 max-w-[80%]">
                                        <p className="text-[10px] font-bold text-[#808bf5] mb-0.5">{msg.user.fullname}</p>
                                        <p className="text-xs text-white leading-relaxed">{msg.text}</p>
                                    </div>
                                </div>
                            ))}
                            <div ref={chatEndRef} />
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 pt-0 bg-gradient-to-t from-black/80 to-transparent z-50">
                    <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                        <div className="flex-1 h-12 bg-white/10 backdrop-blur-xl rounded-full border border-white/20 flex items-center px-4 shadow-2xl focus-within:border-[#808bf5]/50 transition-colors">
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
                            className={`p-button-rounded border-none !h-12 !w-12 shadow-2xl transition-all ${inputText.trim() ? 'bg-[#808bf5]' : 'bg-white/10 text-white/30'}`}
                        />
                    </form>
                </div>
            </div>
            
            <style jsx="true">{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 4px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255, 255, 255, 0.2);
                    border-radius: 10px;
                }
                .custom-scrollbar {
                    mask-image: linear-gradient(to bottom, transparent, black 20%, black 90%, transparent);
                }
            `}</style>
        </div>
    );
};

export default LiveStream;
