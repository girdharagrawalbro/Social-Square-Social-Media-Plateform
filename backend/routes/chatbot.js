const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const client = new OpenAI({
    baseURL: 'https://integrate.api.nvidia.com/v1',
    apiKey: process.env.NVIDIA_API_KEY,
});

const USER_FLOWS_PATH = path.join(__dirname, '../data/user_flows.json');

const SYSTEM_PROMPT = `You are SocialBot, a helpful AI assistant built into Social Square — a social media platform.

You help users with:
1. APP HELP: How to post, follow users, use stories, create collaborative posts, anonymous confessions, and all other features.
2. CONTENT SUGGESTIONS: Caption ideas, hashtag suggestions, and post ideas.
3. MOOD CHECK-IN: Suggest content moods based on how the user feels.

CONTEXT FOR THIS SESSION:
{{CONTEXT}}

Rules:
- If CONTEXT above contains specific steps for the user's question, prioritize those steps.
- Be friendly, concise, and helpful.
- For content suggestions, give 3-5 specific options.
- Keep responses under 150 words unless giving a list.
- Use emojis naturally.`;

// Simple keyword-based retrieval
const getRelevantContext = (query) => {
    try {
        if (!fs.existsSync(USER_FLOWS_PATH)) return "";
        const flows = JSON.parse(fs.readFileSync(USER_FLOWS_PATH, 'utf8'));
        const q = query.toLowerCase();

        // Check for keyword matches
        for (const key in flows) {
            const flow = flows[key];
            if (flow.keywords.some(k => q.includes(k))) {
                return `Topic: ${flow.title}\nFlow: ${flow.flow}`;
            }
        }
    } catch (e) {
        console.error('RAG Context Error:', e);
    }
    return "";
};

// ─── CHAT — streams tokens back to frontend ───────────────────────────────────
router.post('/chat', async (req, res) => {
    try {
        const { messages } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'messages array required' });
        }

        // 1. Get relevant context from the user's last message
        const lastUserMessage = messages.filter(m => m.role === 'user').pop()?.content || "";
        const context = getRelevantContext(lastUserMessage);

        // 2. Inject context into systemic prompt
        const dynamicPrompt = SYSTEM_PROMPT.replace('{{CONTEXT}}', context || "No specific flow context found. Answer using your general knowledge of Social Square.");

        // Clean history for the model
        const history = messages.slice(-10).map(m => ({
            role: m.role,
            content: m.content,
        }));

        // ✅ Llama3-chatqa forces specific user/assistant alternation
        const raw = [
            { role: 'user', content: dynamicPrompt },
            { role: 'assistant', content: 'Got it! I am SocialBot, ready to help Social Square users with the provided application context.' },
            ...history,
        ];

        // Merge consecutive same-role messages
        const fullMessages = raw.reduce((acc, msg) => {
            if (acc.length > 0 && acc[acc.length - 1].role === msg.role) {
                acc[acc.length - 1] = {
                    role: msg.role,
                    content: acc[acc.length - 1].content + '\n' + msg.content,
                };
            } else {
                acc.push({ role: msg.role, content: msg.content });
            }
            return acc;
        }, []);

        // Ensure starts and ends with user
        if (fullMessages[fullMessages.length - 1]?.role !== 'user') {
            fullMessages.push({ role: 'user', content: 'Please continue.' });
        }

        const completion = await client.chat.completions.create({
            model: 'nvidia/llama3-chatqa-1.5-8b',
            messages: fullMessages,
            temperature: 0.2,
            top_p: 0.7,
            max_tokens: 1024,
            stream: true,
        });

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
                { role: 'user', content: `You are a creative social media content writer. ${prompt}` },
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