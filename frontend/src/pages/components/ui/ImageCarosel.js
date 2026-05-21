import React, { useState } from "react";

import ProgressiveImage from './ProgressiveImage';
// ─── IMAGE CAROUSEL ───────────────────────────────────────────────────────────
export const ImageCarousel = ({ images, onDoubleClick, onTouchEnd }) => {
    const [current, setCurrent] = useState(0);
    if (!images?.length) return null;
    if (images.length === 1) return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ background: '#000' }}>
            <ProgressiveImage src={images[0]} alt="Post" maxHeight={"600px"} objectFit="contain" />
        </div>
    );
    return (
        <div onDoubleClick={onDoubleClick} onTouchEnd={onTouchEnd} style={{ position: 'relative' }}>
            <ProgressiveImage src={images[current]} alt={`${current + 1}`} objectFit="contain" style={{ background: '#000' }} />
            {current > 0 && <button aria-label="Previous image" onClick={e => { e.stopPropagation(); setCurrent(c => c - 1) }} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>}
            {current < images.length - 1 && <button aria-label="Next image" onClick={e => { e.stopPropagation(); setCurrent(c => c + 1) }} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', zIndex: 2, background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', color: '#fff', cursor: 'pointer', fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>}
            <div style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 2, background: 'rgba(0,0,0,0.45)', color: '#fff', fontSize: '11px', padding: '3px 8px', borderRadius: '999px', fontWeight: 600 }}>{current + 1}/{images.length}</div>
            <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px', zIndex: 2 }}>
                {images.map((_, i) => <button aria-label={`Go to image ${i + 1}`} key={i} onClick={e => { e.stopPropagation(); setCurrent(i) }} style={{ width: i === current ? '16px' : '6px', height: '6px', borderRadius: '3px', border: 'none', cursor: 'pointer', padding: 0, background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'all 0.2s' }} />)}
            </div>
        </div>
    );
};
