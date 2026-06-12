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

/**
 * Detect explicit content (nudity, etc.) in an image using Sightengine API.
 * @param {string} imageUrl
 * @returns {Promise<{isSafe: boolean, reason: string|null, action: string, details: Object|null}>}
 */
async function checkImageNudity(imageUrl) {
    if (!imageUrl) return { isSafe: true, reason: null, action: 'none' };
    
    const apiUser = process.env.SIGHTENGINE_API_USER;
    const apiSecret = process.env.SIGHTENGINE_API_SECRET;
    
    if (!apiUser || !apiSecret || apiUser === 'your_sightengine_api_user') {
        console.warn('[Moderation Image]: Sightengine API User or Secret not configured. Skipping check.');
        return { isSafe: true, reason: null, action: 'none' };
    }

    try {
        const axios = require('axios');
        const url = 'https://api.sightengine.com/1.0/check.json';
        const response = await axios.get(url, {
            params: {
                url: imageUrl,
                models: 'nudity-2.0',
                api_user: apiUser,
                api_secret: apiSecret
            },
            timeout: 10000
        });

        const data = response.data;
        if (data.status !== 'success') {
            console.error('[Moderation Image]: Sightengine returned error status:', data.error?.message || JSON.stringify(data));
            return { isSafe: true, reason: null, action: 'none' }; // default safe
        }

        const nudity = data.nudity || {};
        const sexualActivity = nudity.sexual_activity || 0;
        const sexualDisplay = nudity.sexual_display || 0;
        const erotica = nudity.erotica || 0;
        const suggestive = nudity.suggestive || 0;

        // Threshold policies
        const isUnsafe = sexualActivity > 0.5 || sexualDisplay > 0.5 || erotica > 0.85;
        const needsReview = erotica > 0.5 || suggestive > 0.85;

        if (isUnsafe) {
            return {
                isSafe: false,
                reason: `Auto-hidden: Image contains explicit content (Activity: ${sexualActivity.toFixed(2)}, Display: ${sexualDisplay.toFixed(2)}, Erotica: ${erotica.toFixed(2)}).`,
                action: 'hide',
                details: nudity
            };
        }

        if (needsReview) {
            return {
                isSafe: true, // Visible but flagged
                reason: `Flagged: Image contains suggestive content (Erotica: ${erotica.toFixed(2)}, Suggestive: ${suggestive.toFixed(2)}).`,
                action: 'flag',
                details: nudity
            };
        }

        return { isSafe: true, reason: null, action: 'none', details: nudity };
    } catch (error) {
        console.error('[Moderation Image Error]:', error.response?.data || error.message);
        return { isSafe: true, reason: null, action: 'none' };
    }
}

module.exports = {
    localProfanityCheck,
    evaluateModeration,
    classifyToxicity,
    checkImageNudity,
    THRESHOLDS
};
