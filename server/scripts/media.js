/**
 * migrate-media-folders.js
 * 
 * IMPORTANT INSTRUCTIONS BEFORE RUNNING:
 * 1. This script assumes you have Cloudinary credentials. Run `npm install cloudinary` 
 *    in the backend folder before running this script.
 * 2. Add your Cloudinary URL to `backend/.env`:
 *    CLOUDINARY_URL=cloudinary://<API_KEY>:<API_SECRET>@<CLOUD_NAME>
 * 3. Take a complete MongoDB backup. This script modifies records in-place.
 * 4. Run via: `node scripts/migrate-media-folders.js`
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const cloudinary = require('cloudinary').v2;

const User = require('../models/User');
const Post = require('../models/Post');
const Story = require('../models/Story');

const CLOUDINARY_URL = process.env.CLOUDINARY_URL || "cloudinary://516369855465939:C4UC2KURVT_S4kAtYQzwdCbCk3M@dcmrsdydh";
process.env.CLOUDINARY_URL = CLOUDINARY_URL;

// Extract cloud details from connection string
const cloudinaryMatch = CLOUDINARY_URL.match(/cloudinary:\/\/([^:]+):([^@]+)@(.+)$/);
if (cloudinaryMatch) {
    cloudinary.config({
        cloud_name: cloudinaryMatch[3],
        api_key: cloudinaryMatch[1],
        api_secret: cloudinaryMatch[2],
        secure: true
    });
} else {
    cloudinary.config({
        cloud_name: 'dcmrsdydh',
        api_key: '516369855465939',
        api_secret: 'C4UC2KURVT_S4kAtYQzwdCbCk3M',
        secure: true
    });
}

// Connect to DB
async function connectDB() {
    const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://girdharagrawalbro:7909905038@cluster0.czsb19m.mongodb.net/socialsquare?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');
}

// Utility to get the public_id from a Cloudinary URL
function extractPublicId(url) {
    if (!url || !url.includes('cloudinary.com')) return null;
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    // Remove version like /v1234567/
    const path = parts[1].replace(/^v\d+\//, '');
    // Remove extension
    return path.substring(0, path.lastIndexOf('.')) || path;
}

// Utility to get the resource type from a Cloudinary URL
function extractResourceType(url) {
    if (!url) return 'image';
    if (url.includes('/video/upload/')) return 'video';
    if (url.includes('/raw/upload/')) return 'raw';
    return 'image';
}

// Map user IDs to their new base folder paths
const userFolders = new Map();

async function getBaseFolder(userId) {
    if (!userId) return 'SocialSquare/anonymous-user';
    if (userFolders.has(userId.toString())) return userFolders.get(userId.toString());
    const user = await User.findById(userId).select('username').lean();
    if (user && user.username) {
        const path = `SocialSquare/${userId}-${user.username}`;
        userFolders.set(userId.toString(), path);
        return path;
    }
    return `SocialSquare/${userId}`;
}

async function renameCloudinaryFile(oldUrl, newFolderPath) {
    const oldPublicId = extractPublicId(oldUrl);
    if (!oldPublicId) return oldUrl; // Not a standard Cloudinary URL

    const filename = oldPublicId.split('/').pop();
    const newPublicId = `${newFolderPath}/${filename}`;

    const resourceType = extractResourceType(oldUrl);

    try {
        let finalUrl = oldUrl;
        if (oldPublicId !== newPublicId) {
            const result = await cloudinary.uploader.rename(oldPublicId, newPublicId, { resource_type: resourceType });
            finalUrl = result.secure_url;
            console.log(`Renamed in Cloudinary: ${oldPublicId} -> ${newPublicId}`);
        }

        // Always ensure the asset is visually organized in the correct folder in the Cloudinary UI
        try {
            await cloudinary.uploader.explicit(newPublicId, {
                type: 'upload',
                resource_type: resourceType,
                asset_folder: newFolderPath
            });
            console.log(`Organized folder for: ${newPublicId}`);
        } catch (folderErr) {
            console.warn(`Failed to update asset folder for ${newPublicId}:`, folderErr.message);
        }

        return finalUrl;
    } catch (err) {
        if (err.message && err.message.includes('Resource not found')) {
            console.warn(`Resource not found on Cloudinary: ${oldPublicId}. Updating database record to new format anyway.`);
            // Construct the expected new URL format to save to the database so we don't keep retrying it
            const parts = oldUrl.split('/upload/');
            if (parts.length >= 2) {
                const baseUrl = parts[0] + '/upload';
                const versionMatch = parts[1].match(/^v\d+\//);
                const version = versionMatch ? versionMatch[0] : '';
                const cleanPath = parts[1].replace(/^v\d+\//, '');
                const extension = cleanPath.substring(cleanPath.lastIndexOf('.')) || '';
                const expectedUrl = `${baseUrl}/${version}${newPublicId}${extension}`;

                // Try to set the asset_folder on newPublicId in case it was already renamed previously
                try {
                    await cloudinary.uploader.explicit(newPublicId, {
                        type: 'upload',
                        resource_type: resourceType,
                        asset_folder: newFolderPath
                    });
                    console.log(`Organized folder (fallback) for: ${newPublicId}`);
                } catch (e) { }

                return expectedUrl;
            }
        }
        console.error(`Failed to rename ${oldPublicId} to ${newPublicId}`, err.message);
        return oldUrl; // Fallback to old URL if rename fails for other reasons (e.g. auth/network)
    }
}

async function migratePosts() {
    console.log('--- Migrating Posts ---');
    const posts = await Post.find({});
    for (const post of posts) {
        const baseFolder = await getBaseFolder(post.user?._id);
        const postDateStr = new Date(post.createdAt).toISOString().split('T')[0];
        const postFolder = `${baseFolder}/posts/${post._id}-${postDateStr}`;

        let updated = false;

        // Migrate image_urls
        if (post.image_urls && post.image_urls.length > 0) {
            const newUrls = [];
            for (const url of post.image_urls) {
                const newUrl = await renameCloudinaryFile(url, postFolder);
                newUrls.push(newUrl);
                if (newUrl !== url) updated = true;
            }
            post.image_urls = newUrls;
        }

        // Migrate single image_url (if used)
        if (post.image_url) {
            const newUrl = await renameCloudinaryFile(post.image_url, postFolder);
            if (newUrl !== post.image_url) {
                post.image_url = newUrl;
                updated = true;
            }
        }

        // Migrate video
        if (post.video) {
            const newUrl = await renameCloudinaryFile(post.video, postFolder);
            if (newUrl !== post.video) {
                post.video = newUrl;
                updated = true;
            }
        }

        if (updated) {
            await post.save();
            console.log(`Updated Post ${post._id}`);
        }
    }
}

async function migrateProfilePics() {
    console.log('--- Migrating Profile Pictures ---');
    const users = await User.find({ profile_picture: { $exists: true, $ne: '' } });
    for (const user of users) {
        // Check if profile picture is shared (like a default placeholder)
        const count = await User.countDocuments({ profile_picture: user.profile_picture });
        if (count > 1) {
            console.log(`Skipping shared profile picture for User ${user.username} (${user.profile_picture})`);
            continue;
        }

        const baseFolder = await getBaseFolder(user._id);
        const dateStr = new Date().toISOString().split('T')[0];
        const profileFolder = `${baseFolder}/profilepic/${dateStr}`;

        const newUrl = await renameCloudinaryFile(user.profile_picture, profileFolder);
        if (newUrl !== user.profile_picture) {
            user.profile_picture = newUrl;
            await user.save();
            console.log(`Updated User ${user._id} Profile Pic`);
        }
    }
}

// async function migrateStories() {
//     console.log('--- Migrating Stories ---');
//     const stories = await Story.find({});
//     for (const story of stories) {
//         const baseFolder = await getBaseFolder(story.user);
//         const dateStr = new Date(story.createdAt).toISOString().split('T')[0];
//         const storyFolder = `${baseFolder}/stories/${story._id}-${dateStr}`;

//         if (story.mediaUrl) {
//             const newUrl = await renameCloudinaryFile(story.mediaUrl, storyFolder);
//             if (newUrl !== story.mediaUrl) {
//                 story.mediaUrl = newUrl;
//                 await story.save();
//                 console.log(`Updated Story ${story._id}`);
//             }
//         }
//     }
// }

async function run() {
    if (!CLOUDINARY_URL) {
        console.error('CLOUDINARY_URL is missing from .env');
        process.exit(1);
    }

    await connectDB();
    // await migrateProfilePics();
    await migratePosts();
    // await migrateStories();
    console.log('--- Migration Complete ---');
    process.exit(0);
}

run().catch(console.error);