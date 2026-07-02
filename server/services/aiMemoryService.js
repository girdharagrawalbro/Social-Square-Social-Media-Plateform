const UserMemory = require('../models/UserMemory');
const { generateNvidiaText } = require('../utils/nvidia');

/**
 * Runs a background prompt to extract permanent facts about a user from a conversation.
 * @param {string} userId - The user's ID
 * @param {Array} formattedHistory - The message history in {role, content} format
 */
async function extractAndSaveMemory(userId, formattedHistory) {
    try {
        if (!formattedHistory || formattedHistory.length < 2) return;

        // Combine the conversation into a single transcript
        const transcript = formattedHistory.map(m => `${m.role === 'assistant' ? 'AI' : 'User'}: ${m.content}`).join('\n');

        const prompt = `
Analyze the following conversation between an AI and a User.
Extract any NEW, permanent, or useful facts about the User (e.g., their name, preferences, favorite things, relationship status, job, hobbies, personal history, or explicit instructions they give to the AI).
Do not extract transient emotions (like "user is happy right now"). Do not extract information about the AI itself.

Return the facts as a strict JSON array of strings. For example:
["User's favorite color is blue", "User has a pet dog named Max"]

If there are no new facts to extract, return an empty JSON array: []

Conversation:
${transcript}

JSON Array:`;

        const response = await generateNvidiaText(prompt);
        let text = response.text.trim();

        // Clean up markdown formatting if the model wraps it in ```json ... ```
        if (text.startsWith('```json')) {
            text = text.replace(/^```json\n/, '').replace(/\n```$/, '');
        } else if (text.startsWith('```')) {
            text = text.replace(/^```\n/, '').replace(/\n```$/, '');
        }

        let newFacts = [];
        try {
            newFacts = JSON.parse(text);
        } catch (e) {
            console.warn('[AI Memory] Failed to parse JSON from AI response:', text);
            return;
        }

        if (!Array.isArray(newFacts) || newFacts.length === 0) {
            return;
        }

        // Filter out bad facts (too long, not strings)
        newFacts = newFacts.filter(f => typeof f === 'string' && f.length < 200).map(f => f.trim());
        if (newFacts.length === 0) return;

        // console.log(`[AI Memory] Extracted ${newFacts.length} new facts for user ${userId}:`, newFacts);

        // Save to DB
        await UserMemory.findOneAndUpdate(
            { userId },
            {
                $addToSet: { facts: { $each: newFacts } },
                $set: { lastExtractedAt: new Date() }
            },
            { upsert: true, new: true }
        );

    } catch (err) {
        console.error('[AI Memory Error] extractAndSaveMemory failed:', err.message);
    }
}

module.exports = {
    extractAndSaveMemory
};
