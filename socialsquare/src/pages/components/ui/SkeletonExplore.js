import React from 'react';

const SkeletonExplore = () => {
    return (
        <div className="px-2 sm:px-4 pb-12">
            <div className="grid grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto gap-2 sm:gap-4">
                {[...Array(6)].map((_, i) => (
                    <div
                        key={i}
                        className="skeleton rounded-2xl w-full"
                        style={{ aspectRatio: '9/16' }}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonExplore;
