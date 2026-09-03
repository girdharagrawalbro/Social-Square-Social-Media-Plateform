const mongoose = require('mongoose');
const { USER_DEFAULT_IMAGE } = require('../utils/constantMediaVariable.js');


const UserSchema = new mongoose.Schema({
  fullname: { type: String, required: true },
  username: { type: String, unique: true, sparse: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  profile_picture: {
    type: String,
    default: USER_DEFAULT_IMAGE,
  },
  bio: { type: String, default: null },
  aiProfileSummary: { type: String, default: null },
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  closeFriends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  postsCount: { type: Number, default: 0 },
  followersCount: { type: Number, default: 0 },
  followingCount: { type: Number, default: 0 },
  savedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  googleId: { type: String, default: null },
  githubId: { type: String, default: null },
  authProvider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
  failedLoginAttempts: { type: Number, default: 0 },
  lockoutUntil: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorOtp: { type: String, default: null },
  twoFactorOtpExpires: { type: Date, default: null },

  // Admin
  isAdmin: { type: Boolean, default: false },
  isVerified: { type: Boolean, default: false },
  creatorTier: { type: String, enum: ['none', 'creator', 'pro'], default: 'none' },
  isBanned: { type: Boolean, default: false },
  banReason: { type: String, default: null },
  bannedAt: { type: Date, default: null },

  // User Preferences
  preferredMood: {
    type: String,
    default: null,
    trim: true,
    set: v => (v === "" ? null : v),
    enum: ['happy', 'excited', 'funny', 'romantic', 'inspirational', 'calm', 'nostalgic', 'sad', null]
  },
  isPrivate: { type: Boolean, default: false },
  followRequests: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: { type: Date, default: Date.now }
  }],
  dismissedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],

  // Verification
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String, default: null },
  emailVerificationTokenSentAt: { type: Date, default: null },
  emailVerificationOtp: { type: String, default: null },
  emailVerificationOtpExpires: { type: Date, default: null },

  // Analytics
  profileViews: { type: Number, default: 0 },

  // User Preferences
  notificationSettings: {
    emailDigest: { type: Boolean, default: false },
    pushEnabled: { type: Boolean, default: true },
    likes: { type: Boolean, default: true },
    comments: { type: Boolean, default: true },
    newFollowers: { type: Boolean, default: true },
    directMessages: { type: Boolean, default: true },
    liveVideos: { type: Boolean, default: true },
    postNotifications: { type: Boolean, default: true },
    userNotifications: { type: Boolean, default: true },
    chatNotifications: { type: Boolean, default: true },
  },
  privacySettings: {
    hideActivityStatus: { type: Boolean, default: false },
    activityStatusMode: { type: String, enum: ['visible', 'stealth', 'hidden_both'], default: 'visible' },
    hideLikesOnOthersPosts: { type: Boolean, default: false },
    hideLikesOnMyPosts: { type: Boolean, default: false },
    hideCommentCountOnMyPosts: { type: Boolean, default: false },
    hideShareCountOnMyPosts: { type: Boolean, default: false },
    disableCommentsGlobally: { type: Boolean, default: false },
    allowedCommenters: { type: String, enum: ['everyone', 'people_you_follow', 'followers', 'following_and_followers', 'no_one'], default: 'everyone' },
    allowedMentions: { type: String, enum: ['everyone', 'people_you_follow', 'no_one'], default: 'everyone' },
    allowedTags: { type: String, enum: ['everyone', 'people_you_follow', 'no_one'], default: 'everyone' },
    manuallyApproveTags: { type: Boolean, default: false },
    allowStoryMessageReplies: { type: String, enum: ['everyone', 'people_you_follow', 'off'], default: 'everyone' },
    hideProfanity: { type: Boolean, default: true }
  },
  hiddenWords: [{ type: String }],
  hideStoryFrom: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  mutedStories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  notInterestedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  interestedPosts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],

  // Time Spent Analytics
  usageStats: [{
    date: { type: String }, // YYYY-MM-DD
    durationSeconds: { type: Number, default: 0 }
  }],

  // Presence
  isOnline: { type: Boolean, default: false },
  lastSeen: { type: Date, default: Date.now },

  // Account History
  accountHistory: [{
    action: { type: String }, // e.g., 'LOGIN', 'PASSWORD_CHANGED', '2FA_TOGGLED', 'PROFILE_UPDATED'
    details: { type: String },
    ipAddress: { type: String },
    createdAt: { type: Date, default: Date.now }
  }],

  // Gamification
  streak: {
    count: { type: Number, default: 0 },
    lastPostDate: { type: Date, default: null }
  },
  xp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },

  // Welcome State
  hasSeenWelcome: { type: Boolean, default: false },

  publicKey: { type: String, default: null },
  encryptedPrivateKey: {
    ciphertext: { type: String, default: null },
    iv: { type: String, default: null },
    salt: { type: String, default: null }
  },

  // Admin Deletion & Appeals
  deletionScheduledAt: { type: Date, default: null },
  deletionReason: { type: String, default: null },
  deletionAppealStatus: { type: String, enum: ['none', 'appealed', 'rejected'], default: 'none' },
  deletionAppealText: { type: String, default: null },

  deletedAt: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
});


UserSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.twoFactorOtp;
    delete ret.twoFactorOtpExpires;
    delete ret.resetPasswordToken;
    delete ret.resetPasswordExpires;
    delete ret.emailVerificationToken;
    delete ret.emailVerificationOtp;
    delete ret.emailVerificationOtpExpires;
    delete ret.failedLoginAttempts;
    delete ret.lockoutUntil;
    delete ret.googleId;
    delete ret.githubId;
    return ret;
  }
});

UserSchema.index({ fullname: 1 });
UserSchema.index({ blockedUsers: 1 });
UserSchema.index({ mutedUsers: 1 });

module.exports = mongoose.model('User', UserSchema);