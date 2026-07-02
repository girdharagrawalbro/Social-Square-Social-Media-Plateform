const axios = require('./http');

// ─── NVIDIA MULTIMODAL CLIENT ────────────────────────────────────────────────
// Using Llama 3.2 Vision for high-quality image analysis and text generation.
const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_MODEL = 'meta/llama-3.2-11b-vision-instruct';

async function nvidiaChat(messages, maxTokens = 512) {
    if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY is not set');

    const res = await axios.post(NVIDIA_URL, {
        model: NVIDIA_MODEL,
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        top_p: 0.7,
        stream: false,
    }, {
        headers: {
            Authorization: `Bearer ${NVIDIA_KEY}`,
            Accept: 'application/json',
        },
        timeout: 30000,
    });
    return res.data.choices[0]?.message?.content || '';
}

// ─── CAPTION GENERATION ───────────────────────────────────────────────────────
async function generateCaptionFromImage(imageUrl) {
    try {
        const reply = await nvidiaChat([
            {
                role: 'user',
                content: [
                    { type: 'text', text: 'Generate 3 short, engaging social media captions for this image. Return ONLY a JSON array of strings like: ["caption1", "caption2", "caption3"]. Keep each caption under 100 characters. Be creative and fun.' },
                    { type: 'image_url', image_url: { url: imageUrl } }
                ]
            }
        ], 512);

        const match = reply.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);

        const lines = reply.split('\n').filter(l => l.trim()).slice(0, 3);
        return lines.length ? lines : ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];

    } catch (error) {
        console.error('[NVIDIA Caption Error]:', error.message);
        return ['✨ Check this out!', '🔥 Loving this!', '💫 Moment captured.'];
    }
}

// ─── MOOD DETECTION ───────────────────────────────────────────────────────────
const VALID_MOODS = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
const MOOD_PROMPT = (caption) =>
    `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`;

async function detectMoodFromCaption(caption) {
    if (!caption || !String(caption).trim()) return 'neutral';

    try {
        const reply = await nvidiaChat([
            { role: 'user', content: MOOD_PROMPT(caption) }
        ], 16);

        const mood = reply.trim().toLowerCase().split(/\s+/)[0].replace(/[^a-z]/g, '');
        return VALID_MOODS.includes(mood) ? mood : 'neutral';

    } catch (error) {
        console.error('[NVIDIA Mood Error]:', error.message);
        return 'neutral';
    }
}

// ─── GENERAL TEXT GENERATION ──────────────────────────────────────────────────
async function generateText(prompt, { maxTokens = 512, temperature = 0.7 } = {}) {
    try {
        const res = await axios.post(NVIDIA_URL, {
            model: 'meta/llama-3.1-8b-instruct', // Using a standard text model for speed
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: temperature,
            top_p: 0.7,
            stream: false,
        }, {
            headers: {
                Authorization: `Bearer ${NVIDIA_KEY}`,
                Accept: 'application/json',
            },
            timeout: 25000,
        });

        return res.data.choices[0]?.message?.content?.trim() || '';
    } catch (error) {
        console.error('[NVIDIA Text Generation Error]:', error.message);
        return '';
    }
}

module.exports = { generateCaptionFromImage, detectMoodFromCaption, generateText };