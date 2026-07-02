import React, { useState, useEffect } from 'react';
import dbService from '../../../utils/indexedDb';

const avatarCache = new Map(); // url -> localBlobUrl

export const CachedAvatar = ({ src, alt, className, style, onClick }) => {
    const [avatarSrc, setAvatarSrc] = useState(src);

    useEffect(() => {
        if (!src) {
            setAvatarSrc(null);
            return;
        }

        // If it's a base64 or already a local blob/URL, use it directly
        if (src.startsWith('data:') || src.startsWith('blob:')) {
            setAvatarSrc(src);
            return;
        }

        if (avatarCache.has(src)) {
            setAvatarSrc(avatarCache.get(src));
            return;
        }

        let active = true;
        let localBlobUrl = null;

        const loadAvatar = async () => {
            try {
                // Check IndexedDB
                const cachedBlob = await dbService.getMedia(src);
                if (cachedBlob) {
                    localBlobUrl = URL.createObjectURL(cachedBlob);
                    avatarCache.set(src, localBlobUrl);
                    if (active) {
                        setAvatarSrc(localBlobUrl);
                    }
                } else {
                    // Fetch and Cache
                    const response = await fetch(src);
                    const blob = await response.blob();
                    await dbService.setMedia(src, blob);
                    
                    localBlobUrl = URL.createObjectURL(blob);
                    avatarCache.set(src, localBlobUrl);
                    if (active) {
                        setAvatarSrc(localBlobUrl);
                    }
                }
            } catch (err) {
                console.warn("Failed to load/cache avatar:", err);
                if (active) {
                    setAvatarSrc(src); // Fallback to original URL
                }
            }
        };

        loadAvatar();

        return () => {
            active = false;
            if (localBlobUrl && !avatarCache.has(src)) {
                URL.revokeObjectURL(localBlobUrl);
            }
        };
    }, [src]);

    // Fallback profile avatar SVG/icon if src is null/failed
    if (!avatarSrc) {
        return (
            <div 
                className={`flex items-center justify-center bg-gray-200 text-gray-500 rounded-full ${className}`}
                style={{ ...style, fontSize: '18px' }}
                onClick={onClick}
            >
                <i className="pi pi-user"></i>
            </div>
        );
    }

    return (
        <img 
            src={avatarSrc} 
            alt={alt || "Avatar"} 
            className={className} 
            style={style} 
            onClick={onClick}
            draggable="false"
        />
    );
};

export default CachedAvatar;
