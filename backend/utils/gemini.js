const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const GEMINI_MODEL = 'gemini-2.0-flash';

// ─── NVIDIA PHI-4 CLIENT ──────────────────────────────────────────────────────
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY || "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";
const NVIDIA_MODEL = 'microsoft/phi-4-multimodal-instruct';

async function nvidiaChat(messages, maxTokens = 512) {
    const res = await axios.post(NVIDIA_URL, {
        model:             NVIDIA_MODEL,
        messages,
        max_tokens:        maxTokens,
        temperature:       0.10,
        top_p:             0.70,
        frequency_penalty: 0.00,
        presence_penalty:  0.00,
        stream:            false,
    }, {
        headers: {
            Authorization: `Bearer ${NVIDIA_KEY}`,
            Accept:        'application/json',
        },
        timeout: 20000,
    });
    return res.data.choices[0]?.message?.content || '';
}

// ─── CAPTION GENERATION ───────────────────────────────────────────────────────
async function generateCaptionFromImage(imageUrl) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const imageRes = await fetch(imageUrl);
        const buffer   = await imageRes.arrayBuffer();
        const base64   = Buffer.from(buffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const result = await model.generateContent([
            { inlineData: { data: base64, mimeType } },
            'Generate 3 short, engaging social media captions for this image. Return them as a JSON array of strings like: ["caption1", "caption2", "caption3"]. Keep each caption under 100 characters. Be creative and fun.',
        ]);

        const text  = result.response.text().trim();
        const match = text.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);
        return [text];

    } catch (geminiErr) {
        console.warn('[Gemini] Caption failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        const reply = await nvidiaChat([
            {
                role:    'user',
                content: `Look at this image URL: ${imageUrl}\n\nGenerate 3 short, engaging social media captions. Return ONLY a JSON array like: ["caption1", "caption2", "caption3"]. Each caption under 100 characters. Be creative and fun.`,
            },
        ], 300);

        const match = reply.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);

        // If no JSON array found, split by newlines as last resort
        const lines = reply.split('\n').filter(l => l.trim()).slice(0, 3);
        return lines.length ? lines : ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];

    } catch (nvidiaErr) {
        console.error('[NVIDIA] Caption fallback also failed:', nvidiaErr.message);
        return ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];
    }
}

// ─── MOOD DETECTION ───────────────────────────────────────────────────────────
const VALID_MOODS = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
const MOOD_PROMPT = (caption) =>
    `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`;

async function detectMoodFromCaption(caption) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(MOOD_PROMPT(caption));
        const mood   = result.response.text().trim().toLowerCase();
        if (VALID_MOODS.includes(mood)) return mood;

    } catch (geminiErr) {
        console.warn('[Gemini] Mood detection failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        const reply = await nvidiaChat([
            { role: 'user', content: MOOD_PROMPT(caption) }
        ], 10);

        const mood = reply.trim().toLowerCase().split(/\s+/)[0]; // take first word only
        return VALID_MOODS.includes(mood) ? mood : 'neutral';

    } catch (nvidiaErr) {
        console.error('[NVIDIA] Mood fallback also failed:', nvidiaErr.message);
        return 'neutral';
    }
}

// ─── GENERAL TEXT GENERATION (used by chatbot or other features) ──────────────
async function generateText(prompt, { maxTokens = 300, temperature = 0.7 } = {}) {
    // ── Primary: Gemini ──────────────────────────────────────────────────────
    try {
        const model  = genAI.getGenerativeModel({ model: GEMINI_MODEL });
        const result = await model.generateContent(prompt);
        return result.response.text().trim();

    } catch (geminiErr) {
        console.warn('[Gemini] Text generation failed, trying NVIDIA fallback:', geminiErr.message);
    }

    // ── Fallback: NVIDIA Phi-4 ───────────────────────────────────────────────
    try {
        return await nvidiaChat([{ role: 'user', content: prompt }], maxTokens);
    } catch (nvidiaErr) {
        console.error('[NVIDIA] Text generation fallback failed:', nvidiaErr.message);
        return '';
    }
}

module.exports = { generateCaptionFromImage, detectMoodFromCaption, generateText };