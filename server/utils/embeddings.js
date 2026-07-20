const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const OLLAMA_EMBED_URL = process.env.OLLAMA_URL 
    ? process.env.OLLAMA_URL.replace('/api/generate', '/api/embeddings') 
    : 'http://localhost:11434/api/embeddings';

// all-minilm is 384 dimensions.
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'all-minilm';

// Cache to remember if Ollama is running, to avoid repeated timeouts.
let ollamaAvailable = true;
let geminiClient = null;

// Initialize Gemini Client if key is available
if (process.env.GEMINI_API_KEY) {
    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        geminiClient = genAI.getGenerativeModel({ model: 'gemini-embedding-2' });
        console.log('[Embeddings] Google Gemini (gemini-embedding-2) initialized successfully.');
    } catch (err) {
        console.warn('[Embeddings] Failed to initialize Gemini client:', err.message);
    }
}

/**
 * Generates an embedding for the given text.
 * - In production: uses Google Gemini (gemini-embedding-2) with 384 dimensions.
 * - In development: uses local Ollama (all-minilm), with a fallback to Gemini or local transformers.
 * 
 * @param {string} text - The text to embed.
 * @param {number} retries - Maximum number of retries.
 * @param {number} initialDelay - Initial delay for backoff.
 * @returns {Promise<number[]>} - The embedding vector (384 dimensions).
 */
async function getEmbedding(text, retries = 3, initialDelay = 1000) {
    if (!text || text.trim() === '') return [];

    const isProd = process.env.NODE_ENV === 'production';
    
    // ─── 1. PRODUCTION MODE: Use Gemini ──────────────────────────────────────
    if (isProd) {
        if (geminiClient) {
            try {
                const response = await geminiClient.embedContent({
                    content: { parts: [{ text }] },
                    outputDimensionality: 384
                });
                if (response?.embedding?.values) {
                    return response.embedding.values;
                }
            } catch (err) {
                console.error('[Embeddings] Production Gemini embedding failed:', err.message);
            }
        }
        // If Gemini is not configured or failed in production, fallback to local transformers (in-process)
        return getLocalTransformerEmbedding(text);
    }

    // ─── 2. DEVELOPMENT MODE: Try Ollama first ───────────────────────────────
    if (ollamaAvailable) {
        let delay = initialDelay;
        for (let i = 0; i < retries; i++) {
            try {
                const response = await axios.post(OLLAMA_EMBED_URL, {
                    model: EMBED_MODEL,
                    prompt: text
                }, { timeout: 5000 });
                return response.data.embedding;
            } catch (err) {
                // If connection refused or DNS not found, Ollama is not running. Stop retrying immediately.
                if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.code === 'ETIMEDOUT') {
                    console.warn(`[Embeddings] Ollama not available (${err.code}). Switching to cloud/local fallback.`);
                    ollamaAvailable = false;
                    break;
                }
                if (i === retries - 1) {
                    console.warn(`[Embeddings] Ollama failed after ${retries} attempts. Trying fallback.`);
                    ollamaAvailable = false;
                } else {
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2;
                }
            }
        }
    }

    // ─── 3. FALLBACK: Try Gemini first, then local transformers ──────────────
    if (geminiClient) {
        try {
            const response = await geminiClient.embedContent({
                content: { parts: [{ text }] },
                outputDimensionality: 384
            });
            if (response?.embedding?.values) {
                return response.embedding.values;
            }
        } catch (err) {
            console.error('[Embeddings] Fallback Gemini embedding failed:', err.message);
        }
    }

    return getLocalTransformerEmbedding(text);
}

let localExtractor = null;

/**
 * Generate 384-dimensional embedding using in-process HuggingFace transformers (all-MiniLM-L6-v2)
 */
async function getLocalTransformerEmbedding(text) {
    try {
        if (!localExtractor) {
            const { pipeline } = require('@xenova/transformers');
            localExtractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
        }
        const output = await localExtractor(text, { pooling: 'mean', normalize: true });
        return Array.from(output.data);
    } catch (err) {
        console.error('[Embeddings] In-process local transformer embedding failed:', err.message);
        return [];
    }
}

module.exports = {
    getEmbedding
};

