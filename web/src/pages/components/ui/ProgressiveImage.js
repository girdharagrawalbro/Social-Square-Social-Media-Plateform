import React, { useState, useEffect } from 'react';
import { importSymmetricKey, decryptFile } from '../../../utils/cryptoUtils';
import dbService from '../../../utils/indexedDb';

const decryptionCache = new Map(); // url -> localBlobUrl

// Silently block right-click / drag / long-press save.
const blockSave = (e) => e.preventDefault();

/**
 * ProgressiveImage Component
 * Implements a blur-up loading effect for images to prevent layout shifts
 * and provide a better perceived performance. Supports E2EE/DRM decryption.
 * Image saving via right-click, drag, or iOS long-press is blocked.
 */
const ProgressiveImage = ({
    src,
    alt,
    className,
    style,
    placeholderColor = 'var(--surface-2)',
    blurIntensity = '10px',
    objectFit = 'cover',
    onClick,
    onDoubleClick,
    onTouchEnd,
    fileKey,
    iv
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(null);

    useEffect(() => {
        setIsLoaded(false);
        let active = true;
        let localBlobUrl = null;

        const load = async () => {
            let finalSrc = src;
            if (fileKey && iv && src) {
                if (decryptionCache.has(src)) {
                    finalSrc = decryptionCache.get(src);
                } else {
                    try {
                        const cachedBlob = await dbService.getMedia(src);
                        if (cachedBlob) {
                            localBlobUrl = URL.createObjectURL(cachedBlob);
                            decryptionCache.set(src, localBlobUrl);
                            finalSrc = localBlobUrl;
                        } else {
                            const response = await fetch(src);
                            const arrayBuffer = await response.arrayBuffer();
                            const cryptoKey = await importSymmetricKey(fileKey);
                            const decryptedBuffer = await decryptFile(arrayBuffer, iv, cryptoKey);
                            const blob = new Blob([decryptedBuffer], { type: 'image/jpeg' });

                            await dbService.setMedia(src, blob);

                            localBlobUrl = URL.createObjectURL(blob);
                            decryptionCache.set(src, localBlobUrl);
                            finalSrc = localBlobUrl;
                        }
                    } catch (e) {
                        console.error("Failed to decrypt progressive image:", e);
                    }
                }
            }

            if (!active) {
                if (localBlobUrl && !decryptionCache.has(src)) {
                    URL.revokeObjectURL(localBlobUrl);
                }
                return;
            }

            const img = new Image();
            img.src = finalSrc;
            img.onload = () => {
                if (active) {
                    setCurrentSrc(finalSrc);
                    setIsLoaded(true);
                }
            };
            img.onerror = () => {
                if (active) {
                    setIsLoaded(true);
                }
            };
        };

        load();

        return () => {
            active = false;
        };
    }, [src, fileKey, iv]);

    return (
        <div
            className={`progressive-image-container ${className || ''}`}
            style={{
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: placeholderColor,
                width: '100%',
                height: '100%',
                zIndex: 0,
                display: 'block',
                // Prevent text/image selection on the whole container
                userSelect: 'none',
                WebkitUserSelect: 'none',
                ...style
            }}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onTouchEnd={onTouchEnd}
        >
            {/* The main image — pointer-events:none so it can't be directly
                right-clicked; the transparent overlay intercepts instead. */}
            <img
                src={currentSrc || src}
                alt={alt}
                draggable={false}
                onContextMenu={blockSave}
                onDragStart={blockSave}
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: objectFit,
                    display: 'block',
                    filter: isLoaded ? 'none' : `blur(${blurIntensity})`,
                    transition: 'filter 0.4s ease-out, opacity 0.4s ease-in-out',
                    opacity: isLoaded ? 1 : 0.6,
                    // Removes the <img> as a right-click target in most browsers
                    pointerEvents: 'none',
                    // iOS Safari: disable long-press "Save Image"
                    WebkitTouchCallout: 'none',
                }}
                onLoad={() => setIsLoaded(true)}
                loading="lazy"
            />

            {/* Transparent overlay — sits above the image and catches all
                pointer events, so the browser's "Save image as…" menu never
                appears on the actual <img> element. */}
            <div
                aria-hidden="true"
                onContextMenu={blockSave}
                onDragStart={blockSave}
                style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 1,
                    background: 'transparent',
                    cursor: 'inherit',
                }}
            />

            {/* Loading spinner */}
            {!isLoaded && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 2
                }}>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--primary)] border-t-transparent"></div>
                </div>
            )}
        </div>
    );
};

export default ProgressiveImage;
