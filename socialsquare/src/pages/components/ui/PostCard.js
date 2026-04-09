import React from 'react'
const PostCard = ({ post, onClick, isBlur = false }) => {
    const images = post.image_urls?.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : [];
    return (
        <div onClick={() => onClick(post)} 
            className={`relative rounded-xl overflow-hidden bg-gray-100 cursor-pointer transition-all ${isBlur ? 'blur-md grayscale hover:blur-sm' : ''}`} 
            style={{ aspectRatio: '1' }}>
            {images.length > 0 ? (
                <img src={images[0]} alt="post" className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs p-2 text-center">
                    {post.caption?.slice(0, 40)}
                </div>
            )}
            {images.length > 1 && !isBlur && (
                <div className="absolute top-1 right-1 bg-black bg-opacity-50 rounded px-1">
                    <i className="pi pi-images text-white" style={{ fontSize: '10px' }}></i>
                </div>
            )}
            <div className={`absolute bottom-0 left-0 right-0 flex gap-2 px-2 py-1 ${isBlur ? 'hidden' : ''}`} style={{ background: 'linear-gradient(transparent, rgba(0,0,0,0.5))' }}>
                <span className="text-white text-[11px]">❤️ {post.likes?.length || 0}</span>
                <span className="text-white text-[11px]">💬 {post.comments?.length || 0}</span>
            </div>
        </div>
    );
};
export default PostCard