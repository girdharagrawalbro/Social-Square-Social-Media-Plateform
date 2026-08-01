const axios = require('./http');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;

// ── Image generation endpoint (NVIDIA FLUX — kept here, Groq has no image gen) ──
const IMAGE_API_URL = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

// ── Image generation (FLUX.1-schnell via NVIDIA AI Foundation) ────────────────
/**
 * generateNvidiaImage(prompt, options?)
 * NOTE: Text/chat generation has moved to utils/groq.js (free tier).
 */
async function generateNvidiaImage(prompt, options = {}) {
    if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY is not set');

    const { seed = 0 } = options;

    const payload = {
        prompt,
        seed: seed || Math.floor(Math.random() * 1000000),
    };

    try {
        const response = await axios.post(IMAGE_API_URL, payload, {
            headers: {
                'Authorization': `Bearer ${NVIDIA_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            timeout: 60000,
        });

        const body = response.data;

        // NVIDIA GenAI response shape: { artifacts: [{ base64: "...", finish_reason: "..." }], seed: N }
        const artifact = body?.artifacts?.[0];
        const finishReason = artifact?.finish_reason || null;
        const b64 = artifact?.base64;

        if (!b64) {
            throw new Error('No image data in NVIDIA response. Full response: ' + JSON.stringify(body));
        }

        const cleaned = b64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleaned, 'base64');

        return {
            buffer,
            imageBase64: cleaned,
            model: 'Social Square AI (Flux)',
            seed: body?.seed ?? seed,
            finishReason,
        };

    } catch (error) {
        const status = error.response?.status;
        const detail = error.response?.data?.detail || error.response?.data?.title || error.message;

        console.error(`[NVIDIA Image Error] status=${status}:`, detail);
        throw new Error(`Image generation failed (${status ?? 'network'}): ${detail}`);
    }
}

module.exports = {
    generateNvidiaImage,
};