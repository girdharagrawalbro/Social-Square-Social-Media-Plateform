import React from 'react';

const SkeletonPulse = () => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Column 1: Trending Tags */}
            <div className="flex flex-col gap-4">
                <div className="skeleton w-1/2 h-6 rounded mb-2"></div>
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton w-full h-[80px] rounded-2xl"></div>
                ))}
            </div>

            {/* Column 2: Rising Stars */}
            <div className="flex flex-col gap-4">
                <div className="skeleton w-1/2 h-6 rounded mb-2"></div>
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex gap-4 p-3 items-center">
                        <div className="skeleton w-14 h-14 rounded-full flex-shrink-0"></div>
                        <div className="flex-1 flex flex-col gap-2">
                            <div className="skeleton w-3/4 h-4 rounded"></div>
                            <div className="skeleton w-1/2 h-3 rounded"></div>
                        </div>
                        <div className="skeleton w-10 h-6 rounded flex-shrink-0"></div>
                    </div>
                ))}
            </div>

            {/* Column 3: Hot Topics */}
            <div className="flex flex-col gap-4">
                <div className="skeleton w-1/2 h-6 rounded mb-2"></div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton w-full h-[120px] rounded-3xl"></div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonPulse;
