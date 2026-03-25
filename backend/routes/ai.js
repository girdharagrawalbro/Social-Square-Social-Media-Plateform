const express = require('express');
const router = express.Router();
const { generateCaptionFromImage, detectMoodFromCaption } = require('../utils/gemini');
const { generateNvidiaText, generateNvidiaImage } = require('../utils/nvidia');
const Post = require('../models/Post');
const User = require('../models/User');
const Category = require('../models/Category');
const AiUsage = require('../models/AiUsage');
const axios = require('axios');
const FormData = require('form-data');
const verifyToken = require('../middleware/Verifytoken');


const DAILY_TEXT_LIMIT = 2;
const DAILY_IMAGE_LIMIT = 2;

// ─── HELPER: AI USAGE LIMITS ─────────────────────────────────────────────────
function getUsageWindowStart() {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return twentyFourHoursAgo;
}

async function getAiUsageCount(userId, type) {
    const usageWindowStart = getUsageWindowStart();
    return AiUsage.countDocuments({
        userId,
        type,
        createdAt: { $gte: usageWindowStart }
    });
}

function getRemaining(limit, count) {
    return Math.max(0, limit - count);
}

async function consumeAiUsage(userId, type) {
    await AiUsage.create({ userId, type });
}

function cleanHashtags(rawTags = []) {
    return [...new Set(
        rawTags
            .filter(Boolean)
            .map(tag => String(tag).trim())
            .filter(Boolean)
            .map(tag => (tag.startsWith('#') ? tag : `#${tag}`))
            .map(tag => tag.replace(/\s+/g, ''))
    )].slice(0, 8);
}

function tryParseJson(text) {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        const match = String(text).match(/\{[\s\S]*\}/);
        if (!match) return null;
        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function uploadGeneratedImageToCloudinary(imageBuffer) {
    if (!imageBuffer) {
        throw new Error('No image buffer provided for upload');
    }
    try {
        const cloudApiBase = process.env.CLOUDINARY_API_BASE_URL;
        const cloudRes = await axios.post(
            `${cloudApiBase}/upload-base64`,
            {
                file: `data:image/png;base64,${imageBuffer.toString('base64')}`
            },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const secureUrl = cloudRes.data?.data?.secure_url;
        if (cloudRes.data?.success === false || !secureUrl) {
            throw new Error(cloudRes.data?.message || 'Invalid Cloudinary upload response');
        }
        return secureUrl;
    } catch (error) {
        const reason = error.response?.data?.message || error.response?.data?.error?.message || error.message;
        throw new Error(`Cloudinary upload failed: ${reason}`);
    }
}

async function uploadImageUrlToCloudinary(url, folder = 'ai-generated') {
    if (!url) {
        throw new Error('No image URL provided for upload');
    }
    try {
        const cloudApiBase = process.env.CLOUDINARY_API_BASE_URL;
        const cloudRes = await axios.post(
            `${cloudApiBase}/upload-url`,
            { url, folder },
            { headers: { 'Content-Type': 'application/json' } }
        );
        const secureUrl = cloudRes.data?.data?.secure_url;
        if (cloudRes.data?.success === false || !secureUrl) {
            throw new Error(cloudRes.data?.message || 'Invalid Cloudinary URL upload response');
        }
        return secureUrl;
    } catch (error) {
        const reason = error.response?.data?.message || error.response?.data?.error?.message || error.message;
        throw new Error(`Cloudinary URL upload failed: ${reason}`);
    }
}

async function deleteImageFromCloudinary(publicId, resourceType = 'image') {
    if (!publicId) {
        throw new Error('publicId is required for Cloudinary delete');
    }
    try {
        const cloudApiBase = process.env.CLOUDINARY_API_BASE_URL;
        const cloudRes = await axios.delete(`${cloudApiBase}/delete`, {
            data: { publicId, resourceType },
            headers: { 'Content-Type': 'application/json' }
        });
        if (cloudRes.data?.success === false) {
            throw new Error(cloudRes.data?.message || 'Invalid Cloudinary delete response');
        }
        return cloudRes.data?.data;
    } catch (error) {
        const reason = error.response?.data?.message || error.response?.data?.error?.message || error.message;
        throw new Error(`Cloudinary delete failed: ${reason}`);
    }
}

// ─── GENERATE TEXT (PROTECTED) ────────────────────────────────────────────────
router.post('/generate-text', verifyToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        const userId = req.userId;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });

        const textCount = await getAiUsageCount(userId, 'text');
        if (textCount >= DAILY_TEXT_LIMIT) {
            return res.status(429).json({ error: 'Daily text generation limit of 2 reached.' });
        }

        const { text, model } = await generateNvidiaText(prompt);
        await consumeAiUsage(userId, 'text');

        const textRemaining = getRemaining(DAILY_TEXT_LIMIT, textCount + 1);
        res.status(200).json({ text, model, remaining: textRemaining, textRemaining });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GENERATE IMAGE (PROTECTED) ───────────────────────────────────────────────
router.post('/generate-image', verifyToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        const userId = req.userId;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });

        const imageCount = await getAiUsageCount(userId, 'image');
        if (imageCount >= DAILY_IMAGE_LIMIT) {
            return res.status(429).json({ error: 'Daily image generation limit of 2 reached.' });
        }

        const { buffer: imageBuffer, imageBase64, model, seed, finishReason } = await generateNvidiaImage(prompt);

        let imageUrl;
        let imageStorage = 'cloudinary';
        try {
            imageUrl = await uploadGeneratedImageToCloudinary(imageBuffer);
        } catch (uploadError) {
            // Fallback for local/dev when Cloudinary is not configured correctly.
            imageUrl = `data:image/jpeg;base64,${imageBase64}`;
            imageStorage = 'inline';
            console.warn('[AI Image Route Warning]:', uploadError.message);
        }

        await consumeAiUsage(userId, 'image');

        const imageRemaining = getRemaining(DAILY_IMAGE_LIMIT, imageCount + 1);

        res.status(200).json({
            imageUrl,
            imageStorage,
            model,
            seed,
            finishReason,
            remaining: imageRemaining,
            imageRemaining,
        });
    } catch (error) {
        console.error('[AI Image Route Error]:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate or upload image' });
    }
});

