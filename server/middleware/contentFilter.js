const ContentFilter = require('../models/ContentFilter');
const AuditLog = require('../models/AuditLog');
const SystemSetting = require('../models/SystemSetting');

const checkContent = async (text) => {
    if (!text || typeof text !== 'string') return null;
    const lowerText = text.toLowerCase();
    
    try {
        const bannedWordsFromDB = await ContentFilter.find().lean();
        const bannedWords = bannedWordsFromDB.map(w => ({ word: w.word.toLowerCase(), action: w.action }));
        const defaultWords = ['scam', 'spam', 'hack', 'crypto free', 'win money', 'porn', 'nsfw'];

        for (const item of bannedWords) {
            if (lowerText.includes(item.word)) return item;
        }

        for (const word of defaultWords) {
            if (lowerText.includes(word)) return { word, action: 'block' };
        }
    } catch (err) {
        console.error('Content filter error:', err);
    }
    return null;
};

const contentFilterMiddleware = async (req, res, next) => {
    const fieldsToFilter = ['content', 'caption', 'text', 'comment'];
    let violationFound = null;

    try {
        // Bypass if content_filter flag is disabled
        const filterFlag = await SystemSetting.findOne({ key: 'content_filter' }).lean();
        if (filterFlag && filterFlag.value === false) {
            return next();
        }

        for (const field of fieldsToFilter) {
            if (req.body[field]) {
                violationFound = await checkContent(req.body[field]);
                if (violationFound) break;
            }
        }

        if (violationFound) {
            if (violationFound.action === 'block') {
                return res.status(400).json({ 
                    success: false,
                    message: `Your content contains prohibited language: "${violationFound.word}". Publication blocked.`,
                    type: 'CONTENT_VIOLATION'
                });
            } else {
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

module.exports = contentFilterMiddleware;
module.exports.checkContent = checkContent;
