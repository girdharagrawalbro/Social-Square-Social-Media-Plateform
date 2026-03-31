import React from 'react';

const SkeletonStory = () => {
  return (
    <div className="flex flex-col items-center gap-2 flex-shrink-0">
      <div className="skeleton skeleton-avatar w-16 h-16 border-2 border-gray-100 dark:border-slate-700 p-0.5">
          <div className="w-full h-full rounded-full bg-gray-200 dark:bg-slate-700"></div>
      </div>
      <div className="skeleton skeleton-line w-12 h-2.5 rounded-full"></div>
    </div>
  );
};

export default SkeletonStory;
