const Groq = require('groq-sdk');

let _client = null;

function getClient() {
    if (!process.env.GROQ_API_KEY) {
        throw new Error('GROQ_API_KEY is not set in environment variables.');
    }
    if (!_client) {
        _client = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }
    return _client;
}

const CANDIDATE_MODELS = [
    'groq/compound-mini',
    'llama-3.3-70b-versatile',
    'openai/gpt-oss-20b',
    'llama3-8b-8192',
    'qwen/qwen3.6-27b',
    'openai/gpt-oss-20b'
];

const DEFAULT_MODEL = CANDIDATE_MODELS[0];

// Generate a text response from a single prompt with automatic fallback
async function generateGroqText(prompt, options = {}) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 1024,
        temperature = 0.7,
        topP = 0.9,
    } = options;

    if (!prompt) throw new Error('Prompt is required for generateGroqText');

    const modelsToTry = [model, ...CANDIDATE_MODELS.filter(m => m !== model)];
    let lastError = null;

    for (const currentModel of modelsToTry) {
        try {
            const client = getClient();
            const completion = await client.chat.completions.create({
                model: currentModel,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
            });

            const text = completion.choices[0]?.message?.content || '';
            if (text) {
                return {
                    text,
                    model: `Social Square AI (${currentModel})`,
                };
            }
        } catch (error) {
            lastError = error;
            console.warn(`[Groq Text] Model ${currentModel} failed: ${error.message}. Trying next candidate...`);
        }
    }

    // Secondary fallback: NVIDIA chat
    try {
        const { nvidiaChat } = require('./gemini');
        if (typeof nvidiaChat === 'function') {
            const fallbackText = await nvidiaChat([{ role: 'user', content: prompt }], maxTokens);
            if (fallbackText) {
                return {
                    text: fallbackText,
                    model: 'Social Square AI (NVIDIA)',
                };
            }
        }
    } catch (nvErr) {
        console.error('[Groq NVIDIA Fallback Error]:', nvErr.message);
    }

    console.error('[Groq Text Error Final]:', lastError?.message);
    throw new Error('AI text generation failed. Please try again.');
}

// Generate a chat response from an array of messages
async function generateGroqChat(messages, options = {}) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 1024,
        temperature = 0.7,
        topP = 0.9,
    } = options;

    if (!Array.isArray(messages) || messages.length === 0) {
        throw new Error('Messages array is required for generateGroqChat');
    }

    const modelsToTry = [model, ...CANDIDATE_MODELS.filter(m => m !== model)];
    let lastError = null;

    for (const currentModel of modelsToTry) {
        try {
            const client = getClient();
            const completion = await client.chat.completions.create({
                model: currentModel,
                messages,
                max_tokens: maxTokens,
                temperature,
                top_p: topP,
            });

            const content = completion.choices[0]?.message?.content || '';
            if (content) return content;
        } catch (error) {
            lastError = error;
            console.warn(`[Groq Chat] Model ${currentModel} failed: ${error.message}. Trying next candidate...`);
        }
    }

    // Secondary fallback: NVIDIA chat
    try {
        const { nvidiaChat } = require('./gemini');
        if (typeof nvidiaChat === 'function') {
            const fallbackContent = await nvidiaChat(messages, maxTokens);
            if (fallbackContent) return fallbackContent;
        }
    } catch (nvErr) {
        console.error('[Groq Chat NVIDIA Fallback Error]:', nvErr.message);
    }

    console.error('[Groq Chat Error Final]:', lastError?.message);
    throw new Error('AI chat response generation failed.');
}

module.exports = {
    generateGroqText,
    generateGroqChat,
};
