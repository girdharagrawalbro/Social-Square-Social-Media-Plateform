import { useState, useEffect, useRef, useCallback } from 'react';
import { CALL_PROVIDERS } from './types';
import { WebSocketCallDriver } from './WebSocketCallDriver';
import { LiveKitCallDriver } from './LiveKitCallDriver';

/**
 * Unified Calling Engine Hook.
 * Dynamically boots WebSocket or LiveKit driver while exposing an identical API to UI.
 */
export function useCallEngine({
    conversationId,
    isGroup = false,
    callType = 'voice',
    user,
    remoteUser,
    isHost = false,
    token = null,
    liveKitUrl = null,
    provider: requestedProvider = null,
    onEnded = () => {},
}) {
    // Determine calling provider: priority is prop -> env var -> default ('websocket')
    const activeProvider = requestedProvider || import.meta.env.REACT_APP_CALL_PROVIDER || CALL_PROVIDERS.WEBSOCKET;

    const [localStream, setLocalStream] = useState(null);
    const [remoteStreamsMap, setRemoteStreamsMap] = useState(new Map());
    const [connectionState, setConnectionState] = useState('idle');
    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(callType === 'voice');

    const driverRef = useRef(null);
    const onEndedRef = useRef(onEnded);
    onEndedRef.current = onEnded;

    // Initialize driver
    useEffect(() => {
        if (!conversationId) return;

        let isCancelled = false;

        const onStreamsUpdate = ({ localStream: ls, remoteStreams: rs }) => {
            if (isCancelled) return;
            setLocalStream(ls);
            setRemoteStreamsMap(new Map(rs));
        };

        const onConnectionStateChange = (state) => {
            if (isCancelled) return;
            setConnectionState(state);
            if (state === 'disconnected') {
                onEndedRef.current();
            }
        };

        const onError = (err) => {
            console.error('[useCallEngine] Driver error:', err);
        };

        let driver = null;
        if (activeProvider === CALL_PROVIDERS.LIVEKIT) {
            console.log('[useCallEngine] Booting LiveKit SFU Driver');
            driver = new LiveKitCallDriver({ onStreamsUpdate, onConnectionStateChange, onError });
        } else {
            console.log('[useCallEngine] Booting WebSocket/WebRTC Mesh Driver');
            driver = new WebSocketCallDriver({ onStreamsUpdate, onConnectionStateChange, onError });
        }

        driverRef.current = driver;
        setConnectionState('connecting');

        driver.connect({
            conversationId,
            isGroup,
            callType,
            user,
            remoteUser,
            isHost,
            token,
            liveKitUrl,
        }).catch((err) => {
            console.error('[useCallEngine] Failed to connect call driver:', err);
            setConnectionState('disconnected');
        });

        return () => {
            isCancelled = true;
            if (driverRef.current) {
                driverRef.current.disconnect();
                driverRef.current = null;
            }
        };
    }, [conversationId, isGroup, callType, activeProvider, isHost, token, liveKitUrl, user, remoteUser]);

    const toggleMute = useCallback(async () => {
        if (!driverRef.current) return;
        const next = !isMuted;
        await driverRef.current.setMicrophoneEnabled(!next);
        setIsMuted(next);
    }, [isMuted]);

    const toggleVideo = useCallback(async () => {
        if (!driverRef.current || callType === 'voice') return;
        const next = !isVideoOff;
        await driverRef.current.setCameraEnabled(!next);
        setIsVideoOff(next);
    }, [isVideoOff, callType]);

    const endCall = useCallback(() => {
        if (driverRef.current) {
            driverRef.current.disconnect();
            driverRef.current = null;
        }
        setConnectionState('disconnected');
        onEndedRef.current();
    }, []);

    // Convert remote streams map into an array for easy rendering in grids
    const remoteStreams = Array.from(remoteStreamsMap.entries()).map(([id, data]) => ({
        id,
        stream: data.stream,
        user: data.user || { id, fullname: `User ${id.slice(-4)}` },
    }));

    const isConnected = connectionState === 'connected' && (remoteStreams.length > 0 || (isGroup && connectionState === 'connected'));

    return {
        provider: activeProvider,
        localStream,
        remoteStreams,
        connectionState,
        isConnected,
        isMuted,
        isVideoOff,
        toggleMute,
        toggleVideo,
        endCall,
    };
}
