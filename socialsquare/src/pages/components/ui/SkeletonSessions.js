import React from 'react';

const SkeletonSessions = () => {
    return (
        <div className="flex flex-col gap-4">
            {/* 2FA Toggle Skeleton */}
            <div className="flex items-center justify-between p-4 bg-[var(--surface-2)] rounded-3xl border border-[var(--border-color)]">
                <div className="flex-1 flex flex-col gap-2">
                    <div className="skeleton w-3/4 h-5 rounded"></div>
                    <div className="skeleton w-1/2 h-4 rounded"></div>
                </div>
                <div className="skeleton w-12 h-6 rounded-full"></div>
            </div>

            {/* Section Header */}
            <div className="flex items-center justify-between px-2 mt-4">
                <div className="skeleton w-32 h-5 rounded"></div>
                <div className="skeleton w-24 h-4 rounded"></div>
            </div>

            {/* Session Items */}
            {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-4 p-4 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-3xl">
                    <div className="skeleton w-12 h-12 rounded-2xl flex-shrink-0"></div>
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="skeleton w-1/2 h-4 rounded"></div>
                        <div className="skeleton w-3/4 h-3 rounded"></div>
                        <div className="skeleton w-1/3 h-3 rounded"></div>
                    </div>
                    <div className="skeleton w-16 h-8 rounded-xl flex-shrink-0"></div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonSessions;
