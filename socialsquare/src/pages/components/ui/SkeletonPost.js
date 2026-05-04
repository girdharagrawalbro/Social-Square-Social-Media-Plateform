import React from 'react';

const SkeletonPost = () => (
  <div className="p-[18px] rounded-2xl bg-[var(--surface-1)] border border-[var(--border-color)] mb-4" style={{borderWidth:'0.5px'}}>
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-3">
        <div className="skeleton skeleton-avatar w-[42px] h-[42px] rounded-full flex-shrink-0"></div>
        <div className="flex flex-col gap-[6px]">
          <div className="skeleton w-[110px] h-[13px] rounded"></div>
          <div className="skeleton w-[70px] h-[10px] rounded"></div>
        </div>
      </div>
      <div className="skeleton w-[22px] h-[22px] rounded-md"></div>
    </div>
    <div className="flex flex-col gap-[7px] mb-3">
      <div className="skeleton w-full h-[12px] rounded"></div>
      <div className="skeleton w-4/5 h-[12px] rounded"></div>
    </div>
    <div className="skeleton w-full h-[220px] rounded-xl mb-1"></div>
    <hr className="border-t border-[var(--border-color)] my-3" style={{borderTopWidth:'0.5px'}} />
    <div className="flex items-center gap-3">
      <div className="skeleton w-14 h-[30px] rounded-lg"></div>
      <div className="skeleton w-14 h-[30px] rounded-lg"></div>
      <div className="skeleton w-14 h-[30px] rounded-lg"></div>
      <div className="skeleton w-[30px] h-[30px] rounded-lg ml-auto"></div>
    </div>
  </div>
);

export default SkeletonPost;
