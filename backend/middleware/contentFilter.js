const ContentFilter = require('../models/ContentFilter');
const AuditLog = require('../models/AuditLog');

const contentFilter = async (req, res, next) => {
    const fieldsToFilter = ['content', 'caption', 'text', 'comment'];
    let violationFound = null;

    try {
        const bannedWordsFromDB = await ContentFilter.find().lean();
        const bannedWords = bannedWordsFromDB.map(w => ({ word: w.word.toLowerCase(), action: w.action }));

        // Fallback to hardcoded if DB empty
        const defaultWords = ['scam', 'spam', 'hack', 'crypto free', 'win money', 'porn', 'nsfw'];
        
        for (const field of fieldsToFilter) {
            if (req.body[field] && typeof req.body[field] === 'string') {
                const text = req.body[field].toLowerCase();
                
                // Check DB words
                for (const item of bannedWords) {
                    if (text.includes(item.word)) {
                        violationFound = item;
                        break;
                    }
                }

                // Check default words if no violation yet
                if (!violationFound) {
                    for (const word of defaultWords) {
                        if (text.includes(word)) {
                            violationFound = { word, action: 'block' };
                            break;
                        }
                    }
                }
            }
            if (violationFound) break;
        }

        if (violationFound) {
            if (violationFound.action === 'block') {
                return res.status(400).json({ 
                    success: false,
                    message: `Your content contains prohibited language: "${violationFound.word || violationFound}". Publication blocked.`,
                    type: 'CONTENT_VIOLATION'
                });
            } else {
                // Auto-Flag
                await AuditLog.create({
                    action: 'Content Flagged',
                    actor: 'System Filter',
                    target: `Content with "${violationFound.word}" by User ${req.userId || 'Unknown'}`,
                });
            }
        }

        next();
    } catch (err) {
        next();
    }
};

module.exports = contentFilter;
