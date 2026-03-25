
// ─── CLOUDINARY SERVICE ───────────────────────────────────────────────────────
// Isolated so routes only load this when they actually need uploads
// Prevents cloudinary SDK from being in memory for routes that never upload

let _cloudinary = null;

function getCloudinary() {
    if (!_cloudinary) {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dcmrsdydh',
            api_key:    process.env.CLOUDINARY_API_KEY || '516369855465939',
            api_secret: process.env.CLOUDINARY_API_SECRET || 'C4UC2KURVT_S4kAtYQzwdCbCk3M',
        });
        _cloudinary = cloudinary;
    }
    return _cloudinary;
}

// Upload a base64 string or file path
async function uploadBase64(base64Data, options = {}) {
    const cld = getCloudinary();
    return cld.uploader.upload(base64Data, {
        folder:        options.folder        || 'uploads',
        resource_type: options.resource_type || 'image',
        ...options,
    });
}

// Upload from a URL (for AI-generated images)
async function uploadFromUrl(url, options = {}) {
    const cld = getCloudinary();
    return cld.uploader.upload(url, {
        folder:        options.folder || 'ai-generated',
        resource_type: 'image',
        ...options,
    });
}

// Delete by public_id
async function deleteAsset(publicId, resourceType = 'image') {
    const cld = getCloudinary();
    return cld.uploader.destroy(publicId, { resource_type: resourceType });
}

// Generate a transformation URL (resize, crop etc) without API call
function transformUrl(publicId, options = {}) {
    const cld = getCloudinary();
    return cld.url(publicId, options);
}

module.exports = { getCloudinary, uploadBase64, uploadFromUrl, deleteAsset, transformUrl };