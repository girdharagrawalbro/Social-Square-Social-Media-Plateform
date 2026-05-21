import React from 'react';

const SimilarPostsSkeleton = () => {
    return (
        <div className="p-4 border-t border-[var(--border-color)] bg-[var(--surface-1)]">
            <div className="skeleton w-24 h-3 rounded mb-3"></div>
            <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="skeleton aspect-square rounded-xl"></div>
                ))}
            </div>
        </div>
    );
};

export default SimilarPostsSkeleton;
