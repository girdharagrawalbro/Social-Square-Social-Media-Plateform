import React from 'react';

const SkeletonSearch = () => {
    return (
        <div className="flex flex-col gap-4 p-2">
            {/* People Section Skeleton */}
            <div className="flex flex-col gap-1">
                <div className="skeleton w-20 h-3 rounded mb-2 ml-1"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <div className="skeleton w-11 h-11 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="skeleton w-1/3 h-4 rounded"></div>
                            <div className="skeleton w-1/2 h-3 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* AI Results Skeleton */}
            <div className="flex flex-col gap-2 mt-2">
                <div className="skeleton w-32 h-3 rounded mb-2 ml-1"></div>
                {[1, 2].map(i => (
                    <div key={i} className="flex items-center gap-4 p-3 rounded-2xl bg-[var(--surface-2)]/50">
                        <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="skeleton w-3/4 h-4 rounded"></div>
                            <div className="skeleton w-1/2 h-3 rounded"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonSearch;
