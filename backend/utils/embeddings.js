const axios = require('axios');
require('dotenv').config();

const OLLAMA_EMBED_URL = process.env.OLLAMA_URL 
    ? process.env.OLLAMA_URL.replace('/api/generate', '/api/embeddings') 
    : 'http://localhost:11434/api/embeddings';

// all-minilm is 384 dimensions (matches previous Gemini outputDimensionality).
// nomic-embed-text is 768 dimensions.
const EMBED_MODEL = process.env.OLLAMA_EMBED_MODEL || 'all-minilm';

/**
 * Generates an embedding for the given text using local Ollama.
 * @param {string} text - The text to embed.
 * @param {number} retries - Maximum number of retries.
 * @param {number} initialDelay - Initial delay for backoff.
 * @returns {Promise<number[]>} - The embedding vector.
 */
async function getEmbedding(text, retries = 5, initialDelay = 1500) {
    if (!text || text.trim() === '') return [];
    
    let delay = initialDelay;
    for (let i = 0; i < retries; i++) {
        try {
            const response = await axios.post(OLLAMA_EMBED_URL, {
                model: EMBED_MODEL,
                prompt: text
            });
            return response.data.embedding;
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`⚠️ [Ollama API] Embedding failed (attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

module.exports = {
    getEmbedding
};
