const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Generates an embedding for the given text using Gemini with exponential backoff.
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
            const result = await model.embedContent({
                content: { parts: [{ text }] },
                outputDimensionality: 384
            });
            return result.embedding.values;
        } catch (err) {
            if (i === retries - 1) throw err;
            console.warn(`⚠️ [Gemini API] Embedding failed (attempt ${i + 1}/${retries}): ${err.message}. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 2;
        }
    }
}

module.exports = {
    getEmbedding
};
