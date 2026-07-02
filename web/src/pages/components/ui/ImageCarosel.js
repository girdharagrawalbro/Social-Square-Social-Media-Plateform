import React, { useState, useRef } from "react";
import ProgressiveImage from './ProgressiveImage';

export const ImageCarousel = ({ images, mediaKeys, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);

    const touchStartX = useRef(null);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEndSwipe = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) {
            onTouchEnd && onTouchEnd(e);
            return;
        }
        if (dx < 0 && current < images.length - 1) setCurrent(c => c + 1);
        if (dx > 0 && current > 0) setCurrent(c => c - 1);
    };

    if (!images?.length) return null;

    return (
        <div className="relative w-full bg-black select-none overflow-hidden">

            {/* ── Main image — all pre-rendered, opacity-switched ── */}
            <div
                onDoubleClick={onDoubleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEndSwipe}
                style={{ maxHeight: '600px', minHeight: '260px', position: 'relative' }}
            >
                {images.map((src, idx) => (
                    <div
                        key={src}
                        style={{
                            position: idx === 0 ? 'relative' : 'absolute',
                            inset: 0,
                            opacity: idx === current ? 1 : 0,
                            transition: 'opacity 0.25s ease',
                            pointerEvents: idx === current ? 'auto' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: '#000',
                        }}
                    >
                        <ProgressiveImage
                            src={src}
                            alt={`Image ${idx + 1}`}
                            objectFit="contain"
                            style={{ maxHeight: '600px', minHeight: '260px' }}
                            fileKey={mediaKeys?.[idx]?.key}
                            iv={mediaKeys?.[idx]?.iv}
                        />
                    </div>
                ))}
            </div>

            {/* ── Left / Right arrows ────────────────────────────── */}
            {images.length > 1 && current > 0 && (
                <button
                    aria-label="Previous image"
                    onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-[30px] h-[30px] rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-black transition-all active:scale-95 shadow-lg"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" color="black">
                        <path d="M7.5 2L3.5 6L7.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}
            {images.length > 1 && current < images.length - 1 && (
                <button
                    aria-label="Next image"
                    onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z10 w-[30px] h-[30px] rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center text-black transition-all active:scale-95 shadow-lg"
                >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" color="black">
                        <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </button>
            )}

            {/* ── Counter badge (top-right) ──────────────────────── */}
            {images.length > 1 && (
                <div className="absolute top-2.5 right-2.5 z-10 bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full select-none">
                    {current + 1}/{images.length}
                </div>
            )}

            {/* ── Dot indicators (bottom-center) ────────────────── */}
            {images.length > 1 && (
                <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5">
                    {images.map((_, idx) => (
                        <button
                            key={idx}
                            aria-label={`Go to image ${idx + 1}`}
                            onClick={e => { e.stopPropagation(); setCurrent(idx); }}
                            style={{
                                width: idx === current ? '16px' : '6px',
                                height: '6px',
                                borderRadius: '999px',
                                background: idx === current ? '#fff' : 'rgba(255,255,255,0.45)',
                                border: 'none',
                                padding: 0,
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                flexShrink: 0,
                            }}
                        />
                    ))}
                </div>
            )}

        </div>
    );
};