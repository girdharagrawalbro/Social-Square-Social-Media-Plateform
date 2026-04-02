import React from 'react';

const SkeletonPost = () => {
  return (
    <div className="p-4 rounded-xl bg-[var(--surface-1)] shadow-sm border border-[var(--border-color)] mb-4 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="skeleton skeleton-avatar w-12 h-12"></div>
          <div>
            <div className="skeleton skeleton-line w-28 h-4 mb-2"></div>
            <div className="skeleton skeleton-line w-20 h-3"></div>
          </div>
        </div>
        <div className="skeleton w-6 h-6 rounded-md"></div>
      </div>

      {/* Caption */}
      <div className="space-y-2 mb-4">
        <div className="skeleton skeleton-line w-full"></div>
        <div className="skeleton skeleton-line w-4/5"></div>
      </div>

      {/* Image */}
      <div className="skeleton skeleton-image w-full h-80 mb-4"></div>

      {/* Actions */}
      <div className="flex items-center gap-6 pt-3 border-t border-[var(--border-color)]">
        <div className="skeleton w-16 h-8 rounded-lg"></div>
        <div className="skeleton w-16 h-8 rounded-lg"></div>
        <div className="skeleton w-16 h-8 rounded-lg"></div>
      </div>
    </div>
  );
};

export default SkeletonPost;
