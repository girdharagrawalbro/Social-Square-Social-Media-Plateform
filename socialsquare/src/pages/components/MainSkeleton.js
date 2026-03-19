import React from 'react';
import Navbar from './Navbar';
import SkeletonPost from './ui/SkeletonPost';

const MainSkeleton = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen w-full p-4 bg-gray-50">
        <div className="hidden lg:flex gap-4 h-full w-full max-w-7xl mx-auto">
          <div className="w-1/4">
            <div className="p-3 bordershadow bg-white rounded-lg">
              <div className="skeleton skeleton-line w-3/4 mb-3"></div>
              <div className="flex gap-2 items-center">
                <div className="skeleton skeleton-avatar"></div>
                <div className="w-full">
                  <div className="skeleton skeleton-line w-1/2 mb-2"></div>
                  <div className="skeleton skeleton-line w-1/4"></div>
                </div>
              </div>
            </div>
          </div>

          <div className="w-1/2">
            <div className="mt-3 rounded-lg flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <SkeletonPost key={i} />
              ))}
            </div>
          </div>

          <div className="w-1/4">
            <div className="p-3 bordershadow bg-white rounded-lg">
              <div className="skeleton skeleton-profile-pic mb-3"></div>
              <div className="skeleton skeleton-line w-1/2 mb-2"></div>
              <div className="skeleton skeleton-line w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default MainSkeleton;
