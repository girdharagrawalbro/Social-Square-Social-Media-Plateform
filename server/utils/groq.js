const Groq = require('groq-sdk');

// Groq client using llama-3.1-8b-instant model
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

const DEFAULT_MODEL = 'llama-3.1-8b-instant';

// Generate a text response from a single prompt
async function generateGroqText(prompt, options = {}) {
    const {
        model = DEFAULT_MODEL,
        maxTokens = 1024,
        temperature = 0.7,
        topP = 0.9,
    } = options;

    if (!prompt) throw new Error('Prompt is required for generateGroqText');

    try {
        const client = getClient();
        const completion = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature,
            top_p: topP,
        });

        return {
            text: completion.choices[0]?.message?.content || '',
            model: 'Social Square AI (Groq)',
        };
    } catch (error) {
        const status = error.status || error.response?.status;
        console.error(`[Groq Text Error] status=${status}:`, error.message);
        throw new Error('AI text generation failed. Please try again.');
    }
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

    try {
        const client = getClient();
        const completion = await client.chat.completions.create({
            model,
            messages,
            max_tokens: maxTokens,
            temperature,
            top_p: topP,
        });

        return completion.choices[0]?.message?.content || '';
    } catch (error) {
        const status = error.status || error.response?.status;
        console.error(`[Groq Chat Error] status=${status}:`, error.message);
        throw new Error('AI chat response generation failed.');
    }
}

module.exports = {
    generateGroqText,
    generateGroqChat,
};
