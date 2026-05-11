const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Story = require('../models/Story');
const Notification = require('../models/Notification');
const logger = require('./logger');

/**
 * Propagates user profile updates to all denormalized collections.
 * @param {string} userId - The ID of the user whose profile was updated.
 * @param {Object} updateData - The updated fields (fullname, username, profile_picture).
 */
async function propagateUserProfileUpdate(userId, updateData) {
    const { fullname, username, profile_picture } = updateData;
    
    // Base update object for collections that store user info as 'user' object
    const userUpdate = {};
    if (fullname) userUpdate['user.fullname'] = fullname;
    if (profile_picture) userUpdate['user.profile_picture'] = profile_picture;
    // Note: Post and Comment models don't seem to store username currently, 
    // but we'll include it if they do in the future or in other models.

    try {
        const tasks = [];

        // 1. Update Posts where user is the author
        if (Object.keys(userUpdate).length > 0) {
            tasks.push(Post.updateMany({ 'user._id': userId }, { $set: userUpdate }));
        }

        // 2. Update Posts where user is a collaborator
        const collaboratorUpdate = {};
        if (fullname) collaboratorUpdate['collaborators.$.fullname'] = fullname;
        if (profile_picture) collaboratorUpdate['collaborators.$.profile_picture'] = profile_picture;
        if (Object.keys(collaboratorUpdate).length > 0) {
            tasks.push(Post.updateMany({ 'collaborators.userId': userId }, { $set: collaboratorUpdate }));
        }

        // 3. Update Comments
        if (Object.keys(userUpdate).length > 0) {
            tasks.push(Comment.updateMany({ 'user._id': userId }, { $set: userUpdate }));
        }

        // 4. Update Stories
        if (Object.keys(userUpdate).length > 0) {
            tasks.push(Story.updateMany({ 'user._id': userId }, { $set: userUpdate }));
        }

        // 5. Update Notifications where user is the sender
        const notificationUpdate = {};
        if (fullname) notificationUpdate['sender.fullname'] = fullname;
        if (profile_picture) notificationUpdate['sender.profile_picture'] = profile_picture;
        if (Object.keys(notificationUpdate).length > 0) {
            tasks.push(Notification.updateMany({ 'sender.id': userId }, { $set: notificationUpdate }));
        }

        if (tasks.length > 0) {
            const results = await Promise.allSettled(tasks);
            results.forEach((result, index) => {
                if (result.status === 'rejected') {
                    logger.error(`[Propagation] Task ${index} failed: ${result.reason}`);
                }
            });
            logger.info(`[Propagation] Profile update propagated for user ${userId}`);
        }
    } catch (err) {
        logger.error(`[Propagation] CRITICAL ERROR for user ${userId}: ${err.message}`);
    }
}

/**
 * Handles cleanup when a user is deleted.
 * Removes them from all social lists (followers/following) and updates counts.
 * @param {string} userId - The ID of the deleted user.
 */
async function propagateUserDeletion(userId) {
    try {
        const User = require('../models/User'); // Lazy load to avoid circular dependency
        
        // 1. Find users who are following this deleted user
        // We need to decrement their followingCount
        await User.updateMany(
            { following: userId },
            { $pull: { following: userId }, $inc: { followingCount: -1 } }
        );

        // 2. Find users who are followed by this deleted user
        // We need to decrement their followersCount
        await User.updateMany(
            { followers: userId },
            { $pull: { followers: userId }, $inc: { followersCount: -1 } }
        );

        // 3. Remove from blockedUsers, mutedUsers, dismissedUsers
        await User.updateMany(
            { $or: [
                { blockedUsers: userId },
                { mutedUsers: userId },
                { dismissedUsers: userId }
            ]},
            { $pull: { 
                blockedUsers: userId,
                mutedUsers: userId,
                dismissedUsers: userId
            }}
        );

        // 4. Remove from followRequests
        await User.updateMany(
            { 'followRequests.userId': userId },
            { $pull: { followRequests: { userId: userId } } }
        );

        logger.info(`[Deletion] Cleanup propagation completed for user ${userId}`);
    } catch (err) {
        logger.error(`[Deletion] Propagation error for user ${userId}: ${err.message}`);
    }
}

module.exports = { propagateUserProfileUpdate, propagateUserDeletion };
