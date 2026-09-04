import React from 'react';

const SkeletonUsers = () => {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="p-6 rounded-3xl border border-[var(--border-color)] bg-[var(--surface-2)] flex flex-col items-center">
                    {/* Profile Picture Skeleton */}
                    <div className="w-24 h-24 mb-4 rounded-full skeleton flex-shrink-0"></div>

                    {/* Name & Subtitle Skeleton */}
                    <div className="text-center w-full mb-4 flex flex-col items-center gap-2">
                        <div className="skeleton w-3/4 h-5 rounded"></div>
                        <div className="skeleton w-1/2 h-3 rounded"></div>
                    </div>

                    {/* Stats Skeleton */}
                    <div className="flex gap-4 mb-6">
                        <div className="flex flex-col items-center gap-1">
                            <div className="skeleton w-8 h-4 rounded"></div>
                            <div className="skeleton w-12 h-2 rounded"></div>
                        </div>
                    </div>

                    {/* Buttons Skeleton */}
                    <div className="flex gap-2 w-full mt-auto">
                        <div className="skeleton flex-1 h-10 rounded-2xl"></div>
                        <div className="skeleton w-10 h-10 rounded-2xl"></div>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonUsers;
