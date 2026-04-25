import React, { useState, useEffect } from 'react';

/**
 * ProgressiveImage Component
 * Implements a blur-up loading effect for images to prevent layout shifts
 * and provide a better perceived performance.
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
    onTouchEnd
}) => {
    const [isLoaded, setIsLoaded] = useState(false);
    const [currentSrc, setCurrentSrc] = useState(null);

    useEffect(() => {
        setIsLoaded(false);
        const img = new Image();
        img.src = src;
        img.onload = () => {
            setCurrentSrc(src);
            setIsLoaded(true);
        };
    }, [src]);

    return (
        <div
            className={`progressive-image-container ${className || ''}`}
            style={{
                position: 'relative',
                overflow: 'hidden',
                backgroundColor: placeholderColor,
                width: '100%',
                display: 'block',
                ...style
            }}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onTouchEnd={onTouchEnd}
        >
            {/* The main image */}
            <img
                src={currentSrc || src}
                alt={alt}
                style={{
                    width: '100%',
                    height: 'auto',
                    maxHeight: '600px',
                    objectFit: objectFit,
                    display: 'block',
                    filter: isLoaded ? 'none' : `blur(${blurIntensity})`,
                    transition: 'filter 0.4s ease-out, opacity 0.4s ease-in-out',
                    opacity: isLoaded ? 1 : 0.6,
                }}
                onLoad={() => setIsLoaded(true)}
                loading="lazy"
            />

            {/* Loading Spinner overlay (subtle) */}
            {!isLoaded && (
                <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1
                }}>
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-[var(--primary)] border-t-transparent"></div>
                </div>
            )}
        </div>
    );
};

export default ProgressiveImage;
