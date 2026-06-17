const { generateText } = require('../utils/gemini');

async function analyzeComment(commentText, postCaption) {
    if (!commentText || commentText.trim().length === 0) {
        return { quality: 'low', topic: 'General' };
    }

    if (commentText.length < 10) {
        // Simple heuristic for very short comments to avoid unnecessary API calls
        return { quality: 'low', topic: 'General' };
    }

    const prompt = `You are a moderation and discussion analysis assistant for a social media platform.
Analyze the following comment left on a post.
Post Caption: "${postCaption || 'No caption'}"
Comment: "${commentText}"

Task:
1. Determine the quality of the comment based on effort, relevance, and value. Allowed values: 'high', 'normal', 'low'. Low means spam, single emoji, irrelevant, or toxic. High means well-thought-out or very helpful. Normal is everything else.
2. Extract a 1-2 word topic tag that categorizes the comment (e.g., "Pricing", "Support", "Joke", "Feedback", "General").

Return ONLY a valid JSON object in this exact format, with no markdown formatting or extra text:
{"quality": "normal", "topic": "General"}`;

    try {
        const rawResponse = await generateText(prompt, { maxTokens: 100, temperature: 0.1 });
        
        let result = { quality: 'normal', topic: 'General' };
        
        try {
            // Strip any potential markdown wrappers if the LLM ignores instructions
            const jsonStr = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
            const parsed = JSON.parse(jsonStr);
            
            if (['high', 'normal', 'low'].includes(parsed.quality)) {
                result.quality = parsed.quality;
            }
            if (parsed.topic && typeof parsed.topic === 'string') {
                // Ensure topic is short
                const words = parsed.topic.trim().split(/\s+/).slice(0, 2);
                result.topic = words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') || 'General';
            }
        } catch (jsonError) {
            console.error('[Discussion AI Parse Error]:', jsonError.message, 'Raw response:', rawResponse);
        }

        return result;
    } catch (error) {
        console.error('[Discussion AI Error]:', error.message);
        return { quality: 'normal', topic: 'General' };
    }
}

module.exports = {
    analyzeComment
};
