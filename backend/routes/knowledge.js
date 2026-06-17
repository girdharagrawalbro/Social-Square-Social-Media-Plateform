const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const verifyToken = require('../middleware/Verifytoken');
const KnowledgeNote = require('../models/KnowledgeNote');
const KnowledgeTree = require('../models/KnowledgeTree');
const WikiPage = require('../models/WikiPage');
const Post = require('../models/Post');
const {
    summarisePost,
    autoTagTopic,
    extractTitle,
} = require('../services/knowledgeAiService');

// Topic → emoji map for the knowledge tree UI
const TOPIC_ICONS = {
    technology: '💻', tech: '💻', programming: '💻', coding: '💻',
    health: '🏥', fitness: '🏃', wellness: '🧘',
    finance: '💰', money: '💰', investing: '📈',
    science: '🔬', research: '🔭',
    travel: '✈️', adventure: '🗺️',
    food: '🍜', cooking: '👨‍🍳',
    sports: '⚽', games: '🎮',
    art: '🎨', design: '✏️', creativity: '🎭',
    music: '🎵', entertainment: '🎬',
    education: '📚', learning: '🎓', 'self-improvement': '🌱',
    nature: '🌿', environment: '🌍',
    business: '💼', startup: '🚀', entrepreneurship: '🚀',
    relationships: '❤️', social: '👥',
    news: '📰', politics: '🏛️',
    default: '📚',
};

function getTopicIcon(topic = '') {
    const key = topic.toLowerCase().trim();
    for (const [k, icon] of Object.entries(TOPIC_ICONS)) {
        if (key.includes(k)) return icon;
    }
    return TOPIC_ICONS.default;
}

