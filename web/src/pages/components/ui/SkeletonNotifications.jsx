import React from 'react';

const SkeletonNotifications = () => {
    return (
        <div className="flex flex-col gap-1">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="flex items-center gap-3 p-4 border-b border-[var(--border-color)]">
                    <div className="skeleton w-10 h-10 rounded-full flex-shrink-0"></div>
                    <div className="flex-1 flex flex-col gap-2">
                        <div className="skeleton w-full h-4 rounded"></div>
                        <div className="skeleton w-1/4 h-3 rounded"></div>
                    </div>
                    <div className="skeleton w-12 h-12 rounded flex-shrink-0"></div>
                </div>
            ))}
        </div>
    );
};

export default SkeletonNotifications;
