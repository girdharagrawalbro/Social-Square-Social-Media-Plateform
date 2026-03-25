const CLOUDINARY_API_BASE_URL =
    process.env.REACT_APP_CLOUDINARY_API_BASE_URL;

function fileToDataUrl(file, onProgress) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onprogress = (event) => {
            if (event.lengthComputable && onProgress) {
                onProgress(Math.min(90, Math.round((event.loaded / event.total) * 90)));
            }
        };

        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file before upload'));

        reader.readAsDataURL(file);
    });
}

async function requestCloudinaryApi(path, method, body) {
    const response = await fetch(`${CLOUDINARY_API_BASE_URL}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok || json?.success === false) {
        throw new Error(json?.message || 'Cloudinary API request failed');
    }
    return json;
}

export async function uploadToCloudinary(file, onProgress, options = {}) {
    const fileBase64 = await fileToDataUrl(file, onProgress);
    const payload = {
        file: fileBase64,
        folder: options.folder,
        resourceType: options.resourceType,
    };

    const json = await requestCloudinaryApi('/upload-base64', 'POST', payload);
    const secureUrl = json?.data?.secure_url;

    if (!secureUrl) {
        throw new Error('Cloudinary upload succeeded but secure_url is missing');
    }

    if (onProgress) onProgress(100);
    return secureUrl;
}

export async function uploadVideoToCloudinary(file, onProgress, options = {}) {
    return uploadToCloudinary(file, onProgress, {
        ...options,
        resourceType: 'video',
    });
}

export async function deleteFromCloudinary(publicId, resourceType = 'image') {
    const json = await requestCloudinaryApi('/delete', 'DELETE', {
        publicId,
        resourceType,
    });
    return json?.data;
}

export function validateImageFile(file) {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const maxSize = 10 * 1024 * 1024; // 10MB

    if (!allowedTypes.includes(file.type)) {
        return 'Only JPEG, PNG, GIF and WebP images are allowed.';
    }
    if (file.size > maxSize) {
        return 'Image must be under 10MB.';
    }
    return null;
}