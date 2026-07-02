/**
 * Utility for handling media transformations, specifically for Cloudinary.
 */

export const getMediaThumbnail = (url, type = 'image', options = {}) => {
  if (!url) return null;

  // 1. If it's a Cloudinary URL, we can perform transformations
  if (url.includes('cloudinary.com')) {
    if (type === 'video') {
      // Cloudinary video URLs handle transformations differently than images
      // Format: .../video/upload/[transformations]/v[version]/[public_id].[ext]
      
      // Handle extension replacement or appending
      let thumbnailUrl = url;
      if (/\.(mp4|webm|mov|ogg)$/i.test(url)) {
        thumbnailUrl = url.replace(/\.(mp4|webm|mov|ogg)$/i, '.jpg');
      } else if (!url.toLowerCase().endsWith('.jpg') && !url.toLowerCase().endsWith('.png') && !url.toLowerCase().endsWith('.jpeg')) {
        // If no extension, append .jpg to tell Cloudinary we want a frame
        thumbnailUrl = `${url}.jpg`;
      }
      
      // Inject transformations after /video/upload/ or /image/upload/
      const transformString = `c_fill,g_auto,so_1,w_600,h_600`;
      
      if (thumbnailUrl.includes('/video/upload/')) {
        thumbnailUrl = thumbnailUrl.replace('/video/upload/', `/video/upload/${transformString}/`);
      } else if (thumbnailUrl.includes('/image/upload/')) {
        thumbnailUrl = thumbnailUrl.replace('/image/upload/', `/image/upload/${transformString}/`);
      }
      
      return thumbnailUrl;
    }
    
    // For images, we can also optimize the thumbnail size
    if (type === 'image' && options.optimize) {
      const width = options.width || 600;
      return url.replace('/upload/', `/upload/c_fill,g_auto,w_${width}/`);
    }
  }

  // 2. Fallback for non-Cloudinary videos (Google Drive, raw MP4s, etc.)
  // We cannot easily generate client-side thumbnails for these, so we return 
  // a stylized placeholder instead of the video URL (which fails in <img> tags)
  if (type === 'video') {
    return 'https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=600&q=80';
  }

  return url;
};


/**
 * Checks if a URL is likely a video based on extension
 */
export const isVideoUrl = (url) => {
  return /\.(mp4|webm|mov|ogg)$/i.test(url);
};
