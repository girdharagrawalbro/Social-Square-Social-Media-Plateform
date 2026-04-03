import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';

/**
 * ExploreGrid
 * Temporary component to display images in an Instagram-like grid.
 * Props:
 *  - images: array of image URLs. If omitted, uses placeholder images.
 */
const ExploreGrid = ({ images }) => {
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(null);

  const sample = [
    'https://picsum.photos/id/1015/800/800',
    'https://picsum.photos/id/1016/800/800',
    'https://picsum.photos/id/1020/800/800',
    'https://picsum.photos/id/1024/800/800',
    'https://picsum.photos/id/1025/800/800',
    'https://picsum.photos/id/1035/800/800',
    'https://picsum.photos/id/1038/800/800',
    'https://picsum.photos/id/1043/800/800',
    'https://picsum.photos/id/1050/800/800'
  ];

  const imgs = images && images.length > 0 ? images : sample;

  return (
    <div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {imgs.map((src, idx) => (
          <div
            key={idx}
            className="relative rounded-lg overflow-hidden bg-[var(--surface-2)] cursor-pointer"
            style={{ aspectRatio: '1' }}
            onClick={() => { setCurrent(src); setVisible(true); }}
          >
            <img src={src} alt={`explore-${idx}`} className="w-full h-full object-cover" />
          </div>
        ))}
      </div>

      <Dialog visible={visible} onHide={() => setVisible(false)} style={{ width: '90vw', maxWidth: '900px' }} modal className="p-0">
        <div className="w-full h-[80vh] flex items-center justify-center bg-black">
          {current && <img src={current} alt="full" className="max-h-full max-w-full object-contain" />}
        </div>
      </Dialog>
    </div>
  );
};

export default ExploreGrid;
