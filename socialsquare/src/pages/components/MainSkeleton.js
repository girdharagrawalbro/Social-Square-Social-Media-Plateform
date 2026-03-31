import React from 'react';
import Navbar from './Navbar';
import SkeletonPost from './ui/SkeletonPost';
import SkeletonStory from './ui/SkeletonStory';

const MainSkeleton = () => {
  return (
    <>
      <Navbar />
      <div className="min-h-screen w-full p-3 bg-gray-50">
        {/* Desktop Layout - 3 Column */}
        <div className="hidden lg:flex gap-3 w-full max-w-8xl mx-auto">
          {/* Left Column - Profile Sidebar (25%) */}
          <div className="w-1/4 h-auto">
            <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
              {/* Profile Picture */}
              <div className="skeleton skeleton-profile-pic mb-4 w-20 h-20 rounded-full mx-auto"></div>
              
              {/* Profile Name */}
              <div className="skeleton skeleton-line w-3/4 mb-2 h-6"></div>
              <div className="skeleton skeleton-line w-1/2 mb-4 h-4"></div>
              
              {/* Stats */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="skeleton skeleton-line w-full mb-1"></div>
                  <div className="skeleton skeleton-line w-3/4"></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="skeleton skeleton-line w-full mb-1"></div>
                  <div className="skeleton skeleton-line w-3/4"></div>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <div className="skeleton skeleton-line w-full mb-1"></div>
                  <div className="skeleton skeleton-line w-3/4"></div>
                </div>
              </div>

              {/* Buttons */}
              <div className="skeleton skeleton-line w-full h-10 mb-2 rounded-lg"></div>
              <div className="skeleton skeleton-line w-full h-10 rounded-lg"></div>
            </div>
          </div>

          {/* Middle Column - Feed (50%) */}
          <div className="w-1/2 overflow-y-auto h-[calc(100vh-100px)]">
            {/* Stories */}
            <div className="flex gap-3 mb-6 p-1 overflow-x-hidden">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <SkeletonStory key={i} />
              ))}
            </div>

            {/* New Post Box */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
              <div className="flex gap-2 items-center">
                <div className="skeleton skeleton-avatar w-10 h-10 rounded-full"></div>
                <div className="skeleton skeleton-line flex-1 h-10 rounded-full"></div>
              </div>
            </div>

            {/* Posts Feed */}
            <div className="flex flex-col gap-4">
              {[1, 2, 3].map((i) => (
                <SkeletonPost key={i} />
              ))}
            </div>
          </div>

          {/* Right Column - Sidebar (25%) */}
          <div className="w-1/4 h-auto">
            {/* Search/Trending Box */}
            <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200 mb-4">
              <div className="skeleton skeleton-line w-full h-10 mb-4 rounded-full"></div>
              
              {/* Trending items */}
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="mb-3 pb-3 border-b border-gray-100">
                  <div className="skeleton skeleton-line w-3/4 mb-2"></div>
                  <div className="skeleton skeleton-line w-1/2"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile/Tablet Layout */}
        <div className="lg:hidden flex flex-col gap-4">
          {/* Stories */}
          <div className="flex gap-2 overflow-x-auto">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="skeleton skeleton-avatar w-16 h-24 rounded-lg flex-shrink-0"></div>
            ))}
          </div>

          {/* New Post Box */}
          <div className="p-4 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex gap-2 items-center">
              <div className="skeleton skeleton-avatar w-10 h-10 rounded-full"></div>
              <div className="skeleton skeleton-line flex-1 h-10 rounded-full"></div>
            </div>
          </div>

          {/* Posts Feed */}
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <SkeletonPost key={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default MainSkeleton;
