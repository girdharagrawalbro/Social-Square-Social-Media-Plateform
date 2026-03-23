const axios = require('axios');
const OpenAI = require('openai');
const { generateText } = require('./gemini');

const NVIDIA_KEY = process.env.NVIDIA_API_KEY;
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

const client = new OpenAI({
    baseURL: NVIDIA_BASE_URL,
    apiKey: NVIDIA_KEY,
});

/**
 * Generate text using NVIDIA's Llama model
 * Fallback to Gemini if NVIDIA fails
 */
async function generateNvidiaText(prompt) {
    try {
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
    const models = ['stabilityai/stable-diffusion-xl', 'nvidia/sdxl-turbo'];
    let lastError = null;

    for (const model of models) {
        try {
            const response = await axios.post(
                `${NVIDIA_BASE_URL}/images/generations`,
                {
                    model: model,
                    prompt: prompt,
                    response_format: 'b64_json',
                },
                {
                    headers: {
                        Authorization: `Bearer ${NVIDIA_KEY}`,
                        Accept: 'application/json',
                    },
                    timeout: 30000,
                }
            );

            const b64Data = response.data.data[0].b64_json;
            return { 
                buffer: Buffer.from(b64Data, 'base64'), 
                model: `NVIDIA (${model.split('/')[1]})` 
            };
        } catch (error) {
            console.warn(`[NVIDIA Image Error] Model ${model} failed:`, error.message);
            lastError = error;
        }
    }

    // If both NVIDIA models fail, we don't have a Gemini image fallback in this setup yet.
    throw new Error('Image generation failed: ' + (lastError.response?.data?.message || lastError.message));
}

module.exports = {
    generateNvidiaText,
    generateNvidiaImage,
};
