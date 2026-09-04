import React from 'react';

const SkeletonStory = ({ active = false }) => (
  <div className="flex flex-col items-center gap-[6px] flex-shrink-0">
    <div
      className="w-[52px] h-[52px] rounded-full p-[2px] flex-shrink-0"
      style={{ border: `1.5px solid ${active ? 'var(--color-border-info)' : 'var(--border-color)'}` }}
    >
      <div className="skeleton w-full h-full rounded-full"></div>
    </div>
    <div className="skeleton w-[38px] h-[9px] rounded"></div>
  </div>
);

export default SkeletonStory;
