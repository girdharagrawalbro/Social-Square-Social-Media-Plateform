import React, { useEffect, useRef, useState, useCallback } from 'react';
import { socket } from '../../socket';
import { api } from '../../store/zustand/useAuthStore';
import { Button } from 'primereact/button';
import toast from 'react-hot-toast';

const LiveStream = ({ streamId, isHost, onClose }) => {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState({}); // userId -> stream
    const peerConnections = useRef({}); // userId -> RTCPeerConnection
    const localVideoRef = useRef(null);
    const [viewersCount, setViewersCount] = useState(0);

    const configuration = {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ]
    };

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
    }, [configuration, localStream]);

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

    return (
        <div className="fixed inset-0 bg-black z-[2000] flex flex-col items-center justify-center p-4">
            <div className="relative w-full max-w-lg aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden shadow-2xl">
                {/* Header */}
                <div className="absolute top-4 left-4 right-4 flex justify-between items-center z-10">
                    <div className="flex items-center gap-2">
                        <div className="bg-red-600 text-white px-2 py-1 rounded text-xs font-bold animate-pulse">LIVE</div>
                        <div className="bg-black/40 backdrop-blur-md text-white px-2 py-1 rounded text-xs">
                            <i className="pi pi-eye mr-1"></i> {viewersCount}
                        </div>
                    </div>
                    <Button icon="pi pi-times" className="p-button-rounded p-button-text p-button-plain text-white bg-white/10" onClick={onClose} />
                </div>

                {/* Main Video */}
                <div className="w-full h-full flex items-center justify-center">
                    {isHost ? (
                        <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                    ) : (
                        Object.values(remoteStreams)[0] ? (
                            <video autoPlay playsInline className="w-full h-full object-cover" ref={el => el && (el.srcObject = Object.values(remoteStreams)[0])} />
                        ) : (
                            <div className="text-white text-center">
                                <i className="pi pi-spin pi-spinner text-4xl mb-2"></i>
                                <p>Waiting for host...</p>
                            </div>
                        )
                    )}
                </div>

                {/* Footer Actions */}
                <div className="absolute bottom-6 left-6 right-6 flex items-center gap-4 z-10">
                    <div className="flex-1 h-12 bg-white/10 backdrop-blur-md rounded-full border border-white/20 flex items-center px-4">
                        <input type="text" placeholder="Say something..." className="bg-transparent border-none outline-none text-white w-full text-sm" />
                    </div>
                    <Button icon="pi pi-send" className="p-button-rounded bg-[#808bf5] border-none !h-12 !w-12 shadow-lg" />
                    {isHost && (
                        <Button label="End" className="p-button-danger rounded-full px-6" onClick={handleEndStream} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default LiveStream;
