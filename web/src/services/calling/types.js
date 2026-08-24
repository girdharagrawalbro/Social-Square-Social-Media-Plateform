export const CALL_PROVIDERS = {
    WEBSOCKET: 'websocket',
    LIVEKIT: 'livekit',
};

export const CALL_TYPES = {
    VOICE: 'voice',
    VIDEO: 'video',
};

export const DEFAULT_ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
];
