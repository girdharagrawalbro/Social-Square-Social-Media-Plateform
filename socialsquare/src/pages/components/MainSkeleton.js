import React from 'react';
import SkeletonPost from './ui/SkeletonPost';
import SkeletonStory from './ui/SkeletonStory';

const MainSkeleton = () => {
    return (
        <div className="min-h-screen w-full p-3 bg-transparent">
            {/* Desktop Layout - 3 Column */}
            <div className="hidden lg:flex gap-4 w-full max-w-7xl mx-auto pt-4">
                {/* Left Column - Profile Sidebar (250px) */}
                <div className="w-[280px] flex-shrink-0">
                    <div className="p-5 bg-[var(--surface-1)] rounded-2xl shadow-sm border border-[var(--border-color)]">
                        {/* Profile Picture */}
                        <div className="skeleton w-20 h-20 rounded-full mx-auto mb-4"></div>
                        {/* Profile Name */}
                        <div className="skeleton h-6 w-3/4 mx-auto mb-2 rounded"></div>
                        <div className="skeleton h-4 w-1/2 mx-auto mb-6 rounded"></div>
                        
                        {/* Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="text-center">
                                    <div className="skeleton h-5 w-full mb-1 rounded"></div>
                                    <div className="skeleton h-3 w-3/4 mx-auto rounded"></div>
                                </div>
                            ))}
                        </div>
                        {/* Buttons */}
                        <div className="skeleton h-10 w-full mb-2 rounded-xl"></div>
                    </div>
                </div>

                {/* Middle Column - Feed */}
                <div className="flex-1 max-w-[600px]">
                    {/* Stories */}
                    <div className="flex gap-4 mb-6 overflow-x-hidden">
                        {[1, 2, 3, 4].map((i) => (
                            <SkeletonStory key={i} />
                        ))}
                    </div>
                    {/* Posts Feed */}
                    <div className="flex flex-col gap-6">
                        {[1, 2, 3].map((i) => (
                            <SkeletonPost key={i} />
                        ))}
                    </div>
                </div>

                {/* Right Column - Sidebar */}
                <div className="w-[300px] flex-shrink-0">
                    <div className="p-5 bg-[var(--surface-1)] rounded-2xl shadow-sm border border-[var(--border-color)]">
                        <div className="skeleton h-10 w-full mb-6 rounded-full"></div>
                        {[1, 2, 3, 4].map(i => (
                            <div key={i} className="mb-4 pb-4 border-b border-[var(--border-color)] last:border-0">
                                <div className="skeleton h-4 w-3/4 mb-2 rounded"></div>
                                <div className="skeleton h-3 w-1/2 rounded"></div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-col gap-4 max-w-xl mx-auto">
                <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div key={i} className="skeleton w-16 h-24 rounded-xl flex-shrink-0"></div>
                    ))}
                </div>
                {[1, 2].map((i) => (
                    <SkeletonPost key={i} />
                ))}
            </div>
        </div>
    );
};

export default MainSkeleton;
