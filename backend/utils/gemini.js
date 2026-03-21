
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Use the current stable model name
const MODEL = 'gemini-2.0-flash';

// Generate caption from image URL
async function generateCaptionFromImage(imageUrl) {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL });

        // Fetch image as base64
        const fetch = (await import('node-fetch')).default;
        const imageRes = await fetch(imageUrl);
        const buffer = await imageRes.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = imageRes.headers.get('content-type') || 'image/jpeg';

        const result = await model.generateContent([
            { inlineData: { data: base64, mimeType } },
            'Generate 3 short, engaging social media captions for this image. Return them as a JSON array of strings like: ["caption1", "caption2", "caption3"]. Keep each caption under 100 characters. Be creative and fun.',
        ]);

        const text = result.response.text().trim();
        const match = text.match(/\[.*\]/s);
        if (match) return JSON.parse(match[0]);
        return [text];
    } catch (error) {
        console.error('Gemini caption error:', error.message);
        return null;
    }
}

// Detect mood from caption text
async function detectMoodFromCaption(caption) {
    try {
        const model = genAI.getGenerativeModel({ model: MODEL });

        const result = await model.generateContent(
            `Analyze the mood of this social media post caption and return ONLY one word from this list: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral\n\nCaption: "${caption}"\n\nReturn only the single mood word, nothing else.`
        );

        const mood = result.response.text().trim().toLowerCase();
        const validMoods = ['happy', 'sad', 'excited', 'angry', 'calm', 'romantic', 'funny', 'inspirational', 'nostalgic', 'neutral'];
        return validMoods.includes(mood) ? mood : 'neutral';
    } catch (error) {
        console.error('Gemini mood error:', error.message);
        return 'neutral';
    }
}

module.exports = { generateCaptionFromImage, detectMoodFromCaption };