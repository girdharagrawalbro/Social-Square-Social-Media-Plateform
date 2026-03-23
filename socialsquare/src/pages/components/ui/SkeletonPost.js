import React from 'react';

const SkeletonPost = () => {
  return (
    <div className="p-4 rounded-xl bg-white shadow-sm border border-gray-200 post-skeleton">
      {/* Header - Avatar, Name, More button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="skeleton skeleton-avatar w-12 h-12 rounded-full"></div>
          <div className="flex-1">
            <div className="skeleton skeleton-line w-24 h-4 mb-1"></div>
            <div className="skeleton skeleton-line w-20 h-3"></div>
          </div>
        </div>
        <div className="skeleton skeleton-line w-6 h-6"></div>
      </div>

      {/* Post Caption/Text */}
      <div className="mb-3">
        <div className="skeleton skeleton-line w-full h-4 mb-2"></div>
        <div className="skeleton skeleton-line w-5/6 h-4"></div>
      </div>

      {/* Post Image */}
      <div className="skeleton skeleton-image w-full h-64 mb-3 rounded-lg"></div>

      {/* Engagement Stats */}
      <div className="flex justify-between text-sm mb-3 px-1">
        <div className="skeleton skeleton-line w-20 h-3"></div>
        <div className="skeleton skeleton-line w-20 h-3"></div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-around items-center pt-2 border-t border-gray-100">
        <div className="skeleton skeleton-line w-16 h-8 rounded-lg"></div>
        <div className="skeleton skeleton-line w-16 h-8 rounded-lg"></div>
        <div className="skeleton skeleton-line w-16 h-8 rounded-lg"></div>
        <div className="skeleton skeleton-line w-16 h-8 rounded-lg"></div>
      </div>
    </div>
  );
};

export default SkeletonPost;
