import React from 'react'
import { getMediaThumbnail } from '../../../utils/mediaUtils';

const PostCard = ({ post, onClick, isBlur = false }) => {
    const isVideo = !!post.video;
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    // Choose the best preview image
    let previewSrc = images.length > 0 ? images[0] : null;
    if (isVideo) {
        previewSrc = post.videoThumbnail || getMediaThumbnail(post.video, 'video');
    }

    const likesCount = post.likesCount !== undefined ? post.likesCount : (post.likes?.length || 0);
    const commentsCount = post.commentsCount !== undefined ? post.commentsCount : (post.comments?.length || 0);

    const formatCount = (count) => {
        if (count >= 1000000) return (count / 1000000).toFixed(1) + 'M';
        if (count >= 1000) return (count / 1000).toFixed(1) + 'K';
        return count;
    };

    return (
        <div onClick={() => onClick(post)}
            className={`relative aspect-square overflow-hidden bg-[var(--surface-2)] cursor-pointer group transition-all duration-300 ${isBlur ? 'blur-lg pointer-events-none' : ''}`}
        >
            {previewSrc ? (
                <img
                    src={previewSrc}
                    alt="post"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-[var(--text-sub)] text-[10px] p-2 text-center opacity-40 italic">
                    {post.caption?.slice(0, 40)}
                </div>
            )}

            {/* Hover Overlay */}
            {!isBlur && (
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-1.5 text-white">
                        <i className="pi pi-heart-fill text-lg"></i>
                        <span className="font-bold text-sm">{formatCount(likesCount)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-white">
                        <i className="pi pi-comment text-lg"></i>
                        <span className="font-bold text-sm">{formatCount(commentsCount)}</span>
                    </div>
                </div>
            )}

            {/* Icons Indicators */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                {post.isPinned && (
                    <div className="drop-shadow-lg">
                        <i className="pi pi-map-marker text-white text-xs rotate-45" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}></i>
                    </div>
                )}
                {images.length > 1 && !isBlur && (
                    <div className="drop-shadow-lg">
                        <i className="pi pi-clone text-white text-[10px]" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}></i>
                    </div>
                )}
                {isVideo && !isBlur && (
                    <div className="drop-shadow-lg">
                        <i className="pi pi-video text-white text-[10px]" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}></i>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PostCard;
