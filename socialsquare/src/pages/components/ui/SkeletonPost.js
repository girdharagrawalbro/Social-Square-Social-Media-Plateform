import React from 'react';

const SkeletonPost = () => {
  return (
    <div className="p-3 rounded-xl bordershadow bg-white post-skeleton">
      <div className="flex items-center gap-2">
        <div className="skeleton skeleton-avatar"></div>
        <div className="flex-1">
          <div className="skeleton skeleton-line w-1/2 mb-2"></div>
          <div className="skeleton skeleton-line w-1/4"></div>
        </div>
      </div>
      <div className="skeleton skeleton-image mt-3"></div>
      <div className="skeleton skeleton-line mt-3"></div>
      <div className="skeleton skeleton-line w-3/4 mt-2"></div>
    </div>
  );
};

export default SkeletonPost;
