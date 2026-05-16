const OpenAI = require('openai');
const axios = require('./http');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// ── Working Flux endpoint (NVIDIA AI Foundation Models) ──────────────────────
const IMAGE_API_URL = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

function createClient() {
    if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY is not set');
    return new OpenAI({ baseURL: NVIDIA_BASE_URL, apiKey: NVIDIA_KEY });
}

// ── Text generation via NVIDIA Llama 3.1 ──────────────────────────────────────
async function generateNvidiaText(prompt) {
    if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY is not set');
    try {
        const client = createClient();
        const completion = await client.chat.completions.create({
            model: 'meta/llama-3.1-8b-instruct',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 1024,
        });
        return {
            text: completion.choices[0]?.message?.content || '',
            model: 'Social Square AI',
        };
    } catch (error) {
        const status = error.status || error.response?.status;
        console.error(`[NVIDIA Text Error] status=${status}:`, error.message);
        throw new Error('AI text generation failed. Please try again.');
    }
}

// ── Image generation (FLUX.1-schnell via NVIDIA AI Foundation) ────────────────
/**
 * generateNvidiaImage(prompt, options?)
 */
async function generateNvidiaImage(prompt, options = {}) {
    if (!NVIDIA_KEY) throw new Error('NVIDIA_API_KEY is not set');

    const {
        seed = 0,
        modelVariant = 'standard', 
    } = options;

    // Map variant to parameters if needed
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
    generateNvidiaText,
    generateNvidiaImage,
};