import React, { useState, useRef } from "react";
import ProgressiveImage from './ProgressiveImage';

// ─── IMAGE CAROUSEL ────────────────────────────────────────────────────────────
// Matches the Newpost thumbnail-strip style.
// • Single image: plain full-width display, no strip
// • 2+ images: thumbnail strip at the bottom, swipe left/right arrows, counter badge
// ──────────────────────────────────────────────────────────────────────────────
export const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);

    // Touch-swipe support
    const touchStartX = useRef(null);

    const handleTouchStart = (e) => {
        touchStartX.current = e.touches[0].clientX;
    };

    const handleTouchEndSwipe = (e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) < 40) {
            // Too short — treat as a tap
            onTouchEnd && onTouchEnd(e);
            return;
        }
        if (dx < 0 && current < images.length - 1) setCurrent(c => c + 1);
        if (dx > 0 && current > 0) setCurrent(c => c - 1);
    };

    if (!images?.length) return null;

    return (
        <div className="relative w-full bg-black select-none overflow-hidden">
            {/* ── Main image ─────────────────────────────────────── */}
            <div
                onDoubleClick={onDoubleClick}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEndSwipe}
                style={{ maxHeight: '600px', minHeight: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000' }}
            >
                <ProgressiveImage
                    key={images[current]}
                    src={images[current]}
                    alt={`Image ${current + 1}`}
                    objectFit="contain"
                    style={{ maxHeight: '600px', minHeight: '260px' }}
                />
            </div>

            {/* ── Left / Right arrows ────────────────────────────── */}
            {images.length > 1 && current > 0 && (
                <button
                    aria-label="Previous image"
                    onClick={e => { e.stopPropagation(); setCurrent(c => c - 1); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/80 transition-all active:scale-95 shadow-lg"
                    style={{ fontSize: '18px', lineHeight: 1 }}
                >
                    ‹
                </button>
            )}
            {images.length > 1 && current < images.length - 1 && (
                <button
                    aria-label="Next image"
                    onClick={e => { e.stopPropagation(); setCurrent(c => c + 1); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white border border-white/20 hover:bg-black/80 transition-all active:scale-95 shadow-lg"
                    style={{ fontSize: '18px', lineHeight: 1 }}
                >
                    ›
                </button>
            )}

            {/* ── Counter badge (top-right) ──────────────────────── */}
            {images.length > 1 && (
                <div className="absolute top-2.5 right-2.5 z-10 bg-black/60 backdrop-blur-sm text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-white/15 select-none">
                    {current + 1}/{images.length}
                </div>
            )}

            {/* ── Thumbnail strip ────────────────────────────────── */}
            {images.length > 1 && (
                <div className="w-full px-2 py-2 bg-black/50 backdrop-blur-md flex gap-2 overflow-x-auto no-scrollbar border-t border-white/10">
                    {images.map((src, idx) => (
                        <button
                            key={idx}
                            aria-label={`Go to image ${idx + 1}`}
                            onClick={e => { e.stopPropagation(); setCurrent(idx); }}
                            className={`flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 transition-all p-0 bg-transparent cursor-pointer
                                ${idx === current
                                    ? 'border-[#6366f1] opacity-100 scale-105 shadow-md shadow-indigo-500/30'
                                    : 'border-transparent opacity-55 hover:opacity-85 hover:scale-105'
                                }`}
                        >
                            <img
                                src={src}
                                alt={`Thumbnail ${idx + 1}`}
                                className="w-full h-full object-cover"
                                loading="lazy"
                            />
                        </button>
                    ))}
                </div>
            )}

            {/* ── Dot indicators (only when strip is hidden i.e. ≤1 img) ── */}
            {/* The dot row is purely decorative for single-image, hidden for multi */}
        </div>
    );
};
