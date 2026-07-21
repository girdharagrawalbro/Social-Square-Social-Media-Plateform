// ─── CLOUDINARY SERVICE ───────────────────────────────────────────────────────
// Integrated directly into Social Square backend

let _cloudinary = null;

function getCloudinary() {
    if (!_cloudinary) {
        const cloudinary = require('cloudinary').v2;
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
        });
        _cloudinary = cloudinary;
    }
    return _cloudinary;
}

// Upload a base64 string or file path
async function uploadBase64(fileData, options = {}) {
    const cld = getCloudinary();
    
    const uploadOptions = {
        folder: options.folder || 'uploads',
        resource_type: options.resource_type || 'auto',
        ...options,
    };

    // If it's a Data URI, convert to Buffer and use upload_stream
    if (typeof fileData === 'string' && fileData.startsWith('data:')) {
        const parts = fileData.split(';base64,');
        if (parts.length === 2) {
            const mimeTypePart = parts[0]; 
            const base64Content = parts[1];
            const mimeType = mimeTypePart.split(':')[1];
            
            if (mimeType.startsWith('video/')) {
                uploadOptions.resource_type = 'video';
            } else if (mimeType.startsWith('image/')) {
                uploadOptions.resource_type = 'image';
            } else if (mimeType.startsWith('audio/')) {
                uploadOptions.resource_type = 'video';
            } else if (options.resource_type) {
                uploadOptions.resource_type = options.resource_type;
            } else {
                uploadOptions.resource_type = 'auto';
            }
            
            const buffer = Buffer.from(base64Content, 'base64');
            
            return new Promise((resolve, reject) => {
                const stream = cld.uploader.upload_stream(uploadOptions, (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                });
                stream.end(buffer);
            });
        }
    }

    // Fallback for direct file paths or other strings
    return cld.uploader.upload(fileData, uploadOptions);
}

// Upload from a URL (for AI-generated images)
async function uploadFromUrl(url, options = {}) {
    const cld = getCloudinary();
    return cld.uploader.upload(url, {
        folder: options.folder || 'ai-generated',
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

// Generate signature for direct upload
function generateSignature(timestamp, folder) {
    const cld = getCloudinary();
    const paramsToSign = {
        timestamp: Number(timestamp)
    };
    if (folder) {
        paramsToSign.folder = folder;
    }
    const signature = cld.utils.api_sign_request(
        paramsToSign,
        process.env.CLOUDINARY_API_SECRET
    );
    return {
        success: true,
        signature,
        timestamp,
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        folder
    };
}

module.exports = { getCloudinary, uploadBase64, uploadFromUrl, deleteAsset, transformUrl, generateSignature };
