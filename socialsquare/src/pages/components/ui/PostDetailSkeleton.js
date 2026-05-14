import React from 'react';

const PostDetailSkeleton = () => {
    return (
        <div className="flex flex-col h-full bg-[var(--surface-1)] overflow-hidden relative">
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT COLUMN - MEDIA SKELETON (Desktop only) */}
                <div className="hidden md:flex flex-1 bg-[var(--surface-2)] items-center justify-center p-0 relative overflow-hidden">
                    <div className="skeleton w-full h-full"></div>
                </div>

                {/* RIGHT COLUMN - ACTIONS & COMMENTS SKELETON */}
                <div className="w-full md:w-[450px] flex flex-col h-full border-l border-[var(--border-color)] bg-[var(--surface-1)]">
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* MOBILE MEDIA SKELETON */}
                        <div className="md:hidden flex-shrink-0 border-b border-[var(--border-color)]">
                            <div className="skeleton w-full h-[34vh] max-h-[360px]"></div>
                        </div>

                        {/* Author & Caption Skeleton */}
                        <div className="px-4 py-3 border-b border-[var(--border-color)]">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="skeleton skeleton-avatar w-8 h-8"></div>
                                    <div className="flex flex-col gap-1">
                                        <div className="skeleton w-24 h-3 rounded"></div>
                                        <div className="skeleton w-16 h-2 rounded"></div>
                                    </div>
                                </div>
                                <div className="skeleton w-6 h-6 rounded"></div>
                            </div>
                            <div className="flex flex-col gap-2">
                                <div className="skeleton w-full h-3 rounded"></div>
                                <div className="skeleton w-4/5 h-3 rounded"></div>
                            </div>
                        </div>

                        {/* Comments Section Skeleton */}
                        <div className="flex-1 px-4 py-4 overflow-hidden">
                            {[1, 2, 3, 4, 5, 6].map((i) => (
                                <div key={i} className="flex items-start gap-3 mb-5">
                                    <div className="skeleton skeleton-avatar w-8 h-8 flex-shrink-0"></div>
                                    <div className="flex-1 flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <div className="skeleton w-20 h-3 rounded"></div>
                                            <div className="skeleton w-12 h-2 rounded opacity-50"></div>
                                        </div>
                                        <div className="skeleton w-full h-2.5 rounded"></div>
                                        <div className="skeleton w-2/3 h-2.5 rounded"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom Actions Skeleton */}
                    <div className="border-t border-[var(--border-color)] bg-[var(--surface-1)]">
                        <div className="flex justify-around items-center py-3 border-b border-[var(--border-color)]">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex flex-col items-center gap-1.5">
                                    <div className="skeleton w-6 h-6 rounded-md"></div>
                                    <div className="skeleton w-8 h-2 rounded opacity-60"></div>
                                </div>
                            ))}
                        </div>

                        <div className="p-4">
                            <div className="skeleton w-24 h-2 rounded mb-4 opacity-50"></div>

                            {/* Similar Posts Skeleton inside the popup */}
                            <div className="mt-2">
                                <div className="skeleton w-24 h-3 rounded mb-3"></div>
                                <div className="grid grid-cols-3 gap-2">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="skeleton aspect-square rounded-xl"></div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PostDetailSkeleton;
