import React from 'react';
import SkeletonPost from './ui/SkeletonPost';
import SkeletonStory from './ui/SkeletonStory';

const MainSkeleton = () => {
    return (
        <div className="w-full min-h-screen bg-transparent">
            {/* Desktop Layout - Matching Home.js max-w-6xl centered structure */}
            <div className="hidden lg:flex justify-center items-start gap-3 w-full max-w-6xl mx-auto p-3">
                <div className="flex-1 px-0 sm:px-3">
                    <div className="max-w-screen-md mx-auto w-full">
                        {/* Stories Skeleton */}
                        <div className="flex gap-4 mb-6 overflow-x-hidden">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <SkeletonStory key={i} />
                            ))}
                        </div>

                        {/* Feed Skeleton - Matching max-w-md centered structure */}
                        <div className="max-w-md mx-auto">
                            {/* Mood Toggle Skeleton */}
                            <div className="flex gap-2 mb-6 overflow-x-hidden pb-2">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="skeleton h-10 w-24 rounded-full flex-shrink-0"></div>
                                ))}
                            </div>

                            {/* Posts Feed */}
                            <div className="flex flex-col gap-6">
                                {[1, 2, 3].map((i) => (
                                    <SkeletonPost key={i} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Mobile Layout */}
            <div className="lg:hidden flex flex-col gap-4 max-w-xl mx-auto p-3">
                {/* Mobile Stories */}
                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <SkeletonStory key={i} />
                    ))}
                </div>

                {/* Mobile Feed */}
                <div className="flex flex-col gap-4">
                    {[1, 2, 3].map((i) => (
                        <SkeletonPost key={i} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default MainSkeleton;