// ─── GET AI REMAINING LIMIT (PROTECTED) ──────────────────────────────────────────
router.get('/limit', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const [textCount, imageCount] = await Promise.all([
            getAiUsageCount(userId, 'text'),
            getAiUsageCount(userId, 'image'),
        ]);

        const textRemaining = getRemaining(DAILY_TEXT_LIMIT, textCount);
        const imageRemaining = getRemaining(DAILY_IMAGE_LIMIT, imageCount);

        res.json({
            text: { count: textCount, limit: DAILY_TEXT_LIMIT, remaining: textRemaining },
            image: { count: imageCount, limit: DAILY_IMAGE_LIMIT, remaining: imageRemaining },
            remaining: Math.min(textRemaining, imageRemaining),
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── GENERATE CAPTION FROM IMAGE (PROTECTED) ─────────────────────────────────────
router.post('/caption', verifyToken, async (req, res) => {
    try {
        const { imageUrl } = req.body;
        if (!imageUrl) return res.status(400).json({ error: 'imageUrl is required' });

        const captions = await generateCaptionFromImage(imageUrl);
        if (!captions) return res.status(500).json({ error: 'Failed to generate captions' });

        res.status(200).json({ captions });
    } catch (error) {
        console.error('Caption route error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── MOOD-BASED FEED (PROTECTED) ──────────────────────────────────────────────────
router.get('/mood-feed', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { mood } = req.query;

        if (!mood) return res.status(400).json({ error: 'mood is required' });

        const moodGroups = {
            happy: ['happy', 'excited', 'funny'],
            sad: ['sad', 'nostalgic'],
            excited: ['excited', 'happy', 'inspirational'],
            angry: ['angry'],
            calm: ['calm', 'neutral'],
            romantic: ['romantic'],
            funny: ['funny', 'happy'],
            inspirational: ['inspirational', 'excited'],
            nostalgic: ['nostalgic', 'sad'],
            neutral: ['neutral', 'calm', 'happy'],
        };

        const relatedMoods = moodGroups[mood] || [mood, 'neutral'];

        const moodPosts = await Post.find({
            mood: { $in: relatedMoods },
            $or: [{ unlocksAt: null }, { unlocksAt: { $lte: new Date() } }],
            $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
        }).sort({ score: -1, createdAt: -1 }).limit(20);

        res.status(200).json({ posts: moodPosts, mood, relatedMoods });
    } catch (error) {
        console.error('Mood feed error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── DETECT MOOD FROM CAPTION (PROTECTED) ─────────────────────────────────────────
router.post('/detect-mood', verifyToken, async (req, res) => {
    try {
        const { caption } = req.body;
        if (!caption) return res.status(400).json({ error: 'caption is required' });

        const mood = await detectMoodFromCaption(caption);
        res.status(200).json({ mood });
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ─── SUGGEST HASHTAGS + CATEGORY + MOOD (PROTECTED) ─────────────────────────
router.post('/suggest-meta', verifyToken, async (req, res) => {
    try {
        const { caption = '', prompt = '' } = req.body;
        const sourceText = String(caption || prompt || '').trim();
        if (!sourceText) return res.status(400).json({ error: 'caption or prompt is required' });

        const categories = await Category.find().select('category -_id').lean();
        const categoryList = categories.map(c => c.category).filter(Boolean);
        const allowedCategories = categoryList.length ? categoryList : ['Default', 'Nature', 'Travel', 'Food', 'Music', 'Sports', 'Technology', 'Lifestyle'];

        const metaPrompt = [
            'You are a social media assistant.',
            'Return ONLY valid JSON object with keys: hashtags, category, improvedCaption.',
            'hashtags must be an array of 5 to 8 short hashtag strings without spaces.',
            `category must be one of: ${allowedCategories.join(', ')}`,
            'improvedCaption should be concise and engaging (max 220 chars).',
            `Input text: ${sourceText}`,
        ].join('\n');

        const { text } = await generateNvidiaText(metaPrompt);
        const parsed = tryParseJson(text) || {};

        const improvedCaption = String(parsed.improvedCaption || sourceText).trim();
        const hashtags = cleanHashtags(Array.isArray(parsed.hashtags) ? parsed.hashtags : []);
        const requestedCategory = String(parsed.category || '').trim();
        const category = allowedCategories.includes(requestedCategory) ? requestedCategory : 'Default';
        const mood = await detectMoodFromCaption(improvedCaption);

        res.status(200).json({
            improvedCaption,
            hashtags,
            category,
            mood,
        });
    } catch (error) {
        console.error('[AI Suggest Meta Error]:', error.message);
        res.status(500).json({ error: 'Failed to suggest post metadata' });
    }
});

// ─── GENERATE AI TEXT + IMAGE + DIRECTLY CREATE POST (PROTECTED) ────────────
router.post('/generate-and-post', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const { prompt, category: inputCategory = null, makeAnonymous = false } = req.body;
        if (!prompt || !String(prompt).trim()) {
            return res.status(400).json({ error: 'prompt is required' });
        }

        const [textCount, imageCount] = await Promise.all([
            getAiUsageCount(userId, 'text'),
            getAiUsageCount(userId, 'image'),
        ]);

        if (textCount >= DAILY_TEXT_LIMIT && imageCount >= DAILY_IMAGE_LIMIT) {
            return res.status(429).json({ error: 'Daily text and image generation limits reached.' });
        }
        if (textCount >= DAILY_TEXT_LIMIT) {
            return res.status(429).json({ error: 'Daily text generation limit of 2 reached.' });
        }
        if (imageCount >= DAILY_IMAGE_LIMIT) {
            return res.status(429).json({ error: 'Daily image generation limit of 2 reached.' });
        }

        const userDetails = await User.findById(userId).select('fullname profile_picture');
        if (!userDetails) return res.status(404).json({ error: 'User not found' });

        const captionPrompt = [
            'Generate one engaging social media caption based on this prompt.',
            'Keep it under 200 characters and avoid markdown.',
            `Prompt: ${prompt}`,
        ].join('\n');

        const [textResult, imageResult, categoryDocs] = await Promise.all([
            generateNvidiaText(captionPrompt),
            generateNvidiaImage(prompt),
            Category.find().select('category -_id').lean(),
        ]);

        const rawCaption = String(textResult?.text || '').trim() || String(prompt).trim();
        const mood = await detectMoodFromCaption(rawCaption);

        const metaPrompt = [
            'You are a social media classifier.',
            'Return ONLY valid JSON: {"category":"<one category>","hashtags":["#a"]}',
            `Allowed categories: ${(categoryDocs.map(c => c.category).filter(Boolean).join(', ')) || 'Default'}`,
            `Caption: ${rawCaption}`,
        ].join('\n');
        const metaResult = await generateNvidiaText(metaPrompt);
        const parsedMeta = tryParseJson(metaResult.text) || {};

        const allowedCategories = categoryDocs.map(c => c.category).filter(Boolean);
        const selectedCategory = inputCategory
            || (allowedCategories.includes(parsedMeta.category) ? parsedMeta.category : null)
            || 'Default';

        const hashtags = cleanHashtags(Array.isArray(parsedMeta.hashtags) ? parsedMeta.hashtags : []);
        const caption = hashtags.length ? `${rawCaption}\n\n${hashtags.join(' ')}` : rawCaption;

        let imageUrl;
        try {
            imageUrl = await uploadGeneratedImageToCloudinary(imageResult.buffer);
        } catch (uploadError) {
            imageUrl = `data:image/jpeg;base64,${imageResult.imageBase64}`;
            console.warn('[AI Generate And Post Warning]:', uploadError.message);
        }

        const post = await Post.create({
            caption,
            category: selectedCategory,
            image_urls: [imageUrl],
            user: makeAnonymous
                ? { _id: userDetails._id, fullname: 'Anonymous', profile_picture: 'https://ui-avatars.com/api/?name=A&background=808bf5&color=fff' }
                : { _id: userDetails._id, fullname: userDetails.fullname, profile_picture: userDetails.profile_picture },
            mood,
            isAnonymous: !!makeAnonymous,
            isAiGenerated: true,
        });

        await Promise.all([
            consumeAiUsage(userId, 'text'),
            consumeAiUsage(userId, 'image'),
        ]);

        const textRemaining = getRemaining(DAILY_TEXT_LIMIT, textCount + 1);
        const imageRemaining = getRemaining(DAILY_IMAGE_LIMIT, imageCount + 1);

        return res.status(201).json({
            message: 'AI post created successfully',
            post,
            ai: {
                textModel: textResult.model,
                imageModel: imageResult.model,
                remaining: Math.min(textRemaining, imageRemaining),
                textRemaining,
                imageRemaining,
                hashtags,
                mood,
            },
        });
    } catch (error) {
        console.error('[AI Generate And Post Error]:', error.response?.data || error.message);
        return res.status(500).json({ error: 'Failed to generate and create AI post' });
    }
});

module.exports = router;