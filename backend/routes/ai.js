const express = require('express');
const router = express.Router();
const { generateCaptionFromImage, detectMoodFromCaption } = require('../utils/gemini');
const { generateNvidiaText, generateNvidiaImage } = require('../utils/nvidia');
const Post = require('../models/Post');
const User = require('../models/User');
const Category = require('../models/Category');
const axios = require('axios');
const FormData = require('form-data');
const verifyToken = require('../middleware/Verifytoken');


// ─── HELPER: CHECK AI LIMIT ───────────────────────────────────────────────────
async function checkAiLimit(userId) {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const count = await Post.countDocuments({
        'user._id': userId,
        isAiGenerated: true,
        createdAt: { $gte: twentyFourHoursAgo }
    });
    return count;
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
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'dcmrsdydr';
    const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET || 'socialsquare';

    const formData = new FormData();
    formData.append('file', `data:image/jpeg;base64,${imageBuffer.toString('base64')}`);
    formData.append('upload_preset', uploadPreset);

    const cloudRes = await axios.post(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        formData,
        { headers: { ...formData.getHeaders() } }
    );

    return cloudRes.data.secure_url;
}

// ─── GENERATE TEXT (PROTECTED) ────────────────────────────────────────────────
router.post('/generate-text', verifyToken, async (req, res) => {
    try {
        const { prompt } = req.body;
        const userId = req.userId;
        if (!prompt) return res.status(400).json({ error: 'prompt is required' });
 
        const count = await checkAiLimit(userId);
        if (count >= 2) {
            return res.status(429).json({ error: 'Daily limit of 2 AI posts reached.' });
        }
 
        const { text, model } = await generateNvidiaText(prompt);
        res.status(200).json({ text, model, remaining: Math.max(0, 2 - count) });
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
 
        const count = await checkAiLimit(userId);
        if (count >= 2) {
            return res.status(429).json({ error: 'Daily limit of 2 AI posts reached.' });
        }
 
        const { buffer: imageBuffer, model } = await generateNvidiaImage(prompt);
        const imageUrl = await uploadGeneratedImageToCloudinary(imageBuffer);
 
        res.status(200).json({ 
            imageUrl,
            model,
            remaining: Math.max(0, 2 - count)
        });
    } catch (error) {
        console.error('[AI Image Route Error]:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to generate or upload image' });
    }
});

// ─── GET AI REMAINING LIMIT (PROTECTED) ──────────────────────────────────────────
router.get('/limit', verifyToken, async (req, res) => {
    try {
        const count = await checkAiLimit(req.userId);
        res.json({ count, limit: 2, remaining: Math.max(0, 2 - count) });
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

        const count = await checkAiLimit(userId);
        if (count >= 2) {
            return res.status(429).json({ error: 'Daily limit of 2 AI posts reached.' });
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

        const imageUrl = await uploadGeneratedImageToCloudinary(imageResult.buffer);

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

        return res.status(201).json({
            message: 'AI post created successfully',
            post,
            ai: {
                textModel: textResult.model,
                imageModel: imageResult.model,
                remaining: Math.max(0, 1 - count),
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