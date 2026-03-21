const express = require('express');
const router = express.Router();
const OpenAI = require('openai');

const client = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY,
});

const SYSTEM_PROMPT = `You are SocialBot, a helpful AI assistant built into Social Square — a social media platform.

You help users with:
1. APP HELP: How to post, follow users, use stories, create collaborative posts, anonymous confessions, time-locked posts, voice notes, and all other features.
2. CONTENT SUGGESTIONS: Caption ideas, hashtag suggestions, post ideas based on mood or topic the user gives you.
3. MOOD CHECK-IN: Ask how the user is feeling and suggest content moods (happy, excited, calm, romantic, nostalgic, etc.) to explore on their feed.
4. SUPPORT: Help users report issues, understand community guidelines, or troubleshoot problems.

Social Square features you know about:
- Feed with infinite scroll, mood-based filtering, real-time updates
- Stories (24hr expiry), Collaborative posts (invite others to contribute)
- Anonymous confessions feed (identity hidden)
- Time-locked posts (unlock at a future time), Post expiry
- Voice notes in posts and DMs
- AI caption generator, Mood detection on posts
- Direct messages with reactions, edit/delete, media sharing
- Notification bell with collaboration invites
- Dark mode, Admin dashboard

Rules:
- Be friendly, concise, and helpful
- For content suggestions, give 3-5 specific options
- For mood check-in, recommend one of: happy, sad, excited, angry, calm, romantic, funny, inspirational, nostalgic, neutral
- Never make up features that don't exist
- Keep responses under 150 words unless giving a list
- Use emojis naturally`;

// ─── CHAT — streams tokens back to frontend ───────────────────────────────────
router.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }

        // llama3-chatqa doesn't support 'system' role
        // Inject as first user/assistant pair instead
        const history = messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
        }));

        const fullMessages = [
            { role: 'user', content: SYSTEM_PROMPT },
            { role: 'assistant', content: 'Got it! I am SocialBot, ready to help.' },
            ...history,
        ];

        // ✅ stream: true — model forces it anyway, consume with for-await
        const completion = await client.chat.completions.create({
            model: 'nvidia/llama3-chatqa-1.5-8b',
            messages: fullMessages,
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 1024,
            stream: true,
        });

        // ✅ SSE response so frontend can stream tokens in real time
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders();

        for await (const chunk of completion) {
            const token = chunk.choices[0]?.delta?.content;
            if (token) {
                res.write(`data: ${JSON.stringify({ content: token })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();

    } catch (err) {
        console.error('[Chatbot]', err.message);
        // If headers not sent yet, send JSON error
        if (!res.headersSent) {
            res.status(500).json({ error: 'Chatbot error', details: err.message });
        } else {
            res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
            res.end();
        }
    }
});

// ─── CAPTION SUGGESTIONS ──────────────────────────────────────────────────────
router.post('/suggest-captions', async (req, res) => {
    try {
        const { topic, mood, imageDescription } = req.body;

        const prompt = `Generate 5 engaging social media captions for a post about: "${topic || imageDescription || 'general life'}". ${mood ? `Mood/vibe: ${mood}.` : ''} Include relevant hashtags. Number them 1-5. Keep each under 2 sentences.`;

        const completion = await client.chat.completions.create({
            model: 'nvidia/llama3-chatqa-1.5-8b',
            messages: [
                { role: 'user', content: 'You are a creative social media content writer.' },
                { role: 'assistant', content: 'Sure! I will generate engaging captions with hashtags.' },
                { role: 'user', content: prompt },
            ],
            temperature: 0.8,
            top_p: 0.9,
            max_tokens: 400,
            stream: true,
        });

        // Collect full streamed response then send as JSON
        let fullReply = '';
        for await (const chunk of completion) {
            fullReply += chunk.choices[0]?.delta?.content || '';
        }

        res.json({ captions: fullReply });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;