// ─── HELPER: update the KnowledgeTree aggregation doc ─────────────────────────
async function updateKnowledgeTree(userId, topic, subtopic, typeDelta = { note: 0, learning: 0 }, deleted = false) {
    try {
        const icon = getTopicIcon(topic);

        const notesDelta = typeDelta.note || 0;
        const learningsDelta = typeDelta.learning || 0;
        const totalDelta = notesDelta + learningsDelta;

        if (deleted) {
            // Decrement — remove tree doc if count hits 0
            await KnowledgeTree.findOneAndUpdate(
                { userId, topic },
                {
                    $inc: {
                        noteCount: -Math.abs(totalDelta),
                        notesCount: -Math.abs(notesDelta),
                        learningsCount: -Math.abs(learningsDelta),
                    },
                    $set: { lastUpdated: new Date() }
                }
            );
            // Prune zero-count tree docs
            await KnowledgeTree.deleteMany({ userId, noteCount: { $lte: 0 } });
            return;
        }

        const update = {
            $inc: {
                noteCount: totalDelta,
                notesCount: notesDelta,
                learningsCount: learningsDelta,
            },
            $set: { icon, lastUpdated: new Date() },
        };

        if (subtopic) {
            update.$inc['subtopics.$[elem].count'] = 1;
        }

        // Upsert top-level tree
        const treeDoc = await KnowledgeTree.findOneAndUpdate(
            { userId, topic },
            {
                $inc: {
                    noteCount: totalDelta,
                    notesCount: notesDelta,
                    learningsCount: learningsDelta,
                },
                $set: { icon, lastUpdated: new Date() },
                $setOnInsert: { userId, topic, subtopics: [] },
            },
            { upsert: true, new: true }
        );

        // Handle subtopic update separately
        if (subtopic && treeDoc) {
            const subtopicExists = treeDoc.subtopics?.some(s => s.name === subtopic);
            if (subtopicExists) {
                await KnowledgeTree.updateOne(
                    { userId, topic, 'subtopics.name': subtopic },
                    { $inc: { 'subtopics.$.count': 1 } }
                );
            } else {
                await KnowledgeTree.updateOne(
                    { userId, topic },
                    { $push: { subtopics: { name: subtopic, count: 1 } } }
                );
            }
        }
    } catch (err) {
        console.error('[KnowledgeTree Update Error]:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTES API
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * POST /api/knowledge/save
 * Save a post as a note or learning item.
 * Triggers AI summarisation and auto-tagging in the background.
 */
router.post('/save', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const {
            postId,
            type = 'note',         // 'note' | 'learning'
            annotation = '',
            title: userTitle = '',
            content: userContent = '',
        } = req.body;

        if (!postId && !userContent) {
            return res.status(400).json({ error: 'postId or content is required' });
        }

        let originalCaption = '';
        let category = 'General';
        let tags = [];
        let imageUrl = null;

        // Fetch source post if provided
        if (postId) {
            if (!mongoose.Types.ObjectId.isValid(postId)) {
                return res.status(400).json({ error: 'Invalid postId' });
            }

            // Check if already saved
            const existing = await KnowledgeNote.findOne({ userId, postId, deletedAt: null });
            if (existing) {
                return res.status(409).json({
                    error: 'Already saved',
                    note: existing,
                });
            }

            const post = await Post.findById(postId).lean();
            if (!post) return res.status(404).json({ error: 'Post not found' });

            originalCaption = post.caption || '';
            category = post.category || 'General';
            tags = post.tags || [];
            imageUrl = post.image_url || post.image_urls?.[0] || null;
        }

        // Create note immediately with placeholder AI fields
        const note = await KnowledgeNote.create({
            userId,
            postId: postId || null,
            type,
            title: userTitle || '',
            content: userContent || '',
            originalCaption,
            annotation,
            topic: category, // will be refined by AI below
            subtopic: '',
            tags,
            sourceType: postId ? 'post' : 'manual',
        });

        // AI enrichment async (non-blocking for fast response)
        setImmediate(async () => {
            try {
                const sourceText = originalCaption || userContent;
                const [aiSummary, { topic, subtopic }, aiTitle] = await Promise.all([
                    summarisePost(sourceText, category, tags),
                    autoTagTopic(sourceText, category, tags),
                    !userTitle ? extractTitle(sourceText) : Promise.resolve(userTitle),
                ]);

                await KnowledgeNote.findByIdAndUpdate(note._id, {
                    aiSummary,
                    topic,
                    subtopic,
                    title: userTitle || aiTitle,
                });

                // Update the knowledge tree
                await updateKnowledgeTree(
                    userId,
                    topic,
                    subtopic,
                    { note: type === 'note' ? 1 : 0, learning: type === 'learning' ? 1 : 0 }
                );
            } catch (aiErr) {
                console.error('[KnowledgeNote AI Enrichment Error]:', aiErr.message);
                // Fallback: update tree with category
                await updateKnowledgeTree(
                    userId,
                    category,
                    '',
                    { note: type === 'note' ? 1 : 0, learning: type === 'learning' ? 1 : 0 }
                );
            }
        });

        return res.status(201).json({
            success: true,
            message: 'Saved! AI summary is being generated...',
            note,
        });
    } catch (err) {
        console.error('[POST /knowledge/save]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/knowledge/notes
 * Get paginated notes for the authenticated user.
 * Query params: page, limit, topic, type, search, sort
 */
router.get('/notes', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;
        const {
            page = 1,
            limit = 20,
            topic,
            type,
            search,
            sort = 'newest',
        } = req.query;

        const filter = { userId, deletedAt: null };
        if (topic) filter.topic = topic;
        if (type && ['note', 'learning'].includes(type)) filter.type = type;
        if (search) {
            const regex = new RegExp(search, 'i');
            filter.$or = [
                { title: regex },
                { content: regex },
                { aiSummary: regex },
                { annotation: regex },
                { tags: regex },
            ];
        }

        const sortMap = {
            newest: { createdAt: -1 },
            oldest: { createdAt: 1 },
            topic: { topic: 1, createdAt: -1 },
        };
        const sortQuery = sortMap[sort] || sortMap.newest;

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const [notes, total] = await Promise.all([
            KnowledgeNote.find(filter).sort(sortQuery).skip(skip).limit(parseInt(limit)).lean(),
            KnowledgeNote.countDocuments(filter),
        ]);

        return res.json({
            success: true,
            notes,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (err) {
        console.error('[GET /knowledge/notes]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/knowledge/notes/:id
 * Get a single note by ID.
 */
router.get('/notes/:id', verifyToken, async (req, res) => {
    try {
        const note = await KnowledgeNote.findOne({
            _id: req.params.id,
            userId: req.userId,
            deletedAt: null,
        }).lean();

        if (!note) return res.status(404).json({ error: 'Note not found' });
        return res.json({ success: true, note });
    } catch (err) {
        console.error('[GET /knowledge/notes/:id]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * PUT /api/knowledge/notes/:id
 * Edit a note (title, content, annotation, type, isPublic).
 */
router.put('/notes/:id', verifyToken, async (req, res) => {
    try {
        const { title, content, annotation, type, isPublic } = req.body;

        const note = await KnowledgeNote.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId, deletedAt: null },
            {
                $set: {
                    ...(title !== undefined && { title }),
                    ...(content !== undefined && { content }),
                    ...(annotation !== undefined && { annotation }),
                    ...(type && ['note', 'learning'].includes(type) && { type }),
                    ...(isPublic !== undefined && { isPublic }),
                },
            },
            { new: true }
        );

        if (!note) return res.status(404).json({ error: 'Note not found' });
        return res.json({ success: true, note });
    } catch (err) {
        console.error('[PUT /knowledge/notes/:id]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * DELETE /api/knowledge/notes/:id
 * Soft-delete a note and update the knowledge tree.
 */
router.delete('/notes/:id', verifyToken, async (req, res) => {
    try {
        const note = await KnowledgeNote.findOneAndUpdate(
            { _id: req.params.id, userId: req.userId, deletedAt: null },
            { $set: { deletedAt: new Date() } },
            { new: true }
        );

        if (!note) return res.status(404).json({ error: 'Note not found' });

        // Decrement tree
        await updateKnowledgeTree(
            req.userId,
            note.topic,
            note.subtopic,
            { note: note.type === 'note' ? 1 : 0, learning: note.type === 'learning' ? 1 : 0 },
            true // deleted = true
        );

        return res.json({ success: true, message: 'Note deleted' });
    } catch (err) {
        console.error('[DELETE /knowledge/notes/:id]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// KNOWLEDGE TREE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/knowledge/tree
 * Get the full topic tree for the authenticated user.
 */
router.get('/tree', verifyToken, async (req, res) => {
    try {
        const tree = await KnowledgeTree.find({ userId: req.userId })
            .sort({ noteCount: -1 })
            .lean();
        return res.json({ success: true, tree });
    } catch (err) {
        console.error('[GET /knowledge/tree]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/knowledge/dashboard
 * Returns aggregated stats for the personal learning dashboard.
 */
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const userId = req.userId;

        const [
            totalNotes,
            learningCount,
            noteCount,
            topicCount,
            recentNotes,
            tree,
        ] = await Promise.all([
            KnowledgeNote.countDocuments({ userId, deletedAt: null }),
            KnowledgeNote.countDocuments({ userId, type: 'learning', deletedAt: null }),
            KnowledgeNote.countDocuments({ userId, type: 'note', deletedAt: null }),
            KnowledgeTree.countDocuments({ userId }),
            KnowledgeNote.find({ userId, deletedAt: null })
                .sort({ createdAt: -1 })
                .limit(5)
                .lean(),
            KnowledgeTree.find({ userId }).sort({ noteCount: -1 }).limit(5).lean(),
        ]);

        // Weekly activity: notes saved in last 7 days per day
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weeklyActivity = await KnowledgeNote.aggregate([
            {
                $match: {
                    userId: new mongoose.Types.ObjectId(userId),
                    deletedAt: null,
                    createdAt: { $gte: sevenDaysAgo },
                },
            },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        return res.json({
            success: true,
            stats: {
                totalNotes,
                learningCount,
                noteCount,
                topicCount,
            },
            recentNotes,
            topTopics: tree,
            weeklyActivity,
        });
    } catch (err) {
        console.error('[GET /knowledge/dashboard]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY WIKI
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * GET /api/knowledge/wiki
 * List all published wiki pages.
 */
router.get('/wiki', async (req, res) => {
    try {
        const wikis = await WikiPage.find({ isPublished: true })
            .select('slug topic description coverImage viewCount contributors topPosts lastUpdated')
            .sort({ viewCount: -1 })
            .limit(50)
            .lean();

        // Add contributor count and post count for the listing
        const formatted = wikis.map(w => ({
            ...w,
            postCount: w.topPosts?.length || 0,
            contributorCount: w.contributors?.length || 0,
        }));

        return res.json({ success: true, wikis: formatted });
    } catch (err) {
        console.error('[GET /knowledge/wiki]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/knowledge/wiki/:slug
 * Get a specific wiki page with populated posts.
 */
router.get('/wiki/:slug', async (req, res) => {
    try {
        const wiki = await WikiPage.findOne({
            slug: req.params.slug.toLowerCase(),
            isPublished: true,
        }).lean();

        if (!wiki) return res.status(404).json({ error: 'Wiki page not found' });

        // Increment view count
        WikiPage.findByIdAndUpdate(wiki._id, { $inc: { viewCount: 1 } }).exec();

        // Populate top posts
        const postIds = (wiki.topPosts || []).map(p => p.postId);
        const posts = await Post.find({
            _id: { $in: postIds },
            deletedAt: null,
            isVisible: true,
        })
            .select('caption image_url image_urls category tags score likes user createdAt')
            .lean();

        // Merge score from wiki entry with post data
        const postsWithWikiScore = posts.map(p => {
            const entry = wiki.topPosts.find(e => e.postId.toString() === p._id.toString());
            return { ...p, wikiScore: entry?.score || 0, addedAt: entry?.addedAt };
        }).sort((a, b) => b.wikiScore - a.wikiScore);

        return res.json({
            success: true,
            wiki: { ...wiki, topPosts: postsWithWikiScore },
        });
    } catch (err) {
        console.error('[GET /knowledge/wiki/:slug]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/knowledge/wiki/:slug/contribute
 * Suggest a post to be added to a community wiki page.
 */
router.post('/wiki/:slug/contribute', verifyToken, async (req, res) => {
    try {
        const { postId } = req.body;
        const userId = req.userId;
        const slug = req.params.slug.toLowerCase();

        if (!postId || !mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({ error: 'Valid postId is required' });
        }

        const [wiki, post] = await Promise.all([
            WikiPage.findOne({ slug, isPublished: true }),
            Post.findById(postId).lean(),
        ]);

        if (!wiki) return res.status(404).json({ error: 'Wiki page not found' });
        if (!post) return res.status(404).json({ error: 'Post not found' });

        // Check if already in wiki
        const alreadyIn = wiki.topPosts.some(p => p.postId.toString() === postId);
        if (alreadyIn) {
            return res.status(409).json({ error: 'Post already in this wiki' });
        }

        // Add as community suggestion (top 20 cap)
        const newEntry = {
            postId,
            score: post.score || post.likes?.length || 0,
            addedBy: 'community',
            suggestedBy: userId,
            addedAt: new Date(),
        };

        // Keep max 20 posts, sorted by score
        wiki.topPosts.push(newEntry);
        wiki.topPosts.sort((a, b) => b.score - a.score);
        if (wiki.topPosts.length > 20) wiki.topPosts = wiki.topPosts.slice(0, 20);

        if (!wiki.contributors.includes(userId)) {
            wiki.contributors.push(userId);
        }
        wiki.lastUpdated = new Date();
        await wiki.save();

        return res.json({ success: true, message: 'Post suggested for wiki!' });
    } catch (err) {
        console.error('[POST /knowledge/wiki/:slug/contribute]:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
