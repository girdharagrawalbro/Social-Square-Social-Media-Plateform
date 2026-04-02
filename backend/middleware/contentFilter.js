const BANNED_WORDS = [
    'scam', 'spam', 'hack', 'crypto free', 'win money', 'porn', 'nsfw',
    'hate', 'toxic', 'idiot', 'stupid', 'curse1', 'curse2' // Add common offensive terms
];

const contentFilter = (req, res, next) => {
    const fieldsToFilter = ['content', 'caption', 'text', 'comment'];
    let violationFound = null;

    for (const field of fieldsToFilter) {
        if (req.body[field] && typeof req.body[field] === 'string') {
            const text = req.body[field].toLowerCase();
            
            for (const word of BANNED_WORDS) {
                if (text.includes(word.toLowerCase())) {
                    violationFound = word;
                    break;
                }
            }
        }
        if (violationFound) break;
    }

    if (violationFound) {
        return res.status(400).json({ 
            success: false,
            message: `Your content contains prohibited language: "${violationFound}". Please keep Social Square safe and friendly.`,
            type: 'CONTENT_VIOLATION'
        });
    }

    next();
};

module.exports = contentFilter;
