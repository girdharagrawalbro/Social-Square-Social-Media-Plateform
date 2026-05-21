import React from 'react';

const SkeletonSidebarRight = () => {
    return (
        <div className="p-5 bg-[var(--surface-1)] rounded-2xl shadow-sm border border-[var(--border-color)] overflow-hidden" style={{ borderWidth: '0.5px' }}>
            {/* Search Bar Skeleton */}
            <div className="skeleton h-10 w-full mb-6 rounded-full"></div>
            
            {/* List Heading */}
            <div className="skeleton h-4 w-1/2 mb-4 rounded"></div>

            {/* Recommendation List */}
            {[1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-3 mb-4 pb-4 border-b border-[var(--border-color)] last:border-0 last:mb-0 last:pb-0">
                    <div className="skeleton w-10 h-10 rounded-full flex-shrink-0"></div>
                    <div className="flex-1">
                        <div className="skeleton h-3 w-3/4 mb-2 rounded"></div>
                        <div className="skeleton h-2 w-1/2 rounded"></div>
                    </div>
                    <div className="skeleton w-12 h-6 rounded-md"></div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonSidebarRight;
