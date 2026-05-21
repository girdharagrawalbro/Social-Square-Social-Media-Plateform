import React from 'react';

const SkeletonCommunities = () => {
    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="flex gap-2 overflow-x-hidden pb-2">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="skeleton h-8 w-24 rounded-full flex-shrink-0"></div>
                ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-4 flex flex-col gap-3">
                        <div className="flex gap-3">
                            <div className="skeleton w-12 h-12 rounded-xl flex-shrink-0"></div>
                            <div className="flex-1 flex flex-col gap-2">
                                <div className="skeleton w-3/4 h-5 rounded"></div>
                                <div className="skeleton w-1/2 h-4 rounded"></div>
                            </div>
                        </div>
                        <div className="skeleton w-full h-24 rounded-xl"></div>
                        <div className="flex justify-between items-center mt-2">
                            <div className="skeleton w-20 h-4 rounded"></div>
                            <div className="skeleton w-24 h-8 rounded-lg"></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonCommunities;
