const User = require('../models/User');
const { createNotification } = require('../lib/notification');

/**
 * Parses text for @username mentions and sends a notification to each mentioned user.
 * 
 * @param {String} text - The caption, comment content, or story text.
 * @param {String} senderId - ObjectId of the user doing the mentioning.
 * @param {String} [postId] - Optional ObjectId of the related post.
 * @param {String} [commentId] - Optional ObjectId of the related comment.
 * @param {String} [url] - Optional landing URL.
 */
async function handleMentions(text, senderId, postId = null, commentId = null, url = null) {
    if (!text || typeof text !== 'string') return;

    // Match all @username references (usernames can contain letters, numbers, underscores, periods)
    const matches = text.match(/@([a-zA-Z0-9_\.]+)/g);
    if (!matches || matches.length === 0) return;

    // Deduplicate and clean usernames (remove the '@' symbol)
    const usernames = [...new Set(matches.map(m => m.substring(1).toLowerCase()))];

    try {
        const sender = await User.findById(senderId).select('fullname profile_picture').lean();
        if (!sender) return;

        // Find users with these usernames
        const mentionedUsers = await User.find({
            username: { $in: usernames },
            deletedAt: null
        }).select('_id username').lean();

        for (const targetUser of mentionedUsers) {
            // Don't notify the sender themselves
            if (targetUser._id.toString() === senderId.toString()) continue;

            const finalUrl = url || (postId ? `/post/${postId}` : null);

            await createNotification({
                recipientId: targetUser._id,
                sender: {
                    id: sender._id,
                    fullname: sender.fullname,
                    profile_picture: sender.profile_picture
                },
                type: 'mention',
                postId: postId || null,
                message: {
                    content: text
                },
                url: finalUrl
            });
            console.log(`📩 Sent mention notification to @${targetUser.username} from ${sender.fullname}`);
        }
    } catch (err) {
        console.error('[Mention Service Error]:', err.message);
    }
}

module.exports = {
    handleMentions
};
