/**
 * knowledgeAiService.js
 * AI-powered operations for the Knowledge Layer.
 * Reuses the same NVIDIA LLaMA endpoint already used across the codebase.
 */

const axios = require('../utils/http');

const NVIDIA_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const NVIDIA_KEY = process.env.NVIDIA_API_KEY;

// ─── HELPER: call LLaMA ────────────────────────────────────────────────────────
async function llamaChat(prompt, maxTokens = 256) {
    if (!NVIDIA_KEY) {
        console.warn('[KnowledgeAI] NVIDIA_API_KEY not set — AI features disabled');
        return '';
    }
    try {
        const res = await axios.post(
            NVIDIA_URL,
            {
                model: 'meta/llama-3.1-8b-instruct',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: maxTokens,
                temperature: 0.3,
                top_p: 0.7,
                stream: false,
            },
            {
                headers: {
                    Authorization: `Bearer ${NVIDIA_KEY}`,
                    Accept: 'application/json',
                },
                timeout: 20000,
            }
        );
        return res.data.choices?.[0]?.message?.content?.trim() || '';
    } catch (err) {
        console.error('[KnowledgeAI] LLaMA call failed:', err.message);
        return '';
    }
}

// ─── SUMMARISE POST → NOTE ────────────────────────────────────────────────────
/**
 * Generates a concise 2-3 sentence summary of a social post for saving as a note.
 * @param {string} caption - The post caption
 * @param {string} category - The post category (for context)
 * @param {string[]} tags - Post tags
 * @returns {Promise<string>} AI summary text
 */
async function summarisePost(caption, category = '', tags = []) {
    if (!caption || !String(caption).trim()) return '';

    const tagStr = tags.length ? `Tags: ${tags.join(', ')}` : '';
    const prompt = [
        'You are a personal knowledge assistant.',
        'Summarise the following social media post into 2-3 concise, informative sentences as a learning note.',
        'Focus on the key insight or takeaway. Be clear and direct. No hashtags, no emojis.',
        `Category: ${category}`,
        tagStr,
        `Post: "${caption}"`,
        'Return ONLY the summary. No preamble.',
    ].filter(Boolean).join('\n');

    return llamaChat(prompt, 200);
}

// ─── AUTO-TAG TOPIC ───────────────────────────────────────────────────────────
/**
 * Determines the best topic label and subtopic for a post.
 * Falls back to the post's category if AI fails.
 * @returns {Promise<{ topic: string, subtopic: string }>}
 */
async function autoTagTopic(caption, category = '', tags = []) {
    if (!caption && !category) return { topic: 'General', subtopic: '' };

    const prompt = [
        'Classify this social media post into a topic and subtopic for a personal knowledge base.',
        'Return ONLY valid JSON: {"topic":"<one word or short phrase>","subtopic":"<optional finer subtopic>"}',
        'Examples of topics: Technology, Health, Finance, Creativity, Science, Travel, Self-improvement, Food, Sports, Art',
        `Category hint: ${category}`,
        `Tags: ${tags.join(', ')}`,
        `Post: "${String(caption).slice(0, 300)}"`,
    ].join('\n');

    try {
        const raw = await llamaChat(prompt, 80);
        const match = raw.match(/\{[\s\S]*?\}/);
        if (match) {
            const parsed = JSON.parse(match[0]);
            return {
                topic: String(parsed.topic || category || 'General').trim(),
                subtopic: String(parsed.subtopic || '').trim(),
            };
        }
    } catch (_) { /* fall through */ }

    return { topic: category || 'General', subtopic: '' };
}

// ─── GENERATE WIKI DESCRIPTION ────────────────────────────────────────────────
/**
 * Generates an introductory description for a community wiki page topic,
 * given the top post captions in that topic.
 * @param {string} topic - The topic name (e.g. "Technology")
 * @param {string[]} sampleCaptions - A sample of top post captions (max 5)
 * @returns {Promise<string>} Wiki intro paragraph
 */
async function generateWikiDescription(topic, sampleCaptions = []) {
    const samples = sampleCaptions.slice(0, 5).map((c, i) => `${i + 1}. "${c}"`).join('\n');

    const prompt = [
        'You are writing a community knowledge wiki page.',
        `Write a 2-3 sentence introduction paragraph for the topic: "${topic}".`,
        'Base it on the community posts below. Be informative and engaging. No markdown, no headers.',
        'Sample community posts:',
        samples || '(various community posts)',
        'Return ONLY the introduction paragraph.',
    ].join('\n');

    return llamaChat(prompt, 250);
}

// ─── EXTRACT TITLE FROM CAPTION ───────────────────────────────────────────────
/**
 * Generates a short note title (max ~8 words) from a post caption.
 * @returns {Promise<string>}
 */
async function extractTitle(caption) {
    if (!caption || !String(caption).trim()) return 'Untitled Note';

    const prompt = [
        'Generate a short, descriptive title (5-8 words, no quotes, no punctuation at end) for this knowledge note:',
        `"${String(caption).slice(0, 400)}"`,
        'Return ONLY the title.',
    ].join('\n');

    const result = await llamaChat(prompt, 40);
    return result || 'Untitled Note';
}

module.exports = {
    summarisePost,
    autoTagTopic,
    generateWikiDescription,
    extractTitle,
};
