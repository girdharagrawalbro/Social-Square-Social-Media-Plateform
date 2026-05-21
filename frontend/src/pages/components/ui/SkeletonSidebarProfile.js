import React from 'react';

const SkeletonSidebarProfile = () => {
    return (
        <div className="p-5 bg-[var(--surface-1)] rounded-2xl shadow-sm border border-[var(--border-color)] overflow-hidden" style={{ borderWidth: '0.5px' }}>
            {/* Profile Picture */}
            <div className="skeleton w-20 h-20 rounded-full mx-auto mb-4"></div>

            {/* Profile Name & Tag */}
            <div className="skeleton h-5 w-3/4 mx-auto mb-2 rounded"></div>
            <div className="skeleton h-3 w-1/2 mx-auto mb-6 rounded"></div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                {[1, 2, 3].map(i => (
                    <div key={i} className="text-center">
                        <div className="skeleton h-5 w-full mb-1 rounded"></div>
                        <div className="skeleton h-3 w-3/4 mx-auto rounded"></div>
                    </div>
                ))}
            </div>

            {/* CTA Button */}
            <div className="skeleton h-10 w-full mb-2 rounded-xl"></div>
        </div>
    );
};

export default SkeletonSidebarProfile;
