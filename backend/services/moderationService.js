let filter;

/**
 * Initialize the profanity filter (handles ESM/CJS compatibility)
 */
async function getFilter() {
    if (filter) return filter;
    try {
        // bad-words v4+ is ESM-only but misconfigured for CJS require.
        // We use dynamic import to correctly load the ESM version.
        const mod = await import('bad-words');
        const Filter = mod.default || mod.Filter || mod;
        filter = new Filter();
    } catch (err) {
        console.error('[Moderation] Failed to load profanity filter:', err.message);
        // Fallback to safe object to prevent crashes
        filter = { isProfane: () => false };
    }
    return filter;
}

/**
 * Perform a fast local check for profanity
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
async function localProfanityCheck(text) {
    if (!text) return false;
    const f = await getFilter();
    return f.isProfane(text);
}

const THRESHOLDS = {
    FLAG: 0.4,
    REVIEW: 0.6,
    HIDE: 0.8
};

/**
 * Moderate content based on a toxicity score
 * @param {number} score - Toxicity score between 0 and 1
 * @param {string} text - The content text for local profanity check
 * @returns {Promise<Object>} - { isVisible, isFlagged, reason }
 */
async function evaluateModeration(score, text) {
    const hasProfanity = await localProfanityCheck(text);
    
    // If it's outright toxic or has profanity, we might want to hide it
    if (score >= THRESHOLDS.HIDE || (hasProfanity && score > 0.5)) {
        return {
            isVisible: false,
            isFlagged: true,
            reason: 'Auto-hidden: High toxicity or prohibited language detected.'
        };
    }

    // New state: Manual Review (Hidden but manageable)
    if (score >= THRESHOLDS.REVIEW) {
        return {
            isVisible: false,
            isFlagged: true,
            reason: 'Hidden: Needs manual review due to content sensitivity.'
        };
    }

    // Flagged state: Visible but marked
    if (score >= THRESHOLDS.FLAG || hasProfanity) {
        return {
            isVisible: true,
            isFlagged: true,
            reason: 'Flagged: Contains potentially sensitive or inappropriate language.'
        };
    }

    // Safe
    return {
        isVisible: true,
        isFlagged: false,
        reason: null
    };
}

/**
 * Classify toxicity using NVIDIA AI
 * @param {string} text 
 * @returns {Promise<number>} - Toxicity score between 0 and 1
 */
async function classifyToxicity(text) {
    if (!text || text.length < 3) return 0;
    
    const prompt = `Rate the toxicity of the following text on a scale from 0.0 (completely safe) to 1.0 (highly toxic, hate speech, or harassment). 
    Consider profanity, insults, and harassment.
    Return ONLY a single number.
    
    Text: "${text}"`;

    try {
        const { generateNvidiaText } = require('../utils/nvidia');
        const result = await generateNvidiaText(prompt);
        const score = parseFloat(result.text.trim());
        return isNaN(score) ? 0 : Math.min(Math.max(score, 0), 1);
    } catch (error) {
        console.error('[Moderation AI Error]:', error.message);
        return 0;
    }
}

module.exports = {
    localProfanityCheck,
    evaluateModeration,
    classifyToxicity,
    THRESHOLDS
};
