import React from 'react'
import { getMediaThumbnail } from '../../../utils/mediaUtils';

const PostCard = ({ post, onClick, isBlur = false }) => {
    const isVideo = !!post.video;
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];

    // Choose the best preview image
    let previewSrc = images.length > 0 ? images[0] : null;
    if (isVideo) {
        previewSrc = post.videoThumbnail || getMediaThumbnail(post.video, 'video');
    } else if (post.isBeforeAfter && !previewSrc) {
        if (post.beforeAfter?.type === 'code') {
            previewSrc = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1782133031/ChatGPT_Image_Jun_22_2026_06_26_15_PM_j0k8kg.png";
        } else if (post.beforeAfter?.type === 'text') {
            previewSrc = "https://res.cloudinary.com/dcmrsdydh/image/upload/v1782133031/ChatGPT_Image_Jun_22_2026_06_24_51_PM_qshub2.png";
        }
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
                    {!post.isFeedbackRequest ? (
                        <div className="flex items-center gap-1.5 text-white">
                            <i className="pi pi-star-fill text-lg text-amber-400"></i>
                            <span className="font-bold text-sm">{formatCount(likesCount)}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 text-[#a5b4fc]">
                            <i className="pi pi-comments text-lg animate-pulse"></i>
                            <span className="font-bold text-xs uppercase tracking-wider">Critique</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5 text-white">
                        <i className="pi pi-comment text-lg"></i>
                        <span className="font-bold text-sm">{formatCount(commentsCount)}</span>
                    </div>
                </div>
            )}

            {/* Icons Indicators */}
            <div className="absolute top-2 right-2 flex flex-col gap-1.5 z-10">
                {post.depthScore && (
                    <div className={`text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md ${
                        post.depthScore === 'quick_take' ? 'bg-amber-500' :
                        post.depthScore === 'deep_dive' ? 'bg-blue-600' :
                        'bg-purple-600'
                    }`} title={
                        post.depthScore === 'quick_take' ? 'Quick Take' :
                        post.depthScore === 'deep_dive' ? 'Deep Dive' :
                        'Long Read'
                    }>
                        <i className={`pi ${
                            post.depthScore === 'quick_take' ? 'pi-bolt' :
                            post.depthScore === 'deep_dive' ? 'pi-info-circle' :
                            'pi-book'
                        } text-[9px]`}></i>
                        <span>{
                            post.depthScore === 'quick_take' ? 'QUICK' :
                            post.depthScore === 'deep_dive' ? 'DEEP' :
                            'LONG'
                        }</span>
                    </div>
                )}
                {post.goalId && (
                    <div className="bg-emerald-600 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md" title={`Linked to goal: ${post.goalId.title || 'Goal'}`}>
                        <i className="pi pi-target text-[9px]"></i>
                        <span>GOAL</span>
                    </div>
                )}
                {post.isFeedbackRequest && (
                    <div className="bg-[#6366f1] text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-md">
                        <i className="pi pi-comments text-[9px]"></i>
                        <span>{post.feedbackCategory ? post.feedbackCategory.toUpperCase() : 'FEEDBACK'}</span>
                    </div>
                )}
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
