import React from 'react';

const SkeletonExplore = () => {
    return (
        <div className="p-1 sm:p-2">
            <div className="grid grid-cols-3 gap-1 sm:gap-2">
                {[...Array(12)].map((_, i) => (
                    <div 
                        key={i} 
                        className={`skeleton rounded aspect-square ${
                            i === 1 || i === 7 ? 'row-span-2' : ''
                        }`}
                    ></div>
                ))}
            </div>
        </div>
    );
};

export default SkeletonExplore;
