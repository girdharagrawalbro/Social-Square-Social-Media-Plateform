/**
 * Utility for handling media transformations, specifically for Cloudinary.
 */

export const getMediaThumbnail = (url, type = 'image', options = {}) => {
  if (!url) return null;

  // If it's a Cloudinary URL, we can perform transformations
  if (url.includes('cloudinary.com')) {
    if (type === 'video') {
      // 1. Convert extension to .jpg
      // 2. Add thumbnail transformations: 
      //    c_fill: crop/fill to size
      //    g_auto: automatic gravity (focus on subject)
      //    so_auto: automatic start offset (find a good frame)
      //    w, h: dimensions (default to 600 for high quality previews)
      
      
      // Cloudinary video URLs handle transformations differently than images
      // Format: .../video/upload/[transformations]/v[version]/[public_id].[ext]
      
      // Replace extension
      let thumbnailUrl = url.replace(/\.(mp4|webm|mov|ogg)$/i, '.jpg');
      
      // Inject transformations after /video/upload/
      // Match the exact eager transformation string used in the backend for authorization
      const transformString = `c_fill,g_auto,so_auto,w_600,h_600`;
      
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

  return url;
};

/**
 * Checks if a URL is likely a video based on extension
 */
export const isVideoUrl = (url) => {
  return /\.(mp4|webm|mov|ogg)$/i.test(url);
};
