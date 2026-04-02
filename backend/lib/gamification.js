const User = require('../models/User');

/**
 * Updates a user's XP and streaks based on their activity.
 * @param {string} userId - The ID of the user.
 * @param {'post' | 'comment' | 'reaction' | 'login'} action - The type of activity.
 */
const updateGamification = async (userId, action) => {
    try {
        const user = await User.findById(userId);
        if (!user) return null;

        let xpGain = 0;
        let streakChanged = false;

        // XP Rules
        const XP_VALUES = {
            post: 50,
            comment: 10,
            reaction: 5,
            login: 20
        };

        xpGain = XP_VALUES[action] || 0;
        user.xp = (user.xp || 0) + xpGain;

        // Level Logic: xp = 100 * (level - 1)^2 => level = sqrt(xp/100) + 1
        const newLevel = Math.floor(Math.sqrt(user.xp / 100)) + 1;
        const levelUp = newLevel > (user.level || 1);
        user.level = newLevel;

        // Streak Logic (Only for posts)
        if (action === 'post') {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            
            const lastPostDate = user.streak?.lastPostDate;
            const lastPostTime = lastPostDate ? new Date(lastPostDate.getFullYear(), lastPostDate.getMonth(), lastPostDate.getDate()).getTime() : 0;

            const oneDayMs = 24 * 60 * 60 * 1000;

            if (lastPostTime === today) {
                // Already posted today, streak remains same
            } else if (lastPostTime === today - oneDayMs) {
                // Posted yesterday, increment streak
                user.streak.count = (user.streak.count || 0) + 1;
                user.streak.lastPostDate = now;
                streakChanged = true;
            } else {
                // Streak broken or first post
                user.streak.count = 1;
                user.streak.lastPostDate = now;
                streakChanged = true;
            }
        }

        await user.save();
        
        return {
            xpGain,
            totalXp: user.xp,
            level: user.level,
            levelUp,
            streakCount: user.streak?.count,
            streakChanged
        };
    } catch (error) {
        console.error('[Gamification Error]:', error);
        return null;
    }
};

module.exports = { updateGamification };
