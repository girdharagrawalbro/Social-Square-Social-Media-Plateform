import React from 'react';

const SkeletonProfile = () => {
    return (
        <div className="w-full max-w-xl mx-auto p-4 flex flex-col gap-6">
            {/* Header: Avatar and identity */}
            <div className="flex flex-col items-center gap-3">
                <div className="skeleton w-20 h-20 rounded-full"></div>
                <div className="skeleton w-40 h-6 rounded"></div>
                <div className="skeleton w-24 h-4 rounded"></div>
                <div className="skeleton w-64 h-3 rounded mt-2"></div>
            </div>

            {/* Level/Streak/XP Stats */}
            <div className="flex gap-3 justify-center">
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton w-[80px] h-[60px] rounded-xl"></div>
                ))}
            </div>

            {/* Main Stats Tiles */}
            <div className="grid grid-cols-4 gap-2 sm:gap-3">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton w-full h-[60px] sm:h-[80px] rounded-xl"></div>
                ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
                <div className="skeleton flex-1 h-10 rounded-xl"></div>
                <div className="skeleton flex-1 h-10 rounded-xl"></div>
                <div className="skeleton w-10 h-10 rounded-xl"></div>
            </div>

            {/* Tabs Bar */}
            <div className="flex border-b border-[var(--border-color)] pb-1 gap-4">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton w-20 h-8 rounded-md"></div>
                ))}
            </div>

            {/* Post Grid */}
            <div className="grid grid-cols-3 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => (
                    <div key={i} className="skeleton aspect-square rounded"></div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonProfile;
