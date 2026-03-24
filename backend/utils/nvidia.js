const OpenAI = require('openai');
const { generateText } = require('./gemini');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';
const NVIDIA_SD3_INVOKE_URL = 'https://ai.api.nvidia.com/v1/genai/stabilityai/stable-diffusion-3-medium';

function createClient() {
    if (!NVIDIA_KEY) {
        throw new Error('NVIDIA_API_KEY is not set');
    }
    return new OpenAI({
        baseURL: NVIDIA_BASE_URL,
        apiKey: NVIDIA_KEY,
    });
}

/**
 * Generate text using NVIDIA's Llama model
 * Fallback to Gemini if NVIDIA fails
 */
async function generateNvidiaText(prompt) {
    try {
        const client = createClient();
        const completion = await client.chat.completions.create({
            model: 'nvidia/llama3-chatqa-1.5-8b',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.7,
            top_p: 0.9,
            max_tokens: 512,
        });
        return {
            text: completion.choices[0]?.message?.content || '',
            model: 'NVIDIA (llama3)'
        };
    } catch (error) {
        console.warn('[NVIDIA Text Error] Falling back to Gemini:', error.message);
        try {
            const text = await generateText(prompt);
            return { text, model: 'Gemini (Backup)' };
        } catch (geminiError) {
            console.error('[Fallback Error]:', geminiError.message);
            throw new Error('AI Text generation failed on all providers.');
        }
    }
}

/**
 * Generate image using NVIDIA's Stable Diffusion model (SDXL)
 */
async function generateNvidiaImage(prompt) {
    if (!NVIDIA_KEY) {
        throw new Error('NVIDIA_API_KEY is not set');
    }
    try {
        const headers = {
            "Authorization": `Bearer ${NVIDIA_KEY}`,
            "Accept": "application/json",
        }
        const payload = {
            "prompt": prompt,
            "cfg_scale": 5,
            "aspect_ratio": "16:9",
            "seed": 0,
            "steps": 50,
            "negative_prompt": ""
        }
        const response = await fetch(
            NVIDIA_SD3_INVOKE_URL,
            {
                method: 'POST',
                headers: {
                    ...headers,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            }
        );
        if (response.status !== 200) {
            const errBody = await response.text();
            throw new Error(`invocation failed with status ${response.status} ${errBody}`);
        }

        const response_body = await response.json();
        const finishReason = response_body?.finish_reason || null;
        if (finishReason) {
            console.log(`[NVIDIA SD3] finish_reason=${finishReason}`);
        }

        const b64 = typeof response_body?.image === 'string'
            ? response_body.image
            : response_body?.image?.base64;
        if (!b64) {
            throw new Error('No image data received from NVIDIA');
        }
        const cleaned = b64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(cleaned, 'base64');

        return {
            buffer,
            imageBase64: cleaned,
            model: 'NVIDIA (stable-diffusion-3-medium)',
            seed: response_body?.seed,
            finishReason,
        };
    } catch (error) {
        const details = error.response?.data
            ? JSON.stringify(error.response.data)
            : error.message;
        throw new Error(`Image generation failed: ${details}`);
    }
}

module.exports = {
    generateNvidiaText,
    generateNvidiaImage,
};
