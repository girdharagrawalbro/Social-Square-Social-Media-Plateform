const axios = require('./http');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;

// ── Image generation endpoint (NVIDIA FLUX) ──
const IMAGE_API_URL = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

// Fallback helper using Pollinations AI (FLUX / Turbo models - fast, zero-dependency fallback)
async function generatePollinationsFallback(prompt, seed) {
    const models = ['flux', 'turbo'];
    for (const m of models) {
        try {
            const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${seed}&model=${m}`;
            const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
            const buffer = Buffer.from(res.data);
            if (buffer && buffer.length > 1000) {
                const imageBase64 = buffer.toString('base64');
                return {
                    buffer,
                    imageBase64,
                    model: `Social Square AI (Flux-${m})`,
                    seed,
                    finishReason: 'SUCCESS',
                };
            }
        } catch (err) {
            console.warn(`[Pollinations Fallback] Model ${m} failed:`, err.message);
        }
    }
    throw new Error('All image generation providers were unable to complete the request.');
}

// ── Image generation with auto-fallback ─────────────────────────────────────────
async function generateNvidiaImage(prompt, options = {}) {
    const { seed = Math.floor(Math.random() * 1000000) } = options;

    if (!prompt || !String(prompt).trim()) {
        throw new Error('Prompt is required for image generation');
    }

    const payload = {
        prompt,
        seed,
    };

    // 1. Try NVIDIA if API key is available (with a reasonable 15s timeout)
    if (NVIDIA_KEY) {
        try {
            const response = await axios.post(IMAGE_API_URL, payload, {
                headers: {
                    'Authorization': `Bearer ${NVIDIA_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            });

            const body = response.data;
            const artifact = body?.artifacts?.[0];
            const finishReason = artifact?.finish_reason || null;
            const b64 = artifact?.base64;

            if (b64) {
                const cleaned = b64.replace(/^data:image\/\w+;base64,/, '');
                const buffer = Buffer.from(cleaned, 'base64');

                return {
                    buffer,
                    imageBase64: cleaned,
                    model: 'Social Square AI (NVIDIA Flux)',
                    seed: body?.seed ?? seed,
                    finishReason,
                };
            }
        } catch (error) {
            const status = error.response?.status;
            const detail = error.response?.data?.detail || error.response?.data?.title || error.message;
            console.warn(`[NVIDIA Image Warning] status=${status || 'timeout'}: ${detail}. Switching to fast fallback...`);
        }
    }

    // 2. Fast Fallback: Pollinations FLUX / Turbo
    try {
        return await generatePollinationsFallback(prompt, seed);
    } catch (fallbackError) {
        console.error('[Image Generation Fatal]:', fallbackError.message);
        throw new Error(`Image generation failed: ${fallbackError.message}`);
    }
}

module.exports = {
    generateNvidiaImage,
};