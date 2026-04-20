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

    return (
        <div onClick={() => onClick(post)} 
            className={`relative rounded-xl overflow-hidden bg-gray-100 cursor-pointer transition-all ${isBlur ? 'blur-md grayscale hover:blur-sm' : ''}`} 
            style={{ aspectRatio: '1' }}>
            {previewSrc ? (
                <img src={previewSrc} alt="post" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">
                    {post.caption?.slice(0, 40)}
                </div>
            )}
            {/* Indicators */}
            <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                {images.length > 1 && !isBlur && (
                    <div className="bg-black/40 backdrop-blur-md rounded-lg p-1 w-6 h-6 flex items-center justify-center shadow-lg">
                        <i className="pi pi-images text-white" style={{ fontSize: '12px' }}></i>
                    </div>
                )}
                {isVideo && !isBlur && (
                    <div className="bg-black/40 backdrop-blur-md rounded-lg p-1 w-6 h-6 flex items-center justify-center shadow-lg">
                        <i className="pi pi-video text-white" style={{ fontSize: '10px' }}></i>
                    </div>
                )}
            </div>
            <div className={`absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1 ${isBlur ? 'hidden' : ''}`} style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                <span className="text-white text-[11px]">❤️ {post.likes?.length || 0}</span>
                <span className="text-white text-[11px]">💬 {post.comments?.length || 0}</span>
            </div>
        </div>
    );
};
export default PostCard